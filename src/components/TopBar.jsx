import React, { useState, useMemo } from 'react';
import { Search, X, CornerDownLeft, ChevronDown, RotateCcw } from 'lucide-react';
import { useTheme, cx, ICON, Avatar, entityHue, Menu, MenuItem, MenuDivider } from '@/ds';
import { useStore, getState, resetDemo } from '@/store/store.js';
import { searchAll, groupResults } from '@/lib/search.js';
import { navigate } from '@/lib/router.js';

/**
 * Persistent top bar: centred global search with a live results dropdown, and
 * the account block pinned right. v1 removed the sidebar's separate search
 * trigger and user block when this landed — they are deliberately not here.
 */
export function TopBar({ onOpenPalette }) {
  const { t, a } = useTheme();
  const currentUser = useStore(s => s.currentUser);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const results = useMemo(
    () => (query.trim() ? searchAll(getState(), query) : []),
    [query],
  );
  const groups = useMemo(() => groupResults(results), [results]);

  const run = (r) => {
    navigate(...r.to);
    setQuery(''); setFocused(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, Math.max(results.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const r = results[active]; if (r) { run(r); e.currentTarget.blur(); } }
    else if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
  };

  const open = focused && query.trim() !== '';

  return (
    <header className={cx('flex items-center gap-3 px-4 h-14 border-b flex-shrink-0 relative z-30',
      t.border, t.bgSidebar)}>
      <div className="flex-1" />

      <div className="relative w-full max-w-xl">
        <div className={cx('flex items-center gap-2.5 rounded-xl px-3 py-2 border transition-colors',
          t.bgInput, focused ? a('purple').borderStrong : t.borderLight)}>
          <Search size={ICON.md} className={t.textMuted} />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={onKeyDown}
            placeholder="Search tickets, knowledge, courses, assets…"
            aria-label="Global search"
            className={cx('flex-1 min-w-0 bg-transparent outline-none text-sm', t.text)}
          />
          {query && (
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery('')}
              className={t.textMuted} aria-label="Clear"><X size={ICON.base} /></button>
          )}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenPalette}
            title="Open command palette"
            className={cx('hidden sm:inline text-[10px] font-medium px-1.5 py-0.5 rounded', t.bgSubtle, t.textMuted)}
          >
            ⌘K
          </button>
        </div>

        {open && (
          <div className={cx('absolute left-0 right-0 top-full mt-2 rounded-xl border shadow-2xl overflow-hidden z-50',
            t.modal, t.borderLight)}>
            <div className="max-h-[60vh] overflow-auto py-2">
              {results.length === 0 ? (
                <div className={cx('px-4 py-8 text-center text-sm', t.textMuted)}>No matches for “{query}”</div>
              ) : groups.map(g => (
                <div key={g.group} className="mb-1">
                  <p className={cx('px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>{g.group}</p>
                  {g.items.map(item => (
                    <ResultRow key={item.id} item={item} active={item.idx === active}
                      onHover={() => setActive(item.idx)} onPick={() => run(item)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex items-center justify-end">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className={cx('flex items-center gap-2.5 px-2 py-1.5 rounded-lg', t.bgHover)}
            aria-label="Account"
          >
            <Avatar name={currentUser?.name} size="lg" />
            <span className="hidden lg:block text-left leading-tight">
              <span className={cx('text-sm block', t.text)}>{currentUser?.name}</span>
              <span className={cx('text-[11px] block', t.textMuted)}>{currentUser?.title}</span>
            </span>
            <ChevronDown size={ICON.base} className={cx('hidden lg:block', t.textMuted)} />
          </button>
          <Menu open={menuOpen} onClose={() => setMenuOpen(false)} align="right" width="w-56">
            <MenuItem label={currentUser?.email} hint="Signed in" />
            <MenuDivider />
            <MenuItem icon={RotateCcw} label="Reset demo data" hint="Discard local edits" onClick={resetDemo} />
          </Menu>
        </div>
      </div>
    </header>
  );
}

function ResultRow({ item, active, onHover, onPick }) {
  const { t, a } = useTheme();
  const c = a(entityHue(item.accent) || 'gray');
  const Icon = item.icon;
  return (
    <button
      onMouseEnter={onHover}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className={cx('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors', active && c.soft)}
    >
      <span className={cx('p-1.5 rounded-lg flex-shrink-0', c.softStrong)}>
        <Icon size={ICON.md} className={c.fg} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={cx('text-sm block truncate', t.text)}>{item.title}</span>
        {item.subtitle && <span className={cx('text-xs block truncate', t.textMuted)}>{item.subtitle}</span>}
      </span>
      <CornerDownLeft size={13} className={cx(t.textMuted, active ? 'opacity-100' : 'opacity-0')} />
    </button>
  );
}
