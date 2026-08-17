/**
 * Real-browser render gate.  Run: bun test/render-check.js
 *
 * Builds are not enough: a build succeeds while a view throws on mount and the
 * user sees a blank page. This serves `dist/` over http, loads every route in
 * headless Chrome, waits for the app to signal it mounted, and asserts that
 * real content rendered and no junk leaked into the DOM.
 *
 * RUN THIS SUITE ALONE. A second headless Chrome started against the same
 * profile while this is working will hang the run mid-suite.
 *
 * Requires `bun run build` first. There is no `timeout` binary on macOS, so
 * every wait here is done with an explicit AbortSignal.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const BASE = '/relayhq/';

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ not found — run `bun run build` first.');
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * Locate Chrome
 * ------------------------------------------------------------------ */

const CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const CHROME = CANDIDATES.find(p => { try { return existsSync(p); } catch { return false; } });
if (!CHROME) {
  console.error('No Chrome found. Set CHROME_PATH, or install Chrome/Chromium.');
  console.error('Looked in:\n  ' + CANDIDATES.join('\n  '));
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * Serve dist
 * ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const server = Bun.serve({
  port: 0,
  fetch(req) {
    let path = new URL(req.url).pathname;
    if (path.startsWith(BASE)) path = path.slice(BASE.length - 1);
    if (path === '/' || path === '') path = '/index.html';
    const file = join(DIST, path);
    try {
      if (file.startsWith(DIST) && existsSync(file)) {
        return new Response(readFileSync(file), {
          headers: { 'content-type': MIME[extname(file)] || 'application/octet-stream' },
        });
      }
      // Anything Chrome asks for that we do not ship (favicon.ico, devtools
      // probes) is a 404 rather than a thrown error — otherwise the server
      // prints a stack trace that looks like a test failure.
      if (/\.(ico|png|map|json|txt)$/.test(path)) return new Response('', { status: 404 });
      // SPA fallback — hash routing means every route resolves to index.html.
      return new Response(readFileSync(join(DIST, 'index.html')), {
        headers: { 'content-type': 'text/html' },
      });
    } catch {
      return new Response('', { status: 404 });
    }
  },
});

const origin = `http://localhost:${server.port}${BASE}`;

/* ------------------------------------------------------------------ *
 * Drive Chrome
 * ------------------------------------------------------------------ */

function dumpDom(url, ms = 20000) {
  return new Promise((resolve) => {
    const args = [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
      // Chrome otherwise reaches out to Google for component updates and
      // optimisation hints. On a loaded machine those stall the run and print
      // SSL noise to stderr that looks like a page failure but is not.
      '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-background-networking', '--disable-component-update',
      '--disable-sync', '--metrics-recording-only', '--mute-audio',
      `--virtual-time-budget=${ms}`, '--dump-dom', url,
    ];
    const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, ms + 15000);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { err += d; });
    child.on('close', () => { clearTimeout(killer); resolve({ out, err }); });
    child.on('error', (e) => { clearTimeout(killer); resolve({ out: '', err: String(e) }); });
  });
}

/**
 * Load a route, retrying transient failures.
 *
 * `--virtual-time-budget` is a budget of *virtual* time, but Chrome still needs
 * real CPU to reach it. On a loaded machine a route can miss the budget and
 * report as unmounted when nothing is wrong. A flaky gate is worse than no gate
 * — people learn to re-run it — so a route only fails after it fails twice.
 */
async function checkRoute(route, expect) {
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { out, err } = await dumpDom(origin + route, attempt === 1 ? 20000 : 35000);

    if (!out) { last = `chrome produced no DOM  ${firstError(err)}`; continue; }

    const dom = out.replace(/<script\b[\s\S]*?<\/script>/g, '');

    if (!dom.includes('data-relayhq-ready')) { last = 'app never signalled ready (a view probably threw on mount)'; continue; }
    if (!dom.includes(expect)) {
      // A missing expectation is deterministic — retrying will not change it.
      return { ok: false, why: `expected to find: ${expect}` };
    }
    const junk = [...new Set(dom.match(JUNK) || [])];
    if (junk.length) return { ok: false, why: `rendered junk: ${junk.join(' ')}` };

    return { ok: true, attempts: attempt };
  }
  return { ok: false, why: `${last} (after 3 attempts)` };
}

function firstError(err) {
  const line = (err || '').split('\n').find(l => /ERROR|FATAL/.test(l)) || '';
  return line.slice(0, 120);
}

/**
 * Routes and a string that MUST appear once the route renders. The expectation
 * is deliberately content-bearing — asserting on a wrapper div would pass on a
 * blank screen.
 */
const ROUTES = [
  ['#/workspace',   'My Workspace'],
  ['#/projects',    'Projects'],
  ['#/approvals',   'Approvals'],
  ['#/changes',     'Changes'],
  ['#/problems',    'Problems'],
  ['#/catalog',     'Catalog'],
  ['#/knowledge',   'Knowledge'],
  ['#/learning',    'Learning'],
  ['#/forms',       'Forms'],
  ['#/rules',       'Business Rules'],
  ['#/automations', 'Automations'],
  ['#/assets',      'Assets'],
  ['#/portal',      'RelayHQ'],
  ['#/design',      'RelayHQ Design System'],
];

/* Junk that means a render went wrong. `NaN` and `[object Object]` are the
 * classic symptoms of a bad field reference; `${` means a template literal
 * reached the DOM unrendered. */
const JUNK = /undefined|NaN|\[object Object\]|\$\{/g;

let failed = 0;
console.log(`render-check: ${CHROME.split('/').pop()} → ${origin}\n`);

for (const [route, expect] of ROUTES) {
  const res = await checkRoute(route, expect);
  if (res.ok) {
    console.log(`ok    ${route}${res.attempts > 1 ? `  (attempt ${res.attempts})` : ''}`);
  } else {
    console.error(`FAIL  ${route}  → ${res.why}`);
    failed++;
  }
}

server.stop(true);

if (failed) {
  console.error(`\nrender-check: ${failed} of ${ROUTES.length} routes failed\n`);
  process.exit(1);
}
console.log(`\nrender-check: ${ROUTES.length} routes ok`);
