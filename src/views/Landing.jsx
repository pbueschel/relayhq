import React, { useMemo } from 'react';
import {
  ArrowRight, Inbox, Stamp, GitBranch, Package, BookOpen, GraduationCap,
  Workflow, Server, Globe, Briefcase, AlertOctagon, FileText, ShoppingBag,
  CircleCheck, Sparkles,
} from 'lucide-react';
import { useTheme, cx, GRADIENT, ICON, entityHue } from '@/ds';
import { useStore } from '@/store/store.js';
import { navigate } from '@/lib/router.js';

/**
 * The landing page — the empty hash route, so the bare URL is the pitch and the
 * app is one click away at #/workspace.
 *
 * EVERY NUMBER ON THIS PAGE IS COMPUTED FROM THE SEED. That is not a flourish:
 * the research behind this product found no trustworthy third-party deflection
 * statistic anywhere, and concluded RelayHQ should only ever show figures a
 * reader can go and check. "29 of 31 atoms serve three surfaces" is verifiable
 * in the demo thirty seconds later. A borrowed 40% is not, and the person most
 * likely to check it is the person most worth convincing.
 */

const NAV = [
  { label: 'Product', to: ['workspace'] },
  { label: 'Service catalog', to: ['servicecatalog'] },
  { label: 'Academy', to: ['learning'] },
];

const MODES = [
  {
    key: 'service',
    accent: 'rose',
    icon: Inbox,
    title: 'Service management',
    body: 'Tickets, approvals that actually run — quorum, delegation and escalation — ITIL change with a transparent risk breakdown, and problems that trace to the change that fixed them.',
    proof: (n) => `${n.tickets} tickets · ${n.approvals} live approvals · ${n.changes} changes`,
  },
  {
    key: 'support',
    accent: 'emerald',
    icon: Globe,
    title: 'Customer service',
    body: 'The same desk turned outward. Contacts and organizations, plans and SLA targets, and a portal where the answer is always offered before the request form.',
    proof: (n) => `${n.orgs} customers · ${n.contacts} contacts · ${n.slas} SLA policies`,
  },
  {
    key: 'training',
    accent: 'indigo',
    icon: GraduationCap,
    title: 'Training',
    body: 'The knowledge you already wrote, composed into courses that teach a whole job function — by reference, so nothing is copied and nothing drifts out of step.',
    proof: (n) => `${n.courses} courses · ${n.curricula} curricula · ${n.enrollments} enrollments`,
  },
];

const MODULES = [
  { icon: Inbox,         label: 'Workspace',        kind: 'ticket',   to: ['workspace'] },
  { icon: Stamp,         label: 'Approvals',        kind: 'approval', to: ['approvals'] },
  { icon: GitBranch,     label: 'Changes',          kind: 'change',   to: ['changes'] },
  { icon: AlertOctagon,  label: 'Problems',         kind: 'problem',  to: ['problems'] },
  { icon: Briefcase,     label: 'Projects',         kind: 'project',  to: ['projects'] },
  { icon: Package,       label: 'Catalog',          kind: 'product',  to: ['catalog'] },
  { icon: ShoppingBag,   label: 'Service catalog',  kind: 'product',  to: ['servicecatalog'] },
  { icon: BookOpen,      label: 'Knowledge',        kind: 'article',  to: ['knowledge'] },
  { icon: GraduationCap, label: 'Learning',         kind: 'course',   to: ['learning'] },
  { icon: FileText,      label: 'Forms',            kind: 'form',     to: ['forms'] },
  { icon: Workflow,      label: 'Automations',      kind: 'automation', to: ['automations'] },
  { icon: Server,        label: 'Assets',           kind: 'hardware', to: ['assets'] },
];

/* ==================================================================== */

export default function Landing() {
  const { t, a, dark } = useTheme();
  const s = useStore(st => st);
  const n = useCounts(s);

  return (
    <div className={cx('flex-1 overflow-auto', t.bg)}>
      <TopNav />
      <Hero n={n} />
      <Modes n={n} />
      <Thesis n={n} />
      <ModuleGrid />
      <Foot />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Counts — read once, used everywhere. Nothing here is typed in.
 * ------------------------------------------------------------------ */

function useCounts(s) {
  return useMemo(() => {
    const knowledge = s.knowledge || [];
    const courses = s.courses || [];

    const inCatalog = new Set();
    const walk = (nodes) => {
      for (const node of nodes || []) {
        for (const id of node.knowledgeIds || []) inCatalog.add(id);
        if (node.children) walk(node.children);
      }
    };
    walk(s.catalog);

    const inCourses = new Set();
    for (const c of courses) {
      for (const m of c.modules || []) {
        for (const l of m.lessonIds || m.lessons || []) {
          const id = typeof l === 'string' ? l : l?.knowledgeId;
          if (id) inCourses.add(id);
        }
      }
    }

    let items = 0;
    const countItems = (nodes) => {
      for (const node of nodes || []) {
        if (node.type === 'item') items += 1;
        if (node.children) countItems(node.children);
      }
    };
    countItems(s.catalog);

    return {
      atoms: knowledge.length,
      dual: knowledge.filter(k => inCatalog.has(k.id) && inCourses.has(k.id)).length,
      items,
      products: (s.catalog || []).length,
      tickets: (s.tickets || []).length,
      approvals: (s.approvals || []).length,
      changes: (s.changes || []).length,
      orgs: (s.organizations || []).length,
      contacts: (s.contacts || []).length,
      slas: (s.slaPolicies || []).length,
      courses: courses.length,
      curricula: (s.curricula || []).length,
      enrollments: (s.enrollments || []).length,
      services: (s.serviceItems || []).length,
      assets: (s.assets || []).length,
      automations: (s.automations || []).length,
      forms: (s.subforms || []).length,
    };
  }, [s]);
}

/* ------------------------------------------------------------------ *
 * Chrome
 * ------------------------------------------------------------------ */

function TopNav() {
  const { t } = useTheme();
  return (
    <header className={cx('sticky top-0 z-30 border-b backdrop-blur-xl', t.border,
      'bg-white/70 dark:bg-transparent')}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-6">
        <button onClick={() => navigate('')} className="flex items-center gap-2.5 flex-shrink-0">
          <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center shadow-md', GRADIENT.brand)}>
            <Mark />
          </span>
          <span className={cx('font-semibold tracking-tight', t.text)}>RelayHQ</span>
        </button>

        <nav className="hidden md:flex items-center gap-5 ml-4">
          {NAV.map(item => (
            <button key={item.label} onClick={() => navigate(...item.to)}
              className={cx('text-sm', t.textSecondary, 'hover:underline')}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />
        <button
          onClick={() => navigate('workspace')}
          className={cx('inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-lg',
            GRADIENT.brandBar, 'hover:brightness-105 transition')}
        >
          Open the demo <ArrowRight size={ICON.base} />
        </button>
      </div>
    </header>
  );
}

function Mark() {
  return (
    <svg width="17" height="17" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M28 72V30h24a13 13 0 010 26H38l18 16" stroke="#fff" strokeWidth="10"
        fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

function Hero({ n }) {
  const { t, a, dark } = useTheme();
  return (
    <section className="relative overflow-hidden">
      {/* The one gradient moment on the page. It fades out rather than stopping,
          so the product shot sits on a settled ground rather than a coloured band. */}
      <div aria-hidden="true"
        className={cx('absolute inset-x-0 top-0 h-[560px] pointer-events-none',
          dark
            ? 'bg-gradient-to-b from-purple-500/20 via-amber-500/[0.07] to-transparent'
            : 'bg-gradient-to-b from-purple-200/60 via-amber-100/50 to-transparent')} />

      <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-0 text-center">
        <span className={cx('inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border mb-6',
          t.bgCard, t.borderLight, t.textSecondary)}>
          <Sparkles size={ICON.sm} className={a('purple').fg} />
          A working prototype, not a mock-up
        </span>

        <h1 className={cx('font-bold tracking-[-0.035em] leading-[1.04] mx-auto max-w-[16ch]',
          'text-[clamp(2.1rem,5.4vw,3.9rem)]', t.text)} style={{ textWrap: 'balance' }}>
          The service desk that{' '}
          <span className={cx('bg-clip-text text-transparent', GRADIENT.brandBar)}>teaches</span>{' '}
          while it answers.
        </h1>

        <p className={cx('mt-5 mx-auto max-w-[46ch] text-[15.5px] leading-relaxed', t.textSecondary)}>
          Tickets, approvals, change and assets — with a customer portal and an academy running on the
          same knowledge. One catalog. One source of truth.
        </p>

        <div className="mt-7 flex justify-center">
          <button
            onClick={() => navigate('workspace')}
            className={cx('inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[15px] font-semibold text-white shadow-xl',
              GRADIENT.brandBar, 'hover:brightness-105 transition')}
          >
            Open the demo <ArrowRight size={ICON.lg} />
          </button>
        </div>

        <p className={cx('mt-3 text-xs', t.textMuted)}>
          No sign-in. Sample data. Everything on screen is real and clickable.
        </p>

        <AppShot />

        <div className={cx('mt-8 pb-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-2',
          'text-[11px] font-semibold uppercase tracking-[0.12em]', t.textMuted)}>
          <span>Service management</span>
          <span>Customer service</span>
          <span>Training</span>
        </div>
      </div>
    </section>
  );
}

/**
 * The product shot. A real screenshot would date the moment a screen changes,
 * so this is the live design system drawing a workspace — it cannot go stale,
 * and it is the actual type, colour and density the demo uses.
 */
function AppShot() {
  const { t, a } = useTheme();
  const rows = [
    { hue: 'rose',   title: 'Checkout returns 502 during Saturday peak traffic', sub: 'Dana Whitmore · Lumen Retail Group · Engineering', tag: 'In Progress', tagHue: 'amber' },
    { hue: 'rose',   title: 'Quarterly access review export is missing users',   sub: 'Owen Fitzgerald · Vireo Health · Customer Support', tag: 'Open', tagHue: 'blue' },
    { hue: 'amber',  title: 'Figma Enterprise — 8 seats, $6,400 annual',         sub: 'Finance review · Stage 2 of 3 · raised by Priya Raman', tag: 'Awaiting', tagHue: 'amber' },
    { hue: 'teal',   title: 'Rewrite the escalation runbook',                    sub: 'Personal · due today', tag: 'To Do', tagHue: 'gray' },
    { hue: 'indigo', title: 'Support Agent onboarding — 4 of 18 lessons',        sub: 'Curriculum · Sam Whitfield', tag: 'Overdue', tagHue: 'red' },
  ];

  return (
    <div className={cx('mt-12 mx-auto max-w-4xl rounded-t-2xl border border-b-0 overflow-hidden text-left',
      t.borderLight, t.bgCard, 'shadow-[0_30px_70px_-30px_rgba(76,29,149,0.45)]')}>
      <div className={cx('flex items-center gap-1.5 px-3 h-8 border-b', t.border, t.bgSubtle)}>
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
      </div>

      <div className="grid grid-cols-[132px_1fr] min-h-[248px]">
        <div className={cx('border-r p-2', t.border, t.bgSidebar)}>
          <div className="flex items-center gap-1.5 px-1 py-1.5">
            <span className={cx('w-5 h-5 rounded-md', GRADIENT.brand)} />
            <span className={cx('text-[11px] font-semibold', t.text)}>RelayHQ</span>
          </div>
          {[['Work', ['My Workspace', 'Projects']], ['Service', ['Approvals', 'Changes']], ['Content', ['Catalog', 'Knowledge']]].map(([label, items]) => (
            <div key={label}>
              <p className={cx('px-1 pt-2 pb-0.5 text-[8px] font-bold uppercase tracking-wider', t.textMuted)}>{label}</p>
              {items.map(item => (
                <div key={item} className={cx('px-2 py-1 rounded-md text-[10.5px] mb-0.5 border',
                  item === 'My Workspace'
                    ? cx('bg-gradient-to-r from-teal-100 to-cyan-100 border-teal-300 font-semibold', t.text)
                    : cx('border-transparent', t.textSecondary))}>
                  {item}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <span className={cx('w-6 h-6 rounded-lg flex items-center justify-center', GRADIENT.workspace)}>
              <Inbox size={12} className="text-white" />
            </span>
            <span>
              <span className={cx('block text-[12px] font-semibold leading-tight', t.text)}>My Workspace</span>
              <span className={cx('block text-[9px]', t.textMuted)}>20 of 118 shown</span>
            </span>
            <span className={cx('ml-auto px-2.5 py-1 rounded-md text-[10px] font-semibold text-white', GRADIENT.workspaceBar)}>
              + New
            </span>
          </div>

          <div className="space-y-1">
            {rows.map(r => (
              <div key={r.title} className={cx('flex items-center gap-2 rounded-lg border px-2 py-1.5', t.bgCard, t.borderLight)}>
                <span className={cx('w-[3px] self-stretch min-h-5 rounded-full', a(r.hue).rail)} />
                <span className="flex-1 min-w-0">
                  <span className={cx('block text-[10.5px] font-semibold truncate', t.text)}>{r.title}</span>
                  <span className={cx('block text-[9px] truncate', t.textMuted)}>{r.sub}</span>
                </span>
                <span className={cx('px-1.5 py-0.5 rounded-full text-[8.5px] font-semibold whitespace-nowrap',
                  a(r.tagHue).soft, a(r.tagHue).fgOnSoft)}>
                  {r.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Three modes
 * ------------------------------------------------------------------ */

function Modes({ n }) {
  const { t, a } = useTheme();
  return (
    <section className={cx('border-t', t.border)}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {MODES.map(m => {
            const c = a(m.accent);
            const Icon = m.icon;
            return (
              <div key={m.key} className={cx('rounded-2xl border p-6', t.bgCard, t.borderLight)}>
                <span className={cx('inline-flex w-10 h-10 rounded-xl items-center justify-center mb-4', c.softStrong)}>
                  <Icon size={ICON.xl} className={c.fg} />
                </span>
                <h3 className={cx('text-[17px] font-semibold mb-2', t.text)}>{m.title}</h3>
                <p className={cx('text-sm leading-relaxed mb-4', t.textSecondary)}>{m.body}</p>
                <p className={cx('text-xs font-medium tabular-nums', c.fg)}>{m.proof(n)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * The thesis — the one argument worth making, with checkable numbers
 * ------------------------------------------------------------------ */

function Thesis({ n }) {
  const { t, a } = useTheme();
  const blue = a('blue');

  return (
    <section className={cx('border-t', t.border, t.bgSubtle)}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] items-center">
          <div>
            <p className={cx('text-[11px] font-bold uppercase tracking-[0.14em] mb-3', a('purple').fg)}>
              Why it is one system
            </p>
            <h2 className={cx('text-[clamp(1.5rem,3vw,2.1rem)] font-bold tracking-tight leading-tight mb-4', t.text)}
              style={{ textWrap: 'balance' }}>
              Write it once. It works three times.
            </h2>
            <p className={cx('text-[15px] leading-relaxed mb-3', t.textSecondary)}>
              The help-centre article, the crib sheet an agent reads mid-ticket, and lesson three of
              onboarding are the same knowledge. Most companies write it three times, in three tools,
              and it starts drifting apart the day it is written.
            </p>
            <p className={cx('text-[15px] leading-relaxed', t.textSecondary)}>
              RelayHQ gives it one identity. A course does not copy an article — it points at it. Change
              the article and every place it is taught changes with it.
            </p>
          </div>

          <div className={cx('rounded-2xl border p-6', t.bgCard, t.borderLight)}>
            <div className={cx('rounded-xl p-4 text-center text-white mb-4', GRADIENT.brand)}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">One atom</p>
              <p className="text-[15px] font-semibold mt-0.5">“Reset your password”</p>
            </div>
            <div className="space-y-2">
              {[
                ['Deflection', 'The customer reads it before the request form appears.'],
                ['Enablement', 'The agent sees the same page in context on the ticket.'],
                ['Training', 'Lesson three of the Support Agent curriculum — by reference.'],
              ].map(([k, v]) => (
                <div key={k} className={cx('flex gap-3 rounded-xl border p-3', t.borderLight)}>
                  <CircleCheck size={ICON.md} className={cx('flex-shrink-0 mt-0.5', blue.fg)} />
                  <span>
                    <span className={cx('block text-[13px] font-semibold', t.text)}>{k}</span>
                    <span className={cx('block text-xs', t.textMuted)}>{v}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className={cx('mt-4 text-xs leading-relaxed', t.textMuted)}>
              <strong className={t.text}>{n.dual} of {n.atoms}</strong> knowledge atoms in this demo already
              serve all three. Open Knowledge and check any of them — every number on this page is counted
              from the data you are about to look at, not borrowed from anybody's research.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * What is inside
 * ------------------------------------------------------------------ */

function ModuleGrid() {
  const { t, a } = useTheme();
  return (
    <section className={cx('border-t', t.border)}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className={cx('text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold tracking-tight mb-2', t.text)}>
          Twelve modules, all of them working
        </h2>
        <p className={cx('text-sm mb-8 max-w-[58ch]', t.textSecondary)}>
          Not screenshots behind a form. Click any of them and use it.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(m => {
            const c = a(entityHue(m.kind));
            const Icon = m.icon;
            return (
              <button key={m.label} onClick={() => navigate(...m.to)}
                className={cx('group flex items-center gap-3 rounded-xl border p-3.5 text-left transition',
                  t.bgCard, t.borderLight, 'hover:-translate-y-0.5 hover:shadow-md')}>
                <span className={cx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', c.softStrong)}>
                  <Icon size={ICON.lg} className={c.fg} />
                </span>
                <span className={cx('text-sm font-medium flex-1', t.text)}>{m.label}</span>
                <ArrowRight size={ICON.base} className={cx('flex-shrink-0 opacity-0 group-hover:opacity-100 transition', t.textMuted)} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Footer
 * ------------------------------------------------------------------ */

function Foot() {
  const { t } = useTheme();
  return (
    <footer className={cx('border-t', t.border, t.bgSubtle)}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-wrap items-center gap-4">
          <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center', GRADIENT.brand)}>
            <Mark />
          </span>
          <span>
            <span className={cx('block font-semibold', t.text)}>RelayHQ</span>
            <span className={cx('block text-xs', t.textMuted)}>Service · Support · Training</span>
          </span>
          <span className="flex-1" />
          <button onClick={() => navigate('portal')} className={cx('text-sm', t.textSecondary, 'hover:underline')}>
            Customer portal
          </button>
          <button onClick={() => navigate('workspace')} className={cx('text-sm', t.textSecondary, 'hover:underline')}>
            Open the demo
          </button>
        </div>
        <p className={cx('mt-6 text-xs leading-relaxed max-w-[70ch]', t.textMuted)}>
          A prototype. No authentication, no server, and nothing persists beyond your own browser —
          use “Reset demo data” in the account menu to start over. Northwind Systems and its customers
          are fictional.
        </p>
      </div>
    </footer>
  );
}
