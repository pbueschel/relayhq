// RelayHQ design tokens.
//
// This file is the single source of truth for surface, text, border and entity
// colour. It is a direct extraction of the visual language already established in
// the v1 prototype — not a redesign. If a value here differs from v1 it is because
// v1 had two spellings of the same intent and this file picked one.
//
// THE RULE: no component hardcodes a grey, and no component builds a colour class
// by interpolation. Surfaces come from `theme()`, accents come from `accents.js`.

import { ACCENTS, ACCENT_HUES, accent, accentSet } from './accents.js';

export { ACCENTS, ACCENT_HUES, accent, accentSet };

/* ------------------------------------------------------------------ *
 * Surfaces
 * ------------------------------------------------------------------ */

const LIGHT = {
  // page + chrome
  bg: 'bg-gray-50',
  bgSidebar: 'bg-white',
  bgCard: 'bg-white',
  bgInput: 'bg-white',
  bgSubtle: 'bg-gray-100',
  bgHover: 'hover:bg-gray-100',
  bgActive: 'bg-gray-100',

  // text
  text: 'text-gray-900',
  textSecondary: 'text-gray-600',
  textMuted: 'text-gray-500',
  textInverse: 'text-white',

  // lines
  border: 'border-gray-200',
  borderLight: 'border-gray-300',
  divide: 'divide-gray-200',
  rule: 'bg-gray-300',            // a drawn divider line
  ringOnBg: 'border-white',       // avatar/badge ring that matches the page behind it

  // floating chrome that sits above the page (collapse handles, popovers)
  floatBg: 'bg-white',
  floatBorder: 'border-gray-200',
  trackOff: 'bg-gray-300',        // switch track, unchecked

  // overlays
  modal: 'bg-white',
  overlay: 'bg-black/50',

  // end-user portal surfaces (deliberately softer than the admin app)
  portalBg: 'bg-gradient-to-br from-gray-100/95 via-purple-100/80 to-gray-100/95 backdrop-blur-xl',
  portalCard: 'bg-white border-gray-200 hover:bg-gray-50',
  portalInput: 'bg-white border-gray-300',

  // canvas (automation workspace)
  canvasBg: 'bg-gray-100',
  canvasGrid: '#d4d4d8',
  canvasEdge: '#a1a1aa',
};

const DARK = {
  bg: 'bg-gray-950',
  bgSidebar: 'bg-gray-900/50',
  bgCard: 'bg-gray-800/50',
  bgInput: 'bg-gray-800',
  bgSubtle: 'bg-gray-800/60',
  bgHover: 'hover:bg-white/5',
  bgActive: 'bg-white/5',

  text: 'text-white',
  textSecondary: 'text-gray-400',
  textMuted: 'text-gray-500',
  textInverse: 'text-gray-900',

  border: 'border-gray-800/50',
  borderLight: 'border-gray-700/50',
  divide: 'divide-gray-800/50',
  rule: 'bg-gray-700',
  ringOnBg: 'border-gray-950',

  floatBg: 'bg-gray-800',
  floatBorder: 'border-gray-700',
  trackOff: 'bg-gray-700',

  modal: 'bg-gray-900',
  overlay: 'bg-black/80',

  portalBg: 'bg-gradient-to-br from-gray-950/95 via-purple-950/80 to-gray-950/95 backdrop-blur-xl',
  portalCard: 'bg-white/5 border-white/10 hover:bg-white/10',
  portalInput: 'bg-white/5 border-white/10',

  canvasBg: 'bg-gray-900',
  canvasGrid: '#3f3f46',
  canvasEdge: '#71717a',
};

/** Resolve the surface token set for a mode. `t` throughout the app is this object. */
export function theme(dark) {
  return dark ? DARK : LIGHT;
}

/* ------------------------------------------------------------------ *
 * Entity colour language
 *
 * This is the load-bearing convention of the product: every entity type has
 * exactly one hue, used everywhere it appears — sidebar, list row rail, chip,
 * modal border, icon tile. A reader learns the colour once and it never lies.
 *
 * v1 established: ticket=rose, personal task=teal, project task/project=violet,
 * KB=blue, form/subform=purple, product=amber, subcategory=purple, item=emerald,
 * hardware=cyan, software=purple/pink, location=emerald.
 *
 * New in v2 (chosen to stay distinct from every hue already spoken for):
 *   problem=fuchsia, change=orange, approval=amber, automation=sky,
 *   release=indigo, software resolved to pink (its v1 gradient partner).
 * ------------------------------------------------------------------ */

export const ENTITIES = {
  // --- service management ---
  ticket:       { hue: 'rose',    label: 'Ticket',        icon: 'Inbox' },
  incident:     { hue: 'rose',    label: 'Incident',      icon: 'Inbox' },
  conversation: { hue: 'rose',    label: 'Conversation',  icon: 'MessageSquare' },
  problem:      { hue: 'fuchsia', label: 'Problem',       icon: 'AlertOctagon' },
  change:       { hue: 'orange',  label: 'Change',        icon: 'GitBranch' },
  release:      { hue: 'slate',   label: 'Release',       icon: 'Rocket' },
  approval:     { hue: 'amber',   label: 'Approval',      icon: 'Stamp' },

  // --- external customer service ---
  // RelayHQ serves an internal helpdesk AND a company supporting its own
  // customers. These are the records the external mode needs that the
  // internal mode gets from a corporate directory.
  contact:      { hue: 'green',   label: 'Contact',       icon: 'User' },
  organization: { hue: 'slate',   label: 'Organization',  icon: 'Building2' },

  // --- work management ---
  task:         { hue: 'teal',    label: 'Task',          icon: 'CheckSquare' },
  projectTask:  { hue: 'violet',  label: 'Project task',  icon: 'CheckSquare' },
  project:      { hue: 'violet',  label: 'Project',       icon: 'Briefcase' },
  milestone:    { hue: 'amber',   label: 'Milestone',     icon: 'Flag' },

  // --- catalog ---
  product:      { hue: 'amber',   label: 'Product',       icon: 'Folder' },
  subcategory:  { hue: 'purple',  label: 'Subcategory',   icon: 'Layers' },
  item:         { hue: 'emerald', label: 'Item',          icon: 'Circle' },

  // --- content + intake ---
  // Knowledge atoms are blue. This hue is deliberately reused by `lesson`
  // below: a lesson IS a knowledge atom, and the colour says so.
  article:      { hue: 'blue',    label: 'Article',       icon: 'BookOpen' },
  guide:        { hue: 'purple',  label: 'Guide',         icon: 'LayoutGrid' },
  form:         { hue: 'purple',  label: 'Form',          icon: 'FileText' },
  subform:      { hue: 'purple',  label: 'Request form',  icon: 'FileQuestion' },

  // --- learning ---
  // The whole learning domain is indigo, EXCEPT `lesson`, which stays blue
  // because a lesson is the same knowledge atom that serves the help centre.
  // The colour scheme is the product thesis made visible: author once, and
  // the atom keeps its identity wherever it is used.
  curriculum:   { hue: 'indigo',  label: 'Curriculum',    icon: 'GraduationCap' },
  course:       { hue: 'indigo',  label: 'Course',        icon: 'BookMarked' },
  courseModule: { hue: 'indigo',  label: 'Module',        icon: 'Layers' },
  lesson:       { hue: 'blue',    label: 'Lesson',        icon: 'BookOpen' },
  quiz:         { hue: 'amber',   label: 'Check',         icon: 'ListChecks' },
  enrollment:   { hue: 'indigo',  label: 'Enrollment',    icon: 'UserCheck' },
  certificate:  { hue: 'amber',   label: 'Certificate',   icon: 'Award' },

  // --- assets ---
  hardware:     { hue: 'cyan',    label: 'Hardware',      icon: 'Monitor' },
  software:     { hue: 'pink',    label: 'Software',      icon: 'Key' },
  location:     { hue: 'emerald', label: 'Location',      icon: 'MapPin' },
  contract:     { hue: 'lime',    label: 'Contract',      icon: 'FileSignature' },

  // --- rules + automation ---
  queue:        { hue: 'gray',    label: 'Queue',         icon: 'Inbox' },
  rule:         { hue: 'rose',    label: 'Business rule', icon: 'Filter' },
  automation:   { hue: 'sky',     label: 'Automation',    icon: 'Workflow' },
};

/** Hue for an entity kind, falling back to neutral. */
export function entityHue(kind) {
  return ENTITIES[kind]?.hue || 'gray';
}

/** Full accent class set for an entity kind in a mode. */
export function entityAccent(kind, dark) {
  return accentSet(entityHue(kind), dark);
}

/* ------------------------------------------------------------------ *
 * Status + priority
 *
 * Status hues are shared across ticket / task / change so a colour means the
 * same thing regardless of what record you are looking at.
 * ------------------------------------------------------------------ */

export const STATUS = {
  // generic work states
  todo:         { hue: 'gray',    label: 'To Do',        group: 'open' },
  open:         { hue: 'blue',    label: 'Open',         group: 'open' },
  new:          { hue: 'blue',    label: 'New',          group: 'open' },
  in_progress:  { hue: 'amber',   label: 'In Progress',  group: 'active' },
  blocked:      { hue: 'red',     label: 'Blocked',      group: 'active' },
  on_hold:      { hue: 'slate',   label: 'On Hold',      group: 'active' },
  pending:      { hue: 'amber',   label: 'Pending',      group: 'active' },
  review:       { hue: 'violet',  label: 'In Review',    group: 'active' },
  resolved:     { hue: 'emerald', label: 'Resolved',     group: 'done' },
  completed:    { hue: 'emerald', label: 'Completed',    group: 'done' },
  closed:       { hue: 'gray',    label: 'Closed',       group: 'closed' },
  cancelled:    { hue: 'gray',    label: 'Cancelled',    group: 'closed' },

  // approval states
  awaiting:     { hue: 'amber',   label: 'Awaiting',     group: 'active' },
  approved:     { hue: 'emerald', label: 'Approved',     group: 'done' },
  rejected:     { hue: 'red',     label: 'Rejected',     group: 'closed' },
  skipped:      { hue: 'gray',    label: 'Skipped',      group: 'closed' },
  expired:      { hue: 'orange',  label: 'Expired',      group: 'closed' },

  // change states (ITIL-shaped)
  assess:       { hue: 'blue',    label: 'Assess',       group: 'open' },
  authorize:    { hue: 'amber',   label: 'Authorize',    group: 'active' },
  scheduled:    { hue: 'violet',  label: 'Scheduled',    group: 'active' },
  implement:    { hue: 'orange',  label: 'Implement',    group: 'active' },
  // `review` and `closed` reused above

  // problem states
  investigating:{ hue: 'amber',   label: 'Investigating', group: 'active' },
  known_error:  { hue: 'orange',  label: 'Known Error',   group: 'active' },

  // asset lifecycle
  in_stock:     { hue: 'blue',    label: 'In Stock',      group: 'open' },
  deployed:     { hue: 'emerald', label: 'Deployed',      group: 'active' },
  in_repair:    { hue: 'amber',   label: 'In Repair',     group: 'active' },
  in_transit:   { hue: 'violet',  label: 'In Transit',    group: 'active' },
  retired:      { hue: 'gray',    label: 'Retired',       group: 'closed' },
  lost:         { hue: 'red',     label: 'Lost / Stolen', group: 'closed' },

  // automation run states
  success:      { hue: 'emerald', label: 'Success',       group: 'done' },
  error:        { hue: 'red',     label: 'Error',         group: 'closed' },
  running:      { hue: 'sky',     label: 'Running',       group: 'active' },
  waiting:      { hue: 'amber',   label: 'Waiting',       group: 'active' },

  // learning progress states
  not_started:  { hue: 'gray',    label: 'Not started',   group: 'open' },
  enrolled:     { hue: 'blue',    label: 'Enrolled',      group: 'open' },
  in_lesson:    { hue: 'amber',   label: 'In progress',   group: 'active' },
  passed:       { hue: 'emerald', label: 'Passed',        group: 'done' },
  failed:       { hue: 'red',     label: 'Failed',        group: 'closed' },
  certified:    { hue: 'amber',   label: 'Certified',     group: 'done' },
  overdue:      { hue: 'red',     label: 'Overdue',       group: 'active' },

  // publication states shared by knowledge, courses and forms
  draft:        { hue: 'gray',    label: 'Draft',         group: 'open' },
  published:    { hue: 'emerald', label: 'Published',     group: 'done' },
  archived:     { hue: 'slate',   label: 'Archived',      group: 'closed' },
};

/* SLA / CSAT — external customer service only. */
export const SLA_STATE = {
  ok:       { hue: 'emerald', label: 'Within target' },
  at_risk:  { hue: 'amber',   label: 'At risk' },
  breached: { hue: 'red',     label: 'Breached' },
  paused:   { hue: 'slate',   label: 'Paused' },
};

export const CSAT = {
  great: { hue: 'emerald', label: 'Great',    score: 5 },
  good:  { hue: 'lime',    label: 'Good',     score: 4 },
  ok:    { hue: 'amber',   label: 'OK',       score: 3 },
  bad:   { hue: 'orange',  label: 'Bad',      score: 2 },
  awful: { hue: 'red',     label: 'Awful',    score: 1 },
};

export function statusMeta(key) {
  return STATUS[key] || { hue: 'gray', label: String(key || 'Unknown'), group: 'open' };
}

export const PRIORITY = {
  urgent: { hue: 'red',    label: 'Urgent', rank: 4 },
  high:   { hue: 'orange', label: 'High',   rank: 3 },
  medium: { hue: 'amber',  label: 'Medium', rank: 2 },
  low:    { hue: 'gray',   label: 'Low',    rank: 1 },
};

export function priorityMeta(key) {
  return PRIORITY[key] || PRIORITY.medium;
}

/* ------------------------------------------------------------------ *
 * Density
 *
 * v1's standing preference: information density over whitespace. Padding, icon
 * sizes and card heights were tightened repeatedly. These constants freeze the
 * end state of that tightening so new surfaces start dense instead of drifting
 * back to roomy and needing another pass.
 * ------------------------------------------------------------------ */

export const DENSITY = {
  // vertical rhythm between sibling rows in a dense list
  rowGap: 'space-y-1.5',
  // standard interior padding for a card / panel
  cardPad: 'p-4',
  // a dense list row
  rowPad: 'px-3 py-2.5',
  // a section header inside a panel
  sectionPad: 'px-4 py-3',
  // modal regions
  modalHeaderPad: 'p-5',
  modalBodyPad: 'p-5',
  modalFooterPad: 'p-4',
};

/** Icon sizes. v1 settled on 14 for inline, 16-18 for headers, 20 for tiles. */
export const ICON = {
  xs: 11,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  tile: 24,
  empty: 40,
};

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

export const LAYOUT = {
  /** Centre the content, cap the width — wide viewports get balanced margins. */
  contentWidth: 'max-w-5xl mx-auto',
  contentWide: 'max-w-7xl mx-auto',
  contentNarrow: 'max-w-2xl mx-auto',
  /** Standard modal shell sizes. */
  modalSm: 'max-w-md',
  modalMd: 'max-w-2xl',
  modalLg: 'max-w-3xl',
  modalXl: 'max-w-4xl',
  /** Nested modals sit above their parent's overflow. */
  zModal: 'z-50',
  zNestedModal: 'z-[110]',
  zPalette: 'z-[200]',
  zPortal: 'z-[9999]',
};

/* ------------------------------------------------------------------ *
 * Avatars — deterministic gradient per person so the same name is always
 * the same colour across every view.
 * ------------------------------------------------------------------ */

const AVATAR_GRADIENTS = [
  'from-rose-400 to-orange-400',
  'from-amber-400 to-yellow-400',
  'from-emerald-400 to-teal-400',
  'from-cyan-400 to-blue-400',
  'from-blue-400 to-indigo-400',
  'from-violet-400 to-purple-400',
  'from-purple-400 to-pink-400',
  'from-pink-400 to-rose-400',
  'from-teal-400 to-cyan-400',
  'from-lime-400 to-emerald-400',
];

export function avatarGradient(name) {
  const s = String(name || '?');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* ------------------------------------------------------------------ *
 * Signature gradients — used sparingly, only where v1 used them.
 * ------------------------------------------------------------------ */

export const GRADIENT = {
  brand: 'bg-gradient-to-br from-purple-500 to-amber-500',
  brandBar: 'bg-gradient-to-r from-purple-500 to-amber-500',
  workspace: 'bg-gradient-to-br from-teal-500 to-cyan-500',
  workspaceBar: 'bg-gradient-to-r from-teal-500 to-cyan-500',
  projects: 'bg-gradient-to-br from-violet-500 to-purple-500',
  projectsBar: 'bg-gradient-to-r from-violet-500 to-purple-500',
  rules: 'bg-gradient-to-r from-rose-500 to-orange-500',
  rulesBr: 'bg-gradient-to-br from-rose-500 to-orange-500',
  hardware: 'bg-gradient-to-r from-cyan-500 to-blue-500',
  hardwareBr: 'bg-gradient-to-br from-cyan-500 to-blue-500',
  software: 'bg-gradient-to-r from-purple-500 to-pink-500',
  learning: 'bg-gradient-to-br from-indigo-500 to-violet-500',
  learningBar: 'bg-gradient-to-r from-indigo-500 to-violet-500',
  guide: 'bg-gradient-to-r from-purple-500 to-amber-500',
};

/**
 * MODULE GRADIENT — which signature gradient a module owns.
 *
 * v1 assigned a gradient per area and used it for the module's header tile and
 * its primary action. The rebuild kept the hue assignments but flattened the
 * treatment, so this map exists to make the gradient a first-class role rather
 * than something each view remembers to pass. `Button variant="grad"` and
 * `PageHeader` both read it.
 */
export const MODULE_GRADIENT = {
  workspace:   { tile: GRADIENT.workspace,  bar: GRADIENT.workspaceBar },
  projects:    { tile: GRADIENT.projects,   bar: GRADIENT.projectsBar },
  approvals:   { tile: GRADIENT.rulesBr,    bar: GRADIENT.rules },
  changes:     { tile: GRADIENT.rulesBr,    bar: GRADIENT.rules },
  problems:    { tile: GRADIENT.rulesBr,    bar: GRADIENT.rules },
  catalog:     { tile: GRADIENT.brand,      bar: GRADIENT.brandBar },
  knowledge:   { tile: GRADIENT.brand,      bar: GRADIENT.brandBar },
  learning:    { tile: GRADIENT.learning,   bar: GRADIENT.learningBar },
  forms:       { tile: GRADIENT.brand,      bar: GRADIENT.brandBar },
  rules:       { tile: GRADIENT.rulesBr,    bar: GRADIENT.rules },
  automations: { tile: GRADIENT.hardwareBr, bar: GRADIENT.hardware },
  assets:      { tile: GRADIENT.hardwareBr, bar: GRADIENT.hardware },
  portal:      { tile: GRADIENT.brand,      bar: GRADIENT.brandBar },
  design:      { tile: GRADIENT.brand,      bar: GRADIENT.brandBar },
};

export function moduleGradient(key, role = 'tile') {
  return (MODULE_GRADIENT[key] || MODULE_GRADIENT.catalog)[role];
}

/**
 * ACTIVE TINT — the soft gradient behind a selected nav item or tree row.
 *
 * v1 used the `-100` pair in light mode and a `/20` alpha pair in dark, always
 * with a matching border. Both spellings are literal here so Tailwind sees them.
 */
export const TINT = {
  workspace: {
    light: 'bg-gradient-to-r from-teal-100 to-cyan-100 border-teal-300',
    dark:  'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border-teal-500/30',
  },
  projects: {
    light: 'bg-gradient-to-r from-violet-100 to-purple-100 border-violet-300',
    dark:  'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/30',
  },
  catalog: {
    light: 'bg-gradient-to-r from-purple-100 to-amber-100 border-purple-300',
    dark:  'bg-gradient-to-r from-purple-500/20 to-amber-500/20 border-purple-500/30',
  },
  rules: {
    light: 'bg-gradient-to-r from-rose-100 to-orange-100 border-rose-300',
    dark:  'bg-gradient-to-r from-rose-500/20 to-orange-500/20 border-rose-500/30',
  },
  assets: {
    light: 'bg-gradient-to-r from-cyan-100 to-blue-100 border-cyan-300',
    dark:  'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
  },
  learning: {
    light: 'bg-gradient-to-r from-indigo-100 to-violet-100 border-indigo-300',
    dark:  'bg-gradient-to-r from-indigo-500/20 to-violet-500/20 border-indigo-500/30',
  },
  knowledge: {
    light: 'bg-gradient-to-r from-blue-100 to-indigo-100 border-blue-300',
    dark:  'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-blue-500/30',
  },
};

export function tint(key, dark) {
  const spec = TINT[key] || TINT.catalog;
  return dark ? spec.dark : spec.light;
}

/**
 * HEADER WASH — the vertical fade v1 laid under every module header.
 * Subtle in light; in dark it lifts the header off the near-black ground.
 */
export const HEAD_WASH = {
  light: 'bg-gradient-to-b from-gray-50 to-transparent',
  dark:  'bg-gradient-to-b from-gray-900/60 to-transparent',
};

export function headWash(dark) {
  return dark ? HEAD_WASH.dark : HEAD_WASH.light;
}
