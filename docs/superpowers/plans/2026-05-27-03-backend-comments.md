# 03 - 后端：评论系统

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现游客评论 API，支持嵌套回复，管理员可软删除。游客无需登录即可发评论。

**Architecture:** 评论绑定到文档节点，支持一级回复（parentId 指向另一条评论）。游客提交昵称+内容，管理员可删除。

**Tech Stack:** Express, better-sqlite3

**Depends on:** 02-backend-core

---

## File Structure

```
server/src/
├── index.ts                 # 修改: 注册评论路由
└── routes/
    └── comments.ts          # 新增: 评论 CRUD
```

---

### Task 1: 评论路由

**Files:**
- Create: `server/src/routes/comments.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: 创建 server/src/routes/comments.ts**

```typescript
import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router({ mergeParams: true });

// 获取某文档的评论（树形结构）
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

// 创建评论（游客可访问）
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

// 删除评论（仅管理员）
router.delete('/:commentId', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { commentId } = req.params;

  const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(commentId);
  if (!comment) {
    res.status(404).json({ error: '评论不存在' });
    return;
  }

  // 软删除：该评论及其所有回复
  db.prepare('UPDATE comments SET is_deleted = 1 WHERE id = ?').run(commentId);
  db.prepare('UPDATE comments SET is_deleted = 1 WHERE parent_id = ?').run(commentId);

  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: 在 server/src/index.ts 注册路由**

在 `app.use('/api/nodes', nodeRoutes);` 后添加:

```typescript
import commentRoutes from './routes/comments';
app.use('/api/nodes/:nodeId/comments', commentRoutes);
```

- [ ] **Step 3: 验证评论功能**

```bash
cd server
npx tsx src/index.ts
```

测试:
```bash
# 先创建一个文档节点
curl -X POST http://localhost:3001/api/nodes -H "Content-Type: application/json" -d "{\"title\":\"测试文档\"}"
# 假设返回 id = xxx

# 创建评论
curl -X POST http://localhost:3001/api/nodes/xxx/comments -H "Content-Type: application/json" -d "{\"nickname\":\"游客\",\"content\":\"很好的文章\"}"

# 获取评论
curl http://localhost:3001/api/nodes/xxx/comments

# 回复评论（假设评论 id = yyy）
curl -X POST http://localhost:3001/api/nodes/xxx/comments -H "Content-Type: application/json" -d "{\"nickname\":\"管理员\",\"content\":\"谢谢\",\"parentId\":\"yyy\"}"
```

- [ ] **Step 4: 提交**

```bash
cd ..
git add server/src/
git commit -m "feat(server): add comment system with guest posting and admin moderation"
```
