import React, { useMemo, useState } from 'react';
import {
  GitBranch, ShieldCheck, Siren, Plus, Scale, Stamp, CalendarCheck, Hammer,
  ClipboardCheck, CircleCheck, CircleX, TriangleAlert, Undo2, Snowflake,
  CalendarDays, List, Columns3, ChevronLeft, ChevronRight, Clock, Link2,
  Ban, CornerDownRight, Package, Server, User, Trash2, Check, X, ArrowRight,
  Info, Pencil, ExternalLink, FlaskConical, RotateCcw, Inbox, OctagonAlert,
  CircleAlert, Boxes, ShieldAlert, Gauge, Route, MessageSquareText,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, ENTITIES, statusMeta,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, EntityTag,
  Avatar, EmptyState, Card, Panel, Section, GroupLabel, ListRow, Banner, Divider,
  Field, Input, Textarea, Select, TileGroup, SearchInput,
  Modal, ConfirmDelete, Menu, MenuItem, MenuLabel, MenuDivider,
  ViewSwitcher, PageHeader, PageBody, Breadcrumbs,
  ModuleHeader, ScopedSearch, FilterBar, subsetLabel, optionCounts, passes,
} from '@/ds';
import { useStore, patchIn, addTo, removeFrom, uid, NOW } from '@/store/store.js';
import { startApproval, decide, progress, describeApprover } from '@/lib/approvals.js';
import { navigate } from '@/lib/router.js';
import { POL, USR } from '@/store/seed/ids.js';

/**
 * Change management — ITIL-shaped change enablement.
 *
 * The module exists to answer four questions about every change, in this order:
 *   1. What kind of change is this?      → three types with genuinely different journeys
 *   2. How dangerous is it?              → a questionnaire that DERIVES risk, shown working
 *   3. Who said yes?                     → a real approval run through @/lib/approvals.js
 *   4. When can it safely happen?        → a calendar with freeze windows and conflict detection
 *
 * `state.changes` is authored in src/store/seed/service.js by another module,
 * and THAT FILE OWNS THE FIELD NAMES. This view adapts to them in `normalize()`
 * rather than inventing its own: `ownerId`/`implementerId` are the people,
 * `affectedCatalogItemIds`/`affectedServices`/`affectedLocationIds` are what a
 * change touches, `linkedTicketIds`/`linkedProblemIds` are its links, `pir` is
 * the post-implementation review, and `riskAnswers` carries the eight keys the
 * seed documents. Everything is read defensively — a change with no risk
 * answers, no window and no links still renders, and the UI says what is
 * missing.
 */

const HUE = ENTITIES.change.hue;   // orange — the registered change hue
const MODULE = 'changes';          // signature gradient key: header tile + primary action

/* ==================================================================== *
 * Lifecycle
 *
 * The canonical ITIL-ish track. Types skip specific states rather than having
 * their own private lists, so the stepper can always draw the same seven
 * columns and mark the skipped ones — which is how the reader learns that a
 * standard change never sees the CAB.
 * ==================================================================== */

const LIFECYCLE = [
  { key: 'new',       label: 'New',       icon: Plus,           blurb: 'Logged, not yet assessed' },
  { key: 'assess',    label: 'Assess',    icon: Scale,          blurb: 'Risk, impact and planning' },
  { key: 'authorize', label: 'Authorize', icon: Stamp,          blurb: 'Approval decision' },
  { key: 'scheduled', label: 'Scheduled', icon: CalendarCheck,  blurb: 'Booked into a window' },
  { key: 'implement', label: 'Implement', icon: Hammer,         blurb: 'Being executed' },
  { key: 'review',    label: 'Review',    icon: ClipboardCheck, blurb: 'Post-implementation review' },
  { key: 'closed',    label: 'Closed',    icon: CircleCheck,    blurb: 'Outcome recorded' },
];

const LIFECYCLE_KEYS = LIFECYCLE.map(s => s.key);

const CHANGE_TYPES = {
  standard: {
    key: 'standard', label: 'Standard', hue: 'emerald', icon: ShieldCheck,
    tagline: 'Pre-approved from a template',
    blurb: 'Authorisation was granted once, when the template was approved. This change skips the CAB entirely and goes straight to a scheduled window.',
    skips: ['authorize'],
    approval: 'none',
  },
  normal: {
    key: 'normal', label: 'Normal', hue: 'orange', icon: GitBranch,
    tagline: 'Full assessment and CAB approval',
    blurb: 'Assessed for risk and impact, then authorised by the Change Advisory Board before a window is booked.',
    skips: [],
    approval: 'cab',
  },
  emergency: {
    key: 'emergency', label: 'Emergency', hue: 'red', icon: Siren,
    tagline: 'Expedited, reviewed afterwards',
    blurb: 'Authorised by the on-call change authority so it can be implemented immediately. It bypasses scheduling, and the CAB reviews the record retrospectively at the next meeting.',
    skips: ['scheduled'],
    approval: 'oncall',
  },
};

const TYPE_KEYS = Object.keys(CHANGE_TYPES);

function typeMeta(key) {
  return CHANGE_TYPES[key] || CHANGE_TYPES.normal;
}

/** The states this change type actually passes through. */
function pathFor(typeKey) {
  const skips = typeMeta(typeKey).skips;
  return LIFECYCLE_KEYS.filter(k => !skips.includes(k));
}

function nextStateOf(change) {
  const path = pathFor(change.changeType);
  const i = path.indexOf(change.status);
  if (i < 0 || i === path.length - 1) return null;
  return path[i + 1];
}

/** Verb for a specific transition — never a generic "Advance". */
function transitionLabel(change, next) {
  const type = change.changeType;
  if (next === 'assess') return 'Start assessment';
  if (next === 'authorize') return type === 'emergency' ? 'Request on-call authorisation' : 'Submit to CAB';
  if (next === 'scheduled') return 'Book the window';
  if (next === 'implement') return 'Begin implementation';
  if (next === 'review') return 'Finish implementation';
  if (next === 'closed') return 'Close change';
  return 'Advance';
}

/* ==================================================================== *
 * Risk assessment
 *
 * The point of this block: risk is DERIVED and the derivation is shown. A
 * dropdown labelled "risk: high" tells a reader nothing about why, and is the
 * first thing an auditor challenges.
 *
 * The question ids ARE the eight `riskAnswers` keys the seed authors on every
 * change (src/store/seed/service.js). That is deliberate: a questionnaire whose
 * keys did not match the stored record would score every seeded change as
 * unanswered, and the derived value would be a fiction.
 * ==================================================================== */

const RISK_QUESTIONS = [
  {
    id: 'affectsProduction', prompt: 'Does this touch production?', kind: 'yesno', risky: 'yes', weight: 3,
    notes: { yes: 'Production is inside the blast radius', no: 'Confined to non-production' },
  },
  {
    id: 'hasBackout', prompt: 'Is there a tested backout?', kind: 'yesno', risky: 'no', weight: 5,
    notes: { yes: 'A rehearsed way back exists', no: 'No proven way back' },
  },
  {
    id: 'customerFacing', prompt: 'Is the failure customer-facing?', kind: 'yesno', risky: 'yes', weight: 2,
    notes: { yes: 'Customers see it if it goes wrong', no: 'Staff-facing only' },
  },
  {
    id: 'testedInStaging', prompt: 'Has it been rehearsed in staging?', kind: 'yesno', risky: 'no', weight: 2,
    notes: { yes: 'Proven against a staging replica', no: 'The production run is the first run' },
  },
  {
    id: 'previouslyExecuted', prompt: 'Has this exact change been performed before?', kind: 'yesno', risky: 'no', weight: 1,
    notes: { yes: 'Done before without incident', no: 'First time in this environment' },
  },
  {
    id: 'requiresDowntime', prompt: 'Does it require downtime?', kind: 'yesno', risky: 'yes', weight: 2,
    notes: { yes: 'The service is unavailable for part of the window', no: 'No planned interruption' },
  },
  {
    id: 'securityImpact', prompt: 'Does it move a security control?', kind: 'yesno', risky: 'yes', weight: 1,
    notes: { yes: 'Certificates, access or a control change', no: 'No security control is touched' },
  },
  {
    id: 'peopleAffected', prompt: 'Who is affected if it goes wrong?', kind: 'scale', weight: 1,
    options: [
      { value: 'few',  label: 'A few people',      points: 0, note: 'A handful of users' },
      { value: 'some', label: 'One team or site',  points: 1, note: 'A single team, office or customer tenant' },
      { value: 'many', label: 'Everyone',          points: 3, note: 'Every user, or every tenant on the platform' },
    ],
  },
];

const RISK_MAX = RISK_QUESTIONS.reduce(
  (sum, q) => sum + (q.kind === 'scale' ? Math.max(...q.options.map(o => o.points)) : q.weight), 0,
);

const RISK_BANDS = [
  { key: 'low',      label: 'Low',      hue: 'emerald', min: 0, max: 4 },
  { key: 'moderate', label: 'Moderate', hue: 'amber',   min: 5, max: 9 },
  { key: 'high',     label: 'High',     hue: 'red',     min: 10, max: RISK_MAX },
];

function bandFor(points) {
  return RISK_BANDS.find(b => points >= b.min && points <= b.max) || RISK_BANDS[RISK_BANDS.length - 1];
}

function riskMeta(key) {
  return RISK_BANDS.find(b => b.key === key) || RISK_BANDS[1];
}

/** Score whatever has been answered, and say how complete it is. */
function assessRisk(answers = {}) {
  const rows = RISK_QUESTIONS.map(q => {
    const answer = answers[q.id];
    if (answer == null || answer === '') return { q, answer: null, points: 0, note: null };
    if (q.kind === 'scale') {
      const opt = q.options.find(o => o.value === answer);
      return { q, answer, points: opt ? opt.points : 0, note: opt?.note || null, label: opt?.label || String(answer) };
    }
    const yes = answer === 'yes' || answer === true;
    const norm = yes ? 'yes' : 'no';
    return {
      q, answer: norm, label: yes ? 'Yes' : 'No',
      points: norm === q.risky ? q.weight : 0,
      note: q.notes?.[norm] || null,
    };
  });
  const answered = rows.filter(r => r.answer != null).length;
  const points = rows.reduce((s, r) => s + r.points, 0);
  return {
    rows, points, max: RISK_MAX, answered, total: RISK_QUESTIONS.length,
    complete: answered === RISK_QUESTIONS.length,
    band: bandFor(points),
  };
}

/* ------------------------------------------------------------------ *
 * Impact + the risk × impact matrix
 * ------------------------------------------------------------------ */

const IMPACT = {
  high:     { key: 'high',     label: 'Extensive',   hue: 'red',     blurb: 'A whole service, or every customer' },
  moderate: { key: 'moderate', label: 'Significant', hue: 'amber',   blurb: 'A site, a team or one customer tenant' },
  low:      { key: 'low',      label: 'Minor',       hue: 'emerald', blurb: 'A few users, easily worked around' },
};

const SCALE_KEYS = ['high', 'moderate', 'low'];
const RANK = { low: 1, moderate: 2, high: 3 };

const MATRIX_CELLS = {
  2: { label: 'Routine',  hue: 'emerald', guidance: 'A standard-change candidate. Template it and pre-approve it so it stops consuming CAB time.' },
  3: { label: 'Low',      hue: 'lime',    guidance: 'Normal change. Delegated authority from the service owner is enough.' },
  4: { label: 'Moderate', hue: 'amber',   guidance: 'Normal change with a full CAB review at the next sitting.' },
  5: { label: 'High',     hue: 'orange',  guidance: 'Full CAB plus the service owner. Rehearse the backout before the window opens.' },
  6: { label: 'Critical', hue: 'red',     guidance: 'Full CAB, an executive sponsor and a standby engineer. Do not proceed without a rehearsed backout.' },
};

function matrixCell(risk, impact) {
  const sum = (RANK[risk] || 2) + (RANK[impact] || 2);
  return MATRIX_CELLS[sum] || MATRIX_CELLS[4];
}

function normScale(value, fallback) {
  const v = String(value || '').toLowerCase().replace(/[\s-]/g, '_');
  if (['high', 'critical', 'severe', 'major', 'extensive', 'widespread'].includes(v)) return 'high';
  if (['moderate', 'medium', 'significant', 'partial'].includes(v)) return 'moderate';
  if (['low', 'minor', 'minimal', 'localized', 'localised', 'limited'].includes(v)) return 'low';
  return fallback;
}

/**
 * Impact is not stored on a seeded change, but the blast-radius answer already
 * says who hurts. Read it rather than defaulting every record to "Significant",
 * which would make the matrix a single column and teach a reader nothing.
 */
function impactFromBlast(peopleAffected) {
  if (peopleAffected === 'many') return 'high';
  if (peopleAffected === 'few') return 'low';
  return 'moderate';
}

/* ==================================================================== *
 * Planning fields — the four documents a change cannot leave assessment
 * without. Named here so the gate, the editor and the blocker message all
 * read from one list.
 * ==================================================================== */

const PLANS = [
  { id: 'implementationPlan', label: 'Implementation plan', icon: Route,         hint: 'Ordered steps, who runs them, and how long each takes.' },
  { id: 'backoutPlan',        label: 'Backout plan',        icon: Undo2,         hint: 'How the system is returned to its current state, and the last moment that is still possible.' },
  { id: 'testPlan',           label: 'Test plan',           icon: FlaskConical,  hint: 'What is checked after implementation to prove it worked.' },
  { id: 'justification',      label: 'Justification',       icon: MessageSquareText, hint: 'Why this is worth the risk, and what happens if it is not done.' },
];

function planningGaps(change) {
  return PLANS.filter(p => !String(change[p.id] || '').trim());
}

/* ==================================================================== *
 * Post-implementation review
 * ==================================================================== */

const OUTCOMES = {
  successful:             { key: 'successful',             label: 'Successful',              hue: 'emerald', icon: CircleCheck,   blurb: 'Delivered inside the window with nothing unexpected' },
  successful_with_issues: { key: 'successful_with_issues', label: 'Successful with issues',  hue: 'amber',   icon: TriangleAlert, blurb: 'Delivered, but something went wrong on the way' },
  failed:                 { key: 'failed',                 label: 'Failed',                  hue: 'red',     icon: CircleX,       blurb: 'Did not achieve its objective' },
  backed_out:             { key: 'backed_out',             label: 'Backed out',              hue: 'orange',  icon: RotateCcw,     blurb: 'Rolled back using the backout plan' },
};

function normOutcome(value) {
  if (!value) return null;
  const v = String(value).toLowerCase().replace(/[\s-]/g, '_');
  return OUTCOMES[v] ? v : null;
}

/* ==================================================================== *
 * Typed links
 * ==================================================================== */

const LINK_TYPES = {
  caused_by:  { key: 'caused_by',  label: 'Caused by',  hue: 'fuchsia', icon: CornerDownRight, hint: 'The problem or incident that made this change necessary' },
  resolves:   { key: 'resolves',   label: 'Resolves',   hue: 'emerald', icon: CircleCheck,     hint: 'The record this change closes out' },
  related:    { key: 'related',    label: 'Related to', hue: 'slate',   icon: Link2,           hint: 'Context worth reading, no dependency' },
  blocked_by: { key: 'blocked_by', label: 'Blocked by', hue: 'red',     icon: Ban,             hint: 'This cannot proceed until that record moves' },
};

function linkMeta(type) {
  const v = String(type || '').toLowerCase().replace(/[\s-]/g, '_');
  return LINK_TYPES[v] || { key: v || 'related', label: type || 'Linked', hue: 'gray', icon: Link2, hint: '' };
}

/* ==================================================================== *
 * Blackout / freeze windows
 *
 * Northwind's published change calendar. These are dates when change is
 * forbidden regardless of how well it is planned — the single most common
 * reason a well-formed change gets rejected in a real CAB.
 * ==================================================================== */

const FREEZE_WINDOWS = [
  {
    id: 'frz-vireo-golive', name: 'Vireo Health go-live freeze', start: '2026-08-22', end: '2026-08-31', hue: 'red',
    scope: 'All customer-facing services',
    reason: 'Vireo Health cuts 1,200 clinicians over to Storefront on the Saturday night. Shared services are frozen from the cutover until their hypercare ends on the 31st.',
  },
  {
    id: 'frz-storefront-4', name: 'Storefront 4.0 stabilisation', start: '2026-09-14', end: '2026-09-21', hue: 'amber',
    scope: 'Storefront platform and payments',
    reason: 'One week of hypercare after the 4.0 release. Only defect fixes raised as emergency change are permitted.',
  },
  {
    id: 'frz-fy-close', name: 'FY27 financial close', start: '2026-09-28', end: '2026-10-02', hue: 'amber',
    scope: 'Billing, invoicing and finance integrations',
    reason: 'Finance runs the year-end close. Any change touching billing data is deferred to the following week.',
  },
  {
    id: 'frz-retail-peak', name: 'Retail peak code freeze', start: '2026-11-20', end: '2026-12-27', hue: 'red',
    scope: 'Storefront, checkout and payments',
    reason: 'Lumen Retail Group and 60 other retail tenants take roughly 40% of annual revenue in this window. Emergency change only, with the freeze owner on the call.',
  },
];

/* ==================================================================== *
 * Approval policies
 *
 * The CAB is a real approval run through @/lib/approvals.js against
 * POL.NORMAL_CHANGE. Business Rules owns those policy records; if the policy
 * has not been configured there yet, RelayHQ falls back to the built-in board
 * definition below — and SAYS SO in the panel rather than quietly inventing
 * approvers.
 * ==================================================================== */

const FALLBACK_CAB_POLICY = {
  id: POL.NORMAL_CHANGE,
  name: 'Normal change — Change Advisory Board',
  description: 'The CAB sits Tuesday and Thursday at 10:00 CT. Three of the five members must approve before a window can be booked.',
  onReject: 'stop',
  stages: [{
    id: 'stage-cab',
    name: 'Change Advisory Board',
    rule: 'quorum',
    quorum: 3,
    dueInHours: 48,
    onTimeout: 'escalate',
    escalateTo: { kind: 'user', userId: USR.ADMIN },
    approvers: [
      { kind: 'user', userId: USR.ADMIN },
      { kind: 'user', userId: USR.EMMA },
      { kind: 'user', userId: USR.LISA },
      { kind: 'user', userId: USR.MICHAEL },
      { kind: 'user', userId: USR.JEN },
    ],
  }],
};

const FALLBACK_EMERGENCY_POLICY = {
  id: POL.EMERGENCY_CHANGE,
  name: 'Emergency change — on-call change authority',
  description: 'One on-call authority can authorise immediately, 24/7. The CAB reviews the record retrospectively at the next sitting.',
  onReject: 'stop',
  stages: [{
    id: 'stage-oncall',
    name: 'On-call change authority',
    rule: 'any',
    dueInHours: 2,
    onTimeout: 'escalate',
    escalateTo: { kind: 'user', userId: USR.ADMIN },
    approvers: [
      { kind: 'user', userId: USR.ADMIN },
      { kind: 'user', userId: USR.EMMA },
    ],
  }],
};

function policyFor(change, policies) {
  const meta = typeMeta(change.changeType);
  if (meta.approval === 'none') return null;
  const wanted = meta.approval === 'oncall' ? POL.EMERGENCY_CHANGE : POL.NORMAL_CHANGE;
  const found = (policies || []).find(p => p.id === wanted);
  if (found && Array.isArray(found.stages) && found.stages.length) return found;
  return meta.approval === 'oncall' ? FALLBACK_EMERGENCY_POLICY : FALLBACK_CAB_POLICY;
}

function policyIsFallback(policy) {
  return policy === FALLBACK_CAB_POLICY || policy === FALLBACK_EMERGENCY_POLICY;
}

/**
 * An approval request seeded by another module may not have been produced by
 * startApproval(). Normalise the parts this view reads so a half-shaped record
 * degrades into "no stages recorded" rather than a blank screen.
 */
function safeStages(approval) {
  return (approval?.stages || []).map(s => ({
    ...s,
    approverIds: Array.isArray(s.approverIds) ? s.approverIds : [],
    decisions: Array.isArray(s.decisions) ? s.decisions : [],
  }));
}

function safeProgress(approval) {
  const stages = safeStages(approval);
  if (!stages.length) return { stageNumber: 0, totalStages: 0, approvals: 0, need: 0 };
  return progress({ ...approval, stages, currentStage: approval.currentStage || 0 });
}

function stageQuorum(stage) {
  const total = stage.approverIds.length;
  if (stage.rule === 'any') return 1;
  if (stage.rule === 'quorum') return Math.max(1, Math.min(stage.quorum || 1, total));
  return total;
}

/* ==================================================================== *
 * Standard change templates — the pre-approved catalogue. Choosing one fills
 * the plans from the approved procedure, which is exactly what makes a
 * standard change standard.
 * ==================================================================== */

const STANDARD_TEMPLATES = [
  {
    id: 'std-tls-rotate', name: 'Rotate an expiring TLS certificate', hours: 1,
    impact: 'low',
    implementationPlan: '1. Issue the replacement certificate from the internal CA.\n2. Stage it on the load balancer pair (lb-01, lb-02) without cutting over.\n3. Cut lb-02 over, verify, then lb-01.\n4. Confirm the old certificate is no longer served.',
    backoutPlan: 'Re-point the listener at the previous certificate, which stays installed for 14 days. Rollback takes under two minutes and is proven on every rotation.',
    testPlan: 'openssl s_client against both nodes, synthetic checkout transaction, and the external uptime monitor for 15 minutes.',
    justification: 'The current certificate expires within 30 days. An expired certificate takes the storefront offline for every tenant.',
    riskAnswers: {
      affectsProduction: true, hasBackout: true, customerFacing: true, testedInStaging: true,
      previouslyExecuted: true, requiresDowntime: false, securityImpact: true, peopleAffected: 'some',
    },
  },
  {
    id: 'std-patch-baseline', name: 'Apply the approved OS patch baseline', hours: 3,
    impact: 'moderate',
    implementationPlan: '1. Drain one node at a time from the pool.\n2. Apply the monthly baseline already validated in staging.\n3. Reboot, wait for health checks, return to the pool.\n4. Repeat across the remaining nodes.',
    backoutPlan: 'Restore the pre-patch snapshot taken at drain time. Snapshots are kept for 7 days; restore is 12 minutes per node.',
    testPlan: 'Node health endpoint, pool member count, and a synthetic transaction after each node returns.',
    justification: 'Monthly security baseline. Skipping a cycle puts the platform outside the agreed patch SLA with Vireo Health.',
    riskAnswers: {
      affectsProduction: true, hasBackout: true, customerFacing: false, testedInStaging: true,
      previouslyExecuted: true, requiresDowntime: true, securityImpact: true, peopleAffected: 'some',
    },
  },
  {
    id: 'std-add-web-node', name: 'Add a node to the Storefront web tier', hours: 2,
    impact: 'low',
    implementationPlan: '1. Build the node from the current image.\n2. Register it with configuration management and wait for convergence.\n3. Add it to the pool at 10% weight, then 100% after 20 minutes clean.',
    backoutPlan: 'Remove the node from the pool. No customer-visible state lives on it, so removal is immediate.',
    testPlan: 'Pool health, error rate and p95 latency compared with the preceding hour.',
    justification: 'Capacity headroom ahead of the retail peak. Running the tier above 70% utilisation leaves no room for a node loss.',
    riskAnswers: {
      affectsProduction: true, hasBackout: true, customerFacing: true, testedInStaging: true,
      previouslyExecuted: true, requiresDowntime: false, securityImpact: false, peopleAffected: 'few',
    },
  },
  {
    id: 'std-read-replica', name: 'Provision a reporting read replica', hours: 4,
    impact: 'low',
    implementationPlan: '1. Provision the replica from the latest snapshot.\n2. Start replication and wait for lag under 5 seconds.\n3. Point the reporting connection string at the replica.',
    backoutPlan: 'Point reporting back at the primary and destroy the replica. Reporting queries fall back to the primary with no data loss.',
    testPlan: 'Replication lag, a row-count reconciliation against the primary, and three representative reports.',
    justification: 'Reporting queries are contending with transactional load during business hours.',
    riskAnswers: {
      affectsProduction: true, hasBackout: true, customerFacing: false, testedInStaging: true,
      previouslyExecuted: true, requiresDowntime: false, securityImpact: false, peopleAffected: 'some',
    },
  },
  {
    id: 'std-saas-connector', name: 'Deploy an approved SaaS connector', hours: 2,
    impact: 'low',
    implementationPlan: '1. Create the integration user with the least-privilege role from the approved matrix.\n2. Install the connector in the sandbox tenant and verify.\n3. Promote to production and enable for one pilot group.',
    backoutPlan: 'Disable the connector and revoke the integration user. No data is migrated during deployment.',
    testPlan: 'Round-trip one record in each direction, then confirm the audit log records both.',
    justification: 'Requested through the catalog and already on the approved connector list.',
    riskAnswers: {
      affectsProduction: true, hasBackout: true, customerFacing: false, testedInStaging: true,
      previouslyExecuted: true, requiresDowntime: false, securityImpact: true, peopleAffected: 'some',
    },
  },
];

/** Northwind's published maintenance windows, used to flag out-of-window work. */
const MAINTENANCE_WINDOWS = [
  { days: [2, 4], label: 'Tue & Thu 22:00–02:00 CT', startHour: 22, endHour: 2 },
  { days: [6],    label: 'Sat 20:00–04:00 CT',       startHour: 20, endHour: 4 },
];

function insideMaintenanceWindow(start) {
  const d = toDate(start);
  if (!d) return null;
  const day = d.getDay();
  const hour = d.getHours();
  return MAINTENANCE_WINDOWS.some(w =>
    w.days.includes(day) && (hour >= w.startHour || hour < w.endHour));
}

/* ==================================================================== *
 * Dates
 * ==================================================================== */

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '—';
}

function fmtTime(value) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';
}

function fmtDateTime(value) {
  const d = toDate(value);
  return d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—';
}

function hoursBetween(a, b) {
  const s = toDate(a); const e = toDate(b);
  if (!s || !e) return null;
  return Math.round(((e - s) / 36e5) * 10) / 10;
}

function fmtWindow(change) {
  const s = toDate(change.plannedStart);
  const e = toDate(change.plannedEnd);
  if (!s) return 'No window booked';
  const dur = hoursBetween(s, e);
  return `${fmtDateTime(s)}${e ? ` → ${fmtTime(e)}` : ''}${dur != null ? ` · ${dur}h` : ''}`;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const as = toDate(aStart); const ae = toDate(aEnd) || toDate(aStart);
  const bs = toDate(bStart); const be = toDate(bEnd) || toDate(bStart);
  if (!as || !bs) return false;
  return as <= (be || bs) && bs <= (ae || as);
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(value) {
  const d = toDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(value) {
  const d = toDate(value);
  if (!d) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
}

function addDays(value, n) {
  const d = startOfDay(value);
  if (!d) return null;
  d.setDate(d.getDate() + n);
  return d;
}

/** Weeks run Sunday-first, matching the change calendar's own grid. */
function startOfWeek(value) {
  const d = startOfDay(value);
  if (!d) return null;
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** datetime-local needs a local, not ISO, string. */
function toLocalInput(value) {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The next Saturday 22:00 after the demo clock — the default proposed window. */
function defaultWindow() {
  const start = new Date(NOW);
  start.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7 || 7));
  start.setHours(22, 0, 0, 0);
  const end = new Date(start);
  end.setHours(end.getHours() + 4);
  return { start: start.toISOString(), end: end.toISOString() };
}

/* ==================================================================== *
 * Normalising a stored change
 * ==================================================================== */

function firstArray(...candidates) {
  for (const v of candidates) if (Array.isArray(v)) return v;
  return [];
}

/**
 * Links are stored on the seed as two id arrays with the relationship implied
 * by which array they sit in. Give them their type explicitly, so the panel can
 * say what the relationship IS — which is the only thing that makes the link
 * readable six months later.
 */
function normalizeLinks(c) {
  if (Array.isArray(c.links)) return c.links.filter(l => l && l.id);
  return [
    ...(c.linkedProblemIds || []).map(id => ({ type: 'caused_by', id })),
    ...(c.linkedTicketIds || []).map(id => ({ type: 'resolves', id })),
  ];
}

/** A seeded PIR records success as a boolean; the review panel speaks outcomes. */
function outcomeFromPir(pir) {
  if (!pir || !pir.completed) return null;
  return pir.successful ? 'successful' : 'failed';
}

function normalize(raw) {
  const c = raw || {};
  const changeType = CHANGE_TYPES[c.changeType] ? c.changeType : 'normal';
  const status = [...LIFECYCLE_KEYS, 'cancelled'].includes(c.status) ? c.status : 'new';
  const riskAnswers = c.riskAnswers && typeof c.riskAnswers === 'object' ? c.riskAnswers : {};
  const pir = c.pir && typeof c.pir === 'object' ? c.pir : null;
  return {
    ...c,
    id: c.id,
    key: c.key || 'CHG-????',
    title: c.title || 'Untitled change',
    description: c.description || '',
    changeType,
    status,
    impact: normScale(c.impact, impactFromBlast(riskAnswers.peopleAffected)),
    storedRisk: normScale(c.risk, null),
    riskAnswers,
    implementationPlan: c.implementationPlan || '',
    backoutPlan: c.backoutPlan || '',
    testPlan: c.testPlan || '',
    justification: c.justification || '',
    // People: the seed names an owner and an implementer.
    requestedById: c.requestedById || c.ownerId || null,
    assigneeId: c.assigneeId !== undefined ? (c.assigneeId || null) : (c.implementerId || null),
    // What it touches. Catalog items are the services conflict detection knows
    // by id; `affectedServices` are the free-text component names the seed also
    // carries, and they are compared too so a shared component still collides.
    affectedProductIds: firstArray(c.affectedProductIds, c.affectedCatalogItemIds),
    affectedAssetIds: firstArray(c.affectedAssetIds),
    affectedServices: firstArray(c.affectedServices),
    affectedLocationIds: firstArray(c.affectedLocationIds),
    links: normalizeLinks(c),
    outcome: normOutcome(c.outcome) || outcomeFromPir(pir),
    reviewNotes: c.reviewNotes || pir?.notes || '',
    followUps: firstArray(c.followUps, pir?.followUps),
  };
}

/** The risk value the rest of the UI should use, and where it came from. */
function effectiveRisk(change) {
  const scored = assessRisk(change.riskAnswers);
  if (scored.complete) return { key: scored.band.key, source: 'derived', scored };
  if (scored.answered > 0) return { key: scored.band.key, source: 'partial', scored };
  if (change.storedRisk) return { key: change.storedRisk, source: 'stored', scored };
  return { key: 'moderate', source: 'default', scored };
}

/* ==================================================================== *
 * Conflict + freeze detection
 * ==================================================================== */

function freezeClashes(change) {
  if (!change.plannedStart) return [];
  return FREEZE_WINDOWS.filter(f =>
    rangesOverlap(change.plannedStart, change.plannedEnd, startOfDay(f.start), endOfDay(f.end)));
}

/**
 * Two changes conflict when their windows overlap AND they touch the same
 * service or asset. Overlap alone is normal — the whole point of a calendar is
 * that several teams work at once.
 */
function conflictsFor(change, all) {
  const out = [];
  if (!change.plannedStart) return out;
  for (const raw of all) {
    if (!raw || raw.id === change.id) continue;
    const other = normalize(raw);
    if (other.status === 'cancelled' || other.status === 'closed') continue;
    if (!other.plannedStart) continue;
    if (!rangesOverlap(change.plannedStart, change.plannedEnd, other.plannedStart, other.plannedEnd)) continue;
    const products = change.affectedProductIds.filter(id => other.affectedProductIds.includes(id));
    const assets = change.affectedAssetIds.filter(id => other.affectedAssetIds.includes(id));
    const services = change.affectedServices.filter(s => other.affectedServices.includes(s));
    if (!products.length && !assets.length && !services.length) continue;
    out.push({ other, products, assets, services });
  }
  return out;
}

/* ==================================================================== *
 * The Window filter
 *
 * "When is it happening, and is it allowed to?" is one question, so it is one
 * filter. A change can be BOTH next week and inside a freeze, which is exactly
 * the combination worth finding, so the bucket function returns every bucket a
 * change belongs to rather than picking one.
 * ==================================================================== */

const WINDOW_BUCKETS = [
  { value: 'this_week',   label: 'This week' },
  { value: 'next_week',   label: 'Next week' },
  { value: 'freeze',      label: 'In a freeze' },
  { value: 'unscheduled', label: 'Unscheduled' },
];

function windowBuckets(entry) {
  const out = [];
  const start = toDate(entry.change.plannedStart);
  if (!start) {
    out.push('unscheduled');
  } else {
    const thisWeek = startOfWeek(NOW);
    const nextWeek = addDays(thisWeek, 7);
    const weekAfter = addDays(thisWeek, 14);
    if (start >= thisWeek && start < nextWeek) out.push('this_week');
    else if (start >= nextWeek && start < weekAfter) out.push('next_week');
  }
  if (entry.freezes.length) out.push('freeze');
  return out;
}

/* ==================================================================== *
 * Advance gating
 * ==================================================================== */

function blockersFor(change, { approval, freezes }) {
  const next = nextStateOf(change);
  const out = [];
  if (!next) return out;

  if (change.status === 'assess') {
    const gaps = planningGaps(change);
    if (gaps.length) {
      out.push({
        text: `Planning is incomplete — ${gaps.map(g => g.label.toLowerCase()).join(', ')} ${gaps.length === 1 ? 'is' : 'are'} empty.`,
        fix: 'A change cannot leave assessment without all four planning documents. Fill them in below.',
      });
    }
    const scored = assessRisk(change.riskAnswers);
    if (!scored.complete) {
      out.push({
        text: `Risk assessment is incomplete — ${scored.answered} of ${scored.total} questions answered.`,
        fix: 'Risk is derived from the questionnaire, so an unanswered question means there is no risk value to authorise against.',
      });
    }
  }

  if (change.status === 'authorize') {
    if (!approval) {
      out.push({ text: 'No approval has been raised yet.', fix: 'Submit the change to the board to start the approval run.' });
    } else if (approval.state === 'awaiting') {
      const p = safeProgress(approval);
      out.push({
        text: `Approval is still running — ${p.approvals} of ${p.need} approvals on stage ${p.stageNumber} of ${p.totalStages}.`,
        fix: 'The window cannot be booked until the board has reached its quorum.',
      });
    } else if (approval.state === 'rejected') {
      out.push({ text: 'The board rejected this change.', fix: 'Revise the plan and raise a new change, or cancel this one.' });
    }
  }

  if (next === 'implement') {
    if (!change.plannedStart || !change.plannedEnd) {
      out.push({ text: 'No implementation window is booked.', fix: 'Set a planned start and end before implementation begins.' });
    }
    if (freezes.length && change.changeType !== 'emergency') {
      out.push({
        text: `The window falls inside the ${freezes.map(f => f.name).join(' and ')}.`,
        fix: 'Move the window outside the freeze, or raise the work as an emergency change with the freeze owner on the call.',
      });
    }
  }

  if (next === 'closed' && !change.outcome) {
    out.push({ text: 'No post-implementation review has been recorded.', fix: 'Record the outcome and notes below before closing.' });
  }

  return out;
}

/* ==================================================================== *
 * Lookups against collections other modules own
 * ==================================================================== */

function flattenCatalog(nodes, out = [], trail = []) {
  for (const n of nodes || []) {
    out.push({ ...n, path: trail.join(' › ') });
    if (n.children) flattenCatalog(n.children, out, [...trail, n.name]);
  }
  return out;
}

/**
 * The catalog is what a change points at when it names a service. A change
 * records the LEAF — the item — because that is the granularity the rest of the
 * app routes and deflects on, so `items` is what the picker offers and `all` is
 * what a stored id is resolved against.
 */
function useCatalogServices() {
  const catalog = useStore(s => s.catalog || []);
  return useMemo(() => {
    const all = flattenCatalog(catalog);
    return { all, items: all.filter(n => n.type === 'item') };
  }, [catalog]);
}

function nameOfService(id, services) {
  return services.all.find(n => n.id === id)?.name || id;
}

function nameOfLocation(id, locations) {
  return locations.find(l => l.id === id)?.name || id;
}

function nameOfAsset(id, assets) {
  const a = assets.find(x => x.id === id);
  return a ? (a.name || a.assetTag || a.hostname || a.id) : id;
}

function personName(id, directory) {
  return directory.find(p => p.id === id)?.name || (id ? String(id) : 'Unassigned');
}

/**
 * Resolve a typed link's target across the collections it might live in.
 *
 * `to` is [section, sub] and BOTH segments are load-bearing: the router builds
 * `#/section/sub/id` by dropping falsy segments, so `['workspace']` would put
 * the ticket id in the `sub` slot and the record would never open.
 */
function resolveLink(link, { tickets, problems, changes }) {
  const t = tickets.find(x => x.id === link.id);
  if (t) return { kind: 'ticket', hue: ENTITIES.ticket.hue, icon: Inbox, label: t.title || t.subject || t.id, ref: t.key || t.id, to: ['workspace', 'ticket'] };
  const p = problems.find(x => x.id === link.id);
  if (p) return { kind: 'problem', hue: ENTITIES.problem.hue, icon: OctagonAlert, label: p.title || p.id, ref: p.key || p.id, to: ['problems', null] };
  const c = changes.find(x => x.id === link.id);
  if (c) return { kind: 'change', hue: HUE, icon: GitBranch, label: c.title || c.id, ref: c.key || c.id, to: ['changes', 'list'] };
  return { kind: 'unknown', hue: 'gray', icon: Link2, label: link.id, ref: link.id, to: null };
}

function nextChangeKey(changes) {
  let max = 1041;
  for (const c of changes || []) {
    const m = /CHG-(\d+)/.exec(String(c.key || ''));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `CHG-${max + 1}`;
}

/* ==================================================================== *
 * THE VIEW
 * ==================================================================== */

const VIEWS = [
  { value: 'list',     label: 'List',     icon: List },
  { value: 'board',    label: 'Board',    icon: Columns3 },
  { value: 'calendar', label: 'Calendar', icon: CalendarDays },
];

/** The lifecycle states a change can be filtered to, including the withdrawn one. */
const STATUS_OPTIONS = [
  ...LIFECYCLE.map(s => ({ key: s.key, label: s.label })),
  { key: 'cancelled', label: 'Cancelled' },
];

export default function Changes({ route }) {
  const rawChanges = useStore(s => s.changes || []);
  const [creating, setCreating] = useState(false);

  /* One header state: the multi-select filter values and the in-page query.
   * There is no tray flag any more — the filter bar is always on screen, so a
   * filter can never be on while its control is hidden. */
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState('');

  const view = VIEWS.some(v => v.value === route?.sub) ? route.sub : 'list';
  const selectedId = route?.id || null;
  const selected = selectedId ? rawChanges.find(c => c.id === selectedId) : null;

  const changes = useMemo(() => rawChanges.map(normalize), [rawChanges]);

  /* Risk, conflicts and freezes are resolved ONCE, here, against the whole
   * register. Computing them per view meant the calendar and the list could
   * disagree about whether a change conflicts, and a filtered view would have
   * detected conflicts only against the changes that survived the filter. */
  const enriched = useMemo(() => changes.map(c => ({
    change: c,
    risk: effectiveRisk(c).key,
    conflicts: conflictsFor(c, changes),
    freezes: freezeClashes(c),
  })), [changes]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return enriched.filter(e => {
      const c = e.change;
      if (!passes(filters.type, c.changeType)) return false;
      if (!passes(filters.status, c.status)) return false;
      if (!passes(filters.risk, e.risk)) return false;
      if (!passes(filters.window, windowBuckets(e))) return false;
      // Search layers ON TOP of the filters rather than replacing them.
      if (needle) {
        const hay = `${c.key} ${c.title} ${c.description}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [enriched, filters, search]);

  /* Counts are computed over the WHOLE register, not the filtered view, so an
   * option says how many changes exist rather than how many survive the filters
   * already set — the latter reads as options vanishing as you work. */
  const FILTER_DEFS = useMemo(() => {
    const byType = optionCounts(enriched, e => e.change.changeType);
    const byStatus = optionCounts(enriched, e => e.change.status);
    const byRisk = optionCounts(enriched, e => e.risk);
    const byWindow = optionCounts(enriched, windowBuckets);
    return [
      {
        id: 'type', label: 'Type', icon: GitBranch,
        options: TYPE_KEYS.map(k => ({ value: k, label: CHANGE_TYPES[k].label, count: byType.get(k) || 0 })),
      },
      {
        id: 'status', label: 'Status', icon: Route,
        options: STATUS_OPTIONS.map(s => ({ value: s.key, label: s.label, count: byStatus.get(s.key) || 0 })),
      },
      {
        id: 'risk', label: 'Risk', icon: Gauge,
        footer: `Risk is derived from the questionnaire — low 0–4, moderate 5–9, high 10+ of ${RISK_MAX} points.`,
        options: RISK_BANDS.slice().reverse().map(b => ({ value: b.key, label: b.label, count: byRisk.get(b.key) || 0 })),
      },
      {
        id: 'window', label: 'Window', icon: CalendarDays,
        options: WINDOW_BUCKETS.map(b => ({ value: b.value, label: b.label, count: byWindow.get(b.value) || 0 })),
      },
    ];
  }, [enriched]);

  const clearFilters = () => { setFilters({}); setSearch(''); };

  if (selectedId) {
    return selected
      ? <ChangeDetail change={normalize(selected)} all={rawChanges} view={view} />
      : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <PageHeader icon={GitBranch} module={MODULE} accent={HUE} title="Change not found" subtitle={selectedId} />
          <PageBody>
            <EmptyState
              icon={GitBranch}
              title="That change is not here"
              hint="It may have been cancelled and removed, or the link is stale."
              action={<Button variant="soft" accent={HUE} icon={ChevronLeft} onClick={() => navigate('changes', view)}>Back to changes</Button>}
            />
          </PageBody>
        </div>
      );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ModuleHeader
        icon={GitBranch}
        module={MODULE}
        accent={HUE}
        title="Change Management"
        /* The subtitle always tells the truth about what is on screen: the
         * resting label when nothing narrows the register, "9 of 24 shown"
         * when something does. */
        subtitle={subsetLabel(
          shown.length,
          enriched.length,
          `${enriched.length} changes · standard, normal and emergency change enablement`,
        )}
        /* The view switcher is centred in row 1, between the module identity and
         * the primary action, so it holds still while the subtitle beneath the
         * title changes length. */
        nav={<ViewSwitcher items={VIEWS} value={view} onChange={(v) => navigate('changes', v)} inline />}
        primary={<Button variant="grad" module={MODULE} icon={Plus} onClick={() => setCreating(true)}>New change</Button>}
        filterBar={
          <FilterBar
            accent={HUE}
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onClearAll={clearFilters}
            search={
              <ScopedSearch
                value={search}
                onChange={setSearch}
                /* Names its own scope, so it can never be mistaken for the global
                 * field in the bar above. */
                scope={`${enriched.length} changes`}
                accent={HUE}
              />
            }
          />
        }
      />

      {view === 'list' && (
        <ListView
          entries={shown}
          total={enriched.length}
          onNew={() => setCreating(true)}
          onClear={clearFilters}
          view={view}
          freezeFilter={(filters.window || []).includes('freeze')}
        />
      )}
      {view === 'board' && <BoardView entries={shown} view={view} />}
      {view === 'calendar' && <CalendarView entries={shown} view={view} />}

      <NewChangeModal open={creating} onClose={() => setCreating(false)} existing={rawChanges} />
    </div>
  );
}

/* ==================================================================== *
 * LIST
 * ==================================================================== */

function ListView({ entries, total, onNew, onClear, view, freezeFilter }) {
  const { t } = useTheme();

  const grouped = useMemo(() => {
    const order = [...LIFECYCLE_KEYS, 'cancelled'];
    const map = new Map(order.map(k => [k, []]));
    for (const e of entries) {
      if (!map.has(e.change.status)) map.set(e.change.status, []);
      map.get(e.change.status).push(e);
    }
    return order.filter(k => map.get(k)?.length).map(k => [k, map.get(k)]);
  }, [entries]);

  return (
    <PageBody>
      <div className="space-y-3">
        {freezeFilter && (
          <Banner accent="red" icon={Snowflake} title="Showing changes booked inside a freeze">
            Blackout windows are published on the change calendar. Only emergency change is permitted inside one,
            and only with the freeze owner on the call.
          </Banner>
        )}

        {!total && (
          <EmptyState
            icon={GitBranch}
            title="No changes have been raised"
            hint="A change records what is going to be altered, why it is worth the risk, and how it will be undone if it goes wrong."
            action={<Button variant="grad" module={MODULE} icon={Plus} onClick={onNew}>Raise the first change</Button>}
          />
        )}

        {!!total && !entries.length && (
          <EmptyState icon={Route} title="Nothing matches these filters"
            hint="Search composes with the filters above rather than replacing them — clearing a filter may bring the rest of the register back."
            action={<Button variant="soft" accent={HUE} icon={RotateCcw} onClick={onClear}>Clear filters</Button>} />
        )}

        {grouped.map(([state, rows]) => (
          <Section key={state} className="space-y-2">
            <div className="flex items-center gap-2">
              <GroupLabel>{statusMeta(state).label}</GroupLabel>
              <span className={cx('text-[11px] tabular-nums', t.textMuted)}>{rows.length}</span>
              <Divider className="flex-1" />
            </div>
            <div className={DENSITY.rowGap}>
              {rows.map(e => <ChangeRow key={e.change.id} entry={e} view={view} />)}
            </div>
          </Section>
        ))}
      </div>
    </PageBody>
  );
}

function ChangeRow({ entry, view }) {
  const { change: c, conflicts, freezes } = entry;
  const type = typeMeta(c.changeType);
  const risk = effectiveRisk(c);
  const rm = riskMeta(risk.key);
  const directory = useStore(s => s.directory || []);
  const alert = conflicts.length > 0 || (freezes.length > 0 && c.changeType !== 'emergency' && !['closed', 'cancelled'].includes(c.status));

  return (
    <ListRow
      accent={HUE}
      icon={type.icon}
      title={`${c.key} · ${c.title}`}
      subtitle={fmtWindow(c)}
      alert={alert}
      onClick={() => navigate('changes', view, c.id)}
      meta={
        <>
          {alert && (
            <Chip accent="red" icon={conflicts.length ? TriangleAlert : Snowflake}
              title={conflicts.length
                ? `Conflicts with ${conflicts.map(x => x.other.key).join(', ')}`
                : `Inside the ${freezes.map(f => f.name).join(', ')}`}>
              {conflicts.length ? `Conflict · ${conflicts[0].other.key}` : 'Freeze'}
            </Chip>
          )}
          <Chip accent={type.hue} icon={type.icon}>{type.label}</Chip>
          <Chip accent={rm.hue} icon={Gauge}>{rm.label} risk</Chip>
          <StatusPill status={c.status} />
          <Avatar name={personName(c.assigneeId, directory)} size="sm" />
        </>
      }
    />
  );
}

/* ==================================================================== *
 * BOARD
 * ==================================================================== */

function BoardView({ entries, view }) {
  const { t } = useTheme();
  const columns = useMemo(() => {
    const cols = LIFECYCLE.map(s => ({ ...s, items: entries.filter(e => e.change.status === s.key) }));
    const cancelled = entries.filter(e => e.change.status === 'cancelled');
    if (cancelled.length) cols.push({ key: 'cancelled', label: 'Cancelled', icon: Ban, blurb: 'Withdrawn before implementation', items: cancelled });
    return cols;
  }, [entries]);

  return (
    <PageBody width="max-w-none">
      <div className="space-y-3">
        <Banner accent={HUE} icon={Info} title="One board, three journeys">
          A <strong>standard</strong> change never appears in Authorize — it was approved when its template was.
          An <strong>emergency</strong> change never appears in Scheduled — it goes from authorisation straight to implementation.
        </Banner>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map(col => (
            <div key={col.key} className="w-64 flex-shrink-0">
              <div className={cx('flex items-center gap-2 px-2 py-1.5 rounded-lg mb-2', t.bgSubtle)}>
                <col.icon size={ICON.base} className={t.textMuted} />
                <span className={cx('text-sm font-medium flex-1 truncate', t.text)}>{col.label}</span>
                <span className={cx('text-xs tabular-nums', t.textMuted)}>{col.items.length}</span>
              </div>
              <div className="space-y-2">
                {col.items.map(e => <BoardCard key={e.change.id} entry={e} view={view} />)}
                {!col.items.length && (
                  <div className={cx('rounded-lg border border-dashed px-3 py-4 text-center text-[11px]', t.borderLight, t.textMuted)}>
                    {col.blurb}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageBody>
  );
}

function BoardCard({ entry, view }) {
  const { t, a } = useTheme();
  const { change: c, conflicts } = entry;
  const type = typeMeta(c.changeType);
  const rm = riskMeta(entry.risk);
  const directory = useStore(s => s.directory || []);
  const cAcc = a(HUE);

  return (
    <Card
      className={cx(DENSITY.rowPad, 'cursor-pointer transition-colors', conflicts.length && a('red').borderStrong)}
      onClick={() => navigate('changes', view, c.id)}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={cx('w-1 h-4 rounded-full', cAcc.rail)} />
        <span className={cx('text-[11px] font-mono', t.textMuted)}>{c.key}</span>
        <span className="flex-1" />
        <type.icon size={ICON.sm} className={a(type.hue).fg} />
      </div>
      <p className={cx('text-sm font-medium leading-snug line-clamp-2', t.text)}>{c.title}</p>
      <p className={cx('text-[11px] mt-1 truncate', t.textMuted)}>{fmtWindow(c)}</p>
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        <Chip accent={rm.hue} icon={Gauge}>{rm.label}</Chip>
        <Chip accent={IMPACT[c.impact].hue}>{IMPACT[c.impact].label}</Chip>
        {!!conflicts.length && <Chip accent="red" icon={TriangleAlert}>{conflicts[0].other.key}</Chip>}
        <span className="flex-1" />
        <Avatar name={personName(c.assigneeId, directory)} size="sm" />
      </div>
    </Card>
  );
}

/* ==================================================================== *
 * CALENDAR
 * ==================================================================== */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function monthWeeks(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const cursor = new Date(first);
  cursor.setDate(1 - first.getDay());
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks.filter(week => week.some(d => d.getMonth() === anchor.getMonth()));
}

function CalendarView({ entries, view }) {
  const { t, a } = useTheme();
  const [anchor, setAnchor] = useState(() => new Date(NOW.getFullYear(), NOW.getMonth(), 1));

  const weeks = useMemo(() => monthWeeks(anchor), [anchor]);
  const monthLabel = anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const bookable = useMemo(
    () => entries.filter(e => e.change.plannedStart && e.change.status !== 'cancelled'),
    [entries],
  );

  const scheduled = useMemo(() => bookable.map(e => e.change), [bookable]);

  const monthFreezes = useMemo(() => {
    const from = weeks[0]?.[0];
    const to = weeks[weeks.length - 1]?.[6];
    if (!from || !to) return [];
    return FREEZE_WINDOWS.filter(f => rangesOverlap(startOfDay(f.start), endOfDay(f.end), from, endOfDay(to)));
  }, [weeks]);

  /* Conflicts were resolved against the WHOLE register when the entries were
   * built, so filtering the calendar down never hides the fact that a change
   * collides with one that is currently filtered out. */
  const conflictIndex = useMemo(() => {
    const map = new Map();
    for (const e of bookable) {
      if (e.conflicts.length) map.set(e.change.id, e.conflicts);
    }
    return map;
  }, [bookable]);

  const shift = (delta) => setAnchor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  return (
    <PageBody width="max-w-6xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <IconButton icon={ChevronLeft} label="Previous month" onClick={() => shift(-1)} />
            <h3 className={cx('text-base font-semibold w-44 text-center', t.text)}>{monthLabel}</h3>
            <IconButton icon={ChevronRight} label="Next month" onClick={() => shift(1)} />
            <Button variant="outline" size="sm" className="ml-2"
              onClick={() => setAnchor(new Date(NOW.getFullYear(), NOW.getMonth(), 1))}>Today</Button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={cx('flex items-center gap-1.5 text-[11px]', t.textSecondary)}>
              <span className={cx('w-3 h-3 rounded', a('red').softStrong)} /> Freeze window
            </span>
            <span className={cx('flex items-center gap-1.5 text-[11px]', t.textSecondary)}>
              <span className={cx('w-3 h-3 rounded', a(HUE).softStrong)} /> Scheduled change
            </span>
            <span className={cx('flex items-center gap-1.5 text-[11px]', t.textSecondary)}>
              <TriangleAlert size={ICON.sm} className={a('red').fg} /> Conflict
            </span>
          </div>
        </div>

        {conflictIndex.size > 0 && (
          <Banner accent="red" icon={TriangleAlert} title={`${conflictIndex.size} change${conflictIndex.size === 1 ? '' : 's'} on this calendar has a conflict`}>
            Overlapping windows on the same service or asset. Open either change to see what they share.
          </Banner>
        )}

        <Card className="p-2 overflow-x-auto">
          <div className="min-w-[46rem]">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className={cx('text-[11px] font-semibold uppercase tracking-wider text-center py-1', t.textMuted)}>{d}</div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <CalendarWeek
                key={wi}
                week={week}
                anchor={anchor}
                changes={scheduled}
                conflictIndex={conflictIndex}
                view={view}
              />
            ))}
          </div>
        </Card>

        <Section title="Blackout and freeze windows"
          hint="Northwind's published freeze calendar. Only emergency change is permitted inside one, and only with the freeze owner on the call.">
          <div className={DENSITY.rowGap}>
            {FREEZE_WINDOWS.map(f => {
              const visible = monthFreezes.some(x => x.id === f.id);
              return (
                <Card key={f.id} className={cx(DENSITY.rowPad, 'flex items-start gap-3', !visible && 'opacity-60')}>
                  <IconTile icon={Snowflake} accent={f.hue} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={cx('text-sm font-medium', t.text)}>{f.name}</p>
                      <Chip accent={f.hue}>{fmtDate(f.start)} – {fmtDate(f.end)}</Chip>
                      <Chip accent="slate" icon={Boxes}>{f.scope}</Chip>
                      {visible && <Chip accent={HUE} icon={CalendarDays}>on this month</Chip>}
                    </div>
                    <p className={cx('text-xs mt-1 leading-relaxed', t.textSecondary)}>{f.reason}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </Section>
      </div>
    </PageBody>
  );
}

function CalendarWeek({ week, anchor, changes, conflictIndex, view }) {
  const { t, a } = useTheme();
  const weekStart = week[0];
  const weekEnd = endOfDay(week[6]);

  // Freeze ribbons drawn as shaded ranges across the columns they cover.
  const ribbons = FREEZE_WINDOWS
    .map(f => {
      const fs = startOfDay(f.start);
      const fe = endOfDay(f.end);
      if (!rangesOverlap(fs, fe, weekStart, weekEnd)) return null;
      const startCol = Math.max(0, week.findIndex(d => dayKey(d) === dayKey(fs) || d >= fs));
      let endCol = 6;
      for (let i = 6; i >= 0; i--) {
        if (week[i] <= fe) { endCol = i; break; }
      }
      return { freeze: f, startCol, span: Math.max(1, endCol - startCol + 1) };
    })
    .filter(Boolean);

  return (
    <div className="mb-1">
      {!!ribbons.length && (
        <div className="grid grid-cols-7 gap-1 mb-1">
          {ribbons.map(r => {
            const c = a(r.freeze.hue);
            return (
              <div
                key={r.freeze.id}
                title={`${r.freeze.name} — ${r.freeze.scope}. ${r.freeze.reason}`}
                style={{ gridColumn: `${r.startCol + 1} / span ${r.span}` }}
                className={cx('flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium truncate',
                  c.softStrong, c.fgOnSoft, c.border)}
              >
                <Snowflake size={ICON.xs} className="flex-shrink-0" />
                <span className="truncate">{r.freeze.name}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-7 gap-1">
        {week.map(day => (
          <CalendarDay
            key={dayKey(day)}
            day={day}
            inMonth={day.getMonth() === anchor.getMonth()}
            frozen={FREEZE_WINDOWS.filter(f => rangesOverlap(startOfDay(f.start), endOfDay(f.end), day, endOfDay(day)))}
            changes={changes.filter(c => rangesOverlap(c.plannedStart, c.plannedEnd, day, endOfDay(day)))}
            conflictIndex={conflictIndex}
            view={view}
          />
        ))}
      </div>
    </div>
  );
}

function CalendarDay({ day, inMonth, frozen, changes, conflictIndex, view }) {
  const { t, a } = useTheme();
  const isToday = dayKey(day) === dayKey(NOW);
  const freeze = frozen[0];
  const fc = freeze ? a(freeze.hue) : null;
  const shown = changes.slice(0, 3);
  const rest = changes.length - shown.length;

  return (
    <div className={cx('rounded-lg border min-h-24 p-1 flex flex-col gap-1',
      freeze ? cx(fc.soft, fc.border) : cx(t.bgCard, t.borderLight),
      !inMonth && 'opacity-45')}>
      <div className="flex items-center justify-between">
        <span className={cx('text-[11px] font-medium tabular-nums px-1 rounded',
          isToday ? cx(a(HUE).solid, 'text-white') : t.textMuted)}>{day.getDate()}</span>
        {freeze && <Snowflake size={ICON.xs} className={fc.fg} />}
      </div>
      {shown.map(c => {
        const conflicted = conflictIndex.has(c.id);
        const type = typeMeta(c.changeType);
        const cc = a(conflicted ? 'red' : type.hue);
        return (
          <button
            key={c.id}
            onClick={() => navigate('changes', view, c.id)}
            title={`${c.key} · ${c.title}\n${fmtWindow(c)}${conflicted ? '\nConflicts with ' + conflictIndex.get(c.id).map(x => x.other.key).join(', ') : ''}`}
            className={cx('flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium text-left truncate border',
              cc.soft, cc.fgOnSoft, conflicted ? cc.borderStrong : 'border-transparent')}
          >
            {conflicted ? <TriangleAlert size={ICON.xs} className="flex-shrink-0" /> : <type.icon size={ICON.xs} className="flex-shrink-0" />}
            <span className="truncate">{c.key} {c.title}</span>
          </button>
        );
      })}
      {rest > 0 && <span className={cx('text-[10px] px-1', t.textMuted)}>+{rest} more</span>}
    </div>
  );
}

/* ==================================================================== *
 * DETAIL
 * ==================================================================== */

function ChangeDetail({ change: c, all, view }) {
  const { t } = useTheme();
  const directory = useStore(s => s.directory || []);
  const approvals = useStore(s => s.approvals || []);
  const policies = useStore(s => s.approvalPolicies || []);
  const queues = useStore(s => s.queues || []);
  const currentUser = useStore(s => s.currentUser);
  const [menu, setMenu] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const type = typeMeta(c.changeType);
  const approval = c.approvalId ? approvals.find(a => a.id === c.approvalId) || null : null;
  const conflicts = useMemo(() => conflictsFor(c, all), [c, all]);
  const freezes = useMemo(() => freezeClashes(c), [c]);
  const blockers = blockersFor(c, { approval, freezes });
  const next = nextStateOf(c);
  const terminal = ['closed', 'cancelled'].includes(c.status);

  const policy = policyFor(c, policies);

  function submitForApproval() {
    if (!policy) return;
    const ctx = {
      requesterId: c.requestedById || currentUser?.id,
      directory,
      queues,
      changeType: c.changeType,
      risk: effectiveRisk(c).key,
      impact: c.impact,
      title: c.title,
    };
    const request = startApproval(policy, ctx, {
      id: uid('apr'),
      subject: `${c.key} · ${c.title}`,
      targetType: 'change',
      targetId: c.id,
      now: new Date().toISOString(),
    });
    addTo('approvals', request);
    patchIn('changes', c.id, { approvalId: request.id, status: 'authorize' });
  }

  function advance() {
    if (!next || blockers.length) return;
    if (next === 'authorize') { submitForApproval(); return; }
    const patch = { status: next };
    if (next === 'implement') patch.actualStart = new Date().toISOString();
    if (next === 'review') patch.actualEnd = new Date().toISOString();
    patchIn('changes', c.id, patch);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={type.icon}
        module={MODULE}
        accent={HUE}
        title={`${c.key} · ${c.title}`}
        subtitle={`${type.label} change · raised by ${personName(c.requestedById, directory)} · ${fmtWindow(c)}`}
        actions={
          <>
            {!terminal && next && (
              <Button variant="grad" module={MODULE} icon={ArrowRight} disabled={blockers.length > 0}
                onClick={advance}>{transitionLabel(c, next)}</Button>
            )}
            <div className="relative">
              <IconButton icon={Pencil} label="Change actions" onClick={() => setMenu(v => !v)} />
              <Menu open={menu} onClose={() => setMenu(false)} align="right" width="w-56">
                <MenuLabel>Change actions</MenuLabel>
                {approval && (
                  <MenuItem icon={ExternalLink} label="Open the approval" accent="amber"
                    hint={approval.policyName || 'Approval run'}
                    onClick={() => { setMenu(false); navigate('approvals', null, approval.id); }} />
                )}
                {!terminal && (
                  <MenuItem icon={Ban} label="Cancel this change" accent="red"
                    hint="Withdraw before implementation"
                    onClick={() => { setMenu(false); setCancelling(true); }} />
                )}
                <MenuDivider />
                <MenuItem icon={Trash2} label="Delete the record" accent="red"
                  hint="Removes the audit trail"
                  onClick={() => { setMenu(false); setDeleting(true); }} />
              </Menu>
            </div>
          </>
        }
      >
        <Breadcrumbs
          items={[{ id: 'root', name: 'Changes' }, { id: 'type', name: `${type.label} change` }, { id: c.id, name: c.key }]}
          onNavigate={(item) => { if (item.id === 'root') navigate('changes', view); }}
        />
      </PageHeader>

      <PageBody>
        <div className="@container space-y-3">
          <Stepper change={c} />

          {!!blockers.length && !terminal && next && (
            <Banner accent="amber" icon={ShieldAlert} title={`“${transitionLabel(c, next)}” is blocked`}>
              <ul className="space-y-1.5 mt-1">
                {blockers.map((b, i) => (
                  <li key={i}>
                    <span className={cx('font-medium', t.text)}>{b.text}</span>
                    {b.fix && <span className="block">{b.fix}</span>}
                  </li>
                ))}
              </ul>
            </Banner>
          )}

          <TypeBanner change={c} />

          <div className="grid gap-3 @3xl:grid-cols-3">
            <div className="@3xl:col-span-2 space-y-3">
              <DescriptionPanel change={c} />
              <RiskPanel change={c} />
              <PlanningPanel change={c} />
              {type.approval === 'cab' && (
                <CabPanel change={c} approval={approval} policy={policy} onSubmit={submitForApproval} />
              )}
              {type.approval === 'oncall' && (
                <EmergencyPanel change={c} approval={approval} policy={policy} onSubmit={submitForApproval} />
              )}
              {type.approval === 'none' && <StandardPanel change={c} />}
              <ReviewPanel change={c} />
            </div>

            <div className="space-y-3">
              <SchedulePanel change={c} conflicts={conflicts} freezes={freezes} view={view} />
              <AffectedPanel change={c} />
              <LinksPanel change={c} />
              <PeoplePanel change={c} />
            </div>
          </div>
        </div>
      </PageBody>

      <CancelModal open={cancelling} change={c} onClose={() => setCancelling(false)} />
      <ConfirmDelete
        open={deleting}
        name={c.key}
        kind="change"
        cascadeNote="The risk assessment, plans, approval link and post-implementation review go with it. Cancelling is almost always the right action instead."
        onCancel={() => setDeleting(false)}
        onConfirm={() => { removeFrom('changes', c.id); setDeleting(false); navigate('changes', view); }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Stepper
 * ------------------------------------------------------------------ */

function Stepper({ change: c }) {
  const { t, a } = useTheme();
  const type = typeMeta(c.changeType);
  const path = pathFor(c.changeType);
  const currentIndex = path.indexOf(c.status);
  const cancelled = c.status === 'cancelled';

  return (
    <Card className={cx(DENSITY.cardPad, 'overflow-x-auto')}>
      <div className="flex items-start gap-1 min-w-[40rem]">
        {LIFECYCLE.map((step, i) => {
          const skipped = type.skips.includes(step.key);
          const posInPath = path.indexOf(step.key);
          const done = !cancelled && !skipped && currentIndex >= 0 && posInPath >= 0 && posInPath < currentIndex;
          const active = !cancelled && step.key === c.status;
          const acc = a(active ? HUE : done ? 'emerald' : 'gray');
          const Icon = skipped ? CircleSlashGlyph : done ? Check : step.icon;
          return (
            <React.Fragment key={step.key}>
              {i > 0 && (
                <span className={cx('flex-1 h-px mt-4', done || active ? a('emerald').rail : t.rule)} />
              )}
              <div className="flex flex-col items-center gap-1 w-24 flex-shrink-0" title={skipped ? `${type.label} changes skip ${step.label}` : step.blurb}>
                <span className={cx('w-8 h-8 rounded-full flex items-center justify-center border-2',
                  skipped ? cx(t.bgSubtle, t.borderLight, t.textMuted)
                    : active ? cx(acc.solid, 'border-transparent text-white')
                      : done ? cx(acc.softStrong, acc.borderStrong, acc.fg)
                        : cx(t.bgCard, t.borderLight, t.textMuted))}>
                  <Icon size={ICON.base} />
                </span>
                <span className={cx('text-[11px] font-medium text-center leading-tight',
                  skipped ? t.textMuted : active ? t.text : t.textSecondary)}>{step.label}</span>
                {skipped && <span className={cx('text-[9px] uppercase tracking-wider', t.textMuted)}>skipped</span>}
                {active && <span className={cx('text-[9px] uppercase tracking-wider', a(HUE).fg)}>current</span>}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {cancelled && (
        <div className="mt-3">
          <Banner accent="gray" icon={Ban} title="This change was cancelled">
            {c.cancelReason || 'No reason was recorded.'}
          </Banner>
        </div>
      )}
    </Card>
  );
}

/** A slashed circle for a lifecycle state this change type never enters. */
function CircleSlashGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M4 12L12 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Type banner — the behavioural difference, stated
 * ------------------------------------------------------------------ */

function TypeBanner({ change: c }) {
  const type = typeMeta(c.changeType);
  return (
    <Banner accent={type.hue} icon={type.icon} title={`${type.label} change — ${type.tagline}`}>
      {type.blurb}
    </Banner>
  );
}

/* ------------------------------------------------------------------ *
 * Description
 * ------------------------------------------------------------------ */

function DescriptionPanel({ change: c }) {
  return (
    <Panel icon={GitBranch} accent={HUE} title="What is changing"
      subtitle={`${c.key} · raised ${fmtDate(c.createdAt) === '—' ? 'date not recorded' : fmtDate(c.createdAt)}`}
      action={<EntityTag kind="change" />}>
      <div className={DENSITY.cardPad}>
        <Textarea
          accent={HUE}
          rows={4}
          value={c.description}
          placeholder="Describe the change in the words a board member who does not work on this system would use."
          onChange={(e) => patchIn('changes', c.id, { description: e.target.value })}
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Risk + impact
 * ------------------------------------------------------------------ */

function RiskPanel({ change: c }) {
  const { t, a } = useTheme();
  const risk = effectiveRisk(c);
  const scored = risk.scored;
  const rm = riskMeta(risk.key);
  const im = IMPACT[c.impact];
  const cell = matrixCell(risk.key, c.impact);

  function answer(qid, value) {
    const answers = { ...c.riskAnswers, [qid]: value };
    patchIn('changes', c.id, { riskAnswers: answers, risk: bandFor(assessRisk(answers).points).key });
  }

  return (
    <Panel
      icon={Gauge} accent={rm.hue}
      title="Risk assessment"
      subtitle={`${scored.answered} of ${scored.total} questions answered · ${scored.points} of ${scored.max} risk points`}
      action={<Chip accent={rm.hue} icon={Gauge}>{rm.label} risk</Chip>}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-4')}>
        {risk.source === 'stored' && (
          <Banner accent="amber" icon={CircleAlert} title="This risk value was carried in, not derived">
            The questionnaire has not been answered on this change, so RelayHQ is showing the stored value
            <strong> {rm.label}</strong>. Answer the {scored.total} questions and the value becomes derived and auditable.
          </Banner>
        )}
        {risk.source === 'derived' && c.storedRisk && c.storedRisk !== risk.key && (
          <Banner accent="amber" icon={CircleAlert} title="The derived value disagrees with the one on the record">
            The record was raised as <strong>{riskMeta(c.storedRisk).label}</strong>; the answers below score
            <strong> {rm.label}</strong>. The derivation wins, because it can be checked. If the stored value was
            right, the answer that is wrong is on this page.
          </Banner>
        )}
        {risk.source === 'partial' && (
          <Banner accent="amber" icon={CircleAlert} title="Provisional score">
            {scored.answered} of {scored.total} questions answered. The band below can still move — an unanswered
            question scores zero, which flatters the change.
          </Banner>
        )}

        {/* The questionnaire */}
        <div className="space-y-3">
          {RISK_QUESTIONS.map(q => (
            <Field key={q.id} label={q.prompt}>
              {q.kind === 'yesno' ? (
                <TileGroup
                  columns={2}
                  value={c.riskAnswers[q.id] === true ? 'yes' : c.riskAnswers[q.id] === false ? 'no' : c.riskAnswers[q.id]}
                  onChange={(v) => answer(q.id, v)}
                  options={[
                    { value: 'yes', label: 'Yes', icon: Check, accent: q.risky === 'yes' ? 'red' : 'emerald', hint: q.notes.yes },
                    { value: 'no', label: 'No', icon: X, accent: q.risky === 'no' ? 'red' : 'emerald', hint: q.notes.no },
                  ]}
                />
              ) : (
                <TileGroup
                  columns={4}
                  value={c.riskAnswers[q.id]}
                  onChange={(v) => answer(q.id, v)}
                  options={q.options.map(o => ({
                    value: o.value, label: o.label, hint: `+${o.points}`,
                    accent: o.points >= 3 ? 'red' : o.points === 2 ? 'orange' : o.points === 1 ? 'amber' : 'emerald',
                  }))}
                />
              )}
            </Field>
          ))}
        </div>

        <Divider />

        {/* The derivation — the whole reason this is not a dropdown */}
        <div>
          <GroupLabel>How that risk value was reached</GroupLabel>
          <div className={cx('mt-2 rounded-lg border overflow-hidden', t.borderLight)}>
            {scored.rows.map((r, i) => (
              <div key={r.q.id} className={cx('flex items-center gap-2 px-3 py-1.5 text-xs',
                i > 0 && 'border-t', t.borderLight)}>
                <span className={cx('flex-1 min-w-0 truncate', r.answer == null ? t.textMuted : t.textSecondary)}>
                  {r.q.prompt}
                </span>
                {r.answer == null
                  ? <Chip accent="gray">Unanswered</Chip>
                  : <Chip accent={r.points > 0 ? 'red' : 'emerald'} title={r.note || ''}>{r.label}</Chip>}
                <span className={cx('w-10 text-right font-mono tabular-nums',
                  r.points > 0 ? a('red').fg : t.textMuted)}>
                  {r.points > 0 ? `+${r.points}` : '0'}
                </span>
              </div>
            ))}
            <div className={cx('flex items-center gap-2 px-3 py-2 border-t', t.borderLight, t.bgSubtle)}>
              <span className={cx('flex-1 text-xs font-medium', t.text)}>Total</span>
              <span className={cx('font-mono tabular-nums text-sm font-semibold', t.text)}>
                {scored.points} / {scored.max}
              </span>
            </div>
          </div>

          {/* Band ladder */}
          <div className="mt-3">
            <div className="flex gap-1">
              {RISK_BANDS.map(b => {
                const acc = a(b.hue);
                const active = b.key === scored.band.key;
                return (
                  <div key={b.key}
                    style={{ flexGrow: b.max - b.min + 1 }}
                    className={cx('rounded px-2 py-1 text-[10px] font-medium text-center border',
                      active ? cx(acc.softStrong, acc.borderStrong, acc.fgOnSoft) : cx(t.bgSubtle, 'border-transparent', t.textMuted))}>
                    {b.label} · {b.min}–{b.max}
                  </div>
                );
              })}
            </div>
            <p className={cx('text-[11px] mt-1.5', t.textSecondary)}>
              {scored.points} points lands in <strong className={a(scored.band.hue).fg}>{scored.band.label}</strong>.
              {' '}Risk answers the question “how likely is this to go wrong, and can we get back?” — impact answers “who hurts if it does”.
            </p>
          </div>
        </div>

        <Divider />

        {/* Impact + matrix */}
        <div className="grid gap-4 @2xl:grid-cols-2">
          <div>
            <GroupLabel>Impact if it goes wrong</GroupLabel>
            <div className="mt-2">
              <TileGroup
                columns={3}
                value={c.impact}
                onChange={(v) => patchIn('changes', c.id, { impact: v })}
                options={SCALE_KEYS.map(k => ({
                  value: k, label: IMPACT[k].label, hint: IMPACT[k].blurb, accent: IMPACT[k].hue, icon: Boxes,
                }))}
              />
            </div>
          </div>
          <div>
            <GroupLabel>Risk × impact</GroupLabel>
            <RiskMatrix risk={risk.key} impact={c.impact} />
          </div>
        </div>

        <Banner accent={cell.hue} icon={Scale} title={`${cell.label} — ${rm.label} risk × ${im.label} impact`}>
          {cell.guidance}
        </Banner>
      </div>
    </Panel>
  );
}

function RiskMatrix({ risk, impact }) {
  const { t, a } = useTheme();
  return (
    <div className="mt-2">
      <div className="grid grid-cols-4 gap-1 text-[10px]">
        <div />
        {SCALE_KEYS.slice().reverse().map(k => (
          <div key={k} className={cx('text-center font-semibold uppercase tracking-wider py-0.5', t.textMuted)}>
            {IMPACT[k].label}
          </div>
        ))}
        {SCALE_KEYS.map(rk => (
          <React.Fragment key={rk}>
            <div className={cx('flex items-center justify-end pr-1 font-semibold uppercase tracking-wider', t.textMuted)}>
              {riskMeta(rk).label}
            </div>
            {SCALE_KEYS.slice().reverse().map(ik => {
              const cell = matrixCell(rk, ik);
              const acc = a(cell.hue);
              const here = rk === risk && ik === impact;
              return (
                <div key={ik}
                  title={`${riskMeta(rk).label} risk × ${IMPACT[ik].label} impact — ${cell.label}. ${cell.guidance}`}
                  className={cx('rounded h-9 flex items-center justify-center font-medium border-2',
                    acc.softStrong, acc.fgOnSoft,
                    here ? acc.borderStrong : 'border-transparent', here ? '' : 'opacity-50')}>
                  {here ? cell.label : ''}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <p className={cx('text-[10px] mt-1 text-right', t.textMuted)}>impact →</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Planning
 * ------------------------------------------------------------------ */

function PlanningPanel({ change: c }) {
  const { t } = useTheme();
  const gaps = planningGaps(c);
  return (
    <Panel
      icon={ClipboardCheck} accent={gaps.length ? 'amber' : 'emerald'}
      title="Planning"
      subtitle={gaps.length
        ? `${gaps.length} of ${PLANS.length} documents still empty`
        : 'All four planning documents are complete'}
      action={<Chip accent={gaps.length ? 'amber' : 'emerald'} icon={gaps.length ? CircleAlert : CircleCheck}>
        {PLANS.length - gaps.length}/{PLANS.length}
      </Chip>}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        {!!gaps.length && (
          <Banner accent="amber" icon={ShieldAlert} title="These block the change leaving assessment">
            {gaps.map(g => g.label).join(', ')}. A board cannot authorise work whose steps, backout and test are
            not written down — and nobody can run it at 22:00 on a Saturday from memory.
          </Banner>
        )}
        {PLANS.map(p => (
          <Field key={p.id} label={p.label} hint={p.hint} required error={String(c[p.id] || '').trim() ? undefined : 'Required before authorisation'}>
            <Textarea
              accent={HUE}
              rows={p.id === 'justification' ? 2 : 4}
              value={c[p.id]}
              placeholder={p.hint}
              onChange={(e) => patchIn('changes', c.id, { [p.id]: e.target.value })}
            />
          </Field>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * CAB — normal changes only
 * ------------------------------------------------------------------ */

function CabPanel({ change: c, approval, policy, onSubmit }) {
  const { t, a } = useTheme();
  const directory = useStore(s => s.directory || []);
  const queues = useStore(s => s.queues || []);
  const currentUser = useStore(s => s.currentUser);
  const [vote, setVote] = useState(null);     // { approverId }

  if (!approval) {
    return (
      <Panel icon={Stamp} accent="amber" title="Change Advisory Board" subtitle="No approval raised yet">
        <div className={cx(DENSITY.cardPad, 'space-y-3')}>
          <Banner accent="amber" icon={Info} title={policy?.name || 'Normal change approval'}>
            {policy?.description}
            {policyIsFallback(policy) && (
              <span className="block mt-1">
                <strong className={t.text}>Note.</strong> The policy <code>{POL.NORMAL_CHANGE}</code> is not configured in
                Business Rules yet, so RelayHQ is using its built-in board definition. Configure the policy to change who sits on the board.
              </span>
            )}
          </Banner>
          {/* A spec may name a queue or a role rather than a person, so let the
              approvals engine describe it — `spec.userId` is often undefined. */}
          <div className="flex flex-wrap gap-1.5">
            {(policy?.stages?.[0]?.approvers || []).map((spec, i) => (
              <Chip key={i} accent="amber" icon={User}>{describeApprover(spec, { directory, queues })}</Chip>
            ))}
          </div>
          <Button variant="soft" accent="amber" icon={Stamp} onClick={onSubmit}>Submit to the CAB</Button>
        </div>
      </Panel>
    );
  }

  const p = safeProgress(approval);
  const stages = safeStages(approval);
  const stateHue = approval.state === 'approved' ? 'emerald' : approval.state === 'rejected' ? 'red' : 'amber';

  return (
    <Panel
      icon={Stamp} accent={stateHue}
      title="Change Advisory Board"
      subtitle={`${approval.policyName || policy?.name} · stage ${p.stageNumber} of ${p.totalStages}`}
      action={
        <div className="flex items-center gap-2">
          <StatusPill status={approval.state} />
          <Button variant="outline" size="xs" icon={ExternalLink}
            onClick={() => navigate('approvals', null, approval.id)}>Approvals</Button>
        </div>
      }
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        {policyIsFallback(policy) && (
          <Banner accent="blue" icon={Info}>
            Running against RelayHQ's built-in board definition — <code>{POL.NORMAL_CHANGE}</code> has not been
            configured in Business Rules.
          </Banner>
        )}

        {!stages.length && (
          <Banner accent="red" icon={ShieldAlert} title="This approval has no stages">
            The record exists but resolves to nobody. RelayHQ will not read that as “approved”.
          </Banner>
        )}

        {stages.map((stage, si) => {
          const need = stageQuorum(stage);
          const approvals = stage.decisions.filter(d => d.verdict === 'approved').length;
          const current = si === (approval.currentStage || 0);
          return (
            <div key={stage.id || si} className={cx('rounded-lg border', t.borderLight, current && a(stateHue).border)}>
              <div className={cx('flex items-center gap-2 px-3 py-2 border-b', t.borderLight, t.bgSubtle)}>
                <Stamp size={ICON.base} className={t.textMuted} />
                <span className={cx('text-sm font-medium flex-1 truncate', t.text)}>{stage.name}</span>
                <Chip accent={approvals >= need ? 'emerald' : 'amber'}>
                  quorum {approvals} of {need}
                </Chip>
                <StatusPill status={stage.state === 'pending' ? 'todo' : stage.state} />
              </div>

              {stage.unresolved && (
                <div className="p-3">
                  <Banner accent="red" icon={ShieldAlert} title="This stage resolved to nobody">
                    The approver specification matched no one in the directory. RelayHQ will not treat that as
                    “nobody needs to approve” — fix the policy in Business Rules.
                  </Banner>
                </div>
              )}

              <div className={cx('divide-y', t.borderLight)}>
                {stage.approverIds.map(id => {
                  const d = stage.decisions.find(x => x.approverId === id);
                  const isMe = id === currentUser?.id;
                  const may = current && approval.state === 'awaiting' && !d;
                  return (
                    <div key={id} className="flex items-center gap-2 px-3 py-2">
                      <Avatar name={personName(id, directory)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={cx('text-xs font-medium truncate', t.text)}>
                          {personName(id, directory)}{isMe && ' (you)'}
                        </p>
                        {d?.comment && <p className={cx('text-[11px] truncate', t.textMuted)}>“{d.comment}”</p>}
                        {!d && current && <p className={cx('text-[11px]', t.textMuted)}>Awaiting decision</p>}
                      </div>
                      {d
                        ? <>
                            <span className={cx('text-[11px]', t.textMuted)}>{fmtDate(d.at)}</span>
                            <Chip accent={d.verdict === 'approved' ? 'emerald' : 'red'}
                              icon={d.verdict === 'approved' ? Check : X}>
                              {d.verdict === 'approved' ? 'Approved' : 'Rejected'}
                            </Chip>
                          </>
                        : may && (
                          <Button variant={isMe ? 'soft' : 'ghost'} size="xs"
                            accent={isMe ? 'emerald' : 'gray'} icon={Stamp}
                            onClick={() => setVote({ approverId: id })}>
                            {isMe ? 'Cast your vote' : 'Record vote'}
                          </Button>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {approval.state === 'approved' && (
          <Banner accent="emerald" icon={CircleCheck} title="The board authorised this change">
            RelayHQ does not book the window for you — press <strong>{transitionLabel(c, 'scheduled')}</strong> when the
            implementer has confirmed they can take the slot.
          </Banner>
        )}
        {approval.state === 'rejected' && (
          <Banner accent="red" icon={CircleX} title="The board rejected this change">
            Revise the plan and raise a replacement, or cancel this record. A rejected change cannot be advanced.
          </Banner>
        )}
      </div>

      <VoteModal
        open={!!vote}
        approval={approval}
        approverId={vote?.approverId}
        onClose={() => setVote(null)}
      />
    </Panel>
  );
}

function VoteModal({ open, approval, approverId, onClose }) {
  const { t } = useTheme();
  const directory = useStore(s => s.directory || []);
  const currentUser = useStore(s => s.currentUser);
  const [comment, setComment] = useState('');

  React.useEffect(() => { if (open) setComment(''); }, [open, approverId]);
  if (!open || !approval || !approverId) return null;

  const name = personName(approverId, directory);
  const onBehalf = approverId !== currentUser?.id;

  function cast(verdict) {
    patchIn('approvals', approval.id, (prev) =>
      decide(prev, { approverId, verdict, comment, now: new Date().toISOString() }));
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent="amber"
      size="modalSm"
      icon={Stamp}
      title={`Record ${name}'s decision`}
      subtitle={approval.subject}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="soft" accent="red" icon={X} onClick={() => cast('rejected')}>Reject</Button>
            <Button variant="solid" accent="emerald" icon={Check} onClick={() => cast('approved')}>Approve</Button>
          </div>
        </>
      }
    >
      <div className="space-y-3">
        {onBehalf && (
          <Banner accent="amber" icon={CircleAlert} title="Recording on behalf of a board member">
            You are signed in as {currentUser?.name || 'this user'}. In the demo you may record any board member's
            vote so the quorum can be reached; a live deployment restricts this to the approver themselves.
          </Banner>
        )}
        <Field label="Comment" hint="Boards remember reasons, not verdicts. One sentence is enough.">
          <Textarea accent="amber" rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. Backout is rehearsed and the window is outside the retail peak." />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Emergency authorisation
 * ------------------------------------------------------------------ */

function EmergencyPanel({ change: c, approval, policy, onSubmit }) {
  const { t } = useTheme();
  const directory = useStore(s => s.directory || []);
  const queues = useStore(s => s.queues || []);
  const [vote, setVote] = useState(null);

  const stages = safeStages(approval);
  const stage = stages[approval?.currentStage || 0] || stages[0] || null;

  return (
    <Panel
      icon={Siren} accent="red"
      title="On-call authorisation"
      subtitle={policy?.name || 'Emergency change authority'}
      action={approval ? <StatusPill status={approval.state} /> : <Chip accent="red" icon={Clock}>Not yet requested</Chip>}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Banner accent="red" icon={Siren} title="Emergency changes are authorised by one person, not a board">
          The on-call change authority can approve at any hour so the fix is not held behind the next CAB sitting.
          The trade is retrospective scrutiny: the board reviews this record, its outcome and its timeline at the
          next meeting, and an emergency raised to dodge the CAB is where that goes badly.
        </Banner>

        {!approval && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {(policy?.stages?.[0]?.approvers || []).map((spec, i) => (
                <Chip key={i} accent="red" icon={User}>{describeApprover(spec, { directory, queues })}</Chip>
              ))}
            </div>
            <Button variant="solid" accent="red" icon={Siren} onClick={onSubmit}>Page the on-call authority</Button>
          </>
        )}

        {approval && stage && (
          <div className={cx('rounded-lg border', t.borderLight)}>
            <div className={cx('flex items-center gap-2 px-3 py-2 border-b', t.borderLight, t.bgSubtle)}>
              <span className={cx('text-sm font-medium flex-1', t.text)}>{stage.name}</span>
              <Chip accent="red">any one authorises</Chip>
            </div>
            <div className={cx('divide-y', t.borderLight)}>
              {stage.approverIds.map(id => {
                const d = stage.decisions.find(x => x.approverId === id);
                return (
                  <div key={id} className="flex items-center gap-2 px-3 py-2">
                    <Avatar name={personName(id, directory)} size="sm" />
                    <span className={cx('text-xs flex-1 truncate', t.text)}>{personName(id, directory)}</span>
                    {d
                      ? <Chip accent={d.verdict === 'approved' ? 'emerald' : 'red'}>{d.verdict === 'approved' ? 'Authorised' : 'Refused'}</Chip>
                      : approval.state === 'awaiting' && (
                        <Button variant="soft" size="xs" accent="red" icon={Stamp}
                          onClick={() => setVote({ approverId: id })}>Record</Button>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {approval?.state === 'approved' && (
          <Banner accent="amber" icon={ClipboardCheck} title="Retrospective CAB review is now owed">
            Record the outcome honestly at close. The retrospective is the only control an emergency change has.
          </Banner>
        )}
      </div>

      <VoteModal open={!!vote} approval={approval} approverId={vote?.approverId} onClose={() => setVote(null)} />
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Standard — deliberately NO CAB panel
 * ------------------------------------------------------------------ */

function StandardPanel({ change: c }) {
  const { t } = useTheme();
  const template = STANDARD_TEMPLATES.find(x => x.id === c.templateId) || null;
  return (
    <Panel icon={ShieldCheck} accent="emerald" title="Pre-approved" subtitle="No CAB stage — by design">
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Banner accent="emerald" icon={ShieldCheck} title="This change was authorised before it was raised">
          A standard change runs an approved procedure that the CAB signed off once, as a template. There is no
          board panel on this record because there is no board decision to make — that is the whole economic
          argument for standard change: it takes routine work off the board's agenda.
        </Banner>
        {template && (
          <div className={cx('rounded-lg border px-3 py-2', t.borderLight)}>
            <GroupLabel>Template</GroupLabel>
            <p className={cx('text-sm font-medium mt-0.5', t.text)}>{template.name}</p>
            <p className={cx('text-xs mt-0.5', t.textSecondary)}>
              Plans below were filled from the approved procedure. Editing them here does not change the template.
            </p>
          </div>
        )}
        {!template && (
          <p className={cx('text-xs', t.textSecondary)}>
            No template is recorded on this change. Standard changes should always name the procedure they run,
            because the procedure is what carries the approval.
          </p>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Post-implementation review
 * ------------------------------------------------------------------ */

function ReviewPanel({ change: c }) {
  const { t } = useTheme();
  const reviewable = ['implement', 'review', 'closed'].includes(c.status);
  if (!reviewable) return null;

  const closed = c.status === 'closed';
  const outcome = c.outcome ? OUTCOMES[c.outcome] : null;

  return (
    <Panel
      icon={ClipboardCheck}
      accent={outcome ? outcome.hue : 'violet'}
      title="Post-implementation review"
      subtitle={closed
        ? `Closed ${fmtDateTime(c.actualEnd || c.plannedEnd)}`
        : 'Recorded at close — the outcome, not the intention'}
      action={outcome ? <Chip accent={outcome.hue} icon={outcome.icon}>{outcome.label}</Chip> : null}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        {c.changeType === 'emergency' && (
          <Banner accent="amber" icon={Siren} title="This review goes to the CAB retrospectively">
            The board reads emergency reviews at its next sitting. An emergency that was really a normal change
            shows up here, in the gap between the justification and the outcome.
          </Banner>
        )}

        <Field label="Outcome" hint="Four honest options. “Successful with issues” exists because most real changes land there.">
          <TileGroup
            columns={4}
            value={c.outcome || ''}
            onChange={(v) => patchIn('changes', c.id, { outcome: v })}
            options={Object.values(OUTCOMES).map(o => ({
              value: o.key, label: o.label, icon: o.icon, accent: o.hue, hint: o.blurb,
            }))}
          />
        </Field>

        <Field label="Review notes" hint="What actually happened, what was learned, and whether the backout was needed.">
          <Textarea
            accent={HUE} rows={3} value={c.reviewNotes}
            placeholder="e.g. Completed 40 minutes inside the window. Replica lag spiked to 90s during cutover; reporting was stale for six minutes. No backout required."
            onChange={(e) => patchIn('changes', c.id, { reviewNotes: e.target.value })}
          />
        </Field>

        {!!c.followUps.length && (
          <div>
            <GroupLabel>Follow-ups this review produced</GroupLabel>
            <ul className={cx('mt-1.5 space-y-1 text-xs', t.textSecondary)}>
              {c.followUps.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CornerDownRight size={ICON.sm} className={cx(t.textMuted, 'flex-shrink-0 mt-0.5')} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={cx('grid grid-cols-2 gap-2 text-xs', t.textSecondary)}>
          <div><GroupLabel>Actual start</GroupLabel><p className={cx('mt-0.5', t.text)}>{fmtDateTime(c.actualStart)}</p></div>
          <div><GroupLabel>Actual end</GroupLabel><p className={cx('mt-0.5', t.text)}>{fmtDateTime(c.actualEnd)}</p></div>
        </div>

        {c.status === 'review' && (
          <Button
            variant="solid" accent="emerald" icon={CircleCheck}
            disabled={!c.outcome}
            onClick={() => patchIn('changes', c.id, { status: 'closed', actualEnd: c.actualEnd || new Date().toISOString() })}
          >
            Close change
          </Button>
        )}
        {c.status === 'review' && !c.outcome && (
          <p className={cx('text-[11px]', t.textMuted)}>
            Pick an outcome first. A change closed without one is indistinguishable from a change nobody checked.
          </p>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Schedule, conflicts, freeze
 * ------------------------------------------------------------------ */

function SchedulePanel({ change: c, conflicts, freezes, view }) {
  const { t } = useTheme();
  const inWindow = insideMaintenanceWindow(c.plannedStart);
  const dur = hoursBetween(c.plannedStart, c.plannedEnd);

  return (
    <Panel
      icon={CalendarDays} accent={conflicts.length || freezes.length ? 'red' : 'violet'}
      title="Window"
      subtitle={dur != null ? `${dur} hours` : 'Not booked'}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Field label="Planned start">
          <Input accent={HUE} type="datetime-local" value={toLocalInput(c.plannedStart)}
            onChange={(e) => patchIn('changes', c.id, { plannedStart: fromLocalInput(e.target.value) })} />
        </Field>
        <Field label="Planned end">
          <Input accent={HUE} type="datetime-local" value={toLocalInput(c.plannedEnd)}
            onChange={(e) => patchIn('changes', c.id, { plannedEnd: fromLocalInput(e.target.value) })} />
        </Field>

        {c.changeType === 'emergency' && (
          <Banner accent="red" icon={Siren}>
            Emergency changes are not scheduled. The window here is a record of when the work ran, not a booking.
          </Banner>
        )}

        {c.plannedStart && inWindow === false && c.changeType !== 'emergency' && (
          <Banner accent="amber" icon={Clock} title="Outside the approved maintenance windows">
            Northwind's windows are {MAINTENANCE_WINDOWS.map(w => w.label).join(' and ')}. Working outside one is
            allowed, but the board will ask why, and the answer has to be better than “it was convenient”.
          </Banner>
        )}

        {!!freezes.length && (
          <Banner accent="red" icon={Snowflake}
            title={`Inside ${freezes.length === 1 ? 'a freeze window' : `${freezes.length} freeze windows`}`}>
            {freezes.map(f => (
              <span key={f.id} className="block mt-1">
                <strong className={t.text}>{f.name}</strong> ({fmtDate(f.start)} – {fmtDate(f.end)}, {f.scope}). {f.reason}
              </span>
            ))}
            {c.changeType === 'emergency'
              ? <span className="block mt-1">Emergency change is permitted inside a freeze, but the freeze owner must be on the call.</span>
              : <span className="block mt-1">Move the window, or raise the work as an emergency change.</span>}
          </Banner>
        )}

        {!!conflicts.length && (
          <Banner accent="red" icon={TriangleAlert}
            title={`Conflicts with ${conflicts.length} other change${conflicts.length === 1 ? '' : 's'}`}>
            {conflicts.map(({ other, products, assets, services }) => (
              <ConflictLine key={other.id} other={other} products={products} assets={assets}
                services={services} view={view} />
            ))}
          </Banner>
        )}

        <div className={cx('text-[11px]', t.textMuted)}>
          <p><strong className={t.textSecondary}>Actual:</strong> {fmtDateTime(c.actualStart)} → {fmtDateTime(c.actualEnd)}</p>
        </div>
      </div>
    </Panel>
  );
}

function ConflictLine({ other, products, assets, services, view }) {
  const { t } = useTheme();
  const catalog = useCatalogServices();
  const assetRecords = useStore(s => s.assets || []);
  const shared = [
    ...products.map(id => nameOfService(id, catalog)),
    ...assets.map(id => nameOfAsset(id, assetRecords)),
    ...(services || []),
  ];
  return (
    <span className="block mt-1.5">
      <button className={cx('font-medium underline', t.text)} onClick={() => navigate('changes', view, other.id)}>
        {other.key} · {other.title}
      </button>
      <span className="block">
        Its window ({fmtWindow(other)}) overlaps this one, and both touch{' '}
        <strong className={t.text}>{shared.join(', ')}</strong>. Two teams working the same component at the same
        time is how a clean backout stops being possible.
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Affected services and assets
 * ------------------------------------------------------------------ */

function AffectedPanel({ change: c }) {
  const { t } = useTheme();
  const catalog = useCatalogServices();
  const assets = useStore(s => s.assets || []);
  const locations = useStore(s => s.locations || []);
  const [editing, setEditing] = useState(false);
  const touched = c.affectedProductIds.length + c.affectedServices.length;

  return (
    <Panel
      icon={Boxes} accent="amber" title="Affected"
      subtitle={`${touched} service${touched === 1 ? '' : 's'} · ${c.affectedAssetIds.length} asset${c.affectedAssetIds.length === 1 ? '' : 's'}`}
      action={<IconButton icon={Pencil} label="Edit affected items" accent="amber" onClick={() => setEditing(true)} />}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <div>
          <GroupLabel>Catalog services</GroupLabel>
          <div className="mt-1.5">
            <ChipGroup
              items={c.affectedProductIds}
              render={(id) => nameOfService(id, catalog)}
              max={4}
              accent={ENTITIES.item.hue}
              icon={Package}
              empty={<p className={cx('text-xs', t.textMuted)}>No catalog service recorded — conflict detection cannot see this change.</p>}
            />
          </div>
        </div>
        {!!c.affectedServices.length && (
          <div>
            <GroupLabel>Components</GroupLabel>
            <div className="mt-1.5">
              <ChipGroup items={c.affectedServices} max={4} accent="slate" icon={Server} />
            </div>
          </div>
        )}
        <div>
          <GroupLabel>Assets</GroupLabel>
          <div className="mt-1.5">
            <ChipGroup
              items={c.affectedAssetIds}
              render={(id) => nameOfAsset(id, assets)}
              max={4}
              accent={ENTITIES.hardware.hue}
              icon={Server}
              empty={<p className={cx('text-xs', t.textMuted)}>No asset recorded.</p>}
            />
          </div>
        </div>
        {!!c.affectedLocationIds.length && (
          <div>
            <GroupLabel>Locations</GroupLabel>
            <div className="mt-1.5">
              <ChipGroup
                items={c.affectedLocationIds}
                render={(id) => nameOfLocation(id, locations)}
                max={4}
                accent={ENTITIES.location.hue}
                icon={Boxes}
              />
            </div>
          </div>
        )}
        <Banner accent="blue" icon={Info}>
          Conflict detection compares these lists. Two changes overlapping in time only conflict when they share
          a service, a component or an asset — which is why leaving them empty makes a change look safer than it is.
        </Banner>
      </div>

      <AffectedModal open={editing} change={c} onClose={() => setEditing(false)} />
    </Panel>
  );
}

function AffectedModal({ open, change: c, onClose }) {
  const { t } = useTheme();
  const catalog = useCatalogServices();
  const assets = useStore(s => s.assets || []);
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of catalog.items) {
      const key = item.path || 'Catalog';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    return [...map.entries()];
  }, [catalog]);

  // Toggle against the RESOLVED list — a seeded change stores its services as
  // `affectedCatalogItemIds`, so reading `prev.affectedProductIds` would start
  // from empty and wipe what the record already touches.
  function toggle(field, id) {
    const current = c[field] || [];
    patchIn('changes', c.id, { [field]: current.includes(id) ? current.filter(x => x !== id) : [...current, id] });
  }

  return (
    <Modal
      open={open} onClose={onClose} accent={HUE} size="modalMd" icon={Boxes}
      title="Affected services and assets" subtitle={`${c.key} · drives conflict detection`}
      footer={<><span className={cx('text-xs', t.textMuted)}>Saved as you toggle</span>
        <Button variant="solid" accent={HUE} icon={Check} onClick={onClose}>Done</Button></>}
    >
      <div className="space-y-4">
        <div>
          <GroupLabel>Catalog services</GroupLabel>
          {catalog.items.length ? (
            <div className="mt-2 space-y-2 max-h-72 overflow-auto">
              {groups.map(([path, items]) => (
                <div key={path}>
                  <p className={cx('text-[10px] uppercase tracking-wider mb-1', t.textMuted)}>{path}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map(p => {
                      const on = c.affectedProductIds.includes(p.id);
                      return (
                        <button key={p.id} onClick={() => toggle('affectedProductIds', p.id)}>
                          <Chip accent={on ? ENTITIES.item.hue : 'gray'} icon={on ? Check : Package}>{p.name}</Chip>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={cx('text-xs mt-2', t.textMuted)}>
              No catalog services are configured yet. Services can still be recorded on the change by the catalog module's ids.
            </p>
          )}
        </div>

        {!!c.affectedServices.length && (
          <div>
            <GroupLabel>Components named on this change</GroupLabel>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.affectedServices.map(s => <Chip key={s} accent="slate" icon={Server}>{s}</Chip>)}
            </div>
            <p className={cx('text-[11px] mt-1.5', t.textSecondary)}>
              Free-text components carried on the record. They are compared for conflicts too, but only an exact
              name matches — the catalog ids above are the reliable half.
            </p>
          </div>
        )}

        <Divider />

        <div>
          <GroupLabel>Assets</GroupLabel>
          {assets.length ? (
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-60 overflow-auto">
              {assets.slice(0, 60).map(a => {
                const on = c.affectedAssetIds.includes(a.id);
                return (
                  <button key={a.id} onClick={() => toggle('affectedAssetIds', a.id)}>
                    <Chip accent={on ? ENTITIES.hardware.hue : 'gray'} icon={on ? Check : Server}>
                      {a.name || a.assetTag || a.id}
                    </Chip>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={cx('text-xs mt-2', t.textMuted)}>No assets are registered yet.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Typed links
 * ------------------------------------------------------------------ */

function LinksPanel({ change: c }) {
  const { t, a } = useTheme();
  const tickets = useStore(s => s.tickets || []);
  const problems = useStore(s => s.problems || []);
  const changes = useStore(s => s.changes || []);
  const [adding, setAdding] = useState(false);

  return (
    <Panel
      icon={Link2} accent="slate" title="Linked records"
      subtitle={c.links.length ? `${c.links.length} typed link${c.links.length === 1 ? '' : 's'}` : 'Nothing linked yet'}
      action={<IconButton icon={Plus} label="Link a record" accent="slate" onClick={() => setAdding(true)} />}
    >
      <div className={cx(DENSITY.cardPad, 'space-y-2')}>
        {!c.links.length && (
          <p className={cx('text-xs', t.textMuted)}>
            Link the problem that caused this change and the tickets it resolves. The link type is what makes a
            change record auditable six months later.
          </p>
        )}
        {c.links.map((link, i) => {
          const lm = linkMeta(link.type);
          const target = resolveLink(link, { tickets, problems, changes });
          const acc = a(target.hue);
          return (
            <div key={`${link.type}-${link.id}-${i}`} className={cx('flex items-center gap-2 rounded-lg border px-2 py-1.5', t.borderLight)}>
              <Chip accent={lm.hue} icon={lm.icon}>{lm.label}</Chip>
              <target.icon size={ICON.base} className={cx(acc.fg, 'flex-shrink-0')} />
              <button
                className={cx('flex-1 min-w-0 text-left', target.to ? 'hover:underline' : 'cursor-default')}
                onClick={() => target.to && navigate(target.to[0], target.to[1], link.id)}
              >
                <span className={cx('text-xs block truncate', t.text)}>{target.label}</span>
                <span className={cx('text-[10px] font-mono', t.textMuted)}>{target.ref}</span>
              </button>
              {/* Write the resolved list, not `prev.links`: a seeded change
                  carries its links as two id arrays, and patching a field it
                  does not have yet would silently drop the rest. */}
              <IconButton icon={X} label="Remove link" accent="red"
                onClick={() => patchIn('changes', c.id, { links: c.links.filter((l, idx) => idx !== i) })} />
            </div>
          );
        })}
      </div>

      <AddLinkModal open={adding} change={c} onClose={() => setAdding(false)} />
    </Panel>
  );
}

function AddLinkModal({ open, change: c, onClose }) {
  const { t, a } = useTheme();
  const tickets = useStore(s => s.tickets || []);
  const problems = useStore(s => s.problems || []);
  const [type, setType] = useState('caused_by');
  const [q, setQ] = useState('');

  React.useEffect(() => { if (open) { setType('caused_by'); setQ(''); } }, [open]);

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = [
      ...problems.map(p => ({ id: p.id, kind: 'problem', hue: ENTITIES.problem.hue, icon: OctagonAlert, label: p.title || p.id, ref: p.key || p.id })),
      ...tickets.map(t2 => ({ id: t2.id, kind: 'ticket', hue: ENTITIES.ticket.hue, icon: Inbox, label: t2.subject || t2.title || t2.id, ref: t2.key || t2.id })),
    ];
    const linked = new Set(c.links.map(l => l.id));
    return rows
      .filter(r => !linked.has(r.id))
      .filter(r => !needle || `${r.ref} ${r.label}`.toLowerCase().includes(needle))
      .slice(0, 40);
  }, [problems, tickets, q, c.links]);

  function add(id) {
    patchIn('changes', c.id, { links: [...c.links, { type, id }] });
    onClose();
  }

  return (
    <Modal
      open={open} onClose={onClose} accent={HUE} size="modalMd" icon={Link2}
      title="Link a record" subtitle={`${c.key} · typed links`}
      footer={<><span className={cx('text-xs', t.textMuted)}>{linkMeta(type).hint}</span>
        <Button variant="outline" onClick={onClose}>Close</Button></>}
    >
      <div className="space-y-3">
        <Field label="Link type">
          <TileGroup
            columns={4} value={type} onChange={setType}
            options={Object.values(LINK_TYPES).map(l => ({ value: l.key, label: l.label, icon: l.icon, accent: l.hue }))}
          />
        </Field>
        <Field label="Record">
          <SearchInput value={q} onChange={setQ} placeholder="Search problems and tickets…" accent={HUE} />
        </Field>
        <div className={cx('rounded-lg border divide-y max-h-72 overflow-auto', t.borderLight)}>
          {candidates.map(r => (
            <button key={r.id} onClick={() => add(r.id)}
              className={cx('w-full flex items-center gap-2 px-3 py-2 text-left', t.bgHover)}>
              <r.icon size={ICON.base} className={a(r.hue).fg} />
              <span className="flex-1 min-w-0">
                <span className={cx('text-sm block truncate', t.text)}>{r.label}</span>
                <span className={cx('text-[10px] font-mono', t.textMuted)}>{r.ref}</span>
              </span>
              <Plus size={ICON.base} className={t.textMuted} />
            </button>
          ))}
          {!candidates.length && (
            <p className={cx('text-xs px-3 py-4 text-center', t.textMuted)}>
              Nothing to link. Problems and tickets are authored in their own modules.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */

function PeoplePanel({ change: c }) {
  const { t } = useTheme();
  const directory = useStore(s => s.directory || []);

  return (
    <Panel icon={User} accent="blue" title="People" subtitle="Who asked, and who runs it">
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <div className="flex items-center gap-2">
          <Avatar name={personName(c.requestedById, directory)} size="lg" />
          <div className="min-w-0">
            <GroupLabel>Requested by</GroupLabel>
            <p className={cx('text-sm truncate', t.text)}>{personName(c.requestedById, directory)}</p>
          </div>
        </div>
        {/* Implementers come from the DIRECTORY, not the agent roster: the
            people who run changes are engineers, and half of them never take a
            ticket. An options list that cannot represent the person already on
            the record would quietly show "Unassigned" over a real assignment. */}
        <Field label="Implementer">
          <Select
            accent={HUE}
            value={c.assigneeId || ''}
            placeholder="Unassigned"
            onChange={(e) => patchIn('changes', c.id, { assigneeId: e.target.value || null })}
            options={directory.map(p => ({ value: p.id, label: `${p.name} · ${p.title}` }))}
          />
        </Field>
        {!c.assigneeId && (
          <Banner accent="amber" icon={CircleAlert}>
            Nobody is named as implementer. An unassigned change in a Saturday window is an outage waiting for a
            volunteer.
          </Banner>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Cancel
 * ------------------------------------------------------------------ */

function CancelModal({ open, change: c, onClose }) {
  const { t } = useTheme();
  const [reason, setReason] = useState('');
  React.useEffect(() => { if (open) setReason(''); }, [open]);

  return (
    <Modal
      open={open} onClose={onClose} accent="red" size="modalSm" icon={Ban}
      title={`Cancel ${c.key}?`} subtitle="The record stays; the work does not happen"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Keep it open</Button>
          <Button
            variant="solid" accent="red" icon={Ban} disabled={!reason.trim()}
            onClick={() => {
              patchIn('changes', c.id, { status: 'cancelled', cancelReason: reason.trim() });
              onClose();
            }}
          >Cancel the change</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Banner accent="blue" icon={Info}>
          Cancelling keeps the assessment, the plans and any votes already cast. That history is what stops the
          same change being re-raised next quarter with the same flaw.
        </Banner>
        <Field label="Why is it being cancelled?" required>
          <Textarea accent="red" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Superseded by CHG-1051, which does the same work inside the September window." />
        </Field>
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * New change
 * ==================================================================== */

function NewChangeModal({ open, onClose, existing }) {
  const { t } = useTheme();
  const currentUser = useStore(s => s.currentUser);
  const directory = useStore(s => s.directory || []);
  const catalog = useCatalogServices();

  const [type, setType] = useState('normal');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState(STANDARD_TEMPLATES[0].id);
  const [assigneeId, setAssigneeId] = useState('');
  const [justification, setJustification] = useState('');
  const [productIds, setProductIds] = useState([]);
  const [win, setWin] = useState(() => defaultWindow());

  React.useEffect(() => {
    if (!open) return;
    setType('normal'); setTitle(''); setDescription('');
    setTemplateId(STANDARD_TEMPLATES[0].id);
    setAssigneeId(''); setJustification(''); setProductIds([]);
    setWin(defaultWindow());
  }, [open]);

  const template = STANDARD_TEMPLATES.find(x => x.id === templateId) || STANDARD_TEMPLATES[0];
  const meta = typeMeta(type);
  const ready = title.trim() && (type !== 'emergency' || justification.trim());

  function create() {
    if (!ready) return;
    const id = uid('chg');
    const base = {
      id,
      key: nextChangeKey(existing),
      title: title.trim(),
      description: description.trim(),
      changeType: type,
      requestedById: currentUser?.id || USR.ADMIN,
      assigneeId: assigneeId || null,
      affectedProductIds: productIds,
      affectedAssetIds: [],
      links: [],
      approvalId: null,
      outcome: null,
      reviewNotes: '',
      actualStart: null,
      actualEnd: null,
      createdAt: new Date().toISOString(),
    };

    if (type === 'standard') {
      // A standard change inherits the approved procedure and its pre-approval:
      // it is created already scheduled, with no CAB stage in its path.
      const end = new Date(new Date(win.start).getTime() + template.hours * 36e5).toISOString();
      addTo('changes', {
        ...base,
        status: 'scheduled',
        templateId: template.id,
        impact: template.impact,
        risk: bandFor(assessRisk(template.riskAnswers).points).key,
        riskAnswers: { ...template.riskAnswers },
        implementationPlan: template.implementationPlan,
        backoutPlan: template.backoutPlan,
        testPlan: template.testPlan,
        justification: justification.trim() || template.justification,
        plannedStart: win.start,
        plannedEnd: end,
      });
    } else if (type === 'emergency') {
      addTo('changes', {
        ...base,
        status: 'assess',
        impact: 'high',
        risk: 'high',
        riskAnswers: {},
        implementationPlan: '',
        backoutPlan: '',
        testPlan: '',
        justification: justification.trim(),
        plannedStart: new Date().toISOString(),
        plannedEnd: new Date(Date.now() + 2 * 36e5).toISOString(),
      });
    } else {
      addTo('changes', {
        ...base,
        status: 'new',
        impact: 'moderate',
        risk: null,
        riskAnswers: {},
        implementationPlan: '',
        backoutPlan: '',
        testPlan: '',
        justification: justification.trim(),
        plannedStart: win.start,
        plannedEnd: win.end,
      });
    }

    onClose();
    navigate('changes', 'list', id);
  }

  return (
    <Modal
      open={open} onClose={onClose} accent={HUE} size="modalLg" icon={GitBranch}
      title="Raise a change" subtitle="The type decides the journey — pick it first"
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>{nextChangeKey(existing)} · {meta.label}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="grad" module={MODULE} icon={Check} disabled={!ready} onClick={create}>
              {type === 'standard' ? 'Book it' : type === 'emergency' ? 'Raise emergency change' : 'Raise change'}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Change type" hint="Standard skips the board. Emergency skips scheduling. Normal does both stages.">
          <TileGroup
            columns={3} value={type} onChange={setType}
            options={TYPE_KEYS.map(k => ({
              value: k, label: CHANGE_TYPES[k].label, icon: CHANGE_TYPES[k].icon,
              accent: CHANGE_TYPES[k].hue, hint: CHANGE_TYPES[k].tagline,
            }))}
          />
        </Field>

        <Banner accent={meta.hue} icon={meta.icon} title={`What happens when you press create`}>
          {type === 'standard' && (
            <>This change is created <strong>already scheduled</strong>. It never enters Authorize, because the
              template below carries the CAB's approval. The plans are copied from the approved procedure.</>
          )}
          {type === 'normal' && (
            <>This change is created in <strong>New</strong>. It has to be assessed, then submitted to the CAB, and a
              window can only be booked once the board reaches its quorum.</>
          )}
          {type === 'emergency' && (
            <>This change is created in <strong>Assess</strong> with a window starting now. It skips scheduling
              entirely: once the on-call authority authorises it, implementation can begin, and the CAB reviews the
              record retrospectively.</>
          )}
        </Banner>

        <Field label="Title" required>
          <Input accent={HUE} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Fail over the primary billing database to the Elk Grove replica" />
        </Field>

        {type === 'standard' && (
          <Field label="Approved template" required hint="The procedure that carries the pre-approval.">
            <Select accent={HUE} value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              options={STANDARD_TEMPLATES.map(x => ({ value: x.id, label: `${x.name} · ${x.hours}h` }))} />
          </Field>
        )}

        <Field label="Description">
          <Textarea accent={HUE} rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What is being changed, on what, and what a reader needs to know to judge it." />
        </Field>

        <Field
          label="Justification"
          required={type === 'emergency'}
          hint={type === 'emergency'
            ? 'An emergency change needs its justification at the moment it is raised — that is what the retrospective is read against.'
            : 'Why this is worth the risk. Can be filled in during assessment.'}
        >
          <Textarea accent={HUE} rows={2} value={justification} onChange={(e) => setJustification(e.target.value)}
            placeholder={type === 'emergency'
              ? 'e.g. Primary billing node is failing writes; every tenant checkout is erroring.'
              : 'e.g. Storage is at 86% and will exhaust before the next quarterly window.'} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={type === 'emergency' ? 'Work starts' : 'Planned start'}>
            <Input accent={HUE} type="datetime-local" value={toLocalInput(win.start)}
              onChange={(e) => setWin(w => ({ ...w, start: fromLocalInput(e.target.value) }))} />
          </Field>
          <Field label={type === 'standard' ? `Planned end (${template.hours}h from start)` : 'Planned end'}>
            <Input accent={HUE} type="datetime-local"
              value={toLocalInput(type === 'standard'
                ? new Date(new Date(win.start).getTime() + template.hours * 36e5).toISOString()
                : win.end)}
              disabled={type === 'standard'}
              onChange={(e) => setWin(w => ({ ...w, end: fromLocalInput(e.target.value) }))} />
          </Field>
        </div>

        <Field label="Implementer">
          <Select accent={HUE} value={assigneeId} placeholder="Assign later"
            onChange={(e) => setAssigneeId(e.target.value)}
            options={directory.map(p => ({ value: p.id, label: `${p.name} · ${p.title}` }))} />
        </Field>

        <Field label="Affected services" hint="Conflict detection compares this list against every other booked change.">
          {catalog.items.length ? (
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
              {catalog.items.map(p => {
                const on = productIds.includes(p.id);
                return (
                  <button key={p.id}
                    onClick={() => setProductIds(ids => on ? ids.filter(x => x !== p.id) : [...ids, p.id])}>
                    <Chip accent={on ? ENTITIES.item.hue : 'gray'} icon={on ? Check : Package} title={p.path}>{p.name}</Chip>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={cx('text-xs', t.textMuted)}>
              No catalog services are configured yet — the Products &amp; Services module owns that list.
              Conflict detection will fall back to shared assets only.
            </p>
          )}
        </Field>

        {!!FREEZE_WINDOWS.filter(f => rangesOverlap(win.start, win.end, startOfDay(f.start), endOfDay(f.end))).length && (
          <Banner accent="red" icon={Snowflake} title="That window is inside a freeze">
            {FREEZE_WINDOWS
              .filter(f => rangesOverlap(win.start, win.end, startOfDay(f.start), endOfDay(f.end)))
              .map(f => `${f.name} (${fmtDate(f.start)} – ${fmtDate(f.end)})`).join('; ')}.
            {type === 'emergency' ? ' Permitted for emergency change, with the freeze owner on the call.' : ' Pick another window, or raise this as an emergency change.'}
          </Banner>
        )}
      </div>
    </Modal>
  );
}
