import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { copyFileSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  plugins: [
    svelte(),
    {
      name: 'copy-sql-wasm',
      closeBundle() {
        // Copy sql-wasm.wasm to dist
        try {
          const wasmPath = join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
          const distPath = join(process.cwd(), 'dist', 'sql-wasm.wasm');
          copyFileSync(wasmPath, distPath);
        } catch (error) {
          console.warn('Could not copy sql-wasm.wasm:', error);
        }
      }
    }
  ],
  base: './', // Use relative paths for Electron
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
});
