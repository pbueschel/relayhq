# Plan — RelayHQ

## Goal

RelayHQ is a service-management platform prototype that spans **three products on one substrate**:
internal service management (ITSM), external customer service, and a training platform. The
unifying thesis is that a **knowledge atom is authored once and serves three surfaces** —
deflection in the customer portal, enablement for the agent working a ticket, and a lesson inside
a course that teaches a job function.

"Done" for this build means: the v1 single-file React prototype is re-founded on a real design
system, the gaps Phil named are filled (running approvals, finished change + project management,
hardware/software asset management with user *and* location ownership, an n8n-style automation
workspace, and a customer portal that argues for the category→subcategory→item model), and the
whole thing is live on GitHub Pages with verification gates in CI.

## Constraints & assumptions

- **Client-side only.** No backend, no auth. State is in-memory with a `localStorage` overlay.
  Anything requiring a server is out of scope.
- **bun toolchain**, Vite + React + Tailwind v4, deployed to GitHub Pages from `main` via Actions.
- **Hash routing**, because Pages has no server-side rewrite.
- The v1 visual language is **preserved, not redesigned**. The design system is an extraction of
  what already existed, with new entities added in the same idiom.
- Predecessor: the abandoned Bun/Elysia/SQLite RelayHQ was moved to `~/.Trash/relayhq-abandoned-2026-08-16`
  on Phil's instruction (2026-08-16). Nothing depends on it.

## Epics

### E1 — Design system  ✅
- [x] W1.1 — Generated accent map, 18 hues × 12 roles, as literal Tailwind classes — **AC:** no interpolated colour class anywhere; smoke gate enforces it
- [x] W1.2 — Surface tokens, entity registry, status/priority, density, layout — **AC:** every entity has a registered hue; no hardcoded greys outside `tokens.js`
- [x] W1.3 — Primitives, forms, overlays, navigation, all at module scope — **AC:** no component declared inside another component
- [x] W1.4 — Living styleguide at `#/design` rendering the real components — **AC:** cannot drift from the app; documents the standing rules
- [x] W1.5 — Container-query lens bar as the reference condensing control — **AC:** sizes off its own width, not the viewport

### E2 — Architecture  ✅
- [x] W2.1 — External store with per-slice subscriptions — **AC:** editing a ticket does not re-render the asset table
- [x] W2.2 — Knowledge + subforms lifted to top-level collections — **AC:** one atom referenced by a catalog item *and* a course module; smoke asserts integrity
- [x] W2.3 — Hash router, lazy-loaded views — **AC:** every screen deep-linkable and reload-safe on Pages
- [x] W2.4 — `localStorage` persistence with seed fallback and a reset action — **AC:** demo edits survive reload; seed never mutated

### E3 — Engines  ✅
- [x] W3.1 — Condition engine: field catalogue, typed operators, nested all/any groups, `explain()` trace — **AC:** a rule tester can show why a rule did or did not fire
- [x] W3.2 — Approval engine: policies, ordered stages, all/any/quorum, dynamic approvers (manager, skip-level, queue, department head, role), timeout escalation — **AC:** approvals *run*, not just model; approvers frozen at creation

### E4 — Verification  ✅
- [x] W4.1 — Smoke gate: content guards, DS invariants, seed referential integrity — **AC:** catches interpolated classes, hardcoded greys, `<form>`, dangling ids, missing slide alt text
- [x] W4.2 — Headless Chrome render check over every route — **AC:** fails on unmounted views and on `undefined`/`NaN`/`[object Object]` in the DOM
- [x] W4.3 — GitHub Actions running both gates before deploy — **AC:** green on `main`; site live

### E5 — Modules  ✅
- [x] W5.1 — Catalog: three-level tree, shared-atom attachment, import/copy, cascade delete
- [x] W5.2 — Knowledge: article + Instagram-style guide authoring, lesson metadata, reuse panel
- [x] W5.3 — Forms: subform builder, 13 field types, conditional display, routing, approval policy
- [x] W5.4 — Business Rules: queues, derived routing, condition builder, rule tester, approval policy editor, SLA
- [x] W5.5 — Approvals: inbox, stage ladder, decide/advance, timeout demo, delegation
- [x] W5.6 — Changes: three change types, ITIL lifecycle, derived risk, CAB, calendar with freeze windows and conflict detection, PIR
- [x] W5.7 — Problems: RCA, known-error workaround enforcement, incident links, permanent fix via change
- [x] W5.8 — Workspace: stats, lens bar, composing filters, ticket card with SLA and internal/external requester, task modal gating
- [x] W5.9 — Projects: ClickUp-style List/Board/Calendar/Timeline, group-by, custom fields and statuses, dependencies, milestones
- [x] W5.10 — Assets: model/asset split, person *and* location ownership, check-in/out history, license allocations, compliance position, contracts and renewals
- [x] W5.11 — Automations: n8n-style canvas, node taxonomy over RelayHQ's domain, expressions, execution log
- [x] W5.12 — Learning: curriculum → course → module → lesson from knowledge atoms, learners rollup, lesson player
- [x] W5.13 — Portal: drill-down, KB-before-form, accessible Stories guide viewer, real submission, academy, the argument panel

### E6 — Research  ✅
- [x] W6.1 — ITSM/PM/automation market research, fact-checked — **AC:** dated synthesis in `docs/research/` with a gap-analysis table
- [x] W6.2 — External customer service + training/LMS research, fact-checked — **AC:** dated synthesis; the tri-modal thesis tested honestly
- [x] W6.3 — Research-informed refinement pass over the modules — **AC:** every "must" recommendation either built or explicitly declined in `docs/decisions.md`

### E7 — Documentation
- [x] W7.1 — CLAUDE.md, plan.md, worklog, decisions
- [x] W7.2 — Design system playbook
- [x] W7.3 — README with the product story and local dev instructions

### E8 — Design refinement, from Phil's review of the live site (2026-08-17)
- [x] W8.1 — Restore v1's gradient treatment as first-class token roles — **AC:** `moduleGradient()`, `tint()`, `headWash()` in `tokens.js`; no module paints its own gradient
- [x] W8.2 — Unified module header: two bands plus a filter tray — **AC:** every module uses `ModuleHeader`; filters are multi-select and show values with counts; the filter box is a scoped in-page search
- [x] W8.3 — Portal front doors: Get Help vs Service Catalog, visibly distinct — **AC:** a first-time visitor can tell which door leads to their request without reading body copy
- [x] W8.4 — The portal drill happens inside a contained card, not a page navigation — **AC:** the page behind never moves; every level from door to receipt is in the card
- [x] W8.5 — Service catalog as its own record type — **AC:** `serviceCategories` + `serviceItems` separate from the help tree; `grantsAccess` on the item
- [x] W8.6 — Service approvals actually fire from portal submissions — **AC:** 15/15 seeded service requests match a policy; smoke guards it
- [x] W8.7 — Catalog content in fault voice — **AC:** every leaf names what went wrong; "Not listed" ends every subcategory and every product
- [x] W8.8 — Long-pill option rows and the original user-driven guide viewer — **AC:** no timer anywhere in the Stories viewer
- [x] W8.9 — Knowledge rows in the portal drill open the atom — **AC:** every knowledge row is clickable
- [x] W8.10 — Landing page on the empty hash route — **AC:** rotating audience word settles on "Everything"; every figure computed from seed; reduced-motion respected
- [x] W8.11 — Portal home shows the requester's own open work — **AC:** approvals awaiting their decision, then their open tickets; nothing about what other people request; panel hides when empty

### E10 — Header consistency, from Phil's review of the live site (2026-08-17)  ✅
- [x] W10.1 — `ModuleHeader` restructured into two bands of FIXED height that never wrap — **AC:** the header's
  height and control-row count are identical at 1024 / 1280 / 1440 / 1728px, and do not change when a filter is
  applied; `test/width-check.js` proves it and fails if reverted
- [x] W10.2 — Row 1 is a three-column grid: identity left, view control CENTRED, primary action right —
  **AC:** the centred control does not move when the subtitle changes length (a flex spacer centres against its
  neighbours, equal `minmax(0,1fr)` tracks do not)
- [x] W10.3 — Scoped search moved onto the filter line, which is now permanent — **AC:** search and filters sit
  on one row; no control can dismiss the row the search field lives in; `Clear all` is pinned and never scrolls
  out of reach
- [x] W10.4 — `SubTabs` gains an `inline` variant at `CONTROL_H` that shrinks by scrolling — **AC:** Assets'
  Compliance tab is reachable below a 938px viewport instead of being clipped by `main`'s `overflow-hidden`
- [x] W10.5 — `PageBody` aligns left by default, with `align="centre"` kept for reading surfaces — **AC:** the
  list shares its left edge with the module title at every width; Assets uses one width cap across all five tabs
  so the edge no longer jumps between tabs
- [x] W10.6 — Workspace groups by DUE DATE by default, with a group-by control preserving the by-type view —
  **AC:** grouping is its own state rather than derived from the lens; both readings remain reachable
- [x] W10.7 — All 32 `ModuleHeader` call sites across 14 views migrated together — **AC:** smoke fails if any
  view still passes the legacy `tools`/`tray` props or references `FilterToggle`/`FilterTray`
- [x] W10.8 — `test/width-check.js` added and wired into CI; `engines.js` added to the documented gate list —
  **AC:** the header-shape gate fails (exit 1) when the old wrapping header is reinstated

### E9 — Discovered, not yet built

**Investigated 2026-08-17, not started.** The findings below are measured, not estimated — see
`docs/decisions.md` for the two corrections to what this epic originally assumed.
- [ ] W9.0 — **Wire `cat-p-applications` to a portal form.** No FORM lists it in `productIds`, and `Portal.jsx:618`
  scopes the help tree to `form.productIds`, so the whole 44-item Application & Software product is unreachable to
  a portal visitor. Root cause is a hard-rule-6 smell: the product is declared as a bare string literal
  (`catalog.js:941`) because `ids.js` has no `P_APPLICATIONS`, so `forms.js` had nothing to reference.
  **AC:** `P_APPLICATIONS` added to `ids.js` CAT; `form-employee-help` lists it; a smoke guard asserts every root
  product is reachable from at least one published form. **Do this before W9.1 and W9.2 — both are moot until the
  product renders at all.**
- [ ] W9.1 — General "this application is broken" subform in `src/store/seed/forms.js` — **AC:** no catalog leaf
  drills to a dead end; every item without its own intake falls back to this one. **29 items are affected, not the
  ~90 previously recorded** — 28 in Application & Software, 1 in Workplace & Facilities, all `audience: internal`.
  8 of them are "Not listed" escape hatches, including `cat-i-apps-not-listed`, the last stop in the whole
  Application & Software branch. No existing subform fits any of them: the nearest candidates either book a
  physical repair (`sf-laptop-repair`) or raise a purchase order (`sf-software-request`) for what is a software
  fault. The fallback must be audience-aware, or an external item without an intake would be offered an internal form.
- [ ] W9.2 — `PRODUCT_ICON` entry for `cat-p-applications` in `src/views/Portal.jsx` — **AC:** the Application &
  Software product renders its own glyph, not the generic Folder. Blocked behind W9.0; the glyph cannot render
  while the product is unreachable.
- [ ] W9.3 — `LessonRecord` keyed by `knowledgeId` with `source: 'course' | 'deflection' | 'agent_context'` — **AC:** reading an article for deflection counts toward training; the Learning rollup shows where completion came from
- [ ] W9.4 — Catalog-derived coverage matrix and "generate starter curriculum" — **AC:** shows which catalog items have no atom, and can seed a course from the gaps
- [ ] W9.5 — Move `prerequisiteIds` off the knowledge atom onto the lesson placement — **AC:** the same atom can be a prerequisite in one course and not another
- [ ] W9.6 — Promote the `SVCSF` service-subform ids into `src/store/seed/ids.js` — **AC:** no service subform id written as a bare string

## Held — awaiting Phil's go-ahead

- **The landing page** (`https://pbueschel.github.io/relayhq/`) is built, live and passing gates,
  but **not cleared for sharing**. Phil's framing was "before we share this out to anyone" — he has
  reviewed it and asked for changes, but has not given go. Do not send the link onward without his
  explicit word. (The app itself was authorised for Pages on 2026-08-16; it is the *pitch* that is
  held, and it sits at the same URL.)
- **The landing page's hand-drawn screenshots are now out of date** (`Landing.jsx`, the three `<Shot>`
  mockups at ~363 / ~423 / ~538). They are static markup, not real components, so the E10 header rework
  could not move them — and nothing compares them to the app. They now depict a header and a list
  alignment the product no longer has. Redrawing them is itself an outward-facing change to a held
  deliverable: build it, then stop and show Phil.

## Done

- Design system, architecture, engines and verification gates (E1–E4).
- Repo created at `github.com/pbueschel/relayhq`, Pages live at
  **https://pbueschel.github.io/relayhq/**, CI green.
- Design refinement pass from Phil's live review, 2026-08-17 (E8) — gradients, header, portal
  rebuild, service catalog, approvals fix, catalog content, landing page.
