import { Router, Response } from 'express';
import multer from 'multer';
import archiver from 'archiver';
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

  const archive = archiver('zip', {
    zlib: { level: 9 }, // 最高压缩级别
  });

  archive.on('error', (err) => {
    console.error('Archive error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: '导出失败' });
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

  archive.finalize();
});

// POST /api/data/import — 导入 ZIP 文件并合并数据
router.post('/import', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: '未提供文件' });
    return;
  }

  let tempDbPath: string | null = null;

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

    // 提取 wiki.db 到临时文件
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iwiki-import-'));
    tempDbPath = path.join(tempDir, 'wiki.db');
    fs.writeFileSync(tempDbPath, dbEntry.getData());

    // 打开临时数据库（只读模式）
    const tempDb = new Database(tempDbPath, { readonly: true, fileMustExist: true });

    // 验证临时数据库表结构
    const tableListResult = tempDb.pragma('table_list', { simple: false }) as Array<{ name: string }>;
    const tables = tableListResult.map((row) => row.name);
    const requiredTables = ['nodes', 'versions', 'comments', 'embeddings'];
    const missingTables = requiredTables.filter((t) => !tables.includes(t));
    if (missingTables.length > 0) {
      tempDb.close();
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

    // 合并 nodes 表
    const nodes = tempDb.prepare('SELECT * FROM nodes').all();
    const insertNode = mainDb.prepare(
      'INSERT OR IGNORE INTO nodes (id, parent_id, title, icon, type, tags, sort_order, is_trash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const node of nodes) {
      const result = insertNode.run(
        (node as any).id,
        (node as any).parent_id,
        (node as any).title,
        (node as any).icon,
        (node as any).type || 'doc',
        (node as any).tags || '[]',
        (node as any).sort_order || 0,
        (node as any).is_trash || 0,
        (node as any).created_at,
        (node as any).updated_at
      );
      if (result.changes > 0) stats.nodesAdded++;
    }

    // 合并 versions 表
    const versions = tempDb.prepare('SELECT * FROM versions').all();
    const insertVersion = mainDb.prepare(
      'INSERT OR IGNORE INTO versions (id, node_id, content, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const version of versions) {
      const result = insertVersion.run(
        (version as any).id,
        (version as any).node_id,
        (version as any).content || '',
        (version as any).created_at
      );
      if (result.changes > 0) stats.versionsAdded++;
    }

    // 合并 comments 表
    const comments = tempDb.prepare('SELECT * FROM comments').all();
    const insertComment = mainDb.prepare(
      'INSERT OR IGNORE INTO comments (id, node_id, parent_id, nickname, content, is_deleted, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const comment of comments) {
      const result = insertComment.run(
        (comment as any).id,
        (comment as any).node_id,
        (comment as any).parent_id,
        (comment as any).nickname,
        (comment as any).content,
        (comment as any).is_deleted || 0,
        (comment as any).created_at
      );
      if (result.changes > 0) stats.commentsAdded++;
    }

    // 合并 embeddings 表
    const embeddings = tempDb.prepare('SELECT * FROM embeddings').all();
    const insertEmbedding = mainDb.prepare(
      'INSERT OR IGNORE INTO embeddings (node_id, chunk_index, content, embedding, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    for (const embedding of embeddings) {
      const result = insertEmbedding.run(
        (embedding as any).node_id,
        (embedding as any).chunk_index,
        (embedding as any).content || '',
        (embedding as any).embedding,
        (embedding as any).updated_at
      );
      if (result.changes > 0) stats.embeddingsAdded++;
    }

    tempDb.close();

    // 解压 docs 文件
    for (const entry of entries) {
      const entryPath = entry.entryName;
      if (entryPath.startsWith('docs/') && entryPath.endsWith('.md') && !entry.isDirectory) {
        const filename = path.basename(entryPath);
        const targetPath = path.join(DOCS_DIR, filename);
        // 跳过已存在的文件
        if (!fs.existsSync(targetPath)) {
          fs.writeFileSync(targetPath, entry.getData());
          stats.docsAdded++;
        }
      }
    }

    // 解压 uploads 文件
    for (const entry of entries) {
      const entryPath = entry.entryName;
      if (entryPath.startsWith('uploads/') && !entry.isDirectory) {
        const filename = path.basename(entryPath);
        const targetPath = path.join(UPLOADS_DIR, filename);
        // 跳过已存在的文件
        if (!fs.existsSync(targetPath)) {
          fs.writeFileSync(targetPath, entry.getData());
          stats.uploadsAdded++;
        }
      }
    }

    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true });

    res.json(stats);
  } catch (error: any) {
    console.error('Import error:', error);

    // 清理临时文件
    if (tempDbPath && fs.existsSync(path.dirname(tempDbPath))) {
      try {
        fs.rmSync(path.dirname(tempDbPath), { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({ error: error.message || '导入失败' });
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
