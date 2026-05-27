# 02 - 后端核心：Auth + 文档 CRUD

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Express 后端的认证系统和文档 CRUD API，包括 SQLite schema、文件系统存储、JWT 认证。

**Architecture:** SQLite (better-sqlite3) 存元数据，文件系统存 Markdown 内容。JWT + HttpOnly cookie 做管理员认证。路由按职责拆分。

**Tech Stack:** Express, better-sqlite3, jsonwebtoken, cookie-parser, uuid

**Depends on:** 01-scaffolding

---

## File Structure

```
server/src/
├── index.ts                 # 修改: 注册路由
├── db/
│   ├── index.ts             # SQLite 连接 + 初始化
│   └── schema.sql           # 建表语句
├── middleware/
│   └── auth.ts              # JWT 认证中间件
└── routes/
    ├── auth.ts              # 登录/登出/检查
    └── nodes.ts             # 文档 CRUD
```

---

### Task 1: SQLite 数据库层

**Files:**
- Create: `server/src/db/index.ts`
- Create: `server/src/db/schema.sql`

- [ ] **Step 1: 安装 better-sqlite3**

```bash
cd server
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

- [ ] **Step 2: 创建 server/src/db/schema.sql**

```sql
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  icon TEXT DEFAULT '📄',
  sort_order INTEGER DEFAULT 0,
  is_trash INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  parent_id TEXT,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS embeddings (
  node_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  embedding BLOB NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (node_id, chunk_index),
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_trash ON nodes(is_trash);
CREATE INDEX IF NOT EXISTS idx_comments_node ON comments(node_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_versions_node ON versions(node_id);
```

- [ ] **Step 3: 创建 server/src/db/index.ts**

```typescript
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const DB_PATH = path.resolve(DATA_DIR, 'wiki.db');
const DOCS_DIR = path.resolve(DATA_DIR, 'docs');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
  _db.exec(schema);

  return _db;
}

export function getDocsDir(): string {
  return DOCS_DIR;
}

export function readDocContent(nodeId: string): string {
  const filePath = path.resolve(DOCS_DIR, `${nodeId}.md`);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8');
}

export function writeDocContent(nodeId: string, content: string): void {
  if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(path.resolve(DOCS_DIR, `${nodeId}.md`), content, 'utf8');
}

export function deleteDocContent(nodeId: string): void {
  const filePath = path.resolve(DOCS_DIR, `${nodeId}.md`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}
```

- [ ] **Step 4: 提交**

```bash
cd ..
git add server/src/db/
git commit -m "feat(server): add SQLite database layer with schema and file helpers"
```

---

### Task 2: JWT 认证中间件

**Files:**
- Create: `server/src/middleware/auth.ts`

- [ ] **Step 1: 安装 JWT 依赖**

```bash
cd server
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

- [ ] **Step 2: 创建 server/src/middleware/auth.ts**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthRequest extends Request {
  userId?: string;
}

export function createToken(): string {
  const payload = { role: 'admin', iat: Math.floor(Date.now() / 1000) };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };
    if (decoded.role !== 'admin') {
      res.status(403).json({ error: '无权限' });
      return;
    }
    req.userId = 'admin';
    next();
  } catch {
    res.status(401).json({ error: '登录已过期' });
  }
}
```

- [ ] **Step 3: 提交**

```bash
cd ..
git add server/src/middleware/
git commit -m "feat(server): add JWT auth middleware"
```

---

### Task 3: 认证路由

**Files:**
- Create: `server/src/routes/auth.ts`

- [ ] **Step 1: 创建 server/src/routes/auth.ts**

```typescript
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
```

- [ ] **Step 2: 提交**

```bash
cd ..
git add server/src/routes/auth.ts
git commit -m "feat(server): add auth login/logout/check routes"
```

---

### Task 4: 文档 CRUD 路由

**Files:**
- Create: `server/src/routes/nodes.ts`

- [ ] **Step 1: 创建 server/src/routes/nodes.ts**

```typescript
import { Router, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb, readDocContent, writeDocContent, deleteDocContent } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// 获取所有节点（树结构元数据）
router.get('/', (_req: AuthRequest, res: Response) => {
  const db = getDb();
  const nodes = db.prepare(
    'SELECT id, parent_id, title, icon, sort_order, is_trash, created_at, updated_at FROM nodes ORDER BY sort_order ASC'
  ).all();
  res.json(nodes);
});

// 获取单个节点（含内容）
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

// 创建节点
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

// 更新节点元数据
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

// 更新文档内容
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

  // 保存版本快照
  const versionId = uuid();
  db.prepare(
    'INSERT INTO versions (id, node_id, content, created_at) VALUES (?, ?, ?, ?)'
  ).run(versionId, nodeId, content, now);

  db.prepare('UPDATE nodes SET updated_at = ? WHERE id = ?').run(now, nodeId);
  res.json({ success: true });
});

// 删除节点（及子节点）
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const nodeId = req.params.id;

  // 递归收集所有子节点
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

// 移入/移出回收站
router.put('/:id/trash', authMiddleware, (req: AuthRequest, res: Response) => {
  const db = getDb();
  const { isTrash } = req.body;
  db.prepare('UPDATE nodes SET is_trash = ?, updated_at = ? WHERE id = ?')
    .run(isTrash ? 1 : 0, Date.now(), req.params.id);
  res.json({ success: true });
});

// 移动节点
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

// 获取版本历史
router.get('/:id/versions', (req: AuthRequest, res: Response) => {
  const db = getDb();
  const versions = db.prepare(
    'SELECT id, node_id, created_at FROM versions WHERE node_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);
  res.json(versions);
});

// 获取版本内容
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

// 恢复版本
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

  // 保存为新版本
  const newId = uuid();
  db.prepare(
    'INSERT INTO versions (id, node_id, content, created_at) VALUES (?, ?, ?, ?)'
  ).run(newId, req.params.id, version.content, now);

  db.prepare('UPDATE nodes SET updated_at = ? WHERE id = ?').run(now, req.params.id);
  res.json({ success: true });
});

export default router;
```

- [ ] **Step 2: 提交**

```bash
cd ..
git add server/src/routes/nodes.ts
git commit -m "feat(server): add document CRUD routes with versions and trash"
```

---

### Task 5: 注册路由到 Express 主入口

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: 更新 server/src/index.ts**

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getDb } from './db';
import authRoutes from './routes/auth';
import nodeRoutes from './routes/nodes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// 初始化数据库
getDb();

app.use('/api/auth', authRoutes);
app.use('/api/nodes', nodeRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
```

- [ ] **Step 2: 验证完整流程**

```bash
cd server
npx tsx src/index.ts
```

测试:
```bash
# 健康检查
curl http://localhost:3001/api/health

# 获取空节点列表
curl http://localhost:3001/api/nodes

# 创建节点
curl -X POST http://localhost:3001/api/nodes -H "Content-Type: application/json" -d "{\"title\":\"测试文档\"}"

# 登录测试（错误密码）
curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"wrong\"}"
```

- [ ] **Step 3: 提交**

```bash
cd ..
git add server/src/index.ts
git commit -m "feat(server): wire up auth and node routes in express app"
```
