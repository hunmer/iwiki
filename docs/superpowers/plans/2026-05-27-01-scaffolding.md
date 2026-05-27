# 01 - 项目脚手架

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 初始化 monorepo 结构，前后端各自可启动空壳。

**Architecture:** 根目录包含 client/ 和 server/ 两个独立项目，各自有 package.json 和 TypeScript 配置。开发时并行启动。

**Tech Stack:** Node.js, TypeScript, Vite (client), tsx (server)

---

## File Structure

```
iwiki/
├── .gitignore
├── .env
├── .env.example
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       └── index.css
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
└── data/
    └── .gitkeep
```

---

### Task 1: 初始化 git 和根目录配置

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.env`

- [ ] **Step 1: 初始化 git 仓库**

```bash
cd g:\programming\nodejs\iwiki
git init
```

- [ ] **Step 2: 创建 .gitignore**

```gitignore
node_modules/
dist/
data/*.db
data/docs/
.env
*.log
.code-review-graph/
```

- [ ] **Step 3: 创建 .env.example**

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
AI_API_BASE=https://api.openai.com/v1
AI_API_KEY=sk-xxx
AI_CHAT_MODEL=gpt-4o
AI_EMBEDDING_MODEL=text-embedding-3-small
PORT=3001
JWT_SECRET=changeme
DATA_DIR=./data
```

- [ ] **Step 4: 复制为 .env**

```bash
copy .env.example .env
```

- [ ] **Step 5: 创建 data 目录占位**

```bash
mkdir data
type nul > data\.gitkeep
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "chore: init repo with env config and gitignore"
```

---

### Task 2: 初始化 server 项目

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`

- [ ] **Step 1: 创建 server 目录并初始化**

```bash
mkdir server\src
cd server
npm init -y
```

- [ ] **Step 2: 安装依赖**

```bash
cd server
npm install express cors dotenv uuid cookie-parser
npm install -D typescript @types/express @types/cors @types/cookie-parser @types/node tsx @types/uuid
```

- [ ] **Step 3: 写入 server/package.json scripts**

修改 `server/package.json` 的 scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

- [ ] **Step 4: 创建 server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: 创建 server/src/index.ts**

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
```

- [ ] **Step 6: 验证 server 启动**

```bash
cd server
npx tsx src/index.ts
```

预期: 控制台输出 `Server running on http://localhost:3001`，`curl http://localhost:3001/api/health` 返回 `{"status":"ok"}`

- [ ] **Step 7: 提交**

```bash
cd ..
git add server/
git commit -m "chore: init express server with tsx dev setup"
```

---

### Task 3: 初始化 client 项目

**Files:**
- Create: `client/` 整个 Vite + React + TypeScript 项目
- Create: `client/src/App.tsx`
- Create: `client/src/index.css`

- [ ] **Step 1: 用 Vite 创建 React + TypeScript 项目**

```bash
npm create vite@latest client -- --template react-ts
cd client
npm install
```

- [ ] **Step 2: 安装 Tailwind CSS v4**

```bash
cd client
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: 配置 Vite 使用 Tailwind**

替换 `client/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 4: 替换 client/src/index.css**

```css
@import "tailwindcss";
```

- [ ] **Step 5: 替换 client/src/App.tsx**

```tsx
function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1 className="text-2xl font-bold p-8">iWiki</h1>
    </div>
  );
}

export default App;
```

- [ ] **Step 6: 安装 shadcn/ui 前置依赖**

```bash
cd client
npm install class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 7: 创建 client/src/lib/utils.ts**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: 创建 client/components.json**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib"
  }
}
```

- [ ] **Step 9: 初始化 shadcn 并添加基础组件**

```bash
cd client
npx shadcn@latest init
npx shadcn@latest add button input dialog dropdown-menu popover scroll-area separator sheet tabs textarea toast
```

- [ ] **Step 10: 验证 client 启动**

```bash
cd client
npm run dev
```

预期: 浏览器打开 http://localhost:5173 显示 "iWiki" 标题，Tailwind 样式生效。

- [ ] **Step 11: 提交**

```bash
cd ..
git add client/
git commit -m "chore: init react client with vite, tailwind, shadcn/ui"
```
