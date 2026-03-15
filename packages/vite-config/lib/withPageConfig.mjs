import { defineConfig } from 'vite';
import { watchRebuildPlugin } from '@agent-guard/hmr';
import react from '@vitejs/plugin-react-swc';
import deepmerge from 'deepmerge';
import { isDev, isProduction } from './env.mjs';

export const watchOption = isDev ? {
  buildDelay: 100,
  chokidar: {
    ignored:[
      /\/packages\/.*\.(ts|tsx|map)$/,
    ]
  }
}: undefined;

/**
 * @typedef {import('vite').UserConfig} UserConfig
 * @param {UserConfig} config
 * @returns {UserConfig}
 */
export function withPageConfig(config) {
  return defineConfig(
    deepmerge(
      {
        base: '',
        plugins: [
          react(),
          isDev && watchRebuildPlugin({ refresh: true }),
          {
            name: 'fix-underscores',
            generateBundle(_, bundle) {
              for (const fileName in bundle) {
                if (fileName.startsWith('_') && fileName !== '_locales') {
                  const newName = fileName.replace(/^_+/, '');
                  bundle[newName] = bundle[fileName];
                  bundle[newName].fileName = newName;
                  delete bundle[fileName];
                }
              }
            },
          },
        ],
        server: {
          sourcemapIgnoreList: false,
        },
        build: {
          sourcemap: isDev,
          minify: isProduction,
          reportCompressedSize: isProduction,
          emptyOutDir: isProduction,
          watch: watchOption,
          rollupOptions: {
            external: ['chrome'],
            output: {
              chunkFileNames: (chunkInfo) => {
                const name = chunkInfo.name.replace(/^_+/, '');
                return `assets/${name}-[hash].js`;
              },
              assetFileNames: (assetInfo) => {
                const name = (assetInfo.name || 'asset').replace(/^_+/, '');
                return `assets/${name}-[hash].[ext]`;
              },
            },
          },
        },
        define: {
          'process.env.NODE_ENV': isDev ? `"development"` : `"production"`,
        },
        envDir: '../..'
      },
      config,
    ),
  );
}
