import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: resolve(__dirname, '../src/main/resources/static/markdownx-enhancer'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/markdown-enhancer.js'),
      output: {
        entryFileNames: 'markdown-enhancer-min.js',
        assetFileNames: '[name][extname]',
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
    minify: 'esbuild',
    sourcemap: false,
    copyPublicDir: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
