# RelayHQ — rules for Claude Code

<!-- Hard rules only. Context and narrative belong in README/plan/docs. -->

## What this is

RelayHQ is **three products on one substrate**, and every decision must hold for all three:

1. **Internal service management** — ITSM-shaped: tickets, approvals, change, problems, assets
2. **External customer service** — a company supporting its own customers (contacts, orgs, SLA, CSAT)
3. **A training platform** — knowledge atoms compose into courses that teach a job function

A change that only makes sense for internal IT is wrong. Check it against external CS and training too.

## Rule 0 — the content-atom rule

**A knowledge atom is authored once and referenced everywhere. It is never copied.**

`knowledge` and `subforms` are top-level collections. Catalog items reference them by id
(`item.knowledgeIds`, `item.subformIds`); course modules reference the same atoms by id
(`module.lessonIds`). One atom therefore serves deflection, agent enablement and training
simultaneously — that reuse is the product, not an optimisation.

If a feature needs to duplicate an atom to work, it does not belong here. Bring it to Phil.

`test/smoke.js` enforces referential integrity and asserts `ENTITIES.lesson.hue === ENTITIES.article.hue`,
because the colour map encodes this rule. Do not weaken those guards to land a feature.

## Hard rules

1. **bun, not node/npm.** `bun install`, `bun run build`, `bun test/smoke.js`.
2. **Never build a Tailwind colour class by interpolation.** `` `bg-${hue}-500` `` compiles to nothing
   and renders unstyled — v1 shipped this bug. Go through `accentSet` / `useTheme().a(hue)`.
   `src/ds/accents.js` is generated; regenerate with `bun scripts/gen-accents.js`, never hand-edit.
3. **Never hardcode a grey.** Everything themes through `t` from `useTheme()`. A surface `t` lacks
   is a token gap — add it to `src/ds/tokens.js`, do not inline it.
4. **No `<form>` elements.** Use `onClick`/`onChange`.
5. **Components are defined at module scope**, never inside another component's body. Inner
   components remount on every parent render — that was v1's performance ceiling.
6. **Cross-domain seed ids come from `src/store/seed/ids.js`.** Never write another domain's id
   as a string literal.
7. **Public URL back-compat**: the site is served from `/relayhq/`. `vite.config.js` `base` must
   match, and routing is hash-based so deep links survive on Pages.

## Verification gates

Both must pass before any work is called done, and CI runs both:

```
bun test/smoke.js      # content guards, DS invariants, seed referential integrity
bun run build          # must be clean
bun test/render-check.js   # headless Chrome over all routes — RUN THIS ALONE
```

`render-check` starts its own static server and drives headless Chrome. **Run it alone** — a second
headless Chrome against the same profile will hang the run. There is no `timeout` binary on macOS;
the script uses explicit kill timers instead.

## Design system

`src/ds/` is the only source of visual construction. A view that reaches past it is a bug.
The living styleguide at `#/design` renders the real components, so it cannot drift from the app —
read it before extending anything. The standing rules are listed on its **Rules** tab and in
`docs/playbooks/design-system.md`.

## Memory

- `plan.md` — epics, work items, acceptance criteria, **Held** deliverables. Read before working.
- `docs/worklog.md` — session journal, append-only. Entry at the end of every session.
- `docs/decisions.md` — decision log, append-only.
- `docs/research/` — dated, fact-checked syntheses. Don't re-run research that has a current one.
- `docs/playbooks/` — read the relevant playbook before a repeatable task.

## Held deliverables

Outward-facing deliverables are HELD until Phil gives explicit go-ahead. Track them in
plan.md under **Held**. The GitHub Pages deployment itself is *not* held — Phil authorised it
on 2026-08-16.

**Deploying is not the same as sharing.** Something can be live at the public URL and still be
held: the landing page on the empty hash route is exactly that as of 2026-08-17. Read the **Held**
section of plan.md before sending anyone a link, and never send one on your own initiative.

## Environment note

`~/Documents` is iCloud-synced on Phil's Mac, which makes `node_modules` there slow to install and
noisy to sync. `node_modules/` is gitignored; CI installs its own. If local dev is slow, exclude
`node_modules` from iCloud sync rather than moving the repo.
