import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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
