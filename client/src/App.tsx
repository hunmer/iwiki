import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from '@/components/Layout';
import WikiPage from '@/pages/WikiPage';
import LoginPage from '@/pages/LoginPage';
import AdminPage from '@/pages/AdminPage';
import { useWikiStore } from '@/stores/wiki';

export default function App() {
  const loadNodes = useWikiStore((s) => s.loadNodes);
  const checkAuth = useWikiStore((s) => s.checkAuth);

  useEffect(() => {
    loadNodes();
    checkAuth();
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/docs/:id" element={<WikiPage />} />
        <Route path="/docs" element={<WikiPage />} />
        <Route path="/" element={<Navigate to="/docs" replace />} />
      </Route>
    </Routes>
  );
}
