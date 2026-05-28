import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import { Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SearchDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; title: string }>>([]);
  const nodes = useWikiStore((s) => s.nodes);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const lower = query.toLowerCase();
    const titleMatches = nodes
      .filter(n => !n.isTrash && n.title.toLowerCase().includes(lower))
      .map(n => ({ id: n.id, title: n.title }));

    if (query.length >= 3) {
      api.vectorSearch(query, 5).then(vecResults => {
        const vecMatches = vecResults.map(r => ({ id: r.nodeId, title: r.title }));
        const existing = new Set(titleMatches.map(r => r.id));
        const merged = [...titleMatches, ...vecMatches.filter(r => !existing.has(r.id))];
        setResults(merged.slice(0, 10));
      }).catch(() => {
        setResults(titleMatches.slice(0, 10));
      });
    } else {
      setResults(titleMatches.slice(0, 10));
    }
  }, [query, nodes]);

  const navigate = useNavigate();

  const handleSelect = (id: string) => {
    onOpenChange(false);
    setQuery('');
    navigate(`/docs/${id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md p-0 bg-background border-charcoal shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
        <div className="p-4 border-b border-charcoal">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索文档..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-auto">
          {results.map((r, i) => (
            <button
              key={r.id}
              className="w-full text-left px-4 py-2.5 hover:bg-muted/50 text-sm text-foreground hover:text-primary transition-colors duration-150 border-b border-charcoal/50 last:border-0"
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => handleSelect(r.id)}
            >
              {r.title || '无标题'}
            </button>
          ))}
          {query && results.length === 0 && (
            <Empty title="未找到匹配文档" description="试试其他关键词" />
          )}
          {!query && (
            <Empty title="输入关键词搜索文档" description="支持标题搜索和语义搜索" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
