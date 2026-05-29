import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../constants';

// 确保上传目录存在
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// MIME 类型与允许的扩展名映射（用于交叉校验，防止伪造扩展名）
const MIME_EXT_MAP: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_EXT_MAP));

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
      return;
    }
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = MIME_EXT_MAP[file.mimetype];
    if (allowedExts && ext && !allowedExts.includes(ext)) {
      cb(new Error(`文件扩展名 ${ext} 与文件类型 ${file.mimetype} 不匹配`));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post(
  '/',
  authMiddleware,
  upload.single('file'),
  (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: '未提供文件' });
      return;
    }

    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url });
  }
);

// multer 错误处理中间件
router.use((err: any, _req: any, res: Response, _next: any) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: '文件大小超过限制 (最大 50MB)' });
    return;
  }
  if (err.message?.startsWith('不支持的文件类型') || err.message?.includes('不匹配')) {
    res.status(415).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: '上传失败' });
});

export default router;
