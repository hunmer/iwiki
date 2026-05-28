import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, readDocContent, writeDocContent, deleteDocContent } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all nodes (tree metadata)
router.get('/', (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const nodes = db.prepare(
    'SELECT id, parent_id, title, icon, sort_order, is_trash, created_at, updated_at FROM nodes ORDER BY sort_order ASC'
  ).all();
  res.json(nodes);
});

// Get single node with content
router.get('/:id', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const node = db.prepare(
    'SELECT id, parent_id, title, icon, sort_order, is_trash, created_at, updated_at FROM nodes WHERE id = ?'
  ).get(req.params.id) as any;

  if (!node) {
    res.status(404).json({ error: '文档不存在' });
    return;
  }

  res.json({ ...node, content: readDocContent(node.id) });
});

// Create node
router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const id = uuid();
  const now = Date.now();
  const { title = '', parentId = null, icon = '📄' } = req.body;

  db.prepare(
    `INSERT INTO nodes (id, parent_id, title, icon, sort_order, is_trash, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, 0, ?, ?)`
  ).run(id, parentId, title, icon, now, now);

  writeDocContent(id, '');
  res.status(201).json({ id, parentId, title, icon, sortOrder: 0, isTrash: 0, createdAt: now, updatedAt: now });
});

// Batch reorder nodes
router.put('/reorder', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { moves } = req.body;

  if (!Array.isArray(moves) || moves.length === 0) {
    res.status(400).json({ error: '无效参数' });
    return;
  }

  const now = Date.now();
  const updateMany = db.transaction((items: any[]) => {
    for (const item of items) {
      db.prepare(
        'UPDATE nodes SET parent_id = ?, sort_order = ?, updated_at = ? WHERE id = ?'
      ).run(item.parentId, item.sortOrder, now, item.id);
    }
  });

  updateMany(moves);
  res.json({ success: true });
});

// Update node metadata
router.put('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const now = Date.now();
  const { title, icon, sortOrder, parentId } = req.body;
  const sets: string[] = [];
  const values: any[] = [];

  if (title !== undefined) { sets.push('title = ?'); values.push(title); }
  if (icon !== undefined) { sets.push('icon = ?'); values.push(icon); }
  if (sortOrder !== undefined) { sets.push('sort_order = ?'); values.push(sortOrder); }
  if (parentId !== undefined) { sets.push('parent_id = ?'); values.push(parentId); }

  if (sets.length === 0) {
    res.status(400).json({ error: '无更新内容' });
    return;
  }

  sets.push('updated_at = ?');
  values.push(now);
  values.push(req.params.id);

  db.prepare(`UPDATE nodes SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  res.json({ success: true });
});

// Update document content
router.put('/:id/content', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { content } = req.body;
  const nodeId = req.params.id;
  const now = Date.now();

  const node = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId) as any;
  if (!node) {
    res.status(404).json({ error: '文档不存在' });
    return;
  }

  writeDocContent(nodeId, content);

  const versionId = uuid();
  db.prepare(
    'INSERT INTO versions (id, node_id, content, created_at) VALUES (?, ?, ?, ?)'
  ).run(versionId, nodeId, content, now);

  db.prepare('UPDATE nodes SET updated_at = ? WHERE id = ?').run(now, nodeId);
  res.json({ success: true });
});

// Delete node (and children)
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const nodeId = req.params.id;

  const collectChildren = (pid: string): string[] => {
    const children = db.prepare('SELECT id FROM nodes WHERE parent_id = ?').all(pid) as any[];
    return children.flatMap(c => [c.id, ...collectChildren(c.id)]);
  };

  const allIds = [nodeId, ...collectChildren(nodeId)];

  const deleteMany = db.transaction((ids: string[]) => {
    for (const id of ids) {
      db.prepare('DELETE FROM versions WHERE node_id = ?').run(id);
      db.prepare('DELETE FROM comments WHERE node_id = ?').run(id);
      db.prepare('DELETE FROM embeddings WHERE node_id = ?').run(id);
      db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
      deleteDocContent(id);
    }
  });

  deleteMany(allIds);
  res.json({ success: true });
});

// Trash/restore node
router.put('/:id/trash', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { isTrash } = req.body;
  db.prepare('UPDATE nodes SET is_trash = ?, updated_at = ? WHERE id = ?')
    .run(isTrash ? 1 : 0, Date.now(), req.params.id);
  res.json({ success: true });
});

// Move node
router.put('/:id/move', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { parentId, sortOrder } = req.body;
  const now = Date.now();

  if (parentId !== undefined) {
    db.prepare('UPDATE nodes SET parent_id = ?, updated_at = ? WHERE id = ?')
      .run(parentId, now, req.params.id);
  }
  if (sortOrder !== undefined) {
    db.prepare('UPDATE nodes SET sort_order = ?, updated_at = ? WHERE id = ?')
      .run(sortOrder, now, req.params.id);
  }

  res.json({ success: true });
});

// Get version history
router.get('/:id/versions', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const versions = db.prepare(
    'SELECT id, node_id, created_at FROM versions WHERE node_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);
  res.json(versions);
});

// Get version content
router.get('/:id/versions/:versionId', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const version = db.prepare(
    'SELECT id, node_id, content, created_at FROM versions WHERE id = ?'
  ).get(req.params.versionId) as any;

  if (!version) {
    res.status(404).json({ error: '版本不存在' });
    return;
  }

  res.json(version);
});

// Restore version
router.post('/:id/versions/restore', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { versionId } = req.body;
  const now = Date.now();

  const version = db.prepare('SELECT content FROM versions WHERE id = ?').get(versionId) as any;
  if (!version) {
    res.status(404).json({ error: '版本不存在' });
    return;
  }

  writeDocContent(req.params.id, version.content);

  const newId = uuid();
  db.prepare(
    'INSERT INTO versions (id, node_id, content, created_at) VALUES (?, ?, ?, ?)'
  ).run(newId, req.params.id, version.content, now);

  db.prepare('UPDATE nodes SET updated_at = ? WHERE id = ?').run(now, req.params.id);
  res.json({ success: true });
});

export default router;
