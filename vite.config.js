import { defineConfig } from 'vite';

// Build + Vitest config in one file. Tests cover the pure sim modules only
// (systems/battle, systems/field, systems/progression, data/save, content
// validation). Renderer / scenes / input are verified manually — they import
// PixiJS and are not unit-tested. See the design doc's Test Plan.
export default defineConfig({
  base: './',
  server: { port: 9153, host: true },
  preview: { port: 9153, host: true },
  build: {
    // Many small pixel-art PNGs — keep them as standalone files instead of
    // inlining as data URIs, so the JS bundle stays small.
    assetsInlineLimit: 1024,
    // PixiJS is an intentionally retained renderer dependency (~878 kB
    // minified). Warn only when a chunk grows beyond that known baseline.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // PixiJS accounts for most of the application bundle. Keep it in a
        // stable vendor chunk so game updates can reuse the renderer cache.
        manualChunks(id) {
          if (id.includes('/node_modules/pixi.js/') || id.includes('/node_modules/@pixi/')) {
            return 'vendor-pixi';
          }
          if (id.includes('/src/content/maps/')) return 'game-maps';
          if (id.includes('/src/fx/')) return 'game-effects';
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
