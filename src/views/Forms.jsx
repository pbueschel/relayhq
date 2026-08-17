import React, { useMemo, useState } from 'react';
import {
  FileText, FileQuestion, Plus, Trash2, Edit3, Check, ArrowUp, ArrowDown,
  ChevronDown, ChevronRight, Eye, ExternalLink, Inbox, Stamp, AlertCircle,
  AlertTriangle, GitBranch, Globe, Building2, Users, Layers, Type, AlignLeft,
  List, ListChecks, CheckSquare, Mail, Phone, Calendar, Hash, DollarSign,
  Paperclip, User, Server, Folder, Settings2, Send, Filter,
} from 'lucide-react';
import {
  useTheme, cx, DENSITY, ICON,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, EntityTag,
  EmptyState, Card, Panel, Section, GroupLabel, ListRow, Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, Toggle, TileGroup,
  Modal, ConfirmDelete,
  LensBar, PageHeader, PageBody, Breadcrumbs,
  ModuleHeader, ScopedSearch, FilterBar, subsetLabel, optionCounts, passes,
} from '@/ds';
import { useStore, patchIn, addTo, removeFrom, uid, nowISO } from '@/store/store.js';
import { navigate } from '@/lib/router.js';
import { OPERATORS, operatorLabel, evaluateRow, summarize } from '@/lib/conditions.js';
import { describeApprover } from '@/lib/approvals.js';
import { Q } from '@/store/seed/ids.js';

/**
 * Forms — portal entry points, and the subform builder behind them.
 *
 * TWO RECORDS, ONE SCREEN:
 *   FORM     a published portal entry point, scoped to products and an audience.
 *   SUBFORM  the actual request intake: fields, routing, approval policy.
 *
 * The differentiator is that a catalog item carries SEVERAL subforms — "Report a
 * problem" and "Request access" are different intakes on the same item and land
 * in different queues. So the builder, not the form list, is the centre of
 * gravity here.
 *
 * Conditional display reuses lib/conditions.js — the same evaluator that runs
 * business rules, approval policies and automation IF-nodes. A form field's
 * `showIf` is one condition row whose `field` is another field's id, evaluated
 * against the answer map. Nothing bespoke, which is why the preview's
 * conditional behaviour is the real behaviour.
 */

/* ==================================================================== *
 * Field type registry — icon and accent per type, used by the rail, the
 * field cards and the preview so a type reads the same in all three.
 * ==================================================================== */

const FIELD_TYPES = [
  { type: 'text',        label: 'Text',        icon: Type,       accent: 'blue',    hint: 'One line' },
  { type: 'textarea',    label: 'Long text',   icon: AlignLeft,  accent: 'blue',    hint: 'Paragraphs' },
  { type: 'select',      label: 'Select',      icon: List,       accent: 'violet',  hint: 'One of many' },
  { type: 'multiselect', label: 'Multi-select',icon: ListChecks, accent: 'violet',  hint: 'Several of many' },
  { type: 'checkbox',    label: 'Checkbox',    icon: CheckSquare,accent: 'teal',    hint: 'Yes or no' },
  { type: 'email',       label: 'Email',       icon: Mail,       accent: 'sky',     hint: 'Address' },
  { type: 'phone',       label: 'Phone',       icon: Phone,      accent: 'sky',     hint: 'Callback number' },
  { type: 'date',        label: 'Date',        icon: Calendar,   accent: 'orange',  hint: 'Calendar' },
  { type: 'number',      label: 'Number',      icon: Hash,       accent: 'amber',   hint: 'Quantity' },
  { type: 'currency',    label: 'Currency',    icon: DollarSign, accent: 'emerald', hint: 'Amount in USD' },
  { type: 'file',        label: 'File',        icon: Paperclip,  accent: 'gray',    hint: 'Attachment' },
  { type: 'user',        label: 'Person',      icon: User,       accent: 'green',   hint: 'Directory picker' },
  { type: 'asset',       label: 'Asset',       icon: Server,     accent: 'cyan',    hint: 'Asset picker' },
];

const TYPE_BY = FIELD_TYPES.reduce((acc, f) => { acc[f.type] = f; return acc; }, {});

function typeMeta(type) {
  return TYPE_BY[type] || TYPE_BY.text;
}

const hasOptions = (type) => type === 'select' || type === 'multiselect';

const AUDIENCES = [
  { value: 'internal', label: 'Internal', icon: Building2, accent: 'blue',   hint: 'Employees' },
  { value: 'external', label: 'External', icon: Globe,     accent: 'green',  hint: 'Customers' },
  { value: 'both',     label: 'Both',     icon: Users,     accent: 'purple', hint: 'Everyone' },
];

const AUDIENCE_BY = AUDIENCES.reduce((acc, a) => { acc[a.value] = a; return acc; }, {});

function audienceMeta(value) {
  return AUDIENCE_BY[value] || AUDIENCE_BY.internal;
}

/**
 * The lens: which of the module's two record types is on screen. It is carried
 * in the route because the builder deep-links back into the request-form list.
 */
const LENSES = [
  { value: 'portal',   label: 'Portal forms',  icon: FileText,     accent: 'purple', scopeNoun: 'forms' },
  { value: 'requests', label: 'Request forms', icon: FileQuestion, accent: 'purple', scopeNoun: 'request forms' },
];

/**
 * ONE ROW MODEL over the two record types, so a single filter set narrows both.
 *
 * A portal form has no destination queue at all, so its routing value is null
 * and a routing filter never matches it — the same rule the workspace applies to
 * a task with no queue. "Published" is shared: an unpublished form and a closed
 * intake are the same fact, because neither is reachable from the portal.
 */
function formItem(form) {
  return {
    kind: 'portal',
    id: form.id,
    record: form,
    audience: form.audience || 'internal',
    published: form.published ? 'published' : 'draft',
    routing: null,
    searchText: [form.name, form.description, form.headline, form.subhead, form.slug]
      .filter(Boolean).join(' ').toLowerCase(),
  };
}

function subformItem(sf) {
  return {
    kind: 'requests',
    id: sf.id,
    record: sf,
    audience: sf.audience || 'internal',
    published: sf.enabled === false ? 'draft' : 'published',
    routing: sf.routing?.queueId ? 'routed' : 'general',
    searchText: [sf.name, sf.description, ...(sf.fields || []).map(f => f.label)]
      .filter(Boolean).join(' ').toLowerCase(),
  };
}

/* ==================================================================== *
 * Conditional display
 *
 * The operator vocabulary comes from lib/conditions.js and is narrowed per
 * source-field type, because a builder that offers "is greater than" on a
 * checkbox is how nonsense conditions get saved.
 * ==================================================================== */

const COND_OPS = {
  text:        ['is', 'is_not', 'contains', 'starts_with', 'is_not_empty', 'is_empty'],
  textarea:    ['contains', 'is_not_empty', 'is_empty'],
  email:       ['is', 'contains', 'is_not_empty', 'is_empty'],
  phone:       ['is_not_empty', 'is_empty'],
  select:      ['is', 'is_not'],
  multiselect: ['includes', 'not_includes', 'is_not_empty', 'is_empty'],
  checkbox:    ['is_true', 'is_false'],
  number:      ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'],
  currency:    ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'],
  date:        ['before', 'after', 'is_empty'],
  file:        ['is_not_empty', 'is_empty'],
  user:        ['is_not_empty', 'is_empty'],
  asset:       ['is_not_empty', 'is_empty'],
};

const NULLARY = new Set(
  Object.values(OPERATORS).flat().filter(o => o.nullary).map(o => o.op),
);

function condOpsFor(type) {
  return (COND_OPS[type] || COND_OPS.text).map(op => ({ value: op, label: operatorLabel(op) }));
}

function defaultOpFor(type) {
  return (COND_OPS[type] || COND_OPS.text)[0];
}

/** Plain-language sentence for a field's condition. Never raw JSON. */
function describeCondition(showIf, fields) {
  if (!showIf?.fieldId) return null;
  const src = fields.find(f => f.id === showIf.fieldId);
  const label = src ? src.label : 'a removed field';
  const op = operatorLabel(showIf.op);
  if (NULLARY.has(showIf.op)) return `Shown only when “${label}” ${op}`;
  const val = Array.isArray(showIf.value) ? showIf.value.join(', ') : String(showIf.value ?? '—');
  return `Shown only when “${label}” ${op} ${val}`;
}

/**
 * Which fields an end user actually sees, given their answers so far.
 * A field whose source field is itself hidden stays hidden — conditions only
 * ever point backwards, so one pass in order is enough.
 */
function visibleFields(fields = [], answers = {}) {
  const shown = new Set();
  const out = [];
  for (const f of fields) {
    if (!f.showIf?.fieldId) { shown.add(f.id); out.push(f); continue; }
    if (!shown.has(f.showIf.fieldId)) continue;
    const row = { field: f.showIf.fieldId, op: f.showIf.op, value: f.showIf.value };
    if (evaluateRow(row, answers)) { shown.add(f.id); out.push(f); }
  }
  return out;
}

/* ==================================================================== *
 * Catalog helpers — forms scope to products, so we read names out of the
 * catalog rather than restating them here.
 * ==================================================================== */

function findNode(nodes, id) {
  for (const n of nodes || []) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

function collectSubformIds(node, out = []) {
  if (!node) return out;
  for (const id of node.subformIds || []) out.push(id);
  for (const child of node.children || []) collectSubformIds(child, out);
  return out;
}

/** Fall back to a readable label so a half-built catalog never shows a raw id. */
function humanizeId(id) {
  return String(id).replace(/^cat-p-/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function productName(catalog, id) {
  return findNode(catalog, id)?.name || humanizeId(id);
}

function queueName(queues, id) {
  return (queues || []).find(q => q.id === id)?.name || null;
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ==================================================================== *
 * The view
 * ==================================================================== */

export default function Forms({ route }) {
  const { forms, subforms, catalog, queues, policies, directory, assets } = useStore(s => ({
    forms: s.forms || [],
    subforms: s.subforms || [],
    catalog: s.catalog || [],
    queues: s.queues || [],
    policies: s.approvalPolicies || [],
    directory: s.directory || [],
    assets: s.assets || [],
  }));

  const lens = route?.sub === 'requests' ? 'requests' : 'portal';
  const openSubform = lens === 'requests' && route?.id
    ? subforms.find(s => s.id === route.id) || null
    : null;

  const [editingForm, setEditingForm] = useState(null);
  const [deletingForm, setDeletingForm] = useState(null);

  /* One header state: the multi-select filter values and the in-page query.
   * There is no tray flag any more — the filter bar is always on screen, so a
   * filter can never be on while its control is hidden. */
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});

  const products = useMemo(() => (catalog || []).filter(n => n.type === 'product'), [catalog]);

  const items = useMemo(
    () => [...forms.map(formItem), ...subforms.map(subformItem)],
    [forms, subforms],
  );

  /* Everything except the lens — so the lens counts reflect the other filters. */
  const preLens = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(it => {
      if (!passes(filters.audience, it.audience)) return false;
      if (!passes(filters.published, it.published)) return false;
      if (!passes(filters.routing, it.routing)) return false;
      // Search layers ON TOP of the filters rather than replacing them.
      if (needle && !it.searchText.includes(needle)) return false;
      return true;
    });
  }, [items, filters, query]);

  const visible = useMemo(() => preLens.filter(it => it.kind === lens), [preLens, lens]);

  /* Counts are computed over BOTH collections whole, not the filtered view, so
   * an option tells you how many records exist rather than how many survive the
   * filters already set — the latter reads as options vanishing as you work. */
  const FILTER_DEFS = useMemo(() => {
    const byAudience = optionCounts(items, it => it.audience);
    const byPublished = optionCounts(items, it => it.published);
    const byRouting = optionCounts(items, it => it.routing);
    return [
      {
        id: 'audience', label: 'Audience', icon: Users,
        options: AUDIENCES.map(a => ({ value: a.value, label: a.label, count: byAudience.get(a.value) || 0 })),
      },
      {
        id: 'published', label: 'Published', icon: Eye,
        options: [
          { value: 'published', label: 'Published', count: byPublished.get('published') || 0 },
          { value: 'draft',     label: 'Draft',     count: byPublished.get('draft') || 0 },
        ],
      },
      {
        id: 'routing', label: 'Routing', icon: Inbox,
        options: [
          { value: 'routed',  label: 'Routed to a queue', count: byRouting.get('routed') || 0 },
          { value: 'general', label: 'Falls to General',  count: byRouting.get('general') || 0 },
        ],
      },
    ];
  }, [items]);

  /* ---- the builder takes the whole screen ---- */
  if (openSubform) {
    return (
      <Builder
        key={openSubform.id}
        subform={openSubform}
        queues={queues}
        policies={policies}
        directory={directory}
        assets={assets}
      />
    );
  }

  const clearFilters = () => { setFilters({}); setQuery(''); };

  const lensItems = LENSES.map(l => ({ ...l, count: preLens.filter(it => it.kind === l.value).length }));
  const activeLens = LENSES.find(l => l.value === lens) || LENSES[0];
  const lensCount = lensItems.find(l => l.value === lens)?.count ?? 0;
  const shown = visible.map(it => it.record);

  /* The subtitle counts against the LENS's population, not both collections
   * added together: the two record types are never on screen at once, so
   * "4 of 42 shown" would compare what you can see to a number you cannot. */
  const lensTotal = lens === 'portal' ? forms.length : subforms.length;

  const unrouted = subforms.filter(sf => !sf.routing?.queueId).length;

  const createForm = () => setEditingForm({
    id: uid('form'), name: '', description: '', headline: '', subhead: '',
    audience: 'internal', productIds: [], published: false, slug: '',
    requireSignIn: true, showKnowledge: true, submissions30d: 0,
    updatedAt: nowISO(), __new: true,
  });

  const createSubform = () => {
    const sf = {
      id: uid('sf'),
      name: 'Untitled request form',
      description: '',
      audience: 'internal',
      routing: {},
      fields: [],
      submitLabel: 'Submit request',
      confirmation: '',
      updatedAt: nowISO(),
      submissions30d: 0,
      enabled: true,
    };
    addTo('subforms', sf);
    navigate('forms', 'requests', sf.id);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ModuleHeader
        icon={FileText}
        module="forms"
        accent="purple"
        title="Forms"
        /* The subtitle always tells the truth about what is on screen: the
         * resting label when nothing narrows the module, "9 of 22 shown" when
         * the lens or a filter does. */
        subtitle={subsetLabel(
          visible.length,
          lensTotal,
          'Portal entry points, and the request intakes that sit behind them',
        )}
        primary={lens === 'portal'
          ? <Button variant="grad" module="forms" icon={Plus} onClick={createForm}>New form</Button>
          : <Button variant="grad" module="forms" icon={Plus} onClick={createSubform}>New request form</Button>}
        actions={<Button variant="outline" icon={ExternalLink} onClick={() => navigate('portal')}>Open portal</Button>}
        /* The lens is centred in row 1, between the module identity and the
         * primary action, so it holds still while either of them changes width. */
        nav={
          <LensBar
            items={lensItems}
            value={lens}
            onChange={(v) => navigate('forms', v === 'requests' ? 'requests' : 'portal')}
            inline
          />
        }
        filterBar={
          <FilterBar
            accent="purple"
            filters={FILTER_DEFS}
            value={filters}
            onChange={setFilters}
            onClearAll={clearFilters}
            search={
              <ScopedSearch
                value={query}
                onChange={setQuery}
                /* Names its own scope, so it can never be mistaken for the global
                 * field in the bar above: "Search 4 forms…" becomes
                 * "Search 18 request forms…" when the lens moves. */
                scope={`${lensCount} ${activeLens.scopeNoun}`}
                accent="purple"
              />
            }
          />
        }
      />

      <PageBody width="max-w-6xl">
        {lens === 'portal' ? (
          <PortalForms
            forms={shown}
            total={forms.length}
            subforms={subforms}
            catalog={catalog}
            onEdit={setEditingForm}
            onDelete={setDeletingForm}
            onCreate={createForm}
          />
        ) : (
          <RequestForms
            subforms={shown}
            total={subforms.length}
            queues={queues}
            policies={policies}
            unrouted={unrouted}
            onCreate={createSubform}
          />
        )}
      </PageBody>

      <FormEditor
        form={editingForm}
        products={products}
        onClose={() => setEditingForm(null)}
      />

      <ConfirmDelete
        open={!!deletingForm}
        name={deletingForm?.name || ''}
        kind="form"
        cascadeNote="The portal entry point disappears. The request forms behind it are not deleted — they stay attached to their catalog items."
        onCancel={() => setDeletingForm(null)}
        onConfirm={() => { removeFrom('forms', deletingForm.id); setDeletingForm(null); }}
      />
    </div>
  );
}

/* ==================================================================== *
 * Portal forms
 * ==================================================================== */

function PortalForms({ forms, total, subforms, catalog, onEdit, onDelete, onCreate }) {
  const { t } = useTheme();

  if (!total) {
    return (
      <EmptyState
        icon={FileText}
        title="No portal forms yet"
        hint="A form is what a person lands on — it scopes the portal to a set of products for one audience."
        action={<Button variant="grad" module="forms" icon={Plus} onClick={onCreate}>New form</Button>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Banner accent="purple" icon={AlertCircle} title="A form is an entry point, not a questionnaire">
        A form decides <strong className={t.text}>what a visitor can see</strong> — which products, which audience.
        The request forms underneath decide <strong className={t.text}>what happens</strong> when they submit.
        That split is why one catalog item can offer “Report a problem” and “Request access” side by side.
      </Banner>

      {forms.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="Nothing matches those filters"
          hint="Search composes with the filters in the header rather than replacing them — clearing one may bring results back."
        />
      ) : (
        <div className={DENSITY.rowGap}>
          {forms.map(form => (
            <FormCard
              key={form.id}
              form={form}
              subforms={subforms}
              catalog={catalog}
              onEdit={() => onEdit(form)}
              onDelete={() => onDelete(form)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FormCard({ form, subforms, catalog, onEdit, onDelete }) {
  const { t, a } = useTheme();
  const c = a('purple');
  const aud = audienceMeta(form.audience);

  const reachable = useMemo(() => {
    const ids = new Set();
    for (const pid of form.productIds || []) {
      for (const sid of collectSubformIds(findNode(catalog, pid))) ids.add(sid);
    }
    return subforms.filter(sf => ids.has(sf.id));
  }, [form.productIds, catalog, subforms]);

  return (
    <Card className={cx(DENSITY.cardPad, 'space-y-3')}>
      <div className="flex items-start gap-3">
        <span className={cx('w-1 self-stretch min-h-10 rounded-full flex-shrink-0', c.rail)} />
        <IconTile icon={FileText} accent="purple" size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={cx('font-medium truncate', t.text)}>{form.name}</h4>
            <StatusPill status={form.published ? 'published' : 'draft'} />
            <Chip accent={aud.accent} icon={aud.icon}>{aud.label}</Chip>
            {form.slug && <code className={cx('text-[11px] font-mono', t.textMuted)}>/{form.slug}</code>}
          </div>
          <p className={cx('text-xs mt-0.5', t.textSecondary)}>{form.description}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="soft" accent="purple" size="sm" icon={Eye}
            onClick={() => navigate('portal', null, null, { form: form.id })}
          >
            Preview in portal
          </Button>
          <IconButton icon={Edit3} label="Edit form" onClick={onEdit} />
          <IconButton icon={Trash2} label="Delete form" accent="red" onClick={onDelete} />
        </div>
      </div>

      <div className={cx('grid gap-3 pl-4 sm:grid-cols-2')}>
        <div className="min-w-0">
          <GroupLabel>Products in scope</GroupLabel>
          <div className="mt-1.5">
            <ChipGroup
              accent="amber"
              icon={Folder}
              max={4}
              items={form.productIds || []}
              render={(id) => productName(catalog, id)}
              empty={<span className={cx('text-xs', t.textMuted)}>Nothing scoped — this form shows an empty portal.</span>}
            />
          </div>
        </div>
        <div className="min-w-0">
          <GroupLabel>Request forms reachable</GroupLabel>
          <div className="mt-1.5">
            <ChipGroup
              accent="purple"
              icon={FileQuestion}
              max={3}
              items={reachable}
              render={(sf) => sf.name}
              empty={<span className={cx('text-xs', t.textMuted)}>No catalog items under these products carry an intake yet.</span>}
            />
          </div>
        </div>
      </div>

      <div className={cx('flex items-center gap-3 pl-4 text-[11px]', t.textMuted)}>
        <span>Updated {fmtDate(form.updatedAt)}</span>
        <Divider vertical className="h-3" />
        <span className="tabular-nums">{form.submissions30d ?? 0} submissions in 30 days</span>
        <Divider vertical className="h-3" />
        <span>{form.requireSignIn ? 'Sign-in required' : 'Open to anyone with the link'}</span>
        {form.showKnowledge && <><Divider vertical className="h-3" /><span>Deflects with knowledge first</span></>}
      </div>
    </Card>
  );
}

/* ==================================================================== *
 * Form editor
 * ==================================================================== */

/**
 * Wrapper so the draft state is seeded by remount rather than by an effect.
 * `key` on the inner component is the whole mechanism — no reset-on-prop
 * gymnastics, and no chance of editing form B with form A's draft.
 */
function FormEditor({ form, products, onClose }) {
  if (!form) return null;
  return <FormEditorBody key={form.id} form={form} products={products} onClose={onClose} />;
}

function FormEditorBody({ form, products, onClose }) {
  const { t, a } = useTheme();
  // Local draft: a half-typed name should not hit the store on every keystroke.
  const [draft, setDraft] = useState(() => ({ ...form }));

  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const toggleProduct = (id) => set({
    productIds: (draft.productIds || []).includes(id)
      ? draft.productIds.filter(p => p !== id)
      : [...(draft.productIds || []), id],
  });

  const save = () => {
    const record = {
      ...draft,
      name: draft.name.trim() || 'Untitled form',
      slug: (draft.slug || '').trim(),
      updatedAt: nowISO(),
    };
    delete record.__new;
    if (form.__new) addTo('forms', record);
    else patchIn('forms', form.id, record);
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      accent="purple"
      size="modalLg"
      icon={FileText}
      title={form.__new ? 'New portal form' : draft.name || 'Form'}
      subtitle="An entry point into the portal, scoped to products and an audience"
      footer={
        <>
          <Toggle
            checked={!!draft.published}
            onChange={(v) => set({ published: v })}
            label={draft.published ? 'Published to the portal' : 'Draft — not visible in the portal'}
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="grad" module="forms" icon={Check} onClick={save}>Save form</Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Form name" required className="sm:col-span-2">
            <Input
              autoFocus
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Employee Help Centre"
            />
          </Field>
          <Field label="Portal path" hint="Where it lives under the portal.">
            <Input value={draft.slug || ''} onChange={(e) => set({ slug: e.target.value })} placeholder="help" />
          </Field>
        </div>

        <Field label="Description" hint="Shown to admins in this list, not to visitors.">
          <Textarea
            rows={2}
            value={draft.description || ''}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="What this entry point is for, and who it serves."
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Headline visitors see">
            <Input value={draft.headline || ''} onChange={(e) => set({ headline: e.target.value })} placeholder="How can we help?" />
          </Field>
          <Field label="Supporting line">
            <Input value={draft.subhead || ''} onChange={(e) => set({ subhead: e.target.value })} placeholder="Search first — most answers are already written down." />
          </Field>
        </div>

        <Field label="Audience" hint="Decides the vocabulary and whether a corporate sign-in is expected.">
          <TileGroup
            value={draft.audience}
            onChange={(v) => set({ audience: v })}
            columns={3}
            options={AUDIENCES}
          />
        </Field>

        <div>
          <div className="flex items-end justify-between gap-3 mb-1.5">
            <GroupLabel>Products in scope</GroupLabel>
            <span className={cx('text-[11px]', t.textMuted)}>
              {(draft.productIds || []).length} of {products.length} selected
            </span>
          </div>
          {products.length === 0 ? (
            <Banner accent="amber" icon={AlertTriangle}>
              No products exist in the catalog yet, so this form has nothing to show. Add products under
              <strong className={t.text}> Products &amp; Services</strong> first.
            </Banner>
          ) : (
            <div className="grid sm:grid-cols-2 gap-1.5">
              {products.map(p => {
                const on = (draft.productIds || []).includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={cx('flex items-center gap-2.5 rounded-lg border transition-colors',
                      DENSITY.rowPad,
                      on ? cx(a('amber').borderStrong, t.bgCard) : cx(t.bgCard, t.borderLight))}
                  >
                    <Folder size={ICON.base} className={cx('flex-shrink-0', on ? a('amber').fg : t.textMuted)} />
                    <Checkbox
                      accent="amber"
                      className="flex-1 min-w-0"
                      checked={on}
                      onChange={() => toggleProduct(p.id)}
                      label={p.name}
                      hint={p.description}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Card className={cx(DENSITY.cardPad)}>
            <Checkbox
              label="Require sign-in"
              hint="Off means anyone with the link can raise a request."
              checked={!!draft.requireSignIn}
              onChange={(v) => set({ requireSignIn: v })}
            />
          </Card>
          <Card className={cx(DENSITY.cardPad)}>
            <Checkbox
              label="Show knowledge before the form"
              hint="Deflection: articles for the chosen item appear above the intake."
              checked={!!draft.showKnowledge}
              onChange={(v) => set({ showKnowledge: v })}
            />
          </Card>
        </div>

        {!draft.published && (
          <Banner accent="amber" icon={AlertTriangle}>
            This form is a <strong className={t.text}>draft</strong>. It will not appear in the portal, and any request
            forms only reachable through it cannot be submitted.
          </Banner>
        )}
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * Request forms (subforms) list — grouped by where they land, because
 * the destination is the thing an admin is usually checking.
 * ==================================================================== */

function RequestForms({ subforms, total, queues, policies, unrouted, onCreate }) {
  const { t } = useTheme();

  if (!total) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="No request forms yet"
        hint="A request form is the intake behind a catalog item — its fields, its destination queue and its approval policy."
        action={<Button variant="grad" module="forms" icon={Plus} onClick={onCreate}>New request form</Button>}
      />
    );
  }

  const groups = [];
  const byQueue = new Map();
  for (const sf of subforms) {
    const key = sf.routing?.queueId || '__none';
    if (!byQueue.has(key)) byQueue.set(key, []);
    byQueue.get(key).push(sf);
  }
  for (const [key, list] of byQueue) {
    groups.push({
      key,
      label: key === '__none' ? 'Unrouted — falls to the General queue' : (queueName(queues, key) || 'Unknown queue'),
      list,
    });
  }
  groups.sort((x, y) => (x.key === '__none' ? -1 : y.key === '__none' ? 1 : x.label.localeCompare(y.label)));

  return (
    <div className="space-y-4">
      <Banner accent="blue" icon={AlertCircle} title="Several intakes per catalog item is the point">
        “Report a problem” and “Request access” are different intakes on the same item. They ask different questions,
        land in different queues and can carry different approval policies — which a single form-per-item model cannot express.
      </Banner>

      {unrouted > 0 && (
        <Banner accent="amber" icon={AlertTriangle} title={`${unrouted} request form${unrouted === 1 ? '' : 's'} have no destination`}>
          Anything they collect will be created in the <strong className={t.text}>General</strong> queue until a queue is chosen.
        </Banner>
      )}

      {subforms.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="Nothing matches those filters"
          hint="Search composes with the filters in the header rather than replacing them — clearing one may bring results back."
        />
      ) : (
        groups.map(group => (
          <Section key={group.key} title={group.label} hint={`${group.list.length} intake${group.list.length === 1 ? '' : 's'}`}>
            <div className={DENSITY.rowGap}>
              {group.list.map(sf => (
                <SubformRow key={sf.id} subform={sf} queues={queues} policies={policies} />
              ))}
            </div>
          </Section>
        ))
      )}
    </div>
  );
}

function SubformRow({ subform, queues, policies }) {
  const { t } = useTheme();
  const aud = audienceMeta(subform.audience);
  const policy = policies.find(p => p.id === subform.approvalPolicyId) || null;
  const conditional = (subform.fields || []).filter(f => f.showIf?.fieldId);
  const required = (subform.fields || []).filter(f => f.required).length;

  return (
    <ListRow
      accent="purple"
      icon={FileQuestion}
      title={subform.name}
      subtitle={subform.description}
      onClick={() => navigate('forms', 'requests', subform.id)}
      meta={
        <>
          <span className={cx('text-[11px] tabular-nums', t.textMuted)}>
            {(subform.fields || []).length} fields · {required} required
          </span>
          {subform.enabled === false && <StatusPill status="closed" />}
          {/* Chips carry VALUES: the conditional fields are named, not counted. */}
          <ChipGroup
            accent="violet"
            icon={GitBranch}
            max={1}
            items={conditional}
            render={(f) => f.label || 'Untitled field'}
          />
          {policy && <Chip accent="amber" icon={Stamp} title={policy.description || policy.name}>{policy.name}</Chip>}
          {subform.routing?.queueId
            ? <Chip accent="gray" icon={Inbox}>{queueName(queues, subform.routing.queueId) || 'Unknown queue'}</Chip>
            : <Chip accent="amber" icon={AlertTriangle}>General (default)</Chip>}
          <Chip accent={aud.accent} icon={aud.icon}>{aud.label}</Chip>
        </>
      }
      actions={<IconButton icon={ChevronRight} label="Open builder" />}
    />
  );
}

/* ==================================================================== *
 * THE SUBFORM BUILDER
 *
 * Left rail of field types, centre canvas of fields, right pane of live
 * preview. Everything writes straight to the store, so the preview on the
 * right is rendering the same record the catalog and the portal will read.
 * ==================================================================== */

function Builder({ subform, queues, policies, directory, assets }) {
  const { t } = useTheme();
  const [expanded, setExpanded] = useState(null);
  const [settings, setSettings] = useState(false);
  const [confirming, setConfirming] = useState(null);   // 'subform' | a field
  const [notice, setNotice] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const fields = subform.fields || [];
  const policy = policies.find(p => p.id === subform.approvalPolicyId) || null;
  const aud = audienceMeta(subform.audience);

  const patch = (p) => patchIn('subforms', subform.id, { ...p, updatedAt: nowISO() });
  const setFields = (next) => patch({ fields: next });

  const addField = (type) => {
    const meta = typeMeta(type);
    const f = {
      id: uid('fld'),
      type,
      label: `Untitled ${meta.label.toLowerCase()} field`,
      required: false,
      ...(hasOptions(type) ? { options: ['First option', 'Second option'] } : {}),
    };
    setFields([...fields, f]);
    setExpanded(f.id);
  };

  const patchField = (id, p) => setFields(fields.map(f => (f.id === id ? { ...f, ...p } : f)));

  const moveField = (index, delta) => {
    const next = [...fields];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    // A condition may only point backwards. Moving a field past its source
    // would create a forward reference, so the condition is dropped — and the
    // drop is announced, never silent.
    const { fields: cleaned, dropped } = dropForwardConditions(next);
    setFields(cleaned);
    setNotice(dropped.length
      ? `Reordering removed the condition on ${dropped.map(l => `“${l}”`).join(' and ')}. A field can only react to an answer above it.`
      : null);
  };

  const deleteField = (field) => {
    const dependents = fields.filter(f => f.showIf?.fieldId === field.id);
    if (dependents.length && confirming !== field) { setConfirming(field); return; }
    setFields(fields
      .filter(f => f.id !== field.id)
      .map(f => (f.showIf?.fieldId === field.id ? { ...f, showIf: undefined } : f)));
    setConfirming(null);
    if (expanded === field.id) setExpanded(null);
  };

  const visible = visibleFields(fields, answers);
  const missing = visible.filter(f => f.required && isBlank(answers[f.id]));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={FileQuestion}
        module="forms"
        accent="purple"
        title={subform.name}
        subtitle={subform.description || 'Request intake'}
        actions={
          <>
            <Button variant="outline" icon={Eye} onClick={() => navigate('portal', null, null, { subform: subform.id })}>
              Preview in portal
            </Button>
            <Button variant="soft" accent="purple" icon={Settings2} onClick={() => setSettings(true)}>Settings</Button>
            <IconButton icon={Trash2} label="Delete request form" accent="red" onClick={() => setConfirming('subform')} />
          </>
        }
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Breadcrumbs
            items={[{ id: 'root', name: 'Forms' }, { id: 'req', name: 'Request forms' }, { id: subform.id, name: subform.name }]}
            onNavigate={(item, i) => navigate('forms', i === 0 ? 'portal' : 'requests')}
          />
          <div className="flex items-center gap-2">
            <EntityTag kind="subform" />
            <Chip accent={aud.accent} icon={aud.icon}>{aud.label}</Chip>
            <span className={cx('text-[11px] tabular-nums', t.textMuted)}>
              {fields.length} fields · {fields.filter(f => f.showIf?.fieldId).length} conditional
            </span>
          </div>
        </div>
      </PageHeader>

      <PageBody width="max-w-[92rem]">
        <div className="@container">
          {/* Container queries, not viewport breakpoints: the builder condenses
              off its OWN width, so it behaves the same in a narrowed pane. */}
          <div className="grid gap-4 grid-cols-1 @3xl:grid-cols-[11.5rem_minmax(0,1fr)] @5xl:grid-cols-[11.5rem_minmax(0,1fr)_21rem] items-start">
            <FieldTypeRail onAdd={addField} />

            <div className="space-y-4 min-w-0">
              <Delivery
                subform={subform}
                queues={queues}
                policies={policies}
                policy={policy}
                directory={directory}
                onPatch={patch}
              />

              <Section
                title="Fields"
                hint="Order is the order a person answers them. A condition may only point at a field above it."
                action={<span className={cx('text-xs', t.textMuted)}>{fields.length} fields</span>}
              >
                {notice && (
                  <Banner accent="amber" icon={AlertTriangle} className="mb-3">
                    {notice}
                    <span className="block mt-1.5">
                      <Button variant="soft" accent="amber" size="xs" onClick={() => setNotice(null)}>Dismiss</Button>
                    </span>
                  </Banner>
                )}
                {fields.length === 0 ? (
                  <EmptyState
                    icon={Layers}
                    title="No fields yet"
                    hint="Pick a field type from the rail on the left. Start with the question that decides everything else — later fields can be made conditional on its answer."
                  />
                ) : (
                  <div className={DENSITY.rowGap}>
                    {fields.map((field, i) => (
                      <FieldCard
                        key={field.id}
                        field={field}
                        index={i}
                        count={fields.length}
                        earlier={fields.slice(0, i)}
                        fields={fields}
                        expanded={expanded === field.id}
                        onToggle={() => setExpanded(e => (e === field.id ? null : field.id))}
                        onPatch={(p) => patchField(field.id, p)}
                        onMove={(d) => moveField(i, d)}
                        onDelete={() => deleteField(field)}
                      />
                    ))}
                  </div>
                )}
              </Section>
            </div>

            <PreviewPane
              subform={subform}
              fields={fields}
              visible={visible}
              answers={answers}
              setAnswers={(next) => { setAnswers(next); setSubmitted(false); }}
              missing={missing}
              submitted={submitted}
              onSubmit={() => setSubmitted(true)}
              onReset={() => { setAnswers({}); setSubmitted(false); }}
              queues={queues}
              policy={policy}
              directory={directory}
              assets={assets}
            />
          </div>
        </div>
      </PageBody>

      <SubformSettings open={settings} subform={subform} onClose={() => setSettings(false)} onPatch={patch} />

      <ConfirmDelete
        open={confirming === 'subform'}
        name={subform.name}
        kind="request form"
        cascadeNote="Catalog items pointing at this intake lose it, and the questions it asked are gone. Submitted tickets are unaffected."
        onCancel={() => setConfirming(null)}
        onConfirm={() => { removeFrom('subforms', subform.id); navigate('forms', 'requests'); }}
      />

      <ConfirmDelete
        open={!!confirming && confirming !== 'subform'}
        name={confirming && confirming !== 'subform' ? confirming.label : ''}
        kind="field"
        cascadeNote="Other fields are shown or hidden based on this answer. Deleting it makes them unconditional — they will always appear."
        onCancel={() => setConfirming(null)}
        onConfirm={() => deleteField(confirming)}
      />
    </div>
  );
}

function isBlank(v) {
  return v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0);
}

/**
 * After a reorder, drop any condition that now points forwards, and report
 * which ones were dropped so the builder can say so out loud.
 */
function dropForwardConditions(fields) {
  const seen = new Set();
  const dropped = [];
  const out = fields.map(f => {
    if (f.showIf?.fieldId && !seen.has(f.showIf.fieldId)) {
      dropped.push(f.label || 'an untitled field');
      seen.add(f.id);
      return { ...f, showIf: undefined };
    }
    seen.add(f.id);
    return f;
  });
  return { fields: out, dropped };
}

/* ------------------------------------------------------------------ *
 * Left rail — field types
 * ------------------------------------------------------------------ */

function FieldTypeRail({ onAdd }) {
  const { t } = useTheme();
  return (
    <div className="sticky top-0 min-w-0">
      <Card className="p-2">
        <GroupLabel className="px-1.5 pb-1.5 block">Add a field</GroupLabel>
        <div className="space-y-0.5">
          {FIELD_TYPES.map(ft => (
            <FieldTypeButton key={ft.type} meta={ft} onClick={() => onAdd(ft.type)} />
          ))}
        </div>
      </Card>
      <p className={cx('text-[11px] mt-2 px-1 leading-relaxed', t.textMuted)}>
        Person and Asset fields resolve against the directory and the asset register, so an agent
        opens the ticket with the record already attached.
      </p>
    </div>
  );
}

function FieldTypeButton({ meta, onClick }) {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      title={`Add a ${meta.label.toLowerCase()} field`}
      className={cx('w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-left transition-colors', t.bgHover)}
    >
      <IconTile icon={meta.icon} accent={meta.accent} size="sm" />
      <span className="min-w-0 flex-1">
        <span className={cx('text-xs font-medium block truncate', t.text)}>{meta.label}</span>
        <span className={cx('text-[10px] block truncate', t.textMuted)}>{meta.hint}</span>
      </span>
      <Plus size={ICON.sm} className={t.textMuted} />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Delivery — routing and approval. The two decisions that make a form
 * do something rather than just collect text.
 * ------------------------------------------------------------------ */

function Delivery({ subform, queues, policies, policy, directory, onPatch }) {
  const { t } = useTheme();
  const routedTo = subform.routing?.queueId ? queueName(queues, subform.routing.queueId) : null;
  const generalName = queueName(queues, Q.GENERAL) || 'General';

  return (
    <Panel icon={Inbox} accent="rose" title="Delivery" subtitle="Where a submission lands, and who has to say yes">
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Destination queue" hint="The team that will pick the ticket up.">
            <Select
              accent="rose"
              value={subform.routing?.queueId || ''}
              placeholder={`— None (falls to ${generalName}) —`}
              options={queues.map(q => ({ value: q.id, label: q.name }))}
              onChange={(e) => onPatch({ routing: e.target.value ? { ...subform.routing, queueId: e.target.value } : {} })}
            />
          </Field>
          <Field label="Approval policy" hint="Runs on submission, before anyone works the ticket.">
            <Select
              accent="amber"
              value={subform.approvalPolicyId || ''}
              placeholder="— No approval —"
              options={policies.map(p => ({ value: p.id, label: p.name }))}
              onChange={(e) => onPatch({ approvalPolicyId: e.target.value || undefined })}
            />
          </Field>
        </div>

        {routedTo ? (
          <Banner accent="blue" icon={Inbox}>
            Submissions open a ticket in <strong className={t.text}>{routedTo}</strong>.
          </Banner>
        ) : (
          <Banner accent="amber" icon={AlertTriangle} title="No destination queue is set">
            Tickets from this form will land in the <strong className={t.text}>{generalName}</strong> queue, where nobody
            owns them by default. Choose a queue above, or accept the fallback knowingly.
          </Banner>
        )}

        {policy ? (
          <PolicyExplainer policy={policy} directory={directory} queues={queues} />
        ) : (
          <p className={cx('text-xs', t.textMuted)}>
            No approval policy. Submissions are created and worked immediately.
            {policies.length === 0 && ' No policies have been configured under Business Rules yet.'}
          </p>
        )}
      </div>
    </Panel>
  );
}

/**
 * Say, in English, what the attached policy will do. `summarize()` renders the
 * condition tree; the stages are read straight off the policy so the sentence
 * cannot drift from what the engine will actually run.
 */
function PolicyExplainer({ policy, directory, queues }) {
  const { t } = useTheme();
  const when = summarize(policy.appliesWhen);
  const stages = policy.stages || [];

  return (
    <Banner accent="amber" icon={Stamp} title={policy.name}>
      <p>
        Runs when <strong className={t.text}>{when.toLowerCase() === 'always' ? 'every request is submitted' : when}</strong>.
        {when.toLowerCase() !== 'always' && ' Otherwise the request is created straight away.'}
      </p>
      {policy.description && <p className="mt-1">{policy.description}</p>}
      {stages.length > 0 && (
        <ol className="mt-1.5 space-y-1">
          {stages.map((stage, i) => (
            <li key={stage.id || i} className="flex items-start gap-2">
              <span className={cx('text-[10px] font-semibold tabular-nums mt-0.5', t.textMuted)}>{i + 1}.</span>
              <span className="min-w-0">
                <span className={cx('font-medium', t.text)}>{stage.name || `Stage ${i + 1}`}</span>
                {' — '}
                {(stage.approvers || []).map(sp => describeApprover(sp, { directory, queues })).join(', ') || 'nobody resolved'}
                {stage.rule === 'all' ? ' (everyone must approve)'
                  : stage.rule === 'any' ? ' (any one approves)'
                  : stage.rule === 'quorum' ? ` (${stage.quorum} must approve)` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Banner>
  );
}

/* ------------------------------------------------------------------ *
 * Field card
 * ------------------------------------------------------------------ */

function FieldCard({ field, index, count, earlier, fields, expanded, onToggle, onPatch, onMove, onDelete }) {
  const { t, a } = useTheme();
  const meta = typeMeta(field.type);
  const c = a(meta.accent);
  const condition = describeCondition(field.showIf, fields);

  return (
    <Card className={cx('overflow-hidden', expanded && c.borderStrong)}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className={cx('w-1 self-stretch min-h-8 rounded-full flex-shrink-0', c.rail)} />
        <span className={cx('text-[10px] font-semibold tabular-nums w-4 text-right flex-shrink-0', t.textMuted)}>{index + 1}</span>
        <IconTile icon={meta.icon} accent={meta.accent} size="sm" />
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <span className="flex items-center gap-2 min-w-0">
            <span className={cx('text-sm font-medium truncate', t.text)}>{field.label || 'Untitled field'}</span>
            {field.required && <span className={cx('text-xs', a('red').fg)} title="Required">*</span>}
          </span>
          <span className={cx('text-[11px] block truncate', t.textMuted)}>
            {meta.label}
            {hasOptions(field.type) && ` · ${(field.options || []).length} options`}
            {field.help ? ` · ${field.help}` : ''}
          </span>
        </button>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <IconButton icon={ArrowUp} label="Move up" size={ICON.sm} onClick={() => onMove(-1)}
            disabled={index === 0} className={index === 0 ? 'opacity-25 pointer-events-none' : undefined} />
          <IconButton icon={ArrowDown} label="Move down" size={ICON.sm} onClick={() => onMove(1)}
            disabled={index === count - 1} className={index === count - 1 ? 'opacity-25 pointer-events-none' : undefined} />
          <IconButton icon={expanded ? ChevronDown : Edit3} label={expanded ? 'Collapse' : 'Configure'} onClick={onToggle} />
          <IconButton icon={Trash2} label="Delete field" accent="red" onClick={onDelete} />
        </div>
      </div>

      {condition && (
        <div className={cx('flex items-center gap-2 px-3 py-1.5 border-t', t.borderLight, a('violet').soft)}>
          <GitBranch size={ICON.sm} className={a('violet').fg} />
          <span className={cx('text-[11px]', a('violet').fgOnSoft)}>{condition}</span>
        </div>
      )}

      {expanded && (
        <div className={cx('border-t', t.borderLight, DENSITY.cardPad, 'space-y-3')}>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Label" required>
              <Input
                accent={meta.accent}
                value={field.label}
                onChange={(e) => onPatch({ label: e.target.value })}
                placeholder="The question as a person reads it"
              />
            </Field>
            <Field label="Field type">
              <Select
                accent={meta.accent}
                value={field.type}
                options={FIELD_TYPES.map(ft => ({ value: ft.type, label: ft.label }))}
                onChange={(e) => {
                  const next = e.target.value;
                  onPatch({
                    type: next,
                    options: hasOptions(next) ? (field.options || ['First option', 'Second option']) : undefined,
                  });
                }}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Placeholder" hint="Ghost text inside the control.">
              <Input
                accent={meta.accent}
                value={field.placeholder || ''}
                onChange={(e) => onPatch({ placeholder: e.target.value })}
                placeholder="e.g. NW-2026-118402"
              />
            </Field>
            <Field label="Help text" hint="Sits under the control. Use it to prevent the follow-up question.">
              <Input
                accent={meta.accent}
                value={field.help || ''}
                onChange={(e) => onPatch({ help: e.target.value })}
                placeholder="Why we are asking, or what good looks like"
              />
            </Field>
          </div>

          <Checkbox
            accent={meta.accent}
            label="Required"
            hint="Blocks submission while the field is visible and empty."
            checked={!!field.required}
            onChange={(v) => onPatch({ required: v })}
          />

          {hasOptions(field.type) && (
            <OptionsEditor
              accent={meta.accent}
              options={field.options || []}
              onChange={(options) => onPatch({ options })}
            />
          )}

          <ConditionEditor field={field} earlier={earlier} fields={fields} onPatch={onPatch} />
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Options editor
 * ------------------------------------------------------------------ */

function OptionsEditor({ options, onChange, accent }) {
  const { t } = useTheme();
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v || options.includes(v)) return;
    onChange([...options, v]);
    setDraft('');
  };

  return (
    <div>
      <GroupLabel className="block mb-1.5">Options</GroupLabel>
      <div className="space-y-1.5">
        {/* Keyed by position, not by text: keying on the value would remount the
            input on every keystroke and steal focus — the v1 remount bug. */}
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              accent={accent}
              value={o}
              onChange={(e) => onChange(options.map((x, xi) => (xi === i ? e.target.value : x)))}
            />
            <IconButton
              icon={ArrowUp} label="Move option up" size={ICON.sm}
              disabled={i === 0} className={i === 0 ? 'opacity-25 pointer-events-none' : undefined}
              onClick={() => {
                const next = [...options];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            />
            <IconButton icon={Trash2} label="Remove option" accent="red" size={ICON.sm}
              onClick={() => onChange(options.filter((_, xi) => xi !== i))} />
          </div>
        ))}
        {options.length === 0 && (
          <p className={cx('text-xs', t.textMuted)}>No options yet — a select with no options renders as an empty menu.</p>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            accent={accent}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
            placeholder="Add an option and press Enter"
          />
          <Button variant="soft" accent={accent} size="sm" icon={Plus} onClick={add}>Add</Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Conditional display editor
 * ------------------------------------------------------------------ */

function ConditionEditor({ field, earlier, fields, onPatch }) {
  const { t, a } = useTheme();
  const c = a('violet');
  const showIf = field.showIf || null;
  const source = showIf ? earlier.find(f => f.id === showIf.fieldId) : null;
  const sourceType = source ? source.type : 'text';
  const nullary = showIf ? NULLARY.has(showIf.op) : false;

  if (!earlier.length) {
    return (
      <div className={cx('rounded-lg border p-3', t.borderLight)}>
        <div className="flex items-center gap-2">
          <GitBranch size={ICON.base} className={t.textMuted} />
          <p className={cx('text-xs', t.textMuted)}>
            Conditional display needs an earlier answer to react to. Move this field down, or add a question above it.
          </p>
        </div>
      </div>
    );
  }

  const enable = () => {
    const src = earlier[0];
    onPatch({
      showIf: {
        fieldId: src.id,
        op: defaultOpFor(src.type),
        value: hasOptions(src.type) ? (src.options?.[0] ?? '') : src.type === 'checkbox' ? true : '',
      },
    });
  };

  return (
    <div className={cx('rounded-lg border p-3 space-y-2.5', showIf ? c.borderStrong : t.borderLight)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <GitBranch size={ICON.base} className={showIf ? c.fg : t.textMuted} />
          <span className={cx('text-xs font-medium', t.text)}>Conditional display</span>
        </div>
        <Toggle
          accent="violet"
          checked={!!showIf}
          onChange={(v) => (v ? enable() : onPatch({ showIf: undefined }))}
          label={showIf ? 'Only when a condition matches' : 'Always shown'}
        />
      </div>

      {showIf && (
        <>
          <div className="grid sm:grid-cols-3 gap-2">
            <Select
              accent="violet"
              value={showIf.fieldId}
              options={earlier.map(f => ({ value: f.id, label: f.label || 'Untitled field' }))}
              onChange={(e) => {
                const src = earlier.find(f => f.id === e.target.value);
                onPatch({
                  showIf: {
                    fieldId: e.target.value,
                    op: defaultOpFor(src?.type || 'text'),
                    value: hasOptions(src?.type) ? (src.options?.[0] ?? '') : src?.type === 'checkbox' ? true : '',
                  },
                });
              }}
            />
            <Select
              accent="violet"
              value={showIf.op}
              options={condOpsFor(sourceType)}
              onChange={(e) => onPatch({ showIf: { ...showIf, op: e.target.value } })}
            />
            {nullary ? (
              <span className={cx('text-xs self-center', t.textMuted)}>No value needed</span>
            ) : hasOptions(sourceType) ? (
              <Select
                accent="violet"
                value={String(showIf.value ?? '')}
                placeholder="Choose a value"
                options={source?.options || []}
                onChange={(e) => onPatch({ showIf: { ...showIf, value: e.target.value } })}
              />
            ) : (
              <Input
                accent="violet"
                type={sourceType === 'number' || sourceType === 'currency' ? 'number' : sourceType === 'date' ? 'date' : 'text'}
                value={showIf.value ?? ''}
                onChange={(e) => onPatch({
                  showIf: {
                    ...showIf,
                    value: (sourceType === 'number' || sourceType === 'currency')
                      ? Number(e.target.value)
                      : e.target.value,
                  },
                })}
                placeholder="Value to match"
              />
            )}
          </div>
          <p className={cx('text-[11px]', c.fg)}>{describeCondition(showIf, fields)}</p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Subform settings modal
 * ------------------------------------------------------------------ */

function SubformSettings({ open, subform, onClose, onPatch }) {
  const { t } = useTheme();
  if (!open) return null;
  return (
    <Modal
      open
      onClose={onClose}
      accent="purple"
      size="modalMd"
      icon={Settings2}
      title="Request form settings"
      subtitle={subform.name}
      footer={
        <>
          <Toggle
            checked={subform.enabled !== false}
            onChange={(v) => onPatch({ enabled: v })}
            label={subform.enabled !== false ? 'Accepting submissions' : 'Closed — hidden in the portal'}
          />
          <Button variant="solid" accent="purple" icon={Check} onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required hint="Shown on the catalog item next to any other intake it offers.">
          <Input value={subform.name} onChange={(e) => onPatch({ name: e.target.value })} placeholder="e.g. Report a problem" />
        </Field>
        <Field label="Description">
          <Textarea
            rows={2}
            value={subform.description || ''}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="One line telling a person whether this is the right intake."
          />
        </Field>
        <Field label="Audience" hint="External intakes ask for an organisation; internal ones resolve the requester from the directory.">
          <TileGroup value={subform.audience} onChange={(v) => onPatch({ audience: v })} columns={3} options={AUDIENCES} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Submit button label">
            <Input value={subform.submitLabel || ''} onChange={(e) => onPatch({ submitLabel: e.target.value })} placeholder="Submit request" />
          </Field>
          <Field label="Submissions in the last 30 days">
            <p className={cx('text-2xl font-semibold tabular-nums', t.text)}>{subform.submissions30d ?? 0}</p>
          </Field>
        </div>
        <Field label="Confirmation message" hint="What the person reads immediately after submitting.">
          <Textarea
            rows={2}
            value={subform.confirmation || ''}
            onChange={(e) => onPatch({ confirmation: e.target.value })}
            placeholder="Tell them what happens next and roughly when."
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * Live preview
 *
 * Renders the record as an end user meets it, conditional behaviour and all.
 * It is the same `visibleFields` pass the portal will run, so what an admin
 * sees here is what a customer gets.
 * ------------------------------------------------------------------ */

function PreviewPane({
  subform, fields, visible, answers, setAnswers, missing, submitted,
  onSubmit, onReset, queues, policy, directory, assets,
}) {
  const { t } = useTheme();
  const hidden = fields.length - visible.length;
  const routedTo = subform.routing?.queueId ? queueName(queues, subform.routing.queueId) : null;
  const generalName = queueName(queues, Q.GENERAL) || 'General';

  return (
    <div className="sticky top-0 min-w-0 space-y-2 max-h-[calc(100vh-9rem)] overflow-auto">
      <div className="flex items-center justify-between gap-2">
        <GroupLabel>Live preview</GroupLabel>
        <Button variant="ghost" size="xs" onClick={onReset}>Reset answers</Button>
      </div>

      <div className={cx('rounded-2xl p-3', t.portalBg)}>
        <Card className={cx(DENSITY.cardPad, 'space-y-3')}>
          <div className="flex items-start gap-2.5">
            <IconTile icon={FileQuestion} accent="purple" size="sm" />
            <div className="min-w-0">
              <p className={cx('text-sm font-semibold leading-tight', t.text)}>{subform.name}</p>
              {subform.description && <p className={cx('text-[11px] mt-0.5', t.textSecondary)}>{subform.description}</p>}
            </div>
          </div>

          <Divider />

          {visible.length === 0 ? (
            <p className={cx('text-xs py-4 text-center', t.textMuted)}>Nothing to fill in yet.</p>
          ) : (
            <div className="space-y-3">
              {visible.map(f => (
                <PreviewField
                  key={f.id}
                  field={f}
                  value={answers[f.id]}
                  onChange={(v) => setAnswers({ ...answers, [f.id]: v })}
                  directory={directory}
                  assets={assets}
                />
              ))}
            </div>
          )}

          {hidden > 0 && (
            <p className={cx('text-[11px] flex items-center gap-1.5', t.textMuted)}>
              <GitBranch size={ICON.sm} />
              {hidden} conditional field{hidden === 1 ? '' : 's'} hidden by the answers above
            </p>
          )}

          {submitted ? (
            <Banner accent="emerald" icon={Check} title="Submitted">
              {subform.confirmation || 'Your request has been received.'}
              <span className="block mt-1">
                Created in <strong className={t.text}>{routedTo || generalName}</strong>
                {policy ? <> and sent to <strong className={t.text}>{policy.name}</strong> for approval.</> : '.'}
              </span>
            </Banner>
          ) : (
            <>
              <Button
                variant="solid"
                accent="purple"
                icon={Send}
                className="w-full"
                disabled={missing.length > 0}
                onClick={onSubmit}
              >
                {subform.submitLabel || 'Submit request'}
              </Button>
              {missing.length > 0 && (
                <p className={cx('text-[11px]', t.textMuted)}>
                  Waiting on <strong className={t.text}>{missing[0].label}</strong>
                  {missing.length > 1 && ` and ${missing.length - 1} more required field${missing.length - 1 === 1 ? '' : 's'}`}.
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      <div className={cx('flex items-start gap-2 px-1 text-[11px]', t.textMuted)}>
        <Inbox size={ICON.sm} className="flex-shrink-0 mt-0.5" />
        <span>
          Goes to <strong className={t.text}>{routedTo || `${generalName} (fallback)`}</strong>
          {policy ? ` · ${policy.name}` : ' · no approval'}
        </span>
      </div>
    </div>
  );
}

function PreviewField({ field, value, onChange, directory, assets }) {
  const { t } = useTheme();
  const meta = typeMeta(field.type);

  if (field.type === 'checkbox') {
    return (
      <Checkbox
        accent={meta.accent}
        label={field.label}
        hint={field.help}
        checked={!!value}
        onChange={onChange}
      />
    );
  }

  return (
    <Field label={field.label} required={field.required} hint={field.help}>
      {field.type === 'textarea' && (
        <Textarea accent={meta.accent} rows={3} value={value || ''} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === 'select' && (
        <Select accent={meta.accent} value={value || ''} placeholder="Choose…" options={field.options || []}
          onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === 'multiselect' && (
        <div className="flex flex-wrap gap-1.5">
          {(field.options || []).map(o => {
            const on = Array.isArray(value) && value.includes(o);
            return (
              <button
                key={o}
                onClick={() => onChange(on ? value.filter(v => v !== o) : [...(value || []), o])}
              >
                <Chip accent={on ? meta.accent : 'gray'} icon={on ? Check : undefined}>{o}</Chip>
              </button>
            );
          })}
          {!(field.options || []).length && <span className={cx('text-xs', t.textMuted)}>No options configured.</span>}
        </div>
      )}

      {field.type === 'user' && (
        <Select
          accent={meta.accent}
          value={value || ''}
          placeholder="Search the directory…"
          options={(directory || []).map(p => ({ value: p.id, label: `${p.name} — ${p.title || p.department || ''}`.trim() }))}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === 'asset' && (
        (assets || []).length
          ? <Select
              accent={meta.accent}
              value={value || ''}
              placeholder="Pick an asset…"
              options={assets.map(x => ({ value: x.id, label: x.name || x.tag || x.id }))}
              onChange={(e) => onChange(e.target.value)}
            />
          : <p className={cx('text-xs', t.textMuted)}>The asset register is empty in this demo instance.</p>
      )}

      {field.type === 'file' && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={Paperclip} onClick={() => onChange(value ? '' : 'screenshot-2026-08-16.png')}>
            {value ? 'Remove' : 'Choose a file'}
          </Button>
          {value && <span className={cx('text-xs truncate', t.textSecondary)}>{value}</span>}
        </div>
      )}

      {(field.type === 'text' || field.type === 'email' || field.type === 'phone'
        || field.type === 'date' || field.type === 'number' || field.type === 'currency') && (
        <Input
          accent={meta.accent}
          type={field.type === 'email' ? 'email'
            : field.type === 'phone' ? 'tel'
            : field.type === 'date' ? 'date'
            : (field.type === 'number' || field.type === 'currency') ? 'number'
            : 'text'}
          value={value ?? ''}
          placeholder={field.placeholder || (field.type === 'currency' ? '0.00' : undefined)}
          onChange={(e) => onChange(
            (field.type === 'number' || field.type === 'currency')
              ? (e.target.value === '' ? '' : Number(e.target.value))
              : e.target.value,
          )}
        />
      )}
    </Field>
  );
}
