import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DocTree from '@/components/DocTree';
import DocContent from '@/components/DocContent';
import CommentSection from '@/components/CommentSection';
import AiChat from '@/components/AiChat';
import { useWikiStore } from '@/stores/wiki';
import { cn } from '@/lib/utils';

export default function WikiPage() {
  const { id } = useParams<{ id: string }>();
  const setActiveId = useWikiStore((s) => s.setActiveId);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setActiveId(id || null);
  }, [id]);

  return (
    <div className="flex-1 flex gap-4 p-4 overflow-hidden">
      {/* 左侧目录 - 悬浮卡片 */}
      <div className={cn('shrink-0 transition-all', sidebarCollapsed ? 'w-0' : 'w-64')}>
        {!sidebarCollapsed && (
          <div className="h-full bg-card border border-border rounded-lg shadow-md overflow-hidden">
            <DocTree />
          </div>
        )}
      </div>
      {/* 中间内容 + 右侧评论 */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* 中间内容 - 悬浮卡片 */}
        <div className="flex-[3] flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col bg-card border border-border rounded-lg shadow-md overflow-hidden">
            <DocContent nodeId={id || null} onEditingChange={setIsEditing} />
          </div>
        </div>
        {/* 右侧评论 - 悬浮卡片 */}
        {id && !isEditing && (
          <div className="flex-[2] overflow-hidden">
            <div className="h-full bg-card border border-border rounded-lg shadow-md overflow-hidden">
              <CommentSection nodeId={id} />
            </div>
          </div>
        )}
      </div>
      <AiChat />
    </div>
  );
}
