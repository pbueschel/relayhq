/**
 * Automation seed — five production-shaped workflows for Northwind Systems.
 *
 * SHAPE (the contract with src/views/Automations.jsx)
 * --------------------------------------------------
 *   automation := {
 *     id, name, description, active, ownerId, audience, tags,
 *     createdAt, updatedAt,
 *     stats:  { runs7d, errors7d, avgMs, lastRunAt },
 *     sample: the item that "Test workflow" runs with — a real-looking $json,
 *             plus `__now` so date operators in the condition engine resolve
 *             against the demo clock rather than the wall clock,
 *     nodes:  [ { id, type, name, x, y, config, disabled?, demo? } ],
 *     connections: [ { id, from, fromPort, to, toPort } ],
 *   }
 *
 * `demo` is the only non-production field: it lets the seed pin the item count,
 * duration and outcome a node produces in a test run, so the demo run is
 * believable AND deterministic instead of random. One node — the PagerDuty HTTP
 * call in BREACH_ESCALATE — is pinned to `outcome: 'error'` on purpose, because
 * a workflow canvas that can only ever show green never shows you what a failed
 * branch looks like.
 *
 * Node positions are laid out left-to-right on the canvas grid (18px dots, the
 * editor snaps to 10). Sticky notes are nodes of type `util.sticky`, exactly as
 * they are in n8n, so they move, copy and delete with everything else.
 *
 * Cross-domain ids come from ./ids.js. Never spell another domain's id here.
 */

import { AUTO, Q, USR, SF, POL, CRS, CUR, SLA, ORG } from './ids.js';

/* ==================================================================== *
 * 1. TRIAGE — the flow every support team writes first.
 *
 * A ticket lands, and the question is only ever "does this one jump the
 * queue?". VIP contacts and Enterprise-plan organisations do; everything else
 * goes to General for human triage, and the false branch says so out loud
 * rather than leaving the ticket unrouted.
 * ==================================================================== */

const TRIAGE = {
  id: AUTO.TRIAGE,
  name: 'Triage — VIP and Enterprise fast path',
  description: 'Every inbound customer ticket is checked for VIP contact or Enterprise plan. Matches are raised to urgent, pinned to Customer Support and paged to the on-call lead. Everything else lands in General for human triage.',
  active: true,
  ownerId: USR.LISA,
  audience: 'external',
  tags: ['support', 'routing', 'sla'],
  createdAt: '2026-03-04T10:12:00',
  updatedAt: '2026-08-14T16:20:00',
  stats: { runs7d: 214, errors7d: 2, avgMs: 940, lastRunAt: '2026-08-16T08:41:12' },
  sample: {
    __now: '2026-08-16T09:00:00',
    ticket: {
      key: 'TIC-4821',
      title: 'Checkout returns a 500 on the payment step',
      description: 'Customers on the hosted checkout see a 500 after entering card details. Started around 07:20 CT.',
      priority: 'high',
      status: 'open',
      source: 'portal',
      queueId: Q.SUPPORT,
      labels: ['storefront', 'payments'],
    },
    requester: { name: 'Dana Whitmore', email: 'dana.w@lumenretail.example', vip: true, isExternal: true, department: 'Customer' },
    org: { id: ORG.LUMEN, name: 'Lumen Retail Group', plan: 'Enterprise', slaId: SLA.ENTERPRISE },
  },
  nodes: [
    {
      id: 'tri-note',
      type: 'util.sticky',
      name: 'Note',
      x: 40, y: 60, w: 300, h: 104,
      config: {
        hue: 'amber',
        text: 'Runs AFTER form routing. A ticket already has a queue when it gets here — this flow only overrides it for the fast path.',
      },
    },
    {
      id: 'tri-trigger',
      type: 'trigger.ticketCreated',
      name: 'Ticket Created',
      x: 60, y: 220,
      config: { queueId: Q.SUPPORT, sources: ['portal', 'email', 'chat'], audience: 'external' },
      demo: { items: 1, ms: 14 },
    },
    {
      id: 'tri-if',
      type: 'logic.if',
      name: 'VIP or Enterprise?',
      x: 340, y: 220,
      config: {
        conditions: {
          match: 'any',
          rows: [
            { field: 'requester.vip', op: 'is_true' },
            { field: 'org.plan', op: 'is', value: 'Enterprise' },
          ],
        },
      },
      demo: { ms: 26 },
    },
    {
      id: 'tri-priority',
      type: 'action.setPriority',
      name: 'Raise to urgent',
      x: 640, y: 120,
      config: { priority: 'urgent', reason: 'VIP / Enterprise fast path — {{ $json.org.name }}' },
      demo: { ms: 118 },
    },
    {
      id: 'tri-queue',
      type: 'action.assignQueue',
      name: 'Pin to Customer Support',
      x: 920, y: 120,
      config: { queueId: Q.SUPPORT, assigneeId: USR.LISA, note: 'Assigned to the team lead so it is never left in the pool.' },
      demo: { ms: 96 },
    },
    {
      id: 'tri-notify',
      type: 'action.notify',
      name: 'Page the on-call lead',
      x: 1200, y: 120,
      config: {
        channel: 'slack',
        target: '#support-escalations',
        message: 'Urgent {{ $json.org.plan }} ticket {{ $json.ticket.key }} — {{ $json.ticket.title }}',
      },
      demo: { ms: 402 },
    },
    {
      id: 'tri-general',
      type: 'action.assignQueue',
      name: 'Assign to General',
      x: 640, y: 330,
      config: { queueId: Q.GENERAL, note: 'Human triage within one business hour.' },
      demo: { ms: 88 },
    },
  ],
  connections: [
    { id: 'tri-c1', from: 'tri-trigger', fromPort: 'main', to: 'tri-if', toPort: 'main' },
    { id: 'tri-c2', from: 'tri-if', fromPort: 'true', to: 'tri-priority', toPort: 'main' },
    { id: 'tri-c3', from: 'tri-priority', fromPort: 'main', to: 'tri-queue', toPort: 'main' },
    { id: 'tri-c4', from: 'tri-queue', fromPort: 'main', to: 'tri-notify', toPort: 'main' },
    { id: 'tri-c5', from: 'tri-if', fromPort: 'false', to: 'tri-general', toPort: 'main' },
  ],
};

/* ==================================================================== *
 * 2. ONBOARDING — the flow that proves the three products are one product.
 *
 * A People Ops intake form starts an approval, fans out provisioning work by
 * department, runs facilities and payroll in parallel, and finishes by
 * enrolling the new starter in the curriculum that teaches their job function.
 * Service management, work management and training in one graph.
 * ==================================================================== */

const ONBOARDING = {
  id: AUTO.ONBOARDING,
  name: 'New hire onboarding',
  description: 'New Hire form → hiring-manager approval → department-specific provisioning tasks, facilities and payroll in parallel, then automatic enrolment in the role curriculum with a 14-day due date.',
  active: true,
  ownerId: USR.PATTI,
  audience: 'internal',
  tags: ['people-ops', 'provisioning', 'training'],
  createdAt: '2026-01-19T09:40:00',
  updatedAt: '2026-08-11T11:05:00',
  stats: { runs7d: 6, errors7d: 0, avgMs: 3120, lastRunAt: '2026-08-14T13:02:44' },
  sample: {
    __now: '2026-08-16T09:00:00',
    ticket: { key: 'REQ-2290', title: 'New hire — Rosa Delgado (Support Agent)', status: 'open', subformId: SF.NEW_HIRE, queueId: Q.PEOPLE, labels: ['onboarding'] },
    requester: { name: 'Lisa Park', email: 'lisa.p@northwind.example', department: 'Support', vip: false, isExternal: false },
    answers: { startDate: '2026-09-01', amount: 2450, quantity: 1, accessLevel: 'write' },
    hire: { name: 'Rosa Delgado', title: 'Support Agent', department: 'Support', manager: 'Lisa Park', site: 'Austin' },
  },
  nodes: [
    {
      id: 'onb-note',
      type: 'util.sticky',
      name: 'Note',
      x: 40, y: 100, w: 300, h: 112,
      config: {
        hue: 'violet',
        text: 'Approval is blocking on purpose. Nothing is provisioned and no licence is bought until the hiring manager has said yes.',
      },
    },
    {
      id: 'onb-note-2',
      type: 'util.sticky',
      name: 'Note',
      x: 1440, y: 130, w: 280, h: 96,
      config: {
        hue: 'indigo',
        text: 'Enrolment is the training platform doing service management’s job: day one, the curriculum is already waiting.',
      },
    },
    {
      id: 'onb-form',
      type: 'trigger.ticketCreated',
      name: 'Form Submitted — New Hire',
      x: 60, y: 300,
      config: { subformId: SF.NEW_HIRE, queueId: Q.PEOPLE, sources: ['portal'], audience: 'internal' },
      demo: { items: 1, ms: 18 },
    },
    {
      id: 'onb-approval',
      type: 'action.startApproval',
      name: 'Hiring manager approval',
      x: 330, y: 300,
      config: { policyId: POL.NEW_HIRE, waitForDecision: true, dueDays: 2, note: 'Approve start date, seat and equipment budget.' },
      demo: { ms: 640 },
    },
    {
      id: 'onb-switch',
      type: 'logic.switch',
      name: 'Route by department',
      x: 620, y: 290,
      config: {
        field: 'requester.department',
        fallback: true,
        cases: [
          { id: 'eng', label: 'Product', value: 'Product' },
          { id: 'sales', label: 'Sales', value: 'Sales' },
          { id: 'support', label: 'Support', value: 'Support' },
        ],
      },
      demo: { ms: 22 },
    },
    {
      id: 'onb-eng',
      type: 'action.createTask',
      name: 'Build engineering laptop',
      x: 900, y: 120,
      config: { title: 'Build engineering laptop + repo access for {{ $json.hire.name }}', queueId: Q.IT, assigneeId: USR.EMMA, dueDays: 5, priority: 'high' },
      demo: { ms: 140 },
    },
    {
      id: 'onb-sales',
      type: 'action.createTask',
      name: 'Build sales laptop + CRM seat',
      x: 900, y: 232,
      config: { title: 'Build sales laptop and provision CRM seat for {{ $json.hire.name }}', queueId: Q.IT, assigneeId: USR.EMMA, dueDays: 5, priority: 'high' },
      demo: { ms: 132 },
    },
    {
      id: 'onb-support',
      type: 'action.createTask',
      name: 'Build support workstation',
      x: 900, y: 344,
      config: { title: 'Build support workstation + Storefront sandbox for {{ $json.hire.name }}', queueId: Q.IT, assigneeId: USR.DEVON, dueDays: 5, priority: 'high' },
      demo: { ms: 138 },
    },
    {
      id: 'onb-other',
      type: 'action.createTask',
      name: 'Standard workstation build',
      x: 900, y: 456,
      config: { title: 'Standard workstation build for {{ $json.hire.name }}', queueId: Q.IT, assigneeId: USR.EMMA, dueDays: 5, priority: 'medium' },
      demo: { ms: 128 },
    },
    {
      id: 'onb-facilities',
      type: 'action.createTask',
      name: 'Desk, badge and parking',
      x: 1180, y: 280,
      config: { title: 'Desk, badge and parking at {{ $json.hire.site }}', queueId: Q.FACILITIES, assigneeId: USR.LINDA, dueDays: 7, priority: 'medium' },
      demo: { ms: 152 },
    },
    {
      id: 'onb-people',
      type: 'action.createTask',
      name: 'Welcome pack and payroll',
      x: 1180, y: 540,
      config: { title: 'Welcome pack, payroll and benefits enrolment for {{ $json.hire.name }}', queueId: Q.PEOPLE, assigneeId: USR.PATTI, dueDays: 3, priority: 'high' },
      demo: { ms: 146 },
    },
    {
      id: 'onb-merge',
      type: 'logic.merge',
      name: 'Wait for both tracks',
      x: 1460, y: 400,
      config: { mode: 'append' },
      demo: { ms: 12 },
    },
    {
      id: 'onb-course',
      type: 'action.enrollCourse',
      name: 'Enrol in role curriculum',
      x: 1720, y: 400,
      config: { courseId: CRS.SUPPORT_FOUNDATIONS, curriculumId: CUR.SUPPORT_AGENT, dueDays: 14, notify: true },
      demo: { ms: 288 },
    },
  ],
  connections: [
    { id: 'onb-c1', from: 'onb-form', fromPort: 'main', to: 'onb-approval', toPort: 'main' },
    { id: 'onb-c2', from: 'onb-approval', fromPort: 'main', to: 'onb-switch', toPort: 'main' },
    { id: 'onb-c3', from: 'onb-switch', fromPort: 'eng', to: 'onb-eng', toPort: 'main' },
    { id: 'onb-c4', from: 'onb-switch', fromPort: 'sales', to: 'onb-sales', toPort: 'main' },
    { id: 'onb-c5', from: 'onb-switch', fromPort: 'support', to: 'onb-support', toPort: 'main' },
    { id: 'onb-c6', from: 'onb-switch', fromPort: 'fallback', to: 'onb-other', toPort: 'main' },
    { id: 'onb-c7', from: 'onb-eng', fromPort: 'main', to: 'onb-facilities', toPort: 'main' },
    { id: 'onb-c8', from: 'onb-sales', fromPort: 'main', to: 'onb-facilities', toPort: 'main' },
    { id: 'onb-c9', from: 'onb-support', fromPort: 'main', to: 'onb-facilities', toPort: 'main' },
    { id: 'onb-c10', from: 'onb-other', fromPort: 'main', to: 'onb-facilities', toPort: 'main' },
    { id: 'onb-c11', from: 'onb-approval', fromPort: 'main', to: 'onb-people', toPort: 'main' },
    { id: 'onb-c12', from: 'onb-facilities', fromPort: 'main', to: 'onb-merge', toPort: 'a' },
    { id: 'onb-c13', from: 'onb-people', fromPort: 'main', to: 'onb-merge', toPort: 'b' },
    { id: 'onb-c14', from: 'onb-merge', fromPort: 'main', to: 'onb-course', toPort: 'main' },
  ],
};

/* ==================================================================== *
 * 3. RENEWAL_ALERT — the asset flow. A weekly cron, a date filter, and a loop
 * that opens one renewal review per contract instead of one giant task.
 * ==================================================================== */

const RENEWAL_ALERT = {
  id: AUTO.RENEWAL_ALERT,
  name: 'Licence and contract renewal alerts',
  description: 'Every Monday morning, finds software licences and contracts renewing inside 60 days, opens a procurement review per asset, emails the owner, and posts a digest of the week’s renewals.',
  active: true,
  ownerId: USR.JAMES,
  audience: 'internal',
  tags: ['assets', 'procurement', 'finance'],
  createdAt: '2025-11-02T15:30:00',
  updatedAt: '2026-07-28T09:15:00',
  stats: { runs7d: 1, errors7d: 0, avgMs: 5210, lastRunAt: '2026-08-10T07:00:09' },
  sample: {
    __now: '2026-08-16T09:00:00',
    asset: {
      id: 'AST-0142',
      name: 'Figma Organization — 60 seats',
      kind: 'software',
      cost: 32400,
      renewalDate: '2026-09-24',
      ownerName: 'Mike Chen',
      vendor: 'Figma',
    },
    org: { name: 'Northwind Systems', plan: 'Enterprise' },
  },
  nodes: [
    {
      id: 'ren-note',
      type: 'util.sticky',
      name: 'Note',
      x: 40, y: 70, w: 300, h: 96,
      config: {
        hue: 'lime',
        text: '60 days is the notice period in most of our vendor contracts. Shorten it here and Finance loses its negotiating window.',
      },
    },
    {
      id: 'ren-cron',
      type: 'trigger.schedule',
      name: 'Every Monday 07:00',
      x: 60, y: 240,
      config: { cron: '0 7 * * 1', timezone: 'America/Chicago' },
      demo: { items: 1, ms: 8 },
    },
    {
      id: 'ren-filter',
      type: 'logic.filter',
      name: 'Renewal due within 60 days',
      x: 330, y: 240,
      config: {
        conditions: {
          match: 'all',
          rows: [
            { field: 'asset.renewalDate', op: 'within_days', value: 60 },
            { field: 'asset.cost', op: 'gte', value: 1000 },
          ],
        },
      },
      demo: { items: 7, ms: 210 },
    },
    {
      id: 'ren-loop',
      type: 'logic.loop',
      name: 'For each renewing asset',
      x: 600, y: 240,
      config: { batchSize: 1 },
      demo: { items: 7, ms: 34 },
    },
    {
      id: 'ren-task',
      type: 'action.createTask',
      name: 'Open renewal review',
      x: 880, y: 150,
      config: { title: 'Renewal review — {{ $json.asset.name }} ({{ $json.asset.vendor }})', queueId: Q.PROCUREMENT, assigneeId: USR.JAMES, dueDays: 14, priority: 'medium' },
      demo: { items: 7, ms: 480 },
    },
    {
      id: 'ren-notify',
      type: 'action.notify',
      name: 'Email the asset owner',
      x: 1160, y: 150,
      config: {
        channel: 'email',
        target: '{{ $json.asset.ownerName }}',
        subject: '{{ $json.asset.name }} renews on {{ $json.asset.renewalDate }}',
        message: 'Procurement has opened a review. Reply on the task if the seat count should change before we renew.',
      },
      demo: { items: 7, ms: 720 },
    },
    {
      id: 'ren-digest',
      type: 'action.notify',
      name: 'Post the weekly digest',
      x: 880, y: 370,
      config: { channel: 'slack', target: '#procurement', message: '{{ $json.count }} renewals inside 60 days this week. Total annualised value {{ $json.totalValue }}.' },
      demo: { items: 1, ms: 316 },
    },
  ],
  connections: [
    { id: 'ren-c1', from: 'ren-cron', fromPort: 'main', to: 'ren-filter', toPort: 'main' },
    { id: 'ren-c2', from: 'ren-filter', fromPort: 'main', to: 'ren-loop', toPort: 'main' },
    { id: 'ren-c3', from: 'ren-loop', fromPort: 'loop', to: 'ren-task', toPort: 'main' },
    { id: 'ren-c4', from: 'ren-task', fromPort: 'main', to: 'ren-notify', toPort: 'main' },
    { id: 'ren-c5', from: 'ren-notify', fromPort: 'main', to: 'ren-loop', toPort: 'main' },
    { id: 'ren-c6', from: 'ren-loop', fromPort: 'done', to: 'ren-digest', toPort: 'main' },
  ],
};

/* ==================================================================== *
 * 4. CSAT_FOLLOWUP — resolve, wait a day, ask, and act on the answer.
 * The false branch is a No-Op on purpose: a good score needs no work, and
 * saying that on the canvas is better than leaving a dangling output.
 * ==================================================================== */

const CSAT_FOLLOWUP = {
  id: AUTO.CSAT_FOLLOWUP,
  name: 'CSAT follow-up on low scores',
  description: 'A day after a ticket is resolved the requester gets a satisfaction survey. Scores of 3 or below open a coaching review for the team lead and post the verbatim back on the ticket; anything higher ends quietly.',
  active: true,
  ownerId: USR.LISA,
  audience: 'external',
  tags: ['support', 'quality', 'csat'],
  createdAt: '2026-02-11T14:05:00',
  updatedAt: '2026-08-09T10:44:00',
  stats: { runs7d: 96, errors7d: 1, avgMs: 1480, lastRunAt: '2026-08-15T18:12:03' },
  sample: {
    __now: '2026-08-16T09:00:00',
    ticket: { key: 'TIC-4776', title: 'Webhook retries stopped after the 3.2 release', status: 'resolved', queueId: Q.SUPPORT, resolvedBy: 'Devon Okafor', labels: ['api', 'webhooks'] },
    requester: { name: 'Ravi Menon', email: 'ravi.m@parkwaylogistics.example', vip: false, isExternal: true },
    org: { id: ORG.PARKWAY, name: 'Parkway Logistics', plan: 'Business', slaId: SLA.BUSINESS },
    answers: { csatScore: 2, csatComment: 'Fix worked, but I chased it for three days before anyone replied.' },
  },
  nodes: [
    {
      id: 'csat-note',
      type: 'util.sticky',
      name: 'Note',
      x: 40, y: 80, w: 290, h: 96,
      config: {
        hue: 'rose',
        text: 'One day is deliberate. Same-day surveys measure the last message, not whether the fix held.',
      },
    },
    {
      id: 'csat-resolved',
      type: 'trigger.ticketUpdated',
      name: 'Ticket resolved',
      x: 60, y: 240,
      config: { field: 'ticket.status', to: 'resolved', queueId: Q.SUPPORT },
      demo: { items: 1, ms: 11 },
    },
    {
      id: 'csat-wait',
      type: 'logic.wait',
      name: 'Wait 1 day',
      x: 320, y: 240,
      config: { amount: 1, unit: 'days' },
      demo: { ms: 6 },
    },
    {
      id: 'csat-survey',
      type: 'action.notify',
      name: 'Send the CSAT survey',
      x: 580, y: 240,
      config: {
        channel: 'email',
        target: '{{ $json.requester.email }}',
        subject: 'How did we do with {{ $json.ticket.key }}?',
        message: 'One question, five seconds: how satisfied are you with how we handled “{{ $json.ticket.title }}”?',
      },
      demo: { ms: 560 },
    },
    {
      id: 'csat-if',
      type: 'logic.if',
      name: 'Score 3 or lower?',
      x: 840, y: 240,
      config: {
        conditions: {
          match: 'all',
          rows: [
            { field: 'answers.csatScore', op: 'lte', value: 3 },
          ],
        },
      },
      demo: { ms: 18 },
    },
    {
      id: 'csat-task',
      type: 'action.createTask',
      name: 'Coaching review with the agent',
      x: 1120, y: 140,
      config: { title: 'CSAT {{ $json.answers.csatScore }}/5 on {{ $json.ticket.key }} — review with {{ $json.ticket.resolvedBy }}', queueId: Q.SUPPORT, assigneeId: USR.LISA, dueDays: 3, priority: 'high' },
      demo: { ms: 164 },
    },
    {
      id: 'csat-comment',
      type: 'action.postComment',
      name: 'Log the verbatim on the ticket',
      x: 1400, y: 140,
      config: { visibility: 'internal', body: 'CSAT {{ $json.answers.csatScore }}/5 — “{{ $json.answers.csatComment }}”' },
      demo: { ms: 92 },
    },
    {
      id: 'csat-noop',
      type: 'util.noop',
      name: 'No follow-up needed',
      x: 1120, y: 350,
      config: {},
      demo: { ms: 4 },
    },
  ],
  connections: [
    { id: 'csat-c1', from: 'csat-resolved', fromPort: 'main', to: 'csat-wait', toPort: 'main' },
    { id: 'csat-c2', from: 'csat-wait', fromPort: 'main', to: 'csat-survey', toPort: 'main' },
    { id: 'csat-c3', from: 'csat-survey', fromPort: 'main', to: 'csat-if', toPort: 'main' },
    { id: 'csat-c4', from: 'csat-if', fromPort: 'true', to: 'csat-task', toPort: 'main' },
    { id: 'csat-c5', from: 'csat-task', fromPort: 'main', to: 'csat-comment', toPort: 'main' },
    { id: 'csat-c6', from: 'csat-if', fromPort: 'false', to: 'csat-noop', toPort: 'main' },
  ],
};

/* ==================================================================== *
 * 5. BREACH_ESCALATE — the 15-minute sweep.
 *
 * This is the flow that carries the demo's deliberate failure: the PagerDuty
 * HTTP node is rate-limited, so the branch goes red while the approval branch
 * beside it still completes. That is the honest picture of a partial run.
 * ==================================================================== */

const BREACH_ESCALATE = {
  id: AUTO.BREACH_ESCALATE,
  name: 'SLA breach escalation sweep',
  description: 'Every 15 minutes, computes time-to-breach for open tickets, and for anything inside 30 minutes raises priority, alerts the queue, pages the duty engineer and starts an out-of-hours override approval.',
  active: true,
  ownerId: USR.ADMIN,
  audience: 'both',
  tags: ['sla', 'escalation', 'on-call'],
  createdAt: '2025-09-30T08:00:00',
  updatedAt: '2026-08-15T07:31:00',
  stats: { runs7d: 672, errors7d: 9, avgMs: 2260, lastRunAt: '2026-08-16T08:45:00' },
  sample: {
    __now: '2026-08-16T09:00:00',
    ticket: { key: 'TIC-4802', title: 'Bulk catalog import stalls at 40%', status: 'in_progress', priority: 'high', queueId: Q.SUPPORT, labels: ['import', 'enterprise'] },
    requester: { name: 'Owen Fitzgerald', email: 'owen.f@vireo.example', vip: false, isExternal: true },
    org: { id: ORG.VIREO, name: 'Vireo Health', plan: 'Enterprise', slaId: SLA.ENTERPRISE },
    sla: { policyId: SLA.ENTERPRISE, target: 'Resolution', minutesToBreach: 18, state: 'at_risk' },
  },
  nodes: [
    {
      id: 'brc-note',
      type: 'util.sticky',
      name: 'Note',
      x: 40, y: 90, w: 300, h: 104,
      config: {
        hue: 'red',
        text: 'The sweep is idempotent — a ticket already labelled escalated is filtered out, so a long breach does not page every 15 minutes.',
      },
    },
    {
      id: 'brc-cron',
      type: 'trigger.schedule',
      name: 'Every 15 minutes',
      x: 60, y: 260,
      config: { cron: '*/15 * * * *', timezone: 'America/Chicago' },
      demo: { items: 1, ms: 7 },
    },
    {
      id: 'brc-code',
      type: 'util.code',
      name: 'Compute time to breach',
      x: 320, y: 260,
      config: {
        language: 'javascript',
        code: 'for (const item of items) {\n  const due = new Date(item.json.sla.dueAt);\n  item.json.sla.minutesToBreach = Math.round((due - $now) / 60000);\n}\nreturn items;',
      },
      demo: { items: 46, ms: 88 },
    },
    {
      id: 'brc-filter',
      type: 'logic.filter',
      name: 'SLA at risk (under 30 min)',
      x: 580, y: 260,
      config: {
        conditions: {
          match: 'all',
          rows: [
            { field: 'ticket.status', op: 'is_one_of', value: ['open', 'in_progress', 'pending'] },
            { field: 'sla.minutesToBreach', op: 'lte', value: 30 },
            { field: 'ticket.labels', op: 'not_includes', value: 'escalated' },
          ],
        },
      },
      demo: { items: 3, ms: 132 },
    },
    {
      id: 'brc-notify',
      type: 'action.notify',
      name: 'Alert the queue channel',
      x: 850, y: 150,
      config: {
        channel: 'slack',
        target: '#sla-watch',
        message: '{{ $json.ticket.key }} breaches in {{ $json.sla.minutesToBreach }} min — {{ $json.org.name }} ({{ $json.org.plan }})',
      },
      demo: { items: 3, ms: 388 },
    },
    {
      id: 'brc-approval',
      type: 'action.startApproval',
      name: 'Out-of-hours override',
      x: 850, y: 380,
      config: { policyId: POL.EMERGENCY_CHANGE, waitForDecision: false, dueDays: 1, note: 'Authorise an out-of-hours engineering callout for this breach.' },
      demo: { items: 3, ms: 522 },
    },
    {
      id: 'brc-priority',
      type: 'action.setPriority',
      name: 'Raise to urgent',
      x: 1120, y: 60,
      config: { priority: 'urgent', reason: 'SLA breach in under 30 minutes' },
      demo: { items: 3, ms: 104 },
    },
    {
      id: 'brc-page',
      type: 'action.http',
      name: 'Page duty engineer (PagerDuty)',
      x: 1120, y: 190,
      config: {
        method: 'POST',
        url: 'https://events.pagerduty.com/v2/enqueue',
        body: '{ "routing_key": "{{ $env.PAGERDUTY_KEY }}", "event_action": "trigger", "payload": { "summary": "{{ $json.ticket.key }} SLA breach imminent" } }',
      },
      // The demo's deliberate failure — see the file header.
      demo: { items: 0, ms: 1240, outcome: 'error', error: 'PagerDuty returned 429 Too Many Requests (rate limit: 120/min)' },
    },
    {
      id: 'brc-comment',
      type: 'action.postComment',
      name: 'Log the escalation',
      x: 1120, y: 380,
      config: { visibility: 'internal', body: 'Escalated automatically — {{ $json.sla.minutesToBreach }} minutes to breach on the {{ $json.org.plan }} target.' },
      demo: { items: 3, ms: 96 },
    },
  ],
  connections: [
    { id: 'brc-c1', from: 'brc-cron', fromPort: 'main', to: 'brc-code', toPort: 'main' },
    { id: 'brc-c2', from: 'brc-code', fromPort: 'main', to: 'brc-filter', toPort: 'main' },
    { id: 'brc-c3', from: 'brc-filter', fromPort: 'main', to: 'brc-notify', toPort: 'main' },
    { id: 'brc-c4', from: 'brc-filter', fromPort: 'main', to: 'brc-approval', toPort: 'main' },
    { id: 'brc-c5', from: 'brc-notify', fromPort: 'main', to: 'brc-priority', toPort: 'main' },
    { id: 'brc-c6', from: 'brc-notify', fromPort: 'main', to: 'brc-page', toPort: 'main' },
    { id: 'brc-c7', from: 'brc-approval', fromPort: 'main', to: 'brc-comment', toPort: 'main' },
  ],
};

export const AUTOMATIONS = [TRIAGE, ONBOARDING, RENEWAL_ALERT, CSAT_FOLLOWUP, BREACH_ESCALATE];

/* ==================================================================== *
 * RUN HISTORY
 *
 * Eleven runs across the last week of the demo clock (2026-08-16). Mixed
 * outcomes, real node timings, real item counts — because an execution list
 * where everything succeeded teaches nobody how to read the panel.
 * ==================================================================== */

export const AUTOMATION_RUNS = [
  {
    id: 'run-8841',
    automationId: AUTO.TRIAGE,
    status: 'success',
    mode: 'trigger',
    trigger: 'TIC-4821 created — Lumen Retail Group (Enterprise)',
    startedAt: '2026-08-16T08:41:12',
    durationMs: 758,
    items: 1,
    steps: [
      { nodeId: 'tri-trigger', name: 'Ticket Created', status: 'success', ms: 14, items: 1 },
      { nodeId: 'tri-if', name: 'VIP or Enterprise?', status: 'success', ms: 26, items: 1, branch: 'true' },
      { nodeId: 'tri-priority', name: 'Raise to urgent', status: 'success', ms: 118, items: 1 },
      { nodeId: 'tri-queue', name: 'Pin to Customer Support', status: 'success', ms: 96, items: 1 },
      { nodeId: 'tri-notify', name: 'Page the on-call lead', status: 'success', ms: 504, items: 1 },
    ],
  },
  {
    id: 'run-8836',
    automationId: AUTO.BREACH_ESCALATE,
    status: 'error',
    mode: 'schedule',
    trigger: 'Schedule — 08:45 sweep',
    startedAt: '2026-08-16T08:45:00',
    durationMs: 2477,
    items: 3,
    error: 'PagerDuty returned 429 Too Many Requests',
    steps: [
      { nodeId: 'brc-cron', name: 'Every 15 minutes', status: 'success', ms: 7, items: 1 },
      { nodeId: 'brc-code', name: 'Compute time to breach', status: 'success', ms: 88, items: 46 },
      { nodeId: 'brc-filter', name: 'SLA at risk (under 30 min)', status: 'success', ms: 132, items: 3 },
      { nodeId: 'brc-notify', name: 'Alert the queue channel', status: 'success', ms: 388, items: 3 },
      { nodeId: 'brc-approval', name: 'Out-of-hours override', status: 'success', ms: 522, items: 3 },
      { nodeId: 'brc-priority', name: 'Raise to urgent', status: 'success', ms: 104, items: 3 },
      { nodeId: 'brc-page', name: 'Page duty engineer (PagerDuty)', status: 'error', ms: 1240, items: 0, error: 'PagerDuty returned 429 Too Many Requests (rate limit: 120/min)' },
      { nodeId: 'brc-comment', name: 'Log the escalation', status: 'success', ms: 96, items: 3 },
    ],
  },
  {
    id: 'run-8829',
    automationId: AUTO.CSAT_FOLLOWUP,
    status: 'success',
    mode: 'trigger',
    trigger: 'TIC-4776 resolved — Parkway Logistics',
    startedAt: '2026-08-15T18:12:03',
    durationMs: 1462,
    items: 1,
    steps: [
      { nodeId: 'csat-resolved', name: 'Ticket resolved', status: 'success', ms: 11, items: 1 },
      { nodeId: 'csat-wait', name: 'Wait 1 day', status: 'success', ms: 6, items: 1 },
      { nodeId: 'csat-survey', name: 'Send the CSAT survey', status: 'success', ms: 560, items: 1 },
      { nodeId: 'csat-if', name: 'Score 3 or lower?', status: 'success', ms: 18, items: 1, branch: 'true' },
      { nodeId: 'csat-task', name: 'Coaching review with the agent', status: 'success', ms: 164, items: 1 },
      { nodeId: 'csat-comment', name: 'Log the verbatim on the ticket', status: 'success', ms: 92, items: 1 },
    ],
  },
  {
    id: 'run-8815',
    automationId: AUTO.TRIAGE,
    status: 'success',
    mode: 'trigger',
    trigger: 'TIC-4808 created — Fernbrook Foods (Starter)',
    startedAt: '2026-08-15T11:07:44',
    durationMs: 191,
    items: 1,
    steps: [
      { nodeId: 'tri-trigger', name: 'Ticket Created', status: 'success', ms: 13, items: 1 },
      { nodeId: 'tri-if', name: 'VIP or Enterprise?', status: 'success', ms: 24, items: 1, branch: 'false' },
      { nodeId: 'tri-general', name: 'Assign to General', status: 'success', ms: 88, items: 1 },
      { nodeId: 'tri-priority', name: 'Raise to urgent', status: 'skipped', ms: 0, items: 0 },
      { nodeId: 'tri-queue', name: 'Pin to Customer Support', status: 'skipped', ms: 0, items: 0 },
      { nodeId: 'tri-notify', name: 'Page the on-call lead', status: 'skipped', ms: 0, items: 0 },
    ],
  },
  {
    id: 'run-8802',
    automationId: AUTO.CSAT_FOLLOWUP,
    status: 'error',
    mode: 'trigger',
    trigger: 'TIC-4751 resolved — Vireo Health',
    startedAt: '2026-08-14T16:38:20',
    durationMs: 812,
    items: 1,
    error: 'Mail relay rejected the recipient address',
    steps: [
      { nodeId: 'csat-resolved', name: 'Ticket resolved', status: 'success', ms: 10, items: 1 },
      { nodeId: 'csat-wait', name: 'Wait 1 day', status: 'success', ms: 5, items: 1 },
      { nodeId: 'csat-survey', name: 'Send the CSAT survey', status: 'error', ms: 797, items: 0, error: 'SMTP 550 — recipient mailbox unavailable (contact record has no verified email)' },
      { nodeId: 'csat-if', name: 'Score 3 or lower?', status: 'skipped', ms: 0, items: 0 },
      { nodeId: 'csat-task', name: 'Coaching review with the agent', status: 'skipped', ms: 0, items: 0 },
      { nodeId: 'csat-comment', name: 'Log the verbatim on the ticket', status: 'skipped', ms: 0, items: 0 },
      { nodeId: 'csat-noop', name: 'No follow-up needed', status: 'skipped', ms: 0, items: 0 },
    ],
  },
  {
    id: 'run-8788',
    automationId: AUTO.ONBOARDING,
    status: 'success',
    mode: 'trigger',
    trigger: 'REQ-2290 — Rosa Delgado (Support Agent)',
    startedAt: '2026-08-14T13:02:44',
    durationMs: 3196,
    items: 1,
    steps: [
      { nodeId: 'onb-form', name: 'Form Submitted — New Hire', status: 'success', ms: 18, items: 1 },
      { nodeId: 'onb-approval', name: 'Hiring manager approval', status: 'success', ms: 640, items: 1 },
      { nodeId: 'onb-switch', name: 'Route by department', status: 'success', ms: 22, items: 1, branch: 'support' },
      { nodeId: 'onb-support', name: 'Build support workstation', status: 'success', ms: 138, items: 1 },
      { nodeId: 'onb-people', name: 'Welcome pack and payroll', status: 'success', ms: 146, items: 1 },
      { nodeId: 'onb-facilities', name: 'Desk, badge and parking', status: 'success', ms: 152, items: 1 },
      { nodeId: 'onb-merge', name: 'Wait for both tracks', status: 'success', ms: 12, items: 2 },
      { nodeId: 'onb-course', name: 'Enrol in role curriculum', status: 'success', ms: 288, items: 1 },
    ],
  },
  {
    id: 'run-8774',
    automationId: AUTO.BREACH_ESCALATE,
    status: 'success',
    mode: 'schedule',
    trigger: 'Schedule — 09:15 sweep',
    startedAt: '2026-08-13T09:15:00',
    durationMs: 604,
    items: 0,
    steps: [
      { nodeId: 'brc-cron', name: 'Every 15 minutes', status: 'success', ms: 6, items: 1 },
      { nodeId: 'brc-code', name: 'Compute time to breach', status: 'success', ms: 79, items: 38 },
      { nodeId: 'brc-filter', name: 'SLA at risk (under 30 min)', status: 'success', ms: 119, items: 0 },
      { nodeId: 'brc-notify', name: 'Alert the queue channel', status: 'skipped', ms: 0, items: 0 },
      { nodeId: 'brc-approval', name: 'Out-of-hours override', status: 'skipped', ms: 0, items: 0 },
      { nodeId: 'brc-priority', name: 'Raise to urgent', status: 'skipped', ms: 0, items: 0 },
      { nodeId: 'brc-page', name: 'Page duty engineer (PagerDuty)', status: 'skipped', ms: 0, items: 0 },
      { nodeId: 'brc-comment', name: 'Log the escalation', status: 'skipped', ms: 0, items: 0 },
    ],
  },
  {
    id: 'run-8762',
    automationId: AUTO.TRIAGE,
    status: 'error',
    mode: 'trigger',
    trigger: 'TIC-4744 created — Lumen Retail Group (Enterprise)',
    startedAt: '2026-08-12T22:04:31',
    durationMs: 1904,
    items: 1,
    error: 'Slack webhook timed out',
    steps: [
      { nodeId: 'tri-trigger', name: 'Ticket Created', status: 'success', ms: 15, items: 1 },
      { nodeId: 'tri-if', name: 'VIP or Enterprise?', status: 'success', ms: 27, items: 1, branch: 'true' },
      { nodeId: 'tri-priority', name: 'Raise to urgent', status: 'success', ms: 121, items: 1 },
      { nodeId: 'tri-queue', name: 'Pin to Customer Support', status: 'success', ms: 99, items: 1 },
      { nodeId: 'tri-notify', name: 'Page the on-call lead', status: 'error', ms: 1642, items: 0, error: 'Slack webhook timed out after 1500ms — message queued for retry' },
    ],
  },
  {
    id: 'run-8749',
    automationId: AUTO.ONBOARDING,
    status: 'success',
    mode: 'trigger',
    trigger: 'REQ-2281 — Marcus Hale (Account Executive)',
    startedAt: '2026-08-11T10:26:09',
    durationMs: 3402,
    items: 1,
    steps: [
      { nodeId: 'onb-form', name: 'Form Submitted — New Hire', status: 'success', ms: 21, items: 1 },
      { nodeId: 'onb-approval', name: 'Hiring manager approval', status: 'success', ms: 812, items: 1 },
      { nodeId: 'onb-switch', name: 'Route by department', status: 'success', ms: 20, items: 1, branch: 'sales' },
      { nodeId: 'onb-sales', name: 'Build sales laptop + CRM seat', status: 'success', ms: 132, items: 1 },
      { nodeId: 'onb-people', name: 'Welcome pack and payroll', status: 'success', ms: 151, items: 1 },
      { nodeId: 'onb-facilities', name: 'Desk, badge and parking', status: 'success', ms: 149, items: 1 },
      { nodeId: 'onb-merge', name: 'Wait for both tracks', status: 'success', ms: 11, items: 2 },
      { nodeId: 'onb-course', name: 'Enrol in role curriculum', status: 'success', ms: 301, items: 1 },
    ],
  },
  {
    id: 'run-8731',
    automationId: AUTO.RENEWAL_ALERT,
    status: 'success',
    mode: 'schedule',
    trigger: 'Schedule — Monday 07:00 CT',
    startedAt: '2026-08-10T07:00:09',
    durationMs: 5211,
    items: 7,
    steps: [
      { nodeId: 'ren-cron', name: 'Every Monday 07:00', status: 'success', ms: 8, items: 1 },
      { nodeId: 'ren-filter', name: 'Renewal due within 60 days', status: 'success', ms: 210, items: 7 },
      { nodeId: 'ren-loop', name: 'For each renewing asset', status: 'success', ms: 34, items: 7 },
      { nodeId: 'ren-task', name: 'Open renewal review', status: 'success', ms: 3480, items: 7 },
      { nodeId: 'ren-notify', name: 'Email the asset owner', status: 'success', ms: 1163, items: 7 },
      { nodeId: 'ren-digest', name: 'Post the weekly digest', status: 'success', ms: 316, items: 1 },
    ],
  },
  {
    id: 'run-8720',
    automationId: AUTO.BREACH_ESCALATE,
    status: 'success',
    mode: 'manual',
    trigger: 'Manual test run — Alex Rivera',
    startedAt: '2026-08-09T15:48:52',
    durationMs: 1188,
    items: 2,
    steps: [
      { nodeId: 'brc-cron', name: 'Every 15 minutes', status: 'success', ms: 5, items: 1 },
      { nodeId: 'brc-code', name: 'Compute time to breach', status: 'success', ms: 91, items: 41 },
      { nodeId: 'brc-filter', name: 'SLA at risk (under 30 min)', status: 'success', ms: 128, items: 2 },
      { nodeId: 'brc-notify', name: 'Alert the queue channel', status: 'success', ms: 371, items: 2 },
      { nodeId: 'brc-approval', name: 'Out-of-hours override', status: 'success', ms: 498, items: 2 },
      { nodeId: 'brc-priority', name: 'Raise to urgent', status: 'success', ms: 95, items: 2 },
      { nodeId: 'brc-page', name: 'Page duty engineer (PagerDuty)', status: 'success', ms: 540, items: 2 },
      { nodeId: 'brc-comment', name: 'Log the escalation', status: 'success', ms: 88, items: 2 },
    ],
  },
];
