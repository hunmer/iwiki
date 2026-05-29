import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import Editor from '@/components/Editor';
import EmojiPicker from '@/components/EmojiPicker';
import { TagInput, type Tag } from '@/components/tag-input';
import { Badge } from '@/components/ui/badge';
import { FileText, Edit2, Check, X } from 'lucide-react';

interface DocContentProps {
  nodeId: string | null;
  onEditingChange?: (isEditing: boolean) => void;
}

export default function DocContent({ nodeId, onEditingChange }: DocContentProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<string | undefined>();
  const [editingTitle, setEditingTitle] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const renameNode = useWikiStore((s) => s.renameNode);
  const updateNode = useWikiStore((s) => s.updateNode);
  const nodes = useWikiStore((s) => s.nodes);
  const setDirty = useWikiStore((s) => s.setDirty);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const iconSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const lastSavedContentRef = useRef<string>('');

  useEffect(() => {
    if (!nodeId) return;
    setLoading(true);
    api.getNode(nodeId).then(node => {
      setContent(node.content || '');
      setTitle(node.title);
      setIcon(node.icon);
      setTempTitle(node.title);
      setTags((node.tags ?? []).map(t => ({ label: t, value: t })));
      lastSavedContentRef.current = node.content || '';
      setDirty(false);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [nodeId, setDirty]);

  // 当nodes发生变化时，检查当前文档的标题是否被更新
  useEffect(() => {
    if (!nodeId) return;
    const currentNode = nodes.find(n => n.id === nodeId);
    if (currentNode && currentNode.title !== title) {
      setTitle(currentNode.title);
      setTempTitle(currentNode.title);
    }
    if (currentNode && currentNode.icon !== icon) {
      setIcon(currentNode.icon);
    }
    if (currentNode) {
      const currentTags = (currentNode.tags ?? []).map(t => ({ label: t, value: t }));
      if (JSON.stringify(currentTags) !== JSON.stringify(tags)) {
        setTags(currentTags);
      }
    }
  }, [nodes, nodeId]);

  useEffect(() => {
    if (onEditingChange) {
      onEditingChange(editingTitle || editMode);
    }
  }, [editingTitle, editMode, onEditingChange]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    const dirty = newContent !== lastSavedContentRef.current;
    setDirty(dirty);
    if (!nodeId || !isAuthenticated || !editMode) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await api.updateContent(nodeId, newContent);
      lastSavedContentRef.current = newContent;
      setDirty(false);
    }, 2000);
  };

  const handleStartEditTitle = () => {
    setTempTitle(title);
    setEditingTitle(true);
    setEditMode(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleCancelEditTitle = () => {
    setTempTitle(title);
    setEditingTitle(false);
    setEditMode(false);
  };

  const handleSaveTitle = async () => {
    if (!nodeId || !isAuthenticated) return;
    try {
      await renameNode(nodeId, tempTitle);
      setTitle(tempTitle);
      setEditingTitle(false);
      setEditMode(false);
    } catch (error) {
      console.error('保存标题失败:', error);
      setTempTitle(title);
      setEditingTitle(false);
      setEditMode(false);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      handleCancelEditTitle();
    }
  };

  const handleIconChange = (newIcon: string) => {
    if (!nodeId || !isAuthenticated) return;
    setIcon(newIcon);
    clearTimeout(iconSaveTimerRef.current);
    iconSaveTimerRef.current = setTimeout(() => {
      updateNode(nodeId, { icon: newIcon });
    }, 500);
  };

  const allTags = useMemo(() => {
    const tagSet = new Map<string, Tag>();
    for (const node of nodes) {
      for (const t of node.tags ?? []) {
        if (!tagSet.has(t)) tagSet.set(t, { label: t, value: t });
      }
    }
    return Array.from(tagSet.values());
  }, [nodes]);

  const handleTagsChange = useCallback((nextTags: Tag[]) => {
    if (!nodeId || !isAuthenticated) return;
    setTags(nextTags);
    updateNode(nodeId, { tags: nextTags.map(t => t.label) });
  }, [nodeId, isAuthenticated, updateNode]);

  // Cleanup: clear debounce timer and reset dirty state on unmount
  useEffect(() => {
    return () => {
      clearTimeout(saveTimerRef.current);
      setDirty(false);
    };
  }, [setDirty]);

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
    <div className="flex-1 flex flex-col min-h-0 p-8 animate-fade-in">
      <div className="flex items-start justify-between mb-6 gap-4">
        {editingTitle ? (
          <div className="flex items-center gap-2 flex-1">
            {icon && <span className="text-2xl">{icon}</span>}
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
            {isAuthenticated && (
              <EmojiPicker
                value={icon}
                onChange={handleIconChange}
              />
            )}
            {icon && !isAuthenticated && (
              <span className="text-2xl mr-2">{icon}</span>
            )}
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
      {isAuthenticated && editMode ? (
        <TagInput
          tags={tags}
          setTags={handleTagsChange}
          allTags={allTags}
          placeholder="添加标签..."
          className="mb-4"
        />
      ) : (
        tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {tags.map(tag => (
              <Badge key={tag.label} variant="secondary" className="text-xs">
                {tag.label}
              </Badge>
            ))}
          </div>
        )
      )}
      <Editor
        key={nodeId}
        value={content}
        readOnly={!isAuthenticated || !editMode}
        onChange={handleContentChange}
      />
    </div>
  );
}
