/**
 * Engine tests — conditions and approvals.  Run: bun test/engines.js
 *
 * These two modules decide who has to approve what and why a rule fired. They
 * are pure functions with no UI, so they are cheap to test and expensive to get
 * wrong silently. Everything below asserts behaviour a user would notice.
 */

import {
  evaluate, evaluateRow, explain, summarize, countRows,
  operatorsFor, defaultRowFor, readPath,
} from '../src/lib/conditions.js';
import {
  resolveApprovers, describeApprover, matchingPolicies, startApproval,
  canDecide, decide, stageOutcome, progress, isOverdue, applyTimeout, cancelApproval,
} from '../src/lib/approvals.js';

let pass = 0;
const failures = [];
const ok = (name, cond, extra) => {
  if (cond) { pass++; return; }
  failures.push(name + (extra !== undefined ? `  → got ${JSON.stringify(extra)}` : ''));
};

/* ================================================================== *
 * conditions
 * ================================================================== */

const ctx = {
  ticket: { title: 'Production down — checkout failing', priority: 'urgent', labels: ['billing', 'p1'], status: 'open' },
  requester: { department: 'Sales', vip: true, isExternal: true },
  org: { plan: 'Enterprise' },
  answers: { amount: 1200, accessLevel: 'admin', startDate: '2026-09-01' },
  change: { changeType: 'normal', affectsProduction: true },
  __now: '2026-08-16T09:00:00Z',
};

ok('readPath walks dots', readPath(ctx, 'org.plan') === 'Enterprise');
ok('readPath survives a missing branch', readPath(ctx, 'nope.deep.path') === undefined);

ok('is', evaluateRow({ field: 'org.plan', op: 'is', value: 'Enterprise' }, ctx));
ok('is is case-insensitive', evaluateRow({ field: 'org.plan', op: 'is', value: 'enterprise' }, ctx));
ok('is_not', evaluateRow({ field: 'org.plan', op: 'is_not', value: 'Starter' }, ctx));
ok('contains', evaluateRow({ field: 'ticket.title', op: 'contains', value: 'production down' }, ctx));
ok('not_contains', evaluateRow({ field: 'ticket.title', op: 'not_contains', value: 'refund' }, ctx));
ok('starts_with', evaluateRow({ field: 'ticket.title', op: 'starts_with', value: 'Production' }, ctx));
ok('is_empty on a missing field', evaluateRow({ field: 'ticket.assignee', op: 'is_empty' }, ctx));
ok('is_not_empty on a present field', evaluateRow({ field: 'ticket.title', op: 'is_not_empty' }, ctx));

ok('is_one_of', evaluateRow({ field: 'ticket.priority', op: 'is_one_of', value: ['high', 'urgent'] }, ctx));
ok('is_none_of', evaluateRow({ field: 'ticket.priority', op: 'is_none_of', value: ['low', 'medium'] }, ctx));

ok('gt', evaluateRow({ field: 'answers.amount', op: 'gt', value: 500 }, ctx));
ok('gt is false at the boundary', !evaluateRow({ field: 'answers.amount', op: 'gt', value: 1200 }, ctx));
ok('gte is true at the boundary', evaluateRow({ field: 'answers.amount', op: 'gte', value: 1200 }, ctx));
ok('lt', evaluateRow({ field: 'answers.amount', op: 'lt', value: 5000 }, ctx));
ok('between', evaluateRow({ field: 'answers.amount', op: 'between', value: [1000, 2000] }, ctx));
ok('between excludes outside', !evaluateRow({ field: 'answers.amount', op: 'between', value: [1, 999] }, ctx));

ok('is_true', evaluateRow({ field: 'requester.vip', op: 'is_true' }, ctx));
ok('is_false on a true field', !evaluateRow({ field: 'requester.vip', op: 'is_false' }, ctx));
// A missing boolean must not read as false — that silently skips approval steps.
ok('is_true on a missing field is false', !evaluateRow({ field: 'requester.nope', op: 'is_true' }, ctx));
ok('is_false on a missing field is also false', !evaluateRow({ field: 'requester.nope', op: 'is_false' }, ctx));

ok('includes on a list', evaluateRow({ field: 'ticket.labels', op: 'includes', value: 'billing' }, ctx));
ok('not_includes on a list', evaluateRow({ field: 'ticket.labels', op: 'not_includes', value: 'refund' }, ctx));

ok('before', evaluateRow({ field: 'answers.startDate', op: 'before', value: '2026-10-01' }, ctx));
ok('after', evaluateRow({ field: 'answers.startDate', op: 'after', value: '2026-08-01' }, ctx));
ok('date op with a junk value is false',
  !evaluateRow({ field: 'answers.startDate', op: 'before', value: 'not-a-date' }, ctx));

ok('an unknown operator is false, never a throw',
  evaluateRow({ field: 'org.plan', op: 'wat', value: 1 }, ctx) === false);

// groups
const allGroup = {
  match: 'all',
  rows: [
    { field: 'answers.amount', op: 'gt', value: 500 },
    { field: 'org.plan', op: 'is', value: 'Enterprise' },
  ],
};
ok('all group matches when both match', evaluate(allGroup, ctx));

const anyGroup = {
  match: 'any',
  rows: [
    { field: 'org.plan', op: 'is', value: 'Starter' },
    { field: 'requester.vip', op: 'is_true' },
  ],
};
ok('any group matches on one', evaluate(anyGroup, ctx));

const nested = {
  match: 'all',
  rows: [
    { field: 'answers.amount', op: 'gt', value: 500 },
    { match: 'any', rows: [
      { field: 'org.plan', op: 'is', value: 'Starter' },
      { field: 'requester.vip', op: 'is_true' },
    ] },
  ],
};
ok('nested group evaluates', evaluate(nested, ctx));
ok('nested group fails when the inner any fails', !evaluate({
  match: 'all',
  rows: [
    { field: 'answers.amount', op: 'gt', value: 500 },
    { match: 'any', rows: [
      { field: 'org.plan', op: 'is', value: 'Starter' },
      { field: 'requester.vip', op: 'is_false' },
    ] },
  ],
}, ctx));

// An empty condition means "always" — a policy with no conditions must apply,
// not silently never apply.
ok('an empty group matches everything', evaluate({ match: 'all', rows: [] }, ctx));
ok('a null group matches everything', evaluate(null, ctx));

ok('countRows counts leaves through nesting', countRows(nested) === 3, countRows(nested));
ok('summarize is human-readable', /Amount requested/.test(summarize(allGroup)), summarize(allGroup));
ok('summarize of an empty group reads "Always"', summarize({ match: 'all', rows: [] }) === 'Always');

const trace = explain(nested, ctx);
ok('explain returns a tree', trace.kind === 'group' && trace.rows.length === 2);
ok('explain marks the overall verdict', trace.matched === true);
ok('explain records the ACTUAL value', trace.rows[0].actual === 1200, trace.rows[0].actual);
ok('explain labels the row', /Amount requested/.test(trace.rows[0].label), trace.rows[0].label);
ok('explain recurses into groups', trace.rows[1].kind === 'group' && trace.rows[1].rows.length === 2);

ok('operatorsFor(number) offers comparison', operatorsFor('number').some(o => o.op === 'gte'));
ok('operatorsFor(text) does NOT offer comparison', !operatorsFor('text').some(o => o.op === 'gte'));
ok('defaultRowFor builds a usable row', (() => {
  const r = defaultRowFor('answers.amount');
  return r.field === 'answers.amount' && typeof r.op === 'string';
})());

/* ================================================================== *
 * approvals
 * ================================================================== */

const directory = [
  { id: 'u-sam', name: 'Sam', department: 'Support', managerId: 'u-lisa', role: 'agent' },
  { id: 'u-lisa', name: 'Lisa', department: 'Support', managerId: 'u-alex', role: 'manager' },
  { id: 'u-alex', name: 'Alex', department: 'Operations', managerId: null, role: 'admin' },
  { id: 'u-mgarcia', name: 'Michael', department: 'Finance', managerId: 'u-alex', role: 'manager' },
  { id: 'u-emma', name: 'Emma', department: 'IT', managerId: 'u-alex', role: 'agent' },
];
const queues = [{ id: 'q-it', name: 'IT Support', memberIds: ['u-emma', 'u-alex'] }];
const actx = { requesterId: 'u-sam', directory, queues, answers: { amount: 1200 } };

ok('resolve a named user', resolveApprovers({ kind: 'user', userId: 'u-lisa' }, actx).join() === 'u-lisa');
ok('a named user who does not exist resolves to nobody',
  resolveApprovers({ kind: 'user', userId: 'u-ghost' }, actx).length === 0);
ok("resolve the requester's manager",
  resolveApprovers({ kind: 'manager' }, actx).join() === 'u-lisa');
ok('resolve the skip-level manager',
  resolveApprovers({ kind: 'manager_of_manager' }, actx).join() === 'u-alex');
ok('skip-level from the top resolves to nobody',
  resolveApprovers({ kind: 'manager_of_manager' }, { ...actx, requesterId: 'u-lisa' }).join() === '');
ok('resolve a queue to its members',
  resolveApprovers({ kind: 'queue', queueId: 'q-it' }, actx).join() === 'u-emma,u-alex');
ok('resolve a department head',
  resolveApprovers({ kind: 'department_head', department: 'Finance' }, actx).join() === 'u-mgarcia');
ok('resolve a role', resolveApprovers({ kind: 'role', role: 'manager' }, actx).length === 2);
ok('an unknown approver kind resolves to nobody, not everybody',
  resolveApprovers({ kind: 'nonsense' }, actx).length === 0);
ok('describeApprover names a dynamic approver',
  describeApprover({ kind: 'manager' }, actx) === "Requester's manager");

const policy = {
  id: 'pol-spend', name: 'Spend over $500', enabled: true,
  appliesWhen: { match: 'all', rows: [{ field: 'answers.amount', op: 'gt', value: 500 }] },
  stages: [
    { id: 's1', name: 'Manager', approvers: [{ kind: 'manager' }], rule: 'all', dueInHours: 24, onTimeout: 'escalate', escalateTo: { kind: 'manager_of_manager' } },
    { id: 's2', name: 'Finance', approvers: [{ kind: 'department_head', department: 'Finance' }], rule: 'all', dueInHours: 48, onTimeout: 'wait' },
  ],
};

ok('a policy matches its context', matchingPolicies([policy], actx).length === 1);
ok('a policy does not match a smaller amount',
  matchingPolicies([policy], { ...actx, answers: { amount: 100 } }).length === 0);
ok('a disabled policy never matches',
  matchingPolicies([{ ...policy, enabled: false }], actx).length === 0);

let req = startApproval(policy, actx, {
  id: 'apr-1', subject: 'Adobe CC licence', targetType: 'ticket', targetId: 'tkt-1',
  now: '2026-08-16T09:00:00.000Z',
});

ok('a new request is awaiting', req.state === 'awaiting');
ok('it starts at stage 0', req.currentStage === 0);
ok('stage 1 resolved the manager', req.stages[0].approverIds.join() === 'u-lisa');
ok('stage 1 is awaiting, stage 2 pending',
  req.stages[0].state === 'awaiting' && req.stages[1].state === 'pending');
ok('approvers were frozen onto the request', Array.isArray(req.stages[0].approverIds));
ok('a due time was set from dueInHours', !!req.stages[0].dueAt);
ok('no stage is unresolved in this policy', req.stages.every(s => !s.unresolved));

ok('the resolved approver can decide', canDecide(req, 'u-lisa'));
ok('someone else cannot decide', !canDecide(req, 'u-emma'));
ok('a later-stage approver cannot decide yet', !canDecide(req, 'u-mgarcia'));

const before = req;
req = decide(req, { approverId: 'u-lisa', verdict: 'approved', comment: 'ok', now: '2026-08-16T10:00:00.000Z' });
ok('decide does not mutate the original', before.stages[0].decisions.length === 0);
ok('the decision was recorded', req.stages[0].decisions.length === 1);
ok('it advanced to stage 2', req.currentStage === 1, req.currentStage);
ok('it is still awaiting overall', req.state === 'awaiting');
ok('stage 1 is marked approved', req.stages[0].state === 'approved');
ok('stage 2 became awaiting', req.stages[1].state === 'awaiting');
ok('the same person cannot decide twice', !canDecide(req, 'u-lisa'));

const p = progress(req);
ok('progress reports stage 2 of 2', p.stageNumber === 2 && p.totalStages === 2, p);

req = decide(req, { approverId: 'u-mgarcia', verdict: 'approved', now: '2026-08-16T11:00:00.000Z' });
ok('the request is approved once every stage passes', req.state === 'approved', req.state);
ok('resolvedAt was stamped', !!req.resolvedAt);
ok('an approved request accepts no further decisions', !canDecide(req, 'u-mgarcia'));

// rejection stops by default
let rej = startApproval(policy, actx, { id: 'apr-2', subject: 'x', targetType: 'ticket', targetId: 't', now: '2026-08-16T09:00:00.000Z' });
rej = decide(rej, { approverId: 'u-lisa', verdict: 'rejected', comment: 'too much', now: '2026-08-16T10:00:00.000Z' });
ok('a rejection stops the request', rej.state === 'rejected');
ok('it did not advance past the rejecting stage', rej.currentStage === 0);

// stage rules
ok('rule=all is pending until everyone approves', stageOutcome({
  rule: 'all', approverIds: ['a', 'b'], decisions: [{ approverId: 'a', verdict: 'approved' }],
}) === 'pending');
ok('rule=all approves when everyone approves', stageOutcome({
  rule: 'all', approverIds: ['a', 'b'],
  decisions: [{ approverId: 'a', verdict: 'approved' }, { approverId: 'b', verdict: 'approved' }],
}) === 'approved');
ok('rule=any approves on the first approval', stageOutcome({
  rule: 'any', approverIds: ['a', 'b', 'c'], decisions: [{ approverId: 'a', verdict: 'approved' }],
}) === 'approved');
ok('rule=any rejects only when everyone rejects', stageOutcome({
  rule: 'any', approverIds: ['a', 'b'], decisions: [{ approverId: 'a', verdict: 'rejected' }],
}) === 'pending');
ok('rule=quorum approves at the threshold', stageOutcome({
  rule: 'quorum', quorum: 2, approverIds: ['a', 'b', 'c'],
  decisions: [{ approverId: 'a', verdict: 'approved' }, { approverId: 'b', verdict: 'approved' }],
}) === 'approved');
ok('rule=quorum rejects once the quorum is unreachable', stageOutcome({
  rule: 'quorum', quorum: 3, approverIds: ['a', 'b', 'c'],
  decisions: [{ approverId: 'a', verdict: 'rejected' }],
}) === 'rejected');
ok('rule=quorum still pending while reachable', stageOutcome({
  rule: 'quorum', quorum: 2, approverIds: ['a', 'b', 'c'],
  decisions: [{ approverId: 'a', verdict: 'rejected' }],
}) === 'pending');

// a stage that resolves to nobody must be FLAGGED, never silently skipped
const orphan = startApproval({
  id: 'pol-x', name: 'Orphan', enabled: true, appliesWhen: null,
  stages: [{ id: 's', name: 'Nobody', approvers: [{ kind: 'user', userId: 'u-ghost' }], rule: 'all' }],
}, actx, { id: 'apr-3', subject: 'x', targetType: 'ticket', targetId: 't', now: '2026-08-16T09:00:00.000Z' });
ok('an unresolvable stage is flagged', orphan.stages[0].unresolved === true);
ok('an unresolvable stage does not auto-approve the request', orphan.state === 'awaiting');

// timeouts
const late = '2026-08-18T09:00:00.000Z';
let timed = startApproval(policy, actx, { id: 'apr-4', subject: 'x', targetType: 'ticket', targetId: 't', now: '2026-08-16T09:00:00.000Z' });
ok('not overdue immediately', !isOverdue(timed, '2026-08-16T10:00:00.000Z'));
ok('overdue after the due time', isOverdue(timed, late));
timed = applyTimeout(timed, actx, late);
ok('escalation added the skip-level approver', timed.stages[0].approverIds.includes('u-alex'));
ok('escalation is marked', timed.stages[0].escalated === true);
ok('escalation reset the clock', new Date(timed.stages[0].dueAt) > new Date(late));

let autoApp = startApproval({
  ...policy,
  stages: [{ id: 's1', name: 'M', approvers: [{ kind: 'manager' }], rule: 'all', dueInHours: 1, onTimeout: 'auto_approve' }],
}, actx, { id: 'apr-5', subject: 'x', targetType: 'ticket', targetId: 't', now: '2026-08-16T09:00:00.000Z' });
autoApp = applyTimeout(autoApp, actx, late);
ok('auto_approve resolves the request', autoApp.state === 'approved', autoApp.state);
ok('the auto-approved stage is marked as timed out', autoApp.stages[0].timedOut === true);

// cancellation
let cancelled = startApproval(policy, actx, { id: 'apr-6', subject: 'x', targetType: 'ticket', targetId: 't', now: '2026-08-16T09:00:00.000Z' });
cancelled = cancelApproval(cancelled, { reason: 'withdrawn', now: late });
ok('cancel sets the state', cancelled.state === 'cancelled');
ok('a cancelled request accepts no decisions', !canDecide(cancelled, 'u-lisa'));

/* ================================================================== */

if (failures.length) {
  console.error(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.error('  FAIL  ' + f);
  console.error(`\n${pass} passed, ${failures.length} failed\n`);
  process.exit(1);
}
console.log(`engines: ${pass} passed`);
