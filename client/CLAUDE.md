[Root Directory](../CLAUDE.md) > **client**

# Client Module - iWiki Frontend

## Module Responsibilities

The client module is the frontend single-page application for iWiki. It provides:
- A tree-based document navigator with drag-and-drop reordering
- A WYSIWYG Markdown editor (Milkdown Crepe) with image/video upload support
- AI-powered semantic search across documents
- An AI chat assistant (floating widget)
- A threaded comment system for documents
- Tag management with rename/delete capabilities
- Admin panel for comment moderation and vector index management
- Dark/light theme support

## Entry and Startup

- **Entry file**: `src/main.tsx` - Mounts the React app with BrowserRouter, ThemeProvider (dark default), and code inspector
- **App routing**: `src/App.tsx` - Defines routes:
  - `/login` - Login page
  - `/admin` - Admin panel (auth required)
  - `/docs/:id` - Document view/edit
  - `/docs` - Document list
  - `/` - Redirects to `/docs`

- **Dev command**: `pnpm dev` (Vite dev server on port 5173)
- **Build command**: `pnpm build` (tsc + vite build)
- **Lint command**: `pnpm lint`

## External Interfaces

The client communicates with the backend exclusively through the API layer defined in `src/lib/api.ts`. All requests use `fetch` with credentials (cookies). Key API interactions:

- **Node CRUD**: Create, read, update, delete, trash, move, reorder document nodes
- **Content**: Read/write Markdown content per document
- **Versions**: List, get, and restore document versions
- **Comments**: CRUD for threaded comments (guest-accessible creation)
- **Tags**: List, rename, delete tags
- **Vector search**: Semantic search via `/api/vector/search`
- **AI chat**: Streaming chat via SSE on `/api/chat`
- **Uploads**: Multipart file upload to `/api/uploads`
- **Auth**: Login/logout with JWT cookies

The Vite dev server proxies `/api` and `/uploads` to `http://localhost:3001`.

## Key Dependencies and Configuration

### Dependencies (from package.json)
- `react` 19, `react-dom` 19, `react-router-dom` 7
- `zustand` 5 - State management
- `@milkdown/crepe` 7 - WYSIWYG Markdown editor
- `he-tree-react` - Drag-and-drop tree component
- `radix-ui` + `class-variance-authority` + `clsx` + `tailwind-merge` - UI primitives
- `next-themes` - Theme switching
- `cmdk` - Command palette (used in search)
- `lucide-react` - Icons
- `sonner` - Toast notifications
- `tailwindcss` 4 + `@tailwindcss/vite` + `@tailwindcss/typography`

### Configuration Files
- `vite.config.ts` - Vite config with React, Tailwind, path alias (`@/` -> `src/`), proxy to backend
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` - TypeScript config (strict mode)
- `eslint.config.js` - ESLint with typescript-eslint, react-hooks, react-refresh
- `components.json` - shadcn/ui config (radix-nova style, TSX, Tailwind CSS variables)
- `DESIGN.md` - Design system reference (dark theme, cyan accent, JetBrains Mono)

## Data Models

Defined in `src/types/index.ts`:

- **DocNode**: `id, parentId, title, icon, type ('folder'|'doc'), tags[], sortOrder, isTrash, createdAt, updatedAt, content?`
- **Comment**: `id, nodeId, parentId, nickname, content, createdAt`
- **VectorSearchResult**: `nodeId, title, score, content`

### State Management (Zustand)

`src/stores/wiki.ts` manages:
- `nodes: DocNode[]` - All document nodes
- `activeId: string | null` - Currently selected document
- `isAuthenticated: boolean` - Auth state
- `sidebarCollapsed: boolean` - Sidebar toggle
- Actions: `loadNodes, setActiveId, checkAuth, toggleSidebar, createNode, createNodeWithContent, deleteNode, trashNode, renameNode, updateNode, moveNode, batchReorderNodes`

## Component Architecture

### Pages (`src/pages/`)
- `WikiPage.tsx` - Main document view with sidebar, content editor, comments, and AI chat
- `LoginPage.tsx` - Admin login form
- `AdminPage.tsx` - Admin panel (comment moderation + vector index management)

### Core Components (`src/components/`)
- `Layout.tsx` - App shell with header (logo, theme toggle, search, tags, auth buttons)
- `DocTree.tsx` - Document tree with drag-and-drop (he-tree-react), rename, create folder/doc, import MD
- `DocContent.tsx` - Document view/edit wrapper with title editing, emoji icon picker, tags, auto-save
- `Editor.tsx` - Milkdown Crepe editor with image/video upload integration
- `AiChat.tsx` - Floating AI chat widget with streaming responses
- `SearchDialog.tsx` - Search dialog combining title search + semantic vector search
- `CommentSection.tsx` - Threaded comment system with nested replies
- `EmojiPicker.tsx` - Emoji icon selector for document icons
- `TagManageDialog.tsx` - Tag management dialog (rename/delete)
- `tag-input.tsx` - Tag input component with autocomplete
- `slash-menu.ts` - Slash menu configuration for the editor
- `pill.tsx` - Pill/chip component

### UI Primitives (`src/components/ui/`)
shadcn/ui generated components: `badge, button, command, dialog, dropdown-menu, empty, input, output, popover, scroll-area, separator, sheet, sonner, tabs, textarea`

### Utility (`src/lib/`)
- `api.ts` - Complete API client with snake_case to camelCase transforms
- `utils.ts` - `cn()` utility (clsx + tailwind-merge)

## Testing and Quality

- **Linter**: ESLint with typescript-eslint, react-hooks, react-refresh plugins
- **No test framework configured** - This is a gap
- **TypeScript strict mode** enabled

## Frequently Asked Questions (FAQ)

**Q: How does the editor handle document switching?**
A: The Editor component uses React's `key` prop (set to `nodeId` in DocContent) to fully remount when switching documents.

**Q: How is content auto-saved?**
A: DocContent uses a 2-second debounce timer (`saveTimerRef`) to call `api.updateContent()` after edits.

**Q: How do image/video uploads work?**
A: The Editor component defines `uploadFile()` which POSTs a multipart form to `/api/uploads` and returns the URL. Milkdown's image block config uses this callback. Video uploads use a custom slash menu command.

## Related File List

```
client/
  package.json
  vite.config.ts
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  eslint.config.js
  components.json
  DESIGN.md
  src/
    main.tsx
    App.tsx
    index.css
    types/index.ts
    stores/wiki.ts
    lib/api.ts
    lib/utils.ts
    components/Layout.tsx
    components/DocTree.tsx
    components/DocContent.tsx
    components/Editor.tsx
    components/AiChat.tsx
    components/SearchDialog.tsx
    components/CommentSection.tsx
    components/EmojiPicker.tsx
    components/TagManageDialog.tsx
    components/tag-input.tsx
    components/slash-menu.ts
    components/pill.tsx
    components/ui/*.tsx
    pages/WikiPage.tsx
    pages/LoginPage.tsx
    pages/AdminPage.tsx
    assets/vite.svg
    assets/react.svg
```

## Change Log (Changelog)

| Date | Change |
|------|--------|
| 2026-05-29 | Initial CLAUDE.md created by init-architect agent |
