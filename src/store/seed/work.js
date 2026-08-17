/**
 * Work management seed — projects and tasks.
 *
 * ============================================================================
 * THE SHAPE, AND WHY IT LOOKS LIKE THIS
 * ============================================================================
 * ClickUp's "feel" does not come from feature count, it comes from four
 * mechanics (see docs/research/2026-08-16-service-management-market.md §3.3):
 *
 *   1. custom statuses authored PER LOCATION, grouped Not started / Active /
 *      Done / Closed — so two projects can run genuinely different workflows;
 *   2. custom FIELDS per location, rendered as columns in List and as chips on
 *      Board cards;
 *   3. one grouping control (Status / Assignee / Priority) driving every view;
 *   4. one task record that carries subtasks, checklists, dependencies and
 *      custom-field values, so every surface reads the same source of truth.
 *
 * So a project owns `statuses` and `fields`, and a task carries `status`
 * (an id from ITS project's status list), `fields` (keyed by field id),
 * `parentId` (subtasks are tasks — never a nested array, or the board and the
 * calendar would each need their own traversal) and `dependencies`.
 *
 * PERSONAL TASKS have `projectId: null`. They are teal, not violet, they have
 * no custom fields, and they use PERSONAL_STATUSES below. They are the same
 * record type on purpose: My Workspace shows a person's project tasks and
 * personal tasks in one list, which only works if they are one collection.
 *
 * DEPENDENCIES are stored once, on the task where the author declared them,
 * as { type: 'waiting_on' | 'blocks', taskId }. The inverse is DERIVED by
 * scanning, never duplicated — a mirrored copy is a second source of truth and
 * would drift the moment one side is edited.
 *
 * Dates are ISO day strings relative to the demo clock, 2026-08-16.
 */

import { PRJ, USR, CRS, CUR, LOC } from './ids.js';

/* ------------------------------------------------------------------ *
 * Statuses for personal tasks.
 *
 * Personal tasks belong to no project, so they cannot inherit a project's
 * workflow. They get this fixed set instead. Every id is a key in
 * tokens.STATUS so the colour matches the same state on a ticket.
 * ------------------------------------------------------------------ */
export const PERSONAL_STATUSES = [
  { id: 'todo',        label: 'To Do',       hue: 'gray',    group: 'not_started' },
  { id: 'in_progress', label: 'In Progress', hue: 'amber',   group: 'active' },
  { id: 'blocked',     label: 'Blocked',     hue: 'red',     group: 'active' },
  { id: 'completed',   label: 'Completed',   hue: 'emerald', group: 'done' },
];

/* ------------------------------------------------------------------ *
 * Custom field ids.
 *
 * These are private to the work domain — a field only ever means something
 * inside its own project — so they live here rather than in ids.js.
 * ------------------------------------------------------------------ */

const CF = {
  // CRM Migration
  CRM_SYSTEM:   'cf-crm-system',
  CRM_RECORDS:  'cf-crm-records',
  CRM_OWNER:    'cf-crm-owner',
  CRM_CUTOVER:  'cf-crm-cutover',
  CRM_LEGAL:    'cf-crm-legal',
  // Mobile App Release
  MOB_PLATFORM: 'cf-mob-platform',
  MOB_POINTS:   'cf-mob-points',
  MOB_FLAG:     'cf-mob-flag',
  MOB_BUILD:    'cf-mob-build',
  MOB_REVIEWER: 'cf-mob-reviewer',
  // Chicago Office Move
  MOV_VENDOR:   'cf-mov-vendor',
  MOV_COST:     'cf-mov-cost',
  MOV_FLOOR:    'cf-mov-floor',
  MOV_WALK:     'cf-mov-walkthrough',
  MOV_PO:       'cf-mov-po',
  MOV_CONTACT:  'cf-mov-contact',
  // Academy Launch
  ACA_AUDIENCE: 'cf-aca-audience',
  ACA_MINUTES:  'cf-aca-minutes',
  ACA_SME:      'cf-aca-sme',
  ACA_LAUNCH:   'cf-aca-launch',
  ACA_CAPTIONS: 'cf-aca-captions',
};

/* ==================================================================== *
 * PROJECTS
 * ==================================================================== */

export const PROJECTS = [
  {
    id: PRJ.CRM_MIGRATION,
    name: 'CRM Migration',
    key: 'CRM',
    description: 'Move Sales and Success off the legacy CRM onto the new platform without losing a single opportunity record.',
    status: 'in_progress',
    audience: 'internal',
    ownerId: USR.ADMIN,
    memberIds: [USR.ADMIN, USR.EMMA, USR.ROBERT, USR.MICHAEL, USR.PRIYA, USR.TOM],
    startDate: '2026-06-01',
    dueDate: '2026-10-30',
    createdAt: '2026-05-22',
    // A staged delivery workflow: nothing moves to Build before Discovery signs off.
    statuses: [
      { id: 'backlog',    label: 'Backlog',    hue: 'gray',    group: 'not_started' },
      { id: 'discovery',  label: 'Discovery',  hue: 'blue',    group: 'active' },
      { id: 'build',      label: 'Build',      hue: 'amber',   group: 'active' },
      { id: 'validate',   label: 'Validation', hue: 'violet',  group: 'active' },
      { id: 'signed_off', label: 'Signed off', hue: 'emerald', group: 'done' },
      { id: 'closed',     label: 'Closed',     hue: 'gray',    group: 'closed' },
    ],
    fields: [
      {
        id: CF.CRM_SYSTEM, label: 'Source system', type: 'select', width: 9,
        options: [
          { id: 'legacy',    label: 'Legacy CRM',       hue: 'blue' },
          { id: 'sheets',    label: 'Spreadsheets',     hue: 'amber' },
          { id: 'marketing', label: 'Marketing Cloud',  hue: 'violet' },
          { id: 'support',   label: 'Support Desk',     hue: 'rose' },
        ],
      },
      { id: CF.CRM_RECORDS, label: 'Records', type: 'number', width: 6 },
      { id: CF.CRM_OWNER,   label: 'Business owner', type: 'person', width: 9 },
      { id: CF.CRM_CUTOVER, label: 'Cutover date', type: 'date', width: 8 },
      { id: CF.CRM_LEGAL,   label: 'Legal sign-off', type: 'checkbox', width: 6 },
    ],
  },
  {
    id: PRJ.MOBILE_RELEASE,
    name: 'Mobile App Release 4.2',
    key: 'MOB',
    description: 'Offline mode, the accessibility pass and the cold-start crash fix — the release that unblocks the Vireo Health rollout.',
    status: 'in_progress',
    audience: 'external',
    ownerId: USR.JEN,
    memberIds: [USR.JEN, USR.MIKE, USR.PRIYA, USR.DAVID, USR.LISA, USR.SAM],
    startDate: '2026-07-06',
    dueDate: '2026-09-11',
    createdAt: '2026-06-30',
    // An engineering workflow with a real review gate and an explicit Blocked state.
    statuses: [
      { id: 'todo',        label: 'To Do',       hue: 'gray',    group: 'not_started' },
      { id: 'in_progress', label: 'In Progress', hue: 'amber',   group: 'active' },
      { id: 'code_review', label: 'Code Review', hue: 'violet',  group: 'active' },
      { id: 'qa',          label: 'QA',          hue: 'cyan',    group: 'active' },
      { id: 'blocked',     label: 'Blocked',     hue: 'red',     group: 'active' },
      { id: 'shipped',     label: 'Shipped',     hue: 'emerald', group: 'done' },
      { id: 'closed',      label: 'Closed',      hue: 'gray',    group: 'closed' },
    ],
    fields: [
      {
        id: CF.MOB_PLATFORM, label: 'Platform', type: 'select', width: 7,
        options: [
          { id: 'ios',     label: 'iOS',     hue: 'slate' },
          { id: 'android', label: 'Android', hue: 'lime' },
          { id: 'both',    label: 'Both',    hue: 'violet' },
        ],
      },
      { id: CF.MOB_POINTS,   label: 'Points', type: 'number', width: 5 },
      { id: CF.MOB_FLAG,     label: 'Feature flag', type: 'checkbox', width: 6 },
      { id: CF.MOB_BUILD,    label: 'Target build', type: 'date', width: 8 },
      { id: CF.MOB_REVIEWER, label: 'Reviewer', type: 'person', width: 9 },
    ],
  },
  {
    id: PRJ.OFFICE_MOVE,
    name: 'Chicago Office Move',
    key: 'MOVE',
    description: 'Two floors, 180 people and the Elk Grove kit — out of the old building by the end of September.',
    status: 'in_progress',
    audience: 'internal',
    ownerId: USR.LINDA,
    locationId: LOC.CHI,
    memberIds: [USR.LINDA, USR.JAMES, USR.EMMA, USR.MICHAEL, USR.PATTI, USR.ADMIN],
    startDate: '2026-07-20',
    dueDate: '2026-09-30',
    createdAt: '2026-07-14',
    // A procurement-shaped workflow — quoting and ordering are real states here.
    statuses: [
      { id: 'not_started', label: 'Not Started', hue: 'gray',    group: 'not_started' },
      { id: 'quoting',     label: 'Quoting',     hue: 'blue',    group: 'active' },
      { id: 'ordered',     label: 'Ordered',     hue: 'amber',   group: 'active' },
      { id: 'on_site',     label: 'On Site',     hue: 'orange',  group: 'active' },
      { id: 'done',        label: 'Done',        hue: 'emerald', group: 'done' },
      { id: 'cancelled',   label: 'Cancelled',   hue: 'gray',    group: 'closed' },
    ],
    fields: [
      { id: CF.MOV_VENDOR, label: 'Vendor', type: 'text', width: 11 },
      { id: CF.MOV_COST,   label: 'Quoted cost', type: 'currency', currency: 'USD', width: 8 },
      {
        id: CF.MOV_FLOOR, label: 'Floor', type: 'select', width: 8,
        options: [
          { id: 'f12',  label: 'Floor 12',  hue: 'cyan' },
          { id: 'f14',  label: 'Floor 14',  hue: 'indigo' },
          { id: 'both', label: 'Both',      hue: 'violet' },
          { id: 'wh',   label: 'Warehouse', hue: 'amber' },
        ],
      },
      { id: CF.MOV_WALK,    label: 'Walkthrough', type: 'date', width: 8 },
      { id: CF.MOV_PO,      label: 'PO approved', type: 'checkbox', width: 6 },
      { id: CF.MOV_CONTACT, label: 'Site contact', type: 'person', width: 9 },
    ],
  },
  {
    id: PRJ.ACADEMY_LAUNCH,
    name: 'Northwind Academy Launch',
    key: 'ACAD',
    description: 'Turn the knowledge base into courses that teach a job function — agents first, then the customer academy.',
    status: 'in_progress',
    audience: 'both',
    ownerId: USR.LISA,
    curriculumId: CUR.SUPPORT_AGENT,
    memberIds: [USR.LISA, USR.SAM, USR.DEVON, USR.NADIA, USR.ADMIN, USR.MIKE, USR.EMMA],
    startDate: '2026-07-01',
    dueDate: '2026-09-30',
    createdAt: '2026-06-24',
    // A content workflow — the states are authoring states, not engineering ones.
    statuses: [
      { id: 'outline',   label: 'Outline',   hue: 'gray',    group: 'not_started' },
      { id: 'drafting',  label: 'Drafting',  hue: 'blue',    group: 'active' },
      { id: 'review',    label: 'In Review', hue: 'violet',  group: 'active' },
      { id: 'recording', label: 'Recording', hue: 'pink',    group: 'active' },
      { id: 'published', label: 'Published', hue: 'emerald', group: 'done' },
      { id: 'archived',  label: 'Archived',  hue: 'slate',   group: 'closed' },
    ],
    fields: [
      {
        id: CF.ACA_AUDIENCE, label: 'Audience', type: 'select', width: 9,
        options: [
          { id: 'agents',    label: 'Internal agents', hue: 'slate' },
          { id: 'customers', label: 'Customers',       hue: 'green' },
          { id: 'both',      label: 'Both',            hue: 'violet' },
        ],
      },
      { id: CF.ACA_MINUTES,  label: 'Runtime (min)', type: 'number', width: 6 },
      { id: CF.ACA_SME,      label: 'Subject expert', type: 'person', width: 9 },
      { id: CF.ACA_LAUNCH,   label: 'Launch date', type: 'date', width: 8 },
      { id: CF.ACA_CAPTIONS, label: 'Captions done', type: 'checkbox', width: 6 },
    ],
  },
];

/* ==================================================================== *
 * TASKS
 *
 * Roughly forty project tasks across the four projects plus a personal list,
 * with subtasks, checklists, dependencies, three milestones and six tasks that
 * are already past due against the 2026-08-16 demo clock.
 * ==================================================================== */

export const TASKS = [
  /* ---------------------------------------------------------------- *
   * CRM Migration
   * ---------------------------------------------------------------- */
  {
    id: 'tsk-crm-01', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Inventory legacy CRM objects and field usage',
    description: 'Pull every object, field and workflow out of the legacy tenant and mark what is actually written to in the last 18 months. Anything with zero writes does not migrate.',
    status: 'signed_off', priority: 'high', assigneeId: USR.PRIYA,
    watcherIds: [USR.ADMIN, USR.ROBERT],
    tags: ['discovery', 'data'],
    startDate: '2026-06-01', dueDate: '2026-06-26', completedAt: '2026-06-25',
    estimateHours: 16, timeSpentHours: 19, milestone: false,
    dependencies: [],
    checklists: [
      {
        id: 'ck-crm-01a', name: 'Objects to profile',
        items: [
          { id: 'ci-1', text: 'Accounts and Contacts', done: true },
          { id: 'ci-2', text: 'Opportunities and Products', done: true },
          { id: 'ci-3', text: 'Cases and email-to-case', done: true },
          { id: 'ci-4', text: 'Custom quote object', done: true },
        ],
      },
    ],
    fields: { [CF.CRM_SYSTEM]: 'legacy', [CF.CRM_RECORDS]: 148000, [CF.CRM_OWNER]: USR.ROBERT, [CF.CRM_LEGAL]: true },
    createdAt: '2026-05-28', updatedAt: '2026-06-25',
  },
  {
    id: 'tsk-crm-02', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Field mapping workshop with Sales Ops',
    description: 'Two sessions with Sales Ops to agree the target field map. Bring the write-frequency report — the argument is always about custom fields nobody uses.',
    status: 'validate', priority: 'high', assigneeId: USR.ROBERT,
    watcherIds: [USR.ADMIN, USR.PRIYA, USR.TOM],
    tags: ['workshop'],
    startDate: '2026-07-27', dueDate: '2026-08-07', completedAt: null,
    estimateHours: 8, timeSpentHours: 11, milestone: false,
    dependencies: [],
    checklists: [],
    fields: { [CF.CRM_SYSTEM]: 'legacy', [CF.CRM_OWNER]: USR.ROBERT, [CF.CRM_RECORDS]: 412 },
    createdAt: '2026-07-14', updatedAt: '2026-08-12',
  },
  {
    id: 'tsk-crm-02a', projectId: PRJ.CRM_MIGRATION, parentId: 'tsk-crm-02',
    title: 'Map opportunity stages to the new pipeline',
    description: 'Six legacy stages collapse to four. Closed Lost reason codes need a home.',
    status: 'signed_off', priority: 'medium', assigneeId: USR.TOM,
    watcherIds: [], tags: [],
    startDate: '2026-07-27', dueDate: '2026-08-03', completedAt: '2026-08-03',
    estimateHours: 3, timeSpentHours: 4, milestone: false,
    dependencies: [], checklists: [], fields: {},
    createdAt: '2026-07-27', updatedAt: '2026-08-03',
  },
  {
    id: 'tsk-crm-02b', projectId: PRJ.CRM_MIGRATION, parentId: 'tsk-crm-02',
    title: 'Decide which custom fields survive the move',
    description: '212 custom fields on Opportunity. 38 have been written to this year.',
    status: 'validate', priority: 'high', assigneeId: USR.ROBERT,
    watcherIds: [USR.ADMIN], tags: [],
    startDate: '2026-08-03', dueDate: '2026-08-14', completedAt: null,
    estimateHours: 5, timeSpentHours: 2, milestone: false,
    dependencies: [], checklists: [], fields: { [CF.CRM_RECORDS]: 212 },
    createdAt: '2026-07-27', updatedAt: '2026-08-14',
  },
  {
    id: 'tsk-crm-03', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Data migration dry run #2',
    description: 'Full-volume load into the staging tenant with the agreed field map. Record row counts and rejects per object so the cutover has a baseline to beat.',
    status: 'build', priority: 'urgent', assigneeId: USR.PRIYA,
    watcherIds: [USR.ADMIN, USR.EMMA],
    tags: ['data', 'cutover'],
    startDate: '2026-08-17', dueDate: '2026-08-28', completedAt: null,
    estimateHours: 24, timeSpentHours: 0, milestone: false,
    dependencies: [{ type: 'waiting_on', taskId: 'tsk-crm-02' }],
    checklists: [
      {
        id: 'ck-crm-03a', name: 'Per-object verification',
        items: [
          { id: 'ci-1', text: 'Accounts row count matches source', done: false },
          { id: 'ci-2', text: 'Opportunity amounts reconcile to the penny', done: false },
          { id: 'ci-3', text: 'Attachment blobs land in the right folder', done: false },
          { id: 'ci-4', text: 'Reject file under 0.5%', done: false },
        ],
      },
    ],
    fields: { [CF.CRM_SYSTEM]: 'legacy', [CF.CRM_RECORDS]: 148000, [CF.CRM_OWNER]: USR.PRIYA, [CF.CRM_CUTOVER]: '2026-10-24' },
    createdAt: '2026-07-30', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-crm-04', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Rewrite quote-to-cash automation on the new platform',
    description: 'The legacy flow fires on stage change and writes to three objects. Rebuild it as two automations so the failure modes are separable.',
    status: 'build', priority: 'medium', assigneeId: USR.EMMA,
    watcherIds: [USR.MICHAEL], tags: ['automation'],
    startDate: '2026-08-10', dueDate: '2026-09-04', completedAt: null,
    estimateHours: 20, timeSpentHours: 6, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.CRM_SYSTEM]: 'legacy', [CF.CRM_OWNER]: USR.MICHAEL },
    createdAt: '2026-07-30', updatedAt: '2026-08-14',
  },
  {
    id: 'tsk-crm-05', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Retire legacy API keys and webhook endpoints',
    description: 'Nine integrations still authenticate against the legacy tenant. Each needs an owner and a cut date before the cutover weekend, not after.',
    status: 'backlog', priority: 'high', assigneeId: USR.EMMA,
    watcherIds: [USR.ADMIN], tags: ['security'],
    startDate: '2026-09-07', dueDate: '2026-09-18', completedAt: null,
    estimateHours: 10, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.CRM_SYSTEM]: 'support' },
    createdAt: '2026-08-04', updatedAt: '2026-08-04',
  },
  {
    id: 'tsk-crm-06', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Train Sales on the new pipeline view',
    description: 'Two live sessions plus a recorded walkthrough in the Academy. Reuse the pipeline lesson rather than writing new material.',
    status: 'backlog', priority: 'medium', assigneeId: USR.ROBERT,
    watcherIds: [USR.LISA], tags: ['enablement'],
    startDate: '2026-10-05', dueDate: '2026-10-09', completedAt: null,
    estimateHours: 6, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.CRM_OWNER]: USR.ROBERT },
    createdAt: '2026-08-06', updatedAt: '2026-08-06',
  },
  {
    id: 'tsk-crm-07', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Cutover weekend complete',
    description: 'Freeze the legacy tenant Friday 18:00, load, reconcile, open the new tenant Monday 07:00. No partial state — either we open or we roll back.',
    status: 'backlog', priority: 'urgent', assigneeId: USR.ADMIN,
    watcherIds: [USR.PRIYA, USR.EMMA, USR.ROBERT, USR.MICHAEL],
    tags: ['cutover'],
    startDate: '2026-10-23', dueDate: '2026-10-26', completedAt: null,
    estimateHours: 40, timeSpentHours: 0, milestone: true,
    dependencies: [{ type: 'waiting_on', taskId: 'tsk-crm-03' }],
    checklists: [],
    fields: { [CF.CRM_CUTOVER]: '2026-10-24', [CF.CRM_LEGAL]: false, [CF.CRM_OWNER]: USR.ADMIN },
    createdAt: '2026-06-02', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-crm-08', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Reconcile 2024-2026 opportunity history with Finance',
    description: 'Finance closes on the legacy numbers. Any variance over $500 in a closed quarter has to be explained before sign-off.',
    status: 'validate', priority: 'high', assigneeId: USR.MICHAEL,
    watcherIds: [USR.ADMIN], tags: ['finance', 'data'],
    startDate: '2026-08-24', dueDate: '2026-09-11', completedAt: null,
    estimateHours: 12, timeSpentHours: 3, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.CRM_SYSTEM]: 'sheets', [CF.CRM_RECORDS]: 9400, [CF.CRM_OWNER]: USR.MICHAEL, [CF.CRM_LEGAL]: false },
    createdAt: '2026-08-01', updatedAt: '2026-08-13',
  },
  {
    id: 'tsk-crm-09', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Decommission the legacy CRM sandbox',
    description: 'Keep a cold export for seven years, then tear the sandbox down. Confirm the retention window with Legal before deleting anything.',
    status: 'backlog', priority: 'low', assigneeId: USR.PRIYA,
    watcherIds: [], tags: [],
    startDate: '2026-11-02', dueDate: '2026-11-06', completedAt: null,
    estimateHours: 4, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.CRM_LEGAL]: false },
    createdAt: '2026-08-06', updatedAt: '2026-08-06',
  },
  {
    id: 'tsk-crm-10', projectId: PRJ.CRM_MIGRATION, parentId: null,
    title: 'Security review of the new CRM integration surface',
    description: 'Scoped OAuth apps, IP allowlist, and what the marketing connector can actually read. Vireo Health will ask for this in their next audit.',
    status: 'discovery', priority: 'high', assigneeId: USR.EMMA,
    watcherIds: [USR.ADMIN], tags: ['security'],
    startDate: '2026-08-12', dueDate: '2026-08-28', completedAt: null,
    estimateHours: 8, timeSpentHours: 2, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.CRM_SYSTEM]: 'marketing', [CF.CRM_OWNER]: USR.EMMA },
    createdAt: '2026-08-05', updatedAt: '2026-08-15',
  },

  /* ---------------------------------------------------------------- *
   * Mobile App Release 4.2
   * ---------------------------------------------------------------- */
  {
    id: 'tsk-mob-01', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: 'Fix crash on cold start (iOS 19.2)',
    description: 'Reproduces on iPhone 14 and newer when the saved-view cache is warm but the auth token has expired. 2.1% of sessions.',
    status: 'qa', priority: 'urgent', assigneeId: USR.PRIYA,
    watcherIds: [USR.JEN, USR.LISA, USR.MIKE],
    tags: ['crash', 'ios'],
    startDate: '2026-08-10', dueDate: '2026-08-14', completedAt: null,
    estimateHours: 6, timeSpentHours: 9, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOB_PLATFORM]: 'ios', [CF.MOB_POINTS]: 5, [CF.MOB_FLAG]: false, [CF.MOB_REVIEWER]: USR.MIKE },
    createdAt: '2026-08-08', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-mob-02', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: 'Offline mode for saved views',
    description: 'Field techs lose signal in basements and freight lifts. Cache the last 200 records per saved view and reconcile on reconnect.',
    status: 'in_progress', priority: 'high', assigneeId: USR.PRIYA,
    watcherIds: [USR.JEN, USR.DAVID],
    tags: ['offline'],
    startDate: '2026-08-03', dueDate: '2026-08-27', completedAt: null,
    estimateHours: 32, timeSpentHours: 18, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOB_PLATFORM]: 'both', [CF.MOB_POINTS]: 13, [CF.MOB_FLAG]: true, [CF.MOB_BUILD]: '2026-09-04', [CF.MOB_REVIEWER]: USR.MIKE },
    createdAt: '2026-07-20', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-mob-02a', projectId: PRJ.MOBILE_RELEASE, parentId: 'tsk-mob-02',
    title: 'Cache layer for list responses',
    description: 'SQLite-backed, keyed by view id plus filter hash.',
    status: 'shipped', priority: 'high', assigneeId: USR.PRIYA,
    watcherIds: [], tags: [],
    startDate: '2026-08-03', dueDate: '2026-08-12', completedAt: '2026-08-11',
    estimateHours: 12, timeSpentHours: 14, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOB_PLATFORM]: 'both', [CF.MOB_POINTS]: 5 },
    createdAt: '2026-08-03', updatedAt: '2026-08-11',
  },
  {
    id: 'tsk-mob-02b', projectId: PRJ.MOBILE_RELEASE, parentId: 'tsk-mob-02',
    title: 'Conflict resolution on reconnect',
    description: 'Last-write-wins is not acceptable for status changes. Surface a merge sheet when both sides changed.',
    status: 'in_progress', priority: 'high', assigneeId: USR.PRIYA,
    watcherIds: [USR.MIKE], tags: [],
    startDate: '2026-08-12', dueDate: '2026-08-25', completedAt: null,
    estimateHours: 16, timeSpentHours: 4, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOB_PLATFORM]: 'both', [CF.MOB_POINTS]: 8, [CF.MOB_FLAG]: true },
    createdAt: '2026-08-03', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-mob-03', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: 'Beta build to TestFlight for the Vireo pilot group',
    description: 'Twenty clinical systems users at Vireo Health get the beta first. They found the last two release blockers.',
    status: 'in_progress', priority: 'high', assigneeId: USR.MIKE,
    watcherIds: [USR.JEN, USR.LISA],
    tags: ['release'],
    startDate: '2026-08-14', dueDate: '2026-08-20', completedAt: null,
    estimateHours: 4, timeSpentHours: 1, milestone: false,
    // Started while still waiting on the crash fix — this is the case the
    // dependency warning exists for.
    dependencies: [{ type: 'waiting_on', taskId: 'tsk-mob-01' }],
    checklists: [], fields: { [CF.MOB_PLATFORM]: 'ios', [CF.MOB_BUILD]: '2026-08-20' },
    createdAt: '2026-08-04', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-mob-04', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: 'New onboarding illustrations for first run',
    description: 'Three screens. Match the Academy course art so a customer sees one visual language across product and training.',
    status: 'code_review', priority: 'medium', assigneeId: USR.JEN,
    watcherIds: [USR.MIKE], tags: ['design'],
    startDate: '2026-08-06', dueDate: '2026-08-21', completedAt: null,
    estimateHours: 10, timeSpentHours: 7, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOB_PLATFORM]: 'both', [CF.MOB_POINTS]: 3, [CF.MOB_REVIEWER]: USR.MIKE },
    createdAt: '2026-07-28', updatedAt: '2026-08-14',
  },
  {
    id: 'tsk-mob-05', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: 'Accessibility pass: dynamic type and VoiceOver labels',
    description: 'Every interactive element gets a label, and the task list has to survive the largest accessibility text size without truncating the title.',
    status: 'todo', priority: 'high', assigneeId: USR.MIKE,
    watcherIds: [USR.JEN, USR.DAVID], tags: ['a11y'],
    startDate: '2026-08-24', dueDate: '2026-09-01', completedAt: null,
    estimateHours: 14, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [
      {
        id: 'ck-mob-05a', name: 'Screens to audit',
        items: [
          { id: 'ci-1', text: 'Task list and filters', done: false },
          { id: 'ci-2', text: 'Task detail sheet', done: false },
          { id: 'ci-3', text: 'Board drag interactions', done: false },
          { id: 'ci-4', text: 'Sign-in and MFA', done: false },
        ],
      },
    ],
    fields: { [CF.MOB_PLATFORM]: 'both', [CF.MOB_POINTS]: 8, [CF.MOB_REVIEWER]: USR.JEN },
    createdAt: '2026-07-22', updatedAt: '2026-08-10',
  },
  {
    id: 'tsk-mob-06', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: '4.2 submitted to the App Store',
    description: 'Binary uploaded, review notes written, phased release set to 7 days.',
    status: 'todo', priority: 'urgent', assigneeId: USR.JEN,
    watcherIds: [USR.MIKE, USR.PRIYA, USR.LISA, USR.DAVID],
    tags: ['release'],
    startDate: '2026-09-07', dueDate: '2026-09-08', completedAt: null,
    estimateHours: 3, timeSpentHours: 0, milestone: true,
    dependencies: [{ type: 'waiting_on', taskId: 'tsk-mob-03' }],
    checklists: [], fields: { [CF.MOB_PLATFORM]: 'both', [CF.MOB_BUILD]: '2026-09-08' },
    createdAt: '2026-07-06', updatedAt: '2026-08-12',
  },
  {
    id: 'tsk-mob-07', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: 'Push notification opt-in rework',
    description: 'Legal want the consent copy rewritten before this ships. Parked until we have their wording.',
    status: 'blocked', priority: 'medium', assigneeId: USR.PRIYA,
    watcherIds: [USR.JEN], tags: ['legal'],
    startDate: '2026-08-18', dueDate: '2026-08-31', completedAt: null,
    estimateHours: 8, timeSpentHours: 2, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOB_PLATFORM]: 'both', [CF.MOB_POINTS]: 5, [CF.MOB_FLAG]: true },
    createdAt: '2026-07-30', updatedAt: '2026-08-13',
  },
  {
    id: 'tsk-mob-08', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: 'Ship 4.1.3 hotfix for the attachment upload timeout',
    description: 'Out to 100% on 5 August. Crash-free sessions back to 99.4%.',
    status: 'shipped', priority: 'urgent', assigneeId: USR.PRIYA,
    watcherIds: [USR.JEN], tags: ['hotfix'],
    startDate: '2026-08-03', dueDate: '2026-08-05', completedAt: '2026-08-05',
    estimateHours: 5, timeSpentHours: 6, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOB_PLATFORM]: 'both', [CF.MOB_POINTS]: 2, [CF.MOB_REVIEWER]: USR.MIKE },
    createdAt: '2026-08-03', updatedAt: '2026-08-05',
  },
  {
    id: 'tsk-mob-09', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: 'Release notes and support macros for 4.2',
    description: 'Support needs the macros live the day the phased release starts, not the day after the first ticket.',
    status: 'todo', priority: 'medium', assigneeId: USR.LISA,
    watcherIds: [USR.DEVON, USR.NADIA], tags: ['support'],
    startDate: '2026-09-01', dueDate: '2026-09-05', completedAt: null,
    estimateHours: 4, timeSpentHours: 0, milestone: false,
    dependencies: [],
    checklists: [
      {
        id: 'ck-mob-09a', name: 'Support readiness',
        items: [
          { id: 'ci-1', text: 'Macro: offline mode explained', done: false },
          { id: 'ci-2', text: 'Macro: how to clear the local cache', done: false },
          { id: 'ci-3', text: 'Update the mobile troubleshooting article', done: false },
        ],
      },
    ],
    fields: { [CF.MOB_PLATFORM]: 'both', [CF.MOB_BUILD]: '2026-09-08' },
    createdAt: '2026-08-02', updatedAt: '2026-08-11',
  },
  {
    id: 'tsk-mob-10', projectId: PRJ.MOBILE_RELEASE, parentId: null,
    title: 'Android 16 target SDK upgrade',
    description: 'Play Console deadline is 1 November. Foreground service types and the new photo picker are the two breaking changes.',
    status: 'code_review', priority: 'high', assigneeId: USR.PRIYA,
    watcherIds: [USR.MIKE], tags: ['android'],
    startDate: '2026-08-11', dueDate: '2026-08-22', completedAt: null,
    estimateHours: 12, timeSpentHours: 8, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOB_PLATFORM]: 'android', [CF.MOB_POINTS]: 8, [CF.MOB_REVIEWER]: USR.MIKE },
    createdAt: '2026-07-27', updatedAt: '2026-08-15',
  },

  /* ---------------------------------------------------------------- *
   * Chicago Office Move
   * ---------------------------------------------------------------- */
  {
    id: 'tsk-mov-01', projectId: PRJ.OFFICE_MOVE, parentId: null,
    title: 'Confirm freight elevator reservation with building ops',
    description: 'Both buildings, both weekends. The old building only releases the freight lift after 18:00 on a Friday.',
    status: 'ordered', priority: 'urgent', assigneeId: USR.LINDA,
    watcherIds: [USR.ADMIN], tags: ['logistics'],
    startDate: '2026-08-03', dueDate: '2026-08-11', completedAt: null,
    estimateHours: 2, timeSpentHours: 1, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOV_VENDOR]: 'Willis Building Operations', [CF.MOV_FLOOR]: 'both', [CF.MOV_CONTACT]: USR.LINDA, [CF.MOV_PO]: false },
    createdAt: '2026-07-24', updatedAt: '2026-08-14',
  },
  {
    id: 'tsk-mov-02', projectId: PRJ.OFFICE_MOVE, parentId: null,
    title: 'Desk and chair order for floors 12 and 14',
    description: '180 sit-stand desks, 200 task chairs, 14 collaboration tables. Delivery has to land the week before move day, not on it.',
    status: 'ordered', priority: 'high', assigneeId: USR.JAMES,
    watcherIds: [USR.LINDA, USR.MICHAEL], tags: ['procurement'],
    startDate: '2026-07-27', dueDate: '2026-08-28', completedAt: null,
    estimateHours: 12, timeSpentHours: 9, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOV_VENDOR]: 'Prairie Office Interiors', [CF.MOV_COST]: 68400, [CF.MOV_FLOOR]: 'both', [CF.MOV_PO]: true, [CF.MOV_CONTACT]: USR.JAMES },
    createdAt: '2026-07-21', updatedAt: '2026-08-12',
  },
  {
    id: 'tsk-mov-02a', projectId: PRJ.OFFICE_MOVE, parentId: 'tsk-mov-02',
    title: 'Get a third quote for task chairs',
    description: 'Procurement policy needs three quotes above $25k.',
    status: 'done', priority: 'medium', assigneeId: USR.JAMES,
    watcherIds: [USR.MICHAEL], tags: [],
    startDate: '2026-07-27', dueDate: '2026-08-04', completedAt: '2026-08-04',
    estimateHours: 3, timeSpentHours: 3, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOV_VENDOR]: 'Lakeshore Seating Co.', [CF.MOV_COST]: 22850, [CF.MOV_PO]: true },
    createdAt: '2026-07-27', updatedAt: '2026-08-04',
  },
  {
    id: 'tsk-mov-03', projectId: PRJ.OFFICE_MOVE, parentId: null,
    title: 'Network drops and patch panel install',
    description: 'Four drops per pod, fibre to the 14th floor comms room. The building will not let us pull cable during trading hours.',
    status: 'quoting', priority: 'high', assigneeId: USR.EMMA,
    watcherIds: [USR.LINDA], tags: ['it'],
    startDate: '2026-08-17', dueDate: '2026-09-02', completedAt: null,
    estimateHours: 16, timeSpentHours: 2, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOV_VENDOR]: 'NorthLine Cabling', [CF.MOV_COST]: 21750, [CF.MOV_FLOOR]: 'f14', [CF.MOV_WALK]: '2026-08-20', [CF.MOV_PO]: false, [CF.MOV_CONTACT]: USR.EMMA },
    createdAt: '2026-07-30', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-mov-04', projectId: PRJ.OFFICE_MOVE, parentId: null,
    title: 'Move day run of show',
    description: 'Hour-by-hour plan for both weekends, with a named owner per floor and a single number people call when something is wrong.',
    status: 'not_started', priority: 'high', assigneeId: USR.LINDA,
    watcherIds: [USR.ADMIN, USR.PATTI, USR.EMMA], tags: ['logistics'],
    startDate: '2026-09-14', dueDate: '2026-09-25', completedAt: null,
    estimateHours: 10, timeSpentHours: 0, milestone: false,
    dependencies: [{ type: 'waiting_on', taskId: 'tsk-mov-02' }],
    checklists: [
      {
        id: 'ck-mov-04a', name: 'Run of show sections',
        items: [
          { id: 'ci-1', text: 'Friday 18:00 — freight lift handover', done: false },
          { id: 'ci-2', text: 'Saturday — desks and monitors', done: false },
          { id: 'ci-3', text: 'Sunday — network cutover and smoke test', done: false },
          { id: 'ci-4', text: 'Monday 07:00 — floor walk with IT on site', done: false },
        ],
      },
    ],
    fields: { [CF.MOV_FLOOR]: 'both', [CF.MOV_CONTACT]: USR.LINDA },
    createdAt: '2026-08-01', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-mov-05', projectId: PRJ.OFFICE_MOVE, parentId: null,
    title: 'Decommission and wipe 40 desktops at the old site',
    description: 'Certificate of destruction required for anything that held customer data. Asset records move to Retired, not deleted.',
    status: 'not_started', priority: 'medium', assigneeId: USR.EMMA,
    watcherIds: [USR.ADMIN], tags: ['it', 'security'],
    startDate: '2026-09-21', dueDate: '2026-09-29', completedAt: null,
    estimateHours: 14, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOV_VENDOR]: 'SecureCycle IT Disposal', [CF.MOV_COST]: 3200, [CF.MOV_PO]: false },
    createdAt: '2026-08-04', updatedAt: '2026-08-04',
  },
  {
    id: 'tsk-mov-06', projectId: PRJ.OFFICE_MOVE, parentId: null,
    title: 'Update every asset location record to the new Chicago HQ',
    description: 'Anything still pointing at the old address after move day will route a repair courier to an empty building.',
    status: 'not_started', priority: 'medium', assigneeId: USR.ADMIN,
    watcherIds: [USR.EMMA], tags: ['assets'],
    startDate: '2026-09-28', dueDate: '2026-10-02', completedAt: null,
    estimateHours: 5, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOV_FLOOR]: 'both' },
    createdAt: '2026-08-06', updatedAt: '2026-08-06',
  },
  {
    id: 'tsk-mov-07', projectId: PRJ.OFFICE_MOVE, parentId: null,
    title: 'Badge access and visitor kiosk setup',
    description: 'Badge system provisioning for 180 people plus contractors, and a kiosk at each lift lobby.',
    status: 'quoting', priority: 'medium', assigneeId: USR.LINDA,
    watcherIds: [USR.PATTI], tags: ['security'],
    startDate: '2026-08-31', dueDate: '2026-09-16', completedAt: null,
    estimateHours: 8, timeSpentHours: 1, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOV_VENDOR]: 'Halsted Access Systems', [CF.MOV_COST]: 9200, [CF.MOV_FLOOR]: 'f12', [CF.MOV_WALK]: '2026-08-27', [CF.MOV_PO]: false },
    createdAt: '2026-08-05', updatedAt: '2026-08-14',
  },
  {
    id: 'tsk-mov-08', projectId: PRJ.OFFICE_MOVE, parentId: null,
    title: 'Cancel the old site cleaning contract',
    description: 'Notice period is 30 days. Served 8 August, ends 30 September.',
    status: 'done', priority: 'low', assigneeId: USR.MICHAEL,
    watcherIds: [], tags: ['finance'],
    startDate: '2026-08-06', dueDate: '2026-08-08', completedAt: '2026-08-08',
    estimateHours: 1, timeSpentHours: 1, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOV_VENDOR]: 'Clearview Facility Services', [CF.MOV_COST]: 0, [CF.MOV_PO]: true },
    createdAt: '2026-08-05', updatedAt: '2026-08-08',
  },
  {
    id: 'tsk-mov-09', projectId: PRJ.OFFICE_MOVE, parentId: null,
    title: 'Signage, wayfinding and room naming',
    description: 'Rooms are named after Chicago L stations. People need to find a room from a calendar invite without asking.',
    status: 'not_started', priority: 'low', assigneeId: USR.LINDA,
    watcherIds: [USR.PATTI], tags: ['workplace'],
    startDate: '2026-09-08', dueDate: '2026-09-19', completedAt: null,
    estimateHours: 6, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.MOV_VENDOR]: 'Loop Signworks', [CF.MOV_COST]: 4800, [CF.MOV_FLOOR]: 'both' },
    createdAt: '2026-08-07', updatedAt: '2026-08-07',
  },

  /* ---------------------------------------------------------------- *
   * Northwind Academy Launch
   *
   * These tasks point at CRS course ids — the work of building the training
   * platform is tracked in the same system that runs the training platform.
   * ---------------------------------------------------------------- */
  {
    id: 'tsk-aca-01', projectId: PRJ.ACADEMY_LAUNCH, parentId: null,
    title: 'Publish the Support Foundations course',
    description: 'Four modules assembled from knowledge atoms that already exist — triage, reading a ticket, SLAs and closing well. Nothing is written twice.',
    status: 'review', priority: 'urgent', assigneeId: USR.LISA,
    watcherIds: [USR.ADMIN, USR.SAM, USR.DEVON],
    tags: ['course'], courseId: CRS.SUPPORT_FOUNDATIONS,
    startDate: '2026-07-06', dueDate: '2026-08-21', completedAt: null,
    estimateHours: 20, timeSpentHours: 16, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.ACA_AUDIENCE]: 'agents', [CF.ACA_MINUTES]: 45, [CF.ACA_SME]: USR.LISA, [CF.ACA_LAUNCH]: '2026-08-24', [CF.ACA_CAPTIONS]: true },
    createdAt: '2026-07-02', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-aca-01a', projectId: PRJ.ACADEMY_LAUNCH, parentId: 'tsk-aca-01',
    title: 'Record the triage walkthrough',
    description: 'Screen capture over a real queue with customer names swapped for the demo org.',
    status: 'published', priority: 'high', assigneeId: USR.DEVON,
    watcherIds: [USR.LISA], tags: [],
    startDate: '2026-07-27', dueDate: '2026-08-07', completedAt: '2026-08-06',
    estimateHours: 6, timeSpentHours: 7, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.ACA_MINUTES]: 11, [CF.ACA_CAPTIONS]: true },
    createdAt: '2026-07-27', updatedAt: '2026-08-06',
  },
  {
    id: 'tsk-aca-01b', projectId: PRJ.ACADEMY_LAUNCH, parentId: 'tsk-aca-01',
    title: 'Add a knowledge check to every module',
    description: 'Three questions per module, and every wrong answer explains itself.',
    status: 'review', priority: 'high', assigneeId: USR.NADIA,
    watcherIds: [USR.LISA], tags: [],
    startDate: '2026-08-10', dueDate: '2026-08-19', completedAt: null,
    estimateHours: 8, timeSpentHours: 5, milestone: false,
    dependencies: [], checklists: [
      {
        id: 'ck-aca-01b', name: 'Checks written',
        items: [
          { id: 'ci-1', text: 'Triage basics', done: true },
          { id: 'ci-2', text: 'Reading a ticket', done: true },
          { id: 'ci-3', text: 'SLA explained', done: false },
          { id: 'ci-4', text: 'Closing well', done: false },
        ],
      },
    ],
    fields: { [CF.ACA_SME]: USR.LISA },
    createdAt: '2026-08-03', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-aca-02', projectId: PRJ.ACADEMY_LAUNCH, parentId: null,
    title: 'Draft the SLA lesson',
    description: 'The atom serves three surfaces: help centre article, agent side panel, and lesson three of Support Foundations. Write it once.',
    status: 'drafting', priority: 'high', assigneeId: USR.DEVON,
    watcherIds: [USR.LISA], tags: ['lesson'],
    startDate: '2026-08-03', dueDate: '2026-08-12', completedAt: null,
    estimateHours: 5, timeSpentHours: 3, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.ACA_AUDIENCE]: 'agents', [CF.ACA_MINUTES]: 12, [CF.ACA_SME]: USR.LISA, [CF.ACA_CAPTIONS]: false },
    createdAt: '2026-07-29', updatedAt: '2026-08-14',
  },
  {
    id: 'tsk-aca-03', projectId: PRJ.ACADEMY_LAUNCH, parentId: null,
    title: 'Outline the Customer Onboarding track',
    description: 'What a new Lumen or Vireo admin has to be able to do in week one: storefront setup, catalog import, payments, API keys.',
    status: 'outline', priority: 'high', assigneeId: USR.NADIA,
    watcherIds: [USR.LISA, USR.ADMIN],
    tags: ['course', 'external'], courseId: CRS.CUSTOMER_ONBOARDING,
    startDate: '2026-08-24', dueDate: '2026-09-11', completedAt: null,
    estimateHours: 12, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.ACA_AUDIENCE]: 'customers', [CF.ACA_MINUTES]: 60, [CF.ACA_SME]: USR.NADIA, [CF.ACA_LAUNCH]: '2026-09-30' },
    createdAt: '2026-07-20', updatedAt: '2026-08-11',
  },
  {
    id: 'tsk-aca-04', projectId: PRJ.ACADEMY_LAUNCH, parentId: null,
    title: 'Record screen captures for Storefront setup',
    description: 'Six short captures against the Fernbrook Studios demo tenant, which is small enough to fit on screen without scrolling.',
    status: 'recording', priority: 'medium', assigneeId: USR.NADIA,
    watcherIds: [USR.LISA], tags: ['external'],
    startDate: '2026-08-17', dueDate: '2026-08-26', completedAt: null,
    estimateHours: 8, timeSpentHours: 2, milestone: false,
    dependencies: [{ type: 'waiting_on', taskId: 'tsk-aca-03' }],
    checklists: [], fields: { [CF.ACA_AUDIENCE]: 'customers', [CF.ACA_MINUTES]: 18, [CF.ACA_CAPTIONS]: false },
    createdAt: '2026-08-02', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-aca-05', projectId: PRJ.ACADEMY_LAUNCH, parentId: null,
    title: 'Academy opens to customers',
    description: 'Customer academy live behind the portal sign-in, with the Customer Onboarding track published and certificates switched on.',
    status: 'outline', priority: 'urgent', assigneeId: USR.LISA,
    watcherIds: [USR.ADMIN, USR.NADIA, USR.DEVON, USR.SAM],
    tags: ['launch'],
    startDate: '2026-09-28', dueDate: '2026-09-30', completedAt: null,
    estimateHours: 6, timeSpentHours: 0, milestone: true,
    dependencies: [{ type: 'waiting_on', taskId: 'tsk-aca-03' }],
    checklists: [], fields: { [CF.ACA_AUDIENCE]: 'customers', [CF.ACA_LAUNCH]: '2026-09-30' },
    createdAt: '2026-07-01', updatedAt: '2026-08-13',
  },
  {
    id: 'tsk-aca-06', projectId: PRJ.ACADEMY_LAUNCH, parentId: null,
    title: 'Certification badge artwork',
    description: 'One badge per curriculum, legible at 32px, and it has to survive being pasted into a LinkedIn profile.',
    status: 'drafting', priority: 'low', assigneeId: USR.MIKE,
    watcherIds: [USR.LISA], tags: ['design'],
    startDate: '2026-08-19', dueDate: '2026-09-08', completedAt: null,
    estimateHours: 6, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.ACA_AUDIENCE]: 'both', [CF.ACA_SME]: USR.MIKE },
    createdAt: '2026-08-08', updatedAt: '2026-08-08',
  },
  {
    id: 'tsk-aca-07', projectId: PRJ.ACADEMY_LAUNCH, parentId: null,
    title: 'Wire course completion into the agent scorecard',
    description: 'A team lead should see certification status next to CSAT, in one place, without exporting anything.',
    status: 'outline', priority: 'medium', assigneeId: USR.ADMIN,
    watcherIds: [USR.LISA], tags: ['reporting'],
    startDate: '2026-09-21', dueDate: '2026-10-07', completedAt: null,
    estimateHours: 10, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.ACA_AUDIENCE]: 'agents', [CF.ACA_SME]: USR.ADMIN },
    createdAt: '2026-08-09', updatedAt: '2026-08-09',
  },
  {
    id: 'tsk-aca-08', projectId: PRJ.ACADEMY_LAUNCH, parentId: null,
    title: "Pilot with Sam's 30-day onboarding cohort",
    description: 'Three new agents ran the draft course end to end. Two lessons were too long and the macros lesson needed a rewrite.',
    status: 'published', priority: 'high', assigneeId: USR.LISA,
    watcherIds: [USR.SAM, USR.ADMIN], tags: ['pilot'],
    startDate: '2026-07-13', dueDate: '2026-08-06', completedAt: '2026-08-06',
    estimateHours: 8, timeSpentHours: 10, milestone: false,
    dependencies: [],
    checklists: [
      {
        id: 'ck-aca-08a', name: 'Pilot feedback actioned',
        items: [
          { id: 'ci-1', text: 'Split the escalation lesson in two', done: true },
          { id: 'ci-2', text: 'Rewrite the macros walkthrough', done: true },
          { id: 'ci-3', text: 'Add a glossary to module one', done: true },
        ],
      },
    ],
    fields: { [CF.ACA_AUDIENCE]: 'agents', [CF.ACA_MINUTES]: 45, [CF.ACA_SME]: USR.LISA, [CF.ACA_CAPTIONS]: true },
    createdAt: '2026-07-10', updatedAt: '2026-08-06',
  },
  {
    id: 'tsk-aca-09', projectId: PRJ.ACADEMY_LAUNCH, parentId: null,
    title: 'Refresh the Change Management course for the new CAB process',
    description: 'The approval thresholds changed in July. The course still teaches the old ones, which is worse than teaching nothing.',
    status: 'drafting', priority: 'high', assigneeId: USR.EMMA,
    watcherIds: [USR.ADMIN], tags: ['course'], courseId: CRS.CHANGE_MANAGEMENT,
    startDate: '2026-08-31', dueDate: '2026-09-23', completedAt: null,
    estimateHours: 10, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [],
    fields: { [CF.ACA_AUDIENCE]: 'agents', [CF.ACA_MINUTES]: 30, [CF.ACA_SME]: USR.EMMA, [CF.ACA_CAPTIONS]: false },
    createdAt: '2026-08-10', updatedAt: '2026-08-12',
  },

  /* ---------------------------------------------------------------- *
   * Personal tasks — projectId null, teal, no custom fields.
   * ---------------------------------------------------------------- */
  {
    id: 'tsk-me-01', projectId: null, parentId: null,
    title: 'Review Q3 service desk metrics before the ops review',
    description: 'Deflection is up but first response on the Support queue slipped two days running. Have an answer for why.',
    status: 'in_progress', priority: 'high', assigneeId: USR.ADMIN,
    watcherIds: [], tags: ['ops-review'],
    startDate: '2026-08-14', dueDate: '2026-08-18', completedAt: null,
    estimateHours: 3, timeSpentHours: 1, milestone: false,
    dependencies: [], checklists: [], fields: {},
    createdAt: '2026-08-12', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-me-02', projectId: null, parentId: null,
    title: 'Submit Q3 expense report',
    description: 'Two conference nights and the Austin trip. Finance closes the quarter on the 20th.',
    status: 'todo', priority: 'medium', assigneeId: USR.ADMIN,
    watcherIds: [], tags: ['finance'],
    startDate: null, dueDate: '2026-08-10', completedAt: null,
    estimateHours: 1, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [], fields: {},
    createdAt: '2026-08-03', updatedAt: '2026-08-03',
  },
  {
    id: 'tsk-me-03', projectId: null, parentId: null,
    title: 'Prep for the 30-day check-in with Sam Whitfield',
    description: 'First support hire since the Academy pilot. Worth asking which lessons actually helped on a live queue.',
    status: 'todo', priority: 'high', assigneeId: USR.ADMIN,
    watcherIds: [], tags: ['people'],
    startDate: '2026-08-16', dueDate: '2026-08-17', completedAt: null,
    estimateHours: 1, timeSpentHours: 0, milestone: false,
    dependencies: [],
    checklists: [
      {
        id: 'ck-me-03a', name: 'Talking points',
        items: [
          { id: 'ci-1', text: 'Course completion vs. first-contact resolution', done: true },
          { id: 'ci-2', text: 'Which macros he actually uses', done: false },
          { id: 'ci-3', text: 'Shadowing rota for September', done: false },
        ],
      },
    ],
    fields: {},
    createdAt: '2026-08-11', updatedAt: '2026-08-15',
  },
  {
    id: 'tsk-me-04', projectId: null, parentId: null,
    title: 'Approve the Austin support centre headcount plan',
    description: 'Two agents in Q4, one in Q1. Lisa has the ramp plan; it needs a decision before the budget lock.',
    status: 'todo', priority: 'high', assigneeId: USR.ADMIN,
    watcherIds: [], tags: ['people'],
    startDate: null, dueDate: '2026-08-21', completedAt: null,
    estimateHours: 2, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [], fields: {},
    createdAt: '2026-08-07', updatedAt: '2026-08-07',
  },
  {
    id: 'tsk-me-05', projectId: null, parentId: null,
    title: 'Draft the board update on deflection rate',
    description: 'One slide. Self-service resolution as a share of all contacts, with the article that moved the number most.',
    status: 'todo', priority: 'medium', assigneeId: USR.ADMIN,
    watcherIds: [], tags: ['board'],
    startDate: '2026-08-20', dueDate: '2026-08-25', completedAt: null,
    estimateHours: 3, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [], fields: {},
    createdAt: '2026-08-09', updatedAt: '2026-08-09',
  },
  {
    id: 'tsk-me-05a', projectId: null, parentId: 'tsk-me-05',
    title: 'Pull deflection numbers out of Knowledge',
    description: 'Views, helpful votes and tickets avoided per article for the last 90 days.',
    status: 'todo', priority: 'medium', assigneeId: USR.ADMIN,
    watcherIds: [], tags: [],
    startDate: null, dueDate: '2026-08-21', completedAt: null,
    estimateHours: 1, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [], fields: {},
    createdAt: '2026-08-09', updatedAt: '2026-08-09',
  },
  {
    id: 'tsk-me-06', projectId: null, parentId: null,
    title: 'Refresh the SOC 2 evidence folder for the November audit',
    description: 'Access review exports, change approval samples, and the offboarding checklist runs.',
    status: 'todo', priority: 'low', assigneeId: USR.ADMIN,
    watcherIds: [], tags: ['compliance'],
    startDate: null, dueDate: '2026-09-04', completedAt: null,
    estimateHours: 4, timeSpentHours: 0, milestone: false,
    dependencies: [], checklists: [], fields: {},
    createdAt: '2026-08-06', updatedAt: '2026-08-06',
  },
  {
    id: 'tsk-me-07', projectId: null, parentId: null,
    title: 'Book travel for the Chicago site walkthrough',
    description: 'Two nights around the 20th so the walkthrough and the network survey land in the same trip.',
    status: 'completed', priority: 'medium', assigneeId: USR.ADMIN,
    watcherIds: [], tags: [],
    startDate: '2026-08-05', dueDate: '2026-08-08', completedAt: '2026-08-07',
    estimateHours: 1, timeSpentHours: 1, milestone: false,
    dependencies: [], checklists: [], fields: {},
    createdAt: '2026-08-05', updatedAt: '2026-08-07',
  },
];
