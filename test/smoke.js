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

/* The same bug wearing a different hat: a Tailwind VARIANT prefix concatenated
 * onto a class value at runtime — `'hover:' + t.text`, `'group-hover:' + c.fg`.
 * The scanner cannot see the result either, so the state silently never renders.
 * This escaped the check above twice, once in a view and once in the design
 * system itself, where a ViewSwitcher hover colour had never worked. */
const CONCATENATED_VARIANT = /['"`](?:group-)?(?:hover|focus|active|disabled|checked|peer-\w+|group-\w+|dark|sm|md|lg|xl):['"`]?\s*\+/;
for (const f of files) {
  if (f.rel.endsWith('scripts/gen-accents.js')) continue;
  const hits = f.text.split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => INTERPOLATED_CLASS.test(line) || CONCATENATED_VARIANT.test(line))
    // The guard's own regexes and the doc comments explaining them are allowed.
    .filter(({ line }) => !/eslint|GUARD|never interpolate|do not interpolate|assembled at runtime|NOT `/i.test(line))
    .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line));
  ok(`no runtime-built colour class in ${f.rel}`, hits.length === 0,
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
 * GUARD 4 — no component defined inside another component's body.
 *
 * An inner component is a NEW function identity on every parent render, so
 * React unmounts and remounts its whole subtree — losing focus, scroll and
 * local state. v1 was built entirely this way and it was the app's performance
 * ceiling. Components belong at module scope.
 *
 * Heuristic: an INDENTED declaration of a CamelCase name bound to a function.
 * `const Icon = item.icon` (aliasing an existing component) is not matched,
 * because the binding must be a function literal.
 * ------------------------------------------------------------------ */

const NESTED_COMPONENT =
  /^\s+(?:const\s+([A-Z][a-z]\w*)\s*=\s*(?:\(|function|React\.memo|memo\()|function\s+([A-Z][a-z]\w*)\s*\()/;

for (const f of files) {
  const hits = f.text.split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => NESTED_COMPONENT.test(line));
  ok(`no nested component definition in ${f.rel}`, hits.length === 0,
    hits.slice(0, 3).map(h => `line ${h.n}: ${h.line.trim().slice(0, 70)}`).join(' | '));
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

/* `catalogItemIds` must resolve to ITEMS, not products or subcategories.
 *
 * A product id here is not dangling — it exists — so a plain existence check
 * passes while the link is silently invisible everywhere that matches on items.
 * That is exactly the bug this catches: 34 asset links pointed at products and
 * nothing rendered them. The field name is the contract; enforce it. */
const catalogItemIds = new Set();
const catalogNodeIds = new Set();
walkCatalog(seed.catalog, (n) => {
  catalogNodeIds.add(n.id);
  if (n.type === 'item') catalogItemIds.add(n.id);
});

const wrongLevel = [];
for (const a of seed.assets || []) {
  for (const id of a.catalogItemIds || []) {
    if (catalogItemIds.has(id)) continue;
    wrongLevel.push(`${a.id} → ${id}${catalogNodeIds.has(id) ? ' (a product/subcategory, not an item)' : ' (dangling)'}`);
  }
}
ok('every asset catalogItemIds entry resolves to a catalog ITEM',
  wrongLevel.length === 0, wrongLevel.slice(0, 5).join(' | '));

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

/* ------------------------------------------------------------------ *
 * RULE 0 — the author-once invariant.
 *
 * The product thesis is that ONE authored knowledge atom serves deflection,
 * agent enablement and training simultaneously. That is only true if the seed
 * actually demonstrates it — a demo where every course lesson is its own
 * private article proves nothing, and the architecture would be pointless.
 *
 * So this is asserted, not hoped for. If a future change makes lessons private
 * copies again, this fails before it ships.
 * ------------------------------------------------------------------ */

const inCatalog = new Map();
walkCatalog(seed.catalog, (n, trail) => {
  for (const id of n.knowledgeIds || []) {
    if (!inCatalog.has(id)) inCatalog.set(id, []);
    inCatalog.get(id).push([...trail, n.name].join(' › '));
  }
});

const inCourses = new Map();
for (const c of seed.courses || []) {
  for (const m of c.modules || []) {
    // A lesson may be a bare knowledge id or a placement object carrying one.
    for (const l of m.lessonIds || m.lessons || []) {
      const id = typeof l === 'string' ? l : l?.knowledgeId;
      if (!id) continue;
      if (!inCourses.has(id)) inCourses.set(id, []);
      inCourses.get(id).push(c.id);
    }
  }
}

const dualPurpose = (seed.knowledge || []).filter(k => inCatalog.has(k.id) && inCourses.has(k.id));
const orphaned = (seed.knowledge || []).filter(k => !inCatalog.has(k.id) && !inCourses.has(k.id));

ok('knowledge atoms exist', (seed.knowledge || []).length >= 20, `${(seed.knowledge || []).length}`);
ok('most atoms serve BOTH deflection and training (the author-once thesis)',
  dualPurpose.length >= Math.floor((seed.knowledge || []).length * 0.5),
  `${dualPurpose.length} of ${(seed.knowledge || []).length} dual-purpose`);
ok('no knowledge atom is orphaned', orphaned.length === 0,
  orphaned.slice(0, 5).map(k => k.id).join(', '));

/* An atom reused across MORE THAN ONE catalog location is the specific thing
 * the nested v1 model made impossible. Assert at least a few exist. */
const multiPlaced = [...inCatalog.entries()].filter(([, places]) => places.length > 1);
ok('some atoms appear under more than one catalog item (impossible in v1)',
  multiPlaced.length >= 3, `${multiPlaced.length} multi-placed`);

/* ------------------------------------------------------------------ *
 * A DECLARED APPROVAL MUST ACTUALLY FIRE.
 *
 * A service item carrying `approvalPolicyId` is a promise that ordering it
 * needs a sign-off. Nothing enforced that promise, and 13 of 14 items were
 * quietly ordering with no approval at all — two separate causes, both
 * invisible: three intakes were forked copies of canonical subforms so
 * policies keying on the original id never matched, and spend policies tested
 * a MONTHLY figure against an annual threshold.
 *
 * A silently-skipped approval is the worst failure this product can have, so
 * it is asserted rather than trusted. This is the service-catalog counterpart
 * to Rule 0.
 * ------------------------------------------------------------------ */

const { matchingPolicies } = await import('../src/lib/approvals.js');
const { serviceRequestContext } = await import('../src/lib/servicerequest.js');

const deadApprovals = [];
for (const item of seed.serviceItems || []) {
  if (!item.approvalPolicyId) continue;

  const form = (seed.subforms || []).find(f => f.id === item.subformId);
  // Answer the form the way an ordinary requester would, so the context the
  // policy sees is the one the portal will actually build.
  const answers = { quantity: 1 };
  for (const f of form?.fields || []) {
    if (f.type === 'select' && f.options?.length) answers[f.id] = f.options[0];
    if (/level/i.test(f.id) || /level/i.test(f.label || '')) answers.accessLevel = 'admin';
  }

  const ctx = serviceRequestContext(item, answers,
    { id: 'usr-sam', department: 'Support' },
    { directory: seed.directory, queues: seed.queues });

  const matched = matchingPolicies(seed.approvalPolicies, ctx);
  if (!matched.some(p => p.id === item.approvalPolicyId)) {
    deadApprovals.push(`${item.id} declares ${item.approvalPolicyId} but it never matches`);
  }
}
ok('every service item that declares an approval actually triggers it',
  deadApprovals.length === 0, deadApprovals.slice(0, 6).join(' | '));

/* Every referenced policy, queue and subform on a service item must resolve. */
const policyIds = new Set((seed.approvalPolicies || []).map(p => p.id));
const svcCategoryIds = new Set((seed.serviceCategories || []).map(c => c.id));
const svcProblems = [];
for (const item of seed.serviceItems || []) {
  if (!svcCategoryIds.has(item.categoryId)) svcProblems.push(`${item.id}: dangling category ${item.categoryId}`);
  if (!subformIds.has(item.subformId)) svcProblems.push(`${item.id}: dangling subform ${item.subformId}`);
  if (!queueIds.has(item.fulfilmentQueueId)) svcProblems.push(`${item.id}: dangling queue ${item.fulfilmentQueueId}`);
  if (item.approvalPolicyId && !policyIds.has(item.approvalPolicyId)) svcProblems.push(`${item.id}: dangling policy ${item.approvalPolicyId}`);
  for (const k of item.knowledgeIds || []) {
    if (!knowledgeIds.has(k)) svcProblems.push(`${item.id}: dangling knowledge ${k}`);
  }
}
ok('service item references resolve', svcProblems.length === 0, svcProblems.slice(0, 6).join(' | '));

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
 * GUARD — the module header's shape is fixed, and every module shares it.
 *
 * The header used to be a single `flex-wrap` row carrying identity, the primary
 * action and every control at once, so it changed height with the window (56px
 * / 103px / 141px on Workspace) and — worse — changed height when you typed,
 * because `subsetLabel()` swaps a long subtitle for a short one and `truncate`
 * implies nowrap, so flexbox breaks against the full string.
 *
 * Neither gate could see any of that: smoke asserted nothing about the header,
 * and render-check drives a single 800x600 viewport, permanently BELOW the
 * reflow threshold, so the wrapped state was the only state it ever saw.
 *
 * These guards are cheap and they close the specific ways it can come back.
 * ------------------------------------------------------------------ */

/* These guards look for the ABSENCE of things, so they have to read code rather
 * than prose — a comment explaining why the header must not wrap contains the
 * word it is banning, and would fail the check it documents. */
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const dsHeader = files.find(f => f.rel.endsWith('src/ds/header.jsx'));
ok('ds/header.jsx found', !!dsHeader);

if (dsHeader) {
  const code = stripComments(dsHeader.text);
  /* A floor is what let the row grow. Fixed heights, or the shape is not fixed. */
  ok('module header rows have fixed heights, not minimums',
    !/min-h-\[/.test(code),
    'min-h- in header.jsx — a minimum height is what allowed the band to grow');

  /* flex-wrap in the header IS the reflow. */
  ok('module header never wraps',
    !/flex-wrap/.test(code),
    'flex-wrap in header.jsx — the band must shrink by scrolling, never by wrapping');

  /* A flex spacer centres against whatever flanks it, so the centred control
   * would slide every time the subtitle changed length. Equal grid tracks do not. */
  ok('module header centres its nav with equal grid tracks',
    /grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/.test(code),
    'row 1 must be a three-column grid, not a flex row with spacers');

  /* The filter bar scrolls, which clips absolutely-positioned children in both
   * axes. The filter menus must therefore be fixed, or they get sliced off. */
  ok('filter menus escape the filter bar\'s scroll clip',
    /className=\{cx\('fixed w-60/.test(code),
    'MultiSelectFilter panel must be `fixed`; an `absolute` panel is clipped by overflow-x-auto');
}

/* The legacy props and the components that fed them are gone. A view still
 * passing `tools` or `tray` renders a header with NO CONTROLS AT ALL rather
 * than an error, which is exactly the half-migrated state that would ship
 * green — so it has to fail here instead. */
const LEGACY_HEADER = /\b(tools|tray)=\{/;
for (const f of files) {
  if (!f.rel.startsWith('src/views/') && !f.rel.startsWith('src/components/')) continue;
  const m = stripComments(f.text).match(LEGACY_HEADER);
  ok(`no legacy header props in ${f.rel}`, !m, m && m[0]);
}
for (const f of files) {
  const m = stripComments(f.text).match(/\bFilter(Toggle|Tray)\b/);
  ok(`no FilterToggle/FilterTray in ${f.rel}`, !m, m && m[0]);
}

/* Every module opens with the same component. plan.md has declared this an
 * acceptance criterion since W8.2 and nothing has ever checked it. */
const VIEW_EXCEPTIONS = new Set(['src/views/Landing.jsx', 'src/views/Portal.jsx']);
for (const f of files) {
  if (!f.rel.startsWith('src/views/')) continue;
  if (VIEW_EXCEPTIONS.has(f.rel)) continue;
  ok(`${f.rel} uses ModuleHeader`, /<ModuleHeader/.test(f.text),
    'every module view opens with the shared header');
}

/* ------------------------------------------------------------------ *
 * GUARD — a frozen approval can answer its own policy.
 *
 * An approval freezes the facts it was raised with. If the policy's conditions
 * later start reading a different field, the frozen record can no longer answer
 * them, and the "why this approval exists" panel renders a RED FAILING rule on
 * an approval that is legitimately running — the screen contradicting itself.
 *
 * That is exactly what happened when `annualCost()` moved the spend policies
 * from `answers.amount` to `answers.annualAmount` and the two seeded spend
 * approvals kept the old key.
 * ------------------------------------------------------------------ */

const condFields = (where) => [
  ...(where?.rows || []).map(r => r.field),
  ...(where?.groups || []).flatMap(condFields),
].filter(Boolean);

for (const ap of seed.approvals || []) {
  const pol = (seed.approvalPolicies || []).find(p => p.id === ap.policyId);
  if (!pol) continue;
  const answers = ap.context?.answers || {};
  const unresolved = [...new Set(condFields(pol.appliesWhen))]
    .filter(f => f.startsWith('answers.'))
    .filter(f => answers[f.slice('answers.'.length)] === undefined);
  ok(`approval ${ap.id} can answer ${pol.id}`, unresolved.length === 0, unresolved.join(', '));
}

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
