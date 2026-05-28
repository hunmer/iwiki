import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const DATA_DIR = process.env.DATA_DIR || './data';
const UPLOADS_DIR = path.resolve(DATA_DIR, 'uploads');

// 确保上传目录存在
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = new Set([
  // 图片
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  // 视频
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
  if (err.message?.startsWith('不支持的文件类型')) {
    res.status(415).json({ error: err.message });
    return;
  }
  res.status(500).json({ error: '上传失败' });
});

export default router;
