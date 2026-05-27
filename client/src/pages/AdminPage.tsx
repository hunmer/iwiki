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
  const [vectorStats, setVectorStats] = useState<Record<string, unknown> | null>(null);
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    if (tab === 'comments') loadAllComments();
    if (tab === 'vector') loadVectorStats();
  }, [tab]);

  const loadAllComments = async () => {
    try {
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
    } catch {}
  };

  const loadVectorStats = async () => {
    try {
      const stats = await api.getVectorStats();
      setVectorStats(stats);
    } catch {}
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
                  <p className="text-2xl font-bold">{String(vectorStats.nodeCount || 0)}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">已索引片段</p>
                  <p className="text-2xl font-bold">{String(vectorStats.indexedCount || 0)}</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">最后索引</p>
                  <p className="text-sm">{vectorStats.lastIndexedAt ? new Date(vectorStats.lastIndexedAt as number).toLocaleString() : '从未'}</p>
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
