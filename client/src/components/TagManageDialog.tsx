import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import { Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TagManageDialog({ open, onOpenChange }: Props) {
  const [tags, setTags] = useState<Array<{ name: string; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const loadNodes = useWikiStore((s) => s.loadNodes);

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.getTags()
        .then((data) => setTags(data))
        .catch(() => toast.error('加载标签失败'))
        .finally(() => setLoading(false));
    } else {
      setRenamingTag(null);
      setRenameValue('');
      setDeleting(null);
    }
  }, [open]);

  const refreshTags = async () => {
    const data = await api.getTags();
    setTags(data);
    await loadNodes();
  };

  const handleRename = async (oldName: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === oldName) {
      setRenamingTag(null);
      return;
    }
    try {
      await api.renameTag(oldName, trimmed);
      toast.success(`标签 "${oldName}" 已重命名为 "${trimmed}"`);
      setRenamingTag(null);
      await refreshTags();
    } catch (e: any) {
      toast.error(e.message || '重命名失败');
    }
  };

  const handleDelete = async (name: string) => {
    try {
      setDeleting(name);
      await api.deleteTag(name);
      toast.success(`标签 "${name}" 已删除`);
      setDeleting(null);
      await refreshTags();
    } catch (e: any) {
      toast.error(e.message || '删除失败');
      setDeleting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>标签管理</DialogTitle>
          <DialogDescription>重命名或删除文档标签</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载中...
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              暂无标签
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {tags.map((tag) => (
                <div key={tag.name} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50">
                  {renamingTag === tag.name ? (
                    <>
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(tag.name);
                          if (e.key === 'Escape') setRenamingTag(null);
                        }}
                        className="h-7 text-sm flex-1"
                        autoFocus
                      />
                      <Button variant="ghost" size="icon-sm" onClick={() => handleRename(tag.name)}>
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setRenamingTag(null)}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {tag.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {tag.count} 篇文档
                      </span>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => {
                          setRenamingTag(tag.name);
                          setRenameValue(tag.name);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        disabled={deleting === tag.name}
                        onClick={() => handleDelete(tag.name)}
                      >
                        {deleting === tag.name ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
