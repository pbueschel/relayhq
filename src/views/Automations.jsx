import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Workflow, Plus, Play, Trash2, Copy, Power, ArrowLeft, ZoomIn, ZoomOut, Maximize2,
  Crosshair, Inbox, RefreshCw, Stamp, CalendarClock, GraduationCap, Clock, Webhook,
  MousePointerClick, GitBranch, Shuffle, Merge, Filter, Timer, Repeat, Flag, Tag, Bell,
  CheckSquare, Monitor, MessageSquare, Globe, Braces, Code, CircleSlash, StickyNote,
  X, AlertCircle, Check, ChevronDown, ChevronUp, History, Zap, Layers, Circle, Split,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, statusMeta, priorityMeta,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, Avatar,
  EmptyState, Card, Section, GroupLabel, ListRow, Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, Toggle, TileGroup, SearchInput,
  Modal, ConfirmDelete, Menu, MenuItem, MenuDivider, MenuLabel,
  SubTabs, PageBody,
  ModuleHeader, ScopedSearch, FilterToggle, FilterTray, subsetLabel, optionCounts, passes,
} from '@/ds';
import { useStore, patchIn, addTo, removeFrom, uid, NOW } from '@/store/store.js';
import { Q, USR } from '@/store/seed/ids.js';
import { navigate } from '@/lib/router.js';
import {
  FIELDS, FIELD_BY_ID, OPERATORS, ALL_OPERATORS, operatorsFor, fieldLabel,
  isNullary, evaluate, summarize, readPath, defaultRowFor, emptyGroup, countRows,
} from '@/lib/conditions.js';

/**
 * AUTOMATIONS — the workflow canvas.
 *
 * Borrowed wholesale from n8n, because n8n has already solved this interaction
 * and a half-invented canvas would only be worse: left-to-right flow on a
 * dotted grid, a node card with an input endpoint on the left and named output
 * endpoints on the right, a searchable node panel grouped by category, a config
 * panel pinned to the right of the selected node, and an execution log along
 * the bottom that replays the run node by node.
 *
 * No graph library. Nodes are absolutely-positioned divs inside a transformed
 * layer; connections are SVG cubic beziers drawn in a layer behind them; pan,
 * node drag and connection drag all run off pointer events with pointer capture
 * on the canvas root.
 *
 * The node taxonomy is RelayHQ's own domain — triggers fire on tickets,
 * approvals, assets and course completions; actions assign queues, start
 * approvals, create tasks and enrol people in courses. That is the point: one
 * automation spans internal service management, external customer service and
 * training, because they are one substrate.
 */

/* ==================================================================== *
 * Geometry
 * ==================================================================== */

const NODE_W = 216;
const NODE_H = 62;
const PORT_STEP = 22;
const SNAP = 10;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.6;

const EMPTY = [];

/* ==================================================================== *
 * Node taxonomy
 *
 * Category drives the coloured left edge; hue drives the icon tile and is the
 * ENTITY hue of whatever the node acts on, so an "Enrol in course" node is
 * indigo everywhere a course is indigo.
 * ==================================================================== */

const CATEGORIES = {
  trigger: { label: 'Trigger', hue: 'amber', blurb: 'What starts the workflow' },
  logic: { label: 'Logic', hue: 'violet', blurb: 'Branch, filter, wait, loop' },
  action: { label: 'RelayHQ actions', hue: 'sky', blurb: 'Change a record or tell someone' },
  utility: { label: 'Utility', hue: 'slate', blurb: 'Shape data, annotate the canvas' },
};

const CATEGORY_ORDER = ['trigger', 'logic', 'action', 'utility'];

const MAIN_OUT = [{ id: 'main', label: '' }];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null) out[k] = obj[k];
  return out;
}

/**
 * v1's chip rule applied to node subtitles: show the VALUES, with an overflow
 * marker, never a bare count. "Urgent, High +1" is readable at a glance;
 * "3 cases" makes the reader open the node to learn anything.
 */
function listValues(values, empty, max = 3) {
  const list = (values || []).map(v => String(v ?? '').trim()).filter(Boolean);
  if (!list.length) return empty;
  const shown = list.slice(0, max).join(', ');
  return list.length > max ? `${shown} +${list.length - max}` : shown;
}

const NODE_TYPES = {
  /* ---------------- triggers ---------------- */
  'trigger.ticketCreated': {
    label: 'Ticket Created', category: 'trigger', icon: Inbox, hue: 'rose',
    blurb: 'A ticket or request is created in a queue or through a form',
    outputs: () => MAIN_OUT,
    describe: (n, L) => n.config?.subformId
      ? `Form: ${L.subform(n.config.subformId)}`
      : `${L.queue(n.config?.queueId)} · ${(n.config?.sources || []).join(', ') || 'any channel'}`,
    fields: [
      { key: 'queueId', label: 'Queue', type: 'ref', from: 'queues', hint: 'Leave empty to fire on every queue.' },
      { key: 'subformId', label: 'Submitted form', type: 'ref', from: 'subforms' },
      { key: 'sources', label: 'Channels', type: 'multi', options: ['portal', 'email', 'chat', 'phone', 'api'] },
      { key: 'audience', label: 'Audience', type: 'select', options: ['internal', 'external', 'both'] },
    ],
    output: (n, ctx) => pick(ctx, ['ticket', 'requester', 'org', 'answers', 'hire']),
  },
  'trigger.ticketUpdated': {
    label: 'Ticket Updated', category: 'trigger', icon: RefreshCw, hue: 'rose',
    blurb: 'A watched field on a ticket changes value',
    outputs: () => MAIN_OUT,
    describe: (n) => `When ${fieldLabel(n.config?.field || 'ticket.status')} becomes ${statusMeta(n.config?.to).label}`,
    fields: [
      { key: 'field', label: 'Watched field', type: 'select', options: ['ticket.status', 'ticket.priority', 'ticket.queueId'] },
      { key: 'to', label: 'New value', type: 'select', options: ['open', 'in_progress', 'pending', 'resolved', 'closed'] },
      { key: 'queueId', label: 'Limit to queue', type: 'ref', from: 'queues' },
    ],
    output: (n, ctx) => pick(ctx, ['ticket', 'requester', 'org']),
  },
  'trigger.approvalDecided': {
    label: 'Approval Decided', category: 'trigger', icon: Stamp, hue: 'amber',
    blurb: 'An approval step is approved, rejected or expires',
    outputs: () => MAIN_OUT,
    describe: (n, L) => `${L.policy(n.config?.policyId)} · ${n.config?.decision || 'any decision'}`,
    fields: [
      { key: 'policyId', label: 'Approval policy', type: 'ref', from: 'policies' },
      { key: 'decision', label: 'Decision', type: 'select', options: ['approved', 'rejected', 'expired', 'any'] },
    ],
    output: (n, ctx) => ({ approval: { policyId: n.config?.policyId || null, decision: n.config?.decision || 'approved' }, ...pick(ctx, ['ticket', 'requester']) }),
  },
  'trigger.assetRenewalDue': {
    label: 'Asset Renewal Due', category: 'trigger', icon: CalendarClock, hue: 'cyan',
    blurb: 'A licence, contract or warranty is approaching its renewal date',
    outputs: () => MAIN_OUT,
    describe: (n) => `${n.config?.days ?? 30} days before renewal · ${n.config?.kind || 'any asset'}`,
    fields: [
      { key: 'days', label: 'Days before renewal', type: 'number' },
      { key: 'kind', label: 'Asset kind', type: 'select', options: ['hardware', 'software', 'contract'] },
    ],
    output: (n, ctx) => pick(ctx, ['asset']),
  },
  'trigger.courseCompleted': {
    label: 'Course Completed', category: 'trigger', icon: GraduationCap, hue: 'indigo',
    blurb: 'A learner finishes a course or passes its final check',
    outputs: () => MAIN_OUT,
    describe: (n, L) => `${L.course(n.config?.courseId)} · ${n.config?.result || 'passed'}`,
    fields: [
      { key: 'courseId', label: 'Course', type: 'ref', from: 'courses' },
      { key: 'result', label: 'Result', type: 'select', options: ['passed', 'failed', 'any'] },
    ],
    output: (n, ctx) => ({ enrollment: { courseId: n.config?.courseId || null, result: n.config?.result || 'passed' }, ...pick(ctx, ['requester']) }),
  },
  'trigger.schedule': {
    label: 'Schedule', category: 'trigger', icon: Clock, hue: 'sky',
    blurb: 'Runs on a cron schedule',
    outputs: () => MAIN_OUT,
    describe: (n) => `${describeCron(n.config?.cron)} · ${n.config?.timezone || 'America/Chicago'}`,
    fields: [
      { key: 'cron', label: 'Cron expression', type: 'text', hint: 'minute hour day month weekday — e.g. 0 7 * * 1' },
      { key: 'timezone', label: 'Timezone', type: 'select', options: ['America/Chicago', 'America/New_York', 'UTC'] },
    ],
    output: (n) => ({ schedule: { cron: n.config?.cron || '0 * * * *', firedAt: '2026-08-16T09:00:00' } }),
  },
  'trigger.webhook': {
    label: 'Webhook', category: 'trigger', icon: Webhook, hue: 'green',
    blurb: 'An external system POSTs to a RelayHQ webhook URL',
    outputs: () => MAIN_OUT,
    describe: (n) => `${n.config?.method || 'POST'} ${n.config?.path || '/hooks/untitled'}`,
    fields: [
      { key: 'path', label: 'Path', type: 'text' },
      { key: 'method', label: 'Method', type: 'select', options: ['POST', 'GET', 'PUT'] },
      { key: 'auth', label: 'Authentication', type: 'select', options: ['none', 'header', 'signature'] },
    ],
    output: (n) => ({ webhook: { path: n.config?.path || '/hooks/untitled', method: n.config?.method || 'POST' } }),
  },
  'trigger.manual': {
    label: 'Manual', category: 'trigger', icon: MousePointerClick, hue: 'slate',
    blurb: 'Runs only when someone clicks Test workflow',
    outputs: () => MAIN_OUT,
    describe: () => 'Runs when triggered by hand',
    fields: [],
    output: () => ({ manual: { startedBy: 'Alex Rivera' } }),
  },

  /* ---------------- logic ---------------- */
  'logic.if': {
    label: 'IF', category: 'logic', icon: GitBranch, hue: 'violet',
    blurb: 'Two branches — items that match, and items that do not',
    outputs: () => [{ id: 'true', label: 'true', hue: 'emerald' }, { id: 'false', label: 'false', hue: 'red' }],
    describe: (n) => summarize(n.config?.conditions),
    fields: [{ key: 'conditions', label: 'Conditions', type: 'conditions' }],
    output: (n, ctx) => ({ matched: evaluate(n.config?.conditions, ctx), ...pick(ctx, ['ticket', 'org', 'answers']) }),
  },
  'logic.switch': {
    label: 'Switch', category: 'logic', icon: Shuffle, hue: 'violet',
    blurb: 'One output per named case, plus an optional fallback',
    outputs: (n) => {
      const cases = (n.config?.cases || []).map(c => ({ id: c.id, label: c.label || c.value || 'case' }));
      return n.config?.fallback === false ? cases : [...cases, { id: 'fallback', label: 'fallback', hue: 'slate' }];
    },
    // Values, never a count: "3 cases" tells a reader nothing they can act on.
    describe: (n) => `On ${fieldLabel(n.config?.field || 'ticket.priority')} · ${listValues((n.config?.cases || []).map(c => c.label || c.value), 'no cases yet')}`,
    fields: [
      { key: 'field', label: 'Route on field', type: 'field' },
      { key: 'cases', label: 'Cases', type: 'cases' },
      { key: 'fallback', label: 'Add a fallback output', type: 'toggle', hint: 'Without it, items matching no case stop here.' },
    ],
    output: (n, ctx) => ({ routedOn: n.config?.field || 'ticket.priority', value: String(readPath(ctx, n.config?.field || '') ?? 'unmatched') }),
  },
  'logic.merge': {
    label: 'Merge', category: 'logic', icon: Merge, hue: 'violet',
    blurb: 'Waits for two branches and combines their items',
    inputs: () => [{ id: 'a', label: '1' }, { id: 'b', label: '2' }],
    outputs: () => MAIN_OUT,
    describe: (n) => `Mode: ${n.config?.mode || 'append'}`,
    fields: [{ key: 'mode', label: 'Mode', type: 'select', options: ['append', 'combine', 'wait-for-both'] }],
    output: (n, ctx, items) => ({ merged: items, mode: n.config?.mode || 'append' }),
  },
  'logic.filter': {
    label: 'Filter', category: 'logic', icon: Filter, hue: 'violet',
    blurb: 'Keeps only the items that match — no second branch',
    outputs: () => MAIN_OUT,
    describe: (n) => summarize(n.config?.conditions),
    fields: [{ key: 'conditions', label: 'Keep items where', type: 'conditions' }],
    output: (n, ctx, items) => ({ kept: items, criteria: summarize(n.config?.conditions) }),
  },
  'logic.wait': {
    label: 'Wait', category: 'logic', icon: Timer, hue: 'violet',
    blurb: 'Pauses the branch for a fixed interval',
    outputs: () => MAIN_OUT,
    describe: (n) => `Pause ${n.config?.amount ?? 1} ${n.config?.unit || 'hours'}`,
    fields: [
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'unit', label: 'Unit', type: 'select', options: ['minutes', 'hours', 'days'] },
    ],
    output: (n) => ({ resumeAfter: `${n.config?.amount ?? 1} ${n.config?.unit || 'hours'}` }),
  },
  'logic.loop': {
    label: 'Loop Over Items', category: 'logic', icon: Repeat, hue: 'violet',
    blurb: 'Runs the loop branch once per batch, then continues on done',
    outputs: () => [{ id: 'loop', label: 'loop', hue: 'amber' }, { id: 'done', label: 'done', hue: 'emerald' }],
    describe: (n) => `Batch size ${n.config?.batchSize ?? 1}`,
    fields: [{ key: 'batchSize', label: 'Batch size', type: 'number' }],
    output: (n, ctx, items) => ({ batches: items, batchSize: n.config?.batchSize ?? 1 }),
  },

  /* ---------------- actions ---------------- */
  'action.assignQueue': {
    label: 'Assign Queue', category: 'action', icon: Inbox, hue: 'gray',
    blurb: 'Moves the ticket to a queue, optionally to a named agent',
    outputs: () => MAIN_OUT,
    describe: (n, L) => n.config?.assigneeId ? `${L.queue(n.config?.queueId)} → ${L.person(n.config.assigneeId)}` : L.queue(n.config?.queueId),
    fields: [
      { key: 'queueId', label: 'Queue', type: 'ref', from: 'queues', hint: 'With no queue set, the ticket falls to General.' },
      { key: 'assigneeId', label: 'Assign to', type: 'ref', from: 'people' },
      { key: 'note', label: 'Internal note', type: 'textarea' },
    ],
    output: (n, ctx) => ({ ticket: { key: ctx?.ticket?.key || 'TIC-0000', queueId: n.config?.queueId || Q.GENERAL, assigneeId: n.config?.assigneeId || null } }),
  },
  'action.setPriority': {
    label: 'Set Priority', category: 'action', icon: Flag, hue: 'orange',
    blurb: 'Raises or lowers priority and records why',
    outputs: () => MAIN_OUT,
    describe: (n) => `Priority → ${priorityMeta(n.config?.priority).label}`,
    fields: [
      { key: 'priority', label: 'Priority', type: 'select', options: ['urgent', 'high', 'medium', 'low'] },
      { key: 'reason', label: 'Reason', type: 'text' },
    ],
    output: (n, ctx) => ({ ticket: { key: ctx?.ticket?.key || 'TIC-0000', priority: n.config?.priority || 'medium' } }),
  },
  'action.addLabel': {
    label: 'Add Label', category: 'action', icon: Tag, hue: 'purple',
    blurb: 'Tags the record so later steps and views can find it',
    outputs: () => MAIN_OUT,
    describe: (n) => listValues(n.config?.labels, 'No labels set'),
    fields: [{ key: 'labels', label: 'Labels', type: 'tags' }],
    output: (n, ctx) => ({ ticket: { key: ctx?.ticket?.key || 'TIC-0000', labels: [...(ctx?.ticket?.labels || []), ...(n.config?.labels || [])] } }),
  },
  'action.notify': {
    label: 'Send Notification', category: 'action', icon: Bell, hue: 'sky',
    blurb: 'Slack, email or in-app message',
    outputs: () => MAIN_OUT,
    describe: (n) => `${n.config?.channel || 'email'} → ${n.config?.target || 'nobody set'}`,
    fields: [
      { key: 'channel', label: 'Channel', type: 'select', options: ['slack', 'email', 'in_app', 'sms'] },
      { key: 'target', label: 'To', type: 'text', expr: true },
      { key: 'subject', label: 'Subject', type: 'text', expr: true },
      { key: 'message', label: 'Message', type: 'textarea', expr: true },
    ],
    output: (n) => ({ notification: { channel: n.config?.channel || 'email', to: n.config?.target || '', delivered: true } }),
  },
  'action.startApproval': {
    label: 'Start Approval', category: 'action', icon: Stamp, hue: 'amber',
    blurb: 'Runs an approval policy and optionally blocks until it decides',
    outputs: () => MAIN_OUT,
    describe: (n, L) => `${L.policy(n.config?.policyId)}${n.config?.waitForDecision ? ' · blocking' : ' · fire and forget'}`,
    fields: [
      { key: 'policyId', label: 'Approval policy', type: 'ref', from: 'policies' },
      { key: 'waitForDecision', label: 'Wait for the decision', type: 'toggle', hint: 'Blocking means nothing downstream runs until someone decides.' },
      { key: 'dueDays', label: 'Due in (days)', type: 'number' },
      { key: 'note', label: 'Note for approvers', type: 'textarea', expr: true },
    ],
    output: (n) => ({ approval: { policyId: n.config?.policyId || null, state: n.config?.waitForDecision ? 'approved' : 'awaiting' } }),
  },
  'action.createTask': {
    label: 'Create Task', category: 'action', icon: CheckSquare, hue: 'teal',
    blurb: 'Opens a task in a queue with an owner and a due date',
    outputs: () => MAIN_OUT,
    describe: (n, L) => `${L.queue(n.config?.queueId)}${n.config?.assigneeId ? ' → ' + L.person(n.config.assigneeId) : ''}`,
    fields: [
      { key: 'title', label: 'Title', type: 'text', expr: true },
      { key: 'queueId', label: 'Queue', type: 'ref', from: 'queues' },
      { key: 'assigneeId', label: 'Assign to', type: 'ref', from: 'people' },
      { key: 'dueDays', label: 'Due in (days)', type: 'number' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['urgent', 'high', 'medium', 'low'] },
    ],
    output: (n) => ({ task: { title: renderExpr(n.config?.title) || 'Untitled task', queueId: n.config?.queueId || Q.GENERAL, dueInDays: n.config?.dueDays ?? 7 } }),
  },
  'action.updateAsset': {
    label: 'Update Asset', category: 'action', icon: Monitor, hue: 'cyan',
    blurb: 'Writes a field on a hardware, software or contract record',
    outputs: () => MAIN_OUT,
    describe: (n) => `Set ${n.config?.field || 'status'} = ${n.config?.value || '—'}`,
    fields: [
      { key: 'assetRef', label: 'Asset', type: 'text', expr: true, hint: 'An asset id, or an expression that resolves to one.' },
      { key: 'field', label: 'Field', type: 'select', options: ['status', 'assignedToId', 'locationId', 'renewalDate'] },
      { key: 'value', label: 'Value', type: 'text', expr: true },
    ],
    output: (n) => ({ asset: { field: n.config?.field || 'status', value: renderExpr(n.config?.value) || 'updated' } }),
  },
  'action.enrollCourse': {
    label: 'Enroll In Course', category: 'action', icon: GraduationCap, hue: 'indigo',
    blurb: 'Enrols a person in a course or a whole curriculum',
    outputs: () => MAIN_OUT,
    describe: (n, L) => `${L.course(n.config?.courseId)} · due in ${n.config?.dueDays ?? 14}d`,
    fields: [
      { key: 'courseId', label: 'Course', type: 'ref', from: 'courses' },
      { key: 'curriculumId', label: 'Curriculum', type: 'ref', from: 'curricula' },
      { key: 'dueDays', label: 'Due in (days)', type: 'number' },
      { key: 'notify', label: 'Email the learner', type: 'toggle' },
    ],
    output: (n) => ({ enrollment: { courseId: n.config?.courseId || null, status: 'enrolled', dueInDays: n.config?.dueDays ?? 14 } }),
  },
  'action.postComment': {
    label: 'Post Comment', category: 'action', icon: MessageSquare, hue: 'rose',
    blurb: 'Adds a public reply or an internal note to the record',
    outputs: () => MAIN_OUT,
    describe: (n) => `${n.config?.visibility === 'public' ? 'Public reply' : 'Internal note'}`,
    fields: [
      { key: 'visibility', label: 'Visibility', type: 'select', options: ['internal', 'public'] },
      { key: 'body', label: 'Comment', type: 'textarea', expr: true },
    ],
    output: (n) => ({ comment: { visibility: n.config?.visibility || 'internal', body: renderExpr(n.config?.body) || '' } }),
  },
  'action.http': {
    label: 'HTTP Request', category: 'action', icon: Globe, hue: 'green',
    blurb: 'Calls an external service',
    outputs: () => MAIN_OUT,
    describe: (n) => `${n.config?.method || 'GET'} ${shortUrl(n.config?.url)}`,
    fields: [
      { key: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { key: 'url', label: 'URL', type: 'text', expr: true },
      { key: 'body', label: 'Body', type: 'textarea', expr: true },
    ],
    output: (n) => ({ response: { status: 202, method: n.config?.method || 'GET', url: shortUrl(n.config?.url) } }),
  },

  /* ---------------- utility ---------------- */
  'util.setFields': {
    label: 'Set Fields', category: 'utility', icon: Braces, hue: 'slate',
    blurb: 'Builds or overwrites fields on each item',
    outputs: () => MAIN_OUT,
    describe: (n) => listValues((n.config?.fields || []).map(f => f && f.name), 'no fields set'),
    fields: [
      { key: 'fields', label: 'Fields', type: 'kv' },
      { key: 'keepOnly', label: 'Keep only these fields', type: 'toggle' },
    ],
    output: (n) => {
      const out = {};
      for (const f of n.config?.fields || []) if (f && f.name) out[f.name] = renderExpr(f.value);
      return { set: out };
    },
  },
  'util.code': {
    label: 'Code', category: 'utility', icon: Code, hue: 'slate',
    blurb: 'A snippet that transforms the items',
    outputs: () => MAIN_OUT,
    describe: (n) => `${n.config?.language || 'javascript'} · ${String(n.config?.code || '').split('\n').length} lines`,
    fields: [
      { key: 'language', label: 'Language', type: 'select', options: ['javascript', 'python'] },
      { key: 'code', label: 'Code', type: 'code' },
    ],
    output: (n, ctx, items) => ({ transformed: items, language: n.config?.language || 'javascript' }),
  },
  'util.noop': {
    label: 'No-Op', category: 'utility', icon: CircleSlash, hue: 'gray',
    blurb: 'Ends a branch explicitly, so a dangling output never looks like a mistake',
    outputs: () => MAIN_OUT,
    describe: () => 'Nothing happens here, on purpose',
    fields: [],
    output: () => ({ noop: true }),
  },
  'util.sticky': {
    label: 'Sticky Note', category: 'utility', icon: StickyNote, hue: 'amber',
    blurb: 'A note on the canvas for whoever reads this workflow next',
    outputs: () => [],
    describe: (n) => String(n.config?.text || '').slice(0, 60),
    fields: [
      { key: 'text', label: 'Note', type: 'textarea' },
      { key: 'hue', label: 'Colour', type: 'select', options: ['amber', 'violet', 'indigo', 'rose', 'lime', 'red', 'sky'] },
    ],
    output: () => ({}),
  },
};

const NODE_LIST = Object.entries(NODE_TYPES).map(([type, meta]) => ({ type, ...meta }));

const FALLBACK_META = {
  label: 'Unknown node', category: 'utility', icon: Circle, hue: 'gray',
  blurb: 'This node type is not installed',
  outputs: () => MAIN_OUT, describe: () => 'Unrecognised node type', fields: [], output: () => ({}),
};

function nodeMeta(node) {
  return NODE_TYPES[node?.type] || FALLBACK_META;
}

function categoryOf(node) {
  return nodeMeta(node).category;
}

function outputsOf(node) {
  const meta = nodeMeta(node);
  const outs = meta.outputs ? meta.outputs(node) : MAIN_OUT;
  return Array.isArray(outs) ? outs : MAIN_OUT;
}

function inputsOf(node) {
  const meta = nodeMeta(node);
  if (meta.category === 'trigger' || node?.type === 'util.sticky') return [];
  return meta.inputs ? meta.inputs(node) : [{ id: 'main', label: '' }];
}

function nodeHeight(node) {
  if (node?.type === 'util.sticky') return node.h || 120;
  const ports = Math.max(outputsOf(node).length, inputsOf(node).length);
  return ports > 2 ? NODE_H + (ports - 2) * PORT_STEP : NODE_H;
}

function nodeWidth(node) {
  return node?.type === 'util.sticky' ? (node.w || 260) : NODE_W;
}

function portPoint(node, list, index, side) {
  const h = nodeHeight(node);
  const count = Math.max(list.length, 1);
  const y = node.y + (h * (index + 1)) / (count + 1);
  const x = side === 'in' ? node.x : node.x + nodeWidth(node);
  return { x, y };
}

function outPoint(node, portId) {
  const outs = outputsOf(node);
  const i = Math.max(0, outs.findIndex(o => o.id === portId));
  return portPoint(node, outs, i, 'out');
}

function inPoint(node, portId) {
  const ins = inputsOf(node);
  const i = Math.max(0, ins.findIndex(o => o.id === portId));
  return portPoint(node, ins, i, 'in');
}

function bezier(x1, y1, x2, y2) {
  const dx = Math.max(60, Math.abs(x2 - x1) * 0.55);
  return `M ${round(x1)} ${round(y1)} C ${round(x1 + dx)} ${round(y1)}, ${round(x2 - dx)} ${round(y2)}, ${round(x2)} ${round(y2)}`;
}

function round(n) {
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

/* ==================================================================== *
 * Small formatters
 * ==================================================================== */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function describeCron(cron) {
  const raw = String(cron || '').trim();
  const parts = raw.split(/\s+/);
  if (parts.length !== 5) return raw || 'No schedule set';
  const [min, hour, , , weekday] = parts;
  if (min.startsWith('*/') && hour === '*') return `Every ${min.slice(2)} minutes`;
  if (hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;
  const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  if (weekday !== '*' && DAYS[Number(weekday)]) return `Every ${DAYS[Number(weekday)]} ${time}`;
  return `Daily at ${time}`;
}

const EXPR_RE = /\{\{[^{}]*\}\}/;

function hasExpression(value) {
  return typeof value === 'string' && EXPR_RE.test(value);
}

/** Strip the moustaches for a preview label — never shown as a raw template. */
function renderExpr(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([^{}]*?)\s*\}\}/g, (_, inner) => `‹${String(inner).replace(/^\$json\./, '')}›`);
}

function shortUrl(url) {
  const s = String(url || '');
  if (!s) return 'no URL set';
  return s.replace(/^https?:\/\//, '').slice(0, 34);
}

function plural(n, word) {
  const v = Number(n) || 0;
  return `${v} ${word}${v === 1 ? '' : 's'}`;
}

function fmtMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return '0ms';
  return n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${Math.round(n)}ms`;
}

function relTime(iso) {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'never';
  const mins = Math.round((NOW.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 8) return `${days}d ago`;
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
}

function clockTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Capture the pointer on the canvas root so a fast drag that leaves the pane
 * keeps delivering move events. Wrapped because setPointerCapture throws on a
 * pointer id the browser does not consider active — a synthetic event in a
 * test, or a pointer already released — and an exception here would abort the
 * drag before it starts.
 */
function capturePointer(el, pointerId) {
  try {
    el?.setPointerCapture(pointerId);
  } catch {
    /* drag still works while the pointer stays inside the canvas */
  }
}

/* ==================================================================== *
 * Store lookups — every id resolves to a real name, or to the id itself.
 * Never to "undefined".
 * ==================================================================== */

function buildLookup(data) {
  const name = (list, id, fallback) => {
    if (!id) return fallback;
    const hit = (list || []).find(r => r && r.id === id);
    return hit ? (hit.name || hit.title || id) : id;
  };
  return {
    queue: (id) => name(data.queues, id, 'General (fallback)'),
    person: (id) => name(data.directory, id, 'Unassigned'),
    policy: (id) => name(data.policies, id, 'No policy set'),
    course: (id) => name(data.courses, id, 'No course set'),
    curriculum: (id) => name(data.curricula, id, 'No curriculum set'),
    subform: (id) => name(data.subforms, id, 'Any form'),
    options: (from) => {
      const list = from === 'queues' ? data.queues
        : from === 'people' ? data.directory
        : from === 'policies' ? data.policies
        : from === 'courses' ? data.courses
        : from === 'curricula' ? data.curricula
        : from === 'subforms' ? data.subforms
        : EMPTY;
      return (list || []).map(r => ({ value: r.id, label: r.name || r.title || r.id }));
    },
  };
}

function describeNode(node, lookup) {
  try {
    const text = nodeMeta(node).describe(node, lookup);
    return text ? String(text) : '';
  } catch {
    return '';
  }
}

/* ==================================================================== *
 * The run planner
 *
 * Pure: takes a graph and returns the ordered steps a run would produce.
 * IF and Filter nodes are evaluated with the real condition engine against the
 * automation's sample item, so the branch the demo takes is the branch the
 * rules actually select.
 * ==================================================================== */

function outgoing(connections, nodeId, ports) {
  return (connections || []).filter(c => c.from === nodeId && (!ports || ports.includes(c.fromPort)));
}

function hashMs(id) {
  let h = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 80 + (h % 420);
}

function planRun(automation, startId) {
  const all = (automation?.nodes || []).filter(n => n.type !== 'util.sticky');
  const byId = new Map(all.map(n => [n.id, n]));
  const conns = automation?.connections || [];
  const ctx = automation?.sample || { __now: '2026-08-16T09:00:00' };

  const start = startId ? byId.get(startId) : all.find(n => categoryOf(n) === 'trigger');
  if (!start) {
    return { ok: false, reason: 'This workflow has no trigger node yet — add one before running it.', steps: [] };
  }

  const steps = [];
  const seen = new Set();
  const queue = [{ id: start.id, items: 1 }];
  let stopped = false;

  while (queue.length) {
    const cur = queue.shift();
    if (seen.has(cur.id)) continue;
    const node = byId.get(cur.id);
    if (!node) continue;
    seen.add(cur.id);

    if (node.disabled) {
      steps.push({
        nodeId: node.id, name: node.name, status: 'skipped', ms: 0, items: 0,
        note: 'Disabled — items passed straight through.', output: null,
      });
      for (const c of outgoing(conns, node.id)) queue.push({ id: c.to, items: cur.items });
      continue;
    }

    const demo = node.demo || {};
    const items = demo.items != null ? demo.items : cur.items;
    const ms = demo.ms != null ? demo.ms : hashMs(node.id);
    const failed = demo.outcome === 'error';

    let ports = outputsOf(node).map(o => o.id);
    let branch = null;

    if (node.type === 'logic.if') {
      const passed = evaluate(node.config?.conditions, ctx);
      branch = passed ? 'true' : 'false';
      ports = [branch];
    } else if (node.type === 'logic.switch') {
      const value = readPath(ctx, node.config?.field || '');
      const hit = (node.config?.cases || []).find(c => String(c.value).toLowerCase() === String(value).toLowerCase());
      branch = hit ? hit.id : 'fallback';
      ports = [branch];
    }

    let output = null;
    try {
      output = nodeMeta(node).output(node, ctx, items) || {};
    } catch {
      output = {};
    }

    steps.push({
      nodeId: node.id,
      name: node.name,
      status: failed ? 'error' : 'success',
      ms,
      items: failed ? 0 : items,
      branch,
      error: failed ? (demo.error || 'The node returned an error.') : undefined,
      output: failed ? { error: demo.error || 'Request failed' } : output,
    });

    if (failed) { stopped = true; continue; }
    for (const c of outgoing(conns, node.id, ports)) queue.push({ id: c.to, items });
  }

  for (const node of all) {
    if (seen.has(node.id)) continue;
    steps.push({
      nodeId: node.id, name: node.name, status: 'skipped', ms: 0, items: 0,
      note: stopped ? 'Branch never ran — an upstream node errored.' : 'Branch not taken on this run.',
      output: null,
    });
  }

  return { ok: true, steps, stopped };
}

/* ==================================================================== *
 * VIEW ROOT
 * ==================================================================== */

export default function Automations({ route }) {
  const data = useStore(s => ({
    automations: s.automations || EMPTY,
    runs: s.automationRuns || EMPTY,
    queues: s.queues || EMPTY,
    directory: s.directory || EMPTY,
    courses: s.courses || EMPTY,
    curricula: s.curricula || EMPTY,
    policies: s.approvalPolicies || EMPTY,
    subforms: s.subforms || EMPTY,
  }));

  const lookup = useMemo(() => buildLookup(data), [data]);
  const selectedId = route?.sub === 'flow' ? route?.id : null;
  const selected = useMemo(
    () => data.automations.find(a => a.id === selectedId) || null,
    [data.automations, selectedId],
  );

  if (selectedId && selected) {
    return <AutomationEditor automation={selected} runs={data.runs} lookup={lookup} />;
  }

  return <AutomationList automations={data.automations} runs={data.runs} lookup={lookup} />;
}

/* ==================================================================== *
 * LIST
 * ==================================================================== */

/**
 * What starts a workflow. The trigger node's type IS the answer — a workflow
 * has exactly one, and it is the first thing anybody asks about a list of them.
 */
function triggerTypeOf(automation) {
  return (automation.nodes || []).find(n => categoryOf(n) === 'trigger')?.type || null;
}

/**
 * Where the most recent run ended. "Never run" is a state a workflow can be in,
 * not a missing value — a workflow nobody has fired is the one worth finding.
 */
function lastRunState(automation, runsBy) {
  const last = (runsBy.get(automation.id) || [])[0];
  if (!last) return 'never';
  return last.status === 'error' ? 'errored' : 'succeeded';
}

function AutomationList({ automations, runs, lookup }) {
  const { t } = useTheme();
  /* One header state: the multi-select filter values, the in-page query and
   * whether the tray is showing. The old All / Active / Paused / With errors
   * tabs are gone — they were single-select spellings of two of these filters,
   * and "paused OR erroring" was a question they could not ask. */
  const [filters, setFilters] = useState({});
  const [query, setQuery] = useState('');
  const [trayOpen, setTrayOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const activeFilters = Object.values(filters).reduce((n, v) => n + (v?.length || 0), 0);
  const showTray = trayOpen || activeFilters > 0;
  const clearFilters = () => { setFilters({}); setQuery(''); setTrayOpen(false); };

  // Newest first per workflow. `addTo` appends, so a test run started just now
  // lands at the END of the collection — taking runs[0] unsorted would keep
  // reporting the previous run as the latest one.
  const runsBy = useMemo(() => {
    const map = new Map();
    for (const r of runs) {
      if (!map.has(r.automationId)) map.set(r.automationId, []);
      map.get(r.automationId).push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
    }
    return map;
  }, [runs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return automations.filter(a => {
      if (!passes(filters.status, a.active ? 'active' : 'disabled')) return false;
      if (!passes(filters.trigger, triggerTypeOf(a))) return false;
      if (!passes(filters.lastRun, lastRunState(a, runsBy))) return false;
      // Search narrows whatever the filters left rather than replacing them.
      if (!q) return true;
      const hay = `${a.name} ${a.description} ${(a.tags || []).join(' ')} ${(a.nodes || []).map(n => n.name).join(' ')}`;
      return hay.toLowerCase().includes(q);
    });
  }, [automations, filters, query, runsBy]);

  const totals = useMemo(() => automations.reduce((acc, a) => ({
    runs: acc.runs + (a.stats?.runs7d || 0),
    errors: acc.errors + (a.stats?.errors7d || 0),
    active: acc.active + (a.active ? 1 : 0),
  }), { runs: 0, errors: 0, active: 0 }), [automations]);

  /* Option counts are computed over EVERY workflow, not the filtered view — an
   * option that told you how many survive the filters you already set reads as
   * choices vanishing as you work. */
  const FILTER_DEFS = useMemo(() => {
    const byStatus = optionCounts(automations, a => (a.active ? 'active' : 'disabled'));
    const byTrigger = optionCounts(automations, a => triggerTypeOf(a));
    const byLastRun = optionCounts(automations, a => lastRunState(a, runsBy));
    const triggerTypes = [...new Set(automations.map(triggerTypeOf).filter(Boolean))];
    return [
      {
        id: 'status', label: 'Status', icon: Power,
        options: [
          { value: 'active', label: 'Active', count: byStatus.get('active') || 0 },
          { value: 'disabled', label: 'Disabled', count: byStatus.get('disabled') || 0 },
        ],
      },
      {
        id: 'trigger', label: 'Trigger', icon: Zap,
        options: triggerTypes.map(type => ({
          value: type,
          label: NODE_TYPES[type]?.label || type,
          count: byTrigger.get(type) || 0,
        })),
      },
      {
        id: 'lastRun', label: 'Last run', icon: History,
        options: [
          { value: 'succeeded', label: 'Succeeded', count: byLastRun.get('succeeded') || 0 },
          { value: 'errored', label: 'Errored', count: byLastRun.get('errored') || 0 },
          { value: 'never', label: 'Never run', count: byLastRun.get('never') || 0 },
        ],
      },
    ];
  }, [automations, runsBy]);

  // The execution list follows the filter. Filtering the workflows above while
  // still listing every workflow's runs below reads as a bug.
  const scoped = activeFilters > 0 || query.trim().length > 0;
  const recent = useMemo(() => {
    const visible = new Set(filtered.map(a => a.id));
    return [...runs]
      .filter(r => !scoped || visible.has(r.automationId))
      .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
      .slice(0, 8);
  }, [runs, filtered, scoped]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ModuleHeader
        icon={Workflow}
        module="automations"
        accent="sky"
        title="Automations"
        /* The subtitle tells the truth about what is on screen: the resting
         * numbers when nothing narrows the list, "9 of 24 shown" when it does. */
        subtitle={subsetLabel(
          filtered.length,
          automations.length,
          `${automations.length} workflows · ${totals.active} active · ${totals.runs} runs and ${totals.errors} errors in the last 7 days`,
        )}
        primary={
          <Button variant="grad" module="automations" icon={Plus} onClick={() => setCreating(true)}>
            New automation
          </Button>
        }
        tools={<>
          <ScopedSearch
            value={query}
            onChange={setQuery}
            /* Names its own scope so it can never be read as the global ⌘K
             * field in the bar above. */
            scope={`${automations.length} automations`}
            accent="sky"
          />
          <FilterToggle
            open={showTray}
            count={activeFilters}
            accent="sky"
            onClick={() => (activeFilters > 0 ? clearFilters() : setTrayOpen(o => !o))}
          />
        </>}
        tray={showTray ? (
          <FilterTray
            open
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onClearAll={clearFilters}
          />
        ) : null}
      />

      <PageBody>
        <div className="space-y-4">
          <Banner accent="sky" icon={AlertCircle} title="When automations run">
            Automations fire <strong className={t.text}>after</strong> form routing and business rules, on the same event bus.
            A paused automation keeps its history but never fires, and a workflow whose Assign Queue node has no queue set
            leaves the ticket in <strong className={t.text}>General</strong> — the canvas says so rather than failing quietly.
          </Banner>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No workflows match"
              hint={scoped
                ? 'Search composes with the filters rather than replacing them — clearing one may bring workflows back.'
                : 'Automations react to events in RelayHQ — a ticket arriving, an approval deciding, a course being completed — and run a chain of nodes.'}
              action={scoped
                ? <Button variant="soft" accent="sky" onClick={clearFilters}>Clear filters</Button>
                : <Button variant="grad" module="automations" icon={Plus} onClick={() => setCreating(true)}>New automation</Button>}
            />
          ) : (
            <div className={DENSITY.rowGap}>
              {filtered.map(a => (
                <AutomationRow
                  key={a.id}
                  automation={a}
                  lookup={lookup}
                  runs={runsBy.get(a.id) || EMPTY}
                  onDelete={() => setDeleting(a)}
                />
              ))}
            </div>
          )}

          <Section
            title="Recent executions"
            hint={scoped ? 'Runs from the workflows matching this filter, newest first.' : 'Every run across every workflow, newest first.'}
          >
            <Card>
              <div className={cx('divide-y', t.borderLight)}>
                {recent.map(r => (
                  <RunLine key={r.id} run={r} automations={automations} />
                ))}
                {recent.length === 0 && (
                  <p className={cx('text-sm p-4', t.textMuted)}>No executions recorded for these workflows.</p>
                )}
              </div>
            </Card>
          </Section>
        </div>
      </PageBody>

      <NewAutomationModal open={creating} onClose={() => setCreating(false)} />

      <ConfirmDelete
        open={!!deleting}
        name={deleting?.name || ''}
        kind="automation"
        cascadeNote="Its execution history is deleted with it."
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          removeFrom('automations', deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}

function AutomationRow({ automation, runs, lookup, onDelete }) {
  const { t, a } = useTheme();
  const nodes = (automation.nodes || []).filter(n => n.type !== 'util.sticky');
  const trigger = nodes.find(n => categoryOf(n) === 'trigger');
  const last = runs[0];
  const errors = automation.stats?.errors7d || 0;
  const total = automation.stats?.runs7d || 0;
  const rate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;

  return (
    <ListRow
      accent="sky"
      icon={Workflow}
      title={automation.name}
      subtitle={automation.description}
      onClick={() => navigate('automations', 'flow', automation.id)}
      meta={
        <>
          <span className={cx('text-xs tabular-nums hidden sm:inline', errors ? a('red').fg : t.textMuted)}>
            {rate}% ok · {plural(total, 'run')}
          </span>
          <Chip accent={automation.active ? 'emerald' : 'gray'} icon={automation.active ? Zap : Power}>
            {automation.active ? 'Active' : 'Paused'}
          </Chip>
          <Avatar name={lookup.person(automation.ownerId)} size="sm" />
        </>
      }
      actions={
        <>
          <IconButton
            icon={Power}
            label={automation.active ? 'Pause workflow' : 'Activate workflow'}
            accent={automation.active ? 'gray' : 'emerald'}
            onClick={(e) => {
              e.stopPropagation();
              patchIn('automations', automation.id, { active: !automation.active });
            }}
          />
          <IconButton
            icon={Copy}
            label="Duplicate"
            onClick={(e) => { e.stopPropagation(); duplicateAutomation(automation); }}
          />
          <IconButton icon={Trash2} label="Delete" accent="red" onClick={(e) => { e.stopPropagation(); onDelete(); }} />
        </>
      }
    >
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {trigger && (
          <Chip accent={CATEGORIES.trigger.hue} icon={nodeMeta(trigger).icon}>
            {describeNode(trigger, lookup) || nodeMeta(trigger).label}
          </Chip>
        )}
        <ChipGroup accent="sky" max={3} items={nodes.filter(n => categoryOf(n) !== 'trigger').map(n => n.name)} />
        <span className={cx('text-[11px]', t.textMuted)}>
          {plural(nodes.length, 'node')} · {plural((automation.connections || []).length, 'connection')} · last run {relTime(last?.startedAt || automation.stats?.lastRunAt)}
        </span>
      </div>
    </ListRow>
  );
}

function RunLine({ run, automations }) {
  const { t } = useTheme();
  const auto = automations.find(a => a.id === run.automationId);
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <StatusPill status={run.status} />
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm truncate', t.text)}>{auto?.name || run.automationId}</p>
        <p className={cx('text-xs truncate', t.textMuted)}>{run.trigger}</p>
      </div>
      <Chip accent="gray">{run.mode}</Chip>
      <span className={cx('text-xs tabular-nums', t.textMuted)}>{plural(run.items, 'item')}</span>
      <span className={cx('text-xs tabular-nums', t.textMuted)}>{fmtMs(run.durationMs)}</span>
      <span className={cx('text-xs tabular-nums w-20 text-right', t.textMuted)}>{relTime(run.startedAt)}</span>
    </div>
  );
}

const BLANK_TEMPLATES = [
  { value: 'ticket', label: 'Ticket created', hint: 'a request arrives', type: 'trigger.ticketCreated', icon: Inbox },
  { value: 'schedule', label: 'On a schedule', hint: 'cron', type: 'trigger.schedule', icon: Clock },
  { value: 'approval', label: 'Approval decided', hint: 'approved or rejected', type: 'trigger.approvalDecided', icon: Stamp },
  { value: 'course', label: 'Course completed', hint: 'a learner finishes', type: 'trigger.courseCompleted', icon: GraduationCap },
  { value: 'webhook', label: 'Webhook call', hint: 'an external system POSTs', type: 'trigger.webhook', icon: Webhook },
  { value: 'manual', label: 'Manually', hint: 'for testing', type: 'trigger.manual', icon: MousePointerClick },
];

function NewAutomationModal({ open, onClose }) {
  const { t } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [starter, setStarter] = useState('ticket');

  useEffect(() => {
    if (open) { setName(''); setDescription(''); setStarter('ticket'); }
  }, [open]);

  const create = () => {
    const template = BLANK_TEMPLATES.find(x => x.value === starter) || BLANK_TEMPLATES[0];
    const id = uid('auto');
    const triggerId = uid('node');
    addTo('automations', {
      id,
      name: name.trim() || 'Untitled workflow',
      description: description.trim(),
      active: false,
      ownerId: USR.ADMIN,
      audience: 'both',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: { runs7d: 0, errors7d: 0, avgMs: 0, lastRunAt: null },
      sample: { __now: '2026-08-16T09:00:00' },
      nodes: [{ id: triggerId, type: template.type, name: NODE_TYPES[template.type].label, x: 120, y: 200, config: {} }],
      connections: [],
    });
    onClose();
    navigate('automations', 'flow', id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      accent="sky"
      icon={Workflow}
      title="New automation"
      subtitle="Pick what starts it. Everything after that is built on the canvas."
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>Created inactive — activate it when the canvas is right.</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="grad" module="automations" icon={Check} onClick={create}>Create workflow</Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input accent="sky" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Escalate stalled enterprise tickets" />
        </Field>
        <Field label="What it does" hint="One line. This is what the list shows.">
          <Textarea accent="sky" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the outcome, not the steps." />
        </Field>
        <Field label="Trigger">
          <TileGroup
            accent="sky"
            columns={3}
            value={starter}
            onChange={setStarter}
            options={BLANK_TEMPLATES}
          />
        </Field>
      </div>
    </Modal>
  );
}

function duplicateAutomation(automation) {
  const id = uid('auto');
  addTo('automations', {
    ...automation,
    id,
    name: `${automation.name} (copy)`,
    active: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stats: { runs7d: 0, errors7d: 0, avgMs: 0, lastRunAt: null },
    nodes: (automation.nodes || []).map(n => ({ ...n })),
    connections: (automation.connections || []).map(c => ({ ...c })),
  });
  navigate('automations', 'flow', id);
}

/* ==================================================================== *
 * EDITOR
 * ==================================================================== */

function AutomationEditor({ automation, runs, lookup }) {
  const { t } = useTheme();
  const [nodes, setNodes] = useState(automation.nodes || EMPTY);
  const [connections, setConnections] = useState(automation.connections || EMPTY);
  const [selection, setSelection] = useState({ kind: null, id: null });
  const [panel, setPanel] = useState('config');
  const [pendingLink, setPendingLink] = useState(null);
  const [run, setRun] = useState(null);
  const [logOpen, setLogOpen] = useState(true);
  const [logTab, setLogTab] = useState('run');
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    setNodes(automation.nodes || EMPTY);
    setConnections(automation.connections || EMPTY);
    setSelection({ kind: null, id: null });
    setRun(null);
  }, [automation.id]);

  const history = useMemo(
    () => runs.filter(r => r.automationId === automation.id)
      .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))),
    [runs, automation.id],
  );

  const commitNodes = useCallback((next) => {
    setNodes(next);
    patchIn('automations', automation.id, { nodes: next, updatedAt: new Date().toISOString() });
  }, [automation.id]);

  const commitConnections = useCallback((next) => {
    setConnections(next);
    patchIn('automations', automation.id, { connections: next, updatedAt: new Date().toISOString() });
  }, [automation.id]);

  /* --- node operations --- */

  const patchNode = useCallback((id, patch) => {
    commitNodes(nodesRef.current.map(n => (n.id === id ? { ...n, ...patch } : n)));
  }, [commitNodes]);

  const dragNode = useCallback((id, x, y) => {
    setNodes(list => list.map(n => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  /**
   * The canvas hands back the final position rather than us reading it out of
   * state. Pointer move and pointer up can land in the same task, and React has
   * not committed the move's setState by the time the up handler runs — trusting
   * the ref there persists the position the node had one frame ago.
   */
  const endDrag = useCallback((id, x, y) => {
    const next = nodesRef.current.map(n => (n.id === id ? { ...n, x, y } : n));
    setNodes(next);
    patchIn('automations', automation.id, { nodes: next, updatedAt: new Date().toISOString() });
  }, [automation.id]);

  const deleteNode = useCallback((id) => {
    commitNodes(nodesRef.current.filter(n => n.id !== id));
    setConnections(list => {
      const next = list.filter(c => c.from !== id && c.to !== id);
      patchIn('automations', automation.id, { connections: next });
      return next;
    });
    setSelection({ kind: null, id: null });
  }, [automation.id, commitNodes]);

  const duplicateNode = useCallback((id) => {
    const src = nodesRef.current.find(n => n.id === id);
    if (!src) return;
    const copy = { ...src, id: uid('node'), name: `${src.name} copy`, x: src.x + 40, y: src.y + 60 };
    commitNodes([...nodesRef.current, copy]);
    setSelection({ kind: 'node', id: copy.id });
  }, [commitNodes]);

  const addNode = useCallback((type, at) => {
    const meta = NODE_TYPES[type];
    if (!meta) return;
    const node = {
      id: uid('node'),
      type,
      name: meta.label,
      x: at?.x ?? 200,
      y: at?.y ?? 220,
      config: defaultConfigFor(type),
    };
    if (type === 'util.sticky') { node.w = 260; node.h = 120; }
    const nextNodes = [...nodesRef.current, node];
    commitNodes(nextNodes);
    if (pendingLink) {
      const link = {
        id: uid('conn'),
        from: pendingLink.from,
        fromPort: pendingLink.port,
        to: node.id,
        toPort: inputsOf(node)[0]?.id || 'main',
      };
      commitConnections([...connections, link]);
      setPendingLink(null);
    }
    setSelection({ kind: 'node', id: node.id });
    setPanel('config');
  }, [commitNodes, commitConnections, connections, pendingLink]);

  const connect = useCallback((from, fromPort, to, toPort) => {
    if (from === to) return;
    const exists = connections.some(c => c.from === from && c.fromPort === fromPort && c.to === to && c.toPort === toPort);
    if (exists) return;
    commitConnections([...connections, { id: uid('conn'), from, fromPort, to, toPort }]);
  }, [connections, commitConnections]);

  const deleteConnection = useCallback((id) => {
    commitConnections(connections.filter(c => c.id !== id));
    setSelection({ kind: null, id: null });
  }, [connections, commitConnections]);

  /* --- execution --- */

  const startRun = useCallback((fromNodeId) => {
    const plan = planRun({ ...automation, nodes, connections }, fromNodeId);
    if (!plan.ok) {
      setRun({ id: uid('run'), error: plan.reason, steps: [], cursor: 0, playing: false, startedAt: new Date().toISOString(), partial: false });
      setLogOpen(true);
      setLogTab('run');
      return;
    }
    setRun({
      id: uid('run'),
      steps: plan.steps,
      cursor: 0,
      playing: true,
      startedAt: new Date().toISOString(),
      partial: !!fromNodeId,
      saved: false,
    });
    setLogOpen(true);
    setLogTab('run');
  }, [automation, nodes, connections]);

  useEffect(() => {
    if (!run || !run.playing) return undefined;
    if (run.cursor >= run.steps.length) {
      const failedStep = run.steps.find(s => s.status === 'error');
      const record = {
        id: uid('run'),
        automationId: automation.id,
        status: failedStep ? 'error' : 'success',
        mode: 'manual',
        trigger: run.partial ? 'Partial test run from a node' : 'Manual test run — Alex Rivera',
        startedAt: run.startedAt,
        durationMs: run.steps.reduce((n, s) => n + (s.ms || 0), 0),
        items: run.steps.reduce((n, s) => Math.max(n, s.items || 0), 0),
        error: failedStep?.error,
        steps: run.steps.map(s => ({ nodeId: s.nodeId, name: s.name, status: s.status, ms: s.ms, items: s.items, error: s.error })),
      };
      if (!run.saved) addTo('automationRuns', record);
      setRun(r => (r ? { ...r, playing: false, saved: true } : r));
      return undefined;
    }
    const step = run.steps[run.cursor];
    const delay = clamp(90 + (step?.ms || 0) / 3, 90, 620);
    const timer = setTimeout(() => setRun(r => (r ? { ...r, cursor: r.cursor + 1 } : r)), delay);
    return () => clearTimeout(timer);
  }, [run, automation.id]);

  const nodeStates = useMemo(() => {
    const map = new Map();
    if (!run || !run.steps.length) return map;
    run.steps.forEach((s, i) => {
      const status = i < run.cursor ? s.status
        : i === run.cursor && run.playing ? 'running'
        : 'waiting';
      map.set(s.nodeId, { status, ms: s.ms, items: s.items });
    });
    return map;
  }, [run]);

  const activeConnections = useMemo(() => {
    const done = new Set();
    if (run) {
      run.steps.forEach((s, i) => { if (i < run.cursor && s.status !== 'skipped') done.add(s.nodeId); });
    }
    return new Set(connections.filter(c => done.has(c.from) && done.has(c.to)).map(c => c.id));
  }, [run, connections]);

  const selectedNode = selection.kind === 'node' ? nodes.find(n => n.id === selection.id) : null;
  const selectedStep = run?.steps.find(s => s.nodeId === selection.id) || null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Inside the canvas the header is identity plus the run controls. There
          is nothing to filter here — the workflow IS the selection — so the
          tray and the scoped search that the list carries are absent. */}
      <ModuleHeader
        icon={Workflow}
        module="automations"
        accent="sky"
        title={automation.name}
        subtitle={[
          automation.description,
          plural(nodes.filter(n => n.type !== 'util.sticky').length, 'node'),
          `updated ${relTime(automation.updatedAt)}`,
        ].filter(Boolean).join(' · ')}
        primary={
          <Button variant="grad" module="automations" icon={Play} onClick={() => startRun(null)}>
            Test workflow
          </Button>
        }
        actions={
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('automations')}>
              All workflows
            </Button>
            <ChipGroup accent="sky" max={2} items={automation.tags || []} />
            <Button variant="soft" accent="sky" icon={Plus} onClick={() => { setPendingLink(null); setPanel('palette'); }}>
              Add node
            </Button>
            <Divider vertical className="h-5" />
            {/* Label ahead of the switch: the DS toggle's knob travels past the
                right edge of its track, so a trailing label collides with it. */}
            <span className={cx('text-xs font-medium', automation.active ? '' : t.textMuted)}>
              {automation.active ? 'Active' : 'Paused'}
            </span>
            <Toggle
              accent="emerald"
              checked={!!automation.active}
              onChange={(v) => patchIn('automations', automation.id, { active: v })}
            />
            <div className="relative">
              <IconButton icon={Layers} label="Workflow actions" onClick={() => setMenuOpen(v => !v)} />
              <Menu open={menuOpen} onClose={() => setMenuOpen(false)} align="right" width="w-52">
                <MenuLabel>Workflow</MenuLabel>
                <MenuItem icon={Copy} label="Duplicate" onClick={() => { setMenuOpen(false); duplicateAutomation(automation); }} />
                <MenuItem icon={StickyNote} label="Add sticky note" onClick={() => { setMenuOpen(false); addNode('util.sticky', { x: 80, y: 80 }); }} />
                <MenuDivider />
                <MenuItem icon={Trash2} label="Delete workflow" accent="red" onClick={() => { setMenuOpen(false); setDeleting(true); }} />
              </Menu>
            </div>
          </>
        }
      />

      <div className="flex-1 flex min-h-0 min-w-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <Canvas
            fitKey={automation.id}
            nodes={nodes}
            connections={connections}
            lookup={lookup}
            selection={selection}
            nodeStates={nodeStates}
            activeConnections={activeConnections}
            onSelect={setSelection}
            onDragNode={dragNode}
            onDragEnd={endDrag}
            onConnect={connect}
            onDeleteConnection={deleteConnection}
            onDeleteNode={deleteNode}
            onDuplicateNode={duplicateNode}
            onToggleNode={(id, disabled) => patchNode(id, { disabled })}
            onRunFrom={startRun}
            onAddFromPort={(from, port, at) => {
              setPendingLink({ from, port, at });
              setPanel('palette');
            }}
            onOpenPalette={() => { setPendingLink(null); setPanel('palette'); }}
          />
          <ExecutionLog
            open={logOpen}
            onToggle={() => setLogOpen(v => !v)}
            tab={logTab}
            onTab={setLogTab}
            run={run}
            history={history}
            onSelectNode={(id) => { setSelection({ kind: 'node', id }); setPanel('config'); }}
          />
        </div>

        <aside className={cx('w-[21rem] flex-shrink-0 border-l flex flex-col min-h-0', t.border, t.bgSidebar)}>
          {panel === 'palette' ? (
            <NodePalette
              pendingLink={pendingLink}
              onClose={() => { setPendingLink(null); setPanel('config'); }}
              onPick={(type) => {
                const anchor = pendingLink?.at;
                addNode(type, anchor ? { x: anchor.x + 90, y: anchor.y - NODE_H / 2 } : { x: 260, y: 260 });
              }}
            />
          ) : (
            <ConfigPanel
              node={selectedNode}
              step={selectedStep}
              lookup={lookup}
              onPatch={(patch) => selectedNode && patchNode(selectedNode.id, patch)}
              onConfig={(key, value) => selectedNode && patchNode(selectedNode.id, { config: { ...(selectedNode.config || {}), [key]: value } })}
              onDelete={() => selectedNode && deleteNode(selectedNode.id)}
              onOpenPalette={() => { setPendingLink(null); setPanel('palette'); }}
            />
          )}
        </aside>
      </div>

      <ConfirmDelete
        open={deleting}
        name={automation.name}
        kind="automation"
        cascadeNote="Its execution history is deleted with it."
        onCancel={() => setDeleting(false)}
        onConfirm={() => { removeFrom('automations', automation.id); setDeleting(false); navigate('automations'); }}
      />
    </div>
  );
}

function defaultConfigFor(type) {
  if (type === 'logic.if' || type === 'logic.filter') return { conditions: { match: 'all', rows: [defaultRowFor(FIELDS[0].id)] } };
  if (type === 'logic.switch') return { field: 'ticket.priority', fallback: true, cases: [{ id: 'c1', label: 'Urgent', value: 'urgent' }] };
  if (type === 'logic.wait') return { amount: 1, unit: 'hours' };
  if (type === 'logic.loop') return { batchSize: 1 };
  if (type === 'trigger.schedule') return { cron: '0 9 * * 1', timezone: 'America/Chicago' };
  if (type === 'trigger.webhook') return { path: '/hooks/new', method: 'POST', auth: 'header' };
  if (type === 'action.notify') return { channel: 'slack', target: '#general', message: '' };
  if (type === 'action.setPriority') return { priority: 'high', reason: '' };
  if (type === 'action.createTask') return { title: '', dueDays: 7, priority: 'medium' };
  if (type === 'action.http') return { method: 'POST', url: '' };
  if (type === 'util.sticky') return { text: 'Explain what this part of the flow does.', hue: 'amber' };
  if (type === 'util.setFields') return { fields: [{ name: 'field', value: '' }] };
  if (type === 'util.code') return { language: 'javascript', code: 'return items;' };
  return {};
}

/* ==================================================================== *
 * CANVAS
 * ==================================================================== */

function Canvas({
  fitKey, nodes, connections, lookup, selection, nodeStates, activeConnections,
  onSelect, onDragNode, onDragEnd, onConnect, onDeleteConnection, onDeleteNode,
  onDuplicateNode, onToggleNode, onRunFrom, onAddFromPort, onOpenPalette,
}) {
  const { t, a } = useTheme();
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const [view, setView] = useState({ x: 40, y: 20, z: 0.85 });
  const [ghost, setGhost] = useState(null);
  const [hoverPort, setHoverPort] = useState(null);

  const toCanvas = useCallback((clientX, clientY) => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return { x: (clientX - box.left - view.x) / view.z, y: (clientY - box.top - view.y) / view.z };
  }, [view]);

  const fit = useCallback(() => {
    const box = rootRef.current?.getBoundingClientRect();
    if (!box || !nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + nodeWidth(n));
      maxY = Math.max(maxY, n.y + nodeHeight(n));
    }
    const w = Math.max(maxX - minX, 1);
    const h = Math.max(maxY - minY, 1);
    const z = clamp(Math.min((box.width - 120) / w, (box.height - 120) / h), MIN_ZOOM, 1.1);
    setView({ z, x: (box.width - w * z) / 2 - minX * z, y: (box.height - h * z) / 2 - minY * z });
  }, [nodes]);

  // Fit once per workflow. Refitting on every node move would fight the user
  // mid-drag, so `fitKey` (the automation id) is the only trigger.
  useEffect(() => {
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [fitKey]);

  const zoomBy = (factor) => {
    const box = rootRef.current?.getBoundingClientRect();
    setView(v => {
      const z = clamp(v.z * factor, MIN_ZOOM, MAX_ZOOM);
      if (!box) return { ...v, z };
      const cx0 = box.width / 2;
      const cy0 = box.height / 2;
      return { z, x: cx0 - ((cx0 - v.x) / v.z) * z, y: cy0 - ((cy0 - v.y) / v.z) * z };
    });
  };

  const onPointerDown = (e) => {
    const hit = e.target.closest('[data-canvas-bg]');
    if (!hit) return;
    onSelect({ kind: null, id: null });
    dragRef.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    capturePointer(rootRef.current, e.pointerId);
  };

  const beginNodeDrag = (e, node) => {
    e.stopPropagation();
    onSelect({ kind: 'node', id: node.id });
    dragRef.current = { kind: 'node', id: node.id, sx: e.clientX, sy: e.clientY, nx: node.x, ny: node.y, moved: false };
    capturePointer(rootRef.current, e.pointerId);
  };

  const beginLink = (e, node, portId) => {
    e.stopPropagation();
    const from = outPoint(node, portId);
    dragRef.current = { kind: 'link', from: node.id, port: portId, origin: from };
    setGhost({ from, to: from });
    capturePointer(rootRef.current, e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === 'pan') {
      setView(v => ({ ...v, x: d.vx + (e.clientX - d.sx), y: d.vy + (e.clientY - d.sy) }));
    } else if (d.kind === 'node') {
      const dx = (e.clientX - d.sx) / view.z;
      const dy = (e.clientY - d.sy) / view.z;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) d.moved = true;
      const x = Math.max(0, Math.round((d.nx + dx) / SNAP) * SNAP);
      const y = Math.max(0, Math.round((d.ny + dy) / SNAP) * SNAP);
      d.lastX = x;
      d.lastY = y;
      onDragNode(d.id, x, y);
    } else if (d.kind === 'link') {
      const pt = toCanvas(e.clientX, e.clientY);
      setGhost({ from: d.origin, to: pt });
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el && el.closest ? el.closest('[data-in-node]') : null;
      setHoverPort(target ? { node: target.getAttribute('data-in-node'), port: target.getAttribute('data-in-port') } : null);
    }
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.kind === 'node' && d.moved) onDragEnd(d.id, d.lastX, d.lastY);
    if (d.kind === 'link') {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const target = el && el.closest ? el.closest('[data-in-node]') : null;
      if (target) {
        onConnect(d.from, d.port, target.getAttribute('data-in-node'), target.getAttribute('data-in-port'));
      } else {
        onAddFromPort(d.from, d.port, d.origin);
      }
      setGhost(null);
      setHoverPort(null);
    }
  };

  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const stickies = nodes.filter(n => n.type === 'util.sticky');
  const flowNodes = nodes.filter(n => n.type !== 'util.sticky');
  const freeOutputs = useMemo(() => {
    const out = [];
    for (const n of flowNodes) {
      for (const p of outputsOf(n)) {
        if (!connections.some(c => c.from === n.id && c.fromPort === p.id)) {
          out.push({ node: n, port: p, point: outPoint(n, p.id) });
        }
      }
    }
    return out;
  }, [flowNodes, connections]);

  return (
    <div
      ref={rootRef}
      className={cx('relative flex-1 min-h-0 overflow-hidden touch-none', t.canvasBg)}
      style={{ '--rhq-grid': t.canvasGrid }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div data-canvas-bg className="absolute inset-0 rhq-canvas cursor-grab" />

      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`, width: 0, height: 0 }}
      >
        {stickies.map(n => (
          <StickyCard
            key={n.id}
            node={n}
            selected={selection.kind === 'node' && selection.id === n.id}
            onPointerDown={(e) => beginNodeDrag(e, n)}
          />
        ))}

        <svg
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: 6000, height: 4000, overflow: 'visible' }}
          aria-hidden="true"
        >
          {connections.map(c => {
            const from = byId.get(c.from);
            const to = byId.get(c.to);
            if (!from || !to) return null;
            const p1 = outPoint(from, c.fromPort);
            const p2 = inPoint(to, c.toPort);
            return (
              <Connector
                key={c.id}
                d={bezier(p1.x, p1.y, p2.x, p2.y)}
                selected={selection.kind === 'connection' && selection.id === c.id}
                active={activeConnections.has(c.id)}
                onSelect={() => onSelect({ kind: 'connection', id: c.id })}
              />
            );
          })}
          {ghost && (
            // Colour comes from the accent set via currentColor, the same way
            // Connector does it — an SVG stroke class is not in the DS surface.
            <g className={a('sky').fg}>
              <path
                d={bezier(ghost.from.x, ghost.from.y, ghost.to.x, ghost.to.y)}
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray="5 4"
                fill="none"
              />
            </g>
          )}
        </svg>

        {connections.map(c => {
          if (!(selection.kind === 'connection' && selection.id === c.id)) return null;
          const from = byId.get(c.from);
          const to = byId.get(c.to);
          if (!from || !to) return null;
          const p1 = outPoint(from, c.fromPort);
          const p2 = inPoint(to, c.toPort);
          return (
            <div
              key={`del-${c.id}`}
              className="absolute z-20"
              style={{ left: (p1.x + p2.x) / 2 - 14, top: (p1.y + p2.y) / 2 - 14 }}
            >
              <IconButton
                icon={Trash2}
                label="Delete connection"
                accent="red"
                className={cx('shadow-lg border', t.floatBg, t.floatBorder)}
                onClick={(e) => { e.stopPropagation(); onDeleteConnection(c.id); }}
              />
            </div>
          );
        })}

        {freeOutputs.map(({ node, port, point }) => (
          <button
            key={`add-${node.id}-${port.id}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onAddFromPort(node.id, port.id, point); }}
            title="Add the next node"
            className={cx('absolute z-10 w-5 h-5 rounded-md border flex items-center justify-center shadow-sm',
              t.floatBg, t.floatBorder, t.textSecondary)}
            style={{ left: point.x + 26, top: point.y - 10 }}
          >
            <Plus size={ICON.sm} />
          </button>
        ))}

        {flowNodes.map(n => (
          <FlowNode
            key={n.id}
            node={n}
            lookup={lookup}
            selected={selection.kind === 'node' && selection.id === n.id}
            runState={nodeStates.get(n.id)}
            hoverPort={hoverPort}
            onPointerDown={(e) => beginNodeDrag(e, n)}
            onStartLink={(e, portId) => beginLink(e, n, portId)}
            onRunFrom={() => onRunFrom(n.id)}
            onToggle={() => onToggleNode(n.id, !n.disabled)}
            onDuplicate={() => onDuplicateNode(n.id)}
            onDelete={() => onDeleteNode(n.id)}
          />
        ))}
      </div>

      {/* zoom cluster — bottom left, n8n's position */}
      <div className={cx('absolute bottom-3 left-3 flex items-center gap-1 p-1 rounded-xl border shadow-sm', t.floatBg, t.floatBorder)}>
        <IconButton icon={Maximize2} label="Zoom to fit" onClick={fit} />
        <IconButton icon={ZoomIn} label="Zoom in" onClick={() => zoomBy(1.2)} />
        <IconButton icon={ZoomOut} label="Zoom out" onClick={() => zoomBy(1 / 1.2)} />
        <IconButton icon={Crosshair} label="Reset to 100%" onClick={() => setView({ x: 40, y: 20, z: 1 })} />
        <span className={cx('px-1.5 text-[11px] tabular-nums', t.textMuted)}>{Math.round(view.z * 100)}%</span>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1">
        <Button size="sm" variant="soft" accent="sky" icon={Plus} onClick={onOpenPalette}>Node</Button>
      </div>

      {flowNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <EmptyState icon={Workflow} title="Empty canvas" hint="Add a trigger node to start the workflow." />
        </div>
      )}
    </div>
  );
}

function Connector({ d, selected, active, onSelect }) {
  const { t, a } = useTheme();
  const sky = a('sky');
  const emerald = a('emerald');
  const tone = selected ? sky.fg : active ? emerald.fg : '';
  return (
    <g className={tone} style={!tone ? { color: t.canvasEdge } : undefined}>
      {/* Fat transparent path = the hit area. `pointer-events: stroke` is not a
          Tailwind utility, so it is set inline — a class here would compile to
          nothing and the connection would be unclickable. */}
      <path
        d={d}
        stroke="transparent"
        strokeWidth="16"
        fill="none"
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onPointerDown={(e) => { e.stopPropagation(); onSelect(); }}
      />
      <path d={d} stroke="currentColor" strokeWidth={selected || active ? 2.4 : 1.6} fill="none" />
      {active && (
        <circle r="3.5" fill="currentColor">
          <animateMotion dur="1.1s" repeatCount="indefinite" path={d} />
        </circle>
      )}
    </g>
  );
}

/* ==================================================================== *
 * NODES
 * ==================================================================== */

function FlowNode({
  node, lookup, selected, runState, hoverPort,
  onPointerDown, onStartLink, onRunFrom, onToggle, onDuplicate, onDelete,
}) {
  const { t, a } = useTheme();
  const meta = nodeMeta(node);
  const cat = CATEGORIES[meta.category] || CATEGORIES.utility;
  const catColor = a(cat.hue);
  const sky = a('sky');
  const state = runState?.status;
  const stateHue = state && state !== 'waiting' ? statusMeta(state).hue : null;
  const stateColor = stateHue ? a(stateHue) : null;
  const outs = outputsOf(node);
  const ins = inputsOf(node);
  const height = nodeHeight(node);
  const subtitle = describeNode(node, lookup);
  const Glyph = meta.icon;

  return (
    <div
      className="absolute group"
      style={{ left: node.x, top: node.y, width: NODE_W }}
      onPointerDown={onPointerDown}
    >
      {/* hover toolbar */}
      <div className="absolute -top-8 right-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-20">
        <div className={cx('flex items-center gap-0.5 p-0.5 rounded-lg border shadow-sm', t.floatBg, t.floatBorder)}>
          <IconButton icon={Play} label="Run from here" size={ICON.sm} accent="sky"
            onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRunFrom(); }} />
          <IconButton icon={Power} label={node.disabled ? 'Enable node' : 'Disable node'} size={ICON.sm}
            onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onToggle(); }} />
          <IconButton icon={Copy} label="Duplicate node" size={ICON.sm}
            onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDuplicate(); }} />
          <IconButton icon={Trash2} label="Delete node" size={ICON.sm} accent="red"
            onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(); }} />
        </div>
      </div>

      {selected && <span className={cx('absolute -inset-1 rounded-2xl border-2 pointer-events-none', sky.borderStrong)} />}

      <div
        className={cx('relative rounded-xl border flex items-stretch overflow-hidden shadow-sm cursor-grab',
          t.bgCard,
          stateColor ? stateColor.borderStrong : t.borderLight,
          state === 'running' && 'animate-pulse',
          node.disabled && 'opacity-50')}
        style={{ height }}
      >
        <span className={cx('w-1.5 flex-shrink-0', catColor.rail)} />
        <div className="flex items-center gap-2 px-2 min-w-0 flex-1">
          <IconTile icon={Glyph} accent={meta.hue} size="sm" />
          <div className="min-w-0">
            <p className={cx('text-xs font-semibold truncate', t.text)}>{node.name}</p>
            <p className={cx('text-[10px] truncate', t.textMuted)}>{subtitle || meta.label}</p>
          </div>
        </div>
        {node.disabled && (
          <span className={cx('absolute inset-x-0 bottom-0 text-[9px] text-center uppercase tracking-wider', t.bgSubtle, t.textMuted)}>
            disabled
          </span>
        )}
      </div>

      {/* input endpoints */}
      {ins.map((p, i) => {
        const pt = portPoint(node, ins, i, 'in');
        const hot = hoverPort && hoverPort.node === node.id && hoverPort.port === p.id;
        return (
          <span
            key={p.id}
            data-in-node={node.id}
            data-in-port={p.id}
            title={p.label ? `Input ${p.label}` : 'Input'}
            className={cx('absolute w-3 h-3 rounded-sm border-2', hot ? cx(a('sky').solid, a('sky').borderStrong) : cx(t.bgCard, t.borderLight))}
            style={{ left: -6, top: pt.y - node.y - 6 }}
          />
        );
      })}

      {/* output endpoints */}
      {outs.map((p, i) => {
        const pt = portPoint(node, outs, i, 'out');
        const portColor = a(p.hue || 'sky');
        return (
          <React.Fragment key={p.id}>
            <span
              onPointerDown={(e) => onStartLink(e, p.id)}
              title="Drag to connect"
              className={cx('absolute w-3 h-3 rounded-full border-2 cursor-crosshair', portColor.solid, portColor.borderStrong)}
              style={{ left: NODE_W - 6, top: pt.y - node.y - 6 }}
            />
            {p.label && (
              <span
                className={cx('absolute text-[9px] font-medium px-1 rounded pointer-events-none', portColor.soft, portColor.fgOnSoft)}
                style={{ left: NODE_W + 10, top: pt.y - node.y - 8 }}
              >
                {p.label}
              </span>
            )}
          </React.Fragment>
        );
      })}

      {state && state !== 'waiting' && <NodeRunBadge runState={runState} />}
    </div>
  );
}

function NodeRunBadge({ runState }) {
  const { t, a } = useTheme();
  const meta = statusMeta(runState.status);
  const c = a(meta.hue);
  const detailed = runState.status === 'success' || runState.status === 'error';
  return (
    <span
      className={cx('absolute -bottom-6 left-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium whitespace-nowrap',
        c.soft, c.fgOnSoft)}
    >
      <span className={cx('w-1.5 h-1.5 rounded-full', c.dot)} />
      {meta.label}
      {detailed && (
        <span className={t.textMuted}>· {plural(runState.items, 'item')} · {fmtMs(runState.ms)}</span>
      )}
    </span>
  );
}

function StickyCard({ node, selected, onPointerDown }) {
  const { t, a } = useTheme();
  const c = a(node.config?.hue || 'amber');
  return (
    <div
      className={cx('absolute rounded-xl border p-2.5 cursor-grab', c.soft, selected ? c.borderStrong : c.border)}
      style={{ left: node.x, top: node.y, width: node.w || 260, height: node.h || 120 }}
      onPointerDown={onPointerDown}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <StickyNote size={ICON.sm} className={c.fg} />
        <span className={cx('text-[10px] font-semibold uppercase tracking-wider', c.fgOnSoft)}>Note</span>
      </div>
      <p className={cx('text-[11px] leading-relaxed', t.textSecondary)}>{node.config?.text || ''}</p>
    </div>
  );
}

/* ==================================================================== *
 * NODE PALETTE
 * ==================================================================== */

function NodePalette({ pendingLink, onPick, onClose }) {
  const { t } = useTheme();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORY_ORDER.map(key => ({
      key,
      meta: CATEGORIES[key],
      items: NODE_LIST.filter(n => n.category === key)
        .filter(n => !q || `${n.label} ${n.blurb}`.toLowerCase().includes(q)),
    })).filter(g => g.items.length > 0);
  }, [query]);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className={cx('flex items-center gap-2 border-b flex-shrink-0', DENSITY.sectionPad, t.border)}>
        <IconButton icon={ArrowLeft} label="Back to settings" onClick={onClose} />
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm font-semibold', t.text)}>Add a node</p>
          <p className={cx('text-[11px] truncate', t.textMuted)}>
            {pendingLink ? 'It will be connected to the output you dragged from.' : 'Dropped in the middle of the canvas.'}
          </p>
        </div>
      </div>

      <div className="p-3 flex-shrink-0">
        <SearchInput value={query} onChange={setQuery} accent="sky" placeholder="Search nodes…" />
      </div>

      <div className="flex-1 overflow-auto px-3 pb-4 space-y-4 min-h-0">
        {groups.map(g => (
          <div key={g.key}>
            <div className="flex items-baseline justify-between mb-1.5">
              <GroupLabel>{g.meta.label}</GroupLabel>
              <span className={cx('text-[10px]', t.textMuted)}>{g.meta.blurb}</span>
            </div>
            <div className="space-y-1">
              {g.items.map(item => (
                <PaletteItem key={item.type} item={item} onPick={() => onPick(item.type)} />
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <p className={cx('text-sm text-center py-6', t.textMuted)}>No node matches that search.</p>
        )}
      </div>
    </div>
  );
}

function PaletteItem({ item, onPick }) {
  const { t } = useTheme();
  const Glyph = item.icon;
  return (
    <button
      onClick={onPick}
      className={cx('w-full flex items-start gap-2.5 p-2 rounded-lg border text-left transition-colors',
        t.bgCard, t.borderLight, t.bgHover)}
    >
      <IconTile icon={Glyph} accent={item.hue} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cx('text-sm font-medium block truncate', t.text)}>{item.label}</span>
        <span className={cx('text-[11px] block leading-snug', t.textMuted)}>{item.blurb}</span>
      </span>
    </button>
  );
}

/* ==================================================================== *
 * CONFIG PANEL
 * ==================================================================== */

function ConfigPanel({ node, step, lookup, onPatch, onConfig, onDelete, onOpenPalette }) {
  const { t } = useTheme();

  if (!node) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className={cx('border-b flex-shrink-0', DENSITY.sectionPad, t.border)}>
          <p className={cx('text-sm font-semibold', t.text)}>Nothing selected</p>
          <p className={cx('text-[11px]', t.textMuted)}>Click a node on the canvas to configure it.</p>
        </div>
        <div className="flex-1 overflow-auto">
          <EmptyState
            icon={Workflow}
            title="Pick a node"
            hint="Drag from an output endpoint to connect nodes, or use the + on a free output to add the next step inline."
            action={<Button variant="soft" accent="sky" icon={Plus} onClick={onOpenPalette}>Add a node</Button>}
          />
        </div>
      </div>
    );
  }

  const meta = nodeMeta(node);
  const cat = CATEGORIES[meta.category] || CATEGORIES.utility;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className={cx('border-b flex-shrink-0 flex items-start gap-2.5', DENSITY.sectionPad, t.border)}>
        <IconTile icon={meta.icon} accent={meta.hue} />
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm font-semibold truncate', t.text)}>{meta.label}</p>
          <p className={cx('text-[11px] leading-snug', t.textMuted)}>{meta.blurb}</p>
        </div>
        <Chip accent={cat.hue}>{cat.label}</Chip>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
        <Field label="Node name">
          <Input accent="sky" value={node.name || ''} onChange={(e) => onPatch({ name: e.target.value })} />
        </Field>

        <div className={cx('flex items-center justify-between rounded-lg border px-3 py-2', t.bgCard, t.borderLight)}>
          <span className={cx('text-sm', t.textSecondary)}>{node.disabled ? 'Node disabled' : 'Node enabled'}</span>
          <span className="flex items-center gap-2">
            <Toggle accent="emerald" checked={!node.disabled} onChange={(v) => onPatch({ disabled: !v })} />
            <IconButton icon={Trash2} label="Delete node" accent="red" onClick={onDelete} />
          </span>
        </div>

        {node.disabled && (
          <Banner accent="amber" icon={AlertCircle}>
            A disabled node is skipped at run time and its items pass straight through to whatever it is connected to.
          </Banner>
        )}

        {/* Never a silent default: if the system will do something implicit, say so. */}
        {node.type === 'action.assignQueue' && !node.config?.queueId && (
          <Banner accent="amber" icon={AlertCircle} title="No queue set">
            Tickets leaving this node fall to the <strong className={t.text}>General</strong> queue and wait for human triage.
          </Banner>
        )}
        {node.type === 'logic.switch' && node.config?.fallback === false && (
          <Banner accent="amber" icon={AlertCircle} title="No fallback output">
            Items matching none of the cases stop here and the branch ends without a trace. Turn the fallback on to catch them.
          </Banner>
        )}

        {meta.fields.length > 0 && (
          <Banner accent="sky" icon={Braces} title="Expressions">
            Any text field accepts <code>{'{{ $json.ticket.title }}'}</code> and resolves it against the item flowing
            into this node. Fields holding one are marked <strong className={t.text}>fx</strong>.
          </Banner>
        )}

        {meta.fields.map(f => (
          <ConfigField
            key={f.key}
            spec={f}
            value={node.config?.[f.key]}
            lookup={lookup}
            onChange={(v) => onConfig(f.key, v)}
          />
        ))}

        {meta.fields.length === 0 && (
          <p className={cx('text-xs', t.textMuted)}>This node has nothing to configure.</p>
        )}

        {step && <NodeOutput step={step} />}
      </div>
    </div>
  );
}

function NodeOutput({ step }) {
  const { t } = useTheme();
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <GroupLabel>Last output</GroupLabel>
        <span className={cx('text-[10px] tabular-nums', t.textMuted)}>{plural(step.items, 'item')} · {fmtMs(step.ms)}</span>
      </div>
      {step.error && (
        <Banner accent="red" icon={AlertCircle} className="mb-2">{step.error}</Banner>
      )}
      <pre className={cx('text-[10px] font-mono rounded-lg border p-2 overflow-auto max-h-56 whitespace-pre-wrap',
        t.bgInput, t.borderLight, t.textSecondary)}>
        {JSON.stringify(step.output || {}, null, 2)}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Config field renderers
 * ------------------------------------------------------------------ */

function ConfigField({ spec, value, lookup, onChange }) {
  const { t } = useTheme();
  const expr = hasExpression(value);

  if (spec.type === 'conditions') {
    return (
      <Field label={spec.label} hint={`${countRows(value)} conditions · ${summarize(value)}`}>
        <ConditionGroupEditor
          group={isGroup(value) ? value : emptyGroup('all')}
          path={[]}
          depth={0}
          onUpdate={(path, fn) => onChange(updateAt(isGroup(value) ? value : emptyGroup('all'), path, fn))}
          onRemove={(path) => onChange(removeAt(isGroup(value) ? value : emptyGroup('all'), path))}
          onAppend={(path, item) => onChange(appendAt(isGroup(value) ? value : emptyGroup('all'), path, item))}
        />
      </Field>
    );
  }

  if (spec.type === 'cases') {
    return <CasesEditor label={spec.label} cases={Array.isArray(value) ? value : EMPTY} onChange={onChange} />;
  }

  if (spec.type === 'toggle') {
    return (
      <div className={cx('rounded-lg border px-3 py-2', t.bgCard, t.borderLight)}>
        <div className="flex items-center justify-between gap-3">
          <span className={cx('text-sm', t.textSecondary)}>{spec.label}</span>
          <Toggle accent="sky" checked={!!value} onChange={onChange} />
        </div>
        {spec.hint && <p className={cx('text-[11px] mt-1', t.textMuted)}>{spec.hint}</p>}
      </div>
    );
  }

  if (spec.type === 'multi') {
    const selected = Array.isArray(value) ? value : EMPTY;
    return (
      <Field label={spec.label} hint={spec.hint}>
        <div className={cx('rounded-lg border p-2 space-y-1', t.bgInput, t.borderLight)}>
          {(spec.options || []).map(o => (
            <Checkbox
              key={o}
              accent="sky"
              label={o}
              checked={selected.includes(o)}
              onChange={(on) => onChange(on ? [...selected, o] : selected.filter(v => v !== o))}
            />
          ))}
        </div>
      </Field>
    );
  }

  if (spec.type === 'tags') {
    return <TagsEditor label={spec.label} values={Array.isArray(value) ? value : EMPTY} onChange={onChange} />;
  }

  if (spec.type === 'kv') {
    return <PairsEditor label={spec.label} pairs={Array.isArray(value) ? value : EMPTY} onChange={onChange} />;
  }

  if (spec.type === 'ref') {
    const options = lookup.options(spec.from);
    return (
      <Field label={spec.label} hint={options.length === 0 ? 'Nothing to pick from yet — this collection is empty.' : spec.hint}>
        <Select
          accent="sky"
          value={value || ''}
          placeholder="Not set"
          onChange={(e) => onChange(e.target.value || undefined)}
          options={withCurrent(options, value)}
        />
      </Field>
    );
  }

  if (spec.type === 'select') {
    return (
      <Field label={spec.label} hint={spec.hint}>
        <Select accent="sky" value={value || ''} placeholder="Not set" onChange={(e) => onChange(e.target.value)}
          options={(spec.options || []).map(o => ({ value: o, label: o }))} />
      </Field>
    );
  }

  if (spec.type === 'field') {
    return (
      <Field label={spec.label} hint={spec.hint}>
        <FieldPicker value={value} onChange={onChange} />
      </Field>
    );
  }

  if (spec.type === 'number') {
    return (
      <Field label={spec.label} hint={spec.hint}>
        <Input accent="sky" type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
      </Field>
    );
  }

  if (spec.type === 'code') {
    return (
      <Field label={spec.label} hint="Runs once per batch. Return the items you want to pass on.">
        <Textarea accent="sky" rows={6} className="font-mono text-xs" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }

  if (spec.type === 'textarea') {
    return (
      <Field label={<ExprLabel label={spec.label} expr={expr} />} hint={spec.hint}>
        <Textarea accent="sky" rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} />
        {expr && <ExprPreview value={value} />}
      </Field>
    );
  }

  return (
    <Field label={<ExprLabel label={spec.label} expr={expr} />} hint={spec.hint}>
      <Input accent="sky" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      {expr && <ExprPreview value={value} />}
    </Field>
  );
}

function ExprLabel({ label, expr }) {
  const { a } = useTheme();
  const c = a('violet');
  return (
    <span className="flex items-center gap-1.5">
      {label}
      {expr && <span className={cx('px-1 rounded text-[9px] font-bold uppercase tracking-wider', c.soft, c.fgOnSoft)}>fx</span>}
    </span>
  );
}

function ExprPreview({ value }) {
  const { t } = useTheme();
  return (
    <p className={cx('text-[10px] mt-1 truncate font-mono', t.textMuted)} title={renderExpr(value)}>
      → {renderExpr(value)}
    </p>
  );
}

function withCurrent(options, value) {
  if (!value || options.some(o => o.value === value)) return options;
  return [...options, { value, label: value }];
}

function TagsEditor({ label, values, onChange }) {
  const { t } = useTheme();
  const [draft, setDraft] = useState('');
  return (
    <Field label={label} hint="Enter adds a label. Labels are how later nodes and views find these records.">
      <div className={cx('rounded-lg border p-2 space-y-2', t.bgInput, t.borderLight)}>
        <div className="flex flex-wrap gap-1">
          {values.map(v => (
            <Chip key={v} accent="purple" onRemove={() => onChange(values.filter(x => x !== v))}>{v}</Chip>
          ))}
          {values.length === 0 && <span className={cx('text-xs', t.textMuted)}>No labels yet.</span>}
        </div>
        <Input
          accent="purple"
          value={draft}
          placeholder="Add a label…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              onChange([...values, draft.trim()]);
              setDraft('');
            }
          }}
        />
      </div>
    </Field>
  );
}

function PairsEditor({ label, pairs, onChange }) {
  const { t } = useTheme();
  return (
    <Field label={label}>
      <div className="space-y-1.5">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input accent="sky" className="flex-1" value={p.name || ''} placeholder="field"
              onChange={(e) => onChange(pairs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input accent="sky" className="flex-1" value={p.value || ''} placeholder="value or expression"
              onChange={(e) => onChange(pairs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <IconButton icon={X} label="Remove field" accent="red" size={ICON.sm}
              onClick={() => onChange(pairs.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button size="xs" variant="soft" accent="sky" icon={Plus} onClick={() => onChange([...pairs, { name: '', value: '' }])}>
          Field
        </Button>
        {pairs.length === 0 && <p className={cx('text-xs', t.textMuted)}>No fields set — items pass through unchanged.</p>}
      </div>
    </Field>
  );
}

function CasesEditor({ label, cases, onChange }) {
  const { t } = useTheme();
  return (
    <Field label={label} hint="Each case draws its own output on the node.">
      <div className="space-y-1.5">
        {cases.map((c, i) => (
          <div key={c.id || i} className={cx('flex items-center gap-1.5 rounded-lg border p-1.5', t.bgCard, t.borderLight)}>
            <Input accent="violet" className="flex-1" value={c.label || ''} placeholder="Output name"
              onChange={(e) => onChange(cases.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input accent="violet" className="flex-1" value={c.value || ''} placeholder="equals value"
              onChange={(e) => onChange(cases.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <IconButton icon={X} label="Remove case" accent="red" size={ICON.sm}
              onClick={() => onChange(cases.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button size="xs" variant="soft" accent="violet" icon={Plus}
          onClick={() => onChange([...cases, { id: uid('case'), label: `Case ${cases.length + 1}`, value: '' }])}>
          Case
        </Button>
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ *
 * Condition builder — the shared engine from '@/lib/conditions.js'
 * ------------------------------------------------------------------ */

function isGroup(node) {
  return !!node && Array.isArray(node.rows);
}

function updateAt(group, path, fn) {
  if (path.length === 0) return fn(group);
  const [i, ...rest] = path;
  const rows = [...(group.rows || [])];
  rows[i] = updateAt(rows[i], rest, fn);
  return { ...group, rows };
}

function removeAt(group, path) {
  if (path.length === 0) return group;
  const [i, ...rest] = path;
  const rows = [...(group.rows || [])];
  if (rest.length === 0) rows.splice(i, 1);
  else rows[i] = removeAt(rows[i], rest);
  return { ...group, rows };
}

function appendAt(group, path, item) {
  if (path.length === 0) return { ...group, rows: [...(group.rows || []), item] };
  const [i, ...rest] = path;
  const rows = [...(group.rows || [])];
  rows[i] = appendAt(rows[i], rest, item);
  return { ...group, rows };
}

function ConditionGroupEditor({ group, path, depth, onUpdate, onRemove, onAppend }) {
  const { t, a } = useTheme();
  const c = a('violet');
  const rows = group.rows || [];
  const mode = group.match === 'any' ? 'any' : 'all';

  return (
    <div className={cx('rounded-lg border', depth === 0 ? cx(t.bgCard, t.borderLight) : cx(c.soft, c.border))}>
      <div className="flex items-center justify-between gap-1.5 px-2 py-1.5">
        <div className={cx('inline-flex gap-0.5 p-0.5 rounded-md', t.bgSubtle)}>
          {['all', 'any'].map(m => (
            <button
              key={m}
              onClick={() => onUpdate(path, (g) => ({ ...g, match: m }))}
              className={cx('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                mode === m ? cx(t.bgCard, c.fg, 'shadow-sm') : t.textMuted)}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon={Plus} label="Add condition" size={ICON.sm} accent="violet"
            onClick={() => onAppend(path, defaultRowFor(FIELDS[0].id))} />
          <IconButton icon={Split} label="Add nested group" size={ICON.sm}
            onClick={() => onAppend(path, { match: mode === 'all' ? 'any' : 'all', rows: [defaultRowFor(FIELDS[0].id)] })} />
          {depth > 0 && <IconButton icon={X} label="Remove group" size={ICON.sm} accent="red" onClick={() => onRemove(path)} />}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={cx('px-2 pb-2 text-[11px]', t.textMuted)}>
          No conditions — every item matches. Leave it open only if you mean it.
        </p>
      ) : (
        <div className="px-1.5 pb-1.5 space-y-1">
          {rows.map((row, i) => (
            <div key={i}>
              {i > 0 && <p className={cx('text-[9px] font-bold uppercase tracking-wider px-1 py-0.5', t.textMuted)}>{mode === 'all' ? 'and' : 'or'}</p>}
              {isGroup(row) ? (
                <ConditionGroupEditor
                  group={row}
                  path={[...path, i]}
                  depth={depth + 1}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  onAppend={onAppend}
                />
              ) : (
                <ConditionRowEditor row={row} path={[...path, i]} onUpdate={onUpdate} onRemove={onRemove} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Automations can test paths the declared FIELDS catalogue does not carry —
 * `answers.csatScore`, `sla.minutesToBreach` — because the item flowing through
 * a workflow is richer than a ticket record. When the field is unknown we infer
 * its type from the operator already on the row, so the operator picker offers
 * the right family instead of silently resetting to text.
 */
function inferType(row, field) {
  if (field?.type) return field.type;
  for (const [type, ops] of Object.entries(OPERATORS)) {
    if (ops.some(o => o.op === row.op)) return type;
  }
  return 'text';
}

function ConditionRowEditor({ row, path, onUpdate, onRemove }) {
  const { t } = useTheme();
  const field = FIELD_BY_ID[row.field];
  const type = inferType(row, field);
  const ops = operatorsFor(type);
  const opMeta = ALL_OPERATORS[row.op] || ops[0];

  return (
    <div className={cx('rounded-lg border p-1.5 space-y-1', t.bgCard, t.borderLight)}>
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <FieldPicker value={row.field} onChange={(id) => onUpdate(path, () => defaultRowFor(id))} />
        </div>
        <IconButton icon={X} label="Remove condition" size={ICON.sm} accent="red" onClick={() => onRemove(path)} />
      </div>
      <div className="flex items-center gap-1">
        <Select
          accent="violet"
          className="flex-1"
          value={row.op}
          onChange={(e) => onUpdate(path, (r) => ({ ...r, op: e.target.value, value: coerceValue(r.value, e.target.value) }))}
          options={ops.map(o => ({ value: o.op, label: o.label }))}
        />
        {isNullary(row.op) ? (
          <span className={cx('text-[10px] italic flex-1 px-1', t.textMuted)}>no value</span>
        ) : opMeta?.multi ? (
          <Input
            accent="violet"
            className="flex-1"
            value={(Array.isArray(row.value) ? row.value : [row.value]).filter(Boolean).join(', ')}
            placeholder="a, b, c"
            onChange={(e) => onUpdate(path, (r) => ({ ...r, value: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
          />
        ) : field?.options ? (
          <Select accent="violet" className="flex-1" value={row.value ?? ''}
            onChange={(e) => onUpdate(path, (r) => ({ ...r, value: e.target.value }))}
            options={field.options.map(o => ({ value: o, label: o }))} />
        ) : (
          <Input
            accent="violet"
            className="flex-1"
            value={row.value ?? ''}
            onChange={(e) => onUpdate(path, (r) => ({ ...r, value: type === 'number' ? Number(e.target.value) : e.target.value }))}
          />
        )}
      </div>
    </div>
  );
}

function coerceValue(value, op) {
  const meta = ALL_OPERATORS[op] || {};
  if (meta.nullary) return undefined;
  if (meta.multi) return Array.isArray(value) ? value : (value == null || value === '' ? [] : [value]);
  if (Array.isArray(value)) return value[0] ?? '';
  return value;
}

const FIELD_GROUPS = FIELDS.reduce((acc, f) => {
  (acc[f.group] ||= []).push(f);
  return acc;
}, {});

function FieldPicker({ value, onChange }) {
  const known = !!FIELD_BY_ID[value];
  return (
    <Select accent="violet" value={value || ''} onChange={(e) => onChange(e.target.value)}>
      {!known && value && (
        <optgroup label="Run-time field">
          <option value={value}>{value}</option>
        </optgroup>
      )}
      {Object.entries(FIELD_GROUPS).map(([group, list]) => (
        <optgroup key={group} label={group}>
          {list.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </optgroup>
      ))}
    </Select>
  );
}

/* ==================================================================== *
 * EXECUTION LOG
 * ==================================================================== */

function ExecutionLog({ open, onToggle, tab, onTab, run, history, onSelectNode }) {
  const { t, a } = useTheme();
  const [pastId, setPastId] = useState(null);
  const past = history.find(r => r.id === pastId) || null;

  const summary = useMemo(() => {
    if (!run || !run.steps?.length) return null;
    const done = run.steps.slice(0, run.cursor);
    return {
      ms: done.reduce((n, s) => n + (s.ms || 0), 0),
      errors: done.filter(s => s.status === 'error').length,
      items: done.reduce((n, s) => Math.max(n, s.items || 0), 0),
      total: run.steps.length,
      done: done.length,
    };
  }, [run]);

  return (
    <div className={cx('border-t flex-shrink-0 flex flex-col', t.border, t.bgSidebar)} style={{ height: open ? 232 : 40 }}>
      <div className={cx('h-10 flex items-center gap-2 px-3 flex-shrink-0', open && cx('border-b', t.border))}>
        <IconButton icon={open ? ChevronDown : ChevronUp} label={open ? 'Collapse log' : 'Expand log'} onClick={onToggle} />
        <SubTabs
          value={tab}
          onChange={onTab}
          items={[
            { value: 'run', label: 'This run', icon: Zap, accent: 'sky' },
            { value: 'history', label: 'History', icon: History, accent: 'violet', count: history.length },
          ]}
        />
        <div className="flex-1" />
        {run?.error && <span className={cx('text-xs', a('red').fg)}>{run.error}</span>}
        {summary && (
          <div className="flex items-center gap-2">
            <StatusPill status={run.playing ? 'running' : summary.errors ? 'error' : 'success'} />
            <span className={cx('text-xs tabular-nums', t.textMuted)}>
              {summary.done}/{summary.total} nodes · {plural(summary.items, 'item')} · {fmtMs(summary.ms)}
            </span>
          </div>
        )}
      </div>

      {open && (
        <div className="flex-1 min-h-0 overflow-hidden flex">
          {tab === 'run' ? (
            <RunBreakdown run={run} onSelectNode={onSelectNode} />
          ) : (
            <>
              <div className={cx('w-72 flex-shrink-0 border-r overflow-auto', t.border)}>
                {history.length === 0 && <p className={cx('text-xs p-3', t.textMuted)}>No executions recorded yet.</p>}
                {history.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setPastId(r.id)}
                    className={cx('w-full flex items-center gap-2 px-3 py-2 text-left border-b transition-colors',
                      t.borderLight, pastId === r.id ? t.bgActive : t.bgHover)}
                  >
                    <StatusPill status={r.status} />
                    <span className="min-w-0 flex-1">
                      <span className={cx('text-xs block truncate', t.text)}>{r.trigger}</span>
                      <span className={cx('text-[10px] block', t.textMuted)}>
                        {relTime(r.startedAt)} · {clockTime(r.startedAt)} · {fmtMs(r.durationMs)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex-1 min-w-0 overflow-auto">
                {past ? (
                  <PastRunSteps run={past} onSelectNode={onSelectNode} />
                ) : (
                  <p className={cx('text-xs p-3', t.textMuted)}>Pick an execution to see its node-by-node breakdown.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RunBreakdown({ run, onSelectNode }) {
  const { t } = useTheme();
  const [openId, setOpenId] = useState(null);

  if (!run) {
    return (
      <div className={cx('flex-1 flex items-center justify-center text-xs gap-2', t.textMuted)}>
        <Play size={ICON.base} /> Press <strong className={t.text}>Test workflow</strong> to walk the graph with the sample item.
      </div>
    );
  }
  if (run.error) {
    return (
      <div className="flex-1 p-3">
        <Banner accent="amber" icon={AlertCircle} title="Nothing to run">{run.error}</Banner>
      </div>
    );
  }

  const shown = run.steps.map((s, i) => ({
    ...s,
    live: i < run.cursor ? s.status : i === run.cursor && run.playing ? 'running' : 'waiting',
  }));
  const open = shown.find(s => s.nodeId === openId) || null;

  return (
    <>
      <div className="flex-1 min-w-0 overflow-auto">
        <div className={cx('divide-y', t.borderLight)}>
          {shown.map(s => (
            <button
              key={s.nodeId}
              onClick={() => { setOpenId(s.nodeId); onSelectNode(s.nodeId); }}
              className={cx('w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
                openId === s.nodeId ? t.bgActive : t.bgHover)}
            >
              <StatusPill status={s.live} />
              <span className={cx('text-xs flex-1 min-w-0 truncate', t.text)}>{s.name}</span>
              {s.branch && <Chip accent="violet">{s.branch}</Chip>}
              <span className={cx('text-[10px] tabular-nums w-16 text-right', t.textMuted)}>
                {s.live === 'waiting' ? '—' : plural(s.items, 'item')}
              </span>
              <span className={cx('text-[10px] tabular-nums w-14 text-right', t.textMuted)}>
                {s.live === 'waiting' ? '—' : fmtMs(s.ms)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className={cx('w-80 flex-shrink-0 border-l overflow-auto p-2', t.border)}>
        {open ? (
          <>
            <div className="flex items-center justify-between mb-1.5">
              <GroupLabel>{open.name}</GroupLabel>
              <StatusPill status={open.status} />
            </div>
            {open.error && <Banner accent="red" icon={AlertCircle} className="mb-2">{open.error}</Banner>}
            {open.note && <p className={cx('text-[11px] mb-2', t.textMuted)}>{open.note}</p>}
            <pre className={cx('text-[10px] font-mono rounded-lg border p-2 whitespace-pre-wrap', t.bgInput, t.borderLight, t.textSecondary)}>
              {JSON.stringify(open.output || {}, null, 2)}
            </pre>
          </>
        ) : (
          <p className={cx('text-xs', t.textMuted)}>Pick a node to see the JSON it produced.</p>
        )}
      </div>
    </>
  );
}

function PastRunSteps({ run, onSelectNode }) {
  const { t, a } = useTheme();
  return (
    <div>
      <div className={cx('flex items-center gap-2 px-3 py-2 border-b', t.borderLight)}>
        <StatusPill status={run.status} />
        <span className={cx('text-xs flex-1 min-w-0 truncate', t.text)}>{run.trigger}</span>
        <Chip accent="gray">{run.mode}</Chip>
        <span className={cx('text-[11px] tabular-nums', t.textMuted)}>{fmtMs(run.durationMs)}</span>
      </div>
      {run.error && (
        <div className="p-2">
          <Banner accent="red" icon={AlertCircle}>{run.error}</Banner>
        </div>
      )}
      <div className={cx('divide-y', t.borderLight)}>
        {(run.steps || []).map(s => (
          <button
            key={s.nodeId}
            onClick={() => onSelectNode(s.nodeId)}
            className={cx('w-full flex items-center gap-2 px-3 py-1.5 text-left', t.bgHover)}
          >
            <StatusPill status={s.status} />
            <span className={cx('text-xs flex-1 min-w-0 truncate', t.text)}>{s.name}</span>
            {s.error && <span className={cx('text-[10px] truncate max-w-[16rem]', a('red').fg)}>{s.error}</span>}
            <span className={cx('text-[10px] tabular-nums w-16 text-right', t.textMuted)}>{plural(s.items, 'item')}</span>
            <span className={cx('text-[10px] tabular-nums w-14 text-right', t.textMuted)}>{fmtMs(s.ms)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
