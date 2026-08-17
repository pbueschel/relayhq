import React from 'react';
import { useTheme, cx } from './ThemeContext.jsx';
import { ICON, DENSITY, headWash, moduleGradient } from './tokens.js';
import { IconTile } from './primitives.jsx';

/* ==================================================================== *
 * LensBar — the centred segmented control from the v1 workspace.
 *
 * THE CONTAINER-QUERY RULE (v1 principle 4, kept verbatim):
 * viewport breakpoints (`md:` / `lg:`) respond to the *window* and therefore
 * fire at the wrong moment when the element sits inside a sub-pane. This bar
 * sizes off its OWN width using `container-type: inline-size` and
 * `clamp(min, Ncqw, max)`, tightening continuously and only wrapping as a
 * last resort. Classes live in index.css under .lens-*; this is the reference
 * implementation every other condensing control should copy.
 * ==================================================================== */

export function LensBar({ items = [], value, onChange, split, inline = false }) {
  const { t } = useTheme();
  // `split` lets a long bar break into two centred groups rather than wrapping raggedly.
  const groups = split ? [items.slice(0, split), items.slice(split)] : [items];

  // `inline` drops the container-query shell. `container-type: inline-size`
  // CONTAINS the inline axis, so an element carrying it cannot be sized by its
  // own contents — correct for the centred standalone bar, but inside a flex
  // row it makes the pills overflow their box and collide with whatever sits
  // next to them. Inline mode sizes to content and shrinks by scrolling.
  if (inline) {
    return (
      <div className={cx('inline-flex flex-nowrap p-1 rounded-xl border min-w-0 overflow-x-auto',
        t.bgSubtle, t.borderLight)}>
        {items.map(item => (
          <Lens key={item.value} item={item} active={value === item.value} onChange={onChange} inline />
        ))}
      </div>
    );
  }

  return (
    <div className="lens-shell flex justify-center">
      <div className={cx('lens-track inline-flex flex-wrap justify-center p-1.5 rounded-2xl border',
        t.bgSubtle, t.borderLight)}>
        {groups.map((g, gi) => (
          <div key={gi} className="lens-group flex">
            {g.map(item => <Lens key={item.value} item={item} active={value === item.value} onChange={onChange} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

function Lens({ item, active, onChange, inline = false }) {
  const { t, a } = useTheme();
  const c = a(item.accent || 'purple');
  const Icon = item.icon;
  return (
    <button
      onClick={() => onChange(item.value)}
      aria-pressed={active}
      title={item.label}
      className={cx('flex items-center gap-1.5 rounded-lg font-medium transition-colors whitespace-nowrap flex-shrink-0',
        inline ? 'px-2.5 py-1 text-xs' : 'lens-pill py-1.5 text-sm',
        active ? cx(t.bgCard, t.text, 'shadow-sm') : cx(t.textSecondary, t.bgHover))}
    >
      {Icon && <Icon size={ICON.base} className={active ? c.fg : t.textMuted} />}
      <span>{item.label}</span>
      {item.count != null && (
        <span className={cx('text-[10px] tabular-nums px-1.5 py-0.5 rounded-full',
          active ? cx(c.soft, c.fgOnSoft) : cx(t.bgSubtle, t.textMuted))}>
          {item.count}
        </span>
      )}
    </button>
  );
}

/* ==================================================================== *
 * SubTabs — the pill group used inside a module header
 * (Business Rules' Queues/Routing/Workflows, Assets' Hardware/Software/Locations).
 * ==================================================================== */

export function SubTabs({ items = [], value, onChange, className }) {
  const { t, a } = useTheme();
  return (
    <div className={cx('inline-flex gap-1 p-1 rounded-lg', t.bgSubtle, className)}>
      {items.map(item => {
        const active = value === item.value;
        const c = a(item.accent || 'purple');
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cx('px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap',
              active ? cx(t.bgCard, t.text, 'shadow-sm') : cx(t.textSecondary, t.bgHover))}
          >
            {Icon && <Icon size={ICON.base} className={active ? c.fg : t.textMuted} />}
            {item.label}
            {item.count != null && <span className={cx('text-xs tabular-nums', t.textMuted)}>({item.count})</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ==================================================================== *
 * ViewSwitcher — the ClickUp-style view bar (List / Board / Calendar / …).
 * Visually distinct from SubTabs: underline rather than pill, because it
 * switches how the SAME data is drawn rather than which data you are on.
 * ==================================================================== */

export function ViewSwitcher({ items = [], value, onChange, inline = false, className }) {
  const { t, a } = useTheme();
  const c = a('violet');

  /**
   * `inline` — for use inside a ModuleHeader's tools cluster.
   *
   * The underline treatment below is meaningful as a standalone bar under a
   * title, but it cannot live in a band flattened to one control height: a
   * horizontal rule ends up floating through the middle of the row. So at
   * header scale the distinction from SubTabs is carried differently —
   * ViewSwitcher is an OUTLINED segmented control, SubTabs is a FILLED inset
   * one. Same semantic split (how the data is drawn vs which data you are on),
   * expressed in a way that fits a 30px band.
   */
  if (inline) {
    return (
      <div className={cx('inline-flex items-center gap-0.5 p-0.5 rounded-lg border h-[30px]',
        t.bgInput, t.borderLight, className)}>
        {items.map(item => {
          const active = value === item.value;
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              onClick={() => onChange(item.value)}
              aria-pressed={active}
              title={item.label}
              className={cx('flex items-center gap-1.5 px-2 h-[24px] rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                active ? cx(c.soft, c.fgOnSoft) : cx(t.textSecondary, t.bgHover))}
            >
              {Icon && <Icon size={ICON.sm} className={active ? c.fg : t.textMuted} />}
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cx('flex items-center gap-0.5 border-b', t.border, className)}>
      {items.map(item => {
        const active = value === item.value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cx('px-3 py-2 text-sm font-medium flex items-center gap-1.5 border-b-2 -mb-px transition-colors whitespace-nowrap',
              active ? cx(c.borderStrong, t.text) : cx('border-transparent', t.textSecondary, 'hover:' + t.text.replace('text-', 'text-')))}
          >
            {Icon && <Icon size={ICON.base} className={active ? c.fg : t.textMuted} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* ==================================================================== *
 * PageHeader — the standard module header: gradient tile, title, subtitle,
 * trailing actions. Every module view opens with one so the app reads as
 * one product rather than a set of screens.
 * ==================================================================== */

export function PageHeader({
  icon: Icon, gradient, module: moduleKey, accent = 'purple',
  title, subtitle, actions, children, className,
}) {
  const { t, dark } = useTheme();
  // v1 laid a vertical fade under every module header. It is subtle in light and
  // does real work in dark, where it lifts the header off the near-black ground.
  const tile = gradient || (moduleKey ? moduleGradient(moduleKey, 'tile') : null);
  return (
    <div className={cx('px-6 py-3 border-b flex-shrink-0', t.border, headWash(dark), className)}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            tile
              ? <span className={cx('w-9 h-9 rounded-xl flex items-center justify-center shadow-md flex-shrink-0', tile)}>
                  <Icon size={ICON.lg} className="text-white" />
                </span>
              : <IconTile icon={Icon} accent={accent} size="lg" />
          )}
          <div className="min-w-0">
            <h2 className={cx('text-lg font-semibold leading-tight truncate', t.text)}>{title}</h2>
            {subtitle && <p className={cx('text-xs', t.textMuted)}>{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/** Centred filter toolbar row. v1 centres these so wide viewports stay balanced. */
export function Toolbar({ children, className }) {
  return (
    <div className={cx('flex items-center flex-wrap justify-center gap-2', className)}>
      {children}
    </div>
  );
}

/** The scrolling body of a module view, width-capped and centred. */
export function PageBody({ width = 'max-w-5xl', children, className }) {
  return (
    <div className={cx('flex-1 overflow-auto p-4', className)}>
      <div className={cx(width, 'mx-auto')}>{children}</div>
    </div>
  );
}

/** Breadcrumb trail. */
export function Breadcrumbs({ items = [], onNavigate, className }) {
  const { t, a } = useTheme();
  const c = a('purple');
  return (
    <nav className={cx('flex items-center gap-1.5 flex-wrap text-sm', className)} aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <React.Fragment key={item.id ?? i}>
            {i > 0 && <ChevronRightGlyph className={t.textMuted} />}
            <button
              onClick={() => !last && onNavigate && onNavigate(item, i)}
              className={cx('truncate max-w-[16rem]', last ? t.text : cx(c.fg, 'hover:underline'))}
              aria-current={last ? 'page' : undefined}
            >
              {item.name}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function ChevronRightGlyph({ className }) {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" className={cx('flex-shrink-0', className)}>
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
