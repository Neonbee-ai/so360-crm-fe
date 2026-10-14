import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'path';
import fs from 'fs';

// @originjs/vite-plugin-federation builds the remote's CSS URL as `${base}${file}`,
// dropping `assets/` when base is absolute. Copy the CSS to dist/ so that URL
// resolves on every host (preview included), not only where nginx papers over it.
function copyCssToDistRoot() {
  return {
    name: 'copy-css-to-dist-root',
    closeBundle() {
      const assetsDir = path.resolve(__dirname, 'dist/assets');
      const distDir = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(assetsDir)) return;
      fs.readdirSync(assetsDir)
        .filter(f => f.endsWith('.css'))
        .forEach(cssFile => fs.copyFileSync(path.join(assetsDir, cssFile), path.join(distDir, cssFile)));
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_URL || process.env.VITE_BASE_URL || 'http://localhost:3004/',
    resolve: {
        alias: {
            // Dev server only (like the shell): build/preview resolve @so360/* from
            // node_modules dist so federation shares the host's single copy instead of
            // bundling a private one into this remote.
            ...(command === 'serve' ? {
                '@so360/shell-context': path.resolve(__dirname, '../../so360-shell-fe/packages/shell-context/src/index.ts'),
                '@so360/cross-link': path.resolve(__dirname, '../../so360-shell-fe/packages/cross-link/src/index.ts'),
                '@so360/design-system': path.resolve(__dirname, '../../so360-shell-fe/packages/design-system/src/index.ts'),
                '@so360/event-bus': path.resolve(__dirname, '../../so360-shell-fe/packages/event-bus/src/index.ts'),
                '@so360/formatters': path.resolve(__dirname, '../../so360-shell-fe/packages/formatters/src/index.ts'),
            } : {}),
        },
    },
    plugins: [
        react({
            jsxRuntime: 'automatic',
        }),
        copyCssToDistRoot(),
        federation({
            name: 'crm_app',
            filename: 'remoteEntry.js',
            // Access from Shell: import('crm_app/App')
            exposes: {
                './App': './src/App.tsx',
            },
            shared: {
                react: { singleton: true, requiredVersion: '^19.2.0' },
                'react-dom': { singleton: true, requiredVersion: '^19.2.0' },
                'react-router-dom': { singleton: true, requiredVersion: '^7.12.0' },
                'framer-motion': { singleton: true },
                'lucide-react': { singleton: true },
                '@so360/shell-context': { singleton: true },
                '@so360/cross-link': { singleton: true },
                '@so360/design-system': { singleton: true },
                '@so360/event-bus': { singleton: true },
                '@so360/formatters': { singleton: true },
            },
        }),
    ],
    build: {
        target: 'esnext',
        minify: 'esbuild',
        cssCodeSplit: false,
        emptyOutDir: false,
    },
    server: {
        port: 3004,
        strictPort: true,
        cors: true, // Allow Shell to load remoteEntry.js
        proxy: {
            '/crm-api': {
                target: 'http://localhost:3003',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/crm-api/, ''),
            },
            '/core-api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/core-api/, ''),
            },
            '/v1': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
    preview: {
        port: 3004,
        strictPort: true,
        cors: true,
        proxy: {
            '/crm-api': {
                target: 'http://localhost:3003',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/crm-api/, ''),
            },
            '/core-api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/core-api/, ''),
            },
            '/v1': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
}; });
