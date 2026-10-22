import { defineConfig, mergeConfig } from 'vite';
import config from '../vite.config';

// Opt-in production benchmark. The regular build never imports this script.
export default mergeConfig(config, defineConfig({
    plugins: [{ name: 'local-map-performance', transformIndexHtml: { order: 'pre', handler: () => [
        { tag: 'script', attrs: { type: 'module', src: '/scripts/benchmark-map.ts' }, injectTo: 'body' },
    ] } }],
    build: { outDir: 'internal/map-performance-dist' },
}));
