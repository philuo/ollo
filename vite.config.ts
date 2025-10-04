import path from 'node:path';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import AutoImport from 'unplugin-auto-import/vite';

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    solid(),
    AutoImport({
      imports: [
        'solid-js',
        {
          from: 'solid-js',
          imports: ['JSX', 'Accessor', 'Setter', 'Component'],
          type: true,
        },
        {
          'solid-js': ['getOwner', 'runWithOwner']
        },
      ],
      // dirs: ['./src/directives/index.ts', './src/utils/index.ts', './src/components/**/index.tsx'],
      dts: './types/auto-imports.d.ts',
    }),
  ],
  css: {
    transformer: 'lightningcss' as const,
    lightningcss: {
      cssModules: {
        pattern: '[local]_[hash]',
      },
    },
    // preprocessorOptions: {
    //   scss: {
    //     additionalData: '@use "@/assets/styles/function.scss" as *;',
    //   },
    // },
  },
  build: {
    minify: true,
    sourcemap: false,
    cssMinify: 'lightningcss' as const,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 2000,
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['*.wasm'],
  },
  worker: {
    format: 'es',
  },
  server: {
    host: true,
    port: 3002,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    proxy: {
      '/api': {
        changeOrigin: true,
        target: 'http://10.160.56.61:30189', // beta
        rewrite: (url) => url.replace(/^\/api/, ''),
      },
      '/beta': {
        changeOrigin: true,
        target: 'https://ls-agent-beta.yinzuo.cn', // beta环境域名
        rewrite: (url) => url.replace(/^\/beta/, '/agent-meetingstt/application'),
      },
      '/test': {
        changeOrigin: true,
        target: 'https://ls-agent-test.yinzuo.cn', // beta环境域名
        rewrite: (url) => url.replace(/^\/test/, '/agent-meetingstt/application'),
      },
      '/ws': {
        target: 'ws://10.160.11.203:8095',
        ws: true, // 开启 websocket 代理
        changeOrigin: true,
        secure: false,
        timeout: 30000, // 30秒超时
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('WebSocket proxy error:', err.message);
          });
          proxy.on('proxyReqWs', (proxyReq, req, socket) => {
            console.log('WebSocket proxy request:', req.url);
          });
          proxy.on('close', (res, socket, head) => {
            console.log('WebSocket proxy connection closed');
          });
        },
      },
    },
  },
});
