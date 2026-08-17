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
