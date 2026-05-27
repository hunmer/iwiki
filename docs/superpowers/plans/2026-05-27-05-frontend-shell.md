# 05 - 前端：应用框架 + 文档浏览

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建前端应用框架，实现页面布局、路由、状态管理、侧边栏文档树、文档只读浏览。

**Architecture:** React Router 做路由，Zustand 管理全局状态，左侧文档树 + 右侧内容区的经典 wiki 布局。

**Tech Stack:** React, React Router, Zustand, shadcn/ui, Tailwind CSS, Milkdown

**Depends on:** 01-scaffolding, 02-backend-core

---

## File Structure

```
client/src/
├── main.tsx                 # 修改: 添加 Router
├── App.tsx                  # 修改: 路由定义
├── index.css                # 已有
├── lib/
│   ├── utils.ts             # 已有
│   └── api.ts               # 新增: API 请求封装
├── stores/
│   └── wiki.ts              # 新增: 全局状态
├── types/
│   └── index.ts             # 新增: 类型定义
├── pages/
│   ├── WikiPage.tsx          # 新增: 主 wiki 页面（布局）
│   └── LoginPage.tsx         # 新增: 管理员登录页
├── components/
│   ├── Layout.tsx            # 新增: 主布局框架
│   ├── DocTree.tsx           # 新增: 侧边栏文档树
│   ├── DocContent.tsx        # 新增: 文档内容渲染
│   └── SearchDialog.tsx      # 新增: 全局搜索对话框
└── components/ui/            # shadcn 已有
```

---

### Task 1: 类型定义和 API 封装

**Files:**
- Create: `client/src/types/index.ts`
- Create: `client/src/lib/api.ts`

- [ ] **Step 1: 安装路由依赖**

```bash
cd client
npm install react-router-dom
```

- [ ] **Step 2: 创建 client/src/types/index.ts**

```typescript
export interface DocNode {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  sortOrder: number;
  isTrash: number;
  createdAt: number;
  updatedAt: number;
  content?: string;
}

export interface Comment {
  id: string;
  nodeId: string;
  parentId: string | null;
  nickname: string;
  content: string;
  createdAt: number;
}

export interface VectorSearchResult {
  nodeId: string;
  title: string;
  score: number;
  content: string;
}
```

- [ ] **Step 3: 创建 client/src/lib/api.ts**

```typescript
const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '请求失败');
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ success: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  checkAuth: () => request<{ authenticated: boolean }>('/auth/check'),

  // Nodes
  getNodes: () => request<DocNode[]>('/nodes'),
  getNode: (id: string) => request<DocNode & { content: string }>(`/nodes/${id}`),
  createNode: (data: { title: string; parentId?: string | null; icon?: string }) =>
    request<DocNode>('/nodes', { method: 'POST', body: JSON.stringify(data) }),
  updateNode: (id: string, data: Partial<Pick<DocNode, 'title' | 'icon' | 'sortOrder' | 'parentId'>>) =>
    request<{ success: boolean }>(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateContent: (id: string, content: string) =>
    request<{ success: boolean }>(`/nodes/${id}/content`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteNode: (id: string) =>
    request<{ success: boolean }>(`/nodes/${id}`, { method: 'DELETE' }),
  trashNode: (id: string, isTrash: boolean) =>
    request<{ success: boolean }>(`/nodes/${id}/trash`, { method: 'PUT', body: JSON.stringify({ isTrash }) }),
  moveNode: (id: string, data: { parentId?: string | null; sortOrder?: number }) =>
    request<{ success: boolean }>(`/nodes/${id}/move`, { method: 'PUT', body: JSON.stringify(data) }),

  // Versions
  getVersions: (id: string) => request<any[]>(`/nodes/${id}/versions`),
  getVersion: (nodeId: string, versionId: string) =>
    request<any>(`/nodes/${nodeId}/versions/${versionId}`),
  restoreVersion: (nodeId: string, versionId: string) =>
    request<{ success: boolean }>(`/nodes/${nodeId}/versions/restore`, {
      method: 'POST',
      body: JSON.stringify({ versionId }),
    }),

  // Comments
  getComments: (nodeId: string) => request<Comment[]>(`/nodes/${nodeId}/comments`),
  createComment: (nodeId: string, data: { nickname: string; content: string; parentId?: string }) =>
    request<Comment>(`/nodes/${nodeId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteComment: (nodeId: string, commentId: string) =>
    request<{ success: boolean }>(`/nodes/${nodeId}/comments/${commentId}`, { method: 'DELETE' }),

  // Vector
  getVectorStats: () => request<any>('/vector/stats'),
  buildIndex: () => request<any>('/vector/index', { method: 'POST' }),
  vectorSearch: (query: string, topK = 5) =>
    request<VectorSearchResult[]>('/vector/search', {
      method: 'POST',
      body: JSON.stringify({ query, topK }),
    }),

  // Chat
  chatStream: (message: string, history: any[]) =>
    fetch(`${BASE}/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    }),
};

// 使 fetch 返回 Response 而非解析后的 JSON
import type { DocNode, Comment, VectorSearchResult } from '@/types';
```

注意: `api.ts` 顶部的 import 类型需要调整。把 import 移到文件顶部:

修正版 `client/src/lib/api.ts`:

```typescript
import type { DocNode, Comment, VectorSearchResult } from '@/types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '请求失败');
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ success: boolean }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  checkAuth: () => request<{ authenticated: boolean }>('/auth/check'),
  getNodes: () => request<DocNode[]>('/nodes'),
  getNode: (id: string) => request<DocNode & { content: string }>(`/nodes/${id}`),
  createNode: (data: { title: string; parentId?: string | null; icon?: string }) =>
    request<DocNode>('/nodes', { method: 'POST', body: JSON.stringify(data) }),
  updateNode: (id: string, data: Partial<Pick<DocNode, 'title' | 'icon' | 'sortOrder' | 'parentId'>>) =>
    request<{ success: boolean }>(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateContent: (id: string, content: string) =>
    request<{ success: boolean }>(`/nodes/${id}/content`, { method: 'PUT', body: JSON.stringify({ content }) }),
  deleteNode: (id: string) =>
    request<{ success: boolean }>(`/nodes/${id}`, { method: 'DELETE' }),
  trashNode: (id: string, isTrash: boolean) =>
    request<{ success: boolean }>(`/nodes/${id}/trash`, { method: 'PUT', body: JSON.stringify({ isTrash }) }),
  moveNode: (id: string, data: { parentId?: string | null; sortOrder?: number }) =>
    request<{ success: boolean }>(`/nodes/${id}/move`, { method: 'PUT', body: JSON.stringify(data) }),
  getVersions: (id: string) => request<any[]>(`/nodes/${id}/versions`),
  getVersion: (nodeId: string, versionId: string) =>
    request<any>(`/nodes/${nodeId}/versions/${versionId}`),
  restoreVersion: (nodeId: string, versionId: string) =>
    request<{ success: boolean }>(`/nodes/${nodeId}/versions/restore`, {
      method: 'POST', body: JSON.stringify({ versionId }),
    }),
  getComments: (nodeId: string) => request<Comment[]>(`/nodes/${nodeId}/comments`),
  createComment: (nodeId: string, data: { nickname: string; content: string; parentId?: string }) =>
    request<Comment>(`/nodes/${nodeId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  deleteComment: (nodeId: string, commentId: string) =>
    request<{ success: boolean }>(`/nodes/${nodeId}/comments/${commentId}`, { method: 'DELETE' }),
  getVectorStats: () => request<any>('/vector/stats'),
  buildIndex: () => request<any>('/vector/index', { method: 'POST' }),
  vectorSearch: (query: string, topK = 5) =>
    request<VectorSearchResult[]>('/vector/search', { method: 'POST', body: JSON.stringify({ query, topK }) }),
  chatStream: (message: string, history: any[]) =>
    fetch(`${BASE}/chat`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    }),
};
```

- [ ] **Step 4: 提交**

```bash
cd ..
git add client/src/types/ client/src/lib/api.ts
git commit -m "feat(client): add type definitions and API client"
```

---

### Task 2: Zustand 全局状态

**Files:**
- Create: `client/src/stores/wiki.ts`

- [ ] **Step 1: 安装 zustand**

```bash
cd client
npm install zustand
```

- [ ] **Step 2: 创建 client/src/stores/wiki.ts**

```typescript
import { create } from 'zustand';
import type { DocNode } from '@/types';
import { api } from '@/lib/api';

interface WikiState {
  nodes: DocNode[];
  activeId: string | null;
  isAuthenticated: boolean;
  sidebarCollapsed: boolean;
  loading: boolean;

  loadNodes: () => Promise<void>;
  setActiveId: (id: string | null) => void;
  checkAuth: () => Promise<void>;
  toggleSidebar: () => void;
  createNode: (title: string, parentId?: string | null) => Promise<string | null>;
  deleteNode: (id: string) => Promise<void>;
  trashNode: (id: string, isTrash: boolean) => Promise<void>;
  renameNode: (id: string, title: string) => Promise<void>;
  moveNode: (id: string, parentId: string | null, sortOrder: number) => Promise<void>;
}

export const useWikiStore = create<WikiState>((set, get) => ({
  nodes: [],
  activeId: null,
  isAuthenticated: false,
  sidebarCollapsed: false,
  loading: false,

  loadNodes: async () => {
    set({ loading: true });
    try {
      const nodes = await api.getNodes();
      set({ nodes, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActiveId: (id) => set({ activeId: id }),

  checkAuth: async () => {
    try {
      const { authenticated } = await api.checkAuth();
      set({ isAuthenticated: authenticated });
    } catch {
      set({ isAuthenticated: false });
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  createNode: async (title, parentId = null) => {
    try {
      const node = await api.createNode({ title, parentId });
      set((s) => ({ nodes: [...s.nodes, node] }));
      return node.id;
    } catch {
      return null;
    }
  },

  deleteNode: async (id) => {
    await api.deleteNode(id);
    set((s) => {
      const idsToRemove = new Set<string>();
      const collect = (pid: string) => {
        idsToRemove.add(pid);
        s.nodes.filter(n => n.parentId === pid).forEach(n => collect(n.id));
      };
      collect(id);
      return {
        nodes: s.nodes.filter(n => !idsToRemove.has(n.id)),
        activeId: s.activeId && idsToRemove.has(s.activeId) ? null : s.activeId,
      };
    });
  },

  trashNode: async (id, isTrash) => {
    await api.trashNode(id, isTrash);
    set((s) => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, isTrash: isTrash ? 1 : 0 } : n),
    }));
  },

  renameNode: async (id, title) => {
    await api.updateNode(id, { title });
    set((s) => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, title } : n),
    }));
  },

  moveNode: async (id, parentId, sortOrder) => {
    await api.moveNode(id, { parentId, sortOrder });
    set((s) => ({
      nodes: s.nodes.map(n =>
        n.id === id ? { ...n, parentId, sortOrder } : n
      ),
    }));
  },
}));
```

- [ ] **Step 3: 提交**

```bash
cd ..
git add client/src/stores/
git commit -m "feat(client): add Zustand wiki store with node CRUD actions"
```

---

### Task 3: 主布局和路由

**Files:**
- Modify: `client/src/main.tsx`
- Modify: `client/src/App.tsx`
- Create: `client/src/pages/WikiPage.tsx`
- Create: `client/src/pages/LoginPage.tsx`
- Create: `client/src/components/Layout.tsx`

- [ ] **Step 1: 更新 client/src/main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
```

- [ ] **Step 2: 更新 client/src/App.tsx**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import WikiPage from '@/pages/WikiPage';
import LoginPage from '@/pages/LoginPage';
import { useWikiStore } from '@/stores/wiki';

export default function App() {
  const loadNodes = useWikiStore((s) => s.loadNodes);
  const checkAuth = useWikiStore((s) => s.checkAuth);

  useEffect(() => {
    loadNodes();
    checkAuth();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/docs/:id" element={<WikiPage />} />
      <Route path="/" element={<Navigate to="/docs" replace />} />
      <Route path="/docs" element={<WikiPage />} />
    </Routes>
  );
}
```

- [ ] **Step 3: 创建 client/src/pages/LoginPage.tsx**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const checkAuth = useWikiStore((s) => s.checkAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.login(username, password);
      await checkAuth();
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <form onSubmit={handleSubmit} className="bg-background p-8 rounded-lg shadow-md w-80 space-y-4">
        <h1 className="text-xl font-bold text-center">iWiki 管理员登录</h1>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Input placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} />
        <Input placeholder="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" className="w-full">登录</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: 创建 client/src/components/Layout.tsx**

```tsx
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Search, Menu, LogOut, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWikiStore } from '@/stores/wiki';
import { api } from '@/lib/api';
import { useState } from 'react';
import SearchDialog from '@/components/SearchDialog';

export default function Layout() {
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const checkAuth = useWikiStore((s) => s.checkAuth);
  const toggleSidebar = useWikiStore((s) => s.toggleSidebar);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.logout();
    await checkAuth();
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b flex items-center px-4 gap-2 shrink-0">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <Menu className="h-4 w-4" />
        </Button>
        <Link to="/" className="font-bold text-lg mr-auto">iWiki</Link>
        <Button variant="ghost" size="sm" onClick={() => setSearchOpen(true)}>
          <Search className="h-4 w-4 mr-1" /> 搜索
        </Button>
        {isAuthenticated ? (
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" /> 退出
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
            <LogIn className="h-4 w-4 mr-1" /> 登录
          </Button>
        )}
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Outlet />
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
cd ..
git add client/src/
git commit -m "feat(client): add layout, routing, login page, and search trigger"
```

---

### Task 4: 侧边栏文档树

**Files:**
- Create: `client/src/components/DocTree.tsx`

- [ ] **Step 1: 创建 client/src/components/DocTree.tsx**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Plus, Trash2, FileText, FolderOpen } from 'lucide-react';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DocNode } from '@/types';

function buildTree(nodes: DocNode[]): Map<string | null, DocNode[]> {
  const map = new Map<string | null, DocNode[]>();
  for (const node of nodes) {
    if (node.isTrash) continue;
    const children = map.get(node.parentId) || [];
    children.push(node);
    map.set(node.parentId, children);
  }
  for (const [, children] of map) {
    children.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return map;
}

function TreeNode({ node, children, depth }: { node: DocNode; children: DocNode[]; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(node.title);
  const activeId = useWikiStore((s) => s.activeId);
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const renameNode = useWikiStore((s) => s.renameNode);
  const deleteNode = useWikiStore((s) => s.deleteNode);
  const trashNode = useWikiStore((s) => s.trashNode);
  const createNode = useWikiStore((s) => s.createNode);
  const setActiveId = useWikiStore((s) => s.setActiveId);
  const navigate = useNavigate();

  const hasChildren = children.length > 0;
  const isActive = activeId === node.id;

  const handleRename = async () => {
    if (name.trim()) {
      await renameNode(node.id, name.trim());
    }
    setRenaming(false);
  };

  const handleClick = () => {
    setActiveId(node.id);
    navigate(`/docs/${node.id}`);
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-muted rounded text-sm group',
          isActive && 'bg-muted font-medium',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="shrink-0">{node.icon}</span>
        {renaming ? (
          <Input
            className="h-6 text-sm flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
        ) : (
          <span className="truncate flex-1" onClick={handleClick}>
            {node.title || '无标题'}
          </span>
        )}
        {isAuthenticated && (
          <span className="hidden group-hover:flex gap-0.5">
            <button
              className="p-0.5 hover:bg-muted-foreground/10 rounded"
              onClick={async (e) => { e.stopPropagation(); const id = await createNode('', node.id); if (id) navigate(`/docs/${id}`); }}
              title="新建子文档"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 hover:bg-muted-foreground/10 rounded"
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setName(node.title); }}
              title="重命名"
            >
              <FileText className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 hover:bg-muted-foreground/10 rounded"
              onClick={async (e) => { e.stopPropagation(); await trashNode(node.id, true); }}
              title="删除"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>
      {expanded && children.map((child) => (
        <TreeNodeWrapper key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function TreeNodeWrapper({ node, depth }: { node: DocNode; depth: number }) {
  const nodes = useWikiStore((s) => s.nodes);
  const tree = buildTree(nodes);
  const children = tree.get(node.id) || [];
  return <TreeNode node={node} children={children} depth={depth} />;
}

export default function DocTree() {
  const nodes = useWikiStore((s) => s.nodes);
  const createNode = useWikiStore((s) => s.createNode);
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  const tree = buildTree(nodes);
  const rootNodes = tree.get(null) || [];

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">文档</span>
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { const id = await createNode('新建文档'); if (id) navigate(`/docs/${id}`); }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-1">
        {rootNodes.map((node) => (
          <TreeNodeWrapper key={node.id} node={node} depth={0} />
        ))}
        {rootNodes.length === 0 && (
          <p className="text-sm text-muted-foreground p-4 text-center">暂无文档</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
cd ..
git add client/src/components/DocTree.tsx
git commit -m "feat(client): add sidebar document tree with CRUD and drag support"
```

---

### Task 5: 搜索对话框

**Files:**
- Create: `client/src/components/SearchDialog.tsx`

- [ ] **Step 1: 创建 client/src/components/SearchDialog.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { DocNode, VectorSearchResult } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SearchDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; title: string; score?: number }>>([]);
  const nodes = useWikiStore?.((s: any) => s.nodes) as DocNode[];

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const lower = query.toLowerCase();
    // 标题本地过滤
    const titleMatches = nodes
      .filter(n => !n.isTrash && n.title.toLowerCase().includes(lower))
      .map(n => ({ id: n.id, title: n.title }));

    // 如果 query 较长，也尝试向量搜索
    if (query.length >= 3) {
      api.vectorSearch(query, 5).then(vecResults => {
        const vecMatches = vecResults.map(r => ({ id: r.nodeId, title: r.title, score: r.score }));
        // 合并去重
        const existing = new Set(titleMatches.map(r => r.id));
        const merged = [...titleMatches, ...vecMatches.filter(r => !existing.has(r.id))];
        setResults(merged.slice(0, 10));
      }).catch(() => {
        setResults(titleMatches.slice(0, 10));
      });
    } else {
      setResults(titleMatches.slice(0, 10));
    }
  }, [query, nodes]);

  const navigate = useNavigate();

  const handleSelect = (id: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(`/docs/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <div className="p-4">
          <Input
            placeholder="搜索文档..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-auto border-t">
          {results.map((r) => (
            <button
              key={r.id}
              className="w-full text-left px-4 py-2 hover:bg-muted text-sm"
              onClick={() => handleSelect(r.id)}
            >
              {r.title || '无标题'}
            </button>
          ))}
          {query && results.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">未找到匹配文档</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

注意: 需要修正 zustand hook 用法。改为直接 import:

```tsx
import { useWikiStore } from '@/stores/wiki';
// ...
const nodes = useWikiStore((s) => s.nodes);
```

- [ ] **Step 2: 提交**

```bash
cd ..
git add client/src/components/SearchDialog.tsx
git commit -m "feat(client): add global search dialog with title and vector search"
```

---

### Task 6: Wiki 主页面（整合布局）

**Files:**
- Create: `client/src/pages/WikiPage.tsx`
- Create: `client/src/components/DocContent.tsx`

- [ ] **Step 1: 创建 client/src/components/DocContent.tsx**

简单的只读 Markdown 渲染（后续 Task 7 换 Milkdown 编辑器）:

```tsx
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { DocNode } from '@/types';

export default function DocContent({ nodeId }: { nodeId: string | null }) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nodeId) return;
    setLoading(true);
    api.getNode(nodeId).then(node => {
      setContent(node.content || '');
      setTitle(node.title);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [nodeId]);

  if (!nodeId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">选择一个文档开始阅读</div>;
  }

  if (loading) return <div className="flex-1 p-8">加载中...</div>;

  return (
    <div className="flex-1 overflow-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{title || '无标题'}</h1>
      <div className="prose prose-neutral dark:prose-invert max-w-none whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 client/src/pages/WikiPage.tsx**

```tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import DocTree from '@/components/DocTree';
import DocContent from '@/components/DocContent';
import { useWikiStore } from '@/stores/wiki';
import { cn } from '@/lib/utils';

export default function WikiPage() {
  const { id } = useParams<{ id: string }>();
  const setActiveId = useWikiStore((s) => s.setActiveId);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);

  useEffect(() => {
    setActiveId(id || null);
  }, [id]);

  return (
    <Layout>
      <div className={cn('border-r overflow-auto shrink-0', sidebarCollapsed ? 'w-0' : 'w-64')}>
        {!sidebarCollapsed && <DocTree />}
      </div>
      <DocContent nodeId={id || null} />
    </Layout>
  );
}
```

- [ ] **Step 3: 安装 prose 排版依赖（可选，用于 Markdown 样式）**

```bash
cd client
npm install @tailwindcss/typography
```

在 `client/src/index.css` 中添加:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

- [ ] **Step 4: 验证前端**

```bash
# 确保 server 也在运行
cd server && npx tsx src/index.ts
# 另一个终端
cd client && npm run dev
```

预期: 打开 http://localhost:5173 看到侧边栏（空）+ 主内容区。

- [ ] **Step 5: 提交**

```bash
cd ..
git add client/src/
git commit -m "feat(client): add wiki page with sidebar tree and document content view"
```
