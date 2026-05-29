[Root Directory](../CLAUDE.md) > **server**

# Server Module - iWiki Backend API

## Module Responsibilities

The server module is the backend REST API for iWiki. It provides:
- Document tree CRUD with hierarchical node management (folders and docs)
- Markdown content storage on the filesystem (one `.md` file per document)
- Version history with restore capability
- JWT-based admin authentication with cookie sessions
- Threaded guest comments with soft-delete
- Tag aggregation, rename, and delete across all nodes
- File upload (images and videos) with MIME type validation
- AI semantic search via vector embeddings (LangChain + OpenAI)
- RAG-based AI chat with streaming responses (SSE)
- SQLite database with WAL mode for concurrent read access

## Entry and Startup

- **Entry file**: `src/index.ts` - Configures Express app with middleware (CORS, JSON parser, cookie parser), initializes database, registers route modules, starts HTTP server
- **Dev command**: `pnpm dev` (tsx watch on port 3001)
- **Build command**: `pnpm build` (tsc to `dist/`)
- **Start command**: `pnpm start` (node dist/index.js)

The server listens on `PORT` env var (default 3001). CORS is configured to allow the Vite dev server at `http://localhost:5173`.

## External Interfaces

### REST API Routes

All routes are prefixed with `/api` and mounted in `src/index.ts`:

| Route Module | Mount Path | File |
|-------------|-----------|------|
| auth | `/api/auth` | `src/routes/auth.ts` |
| nodes | `/api/nodes` | `src/routes/nodes.ts` |
| comments | `/api/nodes/:nodeId/comments` | `src/routes/comments.ts` |
| tags | `/api/tags` | `src/routes/tags.ts` |
| vector | `/api/vector` | `src/routes/vector.ts` |
| chat | `/api/chat` | `src/routes/chat.ts` |
| uploads | `/api/uploads` | `src/routes/uploads.ts` |

Static file serving: `/uploads` maps to `data/uploads/` directory.

### Authentication

- JWT-based auth using `jsonwebtoken` with 7-day expiry
- Tokens stored in HTTP-only cookies (`token`)
- `authMiddleware` validates JWT and checks `role === 'admin'`
- Write operations require auth; most read operations are public
- Guest comments are allowed without auth

## Key Dependencies and Configuration

### Dependencies (from package.json)
- `express` 5 - Web framework
- `better-sqlite3` - SQLite driver (native, synchronous)
- `@langchain/openai` - OpenAI chat models and embeddings
- `@langchain/core` + `@langchain/textsplitters` - LangChain core + text splitting
- `jsonwebtoken` - JWT signing/verification
- `cookie-parser` - Cookie parsing middleware
- `cors` - CORS middleware
- `multer` 2 - Multipart file upload handling
- `uuid` 14 - UUID generation
- `dotenv` - Environment variable loading

### Configuration
- `tsconfig.json` - TypeScript strict mode, ES2022 target, ESNext modules, bundler resolution
- `.env` - Environment variables (loaded from both `./.env` and `../.env`)
- `pnpm-workspace.yaml` - Configures build dependency handling for better-sqlite3

### Constants (`src/constants.ts`)
- `DATA_DIR` - Base data directory (default `./data`)
- `UPLOADS_DIR` - File upload directory (`data/uploads`)
- `DOCS_DIR` - Markdown content directory (`data/docs`)
- `DB_PATH` - SQLite database path (`data/wiki.db`)

## Data Models

### Database Schema (`src/db/schema.sql`)

- **nodes**: `id (PK), parent_id (FK), title, icon, type, tags (JSON), sort_order, is_trash, created_at, updated_at`
- **versions**: `id (PK), node_id (FK), content, created_at`
- **comments**: `id (PK), node_id (FK), parent_id (FK self), nickname, content, is_deleted, created_at`
- **sessions**: `id (PK), expires_at`
- **embeddings**: `node_id + chunk_index (PK), content, embedding (BLOB), updated_at`

### Filesystem Storage

- Document content: `data/docs/<node-id>.md`
- Uploaded files: `data/uploads/<uuid>.<ext>`
- Database: `data/wiki.db`

### Database Layer (`src/db/index.ts`)

- `getDb()` - Singleton database connection with WAL mode and foreign keys enabled
- `readDocContent(nodeId)` - Read `.md` file for a node
- `writeDocContent(nodeId, content)` - Write `.md` file for a node
- `deleteDocContent(nodeId)` - Delete `.md` file for a node
- `getDocsDir()` - Get the docs directory path

Schema migration is handled inline: `ALTER TABLE` attempts for `type` and `tags` columns are wrapped in try/catch to handle existing databases.

## AI/ML Services

### Vector Service (`src/services/vector.ts`)
- Uses `RecursiveCharacterTextSplitter` (chunk size 500, overlap 50, markdown-aware separators)
- Embeddings stored as Float32Array binary BLOBs in SQLite
- Cosine similarity computed in-memory for search
- `buildIndex()` - Rebuilds entire embedding index from all non-trashed documents
- `vectorSearch(query, topK)` - Returns top-K unique documents by relevance
- `getVectorStats()` - Returns index statistics

### LLM Service (`src/services/llm.ts`)
- `createChatModel()` - Creates a streaming ChatOpenAI instance (configurable model via `AI_CHAT_MODEL`)
- `createEmbeddings()` - Creates OpenAIEmbeddings instance (configurable via `AI_EMBEDDING_MODEL`)

### Chat Service (`src/services/chat.ts`)
- RAG pipeline: vector search -> context assembly -> streaming LLM response
- System prompt instructs the model to be an iWiki knowledge base assistant
- Uses async generator for streaming output

### Upload Service (`src/routes/uploads.ts`)
- Multer disk storage with UUID filenames
- MIME type validation against allowed image/video types
- Cross-validation of MIME type vs file extension
- 50MB max file size
- Returns relative URL path for stored file

## Middleware

### Auth Middleware (`src/middleware/auth.ts`)
- `createToken()` - Signs JWT with admin role, 7-day expiry
- `authMiddleware()` - Extracts token from cookies, verifies JWT, checks admin role
- `AuthRequest` interface extends Express Request with optional `userId`

## Testing and Quality

- **No test framework or test files configured** - This is a gap
- **TypeScript strict mode** enabled
- Manual database migration with safe `ALTER TABLE` attempts

## Frequently Asked Questions (FAQ)

**Q: Why is document content stored as files instead of in the database?**
A: Markdown content can be large and benefits from direct filesystem access. Metadata (tree structure, tags) is in SQLite for fast queries.

**Q: How does the vector search work without a vector database?**
A: Embeddings are stored as binary BLOBs in SQLite. Cosine similarity is computed in-memory across all embeddings. This is suitable for small-to-medium document collections but would need a proper vector DB for large scale.

**Q: Why are there two `dotenv.config()` calls?**
A: The server loads `.env` from both the server directory and the project root to support different deployment configurations.

**Q: How does version history work?**
A: Each content save creates a new version record. The `versions` table stores the full Markdown content at that point in time. Restore rewrites the `.md` file and creates a new version entry.

## Related File List

```
server/
  package.json
  tsconfig.json
  pnpm-workspace.yaml
  src/
    index.ts
    constants.ts
    db/
      index.ts
      schema.sql
    middleware/
      auth.ts
    routes/
      auth.ts
      nodes.ts
      comments.ts
      tags.ts
      vector.ts
      chat.ts
      uploads.ts
    services/
      vector.ts
      chat.ts
      llm.ts
```

## Change Log (Changelog)

| Date | Change |
|------|--------|
| 2026-05-29 | Initial CLAUDE.md created by init-architect agent |
