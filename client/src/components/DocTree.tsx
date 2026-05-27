import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Plus, Trash2, FileText } from 'lucide-react';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DocNode } from '@/types';

function buildTree(nodes: DocNode[]): Map<string | null, DocNode[]> {
  const map = new Map<string | null, DocNode[]>();
  for (const node of nodes) {
    if (node.isTrash) continue;
    const children = map.get(node.parentId) || [];
    children.push(node);
    map.set(node.parentId, children);
  }
  for (const [, children] of map) {
    children.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return map;
}

function TreeNode({ node, children, depth }: { node: DocNode; children: DocNode[]; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(node.title);
  const activeId = useWikiStore((s) => s.activeId);
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const renameNode = useWikiStore((s) => s.renameNode);
  const trashNode = useWikiStore((s) => s.trashNode);
  const createNode = useWikiStore((s) => s.createNode);
  const setActiveId = useWikiStore((s) => s.setActiveId);
  const navigate = useNavigate();

  const hasChildren = children.length > 0;
  const isActive = activeId === node.id;

  const handleRename = async () => {
    if (name.trim()) {
      await renameNode(node.id, name.trim());
    }
    setRenaming(false);
  };

  const handleClick = () => {
    setActiveId(node.id);
    navigate(`/docs/${node.id}`);
  };

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 cursor-pointer hover:bg-muted rounded text-sm group',
          isActive && 'bg-muted font-medium',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="shrink-0">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <span className="shrink-0">{node.icon}</span>
        {renaming ? (
          <Input
            className="h-6 text-sm flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
        ) : (
          <span className="truncate flex-1" onClick={handleClick}>
            {node.title || '无标题'}
          </span>
        )}
        {isAuthenticated && (
          <span className="hidden group-hover:flex gap-0.5">
            <button
              className="p-0.5 hover:bg-muted-foreground/10 rounded"
              onClick={async (e) => { e.stopPropagation(); const id = await createNode('', node.id); if (id) navigate(`/docs/${id}`); }}
              title="新建子文档"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 hover:bg-muted-foreground/10 rounded"
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setName(node.title); }}
              title="重命名"
            >
              <FileText className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 hover:bg-muted-foreground/10 rounded"
              onClick={async (e) => { e.stopPropagation(); await trashNode(node.id, true); }}
              title="删除"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        )}
      </div>
      {expanded && children.map((child) => (
        <TreeNodeWrapper key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function TreeNodeWrapper({ node, depth }: { node: DocNode; depth: number }) {
  const nodes = useWikiStore((s) => s.nodes);
  const tree = buildTree(nodes);
  const children = tree.get(node.id) || [];
  return <TreeNode node={node} children={children} depth={depth} />;
}

export default function DocTree() {
  const nodes = useWikiStore((s) => s.nodes);
  const createNode = useWikiStore((s) => s.createNode);
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const navigate = useNavigate();
  const tree = buildTree(nodes);
  const rootNodes = tree.get(null) || [];

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">文档</span>
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => { const id = await createNode('新建文档'); if (id) navigate(`/docs/${id}`); }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-1">
        {rootNodes.map((node) => (
          <TreeNodeWrapper key={node.id} node={node} depth={0} />
        ))}
        {rootNodes.length === 0 && (
          <p className="text-sm text-muted-foreground p-4 text-center">暂无文档</p>
        )}
      </div>
    </div>
  );
}
