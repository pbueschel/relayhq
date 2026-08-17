import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, BookOpen, Layers,
  Folder, Circle, Inbox, FileQuestion, CircleCheck, CircleAlert, Play, Pause, AlignLeft,
  Sparkles, GraduationCap, BookMarked, Clock, Stamp, Send, ThumbsUp, ThumbsDown, Info,
  Moon, Sun, LogOut, Building2, Users, User, Route, Eye, Award, Paperclip, Check,
  LayoutGrid, ListOrdered, MessageSquare, ShieldCheck, Video, Search, X,
  KeyRound, Mail, Laptop, AppWindow, Store, LifeBuoy,
  DollarSign, Truck, ShoppingCart, CalendarClock, Monitor, Headphones, Smartphone,
  Package, Boxes, Shield, UserPlus, UserMinus, DoorOpen, CreditCard, Rocket, Wrench,
  BadgeCheck, Briefcase, Server, Cloud, Printer, Keyboard, Armchair, MapPin, Ticket,
  HardDrive, Database, Globe, Wifi, Phone,
  PackageOpen, Palette, PenTool, ShieldAlert, UserCog, Presentation, FlaskConical,
} from 'lucide-react';
import {
  useTheme, cx, useDismiss, ICON, DENSITY, LAYOUT, GRADIENT, entityHue, moduleGradient,
  tint, statusMeta,
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
 * ============================================================================
 * TWO FRONT DOORS, AND ONE CONTAINED CARD
 * ============================================================================
 * The portal's primary switch is two categories that answer different questions:
 *
 *   GET HELP        "something is wrong" — the Product › Subcategory › Item drill
 *                   over `catalog`, knowledge first and a report-a-problem form
 *                   second. Deflection is the mechanic.
 *
 *   SERVICE CATALOG "I want something"   — a Category › ServiceItem browse over
 *                   `serviceCategories` + `serviceItems`, where an item carries a
 *                   price, a delivery time, an approval and a fulfilment queue.
 *
 * BROWSING IS A PAGE. THE LEAF IS A CARD. Picking an item does not navigate the
 * whole portal away: it opens a contained card over the page, and the whole leaf
 * journey happens INSIDE that card —
 *
 *     item (help above forms) → article / guide → request form → receipt
 *
 * Back moves up one level inside the card; close dismisses to the browse page
 * underneath, which never scrolled and never lost its place. That shape is the
 * v1 behaviour restored in the new visual language, because a person comparing
 * three services should not have to re-drill the catalog between each one.
 *
 * THE CARD IS A REAL DIALOG. Escape closes it, focus is trapped inside it,
 * background scroll is locked, and focus returns to whatever opened it. It is
 * composed here rather than taken from <Modal> only because the header is the v1
 * shape (close left, title optically centred) and the guide viewer wants more
 * width than the standard body — the structure and the accessibility contract
 * are the DS shell's.
 *
 * THE THINGS IT PROVES
 *  1. DRILL-DOWN — Product › Subcategory › Item, not a flat list of every form.
 *  2. KB BEFORE FORM — at an item, help is always rendered above the intakes.
 *     Ordering is the deflection mechanic and is not configurable here. The
 *     service catalog obeys the same rule with "before you order" knowledge.
 *  3. THE SUBMISSION REALLY LANDS — a request creates a ticket in the store,
 *     routed by the service item's fulfilment queue (or the subform's, falling
 *     back to General, said out loud), and starts a real approval. The receipt
 *     names the ticket key and, when an approval started, who it now waits on.
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
 * Service catalog helpers
 *
 * A ServiceItem names its icon as a lucide icon name. Components cannot live in
 * tokens.js, so the NAME → GLYPH map lives here; the HUE still comes from the
 * entity registry, exactly as it does for the help tree. An unrecognised name
 * falls back rather than throwing, because seed data should never blank a page.
 * ==================================================================== */

const SERVICE_GLYPH = {
  Laptop, Monitor, Headphones, Smartphone, Package, Boxes, AppWindow, KeyRound,
  Shield, ShieldCheck, Users, UserPlus, UserMinus, Building2, DoorOpen, Video,
  CreditCard, Rocket, LifeBuoy, Store, Wrench, BadgeCheck, Briefcase, Server,
  Cloud, Printer, Keyboard, Armchair, MapPin, Ticket, HardDrive, Database,
  Globe, Wifi, Phone, Mail, BookOpen, GraduationCap, Truck, ShoppingCart,
  CalendarClock, Sparkles, Circle, Folder, Layers, Award, Clock, Send, Route,
  Inbox, PackageOpen, Palette, PenTool, ShieldAlert, UserCog, Presentation, FlaskConical,
};

function serviceGlyph(name, fallback = Package) {
  if (!name) return fallback;
  const camel = String(name).trim().replace(/[-_\s]+(\w)/g, (_, ch) => ch.toUpperCase());
  const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
  return SERVICE_GLYPH[pascal] || fallback;
}

/** Money, or the honest word for free. `null` means "this item has no price". */
function fmtMoney(n) {
  if (n === null || n === undefined) return null;
  if (!Number(n)) return 'No charge';
  return Number(n).toLocaleString(undefined, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  });
}

/** The recurring half of a price, when there is one. */
function fmtRecurring(item) {
  const amount = fmtMoney(item?.recurringPrice);
  if (!amount || amount === 'No charge') return null;
  const period = item.recurrence === 'annual' ? 'year' : 'month';
  return `${amount} per ${period}`;
}

function fmtDelivery(days) {
  const n = Number(days);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return 'Available same day';
  if (n === 1) return 'Available in 1 day';
  return `Available in ${n} days`;
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
 * Accessibility
 *
 * Auto-advance is a WCAG 2.2.2 concern, so the guide player never starts a
 * timer for a reader who asked us not to move things.
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

/**
 * The dialog contract for the leaf card, kept identical to the DS <Modal>:
 * Escape closes, focus is trapped inside, background scroll is locked, and
 * focus returns to whatever opened the card.
 *
 * `onClose` is held in a ref so the effect depends only on `open` — rebinding it
 * every render would re-run the effect and steal focus out of the request form
 * on every keystroke.
 */
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ');

function useDialogShell(open, onClose, levelKey) {
  const ref = useRef(null);
  const bodyRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (ref.current) ref.current.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const box = ref.current;
      if (!box) return;
      const list = Array.from(box.querySelectorAll(FOCUSABLE)).filter(el => el.getClientRects().length);
      if (!list.length) { e.preventDefault(); box.focus(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (!box.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (e.shiftKey && (active === first || active === box)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === 'function') opener.focus();
    };
  }, [open]);

  /* Every level inside the card starts at the top, and focus follows the level
   * rather than being stranded on a control that no longer exists. */
  useEffect(() => {
    if (!open) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    const box = ref.current;
    if (box && !box.contains(document.activeElement)) box.focus();
  }, [open, levelKey]);

  return { ref, bodyRef };
}

/* ==================================================================== *
 * Portal
 * ==================================================================== */

const STORE_SLICE = (s) => ({
  catalog: s.catalog, knowledge: s.knowledge, subforms: s.subforms, forms: s.forms,
  serviceCategories: s.serviceCategories, serviceItems: s.serviceItems,
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

/* The two front doors, and the vocabulary each one uses. Hues come from the
 * entity registry rather than being picked to look nice: Get Help is fronted by
 * knowledge, the service catalog by orderable items. */
const DOOR = {
  help: {
    hue: entityHue('guide'),
    label: 'Get Help',
    headline: 'How can we help?',
    sub: 'Search the answers first. If none of them fit, the request form is one click further on — and it already knows what you read.',
    search: 'Search help articles and problems…',
    scope: 'help',
  },
  services: {
    hue: entityHue('item'),
    label: 'Service Catalog',
    headline: 'What do you need?',
    sub: 'Equipment, software, access and workplace services you can order. Every item says what it costs, when it arrives and who has to sign it off.',
    search: 'Search services you can order…',
    scope: 'the service catalog',
  },
};

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
  const [path, setPath] = useState([]);            // Get Help drill, a page
  const [svcCat, setSvcCat] = useState(null);      // Service catalog category, a page
  const [query, setQuery] = useState('');
  /* THE CARD. `leaf` is which leaf is open; `stack` is where you are INSIDE it.
   * An empty stack is the item view; frames above it are the article, the form,
   * the receipt. Neither touches `path` or `svcCat`, which is exactly why the
   * page underneath keeps its place. */
  const [leaf, setLeaf] = useState(null);          // { kind: 'help' | 'service', id }
  const [stack, setStack] = useState([]);
  const [answers, setAnswers] = useState({});
  const [touched, setTouched] = useState(false);
  const [emphasise, setEmphasise] = useState(false);
  const [courseId, setCourseId] = useState(null);
  const [lessonId, setLessonId] = useState(null);  // academy reading, still a page
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

  /* ---------------- Get Help: the help tree ---------------- */

  const products = useMemo(() => {
    const roots = s.catalog || [];
    return (form?.productIds || []).length
      ? roots.filter(n => form.productIds.includes(n.id))
      : roots.filter(n => audienceMatch(n.audience, form?.audience));
  }, [s.catalog, form]);

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

  const branch = trail[trail.length - 1] || null;
  const children = branch ? (branch.children || []) : products;
  const popular = useMemo(() => popularItems(products), [products]);

  /* ---------------- Service catalog: orderable things ---------------- */

  const svcItems = useMemo(() => (s.serviceItems || [])
    .filter(i => i.status !== 'draft' && audienceMatch(i.audience, form?.audience)),
  [s.serviceItems, form]);

  const svcCategories = useMemo(() => (s.serviceCategories || [])
    .filter(c => audienceMatch(c.audience, form?.audience))
    .filter(c => svcItems.some(i => i.categoryId === c.id))
    .slice()
    .sort((x, y) => (x.order ?? 99) - (y.order ?? 99)),
  [s.serviceCategories, svcItems, form]);

  const svcCategory = svcCat ? svcCategories.find(c => c.id === svcCat) || null : null;
  const svcInCategory = useMemo(
    () => (svcCategory ? svcItems.filter(i => i.categoryId === svcCategory.id) : []),
    [svcItems, svcCategory]);
  const svcPopular = useMemo(() => svcItems.filter(i => i.popular).slice(0, 6), [svcItems]);

  /* ---------------- the open leaf ---------------- */

  const helpItems = useMemo(() => walkCatalog(products).filter(x => x.node.type === 'item'), [products]);

  const leafHelp = useMemo(
    () => (leaf?.kind === 'help' ? helpItems.find(x => x.node.id === leaf.id) || null : null),
    [leaf, helpItems]);
  const leafService = useMemo(
    () => (leaf?.kind === 'service' ? svcItems.find(i => i.id === leaf.id) || null : null),
    [leaf, svcItems]);

  const leafName = leafHelp?.node.name || leafService?.name || '';
  const leafTrail = leafHelp
    ? leafHelp.trail.map(n => n.name).join(' › ')
    : leafService
      ? (svcCategories.find(c => c.id === leafService.categoryId)?.name || 'Service catalog')
      : '';

  const leafAtoms = useMemo(() => {
    const ids = leafHelp?.node.knowledgeIds || leafService?.knowledgeIds || [];
    return ids.map(id => byKb.get(id))
      .filter(k => publishedAtom(k) && audienceMatch(k.audience, form?.audience));
  }, [leafHelp, leafService, byKb, form]);

  const leafForms = useMemo(() => {
    const ids = leafHelp
      ? (leafHelp.node.subformIds || [])
      : leafService?.subformId ? [leafService.subformId] : [];
    return ids.map(id => bySf.get(id))
      .filter(f => !!f && f.enabled !== false && audienceMatch(f.audience, form?.audience));
  }, [leafHelp, leafService, bySf, form]);

  const frame = stack[stack.length - 1] || null;
  const frameAtom = frame?.type === 'atom' ? byKb.get(frame.id) || null : null;
  const frameIntake = frame?.type === 'form' ? bySf.get(frame.id) || null : null;
  const frameResolved = frame?.type === 'resolved' ? byKb.get(frame.id) || null : null;

  const svcPolicy = leafService
    ? (s.approvalPolicies || []).find(p => p.id === leafService.approvalPolicyId) || null
    : null;
  const svcQueue = leafService?.fulfilmentQueueId ? byQueue.get(leafService.fulfilmentQueueId) || null : null;

  /* Where an atom shows up elsewhere — the reuse, surfaced to the reader. */
  const alsoTaughtIn = useMemo(() => {
    const id = frameAtom?.id || lessonId;
    if (!id) return [];
    return (s.courses || []).filter(c => lessonIdsOf(c).includes(id));
  }, [frameAtom, lessonId, s.courses]);

  /* ---------------- search, scoped to the active tab ---------------- */

  const helpHost = useMemo(() => {
    const m = new Map();
    for (const entry of helpItems) {
      for (const id of entry.node.knowledgeIds || []) {
        const prev = m.get(id);
        const better = !prev
          || (!(prev.node.subformIds || []).length && (entry.node.subformIds || []).length);
        if (better) m.set(id, entry);
      }
    }
    return m;
  }, [helpItems]);

  const svcHost = useMemo(() => {
    const m = new Map();
    for (const it of svcItems) {
      for (const id of it.knowledgeIds || []) if (!m.has(id)) m.set(id, it);
    }
    return m;
  }, [svcItems]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    const hit = (...vals) => vals.some(v => String(v ?? '').toLowerCase().includes(q));
    const readable = (k) => publishedAtom(k) && audienceMatch(k.audience, form?.audience);

    if (tab === 'services') {
      const things = svcItems
        .filter(i => hit(i.name, i.shortDescription, i.description))
        .slice(0, 5)
        .map(i => ({
          id: i.id, kind: 'service', name: i.name,
          path: svcCategories.find(c => c.id === i.categoryId)?.name || 'Service catalog',
          icon: serviceGlyph(i.icon),
        }));
      const atoms = [...svcHost.entries()]
        .map(([id, host]) => ({ k: byKb.get(id), host }))
        .filter(x => readable(x.k) && hit(x.k.title, x.k.summary, ...(x.k.tags || [])))
        .slice(0, 5)
        .map(x => ({ ...x.k, leaf: { kind: 'service', id: x.host.id } }));
      return { atoms, things, thingLabel: 'Services you can order' };
    }

    const things = helpItems
      .filter(x => hit(x.node.name, x.node.description))
      .slice(0, 5)
      .map(x => ({
        id: x.node.id, kind: 'help', name: x.node.name,
        path: x.trail.map(n => n.name).join(' › '), icon: Circle,
      }));
    const atoms = [...helpHost.entries()]
      .map(([id, host]) => ({ k: byKb.get(id), host }))
      .filter(x => readable(x.k) && hit(x.k.title, x.k.summary, ...(x.k.tags || [])))
      .slice(0, 6)
      .map(x => ({ ...x.k, leaf: { kind: 'help', id: x.host.node.id } }));
    return { atoms, things, thingLabel: 'Where to report it' };
  }, [query, tab, svcItems, svcCategories, svcHost, helpItems, helpHost, byKb, form]);

  /* ---------------- my requests + academy ---------------- */

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

  const academyCourses = useMemo(
    () => (s.courses || []).filter(c => c.audience === 'external' && c.status !== 'draft'),
    [s.courses]);
  const academyCurricula = useMemo(
    () => (s.curricula || []).filter(c => c.audience === 'external' && c.status !== 'draft'),
    [s.curricula]);

  const course = courseId ? byCourse.get(courseId) || null : null;
  const lesson = lessonId ? byKb.get(lessonId) || null : null;

  /* ---------------- navigation ---------------- */

  const goHome = () => { setPath([]); setSvcCat(null); setQuery(''); };
  const drill = (node) => { setPath(p => [...p, node.id]); setQuery(''); };

  const closeLeaf = () => {
    setLeaf(null); setStack([]); setAnswers({}); setTouched(false); setEmphasise(false);
  };
  const openLeaf = (next, frames = []) => {
    setLeaf(next); setStack(frames); setAnswers({}); setTouched(false); setEmphasise(false); setQuery('');
  };
  const openHelpItem = (id) => openLeaf({ kind: 'help', id });
  const openService = (id) => openLeaf({ kind: 'service', id });
  const openAtomFrame = (id) => setStack(st => [...st, { type: 'atom', id }]);
  const openIntakeFrame = (id) => {
    setAnswers({}); setTouched(false);
    setStack(st => [...st, { type: 'form', id }]);
  };
  /* Back moves up ONE level inside the card. At the base level there is nothing
   * above the item but the browse page, so it dismisses — which is the same
   * gesture, one step further out. */
  const leafBack = () => {
    if (stack.length) { setStack(st => st.slice(0, -1)); return; }
    closeLeaf();
  };

  /* Reset the journey when the brand changes — a customer never sees two at once. */
  useEffect(() => {
    setPath([]); setSvcCat(null); setLeaf(null); setStack([]); setCourseId(null);
    setLessonId(null); setQuery(''); setEmphasise(false);
  }, [form?.id]);

  /* A page navigation starts at the top of the page, the way a real one would.
   * Opening the CARD is deliberately absent from this list: the page underneath
   * must keep its scroll position for when the card closes again. */
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [tab, path.length, svcCat, courseId, lessonId]);

  /* "No, I need help" promises to land you on the request forms for this
   * service. Inside the card that is one level up, with the intakes called out. */
  const onArticleNo = () => { setStack([]); setEmphasise(true); };
  const onArticleYes = (id) => setStack([{ type: 'resolved', id }]);

  /* ---------------- submission ---------------- */

  const submit = () => {
    const intake = frameIntake;
    if (!intake || !form) return;
    const shown = visibleFields(intake, answers);
    const missing = shown.filter(f => f.required && isEmptyAnswer(answers[f.id]));
    if (missing.length) { setTouched(true); return; }

    const st = getState();
    const svc = leafService;
    const helpNode = leafHelp?.node || null;

    /* A service item owns its fulfilment queue; a help intake owns its routing.
     * Either way an unrouted request falls to the catch-all and the receipt says
     * so out loud rather than letting it disappear into a default. */
    const wantedQueueId = svc?.fulfilmentQueueId || intake.routing?.queueId || null;
    const routed = wantedQueueId ? (st.queues || []).find(q => q.id === wantedQueueId) || null : null;
    const queue = routed || defaultQueue;

    const now = new Date().toISOString();
    const key = nextTicketKey(st.tickets);
    const answerCtx = answerContext(intake, answers);
    /* An order's price is an amount even when the form never asked for one, so a
     * spend policy can see it. Derived from the item, not typed in twice. */
    if (svc && answerCtx.amount === undefined && Number(svc.price)) answerCtx.amount = Number(svc.price);

    const ticket = {
      id: uid('tkt'),
      key,
      title: deriveTitle(intake, svc || helpNode, answers),
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
      catalogItemId: helpNode?.id || null,
      serviceItemId: svc?.id || null,
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

    /* Approval — run it for real so it turns up in the Approvals module.
     *
     * The two catalogs differ here on purpose. A subform ATTACHES a policy whose
     * conditions decide whether it applies, so the help path asks the engine
     * first. A service item DECLARES that it needs sign-off — that is what the
     * "Approval required" chip on the card promised — so naming a policy is the
     * condition, and it starts. */
    const policyId = svc?.approvalPolicyId || intake.approvalPolicyId || null;
    const policy = policyId ? (st.approvalPolicies || []).find(p => p.id === policyId) || null : null;
    let approvalId = null;
    let policyRan = false;
    let unresolved = false;

    if (policy) {
      const ctx = {
        requesterId: requester?.id,
        directory: st.directory || [],
        queues: st.queues || [],
        answers: answerCtx,
        ticket: {
          title: ticket.title, priority: ticket.priority, status: ticket.status,
          queueId: ticket.queueId, source: 'portal', labels: [],
          subformId: intake.id, catalogItemId: helpNode?.id || null,
        },
        requester: {
          department: external ? null : requester?.department || null,
          isExternal: !!external,
          vip: !!requester?.vip,
        },
        org: { plan: org?.plan || null },
        __now: now,
      };
      const declared = !!svc?.approvalPolicyId;
      if (declared || matchingPolicies([policy], ctx).length) {
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

    setStack([{
      type: 'receipt',
      receipt: {
        ticketId: ticket.id,
        key: ticket.key,
        title: ticket.title,
        queueId: queue?.id || null,
        fellBack: !routed,
        approvalId,
        policyName: policy?.name || null,
        policyRan,
        unresolved,
        confirmation: intake.confirmation || null,
        serviceName: svc?.name || null,
        delivery: svc ? fmtDelivery(svc.deliveryDays) : null,
        price: svc ? fmtMoney(svc.price) : null,
      },
    }]);
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
    { value: 'help', label: DOOR.help.label, icon: LifeBuoy, accent: DOOR.help.hue },
    { value: 'services', label: DOOR.services.label, icon: Store, accent: DOOR.services.hue },
    { value: 'requests', label: 'My requests', icon: Inbox, accent: entityHue('ticket'), count: myTickets.length },
  ];
  if (academyCourses.length) {
    tabs.push({
      value: 'academy', label: 'Academy', icon: GraduationCap,
      accent: entityHue('curriculum'), count: academyCourses.length,
    });
  }

  const door = DOOR[tab] || DOOR.help;
  const helpAtHome = !trail.length;
  const svcAtHome = !svcCategory;

  /* The card's frame decides its own accent, eyebrow and title, so the border
   * tells you what you are standing on without a second label. */
  const frameKind = frame?.type || 'item';
  const cardAccent = frameKind === 'atom'
    ? entityHue(frameAtom?.format === 'guide' ? 'guide' : 'article')
    : frameKind === 'form' ? entityHue('subform')
    : frameKind === 'receipt' ? entityHue('ticket')
    : frameKind === 'resolved' ? statusMeta('resolved').hue
    : entityHue('item');
  const cardEyebrow = frameKind === 'atom' ? (frameAtom?.format === 'guide' ? 'Guide' : 'Article')
    : frameKind === 'form' ? 'Request'
    : frameKind === 'receipt' ? 'Submitted'
    : frameKind === 'resolved' ? 'Sorted'
    : leaf?.kind === 'service' ? 'Service' : 'Help';
  const cardTitle = frameKind === 'atom' ? (frameAtom?.title || 'Article')
    : frameKind === 'form' ? (frameIntake?.name || 'Request')
    : frameKind === 'receipt' ? 'Request received'
    : frameKind === 'resolved' ? 'Glad that sorted it'
    : leafName;
  const cardSubtitle = frameKind === 'item' ? leafTrail : leafName;

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
        onHome={() => { setTab('help'); goHome(); closeLeaf(); }}
        /* Choosing a door from anywhere returns to that door's front page, and
         * dismisses whatever card is open — otherwise it is a dead click for
         * anyone standing inside an article. */
        onTab={(v) => {
          setTab(v); setCourseId(null); setLessonId(null); setQuery(''); closeLeaf();
          if (v === 'help') setPath([]);
          if (v === 'services') setSvcCat(null);
        }}
        onPickerOpen={() => setPickerOpen(v => !v)}
        onPickerClose={() => setPickerOpen(false)}
        /* Switching portal switches audience, catalog scope and requester, so it
         * lands on the new portal's front door. */
        onPick={(f) => {
          setPickerOpen(false);
          setFormId(f.id);
          setTab('help');
          navigate('portal', f.slug || f.id);
        }}
        onToggleTheme={toggle}
      />

      <div ref={scroller} className="flex-1 overflow-auto">
        {tab === 'help' && (helpAtHome ? (
          <>
            <PortalHero
              door={DOOR.help}
              form={form}
              external={external}
              orgName={orgName}
              query={query}
              onQuery={setQuery}
              results={results}
              onAtom={(hit) => openLeaf(hit.leaf, [{ type: 'atom', id: hit.id }])}
              onThing={(hit) => openHelpItem(hit.id)}
              popular={popular.map(({ node }) => ({ id: node.id, name: node.name, icon: Circle }))}
              popularHue={entityHue('item')}
              popularLabel="Most requested"
              onPopular={openHelpItem}
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
                <BrowseGrid nodes={children} onPick={(n) => (n.type === 'item' ? openHelpItem(n.id) : drill(n))} />
              )}
            </section>
          </>
        ) : (
          <>
            <TrailBar
              crumbs={[{ id: 'root', name: DOOR.help.label }, ...trail.map(n => ({ id: n.id, name: n.name }))]}
              onNavigate={(crumb, i) => setPath(path.slice(0, i))}
              onBack={() => setPath(p => p.slice(0, -1))}
              query={query}
              onQuery={setQuery}
              results={results}
              placeholder={DOOR.help.search}
              onAtom={(hit) => openLeaf(hit.leaf, [{ type: 'atom', id: hit.id }])}
              onThing={(hit) => openHelpItem(hit.id)}
            />
            <LevelScreen
              node={branch}
              nodes={children}
              level={trail.length}
              onPick={(n) => (n.type === 'item' ? openHelpItem(n.id) : drill(n))}
            />
          </>
        ))}

        {tab === 'services' && (svcAtHome ? (
          <>
            <PortalHero
              door={DOOR.services}
              form={form}
              external={external}
              orgName={orgName}
              query={query}
              onQuery={setQuery}
              results={results}
              onAtom={(hit) => openLeaf(hit.leaf, [{ type: 'atom', id: hit.id }])}
              onThing={(hit) => openService(hit.id)}
              popular={svcPopular.map(i => ({ id: i.id, name: i.name, icon: serviceGlyph(i.icon) }))}
              popularHue={entityHue('item')}
              popularLabel="Ordered most often"
              onPopular={openService}
            />
            <ServiceCategoriesScreen
              categories={svcCategories}
              items={svcItems}
              onPick={setSvcCat}
            />
          </>
        ) : (
          <>
            <TrailBar
              crumbs={[{ id: 'root', name: DOOR.services.label }, { id: svcCategory.id, name: svcCategory.name }]}
              onNavigate={(crumb, i) => { if (i === 0) setSvcCat(null); }}
              onBack={() => setSvcCat(null)}
              query={query}
              onQuery={setQuery}
              results={results}
              placeholder={DOOR.services.search}
              onAtom={(hit) => openLeaf(hit.leaf, [{ type: 'atom', id: hit.id }])}
              onThing={(hit) => openService(hit.id)}
            />
            <ServiceItemsScreen
              category={svcCategory}
              items={svcInCategory}
              policies={s.approvalPolicies || []}
              onPick={openService}
            />
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
          lesson ? (
            <>
              <TrailBar
                crumbs={[{ id: 'a', name: 'Academy' }, { id: 'c', name: course?.title || 'Course' }, { id: 'l', name: lesson.title }]}
                onNavigate={(crumb, i) => { setLessonId(null); if (i === 0) setCourseId(null); }}
                onBack={() => setLessonId(null)}
              />
              <ReadingScreen
                atom={lesson}
                alsoIn={alsoTaughtIn}
                fromCourse={course}
                onCourseBack={() => setLessonId(null)}
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
                onLesson={setLessonId}
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
          onHelp={() => { setTab('help'); setPath([]); closeLeaf(); }}
          onServices={() => { setTab('services'); setSvcCat(null); closeLeaf(); }}
          onRequests={() => { setTab('requests'); closeLeaf(); }}
          onAcademy={() => { setTab('academy'); closeLeaf(); }}
          onWhy={() => setWhyOpen(true)}
        />
      </div>

      {/* THE CONTAINED CARD. Everything that used to navigate the page away
          happens in here, over a browse page that never moved. */}
      {leaf && (leafHelp || leafService) && (
        <LeafCard
          accent={cardAccent}
          eyebrow={cardEyebrow}
          title={cardTitle}
          subtitle={cardSubtitle}
          wide={frameKind === 'atom' && frameAtom?.format === 'guide'}
          levelKey={`${leaf.kind}:${leaf.id}:${stack.length}:${frame?.id || frameKind}`}
          onClose={closeLeaf}
          footer={
            <LeafFooter
              frame={frame}
              kind={leaf.kind}
              onBack={leafBack}
              onClose={closeLeaf}
              backLabel={stack.length ? 'Back' : 'Back to browse'}
              primary={
                frameKind === 'form' ? { label: frameIntake?.submitLabel || 'Submit request', icon: Send, onClick: submit }
                : frameKind === 'item' && leaf.kind === 'service' && leafForms[0]
                  ? { label: 'Request this', icon: ShoppingCart, onClick: () => openIntakeFrame(leafForms[0].id) }
                : frameKind === 'item' && leaf.kind === 'help' && leafForms.length === 1
                  ? { label: leafForms[0].submitLabel || 'Raise a request', icon: ArrowRight, onClick: () => openIntakeFrame(leafForms[0].id) }
                : null
              }
              onRequests={() => { closeLeaf(); setTab('requests'); }}
              ticketId={frame?.receipt?.ticketId}
            />
          }
        >
          {frameKind === 'atom' && frameAtom ? (
            <LeafReading
              atom={frameAtom}
              alsoIn={alsoTaughtIn}
              canAskForHelp={leafForms.length > 0}
              onYes={() => onArticleYes(frameAtom.id)}
              onNo={onArticleNo}
            />
          ) : frameKind === 'form' && frameIntake ? (
            <LeafIntake
              subform={frameIntake}
              answers={answers}
              touched={touched}
              queue={svcQueue || (frameIntake.routing?.queueId ? byQueue.get(frameIntake.routing.queueId) : null)}
              defaultQueue={defaultQueue}
              policy={svcPolicy || (s.approvalPolicies || []).find(p => p.id === frameIntake.approvalPolicyId) || null}
              declaredApproval={!!svcPolicy}
              people={external ? (s.contacts || []) : (s.directory || [])}
              assets={s.assets || []}
              requesterId={requester?.id}
              onChange={(id, v) => setAnswers(a => ({ ...a, [id]: v }))}
            />
          ) : frameKind === 'receipt' ? (
            <LeafReceipt
              receipt={frame.receipt}
              queue={frame.receipt.queueId ? byQueue.get(frame.receipt.queueId) : null}
              approval={(s.approvals || []).find(a => a.id === frame.receipt.approvalId) || null}
              directory={s.directory || []}
            />
          ) : frameKind === 'resolved' && frameResolved ? (
            <LeafResolved atom={frameResolved} itemName={leafName} />
          ) : leaf.kind === 'service' && leafService ? (
            <LeafServiceItem
              item={leafService}
              categoryName={leafTrail}
              atoms={leafAtoms}
              subform={leafForms[0] || null}
              queue={svcQueue}
              policy={svcPolicy}
              onAtom={openAtomFrame}
            />
          ) : leafHelp ? (
            <LeafHelpItem
              item={leafHelp.node}
              trailText={leafTrail}
              atoms={leafAtoms}
              forms={leafForms}
              queues={byQueue}
              policies={s.approvalPolicies || []}
              emphasise={emphasise}
              onAtom={openAtomFrame}
              onIntake={openIntakeFrame}
            />
          ) : null}
        </LeafCard>
      )}

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
          <span className="min-w-0 text-left hidden xl:block">
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
            <span className="hidden xl:flex items-center gap-2 pl-2 min-w-0">
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
    <div className="relative hidden lg:block">
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

/**
 * The hero belongs to the active door. Get Help keeps the portal's authored
 * headline; the service catalog asks the ordering question instead, and the
 * search says which of the two it is about to look through.
 */
function PortalHero({
  door, form, external, orgName, query, onQuery, results,
  onAtom, onThing, popular, popularHue, popularLabel, onPopular,
}) {
  const { t, dark } = useTheme();
  const services = door.scope !== 'help';
  const Brand = services ? Store : external ? Building2 : Users;
  const eyebrow = services
    ? `${orgName} service catalog`
    : external ? `${orgName} support` : `${orgName} help centre`;
  const headline = services ? door.headline : (form.headline || form.name || door.headline);
  const sub = services ? door.sub : (form.subhead || form.description || door.sub);

  return (
    <section className="relative">
      <HeroBackdrop />
      <div className={cx('relative text-center', WIDE, 'pt-16 pb-12 sm:pt-20 sm:pb-14')}>
        <span className={cx('inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-semibold uppercase tracking-[0.14em]',
          tint('catalog', dark), t.text)}>
          <Brand size={ICON.sm} />
          {eyebrow}
        </span>

        <h1 className={cx('mt-6 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-balance', t.text)}>
          {headline}
        </h1>

        {sub && (
          <p className={cx('mt-5 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto text-pretty', t.textSecondary)}>
            {sub}
          </p>
        )}

        <div className="mt-9 max-w-2xl mx-auto">
          <PortalSearch
            size="lg"
            value={query}
            onChange={onQuery}
            results={results}
            placeholder={door.search}
            onAtom={onAtom}
            onThing={onThing}
          />
        </div>

        {popular.length > 0 && (
          <div className="mt-8">
            <p className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] mb-3.5', t.textMuted)}>
              {popularLabel}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {popular.map(p => (
                <PopularPill key={p.id} entry={p} hue={popularHue} onOpen={onPopular} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** The compact hero every deeper page opens with, so the language holds. */
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

/** The same head, sized for the inside of the card. */
function LeafSectionHead({ eyebrow, title, hint }) {
  const { t } = useTheme();
  return (
    <div className="mb-3">
      {eyebrow && (
        <p className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] mb-1', t.textMuted)}>{eyebrow}</p>
      )}
      <h3 className={cx('text-lg font-semibold tracking-tight', t.text)}>{title}</h3>
      {hint && <p className={cx('mt-1 text-sm leading-relaxed', t.textSecondary)}>{hint}</p>}
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

function PortalSearch({ size = 'lg', value, onChange, results, placeholder, onAtom, onThing }) {
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
          onThing={onThing}
          onDismiss={() => onChange('')}
        />
      )}
    </div>
  );
}

function SearchSuggestions({ results, onAtom, onThing, onDismiss }) {
  const { t, a } = useTheme();
  /* Ask the registry, don't name the hue: an article is whatever colour knowledge
   * is, and an orderable thing is whatever colour an item is. */
  const atomTone = a(entityHue('article'));
  const itemTone = a(entityHue('item'));
  const empty = !results.atoms.length && !results.things.length;

  return (
    <div className={cx('absolute left-0 right-0 top-full mt-2 z-40 rounded-2xl border shadow-2xl overflow-hidden text-left',
      t.modal, t.borderLight)}>
      {empty ? (
        <div className={cx('px-4 py-5 text-sm text-center', t.textMuted)}>
          Nothing matched here. Try the other tab, or browse the areas below.
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
                <button key={k.id} onClick={() => onAtom(k)}
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
          {results.things.length > 0 && (
            <>
              <div className={cx('px-4 py-2 border-b border-t', t.borderLight)}>
                <GroupLabel>{results.thingLabel}</GroupLabel>
              </div>
              {results.things.map(thing => (
                <SearchThingRow key={thing.id} thing={thing} tone={itemTone} onOpen={onThing} />
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

function SearchThingRow({ thing, tone, onOpen }) {
  const { t } = useTheme();
  const Glyph = thing.icon || Circle;
  return (
    <button onClick={() => onOpen(thing)}
      className={cx('w-full text-left flex items-center gap-3 px-4 py-3', t.bgHover)}>
      <Glyph size={ICON.md} className={cx('flex-shrink-0', tone.fg)} />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm font-medium truncate', t.text)}>{thing.name}</span>
        <span className={cx('block text-xs truncate mt-0.5', t.textMuted)}>{thing.path}</span>
      </span>
      <ChevronRight size={ICON.base} className={cx('flex-shrink-0', t.textMuted)} />
    </button>
  );
}

function PopularPill({ entry, hue, onOpen }) {
  const { t, a } = useTheme();
  const c = a(hue);
  const Glyph = entry.icon || Circle;
  return (
    <button
      onClick={() => onOpen(entry.id)}
      className={cx('group inline-flex items-center gap-3 rounded-full border pl-2 pr-5 py-2 shadow-sm',
        'transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg', t.portalCard)}
    >
      <span className={cx('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', c.softStrong)}>
        <Glyph size={ICON.base} className={c.fg} />
      </span>
      <span className={cx('text-sm font-medium', t.text)}>{entry.name}</span>
      <ArrowRight size={ICON.base}
        className={cx('-ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-0 transition-all', c.fg)} />
    </button>
  );
}

/* ==================================================================== *
 * The trail — back, breadcrumbs and a search that stays within reach.
 * ==================================================================== */

function TrailBar({ crumbs, onNavigate, onBack, query, onQuery, results, placeholder, onAtom, onThing }) {
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
              onThing={onThing}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Browse — Get Help
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
 * Browse — Service Catalog
 *
 * A different shape from the help tree because it answers a different question.
 * Two levels only, and the leaf card carries a price, a delivery time and a
 * sign-off rather than an article and a symptom picker.
 * ==================================================================== */

function ServiceCategoriesScreen({ categories, items, onPick }) {
  return (
    <section className={cx(WIDE, 'pb-16')}>
      <SectionHead
        eyebrow="Browse"
        title="What kind of thing do you need?"
        hint="These are things you can order, not problems to report. Every one of them names its price, how long it takes and whether somebody has to approve it before you commit."
      />
      {categories.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No services published yet"
          hint="The service catalog is empty for your audience. Published service items appear here grouped by category." />
      ) : (
        <div className="flex flex-wrap gap-4 items-stretch">
          {categories.map(cat => (
            <ServiceCategoryCard
              key={cat.id}
              category={cat}
              items={items.filter(i => i.categoryId === cat.id)}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ServiceCategoryCard({ category, items, onPick }) {
  const { t, a } = useTheme();
  /* A category groups orderable things, so it is coloured like the grouping
     level of the other catalog. The registry decides, not this file. */
  const hue = entityHue('product');
  const c = a(hue);
  const Glyph = serviceGlyph(category.icon, Boxes);
  const free = items.filter(i => !Number(i.price)).length;
  const approvals = items.filter(i => i.approvalPolicyId).length;

  return (
    <button
      onClick={() => onPick(category.id)}
      className={cx('group relative text-left rounded-2xl border overflow-hidden p-5 flex flex-col',
        'flex-1 basis-[18rem] min-w-[16rem] shadow-sm',
        'transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl', t.portalCard)}
    >
      <span aria-hidden className={cx('absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity', c.rail)} />
      <span aria-hidden className={cx('absolute inset-0 rounded-2xl border-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity', c.borderStrong)} />

      <span className="flex items-start justify-between gap-3">
        <IconTile icon={Glyph} accent={hue} size="lg" />
        <ChevronRight size={ICON.lg}
          className={cx('mt-2 flex-shrink-0 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all', c.fg)} />
      </span>

      <span className={cx('mt-4 block text-base font-semibold leading-snug text-balance', t.text)}>{category.name}</span>
      <span className={cx('mt-2 block text-sm leading-relaxed line-clamp-2 min-h-[2.75rem]', t.textSecondary)}>
        {category.description}
      </span>

      <span className={cx('mt-auto pt-4 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs border-t', t.textMuted, t.border)}>
        <span className="flex items-center gap-1.5">
          <Package size={ICON.xs} />{plural(items.length, 'service', 'services')}
        </span>
        {free > 0 && (
          <span className="flex items-center gap-1.5"><DollarSign size={ICON.xs} />{free} at no charge</span>
        )}
        {approvals > 0 && (
          <span className="flex items-center gap-1.5"><Stamp size={ICON.xs} />{approvals} need sign-off</span>
        )}
      </span>
    </button>
  );
}

function ServiceItemsScreen({ category, items, policies, onPick }) {
  const Glyph = serviceGlyph(category.icon, Boxes);
  return (
    <>
      <PageBand
        icon={Glyph}
        hue={entityHue('product')}
        eyebrow="Step 2 of 2"
        title={category.name}
        sub={category.description}
      />
      <section className={cx(WIDE, 'pb-16')}>
        <SectionHead
          title="Choose what to order"
          hint="Prices and delivery times are the real ones attached to the item, and anything that needs a sign-off says so here rather than after you have filled the form in."
        />
        {items.length === 0 ? (
          <EmptyState icon={Package} title="Nothing published in this category"
            hint="Service items appear here once they are published to your audience." />
        ) : (
          <div className="flex flex-wrap gap-4 items-stretch">
            {items.map(item => (
              <ServiceItemCard
                key={item.id}
                item={item}
                policy={policies.find(p => p.id === item.approvalPolicyId) || null}
                onPick={onPick}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function ServiceItemCard({ item, policy, onPick }) {
  const { t, a } = useTheme();
  const hue = entityHue('item');
  const c = a(hue);
  const Glyph = serviceGlyph(item.icon);
  const price = fmtMoney(item.price) || 'No charge';
  const recurring = fmtRecurring(item);
  const delivery = fmtDelivery(item.deliveryDays);

  return (
    <button
      onClick={() => onPick(item.id)}
      className={cx('group relative text-left rounded-2xl border overflow-hidden p-5 flex flex-col',
        'flex-1 basis-[20rem] min-w-[17rem] shadow-sm',
        'transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl', t.portalCard)}
    >
      <span aria-hidden className={cx('absolute inset-x-0 top-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity', c.rail)} />
      <span aria-hidden className={cx('absolute inset-0 rounded-2xl border-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity', c.borderStrong)} />

      <span className="flex items-start justify-between gap-3">
        <IconTile icon={Glyph} accent={hue} size="lg" />
        <span className="flex items-center gap-1.5 flex-wrap justify-end">
          {item.popular && <Chip accent="amber" icon={Sparkles}>Popular</Chip>}
          {/* The chip carries the fact, not a count — and it appears BEFORE the
              form, so nobody fills one in to discover it needs their director. */}
          {item.approvalPolicyId && (
            <Chip accent={entityHue('approval')} icon={Stamp} title={policy?.name || undefined}>Approval required</Chip>
          )}
        </span>
      </span>

      <span className={cx('mt-4 block text-base font-semibold leading-snug text-balance', t.text)}>{item.name}</span>
      <span className={cx('mt-2 block text-sm leading-relaxed line-clamp-2 min-h-[2.75rem]', t.textSecondary)}>
        {item.shortDescription}
      </span>

      <span className={cx('mt-auto pt-4 flex items-center gap-x-4 gap-y-1 flex-wrap text-xs border-t', t.textMuted, t.border)}>
        <span className={cx('flex items-center gap-1.5 font-semibold', c.fg)}>
          <DollarSign size={ICON.xs} />{price}
        </span>
        {recurring && <span className="flex items-center gap-1.5">then {recurring}</span>}
        {delivery && <span className="flex items-center gap-1.5"><Truck size={ICON.xs} />{delivery}</span>}
      </span>
    </button>
  );
}

/* ==================================================================== *
 * THE CONTAINED CARD
 *
 * v1's shape, in the new language: a fixed, blurred overlay; a centred card with
 * a pinned header (close left, title optically centred, spacer right), a
 * scrolling body whose reading column stays near 70 characters inside the wider
 * card, and a pinned footer carrying Back and the one primary action.
 *
 * It composes rather than reuses <Modal> for two reasons — the header is the v1
 * arrangement rather than the admin one, and the guide viewer wants the full
 * width of the card while prose does not. The dialog contract is the DS shell's,
 * implemented by useDialogShell: Escape closes, Tab is trapped, background
 * scroll is locked, focus returns to the opener.
 * ==================================================================== */

function LeafCard({ accent, eyebrow, title, subtitle, wide, levelKey, onClose, footer, children }) {
  const { t, a } = useTheme();
  const c = a(accent);
  const shell = useDialogShell(true, onClose, levelKey);

  return createPortal(
    <div
      /* Clicking the backdrop dismisses, the way every modal in the app does.
         Guarded on the target so a drag that ends outside the card does not. */
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className={cx('fixed inset-0 flex items-center justify-center p-4 backdrop-blur-sm overscroll-contain',
        t.overlay, LAYOUT.zModal)}
    >
      <div
        ref={shell.ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cx('w-full max-w-4xl h-full max-h-[90vh] rounded-3xl border-2 shadow-2xl',
          'flex flex-col overflow-hidden outline-none', t.modal, c.borderStrong)}
      >
        {/* PINNED HEADER. The close control sits left and a spacer of equal width
            sits right, so the title is optically centred rather than merely
            centred in whatever space is left over. */}
        <header className={cx(DENSITY.modalHeaderPad, 'flex-shrink-0 border-b flex items-center gap-3',
          t.border, c.soft)}>
          <span className="w-20 flex-shrink-0 flex justify-start">
            <IconButton icon={X} label="Close" onClick={onClose} />
          </span>
          <span className="min-w-0 flex-1 text-center">
            {eyebrow && (
              <span className={cx('block text-[11px] font-semibold uppercase tracking-[0.14em]', t.textMuted)}>
                {eyebrow}
              </span>
            )}
            <h2 className={cx('text-base sm:text-lg font-semibold leading-tight truncate', t.text)}>{title}</h2>
            {subtitle && <span className={cx('block text-xs truncate mt-0.5', t.textMuted)}>{subtitle}</span>}
          </span>
          <span aria-hidden className="w-20 flex-shrink-0" />
        </header>

        <div ref={shell.bodyRef}
          className={cx('flex-1 min-h-0 overflow-auto overscroll-contain', DENSITY.modalBodyPad)}>
          <div className={cx('mx-auto w-full', wide ? 'max-w-3xl' : 'max-w-2xl')}>
            {children}
          </div>
        </div>

        {footer && (
          <footer className={cx(DENSITY.modalFooterPad, 'flex-shrink-0 border-t flex items-center justify-between gap-3 flex-wrap',
            t.border)}>
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The footer is contextual, but its grammar never changes: a way back on the
 * left, the ONE primary action on the right. The gradient lives on that primary
 * action and nowhere else inside the card.
 */
function LeafFooter({ frame, kind, onBack, onClose, backLabel, primary, onRequests, ticketId }) {
  const { t } = useTheme();

  if (frame?.type === 'receipt') {
    return (
      <>
        <Button variant="ghost" icon={Inbox} onClick={onRequests}>See my requests</Button>
        <div className="flex items-center gap-2">
          <Button variant="soft" accent="teal" icon={ArrowRight}
            onClick={() => navigate('workspace', 'tickets', ticketId)}>
            Open it in the agent workspace
          </Button>
          <Button variant="grad" module="portal" onClick={onClose}>Done</Button>
        </div>
      </>
    );
  }

  if (frame?.type === 'resolved') {
    return (
      <>
        <Button variant="outline" icon={ArrowLeft} onClick={onBack}>Back</Button>
        <Button variant="grad" module="portal" onClick={onClose}>Done</Button>
      </>
    );
  }

  return (
    <>
      <Button variant="outline" icon={ArrowLeft} onClick={onBack}>{backLabel}</Button>
      {primary ? (
        <Button variant="grad" module="portal" size="lg" icon={primary.icon} onClick={primary.onClick}>
          {primary.label}
        </Button>
      ) : (
        <span className={cx('text-xs', t.textMuted)}>
          {kind === 'service'
            ? 'This service has no request form attached yet.'
            : 'Nothing here submits until you choose a form.'}
        </span>
      )}
    </>
  );
}

/* ==================================================================== *
 * Level 1 — the item, help above forms
 * ==================================================================== */

function LeafHelpItem({ item, trailText, atoms, forms, queues, policies, emphasise, onAtom, onIntake }) {
  const { t } = useTheme();

  return (
    <div className="space-y-7">
      <div>
        {trailText && (
          <p className={cx('text-xs', t.textMuted)}>{trailText}</p>
        )}
        {item.description && (
          <p className={cx('mt-2 text-[15px] leading-relaxed', t.textSecondary)}>{item.description}</p>
        )}
        {(item.popular || item.fulfillment) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {item.popular && <Chip accent="amber" icon={Sparkles}>Most requested</Chip>}
            {item.fulfillment && <Chip accent="slate" icon={Clock}>{item.fulfillment}</Chip>}
          </div>
        )}
      </div>

      {/* HELP FIRST. This ordering is the deflection mechanic: the answers are
          rendered above the intakes on every item, every time, and nothing in
          the portal can reorder it. Do not move the forms block above this. */}
      {atoms.length > 0 && (
        <section>
          <LeafSectionHead
            eyebrow="Answers first"
            title="Try these before you raise anything"
            hint={`${plural(atoms.length, 'article covers', 'articles cover')} the usual version of this. Most people stop here.`}
          />
          <div className={DENSITY.rowGap}>
            {atoms.map(k => <LeafAtomRow key={k.id} atom={k} onOpen={() => onAtom(k.id)} />)}
          </div>
        </section>
      )}

      {forms.length > 0 ? (
        <section>
          <LeafSectionHead
            eyebrow="Still stuck?"
            title={forms.length > 1 ? 'Tell us what you need' : 'Raise a request'}
            hint={forms.length > 1
              ? `${plural(forms.length, 'intake hangs', 'intakes hang')} off this one service. They ask different questions and go to different teams.`
              : 'If none of the above answered it, this goes straight to the team that owns it.'}
          />
          {emphasise && (
            <Banner accent="rose" icon={MessageSquare} title="No problem — let's get a person on it" className="mb-3">
              Pick the intake that fits. Everything you have already read is attached to the request, so nobody asks
              you to try it again.
            </Banner>
          )}
          <div className={DENSITY.rowGap}>
            {forms.map(f => (
              <LeafIntakeRow
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
          Close this and pick a service with an intake on it if you still need a person.
        </Banner>
      )}
    </div>
  );
}

function LeafAtomRow({ atom, onOpen }) {
  const { t, a } = useTheme();
  const guide = atom.format === 'guide';
  const hue = entityHue(guide ? 'guide' : 'article');
  const c = a(hue);
  const Glyph = guide ? LayoutGrid : BookOpen;
  const slides = (atom.slides || []).length;

  return (
    <button
      onClick={onOpen}
      className={cx('group w-full text-left rounded-xl border flex items-start gap-3 shadow-sm',
        'transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg', DENSITY.rowPad, t.portalCard)}
    >
      <IconTile icon={Glyph} accent={hue} size="sm" className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm font-medium leading-snug', t.text)}>{atom.title}</span>
        <span className={cx('block text-xs mt-0.5 line-clamp-2', t.textMuted)}>{atom.summary}</span>
        <span className={cx('mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px]', t.textMuted)}>
          {guide && slides > 0 && (
            <span className="flex items-center gap-1"><LayoutGrid size={ICON.xs} />{plural(slides, 'screen', 'screens')}</span>
          )}
          {atom.minutes ? <span className="flex items-center gap-1"><Clock size={ICON.xs} />{atom.minutes} min</span> : null}
          {atom.helpfulYes ? (
            <span className={cx('flex items-center gap-1', c.fg)}>
              <ThumbsUp size={ICON.xs} />{atom.helpfulYes.toLocaleString()} found this helpful
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex items-center gap-2 flex-shrink-0">
        <EntityTag kind={guide ? 'guide' : 'article'} />
        <ChevronRight size={ICON.md} className={cx('opacity-0 group-hover:opacity-100 transition-opacity', c.fg)} />
      </span>
    </button>
  );
}

function LeafIntakeRow({ subform, queue, policy, emphasise, onStart }) {
  const { t, a } = useTheme();
  const c = a(entityHue('subform'));
  const fields = (subform.fields || []).length;
  const conditional = (subform.fields || []).filter(f => f.showIf).length;

  return (
    <div className={cx('rounded-xl border shadow-sm flex items-start gap-3', DENSITY.rowPad,
      t.portalCard, emphasise && c.borderStrong)}>
      <IconTile icon={FileQuestion} accent={entityHue('subform')} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm font-medium leading-snug', t.text)}>{subform.name}</p>
        {subform.description && (
          <p className={cx('text-xs mt-0.5 leading-relaxed', t.textSecondary)}>{subform.description}</p>
        )}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {queue
            ? <Chip accent={queue.hue || entityHue('queue')} icon={Inbox} title={queue.description}>{queue.name}</Chip>
            : <Chip accent="amber" icon={Route}>Unrouted → General</Chip>}
          {policy && <Chip accent={entityHue('approval')} icon={Stamp} title={policy.description}>{policy.name}</Chip>}
          <span className={cx('text-[11px]', t.textMuted)}>
            {plural(fields, 'question', 'questions')}{conditional ? ` · ${conditional} conditional` : ''}
          </span>
        </div>
      </div>
      {/* SOLID, not the signature gradient. An item can carry several intakes and
          a gradient on each one turns the brand moment into wallpaper — the
          gradient belongs to the single primary action in the card footer. */}
      <Button variant="solid" accent={entityHue('subform')} size="sm" iconRight={ArrowRight}
        onClick={onStart} className="flex-shrink-0 mt-0.5">
        {subform.submitLabel || 'Start'}
      </Button>
    </div>
  );
}

/* ==================================================================== *
 * Level 1 — the service item
 *
 * Same card, different question. An orderable thing has to say what it costs,
 * when it turns up and who signs it off BEFORE the form, which is the service
 * catalog's version of putting the answer above the intake.
 * ==================================================================== */

function LeafServiceItem({ item, categoryName, atoms, subform, queue, policy, onAtom }) {
  const { t } = useTheme();
  const price = fmtMoney(item.price) || 'No charge';
  const recurring = fmtRecurring(item);
  const delivery = fmtDelivery(item.deliveryDays);
  const fields = (subform?.fields || []).length;
  const conditional = (subform?.fields || []).filter(f => f.showIf).length;

  return (
    <div className="space-y-7">
      <div>
        {categoryName && <p className={cx('text-xs', t.textMuted)}>{categoryName}</p>}
        <p className={cx('mt-2 text-[15px] leading-relaxed', t.textSecondary)}>
          {item.description || item.shortDescription}
        </p>
      </div>

      {/* The commercial facts, before anything is filled in. */}
      <div className={cx('rounded-2xl border p-4 grid gap-3 sm:grid-cols-2', t.portalCard)}>
        <ServiceFact icon={DollarSign} hue={entityHue('item')} label="Cost" value={price}
          note={recurring ? `then ${recurring}` : undefined} />
        <ServiceFact icon={Truck} hue={entityHue('item')} label="Delivery" value={delivery || 'Timing agreed after you order'} />
        <ServiceFact
          icon={Stamp}
          hue={entityHue('approval')}
          label="Approval"
          value={policy ? policy.name : item.approvalPolicyId ? 'Approval required' : 'No approval needed'}
          note={policy?.description}
        />
        <ServiceFact icon={Inbox} hue={entityHue('queue')} label="Fulfilled by"
          value={queue?.name || 'Triaged from the general queue'} note={queue?.description} />
      </div>

      {/* KNOWLEDGE STILL COMES FIRST. On this side of the portal it is not
          deflection — it is the reading that stops somebody ordering the wrong
          size, the wrong licence or a thing they already have. */}
      {atoms.length > 0 && (
        <section>
          <LeafSectionHead
            eyebrow="Before you order"
            title="Worth reading first"
            hint="The same published articles the help centre serves — attached here so nobody orders blind."
          />
          <div className={DENSITY.rowGap}>
            {atoms.map(k => <LeafAtomRow key={k.id} atom={k} onOpen={() => onAtom(k.id)} />)}
          </div>
        </section>
      )}

      {subform ? (
        <section>
          <LeafSectionHead
            eyebrow="The request"
            title={subform.name}
            hint={subform.description}
          />
          <div className={cx('rounded-xl border flex items-center gap-3', DENSITY.rowPad, t.portalCard)}>
            <IconTile icon={FileQuestion} accent={entityHue('subform')} size="sm" />
            <p className={cx('text-xs flex-1 min-w-0', t.textSecondary)}>
              {plural(fields, 'question', 'questions')}
              {conditional ? `, ${conditional} of which only appear when your answers call for them` : ''}.
              {' '}Everything you enter travels with the request — nobody asks for it twice.
            </p>
          </div>
        </section>
      ) : (
        <Banner accent="amber" icon={CircleAlert} title="No request form attached">
          This service item names no intake, so there is nothing to submit yet. It is visible here because it is
          published — RelayHQ shows the gap rather than hiding the item.
        </Banner>
      )}

      {item.assetModelId && (
        <Banner accent="cyan" icon={Laptop} title="Ordering this provisions a real asset">
          Fulfilment creates an asset record against your name, so the thing you were given and the request that asked
          for it stay attached to each other.
        </Banner>
      )}
    </div>
  );
}

function ServiceFact({ icon: Glyph, hue, label, value, note }) {
  const { t, a } = useTheme();
  const c = a(hue);
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <Glyph size={ICON.md} className={cx('flex-shrink-0 mt-0.5', c.fg)} />
      <div className="min-w-0">
        <p className={cx('text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>{label}</p>
        <p className={cx('text-sm font-medium leading-snug', t.text)}>{value}</p>
        {note && <p className={cx('text-[11px] mt-0.5 leading-relaxed', t.textMuted)}>{note}</p>}
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Level 2 — reading, inside the card
 * ==================================================================== */

function LeafReading({ atom, alsoIn, canAskForHelp, onYes, onNo }) {
  const { t } = useTheme();
  const guide = atom.format === 'guide';

  return (
    <div className="space-y-5">
      <div>
        <p className={cx('text-[15px] leading-relaxed', t.textSecondary)}>{atom.summary}</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {atom.minutes ? <Chip accent="slate" icon={Clock}>{atom.minutes} min</Chip> : null}
          {atom.views ? <Chip accent="slate" icon={Eye}>{atom.views.toLocaleString()} views</Chip> : null}
          {atom.updatedAt && <span className={cx('text-xs', t.textMuted)}>Updated {fmtWhen(atom.updatedAt)}</span>}
        </div>
      </div>

      {atom.objective && (
        <Banner accent="blue" icon={Check} title="What you will be able to do">
          {atom.objective}
        </Banner>
      )}

      {guide ? <GuideBody atom={atom} /> : <ArticleBody atom={atom} />}

      {alsoIn.length > 0 && (
        <div className={cx('rounded-2xl border p-4 flex items-center gap-3 flex-wrap', t.portalCard)}>
          <span className="flex items-center gap-2.5">
            <IconTile icon={GraduationCap} accent={entityHue('curriculum')} size="sm" />
            <span className={cx('text-sm', t.textSecondary)}>This same article is a lesson in</span>
          </span>
          <ChipGroup accent={entityHue('curriculum')} icon={BookMarked} max={3} items={alsoIn} render={(c) => c.title} />
        </div>
      )}

      <ResolvePrompt canAskForHelp={canAskForHelp} onYes={onYes} onNo={onNo} />
    </div>
  );
}

/** The academy still reads a lesson as a page — it is a course, not a leaf. */
function ReadingScreen({ atom, alsoIn, fromCourse, onCourseBack }) {
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
              <IconTile icon={GraduationCap} accent={entityHue('curriculum')} size="sm" />
              <span className={cx('text-sm', t.textSecondary)}>This same article is a lesson in</span>
            </span>
            <ChipGroup accent={entityHue('curriculum')} icon={BookMarked} max={3} items={alsoIn} render={(c) => c.title} />
          </div>
        )}

        {fromCourse && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className={cx('text-sm', t.textMuted)}>
              Lesson from <strong className={t.text}>{fromCourse.title}</strong>
            </span>
            <Button variant="soft" accent={entityHue('course')} icon={ArrowLeft} onClick={onCourseBack}>
              Back to the course
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function ArticleBody({ atom }) {
  const { t } = useTheme();
  return (
    <div className={cx('rounded-2xl border p-5 sm:p-7', t.portalCard)}>
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
          accent={entityHue('guide')}
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
          <div className="grid gap-6 items-start" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))' }}>
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
  const c = a(entityHue('guide'));
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
    <div className={cx('rounded-2xl border p-5 sm:p-6', t.portalCard)}>
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
  const c = a(entityHue('guide'));
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
            <IconTile icon={Video} accent={entityHue('guide')} size="lg" />
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

function ResolvePrompt({ canAskForHelp, onYes, onNo }) {
  const { t } = useTheme();
  return (
    <div className={cx('rounded-2xl border p-5 flex items-center justify-between gap-4 flex-wrap', t.portalCard)}>
      <div className="min-w-0">
        <p className={cx('text-base font-semibold', t.text)}>Did this resolve your issue?</p>
        <p className={cx('text-sm mt-1', t.textSecondary)}>
          {canAskForHelp
            ? 'If not, we will take you straight back to the request forms for this service.'
            : 'Telling us either way is what keeps this article honest.'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="solid" accent={statusMeta('resolved').hue} icon={ThumbsUp} onClick={onYes}>Yes, all done</Button>
        <Button variant="soft" accent={entityHue('ticket')} icon={ThumbsDown} onClick={onNo}>No, I need help</Button>
      </div>
    </div>
  );
}

function LeafResolved({ atom, itemName }) {
  const { t, a } = useTheme();
  const c = a(statusMeta('resolved').hue);
  return (
    <div className="py-6 text-center">
      <span className={cx('inline-flex w-16 h-16 rounded-full items-center justify-center mb-5', c.softStrong)}>
        <CircleCheck size={32} className={c.fg} />
      </span>
      <h3 className={cx('text-2xl font-semibold tracking-tight', t.text)}>Glad that sorted it.</h3>
      <p className={cx('text-base mt-3 leading-relaxed', t.textSecondary)}>
        You did not need to raise a request, and nobody had to answer one. That is the whole point of putting
        <strong className={t.text}> {atom.title}</strong> in front of the form instead of behind it.
      </p>
      {atom.helpfulYes ? (
        <p className={cx('text-sm mt-4', t.textMuted)}>
          {atom.helpfulYes.toLocaleString()} other people have marked this article helpful.
        </p>
      ) : null}
      {itemName && (
        <p className={cx('text-xs mt-6', t.textMuted)}>
          Back takes you to {itemName}; Done closes this and leaves you exactly where you were browsing.
        </p>
      )}
    </div>
  );
}

/* ==================================================================== *
 * Level 3 — the request form, with conditional fields actually evaluating.
 *
 * There is no <form> element here on purpose: a stray submit navigates the page
 * away, and on GitHub Pages that means a blank screen. Submission is the card's
 * footer action.
 * ==================================================================== */

function LeafIntake({
  subform, answers, touched, queue, defaultQueue, policy, declaredApproval,
  people, assets, requesterId, onChange,
}) {
  const { t } = useTheme();
  const shown = visibleFields(subform, answers);
  const hidden = (subform.fields || []).length - shown.length;
  const missing = shown.filter(f => f.required && isEmptyAnswer(answers[f.id]));

  return (
    <div className="space-y-4">
      {queue ? (
        <Banner accent="blue" icon={Route} title={`This goes to ${queue.name}`}>
          {queue.description || 'Routed by the request form, not by keyword guessing.'}
          {policy && (declaredApproval
            ? <> This service requires the <strong className={t.text}>{policy.name}</strong> policy, so an approval starts the moment you submit.</>
            : <> Because this intake carries the <strong className={t.text}>{policy.name}</strong> policy, an approval may start the moment you submit.</>)}
        </Banner>
      ) : (
        <Banner accent="amber" icon={CircleAlert} title="No routing configured on this form">
          Requests from here land in the <strong className={t.text}>{defaultQueue?.name || 'General'}</strong> queue and are
          triaged from there. Nothing is ever silently parked.
        </Banner>
      )}

      <div className={cx('rounded-2xl border p-5 space-y-5 shadow-sm', t.portalCard)}>
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

      <p className={cx('text-xs', t.textMuted)}>
        {touched && missing.length
          ? `Still needed: ${missing.map(f => f.label).join(', ')}`
          : `${plural(shown.length, 'question', 'questions')} · ${shown.filter(f => f.required).length} required`}
      </p>
    </div>
  );
}

function IntakeField({ field, value, error, people, assets, requesterId, onChange }) {
  const { t } = useTheme();
  const common = { accent: entityHue('subform') };

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
  const c = a(entityHue('subform'));
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
 * Level 4 — the receipt. Proof the submission really landed, and — the part
 * that makes an order different from a help request — who it now waits on.
 * ==================================================================== */

function LeafReceipt({ receipt, queue, approval, directory }) {
  const { t, a } = useTheme();
  const c = a(statusMeta('resolved').hue);
  const prog = approval ? progress(approval) : null;
  const stage = approval?.stages?.[approval.currentStage] || null;
  const approverNames = (stage?.approverIds || [])
    .map(id => (directory.find(p => p.id === id) || {}).name)
    .filter(Boolean);
  /* The sentence has to survive one approver and five, unanimous and
   * first-response — so the clause is chosen, not concatenated. */
  const clearance = approverNames.length === 1 ? 'they approve it'
    : stage?.rule === 'any' ? 'one of them approves it'
    : stage?.rule === 'quorum' ? `${prog?.need || 1} of them approve it`
    : 'all of them approve it';

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <span className={cx('inline-flex w-16 h-16 rounded-full items-center justify-center mb-4', c.softStrong)}>
          <CircleCheck size={32} className={c.fg} />
        </span>
        <h3 className={cx('text-2xl font-semibold tracking-tight', t.text)}>We have it.</h3>
        <p className={cx('text-base mt-3 leading-relaxed', t.textSecondary)}>
          {receipt.confirmation
            || (receipt.serviceName
              ? `Your order for ${receipt.serviceName} has been logged and is on its way to the team that fulfils it.`
              : 'Your request has been logged and is on its way to the right team.')}
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
          {receipt.serviceName
            ? <>The service item named its own fulfilment queue — {queue?.description || 'no keyword guessing involved'}.</>
            : <>The request form decided the destination — {queue?.description || 'no keyword guessing involved'}.</>}
        </Banner>
      )}

      {approval && (
        <Banner accent={entityHue('approval')} icon={Stamp} title={`Waiting on approval · ${receipt.policyName}`}>
          {approverNames.length > 0 ? (
            <span className="flex items-center gap-1.5 flex-wrap">
              Sign-off sits with
              <ChipGroup accent={entityHue('approval')} icon={User} max={3} items={approverNames} />
              <span>
                — {receipt.serviceName ? 'nothing is ordered' : 'nothing moves'} until {clearance}.
                {' '}Stage {prog.stageNumber} of {prog.totalStages}, {prog.approvals} of {prog.need} approved.
              </span>
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

      {receipt.delivery && (
        <Banner accent={entityHue('item')} icon={Truck} title={receipt.delivery}>
          That is the published lead time on the item{receipt.price && receipt.price !== 'No charge'
            ? <>, and the {receipt.price} is charged to your cost centre on fulfilment</>
            : ', charged to nobody because this one is free'}.
          {approval && ' The clock starts when the approval clears, not when you pressed submit.'}
        </Banner>
      )}
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
          ? `Everything ${requester.name} has raised through this portal — problems reported and services ordered — with the team working it and their replies.`
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
  const hue = muted ? 'slate' : entityHue('ticket');
  const c = a(hue);
  return (
    <button
      onClick={onOpen}
      className={cx('group w-full text-left rounded-xl border flex items-center gap-3 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        DENSITY.rowPad, t.portalCard)}
    >
      <IconTile icon={ticket.serviceItemId ? ShoppingCart : Inbox} accent={hue} size="sm" />
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
      accent={entityHue('ticket')}
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
                accent={entityHue('curriculum')}
                title={cur.name}
                subtitle={cur.certificateName ? `Certificate: ${cur.certificateName}` : undefined}
                action={cur.targetDays ? <Chip accent={entityHue('curriculum')} icon={Clock}>{cur.targetDays} days</Chip> : null}
              >
                <div className="p-5 space-y-3">
                  <p className={cx('text-sm leading-relaxed', t.textSecondary)}>{cur.summary}</p>
                  <ChipGroup
                    accent={entityHue('course')}
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
  const c = a(entityHue('course'));
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
        <IconTile icon={BookMarked} accent={entityHue('course')} size="lg" />
        {course.certificate && <Chip accent={entityHue('certificate')} icon={Award}>Certificate</Chip>}
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
          {course.certificate && <Chip accent={entityHue('certificate')} icon={Award}>{course.certificateName || 'Certificate'}</Chip>}
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

function PortalFooter({
  form, orgName, external, requester, hasAcademy,
  onHelp, onServices, onRequests, onAcademy, onWhy,
}) {
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
            {form.description || 'One place to find an answer, one place to order what you need, and a person to ask when neither fits.'}
          </p>
        </div>

        <nav aria-label="Portal">
          <p className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] mb-3', t.textMuted)}>This portal</p>
          <ul className="space-y-2.5">
            <li>
              <button onClick={onHelp} className={cx('text-sm hover:underline', t.textSecondary)}>Get help</button>
            </li>
            <li>
              <button onClick={onServices} className={cx('text-sm hover:underline', t.textSecondary)}>Service catalog</button>
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
  const services = (s.serviceItems || []).filter(i => i.status !== 'draft');
  const serviceCategories = s.serviceCategories || [];

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

  /* The service catalog answers a different question, so it is counted
   * separately rather than folded into the help numbers above. */
  const servicesFree = services.filter(i => !Number(i.price));
  const servicesApproved = services.filter(i => i.approvalPolicyId);
  const servicesWithHelp = services.filter(i => (i.knowledgeIds || []).length);
  const serviceSubformIds = new Set(services.map(i => i.subformId).filter(Boolean));

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
    services: services.length,
    serviceCategories: serviceCategories.length,
    servicesFree: servicesFree.length,
    servicesApproved: servicesApproved.length,
    servicesWithHelp: servicesWithHelp.length,
    serviceSubforms: serviceSubformIds.size,
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
        <WhyDoors facts={facts} />
        <Divider />
        <WhyCompare facts={facts} subforms={subforms} queues={queues} defaultQueue={defaultQueue} />
        <Divider />
        <WhyNumbers facts={facts} />
        <Divider />
        <WhyDiagram facts={facts} />
      </div>
    </Modal>
  );
}

function WhyDoors({ facts }) {
  const { t, a } = useTheme();
  const help = a(DOOR.help.hue);
  const svc = a(DOOR.services.hue);

  return (
    <section>
      <SectionHead
        title="Two front doors, because they are two questions"
        hint="“Cannot sign in” and “Request a new laptop” look alike in a tree and behave nothing alike. One wants an answer; the other wants an outcome with a cost and a sign-off."
        className="mb-4"
      />
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))' }}>
        <Card className={DENSITY.cardPad}>
          <div className="flex items-center gap-2.5 mb-2">
            <IconTile icon={LifeBuoy} accent={DOOR.help.hue} size="sm" />
            <p className={cx('text-sm font-semibold', t.text)}>Get Help — “something is wrong”</p>
          </div>
          <p className={cx('text-xs leading-relaxed', t.textSecondary)}>
            {facts.products} products › {facts.subcategories} subcategories › {facts.items} items, where an item carries
            knowledge first and a report-a-problem form second. {facts.helpBeforeForm} of those items put an answer in
            front of a form.
          </p>
          <p className={cx('text-[11px] mt-2', help.fg)}>Success here is a request that never had to exist.</p>
        </Card>

        <Card className={DENSITY.cardPad}>
          <div className="flex items-center gap-2.5 mb-2">
            <IconTile icon={Store} accent={DOOR.services.hue} size="sm" />
            <p className={cx('text-sm font-semibold', t.text)}>Service Catalog — “I want something”</p>
          </div>
          <p className={cx('text-xs leading-relaxed', t.textSecondary)}>
            {facts.serviceCategories
              ? <>{facts.serviceCategories} categories holding {facts.services} orderable services, each with a price, a
                lead time, a fulfilment queue and — for {facts.servicesApproved} of them — a named approval that runs
                before anybody spends anything.</>
              : <>No service items are published yet. When they are, they appear here with a price, a lead time and an
                approval rather than as more rows in the help tree.</>}
          </p>
          <p className={cx('text-[11px] mt-2', svc.fg)}>Success here is an order nobody had to chase.</p>
        </Card>
      </div>
      {facts.serviceSubforms > 0 && (
        <p className={cx('text-xs mt-3 leading-relaxed', t.textSecondary)}>
          The two doors share one form model: {plural(facts.serviceSubforms, 'service intake is', 'service intakes are')} an
          ordinary subform — same builder, same conditional fields, same routing — and {facts.servicesWithHelp} service
          {facts.servicesWithHelp === 1 ? ' item carries' : ' items carry'} published articles as “before you order”
          reading. Author once still holds across both.
        </p>
      )}
    </section>
  );
}

function WhyCompare({ facts, subforms }) {
  const { t, a } = useTheme();
  const slate = a('slate');
  const purple = a(entityHue('subform'));
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
            <p className={cx('text-sm font-semibold', t.text)}>RelayHQ: browse the page, open the leaf in a card</p>
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
                  <BookOpen size={ICON.sm} className={a(entityHue('article')).fg} />
                  Then {plural(sample.help, 'article', 'articles')} — shown first, every time
                </p>
                <p className={cx('text-xs font-medium flex items-center gap-1.5', t.text)}>
                  <FileQuestion size={ICON.sm} className={purple.fg} />
                  Then {plural(sample.forms, 'request form', 'request forms')}, each routed on its own
                </p>
              </div>
              <p className={cx('text-[11px]', t.textMuted)}>
                All of that happens in a card over the browse page, so closing it puts you back on the same grid,
                unscrolled. Across this catalog, {facts.helpBeforeForm} items put help in front of a form and
                {' '}{facts.multiIntake} carry more than one intake — which a single form-per-item model cannot express.
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
        <Stat label="catalog items" value={facts.items} accent={entityHue('item')} icon={Circle} />
        <Stat label="orderable services" value={facts.services} accent={entityHue('item')} icon={ShoppingCart} />
        <Stat label="knowledge atoms" value={facts.knowledge} accent={entityHue('article')} icon={BookOpen} />
        <Stat label="of those are also course lessons" value={facts.reusedAsLessons} accent={entityHue('curriculum')} icon={GraduationCap} />
        <Stat label="request forms" value={facts.subforms} accent={entityHue('subform')} icon={FileQuestion} />
        <Stat label="route to a named queue" value={facts.routed} accent={entityHue('ticket')} icon={Route} />
        <Stat label="services needing sign-off" value={facts.servicesApproved} accent={entityHue('approval')} icon={Stamp} />
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
        {facts.services > 0 && (
          <li>
            <strong className={t.text}>{facts.servicesFree} of {facts.services}</strong> orderable services cost nothing, and
            <strong className={t.text}> {facts.servicesApproved}</strong> cannot be fulfilled until a named policy clears. The
            portal shows both facts on the card, before the form — not on the receipt, when it is too late to matter.
          </li>
        )}
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
  const blue = a(entityHue('article'));

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
        <Card accent={entityHue('article')} className={cx(DENSITY.cardPad, 'w-full max-w-md flex items-start gap-3')}>
          <IconTile icon={ex.atom.format === 'guide' ? LayoutGrid : BookOpen} accent={entityHue('article')} size="lg" />
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
            hue={entityHue('item')}
            icon={Circle}
            title="Deflection"
            caption="In the portal, above the request form"
            items={ex.places.map(n => n.name)}
            emptyNote="Not placed in the catalog."
          />
          <DestinationCard
            hue={entityHue('ticket')}
            icon={Inbox}
            title="Agent enablement"
            caption="Taught to the people working the queue"
            items={ex.internalCourses.map(c => c.title)}
            emptyNote="Not in an internal course yet."
          />
          <DestinationCard
            hue={entityHue('curriculum')}
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
