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

## 2026-08-17 — The landing page lives on the empty hash route, not a second site

**Context.** Phil asked for "a sleek super sexy landing page on GitHub Pages before we share this
out to anyone." The obvious builds are a second Pages site, or a `/landing.html` entry point.

**Decision.** The empty hash (`https://pbueschel.github.io/relayhq/`) IS the landing page. The app
starts one click away at `#/workspace`. `src/lib/router.js` returns `section: 'home'` for an empty
hash; `Landing.jsx` renders there.

**Why.** One deploy, one build, one set of gates. A second site would need its own pipeline and
would drift from the product it is selling — and the landing page reads live seed data (`useCounts`)
so every number on it is computed from the same store the app runs on. Nobody can update the pitch
and forget the product.

**Rejected.** A separate marketing repo (drift, second pipeline). A `/landing.html` outside the SPA
(cannot read the store, so every stat becomes a hand-maintained lie).

---

## 2026-08-17 — The portal home shows the requester's own open work, never "most requested"

**Context.** The portal hero carried a "Most requested" / "Ordered most often" strip under the
search — the pattern every help centre ships.

**Decision.** Removed. Replaced with `OpenWork`: approvals awaiting THIS person's decision first,
then their unresolved tickets. The panel hides entirely when nothing is in flight.

**Why.** Phil's read, and it is right: to anyone who has already raised something, a list of what
other people ask for is catalog trivia. The question a returning requester arrives with is "where
is my thing". The browse grid below already covers discovery for first-timers.

**Two senses of "my approvals", one section.** An approval can be waiting on *you*, or holding up
something *you asked for*. Only the first gets a row — the second is folded into the ticket row as
"waiting on an approval". A requester's question is whether their thing is moving, not which record
type it is stuck in.

**Implementation note.** The approval filter calls `canDecide()` from `lib/approvals.js` — the same
predicate the Approvals module uses — so the portal can never disagree with the agent console about
whose turn it is. Seed carries `tkt-4823` + `apr-7` specifically so the demo user has an approval
pending on load; nothing awaited Sarah Johnson before, so the panel could never prove itself.

---

## 2026-08-17 — Catalog items are faults, not topics

**Context.** The Get Help tree read like a table of contents: "Multi-factor authentication",
"Email", "VPN". A requester scanning it has to translate their problem into our taxonomy.

**Decision.** Every leaf item is phrased as the thing that went wrong — "Multi-factor code not
arriving", not "Multi-factor authentication". 7 products / 33 subcategories / 193 items, averaging
5.8 items per subcategory. Every subcategory ends with a "Not listed" item, and every product ends
with a "Not listed" subcategory.

**Why.** The category → subcategory → item model only beats a search box if the leaves match the
words in the requester's head. A topic list makes them do the mapping; a fault list does it for
them. "Not listed" everywhere means the drill never dead-ends — the escape hatch is part of the
structure, not a fallback.

**Also added.** A new `Application & Software` product (`cat-p-applications`) where subcategory =
the app and item = the fault, because "Slack won't load" belongs under Slack, not under a generic
software category.

---

## 2026-08-17 — The header is two bands plus a tray, and the rotation runs once

**Context.** Two separate rounds of feedback on chrome. (a) Module top-bars used four bands at
mixed sizes and read as disorganised. (b) The landing headline's rotating audience word looped
forever.

**Decision.** (a) `ds/header.jsx` — `ModuleHeader` renders identity + tools in two bands with an
optional filter tray; filters became multi-select controls that display their VALUES with per-option
counts (`Queue · Customer Support +1`), and the old filter box became a scoped in-page search that
names its own scope. Applied across every module. (b) `RotatingWord` cycles once at 1000ms and
settles on "Everything", skips entirely under `prefers-reduced-motion`, and hides the cycling span
from screen readers behind a static `aria-label`.

**Why.** (a) A header that changes shape per module makes the app feel assembled rather than
designed; one component makes conformance checkable. (b) An infinite loop in the hero is a
distraction that never resolves — a single pass reads as a statement ("Customer, HR, IT, Finance —
Everything") rather than an animation.

**Rejected.** Leaving the filter control on its own line (Phil: "doesn't feel right"). A
timer-driven carousel in the portal guide viewer — reverted to user-driven paging on Phil's
instruction, because an auto-advancing how-to takes control away from someone following steps.

---

## 2026-08-17 — The module header's shape is fixed, and that is now a rule

**Context.** The header was one `flex-wrap` row carrying identity, the primary action and every
control. It measured 56px at a 1728px window, 103px at 1400px and 141px at 1024px on Workspace — and
144px / 106px / 61px on Assets, which only reached its compact state above 1728px, meaning it was
permanently wrapped on every laptop.

**Decision.** Two bands of FIXED height (`h-[52px]` + `h-[44px]`), neither of which may wrap. Row 2
shrinks by scrolling. `min-h-` is banned in the header — a floor is what let the row grow.

**Why.** The width-driven reflow was only half the fault. The other half is invisible from a
screenshot: the wrap threshold MOVES WHILE YOU TYPE. `subsetLabel()` swaps a long resting subtitle for
"20 of 118 shown" whenever a filter is active, and because `truncate` implies `white-space: nowrap`,
flexbox breaks lines against the FULL untruncated string. So at one fixed window width the header
could unwrap when you started filtering and wrap again when you cleared it. A header that changes
shape while you use it reads as broken, and no amount of responsive tuning fixes that class of bug —
only a fixed shape does.

**Rejected.** Keeping one band and letting it scroll (loses the search and filters off the right edge
at common widths). Container queries (they tighten continuously, which is the right idiom for a lens
bar but still yields a height that depends on width). Shortening the subtitle (treats the symptom;
the next long subtitle brings it back).

---

## 2026-08-17 — The view control is centred with a grid, never a flex spacer

**Context.** Phil asked for the New button on the left and the view lens "in the middle". The obvious
implementation is `<identity/> <spacer/> <lens/> <spacer/> <primary/>`.

**Decision.** Row 1 is `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]` with the lens in the centre track.

**Why.** A flex spacer centres the lens against its NEIGHBOURS, not against the pane — so the lens
would drift sideways every time the subtitle changed length, which is the same `subsetLabel` swing
that caused the original bounce, just expressed horizontally instead of vertically. Equal side tracks
hold the centre still regardless of what flanks it. The cost is that the module title truncates earlier
at narrow widths; that is the right thing to give up, because the title is also the highlighted sidebar
item and the breadcrumb, while the lens is the module's primary navigation.

---

## 2026-08-17 — The filter bar is permanent, and the filter toggle is gone

**Context.** Phil: "the search bar should go with the other filter options on the same line." The
existing filter tray only rendered when something was active (`tray={showTray ? … : null}` plus
`if (!open) return null` inside `FilterTray`).

**Decision.** The filter bar is always rendered. `FilterToggle` and `FilterTray` are deleted, and
`useHeaderFilters` no longer carries a tray flag.

**Why.** Putting a text field inside the old tray would have been a hard regression: the filter
button's own handler called `clearFilters()`, which did `setTrayOpen(false)` AND `setSearch('')`, so
one click would have unmounted the search field and thrown away what was being typed into it. A
control you type in cannot live in a container another control can dismiss. Once the band is
permanent there is nothing left for a toggle to open.

**What this gives up.** "A band that only exists when it is doing something" was the best idea in the
previous header, and it is now gone. The resting header is 97px rather than 56px. That is the price of
search and filters sharing a line, and it was paid deliberately.

**Also.** `Clear all` sits OUTSIDE the scrolling region. The first cut scrolled the whole row, which at
1100px pushed `Clear all` off the end — leaving a filtered list with no visible way to unfilter it,
which is the same class of fault as a filter whose control is hidden.

---

## 2026-08-17 — Filter menus are positioned `fixed`, not `absolute`

**Context.** Row 2 scrolls horizontally so the header's height can stay fixed. An
`overflow-x: auto` box clips its children in BOTH axes, so the `absolute` dropdown on every
`MultiSelectFilter` would have been sliced off at the band's bottom edge.

**Decision.** The panel is `position: fixed`, placed from the button's `getBoundingClientRect()` and
re-placed on `resize` and on capture-phase `scroll`.

**Why.** A fixed element escapes ancestor overflow clipping, and no ancestor in the app shell
establishes a containing block for it (no `transform`, `filter`, `backdrop-filter` or `contain` on the
path from `#root` to the header — checked before committing to this). It also stays a DOM descendant
of the wrapper, so the existing `useDismiss` outside-click ref still covers it.

**Rejected.** Rendering the menu through a portal (works, but breaks `useDismiss`'s `contains()` check
and needs a second ref). Letting row 2 wrap instead of scroll (reintroduces the variable height this
whole change exists to remove).

---

## 2026-08-17 — Standing rule 8 reversed: cap the width, align it LEFT

**Context.** Rule 8 read "Centre the content, cap the width", and the styleguide's Layout section
argued for it explicitly: "wide viewports should produce balanced margins, not a left-hugging layout
with a dead right half." Phil asked for everything left-aligned, tickets included.

**Decision.** `PageBody` aligns left by default; `align="centre"` is kept for reading surfaces. The
rule and the Layout demo on `#/design` were rewritten in the same commit.

**Why.** The header spans the pane at `px-4` while the body centred itself under a cap, so the list sat
on a different left edge from the module title — 152px apart at a 1600px window, 216px at 1728px. On
Assets it was worse: three tabs used `max-w-6xl` and two used `max-w-5xl`, so the list edge JUMPED 64px
sideways when you changed tab within one module. A list that does not share an edge with its own header
reads as two screens stacked. The old rule was defending against a dead right half; the new one defends
against the body disagreeing with the chrome, and the chrome is the thing that has to be agreed with.

**Note for whoever reads this next.** This reverses a documented rule that was rendered live in the
app. It was Phil's call, made with the conflict put in front of him rather than around him.

---

## 2026-08-17 — Workspace grouping is its own state, defaulting to due date

**Context.** Phil asked for the default view to be "items by due date, not by section". Grouping was
derived from the lens alone: `lens === 'all'` sectioned by record type, every other lens by due bucket.
So four of five lenses already did what he wanted, and "Everything" — the default — was the exception.

**Decision.** A `groupBy` state defaulting to `'due'`, with a `GroupByToggle` on the filter bar.

**Why.** Simply deleting the `if (lens === 'all')` branch is a four-line change and was tempting, but
`lens` was the sole grouping input — there is no other code path that renders the "TICKETS 5 /
APPROVALS 2" view, so deleting it removes from the product the only view that answers "how many
approvals are on me right now". Since a stable second band was being built anyway, the control cost
almost nothing. Precedent already existed at `Projects.jsx:1418`.

---

## 2026-08-17 — A gate that cannot fail is not a gate: `test/width-check.js`

**Context.** The header reflow shipped through a fully green suite. smoke.js asserted nothing about
layout, and `render-check.js` never passes `--window-size`, so it runs at Chrome's 800×600 default —
permanently BELOW the reflow threshold. The wrapped state was the only state it had ever seen.

**Decision.** A fifth gate that loads four routes at 1024 / 1280 / 1440 / 1728px and fails if the
header's height or control-row count differs between them. Wired into CI after `render-check`, never
alongside it. `bun test/engines.js` was also added to CLAUDE.md's gate list, having run in CI unlisted.

**Why.** The bug class is "the app looks wrong at a size nobody tested", and it is invisible to every
existing gate by construction. The gate was proved by reinstating the old header and confirming it
exits 1 with the real symptom, then restoring.

**Three things the probe must do**, each of which cost a debugging round and is commented in the file:
no `setTimeout` polling (under `--virtual-time-budget` a timer chain burns the budget before React
mounts, and once the budget is spent a pending timer never fires at all); the MutationObserver must
disconnect around its own write (appending the result node is itself a mutation, and re-entering
forever starves the event loop so the page never settles); and the result marker must be assembled at
runtime, because `--dump-dom` echoes the probe's own source back out and a literal marker matches the
source first. `ModuleHeader` carries `data-module-header` because finding the band by walking up from
the `<h2>` stops at row 1 and silently measures half the header.

---

## 2026-08-17 — E9's premise was wrong in two ways (investigated, not built)

**Context.** E9 was queued as "add a general subform; ~90 catalog items dead-end", plus "add a
PRODUCT_ICON entry for `cat-p-applications`". Both were investigated before Phil redirected to the
header work. Recording the findings so the next session does not re-derive them.

**Finding 1 — the count is 29, not ~90.** Of 192 catalog items, 120 carry both an atom and an intake,
35 an intake only, 8 an atom only, and 29 neither. 28 of the 29 are in Application & Software, 1 in
Workplace & Facilities, all `audience: internal`. Eight are "Not listed" escape hatches. No existing
subform fits any of them — the nearest candidates either book a physical repair (`sf-laptop-repair`)
or raise a purchase order behind a spend approval (`sf-software-request`) for what is a software fault.

**Finding 2 — the icon fix is moot, because the product never renders.** No FORM lists
`cat-p-applications` in `productIds`, and `Portal.jsx:618` filters the help tree to `form.productIds`
whenever that array is non-empty. All three published forms have non-empty arrays, so the fallback
branch is dead code and the entire 44-item product is unreachable to a portal visitor. It is reachable
by an admin via the Forms editor, which is why nothing looked broken.

**Root cause of both.** `cat-p-applications` is the only root product declared as a bare string literal
(`catalog.js:941`), because `ids.js` has no `P_APPLICATIONS` constant — so `forms.js` had nothing to
reference and the product was never wired up. That is hard rule 6 earning its keep.

**Consequence for the plan.** A new W9.0 is inserted ahead of W9.1 and W9.2, and a smoke guard should
assert that every root product is reachable from at least one published form — nothing checks that today.

---

## 2026-08-17 — On-screen copy explains state or the next action, and nothing else

**Context.** Phil: "remove the explainer fluff from the entire site. it's causing us to not accurately
display our boxes at their chosen sizes." The app carried ~200 banners and ~300 hint strings, a large
share of which taught the reader how the product works rather than helping them work.

**Decision.** One test, applied to every string in every view: does it report a REAL CURRENT STATE of the
data, or tell the user what to do next? If yes it stays, trimmed to the fact. If it teaches the model,
justifies a design decision, or mentions the demo, it goes. 629 removals across 14 views.

**Why.** The prose was not free. A banner explaining why assigned seats are derived pushed the licence
table below the fold; a paragraph on why tickets have no subtasks made a modal scroll. Phil's framing is
the right one — the copy was overriding the sizes the layouts were designed at.

**Kept deliberately.** `DesignSystem.jsx`, because a styleguide's explanations ARE its content, and
`Landing.jsx`, because the pitch is the product there — and it is HELD.

**Casualty worth naming.** The portal's `WhyPanel` / `computeFacts` argument panel (~900 lines, W5.13)
went with it. It is the purest instance of the category being removed — a panel that exists to argue for
the catalog model — so it could not survive the test. Recorded because it was a named deliverable, and
it is one revert away if Phil wants it back.

---

## 2026-08-17 — The portal home shows the requester's own work, and nothing else

**Context.** The space under the two front doors held "Every area we support" — a grid of the five help
products — with a four-row teaser of the requester's open work above it in the hero.

**Decision.** The grid is gone. The whole space is now `MyWork`: every approval waiting on this person,
every open request, every closed one, uncapped. The hero's teaser was removed from BOTH doors.

**Why.** Three separate reasons pointed the same way. The grid was a THIRD route into a drill that both
doors already open, so it bought no reach. It pushed the one thing a returning requester came for — where
is my thing — off the first screen. And a four-row teaser sitting directly above a complete list is the
same rows rendered twice, which is the redundancy Phil had just objected to in the card header.

**Rejected.** Keeping the teaser and putting the full list below it (the duplication above). Capping the
list (the caps were `.slice(0, 3)` and `.slice(0, 4)`, which is what made it a teaser rather than an
answer).

**Open.** The Service Catalog tab now has no view of the requester's work at all, for symmetry with Get
Help. If that reads as a loss, the fix is to give that door its own MyWork rather than to restore the
teaser.

---

## 2026-08-17 — Brace-match a function body from after its parameter list

**Context.** A script removing two components matched the first `{` following the function name. For
`function OpenWork({ tickets, approvals })` that brace opens the DESTRUCTURED PARAMETER LIST, so the
matcher closed on the parameters, cut the signature, and left the body orphaned behind a bare `) {`.
Both files then failed to build with a bare "Unexpected token".

**Decision.** Never brace-match a JS function body from the first `{` after the name. Find the end of the
parameter list first. And after ANY scripted edit to a view, run a Bun.Transpiler parse sweep over
`src/views`, `src/ds` and `src/components` — it names the failing FILE, which `bun run build` does not.

**Why.** The build error gave no file and no line. The parse sweep found it in seconds and is four lines
of script. Worth keeping as a habit whenever an edit is applied by script rather than by hand.

---

## 2026-08-17 — The neutral ramp is `stone`, not `gray`, and the header is one flat surface

**Context.** Phil pointed at a ServiceHub screenshot: "I want this to be the background color for the
agent workspace." Sampling both images settled it — the page background was ALREADY identical, `#f9fafb`
in each. Then: "why does the github page feel colder? we need to warm the color pallet slightly."

**Decision.** Two changes, from two measurements.

1. The `FilterBar` no longer paints `t.bgSubtle` (gray-100) or draws its own rule. A vertical pixel scan
   down the right margin showed RelayHQ banding its chrome — header `#f9fafb`, filter bar `#f3f4f6`,
   content `#f9fafb` — where the reference was one uninterrupted surface from the top bar to the first
   card. The header is now one flat surface.
2. The neutral ramp moved from Tailwind `gray` to `stone` across `tokens.js` (41 class refs) plus the two
   strays in `forms.jsx` and `primitives.jsx`.

**Why.** "Colder" was not the background — it was every border, muted label and body string on the page.
Tailwind's `gray` is blue-biased: sampled muted text measured R−B = −23. On `stone` the same pixel reads
+14, a 37-point swing toward warm, while the page itself barely moves (`#f9fafb` → `#fafaf9`). That is
what "warm it slightly" should mean: leave the surfaces alone, take the blue out of the ink.

**Rejected.** `neutral`, which removes the blue without adding any warmth — it would have read as a bug
fix rather than a change. Tinting the page background instead, which moves the one value that was already
correct and leaves the cold ink in place.

**Note.** The `slate` and `gray` ACCENT hues in the generated `accents.js` are untouched, so muted chips
keep a cool cast. If that reads wrong next to warm chrome, the fix is `scripts/gen-accents.js` and a
regenerate, not a hand-edit — `accents.js` is generated.
