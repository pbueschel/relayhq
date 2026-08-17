import React from 'react';
import { useTheme, cx } from './ThemeContext.jsx';
import { ICON } from './tokens.js';

/* ==================================================================== *
 * NOTE: no <form> elements anywhere in RelayHQ. All submission goes through
 * onClick handlers. This was a v1 constraint that we keep, because it also
 * removes any chance of a stray full-page navigation on GitHub Pages.
 * ==================================================================== */

/** Label + optional hint wrapper around any control. */
export function Field({ label, hint, required, error, children, className }) {
  const { t } = useTheme();
  return (
    <div className={className}>
      {label && (
        <label className={cx('text-xs font-medium mb-1.5 flex items-center gap-1', t.textSecondary)}>
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className={cx('text-xs mt-1', t.textMuted)}>{hint}</p>}
      {error && <p className="text-xs mt-1 text-red-500">{error}</p>}
    </div>
  );
}

const CONTROL_BASE = 'w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors border';

export function Input({ accent = 'purple', className, ...rest }) {
  const { t, a } = useTheme();
  return (
    <input
      className={cx(CONTROL_BASE, t.bgInput, t.borderLight, t.text, a(accent).ring, className)}
      {...rest}
    />
  );
}

export function Textarea({ accent = 'purple', rows = 4, className, ...rest }) {
  const { t, a } = useTheme();
  return (
    <textarea
      rows={rows}
      className={cx(CONTROL_BASE, t.bgInput, t.borderLight, t.text, a(accent).ring, 'resize-y', className)}
      {...rest}
    />
  );
}

export function Select({ accent = 'purple', options = [], placeholder, className, children, ...rest }) {
  const { t, a } = useTheme();
  return (
    <select
      className={cx(CONTROL_BASE, t.bgInput, t.borderLight, t.text, a(accent).ring, 'cursor-pointer', className)}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
      ))}
      {children}
    </select>
  );
}

export function Checkbox({ label, hint, checked, onChange, accent = 'purple', className }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <label className={cx('flex items-start gap-2.5 cursor-pointer select-none', className)}>
      <span
        onClick={(e) => { e.preventDefault(); onChange && onChange(!checked); }}
        className={cx('w-4 h-4 mt-0.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
          checked ? cx(c.solid, 'border-transparent') : cx(t.bgInput, t.borderLight))}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 6.5l2.5 2.5L10 3.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange && onChange(e.target.checked)} className="sr-only" />
      <span className="min-w-0">
        {label && <span className={cx('text-sm block', t.text)}>{label}</span>}
        {hint && <span className={cx('text-xs block', t.textMuted)}>{hint}</span>}
      </span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, accent = 'purple', className }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <button
      role="switch"
      aria-checked={!!checked}
      onClick={() => onChange && onChange(!checked)}
      className={cx('flex items-center gap-2.5 select-none', className)}
    >
      <span className={cx('relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
        checked ? c.solid : (t.bgSubtle + ' ring-1 ring-inset ring-stone-400/30'))}>
        <span className={cx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
      {label && <span className={cx('text-sm', t.textSecondary)}>{label}</span>}
    </button>
  );
}

/**
 * Tile picker — v1 converted native selects to compact tile grids in several
 * places because a tile shows the icon and the meaning at a glance. This is
 * that pattern, generalised.
 */
export function TileGroup({ value, onChange, options = [], columns, accent = 'purple', className }) {
  const { t, a } = useTheme();
  return (
    <div
      className={cx('grid gap-2', className)}
      style={{ gridTemplateColumns: `repeat(${columns || Math.min(options.length, 3)}, minmax(0, 1fr))` }}
    >
      {options.map(o => {
        const selected = value === o.value;
        const c = a(o.accent || accent);
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            onClick={() => onChange && onChange(o.value)}
            className={cx('p-2.5 rounded-xl border-2 transition-colors flex flex-col items-center gap-1 text-center',
              selected ? cx(c.borderStrong, c.soft) : cx('border-transparent', t.bgCard, t.bgHover))}
          >
            {Icon && <Icon size={ICON.lg} className={selected ? c.fg : t.textMuted} />}
            <span className={cx('text-xs font-medium', selected ? t.text : t.textSecondary)}>{o.label}</span>
            {o.hint && <span className={cx('text-[10px]', t.textMuted)}>{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Search input with a leading glyph and a clear affordance. */
export function SearchInput({ value, onChange, placeholder = 'Search…', accent = 'purple', className, width = 'w-full' }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <div className={cx('flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-colors',
      t.bgInput, value ? c.borderStrong : t.borderLight, width, className)}>
      <SearchGlyph className={t.textMuted} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx('flex-1 min-w-0 bg-transparent outline-none text-sm', t.text)}
      />
      {value && (
        <button onClick={() => onChange('')} className={t.textMuted} aria-label="Clear search">
          <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      )}
    </div>
  );
}

function SearchGlyph({ className }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" className={cx('flex-shrink-0', className)}>
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
