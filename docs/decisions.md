# Decision log — RelayHQ

Append-only. Newest last.

---

## 2026-08-16 — Keep React and add a build step, rather than porting to vanilla JS

**Context.** PostParade (v1/v2/v3) is vanilla JS with zero build, deployed straight from the repo
root. The RelayHQ prototype is ~7,500 lines of React + Tailwind.

**Decision.** Keep React. Build with Vite + Tailwind v4 on bun, deploy `dist/` to Pages via Actions.

**Why.** Porting to vanilla would discard the existing asset and, more importantly, would put the
established visual language at risk — and preserving that look and feel was an explicit requirement.
A build step also lets Tailwind compile a real design system (generated accent classes, container
queries) instead of shipping the CDN runtime.

**Cost.** Deviates from the PostParade zero-build convention, and requires Actions rather than
branch-deploy. Accepted.

---

## 2026-08-16 — Lift knowledge and subforms out of catalog nodes into top-level collections

**Context.** v1 nested content inside catalog items: `item.actions = { subforms, knowledgeBases }`.
That makes an article the private property of exactly one catalog item.

**Decision.** `knowledge` and `subforms` are top-level collections. Catalog items reference them by
id. Course modules reference the same atoms by id.

**Why.** This is the single change that makes the training layer possible rather than bolted on.
The product thesis is that one authored atom serves deflection, agent enablement and training
simultaneously; a nested article cannot be a lesson in two courses and a help topic under two
catalog items at once. Everything else about the catalog is unchanged.

**Consequence.** Catalog "import/copy" now copies *references*, not content — copying an item into
another product reuses the same atoms. Referential integrity is enforced by `test/smoke.js`.

---

## 2026-08-16 — Generate the accent class map instead of writing colour classes inline

**Context.** Tailwind resolves classes by scanning source text, so a class built at runtime is
invisible to it. v1 contained `` focus:border-${type}-500 `` in the asset editor, which never
compiled — a real latent bug.

**Decision.** `scripts/gen-accents.js` emits `src/ds/accents.js`: 18 hues × 12 roles, every class a
literal string. Components resolve accents through `useTheme().a(hue)`. `test/smoke.js` fails the
build on any interpolated colour class.

**Why.** It makes the entire bug class structurally impossible rather than a thing to remember.
It also gives the design system one file where every colour decision lives.

**Cost.** The generated file is verbose (282 lines). Regenerate rather than hand-patch.

---

## 2026-08-16 — Adopt `localStorage` persistence, which v1 could not have

**Context.** v1 was explicitly barred from browser storage by its render target, so all state was
ephemeral.

**Decision.** RelayHQ ships to GitHub Pages, where storage is available. The store persists to
`relayhq.demo.v1` behind a schema version, with the seed as fallback and a "Reset demo data" action
in the account menu.

**Why.** A prototype people demo is much stronger when edits survive a reload. The seed is never
mutated in place, so reset is always available.

**Guard.** Persistence degrades silently to in-memory if the quota is exceeded or storage is
disabled, rather than breaking the app.

---

## 2026-08-16 — Two people models, not one

**Context.** RelayHQ runs internal ITSM and external customer service on one instance. Internal
service management resolves "requester's manager" from a corporate directory; external customer
service has no such directory.

**Decision.** Keep both: `directory` (employees, with `managerId` and `locationId`) and
`contacts` + `organizations` (external customers, with plan, seats and CSM). A ticket carries
`isExternal` and points at one or the other.

**Why.** Collapsing them would force one of the two modes to fake its identity model, and the
manager chain is load-bearing for the approval engine's most common dynamic approver.

---

## 2026-08-16 — The abandoned RelayHQ was moved to Trash, not deleted

**Context.** `~/Documents/GitHub/relayhq` already held a Bun/Elysia/React/SQLite RelayHQ from
February 2026 with the same product lineage. It was not a git repo and had no remote — deleting it
would have been unrecoverable. Phil confirmed that version is abandoned.

**Decision.** Moved to `~/.Trash/relayhq-abandoned-2026-08-16` rather than `rm -rf`.

**Why.** It honours "delete" in the normal macOS sense while leaving a Finder-level undo for
untracked work that has no other copy.

---

## 2026-08-16 — Colour encodes the thesis: `lesson` is blue, the same as `article`

**Context.** Every entity type gets exactly one hue. The learning domain is indigo.

**Decision.** `curriculum`, `course` and `courseModule` are indigo, but `lesson` is **blue** — the
same hue as `article`.

**Why.** A lesson *is* a knowledge atom. Giving it the knowledge hue rather than the learning hue
makes the reuse visible in the interface itself: you can see the same atom keeping its identity as
it moves between the help centre and a course. `test/smoke.js` asserts this equality so it cannot
be "tidied up" later.

---

## 2026-08-16 — The claim is "the article is the lesson's *body*", not "the KB becomes a course"

**Context.** `docs/research/2026-08-16-customer-service-and-training.md` tested the author-once
thesis against DITA, the LMS market and the customer-education market. Verdict: the architecture
buys **distribution** of content across three surfaces for free, and buys **no pedagogy**. Five
named failure modes — voice/isolation, missing motivation, granularity (a lesson is usually several
atoms, never 1:1), assessment cannot be inferred from a procedure, and sequence.

**Decision.** A `Lesson` is a **placement**, not content: `{ knowledgeId, role, framing }` with **no
body field at all**. The atom keeps its reference voice; a thin authored framing block on the
placement — intro, why-it-matters, check-yourself, skip-if-known — supplies the teaching voice.
`prerequisiteIds` therefore belongs on the placement too, not on the atom: a prerequisite is a
property of a position in a sequence, not of an article.

**Why.** This is DITA's map/topic split, and it is what "author once" honestly means. The pitch
"our knowledge base automatically becomes a course" fails on first contact with a buyer who has an
L&D function. "The article is the lesson's body, and the wrapper is thin" survives a skeptic.

**Guard rails.** A lesson cannot publish unless its atom has an objective and an estimated time.
Author-time lint rejects isolation-breaking phrases ("as described above", "in the previous step"),
because that is exactly what breaks when an atom moves surfaces.

---

## 2026-08-16 — Completion is recorded against the atom, not the course placement

**Decision.** `LessonRecord` is keyed by `knowledgeId`, carries
`source: 'course' | 'deflection' | 'agent_context' | 'manual_admin'`, and survives removal from any
course. Course progress is **derived, never stored**, counting each required lesson as exactly one
unit — never weighted by minutes, because an unpredictable progress bar is worse than none.

**Why.** An agent who opened a runbook while working a ticket has demonstrably consumed that
content, so the lesson is already satisfied when onboarding is assigned. No competitor's help centre
and LMS share a record store, so none of them can do this. Render it green **with provenance**
("Completed 12 Mar · read while working TKT-4471") and a "Review anyway" link — never silently skip,
because a learner who cannot see why a lesson is green will not trust the score.

---

## 2026-08-16 — Call it "assisted resolution", never "tickets deflected"

**Context.** Four research passes found **no disinterested third-party statistic** on self-service
deflection. Zendesk's own published formula is a population ratio that observes no counterfactual.
Vendor case studies span 5%–80%, all self-reported and uncontrolled; the 80% (Jamf) links to a case
study whose Results section renders "No items found". The structural "48% of support inquiries are
how-to" figure is quoted by Skilljar with no attribution at all.

**Decision.** RelayHQ never displays a borrowed deflection statistic. It instruments its own —
it owns both the drill path and the form, so it can log the actual sequence of atoms a requester saw
before submitting or abandoning, which a two-system stack cannot. The metric is labelled **assisted
resolution**, with its definition printed under the tile and an explicit note that no system can
observe a request that was never made.

**Why.** Being the only tool in the category that says that out loud is worth more than a borrowed
40%. It also keeps us honest in front of exactly the buyer most likely to check.

---

## 2026-08-16 — Keep `format: 'guide'` rather than renaming to `'slides'`

**Context.** The research recommended renaming `KnowledgeItem.format` `'guide'` → `'slides'` on the
grounds that "guide" collides with container vocabulary in some LMS products.

**Decision.** Keep `'guide'`. Declined.

**Why.** RelayHQ's container nouns are curriculum / course / module / lesson — "guide" names no
container here, so the collision is theoretical for this product. It is also the word Phil used when
specifying the feature ("Instagram-style how-to guides"), and matching the vocabulary the product
owner actually uses beats matching a competitor's schema. Recorded rather than silently ignored.
