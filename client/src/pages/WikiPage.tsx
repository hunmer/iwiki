import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '@/components/Layout';
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

  useEffect(() => {
    setActiveId(id || null);
  }, [id]);

  return (
    <Layout>
      <div className={cn('border-r overflow-auto shrink-0 transition-all', sidebarCollapsed ? 'w-0' : 'w-64')}>
        {!sidebarCollapsed && <DocTree />}
      </div>
      <div className="flex-1 overflow-auto">
        <DocContent nodeId={id || null} />
        {id && <CommentSection nodeId={id} />}
      </div>
      <AiChat />
    </Layout>
  );
}
