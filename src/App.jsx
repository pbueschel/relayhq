import React, { Suspense, lazy } from 'react';
import {
  LayoutGrid, Briefcase, Package, ShoppingBag, FileText, Filter, Server, BookOpen,
  GraduationCap, Workflow, Globe, Palette, GitBranch, AlertOctagon, Stamp,
  Moon, Sun, ChevronRight,
} from 'lucide-react';
import { useTheme, cx, ICON, GRADIENT, tint } from '@/ds';
import { useRoute, navigate } from '@/lib/router.js';
import { TopBar } from '@/components/TopBar.jsx';
import { CommandPalette } from '@/components/CommandPalette.jsx';

/* Views are lazy so the initial paint is not gated on the automation canvas
 * or the course builder, which are the two heaviest screens. */
const Workspace     = lazy(() => import('@/views/Workspace.jsx'));
const Projects      = lazy(() => import('@/views/Projects.jsx'));
const Changes       = lazy(() => import('@/views/Changes.jsx'));
const Problems      = lazy(() => import('@/views/Problems.jsx'));
const Approvals     = lazy(() => import('@/views/Approvals.jsx'));
const Catalog       = lazy(() => import('@/views/Catalog.jsx'));
const ServiceCatalog = lazy(() => import('@/views/ServiceCatalog.jsx'));
const Knowledge     = lazy(() => import('@/views/Knowledge.jsx'));
const Learning      = lazy(() => import('@/views/Learning.jsx'));
const Forms         = lazy(() => import('@/views/Forms.jsx'));
const BusinessRules = lazy(() => import('@/views/BusinessRules.jsx'));
const Automations   = lazy(() => import('@/views/Automations.jsx'));
const Assets        = lazy(() => import('@/views/Assets.jsx'));
const Portal        = lazy(() => import('@/views/Portal.jsx'));
const DesignSystem  = lazy(() => import('@/views/DesignSystem.jsx'));

const VIEWS = {
  workspace: Workspace,
  projects: Projects,
  changes: Changes,
  problems: Problems,
  approvals: Approvals,
  catalog: Catalog,
  servicecatalog: ServiceCatalog,
  knowledge: Knowledge,
  learning: Learning,
  forms: Forms,
  rules: BusinessRules,
  automations: Automations,
  assets: Assets,
  portal: Portal,
  design: DesignSystem,
};

/** Sidebar structure. Grouped because a flat list of 14 items is unreadable. */
export const NAV_GROUPS = [
  {
    label: 'Work',
    items: [
      { id: 'workspace', label: 'My Workspace', icon: LayoutGrid, accent: 'teal', tint: 'workspace' },
      { id: 'projects',  label: 'Projects',     icon: Briefcase,  accent: 'violet', tint: 'projects' },
    ],
  },
  {
    label: 'Service',
    items: [
      { id: 'approvals', label: 'Approvals', icon: Stamp,         accent: 'amber', tint: 'rules' },
      { id: 'changes',   label: 'Changes',   icon: GitBranch,     accent: 'orange', tint: 'rules' },
      { id: 'problems',  label: 'Problems',  icon: AlertOctagon,  accent: 'fuchsia', tint: 'rules' },
    ],
  },
  {
    label: 'Content',
    items: [
      { id: 'catalog',   label: 'Products & Services', icon: Package,        accent: 'amber', tint: 'catalog' },
      { id: 'servicecatalog', label: 'Service Catalog', icon: ShoppingBag,   accent: 'amber', tint: 'catalog' },
      { id: 'knowledge', label: 'Knowledge',           icon: BookOpen,       accent: 'blue', tint: 'knowledge' },
      { id: 'learning',  label: 'Learning',            icon: GraduationCap,  accent: 'indigo', tint: 'learning' },
      { id: 'forms',     label: 'Forms',               icon: FileText,       accent: 'purple', tint: 'catalog' },
    ],
  },
  {
    label: 'Configure',
    items: [
      { id: 'rules',       label: 'Business Rules', icon: Filter,   accent: 'rose', tint: 'rules' },
      { id: 'automations', label: 'Automations',    icon: Workflow, accent: 'sky', tint: 'assets' },
      { id: 'assets',      label: 'Assets',         icon: Server,   accent: 'cyan', tint: 'assets' },
    ],
  },
  {
    label: 'Preview',
    items: [
      { id: 'portal', label: 'Customer Portal', icon: Globe,   accent: 'purple', tint: 'catalog' },
      { id: 'design', label: 'Design System',   icon: Palette, accent: 'pink', tint: 'catalog' },
    ],
  },
];

export default function App() {
  const { t, dark, toggle } = useTheme();
  const route = useRoute();
  const [collapsed, setCollapsed] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const View = VIEWS[route.section] || Workspace;

  // The portal is the end-user experience; it takes the whole viewport with no
  // admin chrome, because showing admin navigation around it would misrepresent
  // what a customer sees.
  if (route.section === 'portal') {
    return (
      <Suspense fallback={<Loading />}>
        <Portal />
      </Suspense>
    );
  }

  return (
    <div className={cx('h-screen flex overflow-hidden', t.bg, t.text)}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} route={route} dark={dark} toggle={toggle} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main className="flex-1 flex overflow-hidden min-h-0">
          <Suspense fallback={<Loading />}>
            <View route={route} />
          </Suspense>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

function Loading() {
  const { t } = useTheme();
  return (
    <div className={cx('flex-1 flex items-center justify-center', t.textMuted)}>
      <div className="flex items-center gap-2 text-sm">
        <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        Loading…
      </div>
    </div>
  );
}

function Sidebar({ collapsed, setCollapsed, route, dark, toggle }) {
  const { t, a } = useTheme();

  return (
    <nav
      className={cx('flex flex-col border-r transition-all duration-200 relative flex-shrink-0',
        collapsed ? 'w-16' : 'w-60', t.bgSidebar, t.border)}
      aria-label="Main"
    >
      {/* Brand */}
      <div className={cx('p-3 border-b flex items-center', t.border, collapsed ? 'justify-center' : 'gap-2.5')}>
        <span className={cx('w-9 h-9 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0', GRADIENT.brand)}>
          <RelayMark />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className={cx('font-semibold leading-tight', t.text)}>RelayHQ</h1>
            <p className={cx('text-[11px]', t.textMuted)}>Service · Support · Training</p>
          </div>
        )}
      </div>

      <button
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cx('absolute top-16 -right-3 w-6 h-6 rounded-full border shadow-sm flex items-center justify-center z-10',
          t.floatBg, t.floatBorder, t.textSecondary)}
      >
        <ChevronRight size={13} className={collapsed ? '' : 'rotate-180'} />
      </button>

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <p className={cx('px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider', t.textMuted)}>
                {group.label}
              </p>
            )}
            {collapsed && <div className={cx('mx-3 my-2 border-t', t.border)} />}
            <div className="px-2 space-y-0.5">
              {group.items.map(item => {
                const active = route.section === item.id;
                const c = a(item.accent);
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item.id)}
                    title={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={cx('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors border',
                      collapsed && 'justify-center',
                      active ? cx(tint(item.tint, dark), t.text, 'font-medium')
                             : cx('border-transparent', t.textSecondary, t.bgHover))}
                  >
                    <Icon size={ICON.lg} className={cx('flex-shrink-0', active ? c.fg : '')} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className={cx('p-2 border-t', t.border)}>
        <button
          onClick={toggle}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={cx('w-full flex items-center px-2.5 py-2 rounded-lg', t.bgHover,
            collapsed ? 'justify-center' : 'justify-between')}
        >
          <span className="flex items-center gap-2.5">
            {dark ? <Moon size={ICON.lg} className={t.textSecondary} /> : <Sun size={ICON.lg} className={t.textSecondary} />}
            {!collapsed && <span className={cx('text-sm', t.textSecondary)}>{dark ? 'Dark' : 'Light'}</span>}
          </span>
          {!collapsed && (
            <span className={cx('relative w-9 h-5 rounded-full transition-colors',
              dark ? a('purple').solid : t.trackOff)}>
              <span className={cx('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                dark ? 'translate-x-[18px]' : 'translate-x-0.5')} />
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}

/** The RelayHQ mark — an R whose leg becomes a relay arrow. */
function RelayMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M28 72V30h24a13 13 0 010 26H38l18 16"
        stroke="white" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
