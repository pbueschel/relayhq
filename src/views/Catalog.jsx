import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Package, Folder, Layers, Circle, ChevronRight, Plus, Pencil, Copy, Trash2,
  BookOpen, LayoutGrid, FileQuestion, Inbox, AlertCircle, Monitor, Key, Link2,
  GraduationCap, Building2, Globe, Users, Check, X, Star, Clock, Search,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, ENTITIES, entityHue, tint,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, EntityTag, Avatar,
  EmptyState, Card, Panel, GroupLabel, Stat, Banner,
  Field, Input, Select, SearchInput, TileGroup,
  Modal, ConfirmDelete,
  PageBody, Breadcrumbs,
  ModuleHeader, ScopedSearch, FilterToggle, FilterTray, subsetLabel, optionCounts, passes,
} from '@/ds';
import { useStore, setCollection, addTo, uid, nowISO } from '@/store/store.js';
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
 *
 * CREATE BESIDE ATTACH (restored from v1). An admin building the catalog finds
 * content gaps while building it, so both verbs live on the item's Knowledge and
 * Request forms panels, side by side and equally visible:
 *   CREATE  authors a NEW record (a draft), links it to this item, and opens it
 *           in its own editor — no round trip through another module.
 *   ATTACH  references a record that already exists. This is the verb that makes
 *           the catalog reusable, so it is never demoted to a branch of Create.
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

function audienceMeta(value) {
  return AUDIENCE[value] || AUDIENCE.internal;
}

/* The two knowledge formats, spelled the same way the Knowledge module spells
 * them so an atom created here is indistinguishable from one created there. */
const FORMAT = {
  article: { value: 'article', label: 'Article', icon: BookOpen,   hue: entityHue('article'), hint: 'Rich text' },
  guide:   { value: 'guide',   label: 'Guide',   icon: LayoutGrid, hue: entityHue('guide'),   hint: 'Slides' },
};

const FORMAT_TILES = [FORMAT.article, FORMAT.guide].map(f => ({
  value: f.value, label: f.label, icon: f.icon, hint: f.hint, accent: f.hue,
}));

function formatMeta(value) {
  return FORMAT[value] || FORMAT.article;
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

/**
 * What an ITEM carries. A list, not a single value, because an item can hold a
 * knowledge atom AND a request form — and the filter has to be able to say so.
 */
function contentOf(node) {
  const out = [];
  if ((node.knowledgeIds || []).length) out.push('knowledge');
  if ((node.subformIds || []).length) out.push('form');
  return out.length ? out : ['none'];
}

/** Whether any asset record points at this item. */
function assetLinkOf(node, assets) {
  return (assets || []).some(a => (a.catalogItemIds || []).includes(node.id)) ? 'linked' : 'unlinked';
}

/**
 * Keep a node when it matches, or when any descendant does — and keep the whole
 * subtree of a node that matches the TEXT, because searching “Storefront” should
 * reveal what is under Storefront. The FILTERS are never relaxed that way: a node
 * hidden from customers stays hidden even when its parent matched the search.
 */
function filterTree(nodes, query, matchNode) {
  const q = query.trim().toLowerCase();
  const out = [];
  for (const n of nodes || []) {
    const textHit = !q || `${n.name} ${n.description || ''}`.toLowerCase().includes(q);
    const selfHit = textHit && matchNode(n);
    const children = filterTree(n.children, textHit ? '' : query, matchNode);
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
  // The author owns what they create here. Read it from state rather than
  // spelling a person id into a view — those live in seed/ids.js.
  const currentUser = useStore(s => s.currentUser);

  /* One header state: the multi-select filter values, the in-page query, and
   * whether the tray is showing. The tray forces itself open whenever something
   * is active, so a filter can never be on while its control is hidden. */
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
  const [trayOpen, setTrayOpen] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set((catalog || []).map(p => p.id)));

  // TWO rename states, never one. Tree row and detail header edit the same
  // record but must not share a buffer — that was the v1 fight.
  const [editingNode, setEditingNode] = useState(null);        // { id, value } — tree
  const [editingNodeInPane, setEditingNodeInPane] = useState(null); // { id, value } — detail

  const [confirming, setConfirming] = useState(null);          // node pending delete
  const [importing, setImporting] = useState(null);            // { sourceId, targetId }
  const [attaching, setAttaching] = useState(null);            // { kind, itemId } — reference something that exists
  const [creating, setCreating] = useState(null);              // { kind, itemId } — author something new, here

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

  /**
   * CREATE, then LINK — the v1 capability the rebuild dropped.
   *
   * The record is authored as a TOP-LEVEL draft in `knowledge` / `subforms`,
   * in exactly the shape the Knowledge and Forms modules produce, and the item
   * gets a reference to it. Nothing is nested and nothing is copied, so an atom
   * created here can be attached to four other items and taught as a lesson
   * tomorrow. Then hand the author to the editor: a draft with no body deflects
   * nothing, and the link is already saved either way.
   */
  const createAndLink = useCallback(({ kind, itemId, title, format }) => {
    const item = findNode(catalog, itemId);
    const name = (title || '').trim();
    if (!item || !name) return;

    if (kind === 'knowledge') {
      const id = uid('kb');
      const isGuide = format === 'guide';
      const base = {
        id,
        title: name,
        summary: 'No summary yet.',
        format: isGuide ? 'guide' : 'article',
        status: 'draft',
        audience: item.audience || 'internal',
        tags: [],
        ownerId: currentUser?.id || null,
        updatedAt: nowISO(),
        views: 0,
        helpfulYes: 0,
        helpfulNo: 0,
        objective: '',
        minutes: isGuide ? 4 : 5,
        prerequisiteIds: [],
        check: [],
      };
      addTo('knowledge', isGuide
        ? {
          ...base,
          slides: [{
            id: uid('sl'), type: 'text', heading: 'First screen', seconds: 5,
            caption: 'Say what the reader will be able to do by the end.',
          }],
        }
        : { ...base, body: '<p></p>' });
      patchNode(itemId, (n) => ({ knowledgeIds: [...(n.knowledgeIds || []), id] }));
      setCreating(null);
      navigate('knowledge', 'drafts', id);
      return;
    }

    const id = uid('sf');
    addTo('subforms', {
      id,
      name,
      description: '',
      audience: item.audience || 'internal',
      routing: {},
      fields: [],
      submitLabel: 'Submit request',
      confirmation: '',
      ownerId: currentUser?.id || null,
      updatedAt: nowISO(),
      submissions30d: 0,
      enabled: true,
    });
    patchNode(itemId, (n) => ({ subformIds: [...(n.subformIds || []), id] }));
    setCreating(null);
    navigate('forms', 'requests', id);
  }, [catalog, currentUser, patchNode]);

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

  const activeFilters = Object.values(filters).reduce((n, v) => n + (v?.length || 0), 0);
  const showTray = trayOpen || activeFilters > 0;
  const clearFilters = () => { setFilters({}); setQuery(''); setTrayOpen(false); };

  /* Items are the leaves — the only nodes that carry content — so they are what
   * the subtitle counts, what the search names as its scope, and what every
   * option count is computed over. */
  const allItems = useMemo(
    () => flatten(catalog).filter(x => x.node.type === 'item').map(x => x.node),
    [catalog],
  );

  /**
   * Audience is asked of EVERY node; content and asset links are properties of
   * items alone. So while an item filter is set a branch never matches directly —
   * it survives only because a descendant item did, which is exactly what
   * filterTree does with its children.
   */
  const matchNode = useCallback((node) => {
    if (!passes(filters.audience, node.audience || 'internal')) return false;
    const itemFilters = (filters.content?.length || 0) + (filters.assets?.length || 0);
    if (node.type !== 'item') return itemFilters === 0;
    if (!passes(filters.content, contentOf(node))) return false;
    if (!passes(filters.assets, assetLinkOf(node, assets))) return false;
    return true;
  }, [filters, assets]);

  const visible = useMemo(() => filterTree(catalog, query, matchNode), [catalog, query, matchNode]);
  const shownItems = useMemo(
    () => flatten(visible).filter(x => x.node.type === 'item').length,
    [visible],
  );
  const searching = query.trim().length > 0;

  /* Counts are computed over the WHOLE catalog, not the filtered tree, so an
   * option tells you how many items exist rather than how many survive the
   * filters you have already set — the latter reads as options vanishing. */
  const FILTER_DEFS = useMemo(() => {
    const byAudience = optionCounts(allItems, n => n.audience || 'internal');
    const byContent = optionCounts(allItems, n => contentOf(n));
    const byAssets = optionCounts(allItems, n => assetLinkOf(n, assets));
    return [
      {
        id: 'audience', label: 'Audience', icon: Users,
        options: [AUDIENCE.internal, AUDIENCE.external, AUDIENCE.both].map(a => ({
          value: a.value, label: a.label, count: byAudience.get(a.value) || 0,
        })),
      },
      {
        id: 'content', label: 'Content', icon: BookOpen,
        options: [
          { value: 'knowledge', label: 'Has knowledge',      count: byContent.get('knowledge') || 0 },
          { value: 'form',      label: 'Has a request form', count: byContent.get('form') || 0 },
          { value: 'none',      label: 'Has neither',        count: byContent.get('none') || 0 },
        ],
      },
      {
        id: 'assets', label: 'Linked assets', icon: Monitor,
        options: [
          { value: 'linked',   label: 'Linked',   count: byAssets.get('linked') || 0 },
          { value: 'unlinked', label: 'Unlinked', count: byAssets.get('unlinked') || 0 },
        ],
      },
    ];
  }, [allItems, assets]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ModuleHeader
        icon={Package}
        module="catalog"
        accent="amber"
        title="Products & Services"
        /* The subtitle always tells the truth about what is on screen: the
         * resting label when nothing narrows the tree, "9 of 40 shown" when
         * something does. */
        subtitle={subsetLabel(
          shownItems,
          allItems.length,
          `${(catalog || []).length} products · ${allItems.length} items · one catalog serving employees and customers`,
        )}
        primary={<Button variant="grad" module="catalog" icon={Plus} onClick={addProduct}>New product</Button>}
        tools={<>
          {/* Names its own scope, so it can never be mistaken for the global
              field in the bar above. It filters the TREE, as it always has. */}
          <ScopedSearch
            value={query}
            onChange={setQuery}
            scope={`${allItems.length} catalog items`}
            accent="amber"
          />
          <FilterToggle
            open={showTray}
            count={activeFilters}
            accent="amber"
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

      <div className="flex-1 flex overflow-hidden min-h-0">
        <TreePane
          nodes={visible}
          expanded={expanded}
          forceOpen={searching || activeFilters > 0}
          selectedId={selected?.id}
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
              onCreate={(kind, itemId) => setCreating({ kind, itemId })}
            />
          ) : (
            <EmptyState
              icon={Package}
              title="The catalog is empty"
              hint="A product is the top level of the tree — Accounts & Access, Devices, or the product your customers actually buy."
              action={<Button variant="grad" module="catalog" icon={Plus} onClick={addProduct}>New product</Button>}
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
          onSwitchToCreate={(kind, itemId) => { setAttaching(null); setCreating({ kind, itemId }); }}
        />
      )}

      {creating && (
        <CreateModal
          kind={creating.kind}
          item={findNode(catalog, creating.itemId)}
          onClose={() => setCreating(null)}
          onCreate={createAndLink}
          onSwitchToAttach={(kind, itemId) => { setCreating(null); setAttaching({ kind, itemId }); }}
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
  nodes, expanded, forceOpen, selectedId, onToggle, onSelect,
  onAddChild, onCopy, onImportInto, onDelete, editing, setEditing, onRename,
}) {
  const { t } = useTheme();
  return (
    <aside className={cx('w-80 flex-shrink-0 flex flex-col overflow-hidden border-r', t.border, t.bgSidebar)}>
      {/* No second search box here: the header's scoped field is the one that
          filters this tree, so there is only ever one place to type. */}
      <div className={cx('p-3 border-b flex-shrink-0', t.border)}>
        <p className={cx('text-[11px]', t.textMuted)}>
          Product › Subcategory › Item. Items are leaves and hold the content.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {nodes.length === 0 ? (
          <EmptyState icon={Search} title="Nothing matches" hint="Clear the search, or a filter in the header." className="py-8" />
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
  const { t, e, dark } = useTheme();
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
      {/* The selected node is the signature of this screen: v1 tinted it
          purple→amber with a purple border rather than washing it in the entity
          hue. The entity colour still speaks through the icon, so nothing is lost. */}
      <div
        onClick={() => onSelect(node.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(ev) => { if (ev.key === 'Enter') onSelect(node.id); }}
        className={cx('group/row flex items-center gap-1 rounded-lg pr-1 py-1 cursor-pointer border transition-colors',
          selected ? cx(tint('catalog', dark), t.text) : cx('border-transparent', t.bgHover))}
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
        <IconTile icon={Icon} accent={entityHue(node.type)} size="lg" />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                accent={entityHue(node.type)}
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
          // Values, not a count: the item names themselves, with an overflow badge.
          <ChipGroup accent="emerald" icon={Circle} max={1} items={node.children || []}
            render={(n) => n.name} empty={<Chip accent="gray">No items</Chip>} />
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

/**
 * The two verbs of the content panels, always both, always labelled.
 *
 * CREATE is the primary: the admin is looking at the gap right now and should
 * be able to fill it without leaving. ATTACH sits next to it at full weight —
 * demote it and the catalog quietly stops being reusable, because every author
 * takes the path of least resistance and re-writes “Password reset” per item.
 */
function ContentActions({ kind, itemId, onCreate, onAttach }) {
  const hue = entityHue(kind === 'knowledge' ? 'article' : 'subform');
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <Button variant="soft" accent={hue} size="sm" icon={Link2} onClick={() => onAttach(kind, itemId)}>
        Attach existing
      </Button>
      <Button variant="solid" accent={hue} size="sm" icon={Plus} onClick={() => onCreate(kind, itemId)}>
        Create new
      </Button>
    </div>
  );
}

function ItemDetail({
  node, trail, knowledge, subforms, courses, assets, queues, onSelect, onCopy,
  onDelete, onAttach, onCreate, editingInPane, setEditingInPane, onRename, onPatch,
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
          action={<ContentActions kind="knowledge" itemId={node.id} onCreate={onCreate} onAttach={onAttach} />}
        >
          {atoms.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No knowledge attached"
              hint="Without an article or guide here, every request on this item becomes a ticket. Attach an atom that already exists, or write the missing one now — it is created as a draft and linked here immediately."
              action={<ContentActions kind="knowledge" itemId={node.id} onCreate={onCreate} onAttach={onAttach} />}
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
          action={<ContentActions kind="subform" itemId={node.id} onCreate={onCreate} onAttach={onAttach} />}
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
                hint="People can read the knowledge here but cannot raise anything. Attach an intake that already exists, or create one here and route it in the builder."
                action={<ContentActions kind="subform" itemId={node.id} onCreate={onCreate} onAttach={onAttach} />}
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
  const hue = entityHue(format);
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
              <Chip accent={hue} icon={Icon}>{ENTITIES[format]?.label || format}</Chip>
              {record.status && <StatusPill status={record.status} />}
              {record.minutes ? <Chip accent="gray" icon={Clock}>{record.minutes} min</Chip> : null}
              {/* The product thesis, made visible where the author works: this atom is
                  not only a help article, it is teaching someone a job right now.
                  Course TITLES, never "used in 3 courses" — chips carry values. */}
              <ChipGroup accent="indigo" icon={GraduationCap} max={2} items={usedIn} render={(x) => x} />
            </>
          )}
        </div>
      </div>
      <IconButton icon={X} label="Detach from this item" onClick={onDetach} />
    </div>
  );
}

function SubformRow({ id, record, queues, onDetach }) {
  const { t, a } = useTheme();
  const missing = !record;
  const c = a(entityHue('subform'));
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
        // A queue owns its hue (rules.js) — borrow it so the colour means the same
        // thing here as it does in Business Rules and the workspace.
        <Chip accent={queue?.hue || entityHue('queue')} icon={Inbox}
          title={`Routes to ${labelOf(queue, queueId)}`}>{labelOf(queue, queueId)}</Chip>
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
              <Chip accent={entityHue(source.type)} icon={NODE_ICON[source.type]}>{source.name} (Copy)</Chip>
            </div>
            {/* Counts live in Stat tiles; chips are reserved for values. */}
            <div className="flex items-center gap-2 flex-wrap">
              {counts.subcategories > 0 && <Stat label="subcategories" value={counts.subcategories} accent="purple" icon={Layers} />}
              {counts.items > 0 && <Stat label="items" value={counts.items} accent="emerald" icon={Circle} />}
              <Stat label="atoms referenced" value={refs.knowledge.size} accent="blue" icon={BookOpen} />
              <Stat label="forms referenced" value={refs.subforms.size} accent="purple" icon={FileQuestion} />
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * Create new knowledge / request form — in place, without leaving
 *
 * The counterpart to AttachModal, and deliberately small: a title (plus a
 * format, for knowledge) is enough to make the record real and link it. The
 * body, the fields and the routing are authored in the editor this hands you
 * to. Everything created here is a TOP-LEVEL record — the item only gets a
 * reference — so it can be attached elsewhere and taught as a lesson later.
 * ==================================================================== */

function CreateModal({ kind, item, onClose, onCreate, onSwitchToAttach }) {
  const { t } = useTheme();
  const isKnowledge = kind === 'knowledge';
  const [title, setTitle] = useState('');
  const [format, setFormat] = useState('article');

  const meta = formatMeta(format);
  const hue = isKnowledge ? meta.hue : entityHue('subform');
  const ready = title.trim().length > 0;

  const submit = () => {
    if (!ready || !item) return;
    onCreate({ kind, itemId: item.id, title, format });
  };

  if (!item) return null;

  return (
    <Modal
      open
      onClose={onClose}
      accent={hue}
      icon={isKnowledge ? meta.icon : FileQuestion}
      size="modalMd"
      title={isKnowledge ? 'Create knowledge here' : 'Create a request form here'}
      subtitle={`New record, linked to ${item.name} the moment it exists`}
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            {isKnowledge
              ? 'Created as a draft, attached to this item, then opened in the knowledge editor.'
              : 'Created unrouted, attached to this item, then opened in the form builder.'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent={hue} icon={Plus} disabled={!ready} onClick={submit}>
              {isKnowledge ? `Create ${meta.label.toLowerCase()}` : 'Create form'}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        {isKnowledge ? (
          <Banner accent="amber" icon={AlertCircle} title="New knowledge starts as a draft">
            A draft is served to nobody — not the help centre, not the agent panel, and any course including it
            skips past it silently. It shows on this item as a draft so the gap stays visible until someone
            publishes it.
          </Banner>
        ) : (
          <Banner accent="amber" icon={AlertCircle} title="A new form starts unrouted">
            Until you give it a queue in the builder, tickets it creates fall to the General queue. Nothing is
            dropped, but nobody is specifically watching for it either.
          </Banner>
        )}

        {isKnowledge && (
          <Field label="Format" hint="Guides are the Stories format — a tap-through sequence of screens.">
            <TileGroup value={format} onChange={setFormat} options={FORMAT_TILES} columns={2} />
          </Field>
        )}

        <Field
          label={isKnowledge ? 'Title' : 'Form name'}
          required
          hint={isKnowledge
            ? 'The heading a reader sees in the help centre and a learner sees as a lesson.'
            : 'What the requester is doing — “Report a sign-in problem”, “Request access”.'}
        >
          <Input
            autoFocus
            accent={hue}
            value={title}
            placeholder={isKnowledge ? `e.g. How to use ${item.name}` : `e.g. Report a problem with ${item.name}`}
            onChange={(ev) => setTitle(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } }}
          />
        </Field>

        <Card className={cx(DENSITY.cardPad, 'flex items-center gap-3 flex-wrap')}>
          <div className="flex-1 min-w-0">
            <GroupLabel>Already written somewhere?</GroupLabel>
            <p className={cx('text-xs mt-1', t.textSecondary)}>
              Attach it instead. One record can sit under four catalog items at once — that reuse is why the
              catalog references content rather than owning it.
            </p>
          </div>
          <Button
            variant="soft"
            accent={hue}
            size="sm"
            icon={Link2}
            onClick={() => onSwitchToAttach(kind, item.id)}
          >
            Attach existing
          </Button>
        </Card>
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * Attach existing knowledge / request form
 * ==================================================================== */

function AttachModal({ kind, item, knowledge, subforms, queues, courses, onClose, onPatch, onSwitchToCreate }) {
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
          <div className="flex gap-2">
            <Button variant="soft" accent={isKnowledge ? 'blue' : 'purple'} icon={Plus}
              onClick={() => onSwitchToCreate(kind, item.id)}>
              Create new instead
            </Button>
            <Button variant="solid" accent={isKnowledge ? 'blue' : 'purple'} icon={Check} onClick={onClose}>Done</Button>
          </div>
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
              ? 'Try a shorter search, or write the missing one now.'
              : `Nothing to reference yet — write the first one here and it lands attached to ${item.name}.`}
            action={
              <Button variant="solid" accent={isKnowledge ? 'blue' : 'purple'} size="sm" icon={Plus}
                onClick={() => onSwitchToCreate(kind, item.id)}>
                Create new
              </Button>
            }
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
  const hue = entityHue(isKnowledge ? format : 'subform');
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
            <ChipGroup accent="indigo" icon={GraduationCap} max={1} items={usedIn} render={(x) => x} />
          </>
        ) : (
          queue
            ? <Chip accent={queue.hue || entityHue('queue')} icon={Inbox}>{labelOf(queue, queue.id)}</Chip>
            : <Chip accent="amber" icon={AlertCircle}>General (unrouted)</Chip>
        )}
      </div>
    </div>
  );
}
