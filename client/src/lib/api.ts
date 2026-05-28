import type { DocNode, Comment, VectorSearchResult } from '@/types';

const BASE = '/api';

/** 将 snake_case 的 API 响应转换为 camelCase 的 DocNode */
function toDocNode(raw: any): DocNode {
  return {
    id: raw.id,
    parentId: raw.parent_id ?? raw.parentId ?? null,
    title: raw.title,
    icon: raw.icon,
    sortOrder: raw.sort_order ?? raw.sortOrder ?? 0,
    isTrash: raw.is_trash ?? raw.isTrash ?? 0,
    createdAt: raw.created_at ?? raw.createdAt ?? 0,
    updatedAt: raw.updated_at ?? raw.updatedAt ?? 0,
    content: raw.content,
  };
}

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
  getNodes: async () => (await request<any[]>('/nodes')).map(toDocNode),
  getNode: async (id: string) => toDocNode(await request<any>(`/nodes/${id}`)) as DocNode & { content: string },
  createNode: async (data: { title: string; parentId?: string | null; icon?: string }) =>
    toDocNode(await request<any>('/nodes', { method: 'POST', body: JSON.stringify(data) })),
  updateNode: (id: string, data: Partial<Pick<DocNode, 'title' | 'icon' | 'sortOrder' | 'parentId'>>) =>
    request<{ success: boolean }>(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateTitle: (id: string, title: string) =>
    request<{ success: boolean }>(`/nodes/${id}`, { method: 'PUT', body: JSON.stringify({ title }) }),
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
    request<Comment>(`/nodes/${nodeId}/comments`, {
      method: 'POST', body: JSON.stringify(data),
    }),
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
