# Worklog — RelayHQ

Append-only. Newest last.

---

## 2026-08-16 — Founding session: v1 prototype → design system → thirteen modules → live

**Where this started.** Phil's `customer-service-tool (4).jsx` — a 7,498-line single-file React
prototype — plus a hand-off brief. The ask: analyse it, fill the gaps against market research,
build a design system around the existing look, use that system to build out the rest, and publish
to GitHub Pages the way PostParade was.

**Two clarifications arrived mid-session and both changed the work:**
1. The product is **RelayHQ**, not ServiceHub.
2. RelayHQ is not ITSM-only. It is also an **external customer service platform** and a **training
   platform** — knowledge base items stitch into classes that teach a job function completely.

The second reframing landed after the first research workflow was already running, so a second
workflow was launched to cover external CS and LMS/customer-education rather than retro-fitting
ITSM findings onto a different product.

### What was built

**Design system first**, as asked, extracted from v1's visual language rather than redesigned:
- `scripts/gen-accents.js` emits `src/ds/accents.js` — 18 hues × 12 roles, every Tailwind class a
  literal string.
- Surface tokens, a 30-entry entity colour registry, shared status/priority, frozen density
  constants, layout constants.
- Primitives / forms / overlays / navigation, all at module scope.
- A living styleguide at `#/design` that renders the real components, so it cannot drift.

**Architecture.** External store with per-slice subscriptions; hash routing; lazy views;
`localStorage` persistence with the seed as an immutable fallback.

**Engines.** `lib/conditions.js` (typed operators, nested all/any groups, `explain()` traces) and
`lib/approvals.js` (ordered stages, all/any/quorum, dynamic approvers, timeout escalation).
99 assertions, passing on the first run.

**Thirteen modules** built in parallel against the design-system contract, each with its own seed
slice, then independently reviewed for conformance. ~10,600 lines of seed data.

**Verification.** 389 smoke checks (content guards + DS invariants + referential integrity +
Rule 0), 99 engine assertions, and a headless-Chrome render check over all 14 routes. All wired
into CI ahead of deploy.

### What went wrong, and what it cost

- **The repo name was taken.** `~/Documents/GitHub/relayhq` held an abandoned Bun/Elysia/SQLite
  RelayHQ from February. Phil confirmed it was dead; moved to `~/.Trash/relayhq-abandoned-2026-08-16`
  rather than `rm -rf`, since it was untracked and had no other copy.
- **`~/Documents` is iCloud-synced**, which is why that move took minutes rather than seconds. Built
  in the scratchpad on local disk instead and cloned into place at the end.
- **The render gate was flaky and both causes were mine.** The readiness signal used a double nested
  `requestAnimationFrame`; under Chrome's headless virtual-time mode a static page produces exactly
  one frame, so the inner callback never ran. Busier routes produced a second frame and masked it,
  which is why failures moved between runs. Fixed to one frame plus a timeout, added retry for
  genuinely transient failures, and disabled Chrome's background networking (its component-update
  fetches were printing SSL errors that read as page failures).
- **One research sub-agent read the trashed repo** instead of the live one and wrote its critique
  against a schema we had already fixed. The synthesis agent caught it and corrected the framing.
- **The ITSM synthesis wrote to a stray path** (`~/Documents/GitHub/RelayHQ/`) because of the session
  cwd at launch time. Recovered into the repo, verified identical, stray removed.

### Decisions worth remembering

Recorded in full in `docs/decisions.md`. The load-bearing ones:

- **Knowledge and subforms are top-level collections**, referenced by id. This is what makes the
  training layer possible rather than bolted on — a nested article cannot be a lesson in two courses
  and a help topic under two catalog items at once.
- **The honest claim is "the article is the lesson's *body*, and the wrapper is thin"** — not "the
  KB becomes a course". Research tested the thesis against DITA and the LMS market: the architecture
  buys distribution across surfaces for free and buys no pedagogy. So a Lesson is a placement with
  no body field, and the teaching voice lives on the placement.
- **No borrowed deflection statistic, ever.** Four research passes found no disinterested source;
  published figures run 5–80%, all vendor self-reported. RelayHQ measures its own and calls it
  **assisted resolution**, with the caveat printed on screen.
- **`format: 'guide'` kept** rather than renamed to `'slides'` — a recommendation explicitly
  declined and recorded, because "guide" names no container here and it is Phil's own word.

### State at end of session

- Live: **https://pbueschel.github.io/relayhq/** — CI green, all gates running before deploy.
- Both research syntheses committed: 2,366 lines across ten dimensions, each independently
  fact-checked.
- Nothing is Held. Phil authorised the Pages deployment in the original request.

### Where the next session should start

1. Read `plan.md` and `docs/decisions.md`.
2. The two research documents contain more "must" recommendations than were built. The ITSM
   synthesis §4 has a 66-step dependency-aware build order; the CS/training synthesis §5 has a
   priority table. Neither has been fully worked through — that is the obvious next queue.
3. Specific items already identified and not yet built: `LessonRecord` keyed by `knowledgeId` with
   `source: 'course' | 'deflection' | 'agent_context'` (deflection reading counts toward training —
   the mechanic no competitor can copy), the catalog-derived **coverage matrix** and "generate
   starter curriculum" screen, approval delegation surfaced in more places, and moving
   `prerequisiteIds` off the atom onto the lesson placement.

---

## 2026-08-17 — Design feedback session: gradients restored, header unified, portal rebuilt twice, landing page

Everything this session came from Phil looking at the live site and reacting. No new epics were
invented; the work was making what exists correct.

### Changed

**Gradients restored as a first-class token role** (`src/ds/tokens.js`). The founding build had
flattened v1's gradient treatment to a plain off-white. Added `MODULE_GRADIENT` / `moduleGradient()`,
`TINT` / `tint()`, `HEAD_WASH` / `headWash()` and swept every module onto them. Shown to Phil as a
Claude artifact before implementing.

**Header architecture** (`src/ds/header.jsx`, new). Four mixed-size bands → two bands plus a filter
tray. `ModuleHeader`, `ScopedSearch`, `FilterToggle`, `FilterTray`, `MultiSelectFilter`,
`useHeaderFilters`. Filters became multi-select and display their values with per-option counts; the
old filter box became a scoped in-page search. Applied to every module. Two artifacts were used to
agree the design before code.

**Portal rebuilt, twice** (`src/views/Portal.jsx`, ~3,900 lines).
- First pass: SaaS landing shape with two explicit front doors — **Get Help** ("something is wrong")
  and **Service Catalog** ("I want something").
- Second pass, on Phil's note that full-page navigation was jarring: the entire drill now happens
  inside a contained card (`LeafCard`, `createPortal`, fixed overlay). The page never moves.
- Long-pill option rows restored over stacked pills; the Stories guide viewer reverted to the
  original style with **no timer** — the reader pages themselves.
- Knowledge rows in the drill now open the atom (they were dead).
- "Most requested" removed in favour of `OpenWork` — the requester's pending approvals and open
  tickets. See `docs/decisions.md`.

**The service catalog became its own record type.** `serviceCategories` + `serviceItems`, separate
from the Get Help `catalog` tree, with `grantsAccess` on the item. Documented in
`src/store/schema.js`.

**Catalog content reworked to fault voice.** 7 products / 33 subcategories / 193 items. New
`Application & Software` product. "Not listed" as the last item of every subcategory and last
subcategory of every product.

**Landing page** (`src/views/Landing.jsx`, new) on the empty hash route. Three directions were
proposed as an artifact, Phil picked one and then asked to blend all three; the final shape is his
brief verbatim — rotating audience word ("Customer · HR · IT · Finance · Everything") over
"Service Management", then the portal view, then a walkthrough of queues, knowledge/training and
automations. Every number is computed from the seed. The rotation runs once, settles on
"Everything", and is skipped under `prefers-reduced-motion`.

### Bugs found and fixed

- **13 of 14 service approvals never fired.** Three causes: forked intake copies meant policies
  keying on canonical subform ids never matched; spend policies compared a MONTHLY figure against an
  annual threshold; `pol-access-grant` required a form field most access intakes do not have. Fixed
  with `annualCost()` in `lib/servicerequest.js`, `grantsAccess` moved onto the ITEM, a restructured
  policy — and a smoke guard so it cannot regress. Now 15/15.
- **A hole in the interpolated-class guard.** I wrote `'group-hover:' + c.fg` and smoke passed.
  Scanning found a second instance in `ds/nav.jsx` that had never rendered. Guard widened to catch
  concatenated variant prefixes as well as template interpolation.
- **34 asset `catalogItemIds` pointed at PRODUCT ids** — resolvable, so no dangling error, but the
  links were invisible. Fixed, plus a guard that the id must resolve to an ITEM.
- **`max-w-[18ch]` on the landing h1** with font-size set on its children: `ch` resolved against the
  inherited 16px, clamping the headline to ~144px. Removed the constraint.
- **`container-type: inline-size` CONTAINS the inline axis**, so a lens bar could not size itself to
  its own contents. Added an `inline` mode that does.
- **A GitHub Pages 503** failed the deploy of the landing-hero commit (and the rerun API). Not code;
  the next push carried it forward and is live.

### Verification

smoke **414 passed** · `bun run build` clean · `bun test/render-check.js` **15/15 routes** ·
Actions green · **https://pbueschel.github.io/relayhq/** returns 200.

### Next

Work through the omissions the catalog rework left behind, in this order:
1. `src/store/seed/forms.js` needs a general "this application is broken" subform — roughly 90 of
   the new catalog items currently carry neither a knowledge atom nor an intake form, so they drill
   to a dead end.
2. `PRODUCT_ICON` in `src/views/Portal.jsx` has no entry for `cat-p-applications`, so that product
   renders the generic Folder glyph.
3. Then the founding session's queue: `LessonRecord` with `source: 'course' | 'deflection' |
   'agent_context'`, the catalog-derived coverage matrix, and moving `prerequisiteIds` off the atom
   onto the lesson placement.

### Held

**The landing page is built and live at the URL, but not cleared for sharing.** Phil's framing was
"before we share this out to anyone" — he has seen it and asked for changes, but has not said go.
Do not send the link onward without his explicit word.

### Addendum — design artifacts shown to Phil this session

Three designs were put in front of Phil as Claude artifacts before any of them was implemented.
Recording the URLs because the decisions above reference "shown as an artifact" and a future
session would otherwise have no way back to what he actually approved.

- **Gradient restoration** — v1's gradient treatment reapplied to the current build:
  https://claude.ai/code/artifact/d971e55c-0db4-43a2-a770-6a0607770bac
- **Header architecture** — the options for the module top-bar, including Option B-2 with
  multi-select dropdowns and an in-page search, which is what shipped:
  https://claude.ai/code/artifact/9d7a8cc8-bafd-4cd7-84e4-d2ed9e932aa5
- **Landing page directions** — three directions; Phil picked option 2, then asked to blend all
  three, then specified the rotating-audience headline himself:
  https://claude.ai/code/artifact/d8a48de0-ec60-4d90-b1c8-972154cf87b2

**The working pattern worth keeping:** every visual change this session went artifact → Phil's
reaction → implementation. None of the three was built as specced; each got a correction that only
surfaced because he had something concrete to react to. Propose visually before writing the view.
