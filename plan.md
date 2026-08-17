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

## Held — awaiting Phil's go-ahead

- (none) — Phil authorised the GitHub Pages deployment on 2026-08-16, so the live site is not held.

## Done

- Design system, architecture, engines and verification gates (E1–E4).
- Repo created at `github.com/pbueschel/relayhq`, Pages live at
  **https://pbueschel.github.io/relayhq/**, CI green.
