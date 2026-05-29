import { createBrowserRouter, Navigate } from 'react-router-dom';
import App from './App';
import Layout from '@/components/Layout';
import WikiPage from '@/pages/WikiPage';
import LoginPage from '@/pages/LoginPage';
import AdminPage from '@/pages/AdminPage';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            path: 'admin',
            element: <AdminPage />,
          },
          {
            path: 'docs/:id',
            element: <WikiPage />,
          },
          {
            path: 'docs',
            element: <WikiPage />,
          },
          {
            index: true,
            element: <Navigate to="/docs" replace />,
          },
        ],
      },
    ],
  },
]);

export default router;
