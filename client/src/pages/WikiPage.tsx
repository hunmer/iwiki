import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DocTree from '@/components/DocTree';
import DocContent from '@/components/DocContent';
import CommentSection from '@/components/CommentSection';
import AiChat from '@/components/AiChat';
import { useWikiStore } from '@/stores/wiki';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';

const COMMENTS_VISIBLE_KEY = 'wiki-comments-visible';

export default function WikiPage() {
  const { id } = useParams<{ id: string }>();
  const setActiveId = useWikiStore((s) => s.setActiveId);
  const sidebarCollapsed = useWikiStore((s) => s.sidebarCollapsed);
  const [isEditing, setIsEditing] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // 从 localStorage 读取评论显示状态
  useEffect(() => {
    const stored = localStorage.getItem(COMMENTS_VISIBLE_KEY);
    if (stored !== null) {
      setCommentsVisible(stored === 'true');
    }
  }, []);

  // 获取评论数量
  useEffect(() => {
    if (!id) return;

    const loadCommentCount = async () => {
      try {
        const comments = await api.getComments(id);
        setCommentCount(comments.length);
      } catch {
        setCommentCount(0);
      }
    };

    loadCommentCount();
  }, [id]);

  // 保存评论显示状态到 localStorage
  const handleToggleComments = () => {
    const newState = !commentsVisible;
    setCommentsVisible(newState);
    localStorage.setItem(COMMENTS_VISIBLE_KEY, String(newState));
  };

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
          <div className="flex-1 flex flex-col bg-card border border-border rounded-lg shadow-md overflow-hidden relative">
            {/* 评论切换按钮 - 右上角 */}
            {id && !isEditing && (
              <div className="absolute top-3 right-3 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleComments}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>评论</span>
                  {commentCount > 0 && (
                    <Badge variant={commentsVisible ? "default" : "secondary"} className="ml-1">
                      {commentCount}
                    </Badge>
                  )}
                </Button>
              </div>
            )}
            <DocContent nodeId={id || null} onEditingChange={setIsEditing} />
          </div>
        </div>
        {/* 右侧评论 - 悬浮卡片 */}
        {id && !isEditing && commentsVisible && (
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
