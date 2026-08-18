import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  ShoppingCart, Folder, Plus, Pencil, Trash2, Search, Clock, Stamp, Inbox,
  BookOpen, LayoutGrid, FileQuestion, AlertCircle, X, ArrowUp, ArrowDown,
  Building2, Globe, Users, Repeat, BadgeCheck, Server, Link2, Package, Star,
  Laptop, Monitor, Headphones, Smartphone, Key, Shield, UserPlus, Mail,
  Database, CreditCard, Wrench, MapPin, GraduationCap, Sparkles, Rocket,
  LifeBuoy, Boxes, Printer, DoorOpen, Ticket, Video, Wifi, Briefcase, Truck,
  Coins, Layers, PackageOpen, AppWindow, Palette, PenTool, KeyRound,
  ShieldCheck, ShieldAlert, UserMinus, UserCog, Armchair, Presentation,
  FlaskConical, Store,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, entityHue, statusMeta,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill,
  EmptyState, Card, Panel, GroupLabel, ListRow, Stat, Banner, Divider,
  Field, Input, Textarea, Select, TileGroup, Toggle,
  Modal, ConfirmDelete,
  LensBar, PageBody,
  ModuleHeader, ScopedSearch, FilterBar,
  subsetLabel, optionCounts, passes, countActive,
} from '@/ds';
import { useStore, addTo, patchIn, removeFrom, uid, nowISO } from '@/store/store.js';
import { useRoute } from '@/lib/router.js';
import { summarize } from '@/lib/conditions.js';
import { matchingPolicies, STAGE_RULES } from '@/lib/approvals.js';
import { Q } from '@/store/seed/ids.js';

/**
 * Service Catalog — the ADMIN side of the second catalog.
 *
 * src/store/schema.js explains why this is not the help tree: "Cannot sign in"
 * wants an answer, "Request a new laptop" wants an OUTCOME with a cost, a
 * delivery time, a sign-off and a queue that owns the work. Two shapes, two
 * authoring surfaces. This is the second one.
 *
 * WHAT THIS SCREEN IS FOR
 *   An admin publishing an orderable thing has to answer five questions and the
 *   editor is laid out as those five questions, in order:
 *     what is it        name, description, icon, category, audience, status
 *     what does it cost one-off, recurring, and how long delivery takes
 *     who fulfils it    the queue, and what has to be signed off first
 *     what do we ask    the request form — an ordinary subform, same builder
 *     what do we hand   knowledge to read before ordering, and the asset model
 *                       that ordering provisions
 *
 * NEVER A SILENT DEFAULT. Two fallbacks in this domain are load-bearing and both
 * are stated on screen rather than assumed: an item with no approval policy is
 * fulfilled without sign-off (said in a Banner, not implied by an empty field),
 * and an item whose request form has no routing falls to the General queue.
 *
 * COLOUR. The service catalog borrows the help catalog's structural language,
 * because structurally it is the same idea one level flatter: a CATEGORY is a
 * grouping node (`product` hue) and a SERVICE ITEM is the orderable leaf
 * (`item` hue). Every hue on this screen resolves through entityHue() or a
 * record's own declared hue — a queue chip is the queue's colour, so the queue
 * means the same thing here as it does in Business Rules and the workspace.
 */

/* ==================================================================== *
 * Vocabulary
 * ==================================================================== */

const CATEGORY_HUE = entityHue('product');    // amber — the grouping node
const ITEM_HUE = entityHue('item');           // emerald — the orderable leaf
const APPROVAL_HUE = entityHue('approval');
const QUEUE_HUE = entityHue('queue');
const FORM_HUE = entityHue('subform');
const KB_HUE = entityHue('article');
const GUIDE_HUE = entityHue('guide');
const ASSET_HUE = entityHue('hardware');
const LICENCE_HUE = entityHue('software');

const AUDIENCE = {
  internal: { value: 'internal', label: 'Internal', hue: 'slate', icon: Building2, hint: 'Employees' },
  external: { value: 'external', label: 'Customers', hue: 'green', icon: Globe, hint: 'Customer portal' },
  both: { value: 'both', label: 'Both', hue: 'violet', icon: Users, hint: 'Staff + customers' },
};

const AUDIENCE_TILES = [AUDIENCE.internal, AUDIENCE.external, AUDIENCE.both].map(x => ({
  value: x.value, label: x.label, icon: x.icon, hint: x.hint, accent: x.hue,
}));

const STATUS_TILES = [
  { value: 'draft', label: 'Draft', icon: Pencil, hint: 'Nobody can order it', accent: statusMeta('draft').hue },
  { value: 'published', label: 'Published', icon: BadgeCheck, hint: 'Live in the portal', accent: statusMeta('published').hue },
];

const RECURRENCE_OPTIONS = [
  { value: 'monthly', label: 'Every month' },
  { value: 'annual', label: 'Every year' },
];

/**
 * Two collections and one cut across them. `items` and `categories` are the
 * things this module authors; `fulfilment` is the same item list shelved by
 * what ordering hands over, because "which laptop model does this provision"
 * is not answerable from a category. A lens rather than a tab strip: the bar
 * carries the counts, which is why the header has no stat strip printing the
 * same numbers a second time in a second shape.
 */
const LENSES = [
  { value: 'items', label: 'Items', icon: ShoppingCart, accent: ITEM_HUE, noun: 'service items' },
  { value: 'fulfilment', label: 'Provisions', icon: Boxes, accent: ASSET_HUE, noun: 'items with a target' },
  { value: 'categories', label: 'Categories', icon: Folder, accent: CATEGORY_HUE, noun: 'categories' },
];

/**
 * WHAT ORDERING PROVISIONS.
 *
 * A service item is shelved by its category, which answers "where do I look for
 * it". It is fulfilled by a hardware model or a software licence, which answers
 * "what do we hand over" — a different question, and the one the assets domain
 * cares about. The intake declares it (`subform.fulfils`), so the same
 * declaration drives this list and the Get help walkthrough.
 *
 * `none` is a real member of this set, not a gap: onboarding, a desk move and
 * an expense sign-off are genuine service requests with nothing to provision.
 */
const FULFIL_KINDS = [
  { value: 'hardware', label: 'Hardware', icon: Monitor, hue: ASSET_HUE },
  { value: 'software', label: 'Software', icon: Key, hue: LICENCE_HUE },
  { value: 'none', label: 'Nothing to provision', icon: Layers, hue: 'gray' },
];

function fulfilMeta(kind) {
  return FULFIL_KINDS.find(k => k.value === kind) || FULFIL_KINDS[2];
}

/**
 * The icon set an author picks from. Deliberately small — an unbounded lucide
 * picker is a worse experience than two dozen icons that cover the domain, and
 * a consistent set is what makes the portal grid read as one catalog.
 */
const ICON_CHOICES = [
  { value: 'Laptop', label: 'Laptop', icon: Laptop },
  { value: 'Monitor', label: 'Monitor', icon: Monitor },
  { value: 'Headphones', label: 'Headset', icon: Headphones },
  { value: 'Smartphone', label: 'Phone', icon: Smartphone },
  { value: 'PackageOpen', label: 'Loaner', icon: PackageOpen },
  { value: 'Server', label: 'Server', icon: Server },
  { value: 'AppWindow', label: 'Software', icon: AppWindow },
  { value: 'Palette', label: 'Creative', icon: Palette },
  { value: 'FlaskConical', label: 'Sandbox', icon: FlaskConical },
  { value: 'KeyRound', label: 'Access', icon: KeyRound },
  { value: 'ShieldCheck', label: 'Security', icon: ShieldCheck },
  { value: 'Inbox', label: 'Mailbox', icon: Inbox },
  { value: 'UserPlus', label: 'Joiner', icon: UserPlus },
  { value: 'UserMinus', label: 'Leaver', icon: UserMinus },
  { value: 'UserCog', label: 'Role change', icon: UserCog },
  { value: 'Armchair', label: 'Desk', icon: Armchair },
  { value: 'Presentation', label: 'Meeting kit', icon: Presentation },
  { value: 'DoorOpen', label: 'Building', icon: DoorOpen },
  { value: 'Store', label: 'Storefront', icon: Store },
  { value: 'Users', label: 'Seats', icon: Users },
  { value: 'LifeBuoy', label: 'Support', icon: LifeBuoy },
  { value: 'Rocket', label: 'Onboarding', icon: Rocket },
  { value: 'GraduationCap', label: 'Training', icon: GraduationCap },
  { value: 'Package', label: 'Generic', icon: Package },
];

/**
 * Rendering falls back through a WIDER map than the picker offers, because the
 * catalog is authored in more than one place and may legitimately name an icon
 * this picker does not list. An unknown name renders as Package rather than
 * crashing the row.
 */
const ICON_BY_NAME = {
  ...ICON_CHOICES.reduce((acc, o) => { acc[o.value] = o.icon; return acc; }, {}),
  PenTool, ShieldAlert, Key, Shield, Mail, Database, CreditCard, Wrench,
  MapPin, Sparkles, Boxes, Printer, Ticket, Video, Wifi, Briefcase, Truck,
  Coins, Layers, Folder, ShoppingCart, Star, Globe, Building2, BookOpen,
  FileQuestion, Clock, Link2, Stamp,
};

function iconFor(name) {
  return ICON_BY_NAME[name] || Package;
}

/**
 * The picker always offers the icon the record already uses, even when it came
 * from outside the curated set — otherwise opening an item authored elsewhere
 * shows nothing selected and the first click silently changes its icon.
 */
function iconOptions(current, accent) {
  const known = ICON_CHOICES.some(o => o.value === current);
  const base = ICON_CHOICES.map(o => ({ ...o, accent }));
  if (known || !current) return base;
  return [{ value: current, label: current, icon: iconFor(current), accent }, ...base];
}

function audienceMeta(value) {
  return AUDIENCE[value] || AUDIENCE.internal;
}

function labelOf(record, fallback) {
  return record?.name || record?.title || fallback;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/* ==================================================================== *
 * Money and time — pure, module scope
 * ==================================================================== */

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? MONEY.format(n) : '—';
}

function hasCharge(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

/** Compact form for a dense row: "$1,800 · $45/mo", or "Free". */
function priceCompact(item) {
  const parts = [];
  if (hasCharge(item?.price)) parts.push(money(item.price));
  if (hasCharge(item?.recurringPrice)) {
    parts.push(`${money(item.recurringPrice)}${item.recurrence === 'annual' ? '/yr' : '/mo'}`);
  }
  return parts.length ? parts.join(' · ') : 'Free';
}

/** Sentence form for the editor: "$1,800 one-off · $45 a month". */
function pricePhrase(item) {
  const parts = [];
  if (hasCharge(item?.price)) parts.push(`${money(item.price)} one-off`);
  if (hasCharge(item?.recurringPrice)) {
    parts.push(`${money(item.recurringPrice)} ${item.recurrence === 'annual' ? 'a year' : 'a month'}`);
  }
  return parts.length ? parts.join(' · ') : 'No charge';
}

function deliveryPhrase(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return 'available the same day';
  return `available in ${plural(n, 'working day', 'working days')}`;
}

function deliveryCompact(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return 'same day';
  return plural(n, 'day', 'days');
}

/** The line the author reads back: "$1,800 one-off · available in 5 working days". */
function commercialLine(item) {
  return `${pricePhrase(item)} · ${deliveryPhrase(item?.deliveryDays)}`;
}

/**
 * Monthly-equivalent recurring cost. An annual charge is divided by twelve so
 * one number can be summed across a catalog that mixes both — the tile says so
 * rather than quietly hiding the normalisation.
 */
function monthlyEquivalent(item) {
  if (!hasCharge(item?.recurringPrice)) return 0;
  const n = Number(item.recurringPrice);
  return item.recurrence === 'annual' ? n / 12 : n;
}

/* ==================================================================== *
 * Filtering — pure
 * ==================================================================== */

/**
 * The audiences a record is actually visible to, as a list — an item marked
 * `both` really does show in the internal portal AND the customer one, so it
 * has to answer to both filter values rather than only to the literal `both`.
 * passes() takes an array, so one helper serves the filter and its counts and
 * the two can never disagree.
 */
function audiencesOf(record) {
  const value = record?.audience || 'internal';
  return value === 'both' ? ['internal', 'external', 'both'] : [value];
}

function matchesQuery(record, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${record?.name || ''} ${record?.shortDescription || record?.description || ''}`;
  return haystack.toLowerCase().includes(q);
}

/** The pseudo-category that catches items whose categoryId resolves to nothing. */
const UNCATEGORISED = {
  id: '__uncategorised__',
  name: 'Uncategorised',
  icon: 'AlertCircle',
  audience: 'internal',
  order: Number.MAX_SAFE_INTEGER,
};

function sortCategories(categories) {
  return [...(categories || [])].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
}

/** Group items under their category, in category order, dropping empty groups. */
function groupByCategory(items, categories) {
  const known = new Set((categories || []).map(c => c.id));
  const groups = sortCategories(categories).map(category => ({
    category,
    items: (items || []).filter(i => i.categoryId === category.id),
  }));
  const orphans = (items || []).filter(i => !known.has(i.categoryId));
  if (orphans.length) groups.push({ category: UNCATEGORISED, items: orphans });
  return groups.filter(g => g.items.length > 0);
}

/* ==================================================================== *
 * Fulfilment — pure
 * ==================================================================== */

/**
 * Resolve what an item provisions, against the collections that own the target:
 * hardware points at `assetModels`, software at the `assets` rows with
 * `kind === 'software'`.
 *
 * The intake is the source of truth, because that declaration is what the
 * portal walkthrough reads too. `item.assetModelId` is a fallback rather than a
 * second source: it is the item's OWN declared provision, and without it an
 * item that creates an asset record would sort under "nothing to provision"
 * while its Provisions panel names a model. A target id that resolves to
 * nothing is reported as missing — never swallowed, never replaced.
 */
function fulfilmentOf(item, subforms, assetModels, licences) {
  const intake = (subforms || []).find(s => s.id === item?.subformId);
  const target = intake?.fulfils || null;

  if (target?.kind === 'hardware') {
    const model = (assetModels || []).find(m => m.id === target.modelId) || null;
    return { kind: 'hardware', targetId: target.modelId, model, licence: null, missing: !model };
  }
  if (target?.kind === 'software') {
    const licence = (licences || []).find(l => l.id === target.licenceId) || null;
    return { kind: 'software', targetId: target.licenceId, model: null, licence, missing: !licence };
  }
  if (item?.assetModelId) {
    const model = (assetModels || []).find(m => m.id === item.assetModelId) || null;
    return { kind: 'hardware', targetId: item.assetModelId, model, licence: null, missing: !model };
  }
  return { kind: 'none', targetId: null, model: null, licence: null, missing: false };
}

function modelLabel(model) {
  if (!model) return '';
  return model.manufacturer ? `${model.manufacturer} ${model.name}` : model.name;
}

function licenceLabel(licence) {
  if (!licence) return '';
  return licence.vendor ? `${licence.vendor} ${licence.product}` : (licence.product || licence.id);
}

/**
 * Seats spare, derived from `allocations` exactly as the assets screen derives
 * them — never stored, so the two cannot disagree. Null for a site licence or
 * one with no seat count, where "spare" means nothing.
 */
function seatPosition(licence) {
  if (!licence || licence.licenseModel === 'site' || licence.seatsOwned == null) return null;
  const used = (licence.allocations || []).reduce((n, al) => n + (al.seats || 1), 0);
  return { used, owned: licence.seatsOwned, spare: licence.seatsOwned - used };
}

function seatLabel(position) {
  if (!position) return null;
  if (position.spare < 0) return `${Math.abs(position.spare)} over ${position.owned}`;
  return `${position.spare} spare of ${position.owned}`;
}

function seatAccent(position) {
  if (!position) return 'gray';
  if (position.spare < 0) return 'red';
  if (position.spare === 0) return 'amber';
  return 'lime';
}

/** Group items by what they provision, in FULFIL_KINDS order, dropping empties. */
function groupByFulfilment(items, resolve) {
  return FULFIL_KINDS.map(kind => ({
    kind,
    items: (items || []).filter(i => resolve(i).kind === kind.value),
  })).filter(g => g.items.length > 0);
}

/* ==================================================================== *
 * View
 * ==================================================================== */

export default function ServiceCatalog({ route }) {
  const liveRoute = useRoute();
  const r = route || liveRoute;

  const categories = useStore(s => s.serviceCategories);
  const items = useStore(s => s.serviceItems);
  const queues = useStore(s => s.queues);
  const subforms = useStore(s => s.subforms);
  const knowledge = useStore(s => s.knowledge);
  const policies = useStore(s => s.approvalPolicies);
  const assetModels = useStore(s => s.assetModels);
  const assets = useStore(s => s.assets);
  const currentUser = useStore(s => s.currentUser);

  const [tab, setTab] = useState(r.sub === 'categories' ? 'categories' : 'items');
  const [query, setQuery] = useState('');
  // Multi-select, because "hardware or software" and "draft or internal" are
  // ordinary questions here and a single-select dropdown cannot express either.
  const [filters, setFilters] = useState({});

  const [editingItem, setEditingItem] = useState(null);        // { item } | { item: null, categoryId }
  const [editingCategory, setEditingCategory] = useState(null); // { category } | { category: null }
  const [confirming, setConfirming] = useState(null);           // { kind, record }

  // Follow the route when the sidebar deep-links a tab, but keep the tab in
  // local state so switching tabs here does not need to know the section name.
  useEffect(() => {
    if (r.sub === 'items' || r.sub === 'categories' || r.sub === 'fulfilment') setTab(r.sub);
  }, [r.sub]);

  // A deep link to one item opens its editor exactly once. The ref stops the
  // editor re-opening every time the store emits while it is already open.
  const openedRef = useRef(null);
  useEffect(() => {
    if (!r.id || openedRef.current === r.id) return;
    const hit = (items || []).find(i => i.id === r.id);
    if (!hit) return;
    openedRef.current = r.id;
    setEditingItem({ item: hit });
  }, [r.id, items]);

  const list = items || [];
  const cats = categories || [];

  // Software targets are asset rows, not their own collection.
  const licences = useMemo(() => (assets || []).filter(a => a.kind === 'software'), [assets]);
  const resolve = useCallback(
    (item) => fulfilmentOf(item, subforms, assetModels, licences),
    [subforms, assetModels, licences],
  );
  const itemsLens = tab !== 'categories';

  const totals = useMemo(() => {
    const published = list.filter(i => i.status === 'published');
    return {
      published: published.length,
      drafts: list.length - published.length,
      approvals: published.filter(i => !!i.approvalPolicyId).length,
      monthly: Math.round(published.reduce((sum, i) => sum + monthlyEquivalent(i), 0)),
    };
  }, [list]);

  /**
   * Filter options carry counts over the WHOLE collection, never the filtered
   * view — counting the view makes options appear to vanish as you work.
   */
  const FILTER_DEFS = useMemo(() => {
    const byCategory = optionCounts(list, i => i.categoryId);
    const byAudience = optionCounts(list, audiencesOf);
    const byStatus = optionCounts(list, i => i.status || 'draft');
    const byFulfilment = optionCounts(list, i => resolve(i).kind);
    return [
      {
        id: 'category', label: 'Category', icon: Folder,
        options: sortCategories(cats).map(c => ({
          value: c.id, label: c.name, count: byCategory.get(c.id) || 0,
        })),
      },
      {
        id: 'fulfils', label: 'Provisions', icon: Boxes,
        options: FULFIL_KINDS.map(o => ({
          value: o.value, label: o.label, count: byFulfilment.get(o.value) || 0,
        })),
      },
      {
        id: 'audience', label: 'Audience', icon: Users,
        options: AUDIENCE_TILES.map(o => ({
          value: o.value, label: o.label, count: byAudience.get(o.value) || 0,
        })),
      },
      {
        id: 'status', label: 'Status', icon: BadgeCheck,
        options: STATUS_TILES.map(o => ({
          value: o.value, label: o.label, count: byStatus.get(o.value) || 0,
        })),
      },
    ];
  }, [list, cats, resolve]);

  const filtered = useMemo(() => list.filter(i => (
    matchesQuery(i, query)
    && passes(filters.category, i.categoryId)
    && passes(filters.fulfils, resolve(i).kind)
    && passes(filters.audience, audiencesOf(i))
    && passes(filters.status, i.status || 'draft')
  )), [list, query, filters, resolve]);

  const shownCats = useMemo(
    () => sortCategories(cats).filter(c => matchesQuery(c, query)),
    [cats, query],
  );

  const groups = useMemo(() => groupByCategory(filtered, cats), [filtered, cats]);
  const fulfilGroups = useMemo(() => groupByFulfilment(filtered, resolve), [filtered, resolve]);

  const activeFilters = countActive(filters);
  const clearFilters = useCallback(() => { setFilters({}); setQuery(''); }, []);
  const filtering = itemsLens && (!!query.trim() || activeFilters > 0);

  /** How many orderable things actually hand something over. */
  const targeted = useMemo(
    () => list.filter(i => resolve(i).kind !== 'none').length,
    [list, resolve],
  );

  const lensItems = useMemo(() => LENSES.map(l => ({
    ...l,
    count: l.value === 'categories' ? cats.length : l.value === 'fulfilment' ? targeted : list.length,
  })), [list.length, cats.length, targeted]);

  /* ---------- writes ---------- */

  const saveItem = useCallback((draft) => {
    const record = {
      id: draft.id || uid('svc'),
      categoryId: draft.categoryId,
      name: draft.name.trim(),
      shortDescription: draft.shortDescription.trim(),
      description: draft.description.trim(),
      icon: draft.icon || 'Package',
      audience: draft.audience || 'internal',
      subformId: draft.subformId || '',
      knowledgeIds: draft.knowledgeIds || [],
      approvalPolicyId: draft.approvalPolicyId || null,
      fulfilmentQueueId: draft.fulfilmentQueueId || '',
      price: hasCharge(draft.price) ? Number(draft.price) : null,
      recurringPrice: hasCharge(draft.recurringPrice) ? Number(draft.recurringPrice) : null,
      recurrence: hasCharge(draft.recurringPrice) ? (draft.recurrence || 'monthly') : null,
      deliveryDays: Number.isFinite(Number(draft.deliveryDays)) ? Number(draft.deliveryDays) : 0,
      assetModelId: draft.assetModelId || null,
      popular: !!draft.popular,
      status: draft.status || 'draft',
    };
    if (draft.id) patchIn('serviceItems', draft.id, record);
    else addTo('serviceItems', record);
    setEditingItem(null);
  }, []);

  const saveCategory = useCallback((draft) => {
    const record = {
      id: draft.id || uid('svc-cat'),
      name: draft.name.trim(),
      description: draft.description.trim(),
      icon: draft.icon || 'Folder',
      audience: draft.audience || 'internal',
      order: Number.isFinite(Number(draft.order))
        ? Number(draft.order)
        : (cats.reduce((max, c) => Math.max(max, c.order ?? 0), 0) + 1),
    };
    if (draft.id) patchIn('serviceCategories', draft.id, record);
    else addTo('serviceCategories', record);
    setEditingCategory(null);
  }, [cats]);

  /**
   * Reorder by moving the record one place in the sorted list and renumbering
   * from zero. Swapping the two `order` values looks equivalent and is not: two
   * categories seeded with the same order (or none at all) swap to themselves,
   * and the arrow reports a move that did not happen. Renumbering makes the
   * positions distinct, so the next press always moves.
   *
   * Categories keep their ids, so nothing that points at a category is
   * disturbed by a move.
   */
  const moveCategory = useCallback((id, direction) => {
    const ordered = sortCategories(cats);
    const index = ordered.findIndex(c => c.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= ordered.length) return;
    const [moved] = ordered.splice(index, 1);
    ordered.splice(next, 0, moved);
    ordered.forEach((c, position) => {
      if (c.order !== position) patchIn('serviceCategories', c.id, { order: position });
    });
  }, [cats]);

  const removeRecord = useCallback((pending) => {
    if (!pending?.record) return;
    removeFrom(pending.kind === 'category' ? 'serviceCategories' : 'serviceItems', pending.record.id);
    setConfirming(null);
  }, []);

  /**
   * CREATE BESIDE ATTACH, the same as the help catalog. An admin writing a
   * service item finds the "read this before you order" gap while writing it,
   * so the atom is authored here as a TOP-LEVEL draft and referenced — never
   * nested — which is what lets the same atom deflect on another item and be a
   * lesson in a course tomorrow.
   */
  const createAtom = useCallback((title, audience) => {
    const name = String(title || '').trim();
    if (!name) return null;
    const id = uid('kb');
    addTo('knowledge', {
      id,
      title: name,
      summary: 'No summary yet.',
      format: 'article',
      body: '<p></p>',
      status: 'draft',
      audience: audience || 'internal',
      tags: [],
      ownerId: currentUser?.id || null,
      updatedAt: nowISO(),
      views: 0,
      helpfulYes: 0,
      helpfulNo: 0,
      objective: '',
      minutes: 5,
      prerequisiteIds: [],
      check: [],
    });
    return id;
  }, [currentUser]);

  const bare = cats.length === 0 && list.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* The gradient lives on the module tile and on the single primary action
          beside it — nowhere else on this screen. */}
      <ModuleHeader
        icon={ShoppingCart}
        module="catalog"
        accent={CATEGORY_HUE}
        title="Service Catalog"
        /* The subtitle always tells the truth about what is on screen: the
         * resting label when nothing narrows the list, "9 of 24 shown" when
         * something does. */
        subtitle={tab === 'categories'
          ? subsetLabel(
            shownCats.length,
            cats.length,
            plural(cats.length, 'category', 'categories'),
          )
          : tab === 'fulfilment'
            ? subsetLabel(
              filtered.length,
              list.length,
              `${targeted} of ${plural(list.length, 'item', 'items')} provision something`,
            )
            : subsetLabel(
              filtered.length,
              list.length,
              `${plural(list.length, 'orderable item', 'orderable items')} · ${totals.drafts} in draft`,
            )}
        /* The lens is centred in row 1, between the module identity and the
         * primary action, so it holds still while either of them changes width. */
        nav={<LensBar items={lensItems} value={tab} onChange={setTab} inline />}
        primary={
          tab === 'categories'
            ? (
              <Button variant="grad" module="catalog" icon={Plus} onClick={() => setEditingCategory({ category: null })}>
                New category
              </Button>
            )
            : (
              <Button
                variant="grad"
                module="catalog"
                icon={Plus}
                onClick={() => setEditingItem({ item: null, categoryId: (filters.category || [])[0] || '' })}
              >
                New service item
              </Button>
            )
        }
        filterBar={
          <FilterBar
            accent={CATEGORY_HUE}
            /* The filters narrow the ITEM list, so they are offered only on the
             * lenses they act on — a control that changes nothing on the screen
             * in front of you is worse than no control. The search field is on
             * every lens, which is why the band itself is never conditional. */
            filters={itemsLens ? FILTER_DEFS : []}
            value={filters}
            onChange={setFilters}
            onClearAll={clearFilters}
            search={
              /* Names its own scope, so it can never be mistaken for the global
               * field in the bar above. The scope moves with the lens. */
              <ScopedSearch
                value={query}
                onChange={setQuery}
                scope={tab === 'categories'
                  ? plural(cats.length, 'category', 'categories')
                  : plural(list.length, 'service item', 'service items')}
                accent={CATEGORY_HUE}
              />
            }
          />
        }
      />

      <PageBody width="max-w-6xl">
        {/* Stats are CONTENT here, not chrome: money and sign-off load are what
            an owner of this catalog is accountable for, and neither is a number
            the lens above already carries. */}
        {!bare && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              <Stat label="published items" value={totals.published} accent={ITEM_HUE} icon={BadgeCheck} />
              <Stat label="need approval" value={totals.approvals} accent={totals.approvals ? APPROVAL_HUE : 'gray'} icon={Stamp} />
              <Stat label="recurring / month" value={money(totals.monthly)} accent="lime" icon={Repeat} />
            </div>
            {/* One number over a catalog that prices some things monthly and
                some annually only means something if the normalisation is
                stated. */}
          </div>
        )}

        {bare ? (
          <EmptyState
            icon={ShoppingCart}
            title="The service catalog is empty"
            hint="Start with a category; items live inside one."
            action={
              <Button variant="solid" accent={CATEGORY_HUE} icon={Plus} onClick={() => setEditingCategory({ category: null })}>
                New category
              </Button>
            }
          />
        ) : tab === 'categories' ? (
          <CategoriesTab
            categories={shownCats}
            items={list}
            searching={!!query.trim()}
            onEdit={(category) => setEditingCategory({ category })}
            onDelete={(category) => setConfirming({ kind: 'category', record: category })}
            onMove={moveCategory}
            onNewItem={(categoryId) => setEditingItem({ item: null, categoryId })}
            onNew={() => setEditingCategory({ category: null })}
          />
        ) : tab === 'fulfilment' ? (
          <FulfilmentTab
            groups={fulfilGroups}
            queues={queues}
            policies={policies}
            resolve={resolve}
            filtering={filtering}
            onEdit={(item) => setEditingItem({ item })}
            onDelete={(item) => setConfirming({ kind: 'item', record: item })}
            onNew={(categoryId) => setEditingItem({ item: null, categoryId })}
            hasCategories={cats.length > 0}
          />
        ) : (
          <ItemsTab
            groups={groups}
            queues={queues}
            policies={policies}
            resolve={resolve}
            filtering={filtering}
            onEdit={(item) => setEditingItem({ item })}
            onDelete={(item) => setConfirming({ kind: 'item', record: item })}
            onNew={(categoryId) => setEditingItem({ item: null, categoryId })}
            hasCategories={cats.length > 0}
          />
        )}
      </PageBody>

      {editingItem && (
        <ItemEditor
          key={editingItem.item?.id || 'new-item'}
          item={editingItem.item}
          initialCategoryId={editingItem.categoryId}
          categories={sortCategories(cats)}
          queues={queues}
          subforms={subforms}
          knowledge={knowledge}
          policies={policies}
          assetModels={assetModels}
          onCreateAtom={createAtom}
          onClose={() => setEditingItem(null)}
          onSave={saveItem}
        />
      )}

      {editingCategory && (
        <CategoryEditor
          key={editingCategory.category?.id || 'new-category'}
          category={editingCategory.category}
          categories={cats}
          items={list}
          onClose={() => setEditingCategory(null)}
          onSave={saveCategory}
        />
      )}

      <ConfirmDelete
        open={!!confirming}
        name={confirming?.record?.name || ''}
        kind={confirming?.kind === 'category' ? 'category' : 'service item'}
        cascadeNote={cascadeNote(confirming, list)}
        onCancel={() => setConfirming(null)}
        onConfirm={() => removeRecord(confirming)}
      />
    </div>
  );
}

function cascadeNote(pending, items) {
  if (!pending) return '';
  if (pending.kind === 'category') {
    const held = (items || []).filter(i => i.categoryId === pending.record.id).length;
    if (!held) return 'No items point at this category.';
    return `${plural(held, 'item points', 'items point')} at this category. They become uncategorised, not deleted.`;
  }
  return 'Only this item is removed.';
}

/* ==================================================================== *
 * ITEMS TAB
 * ==================================================================== */

function ItemsTab({ groups, queues, policies, resolve, filtering, onEdit, onDelete, onNew, hasCategories }) {
  return (
    <>
      {groups.length === 0 ? (
        <EmptyState
          icon={filtering ? Search : ShoppingCart}
          title={filtering ? 'Nothing matches' : 'No service items yet'}
          hint={filtering
            ? 'Clear a filter or widen the audience.'
            : hasCategories
              ? undefined
              : 'Create a category first; every item lives inside one.'}
          action={hasCategories
            ? <Button variant="solid" accent={ITEM_HUE} icon={Plus} onClick={() => onNew('')}>New service item</Button>
            : null}
        />
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <CategoryGroup
              key={group.category.id}
              category={group.category}
              items={group.items}
              queues={queues}
              policies={policies}
              resolve={resolve}
              onEdit={onEdit}
              onDelete={onDelete}
              onNew={onNew}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ==================================================================== *
 * PROVISIONS TAB — the same items, shelved by what they hand over
 * ==================================================================== */

function FulfilmentTab({ groups, queues, policies, resolve, filtering, onEdit, onDelete, onNew, hasCategories }) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={filtering ? Search : Boxes}
        title={filtering ? 'Nothing matches' : 'No service items yet'}
        hint={filtering
          ? 'Clear a filter or widen the audience.'
          : hasCategories
            ? undefined
            : 'Create a category first; every item lives inside one.'}
        action={hasCategories
          ? <Button variant="solid" accent={ITEM_HUE} icon={Plus} onClick={() => onNew('')}>New service item</Button>
          : null}
      />
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <FulfilmentGroup
          key={group.kind.value}
          kind={group.kind}
          items={group.items}
          queues={queues}
          policies={policies}
          resolve={resolve}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function FulfilmentGroup({ kind, items, queues, policies, resolve, onEdit, onDelete }) {
  const { t } = useTheme();
  // Distinct targets, not rows: two items can order the same laptop model.
  const targets = new Set(items.map(i => resolve(i).targetId).filter(Boolean));

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <IconTile icon={kind.icon} accent={kind.hue} size="sm" />
        <div className="min-w-0">
          <h3 className={cx('text-sm font-semibold truncate', t.text)}>{kind.label}</h3>
          <p className={cx('text-[11px] tabular-nums', t.textMuted)}>
            {plural(items.length, 'item', 'items')}
            {targets.size ? ` · ${plural(targets.size, 'target', 'targets')}` : ''}
          </p>
        </div>
      </div>

      <div className={DENSITY.rowGap}>
        {items.map(item => (
          <ServiceItemRow
            key={item.id}
            item={item}
            queues={queues}
            policies={policies}
            fulfilment={resolve(item)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryGroup({ category, items, queues, policies, resolve, onEdit, onDelete, onNew }) {
  const { t } = useTheme();
  const orphaned = category.id === UNCATEGORISED.id;
  const hue = orphaned ? 'red' : CATEGORY_HUE;
  const Glyph = iconFor(category.icon);
  const aud = audienceMeta(category.audience);
  const monthly = Math.round(items.reduce((sum, i) => sum + monthlyEquivalent(i), 0));

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <IconTile icon={orphaned ? AlertCircle : Glyph} accent={hue} size="sm" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className={cx('text-sm font-semibold truncate', t.text)}>{category.name}</h3>
            {!orphaned && <Chip accent={aud.hue} icon={aud.icon}>{aud.label}</Chip>}
          </div>
          <p className={cx('text-[11px] tabular-nums', t.textMuted)}>
            {plural(items.length, 'item', 'items')}
            {monthly > 0 ? ` · ${money(monthly)} recurring a month` : ''}
          </p>
        </div>
        <span className="flex-1" />
        {!orphaned && (
          <IconButton
            icon={Plus}
            label={`New item in ${category.name}`}
            accent={ITEM_HUE}
            onClick={() => onNew(category.id)}
          />
        )}
      </div>

      {orphaned && (
        <Banner accent="red" icon={AlertCircle} title="These items point at a category that does not exist" className="mb-2">
          Open each one and pick a category, or delete it.
        </Banner>
      )}

      <div className={DENSITY.rowGap}>
        {items.map(item => (
          <ServiceItemRow
            key={item.id}
            item={item}
            queues={queues}
            policies={policies}
            fulfilment={resolve(item)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

function ServiceItemRow({ item, queues, policies, fulfilment, onEdit, onDelete }) {
  const { t } = useTheme();
  const Glyph = iconFor(item.icon);
  const aud = audienceMeta(item.audience);
  const queue = (queues || []).find(q => q.id === item.fulfilmentQueueId);
  const policy = item.approvalPolicyId
    ? (policies || []).find(p => p.id === item.approvalPolicyId)
    : null;

  return (
    <ListRow
      accent={ITEM_HUE}
      icon={Glyph}
      title={item.name || item.id}
      subtitle={item.shortDescription || 'No short description.'}
      onClick={() => onEdit(item)}
      meta={<StatusPill status={item.status || 'draft'} />}
      actions={
        <>
          <IconButton
            icon={Pencil}
            label="Edit this item"
            onClick={(ev) => { ev.stopPropagation(); onEdit(item); }}
          />
          <IconButton
            icon={Trash2}
            label="Delete this item"
            accent="red"
            onClick={(ev) => { ev.stopPropagation(); onDelete(item); }}
          />
        </>
      }
    >
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        <span className={cx('text-xs font-medium tabular-nums', t.text)}>{priceCompact(item)}</span>
        <span className={cx('inline-flex items-center gap-1 text-xs', t.textMuted)}>
          <Clock size={ICON.xs} />
          {deliveryCompact(item.deliveryDays)}
        </span>

        {/* A queue owns its hue, so the colour means the same thing here as it
            does in Business Rules and the workspace. */}
        {queue ? (
          <Chip accent={queue.hue || QUEUE_HUE} icon={Inbox} title={`Fulfilled by ${queue.name}`}>
            {queue.name}
          </Chip>
        ) : (
          <Chip accent="amber" icon={AlertCircle} title="No fulfilment queue — nobody owns this work">
            No fulfilment queue
          </Chip>
        )}

        <FulfilChips fulfilment={fulfilment} />

        {item.approvalPolicyId && (
          policy
            ? (
              <Chip accent={APPROVAL_HUE} icon={Stamp} title={`Approval required — ${policy.name}`}>
                {policy.name}
              </Chip>
            )
            : (
              <Chip accent="red" icon={AlertCircle} title={`Policy ${item.approvalPolicyId} not found`}>
                Policy not found
              </Chip>
            )
        )}

        <Chip accent={aud.hue} icon={aud.icon}>{aud.label}</Chip>
        {item.popular && <Chip accent="amber" icon={Star}>Popular</Chip>}
      </div>
    </ListRow>
  );
}

/**
 * What ordering hands over, on the row: the model, or the licence and where it
 * stands on seats. An item with no target renders nothing here — it is a
 * service request all the same, and an absence is not a state worth a chip.
 */
function FulfilChips({ fulfilment }) {
  if (!fulfilment || fulfilment.kind === 'none') return null;

  if (fulfilment.missing) {
    return (
      <Chip accent="red" icon={AlertCircle} title={`${fulfilment.targetId} is not in the assets list`}>
        Target not found
      </Chip>
    );
  }

  if (fulfilment.kind === 'hardware') {
    return (
      <Chip accent={ASSET_HUE} icon={Monitor} title="Ordering provisions this model">
        {modelLabel(fulfilment.model)}
      </Chip>
    );
  }

  const seats = seatPosition(fulfilment.licence);
  const label = seatLabel(seats);
  return (
    <>
      <Chip accent={LICENCE_HUE} icon={Key} title="Ordering provisions a seat on this licence">
        {licenceLabel(fulfilment.licence)}
      </Chip>
      {label && (
        <Chip accent={seatAccent(seats)} icon={Users} title="Seats owned against seats allocated">
          {label}
        </Chip>
      )}
    </>
  );
}

/* ==================================================================== *
 * CATEGORIES TAB
 * ==================================================================== */

function CategoriesTab({ categories, items, searching, onEdit, onDelete, onMove, onNewItem, onNew }) {
  if (!categories.length) {
    return (
      <EmptyState
        icon={searching ? Search : Folder}
        title={searching ? 'No category matches' : 'No categories yet'}
        hint={searching
          ? 'Clear the search to see every category.'
          : undefined}
        action={searching
          ? null
          : <Button variant="solid" accent={CATEGORY_HUE} icon={Plus} onClick={onNew}>New category</Button>}
      />
    );
  }

  return (
    <div className={DENSITY.rowGap}>
      {/* Reordering is hidden while a search narrows the list: the arrows move a
          shelf one place in the REAL order, and next to a filtered list they
          would appear to jump it past rows that are merely hidden. */}
      {categories.map((category, index) => (
        <CategoryRow
          key={category.id}
          category={category}
          held={items.filter(i => i.categoryId === category.id)}
          reorderable={!searching}
          first={index === 0}
          last={index === categories.length - 1}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          onNewItem={onNewItem}
        />
      ))}
    </div>
  );
}

function CategoryRow({ category, held, reorderable, first, last, onEdit, onDelete, onMove, onNewItem }) {
  const { t } = useTheme();
  const Glyph = iconFor(category.icon);
  const aud = audienceMeta(category.audience);
  const published = held.filter(i => i.status === 'published').length;

  return (
    <ListRow
      accent={CATEGORY_HUE}
      icon={Glyph}
      title={category.name || category.id}
      subtitle={category.description || 'No description.'}
      onClick={() => onEdit(category)}
      meta={
        <>
          <span className={cx('text-xs tabular-nums', t.textMuted)}>
            {plural(held.length, 'item', 'items')} · {published} published
          </span>
          <Chip accent={aud.hue} icon={aud.icon}>{aud.label}</Chip>
          {reorderable && (
            <>
              <IconButton
                icon={ArrowUp}
                label="Move up"
                disabled={first}
                className={first ? 'opacity-30 pointer-events-none' : undefined}
                onClick={(ev) => { ev.stopPropagation(); onMove(category.id, -1); }}
              />
              <IconButton
                icon={ArrowDown}
                label="Move down"
                disabled={last}
                className={last ? 'opacity-30 pointer-events-none' : undefined}
                onClick={(ev) => { ev.stopPropagation(); onMove(category.id, 1); }}
              />
            </>
          )}
        </>
      }
      actions={
        <>
          <IconButton
            icon={Plus}
            label={`New item in ${category.name}`}
            accent={ITEM_HUE}
            onClick={(ev) => { ev.stopPropagation(); onNewItem(category.id); }}
          />
          <IconButton
            icon={Pencil}
            label="Edit this category"
            onClick={(ev) => { ev.stopPropagation(); onEdit(category); }}
          />
          <IconButton
            icon={Trash2}
            label="Delete this category"
            accent="red"
            onClick={(ev) => { ev.stopPropagation(); onDelete(category); }}
          />
        </>
      }
    >
      {/* Chips carry VALUES: the item names themselves, with an overflow badge.
          The count lives in the meta text, where a number belongs. */}
      <div className="mt-1">
        <ChipGroup
          accent={ITEM_HUE}
          icon={ShoppingCart}
          max={3}
          items={held}
          render={(i) => i.name || i.id}
          empty={<Chip accent="gray">No items yet</Chip>}
        />
      </div>
    </ListRow>
  );
}

/* ==================================================================== *
 * ITEM EDITOR
 *
 * One modal covering the whole ServiceItem shape, sectioned as the five
 * questions an admin actually has to answer.
 * ==================================================================== */

function blankItem(categoryId, categories) {
  return {
    id: null,
    categoryId: categoryId || categories[0]?.id || '',
    name: '',
    shortDescription: '',
    description: '',
    icon: 'Package',
    audience: 'internal',
    subformId: '',
    knowledgeIds: [],
    approvalPolicyId: '',
    fulfilmentQueueId: '',
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 3,
    assetModelId: '',
    popular: false,
    status: 'draft',
  };
}

function ItemEditor({
  item, initialCategoryId, categories, queues, subforms, knowledge, policies,
  assetModels, onCreateAtom, onClose, onSave,
}) {
  const { t } = useTheme();
  // Every text field is coerced to a string on the way in. A record authored
  // elsewhere may be missing a field the editor calls .trim() on, and an editor
  // that throws on a half-written record is worse than one that shows it blank.
  const [draft, setDraft] = useState(() => (
    item
      ? {
        ...blankItem(item.categoryId, categories),
        ...item,
        name: item.name || '',
        shortDescription: item.shortDescription || '',
        description: item.description || '',
        icon: item.icon || 'Package',
        audience: item.audience || 'internal',
        status: item.status || 'draft',
        knowledgeIds: [...(item.knowledgeIds || [])],
        approvalPolicyId: item.approvalPolicyId || '',
        assetModelId: item.assetModelId || '',
        subformId: item.subformId || '',
        fulfilmentQueueId: item.fulfilmentQueueId || '',
      }
      : blankItem(initialCategoryId, categories)
  ));

  const patch = useCallback((p) => setDraft(d => ({ ...d, ...p })), []);

  const ready = draft.name.trim().length > 0 && !!draft.categoryId;
  const footerNote = !draft.name.trim()
    ? 'A name is required.'
    : !draft.categoryId
      ? 'Pick a category.'
      : commercialLine(draft);

  return (
    <Modal
      open
      onClose={onClose}
      accent={ITEM_HUE}
      icon={iconFor(draft.icon)}
      size="modalLg"
      title={item ? draft.name || 'Service item' : 'New service item'}
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>{footerNote}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent={ITEM_HUE} disabled={!ready} onClick={() => ready && onSave(draft)}>
              {item ? 'Save item' : 'Create item'}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-3">
        <EditorBasics draft={draft} onPatch={patch} categories={categories} />
        <EditorCommercials draft={draft} onPatch={patch} />
        <EditorFulfilment draft={draft} onPatch={patch} queues={queues} policies={policies} />
        <EditorRequestForm draft={draft} onPatch={patch} subforms={subforms} queues={queues} />
        <EditorKnowledge draft={draft} onPatch={patch} knowledge={knowledge} onCreateAtom={onCreateAtom} />
        <EditorProvisions draft={draft} onPatch={patch} assetModels={assetModels} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * 1 — what is it
 * ------------------------------------------------------------------ */

function EditorBasics({ draft, onPatch, categories }) {
  return (
    <Panel
      icon={iconFor(draft.icon)}
      accent={ITEM_HUE}
      title="What it is"
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Field label="Name" required>
          <Input
            autoFocus
            accent={ITEM_HUE}
            value={draft.name}
            placeholder="e.g. New laptop"
            onChange={(ev) => onPatch({ name: ev.target.value })}
          />
        </Field>

        <Field label="Short description" hint="One line, shown on the catalog card.">
          <Input
            accent={ITEM_HUE}
            value={draft.shortDescription}
            placeholder="e.g. A standard-issue machine, configured and shipped to you"
            onChange={(ev) => onPatch({ shortDescription: ev.target.value })}
          />
        </Field>

        <Field label="Full description" hint="Shown on the request screen, under the name.">
          <Textarea
            accent={ITEM_HUE}
            rows={3}
            value={draft.description}
            placeholder="What is included, what is not, and anything the requester should decide before starting."
            onChange={(ev) => onPatch({ description: ev.target.value })}
          />
        </Field>

        <Field label="Icon">
          <TileGroup
            value={draft.icon}
            onChange={(value) => onPatch({ icon: value })}
            options={iconOptions(draft.icon, ITEM_HUE)}
            columns={6}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required hint={categories.length ? undefined : 'No categories exist yet.'}>
            <Select
              accent={CATEGORY_HUE}
              value={draft.categoryId}
              onChange={(ev) => onPatch({ categoryId: ev.target.value })}
              placeholder="Choose a category…"
              options={categories.map(c => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Status">
            <TileGroup
              value={draft.status}
              onChange={(value) => onPatch({ status: value })}
              options={STATUS_TILES}
              columns={2}
            />
          </Field>
        </div>

        <Field label="Audience" hint="Decides which portal shows it.">
          <TileGroup
            value={draft.audience}
            onChange={(value) => onPatch({ audience: value })}
            options={AUDIENCE_TILES}
            columns={3}
          />
        </Field>

        <Toggle
          checked={!!draft.popular}
          onChange={(value) => onPatch({ popular: value })}
          accent="amber"
          label="Feature this in the portal’s popular row"
        />
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 2 — what it costs
 * ------------------------------------------------------------------ */

function EditorCommercials({ draft, onPatch }) {
  const { t } = useTheme();
  const recurring = hasCharge(draft.recurringPrice);

  return (
    <Panel
      icon={Coins}
      accent="lime"
      title="Commercials"
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="One-off price" hint="Leave blank when there is no up-front charge.">
            <Input
              accent="lime"
              type="number"
              min="0"
              value={draft.price ?? ''}
              placeholder="0"
              onChange={(ev) => onPatch({ price: numberOrNull(ev.target.value) })}
            />
          </Field>
          <Field label="Recurring price">
            <Input
              accent="lime"
              type="number"
              min="0"
              value={draft.recurringPrice ?? ''}
              placeholder="0"
              onChange={(ev) => {
                const value = numberOrNull(ev.target.value);
                onPatch({
                  recurringPrice: value,
                  recurrence: value == null ? null : (draft.recurrence || 'monthly'),
                });
              }}
            />
          </Field>
          <Field label="Recurrence" hint={recurring ? undefined : 'Set a recurring price first.'}>
            <Select
              accent="lime"
              value={draft.recurrence || ''}
              disabled={!recurring}
              onChange={(ev) => onPatch({ recurrence: ev.target.value || null })}
              placeholder="No recurring charge"
              options={RECURRENCE_OPTIONS}
            />
          </Field>
        </div>

        <Field label="Delivery" hint="Working days. Zero means same day.">
          <div className="w-32">
            <Input
              accent="lime"
              type="number"
              min="0"
              value={draft.deliveryDays ?? 0}
              onChange={(ev) => onPatch({ deliveryDays: numberOrZero(ev.target.value) })}
            />
          </div>
        </Field>

        {/* The sentence the requester will actually read, assembled from the
            three fields above so an author never has to imagine it. */}
        <Card className={cx(DENSITY.cardPad, 'flex items-center gap-3')}>
          <IconTile icon={Clock} accent="lime" size="sm" />
          <div className="min-w-0">
            <GroupLabel>The portal will say</GroupLabel>
            <p className={cx('text-sm mt-0.5', t.text)}>{commercialLine(draft)}</p>
          </div>
        </Card>
      </div>
    </Panel>
  );
}

function numberOrNull(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function numberOrZero(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ------------------------------------------------------------------ *
 * 3 — who fulfils it, and what has to be signed off
 * ------------------------------------------------------------------ */

function EditorFulfilment({ draft, onPatch, queues, policies }) {
  const { t } = useTheme();
  const queue = (queues || []).find(q => q.id === draft.fulfilmentQueueId);
  const general = (queues || []).find(q => q.id === Q.GENERAL);
  const policy = draft.approvalPolicyId
    ? (policies || []).find(p => p.id === draft.approvalPolicyId)
    : null;

  /**
   * When no policy is chosen, check whether one WOULD have matched on this
   * item's price. The suggestion is offered, never applied — a threshold policy
   * silently attaching itself is exactly the behaviour this screen refuses.
   */
  const wouldMatch = !draft.approvalPolicyId && hasCharge(draft.price)
    ? matchingPolicies(policies, { answers: { amount: Number(draft.price) } })
    : [];

  return (
    <Panel
      icon={Inbox}
      accent={QUEUE_HUE}
      title="Fulfilment"
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Field label="Fulfilment queue" hint="The team that owns delivering this.">
          <Select
            accent={QUEUE_HUE}
            value={draft.fulfilmentQueueId}
            onChange={(ev) => onPatch({ fulfilmentQueueId: ev.target.value })}
            placeholder="Choose a queue…"
            options={(queues || []).map(q => ({ value: q.id, label: q.name }))}
          />
        </Field>

        {queue ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Chip accent={queue.hue || QUEUE_HUE} icon={Inbox}>{queue.name}</Chip>
            <span className={cx('text-xs', t.textMuted)}>{queue.description || queue.inbox || ''}</span>
          </div>
        ) : (
          <Banner accent="amber" icon={AlertCircle} title="No queue owns this yet">
            Orders land in <strong className={t.text}>{labelOf(general, 'General')}</strong> until a queue is chosen.
          </Banner>
        )}

        <Divider />

        <Field label="Approval policy">
          <Select
            accent={APPROVAL_HUE}
            value={draft.approvalPolicyId}
            onChange={(ev) => onPatch({ approvalPolicyId: ev.target.value })}
            placeholder="No approval — fulfil immediately"
            options={(policies || []).map(p => ({ value: p.id, label: p.name }))}
          />
        </Field>

        {draft.approvalPolicyId && !policy && (
          <Banner accent="red" icon={AlertCircle} title="That policy no longer exists">
            This item points at <strong className={t.text}>{draft.approvalPolicyId}</strong>, which is not in the
            policy list. Pick a real policy, or clear the field.
          </Banner>
        )}

        {policy && <PolicyExplainer policy={policy} />}

        {!draft.approvalPolicyId && (
          <Banner accent="blue" icon={Stamp} title="No sign-off — this is fulfilled as soon as it is requested" />
        )}

        {wouldMatch.length > 0 && (
          <Banner accent="amber" icon={AlertCircle} title="A policy exists that matches this price">
            <ChipGroup
              accent={APPROVAL_HUE}
              icon={Stamp}
              max={3}
              items={wouldMatch}
              render={(p) => p.name}
            />
          </Banner>
        )}
      </div>
    </Panel>
  );
}

/**
 * The policy, in plain language: when it applies (summarize() over the same
 * condition tree the rules engine evaluates) and who decides, stage by stage.
 * An admin should never have to open Business Rules to know what they just
 * attached.
 */
function PolicyExplainer({ policy }) {
  const { t } = useTheme();
  const stages = policy.stages || [];

  return (
    <Card className={cx(DENSITY.cardPad, 'space-y-3')}>
      <div className="flex items-start gap-3">
        <IconTile icon={Stamp} accent={APPROVAL_HUE} size="sm" />
        <div className="min-w-0">
          <p className={cx('text-sm font-medium', t.text)}>{policy.name}</p>
          {policy.description && <p className={cx('text-xs mt-0.5', t.textSecondary)}>{policy.description}</p>}
        </div>
      </div>

      <div>
        <GroupLabel>Applies when</GroupLabel>
        <p className={cx('text-xs mt-1', t.textSecondary)}>{summarize(policy.appliesWhen)}</p>
      </div>

      <div>
        <GroupLabel>{plural(stages.length, 'stage', 'stages')}, in order</GroupLabel>
        {stages.length === 0 ? (
          <p className={cx('text-xs mt-1', t.textSecondary)}>
            This policy has no stages, so it approves the moment it starts.
          </p>
        ) : (
          <ol className="mt-1.5 space-y-1.5">
            {stages.map((stage, i) => (
              <li key={stage.id || i} className="flex items-start gap-2">
                <span className={cx('text-[10px] font-semibold tabular-nums mt-0.5 w-4 flex-shrink-0', t.textMuted)}>
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cx('text-xs font-medium block', t.text)}>{stage.name || `Stage ${i + 1}`}</span>
                  <span className={cx('text-[11px] block', t.textMuted)}>{stageRuleLabel(stage)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className={cx('text-[11px]', t.textMuted)}>
        {(policy.onReject || 'stop') === 'stop'
          ? 'Any rejection stops the request.'
          : 'A rejection is recorded but the request continues.'}
      </p>
    </Card>
  );
}

function stageRuleLabel(stage) {
  const meta = STAGE_RULES.find(r => r.rule === (stage.rule || 'all'));
  const base = meta
    ? (stage.rule === 'quorum' ? `${stage.quorum || 1} of the approvers must approve` : meta.label)
    : 'Everyone must approve';
  const due = Number(stage.dueInHours);
  return Number.isFinite(due) && due > 0 ? `${base} · due in ${plural(due, 'hour', 'hours')}` : base;
}

/* ------------------------------------------------------------------ *
 * 4 — what we ask for
 * ------------------------------------------------------------------ */

function EditorRequestForm({ draft, onPatch, subforms, queues }) {
  const { t } = useTheme();
  const subform = (subforms || []).find(s => s.id === draft.subformId);
  const routed = subform?.routing?.queueId
    ? (queues || []).find(q => q.id === subform.routing.queueId)
    : null;
  const general = (queues || []).find(q => q.id === Q.GENERAL);

  return (
    <Panel
      icon={FileQuestion}
      accent={FORM_HUE}
      title="Request form"
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Field label="Intake" hint="Built in Forms.">
          <Select
            accent={FORM_HUE}
            value={draft.subformId}
            onChange={(ev) => onPatch({ subformId: ev.target.value })}
            placeholder="No request form"
            options={(subforms || []).map(s => ({
              value: s.id,
              label: `${s.name} · ${plural((s.fields || []).length, 'field', 'fields')}`,
            }))}
          />
        </Field>

        {draft.subformId && !subform && (
          <Banner accent="red" icon={AlertCircle} title="That form no longer exists">
            This item points at <strong className={t.text}>{draft.subformId}</strong>, which is not in the form list.
            Pick a real intake, or clear the field.
          </Banner>
        )}

        {subform && (
          <Card className={cx(DENSITY.cardPad, 'flex items-start gap-3')}>
            <IconTile icon={FileQuestion} accent={FORM_HUE} size="sm" />
            <div className="flex-1 min-w-0">
              <p className={cx('text-sm font-medium truncate', t.text)}>{subform.name}</p>
              <p className={cx('text-xs', t.textSecondary)}>
                {subform.description || 'No description on the form.'}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className={cx('text-xs tabular-nums', t.textMuted)}>
                  {plural((subform.fields || []).length, 'field', 'fields')}
                </span>
                {routed ? (
                  <Chip accent={routed.hue || QUEUE_HUE} icon={Inbox} title={`Questions route to ${routed.name}`}>
                    {routed.name}
                  </Chip>
                ) : (
                  <Chip accent="amber" icon={AlertCircle} title="No routing rule on this form">
                    {labelOf(general, 'General')} (unrouted)
                  </Chip>
                )}
                <ChipGroup
                  accent={FORM_HUE}
                  icon={Layers}
                  max={3}
                  items={(subform.fields || []).filter(f => f.required)}
                  render={(f) => f.label}
                  empty={<Chip accent="gray">No required fields</Chip>}
                />
              </div>
            </div>
          </Card>
        )}

        {!draft.subformId && (
          <Banner accent="amber" icon={AlertCircle} title="Without a form, nobody can order this">
            Attach an intake built in Forms.
          </Banner>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 5a — what to read first
 * ------------------------------------------------------------------ */

function EditorKnowledge({ draft, onPatch, knowledge, onCreateAtom }) {
  const { t } = useTheme();
  const [newTitle, setNewTitle] = useState('');

  const attached = (draft.knowledgeIds || []).map(id => ({
    id,
    record: (knowledge || []).find(k => k.id === id) || null,
  }));
  const attachedIds = new Set(draft.knowledgeIds || []);
  const available = (knowledge || []).filter(k => !attachedIds.has(k.id));

  const link = (id) => {
    if (!id || attachedIds.has(id)) return;
    onPatch({ knowledgeIds: [...(draft.knowledgeIds || []), id] });
  };

  const detach = (id) => {
    onPatch({ knowledgeIds: (draft.knowledgeIds || []).filter(x => x !== id) });
  };

  const createAndLink = () => {
    const id = onCreateAtom(newTitle, draft.audience);
    if (!id) return;
    setNewTitle('');
    link(id);
  };

  return (
    <Panel
      icon={BookOpen}
      accent={KB_HUE}
      title="Before you order"
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        {attached.length === 0 ? (
          <p className={cx('text-xs', t.textMuted)}>Nothing attached.</p>
        ) : (
          <div className={cx('rounded-xl border divide-y', t.borderLight, t.divide)}>
            {attached.map(({ id, record }) => (
              <KnowledgeRow key={id} id={id} record={record} onDetach={() => detach(id)} />
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 flex-wrap">
          <Field label="Attach an atom that exists" className="flex-1 min-w-[16rem]">
            {/* An action select: it never holds a value, it performs the link
                and snaps back to the placeholder. */}
            <Select
              accent={KB_HUE}
              value=""
              onChange={(ev) => link(ev.target.value)}
              placeholder={available.length ? 'Choose an article or guide…' : 'Everything is already attached'}
              options={available.map(k => ({ value: k.id, label: `${k.title} · ${statusMeta(k.status).label}` }))}
            />
          </Field>
        </div>

        <Divider />

        <div className="flex items-end gap-2 flex-wrap">
          <Field
            label="Or write the missing one now"
            hint="Created as a draft in Knowledge and linked here."
            className="flex-1 min-w-[16rem]"
          >
            <Input
              accent={KB_HUE}
              value={newTitle}
              placeholder={`e.g. What ships with a ${draft.name || 'new order'}`}
              onChange={(ev) => setNewTitle(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); createAndLink(); } }}
            />
          </Field>
          <Button
            variant="soft"
            accent={KB_HUE}
            icon={Plus}
            disabled={!newTitle.trim()}
            onClick={createAndLink}
          >
            Create draft
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function KnowledgeRow({ id, record, onDetach }) {
  const { t, a } = useTheme();
  const guide = record?.format === 'guide';
  const hue = record ? (guide ? GUIDE_HUE : KB_HUE) : 'red';
  const Glyph = record ? (guide ? LayoutGrid : BookOpen) : AlertCircle;

  return (
    <div className={cx('flex items-center gap-3', DENSITY.rowPad)}>
      <Glyph size={ICON.base} className={cx(a(hue).fg, 'flex-shrink-0')} />
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm truncate', t.text)}>{record ? record.title : id}</p>
        {record?.summary && <p className={cx('text-xs truncate', t.textMuted)}>{record.summary}</p>}
      </div>
      {record
        ? <StatusPill status={record.status || 'draft'} />
        : <Chip accent="red" icon={AlertCircle}>Atom not found</Chip>}
      <IconButton icon={X} label="Detach from this item" onClick={onDetach} />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 5b — what ordering provisions
 * ------------------------------------------------------------------ */

function EditorProvisions({ draft, onPatch, assetModels }) {
  const { t } = useTheme();
  const model = (assetModels || []).find(m => m.id === draft.assetModelId);

  return (
    <Panel
      icon={Server}
      accent={ASSET_HUE}
      title="Provisions"
    >
      <div className={cx(DENSITY.cardPad, 'space-y-3')}>
        <Field label="Asset model" hint="Optional.">
          <Select
            accent={ASSET_HUE}
            value={draft.assetModelId}
            onChange={(ev) => onPatch({ assetModelId: ev.target.value })}
            placeholder="Ordering this creates no asset record"
            options={(assetModels || []).map(m => ({
              value: m.id,
              label: `${m.manufacturer ? m.manufacturer + ' ' : ''}${m.name}`,
            }))}
          />
        </Field>

        {draft.assetModelId && !model && (
          <Banner accent="red" icon={AlertCircle} title="That model no longer exists">
            This item points at <strong className={t.text}>{draft.assetModelId}</strong>, which is not in the asset
            model list. Pick a real model, or clear the field.
          </Banner>
        )}

        {model && (
          <Card className={cx(DENSITY.cardPad, 'flex items-start gap-3')}>
            <IconTile icon={Server} accent={ASSET_HUE} size="sm" />
            <div className="flex-1 min-w-0">
              <p className={cx('text-sm font-medium truncate', t.text)}>
                {model.manufacturer ? `${model.manufacturer} ${model.name}` : model.name}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                {model.category && <Chip accent={ASSET_HUE} icon={Package}>{model.category}</Chip>}
                {hasCharge(model.defaults?.cost) && (
                  <span className={cx('text-xs tabular-nums', t.textMuted)}>
                    list {money(model.defaults.cost)}
                    {hasCharge(draft.price) && Number(draft.price) !== Number(model.defaults.cost)
                      ? ` · this item charges ${money(draft.price)}`
                      : ''}
                  </span>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </Panel>
  );
}

/* ==================================================================== *
 * CATEGORY EDITOR
 * ==================================================================== */

function blankCategory(categories) {
  return {
    id: null,
    name: '',
    description: '',
    icon: 'Folder',
    audience: 'internal',
    order: (categories || []).reduce((max, c) => Math.max(max, c.order ?? 0), 0) + 1,
  };
}

function CategoryEditor({ category, categories, items, onClose, onSave }) {
  const { t } = useTheme();
  const [draft, setDraft] = useState(() => (
    category
      ? {
        ...blankCategory(categories),
        ...category,
        name: category.name || '',
        description: category.description || '',
        icon: category.icon || 'Folder',
        audience: category.audience || 'internal',
        order: Number.isFinite(Number(category.order)) ? Number(category.order) : 0,
      }
      : blankCategory(categories)
  ));

  const patch = (p) => setDraft(d => ({ ...d, ...p }));
  const ready = draft.name.trim().length > 0;
  const held = category ? (items || []).filter(i => i.categoryId === category.id) : [];

  return (
    <Modal
      open
      onClose={onClose}
      accent={CATEGORY_HUE}
      icon={iconFor(draft.icon)}
      size="modalMd"
      title={category ? draft.name || 'Category' : 'New category'}
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            {ready ? `Position ${draft.order} · ${plural(held.length, 'item', 'items')}` : 'A name is required.'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="solid" accent={CATEGORY_HUE} disabled={!ready} onClick={() => ready && onSave(draft)}>
              {category ? 'Save category' : 'Create category'}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input
            autoFocus
            accent={CATEGORY_HUE}
            value={draft.name}
            placeholder="e.g. Hardware"
            onChange={(ev) => patch({ name: ev.target.value })}
          />
        </Field>

        <Field label="Description" hint="One line under the category heading in the portal.">
          <Textarea
            accent={CATEGORY_HUE}
            rows={2}
            value={draft.description}
            placeholder="e.g. Laptops, monitors, headsets and phones — everything you can be issued."
            onChange={(ev) => patch({ description: ev.target.value })}
          />
        </Field>

        <Field label="Icon">
          <TileGroup
            value={draft.icon}
            onChange={(value) => patch({ icon: value })}
            options={iconOptions(draft.icon, CATEGORY_HUE)}
            columns={6}
          />
        </Field>

        <Field label="Audience" hint="A category hidden from customers hides regardless of what its items say.">
          <TileGroup
            value={draft.audience}
            onChange={(value) => patch({ audience: value })}
            options={AUDIENCE_TILES}
            columns={3}
          />
        </Field>

        <Field label="Order" hint="Lower sorts first.">
          <div className="w-32">
            <Input
              accent={CATEGORY_HUE}
              type="number"
              min="0"
              value={draft.order ?? 0}
              onChange={(ev) => patch({ order: numberOrZero(ev.target.value) })}
            />
          </div>
        </Field>

        {category && (
          <Card className={cx(DENSITY.cardPad, 'space-y-2')}>
            <GroupLabel>{plural(held.length, 'item on this shelf', 'items on this shelf')}</GroupLabel>
            <ChipGroup
              accent={ITEM_HUE}
              icon={ShoppingCart}
              max={6}
              items={held}
              render={(i) => i.name || i.id}
              empty={<span className={cx('text-xs', t.textMuted)}>Nothing here yet.</span>}
            />
          </Card>
        )}
      </div>
    </Modal>
  );
}
