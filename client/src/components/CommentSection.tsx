import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useWikiStore } from '@/stores/wiki';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Comment } from '@/types';

function CommentItem({ comment, onReply, onDelete }: {
  comment: Comment;
  onReply: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const isAuthenticated = useWikiStore((s) => s.isAuthenticated);

  return (
    <div className="py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium">{comment.nickname}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(comment.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
      <div className="flex gap-2 mt-1">
        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onReply(comment.id)}>
          回复
        </button>
        {isAuthenticated && (
          <button className="text-xs text-destructive hover:text-destructive/80" onClick={() => onDelete(comment.id)}>
            删除
          </button>
        )}
      </div>
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

  const topLevel = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  return (
    <div className="border-t mt-8 pt-6 px-8 pb-8 max-w-4xl">
      <h2 className="text-lg font-semibold mb-4">评论 ({comments.length})</h2>

      <div className="space-y-2 mb-6">
        {replyTo && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>回复评论</span>
            <button className="text-destructive" onClick={() => setReplyTo(null)}>取消</button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder="昵称"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-32"
          />
          <Textarea
            placeholder={replyTo ? '写下你的回复...' : '写下你的评论...'}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1"
            rows={2}
          />
        </div>
        <Button size="sm" onClick={handleSubmit} disabled={submitting || !nickname.trim() || !content.trim()}>
          {replyTo ? '回复' : '发表评论'}
        </Button>
      </div>

      <div className="divide-y">
        {topLevel.map(comment => (
          <div key={comment.id}>
            <CommentItem comment={comment} onReply={setReplyTo} onDelete={handleDelete} />
            {getReplies(comment.id).map(reply => (
              <div key={reply.id} className="ml-8 border-l pl-4">
                <CommentItem comment={reply} onReply={setReplyTo} onDelete={handleDelete} />
              </div>
            ))}
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">暂无评论</p>
        )}
      </div>
    </div>
  );
}
