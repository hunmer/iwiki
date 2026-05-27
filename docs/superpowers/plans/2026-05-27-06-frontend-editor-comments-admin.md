# 06 - 前端：编辑器 + 评论 + 管理后台 + AI 面板

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Milkdown 编辑器（管理员编辑/游客只读）、游客评论系统、管理后台页面、AI 问答浮动面板。

**Architecture:** Milkdown 做编辑器，管理员模式下可编辑，游客只读渲染。评论嵌套展示。管理后台独立路由。AI 面板为浮动窗口。

**Tech Stack:** Milkdown, shadcn/ui, Zustand, SSE (AI chat)

**Depends on:** 05-frontend-shell, 03-backend-comments, 04-backend-ai-vector

---

## File Structure

```
client/src/
├── App.tsx                  # 修改: 添加 admin 路由
├── components/
│   ├── DocContent.tsx       # 修改: 替换为 Milkdown 编辑器
│   ├── MilkdownEditor.tsx   # 新增: Milkdown 编辑器封装
│   ├── CommentSection.tsx   # 新增: 评论区
│   └── AiChat.tsx           # 新增: AI 浮动问答面板
├── pages/
│   ├── WikiPage.tsx         # 修改: 集成评论区 + AI 面板
│   └── AdminPage.tsx        # 新增: 管理后台
```

---

### Task 1: Milkdown 编辑器

**Files:**
- Create: `client/src/components/MilkdownEditor.tsx`
- Modify: `client/src/components/DocContent.tsx`

- [ ] **Step 1: 安装 Milkdown**

```bash
cd client
npm install @milkdown/core @milkdown/react @milkdown/preset-commonmark @milkdown/preset-gfm @milkdown/theme-nord @milkdown/prose @milkdown/ctx
```

注意: Milkdown 包名和版本更新频繁，如果安装失败，用 `npm install @milkdown/kit @milkdown/react` 替代。

- [ ] **Step 2: 创建 client/src/components/MilkdownEditor.tsx**

```tsx
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { nord } from '@milkdown/theme-nord';
import { useEditor } from '@milkdown/react';
import '@milkdown/theme-nord/style.css';

interface Props {
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export default function MilkdownEditor({ value, readOnly, onChange }: Props) {
  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
      })
      .config(nord)
      .use(commonmark)
      .use(gfm)
      .create()
  );

  return (
    <div className={readOnly ? 'milkdown-read-only' : 'milkdown-editable'}>
      <div ref={get()} />
    </div>
  );
}
```

注意: Milkdown 的 API 取决于安装的版本。上面的代码是 v7 风格。如果用 `@milkdown/kit`，写法略有不同:

```tsx
import { useEditor } from '@milkdown/react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit';
import { nord } from '@milkdown/theme-nord';
import '@milkdown/theme-nord/style.css';

interface Props {
  value: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export default function MilkdownEditor({ value, readOnly }: Props) {
  const { get } = useEditor((root) =>
    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, value);
      })
      .use(nord)
      .create()
  );

  return (
    <div className={readOnly ? 'pointer-events-none' : ''}>
      <div ref={get()} />
    </div>
  );
}
```

实现时以实际安装的 Milkdown 版本 API 为准。

- [ ] **Step 3: 更新 DocContent.tsx，集成编辑器**

替换 `client/src/components/DocContent.tsx`:

```tsx
import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import MilkdownEditor from '@/components/MilkdownEditor';

export default function DocContent({ nodeId }: { nodeId: string | null }) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!nodeId) return;
    setLoading(true);
    api.getNode(nodeId).then(node => {
      setContent(node.content || '');
      setTitle(node.title);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [nodeId]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (!nodeId || !isAuthenticated) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.updateContent(nodeId, newContent);
    }, 2000);
  };

  if (!nodeId) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">选择一个文档开始阅读</div>;
  }

  if (loading) return <div className="flex-1 p-8">加载中...</div>;

  return (
    <div className="flex-1 overflow-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{title || '无标题'}</h1>
      <MilkdownEditor
        value={content}
        readOnly={!isAuthenticated}
        onChange={handleContentChange}
      />
    </div>
  );
}
```

- [ ] **Step 4: 提交**

```bash
cd ..
git add client/src/components/MilkdownEditor.tsx client/src/components/DocContent.tsx
git commit -m "feat(client): integrate Milkdown editor with admin edit mode"
```

---

### Task 2: 评论系统

**Files:**
- Create: `client/src/components/CommentSection.tsx`
- Modify: `client/src/pages/WikiPage.tsx`

- [ ] **Step 1: 创建 client/src/components/CommentSection.tsx**

```tsx
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Comment } from '@/types';

function CommentItem({ comment, onReply, onDelete }: {
  comment: Comment;
  onReply: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);

  return (
    <div className="py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium">{comment.nickname}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(comment.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
      <div className="flex gap-2 mt-1">
        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onReply(comment.id)}>
          回复
        </button>
        {isAuthenticated && (
          <button className="text-xs text-destructive hover:text-destructive/80" onClick={() => onDelete(comment.id)}>
            删除
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  nodeId: string;
}

export default function CommentSection({ nodeId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = async () => {
    try {
      const data = await api.getComments(nodeId);
      setComments(data);
    } catch {}
  };

  useEffect(() => {
    if (nodeId) loadComments();
  }, [nodeId]);

  const handleSubmit = async () => {
    if (!nickname.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await api.createComment(nodeId, {
        nickname: nickname.trim(),
        content: content.trim(),
        parentId: replyTo,
      });
      setContent('');
      setReplyTo(null);
      await loadComments();
    } catch {}
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await api.deleteComment(nodeId, id);
    await loadComments();
  };

  // 构建评论树
  const topLevel = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  return (
    <div className="border-t mt-8 pt-6">
      <h2 className="text-lg font-semibold mb-4">评论 ({comments.length})</h2>

      {/* 评论输入 */}
      <div className="space-y-2 mb-6">
        {replyTo && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>回复评论</span>
            <button className="text-destructive" onClick={() => setReplyTo(null)}>取消</button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-32"
          />
          <Textarea
            placeholder={replyTo ? '写下你的回复...' : '写下你的评论...'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1"
            rows={2}
          />
        </div>
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !nickname.trim() || !content.trim()}>
          {replyTo ? '回复' : '发表评论'}
        </Button>
      </div>

      {/* 评论列表 */}
      <div className="divide-y">
        {topLevel.map(comment => (
          <div key={comment.id}>
            <CommentItem comment={comment} onReply={setReplyTo} onDelete={handleDelete} />
            {getReplies(comment.id).map(reply => (
              <div key={reply.id} className="ml-8 border-l pl-4">
                <CommentItem comment={reply} onReply={setReplyTo} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">暂无评论</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 更新 WikiPage.tsx，集成评论区**

修改 `client/src/pages/WikiPage.tsx`，在 `DocContent` 下方添加评论:

```tsx
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import DocTree from '@/components/DocTree';
import DocContent from '@/components/DocContent';
import CommentSection from '@/components/CommentSection';
import AiChat from '@/components/AiChat';
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
      <div className="flex-1 overflow-auto">
        <DocContent nodeId={id || null} />
        {id && <CommentSection nodeId={id} />}
      </div>
      <AiChat />
    </Layout>
  );
}
```

- [ ] **Step 3: 提交**

```bash
cd ..
git add client/src/components/CommentSection.tsx client/src/pages/WikiPage.tsx
git commit -m "feat(client): add comment section with nested replies and admin moderation"
```

---

### Task 3: AI 问答浮动面板

**Files:**
- Create: `client/src/components/AiChat.tsx`

- [ ] **Step 1: 创建 client/src/components/AiChat.tsx**

```tsx
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || streaming) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    try {
      const res = await api.chatStream(userMsg.content, messages);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantContent += parsed.content;
                setMessages([...newMessages, { role: 'assistant', content: assistantContent }]);
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setMessages([...newMessages, { role: 'assistant', content: `错误: ${err.message}` }]);
    }
    setStreaming(false);
  };

  if (!open) {
    return (
      <button
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:bg-primary/90"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-background border rounded-lg shadow-xl flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <span className="font-medium text-sm">AI 助手</span>
        <button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center mt-8">问我任何关于文档的问题</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <div className={`inline-block max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t flex gap-2">
        <Input
          placeholder="输入问题..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={streaming}
        />
        <Button size="icon" onClick={handleSend} disabled={streaming || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
cd ..
git add client/src/components/AiChat.tsx
git commit -m "feat(client): add floating AI chat panel with SSE streaming"
```

---

### Task 4: 管理后台页面

**Files:**
- Create: `client/src/pages/AdminPage.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: 创建 client/src/pages/AdminPage.tsx**

```tsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Trash2, Database, MessageSquare } from 'lucide-react';
import type { Comment } from '@/types';

export default function AdminPage() {
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const [tab, setTab] = useState<'comments' | 'vector'>('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [vectorStats, setVectorStats] = useState<any>(null);
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    if (tab === 'comments') loadAllComments();
    if (tab === 'vector') loadVectorStats();
  }, [tab]);

  const loadAllComments = async () => {
    // 获取所有节点，然后获取所有评论
    const nodes = await api.getNodes();
    const allComments: Comment[] = [];
    for (const node of nodes) {
      try {
        const c = await api.getComments(node.id);
        allComments.push(...c);
      } catch {}
    }
    allComments.sort((a, b) => b.createdAt - a.createdAt);
    setComments(allComments);
  };

  const loadVectorStats = async () => {
    const stats = await api.getVectorStats();
    setVectorStats(stats);
  };

  const handleBuildIndex = async () => {
    setIndexing(true);
    try {
      const result = await api.buildIndex();
      setVectorStats(result);
    } catch {}
    setIndexing(false);
  };

  const handleDeleteComment = async (nodeId: string, commentId: string) => {
    await api.deleteComment(nodeId, commentId);
    await loadAllComments();
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-8">
          <h1 className="text-2xl font-bold mb-6">管理后台</h1>

          <div className="flex gap-2 mb-6">
            <Button variant={tab === 'comments' ? 'default' : 'outline'} onClick={() => setTab('comments')}>
              <MessageSquare className="h-4 w-4 mr-1" /> 评论管理
            </Button>
            <Button variant={tab === 'vector' ? 'default' : 'outline'} onClick={() => setTab('vector')}>
              <Database className="h-4 w-4 mr-1" /> 向量索引
            </Button>
          </div>

          {tab === 'comments' && (
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="border rounded-lg p-4 flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{c.nickname}</span>
                      <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm">{c.content}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteComment(c.nodeId, c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {comments.length === 0 && <p className="text-muted-foreground text-center py-8">暂无评论</p>}
            </div>
          )}

          {tab === 'vector' && vectorStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">文档数量</p>
                  <p className="text-2xl font-bold">{vectorStats.nodeCount || 0}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">已索引片段</p>
                  <p className="text-2xl font-bold">{vectorStats.indexedCount || 0}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">最后索引</p>
                  <p className="text-sm">{vectorStats.lastIndexedAt ? new Date(vectorStats.lastIndexedAt).toLocaleString() : '从未'}</p>
                </div>
              </div>
              <Button onClick={handleBuildIndex} disabled={indexing}>
                {indexing ? '索引中...' : '开始索引'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 2: 更新 client/src/App.tsx，添加 admin 路由**

```tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import WikiPage from '@/pages/WikiPage';
import LoginPage from '@/pages/LoginPage';
import AdminPage from '@/pages/AdminPage';
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
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/docs/:id" element={<WikiPage />} />
      <Route path="/" element={<Navigate to="/docs" replace />} />
      <Route path="/docs" element={<WikiPage />} />
    </Routes>
  );
}
```

- [ ] **Step 3: 提交**

```bash
cd ..
git add client/src/
git commit -m "feat(client): add admin panel with comment management and vector index controls"
```
