import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import Editor from '@/components/Editor';

export default function DocContent({ nodeId }: { nodeId: string | null }) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
      <Editor
        value={content}
        readOnly={!isAuthenticated}
        onChange={handleContentChange}
      />
    </div>
  );
}
