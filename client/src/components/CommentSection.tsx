import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Reply, MessageCircle } from 'lucide-react';
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
    <div className="p-4">
      <div className="flex gap-3">
        {/* Avatar */}
        <span className="relative flex overflow-hidden rounded-full select-none size-8 shrink-0 bg-muted">
          <span className="bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-xs">
            {getAvatarFallback(comment.nickname)}
          </span>
        </span>

        <div className="min-w-0 flex-1">
          {/* User info */}
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{comment.nickname}</span>
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(new Date(comment.createdAt))}
            </span>
          </div>

          {/* Comment content */}
          <p className="mt-1 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="size-3" />
              Reply
            </Button>

            {comment.parentId === undefined && replyCount !== undefined && replyCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
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
                className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => onDelete(comment.id)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Nested replies */}
      {!collapsed && replies.length > 0 && (
        <div className="mt-3 pl-8 pt-3 border-l border-muted">
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
    // Focus on textarea
    document.querySelector('textarea')?.focus();
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
    <div className="overflow-hidden rounded-lg border bg-card">
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

      {/* Comment Input */}
      <div className="border-b p-4">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
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

      {/* Comments List */}
      <div className="divide-y">
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
          <p className="text-xs text-muted-foreground text-center py-8">No comments yet</p>
        )}
      </div>
    </div>
  );
}
