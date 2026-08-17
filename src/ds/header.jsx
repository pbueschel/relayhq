import React, { useState, useMemo, useCallback } from 'react';
import { Search, X, SlidersHorizontal, ChevronDown, Check } from 'lucide-react';
import { useTheme, cx, useDismiss } from './ThemeContext.jsx';
import { ICON, DENSITY, headWash, moduleGradient } from './tokens.js';
import { IconTile } from './primitives.jsx';

/* ====================================================================== *
 * THE MODULE HEADER
 *
 * Replaces the four stacked bands every module used to open with. The faults
 * it exists to fix, in the order they were diagnosed:
 *
 *   - the top bar's left third carried nothing while the sidebar and the title
 *     band both carried context
 *   - search was centred, the title beneath it was left-aligned, and the
 *     toolbars below were centred again, so nothing shared an edge
 *   - the primary action sat a thousand pixels from the title it belonged to
 *   - the stat strip and the lens bar printed the same numbers in two shapes
 *   - five control radii at three heights
 *
 * The arrangement now: ONE title band carrying identity, the primary action
 * beside its title, and on the right the lens, a scoped in-page search and a
 * filter toggle. Filters live in a tray that only exists when it is doing
 * something. Every control is CONTROL_H tall with one radius.
 *
 * The stat strip is gone on purpose: the lens already carries the counts.
 * ====================================================================== */

/** One height, one radius, everywhere in a header. */
export const CONTROL_H = 'h-[30px]';
const CONTROL_R = 'rounded-lg';

export function ModuleHeader({
  module: moduleKey,
  icon: Icon,
  gradient,
  accent = 'purple',
  title,
  subtitle,
  /** The primary action. Sits BESIDE the title, not across the pane from it. */
  primary,
  /** Secondary actions, pushed to the right of the band. */
  actions,
  /** Right-hand cluster: lens, scoped search, filter toggle. */
  tools,
  /** The filter tray, rendered as its own band when open. */
  tray,
  className,
}) {
  const { t, dark } = useTheme();
  const tile = gradient || (moduleKey ? moduleGradient(moduleKey, 'tile') : null);

  return (
    <div className="flex-shrink-0">
      <div className={cx('px-4 flex items-center gap-3 flex-wrap py-2.5 min-h-[56px]',
        tray ? '' : 'border-b', t.border, headWash(dark), className)}>
        {Icon && (
          tile
            ? <span className={cx('w-[30px] h-[30px] rounded-lg flex items-center justify-center shadow-md flex-shrink-0', tile)}>
                <Icon size={ICON.md} className="text-white" />
              </span>
            : <IconTile icon={Icon} accent={accent} />
        )}

        <div className="min-w-0">
          <h2 className={cx('text-[15px] font-semibold leading-tight truncate', t.text)}>{title}</h2>
          {subtitle && <p className={cx('text-[11px] leading-tight truncate', t.textMuted)}>{subtitle}</p>}
        </div>

        {primary && <div className="flex-shrink-0 ml-1">{primary}</div>}

        <div className="flex-1 min-w-[8px]" />

        {tools && <div className="flex items-center gap-2 flex-wrap">{tools}</div>}
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {tray}
    </div>
  );
}

/* ====================================================================== *
 * ScopedSearch — the in-page search.
 *
 * Two search fields on one screen is confusing unless they announce which is
 * which, so this one NAMES ITS OWN SCOPE in the placeholder: "Search 20 items…"
 * becomes "Search 5 tickets…" when the lens changes. The global field keeps ⌘K
 * in the bar above and searches everything.
 * ====================================================================== */

export function ScopedSearch({ value, onChange, scope, width = 'w-[190px]', accent = 'purple' }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <div className={cx('flex items-center gap-2 px-2.5 border transition-colors',
      CONTROL_H, CONTROL_R, t.bgInput, value ? c.borderStrong : t.borderLight, width)}>
      <Search size={ICON.base} className={cx('flex-shrink-0', value ? c.fg : t.textMuted)} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={scope ? `Search ${scope}…` : 'Search…'}
        aria-label={scope ? `Search ${scope}` : 'Search this page'}
        className={cx('flex-1 min-w-0 bg-transparent outline-none text-xs', t.text)}
      />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search"
          className={cx('flex-shrink-0', t.textMuted)}>
          <X size={ICON.sm} />
        </button>
      )}
    </div>
  );
}

/* ====================================================================== *
 * FilterToggle — opens the tray. Carries a count so a collapsed tray never
 * hides the fact that something is filtered.
 * ====================================================================== */

export function FilterToggle({ open, onClick, count = 0, accent = 'purple' }) {
  const { t, a } = useTheme();
  const c = a(accent);
  const on = open || count > 0;
  return (
    <button
      onClick={onClick}
      aria-expanded={!!open}
      aria-label={count ? `Filters, ${count} active` : 'Filters'}
      className={cx('flex items-center gap-1.5 px-2.5 border transition-colors',
        CONTROL_H, CONTROL_R, t.bgInput, on ? cx(c.borderStrong, t.text) : cx(t.borderLight, t.textSecondary))}
    >
      <SlidersHorizontal size={ICON.base} className={on ? c.fg : t.textMuted} />
      {count > 0 && (
        <span className={cx('text-[10px] font-bold px-1.5 rounded-full tabular-nums text-white', c.solid)}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ====================================================================== *
 * FilterTray — the band that only exists when it is doing something.
 * ====================================================================== */

export function FilterTray({ open, filters = [], value = {}, onChange, onClearAll, children }) {
  const { t, a } = useTheme();
  const c = a('purple');
  if (!open) return null;

  const activeCount = countActive(value);

  return (
    <div className={cx('px-4 py-2 border-b flex items-center gap-2 flex-wrap', t.border, t.bgSubtle)}>
      {filters.map(f => (
        <MultiSelectFilter
          key={f.id}
          filter={f}
          selected={value[f.id] || []}
          onChange={(next) => onChange({ ...value, [f.id]: next })}
        />
      ))}
      {children}
      <div className="flex-1 min-w-[8px]" />
      {activeCount > 0 && (
        <button onClick={onClearAll} className={cx('text-xs font-medium', c.fg)}>
          Clear all
        </button>
      )}
    </div>
  );
}

/* ====================================================================== *
 * MultiSelectFilter
 *
 * Multi-select, not single. "Unassigned OR assigned to me" is the most common
 * triage question there is and a single-select control cannot express it at all.
 *
 * Two further rules it enforces:
 *   - options carry COUNTS, so you can see what a choice costs before making it
 *   - a set filter shows its VALUES ("Queue · Customer Support +1"), never a
 *     bare category name. Same rule the chips follow.
 * ====================================================================== */

export function MultiSelectFilter({ filter, selected = [], onChange, accent = 'purple' }) {
  const { t, a } = useTheme();
  const c = a(accent);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const options = filter.options || [];
  const chosen = options.filter(o => selected.includes(o.value));
  const on = chosen.length > 0;

  const label = !on
    ? filter.label
    : `${filter.label} · ${chosen[0].label}${chosen.length > 1 ? ` +${chosen.length - 1}` : ''}`;

  const toggle = (v) => {
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cx('flex items-center gap-1.5 px-2.5 border transition-colors max-w-[15rem]',
          CONTROL_H, CONTROL_R, t.bgInput, on ? cx(c.borderStrong, t.text) : cx(t.borderLight, t.textSecondary))}
      >
        {filter.icon && <filter.icon size={ICON.base} className={cx('flex-shrink-0', on ? c.fg : t.textMuted)} />}
        <span className="text-xs truncate">{label}</span>
        <ChevronDown size={ICON.sm} className={cx('flex-shrink-0', t.textMuted, open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cx('absolute left-0 top-full mt-1.5 w-60 rounded-xl border shadow-2xl overflow-hidden z-50',
          t.modal, t.borderLight)}>
          <div className={cx('flex items-center justify-between px-3 py-2 border-b', t.borderLight)}>
            <span className={cx('text-[10px] font-semibold uppercase tracking-wider', t.textMuted)}>
              {filter.label}
            </span>
            {on && (
              <button onClick={() => onChange([])} className={cx('text-[11px] font-medium', c.fg)}>Clear</button>
            )}
          </div>

          <div className="max-h-64 overflow-auto py-0.5">
            {options.length === 0 && (
              <p className={cx('px-3 py-4 text-xs text-center', t.textMuted)}>Nothing to filter by yet.</p>
            )}
            {options.map(o => {
              const isOn = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className={cx('w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors', t.bgHover)}
                >
                  <span className={cx('w-[14px] h-[14px] rounded flex items-center justify-center flex-shrink-0 border',
                    isOn ? cx(c.solid, 'border-transparent') : cx(t.bgInput, t.borderLight))}>
                    {isOn && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  {o.dot && <span className={cx('w-2 h-2 rounded-full flex-shrink-0', o.dot)} />}
                  <span className={cx('text-xs flex-1 truncate', t.text)}>{o.label}</span>
                  {o.count != null && (
                    <span className={cx('text-[10px] tabular-nums flex-shrink-0', t.textMuted)}>{o.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {filter.footer && (
            <div className={cx('px-3 py-2 border-t text-[11px]', t.borderLight, c.fg)}>{filter.footer}</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ====================================================================== *
 * State helpers
 * ====================================================================== */

export function countActive(value = {}) {
  return Object.values(value).reduce((n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0);
}

/**
 * Header filter state: the multi-select values, the tray's open flag, and the
 * in-page query. The tray opens itself whenever something is active, so a
 * filter can never be on while its control is hidden.
 */
export function useHeaderFilters(initial = {}) {
  const [values, setValues] = useState(initial);
  const [query, setQuery] = useState('');
  const [trayOpen, setTrayOpen] = useState(false);

  const activeCount = useMemo(() => countActive(values), [values]);
  const clearAll = useCallback(() => setValues({}), []);

  return {
    values, setValues, query, setQuery,
    activeCount,
    trayOpen: trayOpen || activeCount > 0,
    toggleTray: () => setTrayOpen(o => !o),
    clearAll: () => { clearAll(); setTrayOpen(false); },
    /** True when nothing narrows the list — lets a view skip filtering entirely. */
    isClean: activeCount === 0 && query.trim() === '',
  };
}

/**
 * The subtitle always tells the truth about what is on screen.
 *   nothing filtered → "20 assigned to you"
 *   filtered         → "9 of 20 shown"
 * One place, one rule, so a subset is never mistaken for the whole.
 */
export function subsetLabel(shown, total, restingLabel) {
  if (shown === total) return restingLabel;
  return `${shown} of ${total} shown`;
}

/** Count how many records in `list` match a value, for the option counts. */
export function optionCounts(list, getValue) {
  const out = new Map();
  for (const r of list || []) {
    const v = getValue(r);
    const vals = Array.isArray(v) ? v : [v];
    for (const x of vals) {
      if (x == null) continue;
      out.set(x, (out.get(x) || 0) + 1);
    }
  }
  return out;
}

/** Does a record pass a multi-select filter? An empty selection matches everything. */
export function passes(selected, recordValue) {
  if (!selected || selected.length === 0) return true;
  const vals = Array.isArray(recordValue) ? recordValue : [recordValue];
  return selected.some(s => vals.includes(s));
}
