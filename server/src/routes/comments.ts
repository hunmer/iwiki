import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

// Get comments for a document (tree structure)
router.get('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const nodeId = req.params.nodeId;

  const node = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    res.status(404).json({ error: '文档不存在' });
    return;
  }

  const comments = db.prepare(
    `SELECT id, node_id, parent_id, nickname, content, created_at
     FROM comments
     WHERE node_id = ? AND is_deleted = 0
     ORDER BY created_at ASC`
  ).all(nodeId);

  res.json(comments);
});

// Create comment (guest accessible)
router.post('/', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const nodeId = req.params.nodeId;
  const { nickname, content, parentId = null } = req.body;

  if (!nickname || !content) {
    res.status(400).json({ error: '昵称和内容不能为空' });
    return;
  }

  if (nickname.length > 50 || content.length > 2000) {
    res.status(400).json({ error: '内容过长' });
    return;
  }

  const node = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);
  if (!node) {
    res.status(404).json({ error: '文档不存在' });
    return;
  }

  if (parentId) {
    const parent = db.prepare(
      'SELECT id FROM comments WHERE id = ? AND node_id = ? AND is_deleted = 0'
    ).get(parentId, nodeId);
    if (!parent) {
      res.status(400).json({ error: '回复的评论不存在' });
      return;
    }
  }

  const id = uuid();
  const now = Date.now();

  db.prepare(
    `INSERT INTO comments (id, node_id, parent_id, nickname, content, is_deleted, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  ).run(id, nodeId, parentId, nickname, content, now);

  res.status(201).json({ id, nodeId, parentId, nickname, content, createdAt: now });
});

// Delete comment (admin only)
router.delete('/:commentId', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { commentId } = req.params;

  const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(commentId);
  if (!comment) {
    res.status(404).json({ error: '评论不存在' });
    return;
  }

  // Soft delete: the comment and all its replies
  db.prepare('UPDATE comments SET is_deleted = 1 WHERE id = ?').run(commentId);
  db.prepare('UPDATE comments SET is_deleted = 1 WHERE parent_id = ?').run(commentId);

  res.json({ success: true });
});

export default router;
