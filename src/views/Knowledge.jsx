import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, LayoutGrid, Plus, Trash2, Play, Pause, ChevronUp, ChevronDown,
  Tag, Package, Folder, GraduationCap, Globe, Building2, Users, Eye, ThumbsUp, ThumbsDown,
  Clock, ListChecks, Bold, Italic, Underline, List, Heading3, Image as ImageIcon,
  Video, Type, AlertCircle, Check, ArrowLeft, Layers, Circle, Lock,
  Share2, X,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, ENTITIES, entityHue,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, EntityTag, Avatar,
  EmptyState, Card, Panel, GroupLabel, ListRow, Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, TileGroup,
  Modal, ConfirmDelete, Menu, MenuItem, MenuLabel,
  LensBar, ViewSwitcher, PageHeader, PageBody, Breadcrumbs,
  ModuleHeader, ScopedSearch, FilterBar, subsetLabel, optionCounts, passes,
} from '@/ds';
import { useStore, patchIn, addTo, removeFrom, uid, nowISO } from '@/store/store.js';
import { navigate } from '@/lib/router.js';

/**
 * Knowledge — where atoms are authored, and where their REUSE is visible.
 *
 * The knowledge atom is the most important record in RelayHQ. One authored
 * record serves three surfaces at once:
 *   · deflection  — the help centre article a customer hits before the form
 *   · enablement  — the reference an agent opens beside a ticket
 *   · training    — the lesson a course composes to teach a job function
 *
 * Nothing here duplicates content per surface. The catalog points at these ids
 * and courses point at the same ids, so this module computes "used in" from
 * state.catalog and state.courses rather than storing it. The reuse panel on
 * the detail screen is the single most important view in the module: it is what
 * proves the thesis to someone looking at the product for the first time.
 *
 * TWO EDITORS, ONE RECORD
 *   article — contentEditable rich text, DOM seeded ONCE through a ref guard and
 *             committed on blur. Re-syncing innerHTML on every keystroke resets
 *             the caret to the top of the node; that is the whole reason the
 *             editor is shaped like this.
 *   guide   — an ordered list of Stories-style slides with a live player.
 *             Image slides REQUIRE alt text; the smoke gate fails without it.
 */

/* ------------------------------------------------------------------ *
 * Vocabulary
 * ------------------------------------------------------------------ */

/** The lens: which slice of the library is on screen. Carried in the route. */
const LENSES = [
  { value: 'all',      label: 'All',      icon: Layers,     accent: 'blue' },
  { value: 'articles', label: 'Articles', icon: BookOpen,   accent: 'blue' },
  { value: 'guides',   label: 'Guides',   icon: LayoutGrid, accent: 'purple' },
  { value: 'drafts',   label: 'Drafts',   icon: Circle,     accent: 'gray' },
];
const LENS_VALUES = LENSES.map(l => l.value);

function inLens(atom, lens) {
  if (lens === 'articles') return atom.format === 'article';
  if (lens === 'guides') return atom.format === 'guide';
  if (lens === 'drafts') return atom.status === 'draft';
  return true;
}

const FORMATS = {
  article: { label: 'Article', icon: BookOpen,   hue: ENTITIES.article.hue, kind: 'article' },
  guide:   { label: 'Guide',   icon: LayoutGrid, hue: ENTITIES.guide.hue,   kind: 'guide' },
};
const fmt = (a) => FORMATS[a?.format] || FORMATS.article;

const AUDIENCES = {
  internal: { label: 'Internal',  hue: 'slate', icon: Building2, hint: 'Staff only — never served to customers' },
  external: { label: 'Customers', hue: 'green', icon: Globe,     hint: 'Customer help centre only' },
  both:     { label: 'Both',      hue: 'teal',  icon: Users,     hint: 'Staff and customers see the same atom' },
};
const aud = (a) => AUDIENCES[a?.audience] || AUDIENCES.internal;

/** Audience metadata for a bare audience key (catalog nodes carry one too). */
const audOf = (key) => AUDIENCES[key] || AUDIENCES.internal;

/**
 * Catalog node vocabulary, matching Catalog.jsx. A node's colour comes from the
 * ENTITIES registry so a catalog item is the same emerald here as it is there —
 * the reuse panel must not invent a second colour for a record it links to.
 */
const NODE_ICON = { product: Folder, subcategory: Layers, item: Circle };
const nodeIcon = (type) => NODE_ICON[type] || Package;

const STATUSES = [
  { value: 'draft',     label: 'Draft',     icon: Circle,   accent: 'gray' },
  { value: 'published', label: 'Published', icon: Check,    accent: 'emerald' },
  { value: 'archived',  label: 'Archived',  icon: Lock,     accent: 'slate' },
];

const SLIDE_TYPES = [
  { value: 'image', label: 'Image', icon: ImageIcon, accent: 'purple' },
  { value: 'video', label: 'Video', icon: Video,     accent: 'purple' },
  { value: 'text',  label: 'Text',  icon: Type,      accent: 'purple' },
];

const SECONDS_OPTIONS = [
  { value: '0',  label: 'Manual — reader taps' },
  { value: '3',  label: '3 seconds' },
  { value: '5',  label: '5 seconds' },
  { value: '7',  label: '7 seconds' },
  { value: '10', label: '10 seconds' },
  { value: '15', label: '15 seconds' },
];

const QUESTION_TYPES = [
  { value: 'single',  label: 'One answer',   icon: Circle,     accent: 'amber' },
  { value: 'multi',   label: 'Several',      icon: ListChecks, accent: 'amber' },
  { value: 'boolean', label: 'True / false', icon: Check,      accent: 'amber' },
];

/* ------------------------------------------------------------------ *
 * Reuse — computed, never stored
 * ------------------------------------------------------------------ */

function walkCatalog(nodes, fn, trail = []) {
  for (const n of nodes || []) {
    fn(n, trail);
    if (n.children) walkCatalog(n.children, fn, [...trail, n.name]);
  }
}

const EMPTY_REUSE = { catalog: [], courses: [] };

/**
 * atomId -> { catalog: [{id,name,path,type,audience}], courses: [{id,title,module,curriculum,audience}] }
 * Built once per catalog/course change and shared by every row.
 */
function buildReuseIndex(catalog, courses, curricula) {
  const index = new Map();
  const bucket = (id) => {
    let e = index.get(id);
    if (!e) { e = { catalog: [], courses: [] }; index.set(id, e); }
    return e;
  };

  walkCatalog(catalog, (node, trail) => {
    for (const kid of node.knowledgeIds || []) {
      bucket(kid).catalog.push({
        id: node.id,
        name: node.name,
        path: [...trail, node.name].join(' › '),
        type: node.type,
        audience: node.audience || 'internal',
      });
    }
  });

  const curriculumOf = new Map();
  for (const cur of curricula || []) {
    for (const cid of cur.courseIds || []) curriculumOf.set(cid, cur.title || cur.name);
  }

  for (const course of courses || []) {
    for (const mod of course.modules || []) {
      for (const lessonId of mod.lessonIds || []) {
        bucket(lessonId).courses.push({
          id: course.id,
          title: course.title || course.name || 'Untitled course',
          module: mod.title || mod.name || 'Module',
          curriculum: curriculumOf.get(course.id) || null,
          audience: course.audience || 'internal',
        });
      }
    }
  }
  return index;
}

/**
 * Where an atom is reused. A list, not a single value, because the whole point
 * is that one record can deflect on a catalog item AND teach in a course at the
 * same time — a single-valued filter could not express it.
 */
function reuseOf(atom, reuseIndex) {
  const r = reuseIndex.get(atom.id) || EMPTY_REUSE;
  const out = [];
  if (r.courses.length) out.push('course');
  if (r.catalog.length) out.push('catalog');
  return out.length ? out : ['unused'];
}

/** Why an atom is, or is not, reachable from the customer help centre. */
function externalState(atom, reuse) {
  const external = reuse.catalog.filter(c => c.audience === 'external' || c.audience === 'both');
  if (atom.status !== 'published') {
    return { live: false, hue: 'gray', headline: `Not published — status is ${atom.status}`, external };
  }
  if (atom.audience === 'internal') {
    return { live: false, hue: 'slate', headline: 'Internal audience — staff only', external };
  }
  if (!external.length) {
    return { live: false, hue: 'amber', headline: 'Published for customers, but nothing links to it', external };
  }
  return { live: true, hue: 'emerald', headline: `Live in the customer help centre`, external };
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

const helpfulPct = (a) => {
  const y = a.helpfulYes || 0, n = a.helpfulNo || 0;
  return y + n === 0 ? null : Math.round((y / (y + n)) * 100);
};

const shortDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const touch = (id, patch) => patchIn('knowledge', id, { ...patch, updatedAt: nowISO() });

const missingAlt = (atom) =>
  (atom.slides || []).filter(s => s.type === 'image' && !String(s.alt || '').trim());

/* ==================================================================== *
 * Entry point
 * ==================================================================== */

export default function Knowledge({ route }) {
  const { knowledge, catalog, courses, curricula, directory } = useStore(s => ({
    knowledge: s.knowledge || [],
    catalog: s.catalog || [],
    courses: s.courses || [],
    curricula: s.curricula || [],
    directory: s.directory || [],
  }));

  const reuseIndex = useMemo(
    () => buildReuseIndex(catalog, courses, curricula),
    [catalog, courses, curricula],
  );

  const people = useMemo(() => {
    const m = new Map();
    for (const p of directory) m.set(p.id, p);
    return m;
  }, [directory]);

  // The command palette links straight to an atom as #/knowledge/<id>, so the
  // second segment is either a tab name or a record id. Resolve both shapes.
  const tab = LENS_VALUES.includes(route?.sub) ? route.sub : 'all';
  const selectedId = route?.id || (LENS_VALUES.includes(route?.sub) ? null : route?.sub) || null;
  const atom = selectedId ? knowledge.find(k => k.id === selectedId) : null;

  if (selectedId && atom) {
    return (
      <AtomDetail
        key={atom.id}
        atom={atom}
        atoms={knowledge}
        reuse={reuseIndex.get(atom.id) || EMPTY_REUSE}
        people={people}
        directory={directory}
        tab={tab}
      />
    );
  }

  return (
    <Library
      atoms={knowledge}
      reuseIndex={reuseIndex}
      people={people}
      tab={tab}
      notFound={selectedId ? selectedId : null}
    />
  );
}

/* ==================================================================== *
 * Library
 * ==================================================================== */

function Library({ atoms, reuseIndex, people, tab, notFound }) {
  /* One header state: the multi-select filter values and the in-page query. There
   * is no tray flag any more — the filter bar is always on screen, so a filter can
   * never be active while its control is hidden. */
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState({});
  const [view, setView] = useState('list');
  const [creating, setCreating] = useState(false);
  const [playing, setPlaying] = useState(null);

  const activeFilters = Object.values(filters).reduce((n, v) => n + (v?.length || 0), 0);
  const clearFilters = () => { setFilters({}); setQ(''); };

  /* Everything except the lens — so the lens counts reflect the other filters. */
  const preLens = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return atoms.filter(a => {
      if (!passes(filters.audience, a.audience || 'internal')) return false;
      if (!passes(filters.status, a.status)) return false;
      if (!passes(filters.tags, a.tags || [])) return false;
      if (!passes(filters.reuse, reuseOf(a, reuseIndex))) return false;
      // Search layers ON TOP of the filters rather than replacing them.
      if (!needle) return true;
      return [a.title, a.summary, a.objective, ...(a.tags || [])]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(needle));
    });
  }, [atoms, filters, q, reuseIndex]);

  const filtered = useMemo(() => preLens.filter(a => inLens(a, tab)), [preLens, tab]);

  const lensItems = useMemo(
    () => LENSES.map(l => ({ ...l, count: preLens.filter(a => inLens(a, l.value)).length })),
    [preLens],
  );
  const lensCount = lensItems.find(l => l.value === tab)?.count ?? atoms.length;

  const reused = useMemo(
    () => atoms.filter(a => !reuseOf(a, reuseIndex).includes('unused')).length,
    [atoms, reuseIndex],
  );

  /* Counts are computed over the WHOLE library, not the filtered view, so an
   * option tells you how many atoms exist rather than how many survive the
   * filters you have already set — the latter reads as options vanishing. */
  const FILTER_DEFS = useMemo(() => {
    const byAudience = optionCounts(atoms, a => a.audience || 'internal');
    const byStatus = optionCounts(atoms, a => a.status);
    const byTag = optionCounts(atoms, a => a.tags || []);
    const byReuse = optionCounts(atoms, a => reuseOf(a, reuseIndex));
    return [
      {
        id: 'audience', label: 'Audience', icon: Users,
        options: Object.entries(AUDIENCES).map(([value, m]) => ({
          value, label: m.label, count: byAudience.get(value) || 0,
        })),
      },
      {
        id: 'status', label: 'Status', icon: Circle,
        options: STATUSES.map(s => ({ value: s.value, label: s.label, count: byStatus.get(s.value) || 0 })),
      },
      {
        id: 'tags', label: 'Tags', icon: Tag,
        options: [...byTag.entries()]
          .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
          .map(([value, n]) => ({ value, label: value, count: n })),
      },
      {
        id: 'reuse', label: 'Reuse', icon: Share2,
        options: [
          { value: 'course',  label: 'Used in a course',  count: byReuse.get('course') || 0 },
          { value: 'catalog', label: 'On a catalog item', count: byReuse.get('catalog') || 0 },
          { value: 'unused',  label: 'Unused',            count: byReuse.get('unused') || 0 },
        ],
      },
    ];
  }, [atoms, reuseIndex]);

  const narrowed = activeFilters > 0 || q.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ModuleHeader
        icon={BookOpen}
        module="knowledge"
        /* The hue comes from the entity map, never a literal: `article` and
         * `lesson` share it on purpose, and a hardcoded 'blue' here would drift
         * the moment that map moves. */
        accent={entityHue('article')}
        title="Knowledge"
        /* The subtitle always tells the truth about what is on screen: the
         * resting label when nothing narrows the library, "9 of 40 shown" when
         * the lens or a filter does. */
        subtitle={subsetLabel(
          filtered.length,
          atoms.length,
          `${atoms.length} atoms · ${reused} reused`,
        )}
        /* The lens is centred in row 1, between the module identity and the
         * primary action, so it holds still while either of them changes width. */
        nav={<LensBar items={lensItems} value={tab} onChange={v => navigate('knowledge', v)} inline />}
        primary={<Button variant="grad" module="knowledge" icon={Plus} onClick={() => setCreating(true)}>New atom</Button>}
        filterBar={
          <FilterBar
            accent="blue"
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onClearAll={clearFilters}
            search={
              <ScopedSearch
                value={q}
                onChange={setQ}
                /* Names its own scope, so it can never be mistaken for the global
                 * field in the bar above: "Search 41 atoms…" narrows to
                 * "Search 6 atoms…" the moment the lens moves to Drafts. */
                scope={`${lensCount} atoms`}
                accent="blue"
              />
            }
          />
        }
      />

      <PageBody width="max-w-6xl">
        <div className="space-y-4">
          {notFound && (
            <Banner accent="amber" icon={AlertCircle} title="That atom no longer exists">
              Nothing in the library has the id <code>{notFound}</code>.
            </Banner>
          )}

          {/* The reuse map redraws the SAME atoms as a table, so it sits with the
              content it redraws. The header carries the lens, the scoped search
              and the filters, and nothing else. */}
          <ViewSwitcher
            inline
            value={view}
            onChange={setView}
            items={[
              { value: 'list', label: 'Library', icon: BookOpen },
              { value: 'reuse', label: 'Reuse map', icon: Share2 },
            ]}
          />

          {view === 'reuse' ? (
            <ReuseMap atoms={filtered} reuseIndex={reuseIndex} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={narrowed ? 'No atoms match those filters' : 'No knowledge atoms yet'}
              action={narrowed
                ? <Button variant="soft" accent="blue" onClick={clearFilters}>Clear filters</Button>
                : <Button variant="grad" module="knowledge" icon={Plus} onClick={() => setCreating(true)}>New atom</Button>}
            />
          ) : (
            <div className={cx(DENSITY.rowGap, '@container')}>
              {filtered.map(a => (
                <AtomRow
                  key={a.id}
                  atom={a}
                  reuse={reuseIndex.get(a.id) || EMPTY_REUSE}
                  owner={people.get(a.ownerId)?.name || 'Unassigned'}
                  tab={tab}
                  onPreview={() => setPlaying(a)}
                />
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <PreviewModal atom={playing} onClose={() => setPlaying(null)} />
      <NewAtomModal open={creating} onClose={() => setCreating(false)} tab={tab} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AtomRow({ atom, reuse, owner, tab, onPreview }) {
  const { t } = useTheme();
  const f = fmt(atom);
  const au = aud(atom);
  const pct = helpfulPct(atom);
  const linked = reuse.catalog.length + reuse.courses.length;
  const altGaps = missingAlt(atom).length;

  return (
    <ListRow
      accent={f.hue}
      icon={f.icon}
      title={atom.title}
      subtitle={atom.summary}
      onClick={() => navigate('knowledge', tab, atom.id)}
      alert={altGaps > 0}
      meta={
        <>
          <span className={cx('text-[11px] tabular-nums hidden @2xl:inline', t.textMuted)}
            title={`${atom.views || 0} views · ${atom.helpfulYes || 0} found it helpful`}>
            {(atom.views || 0).toLocaleString()} views{pct != null ? ` · ${pct}%` : ''}
          </span>
          <Chip accent="indigo" icon={Clock}>{atom.minutes || 0} min</Chip>
          <StatusPill status={atom.status} />
          <Avatar name={owner} size="sm" />
        </>
      }
      actions={
        <IconButton
          icon={Play}
          label={atom.format === 'guide' ? 'Play guide' : 'Read as a customer'}
          accent={f.hue}
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
        />
      }
    >
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        <Chip accent={au.hue} icon={au.icon} title={au.hint}>{au.label}</Chip>
        <ChipGroup items={atom.tags || []} accent="blue" icon={Tag} max={3} />
        <Divider vertical className="h-4" />
        <ChipGroup items={reuse.catalog} render={c => c.name} accent="amber" icon={Package} max={2}
          empty={linked === 0 ? <Chip accent="gray" icon={AlertCircle} title="No catalog item and no course references this atom">Not linked anywhere</Chip> : null} />
        <ChipGroup items={reuse.courses} render={c => c.title} accent="indigo" icon={GraduationCap} max={2} />
        {altGaps > 0 && <Chip accent="red" icon={AlertCircle}>{altGaps} slide{altGaps === 1 ? '' : 's'} missing alt text</Chip>}
      </div>
    </ListRow>
  );
}

/* ------------------------------------------------------------------ *
 * Reuse map — the whole library as one table, because the thesis is easier
 * to believe as a column than as a sentence.
 * ------------------------------------------------------------------ */

function ReuseMap({ atoms, reuseIndex }) {
  const { t, a } = useTheme();
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-left text-xs min-w-[52rem]">
        <thead>
          <tr className={cx('border-b', t.border)}>
            {['Atom', 'Help centre (catalog)', 'Courses', 'Audience', 'Status'].map(h => (
              <th key={h} className={cx('px-3 py-2 font-semibold', t.textMuted)}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {atoms.map(a => {
            const r = reuseIndex.get(a.id) || EMPTY_REUSE;
            const f = fmt(a);
            const au = aud(a);
            return (
              <tr key={a.id} className={cx('border-b last:border-0', t.borderLight, t.bgHover, 'cursor-pointer')}
                onClick={() => navigate('knowledge', 'all', a.id)}>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <f.icon size={ICON.sm} className={cx('flex-shrink-0', a(f.hue).fg)} />
                    <span className={cx('font-medium truncate max-w-[16rem]', t.text)}>{a.title}</span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <ChipGroup items={r.catalog} render={c => c.name} accent="amber" icon={Package} max={2}
                    empty={<span className={t.textMuted}>—</span>} />
                </td>
                <td className="px-3 py-2">
                  <ChipGroup items={r.courses} render={c => c.title} accent="indigo" icon={GraduationCap} max={2}
                    empty={<span className={t.textMuted}>—</span>} />
                </td>
                <td className="px-3 py-2"><Chip accent={au.hue} icon={au.icon}>{au.label}</Chip></td>
                <td className="px-3 py-2"><StatusPill status={a.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

/* ==================================================================== *
 * Detail
 * ==================================================================== */

function AtomDetail({ atom, atoms, reuse, people, directory, tab }) {
  const { t } = useTheme();
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const f = fmt(atom);
  const ext = externalState(atom, reuse);
  const altGaps = missingAlt(atom);
  const linked = reuse.catalog.length + reuse.courses.length;
  const owner = people.get(atom.ownerId)?.name || 'Unassigned';

  const draftInCourse = atom.status !== 'published' && reuse.courses.length > 0;
  const internalButPublic = atom.audience === 'internal'
    && reuse.catalog.some(c => c.audience === 'external' || c.audience === 'both');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={f.icon}
        module="knowledge"
        accent={f.hue}
        title={atom.title}
        subtitle={atom.summary}
        actions={
          <>
            <Button variant="outline" icon={ArrowLeft} onClick={() => navigate('knowledge', tab)}>Library</Button>
            <Button variant="soft" accent={f.hue} icon={Play} onClick={() => setPreview(true)}>
              {atom.format === 'guide' ? 'Play' : 'Read'}
            </Button>
            {atom.status === 'published'
              ? <Button variant="outline" icon={Lock} onClick={() => touch(atom.id, { status: 'draft' })}>Unpublish</Button>
              : <Button variant="solid" accent="emerald" icon={Check} onClick={() => touch(atom.id, { status: 'published' })}>Publish</Button>}
            <IconButton icon={Trash2} label="Delete atom" accent="red" onClick={() => setConfirming(true)} />
          </>
        }
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Breadcrumbs
            items={[
              { id: 'lib', name: 'Knowledge' },
              { id: 'tab', name: LENSES.find(x => x.value === tab)?.label || 'All' },
              { id: atom.id, name: atom.title },
            ]}
            onNavigate={(item) => navigate('knowledge', item.id === 'lib' ? 'all' : tab)}
          />
          <div className="flex items-center gap-2 flex-wrap">
            <EntityTag kind={f.kind} />
            <StatusPill status={atom.status} />
            <Chip accent={aud(atom).hue} icon={aud(atom).icon}>{aud(atom).label}</Chip>
            <Chip accent="indigo" icon={Clock}>{atom.minutes || 0} min</Chip>
            <Avatar name={owner} size="sm" />
          </div>
        </div>
      </PageHeader>

      <PageBody width="max-w-6xl">
        <div className="space-y-4">
          {altGaps.length > 0 && (
            <Banner accent="red" icon={AlertCircle} title={`${altGaps.length} image slide${altGaps.length === 1 ? '' : 's'} without alt text`}>
              Fix: {altGaps.map(s => s.heading || 'untitled slide').join(', ')}.
            </Banner>
          )}
          {draftInCourse && (
            <Banner accent="amber" icon={AlertCircle} title="A course includes this atom, but it is not published">
              {reuse.courses.map(c => c.title).join(', ')} reference{reuse.courses.length === 1 ? 's' : ''} this lesson.
            </Banner>
          )}
          {internalButPublic && (
            <Banner accent="amber" icon={AlertCircle} title="Linked from a customer-facing catalog item">
              Audience is <strong>Internal</strong>.
            </Banner>
          )}

          <ReusePanel atom={atom} reuse={reuse} ext={ext} linked={linked} />

          <div className="@container">
            <div className="grid grid-cols-1 @3xl:grid-cols-3 gap-4 items-start">
              <div className="@3xl:col-span-2 space-y-4">
                {atom.format === 'guide'
                  ? <GuideEditor atom={atom} />
                  : <ArticleEditor atom={atom} />}
                <LessonSection atom={atom} atoms={atoms} />
              </div>
              <div className="space-y-4">
                <PropertiesPanel atom={atom} directory={directory} />
                <StatsPanel atom={atom} owner={owner} />
              </div>
            </div>
          </div>
        </div>
      </PageBody>

      <PreviewModal atom={preview ? atom : null} onClose={() => setPreview(false)} />

      <ConfirmDelete
        open={confirming}
        name={atom.title}
        kind="knowledge atom"
        cascadeNote={linked
          ? `Referenced by ${reuse.catalog.length} catalog item(s) and ${reuse.courses.length} course lesson slot(s): ${[...reuse.catalog.map(c => c.name), ...reuse.courses.map(c => c.title)].join(', ')}.`
          : 'Nothing references this atom.'}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { removeFrom('knowledge', atom.id); navigate('knowledge', tab); }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * THE REUSE PANEL — the screen that proves the thesis.
 * ------------------------------------------------------------------ */

function ReusePanel({ atom, reuse, ext, linked }) {
  const { t, a } = useTheme();
  const c = a('indigo');

  return (
    <Card className="overflow-hidden @container">
      <div className={cx(DENSITY.cardPad, 'flex items-start justify-between gap-3 border-b', t.borderLight, c.soft)}>
        <div className="flex items-center gap-3 min-w-0">
          <IconTile icon={Share2} accent="indigo" size="lg" />
          <div className="min-w-0">
            <h3 className={cx('text-base font-semibold', t.text)}>
              {linked === 0
                ? 'This atom is not used anywhere yet'
                : `This atom appears in ${linked} place${linked === 1 ? '' : 's'}`}
            </h3>
          </div>
        </div>
        <div className="hidden @xl:flex items-center gap-2 flex-shrink-0">
          <ChipGroup items={reuse.catalog} render={c => c.name} accent="amber" icon={Package} max={1}
            empty={<Chip accent="gray" icon={Package}>No catalog item</Chip>} />
          <ChipGroup items={reuse.courses} render={c => c.title} accent="indigo" icon={GraduationCap} max={1}
            empty={<Chip accent="gray" icon={GraduationCap}>No course</Chip>} />
        </div>
      </div>

      <div>
        <div className={cx('grid grid-cols-1 @2xl:grid-cols-3 divide-y @2xl:divide-y-0 @2xl:divide-x', t.divide)}>
          {/* Deflection */}
          <ReuseColumn
            icon={Package} accent="amber" title="Deflection"
            empty="No catalog item links to this atom."
            rows={reuse.catalog.map(node => ({
              id: node.id,
              title: node.name,
              subtitle: node.path,
              // The row wears the catalog node's own entity colour and icon.
              accent: entityHue(node.type),
              icon: nodeIcon(node.type),
              meta: (
                <Chip accent={audOf(node.audience).hue} icon={audOf(node.audience).icon}>
                  {audOf(node.audience).label}
                </Chip>
              ),
              // Catalog reads the node id from the THIRD segment (#/catalog/node/<id>).
              // Passing null for `sub` collapses the href and lands the id in `sub`,
              // where Catalog never looks — the link silently opened the first item.
              go: () => navigate('catalog', 'node', node.id),
            }))}
          />

          {/* Training */}
          <ReuseColumn
            icon={GraduationCap} accent="indigo" title="Training"
            empty="No course uses this atom as a lesson yet."
            rows={reuse.courses.map((c, i) => ({
              id: `${c.id}-${i}`,
              title: c.title,
              subtitle: c.curriculum ? `${c.curriculum} › ${c.module}` : c.module,
              meta: <Chip accent="blue" icon={BookOpen}>Lesson</Chip>,
              go: () => navigate('learning', 'courses', c.id),
            }))}
          />

          {/* Publication */}
          <div className={DENSITY.cardPad}>
            <div className="flex items-center gap-2 mb-2">
              <IconTile icon={Globe} accent={ext.hue} size="sm" />
              <div className="min-w-0">
                <p className={cx('text-sm font-medium', t.text)}>Published externally</p>
              </div>
            </div>
            <Banner accent={ext.hue} icon={ext.live ? Check : AlertCircle} title={ext.headline} />
            {ext.external.length > 0 && (
              <div className="mt-2 space-y-1">
                <GroupLabel>Reachable from</GroupLabel>
                <div className="flex flex-wrap gap-1">
                  {ext.external.map(c => <Chip key={c.id} accent="green" icon={Package} title={c.path}>{c.name}</Chip>)}
                </div>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Button size="xs" variant="soft" accent="purple" icon={Globe} onClick={() => navigate('portal')}>
                Open customer portal
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ReuseColumn({ icon: Icon, accent, title, rows, empty }) {
  const { t } = useTheme();
  return (
    <div className={DENSITY.cardPad}>
      <div className="flex items-center gap-2 mb-2">
        <IconTile icon={Icon} accent={accent} size="sm" />
        <div className="min-w-0">
          <p className={cx('text-sm font-medium', t.text)}>{title}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className={cx('text-xs leading-relaxed', t.textMuted)}>{empty}</p>
      ) : (
        <div className={DENSITY.rowGap}>
          {rows.map(r => (
            <ListRow key={r.id} accent={r.accent || accent} icon={r.icon} title={r.title}
              subtitle={r.subtitle} meta={r.meta} onClick={r.go} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Properties + stats rail
 * ------------------------------------------------------------------ */

function PropertiesPanel({ atom, directory }) {
  const { t } = useTheme();
  const [tagDraft, setTagDraft] = useState('');
  const f = fmt(atom);

  const addTag = () => {
    const v = tagDraft.trim().toLowerCase();
    if (!v || (atom.tags || []).includes(v)) { setTagDraft(''); return; }
    touch(atom.id, { tags: [...(atom.tags || []), v] });
    setTagDraft('');
  };

  return (
    <Panel icon={Layers} accent={f.hue} title="Properties" subtitle={`${f.label} · ${atom.id}`}>
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Field label="Title" required>
          <Input value={atom.title} accent={f.hue} onChange={e => touch(atom.id, { title: e.target.value })} />
        </Field>
        <Field label="Summary" hint="One sentence.">
          <Textarea rows={2} value={atom.summary || ''} accent={f.hue}
            onChange={e => touch(atom.id, { summary: e.target.value })} />
        </Field>
        <Field label="Audience" hint={aud(atom).hint}>
          <TileGroup
            value={atom.audience} onChange={v => touch(atom.id, { audience: v })} columns={3}
            options={Object.entries(AUDIENCES).map(([value, m]) => ({ value, label: m.label, icon: m.icon, accent: m.hue }))}
          />
        </Field>
        <Field label="Status">
          <TileGroup
            value={atom.status} onChange={v => touch(atom.id, { status: v })} columns={3}
            options={STATUSES.map(s => ({ value: s.value, label: s.label, icon: s.icon, accent: s.accent }))}
          />
        </Field>
        <Field label="Owner">
          <Select value={atom.ownerId || ''} accent={f.hue} placeholder="Unassigned"
            onChange={e => touch(atom.id, { ownerId: e.target.value })}
            options={directory.map(p => ({ value: p.id, label: `${p.name} — ${p.title}` }))} />
        </Field>
        <Field label="Tags">
          <div className="flex flex-wrap gap-1 mb-2">
            {(atom.tags || []).map(tg => (
              <Chip key={tg} accent="blue" icon={Tag}
                onRemove={() => touch(atom.id, { tags: (atom.tags || []).filter(x => x !== tg) })}>{tg}</Chip>
            ))}
            {(atom.tags || []).length === 0 && <span className={cx('text-xs', t.textMuted)}>No tags yet</span>}
          </div>
          <div className="flex gap-2">
            <Input value={tagDraft} accent="blue" placeholder="Add a tag…"
              onChange={e => setTagDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
            <Button variant="soft" accent="blue" icon={Plus} onClick={addTag}>Add</Button>
          </div>
        </Field>
      </div>
    </Panel>
  );
}

function StatsPanel({ atom, owner }) {
  const { t, a } = useTheme();
  const pct = helpfulPct(atom);
  const rows = [
    { icon: Eye, label: 'Views', value: (atom.views || 0).toLocaleString(), accent: 'blue' },
    { icon: ThumbsUp, label: 'Found it helpful', value: (atom.helpfulYes || 0).toLocaleString(), accent: 'emerald' },
    { icon: ThumbsDown, label: 'Did not', value: (atom.helpfulNo || 0).toLocaleString(), accent: 'orange' },
    { icon: Clock, label: 'Last updated', value: shortDate(atom.updatedAt), accent: 'slate' },
  ];
  return (
    <Panel icon={Eye} accent="blue" title="Feedback" subtitle="Read-only">
      <div className={cx(DENSITY.cardPad, 'space-y-2')}>
        {pct != null && (
          <div className={cx('rounded-lg p-3 border', t.bgSubtle, t.borderLight)}>
            <div className="flex items-baseline justify-between">
              <span className={cx('text-2xl font-semibold tabular-nums', t.text)}>{pct}%</span>
              <span className={cx('text-xs', t.textMuted)}>helpful</span>
            </div>
            <div className={cx('mt-2 h-1.5 rounded-full overflow-hidden', t.bgCard)}>
              <div className={cx('h-full', a('emerald').solid)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
        <div className={cx('divide-y', t.divide)}>
          {rows.map(r => (
            <div key={r.label} className="flex items-center gap-2 py-2">
              <r.icon size={ICON.base} className={t.textMuted} />
              <span className={cx('text-xs flex-1', t.textSecondary)}>{r.label}</span>
              <span className={cx('text-xs font-medium tabular-nums', t.text)}>{r.value}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 py-2">
            <Avatar name={owner} size="sm" />
            <span className={cx('text-xs flex-1', t.textSecondary)}>Owner</span>
            <span className={cx('text-xs font-medium', t.text)}>{owner}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ==================================================================== *
 * Rich text
 *
 * THE CONSTRAINT THAT SHAPES THIS COMPONENT: a contentEditable node whose
 * innerHTML is re-assigned on every render loses the caret to the start of the
 * node on every keystroke. So the DOM is seeded exactly ONCE behind a ref guard
 * and the value is committed back to the store on blur. Callers pass a `key`
 * tied to the record id, which is what makes switching records still work.
 * ==================================================================== */

function RichText({ value, onCommit, placeholder = 'Write…', minHeight = 'min-h-[10rem]', accent = 'blue' }) {
  const { t, a } = useTheme();
  const c = a(accent);
  const ref = useRef(null);
  const seeded = useRef(false);
  const [marks, setMarks] = useState({});

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    if (ref.current) ref.current.innerHTML = value || '';
  }, [value]);

  const sync = useCallback(() => {
    try {
      setMarks({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        bullet: document.queryCommandState('insertUnorderedList'),
        heading: /h3/i.test(document.queryCommandValue('formatBlock') || ''),
      });
    } catch { /* queryCommandState is unavailable in some engines; toolbar just stays neutral */ }
  }, []);

  const run = useCallback((cmd, arg) => {
    if (ref.current) ref.current.focus();
    try { document.execCommand(cmd, false, arg); } catch { /* unsupported command */ }
    sync();
  }, [sync]);

  const commit = () => onCommit(ref.current ? ref.current.innerHTML : '');

  const tools = [
    { id: 'bold', icon: Bold, label: 'Bold', on: marks.bold, run: () => run('bold') },
    { id: 'italic', icon: Italic, label: 'Italic', on: marks.italic, run: () => run('italic') },
    { id: 'underline', icon: Underline, label: 'Underline', on: marks.underline, run: () => run('underline') },
    { id: 'bullet', icon: List, label: 'Bullet list', on: marks.bullet, run: () => run('insertUnorderedList') },
    { id: 'heading', icon: Heading3, label: 'Heading', on: marks.heading, run: () => run('formatBlock', marks.heading ? 'p' : 'h3') },
  ];

  return (
    <div className={cx('rounded-xl border overflow-hidden', t.bgInput, t.borderLight)}>
      <div className={cx('flex items-center gap-0.5 px-1.5 py-1 border-b', t.borderLight, t.bgSubtle)}>
        {tools.map(tool => (
          <IconButton
            key={tool.id}
            icon={tool.icon}
            label={tool.label}
            size={ICON.base}
            accent={tool.on ? accent : undefined}
            className={tool.on ? c.softStrong : undefined}
            onMouseDown={e => e.preventDefault()}
            onClick={tool.run}
          />
        ))}
        <span className={cx('ml-auto text-[10px] pr-1.5', t.textMuted)}>Saves when you click away</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onBlur={commit}
        onKeyUp={sync}
        onMouseUp={sync}
        onFocus={sync}
        className={cx('rhq-prose px-3 py-2.5 text-sm leading-relaxed outline-none overflow-auto',
          minHeight, t.text, 'focus:ring-0')}
      />
    </div>
  );
}

/* ==================================================================== *
 * Article editor
 * ==================================================================== */

function ArticleEditor({ atom }) {
  return (
    <Panel
      icon={BookOpen}
      accent="blue"
      title="Article body"
      action={<Chip accent="blue" icon={Type}>{Math.max(1, Math.round(String(atom.body || '').replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length))} words</Chip>}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <RichText
          key={atom.id}
          value={atom.body}
          accent="blue"
          minHeight="min-h-[20rem]"
          placeholder="Start with the answer, then the why, then what happens next…"
          onCommit={html => touch(atom.id, { body: html })}
        />
      </div>
    </Panel>
  );
}

/* ==================================================================== *
 * Guide editor — the Instagram-style format
 * ==================================================================== */

function GuideEditor({ atom }) {
  const slides = atom.slides || [];
  const [openId, setOpenId] = useState(slides[0]?.id || null);

  const setSlides = (next) => touch(atom.id, { slides: next });

  const patchSlide = (id, patch) =>
    setSlides(slides.map(s => (s.id === id ? { ...s, ...patch } : s)));

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    setSlides(next);
  };

  const addSlide = () => {
    const s = {
      id: uid('sl'),
      type: 'image',
      url: 'https://picsum.photos/seed/relay-new-slide/540/960',
      heading: 'New slide',
      caption: '',
      seconds: 5,
      alt: '',
    };
    setSlides([...slides, s]);
    setOpenId(s.id);
  };

  const removeSlide = (id) => {
    const next = slides.filter(s => s.id !== id);
    setSlides(next);
    if (openId === id) setOpenId(next[0]?.id || null);
  };

  const activeIndex = Math.max(0, slides.findIndex(s => s.id === openId));

  return (
    <Panel
      icon={LayoutGrid}
      accent="purple"
      title="Slides"
      subtitle={`${slides.length} slide${slides.length === 1 ? '' : 's'}`}
      action={<Button size="sm" variant="soft" accent="purple" icon={Plus} onClick={addSlide}>Add slide</Button>}
    >
      <div className={cx(DENSITY.cardPad, '@container')}>
        <div className="grid grid-cols-1 @2xl:grid-cols-[minmax(0,1fr)_13rem] gap-4 items-start">
          <div className="space-y-2 min-w-0">
            {slides.length === 0 ? (
              <EmptyState icon={LayoutGrid} title="No slides yet"
                action={<Button variant="solid" accent="purple" icon={Plus} onClick={addSlide}>Add the first slide</Button>} />
            ) : slides.map((s, i) => (
              <SlideCard
                key={s.id}
                slide={s}
                index={i}
                total={slides.length}
                open={s.id === openId}
                onToggle={() => setOpenId(s.id === openId ? null : s.id)}
                onPatch={patch => patchSlide(s.id, patch)}
                onMove={delta => move(i, delta)}
                onRemove={() => removeSlide(s.id)}
              />
            ))}
          </div>

          <div className="@2xl:sticky @2xl:top-0">
            <GroupLabel className="mb-1.5">Live preview</GroupLabel>
            <StoriesPlayer key={`${atom.id}:${openId || 'none'}`} slides={slides} startAt={activeIndex} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SlideCard({ slide, index, total, open, onToggle, onPatch, onMove, onRemove }) {
  const { t, a } = useTheme();
  const c = a('purple');
  const TypeIcon = SLIDE_TYPES.find(x => x.value === slide.type)?.icon || ImageIcon;
  const altMissing = slide.type === 'image' && !String(slide.alt || '').trim();

  // The border carries three states, so it is chosen once rather than layered —
  // two competing border-colour utilities on one element resolve by stylesheet
  // order, which is not something a caller should be relying on.
  return (
    <div className={cx('rounded-xl border overflow-hidden', t.bgCard,
      altMissing ? 'border-red-400' : open ? c.borderStrong : t.borderLight)}>
      <div className={cx('flex items-center gap-2.5 px-3 py-2', open && c.soft)}>
        <span className={cx('w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-semibold flex-shrink-0',
          c.softStrong, c.fg)}>{index + 1}</span>
        <TypeIcon size={ICON.base} className={cx(c.fg, 'flex-shrink-0')} />
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <p className={cx('text-sm font-medium truncate', t.text)}>{slide.heading || 'Untitled slide'}</p>
          <p className={cx('text-[11px] truncate', t.textMuted)}>
            {slide.seconds ? `${slide.seconds}s auto-advance` : 'Manual advance'}
            {slide.caption ? ` · ${String(slide.caption).replace(/<[^>]+>/g, ' ').trim().slice(0, 48)}` : ''}
          </p>
        </button>
        {altMissing && <Chip accent="red" icon={AlertCircle}>Alt text required</Chip>}
        <IconButton icon={ChevronUp} label="Move up" onClick={() => onMove(-1)}
          className={index === 0 ? 'opacity-30 pointer-events-none' : undefined} />
        <IconButton icon={ChevronDown} label="Move down" onClick={() => onMove(1)}
          className={index === total - 1 ? 'opacity-30 pointer-events-none' : undefined} />
        <IconButton icon={Trash2} label="Delete slide" accent="red" onClick={onRemove} />
      </div>

      {open && (
        <div className={cx('border-t p-3 space-y-3', t.borderLight)}>
          <Field label="Slide type">
            <TileGroup value={slide.type} onChange={v => onPatch({ type: v })} columns={3} options={SLIDE_TYPES} />
          </Field>

          {slide.type !== 'text' && (
            <Field label={slide.type === 'video' ? 'Video URL' : 'Image URL'} required
              hint={slide.type === 'video' ? 'Hosted mp4.' : 'Portrait, 9:16.'}>
              <Input value={slide.url || ''} accent="purple" placeholder="https://…"
                onChange={e => onPatch({ url: e.target.value })} />
            </Field>
          )}

          <Field label="Heading" hint="Six words or fewer.">
            <Input value={slide.heading || ''} accent="purple" onChange={e => onPatch({ heading: e.target.value })} />
          </Field>

          <Field label="Caption">
            <RichText
              key={slide.id}
              value={slide.caption}
              accent="purple"
              minHeight="min-h-[5rem]"
              placeholder="Say what to do on this screen…"
              onCommit={html => onPatch({ caption: html })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Auto-advance">
              <Select value={String(slide.seconds ?? 0)} accent="purple" options={SECONDS_OPTIONS}
                onChange={e => onPatch({ seconds: Number(e.target.value) })} />
            </Field>
            {slide.type === 'image' && (
              <Field label="Alt text" required
                error={altMissing ? 'Required.' : undefined}
                hint={altMissing ? undefined : 'Describe what the screenshot shows.'}>
                <Input value={slide.alt || ''} accent={altMissing ? 'red' : 'purple'}
                  placeholder="The settings page with two-step verification switched on"
                  onChange={e => onPatch({ alt: e.target.value })} />
              </Field>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================================================================== *
 * Stories player
 *
 * The same accessibility contract the portal viewer carries, because this is
 * the same guide: a visible pause/play control (WCAG 2.2.2), alt text on every
 * image slide, arrow-key and space support with a visible focus state, and
 * prefers-reduced-motion suppressing auto-advance outright rather than only
 * stopping the progress animation.
 * ==================================================================== */

/** Live `prefers-reduced-motion` state. Read, not assumed — it can change mid-session. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function StoriesPlayer({ slides = [], startAt = 0, large = false }) {
  const { t, a } = useTheme();
  const c = a('purple');
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(Math.min(startAt, Math.max(0, slides.length - 1)));
  const [playing, setPlaying] = useState(!reduced);

  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);

  // The editor deletes slides underneath a running player. If the player had
  // already advanced past the slide that is now last, `slides[index]` is
  // undefined and every read below it throws. Clamp on read rather than trying
  // to keep the state in sync with a list the player does not own.
  const last = Math.max(0, slides.length - 1);
  const at = Math.min(index, last);
  const slide = slides[at];

  // Reduced motion disarms auto-advance entirely — the CSS only stops the
  // progress animation, which on its own would leave slides jumping with no
  // visible timer. Nothing moves unless the reader moves it.
  const armed = !reduced && !!slide?.seconds;

  useEffect(() => {
    if (!playing || !armed) return undefined;
    const id = setTimeout(() => {
      if (at + 1 < slides.length) setIndex(at + 1);
      else setPlaying(false);            // stop at the end rather than looping
    }, slide.seconds * 1000);
    return () => clearTimeout(id);
  }, [at, playing, armed, slide, slides.length]);

  if (!slides.length) {
    return (
      <div className={cx('rounded-2xl border flex items-center justify-center text-xs text-center p-4',
        t.bgSubtle, t.borderLight, t.textMuted)} style={{ aspectRatio: '9 / 16' }}>
        Add a slide to see the guide play.
      </div>
    );
  }

  const back = () => { setPlaying(false); setIndex(Math.max(0, at - 1)); };
  const fwd = () => { setPlaying(false); setIndex(Math.min(last, at + 1)); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); fwd(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); setPlaying(p => !p); }
  };

  return (
    <div className="space-y-1.5">
      <div
        role="group"
        aria-roledescription="Story guide"
        aria-label={`Guide preview — slide ${at + 1} of ${slides.length}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cx('relative rounded-2xl overflow-hidden border select-none outline-none',
          t.borderLight, c.ring, c.softStrong)}
        style={{ aspectRatio: '9 / 16' }}>
        {/* Media */}
        {slide.type === 'image' && slide.url && (
          <img src={slide.url} alt={slide.alt || ''} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {slide.type === 'video' && (
          <div className={cx('absolute inset-0 flex flex-col items-center justify-center gap-2', c.softStrong)}>
            <IconTile icon={Video} accent="purple" size="lg" />
            <p className={cx('text-[10px] px-4 text-center break-all', t.textMuted)}>{slide.url}</p>
          </div>
        )}
        {slide.type === 'text' && <div className={cx('absolute inset-0', c.softStrong)} />}

        {/* Scrim so white type stays legible over any photograph */}
        {slide.type === 'image' && <div className="absolute inset-0 bg-black/45" />}

        {/* Progress segments */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-20">
          {slides.map((s, i) => (
            <span key={s.id} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
              <span
                className={cx('block h-full bg-white',
                  i < at ? 'w-full'
                    : i === at && playing && armed ? 'rhq-story-fill'
                    : i === at ? 'w-full' : 'w-0')}
                style={i === at && playing && armed ? { animationDuration: `${s.seconds}s` } : undefined}
              />
            </span>
          ))}
        </div>

        {/* Tap zones. Focus is visible: an invisible control a keyboard reaches
            and cannot see is not keyboard support. */}
        <button onClick={back} aria-label="Previous slide"
          className="absolute inset-y-0 left-0 w-1/3 z-10 focus:outline-none focus-visible:bg-white/20" />
        <button onClick={fwd} aria-label="Next slide"
          className="absolute inset-y-0 right-0 w-1/3 z-10 focus:outline-none focus-visible:bg-white/20" />

        {/* Copy */}
        <div className={cx('absolute inset-x-0 bottom-0 p-3 z-20',
          slide.type === 'image' ? 'text-white' : t.text)}>
          {slide.heading && (
            <p className={cx('font-semibold leading-tight', large ? 'text-lg' : 'text-sm')}>{slide.heading}</p>
          )}
          {slide.caption && (
            <div
              className={cx('rhq-prose mt-1 leading-snug', large ? 'text-sm' : 'text-[11px]',
                slide.type === 'image' ? 'text-white/90' : t.textSecondary)}
              dangerouslySetInnerHTML={{ __html: slide.caption }}
            />
          )}
        </div>

        {/* Controls */}
        <div className="absolute top-4 right-2 z-30 flex items-center gap-1">
          <button
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? 'Pause the guide' : 'Play the guide'}
            aria-pressed={!playing}
            className="p-1 rounded-full bg-black/40 text-white focus:outline-none focus-visible:bg-black/80"
          >
            {playing ? <Pause size={ICON.sm} /> : <Play size={ICON.sm} />}
          </button>
          <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-white text-[10px] tabular-nums">
            {at + 1}/{slides.length}
          </span>
        </div>

        <span className="sr-only" aria-live="polite">
          Slide {at + 1} of {slides.length}. {slide.heading || ''} {slide.type === 'image' ? slide.alt || '' : ''}
        </span>
      </div>

      <p className={cx('text-[11px] text-center', t.textMuted)}>
        {reduced
          ? 'Auto-advance off for reduced motion · arrow keys move'
          : 'Arrow keys move · space pauses'}
      </p>
    </div>
  );
}

/* ==================================================================== *
 * Preview — how the atom looks to whoever consumes it
 * ==================================================================== */

function PreviewModal({ atom, onClose }) {
  const { t } = useTheme();
  if (!atom) return null;
  const f = fmt(atom);
  const au = aud(atom);

  return (
    <Modal
      open
      onClose={onClose}
      accent={f.hue}
      size={atom.format === 'guide' ? 'modalSm' : 'modalLg'}
      icon={f.icon}
      title={atom.title}
      subtitle={`${f.label} · ${au.label} · ${atom.minutes || 0} min`}
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {atom.format === 'guide' ? (
        <div className="max-w-[18rem] mx-auto">
          <StoriesPlayer slides={atom.slides || []} large />
        </div>
      ) : (
        <article className={cx('rhq-prose text-sm leading-relaxed space-y-3', t.text)}>
          <p className={cx('text-base font-medium', t.textSecondary)}>{atom.summary}</p>
          <Divider />
          <div dangerouslySetInnerHTML={{ __html: atom.body || '<p>This article has no body yet.</p>' }} />
        </article>
      )}
    </Modal>
  );
}

/* ==================================================================== *
 * "Use as a lesson" — the section that makes the dual purpose legible
 * ==================================================================== */

function LessonSection({ atom, atoms }) {
  const { t } = useTheme();
  const [prereqOpen, setPrereqOpen] = useState(false);
  const prereqs = (atom.prerequisiteIds || [])
    .map(id => atoms.find(k => k.id === id))
    .filter(Boolean);
  const candidates = atoms.filter(k => k.id !== atom.id && !(atom.prerequisiteIds || []).includes(k.id));
  const questions = atom.check || [];

  return (
    <Panel
      icon={GraduationCap}
      accent="indigo"
      title="Use as a lesson"
      action={<EntityTag kind="lesson" />}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Field label="Objective" required>
          <Textarea rows={2} accent="indigo" value={atom.objective || ''}
            placeholder="After this you can…"
            onChange={e => touch(atom.id, { objective: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimated minutes">
            <Input type="number" min="1" accent="indigo" value={atom.minutes ?? ''}
              onChange={e => touch(atom.id, { minutes: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Knowledge check">
            {/* Values, not a count: show what is actually asked, with the DS
                overflow badge. "3 questions" tells the author nothing. */}
            <div className="flex items-center flex-wrap gap-1.5 min-h-[38px]">
              <ChipGroup
                items={questions}
                render={q => q.prompt || 'Untitled question'}
                accent="amber" icon={ListChecks} max={2}
                empty={<Chip accent="gray" icon={ListChecks}>None yet</Chip>}
              />
            </div>
          </Field>
        </div>

        <Field label="Prerequisites" hint="Atoms a learner should finish first.">
          <div className="flex flex-wrap items-center gap-1.5">
            {prereqs.map(p => (
              <Chip key={p.id} accent="blue" icon={BookOpen}
                onRemove={() => touch(atom.id, { prerequisiteIds: (atom.prerequisiteIds || []).filter(x => x !== p.id) })}>
                {p.title}
              </Chip>
            ))}
            {prereqs.length === 0 && <span className={cx('text-xs', t.textMuted)}>None</span>}
            <div className="relative">
              <Button size="xs" variant="soft" accent="blue" icon={Plus} onClick={() => setPrereqOpen(o => !o)}>
                Add
              </Button>
              <Menu open={prereqOpen} onClose={() => setPrereqOpen(false)} width="w-72" className="max-h-72 overflow-auto">
                <MenuLabel>Require first</MenuLabel>
                {candidates.slice(0, 40).map(k => (
                  <MenuItem key={k.id} icon={fmt(k).icon} label={k.title} hint={`${k.minutes || 0} min · ${k.status}`}
                    accent="blue"
                    onClick={() => {
                      touch(atom.id, { prerequisiteIds: [...(atom.prerequisiteIds || []), k.id] });
                      setPrereqOpen(false);
                    }} />
                ))}
              </Menu>
            </div>
          </div>
        </Field>

        <Divider />
        <CheckEditor atom={atom} questions={questions} />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Knowledge check editor
 * ------------------------------------------------------------------ */

const BOOLEAN_OPTIONS = () => ([
  { id: uid('o'), label: 'True', correct: true },
  { id: uid('o'), label: 'False', correct: false },
]);

function CheckEditor({ atom, questions }) {
  const { t } = useTheme();

  const setQuestions = (next) => touch(atom.id, { check: next });

  const addQuestion = () => setQuestions([...questions, {
    id: uid('q'),
    type: 'single',
    prompt: '',
    options: [
      { id: uid('o'), label: '', correct: true },
      { id: uid('o'), label: '', correct: false },
    ],
    explanation: '',
  }]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconTile icon={ListChecks} accent="amber" size="sm" />
          <div>
            <p className={cx('text-sm font-medium', t.text)}>Knowledge check</p>
          </div>
        </div>
        <Button size="sm" variant="soft" accent="amber" icon={Plus} onClick={addQuestion}>Add question</Button>
      </div>

      {questions.length === 0 ? (
        <Banner accent="gray" icon={AlertCircle}>
          No check on this atom.
        </Banner>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              onPatch={patch => setQuestions(questions.map(x => (x.id === q.id ? { ...x, ...patch } : x)))}
              onRemove={() => setQuestions(questions.filter(x => x.id !== q.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question, index, onPatch, onRemove }) {
  const { t } = useTheme();
  const isBool = question.type === 'boolean';
  const options = question.options || [];
  const noCorrect = !options.some(o => o.correct);

  const setType = (type) => {
    if (type === 'boolean') onPatch({ type, options: BOOLEAN_OPTIONS() });
    else if (isBool) onPatch({ type, options: [{ id: uid('o'), label: '', correct: true }, { id: uid('o'), label: '', correct: false }] });
    else onPatch({ type });
  };

  const toggleCorrect = (id) => {
    onPatch({
      options: options.map(o => o.id === id
        ? { ...o, correct: !o.correct }
        : (question.type === 'multi' ? o : { ...o, correct: false })),
    });
  };

  return (
    <div className={cx('rounded-xl border overflow-hidden', t.bgCard,
      noCorrect ? 'border-red-400' : t.borderLight)}>
      <div className={cx('flex items-center gap-2 px-3 py-2 border-b', t.borderLight)}>
        <span className={cx('text-[11px] font-semibold', t.textMuted)}>Q{index + 1}</span>
        <div className="flex-1" />
        {noCorrect && <Chip accent="red" icon={AlertCircle}>No correct answer marked</Chip>}
        <IconButton icon={Trash2} label="Delete question" accent="red" onClick={onRemove} />
      </div>
      <div className="p-3 space-y-3">
        <Field label="Prompt" required>
          <Input value={question.prompt} accent="amber" placeholder="Ask about the decision, not the wording…"
            onChange={e => onPatch({ prompt: e.target.value })} />
        </Field>
        <Field label="Answer type">
          <TileGroup value={question.type} onChange={setType} columns={3} options={QUESTION_TYPES} />
        </Field>
        <Field label={question.type === 'multi' ? 'Options — tick every correct one' : 'Options — tick the correct one'}>
          <div className="space-y-1.5">
            {options.map(o => (
              <div key={o.id} className="flex items-center gap-2">
                <Checkbox accent="amber" checked={o.correct} onChange={() => toggleCorrect(o.id)} />
                <Input
                  value={o.label}
                  accent="amber"
                  disabled={isBool}
                  className={isBool ? 'opacity-60' : undefined}
                  placeholder="Answer text"
                  onChange={e => onPatch({ options: options.map(x => (x.id === o.id ? { ...x, label: e.target.value } : x)) })}
                />
                {!isBool && (
                  <IconButton icon={X} label="Remove option" accent="red"
                    onClick={() => onPatch({ options: options.filter(x => x.id !== o.id) })} />
                )}
              </div>
            ))}
            {!isBool && (
              <Button size="xs" variant="ghost" icon={Plus}
                onClick={() => onPatch({ options: [...options, { id: uid('o'), label: '', correct: false }] })}>
                Add option
              </Button>
            )}
          </div>
        </Field>
        <Field label="Explanation" hint="Shown after the learner answers.">
          <Textarea rows={2} accent="amber" value={question.explanation || ''}
            onChange={e => onPatch({ explanation: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * New atom
 * ==================================================================== */

function NewAtomModal({ open, onClose, tab }) {
  const { t } = useTheme();
  // The author owns what they create. Read the id from state rather than
  // spelling a person id into a view — those live in seed/ids.js.
  const currentUser = useStore(s => s.currentUser);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [format, setFormat] = useState('article');
  const [audience, setAudience] = useState('internal');
  const [objective, setObjective] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(''); setSummary(''); setFormat('article'); setAudience('internal'); setObjective('');
  }, [open]);

  const create = () => {
    if (!title.trim()) return;
    const id = uid('kb');
    const base = {
      id,
      title: title.trim(),
      summary: summary.trim() || 'No summary yet.',
      format,
      status: 'draft',
      audience,
      tags: [],
      ownerId: currentUser?.id || null,
      updatedAt: nowISO(),
      views: 0,
      helpfulYes: 0,
      helpfulNo: 0,
      objective: objective.trim(),
      minutes: format === 'guide' ? 4 : 5,
      prerequisiteIds: [],
      check: [],
    };
    addTo('knowledge', format === 'guide'
      ? {
        ...base,
        slides: [{
          id: uid('sl'), type: 'text', heading: 'First screen',
          caption: 'Say what the reader will be able to do by the end.', seconds: 5,
        }],
      }
      : { ...base, body: '<p></p>' });
    onClose();
    navigate('knowledge', tab, id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent={FORMATS[format].hue}
      size="modalMd"
      icon={FORMATS[format].icon}
      title="New knowledge atom"
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>Starts as a draft</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="grad" module="knowledge" icon={Check} disabled={!title.trim()} onClick={create}>
              Create atom
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Format">
          <TileGroup value={format} onChange={setFormat} columns={2}
            options={[
              { value: 'article', label: 'Article', icon: BookOpen, accent: 'blue', hint: 'Rich text' },
              { value: 'guide', label: 'Guide', icon: LayoutGrid, accent: 'purple', hint: 'Slides' },
            ]} />
        </Field>

        <Field label="Title" required>
          <Input autoFocus value={title} accent={FORMATS[format].hue}
            placeholder="e.g. Reset your Northwind password"
            onChange={e => setTitle(e.target.value)} />
        </Field>

        <Field label="Summary" hint="One sentence.">
          <Textarea rows={2} value={summary} accent={FORMATS[format].hue}
            placeholder="What this covers, in the reader's language."
            onChange={e => setSummary(e.target.value)} />
        </Field>

        <Field label="Audience" hint={AUDIENCES[audience].hint}>
          <TileGroup value={audience} onChange={setAudience} columns={3}
            options={Object.entries(AUDIENCES).map(([value, m]) => ({ value, label: m.label, icon: m.icon, accent: m.hue }))} />
        </Field>

        <Field label="Objective" hint="Optional.">
          <Input value={objective} accent="indigo" placeholder="After this you can…"
            onChange={e => setObjective(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
