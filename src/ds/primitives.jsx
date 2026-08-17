import React from 'react';
import { useTheme, cx } from './ThemeContext.jsx';
import {
  ICON, DENSITY, entityHue, statusMeta, priorityMeta,
  avatarGradient, initials as toInitials, ENTITIES,
} from './tokens.js';

/* ==================================================================== *
 * Button
 *
 * Four variants. `solid` is the commit action, `soft` the secondary action,
 * `outline` the cancel, `ghost` the icon action in a row. Accent defaults to
 * the surrounding entity so a Save button in a ticket modal is rose without
 * the caller thinking about it.
 * ==================================================================== */

const BTN_SIZE = {
  xs: 'px-2 py-1 text-xs gap-1 rounded-md',
  sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-lg',
  lg: 'px-5 py-2.5 text-sm gap-2 rounded-xl',
};

export function Button({
  as: As = 'button',
  variant = 'soft',
  accent = 'gray',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  children,
  className,
  disabled,
  ...rest
}) {
  const { t, a } = useTheme();
  const c = a(accent);

  const look =
    variant === 'solid' ? cx(c.solid, c.solidHover, 'text-white shadow-sm')
    : variant === 'soft' ? cx(c.soft, c.softHover, c.fgOnSoft)
    : variant === 'outline' ? cx(t.bgCard, 'border', t.borderLight, t.textSecondary, t.bgHover)
    : /* ghost */ cx(t.bgHover, t.textSecondary);

  return (
    <As
      className={cx(
        'inline-flex items-center justify-center font-medium transition-colors select-none',
        BTN_SIZE[size], look,
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
      disabled={As === 'button' ? disabled : undefined}
      {...rest}
    >
      {Icon && <Icon size={size === 'xs' ? ICON.sm : ICON.base} className="flex-shrink-0" />}
      {children}
      {IconRight && <IconRight size={size === 'xs' ? ICON.sm : ICON.base} className="flex-shrink-0" />}
    </As>
  );
}

/** Square icon-only button for dense row actions. */
export function IconButton({ icon: Icon, accent, label, size = ICON.base, className, ...rest }) {
  const { t, a } = useTheme();
  const c = accent ? a(accent) : null;
  return (
    <button
      title={label}
      aria-label={label}
      className={cx('p-1.5 rounded-lg transition-colors flex-shrink-0',
        c ? cx(c.softHover, c.fg) : cx(t.bgHover, t.textSecondary), className)}
      {...rest}
    >
      <Icon size={size} />
    </button>
  );
}

/* ==================================================================== *
 * IconTile — the rounded tinted square that fronts a card or modal header.
 * ==================================================================== */

export function IconTile({ icon: Icon, accent = 'gray', size = 'md', className }) {
  const { a } = useTheme();
  const c = a(accent);
  const dims = size === 'sm' ? 'p-1.5 rounded-lg' : size === 'lg' ? 'p-3 rounded-xl' : 'p-2 rounded-lg';
  const iconSize = size === 'sm' ? ICON.base : size === 'lg' ? ICON.tile : ICON.lg;
  return (
    <span className={cx('inline-flex items-center justify-center flex-shrink-0', dims, c.softStrong, className)}>
      <Icon size={iconSize} className={c.fg} />
    </span>
  );
}

/* ==================================================================== *
 * Chip
 *
 * THE RULE FROM v1: chips show VALUES, not counts. Render the actual names
 * and add an overflow badge — never "3 CC'd". `ChipGroup` enforces it so a
 * caller cannot accidentally regress to a count.
 * ==================================================================== */

export function Chip({ accent = 'gray', icon: Icon, children, onRemove, title, className }) {
  const { a } = useTheme();
  const c = a(accent);
  return (
    <span
      title={title}
      className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium max-w-full',
        c.soft, c.fgOnSoft, className)}
    >
      {Icon && <Icon size={ICON.xs} className="flex-shrink-0" />}
      <span className="truncate">{children}</span>
      {onRemove && (
        <button onClick={onRemove} className={cx('p-0.5 rounded-full flex-shrink-0', c.softHover)} aria-label="Remove">
          <XGlyph />
        </button>
      )}
    </span>
  );
}

function XGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/**
 * Render a list of values as chips with an overflow badge.
 * @param items    array of values
 * @param render   (item) => string label
 * @param max      how many to show before collapsing
 */
export function ChipGroup({ items = [], render = (x) => String(x), max = 2, accent = 'gray', icon, empty = null }) {
  const { t } = useTheme();
  if (!items.length) return empty;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <span className="inline-flex items-center gap-1 min-w-0 flex-wrap">
      {shown.map((it, i) => (
        <Chip key={i} accent={accent} icon={icon} title={render(it)}>{render(it)}</Chip>
      ))}
      {rest > 0 && (
        <span
          className={cx('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', t.bgSubtle, t.textMuted)}
          title={items.slice(max).map(render).join(', ')}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

/* ==================================================================== *
 * Status + priority
 * ==================================================================== */

export function StatusPill({ status, className, showDot = true }) {
  const { a } = useTheme();
  const meta = statusMeta(status);
  const c = a(meta.hue);
  return (
    <span className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
      c.soft, c.fgOnSoft, className)}>
      {showDot && <span className={cx('w-1.5 h-1.5 rounded-full flex-shrink-0', c.dot)} />}
      {meta.label}
    </span>
  );
}

export function PriorityFlag({ priority, withLabel = true, className }) {
  const { a } = useTheme();
  const meta = priorityMeta(priority);
  const c = a(meta.hue);
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-medium', c.fg, className)} title={`${meta.label} priority`}>
      <FlagGlyph />
      {withLabel && meta.label}
    </span>
  );
}

function FlagGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden="true" className="flex-shrink-0">
      <path d="M3 1v12M3 2h8l-2 3 2 3H3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** A small labelled tag for an entity kind — used in detail headers. */
export function EntityTag({ kind, className }) {
  const { a } = useTheme();
  const meta = ENTITIES[kind];
  const c = a(entityHue(kind));
  return (
    <span className={cx('px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider',
      c.soft, c.fgOnSoft, className)}>
      {meta?.label || kind}
    </span>
  );
}

/* ==================================================================== *
 * Avatar
 * ==================================================================== */

const AVATAR_SIZE = {
  xs: 'w-4 h-4 text-[8px]',
  sm: 'w-5 h-5 text-[9px]',
  md: 'w-6 h-6 text-[10px]',
  lg: 'w-8 h-8 text-xs',
  xl: 'w-10 h-10 text-sm',
};

export function Avatar({ name, size = 'md', className, ring }) {
  const { t } = useTheme();
  return (
    <span
      title={name}
      className={cx('inline-flex items-center justify-center rounded-full bg-gradient-to-br text-white font-medium flex-shrink-0',
        AVATAR_SIZE[size], avatarGradient(name),
        ring && cx('border-2', t.ringOnBg),
        className)}
    >
      {toInitials(name)}
    </span>
  );
}

export function AvatarStack({ names = [], max = 4, size = 'md' }) {
  const { t } = useTheme();
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((n, i) => <Avatar key={i} name={n} size={size} ring />)}
      {rest > 0 && (
        <span
          title={names.slice(max).join(', ')}
          className={cx('inline-flex items-center justify-center rounded-full font-medium flex-shrink-0',
            AVATAR_SIZE[size], t.bgSubtle, t.textSecondary,
            cx('border-2', t.ringOnBg))}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

/* ==================================================================== *
 * Empty state
 * ==================================================================== */

export function EmptyState({ icon: Icon, title, hint, action, className }) {
  const { t } = useTheme();
  return (
    <div className={cx('flex flex-col items-center justify-center text-center py-12', t.textMuted, className)}>
      {Icon && <Icon size={ICON.empty} className="mb-3 opacity-40" />}
      <p className={cx('font-medium', t.text)}>{title}</p>
      {hint && <p className="text-sm mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ==================================================================== *
 * Card / Panel / Section
 * ==================================================================== */

export function Card({ accent, hover, className, children, ...rest }) {
  const { t, a } = useTheme();
  const c = accent ? a(accent) : null;
  return (
    <div
      className={cx('rounded-xl border', t.bgCard, t.borderLight,
        hover && cx('transition-colors', c ? c.borderStrong.replace('border-', 'hover:border-') : 'hover:border-gray-400'),
        className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/** Card with a standard header row: icon tile, title, subtitle, trailing action. */
export function Panel({ icon, accent = 'gray', title, subtitle, action, children, className }) {
  const { t } = useTheme();
  return (
    <Card className={className}>
      <div className={cx(DENSITY.cardPad, 'flex items-center justify-between gap-3')}>
        <div className="flex items-center gap-3 min-w-0">
          {icon && <IconTile icon={icon} accent={accent} />}
          <div className="min-w-0">
            <h4 className={cx('font-medium truncate', t.text)}>{title}</h4>
            {subtitle && <p className={cx('text-sm truncate', t.textSecondary)}>{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children && <div className={cx('border-t', t.borderLight)}>{children}</div>}
    </Card>
  );
}

export function Section({ title, hint, action, children, className }) {
  const { t } = useTheme();
  return (
    <section className={className}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            {title && <h3 className={cx('text-lg font-medium', t.text)}>{title}</h3>}
            {hint && <p className={cx('text-sm mt-0.5', t.textSecondary)}>{hint}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Small uppercase label that heads a group inside a panel. */
export function GroupLabel({ children, className }) {
  const { t } = useTheme();
  return (
    <p className={cx('text-[11px] font-semibold uppercase tracking-wider', t.textMuted, className)}>
      {children}
    </p>
  );
}

/* ==================================================================== *
 * ListRow — the dense row used by every list surface in the app.
 * A coloured rail on the left carries the entity colour.
 * ==================================================================== */

export function ListRow({
  accent = 'gray', icon: Icon, title, subtitle, meta, actions,
  onClick, selected, alert, className, children,
}) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      className={cx(
        'group flex items-center gap-3 rounded-lg border transition-colors', DENSITY.rowPad,
        selected ? cx(c.soft, c.borderStrong) : cx(t.bgCard, alert ? 'border-red-400' : t.borderLight, t.bgHover),
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <span className={cx('w-1 self-stretch min-h-8 rounded-full flex-shrink-0', c.rail)} />
      {Icon && <Icon size={ICON.base} className={cx(c.fg, 'flex-shrink-0')} />}
      <div className="flex-1 min-w-0">
        <p className={cx('text-sm font-medium truncate', t.text)}>{title}</p>
        {subtitle && <p className={cx('text-xs truncate', t.textMuted)}>{subtitle}</p>}
        {children}
      </div>
      {meta && <div className="flex items-center gap-2 flex-shrink-0">{meta}</div>}
      {actions && (
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
}

/* ==================================================================== *
 * Stat tile — the compact single-line metric card in the workspace strip.
 * ==================================================================== */

export function Stat({ label, value, accent = 'gray', icon: Icon, active, onClick }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <button
      onClick={onClick}
      className={cx('flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors text-left',
        active ? cx(c.softStrong, c.borderStrong) : cx(t.bgCard, t.borderLight, t.bgHover))}
    >
      {Icon && <Icon size={ICON.base} className={c.fg} />}
      <span className={cx('text-sm font-semibold tabular-nums', t.text)}>{value}</span>
      <span className={cx('text-xs', t.textMuted)}>{label}</span>
    </button>
  );
}

/* ==================================================================== *
 * Inline banner — the explanatory / warning callout used throughout v1.
 * ==================================================================== */

export function Banner({ accent = 'blue', icon: Icon, title, children, className }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <div className={cx('flex items-start gap-3 p-3 rounded-xl border', c.soft, c.border, className)}>
      {Icon && <Icon size={ICON.md} className={cx(c.fg, 'flex-shrink-0 mt-0.5')} />}
      <div className="flex-1 min-w-0 text-xs leading-relaxed">
        {title && <p className={cx('text-sm font-medium mb-0.5', t.text)}>{title}</p>}
        <div className={t.textSecondary}>{children}</div>
      </div>
    </div>
  );
}

/* ==================================================================== *
 * Divider
 * ==================================================================== */

export function Divider({ vertical, className }) {
  const { t } = useTheme();
  const tone = t.rule;
  return vertical
    ? <span className={cx('w-px self-stretch flex-shrink-0', tone, className)} />
    : <span className={cx('block h-px w-full', tone, className)} />;
}
