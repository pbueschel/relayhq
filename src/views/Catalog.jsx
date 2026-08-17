import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Package, Folder, Layers, Circle, ChevronRight, Plus, Pencil, Copy, Trash2,
  BookOpen, LayoutGrid, FileQuestion, Inbox, AlertCircle, Monitor, Key, Link2,
  GraduationCap, Building2, Globe, Users, Check, X, Star, Clock, Search,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, ENTITIES,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, EntityTag, Avatar,
  EmptyState, Card, Panel, GroupLabel, Stat, Banner, Divider,
  Field, Input, Select, SearchInput, TileGroup,
  Modal, ConfirmDelete,
  SubTabs, PageHeader, Toolbar, PageBody, Breadcrumbs,
} from '@/ds';
import { useStore, setCollection, uid } from '@/store/store.js';
import { useRoute, navigate } from '@/lib/router.js';
import { Q } from '@/store/seed/ids.js';

/**
 * Products & Services — the catalog.
 *
 * Three levels, always: Product › Subcategory › Item. Items are leaves and the
 * only nodes that carry content, and even then they carry it BY REFERENCE:
 * `knowledgeIds` and `subformIds` point at top-level collections. That is the
 * change from v1 (see src/store/schema.js) and it is what the item detail pane
 * is built to show — an atom attached here can also be a lesson in a course,
 * and the "Used in N courses" chip makes that visible where the author works.
 *
 * Two rename states, deliberately: `editingNode` (tree row) and
 * `editingNodeInPane` (detail header). v1 shared one and the two inputs fought
 * over the value whenever both were mounted.
 */

/* ==================================================================== *
 * Node vocabulary
 * ==================================================================== */

const NODE_ICON = { product: Folder, subcategory: Layers, item: Circle };
const NODE_KIND = { product: 'product', subcategory: 'subcategory', item: 'item' };
const CHILD_TYPE = { product: 'subcategory', subcategory: 'item' };

const AUDIENCE = {
  internal: { value: 'internal', label: 'Internal',  hue: 'slate',  icon: Building2, hint: 'Employees' },
  external: { value: 'external', label: 'Customers', hue: 'green',  icon: Globe,     hint: 'Help centre' },
  both:     { value: 'both',     label: 'Both',      hue: 'violet', icon: Users,     hint: 'Staff + customers' },
};

const AUDIENCE_TILES = [AUDIENCE.internal, AUDIENCE.external, AUDIENCE.both].map(a => ({
  value: a.value, label: a.label, icon: a.icon, hint: a.hint, accent: a.hue,
}));

const AUDIENCE_FILTERS = [
  { value: 'all',      label: 'All',       icon: Package,   accent: 'amber' },
  { value: 'internal', label: 'Internal',  icon: Building2, accent: 'slate' },
  { value: 'external', label: 'Customers', icon: Globe,     accent: 'green' },
];

function audienceMeta(value) {
  return AUDIENCE[value] || AUDIENCE.internal;
}

/* ==================================================================== *
 * Tree helpers — pure, module scope, no store access.
 * ==================================================================== */

function findNode(nodes, id) {
  for (const n of nodes || []) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
  return null;
}

/** The chain of nodes from a root down to `id`, inclusive. */
function findTrail(nodes, id, trail = []) {
  for (const n of nodes || []) {
    const next = [...trail, n];
    if (n.id === id) return next;
    const hit = findTrail(n.children, id, next);
    if (hit) return hit;
  }
  return null;
}

function updateNode(nodes, id, patch) {
  return (nodes || []).map(n => {
    if (n.id === id) return { ...n, ...(typeof patch === 'function' ? patch(n) : patch) };
    if (n.children) return { ...n, children: updateNode(n.children, id, patch) };
    return n;
  });
}

function removeNode(nodes, id) {
  return (nodes || [])
    .filter(n => n.id !== id)
    .map(n => (n.children ? { ...n, children: removeNode(n.children, id) } : n));
}

function addChildTo(nodes, parentId, child) {
  return (nodes || []).map(n => {
    if (n.id === parentId) return { ...n, children: [...(n.children || []), child] };
    if (n.children) return { ...n, children: addChildTo(n.children, parentId, child) };
    return n;
  });
}

/** Flatten to `{ node, depth, parent }` in display order. */
function flatten(nodes, depth = 0, parent = null, out = []) {
  for (const n of nodes || []) {
    out.push({ node: n, depth, parent });
    if (n.children) flatten(n.children, depth + 1, n, out);
  }
  return out;
}

function countTree(node) {
  let subcategories = 0, items = 0;
  for (const ch of node?.children || []) {
    if (ch.type === 'subcategory') subcategories += 1;
    if (ch.type === 'item') items += 1;
    const inner = countTree(ch);
    subcategories += inner.subcategories;
    items += inner.items;
  }
  return { subcategories, items };
}

/** Every knowledge / subform id referenced anywhere under a node. */
function collectRefs(node, acc = { knowledge: new Set(), subforms: new Set(), gaps: 0, items: 0 }) {
  if (node.type === 'item') {
    acc.items += 1;
    if (!(node.knowledgeIds || []).length) acc.gaps += 1;
    for (const id of node.knowledgeIds || []) acc.knowledge.add(id);
    for (const id of node.subformIds || []) acc.subforms.add(id);
  }
  for (const ch of node.children || []) collectRefs(ch, acc);
  return acc;
}

const ID_PREFIX = { product: 'cat-p', subcategory: 'cat-s', item: 'cat-i' };

/**
 * Deep copy with fresh ids. The copy REFERENCES the same knowledge atoms and
 * request forms — arrays of ids are cloned, the atoms themselves are not. This
 * is the whole point: "Password Reset" repeats across products without anyone
 * re-authoring the article.
 */
function copyNode(node, suffix = ' (Copy)') {
  const clone = { ...node, id: uid(ID_PREFIX[node.type] || 'cat'), name: node.name + suffix };
  if (node.knowledgeIds) clone.knowledgeIds = [...node.knowledgeIds];
  if (node.subformIds) clone.subformIds = [...node.subformIds];
  if (node.children) clone.children = node.children.map(ch => copyNode(ch, ''));
  return clone;
}

function matchesAudience(node, filter) {
  if (filter === 'all') return true;
  const value = node.audience || 'internal';
  return value === 'both' || value === filter;
}

/**
 * Keep a node when it matches, or when any descendant does — and keep the whole
 * subtree of a node that matches the TEXT, because searching “Storefront” should
 * reveal what is under Storefront. Audience is never relaxed that way: a node
 * hidden from customers stays hidden even when its parent matched.
 */
function filterTree(nodes, query, audience) {
  const q = query.trim().toLowerCase();
  const out = [];
  for (const n of nodes || []) {
    const audienceHit = matchesAudience(n, audience);
    const textHit = !q || `${n.name} ${n.description || ''}`.toLowerCase().includes(q);
    const selfHit = textHit && audienceHit;
    const children = filterTree(n.children, selfHit ? '' : query, audience);
    if (selfHit || children.length) out.push(n.children ? { ...n, children } : n);
  }
  return out;
}

/** Course titles whose modules use this knowledge atom as a lesson. */
function coursesUsing(courses, knowledgeId) {
  const hits = [];
  for (const c of courses || []) {
    const used = (c.modules || []).some(m => (m.lessonIds || []).includes(knowledgeId));
    if (used) hits.push(c.title || c.name || c.id);
  }
  return hits;
}

function labelOf(record, fallback) {
  return record?.title || record?.name || record?.label || fallback;
}

/* ==================================================================== *
 * View
 * ==================================================================== */

export default function Catalog({ route }) {
  const liveRoute = useRoute();
  const r = route || liveRoute;

  const catalog = useStore(s => s.catalog);
  const knowledge = useStore(s => s.knowledge);
  const subforms = useStore(s => s.subforms);
  const courses = useStore(s => s.courses);
  const assets = useStore(s => s.assets);
  const queues = useStore(s => s.queues);
  const directory = useStore(s => s.directory);

  const [query, setQuery] = useState('');
  const [audience, setAudience] = useState('all');
  const [expanded, setExpanded] = useState(() => new Set((catalog || []).map(p => p.id)));

  // TWO rename states, never one. Tree row and detail header edit the same
  // record but must not share a buffer — that was the v1 fight.
  const [editingNode, setEditingNode] = useState(null);        // { id, value } — tree
  const [editingNodeInPane, setEditingNodeInPane] = useState(null); // { id, value } — detail

  const [confirming, setConfirming] = useState(null);          // node pending delete
  const [importing, setImporting] = useState(null);            // { sourceId, targetId }
  const [attaching, setAttaching] = useState(null);            // { kind, itemId }

  const selected = useMemo(() => {
    const hit = findNode(catalog, r.id);
    if (hit) return hit;
    const firstItem = flatten(catalog).find(x => x.node.type === 'item');
    return firstItem?.node || (catalog || [])[0] || null;
  }, [catalog, r.id]);

  const trail = useMemo(() => (selected ? findTrail(catalog, selected.id) || [] : []), [catalog, selected]);

  // Keep the selected node's ancestors open, so a deep link or a jump from
  // another module lands with the branch already unfolded.
  useEffect(() => {
    if (!trail.length) return;
    setExpanded(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const n of trail.slice(0, -1)) if (!next.has(n.id)) { next.add(n.id); changed = true; }
      return changed ? next : prev;
    });
  }, [trail]);

  const select = useCallback((id) => navigate('catalog', 'node', id), []);

  const toggle = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const rename = useCallback((id, value) => {
    const name = value.trim();
    if (!name) return;
    setCollection('catalog', list => updateNode(list, id, { name }));
  }, []);

  const patchNode = useCallback((id, patch) => {
    setCollection('catalog', list => updateNode(list, id, patch));
  }, []);

  const addChild = useCallback((parent) => {
    const type = CHILD_TYPE[parent.type];
    if (!type) return;
    const child = {
      id: uid(ID_PREFIX[type]),
      name: type === 'subcategory' ? 'New subcategory' : 'New item',
      type,
      audience: parent.audience || 'internal',
      description: '',
      ...(type === 'subcategory' ? { children: [] } : { knowledgeIds: [], subformIds: [] }),
    };
    setCollection('catalog', list => addChildTo(list, parent.id, child));
    setExpanded(prev => new Set(prev).add(parent.id));
    select(child.id);
    setEditingNode({ id: child.id, value: child.name });
  }, [select]);

  const addProduct = useCallback(() => {
    const product = {
      id: uid(ID_PREFIX.product),
      name: 'New product',
      type: 'product',
      audience: 'internal',
      description: '',
      children: [],
    };
    setCollection('catalog', list => [...(list || []), product]);
    setExpanded(prev => new Set(prev).add(product.id));
    select(product.id);
    setEditingNode({ id: product.id, value: product.name });
  }, [select]);

  const removeSelected = useCallback((node) => {
    const parent = (findTrail(catalog, node.id) || []).slice(-2, -1)[0];
    setCollection('catalog', list => removeNode(list, node.id));
    setConfirming(null);
    if (selected && (selected.id === node.id || (findTrail([node], selected.id) || []).length)) {
      select(parent ? parent.id : '');
    }
  }, [catalog, selected, select]);

  const runCopy = useCallback((sourceId, targetId) => {
    const source = findNode(catalog, sourceId);
    if (!source || !targetId) return;
    const clone = copyNode(source);
    setCollection('catalog', list => addChildTo(list, targetId, clone));
    setExpanded(prev => new Set(prev).add(targetId));
    setImporting(null);
    select(clone.id);
  }, [catalog, select]);

  const visible = useMemo(() => filterTree(catalog, query, audience), [catalog, query, audience]);
  const searching = query.trim().length > 0;

  const totals = useMemo(() => {
    const acc = { knowledge: new Set(), subforms: new Set(), gaps: 0, items: 0 };
    for (const p of catalog || []) collectRefs(p, acc);
    return acc;
  }, [catalog]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={Package}
        accent="amber"
        title="Products & Services"
        subtitle={`${(catalog || []).length} products · ${totals.items} items · one catalog serving employees and customers`}
        actions={<Button variant="solid" accent="amber" icon={Plus} onClick={addProduct}>New product</Button>}
      >
        <Toolbar>
          <SubTabs items={AUDIENCE_FILTERS} value={audience} onChange={setAudience} />
          <Divider vertical className="h-7" />
          <Stat label="items" value={totals.items} accent="emerald" icon={Circle} />
          <Stat label="knowledge atoms linked" value={totals.knowledge.size} accent="blue" icon={BookOpen} />
          <Stat label="request forms linked" value={totals.subforms.size} accent="purple" icon={FileQuestion} />
          <Stat label="items with no knowledge" value={totals.gaps} accent={totals.gaps ? 'amber' : 'gray'} icon={AlertCircle} />
        </Toolbar>
      </PageHeader>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <TreePane
          nodes={visible}
          expanded={expanded}
          forceOpen={searching}
          selectedId={selected?.id}
          query={query}
          onQuery={setQuery}
          onToggle={toggle}
          onSelect={select}
          onAddChild={addChild}
          onCopy={(node) => setImporting({ sourceId: node.id, targetId: '' })}
          onImportInto={(node) => setImporting({ sourceId: '', targetId: node.id })}
          onDelete={setConfirming}
          editing={editingNode}
          setEditing={setEditingNode}
          onRename={rename}
        />

        <PageBody className="@container">
          {selected ? (
            <NodeDetail
              node={selected}
              trail={trail}
              catalog={catalog}
              knowledge={knowledge}
              subforms={subforms}
              courses={courses}
              assets={assets}
              queues={queues}
              directory={directory}
              editingInPane={editingNodeInPane}
              setEditingInPane={setEditingNodeInPane}
              onRename={rename}
              onPatch={patchNode}
              onSelect={select}
              onAddChild={addChild}
              onCopy={(node) => setImporting({ sourceId: node.id, targetId: '' })}
              onImportInto={(node) => setImporting({ sourceId: '', targetId: node.id })}
              onDelete={setConfirming}
              onAttach={(kind, itemId) => setAttaching({ kind, itemId })}
            />
          ) : (
            <EmptyState
              icon={Package}
              title="The catalog is empty"
              hint="A product is the top level of the tree — Accounts & Access, Devices, or the product your customers actually buy."
              action={<Button variant="solid" accent="amber" icon={Plus} onClick={addProduct}>New product</Button>}
            />
          )}
        </PageBody>
      </div>

      <ConfirmDelete
        open={!!confirming}
        name={confirming?.name || ''}
        kind={confirming ? NODE_KIND[confirming.type] : 'node'}
        cascadeNote={confirming ? cascadeNote(confirming) : ''}
        onCancel={() => setConfirming(null)}
        onConfirm={() => confirming && removeSelected(confirming)}
      />

      {importing && (
        <ImportModal
          catalog={catalog}
          initial={importing}
          onClose={() => setImporting(null)}
          onConfirm={runCopy}
        />
      )}

      {attaching && (
        <AttachModal
          kind={attaching.kind}
          item={findNode(catalog, attaching.itemId)}
          knowledge={knowledge}
          subforms={subforms}
          queues={queues}
          courses={courses}
          onClose={() => setAttaching(null)}
          onPatch={patchNode}
        />
      )}
    </div>
  );
}

function cascadeNote(node) {
  const { subcategories, items } = countTree(node);
  if (node.type === 'item') {
    return 'The knowledge atoms and request forms attached to this item are shared and stay where they are — only the link is removed.';
  }
  const parts = [];
  if (subcategories) parts.push(`${subcategories} subcategor${subcategories === 1 ? 'y' : 'ies'}`);
  if (items) parts.push(`${items} item${items === 1 ? '' : 's'}`);
  const cascade = parts.length ? `This also deletes ${parts.join(' and ')} beneath it. ` : '';
  return `${cascade}Knowledge atoms and request forms are shared across the catalog and are NOT deleted.`;
}

/* ==================================================================== *
 * Left pane — the tree
 * ==================================================================== */

function TreePane({
  nodes, expanded, forceOpen, selectedId, query, onQuery, onToggle, onSelect,
  onAddChild, onCopy, onImportInto, onDelete, editing, setEditing, onRename,
}) {
  const { t } = useTheme();
  return (
    <aside className={cx('w-80 flex-shrink-0 flex flex-col overflow-hidden border-r', t.border, t.bgSidebar)}>
      <div className={cx('p-3 border-b flex-shrink-0 space-y-2', t.border)}>
        <SearchInput value={query} onChange={onQuery} placeholder="Filter the catalog…" accent="amber" />
        <p className={cx('text-[11px]', t.textMuted)}>
          Product › Subcategory › Item. Items are leaves and hold the content.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {nodes.length === 0 ? (
          <EmptyState icon={Search} title="Nothing matches" hint="Clear the filter or widen the audience." className="py-8" />
        ) : (
          nodes.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              expanded={expanded}
              forceOpen={forceOpen}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onCopy={onCopy}
              onImportInto={onImportInto}
              onDelete={onDelete}
              editing={editing}
              setEditing={setEditing}
              onRename={onRename}
            />
          ))
        )}
      </div>
    </aside>
  );
}

function TreeNode({
  node, depth, expanded, forceOpen, selectedId, onToggle, onSelect,
  onAddChild, onCopy, onImportInto, onDelete, editing, setEditing, onRename,
}) {
  const { t, e } = useTheme();
  const c = e(node.type);
  const Icon = NODE_ICON[node.type] || Circle;
  const hasChildren = !!(node.children && node.children.length);
  const open = forceOpen || expanded.has(node.id);
  const selected = selectedId === node.id;
  const isEditing = editing?.id === node.id;
  const aud = audienceMeta(node.audience);

  const commit = () => {
    if (editing?.id === node.id) onRename(node.id, editing.value);
    setEditing(null);
  };

  return (
    <div>
      <div
        onClick={() => onSelect(node.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(ev) => { if (ev.key === 'Enter') onSelect(node.id); }}
        className={cx('group/row flex items-center gap-1 rounded-lg pr-1 py-1 cursor-pointer border transition-colors',
          selected ? cx(c.soft, c.borderStrong) : cx('border-transparent', t.bgHover))}
      >
        <button
          onClick={(ev) => { ev.stopPropagation(); if (hasChildren) onToggle(node.id); }}
          aria-label={hasChildren ? (open ? 'Collapse' : 'Expand') : undefined}
          className={cx('w-5 h-5 flex items-center justify-center flex-shrink-0 rounded', hasChildren ? t.textMuted : 'opacity-0 pointer-events-none')}
        >
          <ChevronRight size={ICON.sm} className={cx('transition-transform', open && 'rotate-90')} />
        </button>

        <Icon size={ICON.base} className={cx(c.fg, 'flex-shrink-0')} />

        {isEditing ? (
          <Input
            autoFocus
            accent="amber"
            value={editing.value}
            onChange={(ev) => setEditing({ id: node.id, value: ev.target.value })}
            onClick={(ev) => ev.stopPropagation()}
            onBlur={commit}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
              if (ev.key === 'Escape') { ev.preventDefault(); setEditing(null); }
            }}
            className="py-0.5 px-1.5 text-xs"
          />
        ) : (
          <>
            <span className={cx('flex-1 min-w-0 truncate text-sm', selected ? t.text : t.textSecondary)}>
              {node.name}
            </span>

            {node.popular && <Star size={ICON.xs} className={cx('flex-shrink-0', t.textMuted)} />}
            {node.audience === 'external' && <Globe size={ICON.xs} className={cx('flex-shrink-0', t.textMuted)} />}
            {node.audience === 'both' && <Users size={ICON.xs} className={cx('flex-shrink-0', t.textMuted)} />}
            {hasChildren && (
              <span className={cx('text-[10px] tabular-nums px-1.5 rounded-full flex-shrink-0',
                'group-hover/row:hidden group-focus-within/row:hidden', t.bgSubtle, t.textMuted)}
                title={`${node.children.length} ${node.type === 'product' ? 'subcategories' : 'items'}`}>
                {node.children.length}
              </span>
            )}

            {/* Hover cluster. Revealed on focus-within too, so the row's actions
                are reachable from the keyboard rather than mouse-only. */}
            <span className="hidden group-hover/row:flex group-focus-within/row:flex items-center gap-0.5 flex-shrink-0">
              <TreeAction icon={Pencil} label="Rename" onClick={() => setEditing({ id: node.id, value: node.name })} />
              {CHILD_TYPE[node.type] && (
                <TreeAction icon={Plus} label={`Add ${CHILD_TYPE[node.type]}`} onClick={() => onAddChild(node)} />
              )}
              {node.type === 'product' ? (
                <TreeAction icon={Copy} label="Import a subcategory into this product" onClick={() => onImportInto(node)} />
              ) : (
                <TreeAction icon={Copy} label="Copy into another parent" onClick={() => onCopy(node)} />
              )}
              <TreeAction icon={Trash2} label="Delete" accent="red" onClick={() => onDelete(node)} />
            </span>
          </>
        )}

        <span className="sr-only">{aud.label}</span>
      </div>

      {open && hasChildren && (
        <div className={cx('ml-[13px] pl-1.5 border-l', t.border)}>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              forceOpen={forceOpen}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onCopy={onCopy}
              onImportInto={onImportInto}
              onDelete={onDelete}
              editing={editing}
              setEditing={setEditing}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeAction({ icon, label, accent, onClick }) {
  return (
    <IconButton
      icon={icon}
      label={label}
      accent={accent}
      size={ICON.sm}
      className="p-1"
      onClick={(ev) => { ev.stopPropagation(); onClick(); }}
    />
  );
}

/* ==================================================================== *
 * Detail pane
 * ==================================================================== */

function NodeDetail(props) {
  const { node } = props;
  return node.type === 'item' ? <ItemDetail {...props} /> : <BranchDetail {...props} />;
}

function DetailHeader({ node, trail, onSelect, editingInPane, setEditingInPane, onRename, onCopy, onDelete, extra }) {
  const { t, e } = useTheme();
  const c = e(node.type);
  const Icon = NODE_ICON[node.type] || Circle;
  const editing = editingInPane?.id === node.id;
  const aud = audienceMeta(node.audience);

  const commit = () => {
    if (editingInPane?.id === node.id) onRename(node.id, editingInPane.value);
    setEditingInPane(null);
  };

  return (
    <Card className={cx(DENSITY.cardPad, 'mb-3')}>
      <Breadcrumbs
        items={trail.map(n => ({ id: n.id, name: n.name }))}
        onNavigate={(item) => onSelect(item.id)}
        className="mb-2"
      />
      <div className="flex items-start gap-3">
        <IconTile icon={Icon} accent={ENTITIES[node.type].hue} size="lg" />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                accent={ENTITIES[node.type].hue}
                value={editingInPane.value}
                onChange={(ev) => setEditingInPane({ id: node.id, value: ev.target.value })}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
                  if (ev.key === 'Escape') { ev.preventDefault(); setEditingInPane(null); }
                }}
                className="py-1"
              />
              <IconButton icon={Check} label="Save name" accent="emerald" onClick={commit} />
              <IconButton icon={X} label="Cancel rename" onClick={() => setEditingInPane(null)} />
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h3 className={cx('text-lg font-semibold truncate', t.text)}>{node.name}</h3>
              <IconButton icon={Pencil} label="Rename" onClick={() => setEditingInPane({ id: node.id, value: node.name })} />
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <EntityTag kind={node.type} />
            <Chip accent={aud.hue} icon={aud.icon}>{aud.label}</Chip>
            {node.popular && <Chip accent="amber" icon={Star}>Popular</Chip>}
            {node.fulfillment && <Chip accent="gray" icon={Clock}>{node.fulfillment}</Chip>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {node.type !== 'product' && <IconButton icon={Copy} label="Copy into another parent" onClick={() => onCopy(node)} />}
          <IconButton icon={Trash2} label="Delete" accent="red" onClick={() => onDelete(node)} />
        </div>
      </div>
      {node.description && <p className={cx('text-sm mt-3', t.textSecondary)}>{node.description}</p>}
      {extra}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Product / subcategory
 * ------------------------------------------------------------------ */

function BranchDetail({
  node, trail, catalog, knowledge, subforms, directory, onSelect, onAddChild, onCopy,
  onImportInto, onDelete, editingInPane, setEditingInPane, onRename, onPatch,
}) {
  const { t } = useTheme();
  const childType = CHILD_TYPE[node.type];
  const counts = countTree(node);
  const refs = collectRefs(node);
  const owner = (directory || []).find(p => p.id === node.ownerId);

  return (
    <>
      <DetailHeader
        node={node} trail={trail} onSelect={onSelect}
        editingInPane={editingInPane} setEditingInPane={setEditingInPane}
        onRename={onRename} onCopy={onCopy} onDelete={onDelete}
        extra={
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Stat label={node.type === 'product' ? 'subcategories' : 'items'}
              value={node.type === 'product' ? counts.subcategories : counts.items}
              accent={node.type === 'product' ? 'purple' : 'emerald'}
              icon={node.type === 'product' ? Layers : Circle} />
            {node.type === 'product' && <Stat label="items" value={counts.items} accent="emerald" icon={Circle} />}
            <Stat label="knowledge atoms" value={refs.knowledge.size} accent="blue" icon={BookOpen} />
            <Stat label="request forms" value={refs.subforms.size} accent="purple" icon={FileQuestion} />
            {refs.gaps > 0 && <Stat label="items with no knowledge" value={refs.gaps} accent="amber" icon={AlertCircle} />}
            {owner && (
              <span className={cx('flex items-center gap-2 px-3 py-2 rounded-xl border', t.bgCard, t.borderLight)}>
                <Avatar name={owner.name} size="sm" />
                <span className={cx('text-xs', t.textMuted)}>owner</span>
                <span className={cx('text-sm', t.text)}>{owner.name}</span>
              </span>
            )}
          </div>
        }
      />

      <div className="space-y-3">
        <AudiencePanel node={node} onPatch={onPatch} />

        <Panel
          icon={childType === 'subcategory' ? Layers : Circle}
          accent={childType === 'subcategory' ? 'purple' : 'emerald'}
          title={childType === 'subcategory' ? 'Subcategories' : 'Items'}
          subtitle={
            childType === 'subcategory'
              ? `${(node.children || []).length} under this product`
              : `${(node.children || []).length} leaves — the only nodes that carry content`
          }
          action={<Button variant="soft" accent={childType === 'subcategory' ? 'purple' : 'emerald'} size="sm" icon={Plus} onClick={() => onAddChild(node)}>
            Add {childType}
          </Button>}
        >
          {(node.children || []).length === 0 ? (
            <EmptyState
              icon={childType === 'subcategory' ? Layers : Circle}
              title={`No ${childType === 'subcategory' ? 'subcategories' : 'items'} yet`}
              hint={childType === 'item'
                ? 'Items are what a person actually requests. Add one, then attach the knowledge and request forms it needs.'
                : 'Subcategories group items so a product tree stays readable at ten items and at a hundred.'}
              className="py-8"
            />
          ) : (
            <div className={cx('divide-y', t.borderLight)}>
              {node.children.map(child => (
                <ChildRow key={child.id} node={child} knowledge={knowledge} subforms={subforms} onSelect={onSelect} />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          icon={Copy}
          accent="amber"
          title="Import from elsewhere in the catalog"
          subtitle={`Copy an existing ${childType} into ${node.name}`}
          action={<Button variant="soft" accent="amber" size="sm" icon={Copy} onClick={() => onImportInto(node)}>Import</Button>}
        >
          <div className={cx(DENSITY.cardPad)}>
            <Banner accent="blue" icon={AlertCircle} title="A copy references, it does not duplicate">
              Real catalogs repeat themselves — “Password reset” belongs under Accounts <em>and</em> under the
              Storefront. Importing gives the copy fresh ids and a “(Copy)” suffix, but its knowledge atoms and
              request forms stay the <strong className={t.text}>same records</strong>. Fix a typo in the article once
              and every copy is fixed.
            </Banner>
          </div>
        </Panel>
      </div>
    </>
  );
}

function ChildRow({ node, knowledge, subforms, onSelect }) {
  const { t, e } = useTheme();
  const c = e(node.type);
  const Icon = NODE_ICON[node.type] || Circle;
  const counts = countTree(node);
  const aud = audienceMeta(node.audience);
  const kb = (node.knowledgeIds || []).map(id => (knowledge || []).find(k => k.id === id)).filter(Boolean);
  const sf = (node.subformIds || []).map(id => (subforms || []).find(s => s.id === id)).filter(Boolean);

  return (
    <div
      onClick={() => onSelect(node.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(ev) => { if (ev.key === 'Enter') onSelect(node.id); }}
      className={cx('flex items-center gap-3 cursor-pointer', DENSITY.rowPad, t.bgHover)}
    >
      <span className={cx('w-1 self-stretch min-h-8 rounded-full flex-shrink-0', c.rail)} />
      <Icon size={ICON.base} className={cx(c.fg, 'flex-shrink-0')} />
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm font-medium truncate', t.text)}>{node.name}</p>
        {node.description && <p className={cx('text-xs truncate', t.textMuted)}>{node.description}</p>}
      </div>
      <div className="hidden @md:flex items-center gap-1.5 flex-shrink-0">
        {node.type === 'item' ? (
          <>
            <ChipGroup accent="blue" icon={BookOpen} max={1} items={kb} render={(k) => labelOf(k, k.id)}
              empty={<Chip accent="amber" icon={AlertCircle}>No knowledge</Chip>} />
            <ChipGroup accent="purple" icon={FileQuestion} max={1} items={sf} render={(s) => labelOf(s, s.id)}
              empty={<Chip accent="gray">No form</Chip>} />
          </>
        ) : (
          <Chip accent="emerald" icon={Circle}>{counts.items} items</Chip>
        )}
        <Chip accent={aud.hue} icon={aud.icon}>{aud.label}</Chip>
      </div>
      <ChevronRight size={ICON.base} className={cx(t.textMuted, 'flex-shrink-0')} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Item — the only node type with content
 * ------------------------------------------------------------------ */

function ItemDetail({
  node, trail, knowledge, subforms, courses, assets, queues, onSelect, onCopy,
  onDelete, onAttach, editingInPane, setEditingInPane, onRename, onPatch,
}) {
  const { t } = useTheme();

  const atoms = (node.knowledgeIds || []).map(id => ({ id, record: (knowledge || []).find(k => k.id === id) }));
  const forms = (node.subformIds || []).map(id => ({ id, record: (subforms || []).find(s => s.id === id) }));
  const linkedAssets = (assets || []).filter(a => (a.catalogItemIds || []).includes(node.id));
  const unrouted = forms.filter(f => f.record && !f.record.routing?.queueId);
  const generalQueue = (queues || []).find(q => q.id === Q.GENERAL);

  const detach = (kind, id) => {
    const key = kind === 'knowledge' ? 'knowledgeIds' : 'subformIds';
    onPatch(node.id, (n) => ({ [key]: (n[key] || []).filter(x => x !== id) }));
  };

  return (
    <>
      <DetailHeader
        node={node} trail={trail} onSelect={onSelect}
        editingInPane={editingInPane} setEditingInPane={setEditingInPane}
        onRename={onRename} onCopy={onCopy} onDelete={onDelete}
      />

      <div className="space-y-3">
        <AudiencePanel node={node} onPatch={onPatch} />

        {/* ---------- Knowledge ---------- */}
        <Panel
          icon={BookOpen}
          accent="blue"
          title="Knowledge"
          subtitle={`${atoms.length} atom${atoms.length === 1 ? '' : 's'} attached — referenced, not owned`}
          action={<Button variant="soft" accent="blue" size="sm" icon={Link2} onClick={() => onAttach('knowledge', node.id)}>
            Attach existing
          </Button>}
        >
          {atoms.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No knowledge attached"
              hint="Without an article or guide here, every request on this item becomes a ticket. Attaching an existing atom is the cheapest deflection in the product."
              action={<Button variant="soft" accent="blue" size="sm" icon={Link2} onClick={() => onAttach('knowledge', node.id)}>Attach existing</Button>}
              className="py-8"
            />
          ) : (
            <div className={cx('divide-y', t.borderLight)}>
              {atoms.map(({ id, record }) => (
                <KnowledgeRow key={id} id={id} record={record} courses={courses} onDetach={() => detach('knowledge', id)} />
              ))}
            </div>
          )}
        </Panel>

        {/* ---------- Request forms ---------- */}
        <Panel
          icon={FileQuestion}
          accent="purple"
          title="Request forms"
          subtitle={`${forms.length} intake${forms.length === 1 ? '' : 's'} — “report a problem” and “request access” are different forms on one item`}
          action={<Button variant="soft" accent="purple" size="sm" icon={Link2} onClick={() => onAttach('subform', node.id)}>
            Attach existing
          </Button>}
        >
          <div className="space-y-0">
            {unrouted.length > 0 && (
              <div className={cx(DENSITY.cardPad, 'pb-0')}>
                <Banner accent="amber" icon={AlertCircle} title="Unrouted forms fall to the General queue">
                  {unrouted.length === 1 ? 'One form on this item has' : `${unrouted.length} forms on this item have`} no
                  routing rule. Tickets they create land in{' '}
                  <strong className={t.text}>{labelOf(generalQueue, 'General')}</strong> — nothing is dropped, but nobody
                  is specifically watching for it either.
                </Banner>
              </div>
            )}
            {forms.length === 0 ? (
              <EmptyState
                icon={FileQuestion}
                title="No request form on this item"
                hint="People can read the knowledge here but cannot raise anything. Attach an intake if this item should be actionable."
                action={<Button variant="soft" accent="purple" size="sm" icon={Link2} onClick={() => onAttach('subform', node.id)}>Attach existing</Button>}
                className="py-8"
              />
            ) : (
              <div className={cx('divide-y', t.borderLight)}>
                {forms.map(({ id, record }) => (
                  <SubformRow key={id} id={id} record={record} queues={queues} onDetach={() => detach('subform', id)} />
                ))}
              </div>
            )}
          </div>
        </Panel>

        {/* ---------- Linked assets ---------- */}
        <Panel
          icon={Monitor}
          accent="cyan"
          title="Linked assets"
          subtitle={`${linkedAssets.length} asset record${linkedAssets.length === 1 ? '' : 's'} point at this item`}
        >
          {linkedAssets.length === 0 ? (
            <div className={DENSITY.cardPad}>
              <p className={cx('text-xs', t.textMuted)}>
                Assets link themselves to catalog items — the link is edited on the asset record, in the Assets module.
                A laptop model pointing here is what lets “New laptop” pre-fill the model list.
              </p>
            </div>
          ) : (
            <div className={cx('divide-y', t.borderLight)}>
              {linkedAssets.map(asset => <AssetRow key={asset.id} asset={asset} />)}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function KnowledgeRow({ id, record, courses, onDetach }) {
  const { t, a } = useTheme();
  const missing = !record;
  const format = record?.format === 'guide' ? 'guide' : 'article';
  const hue = ENTITIES[format].hue;
  const c = a(hue);
  const Icon = format === 'guide' ? LayoutGrid : BookOpen;
  const usedIn = missing ? [] : coursesUsing(courses, id);

  return (
    <div className={cx('flex items-center gap-3', DENSITY.rowPad)}>
      <span className={cx('w-1 self-stretch min-h-8 rounded-full flex-shrink-0', missing ? a('red').rail : c.rail)} />
      <Icon size={ICON.base} className={cx(missing ? a('red').fg : c.fg, 'flex-shrink-0')} />
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm font-medium truncate', t.text)}>{labelOf(record, id)}</p>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {missing ? (
            <Chip accent="red" icon={AlertCircle}>Atom not found</Chip>
          ) : (
            <>
              <Chip accent={hue} icon={Icon}>{ENTITIES[format].label}</Chip>
              {record.status && <StatusPill status={record.status} />}
              {record.minutes ? <Chip accent="gray" icon={Clock}>{record.minutes} min</Chip> : null}
              {usedIn.length > 0 && (
                <ChipGroup accent="indigo" icon={GraduationCap} max={1} items={usedIn} render={(x) => x} />
              )}
            </>
          )}
        </div>
      </div>
      {/* The product thesis, made visible where the author works: this atom is
          not only a help article, it is teaching someone a job right now. */}
      {usedIn.length > 0 && (
        <Chip accent="indigo" icon={GraduationCap} title={usedIn.join(', ')}>
          Used in {usedIn.length} course{usedIn.length === 1 ? '' : 's'}
        </Chip>
      )}
      <IconButton icon={X} label="Detach from this item" onClick={onDetach} />
    </div>
  );
}

function SubformRow({ id, record, queues, onDetach }) {
  const { t, a } = useTheme();
  const missing = !record;
  const c = a(ENTITIES.subform.hue);
  const queueId = record?.routing?.queueId;
  const queue = (queues || []).find(q => q.id === queueId);
  const fieldCount = (record?.fields || []).length;

  return (
    <div className={cx('flex items-center gap-3', DENSITY.rowPad)}>
      <span className={cx('w-1 self-stretch min-h-8 rounded-full flex-shrink-0', missing ? a('red').rail : c.rail)} />
      <FileQuestion size={ICON.base} className={cx(missing ? a('red').fg : c.fg, 'flex-shrink-0')} />
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm font-medium truncate', t.text)}>{labelOf(record, id)}</p>
        <p className={cx('text-xs truncate', t.textMuted)}>
          {missing ? id : (record.description || `${fieldCount} field${fieldCount === 1 ? '' : 's'}`)}
        </p>
      </div>
      {missing ? (
        <Chip accent="red" icon={AlertCircle}>Form not found</Chip>
      ) : queueId ? (
        <Chip accent="blue" icon={Inbox} title={`Routes to ${labelOf(queue, queueId)}`}>{labelOf(queue, queueId)}</Chip>
      ) : (
        <Chip accent="amber" icon={AlertCircle} title="No routing rule — tickets fall to the General queue">
          General (unrouted)
        </Chip>
      )}
      <IconButton icon={X} label="Detach from this item" onClick={onDetach} />
    </div>
  );
}

function AssetRow({ asset }) {
  const { t, e } = useTheme();
  const kind = asset.kind === 'software' ? 'software' : 'hardware';
  const c = e(kind);
  const Icon = kind === 'software' ? Key : Monitor;
  return (
    <div className={cx('flex items-center gap-3', DENSITY.rowPad)}>
      <span className={cx('w-1 self-stretch min-h-8 rounded-full flex-shrink-0', c.rail)} />
      <Icon size={ICON.base} className={cx(c.fg, 'flex-shrink-0')} />
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm font-medium truncate', t.text)}>{labelOf(asset, asset.id)}</p>
        <p className={cx('text-xs truncate', t.textMuted)}>{asset.tag || asset.assetTag || asset.serial || asset.id}</p>
      </div>
      {asset.status && <StatusPill status={asset.status} />}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Audience — internal / external / both, on every node
 * ------------------------------------------------------------------ */

function AudiencePanel({ node, onPatch }) {
  const { t } = useTheme();
  const aud = audienceMeta(node.audience);
  return (
    <Panel
      icon={aud.icon}
      accent={aud.hue}
      title="Audience"
      subtitle="Who sees this node — the same catalog serves employees and customers"
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <TileGroup
          value={node.audience || 'internal'}
          onChange={(value) => onPatch(node.id, { audience: value })}
          options={AUDIENCE_TILES}
          columns={3}
        />
        <p className={cx('text-xs', t.textMuted)}>
          {node.audience === 'external'
            ? 'Customer-facing. This branch appears in the help centre and the customer portal, never in the employee catalog.'
            : node.audience === 'both'
              ? 'Shared. Employees and customers both see it — the atom underneath is authored once for both.'
              : 'Employees only. Nothing here is published to the customer portal.'}
        </p>
      </div>
    </Panel>
  );
}

/* ==================================================================== *
 * Import / copy
 * ==================================================================== */

function ImportModal({ catalog, initial, onClose, onConfirm }) {
  const { t } = useTheme();
  const [sourceId, setSourceId] = useState(initial.sourceId || '');
  const [targetId, setTargetId] = useState(initial.targetId || '');

  const flat = useMemo(() => flatten(catalog), [catalog]);
  const pathOf = useCallback((id) => (findTrail(catalog, id) || []).map(n => n.name).join(' › '), [catalog]);

  const source = sourceId ? findNode(catalog, sourceId) : null;
  const target = targetId ? findNode(catalog, targetId) : null;

  // Gate by entity type rather than showing a disabled control: a subcategory
  // can only land in a product, an item only in a subcategory.
  const sourceOptions = flat
    .filter(x => x.node.type === 'subcategory' || x.node.type === 'item')
    .filter(x => (!target ? true : target.type === 'product' ? x.node.type === 'subcategory' : x.node.type === 'item'))
    .map(x => ({ value: x.node.id, label: `${x.node.type === 'item' ? '·' : '›'} ${pathOf(x.node.id)}` }));

  const targetOptions = flat
    .filter(x => (!source ? x.node.type !== 'item' : source.type === 'item' ? x.node.type === 'subcategory' : x.node.type === 'product'))
    .map(x => ({ value: x.node.id, label: pathOf(x.node.id) }));

  const counts = source ? countTree(source) : null;
  const refs = source ? collectRefs(source) : null;
  const ready = !!source && !!target;

  return (
    <Modal
      open
      onClose={onClose}
      accent="amber"
      icon={Copy}
      size="modalMd"
      title="Import a copy"
      subtitle="Deep-copy a subcategory or item into another parent"
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            {ready ? `“${source.name} (Copy)” will be created under ${target.name}` : 'Pick what to copy and where it lands'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent="amber" icon={Copy} disabled={!ready} onClick={() => onConfirm(sourceId, targetId)}>
              Create copy
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Banner accent="blue" icon={AlertCircle} title="The copy references the same atoms">
          Fresh ids, a “(Copy)” suffix and an independent place in the tree — but the knowledge articles and
          request forms underneath are <strong className={t.text}>the same records</strong>, not duplicates. Edit the
          article once and every catalog item showing it updates. This exists because re-authoring the same
          “Password reset” under four products was the most tedious part of setting v1 up.
        </Banner>

        <Field label="Copy this" required hint="Products cannot be copied — a product is the root of a branch.">
          <Select
            accent="amber"
            value={sourceId}
            onChange={(ev) => setSourceId(ev.target.value)}
            placeholder="Choose a subcategory or item…"
            options={sourceOptions}
          />
        </Field>

        <Field
          label="Into this parent"
          required
          hint={source
            ? (source.type === 'item' ? 'Items live under subcategories.' : 'Subcategories live under products.')
            : 'The list narrows once you pick a source.'}
        >
          <Select
            accent="amber"
            value={targetId}
            onChange={(ev) => setTargetId(ev.target.value)}
            placeholder="Choose a destination…"
            options={targetOptions}
          />
        </Field>

        {source && (
          <Card className={cx(DENSITY.cardPad, 'space-y-2')}>
            <GroupLabel>What gets created</GroupLabel>
            <div className="flex items-center gap-2 flex-wrap">
              <Chip accent={ENTITIES[source.type].hue} icon={NODE_ICON[source.type]}>{source.name} (Copy)</Chip>
              {counts.items > 0 && <Chip accent="emerald" icon={Circle}>{counts.items} items</Chip>}
              {counts.subcategories > 0 && <Chip accent="purple" icon={Layers}>{counts.subcategories} subcategories</Chip>}
              <Chip accent="blue" icon={BookOpen}>{refs.knowledge.size} atoms referenced</Chip>
              <Chip accent="purple" icon={FileQuestion}>{refs.subforms.size} forms referenced</Chip>
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * Attach existing knowledge / request form
 * ==================================================================== */

function AttachModal({ kind, item, knowledge, subforms, queues, courses, onClose, onPatch }) {
  const { t } = useTheme();
  const [query, setQuery] = useState('');
  const isKnowledge = kind === 'knowledge';
  const key = isKnowledge ? 'knowledgeIds' : 'subformIds';
  const pool = (isKnowledge ? knowledge : subforms) || [];
  const attached = new Set(item?.[key] || []);

  const q = query.trim().toLowerCase();
  const results = pool.filter(rec => {
    if (!q) return true;
    const text = `${labelOf(rec, rec.id)} ${rec.summary || rec.description || ''} ${(rec.tags || []).join(' ')}`.toLowerCase();
    return text.includes(q);
  });

  const toggle = (id) => {
    onPatch(item.id, (n) => {
      const list = n[key] || [];
      return { [key]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] };
    });
  };

  if (!item) return null;

  return (
    <Modal
      open
      onClose={onClose}
      accent={isKnowledge ? 'blue' : 'purple'}
      icon={isKnowledge ? BookOpen : FileQuestion}
      size="modalLg"
      title={isKnowledge ? 'Attach knowledge' : 'Attach a request form'}
      subtitle={`${item.name} · ${attached.size} attached`}
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            Attaching creates a reference. Nothing is copied and nothing is removed from anywhere else.
          </span>
          <Button variant="solid" accent={isKnowledge ? 'blue' : 'purple'} icon={Check} onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Banner accent={isKnowledge ? 'blue' : 'purple'} icon={AlertCircle}>
          {isKnowledge
            ? 'Knowledge atoms are top-level records. The same article can deflect on three catalog items, brief an agent inside a ticket, and be a lesson in a course — all at once.'
            : 'Request forms are top-level records too. One “Report a problem” intake can hang off every item that needs it, and its routing is configured once.'}
        </Banner>

        <SearchInput
          value={query}
          onChange={setQuery}
          accent={isKnowledge ? 'blue' : 'purple'}
          placeholder={isKnowledge ? 'Search articles and guides…' : 'Search request forms…'}
        />

        {results.length === 0 ? (
          <EmptyState
            icon={isKnowledge ? BookOpen : FileQuestion}
            title={pool.length ? 'Nothing matches' : `No ${isKnowledge ? 'knowledge atoms' : 'request forms'} exist yet`}
            hint={pool.length
              ? 'Try a shorter search.'
              : `Author one in the ${isKnowledge ? 'Knowledge' : 'Forms'} module, then attach it here.`}
            className="py-8"
          />
        ) : (
          <div className={DENSITY.rowGap}>
            {results.map(rec => (
              <AttachRow
                key={rec.id}
                record={rec}
                isKnowledge={isKnowledge}
                attached={attached.has(rec.id)}
                queues={queues}
                courses={courses}
                onToggle={() => toggle(rec.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function AttachRow({ record, isKnowledge, attached, queues, courses, onToggle }) {
  const { t, a } = useTheme();
  const format = record.format === 'guide' ? 'guide' : 'article';
  const hue = isKnowledge ? ENTITIES[format].hue : ENTITIES.subform.hue;
  const c = a(hue);
  const Icon = isKnowledge ? (format === 'guide' ? LayoutGrid : BookOpen) : FileQuestion;
  const queue = isKnowledge ? null : (queues || []).find(q => q.id === record.routing?.queueId);
  const usedIn = isKnowledge ? coursesUsing(courses, record.id) : [];

  return (
    <div
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onToggle(); } }}
      className={cx('flex items-center gap-3 rounded-lg border cursor-pointer transition-colors', DENSITY.rowPad,
        attached ? cx(c.soft, c.borderStrong) : cx(t.bgCard, t.borderLight, t.bgHover))}
    >
      <span className={cx('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
        attached ? cx(c.solid, 'border-transparent') : cx(t.bgInput, t.borderLight))}>
        {attached && <Check size={ICON.xs} className="text-white" />}
      </span>
      <Icon size={ICON.base} className={cx(c.fg, 'flex-shrink-0')} />
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm font-medium truncate', t.text)}>{labelOf(record, record.id)}</p>
        <p className={cx('text-xs truncate', t.textMuted)}>
          {record.summary || record.description || record.id}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isKnowledge ? (
          <>
            {record.status && <StatusPill status={record.status} />}
            {usedIn.length > 0 && (
              <Chip accent="indigo" icon={GraduationCap} title={usedIn.join(', ')}>
                Used in {usedIn.length} course{usedIn.length === 1 ? '' : 's'}
              </Chip>
            )}
          </>
        ) : (
          queue
            ? <Chip accent="blue" icon={Inbox}>{labelOf(queue, queue.id)}</Chip>
            : <Chip accent="amber" icon={AlertCircle}>General (unrouted)</Chip>
        )}
      </div>
    </div>
  );
}
