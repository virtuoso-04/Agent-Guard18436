import { resolve } from 'node:path';
import { defineConfig, type PluginOption, loadEnv } from "vite";
import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets';
import makeManifestPlugin from './utils/plugins/make-manifest-plugin';
import { watchPublicPlugin, watchRebuildPlugin } from '@agent-guard/hmr';
import { isDev, isProduction, watchOption } from '@agent-guard/vite-config';

const rootDir = resolve(__dirname);
const srcDir = resolve(rootDir, 'src');

const outDir = resolve(rootDir, '..', 'dist');

export default defineConfig(({ mode }) => {
  // Load environment variables from the parent directory
  const env = loadEnv(mode, resolve(rootDir, '..'), 'VITE_');
  
  return {
  resolve: {
    alias: {
      '@root': rootDir,
      '@src': srcDir,
      '@assets': resolve(srcDir, 'assets'),
      // Mock Node.js-only modules that might be pulled in by dependencies
      '@puppeteer/browsers': resolve(rootDir, 'utils/mocks/empty.ts'),
      'proxy-agent': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:url': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:http': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:https': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:fs': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:path': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:stream': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:net': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:tls': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:events': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:util': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:os': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:crypto': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:buffer': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:assert': resolve(rootDir, 'utils/mocks/empty.ts'),
      'node:zlib': resolve(rootDir, 'utils/mocks/empty.ts'),
      'url': resolve(rootDir, 'utils/mocks/empty.ts'),
      'http': resolve(rootDir, 'utils/mocks/empty.ts'),
      'https': resolve(rootDir, 'utils/mocks/empty.ts'),
      'fs': resolve(rootDir, 'utils/mocks/empty.ts'),
      'path': resolve(rootDir, 'utils/mocks/empty.ts'),
      'stream': resolve(rootDir, 'utils/mocks/empty.ts'),
      'net': resolve(rootDir, 'utils/mocks/empty.ts'),
      'tls': resolve(rootDir, 'utils/mocks/empty.ts'),
      'events': resolve(rootDir, 'utils/mocks/empty.ts'),
      'util': resolve(rootDir, 'utils/mocks/empty.ts'),
      'os': resolve(rootDir, 'utils/mocks/empty.ts'),
      'crypto': resolve(rootDir, 'utils/mocks/empty.ts'),
      'buffer': resolve(rootDir, 'utils/mocks/empty.ts'),
      'assert': resolve(rootDir, 'utils/mocks/empty.ts'),
      'zlib': resolve(rootDir, 'utils/mocks/empty.ts'),
    },
    conditions: ['browser', 'module', 'import', 'default'],
    mainFields: ['browser', 'module', 'main']
  },
  server: {
    // Restrict CORS to only allow localhost
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true
    },
    host: 'localhost',
    sourcemapIgnoreList: false,
  },
  plugins: [
    libAssetsPlugin({
      outputPath: outDir,
    }) as PluginOption,
    watchPublicPlugin(),
    makeManifestPlugin({ outDir }),
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
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      formats: ['es'],
      entry: {
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      fileName: (format) => `[name].js`,
    },
    outDir,
    emptyOutDir: false,
    sourcemap: isDev,
    minify: isProduction,
    reportCompressedSize: isProduction,
    watch: watchOption,
    rollupOptions: {
      external: ['chrome'],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name.replace(/^_+/, '');
          return `chunks/${name}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          let name = (assetInfo.name || 'asset').replace(/^_+/, '');
          return `assets/${name}-[hash].[ext]`;
        },
      },
    },
  },

  define: {
    'import.meta.env.DEV': isDev,
    'import.meta.env.VITE_POSTHOG_API_KEY': JSON.stringify(env.VITE_POSTHOG_API_KEY || process.env.VITE_POSTHOG_API_KEY || ''),
  },

  envDir: '../',
  envPrefix: 'VITE_',
  };
});
