export interface DocNode {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  type: 'folder' | 'doc';
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
