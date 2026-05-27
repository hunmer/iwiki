# iWiki - 团队协作 Wiki 设计文档

## 概述

从 agent_spaces 项目迁移数据库/文档功能，构建独立的团队协作 Wiki 系统。前端 React + shadcn/ui + Tailwind + Milkdown 编辑器，后端 Express + LangChain.js，存储 SQLite + 文件系统。

## 项目定位

团队协作 Wiki，固定管理员账号（.env 配置），游客可浏览文档和评论。

## 架构

```
┌─────────────────────────────────────────┐
│           Frontend (React SPA)           │
│  shadcn/ui + Tailwind + Milkdown编辑器   │
│  端口: 5173 (dev)                        │
└──────────────┬──────────────────────────┘
               │ HTTP API
┌──────────────▼──────────────────────────┐
│         Backend (Express)                │
│  LangChain.js + sqlite-vec              │
│  端口: 3001                              │
├──────────────────────────────────────────┤
│  ┌─────────┐  ┌──────────┐  ┌────────┐ │
│  │ SQLite  │  │ 文件系统  │  │ AI API │ │
│  │wiki.db  │  │ /docs/   │  │(远程)   │ │
│  └─────────┘  └──────────┘  └────────┘ │
└──────────────────────────────────────────┘
```

前后端分离部署，各自独立 package.json。

## 项目结构

```
iwiki/
├── client/                 # React 前端
│   ├── src/
│   │   ├── components/     # shadcn 组件
│   │   ├── pages/          # 页面路由
│   │   ├── stores/         # Zustand 状态管理
│   │   ├── lib/            # 工具函数
│   │   └── App.tsx
│   └── package.json
├── server/                 # Express 后端
│   ├── src/
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── db/             # SQLite schema + queries
│   │   ├── middleware/     # 认证中间件
│   │   └── index.ts
│   └── package.json
├── data/                   # 运行时数据（gitignore）
│   ├── wiki.db             # SQLite 数据库
│   └── docs/               # Markdown 文档文件
└── .env                    # 配置
```

## 数据模型

### SQLite 表结构（wiki.db）

```sql
-- 文档树节点
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  title TEXT NOT NULL,
  icon TEXT DEFAULT '📄',
  sort_order INTEGER DEFAULT 0,
  is_trash INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (parent_id) REFERENCES nodes(id)
);

-- 文档版本历史
CREATE TABLE versions (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

-- 向量索引
CREATE TABLE embeddings (
  node_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,
  updated_at INTEGER,
  PRIMARY KEY (node_id, chunk_index),
  FOREIGN KEY (node_id) REFERENCES nodes(id)
);

-- 评论
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL,
  parent_id TEXT,
  nickname TEXT NOT NULL,
  content TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  created_at INTEGER,
  FOREIGN KEY (node_id) REFERENCES nodes(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

-- 管理员会话
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  expires_at INTEGER
);
```

### 文件系统

```
data/docs/
└── {node-id}.md    # 每个节点一个 Markdown 文件
```

文档内容直接读写 .md 文件，SQLite 只存元数据。

## API 设计

### 认证

```
POST /api/auth/login     { username, password }  → { token }
POST /api/auth/logout    Cookie: token            → 200
GET  /api/auth/check     Cookie: token            → { authenticated: boolean }
```

管理员账号密码从 .env 读取，JWT 存 HttpOnly cookie。

### 文档 CRUD

```
GET    /api/nodes                → 树结构（所有节点元数据）
POST   /api/nodes                { title, parentId, icon }
GET    /api/nodes/:id            → { ...meta, content }
PUT    /api/nodes/:id            { title?, icon?, sortOrder?, parentId? }
PUT    /api/nodes/:id/content    { content }
DELETE /api/nodes/:id
PUT    /api/nodes/:id/trash      { isTrash }
PUT    /api/nodes/:id/move       { parentId, sortOrder }
```

### 版本历史

```
GET    /api/nodes/:id/versions          → 版本列表
POST   /api/nodes/:id/versions/restore  { versionId }
```

### 向量 & AI

```
GET    /api/vector/stats               → { indexedCount, nodeCount, lastIndexedAt }
POST   /api/vector/index               → 触发全量索引
POST   /api/vector/search              { query, topK } → [ { nodeId, title, score, content } ]
POST   /api/chat                       { message, history } → SSE stream
```

### 评论

```
GET    /api/nodes/:id/comments         → 评论树
POST   /api/nodes/:id/comments         { nickname, content, parentId? }
DELETE /api/comments/:id               (管理员软删除)
```

### 权限模型

- 公开接口（无需认证）：GET /api/nodes, GET /api/nodes/:id, 评论读取、评论创建
- 管理员接口（需认证）：所有写操作、删除评论、触发索引、版本管理

## 前端结构

### 路由

```
/                       → 重定向到文档
/docs/:id               → 文档阅读/编辑（主页面）
/admin/login            → 管理员登录
/admin                  → 管理后台
```

### 页面布局

```
┌──────────────────────────────────────────────────┐
│  顶部导航栏: Logo | 搜索 | 管理入口               │
├──────────┬───────────────────────────────────────┤
│  侧边栏   │  主内容区                              │
│  文档树    │  Milkdown 编辑器                      │
│          │  (管理员: 可编辑 / 游客: 只读)           │
│          │                                        │
│          │  评论区                                 │
├──────────┴───────────────────────────────────────┤
```

### 核心组件

| 组件 | 职责 |
|------|------|
| DocTree | 侧边栏文档树，拖拽排序，右键菜单 |
| DocEditor | Milkdown 编辑器，管理员可编辑，游客只读 |
| CommentSection | 评论区，嵌套回复，游客填昵称 |
| SearchDialog | Ctrl+K 全局搜索（标题 + 语义搜索） |
| AdminPanel | 评论管理、索引状态、版本历史 |
| AiChat | 浮动 AI 问答面板 |
| VectorPanel | 向量索引管理 |

### 状态管理

单个 Zustand store `useWikiStore`：

```typescript
{
  nodes: DocNode[]
  activeId: string | null
  openTabs: string[]
  isAuthenticated: boolean
  sidebarCollapsed: boolean
  aiChatOpen: boolean
}
```

## AI & 向量集成

### .env 配置

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password
AI_API_BASE=https://api.openai.com/v1
AI_API_KEY=sk-xxx
AI_CHAT_MODEL=gpt-4o
AI_EMBEDDING_MODEL=text-embedding-3-small
PORT=3001
JWT_SECRET=your_jwt_secret
DATA_DIR=./data
```

### 向量索引流程

1. 读取所有文档内容
2. RecursiveCharacterTextSplitter (chunk_size=500, overlap=50)
3. 批量调用 embedding API
4. 写入 sqlite-vec embeddings 表

### RAG 问答流程

1. embedding(message)
2. sqlite-vec 余弦相似度检索 top 5 片段
3. 组装 prompt: system + context(检索片段) + history + question
4. LLM 流式返回 (SSE)

直接操作 sqlite-vec，不依赖 LangChain 向量存储抽象。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 18 + Vite |
| UI 组件 | shadcn/ui |
| 样式 | Tailwind CSS |
| 编辑器 | Milkdown |
| 状态管理 | Zustand |
| 路由 | React Router |
| 后端框架 | Express |
| AI | LangChain.js |
| 向量存储 | sqlite-vec |
| 数据库 | better-sqlite3 |
| 认证 | JWT (HttpOnly cookie) |
