import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronLeft, ChevronRight, BookOpen, Layers,
  Folder, Circle, Inbox, FileQuestion, CircleCheck, CircleAlert, AlignLeft,
  Sparkles, GraduationCap, BookMarked, Clock, Stamp, Send, ThumbsUp, ThumbsDown, Info,
  Moon, Sun, LogOut, Building2, Users, User, Route, Award, Paperclip,
  LayoutGrid, MessageSquare, ShieldCheck, Video, Search, X,
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
  Avatar, EmptyState, Panel, GroupLabel, Banner,
  Field, Input, Textarea, Select, Checkbox,
  Modal, Menu, MenuItem, MenuLabel,
  SubTabs, Breadcrumbs,
} from '@/ds';
import { useStore, getState, addTo, uid, NOW } from '@/store/store.js';
import { evaluate } from '@/lib/conditions.js';
import { serviceRequestContext, annualCost, nextTicketKey } from '@/lib/servicerequest.js';
import { startApproval, matchingPolicies, progress, canDecide } from '@/lib/approvals.js';
import { useRoute, navigate } from '@/lib/router.js';
import { Q, USR, CON, CAT } from '@/store/seed/ids.js';

/**
 * The customer portal — the end-user surface, and the screen that has to argue
 * for RelayHQ's model rather than merely implement it.
 *
 * ============================================================================
 * ONE HOME PAGE, TWO FRONT DOORS, AND ONE CARD THAT HOLDS THE WHOLE DRILL
 * ============================================================================
 * The portal's primary switch is two doors that answer different questions, and
 * the page says which is which BEFORE anybody has to guess at a tab:
 *
 *   GET HELP        "Something is wrong / I have a question" — the
 *                   Product › Subcategory › Item drill over `catalog`, knowledge
 *                   first and a report-a-problem form second. Deflection is the
 *                   mechanic.
 *
 *   SERVICE CATALOG "I want something" — a Category › ServiceItem browse over
 *                   `serviceCategories` + `serviceItems`, where an item carries a
 *                   price, a delivery time, an approval and a fulfilment queue.
 *
 * They are TWO LARGE ENTRY CARDS under the hero search — each with its own
 * entity accent, its own glyph, its own plain-words statement of what it is FOR,
 * and a live fact counted off the seed rather than typed in. The tab strip in
 * the bar stays for people who already know where they are going; the cards are
 * the front door. Neither of them is a page: BOTH OPEN THE CARD.
 *
 * THE PAGE NEVER MOVES. Home is one stable screen — hero, search, the two doors,
 * the requester's open work, browse grid — and every level of every drill happens inside
 * a contained card over it:
 *
 *     door → product → subcategory → item → article / guide → request → receipt
 *     door → category → service item → request → receipt
 *
 * Back moves up ONE level inside the card, the breadcrumbs in the card header
 * jump to any level above, and Close dismisses to a page that never re-rendered
 * and never lost its scroll position. That is v1's behaviour restored: the
 * shadow box opens on the FIRST selection rather than the last, so comparing
 * three services never costs a full-page repaint between each one.
 *
 * THE CARD IS A REAL DIALOG. Escape closes it, focus is trapped inside it,
 * background scroll is locked, and focus returns to whatever opened it. It
 * scales and fades in with the backdrop blurring up behind it, exits the same
 * distance in reverse, and swaps each level's CONTENT with a small slide while
 * the frame itself stays perfectly still — all of it suppressed under
 * prefers-reduced-motion. It is composed here rather than taken from <Modal>
 * only because the header is the v1 shape (close left, title optically centred,
 * breadcrumbs beneath) and the guide viewer wants more width than the standard
 * body — the accessibility contract is the DS shell's.
 *
 * THE THINGS IT PROVES
 *  1. DRILL-DOWN — Product › Subcategory › Item, not a flat list of every form.
 *  2. KB BEFORE FORM — at an item, help is always rendered above the intakes.
 *     Ordering is the deflection mechanic and is not configurable here. The
 *     service catalog obeys the same rule with "before you order" knowledge.
 *  3. THE SUBMISSION REALLY LANDS — a request creates a ticket in the store,
 *     routed by the service item's fulfilment queue (or the subform's, falling
 *     back to General, said out loud), and starts a real approval. A service
 *     order builds that approval's context with serviceRequestContext() from
 *     '@/lib/servicerequest.js' — the same function test/smoke.js uses — so the
 *     portal and the gate can never disagree about what an order costs. The
 *     receipt names the ticket key and, when an approval started, who it waits on.
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

/* THE OPTION LIST'S RHYTHM.
 *
 * v1 rendered every list of choices as full-width rows stacked one per line —
 * long pills — and that is what a choice list is again. It is a deliberately
 * looser rhythm than DENSITY.rowGap, which paces an agent's dense record list;
 * this is an end user picking ONE thing from a short list, and the extra air is
 * what stops it reading as a table. The row's own padding is DENSITY.cardPad. */
const OPTION_STACK = 'space-y-3';
/* The reading column the home page's option list shares with the search box. */
const OPTION_COL = 'max-w-2xl mx-auto';

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
  [CAT.P_DEVICES]: Laptop,
  [CAT.P_APPLICATIONS]: AppWindow,
  [CAT.P_M365]: Mail,
  [CAT.P_NETSEC]: KeyRound,
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

/* ==================================================================== *
 * Accessibility
 *
 * NOTHING IN THIS FILE MOVES ON ITS OWN ANY MORE, so this hook no longer has a
 * timer to suppress. What is left for it is the card's own entry and exit
 * gesture, which is skipped outright — not shortened — for a reader who asked
 * us not to animate.
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
 *
 * `fallbackRef` is where focus goes when the OPENER NO LONGER EXISTS. A search
 * suggestion unmounts itself in the same click that opens the card — clearing
 * the query is what dismisses the popover — so by the time this card closes the
 * button that opened it is detached, and `.focus()` on a detached node is a
 * silent no-op that drops the keyboard onto <body>. The next Tab then restarts
 * at the top of the document instead of near where the reader was.
 */
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(', ');

function useDialogShell(open, onClose, levelKey, fallbackRef) {
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
      /* `preventScroll` on both branches: this card promises the page never
       * moved, and restoring focus is not allowed to be the thing that moves it. */
      const real = opener && opener !== document.body && opener.isConnected;
      const back = real ? opener : fallbackRef?.current || null;
      if (back && typeof back.focus === 'function') back.focus({ preventScroll: true });
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

/* The two front doors, and the vocabulary each one uses.
 *
 * Hues come from the entity registry rather than being picked to look nice: Get
 * Help is fronted by knowledge, the service catalog by orderable items. `question`
 * is the thing the whole redesign turns on — it is the sentence a person arrives
 * holding, said back to them, so choosing a door is recognition rather than a
 * guess between two similarly-sized pills. */
const DOOR = {
  help: {
    kind: 'help',
    hue: entityHue('guide'),
    icon: LifeBuoy,
    factIcon: BookOpen,
    label: 'Get Help',
    question: 'Something is wrong, or I have a question',
    headline: 'How can we help?',
    search: 'Search help articles and problems…',
    scope: 'help',
    browseTitle: 'Where do you need help?',
    pageTitle: 'Every area we support',
    browseHint: 'Pick the area your question belongs to.',
  },
  services: {
    kind: 'service',
    hue: entityHue('item'),
    icon: ShoppingCart,
    factIcon: Truck,
    label: 'Service Catalog',
    question: 'I want something',
    headline: 'What do you need?',
    search: 'Search services you can order…',
    scope: 'the service catalog',
    browseTitle: 'What kind of thing do you need?',
    pageTitle: 'Everything you can order',
    browseHint: 'Pick the kind of thing you need.',
  },
};

/* Motion.
 *
 * ENTRY IS CSS, EXIT IS JS, AND THAT ASYMMETRY IS DELIBERATE. The entry states
 * are declared with `starting:` — @starting-style — so the RESTING state is the
 * visible one and the animation is the thing that is optional. Driving it the
 * other way (mount hidden, reveal on a frame) fails catastrophically when the
 * frame does not arrive: an open, focused, scroll-locked, invisible card. The
 * exit has to be held in JS because the card must finish leaving before the
 * state that renders it is torn down, and `exitMs` is what that costs.
 *
 * Under prefers-reduced-motion both are skipped outright — not shortened. */
const MOTION = { exitMs: 160 };

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
  const [query, setQuery] = useState('');
  /* THE CARD, AND THE ONLY PLACE THE DRILL LIVES.
   *
   * `stack` is the entire journey: an empty stack is the home page with no card
   * over it, and every level — door, product, subcategory, item, article, request
   * form, receipt — is a frame pushed onto it:
   *
   *   { type: 'root',     kind }   the door itself: all products / all categories
   *   { type: 'node',     id }     a catalog product, subcategory or item
   *   { type: 'category', id }     a service category
   *   { type: 'service',  id }     an orderable service item
   *   { type: 'atom',     id }     an article or a guide
   *   { type: 'form',     id }     a request form
   *   { type: 'receipt',  receipt } | { type: 'resolved', id }
   *
   * NOTHING about the page underneath is stored here, and the page stores nothing
   * about the drill. That separation is the whole fix: the home page cannot
   * re-render itself away while somebody is three levels into a card. */
  const [stack, setStack] = useState([]);
  const [answers, setAnswers] = useState({});
  const [touched, setTouched] = useState(false);
  const [emphasise, setEmphasise] = useState(false);
  const [courseId, setCourseId] = useState(null);
  const [lessonId, setLessonId] = useState(null);  // academy reading, still a page
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const scroller = useRef(null);

  const external = form?.audience === 'external';

  /* Lookups */
  const byKb = useMemo(() => new Map((s.knowledge || []).map(k => [k.id, k])), [s.knowledge]);
  const bySf = useMemo(() => new Map((s.subforms || []).map(f => [f.id, f])), [s.subforms]);
  const byQueue = useMemo(() => new Map((s.queues || []).map(q => [q.id, q])), [s.queues]);
  const byCourse = useMemo(() => new Map((s.courses || []).map(c => [c.id, c])), [s.courses]);
  /* Every service category, not only the ones the browse grid shows: a frame in
   * the card has to resolve its own title even when its category was filtered
   * out of the grid, or the header renders an empty string. */
  const byCat = useMemo(() => new Map((s.serviceCategories || []).map(c => [c.id, c])), [s.serviceCategories]);
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

  /* The whole tree walked once. `byNode` answers "what is this id, and what sits
   * above it" in one lookup, which is what lets a search suggestion open the card
   * with its full breadcrumb trail already assembled. */
  const flatHelp = useMemo(() => walkCatalog(products), [products]);
  const byNode = useMemo(() => new Map(flatHelp.map(x => [x.node.id, x])), [flatHelp]);

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

  /* ---------------- where the card is standing ---------------- */

  const helpItems = useMemo(() => flatHelp.filter(x => x.node.type === 'item'), [flatHelp]);

  const frame = stack[stack.length - 1] || null;
  const frameKind = frame?.type || null;
  /* Which door this card belongs to, read off its first frame rather than stored
   * twice. A card opened from a search suggestion knows its door for free. */
  const cardKind = !stack.length ? null
    : stack[0].type === 'root' ? stack[0].kind
    : stack[0].type === 'node' ? 'help'
    : 'service';

  /* The ITEM the card is standing on — the deepest frame that is a catalog item
   * or a service item. Articles, request forms and receipts all hang off it, and
   * finding it by walking down means an article never loses its parent. */
  const itemIndex = useMemo(() => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const f = stack[i];
      if (f.type === 'service') return i;
      if (f.type === 'node' && byNode.get(f.id)?.node.type === 'item') return i;
    }
    return -1;
  }, [stack, byNode]);

  const itemFrame = itemIndex >= 0 ? stack[itemIndex] : null;
  const leafHelp = itemFrame?.type === 'node' ? byNode.get(itemFrame.id) || null : null;
  const leafService = itemFrame?.type === 'service'
    ? svcItems.find(i => i.id === itemFrame.id) || null
    : null;

  const frameNode = frameKind === 'node' ? byNode.get(frame.id) || null : null;
  const frameCategory = frameKind === 'category' ? byCat.get(frame.id) || null : null;

  const leafName = leafHelp?.node.name || leafService?.name || '';
  const leafTrail = leafHelp
    ? leafHelp.trail.map(n => n.name).join(' › ')
    : leafService
      ? (byCat.get(leafService.categoryId)?.name || 'Service catalog')
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

  const frameAtom = frameKind === 'atom' ? byKb.get(frame.id) || null : null;
  const frameIntake = frameKind === 'form' ? bySf.get(frame.id) || null : null;
  const frameResolved = frameKind === 'resolved' ? byKb.get(frame.id) || null : null;

  const svcPolicy = leafService
    ? (s.approvalPolicies || []).find(p => p.id === leafService.approvalPolicyId) || null
    : null;
  const svcQueue = leafService?.fulfilmentQueueId ? byQueue.get(leafService.fulfilmentQueueId) || null : null;

  /* Where an atom ALSO shows up — which courses teach it — is deliberately not
   * computed here any more. It is a true and useful fact about the atom, and it
   * belongs to the Knowledge and Learning modules where somebody is authoring or
   * being taught. In the portal it is one more thing between a person and their
   * answer. */

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

  /* canDecide() is the same predicate the Approvals module uses, so the portal
     can never disagree with the agent view about whose turn it is. */
  const myApprovals = useMemo(
    () => !requester?.id ? []
      : (s.approvals || []).filter(r => canDecide(r, requester.id)),
    [s.approvals, requester]);

  /* The OTHER sense of "my approvals": not one waiting on me, but one holding
     up something I asked for. It belongs on the ticket row, not in a second
     list — the requester's question is "is my thing moving", not "which record
     type is it stuck in". */
  const blockedTickets = useMemo(() => new Set(
    (s.approvals || [])
      .filter(r => r.state === 'awaiting' && r.targetType === 'ticket' && r.targetId)
      .map(r => r.targetId)),
  [s.approvals]);

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

  const closeCard = () => {
    setStack([]); setAnswers({}); setTouched(false); setEmphasise(false);
  };
  const openCard = (frames) => {
    setStack(frames); setAnswers({}); setTouched(false); setEmphasise(false); setQuery('');
  };

  /* Opening AT a leaf opens the whole path DOWN TO it, so the breadcrumbs and the
   * Back button behave identically whether you drilled there yourself or landed
   * on it from a search suggestion. Nobody arrives inside a card with no idea
   * where they are. */
  const helpFrames = (id) => {
    const entry = byNode.get(id);
    if (!entry) return [{ type: 'node', id }];
    return [...entry.trail.map(n => ({ type: 'node', id: n.id })), { type: 'node', id }];
  };
  const serviceFrames = (id) => {
    const item = svcItems.find(i => i.id === id);
    return item?.categoryId
      ? [{ type: 'category', id: item.categoryId }, { type: 'service', id }]
      : [{ type: 'service', id }];
  };

  const openDoor = (kind) => openCard([{ type: 'root', kind }]);
  const openHelpNode = (id) => openCard(helpFrames(id));
  const openCategory = (id) => openCard([{ type: 'category', id }]);
  const openService = (id) => openCard(serviceFrames(id));

  const pushFrame = (next) => setStack(st => [...st, next]);
  const openAtomFrame = (id) => pushFrame({ type: 'atom', id });
  const openIntakeFrame = (id) => {
    setAnswers({}); setTouched(false);
    pushFrame({ type: 'form', id });
  };

  /* Back moves up ONE level inside the card. At the base level there is nothing
   * above it but the page, so it dismisses — which is the same gesture, one step
   * further out. The breadcrumb jumps straight to any level above. */
  const cardBack = () => {
    if (stack.length > 1) { setStack(st => st.slice(0, -1)); setEmphasise(false); return; }
    closeCard();
  };
  const goToLevel = (i) => { setStack(st => st.slice(0, i + 1)); setEmphasise(false); };

  /* Reset the journey when the brand changes — a customer never sees two at once. */
  useEffect(() => {
    setStack([]); setCourseId(null); setLessonId(null); setQuery(''); setEmphasise(false);
  }, [form?.id]);

  /* A page navigation starts at the top of the page, the way a real one would.
   * The CARD is deliberately absent from this list — opening it, drilling inside
   * it and closing it must all leave the page's scroll position exactly alone. */
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [tab, courseId, lessonId]);

  /* "No, I need help" promises to land you on the request forms for this thing.
   * Inside the card that is a jump back down to its item, with the intakes
   * called out — never a dismissal, which would throw away the drill. */
  const onArticleNo = () => {
    if (itemIndex >= 0) setStack(st => st.slice(0, itemIndex + 1));
    setEmphasise(true);
  };
  const onArticleYes = (id) => setStack(st => [...st.slice(0, -1), { type: 'resolved', id }]);

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
      /* Same shape the seed and the agent workspace write, so a portal ticket is
       * indistinguishable from one raised anywhere else — an absent field and a
       * null one read differently in the SLA panel. */
      slaPolicyId: null,
      firstResponseAt: null,
      createdAt: now,
      updatedAt: now,
    };
    addTo('tickets', ticket);

    /* Approval — run it for real so it turns up in the Approvals module.
     *
     * The two catalogs differ here on purpose. A subform ATTACHES a policy whose
     * conditions decide whether it applies, so the help path asks the engine
     * first. A service item DECLARES that it needs sign-off — that is what the
     * named-policy chip on the card promised — so naming a policy is the
     * condition, and it starts. */
    const policyId = svc?.approvalPolicyId || intake.approvalPolicyId || null;
    const policy = policyId ? (st.approvalPolicies || []).find(p => p.id === policyId) || null : null;
    let approvalId = null;
    let policyRan = false;
    let unresolved = false;

    if (policy) {
      const who = {
        id: requester?.id,
        department: external ? null : requester?.department || null,
        isExternal: !!external,
        vip: !!requester?.vip,
        org: { plan: org?.plan || null },
      };

      /* A SERVICE ORDER BUILDS ITS CONTEXT WITH THE SHARED FUNCTION.
       *
       * test/smoke.js asserts that every service item declaring an approval
       * actually fires one, and it builds the context with serviceRequestContext.
       * If the portal hand-rolled a second version — as it used to, deriving a
       * one-off `amount` from `item.price` — the gate would pass on the annual
       * figure while the portal ordered a $55/month seat against a $500 threshold
       * and nobody signed off. One function, both callers, no daylight. */
      const ordered = svc
        ? serviceRequestContext(svc, answerCtx, who,
          { directory: st.directory || [], queues: st.queues || [] })
        : null;

      const ctx = ordered
        ? {
          ...ordered,
          ticket: {
            ...ordered.ticket,
            /* The ticket really landed, so the policy sees the destination it
             * landed in rather than the one the item merely asked for. */
            title: ticket.title, priority: ticket.priority, status: ticket.status,
            queueId: ticket.queueId,
          },
          __now: now,
        }
        : {
          requesterId: requester?.id,
          directory: st.directory || [],
          queues: st.queues || [],
          answers: answerCtx,
          ticket: {
            title: ticket.title, priority: ticket.priority, status: ticket.status,
            queueId: ticket.queueId, source: 'portal', labels: [],
            subformId: intake.id, catalogItemId: helpNode?.id || null,
          },
          requester: { department: who.department, isExternal: who.isExternal, vip: who.vip },
          org: who.org,
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

    /* The receipt REPLACES the form it came from rather than resetting the stack:
     * the levels above it are still the path you took, so the breadcrumb still
     * reads Product › Item › Submitted and Done still closes to the same page. */
    setStack(st => [...st.slice(0, -1), {
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
        /* The same annualised figure the approval was tested against, so the
         * receipt cannot quote a number the sign-off never saw. */
        price: svc ? fmtMoney(annualCost(svc, answerCtx.quantity)) : null,
      },
    }]);
  };

  /* ---------------- facts for the argument ---------------- */

  const orgName = s.settings?.orgName || 'Northwind Systems';

  /* The line under each door. COUNTED, never typed: a door that promises "answers
   * on everything" has to be able to prove it from the catalog it is standing on,
   * and the delivery claim is a median with the population that beats it named,
   * rather than the vaguest true thing we could have said. */
  const doorFacts = useMemo(() => {
    const topics = helpItems.length;
    const answered = helpItems.filter(x => (x.node.knowledgeIds || []).length).length;
    const help = topics
      ? `${plural(topics, 'topic', 'topics')} · ${answered === topics
        ? 'answers attached to every one'
        : `${answered} with answers attached`}`
      : 'Nothing published for your audience yet';

    const days = svcItems.map(i => Number(i.deliveryDays)).filter(Number.isFinite).sort((x, y) => x - y);
    const median = days.length ? days[Math.floor(days.length / 2)] : null;
    const quick = median === null ? 0 : svcItems.filter(i => Number(i.deliveryDays) <= median).length;
    const speed = median === null ? null
      : median <= 0 ? 'the same day'
      : `${plural(median, 'day', 'days')} or less`;
    const services = svcItems.length
      ? `${plural(svcItems.length, 'thing', 'things')} you can order${speed
        ? ` · ${quick} of them arrive in ${speed}`
        : ''}`
      : 'Nothing published for your audience yet';

    return { help, services };
  }, [helpItems, svcItems]);

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
                Publish a form in the Forms module and the help centre appears here.
              </p>
              <div className="mt-8 flex justify-center">
                <Button variant="grad" module="portal" size="lg" icon={ArrowRight} onClick={() => navigate('forms')}>
                  Open Forms
                </Button>
              </div>
            </div>
          </section>
          <div className={cx(MID, 'pb-16')}>
            <EmptyState icon={FileQuestion} title="No published portal form" />
          </div>
        </div>
      </div>
    );
  }

  const brandIcon = external ? Building2 : Users;
  const tabs = [
    { value: 'help', label: DOOR.help.label, icon: DOOR.help.icon, accent: DOOR.help.hue },
    { value: 'services', label: DOOR.services.label, icon: DOOR.services.icon, accent: DOOR.services.hue },
    { value: 'requests', label: 'My requests', icon: Inbox, accent: entityHue('ticket'), count: myTickets.length },
  ];
  if (academyCourses.length) {
    tabs.push({
      value: 'academy', label: 'Academy', icon: GraduationCap,
      accent: entityHue('curriculum'), count: academyCourses.length,
    });
  }

  /* ---------------- what the card is showing ---------------- */

  const cardDoor = cardKind === 'service' ? DOOR.services : DOOR.help;
  /* How many catalog levels deep the drill is, which is what LEVEL_COPY counts:
   * 0 at the door, 1 standing on a product, 2 on a subcategory. */
  const helpLevel = stack.filter(f => f.type === 'node').length;
  const browsing = frameKind === 'root' || frameKind === 'category'
    || (frameKind === 'node' && frameNode?.node.type !== 'item');

  /* The card's frame decides its own accent, eyebrow and title, so the border
   * tells you what you are standing on without a second label. */
  const cardAccent = frameKind === 'atom'
    ? entityHue(frameAtom?.format === 'guide' ? 'guide' : 'article')
    : frameKind === 'form' ? entityHue('subform')
    : frameKind === 'receipt' ? entityHue('ticket')
    : frameKind === 'resolved' ? statusMeta('resolved').hue
    : frameKind === 'root' ? cardDoor.hue
    : frameKind === 'category' ? entityHue('product')
    : frameKind === 'node' ? entityHue(frameNode?.node.type || 'product')
    : entityHue('item');
  const cardEyebrow = frameKind === 'atom' ? (frameAtom?.format === 'guide' ? 'Guide' : 'Article')
    : frameKind === 'form' ? 'Request'
    : frameKind === 'receipt' ? 'Submitted'
    : frameKind === 'resolved' ? 'Sorted'
    : frameKind === 'root' ? cardDoor.label
    /* The service catalog is two levels, not three, and it says so out loud —
     * the same "how far in am I" signal the help drill gives. */
    : frameKind === 'category' ? 'Step 2 of 2'
    : frameKind === 'node' && frameNode?.node.type !== 'item' ? LEVEL_COPY[Math.min(helpLevel, 2)].label
    : cardKind === 'service' ? 'Service' : 'Help';
  const cardTitle = frameKind === 'atom' ? (frameAtom?.title || 'Article')
    : frameKind === 'form' ? (frameIntake?.name || 'Request')
    : frameKind === 'receipt' ? 'Request received'
    : frameKind === 'resolved' ? 'Glad that sorted it'
    : frameKind === 'root' ? cardDoor.browseTitle
    : frameKind === 'category' ? (frameCategory?.name || 'Service catalog')
    : frameKind === 'node' ? (frameNode?.node.name || 'Browse')
    : leafName;
  /* The door's own words, quoted back — so the card you just opened is visibly
   * the card that door promised. */
  /* Only the door screen gets a subtitle, and only because its question appears
   * nowhere else. Everywhere else the subtitle was the parent level — which is
   * already the second-to-last crumb — so the card header printed the same two
   * facts three times: eyebrow, title, subtitle, trail. */
  const cardSubtitle = frameKind === 'root' ? `“${cardDoor.question}”` : null;

  /* Crumbs ARE the stack — there is no second copy of where you are to fall out
   * of step with it. The last one is the level you are on, which <Breadcrumbs>
   * renders as plain text rather than a link. */
  const crumbs = stack.map((f, i) => ({
    id: i,
    name: f.type === 'root' ? (f.kind === 'service' ? DOOR.services.label : DOOR.help.label)
      : f.type === 'node' ? (byNode.get(f.id)?.node.name || 'Topic')
      : f.type === 'category' ? (byCat.get(f.id)?.name || 'Category')
      : f.type === 'service' ? (svcItems.find(x => x.id === f.id)?.name || 'Service')
      : f.type === 'atom' ? (byKb.get(f.id)?.title || 'Article')
      : f.type === 'form' ? (bySf.get(f.id)?.name || 'Request')
      : f.type === 'receipt' ? 'Submitted'
      : 'Sorted',
  }));

  /* One primary action per screen, and only where there is genuinely one thing
   * to do next. A browse level has none — it says what to do instead. */
  const cardPrimary = frameKind === 'form'
    ? { label: frameIntake?.submitLabel || 'Submit request', icon: Send, onClick: submit }
    : frameKind === 'service' && leafForms[0]
      ? { label: 'Request this', icon: ShoppingCart, onClick: () => openIntakeFrame(leafForms[0].id) }
    : frameKind === 'node' && !browsing && leafForms.length === 1
      ? { label: leafForms[0].submitLabel || 'Raise a request', icon: ArrowRight, onClick: () => openIntakeFrame(leafForms[0].id) }
    : null;

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
        onHome={() => { setTab('help'); setQuery(''); closeCard(); }}
        /* The tab strip is the shortcut for people who already know where they
         * are going. It dismisses whatever card is open — otherwise it is a dead
         * click for anyone standing inside an article. */
        onTab={(v) => {
          setTab(v); setCourseId(null); setLessonId(null); setQuery(''); closeCard();
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

      {/* `tabIndex={-1}` is not for tabbing to — it is so the card has somewhere
          real to hand focus back to when the control that opened it has since
          been unmounted (a search suggestion opens the card and dismisses
          itself in the same click). Focus lands on the page's own content
          container, so the next Tab resumes in the page rather than at the very
          top of the document. */}
      <div ref={scroller} tabIndex={-1} className="flex-1 overflow-auto outline-none">
        {/* THE HOME PAGE. One screen per door, and each one is STABLE: nothing
            below re-renders when the card opens, drills or closes, which is why
            closing puts you back on the same grid at the same scroll offset. */}
        {tab === 'help' && (
          <>
            <PortalHero
              door={DOOR.help}
              form={form}
              external={external}
              orgName={orgName}
              query={query}
              onQuery={setQuery}
              results={results}
              onAtom={(hit) => openCard([...helpFrames(hit.leaf.id), { type: 'atom', id: hit.id }])}
              onThing={(hit) => openHelpNode(hit.id)}
              doors={<DoorCards facts={doorFacts} onOpen={openDoor} />}
            />

            {/* The space under the doors belongs to the person, not the catalog.
                A grid of products was a THIRD route into a drill both doors
                already open, and it pushed the one thing a returning requester
                came for — where is my thing — off the screen. */}
            <MyWork
              tickets={myTickets}
              approvals={myApprovals}
              blocked={blockedTickets}
              queues={byQueue}
              onTicket={(id) => setDetailId(id)}
              onApproval={() => navigate('approvals')}
            />
          </>
        )}

        {tab === 'services' && (
          <>
            <PortalHero
              door={DOOR.services}
              form={form}
              external={external}
              orgName={orgName}
              query={query}
              onQuery={setQuery}
              results={results}
              onAtom={(hit) => openCard([...serviceFrames(hit.leaf.id), { type: 'atom', id: hit.id }])}
              onThing={(hit) => openService(hit.id)}
              doors={<DoorCards facts={doorFacts} onOpen={openDoor} />}
            />
            <ServiceCategoriesScreen
              categories={svcCategories}
              items={svcItems}
              onPick={openCategory}
            />
          </>
        )}

        {tab === 'requests' && (
          <RequestsScreen
            tickets={myTickets}
            orgTickets={orgTickets}
            org={org}
            queues={byQueue}
            requester={requester}
            onOpen={setDetailId}
            onBrowse={() => { setTab('help'); setQuery(''); }}
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
          onHelp={() => { setTab('help'); closeCard(); }}
          onServices={() => { setTab('services'); closeCard(); }}
          onRequests={() => { setTab('requests'); closeCard(); }}
          onAcademy={() => { setTab('academy'); closeCard(); }}
        />
      </div>

      {/* THE CONTAINED CARD. Every level of the drill happens in here, over a
          home page that never moved — the door, the browse levels, the item, the
          reading, the request and the receipt. */}
      {stack.length > 0 && (
        <LeafCard
          accent={cardAccent}
          eyebrow={cardEyebrow}
          title={cardTitle}
          subtitle={cardSubtitle}
          crumbs={crumbs}
          onCrumb={goToLevel}
          /* Browse levels and the guide player both want the wider measure; prose
             stays near 70 characters where it belongs. */
          wide={browsing || (frameKind === 'atom' && frameAtom?.format === 'guide')}
          levelKey={`${cardKind}:${stack.length}:${frameKind}:${frame?.id || ''}`}
          onClose={closeCard}
          returnFocusTo={scroller}
          footer={
            <LeafFooter
              frame={frame}
              onBack={cardBack}
              onClose={closeCard}
              backLabel={stack.length > 1 ? 'Back' : 'Back to browse'}
              primary={cardPrimary}
              resolve={frameAtom ? {
                onYes: () => onArticleYes(frameAtom.id),
                onNo: onArticleNo,
              } : null}
              onRequests={() => { closeCard(); setTab('requests'); }}
              ticketId={frame?.receipt?.ticketId}
            />
          }
        >
          {frameKind === 'atom' && frameAtom ? (
            <LeafReading atom={frameAtom} />
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
            <LeafResolved atom={frameResolved} />
          ) : frameKind === 'root' && cardKind === 'service' ? (
            <LeafServiceCategories
              categories={svcCategories}
              items={svcItems}
              onPick={(id) => pushFrame({ type: 'category', id })}
            />
          ) : frameKind === 'root' ? (
            <LeafHelpBrowse
              level={0}
              node={null}
              nodes={products}
              onPick={(n) => pushFrame({ type: 'node', id: n.id })}
            />
          ) : frameKind === 'category' ? (
            <LeafServiceItems
              category={frameCategory}
              items={svcItems.filter(i => i.categoryId === frame.id)}
              policies={s.approvalPolicies || []}
              onPick={(id) => pushFrame({ type: 'service', id })}
            />
          ) : frameKind === 'service' && leafService ? (
            <LeafServiceItem
              item={leafService}
              categoryName={leafTrail}
              atoms={leafAtoms}
              subform={leafForms[0] || null}
              queue={svcQueue}
              policy={svcPolicy}
              onAtom={openAtomFrame}
            />
          ) : frameKind === 'node' && frameNode?.node.type !== 'item' ? (
            <LeafHelpBrowse
              level={helpLevel}
              node={frameNode?.node || null}
              nodes={frameNode?.node.children || []}
              onPick={(n) => pushFrame({ type: 'node', id: n.id })}
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
          ) : (
            /* A frame whose record has gone — an id that no longer resolves after
               a portal switch. Say so rather than rendering an empty card. */
            <EmptyState icon={FileQuestion} title="That is no longer published"
              hint="The thing this card was showing is not in the current portal's scope. Close this and pick again." />
          )}
        </LeafCard>
      )}

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
      {/* Chrome is NOT constrained to the reading width. Capping the header at
          the content measure squeezed four tabs, a brand picker and an account
          block into 1152px and clipped the tab row on a 1440px screen. The bar
          spans the viewport; only the content below it is capped. */}
      <div className="w-full px-5 h-16 flex items-center gap-3">
        {/* The brand block must be allowed to SHRINK. Marking it flex-shrink-0
            meant that once the tab row grew to four items the words could not
            give way, so they ran underneath the tabs instead of truncating.
            It shrinks and truncates now, and the mark never does. */}
        <button onClick={onHome}
          className="flex items-center gap-3 min-w-0 shrink basis-auto max-w-[15rem] mr-1"
          aria-label="Back to the help centre">
          <span className={cx('w-9 h-9 rounded-xl flex items-center justify-center shadow-md flex-shrink-0',
            moduleGradient('portal', 'tile'))}>
            <Brand size={ICON.lg} className="text-white" />
          </span>
          {/* The mark alone carries the brand until there is room for the words. */}
          <span className="min-w-0 text-left hidden xl:block">
            <span className={cx('block text-sm font-semibold leading-tight truncate', t.text)}>{orgName}</span>
            <span className={cx('block text-[11px] leading-tight truncate', t.textMuted)}>{form.name}</span>
          </span>
        </button>

        <div className="flex-1 flex justify-center min-w-0 overflow-x-auto">
          <SubTabs items={tabs} value={tab} onChange={onTab} className="flex-shrink-0" />
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

/** "3 days ago" / "today" — enough to know whether a request is moving. */
function relDays(iso) {
  if (!iso) return 'recently';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'recently';
  const days = Math.round((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return 'a while ago';
}

function MyWork({ tickets, approvals, blocked, queues, onTicket, onApproval }) {
  const { t } = useTheme();
  const done = ['resolved', 'closed', 'cancelled'];
  const open = tickets.filter(tk => !done.includes(tk.status));
  const closed = tickets.filter(tk => done.includes(tk.status));

  if (!tickets.length && !approvals.length) {
    return (
      <section className={cx(WIDE, 'pb-16')}>
        <EmptyState icon={Inbox} title="Nothing open"
          hint="Anything you raise here will show up with its status and the team working it." />
      </section>
    );
  }

  return (
    <section className={cx(WIDE, 'pb-16 space-y-10')}>
      {/* Approvals lead: something waiting on YOU outranks something you are
          waiting on. */}
      {approvals.length > 0 && (
        <div>
          <SectionHead eyebrow="Waiting on you" title={plural(approvals.length, 'approval', 'approvals')} />
          <div className={DENSITY.rowGap}>
            {approvals.map(ap => (
              <ApprovalRow key={ap.id} approval={ap} onOpen={onApproval} />
            ))}
          </div>
        </div>
      )}

      {open.length > 0 && (
        <div>
          <SectionHead eyebrow="Your requests" title={`${plural(open.length, 'request', 'requests')} on the go`} />
          <div className={DENSITY.rowGap}>
            {open.map(tk => (
              <RequestRow key={tk.id} ticket={tk} queue={queues.get(tk.queueId)}
                blocked={blocked.has(tk.id)} onOpen={() => onTicket(tk.id)} />
            ))}
          </div>
        </div>
      )}

      {closed.length > 0 && (
        <div>
          <SectionHead eyebrow="Closed" title={plural(closed.length, 'request', 'requests')} />
          <div className={DENSITY.rowGap}>
            {closed.map(tk => (
              <RequestRow key={tk.id} ticket={tk} queue={queues.get(tk.queueId)} muted
                onOpen={() => onTicket(tk.id)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ApprovalRow({ approval, onOpen }) {
  const { t, a } = useTheme();
  const hue = entityHue('approval');
  const c = a(hue);
  return (
    <button
      onClick={onOpen}
      className={cx('group w-full text-left rounded-xl border flex items-center gap-3 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        DENSITY.rowPad, t.portalCard)}
    >
      <IconTile icon={Stamp} accent={hue} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cx('block text-sm font-medium truncate', t.text)}>{approval.subject || 'Approval request'}</span>
        <span className={cx('block text-xs truncate', t.textMuted)}>Waiting on your decision</span>
      </span>
      <span className="flex items-center gap-2.5 flex-shrink-0">
        <Chip accent={hue}>Needs you</Chip>
        <ChevronRight size={ICON.md} className={cx('opacity-0 group-hover:opacity-100 transition-opacity', c.fg)} />
      </span>
    </button>
  );
}

/**
 * THE HERO — the same shape behind both doors.
 *
 * The help centre leads with the form's own headline; the service catalog asks
 * the ordering question instead, and the search says which of the two it is
 * about to look through. `doors` sits directly under the search: search first
 * for the person who knows the words for their problem, the two doors
 * immediately after for the person who does not.
 *
 * It carries no list of its own any more. A summary of the requester's open
 * work used to hang below the doors, but the full list now owns the space under
 * the hero — a four-row teaser above a complete list is the same rows twice.
 */
function PortalHero({
  door, form, external, orgName, query, onQuery, results,
  onAtom, onThing, doors,
}) {
  const { t, dark } = useTheme();
  const services = door.scope !== 'help';
  const Brand = services ? Store : external ? Building2 : Users;
  const eyebrow = services
    ? `${orgName} service catalog`
    : external ? `${orgName} support` : `${orgName} help centre`;
  const headline = services ? door.headline : (form.headline || form.name || door.headline);
  const sub = services ? null : (form.subhead || form.description || null);

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

        {doors}
      </div>
    </section>
  );
}

/* ==================================================================== *
 * THE TWO FRONT DOORS
 *
 * The fix for the complaint that started this: two identically-sized pills in a
 * tab strip cannot tell anybody which one they want. These can, because each one
 * says the sentence its person arrived holding —
 *
 *     "Something is wrong, or I have a question"   → Get Help
 *     "I want something"                           → Service Catalog
 *
 * — and then proves it is worth clicking with a fact counted off the seed rather
 * than a promise. They are not tabs and they are not links: both OPEN THE CARD,
 * so the choice costs no page.
 * ==================================================================== */

function DoorCards({ facts, onOpen }) {
  return (
    <div className="mt-10 max-w-4xl mx-auto grid gap-4 sm:grid-cols-2 text-left">
      <DoorCard door={DOOR.help} fact={facts.help} onOpen={() => onOpen(DOOR.help.kind)} />
      <DoorCard door={DOOR.services} fact={facts.services} onOpen={() => onOpen(DOOR.services.kind)} />
    </div>
  );
}

/**
 * One door. The accent is the entity hue of what lies behind it — knowledge for
 * Get Help, orderable items for the catalog — so the colour has already told you
 * which world you are entering before you read the words. The rail is present at
 * rest, not on hover: at rest is when the distinction has to be legible.
 */
function DoorCard({ door, fact, onOpen }) {
  const { t, a } = useTheme();
  const c = a(door.hue);
  const Glyph = door.icon;
  const FactGlyph = door.factIcon;

  return (
    <button
      onClick={onOpen}
      className={cx('group relative rounded-3xl border overflow-hidden text-left flex flex-col p-6 sm:p-7 shadow-sm',
        'transition-transform duration-200 hover:-translate-y-1 hover:shadow-2xl', t.portalCard)}
    >
      <span aria-hidden className={cx('absolute inset-x-0 top-0 h-1.5', c.rail)} />
      <span aria-hidden className={cx('absolute inset-0 rounded-3xl border-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity', c.borderStrong)} />

      <span className="flex items-start justify-between gap-3">
        <span className={cx('w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0', c.softStrong)}>
          <Glyph size={28} className={c.fg} />
        </span>
        <ChevronRight size={ICON.xl}
          className={cx('mt-3 flex-shrink-0 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all', c.fg)} />
      </span>

      <span className={cx('mt-5 block text-xl sm:text-2xl font-semibold tracking-tight', t.text)}>
        {door.label}
      </span>
      <span className={cx('mt-1.5 block text-sm font-medium', c.fg)}>“{door.question}”</span>

      <span className={cx('mt-auto pt-5 flex items-center gap-2 text-xs border-t', t.textMuted, t.border)}>
        <FactGlyph size={ICON.xs} className="flex-shrink-0" />
        {fact}
      </span>
    </button>
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

/* ==================================================================== *
 * THE LONG PILL — one option, one full-width row.
 *
 * v1's option list, restored: every choice in this portal is a row spanning the
 * reading column, stacked one per line, never a grid of boxes. A grid asks you
 * to scan in two dimensions and sizes every option identically whatever it
 * carries; a stack of rows is read top to bottom in one pass, which is the
 * shape of "pick one of these".
 *
 * The anatomy is fixed so every list in the portal is the same object: a tinted
 * icon tile, a name, a quiet secondary line, an optional meta line of facts, an
 * optional trailing group of VALUE chips, and a chevron.
 *
 * The chevron is muted at rest and accent on hover. It is drawn twice and
 * cross-faded rather than given a `group-hover:` colour, because the accent
 * class comes from a(hue) at runtime and interpolating one would compile to
 * nothing at all.
 * ==================================================================== */

function OptionRow({ icon: Glyph, hue = 'gray', name, secondary, meta, trailing, emphasise, onClick }) {
  const { t, a } = useTheme();
  const c = a(hue);
  return (
    <button
      onClick={onClick}
      className={cx('group w-full flex items-center gap-4 rounded-2xl border text-left shadow-sm',
        'transition-all duration-200 hover:shadow-lg', DENSITY.cardPad, t.portalCard,
        emphasise && c.borderStrong)}
    >
      <span className={cx('p-3 rounded-xl flex-shrink-0', c.softStrong)}>
        <Glyph size={ICON.lg} className={c.fg} />
      </span>

      <span className="flex-1 min-w-0">
        <span className={cx('block font-medium leading-snug', t.text)}>{name}</span>
        {secondary && (
          <span className={cx('block text-xs mt-0.5 leading-relaxed line-clamp-2', t.textMuted)}>{secondary}</span>
        )}
        {meta && (
          <span className={cx('mt-1.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px]', t.textMuted)}>
            {meta}
          </span>
        )}
      </span>

      {trailing && (
        <span className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end max-w-[45%]">{trailing}</span>
      )}

      <span aria-hidden className="relative flex-shrink-0 w-4 h-4">
        <ChevronRight size={ICON.md}
          className={cx('absolute inset-0 transition-opacity group-hover:opacity-0', t.textMuted)} />
        <ChevronRight size={ICON.md}
          className={cx('absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100', c.fg)} />
      </span>
    </button>
  );
}

/** One fact on a row's meta line — an icon and a value, never a bare number. */
function OptionFact({ icon: Glyph, children, className }) {
  return (
    <span className={cx('flex items-center gap-1.5', className)}>
      {Glyph && <Glyph size={ICON.xs} className="flex-shrink-0" />}
      {children}
    </span>
  );
}

/* ==================================================================== *
 * The trail — back and breadcrumbs, for the one journey that is still a PAGE.
 *
 * The academy is a course, not a leaf: a lesson is read at page width with the
 * course sequence around it, so it keeps its own trail bar. Everything the help
 * and service doors used this for now lives in the card header instead.
 * ==================================================================== */

function TrailBar({ crumbs, onNavigate, onBack }) {
  const { t } = useTheme();
  return (
    <div className={cx('sticky top-0 z-20 border-b backdrop-blur-xl', t.border, t.bgSidebar)}>
      <div className={cx(WIDE, 'py-2.5 flex items-center gap-3')}>
        <Button variant="outline" size="sm" icon={ArrowLeft} onClick={onBack} className="flex-shrink-0">Back</Button>
        <div className="min-w-0 flex-1">
          <Breadcrumbs items={crumbs} onNavigate={onNavigate} />
        </div>
      </div>
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

/**
 * ONE CATALOG NODE AS A ROW — product, subcategory or item.
 *
 * It carries everything the card version carried: the description, the counts
 * that say how much sits under it, and the Popular flag. The counts are plain
 * facts on the meta line rather than chips, because a chip carries a VALUE and
 * "3 categories" is a number.
 */
function NodeOptionRow({ node, onPick }) {
  const stats = nodeStats(node);
  return (
    <OptionRow
      icon={nodeIcon(node)}
      hue={entityHue(node.type)}
      name={node.name}
      secondary={node.description}
      meta={<>
        {node.type === 'product' && stats.children > 0 && (
          <OptionFact icon={Layers}>{plural(stats.children, 'category', 'categories')}</OptionFact>
        )}
        {node.type === 'product' && stats.items > 0 && (
          <OptionFact icon={Circle}>{plural(stats.items, 'service', 'services')}</OptionFact>
        )}
        {node.type === 'subcategory' && stats.children > 0 && (
          <OptionFact icon={Circle}>{plural(stats.children, 'service', 'services')}</OptionFact>
        )}
        {stats.help > 0 && <OptionFact icon={BookOpen}>{plural(stats.help, 'answer', 'answers')}</OptionFact>}
        {stats.intakes > 0 && <OptionFact icon={FileQuestion}>{plural(stats.intakes, 'form', 'forms')}</OptionFact>}
        {node.fulfillment && <OptionFact icon={Clock}>{node.fulfillment}</OptionFact>}
      </>}
      trailing={node.popular ? <Chip accent="amber" icon={Sparkles}>Popular</Chip> : null}
      onClick={() => onPick(node)}
    />
  );
}

/**
 * A HELP BROWSE LEVEL, INSIDE THE CARD.
 *
 * A LIST OF CHOICES, SO IT IS A LIST — full-width rows stacked one per line,
 * not a two-up grid of boxes. The home page keeps its browse grid because that
 * is a landing overview of everything; this is "pick one", and it reads top to
 * bottom in a single pass. The step label lives in the card header, so the body
 * only has to say what to do.
 */
function LeafHelpBrowse({ level, node, nodes, onPick }) {
  const { t } = useTheme();
  const copy = LEVEL_COPY[Math.min(level, 2)];
  return (
    <div className="space-y-5">
      {node?.description && (
        <p className={cx('text-[15px] leading-relaxed', t.textSecondary)}>{node.description}</p>
      )}
      <div>
        <LeafSectionHead
          title={nodes.length ? 'Choose one' : 'Nothing here yet'}
          hint={nodes.length ? copy.hint : undefined}
        />
        {nodes.length === 0 ? (
          <EmptyState icon={Folder} title="Nothing published here"
            hint="This branch of the catalog has no published children for your audience." />
        ) : (
          <div className={OPTION_STACK}>
            {nodes.map(n => <NodeOptionRow key={n.id} node={n} onPick={onPick} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Browse — Service Catalog
 *
 * A different shape from the help tree because it answers a different question.
 * Two levels only, and the item carries a price, a delivery time and a sign-off
 * rather than an article and a symptom picker.
 * ==================================================================== */

/**
 * ONE SERVICE CATEGORY AS A ROW.
 *
 * A category groups orderable things, so it is coloured like the grouping level
 * of the other catalog. The registry decides, not this file.
 */
function ServiceCategoryOptionRow({ category, items, onPick }) {
  const free = items.filter(i => !Number(i.price)).length;
  const approvals = items.filter(i => i.approvalPolicyId).length;
  return (
    <OptionRow
      icon={serviceGlyph(category.icon, Boxes)}
      hue={entityHue('product')}
      name={category.name}
      secondary={category.description}
      meta={<>
        <OptionFact icon={Package}>{plural(items.length, 'service', 'services')}</OptionFact>
        {free > 0 && <OptionFact icon={DollarSign}>{free} at no charge</OptionFact>}
        {approvals > 0 && <OptionFact icon={Stamp}>{approvals} need sign-off</OptionFact>}
      </>}
      onClick={() => onPick(category.id)}
    />
  );
}

/**
 * ONE ORDERABLE SERVICE AS A ROW.
 *
 * Price, recurrence and delivery sit on the meta line; the named approval and
 * the Popular flag are trailing chips. Every fact the card carried is still
 * here — a person choosing between two laptops still sees what each costs and
 * when it turns up, without opening either.
 */
function ServiceItemOptionRow({ item, policy, onPick }) {
  const { a } = useTheme();
  const c = a(entityHue('item'));
  const price = fmtMoney(item.price) || 'No charge';
  const recurring = fmtRecurring(item);
  const delivery = fmtDelivery(item.deliveryDays);

  return (
    <OptionRow
      icon={serviceGlyph(item.icon)}
      hue={entityHue('item')}
      name={item.name}
      secondary={item.shortDescription}
      meta={<>
        <OptionFact icon={DollarSign} className={cx('font-semibold', c.fg)}>{price}</OptionFact>
        {recurring && <OptionFact>then {recurring}</OptionFact>}
        {delivery && <OptionFact icon={Truck}>{delivery}</OptionFact>}
      </>}
      trailing={<>
        {item.popular && <Chip accent="amber" icon={Sparkles}>Popular</Chip>}
        {/* The chip carries the VALUE — the policy that will run — not a count
            and not a generic label, and it appears BEFORE the form so nobody
            fills one in to discover it needs their director. The name only
            falls back to the generic wording when the policy is missing. */}
        {item.approvalPolicyId && (
          <Chip
            accent={entityHue('approval')}
            icon={Stamp}
            title={policy ? `Approval required — ${policy.name}` : 'Approval required'}
          >
            {policy?.name || 'Approval required'}
          </Chip>
        )}
      </>}
      onClick={() => onPick(item.id)}
    />
  );
}

/** The service door's first level, inside the card. */
function LeafServiceCategories({ categories, items, onPick }) {
  return (
    <div>
      <LeafSectionHead title={categories.length ? 'Choose one' : 'Nothing here yet'} />
      {categories.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No services published yet"
          hint="The service catalog is empty for your audience." />
      ) : (
        <div className={OPTION_STACK}>
          {categories.map(cat => (
            <ServiceCategoryOptionRow
              key={cat.id}
              category={cat}
              items={items.filter(i => i.categoryId === cat.id)}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** The things in one category, inside the card. */
function LeafServiceItems({ category, items, policies, onPick }) {
  const { t } = useTheme();
  return (
    <div className="space-y-5">
      {category?.description && (
        <p className={cx('text-[15px] leading-relaxed', t.textSecondary)}>{category.description}</p>
      )}
      <div>
        <LeafSectionHead title={items.length ? 'Choose what to order' : 'Nothing here yet'} />
        {items.length === 0 ? (
          <EmptyState icon={Package} title="Nothing published in this category" />
        ) : (
          <div className={OPTION_STACK}>
            {items.map(item => (
              <ServiceItemOptionRow
                key={item.id}
                item={item}
                policy={policies.find(p => p.id === item.approvalPolicyId) || null}
                onPick={onPick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The service categories as the home page's browse grid. */
function ServiceCategoriesScreen({ categories, items, onPick }) {
  return (
    <section className={cx(WIDE, 'pb-16')}>
      <SectionHead
        eyebrow="Browse"
        title={DOOR.services.pageTitle}
        hint={DOOR.services.browseHint}
      />
      {categories.length === 0 ? (
        <EmptyState icon={ShoppingCart} title="No services published yet"
          hint="The service catalog is empty for your audience." />
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

/* ==================================================================== *
 * THE CONTAINED CARD
 *
 * v1's shape, in the new language: a fixed, blurred overlay; a centred card with
 * a pinned header (close left, title optically centred, spacer right, and the
 * breadcrumb trail beneath), a scrolling body whose reading column stays near 70
 * characters inside the wider card, and a pinned footer carrying Back and the
 * one primary action.
 *
 * IT HOLDS THE WHOLE DRILL, not just the leaf, so the frame must stay perfectly
 * still while its CONTENT changes. The card is therefore mounted for the life of
 * the journey and only <LeafLevel> is keyed — one continuous surface rather than
 * a stack of dialogs. Motion is per MOTION above: declared entry, held exit,
 * nothing at all under prefers-reduced-motion.
 *
 * It composes rather than reuses <Modal> for two reasons — the header is the v1
 * arrangement rather than the admin one, and the guide viewer wants the full
 * width of the card while prose does not. The dialog contract is the DS shell's,
 * implemented by useDialogShell: Escape closes, Tab is trapped, background
 * scroll is locked, focus returns to the opener.
 * ==================================================================== */

function LeafCard({ accent, eyebrow, title, subtitle, crumbs, onCrumb, wide, levelKey, onClose, returnFocusTo, footer, children }) {
  const { t, a } = useTheme();
  const c = a(accent);
  const trail = (crumbs || []).slice(0, -1);
  const reduced = usePrefersReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const exitTimer = useRef(null);

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

  /* Exit is the entry gesture reversed, and it has to FINISH before the state
   * that renders this card is torn down — hence the timer. It is cleared on
   * unmount so a card closed some other way never calls into a dead component. */
  const requestClose = () => {
    /* Reduced motion means NO motion: close immediately rather than running the
     * same animation faster. */
    if (reduced) { onClose(); return; }
    if (leaving) return;
    setLeaving(true);
    exitTimer.current = setTimeout(onClose, MOTION.exitMs);
  };

  const shell = useDialogShell(true, requestClose, levelKey, returnFocusTo);

  return createPortal(
    <div
      /* Clicking the backdrop dismisses, the way every modal in the app does.
         Guarded on the target so a drag that ends outside the card does not.
         Fading the overlay fades the blur with it, which is what makes the page
         behind appear to soften rather than to snap out of focus. */
      onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      className={cx('fixed inset-0 flex items-center justify-center p-4 backdrop-blur-sm overscroll-contain',
        t.overlay, LAYOUT.zModal,
        /* A card that is on its way out must not still take clicks. Without
           this the 160ms exit is a window in which Back, a breadcrumb or the
           footer action can still fire into a stack that is about to be
           thrown away. */
        !reduced && cx('transition-opacity duration-200 ease-out',
          leaving ? 'opacity-0 pointer-events-none' : 'opacity-100 starting:opacity-0'))}
    >
      <div
        ref={shell.ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cx('w-full max-w-4xl h-full max-h-[90vh] rounded-3xl border-2 shadow-2xl',
          'flex flex-col overflow-hidden outline-none', t.modal, c.borderStrong,
          !reduced && cx('transition-transform duration-200 ease-out',
            leaving ? 'scale-[0.97]' : 'scale-[1] starting:scale-[0.97]'))}
      >
        {/* PINNED HEADER. The close control sits left and a spacer of equal width
            sits right, so the title is optically centred rather than merely
            centred in whatever space is left over. The breadcrumb sits under it
            — this card holds a whole drill, so where you are has to be legible
            without leaving it. */}
        <header className={cx(DENSITY.modalHeaderPad, 'flex-shrink-0 border-b', t.border, c.soft)}>
          <div className="flex items-center gap-3">
            <span className="w-20 flex-shrink-0 flex justify-start">
              <IconButton icon={X} label="Close" onClick={requestClose} />
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
          </div>
          {/* The trail stops one short of where you are. The last crumb is always
              the level you are on, which the <h2> above already says — printing
              both put the same words twice in the same header. */}
          {trail.length > 0 && (
            <div className="mt-2.5 flex justify-center">
              <Breadcrumbs items={trail} onNavigate={(crumb) => onCrumb(crumb.id)} />
            </div>
          )}
        </header>

        <div ref={shell.bodyRef}
          className={cx('flex-1 min-h-0 overflow-auto overscroll-contain', DENSITY.modalBodyPad)}>
          <div className={cx('mx-auto w-full', wide ? 'max-w-3xl' : 'max-w-2xl')}>
            <LeafLevel key={levelKey} reduced={reduced}>{children}</LeafLevel>
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
 * ONE LEVEL'S CONTENT.
 *
 * Keyed by the level, so it mounts fresh and slides in while the frame around it
 * — border, header, footer — does not move at all. That is the difference
 * between drilling through one continuous surface and opening a stack of
 * dialogs, and it is the whole reason the card can hold the entire journey.
 *
 * THE ENTRY IS DECLARED, NOT DRIVEN. Its resting state is the VISIBLE one and
 * `starting:` supplies the frame to animate from, so a browser that never runs
 * the transition — an older engine, a throttled tab — still shows the content.
 * The obvious alternative, flipping a class on requestAnimationFrame, fails
 * exactly the wrong way: a frame that never arrives leaves a card that is open,
 * focused, scroll-locked and completely invisible.
 */
function LeafLevel({ reduced, children }) {
  if (reduced) return <div>{children}</div>;
  return (
    <div className="transition duration-200 ease-out opacity-100 translate-y-0 starting:opacity-0 starting:translate-y-2">
      {children}
    </div>
  );
}

/**
 * The footer is contextual, but its grammar never changes: a way back on the
 * left, the ONE primary action on the right. The gradient lives on that primary
 * action and nowhere else inside the card.
 */
function LeafFooter({ frame, onBack, onClose, backLabel, primary, resolve, onRequests, ticketId }) {
  const { t } = useTheme();

  /* Reading an atom: the resolve question rides the footer bar rather than
   * sitting in a card of its own above it. It is the one decision the reader has
   * to make, and it belongs with the other controls, not stacked on top of them. */
  if (frame?.type === 'atom' && resolve) {
    return (
      <>
        <Button variant="outline" icon={ArrowLeft} onClick={onBack}>{backLabel}</Button>
        <div className="flex items-center gap-3 min-w-0">
          <span className={cx('text-sm font-medium truncate', t.text)}>Did this resolve your issue?</span>
          <Button variant="solid" accent={statusMeta('resolved').hue} icon={ThumbsUp} onClick={resolve.onYes}>
            Yes, all done
          </Button>
          <Button variant="soft" accent={entityHue('ticket')} icon={ThumbsDown} onClick={resolve.onNo}>
            No, I need help
          </Button>
        </div>
      </>
    );
  }

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
      {primary && (
        <Button variant="grad" module="portal" size="lg" icon={primary.icon} onClick={primary.onClick}>
          {primary.label}
        </Button>
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
          />
          <div className={OPTION_STACK}>
            {atoms.map(k => <LeafAtomRow key={k.id} atom={k} onOpen={() => onAtom(k.id)} />)}
          </div>
        </section>
      )}

      {forms.length > 0 ? (
        <section>
          <LeafSectionHead
            eyebrow="Still stuck?"
            title={forms.length > 1 ? 'Tell us what you need' : 'Raise a request'}
          />
          {emphasise && (
            <Banner accent={entityHue('ticket')} icon={MessageSquare} title="Pick the intake that fits" className="mb-3" />
          )}
          <div className={OPTION_STACK}>
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
        <Banner accent="blue" icon={Info} title="No request form attached" />
      )}
    </div>
  );
}

/** A help resource, as a row. Format and read time both survive the revert. */
function LeafAtomRow({ atom, onOpen }) {
  const { a } = useTheme();
  const guide = atom.format === 'guide';
  const hue = entityHue(guide ? 'guide' : 'article');
  const c = a(hue);
  const slides = (atom.slides || []).length;

  return (
    <OptionRow
      icon={guide ? LayoutGrid : BookOpen}
      hue={hue}
      name={atom.title}
      secondary={atom.summary}
      meta={<>
        {guide && slides > 0 && <OptionFact icon={LayoutGrid}>{plural(slides, 'screen', 'screens')}</OptionFact>}
        {atom.minutes ? <OptionFact icon={Clock}>{atom.minutes} min read</OptionFact> : null}
        {atom.helpfulYes ? (
          <OptionFact icon={ThumbsUp} className={c.fg}>
            {atom.helpfulYes.toLocaleString()} found this helpful
          </OptionFact>
        ) : null}
      </>}
      trailing={<EntityTag kind={guide ? 'guide' : 'article'} />}
      onClick={onOpen}
    />
  );
}

/**
 * A request intake, as a row.
 *
 * The whole row is the control now — there is no separate Start button to aim
 * at — but the intake's own submit wording is kept as the trailing label, so
 * the row still says what pressing it will do. The queue and the policy stay
 * as VALUE chips: nobody should fill a form in to discover where it lands or
 * who has to sign it off.
 */
function LeafIntakeRow({ subform, queue, policy, emphasise, onStart }) {
  const { a } = useTheme();
  const c = a(entityHue('subform'));
  const fields = (subform.fields || []).length;
  const conditional = (subform.fields || []).filter(f => f.showIf).length;

  return (
    <OptionRow
      icon={FileQuestion}
      hue={entityHue('subform')}
      name={subform.name}
      secondary={subform.description}
      emphasise={emphasise}
      meta={<>
        {queue
          ? <Chip accent={queue.hue || entityHue('queue')} icon={Inbox} title={queue.description}>{queue.name}</Chip>
          : <Chip accent="amber" icon={Route}>Unrouted → General</Chip>}
        {policy && <Chip accent={entityHue('approval')} icon={Stamp} title={policy.description}>{policy.name}</Chip>}
        <span>{plural(fields, 'question', 'questions')}{conditional ? ` · ${conditional} conditional` : ''}</span>
      </>}
      trailing={<span className={cx('text-xs font-medium', c.fg)}>{subform.submitLabel || 'Start'}</span>}
      onClick={onStart}
    />
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
  /* The figure a spend policy will actually test — annualised, one-off plus
   * recurring — computed by the same function the approval and the smoke gate
   * use. Shown here because a $45 seat that trips a $500 sign-off is a surprise
   * only if we never said it was $540 a year. */
  const firstYear = Number(item.recurringPrice) ? fmtMoney(annualCost(item)) : null;

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
          note={recurring
            ? `then ${recurring}${firstYear ? ` · ${firstYear} across the first year` : ''}`
            : undefined} />
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
          />
          <div className={OPTION_STACK}>
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
              {conditional ? ` · ${conditional} conditional` : ''}
            </p>
          </div>
        </section>
      ) : (
        <Banner accent="amber" icon={CircleAlert} title="No request form attached — nothing to submit yet" />
      )}

      {item.assetModelId && (
        <Banner accent={entityHue('hardware')} icon={Laptop} title="Fulfilment creates an asset record in your name" />
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

/**
 * THE CUSTOMER-FACING READER SHOWS CUSTOMER-FACING THINGS.
 *
 * Three things that used to frame the article are gone from the portal: the
 * view count, the "what you will be able to do" objective, and the banner
 * naming the courses this atom is also a lesson in. All three are true and all
 * three are useful — to an author or to a learner. The person reading this is
 * neither: they arrived holding a problem and they are looking for the fix.
 * Those facts still live in the Knowledge and Learning modules, which is where
 * somebody is actually authoring or being taught.
 *
 * What stays is what helps a reader judge the answer in front of them: how long
 * it takes to read, when it was last touched, and how many people it worked for.
 */
function LeafReading({ atom }) {
  const { t } = useTheme();
  const guide = atom.format === 'guide';

  return (
    <div className="space-y-5">
      <div>
        <p className={cx('text-[15px] leading-relaxed', t.textSecondary)}>{atom.summary}</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {atom.minutes ? <Chip accent="slate" icon={Clock}>{atom.minutes} min read</Chip> : null}
          {atom.helpfulYes ? (
            <Chip accent={statusMeta('resolved').hue} icon={ThumbsUp}>
              {atom.helpfulYes.toLocaleString()} found this helpful
            </Chip>
          ) : null}
          {atom.updatedAt && <span className={cx('text-xs', t.textMuted)}>Updated {fmtWhen(atom.updatedAt)}</span>}
        </div>
      </div>

      {guide ? <GuideBody atom={atom} /> : <ArticleBody atom={atom} />}
    </div>
  );
}

/**
 * The academy still reads a lesson as a page — it is a course, not a leaf.
 *
 * Same rule as the card reader: this is still the portal, so the view count,
 * the objective panel and the "also a lesson in" banner are not here either.
 * The reader already knows they are in a course — the trail bar says so and the
 * footer below links back to it — and the lesson's objective is what the course
 * page prints under every lesson in the module list, which is where somebody
 * chooses what to read next.
 */
function ReadingScreen({ atom, fromCourse, onCourseBack }) {
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
          {atom.minutes ? <Chip accent="slate" icon={Clock}>{atom.minutes} min read</Chip> : null}
          {atom.helpfulYes ? (
            <Chip accent={statusMeta('resolved').hue} icon={ThumbsUp}>
              {atom.helpfulYes.toLocaleString()} found this helpful
            </Chip>
          ) : null}
          {atom.updatedAt && <span className={cx('text-xs', t.textMuted)}>Updated {fmtWhen(atom.updatedAt)}</span>}
        </>}
      />

      <div className={cx(guide ? WIDE : READ, 'pb-16 space-y-6')}>
        {guide ? <GuideBody atom={atom} /> : <ArticleBody atom={atom} />}

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
 * Guide — the carousel, and nobody's clock but the reader's.
 *
 * THE READER MOVES THEMSELVES. There is no timer here: no setTimeout, no
 * interval, no animation that advances anything, no armed or running state and
 * no reading of a slide's duration. A screen changes when a person asks for the
 * next one — an arrow, a dot, a click on either half of the media, or the
 * keyboard — and never otherwise.
 *
 * WHY THERE IS NO PAUSE CONTROL. WCAG 2.2.2 (pause, stop, hide) obliges any
 * automatically moving content to offer a way to stop it. That obligation was
 * real when this player advanced on its own, and it is why the old version
 * carried a pause button, a segmented progress bar and a press-and-hold
 * gesture. With the timer gone the success criterion does not apply — there is
 * nothing to pause — so the control is REMOVED rather than left on screen as
 * chrome that stops nothing. Leaving a dead pause button would be the worse
 * outcome of the two: a control that lies about what it does.
 *
 * WHAT WAS NEVER ABOUT THE TIMER, AND SO STAYS: alt text on every image,
 * full keyboard control (Left/Right step, Home/End jump) with a visible focus
 * state, an aria-live announcement of the position, and "Read as text", which
 * renders the same slides as a static captioned sequence with the alt text
 * written out — the accessible equivalent, not a lesser version.
 *
 * `seconds` is still on the slide model and still in the seed. This viewer
 * simply never reads it.
 * ==================================================================== */

function GuideBody({ atom }) {
  const { t } = useTheme();
  const [asText, setAsText] = useState(false);
  const slides = atom.slides || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className={cx('text-sm', t.textMuted)}>
          {plural(slides.length, 'screen', 'screens')}
        </span>
        <Button
          variant={asText ? 'solid' : 'soft'}
          accent={entityHue('guide')}
          size="sm"
          icon={asText ? LayoutGrid : AlignLeft}
          onClick={() => setAsText(v => !v)}
        >
          {asText ? 'Back to the screens' : 'Read as text'}
        </Button>
      </div>

      {asText ? <GuideAsText atom={atom} /> : <CarouselViewer atom={atom} />}
    </div>
  );
}

function GuideAsText({ atom }) {
  const { t } = useTheme();
  return (
    <div className={cx('rounded-2xl border p-5 sm:p-6', t.portalCard)}>
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

/**
 * THE CAROUSEL. v1's shape, restored whole.
 *
 * A 16:9 media box, one screen at a time, with round chevrons at the edges, a
 * "3 / 5" counter, the caption underneath and dots below that. Either half of
 * the media is also a click target, which is the one Stories habit worth
 * keeping — it costs nothing and it is what a thumb reaches for.
 *
 * Moving is the reader's job in every mode: `step` is called from the arrows,
 * the dots, the half-clicks and the keyboard, and from nowhere else. There is
 * no effect in this component and no timer anywhere in this file.
 *
 * Stepping wraps, as v1 did, so neither arrow is ever a dead control.
 */
function CarouselViewer({ atom }) {
  const { t, a } = useTheme();
  const c = a(entityHue('guide'));
  const slides = atom.slides || [];
  const [index, setIndex] = useState(0);

  if (!slides.length) {
    return (
      <div className={cx('rounded-2xl border aspect-video flex items-center justify-center text-sm text-center p-6',
        t.bgSubtle, t.borderLight, t.textMuted)}>
        This guide has no screens yet.
      </div>
    );
  }

  const at = Math.min(index, slides.length - 1);
  const slide = slides[at];
  const many = slides.length > 1;
  const step = (dir) => setIndex(i => (i + dir + slides.length) % slides.length);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setIndex(0); }
    else if (e.key === 'End') { e.preventDefault(); setIndex(slides.length - 1); }
  };

  return (
    <div className="space-y-3">
      {/* THE MEDIA. `object-contain` rather than cover: a guide screenshot that
          has been cropped to fit a box is a guide screenshot with the thing it
          was pointing at cut off. */}
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={`${atom.title} — screen ${at + 1} of ${slides.length}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cx('relative rounded-2xl overflow-hidden border-2 aspect-video focus:outline-none',
          t.bgSubtle, t.borderLight, c.ring)}
      >
        {slide.type === 'image' && slide.url && (
          <img src={slide.url} alt={slide.alt || ''} className="absolute inset-0 w-full h-full object-contain" />
        )}

        {/* A TEXT SCREEN IS STILL A SCREEN, and every guide in this catalog
            ends on one — “You are back in”, “Add a backup method”. With no
            media to show, the frame would otherwise be a blank rectangle, so
            the screen renders as a tinted card carrying its own heading. That
            is why the heading is not repeated in the caption below. The same
            branch catches an image screen whose file is missing, because seed
            data must never blank the frame. */}
        {(slide.type === 'text' || (slide.type === 'image' && !slide.url)) && (
          <div className={cx('absolute inset-0 flex items-center justify-center text-center p-6 sm:p-10', c.softStrong)}>
            <p className={cx('text-xl sm:text-2xl font-semibold tracking-tight text-balance', t.text)}>
              {slide.heading || `Screen ${at + 1}`}
            </p>
          </div>
        )}

        {/* A VIDEO SCREEN IS A PLACEHOLDER NAMING WHAT THE CLIP SHOWS, which
            is how Knowledge and Learning render one too. A real <video> here
            would be a control that cannot be operated: the two half-width
            click targets sit above it, so its own play button is unreachable,
            and the seeded clips point at a domain that does not resolve. The
            description is the slide's alt text, so the screen still says what
            it contains rather than showing a dead player. */}
        {slide.type === 'video' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-center p-6">
            <IconTile icon={Video} accent={entityHue('guide')} size="lg" />
            <p className={cx('text-xs max-w-sm leading-relaxed', t.textMuted)}>
              {slide.alt || 'This screen is a video clip.'}
            </p>
          </div>
        )}

        {many && (
          <>
            {/* The halves are the convenience target; the round buttons below
                are the real, labelled, tabbable controls. The halves are hidden
                from assistive tech so the same two actions are not announced
                twice. */}
            <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => step(-1)}
              className="absolute inset-y-0 left-0 w-1/2 z-10 cursor-w-resize" />
            <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => step(1)}
              className="absolute inset-y-0 right-0 w-1/2 z-10 cursor-e-resize" />

            <button
              onClick={() => step(-1)}
              aria-label="Previous screen"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/55 text-white shadow-lg transition-colors hover:bg-black/75 focus:outline-none focus-visible:bg-black/85"
            >
              <ChevronLeft size={ICON.lg} />
            </button>
            <button
              onClick={() => step(1)}
              aria-label="Next screen"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/55 text-white shadow-lg transition-colors hover:bg-black/75 focus:outline-none focus-visible:bg-black/85"
            >
              <ChevronRight size={ICON.lg} />
            </button>

            <span aria-hidden
              className="absolute top-3 right-3 z-20 px-2 py-0.5 rounded-full bg-black/55 text-white text-[11px] font-medium tabular-nums">
              {at + 1} / {slides.length}
            </span>
          </>
        )}
      </div>

      {/* THE CAPTION SITS UNDER THE MEDIA, where it can be read at full size in
          the page's own colours rather than laid over an image in white. */}
      {((slide.heading && slide.type !== 'text') || slide.caption) && (
        <div className={cx('text-center mx-auto', PROSE)}>
          {slide.heading && slide.type !== 'text' && (
            <p className={cx('text-base font-semibold leading-snug', t.text)}>{slide.heading}</p>
          )}
          {slide.caption && (
            <div
              className={cx('rhq-prose text-sm mt-1 leading-relaxed', t.textSecondary)}
              dangerouslySetInnerHTML={{ __html: slide.caption }}
            />
          )}
        </div>
      )}

      {many && (
        <div className="flex items-center justify-center gap-2 pt-1">
          {slides.map((sl, i) => (
            <button
              key={sl.id}
              onClick={() => setIndex(i)}
              aria-label={`Screen ${i + 1}${sl.heading ? ` — ${sl.heading}` : ''}`}
              aria-current={i === at ? 'true' : undefined}
              /* A dot is six pixels wide, so its focus state has to sit
                 OUTSIDE it. The outline takes its colour from currentColor —
                 `c.fg` here — which is how an accent gets onto an outline
                 without interpolating a class name that would compile to
                 nothing. Suppressing focus without replacing it, which is
                 what a bare `focus:outline-none` does, would leave the dots
                 keyboard-reachable and invisible. */
              className={cx('h-1.5 rounded-full transition-all',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current', c.fg,
                i === at ? cx('w-6', GRADIENT.brandBar) : cx('w-1.5', t.trackOff, 'hover:opacity-70'))}
            />
          ))}
        </div>
      )}

      {many && (
        <p className={cx('text-[11px] text-center', t.textMuted)}>
          Use the arrows, the dots, either half of the picture, or your arrow keys.
        </p>
      )}

      {/* The position, the heading and — for any screen carrying media — its
          description, so a screen reader hears the same thing a sighted
          reader sees. Video screens describe themselves here too; only a text
          screen has nothing beyond its heading to add. */}
      <span className="sr-only" aria-live="polite">
        Screen {at + 1} of {slides.length}. {slide.heading || ''} {slide.type === 'text' ? '' : slide.alt || ''}
      </span>
    </div>
  );
}

/* ==================================================================== *
 * Did this resolve it?
 * ==================================================================== */

function LeafResolved({ atom }) {
  const { t, a } = useTheme();
  const c = a(statusMeta('resolved').hue);
  return (
    <div className="py-6 text-center">
      <span className={cx('inline-flex w-16 h-16 rounded-full items-center justify-center mb-5', c.softStrong)}>
        <CircleCheck size={32} className={c.fg} />
      </span>
      <h3 className={cx('text-2xl font-semibold tracking-tight', t.text)}>Glad that sorted it.</h3>
      {atom.helpfulYes ? (
        <p className={cx('text-sm mt-4', t.textMuted)}>
          {atom.helpfulYes.toLocaleString()} other people have marked this article helpful.
        </p>
      ) : null}
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
          {queue.description}
          {policy && (declaredApproval
            ? <> Approval required: <strong className={t.text}>{policy.name}</strong>.</>
            : <> May need approval: <strong className={t.text}>{policy.name}</strong>.</>)}
        </Banner>
      ) : (
        <Banner accent="amber" icon={CircleAlert} title="No routing configured on this form">
          Requests from here land in the <strong className={t.text}>{defaultQueue?.name || 'General'}</strong> queue.
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
          Attachments are collected here.
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
          It went to <strong className={t.text}>{queue?.name || 'General'}</strong> and will be triaged from there.
        </Banner>
      ) : (
        <Banner accent="blue" icon={Route} title={`Routed to ${queue?.name || 'a queue'}`}>
          {queue?.description}
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
            <>This stage resolved to nobody, so it is flagged in the Approvals module.</>
          )}
        </Banner>
      )}

      {!approval && receipt.policyName && (
        <Banner accent="slate" icon={Info} title="No approval needed">
          The <strong className={t.text}>{receipt.policyName}</strong> policy is attached, but your answers did not
          meet its conditions.
        </Banner>
      )}

      {receipt.delivery && (
        <Banner accent={entityHue('item')} icon={Truck} title={receipt.delivery}>
          {receipt.price && receipt.price !== 'No charge'
            ? `${receipt.price} for the first year, charged to your cost centre on fulfilment.`
            : null}
          {approval && ' The clock starts when the approval clears.'}
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
          ? `Everything ${requester.name} has raised through this portal.`
          : 'Everything you have raised through this portal.'}
      />

      <div className={cx(WIDE, 'pb-16 space-y-10')}>
        <section>
          {tickets.length === 0 ? (
            <EmptyState icon={Inbox} title="Nothing open"
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
              hint="Colleagues on the same account."
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

function RequestRow({ ticket, queue, muted, blocked, onOpen }) {
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
        {/* The other sense of "my approvals": not one waiting on me, but one
            holding up something I asked for. It belongs on the ticket row, not
            in a second list — the question is "is my thing moving". */}
        <span className={cx('block text-xs truncate', t.textMuted)}>
          {blocked
            ? `${ticket.key} · waiting on an approval`
            : `${ticket.key} · ${queue?.name || 'Unrouted'} · raised ${fmtWhen(ticket.createdAt)}`}
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
            hint={`${plural(courses.length, 'course is', 'courses are')} open to customers.`}
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

function CourseScreen({ course, byKb, onLesson }) {
  const { t } = useTheme();
  const minutes = courseMinutes(course, byKb);

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
  onHelp, onServices, onRequests, onAcademy,
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
          {form.description && (
            <p className={cx('mt-4 text-sm leading-relaxed max-w-sm', t.textSecondary)}>{form.description}</p>
          )}
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
          </ul>
        </nav>

        <div>
          <p className={cx('text-[11px] font-semibold uppercase tracking-[0.14em] mb-3', t.textMuted)}>Signing in</p>
          <p className={cx('text-sm leading-relaxed', t.textSecondary)}>
            {form.requireSignIn ? (
              <>
                This portal requires an {external ? 'account' : `${orgName}`} sign-in.
                {requester && <> You are signed in as <strong className={t.text}>{requester.name}</strong>.</>}
              </>
            ) : (
              <>
                Anyone can read and search without signing in. A sign-in is only asked for when you raise a request.
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

