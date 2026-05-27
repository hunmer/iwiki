import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';

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
      <DialogContent className="sm:max-w-md p-0">
        <div className="p-4">
          <Input
            placeholder="搜索文档..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-auto border-t">
          {results.map((r) => (
            <button
              key={r.id}
              className="w-full text-left px-4 py-2 hover:bg-muted text-sm"
              onClick={() => handleSelect(r.id)}
            >
              {r.title || '无标题'}
            </button>
          ))}
          {query && results.length === 0 && (
            <p className="text-sm text-muted-foreground p-4 text-center">未找到匹配文档</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
