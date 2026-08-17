import React, { useState } from 'react';
import {
  Palette, Inbox, CheckSquare, Briefcase, BookOpen, GraduationCap, Monitor,
  Key, MapPin, GitBranch, AlertOctagon, Workflow, Stamp, FileQuestion, Folder,
  Layers, Circle, FileText, Plus, Trash2, Edit3, AlertCircle, Check, User,
  Building2, Award, ListChecks, Rocket, MessageSquare, BookMarked, UserCheck,
} from 'lucide-react';
import {
  useTheme, cx, ACCENT_HUES, ENTITIES, STATUS, PRIORITY, ICON, DENSITY, GRADIENT,
  entityHue, statusMeta,
  Button, IconButton, IconTile, Chip, ChipGroup, StatusPill, PriorityFlag, EntityTag,
  Avatar, AvatarStack, EmptyState, Card, Panel, Section, GroupLabel, ListRow, Stat,
  Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, Toggle, TileGroup, SearchInput,
  Modal, ConfirmDelete, Menu, MenuItem, MenuLabel, MenuDivider, FilterPill,
  LensBar, SubTabs, ViewSwitcher, PageHeader, Toolbar, PageBody, Breadcrumbs,
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
  { value: 'patterns', label: 'Patterns', icon: FileText },
  { value: 'rules', label: 'Rules', icon: AlertCircle },
];

export default function DesignSystem() {
  const { t } = useTheme();
  const [section, setSection] = useState('foundations');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        icon={Palette}
        gradient={GRADIENT.brand}
        title="RelayHQ Design System"
        subtitle="The visual language, rendered live from @/ds — this page cannot drift from the app"
      >
        <Toolbar>
          <SubTabs items={SECTIONS} value={section} onChange={setSection} />
        </Toolbar>
      </PageHeader>

      <PageBody width="max-w-6xl">
        {section === 'foundations' && <Foundations />}
        {section === 'entities' && <Entities />}
        {section === 'components' && <Components />}
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
  const { t, a, dark } = useTheme();
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
              {['rose', 'orange', 'amber', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'green', 'slate', 'gray', 'red', 'lime'].map(hue => {
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
            const c = a(meta.hue);
            return (
              <div key={kind} className={cx('flex items-center gap-3 p-2.5 rounded-lg border', t.bgCard, t.borderLight)}>
                <span className={cx('w-1 self-stretch min-h-8 rounded-full', c.rail)} />
                <IconTile icon={Icon} accent={meta.hue} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className={cx('text-sm font-medium truncate', t.text)}>{meta.label}</p>
                  <p className={cx('text-[11px] font-mono truncate', t.textMuted)}>{kind}</p>
                </div>
                <Chip accent={meta.hue}>{meta.hue}</Chip>
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

      <Section title="Layout" hint="Centre the content, cap the width. Wide viewports should produce balanced margins, not a left-hugging layout with a dead right half.">
        <Card className={DENSITY.cardPad}>
          <div className={cx('rounded-lg border-2 border-dashed p-4 text-center text-xs', t.borderLight, t.textMuted)}>
            <div className="max-w-md mx-auto rounded bg-purple-500/20 py-6">max-w-5xl mx-auto</div>
            <p className="mt-2">viewport</p>
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
  ['Centre the content, cap the width', 'max-w-5xl for list rows, justify-center for lens bars and toolbars.'],
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
