import React, { useState, useMemo, useCallback } from 'react';
import {
  Filter, Inbox, Route, Stamp, Timer, Plus, Trash2, Pencil, ChevronUp, ChevronDown,
  Play, Check, X, AlertCircle, AlertTriangle, CornerDownRight, Users, Clock, Zap,
  ArrowRight, Tag, Bell, UserPlus, ListChecks, Workflow, Flag, Layers, FlaskConical,
  Building2, User, Target, Hourglass, Split, ShieldCheck, SkipForward, Ban,
  FileQuestion, Folder, Gauge, Send,
} from 'lucide-react';
import {
  useTheme, cx, ACCENT_HUES, ICON, DENSITY, PRIORITY, priorityMeta, ENTITIES,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, PriorityFlag,
  Avatar, AvatarStack, EmptyState, Card, Panel, Section, GroupLabel, ListRow, Stat,
  Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, Toggle, TileGroup, SearchInput,
  Modal, ConfirmDelete,
  SubTabs, PageBody,
  ModuleHeader, ScopedSearch, FilterBar, subsetLabel, optionCounts, passes,
} from '@/ds';
import { useStore, setCollection, addTo, patchIn, removeFrom, uid } from '@/store/store.js';
import {
  FIELDS, FIELD_BY_ID, ALL_OPERATORS, operatorsFor, operatorLabel, fieldLabel,
  isNullary, evaluate, explain, emptyGroup, defaultRowFor, countRows,
} from '@/lib/conditions.js';
import {
  APPROVER_KINDS, STAGE_RULES, TIMEOUT_ACTIONS,
  resolveApprovers, describeApprover, startApproval, progress,
} from '@/lib/approvals.js';
import { navigate } from '@/lib/router.js';
import { Q, USR, SF, CAT } from '@/store/seed/ids.js';

/**
 * Business Rules — queues, routing, the condition builder, approval policies, SLA.
 *
 * v1 modelled rules and never ran them. This module runs them: the tester
 * evaluates the real condition engine against a sample record, renders the
 * per-row trace from explain(), and then APPLIES the matched actions in order
 * so you can see the record that comes out the other end — including which rule
 * set which field, and the General-queue fallback when nothing routed it.
 *
 * Routing is derived, never authored here. One source of truth: a request form's
 * routing.queueId. The Routing tab walks the catalog and reports what that
 * produces, so the two can never drift.
 */

/* ==================================================================== *
 * Constants
 * ==================================================================== */

/* The module's signature gradient key — rose→orange, which is what v1 put behind
 * every "New …" action in this module. Read by ModuleHeader and Button variant="grad". */
const MODULE = 'rules';

/* Entity accents come from the ENTITIES registry, never restated as literals —
 * a queue is the same colour here as it is in the sidebar and on a ticket. */
const TABS = [
  { value: 'queues',    label: 'Queues',            icon: Inbox,  accent: ENTITIES.queue.hue },
  { value: 'routing',   label: 'Routing',           icon: Route,  accent: ENTITIES.subform.hue },
  { value: 'rules',     label: 'Rules',             icon: Filter, accent: ENTITIES.rule.hue },
  { value: 'approvals', label: 'Approval policies', icon: Stamp,  accent: ENTITIES.approval.hue },
  { value: 'sla',       label: 'SLA',               icon: Timer,  accent: 'emerald' },
];

const TRIGGERS = [
  { value: 'on_create',        label: 'On create',    icon: Plus,       hint: 'Record submitted' },
  { value: 'on_update',        label: 'On update',    icon: Pencil,     hint: 'Any field edited' },
  { value: 'on_status_change', label: 'Status change', icon: ArrowRight, hint: 'Status moves' },
  { value: 'scheduled',        label: 'Scheduled',    icon: Clock,      hint: 'Hourly tick' },
];

const TRIGGER_BY_VALUE = TRIGGERS.reduce((acc, t) => { acc[t.value] = t; return acc; }, {});

/** Queue audience — the three values the queue editor writes, spelled once. */
const AUDIENCES = [
  { value: 'internal', label: 'Internal staff' },
  { value: 'external', label: 'Customers' },
  { value: 'both', label: 'Both audiences' },
];

/** The module's accent — the rose half of its rose→orange gradient. */
const ACCENT = ENTITIES.rule.hue;

const ACTION_TYPES = [
  { value: 'set_priority',   label: 'Set priority',    icon: Flag,       accent: 'orange' },
  { value: 'assign_queue',   label: 'Assign queue',    icon: Inbox,      accent: ENTITIES.queue.hue },
  { value: 'assign_user',    label: 'Assign person',   icon: UserPlus,   accent: 'violet' },
  { value: 'add_label',      label: 'Add label',       icon: Tag,        accent: 'teal' },
  { value: 'notify',         label: 'Notify',          icon: Bell,       accent: 'amber' },
  { value: 'start_approval', label: 'Start approval',  icon: Stamp,      accent: ENTITIES.approval.hue },
  { value: 'create_task',    label: 'Create task',     icon: ListChecks, accent: ENTITIES.task.hue },
  { value: 'run_automation', label: 'Run automation',  icon: Workflow,   accent: ENTITIES.automation.hue },
];

const ACTION_BY_TYPE = ACTION_TYPES.reduce((acc, a) => { acc[a.value] = a; return acc; }, {});

const NOTIFY_KINDS = [
  { value: 'user', label: 'A specific person' },
  { value: 'queue', label: 'Everyone in a queue' },
  { value: 'requester', label: 'The requester' },
  { value: 'manager', label: "The requester's manager" },
];

/** FIELDS grouped for the field picker's optgroups. Module scope — computed once. */
const FIELD_GROUPS = FIELDS.reduce((acc, f) => {
  (acc[f.group] || (acc[f.group] = [])).push(f);
  return acc;
}, {});

/* ==================================================================== *
 * Pure helpers
 * ==================================================================== */

const clone = (v) => JSON.parse(JSON.stringify(v ?? null));
const uniq = (list) => Array.from(new Set(list.filter(Boolean)));
const isGroupNode = (n) => n && Array.isArray(n.rows);

function moveIn(list, index, delta) {
  const next = list.slice();
  const target = index + delta;
  if (target < 0 || target >= next.length) return list;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/* --- condition tree editing, by index path --- */

function updateAt(group, path, fn) {
  if (!path.length) return fn(group);
  const [i, ...rest] = path;
  const rows = (group.rows || []).slice();
  rows[i] = updateAt(rows[i], rest, fn);
  return { ...group, rows };
}

function removeAt(group, path) {
  const parent = path.slice(0, -1);
  const i = path[path.length - 1];
  return updateAt(group, parent, (g) => ({ ...g, rows: (g.rows || []).filter((_, k) => k !== i) }));
}

function appendAt(group, path, node) {
  return updateAt(group, path, (g) => ({ ...g, rows: [...(g.rows || []), node] }));
}

/** Keep a stored id selectable even when its source collection has not loaded. */
function withCurrent(options, value) {
  if (value == null || value === '' || Array.isArray(value)) return options;
  if (options.some((o) => o.value === value)) return options;
  return [...options, { value, label: String(value) }];
}

function labelIn(options, value, fallback = '—') {
  if (value == null || value === '') return fallback;
  return options.find((o) => o.value === value)?.label || String(value);
}

/** Read/write a dotted path immutably — the sample-context editor's whole job. */
function setPath(obj, path, value) {
  const [head, ...rest] = String(path).split('.');
  const base = obj || {};
  if (!rest.length) return { ...base, [head]: value };
  return { ...base, [head]: setPath(base[head], rest.join('.'), value) };
}

function getPath(obj, path) {
  return String(path).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

/**
 * One-line summary of a condition tree with reference ids resolved to names.
 * summarize() in the engine is pure and has no access to the collections, so it
 * prints "Submitted form is sf-new-hire". Here we can do better.
 */
function readableSummary(group, options) {
  if (!isGroupNode(group) || !(group.rows || []).length) return 'Always — no conditions';
  const join = group.match === 'any' ? ' or ' : ' and ';
  return group.rows.map((r) => {
    if (isGroupNode(r)) return `(${readableSummary(r, options)})`;
    const field = FIELD_BY_ID[r.field];
    const opts = optionsForField(field, options);
    const show = (v) => (field?.optionsFrom ? labelIn(opts, v, String(v)) : String(v));
    const value = Array.isArray(r.value) ? r.value.map(show).join(', ') : show(r.value ?? '—');
    return `${fieldLabel(r.field)} ${operatorLabel(r.op)}${isNullary(r.op) ? '' : ' ' + value}`;
  }).join(join);
}

/** Render any context value for the trace's ACTUAL column. */
function fmtValue(v) {
  if (v === undefined) return 'not set';
  if (v === null) return 'null';
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'empty list';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v === '') return 'empty';
  return String(v);
}

/* --- rule execution --- */

/**
 * Run the enabled rules whose trigger matches `event`, in order, and apply their
 * actions. Later rules overwrite earlier ones, which is why order is editable —
 * so the outcome panel records WHICH rule set each field.
 */
function runRules(rules, ctx, event) {
  const results = [];
  const outcome = {
    priority: { value: ctx?.ticket?.priority ?? null, by: 'the submitted record' },
    queueId: { value: ctx?.ticket?.queueId ?? null, by: null },
    assigneeId: { value: null, by: null },
    labels: (ctx?.ticket?.labels || []).map((label) => ({ label, by: 'the submitted record' })),
    approvals: [],
    tasks: [],
    notifications: [],
    automations: [],
  };

  for (const rule of rules) {
    if (!rule.enabled) { results.push({ rule, state: 'disabled' }); continue; }
    if (rule.trigger !== event) { results.push({ rule, state: 'other_trigger' }); continue; }
    const trace = explain(rule.conditions, ctx);
    const matched = evaluate(rule.conditions, ctx);
    results.push({ rule, state: matched ? 'fired' : 'skipped', trace });
    if (!matched) continue;

    for (const action of rule.actions || []) {
      switch (action.type) {
        case 'set_priority': outcome.priority = { value: action.priority, by: rule.name }; break;
        case 'assign_queue': outcome.queueId = { value: action.queueId, by: rule.name }; break;
        case 'assign_user':  outcome.assigneeId = { value: action.userId, by: rule.name }; break;
        case 'add_label':
          if (!outcome.labels.some((l) => l.label === action.label)) {
            outcome.labels.push({ label: action.label, by: rule.name });
          }
          break;
        case 'start_approval': outcome.approvals.push({ policyId: action.policyId, by: rule.name }); break;
        case 'create_task': outcome.tasks.push({ title: action.title, assigneeId: action.assigneeId, by: rule.name }); break;
        case 'notify': outcome.notifications.push({ target: action.target, message: action.message, by: rule.name }); break;
        case 'run_automation': outcome.automations.push({ automationId: action.automationId, by: rule.name }); break;
        default: break;
      }
    }
  }
  return { results, outcome };
}

/* --- routing derivation --- */

function deriveRouting(catalog, subforms) {
  const byId = new Map((subforms || []).map((s) => [s.id, s]));
  const rows = [];
  const attached = new Set();

  const walk = (nodes, trail) => {
    for (const node of nodes || []) {
      const path = [...trail, node];
      if (node.type === 'item') {
        for (const sid of node.subformIds || []) {
          attached.add(sid);
          const sf = byId.get(sid);
          rows.push({
            key: `${node.id}:${sid}`,
            path,
            subformId: sid,
            subform: sf || null,
            queueId: sf?.routing?.queueId || null,
            approvalPolicyId: sf?.approvalPolicyId || null,
            audience: sf?.audience || node.audience || 'both',
          });
        }
      }
      if (node.children) walk(node.children, path);
    }
  };
  walk(catalog, []);

  const orphans = (subforms || []).filter((s) => !attached.has(s.id));
  return { rows, orphans };
}

function flattenCatalogItems(nodes, out = []) {
  for (const n of nodes || []) {
    if (n.type === 'item') out.push(n);
    if (n.children) flattenCatalogItems(n.children, out);
  }
  return out;
}

/* ==================================================================== *
 * Shared data hook — everything a picker in this module needs
 * ==================================================================== */

function useRulesData() {
  const queues = useStore((s) => s.queues) || [];
  const rules = useStore((s) => s.rules) || [];
  const policies = useStore((s) => s.approvalPolicies) || [];
  const slas = useStore((s) => s.slaPolicies) || [];
  const directory = useStore((s) => s.directory) || [];
  const subforms = useStore((s) => s.subforms) || [];
  const catalog = useStore((s) => s.catalog) || [];
  const automations = useStore((s) => s.automations) || [];
  const settings = useStore((s) => s.settings) || {};

  const options = useMemo(() => ({
    queues: queues.map((q) => ({ value: q.id, label: q.name })),
    subforms: subforms.map((s) => ({ value: s.id, label: s.name })),
    catalogItems: flattenCatalogItems(catalog).map((n) => ({ value: n.id, label: n.name })),
    departments: uniq(directory.map((p) => p.department)).sort().map((d) => ({ value: d, label: d })),
    people: directory.map((p) => ({ value: p.id, label: `${p.name} · ${p.title}` })),
    policies: policies.map((p) => ({ value: p.id, label: p.name })),
    automations: automations.map((a) => ({ value: a.id, label: a.name })),
    roles: uniq(directory.map((p) => p.role)).map((r) => ({ value: r, label: r })),
  }), [queues, subforms, catalog, directory, policies, automations]);

  return { queues, rules, policies, slas, directory, subforms, catalog, automations, settings, options };
}

/** Options for a condition field, resolved against live collections. */
function optionsForField(field, options) {
  if (!field) return [];
  if (field.optionsFrom) return options[field.optionsFrom] || [];
  return (field.options || []).map((o) => ({ value: o, label: o }));
}

/* ==================================================================== *
 * Root
 * ==================================================================== */

export default function BusinessRules({ route }) {
  const sub = TABS.some((t) => t.value === route?.sub) ? route.sub : 'queues';
  const data = useRulesData();
  const routing = useMemo(() => deriveRouting(data.catalog, data.subforms), [data.catalog, data.subforms]);

  const counts = {
    queues: data.queues.length,
    routing: routing.rows.length,
    rules: data.rules.length,
    approvals: data.policies.length,
    sla: data.slas.length,
  };

  /**
   * These stay SubTabs. They switch WHAT you are looking at — queues, routing,
   * rules, policies, clocks — not how one collection is drawn, which is the job
   * a lens does. So they ride centred in the header's first row as its `nav`,
   * and each tab owns the rest of the header: its own primary action, its own
   * scoped search, and the filters that make sense for the records it lists.
   *
   * `inline` because a header nav is 30px and must shrink by scrolling — the
   * standalone bar cannot shrink at all, so the last tab would be clipped away.
   */
  const tabs = (
    <SubTabs
      value={sub}
      onChange={(v) => navigate('rules', v)}
      items={TABS.map((x) => ({ ...x, count: counts[x.value] }))}
      inline
    />
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {sub === 'queues' && <QueuesTab data={data} routing={routing} tabs={tabs} />}
      {sub === 'routing' && <RoutingTab data={data} routing={routing} tabs={tabs} />}
      {sub === 'rules' && <RulesTab data={data} tabs={tabs} />}
      {sub === 'approvals' && <PoliciesTab data={data} tabs={tabs} />}
      {sub === 'sla' && <SlaTab data={data} tabs={tabs} />}
    </div>
  );
}

/* ==================================================================== *
 * QUEUES
 * ==================================================================== */

function QueuesTab({ data, routing, tabs }) {
  const { t } = useTheme();
  const { queues, rules, directory } = data;
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  /* One header state: the multi-select filter values and the in-page query.
   * There is no open/closed flag any more — the filter bar is always on screen,
   * so a filter can never be on while its control is hidden. */
  const [filters, setFilters] = useState({});
  const [query, setQuery] = useState('');

  const clearFilters = () => { setFilters({}); setQuery(''); };

  /* Chips show VALUES, not counts — so these carry the actual form and rule
   * names and ChipGroup collapses the overflow. "4 forms" told you a queue was
   * busy; the names tell you what it is FOR, which is the question you had. */
  const formsByQueue = useMemo(() => {
    const map = {};
    for (const r of routing.rows) {
      if (!r.queueId) continue;
      (map[r.queueId] || (map[r.queueId] = [])).push(r.subform?.name || r.subformId);
    }
    return map;
  }, [routing.rows]);

  const rulesByQueue = useMemo(() => {
    const map = {};
    // A rule that both assigns a queue AND notifies it is ONE rule touching it.
    const add = (queueId, name) => {
      if (!queueId) return;
      const list = map[queueId] || (map[queueId] = []);
      if (!list.includes(name)) list.push(name);
    };
    for (const rule of rules) {
      for (const a of rule.actions || []) {
        if (a.type === 'assign_queue') add(a.queueId, rule.name);
        if (a.type === 'notify' && a.target?.kind === 'queue') add(a.target.queueId, rule.name);
      }
    }
    return map;
  }, [rules]);

  const nameOf = useCallback((id) => directory.find((p) => p.id === id)?.name || id, [directory]);

  const needle = query.trim().toLowerCase();
  const visible = queues.filter((q) => {
    if (!passes(filters.audience, q.audience || 'internal')) return false;
    if (!needle) return true;
    return `${q.name} ${q.description || ''}`.toLowerCase().includes(needle);
  });

  const memberTotal = uniq(queues.flatMap((q) => q.memberIds || [])).length;
  const routedForms = routing.rows.filter((r) => r.queueId).length;

  /* Counts run over EVERY queue, not the filtered view — an option that reported
   * how many survive the filters already set reads as choices vanishing. */
  const FILTER_DEFS = useMemo(() => {
    const byAudience = optionCounts(queues, (q) => q.audience || 'internal');
    return [{
      id: 'audience',
      label: 'Audience',
      icon: Users,
      options: AUDIENCES.map((o) => ({ ...o, count: byAudience.get(o.value) || 0 })),
      footer: 'An internal queue never appears in the customer portal.',
    }];
  }, [queues]);

  const onSave = (draft) => {
    if (queues.some((q) => q.id === draft.id)) patchIn('queues', draft.id, draft);
    else addTo('queues', draft);
    setEditing(null);
  };

  return (
    <>
      <ModuleHeader
        icon={Filter}
        module={MODULE}
        title="Business Rules"
        /* The subtitle tells the truth about what is on screen: the resting
         * facts when nothing narrows the list, "3 of 6 shown" when something
         * does. It also carries the numbers the old stat strip printed. */
        subtitle={subsetLabel(visible.length, queues.length,
          `${queues.length} queues · ${memberTotal} people assigned · ${routedForms} forms routed`)}
        primary={
          <Button variant="grad" module={MODULE} icon={Plus} onClick={() => setEditing(newQueue())}>
            New queue
          </Button>
        }
        nav={tabs}
        filterBar={
          <FilterBar
            accent={ACCENT}
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onClearAll={clearFilters}
            search={
              <ScopedSearch value={query} onChange={setQuery} scope={`${queues.length} queues`} accent={ACCENT} />
            }
          />
        }
      />

      <PageBody>
        <div className="space-y-4">
          <Banner accent="blue" icon={AlertCircle} title="Queues are destinations, not workflows">
            A queue owns a body of work and a set of people. Nothing here decides what lands in it — that comes from
            the request form (see <strong className={t.text}>Routing</strong>) and can then be overridden by a rule.
            <strong className={t.text}> General</strong> is the default: anything that arrives unrouted lands there, and
            it cannot be deleted for that reason.
          </Banner>

          {visible.length === 0 ? (
            <EmptyState icon={Inbox} title="No queues match"
              hint="Search composes with the filters rather than replacing them — clearing one may bring queues back."
              action={<Button variant="soft" accent={ACCENT} icon={Filter} onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <div className={DENSITY.rowGap}>
              {visible.map((q) => {
                const members = (q.memberIds || []).map(nameOf);
                return (
                  <ListRow
                    key={q.id}
                    accent={q.hue || ENTITIES.queue.hue}
                    icon={Inbox}
                    title={q.name}
                    subtitle={q.description}
                    onClick={() => setEditing(clone(q))}
                    meta={
                      <>
                        {q.isDefault && <Chip accent="amber" icon={Target}>Default queue</Chip>}
                        <AvatarStack names={members} max={4} size="sm" />
                      </>
                    }
                    actions={
                      <>
                        <IconButton icon={Pencil} label="Edit queue"
                          onClick={(e) => { e.stopPropagation(); setEditing(clone(q)); }} />
                        {!q.isDefault && (
                          <IconButton icon={Trash2} label="Delete queue" accent="red"
                            onClick={(e) => { e.stopPropagation(); setDeleting(q); }} />
                        )}
                      </>
                    }
                  >
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <ChipGroup items={members} max={3} accent={q.hue || ENTITIES.queue.hue} icon={User}
                        empty={<span className={cx('text-xs', t.textMuted)}>No members — work here has no owner</span>} />
                      <ChipGroup items={formsByQueue[q.id] || []} max={2} accent={ENTITIES.subform.hue} icon={Route} />
                      <ChipGroup items={rulesByQueue[q.id] || []} max={1} accent={ENTITIES.rule.hue} icon={Filter} />
                      {q.inbox && <span className={cx('text-[11px] font-mono', t.textMuted)}>{q.inbox}</span>}
                    </div>
                  </ListRow>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      {editing && (
        <QueueEditorModal
          draft={editing}
          data={data}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={onSave}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        name={deleting?.name || ''}
        kind="queue"
        cascadeNote="Request forms pointing at this queue will fall back to General, and rules that assign it will stop routing."
        onCancel={() => setDeleting(null)}
        onConfirm={() => { removeFrom('queues', deleting.id); setDeleting(null); }}
      />
    </>
  );
}

function newQueue() {
  return {
    id: uid('queue'),
    name: '',
    description: '',
    hue: 'blue',
    isDefault: false,
    audience: 'internal',
    inbox: '',
    memberIds: [],
  };
}

function QueueEditorModal({ draft, data, onChange, onClose, onSave }) {
  const { t } = useTheme();
  const { directory } = data;
  const [memberSearch, setMemberSearch] = useState('');
  const set = (patch) => onChange({ ...draft, ...patch });

  const byDept = useMemo(() => {
    const groups = {};
    for (const p of directory) {
      if (memberSearch && !`${p.name} ${p.title} ${p.department}`.toLowerCase().includes(memberSearch.toLowerCase())) continue;
      (groups[p.department || 'Unassigned'] || (groups[p.department || 'Unassigned'] = [])).push(p);
    }
    return groups;
  }, [directory, memberSearch]);

  const members = draft.memberIds || [];
  const toggleMember = (id) => set({
    memberIds: members.includes(id) ? members.filter((m) => m !== id) : [...members, id],
  });

  return (
    <Modal
      open
      onClose={onClose}
      accent={draft.hue || 'gray'}
      size="modalLg"
      icon={Inbox}
      title={draft.name || 'New queue'}
      subtitle="Destination for routed work, and the people who own it"
      footer={
        <>
          <span className={cx('text-sm', t.textMuted)}>
            {members.length} member{members.length === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent={draft.hue || 'gray'} icon={Check}
              disabled={!draft.name.trim()} onClick={() => onSave(draft)}>
              Save queue
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        {draft.isDefault && (
          <Banner accent="amber" icon={Target} title="This is the default queue">
            Unrouted work lands here. It cannot be deleted, and emptying its membership means nothing owns triage.
          </Banner>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name" required>
            <Input value={draft.name} accent={draft.hue || 'gray'}
              onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Customer Support" />
          </Field>
          <Field label="Intake address" hint="Mail to this address opens a ticket here">
            <Input value={draft.inbox || ''} accent={draft.hue || 'gray'}
              onChange={(e) => set({ inbox: e.target.value })} placeholder="support@northwind.example" />
          </Field>
        </div>

        <Field label="Description" hint="What belongs in this queue — written for the person deciding where to send something">
          <Textarea rows={2} value={draft.description || ''} accent={draft.hue || 'gray'}
            onChange={(e) => set({ description: e.target.value })} />
        </Field>

        <Field label="Audience" hint="Internal queues never appear in the customer portal">
          <TileGroup
            value={draft.audience || 'internal'}
            onChange={(v) => set({ audience: v })}
            columns={3}
            options={[
              { value: 'internal', label: 'Internal', icon: Building2, accent: 'blue', hint: 'Staff only' },
              { value: 'external', label: 'Customers', icon: Users, accent: 'rose', hint: 'Portal visible' },
              { value: 'both', label: 'Both', icon: Layers, accent: 'purple', hint: 'Mixed intake' },
            ]}
          />
        </Field>

        <Field label="Colour" hint="The queue's hue is used everywhere it appears — routing table, chips, rails">
          <HuePicker value={draft.hue || 'gray'} onChange={(hue) => set({ hue })} />
        </Field>

        <Divider />

        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <GroupLabel>Members</GroupLabel>
            <SearchInput value={memberSearch} onChange={setMemberSearch} placeholder="Find people…" width="w-48" accent={draft.hue || 'gray'} />
          </div>

          {members.length === 0 ? (
            <Banner accent="amber" icon={AlertTriangle} className="mb-2">
              No members. Work routed here will have no owner and no approver when a stage names this queue.
            </Banner>
          ) : (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <AvatarStack names={members.map((id) => directory.find((p) => p.id === id)?.name || id)} max={6} size="md" />
              <ChipGroup accent={draft.hue || 'gray'} icon={User} max={4}
                items={members.map((id) => directory.find((p) => p.id === id)?.name || id)} />
            </div>
          )}

          <div className={cx('rounded-xl border max-h-72 overflow-auto', t.borderLight)}>
            {Object.entries(byDept).map(([dept, people]) => (
              <div key={dept}>
                <div className={cx('px-3 py-1.5 sticky top-0', t.bgSubtle)}>
                  <GroupLabel>{dept}</GroupLabel>
                </div>
                <div className={cx('divide-y', t.divide)}>
                  {people.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 px-3 py-2">
                      <Checkbox
                        checked={members.includes(p.id)}
                        onChange={() => toggleMember(p.id)}
                        accent={draft.hue || 'gray'}
                      />
                      <Avatar name={p.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={cx('text-sm truncate', t.text)}>{p.name}</p>
                        <p className={cx('text-[11px] truncate', t.textMuted)}>{p.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(byDept).length === 0 && (
              <p className={cx('text-sm p-4 text-center', t.textMuted)}>Nobody matches “{memberSearch}”.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function HuePicker({ value, onChange }) {
  const { t, a } = useTheme();
  return (
    <div className="flex flex-wrap gap-1.5">
      {ACCENT_HUES.map((hue) => {
        const c = a(hue);
        const selected = value === hue;
        return (
          <button
            key={hue}
            onClick={() => onChange(hue)}
            title={hue}
            aria-label={hue}
            aria-pressed={selected}
            className={cx('w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-colors',
              c.solid, selected ? t.borderLight : 'border-transparent')}
          >
            {selected && <Check size={ICON.base} className="text-white" />}
          </button>
        );
      })}
    </div>
  );
}

/* ==================================================================== *
 * ROUTING — derived from the catalog and its request forms
 * ==================================================================== */

function RoutingTab({ data, routing, tabs }) {
  const { t } = useTheme();
  const { queues, options } = data;
  const [filters, setFilters] = useState({});
  const [query, setQuery] = useState('');

  const clearFilters = () => { setFilters({}); setQuery(''); };

  const generalId = (queues.find((q) => q.isDefault) || {}).id || Q.GENERAL;
  const needle = query.trim().toLowerCase();

  /* Destination is MULTI-SELECT now. "Customer Support or Billing" is the
   * question a routing audit actually asks, and the old single-select could not
   * express it at all. The fallback is a destination like any other, because
   * that is what it is. */
  const rows = routing.rows.filter((r) => {
    if (!passes(filters.destination, r.queueId || generalId)) return false;
    if (!needle) return true;
    const hay = [r.subform?.name, r.subform?.description, ...r.path.map((n) => n.name)].filter(Boolean).join(' ');
    return hay.toLowerCase().includes(needle);
  });
  const unrouted = routing.rows.filter((r) => !r.queueId).length;

  const FILTER_DEFS = useMemo(() => {
    const byQueue = optionCounts(routing.rows, (r) => r.queueId || generalId);
    return [{
      id: 'destination',
      label: 'Destination',
      icon: Inbox,
      options: queues.map((q) => ({ value: q.id, label: q.name, count: byQueue.get(q.id) || 0 })),
      footer: 'A form with no queue set counts against the default.',
    }];
  }, [queues, routing.rows, generalId]);

  return (
    <>
      <ModuleHeader
        icon={Filter}
        module={MODULE}
        title="Business Rules"
        subtitle={subsetLabel(rows.length, routing.rows.length,
          `${routing.rows.length} routed forms · ${unrouted} fall to the default queue · ${routing.orphans.length} unattached`)}
        nav={tabs}
        filterBar={
          <FilterBar
            accent={ACCENT}
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onClearAll={clearFilters}
            search={
              <ScopedSearch value={query} onChange={setQuery} scope={`${routing.rows.length} routes`} accent={ACCENT} />
            }
          />
        }
      />

      <PageBody>
        <div className="space-y-4">
          <Banner accent="purple" icon={Route} title="Routing is derived, not authored">
            There is no separate routing table to keep in step with the catalog. A ticket's queue comes from the request
            form it was submitted through — <code className={t.text}>subform.routing.queueId</code> — so this page is a
            read-out of what the catalog already says. Change a form's queue in{' '}
            <button className={cx('underline', t.text)} onClick={() => navigate('forms')}>Forms</button> and this table
            follows. Anything with no queue set falls to{' '}
            <strong className={t.text}>{queues.find((q) => q.isDefault)?.name || 'General'}</strong>, which is why that
            queue exists.
          </Banner>

          {routing.rows.length === 0 ? (
            <EmptyState
              icon={Route}
              title="Nothing to route yet"
              hint="Routing appears once the catalog has items with request forms attached. Each form contributes one row: product › subcategory › item › form → queue."
              action={<Button variant="soft" accent="amber" icon={Folder} onClick={() => navigate('catalog')}>Open the catalog</Button>}
            />
          ) : (
            <>
              {unrouted > 0 && (
                <Banner accent="amber" icon={AlertTriangle}>
                  <strong className={t.text}>{unrouted}</strong> request form{unrouted === 1 ? '' : 's'} below have no queue
                  configured. Their tickets will land in the default queue rather than being lost — but nobody chose that.
                </Banner>
              )}

              {rows.length === 0 ? (
                <EmptyState icon={Route} title="No routes match"
                  hint="Search composes with the destination filter rather than replacing it — clearing one may bring routes back."
                  action={<Button variant="soft" accent={ACCENT} icon={Filter} onClick={clearFilters}>Clear filters</Button>} />
              ) : (
                <div className={DENSITY.rowGap}>
                  {rows.map((r) => (
                    <RoutingRow
                      key={r.key}
                      row={r}
                      queue={queues.find((q) => q.id === (r.queueId || generalId))}
                      policyOptions={options.policies}
                    />
                  ))}
                </div>
              )}

              {routing.orphans.length > 0 && (
                <Section title="Forms not attached to a catalog item"
                  hint="These exist but no customer can reach them from the portal. They still route if a rule or a deep link submits one.">
                  <div className={DENSITY.rowGap}>
                    {routing.orphans.map((sf) => (
                      <ListRow
                        key={sf.id}
                        accent="purple"
                        icon={FileQuestion}
                        title={sf.name}
                        subtitle={sf.description}
                        meta={
                          <Chip accent={queues.find((q) => q.id === sf.routing?.queueId)?.hue || 'gray'} icon={Inbox}>
                            {queues.find((q) => q.id === sf.routing?.queueId)?.name || 'General (fallback)'}
                          </Chip>
                        }
                      />
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </PageBody>
    </>
  );
}

/** One derived routing path: product › subcategory › item › form → queue. */
function RoutingRow({ row, queue, policyOptions }) {
  const { t, a } = useTheme();
  const hue = queue?.hue || 'gray';
  const c = a(hue);
  const fallback = !row.queueId;

  return (
    <Card className={cx(DENSITY.rowPad, 'flex items-center gap-3 flex-wrap')}>
      <span className={cx('w-1 self-stretch min-h-10 rounded-full flex-shrink-0', c.rail)} />
      <div className="flex-1 min-w-[14rem]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {row.path.map((n, i) => (
            <React.Fragment key={n.id}>
              {i > 0 && <ArrowRight size={ICON.xs} className={t.textMuted} />}
              <span className={cx('text-xs', i === row.path.length - 1 ? t.text : t.textMuted)}>{n.name}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <FileQuestion size={ICON.base} className={cx('flex-shrink-0', a('purple').fg)} />
          <span className={cx('text-sm font-medium truncate', t.text)}>{row.subform?.name || row.subformId}</span>
          {!row.subform && <Chip accent="red" icon={AlertTriangle}>Form not found</Chip>}
        </div>
      </div>
      <ArrowRight size={ICON.md} className={t.textMuted} />
      <div className="flex items-center gap-2 flex-shrink-0">
        <Chip accent={hue} icon={Inbox}>{queue?.name || 'General'}</Chip>
        {fallback && <Chip accent="amber" icon={Target}>fallback — no queue set</Chip>}
        {row.approvalPolicyId && (
          <Chip accent="amber" icon={Stamp}>{labelIn(policyOptions, row.approvalPolicyId, 'approval')}</Chip>
        )}
      </div>
    </Card>
  );
}

/* ==================================================================== *
 * RULES
 * ==================================================================== */

function RulesTab({ data, tabs }) {
  const { t } = useTheme();
  const { rules, queues, options, directory } = data;
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [testerOpen, setTesterOpen] = useState(false);
  const [sample, setSample] = useState(() => clone(SAMPLE_PRESETS[0].ctx));
  const [event, setEvent] = useState('on_create');
  const [filters, setFilters] = useState({});
  const [query, setQuery] = useState('');

  const clearFilters = () => { setFilters({}); setQuery(''); };

  const enabled = rules.filter((r) => r.enabled).length;

  /* The list keeps its authored ORDER — rules run top to bottom and a later one
   * overwrites an earlier one's assignment, so the index shown beside each row
   * is its real position in the run, not its position in the filtered view. */
  const needle = query.trim().toLowerCase();
  const visible = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => {
      if (!passes(filters.trigger, rule.trigger)) return false;
      if (!passes(filters.enabled, rule.enabled ? 'on' : 'off')) return false;
      if (!needle) return true;
      const hay = [rule.name, rule.description, readableSummary(rule.conditions, options)].join(' ');
      return hay.toLowerCase().includes(needle);
    });

  const FILTER_DEFS = useMemo(() => {
    const byTrigger = optionCounts(rules, (r) => r.trigger);
    const byEnabled = optionCounts(rules, (r) => (r.enabled ? 'on' : 'off'));
    return [
      {
        id: 'trigger', label: 'Trigger', icon: Zap,
        options: TRIGGERS.map((x) => ({ value: x.value, label: x.label, count: byTrigger.get(x.value) || 0 })),
      },
      {
        id: 'enabled', label: 'Enabled', icon: Play,
        options: [
          { value: 'on', label: 'Enabled', count: byEnabled.get('on') || 0 },
          { value: 'off', label: 'Disabled', count: byEnabled.get('off') || 0 },
        ],
      },
    ];
  }, [rules]);

  const move = (index, delta) => setCollection('rules', (list) => moveIn(list, index, delta));
  const onSave = (draft) => {
    if (rules.some((r) => r.id === draft.id)) patchIn('rules', draft.id, draft);
    else addTo('rules', draft);
    setEditing(null);
  };

  return (
    <>
      <ModuleHeader
        icon={Filter}
        module={MODULE}
        title="Business Rules"
        subtitle={subsetLabel(visible.length, rules.length,
          `${rules.length} rules · ${enabled} enabled · ${rules.length - enabled} off`)}
        primary={
          <Button variant="grad" module={MODULE} icon={Plus} onClick={() => setEditing(newRule())}>
            New rule
          </Button>
        }
        nav={tabs}
        actions={
          <Button variant={testerOpen ? 'solid' : 'soft'} accent="emerald" size="sm" icon={FlaskConical}
            onClick={() => setTesterOpen((v) => !v)}>
            {testerOpen ? 'Hide tester' : 'Test rules'}
          </Button>
        }
        filterBar={
          <FilterBar
            accent={ACCENT}
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onClearAll={clearFilters}
            search={
              <ScopedSearch value={query} onChange={setQuery} scope={`${rules.length} rules`} accent={ACCENT} />
            }
          />
        }
      />

      <PageBody width="max-w-6xl">
        <div className="space-y-4">
          <Banner accent="rose" icon={Filter} title="Order matters">
            Rules run top to bottom on every matching event and a later rule overwrites an earlier one's assignment.
            That is why the order is editable rather than alphabetical — and why the tester reports which rule set each
            field, not just the final answer.
          </Banner>

          {testerOpen && (
            <RuleTester
              rules={rules}
              data={data}
              sample={sample}
              onSample={setSample}
              event={event}
              onEvent={setEvent}
            />
          )}

          {visible.length === 0 ? (
            rules.length === 0 ? (
              <EmptyState icon={Filter} title="No rules yet"
                hint="A rule is a trigger, a condition tree and a list of actions. Start with something narrow — auto-labelling billing questions is the usual first one."
                action={<Button variant="grad" module={MODULE} icon={Plus} onClick={() => setEditing(newRule())}>New rule</Button>} />
            ) : (
              <EmptyState icon={Filter} title="No rules match"
                hint="Search composes with the filters rather than replacing them — clearing one may bring rules back."
                action={<Button variant="soft" accent={ACCENT} icon={Filter} onClick={clearFilters}>Clear filters</Button>} />
            )
          ) : (
            <div className={DENSITY.rowGap}>
              {visible.map(({ rule, index: i }) => {
                const trig = TRIGGER_BY_VALUE[rule.trigger] || TRIGGERS[0];
                const TrigIcon = trig.icon;
                return (
                  <ListRow
                    key={rule.id}
                    accent={rule.enabled ? 'rose' : 'gray'}
                    icon={Filter}
                    title={rule.name}
                    subtitle={readableSummary(rule.conditions, options)}
                    onClick={() => setEditing(clone(rule))}
                    meta={
                      <>
                        <span className={cx('text-[11px] tabular-nums w-5 text-right', t.textMuted)}>{i + 1}</span>
                        <Chip accent={rule.enabled ? 'sky' : 'gray'} icon={TrigIcon}>{trig.label}</Chip>
                        {/* The row itself opens the editor, so inline controls must not bubble. */}
                        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <Toggle
                            checked={!!rule.enabled}
                            accent="rose"
                            onChange={(v) => patchIn('rules', rule.id, { enabled: v })}
                          />
                        </span>
                        <div className="flex flex-col">
                          <button aria-label="Move up" title="Move up" disabled={i === 0}
                            onClick={(e) => { e.stopPropagation(); move(i, -1); }}
                            className={cx('px-1 rounded', t.bgHover, i === 0 ? 'opacity-30' : t.textSecondary)}>
                            <ChevronUp size={ICON.sm} />
                          </button>
                          <button aria-label="Move down" title="Move down" disabled={i === rules.length - 1}
                            onClick={(e) => { e.stopPropagation(); move(i, 1); }}
                            className={cx('px-1 rounded', t.bgHover, i === rules.length - 1 ? 'opacity-30' : t.textSecondary)}>
                            <ChevronDown size={ICON.sm} />
                          </button>
                        </div>
                      </>
                    }
                    actions={
                      <>
                        <IconButton icon={Pencil} label="Edit rule"
                          onClick={(e) => { e.stopPropagation(); setEditing(clone(rule)); }} />
                        <IconButton icon={Trash2} label="Delete rule" accent="red"
                          onClick={(e) => { e.stopPropagation(); setDeleting(rule); }} />
                      </>
                    }
                  >
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      {(rule.actions || []).map((a, k) => {
                        const meta = ACTION_BY_TYPE[a.type];
                        if (!meta) return null;
                        const text = describeAction(a, { queues, options, directory });
                        return (
                          <Chip key={k} accent={actionAccent(a, { queues })} icon={meta.icon} title={text}>
                            {text}
                          </Chip>
                        );
                      })}
                      {!(rule.actions || []).length && (
                        <span className={cx('text-xs', t.textMuted)}>No actions — this rule matches and then does nothing.</span>
                      )}
                    </div>
                  </ListRow>
                );
              })}
            </div>
          )}

        </div>
      </PageBody>

      {editing && (
        <RuleEditorModal
          draft={editing}
          data={data}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={onSave}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        name={deleting?.name || ''}
        kind="rule"
        cascadeNote="Records already changed by this rule keep their priority, queue and labels — deleting it only stops future runs."
        onCancel={() => setDeleting(null)}
        onConfirm={() => { removeFrom('rules', deleting.id); setDeleting(null); }}
      />
    </>
  );
}

function newRule() {
  return {
    id: uid('rule'),
    name: '',
    description: '',
    enabled: false,
    trigger: 'on_create',
    conditions: emptyGroup('all'),
    actions: [],
  };
}

function describeAction(action, { queues, options, directory }) {
  switch (action.type) {
    case 'set_priority': return `Priority → ${priorityMeta(action.priority).label}`;
    case 'assign_queue': return `Queue → ${queues.find((q) => q.id === action.queueId)?.name || action.queueId}`;
    case 'assign_user': return `Assign → ${directory.find((p) => p.id === action.userId)?.name || action.userId}`;
    case 'add_label': return `Label “${action.label}”`;
    case 'notify': return `Notify ${describeNotifyTarget(action.target, { queues, directory })}`;
    case 'start_approval': return `Approval: ${labelIn(options.policies, action.policyId, 'policy')}`;
    case 'create_task': return `Task: ${action.title || 'untitled'}`;
    case 'run_automation': return `Run ${labelIn(options.automations, action.automationId, action.automationId)}`;
    default: return action.type;
  }
}

/**
 * Chip hue for a CONFIGURED action. Where the action names a specific record the
 * chip wears that record's colour — an "urgent" chip is red like every other
 * urgent, and a queue chip is that queue's hue, exactly as it is in Routing and
 * in the outcome panel. Only the generic action-type tile uses the type accent.
 */
function actionAccent(action, { queues }) {
  switch (action.type) {
    case 'set_priority': return priorityMeta(action.priority).hue;
    case 'assign_queue': return queues.find((q) => q.id === action.queueId)?.hue || ENTITIES.queue.hue;
    case 'notify':
      return action.target?.kind === 'queue'
        ? queues.find((q) => q.id === action.target.queueId)?.hue || ACTION_BY_TYPE.notify.accent
        : ACTION_BY_TYPE.notify.accent;
    default: return ACTION_BY_TYPE[action.type]?.accent || 'gray';
  }
}

function describeNotifyTarget(target, { queues, directory }) {
  switch (target?.kind) {
    case 'user': return directory.find((p) => p.id === target.userId)?.name || 'a person';
    case 'queue': return queues.find((q) => q.id === target.queueId)?.name || 'a queue';
    case 'requester': return 'the requester';
    case 'manager': return "the requester's manager";
    default: return 'nobody';
  }
}

/* --- rule editor ---------------------------------------------------- */

const RULE_PANES = [
  { value: 'setup', label: 'Setup', icon: Pencil, accent: 'rose' },
  { value: 'conditions', label: 'Conditions', icon: Split, accent: 'purple' },
  { value: 'actions', label: 'Actions', icon: Zap, accent: 'amber' },
  { value: 'test', label: 'Test', icon: FlaskConical, accent: 'emerald' },
];

function RuleEditorModal({ draft, data, onChange, onClose, onSave }) {
  const { t } = useTheme();
  const [pane, setPane] = useState('setup');
  const [sample, setSample] = useState(() => clone(SAMPLE_PRESETS[0].ctx));
  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <Modal
      open
      onClose={onClose}
      accent="rose"
      size="modalXl"
      icon={Filter}
      title={draft.name || 'New rule'}
      subtitle={`${TRIGGER_BY_VALUE[draft.trigger]?.label || 'On create'} · ${countRows(draft.conditions)} conditions · ${(draft.actions || []).length} actions`}
      footer={
        <>
          <Toggle checked={!!draft.enabled} accent="rose" onChange={(v) => set({ enabled: v })}
            label={draft.enabled ? 'Enabled — runs on matching events' : 'Disabled — saved but never runs'} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {/* Editor commits stay SOLID in the modal's own accent. The module
                gradient belongs to the header tile and the "New …" action that
                opens this editor — spending it again on every Save turns a
                signature into wallpaper, and it would fight the accent frame
                that tells you which record you are editing. */}
            <Button variant="solid" accent="rose" icon={Check} disabled={!draft.name.trim()} onClick={() => onSave(draft)}>
              Save rule
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <SubTabs
          value={pane}
          onChange={setPane}
          items={RULE_PANES.map((p) => ({
            ...p,
            count: p.value === 'conditions' ? countRows(draft.conditions)
              : p.value === 'actions' ? (draft.actions || []).length : undefined,
          }))}
        />

        {pane === 'setup' && (
          <div className="space-y-3">
            <Field label="Name" required hint="Written as what it does, not what it checks">
              <Input accent="rose" value={draft.name} onChange={(e) => set({ name: e.target.value })}
                placeholder="e.g. Escalate VIP customers on arrival" />
            </Field>
            <Field label="Why this exists" hint="The next person to read this rule needs the reason, not the mechanics">
              <Textarea rows={2} accent="rose" value={draft.description || ''}
                onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Trigger" hint="When the engine evaluates this rule">
              <TileGroup
                value={draft.trigger}
                onChange={(v) => set({ trigger: v })}
                columns={4}
                accent="sky"
                options={TRIGGERS.map((tr) => ({ value: tr.value, label: tr.label, icon: tr.icon, hint: tr.hint, accent: 'sky' }))}
              />
            </Field>
            {draft.trigger === 'scheduled' && (
              <Banner accent="sky" icon={Clock}>
                Scheduled rules run on the hourly tick against every open record — not on submission. Keep the
                conditions narrow, and make sure an action changes something so the rule does not re-fire every hour.
              </Banner>
            )}
          </div>
        )}

        {pane === 'conditions' && (
          <div className="space-y-3">
            <Banner accent="purple" icon={Split} title="Read it out loud">
              <span className={t.text}>{readableSummary(draft.conditions, data.options)}</span>
            </Banner>
            <ConditionBuilder
              group={draft.conditions}
              onChange={(g) => set({ conditions: g })}
              options={data.options}
              accent="purple"
            />
          </div>
        )}

        {pane === 'actions' && (
          <ActionsEditor
            actions={draft.actions || []}
            onChange={(actions) => set({ actions })}
            data={data}
          />
        )}

        {pane === 'test' && (
          <RuleTester
            rules={[draft]}
            data={data}
            sample={sample}
            onSample={setSample}
            event={draft.trigger}
            onEvent={(v) => set({ trigger: v })}
            single
          />
        )}
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * CONDITION BUILDER — shared by rules and approval policies
 * ==================================================================== */

function ConditionBuilder({ group, onChange, options, accent = 'purple' }) {
  const g = isGroupNode(group) ? group : emptyGroup('all');
  const onUpdate = useCallback((path, fn) => onChange(updateAt(g, path, fn)), [g, onChange]);
  const onRemove = useCallback((path) => onChange(removeAt(g, path)), [g, onChange]);
  const onAppend = useCallback((path, node) => onChange(appendAt(g, path, node)), [g, onChange]);

  return (
    <ConditionGroupEditor
      group={g}
      path={[]}
      depth={0}
      accent={accent}
      options={options}
      onUpdate={onUpdate}
      onRemove={onRemove}
      onAppend={onAppend}
    />
  );
}

const MATCH_MODES = [
  { value: 'all', label: 'ALL', hint: 'every condition must match' },
  { value: 'any', label: 'ANY', hint: 'one condition is enough' },
];

function ConditionGroupEditor({ group, path, depth, accent, options, onUpdate, onRemove, onAppend }) {
  const { t, a } = useTheme();
  const c = a(accent);
  const rows = group.rows || [];
  const mode = group.match === 'any' ? 'any' : 'all';

  return (
    <div className={cx('rounded-xl border', depth === 0 ? cx(t.bgCard, t.borderLight) : cx(c.soft, c.border))}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={cx('text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>
            {depth === 0 ? 'Match' : 'Nested group — match'}
          </span>
          <div className={cx('inline-flex gap-0.5 p-0.5 rounded-lg', t.bgSubtle)}>
            {MATCH_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => onUpdate(path, (g) => ({ ...g, match: m.value }))}
                title={m.hint}
                className={cx('px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                  mode === m.value ? cx(t.bgCard, c.fg, 'shadow-sm') : t.textMuted)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <span className={cx('text-xs', t.textMuted)}>
            {mode === 'all' ? 'of these must be true' : 'of these is enough'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="xs" variant="soft" accent={accent} icon={Plus}
            onClick={() => onAppend(path, defaultRowFor(FIELDS[0].id))}>
            Condition
          </Button>
          <Button size="xs" variant="soft" accent="gray" icon={Split}
            onClick={() => onAppend(path, { match: mode === 'all' ? 'any' : 'all', rows: [defaultRowFor(FIELDS[0].id)] })}>
            Group
          </Button>
          {depth > 0 && (
            <IconButton icon={Trash2} label="Remove group" accent="red" size={ICON.sm} onClick={() => onRemove(path)} />
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={cx('px-3 pb-3 text-xs', t.textMuted)}>
          No conditions — this matches every record. Add one, or leave it open deliberately.
        </p>
      ) : (
        <div className="px-2 pb-2 space-y-1.5">
          {rows.map((row, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className={cx('text-[10px] font-semibold uppercase w-8 pt-2.5 text-right flex-shrink-0', t.textMuted)}>
                {i === 0 ? '' : mode === 'all' ? 'and' : 'or'}
              </span>
              <div className="flex-1 min-w-0">
                {isGroupNode(row) ? (
                  <ConditionGroupEditor
                    group={row}
                    path={[...path, i]}
                    depth={depth + 1}
                    accent={accent}
                    options={options}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    onAppend={onAppend}
                  />
                ) : (
                  <ConditionRowEditor
                    row={row}
                    path={[...path, i]}
                    accent={accent}
                    options={options}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConditionRowEditor({ row, path, accent, options, onUpdate, onRemove }) {
  const { t } = useTheme();
  const field = FIELD_BY_ID[row.field] || FIELDS[0];
  const ops = operatorsFor(field.type);
  const opMeta = ALL_OPERATORS[row.op] || ops[0];

  const changeField = (id) => onUpdate(path, () => defaultRowFor(id));
  const changeOp = (op) => onUpdate(path, (r) => {
    const meta = ALL_OPERATORS[op] || {};
    let value = r.value;
    if (meta.nullary) value = undefined;
    else if (meta.multi) value = Array.isArray(r.value) ? r.value : (r.value == null || r.value === '' ? [] : [r.value]);
    else if (meta.range) value = Array.isArray(r.value) ? r.value : [0, 0];
    else if (Array.isArray(r.value)) value = r.value[0] ?? '';
    return { ...r, op, value };
  });

  return (
    <div className={cx('rounded-lg border flex items-center gap-2 p-1.5 flex-wrap', t.bgCard, t.borderLight)}>
      <div className="min-w-[11rem] flex-1">
        <FieldSelect value={field.id} onChange={changeField} accent={accent} />
      </div>
      <div className="min-w-[8rem]">
        <Select
          accent={accent}
          value={row.op}
          onChange={(e) => changeOp(e.target.value)}
          options={ops.map((o) => ({ value: o.op, label: o.label }))}
        />
      </div>
      <div className="min-w-[10rem] flex-1">
        {isNullary(row.op)
          ? <span className={cx('text-xs italic px-1', t.textMuted)}>no value needed</span>
          : <ValueControl field={field} op={row.op} opMeta={opMeta} value={row.value} accent={accent}
              options={options} onChange={(v) => onUpdate(path, (r) => ({ ...r, value: v }))} />}
      </div>
      <IconButton icon={X} label="Remove condition" accent="red" size={ICON.sm} onClick={() => onRemove(path)} />
    </div>
  );
}

function FieldSelect({ value, onChange, accent }) {
  return (
    <Select accent={accent} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(FIELD_GROUPS).map(([groupName, list]) => (
        <optgroup key={groupName} label={groupName}>
          {list.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </optgroup>
      ))}
    </Select>
  );
}

/**
 * The value control switches on field type AND operator shape, so a text field
 * never offers a number spinner and "is any of" gets a checkbox list rather than
 * a comma-separated string the user has to guess the format of.
 */
function ValueControl({ field, op, opMeta, value, onChange, options, accent }) {
  const { t } = useTheme();
  const choices = withCurrent(optionsForField(field, options), value);

  if (opMeta?.multi) {
    const selected = Array.isArray(value) ? value : (value == null || value === '' ? [] : [value]);
    return (
      <div className={cx('rounded-lg border p-1.5 max-h-28 overflow-auto space-y-1', t.bgInput, t.borderLight)}>
        {choices.length === 0 && <p className={cx('text-xs', t.textMuted)}>No options available yet.</p>}
        {choices.map((o) => (
          <Checkbox
            key={o.value}
            accent={accent}
            label={o.label}
            checked={selected.includes(o.value)}
            onChange={(on) => onChange(on ? [...selected, o.value] : selected.filter((v) => v !== o.value))}
          />
        ))}
      </div>
    );
  }

  if (opMeta?.range) {
    const pair = Array.isArray(value) ? value : [0, 0];
    return (
      <div className="flex items-center gap-1.5">
        <Input accent={accent} type="number" value={pair[0] ?? 0}
          onChange={(e) => onChange([Number(e.target.value), pair[1] ?? 0])} />
        <span className={cx('text-xs', t.textMuted)}>and</span>
        <Input accent={accent} type="number" value={pair[1] ?? 0}
          onChange={(e) => onChange([pair[0] ?? 0, Number(e.target.value)])} />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <Select accent={accent} value={value ?? ''} placeholder="Choose a value…"
        onChange={(e) => onChange(e.target.value)} options={choices} />
    );
  }

  if (field.type === 'number' || op === 'within_days') {
    return (
      <Input accent={accent} type="number" value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={op === 'within_days' ? 'days' : 'amount'} />
    );
  }

  if (field.type === 'date') {
    return <Input accent={accent} type="date" value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <Input accent={accent} value={value ?? ''} onChange={(e) => onChange(e.target.value)}
      placeholder={field.type === 'list' ? 'one entry, e.g. billing' : 'value'} />
  );
}

/* ==================================================================== *
 * ACTIONS
 * ==================================================================== */

function defaultAction(type, data) {
  switch (type) {
    case 'set_priority': return { type, priority: 'high' };
    case 'assign_queue': return { type, queueId: data.queues[0]?.id || Q.GENERAL };
    case 'assign_user': return { type, userId: data.directory[0]?.id || USR.ADMIN };
    case 'add_label': return { type, label: '' };
    case 'notify': return { type, target: { kind: 'queue', queueId: data.queues[0]?.id || Q.GENERAL }, message: '' };
    case 'start_approval': return { type, policyId: data.policies[0]?.id || '' };
    case 'create_task': return { type, title: '', assigneeId: '' };
    case 'run_automation': return { type, automationId: data.automations[0]?.id || '' };
    default: return { type };
  }
}

function ActionsEditor({ actions, onChange, data }) {
  const { t } = useTheme();
  const [adding, setAdding] = useState(false);

  const update = (i, patch) => onChange(actions.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  const remove = (i) => onChange(actions.filter((_, k) => k !== i));
  const move = (i, d) => onChange(moveIn(actions, i, d));

  return (
    <div className="space-y-3">
      <Banner accent="amber" icon={Zap} title="Actions run in order, top to bottom">
        Two actions of the same kind means the last one wins — useful for “set high, then urgent if VIP”, and a
        bug the rest of the time.
      </Banner>

      {actions.length === 0 && (
        <EmptyState icon={Zap} title="No actions" hint="A rule with no actions matches records and then does nothing to them." />
      )}

      <div className="space-y-2">
        {actions.map((action, i) => {
          const meta = ACTION_BY_TYPE[action.type] || ACTION_TYPES[0];
          return (
            <Card key={i} className={cx('p-2.5 flex items-start gap-2.5')}>
              <IconTile icon={meta.icon} accent={meta.accent} size="sm" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cx('text-sm font-medium', t.text)}>{meta.label}</span>
                  <span className={cx('text-[11px]', t.textMuted)}>step {i + 1}</span>
                </div>
                <ActionConfig action={action} onChange={(patch) => update(i, patch)} data={data} />
              </div>
              <div className="flex flex-col items-center flex-shrink-0">
                <button aria-label="Move action up" disabled={i === 0} onClick={() => move(i, -1)}
                  className={cx('px-1 rounded', t.bgHover, i === 0 ? 'opacity-30' : t.textSecondary)}>
                  <ChevronUp size={ICON.sm} />
                </button>
                <button aria-label="Move action down" disabled={i === actions.length - 1} onClick={() => move(i, 1)}
                  className={cx('px-1 rounded', t.bgHover, i === actions.length - 1 ? 'opacity-30' : t.textSecondary)}>
                  <ChevronDown size={ICON.sm} />
                </button>
              </div>
              <IconButton icon={Trash2} label="Remove action" accent="red" size={ICON.sm} onClick={() => remove(i)} />
            </Card>
          );
        })}
      </div>

      {adding ? (
        <Card className={cx(DENSITY.cardPad, 'space-y-2')}>
          <div className="flex items-center justify-between">
            <GroupLabel>Add an action</GroupLabel>
            <IconButton icon={X} label="Cancel" size={ICON.sm} onClick={() => setAdding(false)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ACTION_TYPES.map((at) => (
              <button
                key={at.value}
                onClick={() => { onChange([...actions, defaultAction(at.value, data)]); setAdding(false); }}
                className={cx('p-2.5 rounded-xl border-2 border-transparent transition-colors flex flex-col items-center gap-1 text-center',
                  t.bgCard, t.bgHover)}
              >
                <at.icon size={ICON.lg} className={t.textMuted} />
                <span className={cx('text-xs font-medium', t.textSecondary)}>{at.label}</span>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Button variant="soft" accent="amber" icon={Plus} onClick={() => setAdding(true)}>Add action</Button>
      )}
    </div>
  );
}

function ActionConfig({ action, onChange, data }) {
  const { t } = useTheme();
  const { options, queues, directory } = data;

  switch (action.type) {
    case 'set_priority':
      return (
        <TileGroup
          value={action.priority}
          onChange={(v) => onChange({ priority: v })}
          columns={4}
          options={Object.entries(PRIORITY).map(([k, m]) => ({ value: k, label: m.label, icon: Flag, accent: m.hue }))}
        />
      );

    case 'assign_queue':
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-[14rem] flex-1">
            <Select accent="blue" value={action.queueId || ''} placeholder="Choose a queue…"
              onChange={(e) => onChange({ queueId: e.target.value })}
              options={withCurrent(options.queues, action.queueId)} />
          </div>
          <Chip accent={queues.find((q) => q.id === action.queueId)?.hue || 'gray'} icon={Inbox}>
            {queues.find((q) => q.id === action.queueId)?.name || 'unset — falls back to General'}
          </Chip>
        </div>
      );

    case 'assign_user':
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="min-w-[14rem] flex-1">
            <Select accent="violet" value={action.userId || ''} placeholder="Choose a person…"
              onChange={(e) => onChange({ userId: e.target.value })}
              options={withCurrent(options.people, action.userId)} />
          </div>
          {action.userId && <Avatar name={directory.find((p) => p.id === action.userId)?.name || action.userId} size="md" />}
        </div>
      );

    case 'add_label':
      return (
        <div className="flex items-center gap-2">
          <Input accent="teal" value={action.label || ''} placeholder="e.g. billing"
            onChange={(e) => onChange({ label: e.target.value })} />
          {action.label && <Chip accent="teal" icon={Tag}>{action.label}</Chip>}
        </div>
      );

    case 'notify':
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="min-w-[12rem]">
              <Select accent="amber" value={action.target?.kind || 'queue'}
                onChange={(e) => onChange({ target: { kind: e.target.value } })}
                options={NOTIFY_KINDS} />
            </div>
            {action.target?.kind === 'queue' && (
              <div className="min-w-[12rem] flex-1">
                <Select accent="amber" value={action.target.queueId || ''} placeholder="Choose a queue…"
                  onChange={(e) => onChange({ target: { kind: 'queue', queueId: e.target.value } })}
                  options={withCurrent(options.queues, action.target.queueId)} />
              </div>
            )}
            {action.target?.kind === 'user' && (
              <div className="min-w-[12rem] flex-1">
                <Select accent="amber" value={action.target.userId || ''} placeholder="Choose a person…"
                  onChange={(e) => onChange({ target: { kind: 'user', userId: e.target.value } })}
                  options={withCurrent(options.people, action.target.userId)} />
              </div>
            )}
          </div>
          <Input accent="amber" value={action.message || ''} placeholder="What the notification says"
            onChange={(e) => onChange({ message: e.target.value })} />
        </div>
      );

    case 'start_approval':
      return (
        <div className="space-y-1.5">
          <Select accent="amber" value={action.policyId || ''} placeholder="Choose an approval policy…"
            onChange={(e) => onChange({ policyId: e.target.value })}
            options={withCurrent(options.policies, action.policyId)} />
          {!action.policyId && (
            <p className={cx('text-xs', t.textMuted)}>Without a policy this action does nothing.</p>
          )}
        </div>
      );

    case 'create_task':
      return (
        <div className="grid sm:grid-cols-2 gap-2">
          <Input accent="teal" value={action.title || ''} placeholder="Task title"
            onChange={(e) => onChange({ title: e.target.value })} />
          <Select accent="teal" value={action.assigneeId || ''} placeholder="Unassigned"
            onChange={(e) => onChange({ assigneeId: e.target.value })}
            options={withCurrent(options.people, action.assigneeId)} />
        </div>
      );

    case 'run_automation':
      return (
        <div className="space-y-1.5">
          <Select accent="sky" value={action.automationId || ''} placeholder="Choose an automation…"
            onChange={(e) => onChange({ automationId: e.target.value })}
            options={withCurrent(options.automations, action.automationId)} />
          {options.automations.length === 0 && (
            <Banner accent="amber" icon={AlertTriangle}>
              No automations are defined yet. The id is kept so this action starts working the moment one exists.
            </Banner>
          )}
        </div>
      );

    default:
      return null;
  }
}

/* ==================================================================== *
 * RULE TESTER — the "why did this fire" explainer
 * ==================================================================== */

const SAMPLE_PRESETS = [
  {
    id: 'vip-outage',
    label: 'VIP outage — Lumen Retail (Enterprise)',
    hint: 'Dana Whitmore phones in during a checkout failure',
    ctx: {
      requesterId: USR.LISA,
      ticket: {
        title: 'Storefront production down — customers cannot check out',
        description: 'Card payments started failing at 09:12. The store is down for all regions.',
        priority: 'high', status: 'open', source: 'phone', labels: [],
        subformId: SF.STOREFRONT_BUG, catalogItemId: CAT.I_STOREFRONT_SETUP, queueId: null,
      },
      requester: { department: '', isExternal: true, vip: true },
      org: { plan: 'Enterprise' },
      answers: { amount: 0, quantity: 0, accessLevel: 'read', startDate: '' },
      change: { changeType: '', risk: '', impact: '', affectsProduction: false },
      asset: { kind: '', cost: 0, renewalDate: '' },
    },
  },
  {
    id: 'software-spend',
    label: 'Design software request — Sarah Johnson',
    hint: '$1,450 of Adobe licences, internal, Marketing',
    ctx: {
      requesterId: USR.SARAH,
      ticket: {
        title: 'Adobe Creative Cloud for the brand refresh',
        description: 'Three seats for the campaign team through to year end.',
        priority: 'medium', status: 'open', source: 'portal', labels: [],
        subformId: SF.SOFTWARE_REQUEST, catalogItemId: CAT.I_SOFTWARE_REQ, queueId: null,
      },
      requester: { department: 'Marketing', isExternal: false, vip: false },
      org: { plan: '' },
      answers: { amount: 1450, quantity: 3, accessLevel: 'read', startDate: '' },
      change: { changeType: '', risk: '', impact: '', affectsProduction: false },
      asset: { kind: 'software', cost: 1450, renewalDate: '2027-08-01' },
    },
  },
  {
    id: 'admin-access',
    label: 'Admin access to the billing console — Tom Alvarez',
    hint: 'Sales AE asking for write access to a finance system',
    ctx: {
      requesterId: USR.TOM,
      ticket: {
        title: 'Admin access to the billing console',
        description: 'Need to issue credits without going through Finance each time.',
        priority: 'medium', status: 'open', source: 'portal', labels: [],
        subformId: SF.REQUEST_ACCESS, catalogItemId: CAT.I_BILLING, queueId: null,
      },
      requester: { department: 'Sales', isExternal: false, vip: false },
      org: { plan: '' },
      answers: { amount: 0, quantity: 0, accessLevel: 'admin', startDate: '' },
      change: { changeType: '', risk: '', impact: '', affectsProduction: false },
      asset: { kind: '', cost: 0, renewalDate: '' },
    },
  },
  {
    id: 'new-hire',
    label: 'New hire — Product, starts in three weeks',
    hint: 'Filed by Jennifer Lopez for a September start',
    ctx: {
      requesterId: USR.JEN,
      ticket: {
        title: 'New hire setup — Associate Product Manager',
        description: 'Laptop, accounts, desk in New York, starts 7 September.',
        priority: 'medium', status: 'open', source: 'portal', labels: [],
        subformId: SF.NEW_HIRE, catalogItemId: '', queueId: null,
      },
      requester: { department: 'Product', isExternal: false, vip: false },
      org: { plan: '' },
      answers: { amount: 2400, quantity: 1, accessLevel: 'read', startDate: '2026-09-07' },
      change: { changeType: '', risk: '', impact: '', affectsProduction: false },
      asset: { kind: 'hardware', cost: 2400, renewalDate: '' },
    },
  },
  {
    id: 'emergency-change',
    label: 'Emergency change — payment gateway certificate',
    hint: 'Priya Raman, expiring cert, production',
    ctx: {
      requesterId: USR.PRIYA,
      ticket: {
        title: 'Rotate the payment gateway TLS certificate',
        description: 'Certificate expires in six hours. Rotation requires a gateway restart.',
        priority: 'high', status: 'open', source: 'api', labels: [],
        subformId: '', catalogItemId: CAT.I_PAYMENTS, queueId: null,
      },
      requester: { department: 'Product', isExternal: false, vip: false },
      org: { plan: '' },
      answers: { amount: 0, quantity: 0, accessLevel: 'read', startDate: '' },
      change: { changeType: 'emergency', risk: 'high', impact: 'high', affectsProduction: true },
      asset: { kind: '', cost: 0, renewalDate: '' },
    },
  },
  {
    id: 'billing-starter',
    label: 'Billing question — Fernbrook (Starter)',
    hint: 'Cole Brennan, double charge, low urgency',
    ctx: {
      requesterId: USR.NADIA,
      ticket: {
        title: 'We were charged twice for the August invoice',
        description: 'Two charges of $49 on the same day. Please refund one.',
        priority: 'low', status: 'open', source: 'email', labels: [],
        subformId: SF.BILLING_QUESTION, catalogItemId: CAT.I_BILLING, queueId: null,
      },
      requester: { department: '', isExternal: true, vip: false },
      org: { plan: 'Starter' },
      answers: { amount: 49, quantity: 1, accessLevel: 'read', startDate: '' },
      change: { changeType: '', risk: '', impact: '', affectsProduction: false },
      asset: { kind: '', cost: 0, renewalDate: '' },
    },
  },
  {
    id: 'quiet-monitor',
    label: 'Monitor request — nothing should fire',
    hint: 'The control case: a $220 internal request under every threshold',
    ctx: {
      requesterId: USR.MIKE,
      ticket: {
        title: 'Second monitor for the New York desk',
        description: 'Standard 27" display, no rush.',
        priority: 'low', status: 'open', source: 'portal', labels: [],
        subformId: SF.NEW_HARDWARE, catalogItemId: '', queueId: null,
      },
      requester: { department: 'Product', isExternal: false, vip: false },
      org: { plan: '' },
      answers: { amount: 220, quantity: 1, accessLevel: 'read', startDate: '' },
      change: { changeType: '', risk: '', impact: '', affectsProduction: false },
      asset: { kind: 'hardware', cost: 220, renewalDate: '' },
    },
  },
];

const SAMPLE_FIELDS = [
  { path: 'ticket.title', label: 'Title', type: 'text', wide: true },
  { path: 'ticket.description', label: 'Description', type: 'text', wide: true },
  { path: 'ticket.priority', label: 'Priority', type: 'select', choices: ['urgent', 'high', 'medium', 'low'] },
  { path: 'ticket.status', label: 'Status', type: 'select', choices: ['open', 'in_progress', 'pending', 'resolved', 'closed'] },
  { path: 'ticket.source', label: 'Source', type: 'select', choices: ['portal', 'email', 'chat', 'phone', 'api'] },
  { path: 'ticket.subformId', label: 'Submitted form', type: 'select', from: 'subforms' },
  { path: 'ticket.catalogItemId', label: 'Catalog item', type: 'select', from: 'catalogItems' },
  { path: 'ticket.labels', label: 'Labels', type: 'list' },
  { path: 'requester.department', label: 'Department', type: 'select', from: 'departments' },
  { path: 'org.plan', label: 'Customer plan', type: 'select', choices: ['Enterprise', 'Business', 'Starter'] },
  { path: 'answers.amount', label: 'Amount', type: 'number' },
  { path: 'answers.accessLevel', label: 'Access level', type: 'select', choices: ['read', 'write', 'admin'] },
  { path: 'change.changeType', label: 'Change type', type: 'select', choices: ['standard', 'normal', 'emergency'] },
  { path: 'change.risk', label: 'Change risk', type: 'select', choices: ['high', 'moderate', 'low'] },
];

const SAMPLE_FLAGS = [
  { path: 'requester.vip', label: 'Requester is VIP' },
  { path: 'requester.isExternal', label: 'Requester is a customer' },
  { path: 'change.affectsProduction', label: 'Affects production' },
];

function RuleTester({ rules, data, sample, onSample, event, onEvent, single }) {
  const { t } = useTheme();
  const [ran, setRan] = useState(false);
  const [openTrace, setOpenTrace] = useState(null);
  const [showSample, setShowSample] = useState(true);

  const { results, outcome } = useMemo(
    () => runRules(rules, sample, event),
    [rules, sample, event],
  );

  const fired = results.filter((r) => r.state === 'fired');

  const applyPreset = (id) => {
    const preset = SAMPLE_PRESETS.find((p) => p.id === id);
    if (preset) { onSample(clone(preset.ctx)); setRan(true); setOpenTrace(null); }
  };

  return (
    <Card accent="emerald" className={cx(DENSITY.cardPad, 'space-y-3')}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <IconTile icon={FlaskConical} accent="emerald" />
          <div className="min-w-0">
            <p className={cx('text-sm font-semibold', t.text)}>Rule tester</p>
            <p className={cx('text-xs', t.textMuted)}>
              {single ? 'Runs this rule' : `Runs all ${rules.length} rules in order`} against a sample record, using the real engine.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={showSample ? ChevronUp : ChevronDown}
            onClick={() => setShowSample((v) => !v)}>
            {showSample ? 'Hide sample' : 'Edit sample'}
          </Button>
          <Button size="sm" variant="solid" accent="emerald" icon={Play} onClick={() => setRan(true)}>Test</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <Field label="Start from a sample record">
          <Select accent="emerald" placeholder="Pick a sample…" value=""
            onChange={(e) => applyPreset(e.target.value)}
            options={SAMPLE_PRESETS.map((p) => ({ value: p.id, label: p.label }))} />
        </Field>
        <Field label="Simulate which event" hint="Rules whose trigger differs are not evaluated at all">
          <Select accent="sky" value={event} onChange={(e) => onEvent(e.target.value)}
            options={TRIGGERS.map((tr) => ({ value: tr.value, label: tr.label }))} />
        </Field>
      </div>

      {showSample && <SampleEditor sample={sample} onChange={onSample} data={data} />}

      {!ran ? (
        <Banner accent="emerald" icon={Play}>
          Press <strong className={t.text}>Test</strong> to evaluate the sample. Every condition is shown with the value
          it expected, the value the record actually had, and the verdict — so a rule that does not fire tells you why.
        </Banner>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Stat label="fired" value={fired.length} accent={fired.length ? 'emerald' : 'gray'} icon={Check} />
            <Stat label="did not match" value={results.filter((r) => r.state === 'skipped').length} accent="gray" icon={X} />
            <Stat label="wrong trigger" value={results.filter((r) => r.state === 'other_trigger').length} accent="sky" icon={Clock} />
            <Stat label="disabled" value={results.filter((r) => r.state === 'disabled').length} accent="gray" icon={Ban} />
          </div>

          <div className="space-y-1.5">
            {results.map((res, i) => (
              <TesterResultRow
                key={res.rule.id}
                index={i}
                result={res}
                open={openTrace === res.rule.id}
                onToggle={() => setOpenTrace(openTrace === res.rule.id ? null : res.rule.id)}
                data={data}
              />
            ))}
          </div>

          <OutcomePanel outcome={outcome} data={data} fired={fired.length} />
        </div>
      )}
    </Card>
  );
}

function SampleEditor({ sample, onChange, data }) {
  const { t } = useTheme();
  const { options } = data;
  const set = (path, value) => onChange(setPath(sample, path, value));

  return (
    <div className={cx('rounded-xl border p-3 space-y-3', t.bgSubtle, t.borderLight)}>
      <GroupLabel>Sample record</GroupLabel>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {SAMPLE_FIELDS.map((f) => {
          const value = getPath(sample, f.path);
          const choices = f.from
            ? withCurrent(options[f.from] || [], value)
            : (f.choices || []).map((c) => ({ value: c, label: c }));
          return (
            <Field key={f.path} label={f.label} className={f.wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
              {f.type === 'select' ? (
                <Select accent="emerald" value={value ?? ''} placeholder="—"
                  onChange={(e) => set(f.path, e.target.value)} options={choices} />
              ) : f.type === 'number' ? (
                <Input accent="emerald" type="number" value={value ?? 0}
                  onChange={(e) => set(f.path, Number(e.target.value))} />
              ) : f.type === 'list' ? (
                <Input accent="emerald" value={(value || []).join(', ')} placeholder="comma separated"
                  onChange={(e) => set(f.path, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
              ) : (
                <Input accent="emerald" value={value ?? ''} onChange={(e) => set(f.path, e.target.value)} />
              )}
            </Field>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {SAMPLE_FLAGS.map((f) => (
          <Toggle key={f.path} accent="emerald" label={f.label}
            checked={!!getPath(sample, f.path)} onChange={(v) => set(f.path, v)} />
        ))}
      </div>
      <div className="max-w-xs">
        <Field label="Requester" hint="Used to resolve manager-based approvers">
          <Select accent="emerald" value={sample.requesterId || ''} placeholder="Nobody"
            onChange={(e) => set('requesterId', e.target.value)} options={options.people} />
        </Field>
      </div>
    </div>
  );
}

const RESULT_META = {
  fired: { label: 'Fires', hue: 'emerald', icon: Check },
  skipped: { label: 'No match', hue: 'gray', icon: X },
  other_trigger: { label: 'Different trigger', hue: 'sky', icon: Clock },
  disabled: { label: 'Disabled', hue: 'gray', icon: Ban },
};

function TesterResultRow({ index, result, open, onToggle, data }) {
  const { t, a } = useTheme();
  const meta = RESULT_META[result.state];
  const c = a(meta.hue);
  const Icon = meta.icon;
  const rule = result.rule;

  return (
    <div className={cx('rounded-lg border overflow-hidden', t.bgCard, result.state === 'fired' ? c.borderStrong : t.borderLight)}>
      <button
        onClick={onToggle}
        className={cx('w-full flex items-center gap-2.5 px-3 py-2 text-left', t.bgHover)}
      >
        <span className={cx('text-[11px] tabular-nums w-4', t.textMuted)}>{index + 1}</span>
        <span className={cx('w-1 self-stretch min-h-6 rounded-full flex-shrink-0', c.rail)} />
        <Icon size={ICON.base} className={cx(c.fg, 'flex-shrink-0')} />
        <span className={cx('flex-1 min-w-0 text-sm font-medium truncate', t.text)}>{rule.name || 'Untitled rule'}</span>
        <Chip accent={meta.hue}>{meta.label}</Chip>
        {result.trace && (
          <ChevronDown size={ICON.base} className={cx(t.textMuted, 'transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {open && (
        <div className={cx('px-3 py-2.5 border-t space-y-2', t.borderLight, t.bgSubtle)}>
          {result.state === 'other_trigger' && (
            <p className={cx('text-xs', t.textSecondary)}>
              This rule listens for <strong className={t.text}>{TRIGGER_BY_VALUE[rule.trigger]?.label}</strong> and was
              not evaluated for the simulated event.
            </p>
          )}
          {result.state === 'disabled' && (
            <p className={cx('text-xs', t.textSecondary)}>Turned off. Its conditions were not evaluated.</p>
          )}
          {result.trace && <TraceNode node={result.trace} data={data} />}
          {result.state === 'fired' && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className={cx('text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>Then</span>
              {(rule.actions || []).map((act, i) => {
                const am = ACTION_BY_TYPE[act.type];
                if (!am) return null;
                return (
                  <Chip key={i} accent={actionAccent(act, data)} icon={am.icon}>
                    {describeAction(act, data)}
                  </Chip>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** The indented explain() tree — field, operator, expected, ACTUAL, verdict. */
function TraceNode({ node, data, depth = 0 }) {
  const { t, a } = useTheme();
  const good = a('emerald');
  const bad = a('red');

  if (node.kind === 'empty' || (node.kind === 'group' && !node.rows.length)) {
    return (
      <p className={cx('text-xs italic', t.textMuted)}>
        No conditions — this matches every record.
      </p>
    );
  }

  if (node.kind === 'group') {
    const c = node.matched ? good : bad;
    return (
      <div className={cx(depth > 0 && 'ml-2 pl-2 border-l', depth > 0 && t.borderLight)}>
        <div className="flex items-center gap-2 py-1">
          <Split size={ICON.sm} className={t.textMuted} />
          <span className={cx('text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>
            {node.match === 'any' ? 'Any of' : 'All of'}
          </span>
          <span className={cx('text-[11px] px-1.5 py-0.5 rounded-full font-semibold', c.soft, c.fgOnSoft)}>
            {node.matched ? 'true' : 'false'}
          </span>
        </div>
        <div className="space-y-1">
          {node.rows.map((child, i) => <TraceNode key={i} node={child} data={data} depth={depth + 1} />)}
        </div>
      </div>
    );
  }

  const c = node.matched ? good : bad;
  const field = FIELD_BY_ID[node.field];
  const opts = optionsForField(field, data.options);
  const pretty = (v) => (Array.isArray(v)
    ? v.map((x) => labelIn(opts, x, String(x))).join(', ')
    : (field?.optionsFrom ? labelIn(opts, v, fmtValue(v)) : fmtValue(v)));

  return (
    <div className={cx('rounded-lg border px-2.5 py-1.5 flex items-start gap-2 flex-wrap', t.bgCard, c.border)}>
      <span className={cx('w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', c.softStrong)}>
        {node.matched
          ? <Check size={ICON.xs} className={c.fg} />
          : <X size={ICON.xs} className={c.fg} />}
      </span>
      <span className={cx('text-xs font-medium', t.text)}>{fieldLabel(node.field)}</span>
      <span className={cx('text-xs', t.textMuted)}>{operatorLabel(node.op)}</span>
      {!isNullary(node.op) && (
        <span className={cx('text-xs font-medium', t.text)}>{pretty(node.value)}</span>
      )}
      <span className="flex-1" />
      <span className={cx('text-[11px]', t.textMuted)}>
        actual: <span className={cx('font-medium', node.actual === undefined ? t.textMuted : t.text)}>
          {pretty(node.actual)}
        </span>
      </span>
    </div>
  );
}

function OutcomePanel({ outcome, data, fired }) {
  const { t } = useTheme();
  const { queues, directory, options } = data;
  const queue = queues.find((q) => q.id === outcome.queueId.value);
  const defaultQueue = queues.find((q) => q.isDefault);

  return (
    <Card accent="emerald" className={cx(DENSITY.cardPad, 'space-y-3')}>
      <div className="flex items-center gap-2">
        <Gauge size={ICON.md} className={t.textSecondary} />
        <p className={cx('text-sm font-semibold', t.text)}>The record after {fired} rule{fired === 1 ? '' : 's'} ran</p>
      </div>

      {!outcome.queueId.value && (
        <Banner accent="amber" icon={Target}>
          No rule assigned a queue. This ticket falls to <strong className={t.text}>{defaultQueue?.name || 'General'}</strong>{' '}
          — the default, not a decision anybody made.
        </Banner>
      )}

      <div className="grid sm:grid-cols-3 gap-2">
        <OutcomeCell label="Priority" by={outcome.priority.by}>
          <PriorityFlag priority={outcome.priority.value || 'medium'} />
        </OutcomeCell>
        <OutcomeCell label="Queue" by={outcome.queueId.by || 'default fallback'}>
          <Chip accent={queue?.hue || 'amber'} icon={Inbox}>{queue?.name || `${defaultQueue?.name || 'General'} (fallback)`}</Chip>
        </OutcomeCell>
        <OutcomeCell label="Assignee" by={outcome.assigneeId.by || 'nobody yet'}>
          {outcome.assigneeId.value
            ? <div className="flex items-center gap-1.5">
                <Avatar name={directory.find((p) => p.id === outcome.assigneeId.value)?.name || outcome.assigneeId.value} size="sm" />
                <span className={cx('text-xs', t.text)}>
                  {directory.find((p) => p.id === outcome.assigneeId.value)?.name || outcome.assigneeId.value}
                </span>
              </div>
            : <span className={cx('text-xs', t.textMuted)}>Unassigned — picked up from the queue</span>}
        </OutcomeCell>
      </div>

      <div className="space-y-2">
        <OutcomeList label="Labels" icon={Tag} accent="teal"
          items={outcome.labels.map((l) => ({ text: l.label, by: l.by }))} empty="No labels applied." />
        <OutcomeList label="Approvals started" icon={Stamp} accent="amber"
          items={outcome.approvals.map((ap) => ({ text: labelIn(options.policies, ap.policyId, ap.policyId), by: ap.by }))}
          empty="No approval policy was started." />
        <OutcomeList label="Tasks created" icon={ListChecks} accent="teal"
          items={outcome.tasks.map((task) => ({
            text: task.assigneeId
              ? `${task.title} → ${directory.find((p) => p.id === task.assigneeId)?.name || task.assigneeId}`
              : task.title,
            by: task.by,
          }))} empty="No tasks created." />
        <OutcomeList label="Notifications" icon={Bell} accent="amber"
          items={outcome.notifications.map((n) => ({ text: describeNotifyTarget(n.target, data), by: n.by }))}
          empty="Nobody is notified." />
        <OutcomeList label="Automations triggered" icon={Workflow} accent="sky"
          items={outcome.automations.map((au) => ({ text: labelIn(options.automations, au.automationId, au.automationId), by: au.by }))}
          empty="No automation runs." />
      </div>
    </Card>
  );
}

function OutcomeCell({ label, by, children }) {
  const { t } = useTheme();
  return (
    <div className={cx('rounded-lg border p-2.5', t.bgCard, t.borderLight)}>
      <GroupLabel>{label}</GroupLabel>
      <div className="mt-1.5">{children}</div>
      {by && <p className={cx('text-[10px] mt-1.5 truncate', t.textMuted)}>set by {by}</p>}
    </div>
  );
}

function OutcomeList({ label, icon: Icon, accent, items, empty }) {
  const { t } = useTheme();
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className={cx('flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider w-40 flex-shrink-0 pt-0.5', t.textMuted)}>
        <Icon size={ICON.sm} /> {label}
      </span>
      {items.length === 0
        ? <span className={cx('text-xs', t.textMuted)}>{empty}</span>
        : <span className="flex items-center gap-1.5 flex-wrap min-w-0">
            {items.map((it, i) => (
              <Chip key={i} accent={accent} title={`set by ${it.by}`}>{it.text}</Chip>
            ))}
          </span>}
    </div>
  );
}

/* ==================================================================== *
 * APPROVAL POLICIES
 * ==================================================================== */

function PoliciesTab({ data, tabs }) {
  const { t } = useTheme();
  const { policies, queues, directory } = data;
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState('');

  const ctx = useMemo(() => ({ directory, queues }), [directory, queues]);

  const needle = query.trim().toLowerCase();
  const visible = policies.filter((p) => !needle
    || [p.name, p.description, readableSummary(p.appliesWhen, data.options)].join(' ').toLowerCase().includes(needle));

  const stageTotal = policies.reduce((n, p) => n + (p.stages || []).length, 0);
  const multiStage = policies.filter((p) => (p.stages || []).length > 1).length;

  const onSave = (draft) => {
    if (policies.some((p) => p.id === draft.id)) patchIn('approvalPolicies', draft.id, draft);
    else addTo('approvalPolicies', draft);
    setEditing(null);
  };

  return (
    <>
      <ModuleHeader
        icon={Filter}
        module={MODULE}
        title="Business Rules"
        subtitle={subsetLabel(visible.length, policies.length,
          `${policies.length} policies · ${stageTotal} stages · ${multiStage} multi-stage`)}
        primary={
          <Button variant="grad" module={MODULE} icon={Plus} onClick={() => setEditing(newPolicy())}>
            New policy
          </Button>
        }
        nav={tabs}
        /* No filters here — a policy is read by name, and the search already
         * covers its conditions. The band still renders because the scoped
         * search lives on it, and a field you type into cannot sit in a
         * container that appears and disappears. */
        filterBar={
          <FilterBar
            accent={ACCENT}
            search={
              <ScopedSearch value={query} onChange={setQuery} scope={`${policies.length} policies`} accent={ACCENT} />
            }
          />
        }
      />

      <PageBody width="max-w-6xl">
        <div className="space-y-4">
          <Banner accent="amber" icon={Stamp} title="A policy is conditions plus ordered stages">
            <strong className={t.text}>Applies when</strong> uses the same condition builder as the rules — one engine,
            one editor. Stages run in order, and approvers are resolved when the request starts, so a reorg later cannot
            silently change who was asked. A stage that resolves to nobody is a configuration fault, never a skip.
          </Banner>

          {visible.length === 0 ? (
            <EmptyState icon={Stamp} title={policies.length === 0 ? 'No approval policies' : 'No policies match'}
              hint={policies.length === 0 ? undefined : 'Clear the search to see every policy.'}
              action={policies.length === 0
                ? <Button variant="grad" module={MODULE} icon={Plus} onClick={() => setEditing(newPolicy())}>New policy</Button>
                : <Button variant="soft" accent={ACCENT} onClick={() => setQuery('')}>Clear search</Button>} />
          ) : (
            <div className="space-y-2">
              {visible.map((p) => (
                <Panel
                  key={p.id}
                  icon={Stamp}
                  accent="amber"
                  title={p.name}
                  subtitle={p.description}
                  action={
                    <div className="flex items-center gap-1">
                      <Chip accent="purple" icon={Split}>{countRows(p.appliesWhen)} conditions</Chip>
                      <IconButton icon={Pencil} label="Edit policy" onClick={() => setEditing(clone(p))} />
                      <IconButton icon={Trash2} label="Delete policy" accent="red" onClick={() => setDeleting(p)} />
                    </div>
                  }
                >
                  <div className="px-4 py-2.5 space-y-2">
                    <p className={cx('text-xs', t.textSecondary)}>
                      <span className={cx('font-semibold uppercase tracking-wider text-[10px] mr-1.5', t.textMuted)}>When</span>
                      {readableSummary(p.appliesWhen, data.options)}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(p.stages || []).map((stage, i) => (
                        <React.Fragment key={stage.id}>
                          {i > 0 && <ArrowRight size={ICON.sm} className={t.textMuted} />}
                          <span className={cx('rounded-lg border px-2 py-1', t.bgCard, t.borderLight)}>
                            <span className={cx('text-xs font-medium block', t.text)}>{stage.name}</span>
                            <span className="flex items-center gap-1 mt-0.5 flex-wrap">
                              <ChipGroup
                                max={2}
                                accent="violet"
                                icon={User}
                                items={(stage.approvers || []).map((spec) => describeApprover(spec, ctx))}
                              />
                              <Chip accent="gray" icon={ruleIcon(stage.rule)}>{stageRuleLabel(stage)}</Chip>
                              <Chip accent="sky" icon={Hourglass}>{stage.dueInHours}h</Chip>
                            </span>
                          </span>
                        </React.Fragment>
                      ))}
                      {!(p.stages || []).length && (
                        <span className={cx('text-xs', t.textMuted)}>No stages — this policy approves instantly.</span>
                      )}
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}

        </div>
      </PageBody>

      {editing && (
        <PolicyEditorModal
          draft={editing}
          data={data}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={onSave}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        name={deleting?.name || ''}
        kind="approval policy"
        cascadeNote="Rules and request forms that start this policy will stop requiring approval — silently, unless you edit them too."
        onCancel={() => setDeleting(null)}
        onConfirm={() => { removeFrom('approvalPolicies', deleting.id); setDeleting(null); }}
      />
    </>
  );
}

function ruleIcon(rule) {
  return rule === 'any' ? SkipForward : rule === 'quorum' ? Users : ShieldCheck;
}

function stageRuleLabel(stage) {
  if (stage.rule === 'any') return 'any one';
  if (stage.rule === 'quorum') return `${stage.quorum || 1} must approve`;
  return 'unanimous';
}

function newPolicy() {
  return {
    id: uid('pol'),
    name: '',
    description: '',
    enabled: true,
    onReject: 'stop',
    appliesWhen: emptyGroup('all'),
    stages: [newStage()],
  };
}

function newStage() {
  return {
    id: uid('stg'),
    name: 'Manager sign-off',
    approvers: [{ kind: 'manager' }],
    rule: 'all',
    quorum: 1,
    dueInHours: 24,
    onTimeout: 'escalate',
    escalateTo: { kind: 'manager_of_manager' },
  };
}

const POLICY_PANES = [
  { value: 'setup', label: 'Setup', icon: Pencil, accent: 'amber' },
  { value: 'when', label: 'Applies when', icon: Split, accent: 'purple' },
  { value: 'stages', label: 'Stages', icon: Layers, accent: 'violet' },
  { value: 'preview', label: 'Preview', icon: Users, accent: 'emerald' },
];

function PolicyEditorModal({ draft, data, onChange, onClose, onSave }) {
  const { t } = useTheme();
  const [pane, setPane] = useState('setup');
  const set = (patch) => onChange({ ...draft, ...patch });
  const stages = draft.stages || [];

  const setStage = (i, patch) => set({ stages: stages.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  return (
    <Modal
      open
      onClose={onClose}
      accent="amber"
      size="modalXl"
      icon={Stamp}
      title={draft.name || 'New approval policy'}
      subtitle={`${stages.length} stage${stages.length === 1 ? '' : 's'} · ${countRows(draft.appliesWhen)} conditions`}
      footer={
        <>
          <span className={cx('text-sm', t.textMuted)}>
            {draft.onReject === 'continue' ? 'Rejections do not stop the chain' : 'A rejection stops the request'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {/* Solid amber, matching this modal's accent — see the note on the
                rule editor's Save. The gradient is the module's, not every
                commit button's. */}
            <Button variant="solid" accent="amber" icon={Check} disabled={!draft.name.trim()} onClick={() => onSave(draft)}>
              Save policy
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <SubTabs
          value={pane}
          onChange={setPane}
          items={POLICY_PANES.map((p) => ({
            ...p,
            count: p.value === 'stages' ? stages.length : p.value === 'when' ? countRows(draft.appliesWhen) : undefined,
          }))}
        />

        {pane === 'setup' && (
          <div className="space-y-3">
            <Field label="Name" required>
              <Input accent="amber" value={draft.name} onChange={(e) => set({ name: e.target.value })}
                placeholder="e.g. Spend over $5,000" />
            </Field>
            <Field label="Description" hint="What this protects and why the threshold is where it is">
              <Textarea rows={2} accent="amber" value={draft.description || ''}
                onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="On rejection">
              <TileGroup
                value={draft.onReject || 'stop'}
                onChange={(v) => set({ onReject: v })}
                columns={2}
                options={[
                  { value: 'stop', label: 'Stop the request', icon: Ban, accent: 'red', hint: 'The usual behaviour' },
                  { value: 'continue', label: 'Continue anyway', icon: SkipForward, accent: 'gray', hint: 'Advisory approvers' },
                ]}
              />
            </Field>
            <Toggle checked={draft.enabled !== false} accent="amber"
              onChange={(v) => set({ enabled: v })}
              label={draft.enabled !== false ? 'Enabled' : 'Disabled — never matches'} />
          </div>
        )}

        {pane === 'when' && (
          <div className="space-y-3">
            <Banner accent="purple" icon={Split} title="Read it out loud">
              <span className={t.text}>{readableSummary(draft.appliesWhen, data.options)}</span>
            </Banner>
            <ConditionBuilder
              group={draft.appliesWhen}
              onChange={(g) => set({ appliesWhen: g })}
              options={data.options}
              accent="purple"
            />
          </div>
        )}

        {pane === 'stages' && (
          <div className="space-y-2">
            {stages.map((stage, i) => (
              <StageEditor
                key={stage.id}
                stage={stage}
                index={i}
                total={stages.length}
                data={data}
                onChange={(patch) => setStage(i, patch)}
                onMove={(d) => set({ stages: moveIn(stages, i, d) })}
                onRemove={() => set({ stages: stages.filter((_, k) => k !== i) })}
              />
            ))}
            <Button variant="soft" accent="violet" icon={Plus}
              onClick={() => set({ stages: [...stages, newStage()] })}>
              Add stage
            </Button>
          </div>
        )}

        {pane === 'preview' && <PolicyPreview policy={draft} data={data} />}
      </div>
    </Modal>
  );
}

function StageEditor({ stage, index, total, data, onChange, onMove, onRemove }) {
  const { t } = useTheme();
  const approvers = stage.approvers || [];

  const setApprover = (i, spec) => onChange({ approvers: approvers.map((a, k) => (k === i ? spec : a)) });

  return (
    <Card className={cx(DENSITY.cardPad, 'space-y-3')}>
      <div className="flex items-center gap-2.5">
        <span className={cx('w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0',
          t.bgSubtle, t.textSecondary)}>{index + 1}</span>
        <Input accent="violet" value={stage.name} placeholder="Stage name"
          onChange={(e) => onChange({ name: e.target.value })} />
        <div className="flex flex-col">
          <button aria-label="Move stage up" disabled={index === 0} onClick={() => onMove(-1)}
            className={cx('px-1 rounded', t.bgHover, index === 0 ? 'opacity-30' : t.textSecondary)}>
            <ChevronUp size={ICON.sm} />
          </button>
          <button aria-label="Move stage down" disabled={index === total - 1} onClick={() => onMove(1)}
            className={cx('px-1 rounded', t.bgHover, index === total - 1 ? 'opacity-30' : t.textSecondary)}>
            <ChevronDown size={ICON.sm} />
          </button>
        </div>
        <IconButton icon={Trash2} label="Remove stage" accent="red" onClick={onRemove} />
      </div>

      <div>
        <GroupLabel>Approvers</GroupLabel>
        <div className="mt-1.5 space-y-1.5">
          {approvers.map((spec, i) => (
            <ApproverSpecEditor
              key={i}
              spec={spec}
              data={data}
              onChange={(s) => setApprover(i, s)}
              onRemove={() => onChange({ approvers: approvers.filter((_, k) => k !== i) })}
            />
          ))}
          {approvers.length === 0 && (
            <Banner accent="amber" icon={AlertTriangle}>
              No approvers. This stage will resolve to nobody and block the request rather than pass it.
            </Banner>
          )}
          <Button size="xs" variant="soft" accent="violet" icon={Plus}
            onClick={() => onChange({ approvers: [...approvers, { kind: 'manager' }] })}>
            Add approver
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Decision rule">
          <Select accent="violet" value={stage.rule || 'all'}
            onChange={(e) => onChange({ rule: e.target.value })}
            options={STAGE_RULES.map((r) => ({ value: r.rule, label: r.label }))} />
          <p className={cx('text-xs mt-1', t.textMuted)}>
            {STAGE_RULES.find((r) => r.rule === (stage.rule || 'all'))?.hint}
          </p>
        </Field>
        {stage.rule === 'quorum' && (
          <Field label="How many must approve">
            <Input accent="violet" type="number" min={1} value={stage.quorum || 1}
              onChange={(e) => onChange({ quorum: Number(e.target.value) })} />
          </Field>
        )}
        <Field label="Due in (hours)" hint="When the escalation clock fires">
          <Input accent="sky" type="number" min={0} value={stage.dueInHours ?? 24}
            onChange={(e) => onChange({ dueInHours: Number(e.target.value) })} />
        </Field>
        <Field label="If nobody decides in time">
          <Select accent="sky" value={stage.onTimeout || 'wait'}
            onChange={(e) => onChange({ onTimeout: e.target.value })}
            options={TIMEOUT_ACTIONS} />
        </Field>
      </div>

      {stage.onTimeout === 'escalate' && (
        <div>
          <GroupLabel>Escalate to</GroupLabel>
          <div className="mt-1.5">
            <ApproverSpecEditor
              spec={stage.escalateTo || { kind: 'manager_of_manager' }}
              data={data}
              onChange={(s) => onChange({ escalateTo: s })}
            />
          </div>
        </div>
      )}

      {stage.onTimeout === 'auto_approve' && (
        <Banner accent="red" icon={AlertTriangle}>
          Auto-approve on timeout means silence counts as a yes. Defensible for low-value spend, indefensible for
          access grants — the audit trail will say the system approved it, not a person.
        </Banner>
      )}
    </Card>
  );
}

function ApproverSpecEditor({ spec, data, onChange, onRemove }) {
  const { t } = useTheme();
  const { options, queues, directory } = data;
  const ctx = { directory, queues };
  const resolved = resolveApprovers(spec, { requesterId: null, directory, queues });

  return (
    <div className={cx('rounded-lg border p-1.5 flex items-center gap-2 flex-wrap', t.bgCard, t.borderLight)}>
      <div className="min-w-[12rem] flex-1">
        <Select accent="violet" value={spec?.kind || 'manager'}
          onChange={(e) => onChange({ kind: e.target.value })}
          options={APPROVER_KINDS.map((k) => ({ value: k.kind, label: k.label }))} />
      </div>

      {spec?.kind === 'user' && (
        <div className="min-w-[12rem] flex-1">
          <Select accent="violet" value={spec.userId || ''} placeholder="Choose a person…"
            onChange={(e) => onChange({ kind: 'user', userId: e.target.value })}
            options={withCurrent(options.people, spec.userId)} />
        </div>
      )}
      {spec?.kind === 'queue' && (
        <div className="min-w-[12rem] flex-1">
          <Select accent="violet" value={spec.queueId || ''} placeholder="Choose a queue…"
            onChange={(e) => onChange({ kind: 'queue', queueId: e.target.value })}
            options={withCurrent(options.queues, spec.queueId)} />
        </div>
      )}
      {spec?.kind === 'department_head' && (
        <div className="min-w-[12rem] flex-1">
          <Select accent="violet" value={spec.department || ''} placeholder="Requester's own department"
            onChange={(e) => onChange({ kind: 'department_head', department: e.target.value })}
            options={options.departments} />
        </div>
      )}
      {spec?.kind === 'role' && (
        <div className="min-w-[12rem] flex-1">
          <Select accent="violet" value={spec.role || ''} placeholder="Choose a role…"
            onChange={(e) => onChange({ kind: 'role', role: e.target.value })}
            options={options.roles} />
        </div>
      )}

      <Chip accent={resolved.length || isDynamic(spec) ? 'violet' : 'amber'} icon={User}>
        {describeApprover(spec, ctx)}
      </Chip>

      {onRemove && <IconButton icon={X} label="Remove approver" accent="red" size={ICON.sm} onClick={onRemove} />}
    </div>
  );
}

/** Specs that only resolve once a requester is known — not a fault on their own. */
function isDynamic(spec) {
  return ['manager', 'manager_of_manager', 'department_head'].includes(spec?.kind);
}

function PolicyPreview({ policy, data }) {
  const { t } = useTheme();
  const { directory, queues } = data;
  const [requesterId, setRequesterId] = useState(USR.SARAH);

  const ctx = useMemo(() => ({ requesterId, directory, queues }), [requesterId, directory, queues]);
  const request = useMemo(
    () => startApproval(policy, ctx, {
      id: 'preview',
      subject: policy.name,
      targetType: 'preview',
      targetId: 'preview',
      now: new Date('2026-08-16T09:00:00').toISOString(),
    }),
    [policy, ctx],
  );

  const prog = progress(request);
  const unresolved = request.stages.filter((s) => s.unresolved);
  const requester = directory.find((p) => p.id === requesterId);
  const nameOf = (id) => directory.find((p) => p.id === id)?.name || id;

  return (
    <div className="space-y-3">
      <Banner accent="emerald" icon={Users} title="Resolved against a real person">
        This runs the actual approval engine. “Requester's manager” becomes a name here, or it becomes a warning —
        which is the point: an unresolvable stage is a configuration fault, not a stage that quietly skips.
      </Banner>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Preview as requester">
          <Select accent="emerald" value={requesterId} onChange={(e) => setRequesterId(e.target.value)}
            options={data.options.people} />
        </Field>
        <div className={cx('rounded-lg border p-2.5 flex items-center gap-2.5', t.bgCard, t.borderLight)}>
          {requester && <Avatar name={requester.name} size="lg" />}
          <div className="min-w-0">
            <p className={cx('text-sm font-medium truncate', t.text)}>{requester?.name || 'Unknown'}</p>
            <p className={cx('text-xs truncate', t.textMuted)}>
              {requester?.title} · {requester?.department} · manager:{' '}
              {requester?.managerId ? nameOf(requester.managerId) : 'none on record'}
            </p>
          </div>
        </div>
      </div>

      {unresolved.length > 0 && (
        <Banner accent="amber" icon={AlertTriangle} title={`${unresolved.length} stage${unresolved.length === 1 ? '' : 's'} resolve to nobody`}>
          {unresolved.map((s) => s.name).join(', ')} — with this requester there is no one to ask. The request would
          stop here rather than pass through. Add a fallback approver or a different escalation.
        </Banner>
      )}

      <div className="space-y-2">
        {request.stages.map((stage, i) => (
          <Card key={stage.id} accent={stage.unresolved ? 'amber' : 'violet'}
            className={cx(DENSITY.cardPad, 'space-y-2')}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={cx('w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0',
                t.bgSubtle, t.textSecondary)}>{i + 1}</span>
              <span className={cx('text-sm font-medium flex-1 min-w-0 truncate', t.text)}>{stage.name}</span>
              <Chip accent="gray" icon={ruleIcon(stage.rule)}>{stageRuleLabel(stage)}</Chip>
              <Chip accent="sky" icon={Hourglass}>{stage.dueInHours}h → {(TIMEOUT_ACTIONS.find((o) => o.value === stage.onTimeout) || {}).label}</Chip>
              <StatusPill status={i === 0 ? 'awaiting' : 'pending'} />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={cx('text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>Asks</span>
              {(stage.approvers || []).map((spec, k) => (
                <Chip key={k} accent="violet" icon={User}>{describeApprover(spec, { directory, queues })}</Chip>
              ))}
              <ArrowRight size={ICON.sm} className={t.textMuted} />
              {stage.unresolved ? (
                <Chip accent="amber" icon={AlertTriangle}>Resolves to nobody</Chip>
              ) : (
                <>
                  <AvatarStack names={stage.approverIds.map(nameOf)} max={5} size="sm" />
                  <ChipGroup accent="emerald" icon={User} max={3} items={stage.approverIds.map(nameOf)} />
                </>
              )}
            </div>

            {stage.onTimeout === 'escalate' && stage.escalateTo && (
              <p className={cx('text-xs flex items-center gap-1.5', t.textSecondary)}>
                <CornerDownRight size={ICON.sm} className={t.textMuted} />
                After {stage.dueInHours}h, adds {describeApprover(stage.escalateTo, { directory, queues })}
                {resolveApprovers(stage.escalateTo, ctx).length === 0 && (
                  <span className={cx('font-medium', t.text)}> — which also resolves to nobody</span>
                )}
              </p>
            )}
          </Card>
        ))}
        {request.stages.length === 0 && (
          <Banner accent="red" icon={AlertTriangle}>
            No stages. This policy approves instantly, which is almost never what an approval policy is for.
          </Banner>
        )}
      </div>

      {request.stages.length > 0 && (
        <p className={cx('text-xs', t.textMuted)}>
          At start: stage {prog.stageNumber} of {prog.totalStages}, {prog.approvals} of {prog.need} approvals collected.
        </p>
      )}
    </div>
  );
}

/* ==================================================================== *
 * SLA
 * ==================================================================== */

function SlaTab({ data, tabs }) {
  const { t } = useTheme();
  const { slas, settings } = data;
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState('');

  const bh = settings.businessHours || {};

  const needle = query.trim().toLowerCase();
  const visible = slas.filter((s) => !needle
    || [s.name, s.description, s.appliesTo?.plan].filter(Boolean).join(' ').toLowerCase().includes(needle));

  const calendar = slas.filter((s) => s.clock === 'calendar').length;

  const onSave = (draft) => {
    if (slas.some((s) => s.id === draft.id)) patchIn('slaPolicies', draft.id, draft);
    else addTo('slaPolicies', draft);
    setEditing(null);
  };

  return (
    <>
      <ModuleHeader
        icon={Filter}
        module={MODULE}
        title="Business Rules"
        subtitle={subsetLabel(visible.length, slas.length,
          `${slas.length} SLA policies · ${calendar} on a 24×7 clock · ${slas.length - calendar} on business hours`)}
        primary={
          <Button variant="grad" module={MODULE} icon={Plus} onClick={() => setEditing(newSla())}>
            New SLA policy
          </Button>
        }
        nav={tabs}
        /* No filters here either — five policies read fine as a list. The band
         * carries the scoped search alone. */
        filterBar={
          <FilterBar
            accent={ACCENT}
            search={
              <ScopedSearch value={query} onChange={setQuery} scope={`${slas.length} SLA policies`} accent={ACCENT} />
            }
          />
        }
      />

      <PageBody>
        <div className="space-y-4">
          <Banner accent="emerald" icon={Clock} title="Business hours are not a per-policy setting">
            Policies on the business-hours clock use the one working calendar configured for the instance —{' '}
            <strong className={t.text}>{bh.start || '09:00'}–{bh.end || '17:00'}, Mon–Fri, {bh.tz || 'America/Chicago'}</strong>.
            A calendar-clock policy ignores it entirely and counts wall time, weekends included.
          </Banner>

          {visible.length === 0 ? (
            <EmptyState icon={Timer} title={slas.length === 0 ? 'No SLA policies' : 'No SLA policies match'}
              hint={slas.length === 0
                ? 'Without one, no ticket has a target and nothing can be at risk.'
                : 'Clear the search to see every policy.'}
              action={slas.length === 0 ? undefined
                : <Button variant="soft" accent={ACCENT} onClick={() => setQuery('')}>Clear search</Button>} />
          ) : (
            <div className="space-y-2">
              {visible.map((s) => (
                <Panel
                  key={s.id}
                  icon={Timer}
                  accent={s.clock === 'calendar' ? 'rose' : 'emerald'}
                  title={s.name}
                  subtitle={s.description}
                  action={
                    <div className="flex items-center gap-1">
                      <Chip accent={s.appliesTo?.kind === 'internal' ? 'blue' : 'purple'}
                        icon={s.appliesTo?.kind === 'internal' ? Building2 : Users}>
                        {s.appliesTo?.kind === 'internal' ? 'Internal staff' : `${s.appliesTo?.plan || 'Any'} plan`}
                      </Chip>
                      <IconButton icon={Pencil} label="Edit SLA" onClick={() => setEditing(clone(s))} />
                      <IconButton icon={Trash2} label="Delete SLA" accent="red" onClick={() => setDeleting(s)} />
                    </div>
                  }
                >
                  <div className="px-4 py-3 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip accent="amber" icon={Send}>First response {s.firstResponseHours}h</Chip>
                      <Chip accent="emerald" icon={Check}>Resolution {s.resolutionHours}h</Chip>
                      <Chip accent={s.clock === 'calendar' ? 'rose' : 'sky'} icon={s.clock === 'calendar' ? Clock : Building2}>
                        {s.clock === 'calendar' ? 'Calendar hours (24×7)' : 'Business hours only'}
                      </Chip>
                    </div>
                    {s.targets && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.keys(PRIORITY).map((p) => (
                          <div key={p} className={cx('rounded-lg border px-2.5 py-1.5', t.bgCard, t.borderLight)}>
                            <PriorityFlag priority={p} />
                            <p className={cx('text-[11px] mt-1 tabular-nums', t.textSecondary)}>
                              {s.targets[p]?.first ?? s.firstResponseHours}h first · {s.targets[p]?.resolve ?? s.resolutionHours}h resolve
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Panel>
              ))}
            </div>
          )}

        </div>
      </PageBody>

      {editing && (
        <SlaEditorModal
          draft={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={onSave}
          settings={settings}
        />
      )}

      <ConfirmDelete
        open={!!deleting}
        name={deleting?.name || ''}
        kind="SLA policy"
        cascadeNote="Tickets currently measured against it lose their target and stop reporting as at risk or breached."
        onCancel={() => setDeleting(null)}
        onConfirm={() => { removeFrom('slaPolicies', deleting.id); setDeleting(null); }}
      />
    </>
  );
}

function newSla() {
  return {
    id: uid('sla'),
    name: '',
    description: '',
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
  };
}

function SlaEditorModal({ draft, onChange, onClose, onSave, settings }) {
  const { t } = useTheme();
  const set = (patch) => onChange({ ...draft, ...patch });
  const bh = settings.businessHours || {};
  const calendar = draft.clock === 'calendar';

  const setTarget = (priority, key, value) => set({
    targets: { ...(draft.targets || {}), [priority]: { ...((draft.targets || {})[priority] || {}), [key]: value } },
  });

  return (
    <Modal
      open
      onClose={onClose}
      accent={calendar ? 'rose' : 'emerald'}
      size="modalLg"
      icon={Timer}
      title={draft.name || 'New SLA policy'}
      subtitle="First-response and resolution targets, and the clock they run on"
      footer={
        <>
          <span className={cx('text-sm', t.textMuted)}>
            {draft.firstResponseHours}h first response · {draft.resolutionHours}h resolution
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent={calendar ? 'rose' : 'emerald'} icon={Check}
              disabled={!draft.name.trim()} onClick={() => onSave(draft)}>
              Save policy
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input accent="emerald" value={draft.name} onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Enterprise — 24×7" />
        </Field>
        <Field label="Description" hint="What the customer was promised, in the words the contract uses">
          <Textarea rows={2} accent="emerald" value={draft.description || ''}
            onChange={(e) => set({ description: e.target.value })} />
        </Field>

        <Field label="Applies to">
          <TileGroup
            value={draft.appliesTo?.kind || 'plan'}
            onChange={(v) => set({ appliesTo: v === 'internal' ? { kind: 'internal' } : { kind: 'plan', plan: draft.appliesTo?.plan || 'Business' } })}
            columns={2}
            options={[
              { value: 'plan', label: 'A customer plan', icon: Users, accent: 'purple', hint: 'External support' },
              { value: 'internal', label: 'Internal staff requests', icon: Building2, accent: 'blue', hint: 'Every internal queue' },
            ]}
          />
        </Field>

        {draft.appliesTo?.kind === 'plan' && (
          <Field label="Plan">
            <Select accent="purple" value={draft.appliesTo.plan || ''}
              onChange={(e) => set({ appliesTo: { kind: 'plan', plan: e.target.value } })}
              options={['Enterprise', 'Business', 'Starter']} />
          </Field>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="First response target (hours)">
            <Input accent="amber" type="number" min={0} step="0.25" value={draft.firstResponseHours}
              onChange={(e) => set({ firstResponseHours: Number(e.target.value) })} />
          </Field>
          <Field label="Resolution target (hours)">
            <Input accent="emerald" type="number" min={0} value={draft.resolutionHours}
              onChange={(e) => set({ resolutionHours: Number(e.target.value) })} />
          </Field>
        </div>

        <Field label="Clock">
          <Toggle
            checked={calendar}
            accent="rose"
            onChange={(v) => set({ clock: v ? 'calendar' : 'business' })}
            label={calendar ? 'Calendar hours — counts weekends and nights' : 'Business hours only — pauses outside the working calendar'}
          />
        </Field>

        {!calendar && (
          <Banner accent="sky" icon={Building2}>
            The clock pauses outside <strong className={t.text}>{bh.start || '09:00'}–{bh.end || '17:00'}, Mon–Fri ({bh.tz || 'America/Chicago'})</strong>.
            A ticket arriving at 16:45 with a 4-hour target is due at 12:45 the next working day, not at 20:45 tonight.
          </Banner>
        )}
        {calendar && (
          <Banner accent="rose" icon={Clock}>
            The clock never pauses. Make sure somebody is actually on call overnight and at the weekend, or this
            target breaches by design.
          </Banner>
        )}

        <Divider />

        <div>
          <GroupLabel>Per-priority targets</GroupLabel>
          <p className={cx('text-xs mt-1 mb-2', t.textSecondary)}>
            Overrides the headline numbers above. A single target for every priority is what makes urgent tickets
            look healthy right up until they are not.
          </p>
          <div className="space-y-1.5">
            {Object.keys(PRIORITY).map((p) => (
              <div key={p} className={cx('rounded-lg border p-2 flex items-center gap-3 flex-wrap', t.bgCard, t.borderLight)}>
                <span className="w-24 flex-shrink-0"><PriorityFlag priority={p} /></span>
                <div className="flex items-center gap-1.5">
                  <span className={cx('text-xs w-24', t.textMuted)}>first response</span>
                  <div className="w-24">
                    <Input accent="amber" type="number" min={0} step="0.25"
                      value={(draft.targets || {})[p]?.first ?? draft.firstResponseHours}
                      onChange={(e) => setTarget(p, 'first', Number(e.target.value))} />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cx('text-xs w-16', t.textMuted)}>resolve</span>
                  <div className="w-24">
                    <Input accent="emerald" type="number" min={0}
                      value={(draft.targets || {})[p]?.resolve ?? draft.resolutionHours}
                      onChange={(e) => setTarget(p, 'resolve', Number(e.target.value))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
