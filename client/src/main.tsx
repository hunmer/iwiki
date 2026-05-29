import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { bindCaptureListener } from 'dom-inspector-hook';
import router from './router';
import './index.css';

bindCaptureListener({
  url: 'http://localhost:3100/api/inspector/track',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
);
