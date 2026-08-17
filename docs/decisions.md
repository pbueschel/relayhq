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
