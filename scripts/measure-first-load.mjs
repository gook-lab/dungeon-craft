// measure-first-load — empty-cache first load of a running build, 3 network
// conditions × N runs, median. Reads the `dc-title` mark main.js sets once the
// title is on screen.
//
//   npm run build && npx vite preview --port 5361 --strictPort
//   PLAYWRIGHT_DIR=<folder with node_modules/playwright> node scripts/measure-first-load.mjs [url] [runs]
//
// Playwright is not a dependency of this repo; point PLAYWRIGHT_DIR at any
// project that has it installed. Throttling is Chrome DevTools network
// emulation (per-request latency + shared bandwidth).

import { createRequire } from 'node:module';
import { join } from 'node:path';

const url = process.argv[2] || 'http://localhost:5361/';
const RUNS = Number(process.argv[3] || 3);
const require = createRequire(join(process.env.PLAYWRIGHT_DIR || process.cwd(), 'package.json'));
const { chromium } = require('playwright');

const CONDS = [
  { name: 'unthrottled', net: null },
  { name: '1.6 Mbps / 150 ms', net: { latency: 150, down: 1.6e6 / 8, up: 750e3 / 8 } },
  { name: '4 Mbps / 40 ms', net: { latency: 40, down: 4e6 / 8, up: 3e6 / 8 } },
];

async function once(browser, cond) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (cond.net) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: cond.net.latency, downloadThroughput: cond.net.down, uploadThroughput: cond.net.up,
    });
  }
  const reqs = new Map();
  let t0 = null;
  cdp.on('Network.requestWillBeSent', (e) => {
    if (t0 === null) t0 = e.timestamp;
    reqs.set(e.requestId, { url: e.request.url, start: e.timestamp });
  });
  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId);
    if (r) { r.end = e.timestamp; r.bytes = e.encodedDataLength; }
  });
  await page.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => performance.getEntriesByName('dc-title').length > 0, null, { timeout: 120000, polling: 100 });
  const { title, fcp } = await page.evaluate(() => ({
    title: performance.getEntriesByName('dc-title')[0].startTime,
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
  }));
  await page.waitForTimeout(cond.net ? 6000 : 2000); // catch anything fetched right after the title
  await ctx.close();
  const list = [...reqs.values()].map((r) => ({
    ...r, s: Math.round((r.start - t0) * 1000), e: r.end ? Math.round((r.end - t0) * 1000) : null,
  }));
  const kb = (a) => Math.round(a.reduce((n, r) => n + (r.bytes || 0), 0) / 1024);
  return {
    fcp: Math.round(fcp), title: Math.round(title), requests: list.length, kb: kb(list),
    fonts: list.filter((r) => /\.(woff2?|ttf)(\?|$)/.test(r.url)),
  };
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
console.log(`| condition | first paint (ms) | title (ms) | requests | transfer (KB) |\n|---|---|---|---|---|`);
let fonts = [];
for (const cond of CONDS) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(await once(browser, cond));
  const m = (k) => median(runs.map((r) => r[k]));
  console.log(`| ${cond.name} | ${m('fcp')} | ${m('title')} | ${m('requests')} | ${m('kb')} |`);
  if (cond.name.startsWith('1.6')) fonts = runs[0].fonts;
}
await browser.close();
console.log('\nfonts on 1.6 Mbps (run 1):');
for (const f of fonts) console.log(`  ${f.url}  ${f.bytes} B  ${f.s} → ${f.e} ms`);
