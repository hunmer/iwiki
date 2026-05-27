import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import Editor from '@/components/Editor';
import { FileText } from 'lucide-react';

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
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 animate-fade-in">
        <FileText className="h-12 w-12 text-charcoal" />
        <p className="text-sm">选择一个文档开始阅读</p>
      </div>
    );
  }

  if (loading) return <div className="flex-1 p-8 text-muted-foreground animate-fade-in">加载中...</div>;

  return (
    <div className="flex-1 overflow-auto p-8 max-w-4xl animate-fade-in">
      <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold mb-6 text-foreground tracking-tight">
        {title || '无标题'}
      </h1>
      <Editor
        key={nodeId}
        value={content}
        readOnly={!isAuthenticated}
        onChange={handleContentChange}
      />
    </div>
  );
}
