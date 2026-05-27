import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getVectorStats, buildIndex, vectorSearch } from '../services/vector';

const router = Router();

router.get('/stats', (_req: AuthRequest, res: Response) => {
  res.json(getVectorStats());
});

router.post('/index', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await buildIndex();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/search', async (req: AuthRequest, res: Response) => {
  const { query, topK = 5 } = req.body;
  if (!query) {
    res.status(400).json({ error: '查询内容不能为空' });
    return;
  }
  try {
    const results = await vectorSearch(query, topK);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
