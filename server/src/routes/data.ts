import { Router, Response } from 'express';
import multer from 'multer';
import * as archiver from 'archiver';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Database from 'better-sqlite3';
import { v4 as uuid } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { DATA_DIR, DOCS_DIR, UPLOADS_DIR, DB_PATH } from '../constants';
import { getDb } from '../db';

const router = Router();

const MAX_IMPORT_SIZE = 200 * 1024 * 1024; // 200MB

type ArchiverModule = typeof archiver & {
  ZipArchive: new (options?: archiver.ArchiverOptions) => archiver.Archiver;
};

function createZipArchive(options: archiver.ArchiverOptions): archiver.Archiver {
  return new (archiver as ArchiverModule).ZipArchive(options);
}

// 简单的内存速率限制器
const importRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1小时
const RATE_LIMIT_MAX_REQUESTS = 5; // 每小时最多5次导入请求

/**
 * 检查速率限制
 */
function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = importRateLimit.get(identifier);

  if (!record || now > record.resetTime) {
    // 创建新的限制记录或重置过期的记录
    importRateLimit.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * 清理过期的速率限制记录（每小时执行一次）
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of importRateLimit.entries()) {
    if (now > record.resetTime) {
      importRateLimit.delete(key);
    }
  }
}, 60 * 60 * 1000).unref();

/**
 * 验证路径是否安全，防止路径遍历攻击
 */
function isPathSafe(entryName: string, allowedPrefix: string): boolean {
  // 检查是否包含 .. 用于防止路径遍历
  if (entryName.includes('..')) {
    return false;
  }

  // 检查是否以允许的前缀开头
  if (!entryName.startsWith(allowedPrefix)) {
    return false;
  }

  // 规范化路径并再次检查
  const normalized = path.normalize(entryName);
  return normalized.startsWith(allowedPrefix) && !normalized.includes('..');
}

// 数据库记录类型定义
interface NodeRecord {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  type: string;
  tags: string;
  sort_order: number;
  is_trash: number;
  created_at: string;
  updated_at: string;
}

interface VersionRecord {
  id: string;
  node_id: string;
  content: string;
  created_at: string;
}

interface CommentRecord {
  id: string;
  node_id: string;
  parent_id: string | null;
  nickname: string;
  content: string;
  is_deleted: number;
  created_at: string;
}

interface EmbeddingRecord {
  node_id: string;
  chunk_index: number;
  content: string;
  embedding: Buffer;
  updated_at: string;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      cb(new Error('只支持 ZIP 文件'));
      return;
    }
    cb(null, true);
  },
});

// GET /api/data/export — 导出所有数据为 ZIP 文件
router.get('/export', authMiddleware, (req: AuthRequest, res: Response) => {
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `iwiki-export-${timestamp}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const archive = createZipArchive({
    zlib: { level: 9 }, // 最高压缩级别
  });

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: '导出失败' });
    }
  });

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn('Archive warning:', err);
    } else {
      console.error('Archive warning:', err);
    }
  });

  archive.pipe(res);

  // 添加数据库文件
  if (fs.existsSync(DB_PATH)) {
    archive.file(DB_PATH, { name: 'wiki.db' });
  }

  // 添加文档目录
  if (fs.existsSync(DOCS_DIR)) {
    archive.directory(DOCS_DIR, 'docs');
  }

  // 添加上传文件目录
  if (fs.existsSync(UPLOADS_DIR)) {
    archive.directory(UPLOADS_DIR, 'uploads');
  }

  archive.finalize().catch((err) => {
    console.error('Archive finalize error:', err);
  });
});

// POST /api/data/import — 导入 ZIP 文件并合并数据
router.post('/import', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  // 应用速率限制（基于用户ID）
  const userId = req.userId || 'unknown';
  if (!checkRateLimit(userId)) {
    res.status(429).json({ error: '导入请求过于频繁，请稍后再试' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: '未提供文件' });
    return;
  }

  let tempDir: string | null = null;
  let tempDb: Database.Database | null = null;

  try {
    // 读取 ZIP 文件
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    // 验证 ZIP 必须包含 wiki.db
    const dbEntry = entries.find((e) => e.entryName === 'wiki.db');
    if (!dbEntry) {
      res.status(400).json({ error: 'ZIP 文件中缺少 wiki.db' });
      return;
    }

    // 创建临时目录
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iwiki-import-'));
    const tempDbPath = path.join(tempDir, 'wiki.db');
    fs.writeFileSync(tempDbPath, dbEntry.getData());

    // 打开临时数据库（只读模式）
    tempDb = new Database(tempDbPath, { readonly: true, fileMustExist: true });

    // 验证临时数据库表结构
    const tableListResult = tempDb.pragma('table_list', { simple: false }) as Array<{ name: string }>;
    const tables = tableListResult.map((row) => row.name);
    const requiredTables = ['nodes', 'versions', 'comments', 'embeddings'];
    const missingTables = requiredTables.filter((t) => !tables.includes(t));
    if (missingTables.length > 0) {
      res.status(400).json({ error: `数据库缺少必需的表: ${missingTables.join(', ')}` });
      return;
    }

    // 获取主数据库连接
    const mainDb = getDb();

    // 合并统计
    const stats = {
      nodesAdded: 0,
      versionsAdded: 0,
      commentsAdded: 0,
      embeddingsAdded: 0,
      docsAdded: 0,
      uploadsAdded: 0,
    };

    // 使用事务批量导入数据以提高效率
    const importTransaction = mainDb.transaction(() => {
      // 合并 nodes 表
      const nodes = tempDb!.prepare('SELECT * FROM nodes').all() as NodeRecord[];
      const insertNode = mainDb.prepare(
        'INSERT OR IGNORE INTO nodes (id, parent_id, title, icon, type, tags, sort_order, is_trash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      );
      for (const node of nodes) {
        const result = insertNode.run(
          node.id,
          node.parent_id,
          node.title,
          node.icon,
          node.type || 'doc',
          node.tags || '[]',
          node.sort_order || 0,
          node.is_trash || 0,
          node.created_at,
          node.updated_at
        );
        if (result.changes > 0) stats.nodesAdded++;
      }

      // 合并 versions 表
      const versions = tempDb!.prepare('SELECT * FROM versions').all() as VersionRecord[];
      const insertVersion = mainDb.prepare(
        'INSERT OR IGNORE INTO versions (id, node_id, content, created_at) VALUES (?, ?, ?, ?)'
      );
      for (const version of versions) {
        const result = insertVersion.run(
          version.id,
          version.node_id,
          version.content || '',
          version.created_at
        );
        if (result.changes > 0) stats.versionsAdded++;
      }

      // 合并 comments 表
      const comments = tempDb!.prepare('SELECT * FROM comments').all() as CommentRecord[];
      const insertComment = mainDb.prepare(
        'INSERT OR IGNORE INTO comments (id, node_id, parent_id, nickname, content, is_deleted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      for (const comment of comments) {
        const result = insertComment.run(
          comment.id,
          comment.node_id,
          comment.parent_id,
          comment.nickname,
          comment.content,
          comment.is_deleted || 0,
          comment.created_at
        );
        if (result.changes > 0) stats.commentsAdded++;
      }

      // 合并 embeddings 表（全量导入以支持语义搜索）
      const embeddings = tempDb!.prepare('SELECT * FROM embeddings').all() as EmbeddingRecord[];
      const insertEmbedding = mainDb.prepare(
        'INSERT OR IGNORE INTO embeddings (node_id, chunk_index, content, embedding, updated_at) VALUES (?, ?, ?, ?, ?)'
      );
      for (const embedding of embeddings) {
        const result = insertEmbedding.run(
          embedding.node_id,
          embedding.chunk_index,
          embedding.content || '',
          embedding.embedding,
          embedding.updated_at
        );
        if (result.changes > 0) stats.embeddingsAdded++;
      }
    });

    // 执行导入事务
    importTransaction();

    // 关闭临时数据库
    tempDb.close();
    tempDb = null;

    // 解压 docs 文件（带路径遍历保护）
    for (const entry of entries) {
      const entryPath = entry.entryName;
      // 使用安全路径检查
      if (isPathSafe(entryPath, 'docs/') && entryPath.endsWith('.md') && !entry.isDirectory) {
        const filename = path.basename(entryPath);
        const targetPath = path.join(DOCS_DIR, filename);
        // 跳过已存在的文件
        if (!fs.existsSync(targetPath)) {
          fs.writeFileSync(targetPath, entry.getData());
          stats.docsAdded++;
        }
      }
    }

    // 解压 uploads 文件（带路径遍历保护）
    for (const entry of entries) {
      const entryPath = entry.entryName;
      // 使用安全路径检查
      if (isPathSafe(entryPath, 'uploads/') && !entry.isDirectory) {
        const filename = path.basename(entryPath);
        const targetPath = path.join(UPLOADS_DIR, filename);
        // 跳过已存在的文件
        if (!fs.existsSync(targetPath)) {
          fs.writeFileSync(targetPath, entry.getData());
          stats.uploadsAdded++;
        }
      }
    }

    res.json(stats);
  } catch (error: any) {
    console.error('Import error:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: error.message || '导入失败' });
    }
  } finally {
    // 确保临时数据库被关闭
    if (tempDb) {
      try {
        tempDb.close();
      } catch (err) {
        console.error('Error closing temp database:', err);
      }
    }

    // 确保临时目录被清理
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        console.error('Error cleaning up temp directory:', err);
      }
    }
  }
});

// Multer 错误处理中间件
router.use((err: any, _req: any, res: Response, _next: any) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: '文件大小超过限制 (最大 200MB)' });
    return;
  }
  if (err.message?.includes('只支持 ZIP')) {
    res.status(415).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: '导入失败' });
});

export default router;
