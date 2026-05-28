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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

getDb();

app.use('/api/auth', authRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/nodes/:nodeId/comments', commentRoutes);
app.use('/api/vector', vectorRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/uploads', uploadRoutes);

// 静态文件服务：上传的图片/视频
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
