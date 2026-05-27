import { Router, Request, Response } from 'express';
import { createToken, authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = createToken();
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });
    res.json({ success: true });
    return;
  }
  res.status(401).json({ error: '用户名或密码错误' });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
});

router.get('/check', authMiddleware, (_req: AuthRequest, res: Response) => {
  res.json({ authenticated: true });
});

export default router;
