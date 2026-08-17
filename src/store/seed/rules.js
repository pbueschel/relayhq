/**
 * Business-rules seed — queues, rules, approval policies, SLA policies.
 *
 * Northwind Systems runs one RelayHQ instance for two audiences: its own
 * employees (internal ITSM) and its customers (external support). That shows up
 * here as queues with an `audience`, SLA policies keyed on customer plan OR
 * internal, and rules that test both `requester.department` and `org.plan`.
 *
 * IMPORTANT: routing is NOT authored here. A ticket's queue comes from the
 * subform it was submitted through (`subform.routing.queueId`), so there is one
 * source of truth and the Routing tab derives its table by walking the catalog.
 * What lives here is the destinations (queues), the post-intake rules that can
 * override them, the approval policies those rules start, and the SLA clocks.
 *
 * Every condition tree is shaped for '@/lib/conditions.js':
 *   group := { match: 'all'|'any', rows: [ row | group ] }
 *   row   := { field, op, value }
 * Every approver spec is shaped for '@/lib/approvals.js'.
 */

import { Q, USR, SF, CAT, POL, SLA, AUTO , SVCCAT } from './ids.js';

/* ==================================================================== *
 * QUEUES
 *
 * The destinations. `General` is the catch-all: anything that arrives without
 * routing lands here, and that fallback is surfaced in the UI rather than
 * happening silently. It cannot be deleted.
 * ==================================================================== */

export const QUEUES = [
  {
    id: Q.GENERAL,
    name: 'General',
    description: 'Catch-all triage. Anything that arrives without routing lands here and is triaged within one business hour.',
    hue: 'gray',
    isDefault: true,
    audience: 'both',
    inbox: 'help@northwind.example',
    memberIds: [USR.ADMIN, USR.LISA, USR.EMMA],
  },
  {
    id: Q.IT,
    name: 'IT Support',
    description: 'Endpoints, accounts, access and internal applications for Northwind staff.',
    hue: 'blue',
    isDefault: false,
    audience: 'internal',
    inbox: 'it@northwind.example',
    memberIds: [USR.EMMA, USR.ADMIN, USR.DEVON],
  },
  {
    id: Q.SUPPORT,
    name: 'Customer Support',
    description: 'Front line for customers of the Northwind Storefront product. Staffed 07:00–19:00 CT.',
    hue: 'rose',
    isDefault: false,
    audience: 'external',
    inbox: 'support@northwind.example',
    memberIds: [USR.LISA, USR.DEVON, USR.NADIA, USR.SAM],
  },
  {
    id: Q.PROCUREMENT,
    name: 'Procurement',
    description: 'Hardware and software purchasing, vendor onboarding and licence renewals.',
    hue: 'amber',
    isDefault: false,
    audience: 'internal',
    inbox: 'procurement@northwind.example',
    memberIds: [USR.JAMES, USR.MICHAEL, USR.ADMIN],
  },
  {
    id: Q.PEOPLE,
    name: 'People Ops',
    description: 'Onboarding, offboarding, leave and everything else that starts with a person changing state.',
    hue: 'violet',
    isDefault: false,
    audience: 'internal',
    inbox: 'peopleops@northwind.example',
    memberIds: [USR.PATTI, USR.LINDA],
  },
  {
    id: Q.FACILITIES,
    name: 'Facilities',
    description: 'Sites, desks, badges and building access across Chicago, New York and Austin.',
    hue: 'emerald',
    isDefault: false,
    audience: 'internal',
    inbox: 'facilities@northwind.example',
    memberIds: [USR.LINDA, USR.JAMES],
  },
  {
    id: Q.FINANCE,
    name: 'Finance',
    description: 'Spend approvals, expense queries, purchase orders and budget checks.',
    hue: 'teal',
    isDefault: false,
    audience: 'internal',
    inbox: 'finance@northwind.example',
    memberIds: [USR.MICHAEL, USR.ADMIN],
  },
  {
    id: Q.ENGINEERING,
    name: 'Engineering Escalations',
    description: 'Second line. Reproducible product defects and anything touching production infrastructure.',
    hue: 'cyan',
    isDefault: false,
    audience: 'both',
    inbox: 'eng-escalations@northwind.example',
    memberIds: [USR.PRIYA, USR.JEN, USR.MIKE],
  },
];

/* ==================================================================== *
 * RULES
 *
 * Order matters: rules run top to bottom and a later rule can overwrite an
 * earlier one's assignment. The array IS the order — the UI reorders by moving
 * elements, so there is no `order` field to drift out of sync.
 * ==================================================================== */

export const RULES = [
  {
    id: 'rule-vip-escalation',
    name: 'Escalate VIP customers on arrival',
    description: 'Named executive sponsors at our largest accounts never sit in the general queue. Runs first so later routing rules see the urgent priority.',
    enabled: true,
    trigger: 'on_create',
    conditions: {
      match: 'all',
      rows: [
        { field: 'requester.vip', op: 'is_true' },
        { field: 'requester.isExternal', op: 'is_true' },
      ],
    },
    actions: [
      { type: 'set_priority', priority: 'urgent' },
      { type: 'assign_queue', queueId: Q.SUPPORT },
      { type: 'assign_user', userId: USR.LISA },
      { type: 'add_label', label: 'vip' },
      { type: 'notify', target: { kind: 'user', userId: USR.LISA }, message: 'VIP contact has opened a ticket — acknowledge within 15 minutes.' },
    ],
  },
  {
    id: 'rule-enterprise-senior-queue',
    name: 'Enterprise plan goes to the senior queue',
    description: 'Enterprise accounts carry a one-hour first-response target, which the new-agent rota cannot reliably hit.',
    enabled: true,
    trigger: 'on_create',
    conditions: {
      match: 'all',
      rows: [
        { field: 'org.plan', op: 'is', value: 'Enterprise' },
        { field: 'requester.isExternal', op: 'is_true' },
        {
          match: 'any',
          rows: [
            { field: 'ticket.priority', op: 'is_one_of', value: ['urgent', 'high'] },
            { field: 'ticket.source', op: 'is', value: 'phone' },
          ],
        },
      ],
    },
    actions: [
      { type: 'assign_queue', queueId: Q.SUPPORT },
      { type: 'add_label', label: 'enterprise' },
      { type: 'notify', target: { kind: 'queue', queueId: Q.SUPPORT }, message: 'Enterprise ticket in the queue — 1h first response.' },
    ],
  },
  {
    id: 'rule-production-down',
    name: 'Production down means urgent, no exceptions',
    description: 'Customers describe outages in the title long before they pick a priority. Catch the words, not the dropdown.',
    enabled: true,
    trigger: 'on_create',
    conditions: {
      match: 'any',
      rows: [
        { field: 'ticket.title', op: 'contains', value: 'production down' },
        { field: 'ticket.title', op: 'contains', value: 'outage' },
        { field: 'ticket.title', op: 'contains', value: 'cannot check out' },
        { field: 'ticket.description', op: 'contains', value: 'store is down' },
      ],
    },
    actions: [
      { type: 'set_priority', priority: 'urgent' },
      { type: 'assign_queue', queueId: Q.ENGINEERING },
      { type: 'add_label', label: 'possible-incident' },
      { type: 'create_task', title: 'Open an incident bridge and post a status page update', assigneeId: USR.PRIYA },
      { type: 'run_automation', automationId: AUTO.BREACH_ESCALATE },
    ],
  },
  {
    id: 'rule-high-value-software',
    name: 'Flag high-value software requests for Finance',
    description: 'Anything over $500 needs a spend approval before Procurement starts a vendor conversation.',
    enabled: true,
    trigger: 'on_create',
    conditions: {
      match: 'all',
      rows: [
        { field: 'answers.amount', op: 'gt', value: 500 },
        {
          match: 'any',
          rows: [
            { field: 'ticket.subformId', op: 'is', value: SF.SOFTWARE_REQUEST },
            { field: 'ticket.catalogItemId', op: 'is', value: CAT.I_SOFTWARE_REQ },
            { field: 'asset.kind', op: 'is', value: 'software' },
          ],
        },
      ],
    },
    actions: [
      { type: 'assign_queue', queueId: Q.PROCUREMENT },
      { type: 'add_label', label: 'needs-finance-review' },
      { type: 'start_approval', policyId: POL.SPEND_OVER_500 },
    ],
  },
  {
    id: 'rule-admin-access-review',
    name: 'Admin access always goes through the system owner',
    description: 'Write and admin grants are the audit finding waiting to happen. Read access is left alone deliberately.',
    enabled: true,
    trigger: 'on_create',
    conditions: {
      match: 'all',
      rows: [
        { field: 'answers.accessLevel', op: 'is_one_of', value: ['write', 'admin'] },
        {
          match: 'any',
          rows: [
            { field: 'ticket.subformId', op: 'is', value: SF.REQUEST_ACCESS },
            { field: 'ticket.catalogItemId', op: 'is', value: CAT.I_MFA },
            // Anything ordered out of the Access & Accounts service category.
            // Keyed on the category so a new orderable access item inherits
            // this policy without the policy being edited.
            { field: 'ticket.serviceCategoryId', op: 'is', value: SVCCAT.ACCESS },
          ],
        },
      ],
    },
    actions: [
      { type: 'assign_queue', queueId: Q.IT },
      { type: 'add_label', label: 'access-review' },
      { type: 'start_approval', policyId: POL.ACCESS_GRANT },
    ],
  },
  {
    id: 'rule-new-hire-people-ops',
    name: 'New-hire requests go to People Ops',
    description: 'Hiring managers file these three weeks out. People Ops owns the chain; IT and Facilities join as approval stages.',
    enabled: true,
    trigger: 'on_create',
    conditions: {
      match: 'all',
      rows: [
        { field: 'ticket.subformId', op: 'is', value: SF.NEW_HIRE },
      ],
    },
    actions: [
      { type: 'assign_queue', queueId: Q.PEOPLE },
      { type: 'assign_user', userId: USR.PATTI },
      { type: 'add_label', label: 'onboarding' },
      { type: 'start_approval', policyId: POL.NEW_HIRE },
      { type: 'create_task', title: 'Order laptop and peripherals for start date', assigneeId: USR.JAMES },
      { type: 'run_automation', automationId: AUTO.ONBOARDING },
    ],
  },
  {
    id: 'rule-billing-autolabel',
    name: 'Auto-label billing questions and loop in Finance',
    description: 'Support keeps the ticket — Finance just needs to see it. Labelling here is what makes the billing deflection report possible. Gated on the requester being a customer: an employee asking for access to the billing console is an IT request, not a billing question, and without that gate this rule stole those tickets.',
    enabled: true,
    trigger: 'on_create',
    conditions: {
      match: 'all',
      rows: [
        { field: 'requester.isExternal', op: 'is_true' },
        {
          match: 'any',
          rows: [
            { field: 'ticket.subformId', op: 'is', value: SF.BILLING_QUESTION },
            { field: 'ticket.catalogItemId', op: 'is', value: CAT.I_BILLING },
            { field: 'ticket.title', op: 'contains', value: 'invoice' },
            { field: 'ticket.title', op: 'contains', value: 'refund' },
            { field: 'ticket.description', op: 'contains', value: 'charged twice' },
          ],
        },
      ],
    },
    actions: [
      { type: 'add_label', label: 'billing' },
      { type: 'assign_queue', queueId: Q.SUPPORT },
      { type: 'notify', target: { kind: 'user', userId: USR.MICHAEL }, message: 'Billing question raised by a customer — no action needed unless a credit is requested.' },
    ],
  },
  {
    id: 'rule-emergency-change',
    name: 'Emergency changes page the on-call approver',
    description: 'Two-hour approval clock with an escalation, because an emergency change waiting on a form is not an emergency process.',
    enabled: true,
    trigger: 'on_create',
    conditions: {
      match: 'all',
      rows: [
        { field: 'change.changeType', op: 'is', value: 'emergency' },
        {
          match: 'any',
          rows: [
            { field: 'change.affectsProduction', op: 'is_true' },
            { field: 'change.risk', op: 'is', value: 'high' },
          ],
        },
      ],
    },
    actions: [
      { type: 'set_priority', priority: 'urgent' },
      { type: 'assign_queue', queueId: Q.ENGINEERING },
      { type: 'add_label', label: 'emergency-change' },
      { type: 'start_approval', policyId: POL.EMERGENCY_CHANGE },
      { type: 'notify', target: { kind: 'queue', queueId: Q.ENGINEERING }, message: 'Emergency change raised — on-call authorisation required within 2 hours.' },
    ],
  },
  {
    id: 'rule-laptop-repair-loaner',
    name: 'Laptop repairs get a loaner task',
    description: 'The repair itself is fine; the two days without a machine is what generates the second ticket.',
    enabled: true,
    trigger: 'on_create',
    conditions: {
      match: 'all',
      rows: [
        { field: 'ticket.subformId', op: 'is', value: SF.LAPTOP_REPAIR },
        { field: 'requester.isExternal', op: 'is_false' },
      ],
    },
    actions: [
      { type: 'assign_queue', queueId: Q.IT },
      { type: 'add_label', label: 'hardware' },
      { type: 'create_task', title: 'Issue a loaner laptop from the Chicago spares pool', assigneeId: USR.EMMA },
    ],
  },
  {
    id: 'rule-sla-at-risk',
    name: 'Warn the queue when an SLA is at risk',
    description: 'Runs on the hourly tick. Deliberately narrow — warning on every open ticket trains people to ignore the warning.',
    enabled: true,
    trigger: 'scheduled',
    conditions: {
      match: 'all',
      rows: [
        { field: 'ticket.status', op: 'is_one_of', value: ['open', 'in_progress'] },
        { field: 'ticket.priority', op: 'is_one_of', value: ['urgent', 'high'] },
        { field: 'ticket.labels', op: 'not_includes', value: 'sla-at-risk' },
      ],
    },
    actions: [
      { type: 'add_label', label: 'sla-at-risk' },
      { type: 'notify', target: { kind: 'queue', queueId: Q.SUPPORT }, message: 'This ticket passes 75% of its first-response target in under an hour.' },
      { type: 'run_automation', automationId: AUTO.BREACH_ESCALATE },
    ],
  },
  {
    id: 'rule-offboarding-revoke',
    name: 'Offboarding starts the revoke chain',
    description: 'Fires when People Ops picks the ticket up rather than on submission, so a cancelled resignation does not revoke anybody.',
    enabled: true,
    trigger: 'on_status_change',
    conditions: {
      match: 'all',
      rows: [
        { field: 'ticket.subformId', op: 'is', value: SF.OFFBOARDING },
        { field: 'ticket.status', op: 'is', value: 'in_progress' },
      ],
    },
    actions: [
      { type: 'assign_queue', queueId: Q.PEOPLE },
      { type: 'start_approval', policyId: POL.OFFBOARDING },
      { type: 'create_task', title: 'Revoke SSO, MFA and privileged access', assigneeId: USR.EMMA },
      { type: 'create_task', title: 'Collect laptop, badge and any loaned equipment', assigneeId: USR.LINDA },
      { type: 'notify', target: { kind: 'manager' }, message: 'Offboarding has started for your report — confirm the last working day.' },
    ],
  },
  {
    id: 'rule-auto-close-resolved',
    name: 'Auto-close resolved tickets after five days',
    description: 'Written but not switched on: Support wants to see the reopen rate for a month before letting this run.',
    enabled: false,
    trigger: 'scheduled',
    conditions: {
      match: 'all',
      rows: [
        { field: 'ticket.status', op: 'is', value: 'resolved' },
        { field: 'ticket.labels', op: 'not_includes', value: 'awaiting-customer' },
      ],
    },
    actions: [
      { type: 'add_label', label: 'auto-closed' },
      { type: 'notify', target: { kind: 'requester' }, message: 'We are closing this ticket. Reply any time to reopen it.' },
      { type: 'run_automation', automationId: AUTO.CSAT_FOLLOWUP },
    ],
  },
];

/* ==================================================================== *
 * APPROVAL POLICIES
 *
 * `appliesWhen` uses the same condition engine as the rules above, so the same
 * builder edits both. Stages run in order; approvers are resolved at start time
 * and frozen onto the request.
 * ==================================================================== */

export const APPROVAL_POLICIES = [
  {
    id: POL.SPEND_OVER_500,
    name: 'Spend over $500',
    description: 'The everyday threshold. One manager, one day, then it escalates a level rather than sitting.',
    enabled: true,
    onReject: 'stop',
    appliesWhen: {
      match: 'all',
      rows: [
        { field: 'answers.annualAmount', op: 'gte', value: 500 },
        { field: 'answers.annualAmount', op: 'lt', value: 5000 },
      ],
    },
    stages: [
      {
        id: 'stg-500-manager',
        name: 'Manager sign-off',
        approvers: [{ kind: 'manager' }],
        rule: 'all',
        quorum: 1,
        dueInHours: 24,
        onTimeout: 'escalate',
        escalateTo: { kind: 'manager_of_manager' },
      },
    ],
  },
  {
    id: POL.SPEND_OVER_5000,
    name: 'Spend over $5,000',
    description: 'Three stages, and the last one is a genuine quorum: two of the skip-level manager and the admin group have to agree.',
    enabled: true,
    onReject: 'stop',
    appliesWhen: {
      match: 'all',
      rows: [
        { field: 'answers.annualAmount', op: 'gte', value: 5000 },
      ],
    },
    stages: [
      {
        id: 'stg-5000-manager',
        name: 'Manager sign-off',
        approvers: [{ kind: 'manager' }],
        rule: 'all',
        quorum: 1,
        dueInHours: 24,
        onTimeout: 'escalate',
        escalateTo: { kind: 'manager_of_manager' },
      },
      {
        id: 'stg-5000-finance',
        name: 'Finance review',
        approvers: [{ kind: 'queue', queueId: Q.FINANCE }],
        rule: 'any',
        quorum: 1,
        dueInHours: 12,
        onTimeout: 'escalate',
        escalateTo: { kind: 'user', userId: USR.MICHAEL },
      },
      {
        id: 'stg-5000-skip',
        name: 'Skip-level authorisation',
        approvers: [{ kind: 'manager_of_manager' }, { kind: 'role', role: 'manager' }],
        rule: 'quorum',
        quorum: 2,
        dueInHours: 48,
        onTimeout: 'wait',
        escalateTo: null,
      },
    ],
  },
  {
    id: POL.ACCESS_GRANT,
    name: 'Privileged access grant',
    description: 'The system owner and the requester\'s manager both have to say yes. Read-only access never reaches this policy.',
    enabled: true,
    onReject: 'stop',
    /**
     * Two ways in, because access is requested through two different shapes.
     *
     * The help catalog asks for an access LEVEL on its form, so a write/admin
     * answer on the access request form is the signal there. The service
     * catalog has no such field on most of its intakes — a shared mailbox, a
     * door badge and a role change are all access grants asked for in three
     * different ways — so those declare `grantsAccess` on the ITEM instead.
     *
     * Requiring the form field for both is how four service items came to
     * declare this policy and never trigger it.
     */
    appliesWhen: {
      match: 'any',
      rows: [
        {
          match: 'all',
          rows: [
            { field: 'answers.accessLevel', op: 'is_one_of', value: ['write', 'admin'] },
            {
              match: 'any',
              rows: [
                { field: 'ticket.subformId', op: 'is', value: SF.REQUEST_ACCESS },
                { field: 'ticket.catalogItemId', op: 'is', value: CAT.I_MFA },
              ],
            },
          ],
        },
        { field: 'ticket.grantsAccess', op: 'is_true' },
      ],
    },
    stages: [
      {
        id: 'stg-access-owner',
        name: 'System owner and manager',
        approvers: [{ kind: 'user', userId: USR.EMMA }, { kind: 'manager' }],
        rule: 'all',
        quorum: 2,
        dueInHours: 8,
        onTimeout: 'escalate',
        escalateTo: { kind: 'queue', queueId: Q.IT },
      },
    ],
  },
  {
    id: POL.NEW_HIRE,
    name: 'New hire onboarding',
    description: 'Three departments, three clocks. Facilities is last because a desk can be arranged after the laptop is ordered.',
    enabled: true,
    onReject: 'stop',
    appliesWhen: {
      match: 'all',
      rows: [
        { field: 'ticket.subformId', op: 'is', value: SF.NEW_HIRE },
      ],
    },
    stages: [
      {
        id: 'stg-hire-manager',
        name: 'Hiring manager confirms the offer',
        approvers: [{ kind: 'manager' }],
        rule: 'all',
        quorum: 1,
        dueInHours: 24,
        onTimeout: 'escalate',
        escalateTo: { kind: 'department_head', department: 'People' },
      },
      {
        id: 'stg-hire-it',
        name: 'IT provisioning',
        approvers: [{ kind: 'queue', queueId: Q.IT }],
        rule: 'any',
        quorum: 1,
        dueInHours: 48,
        onTimeout: 'escalate',
        escalateTo: { kind: 'user', userId: USR.EMMA },
      },
      {
        id: 'stg-hire-facilities',
        name: 'Desk, badge and building access',
        approvers: [{ kind: 'queue', queueId: Q.FACILITIES }],
        rule: 'any',
        quorum: 1,
        dueInHours: 72,
        onTimeout: 'wait',
        escalateTo: null,
      },
    ],
  },
  {
    id: POL.NORMAL_CHANGE,
    name: 'Normal change — CAB',
    description: 'Three of the five board members. Quorum rather than unanimity, because the CAB meets weekly and one holiday should not stall a release.',
    enabled: true,
    onReject: 'stop',
    appliesWhen: {
      match: 'all',
      rows: [
        { field: 'change.changeType', op: 'is', value: 'normal' },
        {
          match: 'any',
          rows: [
            { field: 'change.risk', op: 'is_one_of', value: ['high', 'moderate'] },
            { field: 'change.affectsProduction', op: 'is_true' },
          ],
        },
      ],
    },
    stages: [
      {
        id: 'stg-cab',
        name: 'Change Advisory Board',
        approvers: [
          { kind: 'user', userId: USR.ADMIN },
          { kind: 'user', userId: USR.EMMA },
          { kind: 'user', userId: USR.PRIYA },
          { kind: 'user', userId: USR.JEN },
          { kind: 'user', userId: USR.MICHAEL },
        ],
        rule: 'quorum',
        quorum: 3,
        dueInHours: 72,
        onTimeout: 'escalate',
        escalateTo: { kind: 'role', role: 'admin' },
      },
    ],
  },
  {
    id: POL.EMERGENCY_CHANGE,
    name: 'Emergency change — on-call',
    description: 'Any one of the on-call engineers, two-hour clock, escalates to Service Ops. Reviewed retrospectively at the next CAB.',
    enabled: true,
    onReject: 'stop',
    appliesWhen: {
      match: 'all',
      rows: [
        { field: 'change.changeType', op: 'is', value: 'emergency' },
      ],
    },
    stages: [
      {
        id: 'stg-emergency-oncall',
        name: 'On-call authorisation',
        approvers: [{ kind: 'queue', queueId: Q.ENGINEERING }, { kind: 'user', userId: USR.EMMA }],
        rule: 'any',
        quorum: 1,
        dueInHours: 2,
        onTimeout: 'escalate',
        escalateTo: { kind: 'user', userId: USR.ADMIN },
      },
    ],
  },
  {
    id: POL.OFFBOARDING,
    name: 'Offboarding clearance',
    description: 'Manager confirms the date, People Ops clears the paperwork, IT signs off that access is actually gone. Nothing here may auto-approve.',
    enabled: true,
    onReject: 'stop',
    appliesWhen: {
      match: 'all',
      rows: [
        { field: 'ticket.subformId', op: 'is', value: SF.OFFBOARDING },
      ],
    },
    stages: [
      {
        id: 'stg-off-manager',
        name: 'Manager confirms the last working day',
        approvers: [{ kind: 'manager' }],
        rule: 'all',
        quorum: 1,
        dueInHours: 24,
        onTimeout: 'escalate',
        escalateTo: { kind: 'department_head', department: 'People' },
      },
      {
        id: 'stg-off-people',
        name: 'People Ops clearance',
        approvers: [{ kind: 'queue', queueId: Q.PEOPLE }],
        rule: 'any',
        quorum: 1,
        dueInHours: 24,
        onTimeout: 'escalate',
        escalateTo: { kind: 'user', userId: USR.PATTI },
      },
      {
        // `rule: 'all'` means every resolved member of the IT queue signs off —
        // quorum is not read for 'all', so it mirrors the approver-spec count
        // rather than carrying a second, contradictory number.
        id: 'stg-off-it',
        name: 'Access revocation sign-off',
        approvers: [{ kind: 'queue', queueId: Q.IT }],
        rule: 'all',
        quorum: 1,
        dueInHours: 8,
        onTimeout: 'escalate',
        escalateTo: { kind: 'user', userId: USR.ADMIN },
      },
    ],
  },
];

/* ==================================================================== *
 * SLA POLICIES
 *
 * Two kinds: customer plans (external) and one internal policy for staff
 * requests. `clock` decides whether the timer runs against the calendar or
 * against the business hours in settings.
 * ==================================================================== */

export const SLA_POLICIES = [
  {
    id: SLA.ENTERPRISE,
    name: 'Enterprise — 24×7',
    description: 'Contractual. One-hour first response around the clock, including weekends and US holidays.',
    appliesTo: { kind: 'plan', plan: 'Enterprise' },
    firstResponseHours: 1,
    resolutionHours: 8,
    clock: 'calendar',
    targets: {
      urgent: { first: 0.25, resolve: 4 },
      high: { first: 1, resolve: 8 },
      medium: { first: 4, resolve: 24 },
      low: { first: 8, resolve: 72 },
    },
  },
  {
    id: SLA.BUSINESS,
    name: 'Business — business hours',
    description: 'Four-hour first response inside the support window. The overnight queue is picked up at 07:00 CT.',
    appliesTo: { kind: 'plan', plan: 'Business' },
    firstResponseHours: 4,
    resolutionHours: 24,
    clock: 'business',
    targets: {
      urgent: { first: 1, resolve: 8 },
      high: { first: 4, resolve: 24 },
      medium: { first: 8, resolve: 48 },
      low: { first: 16, resolve: 120 },
    },
  },
  {
    id: SLA.STARTER,
    name: 'Starter — next business day',
    description: 'Self-serve tier. The help centre carries most of this plan; the target exists so a Starter ticket cannot be forgotten.',
    appliesTo: { kind: 'plan', plan: 'Starter' },
    firstResponseHours: 8,
    resolutionHours: 72,
    clock: 'business',
    targets: {
      urgent: { first: 4, resolve: 24 },
      high: { first: 8, resolve: 48 },
      medium: { first: 16, resolve: 72 },
      low: { first: 24, resolve: 160 },
    },
  },
  {
    id: SLA.INTERNAL,
    name: 'Internal staff requests',
    description: 'Applies to every internal queue. Deliberately looser than the customer plans so agents are not pulled off customer work by a monitor request.',
    appliesTo: { kind: 'internal' },
    firstResponseHours: 4,
    resolutionHours: 40,
    clock: 'business',
    targets: {
      urgent: { first: 1, resolve: 8 },
      high: { first: 4, resolve: 16 },
      medium: { first: 8, resolve: 40 },
      low: { first: 16, resolve: 120 },
    },
  },
];
