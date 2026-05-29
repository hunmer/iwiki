import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useWikiStore } from '@/stores/wiki';

/**
 * App root component.
 * Handles initial data loading (nodes and auth check) on mount.
 */
export default function App() {
  const loadNodes = useWikiStore((s) => s.loadNodes);
  const checkAuth = useWikiStore((s) => s.checkAuth);

  useEffect(() => {
    loadNodes();
    checkAuth();
  }, []);

  return <Outlet />;
}
