import React, { useState } from 'react';
import {
  Palette, Inbox, CheckSquare, Briefcase, BookOpen, GraduationCap, Monitor,
  Key, MapPin, GitBranch, AlertOctagon, Workflow, Stamp, FileQuestion, Folder,
  Layers, Circle, FileText, Plus, Trash2, Edit3, AlertCircle, Check, User,
  Building2, Award, ListChecks, Rocket, MessageSquare, BookMarked, UserCheck,
  LayoutGrid, Filter, Target,
} from 'lucide-react';
import {
  useTheme, cx, ACCENT_HUES, ENTITIES, STATUS, PRIORITY, ICON, DENSITY, GRADIENT,
  entityHue, statusMeta,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, PriorityFlag, EntityTag,
  Avatar, AvatarStack, EmptyState, Card, Panel, Section, GroupLabel, ListRow, Stat,
  Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, Toggle, TileGroup, SearchInput,
  Modal, ConfirmDelete, Menu, MenuItem, MenuLabel, MenuDivider, FilterPill,
  LensBar, SubTabs, ViewSwitcher, PageBody, Breadcrumbs,
  ModuleHeader, ScopedSearch, FilterBar, MultiSelectFilter,
  subsetLabel, optionCounts, passes, countActive,
} from '@/ds';

/**
 * The living styleguide.
 *
 * This page is not documentation about the design system — it renders the real
 * components from `@/ds`, so it cannot drift. If something looks wrong here it
 * is wrong in the app.
 */

const SECTIONS = [
  { value: 'foundations', label: 'Foundations', icon: Palette },
  { value: 'entities', label: 'Entity colours', icon: Circle },
  { value: 'components', label: 'Components', icon: Layers },
  { value: 'header', label: 'Header', icon: LayoutGrid },
  { value: 'patterns', label: 'Patterns', icon: FileText },
  { value: 'rules', label: 'Rules', icon: AlertCircle },
];

export default function DesignSystem() {
  const [section, setSection] = useState('foundations');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* The styleguide opens with the same band every module opens with. A page
          that documents ModuleHeader while wearing the old stacked shell is the
          exact drift this page exists to make impossible. */}
      <ModuleHeader
        icon={Palette}
        gradient={GRADIENT.brand}
        title="RelayHQ Design System"
        subtitle="The visual language, rendered live from @/ds — this page cannot drift from the app"
        nav={<SubTabs items={SECTIONS} value={section} onChange={setSection} inline />}
      />

      <PageBody width="max-w-6xl">
        {section === 'foundations' && <Foundations />}
        {section === 'entities' && <Entities />}
        {section === 'components' && <Components />}
        {section === 'header' && <Header />}
        {section === 'patterns' && <Patterns />}
        {section === 'rules' && <Rules />}
      </PageBody>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Swatch({ label, className, note }) {
  const { t } = useTheme();
  return (
    <div className="min-w-0">
      <div className={cx('h-12 rounded-lg border', className, t.borderLight)} />
      <p className={cx('text-[11px] mt-1 truncate font-medium', t.text)}>{label}</p>
      {note && <p className={cx('text-[10px] truncate', t.textMuted)}>{note}</p>}
    </div>
  );
}

function Foundations() {
  const { t, a } = useTheme();
  return (
    <div className="space-y-8">
      <Section title="Surfaces" hint="Every surface in the app comes from these tokens. No component hardcodes a grey.">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Swatch label="t.bg" className={t.bg} note="page" />
          <Swatch label="t.bgSidebar" className={t.bgSidebar} note="chrome" />
          <Swatch label="t.bgCard" className={t.bgCard} note="cards" />
          <Swatch label="t.bgInput" className={t.bgInput} note="controls" />
          <Swatch label="t.bgSubtle" className={t.bgSubtle} note="wells, pills" />
        </div>
      </Section>

      <Section title="Text" hint="Three weights of emphasis. Anything below textMuted is unreadable and not offered.">
        <Card className={DENSITY.cardPad}>
          <p className={cx('text-base', t.text)}>t.text — primary content and headings</p>
          <p className={cx('text-sm mt-1', t.textSecondary)}>t.textSecondary — labels, supporting copy</p>
          <p className={cx('text-sm mt-1', t.textMuted)}>t.textMuted — metadata, counts, timestamps</p>
        </Card>
      </Section>

      <Section title="Accent roles" hint="Each hue answers twelve roles. Classes are generated as literals so Tailwind can see them — never interpolate an accent class.">
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[46rem]">
            <thead>
              <tr className={cx('border-b', t.border)}>
                {['hue', 'soft', 'softStrong', 'solid', 'fg', 'border', 'dot', 'rail'].map(h => (
                  <th key={h} className={cx('px-3 py-2 font-semibold', t.textMuted)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Driven by ACCENT_HUES, never a hand-kept list — a hue added to
                  accents.js appears here without anyone remembering to add it. */}
              {ACCENT_HUES.map(hue => {
                const c = a(hue);
                return (
                  <tr key={hue} className={cx('border-b last:border-0', t.borderLight)}>
                    <td className={cx('px-3 py-1.5 font-medium', t.text)}>{hue}</td>
                    <td className="px-3 py-1.5"><span className={cx('block w-14 h-5 rounded', c.soft)} /></td>
                    <td className="px-3 py-1.5"><span className={cx('block w-14 h-5 rounded', c.softStrong)} /></td>
                    <td className="px-3 py-1.5"><span className={cx('block w-14 h-5 rounded', c.solid)} /></td>
                    <td className={cx('px-3 py-1.5 font-semibold', c.fg)}>Aa</td>
                    <td className="px-3 py-1.5"><span className={cx('block w-14 h-5 rounded border-2', c.borderStrong)} /></td>
                    <td className="px-3 py-1.5"><span className={cx('block w-2.5 h-2.5 rounded-full', c.dot)} /></td>
                    <td className="px-3 py-1.5"><span className={cx('block w-1.5 h-5 rounded-full', c.rail)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </Section>

      <Section title="Density" hint="v1's standing preference: information density over whitespace. These constants freeze the end state of that tightening.">
        <div className="grid sm:grid-cols-2 gap-3">
          <Card className={DENSITY.cardPad}>
            <GroupLabel>Spacing</GroupLabel>
            <ul className={cx('mt-2 space-y-1 text-xs font-mono', t.textSecondary)}>
              {Object.entries(DENSITY).map(([k, v]) => <li key={k}>{k}: <span className={t.text}>{v}</span></li>)}
            </ul>
          </Card>
          <Card className={DENSITY.cardPad}>
            <GroupLabel>Icon sizes</GroupLabel>
            <div className="mt-2 flex items-end gap-4">
              {Object.entries(ICON).map(([k, v]) => (
                <div key={k} className="text-center">
                  <Circle size={v} className={t.textSecondary} />
                  <p className={cx('text-[10px] mt-1', t.textMuted)}>{k}</p>
                  <p className={cx('text-[10px] font-mono', t.text)}>{v}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Signature gradients" hint="Used sparingly, only where v1 used them — brand mark, primary create actions, module headers.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(GRADIENT).map(([k, v]) => <Swatch key={k} label={k} className={v} />)}
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const ENTITY_ICONS = {
  ticket: Inbox, incident: Inbox, conversation: MessageSquare, problem: AlertOctagon,
  change: GitBranch, release: Rocket, approval: Stamp, contact: User, organization: Building2,
  task: CheckSquare, projectTask: CheckSquare, project: Briefcase, milestone: Stamp,
  product: Folder, subcategory: Layers, item: Circle,
  article: BookOpen, guide: Layers, form: FileText, subform: FileQuestion,
  curriculum: GraduationCap, course: BookMarked, courseModule: Layers, lesson: BookOpen,
  quiz: ListChecks, enrollment: UserCheck, certificate: Award,
  hardware: Monitor, software: Key, location: MapPin, contract: FileText,
  queue: Inbox, rule: AlertCircle, automation: Workflow,
};

function Entities() {
  const { t, a } = useTheme();
  const byHue = {};
  for (const [kind, meta] of Object.entries(ENTITIES)) {
    (byHue[meta.hue] ||= []).push(kind);
  }

  return (
    <div className="space-y-8">
      <Banner accent="blue" icon={AlertCircle} title="The load-bearing convention">
        Every entity type has exactly one hue, used everywhere it appears — sidebar, list rail, chip,
        modal border, icon tile. A reader learns the colour once and it never lies. Note that
        <strong className={t.text}> lesson is blue, the same as article</strong>: a lesson <em>is</em> a knowledge
        atom, and the colour says so. That reuse is the product thesis made visible.
      </Banner>

      <Section title="Entity registry" hint={`${Object.keys(ENTITIES).length} entity types across service, work, catalog, content, learning and assets.`}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(ENTITIES).map(([kind, meta]) => {
            const Icon = ENTITY_ICONS[kind] || Circle;
            // The colour comes from entityHue(), the same call a view makes — not
            // from a second reading of the registry that could drift from it.
            const hue = entityHue(kind);
            const c = a(hue);
            return (
              <div key={kind} className={cx('flex items-center gap-3 p-2.5 rounded-lg border', t.bgCard, t.borderLight)}>
                <span className={cx('w-1 self-stretch min-h-8 rounded-full', c.rail)} />
                <IconTile icon={Icon} accent={hue} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className={cx('text-sm font-medium truncate', t.text)}>{meta.label}</p>
                  <p className={cx('text-[11px] font-mono truncate', t.textMuted)}>{kind}</p>
                </div>
                <Chip accent={hue}>{hue}</Chip>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Shared hues" hint="Where two entities share a hue it is deliberate and means they are the same thing in different clothes.">
        <div className="grid sm:grid-cols-2 gap-2">
          {Object.entries(byHue).filter(([, kinds]) => kinds.length > 1).map(([hue, kinds]) => (
            <Card key={hue} className={cx(DENSITY.cardPad, 'flex items-center gap-3')}>
              <span className={cx('w-8 h-8 rounded-lg flex-shrink-0', a(hue).solid)} />
              <div className="min-w-0">
                <p className={cx('text-sm font-medium', t.text)}>{hue}</p>
                <p className={cx('text-xs truncate', t.textMuted)}>{kinds.join(' · ')}</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Status" hint="Status hues are shared across ticket, task, change and course so a colour means the same thing on every record.">
        <Card className={cx(DENSITY.cardPad, 'flex flex-wrap gap-2')}>
          {Object.keys(STATUS).map(k => <StatusPill key={k} status={k} />)}
        </Card>
      </Section>

      <Section title="Priority">
        <Card className={cx(DENSITY.cardPad, 'flex flex-wrap gap-4')}>
          {Object.keys(PRIORITY).map(k => <PriorityFlag key={k} priority={k} />)}
        </Card>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Demo({ title, hint, children, code }) {
  const { t } = useTheme();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <h4 className={cx('text-sm font-semibold', t.text)}>{title}</h4>
        {code && <code className={cx('text-[11px] font-mono', t.textMuted)}>{code}</code>}
      </div>
      {hint && <p className={cx('text-xs mb-2', t.textSecondary)}>{hint}</p>}
      <Card className={cx(DENSITY.cardPad, 'flex flex-wrap items-center gap-3')}>{children}</Card>
    </div>
  );
}

function Components() {
  const { t } = useTheme();
  const [text, setText] = useState('');
  const [sel, setSel] = useState('medium');
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [tile, setTile] = useState('person');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [menu, setMenu] = useState(false);
  const [lens, setLens] = useState('all');
  const [sub, setSub] = useState('hardware');
  const [view, setView] = useState('list');

  return (
    <div className="space-y-6">
      <Demo title="Button" code="<Button variant accent size />"
        hint="solid = commit · soft = secondary · outline = cancel · ghost = row action">
        <Button variant="solid" accent="purple" icon={Check}>Save</Button>
        <Button variant="soft" accent="teal" icon={Plus}>New task</Button>
        <Button variant="outline">Cancel</Button>
        <Button variant="ghost" icon={Edit3}>Edit</Button>
        <Button variant="solid" accent="rose" size="sm" icon={Plus}>Small</Button>
        <Button variant="solid" accent="gray" disabled>Disabled</Button>
        <Divider vertical className="h-6" />
        <IconButton icon={Edit3} label="Edit" />
        <IconButton icon={Trash2} label="Delete" accent="red" />
      </Demo>

      <Demo title="Chip and ChipGroup" code="<ChipGroup items render max />"
        hint="Chips show VALUES, not counts. ChipGroup renders the real names and adds an overflow badge — it is impossible to regress to “3 CC'd”.">
        <Chip accent="rose" icon={Inbox}>IT Support</Chip>
        <Chip accent="emerald">Deployed</Chip>
        <Chip accent="blue" onRemove={() => {}}>Removable</Chip>
        <Divider vertical className="h-6" />
        <ChipGroup accent="blue" icon={User} max={2}
          items={['Dana Whitmore', 'Ravi Menon', 'Owen Fitzgerald', 'Mei Tanaka']} />
      </Demo>

      <Demo title="Status, priority, entity tag">
        <StatusPill status="in_progress" />
        <StatusPill status="approved" />
        <StatusPill status="breached" />
        <PriorityFlag priority="urgent" />
        <PriorityFlag priority="low" />
        <EntityTag kind="change" />
        <EntityTag kind="course" />
      </Demo>

      <Demo title="Avatar" code="<Avatar name /> <AvatarStack names max />"
        hint="Gradient is derived from the name, so one person is the same colour in every view.">
        <Avatar name="Alex Rivera" size="xl" />
        <Avatar name="Emma Williams" size="lg" />
        <Avatar name="Devon Okafor" />
        <AvatarStack names={['Alex Rivera', 'Emma Williams', 'Devon Okafor', 'Lisa Park', 'Sam Whitfield', 'Nadia Haddad']} />
      </Demo>

      <Demo title="Form controls" code="<Field><Input/></Field>">
        <div className="grid sm:grid-cols-2 gap-4 w-full">
          <Field label="Asset name" required hint="Shown on the asset record">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. MacBook Pro 16&quot;" accent="cyan" />
          </Field>
          <Field label="Priority">
            <Select value={sel} onChange={(e) => setSel(e.target.value)}
              options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea rows={3} placeholder="Add more detail…" />
          </Field>
          <div className="space-y-3">
            <Checkbox label="Required field" hint="Blocks submission when empty" checked={checked} onChange={setChecked} />
            <Toggle checked={on} onChange={setOn} label={on ? 'Rule enabled' : 'Rule disabled'} />
          </div>
          <Field label="Assignment type" hint="v1 converted selects to tile grids where the icon carries meaning">
            <TileGroup value={tile} onChange={setTile} columns={2}
              options={[
                { value: 'person', label: 'Person', icon: User, accent: 'blue' },
                { value: 'location', label: 'Location', icon: MapPin, accent: 'emerald' },
              ]} />
          </Field>
          <Field label="Search" className="sm:col-span-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Filter assets…" />
          </Field>
        </div>
      </Demo>

      <Demo title="Overlays" hint="Modals are centred popups rendered through a portal, so nested modals are never clipped.">
        <Button variant="soft" accent="purple" onClick={() => setModal(true)}>Open modal</Button>
        <Button variant="soft" accent="red" onClick={() => setConfirm(true)}>Destructive confirm</Button>
        <div className="relative">
          <FilterPill icon={Inbox} label="Queue" active={menu} open={menu} onClick={() => setMenu(m => !m)} />
          <Menu open={menu} onClose={() => setMenu(false)} width="w-56">
            <MenuLabel>Filter by queue</MenuLabel>
            <MenuItem icon={Inbox} label="IT Support" hint="12 open" selected onClick={() => setMenu(false)} />
            <MenuItem icon={Inbox} label="Procurement" hint="3 open" onClick={() => setMenu(false)} />
            <MenuDivider />
            <MenuItem label="Clear filter" onClick={() => setMenu(false)} />
          </Menu>
        </div>

        <Modal open={modal} onClose={() => setModal(false)} accent="purple" icon={FileQuestion}
          title="Request form builder" subtitle="The standard modal shell"
          footer={<>
            <span className={cx('text-sm', t.textMuted)}>4 fields</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
              <Button variant="solid" accent="purple" icon={Check} onClick={() => setModal(false)}>Save form</Button>
            </div>
          </>}>
          <div className="space-y-3">
            <p className={cx('text-sm', t.textSecondary)}>
              Pinned header, scrolling body, pinned footer. The border colour carries the entity accent
              so you can tell what you are editing from the frame alone.
            </p>
            <Banner accent="amber" icon={AlertCircle}>
              No routing configured. Without routing, tickets from this form land in the <strong>General</strong> queue.
            </Banner>
          </div>
        </Modal>

        <ConfirmDelete open={confirm} name="Email Service" kind="product"
          cascadeNote="This also deletes all subcategories and items beneath it."
          onCancel={() => setConfirm(false)} onConfirm={() => setConfirm(false)} />
      </Demo>

      <Demo title="Navigation" hint="LensBar sizes off its OWN width using container queries — the reference implementation for any control that must condense inside a nested pane.">
        <div className="w-full space-y-4">
          <LensBar
            value={lens} onChange={setLens} split={3}
            items={[
              { value: 'all', label: 'Everything', icon: Layers, count: 42, accent: 'purple' },
              { value: 'tickets', label: 'Tickets', icon: Inbox, count: 12, accent: 'rose' },
              { value: 'tasks', label: 'Tasks', icon: CheckSquare, count: 18, accent: 'teal' },
              { value: 'approvals', label: 'Approvals', icon: Stamp, count: 4, accent: 'amber' },
              { value: 'learning', label: 'Learning', icon: GraduationCap, count: 8, accent: 'indigo' },
            ]} />
          <SubTabs value={sub} onChange={setSub}
            items={[
              { value: 'hardware', label: 'Hardware', icon: Monitor, count: 24, accent: 'cyan' },
              { value: 'software', label: 'Software', icon: Key, count: 11, accent: 'pink' },
              { value: 'locations', label: 'Locations', icon: MapPin, count: 4, accent: 'emerald' },
            ]} />
          <ViewSwitcher value={view} onChange={setView}
            items={[
              { value: 'list', label: 'List', icon: Layers },
              { value: 'board', label: 'Board', icon: Circle },
              { value: 'calendar', label: 'Calendar', icon: Stamp },
            ]} />
          <Breadcrumbs items={[{ name: 'Email Service' }, { name: 'Authentication' }, { name: 'Cannot sign in' }]} />
        </div>
      </Demo>

      <Demo title="List rows and stats" hint="The dense row used by every list surface. The rail carries the entity colour.">
        <div className="w-full space-y-3">
          <div className="flex flex-wrap gap-2">
            <Stat label="open" value={12} accent="rose" icon={Inbox} active />
            <Stat label="in progress" value={5} accent="amber" />
            <Stat label="overdue" value={2} accent="red" />
            <Stat label="courses" value={8} accent="indigo" icon={GraduationCap} />
          </div>
          <div className={DENSITY.rowGap}>
            <ListRow accent="rose" icon={Inbox} title="Cannot access email account"
              subtitle="Dana Whitmore · Lumen Retail Group"
              meta={<><StatusPill status="open" /><PriorityFlag priority="high" withLabel={false} /><Avatar name="Emma Williams" size="sm" /></>}
              actions={<><IconButton icon={Edit3} label="Edit" /><IconButton icon={Trash2} label="Delete" accent="red" /></>} />
            <ListRow accent="orange" icon={GitBranch} title="Email server memory upgrade"
              subtitle="CHG-1042 · Normal change · window Sat 22:00"
              meta={<><StatusPill status="scheduled" /><Avatar name="Emma Williams" size="sm" /></>} />
            <ListRow accent="indigo" icon={GraduationCap} title="Support Agent onboarding"
              subtitle="Curriculum · 4 courses · 18 lessons"
              meta={<StatusPill status="in_lesson" />} alert />
          </div>
        </div>
      </Demo>

      <Demo title="Empty state">
        <div className="w-full">
          <EmptyState icon={Workflow} title="No automations yet"
            hint="Automations react to events in RelayHQ and run a chain of nodes."
            action={<Button variant="solid" accent="sky" icon={Plus}>New automation</Button>} />
        </div>
      </Demo>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Header
 *
 * Every module used to open with up to four stacked bands: a top bar with an
 * empty left third, a title band whose primary action sat a pane away from the
 * title it belonged to, a stat strip, a lens bar and a filter toolbar — five
 * control radii at three heights, and a stat strip printing the numbers the
 * lens already carried. It is ONE band plus a tray now.
 *
 * These demos drive the real components from @/ds with a small stand-in
 * collection, and every number they print is computed by the same helpers the
 * app uses — optionCounts(), passes(), subsetLabel(). A typed-in count is the
 * first thing on a styleguide to go stale.
 * ------------------------------------------------------------------ */

const HEADER_QUEUES = [
  { id: 'q-cs',   name: 'Customer Support' },
  { id: 'q-it',   name: 'IT Support' },
  { id: 'q-proc', name: 'Procurement' },
  { id: 'q-fac',  name: 'Facilities' },
];

/** Twenty stand-in tickets — small enough to read, big enough for counts to mean something. */
const HEADER_ROWS = [
  { queueId: 'q-cs',   status: 'open',        priority: 'urgent' },
  { queueId: 'q-cs',   status: 'open',        priority: 'high' },
  { queueId: 'q-cs',   status: 'in_progress', priority: 'medium' },
  { queueId: 'q-cs',   status: 'in_progress', priority: 'low' },
  { queueId: 'q-cs',   status: 'resolved',    priority: 'medium' },
  { queueId: 'q-cs',   status: 'closed',      priority: 'low' },
  { queueId: 'q-it',   status: 'open',        priority: 'urgent' },
  { queueId: 'q-it',   status: 'open',        priority: 'medium' },
  { queueId: 'q-it',   status: 'in_progress', priority: 'high' },
  { queueId: 'q-it',   status: 'in_progress', priority: 'medium' },
  { queueId: 'q-it',   status: 'blocked',     priority: 'high' },
  { queueId: 'q-it',   status: 'resolved',    priority: 'low' },
  { queueId: 'q-it',   status: 'closed',      priority: 'medium' },
  { queueId: 'q-proc', status: 'open',        priority: 'medium' },
  { queueId: 'q-proc', status: 'in_progress', priority: 'low' },
  { queueId: 'q-proc', status: 'blocked',     priority: 'medium' },
  { queueId: 'q-proc', status: 'resolved',    priority: 'low' },
  { queueId: 'q-fac',  status: 'open',        priority: 'low' },
  { queueId: 'q-fac',  status: 'in_progress', priority: 'medium' },
  { queueId: 'q-fac',  status: 'resolved',    priority: 'low' },
];

const HEADER_STATUSES = ['open', 'in_progress', 'blocked', 'resolved', 'closed'];

/** A lens selects by status group, so its counts and the tray never disagree. */
const HEADER_LENSES = [
  { value: 'all',    label: 'Everything', icon: Layers,      accent: 'purple',  groups: ['open', 'active', 'done', 'closed'], noun: 'tickets' },
  { value: 'open',   label: 'Open',       icon: Inbox,       accent: 'rose',    groups: ['open'],                             noun: 'open tickets' },
  { value: 'active', label: 'In flight',  icon: CheckSquare, accent: 'amber',   groups: ['active'],                           noun: 'tickets in flight' },
  { value: 'done',   label: 'Settled',    icon: Check,       accent: 'emerald', groups: ['done', 'closed'],                   noun: 'settled tickets' },
];

/* Counts are computed over the WHOLE collection, never the filtered view — an
 * option that counts the view reads as options vanishing as you work. */
const HEADER_COUNTS = {
  queue: optionCounts(HEADER_ROWS, r => r.queueId),
  status: optionCounts(HEADER_ROWS, r => r.status),
  priority: optionCounts(HEADER_ROWS, r => r.priority),
};

const HEADER_FILTERS = [
  {
    id: 'queue', label: 'Queue', icon: Inbox,
    options: HEADER_QUEUES.map(q => ({ value: q.id, label: q.name, count: HEADER_COUNTS.queue.get(q.id) || 0 })),
  },
  {
    id: 'status', label: 'Status', icon: Target,
    options: HEADER_STATUSES.map(s => ({ value: s, label: statusMeta(s).label, count: HEADER_COUNTS.status.get(s) || 0 })),
  },
  {
    id: 'priority', label: 'Priority', icon: Filter,
    options: Object.keys(PRIORITY).map(p => ({ value: p, label: PRIORITY[p].label, count: HEADER_COUNTS.priority.get(p) || 0 })),
  },
];

/** The lone filter used by the standalone MultiSelectFilter demo. */
const HEADER_QUEUE_FILTER = HEADER_FILTERS[0];

/** Everything the tray left, using the same passes() the views use. */
function headerRows(filters) {
  return HEADER_ROWS.filter(r =>
    passes(filters.queue, r.queueId)
    && passes(filters.status, r.status)
    && passes(filters.priority, r.priority));
}

function headerLens(value) {
  return HEADER_LENSES.find(l => l.value === value) || HEADER_LENSES[0];
}

/** Lens counts reflect the other filters, so the bar never offers an empty lens. */
function headerLensItems(rows) {
  return HEADER_LENSES.map(l => ({
    ...l,
    count: rows.filter(r => l.groups.includes(statusMeta(r.status).group)).length,
  }));
}

function Header() {
  const { t } = useTheme();

  /* Two headers, both live: one starts resting, one starts filtering. Nothing on
   * this page is a picture of a control — every one of them works. */
  const [restLens, setRestLens] = useState('all');
  const [restQuery, setRestQuery] = useState('');
  const [restFilters, setRestFilters] = useState({});

  const [lens, setLens] = useState('all');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ queue: ['q-cs', 'q-it'] });

  /* The standalone controls. */
  const [assetQuery, setAssetQuery] = useState('');
  const [changeQuery, setChangeQuery] = useState('memory');
  const [unsetQueues, setUnsetQueues] = useState([]);
  const [setQueues, setSetQueues] = useState(['q-cs', 'q-it']);
  const [inlineLens, setInlineLens] = useState('open');
  const [inlineQuery, setInlineQuery] = useState('');
  const [standaloneLens, setStandaloneLens] = useState('open');

  const restActive = countActive(restFilters);
  const clearRest = () => { setRestFilters({}); setRestQuery(''); };
  const restRows = headerRows(restFilters);
  const restLensItems = headerLensItems(restRows);
  const restVisible = restRows.filter(r => headerLens(restLens).groups.includes(statusMeta(r.status).group));

  const activeFilters = countActive(filters);
  const clearFilters = () => { setFilters({}); setQuery(''); };
  const rows = headerRows(filters);
  const lensItems = headerLensItems(rows);
  const visible = rows.filter(r => headerLens(lens).groups.includes(statusMeta(r.status).group));

  /* The lens demo stands on its own, so its counts come from the whole collection. */
  const allLensItems = headerLensItems(HEADER_ROWS);

  return (
    <div className="space-y-6">
      <Banner accent="purple" icon={AlertCircle} title="Two bands of fixed height, and neither may wrap">
        The old opening was a top bar, a title band, a stat strip, a lens bar and a filter toolbar — five control radii at
        three heights, centred controls fighting a left-aligned title, and a stat strip printing the numbers the lens
        already carried. Everything here is one height (<code>CONTROL_H</code>) and one radius. The stat strip is gone on
        purpose — the lens already carries the counts. Keep <code>Stat</code> for the BODY of a view, where it is content
        rather than chrome.
        <br /><br />
        <strong className={t.text}>The shape is fixed, and that is the rule.</strong> Collapsing those five bands into one
        left a single <code>flex-wrap</code> row holding identity, primary action and every control at once, so the header
        reflowed with the window — 56px wide, 103px at a laptop, 141px narrow. Worse, it reflowed without the window
        moving at all: <code>subsetLabel()</code> swaps a long resting subtitle for “20 of 118 shown” the moment a filter
        is set, and <code>truncate</code> implies <code>white-space: nowrap</code>, so flexbox breaks lines against the
        FULL string — typing in the search could unwrap the header and clearing it could wrap it back. A header that
        changes shape while you use it reads as broken. Row 1 is now a three-column grid rather than a flex row with
        spacers, because a spacer centres against whatever happens to flank it; equal side tracks hold the centre still.
        Row 2 shrinks by scrolling, never by wrapping. Both headers below are live and driven by a twenty-record stand-in
        collection; there is no list underneath them because the band is the subject.
      </Banner>

      <Demo
        title="ModuleHeader — resting"
        code="<ModuleHeader icon module title subtitle nav primary filterBar />"
        hint="Identity on the left, the view lens CENTRED, the primary action on the right — then the filter bar below, carrying the scoped search and the filters together because they do the same job. Nothing is filtered yet, so the subtitle carries the resting label. The filter bar is always present: once the search field moved down here it could no longer live in a container another control was able to dismiss. useHeaderFilters() packages the state — the selections and the query, and nothing about a tray, because there is no longer one to open."
      >
        <div className={cx('w-full rounded-lg border overflow-hidden', t.borderLight)}>
          <ModuleHeader
            icon={Inbox}
            module="workspace"
            title="Tickets"
            subtitle={subsetLabel(restVisible.length, HEADER_ROWS.length, `${HEADER_ROWS.length} tickets across ${HEADER_QUEUES.length} queues`)}
            nav={<LensBar items={restLensItems} value={restLens} onChange={setRestLens} inline />}
            primary={<Button variant="grad" module="workspace" icon={Plus}>New ticket</Button>}
            filterBar={
              <FilterBar
                accent="teal"
                filters={HEADER_FILTERS}
                value={restFilters}
                onChange={setRestFilters}
                onClearAll={clearRest}
                search={
                  <ScopedSearch
                    value={restQuery}
                    onChange={setRestQuery}
                    scope={`${restVisible.length} ${headerLens(restLens).noun}`}
                    accent="teal"
                  />
                }
              />
            }
          />
        </div>
      </Demo>

      <Demo
        title="ModuleHeader — filtering"
        code="filterBar={<FilterBar search filters value onChange onClearAll />}"
        hint="Two queues are selected, so two things changed at once and neither can be missed: the filter carries its values — “Queue · Customer Support +1”, never a bare category — and the subtitle reports the subset rather than the whole. Toggle a filter and watch the numbers move together, and watch the band NOT move: the subtitle is the thing that used to change the header's height, and it no longer can."
      >
        <div className={cx('w-full rounded-lg border overflow-hidden', t.borderLight)}>
          <ModuleHeader
            icon={Inbox}
            module="workspace"
            title="Tickets"
            subtitle={subsetLabel(visible.length, HEADER_ROWS.length, `${HEADER_ROWS.length} tickets across ${HEADER_QUEUES.length} queues`)}
            primary={<Button variant="grad" module="workspace" icon={Plus}>New ticket</Button>}
            nav={<LensBar items={lensItems} value={lens} onChange={setLens} inline />}
            filterBar={
              <FilterBar
                accent="teal"
                filters={HEADER_FILTERS}
                value={filters}
                onChange={setFilters}
                onClearAll={clearFilters}
                search={
                  <ScopedSearch
                    value={query}
                    onChange={setQuery}
                    scope={`${visible.length} ${headerLens(lens).noun}`}
                    accent="teal"
                  />
                }
              />
            }
          />
        </div>
      </Demo>

      <Demo
        title="ScopedSearch"
        code="<ScopedSearch value onChange scope accent />"
        hint="Two search fields on one screen are confusing unless they announce which is which, so this one names its own scope in the placeholder. ⌘K in the bar above searches everything; this one searches what is on the page, and the scope moves with the lens. Empty on the left, carrying a query on the right — the border and the glyph take the accent once something is typed."
      >
        <ScopedSearch value={assetQuery} onChange={setAssetQuery} scope="24 assets" accent="cyan" />
        <ScopedSearch value={changeQuery} onChange={setChangeQuery} scope="9 changes" accent="orange" />
      </Demo>

      <Demo
        title="FilterBar"
        code="<FilterBar search filters value onChange onClearAll>{extras}</FilterBar>"
        hint="Row 2, and always on screen. It replaced a tray that only rendered when something was active — a good idea for a band of filters and a fatal one once the search field moved down beside them, because the filter toggle's own handler cleared the values AND closed the tray, so one click would have unmounted the field and thrown away whatever was being typed into it. A control you type in cannot live somewhere another control can dismiss. It scrolls rather than wraps, which is what holds the header's height fixed; that makes it a clipping context, so the menus opened from it are positioned fixed rather than absolute. Grouping controls belong here too — they shape the list rather than narrowing it, so they sit beside the filters but outside the active count."
      >
        <div className={cx('w-full rounded-lg border overflow-hidden', t.borderLight)}>
          <FilterBar
            accent="teal"
            filters={HEADER_FILTERS}
            value={restFilters}
            onChange={setRestFilters}
            onClearAll={clearRest}
            search={<ScopedSearch value={restQuery} onChange={setRestQuery} scope="20 tickets" accent="teal" />}
          />
        </div>
      </Demo>

      <Demo
        title="MultiSelectFilter"
        code="<MultiSelectFilter filter selected onChange />"
        hint="Multi-select, because “unassigned or mine” is the first question a service desk asks in the morning and a single-select control cannot express it at all. Open either one: the options carry counts over the whole collection, so you can see what a choice costs before you make it. The right-hand control is set, and it shows its VALUES — “Queue · Customer Support +1” — never a bare category name. Same rule as chips."
      >
        <MultiSelectFilter filter={HEADER_QUEUE_FILTER} selected={unsetQueues} onChange={setUnsetQueues} />
        <MultiSelectFilter filter={HEADER_QUEUE_FILTER} selected={setQueues} onChange={setSetQueues} accent="teal" />
        <span className={cx('text-xs', t.textMuted)}>unset · two selected</span>
      </Demo>

      <Demo
        title="LensBar — inline and standalone"
        code="<LensBar items value onChange inline />"
        hint="Two shells, one control. The standalone bar centres itself and sizes off its OWN width with container queries; `container-type: inline-size` CONTAINS the inline axis, which is right for a bar that owns its row but means the pills overflow their box and collide with the search beside them inside a flex row. `inline` drops the shell, sizes to content and shrinks by scrolling. A lens in a ModuleHeader is always inline."
      >
        <div className="w-full space-y-4">
          <div>
            <GroupLabel>inline — sits centred in a ModuleHeader's first band</GroupLabel>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <LensBar items={allLensItems} value={inlineLens} onChange={setInlineLens} inline />
              <ScopedSearch value={inlineQuery} onChange={setInlineQuery} scope="20 tickets" accent="teal" />
            </div>
          </div>
          <div>
            <GroupLabel>standalone — owns its row, centred, container-query sized</GroupLabel>
            <div className="mt-1.5">
              <LensBar items={allLensItems} value={standaloneLens} onChange={setStandaloneLens} />
            </div>
          </div>
        </div>
      </Demo>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Patterns() {
  const { t } = useTheme();
  return (
    <div className="space-y-6">
      <Section title="Panel" hint="Card with a standard header: icon tile, title, subtitle, trailing action, optional body.">
        <Panel icon={FileQuestion} accent="purple" title="Request forms" subtitle="2 forms on this item"
          action={<IconButton icon={Plus} label="Add form" accent="purple" />}>
          <div className={cx('divide-y', t.borderLight)}>
            {['Report a problem', 'Request access'].map(n => (
              <div key={n} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-1 h-8 rounded bg-purple-400" />
                <FileQuestion size={ICON.base} className="text-purple-500" />
                <span className={cx('flex-1 text-sm', t.text)}>{n}</span>
                <Chip accent="blue" icon={Inbox}>IT Support</Chip>
                <span className={cx('text-xs', t.textMuted)}>6 fields</span>
              </div>
            ))}
          </div>
        </Panel>
      </Section>

      <Section title="Banner" hint="The explanatory or warning callout. Never a silent default — if the system will do something implicit, a banner says so.">
        <div className="space-y-2">
          <Banner accent="blue" icon={AlertCircle} title="How routing works">
            Routing is configured per request form. When a customer submits, the ticket goes to that form's queue.
          </Banner>
          <Banner accent="amber" icon={AlertCircle}>
            <strong>No routing configured.</strong> Tickets from this form will land in the <strong>General</strong> queue.
          </Banner>
          <Banner accent="red" icon={AlertCircle} title="SLA breached">
            First response target passed 40 minutes ago.
          </Banner>
        </div>
      </Section>

      <Section title="Layout" hint="Cap the width, align it left. The header spans the pane, so a list that centres itself under a cap no longer shares an edge with its own title — which reads as two screens stacked rather than one.">
        <Card className={DENSITY.cardPad}>
          <div className={cx('rounded-lg border-2 border-dashed p-4 text-xs', t.borderLight, t.textMuted)}>
            <div className="rounded bg-purple-500/20 py-2 mb-2 text-center">header — spans the pane</div>
            <div className="max-w-md rounded bg-purple-500/20 py-6 text-center">max-w-5xl, aligned left</div>
            <p className="mt-2 text-center">viewport</p>
          </div>
        </Card>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const RULES = [
  ['Information density over whitespace', 'When in doubt, tighten. Padding, icon sizes and card heights have been reduced repeatedly. Dense, not cluttered. Start from the DENSITY constants rather than picking a padding.'],
  ['Chips show values, not counts', 'Show the actual names with an overflow badge. Never “3 CC\'d”. Use ChipGroup, which makes the wrong thing impossible.'],
  ['Filters are multi-select', 'A single-select dropdown cannot express “unassigned or mine”, which is the first question a service desk asks each morning. Every header filter is a MultiSelectFilter, and an empty selection means everything — use passes(selected, value) so the empty case cannot be got wrong.'],
  ['Filter options carry counts', 'You should see what a choice costs before you make it. optionCounts() computes them over the WHOLE collection, never the filtered view — counting the view makes options appear to vanish as you work.'],
  ['A set filter shows its values', '“Queue · Customer Support +1”, never a bare “Queue”. Same rule as chips: a control that is doing something has to say what it is doing. MultiSelectFilter renders the label for you, so supply options with real names.'],
  ['In-page search names its scope', 'Two search fields on one screen are confusing unless they announce which is which. ScopedSearch puts the set in the placeholder — “Search 24 assets…”, “Search 9 changes…” — and ⌘K in the bar above stays the one that searches everything.'],
  ['The subtitle reports the subset', '“9 of 20 shown” whenever something narrows the list, the resting label when nothing does. subsetLabel() is the only place that decides, so a subset is never read as the whole.'],
  ['Cap the width, align it left', 'A list shares its left edge with the header above it. PageBody caps the column and aligns it left by default; centring it put the rows on a different edge from the module title — 152px apart at a 1600px window, and on Assets the edge jumped sideways between tabs that used different caps. Pass align="centre" only for a reading surface, where balanced margins genuinely help. This reverses the earlier rule; the header is the thing the body has to agree with.'],
  ['Container queries, not viewport breakpoints', 'md:/lg: respond to the window and fire at the wrong moment inside a nested pane. Use container-type: inline-size with clamp(min, Ncqw, max). LensBar is the reference implementation.'],
  ['Modals are centred popups', 'Pinned header, flex-1 overflow-auto body, pinned footer, border-2 in the entity accent. Rendered through a portal so nesting never clips.'],
  ['Borrow known patterns', 'If a mature product has solved this interaction, match it. Slack/GitHub for the header, Linear/Notion for ⌘K, ClickUp for projects, Trello for the ticket card, n8n for the automation canvas.'],
  ['Destructive actions earn friction', 'Cascading deletes require typing the record name. Use ConfirmDelete.'],
  ['Gate features by entity type', 'Hide what does not apply rather than showing a disabled control. Subtasks and checklists are tasks-only, never tickets.'],
  ['Never interpolate a colour class', 'Tailwind resolves classes by scanning source text, so `bg-${hue}-500` silently renders unstyled. Always go through accents.js. v1 shipped this bug.'],
  ['Every element themes through t', 'No hardcoded greys. If you need a surface that t does not cover, add it to tokens.js rather than inlining it.'],
];

function Rules() {
  const { t, a } = useTheme();
  return (
    <div className="space-y-3">
      <Banner accent="purple" icon={AlertCircle} title="Read this before extending the app">
        A new feature that does not use <code>t</code>, the entity colour map, the standard modal shell and the
        density constants will read as foreign no matter how well it works.
      </Banner>
      {RULES.map(([title, body], i) => (
        <Card key={title} className={cx(DENSITY.cardPad, 'flex gap-3')}>
          <span className={cx('w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0',
            a('purple').softStrong, a('purple').fg)}>{i + 1}</span>
          <div className="min-w-0">
            <p className={cx('text-sm font-semibold', t.text)}>{title}</p>
            <p className={cx('text-xs mt-0.5 leading-relaxed', t.textSecondary)}>{body}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
