import { Router, Response } from 'express';
import { streamChat } from '../services/chat';

const router = Router();

router.post('/', async (req: any, res: Response) => {
  const { message, history = [] } = req.body;
  if (!message) {
    res.status(400).json({ error: '消息不能为空' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    for await (const chunk of streamChat(message, history)) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  res.end();
});

export default router;
