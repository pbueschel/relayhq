import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Briefcase, Plus, ChevronRight, ChevronDown, ChevronLeft, List, LayoutGrid,
  SquareKanban, Calendar, ChartGantt, Circle, CircleCheck, Flag, User, Users,
  Settings2, Trash2, Check, X, Link2, ListChecks, CornerDownRight,
  TriangleAlert, CircleAlert, Columns3, GripVertical, Hash, Type, DollarSign,
  ToggleRight, CalendarClock, Eye, BookMarked, GraduationCap, Layers,
  Sparkles, MoreHorizontal, ArrowRight,
} from 'lucide-react';
import {
  useTheme, cx, ICON, DENSITY, LAYOUT, ENTITIES, PRIORITY, priorityMeta,
  Button, IconButton, IconTile, Chip, ChipGroup, PriorityFlag, EntityTag,
  Avatar, AvatarStack, EmptyState, Card, GroupLabel, Stat, Banner, Divider,
  Field, Input, Textarea, Select, Checkbox, Toggle, SearchInput,
  Modal, ConfirmDelete, Menu, MenuItem, MenuDivider, MenuLabel, FilterPill,
  SubTabs, ViewSwitcher, PageHeader, Toolbar, PageBody, Breadcrumbs,
} from '@/ds';
import { useStore, setCollection, addTo, patchIn, removeFrom, uid, NOW } from '@/store/store.js';
import { useRoute, navigate } from '@/lib/router.js';
import { PERSONAL_STATUSES } from '@/store/seed/work.js';

/**
 * Projects — ClickUp-shaped work management on RelayHQ's substrate.
 *
 * TWO SCREENS, ONE DATA MODEL
 *   The landing lists projects and expands a project INLINE to its task groups.
 *   Opening a project swaps to the workspace, which is the same tasks drawn four
 *   ways (List / Board / Calendar / Timeline) under one group-by control.
 *
 * WHY THE VIEWS SHARE `buildGroups`
 *   ClickUp's headline mechanic is that grouping is a property of the DATA, not
 *   of a view: the same Group-by drives List sections and Board columns, and a
 *   task created inside a group inherits that group's value. One function
 *   produces the groups and one function creates tasks from a group, so List and
 *   Board cannot disagree about what a group means.
 *
 * SUBTASKS ARE TASKS
 *   `parentId` on a task record, never a nested array. That is what lets a
 *   subtask created in the detail modal show up nested in the landing's expanded
 *   project list, on the board, and on the timeline without any surface owning a
 *   private copy.
 *
 * PERSONAL TASKS (projectId null) are teal and get PERSONAL_STATUSES. They have
 * no custom fields and no project settings — gated by type, not disabled.
 */

/* ==================================================================== *
 * Vocabulary
 * ==================================================================== */

const HUE_PROJECT   = ENTITIES.project.hue;      // violet
const HUE_TASK      = ENTITIES.task.hue;         // teal
const HUE_MILESTONE = ENTITIES.milestone.hue;    // amber

/**
 * The module key this view owns — it resolves the violet→purple signature
 * gradient for the header tile and the primary (create / commit) action.
 *
 * A PERSONAL project is task-coloured (teal) everywhere else on the screen —
 * rail, icon tile, progress bar, the `task` entity tag — and the teal→cyan pair
 * is the `workspace` entry in the gradient map. So its header tile and primary
 * action read from that key rather than wearing project violet over a teal
 * screen. The gradient always follows the hue the record is already wearing.
 */
const MODULE = 'projects';
const gradKeyFor = (project) => (project?.personal ? 'workspace' : MODULE);

const PERSONAL_ID = 'personal-tasks';

/** The four status groups. Not started / Active / Done / Closed. */
const STATUS_GROUPS = [
  { id: 'not_started', label: 'Not started', hue: 'gray' },
  { id: 'active',      label: 'Active',      hue: 'amber' },
  { id: 'done',        label: 'Done',        hue: 'emerald' },
  { id: 'closed',      label: 'Closed',      hue: 'slate' },
];

const STATUS_GROUP_OPTIONS = STATUS_GROUPS.map(g => ({ value: g.id, label: g.label }));

const HUE_OPTIONS = [
  'gray', 'slate', 'blue', 'sky', 'cyan', 'teal', 'emerald', 'lime',
  'amber', 'orange', 'red', 'rose', 'pink', 'fuchsia', 'purple', 'violet', 'indigo',
].map(h => ({ value: h, label: h }));

const VIEWS = [
  { value: 'list',     label: 'List',     icon: List },
  { value: 'board',    label: 'Board',    icon: SquareKanban },
  { value: 'calendar', label: 'Calendar', icon: Calendar },
  { value: 'timeline', label: 'Timeline', icon: ChartGantt },
];

const GROUP_BY = [
  { value: 'status',   label: 'Status',   icon: Circle },
  { value: 'assignee', label: 'Assignee', icon: User },
  { value: 'priority', label: 'Priority', icon: Flag },
];

const CORE_COLUMNS = [
  { id: 'status',   label: 'Status',   width: 8.5 },
  { id: 'assignee', label: 'Assignee', width: 7.5 },
  { id: 'priority', label: 'Priority', width: 6.5 },
  { id: 'dueDate',  label: 'Due date', width: 7.5 },
  { id: 'estimate', label: 'Estimate', width: 6 },
];

const FIELD_TYPES = [
  { value: 'text',     label: 'Text',     icon: Type },
  { value: 'number',   label: 'Number',   icon: Hash },
  { value: 'currency', label: 'Currency', icon: DollarSign },
  { value: 'select',   label: 'Select',   icon: ChevronDown },
  { value: 'date',     label: 'Date',     icon: CalendarClock },
  { value: 'checkbox', label: 'Checkbox', icon: ToggleRight },
  { value: 'person',   label: 'Person',   icon: User },
];

const FIELD_TYPE_ICON = {
  text: Type, number: Hash, currency: DollarSign, select: ChevronDown,
  date: CalendarClock, checkbox: ToggleRight, person: User,
};

/** Slash commands for the description editor. */
const SLASH_COMMANDS = [
  { id: 'heading',   label: 'Heading',        hint: 'Section title',            icon: Type,        insert: '## ' },
  { id: 'bullet',    label: 'Bullet list',    hint: 'One item per line',        icon: List,        insert: '- ' },
  { id: 'numbered',  label: 'Numbered list',  hint: 'Ordered steps',            icon: ListChecks,  insert: '1. ' },
  { id: 'divider',   label: 'Divider',        hint: 'Horizontal rule',          icon: MoreHorizontal, insert: '\n---\n' },
  { id: 'checklist', label: 'Checklist',      hint: 'Adds a checklist block',   icon: ListChecks,  action: true },
  { id: 'todo',      label: 'Checklist item', hint: 'Adds an item to the list', icon: Check,       action: true },
  { id: 'waiting',   label: 'Waiting on',     hint: 'This task is blocked by…', icon: Link2,       action: true },
  { id: 'blocking',  label: 'Blocking',       hint: 'This task blocks…',        icon: Link2,       action: true },
  { id: 'milestone', label: 'Milestone',      hint: 'Flag as a milestone',      icon: Flag,        action: true },
];

/* ==================================================================== *
 * Dates — everything is a plain YYYY-MM-DD day string.
 * ==================================================================== */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY_MS = 86400000;

function toDay(value) {
  if (!value) return null;
  const parts = String(value).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function dayKey(date) {
  if (!date) return null;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const TODAY_KEY = dayKey(TODAY);

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function fmtDay(value) {
  const d = toDay(value);
  if (!d) return null;
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function fmtDayYear(value) {
  const d = toDay(value);
  if (!d) return null;
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Monday-first grid of six weeks covering the given month. */
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = addDays(first, -offset);
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(start, i));
  return cells;
}

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

/* ==================================================================== *
 * Task + project helpers — pure, module scope, no store access.
 * ==================================================================== */

function personalProject(user) {
  return {
    id: PERSONAL_ID,
    personal: true,
    name: 'My Tasks',
    key: 'ME',
    description: 'Personal tasks. No project, no custom fields — they roll up to nobody but you.',
    ownerId: user?.id || null,
    memberIds: user?.id ? [user.id] : [],
    statuses: PERSONAL_STATUSES,
    fields: [],
    dueDate: null,
    startDate: null,
  };
}

function statusMetaOf(project, id) {
  const list = project?.statuses || PERSONAL_STATUSES;
  return list.find(s => s.id === id) || { id, label: String(id || 'No status'), hue: 'gray', group: 'not_started' };
}

function isComplete(project, task) {
  const g = statusMetaOf(project, task.status).group;
  return g === 'done' || g === 'closed';
}

function firstStatusOfGroup(project, group) {
  const list = project?.statuses || PERSONAL_STATUSES;
  return list.find(s => s.group === group) || list[0];
}

/**
 * Where a status's tasks land if that status is deleted: the next status in the
 * same group, or failing that the first surviving status. Null only when the
 * status being removed is the last one the project has.
 */
function statusAfterRemoval(project, status) {
  if (!status) return null;
  const rest = (project?.statuses || []).filter(s => s.id !== status.id);
  return rest.find(s => s.group === status.group) || rest[0] || null;
}

function isOverdue(project, task) {
  if (!task.dueDate || isComplete(project, task)) return false;
  const d = toDay(task.dueDate);
  return !!d && d.getTime() < TODAY.getTime();
}

function taskHue(task) {
  if (task.milestone) return HUE_MILESTONE;
  return task.projectId ? HUE_PROJECT : HUE_TASK;
}

function tasksOfProject(tasks, projectId) {
  return projectId === PERSONAL_ID
    ? tasks.filter(t => !t.projectId)
    : tasks.filter(t => t.projectId === projectId);
}

function childrenOf(tasks, parentId) {
  return tasks.filter(t => t.parentId === parentId);
}

function progressOf(project, list) {
  if (!list.length) return { pct: 0, done: 0, total: 0 };
  const done = list.filter(t => isComplete(project, t)).length;
  return { pct: Math.round((done / list.length) * 100), done, total: list.length };
}

/** Blockers and blocked-by, derived from BOTH directions. Never mirrored in the data. */
function relationsOf(task, all) {
  const blockers = [];
  const blocking = [];
  for (const d of task.dependencies || []) {
    const other = all.find(t => t.id === d.taskId);
    if (!other) continue;
    if (d.type === 'waiting_on') blockers.push(other);
    else blocking.push(other);
  }
  for (const other of all) {
    if (other.id === task.id) continue;
    for (const d of other.dependencies || []) {
      if (d.taskId !== task.id) continue;
      if (d.type === 'blocks' && !blockers.some(b => b.id === other.id)) blockers.push(other);
      if (d.type === 'waiting_on' && !blocking.some(b => b.id === other.id)) blocking.push(other);
    }
  }
  return { blockers, blocking };
}

/** Blockers that are not finished yet — the reason the warning banner exists. */
function openBlockers(project, task, all) {
  return relationsOf(task, all).blockers.filter(b => !isComplete(project, b));
}

function checklistProgress(task) {
  let done = 0, total = 0;
  for (const cl of task.checklists || []) {
    for (const item of cl.items || []) { total += 1; if (item.done) done += 1; }
  }
  return { done, total };
}

const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

function sortTasks(a, b) {
  const ad = a.dueDate ? toDay(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  const bd = b.dueDate ? toDay(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
  if (ad !== bd) return ad - bd;
  return priorityMeta(b.priority).rank - priorityMeta(a.priority).rank;
}

/**
 * The one grouping function. List and Board both consume it, so a group means
 * the same thing in both and a task created in a group can inherit its value.
 */
function buildGroups(project, rows, groupBy, people) {
  if (groupBy === 'assignee') {
    const ids = [...new Set([...(project.memberIds || []), ...rows.map(r => r.assigneeId).filter(Boolean)])];
    const groups = ids.map(id => {
      const person = people.find(p => p.id === id);
      return {
        key: id,
        label: person?.name || 'Unknown',
        hue: HUE_PROJECT,
        kind: 'assignee',
        patch: { assigneeId: id },
        tasks: rows.filter(r => r.assigneeId === id).sort(sortTasks),
      };
    });
    groups.push({
      key: '__none__', label: 'Unassigned', hue: 'gray', kind: 'assignee',
      patch: { assigneeId: null },
      tasks: rows.filter(r => !r.assigneeId).sort(sortTasks),
    });
    return groups;
  }

  if (groupBy === 'priority') {
    return PRIORITY_ORDER.map(p => ({
      key: p,
      label: PRIORITY[p].label,
      hue: PRIORITY[p].hue,
      kind: 'priority',
      patch: { priority: p },
      tasks: rows.filter(r => (r.priority || 'medium') === p).sort(sortTasks),
    }));
  }

  return (project.statuses || PERSONAL_STATUSES).map(s => ({
    key: s.id,
    label: s.label,
    hue: s.hue,
    kind: 'status',
    group: s.group,
    patch: { status: s.id },
    tasks: rows.filter(r => r.status === s.id).sort(sortTasks),
  }));
}

function newTask(project, patch, title) {
  const fallback = firstStatusOfGroup(project, 'not_started') || (project.statuses || PERSONAL_STATUSES)[0];
  return {
    id: uid('tsk'),
    projectId: project.personal ? null : project.id,
    parentId: null,
    title: title.trim(),
    description: '',
    status: fallback?.id,
    priority: 'medium',
    assigneeId: null,
    watcherIds: [],
    tags: [],
    startDate: null,
    dueDate: null,
    completedAt: null,
    estimateHours: null,
    timeSpentHours: 0,
    milestone: false,
    dependencies: [],
    checklists: [],
    fields: {},
    createdAt: dayKey(TODAY),
    updatedAt: dayKey(TODAY),
    ...patch,
  };
}

/* ==================================================================== *
 * Small shared pieces
 * ==================================================================== */

/**
 * A status tag for a CUSTOM status. StatusPill only knows the global STATUS
 * table; project statuses are authored per project, so they carry their own
 * hue and are drawn with the DS Chip in that hue.
 */
function StatusTag({ status, className }) {
  return <Chip accent={status.hue} icon={Circle} className={className}>{status.label}</Chip>;
}

function ProgressBar({ pct, hue, className }) {
  const { t, a } = useTheme();
  const c = a(hue);
  return (
    <span className={cx('block h-1.5 rounded-full overflow-hidden', t.bgSubtle, className)}>
      <span className={cx('block h-full rounded-full transition-all', c.solid)} style={{ width: `${pct}%` }} />
    </span>
  );
}

function DueDateLabel({ value, overdue, className }) {
  const { t, a } = useTheme();
  const red = a('red');
  if (!value) return <span className={cx('text-xs', t.textMuted, className)}>No due date</span>;
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs whitespace-nowrap',
      overdue ? cx(red.fg, 'font-medium') : t.textSecondary, className)}>
      <Calendar size={ICON.xs} />
      {fmtDay(value)}
      {overdue && <span className="font-semibold">· overdue</span>}
    </span>
  );
}

function MilestoneMark({ size = 10, className }) {
  const { a } = useTheme();
  return (
    <span
      title="Milestone"
      className={cx('inline-block rotate-45 rounded-[2px] flex-shrink-0', a(HUE_MILESTONE).solid, className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Property icons ClickUp shows next to a task name: description, checklist, dependency. */
function TaskGlyphs({ task, subtaskCount, blocked }) {
  const { t, a } = useTheme();
  const cl = checklistProgress(task);
  const deps = (task.dependencies || []).length;
  return (
    <span className={cx('inline-flex items-center gap-2 text-[10px] flex-shrink-0', t.textMuted)}>
      {task.description ? <Type size={ICON.xs} /> : null}
      {cl.total > 0 && (
        <span className="inline-flex items-center gap-0.5 tabular-nums">
          <ListChecks size={ICON.xs} />{cl.done}/{cl.total}
        </span>
      )}
      {subtaskCount > 0 && (
        <span className="inline-flex items-center gap-0.5 tabular-nums">
          <CornerDownRight size={ICON.xs} />{subtaskCount}
        </span>
      )}
      {deps > 0 && <Link2 size={ICON.xs} className={blocked ? a('red').fg : undefined} />}
      {blocked && <TriangleAlert size={ICON.xs} className={a('red').fg} />}
    </span>
  );
}

/** The dense trigger every inline cell editor shares. */
function CellButton({ onClick, active, muted, title, className, children }) {
  const { t, a } = useTheme();
  const c = a(HUE_PROJECT);
  return (
    <button
      onClick={onClick}
      title={title}
      className={cx('w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs min-w-0 transition-colors text-left',
        active ? cx(c.soft, c.fgOnSoft) : cx(t.bgHover, muted ? t.textMuted : t.textSecondary), className)}
    >
      {children}
    </button>
  );
}

/** An input that commits on Enter and clears — the inline "+ Add task" row. */
function InlineAdd({ placeholder, onAdd, accent = HUE_PROJECT, indent = 0 }) {
  const { t, a } = useTheme();
  const [value, setValue] = useState('');
  const c = a(accent);
  const commit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue('');
  };
  return (
    <div className="flex items-center gap-2 py-1" style={{ paddingLeft: indent }}>
      <Plus size={ICON.sm} className={c.fg} />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder={placeholder}
        className={cx('flex-1 min-w-0 bg-transparent outline-none text-xs py-1', t.text)}
      />
      {value.trim() && <Button size="xs" variant="soft" accent={accent} onClick={commit}>Add</Button>}
    </div>
  );
}

/* ==================================================================== *
 * Inline cell editors
 * ==================================================================== */

function StatusCell({ project, task, onChange }) {
  const [open, setOpen] = useState(false);
  const meta = statusMetaOf(project, task.status);
  const { a } = useTheme();
  return (
    <div className="relative min-w-0">
      <CellButton onClick={() => setOpen(o => !o)} active={open} title="Change status">
        <StatusTag status={meta} />
      </CellButton>
      <Menu open={open} onClose={() => setOpen(false)} width="w-56">
        <MenuLabel>Status</MenuLabel>
        {(project.statuses || PERSONAL_STATUSES).map(s => (
          <MenuItem
            key={s.id} icon={Circle} iconClass={a(s.hue).fg} label={s.label}
            hint={STATUS_GROUPS.find(g => g.id === s.group)?.label}
            selected={s.id === task.status}
            onClick={() => { onChange(s.id); setOpen(false); }}
          />
        ))}
      </Menu>
    </div>
  );
}

function AssigneeCell({ task, people, memberIds, onChange }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const person = people.find(p => p.id === task.assigneeId);
  const options = memberIds.length ? memberIds : people.map(p => p.id);
  return (
    <div className="relative min-w-0">
      <CellButton onClick={() => setOpen(o => !o)} active={open} muted={!person} title="Assign">
        {person ? <Avatar name={person.name} size="sm" /> : <User size={ICON.sm} />}
        <span className="truncate">{person ? person.name.split(' ')[0] : 'Unassigned'}</span>
      </CellButton>
      <Menu open={open} onClose={() => setOpen(false)} width="w-60">
        <MenuLabel>Assignee</MenuLabel>
        {options.map(id => {
          const p = people.find(x => x.id === id);
          if (!p) return null;
          return (
            <MenuItem key={id} icon={User} label={p.name} hint={p.title}
              selected={id === task.assigneeId}
              onClick={() => { onChange(id); setOpen(false); }} />
          );
        })}
        <MenuDivider />
        <MenuItem icon={X} label="Unassigned" selected={!task.assigneeId}
          onClick={() => { onChange(null); setOpen(false); }} />
      </Menu>
      {!person && <span className={cx('sr-only', t.textMuted)}>Unassigned</span>}
    </div>
  );
}

function PriorityCell({ task, onChange }) {
  const [open, setOpen] = useState(false);
  const { a } = useTheme();
  return (
    <div className="relative min-w-0">
      <CellButton onClick={() => setOpen(o => !o)} active={open} title="Set priority">
        <PriorityFlag priority={task.priority || 'medium'} />
      </CellButton>
      <Menu open={open} onClose={() => setOpen(false)} width="w-44">
        <MenuLabel>Priority</MenuLabel>
        {PRIORITY_ORDER.map(p => (
          <MenuItem key={p} icon={Flag} iconClass={a(PRIORITY[p].hue).fg} label={PRIORITY[p].label}
            selected={(task.priority || 'medium') === p}
            onClick={() => { onChange(p); setOpen(false); }} />
        ))}
      </Menu>
    </div>
  );
}

function DateCell({ value, overdue, onChange, label = 'Due date' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0">
      <CellButton onClick={() => setOpen(o => !o)} active={open} muted={!value} title={label}>
        <DueDateLabel value={value} overdue={overdue} />
      </CellButton>
      <Menu open={open} onClose={() => setOpen(false)} width="w-60">
        <MenuLabel>{label}</MenuLabel>
        <div className="px-3 py-2">
          <Input
            type="date" accent={HUE_PROJECT} value={value || ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </div>
        <MenuDivider />
        <MenuItem icon={X} label="Clear" onClick={() => { onChange(null); setOpen(false); }} />
      </Menu>
    </div>
  );
}

function NumberCell({ value, prefix, onChange, label }) {
  const [open, setOpen] = useState(false);
  const shown = value == null || value === '' ? null : (prefix === 'currency' ? formatCurrency(value) : String(value));
  return (
    <div className="relative min-w-0">
      <CellButton onClick={() => setOpen(o => !o)} active={open} muted={!shown} title={label}>
        <span className="truncate tabular-nums">{shown || '—'}</span>
      </CellButton>
      <Menu open={open} onClose={() => setOpen(false)} width="w-56">
        <MenuLabel>{label}</MenuLabel>
        <div className="px-3 py-2">
          <Input type="number" accent={HUE_PROJECT} value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />
        </div>
      </Menu>
    </div>
  );
}

function TextCell({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0">
      <CellButton onClick={() => setOpen(o => !o)} active={open} muted={!value} title={label}>
        <span className="truncate">{value || '—'}</span>
      </CellButton>
      <Menu open={open} onClose={() => setOpen(false)} width="w-64">
        <MenuLabel>{label}</MenuLabel>
        <div className="px-3 py-2">
          <Input accent={HUE_PROJECT} value={value || ''} onChange={(e) => onChange(e.target.value || null)} />
        </div>
      </Menu>
    </div>
  );
}

function SelectCell({ field, value, onChange }) {
  const [open, setOpen] = useState(false);
  const { a } = useTheme();
  const option = (field.options || []).find(o => o.id === value);
  return (
    <div className="relative min-w-0">
      <CellButton onClick={() => setOpen(o => !o)} active={open} muted={!option} title={field.label}>
        {option ? <Chip accent={option.hue}>{option.label}</Chip> : <span className="truncate">—</span>}
      </CellButton>
      <Menu open={open} onClose={() => setOpen(false)} width="w-56">
        <MenuLabel>{field.label}</MenuLabel>
        {(field.options || []).map(o => (
          <MenuItem key={o.id} icon={Circle} iconClass={a(o.hue).fg} label={o.label}
            selected={o.id === value} onClick={() => { onChange(o.id); setOpen(false); }} />
        ))}
        <MenuDivider />
        <MenuItem icon={X} label="Clear" onClick={() => { onChange(null); setOpen(false); }} />
      </Menu>
    </div>
  );
}

function PersonCell({ field, value, people, memberIds, onChange }) {
  const [open, setOpen] = useState(false);
  const person = people.find(p => p.id === value);
  const options = memberIds.length ? memberIds : people.map(p => p.id);
  return (
    <div className="relative min-w-0">
      <CellButton onClick={() => setOpen(o => !o)} active={open} muted={!person} title={field.label}>
        {person ? <Avatar name={person.name} size="sm" /> : <User size={ICON.sm} />}
        <span className="truncate">{person ? person.name.split(' ')[0] : '—'}</span>
      </CellButton>
      <Menu open={open} onClose={() => setOpen(false)} width="w-60">
        <MenuLabel>{field.label}</MenuLabel>
        {options.map(id => {
          const p = people.find(x => x.id === id);
          if (!p) return null;
          return <MenuItem key={id} icon={User} label={p.name} hint={p.title} selected={id === value}
            onClick={() => { onChange(id); setOpen(false); }} />;
        })}
        <MenuDivider />
        <MenuItem icon={X} label="Clear" onClick={() => { onChange(null); setOpen(false); }} />
      </Menu>
    </div>
  );
}

/** Dispatch a custom field to the right inline editor. */
function CustomCell({ field, task, people, memberIds, onChange }) {
  const value = (task.fields || {})[field.id];
  if (field.type === 'select') return <SelectCell field={field} value={value} onChange={onChange} />;
  if (field.type === 'person') return <PersonCell field={field} value={value} people={people} memberIds={memberIds} onChange={onChange} />;
  if (field.type === 'date') return <DateCell value={value || null} onChange={onChange} label={field.label} />;
  if (field.type === 'number') return <NumberCell value={value} onChange={onChange} label={field.label} />;
  if (field.type === 'currency') return <NumberCell value={value} prefix="currency" onChange={onChange} label={field.label} />;
  if (field.type === 'checkbox') {
    return (
      <div className="px-1.5">
        <Checkbox accent={HUE_PROJECT} checked={!!value} onChange={(v) => onChange(v)} />
      </div>
    );
  }
  return <TextCell value={value} onChange={onChange} label={field.label} />;
}

/** Read-only rendering of a custom field value — board cards and the calendar. */
function CustomChip({ field, value, people }) {
  const { t } = useTheme();
  if (value == null || value === '') return null;
  if (field.type === 'select') {
    const o = (field.options || []).find(x => x.id === value);
    return o ? <Chip accent={o.hue} title={field.label}>{o.label}</Chip> : null;
  }
  if (field.type === 'person') {
    const p = people.find(x => x.id === value);
    return p ? <Chip accent={HUE_PROJECT} icon={User} title={field.label}>{p.name}</Chip> : null;
  }
  if (field.type === 'checkbox') {
    return value ? <Chip accent="emerald" icon={Check} title={field.label}>{field.label}</Chip> : null;
  }
  if (field.type === 'currency') return <Chip accent="lime" title={field.label}>{formatCurrency(value)}</Chip>;
  if (field.type === 'date') return <Chip accent="blue" icon={Calendar} title={field.label}>{fmtDay(value)}</Chip>;
  if (field.type === 'number') {
    return <Chip accent="slate" title={field.label}>{field.label}: {value}</Chip>;
  }
  return <Chip accent="slate" title={field.label} className={t.text}>{String(value)}</Chip>;
}

/* ==================================================================== *
 * Landing — the project list
 * ==================================================================== */

export default function Projects({ route: routeProp }) {
  const liveRoute = useRoute();
  const route = routeProp || liveRoute;
  const projects = useStore(s => s.projects);
  const tasks = useStore(s => s.tasks);
  const people = useStore(s => s.directory);
  const currentUser = useStore(s => s.currentUser);
  const curricula = useStore(s => s.curricula);

  const [openTaskId, setOpenTaskId] = useState(null);
  const [newProject, setNewProject] = useState(false);

  const personal = useMemo(() => personalProject(currentUser), [currentUser]);
  const projectId = route.sub || null;
  const project = projectId === PERSONAL_ID ? personal : (projects || []).find(p => p.id === projectId) || null;

  const openTask = (id) => setOpenTaskId(id);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {project ? (
        <ProjectWorkspace
          project={project}
          view={route.id || 'list'}
          tasks={tasks || []}
          people={people || []}
          curricula={curricula || []}
          onOpenTask={openTask}
        />
      ) : (
        <ProjectsLanding
          projects={projects || []}
          personal={personal}
          tasks={tasks || []}
          people={people || []}
          onOpenTask={openTask}
          onNewProject={() => setNewProject(true)}
        />
      )}

      {openTaskId && (
        <TaskModal
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
          onOpenTask={setOpenTaskId}
        />
      )}

      <NewProjectModal
        open={newProject}
        people={people || []}
        currentUser={currentUser}
        onClose={() => setNewProject(false)}
      />
    </div>
  );
}

function ProjectsLanding({ projects, personal, tasks, people, onOpenTask, onNewProject }) {
  const { t } = useTheme();
  const [mode, setMode] = useState('list');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set([projects[0]?.id].filter(Boolean)));

  const all = useMemo(() => [...projects, personal], [projects, personal]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(p => {
      if (p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)) return true;
      return tasksOfProject(tasks, p.id).some(ts => ts.title.toLowerCase().includes(q));
    });
  }, [all, query, tasks]);

  const stats = useMemo(() => {
    let open = 0, overdue = 0, milestones = 0;
    for (const p of all) {
      for (const ts of tasksOfProject(tasks, p.id)) {
        if (!isComplete(p, ts)) open += 1;
        if (isOverdue(p, ts)) overdue += 1;
        if (ts.milestone) milestones += 1;
      }
    }
    return { open, overdue, milestones };
  }, [all, tasks]);

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <>
      <PageHeader
        icon={Briefcase}
        module={MODULE}
        title="Projects"
        subtitle={`${projects.length} projects · ${stats.open} tasks open · ${stats.overdue} overdue`}
        actions={<Button variant="grad" module={MODULE} icon={Plus} onClick={onNewProject}>New project</Button>}
      >
        <Toolbar>
          <SubTabs
            value={mode} onChange={setMode}
            items={[
              { value: 'list', label: 'List', icon: List, accent: HUE_PROJECT },
              { value: 'grid', label: 'Grid', icon: LayoutGrid, accent: HUE_PROJECT },
            ]}
          />
          <SearchInput value={query} onChange={setQuery} accent={HUE_PROJECT}
            placeholder="Search projects and tasks…" width="w-72" />
        </Toolbar>
      </PageHeader>

      <PageBody width="max-w-6xl">
        <div className="space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            <Stat label="projects" value={projects.length} accent={HUE_PROJECT} icon={Briefcase} />
            <Stat label="open tasks" value={stats.open} accent="blue" icon={Circle} />
            <Stat label="overdue" value={stats.overdue} accent="red" icon={TriangleAlert} />
            <Stat label="milestones" value={stats.milestones} accent={HUE_MILESTONE} icon={Flag} />
            <Stat label="personal tasks" value={tasksOfProject(tasks, PERSONAL_ID).length} accent={HUE_TASK} icon={User} />
          </div>

          <Banner accent={HUE_PROJECT} icon={CircleAlert} title="Where a new task lands">
            Expanding a project shows its tasks grouped by that project's own statuses. A task added from a
            group's <strong className={t.text}>+ Add task</strong> row inherits that group — add it under
            <em> Build</em> and it is created in <em>Build</em>, never in the default status. Tasks with no
            project are personal, shown under <strong className={t.text}>My Tasks</strong> in teal, and they
            roll up to no project's progress.
          </Banner>

          {!filtered.length && (
            <EmptyState icon={Briefcase} title="No projects match" hint="Try a different search, or create a project."
              action={<Button variant="grad" module={MODULE} icon={Plus} onClick={onNewProject}>New project</Button>} />
          )}

          {mode === 'list' ? (
            <div className={DENSITY.rowGap}>
              {filtered.map(p => (
                <ProjectRow
                  key={p.id} project={p} tasks={tasks} people={people}
                  expanded={expanded.has(p.id)} onToggle={() => toggle(p.id)}
                  onOpenTask={onOpenTask}
                />
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(p => (
                <ProjectCard key={p.id} project={p} tasks={tasks} people={people} />
              ))}
            </div>
          )}
        </div>
      </PageBody>
    </>
  );
}

function ProjectRow({ project, tasks, people, expanded, onToggle, onOpenTask }) {
  const { t, a } = useTheme();
  const hue = project.personal ? HUE_TASK : HUE_PROJECT;
  const c = a(hue);
  const rows = useMemo(() => tasksOfProject(tasks, project.id), [tasks, project.id]);
  const prog = progressOf(project, rows);
  const overdue = rows.filter(ts => isOverdue(project, ts)).length;
  const memberNames = (project.memberIds || []).map(id => people.find(p => p.id === id)?.name).filter(Boolean);
  const dueOver = project.dueDate && toDay(project.dueDate) < TODAY && prog.pct < 100;

  return (
    // @container, not a viewport breakpoint: the row condenses off its OWN width,
    // so it stays correct when the sidebar expands or the pane narrows.
    <Card className="overflow-hidden @container">
      {/* Expansion is disclosure, not selection: several rows can be open at
          once and one is open by default. The active-nav gradient tint would
          therefore wash most of the list, so the row keeps the card surface and
          the rail carries the hue. Selection is navigation — clicking the name. */}
      <div className={cx('flex items-center gap-3', DENSITY.rowPad)}>
        <span className={cx('w-1 self-stretch min-h-10 rounded-full flex-shrink-0', c.rail)} />
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse tasks' : 'Expand tasks'}
          className={cx('p-1 rounded-md flex-shrink-0', t.bgHover, t.textMuted)}
        >
          {expanded ? <ChevronDown size={ICON.base} /> : <ChevronRight size={ICON.base} />}
        </button>
        <IconTile icon={project.personal ? User : Briefcase} accent={hue} size="sm" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate('projects', project.id, 'list')}
              className={cx('text-sm font-medium truncate hover:underline', t.text)}
            >
              {project.name}
            </button>
            {project.personal && <EntityTag kind="task" />}
            {project.audience === 'external' && <Chip accent="green" icon={Users}>Customer facing</Chip>}
          </div>
          <p className={cx('text-xs truncate', t.textMuted)}>{project.description}</p>
        </div>

        <div className="hidden @2xl:flex items-center gap-2 w-40 flex-shrink-0">
          <ProgressBar pct={prog.pct} hue={hue} className="flex-1" />
          <span className={cx('text-xs tabular-nums w-8 text-right', t.textSecondary)}>{prog.pct}%</span>
        </div>

        <div className={cx('hidden @4xl:block text-xs tabular-nums w-24 text-right flex-shrink-0', t.textMuted)}>
          {prog.done}/{prog.total} done
          {overdue > 0 && <span className={cx('block font-medium', a('red').fg)}>{overdue} overdue</span>}
        </div>

        <div className="hidden @lg:block flex-shrink-0"><AvatarStack names={memberNames} max={4} size="sm" /></div>

        <div className="w-24 flex-shrink-0 text-right">
          <DueDateLabel value={project.dueDate} overdue={dueOver} />
        </div>

        <IconButton icon={ArrowRight} label="Open project" accent={hue}
          onClick={() => navigate('projects', project.id, 'list')} />
      </div>

      {expanded && (
        <div className={cx('border-t', t.borderLight, t.bgSubtle)}>
          <ProjectTaskGroups project={project} rows={rows} people={people} onOpenTask={onOpenTask} />
        </div>
      )}
    </Card>
  );
}

/** The inline expansion: tasks grouped by the project's own statuses. */
function ProjectTaskGroups({ project, rows, people, onOpenTask }) {
  const { t } = useTheme();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const hue = project.personal ? HUE_TASK : HUE_PROJECT;
  const groups = buildGroups(project, rows.filter(r => !r.parentId), 'status', people);

  const toggle = (key) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  if (!rows.length) {
    return (
      <div className="px-4 py-6">
        <EmptyState icon={Circle} title="No tasks yet"
          hint="Add the first task from a status group below once the project has statuses." />
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-1.5">
      {groups.map(g => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <div key={g.key} className={cx('rounded-lg border', t.bgCard, t.borderLight)}>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <button onClick={() => toggle(g.key)} aria-expanded={!isCollapsed}
                className={cx('p-0.5 rounded flex-shrink-0', t.bgHover, t.textMuted)}>
                {isCollapsed ? <ChevronRight size={ICON.sm} /> : <ChevronDown size={ICON.sm} />}
              </button>
              <StatusTag status={statusMetaOf(project, g.key)} />
              <span className={cx('text-xs tabular-nums', t.textMuted)}>{g.tasks.length}</span>
              <span className="flex-1" />
              <span className={cx('text-[10px] uppercase tracking-wider', t.textMuted)}>
                {STATUS_GROUPS.find(x => x.id === g.group)?.label}
              </span>
            </div>

            {!isCollapsed && (
              <div className={cx('border-t px-2 pb-1.5', t.borderLight)}>
                {g.tasks.map(task => (
                  <ExpandedTaskRow
                    key={task.id} project={project} task={task} rows={rows}
                    people={people} onOpenTask={onOpenTask} depth={0}
                  />
                ))}
                <InlineAdd
                  accent={hue}
                  indent={4}
                  placeholder={`Add a task in ${statusMetaOf(project, g.key).label}…`}
                  onAdd={(title) => addTo('tasks', newTask(project, g.patch, title))}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ExpandedTaskRow({ project, task, rows, people, onOpenTask, depth }) {
  const { t, a } = useTheme();
  const kids = childrenOf(rows, task.id).sort(sortTasks);
  const assignee = people.find(p => p.id === task.assigneeId);
  const done = isComplete(project, task);
  const blocked = openBlockers(project, task, rows).length > 0;

  return (
    <>
      <div className="flex items-center gap-2 py-1 group" style={{ paddingLeft: depth * 18 }}>
        <button
          onClick={() => toggleComplete(project, task)}
          aria-label={done ? 'Mark not complete' : 'Mark complete'}
          className={cx('p-0.5 rounded-full flex-shrink-0', t.bgHover, done ? a('emerald').fg : t.textMuted)}
        >
          {done ? <CircleCheck size={ICON.base} /> : <Circle size={ICON.base} />}
        </button>
        {task.milestone && <MilestoneMark />}
        <button
          onClick={() => onOpenTask(task.id)}
          className={cx('flex-1 min-w-0 text-left text-xs truncate hover:underline',
            done ? cx(t.textMuted, 'line-through') : t.text)}
        >
          {task.title}
        </button>
        <TaskGlyphs task={task} subtaskCount={kids.length} blocked={blocked} />
        <PriorityFlag priority={task.priority || 'medium'} withLabel={false} />
        <DueDateLabel value={task.dueDate} overdue={isOverdue(project, task)} className="w-28 justify-end" />
        {assignee ? <Avatar name={assignee.name} size="sm" /> : <span className="w-5" />}
      </div>
      {kids.map(k => (
        <ExpandedTaskRow key={k.id} project={project} task={k} rows={rows}
          people={people} onOpenTask={onOpenTask} depth={depth + 1} />
      ))}
    </>
  );
}

function ProjectCard({ project, tasks, people }) {
  const { t, a } = useTheme();
  const hue = project.personal ? HUE_TASK : HUE_PROJECT;
  const c = a(hue);
  const rows = tasksOfProject(tasks, project.id);
  const prog = progressOf(project, rows);
  const memberNames = (project.memberIds || []).map(id => people.find(p => p.id === id)?.name).filter(Boolean);
  const milestones = rows.filter(ts => ts.milestone);

  return (
    <Card className={cx(DENSITY.cardPad, 'flex flex-col gap-3')}>
      <div className="flex items-start gap-3 min-w-0">
        <IconTile icon={project.personal ? User : Briefcase} accent={hue} />
        <div className="min-w-0 flex-1">
          <button onClick={() => navigate('projects', project.id, 'list')}
            className={cx('text-sm font-medium truncate block w-full text-left hover:underline', t.text)}>
            {project.name}
          </button>
          <p className={cx('text-xs line-clamp-2', t.textMuted)}>{project.description}</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className={cx('text-[11px]', t.textMuted)}>{prog.done} of {prog.total} done</span>
          <span className={cx('text-[11px] font-medium tabular-nums', c.fg)}>{prog.pct}%</span>
        </div>
        <ProgressBar pct={prog.pct} hue={hue} />
      </div>

      {/* Chips carry values, never counts: the overdue chip names the task that is
          late, and the overflow badge does the counting. */}
      <div className="flex items-center flex-wrap gap-1.5">
        <ChipGroup accent="red" icon={TriangleAlert} max={1} render={(x) => x.title}
          items={rows.filter(ts => isOverdue(project, ts))} />
        <ChipGroup accent={HUE_MILESTONE} icon={Flag} max={1} items={milestones} render={(m) => m.title} />
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto">
        <AvatarStack names={memberNames} max={4} size="sm" />
        <DueDateLabel value={project.dueDate} overdue={project.dueDate && toDay(project.dueDate) < TODAY && prog.pct < 100} />
      </div>
    </Card>
  );
}

/* ==================================================================== *
 * Store mutations
 * ==================================================================== */

function toggleComplete(project, task) {
  const done = isComplete(project, task);
  const target = done
    ? (firstStatusOfGroup(project, 'active') || firstStatusOfGroup(project, 'not_started'))
    : firstStatusOfGroup(project, 'done');
  if (!target) return;
  patchIn('tasks', task.id, {
    status: target.id,
    completedAt: done ? null : dayKey(TODAY),
    updatedAt: dayKey(TODAY),
  });
}

function patchTask(id, patch) {
  patchIn('tasks', id, { ...patch, updatedAt: dayKey(TODAY) });
}

/** Status changes carry the completion stamp with them, wherever they are made. */
function setStatus(project, task, statusId) {
  const meta = statusMetaOf(project, statusId);
  const finished = meta.group === 'done' || meta.group === 'closed';
  patchTask(task.id, { status: statusId, completedAt: finished ? (task.completedAt || dayKey(TODAY)) : null });
}

function patchField(task, fieldId, value) {
  const fields = { ...(task.fields || {}) };
  if (value == null || value === '') delete fields[fieldId];
  else fields[fieldId] = value;
  patchTask(task.id, { fields });
}

/* ==================================================================== *
 * Project workspace
 * ==================================================================== */

function ProjectWorkspace({ project, view, tasks, people, curricula, onOpenTask }) {
  const { t } = useTheme();
  const [groupBy, setGroupBy] = useState('status');
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState(false);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [hiddenColumns, setHiddenColumns] = useState(() => new Set(['estimate']));

  const rows = useMemo(() => tasksOfProject(tasks, project.id), [tasks, project.id]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
  }, [rows, query]);

  const topLevel = visible.filter(r => !r.parentId);
  const prog = progressOf(project, rows);
  const hue = project.personal ? HUE_TASK : HUE_PROJECT;
  const curriculum = (curricula || []).find(c => c.id === project.curriculumId);

  const addFromGroup = useCallback((group, title) => {
    addTo('tasks', newTask(project, group.patch, title));
  }, [project]);

  return (
    <>
      <PageHeader
        icon={project.personal ? User : Briefcase}
        module={gradKeyFor(project)}
        title={project.name}
        subtitle={project.description}
        actions={
          <>
            <Button variant="outline" icon={ChevronLeft} onClick={() => navigate('projects')}>All projects</Button>
            {!project.personal && (
              <IconButton icon={Settings2} label="Project settings" accent={hue} onClick={() => setSettings(true)} />
            )}
            <Button variant="grad" module={gradKeyFor(project)} icon={Plus}
              onClick={() => addTo('tasks', newTask(project, {}, 'New task'))}>
              New task
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Breadcrumbs
              items={[{ id: 'root', name: 'Projects' }, { id: project.id, name: project.name }]}
              onNavigate={(item) => { if (item.id === 'root') navigate('projects'); }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <AvatarStack names={(project.memberIds || []).map(id => people.find(p => p.id === id)?.name).filter(Boolean)} max={5} size="sm" />
              <Divider vertical className="h-5" />
              <span className={cx('text-xs tabular-nums', t.textSecondary)}>{prog.pct}% complete</span>
              <ProgressBar pct={prog.pct} hue={hue} className="w-24" />
              {curriculum && <Chip accent="indigo" icon={GraduationCap}>{curriculum.name || curriculum.title}</Chip>}
            </div>
          </div>

          <div className="flex items-end justify-between gap-3 flex-wrap">
            <ViewSwitcher items={VIEWS} value={view} onChange={(v) => navigate('projects', project.id, v)} />
            <div className="flex items-center gap-2 flex-wrap pb-1">
              <GroupByControl value={groupBy} onChange={setGroupBy} />
              {view === 'list' && (
                <ColumnsControl
                  project={project}
                  hidden={hiddenColumns} onChange={setHiddenColumns}
                  showSubtasks={showSubtasks} onShowSubtasks={setShowSubtasks}
                />
              )}
              <SearchInput value={query} onChange={setQuery} accent={hue} placeholder="Search tasks…" width="w-56" />
            </div>
          </div>
        </div>
      </PageHeader>

      <PageBody width={view === 'list' || view === 'calendar' ? 'max-w-6xl' : 'max-w-7xl'}>
        {view === 'list' && (
          <ListView
            project={project} rows={visible} topLevel={topLevel} people={people}
            groupBy={groupBy} hidden={hiddenColumns} showSubtasks={showSubtasks}
            onOpenTask={onOpenTask} onAdd={addFromGroup}
          />
        )}
        {view === 'board' && (
          <BoardView
            project={project} rows={visible} topLevel={topLevel} people={people}
            groupBy={groupBy} onOpenTask={onOpenTask} onAdd={addFromGroup}
          />
        )}
        {view === 'calendar' && (
          <CalendarView project={project} rows={visible} people={people} onOpenTask={onOpenTask} />
        )}
        {view === 'timeline' && (
          <TimelineView project={project} rows={visible} people={people} onOpenTask={onOpenTask} />
        )}
      </PageBody>

      {settings && !project.personal && (
        <ProjectSettingsModal project={project} people={people} tasks={tasks} onClose={() => setSettings(false)} />
      )}
    </>
  );
}

function GroupByControl({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = GROUP_BY.find(g => g.value === value) || GROUP_BY[0];
  return (
    <div className="relative">
      <FilterPill icon={current.icon} label={`Group: ${current.label}`} active open={open} onClick={() => setOpen(o => !o)} />
      <Menu open={open} onClose={() => setOpen(false)} align="right" width="w-56">
        <MenuLabel>Group by</MenuLabel>
        {GROUP_BY.map(g => (
          <MenuItem key={g.value} icon={g.icon} label={g.label} selected={g.value === value}
            hint={g.value === 'status' ? "This project's own statuses" : undefined}
            onClick={() => { onChange(g.value); setOpen(false); }} />
        ))}
      </Menu>
    </div>
  );
}

function ColumnsControl({ project, hidden, onChange, showSubtasks, onShowSubtasks }) {
  const [open, setOpen] = useState(false);
  const toggle = (id) => onChange(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <div className="relative">
      <FilterPill icon={Columns3} label="Columns" active={hidden.size > 0} open={open} onClick={() => setOpen(o => !o)} />
      <Menu open={open} onClose={() => setOpen(false)} align="right" width="w-64">
        <MenuLabel>Show columns</MenuLabel>
        {CORE_COLUMNS.map(col => (
          <MenuItem key={col.id} icon={Eye} label={col.label} selected={!hidden.has(col.id)}
            onClick={() => toggle(col.id)} />
        ))}
        {(project.fields || []).length > 0 && <MenuDivider />}
        {(project.fields || []).map(f => (
          <MenuItem key={f.id} icon={FIELD_TYPE_ICON[f.type] || Type} label={f.label}
            hint={`Custom field · ${f.type}`} selected={!hidden.has(f.id)} onClick={() => toggle(f.id)} />
        ))}
        <MenuDivider />
        <MenuItem icon={CornerDownRight} label="Show subtasks" selected={showSubtasks}
          hint="Subtasks follow their parent's group" onClick={() => onShowSubtasks(!showSubtasks)} />
      </Menu>
    </div>
  );
}

/* ==================================================================== *
 * List view
 * ==================================================================== */

function ListView({ project, rows, topLevel, people, groupBy, hidden, showSubtasks, onOpenTask, onAdd }) {
  const { t } = useTheme();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const groups = buildGroups(project, topLevel, groupBy, people);

  const columns = useMemo(() => {
    const core = CORE_COLUMNS.filter(c => !hidden.has(c.id)).map(c => ({ ...c, kind: 'core' }));
    const custom = (project.fields || []).filter(f => !hidden.has(f.id))
      .map(f => ({ id: f.id, label: f.label, width: f.width || 8, kind: 'custom', field: f }));
    return [...core, ...custom];
  }, [project.fields, hidden]);

  const template = `minmax(16rem, 1fr) ${columns.map(c => `${c.width}rem`).join(' ')}`;

  const toggle = (key) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <div className="space-y-3">
      <Banner accent={HUE_PROJECT} icon={CircleAlert}>
        Adding a task inside a group sets that group's value automatically — grouped by
        <strong className={t.text}> {GROUP_BY.find(g => g.value === groupBy).label.toLowerCase()}</strong>, a task added
        under a heading is created with that {groupBy === 'status' ? 'status' : groupBy}. Subtasks always sit under their
        parent, whatever their own {groupBy === 'status' ? 'status' : groupBy} is.
      </Banner>

      <Card className="overflow-x-auto">
        <div className="min-w-[52rem]">
          <div className={cx('grid gap-2 px-3 py-2 border-b sticky top-0 z-10', t.bgCard, t.border)} style={{ gridTemplateColumns: template }}>
            <GroupLabel>Task</GroupLabel>
            {columns.map(c => <GroupLabel key={c.id} className="truncate">{c.label}</GroupLabel>)}
          </div>

          {groups.map(g => {
            const isCollapsed = collapsed.has(g.key);
            return (
              <div key={g.key} className={cx('border-b last:border-0', t.borderLight)}>
                <div className={cx('flex items-center gap-2 px-3 py-1.5', t.bgSubtle)}>
                  <button onClick={() => toggle(g.key)} aria-expanded={!isCollapsed}
                    className={cx('p-0.5 rounded flex-shrink-0', t.bgHover, t.textMuted)}>
                    {isCollapsed ? <ChevronRight size={ICON.sm} /> : <ChevronDown size={ICON.sm} />}
                  </button>
                  <GroupHeaderLabel group={g} people={people} />
                  <span className={cx('text-xs tabular-nums px-1.5 rounded-full', t.bgCard, t.textMuted)}>{g.tasks.length}</span>
                </div>

                {!isCollapsed && (
                  <div>
                    {g.tasks.map(task => (
                      <TaskListRow
                        key={task.id} project={project} task={task} rows={rows} people={people}
                        columns={columns} template={template} depth={0}
                        showSubtasks={showSubtasks} onOpenTask={onOpenTask}
                      />
                    ))}
                    <div className="px-3">
                      <InlineAdd
                        accent={project.personal ? HUE_TASK : HUE_PROJECT}
                        placeholder={`Add a task in ${g.label}…`}
                        onAdd={(title) => onAdd(g, title)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function GroupHeaderLabel({ group, people }) {
  const { t } = useTheme();
  if (group.kind === 'assignee') {
    const person = people.find(p => p.id === group.key);
    return (
      <span className="flex items-center gap-1.5 min-w-0">
        {person ? <Avatar name={person.name} size="sm" /> : <User size={ICON.sm} className={t.textMuted} />}
        <span className={cx('text-xs font-medium truncate', t.text)}>{group.label}</span>
      </span>
    );
  }
  if (group.kind === 'priority') return <PriorityFlag priority={group.key} />;
  return <StatusTag status={{ label: group.label, hue: group.hue }} />;
}

function TaskListRow({ project, task, rows, people, columns, template, depth, showSubtasks, onOpenTask }) {
  const { t, a } = useTheme();
  const kids = showSubtasks ? childrenOf(rows, task.id).sort(sortTasks) : [];
  const done = isComplete(project, task);
  const blocked = openBlockers(project, task, rows).length > 0;
  const memberIds = project.memberIds || [];

  return (
    <>
      <div className={cx('grid gap-2 px-3 py-1 items-center border-t', t.borderLight, t.bgHover)} style={{ gridTemplateColumns: template }}>
        <div className="flex items-center gap-1.5 min-w-0" style={{ paddingLeft: depth * 20 }}>
          {depth > 0 && <CornerDownRight size={ICON.xs} className={cx('flex-shrink-0', t.textMuted)} />}
          <button
            onClick={() => toggleComplete(project, task)}
            aria-label={done ? 'Mark not complete' : 'Mark complete'}
            className={cx('p-0.5 rounded-full flex-shrink-0', t.bgHover, done ? a('emerald').fg : t.textMuted)}
          >
            {done ? <CircleCheck size={ICON.base} /> : <Circle size={ICON.base} />}
          </button>
          {task.milestone && <MilestoneMark />}
          <button onClick={() => onOpenTask(task.id)}
            className={cx('min-w-0 truncate text-left text-xs hover:underline', done ? cx(t.textMuted, 'line-through') : t.text)}>
            {task.title}
          </button>
          <TaskGlyphs task={task} subtaskCount={childrenOf(rows, task.id).length} blocked={blocked} />
        </div>

        {columns.map(col => {
          if (col.kind === 'custom') {
            return (
              <CustomCell key={col.id} field={col.field} task={task} people={people} memberIds={memberIds}
                onChange={(v) => patchField(task, col.field.id, v)} />
            );
          }
          if (col.id === 'status') {
            return <StatusCell key={col.id} project={project} task={task}
              onChange={(v) => setStatus(project, task, v)} />;
          }
          if (col.id === 'assignee') {
            return <AssigneeCell key={col.id} task={task} people={people} memberIds={memberIds}
              onChange={(v) => patchTask(task.id, { assigneeId: v })} />;
          }
          if (col.id === 'priority') {
            return <PriorityCell key={col.id} task={task} onChange={(v) => patchTask(task.id, { priority: v })} />;
          }
          if (col.id === 'dueDate') {
            return <DateCell key={col.id} value={task.dueDate} overdue={isOverdue(project, task)}
              onChange={(v) => patchTask(task.id, { dueDate: v })} />;
          }
          return (
            <NumberCell key={col.id} value={task.estimateHours} label="Estimate (hours)"
              onChange={(v) => patchTask(task.id, { estimateHours: v })} />
          );
        })}
      </div>

      {kids.map(k => (
        <TaskListRow key={k.id} project={project} task={k} rows={rows} people={people}
          columns={columns} template={template} depth={depth + 1}
          showSubtasks={showSubtasks} onOpenTask={onOpenTask} />
      ))}
    </>
  );
}

/* ==================================================================== *
 * Board view — pointer-event drag, no library.
 * ==================================================================== */

function BoardView({ project, rows, topLevel, people, groupBy, onOpenTask, onAdd }) {
  const { t, a } = useTheme();
  const groups = buildGroups(project, topLevel, groupBy, people);
  const colRefs = useRef({});
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);

  const dragged = drag ? rows.find(r => r.id === drag.taskId) : null;

  const onPointerDown = (e, task) => {
    if (e.button !== undefined && e.button !== 0) return;
    dragRef.current = { taskId: task.id, startX: e.clientX, startY: e.clientY, moved: false, over: null, rects: null };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture unsupported */ }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    if (!d.moved) {
      d.moved = true;
      d.rects = Object.entries(colRefs.current)
        .filter(([, el]) => el)
        .map(([key, el]) => ({ key, rect: el.getBoundingClientRect() }));
    }
    const hit = d.rects.find(r =>
      e.clientX >= r.rect.left && e.clientX <= r.rect.right &&
      e.clientY >= r.rect.top && e.clientY <= r.rect.bottom);
    d.over = hit ? hit.key : null;
    setDrag({ taskId: d.taskId, x: e.clientX, y: e.clientY, over: d.over });
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) {
      onOpenTask(d.taskId);
    } else if (d.over) {
      const target = groups.find(g => g.key === d.over);
      if (target) {
        // Dropping into a Done/Closed column completes the task, exactly as the
        // List view's completion toggle does — one behaviour, two entry points.
        const finished = target.kind === 'status' && (target.group === 'done' || target.group === 'closed');
        patchTask(d.taskId, { ...target.patch, ...(target.kind === 'status' ? { completedAt: finished ? dayKey(TODAY) : null } : {}) });
      }
    }
    setDrag(null);
  };

  return (
    <div className="space-y-3">
      <Banner accent={HUE_PROJECT} icon={GripVertical}>
        Drag a card to another column to change its
        <strong className={t.text}> {groupBy === 'status' ? 'status' : groupBy}</strong> — the board writes the same field
        the List view edits inline. Click a card without dragging to open it.
      </Banner>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-min items-start">
          {groups.map(g => {
            const over = drag?.over === g.key;
            const c = a(g.hue);
            return (
              <div
                key={g.key}
                ref={(el) => { colRefs.current[g.key] = el; }}
                className={cx('w-72 flex-shrink-0 rounded-xl border transition-colors',
                  over ? cx(c.soft, c.borderStrong) : cx(t.bgSubtle, t.borderLight))}
              >
                <div className={cx('flex items-center gap-2 px-3 py-2 border-b', t.borderLight)}>
                  <GroupHeaderLabel group={g} people={people} />
                  <span className={cx('text-xs tabular-nums', t.textMuted)}>{g.tasks.length}</span>
                  <span className="flex-1" />
                  {g.kind === 'status' && (
                    <span className={cx('text-[10px] uppercase tracking-wider', t.textMuted)}>
                      {STATUS_GROUPS.find(x => x.id === g.group)?.label}
                    </span>
                  )}
                </div>

                <div className="p-2 space-y-2 max-h-[58vh] overflow-y-auto">
                  {g.tasks.map(task => (
                    <BoardCard
                      key={task.id} project={project} task={task} rows={rows} people={people}
                      ghost={drag?.taskId === task.id}
                      onPointerDown={(e) => onPointerDown(e, task)}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                    />
                  ))}
                  {!g.tasks.length && (
                    <p className={cx('text-xs text-center py-4', t.textMuted)}>Nothing here</p>
                  )}
                  <InlineAdd
                    accent={project.personal ? HUE_TASK : HUE_PROJECT}
                    placeholder="Add a task…"
                    onAdd={(title) => onAdd(g, title)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {drag && dragged && (
        <div className="fixed z-50 w-64 pointer-events-none opacity-90 rotate-2"
          style={{ left: drag.x + 10, top: drag.y + 10 }}>
          <BoardCard project={project} task={dragged} rows={rows} people={people} preview />
        </div>
      )}
    </div>
  );
}

function BoardCard({ project, task, rows, people, ghost, preview, onPointerDown, onPointerMove, onPointerUp }) {
  const { t, a } = useTheme();
  const assignee = people.find(p => p.id === task.assigneeId);
  const subtasks = childrenOf(rows, task.id);
  const blocked = openBlockers(project, task, rows).length > 0;
  const hue = taskHue(task);
  const c = a(hue);
  const fields = (project.fields || []).filter(f => (task.fields || {})[f.id] != null);
  const cl = checklistProgress(task);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ touchAction: 'none' }}
      className={cx('rounded-lg border p-2.5 select-none', t.bgCard, t.borderLight,
        !preview && 'cursor-grab active:cursor-grabbing',
        ghost && 'opacity-30',
        preview && 'shadow-2xl')}
    >
      <div className="flex items-start gap-2">
        <span className={cx('w-1 self-stretch min-h-6 rounded-full flex-shrink-0', c.rail)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {task.milestone && <MilestoneMark />}
            <p className={cx('text-xs font-medium leading-snug', t.text)}>{task.title}</p>
          </div>
          {blocked && (
            <p className={cx('text-[10px] mt-1 flex items-center gap-1', a('red').fg)}>
              <TriangleAlert size={ICON.xs} /> Blocked by an unfinished task
            </p>
          )}
        </div>
      </div>

      {(fields.length > 0 || (task.tags || []).length > 0) && (
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {fields.slice(0, 3).map(f => (
            <CustomChip key={f.id} field={f} value={(task.fields || {})[f.id]} people={people} />
          ))}
          <ChipGroup accent="slate" max={1} items={task.tags || []} />
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <PriorityFlag priority={task.priority || 'medium'} withLabel={false} />
        <DueDateLabel value={task.dueDate} overdue={isOverdue(project, task)} />
        <span className="flex-1" />
        {subtasks.length > 0 && (
          <span className={cx('text-[10px] tabular-nums inline-flex items-center gap-0.5', t.textMuted)}>
            <CornerDownRight size={ICON.xs} />{subtasks.length}
          </span>
        )}
        {cl.total > 0 && (
          <span className={cx('text-[10px] tabular-nums inline-flex items-center gap-0.5', t.textMuted)}>
            <ListChecks size={ICON.xs} />{cl.done}/{cl.total}
          </span>
        )}
        {assignee && <Avatar name={assignee.name} size="sm" />}
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Calendar view
 * ==================================================================== */

function CalendarView({ project, rows, people, onOpenTask }) {
  const { t, a } = useTheme();
  const [cursor, setCursor] = useState(() => new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
  const cells = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);

  const byDay = useMemo(() => {
    const map = {};
    for (const task of rows) {
      if (!task.dueDate) continue;
      (map[task.dueDate.slice(0, 10)] ||= []).push(task);
    }
    for (const k of Object.keys(map)) map[k].sort(sortTasks);
    return map;
  }, [rows]);

  const unscheduled = rows.filter(r => !r.dueDate).sort(sortTasks);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-2">
        <IconButton icon={ChevronLeft} label="Previous month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} />
        <span className={cx('text-sm font-medium w-40 text-center', t.text)}>
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </span>
        <IconButton icon={ChevronRight} label="Next month"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} />
        <Button size="sm" variant="outline"
          onClick={() => setCursor(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))}>Today</Button>
      </div>

      <Card className="overflow-hidden">
        <div className={cx('grid grid-cols-7 border-b', t.border, t.bgSubtle)}>
          {WEEKDAYS.map(d => (
            <div key={d} className={cx('px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-center', t.textMuted)}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const key = dayKey(date);
            const inMonth = date.getMonth() === cursor.getMonth();
            const items = byDay[key] || [];
            const isToday = key === TODAY_KEY;
            return (
              <div key={key}
                className={cx('min-h-24 border-b border-r p-1', t.borderLight,
                  !inMonth && t.bgSubtle, (i + 1) % 7 === 0 && 'border-r-0')}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cx('text-[11px] tabular-nums w-5 h-5 rounded-full inline-flex items-center justify-center',
                    isToday ? cx(a(HUE_PROJECT).solid, 'text-white font-semibold') : (inMonth ? t.textSecondary : t.textMuted))}>
                    {date.getDate()}
                  </span>
                  {items.length > 3 && <span className={cx('text-[10px]', t.textMuted)}>+{items.length - 3}</span>}
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map(task => (
                    <CalendarChip key={task.id} project={project} task={task} onOpenTask={onOpenTask} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className={DENSITY.cardPad}>
        <div className="flex items-center gap-2 mb-2">
          <GroupLabel>Unscheduled</GroupLabel>
          <span className={cx('text-xs tabular-nums', t.textMuted)}>{unscheduled.length}</span>
          <span className="flex-1" />
          <span className={cx('text-[11px]', t.textMuted)}>No due date — these never appear on the grid</span>
        </div>
        {unscheduled.length ? (
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map(task => (
              <button key={task.id} onClick={() => onOpenTask(task.id)} className="max-w-full">
                <Chip accent={taskHue(task)} icon={task.milestone ? Flag : Circle} title={task.title}>{task.title}</Chip>
              </button>
            ))}
          </div>
        ) : (
          <p className={cx('text-xs', t.textMuted)}>Every task in this project has a due date.</p>
        )}
      </Card>
    </div>
  );
}

function CalendarChip({ project, task, onOpenTask }) {
  const { t, a } = useTheme();
  const overdue = isOverdue(project, task);
  const hue = task.milestone ? HUE_MILESTONE : (overdue ? 'red' : statusMetaOf(project, task.status).hue);
  const c = a(hue);
  return (
    <button
      onClick={() => onOpenTask(task.id)}
      title={task.title}
      className={cx('w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-left truncate',
        c.soft, c.fgOnSoft, t.bgHover)}
    >
      {task.milestone ? <MilestoneMark size={7} /> : <span className={cx('w-1.5 h-1.5 rounded-full flex-shrink-0', c.dot)} />}
      <span className="truncate">{task.title}</span>
    </button>
  );
}

/* ==================================================================== *
 * Timeline view — bars plus SVG dependency arrows.
 * ==================================================================== */

const TL_DAY = 26;
const TL_ROW = 30;
const TL_LABEL = 240;

function TimelineView({ project, rows, people, onOpenTask }) {
  const { t, a } = useTheme();

  const ordered = useMemo(() => {
    const out = [];
    for (const task of rows.filter(r => !r.parentId).sort(sortTasks)) {
      out.push({ task, depth: 0 });
      for (const kid of childrenOf(rows, task.id).sort(sortTasks)) out.push({ task: kid, depth: 1 });
    }
    return out;
  }, [rows]);

  const range = useMemo(() => {
    const dates = [];
    for (const { task } of ordered) {
      if (task.startDate) dates.push(toDay(task.startDate));
      if (task.dueDate) dates.push(toDay(task.dueDate));
    }
    dates.push(TODAY);
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    return { start: addDays(min, -2), end: addDays(max, 3) };
  }, [ordered]);

  const totalDays = Math.max(daysBetween(range.start, range.end) + 1, 14);
  const width = totalDays * TL_DAY;

  const geometry = useMemo(() => {
    const map = {};
    ordered.forEach(({ task }, index) => {
      const due = toDay(task.dueDate);
      if (!due) return;
      const start = toDay(task.startDate) || addDays(due, -2);
      const left = daysBetween(range.start, start) * TL_DAY;
      const span = Math.max(daysBetween(start, due) + 1, 1);
      map[task.id] = { left, width: span * TL_DAY, y: index * TL_ROW + TL_ROW / 2, index };
    });
    return map;
  }, [ordered, range.start]);

  const arrows = useMemo(() => {
    const out = [];
    for (const { task } of ordered) {
      for (const b of relationsOf(task, rows).blockers) {
        const from = geometry[b.id];
        const to = geometry[task.id];
        if (!from || !to) continue;
        out.push({ id: `${b.id}->${task.id}`, from, to });
      }
    }
    return out;
  }, [ordered, rows, geometry]);

  const todayX = daysBetween(range.start, TODAY) * TL_DAY;
  const days = [];
  for (let i = 0; i < totalDays; i++) days.push(addDays(range.start, i));

  return (
    <div className="space-y-3">
      <Banner accent={HUE_PROJECT} icon={Link2}>
        Arrows run from a blocking task to the task waiting on it. A bar that starts before its blocker finishes is
        the schedule risk this view exists to show — the same relationship raises the warning inside the task.
      </Banner>

      <Card className="overflow-x-auto">
        <div style={{ width: TL_LABEL + width }}>
          {/* axis */}
          <div className={cx('flex border-b sticky top-0 z-10', t.border, t.bgCard)}>
            <div className={cx('flex-shrink-0 px-3 py-1.5 border-r', t.borderLight)} style={{ width: TL_LABEL }}>
              <GroupLabel>Task</GroupLabel>
            </div>
            <div className="relative" style={{ width }}>
              <div className="flex">
                {days.map((d) => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  const first = d.getDate() === 1;
                  return (
                    <div key={dayKey(d)} style={{ width: TL_DAY }}
                      className={cx('text-center py-1 border-r', t.borderLight, weekend && t.bgSubtle)}>
                      <span className={cx('block text-[9px] leading-none', t.textMuted)}>
                        {first ? MONTHS_SHORT[d.getMonth()] : WEEKDAYS[(d.getDay() + 6) % 7][0]}
                      </span>
                      <span className={cx('block text-[10px] tabular-nums leading-tight',
                        dayKey(d) === TODAY_KEY ? cx(a(HUE_PROJECT).fg, 'font-semibold') : t.textSecondary)}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* rows */}
          <div className="flex">
            <div className="flex-shrink-0" style={{ width: TL_LABEL }}>
              {ordered.map(({ task, depth }) => (
                <button key={task.id} onClick={() => onOpenTask(task.id)}
                  style={{ height: TL_ROW, paddingLeft: 12 + depth * 16 }}
                  className={cx('w-full flex items-center gap-1.5 pr-2 border-b border-r text-left',
                    t.borderLight, t.bgHover)}>
                  {depth > 0 && <CornerDownRight size={ICON.xs} className={t.textMuted} />}
                  {task.milestone && <MilestoneMark size={8} />}
                  <span className={cx('text-[11px] truncate', t.text)}>{task.title}</span>
                </button>
              ))}
            </div>

            <div className="relative" style={{ width, height: ordered.length * TL_ROW }}>
              {/* day columns */}
              <div className="absolute inset-0 flex">
                {days.map(d => {
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  return <div key={dayKey(d)} style={{ width: TL_DAY }}
                    className={cx('border-r h-full', t.borderLight, weekend && t.bgSubtle)} />;
                })}
              </div>

              {/* today marker */}
              <div className={cx('absolute top-0 bottom-0 w-px', a(HUE_PROJECT).solid)} style={{ left: todayX }} />

              {/* dependency arrows */}
              <svg className="absolute inset-0 pointer-events-none overflow-visible"
                width={width} height={ordered.length * TL_ROW} aria-hidden="true">
                <g className={a('red').fg} stroke="currentColor" fill="currentColor">
                  {arrows.map(arrow => {
                    const x1 = arrow.from.left + arrow.from.width;
                    const y1 = arrow.from.y;
                    const x2 = arrow.to.left;
                    const y2 = arrow.to.y;
                    const mid = Math.max(x1 + 8, x2 - 10);
                    return (
                      <g key={arrow.id}>
                        <path
                          d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2 - 5}`}
                          fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                          opacity="0.75"
                        />
                        <polygon points={`${x2},${y2} ${x2 - 6},${y2 - 3.5} ${x2 - 6},${y2 + 3.5}`} opacity="0.85" />
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* bars */}
              {ordered.map(({ task }, index) => {
                const g = geometry[task.id];
                if (!g) {
                  return (
                    <div key={task.id} className="absolute flex items-center"
                      style={{ top: index * TL_ROW, height: TL_ROW, left: 8 }}>
                      <span className={cx('text-[10px]', t.textMuted)}>no dates</span>
                    </div>
                  );
                }
                return (
                  <TimelineBar key={task.id} project={project} task={task} people={people}
                    geo={g} index={index} onOpenTask={onOpenTask} />
                );
              })}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TimelineBar({ project, task, people, geo, index, onOpenTask }) {
  const { t, a } = useTheme();
  const done = isComplete(project, task);
  const overdue = isOverdue(project, task);
  const hue = task.milestone ? HUE_MILESTONE : (done ? 'emerald' : (overdue ? 'red' : statusMetaOf(project, task.status).hue));
  const c = a(hue);
  const assignee = people.find(p => p.id === task.assigneeId);
  const title = `${task.title} · ${fmtDayYear(task.dueDate)}`;

  if (task.milestone) {
    return (
      <button onClick={() => onOpenTask(task.id)} title={title}
        className="absolute flex items-center gap-1.5"
        style={{ top: index * TL_ROW + 6, left: geo.left + geo.width - 10 }}>
        <MilestoneMark size={14} />
        <span className={cx('text-[10px] whitespace-nowrap', a(HUE_MILESTONE).fg)}>{task.title}</span>
      </button>
    );
  }

  return (
    <button onClick={() => onOpenTask(task.id)} title={title}
      className={cx('absolute rounded-md flex items-center gap-1 px-1.5 overflow-hidden border',
        c.softStrong, c.border, t.bgHover)}
      style={{ top: index * TL_ROW + 5, left: geo.left, width: Math.max(geo.width, 18), height: TL_ROW - 12 }}>
      {assignee && <Avatar name={assignee.name} size="xs" />}
      <span className={cx('text-[10px] truncate', c.fgOnSoft)}>{task.title}</span>
    </button>
  );
}

/* ==================================================================== *
 * Task detail modal
 * ==================================================================== */

function TaskModal({ taskId, onClose, onOpenTask }) {
  const { t, a } = useTheme();
  const tasks = useStore(s => s.tasks);
  const projects = useStore(s => s.projects);
  const directory = useStore(s => s.directory);
  const courses = useStore(s => s.courses);
  const currentUser = useStore(s => s.currentUser);
  const people = directory || [];

  const task = (tasks || []).find(x => x.id === taskId);
  const project = task?.projectId
    ? (projects || []).find(p => p.id === task.projectId)
    : personalProject(currentUser);

  const [depPicker, setDepPicker] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!task || !project) return null;

  const siblings = tasksOfProject(tasks || [], task.projectId || PERSONAL_ID);
  const kids = childrenOf(tasks || [], task.id);
  const parent = task.parentId ? (tasks || []).find(x => x.id === task.parentId) : null;
  const rel = relationsOf(task, siblings);
  const blockers = rel.blockers.filter(b => !isComplete(project, b));
  const started = statusMetaOf(project, task.status).group === 'active';
  const hue = taskHue(task);
  const memberIds = project.memberIds || [];
  const course = task.courseId ? (courses || []).find(c => c.id === task.courseId) : null;
  const cl = checklistProgress(task);

  const runCommand = (id) => {
    if (id === 'checklist') {
      patchTask(task.id, {
        checklists: [...(task.checklists || []), { id: uid('ck'), name: 'Checklist', items: [] }],
      });
    } else if (id === 'todo') {
      const lists = task.checklists || [];
      if (!lists.length) {
        patchTask(task.id, { checklists: [{ id: uid('ck'), name: 'Checklist', items: [{ id: uid('ci'), text: 'New item', done: false }] }] });
      } else {
        patchTask(task.id, {
          checklists: lists.map((c, i) => i === 0
            ? { ...c, items: [...(c.items || []), { id: uid('ci'), text: 'New item', done: false }] }
            : c),
        });
      }
    } else if (id === 'milestone') {
      patchTask(task.id, { milestone: !task.milestone });
    } else if (id === 'waiting') {
      setDepPicker('waiting_on');
    } else if (id === 'blocking') {
      setDepPicker('blocks');
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        accent={hue}
        size="modalLg"
        icon={task.milestone ? Flag : Circle}
        title={task.title}
        subtitle={`${project.name} · ${statusMetaOf(project, task.status).label}${parent ? ` · subtask of ${parent.title}` : ''}`}
        footer={
          <>
            <div className="flex items-center gap-3">
              <span className={cx('text-xs', t.textMuted)}>
                {kids.length} subtasks · {cl.done}/{cl.total} checklist · {(task.dependencies || []).length} dependencies
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" accent="red" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete</Button>
              <Button variant="grad" module={gradKeyFor(project)} icon={Check} onClick={onClose}>Done</Button>
            </div>
          </>
        }
      >
        {/* @container: the modal is a nested pane, so its grids size off the
            modal's own width. sm:/lg: would fire on the WINDOW and give a
            three-up grid inside a 48rem dialog. */}
        <div className="space-y-4 @container">
          {/* quick chip row — counts above the title, ClickUp's own arrangement */}
          <div className="flex flex-wrap items-center gap-1.5">
            <EntityTag kind={task.milestone ? 'milestone' : (task.projectId ? 'projectTask' : 'task')} />
            <StatusTag status={statusMetaOf(project, task.status)} />
            <PriorityFlag priority={task.priority || 'medium'} />
            {course && <Chip accent="indigo" icon={BookMarked}>{course.title || course.name}</Chip>}
            <ChipGroup accent="slate" max={3} items={task.tags || []} />
          </div>

          {started && blockers.length > 0 && (
            <Banner accent="red" icon={TriangleAlert} title="Started while blocked">
              This task is in an active status but is still waiting on{' '}
              <strong className={t.text}>{blockers.map(b => b.title).join(', ')}</strong>. Finish the blocker or move
              this back to a not-started status — a task that runs ahead of its dependency is how a cutover slips.
            </Banner>
          )}

          <Field label="Title">
            <Input accent={hue} value={task.title} onChange={(e) => patchTask(task.id, { title: e.target.value })} />
          </Field>

          <div className="grid @md:grid-cols-2 @2xl:grid-cols-3 gap-3">
            <Field label="Status">
              <Select accent={hue} value={task.status} onChange={(e) => setStatus(project, task, e.target.value)}
                options={(project.statuses || PERSONAL_STATUSES).map(s => ({ value: s.id, label: s.label }))} />
            </Field>
            <Field label="Assignee">
              <Select accent={hue} value={task.assigneeId || ''} placeholder="Unassigned"
                onChange={(e) => patchTask(task.id, { assigneeId: e.target.value || null })}
                options={(memberIds.length ? memberIds : people.map(p => p.id))
                  .map(id => ({ value: id, label: people.find(p => p.id === id)?.name || id }))} />
            </Field>
            <Field label="Priority">
              <Select accent={hue} value={task.priority || 'medium'}
                onChange={(e) => patchTask(task.id, { priority: e.target.value })}
                options={PRIORITY_ORDER.map(p => ({ value: p, label: PRIORITY[p].label }))} />
            </Field>
            <Field label="Start date">
              <Input type="date" accent={hue} value={task.startDate || ''}
                onChange={(e) => patchTask(task.id, { startDate: e.target.value || null })} />
            </Field>
            <Field label="Due date" hint={isOverdue(project, task) ? 'Past due' : undefined}>
              <Input type="date" accent={hue} value={task.dueDate || ''}
                onChange={(e) => patchTask(task.id, { dueDate: e.target.value || null })} />
            </Field>
            <Field label="Time estimate (hours)" hint={task.timeSpentHours ? `${task.timeSpentHours}h tracked` : undefined}>
              <Input type="number" accent={hue} value={task.estimateHours ?? ''}
                onChange={(e) => patchTask(task.id, { estimateHours: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
          </div>

          {/* Milestone is a project concept — hidden on personal tasks rather than shown disabled. */}
          {task.projectId && (
            <div className="flex items-center gap-4 flex-wrap">
              <Toggle accent={HUE_MILESTONE} checked={!!task.milestone}
                onChange={(v) => patchTask(task.id, { milestone: v })}
                label="Milestone — renders as an amber diamond on the timeline and calendar" />
            </div>
          )}

          <DependencySection project={project} task={task} siblings={siblings}
            picker={depPicker} setPicker={setDepPicker} onOpenTask={onOpenTask} />

          <div>
            <GroupLabel className="mb-1.5">Description</GroupLabel>
            <SlashEditor
              value={task.description || ''}
              accent={hue}
              onChange={(v) => patchTask(task.id, { description: v })}
              onCommand={runCommand}
            />
          </div>

          {/* Custom fields are a project concept — personal tasks do not get them. */}
          {!project.personal && (project.fields || []).length > 0 && (
            <div>
              <GroupLabel className="mb-1.5">Custom fields</GroupLabel>
              <Card className="p-3 grid @md:grid-cols-2 gap-3">
                {(project.fields || []).map(f => (
                  <Field key={f.id} label={f.label} hint={f.type === 'currency' ? 'USD' : undefined}>
                    <CustomFieldInput field={f} task={task} people={people} memberIds={memberIds} accent={hue} />
                  </Field>
                ))}
              </Card>
            </div>
          )}

          <SubtaskSection project={project} task={task} kids={kids} people={people} onOpenTask={onOpenTask} />

          <ChecklistSection task={task} />

          <div>
            <GroupLabel className="mb-1.5">Watchers</GroupLabel>
            <div className="flex items-center gap-2 flex-wrap">
              <ChipGroup
                accent={hue} icon={Eye} max={4}
                items={(task.watcherIds || []).map(id => people.find(p => p.id === id)).filter(Boolean)}
                render={(p) => p.name}
                empty={<span className={cx('text-xs', t.textMuted)}>Nobody is watching this task.</span>}
              />
              <WatcherMenu task={task} people={people} memberIds={memberIds} />
            </div>
          </div>

          <div className={cx('text-[11px] flex items-center gap-3', t.textMuted)}>
            <span>Created {fmtDayYear(task.createdAt)}</span>
            <span>·</span>
            <span>Updated {fmtDayYear(task.updatedAt)}</span>
            {task.completedAt && <><span>·</span><span className={a('emerald').fg}>Completed {fmtDayYear(task.completedAt)}</span></>}
          </div>
        </div>
      </Modal>

      <ConfirmDelete
        open={confirmDelete}
        name={task.title}
        kind="task"
        cascadeNote={kids.length ? `This also deletes ${kids.length} subtask${kids.length === 1 ? '' : 's'} beneath it.` : undefined}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          for (const k of kids) removeFrom('tasks', k.id);
          removeFrom('tasks', task.id);
          setConfirmDelete(false);
          onClose();
        }}
      />
    </>
  );
}

function CustomFieldInput({ field, task, people, memberIds, accent }) {
  const value = (task.fields || {})[field.id];
  const set = (v) => patchField(task, field.id, v);

  if (field.type === 'select') {
    return (
      <Select accent={accent} value={value || ''} placeholder="—"
        onChange={(e) => set(e.target.value || null)}
        options={(field.options || []).map(o => ({ value: o.id, label: o.label }))} />
    );
  }
  if (field.type === 'person') {
    return (
      <Select accent={accent} value={value || ''} placeholder="—"
        onChange={(e) => set(e.target.value || null)}
        options={(memberIds.length ? memberIds : people.map(p => p.id))
          .map(id => ({ value: id, label: people.find(p => p.id === id)?.name || id }))} />
    );
  }
  if (field.type === 'checkbox') {
    return <Checkbox accent={accent} label={field.label} checked={!!value} onChange={set} />;
  }
  if (field.type === 'date') {
    return <Input type="date" accent={accent} value={value || ''} onChange={(e) => set(e.target.value || null)} />;
  }
  if (field.type === 'number' || field.type === 'currency') {
    return (
      <Input type="number" accent={accent} value={value ?? ''}
        onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} />
    );
  }
  return <Input accent={accent} value={value || ''} onChange={(e) => set(e.target.value || null)} />;
}

function WatcherMenu({ task, people, memberIds }) {
  const [open, setOpen] = useState(false);
  const options = memberIds.length ? memberIds : people.map(p => p.id);
  const watchers = task.watcherIds || [];
  const toggle = (id) => {
    const next = watchers.includes(id) ? watchers.filter(w => w !== id) : [...watchers, id];
    patchTask(task.id, { watcherIds: next });
  };
  return (
    <div className="relative">
      <Button size="xs" variant="soft" accent={HUE_PROJECT} icon={Plus} onClick={() => setOpen(o => !o)}>Watcher</Button>
      <Menu open={open} onClose={() => setOpen(false)} width="w-60">
        <MenuLabel>Watching</MenuLabel>
        {options.map(id => {
          const p = people.find(x => x.id === id);
          if (!p) return null;
          return <MenuItem key={id} icon={Eye} label={p.name} hint={p.title}
            selected={watchers.includes(id)} onClick={() => toggle(id)} />;
        })}
      </Menu>
    </div>
  );
}

function DependencySection({ project, task, siblings, picker, setPicker, onOpenTask }) {
  const { t, a } = useTheme();
  const rel = relationsOf(task, siblings);
  // Anything already related — in either direction — is off the menu. Adding the
  // same link twice would render two identical rows and store a second copy of a
  // relationship that is supposed to live in exactly one place.
  const related = new Set([...rel.blockers, ...rel.blocking].map(x => x.id));
  const candidates = siblings.filter(s => s.id !== task.id && s.parentId !== task.id && !related.has(s.id));

  const add = (type, id) => {
    const existing = task.dependencies || [];
    if (!existing.some(d => d.taskId === id)) {
      patchTask(task.id, { dependencies: [...existing, { type, taskId: id }] });
    }
    setPicker(null);
  };
  const drop = (id) => {
    patchTask(task.id, { dependencies: (task.dependencies || []).filter(d => d.taskId !== id) });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <GroupLabel>Dependencies</GroupLabel>
        <span className="flex-1" />
        <Button size="xs" variant="soft" accent="red" icon={Link2} onClick={() => setPicker('waiting_on')}>Waiting on</Button>
        <Button size="xs" variant="soft" accent={HUE_PROJECT} icon={Link2} onClick={() => setPicker('blocks')}>Blocking</Button>
      </div>

      {!rel.blockers.length && !rel.blocking.length && (
        <p className={cx('text-xs', t.textMuted)}>No dependencies. This task can start whenever it is picked up.</p>
      )}

      <div className="space-y-1">
        {rel.blockers.map(b => (
          <div key={`w-${b.id}`} className={cx('flex items-center gap-2 px-2 py-1.5 rounded-lg border', t.bgCard, t.borderLight)}>
            <Chip accent="red" icon={Link2}>Waiting on</Chip>
            <button onClick={() => onOpenTask(b.id)} className={cx('flex-1 min-w-0 text-left text-xs truncate hover:underline', t.text)}>
              {b.title}
            </button>
            <StatusTag status={statusMetaOf(project, b.status)} />
            {isComplete(project, b)
              ? <Check size={ICON.base} className={a('emerald').fg} />
              : <TriangleAlert size={ICON.base} className={a('red').fg} />}
            {(task.dependencies || []).some(d => d.taskId === b.id) && (
              <IconButton icon={X} label="Remove dependency" accent="red" onClick={() => drop(b.id)} />
            )}
          </div>
        ))}
        {rel.blocking.map(b => (
          <div key={`b-${b.id}`} className={cx('flex items-center gap-2 px-2 py-1.5 rounded-lg border', t.bgCard, t.borderLight)}>
            <Chip accent={HUE_PROJECT} icon={Link2}>Blocks</Chip>
            <button onClick={() => onOpenTask(b.id)} className={cx('flex-1 min-w-0 text-left text-xs truncate hover:underline', t.text)}>
              {b.title}
            </button>
            <StatusTag status={statusMetaOf(project, b.status)} />
            {(task.dependencies || []).some(d => d.taskId === b.id) && (
              <IconButton icon={X} label="Remove dependency" accent="red" onClick={() => drop(b.id)} />
            )}
          </div>
        ))}
      </div>

      <Modal
        open={!!picker}
        onClose={() => setPicker(null)}
        accent={picker === 'waiting_on' ? 'red' : HUE_PROJECT}
        size="modalSm"
        icon={Link2}
        title={picker === 'waiting_on' ? 'This task is waiting on…' : 'This task blocks…'}
        subtitle="Pick a task in this project"
        z={LAYOUT.zNestedModal}
      >
        <div className="space-y-1 max-h-80 overflow-auto">
          {candidates.map(c => (
            <button key={c.id} onClick={() => add(picker, c.id)}
              className={cx('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left', t.bgHover)}>
              <Circle size={ICON.sm} className={t.textMuted} />
              <span className={cx('flex-1 min-w-0 text-xs truncate', t.text)}>{c.title}</span>
              <StatusTag status={statusMetaOf(project, c.status)} />
            </button>
          ))}
          {!candidates.length && <p className={cx('text-xs', t.textMuted)}>No other tasks in this project yet.</p>}
        </div>
      </Modal>
    </div>
  );
}

function SubtaskSection({ project, task, kids, people, onOpenTask }) {
  const { t, a } = useTheme();
  const hue = taskHue(task);
  // Deleting a subtask is destructive, so it earns the same friction as every
  // other delete in the app — the DS ConfirmDelete, not a bare trash button.
  const [confirm, setConfirm] = useState(null);

  const addSubtask = (title) => {
    addTo('tasks', {
      ...newTask(project, { status: task.status, assigneeId: task.assigneeId }, title),
      parentId: task.id,
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <GroupLabel>Subtasks</GroupLabel>
        <span className={cx('text-xs tabular-nums', t.textMuted)}>{kids.length}</span>
      </div>
      <Card className="p-2">
        {[...kids].sort(sortTasks).map(k => {
          const done = isComplete(project, k);
          const assignee = people.find(p => p.id === k.assigneeId);
          return (
            <div key={k.id} className="flex items-center gap-2 py-1">
              <button onClick={() => toggleComplete(project, k)} aria-label="Toggle subtask"
                className={cx('p-0.5 rounded-full flex-shrink-0', t.bgHover, done ? a('emerald').fg : t.textMuted)}>
                {done ? <CircleCheck size={ICON.base} /> : <Circle size={ICON.base} />}
              </button>
              <button onClick={() => onOpenTask(k.id)}
                className={cx('flex-1 min-w-0 text-left text-xs truncate hover:underline',
                  done ? cx(t.textMuted, 'line-through') : t.text)}>
                {k.title}
              </button>
              <DueDateLabel value={k.dueDate} overdue={isOverdue(project, k)} />
              {assignee && <Avatar name={assignee.name} size="sm" />}
              <IconButton icon={Trash2} label="Delete subtask" accent="red" onClick={() => setConfirm(k)} />
            </div>
          );
        })}
        <InlineAdd accent={hue} placeholder="Add a subtask — it appears nested everywhere this task appears…" onAdd={addSubtask} />
      </Card>

      <ConfirmDelete
        open={!!confirm}
        name={confirm?.title || ''}
        kind="subtask"
        cascadeNote="Its checklists and dependency links go with it."
        onCancel={() => setConfirm(null)}
        onConfirm={() => { removeFrom('tasks', confirm.id); setConfirm(null); }}
      />
    </div>
  );
}

function ChecklistSection({ task }) {
  const { t } = useTheme();
  const lists = task.checklists || [];

  const setLists = (next) => patchTask(task.id, { checklists: next });

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <GroupLabel>Checklists</GroupLabel>
        <span className="flex-1" />
        <Button size="xs" variant="soft" accent={HUE_PROJECT} icon={Plus}
          onClick={() => setLists([...lists, { id: uid('ck'), name: 'Checklist', items: [] }])}>
          Checklist
        </Button>
      </div>

      {!lists.length && <p className={cx('text-xs', t.textMuted)}>No checklists yet. Type <code>/todo</code> in the description to start one.</p>}

      <div className="space-y-2">
        {lists.map((list) => {
          const done = (list.items || []).filter(i => i.done).length;
          return (
            <Card key={list.id} className="p-2">
              <div className="flex items-center gap-2 mb-1">
                <ListChecks size={ICON.base} className={t.textMuted} />
                <input
                  value={list.name}
                  onChange={(e) => setLists(lists.map(l => l.id === list.id ? { ...l, name: e.target.value } : l))}
                  className={cx('flex-1 min-w-0 bg-transparent outline-none text-xs font-medium', t.text)}
                />
                <span className={cx('text-[11px] tabular-nums', t.textMuted)}>{done}/{(list.items || []).length}</span>
                <IconButton icon={Trash2} label="Delete checklist" accent="red"
                  onClick={() => setLists(lists.filter(l => l.id !== list.id))} />
              </div>
              <ProgressBar pct={(list.items || []).length ? Math.round((done / list.items.length) * 100) : 0} hue="emerald" className="mb-1.5" />
              {(list.items || []).map(item => (
                <div key={item.id} className="flex items-center gap-2 py-0.5">
                  <Checkbox
                    accent="emerald" checked={item.done}
                    onChange={(v) => setLists(lists.map(l => l.id === list.id
                      ? { ...l, items: l.items.map(i => i.id === item.id ? { ...i, done: v } : i) }
                      : l))}
                  />
                  <input
                    value={item.text}
                    onChange={(e) => setLists(lists.map(l => l.id === list.id
                      ? { ...l, items: l.items.map(i => i.id === item.id ? { ...i, text: e.target.value } : i) }
                      : l))}
                    className={cx('flex-1 min-w-0 bg-transparent outline-none text-xs',
                      item.done ? cx(t.textMuted, 'line-through') : t.text)}
                  />
                  <IconButton icon={X} label="Remove item" accent="red"
                    onClick={() => setLists(lists.map(l => l.id === list.id
                      ? { ...l, items: l.items.filter(i => i.id !== item.id) }
                      : l))} />
                </div>
              ))}
              <InlineAdd accent="emerald" placeholder="Add an item…"
                onAdd={(text) => setLists(lists.map(l => l.id === list.id
                  ? { ...l, items: [...(l.items || []), { id: uid('ci'), text, done: false }] }
                  : l))} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Slash-command description editor.
 *
 * Typing "/" at the start of a line opens the command list. Insert commands
 * write markdown-ish text; action commands (checklist, dependencies,
 * milestone) hand off to the task via onCommand, so one editor drives both.
 */
function SlashEditor({ value, onChange, onCommand, accent = HUE_PROJECT }) {
  const { t, a } = useTheme();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef(null);
  const c = a(accent);

  const commands = SLASH_COMMANDS.filter(cmd =>
    !filter || cmd.label.toLowerCase().includes(filter.toLowerCase()) || cmd.id.includes(filter.toLowerCase()));

  const handleChange = (e) => {
    const next = e.target.value;
    const caret = e.target.selectionStart;
    const before = next.slice(0, caret);
    const match = before.match(/(?:^|\n)\/(\w*)$/);
    if (match) {
      setFilter(match[1]);
      setOpen(true);
    } else {
      setOpen(false);
      setFilter('');
    }
    onChange(next);
  };

  const runCommand = (cmd) => {
    const el = ref.current;
    const caret = el ? el.selectionStart : value.length;
    const before = value.slice(0, caret).replace(/(?:^|\n)\/(\w*)$/, (m) => m.startsWith('\n') ? '\n' : '');
    const after = value.slice(caret);
    if (cmd.insert) {
      onChange(before + cmd.insert + after);
    } else {
      onChange(before + after);
      onCommand(cmd.id);
    }
    setOpen(false);
    setFilter('');
  };

  return (
    <div className="relative">
      <Textarea
        ref={ref}
        accent={accent}
        rows={5}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}
        placeholder="Describe the work. Type / for commands…"
      />
      <p className={cx('text-[11px] mt-1 flex items-center gap-1', t.textMuted)}>
        <Sparkles size={ICON.xs} className={c.fg} />
        Type <code className={t.text}>/</code> at the start of a line for headings, lists, checklists, dependencies and milestone.
      </p>
      <Menu open={open} onClose={() => setOpen(false)} width="w-72">
        <MenuLabel>Commands</MenuLabel>
        {commands.map(cmd => (
          <MenuItem key={cmd.id} icon={cmd.icon} label={`/${cmd.id}`} hint={`${cmd.label} — ${cmd.hint}`}
            onClick={() => runCommand(cmd)} />
        ))}
        {!commands.length && <MenuItem label="No matching command" onClick={() => setOpen(false)} />}
      </Menu>
    </div>
  );
}

/* ==================================================================== *
 * Project settings — custom statuses, custom fields, members
 * ==================================================================== */

function ProjectSettingsModal({ project, people, tasks, onClose }) {
  const { t, a } = useTheme();
  const [tab, setTab] = useState('statuses');
  const [confirmField, setConfirmField] = useState(null);
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [confirmProject, setConfirmProject] = useState(false);

  const patchProject = (patch) => {
    setCollection('projects', (list = []) => list.map(p => p.id === project.id ? { ...p, ...patch } : p));
  };

  const usedStatuses = useMemo(() => {
    const counts = {};
    for (const ts of tasksOfProject(tasks, project.id)) counts[ts.status] = (counts[ts.status] || 0) + 1;
    return counts;
  }, [tasks, project.id]);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        accent={HUE_PROJECT}
        size="modalLg"
        icon={Settings2}
        title={`${project.name} settings`}
        subtitle="Statuses and custom fields are authored per project — two projects can run genuinely different workflows."
        footer={
          <>
            <Button variant="ghost" accent="red" icon={Trash2} onClick={() => setConfirmProject(true)}>Delete project</Button>
            <Button variant="grad" module={MODULE} icon={Check} onClick={onClose}>Done</Button>
          </>
        }
      >
        <div className="space-y-4">
          <SubTabs
            value={tab} onChange={setTab}
            items={[
              { value: 'statuses', label: 'Statuses', icon: Circle, count: (project.statuses || []).length, accent: HUE_PROJECT },
              { value: 'fields', label: 'Custom fields', icon: Layers, count: (project.fields || []).length, accent: HUE_PROJECT },
              { value: 'members', label: 'Members', icon: Users, count: (project.memberIds || []).length, accent: HUE_PROJECT },
            ]}
          />

          {tab === 'statuses' && (
            <StatusSettings project={project} usage={usedStatuses} onPatch={patchProject}
              onDelete={setConfirmStatus} />
          )}

          {tab === 'fields' && (
            <FieldSettings project={project} onPatch={patchProject} onDelete={setConfirmField} />
          )}

          {tab === 'members' && (
            <div className="space-y-2">
              <Banner accent={HUE_PROJECT} icon={Users}>
                Members are the people offered in every assignee and person-field menu on this project. Removing
                someone does not unassign their tasks — it only takes them out of the pickers.
              </Banner>
              <Card className="p-2 max-h-80 overflow-auto">
                {people.map(p => {
                  const on = (project.memberIds || []).includes(p.id);
                  return (
                    <div key={p.id} className={cx('flex items-center gap-2 px-2 py-1.5 rounded-lg', t.bgHover)}>
                      <Avatar name={p.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className={cx('text-xs truncate', t.text)}>{p.name}</p>
                        <p className={cx('text-[10px] truncate', t.textMuted)}>{p.title}</p>
                      </div>
                      {p.id === project.ownerId && <Chip accent={HUE_PROJECT}>Owner</Chip>}
                      <Toggle accent={HUE_PROJECT} checked={on} onChange={() => {
                        const ids = project.memberIds || [];
                        patchProject({ memberIds: on ? ids.filter(x => x !== p.id) : [...ids, p.id] });
                      }} />
                    </div>
                  );
                })}
              </Card>
            </div>
          )}
        </div>
      </Modal>

      {/* A status is not just a label: every task carries its id. Deleting one
          without rehoming its tasks would leave them pointing at a status the
          project no longer has, and buildGroups would silently drop them from
          List and Board — the task would look deleted. So the confirm names the
          status the work moves to, and the tasks are moved with it. */}
      <ConfirmDelete
        open={!!confirmStatus}
        name={confirmStatus?.label || ''}
        kind="status"
        cascadeNote={confirmStatus && (usedStatuses[confirmStatus.id]
          ? `${usedStatuses[confirmStatus.id]} task${usedStatuses[confirmStatus.id] === 1 ? '' : 's'} move to “${statusAfterRemoval(project, confirmStatus)?.label || '—'}”.`
          : 'No task uses this status.')}
        onCancel={() => setConfirmStatus(null)}
        onConfirm={() => {
          const fallback = statusAfterRemoval(project, confirmStatus);
          if (fallback) {
            for (const ts of tasksOfProject(tasks, project.id)) {
              if (ts.status === confirmStatus.id) patchTask(ts.id, { status: fallback.id });
            }
          }
          patchProject({ statuses: (project.statuses || []).filter(s => s.id !== confirmStatus.id) });
          setConfirmStatus(null);
        }}
      />

      <ConfirmDelete
        open={!!confirmField}
        name={confirmField?.label || ''}
        kind="custom field"
        cascadeNote="Every value stored on this project's tasks for this field is discarded."
        onCancel={() => setConfirmField(null)}
        onConfirm={() => {
          patchProject({ fields: (project.fields || []).filter(f => f.id !== confirmField.id) });
          for (const ts of tasksOfProject(tasks, project.id)) {
            if ((ts.fields || {})[confirmField.id] !== undefined) patchField(ts, confirmField.id, null);
          }
          setConfirmField(null);
        }}
      />

      <ConfirmDelete
        open={confirmProject}
        name={project.name}
        kind="project"
        cascadeNote={`This also deletes all ${tasksOfProject(tasks, project.id).length} tasks in the project, including subtasks and checklists.`}
        onCancel={() => setConfirmProject(false)}
        onConfirm={() => {
          setCollection('tasks', (list = []) => list.filter(ts => ts.projectId !== project.id));
          setCollection('projects', (list = []) => list.filter(p => p.id !== project.id));
          setConfirmProject(false);
          navigate('projects');
        }}
      />
    </>
  );
}

function StatusSettings({ project, usage, onPatch, onDelete }) {
  const { t, a } = useTheme();
  const statuses = project.statuses || [];

  const update = (id, patch) => onPatch({ statuses: statuses.map(s => s.id === id ? { ...s, ...patch } : s) });
  const add = (group) => onPatch({
    statuses: [...statuses, { id: uid('st'), label: 'New status', hue: 'gray', group }],
  });

  return (
    <div className="space-y-3">
      <Banner accent="amber" icon={CircleAlert} title="Done is not Closed">
        A task in a <strong className={t.text}>Done</strong> status is finished but still open — it is never counted
        overdue and it releases anything waiting on it. <strong className={t.text}>Closed</strong> takes it off the
        board entirely. Every project needs at least one of each, or work has nowhere to land.
      </Banner>

      {STATUS_GROUPS.map(g => {
        const list = statuses.filter(s => s.group === g.id);
        return (
          <div key={g.id}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cx('w-2 h-2 rounded-full', a(g.hue).dot)} />
              <GroupLabel>{g.label}</GroupLabel>
              <span className={cx('text-xs tabular-nums', t.textMuted)}>{list.length}</span>
              <span className="flex-1" />
              <Button size="xs" variant="soft" accent={HUE_PROJECT} icon={Plus} onClick={() => add(g.id)}>Status</Button>
            </div>
            <Card className="p-2 space-y-1.5">
              {!list.length && <p className={cx('text-xs px-1', t.textMuted)}>No statuses in this group.</p>}
              {list.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className={cx('w-2.5 h-2.5 rounded-full flex-shrink-0', a(s.hue).dot)} />
                  <span className="flex-1 min-w-0">
                    <Input accent={HUE_PROJECT} value={s.label}
                      onChange={(e) => update(s.id, { label: e.target.value })} />
                  </span>
                  <span className="w-28 flex-shrink-0">
                    <Select accent={HUE_PROJECT} value={s.hue} options={HUE_OPTIONS}
                      onChange={(e) => update(s.id, { hue: e.target.value })} />
                  </span>
                  <span className="w-32 flex-shrink-0">
                    <Select accent={HUE_PROJECT} value={s.group} options={STATUS_GROUP_OPTIONS}
                      onChange={(e) => update(s.id, { group: e.target.value })} />
                  </span>
                  <span className={cx('text-[11px] tabular-nums w-14 text-right flex-shrink-0', t.textMuted)}>
                    {usage[s.id] || 0} tasks
                  </span>
                  <IconButton icon={Trash2} accent="red"
                    label={statuses.length > 1 ? 'Delete status' : 'A project needs at least one status'}
                    disabled={statuses.length <= 1}
                    className={statuses.length <= 1 ? 'opacity-40 pointer-events-none' : undefined}
                    onClick={() => onDelete(s)} />
                </div>
              ))}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function FieldSettings({ project, onPatch, onDelete }) {
  const { t } = useTheme();
  const fields = project.fields || [];

  const update = (id, patch) => onPatch({ fields: fields.map(f => f.id === id ? { ...f, ...patch } : f) });
  const add = () => onPatch({ fields: [...fields, { id: uid('cf'), label: 'New field', type: 'text', width: 8 }] });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GroupLabel>Fields on every task in this project</GroupLabel>
        <span className="flex-1" />
        <Button size="xs" variant="soft" accent={HUE_PROJECT} icon={Plus} onClick={add}>Field</Button>
      </div>

      {!fields.length && (
        <EmptyState icon={Layers} title="No custom fields"
          hint="Custom fields become columns in List and chips on Board cards." />
      )}

      <div className="space-y-2">
        {fields.map(f => (
          <Card key={f.id} className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <IconTile icon={FIELD_TYPE_ICON[f.type] || Type} accent={HUE_PROJECT} size="sm" />
              <span className="flex-1 min-w-0">
                <Input accent={HUE_PROJECT} value={f.label}
                  onChange={(e) => update(f.id, { label: e.target.value })} />
              </span>
              <span className="w-36 flex-shrink-0">
                <Select accent={HUE_PROJECT} value={f.type}
                  options={FIELD_TYPES.map(x => ({ value: x.value, label: x.label }))}
                  onChange={(e) => update(f.id, { type: e.target.value, options: e.target.value === 'select' ? (f.options || []) : undefined })} />
              </span>
              <IconButton icon={Trash2} label="Delete field" accent="red" onClick={() => onDelete(f)} />
            </div>

            {f.type === 'select' && (
              <div className="pl-10 space-y-1.5">
                <GroupLabel>Options</GroupLabel>
                {(f.options || []).map(o => (
                  <div key={o.id} className="flex items-center gap-2">
                    <Chip accent={o.hue}>{o.label || 'Untitled'}</Chip>
                    <span className="flex-1 min-w-0">
                      <Input accent={HUE_PROJECT} value={o.label}
                        onChange={(e) => update(f.id, { options: f.options.map(x => x.id === o.id ? { ...x, label: e.target.value } : x) })} />
                    </span>
                    <span className="w-28 flex-shrink-0">
                      <Select accent={HUE_PROJECT} value={o.hue} options={HUE_OPTIONS}
                        onChange={(e) => update(f.id, { options: f.options.map(x => x.id === o.id ? { ...x, hue: e.target.value } : x) })} />
                    </span>
                    <IconButton icon={X} label="Remove option" accent="red"
                      onClick={() => update(f.id, { options: f.options.filter(x => x.id !== o.id) })} />
                  </div>
                ))}
                <InlineAdd placeholder="Add an option…"
                  onAdd={(label) => update(f.id, { options: [...(f.options || []), { id: uid('opt'), label, hue: 'slate' }] })} />
              </div>
            )}

            {f.type === 'currency' && (
              <p className={cx('text-[11px] pl-10', t.textMuted)}>Rendered as USD. Values are stored as plain numbers.</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ==================================================================== *
 * New project
 * ==================================================================== */

const WORKFLOW_TEMPLATES = [
  {
    id: 'delivery', label: 'Delivery', hint: 'Discovery → Build → Validate',
    statuses: [
      { id: 'backlog', label: 'Backlog', hue: 'gray', group: 'not_started' },
      { id: 'discovery', label: 'Discovery', hue: 'blue', group: 'active' },
      { id: 'build', label: 'Build', hue: 'amber', group: 'active' },
      { id: 'validate', label: 'Validation', hue: 'violet', group: 'active' },
      { id: 'signed_off', label: 'Signed off', hue: 'emerald', group: 'done' },
      { id: 'closed', label: 'Closed', hue: 'gray', group: 'closed' },
    ],
  },
  {
    id: 'engineering', label: 'Engineering', hint: 'Review and QA gates',
    statuses: [
      { id: 'todo', label: 'To Do', hue: 'gray', group: 'not_started' },
      { id: 'in_progress', label: 'In Progress', hue: 'amber', group: 'active' },
      { id: 'code_review', label: 'Code Review', hue: 'violet', group: 'active' },
      { id: 'qa', label: 'QA', hue: 'cyan', group: 'active' },
      { id: 'shipped', label: 'Shipped', hue: 'emerald', group: 'done' },
      { id: 'closed', label: 'Closed', hue: 'gray', group: 'closed' },
    ],
  },
  {
    id: 'content', label: 'Content', hint: 'Draft → Review → Publish',
    statuses: [
      { id: 'outline', label: 'Outline', hue: 'gray', group: 'not_started' },
      { id: 'drafting', label: 'Drafting', hue: 'blue', group: 'active' },
      { id: 'review', label: 'In Review', hue: 'violet', group: 'active' },
      { id: 'published', label: 'Published', hue: 'emerald', group: 'done' },
      { id: 'archived', label: 'Archived', hue: 'slate', group: 'closed' },
    ],
  },
];

function NewProjectModal({ open, people, currentUser, onClose }) {
  const { t } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [template, setTemplate] = useState('delivery');
  const [members, setMembers] = useState(() => (currentUser ? [currentUser.id] : []));

  useEffect(() => {
    if (!open) return;
    setName(''); setDescription(''); setDueDate(''); setTemplate('delivery');
    setMembers(currentUser ? [currentUser.id] : []);
  }, [open, currentUser]);

  if (!open) return null;

  const chosen = WORKFLOW_TEMPLATES.find(x => x.id === template) || WORKFLOW_TEMPLATES[0];

  const create = () => {
    if (!name.trim()) return;
    const id = uid('prj');
    addTo('projects', {
      id,
      name: name.trim(),
      key: name.trim().slice(0, 4).toUpperCase(),
      description: description.trim(),
      status: 'in_progress',
      audience: 'internal',
      ownerId: currentUser?.id || null,
      memberIds: members,
      startDate: dayKey(TODAY),
      dueDate: dueDate || null,
      createdAt: dayKey(TODAY),
      statuses: chosen.statuses.map(s => ({ ...s })),
      fields: [],
    });
    onClose();
    navigate('projects', id, 'list');
  };

  return (
    <Modal
      open
      onClose={onClose}
      accent={HUE_PROJECT}
      icon={Briefcase}
      title="New project"
      subtitle="Pick the workflow it runs — statuses can be edited afterwards in project settings."
      footer={
        <>
          <span className={cx('text-xs', t.textMuted)}>{chosen.statuses.length} statuses · {members.length} members</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button variant="grad" module={MODULE} icon={Check} disabled={!name.trim()} onClick={create}>
              Create project
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4 @container">
        <Field label="Project name" required>
          <Input accent={HUE_PROJECT} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Warehouse Automation Pilot" />
        </Field>
        <Field label="Description">
          <Textarea accent={HUE_PROJECT} rows={2} value={description}
            onChange={(e) => setDescription(e.target.value)} placeholder="What does done look like?" />
        </Field>
        <Field label="Due date">
          <Input type="date" accent={HUE_PROJECT} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>

        <Field label="Workflow" hint="Sets the project's custom statuses. Every template has a Done and a Closed group.">
          <div className="grid @lg:grid-cols-3 gap-2">
            {WORKFLOW_TEMPLATES.map(tpl => (
              <TemplateTile key={tpl.id} template={tpl} selected={tpl.id === template} onSelect={() => setTemplate(tpl.id)} />
            ))}
          </div>
        </Field>

        <Field label="Members">
          <Card className="p-2 max-h-56 overflow-auto">
            {people.map(p => {
              const on = members.includes(p.id);
              return (
                <div key={p.id} className={cx('flex items-center gap-2 px-2 py-1 rounded-lg', t.bgHover)}>
                  <Avatar name={p.name} size="sm" />
                  <span className={cx('flex-1 min-w-0 text-xs truncate', t.text)}>{p.name}</span>
                  <span className={cx('text-[10px] truncate', t.textMuted)}>{p.title}</span>
                  <Toggle accent={HUE_PROJECT} checked={on}
                    onChange={() => setMembers(on ? members.filter(x => x !== p.id) : [...members, p.id])} />
                </div>
              );
            })}
          </Card>
        </Field>
      </div>
    </Modal>
  );
}

function TemplateTile({ template, selected, onSelect }) {
  const { t, a } = useTheme();
  const c = a(HUE_PROJECT);
  return (
    <button
      onClick={onSelect}
      className={cx('p-2.5 rounded-xl border-2 text-left transition-colors',
        selected ? cx(c.borderStrong, c.soft) : cx('border-transparent', t.bgCard, t.bgHover))}
    >
      <p className={cx('text-xs font-medium', selected ? t.text : t.textSecondary)}>{template.label}</p>
      <p className={cx('text-[10px] mb-1.5', t.textMuted)}>{template.hint}</p>
      <span className="flex flex-wrap gap-1">
        {template.statuses.map(s => (
          <span key={s.id} className={cx('w-2 h-2 rounded-full', a(s.hue).dot)} title={s.label} />
        ))}
      </span>
    </button>
  );
}
