# RelayHQ

**Live: https://pbueschel.github.io/relayhq/**

A service management platform prototype that is three products on one substrate.

| | |
|---|---|
| **Internal service management** | Tickets, approvals, change enablement, problems, assets — ITSM-shaped |
| **External customer service** | Contacts, organizations, plans, SLA, omnichannel intake |
| **Training platform** | Knowledge atoms compose into courses that teach a job function completely |

---

## The idea

Most service tools make you author the same thing three times. The help-centre article, the
crib sheet the agent reads while working a ticket, and the training lesson for a new hire are the
same knowledge — written three times, in three places, drifting apart from the day they are written.

RelayHQ treats that knowledge as a single **atom** with one identity, referenced wherever it is
needed:

```
                        ┌──────────────────────┐
                        │  "Reset a password"  │
                        │   one authored atom  │
                        └──────────┬───────────┘
                     ┌─────────────┼─────────────┐
                     ▼             ▼             ▼
              DEFLECTION     ENABLEMENT       TRAINING
        Customer drills   Agent sees it    Lesson 3 of the
        the catalog and   in context on    Support Agent
        reads it before   the ticket       curriculum
        the form appears
```

Author once. Serve three surfaces. That reuse is the product, not an optimisation — and the app
shows it: open any knowledge atom and it tells you the catalog items and courses it appears in.

The colour system encodes it too. The learning domain is indigo, but a **lesson is blue — the same
hue as an article** — because a lesson *is* a knowledge atom. `test/smoke.js` asserts that equality
so it cannot be quietly tidied away.

## What is in here

**Catalog** — Product → Subcategory → Item. Items are leaves and carry the content. Copying an item
between products reuses the same atoms rather than duplicating them.

**Knowledge** — Two formats. *Articles* are rich text. *Guides* are Instagram-Stories-style: an
ordered run of image/video slides with captions, segmented progress bars, tap-to-advance and
hold-to-pause — with a pause control, alt text and a read-as-text fallback, because auto-advancing
content is a WCAG concern rather than a free win.

**Forms** — Multiple request forms per catalog item, which is the point: "report a problem" and
"request access" are different intakes on the same item, routing to different queues. Thirteen
field types, conditional display, per-form routing and approval policy.

**Business Rules** — Queues, derived routing (computed from each form, so there is one source of
truth and no drift), and a real condition builder: typed operators, nested all/any groups, and a
**rule tester** that shows the evaluation trace with actual values so you can see *why* a rule fired.

**Approvals** — Policies with ordered stages, unanimous / any-one / quorum, and dynamic approvers
(the requester's manager, their skip-level, a queue, a department head, a role) resolved and frozen
at creation. Timeouts escalate. v1 modelled approvals; these run.

**Changes** — Standard / normal / emergency with genuinely different paths, the ITIL lifecycle as a
stepper, risk derived from an assessment questionnaire rather than typed into a dropdown, CAB voting,
and a change calendar with freeze windows and overlap conflict detection.

**Projects** — ClickUp-shaped: List (default), Board, Calendar and Timeline; group by status,
assignee or priority; per-project custom fields and custom statuses; dependencies and milestones.

**Assets** — Hardware and software. Hardware separates the *model* from the *instance* and can be
owned by **a person or a location**, with check-in/check-out history. Software tracks entitlements
against allocations and reports a real **compliance position** — over-deployed, under-used, and the
dollar exposure.

**Automations** — An n8n-style canvas: draggable nodes, SVG bezier connections, triggers and logic
and RelayHQ-domain actions, `{{ $json.field }}` expressions, and an execution log with per-node
timings.

**Portal** — The customer-facing side, and where the argument gets made: progressive drill-down,
help shown above request forms, working guides, real submissions that land as tickets, and an
academy surface for external learners.

**Design system** — At [`#/design`](https://pbueschel.github.io/relayhq/#/design). It renders the
real components, so it cannot drift from the app.

## Running it

```bash
bun install
bun run dev            # http://localhost:5173
```

Gates — all three must pass before anything is called done:

```bash
bun test/smoke.js          # content guards, design-system invariants, seed integrity
bun run build
bun test/render-check.js   # headless Chrome over every route — run this one ALONE
```

`bun run check` runs the three in order.

## How it is built

Vite + React + Tailwind v4 on bun. No backend: state lives in a small external store with per-slice
subscriptions and a `localStorage` overlay, so demo edits survive a reload and "Reset demo data" in
the account menu restores the seed. Routing is hash-based because GitHub Pages has no server-side
rewrite, which also makes every screen deep-linkable.

```
src/
  ds/          the design system — tokens, generated accent map, primitives, overlays, nav
  lib/         pure engines: conditions (rules), approvals, router, search
  store/       schema, store, seed/ (one file per domain, shared ids in seed/ids.js)
  views/       one file per module
  components/  shared chrome — top bar, command palette, activity feed
```

`src/ds/accents.js` is **generated** (`bun scripts/gen-accents.js`) so that every Tailwind colour
class exists as a literal string. A class built at runtime is invisible to Tailwind's scanner and
renders unstyled — the previous prototype shipped exactly that bug, and the smoke gate now makes it
impossible.

## Reading further

- `CLAUDE.md` — the hard rules
- `plan.md` — epics, work items, acceptance criteria
- `docs/decisions.md` — why the significant choices were made
- `docs/playbooks/design-system.md` — how to extend the app without breaking the look
- `docs/research/` — dated, fact-checked market research behind the feature set

---

*Prototype. No auth, no persistence beyond your own browser, sample data only. Northwind Systems and
its customers are fictional.*
