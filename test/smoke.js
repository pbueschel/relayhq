/**
 * RelayHQ smoke gate.  Run: bun test/smoke.js
 *
 * Three jobs:
 *   1. The seed loads and is referentially intact — no id pointing at nothing.
 *   2. The design system's invariants hold (every entity hue exists, etc).
 *   3. CONTENT GUARDS that stop known bug classes creeping back in. The big one
 *      is interpolated Tailwind colour classes, which compile to nothing and
 *      shipped broken in v1.
 *
 * Real-browser rendering is a separate gate — see test/render-check.js.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

let pass = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  failures.push(name + (extra ? '  → ' + extra : ''));
}

/* ------------------------------------------------------------------ *
 * Walk sources
 * ------------------------------------------------------------------ */

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (['.js', '.jsx'].includes(extname(full))) out.push(full);
  }
  return out;
}

const files = walk(SRC).map(f => ({ path: f, rel: relative(ROOT, f), text: readFileSync(f, 'utf8') }));
ok('source files found', files.length > 10, `${files.length} files`);

/* ------------------------------------------------------------------ *
 * GUARD 1 — no interpolated Tailwind colour classes.
 *
 * `bg-${hue}-500` is invisible to Tailwind's scanner and renders unstyled.
 * v1 shipped exactly this in the asset editor. accents.js exists so nobody
 * needs to do it; this guard makes sure nobody does it anyway.
 * ------------------------------------------------------------------ */

const INTERPOLATED_CLASS = /\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|accent|decoration|placeholder)-\$\{/;
for (const f of files) {
  if (f.rel.endsWith('scripts/gen-accents.js')) continue;
  const hits = f.text.split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => INTERPOLATED_CLASS.test(line))
    // The guard's own regex and the doc comments that explain it are allowed.
    .filter(({ line }) => !/eslint|GUARD|never interpolate|do not interpolate/i.test(line));
  ok(`no interpolated colour class in ${f.rel}`, hits.length === 0,
    hits.map(h => `line ${h.n}: ${h.line.trim().slice(0, 90)}`).join(' | '));
}

/* ------------------------------------------------------------------ *
 * GUARD 2 — views must not hardcode greys; they theme through `t`.
 * ------------------------------------------------------------------ */

const RAW_GREY = /["'`\s](?:bg|text|border)-(?:gray|slate|zinc|neutral|stone)-\d{2,3}\b/;
for (const f of files) {
  // tokens.js and accents.js are where greys are ALLOWED to be spelled out.
  if (/src\/ds\/(tokens|accents)\.js$/.test(f.rel)) continue;
  const hits = f.text.split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => RAW_GREY.test(line) && !/^\s*(\/\/|\*)/.test(line));
  ok(`no hardcoded grey in ${f.rel}`, hits.length === 0,
    hits.slice(0, 3).map(h => `line ${h.n}: ${h.line.trim().slice(0, 80)}`).join(' | '));
}

/* ------------------------------------------------------------------ *
 * GUARD 3 — no <form> elements. A stray form submit navigates away and on
 * GitHub Pages that means a blank page.
 * ------------------------------------------------------------------ */

for (const f of files) {
  // Only JSX, not the doc comments that explain the rule.
  const codeLines = f.text.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l));
  ok(`no <form> element in ${f.rel}`, !/<form[\s>]/.test(codeLines.join('\n')));
}

/* ------------------------------------------------------------------ *
 * Design system invariants
 * ------------------------------------------------------------------ */

const { ACCENTS, ACCENT_HUES } = await import('../src/ds/accents.js');
const tokens = await import('../src/ds/tokens.js');

ok('accent map covers every declared hue', ACCENT_HUES.every(h => ACCENTS[h]));
ok('every accent answers every role', ACCENT_HUES.every(h => {
  const roles = Object.keys(ACCENTS[h]);
  return roles.length >= 10 && roles.every(r => ACCENTS[h][r].light && ACCENTS[h][r].dark);
}));

const entityHues = Object.entries(tokens.ENTITIES);
ok('entity registry is populated', entityHues.length >= 20, `${entityHues.length} entities`);
for (const [kind, meta] of entityHues) {
  ok(`entity ${kind} uses a real hue`, ACCENT_HUES.includes(meta.hue), meta.hue);
  ok(`entity ${kind} has a label`, !!meta.label);
}

for (const [key, meta] of Object.entries(tokens.STATUS)) {
  ok(`status ${key} uses a real hue`, ACCENT_HUES.includes(meta.hue), meta.hue);
  ok(`status ${key} has a group`, ['open', 'active', 'done', 'closed'].includes(meta.group), meta.group);
}

for (const [key, meta] of Object.entries(tokens.PRIORITY)) {
  ok(`priority ${key} uses a real hue`, ACCENT_HUES.includes(meta.hue));
}

// The thesis is encoded in the colour map: a lesson is a knowledge atom.
ok('lesson shares the knowledge hue (author-once thesis)',
  tokens.ENTITIES.lesson.hue === tokens.ENTITIES.article.hue,
  `${tokens.ENTITIES.lesson.hue} vs ${tokens.ENTITIES.article.hue}`);

ok('theme() answers both modes', !!tokens.theme(true).bg && !!tokens.theme(false).bg);
ok('light and dark differ', tokens.theme(true).bg !== tokens.theme(false).bg);

ok('avatarGradient is deterministic',
  tokens.avatarGradient('Alex Rivera') === tokens.avatarGradient('Alex Rivera'));
ok('initials handles one and two names',
  tokens.initials('Alex Rivera') === 'AR' && tokens.initials('Cher') === 'CH');

/* ------------------------------------------------------------------ *
 * Seed integrity
 * ------------------------------------------------------------------ */

const { buildSeed } = await import('../src/store/seed/index.js');
const { STATE_KEYS } = await import('../src/store/schema.js');
const seed = buildSeed();

for (const key of STATE_KEYS) {
  ok(`seed defines ${key}`, seed[key] !== undefined);
}

/* Ids must be unique WITHIN a collection. Across collections an id may legitimately
 * repeat: `directory` is a superset of `agents` — the same person, one record. */
const dupes = [];
for (const key of STATE_KEYS) {
  if (!Array.isArray(seed[key])) continue;
  const seen = new Set();
  for (const r of seed[key]) {
    if (!r || !r.id) continue;
    if (seen.has(r.id)) dupes.push(`${key}:${r.id}`);
    seen.add(r.id);
  }
}
ok('no duplicate ids within a collection', dupes.length === 0, dupes.slice(0, 5).join(', '));

/* The one cross-collection overlap we DO assert, because code relies on it. */
const agentIds = new Set((seed.agents || []).map(a => a.id));
const dirIds = new Set((seed.directory || []).map(p => p.id));
ok('every agent is in the directory',
  [...agentIds].every(id => dirIds.has(id)),
  [...agentIds].filter(id => !dirIds.has(id)).join(', '));

/* Referential integrity — every id that points somewhere must land. */
const knowledgeIds = new Set((seed.knowledge || []).map(k => k.id));
const subformIds = new Set((seed.subforms || []).map(s => s.id));
const queueIds = new Set((seed.queues || []).map(q => q.id));
const personIds = new Set((seed.directory || []).map(p => p.id));
const locationIds = new Set((seed.locations || []).map(l => l.id));

function walkCatalog(nodes, fn, trail = []) {
  for (const n of nodes || []) {
    fn(n, trail);
    if (n.children) walkCatalog(n.children, fn, [...trail, n.name]);
  }
}

const catalogProblems = [];
walkCatalog(seed.catalog, (n, trail) => {
  const where = [...trail, n.name].join(' › ');
  if (!['product', 'subcategory', 'item'].includes(n.type)) catalogProblems.push(`${where}: bad type ${n.type}`);
  if (n.type === 'item' && n.children) catalogProblems.push(`${where}: item has children (items are leaves)`);
  for (const id of n.knowledgeIds || []) if (!knowledgeIds.has(id)) catalogProblems.push(`${where}: dangling knowledgeId ${id}`);
  for (const id of n.subformIds || []) if (!subformIds.has(id)) catalogProblems.push(`${where}: dangling subformId ${id}`);
});
ok('catalog is well formed and its references resolve', catalogProblems.length === 0,
  catalogProblems.slice(0, 5).join(' | '));

const refProblems = [];
for (const sf of seed.subforms || []) {
  if (sf.routing?.queueId && !queueIds.has(sf.routing.queueId)) refProblems.push(`subform ${sf.id}: dangling queue ${sf.routing.queueId}`);
  if (!Array.isArray(sf.fields)) refProblems.push(`subform ${sf.id}: no fields array`);
}
for (const a of seed.assets || []) {
  if (a.locationId && !locationIds.has(a.locationId)) refProblems.push(`asset ${a.id}: dangling location ${a.locationId}`);
  if (a.assignedToId && !personIds.has(a.assignedToId)) refProblems.push(`asset ${a.id}: dangling person ${a.assignedToId}`);
}
for (const c of seed.courses || []) {
  for (const m of c.modules || []) {
    for (const l of m.lessonIds || []) {
      if (!knowledgeIds.has(l)) refProblems.push(`course ${c.id}: dangling lesson ${l}`);
    }
  }
}
ok('cross-collection references resolve', refProblems.length === 0, refProblems.slice(0, 6).join(' | '));

/* Guides must carry alt text — an image-only how-to with no alt is unusable
 * with a screen reader, and this product's pitch is visual instruction. */
const altProblems = [];
for (const k of seed.knowledge || []) {
  if (k.format !== 'guide') continue;
  for (const s of k.slides || []) {
    if (s.type === 'image' && !s.alt) altProblems.push(`${k.id}/${s.id}`);
  }
}
ok('every image slide has alt text', altProblems.length === 0, altProblems.slice(0, 5).join(', '));

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

if (failures.length) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error('  FAIL  ' + f);
  console.error(`\n${pass} passed, ${failures.length} failed\n`);
  process.exit(1);
}
console.log(`smoke: ${pass} passed`);
