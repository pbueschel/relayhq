import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, LayoutGrid, Plus, Trash2, Play, Pause, ChevronUp, ChevronDown,
  Tag, Package, GraduationCap, Globe, Building2, Users, Eye, ThumbsUp, ThumbsDown,
  Clock, ListChecks, Bold, Italic, Underline, List, Heading3, Image as ImageIcon,
  Video, Type, AlertCircle, Check, ArrowLeft, Layers, Circle, Lock,
  Share2, X, Info,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, ENTITIES,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, EntityTag, Avatar,
  EmptyState, Card, Panel, GroupLabel, ListRow, Stat, Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, TileGroup, SearchInput,
  Modal, ConfirmDelete, Menu, MenuItem, MenuLabel, MenuDivider, FilterPill,
  SubTabs, ViewSwitcher, PageHeader, Toolbar, PageBody, Breadcrumbs,
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

const TABS = [
  { value: 'all',      label: 'All',      icon: Layers,     accent: 'blue' },
  { value: 'articles', label: 'Articles', icon: BookOpen,   accent: 'blue' },
  { value: 'guides',   label: 'Guides',   icon: LayoutGrid, accent: 'purple' },
  { value: 'drafts',   label: 'Drafts',   icon: Circle,     accent: 'gray' },
];
const TAB_VALUES = TABS.map(t => t.value);

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

/** Why an atom is, or is not, reachable from the customer help centre. */
function externalState(atom, reuse) {
  const external = reuse.catalog.filter(c => c.audience === 'external' || c.audience === 'both');
  if (atom.status !== 'published') {
    return { live: false, hue: 'gray', headline: `Not published — status is ${atom.status}`,
      why: 'Drafts and archived atoms are served to nobody: not the help centre, not the agent panel, and any course that includes it will skip the lesson.', external };
  }
  if (atom.audience === 'internal') {
    return { live: false, hue: 'slate', headline: 'Internal audience — staff only',
      why: 'Published, but the audience is Internal. It is available to agents and to internal courses and will never appear in the customer help centre.', external };
  }
  if (!external.length) {
    return { live: false, hue: 'amber', headline: 'Published for customers, but nothing links to it',
      why: 'The audience allows customers to see it, but no customer-facing catalog item references it — so nobody will find it by browsing. Link it from a catalog item, or it is search-only.', external };
  }
  return { live: true, hue: 'emerald', headline: `Live in the customer help centre`,
    why: 'Published, customer audience, and reachable by browsing the catalog items below.', external };
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
  const tab = TAB_VALUES.includes(route?.sub) ? route.sub : 'all';
  const selectedId = route?.id || (TAB_VALUES.includes(route?.sub) ? null : route?.sub) || null;
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
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const [audience, setAudience] = useState('all');
  const [status, setStatus] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [group, setGroup] = useState('none');
  const [view, setView] = useState('list');
  const [creating, setCreating] = useState(false);
  const [playing, setPlaying] = useState(null);

  const tagOptions = useMemo(() => {
    const counts = new Map();
    for (const a of atoms) for (const tg of a.tags || []) counts.set(tg, (counts.get(tg) || 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, n]) => ({ value, label: value, hint: `${n} atom${n === 1 ? '' : 's'}` }));
  }, [atoms]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return atoms.filter(a => {
      if (tab === 'articles' && a.format !== 'article') return false;
      if (tab === 'guides' && a.format !== 'guide') return false;
      if (tab === 'drafts' && a.status !== 'draft') return false;
      if (audience !== 'all' && a.audience !== audience) return false;
      if (status !== 'all' && a.status !== status) return false;
      if (tagFilter !== 'all' && !(a.tags || []).includes(tagFilter)) return false;
      if (!needle) return true;
      return [a.title, a.summary, a.objective, ...(a.tags || [])]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(needle));
    });
  }, [atoms, tab, audience, status, tagFilter, q]);

  const groups = useMemo(
    () => groupAtoms(filtered, group, people, reuseIndex),
    [filtered, group, people, reuseIndex],
  );

  const counts = useMemo(() => {
    let published = 0, drafts = 0, guides = 0, reused = 0, external = 0;
    for (const a of atoms) {
      if (a.status === 'published') published++;
      if (a.status === 'draft') drafts++;
      if (a.format === 'guide') guides++;
      const r = reuseIndex.get(a.id);
      if (r && (r.catalog.length + r.courses.length) > 0) reused++;
      if (a.audience === 'external' || a.audience === 'both') external++;
    }
    return { published, drafts, guides, reused, external };
  }, [atoms, reuseIndex]);

  const tabItems = useMemo(() => TABS.map(item => ({
    ...item,
    count: item.value === 'all' ? atoms.length
      : item.value === 'articles' ? atoms.filter(a => a.format === 'article').length
      : item.value === 'guides' ? atoms.filter(a => a.format === 'guide').length
      : counts.drafts,
  })), [atoms, counts.drafts]);

  const anyFilter = audience !== 'all' || status !== 'all' || tagFilter !== 'all' || q.trim();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={BookOpen}
        accent="blue"
        title="Knowledge"
        subtitle={`${atoms.length} atoms · ${counts.reused} reused across the catalog and courses · one record, three surfaces`}
        actions={<Button variant="solid" accent="blue" icon={Plus} onClick={() => setCreating(true)}>New atom</Button>}
      >
        <Toolbar className="mb-2">
          <SubTabs items={tabItems} value={tab} onChange={v => navigate('knowledge', v)} />
        </Toolbar>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} accent="blue" width="w-64"
            placeholder="Search titles, summaries, tags…" />
          <FilterMenu icon={Users} label="Audience" value={audience} onChange={setAudience}
            options={Object.entries(AUDIENCES).map(([value, m]) => ({ value, label: m.label, icon: m.icon, hint: m.hint }))} />
          <FilterMenu icon={Circle} label="Status" value={status} onChange={setStatus}
            options={STATUSES.map(s => ({ value: s.value, label: s.label, icon: s.icon }))} />
          <FilterMenu icon={Tag} label="Tag" value={tagFilter} onChange={setTagFilter} options={tagOptions} />
          <FilterMenu icon={Layers} label="Group by" value={group} onChange={setGroup} neutral="none"
            allLabel="No grouping"
            options={[
              { value: 'audience', label: 'Audience', icon: Users },
              { value: 'status', label: 'Status', icon: Circle },
              { value: 'owner', label: 'Owner', icon: Building2 },
              { value: 'reuse', label: 'Reuse', icon: Share2 },
            ]} />
          <ViewSwitcher value={view} onChange={setView}
            items={[
              { value: 'list', label: 'Library', icon: BookOpen },
              { value: 'reuse', label: 'Reuse map', icon: Share2 },
            ]} />
        </Toolbar>
      </PageHeader>

      <PageBody width="max-w-6xl">
        <div className="space-y-4">
          {notFound && (
            <Banner accent="amber" icon={AlertCircle} title="That atom no longer exists">
              Nothing in the library has the id <code>{notFound}</code>. It was probably deleted in this session.
            </Banner>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Stat label="atoms" value={atoms.length} accent="blue" icon={BookOpen}
              active={tab === 'all'} onClick={() => navigate('knowledge', 'all')} />
            <Stat label="published" value={counts.published} accent="emerald"
              active={status === 'published'} onClick={() => setStatus(status === 'published' ? 'all' : 'published')} />
            <Stat label="drafts" value={counts.drafts} accent="gray"
              active={tab === 'drafts'} onClick={() => navigate('knowledge', 'drafts')} />
            <Stat label="guides" value={counts.guides} accent="purple" icon={LayoutGrid}
              active={tab === 'guides'} onClick={() => navigate('knowledge', 'guides')} />
            <Stat label="reused elsewhere" value={counts.reused} accent="indigo" icon={Share2}
              active={group === 'reuse'} onClick={() => setGroup(group === 'reuse' ? 'none' : 'reuse')} />
            <Stat label="customer-facing" value={counts.external} accent="green" icon={Globe}
              active={audience === 'external'} onClick={() => setAudience(audience === 'external' ? 'all' : 'external')} />
          </div>

          {view === 'reuse' ? (
            <ReuseMap atoms={filtered} reuseIndex={reuseIndex} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={anyFilter ? 'No atoms match those filters' : 'No knowledge atoms yet'}
              hint={anyFilter
                ? 'Clear a filter, or widen the search. Drafts are excluded from every tab except Drafts.'
                : 'An atom is authored once and reused by the help centre, the agent panel and any course that needs it.'}
              action={<Button variant="solid" accent="blue" icon={Plus} onClick={() => setCreating(true)}>New atom</Button>}
            />
          ) : (
            <div className="space-y-5">
              {groups.map(g => (
                <div key={g.key}>
                  {g.label && (
                    <div className="flex items-center gap-2 mb-2">
                      <GroupLabel>{g.label}</GroupLabel>
                      <span className={cx('text-[11px] tabular-nums', t.textMuted)}>{g.items.length}</span>
                      <Divider className="flex-1" />
                    </div>
                  )}
                  <div className={cx(DENSITY.rowGap, '@container')}>
                    {g.items.map(a => (
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
                </div>
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

const REUSE_BUCKETS = {
  both:    'Deflecting AND teaching',
  catalog: 'Help centre only',
  courses: 'Courses only',
  none:    'Not used anywhere yet',
};

function groupAtoms(list, group, people, reuseIndex) {
  if (group === 'none') return [{ key: 'all', label: null, items: list }];
  const buckets = new Map();
  for (const a of list) {
    let key, label;
    if (group === 'audience') { key = a.audience; label = AUDIENCES[a.audience]?.label || a.audience; }
    else if (group === 'status') { key = a.status; label = STATUSES.find(s => s.value === a.status)?.label || a.status; }
    else if (group === 'owner') { key = a.ownerId; label = people.get(a.ownerId)?.name || 'Unassigned'; }
    else {
      const r = reuseIndex.get(a.id) || EMPTY_REUSE;
      key = r.catalog.length && r.courses.length ? 'both'
        : r.catalog.length ? 'catalog'
        : r.courses.length ? 'courses' : 'none';
      label = REUSE_BUCKETS[key];
    }
    if (!buckets.has(key)) buckets.set(key, { key, label, items: [] });
    buckets.get(key).items.push(a);
  }
  return [...buckets.values()].sort((x, y) => y.items.length - x.items.length);
}

/* ------------------------------------------------------------------ */

function FilterMenu({ icon, label, value, onChange, options, allLabel = 'All', neutral = 'all' }) {
  const [open, setOpen] = useState(false);
  const active = value !== neutral;
  const current = options.find(o => o.value === value);
  return (
    <div className="relative">
      <FilterPill icon={icon} label={active ? (current?.label || value) : label}
        active={active} open={open} onClick={() => setOpen(o => !o)} />
      <Menu open={open} onClose={() => setOpen(false)} width="w-60" className="max-h-80 overflow-auto">
        <MenuLabel>{label}</MenuLabel>
        <MenuItem label={allLabel} accent="blue" selected={value === neutral}
          onClick={() => { onChange(neutral); setOpen(false); }} />
        <MenuDivider />
        {options.map(o => (
          <MenuItem key={o.value} icon={o.icon} label={o.label} hint={o.hint} accent="blue"
            selected={value === o.value} onClick={() => { onChange(o.value); setOpen(false); }} />
        ))}
      </Menu>
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
  const { t } = useTheme();
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
                    <f.icon size={ICON.sm} className={cx('flex-shrink-0')} />
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
              { id: 'tab', name: TABS.find(x => x.value === tab)?.label || 'All' },
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
              A visual how-to with no alt text is unusable with a screen reader, and the build gate fails on it.
              Fix: {altGaps.map(s => s.heading || 'untitled slide').join(', ')}.
            </Banner>
          )}
          {draftInCourse && (
            <Banner accent="amber" icon={AlertCircle} title="A course includes this atom, but it is not published">
              {reuse.courses.map(c => c.title).join(', ')} reference{reuse.courses.length === 1 ? 's' : ''} this lesson.
              Learners will have it skipped until the status is Published — the course will not show an error, it will simply be shorter.
            </Banner>
          )}
          {internalButPublic && (
            <Banner accent="amber" icon={AlertCircle} title="Linked from a customer-facing catalog item">
              This atom is linked from a catalog item customers can see, but its audience is <strong>Internal</strong>,
              so the help centre will render that item with one fewer article and no explanation.
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
          ? `It is referenced by ${reuse.catalog.length} catalog item(s) and ${reuse.courses.length} course lesson slot(s). Those references will dangle: ${[...reuse.catalog.map(c => c.name), ...reuse.courses.map(c => c.title)].join(', ')}.`
          : 'Nothing references this atom, so nothing else changes.'}
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
            <p className={cx('text-xs', t.textSecondary)}>
              Authored once. The help centre, the agent panel and every course read this same record — nothing below is a copy.
            </p>
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
            hint="Catalog items that offer it before the request form"
            empty="No catalog item links to this atom, so a customer browsing the catalog will never be offered it."
            rows={reuse.catalog.map(c => ({
              id: c.id,
              title: c.name,
              subtitle: c.path,
              meta: <Chip accent={c.audience === 'internal' ? 'slate' : c.audience === 'both' ? 'teal' : 'green'}>
                {AUDIENCES[c.audience]?.label || c.audience}
              </Chip>,
              go: () => navigate('catalog', null, c.id),
            }))}
          />

          {/* Training */}
          <ReuseColumn
            icon={GraduationCap} accent="indigo" title="Training"
            hint="Courses that teach with this exact record as a lesson"
            empty="No course uses this atom as a lesson yet. Any atom with an objective and a check is ready to be one."
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
                <p className={cx('text-[11px]', t.textMuted)}>What a customer can actually reach</p>
              </div>
            </div>
            <Banner accent={ext.hue} icon={ext.live ? Check : AlertCircle} title={ext.headline}>
              {ext.why}
            </Banner>
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

function ReuseColumn({ icon: Icon, accent, title, hint, rows, empty }) {
  const { t } = useTheme();
  return (
    <div className={DENSITY.cardPad}>
      <div className="flex items-center gap-2 mb-2">
        <IconTile icon={Icon} accent={accent} size="sm" />
        <div className="min-w-0">
          <p className={cx('text-sm font-medium', t.text)}>{title}</p>
          <p className={cx('text-[11px] truncate', t.textMuted)}>{hint}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className={cx('text-xs leading-relaxed', t.textMuted)}>{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map(r => (
            <ListRow key={r.id} accent={accent} title={r.title} subtitle={r.subtitle}
              meta={r.meta} onClick={r.go} />
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
        <Field label="Summary" hint="One sentence. This is the line the help centre and the course card both show.">
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
        <Field label="Owner" hint="Who is accountable for keeping this accurate.">
          <Select value={atom.ownerId || ''} accent={f.hue}
            onChange={e => touch(atom.id, { ownerId: e.target.value })}
            options={directory.map(p => ({ value: p.id, label: `${p.name} — ${p.title}` }))} />
        </Field>
        <Field label="Tags" hint="Tags drive help-centre browse, agent search and course assembly.">
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
    <Panel icon={Eye} accent="blue" title="Feedback" subtitle="Read-only — collected from the help centre">
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
  const { t } = useTheme();
  return (
    <Panel
      icon={BookOpen}
      accent="blue"
      title="Article body"
      subtitle="Rich text, stored as HTML — the same markup the help centre and the lesson player render"
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
        <p className={cx('text-[11px]', t.textMuted)}>
          Formatting is committed when the editor loses focus, not on every keystroke — that is what keeps the
          cursor where you left it.
        </p>
      </div>
    </Panel>
  );
}

/* ==================================================================== *
 * Guide editor — the Instagram-style format
 * ==================================================================== */

function GuideEditor({ atom }) {
  const { t } = useTheme();
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
      subtitle={`${slides.length} slide${slides.length === 1 ? '' : 's'} · tap-through, auto-advance where a duration is set`}
      action={<Button size="sm" variant="soft" accent="purple" icon={Plus} onClick={addSlide}>Add slide</Button>}
    >
      <div className={cx(DENSITY.cardPad, '@container')}>
        <div className="grid grid-cols-1 @2xl:grid-cols-[minmax(0,1fr)_13rem] gap-4 items-start">
          <div className="space-y-2 min-w-0">
            {slides.length === 0 ? (
              <EmptyState icon={LayoutGrid} title="No slides yet"
                hint="A guide is an ordered set of screens. Four to seven is the sweet spot — past that, split it into two atoms."
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
            <p className={cx('text-[10px] mt-1.5 leading-relaxed', t.textMuted)}>
              Tap the left or right half to move. Slides with a duration advance on their own; a slide set to
              <strong> Manual</strong> waits for the reader.
            </p>
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
              hint={slide.type === 'video' ? 'Hosted mp4. The prototype shows a placeholder frame rather than streaming it.' : 'Portrait crops read best — the player is 9:16.'}>
              <Input value={slide.url || ''} accent="purple" placeholder="https://…"
                onChange={e => onPatch({ url: e.target.value })} />
            </Field>
          )}

          <Field label="Heading" hint="Six words or fewer. It sits over the image.">
            <Input value={slide.heading || ''} accent="purple" onChange={e => onPatch({ heading: e.target.value })} />
          </Field>

          <Field label="Caption" hint="Rich text — bold the thing they must not miss.">
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
            <Field label="Auto-advance" hint={slide.seconds ? 'Advances on its own.' : 'Waits for the reader.'}>
              <Select value={String(slide.seconds ?? 0)} accent="purple" options={SECONDS_OPTIONS}
                onChange={e => onPatch({ seconds: Number(e.target.value) })} />
            </Field>
            {slide.type === 'image' && (
              <Field label="Alt text" required
                error={altMissing ? 'Required — an image-only instruction with no alt text is unusable with a screen reader.' : undefined}
                hint={altMissing ? undefined : 'Describe what the screenshot shows, not that it is a screenshot.'}>
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
 * ==================================================================== */

function StoriesPlayer({ slides = [], startAt = 0, large = false }) {
  const { t, a } = useTheme();
  const c = a('purple');
  const [index, setIndex] = useState(Math.min(startAt, Math.max(0, slides.length - 1)));
  const [playing, setPlaying] = useState(true);

  const slide = slides[index];

  useEffect(() => {
    if (!playing || !slide || !slide.seconds) return undefined;
    const id = setTimeout(() => {
      if (index + 1 < slides.length) setIndex(index + 1);
      else setPlaying(false);            // stop at the end rather than looping
    }, slide.seconds * 1000);
    return () => clearTimeout(id);
  }, [index, playing, slide, slides.length]);

  if (!slides.length) {
    return (
      <div className={cx('rounded-2xl border flex items-center justify-center text-xs text-center p-4',
        t.bgSubtle, t.borderLight, t.textMuted)} style={{ aspectRatio: '9 / 16' }}>
        Add a slide to see the guide play.
      </div>
    );
  }

  const back = () => { setPlaying(false); setIndex(i => Math.max(0, i - 1)); };
  const fwd = () => { setPlaying(false); setIndex(i => Math.min(slides.length - 1, i + 1)); };

  return (
    <div className={cx('relative rounded-2xl overflow-hidden border select-none', t.borderLight, c.softStrong)}
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
                i < index ? 'w-full'
                  : i === index && playing && s.seconds ? 'rhq-story-fill'
                  : i === index ? 'w-full' : 'w-0')}
              style={i === index && playing && s.seconds ? { animationDuration: `${s.seconds}s` } : undefined}
            />
          </span>
        ))}
      </div>

      {/* Tap zones */}
      <button onClick={back} aria-label="Previous slide" className="absolute inset-y-0 left-0 w-1/3 z-10" />
      <button onClick={fwd} aria-label="Next slide" className="absolute inset-y-0 right-0 w-1/3 z-10" />

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
          aria-label={playing ? 'Pause' : 'Play'}
          className="p-1 rounded-full bg-black/40 text-white"
        >
          {playing ? <Pause size={ICON.sm} /> : <Play size={ICON.sm} />}
        </button>
        <span className="px-1.5 py-0.5 rounded-full bg-black/40 text-white text-[10px] tabular-nums">
          {index + 1}/{slides.length}
        </span>
      </div>
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
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            {atom.format === 'guide'
              ? 'The reader sees exactly this, full screen, in the help centre and inside the lesson player.'
              : 'The same HTML renders in the help centre, the agent panel and the lesson player.'}
          </span>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </>
      }
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
      subtitle="The fields a course needs. Filling them in does not copy anything — the course points back here."
      action={<EntityTag kind="lesson" />}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Banner accent="indigo" icon={Info}>
          A lesson <strong>is</strong> a knowledge atom — that is why a lesson is blue, the same colour as an article.
          Edit it here once and every course that uses it is current.
        </Banner>

        <Field label="Objective" required
          hint="Finish the sentence “after this you can…”. Courses show this before the learner starts.">
          <Textarea rows={2} accent="indigo" value={atom.objective || ''}
            placeholder="After this you can…"
            onChange={e => touch(atom.id, { objective: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Estimated minutes" hint="Used to total up a course's length.">
            <Input type="number" min="1" accent="indigo" value={atom.minutes ?? ''}
              onChange={e => touch(atom.id, { minutes: Number(e.target.value) || 0 })} />
          </Field>
          <Field label="Knowledge check">
            <div className={cx('flex items-center gap-2 h-[38px]')}>
              <Chip accent={questions.length ? 'amber' : 'gray'} icon={ListChecks}>
                {questions.length ? `${questions.length} question${questions.length === 1 ? '' : 's'}` : 'None yet'}
              </Chip>
            </div>
          </Field>
        </div>

        <Field label="Prerequisites" hint="Atoms a learner should finish first. The course builder enforces the order.">
          <div className="flex flex-wrap items-center gap-1.5">
            {prereqs.map(p => (
              <Chip key={p.id} accent="blue" icon={BookOpen}
                onRemove={() => touch(atom.id, { prerequisiteIds: (atom.prerequisiteIds || []).filter(x => x !== p.id) })}>
                {p.title}
              </Chip>
            ))}
            {prereqs.length === 0 && <span className={cx('text-xs', t.textMuted)}>None — this atom stands alone.</span>}
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
            <p className={cx('text-[11px]', t.textMuted)}>Optional. Scored inside the course; never shown in the help centre.</p>
          </div>
        </div>
        <Button size="sm" variant="soft" accent="amber" icon={Plus} onClick={addQuestion}>Add question</Button>
      </div>

      {questions.length === 0 ? (
        <Banner accent="gray" icon={AlertCircle}>
          No check on this atom. A course that includes it will mark the lesson complete as soon as it is opened,
          with nothing to pass — which is fine for reference material and wrong for anything a certificate depends on.
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
        <Field label="Explanation" hint="Shown after the learner answers. This is where the teaching actually happens.">
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
      subtitle="One record. The help centre, the agent panel and any course will all read it."
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>Starts as a draft</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent={FORMATS[format].hue} icon={Check} disabled={!title.trim()} onClick={create}>
              Create atom
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Banner accent="amber" icon={AlertCircle} title="New atoms are drafts">
          A draft is served to nobody: not the help centre, not the agent panel, and any course that includes it will
          skip past it silently. Publish it when the body is real.
        </Banner>

        <Field label="Format" hint="Guides are the Stories format — a tap-through sequence of screens.">
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

        <Field label="Summary" hint="One sentence. Shown on the help-centre card and the course lesson row.">
          <Textarea rows={2} value={summary} accent={FORMATS[format].hue}
            placeholder="What this covers, in the reader's language."
            onChange={e => setSummary(e.target.value)} />
        </Field>

        <Field label="Audience" hint={AUDIENCES[audience].hint}>
          <TileGroup value={audience} onChange={setAudience} columns={3}
            options={Object.entries(AUDIENCES).map(([value, m]) => ({ value, label: m.label, icon: m.icon, accent: m.hue }))} />
        </Field>

        <Field label="Objective" hint="Optional now, required before a course can use it as a lesson.">
          <Input value={objective} accent="indigo" placeholder="After this you can…"
            onChange={e => setObjective(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
