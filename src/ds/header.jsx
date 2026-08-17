import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { useTheme, cx, useDismiss } from './ThemeContext.jsx';
import { ICON, headWash, moduleGradient } from './tokens.js';
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
 * THE SHAPE IS FIXED. This is the rule the second pass added, and it is the
 * one that matters most. The band used to be a single `flex-wrap` row holding
 * identity, primary action and every control at once, so it reflowed as the
 * window changed width — 56px at 1728px, 103px at 1400px, 141px at 1024px on
 * Workspace. Worse, it reflowed WITHOUT the window moving: `subsetLabel()`
 * swaps a long resting subtitle for "20 of 118 shown" the moment a filter is
 * set, and because `truncate` implies `white-space: nowrap`, flexbox breaks
 * lines against the FULL string. Typing in the search box could unwrap the
 * header; clearing it could wrap it again. A header that changes shape while
 * you use it reads as broken.
 *
 * So there are now two bands of FIXED height and neither may wrap:
 *
 *   ROW 1  identity (left) · the view control (centred) · actions + primary (right)
 *   ROW 2  the filter bar: in-page search, then the filters, then Clear all
 *
 * Row 1 is a three-column grid rather than a flex row with spacers, because a
 * spacer centres against the CONTENT either side of it — so the view control
 * would slide sideways every time the subtitle changed length, which is the
 * same bug in a quieter form. Equal `minmax(0,1fr)` side tracks hold the
 * centre still no matter what flanks it.
 *
 * Row 2 shrinks by SCROLLING, never by wrapping — the condensing rule
 * `nav.jsx` already documents for the lens bar.
 * ====================================================================== */

/** One height, one radius, everywhere in a header. */
export const CONTROL_H = 'h-[30px]';
export const CONTROL_R = 'rounded-lg';

/** The two bands. Fixed, never `min-h-` — a floor is what let the row grow. */
const ROW1_H = 'h-[52px]';
const ROW2_H = 'h-[44px]';

export function ModuleHeader({
  module: moduleKey,
  icon: Icon,
  gradient,
  accent = 'purple',
  title,
  subtitle,
  /**
   * The view control — a LensBar, SubTabs or ViewSwitcher. Centred in row 1,
   * because it is the one control that says which slice of the module you are
   * looking at, and centring it stops it competing with either edge.
   */
  nav,
  /** The primary action. Sits at the right end of row 1. */
  primary,
  /**
   * Trailing band content: status indicators and secondary actions — a progress
   * bar, a member stack, a back control. Documented as "trailing" rather than
   * "secondary actions" because in practice it carries both, and calling it
   * actions-only led a module to file a progress bar under it as if it were one.
   */
  actions,
  /** Row 2. Pass a <FilterBar>; omit it and the header is one band tall. */
  filterBar,
  className,
}) {
  const { t, dark } = useTheme();
  const tile = gradient || (moduleKey ? moduleGradient(moduleKey, 'tile') : null);

  return (
    /* `data-module-header` is the hook test/width-check.js measures. Finding the
     * band by walking up from the <h2> stops at the first full-width ancestor —
     * which is row 1 — so the gate silently measured only half the header and
     * would have passed a filter bar that wrapped. */
    <div data-module-header="" className={cx('flex-shrink-0 border-b', t.border, headWash(dark), className)}>
      <div className={cx('px-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3', ROW1_H)}>
        <div className="flex items-center gap-3 min-w-0">
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
        </div>

        <div className="flex items-center justify-center min-w-0">{nav}</div>

        <div className="flex items-center justify-end gap-2 min-w-0">
          {actions}
          {primary}
        </div>
      </div>

      {filterBar}
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
 *
 * It lives on the filter bar rather than up beside the title, because it and
 * the filters do the same job — they narrow the list — and a control that has
 * been separated from its siblings has to be re-found every time.
 * ====================================================================== */

export function ScopedSearch({ value, onChange, scope, width = 'w-[190px]', accent = 'purple' }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <div className={cx('flex items-center gap-2 px-2.5 border transition-colors flex-shrink-0',
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
 * FilterBar — row 2, and always present.
 *
 * It replaces the old FilterTray, which only rendered when something was
 * active. That was a good idea for a band of filters and a fatal one once the
 * search field moved down here: the filter button's own handler cleared the
 * values AND closed the tray, so a single click would have unmounted the
 * search field and thrown away whatever had been typed into it. A control you
 * are typing in cannot live in a container that another control can dismiss.
 *
 * So the band is permanent, and the filter toggle that used to open it is
 * gone — there is nothing left to open.
 *
 * It scrolls rather than wraps, which is what keeps the header's height fixed.
 * That makes it a clipping context, so every menu opened from it is positioned
 * `fixed` (see MultiSelectFilter) instead of `absolute`.
 * ====================================================================== */

export function FilterBar({
  search, filters = [], value = {}, onChange, onClearAll, accent = 'purple', children,
}) {
  const { t, a } = useTheme();
  const c = a(accent);
  const activeCount = countActive(value);

  return (
    <div className={cx('px-4 flex items-center gap-2 border-t', ROW2_H, t.borderLight, t.bgSubtle)}>
      {/* The controls scroll; Clear all does NOT. A narrow window used to push it
        * off the end of the row, which meant a list could be filtered with no
        * visible way to unfilter it — the same class of fault as a filter whose
        * control is hidden. The way out of a state has to stay on screen. */}
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto">
        {search}
        {filters.map(f => (
          <MultiSelectFilter
            key={f.id}
            filter={f}
            accent={accent}
            selected={value[f.id] || []}
            onChange={(next) => onChange({ ...value, [f.id]: next })}
          />
        ))}
        {children}
      </div>
      {activeCount > 0 && (
        <button onClick={onClearAll} className={cx('text-xs font-medium flex-shrink-0', c.fg)}>
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
 *
 * The panel is `fixed`, not `absolute`. Its row scrolls horizontally, and an
 * `overflow-x: auto` box clips its children in BOTH axes — an absolute panel
 * would be sliced off at the band's bottom edge. A fixed element escapes that
 * clip (no ancestor here establishes a containing block for it), while staying
 * a DOM descendant, so the existing outside-click ref still covers it.
 * ====================================================================== */

export function MultiSelectFilter({ filter, selected = [], onChange, accent = 'purple' }) {
  const { t, a } = useTheme();
  const c = a(accent);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null);

  /* A fixed panel does not follow its anchor, so re-measure whenever anything
   * that could move the button happens. `true` on the scroll listener catches
   * the filter bar's own horizontal scroll, which does not bubble. */
  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const W = 240; // w-60
    setPos({
      left: Math.round(Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - W - 8))),
      top: Math.round(r.bottom + 6),
    });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const on = () => place();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
    };
  }, [open, place]);

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
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cx('flex items-center gap-1.5 px-2.5 border transition-colors max-w-[15rem]',
          CONTROL_H, CONTROL_R, t.bgInput, on ? cx(c.borderStrong, t.text) : cx(t.borderLight, t.textSecondary))}
      >
        {filter.icon && <filter.icon size={ICON.base} className={cx('flex-shrink-0', on ? c.fg : t.textMuted)} />}
        <span className="text-xs truncate">{label}</span>
        <ChevronDown size={ICON.sm} className={cx('flex-shrink-0', t.textMuted, open && 'rotate-180')} />
      </button>

      {open && pos && (
        <div
          style={{ left: pos.left, top: pos.top }}
          className={cx('fixed w-60 rounded-xl border shadow-2xl overflow-hidden z-50', t.modal, t.borderLight)}
        >
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
 * Header filter state: the multi-select values and the in-page query.
 *
 * There is no tray flag any more. The filter bar is always rendered, so there
 * is no state in which a filter is active while its control is hidden — which
 * is the invariant the old `trayOpen || activeCount > 0` was there to protect.
 */
export function useHeaderFilters(initial = {}) {
  const [values, setValues] = useState(initial);
  const [query, setQuery] = useState('');

  const activeCount = useMemo(() => countActive(values), [values]);
  const clearAll = useCallback(() => { setValues({}); setQuery(''); }, []);

  return {
    values, setValues, query, setQuery,
    activeCount,
    clearAll,
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
