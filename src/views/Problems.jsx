import React, { useMemo, useState } from 'react';
import {
  OctagonAlert, Inbox, GitBranch, BookOpen, Plus, Link2, Unlink, TriangleAlert,
  Lightbulb, Microscope, Stethoscope, ShieldCheck, Archive, Building2, Users,
  CalendarDays, Check, Trash2, ArrowRight, Layers, CircleDot, ExternalLink,
  Wrench, ListFilter, LayoutGrid, Server,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, LAYOUT, ENTITIES, PRIORITY, priorityMeta, statusMeta,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, PriorityFlag, EntityTag,
  Avatar, AvatarStack, EmptyState, Card, Panel, Section, GroupLabel, ListRow, Stat,
  Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, TileGroup, SearchInput,
  Modal, ConfirmDelete, Menu, MenuItem, MenuLabel, FilterPill,
  SubTabs, PageHeader, Toolbar, PageBody,
} from '@/ds';
import { useStore, addTo, patchIn, removeFrom, uid, NOW } from '@/store/store.js';
import { navigate } from '@/lib/router.js';

/**
 * PROBLEM MANAGEMENT
 *
 * A ticket restores service for one person. A problem removes the cause for
 * everyone. The whole module exists to make one chain visible and walkable:
 *
 *     incidents  →  problem (root cause + workaround)  →  change (permanent fix)
 *
 * Two rules are enforced rather than described:
 *
 *  1. A KNOWN ERROR MUST HAVE A WORKAROUND. "Known error" is not a mood — it is
 *     the ITIL state that promises support agents a documented way to restore
 *     service today. Publishing one with an empty workaround hands them a label
 *     and nothing else, so the transition is blocked and the reason is shown.
 *
 *  2. NOTHING RESOLVES ITSELF QUIETLY. Linking an incident does not close it,
 *     closing a problem does not close its incidents, and a workaround that
 *     lives only in this record never reaches the agent working the ticket.
 *     Each of those is stated in a <Banner> at the moment it matters.
 *
 * Problem records are seeded by src/store/seed/service.js. Tickets, changes and
 * knowledge atoms are owned by other modules; this view only reads them and
 * stores their ids.
 */

const HUE = ENTITIES.problem.hue;              // fuchsia — the problem colour, everywhere
const TICKET_HUE = ENTITIES.ticket.hue;        // rose
const CHANGE_HUE = ENTITIES.change.hue;        // orange
const KB_HUE = ENTITIES.article.hue;           // blue
const GUIDE_HUE = ENTITIES.guide.hue;          // purple

/**
 * A knowledge atom is drawn with the registry's own colour and icon for its
 * format, so an atom looks the same here as it does in the Knowledge library.
 */
function atomHue(atom) {
  return atom?.format === 'guide' ? GUIDE_HUE : KB_HUE;
}

function atomIcon(atom) {
  return atom?.format === 'guide' ? LayoutGrid : BookOpen;
}

/* ==================================================================== *
 * Lifecycle
 * ==================================================================== */

const LIFECYCLE = [
  {
    key: 'new', label: 'New', icon: OctagonAlert,
    hint: 'Recorded. Repeating incidents have been grouped into one cause, but nobody owns the diagnosis yet.',
  },
  {
    key: 'investigating', label: 'Investigating', icon: Microscope,
    hint: 'Someone owns it. The symptom is captured; the root cause is a hypothesis until it is written down.',
  },
  {
    key: 'known_error', label: 'Known error', icon: Lightbulb,
    hint: 'Root cause understood and a workaround documented. Support can restore service today while the fix is built.',
  },
  {
    key: 'resolved', label: 'Resolved', icon: ShieldCheck,
    hint: 'A permanent fix has shipped. The workaround is history — incidents should stop arriving.',
  },
  {
    key: 'closed', label: 'Closed', icon: Archive,
    hint: 'Reviewed and filed. Kept searchable so the next recurrence is recognised in minutes, not weeks.',
  },
];

const LIFECYCLE_KEYS = LIFECYCLE.map(s => s.key);
const STAGE_ICONS = {
  new: OctagonAlert, investigating: Microscope, known_error: Lightbulb,
  resolved: ShieldCheck, closed: Archive,
};

function stageMeta(key) {
  return LIFECYCLE.find(s => s.key === key) || LIFECYCLE[0];
}

function stageIcon(key) {
  return STAGE_ICONS[key] || OctagonAlert;
}

/** The next state a human would normally move to, and the words for the button. */
const NEXT_ACTION = {
  new: { to: 'investigating', label: 'Start investigating', icon: Microscope },
  investigating: { to: 'known_error', label: 'Publish as known error', icon: Lightbulb },
  known_error: { to: 'resolved', label: 'Mark resolved', icon: ShieldCheck },
  resolved: { to: 'closed', label: 'Close problem', icon: Archive },
  closed: null,
};

const TABS = [
  { value: 'open', label: 'Open', icon: OctagonAlert, accent: HUE },
  { value: 'known', label: 'Known errors', icon: Lightbulb, accent: 'orange' },
  { value: 'resolved', label: 'Resolved', icon: ShieldCheck, accent: 'emerald' },
  { value: 'all', label: 'All', icon: Layers, accent: 'slate' },
];

const TAB_KEYS = TABS.map(x => x.value);

function inTab(problem, tab) {
  const s = problem.status;
  if (tab === 'known') return s === 'known_error';
  if (tab === 'resolved') return s === 'resolved' || s === 'closed';
  if (tab === 'all') return true;
  return s === 'new' || s === 'investigating' || s === 'known_error';
}

const PRIORITY_KEYS = ['urgent', 'high', 'medium', 'low'];

/* ==================================================================== *
 * Normalisation + small formatters
 *
 * The seed owns the shape; this view refuses to render `undefined` no matter
 * what reaches it, because a half-written seed should degrade to "not recorded"
 * rather than to a blank panel.
 * ==================================================================== */

/**
 * The seed writes a problem's workaround as a structured record
 * (`{ summary, steps[], knowledgeId }`) because that is how one is authored.
 * The editor below is a single prose field, so the structure is flattened into
 * the text a support agent would actually read. Editing writes plain text back,
 * which is why every reader must accept BOTH shapes — a record touched in the
 * demo and one straight from the seed have to render identically.
 */
function workaroundText(w) {
  if (!w) return '';
  if (typeof w === 'string') return w;
  const lines = [];
  if (w.summary) lines.push(w.summary);
  (w.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  return lines.join('\n');
}

function workaroundAtomIds(p) {
  if (Array.isArray(p.knowledgeIds)) return p.knowledgeIds;
  const id = p.workaround && typeof p.workaround === 'object' ? p.workaround.knowledgeId : null;
  return id ? [id] : [];
}

function normalize(p) {
  return {
    ...p,
    key: p.key || p.id,
    title: p.title || 'Untitled problem',
    description: p.description || '',
    status: LIFECYCLE_KEYS.includes(p.status) ? p.status : 'new',
    priority: PRIORITY[p.priority] ? p.priority : 'medium',
    // The seed calls the owner `ownerId` and the symptom `symptoms`. Prefer the
    // edited field when it EXISTS (so clearing an assignee to null sticks rather
    // than falling back to the seeded owner), otherwise read the seed's name.
    assigneeId: p.assigneeId !== undefined ? p.assigneeId : (p.ownerId ?? null),
    symptom: p.symptom || p.symptoms || '',
    rootCause: p.rootCause || '',
    workaround: workaroundText(p.workaround),
    workaroundPublished: !!(p.workaround && typeof p.workaround === 'object' && p.workaround.publishedToPortal),
    linkedTicketIds: p.linkedTicketIds || [],
    knowledgeIds: workaroundAtomIds(p),
    resolvedByChangeId: p.resolvedByChangeId || null,
    // `firstSeenAt` is this view's name for the moment the cause started
    // producing incidents; the seed records it as `identifiedAt`.
    firstSeenAt: p.firstSeenAt || p.identifiedAt || p.createdAt || null,
    impactStatement: typeof p.impact === 'string' ? p.impact : '',
    affectedServices: p.affectedServices || [],
    category: p.category || '',
    labels: p.labels || [],
    rca: p.rca && Array.isArray(p.rca.statements) ? p.rca : null,
  };
}

/** Human label for the RCA technique the investigator used. */
const RCA_TECHNIQUE = {
  five_whys: 'Five whys',
  timeline: 'Timeline',
  fishbone: 'Cause and effect',
  fault_tree: 'Fault tree',
};

function hasWorkaround(p) {
  return String(p.workaround || '').trim().length > 0;
}

function isKnownErrorViolation(p) {
  return p.status === 'known_error' && !hasWorkaround(p);
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysSince(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = NOW.getTime() - d.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function unique(list) {
  return Array.from(new Set(list));
}

/**
 * Modal dismissal is DOM-containment based, so a nested picker rendered through
 * its own portal counts as "outside" its parent — one click inside the picker
 * would otherwise close the record behind it. Handing the parent a no-op close
 * while a child is open freezes it in place until the child is done.
 */
function noop() {}

/**
 * Continue the workspace's own numbering rather than imposing one. The seed
 * runs PRB-201…PRB-205, so the width is taken from the records on hand — a new
 * record numbered PRB-0206 next to PRB-205 reads as a different system.
 */
function nextProblemKey(problems) {
  let max = 200;
  let width = 3;
  for (const p of problems || []) {
    const m = /PRB-(\d+)/.exec(String(p.key || ''));
    if (!m) continue;
    max = Math.max(max, Number(m[1]));
    width = Math.max(width, m[1].length);
  }
  return `PRB-${String(max + 1).padStart(width, '0')}`;
}

/* ==================================================================== *
 * Reading records other modules own
 * ==================================================================== */

function ticketTitleOf(t) {
  return t.subject || t.title || t.id;
}

function ticketRefOf(t) {
  return t.key || t.number || t.id;
}

function ticketDateOf(t) {
  return t.createdAt || t.openedAt || t.created || null;
}

function ticketIsOpen(t) {
  return !['resolved', 'closed', 'cancelled'].includes(t.status);
}

function requesterNameOf(ticket, people) {
  const contact = people.contacts.find(c => c.id === ticket.contactId);
  if (contact) return contact.name;
  const person = people.directory.find(p => p.id === (ticket.requesterId || ticket.requestedById));
  if (person) return person.name;
  return ticket.requesterName || null;
}

/**
 * Who is hurt by this incident. External deployments answer "which customer",
 * internal deployments answer "which team" — one record type, two vocabularies,
 * which is exactly the split RelayHQ exists to hold on one substrate.
 */
function affiliationOf(ticket, people) {
  const contact = people.contacts.find(c => c.id === ticket.contactId);
  const orgId = ticket.orgId || ticket.organizationId || contact?.orgId || null;
  const org = people.organizations.find(o => o.id === orgId);
  if (org) return { kind: 'org', name: org.name, plan: org.plan };
  const person = people.directory.find(p => p.id === (ticket.requesterId || ticket.requestedById));
  if (person?.department) return { kind: 'team', name: person.department };
  return null;
}

/** The impact summary: how many tickets, who is affected, when it started. */
function impactOf(problem, tickets, people) {
  const ids = problem.linkedTicketIds || [];
  const found = [];
  const dangling = [];
  for (const id of ids) {
    const t = tickets.find(x => x.id === id);
    if (t) found.push(t); else dangling.push(id);
  }

  const orgs = [];
  const teams = [];
  for (const t of found) {
    const aff = affiliationOf(t, people);
    if (!aff) continue;
    if (aff.kind === 'org') orgs.push(aff.name); else teams.push(aff.name);
  }

  const requesters = unique(found.map(t => requesterNameOf(t, people)).filter(Boolean));
  const dates = found.map(ticketDateOf).filter(Boolean).sort();
  const firstSeen = problem.firstSeenAt || dates[0] || problem.createdAt || null;
  const latest = dates.length ? dates[dates.length - 1] : null;

  return {
    tickets: found,
    dangling,
    orgs: unique(orgs),
    teams: unique(teams),
    requesters,
    firstSeen,
    latest,
    open: found.filter(ticketIsOpen).length,
    days: daysSince(firstSeen),
  };
}

/* ==================================================================== *
 * THE VIEW
 * ==================================================================== */

export default function Problems({ route }) {
  const raw = useStore(s => s.problems || []);
  const tickets = useStore(s => s.tickets || []);
  const contacts = useStore(s => s.contacts || []);
  const organizations = useStore(s => s.organizations || []);
  const directory = useStore(s => s.directory || []);

  const [tab, setTab] = useState('open');
  const [creating, setCreating] = useState(false);

  const problems = useMemo(() => raw.map(normalize), [raw]);
  const people = useMemo(() => ({ contacts, organizations, directory }), [contacts, organizations, directory]);

  // ⌘K and the shared search index link a problem as #/problems/<id>, which the
  // router reads into `sub`. Accept it from either segment so every deep link
  // that exists in the app actually opens the record.
  const routeId = route?.id || (TAB_KEYS.includes(route?.sub) ? null : route?.sub) || null;
  const selected = routeId ? problems.find(p => p.id === routeId || p.key === routeId) : null;

  const counts = useMemo(() => {
    const out = {};
    for (const x of TABS) out[x.value] = problems.filter(p => inTab(p, x.value)).length;
    return out;
  }, [problems]);

  const violations = useMemo(() => problems.filter(isKnownErrorViolation), [problems]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={OctagonAlert}
        accent={HUE}
        title="Problem Management"
        subtitle="Northwind Systems · the root cause behind repeated incidents, and the change that removes it"
        actions={<Button variant="solid" accent={HUE} icon={Plus} onClick={() => setCreating(true)}>New problem</Button>}
      >
        <Toolbar>
          <SubTabs
            value={tab}
            onChange={setTab}
            items={TABS.map(x => ({ ...x, count: counts[x.value] }))}
          />
        </Toolbar>
      </PageHeader>

      <PageBody className="@container">
        <ProblemList
          problems={problems}
          tickets={tickets}
          people={people}
          tab={tab}
          onTab={setTab}
          onOpen={(p) => navigate('problems', null, p.id)}
          onNew={() => setCreating(true)}
          violations={violations}
          missingId={routeId && !selected ? routeId : null}
        />
      </PageBody>

      {selected && (
        <ProblemDetail
          problemId={selected.id}
          onClose={() => navigate('problems')}
        />
      )}

      <NewProblemModal open={creating} onClose={() => setCreating(false)} problems={raw} />
    </div>
  );
}

/* ==================================================================== *
 * LIST
 * ==================================================================== */

function ProblemList({ problems, tickets, people, tab, onTab, onOpen, onNew, violations, missingId }) {
  const { t } = useTheme();
  const changes = useStore(s => s.changes || []);
  const directory = useStore(s => s.directory || []);
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState('all');
  const [priorityMenu, setPriorityMenu] = useState(false);
  const [focus, setFocus] = useState(null);

  const rows = useMemo(() => problems.map(p => ({
    problem: p,
    impact: impactOf(p, tickets, people),
  })), [problems, tickets, people]);

  const stats = useMemo(() => {
    const open = rows.filter(r => inTab(r.problem, 'open'));
    return {
      open: open.length,
      known: rows.filter(r => r.problem.status === 'known_error').length,
      awaitingFix: rows.filter(r => r.problem.status === 'known_error' && !r.problem.resolvedByChangeId).length,
      unassigned: open.filter(r => !r.problem.assigneeId).length,
      incidents: open.reduce((n, r) => n + r.impact.tickets.length, 0),
    };
  }, [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter(r => inTab(r.problem, tab))
      .filter(r => priority === 'all' || r.problem.priority === priority)
      .filter(r => {
        if (focus === 'awaiting') return r.problem.status === 'known_error' && !r.problem.resolvedByChangeId;
        if (focus === 'unassigned') return !r.problem.assigneeId;
        if (focus === 'incidents') return r.impact.tickets.length > 0;
        return true;
      })
      .filter(r => {
        if (!needle) return true;
        const p = r.problem;
        const hay = `${p.key} ${p.title} ${p.description} ${p.symptom} ${p.rootCause} ${p.workaround}`.toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => {
        const pr = priorityMeta(b.problem.priority).rank - priorityMeta(a.problem.priority).rank;
        if (pr) return pr;
        return b.impact.tickets.length - a.impact.tickets.length;
      });
  }, [rows, tab, priority, focus, q]);

  const grouped = useMemo(() => {
    const map = new Map(LIFECYCLE_KEYS.map(k => [k, []]));
    for (const r of shown) {
      if (!map.has(r.problem.status)) map.set(r.problem.status, []);
      map.get(r.problem.status).push(r);
    }
    return LIFECYCLE_KEYS.filter(k => map.get(k)?.length).map(k => [k, map.get(k)]);
  }, [shown]);

  const priorityLabel = priority === 'all' ? 'Any priority' : priorityMeta(priority).label;

  return (
    <div className="space-y-3">
      {missingId && (
        <Banner accent="red" icon={TriangleAlert} title="That problem is not in this workspace">
          Nothing here matches <code className={t.text}>{missingId}</code>. It may have been deleted, or the link
          predates this demo's data.{' '}
          <button className={cx('underline', t.text)} onClick={() => navigate('problems')}>Clear the link</button>.
        </Banner>
      )}

      {violations.length > 0 && (
        <Banner accent="red" icon={TriangleAlert} title={`${plural(violations.length, 'known error has', 'known errors have')} no workaround`}>
          A known error is <em>defined</em> as a problem with a documented workaround. These records promise support
          agents a way to restore service and do not deliver one:{' '}
          <ChipGroup accent="red" items={violations} max={3} render={(p) => p.key} />
        </Banner>
      )}

      <Toolbar>
        <Stat label="open problems" value={stats.open} accent={HUE} icon={OctagonAlert}
          active={tab === 'open' && !focus} onClick={() => { onTab('open'); setFocus(null); }} />
        <Stat label="known errors" value={stats.known} accent="orange" icon={Lightbulb}
          active={tab === 'known' && !focus} onClick={() => { onTab('known'); setFocus(null); }} />
        <Stat label="awaiting a permanent fix" value={stats.awaitingFix} accent="red" icon={Wrench}
          active={focus === 'awaiting'} onClick={() => setFocus(f => f === 'awaiting' ? null : 'awaiting')} />
        <Stat label="incidents explained" value={stats.incidents} accent={TICKET_HUE} icon={Inbox}
          active={focus === 'incidents'} onClick={() => setFocus(f => f === 'incidents' ? null : 'incidents')} />
        <Stat label="unassigned" value={stats.unassigned} accent="slate" icon={Users}
          active={focus === 'unassigned'} onClick={() => setFocus(f => f === 'unassigned' ? null : 'unassigned')} />
      </Toolbar>

      <Toolbar>
        <SearchInput
          value={q}
          onChange={setQ}
          accent={HUE}
          width="w-full max-w-md"
          placeholder="Search titles, symptoms, root causes and workarounds…"
        />
        <div className="relative">
          <FilterPill icon={ListFilter} label={priorityLabel} active={priority !== 'all'}
            open={priorityMenu} onClick={() => setPriorityMenu(v => !v)} />
          <Menu open={priorityMenu} onClose={() => setPriorityMenu(false)} width="w-48">
            <MenuLabel>Filter by priority</MenuLabel>
            <MenuItem label="Any priority" accent={HUE} selected={priority === 'all'}
              onClick={() => { setPriority('all'); setPriorityMenu(false); }} />
            {PRIORITY_KEYS.map(k => (
              <MenuItem key={k} label={priorityMeta(k).label} accent={priorityMeta(k).hue} selected={priority === k}
                onClick={() => { setPriority(k); setPriorityMenu(false); }} />
            ))}
          </Menu>
        </div>
      </Toolbar>

      {!shown.length && (
        <Card className="py-2">
          <EmptyState
            icon={OctagonAlert}
            title={problems.length ? 'Nothing matches these filters' : 'No problems recorded'}
            hint={problems.length
              ? 'Widen the tab, clear the priority filter, or search a different phrase.'
              : 'A problem is opened when the same failure produces incident after incident. Group them here, prove the cause once, and let one change close the whole set.'}
            action={problems.length
              ? <Button variant="outline" onClick={() => { setQ(''); setPriority('all'); setFocus(null); }}>Clear filters</Button>
              : <Button variant="solid" accent={HUE} icon={Plus} onClick={onNew}>New problem</Button>}
          />
        </Card>
      )}

      {grouped.map(([status, list]) => (
        <Section key={status} className="pt-1">
          <div className="flex items-center gap-2 mb-1.5">
            <GroupLabel>{statusMeta(status).label}</GroupLabel>
            <span className={cx('text-[11px] tabular-nums', t.textMuted)}>{list.length}</span>
            <Divider className="flex-1" />
          </div>
          <div className={DENSITY.rowGap}>
            {list.map(r => (
              <ProblemRow key={r.problem.id} problem={r.problem} impact={r.impact}
                changes={changes} directory={directory} onOpen={onOpen} />
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

function ProblemRow({ problem, impact, changes, directory, onOpen }) {
  const { t, a } = useTheme();
  const kb = a(KB_HUE);
  const fix = problem.resolvedByChangeId ? changes.find(c => c.id === problem.resolvedByChangeId) : null;
  const owner = directory.find(p => p.id === problem.assigneeId);
  const violation = isKnownErrorViolation(problem);
  const affected = [...impact.orgs, ...impact.teams];

  return (
    <ListRow
      accent={HUE}
      icon={stageIcon(problem.status)}
      alert={violation}
      onClick={() => onOpen(problem)}
      title={`${problem.key} · ${problem.title}`}
      subtitle={problem.rootCause || problem.symptom || problem.description || 'No symptom recorded yet'}
      meta={
        <>
          {impact.tickets.length > 0 && (
            <span className={cx('hidden @md:flex items-center gap-1 text-xs tabular-nums', t.textMuted)}
              title={`Linked incidents: ${impact.tickets.map(ticketRefOf).join(', ')}`}>
              <Inbox size={ICON.sm} />
              {impact.tickets.length}
            </span>
          )}
          {problem.knowledgeIds.length > 0 && (
            <span className="hidden @lg:inline-flex" title="Workaround is published as a knowledge atom">
              <BookOpen size={ICON.sm} className={kb.fg} />
            </span>
          )}
          {fix && <Chip accent={CHANGE_HUE} icon={GitBranch} title={`${fix.key || fix.id} — ${fix.title || ''}`}>{fix.key || fix.id}</Chip>}
          <StatusPill status={problem.status} />
          <PriorityFlag priority={problem.priority} withLabel={false} />
          {owner ? <Avatar name={owner.name} size="sm" /> : <Chip accent="slate">Unassigned</Chip>}
        </>
      }
    >
      {affected.length > 0 && (
        <div className="mt-1 flex items-center gap-1.5 min-w-0">
          <ChipGroup accent="slate" icon={Building2} max={3} items={affected} />
          {impact.firstSeen && (
            <span className={cx('text-[11px] whitespace-nowrap', t.textMuted)}>
              first seen {fmtDate(impact.firstSeen)}
            </span>
          )}
        </div>
      )}
    </ListRow>
  );
}

/* ==================================================================== *
 * DETAIL
 * ==================================================================== */

const WORKAROUND_ANCHOR = 'rhq-problem-workaround';

function ProblemDetail({ problemId, onClose }) {
  const { t } = useTheme();
  const record = useStore(s => (s.problems || []).find(p => p.id === problemId) || null);
  const tickets = useStore(s => s.tickets || []);
  const contacts = useStore(s => s.contacts || []);
  const organizations = useStore(s => s.organizations || []);
  const directory = useStore(s => s.directory || []);

  const [blocked, setBlocked] = useState(false);
  const [picker, setPicker] = useState(null);       // 'incident' | 'change' | 'knowledge'
  const [confirming, setConfirming] = useState(false);

  const people = useMemo(() => ({ contacts, organizations, directory }), [contacts, organizations, directory]);
  const problem = record ? normalize(record) : null;
  const impact = useMemo(() => problem ? impactOf(problem, tickets, people) : null, [problem, tickets, people]);

  if (!problem) return null;

  const owner = directory.find(p => p.id === problem.assigneeId);
  const next = NEXT_ACTION[problem.status];
  const ready = hasWorkaround(problem);
  const locked = picker !== null || confirming;

  function patch(fields) {
    patchIn('problems', problem.id, fields);
  }

  function attempt(to) {
    if (to === 'known_error' && !hasWorkaround(problem)) {
      setBlocked(true);
      const el = typeof document !== 'undefined' ? document.getElementById(WORKAROUND_ANCHOR) : null;
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setBlocked(false);
    const fields = { status: to };
    if (to === 'resolved') fields.resolvedAt = new Date().toISOString();
    if (to === 'closed') fields.closedAt = new Date().toISOString();
    patch(fields);
  }

  return (
    <Modal
      open
      onClose={locked ? noop : onClose}
      accent={HUE}
      size="modalXl"
      icon={stageIcon(problem.status)}
      title={`${problem.key} · ${problem.title}`}
      subtitle={owner ? `Owned by ${owner.name}` : 'Unassigned — nobody is investigating this'}
      footer={
        <>
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" accent="red" icon={Trash2} size="sm" onClick={() => setConfirming(true)}>
              Delete
            </Button>
            <span className={cx('text-xs truncate', t.textMuted)}>
              {impact.firstSeen ? `First seen ${fmtDate(impact.firstSeen)}` : 'First seen not recorded'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {next && (
              <Button
                variant="solid"
                accent={next.to === 'known_error' && !ready ? 'gray' : HUE}
                icon={next.icon}
                onClick={() => attempt(next.to)}
              >
                {next.label}
              </Button>
            )}
          </div>
        </>
      }
    >
      <div className="space-y-4 @container">
        <div className="flex items-center gap-2 flex-wrap">
          <EntityTag kind="problem" />
          <StatusPill status={problem.status} />
          <PriorityFlag priority={problem.priority} />
          {owner && <Avatar name={owner.name} size="sm" />}
          <span className="flex-1" />
          <div className="w-36">
            <Select
              accent={HUE}
              value={problem.priority}
              onChange={(e) => patch({ priority: e.target.value })}
              options={PRIORITY_KEYS.map(k => ({ value: k, label: `${priorityMeta(k).label} priority` }))}
            />
          </div>
          <div className="w-48">
            <Select
              accent={HUE}
              value={problem.assigneeId || ''}
              placeholder="Unassigned"
              onChange={(e) => patch({ assigneeId: e.target.value || null })}
              options={directory.map(p => ({ value: p.id, label: p.name }))}
            />
          </div>
        </div>

        <StateLadder problem={problem} blocked={blocked} onAttempt={attempt} />

        <ImpactSummary problem={problem} impact={impact} />

        <RcaSection problem={problem} blocked={blocked} onPatch={patch}
          onWorkaroundChange={(v) => { patch({ workaround: v }); if (v.trim()) setBlocked(false); }} />

        <IncidentsSection problem={problem} impact={impact} people={people}
          onLink={() => setPicker('incident')} />

        <PermanentFixSection problem={problem} onLink={() => setPicker('change')} />

        <KnowledgeSection problem={problem} impact={impact} onLink={() => setPicker('knowledge')} />
      </div>

      <LinkIncidentModal open={picker === 'incident'} problem={problem} people={people} onClose={() => setPicker(null)} />
      <LinkChangeModal open={picker === 'change'} problem={problem} onClose={() => setPicker(null)} />
      <LinkKnowledgeModal open={picker === 'knowledge'} problem={problem} onClose={() => setPicker(null)} />

      <ConfirmDelete
        open={confirming}
        name={problem.title}
        kind="problem"
        cascadeNote={`${plural(problem.linkedTicketIds.length, 'incident', 'incidents')} lose their root-cause link and the workaround stops appearing on them. The incidents themselves are not deleted.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { removeFrom('problems', problem.id); setConfirming(false); onClose(); }}
      />
    </Modal>
  );
}

/* -------------------------------------------------------------------- *
 * State ladder
 * -------------------------------------------------------------------- */

function StateLadder({ problem, blocked, onAttempt }) {
  const { t, a } = useTheme();
  const c = a(HUE);
  const currentIndex = LIFECYCLE_KEYS.indexOf(problem.status);
  const ready = hasWorkaround(problem);
  const violation = isKnownErrorViolation(problem);

  return (
    <Card>
      <div className={cx(DENSITY.sectionPad, 'flex items-center gap-1.5 overflow-x-auto')}>
        {LIFECYCLE.map((stage, i) => {
          const active = i === currentIndex;
          const done = i < currentIndex;
          const Icon = stage.icon;
          const gated = stage.key === 'known_error' && !ready;
          return (
            <React.Fragment key={stage.key}>
              {i > 0 && <ArrowRight size={ICON.sm} className={cx('flex-shrink-0', done ? c.fg : t.textMuted)} />}
              <button
                onClick={() => onAttempt(stage.key)}
                title={gated ? 'Needs a documented workaround first' : stage.hint}
                className={cx('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors',
                  active ? cx(c.softStrong, c.borderStrong, t.text)
                    : done ? cx(c.soft, 'border-transparent', c.fgOnSoft)
                      : cx(t.bgCard, t.borderLight, t.textSecondary, t.bgHover))}
              >
                <Icon size={ICON.base} className={active || done ? c.fg : t.textMuted} />
                {stage.label}
                {gated && <Lock />}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className={cx('border-t', t.borderLight, DENSITY.sectionPad, 'space-y-2')}>
        <p className={cx('text-xs leading-relaxed', t.textSecondary)}>
          <span className={cx('font-medium', t.text)}>{stageMeta(problem.status).label}.</span>{' '}
          {stageMeta(problem.status).hint}
        </p>

        {blocked && (
          <Banner accent="red" icon={TriangleAlert} title="A known error needs a workaround">
            RelayHQ will not promote this problem until the workaround field below is filled in. “Known error” is not a
            severity — it is a promise that a support agent reading a linked ticket can restore service <em>today</em>,
            before the permanent fix ships. Without the workaround the label is decoration.
          </Banner>
        )}

        {violation && !blocked && (
          <Banner accent="red" icon={TriangleAlert} title="This known error has no workaround">
            The record is published as a known error but the workaround is empty. Either write the workaround or move
            the problem back to <strong>Investigating</strong> so agents are not told a fix exists.
          </Banner>
        )}

        {problem.status === 'investigating' && !ready && (
          <Banner accent="amber" icon={Lightbulb}>
            Publishing this as a <strong>known error</strong> is blocked until a workaround is documented — that is the
            whole difference between “we are looking into it” and “here is what to do in the meantime”.
          </Banner>
        )}

        {problem.status === 'known_error' && !problem.resolvedByChangeId && (
          <Banner accent="amber" icon={Wrench}>
            No permanent fix is linked. Every linked incident stays on the workaround until a change is raised and
            authorised, and the incident count will keep climbing.
          </Banner>
        )}

        {problem.status === 'resolved' && !problem.resolvedByChangeId && (
          <Banner accent="amber" icon={TriangleAlert}>
            Marked resolved with no change linked. If the fix shipped as part of a change, link it — the audit trail
            from incident to root cause to release is the reason this module exists.
          </Banner>
        )}
      </div>
    </Card>
  );
}

/** Small padlock glyph for a gated lifecycle step. */
function Lock() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="flex-shrink-0 opacity-70">
      <rect x="2.5" y="5" width="7" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M4 5V3.6a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* -------------------------------------------------------------------- *
 * Impact
 * -------------------------------------------------------------------- */

function ImpactSummary({ problem, impact }) {
  const { t } = useTheme();
  const affected = impact.orgs.length + impact.teams.length;

  return (
    <Card>
      <div className={cx(DENSITY.sectionPad, 'flex items-center justify-between gap-3')}>
        <div className="flex items-center gap-2 min-w-0">
          <IconTile icon={CircleDot} accent={HUE} size="sm" />
          <div className="min-w-0">
            <p className={cx('text-sm font-medium', t.text)}>Impact</p>
            <p className={cx('text-xs truncate', t.textMuted)}>
              {impact.firstSeen
                ? `First seen ${fmtDate(impact.firstSeen)}${impact.days != null ? ` · ${plural(impact.days, 'day', 'days')} ago` : ''}`
                : 'First seen not recorded'}
              {impact.latest && impact.latest !== impact.firstSeen ? ` · latest incident ${fmtDate(impact.latest)}` : ''}
            </p>
          </div>
        </div>
        {impact.requesters.length > 0 && <AvatarStack names={impact.requesters} max={5} size="md" />}
      </div>

      <div className={cx('border-t', t.borderLight, DENSITY.sectionPad, 'space-y-3')}>
        {problem.impactStatement && (
          <p className={cx('text-xs leading-relaxed', t.textSecondary)}>{problem.impactStatement}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Stat label={impact.tickets.length === 1 ? 'incident linked' : 'incidents linked'}
            value={impact.tickets.length} accent={TICKET_HUE} icon={Inbox} />
          <Stat label="still open" value={impact.open} accent={impact.open ? 'amber' : 'emerald'} icon={CircleDot} />
          <Stat label={affected === 1 ? 'customer or team affected' : 'customers and teams affected'}
            value={affected} accent="slate" icon={Building2} />
          <Stat label={impact.days === 1 ? 'day unresolved' : 'days unresolved'}
            value={impact.days == null ? 0 : impact.days} accent={HUE} icon={CalendarDays} />
        </div>

        {impact.orgs.length > 0 && (
          <div className="flex items-baseline gap-2 flex-wrap">
            <GroupLabel className="w-24 flex-shrink-0">Customers</GroupLabel>
            <ChipGroup accent="slate" icon={Building2} max={5} items={impact.orgs} />
          </div>
        )}

        {impact.teams.length > 0 && (
          <div className="flex items-baseline gap-2 flex-wrap">
            <GroupLabel className="w-24 flex-shrink-0">Internal teams</GroupLabel>
            <ChipGroup accent="gray" icon={Users} max={5} items={impact.teams} />
          </div>
        )}

        {!impact.tickets.length && (
          <Banner accent="blue" icon={Inbox}>
            No incidents are linked yet, so this problem has no measured impact. Link the tickets it explains and the
            counts above become the case for prioritising the permanent fix.
          </Banner>
        )}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------- *
 * Root cause analysis
 * -------------------------------------------------------------------- */

function RcaSection({ problem, blocked, onPatch, onWorkaroundChange }) {
  const { t } = useTheme();
  const violation = isKnownErrorViolation(problem);
  const needsWorkaround = blocked || violation;

  return (
    <Card>
      <div className={cx(DENSITY.sectionPad, 'flex items-center gap-2')}>
        <IconTile icon={Microscope} accent={HUE} size="sm" />
        <div className="min-w-0">
          <p className={cx('text-sm font-medium', t.text)}>Root cause analysis</p>
          <p className={cx('text-xs', t.textMuted)}>
            What people see, why it happens, and what support does about it until the fix lands
          </p>
        </div>
      </div>

      <div className={cx('border-t', t.borderLight, DENSITY.sectionPad, 'space-y-3')}>
        <RcaField
          icon={Stethoscope}
          accent="rose"
          label="Symptom"
          hint="What the customer or employee actually reports. Write it in their words — this is what a triaging agent matches against."
          value={problem.symptom}
          placeholder="e.g. Checkout fails with “payment provider unavailable” on the third attempt, only for stores using saved cards."
          onChange={(v) => onPatch({ symptom: v })}
        />

        <RcaField
          icon={Microscope}
          accent={HUE}
          label="Root cause"
          hint="The proven mechanism, not the hypothesis. If it is still a guess, say so — an unproven cause dressed as fact ends investigation early."
          value={problem.rootCause}
          placeholder="e.g. The payment gateway connection pool is sized for 40 concurrent calls; saved-card checkouts open two."
          onChange={(v) => onPatch({ rootCause: v })}
        />

        <div id={WORKAROUND_ANCHOR}>
          <RcaField
            icon={Lightbulb}
            accent="orange"
            label="Workaround"
            required
            error={needsWorkaround ? 'Required before this problem can be a known error.' : null}
            hint="The steps that restore service now. This is the field that turns a problem into a known error, and the one an agent reads mid-conversation."
            value={problem.workaround}
            placeholder="e.g. Ask the customer to complete the purchase with card entry rather than a saved card; the retry succeeds on the second attempt."
            onChange={onWorkaroundChange}
          />
          {hasWorkaround(problem) && (
            <div className="mt-1 flex items-center gap-1.5">
              <Chip accent={problem.workaroundPublished ? 'emerald' : 'slate'} icon={Building2}>
                {problem.workaroundPublished ? 'Visible in the customer portal' : 'Internal only'}
              </Chip>
            </div>
          )}
        </div>

        <RcaTrail rca={problem.rca} />

        {problem.affectedServices.length > 0 && (
          <div className="flex items-baseline gap-2 flex-wrap">
            <GroupLabel className="w-24 flex-shrink-0">Affected</GroupLabel>
            <ChipGroup accent={HUE} icon={Server} max={4} items={problem.affectedServices} />
          </div>
        )}

        <Banner accent={hasWorkaround(problem) ? 'emerald' : 'blue'} icon={hasWorkaround(problem) ? Check : Lightbulb}>
          {hasWorkaround(problem)
            ? 'A workaround is documented, so this problem can be published as a known error. Attach it to a knowledge atom below and every agent working a linked incident sees it in context.'
            : 'Known error is the state that says “we understand this and here is what to do about it”. It stays out of reach until the workaround is written.'}
        </Banner>
      </div>
    </Card>
  );
}

/**
 * The recorded investigation — five whys or a timeline, plus the contributing
 * factors. The seed authors this on every problem; showing the chain is the
 * difference between a root-cause field somebody typed and a cause somebody
 * can audit.
 */
function RcaTrail({ rca }) {
  const { t, a } = useTheme();
  const c = a(HUE);
  if (!rca) return null;
  const factors = rca.contributingFactors || [];

  return (
    <div className={cx('rounded-xl border', t.borderLight, DENSITY.rowPad)}>
      <div className="flex items-center gap-1.5 mb-2">
        <Layers size={ICON.sm} className={c.fg} />
        <GroupLabel>{RCA_TECHNIQUE[rca.technique] || 'Investigation'}</GroupLabel>
      </div>
      <ol className="space-y-1">
        {rca.statements.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={cx('text-[10px] font-semibold tabular-nums mt-0.5 flex-shrink-0', c.fg)}>{i + 1}</span>
            <span className={cx('text-xs leading-relaxed', t.textSecondary)}>{s}</span>
          </li>
        ))}
      </ol>
      {factors.length > 0 && (
        <div className={cx('mt-2 pt-2 border-t', t.borderLight)}>
          <GroupLabel className="mb-1">Contributing factors</GroupLabel>
          <ul className="space-y-1">
            {factors.map((f, i) => (
              <li key={i} className={cx('text-xs leading-relaxed', t.textMuted)}>· {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RcaField({ icon: Icon, accent, label, hint, value, placeholder, required, error, onChange }) {
  const { t, a } = useTheme();
  const c = a(accent);
  const danger = a('red');
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={ICON.base} className={c.fg} />
        <span className={cx('text-xs font-semibold uppercase tracking-wider', t.textSecondary)}>{label}</span>
        {required && <span className={cx('text-xs', danger.fg)}>*</span>}
        {!String(value || '').trim() && (
          <span className={cx('text-[10px]', t.textMuted)}>not recorded</span>
        )}
      </div>
      <Field hint={hint} error={error}>
        <Textarea
          accent={accent}
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={error ? danger.borderStrong : undefined}
        />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------- *
 * Linked incidents
 * -------------------------------------------------------------------- */

function IncidentsSection({ problem, impact, people, onLink }) {
  const { t, a } = useTheme();

  function unlink(id) {
    patchIn('problems', problem.id, (prev) => ({
      linkedTicketIds: (prev.linkedTicketIds || []).filter(x => x !== id),
    }));
  }

  return (
    <Panel
      icon={Inbox}
      accent={TICKET_HUE}
      title={`${plural(impact.tickets.length, 'incident', 'incidents')} linked`}
      subtitle={impact.open
        ? `${plural(impact.open, 'is', 'are')} still open — the workaround is what they run on`
        : 'Every linked incident is closed'}
      action={<Button variant="soft" accent={TICKET_HUE} size="sm" icon={Link2} onClick={onLink}>Link incident</Button>}
    >
      <div className={cx('divide-y', t.borderLight)}>
        {impact.tickets.map(ticket => (
          <IncidentRow key={ticket.id} ticket={ticket} people={people} onUnlink={() => unlink(ticket.id)} />
        ))}

        {impact.dangling.map(id => (
          <div key={id} className={cx('flex items-center gap-3', DENSITY.rowPad)}>
            <TriangleAlert size={ICON.base} className={cx('flex-shrink-0', a('red').fg)} />
            <div className="flex-1 min-w-0">
              <p className={cx('text-sm truncate', t.text)}>{id}</p>
              <p className={cx('text-xs', t.textMuted)}>Linked incident is not in this workspace</p>
            </div>
            <IconButton icon={Unlink} accent="red" label="Remove link" onClick={() => unlink(id)} />
          </div>
        ))}

        {!impact.tickets.length && !impact.dangling.length && (
          <div className={cx(DENSITY.sectionPad, 'text-xs', t.textMuted)}>
            Nothing linked yet. Linking an incident does not close it — it records that this cause explains it, so the
            workaround shows up for the agent and the incident count becomes evidence for the fix.
          </div>
        )}
      </div>
    </Panel>
  );
}

function IncidentRow({ ticket, people, onUnlink }) {
  const { t, a } = useTheme();
  const requester = requesterNameOf(ticket, people);
  const aff = affiliationOf(ticket, people);
  const created = fmtDate(ticketDateOf(ticket));

  return (
    <div className={cx('group flex items-center gap-3', DENSITY.rowPad)}>
      <span className={cx('w-1 self-stretch min-h-7 rounded-full flex-shrink-0', a(TICKET_HUE).rail)} />
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm truncate', t.text)}>
          <span className={cx('font-mono text-xs mr-1.5', t.textMuted)}>{ticketRefOf(ticket)}</span>
          {ticketTitleOf(ticket)}
        </p>
        <p className={cx('text-xs truncate', t.textMuted)}>
          {[requester, aff?.name, created].filter(Boolean).join(' · ') || 'No requester recorded'}
        </p>
      </div>
      {ticket.priority && <PriorityFlag priority={ticket.priority} withLabel={false} />}
      {ticket.status && <StatusPill status={ticket.status} />}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        {/* Workspace reads the record kind from the SECOND segment and it is
            singular there — `tickets` opens nothing. */}
        <IconButton icon={ExternalLink} label="Open incident" accent={TICKET_HUE}
          onClick={() => navigate('workspace', 'ticket', ticket.id)} />
        <IconButton icon={Unlink} label="Unlink incident" accent="red" onClick={onUnlink} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- *
 * Permanent fix — the problem → change half of the chain
 * -------------------------------------------------------------------- */

function PermanentFixSection({ problem, onLink }) {
  const { t } = useTheme();
  const changes = useStore(s => s.changes || []);
  const change = problem.resolvedByChangeId ? changes.find(c => c.id === problem.resolvedByChangeId) : null;
  const missing = problem.resolvedByChangeId && !change;

  function unlink() {
    patchIn('problems', problem.id, { resolvedByChangeId: null });
  }

  return (
    <Panel
      icon={GitBranch}
      accent={CHANGE_HUE}
      title="Permanent fix"
      subtitle="The change that removes the cause, so the workaround can be retired"
      action={change
        ? <Button variant="ghost" accent="red" size="sm" icon={Unlink} onClick={unlink}>Unlink</Button>
        : <Button variant="soft" accent={CHANGE_HUE} size="sm" icon={Link2} onClick={onLink}>Link a change</Button>}
    >
      <div className={cx(DENSITY.sectionPad, 'space-y-2')}>
        {change && (
          <ListRow
            accent={CHANGE_HUE}
            icon={GitBranch}
            title={`${change.key || change.id} · ${change.title || 'Untitled change'}`}
            subtitle={[change.changeType && `${change.changeType} change`, change.plannedStart && `window ${fmtDate(change.plannedStart)}`]
              .filter(Boolean).join(' · ') || 'No window scheduled'}
            onClick={() => navigate('changes', 'list', change.id)}
            meta={<>
              {change.status && <StatusPill status={change.status} />}
              <ExternalLink size={ICON.sm} className={t.textMuted} />
            </>}
          />
        )}

        {missing && (
          <Banner accent="red" icon={TriangleAlert} title="Linked change not found">
            This problem points at <code className={t.text}>{problem.resolvedByChangeId}</code>, which is not in this
            workspace. Relink it so the chain from incident to fix stays intact.
          </Banner>
        )}

        {!change && !missing && (
          <Banner accent="blue" icon={GitBranch}>
            Nothing scheduled. A problem is only truly closed by a change — until one is linked and implemented, every
            new incident with this cause lands back on the workaround.
          </Banner>
        )}

        {change && ['closed', 'completed'].includes(change.status) && problem.status !== 'resolved' && (
          <Banner accent="emerald" icon={Check}>
            The change is finished but the problem is still <strong>{statusMeta(problem.status).label}</strong>. If the
            fix held, move the problem to Resolved so the workaround stops being offered.
          </Banner>
        )}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------- *
 * Linked knowledge — the workaround where agents actually read it
 * -------------------------------------------------------------------- */

/** Format glyph for an atom, dimmed when the atom itself cannot be resolved. */
function AtomGlyph({ atom }) {
  const { t, a } = useTheme();
  const Icon = atomIcon(atom);
  return <Icon size={ICON.base} className={cx('flex-shrink-0', atom ? a(atomHue(atom)).fg : t.textMuted)} />;
}

function KnowledgeSection({ problem, impact, onLink }) {
  const { t } = useTheme();
  const knowledge = useStore(s => s.knowledge || []);
  const atoms = (problem.knowledgeIds || []).map(id => ({ id, atom: knowledge.find(k => k.id === id) || null }));

  // Build from the NORMALISED list, not from the raw record: a seeded problem
  // carries its atom inside `workaround.knowledgeId` and has no `knowledgeIds`
  // array yet, so patching from `prev` would silently drop it on first edit.
  function unlink(id) {
    patchIn('problems', problem.id, {
      knowledgeIds: (problem.knowledgeIds || []).filter(x => x !== id),
    });
  }

  return (
    <Panel
      icon={BookOpen}
      accent={KB_HUE}
      title="Workaround in the agent's hands"
      subtitle="Knowledge atoms attached here surface on every linked incident — and in the portal, and as a lesson"
      action={<Button variant="soft" accent={KB_HUE} size="sm" icon={Link2} onClick={onLink}>Attach atom</Button>}
    >
      <div className={cx('divide-y', t.borderLight)}>
        {atoms.map(({ id, atom }) => (
          <div key={id} className={cx('group flex items-center gap-3', DENSITY.rowPad)}>
            <AtomGlyph atom={atom} />
            <div className="flex-1 min-w-0">
              <p className={cx('text-sm truncate', t.text)}>{atom ? atom.title : id}</p>
              <p className={cx('text-xs truncate', t.textMuted)}>
                {atom ? (atom.summary || 'No summary') : 'Knowledge atom is not in this workspace'}
              </p>
            </div>
            {atom?.format && <Chip accent={atomHue(atom)}>{atom.format}</Chip>}
            {atom?.audience && <Chip accent="slate">{atom.audience}</Chip>}
            {atom?.status && <StatusPill status={atom.status} />}
            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <IconButton icon={ExternalLink} label="Open atom" accent={KB_HUE}
                onClick={() => navigate('knowledge', null, id)} />
              <IconButton icon={Unlink} label="Detach atom" accent="red" onClick={() => unlink(id)} />
            </div>
          </div>
        ))}

        <div className={cx(DENSITY.sectionPad)}>
          {hasWorkaround(problem) && !atoms.length ? (
            <Banner accent="amber" icon={TriangleAlert} title="The workaround is trapped in this record">
              Agents work in the ticket, not in the problem list. Until a knowledge atom carries this workaround, the
              only people who know about it are the ones who thought to open <strong>{problem.key}</strong>.
            </Banner>
          ) : !atoms.length ? (
            <p className={cx('text-xs', t.textMuted)}>
              Nothing attached. One authored atom serves three surfaces here: deflection in the portal, enablement on
              the linked incidents, and a lesson inside the support-agent course.
            </p>
          ) : (
            <Banner accent="emerald" icon={Check}>
              {plural(atoms.length, 'atom is', 'atoms are')} attached. The workaround now reaches agents on{' '}
              {impact.tickets.length
                ? `all ${plural(impact.tickets.length, 'linked incident', 'linked incidents')}`
                : 'every incident linked from here'}{' '}
              without anyone retyping it — and the same atom serves the portal and the support-agent course.
            </Banner>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ==================================================================== *
 * PICKERS
 * ==================================================================== */

function LinkIncidentModal({ open, problem, people, onClose }) {
  const { t } = useTheme();
  const tickets = useStore(s => s.tickets || []);
  const [q, setQ] = useState('');

  const candidates = useMemo(() => {
    const taken = new Set(problem.linkedTicketIds || []);
    const needle = q.trim().toLowerCase();
    return tickets
      .filter(x => !taken.has(x.id))
      .filter(x => {
        if (!needle) return true;
        return `${ticketRefOf(x)} ${ticketTitleOf(x)} ${x.description || ''}`.toLowerCase().includes(needle);
      })
      .slice(0, 60);
  }, [tickets, problem.linkedTicketIds, q]);

  function link(id) {
    patchIn('problems', problem.id, (prev) => ({
      linkedTicketIds: unique([...(prev.linkedTicketIds || []), id]),
    }));
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent={TICKET_HUE}
      size="modalMd"
      z={LAYOUT.zNestedModal}
      icon={Inbox}
      title="Link an incident"
      subtitle={`Record that ${problem.key} explains this ticket`}
      footer={<>
        <span className={cx('text-xs', t.textMuted)}>{plural(candidates.length, 'ticket', 'tickets')} available</span>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </>}
    >
      <div className="space-y-3">
        <Banner accent="blue" icon={Inbox}>
          Linking does not change the ticket's state or its SLA. It records the cause, pulls the ticket into this
          problem's impact count, and puts the workaround in front of whoever picks it up next.
        </Banner>

        <SearchInput value={q} onChange={setQ} accent={TICKET_HUE} placeholder="Search incidents…" />

        <div className={DENSITY.rowGap}>
          {candidates.map(ticket => (
            <ListRow
              key={ticket.id}
              accent={TICKET_HUE}
              icon={Inbox}
              onClick={() => link(ticket.id)}
              title={`${ticketRefOf(ticket)} · ${ticketTitleOf(ticket)}`}
              subtitle={[requesterNameOf(ticket, people), affiliationOf(ticket, people)?.name, fmtDate(ticketDateOf(ticket))]
                .filter(Boolean).join(' · ') || 'No requester recorded'}
              meta={<>
                {ticket.priority && <PriorityFlag priority={ticket.priority} withLabel={false} />}
                {ticket.status && <StatusPill status={ticket.status} />}
              </>}
            />
          ))}
          {!candidates.length && (
            <EmptyState
              icon={Inbox}
              title={tickets.length ? 'No matching incidents' : 'No incidents in this workspace'}
              hint={tickets.length
                ? 'Every other ticket is already linked, or the search is too narrow.'
                : 'Tickets are authored by the service desk. Once they exist they can be attributed to this cause.'}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function LinkChangeModal({ open, problem, onClose }) {
  const { t } = useTheme();
  const changes = useStore(s => s.changes || []);
  const [q, setQ] = useState('');

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return changes
      .filter(c => c.id !== problem.resolvedByChangeId)
      .filter(c => !needle || `${c.key || ''} ${c.title || ''} ${c.description || ''}`.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [changes, problem.resolvedByChangeId, q]);

  function link(id) {
    patchIn('problems', problem.id, { resolvedByChangeId: id });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent={CHANGE_HUE}
      size="modalMd"
      z={LAYOUT.zNestedModal}
      icon={GitBranch}
      title="Link the permanent fix"
      subtitle={`The change that removes the cause behind ${problem.key}`}
      footer={<>
        <span className={cx('text-xs', t.textMuted)}>{plural(candidates.length, 'change', 'changes')} available</span>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </>}
    >
      <div className="space-y-3">
        <Banner accent="amber" icon={Wrench}>
          One change per problem. If the fix needs several changes, the honest model is several problems or one change
          with several tasks — a problem with two “permanent” fixes is a problem nobody can tell is finished.
        </Banner>

        <SearchInput value={q} onChange={setQ} accent={CHANGE_HUE} placeholder="Search changes…" />

        <div className={DENSITY.rowGap}>
          {candidates.map(change => (
            <ListRow
              key={change.id}
              accent={CHANGE_HUE}
              icon={GitBranch}
              onClick={() => link(change.id)}
              title={`${change.key || change.id} · ${change.title || 'Untitled change'}`}
              subtitle={[change.changeType && `${change.changeType} change`, change.plannedStart && fmtDate(change.plannedStart)]
                .filter(Boolean).join(' · ') || 'No window scheduled'}
              meta={change.status ? <StatusPill status={change.status} /> : null}
            />
          ))}
          {!candidates.length && (
            <EmptyState
              icon={GitBranch}
              title={changes.length ? 'No matching changes' : 'No changes in this workspace'}
              hint={changes.length
                ? 'Try a different phrase, or raise the change in Change Management first.'
                : 'Raise the change in Change Management, then come back and link it here.'}
              action={<Button variant="soft" accent={CHANGE_HUE} icon={ExternalLink}
                onClick={() => navigate('changes', 'list')}>Open Change Management</Button>}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function LinkKnowledgeModal({ open, problem, onClose }) {
  const { t } = useTheme();
  const knowledge = useStore(s => s.knowledge || []);
  const [q, setQ] = useState('');

  const candidates = useMemo(() => {
    const taken = new Set(problem.knowledgeIds || []);
    const needle = q.trim().toLowerCase();
    return knowledge
      .filter(k => !taken.has(k.id))
      .filter(k => !needle || `${k.title || ''} ${k.summary || ''} ${(k.tags || []).join(' ')}`.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [knowledge, problem.knowledgeIds, q]);

  function link(id) {
    // Seeded records carry their atom on `workaround.knowledgeId`; `problem` is
    // already normalised, so starting from it keeps that atom attached.
    patchIn('problems', problem.id, { knowledgeIds: unique([...(problem.knowledgeIds || []), id]) });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent={KB_HUE}
      size="modalMd"
      z={LAYOUT.zNestedModal}
      icon={BookOpen}
      title="Attach a knowledge atom"
      subtitle="The same atom deflects in the portal, enables the agent, and teaches in a course"
      footer={<>
        <span className={cx('text-xs', t.textMuted)}>{plural(candidates.length, 'atom', 'atoms')} available</span>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
      </>}
    >
      <div className="space-y-3">
        <Banner accent="blue" icon={BookOpen}>
          Atoms are not copied into this problem. The article stays owned by Knowledge, and attaching it here simply
          adds one more surface where it appears — which is why editing it once fixes it everywhere.
        </Banner>

        <SearchInput value={q} onChange={setQ} accent={KB_HUE} placeholder="Search knowledge…" />

        <div className={DENSITY.rowGap}>
          {candidates.map(atom => (
            <ListRow
              key={atom.id}
              accent={atomHue(atom)}
              icon={atomIcon(atom)}
              onClick={() => link(atom.id)}
              title={atom.title}
              subtitle={atom.summary}
              meta={<>
                {atom.audience && <Chip accent="slate">{atom.audience}</Chip>}
                {atom.format && <Chip accent={atomHue(atom)}>{atom.format}</Chip>}
                {atom.status && <StatusPill status={atom.status} />}
              </>}
            />
          ))}
          {!candidates.length && (
            <EmptyState
              icon={BookOpen}
              title={knowledge.length ? 'No matching atoms' : 'No knowledge in this workspace'}
              hint={knowledge.length
                ? 'Everything matching is already attached, or the search is too narrow.'
                : 'Author the workaround in Knowledge first, then attach it here.'}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * CREATE
 * ==================================================================== */

const PRIORITY_TILES = PRIORITY_KEYS.map(k => ({
  value: k, label: priorityMeta(k).label, accent: priorityMeta(k).hue,
}));

function NewProblemModal({ open, onClose, problems }) {
  const { t } = useTheme();
  const tickets = useStore(s => s.tickets || []);
  const directory = useStore(s => s.directory || []);
  const currentUser = useStore(s => s.currentUser);

  const [title, setTitle] = useState('');
  const [symptom, setSymptom] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('high');
  const [assigneeId, setAssigneeId] = useState('');
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState('');
  const [touched, setTouched] = useState(false);

  const claimed = useMemo(() => {
    const set = new Set();
    for (const p of problems || []) for (const id of p.linkedTicketIds || []) set.add(id);
    return set;
  }, [problems]);

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tickets
      .filter(x => !claimed.has(x.id) || picked.includes(x.id))
      .filter(x => !needle || `${ticketRefOf(x)} ${ticketTitleOf(x)}`.toLowerCase().includes(needle))
      .slice(0, 25);
  }, [tickets, claimed, picked, q]);

  function reset() {
    setTitle(''); setSymptom(''); setDescription('');
    setPriority('high'); setAssigneeId(''); setPicked([]); setQ(''); setTouched(false);
  }

  function create() {
    if (!title.trim()) { setTouched(true); return; }
    const dates = picked
      .map(id => tickets.find(x => x.id === id))
      .filter(Boolean)
      .map(ticketDateOf)
      .filter(Boolean)
      .sort();
    const now = new Date().toISOString();
    addTo('problems', {
      id: uid('prb'),
      key: nextProblemKey(problems),
      title: title.trim(),
      description: description.trim(),
      status: 'new',
      priority,
      assigneeId: assigneeId || null,
      symptom: symptom.trim(),
      rootCause: '',
      workaround: '',
      linkedTicketIds: picked,
      resolvedByChangeId: null,
      knowledgeIds: [],
      firstSeenAt: dates[0] || now,
      createdAt: now,
      createdById: currentUser?.id || null,
    });
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      accent={HUE}
      size="modalLg"
      icon={OctagonAlert}
      title="New problem"
      subtitle={`Opens as ${nextProblemKey(problems)} in the New state`}
      footer={<>
        <span className={cx('text-xs', t.textMuted)}>
          {picked.length ? `${plural(picked.length, 'incident', 'incidents')} will be linked` : 'No incidents linked yet'}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button variant="solid" accent={HUE} icon={Check} onClick={create}>Create problem</Button>
        </div>
      </>}
    >
      {/* @container, not a viewport breakpoint: the modal is its own pane, so
          the two-column row must size off the modal's width. */}
      <div className="space-y-4 @container">
        <Field label="Title" required error={touched && !title.trim() ? 'A problem needs a title before it can be tracked.' : null}>
          <Input accent={HUE} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Saved-card checkouts fail under load on the storefront" />
        </Field>

        <Field label="Symptom" hint="What the reporters describe. Fill this now and the triage team can match new tickets against it immediately.">
          <Textarea accent={HUE} rows={2} value={symptom} onChange={(e) => setSymptom(e.target.value)}
            placeholder="e.g. Intermittent “payment provider unavailable” at checkout, worst between 11:00 and 14:00." />
        </Field>

        <Field label="Notes" hint="Context, timeline, who noticed. The root cause and workaround are filled in as the investigation proceeds.">
          <Textarea accent={HUE} rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Three enterprise customers reported this within a week; support has been advising a retry." />
        </Field>

        <div className="grid @md:grid-cols-2 gap-3">
          <Field label="Priority" hint="Driven by how many customers the cause is hurting, not by how loud the last ticket was.">
            <TileGroup value={priority} onChange={setPriority} options={PRIORITY_TILES} columns={4} accent={HUE} />
          </Field>
          <Field label="Owner" hint="Whoever owns the diagnosis.">
            <Select accent={HUE} value={assigneeId} placeholder="Unassigned"
              onChange={(e) => setAssigneeId(e.target.value)}
              options={directory.map(p => ({ value: p.id, label: `${p.name} — ${p.title || p.department || ''}` }))} />
          </Field>
        </div>

        {!assigneeId && (
          <Banner accent="amber" icon={Users}>
            With no owner this problem stays in <strong>New</strong>. Nothing routes it automatically — problems are
            claimed by people, not by queues, and an unowned problem is where recurring incidents go to be ignored.
          </Banner>
        )}

        <div>
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <GroupLabel>Incidents this problem explains</GroupLabel>
            <span className={cx('text-[11px]', t.textMuted)}>
              {plural(picked.length, 'selected', 'selected')}
            </span>
          </div>
          <SearchInput value={q} onChange={setQ} accent={TICKET_HUE} placeholder="Search incidents…" className="mb-2" />
          <Card className="max-h-56 overflow-auto">
            <div className={cx('divide-y', t.borderLight)}>
              {candidates.map(ticket => (
                <div key={ticket.id} className={cx('flex items-center gap-3', DENSITY.rowPad)}>
                  <Checkbox
                    className="flex-1 min-w-0"
                    accent={TICKET_HUE}
                    checked={picked.includes(ticket.id)}
                    onChange={(on) => setPicked(prev => on ? unique([...prev, ticket.id]) : prev.filter(x => x !== ticket.id))}
                    label={`${ticketRefOf(ticket)} · ${ticketTitleOf(ticket)}`}
                    hint={fmtDate(ticketDateOf(ticket)) || undefined}
                  />
                  {ticket.status && <StatusPill status={ticket.status} />}
                </div>
              ))}
              {!candidates.length && (
                <p className={cx(DENSITY.sectionPad, 'text-xs', t.textMuted)}>
                  {tickets.length
                    ? 'Every remaining incident is already attributed to another problem.'
                    : 'No incidents in this workspace yet. You can link them later from the problem record.'}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Modal>
  );
}
