import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { theme, accentSet, entityHue } from './tokens.js';

const ThemeCtx = createContext(null);

const STORAGE_KEY = 'relayhq.theme.v1';

function readInitial() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch { /* private mode / storage disabled */ }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(readInitial);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light'); } catch { /* ignore */ }
    // Keep the document element in sync so the scrollbar and form controls
    // follow the app theme rather than the OS.
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  const value = useMemo(() => ({
    dark,
    setDark,
    toggle: () => setDark(d => !d),
    t: theme(dark),
    /** Accent class set for a raw hue. */
    a: (hue) => accentSet(hue, dark),
    /** Accent class set for an entity kind. */
    e: (kind) => accentSet(entityHue(kind), dark),
  }), [dark]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/** Join class strings, dropping falsy entries. The app's only class helper. */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * Close-on-outside-click / close-on-Escape for popovers and menus.
 * Returns a ref to attach to the popover root.
 */
export function useDismiss(open, onClose) {
  const ref = React.useRef(null);
  const close = useCallback(() => onClose && onClose(), [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, close]);

  return ref;
}
