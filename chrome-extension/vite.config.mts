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
    isDev && watchRebuildPlugin({ reload: true, id: 'chrome-extension-hmr' }),
  ],
  publicDir: resolve(rootDir, 'public'),
  build: {
    lib: {
      formats: ['iife'],
      entry: resolve(__dirname, 'src/background/index.ts'),
      name: 'BackgroundScript',
      fileName: 'background',
    },
    outDir,
    emptyOutDir: false,
    sourcemap: isDev,
    minify: isProduction,
    reportCompressedSize: isProduction,
    watch: watchOption,
    rollupOptions: {
      external: [
        'chrome',
        // Puppeteer's browser management package is Node.js-only and should not
        // be bundled into the extension IIFE — only puppeteer-core/browser is used.
        '@puppeteer/browsers',
        'proxy-agent',
        'node:url',
        'node:http',
        'node:https',
        'node:fs',
        'node:path',
        'node:stream',
        'node:net',
        'node:tls',
        'node:events',
        'node:util',
        'node:os',
        'node:crypto',
        'node:buffer',
        'node:assert',
        'node:zlib',
      ],
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
