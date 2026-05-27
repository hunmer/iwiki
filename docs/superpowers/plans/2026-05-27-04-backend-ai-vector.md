# 04 - 后端：AI 问答 & 向量检索

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现向量索引、语义搜索和 RAG AI 问答。管理员可触发索引构建，用户可通过语义搜索查文档、通过 AI 对话获取基于文档的回答。

**Architecture:** LangChain.js 负责 embedding 和 chat，sqlite-vec 存向量，RecursiveCharacterTextSplitter 分段。AI 问答用 SSE 流式返回。

**Tech Stack:** LangChain.js, @langchain/openai, sqlite-vec, better-sqlite3

**Depends on:** 02-backend-core

---

## File Structure

```
server/src/
├── index.ts                 # 修改: 注册路由
├── services/
│   ├── llm.ts               # LLM 和 Embedding 实例
│   ├── vector.ts             # 向量索引 + 搜索
│   └── chat.ts               # RAG 问答
└── routes/
    ├── vector.ts             # 向量管理路由
    └── chat.ts               # AI 问答路由
```

---

### Task 1: 安装 AI 相关依赖

- [ ] **Step 1: 安装 LangChain 和 sqlite-vec**

```bash
cd server
npm install @langchain/core @langchain/openai @langchain/textsplitters sqlite-vec
```

注意: sqlite-vec 可能需要原生编译。如果安装失败，改用内存向量计算（余弦相似度），见 Task 2 备选方案。

---

### Task 2: LLM 服务层

**Files:**
- Create: `server/src/services/llm.ts`

- [ ] **Step 1: 创建 server/src/services/llm.ts**

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';

export function createChatModel() {
  return new ChatOpenAI({
    modelName: process.env.AI_CHAT_MODEL || 'gpt-4o',
    temperature: 0.7,
    streaming: true,
    configuration: {
      baseURL: process.env.AI_API_BASE,
      apiKey: process.env.AI_API_KEY,
    },
  });
}

export function createEmbeddings() {
  return new OpenAIEmbeddings({
    model: process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small',
    configuration: {
      baseURL: process.env.AI_API_BASE,
      apiKey: process.env.AI_API_KEY,
    },
  });
}
```

- [ ] **Step 2: 提交**

```bash
cd ..
git add server/src/services/llm.ts
git commit -m "feat(server): add LLM and embeddings service layer"
```

---

### Task 3: 向量索引与搜索服务

**Files:**
- Create: `server/src/services/vector.ts`

- [ ] **Step 1: 创建 server/src/services/vector.ts**

```typescript
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createEmbeddings } from './llm';
import { getDb, readDocContent } from '../db';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
  separators: ['\n## ', '\n### ', '\n\n', '\n', ' '],
});

export async function buildIndex(): Promise<{ indexedCount: number; nodeCount: number }> {
  const db = getDb();
  const embeddings = createEmbeddings();

  // 获取所有非回收站节点
  const nodes = db.prepare(
    'SELECT id, title FROM nodes WHERE is_trash = 0'
  ).all() as any[];

  let indexedCount = 0;

  // 清空旧索引
  db.prepare('DELETE FROM embeddings').run();

  for (const node of nodes) {
    const content = readDocContent(node.id);
    if (!content.trim()) continue;

    const fullText = `# ${node.title}\n\n${content}`;
    const docs = await splitter.splitText(fullText);

    if (docs.length === 0) continue;

    // 批量 embedding
    const vectors = await embeddings.embedDocuments(docs);

    const insert = db.prepare(
      'INSERT INTO embeddings (node_id, chunk_index, content, embedding, updated_at) VALUES (?, ?, ?, ?, ?)'
    );

    const now = Date.now();
    for (let i = 0; i < docs.length; i++) {
      // 将 float32 数组转为 Buffer 存储
      const buffer = Buffer.from(new Float32Array(vectors[i]).buffer);
      insert.run(node.id, i, docs[i], buffer, now);
    }

    indexedCount += docs.length;
  }

  return { indexedCount, nodeCount: nodes.length };
}

export function getVectorStats(): { indexedCount: number; nodeCount: number; lastIndexedAt: number | null } {
  const db = getDb();
  const stats = db.prepare(
    'SELECT COUNT(DISTINCT node_id) as nodeCount, COUNT(*) as indexedCount, MAX(updated_at) as lastIndexedAt FROM embeddings'
  ).get() as any;
  return stats;
}

export async function vectorSearch(query: string, topK: number = 5): Promise<Array<{
  nodeId: string; title: string; score: number; content: string;
}>> {
  const db = getDb();
  const embeddings = createEmbeddings();

  const queryVector = await embeddings.embedQuery(query);
  const queryBuffer = Buffer.from(new Float32Array(queryVector).buffer);

  // 手动计算余弦相似度（sqlite-vec 兼容方案）
  const allEmbeddings = db.prepare(
    `SELECT e.node_id, e.chunk_index, e.content, e.embedding,
            n.title
     FROM embeddings e
     JOIN nodes n ON n.id = e.node_id
     WHERE n.is_trash = 0`
  ).all() as any[];

  const results = allEmbeddings.map(row => {
    const vecBuffer = row.embedding as Buffer;
    const vec = new Float32Array(vecBuffer.buffer, vecBuffer.byteOffset, vecBuffer.byteLength / 4);
    const qVec = new Float32Array(queryVector);

    // 余弦相似度
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vec.length; i++) {
      dot += vec[i] * qVec[i];
      normA += vec[i] * vec[i];
      normB += qVec[i] * qVec[i];
    }
    const score = normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));

    return {
      nodeId: row.node_id,
      title: row.title,
      score,
      content: row.content,
    };
  });

  results.sort((a, b) => b.score - a.score);

  // 按 nodeId 去重，保留最高分
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.nodeId)) return false;
    seen.add(r.nodeId);
    return true;
  }).slice(0, topK);
}
```

- [ ] **Step 2: 提交**

```bash
cd ..
git add server/src/services/vector.ts
git commit -m "feat(server): add vector indexing and semantic search service"
```

---

### Task 4: RAG 问答服务

**Files:**
- Create: `server/src/services/chat.ts`

- [ ] **Step 1: 创建 server/src/services/chat.ts**

```typescript
import { createChatModel } from './llm';
import { vectorSearch } from './vector';

const SYSTEM_PROMPT = `你是 iWiki 知识库的 AI 助手。根据以下检索到的文档内容回答用户的问题。
如果文档内容不足以回答问题，请如实说明。
回答时引用来源文档的标题。`;

export async function* streamChat(
  message: string,
  history: Array<{ role: string; content: string }> = []
) {
  const results = await vectorSearch(message, 5);

  const contextText = results.length > 0
    ? results.map((r, i) => `[${i + 1}] ${r.title}:\n${r.content}`).join('\n\n---\n\n')
    : '没有找到相关文档。';

  const chatModel = createChatModel();

  const messages = [
    { role: 'system' as const, content: `${SYSTEM_PROMPT}\n\n参考文档:\n${contextText}` },
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user' as const, content: message },
  ];

  const stream = await chatModel.stream(messages);

  for await (const chunk of stream) {
    if (chunk.content) {
      yield chunk.content as string;
    }
  }
}
```

- [ ] **Step 2: 提交**

```bash
cd ..
git add server/src/services/chat.ts
git commit -m "feat(server): add RAG chat service with streaming"
```

---

### Task 5: 向量和 AI 路由

**Files:**
- Create: `server/src/routes/vector.ts`
- Create: `server/src/routes/chat.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: 创建 server/src/routes/vector.ts**

```typescript
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getVectorStats, buildIndex, vectorSearch } from '../services/vector';

const router = Router();

router.get('/stats', (_req: AuthRequest, res: Response) => {
  res.json(getVectorStats());
});

router.post('/index', authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await buildIndex();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/search', async (req: AuthRequest, res: Response) => {
  const { query, topK = 5 } = req.body;
  if (!query) {
    res.status(400).json({ error: '查询内容不能为空' });
    return;
  }
  try {
    const results = await vectorSearch(query, topK);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

- [ ] **Step 2: 创建 server/src/routes/chat.ts**

```typescript
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
```

- [ ] **Step 3: 在 server/src/index.ts 注册路由**

在现有路由注册后添加:

```typescript
import vectorRoutes from './routes/vector';
import chatRoutes from './routes/chat';

app.use('/api/vector', vectorRoutes);
app.use('/api/chat', chatRoutes);
```

- [ ] **Step 4: 验证向量功能**

```bash
cd server
npx tsx src/index.ts
```

测试（需要有效的 AI API key）:
```bash
# 查看索引统计
curl http://localhost:3001/api/vector/stats

# 触发索引（需管理员 cookie）
# 先登录获取 cookie，再:
curl -X POST http://localhost:3001/api/vector/index -b cookie.txt

# 语义搜索
curl -X POST http://localhost:3001/api/vector/search -H "Content-Type: application/json" -d "{\"query\":\"测试\",\"topK\":3}"
```

- [ ] **Step 5: 提交**

```bash
cd ..
git add server/src/
git commit -m "feat(server): add vector search and AI chat routes with SSE streaming"
```
