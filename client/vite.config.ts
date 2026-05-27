import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { inspectorServer } from '@react-dev-inspector/vite-plugin';
import { transformSync } from '@babel/core';
import path from 'path';

function inspectorBabel(): Plugin {
  return {
    name: 'inspector-babel',
    enforce: 'pre',
    apply: 'serve',
    transform(code, id) {
      if (!/\.[jt]sx$/.test(id) || id.includes('node_modules')) return;
      const result = transformSync(code, {
        filename: id,
        sourceMaps: false,
        presets: [
          ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
        plugins: [
          ['@react-dev-inspector/babel-plugin', { excludes: ['node_modules'] }],
        ],
      });
      if (result?.code) return result.code;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inspectorBabel(), inspectorServer()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
