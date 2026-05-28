import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import Editor from '@/components/Editor';
import { FileText, Edit2, Check, X } from 'lucide-react';

interface DocContentProps {
  nodeId: string | null;
  onEditingChange?: (isEditing: boolean) => void;
}

export default function DocContent({ nodeId, onEditingChange }: DocContentProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!nodeId) return;
    setLoading(true);
    api.getNode(nodeId).then(node => {
      setContent(node.content || '');
      setTitle(node.title);
      setTempTitle(node.title);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [nodeId]);

  useEffect(() => {
    if (onEditingChange) {
      onEditingChange(editingTitle);
    }
  }, [editingTitle, onEditingChange]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (!nodeId || !isAuthenticated) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.updateContent(nodeId, newContent);
    }, 2000);
  };

  const handleStartEditTitle = () => {
    setTempTitle(title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleCancelEditTitle = () => {
    setTempTitle(title);
    setEditingTitle(false);
  };

  const handleSaveTitle = async () => {
    if (!nodeId || !isAuthenticated) return;
    try {
      await api.updateTitle(nodeId, tempTitle);
      setTitle(tempTitle);
      setEditingTitle(false);
    } catch (error) {
      console.error('保存标题失败:', error);
      setTempTitle(title);
      setEditingTitle(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      handleCancelEditTitle();
    }
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
    <div className="flex-1 overflow-auto p-8 animate-fade-in">
      <div className="flex items-start justify-between mb-6 gap-4">
        {editingTitle ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              ref={titleInputRef}
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              className="flex-1 text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-foreground tracking-tight bg-transparent border-b-2 border-primary outline-none px-1"
              placeholder="输入标题..."
            />
            <button
              onClick={handleSaveTitle}
              className="p-1.5 rounded hover:bg-muted transition-colors text-green-600"
              title="保存"
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              onClick={handleCancelEditTitle}
              className="p-1.5 rounded hover:bg-muted transition-colors text-red-600"
              title="取消"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <h1 className="text-[clamp(1.5rem,3vw,2.25rem)] font-bold text-foreground tracking-tight">
              {title || '无标题'}
            </h1>
            {isAuthenticated && (
              <button
                onClick={handleStartEditTitle}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="编辑标题"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
      <Editor
        key={nodeId}
        value={content}
        readOnly={!isAuthenticated}
        onChange={handleContentChange}
      />
    </div>
  );
}
