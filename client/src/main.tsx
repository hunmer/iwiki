import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { bindCaptureListener } from 'dom-inspector-hook';
import App from './App';
import './index.css';

bindCaptureListener({
  url: 'http://localhost:3999',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
