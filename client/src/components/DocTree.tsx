import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Plus, Trash2, FileText, GripVertical, MoreVertical, FolderPlus, FilePlus, Folder, FolderOpen, Upload } from 'lucide-react';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { DocNode } from '@/types';
import { useHeTree, sortFlatData } from 'he-tree-react';

// Helper function to check if targetId is a descendant of nodeId (prevents circular dependencies)
function isDescendant(nodeId: string, targetId: string, nodes: DocNode[]): boolean {
  let current = targetId;
  while (current) {
    if (current === nodeId) return true;
    const parent = nodes.find(n => n.id === current);
    current = parent?.parentId ?? '';
  }
  return false;
}

// Helper function to check if a node is a folder
const isFolder = (node: DocNode) => node.type === 'folder';

export default function DocTree() {
  const nodes = useWikiStore((s) => s.nodes);
  const createNode = useWikiStore((s) => s.createNode);
  const createNodeWithContent = useWikiStore((s) => s.createNodeWithContent);
  const batchReorderNodes = useWikiStore((s) => s.batchReorderNodes);
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);
  const activeId = useWikiStore((s) => s.activeId);
  const navigate = useNavigate();

  // Filter out trash nodes and sort data in tree order
  const flatData = useMemo(() => {
    const filtered = nodes.filter(n => !n.isTrash);
    return sortFlatData(filtered, { idKey: 'id', parentIdKey: 'parentId' });
  }, [nodes]);

  // Track which nodes are being renamed
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState('');

  // Track dragging state to prevent circular drops
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // Track which folders are open
  const [openIds, setOpenIds] = useState<string[]>([]);

  // Create file input reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file import
  const handleImportMd = async (file: File) => {
    if (!file.name.endsWith('.md')) {
      alert('请选择 .md 文件');
      return;
    }

    const title = file.name.replace(/\.md$/, '');
    const content = await file.text();

    const id = await createNodeWithContent(title, content, null, 'doc');
    if (id) {
      navigate(`/docs/${id}`);
    }
  };

  // Trigger file input click
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportMd(file);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  };

  // Handle drag-and-drop data changes
  const handleChange = async (newData: DocNode[]) => {
    // Calculate differences and collect moves
    const moves: Array<{ id: string; parentId: string | null; sortOrder: number }> = [];

    // Group nodes by parentId to assign new sortOrder values
    const parentGroups = new Map<string | null, DocNode[]>();

    for (const node of newData) {
      const group = parentGroups.get(node.parentId) || [];
      group.push(node);
      parentGroups.set(node.parentId, group);
    }

    // Assign new sortOrder values (0, 1, 2, ...) to each group
    for (const [_parentId, group] of parentGroups) {
      for (let i = 0; i < group.length; i++) {
        const node = group[i];
        const newSortOrder = i;

        // Check if this node actually changed
        const originalNode = flatData.find(n => n.id === node.id);
        if (originalNode && (
          originalNode.parentId !== node.parentId ||
          originalNode.sortOrder !== newSortOrder
        )) {
          moves.push({
            id: node.id,
            parentId: node.parentId,
            sortOrder: newSortOrder
          });
        }
      }
    }

    // Send batch reorder to API if there are changes
    if (moves.length > 0) {
      await batchReorderNodes(moves);
    }
  };

  // Check if a node can be dragged (only authenticated users)
  const canDrag = () => isAuthenticated;

  // Check if a node can be dropped (prevent circular dependencies and only allow dropping into folders)
  const canDrop = ({ node }: any) => {
    if (!draggingNodeId) return true;
    // Prevent circular dependencies
    if (isDescendant(draggingNodeId, node.id, flatData)) return false;
    // Only allow dropping into folders
    return isFolder(node);
  };

  const { renderTree } = useHeTree<DocNode>({
    data: flatData,
    dataType: 'flat',
    idKey: 'id',
    parentIdKey: 'parentId',
    indent: 16,
    onChange: handleChange,
    canDrag,
    canDrop,
    dragOpen: true,
    dragOpenDelay: 500,
    openIds,
    renderNode: (stat) => {
      const node = stat.node;
      const level = stat.level;
      const isOpen = stat.open;
      const isPlaceholder = false;
      const isDragging = draggingNodeId === node.id;

      const toggleOpen = () => {
        setOpenIds(prev => {
          if (prev.includes(node.id)) {
            return prev.filter(id => id !== node.id);
          } else {
            return [...prev, node.id];
          }
        });
      };

      const hasChildren = flatData.some(n => n.parentId === node.id);
      const isActive = activeId === node.id;
      const isRenaming = renamingId === node.id;
      const isFolderNode = isFolder(node);

      const handleRename = async () => {
        if (renamingValue.trim()) {
          const store = useWikiStore.getState();
          await store.renameNode(node.id, renamingValue.trim());
        }
        setRenamingId(null);
      };

      const handleClick = () => {
        // 文件夹也跳转到编辑页面（文件夹本身也是一个页面）
        const store = useWikiStore.getState();
        store.setActiveId(node.id);
        navigate(`/docs/${node.id}`);
        // 如果是文件夹，同时切换展开/折叠状态
        if (isFolderNode) {
          toggleOpen();
        }
      };

      const handleStartRename = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRenamingId(node.id);
        setRenamingValue(node.title);
      };

      const handleCreateChild = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const id = await createNode('', node.id, 'doc');
        if (id) {
          navigate(`/docs/${id}`);
        }
      };

      const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const store = useWikiStore.getState();
        // 如果删除的是当前活动的文档，导航到文档列表页
        if (store.activeId === node.id) {
          navigate('/docs');
        }
        await store.trashNode(node.id, true);
      };

      const handleDragStart = () => {
        setDraggingNodeId(node.id);
      };

      const handleDragEnd = () => {
        setDraggingNodeId(null);
      };

      return (
        <div
          className={cn(
            'flex items-center gap-1 py-1.5 px-2 cursor-pointer rounded-sm text-sm group transition-colors duration-200',
            isActive
              ? 'bg-primary/10 text-primary border-l-2 border-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border-l-2 border-transparent',
            isPlaceholder && 'opacity-50',
            isDragging && 'opacity-50'
          )}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          draggable={isAuthenticated && !isRenaming}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Drag handle */}
          {isAuthenticated && (
            <span className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground opacity-0 group-hover:opacity-50 hover:opacity-100 transition-opacity scale-90">
              <GripVertical className="h-2.5 w-2.5" />
            </span>
          )}

          {/* Expand/collapse arrow */}
          {(hasChildren || isFolderNode) ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleOpen(); }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-3" />
          )}

          {/* Node icon */}
          {isFolderNode ? (
            isOpen && hasChildren ? (
              <FolderOpen className="h-4 w-4 text-amber-500" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500" />
            )
          ) : (
            <span className="shrink-0">{node.icon}</span>
          )}

          {/* Node title or rename input */}
          {isRenaming ? (
            <Input
              className="h-6 text-sm flex-1 bg-input border-border"
              value={renamingValue}
              onChange={(e) => setRenamingValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span className="truncate flex-1" onClick={handleClick}>
              {node.title || '无标题'}
            </span>
          )}

          {/* Action buttons (visible on hover) */}
          {isAuthenticated && !isRenaming && (
            <span className="hidden group-hover:flex gap-0.5">
              {isFolderNode && (
                <button
                  className="p-0.5 hover:text-primary rounded transition-colors"
                  onClick={handleCreateChild}
                  title="新建子文档"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
              <button
                className="p-0.5 hover:text-primary rounded transition-colors"
                onClick={handleStartRename}
                title="重命名"
              >
                <FileText className="h-3 w-3" />
              </button>
              <button
                className="p-0.5 hover:text-destructive rounded transition-colors"
                onClick={handleDelete}
                title="删除"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      );
    },
  });

  return (
    <div className="h-full flex flex-col">
      {/* Hidden file input for MD import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="p-3 border-b border-charcoal">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            文档
          </span>
          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-primary"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={async () => {
                  const id = await createNode('新建文件夹', null, 'folder');
                  if (id) navigate(`/docs/${id}`);
                }}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  新增文件夹
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const id = await createNode('新建文档', null, 'doc');
                  if (id) navigate(`/docs/${id}`);
                }}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  新增文档
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportClick}>
                  <Upload className="h-4 w-4 mr-2" />
                  导入 MD 文件
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-1">
        {flatData.length > 0 ? (
          renderTree()
        ) : (
          <p className="text-xs text-muted-foreground p-4 text-center">暂无文档</p>
        )}
      </div>
    </div>
  );
}
