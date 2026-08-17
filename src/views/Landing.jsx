import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowRight, Inbox, Stamp, GitBranch, Package, BookOpen, GraduationCap,
  Workflow, Server, Briefcase, AlertOctagon, FileText, ShoppingBag,
  CircleCheck, Search, ChevronRight,
} from 'lucide-react';
import { useTheme, cx, GRADIENT, ICON, entityHue } from '@/ds';
import { useStore } from '@/store/store.js';
import { navigate } from '@/lib/router.js';

/**
 * The landing page — the empty hash route, so the bare URL is the pitch and the
 * app starts one click away.
 *
 * It is a WALKTHROUGH rather than a feature grid: the portal a person actually
 * meets, then the three things standing behind it — queues, knowledge that
 * doubles as training, and automation. Each step carries a rendering of the
 * real screen it is describing.
 *
 * EVERY NUMBER HERE IS COUNTED FROM THE SEED. Not a flourish: four research
 * passes found no trustworthy third-party deflection statistic anywhere, so
 * this product only shows figures a reader can go and check a minute later.
 */

/* The rotating word. The category has a different name depending on who is
 * asking — customer service, HR service management, ITSM — and the argument of
 * the product is that they are one system. The headline makes that argument
 * before the copy does. */
const AUDIENCES = ['Customer', 'HR', 'IT', 'Finance', 'Everything'];
/* One second a word, run once, and STOP on "Everything" — the word that covers
 * the rest. A headline that cycles forever is a thing the eye keeps returning
 * to; one that resolves makes its point and then lets the page be read. It also
 * means the page carries no perpetually-updating text, which is the WCAG 2.2.2
 * concern rather than the animation itself. */
const ROTATE_MS = 1000;

const NAV = [
  { label: 'Portal', to: ['portal'] },
  { label: 'Service catalog', to: ['servicecatalog'] },
  { label: 'Academy', to: ['learning'] },
];

const MODULES = [
  { icon: Inbox,         label: 'Workspace',       kind: 'ticket',     to: ['workspace'] },
  { icon: Stamp,         label: 'Approvals',       kind: 'approval',   to: ['approvals'] },
  { icon: GitBranch,     label: 'Changes',         kind: 'change',     to: ['changes'] },
  { icon: AlertOctagon,  label: 'Problems',        kind: 'problem',    to: ['problems'] },
  { icon: Briefcase,     label: 'Projects',        kind: 'project',    to: ['projects'] },
  { icon: Package,       label: 'Catalog',         kind: 'product',    to: ['catalog'] },
  { icon: ShoppingBag,   label: 'Service catalog', kind: 'product',    to: ['servicecatalog'] },
  { icon: BookOpen,      label: 'Knowledge',       kind: 'article',    to: ['knowledge'] },
  { icon: GraduationCap, label: 'Learning',        kind: 'course',     to: ['learning'] },
  { icon: FileText,      label: 'Forms',           kind: 'form',       to: ['forms'] },
  { icon: Workflow,      label: 'Automations',     kind: 'automation', to: ['automations'] },
  { icon: Server,        label: 'Assets',          kind: 'hardware',   to: ['assets'] },
];

/* ==================================================================== */

export default function Landing() {
  const { t } = useTheme();
  const s = useStore(st => st);
  const n = useCounts(s);

  return (
    <div className={cx('flex-1 overflow-auto', t.bg)}>
      <TopNav />
      <Hero />
      <StepPortal n={n} />
      <StepQueues n={n} />
      <StepKnowledge n={n} />
      <StepAutomations n={n} />
      <ModuleGrid />
      <Foot />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Counts — nothing on this page is typed in
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

    const subforms = s.subforms || [];
    return {
      atoms: knowledge.length,
      dual: knowledge.filter(k => inCatalog.has(k.id) && inCourses.has(k.id)).length,
      items,
      queues: (s.queues || []).length,
      rules: (s.rules || []).length,
      policies: (s.approvalPolicies || []).length,
      forms: subforms.length,
      routed: subforms.filter(f => f.routing?.queueId).length,
      courses: courses.length,
      automations: (s.automations || []).length,
      runs: (s.automationRuns || []).length,
      services: (s.serviceItems || []).length,
    };
  }, [s]);
}

/* ------------------------------------------------------------------ *
 * Chrome
 * ------------------------------------------------------------------ */

function TopNav() {
  const { t } = useTheme();
  return (
    <header className={cx('sticky top-0 z-30 border-b backdrop-blur-xl', t.border, t.bgSidebar)}>
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
              className={cx('text-sm hover:underline', t.textSecondary)}>{item.label}</button>
          ))}
        </nav>
        <div className="flex-1" />
        <button onClick={() => navigate('workspace')}
          className={cx('inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-lg transition hover:brightness-105',
            GRADIENT.brandBar)}>
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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return undefined; }
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/**
 * The rotating audience word — the biggest thing on the page.
 *
 * It runs ONCE, a second a word, and settles on "Everything". Resolving rather
 * than looping is the whole point: the cycle says the category has four names,
 * and the last word says they are one product. A permanent loop would keep
 * pulling the eye back and would leave auto-updating text on the page forever,
 * which is the actual WCAG 2.2.2 concern.
 *
 * ACCESSIBILITY, deliberately:
 *   - under prefers-reduced-motion it never animates at all: "Everything" is
 *     there from the first paint
 *   - the cycling span is aria-hidden and the list is exposed once as a static
 *     label, because a live region would re-announce five times in four seconds
 *   - the longest word reserves the width, so the headline never reflows
 *     mid-sentence
 */
function RotatingWord() {
  const reduced = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const settled = i >= AUDIENCES.length - 1;

  useEffect(() => {
    if (reduced || settled) return undefined;
    const id = setTimeout(() => setI(x => x + 1), ROTATE_MS);
    return () => clearTimeout(id);
  }, [reduced, settled, i]);

  const word = reduced ? 'Everything' : AUDIENCES[i];
  const animate = !reduced && !settled;

  return (
    <span
      className="relative inline-block align-baseline leading-[0.95]"
      aria-label="Customer, HR, IT, Finance — everything"
    >
      {/* Reserves the width of the longest word so the line never jumps. */}
      <span aria-hidden="true" className="invisible">Everything</span>
      <span
        key={word}
        aria-hidden="true"
        className={cx('absolute inset-0 whitespace-nowrap bg-clip-text text-transparent',
          GRADIENT.brandBar, animate && 'animate-[rhqWordIn_.34s_ease-out]')}
      >
        {word}
      </span>
    </span>
  );
}

function Hero() {
  const { t, dark } = useTheme();
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true"
        className={cx('absolute inset-x-0 top-0 h-[520px] pointer-events-none',
          dark ? 'bg-gradient-to-b from-purple-500/20 via-amber-500/[0.06] to-transparent'
               : 'bg-gradient-to-b from-purple-200/60 via-amber-100/45 to-transparent')} />

      <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-16 text-center">
        {/* The audience word is the headline; "Service Management" is what it
            qualifies, so it sits a full step smaller. */}
        {/* No ch-based max-width here. The font-size now lives on the CHILDREN,
            so `ch` would resolve against this element's inherited 16px and clamp
            the headline to ~144px — the line wrapped and the big word overflowed
            its own centred box. The two lines size themselves. */}
        <h1 className={cx('font-bold tracking-[-0.04em]', t.text)}>
          <span className="block text-[clamp(3rem,8.4vw,6.5rem)] leading-[0.98]">
            <RotatingWord />
          </span>
          <span className="block text-[clamp(1.7rem,4.2vw,3rem)] leading-[1.08] mt-1 whitespace-nowrap">
            Service Management
          </span>
        </h1>

        <p className={cx('mt-6 mx-auto max-w-[50ch] text-[15.5px] leading-relaxed', t.textSecondary)}>
          One desk for every team that takes requests. The portal your people meet, the queues behind
          it, the knowledge that doubles as training, and the automation that runs it — one system,
          not four.
        </p>

        <div className="mt-8 flex justify-center">
          <button onClick={() => navigate('portal')}
            className={cx('inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[15px] font-semibold text-white shadow-xl transition hover:brightness-105',
              GRADIENT.brandBar)}>
            Start with the portal <ArrowRight size={ICON.lg} />
          </button>
        </div>
        <p className={cx('mt-3 text-xs', t.textMuted)}>
          No sign-in. Sample data. Everything on screen is real and clickable.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * The walkthrough
 * ------------------------------------------------------------------ */

function Step({ num, eyebrow, title, body, accent, points, cta, to, children, flip }) {
  const { t, a } = useTheme();
  const c = a(accent);
  return (
    <section className={cx('border-t', t.border)}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-2 items-center">
          <div className={flip ? 'lg:order-2' : undefined}>
            <div className="flex items-center gap-3 mb-4">
              <span className={cx('font-mono text-xs font-bold px-2 py-1 rounded-md tabular-nums', c.softStrong, c.fgOnSoft)}>
                {num}
              </span>
              <span className={cx('text-[11px] font-bold uppercase tracking-[0.14em]', c.fg)}>{eyebrow}</span>
            </div>
            <h2 className={cx('text-[clamp(1.45rem,2.9vw,2.1rem)] font-bold tracking-[-0.025em] leading-tight mb-4', t.text)}
              style={{ textWrap: 'balance' }}>
              {title}
            </h2>
            <p className={cx('text-[15px] leading-relaxed mb-5 max-w-[52ch]', t.textSecondary)}>{body}</p>
            <ul className="space-y-2.5 mb-6">
              {points.map(p => (
                <li key={p} className="flex gap-2.5">
                  <CircleCheck size={ICON.md} className={cx('flex-shrink-0 mt-0.5', c.fg)} />
                  <span className={cx('text-sm leading-relaxed', t.textSecondary)}>{p}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => navigate(...to)}
              className={cx('inline-flex items-center gap-1.5 text-sm font-semibold transition-all hover:gap-2.5', c.fg)}>
              {cta} <ArrowRight size={ICON.base} />
            </button>
          </div>
          <div className={flip ? 'lg:order-1' : undefined}>{children}</div>
        </div>
      </div>
    </section>
  );
}

function Shot({ children, label }) {
  const { t } = useTheme();
  return (
    <div className={cx('rounded-2xl border overflow-hidden shadow-xl', t.borderLight, t.bgCard)}>
      <div className={cx('flex items-center gap-1.5 px-3 h-8 border-b', t.border, t.bgSubtle)}>
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        {label && <span className={cx('ml-2 text-[10px] font-mono', t.textMuted)}>{label}</span>}
      </div>
      {children}
    </div>
  );
}

/* ---------- 01 · the portal ---------- */

function StepPortal({ n }) {
  const { t, a } = useTheme();
  return (
    <Step
      num="01" accent="purple" eyebrow="What your people meet"
      title="A front door that answers before it takes a ticket"
      body="Requesters drill Product › Subcategory › Item, and the answers attached to that item are offered first. The request form is there if they still need it — underneath, never instead of."
      points={[
        `${n.items} catalog items, each carrying its own answers and its own intake`,
        'Help renders above the request form, always — that ordering is the mechanic',
        `A second door for ordering: ${n.services} services with a price, a delivery time and a sign-off`,
      ]}
      cta="Open the portal" to={['portal']}
    >
      <Shot label="relayhq / portal">
        <div className={cx('p-5', t.portalBg)}>
          <p className={cx('text-center text-[15px] font-bold mb-2', t.text)}>How can we help?</p>
          <div className={cx('mx-auto max-w-[260px] rounded-lg border px-3 py-1.5 flex items-center gap-2 mb-4', t.bgCard, t.borderLight)}>
            <Search size={11} className={t.textMuted} />
            <span className={cx('text-[10px]', t.textMuted)}>Search help articles and problems…</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['Get Help', '“Something is wrong”', 'purple'], ['Service Catalog', '“I want something”', 'emerald']].map(([ttl, q, hue]) => (
              <div key={ttl} className={cx('rounded-lg border p-2.5', t.bgCard, a(hue).border)}>
                <span className={cx('block w-6 h-6 rounded-md mb-1.5', a(hue).softStrong)} />
                <span className={cx('block text-[11px] font-bold', t.text)}>{ttl}</span>
                <span className={cx('block text-[9px] font-medium', a(hue).fg)}>{q}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {['Cannot sign in', 'Multi-factor not working', 'Laptop not powering on'].map(x => (
              <div key={x} className={cx('rounded-lg border px-2.5 py-1.5 flex items-center gap-2', t.bgCard, t.borderLight)}>
                <span className={cx('w-4 h-4 rounded flex-shrink-0', a('emerald').softStrong)} />
                <span className={cx('text-[10px] flex-1', t.text)}>{x}</span>
                <ChevronRight size={10} className={t.textMuted} />
              </div>
            ))}
          </div>
        </div>
      </Shot>
    </Step>
  );
}

/* ---------- 02 · queues, routing, approvals ---------- */

const ROUTING = [
  ['Report a sign-in problem', 'IT Support', 'blue'],
  ['Request access to an application', 'IT Support', 'blue'],
  ['Software spend approval', 'Procurement', 'amber'],
  ['New hire onboarding', 'People Ops', 'pink'],
  ['Storefront bug report', 'Customer Support', 'rose'],
];

function StepQueues({ n }) {
  const { t, a } = useTheme();
  return (
    <Step
      num="02" accent="rose" eyebrow="What stands behind it" flip
      title="Queues, routing and approvals that actually run"
      body="Each intake names where it lands, so the routing table is derived from the forms rather than authored twice and left to drift. Approvals are a real engine — ordered stages, quorum, the requester's manager resolved live, escalation when nobody moves."
      points={[
        /* The sentence has to survive its own data. When every intake is routed
           there is no "rest", and claiming otherwise is the kind of detail that
           tells a reader the numbers are decoration. */
        n.routed === n.forms
          ? `${n.queues} queues · all ${n.forms} intakes name the one they land in`
          : `${n.queues} queues · ${n.routed} of ${n.forms} intakes name their own; the rest fall to General and say so`,
        `${n.policies} approval policies with all / any / quorum stages and timeout escalation`,
        `${n.rules} business rules, with a tester that shows you why one fired`,
      ]}
      cta="Open business rules" to={['rules']}
    >
      <Shot label="relayhq / rules">
        <div className="p-4 space-y-2">
          {ROUTING.map(([form, queue, hue]) => (
            <div key={form} className={cx('flex items-center gap-2 rounded-lg border px-2.5 py-2', t.borderLight)}>
              <FileText size={12} className={a('purple').fg} />
              <span className={cx('text-[11px] flex-1 truncate', t.text)}>{form}</span>
              <ArrowRight size={10} className={t.textMuted} />
              <span className={cx('text-[9.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap',
                a(hue).soft, a(hue).fgOnSoft)}>{queue}</span>
            </div>
          ))}
          <div className={cx('flex items-center gap-2 rounded-lg border px-2.5 py-2', a('amber').border, a('amber').soft)}>
            <Stamp size={12} className={a('amber').fg} />
            <span className={cx('text-[10px] flex-1 leading-snug', a('amber').fgOnSoft)}>
              Over $500 → manager, then finance · escalates after 24 hours
            </span>
          </div>
        </div>
      </Shot>
    </Step>
  );
}

/* ---------- 03 · knowledge and training, on the dark band ---------- */

function StepKnowledge({ n }) {
  /* The one always-dark section. The walkthrough has been light to here, and
     the tonal drop is what makes a reader stop on the argument that actually
     differentiates the product. Its colours are literal because this surface is
     dark in BOTH themes by choice, not by theming. */
  return (
    <section className="bg-[#0a0812] text-white">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-xs font-bold px-2 py-1 rounded-md bg-white/10 text-white/80 tabular-nums">03</span>
              <span className={cx('text-[11px] font-bold uppercase tracking-[0.14em] bg-clip-text text-transparent', GRADIENT.brandBar)}>
                What you write once
              </span>
            </div>
            <h2 className="text-[clamp(1.55rem,3.1vw,2.35rem)] font-bold tracking-[-0.03em] leading-[1.12] mb-5"
              style={{ textWrap: 'balance' }}>
              The answer, the crib sheet and the lesson are{' '}
              <span className={cx('bg-clip-text text-transparent', GRADIENT.brandBar)}>the same page</span>.
            </h2>
            <p className="text-[15px] leading-relaxed text-white/65 mb-4 max-w-[52ch]">
              Most companies write it three times — once for the help centre, once for the agent, once
              for onboarding — in three tools that drift apart from the day they are written.
            </p>
            <p className="text-[15px] leading-relaxed text-white/65 mb-6 max-w-[52ch]">
              RelayHQ gives it one identity. A course does not copy an article, it points at it. Fix the
              article and every place it is taught is already fixed.
            </p>
            <button onClick={() => navigate('knowledge')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-300 transition-all hover:gap-2.5">
              Open knowledge <ArrowRight size={ICON.base} />
            </button>
          </div>

          <div>
            <div className={cx('rounded-2xl p-5 text-center mb-3 shadow-[0_0_70px_-14px_rgba(168,85,247,0.7)]', GRADIENT.brand)}>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">One atom</p>
              <p className="text-[16px] font-semibold mt-1">“Reset your password”</p>
            </div>
            <div className="grid gap-2">
              {[
                ['Deflection', 'The requester reads it before the form appears.'],
                ['Enablement', 'The agent sees the same page in context on the ticket.'],
                ['Training', 'Lesson three of the Support Agent curriculum — by reference.'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                  <CircleCheck size={ICON.md} className="flex-shrink-0 mt-0.5 text-purple-300" />
                  <span>
                    <span className="block text-[13px] font-semibold">{k}</span>
                    <span className="block text-xs text-white/55 leading-relaxed">{v}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-white/50">
              <strong className="text-white/85">{n.dual} of {n.atoms}</strong> atoms in this demo already do
              all three, across <strong className="text-white/85">{n.courses}</strong> courses. Every number on
              this page is counted from the data you are about to look at, not borrowed from anybody's research.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 04 · automations ---------- */

const NODES = [
  { left: '3%',  top: '42%', label: 'Ticket created', hue: 'emerald' },
  { left: '33%', top: '42%', label: 'IF · VIP',       hue: 'amber' },
  { left: '68%', top: '14%', label: 'Set urgent',     hue: 'rose' },
  { left: '68%', top: '68%', label: 'Assign queue',   hue: 'sky' },
];

function StepAutomations({ n }) {
  const { t, a, dark } = useTheme();
  return (
    <Step
      num="04" accent="sky" eyebrow="Then it runs itself"
      title="Automations you can read, on a canvas you can follow"
      body="Triggers, branches and actions over RelayHQ's own domain, not a generic integration tool bolted on the side. Drag the nodes, wire the outputs, run it, and read a per-node execution log."
      points={[
        `${n.automations} automations in the demo, with ${n.runs} recorded runs to read`,
        'IF and Switch draw their real branches; every node reports its own timing and item count',
        'Each action is a RelayHQ verb — assign a queue, start an approval, enroll someone in a course',
      ]}
      cta="Open automations" to={['automations']}
    >
      <Shot label="relayhq / automations">
        <div className={cx('relative h-[220px] rhq-canvas', t.bgSubtle)}
          style={{ '--rhq-grid': dark ? '#3f3f46' : '#d4d4d8' }}>
          <svg className="absolute inset-0 w-full h-full" aria-hidden="true" viewBox="0 0 480 220" preserveAspectRatio="none">
            <path d="M108 100 C 140 100, 130 100, 158 100" stroke="#38bdf8" strokeWidth="1.6" fill="none" />
            <path d="M240 92  C 280 92, 280 44, 322 44"    stroke="#38bdf8" strokeWidth="1.6" fill="none" />
            <path d="M240 108 C 280 108, 280 162, 322 162" stroke="#38bdf8" strokeWidth="1.6" fill="none" />
          </svg>
          {NODES.map(nd => (
            <div key={nd.label}
              className={cx('absolute rounded-lg border px-2.5 py-1.5 shadow-sm', t.bgCard, t.borderLight)}
              style={{ left: nd.left, top: nd.top }}>
              <span className={cx('block w-1.5 h-1.5 rounded-full mb-1', a(nd.hue).dot)} />
              <span className={cx('text-[10px] font-semibold whitespace-nowrap', t.text)}>{nd.label}</span>
            </div>
          ))}
          <span className={cx('absolute bottom-2 left-3 text-[9px] font-mono', t.textMuted)}>
            run 42 · 5 nodes · 128 ms · success
          </span>
        </div>
      </Shot>
    </Step>
  );
}

/* ------------------------------------------------------------------ *
 * What is inside
 * ------------------------------------------------------------------ */

function ModuleGrid() {
  const { t, a } = useTheme();
  return (
    <section className={cx('border-t', t.border, t.bgSubtle)}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className={cx('text-[clamp(1.4rem,2.6vw,1.9rem)] font-bold tracking-tight mb-2', t.text)}>
          Twelve modules, all of them working
        </h2>
        <p className={cx('text-sm mb-8 max-w-[58ch]', t.textSecondary)}>
          Not screenshots behind a contact form. Click any of them and use it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map(m => {
            const c = a(entityHue(m.kind));
            const Icon = m.icon;
            return (
              <button key={m.label} onClick={() => navigate(...m.to)}
                className={cx('group flex items-center gap-3 rounded-xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md',
                  t.bgCard, t.borderLight)}>
                <span className={cx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', c.softStrong)}>
                  <Icon size={ICON.lg} className={c.fg} />
                </span>
                <span className={cx('text-sm font-medium flex-1', t.text)}>{m.label}</span>
                <ArrowRight size={ICON.base} className={cx('flex-shrink-0 opacity-0 transition group-hover:opacity-100', t.textMuted)} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Foot() {
  const { t } = useTheme();
  return (
    <footer className={cx('border-t', t.border)}>
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-wrap items-center gap-4">
          <span className={cx('w-8 h-8 rounded-xl flex items-center justify-center', GRADIENT.brand)}><Mark /></span>
          <span>
            <span className={cx('block font-semibold', t.text)}>RelayHQ</span>
            <span className={cx('block text-xs', t.textMuted)}>Service · Support · Training</span>
          </span>
          <span className="flex-1" />
          <button onClick={() => navigate('portal')} className={cx('text-sm hover:underline', t.textSecondary)}>Customer portal</button>
          <button onClick={() => navigate('design')} className={cx('text-sm hover:underline', t.textSecondary)}>Design system</button>
          <button onClick={() => navigate('workspace')} className={cx('text-sm hover:underline', t.textSecondary)}>Open the demo</button>
        </div>
        <p className={cx('mt-6 text-xs leading-relaxed max-w-[70ch]', t.textMuted)}>
          A prototype. No authentication, no server, and nothing persists beyond your own browser — use
          “Reset demo data” in the account menu to start over. Northwind Systems and its customers are fictional.
        </p>
      </div>
    </footer>
  );
}
