import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Reply, MessageCircle, X, ChevronUp } from 'lucide-react';
import type { Comment } from '@/types';

function getAvatarFallback(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function CommentItem({ comment, onReply, onDelete, replies = [], collapsed, onToggleCollapse, replyCount }: {
  comment: Comment;
  onReply: (parentId: string) => void;
  onDelete: (id: string) => void;
  replies?: Comment[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  replyCount?: number;
}) {
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);

  return (
    <div>
      <div className="group flex gap-3 bg-background rounded-lg shadow-sm border border-border/50 p-2.5">
        {/* Avatar */}
        <span className="relative flex overflow-hidden rounded-full select-none size-8 shrink-0 bg-muted">
          <span className="bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-xs">
            {getAvatarFallback(comment.nickname)}
          </span>
        </span>

        <div className="min-w-0 flex-1">
          {/* User info */}
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{comment.nickname}</span>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(new Date(comment.createdAt))}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => onReply(comment.id)}
              >
                <Reply className="size-3" />
                Reply
              </Button>

              {comment.parentId === undefined && replyCount !== undefined && replyCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs"
                  onClick={onToggleCollapse}
                >
                  <MessageCircle className="size-3" />
                  {collapsed ? 'Show' : 'Hide'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                </Button>
              )}

              {isAuthenticated && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => onDelete(comment.id)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>

          {/* Comment content */}
          <p className="mt-1 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {comment.content}
          </p>
        </div>
      </div>

      {/* Nested replies */}
      {!collapsed && replies.length > 0 && (
        <div className="mt-2 pl-6 pt-2 space-y-2">
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  nodeId: string;
}

export default function CommentSection({ nodeId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [collapsedReplies, setCollapsedReplies] = useState<Set<string>>(new Set());
  const [showEditor, setShowEditor] = useState(false);

  const loadComments = async () => {
    try {
      const data = await api.getComments(nodeId);
      setComments(data);
    } catch {}
  };

  useEffect(() => {
    if (nodeId) loadComments();
  }, [nodeId]);

  const handleSubmit = async () => {
    if (!nickname.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      await api.createComment(nodeId, {
        nickname: nickname.trim(),
        content: content.trim(),
        parentId: replyTo || undefined,
      });
      setContent('');
      setReplyTo(null);
      await loadComments();
    } catch {}
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await api.deleteComment(nodeId, id);
    await loadComments();
  };

  const handleReply = (parentId: string) => {
    setReplyTo(parentId);
    setShowEditor(true);
    // Focus on textarea after a short delay to ensure the editor is visible
    setTimeout(() => {
      document.querySelector('textarea')?.focus();
    }, 100);
  };

  const toggleEditor = () => {
    setShowEditor(prev => !prev);
    if (!showEditor) {
      // When opening the editor, focus on textarea after a short delay
      setTimeout(() => {
        document.querySelector('textarea')?.focus();
      }, 100);
    }
  };

  const toggleReplies = (commentId: string) => {
    setCollapsedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // Group comments by parentId for efficient display
  const commentsByParentId = comments.reduce<Record<string, Comment[]>>((acc, comment) => {
    if (comment.parentId) {
      if (!acc[comment.parentId]) {
        acc[comment.parentId] = [];
      }
      acc[comment.parentId].push(comment);
    }
    return acc;
  }, {});

  const topLevel = comments.filter(c => !c.parentId);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
        </p>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {topLevel.map(comment => {
          const replies = commentsByParentId[comment.id] || [];
          return (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onDelete={handleDelete}
              replies={replies}
              collapsed={collapsedReplies.has(comment.id)}
              onToggleCollapse={() => toggleReplies(comment.id)}
              replyCount={replies.length}
            />
          );
        })}
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
        )}
      </div>

      {/* Comment Editor - Bottom Section */}
      {showEditor ? (
        <div className="bg-background rounded-lg shadow-md border border-border/50 animate-in slide-in-from-bottom duration-300">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <h3 className="text-sm font-medium">{replyTo ? 'Reply to Comment' : 'Add a Comment'}</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                setShowEditor(false);
                setReplyTo(null);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Editor Content */}
          <div className="p-4">
            {replyTo && (
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded">
                <span>Replying to comment</span>
                <button
                  className="text-primary hover:underline"
                  onClick={() => setReplyTo(null)}
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="mb-3">
              <Input
                placeholder="Your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mb-2 bg-input"
              />
              <Textarea
                placeholder={replyTo ? 'Write your reply...' : 'Add a comment...'}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px] resize-none bg-input"
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !nickname.trim() || !content.trim()}
                className="h-8 text-xs"
              >
                {submitting ? 'Posting...' : replyTo ? 'Post reply' : 'Post comment'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Floating Action Button - Within Container */
        <div className="p-4 flex justify-center">
          <Button
            onClick={toggleEditor}
            size="lg"
            className="rounded-full shadow-md gap-2 px-6 h-10"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="font-medium">{comments.length === 0 ? 'Add Comment' : 'Write Comment'}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
