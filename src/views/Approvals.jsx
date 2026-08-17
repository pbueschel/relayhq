import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Stamp, Check, X, Clock, ChevronDown, ChevronRight, Users, UserPlus, Zap,
  Inbox, GitBranch, CircleAlert, CircleCheck, CircleX, CircleDot, Hourglass,
  Timer, Sparkles, CornerDownRight, Layers, MessageSquare,
  Package, Monitor, GraduationCap, BookOpen, Info, Scale, CheckCheck, Ban,
  UserCheck, TriangleAlert, ArrowRight, ListChecks, Undo2,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, LAYOUT, ENTITIES, entityHue,
  Button, Chip, ChipGroup, StatusPill, EntityTag, Avatar, AvatarStack,
  EmptyState, Card, GroupLabel, ListRow, Stat, Banner, Divider,
  Field, Textarea, SearchInput,
  Modal, Menu, MenuItem, MenuLabel, MenuDivider, FilterPill,
  LensBar, PageHeader, Toolbar, PageBody,
} from '@/ds';
import { useStore, setCollection, patchIn } from '@/store/store.js';
import {
  canDecide, decide, progress, isOverdue, applyTimeout, startApproval,
  matchingPolicies, describeApprover, resolveApprovers, STAGE_RULES, TIMEOUT_ACTIONS,
} from '@/lib/approvals.js';
import { explain, summarize, countRows } from '@/lib/conditions.js';
import { navigate } from '@/lib/router.js';
import { USR, Q, CAT, SF, POL } from '@/store/seed/ids.js';

/**
 * The approval inbox — where approvals actually get DECIDED.
 *
 * v1 modelled an approval as a list of names. This screen runs the engine in
 * `@/lib/approvals.js`: a request is a stage ladder, each stage resolves to
 * concrete people, a decision is recorded with who/when/why, and the request
 * visibly advances. Nothing here is a mock-up of a workflow — every button
 * calls the same pure functions the automation runtime calls.
 *
 * Defensive by design: the approvals collection is seeded by the service
 * module, so every record is normalised before use and every cross-reference
 * (policy, target record, approver) is allowed to be missing.
 */

/* ================================================================== *
 * Time
 * ================================================================== */

const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();

function ms(value) {
  if (!value) return null;
  const d = new Date(value);
  const n = d.getTime();
  return Number.isNaN(n) ? null : n;
}

/** "40m" / "6h" / "3d" — magnitude only; callers supply the direction. */
function span(deltaMs) {
  const mins = Math.max(1, Math.round(Math.abs(deltaMs) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

function ago(value, now) {
  const at = ms(value);
  if (at == null) return '—';
  return `${span(now - at)} ago`;
}

function stamp(value) {
  const at = ms(value);
  if (at == null) return '—';
  return new Date(at).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/* ================================================================== *
 * Normalising whatever the service seed handed us
 * ================================================================== */

function normalizeStage(stage, i) {
  const s = stage || {};
  return {
    ...s,
    index: i,
    id: s.id || `stage-${i}`,
    name: s.name || `Stage ${i + 1}`,
    rule: s.rule || 'all',
    approvers: Array.isArray(s.approvers) ? s.approvers : [],
    approverIds: Array.isArray(s.approverIds) ? s.approverIds.filter(Boolean) : [],
    decisions: Array.isArray(s.decisions) ? s.decisions.filter(Boolean) : [],
    delegations: Array.isArray(s.delegations) ? s.delegations : [],
    state: s.state || (i === 0 ? 'awaiting' : 'pending'),
  };
}

function normalizeRequest(req) {
  const r = req || {};
  const stages = (Array.isArray(r.stages) ? r.stages : []).map(normalizeStage);
  const last = Math.max(0, stages.length - 1);
  const raw = Number(r.currentStage);
  return {
    ...r,
    subject: r.subject || 'Untitled approval request',
    stages,
    currentStage: Number.isFinite(raw) ? Math.min(Math.max(0, raw), last) : 0,
    state: r.state || 'awaiting',
    context: r.context || {},
  };
}

/** How many approvals a stage needs before it clears. */
function stageNeed(stage) {
  const total = stage.approverIds.length;
  if (stage.rule === 'any') return Math.min(1, total || 1);
  if (stage.rule === 'quorum') return Math.max(1, Math.min(Number(stage.quorum) || 1, total || 1));
  return total;
}

function stageRuleLabel(stage) {
  if (stage.rule === 'quorum') return `${stageNeed(stage)} of ${stage.approverIds.length || '—'} must approve`;
  return STAGE_RULES.find(r => r.rule === stage.rule)?.label || 'Everyone must approve';
}

function stageRuleHint(stage) {
  return STAGE_RULES.find(r => r.rule === stage.rule)?.hint || '';
}

function timeoutLabel(stage) {
  return TIMEOUT_ACTIONS.find(a => a.value === stage.onTimeout)?.label || 'Keep waiting';
}

function decisionOf(stage, personId) {
  return stage.decisions.find(d => d.approverId === personId) || null;
}

function stageTally(stage) {
  const approved = stage.decisions.filter(d => d.verdict === 'approved').length;
  const rejected = stage.decisions.filter(d => d.verdict === 'rejected').length;
  return { approved, rejected, need: stageNeed(stage), total: stage.approverIds.length };
}

/** Hue for a stage node, given where the request stands. */
function stageHue(stage, isCurrent, requestState) {
  if (stage.state === 'approved') return 'emerald';
  if (stage.state === 'rejected') return 'red';
  if (!isCurrent) return 'gray';
  if (requestState === 'cancelled') return 'gray';
  return 'amber';
}

/* ================================================================== *
 * Targets — an approval always hangs off some other record
 * ================================================================== */

const TARGETS = {
  ticket:       { kind: 'ticket',       icon: Inbox,          collection: 'tickets',   to: ['workspace', 'tickets'] },
  incident:     { kind: 'incident',     icon: Inbox,          collection: 'tickets',   to: ['workspace', 'tickets'] },
  conversation: { kind: 'conversation', icon: MessageSquare,  collection: 'tickets',   to: ['workspace', 'tickets'] },
  change:       { kind: 'change',       icon: GitBranch,      collection: 'changes',   to: ['changes'] },
  problem:      { kind: 'problem',      icon: CircleAlert,    collection: 'problems',  to: ['problems'] },
  task:         { kind: 'task',         icon: CheckCheck,     collection: 'tasks',     to: ['workspace', 'tasks'] },
  project:      { kind: 'project',      icon: Package,        collection: 'projects',  to: ['projects'] },
  asset:        { kind: 'hardware',     icon: Monitor,        collection: 'assets',    to: ['assets'] },
  course:       { kind: 'course',       icon: GraduationCap,  collection: 'courses',   to: ['learning'] },
  knowledge:    { kind: 'article',      icon: BookOpen,       collection: 'knowledge', to: ['knowledge'] },
  subform:      { kind: 'subform',      icon: ListChecks,     collection: 'subforms',  to: ['forms'] },
};

function targetMeta(type) {
  return TARGETS[type] || { kind: 'approval', icon: Stamp, collection: null, to: ['workspace'] };
}

/* ================================================================== *
 * Lenses
 * ================================================================== */

const LENSES = [
  { value: 'mine',     label: 'Awaiting me', icon: UserCheck,   accent: 'amber' },
  { value: 'open',     label: 'All open',    icon: Hourglass,   accent: 'blue' },
  { value: 'approved', label: 'Approved',    icon: CircleCheck, accent: 'emerald' },
  { value: 'rejected', label: 'Rejected',    icon: CircleX,     accent: 'red' },
  { value: 'all',      label: 'Everything',  icon: Layers,      accent: 'purple' },
];
const LENS_VALUES = LENSES.map(l => l.value);

const GROUPS = [
  { key: 'overdue',  label: 'Overdue — the stage clock has passed' },
  { key: 'you',      label: 'Waiting on you' },
  { key: 'flight',   label: 'In flight — waiting on other approvers' },
  { key: 'resolved', label: 'Resolved' },
];

function groupOf(request, actingId, now) {
  if (request.state !== 'awaiting') return 'resolved';
  if (isOverdue(request, now)) return 'overdue';
  if (canDecide(request, actingId)) return 'you';
  return 'flight';
}

function inLens(request, lens, actingId) {
  switch (lens) {
    case 'mine':     return canDecide(request, actingId);
    case 'open':     return request.state === 'awaiting';
    case 'approved': return request.state === 'approved';
    case 'rejected': return request.state === 'rejected' || request.state === 'expired';
    default:         return true;
  }
}

/* ================================================================== *
 * Demo bootstrap
 *
 * The approvals collection belongs to the service module. If that seed shipped
 * without any running requests there is nothing for this screen to decide, so
 * — and ONLY then — we start requests from the instance's own approval
 * policies using the real `startApproval()`. A banner says so; this is never a
 * silent default. Every context below is evaluated against `appliesWhen`, so a
 * bootstrapped request is one a real submission would have produced.
 * ================================================================== */

function ctxFor(over) {
  return {
    ticket: { title: '', priority: 'medium', status: 'open', source: 'portal', labels: [], ...(over.ticket || {}) },
    requester: { department: 'Operations', isExternal: false, vip: false, ...(over.requester || {}) },
    org: { plan: 'Enterprise', ...(over.org || {}) },
    answers: { amount: 0, quantity: 1, accessLevel: 'read', startDate: null, ...(over.answers || {}) },
    change: { changeType: 'normal', risk: 'low', impact: 'low', affectsProduction: false, ...(over.change || {}) },
    asset: { kind: 'hardware', cost: 0, renewalDate: null, ...(over.asset || {}) },
    requesterId: over.requesterId,
  };
}

export const CANDIDATES = [
  {
    subject: 'MacBook Pro 16" replacement for Priya Raman',
    targetType: 'ticket', agoHours: 5, requesterId: USR.PRIYA,
    ctx: {
      ticket: { title: 'Laptop replacement — swollen battery', priority: 'high', queueId: Q.PROCUREMENT, subformId: SF.NEW_HARDWARE, catalogItemId: CAT.I_NEW_LAPTOP },
      requester: { department: 'Product' },
      answers: { amount: 3199, quantity: 1 },
      asset: { kind: 'hardware', cost: 3199 },
    },
    script: [],
  },
  {
    subject: 'Figma Organization — 12 additional seats',
    targetType: 'ticket', agoHours: 31, requesterId: USR.MIKE,
    ctx: {
      ticket: { title: 'Design tooling seats for the new squad', priority: 'medium', queueId: Q.PROCUREMENT, subformId: SF.SOFTWARE_REQUEST, catalogItemId: CAT.I_SOFTWARE_REQ },
      requester: { department: 'Product' },
      answers: { amount: 5400, quantity: 12 },
      asset: { kind: 'software', cost: 5400 },
    },
    script: [
      { verdict: 'approved', hoursAgo: 26, comment: 'Squad headcount is confirmed through Q4 — seats are budgeted.' },
    ],
  },
  {
    subject: 'Admin access to the billing schema for Devon Okafor',
    targetType: 'ticket', agoHours: 54, requesterId: USR.DEVON,
    ctx: {
      ticket: { title: 'Elevated database access for refund tooling', priority: 'high', queueId: Q.IT, subformId: SF.REQUEST_ACCESS, catalogItemId: CAT.I_CANNOT_SIGN_IN },
      requester: { department: 'Support' },
      answers: { amount: 0, accessLevel: 'admin' },
    },
    script: [],
  },
  {
    subject: 'New hire kit — Rosa Alvarez, Support Agent, starts 1 Sep',
    targetType: 'ticket', agoHours: 21, requesterId: USR.PATTI, prefer: POL.NEW_HIRE,
    ctx: {
      ticket: { title: 'Onboarding: Rosa Alvarez', priority: 'medium', queueId: Q.PEOPLE, subformId: SF.NEW_HIRE },
      requester: { department: 'People' },
      answers: { amount: 2640, quantity: 1, startDate: '2026-09-01' },
    },
    script: [
      { verdict: 'approved', hoursAgo: 18, comment: 'Requisition SUP-114 is open and signed. Kit spec matches the standard support build.' },
    ],
  },
  {
    subject: 'Emergency patch — session token leak in the Storefront API',
    targetType: 'change', agoHours: 2, requesterId: USR.EMMA,
    ctx: {
      ticket: { title: 'CHG — rotate storefront session signing key', priority: 'urgent', queueId: Q.ENGINEERING },
      requester: { department: 'IT' },
      change: { changeType: 'emergency', risk: 'high', impact: 'high', affectsProduction: true },
      answers: { amount: 0 },
    },
    script: [],
  },
  {
    subject: 'Elk Grove mail cluster — memory upgrade to 128 GB',
    targetType: 'change', agoHours: 28, requesterId: USR.EMMA, prefer: POL.NORMAL_CHANGE,
    ctx: {
      ticket: { title: 'CHG — mail cluster memory upgrade', priority: 'medium', queueId: Q.IT },
      requester: { department: 'IT' },
      change: { changeType: 'normal', risk: 'moderate', impact: 'medium', affectsProduction: true },
      answers: { amount: 4200 },
      asset: { kind: 'hardware', cost: 4200 },
    },
    script: [
      { verdict: 'approved', hoursAgo: 24, comment: 'Window is outside the Lumen Retail cutover. Rollback is a card swap — fine.' },
      { verdict: 'approved', hoursAgo: 20, comment: 'Change record has a tested back-out plan. No objection from service ops.' },
    ],
  },
  {
    subject: 'Offboarding — Tom Alvarez, last day 21 Aug',
    targetType: 'ticket', agoHours: 74, requesterId: USR.PATTI,
    ctx: {
      ticket: { title: 'Offboarding: Tom Alvarez (Sales)', priority: 'high', queueId: Q.PEOPLE, subformId: SF.OFFBOARDING },
      requester: { department: 'People' },
      answers: { amount: 0, accessLevel: 'admin' },
    },
    script: [
      { verdict: 'approved', hoursAgo: 70, allowSelf: true, comment: 'Confirmed with Robert — accounts disabled at 17:00 on the 21st.' },
      { verdict: 'approved', hoursAgo: 66, allowSelf: true, comment: 'Laptop and YubiKey collection scheduled with the Chicago front desk.' },
      { verdict: 'approved', hoursAgo: 61, allowSelf: true, comment: 'Final expenses cleared. Nothing outstanding.' },
      { verdict: 'approved', hoursAgo: 55, allowSelf: true, comment: 'SSO, VPN and the Salesforce seat are revoked. Mailbox is on a 30-day hold.' },
      { verdict: 'approved', hoursAgo: 52, allowSelf: true, comment: 'Laptop wiped and back in stock. Access revocation verified against the audit log.' },
    ],
  },
  {
    subject: 'Zendesk migration services — statement of work',
    targetType: 'ticket', agoHours: 46, requesterId: USR.LISA,
    ctx: {
      ticket: { title: 'Professional services for the support platform migration', priority: 'medium', queueId: Q.PROCUREMENT, subformId: SF.SOFTWARE_REQUEST },
      requester: { department: 'Support' },
      answers: { amount: 18500, quantity: 1 },
      asset: { kind: 'software', cost: 18500 },
    },
    script: [
      { verdict: 'rejected', hoursAgo: 40, allowSelf: true, comment: 'Not at this number. The migration scope overlaps work Priya has already automated — re-scope and resubmit under 10k.' },
    ],
  },
  {
    subject: 'Sit-stand desks and monitor arms for the Austin support pod',
    targetType: 'ticket', agoHours: 8, requesterId: USR.LINDA,
    ctx: {
      ticket: { title: 'Austin pod ergonomics refresh', priority: 'low', queueId: Q.FACILITIES, subformId: SF.FACILITIES_ISSUE },
      requester: { department: 'Operations' },
      answers: { amount: 740, quantity: 4 },
      asset: { kind: 'hardware', cost: 740 },
    },
    script: [],
  },
  {
    subject: 'Goodwill credit for Parkway Logistics — 3 days of degraded sync',
    targetType: 'ticket', agoHours: 16, requesterId: USR.DEVON,
    ctx: {
      ticket: { title: 'Service credit request — Parkway Logistics', priority: 'high', queueId: Q.SUPPORT, subformId: SF.BILLING_QUESTION, catalogItemId: CAT.I_BILLING },
      requester: { department: 'Support' },
      org: { plan: 'Business' },
      answers: { amount: 1250, quantity: 1 },
    },
    script: [
      { verdict: 'approved', hoursAgo: 12, comment: 'Outage is confirmed in the incident record. A credit is the right call — Beatriz has been patient.' },
    ],
  },
  {
    subject: 'AWS reserved instances — 12 month renewal',
    targetType: 'ticket', agoHours: 98, requesterId: USR.EMMA,
    ctx: {
      ticket: { title: 'Infrastructure commitment renewal', priority: 'high', queueId: Q.FINANCE, subformId: SF.LICENSE_RENEWAL },
      requester: { department: 'IT' },
      answers: { amount: 42000, quantity: 1 },
      asset: { kind: 'software', cost: 42000, renewalDate: '2026-09-30' },
    },
    script: [
      { verdict: 'approved', hoursAgo: 90, comment: 'Modelled against last year — the reservation still beats on-demand by 34%.' },
    ],
  },
  {
    subject: 'Author access to the customer academy for Sam Whitfield',
    targetType: 'course', agoHours: 4, requesterId: USR.SAM, prefer: POL.ACCESS_GRANT,
    ctx: {
      ticket: { title: 'Academy authoring rights so Sam can publish lesson revisions', priority: 'medium', queueId: Q.SUPPORT, subformId: SF.REQUEST_ACCESS },
      requester: { department: 'Support' },
      answers: { amount: 0, accessLevel: 'write' },
    },
    script: [],
  },
];

/** Replay scripted decisions through the real engine so history is genuine. */
function runScript(request, steps, protectId, nowMs) {
  let r = request;
  for (const step of steps || []) {
    if (r.state !== 'awaiting') break;
    const stage = r.stages[r.currentStage];
    if (!stage) break;
    const taken = new Set(stage.decisions.map(d => d.approverId));
    const who = stage.approverIds.find(id => !taken.has(id) && (step.allowSelf || id !== protectId));
    if (!who) break;
    r = decide(r, {
      approverId: who,
      verdict: step.verdict,
      comment: step.comment,
      now: iso(nowMs - (step.hoursAgo || 0) * HOUR),
    });
  }
  return r;
}

export function bootstrapRequests(policies, directory, queues, records, nowMs) {
  const out = [];
  let n = 0;
  for (const cand of CANDIDATES) {
    const base = ctxFor({ ...cand.ctx, requesterId: cand.requesterId });
    const resolveCtx = { ...base, directory, queues };
    const matched = matchingPolicies(policies, resolveCtx);
    if (!matched.length) continue;
    // A submission can match several policies (a $4,200 change trips both the
    // spend threshold and the CAB). `prefer` names which ladder this demo
    // record should run; declaration order decides otherwise, as in the engine.
    const policy = matched.find(p => p.id === cand.prefer) || matched[0];
    const createdAt = iso(nowMs - cand.agoHours * HOUR);
    const pool = records[targetMeta(cand.targetType).collection] || [];
    const target = pool.length ? pool[n % pool.length] : null;
    n += 1;

    let req = startApproval(policy, resolveCtx, {
      id: `apr-demo-${n}`,
      subject: cand.subject,
      targetType: cand.targetType,
      targetId: target?.id || null,
      now: createdAt,
    });
    // Do not persist the whole directory onto every request — the engine only
    // needs it at resolve time, and the trace reads the business context.
    req = { ...req, context: base, bootstrapped: true };
    req = runScript(req, cand.script, USR.ADMIN, nowMs);
    out.push(req);
  }
  return out;
}

/* ================================================================== *
 * View
 * ================================================================== */

export default function Approvals({ route }) {
  const { t } = useTheme();

  const approvals = useStore(s => s.approvals);
  const policies = useStore(s => s.approvalPolicies);
  const directory = useStore(s => s.directory);
  const queues = useStore(s => s.queues);
  const currentUser = useStore(s => s.currentUser);
  const tickets = useStore(s => s.tickets);
  const changes = useStore(s => s.changes);
  const courses = useStore(s => s.courses);

  const [actingId, setActingId] = useState(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(null);
  const [typeMenu, setTypeMenu] = useState(false);
  const [flash, setFlash] = useState(null);
  const bootstrapped = useRef(false);

  const meId = actingId || currentUser?.id || USR.ADMIN;
  const now = Date.now();

  const lens = LENS_VALUES.includes(route?.sub) ? route.sub : 'mine';
  const selectedId = route?.id || null;

  /* --- bootstrap (only when the service seed carried no running requests) --- */
  useEffect(() => {
    if (bootstrapped.current) return;
    if ((approvals || []).length > 0) return;
    if (!(policies || []).length) return;
    bootstrapped.current = true;
    const built = bootstrapRequests(
      policies, directory || [], queues || [],
      { tickets: tickets || [], changes: changes || [], courses: courses || [] },
      Date.now(),
    );
    if (built.length) setCollection('approvals', built);
  }, [approvals, policies, directory, queues, tickets, changes, courses]);

  const people = useMemo(() => {
    const map = new Map();
    for (const p of directory || []) map.set(p.id, p);
    return map;
  }, [directory]);

  const policyById = useMemo(() => {
    const map = new Map();
    for (const p of policies || []) map.set(p.id, p);
    return map;
  }, [policies]);

  const all = useMemo(() => (approvals || []).map(normalizeRequest), [approvals]);

  const counts = useMemo(() => ({
    mine: all.filter(r => canDecide(r, meId)).length,
    open: all.filter(r => r.state === 'awaiting').length,
    approved: all.filter(r => r.state === 'approved').length,
    rejected: all.filter(r => r.state === 'rejected' || r.state === 'expired').length,
    all: all.length,
  }), [all, meId]);

  const overdue = useMemo(() => all.filter(r => isOverdue(r, now)), [all, now]);
  const unresolved = useMemo(
    () => all.filter(r => r.state === 'awaiting' && r.stages.some(s => s.approverIds.length === 0)),
    [all],
  );
  const isDemo = all.some(r => r.bootstrapped);

  const targetTypes = useMemo(() => {
    const set = new Set(all.map(r => r.targetType).filter(Boolean));
    return Array.from(set);
  }, [all]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(r => {
      if (!inLens(r, lens, meId)) return false;
      if (typeFilter && r.targetType !== typeFilter) return false;
      if (!q) return true;
      const hay = [
        r.subject, r.policyName, r.targetType,
        people.get(r.requesterId)?.name,
        ...r.stages.map(s => s.name),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [all, lens, meId, typeFilter, query, people]);

  const grouped = useMemo(() => {
    const buckets = new Map(GROUPS.map(g => [g.key, []]));
    for (const r of visible) buckets.get(groupOf(r, meId, now))?.push(r);
    for (const [key, list] of buckets) {
      list.sort((a, b) => {
        if (key === 'resolved') return (ms(b.resolvedAt) || 0) - (ms(a.resolvedAt) || 0);
        const da = ms(a.stages[a.currentStage]?.dueAt) ?? Infinity;
        const db = ms(b.stages[b.currentStage]?.dueAt) ?? Infinity;
        return da - db;
      });
    }
    return GROUPS.map(g => ({ ...g, items: buckets.get(g.key) || [] })).filter(g => g.items.length);
  }, [visible, meId, now]);

  const selected = useMemo(() => all.find(r => r.id === selectedId) || null, [all, selectedId]);
  const flashRequest = flash?.id ? all.find(r => r.id === flash.id) || null : null;

  const goLens = (value) => navigate('approvals', value);
  const open = (id) => navigate('approvals', lens, id);
  const close = () => navigate('approvals', lens);

  /* --- mutations ------------------------------------------------- */

  const resolveCtx = (request) => ({ ...(request.context || {}), directory: directory || [], queues: queues || [] });

  const onDecide = (request, verdict, comment) => {
    const next = decide(request, { approverId: meId, verdict, comment, now: new Date().toISOString() });
    if (next === request) return;
    patchIn('approvals', request.id, next);
    // A decision does not always move the request. On an "any one approves"
    // stage a single rejection leaves the stage open — saying "advanced" there
    // would be a lie, so the three outcomes are reported separately.
    const advanced = next.currentStage !== request.currentStage;
    setFlash({
      id: request.id,
      kind: next.state !== 'awaiting' ? next.state : advanced ? 'advanced' : 'recorded',
      verdict,
      fromStage: request.stages[request.currentStage]?.name,
      toStage: next.stages[next.currentStage]?.name,
      toIndex: next.currentStage,
      by: people.get(meId)?.name || meId,
    });
  };

  const onTimeout = (request) => {
    const before = request.stages[request.currentStage];
    const ctx = resolveCtx(request);
    const escalationTargets = before?.escalateTo ? resolveApprovers(before.escalateTo, ctx) : [];
    const next = applyTimeout(request, ctx, new Date().toISOString());
    if (next === request) return;
    patchIn('approvals', request.id, next);
    const after = next.stages[next.currentStage];
    const sameStage = next.currentStage === request.currentStage;
    setFlash({
      id: request.id,
      kind: next.state !== 'awaiting' ? next.state : sameStage ? 'escalated' : 'advanced',
      fromStage: before?.name,
      toStage: after?.name,
      toIndex: next.currentStage,
      timeout: true,
      escalateTo: before?.escalateTo ? describeApprover(before.escalateTo, ctx) : null,
      resolvedCount: escalationTargets.length,
      added: (after?.approverIds || []).filter(id => !(before?.approverIds || []).includes(id)),
    });
  };

  const onDelegate = (request, toId) => {
    const at = new Date().toISOString();
    const idx = request.currentStage;
    const stages = request.stages.map((s, i) => (i !== idx ? s : {
      ...s,
      approverIds: s.approverIds.includes(toId) ? s.approverIds : [...s.approverIds, toId],
      delegations: [...(s.delegations || []), { fromId: meId, toId, at }],
    }));
    patchIn('approvals', request.id, { stages });
    setFlash({
      id: request.id, kind: 'delegated', toIndex: idx,
      by: people.get(meId)?.name || meId, to: people.get(toId)?.name || toId,
    });
  };

  const sweepOverdue = () => {
    for (const r of overdue) {
      const next = applyTimeout(r, resolveCtx(r), new Date().toISOString());
      if (next !== r) patchIn('approvals', r.id, next);
    }
    setFlash({ id: null, kind: 'swept', count: overdue.length });
  };

  const lensItems = LENSES.map(l => ({ ...l, count: counts[l.value] }));
  const actingPerson = people.get(meId) || currentUser;
  const impersonating = !!currentUser && meId !== currentUser.id;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={Stamp}
        accent="amber"
        title="Approvals"
        subtitle={`${counts.open} running · ${counts.mine} waiting on ${impersonating ? actingPerson?.name?.split(' ')[0] : 'you'} · policies run live, nothing here is a mock-up`}
        actions={
          <ActingAsControl
            people={directory || []}
            requests={all}
            actingId={meId}
            currentUser={currentUser}
            onPick={(id) => setActingId(id === currentUser?.id ? null : id)}
          />
        }
      >
        <div className="space-y-2">
          <Toolbar>
            <LensBar items={lensItems} value={lens} onChange={goLens} split={3} />
          </Toolbar>
          <Toolbar>
            <SearchInput value={query} onChange={setQuery} placeholder="Search subject, policy, requester…" width="w-72" accent="amber" />
            <div className="relative">
              <FilterPill
                icon={Layers}
                label={typeFilter ? `On: ${ENTITIES[targetMeta(typeFilter).kind]?.label || typeFilter}` : 'Any record type'}
                active={!!typeFilter}
                open={typeMenu}
                onClick={() => setTypeMenu(v => !v)}
              />
              <Menu open={typeMenu} onClose={() => setTypeMenu(false)} width="w-56">
                <MenuLabel>Approval hangs off</MenuLabel>
                {targetTypes.map(tt => {
                  const meta = targetMeta(tt);
                  return (
                    <MenuItem
                      key={tt}
                      icon={meta.icon}
                      label={ENTITIES[meta.kind]?.label || tt}
                      hint={`${all.filter(r => r.targetType === tt).length} requests`}
                      selected={typeFilter === tt}
                      accent="amber"
                      onClick={() => { setTypeFilter(typeFilter === tt ? null : tt); setTypeMenu(false); }}
                    />
                  );
                })}
                <MenuDivider />
                <MenuItem icon={Undo2} label="Any record type" onClick={() => { setTypeFilter(null); setTypeMenu(false); }} />
              </Menu>
            </div>
          </Toolbar>
        </div>
      </PageHeader>

      <PageBody>
        <div className="space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            <Stat label="waiting on you" value={counts.mine} accent="amber" icon={UserCheck}
              active={lens === 'mine'} onClick={() => goLens('mine')} />
            <Stat label="in flight" value={counts.open} accent="blue" icon={Hourglass}
              active={lens === 'open'} onClick={() => goLens('open')} />
            <Stat label="overdue" value={overdue.length} accent={overdue.length ? 'red' : 'gray'} icon={Timer}
              onClick={() => goLens('open')} />
            <Stat label="decided" value={counts.approved + counts.rejected} accent="emerald" icon={CheckCheck}
              active={lens === 'approved'} onClick={() => goLens('approved')} />
          </div>

          <div className="space-y-2">
            {impersonating && (
              <Banner accent="violet" icon={Users} title={`Viewing this inbox as ${actingPerson?.name}`}>
                Decisions you record will be attributed to {actingPerson?.name}, not to {currentUser?.name}.
                Switch back from the control in the header.
              </Banner>
            )}

            {isDemo && (
              <Banner accent="blue" icon={Info} title="These requests were started from your approval policies">
                No running approval requests came with this instance's data, so RelayHQ instantiated
                {' '}{all.length} of them from the policies in <strong className={t.text}>Business Rules</strong> using
                the same <code>startApproval()</code> the intake path calls. Every stage, approver and clock below is
                real engine output.
              </Banner>
            )}

            {overdue.length > 0 && (
              <Banner accent="red" icon={Timer} title={`${overdue.length} request${overdue.length === 1 ? '' : 's'} past the stage due time`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    The automation runtime applies each stage's timeout action on its hourly tick.
                    Nothing happens silently — you can run that sweep now and watch the escalations land.
                  </span>
                  <Button size="xs" variant="solid" accent="red" icon={Zap} onClick={sweepOverdue}>
                    Run timeout policy on all {overdue.length}
                  </Button>
                </div>
              </Banner>
            )}

            {unresolved.length > 0 && (
              <Banner accent="orange" icon={TriangleAlert} title="A stage resolved to nobody">
                {unresolved.length} open request{unresolved.length === 1 ? ' has' : 's have'} a stage whose approver
                spec matched no one — usually a requester with no manager on file. RelayHQ holds these rather than
                skipping the stage. Delegate someone in to unblock them.
              </Banner>
            )}

            {/* Deciding from a row can make it leave the current lens. Say where
                it went rather than letting it vanish. */}
            {flash?.id && flashRequest && <FlashBanner flash={flash} request={flashRequest} people={people} />}

            {flash?.kind === 'swept' && (
              <Banner accent="amber" icon={Sparkles} title="Timeout sweep complete">
                Applied each stage's own timeout action to {flash.count} overdue request{flash.count === 1 ? '' : 's'}.
                Open one to see exactly what happened — an escalating stage names whoever was added, and says so
                when the escalation target resolved to nobody. Stages set to “keep waiting” are deliberately untouched.
              </Banner>
            )}
          </div>

          {grouped.length === 0 ? (
            <EmptyState
              icon={Stamp}
              title={emptyTitle(lens, all.length, query || typeFilter)}
              hint={emptyHint(lens, all.length, policies?.length || 0)}
              action={lens !== 'all' ? <Button variant="soft" accent="amber" icon={Layers} onClick={() => goLens('all')}>Show everything</Button> : null}
            />
          ) : (
            <div className="space-y-5">
              {grouped.map(group => (
                <div key={group.key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <GroupLabel>{group.label}</GroupLabel>
                    <span className={cx('text-[11px] tabular-nums px-1.5 rounded-full', t.bgSubtle, t.textMuted)}>
                      {group.items.length}
                    </span>
                    <Divider className="flex-1" />
                  </div>
                  <div className={DENSITY.rowGap}>
                    {group.items.map(r => (
                      <RequestRow
                        key={r.id}
                        request={r}
                        people={people}
                        meId={meId}
                        now={now}
                        onOpen={() => open(r.id)}
                        onDecide={onDecide}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      {selected && (
        <RequestModal
          key={selected.id}
          request={selected}
          policy={policyById.get(selected.policyId) || null}
          people={people}
          directory={directory || []}
          queues={queues || []}
          meId={meId}
          now={now}
          flash={flash?.id === selected.id ? flash : null}
          onClose={close}
          onDecide={onDecide}
          onTimeout={onTimeout}
          onDelegate={onDelegate}
        />
      )}
    </div>
  );
}

function emptyTitle(lens, total, filtered) {
  if (filtered) return 'Nothing matches those filters';
  if (!total) return 'No approval requests yet';
  if (lens === 'mine') return 'Your approval queue is clear';
  if (lens === 'open') return 'Nothing is in flight';
  if (lens === 'approved') return 'Nothing has been approved yet';
  if (lens === 'rejected') return 'Nothing has been rejected';
  return 'Nothing here';
}

function emptyHint(lens, total, policyCount) {
  if (!total) {
    return policyCount
      ? 'Approval requests are created when a submission matches a policy in Business Rules. None are running right now.'
      : 'No approval policies are configured, so nothing can raise an approval. Add one in Business Rules.';
  }
  if (lens === 'mine') return 'Requests appear here the moment a stage resolves to you — including stages you were delegated into.';
  return 'Try another lens.';
}

/* ================================================================== *
 * Acting-as — the demo needs to sit in more than one approver's chair
 * ================================================================== */

function ActingAsControl({ people, requests, actingId, currentUser, onPick }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);

  const withPending = useMemo(() => {
    const ids = new Set();
    for (const r of requests) {
      if (r.state !== 'awaiting') continue;
      for (const id of r.stages[r.currentStage]?.approverIds || []) ids.add(id);
    }
    return ids;
  }, [requests]);

  const acting = people.find(p => p.id === actingId) || currentUser;
  const candidates = people.filter(p => withPending.has(p.id));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={cx('flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl border transition-colors',
          t.bgCard, t.borderLight, t.bgHover)}
      >
        <Avatar name={acting?.name} size="md" />
        <span className="text-left leading-tight hidden sm:block">
          <span className={cx('text-[10px] block uppercase tracking-wider', t.textMuted)}>Acting as</span>
          <span className={cx('text-xs block font-medium', t.text)}>{acting?.name || 'Unknown'}</span>
        </span>
        <ChevronDown size={ICON.base} className={t.textMuted} />
      </button>
      <Menu open={open} onClose={() => setOpen(false)} align="right" width="w-72">
        <MenuLabel>Approvers with a pending decision</MenuLabel>
        {candidates.length === 0 && (
          <p className={cx('px-3 py-2 text-xs', t.textMuted)}>Nobody has a pending decision right now.</p>
        )}
        {candidates.map(p => (
          <MenuItem
            key={p.id}
            icon={UserCheck}
            accent="amber"
            label={p.name}
            hint={`${p.title || 'Employee'} · ${requests.filter(r => canDecide(r, p.id)).length} awaiting`}
            selected={p.id === actingId}
            onClick={() => { onPick(p.id); setOpen(false); }}
          />
        ))}
        <MenuDivider />
        <MenuItem
          icon={Undo2}
          label={`Back to ${currentUser?.name || 'me'}`}
          hint="Your own inbox"
          selected={actingId === currentUser?.id}
          onClick={() => { onPick(currentUser?.id); setOpen(false); }}
        />
      </Menu>
    </div>
  );
}

/* ================================================================== *
 * List row
 * ================================================================== */

function RequestRow({ request, people, meId, now, onOpen, onDecide }) {
  const { t } = useTheme();
  const stage = request.stages[request.currentStage];
  const p = progress(request);
  const late = isOverdue(request, now);
  const mine = canDecide(request, meId);
  const requester = people.get(request.requesterId);
  const approverNames = (stage?.approverIds || []).map(id => people.get(id)?.name || id);

  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <ListRow
      accent={late ? 'red' : 'amber'}
      icon={late ? Timer : Stamp}
      alert={late}
      onClick={onOpen}
      title={request.subject}
      meta={
        <>
          {requester && <Avatar name={requester.name} size="sm" />}
          {request.state === 'awaiting'
            ? <AvatarStack names={approverNames} max={3} size="sm" />
            : <StatusPill status={request.state} />}
          {mine ? (
            <>
              <Button size="xs" variant="solid" accent="emerald" icon={Check}
                onClick={stop(() => onDecide(request, 'approved', ''))}>Approve</Button>
              <Button size="xs" variant="soft" accent="red" icon={X}
                onClick={stop(() => onDecide(request, 'rejected', ''))}>Reject</Button>
            </>
          ) : (
            <ChevronRight size={ICON.base} className={t.textMuted} />
          )}
        </>
      }
    >
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        <TargetChip request={request} />
        <Chip accent="slate" icon={Scale} title={`Policy: ${request.policyName || request.policyId || 'unknown'}`}>
          {request.policyName || request.policyId || 'No policy on record'}
        </Chip>
        <StageDots request={request} />
        <span className={cx('text-[11px]', t.textMuted)}>
          Stage {p.stageNumber} of {p.totalStages}
          {request.state === 'awaiting' && ` · ${p.approvals} of ${p.need} approved`}
          {stage?.name ? ` · ${stage.name}` : ''}
        </span>
        <DueChip request={request} now={now} />
      </div>
    </ListRow>
  );
}

/** Pipeline pips — how far along the ladder this request is, at a glance. */
function StageDots({ request }) {
  const { t, a } = useTheme();
  return (
    <span className="inline-flex items-center gap-0.5" title={request.stages.map(s => `${s.name}: ${s.state}`).join(' → ')}>
      {request.stages.map((s, i) => {
        const isCurrent = i === request.currentStage && request.state === 'awaiting';
        const c = a(stageHue(s, i === request.currentStage, request.state));
        return (
          <span
            key={s.id}
            className={cx('h-1.5 rounded-full', isCurrent ? 'w-4' : 'w-2.5',
              s.state === 'pending' && !isCurrent ? t.rule : c.dot)}
          />
        );
      })}
    </span>
  );
}

function DueChip({ request, now }) {
  const { t } = useTheme();
  if (request.state !== 'awaiting') {
    return (
      <span className={cx('text-[11px]', t.textMuted)}>
        {request.state === 'approved' ? 'Approved' : request.state === 'rejected' ? 'Rejected' : 'Closed'} {ago(request.resolvedAt, now)}
      </span>
    );
  }
  const due = ms(request.stages[request.currentStage]?.dueAt);
  if (due == null) return <Chip accent="slate" icon={Clock}>No stage clock</Chip>;
  const late = due < now;
  return (
    <Chip accent={late ? 'red' : 'gray'} icon={late ? TriangleAlert : Clock}
      title={`Stage due ${stamp(request.stages[request.currentStage]?.dueAt)}`}>
      {late ? `Overdue by ${span(now - due)}` : `Due in ${span(due - now)}`}
    </Chip>
  );
}

function TargetChip({ request }) {
  const meta = targetMeta(request.targetType);
  const pool = useStore(s => (meta.collection ? s[meta.collection] : null));
  const record = meta.collection && request.targetId
    ? (pool || []).find(r => r.id === request.targetId) || null
    : null;
  const label = record?.reference || record?.title || record?.name
    || (request.targetId ? request.targetId : ENTITIES[meta.kind]?.label || request.targetType || 'record');

  if (!record) {
    return (
      <Chip accent={entityHue(meta.kind)} icon={meta.icon}
        title={request.targetId ? 'Linked record is not in this instance' : 'No linked record'}>
        {ENTITIES[meta.kind]?.label || request.targetType || 'Record'}
      </Chip>
    );
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigate(meta.to[0], meta.to[1] || null, record.id); }}
      className="inline-flex max-w-[16rem]"
      title={`Open ${label}`}
    >
      <Chip accent={entityHue(meta.kind)} icon={meta.icon} className="hover:underline">
        {label}
      </Chip>
    </button>
  );
}

/* ================================================================== *
 * Detail modal — the stage ladder
 * ================================================================== */

function RequestModal({ request, policy, people, directory, queues, meId, now, flash, onClose, onDecide, onTimeout, onDelegate }) {
  const { t } = useTheme();
  const [comment, setComment] = useState('');
  const [openStages, setOpenStages] = useState({});
  const [delegating, setDelegating] = useState(false);
  const [showTrace, setShowTrace] = useState(true);

  useEffect(() => {
    if (flash?.toIndex != null) setOpenStages(o => ({ ...o, [flash.toIndex]: true }));
  }, [flash]);

  const p = progress(request);
  const mine = canDecide(request, meId);
  const late = isOverdue(request, now);
  const stage = request.stages[request.currentStage];
  const requester = people.get(request.requesterId);
  const actor = people.get(meId);

  const submit = (verdict) => {
    onDecide(request, verdict, comment.trim());
    setComment('');
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        accent={late ? 'red' : 'amber'}
        size="modalLg"
        icon={Stamp}
        title={request.subject}
        subtitle={`${request.policyName || request.policyId || 'No policy on record'} · raised ${ago(request.createdAt, now)} by ${requester?.name || 'unknown requester'}`}
        footer={
          <>
            <div className="flex items-center gap-2 min-w-0">
              <StatusPill status={request.state} />
              <span className={cx('text-xs truncate', t.textMuted)}>
                Stage {p.stageNumber} of {p.totalStages}
                {request.state === 'awaiting' && ` · ${p.approvals} of ${p.need} approved`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {request.state === 'awaiting' && (
                <Button variant="outline" icon={UserPlus} onClick={() => setDelegating(true)}>Delegate…</Button>
              )}
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <FlashBanner flash={flash} request={request} people={people} />

          <SummaryGrid request={request} people={people} now={now} />

          {late && (
            <Banner accent="red" icon={Timer} title={`This stage is ${span(now - (ms(stage?.dueAt) || now))} past due`}>
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  On timeout this stage will <strong className={t.text}>{timeoutLabel(stage || {}).toLowerCase()}</strong>
                  {stage?.onTimeout === 'escalate' && stage?.escalateTo
                    ? ` — to ${describeApprover(stage.escalateTo, { directory, queues })}`
                    : ''}.
                  The automation tick does this hourly; a demo should not have to wait.
                </span>
                <Button size="xs" variant="solid" accent="red" icon={Zap} onClick={() => onTimeout(request)}>
                  Run timeout policy now
                </Button>
              </div>
            </Banner>
          )}

          {stage && stage.approverIds.length === 0 && request.state === 'awaiting' && (
            <Banner accent="orange" icon={TriangleAlert} title="This stage resolved to nobody">
              {(stage.approvers || []).map(sp => describeApprover(sp, { directory, queues })).join(', ') || 'The approver spec'}
              {' '}matched no one in the directory. RelayHQ holds the request here rather than skipping the stage —
              delegate someone in to unblock it.
            </Banner>
          )}

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <GroupLabel>Stage ladder</GroupLabel>
              <span className={cx('text-[11px]', t.textMuted)}>
                {request.stages.length} stage{request.stages.length === 1 ? '' : 's'} · on rejection this policy {(request.onReject || 'stop') === 'stop' ? 'stops' : 'keeps going'}
              </span>
            </div>
            <StageLadder
              request={request}
              people={people}
              directory={directory}
              queues={queues}
              meId={meId}
              now={now}
              flash={flash}
              openStages={openStages}
              onToggle={(i) => setOpenStages(o => ({ ...o, [i]: !(o[i] ?? (i === request.currentStage)) }))}
            />
          </div>

          <div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setShowTrace(v => !v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowTrace(v => !v); } }}
              className={cx('w-full flex items-center gap-2 mb-2 cursor-pointer', t.textSecondary)}
            >
              {showTrace ? <ChevronDown size={ICON.base} /> : <ChevronRight size={ICON.base} />}
              <GroupLabel>Why this approval exists</GroupLabel>
              <Divider className="flex-1" />
            </div>
            {showTrace && <PolicyTrace policy={policy} request={request} />}
          </div>

          <DecisionPanel
            request={request}
            mine={mine}
            actor={actor}
            meId={meId}
            people={people}
            comment={comment}
            setComment={setComment}
            onSubmit={submit}
          />
        </div>
      </Modal>

      <DelegateModal
        open={delegating}
        request={request}
        directory={directory}
        meId={meId}
        onClose={() => setDelegating(false)}
        onPick={(id) => { onDelegate(request, id); setDelegating(false); }}
      />
    </>
  );
}

/** The demo moment: make the advance legible rather than a silent re-render. */
function FlashBanner({ flash, request, people }) {
  const { t } = useTheme();
  if (!flash) return null;

  if (flash.kind === 'delegated') {
    return (
      <Banner accent="violet" icon={UserPlus} title={`${flash.to} was delegated into this stage`}>
        {flash.by} added them alongside the existing approvers, and the delegation is recorded on the stage below.
      </Banner>
    );
  }
  if (flash.kind === 'recorded') {
    const stage = request.stages[request.currentStage];
    const tally = stageTally(stage || { decisions: [], approverIds: [], rule: 'all' });
    return (
      <Banner accent={flash.verdict === 'approved' ? 'emerald' : 'amber'} icon={CheckCheck}
        title={`${flash.by}'s ${flash.verdict === 'approved' ? 'approval' : 'rejection'} is recorded — the stage is still open`}>
        “{flash.fromStage}” runs on <strong className={t.text}>{stageRuleLabel(stage || {}).toLowerCase()}</strong>, so it
        needs {tally.need} approval{tally.need === 1 ? '' : 's'} and has {tally.approved}. Nothing advances until it clears.
      </Banner>
    );
  }
  if (flash.kind === 'escalated') {
    const names = (flash.added || []).map(id => people.get(id)?.name || id);
    return (
      <Banner accent={names.length ? 'amber' : 'orange'} icon={Zap} title="Timeout policy applied">
        {names.length
          ? `${names.join(', ')} ${names.length === 1 ? 'was' : 'were'} added as an escalation approver and the stage clock has been reset.`
          : flash.resolvedCount
            ? `The escalation target (${flash.escalateTo}) was already on this stage, so nobody new was added. The clock has been reset.`
            : `The escalation target (${flash.escalateTo || 'none configured'}) resolved to nobody, so nobody was added. RelayHQ reset the clock rather than skipping the stage — this is a policy configuration gap, not a decision.`}
      </Banner>
    );
  }
  if (flash.kind === 'advanced') {
    return (
      <Banner accent="emerald" icon={ArrowRight} title={`“${flash.fromStage}” cleared — now at “${flash.toStage}”`}>
        {flash.timeout ? 'The timeout action resolved the stage. ' : `${flash.by} recorded an approval. `}
        Stage {flash.toIndex + 1} of {request.stages.length} is open and waiting on
        {' '}{(request.stages[flash.toIndex]?.approverIds || []).map(id => people.get(id)?.name || id).join(', ') || 'nobody — see the warning above'}.
      </Banner>
    );
  }
  if (flash.kind === 'approved') {
    return (
      <Banner accent="emerald" icon={CircleCheck} title="Fully approved">
        Every stage has cleared. The request is closed and the target record can proceed.
      </Banner>
    );
  }
  if (flash.kind === 'rejected') {
    return (
      <Banner accent="red" icon={CircleX} title="Rejected">
        <span className={t.textSecondary}>
          This policy stops on rejection, so no later stage runs. The requester keeps the comment as the reason.
        </span>
      </Banner>
    );
  }
  return null;
}

function SummaryGrid({ request, people, now }) {
  const { t } = useTheme();
  const requester = people.get(request.requesterId);
  return (
    <Card className={cx(DENSITY.cardPad, 'grid gap-3 grid-cols-2 sm:grid-cols-4')}>
      <MetaCell label="Requester">
        <span className="flex items-center gap-2 min-w-0">
          <Avatar name={requester?.name || request.requesterId} size="md" />
          <span className="min-w-0">
            <span className={cx('text-sm block truncate', t.text)}>{requester?.name || request.requesterId || 'Unknown'}</span>
            <span className={cx('text-[11px] block truncate', t.textMuted)}>{requester?.title || 'Not in directory'}</span>
          </span>
        </span>
      </MetaCell>
      <MetaCell label="Hangs off">
        <div className="flex"><TargetChip request={request} /></div>
      </MetaCell>
      <MetaCell label="Raised">
        <span className={cx('text-sm', t.text)}>{stamp(request.createdAt)}</span>
        <span className={cx('text-[11px] block', t.textMuted)}>{ago(request.createdAt, now)}</span>
      </MetaCell>
      <MetaCell label="State">
        <div className="flex items-center gap-2">
          <StatusPill status={request.state} />
          <EntityTag kind="approval" />
        </div>
      </MetaCell>
    </Card>
  );
}

function MetaCell({ label, children }) {
  return (
    <div className="min-w-0">
      <GroupLabel className="mb-1">{label}</GroupLabel>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ladder
 * ------------------------------------------------------------------ */

function StageLadder({ request, people, directory, queues, meId, now, flash, openStages, onToggle }) {
  return (
    <div>
      {request.stages.map((stage, i) => (
        <StageCard
          key={stage.id}
          stage={stage}
          index={i}
          isLast={i === request.stages.length - 1}
          request={request}
          people={people}
          directory={directory}
          queues={queues}
          meId={meId}
          now={now}
          justArrived={flash?.toIndex === i && (flash?.kind === 'advanced' || flash?.kind === 'escalated' || flash?.kind === 'delegated')}
          open={openStages[i] ?? (i === request.currentStage)}
          onToggle={() => onToggle(i)}
        />
      ))}
    </div>
  );
}

function StageCard({ stage, index, isLast, request, people, directory, queues, meId, now, justArrived, open, onToggle }) {
  const { t, a } = useTheme();
  const isCurrent = index === request.currentStage && request.state === 'awaiting';
  const hue = stageHue(stage, index === request.currentStage, request.state);
  const c = a(hue);
  const tally = stageTally(stage);
  const specs = (stage.approvers || []).map(sp => describeApprover(sp, { directory, queues }));

  return (
    <div className="flex gap-3">
      {/* rail: node + connector, drawn like a pipeline */}
      <div className="flex flex-col items-center flex-shrink-0 w-7">
        <span className={cx('w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0',
          stage.state === 'approved' ? cx(c.solid, 'border-transparent', 'text-white')
            : stage.state === 'rejected' ? cx(c.solid, 'border-transparent', 'text-white')
            : isCurrent ? cx(c.softStrong, c.borderStrong, c.fg)
            : cx(t.bgSubtle, 'border-transparent', t.textMuted))}>
          {stage.state === 'approved' ? <Check size={ICON.base} />
            : stage.state === 'rejected' ? <X size={ICON.base} />
            : <span className="text-[11px] font-semibold tabular-nums">{index + 1}</span>}
        </span>
        {!isLast && <span className={cx('w-px flex-1 min-h-6', stage.state === 'approved' ? c.dot : t.rule)} />}
      </div>

      <div className="flex-1 min-w-0 pb-3">
        <div className={cx('rounded-xl border transition-colors',
          isCurrent ? cx(c.soft, c.borderStrong, 'border-2') : cx(t.bgCard, t.borderLight),
          justArrived && 'shadow-lg')}>
          <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 text-left">
            {open ? <ChevronDown size={ICON.base} className={t.textMuted} /> : <ChevronRight size={ICON.base} className={t.textMuted} />}
            <span className="flex-1 min-w-0">
              <span className={cx('text-sm font-medium block truncate', t.text)}>{stage.name}</span>
              <span className={cx('text-[11px] block truncate', t.textMuted)}>
                {stageRuleLabel(stage)}
                {stage.state === 'awaiting' && ` · ${tally.approved} of ${tally.need} approved`}
                {stage.timedOut && ' · resolved by timeout'}
                {stage.escalated && ' · escalated'}
              </span>
            </span>
            {justArrived && <Chip accent="emerald" icon={Sparkles}>now open</Chip>}
            {stage.state === 'awaiting' && stage.dueAt && (
              <Chip accent={ms(stage.dueAt) < now ? 'red' : 'gray'} icon={Clock}>
                {ms(stage.dueAt) < now ? `overdue ${span(now - ms(stage.dueAt))}` : `due in ${span(ms(stage.dueAt) - now)}`}
              </Chip>
            )}
            <StatusPill status={stage.state === 'pending' ? 'todo' : stage.state} />
          </button>

          {open && (
            <div className={cx('border-t px-3 py-2.5 space-y-2', t.borderLight)}>
              {specs.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cx('text-[11px]', t.textMuted)}>Policy asks for</span>
                  <ChipGroup items={specs} accent="slate" icon={Users} max={3} />
                  <span className={cx('text-[11px]', t.textMuted)} title={stageRuleHint(stage)}>· {stageRuleHint(stage)}</span>
                </div>
              )}

              {stage.approverIds.length === 0 ? (
                <p className={cx('text-xs flex items-center gap-1.5', t.textMuted)}>
                  <TriangleAlert size={ICON.sm} /> No approver resolved for this stage.
                </p>
              ) : (
                <div className="space-y-1">
                  {stage.approverIds.map(id => (
                    <ApproverLine
                      key={id}
                      person={people.get(id)}
                      personId={id}
                      decision={decisionOf(stage, id)}
                      isMe={id === meId}
                      active={isCurrent}
                      delegatedBy={(stage.delegations || []).find(d => d.toId === id)}
                      people={people}
                      now={now}
                    />
                  ))}
                </div>
              )}

              {stage.state === 'awaiting' && stage.startedAt && (
                <p className={cx('text-[11px]', t.textMuted)}>
                  Opened {ago(stage.startedAt, now)} · on timeout: {timeoutLabel(stage).toLowerCase()}
                  {stage.onTimeout === 'escalate' && stage.escalateTo
                    ? ` to ${describeApprover(stage.escalateTo, { directory, queues })}`
                    : ''}
                </p>
              )}
              {stage.resolvedAt && (
                <p className={cx('text-[11px]', t.textMuted)}>
                  {stage.state === 'approved' ? 'Cleared' : 'Failed'} {ago(stage.resolvedAt, now)} · {stamp(stage.resolvedAt)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ApproverLine({ person, personId, decision, isMe, active, delegatedBy, people, now }) {
  const { t, a } = useTheme();
  const verdictHue = decision ? (decision.verdict === 'approved' ? 'emerald' : 'red') : active ? 'amber' : 'gray';
  const c = a(verdictHue);
  const name = person?.name || personId;

  return (
    <div className={cx('flex items-start gap-2.5 rounded-lg px-2 py-1.5', decision ? c.soft : t.bgSubtle)}>
      <Avatar name={name} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cx('text-sm font-medium truncate', t.text)}>{name}</span>
          {isMe && <Chip accent="violet">you</Chip>}
          <span className={cx('text-[11px] truncate', t.textMuted)}>{person?.title || 'Not in directory'}</span>
          {delegatedBy && (
            <Chip accent="violet" icon={CornerDownRight} title={`Delegated by ${people.get(delegatedBy.fromId)?.name || delegatedBy.fromId}`}>
              delegated by {people.get(delegatedBy.fromId)?.name?.split(' ')[0] || 'someone'}
            </Chip>
          )}
        </div>
        {decision?.comment && (
          <p className={cx('text-xs mt-0.5 leading-relaxed', t.textSecondary)}>“{decision.comment}”</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <span className={cx('inline-flex items-center gap-1 text-[11px] font-medium', c.fg)}>
          {decision
            ? (decision.verdict === 'approved' ? <CircleCheck size={ICON.sm} /> : <CircleX size={ICON.sm} />)
            : active ? <Hourglass size={ICON.sm} /> : <CircleDot size={ICON.sm} />}
          {decision ? (decision.verdict === 'approved' ? 'Approved' : 'Rejected') : active ? 'Waiting' : 'Not yet asked'}
        </span>
        {decision?.at && (
          <span className={cx('text-[10px]', t.textMuted)} title={stamp(decision.at)}>{ago(decision.at, now)}</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Why this applied — the live explain() trace
 * ------------------------------------------------------------------ */

function PolicyTrace({ policy, request }) {
  const { t } = useTheme();
  const ctx = request.context || {};
  const trace = useMemo(() => (policy ? explain(policy.appliesWhen, ctx) : null), [policy, ctx]);

  if (!policy) {
    return (
      <Banner accent="slate" icon={Info} title="The policy behind this request is not in this instance">
        The request records it as <strong className={t.text}>{request.policyName || request.policyId || 'unknown'}</strong>.
        Its stages are frozen onto the request, so the ladder above is still accurate — only the condition trace
        cannot be replayed.
      </Banner>
    );
  }

  const rowCount = countRows(policy.appliesWhen);

  return (
    <Card className={cx(DENSITY.cardPad, 'space-y-2')}>
      <div className="flex items-start gap-2">
        <Scale size={ICON.md} className={t.textMuted} />
        <div className="min-w-0">
          <p className={cx('text-sm', t.text)}>{policy.name}</p>
          <p className={cx('text-xs', t.textSecondary)}>{policy.description || summarize(policy.appliesWhen)}</p>
        </div>
      </div>
      <div className={cx('rounded-lg border p-2', t.bgSubtle, t.borderLight)}>
        {rowCount === 0
          ? <p className={cx('text-xs', t.textMuted)}>This policy has no conditions — it applies to every submission it is attached to.</p>
          : <TraceNode node={trace} />}
      </div>
      <p className={cx('text-[11px]', t.textMuted)}>
        Evaluated live against the request context that was captured at submission — the same
        <code> evaluate()</code> the routing rules and automation IF-nodes use.
      </p>
    </Card>
  );
}

function TraceNode({ node }) {
  const { t, a } = useTheme();
  if (!node) return null;
  const c = a(node.matched ? 'emerald' : 'red');

  if (node.kind === 'group') {
    return (
      <div className={cx('min-w-0', node.depth > 0 && 'mt-1')}>
        <div className="flex items-center gap-1.5">
          <span className={cx('text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded', c.soft, c.fgOnSoft)}>
            {node.match === 'any' ? 'any of' : 'all of'}
          </span>
          {node.matched
            ? <CircleCheck size={ICON.sm} className={c.fg} />
            : <CircleX size={ICON.sm} className={c.fg} />}
        </div>
        <div className={cx('mt-1 pl-2 border-l space-y-1', t.borderLight)}>
          {(node.rows || []).map((child, i) => <TraceNode key={i} node={child} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5 min-w-0">
      {node.matched
        ? <CircleCheck size={ICON.sm} className={cx(c.fg, 'mt-0.5 flex-shrink-0')} />
        : <CircleX size={ICON.sm} className={cx(c.fg, 'mt-0.5 flex-shrink-0')} />}
      <span className="min-w-0">
        <span className={cx('text-xs', t.text)}>{node.label}</span>
        <span className={cx('text-[11px] ml-1.5', t.textMuted)}>
          (actual: {formatActual(node.actual)})
        </span>
      </span>
    </div>
  );
}

function formatActual(v) {
  if (v == null) return 'not set';
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'empty';
  if (typeof v === 'object') return JSON.stringify(v);
  if (v === '') return 'empty';
  return String(v);
}

/* ------------------------------------------------------------------ *
 * Deciding
 * ------------------------------------------------------------------ */

function DecisionPanel({ request, mine, actor, meId, people, comment, setComment, onSubmit }) {
  const { t } = useTheme();

  if (!mine) {
    return <WhyNotYou request={request} meId={meId} actor={actor} people={people} />;
  }

  return (
    <Card accent="amber" className={cx(DENSITY.cardPad, 'space-y-3')}>
      <div className="flex items-center gap-2">
        <Avatar name={actor?.name} size="md" />
        <div className="min-w-0">
          <p className={cx('text-sm font-medium', t.text)}>Your decision as {actor?.name || meId}</p>
          <p className={cx('text-[11px]', t.textMuted)}>
            Recorded against “{request.stages[request.currentStage]?.name}” with a timestamp. It cannot be edited afterwards.
          </p>
        </div>
      </div>
      <Field label="Comment" hint="Optional for an approval, and the reason the requester sees on a rejection.">
        <Textarea
          rows={2}
          accent="amber"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="e.g. Budget line confirmed — approved for the Q4 spend."
        />
      </Field>
      <div className="flex items-center justify-end gap-2">
        <Button variant="soft" accent="red" icon={X} onClick={() => onSubmit('rejected')}>Reject</Button>
        <Button variant="solid" accent="emerald" icon={Check} onClick={() => onSubmit('approved')}>Approve</Button>
      </div>
    </Card>
  );
}

/**
 * Gate by state rather than showing a disabled Approve button — and always say
 * why, because "the button is missing" is not an explanation.
 */
function WhyNotYou({ request, meId, actor, people }) {
  const { t } = useTheme();
  const stage = request.stages[request.currentStage];
  const mineAlready = stage ? decisionOf(stage, meId) : null;

  if (request.state !== 'awaiting') {
    const last = request.stages.flatMap(s => s.decisions).slice(-1)[0];
    return (
      <Banner accent={request.state === 'approved' ? 'emerald' : 'slate'} icon={request.state === 'approved' ? CircleCheck : Ban}
        title={`This request is ${request.state}`}>
        Resolved {stamp(request.resolvedAt)}
        {last ? ` · last decision by ${people.get(last.approverId)?.name || last.approverId}` : ''}. No further decisions are possible.
      </Banner>
    );
  }
  if (mineAlready) {
    return (
      <Banner accent={mineAlready.verdict === 'approved' ? 'emerald' : 'red'} icon={CheckCheck}
        title={`You already ${mineAlready.verdict} this stage`}>
        {stamp(mineAlready.at)}{mineAlready.comment ? ` — “${mineAlready.comment}”` : ''}.
        The stage is still open because it needs {stageNeed(stage)} of {stage.approverIds.length}.
      </Banner>
    );
  }
  return (
    <Banner accent="slate" icon={Users} title={`“${stage?.name || 'This stage'}” is not yours to decide`}>
      <span className={t.textSecondary}>
        It is waiting on {(stage?.approverIds || []).map(id => people.get(id)?.name || id).join(', ') || 'nobody'}.
        {' '}Use the <strong className={t.text}>Acting as</strong> control in the header to sit in one of their chairs,
        or delegate yourself in.
      </span>
    </Banner>
  );
}

/* ------------------------------------------------------------------ *
 * Delegation
 * ------------------------------------------------------------------ */

function DelegateModal({ open, request, directory, meId, onClose, onPick }) {
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  if (!open) return null;

  const stage = request.stages[request.currentStage];
  const already = new Set(stage?.approverIds || []);
  const q = query.trim().toLowerCase();
  const people = directory
    .filter(p => !already.has(p.id))
    .filter(p => !q || `${p.name} ${p.title || ''} ${p.department || ''}`.toLowerCase().includes(q));

  return (
    <Modal
      open
      onClose={onClose}
      accent="violet"
      size="modalSm"
      z={LAYOUT.zNestedModal}
      icon={UserPlus}
      title="Delegate this decision"
      subtitle={stage?.name}
      footer={<><span /><Button variant="outline" onClick={onClose}>Cancel</Button></>}
    >
      <div className="space-y-3">
        <Banner accent="amber" icon={Info}>
          Delegation <strong className={t.text}>adds</strong> the person to this stage's approvers — it does not
          remove you. With “{stageRuleLabel(stage || {})}” that means the stage will need
          {' '}{stage?.rule === 'all' ? 'their decision too' : 'no more decisions than before'}.
        </Banner>
        <SearchInput value={query} onChange={setQuery} placeholder="Search the directory…" accent="violet" />
        <div className="space-y-1 max-h-72 overflow-auto">
          {people.length === 0 && (
            <p className={cx('text-sm text-center py-6', t.textMuted)}>Nobody matches “{query}”.</p>
          )}
          {people.map(p => (
            <button
              key={p.id}
              onClick={() => onPick(p.id)}
              className={cx('w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left', t.bgHover)}
            >
              <Avatar name={p.name} size="md" />
              <span className="flex-1 min-w-0">
                <span className={cx('text-sm block truncate', t.text)}>{p.name}{p.id === meId ? ' (you)' : ''}</span>
                <span className={cx('text-[11px] block truncate', t.textMuted)}>{p.title || 'Employee'} · {p.department || '—'}</span>
              </span>
              <UserPlus size={ICON.base} className={t.textMuted} />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
