import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getDb } from './db';
import { DATA_DIR, UPLOADS_DIR } from './constants';
import authRoutes from './routes/auth';
import nodeRoutes from './routes/nodes';
import commentRoutes from './routes/comments';
import vectorRoutes from './routes/vector';
import chatRoutes from './routes/chat';
import tagRoutes from './routes/tags';
import uploadRoutes from './routes/uploads';
import dataRoutes from './routes/data';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;

  // 记录请求开始
  console.log(`📥 [${new Date().toISOString()}] ${method} ${url} - ${ip}`);

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const statusEmoji = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : statusCode >= 300 ? '↪️' : '✅';
    console.log(`📤 [${new Date().toISOString()}] ${method} ${url} - ${statusCode} ${statusEmoji} (${duration}ms)`);
  });

  next();
});

getDb();

app.use('/api/auth', authRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/nodes/:nodeId/comments', commentRoutes);
app.use('/api/vector', vectorRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/data', dataRoutes);

// 静态文件服务：上传的图片/视频
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// 404 处理
app.use((_req, res) => {
  console.log(`⚠️ [${new Date().toISOString()}] 404 - Route not found`);
  res.status(404).json({ error: 'Not found' });
});

// 全局错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const { method, url, ip } = req;
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  // 输出错误日志
  console.error(`❌ [${new Date().toISOString()}] ERROR: ${method} ${url}`);
  console.error(`   Status: ${statusCode}`);
  console.error(`   Message: ${message}`);
  console.error(`   IP: ${ip}`);

  // 开发环境下输出堆栈信息
  if (process.env.NODE_ENV !== 'production') {
    console.error(`   Stack: ${err.stack}`);
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
