import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme, cx, useDismiss } from './ThemeContext.jsx';
import { LAYOUT, DENSITY, ICON } from './tokens.js';
import { IconTile, IconButton } from './primitives.jsx';

/* ==================================================================== *
 * Modal
 *
 * The v1 standard, frozen: overlay `items-center`, container
 * `rounded-3xl border-2 max-h-[90vh] flex flex-col`, pinned header,
 * `flex-1 overflow-auto` body, pinned footer. The border carries the
 * entity accent so you can tell what you are editing from the frame.
 *
 * Every modal renders through a portal on document.body, which removes the
 * v1 problem of nested modals being clipped by a parent's overflow — the
 * `z-[110]` workaround is no longer needed but the token is kept for callers
 * that stack deliberately.
 * ==================================================================== */

function XGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Modal({
  open = true,
  onClose,
  accent = 'purple',
  size = 'modalMd',
  icon,
  title,
  subtitle,
  children,
  footer,
  z = LAYOUT.zModal,
  bodyClassName,
  className,
}) {
  const { t, a } = useTheme();
  const c = a(accent);
  const ref = useDismiss(open, onClose);

  // Lock background scroll while any modal is open.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={cx('fixed inset-0 flex items-center justify-center p-4 backdrop-blur-sm', t.overlay, z)}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cx('w-full rounded-3xl border-2 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden',
          t.modal, c.borderStrong, LAYOUT[size] || size, className)}
      >
        {(title || icon || onClose) && (
          <header className={cx(DENSITY.modalHeaderPad, 'border-b flex-shrink-0 flex items-start justify-between gap-3',
            t.border, c.soft)}>
            <div className="flex items-center gap-3 min-w-0">
              {icon && <IconTile icon={icon} accent={accent} size="lg" />}
              <div className="min-w-0">
                {title && <h2 className={cx('text-lg font-semibold truncate', t.text)}>{title}</h2>}
                {subtitle && <p className={cx('text-xs mt-0.5', t.textSecondary)}>{subtitle}</p>}
              </div>
            </div>
            {onClose && (
              <button onClick={onClose} aria-label="Close"
                className={cx('p-2 rounded-full flex-shrink-0', t.bgHover, t.textSecondary)}>
                <XGlyph />
              </button>
            )}
          </header>
        )}

        <div className={cx('flex-1 overflow-auto min-h-0', bodyClassName || DENSITY.modalBodyPad)}>
          {children}
        </div>

        {footer && (
          <footer className={cx(DENSITY.modalFooterPad, 'border-t flex-shrink-0 flex items-center justify-between gap-3', t.border)}>
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Destructive confirmation that requires typing the record's exact name.
 * v1 applied this to cascading catalog deletes; it is generalised here so
 * every destructive action in the app can earn the same friction.
 */
export function ConfirmDelete({ open, name, kind = 'record', cascadeNote, onCancel, onConfirm }) {
  const { t } = useTheme();
  const [typed, setTyped] = React.useState('');
  useEffect(() => { if (open) setTyped(''); }, [open, name]);
  const armed = typed === name;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      accent="red"
      size="modalSm"
      title="Confirm deletion"
      subtitle="This action cannot be undone."
      footer={
        <>
          <span />
          <div className="flex gap-2">
            <button onClick={onCancel}
              className={cx('px-4 py-2 rounded-lg text-sm border', t.bgCard, t.borderLight, t.textSecondary, t.bgHover)}>
              Cancel
            </button>
            <button
              onClick={() => armed && onConfirm()}
              disabled={!armed}
              className={cx('px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors',
                armed ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600/40 cursor-not-allowed')}
            >
              Delete {kind}
            </button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <p className={cx('text-sm', t.text)}>
          Delete the {kind} <strong>“{name}”</strong>?
          {cascadeNote && <span className={cx('block mt-1', t.textSecondary)}>{cascadeNote}</span>}
        </p>
        <div>
          <label className={cx('text-xs font-medium mb-1.5 block', t.textSecondary)}>
            Type <strong className={t.text}>{name}</strong> to confirm
          </label>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Enter name to confirm"
            className={cx('w-full rounded-lg px-3 py-2 text-sm outline-none border',
              t.bgInput, t.borderLight, t.text, 'focus:border-red-500')}
          />
        </div>
      </div>
    </Modal>
  );
}

/* ==================================================================== *
 * Menu — dropdown anchored under a trigger.
 * ==================================================================== */

export function Menu({ open, onClose, align = 'left', width = 'w-48', children, className }) {
  const { t } = useTheme();
  const ref = useDismiss(open, onClose);
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="menu"
      className={cx('absolute top-full mt-1 rounded-xl border shadow-2xl overflow-hidden z-50 py-1',
        align === 'right' ? 'right-0' : 'left-0', width, t.modal, t.borderLight, className)}
    >
      {children}
    </div>
  );
}

export function MenuItem({ icon: Icon, iconClass, label, hint, selected, onClick, accent = 'purple' }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cx('w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
        selected ? c.soft : t.bgHover)}
    >
      {Icon && <Icon size={ICON.md} className={cx('flex-shrink-0', iconClass || t.textMuted)} />}
      <span className="flex-1 min-w-0">
        <span className={cx('text-sm block truncate', t.text)}>{label}</span>
        {hint && <span className={cx('text-[10px] block truncate', t.textMuted)}>{hint}</span>}
      </span>
      {selected && <CheckGlyph className={c.fg} />}
    </button>
  );
}

function CheckGlyph({ className }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={cx('flex-shrink-0', className)}>
      <path d="M2 7.5l3.2 3.2L12 4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MenuDivider() {
  const { t } = useTheme();
  return <div className={cx('my-1 border-t', t.borderLight)} />;
}

export function MenuLabel({ children, action }) {
  const { t } = useTheme();
  return (
    <div className={cx('px-3 py-1.5 flex items-center justify-between border-b mb-1', t.borderLight)}>
      <span className={cx('text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>{children}</span>
      {action}
    </div>
  );
}

/**
 * FilterPill — the trigger button used by the workspace filter toolbar.
 * Borders go accent when the filter is engaged, which is how v1 signalled
 * "this filter is doing something" without adding a badge.
 */
export function FilterPill({ icon: Icon, label, active, open, onClick, className }) {
  const { t, a } = useTheme();
  const c = a('purple');
  return (
    <button
      onClick={onClick}
      aria-expanded={!!open}
      className={cx('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm border transition-colors',
        t.bgInput, t.text, active ? c.borderStrong : t.borderLight, className)}
    >
      {Icon && <Icon size={ICON.base} className={active ? c.fg : t.textMuted} />}
      {label}
      <ChevronGlyph className={cx(t.textMuted, 'transition-transform', open && 'rotate-180')} />
    </button>
  );
}

function ChevronGlyph({ className }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" className={cx('flex-shrink-0', className)}>
      <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
