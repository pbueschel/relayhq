/**
 * Landing-page product shots.  Run: bun scripts/gen-shots.js
 *
 * The landing page used to draw its own approximations of the portal, the rules
 * table and the automation canvas — hand-built markup that looked like the app
 * and drifted from it every time the app changed. By the third design pass they
 * depicted a header, a list alignment and a portal home the product no longer
 * had. A pitch page that lies about the product is worse than one with no
 * pictures.
 *
 * So the shots are REAL, and generated. This drives headless Chrome over the
 * built app and writes public/shots/*.png. Regenerate after any visual change:
 *
 *     bun run build && bun scripts/gen-shots.js
 *
 * RUN IT ALONE, like render-check and width-check — a second headless Chrome
 * against the same profile hangs the run. There is no `timeout` binary on
 * macOS; this uses explicit kill timers.
 *
 * Both themes are captured because the landing page follows the reader's, and a
 * light screenshot on a dark page reads as a bug.
 */

import { existsSync, readFileSync, mkdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'public', 'shots');
const BASE = '/relayhq/';

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ not found — run `bun run build` first.');
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].filter(Boolean).find(p => { try { return existsSync(p); } catch { return false; } });
if (!CHROME) { console.error('No Chrome found. Set CHROME_PATH.'); process.exit(1); }

/* The theme is read from localStorage on boot, so it is seeded before the app's
 * own module runs rather than toggled afterwards — a toggle would be captured
 * mid-transition. */
const seed = (theme) => `<script>
try { localStorage.setItem('relayhq.theme.v1', '${theme}'); } catch (e) {}
/* Collapse the sidebar before the shot. It is React state, not storage, so it
 * has to be CLICKED — and a MutationObserver is the way to catch the control the
 * moment it mounts: under --virtual-time-budget a polling timer burns the whole
 * budget before React renders, and once the budget is spent a pending timer
 * never fires at all. The rail stays in frame at 64px, which keeps the shot
 * honest about the product's shape while giving the module the width. */
(function () {
  var done = false;
  function go() {
    if (done) return;
    var b = document.querySelector('[aria-label="Collapse sidebar"]');
    if (!b) return;
    done = true;
    obs.disconnect();
    b.click();
  }
  var obs = new MutationObserver(go);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  go();
})();
</script>`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.woff2': 'font/woff2',
};

let THEME = 'light';
const server = Bun.serve({
  port: 0,
  fetch(req) {
    let path = new URL(req.url).pathname;
    if (path.startsWith(BASE)) path = path.slice(BASE.length - 1);
    if (path === '/' || path === '') path = '/index.html';
    const file = join(DIST, path);
    try {
      if (path === '/index.html') {
        const raw = readFileSync(join(DIST, 'index.html'), 'utf8');
        return new Response(raw.replace('<script type="module"', seed(THEME) + '<script type="module"'),
          { headers: { 'content-type': 'text/html' } });
      }
      if (file.startsWith(DIST) && existsSync(file)) {
        return new Response(readFileSync(file),
          { headers: { 'content-type': MIME[extname(file)] || 'application/octet-stream' } });
      }
      if (/\.(ico|png|map|json|txt)$/.test(path)) return new Response('', { status: 404 });
      return new Response(readFileSync(join(DIST, 'index.html')), { headers: { 'content-type': 'text/html' } });
    } catch { return new Response('', { status: 404 }); }
  },
});
const origin = `http://localhost:${server.port}${BASE}`;

function capture(route, out, w, h, ms = 25000) {
  return new Promise((resolve) => {
    const args = [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
      '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-background-networking', '--disable-component-update', '--disable-sync',
      '--metrics-recording-only', '--mute-audio', '--hide-scrollbars',
      `--window-size=${w},${h}`, `--virtual-time-budget=${ms}`,
      `--screenshot=${out}`, origin + route,
    ];
    const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, ms + 15000);
    child.stdout.on('data', () => {});
    child.stderr.on('data', () => {});
    child.on('close', () => { clearTimeout(killer); resolve(existsSync(out)); });
    child.on('error', () => { clearTimeout(killer); resolve(false); });
  });
}

/** Downscale so a 2x display stays crisp without shipping a 2400px asset. */
function resize(file, width) {
  return new Promise((resolve) => {
    const p = spawn('sips', ['--resampleWidth', String(width), file], { stdio: 'ignore' });
    p.on('close', () => resolve());
    p.on('error', () => resolve());
  });
}

const SHOTS = [
  { id: 'portal', route: '#/portal', w: 1280, h: 860 },
  { id: 'rules', route: '#/rules', w: 1280, h: 860 },
  { id: 'automations', route: '#/automations', w: 1280, h: 860 },
];

console.log(`gen-shots: ${CHROME.split('/').pop()} → ${origin}\n`);
let failed = 0;

for (const theme of ['light', 'dark']) {
  THEME = theme;
  for (const s of SHOTS) {
    const out = join(OUT, `${s.id}-${theme}.png`);
    const ok = await capture(s.route, out, s.w, s.h);
    if (!ok) { console.error(`FAIL  ${s.id} ${theme}`); failed++; continue; }
    await resize(out, 1100);
    const kb = Math.round(statSync(out).size / 1024);
    console.log(`ok    ${s.id}-${theme}.png  ${kb} kB`);
  }
}

server.stop(true);
if (failed) { console.error(`\ngen-shots: ${failed} failed\n`); process.exit(1); }
console.log(`\ngen-shots: ${SHOTS.length * 2} shots written to public/shots/`);
