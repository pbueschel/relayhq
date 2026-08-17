/**
 * Header shape gate.  Run: bun test/width-check.js
 *
 * WHY THIS EXISTS. The module header used to be one `flex-wrap` row carrying
 * identity, the primary action and every control at once. It changed height
 * with the window — 56px at 1728, 103px at 1400, 141px at 1024 on Workspace —
 * and it changed height WITHOUT the window moving, because `subsetLabel()`
 * swaps a long resting subtitle for "20 of 118 shown" the moment a filter is
 * set, and `truncate` implies `white-space: nowrap`, so flexbox breaks lines
 * against the full untruncated string.
 *
 * Neither existing gate could see any of it. smoke.js asserts nothing about
 * layout, and render-check.js never passes `--window-size`, so it runs at
 * Chrome's 800x600 default — permanently BELOW the reflow threshold. The
 * wrapped state was the only state it had ever seen. A bug that is invisible to
 * every gate comes back, so this one measures the thing directly: load each
 * route at a spread of widths and assert the header is the same height at all
 * of them.
 *
 * RUN THIS SUITE ALONE, like render-check — a second headless Chrome against
 * the same profile hangs the run. Requires `bun run build` first.
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
  process.exit(1);
}

/* ------------------------------------------------------------------ *
 * The probe
 *
 * Three things here are load-bearing, and each one cost a debugging round:
 *
 *  1. NO TIMERS. Under `--virtual-time-budget` a setTimeout chain advances the
 *     virtual clock while doing no real work, so a 50ms poll loop burns the
 *     whole budget in milliseconds of wall time and Chrome dumps the DOM before
 *     React has mounted. Worse, once the budget IS spent, a pending timer never
 *     fires at all — so a probe that waits politely reports nothing.
 *  2. The observer must DISCONNECT around its own write. Appending the result
 *     node is itself a mutation; left connected, the callback re-enters forever
 *     and starves the event loop, and the page never settles enough to dump.
 *  3. The marker is assembled at runtime. `--dump-dom` echoes this script's own
 *     source back out, so a literal marker matches the source before it matches
 *     the result.
 * ------------------------------------------------------------------ */

const PROBE = `
<script>
(function () {
  var HEAD = 'WIDTH' + '_JSON:', TAIL = ':END' + '_WIDTH';
  var out = null;

  function measure() {
    /* Measure the WHOLE header, both bands. ModuleHeader marks its root with
     * data-module-header for exactly this reason: walking up from the <h2>
     * instead stops at the first full-width ancestor, which is row 1, so the
     * gate would report a constant 52px and pass a filter bar that wrapped. */
    var band = document.querySelector('[data-module-header]');
    if (!band) return null;
    var h2 = band.querySelector('h2');
    if (!h2) return null;
    var r = band.getBoundingClientRect();

    // Distinct control rows, by clustering the tops of the band's own controls.
    var tops = [];
    var nodes = band.querySelectorAll('input, button, [role="tab"]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i].getBoundingClientRect();
      if (!n.width) continue;
      var top = Math.round(n.top);
      var seen = false;
      for (var j = 0; j < tops.length; j++) if (Math.abs(tops[j] - top) < 8) seen = true;
      if (!seen) tops.push(top);
    }
    return { w: window.innerWidth, h: Math.round(r.height), rows: tops.length, title: (h2.textContent || '').trim() };
  }

  function emit(data) {
    if (!out) { out = document.createElement('pre'); out.id = '__width__'; document.body.appendChild(out); }
    out.textContent = HEAD + JSON.stringify(data) + TAIL;
  }

  var OPTS = { childList: true, subtree: true, attributes: true };
  var obs, count = 0;
  function go() {
    if (count > 40) return;
    if (!document.documentElement.hasAttribute('data-relayhq-ready')) return;
    var m = measure();
    if (!m) return;
    count++;
    obs.disconnect();
    emit(m);
    obs.observe(document.documentElement, OPTS);
  }
  obs = new MutationObserver(go);
  obs.observe(document.documentElement, OPTS);
  go();
})();
</script>
`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const indexHtml = () => readFileSync(join(DIST, 'index.html'), 'utf8').replace('</body>', `${PROBE}</body>`);

const server = Bun.serve({
  port: 0,
  fetch(req) {
    let path = new URL(req.url).pathname;
    if (path.startsWith(BASE)) path = path.slice(BASE.length - 1);
    if (path === '/' || path === '') path = '/index.html';
    const file = join(DIST, path);
    try {
      if (path === '/index.html') return new Response(indexHtml(), { headers: { 'content-type': 'text/html' } });
      if (file.startsWith(DIST) && existsSync(file)) {
        return new Response(readFileSync(file), {
          headers: { 'content-type': MIME[extname(file)] || 'application/octet-stream' },
        });
      }
      if (/\.(ico|png|map|json|txt)$/.test(path)) return new Response('', { status: 404 });
      return new Response(indexHtml(), { headers: { 'content-type': 'text/html' } });
    } catch {
      return new Response('', { status: 404 });
    }
  },
});

const origin = `http://localhost:${server.port}${BASE}`;

/* There is no `timeout` binary on macOS, so every wait is an explicit kill timer. */
function dumpDom(url, width, ms) {
  return new Promise((resolve) => {
    const args = [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
      '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--disable-background-networking', '--disable-component-update',
      '--disable-sync', '--metrics-recording-only', '--mute-audio',
      `--window-size=${width},900`,
      `--virtual-time-budget=${ms}`, '--dump-dom', url,
    ];
    const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const killer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, ms + 15000);
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', () => {});
    child.on('close', () => { clearTimeout(killer); resolve(out); });
    child.on('error', () => { clearTimeout(killer); resolve(''); });
  });
}

/** A route can miss its virtual-time budget on a loaded machine; retry before failing. */
async function probe(route, width) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const dom = await dumpDom(origin + route, width, attempt === 1 ? 20000 : 35000);
    const m = dom.match(/WIDTH_JSON:([\s\S]*?):END_WIDTH/);
    if (m) { try { return JSON.parse(m[1]); } catch { /* retry */ } }
  }
  return null;
}

/* Chosen to straddle every threshold the old header wrapped at: the narrowest
 * usable pane, two laptop widths, and wide enough that the old bar unwrapped. */
const WIDTHS = [1024, 1280, 1440, 1728];
const ROUTES = ['#/workspace', '#/assets', '#/approvals', '#/knowledge'];

console.log(`width-check: ${CHROME.split('/').pop()} → ${origin}\n`);

let failed = 0;

for (const route of ROUTES) {
  const seen = [];
  for (const w of WIDTHS) {
    const r = await probe(route, w);
    if (!r) {
      console.error(`FAIL  ${route} @ ${w}px  → no measurement after 3 attempts`);
      failed++;
      continue;
    }
    seen.push(r);
  }
  if (seen.length < 2) continue;

  const heights = [...new Set(seen.map(r => r.h))];
  const rows = [...new Set(seen.map(r => r.rows))];
  const shape = seen.map(r => `${r.w}:${r.h}px/${r.rows}r`).join('  ');

  if (heights.length > 1) {
    console.error(`FAIL  ${route}  → header height changes with width: ${shape}`);
    failed++;
  } else if (rows.length > 1) {
    console.error(`FAIL  ${route}  → header control rows change with width: ${shape}`);
    failed++;
  } else {
    console.log(`ok    ${route}  ${seen[0].h}px, ${seen[0].rows} control row${seen[0].rows === 1 ? '' : 's'}, unchanged across ${WIDTHS.length} widths`);
  }
}

server.stop(true);

if (failed) {
  console.error(`\nwidth-check: ${failed} failure${failed === 1 ? '' : 's'} — the header changes shape with the window\n`);
  process.exit(1);
}
console.log(`\nwidth-check: ${ROUTES.length} routes hold their shape across ${WIDTHS.join(', ')}px`);
