import { resolve } from 'node:path';
import { makeEntryPointPlugin } from '@agent-guard/hmr';
import { isDev, withPageConfig } from '@agent-guard/vite-config';

const rootDir = resolve(__dirname);
const srcDir = resolve(rootDir, 'src');

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['iife'],
      name: 'ContentScript',
      fileName: 'main-content',
    },
    outDir: resolve(rootDir, '..', '..', 'dist', 'content'),
  },
  plugins: [
    isDev && makeEntryPointPlugin(),
    {
      name: 'fix-underscores',
      generateBundle(_, bundle) {
        for (const fileName in bundle) {
          if (fileName.startsWith('_')) {
            const newName = fileName.replace(/^_+/, '');
            bundle[newName] = bundle[fileName];
            bundle[newName].fileName = newName;
            delete bundle[fileName];
          }
        }
      },
    },
  ],
});
