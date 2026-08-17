import React, { useMemo } from 'react';
import {
  Plus, Pencil, UserPlus, MessageSquare, Check, X, ArrowUpRight, Send,
  UserCheck, Award, PackageOpen, PackageCheck, Play, Archive, CircleCheckBig,
  History, Bot, Circle,
} from 'lucide-react';
import {
  useTheme, cx, ICON, entityHue, ENTITIES,
  Avatar, Chip, IconTile, GroupLabel, Divider, EmptyState,
} from '@/ds';
import { useStore, NOW } from '@/store/store.js';
import { navigate } from '@/lib/router.js';

/**
 * The shared activity feed.
 *
 * One component renders the audit log everywhere it appears — the workspace
 * feed, a record's history panel, a person's trail — because they are the same
 * stream read through different filters. The caller does the filtering and
 * passes `entries`; with no `entries` prop the feed reads the whole log from
 * the store, so dropping it onto a page costs one line.
 *
 * WHAT THE READER GETS, AND WHY IT IS SHAPED THIS WAY
 *   - a SENTENCE, not a field dump. "Emma Williams approved CHG-1045" reads in
 *     one pass; `verb: approved · target: chg-1045` does not.
 *   - the target as a CHIP IN ITS ENTITY HUE, so the colour tells you what kind
 *     of record was touched before you read a word of it. The hue comes from
 *     ENTITIES in tokens.js — the feed keeps no colour table of its own.
 *   - DAY GROUPING. An undivided list of forty timestamps has no shape; a day
 *     heading gives the eye somewhere to land and makes "nothing happened on
 *     Sunday" visible instead of inferred.
 *   - relative time in the row, absolute time in its tooltip. Relative answers
 *     "is this fresh?", absolute answers "what exactly happened when?", and
 *     showing both inline would double the width of the column.
 *
 * NON-HUMAN ACTORS are first class. An automation that escalated a ticket at
 * 03:00 acted on its own; attributing that to its author would be a lie in an
 * audit log, so `actorId` may be an automation id and it renders with a bot
 * tile instead of an avatar. Customers (contact ids) resolve the same way,
 * because in the external product they open and answer their own tickets.
 */

/* ------------------------------------------------------------------ *
 * Verbs
 *
 * The phrase is written to complete "<Actor> ___ <target>", so the sentence
 * builds itself. An unknown verb degrades to its own name with the underscores
 * removed rather than throwing away the entry — an audit log that hides events
 * it does not recognise is worse than one that renders them plainly.
 *
 * `selfPhrase` covers the case where the actor IS the target: an automation
 * that swept forty tickets has no single record to point at, and "Triage ran
 * Triage" is not a sentence.
 * ------------------------------------------------------------------ */

const VERBS = {
  created:        { phrase: 'created',        icon: Plus,           hue: 'blue' },
  updated:        { phrase: 'updated',        icon: Pencil,         hue: 'slate' },
  assigned:       { phrase: 'assigned',       icon: UserPlus,       hue: 'violet' },
  commented:      { phrase: 'commented on',   icon: MessageSquare,  hue: 'sky' },
  approved:       { phrase: 'approved',       icon: Check,          hue: 'emerald' },
  rejected:       { phrase: 'rejected',       icon: X,              hue: 'red' },
  escalated:      { phrase: 'escalated',      icon: ArrowUpRight,   hue: 'orange' },
  published:      { phrase: 'published',      icon: Send,           hue: 'emerald' },
  enrolled:       { phrase: 'enrolled in',    icon: UserCheck,      hue: 'indigo' },
  completed:      { phrase: 'completed',      icon: Award,          hue: 'emerald' },
  checked_out:    { phrase: 'checked out',    icon: PackageOpen,    hue: 'cyan' },
  checked_in:     { phrase: 'checked in',     icon: PackageCheck,   hue: 'cyan' },
  ran_automation: { phrase: 'ran on',         icon: Play,           hue: 'sky', selfPhrase: 'ran' },
  closed:         { phrase: 'closed',         icon: CircleCheckBig, hue: 'gray' },
  resolved:       { phrase: 'resolved',       icon: CircleCheckBig, hue: 'emerald' },
  archived:       { phrase: 'archived',       icon: Archive,        hue: 'slate' },
};

function verbMeta(verb) {
  return VERBS[verb] || {
    phrase: String(verb || 'touched').replace(/_/g, ' '),
    icon: Circle,
    hue: 'gray',
  };
}

/* ------------------------------------------------------------------ *
 * Targets
 *
 * `targetType` is an ENTITIES key so the hue resolves for free. These aliases
 * exist only for the shorthands a writer naturally reaches for — an "asset" is
 * a hardware record, "knowledge" is an article — so a seed author is never
 * forced to spell an entity key they do not think in.
 * ------------------------------------------------------------------ */

const TARGET_ALIAS = {
  asset: 'hardware',
  licence: 'software',
  license: 'software',
  knowledge: 'article',
  kb: 'article',
  incident: 'ticket',
  module: 'courseModule',
};

/** Where clicking a target chip goes. Absent = the chip is not a link. */
const TARGET_ROUTE = {
  ticket:       ['workspace', 'tickets'],
  conversation: ['workspace', 'tickets'],
  task:         ['workspace', 'tasks'],
  contact:      ['workspace', 'contacts'],
  problem:      ['problems', null],
  change:       ['changes', null],
  approval:     ['approvals', null],
  project:      ['projects', null],
  article:      ['knowledge', null],
  guide:        ['knowledge', null],
  lesson:       ['knowledge', null],
  course:       ['learning', 'courses'],
  curriculum:   ['learning', 'curricula'],
  hardware:     ['assets', 'hardware'],
  software:     ['assets', 'software'],
  location:     ['assets', 'locations'],
  contract:     ['assets', 'contracts'],
  automation:   ['automations', null],
  form:         ['forms', null],
  subform:      ['forms', null],
  item:         ['catalog', null],
  product:      ['catalog', null],
  subcategory:  ['catalog', null],
};

/* An unregistered type keeps its own name: entityHue() answers grey for it and
 * TARGET_ROUTE has no entry, so it renders as a plain neutral chip. Coercing it
 * to a known kind would paint it in a hue that lies about what it is. */
function targetKind(type) {
  return TARGET_ALIAS[type] || type;
}

/* ------------------------------------------------------------------ *
 * Time
 *
 * `now` defaults to the DEMO CLOCK, not the wall clock. Seed timestamps are
 * written against 2026-08-16T09:00, so defaulting to `new Date()` would render
 * every entry as "3 months ago" the moment this prototype is demoed later than
 * it was built. A caller with real data passes its own `now`.
 * ------------------------------------------------------------------ */

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "2 hours ago" / "in 20 minutes" / "just now".
 * Exported because several modules render a timestamp without rendering a feed.
 */
export function relativeTime(iso, now = NOW) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const ref = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const delta = (ref - then) / 1000;
  const ahead = delta < 0;
  const s = Math.abs(delta);

  let label;
  if (s < 45) return 'just now';
  else if (s < 90) label = '1 minute';
  else if (s < 45 * MINUTE) label = plural(Math.round(s / MINUTE), 'minute');
  else if (s < 90 * MINUTE) label = '1 hour';
  else if (s < 22 * HOUR) label = plural(Math.round(s / HOUR), 'hour');
  else if (s < 36 * HOUR) label = '1 day';
  else if (s < 7 * DAY) label = plural(Math.round(s / DAY), 'day');
  else if (s < 28 * DAY) label = plural(Math.round(s / (7 * DAY)), 'week');
  else if (s < 340 * DAY) label = plural(Math.round(s / (30 * DAY)), 'month');
  else label = plural(Math.round(s / (365 * DAY)), 'year');

  return ahead ? `in ${label}` : `${label} ago`;
}

function plural(n, unit) {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Today / Yesterday / a weekday inside the last week / an explicit date. */
function dayLabel(d, now) {
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / (DAY * 1000));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return WEEKDAYS[d.getDay()];
  return `${WEEKDAYS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function clockLabel(d) {
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m}${suffix}`;
}

function absoluteLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${clockLabel(d)}`;
}

/* ------------------------------------------------------------------ *
 * Actors
 * ------------------------------------------------------------------ */

function buildActors(directory, contacts, automations) {
  const map = new Map();
  for (const p of directory || []) map.set(p.id, { name: p.name, sub: p.title, kind: 'person' });
  for (const c of contacts || []) if (!map.has(c.id)) map.set(c.id, { name: c.name, sub: c.title, kind: 'contact' });
  for (const a of automations || []) map.set(a.id, { name: a.name, sub: 'Automation', kind: 'automation' });
  return map;
}

function resolveActor(id, actors) {
  return actors.get(id) || { name: 'RelayHQ', sub: 'System', kind: 'system' };
}

/* ------------------------------------------------------------------ *
 * Grouping
 * ------------------------------------------------------------------ */

function groupByDay(entries, now) {
  const out = [];
  let current = null;
  for (const e of entries) {
    const d = new Date(e.at);
    const key = Number.isNaN(d.getTime()) ? 'unknown' : dayKey(d);
    if (!current || current.key !== key) {
      current = { key, label: Number.isNaN(d.getTime()) ? 'Undated' : dayLabel(d, now), entries: [] };
      out.push(current);
    }
    current.entries.push(e);
  }
  return out;
}

/* ==================================================================== *
 * ActivityFeed
 * ==================================================================== */

/**
 * @param entries  the rows to render. Omit to read the whole log from the store.
 * @param limit    render at most this many of the most recent entries.
 * @param compact  single-line rows for a sidebar or a card footer.
 * @param title    optional heading above the feed.
 * @param now      the clock relative times are measured against.
 */
export function ActivityFeed({ entries, limit, compact = false, title, now = NOW, className }) {
  const { t } = useTheme();
  const stored = useStore(s => s.activity);
  const directory = useStore(s => s.directory);
  const contacts = useStore(s => s.contacts);
  const automations = useStore(s => s.automations);

  const actors = useMemo(
    () => buildActors(directory, contacts, automations),
    [directory, contacts, automations],
  );

  const source = entries || stored || [];

  // Newest first. The store holds the log append-only (oldest first), which is
  // the right storage order and the wrong reading order.
  const rows = useMemo(() => {
    const sorted = [...source].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return typeof limit === 'number' ? sorted.slice(0, limit) : sorted;
  }, [source, limit]);

  const days = useMemo(() => groupByDay(rows, now), [rows, now]);
  const hidden = source.length - rows.length;

  return (
    <div className={cx('@container min-w-0', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 mb-2">
          <GroupLabel>{title}</GroupLabel>
          <span className={cx('text-[11px] tabular-nums flex-shrink-0', t.textMuted)}>
            {hidden > 0 ? `${rows.length} of ${source.length}` : `${rows.length}`}
          </span>
        </div>
      )}

      {days.length === 0 ? (
        compact ? (
          <p className={cx('text-xs py-2', t.textMuted)}>Nothing has happened here yet.</p>
        ) : (
          <EmptyState
            icon={History}
            title="No activity yet"
            hint="Every create, assignment, approval and automation run lands here as it happens."
          />
        )
      ) : (
        <div className={compact ? 'space-y-3' : 'space-y-4'}>
          {days.map(day => (
            <ActivityDay key={day.key} day={day} actors={actors} compact={compact} now={now} />
          ))}
        </div>
      )}

      {hidden > 0 && (
        <p className={cx('text-[11px] mt-3', t.textMuted)}>
          {hidden} earlier {hidden === 1 ? 'entry' : 'entries'} not shown.
        </p>
      )}
    </div>
  );
}

export default ActivityFeed;

/* ------------------------------------------------------------------ *
 * One day of the log
 * ------------------------------------------------------------------ */

function ActivityDay({ day, actors, compact, now }) {
  const { t } = useTheme();
  return (
    <section>
      <div className="flex items-center gap-2 mb-1.5">
        <GroupLabel className="flex-shrink-0">{day.label}</GroupLabel>
        <Divider className="flex-1" />
        <span className={cx('text-[10px] tabular-nums flex-shrink-0', t.textMuted)}>{day.entries.length}</span>
      </div>

      {/* The rail threads the day's avatars together so the eye reads a
          sequence rather than a stack of unrelated rows. */}
      <div className="relative">
        <span
          aria-hidden="true"
          className={cx('absolute top-3 bottom-3 w-px', compact ? 'left-[14px]' : 'left-4', t.rule)}
        />
        <div className={compact ? 'space-y-0' : 'space-y-0.5'}>
          {day.entries.map(entry => (
            <ActivityRow
              key={entry.id}
              entry={entry}
              actor={resolveActor(entry.actorId, actors)}
              compact={compact}
              now={now}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * One entry
 * ------------------------------------------------------------------ */

function ActivityRow({ entry, actor, compact, now }) {
  const { t, a } = useTheme();
  const verb = verbMeta(entry.verb);
  const kind = targetKind(entry.targetType);
  const c = a(entityHue(kind));
  const vc = a(verb.hue);
  const VerbIcon = verb.icon;
  const route = TARGET_ROUTE[kind];
  const isBot = actor.kind === 'automation' || actor.kind === 'system';

  // An automation acting on itself (a sweep with no single subject) drops the
  // chip and takes the shorter phrase.
  const selfTargeted = !!entry.targetId && entry.targetId === entry.actorId;
  const phrase = selfTargeted ? (verb.selfPhrase || verb.phrase) : verb.phrase;

  return (
    <div className={cx('relative flex items-start gap-2.5 rounded-lg px-1 py-1.5 transition-colors', t.bgHover)}>
      <span className={cx('flex-shrink-0 flex justify-center', compact ? 'w-5' : 'w-6')}>
        {isBot
          ? <IconTile icon={Bot} accent={entityHue('automation')} size="sm" />
          : <Avatar name={actor.name} size={compact ? 'sm' : 'md'} ring />}
      </span>

      {/* Narrow panes stack the timestamp under the sentence; from 28rem of
          CONTAINER width it pins right. Container query, not viewport — this
          feed sits in a sidebar on one screen and a full column on another. */}
      <div className="flex-1 min-w-0 flex flex-col @md:flex-row @md:items-baseline gap-x-3">
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm leading-snug', t.textSecondary)}>
            <span className={cx('font-medium', t.text)}>{actor.name}</span>
            {' '}
            <VerbIcon size={ICON.xs} className={cx('inline-block align-middle', vc.fg)} aria-hidden="true" />
            {' '}
            {phrase}
            {!selfTargeted && (
              <>
                {' '}
                <ActivityTarget entry={entry} kind={kind} accent={c} route={route} />
              </>
            )}
          </p>
          {!compact && entry.detail && (
            <p className={cx('text-xs mt-0.5 leading-relaxed', t.textMuted)}>{entry.detail}</p>
          )}
        </div>

        <span
          title={absoluteLabel(entry.at)}
          className={cx('text-[11px] tabular-nums whitespace-nowrap flex-shrink-0 @md:text-right', t.textMuted)}
        >
          {relativeTime(entry.at, now)}
        </span>
      </div>
    </div>
  );
}

/* The target chip. It is a link when the entity has a screen to land on, and
 * plain text-in-a-chip when it does not — a dead control that looks live is
 * worse than an honest label. */
function ActivityTarget({ entry, kind, accent, route }) {
  const label = entry.targetLabel || entry.targetId || ENTITIES[kind]?.label || 'record';
  const chip = <Chip accent={entityHue(kind)} title={label}>{label}</Chip>;

  if (!route || !entry.targetId) return chip;

  return (
    <button
      onClick={() => navigate(route[0], route[1], entry.targetId)}
      title={`Open ${label}`}
      className={cx('inline-flex max-w-full align-middle rounded-full', accent.softHover)}
    >
      {chip}
    </button>
  );
}
