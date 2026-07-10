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
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
