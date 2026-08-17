import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LayoutGrid, Inbox, CheckSquare, Stamp, GraduationCap, Layers, Plus, Filter,
  AlertTriangle, AlertCircle, Clock, ChevronDown, ChevronUp, MessageSquare, Lock, Globe,
  User, Building2, Mail, Phone, MessageCircle, GitBranch, AlertOctagon,
  Timer, Send, ListChecks, Heading1, List, ListOrdered, Quote, Minus, Users,
  Tag, Play, Crown, MapPin, ShieldCheck, Check, CornerDownRight, Briefcase,
  MonitorSmartphone, Star, Pause, Trash2, X, Hash, Target,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, GRADIENT, PRIORITY, STATUS,
  SLA_STATE, statusMeta, priorityMeta,
  Button, IconButton, Chip, ChipGroup, StatusPill, PriorityFlag,
  EntityTag, Avatar, EmptyState, Card, Panel, Section, GroupLabel,
  ListRow, Stat, Banner, Divider,
  Field, Input, Textarea, Checkbox, TileGroup, SearchInput,
  Modal, Menu, MenuItem, MenuLabel, FilterPill,
  LensBar, SubTabs, PageHeader, Toolbar, PageBody,
} from '@/ds';
import { useStore, patchIn, addTo, uid, NOW } from '@/store/store.js';
import { navigate } from '@/lib/router.js';
import { canDecide, decide, progress } from '@/lib/approvals.js';
import { LOC } from '@/store/seed/ids.js';

/**
 * My Workspace — the worker's home.
 *
 * One list over four record types that a person actually owns: tickets they are
 * working, tasks they have to do, approvals waiting on their signature, and
 * training they have been assigned. v1 kept these on four screens, which meant
 * the honest answer to "what do I do next?" lived in nobody's head.
 *
 * TWO DETAIL MODALS, ONE SHELL, DELIBERATELY DIFFERENT INSIDES:
 *   · A TICKET is an inbound request from a person. It has a requester with a
 *     profile (internal employee OR external customer contact), an SLA clock
 *     driven by that customer's plan, and a conversation. It cannot be broken
 *     into subtasks — decomposing someone else's request is work, and work is a
 *     task. So the ticket modal offers "create a linked task" instead of
 *     showing a subtask list it would have to disable.
 *   · A TASK is your own decomposable work. It has subtasks, checklists and a
 *     slash-command editor, and no SLA at all.
 * The shared parts (mini-header, chip bar, property tiles) are real shared
 * components rather than a copy, so the two screens cannot drift apart.
 */

/* ==================================================================== *
 * Constants
 * ==================================================================== */

const KIND_META = {
  ticket:      { entity: 'ticket',      accent: 'rose',   icon: Inbox,         label: 'Ticket',       plural: 'Tickets' },
  task:        { entity: 'task',        accent: 'teal',   icon: CheckSquare,   label: 'Task',         plural: 'Personal tasks' },
  projectTask: { entity: 'projectTask', accent: 'violet', icon: CheckSquare,   label: 'Project task', plural: 'Project tasks' },
  approval:    { entity: 'approval',    accent: 'amber',  icon: Stamp,         label: 'Approval',     plural: 'Approvals' },
  learning:    { entity: 'course',      accent: 'indigo', icon: GraduationCap, label: 'Learning',     plural: 'Learning' },
};

const KIND_ORDER = ['ticket', 'approval', 'task', 'projectTask', 'learning'];

const LENSES = [
  { value: 'all',       label: 'Everything', icon: Layers,        accent: 'purple', kinds: KIND_ORDER },
  { value: 'tickets',   label: 'Tickets',    icon: Inbox,         accent: 'rose',   kinds: ['ticket'] },
  { value: 'tasks',     label: 'Tasks',      icon: CheckSquare,   accent: 'teal',   kinds: ['task', 'projectTask'] },
  { value: 'approvals', label: 'Approvals',  icon: Stamp,         accent: 'amber',  kinds: ['approval'] },
  { value: 'learning',  label: 'Learning',   icon: GraduationCap, accent: 'indigo', kinds: ['learning'] },
];

const VIEW_OPTIONS = [
  { value: 'mine',       label: 'Assigned to me',  hint: 'Anything with your name on it', icon: User },
  { value: 'created',    label: 'Raised by me',    hint: 'Requests and tasks you opened',  icon: Send },
  { value: 'unassigned', label: 'Unassigned',      hint: 'In a queue, owned by nobody',    icon: Users },
  { value: 'all',        label: 'Everything',      hint: 'The whole desk, not just yours', icon: Globe },
];

const SOURCE_META = {
  portal: { label: 'Portal', icon: Globe },
  email:  { label: 'Email',  icon: Mail },
  chat:   { label: 'Chat',   icon: MessageCircle },
  phone:  { label: 'Phone',  icon: Phone },
};

const STAT_DEFS = [
  { key: 'open',        label: 'open tickets',       accent: 'rose',   icon: Inbox,         lens: 'tickets' },
  { key: 'in_progress', label: 'in progress',        accent: 'amber',  icon: Play,          lens: 'all' },
  { key: 'my_approval', label: 'awaiting my approval', accent: 'amber', icon: Stamp,        lens: 'approvals' },
  { key: 'open_tasks',  label: 'open tasks',         accent: 'teal',   icon: CheckSquare,   lens: 'tasks' },
  { key: 'overdue',     label: 'overdue',            accent: 'red',    icon: AlertTriangle, lens: 'all' },
  { key: 'total',       label: 'total',              accent: 'purple', icon: Layers,        lens: 'all' },
];

/** Locations live in the assets domain; these are the display fallbacks. */
const LOCATION_NAMES = {
  [LOC.CHI]: 'Chicago HQ',
  [LOC.NYC]: 'New York office',
  [LOC.AUS]: 'Austin support centre',
  [LOC.DC1]: 'Elk Grove data centre',
  [LOC.WAREHOUSE]: 'Bolingbrook warehouse',
  [LOC.REMOTE]: 'Remote / home office',
};

const LINK_META = {
  problem:  { label: 'Problem',  accent: 'fuchsia', icon: AlertOctagon, section: 'problems' },
  change:   { label: 'Change',   accent: 'orange',  icon: GitBranch,    section: 'changes' },
  ticket:   { label: 'Ticket',   accent: 'rose',    icon: Inbox,        section: 'workspace' },
  approval: { label: 'Approval', accent: 'amber',   icon: Stamp,        section: 'approvals' },
  task:     { label: 'Task',     accent: 'teal',    icon: CheckSquare,  section: 'workspace' },
};

const SLASH_BLOCKS = [
  { id: 'heading',  label: 'Heading',  hint: 'Section title',   icon: Heading1,    token: '# ' },
  { id: 'bullet',   label: 'Bullet',   hint: 'Bulleted item',   icon: List,        token: '- ' },
  { id: 'todo',     label: 'To-do',    hint: 'Checkbox item',   icon: CheckSquare, token: '[ ] ' },
  { id: 'numbered', label: 'Numbered', hint: 'Ordered item',    icon: ListOrdered, token: '1. ' },
  { id: 'quote',    label: 'Quote',    hint: 'Pulled-out note', icon: Quote,       token: '> ' },
  { id: 'divider',  label: 'Divider',  hint: 'Horizontal rule', icon: Minus,       token: '---\n' },
];

const DONE_GROUPS = ['done', 'closed'];
const PAUSED_STATUSES = ['pending', 'on_hold'];

/**
 * Deep links into this view arrive in three shapes, because three different
 * places in the app build them:
 *   #/workspace/ticket/<id>   — this view's own links and the approval targets
 *   #/workspace/tickets/<id>  — ⌘K search, the activity feed, the portal receipt
 *   #/workspace/<id>          — anything that links a record without naming a tab,
 *                               which the router reads into `sub`
 * Accepting only the first spelling meant a link that exists in the shipped app
 * opened an empty desk. All three are accepted here rather than renamed in five
 * other modules, because this view is the one that has to be right.
 */
const TICKET_SUBS = ['ticket', 'tickets'];
const TASK_SUBS = ['task', 'tasks'];

/* ==================================================================== *
 * Time helpers — every timestamp in the app is 12-hour AM/PM.
 * ==================================================================== */

function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

function addHours(date, hours) {
  if (!date || !Number.isFinite(Number(hours))) return null;
  return new Date(date.getTime() + Number(hours) * 3600000);
}

/** "Today" · "In 3 days" · "2 days ago" · "Sep 5" */
function relativeDay(value, now) {
  const d = parseDate(value);
  if (!d) return null;
  const days = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days <= 21) return `In ${days} days`;
  if (days < -1 && days >= -21) return `${Math.abs(days)} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtTime(value) {
  const d = parseDate(value);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function fmtStamp(value, now) {
  const d = parseDate(value);
  if (!d) return '';
  return `${relativeDay(d, now || NOW)} · ${fmtTime(d)}`;
}

function fmtDur(ms) {
  const total = Math.abs(Math.round(Number(ms) / 60000));
  if (!Number.isFinite(total)) return '—';
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function joinDots(parts) {
  return parts.filter(Boolean).join(' · ');
}

/* ==================================================================== *
 * SLA — computed from state.slaPolicies and the account's plan.
 * ==================================================================== */

function clockState({ startAt, dueAt, metAt, now, paused, stopped }) {
  if (!dueAt) return { state: 'ok', dueAt: null, metAt: metAt || null, deltaMs: 0, unmeasured: true };
  if (metAt) {
    const delta = dueAt.getTime() - metAt.getTime();
    return { state: delta >= 0 ? 'ok' : 'breached', dueAt, metAt, deltaMs: delta, met: true };
  }
  if (stopped) return { state: 'ok', dueAt, metAt: null, deltaMs: 0, unmeasured: true };
  if (paused) return { state: 'paused', dueAt, metAt: null, deltaMs: dueAt.getTime() - now.getTime() };
  const delta = dueAt.getTime() - now.getTime();
  if (delta <= 0) return { state: 'breached', dueAt, metAt: null, deltaMs: delta };
  const span = startAt ? dueAt.getTime() - startAt.getTime() : 0;
  const used = span > 0 ? (now.getTime() - startAt.getTime()) / span : 0;
  return { state: used >= 0.75 ? 'at_risk' : 'ok', dueAt, metAt: null, deltaMs: delta };
}

/**
 * Resolve the SLA position of a ticket.
 * Order of resolution is explicit rather than implied: the policy stamped on
 * the record wins, then the customer's plan, then the internal policy. The
 * panel says which one it used, because "why is this ticket on a one-hour
 * clock?" is a question every support lead asks in week one.
 */
function slaFor(ticket, slaPolicies, organizations, now) {
  if (!ticket) return null;
  const policies = slaPolicies || [];
  const org = ticket.orgId ? (organizations || []).find(o => o.id === ticket.orgId) : null;

  let policy = policies.find(p => p.id === ticket.slaPolicyId) || null;
  let basis = policy ? 'record' : null;
  if (!policy && org) {
    policy = policies.find(p => p.appliesTo?.kind === 'plan' && p.appliesTo.plan === org.plan) || null;
    if (policy) basis = 'plan';
  }
  if (!policy) {
    policy = policies.find(p => p.appliesTo?.kind === 'internal') || null;
    if (policy) basis = 'internal';
  }
  if (!policy) return null;

  const target = policy.targets?.[ticket.priority]
    || { first: policy.firstResponseHours, resolve: policy.resolutionHours };
  const created = parseDate(ticket.createdAt);
  if (!created) return null;

  const group = statusMeta(ticket.status).group;
  const stopped = DONE_GROUPS.includes(group);
  const paused = !stopped && PAUSED_STATUSES.includes(ticket.status);
  const closedAt = stopped ? parseDate(ticket.updatedAt) : null;

  const first = clockState({
    startAt: created,
    dueAt: addHours(created, target.first),
    metAt: parseDate(ticket.firstResponseAt),
    now, paused, stopped,
  });
  const resolution = clockState({
    startAt: created,
    dueAt: addHours(created, target.resolve),
    metAt: stopped ? closedAt : null,
    now, paused, stopped,
  });

  const breached = !stopped && !paused && (first.state === 'breached' || resolution.state === 'breached');
  const atRisk = !breached && !stopped && !paused && (first.state === 'at_risk' || resolution.state === 'at_risk');

  return { policy, basis, org, target, first, resolution, paused, stopped, breached, atRisk };
}

/** The one word that describes where a ticket stands against its clock. */
function slaOverall(sla) {
  if (!sla) return 'ok';
  if (sla.breached) return 'breached';
  if (sla.paused) return 'paused';
  if (sla.atRisk) return 'at_risk';
  return 'ok';
}

function slaBasisNote(sla) {
  if (!sla) return '';
  if (sla.basis === 'plan' && sla.org) return `from ${sla.org.name}'s ${sla.org.plan} plan`;
  if (sla.basis === 'internal') return 'internal staff policy';
  if (sla.org) return `stamped on the ticket · ${sla.org.name} is on ${sla.org.plan}`;
  return 'stamped on the ticket';
}

/* ==================================================================== *
 * Status
 *
 * Projects define their OWN status columns (Backlog › Discovery › Build ›
 * Validation › Signed off), so a workspace that only knew the global STATUS map
 * would print raw ids like "signed_off" at the reader. Resolution order:
 * the owning project's board first, the global map second.
 * ==================================================================== */

function statusInfoFor(status, project) {
  const custom = (project?.statuses || []).find(s => s.id === status);
  if (custom && !STATUS[status]) {
    const raw = custom.group;
    const group = raw === 'not_started' ? 'open'
      : ['open', 'active', 'done', 'closed'].includes(raw) ? raw
      : 'active';
    return { key: status, label: custom.label || String(status), hue: custom.hue || 'gray', group, custom: true };
  }
  const meta = statusMeta(status);
  return { key: status, label: meta.label, hue: meta.hue, group: meta.group, custom: !STATUS[status] };
}

/** StatusPill for a registered status, an accent Chip for a project's own. */
function StatusBadge({ info }) {
  if (!info) return null;
  if (!info.custom) return <StatusPill status={info.key} />;
  return <Chip accent={info.hue}>{info.label}</Chip>;
}

/* ==================================================================== *
 * People resolution — the internal directory AND the customer contact book.
 * ==================================================================== */

function findPerson(data, id) {
  if (!id) return null;
  const employee = (data.directory || []).find(p => p.id === id);
  if (employee) return { ...employee, external: false };
  const contact = (data.contacts || []).find(c => c.id === id);
  if (contact) return { ...contact, external: true };
  return null;
}

function personName(data, id) {
  return findPerson(data, id)?.name || null;
}

/** The requester profile, in whichever of the two shapes applies. */
function resolveRequester(data, ticket) {
  if (!ticket) return null;
  if (ticket.isExternal) {
    const contact = (data.contacts || []).find(c => c.id === ticket.contactId) || null;
    const org = (data.organizations || []).find(o => o.id === (ticket.orgId || contact?.orgId)) || null;
    const csm = org?.csm ? findPerson(data, org.csm) : null;
    return {
      external: true,
      id: contact?.id || null,
      name: contact?.name || 'Unknown contact',
      title: contact?.title || null,
      email: contact?.email || null,
      phone: contact?.phone || null,
      timezone: contact?.timezone || null,
      vip: !!contact?.vip,
      org, csm,
    };
  }
  const person = (data.directory || []).find(p => p.id === ticket.requesterId) || null;
  const manager = person?.managerId ? (data.directory || []).find(p => p.id === person.managerId) : null;
  const location = person?.locationId
    ? ((data.locations || []).find(l => l.id === person.locationId)?.name || LOCATION_NAMES[person.locationId] || null)
    : null;
  return {
    external: false,
    id: person?.id || null,
    name: person?.name || 'Unknown requester',
    title: person?.title || null,
    email: person?.email || null,
    department: person?.department || null,
    manager, location,
    vip: false,
  };
}

/* ==================================================================== *
 * Normalising the four record types into one row model
 * ==================================================================== */

function ticketItem(ticket, data, now) {
  const sla = slaFor(ticket, data.slaPolicies, data.organizations, now);
  const requester = resolveRequester(data, ticket);
  const queue = (data.queues || []).find(q => q.id === ticket.queueId) || null;
  const group = statusMeta(ticket.status).group;
  return {
    kind: 'ticket',
    id: ticket.id,
    title: ticket.title,
    keyLabel: ticket.key || ticket.id,
    subtitle: joinDots([
      requester?.name,
      requester?.external ? requester.org?.name : requester?.department,
      queue?.name,
    ]),
    status: ticket.status,
    statusInfo: statusInfoFor(ticket.status, null),
    priority: ticket.priority,
    queueId: ticket.queueId,
    assigneeId: ticket.assigneeId || null,
    ownerId: ticket.requesterId || ticket.contactId || null,
    due: sla?.resolution?.dueAt || null,
    overdue: !!sla?.breached,
    atRisk: !!sla?.atRisk,
    done: DONE_GROUPS.includes(group),
    labels: ticket.labels || [],
    searchText: [ticket.key, ticket.title, ticket.description, requester?.name, requester?.org?.name, queue?.name, (ticket.labels || []).join(' ')].join(' ').toLowerCase(),
    record: ticket,
    sla,
  };
}

function taskItem(task, data, now) {
  const projectId = task.projectId || task.project || null;
  const project = projectId ? (data.projects || []).find(p => p.id === projectId) : null;
  const kind = projectId ? 'projectTask' : 'task';
  const due = task.dueAt || task.dueDate || task.due || null;
  const status = task.status || 'todo';
  const info = statusInfoFor(status, project);
  const done = DONE_GROUPS.includes(info.group);
  const dueDate = parseDate(due);
  const assigneeId = task.assigneeId || task.assignee || null;
  const parent = task.parentId ? (data.tasks || []).find(x => x.id === task.parentId) : null;
  return {
    kind,
    id: task.id,
    title: task.title || task.name || 'Untitled task',
    keyLabel: task.key || (kind === 'projectTask' ? 'Project task' : 'Task'),
    subtitle: joinDots([
      project ? (project.name || project.title) : 'Personal',
      parent ? `subtask of ${parent.title || parent.name}` : null,
      personName(data, assigneeId),
      task.milestone ? 'Milestone' : null,
    ]),
    status,
    statusInfo: info,
    priority: task.priority || 'medium',
    queueId: null,
    assigneeId,
    ownerId: task.createdById || task.creatorId || task.requesterId || null,
    due: dueDate,
    overdue: !done && !!dueDate && dueDate.getTime() < now.getTime(),
    atRisk: false,
    done,
    labels: task.labels || task.tags || [],
    searchText: [task.title, task.name, task.description, project?.name, (task.labels || []).join(' ')].join(' ').toLowerCase(),
    record: task,
    project,
  };
}

function approvalItem(request, data, now) {
  const stages = request.stages || [];
  const stage = stages[request.currentStage] || null;
  const dueAt = parseDate(stage?.dueAt);
  const live = request.state === 'awaiting';
  // A request with no stages is a configuration fault, not a reason to crash
  // the workspace — surface it as "0 of 0" and let the Approvals inbox explain.
  const p = stages.length ? progress(request) : { stageNumber: 0, totalStages: 0, approvals: 0, need: 0 };
  return {
    kind: 'approval',
    id: request.id,
    title: request.subject || request.policyName || 'Approval request',
    keyLabel: request.policyName || 'Approval',
    subtitle: joinDots([
      stage?.name,
      `Stage ${p.stageNumber} of ${p.totalStages}`,
      `${p.approvals} of ${p.need} approved`,
      personName(data, request.requesterId) ? `raised by ${personName(data, request.requesterId)}` : null,
    ]),
    status: request.state,
    statusInfo: statusInfoFor(request.state, null),
    priority: 'medium',
    queueId: null,
    assigneeId: null,
    approverIds: stage?.approverIds || [],
    ownerId: request.requesterId || null,
    due: dueAt,
    overdue: live && !!dueAt && dueAt.getTime() < now.getTime(),
    atRisk: false,
    done: !live,
    labels: [],
    searchText: [request.subject, request.policyName, stage?.name].join(' ').toLowerCase(),
    record: request,
  };
}

function learningItem(enrollment, data, now) {
  const courseId = enrollment.courseId || enrollment.course || null;
  const course = courseId ? (data.courses || []).find(c => c.id === courseId) : null;
  const curriculum = enrollment.curriculumId
    ? (data.curricula || []).find(c => c.id === enrollment.curriculumId)
    : null;
  const due = enrollment.dueAt || enrollment.dueDate || enrollment.due || null;
  const dueDate = parseDate(due);
  const status = enrollment.status || 'enrolled';
  const done = ['passed', 'certified', 'completed'].includes(status);
  const learnerId = enrollment.userId || enrollment.learnerId || enrollment.assigneeId || null;

  // Progress is derived from the lessons actually completed rather than stored
  // twice — the enrollment already knows which knowledge atoms the learner has
  // finished, and a second `progress` number would only drift from it.
  const totalLessons = (course?.modules || []).reduce((n, m) => n + (m.lessonIds || []).length, 0);
  const doneLessons = (enrollment.completedLessonIds || []).length;
  const pct = Number.isFinite(Number(enrollment.progress))
    ? Number(enrollment.progress)
    : (totalLessons > 0 ? (doneLessons / totalLessons) * 100 : null);

  return {
    kind: 'learning',
    id: enrollment.id,
    title: course?.title || course?.name || enrollment.title || 'Assigned course',
    keyLabel: curriculum ? (curriculum.title || curriculum.name || 'Curriculum') : 'Course',
    subtitle: joinDots([
      curriculum ? (curriculum.title || curriculum.name) : null,
      totalLessons > 0 ? `${doneLessons} of ${totalLessons} lessons` : null,
      pct != null && Number.isFinite(pct) ? `${Math.round(pct)}%` : null,
      personName(data, learnerId),
    ]),
    status,
    statusInfo: statusInfoFor(status, null),
    priority: 'medium',
    queueId: null,
    assigneeId: learnerId,
    ownerId: learnerId,
    due: dueDate,
    overdue: !done && !!dueDate && dueDate.getTime() < now.getTime(),
    atRisk: false,
    done,
    labels: [],
    searchText: [course?.title, course?.name, curriculum?.title].join(' ').toLowerCase(),
    record: enrollment,
    courseId,
  };
}

/* ==================================================================== *
 * Filtering — every filter is a predicate and they compose with AND.
 * Search does not replace the others; it narrows whatever they left.
 * ==================================================================== */

/** canDecide() assumes a well-formed request; a half-built one must not crash a list. */
function isDecidable(request, userId) {
  if (!request || !Array.isArray(request.stages) || !request.stages.length) return false;
  return canDecide(request, userId);
}

/** Tickets and tasks are "work in flight"; approvals and courses are not. */
function isWorkKind(item) {
  return item.kind === 'ticket' || item.kind === 'task' || item.kind === 'projectTask';
}

function passesView(item, view, meId) {
  if (view === 'all') return true;
  if (view === 'mine') {
    if (item.kind === 'approval') return (item.approverIds || []).includes(meId);
    return item.assigneeId === meId;
  }
  if (view === 'created') return item.ownerId === meId;
  if (view === 'unassigned') return item.kind === 'ticket' && !item.assigneeId;
  return true;
}

function passesQuick(item, quick, meId) {
  switch (quick) {
    case 'open': return item.kind === 'ticket' && statusMeta(item.status).group === 'open';
    case 'in_progress': return isWorkKind(item) && item.statusInfo.group === 'active' && !item.done;
    case 'my_approval': return item.kind === 'approval' && isDecidable(item.record, meId);
    case 'open_tasks': return (item.kind === 'task' || item.kind === 'projectTask') && !item.done;
    case 'overdue': return item.overdue;
    case 'total': return true;
    default: return true;
  }
}

function dueBucket(item, now) {
  if (item.overdue) return 'overdue';
  if (!item.due) return 'nodate';
  const days = Math.round((startOfDay(item.due).getTime() - startOfDay(now).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days <= 7) return 'week';
  return 'later';
}

const BUCKET_LABEL = {
  overdue: 'Overdue',
  today: 'Due today',
  week: 'This week',
  later: 'Later',
  nodate: 'No date',
};
const BUCKET_ORDER = ['overdue', 'today', 'week', 'later', 'nodate'];

function sortItems(a, b) {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  if (a.done !== b.done) return a.done ? 1 : -1;
  const ad = a.due ? a.due.getTime() : Number.MAX_SAFE_INTEGER;
  const bd = b.due ? b.due.getTime() : Number.MAX_SAFE_INTEGER;
  if (ad !== bd) return ad - bd;
  return priorityMeta(b.priority).rank - priorityMeta(a.priority).rank;
}

/* ==================================================================== *
 * The view
 * ==================================================================== */

export default function Workspace({ route }) {
  const { t } = useTheme();
  const data = useStore(s => ({
    currentUser: s.currentUser,
    tickets: s.tickets,
    tasks: s.tasks,
    approvals: s.approvals,
    enrollments: s.enrollments,
    courses: s.courses,
    curricula: s.curricula,
    projects: s.projects,
    queues: s.queues,
    directory: s.directory,
    agents: s.agents,
    contacts: s.contacts,
    organizations: s.organizations,
    slaPolicies: s.slaPolicies,
    subforms: s.subforms,
    problems: s.problems,
    changes: s.changes,
    locations: s.locations,
  }));

  const meId = data.currentUser?.id || null;
  const now = NOW;

  const [lens, setLens] = useState('all');
  const [quick, setQuick] = useState(null);
  const [view, setView] = useState('mine');
  const [queueIds, setQueueIds] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [creating, setCreating] = useState(null);

  const items = useMemo(() => {
    const out = [];
    for (const ticket of data.tickets || []) out.push(ticketItem(ticket, data, now));
    for (const task of data.tasks || []) out.push(taskItem(task, data, now));
    for (const req of data.approvals || []) out.push(approvalItem(req, data, now));
    for (const enr of data.enrollments || []) out.push(learningItem(enr, data, now));
    return out;
  }, [data, now]);

  /* Everything except the lens — so the lens counts reflect the other filters. */
  const preLens = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(item => {
      if (!passesView(item, view, meId)) return false;
      if (queueIds.length && !queueIds.includes(item.queueId)) return false;
      if (statuses.length && !statuses.includes(item.status)) return false;
      if (priorities.length && !priorities.includes(item.priority)) return false;
      if (quick && !passesQuick(item, quick, meId)) return false;
      if (needle && !item.searchText.includes(needle)) return false;
      return true;
    });
  }, [items, view, meId, queueIds, statuses, priorities, quick, search]);

  const activeLens = LENSES.find(l => l.value === lens) || LENSES[0];
  const visible = useMemo(
    () => preLens.filter(item => activeLens.kinds.includes(item.kind)).sort(sortItems),
    [preLens, activeLens],
  );

  const lensItems = LENSES.map(l => ({
    ...l,
    count: preLens.filter(item => l.kinds.includes(item.kind)).length,
  }));

  /* Stats are computed over the whole desk, not the filtered view — a counter
   * that moves when you filter is a counter you cannot trust. */
  const stats = useMemo(() => {
    const mine = items.filter(item => passesView(item, 'mine', meId));
    return {
      open: mine.filter(i => i.kind === 'ticket' && i.statusInfo.group === 'open').length,
      in_progress: mine.filter(i => isWorkKind(i) && i.statusInfo.group === 'active' && !i.done).length,
      my_approval: (data.approvals || []).filter(r => isDecidable(r, meId)).length,
      open_tasks: mine.filter(i => (i.kind === 'task' || i.kind === 'projectTask') && !i.done).length,
      overdue: mine.filter(i => i.overdue).length,
      total: mine.length,
    };
  }, [items, data.approvals, meId]);

  const groups = useMemo(() => {
    if (lens === 'all') {
      return KIND_ORDER
        .map(kind => ({ id: kind, label: KIND_META[kind].plural, rows: visible.filter(i => i.kind === kind) }))
        .filter(g => g.rows.length);
    }
    return BUCKET_ORDER
      .map(bucket => ({ id: bucket, label: BUCKET_LABEL[bucket], rows: visible.filter(i => dueBucket(i, now) === bucket) }))
      .filter(g => g.rows.length);
  }, [visible, lens, now]);

  const filterCount = (view !== 'mine' ? 1 : 0) + (queueIds.length ? 1 : 0)
    + (statuses.length ? 1 : 0) + (priorities.length ? 1 : 0) + (quick ? 1 : 0);

  const openSub = route?.sub || null;
  const namedSub = TICKET_SUBS.includes(openSub) || TASK_SUBS.includes(openSub);
  const openId = route?.id || (namedSub ? null : openSub) || null;
  const ticketMatch = openId
    ? (data.tickets || []).find(x => x.id === openId || x.key === openId) || null
    : null;
  const taskMatch = openId ? (data.tasks || []).find(x => x.id === openId) || null : null;
  const openTicket = TASK_SUBS.includes(openSub) ? null : ticketMatch;
  const openTask = (openTicket || TICKET_SUBS.includes(openSub)) ? null : taskMatch;

  const openRecord = (item) => {
    if (item.kind === 'ticket') { navigate('workspace', 'ticket', item.id); return; }
    if (item.kind === 'task' || item.kind === 'projectTask') { navigate('workspace', 'task', item.id); return; }
    if (item.kind === 'approval') { navigate('approvals', 'request', item.id); return; }
    // Learning's course detail only opens on its `courses` tab — the singular
    // spelling landed the reader on Curricula with nothing selected.
    if (item.kind === 'learning' && item.courseId) { navigate('learning', 'courses', item.courseId); return; }
    navigate('learning', 'my');
  };

  const clearFilters = () => {
    setView('mine'); setQueueIds([]); setStatuses([]); setPriorities([]); setQuick(null); setSearch('');
  };

  /* Built from the records on screen, so a project's own columns appear here
   * under their real labels rather than as raw ids. */
  const statusOptions = useMemo(() => {
    const map = new Map();
    for (const item of items) if (!map.has(item.status)) map.set(item.status, item.statusInfo);
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={LayoutGrid}
        gradient={GRADIENT.workspace}
        title="My Workspace"
        subtitle={joinDots([
          data.currentUser?.name,
          data.currentUser?.title,
          `${stats.total} assigned to you`,
        ])}
        actions={<NewMenu onCreate={setCreating} />}
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {STAT_DEFS.map(def => (
              <Stat
                key={def.key}
                label={def.label}
                value={stats[def.key] ?? 0}
                accent={def.accent}
                icon={def.icon}
                active={quick === def.key}
                onClick={() => {
                  const next = quick === def.key ? null : def.key;
                  setQuick(next);
                  if (next) setLens(def.lens);
                }}
              />
            ))}
          </div>

          <LensBar items={lensItems} value={lens} onChange={setLens} split={3} />

          <Toolbar>
            <div className="relative">
              <FilterPill
                icon={User}
                label={VIEW_OPTIONS.find(v => v.value === view)?.label || 'View'}
                active={view !== 'mine'}
                open={openMenu === 'view'}
                onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}
              />
              <Menu open={openMenu === 'view'} onClose={() => setOpenMenu(null)} width="w-60">
                <MenuLabel>Whose work</MenuLabel>
                {VIEW_OPTIONS.map(opt => (
                  <MenuItem
                    key={opt.value}
                    icon={opt.icon}
                    label={opt.label}
                    hint={opt.hint}
                    selected={view === opt.value}
                    onClick={() => { setView(opt.value); setOpenMenu(null); }}
                  />
                ))}
              </Menu>
            </div>

            <MultiFilter
              icon={Inbox}
              label="Queue"
              open={openMenu === 'queue'}
              onToggle={() => setOpenMenu(openMenu === 'queue' ? null : 'queue')}
              onClose={() => setOpenMenu(null)}
              selected={queueIds}
              onChange={setQueueIds}
              options={(data.queues || []).map(q => ({
                value: q.id,
                label: q.name,
                hint: q.audience === 'external' ? 'Customer facing' : q.audience === 'both' ? 'Internal and customer' : 'Internal',
              }))}
              emptyLabel="Queue"
            />

            <MultiFilter
              icon={Target}
              label="Status"
              open={openMenu === 'status'}
              onToggle={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
              onClose={() => setOpenMenu(null)}
              selected={statuses}
              onChange={setStatuses}
              options={statusOptions.map(s => ({ value: s.key, label: s.label, hint: s.group }))}
              emptyLabel="Status"
            />

            <MultiFilter
              icon={Filter}
              label="Priority"
              open={openMenu === 'priority'}
              onToggle={() => setOpenMenu(openMenu === 'priority' ? null : 'priority')}
              onClose={() => setOpenMenu(null)}
              selected={priorities}
              onChange={setPriorities}
              options={Object.keys(PRIORITY).map(p => ({ value: p, label: PRIORITY[p].label, hint: `rank ${PRIORITY[p].rank}` }))}
              emptyLabel="Priority"
            />

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search titles, people, labels…"
              accent="teal"
              width="w-64"
            />
          </Toolbar>
        </div>
      </PageHeader>

      <PageBody>
        <div className="space-y-3">
          {search.trim() && filterCount > 0 && (
            <Banner accent="teal" icon={AlertCircle} title="Search is layered on top of your filters">
              “{search.trim()}” is narrowing the {filterCount === 1 ? 'one filter' : `${filterCount} filters`} already applied,
              not replacing them. {visible.length} of {items.length} records match both.
              <button onClick={clearFilters} className={cx('ml-1 underline font-medium', t.text)}>Clear filters</button>
            </Banner>
          )}

          {quick === 'my_approval' && stats.my_approval === 0 && (
            <Banner accent="amber" icon={Stamp} title="Nothing is waiting on your signature">
              Approval requests only appear here while you are on the current stage and have not yet decided.
              Earlier stages are somebody else's to clear first.
            </Banner>
          )}

          {view === 'unassigned' && (
            <Banner accent="blue" icon={AlertCircle} title="Unrouted requests land in General">
              A request submitted without a routing rule goes to the <strong className={t.text}>General</strong> queue and is
              triaged within one business hour. It is never silently dropped, and it is never auto-assigned to a person.
            </Banner>
          )}

          {groups.length === 0 ? (
            <EmptyState
              icon={activeLens.icon}
              title={search.trim() ? 'Nothing matches that search' : 'Nothing here right now'}
              hint={
                search.trim()
                  ? 'Search composes with the filters above rather than replacing them — clearing a filter may bring results back.'
                  : `No ${activeLens.label.toLowerCase()} match the current filters. Widen the view or clear a filter to see more.`
              }
              action={<Button variant="soft" accent="teal" icon={Filter} onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            groups.map(group => (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-1.5 px-0.5">
                  <GroupLabel>{group.label}</GroupLabel>
                  <span className={cx('text-[11px] tabular-nums px-1.5 rounded-full', t.bgSubtle, t.textMuted)}>
                    {group.rows.length}
                  </span>
                  <Divider className="flex-1" />
                </div>
                <div className={DENSITY.rowGap}>
                  {group.rows.map(item => (
                    <WorkRow
                      key={`${item.kind}:${item.id}`}
                      item={item}
                      data={data}
                      meId={meId}
                      now={now}
                      onOpen={() => openRecord(item)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </PageBody>

      {openTicket && <TicketModal ticket={openTicket} data={data} meId={meId} now={now} onClose={() => navigate('workspace')} />}
      {openTask && <TaskModal task={openTask} data={data} meId={meId} now={now} onClose={() => navigate('workspace')} />}
      {creating && (
        <NewRecordModal
          kind={creating}
          data={data}
          meId={meId}
          onClose={() => setCreating(null)}
          onCreated={(kind, id) => { setCreating(null); navigate('workspace', kind, id); }}
        />
      )}
    </div>
  );
}

/* ==================================================================== *
 * Toolbar pieces
 * ==================================================================== */

function MultiFilter({ icon, label, open, onToggle, onClose, selected, onChange, options, emptyLabel }) {
  const chosen = options.filter(o => selected.includes(o.value));
  const text = chosen.length === 0
    ? emptyLabel
    : chosen.length === 1
      ? chosen[0].label
      : `${chosen[0].label} +${chosen.length - 1}`;

  return (
    <div className="relative">
      <FilterPill icon={icon} label={text} active={selected.length > 0} open={open} onClick={onToggle} />
      <Menu open={open} onClose={onClose} width="w-64">
        <MenuLabel
          action={selected.length > 0 && (
            <Button variant="ghost" size="xs" icon={X} onClick={() => onChange([])}>Clear</Button>
          )}
        >
          {label}
        </MenuLabel>
        {options.length === 0 && <MenuItem label={`No ${label.toLowerCase()} yet`} />}
        {options.map(opt => (
          <MenuItem
            key={opt.value}
            label={opt.label}
            hint={opt.hint}
            selected={selected.includes(opt.value)}
            onClick={() => onChange(
              selected.includes(opt.value)
                ? selected.filter(v => v !== opt.value)
                : [...selected, opt.value],
            )}
          />
        ))}
      </Menu>
    </div>
  );
}

function NewMenu({ onCreate }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="solid" accent="teal" icon={Plus} iconRight={ChevronDown} onClick={() => setOpen(o => !o)}>
        New
      </Button>
      <Menu open={open} onClose={() => setOpen(false)} align="right" width="w-56">
        <MenuLabel>Create</MenuLabel>
        <MenuItem
          icon={CheckSquare}
          label="New Task"
          hint="Your own decomposable work"
          accent="teal"
          onClick={() => { setOpen(false); onCreate('task'); }}
        />
        <MenuItem
          icon={Inbox}
          label="New Ticket"
          hint="An inbound request from a person"
          accent="rose"
          onClick={() => { setOpen(false); onCreate('ticket'); }}
        />
      </Menu>
    </div>
  );
}

/* ==================================================================== *
 * The row
 * ==================================================================== */

function WorkRow({ item, data, meId, now, onOpen }) {
  const { t, a } = useTheme();
  const meta = KIND_META[item.kind];
  const due = relativeDay(item.due, now);
  const assignee = personName(data, item.assigneeId);
  const decidable = item.kind === 'approval' && isDecidable(item.record, meId);

  return (
    <ListRow
      accent={meta.accent}
      icon={meta.icon}
      title={item.title}
      subtitle={item.subtitle}
      alert={item.overdue}
      onClick={onOpen}
      meta={
        <>
          {item.overdue && (
            <span className={cx('inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap', a('red').fg)}
              title="Past its target">
              <AlertTriangle size={ICON.sm} />
              {due || 'Overdue'}
            </span>
          )}
          {!item.overdue && due && (
            <span className={cx('text-xs whitespace-nowrap', item.atRisk ? a('amber').fg : t.textMuted)}>
              {item.atRisk && <Timer size={ICON.xs} className="inline mr-1 -mt-0.5" />}
              {due}
            </span>
          )}
          <StatusBadge info={item.statusInfo} />
          {item.kind !== 'approval' && item.kind !== 'learning' && (
            <PriorityFlag priority={item.priority} withLabel={false} />
          )}
          {assignee ? <Avatar name={assignee} size="sm" /> : <Chip accent="gray">Unassigned</Chip>}
        </>
      }
      actions={decidable ? (
        <>
          <IconButton
            icon={Check}
            label="Approve"
            accent="emerald"
            onClick={(e) => {
              e.stopPropagation();
              patchIn('approvals', item.id, decide(item.record, { approverId: meId, verdict: 'approved', comment: 'Approved from the workspace.', now: now.toISOString() }));
            }}
          />
          <IconButton
            icon={X}
            label="Reject"
            accent="red"
            onClick={(e) => {
              e.stopPropagation();
              patchIn('approvals', item.id, decide(item.record, { approverId: meId, verdict: 'rejected', comment: 'Rejected from the workspace.', now: now.toISOString() }));
            }}
          />
        </>
      ) : null}
    >
      {(item.labels || []).length > 0 && (
        <span className="mt-1 flex">
          <ChipGroup items={item.labels} accent={meta.accent} icon={Tag} max={2} />
        </span>
      )}
    </ListRow>
  );
}

/* ==================================================================== *
 * Shared modal parts
 * ==================================================================== */

/** The condensed single-line strip that labels the record type. */
function MiniHeader({ kind, keyLabel, children }) {
  const { t } = useTheme();
  return (
    <div className={cx('flex items-center gap-2 flex-wrap px-5 py-2 border-b', t.border, t.bgSubtle)}>
      <EntityTag kind={kind} />
      <span className={cx('text-xs font-mono font-semibold', t.textSecondary)}>{keyLabel}</span>
      <Divider vertical className="h-4" />
      {children}
    </div>
  );
}

function Fact({ icon: Icon, label, children, accent }) {
  const { t, a } = useTheme();
  const c = accent ? a(accent) : null;
  return (
    <div className="min-w-0">
      <p className={cx('text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1', t.textMuted)}>
        {Icon && <Icon size={ICON.xs} />}
        {label}
      </p>
      <div className={cx('text-sm truncate', c ? c.fg : t.text)}>{children}</div>
    </div>
  );
}

/**
 * The requester row. One component, two profiles: an internal employee resolves
 * against the corporate directory (department, manager, location); an external
 * contact resolves against the account (organization, plan, seats, CSM, VIP).
 * An external deployment has no directory, so this is not one shape with holes
 * in it — they are genuinely different records.
 */
function PartyRow({ requester, ticket, now }) {
  const { t, a } = useTheme();
  const [open, setOpen] = useState(false);
  const hue = requester.external ? 'green' : 'blue';
  const c = a(hue);

  return (
    <div className={cx('px-5 py-3 border-b', t.border)}>
      <div className="flex items-center gap-3">
        <Avatar name={requester.name} size="xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={cx('font-medium truncate', t.text)}>{requester.name}</p>
            <Chip accent={hue} icon={requester.external ? Building2 : User}>
              {requester.external ? 'Customer' : 'Employee'}
            </Chip>
            {requester.vip && <Chip accent="amber" icon={Crown}>VIP</Chip>}
          </div>
          <p className={cx('text-xs truncate', t.textMuted)}>
            {joinDots([
              requester.title,
              requester.external ? requester.org?.name : requester.department,
              requester.email,
            ])}
          </p>
        </div>
        <Button
          variant="ghost"
          size="xs"
          iconRight={open ? ChevronUp : ChevronDown}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex-shrink-0"
        >
          Details
        </Button>
      </div>

      {open && (
        <div className={cx('mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl border', c.soft, c.border)}>
          {requester.external ? (
            <>
              <Fact icon={Building2} label="Organization">{requester.org?.name || 'No account'}</Fact>
              <Fact icon={Star} label="Plan">{requester.org?.plan || 'None'}</Fact>
              <Fact icon={Users} label="Seats">{requester.org?.seats != null ? String(requester.org.seats) : 'Unknown'}</Fact>
              <Fact icon={ShieldCheck} label="Customer success">{requester.csm?.name || 'Unassigned'}</Fact>
              <Fact icon={Crown} label="VIP">{requester.vip ? 'Yes — escalate on arrival' : 'No'}</Fact>
              <Fact icon={Clock} label="Timezone">{requester.timezone || 'Unknown'}</Fact>
              <Fact icon={Phone} label="Phone">{requester.phone || 'Not on file'}</Fact>
              <Fact icon={Mail} label="Customer since">
                {requester.org?.since ? relativeDay(requester.org.since, now) || requester.org.since : 'Unknown'}
              </Fact>
            </>
          ) : (
            <>
              <Fact icon={Briefcase} label="Department">{requester.department || 'Unassigned'}</Fact>
              <Fact icon={User} label="Manager">{requester.manager?.name || 'No manager on file'}</Fact>
              <Fact icon={MapPin} label="Location">{requester.location || 'Unknown'}</Fact>
              <Fact icon={Mail} label="Email">{requester.email || 'Not on file'}</Fact>
            </>
          )}
        </div>
      )}
      {requester.external && requester.org?.healthScore === 'at_risk' && (
        <div className="mt-3">
          <Banner accent="amber" icon={AlertTriangle}>
            <strong className={t.text}>{requester.org.name}</strong> is flagged at risk in the account health review.
            Anything on this ticket that reads as a brush-off will be read that way.
          </Banner>
        </div>
      )}
    </div>
  );
}

/** The chip-based tabbed info bar. Chips carry VALUES, never counts. */
function MetaTabs({ ticket, data, requester, sla, now }) {
  const { t } = useTheme();
  const [tab, setTab] = useState('properties');
  const queue = (data.queues || []).find(q => q.id === ticket.queueId) || null;
  const subform = (data.subforms || []).find(s => s.id === ticket.subformId) || null;
  const source = SOURCE_META[ticket.source] || { label: ticket.source || 'Unknown', icon: MonitorSmartphone };
  const ccNames = (ticket.cc || []).map(id => personName(data, id)).filter(Boolean);
  const assignee = personName(data, ticket.assigneeId);

  return (
    <div className={cx('px-5 py-2.5 border-b', t.border)}>
      <SubTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'properties', label: 'Properties', icon: Hash, accent: 'rose' },
          { value: 'people', label: 'People', icon: Users, accent: 'blue' },
          { value: 'intake', label: 'Intake', icon: Globe, accent: 'purple' },
        ]}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tab === 'properties' && (
          <>
            <Chip accent="gray" icon={Inbox}>{queue?.name || 'General'}</Chip>
            <Chip accent={statusMeta(ticket.status).hue}>{statusMeta(ticket.status).label}</Chip>
            <Chip accent={priorityMeta(ticket.priority).hue}>{priorityMeta(ticket.priority).label} priority</Chip>
            {sla && <Chip accent={SLA_STATE[slaOverall(sla)].hue} icon={Timer}>{sla.policy.name}</Chip>}
            {(ticket.labels || []).length > 0
              ? <ChipGroup items={ticket.labels} accent="rose" icon={Tag} max={4} />
              : <span className={cx('text-xs', t.textMuted)}>No labels</span>}
          </>
        )}
        {tab === 'people' && (
          <>
            <Chip accent="rose" icon={User}>{assignee || 'Unassigned'}</Chip>
            <Chip accent={requester.external ? 'green' : 'blue'} icon={requester.external ? Building2 : User}>
              {requester.name}
            </Chip>
            {requester.external && requester.csm && <Chip accent="slate" icon={ShieldCheck}>{requester.csm.name}</Chip>}
            {!requester.external && requester.manager && <Chip accent="slate" icon={User}>{requester.manager.name}</Chip>}
            <span className={cx('text-xs', t.textMuted)}>CC</span>
            <ChipGroup
              items={ccNames}
              accent="purple"
              icon={Mail}
              max={3}
              empty={<span className={cx('text-xs', t.textMuted)}>Nobody</span>}
            />
          </>
        )}
        {tab === 'intake' && (
          <>
            <Chip accent="purple" icon={source.icon}>{source.label}</Chip>
            <Chip accent="purple" icon={ListChecks}>{subform?.name || 'No request form'}</Chip>
            <Chip accent="gray" icon={Clock}>Opened {fmtStamp(ticket.createdAt, now)}</Chip>
            <Chip accent={ticket.firstResponseAt ? 'emerald' : 'amber'} icon={MessageSquare}>
              {ticket.firstResponseAt ? `First reply ${fmtStamp(ticket.firstResponseAt, now)}` : 'No first reply yet'}
            </Chip>
            <Chip accent="gray" icon={Clock}>Updated {fmtStamp(ticket.updatedAt, now)}</Chip>
          </>
        )}
      </div>
    </div>
  );
}

function SlaRow({ title, hours, clock, now }) {
  const { t, a } = useTheme();
  const meta = SLA_STATE[clock.state] || SLA_STATE.ok;
  const c = a(meta.hue);
  let detail;
  if (clock.unmeasured) detail = 'Closed without a measurement';
  else if (clock.met) {
    detail = clock.deltaMs >= 0
      ? `Met with ${fmtDur(clock.deltaMs)} to spare`
      : `Missed by ${fmtDur(clock.deltaMs)}`;
  } else if (clock.state === 'breached') detail = `Breached ${fmtDur(clock.deltaMs)} ago`;
  else if (clock.state === 'paused') detail = 'Clock paused — waiting on someone else';
  else detail = `${fmtDur(clock.deltaMs)} left`;

  return (
    <div className={cx('flex items-center gap-3 px-4 py-2.5')}>
      <span className={cx('w-1 self-stretch min-h-8 rounded-full flex-shrink-0', c.rail)} />
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm font-medium', t.text)}>{title}</p>
        <p className={cx('text-xs truncate', t.textMuted)}>
          {joinDots([
            Number.isFinite(Number(hours)) ? `${hours}h target` : null,
            clock.dueAt ? `due ${fmtStamp(clock.dueAt, now)}` : null,
          ])}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <Chip accent={meta.hue} icon={clock.state === 'paused' ? Pause : Timer}>{meta.label}</Chip>
        <p className={cx('text-[11px] mt-0.5', c.fg)}>{detail}</p>
      </div>
    </div>
  );
}

function SlaPanel({ sla, status, now }) {
  const { t } = useTheme();
  if (!sla) {
    return (
      <Banner accent="amber" icon={AlertCircle} title="No SLA policy resolved">
        This ticket matched no plan policy and no internal policy, so nothing is timing it. That is a configuration gap,
        not a ticket without a deadline.
      </Banner>
    );
  }
  return (
    <Panel
      icon={Timer}
      accent={SLA_STATE[slaOverall(sla)].hue}
      title={sla.policy.name}
      subtitle={joinDots([slaBasisNote(sla), sla.policy.clock === 'calendar' ? '24×7 calendar clock' : 'business-hours clock'])}
    >
      <div className={cx('divide-y', t.borderLight)}>
        <SlaRow title="First response" hours={sla.target.first} clock={sla.first} now={now} />
        <SlaRow title="Resolution" hours={sla.target.resolve} clock={sla.resolution} now={now} />
      </div>
      {sla.breached && (
        <div className="p-3">
          <Banner accent="red" icon={AlertTriangle} title="Target breached">
            The breach stays on the record. Resetting the clock hides the miss from the account's monthly report, which is
            exactly the number a customer checks first.
          </Banner>
        </div>
      )}
      {sla.paused && (
        <div className="p-3">
          <Banner accent="slate" icon={Pause} title="Clock paused, not stopped">
            The ticket is <strong className={t.text}>{statusMeta(status).label}</strong> — time spent waiting on somebody
            outside the desk does not count against the target. It resumes the moment the status moves back.
          </Banner>
        </div>
      )}
    </Panel>
  );
}

function LinkedItems({ links, data, onOpenTicket }) {
  if (!links || !links.length) return null;

  const resolve = (link) => {
    if (link.type === 'problem') return (data.problems || []).find(p => p.id === link.id);
    if (link.type === 'change') return (data.changes || []).find(c => c.id === link.id);
    if (link.type === 'ticket') return (data.tickets || []).find(x => x.id === link.id);
    if (link.type === 'approval') return (data.approvals || []).find(x => x.id === link.id);
    if (link.type === 'task') return (data.tasks || []).find(x => x.id === link.id);
    return null;
  };

  return (
    <Section title="Linked items" hint="Typed links, so the relationship is visible rather than implied by a mention in a comment.">
      <div className={DENSITY.rowGap}>
        {links.map((link, i) => {
          const meta = LINK_META[link.type] || LINK_META.ticket;
          const record = resolve(link);
          const label = record?.title || record?.subject || link.id;
          const keyLabel = record?.key || meta.label;
          return (
            <ListRow
              key={`${link.type}-${link.id}-${i}`}
              accent={meta.accent}
              icon={meta.icon}
              title={label}
              subtitle={joinDots([meta.label, keyLabel, record?.status ? statusMeta(record.status).label : null])}
              onClick={() => {
                if (link.type === 'ticket') { onOpenTicket(link.id); return; }
                if (link.type === 'task') { navigate('workspace', 'task', link.id); return; }
                navigate(meta.section, link.type === 'approval' ? 'request' : 'detail', link.id);
              }}
              meta={record?.status ? <StatusPill status={record.status} /> : <Chip accent={meta.accent}>{meta.label}</Chip>}
            />
          );
        })}
      </div>
    </Section>
  );
}

function CommentBubble({ comment, data, now }) {
  const { t, a } = useTheme();
  const author = findPerson(data, comment.authorId);
  const internal = !!comment.internal;
  const c = a(internal ? 'amber' : 'gray');
  return (
    <div className={cx('rounded-xl border p-3', internal ? cx(c.soft, c.border) : cx(t.bgCard, t.borderLight))}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <Avatar name={author?.name || 'Unknown'} size="md" />
        <span className={cx('text-sm font-medium', t.text)}>{author?.name || 'Unknown author'}</span>
        {author?.external && <Chip accent="green" icon={Building2}>Customer</Chip>}
        {internal
          ? <Chip accent="amber" icon={Lock}>Internal note</Chip>
          : <Chip accent="emerald" icon={Globe}>Public reply</Chip>}
        <span className={cx('text-xs ml-auto', t.textMuted)}>{fmtStamp(comment.at, now)}</span>
      </div>
      <p className={cx('text-sm leading-relaxed whitespace-pre-wrap', internal ? t.textSecondary : t.text)}>
        {comment.body}
      </p>
    </div>
  );
}

function Composer({ onSend, accent = 'rose' }) {
  const { t } = useTheme();
  const [body, setBody] = useState('');
  const [internal, setInternal] = useState(false);
  return (
    <Card className={cx(DENSITY.cardPad, 'space-y-2')}>
      <TileGroup
        value={internal ? 'internal' : 'public'}
        onChange={(v) => setInternal(v === 'internal')}
        columns={2}
        options={[
          { value: 'public', label: 'Public reply', hint: 'The requester sees this', icon: Globe, accent: 'emerald' },
          { value: 'internal', label: 'Internal note', hint: 'Staff only', icon: Lock, accent: 'amber' },
        ]}
      />
      <Textarea
        rows={3}
        accent={internal ? 'amber' : accent}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={internal ? 'What should the next agent know?' : 'Write a reply the requester will read…'}
      />
      <div className="flex items-center justify-between gap-2">
        <p className={cx('text-xs', t.textMuted)}>
          {internal
            ? 'Internal notes never leave RelayHQ. They still appear in an export, so write them like someone will read them.'
            : 'This goes to the requester and stops the first-response clock.'}
        </p>
        <Button
          variant="solid"
          accent={internal ? 'amber' : accent}
          icon={Send}
          disabled={!body.trim()}
          onClick={() => { onSend(body.trim(), internal); setBody(''); }}
        >
          {internal ? 'Add note' : 'Send reply'}
        </Button>
      </div>
    </Card>
  );
}

/** A dropdown whose options are a compact tile grid rather than a native select. */
function TilePicker({ label, icon, value, options, onChange, columns = 3, accent = 'purple', width = 'w-72' }) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <div className="relative">
      <FilterPill
        icon={icon}
        label={current?.label || label}
        active={!!current}
        open={open}
        onClick={() => setOpen(o => !o)}
      />
      <Menu open={open} onClose={() => setOpen(false)} width={width}>
        <MenuLabel>{label}</MenuLabel>
        <div className="p-2">
          <TileGroup
            value={value}
            onChange={(v) => { onChange(v); setOpen(false); }}
            options={options}
            columns={columns}
            accent={accent}
          />
        </div>
      </Menu>
    </div>
  );
}

function PeoplePicker({ label, people, value, onChange, allowNone = true }) {
  const [open, setOpen] = useState(false);
  const current = people.find(p => p.id === value);
  return (
    <div className="relative">
      <FilterPill
        icon={User}
        label={current?.name || 'Unassigned'}
        active={!!current}
        open={open}
        onClick={() => setOpen(o => !o)}
      />
      <Menu open={open} onClose={() => setOpen(false)} width="w-64">
        <MenuLabel>{label}</MenuLabel>
        {allowNone && (
          <MenuItem label="Unassigned" hint="Stays in the queue" selected={!value} onClick={() => { onChange(null); setOpen(false); }} />
        )}
        {people.map(p => (
          <MenuItem
            key={p.id}
            label={p.name}
            hint={joinDots([p.title, p.department])}
            selected={value === p.id}
            onClick={() => { onChange(p.id); setOpen(false); }}
          />
        ))}
      </Menu>
    </div>
  );
}

/* ==================================================================== *
 * Ticket detail
 * ==================================================================== */

function TicketModal({ ticket, data, meId, now, onClose }) {
  const { t } = useTheme();
  const requester = resolveRequester(data, ticket);
  const sla = slaFor(ticket, data.slaPolicies, data.organizations, now);
  const queue = (data.queues || []).find(q => q.id === ticket.queueId) || null;
  const source = SOURCE_META[ticket.source] || { label: ticket.source || 'Unknown', icon: MonitorSmartphone };
  const comments = [...(ticket.comments || [])].sort(
    (a, b) => (parseDate(a.at)?.getTime() || 0) - (parseDate(b.at)?.getTime() || 0),
  );

  const patch = (fields) => patchIn('tickets', ticket.id, { ...fields, updatedAt: now.toISOString() });

  const addComment = (body, internal) => {
    const at = now.toISOString();
    patchIn('tickets', ticket.id, (current) => ({
      comments: [...(current.comments || []), { id: uid('cmt'), authorId: meId, body, internal, at }],
      firstResponseAt: current.firstResponseAt || (internal ? current.firstResponseAt : at),
      updatedAt: at,
    }));
  };

  const createLinkedTask = () => {
    const id = uid('tsk');
    addTo('tasks', {
      id,
      projectId: null,
      parentId: null,
      title: `Follow-up for ${ticket.key || ticket.id}: ${ticket.title}`,
      description: `> Raised from ${ticket.key || ticket.id}\n\n[ ] Reproduce the reported behaviour\n[ ] Agree the fix with the requester`,
      status: 'todo',
      priority: ticket.priority,
      assigneeId: meId,
      createdById: meId,
      watcherIds: [],
      tags: ['from-ticket'],
      startDate: null,
      dueDate: null,
      completedAt: null,
      checklists: [],
      dependencies: [],
      links: [{ type: 'ticket', id: ticket.id }],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    patchIn('tickets', ticket.id, (current) => ({
      links: [...(current.links || []), { type: 'task', id }],
      updatedAt: now.toISOString(),
    }));
    navigate('workspace', 'task', id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      accent="rose"
      size="modalXl"
      icon={Inbox}
      title={ticket.title}
      subtitle={joinDots([ticket.key, queue?.name || 'General queue', `opened ${fmtStamp(ticket.createdAt, now)}`])}
      bodyClassName="p-0"
      footer={
        <>
          <div className="flex items-center gap-2 min-w-0">
            {sla && (
              <Chip accent={SLA_STATE[slaOverall(sla)].hue} icon={Timer}>
                {SLA_STATE[slaOverall(sla)].label}
              </Chip>
            )}
            <span className={cx('text-xs truncate', t.textMuted)}>Updated {fmtStamp(ticket.updatedAt, now)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {!DONE_GROUPS.includes(statusMeta(ticket.status).group) && (
              <Button variant="solid" accent="emerald" icon={Check} onClick={() => patch({ status: 'resolved' })}>
                Resolve ticket
              </Button>
            )}
          </div>
        </>
      }
    >
      <MiniHeader kind="ticket" keyLabel={ticket.key || ticket.id}>
        <StatusPill status={ticket.status} />
        <PriorityFlag priority={ticket.priority} />
        <Chip accent="gray" icon={source.icon}>{source.label}</Chip>
        <Chip accent="gray" icon={Inbox}>{queue?.name || 'General'}</Chip>
        <span className="ml-auto flex items-center gap-1.5">
          <span className={cx('text-xs', t.textMuted)}>Assigned</span>
          {ticket.assigneeId
            ? <Avatar name={personName(data, ticket.assigneeId) || 'Unknown'} size="md" />
            : <Chip accent="amber">Unassigned</Chip>}
        </span>
      </MiniHeader>

      <PartyRow requester={requester} ticket={ticket} now={now} />

      <MetaTabs ticket={ticket} data={data} requester={requester} sla={sla} now={now} />

      <div className={cx(DENSITY.modalBodyPad, 'space-y-5')}>
        {!ticket.queueId && (
          <Banner accent="amber" icon={AlertCircle} title="This ticket arrived without routing">
            No request form set a queue, so it fell to <strong className={t.text}>General</strong> for triage.
            That fallback is deliberate and it is never silent — configure routing on the request form to change it.
          </Banner>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <TilePicker
            label="Status"
            icon={Target}
            value={ticket.status}
            onChange={(v) => patch({ status: v })}
            columns={3}
            accent="rose"
            options={['open', 'in_progress', 'pending', 'on_hold', 'resolved', 'closed'].map(s => ({
              value: s, label: statusMeta(s).label, accent: statusMeta(s).hue, icon: Target,
            }))}
          />
          <TilePicker
            label="Priority"
            icon={Filter}
            value={ticket.priority}
            onChange={(v) => patch({ priority: v })}
            columns={4}
            accent="rose"
            width="w-80"
            options={Object.keys(PRIORITY).map(p => ({
              value: p, label: PRIORITY[p].label, accent: PRIORITY[p].hue, icon: AlertTriangle,
            }))}
          />
          <TilePicker
            label="Queue"
            icon={Inbox}
            value={ticket.queueId}
            onChange={(v) => patch({ queueId: v })}
            columns={2}
            accent="rose"
            width="w-80"
            options={(data.queues || []).map(q => ({ value: q.id, label: q.name, accent: q.hue || 'gray', icon: Inbox }))}
          />
          <PeoplePicker
            label="Assign to"
            people={data.agents || []}
            value={ticket.assigneeId}
            onChange={(v) => patch({ assigneeId: v })}
          />
        </div>

        <Section title="Description">
          <Card className={cx(DENSITY.cardPad)}>
            <p className={cx('text-sm leading-relaxed whitespace-pre-wrap', t.text)}>
              {ticket.description || 'No description was given.'}
            </p>
          </Card>
        </Section>

        <SlaPanel sla={sla} status={ticket.status} now={now} />

        <LinkedItems links={ticket.links} data={data} onOpenTicket={(id) => navigate('workspace', 'ticket', id)} />

        <Banner accent="rose" icon={CornerDownRight} title="A ticket is not decomposable work">
          Tickets have no subtasks or checklists, deliberately. A ticket is somebody else's request; the work it generates is
          yours, and work belongs on a task where it can carry subtasks, a checklist and its own due date.
          <span className="block mt-2">
            <Button variant="soft" accent="teal" size="sm" icon={Plus} onClick={createLinkedTask}>
              Create a linked task
            </Button>
          </span>
        </Banner>

        <Section title="Conversation" hint={`${comments.length} ${comments.length === 1 ? 'message' : 'messages'} · public replies reach the requester, internal notes never do.`}>
          <div className="space-y-2">
            {comments.length === 0 && (
              <EmptyState icon={MessageSquare} title="No messages yet" hint="The first public reply stops the first-response clock." />
            )}
            {comments.map(comment => (
              <CommentBubble key={comment.id} comment={comment} data={data} now={now} />
            ))}
          </div>
          <div className="mt-3">
            <Composer accent="rose" onSend={addComment} />
          </div>
        </Section>
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * Markup — the rendered form of the slash-command editor's output
 * ==================================================================== */

function parseMarkup(text) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let ordinal = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (/^---+$/.test(line.trim())) { blocks.push({ type: 'divider', key: i }); ordinal = 0; continue; }
    if (line.startsWith('# ')) { blocks.push({ type: 'heading', text: line.slice(2), key: i }); ordinal = 0; continue; }
    if (line.startsWith('> ')) { blocks.push({ type: 'quote', text: line.slice(2), key: i }); ordinal = 0; continue; }
    if (line.startsWith('- ')) { blocks.push({ type: 'bullet', text: line.slice(2), key: i }); ordinal = 0; continue; }
    const todo = line.match(/^\[( |x|X)\]\s?(.*)$/);
    if (todo) { blocks.push({ type: 'todo', done: todo[1].toLowerCase() === 'x', text: todo[2], key: i }); ordinal = 0; continue; }
    const numbered = line.match(/^\d+\.\s?(.*)$/);
    if (numbered) { ordinal += 1; blocks.push({ type: 'numbered', text: numbered[1], ordinal, key: i }); continue; }
    ordinal = 0;
    if (!line.trim()) { blocks.push({ type: 'space', key: i }); continue; }
    blocks.push({ type: 'text', text: line, key: i });
  }
  return blocks;
}

function MarkupBlock({ block, accent }) {
  const { t, a } = useTheme();
  const c = a(accent);
  switch (block.type) {
    case 'heading':
      return <p className={cx('text-sm font-semibold mt-2', t.text)}>{block.text}</p>;
    case 'quote':
      return (
        <p className={cx('text-sm italic pl-3 border-l-2 my-1', c.borderStrong, t.textSecondary)}>{block.text}</p>
      );
    case 'bullet':
      return (
        <p className={cx('text-sm flex gap-2', t.text)}>
          <span className={cx('mt-2 w-1 h-1 rounded-full flex-shrink-0', c.dot)} />
          <span>{block.text}</span>
        </p>
      );
    case 'todo':
      return (
        <p className={cx('text-sm flex items-start gap-2', block.done ? t.textMuted : t.text)}>
          <span className={cx('mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
            block.done ? cx(c.solid, 'border-transparent') : cx(t.bgInput, t.borderLight))}>
            {block.done && <Check size={9} className="text-white" />}
          </span>
          <span className={block.done ? 'line-through' : ''}>{block.text}</span>
        </p>
      );
    case 'numbered':
      return (
        <p className={cx('text-sm flex gap-2', t.text)}>
          <span className={cx('tabular-nums font-medium flex-shrink-0', c.fg)}>{block.ordinal}.</span>
          <span>{block.text}</span>
        </p>
      );
    case 'divider':
      return <Divider className="my-2" />;
    case 'space':
      return <span className="block h-2" />;
    default:
      return <p className={cx('text-sm leading-relaxed', t.text)}>{block.text}</p>;
  }
}

function Markup({ text, accent = 'teal' }) {
  const { t } = useTheme();
  const blocks = parseMarkup(text);
  if (!blocks.length || blocks.every(b => b.type === 'space')) {
    return <p className={cx('text-sm', t.textMuted)}>Nothing written yet.</p>;
  }
  return <div className="space-y-0.5">{blocks.map(b => <MarkupBlock key={b.key} block={b} accent={accent} />)}</div>;
}

/**
 * Slash-command editor. Typing "/" at the start of a line opens the block menu;
 * choosing a block replaces the slash with its markup token. Borrowed straight
 * from Notion, because that interaction is already in everybody's fingers.
 */
function SlashEditor({ value, onChange, accent = 'teal', placeholder, rows = 6 }) {
  const { t } = useTheme();
  // The DS Textarea does not expose a ref, and reaching for one would mean
  // adding a primitive. Holding the wrapper and querying it keeps the design
  // system's surface unchanged.
  const wrapRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [caret, setCaret] = useState(0);

  const handleChange = (e) => {
    const next = e.target.value;
    const pos = e.target.selectionStart || 0;
    const grew = next.length === String(value || '').length + 1;
    const typedSlash = grew && next[pos - 1] === '/';
    const atLineStart = pos === 1 || next[pos - 2] === '\n';
    setCaret(pos);
    onChange(next);
    setMenuOpen(!!(typedSlash && atLineStart));
  };

  const insert = (token) => {
    const el = wrapRef.current ? wrapRef.current.querySelector('textarea') : null;
    const text = String(value || '');
    const pos = el ? (el.selectionStart || caret) : caret;
    const before = text.slice(0, Math.max(0, pos - 1));
    const after = text.slice(pos);
    onChange(before + token + after);
    setMenuOpen(false);
    window.requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const next = before.length + token.length;
      el.setSelectionRange(next, next);
    });
  };

  return (
    <div className="relative" ref={wrapRef}>
      <Textarea
        rows={rows}
        accent={accent}
        value={value}
        onChange={handleChange}
        onKeyUp={(e) => setCaret(e.target.selectionStart || 0)}
        onClick={(e) => setCaret(e.target.selectionStart || 0)}
        placeholder={placeholder || 'Type / for headings, bullets, to-dos, quotes and dividers…'}
        className="font-mono text-xs"
      />
      <p className={cx('text-[11px] mt-1', t.textMuted)}>
        Type <span className={cx('font-mono px-1 rounded', t.bgSubtle, t.text)}>/</span> at the start of a line for the block menu.
      </p>
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} width="w-64">
        <MenuLabel>Insert a block</MenuLabel>
        {SLASH_BLOCKS.map(block => (
          <MenuItem
            key={block.id}
            icon={block.icon}
            label={block.label}
            hint={block.hint}
            accent={accent}
            onClick={() => insert(block.token)}
          />
        ))}
      </Menu>
    </div>
  );
}

/* ==================================================================== *
 * Task detail — the shared shell, gated to task-only affordances
 * ==================================================================== */

/**
 * Subtasks. A subtask is not a nested object on the parent — it is a real task
 * with `parentId` set, which is how the Projects module models it. Keeping one
 * model means a subtask can be assigned, given a due date and rolled up in a
 * project report, and it means these two screens never disagree about what is
 * done.
 */
function SubtaskList({ task, project, data, accent, meId, now }) {
  const { t } = useTheme();
  const [draft, setDraft] = useState('');
  const children = (data.tasks || []).filter(x => x.parentId === task.id);
  const info = (child) => statusInfoFor(child.status, project);
  const done = children.filter(c => DONE_GROUPS.includes(info(c).group)).length;

  const doneStatus = (project?.statuses || []).find(s => s.group === 'done')?.id || 'completed';
  const openStatus = (project?.statuses || []).find(s => s.group === 'not_started' || s.group === 'open')?.id || 'todo';

  return (
    <Panel
      icon={CornerDownRight}
      accent={accent}
      title="Subtasks"
      subtitle={children.length
        ? `${done} of ${children.length} done · each one is a real task with its own owner and date`
        : 'Break the work into steps you can finish'}
    >
      <div className={cx('divide-y', t.borderLight)}>
        {children.map(child => {
          const childInfo = info(child);
          const isDone = DONE_GROUPS.includes(childInfo.group);
          return (
            <div key={child.id} className="flex items-center gap-2 px-4 py-2">
              <Checkbox
                accent={accent}
                checked={isDone}
                onChange={(v) => patchIn('tasks', child.id, {
                  status: v ? doneStatus : openStatus,
                  completedAt: v ? now.toISOString() : null,
                  updatedAt: now.toISOString(),
                })}
                label={child.title || 'Untitled step'}
                hint={joinDots([personName(data, child.assigneeId), child.dueDate ? `due ${relativeDay(child.dueDate, now)}` : null])}
              />
              <span className="flex-1" />
              <StatusBadge info={childInfo} />
              <IconButton
                icon={CornerDownRight}
                label="Open subtask"
                accent={accent}
                onClick={() => navigate('workspace', 'task', child.id)}
              />
            </div>
          );
        })}
        <div className="flex items-center gap-2 px-4 py-2">
          <Input
            accent={accent}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a subtask…"
            className="flex-1"
          />
          <Button
            variant="soft"
            accent={accent}
            icon={Plus}
            size="sm"
            disabled={!draft.trim()}
            onClick={() => {
              addTo('tasks', {
                id: uid('tsk'),
                parentId: task.id,
                projectId: task.projectId || null,
                title: draft.trim(),
                description: '',
                status: openStatus,
                priority: task.priority || 'medium',
                assigneeId: task.assigneeId || meId,
                watcherIds: [],
                tags: [],
                startDate: null,
                dueDate: task.dueDate || null,
                completedAt: null,
                checklists: [],
                dependencies: [],
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
              });
              setDraft('');
            }}
          >
            Add
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function Checklist({ task, list, accent, now }) {
  const { t } = useTheme();
  const [draft, setDraft] = useState('');
  const items = list.items || [];
  const done = items.filter(i => i.done).length;

  const write = (nextItems) => patchIn('tasks', task.id, (current) => ({
    checklists: (current.checklists || []).map(l => (l.id === list.id ? { ...l, items: nextItems } : l)),
    updatedAt: now.toISOString(),
  }));

  return (
    <Panel
      icon={ListChecks}
      accent={accent}
      title={list.name || 'Checklist'}
      subtitle={items.length ? `${done} of ${items.length} checked` : 'A repeatable list you tick off every time'}
      action={items.length > 0 && (
        <span className={cx('text-xs tabular-nums font-medium', t.textSecondary)}>
          {Math.round((done / items.length) * 100)}%
        </span>
      )}
    >
      <div className={cx('divide-y', t.borderLight)}>
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 px-4 py-1.5">
            <Checkbox
              accent={accent}
              checked={!!item.done}
              onChange={(v) => write(items.map(i => (i.id === item.id ? { ...i, done: v } : i)))}
              label={item.text || item.title || 'Untitled item'}
            />
            <span className="flex-1" />
            <IconButton
              icon={Trash2}
              label="Remove item"
              accent="red"
              onClick={() => write(items.filter(i => i.id !== item.id))}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 px-4 py-2">
          <Input
            accent={accent}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a checklist item…"
            className="flex-1"
          />
          <Button
            variant="soft"
            accent={accent}
            icon={Plus}
            size="sm"
            disabled={!draft.trim()}
            onClick={() => { write([...items, { id: uid('ci'), text: draft.trim(), done: false }]); setDraft(''); }}
          >
            Add
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function ChecklistSection({ task, accent, now }) {
  const lists = task.checklists || (task.checklist ? [task.checklist] : []);

  if (!lists.length) {
    return (
      <Panel
        icon={ListChecks}
        accent={accent}
        title="Checklists"
        subtitle="A repeatable list you tick off every time this kind of work comes round"
        action={
          <Button
            variant="soft"
            accent={accent}
            size="sm"
            icon={Plus}
            onClick={() => patchIn('tasks', task.id, {
              checklists: [{ id: uid('ck'), name: 'Checklist', items: [] }],
              updatedAt: now.toISOString(),
            })}
          >
            Start one
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {lists.map(list => <Checklist key={list.id} task={task} list={list} accent={accent} now={now} />)}
    </div>
  );
}

function TaskModal({ task, data, meId, now, onClose }) {
  const { t } = useTheme();
  const projectId = task.projectId || task.project || null;
  const project = projectId ? (data.projects || []).find(p => p.id === projectId) : null;
  const kind = projectId ? 'projectTask' : 'task';
  const accent = KIND_META[kind].accent;
  const due = task.dueAt || task.dueDate || task.due || null;
  const assigneeId = task.assigneeId || task.assignee || null;
  const creator = findPerson(data, task.createdById || task.creatorId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.description || '');

  useEffect(() => { setDraft(task.description || ''); }, [task.id, task.description]);

  const patch = (fields) => patchIn('tasks', task.id, { ...fields, updatedAt: now.toISOString() });
  const info = statusInfoFor(task.status || 'todo', project);
  const doneGroup = DONE_GROUPS.includes(info.group);
  const parent = task.parentId ? (data.tasks || []).find(x => x.id === task.parentId) : null;

  /* A project task moves through ITS project's columns, not a generic list.
   * Offering "In Review" to a board that goes Backlog › Discovery › Build would
   * quietly create a status the board cannot show. */
  const statusOptions = (project?.statuses || []).length
    ? project.statuses.map(st => ({ value: st.id, label: st.label || st.id, accent: st.hue || 'gray', icon: Target }))
    : ['todo', 'in_progress', 'blocked', 'review', 'completed', 'cancelled'].map(s => ({
      value: s, label: statusMeta(s).label, accent: statusMeta(s).hue, icon: Target,
    }));
  const completeStatus = (project?.statuses || []).find(st => st.group === 'done')?.id || 'completed';

  return (
    <Modal
      open
      onClose={onClose}
      accent={accent}
      size="modalLg"
      icon={CheckSquare}
      title={task.title || task.name || 'Untitled task'}
      subtitle={joinDots([
        KIND_META[kind].label,
        project ? (project.name || project.title) : 'Personal',
        parent ? `subtask of ${parent.title}` : null,
        due ? `due ${relativeDay(due, now)}` : 'no due date',
      ])}
      bodyClassName="p-0"
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            {joinDots([creator ? `Raised by ${creator.name}` : null, task.updatedAt ? `updated ${fmtStamp(task.updatedAt, now)}` : null]) || 'Personal task'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            {!doneGroup && (
              <Button
                variant="solid"
                accent="emerald"
                icon={Check}
                onClick={() => patch({ status: completeStatus, completedAt: now.toISOString() })}
              >
                Mark complete
              </Button>
            )}
          </div>
        </>
      }
    >
      <MiniHeader kind={kind} keyLabel={task.key || KIND_META[kind].label}>
        <StatusBadge info={info} />
        <PriorityFlag priority={task.priority || 'medium'} />
        {task.milestone && <Chip accent="amber" icon={Target}>Milestone</Chip>}
        {project && <Chip accent="violet" icon={Briefcase}>{project.name || project.title}</Chip>}
        <Chip accent={due && parseDate(due) && parseDate(due).getTime() < now.getTime() && !doneGroup ? 'red' : 'gray'} icon={Clock}>
          {due ? relativeDay(due, now) : 'No due date'}
        </Chip>
        <span className="ml-auto flex items-center gap-1.5">
          <span className={cx('text-xs', t.textMuted)}>Owner</span>
          {assigneeId
            ? <Avatar name={personName(data, assigneeId) || 'Unknown'} size="md" />
            : <Chip accent="amber">Unassigned</Chip>}
        </span>
      </MiniHeader>

      <div className={cx(DENSITY.modalBodyPad, 'space-y-5')}>
        <div className="flex flex-wrap items-center gap-2">
          <TilePicker
            label="Status"
            icon={Target}
            value={task.status || 'todo'}
            onChange={(v) => patch({ status: v })}
            columns={3}
            accent={accent}
            options={statusOptions}
          />
          <TilePicker
            label="Priority"
            icon={Filter}
            value={task.priority || 'medium'}
            onChange={(v) => patch({ priority: v })}
            columns={4}
            accent={accent}
            width="w-80"
            options={Object.keys(PRIORITY).map(p => ({
              value: p, label: PRIORITY[p].label, accent: PRIORITY[p].hue, icon: AlertTriangle,
            }))}
          />
          <PeoplePicker
            label="Owner"
            people={data.agents || []}
            value={assigneeId}
            onChange={(v) => patch({ assigneeId: v })}
          />
        </div>

        <Section
          title="Notes"
          hint="Slash-command markup — the same blocks a knowledge atom uses, so notes that turn out to be useful can be lifted straight into an article."
          action={
            <Button
              variant={editing ? 'solid' : 'soft'}
              accent={accent}
              size="sm"
              icon={editing ? Check : ListChecks}
              onClick={() => {
                if (editing) patch({ description: draft });
                setEditing(e => !e);
              }}
            >
              {editing ? 'Save notes' : 'Edit notes'}
            </Button>
          }
        >
          <Card className={DENSITY.cardPad}>
            {editing
              ? <SlashEditor value={draft} onChange={setDraft} accent={accent} />
              : <Markup text={task.description} accent={accent} />}
          </Card>
        </Section>

        {/* GATED: subtasks and checklists exist on tasks only — never on tickets. */}
        <SubtaskList task={task} project={project} data={data} accent={accent} meId={meId} now={now} />
        <ChecklistSection task={task} accent={accent} now={now} />

        <LinkedItems links={task.links} data={data} onOpenTicket={(id) => navigate('workspace', 'ticket', id)} />

        <Banner accent={accent} icon={AlertCircle} title="Why this screen has no SLA">
          An SLA is a promise made to a requester. A task is work you assigned yourself, so there is nobody to promise —
          it has a due date instead. Tickets carry the clock; tasks carry the checklist.
        </Banner>
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * Creation
 * ==================================================================== */

function NewRecordModal({ kind, data, meId, onClose, onCreated }) {
  const { t } = useTheme();
  const isTicket = kind === 'ticket';
  const accent = isTicket ? 'rose' : 'teal';
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('medium');
  const [queueId, setQueueId] = useState(null);
  const [dueAt, setDueAt] = useState('');
  const generalQueue = (data.queues || []).find(q => q.isDefault) || null;

  const create = () => {
    const at = NOW.toISOString();
    if (isTicket) {
      const id = uid('tkt');
      addTo('tickets', {
        id,
        key: `TKT-${String(Math.floor(Math.random() * 9000) + 1000)}`,
        title: title.trim(),
        description: body.trim(),
        status: 'open',
        priority,
        queueId: queueId || generalQueue?.id || null,
        assigneeId: null,
        isExternal: false,
        requesterId: meId,
        orgId: null,
        source: 'portal',
        subformId: null,
        catalogItemId: null,
        labels: [],
        cc: [],
        comments: [],
        links: [],
        slaPolicyId: null,
        firstResponseAt: null,
        createdAt: at,
        updatedAt: at,
      });
      onCreated('ticket', id);
      return;
    }
    const id = uid('tsk');
    addTo('tasks', {
      id,
      projectId: null,
      parentId: null,
      title: title.trim(),
      description: body,
      status: 'todo',
      priority,
      assigneeId: meId,
      createdById: meId,
      watcherIds: [],
      tags: [],
      startDate: null,
      dueDate: dueAt || null,
      completedAt: null,
      checklists: [],
      dependencies: [],
      links: [],
      createdAt: at,
      updatedAt: at,
    });
    onCreated('task', id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      accent={accent}
      size="modalMd"
      icon={isTicket ? Inbox : CheckSquare}
      title={isTicket ? 'New ticket' : 'New task'}
      subtitle={isTicket
        ? 'An inbound request from a person — it gets a queue, an SLA and a conversation'
        : 'Your own work — it gets subtasks, a checklist and a due date'}
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            {isTicket ? 'Raised as an internal request in your name' : 'Assigned to you'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent={accent} icon={Plus} disabled={!title.trim()} onClick={create}>
              Create {isTicket ? 'ticket' : 'task'}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title" required>
          <Input accent={accent} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            placeholder={isTicket ? 'What does the requester need?' : 'What are you going to do?'} />
        </Field>

        <Field label="Priority">
          <TileGroup
            value={priority}
            onChange={setPriority}
            columns={4}
            accent={accent}
            options={Object.keys(PRIORITY).map(p => ({
              value: p, label: PRIORITY[p].label, accent: PRIORITY[p].hue, icon: AlertTriangle,
            }))}
          />
        </Field>

        {isTicket ? (
          <>
            <Field label="Queue" hint="Pick a destination, or leave it and see what happens below.">
              <TileGroup
                value={queueId}
                onChange={setQueueId}
                columns={3}
                accent={accent}
                options={(data.queues || []).map(q => ({ value: q.id, label: q.name, accent: q.hue || 'gray', icon: Inbox }))}
              />
            </Field>
            {!queueId && (
              <Banner accent="amber" icon={AlertCircle} title="No queue chosen">
                This ticket will land in <strong className={t.text}>{generalQueue?.name || 'General'}</strong> and be triaged
                within one business hour. Saying so here is the point — a silent default is how tickets get lost.
              </Banner>
            )}
            <Field label="Description">
              <Textarea accent={accent} rows={4} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="What is happening, and what have you already tried?" />
            </Field>
          </>
        ) : (
          <>
            <Field label="Due date" hint="Tasks have a due date, not an SLA — nobody outside has been promised anything.">
              <Input accent={accent} type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </Field>
            <Field label="Notes" hint="Type / at the start of a line for headings, bullets, to-dos, quotes and dividers.">
              <SlashEditor value={body} onChange={setBody} accent={accent} rows={6} />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
