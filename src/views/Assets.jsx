import React, { useMemo, useState } from 'react';
import {
  Server, Monitor, Key, MapPin, FileSignature, Laptop, Smartphone, Printer,
  Network, Tablet, HardDrive, Package, PackageOpen, ArrowRightLeft, User,
  Building2, Warehouse, Home, AlertTriangle, AlertCircle, CalendarClock,
  Scale, Trash2, ChevronRight, Plus, Wrench, History, ShieldCheck,
  ShieldAlert, TrendingDown, Layers, Tag, Link2, Recycle, Gauge,
  CircleDollarSign, LogOut, LogIn, Users, Boxes,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, LAYOUT, GRADIENT,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, EntityTag, Avatar,
  EmptyState, Card, Panel, Section, GroupLabel, ListRow, Banner, Divider,
  Field, Input, Select, Textarea, TileGroup,
  Modal,
  SubTabs, ViewSwitcher, PageBody,
  ModuleHeader, ScopedSearch, FilterToggle, FilterTray, subsetLabel, optionCounts, passes,
} from '@/ds';
import { useStore, patchIn, uid, NOW } from '@/store/store.js';
import { navigate } from '@/lib/router.js';

/**
 * Assets — hardware, software licensing, locations and vendor contracts.
 *
 * THE TWO IDEAS THIS MODULE IS BUILT AROUND
 *
 * 1. MODEL vs ASSET. A model is the kind of thing ("MacBook Pro 14 (M3 Pro)",
 *    Apple, laptop, 36-month warranty by default). An asset is one instance of
 *    it with its own asset tag and serial. Snipe-IT gets this right and every
 *    spreadsheet-based estate gets it wrong, which is why the same laptop ends
 *    up under four different names.
 *
 * 2. USED BY vs RESPONSIBLE FOR. An asset is assigned to EITHER a person OR a
 *    place — a laptop belongs to Devon, the copy-room printer belongs to the
 *    Chicago office and to nobody in particular. Separately, somebody is
 *    RESPONSIBLE for it (`managedById`, inherited from the model unless the
 *    asset overrides it). Facilities owns print; IT owns endpoints; the
 *    infrastructure engineer owns the cage. Both are shown, always, because
 *    collapsing them is how an estate loses track of who to call.
 *
 * The Compliance tab is the payoff: seats owned minus seats actually allocated,
 * priced, sorted by exposure. That single screen is what a SAM tool is for.
 */

/* ------------------------------------------------------------------ *
 * Static maps
 * ------------------------------------------------------------------ */

const TABS = [
  { value: 'hardware',   label: 'Hardware',   icon: Monitor,       accent: 'cyan' },
  { value: 'software',   label: 'Software',   icon: Key,           accent: 'pink' },
  { value: 'locations',  label: 'Locations',  icon: MapPin,        accent: 'emerald' },
  { value: 'contracts',  label: 'Contracts',  icon: FileSignature, accent: 'lime' },
  { value: 'compliance', label: 'Compliance', icon: Scale,         accent: 'amber' },
];

const CATEGORY = {
  laptop:  { label: 'Laptop',  plural: 'Laptops',  icon: Laptop },
  phone:   { label: 'Phone',   plural: 'Phones',   icon: Smartphone },
  monitor: { label: 'Monitor', plural: 'Monitors', icon: Monitor },
  network: { label: 'Network', plural: 'Network',  icon: Network },
  server:  { label: 'Server',  plural: 'Servers',  icon: Server },
  printer: { label: 'Printer', plural: 'Printers', icon: Printer },
  tablet:  { label: 'Tablet',  plural: 'Tablets',  icon: Tablet },
};

function categoryMeta(key) {
  return CATEGORY[key] || { label: key || 'Other', plural: 'Other', icon: HardDrive };
}

const LOCATION_TYPE = {
  region:     { label: 'Region',      icon: Layers,    accent: 'slate' },
  office:     { label: 'Office',      icon: Building2, accent: 'emerald' },
  warehouse:  { label: 'Warehouse',   icon: Warehouse, accent: 'amber' },
  datacenter: { label: 'Data centre', icon: Server,    accent: 'cyan' },
  remote:     { label: 'Remote',      icon: Home,      accent: 'violet' },
};

function locationTypeMeta(key) {
  return LOCATION_TYPE[key] || { label: key || 'Site', icon: MapPin, accent: 'emerald' };
}

const CONTRACT_TYPE = {
  software_subscription: 'Software subscription',
  hardware_maintenance: 'Hardware maintenance',
  support: 'Support',
  service: 'Service',
  lease: 'Lease',
};

const LICENSE_MODEL = {
  per_seat:   { label: 'Per seat',   hint: 'One seat per named person' },
  per_device: { label: 'Per device', hint: 'One licence per machine, not per person' },
  concurrent: { label: 'Concurrent', hint: 'N people may use it at the same time' },
  site:       { label: 'Site',       hint: 'Unlimited within the organisation' },
};

/** How the licence is bought. Never render the raw enum — it leaks lowercase. */
const LICENSE_TERM = {
  subscription: 'Subscription',
  perpetual:    'Perpetual',
};

function licenseTerm(key) {
  return LICENSE_TERM[key] || key;
}

const ACTION = {
  received: { label: 'Received into stock', icon: PackageOpen,     hue: 'blue' },
  checkout: { label: 'Checked out',         icon: LogOut,          hue: 'emerald' },
  checkin:  { label: 'Checked in',          icon: LogIn,           hue: 'blue' },
  transfer: { label: 'Transferred',         icon: ArrowRightLeft,  hue: 'violet' },
  repair:   { label: 'Sent for repair',     icon: Wrench,          hue: 'amber' },
  retire:   { label: 'Retired',             icon: Recycle,         hue: 'gray' },
  lost:     { label: 'Reported lost',       icon: AlertTriangle,   hue: 'red' },
};

const POSITION = {
  compliant: { label: 'Compliant',     hue: 'emerald' },
  over:      { label: 'Over-deployed', hue: 'red' },
  under:     { label: 'Under-used',    hue: 'amber' },
  site:      { label: 'Site licence',  hue: 'slate' },
};

/* Assignment, warranty and renewal are all MULTI-SELECT now. "Unassigned or
 * shared" and "expired or expiring" are the questions an estate review actually
 * asks, and a single-select control could not express either of them. There is
 * no "all" option in any of these lists: an empty selection already means
 * everything, so an explicit one would be a second way to say nothing. */
const ASSIGNMENT_OPTIONS = [
  { value: 'person',     label: 'Assigned to a person' },
  { value: 'location',   label: 'Assigned to a place (shared)' },
  { value: 'unassigned', label: 'Unassigned' },
];

const WARRANTY_OPTIONS = [
  { value: 'expired', label: 'Warranty expired' },
  { value: 'soon',    label: 'Expiring in 90 days' },
  { value: 'covered', label: 'In warranty' },
  { value: 'unknown', label: 'No warranty on file' },
];

const RENEWAL_OPTIONS = [
  { value: 'd30',     label: 'Renews in 30 days' },
  { value: 'd90',     label: 'Renews in 90 days' },
  { value: 'expired', label: 'Renewal date passed' },
  { value: 'later',   label: 'Renews later' },
  { value: 'none',    label: 'No renewal date' },
];

const GROUP_OPTIONS = [
  { value: 'none',     label: 'No grouping' },
  { value: 'status',   label: 'Status' },
  { value: 'location', label: 'Location' },
  { value: 'category', label: 'Category' },
  { value: 'model',    label: 'Model' },
];

/* ------------------------------------------------------------------ *
 * Small pure helpers
 * ------------------------------------------------------------------ */

const DAY_MS = 86400000;

function daysUntil(date) {
  if (!date) return null;
  return Math.round((new Date(`${date}T00:00:00`) - NOW) / DAY_MS);
}

function fmtDate(date) {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMoney(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function today() {
  return NOW.toISOString().slice(0, 10);
}

function byId(list, id) {
  return (list || []).find(r => r.id === id) || null;
}

function personName(directory, id) {
  return byId(directory, id)?.name || 'Unknown person';
}

function locationName(locations, id) {
  return byId(locations, id)?.name || 'Unknown location';
}

function modelLabel(model) {
  return model ? `${model.manufacturer} ${model.name}` : 'Unknown model';
}

/** Who is RESPONSIBLE for the asset — the asset's own owner, else the model's. */
function responsibleFor(asset, model) {
  return { id: asset.managedById || model?.managedById || null, inherited: !asset.managedById };
}

function warrantyState(asset) {
  const days = daysUntil(asset.warrantyExpires);
  if (days == null) return null;
  if (days < 0) return { key: 'expired', hue: 'red', days, label: `Warranty expired ${Math.abs(days)}d ago` };
  if (days <= 90) return { key: 'soon', hue: 'amber', days, label: `Warranty ends in ${days}d` };
  return { key: 'ok', hue: 'emerald', days, label: `Warranty to ${fmtDate(asset.warrantyExpires)}` };
}

/** Warranty position as one filterable value. "Nothing on file" is a state too. */
function warrantyBucket(asset) {
  const w = warrantyState(asset);
  if (!w) return 'unknown';
  return w.key === 'expired' ? 'expired' : w.key === 'soon' ? 'soon' : 'covered';
}

/**
 * Which renewal windows a licence falls in. A licence renewing in 20 days is in
 * BOTH the 30-day and the 90-day window — these are questions a buyer asks, not
 * slots a record occupies, so one licence can answer more than one of them.
 */
function renewalBuckets(license) {
  const days = daysUntil(license.renewalDate);
  if (days == null) return ['none'];
  if (days < 0) return ['expired'];
  const out = [];
  if (days <= 30) out.push('d30');
  if (days <= 90) out.push('d90');
  return out.length ? out : ['later'];
}

/** Seats consumed. Derived from allocations — never stored, so they cannot disagree. */
function seatsUsed(license) {
  return (license.allocations || []).reduce((n, al) => n + (al.seats || 1), 0);
}

/**
 * The licence position. Under-used needs BOTH a meaningful absolute gap and a
 * meaningful proportion, otherwise every licence with a couple of spare seats
 * would shout, and the screen would stop being read.
 */
function licensePosition(license) {
  const assigned = seatsUsed(license);
  if (license.licenseModel === 'site' || license.seatsOwned == null) {
    return { key: 'site', assigned, owned: null, delta: 0, exposure: 0 };
  }
  const delta = license.seatsOwned - assigned;
  const rate = license.costPerSeat || 0;
  if (delta < 0) return { key: 'over', assigned, owned: license.seatsOwned, delta, exposure: Math.abs(delta) * rate };
  if (delta >= 3 && delta / license.seatsOwned >= 0.2) {
    return { key: 'under', assigned, owned: license.seatsOwned, delta, exposure: delta * rate };
  }
  return { key: 'compliant', assigned, owned: license.seatsOwned, delta, exposure: 0 };
}

function annualSpend(license) {
  if (license.annualValue != null) return license.annualValue;
  if (license.seatsOwned == null || license.costPerSeat == null) return 0;
  return license.seatsOwned * license.costPerSeat;
}

/** Every descendant of a location, plus itself. */
function withDescendants(locations, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const loc of locations) {
      if (loc.parentId && out.has(loc.parentId) && !out.has(loc.id)) {
        out.add(loc.id);
        grew = true;
      }
    }
  }
  return out;
}

function childrenOf(locations, id) {
  return locations.filter(l => (l.parentId || null) === id);
}

/* ------------------------------------------------------------------ *
 * Root
 * ------------------------------------------------------------------ */

export default function Assets({ route }) {
  const assets = useStore(s => s.assets);
  const models = useStore(s => s.assetModels);
  const locations = useStore(s => s.locations);
  const contracts = useStore(s => s.contracts);
  const directory = useStore(s => s.directory);
  const currentUser = useStore(s => s.currentUser);

  const tab = TABS.some(x => x.value === route?.sub) ? route.sub : 'hardware';
  const openId = route?.id || null;

  const hardware = useMemo(() => assets.filter(a => a.kind === 'hardware'), [assets]);
  const licenses = useMemo(() => assets.filter(a => a.kind === 'software'), [assets]);

  const tabItems = useMemo(() => TABS.map(x => ({
    ...x,
    count: x.value === 'hardware' ? hardware.length
      : x.value === 'software' ? licenses.length
      : x.value === 'locations' ? locations.filter(l => l.type !== 'region').length
      : x.value === 'contracts' ? contracts.length
      : undefined,
  })), [hardware.length, licenses.length, locations, contracts.length]);

  /**
   * These stay SubTabs. Hardware, software, locations, contracts and the
   * compliance report are five different collections — they change WHAT you are
   * looking at, not how one list is drawn, which is a lens's job. They ride in
   * the header's tools cluster; each tab owns the rest of the band, because the
   * filters that make sense for a laptop are not the ones for a licence.
   */
  const tabBar = <SubTabs items={tabItems} value={tab} onChange={(v) => navigate('assets', v)} />;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {tab === 'hardware' && (
        <HardwareTab assets={hardware} models={models} locations={locations} contracts={contracts}
          directory={directory} currentUser={currentUser} openId={openId} tabs={tabBar} />
      )}
      {tab === 'software' && (
        <SoftwareTab licenses={licenses} locations={locations} contracts={contracts}
          directory={directory} openId={openId} tabs={tabBar} />
      )}
      {tab === 'locations' && (
        <LocationsTab locations={locations} assets={assets} models={models}
          directory={directory} openId={openId} tabs={tabBar} />
      )}
      {tab === 'contracts' && (
        <ContractsTab contracts={contracts} assets={assets} models={models}
          directory={directory} openId={openId} tabs={tabBar} />
      )}
      {tab === 'compliance' && (
        <ComplianceTab licenses={licenses} hardware={hardware} models={models}
          contracts={contracts} locations={locations} tabs={tabBar} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared display pieces
 * ------------------------------------------------------------------ */

/** A definition grid. The dense fact table used on every detail modal. */
function Facts({ items, columns = 2 }) {
  const { t } = useTheme();
  return (
    <div className="grid gap-x-6 gap-y-2.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {items.filter(Boolean).map(item => (
        <div key={item.label} className="min-w-0">
          <GroupLabel>{item.label}</GroupLabel>
          <div className={cx('text-sm mt-0.5 flex items-center gap-1.5 flex-wrap', t.text)}>{item.value}</div>
          {item.hint && <p className={cx('text-[11px] mt-0.5', t.textMuted)}>{item.hint}</p>}
        </div>
      ))}
    </div>
  );
}

/** Who uses the thing: a person gets a face, a place gets an emerald chip. */
function AssignedTo({ asset, directory, locations, size = 'sm' }) {
  const { t } = useTheme();
  if (asset.assignmentType === 'person' && asset.assignedToId) {
    const name = personName(directory, asset.assignedToId);
    return (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <Avatar name={name} size={size} />
        <span className={cx('text-sm truncate', t.text)}>{name}</span>
      </span>
    );
  }
  if (asset.assignmentType === 'location' && asset.locationId) {
    return <Chip accent="emerald" icon={MapPin}>{locationName(locations, asset.locationId)}</Chip>;
  }
  return <Chip accent="gray" icon={PackageOpen}>Unassigned</Chip>;
}

function SeatBar({ owned, assigned, hue }) {
  const { t, a } = useTheme();
  const c = a(hue);
  const denom = Math.max(owned || 0, assigned || 0, 1);
  const fill = Math.min(100, Math.round(((assigned || 0) / denom) * 100));
  const entitled = owned == null ? 100 : Math.min(100, Math.round((owned / denom) * 100));
  return (
    <span className={cx('relative block h-2 w-full rounded-full overflow-hidden', t.bgSubtle)} title={`${assigned} of ${owned ?? '∞'} seats`}>
      <span className={cx('absolute inset-y-0 left-0 rounded-full', c.solid)} style={{ width: `${fill}%` }} />
      {owned != null && (
        <span className={cx('absolute inset-y-0 w-0.5', t.rule)} style={{ left: `${entitled}%` }} />
      )}
    </span>
  );
}

function PositionChip({ position }) {
  const meta = POSITION[position.key];
  const label = position.key === 'over' ? `Over by ${Math.abs(position.delta)}`
    : position.key === 'under' ? `${position.delta} idle`
    : position.key === 'site' ? 'Site licence'
    : position.delta === 0 ? 'At limit' : `${position.delta} spare`;
  return <Chip accent={meta.hue} icon={position.key === 'over' ? ShieldAlert : position.key === 'under' ? TrendingDown : ShieldCheck}>{label}</Chip>;
}

function DaysChip({ days, label }) {
  const hue = days < 0 ? 'red' : days <= 30 ? 'red' : days <= 90 ? 'amber' : 'emerald';
  const text = days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`;
  return <Chip accent={hue} icon={CalendarClock} title={label}>{text}</Chip>;
}

/* ------------------------------------------------------------------ *
 * HARDWARE
 * ------------------------------------------------------------------ */

function HardwareTab({ assets, models, locations, contracts, directory, currentUser, openId, tabs }) {
  const { t } = useTheme();
  /* One header state: the multi-select filter values, the in-page query and
   * whether the tray is showing. The tray forces itself open while anything is
   * active, so a filter can never be on with its control hidden. */
  const [filters, setFilters] = useState({});
  const [q, setQ] = useState('');
  const [trayOpen, setTrayOpen] = useState(false);
  const [group, setGroup] = useState('none');
  const [view, setView] = useState('list');

  const activeFilters = Object.values(filters).reduce((n, v) => n + (v?.length || 0), 0);
  const showTray = trayOpen || activeFilters > 0;
  const clearFilters = () => { setFilters({}); setQ(''); setTrayOpen(false); };

  const open = openId ? byId(assets, openId) : null;

  /* Picking a location includes every site beneath it, and picking several
   * unions their subtrees — the tree is the point of the location model. */
  const locScope = useMemo(() => {
    const chosen = filters.location || [];
    if (!chosen.length) return null;
    const out = new Set();
    for (const id of chosen) for (const x of withDescendants(locations, id)) out.add(x);
    return out;
  }, [filters.location, locations]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter(asset => {
      const model = byId(models, asset.modelId);
      if (!passes(filters.status, asset.status)) return false;
      if (locScope && !locScope.has(asset.locationId)) return false;
      if (!passes(filters.model, asset.modelId)) return false;
      if (!passes(filters.assignment, asset.assignmentType || 'unassigned')) return false;
      if (!passes(filters.warranty, warrantyBucket(asset))) return false;
      // Search narrows what the filters left rather than replacing them.
      if (!needle) return true;
      const hay = [
        asset.assetTag, asset.serial, asset.poNumber, asset.notes, asset.vendor,
        modelLabel(model),
        asset.assignedToId ? personName(directory, asset.assignedToId) : '',
        asset.locationId ? locationName(locations, asset.locationId) : '',
      ].join(' ').toLowerCase();
      return hay.includes(needle);
    });
  }, [assets, models, directory, locations, q, filters, locScope]);

  /* The four figures the subtitle prints. The stat strip's other numbers — in
   * stock, in repair, warranty ending — are not gone: they are the counts on
   * the status and warranty filter options, where they cost something to act on
   * rather than sitting in a band nobody could click. */
  const stats = useMemo(() => ({
    total: assets.length,
    deployed: assets.filter(x => x.status === 'deployed').length,
    unassigned: assets.filter(x => !x.assignmentType && x.status !== 'retired').length,
    value: assets.reduce((n, x) => n + (x.cost || 0), 0),
  }), [assets]);

  const groups = useMemo(() => groupHardware(rows, group, { models, locations }), [rows, group, models, locations]);

  const statusOptions = useMemo(() => {
    const seen = [];
    for (const asset of assets) if (!seen.includes(asset.status)) seen.push(asset.status);
    return seen;
  }, [assets]);

  /* Counts are computed over the WHOLE estate, not the filtered view — an option
   * that reported how many survive the filters already set would read as choices
   * vanishing as you work. They are also where the old stat strip's numbers went:
   * "in repair 4" and "warranty expired 7" are now costed choices, not a band. */
  const FILTER_DEFS = useMemo(() => {
    const byStatus = optionCounts(assets, a => a.status);
    const byAssignment = optionCounts(assets, a => a.assignmentType || 'unassigned');
    const byLocation = optionCounts(assets, a => a.locationId);
    const byWarranty = optionCounts(assets, warrantyBucket);
    const byModel = optionCounts(assets, a => a.modelId);
    return [
      {
        id: 'status', label: 'Status', icon: Gauge,
        options: statusOptions.map(s => ({ value: s, label: statusLabel(s), count: byStatus.get(s) || 0 })),
      },
      {
        id: 'assignment', label: 'Assignment', icon: User,
        options: ASSIGNMENT_OPTIONS.map(o => ({ ...o, count: byAssignment.get(o.value) || 0 })),
      },
      {
        id: 'location', label: 'Location', icon: MapPin,
        options: locations.map(loc => ({ value: loc.id, label: loc.name, count: byLocation.get(loc.id) || 0 })),
        footer: 'A region includes every site beneath it.',
      },
      {
        id: 'warranty', label: 'Warranty', icon: ShieldAlert,
        options: WARRANTY_OPTIONS.map(o => ({ ...o, count: byWarranty.get(o.value) || 0 })),
      },
      {
        id: 'model', label: 'Model', icon: Tag,
        options: models.map(m => ({ value: m.id, label: modelLabel(m), count: byModel.get(m.id) || 0 })),
      },
    ];
  }, [assets, statusOptions, locations, models]);

  const stockroom = locations.find(l => l.type === 'warehouse');
  const filtered = rows.length !== assets.length;

  return (
    <>
      <ModuleHeader
        icon={Server}
        module="assets"
        accent="cyan"
        title="Assets"
        /* The subtitle tells the truth about what is on screen, and carries the
         * estate figures the stat strip used to print above the list. */
        subtitle={subsetLabel(rows.length, assets.length,
          `${stats.total} tracked units · ${stats.deployed} deployed · ${stats.unassigned} unassigned · ${fmtMoney(stats.value)} at purchase`)}
        tools={<>
          {tabs}
          <ScopedSearch value={q} onChange={setQ} scope={`${assets.length} assets`} accent="cyan" />
          <FilterToggle
            open={showTray}
            count={activeFilters}
            accent="cyan"
            onClick={() => (activeFilters > 0 ? clearFilters() : setTrayOpen(o => !o))}
          />
        </>}
        tray={showTray ? (
          <FilterTray open filters={FILTER_DEFS} value={filters} onChange={setFilters} onClearAll={clearFilters}>
            {/* Grouping shapes the list rather than narrowing it, so it sits in
                the tray beside the filters but outside the active count. */}
            <span className="flex items-center gap-1.5">
              <span className={cx('text-[10px] font-semibold uppercase tracking-wider', t.textMuted)}>Group by</span>
              <SubTabs value={group} onChange={setGroup} items={GROUP_OPTIONS} />
            </span>
          </FilterTray>
        ) : null}
      />

      <PageBody width="max-w-6xl">
        <div className="space-y-4">
          {stats.unassigned > 0 && stockroom && (
            <Banner accent="blue" icon={AlertCircle} title="Where unassigned kit lives">
              {stats.unassigned} units have no owner. Anything checked in without a destination is parked at{' '}
              <strong className={t.text}>{stockroom.name}</strong> and counts as stock — it will not appear on
              anyone's equipment record until it is checked out again.
            </Banner>
          )}

          <ViewSwitcher value={view} onChange={setView} inline
            items={[
              { value: 'list', label: `Assets${filtered ? ` (${rows.length})` : ''}`, icon: Boxes },
              { value: 'models', label: `Models (${models.length})`, icon: Tag },
            ]} />

          {view === 'models' ? (
            <ModelsGrid models={models} assets={assets} directory={directory}
              onPick={(id) => { setFilters(f => ({ ...f, model: [id] })); setView('list'); }} />
          ) : (
            <>
              {rows.length === 0 ? (
                <EmptyState icon={Package} title="No assets match"
                  hint="Search composes with the filters rather than replacing them — clearing one may bring units back."
                  action={<Button variant="soft" accent="cyan" onClick={clearFilters}>Clear filters</Button>} />
              ) : (
                <div className="space-y-4">
                  {groups.map(g => (
                    <div key={g.key}>
                      {group !== 'none' && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <GroupLabel>{g.label}</GroupLabel>
                          <span className={cx('text-[11px] tabular-nums', t.textMuted)}>{g.items.length}</span>
                          <Divider className="flex-1" />
                        </div>
                      )}
                      <div className={DENSITY.rowGap}>
                        {g.items.map(asset => (
                          <HardwareRow key={asset.id} asset={asset} models={models}
                            locations={locations} directory={directory}
                            onOpen={() => navigate('assets', 'hardware', asset.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </PageBody>

      {open && (
        <AssetDetail asset={open} models={models} locations={locations} contracts={contracts}
          directory={directory} currentUser={currentUser}
          onClose={() => navigate('assets', 'hardware')} />
      )}
    </>
  );
}

function statusLabel(key) {
  const map = {
    in_stock: 'In Stock', deployed: 'Deployed', in_repair: 'In Repair',
    in_transit: 'In Transit', retired: 'Retired', lost: 'Lost / Stolen',
  };
  return map[key] || key;
}

function groupHardware(rows, group, { models, locations }) {
  if (group === 'none') return [{ key: 'all', label: 'All', items: rows }];
  const buckets = new Map();
  for (const asset of rows) {
    const model = byId(models, asset.modelId);
    const key = group === 'status' ? asset.status
      : group === 'location' ? (asset.locationId || 'none')
      : group === 'category' ? (model?.category || 'other')
      : asset.modelId;
    const label = group === 'status' ? statusLabel(asset.status)
      : group === 'location' ? locationName(locations, asset.locationId)
      : group === 'category' ? categoryMeta(model?.category).plural
      : modelLabel(model);
    if (!buckets.has(key)) buckets.set(key, { key, label, items: [] });
    buckets.get(key).items.push(asset);
  }
  return [...buckets.values()].sort((a, b) => b.items.length - a.items.length);
}

function HardwareRow({ asset, models, locations, directory, onOpen }) {
  const model = byId(models, asset.modelId);
  const meta = categoryMeta(model?.category);
  const warranty = warrantyState(asset);
  const owner = responsibleFor(asset, model);

  return (
    <ListRow
      accent="cyan"
      icon={meta.icon}
      onClick={onOpen}
      alert={asset.status === 'lost'}
      title={`${asset.assetTag} · ${modelLabel(model)}`}
      subtitle={[
        `S/N ${asset.serial}`,
        asset.locationId ? locationName(locations, asset.locationId) : null,
        owner.id ? `managed by ${personName(directory, owner.id)}` : null,
      ].filter(Boolean).join(' · ')}
      meta={
        <>
          {warranty && warranty.key !== 'ok' && (
            <Chip accent={warranty.hue} icon={ShieldAlert} title={`Warranty expires ${fmtDate(asset.warrantyExpires)}`}>
              {warranty.key === 'expired' ? 'Out of warranty' : `${warranty.days}d cover`}
            </Chip>
          )}
          <span className="hidden sm:flex items-center">
            <AssignedTo asset={asset} directory={directory} locations={locations} />
          </span>
          <StatusPill status={asset.status} />
        </>
      }
    />
  );
}

function ModelsGrid({ models, assets, directory, onPick }) {
  const { t } = useTheme();
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {models.map(model => {
        const owned = assets.filter(a => a.modelId === model.id);
        const meta = categoryMeta(model.category);
        return (
          <Card key={model.id} className={cx(DENSITY.cardPad, 'flex gap-3 cursor-pointer', 'transition-colors')}
            onClick={() => onPick(model.id)}>
            <IconTile icon={meta.icon} accent="cyan" />
            <div className="min-w-0 flex-1">
              <p className={cx('text-sm font-medium truncate', t.text)}>{modelLabel(model)}</p>
              <p className={cx('text-xs truncate', t.textMuted)}>
                {meta.label} · default {fmtMoney(model.defaults?.cost)} from {model.defaults?.vendor} ·{' '}
                {model.defaults?.warrantyMonths}-month warranty
              </p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Chip accent="cyan" icon={Boxes}>{owned.length} units</Chip>
                <Chip accent="emerald">{owned.filter(a => a.status === 'deployed').length} deployed</Chip>
                <Chip accent="blue">{owned.filter(a => a.status === 'in_stock').length} in stock</Chip>
                {model.managedById && (
                  <Chip accent="violet" icon={User}>managed by {personName(directory, model.managedById)}</Chip>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Asset detail + check-in / check-out
 * ------------------------------------------------------------------ */

function AssetDetail({ asset, models, locations, contracts, directory, currentUser, onClose }) {
  const { t } = useTheme();
  const [moving, setMoving] = useState(null);
  const model = byId(models, asset.modelId);
  const meta = categoryMeta(model?.category);
  const warranty = warrantyState(asset);
  const owner = responsibleFor(asset, model);
  const contract = byId(contracts, asset.contractId);
  const site = byId(locations, asset.locationId);
  const movable = asset.status !== 'retired';

  return (
    <>
      <Modal
        open
        onClose={onClose}
        accent="cyan"
        size="modalLg"
        icon={meta.icon}
        title={`${asset.assetTag} — ${modelLabel(model)}`}
        subtitle={`Serial ${asset.serial} · ${meta.label}`}
        footer={
          <>
            <span className={cx('text-xs', t.textMuted)}>
              {(asset.history || []).length} movements on record
            </span>
            <div className="flex gap-2">
              {movable && asset.assignmentType && (
                <Button variant="outline" icon={LogIn} onClick={() => setMoving('checkin')}>Check in</Button>
              )}
              {/* Hardware wears the cyan→blue half of the module's gradient; the
                  software half is purple→pink. Spelling the gradient rather than
                  the module key is what keeps the two apart. */}
              {movable && (
                <Button variant="grad" gradient={GRADIENT.hardware} icon={LogOut} onClick={() => setMoving('checkout')}>
                  {asset.assignmentType ? 'Move / reassign' : 'Check out'}
                </Button>
              )}
              {!movable && <Chip accent="gray" icon={Recycle}>Retired — no further movement</Chip>}
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <EntityTag kind="hardware" />
            <StatusPill status={asset.status} />
            {warranty && <Chip accent={warranty.hue} icon={ShieldCheck}>{warranty.label}</Chip>}
            {contract && <Chip accent="lime" icon={FileSignature}>{contract.name}</Chip>}
          </div>

          {asset.status === 'lost' && (
            <Banner accent="red" icon={AlertTriangle} title="This unit is recorded as lost or stolen">
              It still shows against {personName(directory, asset.assignedToId)} deliberately — the last
              known holder stays on the record so the loss is attributable. Retire it only once the
              write-off is approved.
            </Banner>
          )}

          {!asset.assignmentType && (
            <Banner accent="blue" icon={PackageOpen} title="Unassigned — nobody is accountable for this unit">
              It sits in stock at <strong className={t.text}>{site ? site.name : 'no recorded location'}</strong>.
              Check it out to a person or to a place to put it back on the books.
            </Banner>
          )}

          <Card className={DENSITY.cardPad}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <GroupLabel>Assigned to — who uses it</GroupLabel>
                <div className="mt-1.5">
                  {asset.assignmentType === 'person' && asset.assignedToId ? (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={personName(directory, asset.assignedToId)} size="lg" />
                      <div className="min-w-0">
                        <p className={cx('text-sm font-medium truncate', t.text)}>
                          {personName(directory, asset.assignedToId)}
                        </p>
                        <p className={cx('text-xs truncate', t.textMuted)}>
                          {byId(directory, asset.assignedToId)?.title || 'Employee'}
                          {site ? ` · ${site.name}` : ''}
                        </p>
                      </div>
                    </div>
                  ) : asset.assignmentType === 'location' ? (
                    <div className="flex items-center gap-2.5">
                      <IconTile icon={locationTypeMeta(site?.type).icon} accent="emerald" />
                      <div className="min-w-0">
                        <p className={cx('text-sm font-medium truncate', t.text)}>{site ? site.name : 'Unknown site'}</p>
                        <p className={cx('text-xs', t.textMuted)}>Shared device — no individual holder</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <IconTile icon={PackageOpen} accent="gray" />
                      <div className="min-w-0">
                        <p className={cx('text-sm font-medium', t.text)}>Nobody</p>
                        <p className={cx('text-xs', t.textMuted)}>In stock at {site ? site.name : 'unknown'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <GroupLabel>Managed by — who is responsible</GroupLabel>
                <div className="mt-1.5">
                  {owner.id ? (
                    <div className="flex items-center gap-2.5">
                      <Avatar name={personName(directory, owner.id)} size="lg" />
                      <div className="min-w-0">
                        <p className={cx('text-sm font-medium truncate', t.text)}>{personName(directory, owner.id)}</p>
                        <p className={cx('text-xs truncate', t.textMuted)}>
                          {byId(directory, owner.id)?.title || 'Owner'}
                          {owner.inherited ? ' · inherited from the model default' : ' · set on this asset'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className={cx('text-sm', t.textMuted)}>No owner recorded</p>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Section title="Record">
            <Card className={DENSITY.cardPad}>
              <Facts columns={3} items={[
                { label: 'Asset tag', value: <span className="font-mono">{asset.assetTag}</span>, hint: 'The human id — stays with the unit' },
                { label: 'Serial', value: <span className="font-mono">{asset.serial}</span>, hint: 'From the manufacturer' },
                { label: 'Model', value: modelLabel(model), hint: model ? `${categoryMeta(model.category).label} · EOL ${fmtDate(model.eol)}` : null },
                { label: 'Purchased', value: fmtDate(asset.purchaseDate), hint: asset.poNumber },
                { label: 'Cost', value: fmtMoney(asset.cost), hint: asset.vendor },
                { label: 'Warranty', value: fmtDate(asset.warrantyExpires), hint: warranty?.label },
                { label: 'Location', value: site ? <Chip accent="emerald" icon={MapPin}>{site.name}</Chip> : '—', hint: site?.address },
                { label: 'Contract', value: contract ? <Chip accent="lime" icon={FileSignature}>{contract.name}</Chip> : <span className={t.textMuted}>None on file</span>, hint: contract ? `Ends ${fmtDate(contract.endDate)}` : 'No maintenance cover recorded' },
                { label: 'Catalog', value: <CatalogLinks ids={asset.catalogItemIds} />, hint: 'Where a request about this asset starts' },
              ]} />
              {asset.notes && (
                <p className={cx('text-sm mt-4 pt-3 border-t leading-relaxed', t.borderLight, t.textSecondary)}>
                  {asset.notes}
                </p>
              )}
            </Card>
          </Section>

          <Section title="Chain of custody" hint="Every check-in, check-out and repair, newest first.">
            <HistoryTrail asset={asset} directory={directory} locations={locations} />
          </Section>
        </div>
      </Modal>

      {moving && (
        <MoveModal
          asset={asset}
          mode={moving}
          locations={locations}
          directory={directory}
          currentUser={currentUser}
          onClose={() => setMoving(null)}
        />
      )}
    </>
  );
}

function CatalogLinks({ ids }) {
  const catalog = useStore(s => s.catalog);
  const { t } = useTheme();
  const names = useMemo(() => {
    const out = [];
    const walk = (nodes) => {
      for (const node of nodes || []) {
        if ((ids || []).includes(node.id)) out.push(node.name);
        if (node.children) walk(node.children);
      }
    };
    walk(catalog);
    return out;
  }, [catalog, ids]);
  if (!names.length) return <span className={t.textMuted}>Not linked</span>;
  return <ChipGroup items={names} accent="amber" icon={Package} max={2} />;
}

function HistoryTrail({ asset, directory, locations }) {
  const { t, a } = useTheme();
  const events = [...(asset.history || [])].reverse();
  if (!events.length) {
    return <EmptyState icon={History} title="No movements recorded" hint="This unit has never been checked in or out." />;
  }
  return (
    <Card>
      <div className={cx('divide-y', t.borderLight)}>
        {events.map(event => {
          const meta = ACTION[event.action] || { label: event.action, icon: History, hue: 'gray' };
          const c = a(meta.hue);
          const to = event.toType === 'person' ? personName(directory, event.toId)
            : event.toType === 'location' ? locationName(locations, event.toId)
            : event.toType === 'vendor' ? 'the vendor depot'
            : null;
          return (
            <div key={event.id} className="flex items-start gap-3 px-4 py-2.5">
              <span className={cx('w-1 self-stretch min-h-8 rounded-full flex-shrink-0', c.rail)} />
              <meta.icon size={ICON.md} className={cx(c.fg, 'flex-shrink-0 mt-0.5')} />
              <div className="min-w-0 flex-1">
                <p className={cx('text-sm', t.text)}>
                  {meta.label}
                  {to && <> → <strong>{to}</strong></>}
                </p>
                {event.note && <p className={cx('text-xs mt-0.5', t.textSecondary)}>{event.note}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Avatar name={personName(directory, event.byId)} size="sm" />
                <span className={cx('text-xs tabular-nums', t.textMuted)}>{fmtDate(event.at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Check-out / check-in.
 *
 * One control for all three destinations, because they are the same operation:
 * the asset moves to a person, to a place, or back to stock. Every move appends
 * to the history with who did it and where it went.
 */
function MoveModal({ asset, mode, locations, directory, currentUser, onClose }) {
  const { t } = useTheme();
  const sites = locations.filter(l => l.type !== 'region');
  const stockroom = sites.find(l => l.type === 'warehouse') || sites[0];
  const [target, setTarget] = useState(mode === 'checkin' ? 'stock' : (asset.assignmentType === 'location' ? 'location' : 'person'));
  const [personId, setPersonId] = useState(asset.assignedToId || '');
  const [locId, setLocId] = useState(asset.assignmentType === 'location' ? asset.locationId : '');
  const [note, setNote] = useState('');

  const ready = target === 'stock' || (target === 'person' ? !!personId : !!locId);

  function commit() {
    if (!ready) return;
    const person = byId(directory, personId);
    const patch = target === 'person'
      ? {
        assignmentType: 'person',
        assignedToId: personId,
        locationId: person?.locationId && byId(locations, person.locationId) ? person.locationId : asset.locationId,
        status: 'deployed',
      }
      : target === 'location'
        ? { assignmentType: 'location', assignedToId: null, locationId: locId, status: 'deployed' }
        : { assignmentType: null, assignedToId: null, locationId: stockroom?.id || asset.locationId, status: 'in_stock' };

    const event = {
      id: uid('hev'),
      at: today(),
      action: target === 'stock' ? 'checkin' : 'checkout',
      byId: currentUser?.id || null,
      toType: target === 'stock' ? 'location' : target,
      toId: target === 'person' ? personId : target === 'location' ? locId : (stockroom?.id || asset.locationId),
      note: note.trim() || (target === 'stock' ? 'Returned to stock.' : 'Checked out.'),
    };

    patchIn('assets', asset.id, current => ({
      ...current,
      ...patch,
      history: [...(current.history || []), event],
    }));
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      accent="cyan"
      size="modalMd"
      z={LAYOUT.zNestedModal}
      icon={ArrowRightLeft}
      title={mode === 'checkin' ? `Check in ${asset.assetTag}` : `Move ${asset.assetTag}`}
      subtitle="The move is appended to the asset's history with your name on it"
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            Currently {asset.assignmentType === 'person' ? `with ${personName(directory, asset.assignedToId)}`
              : asset.assignmentType === 'location' ? `at ${locationName(locations, asset.locationId)}`
              : 'in stock'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="grad" gradient={GRADIENT.hardware} icon={ArrowRightLeft} disabled={!ready} onClick={commit}>
              Confirm move
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Where is it going?" required>
          <TileGroup value={target} onChange={setTarget} columns={3}
            options={[
              { value: 'person', label: 'A person', icon: User, accent: 'blue', hint: 'One named holder' },
              { value: 'location', label: 'A place', icon: MapPin, accent: 'emerald', hint: 'Shared device' },
              { value: 'stock', label: 'Back to stock', icon: PackageOpen, accent: 'gray', hint: 'No owner' },
            ]} />
        </Field>

        {target === 'person' && (
          <Field label="Holder" required hint="The asset will also inherit this person's home site.">
            <Select accent="cyan" value={personId} onChange={(e) => setPersonId(e.target.value)}
              placeholder="Choose a person…"
              options={directory.map(p => ({ value: p.id, label: `${p.name} — ${p.title}` }))} />
          </Field>
        )}

        {target === 'location' && (
          <>
            <Field label="Site" required>
              <Select accent="emerald" value={locId} onChange={(e) => setLocId(e.target.value)}
                placeholder="Choose a site…"
                options={sites.map(l => ({ value: l.id, label: `${l.name} — ${locationTypeMeta(l.type).label}` }))} />
            </Field>
            <Banner accent="emerald" icon={MapPin} title="This becomes a shared device">
              Assigning to a place clears the individual holder. The unit will show under that site's
              roll-up and on nobody's personal equipment record — which is what you want for a
              hot-desk monitor, a rack switch or a copy-room printer.
            </Banner>
          </>
        )}

        {target === 'stock' && stockroom && (
          <Banner accent="blue" icon={PackageOpen} title="Returning to stock is not a no-op">
            The unit is parked at <strong className={t.text}>{stockroom.name}</strong>, its owner is
            cleared and its status becomes <strong className={t.text}>In Stock</strong>. It stays on the
            books and in the site roll-up — it just has nobody accountable for it.
          </Banner>
        )}

        <Field label="Note" hint="Shown on the history entry. Say why, not what.">
          <Textarea accent="cyan" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Refresh — old unit returned and wiped" />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * SOFTWARE
 * ------------------------------------------------------------------ */

function SoftwareTab({ licenses, locations, contracts, directory, openId, tabs }) {
  const [filters, setFilters] = useState({});
  const [q, setQ] = useState('');
  const [trayOpen, setTrayOpen] = useState(false);
  const open = openId ? byId(licenses, openId) : null;

  const activeFilters = Object.values(filters).reduce((n, v) => n + (v?.length || 0), 0);
  const showTray = trayOpen || activeFilters > 0;
  const clearFilters = () => { setFilters({}); setQ(''); setTrayOpen(false); };

  /** The agreement a licence is bought under. "No contract on file" is a state. */
  const contractTypeOf = (lic) => byId(contracts, lic.contractId)?.type || 'none';

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return licenses
      .map(lic => ({ lic, pos: licensePosition(lic) }))
      .filter(({ lic, pos }) => {
        if (!passes(filters.position, pos.key)) return false;
        if (!passes(filters.contract, contractTypeOf(lic))) return false;
        if (!passes(filters.renewal, renewalBuckets(lic))) return false;
        if (!needle) return true;
        return [lic.product, lic.vendor, lic.version, lic.notes].join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => b.pos.exposure - a.pos.exposure);
  }, [licenses, contracts, q, filters]);

  /**
   * A site licence has no seat position — its allocations are recorded for
   * visibility only. Counting those allocations in `assigned` while its
   * unbounded entitlement contributes nothing to `owned` made the subtitle read
   * as if the whole estate were over-deployed (1,136 allocated against 1,032
   * owned) when nothing of the sort is true. Site licences are excluded from
   * BOTH seat figures, which is exactly what the compliance screen says
   * happens. Their spend still counts, because that money is real.
   *
   * Over- and under-deployment are not counted here any more: they are the
   * counts on the Compliance filter's options, one place rather than two.
   */
  const totals = useMemo(() => {
    let owned = 0, assigned = 0, spend = 0, site = 0;
    for (const lic of licenses) {
      const pos = licensePosition(lic);
      spend += annualSpend(lic);
      if (pos.key === 'site') { site += 1; continue; }
      owned += lic.seatsOwned || 0;
      assigned += pos.assigned;
    }
    return { owned, assigned, spend, site };
  }, [licenses]);

  const FILTER_DEFS = useMemo(() => {
    const byPosition = optionCounts(licenses, lic => licensePosition(lic).key);
    const byContract = optionCounts(licenses, contractTypeOf);
    const byRenewal = optionCounts(licenses, renewalBuckets);
    const contractTypes = [...new Set(licenses.map(contractTypeOf))];
    return [
      {
        id: 'position', label: 'Compliance', icon: Scale,
        options: Object.entries(POSITION).map(([key, meta]) => ({
          value: key, label: meta.label, count: byPosition.get(key) || 0,
        })),
      },
      {
        id: 'contract', label: 'Contract type', icon: FileSignature,
        options: contractTypes.map(type => ({
          value: type,
          label: type === 'none' ? 'No contract on file' : (CONTRACT_TYPE[type] || type),
          count: byContract.get(type) || 0,
        })),
      },
      {
        id: 'renewal', label: 'Renewal', icon: CalendarClock,
        options: RENEWAL_OPTIONS.map(o => ({ ...o, count: byRenewal.get(o.value) || 0 })),
        footer: 'A licence renewing inside 30 days answers the 90-day question too.',
      },
    ];
  }, [licenses, contracts]);

  return (
    <>
      <ModuleHeader
        icon={Server}
        module="assets"
        accent="pink"
        title="Assets"
        subtitle={subsetLabel(rows.length, licenses.length,
          `${licenses.length} licensed products · ${totals.assigned} of ${totals.owned} seats allocated · ${fmtMoney(totals.spend)} a year`)}
        /* The software half of the module has its own gradient — purple→pink,
         * the pair a licence wears everywhere else — rather than the cyan→blue
         * the module map hands out for hardware. */
        primary={
          <Button variant="grad" gradient={GRADIENT.software} icon={Scale}
            onClick={() => navigate('assets', 'compliance')}>
            Licence position
          </Button>
        }
        tools={<>
          {tabs}
          <ScopedSearch value={q} onChange={setQ} scope={`${licenses.length} products`} accent="pink" />
          <FilterToggle
            open={showTray}
            count={activeFilters}
            accent="pink"
            onClick={() => (activeFilters > 0 ? clearFilters() : setTrayOpen(o => !o))}
          />
        </>}
        tray={showTray ? (
          <FilterTray open filters={FILTER_DEFS} value={filters} onChange={setFilters} onClearAll={clearFilters} />
        ) : null}
      />

      <PageBody width="max-w-6xl">
        <div className="space-y-4">
          <Banner accent="pink" icon={AlertCircle} title="Seats assigned is derived, not typed">
            A licence's assigned count is the sum of its allocations — people and places that actually hold a
            seat. There is no field to type it into, so the entitlement and the deployment cannot quietly
            disagree the way they do in a spreadsheet.
            {totals.site > 0 && (
              <> The {totals.site === 1 ? 'one site licence' : `${totals.site} site licences`} above{' '}
              {totals.site === 1 ? 'is' : 'are'} left out of both seat totals — everyone is covered, so there is
              no position to count.</>
            )}
          </Banner>

          {rows.length === 0 ? (
            <EmptyState icon={Key} title="No licences match"
              hint="Search composes with the filters rather than replacing them — clearing one may bring products back."
              action={<Button variant="soft" accent="pink" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <div className={DENSITY.rowGap}>
              {rows.map(({ lic, pos }) => (
                <LicenseRow key={lic.id} license={lic} position={pos} contracts={contracts}
                  onOpen={() => navigate('assets', 'software', lic.id)} />
              ))}
            </div>
          )}
        </div>
      </PageBody>

      {open && (
        <LicenseDetail license={open} position={licensePosition(open)} locations={locations}
          contracts={contracts} directory={directory}
          onClose={() => navigate('assets', 'software')} />
      )}
    </>
  );
}

function LicenseRow({ license, position, contracts, onOpen }) {
  const { t } = useTheme();
  const meta = POSITION[position.key];
  const renewal = daysUntil(license.renewalDate);
  const contract = byId(contracts, license.contractId);
  return (
    <ListRow
      accent="pink"
      icon={Key}
      onClick={onOpen}
      alert={position.key === 'over'}
      title={`${license.product} · ${license.vendor}`}
      subtitle={`${LICENSE_MODEL[license.licenseModel]?.label || license.licenseModel} · ${licenseTerm(license.contractType)} · ${contract ? contract.name : 'no contract on file'}`}
      meta={
        <>
          <span className="hidden md:block w-28">
            <SeatBar owned={license.seatsOwned} assigned={position.assigned} hue={meta.hue} />
            <span className={cx('block text-[10px] mt-1 tabular-nums text-center', t.textMuted)}>
              {position.assigned} / {license.seatsOwned ?? '∞'} seats
            </span>
          </span>
          {position.exposure > 0 && (
            <Chip accent={meta.hue} icon={CircleDollarSign}>{fmtMoney(position.exposure)}</Chip>
          )}
          <PositionChip position={position} />
          {renewal != null && <DaysChip days={renewal} label={`Renews ${fmtDate(license.renewalDate)}`} />}
        </>
      }
    />
  );
}

function LicenseDetail({ license, position, locations, contracts, directory, onClose }) {
  const { t } = useTheme();
  const meta = POSITION[position.key];
  const contract = byId(contracts, license.contractId);
  const renewal = daysUntil(license.renewalDate);

  return (
    <Modal
      open
      onClose={onClose}
      accent="pink"
      size="modalLg"
      icon={Key}
      title={`${license.product}`}
      subtitle={`${license.vendor} · ${license.version} · ${LICENSE_MODEL[license.licenseModel]?.label}`}
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            {position.assigned} of {license.seatsOwned ?? '∞'} seats allocated
          </span>
          <div className="flex gap-2">
            {contract && (
              <Button variant="outline" icon={FileSignature} onClick={() => navigate('assets', 'contracts', contract.id)}>
                Open contract
              </Button>
            )}
            <Button variant="soft" accent="pink" onClick={onClose}>Done</Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <EntityTag kind="software" />
          <PositionChip position={position} />
          <Chip accent="violet">{LICENSE_MODEL[license.licenseModel]?.label}</Chip>
          <Chip accent="blue">{licenseTerm(license.contractType)}</Chip>
          {renewal != null && <DaysChip days={renewal} label={`Renews ${fmtDate(license.renewalDate)}`} />}
        </div>

        {position.key === 'over' && (
          <Banner accent="red" icon={ShieldAlert} title={`Over-deployed by ${Math.abs(position.delta)} seats`}>
            Deployment exceeds the entitlement. At {fmtMoney(license.costPerSeat)} a seat that is{' '}
            <strong className={t.text}>{fmtMoney(position.exposure)}</strong> of unlicensed use — the number a
            vendor audit would bill for. Either reclaim {Math.abs(position.delta)} allocations or buy up before
            the {fmtDate(license.renewalDate)} renewal.
          </Banner>
        )}
        {position.key === 'under' && (
          <Banner accent="amber" icon={TrendingDown} title={`${position.delta} seats paid for and never allocated`}>
            That is <strong className={t.text}>{fmtMoney(position.exposure)}</strong> a year. Drop the seat count
            at renewal on {fmtDate(license.renewalDate)}{contract?.autoRenew ? ` — notice must be served by ${fmtDate(addDays(contract.endDate, -contract.noticeDays))}` : ''}.
          </Banner>
        )}
        {position.key === 'site' && (
          <Banner accent="blue" icon={ShieldCheck} title="Site licence — there is no seat position to manage">
            Everyone in the organisation is covered, so allocations below are recorded for visibility only and
            never produce a compliance gap.
          </Banner>
        )}

        <Card className={DENSITY.cardPad}>
          <Facts columns={3} items={[
            { label: 'Seats owned', value: license.seatsOwned == null ? 'Unlimited' : license.seatsOwned, hint: 'The entitlement you bought' },
            { label: 'Seats assigned', value: position.assigned, hint: 'Derived from the allocations below' },
            {
              label: 'Position',
              value: <PositionChip position={position} />,
              hint: position.key === 'over' ? 'Unlicensed use' : position.key === 'under' ? 'Reclaimable spend' : 'Within entitlement',
            },
            { label: 'Cost per seat', value: fmtMoney(license.costPerSeat), hint: 'Annual' },
            { label: 'Annual spend', value: fmtMoney(annualSpend(license)), hint: license.seatsOwned == null ? 'Flat site fee' : 'Seats × cost' },
            { label: 'Renews', value: fmtDate(license.renewalDate), hint: renewal != null ? `${renewal} days away` : null },
            { label: 'Licence model', value: LICENSE_MODEL[license.licenseModel]?.label, hint: LICENSE_MODEL[license.licenseModel]?.hint },
            { label: 'Owner', value: license.managedById ? <span className="flex items-center gap-1.5"><Avatar name={personName(directory, license.managedById)} size="sm" />{personName(directory, license.managedById)}</span> : '—', hint: 'Accountable for renewal' },
            { label: 'Contract', value: contract ? <Chip accent="lime" icon={FileSignature}>{contract.name}</Chip> : <span className={t.textMuted}>None on file</span>, hint: contract ? `Ends ${fmtDate(contract.endDate)}` : 'Unpapered — no agreement recorded' },
          ]} />
          {license.notes && (
            <p className={cx('text-sm mt-4 pt-3 border-t leading-relaxed', t.borderLight, t.textSecondary)}>
              {license.notes}
            </p>
          )}
        </Card>

        <AllocationEditor license={license} position={position} locations={locations} directory={directory} />
      </div>
    </Modal>
  );
}

/**
 * Allocations — who holds a seat.
 *
 * A seat can go to a person or to a place (a lab of machines, a support floor,
 * a rack of hosts). Editing here is the only way seatsAssigned changes, which
 * is the point: the number is always the sum of things somebody can point at.
 */
function AllocationEditor({ license, position, locations, directory }) {
  const { t } = useTheme();
  const [kind, setKind] = useState('person');
  const [who, setWho] = useState('');
  const [seats, setSeats] = useState('1');
  const [note, setNote] = useState('');
  const sites = locations.filter(l => l.type !== 'region');

  function add() {
    if (!who) return;
    const entry = {
      id: uid('alc'),
      type: kind,
      personId: kind === 'person' ? who : null,
      locationId: kind === 'location' ? who : null,
      seats: Math.max(1, parseInt(seats, 10) || 1),
      since: today(),
      note: note.trim() || (kind === 'person' ? 'Named user' : 'Bulk site allocation'),
    };
    patchIn('assets', license.id, current => ({
      ...current,
      allocations: [...(current.allocations || []), entry],
    }));
    setWho('');
    setSeats('1');
    setNote('');
  }

  function remove(id) {
    patchIn('assets', license.id, current => ({
      ...current,
      allocations: (current.allocations || []).filter(al => al.id !== id),
    }));
  }

  const allocations = license.allocations || [];

  return (
    <Section
      title="Allocations"
      hint={`${allocations.length} allocations totalling ${position.assigned} seats — this sum IS the assigned count.`}
    >
      <Card>
        <div className={cx('divide-y', t.borderLight)}>
          {allocations.length === 0 && (
            <div className="px-4 py-6">
              <EmptyState icon={Users} title="No seats allocated" hint="Every seat you own is idle until somebody holds it." />
            </div>
          )}
          {allocations.map(al => (
            <div key={al.id} className="group flex items-center gap-3 px-4 py-2.5">
              {al.type === 'person' ? (
                <>
                  <Avatar name={personName(directory, al.personId)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-sm truncate', t.text)}>{personName(directory, al.personId)}</p>
                    <p className={cx('text-xs truncate', t.textMuted)}>{al.note} · since {fmtDate(al.since)}</p>
                  </div>
                </>
              ) : (
                <>
                  <IconTile icon={MapPin} accent="emerald" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-sm truncate', t.text)}>{locationName(locations, al.locationId)}</p>
                    <p className={cx('text-xs truncate', t.textMuted)}>{al.note} · since {fmtDate(al.since)}</p>
                  </div>
                </>
              )}
              <Chip accent="pink">{al.seats} {al.seats === 1 ? 'seat' : 'seats'}</Chip>
              <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <IconButton icon={Trash2} label="Remove allocation" accent="red" onClick={() => remove(al.id)} />
              </span>
            </div>
          ))}
        </div>

        <div className={cx('border-t p-4 space-y-3', t.borderLight)}>
          <GroupLabel>Allocate a seat</GroupLabel>
          <TileGroup value={kind} onChange={(v) => { setKind(v); setWho(''); }} columns={2}
            options={[
              { value: 'person', label: 'To a person', icon: User, accent: 'blue' },
              { value: 'location', label: 'To a place', icon: MapPin, accent: 'emerald' },
            ]} />
          <div className="grid sm:grid-cols-[2fr_1fr_2fr_auto] gap-2 items-end">
            <Field label={kind === 'person' ? 'Person' : 'Site'}>
              <Select accent="pink" value={who} onChange={(e) => setWho(e.target.value)}
                placeholder={kind === 'person' ? 'Choose a person…' : 'Choose a site…'}
                options={kind === 'person'
                  ? directory.map(p => ({ value: p.id, label: p.name }))
                  : sites.map(l => ({ value: l.id, label: l.name }))} />
            </Field>
            <Field label="Seats">
              <Input accent="pink" type="number" min="1" value={seats} onChange={(e) => setSeats(e.target.value)} />
            </Field>
            <Field label="Note">
              <Input accent="pink" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Support floor" />
            </Field>
            {/* A row-level control inside an editor, not the module's primary
                action — the signature gradient stays on the header tile and the
                commit buttons. */}
            <Button variant="solid" accent="pink" icon={Plus} disabled={!who} onClick={add}>Add</Button>
          </div>
        </div>
      </Card>
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * LOCATIONS
 * ------------------------------------------------------------------ */

function LocationsTab({ locations, assets, models, directory, openId, tabs }) {
  const { t } = useTheme();
  const [collapsed, setCollapsed] = useState({});
  const [q, setQ] = useState('');
  const open = openId ? byId(locations, openId) : null;

  const sites = locations.filter(l => l.type !== 'region');

  /* Searching a TREE keeps the ancestors of every match, otherwise a matching
   * site would be hidden under a region that does not match its own name. */
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return null;
    const byIdMap = new Map(locations.map(l => [l.id, l]));
    const keep = new Set();
    for (const loc of locations) {
      const hay = [loc.name, loc.address, locationTypeMeta(loc.type).label].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(needle)) continue;
      let node = loc;
      while (node) { keep.add(node.id); node = node.parentId ? byIdMap.get(node.parentId) : null; }
    }
    return keep;
  }, [locations, q]);

  const shownSites = visible ? sites.filter(l => visible.has(l.id)).length : sites.length;

  const counts = useMemo(() => {
    const direct = new Map();
    for (const loc of locations) direct.set(loc.id, { here: 0, shared: 0, people: 0, stock: 0, value: 0 });
    for (const asset of assets) {
      if (asset.kind !== 'hardware' || !asset.locationId) continue;
      const bucket = direct.get(asset.locationId);
      if (!bucket) continue;
      bucket.here += 1;
      bucket.value += asset.cost || 0;
      if (asset.assignmentType === 'location') bucket.shared += 1;
      else if (asset.assignmentType === 'person') bucket.people += 1;
      else bucket.stock += 1;
    }
    const rolled = new Map();
    for (const loc of locations) {
      const scope = withDescendants(locations, loc.id);
      let total = 0, value = 0;
      for (const id of scope) {
        const bucket = direct.get(id);
        if (bucket) { total += bucket.here; value += bucket.value; }
      }
      rolled.set(loc.id, { total, value });
    }
    return { direct, rolled };
  }, [locations, assets]);

  const roots = childrenOf(locations, null).filter(l => !visible || visible.has(l.id));

  return (
    <>
      <ModuleHeader
        icon={Server}
        module="assets"
        accent="emerald"
        title="Assets"
        subtitle={subsetLabel(shownSites, sites.length,
          `${sites.length} sites in ${locations.filter(l => l.type === 'region').length} regions`)}
        tools={<>
          {tabs}
          <ScopedSearch value={q} onChange={setQ} scope={`${sites.length} sites`} accent="emerald" />
        </>}
      />

      <PageBody width="max-w-5xl">
        <div className="space-y-4">
          <Banner accent="emerald" icon={MapPin} title="Counts roll up through the tree">
            A region shows every asset at every site beneath it, not just what is parked at the region itself.
            The two numbers on each row are <strong className={t.text}>here</strong> and{' '}
            <strong className={t.text}>including sites below</strong>, so a total is never quietly double-counted.
          </Banner>

          {roots.length === 0 ? (
            <EmptyState icon={MapPin} title="No sites match"
              hint="Clear the search to see the whole estate."
              action={<Button variant="soft" accent="emerald" onClick={() => setQ('')}>Clear search</Button>} />
          ) : (
            <div className="space-y-1.5">
              {roots.map(root => (
                <LocationBranch key={root.id} node={root} locations={locations} counts={counts} depth={0}
                  collapsed={collapsed} visible={visible}
                  onToggle={(id) => setCollapsed(c => ({ ...c, [id]: !c[id] }))}
                  onOpen={(id) => navigate('assets', 'locations', id)} />
              ))}
            </div>
          )}
        </div>
      </PageBody>

      {open && (
        <LocationDetail location={open} locations={locations} assets={assets} models={models}
          directory={directory} counts={counts} onClose={() => navigate('assets', 'locations')} />
      )}
    </>
  );
}

function LocationBranch({ node, locations, counts, depth, collapsed, visible, onToggle, onOpen }) {
  const { t } = useTheme();
  // `visible` is null when nothing is searched — the whole tree draws.
  const kids = childrenOf(locations, node.id).filter(l => !visible || visible.has(l.id));
  const meta = locationTypeMeta(node.type);
  const direct = counts.direct.get(node.id) || { here: 0, shared: 0, people: 0, stock: 0 };
  const rolled = counts.rolled.get(node.id) || { total: 0, value: 0 };
  const isOpen = !collapsed[node.id];

  return (
    <div style={{ paddingLeft: depth ? 20 : 0 }}>
      <ListRow
        accent={node.type === 'region' ? 'slate' : 'emerald'}
        icon={meta.icon}
        onClick={() => onOpen(node.id)}
        title={node.name}
        subtitle={node.address}
        meta={
          <>
            {direct.shared > 0 && <Chip accent="emerald" icon={Boxes}>{direct.shared} shared</Chip>}
            {direct.stock > 0 && <Chip accent="blue" icon={PackageOpen}>{direct.stock} in stock</Chip>}
            <span className={cx('text-xs tabular-nums text-right', t.textMuted)}>
              <span className={cx('block font-medium', t.text)}>{direct.here} here</span>
              {kids.length > 0 && <span className="block">{rolled.total} with sites below</span>}
            </span>
            <Chip accent="lime">{fmtMoney(rolled.value)}</Chip>
            {kids.length > 0 && (
              <IconButton
                icon={ChevronRight}
                label={isOpen ? 'Collapse' : 'Expand'}
                className={isOpen ? 'rotate-90' : ''}
                onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
              />
            )}
          </>
        }
      />
      {isOpen && kids.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {kids.map(kid => (
            <LocationBranch key={kid.id} node={kid} locations={locations} counts={counts} depth={depth + 1}
              collapsed={collapsed} visible={visible} onToggle={onToggle} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

function LocationDetail({ location, locations, assets, models, directory, counts, onClose }) {
  const { t } = useTheme();
  const meta = locationTypeMeta(location.type);
  const scope = withDescendants(locations, location.id);
  const here = assets.filter(a => a.kind === 'hardware' && a.locationId === location.id);
  const below = assets.filter(a => a.kind === 'hardware' && a.locationId !== location.id && scope.has(a.locationId));
  const shared = here.filter(a => a.assignmentType === 'location');
  const personal = here.filter(a => a.assignmentType === 'person');
  const stock = here.filter(a => !a.assignmentType);
  const kids = childrenOf(locations, location.id);
  const rolled = counts.rolled.get(location.id) || { total: 0, value: 0 };

  return (
    <Modal
      open
      onClose={onClose}
      accent="emerald"
      size="modalLg"
      icon={meta.icon}
      title={location.name}
      subtitle={`${meta.label} · ${location.address}`}
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            {here.length} here · {below.length} at sites below · {fmtMoney(rolled.value)} at purchase cost
          </span>
          <Button variant="soft" accent="emerald" onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Card className={DENSITY.cardPad}>
          <Facts columns={3} items={[
            { label: 'Type', value: <Chip accent={meta.accent} icon={meta.icon}>{meta.label}</Chip> },
            { label: 'Parent', value: location.parentId ? locationName(locations, location.parentId) : 'Top level' },
            { label: 'Site lead', value: location.siteLeadId
              ? <span className="flex items-center gap-1.5"><Avatar name={personName(directory, location.siteLeadId)} size="sm" />{personName(directory, location.siteLeadId)}</span>
              : <span className={t.textMuted}>None</span> },
            { label: 'Timezone', value: location.timezone || '—' },
            { label: 'Desks', value: location.seats == null ? '—' : location.seats },
            { label: 'Sites below', value: kids.length ? <ChipGroup items={kids.map(k => k.name)} accent="emerald" icon={MapPin} max={3} /> : <span className={t.textMuted}>None</span> },
          ]} />
          {location.notes && (
            <p className={cx('text-sm mt-4 pt-3 border-t leading-relaxed', t.borderLight, t.textSecondary)}>
              {location.notes}
            </p>
          )}
        </Card>

        {shared.length > 0 && (
          <Section title="Shared — assigned to this place" hint="No individual holder. This is what location ownership is for.">
            <div className={DENSITY.rowGap}>
              {shared.map(asset => (
                <MiniAssetRow key={asset.id} asset={asset} models={models} directory={directory} />
              ))}
            </div>
          </Section>
        )}

        {personal.length > 0 && (
          <Section title="Held by people based here">
            <div className={DENSITY.rowGap}>
              {personal.map(asset => (
                <MiniAssetRow key={asset.id} asset={asset} models={models} directory={directory} />
              ))}
            </div>
          </Section>
        )}

        {stock.length > 0 && (
          <Section title="Unassigned stock at this site">
            <div className={DENSITY.rowGap}>
              {stock.map(asset => (
                <MiniAssetRow key={asset.id} asset={asset} models={models} directory={directory} />
              ))}
            </div>
          </Section>
        )}

        {here.length === 0 && (
          <EmptyState icon={Boxes} title="Nothing parked here"
            hint={kids.length ? 'This is a grouping node — the assets sit at the sites beneath it.' : 'No assets recorded at this site.'} />
        )}
      </div>
    </Modal>
  );
}

function MiniAssetRow({ asset, models, directory }) {
  const model = byId(models, asset.modelId);
  const meta = categoryMeta(model?.category);
  return (
    <ListRow
      accent="cyan"
      icon={meta.icon}
      title={`${asset.assetTag} · ${modelLabel(model)}`}
      subtitle={asset.assignmentType === 'person'
        ? `Held by ${personName(directory, asset.assignedToId)}`
        : asset.assignmentType === 'location' ? (asset.notes || 'Shared device') : 'In stock'}
      meta={<StatusPill status={asset.status} />}
      onClick={() => navigate('assets', 'hardware', asset.id)}
    />
  );
}

/* ------------------------------------------------------------------ *
 * CONTRACTS
 * ------------------------------------------------------------------ */

function ContractsTab({ contracts, assets, models, directory, openId, tabs }) {
  const { t } = useTheme();
  const [q, setQ] = useState('');
  const open = openId ? byId(contracts, openId) : null;

  const needle = q.trim().toLowerCase();
  const matches = (contract) => !needle
    || [contract.name, contract.vendor, CONTRACT_TYPE[contract.type]].join(' ').toLowerCase().includes(needle);

  const decorated = useMemo(() => contracts.map(contract => {
    const days = daysUntil(contract.endDate);
    const noticeBy = addDays(contract.endDate, -(contract.noticeDays || 0));
    return { contract, days, noticeBy, noticeDays: daysUntil(noticeBy) };
  }).sort((a, b) => a.days - b.days), [contracts]);

  /* The search narrows BOTH bands. Filtering the list below while the renewal
   * cards above still showed everything read as a bug. */
  const renewals = decorated.filter(d => d.days >= 0 && d.days <= 90 && matches(d.contract));
  const visible = decorated.filter(d => !(d.days >= 0 && d.days <= 90) && matches(d.contract));

  const dueSoon = decorated.filter(d => d.days >= 0 && d.days <= 90);
  const exposure = dueSoon.reduce((n, d) => n + (d.contract.value || 0), 0);

  return (
    <>
      <ModuleHeader
        icon={Server}
        module="assets"
        accent="lime"
        title="Assets"
        subtitle={subsetLabel(renewals.length + visible.length, contracts.length,
          `${contracts.length} agreements · ${dueSoon.length} renewing in 90 days · ${fmtMoney(exposure)} at renewal`)}
        tools={<>
          {tabs}
          <ScopedSearch value={q} onChange={setQ} scope={`${contracts.length} agreements`} accent="lime" />
        </>}
      />

      <PageBody width="max-w-5xl">
        <div className="space-y-5">
          <Banner accent="amber" icon={AlertCircle} title="Auto-renew is the silent default this screen exists to break">
            An auto-renewing agreement renews itself at the current terms unless notice is served before{' '}
            <strong className={t.text}>end date − notice period</strong>. That deadline, not the end date, is the
            one you have to hit — so it is printed on every card below.
          </Banner>

          <Section title="Renewing in the next 90 days" hint={`Measured from ${fmtDate(today())}.`}>
            {renewals.length === 0 ? (
              <EmptyState icon={CalendarClock}
                title={needle ? 'No renewals match that search' : 'Nothing renews in the next 90 days'}
                hint={needle ? 'Clear the search to see every agreement falling due.' : 'The next agreement to fall due is further out.'} />
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {renewals.map(({ contract, days, noticeBy, noticeDays }) => (
                  <RenewalCard key={contract.id} contract={contract} days={days} noticeBy={noticeBy}
                    noticeDays={noticeDays} directory={directory}
                    onOpen={() => navigate('assets', 'contracts', contract.id)} />
                ))}
              </div>
            )}
          </Section>

          <Section title="All agreements" hint="Everything not already falling due above.">
            <div className={DENSITY.rowGap}>
              {visible.map(({ contract, days }) => (
                <ListRow
                  key={contract.id}
                  accent="lime"
                  icon={FileSignature}
                  onClick={() => navigate('assets', 'contracts', contract.id)}
                  title={contract.name}
                  subtitle={`${contract.vendor} · ${CONTRACT_TYPE[contract.type] || contract.type} · ${fmtDate(contract.startDate)} → ${fmtDate(contract.endDate)}`}
                  meta={
                    <>
                      <Chip accent="lime" icon={CircleDollarSign}>{fmtMoney(contract.value)}</Chip>
                      {contract.autoRenew
                        ? <Chip accent="violet">Auto-renews</Chip>
                        : <Chip accent="gray">Manual renewal</Chip>}
                      <DaysChip days={days} label={`Ends ${fmtDate(contract.endDate)}`} />
                    </>
                  }
                />
              ))}
              {visible.length === 0 && <EmptyState icon={FileSignature} title="No agreements match" hint="Clear the search to see them all." />}
            </div>
          </Section>
        </div>
      </PageBody>

      {open && (
        <ContractDetail contract={open} assets={assets} models={models} directory={directory}
          onClose={() => navigate('assets', 'contracts')} />
      )}
    </>
  );
}

function RenewalCard({ contract, days, noticeBy, noticeDays, directory, onOpen }) {
  const { t, a } = useTheme();
  const hue = days <= 30 ? 'red' : 'amber';
  const c = a(hue);
  const noticePassed = noticeDays < 0;
  return (
    <Card accent={hue} hover className={cx(DENSITY.cardPad, 'cursor-pointer space-y-2.5', c.border)} onClick={onOpen}>
      <div className="flex items-start gap-3">
        <IconTile icon={CalendarClock} accent={hue} />
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm font-medium truncate', t.text)}>{contract.name}</p>
          <p className={cx('text-xs truncate', t.textMuted)}>{contract.vendor} · {CONTRACT_TYPE[contract.type] || contract.type}</p>
        </div>
        <span className={cx('text-right flex-shrink-0')}>
          <span className={cx('block text-lg font-semibold tabular-nums leading-tight', c.fg)}>{days}</span>
          <span className={cx('block text-[10px] uppercase tracking-wider', t.textMuted)}>days left</span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Chip accent="lime" icon={CircleDollarSign}>{fmtMoney(contract.value)}</Chip>
        {contract.autoRenew ? <Chip accent="violet">Auto-renews</Chip> : <Chip accent="gray">Manual</Chip>}
        <Chip accent="blue" icon={User}>{personName(directory, contract.ownerId)}</Chip>
      </div>
      {contract.autoRenew && (
        <p className={cx('text-xs leading-relaxed', noticePassed ? a('red').fg : t.textSecondary)}>
          {noticePassed
            ? `Notice window closed ${Math.abs(noticeDays)} days ago — this renews on ${fmtDate(contract.endDate)} whatever you do now.`
            : `Serve notice by ${fmtDate(noticeBy)} (${noticeDays} days) or it renews at the current terms.`}
        </p>
      )}
    </Card>
  );
}

function ContractDetail({ contract, assets, models, directory, onClose }) {
  const { t } = useTheme();
  const days = daysUntil(contract.endDate);
  const noticeBy = addDays(contract.endDate, -(contract.noticeDays || 0));
  const noticeDays = daysUntil(noticeBy);
  const covered = (contract.assetIds || []).map(id => byId(assets, id)).filter(Boolean);
  const licenses = (contract.licenseIds || []).map(id => byId(assets, id)).filter(Boolean);

  return (
    <Modal
      open
      onClose={onClose}
      accent="lime"
      size="modalLg"
      icon={FileSignature}
      title={contract.name}
      subtitle={`${contract.vendor} · ${CONTRACT_TYPE[contract.type] || contract.type}`}
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>
            {covered.length} assets and {licenses.length} licences covered
          </span>
          <Button variant="soft" accent="lime" onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <EntityTag kind="contract" />
          <StatusPill status={contract.status === 'active' ? 'published' : 'archived'} />
          <DaysChip days={days} label={`Ends ${fmtDate(contract.endDate)}`} />
          {contract.autoRenew ? <Chip accent="violet">Auto-renews</Chip> : <Chip accent="gray">Manual renewal</Chip>}
        </div>

        {contract.autoRenew && (
          <Banner accent={noticeDays < 0 ? 'red' : noticeDays <= 45 ? 'amber' : 'blue'} icon={CalendarClock}
            title={noticeDays < 0 ? 'The notice window has closed' : `Notice deadline ${fmtDate(noticeBy)}`}>
            Ends {fmtDate(contract.endDate)} with a {contract.noticeDays}-day notice period, so the decision
            date is {fmtDate(noticeBy)}
            {noticeDays < 0
              ? ` — that was ${Math.abs(noticeDays)} days ago. This agreement will renew at the current terms.`
              : ` — ${noticeDays} days from today.`}
          </Banner>
        )}

        <Card className={DENSITY.cardPad}>
          <Facts columns={3} items={[
            { label: 'Vendor', value: contract.vendor },
            { label: 'Type', value: CONTRACT_TYPE[contract.type] || contract.type },
            { label: 'Owner', value: <span className="flex items-center gap-1.5"><Avatar name={personName(directory, contract.ownerId)} size="sm" />{personName(directory, contract.ownerId)}</span> },
            { label: 'Term', value: `${fmtDate(contract.startDate)} → ${fmtDate(contract.endDate)}` },
            { label: 'Value', value: fmtMoney(contract.value), hint: 'Total contract value' },
            { label: 'Notice period', value: `${contract.noticeDays} days`, hint: `Decide by ${fmtDate(noticeBy)}` },
          ]} />
          {contract.notes && (
            <p className={cx('text-sm mt-4 pt-3 border-t leading-relaxed', t.borderLight, t.textSecondary)}>
              {contract.notes}
            </p>
          )}
        </Card>

        {licenses.length > 0 && (
          <Section title="Licences covered">
            <div className={DENSITY.rowGap}>
              {licenses.map(lic => {
                const pos = licensePosition(lic);
                return (
                  <ListRow key={lic.id} accent="pink" icon={Key}
                    title={`${lic.product} · ${lic.vendor}`}
                    subtitle={`${pos.assigned} of ${lic.seatsOwned ?? '∞'} seats allocated`}
                    meta={<PositionChip position={pos} />}
                    onClick={() => navigate('assets', 'software', lic.id)} />
                );
              })}
            </div>
          </Section>
        )}

        {covered.length > 0 && (
          <Section title="Assets covered">
            <div className={DENSITY.rowGap}>
              {covered.map(asset => (
                <MiniAssetRow key={asset.id} asset={asset} models={models} directory={directory} />
              ))}
            </div>
          </Section>
        )}

        {covered.length === 0 && licenses.length === 0 && (
          <EmptyState icon={Link2} title="Nothing linked to this agreement"
            hint="Link the assets or licences it covers so a support request can trace back to the paper behind it." />
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ *
 * COMPLIANCE — the screen a SAM tool exists for
 * ------------------------------------------------------------------ */

function ComplianceTab({ licenses, hardware, models, contracts, locations, tabs }) {
  const { t, a } = useTheme();
  const [q, setQ] = useState('');

  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => licenses
    .map(lic => ({ lic, pos: licensePosition(lic), contract: byId(contracts, lic.contractId) }))
    .filter(({ lic }) => !needle || [lic.product, lic.vendor].join(' ').toLowerCase().includes(needle))
    // Sorted worst-first. Named x/y so the accent accessor `a` from useTheme
    // is not shadowed inside the comparator.
    .sort((x, y) => y.pos.exposure - x.pos.exposure), [licenses, contracts, needle]);

  const totals = useMemo(() => {
    let risk = 0, reclaim = 0, spend = 0, unpapered = 0;
    for (const { lic, pos, contract } of rows) {
      spend += annualSpend(lic);
      if (pos.key === 'over') risk += pos.exposure;
      if (pos.key === 'under') reclaim += pos.exposure;
      if (!contract) unpapered += 1;
    }
    return { risk, reclaim, spend, unpapered, exposure: risk + reclaim };
  }, [rows]);

  const overs = rows.filter(r => r.pos.key === 'over');
  const unders = rows.filter(r => r.pos.key === 'under');

  const outOfWarranty = hardware.filter(a => {
    const w = warrantyState(a);
    return w && w.key === 'expired' && a.status !== 'retired';
  });
  const uncovered = hardware.filter(a => !a.contractId && a.status !== 'retired');

  return (
    <>
      <ModuleHeader
        icon={Server}
        module="assets"
        accent="amber"
        title="Assets"
        subtitle={subsetLabel(rows.length, licenses.length,
          `${licenses.length} licensed products · ${fmtMoney(totals.exposure)} of exposure · ${totals.unpapered} with no contract on file`)}
        tools={<>
          {tabs}
          <ScopedSearch value={q} onChange={setQ} scope={`${licenses.length} products`} accent="amber" />
        </>}
      />

      <PageBody width="max-w-6xl">
        <div className="space-y-5">
          {/* Not the stat strip this module used to open with: these are the
              module's finding, priced, and the report IS this screen. */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <ExposureTile label="Total exposure" value={fmtMoney(totals.exposure)} accent="amber" icon={Scale}
              hint="Unlicensed use plus spend on seats nobody holds" />
            <ExposureTile label="Unlicensed use" value={fmtMoney(totals.risk)} accent="red" icon={ShieldAlert}
              hint={`${overs.length} products deployed beyond entitlement`} />
            <ExposureTile label="Reclaimable" value={fmtMoney(totals.reclaim)} accent="emerald" icon={TrendingDown}
              hint={`${unders.length} products with idle seats`} />
            <ExposureTile label="Annual licence spend" value={fmtMoney(totals.spend)} accent="lime" icon={CircleDollarSign}
              hint={`${licenses.length} products · ${totals.unpapered} with no contract on file`} />
          </div>

          <Banner accent="blue" icon={AlertCircle} title="How a position is decided">
            Position is seats owned minus seats allocated. Over by any amount is{' '}
            <strong className={t.text}>over-deployed</strong> — a vendor audit prices that at list. Idle seats
            count as <strong className={t.text}>under-used</strong> only when they are at least 3 seats AND at
            least 20% of the entitlement, so a licence with one spare seat does not cry wolf. Site licences have
            no seat position at all and are excluded from both figures.
          </Banner>

          {overs.length > 0 && (
            <Section title="Over-deployed — fix or buy up" hint="Deployment exceeds what was bought. This is the number an audit bills.">
              <div className="grid sm:grid-cols-2 gap-2">
                {overs.map(({ lic, pos, contract }) => (
                  <FindingCard key={lic.id} license={lic} position={pos} contract={contract} hue="red"
                    action={`Reclaim ${Math.abs(pos.delta)} allocations, or add ${Math.abs(pos.delta)} seats at ${fmtMoney(lic.costPerSeat)} each.`} />
                ))}
              </div>
            </Section>
          )}

          {unders.length > 0 && (
            <Section title="Under-used — money already spent" hint="Seats paid for that nobody holds. Cut them at the next renewal.">
              <div className="grid sm:grid-cols-2 gap-2">
                {unders.map(({ lic, pos, contract }) => (
                  <FindingCard key={lic.id} license={lic} position={pos} contract={contract} hue="amber"
                    action={`Drop to ${pos.assigned} seats at renewal and save ${fmtMoney(pos.exposure)} a year.`} />
                ))}
              </div>
            </Section>
          )}

          <Section title="Licence position by product" hint="Every licensed product, worst exposure first.">
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[52rem]">
                <thead>
                  <tr className={cx('border-b', t.border)}>
                    {['Product', 'Model', 'Owned', 'Allocated', 'Position', 'Per seat', 'Exposure', 'Renews'].map(h => (
                      <th key={h} className={cx('px-3 py-2 text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ lic, pos, contract }) => (
                    <tr key={lic.id} className={cx('border-b last:border-0 cursor-pointer', t.borderLight, t.bgHover)}
                      onClick={() => navigate('assets', 'software', lic.id)}>
                      <td className="px-3 py-2">
                        <p className={cx('font-medium truncate', t.text)}>{lic.product}</p>
                        <p className={cx('text-xs truncate', t.textMuted)}>
                          {lic.vendor}{contract ? '' : ' · no contract on file'}
                        </p>
                      </td>
                      <td className={cx('px-3 py-2 text-xs', t.textSecondary)}>{LICENSE_MODEL[lic.licenseModel]?.label}</td>
                      <td className={cx('px-3 py-2 tabular-nums', t.text)}>{lic.seatsOwned ?? '∞'}</td>
                      <td className={cx('px-3 py-2 tabular-nums', t.text)}>{pos.assigned}</td>
                      <td className="px-3 py-2"><PositionChip position={pos} /></td>
                      <td className={cx('px-3 py-2 tabular-nums', t.textSecondary)}>{fmtMoney(lic.costPerSeat)}</td>
                      <td className={cx('px-3 py-2 tabular-nums font-medium',
                        pos.exposure > 0 ? a(POSITION[pos.key].hue).fg : t.textMuted)}>
                        {pos.exposure > 0 ? fmtMoney(pos.exposure) : '—'}
                      </td>
                      <td className={cx('px-3 py-2 text-xs whitespace-nowrap', t.textSecondary)}>{fmtDate(lic.renewalDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Section>

          <Section title="Hardware cover" hint="The same question asked of physical kit: what is running with no warranty and no contract behind it?">
            <div className="grid sm:grid-cols-2 gap-2">
              <Panel icon={ShieldAlert} accent="red" title="Out of warranty"
                subtitle={`${outOfWarranty.length} units still in service`}>
                <div className={cx('divide-y', t.borderLight)}>
                  {outOfWarranty.slice(0, 6).map(asset => (
                    <button key={asset.id} onClick={() => navigate('assets', 'hardware', asset.id)}
                      className={cx('w-full flex items-center gap-3 px-4 py-2 text-left', t.bgHover)}>
                      <span className={cx('text-sm font-mono', t.text)}>{asset.assetTag}</span>
                      <span className={cx('flex-1 text-xs truncate', t.textMuted)}>
                        {modelLabel(byId(models, asset.modelId))}
                      </span>
                      <Chip accent="red">{Math.abs(daysUntil(asset.warrantyExpires))}d over</Chip>
                    </button>
                  ))}
                  {outOfWarranty.length > 6 && (
                    <p className={cx('px-4 py-2 text-xs', t.textMuted)}>
                      +{outOfWarranty.length - 6} more out of warranty — open the Hardware tab and filter on
                      warranty to see them all.
                    </p>
                  )}
                  {outOfWarranty.length === 0 && (
                    <p className={cx('px-4 py-3 text-sm', t.textMuted)}>Everything in service is inside its warranty.</p>
                  )}
                </div>
              </Panel>

              <Panel icon={FileSignature} accent="amber" title="No maintenance contract"
                subtitle={`${uncovered.length} units with no agreement linked`}>
                <div className={cx('divide-y', t.borderLight)}>
                  {uncovered.slice(0, 6).map(asset => (
                    <button key={asset.id} onClick={() => navigate('assets', 'hardware', asset.id)}
                      className={cx('w-full flex items-center gap-3 px-4 py-2 text-left', t.bgHover)}>
                      <span className={cx('text-sm font-mono', t.text)}>{asset.assetTag}</span>
                      <span className={cx('flex-1 text-xs truncate', t.textMuted)}>
                        {modelLabel(byId(models, asset.modelId))}
                      </span>
                      <Chip accent="gray">{locationName(locations, asset.locationId)}</Chip>
                    </button>
                  ))}
                  {uncovered.length > 6 && (
                    <p className={cx('px-4 py-2 text-xs', t.textMuted)}>
                      +{uncovered.length - 6} more with no agreement linked.
                    </p>
                  )}
                  {uncovered.length === 0 && (
                    <p className={cx('px-4 py-3 text-sm', t.textMuted)}>Every unit is covered by an agreement.</p>
                  )}
                </div>
              </Panel>
            </div>
          </Section>
        </div>
      </PageBody>
    </>
  );
}

function ExposureTile({ label, value, hint, accent, icon: Icon }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <Card className={cx(DENSITY.cardPad, 'flex items-start gap-3')}>
      <IconTile icon={Icon} accent={accent} />
      <div className="min-w-0">
        <p className={cx('text-xl font-semibold tabular-nums leading-tight', c.fg)}>{value}</p>
        <p className={cx('text-xs font-medium mt-0.5', t.text)}>{label}</p>
        {hint && <p className={cx('text-[11px] mt-0.5 leading-snug', t.textMuted)}>{hint}</p>}
      </div>
    </Card>
  );
}

function FindingCard({ license, position, contract, hue, action }) {
  const { t, a } = useTheme();
  const c = a(hue);
  const noticeBy = contract ? addDays(contract.endDate, -(contract.noticeDays || 0)) : null;
  return (
    <Card className={cx(DENSITY.cardPad, 'space-y-2.5 border', c.border, 'cursor-pointer')}
      onClick={() => navigate('assets', 'software', license.id)}>
      <div className="flex items-start gap-3">
        <IconTile icon={Key} accent={hue} />
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm font-medium truncate', t.text)}>{license.product}</p>
          <p className={cx('text-xs truncate', t.textMuted)}>{license.vendor} · renews {fmtDate(license.renewalDate)}</p>
        </div>
        <span className="text-right flex-shrink-0">
          <span className={cx('block text-lg font-semibold tabular-nums leading-tight', c.fg)}>{fmtMoney(position.exposure)}</span>
          <span className={cx('block text-[10px] uppercase tracking-wider', t.textMuted)}>
            {position.key === 'over' ? 'unlicensed' : 'per year'}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Chip accent={hue}>{position.assigned} allocated</Chip>
        <Chip accent="blue">{license.seatsOwned} owned</Chip>
        <PositionChip position={position} />
      </div>
      <p className={cx('text-xs leading-relaxed', t.textSecondary)}>{action}</p>
      {contract?.autoRenew && (
        <p className={cx('text-xs leading-relaxed', a('amber').fg)}>
          {contract.name} auto-renews — notice must be served by {fmtDate(noticeBy)}.
        </p>
      )}
      {!contract && (
        <p className={cx('text-xs leading-relaxed', t.textMuted)}>
          No contract on file, so there is no notice date to work back from. Paper it before the next renewal.
        </p>
      )}
    </Card>
  );
}
