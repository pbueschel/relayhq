import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, CornerDownLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { useTheme, cx, ICON, LAYOUT, entityHue, useDismiss } from '@/ds';
import { getState } from '@/store/store.js';
import { searchAll, groupResults } from '@/lib/search.js';
import { navigate } from '@/lib/router.js';
import { NAV_GROUPS } from '@/App.jsx';

/** ⌘K palette. Searches records and also offers navigation commands. */
export function CommandPalette({ open, onClose }) {
  const { t, a } = useTheme();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useDismiss(open, onClose);

  useEffect(() => { if (open) { setQuery(''); setActive(0); } }, [open]);

  const results = useMemo(() => {
    if (!open) return [];
    const q = query.trim().toLowerCase();
    const nav = NAV_GROUPS.flatMap(g => g.items)
      .filter(i => !q || i.label.toLowerCase().includes(q))
      .map(i => ({ group: 'Go to', icon: i.icon, accent: i.accent, id: `nav-${i.id}`,
        title: i.label, subtitle: null, to: [i.id] }));
    return q ? [...nav, ...searchAll(getState(), query)] : nav;
  }, [open, query]);

  const groups = useMemo(() => groupResults(results), [results]);

  if (!open) return null;

  const run = (r) => { navigate(...r.to); onClose(); };

  return createPortal(
    <div className={cx('fixed inset-0 flex items-start justify-center p-4 pt-[12vh] backdrop-blur-sm',
      t.overlay, LAYOUT.zPalette)}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Command palette"
        className={cx('w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden', t.modal, t.borderLight)}>
        <div className={cx('flex items-center gap-3 px-4 py-3.5 border-b', t.border)}>
          <Search size={ICON.lg} className={t.textMuted} />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, Math.max(results.length - 1, 0))); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); const r = results[active]; if (r) run(r); }
            }}
            placeholder="Search or jump to…"
            className={cx('flex-1 bg-transparent outline-none text-[15px]', t.text)}
          />
          <span className={cx('text-[10px] font-medium px-1.5 py-0.5 rounded', t.bgSubtle, t.textMuted)}>Esc</span>
        </div>

        <div className="max-h-[55vh] overflow-auto py-2">
          {results.length === 0 ? (
            <div className={cx('px-4 py-10 text-center', t.textMuted)}>
              <p className="text-sm">No matches for “{query}”</p>
            </div>
          ) : groups.map(g => (
            <div key={g.group} className="mb-1">
              <p className={cx('px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider', t.textMuted)}>{g.group}</p>
              {g.items.map(item => {
                const c = a(entityHue(item.accent) || item.accent || 'gray');
                const Icon = item.icon;
                const isActive = item.idx === active;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setActive(item.idx)}
                    onClick={() => run(item)}
                    className={cx('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors', isActive && c.soft)}
                  >
                    <span className={cx('p-1.5 rounded-lg flex-shrink-0', c.softStrong)}>
                      <Icon size={ICON.md} className={c.fg} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={cx('text-sm block truncate', t.text)}>{item.title}</span>
                      {item.subtitle && <span className={cx('text-xs block truncate', t.textMuted)}>{item.subtitle}</span>}
                    </span>
                    {isActive && <CornerDownLeft size={14} className={t.textMuted} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className={cx('flex items-center gap-4 px-4 py-2.5 border-t text-[11px]', t.border, t.textMuted)}>
          <span className="flex items-center gap-1"><ChevronUp size={12} /><ChevronDown size={12} /> navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={12} /> open</span>
          <span className="ml-auto tabular-nums">{results.length} result{results.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
