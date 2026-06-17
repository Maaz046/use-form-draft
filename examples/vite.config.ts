import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'use-form-draft/rhf': path.resolve(__dirname, '../src/rhf.ts'),
      'use-form-draft': path.resolve(__dirname, '../src/index.ts'),
    },
  },
});
