/**
 * Condition evaluation — the engine under RelayHQ's business rules.
 *
 * Shape follows the convention every mature platform converged on: a rule is
 * TRIGGER + CONDITIONS + ACTIONS, and the condition part is a tree of
 * field/operator/value rows grouped by all/any, with nestable groups.
 *
 *   group := { match: 'all'|'any', rows: [ row | group ] }
 *   row   := { field, op, value }
 *
 * Everything here is pure. No React, no store access — so it is trivially
 * testable and the same evaluator serves rules, approval policies, automation
 * IF-nodes, and conditional form fields.
 */

/* ------------------------------------------------------------------ *
 * Operators
 *
 * Grouped by the field type they apply to, because a condition builder that
 * offers "is greater than" on a text field is how you get nonsense rules.
 * ------------------------------------------------------------------ */

export const OPERATORS = {
  text: [
    { op: 'is',            label: 'is' },
    { op: 'is_not',        label: 'is not' },
    { op: 'contains',      label: 'contains' },
    { op: 'not_contains',  label: 'does not contain' },
    { op: 'starts_with',   label: 'starts with' },
    { op: 'is_empty',      label: 'is empty',      nullary: true },
    { op: 'is_not_empty',  label: 'is not empty',  nullary: true },
  ],
  select: [
    { op: 'is',        label: 'is' },
    { op: 'is_not',    label: 'is not' },
    { op: 'is_one_of', label: 'is any of', multi: true },
    { op: 'is_none_of',label: 'is none of', multi: true },
  ],
  number: [
    { op: 'eq',  label: '=' },
    { op: 'neq', label: '≠' },
    { op: 'gt',  label: '>' },
    { op: 'gte', label: '≥' },
    { op: 'lt',  label: '<' },
    { op: 'lte', label: '≤' },
    { op: 'between', label: 'is between', range: true },
  ],
  bool: [
    { op: 'is_true',  label: 'is true',  nullary: true },
    { op: 'is_false', label: 'is false', nullary: true },
  ],
  date: [
    { op: 'before',      label: 'is before' },
    { op: 'after',       label: 'is after' },
    { op: 'within_days', label: 'is within (days)' },
    { op: 'is_empty',    label: 'is not set', nullary: true },
  ],
  list: [
    { op: 'includes',     label: 'includes' },
    { op: 'not_includes', label: 'does not include' },
    { op: 'is_empty',     label: 'is empty',     nullary: true },
    { op: 'is_not_empty', label: 'is not empty', nullary: true },
  ],
};

/** Every operator, flattened, for label lookup. */
export const ALL_OPERATORS = Object.values(OPERATORS).flat()
  .reduce((acc, o) => { acc[o.op] = o; return acc; }, {});

export function operatorLabel(op) {
  return ALL_OPERATORS[op]?.label || op;
}

export function operatorsFor(type) {
  return OPERATORS[type] || OPERATORS.text;
}

export function isNullary(op) {
  return !!ALL_OPERATORS[op]?.nullary;
}

/* ------------------------------------------------------------------ *
 * Field catalogue
 *
 * What a rule can test. Declared rather than inferred so the builder can offer
 * a real picker with types, and so an unknown field is a visible error rather
 * than a silently-false condition.
 * ------------------------------------------------------------------ */

export const FIELDS = [
  // request / ticket
  { id: 'ticket.title',        label: 'Title',            type: 'text',   group: 'Request' },
  { id: 'ticket.description',  label: 'Description',      type: 'text',   group: 'Request' },
  { id: 'ticket.priority',     label: 'Priority',         type: 'select', group: 'Request', options: ['urgent', 'high', 'medium', 'low'] },
  { id: 'ticket.status',       label: 'Status',           type: 'select', group: 'Request', options: ['open', 'in_progress', 'pending', 'resolved', 'closed'] },
  { id: 'ticket.queueId',      label: 'Queue',            type: 'select', group: 'Request', optionsFrom: 'queues' },
  { id: 'ticket.source',       label: 'Source channel',   type: 'select', group: 'Request', options: ['portal', 'email', 'chat', 'phone', 'api'] },
  { id: 'ticket.labels',       label: 'Labels',           type: 'list',   group: 'Request' },
  { id: 'ticket.subformId',    label: 'Submitted form',   type: 'select', group: 'Request', optionsFrom: 'subforms' },
  { id: 'ticket.catalogItemId',label: 'Catalog item',     type: 'select', group: 'Request', optionsFrom: 'catalogItems' },
  // Service-catalog provenance. Keying a policy on the CATEGORY rather than on
  // one form id is what lets a new orderable item inherit the right approval
  // without anybody editing the policy.
  { id: 'ticket.serviceItemId',     label: 'Service item',     type: 'select', group: 'Request', optionsFrom: 'serviceItems' },
  { id: 'ticket.serviceCategoryId', label: 'Service category', type: 'select', group: 'Request', optionsFrom: 'serviceCategories' },
  { id: 'ticket.grantsAccess',      label: 'Grants access to something', type: 'bool', group: 'Request' },

  // requester
  { id: 'requester.department',label: 'Requester department', type: 'select', group: 'Requester', optionsFrom: 'departments' },
  { id: 'requester.isExternal',label: 'Requester is a customer', type: 'bool', group: 'Requester' },
  { id: 'requester.vip',       label: 'Requester is VIP', type: 'bool',   group: 'Requester' },
  { id: 'org.plan',            label: 'Customer plan',    type: 'select', group: 'Requester', options: ['Enterprise', 'Business', 'Starter'] },

  // form answers — the field that makes threshold approvals possible
  { id: 'answers.amount',      label: 'Amount requested', type: 'number', group: 'Form answers' },
  /**
   * ANNUALISED spend. A $45/month seat is $540 a year, so a monthly figure
   * tested against a $500 threshold silently declines every subscription —
   * which is how three service-catalog items ended up ordering licences with
   * no approval at all. Procurement thresholds are annual, so policies test
   * this field and the request context computes it.
   */
  { id: 'answers.annualAmount',label: 'Annualised spend', type: 'number', group: 'Form answers' },
  { id: 'answers.quantity',    label: 'Quantity',         type: 'number', group: 'Form answers' },
  { id: 'answers.accessLevel', label: 'Access level',     type: 'select', group: 'Form answers', options: ['read', 'write', 'admin'] },
  { id: 'answers.startDate',   label: 'Start date',       type: 'date',   group: 'Form answers' },

  // change
  { id: 'change.changeType',   label: 'Change type',      type: 'select', group: 'Change', options: ['standard', 'normal', 'emergency'] },
  { id: 'change.risk',         label: 'Change risk',      type: 'select', group: 'Change', options: ['high', 'moderate', 'low'] },
  { id: 'change.impact',       label: 'Change impact',    type: 'select', group: 'Change', options: ['high', 'medium', 'low'] },
  { id: 'change.affectsProduction', label: 'Affects production', type: 'bool', group: 'Change' },

  // asset
  { id: 'asset.kind',          label: 'Asset kind',       type: 'select', group: 'Asset', options: ['hardware', 'software'] },
  { id: 'asset.cost',          label: 'Asset cost',       type: 'number', group: 'Asset' },
  { id: 'asset.renewalDate',   label: 'Renewal date',     type: 'date',   group: 'Asset' },
];

export const FIELD_BY_ID = FIELDS.reduce((acc, f) => { acc[f.id] = f; return acc; }, {});

export function fieldLabel(id) {
  return FIELD_BY_ID[id]?.label || id;
}

export function fieldType(id) {
  return FIELD_BY_ID[id]?.type || 'text';
}

/* ------------------------------------------------------------------ *
 * Evaluation
 * ------------------------------------------------------------------ */

/** Read a dotted path out of a context object. */
export function readPath(ctx, path) {
  return String(path).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), ctx);
}

const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v);

/** Evaluate a single row. Returns a boolean; never throws. */
export function evaluateRow(row, ctx) {
  if (!row || !row.op) return false;
  const actual = readPath(ctx, row.field);
  const expected = row.value;

  switch (row.op) {
    case 'is':           return norm(actual) === norm(expected);
    case 'is_not':       return norm(actual) !== norm(expected);
    case 'contains':     return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'not_contains': return !String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
    case 'starts_with':  return String(actual ?? '').toLowerCase().startsWith(String(expected ?? '').toLowerCase());
    case 'is_empty':     return actual == null || actual === '' || (Array.isArray(actual) && actual.length === 0);
    case 'is_not_empty': return !(actual == null || actual === '' || (Array.isArray(actual) && actual.length === 0));

    case 'is_one_of':    return toArray(expected).map(norm).includes(norm(actual));
    case 'is_none_of':   return !toArray(expected).map(norm).includes(norm(actual));

    case 'eq':  return num(actual) === num(expected);
    case 'neq': return num(actual) !== num(expected);
    case 'gt':  return num(actual) >   num(expected);
    case 'gte': return num(actual) >=  num(expected);
    case 'lt':  return num(actual) <   num(expected);
    case 'lte': return num(actual) <=  num(expected);
    case 'between': {
      const [lo, hi] = toArray(expected).map(num);
      const a = num(actual);
      return a >= lo && a <= hi;
    }

    case 'is_true':  return actual === true;
    case 'is_false': return actual === false;

    case 'before': return date(actual) != null && date(expected) != null && date(actual) < date(expected);
    case 'after':  return date(actual) != null && date(expected) != null && date(actual) > date(expected);
    case 'within_days': {
      const d = date(actual);
      if (d == null) return false;
      const days = num(expected);
      const delta = (d - (ctx.__now ? date(ctx.__now) : Date.now())) / 86400000;
      return delta >= 0 && delta <= days;
    }

    case 'includes':     return toArray(actual).map(norm).includes(norm(expected));
    case 'not_includes': return !toArray(actual).map(norm).includes(norm(expected));

    default: return false;
  }
}

function toArray(v) { return Array.isArray(v) ? v : v == null ? [] : [v]; }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : NaN; }
function date(v) { const d = v instanceof Date ? v : new Date(v); return Number.isNaN(d.getTime()) ? null : d.getTime(); }

const isGroup = (node) => node && Array.isArray(node.rows);

/** Evaluate a condition group. An empty group matches everything. */
export function evaluate(group, ctx) {
  if (!group) return true;
  if (!isGroup(group)) return evaluateRow(group, ctx);
  const rows = group.rows || [];
  if (rows.length === 0) return true;
  return group.match === 'any'
    ? rows.some(r => evaluate(r, ctx))
    : rows.every(r => evaluate(r, ctx));
}

/**
 * Evaluate and return a per-row trace. This is what makes rule execution
 * observable — the "why did this fire" explainer every platform eventually
 * adds and RelayHQ has from the start.
 */
export function explain(group, ctx, depth = 0) {
  if (!group) return { matched: true, kind: 'empty', depth, rows: [] };
  if (!isGroup(group)) {
    return {
      kind: 'row', depth,
      field: group.field, op: group.op, value: group.value,
      actual: readPath(ctx, group.field),
      matched: evaluateRow(group, ctx),
      label: `${fieldLabel(group.field)} ${operatorLabel(group.op)}${isNullary(group.op) ? '' : ' ' + describeValue(group.value)}`,
    };
  }
  const rows = (group.rows || []).map(r => explain(r, ctx, depth + 1));
  const matched = group.rows?.length
    ? (group.match === 'any' ? rows.some(r => r.matched) : rows.every(r => r.matched))
    : true;
  return { kind: 'group', depth, match: group.match || 'all', matched, rows };
}

function describeValue(v) {
  if (Array.isArray(v)) return v.join(', ');
  if (v === '' || v == null) return '—';
  return String(v);
}

/* ------------------------------------------------------------------ *
 * Construction helpers used by the condition builder UI
 * ------------------------------------------------------------------ */

export function emptyGroup(match = 'all') {
  return { match, rows: [] };
}

export function defaultRowFor(fieldId) {
  const f = FIELD_BY_ID[fieldId] || FIELDS[0];
  const ops = operatorsFor(f.type);
  return {
    field: f.id,
    op: ops[0].op,
    value: f.type === 'number' ? 0 : f.type === 'bool' ? true : (f.options?.[0] ?? ''),
  };
}

/** Count the leaf conditions in a tree — used for "3 conditions" summaries. */
export function countRows(group) {
  if (!group) return 0;
  if (!isGroup(group)) return 1;
  return (group.rows || []).reduce((n, r) => n + countRows(r), 0);
}

/** Human-readable one-line summary of a condition tree. */
export function summarize(group) {
  if (!group || !isGroup(group) || !group.rows?.length) return 'Always';
  const join = group.match === 'any' ? ' or ' : ' and ';
  return group.rows.map(r => {
    if (isGroup(r)) return `(${summarize(r)})`;
    return `${fieldLabel(r.field)} ${operatorLabel(r.op)}${isNullary(r.op) ? '' : ' ' + describeValue(r.value)}`;
  }).join(join);
}
