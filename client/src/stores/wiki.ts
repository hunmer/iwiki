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
  createNode: (title: string, parentId?: string | null, type?: 'folder' | 'doc') => Promise<string | null>;
  deleteNode: (id: string) => Promise<void>;
  trashNode: (id: string, isTrash: boolean) => Promise<void>;
  renameNode: (id: string, title: string) => Promise<void>;
  updateNode: (id: string, data: Partial<Pick<DocNode, 'title' | 'icon' | 'sortOrder' | 'parentId' | 'type'>>) => Promise<void>;
  moveNode: (id: string, parentId: string | null, sortOrder: number) => Promise<void>;
  batchReorderNodes: (moves: Array<{ id: string; parentId: string | null; sortOrder: number }>) => Promise<void>;
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

  createNode: async (title, parentId = null, type = 'doc') => {
    try {
      const node = await api.createNode({ title, parentId, type });
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

  updateNode: async (id, data) => {
    await api.updateNode(id, data);
    set((s) => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, ...data } : n),
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

  batchReorderNodes: async (moves) => {
    await api.batchReorder(moves);
    set((s) => ({
      nodes: s.nodes.map((n) => {
        const move = moves.find((m) => m.id === n.id);
        return move ? { ...n, parentId: move.parentId, sortOrder: move.sortOrder } : n;
      }),
    }));
  },
}));
