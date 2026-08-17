/**
 * The approval engine.
 *
 * v1 modelled approvals but never ran them — a workflow was a list of labels.
 * This actually executes: a policy resolves to concrete approvers, the request
 * advances stage by stage, and each decision is recorded with who, when and why.
 *
 * ---------------------------------------------------------------------------
 * MODEL
 *
 *   ApprovalPolicy {
 *     id, name, description,
 *     appliesWhen: <condition group>      // from lib/conditions.js
 *     stages: [ Stage ]                   // run in order
 *     onReject: 'stop' | 'continue'
 *   }
 *
 *   Stage {
 *     id, name,
 *     approvers: [ ApproverSpec ],
 *     rule: 'all' | 'any' | 'quorum',     // unanimous / first-response / N-of-M
 *     quorum: number,                     // when rule === 'quorum'
 *     dueInHours: number,                 // escalation clock
 *     onTimeout: 'escalate' | 'auto_approve' | 'auto_reject' | 'wait'
 *     escalateTo: ApproverSpec
 *   }
 *
 *   ApproverSpec — how a stage names who decides. Static ids are the easy case;
 *   the interesting ones are dynamic and resolved against the request:
 *     { kind: 'user',    userId }
 *     { kind: 'queue',   queueId }         // anyone in the queue
 *     { kind: 'manager' }                  // the requester's manager
 *     { kind: 'manager_of_manager' }       // skip-level, for large amounts
 *     { kind: 'department_head', department }
 *     { kind: 'role',    role }
 *
 *   ApprovalRequest — the running instance:
 *     { id, policyId, subject, targetType, targetId, context,
 *       state: 'awaiting'|'approved'|'rejected'|'expired'|'cancelled',
 *       stages: [ { ...stage, decisions: [Decision], state } ],
 *       currentStage: number, createdAt, resolvedAt }
 *
 *   Decision { approverId, verdict: 'approved'|'rejected', comment, at }
 * ---------------------------------------------------------------------------
 */

import { evaluate, explain } from './conditions.js';

export const APPROVER_KINDS = [
  { kind: 'user',              label: 'A specific person' },
  { kind: 'queue',             label: 'Anyone in a queue' },
  { kind: 'manager',           label: "The requester's manager" },
  { kind: 'manager_of_manager',label: "The requester's skip-level manager" },
  { kind: 'department_head',   label: 'A department head' },
  { kind: 'role',              label: 'Anyone with a role' },
];

export const STAGE_RULES = [
  { rule: 'all',    label: 'Everyone must approve',  hint: 'Unanimous. Any rejection fails the stage.' },
  { rule: 'any',    label: 'Any one approves',       hint: 'First decision wins.' },
  { rule: 'quorum', label: 'A quorum approves',      hint: 'N of M must approve.' },
];

export const TIMEOUT_ACTIONS = [
  { value: 'escalate',     label: 'Escalate to someone else' },
  { value: 'auto_approve', label: 'Approve automatically' },
  { value: 'auto_reject',  label: 'Reject automatically' },
  { value: 'wait',         label: 'Keep waiting' },
];

/* ------------------------------------------------------------------ *
 * Resolving approvers
 * ------------------------------------------------------------------ */

/**
 * Turn an ApproverSpec into concrete person ids, given the request context.
 * Returns [] when it cannot resolve — the caller must treat that as a problem
 * rather than as "nobody needs to approve", which is how approval steps get
 * silently skipped in real systems.
 *
 * @param spec  ApproverSpec
 * @param ctx   { requesterId, directory, queues, ... }
 */
export function resolveApprovers(spec, ctx) {
  const dir = ctx.directory || [];
  const person = (id) => dir.find(p => p.id === id) || null;

  switch (spec?.kind) {
    case 'user':
      return person(spec.userId) ? [spec.userId] : [];

    case 'queue': {
      const q = (ctx.queues || []).find(x => x.id === spec.queueId);
      return (q?.memberIds || []).filter(id => person(id));
    }

    case 'manager': {
      const me = person(ctx.requesterId);
      return me?.managerId && person(me.managerId) ? [me.managerId] : [];
    }

    case 'manager_of_manager': {
      const me = person(ctx.requesterId);
      const mgr = me?.managerId ? person(me.managerId) : null;
      return mgr?.managerId && person(mgr.managerId) ? [mgr.managerId] : [];
    }

    case 'department_head': {
      const dept = spec.department || person(ctx.requesterId)?.department;
      return dir.filter(p => p.department === dept && p.role === 'manager').map(p => p.id);
    }

    case 'role':
      return dir.filter(p => p.role === spec.role).map(p => p.id);

    default:
      return [];
  }
}

/** Human-readable description of an approver spec, for the policy editor. */
export function describeApprover(spec, ctx = {}) {
  const dir = ctx.directory || [];
  const name = (id) => dir.find(p => p.id === id)?.name || id;
  switch (spec?.kind) {
    case 'user': return name(spec.userId);
    case 'queue': return `Anyone in ${(ctx.queues || []).find(q => q.id === spec.queueId)?.name || 'queue'}`;
    case 'manager': return "Requester's manager";
    case 'manager_of_manager': return "Requester's skip-level manager";
    case 'department_head': return `${spec.department || "Requester's"} department head`;
    case 'role': return `Anyone with role “${spec.role}”`;
    default: return 'Unresolved approver';
  }
}

/* ------------------------------------------------------------------ *
 * Starting a request
 * ------------------------------------------------------------------ */

/** Which policies apply to this context, in declaration order. */
export function matchingPolicies(policies, ctx) {
  return (policies || []).filter(p => p.enabled !== false && evaluate(p.appliesWhen, ctx));
}

/** Explain why each policy did or did not match — powers the rule tester. */
export function explainPolicies(policies, ctx) {
  return (policies || []).map(p => ({
    policy: p,
    matched: p.enabled !== false && evaluate(p.appliesWhen, ctx),
    enabled: p.enabled !== false,
    trace: explain(p.appliesWhen, ctx),
  }));
}

/**
 * Instantiate a policy into a running ApprovalRequest.
 * Approvers are resolved AT CREATION and frozen onto the request, so a later
 * reorg cannot silently change who was asked.
 */
export function startApproval(policy, ctx, { id, subject, targetType, targetId, now }) {
  const at = now || new Date().toISOString();
  const stages = (policy.stages || []).map((stage, i) => {
    const approverIds = dedupe(
      (stage.approvers || []).flatMap(spec => resolveApprovers(spec, ctx)),
    );
    return {
      ...stage,
      index: i,
      approverIds,
      // A stage that resolved to nobody is a configuration fault. Surfaced,
      // never silently skipped.
      unresolved: approverIds.length === 0,
      decisions: [],
      state: i === 0 ? 'awaiting' : 'pending',
      startedAt: i === 0 ? at : null,
      dueAt: i === 0 ? addHours(at, stage.dueInHours) : null,
    };
  });

  return {
    id,
    policyId: policy.id,
    policyName: policy.name,
    subject,
    targetType,
    targetId,
    requesterId: ctx.requesterId,
    context: ctx,
    stages,
    currentStage: 0,
    state: stages.length ? 'awaiting' : 'approved',
    createdAt: at,
    resolvedAt: stages.length ? null : at,
  };
}

/* ------------------------------------------------------------------ *
 * Deciding
 * ------------------------------------------------------------------ */

/** Can this person act on the request right now? */
export function canDecide(request, userId) {
  if (!request || request.state !== 'awaiting') return false;
  const stage = request.stages[request.currentStage];
  if (!stage) return false;
  if (!stage.approverIds.includes(userId)) return false;
  return !stage.decisions.some(d => d.approverId === userId);
}

/**
 * Record a decision and advance. Pure: returns a NEW request, never mutates.
 *
 * @param verdict 'approved' | 'rejected'
 */
export function decide(request, { approverId, verdict, comment, now }) {
  if (!canDecide(request, approverId)) return request;
  const at = now || new Date().toISOString();

  const stages = request.stages.map(s => ({ ...s, decisions: [...s.decisions] }));
  const stage = stages[request.currentStage];
  stage.decisions.push({ approverId, verdict, comment: comment || '', at });

  const outcome = stageOutcome(stage);
  if (outcome === 'pending') {
    return { ...request, stages };
  }

  stage.state = outcome;
  stage.resolvedAt = at;

  if (outcome === 'rejected') {
    // Default is stop-on-reject, which is what every product does unless told
    // otherwise; 'continue' exists for advisory approvers.
    if ((request.onReject || 'stop') === 'stop') {
      return { ...request, stages, state: 'rejected', resolvedAt: at };
    }
  }

  return advance({ ...request, stages }, at);
}

/** Has the current stage reached a verdict? */
export function stageOutcome(stage) {
  const approvals = stage.decisions.filter(d => d.verdict === 'approved').length;
  const rejections = stage.decisions.filter(d => d.verdict === 'rejected').length;
  const total = stage.approverIds.length;

  switch (stage.rule) {
    case 'any':
      if (approvals >= 1) return 'approved';
      if (rejections >= total && total > 0) return 'rejected';
      return 'pending';
    case 'quorum': {
      const need = Math.max(1, Math.min(stage.quorum || 1, total));
      if (approvals >= need) return 'approved';
      // Once enough people have rejected that the quorum is unreachable, stop.
      if (total - rejections < need) return 'rejected';
      return 'pending';
    }
    case 'all':
    default:
      if (rejections >= 1) return 'rejected';
      if (approvals >= total && total > 0) return 'approved';
      return 'pending';
  }
}

/** Move to the next pending stage, or resolve the request. */
function advance(request, at) {
  const stages = request.stages.map(s => ({ ...s }));
  let idx = request.currentStage + 1;
  while (idx < stages.length) {
    const s = stages[idx];
    s.state = 'awaiting';
    s.startedAt = at;
    s.dueAt = addHours(at, s.dueInHours);
    return { ...request, stages, currentStage: idx, state: 'awaiting' };
  }
  return { ...request, stages, currentStage: stages.length - 1, state: 'approved', resolvedAt: at };
}

/** Cancel a running request (the requester withdrew, the target was deleted). */
export function cancelApproval(request, { reason, now }) {
  if (!request || request.state !== 'awaiting') return request;
  return { ...request, state: 'cancelled', cancelReason: reason || '', resolvedAt: now || new Date().toISOString() };
}

/* ------------------------------------------------------------------ *
 * Time
 * ------------------------------------------------------------------ */

function addHours(iso, hours) {
  if (!hours) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(d.getHours() + Number(hours));
  return d.toISOString();
}

/** Is the current stage past its due time? */
export function isOverdue(request, now) {
  if (!request || request.state !== 'awaiting') return false;
  const stage = request.stages[request.currentStage];
  if (!stage?.dueAt) return false;
  return new Date(stage.dueAt).getTime() < new Date(now || Date.now()).getTime();
}

/**
 * Apply the timeout policy to an overdue request. Called by the automation
 * runtime's scheduled tick, and by the Approvals view so the demo can show it
 * happening without waiting real hours.
 */
export function applyTimeout(request, ctx, now) {
  if (!isOverdue(request, now)) return request;
  const at = now || new Date().toISOString();
  const stages = request.stages.map(s => ({ ...s, decisions: [...s.decisions] }));
  const stage = stages[request.currentStage];

  switch (stage.onTimeout) {
    case 'auto_approve':
      stage.state = 'approved';
      stage.timedOut = true;
      stage.resolvedAt = at;
      return advance({ ...request, stages }, at);
    case 'auto_reject':
      stage.state = 'rejected';
      stage.timedOut = true;
      stage.resolvedAt = at;
      return { ...request, stages, state: 'rejected', resolvedAt: at };
    case 'escalate': {
      const extra = resolveApprovers(stage.escalateTo, ctx).filter(id => !stage.approverIds.includes(id));
      stage.approverIds = [...stage.approverIds, ...extra];
      stage.escalated = true;
      stage.dueAt = addHours(at, stage.dueInHours);
      return { ...request, stages };
    }
    default:
      return request;
  }
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/** Requests this person can act on right now. */
export function pendingFor(requests, userId) {
  return (requests || []).filter(r => canDecide(r, userId));
}

/** Progress summary for a request — "Stage 2 of 3 · 1 of 2 approved". */
export function progress(request) {
  const total = request.stages.length;
  const stage = request.stages[request.currentStage];
  const approvals = stage ? stage.decisions.filter(d => d.verdict === 'approved').length : 0;
  const need = !stage ? 0
    : stage.rule === 'any' ? 1
    : stage.rule === 'quorum' ? Math.max(1, Math.min(stage.quorum || 1, stage.approverIds.length))
    : stage.approverIds.length;
  return { stageNumber: request.currentStage + 1, totalStages: total, approvals, need };
}

export function dedupe(list) {
  return Array.from(new Set(list));
}
