import { Router, Response } from 'express';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 获取所有标签（含文档计数）
router.get('/', (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const rows = db.prepare('SELECT tags FROM nodes WHERE is_trash = 0').all() as any[];

  const tagMap = new Map<string, number>();
  for (const row of rows) {
    let tags: string[];
    try { tags = JSON.parse(row.tags); } catch { continue; }
    if (!Array.isArray(tags)) continue;
    for (const t of tags) {
      if (typeof t === 'string' && t.trim()) {
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      }
    }
  }

  const result = Array.from(tagMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json(result);
});

// 重命名标签（需要认证）
router.put('/rename', authMiddleware, (req: AuthRequest, res: Response) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName || typeof oldName !== 'string' || typeof newName !== 'string') {
    res.status(400).json({ error: '参数无效' });
    return;
  }
  if (oldName === newName) {
    res.json({ success: true, updated: 0 });
    return;
  }

  const db = getDb();
  const now = Date.now();

  const renameTag = db.transaction(() => {
    const rows = db.prepare(
      "SELECT id, tags FROM nodes WHERE tags LIKE ?"
    ).all(`%"${oldName}"%`) as any[];

    let updated = 0;
    const updateStmt = db.prepare('UPDATE nodes SET tags = ?, updated_at = ? WHERE id = ?');

    for (const row of rows) {
      let tags: string[];
      try { tags = JSON.parse(row.tags); } catch { continue; }
      if (!Array.isArray(tags)) continue;

      const idx = tags.indexOf(oldName);
      if (idx === -1) continue;

      // 如果 newName 已存在则移除旧的避免重复
      if (tags.includes(newName)) {
        tags.splice(idx, 1);
      } else {
        tags[idx] = newName;
      }

      updateStmt.run(JSON.stringify(tags), now, row.id);
      updated++;
    }
    return updated;
  });

  const updated = renameTag();
  res.json({ success: true, updated });
});

// 删除标签（需要认证）
router.delete('/:name', authMiddleware, (req: AuthRequest, res: Response) => {
  const tagName = req.params.name as string;
  if (!tagName) {
    res.status(400).json({ error: '标签名不能为空' });
    return;
  }

  const db = getDb();
  const now = Date.now();

  const deleteTag = db.transaction(() => {
    const rows = db.prepare(
      "SELECT id, tags FROM nodes WHERE tags LIKE ?"
    ).all(`%"${tagName}"%`) as any[];

    let updated = 0;
    const updateStmt = db.prepare('UPDATE nodes SET tags = ?, updated_at = ? WHERE id = ?');

    for (const row of rows) {
      let tags: string[];
      try { tags = JSON.parse(row.tags); } catch { continue; }
      if (!Array.isArray(tags)) continue;

      const idx = tags.indexOf(tagName);
      if (idx === -1) continue;

      tags.splice(idx, 1);
      updateStmt.run(JSON.stringify(tags), now, row.id);
      updated++;
    }
    return updated;
  });

  const updated = deleteTag();
  res.json({ success: true, updated });
});

export default router;
