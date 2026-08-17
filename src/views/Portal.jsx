import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, BookOpen, Layers,
  Folder, Circle, Inbox, FileQuestion, CircleCheck, CircleAlert, Play, Pause, AlignLeft,
  Sparkles, GraduationCap, BookMarked, Clock, Stamp, Send, ThumbsUp, ThumbsDown, Info,
  Moon, Sun, LogOut, Building2, Users, User, Route, Eye, Award, Paperclip, Check,
  LayoutGrid, ListOrdered, MessageSquare, ShieldCheck, Video, Search, X,
  KeyRound, Mail, Laptop, AppWindow, Store, LifeBuoy,
} from 'lucide-react';
import {
  useTheme, cx, useDismiss, ICON, DENSITY, GRADIENT, entityHue, moduleGradient, tint,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, PriorityFlag, EntityTag,
  Avatar, EmptyState, Card, Panel, GroupLabel, Stat, Banner, Divider,
  Field, Input, Textarea, Select, Checkbox,
  Modal, Menu, MenuItem, MenuLabel, MenuDivider,
  SubTabs, Breadcrumbs,
} from '@/ds';
import { useStore, getState, addTo, uid, NOW } from '@/store/store.js';
import { evaluate } from '@/lib/conditions.js';
import { startApproval, matchingPolicies, progress } from '@/lib/approvals.js';
import { useRoute, navigate } from '@/lib/router.js';
import { Q, USR, CON, CAT } from '@/store/seed/ids.js';

/**
 * The customer portal — the end-user surface, and the screen that has to argue
 * for RelayHQ's model rather than merely implement it.
 *
 * SHAPE (rebuilt): a hero-led help centre, not an admin screen wearing softer
 * colours. The page opens with one gradient moment — a brand wash behind a large
 * headline and THE SEARCH — then popular shortcuts, then a wide balanced browse
 * grid. Everything else (the argument panel, the sign-in note) moved to the
 * footer, because the first thing a customer should meet is help, not chrome.
 *
 * WHY IT LOOKS DIFFERENT FROM THE ADMIN APP
 * It runs on the portal surface tokens (t.portalCard / t.bgInput) over the plain
 * page ground, and App.jsx renders it with no admin chrome. A viewer should
 * believe they are looking at what a customer sees.
 *
 * THE THREE THINGS IT PROVES
 *  1. DRILL-DOWN — Product › Subcategory › Item, not a flat list of every form.
 *  2. KB BEFORE FORM — at an item, help is always rendered above the intakes.
 *     That ordering is the deflection mechanic and it is not configurable here.
 *  3. THE SUBMISSION REALLY LANDS — a request creates a ticket in the store,
 *     routed by the subform's queue (falling back to General, said out loud),
 *     and starts a real approval when the subform names a policy. The viewer can
 *     open the same record in the agent workspace afterwards.
 *
 * Everything the "Why this works" panel claims is computed from state. There are
 * no invented industry statistics anywhere in this file — only facts about the
 * data on screen.
 */

/* ==================================================================== *
 * Measures
 *
 * Two widths, deliberately. The grid gets the full viewport it deserves; prose
 * stays near 70 characters because that is what a person can actually read.
 * ==================================================================== */

const WIDE = 'max-w-6xl mx-auto px-6';
const MID = 'max-w-4xl mx-auto px-6';
const READ = 'max-w-3xl mx-auto px-6';
const PROSE = 'max-w-[70ch]';

/* The hero wash. One gradient moment on the page, tuned per mode rather than
 * inverted: light gets a whisper, dark gets a glow that lifts the page off
 * near-black. Values are literal strings so Tailwind compiles them. */
const WASH = {
  sheet: { light: 'opacity-[0.10]', dark: 'opacity-[0.16]' },
  glow: { light: 'opacity-20', dark: 'opacity-30' },
};

/* ==================================================================== *
 * Catalog helpers
 * ==================================================================== */

/* Icons are components, so they cannot live in tokens.js — but the HUE must.
 * A second colour map here would be a second source of truth and would drift
 * away from ENTITIES the first time a hue changes. Ask the registry instead.
 * Only the GLYPH varies per product, and those keys come from the canonical
 * id module so nothing here is a loose string. */
const NODE_ICON = { product: Folder, subcategory: Layers, item: Circle };

const PRODUCT_ICON = {
  [CAT.P_ACCOUNTS]: KeyRound,
  [CAT.P_EMAIL]: Mail,
  [CAT.P_DEVICES]: Laptop,
  [CAT.P_SOFTWARE]: AppWindow,
  [CAT.P_WORKPLACE]: Building2,
  [CAT.P_STOREFRONT]: Store,
};

function nodeIcon(node) {
  if (!node) return Circle;
  if (node.type === 'product') return PRODUCT_ICON[node.id] || Folder;
  return NODE_ICON[node.type] || Circle;
}

function walkCatalog(nodes, trail = [], out = []) {
  for (const n of nodes || []) {
    out.push({ node: n, trail });
    if (n.children) walkCatalog(n.children, [...trail, n], out);
  }
  return out;
}

function pathIdsTo(nodes, id, acc = []) {
  for (const n of nodes || []) {
    const next = [...acc, n.id];
    if (n.id === id) return next;
    const found = n.children ? pathIdsTo(n.children, id, next) : null;
    if (found) return found;
  }
  return null;
}

/** Counts for a card footer line, resolved for whatever level the node sits at. */
function nodeStats(node) {
  const kids = node.children || [];
  const deep = walkCatalog(kids);
  return {
    children: kids.length,
    items: deep.filter(x => x.node.type === 'item').length,
    help: (node.knowledgeIds || []).length,
    intakes: (node.subformIds || []).length,
  };
}

/** A record is visible on a form when their audiences are compatible. */
function audienceMatch(recordAudience, formAudience) {
  if (!formAudience || formAudience === 'both') return true;
  if (!recordAudience) return true;
  return recordAudience === formAudience || recordAudience === 'both';
}

function publishedAtom(k) {
  return !!k && k.status !== 'draft' && k.status !== 'archived';
}

function lessonIdsOf(course) {
  const out = [];
  for (const m of course?.modules || []) {
    for (const l of m.lessonIds || m.lessons || []) {
      const id = typeof l === 'string' ? l : l?.knowledgeId;
      if (id) out.push(id);
    }
  }
  return out;
}

function courseMinutes(course, byId) {
  return lessonIdsOf(course).reduce((n, id) => n + (byId.get(id)?.minutes || 0), 0);
}

function popularItems(products) {
  return walkCatalog(products)
    .filter(x => x.node.type === 'item' && x.node.popular)
    .slice(0, 6);
}

/* ==================================================================== *
 * Formatting
 * ==================================================================== */

function fmtWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = (NOW.getTime() - d.getTime()) / 60000;
  if (mins < 2) return 'just now';
  if (mins < 60) return `${Math.round(mins)} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  const days = Math.round(mins / 1440);
  if (days <= 14) return `${days} d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtMinutes(n) {
  if (!n) return null;
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function isEmptyAnswer(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (v === false) return true;
  return false;
}

/* ==================================================================== *
 * Intake helpers
 * ==================================================================== */

/** Fields whose `showIf` currently passes. Evaluated with the rules engine. */
function visibleFields(subform, answers) {
  return (subform?.fields || []).filter(f => {
    if (!f.showIf) return true;
    return evaluate(
      { field: `answers.${f.showIf.fieldId}`, op: f.showIf.op, value: f.showIf.value },
      { answers },
    );
  });
}

/**
 * Map raw answers onto the semantic fields the condition engine knows about
 * (`answers.amount`, `answers.quantity`, …). Derived from field TYPE rather than
 * from a field id, so no other domain's ids appear here and a renamed field does
 * not silently stop an approval policy from matching.
 */
function answerContext(subform, answers) {
  const out = {};
  for (const f of subform?.fields || []) {
    const v = answers[f.id];
    if (isEmptyAnswer(v)) continue;
    if (f.type === 'currency' && out.amount === undefined) out.amount = Number(v);
    else if (f.type === 'number' && out.quantity === undefined) out.quantity = Number(v);
    else if (f.type === 'select' && /access level/i.test(f.label || '') && out.accessLevel === undefined) out.accessLevel = v;
    else if (f.type === 'date' && /start/i.test(f.label || '') && out.startDate === undefined) out.startDate = v;
  }
  return out;
}

function deriveTitle(subform, item, answers) {
  const summaryField = (subform?.fields || []).find(f =>
    (f.type === 'text' || f.type === 'textarea') && /summary|subject|one-line/i.test(f.label || ''));
  const summary = summaryField ? answers[summaryField.id] : null;
  if (summary && String(summary).trim()) return String(summary).trim().slice(0, 120);
  const symptom = (subform?.fields || []).find(f => f.type === 'select' && !isEmptyAnswer(answers[f.id]));
  const detail = symptom ? ` — ${answers[symptom.id]}` : '';
  return `${item?.name || subform?.name || 'Request'}${detail}`.slice(0, 120);
}

function composeDescription(subform, answers) {
  const lines = visibleFields(subform, answers)
    .filter(f => !isEmptyAnswer(answers[f.id]) && f.type !== 'file')
    .map(f => {
      const v = answers[f.id];
      const shown = Array.isArray(v) ? v.join(', ') : v === true ? 'Yes' : String(v);
      return `${f.label}: ${shown}`;
    });
  return lines.join('\n');
}

/** Priority the requester implied, read off the urgency vocabulary the forms use. */
function derivePriority(answers) {
  const blob = Object.values(answers || {}).filter(v => typeof v === 'string').join(' | ').toLowerCase();
  if (/blocking my work|cannot complete|orders are failing|safety hazard/.test(blob)) return 'high';
  if (/planning ahead|no impact/.test(blob)) return 'low';
  return 'medium';
}

function nextTicketKey(tickets) {
  let max = 4800;
  for (const tk of tickets || []) {
    const m = /(\d+)\s*$/.exec(tk.key || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `TKT-${max + 1}`;
}

/* ==================================================================== *
 * Accessibility — auto-advance is a WCAG 2.2.2 concern, so the guide player
 * never starts a timer for a reader who asked us not to move things.
 * ==================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  useEffect(() => {
    let mq = null;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    const on = () => setReduced(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener(on);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener(on);
    };
  }, []);
  return reduced;
}

/* ==================================================================== *
 * Portal
 * ==================================================================== */

const STORE_SLICE = (s) => ({
  catalog: s.catalog, knowledge: s.knowledge, subforms: s.subforms, forms: s.forms,
  courses: s.courses, curricula: s.curricula, queues: s.queues, tickets: s.tickets,
  approvalPolicies: s.approvalPolicies, approvals: s.approvals, directory: s.directory,
  contacts: s.contacts, organizations: s.organizations, assets: s.assets,
  currentUser: s.currentUser, settings: s.settings,
});

const LEVEL_COPY = [
  { label: 'Step 1 of 3', hint: 'Pick the product or service area.' },
  { label: 'Step 2 of 3', hint: 'Narrow it down.' },
  { label: 'Step 3 of 3', hint: 'Choose the thing you need.' },
];

export default function Portal({ route }) {
  const { t, dark, toggle } = useTheme();
  const liveRoute = useRoute();
  const r = route || liveRoute;
  const s = useStore(STORE_SLICE);

  const published = useMemo(() => (s.forms || []).filter(f => f.published !== false), [s.forms]);
  const [formId, setFormId] = useState(null);
  const form = published.find(f => f.id === formId) || published[0] || null;

  /* Deep link: #/portal/<slug> selects a published form, so a demo is shareable. */
  useEffect(() => {
    if (!r.sub || !published.length) return;
    const found = published.find(f => f.slug === r.sub || f.id === r.sub);
    if (found && found.id !== form?.id) setFormId(found.id);
  }, [r.sub, published, form]);

  const [tab, setTab] = useState('help');
  const [path, setPath] = useState([]);
  const [query, setQuery] = useState('');
  const [reading, setReading] = useState(null);      // { id, from }
  const [resolvedId, setResolvedId] = useState(null);
  const [intakeId, setIntakeId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [touched, setTouched] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [emphasise, setEmphasise] = useState(false);
  const [courseId, setCourseId] = useState(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const scroller = useRef(null);

  const external = form?.audience === 'external';

  /* Lookups */
  const byKb = useMemo(() => new Map((s.knowledge || []).map(k => [k.id, k])), [s.knowledge]);
  const bySf = useMemo(() => new Map((s.subforms || []).map(f => [f.id, f])), [s.subforms]);
  const byQueue = useMemo(() => new Map((s.queues || []).map(q => [q.id, q])), [s.queues]);
  const byCourse = useMemo(() => new Map((s.courses || []).map(c => [c.id, c])), [s.courses]);
  const defaultQueue = useMemo(
    () => (s.queues || []).find(q => q.isDefault) || (s.queues || []).find(q => q.id === Q.GENERAL) || null,
    [s.queues]);

  /* Who is looking. Internal forms resolve against the corporate directory,
   * external forms against the contact roster — the two people models RelayHQ
   * keeps side by side. Preference falls back to whoever has history, so the
   * "My requests" panel is never an empty demo. */
  const requester = useMemo(() => {
    if (external) {
      const list = s.contacts || [];
      return list.find(c => c.id === CON.DANA) || list[0] || null;
    }
    const dir = s.directory || [];
    return dir.find(p => p.id === USR.SARAH) || dir.find(p => p.id === s.currentUser?.id) || s.currentUser || dir[0] || null;
  }, [external, s.contacts, s.directory, s.currentUser]);

  const org = external && requester?.orgId
    ? (s.organizations || []).find(o => o.id === requester.orgId) || null
    : null;

  /* Products this form publishes */
  const products = useMemo(() => {
    const roots = s.catalog || [];
    const scoped = (form?.productIds || []).length
      ? roots.filter(n => form.productIds.includes(n.id))
      : roots.filter(n => audienceMatch(n.audience, form?.audience));
    return scoped;
  }, [s.catalog, form]);

  /* Where we are in the drill-down */
  const trail = useMemo(() => {
    const out = [];
    let level = products;
    for (const id of path) {
      const n = (level || []).find(x => x.id === id);
      if (!n) break;
      out.push(n);
      level = n.children;
    }
    return out;
  }, [products, path]);

  const current = trail[trail.length - 1] || null;
  const item = current && current.type === 'item' ? current : null;
  const children = current ? (current.children || []) : products;

  const itemAtoms = useMemo(() => (item?.knowledgeIds || [])
    .map(id => byKb.get(id))
    .filter(k => publishedAtom(k) && audienceMatch(k.audience, form?.audience)), [item, byKb, form]);

  const itemForms = useMemo(() => (item?.subformIds || [])
    .map(id => bySf.get(id))
    .filter(f => !!f && f.enabled !== false && audienceMatch(f.audience, form?.audience)), [item, bySf, form]);

  const intake = intakeId ? bySf.get(intakeId) || null : null;
  const atom = reading ? byKb.get(reading.id) || null : null;
  const resolvedAtom = resolvedId ? byKb.get(resolvedId) || null : null;

  /* Reset the journey when the brand changes — a customer never sees two at once. */
  useEffect(() => {
    setPath([]); setReading(null); setIntakeId(null); setReceipt(null);
    setResolvedId(null); setCourseId(null); setQuery(''); setEmphasise(false);
  }, [form?.id]);

  /* Search across knowledge, plus the catalog items that hold it. */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const hit = (...vals) => vals.some(v => String(v ?? '').toLowerCase().includes(q));
    const atoms = (s.knowledge || [])
      .filter(k => publishedAtom(k) && audienceMatch(k.audience, form?.audience))
      .filter(k => hit(k.title, k.summary, ...(k.tags || [])))
      .slice(0, 6);
    const nodes = walkCatalog(products)
      .filter(x => x.node.type === 'item' && hit(x.node.name, x.node.description))
      .slice(0, 4);
    return { atoms, nodes };
  }, [query, s.knowledge, products, form]);

  /* My requests */
  const myTickets = useMemo(() => {
    const mine = (s.tickets || []).filter(tk => external
      ? tk.contactId === requester?.id
      : tk.requesterId === requester?.id);
    return mine.slice().sort((x, y) => String(y.createdAt || '').localeCompare(String(x.createdAt || '')));
  }, [s.tickets, external, requester]);

  const orgTickets = useMemo(() => {
    if (!external || !org) return [];
    return (s.tickets || []).filter(tk => tk.orgId === org.id && tk.contactId !== requester?.id);
  }, [s.tickets, external, org, requester]);

  /* Academy — external curricula and courses */
  const academyCourses = useMemo(
    () => (s.courses || []).filter(c => c.audience === 'external' && c.status !== 'draft'),
    [s.courses]);
  const academyCurricula = useMemo(
    () => (s.curricula || []).filter(c => c.audience === 'external' && c.status !== 'draft'),
    [s.curricula]);

  const course = courseId ? byCourse.get(courseId) || null : null;

  /* Where an atom shows up elsewhere — the reuse, surfaced to the reader. */
  const alsoTaughtIn = useMemo(() => {
    if (!atom) return [];
    return (s.courses || []).filter(c => lessonIdsOf(c).includes(atom.id));
  }, [atom, s.courses]);

  const popular = useMemo(() => popularItems(products), [products]);

  /* ---------------- navigation ---------------- */

  const goHome = () => { setPath([]); setReading(null); setIntakeId(null); setReceipt(null); setResolvedId(null); setEmphasise(false); };
  const drill = (node) => { setPath(p => [...p, node.id]); setReading(null); setEmphasise(false); };
  const goUp = () => {
    if (reading) { setReading(null); return; }
    if (intakeId) { setIntakeId(null); return; }
    setPath(p => p.slice(0, -1));
  };
  const openItemById = (id) => {
    const ids = pathIdsTo(products, id);
    if (ids) { setPath(ids); setReading(null); setQuery(''); setEmphasise(false); }
  };
  const openAtom = (id, from) => { setReading({ id, from: from || 'item' }); setQuery(''); };
  const openIntake = (id) => { setIntakeId(id); setAnswers({}); setTouched(false); setReading(null); };

  /* Every step of the journey starts at the top of the page, the way a real
   * navigation would. Without this a drill-down lands you halfway down a grid. */
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [tab, path.length, reading?.id, intakeId, resolvedId, courseId, receipt?.key]);

  /* "No, I need help" promises to land you on the request forms for this service.
   * When the article was opened from search we are not standing on an item yet,
   * so resolve one: the catalog item that hosts this atom AND carries an intake.
   * Without this the reader is dropped back on the browse grid, which is exactly
   * the round trip the prompt says it will save them. */
  const onArticleNo = (id) => {
    setReading(null);
    setEmphasise(true);
    if (item) return;
    const hosts = walkCatalog(products)
      .filter(x => x.node.type === 'item' && (x.node.knowledgeIds || []).includes(id));
    const host = hosts.find(x => (x.node.subformIds || []).length) || hosts[0];
    if (!host) return;
    const ids = pathIdsTo(products, host.node.id);
    if (ids) setPath(ids);
  };
  const onArticleYes = (id) => {
    setResolvedId(id);
    setReading(null);
  };

  /* ---------------- submission ---------------- */

  const submit = () => {
    if (!intake || !form) return;
    const shown = visibleFields(intake, answers);
    const missing = shown.filter(f => f.required && isEmptyAnswer(answers[f.id]));
    if (missing.length) { setTouched(true); return; }

    const st = getState();
    const routed = intake.routing?.queueId ? (st.queues || []).find(q => q.id === intake.routing.queueId) : null;
    const queue = routed || defaultQueue;
    const now = new Date().toISOString();
    const key = nextTicketKey(st.tickets);
    const answerCtx = answerContext(intake, answers);

    const ticket = {
      id: uid('tkt'),
      key,
      title: deriveTitle(intake, item, answers),
      description: composeDescription(intake, answers),
      status: 'open',
      priority: derivePriority(answers),
      queueId: queue?.id || null,
      assigneeId: null,
      isExternal: !!external,
      requesterId: external ? null : requester?.id || null,
      contactId: external ? requester?.id || null : null,
      orgId: external ? org?.id || null : null,
      source: 'portal',
      subformId: intake.id,
      catalogItemId: item?.id || null,
      formId: form.id,
      answers: { ...answers },
      labels: [],
      cc: [],
      comments: [],
      links: [],
      createdAt: now,
      updatedAt: now,
    };
    addTo('tickets', ticket);

    /* Approval — run it for real so it turns up in the Approvals module. */
    let approvalId = null;
    let policy = null;
    let policyRan = false;
    let unresolved = false;
    if (intake.approvalPolicyId) {
      policy = (st.approvalPolicies || []).find(p => p.id === intake.approvalPolicyId) || null;
      if (policy) {
        const ctx = {
          requesterId: requester?.id,
          directory: st.directory || [],
          queues: st.queues || [],
          answers: answerCtx,
          ticket: {
            title: ticket.title, priority: ticket.priority, status: ticket.status,
            queueId: ticket.queueId, source: 'portal', labels: [],
            subformId: intake.id, catalogItemId: item?.id || null,
          },
          requester: {
            department: external ? null : requester?.department || null,
            isExternal: !!external,
            vip: !!requester?.vip,
          },
          org: { plan: org?.plan || null },
          __now: now,
        };
        if (matchingPolicies([policy], ctx).length) {
          const request = startApproval(policy, ctx, {
            id: uid('apr'),
            subject: `${ticket.key} · ${ticket.title}`,
            targetType: 'ticket',
            targetId: ticket.id,
            now,
          });
          addTo('approvals', request);
          approvalId = request.id;
          policyRan = true;
          unresolved = (request.stages || []).some(stg => stg.unresolved);
        }
      }
    }

    setReceipt({
      ticketId: ticket.id,
      key: ticket.key,
      title: ticket.title,
      queueId: queue?.id || null,
      fellBack: !routed,
      subformId: intake.id,
      itemId: item?.id || null,
      approvalId,
      policyName: policy?.name || null,
      policyRan,
      unresolved,
      confirmation: intake.confirmation || null,
    });
    setIntakeId(null);
  };

  /* ---------------- facts for the argument ---------------- */

  const facts = useMemo(() => computeFacts(s, defaultQueue), [s, defaultQueue]);

  const orgName = s.settings?.orgName || 'Northwind Systems';

  if (!form) {
    return (
      <div className={cx('h-screen flex flex-col overflow-hidden', t.bg, t.text)}>
        <div className="flex-1 overflow-auto">
          <section className="relative">
            <HeroBackdrop />
            <div className={cx('relative text-center', WIDE, 'pt-20 pb-16')}>
              <h1 className={cx('text-4xl sm:text-5xl font-semibold tracking-tight text-balance', t.text)}>
                Nothing published yet
              </h1>
              <p className={cx('mt-4 text-base sm:text-lg max-w-xl mx-auto leading-relaxed', t.textSecondary)}>
                A RelayHQ portal needs at least one published form. Publish one in the Forms module and the help
                centre appears here.
              </p>
              <div className="mt-8 flex justify-center">
                <Button variant="grad" module="portal" size="lg" icon={ArrowRight} onClick={() => navigate('forms')}>
                  Open Forms
                </Button>
              </div>
            </div>
          </section>
          <div className={cx(MID, 'pb-16')}>
            <EmptyState icon={FileQuestion} title="No published portal form"
              hint="Forms scope a portal to an audience and a set of products. Without one there is nothing for a customer to land on." />
          </div>
        </div>
      </div>
    );
  }

  const brandIcon = external ? Building2 : Users;
  const tabs = [
    { value: 'help', label: 'Help centre', icon: LifeBuoy, accent: 'purple' },
    { value: 'requests', label: 'My requests', icon: Inbox, accent: 'rose', count: myTickets.length },
  ];
  if (academyCourses.length) {
    tabs.push({ value: 'academy', label: 'Academy', icon: GraduationCap, accent: 'indigo', count: academyCourses.length });
  }

  const searchPlaceholder = form.showKnowledge === false
    ? 'Search the service catalog…'
    : 'Search articles, guides and services…';

  const atHome = tab === 'help' && !trail.length && !reading && !intake && !receipt && !resolvedAtom;

  const crumbs = [{ id: 'root', name: 'Help centre' }, ...trail.map(n => ({ id: n.id, name: n.name }))];
  const trailCrumbs = reading || intake
    ? [...crumbs, { id: 'leaf', name: reading ? (atom?.title || 'Article') : intake.name }]
    : crumbs;

  return (
    <div className={cx('h-screen flex flex-col overflow-hidden', t.bg, t.text)}>
      <PortalBar
        form={form}
        forms={published}
        brandIcon={brandIcon}
        orgName={orgName}
        tabs={tabs}
        tab={tab}
        requester={requester}
        org={org}
        dark={dark}
        pickerOpen={pickerOpen}
        onHome={() => { setTab('help'); goHome(); }}
        /* "Help centre" is the home of this portal, not just a filter: choosing it
         * from anywhere returns to the hero. Without this it is a dead click for
         * anyone standing inside an article or a request form. */
        onTab={(v) => {
          setTab(v); setCourseId(null); setReading(null);
          if (v === 'help') goHome();
        }}
        onPickerOpen={() => setPickerOpen(v => !v)}
        onPickerClose={() => setPickerOpen(false)}
        /* Switching portal switches audience, catalog scope and requester, so it
         * lands on the new portal's front door. Staying on the previous one's
         * "My requests" would show one brand's chrome over another's records. */
        onPick={(f) => {
          setPickerOpen(false);
          setFormId(f.id);
          setTab('help');
          navigate('portal', f.slug || f.id);
        }}
        onToggleTheme={toggle}
      />

      <div ref={scroller} className="flex-1 overflow-auto">
        {tab === 'help' && (atHome ? (
          <>
            <PortalHero
              form={form}
              external={external}
              orgName={orgName}
              query={query}
              onQuery={setQuery}
              results={results}
              placeholder={searchPlaceholder}
              onAtom={(id) => openAtom(id, 'search')}
              onItem={openItemById}
              popular={popular}
            />

            <section className={cx(WIDE, 'pb-16')}>
              <SectionHead
                eyebrow="Browse"
                title="Where do you need help?"
                hint="Pick the area your question belongs to. Every path ends in a service with the answers attached — and a request form only if you still need one."
              />
              {children.length === 0 ? (
                <EmptyState icon={Folder} title="Nothing published here"
                  hint="This portal has no products scoped to your audience yet." />
              ) : (
                <BrowseGrid nodes={children} onPick={drill} />
              )}
            </section>
          </>
        ) : (
          <>
            <TrailBar
              crumbs={trailCrumbs}
              onNavigate={(crumb, i) => {
                setReading(null); setIntakeId(null); setReceipt(null); setResolvedId(null);
                setPath(path.slice(0, i));
              }}
              onBack={() => {
                if (receipt) { setReceipt(null); return; }
                if (resolvedAtom) { setResolvedId(null); return; }
                goUp();
              }}
              query={query}
              onQuery={setQuery}
              results={results}
              placeholder={searchPlaceholder}
              onAtom={(id) => openAtom(id, 'search')}
              onItem={openItemById}
            />

            {receipt ? (
              <ReceiptScreen
                receipt={receipt}
                queue={receipt.queueId ? byQueue.get(receipt.queueId) : null}
                approval={(s.approvals || []).find(a => a.id === receipt.approvalId) || null}
                directory={s.directory || []}
                onDone={() => { setReceipt(null); goHome(); }}
                onRequests={() => { setReceipt(null); setTab('requests'); }}
              />
            ) : resolvedAtom ? (
              <ResolvedScreen
                atom={resolvedAtom}
                itemName={item?.name}
                onBrowse={() => { setResolvedId(null); goHome(); }}
                onBackToItem={() => setResolvedId(null)}
              />
            ) : intake ? (
              <IntakeScreen
                subform={intake}
                item={item}
                answers={answers}
                touched={touched}
                queue={intake.routing?.queueId ? byQueue.get(intake.routing.queueId) : null}
                defaultQueue={defaultQueue}
                policy={(s.approvalPolicies || []).find(p => p.id === intake.approvalPolicyId) || null}
                people={external ? (s.contacts || []) : (s.directory || [])}
                assets={s.assets || []}
                requesterId={requester?.id}
                onChange={(id, v) => setAnswers(a => ({ ...a, [id]: v }))}
                onSubmit={submit}
                onCancel={() => setIntakeId(null)}
              />
            ) : reading && atom ? (
              <ReadingScreen
                atom={atom}
                alsoIn={alsoTaughtIn}
                fromCourse={reading.from === 'course' ? course : null}
                onCourseBack={() => { setReading(null); setTab('academy'); }}
                onYes={() => onArticleYes(atom.id)}
                onNo={() => onArticleNo(atom.id)}
              />
            ) : item ? (
              <ItemScreen
                item={item}
                atoms={itemAtoms}
                forms={itemForms}
                queues={byQueue}
                policies={s.approvalPolicies || []}
                emphasise={emphasise}
                onAtom={(id) => openAtom(id, 'item')}
                onIntake={openIntake}
              />
            ) : (
              <LevelScreen node={current} nodes={children} level={trail.length} onPick={drill} />
            )}
          </>
        ))}

        {tab === 'requests' && (
          <RequestsScreen
            tickets={myTickets}
            orgTickets={orgTickets}
            org={org}
            queues={byQueue}
            requester={requester}
            onOpen={setDetailId}
            onBrowse={() => { setTab('help'); goHome(); }}
          />
        )}

        {tab === 'academy' && (
          reading && atom ? (
            <>
              <TrailBar
                crumbs={[{ id: 'a', name: 'Academy' }, { id: 'c', name: course?.title || 'Course' }, { id: 'l', name: atom.title }]}
                onNavigate={(crumb, i) => { setReading(null); if (i === 0) setCourseId(null); }}
                onBack={() => setReading(null)}
              />
              <ReadingScreen
                atom={atom}
                alsoIn={alsoTaughtIn}
                fromCourse={course}
                onCourseBack={() => setReading(null)}
                onYes={() => { setReading(null); }}
                onNo={() => { setReading(null); }}
              />
            </>
          ) : course ? (
            <>
              <TrailBar
                crumbs={[{ id: 'a', name: 'Academy' }, { id: 'c', name: course.title }]}
                onNavigate={() => setCourseId(null)}
                onBack={() => setCourseId(null)}
              />
              <CourseScreen
                course={course}
                byKb={byKb}
                catalog={s.catalog || []}
                onLesson={(id) => openAtom(id, 'course')}
              />
            </>
          ) : (
            <AcademyScreen
              orgName={orgName}
              curricula={academyCurricula}
              courses={academyCourses}
              byKb={byKb}
              byCourse={byCourse}
              onCourse={setCourseId}
            />
          )
        )}

        <PortalFooter
          form={form}
          orgName={orgName}
          external={external}
          requester={requester}
          hasAcademy={academyCourses.length > 0}
          onHelp={() => { setTab('help'); goHome(); }}
          onRequests={() => setTab('requests')}
          onAcademy={() => setTab('academy')}
          onWhy={() => setWhyOpen(true)}
        />
      </div>

      <WhyPanel
        open={whyOpen}
        onClose={() => setWhyOpen(false)}
        facts={facts}
        subforms={s.subforms || []}
        queues={byQueue}
        defaultQueue={defaultQueue}
      />

      <TicketModal
        ticket={(s.tickets || []).find(tk => tk.id === detailId) || null}
        queues={byQueue}
        subforms={bySf}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

/* ==================================================================== *
 * Chrome — one slim bar, so the page can open with help rather than UI.
 * ==================================================================== */

function PortalBar({
  form, forms, brandIcon, orgName, tabs, tab, requester, org, dark, pickerOpen,
  onHome, onTab, onPickerOpen, onPickerClose, onPick, onToggleTheme,
}) {
  const { t } = useTheme();
  const Brand = brandIcon;
  return (
    <header className={cx('flex-shrink-0 border-b relative z-30', t.border, t.bgSidebar)}>
      <div className={cx(WIDE, 'h-16 flex items-center gap-3')}>
        <button onClick={onHome} className="flex items-center gap-3 min-w-0 flex-shrink-0" aria-label="Back to the help centre">
          <span className={cx('w-9 h-9 rounded-xl flex items-center justify-center shadow-md flex-shrink-0',
            moduleGradient('portal', 'tile'))}>
            <Brand size={ICON.lg} className="text-white" />
          </span>
          {/* The mark alone carries the brand until there is room for the words —
              below this the centred tabs would run straight into them. */}
          <span className="min-w-0 text-left hidden lg:block">
            <span className={cx('block text-sm font-semibold leading-tight truncate', t.text)}>{orgName}</span>
            <span className={cx('block text-[11px] leading-tight truncate', t.textMuted)}>{form.name}</span>
          </span>
        </button>

        <div className="flex-1 flex justify-center min-w-0">
          <SubTabs items={tabs} value={tab} onChange={onTab} />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {forms.length > 1 && (
            <BrandPicker forms={forms} form={form} open={pickerOpen}
              onOpen={onPickerOpen} onClose={onPickerClose} onPick={onPick} />
          )}
          <IconButton icon={dark ? Moon : Sun} label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onToggleTheme} />
          <IconButton icon={LogOut} label="Back to the RelayHQ workspace" onClick={() => navigate('workspace')} />
          {requester && (
            <span className="hidden lg:flex items-center gap-2 pl-2 min-w-0">
              <Avatar name={requester.name} size="lg" />
              <span className="min-w-0">
                <span className={cx('block text-xs font-medium leading-tight truncate', t.text)}>{requester.name}</span>
                {org && <span className={cx('block text-[11px] leading-tight truncate', t.textMuted)}>{org.name}</span>}
              </span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}

function BrandPicker({ forms, form, open, onOpen, onClose, onPick }) {
  const { t } = useTheme();
  return (
    <div className="relative hidden md:block">
      <Button variant="outline" size="sm" onClick={onOpen} aria-expanded={open} className="max-w-[13rem]">
        <span className="truncate">{form.name}</span>
        <ChevronDown size={ICON.base}
          className={cx('flex-shrink-0 transition-transform', t.textMuted, open && 'rotate-180')} />
      </Button>
      <Menu open={open} onClose={onClose} align="right" width="w-72">
        <MenuLabel>Published portals</MenuLabel>
        {forms.map(f => (
          <MenuItem
            key={f.id}
            icon={f.audience === 'external' ? Building2 : Users}
            label={f.name}
            hint={f.audience === 'external' ? 'Customer-facing' : 'Employees only'}
            selected={f.id === form.id}
            onClick={() => onPick(f)}
          />
        ))}
        <MenuDivider />
        <div className={cx('px-3 py-2 text-[11px] leading-relaxed', t.textMuted)}>
          One RelayHQ instance serves an internal help centre and a customer support portal.
          Same catalog, same knowledge atoms, different audience scope.
        </div>
      </Menu>
    </div>
  );
}

/* ==================================================================== *
 * The hero
 *
 * One gradient moment: a brand sheet that fades downward into the page and a
 * blurred brand glow behind the headline. Everything below this band is flat on
 * purpose — restraint is what makes the one gradient read as deliberate.
 * ==================================================================== */

/**
 * The wash clips ITSELF rather than being clipped by the section.
 *
 * The glow is wider than a narrow viewport, so it has to be clipped or the page
 * scrolls sideways — but putting `overflow-hidden` on the section also truncates
 * the search suggestions that hang below the input. So the backdrop carries its
 * own clipping box and the section stays open.
 */
function HeroBackdrop({ compact }) {
  const { dark } = useTheme();
  return (
    <span aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <span
        className={cx('absolute inset-0', GRADIENT.brandBar,
          dark ? WASH.sheet.dark : WASH.sheet.light,
          '[mask-image:linear-gradient(to_bottom,rgba(0,0,0,1),rgba(0,0,0,0))]')}
      />
      <span
        className={cx('absolute left-1/2 -translate-x-1/2 rounded-full blur-3xl',
          GRADIENT.brand,
          compact ? '-top-40 w-[54rem] h-[24rem]' : '-top-48 w-[72rem] h-[38rem]',
          dark ? WASH.glow.dark : WASH.glow.light)}
      />
    </span>
  );
}

function PortalHero({ form, external, orgName, query, onQuery, results, placeholder, onAtom, onItem, popular }) {
  const { t, dark } = useTheme();
  const Brand = external ? Building2 : Users;
  return (
    <section className="relative">
      <HeroBackdrop />
      <div className={cx('relative text-center', WIDE, 'pt-16 pb-12 sm:pt-20 sm:pb-14')}>
        <span className={cx('inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-[0.14em]',
          tint('catalog', dark), t.text)}>
          <Brand size={ICON.sm} />
          {external ? `${orgName} support` : `${orgName} help centre`}
        </span>

        <h1 className={cx('mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-balance', t.text)}>
          {form.headline || form.name}
        </h1>

        {(form.subhead || form.description) && (
          <p className={cx('mt-5 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto text-pretty', t.textSecondary)}>
            {form.subhead || form.description}
          </p>
        )}

        <div className="mt-9 max-w-2xl mx-auto">
          <PortalSearch
            size="lg"
            value={query}
            onChange={onQuery}
            results={results}
            placeholder={placeholder}
            onAtom={onAtom}
            onItem={onItem}
          />
        </div>

        {popular.length > 0 && (
          <div className="mt-8">
            <p className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] mb-3.5', t.textMuted)}>
              Most requested
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {popular.map(({ node, trail }) => (
                <PopularPill key={node.id} node={node} trail={trail} onOpen={onItem} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** The compact hero every deeper screen opens with, so the language holds. */
function PageBand({ icon: Glyph, hue = 'purple', eyebrow, title, sub, meta, actions }) {
  const { t } = useTheme();
  return (
    <section className="relative">
      <HeroBackdrop compact />
      <div className={cx('relative', WIDE, 'pt-10 pb-9')}>
        <div className="flex items-start gap-4">
          {Glyph && <IconTile icon={Glyph} accent={hue} size="lg" className="mt-1" />}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] mb-2', t.textMuted)}>{eyebrow}</p>
            )}
            <h1 className={cx('text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-balance', t.text)}>
              {title}
            </h1>
            {sub && (
              <p className={cx('mt-3 text-base leading-relaxed max-w-2xl text-pretty', t.textSecondary)}>{sub}</p>
            )}
            {meta && <div className="mt-4 flex items-center gap-2 flex-wrap">{meta}</div>}
          </div>
          {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, hint, action, className }) {
  const { t } = useTheme();
  return (
    <div className={cx('flex items-end justify-between gap-4 flex-wrap mb-6', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] mb-2', t.textMuted)}>{eyebrow}</p>
        )}
        <h2 className={cx('text-2xl font-semibold tracking-tight', t.text)}>{title}</h2>
        {hint && <p className={cx('mt-2 text-sm leading-relaxed max-w-2xl', t.textSecondary)}>{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/* ==================================================================== *
 * Search — the primary action on a help centre, sized like it.
 * ==================================================================== */

const SEARCH_SIZE = {
  lg: { box: 'rounded-2xl px-5 py-4 gap-3 shadow-xl', input: 'text-base sm:text-lg', icon: ICON.xl },
  sm: { box: 'rounded-xl px-3.5 py-2 gap-2.5 shadow-sm', input: 'text-sm', icon: ICON.md },
};

function PortalSearch({ size = 'lg', value, onChange, results, placeholder, onAtom, onItem }) {
  const { t, a } = useTheme();
  const c = a('purple');
  const [focused, setFocused] = useState(false);
  const dims = SEARCH_SIZE[size] || SEARCH_SIZE.lg;

  /* The suggestion popover is a real popover, so it dismisses on Escape and on a
   * click outside — the DS hook, not a bespoke listener. The ref goes on the
   * wrapper rather than the panel so clicking back into the input is "inside". */
  const wrap = useDismiss(!!results, () => onChange(''));
  const live = focused || !!value;

  return (
    <div ref={wrap} className="relative">
      <div className={cx('flex items-center border transition-colors', dims.box, t.bgInput,
        live ? c.borderStrong : t.borderLight)}>
        <Search size={dims.icon} className={cx('flex-shrink-0', live ? c.fg : t.textMuted)} />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cx('flex-1 min-w-0 bg-transparent outline-none', dims.input, t.text)}
        />
        {value && (
          <button onClick={() => onChange('')} aria-label="Clear search"
            className={cx('p-1 rounded-full flex-shrink-0', t.textMuted, t.bgHover)}>
            <X size={ICON.md} />
          </button>
        )}
      </div>
      {results && (
        <SearchSuggestions
          results={results}
          onAtom={onAtom}
          onItem={onItem}
          onDismiss={() => onChange('')}
        />
      )}
    </div>
  );
}

function SearchSuggestions({ results, onAtom, onItem, onDismiss }) {
  const { t, a } = useTheme();
  /* Ask the registry, don't name the hue: an article is whatever colour knowledge
   * is, and a catalog item is whatever colour an item is. */
  const atomTone = a(entityHue('article'));
  const itemTone = a(entityHue('item'));
  const empty = !results.atoms.length && !results.nodes.length;

  return (
    <div className={cx('absolute left-0 right-0 top-full mt-2 z-40 rounded-2xl border shadow-2xl overflow-hidden text-left',
      t.modal, t.borderLight)}>
      {empty ? (
        <div className={cx('px-4 py-5 text-sm text-center', t.textMuted)}>
          Nothing matched. Try a product name, or browse the areas below.
        </div>
      ) : (
        <div className="max-h-[24rem] overflow-auto py-1">
          {results.atoms.length > 0 && (
            <>
              <div className={cx('px-4 py-2 flex items-center justify-between border-b', t.borderLight)}>
                <GroupLabel>Suggested answers</GroupLabel>
                <span className={cx('text-[10px]', t.textMuted)}>{results.atoms.length} shown</span>
              </div>
              {results.atoms.map(k => (
                <button key={k.id} onClick={() => onAtom(k.id)}
                  className={cx('w-full text-left flex items-start gap-3 px-4 py-3', t.bgHover)}>
                  <BookOpen size={ICON.md} className={cx('flex-shrink-0 mt-0.5', atomTone.fg)} />
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-sm font-medium truncate', t.text)}>{k.title}</span>
                    <span className={cx('block text-xs truncate mt-0.5', t.textMuted)}>{k.summary}</span>
                  </span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <EntityTag kind={k.format === 'guide' ? 'guide' : 'article'} />
                    {k.minutes ? <span className={cx('text-[10px] tabular-nums', t.textMuted)}>{k.minutes}m</span> : null}
                  </span>
                </button>
              ))}
            </>
          )}
          {results.nodes.length > 0 && (
            <>
              <div className={cx('px-4 py-2 border-b border-t', t.borderLight)}>
                <GroupLabel>Services</GroupLabel>
              </div>
              {results.nodes.map(({ node, trail }) => (
                <button key={node.id} onClick={() => onItem(node.id)}
                  className={cx('w-full text-left flex items-center gap-3 px-4 py-3', t.bgHover)}>
                  <Circle size={ICON.md} className={cx('flex-shrink-0', itemTone.fg)} />
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-sm font-medium truncate', t.text)}>{node.name}</span>
                    <span className={cx('block text-xs truncate mt-0.5', t.textMuted)}>{trail.map(n => n.name).join(' › ')}</span>
                  </span>
                  <ChevronRight size={ICON.base} className={cx('flex-shrink-0', t.textMuted)} />
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <button onClick={onDismiss}
        className={cx('w-full px-4 py-2 text-[11px] border-t', t.borderLight, t.textMuted, t.bgHover)}>
        Clear search
      </button>
    </div>
  );
}

function PopularPill({ node, trail, onOpen }) {
  const { t, a } = useTheme();
  const c = a(entityHue('item'));
  return (
    <button
      onClick={() => onOpen(node.id)}
      title={trail.map(n => n.name).join(' › ')}
      className={cx('group inline-flex items-center gap-3 rounded-full border pl-2 pr-5 py-2 shadow-sm',
        'transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg', t.portalCard)}
    >
      <span className={cx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', c.softStrong)}>
        <Circle size={ICON.base} className={c.fg} />
      </span>
      <span className={cx('text-sm font-medium', t.text)}>{node.name}</span>
      <ArrowRight size={ICON.base}
        className={cx('-ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0 transition-all', c.fg)} />
    </button>
  );
}

/* ==================================================================== *
 * The trail — back, breadcrumbs and a search that stays within reach.
 * ==================================================================== */

function TrailBar({ crumbs, onNavigate, onBack, query, onQuery, results, placeholder, onAtom, onItem }) {
  const { t } = useTheme();
  return (
    <div className={cx('sticky top-0 z-20 border-b backdrop-blur-xl', t.border, t.bgSidebar)}>
      <div className={cx(WIDE, 'py-2.5 flex items-center gap-3')}>
        <Button variant="outline" size="sm" icon={ArrowLeft} onClick={onBack} className="flex-shrink-0">Back</Button>
        <div className="min-w-0 flex-1">
          <Breadcrumbs items={crumbs} onNavigate={onNavigate} />
        </div>
        {onQuery && (
          <div className="hidden md:block w-72 flex-shrink-0">
            <PortalSearch
              size="sm"
              value={query}
              onChange={onQuery}
              results={results}
              placeholder={placeholder}
              onAtom={onAtom}
              onItem={onItem}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Browse
 *
 * A flex grid rather than fixed columns: cards share the row width, so the
 * last row fills instead of stranding one card on its own, and every card in
 * a row is the same height without a measuring pass.
 * ==================================================================== */

function BrowseGrid({ nodes, onPick }) {
  return (
    <div className="flex flex-wrap gap-4 items-stretch">
      {nodes.map(node => <NodeCard key={node.id} node={node} onPick={onPick} />)}
    </div>
  );
}

function NodeCard({ node, onPick }) {
  const { t, a } = useTheme();
  const hue = entityHue(node.type);
  const c = a(hue);
  const Glyph = nodeIcon(node);
  const stats = nodeStats(node);

  return (
    <button
      onClick={() => onPick(node)}
      className={cx('group relative text-left rounded-2xl border overflow-hidden p-5 flex flex-col',
        'flex-1 basis-[18rem] min-w-[16rem] shadow-sm',
        'transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl', t.portalCard)}
    >
      {/* Colour lives in the tile and in a hairline that only appears on hover —
          never a heavy rail down the side of every card. */}
      <span aria-hidden className={cx('absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity', c.rail)} />
      <span aria-hidden className={cx('absolute inset-0 rounded-2xl border-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity', c.borderStrong)} />

      <span className="flex items-start justify-between gap-3">
        <IconTile icon={Glyph} accent={hue} size="lg" />
        <ChevronRight size={ICON.lg}
          className={cx('mt-2 flex-shrink-0 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all', c.fg)} />
      </span>

      <span className={cx('mt-4 flex items-center gap-2 flex-wrap')}>
        <span className={cx('block text-base font-semibold leading-snug text-balance', t.text)}>{node.name}</span>
        {node.popular && <Chip accent="amber">Popular</Chip>}
      </span>

      <span className={cx('mt-2 block text-sm leading-relaxed line-clamp-2 min-h-[2.75rem]', t.textSecondary)}>
        {node.description}
      </span>

      <span className={cx('mt-auto pt-4 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs border-t', t.textMuted, t.border)}>
        {node.type === 'product' && stats.children > 0 && (
          <span className="flex items-center gap-1.5">
            <Layers size={ICON.xs} />{plural(stats.children, 'category', 'categories')}
          </span>
        )}
        {node.type === 'product' && stats.items > 0 && (
          <span className="flex items-center gap-1.5">
            <Circle size={ICON.xs} />{plural(stats.items, 'service', 'services')}
          </span>
        )}
        {node.type === 'subcategory' && stats.children > 0 && (
          <span className="flex items-center gap-1.5">
            <Circle size={ICON.xs} />{plural(stats.children, 'service', 'services')}
          </span>
        )}
        {stats.help > 0 && (
          <span className="flex items-center gap-1.5">
            <BookOpen size={ICON.xs} />{plural(stats.help, 'answer', 'answers')}
          </span>
        )}
        {stats.intakes > 0 && (
          <span className="flex items-center gap-1.5">
            <FileQuestion size={ICON.xs} />{plural(stats.intakes, 'form', 'forms')}
          </span>
        )}
        {node.fulfillment && (
          <span className="flex items-center gap-1.5"><Clock size={ICON.xs} />{node.fulfillment}</span>
        )}
      </span>
    </button>
  );
}

function LevelScreen({ node, nodes, level, onPick }) {
  const copy = LEVEL_COPY[Math.min(level, 2)];
  return (
    <>
      <PageBand
        icon={nodeIcon(node)}
        hue={entityHue(node?.type || 'product')}
        eyebrow={copy.label}
        title={node?.name || 'Browse'}
        sub={node?.description}
      />
      <section className={cx(WIDE, 'pb-16')}>
        <SectionHead
          title={nodes.length ? 'Choose one' : 'Nothing here yet'}
          hint={nodes.length ? copy.hint : undefined}
        />
        {nodes.length === 0 ? (
          <EmptyState icon={Folder} title="Nothing published here"
            hint="This branch of the catalog has no published children for your audience." />
        ) : (
          <BrowseGrid nodes={nodes} onPick={onPick} />
        )}
      </section>
    </>
  );
}

/* ==================================================================== *
 * Item — help above forms, always.
 * ==================================================================== */

function ItemScreen({ item, atoms, forms, queues, policies, emphasise, onAtom, onIntake }) {
  const { t } = useTheme();

  return (
    <>
      <PageBand
        icon={Circle}
        hue={entityHue('item')}
        eyebrow="Service"
        title={item.name}
        sub={item.description}
        /* Chips name the answers and the intakes rather than counting them —
           "2 request forms" tells a reader nothing they can act on, and the
           overflow badge already handles a long list. */
        meta={<>
          {item.popular && <Chip accent="amber" icon={Sparkles}>Most requested</Chip>}
          {item.fulfillment && <Chip accent="slate" icon={Clock}>{item.fulfillment}</Chip>}
          <ChipGroup accent={entityHue('article')} icon={BookOpen} max={2} items={atoms} render={(k) => k.title} />
          <ChipGroup accent={entityHue('subform')} icon={FileQuestion} max={2} items={forms} render={(f) => f.name} />
        </>}
      />

      <div className={cx(WIDE, 'pb-16 space-y-12')}>
        {/* HELP FIRST. This ordering is the deflection mechanic: the answers are
            rendered above the intakes on every item, every time, and nothing in
            the portal can reorder it. Do not move the forms block above this. */}
        {atoms.length > 0 && (
          <section>
            <SectionHead
              eyebrow="Answers first"
              title="Try these before you raise anything"
              hint={`${plural(atoms.length, 'article covers', 'articles cover')} the usual version of this. Most people stop here.`}
            />
            <div className="flex flex-wrap gap-4 items-stretch">
              {atoms.map(k => <AtomCard key={k.id} atom={k} onOpen={() => onAtom(k.id)} />)}
            </div>
          </section>
        )}

        {forms.length > 0 ? (
          <section>
            <SectionHead
              eyebrow="Still stuck?"
              title={forms.length > 1 ? 'Tell us what you need' : 'Raise a request'}
              hint={forms.length > 1
                ? `${plural(forms.length, 'intake hangs', 'intakes hang')} off this one service. They ask different questions and go to different teams.`
                : 'If none of the above answered it, this goes straight to the team that owns it.'}
            />
            {emphasise && (
              <Banner accent="rose" icon={MessageSquare} title="No problem — let's get a person on it" className="mb-4">
                Pick the intake that fits. Everything you have already read is attached to the request, so nobody asks
                you to try it again.
              </Banner>
            )}
            <div className="flex flex-wrap gap-4 items-stretch">
              {forms.map(f => (
                <IntakeCard
                  key={f.id}
                  subform={f}
                  queue={f.routing?.queueId ? queues.get(f.routing.queueId) : null}
                  policy={policies.find(p => p.id === f.approvalPolicyId) || null}
                  emphasise={emphasise}
                  onStart={() => onIntake(f.id)}
                />
              ))}
            </div>
          </section>
        ) : (
          <Banner accent="blue" icon={Info} title="Reference only">
            This service has no request form attached — it exists to explain something rather than to be ordered.
            If you still need help, go back and pick a service with an intake on it.
          </Banner>
        )}
      </div>
    </>
  );
}

function AtomCard({ atom, onOpen }) {
  const { t, a } = useTheme();
  const guide = atom.format === 'guide';
  const hue = entityHue(guide ? 'guide' : 'article');
  const c = a(hue);
  const slides = (atom.slides || []).length;
  const Glyph = guide ? LayoutGrid : BookOpen;

  return (
    <button
      onClick={onOpen}
      className={cx('group relative text-left rounded-2xl border overflow-hidden p-5 flex flex-col',
        'flex-1 basis-[20rem] min-w-[17rem] shadow-sm',
        'transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl', t.portalCard)}
    >
      <span aria-hidden className={cx('absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity', c.rail)} />
      <span aria-hidden className={cx('absolute inset-0 rounded-2xl border-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity', c.borderStrong)} />

      <span className="flex items-start justify-between gap-3">
        <IconTile icon={Glyph} accent={hue} size="lg" />
        <span className="flex items-center gap-1.5 flex-shrink-0 mt-1">
          <EntityTag kind={guide ? 'guide' : 'article'} />
        </span>
      </span>

      <span className={cx('mt-4 block text-base font-semibold leading-snug text-balance', t.text)}>{atom.title}</span>
      <span className={cx('mt-2 block text-sm leading-relaxed line-clamp-2 min-h-[2.75rem]', t.textSecondary)}>
        {atom.summary}
      </span>

      <span className={cx('mt-auto pt-4 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs border-t', t.textMuted, t.border)}>
        {guide && slides > 0 && (
          <span className="flex items-center gap-1.5"><LayoutGrid size={ICON.xs} />{plural(slides, 'screen', 'screens')}</span>
        )}
        {atom.minutes ? (
          <span className="flex items-center gap-1.5"><Clock size={ICON.xs} />{atom.minutes} min</span>
        ) : null}
        {atom.helpfulYes ? (
          <span className={cx('flex items-center gap-1.5', c.fg)}>
            <ThumbsUp size={ICON.xs} />{atom.helpfulYes.toLocaleString()} found this helpful
          </span>
        ) : null}
      </span>
    </button>
  );
}

function IntakeCard({ subform, queue, policy, emphasise, onStart }) {
  const { t, a } = useTheme();
  const c = a('purple');
  const fields = (subform.fields || []).length;
  const conditional = (subform.fields || []).filter(f => f.showIf).length;

  return (
    <div className={cx('relative rounded-2xl border overflow-hidden p-5 flex flex-col shadow-sm',
      'flex-1 basis-[22rem] min-w-[18rem]', t.portalCard, emphasise && c.borderStrong)}>
      <div className="flex items-start gap-3">
        <IconTile icon={FileQuestion} accent="purple" size="lg" />
        <div className="min-w-0 flex-1">
          <p className={cx('text-base font-semibold leading-snug text-balance', t.text)}>{subform.name}</p>
          {subform.description && (
            <p className={cx('text-sm mt-1.5 leading-relaxed', t.textSecondary)}>{subform.description}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        {queue
          ? <Chip accent={queue.hue || entityHue('queue')} icon={Inbox} title={queue.description}>{queue.name}</Chip>
          : <Chip accent="amber" icon={Route}>Unrouted → General</Chip>}
        {policy && <Chip accent="amber" icon={Stamp} title={policy.description}>{policy.name}</Chip>}
        <span className={cx('text-xs', t.textMuted)}>
          {plural(fields, 'question', 'questions')}{conditional ? ` · ${conditional} conditional` : ''}
        </span>
      </div>

      {/* SOLID, not the signature gradient. An item can carry several intakes, and
          a gradient on every card in the grid turns the brand moment into wallpaper.
          The gradient belongs to the module tile and to the ONE primary action on a
          screen — here that is Submit on the intake itself, not Start on each card. */}
      <div className="mt-auto pt-5">
        <Button variant="solid" accent={entityHue('subform')} size="md" iconRight={ArrowRight} onClick={onStart}>
          {subform.submitLabel || 'Start'}
        </Button>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Reading — article and guide
 * ==================================================================== */

function ReadingScreen({ atom, alsoIn, fromCourse, onCourseBack, onYes, onNo }) {
  const { t } = useTheme();
  const guide = atom.format === 'guide';

  return (
    <>
      <PageBand
        icon={guide ? LayoutGrid : BookOpen}
        hue={entityHue(guide ? 'guide' : 'article')}
        eyebrow={guide ? 'Guide' : 'Article'}
        title={atom.title}
        sub={atom.summary}
        meta={<>
          {atom.minutes ? <Chip accent="slate" icon={Clock}>{atom.minutes} min</Chip> : null}
          {atom.views ? <Chip accent="slate" icon={Eye}>{atom.views.toLocaleString()} views</Chip> : null}
          {atom.updatedAt && <span className={cx('text-xs', t.textMuted)}>Updated {fmtWhen(atom.updatedAt)}</span>}
        </>}
      />

      <div className={cx(guide ? WIDE : READ, 'pb-16 space-y-6')}>
        {atom.objective && (
          <Banner accent="blue" icon={Check} title="What you will be able to do">
            {atom.objective}
          </Banner>
        )}

        {guide ? <GuideBody atom={atom} /> : <ArticleBody atom={atom} />}

        {alsoIn.length > 0 && (
          <div className={cx('rounded-2xl border p-4 flex items-center gap-3 flex-wrap', t.portalCard)}>
            <span className="flex items-center gap-2.5">
              <IconTile icon={GraduationCap} accent="indigo" size="sm" />
              <span className={cx('text-sm', t.textSecondary)}>This same article is a lesson in</span>
            </span>
            <ChipGroup accent="indigo" icon={BookMarked} max={3} items={alsoIn} render={(c) => c.title} />
          </div>
        )}

        {fromCourse ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className={cx('text-sm', t.textMuted)}>
              Lesson from <strong className={t.text}>{fromCourse.title}</strong>
            </span>
            <Button variant="soft" accent="indigo" icon={ArrowLeft} onClick={onCourseBack}>Back to the course</Button>
          </div>
        ) : (
          <ResolvePrompt onYes={onYes} onNo={onNo} />
        )}
      </div>
    </>
  );
}

function ArticleBody({ atom }) {
  const { t } = useTheme();
  return (
    <div className={cx('rounded-2xl border p-6 sm:p-8', t.portalCard)}>
      <article
        className={cx('rhq-prose text-[15px] leading-7 space-y-4', PROSE, t.text)}
        dangerouslySetInnerHTML={{ __html: atom.body || '<p>This article has no body yet.</p>' }}
      />
    </div>
  );
}

/* ==================================================================== *
 * Guide — the Instagram-style how-to, done accessibly.
 *
 * Stories conventions implemented in full: segmented progress across the top,
 * tap right/left to move, press-and-hold to pause. WCAG 2.2.2 says an
 * auto-advancing carousel needs a way to pause, so there is a visible
 * pause/play control, arrow-key and space support with a visible focus state,
 * prefers-reduced-motion suppresses auto-advance entirely, and "Read as text"
 * renders the same slides as a static captioned sequence with the alt text
 * shown — the accessible equivalent, not a lesser version.
 * ==================================================================== */

function GuideBody({ atom }) {
  const { t } = useTheme();
  const [asText, setAsText] = useState(false);
  const slides = atom.slides || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className={cx('text-sm', t.textMuted)}>
          {plural(slides.length, 'screen', 'screens')} · tap the right side to advance, hold to pause
        </span>
        <Button
          variant={asText ? 'solid' : 'soft'}
          accent="purple"
          size="sm"
          icon={asText ? LayoutGrid : AlignLeft}
          onClick={() => setAsText(v => !v)}
        >
          {asText ? 'Play the guide' : 'Read as text'}
        </Button>
      </div>

      {asText
        ? <GuideAsText atom={atom} />
        : (
          <div className="grid gap-6 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))' }}>
            <div className="max-w-[20rem] w-full mx-auto">
              <StoryPlayer atom={atom} />
            </div>
            <GuideOutline atom={atom} />
          </div>
        )}
    </div>
  );
}

function GuideOutline({ atom }) {
  const { t, a } = useTheme();
  const c = a('purple');
  return (
    <div className={cx('rounded-2xl border p-5', t.portalCard)}>
      <GroupLabel>What the guide covers</GroupLabel>
      <ol className="mt-3 space-y-2.5">
        {(atom.slides || []).map((sl, i) => (
          <li key={sl.id} className="flex items-start gap-2.5">
            <span className={cx('w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-semibold flex-shrink-0',
              c.softStrong, c.fg)}>{i + 1}</span>
            <span className="min-w-0">
              <span className={cx('block text-sm leading-snug', t.text)}>{sl.heading || `Screen ${i + 1}`}</span>
              <span className={cx('text-[11px]', t.textMuted)}>{sl.seconds ? `${sl.seconds}s` : 'manual'}</span>
            </span>
          </li>
        ))}
      </ol>
      {atom.tags?.length ? (
        <div className="mt-4">
          <ChipGroup accent="slate" max={4} items={atom.tags} />
        </div>
      ) : null}
    </div>
  );
}

function GuideAsText({ atom }) {
  const { t } = useTheme();
  return (
    <div className={cx('rounded-2xl border p-6', t.portalCard)}>
      <Banner accent="blue" icon={Info} className="mb-5">
        The same guide as a static sequence. Nothing moves on its own, and every image's description is written out.
      </Banner>
      <ol className={cx('space-y-5', PROSE)}>
        {(atom.slides || []).map((sl, i) => (
          <li key={sl.id} className="flex gap-3">
            <span className={cx('text-sm font-semibold tabular-nums pt-0.5 flex-shrink-0', t.textMuted)}>{i + 1}.</span>
            <div className="min-w-0 flex-1">
              {sl.heading && <p className={cx('text-sm font-semibold', t.text)}>{sl.heading}</p>}
              {sl.type === 'image' && sl.url && (
                <img src={sl.url} alt={sl.alt || ''} loading="lazy"
                  className={cx('mt-2 rounded-xl border w-44 object-cover', t.borderLight)} />
              )}
              {sl.type === 'image' && sl.alt && (
                <p className={cx('text-[11px] mt-1.5 italic', t.textMuted)}>Image: {sl.alt}</p>
              )}
              {sl.type === 'video' && (
                <p className={cx('text-[11px] mt-1.5 flex items-center gap-1', t.textMuted)}>
                  <Video size={ICON.xs} /> Video screen
                </p>
              )}
              {sl.caption && (
                <div className={cx('rhq-prose text-sm mt-1.5 leading-relaxed', t.textSecondary)}
                  dangerouslySetInnerHTML={{ __html: sl.caption }} />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StoryPlayer({ atom }) {
  const { t, a } = useTheme();
  const c = a('purple');
  const slides = atom.slides || [];
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(!reduced);
  const [held, setHeld] = useState(false);
  const downAt = useRef(0);

  const slide = slides[index] || null;
  const armed = !reduced && !!slide?.seconds;
  const running = armed && playing && !held;

  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);

  useEffect(() => {
    if (!running || !slide) return undefined;
    const id = setTimeout(() => {
      if (index + 1 < slides.length) setIndex(index + 1);
      else setPlaying(false);
    }, slide.seconds * 1000);
    return () => clearTimeout(id);
  }, [running, index, slide, slides.length]);

  if (!slides.length) {
    return (
      <div className={cx('rounded-3xl border flex items-center justify-center text-xs text-center p-4',
        t.bgInput, t.borderLight, t.textMuted)} style={{ aspectRatio: '9 / 16' }}>
        This guide has no screens yet.
      </div>
    );
  }

  const step = (dir) => {
    setIndex(i => Math.max(0, Math.min(slides.length - 1, i + dir)));
  };
  const tap = (dir) => {
    const startedAt = downAt.current;
    downAt.current = 0;
    // A press longer than 300ms was a hold-to-pause, not a tap. A click with no
    // pointer press at all is a keyboard activation, which must still move.
    if (startedAt && Date.now() - startedAt > 300) return;
    step(dir);
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); setPlaying(p => !p); }
  };

  const onImage = slide.type === 'image';

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-roledescription="Story guide"
        aria-label={`${atom.title} — screen ${index + 1} of ${slides.length}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={() => { downAt.current = Date.now(); setHeld(true); }}
        onPointerUp={() => setHeld(false)}
        onPointerLeave={() => setHeld(false)}
        onPointerCancel={() => setHeld(false)}
        className={cx('relative rounded-3xl overflow-hidden border-2 select-none outline-none shadow-xl',
          t.borderLight, c.ring, c.softStrong)}
        style={{ aspectRatio: '9 / 16' }}
      >
        {onImage && slide.url && (
          <img src={slide.url} alt={slide.alt || ''} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {slide.type === 'video' && (
          <div className={cx('absolute inset-0 flex flex-col items-center justify-center gap-2', c.softStrong)}>
            <IconTile icon={Video} accent="purple" size="lg" />
            <p className={cx('text-[10px] px-4 text-center break-all', t.textMuted)}>{slide.url}</p>
          </div>
        )}
        {onImage && <div className="absolute inset-0 bg-black/45" />}

        {/* Segmented progress — one segment per screen, the active one filling. */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-20">
          {slides.map((sl, i) => (
            <span key={sl.id} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
              <span
                className={cx('block h-full bg-white',
                  i < index ? 'w-full'
                    : i === index && armed ? 'rhq-story-fill'
                    : i === index ? 'w-full' : 'w-0')}
                style={i === index && armed
                  ? { animationDuration: `${sl.seconds}s`, animationPlayState: running ? 'running' : 'paused' }
                  : undefined}
              />
            </span>
          ))}
        </div>

        {/* Tap zones. They reveal a chevron on hover and on keyboard focus, so the
            interaction is discoverable instead of folklore. */}
        <button
          onClick={() => tap(-1)}
          aria-label="Previous screen"
          className="absolute inset-y-0 left-0 w-1/2 z-10 flex items-center justify-start pl-2 opacity-0 hover:opacity-100 focus-visible:opacity-100 focus:outline-none transition-opacity"
        >
          <span className="p-1.5 rounded-full bg-black/50 text-white"><ChevronLeft size={ICON.md} /></span>
        </button>
        <button
          onClick={() => tap(1)}
          aria-label="Next screen"
          className="absolute inset-y-0 right-0 w-1/2 z-10 flex items-center justify-end pr-2 opacity-0 hover:opacity-100 focus-visible:opacity-100 focus:outline-none transition-opacity"
        >
          <span className="p-1.5 rounded-full bg-black/50 text-white"><ChevronRight size={ICON.md} /></span>
        </button>

        <div className="absolute top-4 right-2 z-30 flex items-center gap-1">
          <button
            onClick={() => setPlaying(p => !p)}
            aria-label={playing ? 'Pause the guide' : 'Play the guide'}
            aria-pressed={!playing}
            className="p-1.5 rounded-full bg-black/50 text-white focus:outline-none focus-visible:bg-black/80"
          >
            {playing ? <Pause size={ICON.sm} /> : <Play size={ICON.sm} />}
          </button>
          <span className="px-1.5 py-0.5 rounded-full bg-black/50 text-white text-[10px] tabular-nums">
            {index + 1}/{slides.length}
          </span>
        </div>

        <div className={cx('absolute inset-x-0 bottom-0 p-4 z-20 pointer-events-none', onImage ? 'text-white' : t.text)}>
          {slide.heading && <p className="font-semibold leading-tight text-base">{slide.heading}</p>}
          {slide.caption && (
            <div
              className={cx('rhq-prose mt-1 leading-snug text-xs', onImage ? 'text-white/90' : t.textSecondary)}
              dangerouslySetInnerHTML={{ __html: slide.caption }}
            />
          )}
        </div>

        <span className="sr-only" aria-live="polite">
          Screen {index + 1} of {slides.length}. {slide.heading || ''} {onImage ? slide.alt || '' : ''}
        </span>
      </div>

      <p className={cx('text-[11px] text-center', t.textMuted)}>
        {reduced
          ? 'Auto-advance is off because your system asks for reduced motion. Use the arrows or arrow keys.'
          : 'Arrow keys move · space pauses · press and hold to pause'}
      </p>
    </div>
  );
}

/* ==================================================================== *
 * Did this resolve it?
 * ==================================================================== */

function ResolvePrompt({ onYes, onNo }) {
  const { t } = useTheme();
  return (
    <div className={cx('rounded-2xl border p-6 flex items-center justify-between gap-4 flex-wrap', t.portalCard)}>
      <div className="min-w-0">
        <p className={cx('text-lg font-semibold', t.text)}>Did this resolve your issue?</p>
        <p className={cx('text-sm mt-1', t.textSecondary)}>
          If not, we will take you straight to the request forms for this service.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="solid" accent="emerald" icon={ThumbsUp} onClick={onYes}>Yes, all done</Button>
        <Button variant="soft" accent="rose" icon={ThumbsDown} onClick={onNo}>No, I need help</Button>
      </div>
    </div>
  );
}

function ResolvedScreen({ atom, itemName, onBrowse, onBackToItem }) {
  const { t, a } = useTheme();
  const c = a('emerald');
  return (
    <div className={cx(READ, 'py-14')}>
      <div className={cx('rounded-3xl border p-10 text-center shadow-sm', t.portalCard)}>
        <span className={cx('inline-flex w-16 h-16 rounded-full items-center justify-center mb-5', c.softStrong)}>
          <CircleCheck size={32} className={c.fg} />
        </span>
        <h2 className={cx('text-3xl font-semibold tracking-tight', t.text)}>Glad that sorted it.</h2>
        <p className={cx('text-base mt-3 leading-relaxed max-w-xl mx-auto', t.textSecondary)}>
          You did not need to raise a request, and nobody had to answer one. That is the whole point of putting
          <strong className={t.text}> {atom.title}</strong> in front of the form instead of behind it.
        </p>
        {atom.helpfulYes ? (
          <p className={cx('text-sm mt-4', t.textMuted)}>
            {atom.helpfulYes.toLocaleString()} other people have marked this article helpful.
          </p>
        ) : null}
        <div className="flex items-center justify-center gap-2 mt-8 flex-wrap">
          {itemName && <Button variant="outline" size="lg" onClick={onBackToItem}>Back to {itemName}</Button>}
          <Button variant="grad" module="portal" size="lg" onClick={onBrowse}>Back to the help centre</Button>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Intake — the request form, with conditional fields actually evaluating
 * ==================================================================== */

function IntakeScreen({
  subform, item, answers, touched, queue, defaultQueue, policy, people, assets,
  requesterId, onChange, onSubmit, onCancel,
}) {
  const { t } = useTheme();
  const shown = visibleFields(subform, answers);
  const hidden = (subform.fields || []).length - shown.length;
  const missing = shown.filter(f => f.required && isEmptyAnswer(answers[f.id]));

  return (
    <>
      <PageBand
        icon={FileQuestion}
        hue={entityHue('subform')}
        eyebrow="Request"
        title={subform.name}
        sub={subform.description}
        meta={item ? <Chip accent={entityHue('item')} icon={Circle}>{item.name}</Chip> : null}
      />

      <div className={cx(MID, 'pb-16 space-y-5')}>
        {queue ? (
          <Banner accent="blue" icon={Route} title={`This goes to ${queue.name}`}>
            {queue.description || 'Routed by the request form, not by keyword guessing.'}
            {policy && <> Because this intake carries the <strong className={t.text}>{policy.name}</strong> policy, an approval may start the moment you submit.</>}
          </Banner>
        ) : (
          <Banner accent="amber" icon={CircleAlert} title="No routing configured on this form">
            Requests from here land in the <strong className={t.text}>{defaultQueue?.name || 'General'}</strong> queue and are
            triaged from there. Nothing is ever silently parked.
          </Banner>
        )}

        <div className={cx('rounded-2xl border p-6 sm:p-7 space-y-5 shadow-sm', t.portalCard)}>
          {shown.map(f => (
            <IntakeField
              key={f.id}
              field={f}
              value={answers[f.id]}
              error={touched && f.required && isEmptyAnswer(answers[f.id]) ? 'This one is required.' : undefined}
              people={people}
              assets={assets}
              requesterId={requesterId}
              onChange={(v) => onChange(f.id, v)}
            />
          ))}

          {hidden > 0 && (
            <p className={cx('text-xs flex items-center gap-1.5', t.textMuted)}>
              <Info size={ICON.xs} />
              {hidden} further {hidden === 1 ? 'question is' : 'questions are'} hidden until your answers call for {hidden === 1 ? 'it' : 'them'}.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className={cx('text-xs', t.textMuted)}>
            {touched && missing.length
              ? `Still needed: ${missing.map(f => f.label).join(', ')}`
              : `${plural(shown.length, 'question', 'questions')} · ${shown.filter(f => f.required).length} required`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="lg" onClick={onCancel}>Cancel</Button>
            <Button variant="grad" module="portal" size="lg" icon={Send} onClick={onSubmit}>
              {subform.submitLabel || 'Submit request'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function IntakeField({ field, value, error, people, assets, requesterId, onChange }) {
  const { t } = useTheme();
  const common = { accent: 'purple' };

  if (field.type === 'checkbox') {
    return (
      <Field error={error}>
        <Checkbox
          label={field.label}
          hint={field.help}
          checked={value === true}
          onChange={(v) => onChange(v)}
        />
      </Field>
    );
  }

  if (field.type === 'file') {
    return (
      <Field label={field.label} hint={field.help} required={field.required} error={error}>
        <div className={cx('rounded-lg border border-dashed px-3 py-3 flex items-center gap-2 text-xs', t.bgInput, t.borderLight, t.textMuted)}>
          <Paperclip size={ICON.base} />
          Attachments are collected here in the real product. This prototype records the request without file storage.
        </div>
      </Field>
    );
  }

  if (field.type === 'multiselect') {
    const picked = Array.isArray(value) ? value : [];
    return (
      <Field label={field.label} hint={field.help} required={field.required} error={error}>
        <div className={cx('rounded-lg border p-2 flex flex-wrap gap-1.5', t.bgInput, t.borderLight)}>
          {(field.options || []).map(o => (
            <MultiOption
              key={o}
              label={o}
              selected={picked.includes(o)}
              onToggle={() => onChange(picked.includes(o) ? picked.filter(x => x !== o) : [...picked, o])}
            />
          ))}
        </div>
      </Field>
    );
  }

  if (field.type === 'select') {
    return (
      <Field label={field.label} hint={field.help} required={field.required} error={error}>
        <Select {...common} value={value || ''} placeholder="Choose one…"
          options={field.options || []} onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }

  if (field.type === 'user') {
    return (
      <Field label={field.label} hint={field.help} required={field.required} error={error}>
        <Select {...common} value={value || ''} placeholder="Choose a person…"
          options={(people || []).map(p => ({ value: p.id, label: p.name + (p.title ? ` — ${p.title}` : '') }))}
          onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }

  if (field.type === 'asset') {
    const mine = (assets || []).filter(x => x.assignedToId && x.assignedToId === requesterId);
    const pool = mine.length ? mine : (assets || []).slice(0, 40);
    return (
      <Field label={field.label}
        hint={field.help || (mine.length ? 'Devices currently assigned to you.' : undefined)}
        required={field.required} error={error}>
        <Select {...common} value={value || ''} placeholder="Choose equipment…"
          options={pool.map(x => ({ value: x.id, label: `${x.name}${x.assetTag ? ` · ${x.assetTag}` : ''}` }))}
          onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }

  if (field.type === 'textarea') {
    return (
      <Field label={field.label} hint={field.help} required={field.required} error={error}>
        <Textarea {...common} rows={3} value={value || ''} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }

  const inputType = field.type === 'email' ? 'email'
    : field.type === 'phone' ? 'tel'
    : field.type === 'date' ? 'date'
    : field.type === 'number' || field.type === 'currency' ? 'number'
    : 'text';

  return (
    <Field label={field.label} hint={field.help} required={field.required} error={error}>
      <Input {...common} type={inputType} value={value ?? ''} placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function MultiOption({ label, selected, onToggle }) {
  const { t, a } = useTheme();
  const c = a('purple');
  return (
    <button
      onClick={onToggle}
      aria-pressed={selected}
      className={cx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
        selected ? cx(c.soft, c.fgOnSoft, c.borderStrong) : cx(t.bgCard, t.borderLight, t.textSecondary, t.bgHover))}
    >
      {label}
    </button>
  );
}

/* ==================================================================== *
 * Receipt — proof the submission really landed
 * ==================================================================== */

function ReceiptScreen({ receipt, queue, approval, directory, onDone, onRequests }) {
  const { t, a } = useTheme();
  const c = a('emerald');
  const prog = approval ? progress(approval) : null;
  const stage = approval?.stages?.[approval.currentStage] || null;
  const approverNames = (stage?.approverIds || [])
    .map(id => (directory.find(p => p.id === id) || {}).name)
    .filter(Boolean);

  return (
    <div className={cx(READ, 'py-14 space-y-4')}>
      <div className={cx('rounded-3xl border p-10 text-center shadow-sm', t.portalCard)}>
        <span className={cx('inline-flex w-16 h-16 rounded-full items-center justify-center mb-5', c.softStrong)}>
          <CircleCheck size={32} className={c.fg} />
        </span>
        <h2 className={cx('text-3xl font-semibold tracking-tight', t.text)}>We have it.</h2>
        <p className={cx('text-base mt-3 leading-relaxed max-w-xl mx-auto', t.textSecondary)}>
          {receipt.confirmation || 'Your request has been logged and is on its way to the right team.'}
        </p>
        <p className={cx('mt-6 text-4xl font-semibold tracking-tight tabular-nums', t.text)}>{receipt.key}</p>
        <p className={cx('text-sm mt-1.5', t.textMuted)}>{receipt.title}</p>
      </div>

      {receipt.fellBack ? (
        <Banner accent="amber" icon={CircleAlert} title="No routing on that form">
          It went to <strong className={t.text}>{queue?.name || 'General'}</strong>, the catch-all queue, and will be triaged from there.
          RelayHQ says this out loud rather than letting a request quietly disappear into a default.
        </Banner>
      ) : (
        <Banner accent="blue" icon={Route} title={`Routed to ${queue?.name || 'a queue'}`}>
          The request form decided the destination — {queue?.description || 'no keyword guessing involved'}.
        </Banner>
      )}

      {approval && (
        <Banner accent="amber" icon={Stamp} title={`Approval started · ${receipt.policyName}`}>
          {approverNames.length > 0 ? (
            <span className="flex items-center gap-1.5 flex-wrap">
              Waiting on
              <ChipGroup accent="amber" icon={User} max={3} items={approverNames} />
              — stage {prog.stageNumber} of {prog.totalStages}, {prog.approvals} of {prog.need} approved.
            </span>
          ) : (
            <>This stage resolved to nobody, which is a configuration fault rather than an automatic pass. It is flagged in the Approvals module instead of being skipped.</>
          )}
        </Banner>
      )}

      {!approval && receipt.policyName && (
        <Banner accent="slate" icon={Info} title="No approval needed">
          The <strong className={t.text}>{receipt.policyName}</strong> policy is attached to this form, but your answers did not
          meet its conditions, so nothing was sent for sign-off.
        </Banner>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
        <Button variant="ghost" icon={Inbox} onClick={onRequests}>See my requests</Button>
        <div className="flex items-center gap-2">
          <Button variant="soft" accent="teal" icon={ArrowRight}
            onClick={() => navigate('workspace', 'tickets', receipt.ticketId)}>
            Open it in the agent workspace
          </Button>
          <Button variant="grad" module="portal" onClick={onDone}>Done</Button>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * My requests
 * ==================================================================== */

function RequestsScreen({ tickets, orgTickets, org, queues, requester, onOpen, onBrowse }) {
  const { t } = useTheme();

  return (
    <>
      <PageBand
        icon={Inbox}
        hue={entityHue('ticket')}
        eyebrow="My requests"
        title={tickets.length ? `${plural(tickets.length, 'request', 'requests')} on the go` : 'Nothing open'}
        sub={requester
          ? `Everything ${requester.name} has raised through this portal, with the team working it and their replies.`
          : 'Everything you have raised through this portal.'}
      />

      <div className={cx(WIDE, 'pb-16 space-y-10')}>
        <section>
          {tickets.length === 0 ? (
            <EmptyState icon={Inbox} title="Nothing open"
              hint="Requests you submit show up here with their status, the team working them and the replies."
              action={<Button variant="grad" module="portal" onClick={onBrowse}>Browse the help centre</Button>} />
          ) : (
            <div className={DENSITY.rowGap}>
              {tickets.map(tk => (
                <RequestRow key={tk.id} ticket={tk} queue={queues.get(tk.queueId)} onOpen={() => onOpen(tk.id)} />
              ))}
            </div>
          )}
        </section>

        {orgTickets.length > 0 && (
          <section>
            <SectionHead
              eyebrow="Shared visibility"
              title={`Also open at ${org.name}`}
              hint="Colleagues on the same account. Shared visibility stops three people raising the same ticket."
            />
            <div className={DENSITY.rowGap}>
              {orgTickets.map(tk => (
                <RequestRow key={tk.id} ticket={tk} queue={queues.get(tk.queueId)} muted onOpen={() => onOpen(tk.id)} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function RequestRow({ ticket, queue, muted, onOpen }) {
  const { t, a } = useTheme();
  const c = a(muted ? 'slate' : entityHue('ticket'));
  return (
    <button
      onClick={onOpen}
      className={cx('group w-full text-left rounded-xl border flex items-center gap-3 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        DENSITY.rowPad, t.portalCard)}
    >
      <IconTile icon={Inbox} accent={muted ? 'slate' : entityHue('ticket')} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm font-medium truncate', t.text)}>{ticket.title}</span>
        <span className={cx('block text-xs truncate', t.textMuted)}>
          {ticket.key} · {queue?.name || 'Unrouted'} · raised {fmtWhen(ticket.createdAt)}
        </span>
      </span>
      <span className="flex items-center gap-2.5 flex-shrink-0">
        <PriorityFlag priority={ticket.priority} withLabel={false} />
        <StatusPill status={ticket.status} />
        <ChevronRight size={ICON.md} className={cx('opacity-0 group-hover:opacity-100 transition-opacity', c.fg)} />
      </span>
    </button>
  );
}

function TicketModal({ ticket, queues, subforms, onClose }) {
  const { t } = useTheme();
  if (!ticket) return null;
  const publicComments = (ticket.comments || []).filter(c => !c.internal);
  const sf = subforms.get(ticket.subformId) || null;
  const answers = ticket.answers || null;

  return (
    <Modal
      open
      onClose={onClose}
      accent="rose"
      size="modalMd"
      icon={Inbox}
      title={ticket.title}
      subtitle={`${ticket.key} · raised ${fmtWhen(ticket.createdAt)}`}
      footer={<>
        <span className={cx('text-xs', t.textMuted)}>
          {queues.get(ticket.queueId)?.name || 'Unrouted'}
        </span>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={ticket.status} />
          <PriorityFlag priority={ticket.priority} />
          {sf && <Chip accent={entityHue('subform')} icon={FileQuestion}>{sf.name}</Chip>}
        </div>

        {ticket.description && (
          <div>
            <GroupLabel>What you told us</GroupLabel>
            <p className={cx('text-sm mt-1 whitespace-pre-line leading-relaxed', t.textSecondary)}>{ticket.description}</p>
          </div>
        )}

        {answers && Object.keys(answers).length > 0 && sf && (
          <div>
            <GroupLabel>Your answers</GroupLabel>
            <dl className="mt-1 space-y-1">
              {(sf.fields || []).filter(f => !isEmptyAnswer(answers[f.id])).map(f => (
                <div key={f.id} className="flex items-baseline gap-2 text-xs">
                  <dt className={cx('flex-shrink-0 w-40 truncate', t.textMuted)}>{f.label}</dt>
                  <dd className={t.text}>
                    {Array.isArray(answers[f.id]) ? answers[f.id].join(', ')
                      : answers[f.id] === true ? 'Yes' : String(answers[f.id])}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {publicComments.length > 0 && (
          <div>
            <GroupLabel>Replies</GroupLabel>
            <div className="mt-1 space-y-2">
              {publicComments.map(c => (
                <div key={c.id} className={cx('rounded-lg border p-2.5', t.portalCard)}>
                  <p className={cx('text-[11px] mb-1', t.textMuted)}>{fmtWhen(c.at)}</p>
                  <p className={cx('text-sm leading-relaxed', t.textSecondary)}>{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * Academy — the same atoms, sequenced for customers
 * ==================================================================== */

function AcademyScreen({ orgName, curricula, courses, byKb, byCourse, onCourse }) {
  const { t } = useTheme();

  return (
    <>
      <PageBand
        icon={GraduationCap}
        hue={entityHue('curriculum')}
        eyebrow="Academy"
        title={`${orgName} Academy`}
        sub="Every lesson below is a live help-centre article. The academy is an ordering over content that already exists — which is why a customer can be certified on material they could have read anyway."
      />

      <div className={cx(WIDE, 'pb-16 space-y-10')}>
        {curricula.length > 0 && (
          <section className="space-y-4">
            {curricula.map(cur => (
              <Panel
                key={cur.id}
                icon={Award}
                accent="indigo"
                title={cur.name}
                subtitle={cur.certificateName ? `Certificate: ${cur.certificateName}` : undefined}
                action={cur.targetDays ? <Chip accent="indigo" icon={Clock}>{cur.targetDays} days</Chip> : null}
              >
                <div className="p-5 space-y-3">
                  <p className={cx('text-sm leading-relaxed', t.textSecondary)}>{cur.summary}</p>
                  <ChipGroup
                    accent="indigo"
                    icon={BookMarked}
                    max={4}
                    items={(cur.courseIds || []).map(id => byCourse.get(id)).filter(Boolean)}
                    render={(c) => c.title}
                  />
                </div>
              </Panel>
            ))}
          </section>
        )}

        <section>
          <SectionHead
            eyebrow="Courses"
            title="Learn it end to end"
            hint={`${plural(courses.length, 'course is', 'courses are')} open to customers, built from the same articles the help centre publishes.`}
          />
          <div className="flex flex-wrap gap-4 items-stretch">
            {courses.map(c => <CourseCard key={c.id} course={c} byKb={byKb} onOpen={() => onCourse(c.id)} />)}
          </div>
        </section>
      </div>
    </>
  );
}

function CourseCard({ course, byKb, onOpen }) {
  const { t, a } = useTheme();
  const c = a('indigo');
  const lessons = lessonIdsOf(course);
  const minutes = courseMinutes(course, byKb);

  return (
    <button
      onClick={onOpen}
      className={cx('group relative text-left rounded-2xl border overflow-hidden p-5 flex flex-col',
        'flex-1 basis-[20rem] min-w-[17rem] shadow-sm',
        'transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl', t.portalCard)}
    >
      <span aria-hidden className={cx('absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity', c.rail)} />
      <span aria-hidden className={cx('absolute inset-0 rounded-2xl border-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity', c.borderStrong)} />

      <span className="flex items-start justify-between gap-3">
        <IconTile icon={BookMarked} accent="indigo" size="lg" />
        {course.certificate && <Chip accent="amber" icon={Award}>Certificate</Chip>}
      </span>

      <span className={cx('mt-4 block text-base font-semibold leading-snug text-balance', t.text)}>{course.title}</span>
      <span className={cx('mt-2 block text-sm leading-relaxed line-clamp-2 min-h-[2.75rem]', t.textSecondary)}>
        {course.summary}
      </span>

      <span className={cx('mt-auto pt-4 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs border-t', t.textMuted, t.border)}>
        <span className="flex items-center gap-1.5"><BookOpen size={ICON.xs} />{plural(lessons.length, 'lesson', 'lessons')}</span>
        {minutes ? <span className="flex items-center gap-1.5"><Clock size={ICON.xs} />{fmtMinutes(minutes)}</span> : null}
        <span className="flex items-center gap-1.5"><Layers size={ICON.xs} />{plural((course.modules || []).length, 'module', 'modules')}</span>
      </span>
    </button>
  );
}

function CourseScreen({ course, byKb, catalog, onLesson }) {
  const { t } = useTheme();
  const lessons = lessonIdsOf(course);
  const minutes = courseMinutes(course, byKb);
  const placed = useMemo(() => {
    const inCatalog = new Set();
    for (const { node } of walkCatalog(catalog)) {
      for (const id of node.knowledgeIds || []) inCatalog.add(id);
    }
    return lessons.filter(id => inCatalog.has(id)).length;
  }, [catalog, lessons]);

  return (
    <>
      <PageBand
        icon={BookMarked}
        hue={entityHue('course')}
        eyebrow="Course"
        title={course.title}
        sub={course.summary}
        meta={<>
          {course.certificate && <Chip accent="amber" icon={Award}>{course.certificateName || 'Certificate'}</Chip>}
          <Chip accent="slate" icon={Clock}>{fmtMinutes(minutes) || 'Self-paced'}</Chip>
          {/* No "N lessons" chip: a chip carries a value, and every lesson is
              named in the module list directly below. The count belongs to the
              module headings, not to a pill pretending to be one. */}
        </>}
      />

      <div className={cx(MID, 'pb-16 space-y-8')}>
        {placed > 0 && (
          <Banner accent="blue" icon={BookOpen} title="Nothing here was written for the course">
            {placed} of these {lessons.length} lessons are the same articles published in the help centre. Author once, and
            the atom keeps its identity wherever it is used.
          </Banner>
        )}

        {(course.modules || []).map((m, mi) => (
          <section key={m.id}>
            <SectionHead eyebrow={`Module ${mi + 1}`} title={m.title} hint={m.summary} />
            <div className={DENSITY.rowGap}>
              {(m.lessonIds || []).map(id => {
                const k = byKb.get(id);
                if (!k) return null;
                return <LessonRow key={id} atom={k} onOpen={() => onLesson(id)} />;
              })}
              {m.quiz && (
                <div className={cx('rounded-xl border flex items-center gap-3', DENSITY.rowPad, t.portalCard)}>
                  <IconTile icon={ShieldCheck} accent={entityHue('quiz')} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-sm font-medium truncate', t.text)}>{m.quiz.title || 'Knowledge check'}</p>
                    <p className={cx('text-xs', t.textMuted)}>
                      {plural((m.quiz.questions || []).length, 'question', 'questions')} · pass at {m.quiz.passingScore || course.passingScore || 80}%
                    </p>
                  </div>
                  <EntityTag kind="quiz" />
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function LessonRow({ atom, onOpen }) {
  const { t, a } = useTheme();
  const guide = atom.format === 'guide';
  const c = a(entityHue('lesson'));
  const Glyph = guide ? LayoutGrid : BookOpen;
  return (
    <button
      onClick={onOpen}
      className={cx('group w-full text-left rounded-xl border flex items-center gap-3 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        DENSITY.rowPad, t.portalCard)}
    >
      <IconTile icon={Glyph} accent={entityHue(guide ? 'guide' : 'lesson')} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm font-medium truncate', t.text)}>{atom.title}</span>
        <span className={cx('block text-xs truncate', t.textMuted)}>{atom.objective || atom.summary}</span>
      </span>
      <span className="flex items-center gap-2.5 flex-shrink-0">
        <EntityTag kind={guide ? 'guide' : 'article'} />
        {atom.minutes ? <span className={cx('text-xs tabular-nums', t.textMuted)}>{atom.minutes} min</span> : null}
        <ChevronRight size={ICON.md} className={cx('opacity-0 group-hover:opacity-100 transition-opacity', c.fg)} />
      </span>
    </button>
  );
}

/* ==================================================================== *
 * Footer — brand, the quiet links, and the sign-in note that used to be a
 * full-width banner competing with the hero.
 * ==================================================================== */

function PortalFooter({ form, orgName, external, requester, hasAcademy, onHelp, onRequests, onAcademy, onWhy }) {
  const { t } = useTheme();
  return (
    <footer className={cx('border-t mt-4', t.border)}>
      <div className={cx(WIDE, 'py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1.2fr]')}>
        <div>
          <span className="flex items-center gap-2.5">
            <span className={cx('w-8 h-8 rounded-lg flex-shrink-0', GRADIENT.brand)} />
            <span className={cx('text-base font-semibold', t.text)}>{orgName}</span>
          </span>
          <p className={cx('mt-4 text-sm leading-relaxed max-w-sm', t.textSecondary)}>
            {form.description || 'One place to find an answer, and to ask for help when there is not one yet.'}
          </p>
        </div>

        <nav aria-label="Portal">
          <p className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] mb-3', t.textMuted)}>This portal</p>
          <ul className="space-y-2.5">
            <li>
              <button onClick={onHelp} className={cx('text-sm hover:underline', t.textSecondary)}>Help centre</button>
            </li>
            <li>
              <button onClick={onRequests} className={cx('text-sm hover:underline', t.textSecondary)}>My requests</button>
            </li>
            {hasAcademy && (
              <li>
                <button onClick={onAcademy} className={cx('text-sm hover:underline', t.textSecondary)}>Academy</button>
              </li>
            )}
            <li>
              <button onClick={onWhy}
                className={cx('text-sm hover:underline inline-flex items-center gap-1.5', t.textSecondary)}>
                <Sparkles size={ICON.sm} />Why this works
              </button>
            </li>
          </ul>
        </nav>

        <div>
          <p className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] mb-3', t.textMuted)}>Signing in</p>
          <p className={cx('text-sm leading-relaxed', t.textSecondary)}>
            {form.requireSignIn ? (
              <>
                This portal requires an {external ? 'account' : `${orgName}`} sign-in, so requests arrive already attached
                to the person who raised them — no “what is your email address” round trip.
                {requester && <> You are signed in as <strong className={t.text}>{requester.name}</strong>.</>}
              </>
            ) : (
              <>
                Anyone can read and search here without signing in. A sign-in is only asked for when you raise a request,
                so we can attach it to you and show you the reply.
              </>
            )}
          </p>
        </div>
      </div>

      <div className={cx('border-t', t.border)}>
        <div className={cx(WIDE, 'py-5 flex items-center justify-between gap-3 flex-wrap text-xs')}>
          <span className={t.textMuted}>{orgName} · {form.name}</span>
          <span className={cx('flex items-center gap-1.5', t.textMuted)}>
            Powered by
            <span className={cx('inline-flex items-center gap-1.5 font-medium', t.textSecondary)}>
              <span className={cx('w-3.5 h-3.5 rounded-[4px] flex-shrink-0', GRADIENT.brand)} />
              RelayHQ
            </span>
            · service, support and training on one substrate
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ==================================================================== *
 * The argument
 *
 * Everything below is computed from state. No industry statistics, no outside
 * research — only what is true of the data on this screen. It lives behind a
 * quiet footer link now, because a customer came here for help, not for a
 * pitch — but a viewer evaluating the product can still open it in one click.
 * ==================================================================== */

function computeFacts(s, defaultQueue) {
  const flat = walkCatalog(s.catalog || []);
  const products = flat.filter(x => x.node.type === 'product');
  const subcategories = flat.filter(x => x.node.type === 'subcategory');
  const items = flat.filter(x => x.node.type === 'item');
  const knowledge = (s.knowledge || []).filter(publishedAtom);
  const subforms = s.subforms || [];
  const courses = s.courses || [];

  const lessonSet = new Set();
  for (const c of courses) for (const id of lessonIdsOf(c)) lessonSet.add(id);
  const reusedAsLessons = knowledge.filter(k => lessonSet.has(k.id));

  const placements = new Map();
  for (const { node } of items) {
    for (const id of node.knowledgeIds || []) {
      if (!placements.has(id)) placements.set(id, []);
      placements.get(id).push(node);
    }
  }
  const multiPlaced = [...placements.entries()].filter(([, list]) => list.length > 1);

  const routed = subforms.filter(f => f.routing?.queueId && f.routing.queueId !== defaultQueue?.id);
  const withApproval = subforms.filter(f => f.approvalPolicyId);
  const helpBeforeForm = items.filter(x => (x.node.knowledgeIds || []).length && (x.node.subformIds || []).length);
  const multiIntake = items.filter(x => (x.node.subformIds || []).length > 1);
  const conditionalFields = subforms.reduce((n, f) => n + (f.fields || []).filter(x => x.showIf).length, 0);

  /* The exemplar for the three-way diagram — a real atom with all three
   * destinations populated, picked by score rather than named in code. */
  let exemplar = null;
  for (const k of knowledge) {
    const places = placements.get(k.id) || [];
    const internalCourses = courses.filter(c => c.audience !== 'external' && lessonIdsOf(c).includes(k.id));
    const externalCourses = courses.filter(c => c.audience === 'external' && lessonIdsOf(c).includes(k.id));
    if (!places.length) continue;
    const score = (places.length ? 1 : 0) + (internalCourses.length ? 1 : 0) + (externalCourses.length ? 1 : 0);
    const size = places.length + internalCourses.length + externalCourses.length;
    const best = exemplar ? exemplar.score * 100 + exemplar.size : -1;
    if (score * 100 + size > best) exemplar = { atom: k, places, internalCourses, externalCourses, score, size };
  }

  /* A real drill-down path, used for the side-by-side comparison. */
  let sample = null;
  for (const { node, trail } of items) {
    const help = (node.knowledgeIds || []).length;
    const forms = (node.subformIds || []).length;
    if (!help || !forms) continue;
    if (!sample || help + forms > sample.help + sample.forms) sample = { node, trail, help, forms };
  }

  return {
    products: products.length,
    subcategories: subcategories.length,
    items: items.length,
    knowledge: knowledge.length,
    reusedAsLessons: reusedAsLessons.length,
    subforms: subforms.length,
    routed: routed.length,
    withApproval: withApproval.length,
    multiPlaced: multiPlaced.length,
    helpBeforeForm: helpBeforeForm.length,
    multiIntake: multiIntake.length,
    conditionalFields,
    courses: courses.length,
    defaultQueueName: defaultQueue?.name || 'General',
    exemplar,
    sample,
  };
}

function WhyPanel({ open, onClose, facts, subforms, queues, defaultQueue }) {
  const { t } = useTheme();
  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent="purple"
      size="modalXl"
      icon={Sparkles}
      title="Why this portal is shaped like this"
      subtitle="Every number below is counted from the data you are looking at right now."
      footer={<>
        <span className={cx('text-xs', t.textMuted)}>Reopen this any time from the footer.</span>
        {/* A modal dismiss is a solid, per the standard modal shell. */}
        <Button variant="solid" accent="purple" onClick={onClose}>Got it</Button>
      </>}
    >
      <div className="space-y-6">
        <WhyCompare facts={facts} subforms={subforms} queues={queues} defaultQueue={defaultQueue} />
        <Divider />
        <WhyNumbers facts={facts} />
        <Divider />
        <WhyDiagram facts={facts} />
      </div>
    </Modal>
  );
}

function WhyCompare({ facts, subforms }) {
  const { t, a } = useTheme();
  const slate = a('slate');
  const purple = a('purple');
  const sample = facts.sample;

  return (
    <section>
      <SectionHead
        title="The same request, two ways"
        hint="Left: what this instance looks like if every intake is offered at once. Right: what the portal actually does."
        className="mb-4"
      />
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))' }}>
        {/* Flat list */}
        <Card className="overflow-hidden">
          <div className={cx(DENSITY.sectionPad, 'border-b', t.borderLight)}>
            <p className={cx('text-sm font-semibold', t.text)}>A flat form list</p>
            <p className={cx('text-xs mt-0.5', t.textMuted)}>
              {facts.subforms} request forms, no hierarchy, no help attached. You have to already know the name of the
              thing you need.
            </p>
          </div>
          <div className={cx('max-h-56 overflow-auto divide-y', t.divide)}>
            {subforms.map(f => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                <FileQuestion size={ICON.sm} className={cx('flex-shrink-0', slate.fg)} />
                <span className={cx('text-xs truncate flex-1', t.textSecondary)}>{f.name}</span>
              </div>
            ))}
          </div>
          <div className={cx('px-3 py-2 border-t text-[11px]', t.borderLight, t.textMuted)}>
            No article is offered before any of them.
          </div>
        </Card>

        {/* RelayHQ */}
        <Card className="overflow-hidden">
          <div className={cx(DENSITY.sectionPad, 'border-b', t.borderLight)}>
            <p className={cx('text-sm font-semibold', t.text)}>RelayHQ: three steps, help first</p>
            <p className={cx('text-xs mt-0.5', t.textMuted)}>
              {facts.products} products › {facts.subcategories} subcategories › {facts.items} items.
            </p>
          </div>
          {sample ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {sample.trail.map((n, i) => (
                  <React.Fragment key={n.id}>
                    {i > 0 && <ChevronRight size={ICON.xs} className={t.textMuted} />}
                    <Chip accent={entityHue(n.type)}>{n.name}</Chip>
                  </React.Fragment>
                ))}
                <ChevronRight size={ICON.xs} className={t.textMuted} />
                <Chip accent={entityHue('item')}>{sample.node.name}</Chip>
              </div>
              <div className={cx('rounded-lg border p-2.5 space-y-1.5', t.borderLight)}>
                <p className={cx('text-xs font-medium flex items-center gap-1.5', t.text)}>
                  <BookOpen size={ICON.sm} className={a('blue').fg} />
                  Then {plural(sample.help, 'article', 'articles')} — shown first, every time
                </p>
                <p className={cx('text-xs font-medium flex items-center gap-1.5', t.text)}>
                  <FileQuestion size={ICON.sm} className={purple.fg} />
                  Then {plural(sample.forms, 'request form', 'request forms')}, each routed on its own
                </p>
              </div>
              <p className={cx('text-[11px]', t.textMuted)}>
                Across this catalog, {facts.helpBeforeForm} items put help in front of a form, and {facts.multiIntake} carry
                more than one intake — which a single form-per-item model cannot express.
              </p>
            </div>
          ) : (
            <div className={cx('p-3 text-xs', t.textMuted)}>No item in this catalog carries both help and a form yet.</div>
          )}
        </Card>
      </div>
    </section>
  );
}

function WhyNumbers({ facts }) {
  const { t } = useTheme();
  return (
    <section>
      <SectionHead
        title="What is actually in this instance"
        hint="Counted from state at render time — not typed in, and not borrowed from anybody's research."
        className="mb-4"
      />
      <div className="flex flex-wrap gap-2">
        <Stat label="catalog items" value={facts.items} accent="emerald" icon={Circle} />
        <Stat label="knowledge atoms" value={facts.knowledge} accent="blue" icon={BookOpen} />
        <Stat label="of those are also course lessons" value={facts.reusedAsLessons} accent="indigo" icon={GraduationCap} />
        <Stat label="request forms" value={facts.subforms} accent="purple" icon={FileQuestion} />
        <Stat label="route to a named queue" value={facts.routed} accent="rose" icon={Route} />
        <Stat label="start an approval" value={facts.withApproval} accent="amber" icon={Stamp} />
        <Stat label="atoms placed under more than one item" value={facts.multiPlaced} accent="teal" icon={Layers} />
        <Stat label="conditional questions" value={facts.conditionalFields} accent="cyan" icon={ListOrdered} />
      </div>
      <ul className={cx('mt-3 space-y-1.5 text-xs leading-relaxed', t.textSecondary)}>
        <li>
          <strong className={t.text}>{facts.reusedAsLessons} of {facts.knowledge}</strong> published atoms are doing double
          duty right now: the article a customer reads here is the lesson a course teaches. Nothing was copied to make
          that true — the course stores an id.
        </li>
        <li>
          <strong className={t.text}>{facts.routed} of {facts.subforms}</strong> request forms name their own destination
          queue. The remainder fall to <strong className={t.text}>{facts.defaultQueueName}</strong>, and the portal says so on
          the form and again on the receipt rather than letting it happen quietly.
        </li>
        <li>
          <strong className={t.text}>{facts.multiPlaced}</strong> atoms appear under more than one catalog item. In a model
          where an article belongs to one item, each of those would have been written more than once and would now
          disagree with itself.
        </li>
      </ul>

      <Banner accent="slate" icon={CircleAlert} title="What we will not tell you" className="mt-4">
        You will see a deflection percentage quoted almost everywhere in this category. We do not quote one, because
        we went looking for a trustworthy source and there is not one — the published figures run from 5% to 80%, every
        one of them is self-reported by a vendor, and the market leader publishes a formula with no benchmark at all.
        <span className="block mt-1.5">
          A request that was never filed leaves no record, so <strong className={t.text}>no system can observe deflection
          directly</strong>. What RelayHQ can honestly measure is <strong className={t.text}>assisted resolution</strong>:
          it owns both the drill path and the form, so it logs which atoms a person actually read before they submitted
          — or before they closed the tab without submitting. That number is ours to earn on your data, not to borrow.
        </span>
      </Banner>
    </section>
  );
}

function WhyDiagram({ facts }) {
  const { t, a } = useTheme();
  const ex = facts.exemplar;
  const blue = a('blue');

  if (!ex) {
    return (
      <section>
        <SectionHead title="One atom, three destinations" className="mb-4" />
        <EmptyState icon={BookOpen} title="No atom is placed yet"
          hint="Attach a knowledge atom to a catalog item and a course module to see this drawn." />
      </section>
    );
  }

  return (
    <section>
      <SectionHead
        title="One atom, three destinations"
        hint={`Drawn from a real record — “${ex.atom.title}” — and its actual placements.`}
        className="mb-4"
      />
      <div className="flex flex-col items-center">
        <Card accent="blue" className={cx(DENSITY.cardPad, 'w-full max-w-md flex items-start gap-3')}>
          <IconTile icon={ex.atom.format === 'guide' ? LayoutGrid : BookOpen} accent="blue" size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <EntityTag kind={ex.atom.format === 'guide' ? 'guide' : 'article'} />
              {ex.atom.minutes ? <span className={cx('text-[10px]', t.textMuted)}>{ex.atom.minutes} min</span> : null}
            </div>
            <p className={cx('text-sm font-semibold leading-tight', t.text)}>{ex.atom.title}</p>
            <p className={cx('text-xs mt-0.5', t.textMuted)}>Authored once, owned by one person, versioned in one place.</p>
          </div>
        </Card>
        <span className={cx('w-px h-5', blue.rail)} />
        <div className="grid gap-2 w-full" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}>
          <DestinationCard
            hue="emerald"
            icon={Circle}
            title="Deflection"
            caption="In the portal, above the request form"
            items={ex.places.map(n => n.name)}
            emptyNote="Not placed in the catalog."
          />
          <DestinationCard
            hue="rose"
            icon={Inbox}
            title="Agent enablement"
            caption="Taught to the people working the queue"
            items={ex.internalCourses.map(c => c.title)}
            emptyNote="Not in an internal course yet."
          />
          <DestinationCard
            hue="indigo"
            icon={GraduationCap}
            title="Training"
            caption="A lesson in the customer academy"
            items={ex.externalCourses.map(c => c.title)}
            emptyNote="Not in an external course yet."
          />
        </div>
      </div>
      <p className={cx('text-xs mt-3 leading-relaxed', t.textSecondary)}>
        Those are the live references, not an illustration. Edit that atom once and all three surfaces change together —
        which is the only reason a company can afford to keep a help centre, an enablement library and an academy at the
        same time.
      </p>
    </section>
  );
}

function DestinationCard({ hue, icon, title, caption, items, emptyNote }) {
  const { t, a } = useTheme();
  const c = a(hue);
  const Glyph = icon;
  return (
    <div className={cx('rounded-xl border p-3', t.bgCard, t.borderLight)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cx('w-1 h-6 rounded-full', c.rail)} />
        <Glyph size={ICON.md} className={c.fg} />
        <div className="min-w-0">
          <p className={cx('text-sm font-medium leading-tight', t.text)}>{title}</p>
          <p className={cx('text-[11px]', t.textMuted)}>{caption}</p>
        </div>
      </div>
      {items.length
        ? <ChipGroup accent={hue} max={3} items={items} />
        : <p className={cx('text-[11px] italic', t.textMuted)}>{emptyNote}</p>}
    </div>
  );
}
