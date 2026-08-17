# Service management market research — what RelayHQ is missing

This document is the fact-checked synthesis that drives the RelayHQ build. On **2026-08-16** we researched six dimensions of the service-management and work-management market — business rules and approval engines; ITIL change management and the change/problem/incident triad; ClickUp-style project and work management; IT asset management, CMDB and software licensing; n8n-style workflow automation; and self-service portals, deflection and visual how-to content. Each dimension was researched by one agent and then **independently fact-checked by a second agent** who re-fetched every cited source, extracted primary PDFs locally, read vendor source code on GitHub where it existed, and struck out or corrected every claim that did not survive. What follows merges the six corrected reports into one build brief. Where the fact-check contradicted the original research, the corrected version is what appears here and the false version is recorded so nobody re-derives it. Every later build decision should cite a section of this document.

---

## How to read this

**Three confidence levels, and they are load-bearing.**

- **Verified** — the claim was re-fetched from a primary or near-primary source in the fact-check pass and survives. Verbatim quotations in these sections are genuinely verbatim. You can build from these and cite them.
- **Not verified** — listed explicitly at the end of every dimension section. These are claims the original research made that no reachable source supports, or that a reachable source contradicts. **Nothing in a "Not verified" list may be promoted to fact, quoted to a client, or used as the premise for a design decision.** Several of them are the exact kind of plausible-sounding product specific that gets invented, so they are named individually rather than dropped silently.
- **Vendor marketing** — labelled inline as such. Guidde's retention percentages, Pendo's case-study reductions, and every deflection benchmark in circulation are positioning language, not evidence. They may appear in competitive analysis; they may not appear in a client deliverable or on a screen.

**Two structural caveats that apply to the whole document.**

1. **Documentation of what a product does is a different class of evidence from proof that it works.** Almost everything verified here is the former. ServiceNow documents a risk-calculation engine; nothing here shows risk scores predict failures. ClickUp documents that Workload paints capacity red/yellow/green; nothing shows teams resource better because of it. Atlassian documents an AI risk assessment; its hit rate is undocumented. Copy the mechanics for fidelity and justify them on demo value, never on outcomes.

2. **Source quality varies sharply by vendor, and ServiceNow is the weak one.** `docs.servicenow.com` returns JS navigation scaffolding to programmatic fetches across essentially every bundle URL attempted. As a result, the ServiceNow approval-rule grammar, the `sysapproval_approver` schema, Change Approval Policy internals, business-rule semantics, the CAB Workbench field list, the conflict codes and the state/substate table all rest on ServiceNow **Community** blogs, consultancy blogs, or third-party reference sites. They are internally consistent and appear accurate, but they are unversioned and may drift between releases. Verify against a live instance before writing code that depends on exact field names or navigation paths. Atlassian's Cloud support pages have the same problem; where a claim was verified, it usually came from Atlassian's Confluence mirror instead. By contrast, **n8n, Snipe-IT, ClickUp, Freshservice and Zendesk are well sourced** — n8n from `n8n-io/n8n@master` source files, Snipe-IT from readme.io docs plus generated devdocs, ClickUp from the Zendesk content API behind its help centre, Freshservice and Zendesk from their own support articles.

**One caveat about RelayHQ itself.** Five of the six dimension reports could not read RelayHQ's source; their "RelayHQ already has X" statements come from the assignment brief's prose, not from inspected code. The sixth report did read code — at `/Users/philbueschel/.Trash/relayhq-abandoned-2026-08-16`, which is where the prototype now sits; there is no RelayHQ repository under `~/Documents/GitHub/`. Treat every as-built claim in the gap table as a design target to reconcile against real code, not as a verified diff. Where a recommendation's *effort* estimate or *reuse* claim depends on existing components (the subform builder, the 3-level tree widget, the shared task modal), confirm those components exist before sequencing.

---

## 1. Competitive landscape at a glance

| Product | Category | What it is genuinely best at | What RelayHQ can learn |
|---|---|---|---|
| **ServiceNow** | Enterprise ITSM/ESM platform | Approvals expressed as a **decision table** (Policy Inputs → Decisions → Approval Definitions) rather than hard-coded workflow steps; the asset (`alm_asset`) vs configuration item (`cmdb_ci`) split; typed, directional CI relationships; ordered first-match-wins risk conditions; ten typed schedule-conflict codes | Copy the Change Approval Policy shape literally — it is the highest-leverage architecture in the whole research set. Copy the per-approver row model (`sysapproval_approver`) and its state vocabulary. Copy the conflict codes. Copy the four ownership roles as a *convention*, not as a standard |
| **Jira Service Management** | ITSM on the Jira platform | Approval bound to a workflow **status** rather than a step; freeze windows that hard-block deployment; AI risk assessment; help-center **Topics** that mix articles, request forms and external links under one node | Copy JSM's two-outgoing-transition trap as a constraint to design *out*. Beat JSM where it is weak: its freeze blocking is all-or-none with no urgent-change exception, and its risk score is opaque. Topics validate RelayHQ's item-node-holds-both model |
| **Jira Automation (Cloud)** | Rule engine | Named condition types (Issue fields, smart values, JQL, AQL, Related issues, User); a five-word audit-log status vocabulary; an explicit **two levels of nesting** cap; a fixed loop-detection limit of 10 | Cap the condition builder at two levels on Atlassian's own authority. Use Successful / No actions / Some errors / Loop / Throttled as the execution-log vocabulary. Make chain depth a constant, not a setting |
| **Freshservice** | Mid-market ITSM | The **most implementable published risk math** in the market (rule scores 1–10, optional weights summing to exactly 100, global bands Low 0-25 / Medium 26-50 / High 51-75 / Very High 76-100); two-tier group-then-chain approval quorum; hierarchical supervisor→manager→department-head chains; CAB Huddle; per-change-type lifecycles | Build the risk engine to Freshservice's arithmetic — it is the only vendor that publishes one you can implement. Steal the **First Responder** quorum. Steal "irrespective of the CAB's vote, the Change Manager will have the final authority". Its per-device-only license compliance is a documented gap RelayHQ can beat |
| **Zendesk** | Customer support + help center | The cleanest **event-vs-clock** rule split (triggers on create/update; automations hourly); a published per-field **operator matrix**; article-recommendation KPIs; the post-submit deflection popup with two named exits | Seed the condition builder's operator registry from Zendesk's matrix. Adopt suggestion rate / click-through rate / resolution rate as tile names — but publish your own denominators, because Zendesk does not |
| **ClickUp** | Work management | Views as **first-class saved objects** with their own group/sort/filter/column state and a dirty-state prompt; tasks created in a grouped+filtered view **inheriting both** the group and the filter values; four status groups with authored statuses inherited down the hierarchy; a fixed task-modal section order | Build the Views Bar, the inheritance rule and the status-group model to the letter. These four mechanics — not feature count — are what make a UI read as ClickUp |
| **Linear** | Issue tracking | The inverted model: **status categories are fixed and ordered; statuses inside them are authored and reorderable**. One Display-options popover holds the entire view-config surface | Constrain the category axis and free the status axis. A single popover is a legitimate alternative to a views bar for a smaller surface |
| **monday.com** | Work OS | The **column type** as the unit of extensibility; automations rendered as **recipe sentences** ("When a status changes to done, notify #channel in Slack") | Plain-English sentence summaries generated from the condition AST. Cheap, pure, and the single most prospect-legible feature in the set |
| **Asana** | Work management | The cleanest task object model: `resource_subtype` {approval, custom, default_task, milestone}, a four-value `approval_status` kept in sync with `completed`, read-only `dependencies`/`dependents` arrays, and genuine multi-homing via `memberships` | Model approval as a **task subtype**, not a bolt-on. Let a task belong to several projects with a per-project section |
| **Snipe-IT** | Open-source ITAM | User-defined **Status Labels typed** deployable/pending/undeployable/archived, where the type drives behaviour; polymorphic checkout to `user \| location \| asset`; license **seats materialized as individual rows**; a published depreciation formula; Fieldsets attached at the model level | The single best blueprint for RelayHQ's asset module. Copy the typed status system, the polymorphic checkout, the seat materialization, and the "check-in accepts any status" rule |
| **Atlassian Assets (in JSM)** | CMDB / asset schema | An explicit two-root-object-type split — `Hardware assets` carrying serial/owner plus a **reference** to `Model`, which carries specs — with a precise attribute-type vocabulary and inheritance rules | Copy the attribute-type vocabulary and the guardrail "attribute inheritance must be enabled before creating child object types and cannot be enabled on an object type that already has children" |
| **Lansweeper** | Discovery + lifecycle intelligence | Vendor-timeline lifecycle data — End of Sale, End of Support, a Milestone date — keyed on **Model and Manufacturer**, surfaced per-asset and as org-wide rollups | An independent argument for the Model/Asset split: some facts belong to the model, not the unit. Nothing here is an internal custody state machine |
| **n8n** | Workflow automation (source-available) | A canvas whose geometry, node chrome, execution model and human-in-the-loop mechanics are all **readable in source** and therefore reproducible exactly; `sendAndWait` parks an execution in status `waiting` and resumes it from a webhook | Copy the real numbers (16px grid, 96×96 nodes, 224px step, curvature 0.25, the two-segment backwards-edge route) and the `runData` shape. Make "Request Approval" the hero node |
| **Zapier** | Automation (SaaS) | Hard, published branching limits: 10 branches per path group, 3 nested path steps, 100 steps per Zap, paths must be terminal | Ship explicit, visible limits rather than unbounded nesting. Limits read as engineering maturity |
| **Make** | Automation (SaaS) | The operation/bundle vocabulary and the Iterator ↔ Aggregator pair as the way to teach an item model | An explicit array→items node is the cheapest way to make the data model legible |
| **Power Automate** | Approvals | Five approval types including **Sequential** ("Approvals are requested one at a time, in a specific order"); an **action center** as a response surface alongside Outlook and Teams | The approval-type vocabulary, and a first-class "My Approvals" surface rather than approvals buried in tickets |
| **Intercom** | Help center | "You can create up to three levels of collections"; 500 articles per collection; icons on first-level collections only | External validation that a three-level browse tree is the right cap — from a second vendor, independently of Freshservice |
| **Salesforce Service Cloud** | CRM support | The Case Deflection component "searches text as it's being entered into the Contact Support Form component" and renders results in a panel **beside the live form** | The concurrent-panel variant of suggestion-as-you-type. Plus the guest-user lesson: for anonymous users it matches article **titles only**, so title quality carries the mechanic |
| **ManageEngine** | ITSM | Plain statements about ECAB composition ("only consists of people who have the knowledge and skills to implement the change") and change-manager authority | Corroborates Freshservice on the cross-vendor convergence: **CAB advises, change manager decides** |
| **AXELOS / ITIL 4** | Practice guidance | Definitions of standard change, emergency change, change authority and change model; an explicit position that CABs "often become bottlenecks"; four named metrics | Change models as data. Change authority as a per-model pointer where CAB is one configuration. The four metrics as dashboard tiles |
| **Guidde, Pendo** | Visual how-to / in-app guidance | Positioning language for visual guides and in-app help | **Nothing evidentiary.** Guidde's 34%/28% cite an unlinked study; Pendo's Elsevier 42.8% and WebPT 50% are unaudited self-published case studies. Use as competitive framing only |

---

## 2. Gap analysis — RelayHQ as-built vs the market

This is the most important table in the document. "RelayHQ today" reflects the assignment brief's as-built description (see the caveat in **How to read this** — five of six reports could not inspect the code). "Market standard" is what was verified across at least one, usually several, vendors.

| Area | RelayHQ today | Market standard | Gap | Priority |
|---|---|---|---|---|
| **Condition authoring** | No condition model anywhere. Workflows carry a `trigger` string; subforms carry `routing.queueId` | A typed condition tree, capped shallow. Jira: "We support two levels of nesting with the if/else block." Zendesk: two flat ALL/ANY blocks. Per-field-type operator registries | No shared condition AST, no builder component, no operator registry, no evaluator | **must** |
| **Rule execution** | Workflows model but do not run. No runtime at all | Event rules fire on create/update; clock rules sweep on a schedule (Zendesk: hourly, ≤500 active automations, <65 KB each, each needing a self-cancelling condition) | No execution engine, no event/clock distinction, no safety rail for scheduled rules | **must** |
| **Rule ordering** | Three unordered sub-tabs (Queues / Routing / Workflows) | One ordered list. ServiceNow: integer `order`, default 100, lower runs first, ties explicitly undefined. Zendesk: user-editable order with an Edit-order control, categories reorder as a block; documented sequence is value changes → assignments → notifications | No ordering, no first-match-wins semantics, no way to reason about interacting rules | **must** |
| **Approvals — design time** | None. `workflows[].steps[]` has a step of `type: 'approval'` with a label and an assignee string | An **ApprovalPolicy** as a decision table: Policy Inputs → ordered Decisions (conditions keyed on state/risk) → Approval Definitions with action (auto-approve as user / auto-reject / request user / request group), approver source (dynamic field vs static), wait-for (first vs all, group-only) and mandatory | No policy object, no decision rows, no auto-approve/auto-reject actions, no dynamic approver source | **must** |
| **Approvals — run time** | Nothing runs | A per-approver row model. ServiceNow `sysapproval_approver` extends `task`, states `requested` (active) / `approved` / `rejected` / `cancelled` / `not required`, columns approver, document_id, source_table, group, approving_type, delegate, due_date, escalation_rule, comments | No ApprovalRequest object, no per-approver rows, no state machine | **must** |
| **Approval quorum** | None | Quorum belongs on a **stage**, not a policy. ServiceNow rule codes `Any` / `All` / `Res` (all responded and anyone approves) / `%` / `#`, crossed with Users vs Groups, and a separate `Rejects` ruleset. Freshservice adds **First Responder** and a two-tier group→chain rollup. Power Automate adds **Sequential** | No quorum concept. Cannot express serial, parallel, per-group, percentage or threshold approval | **must** |
| **Dynamic approvers** | Assignee is a bare string | Freshservice resolves "Dynamic roles such as the requester's reporting manager" as a Stakeholder category; hierarchical chains run supervisor → manager → department head, each gated on the prior | No People/Org directory, so no manager resolution, no group membership, no dynamic approver of any kind | **must** |
| **Delegation** | None | ServiceNow `sys_user_delegate`: delegating user, delegate, Starts, Ends, and four scope checkboxes (Approvals, Assignments, All Notifications, Meeting Invitations); "A delegate does not have delegation access outside of these dates." JSM has **no delegation** — JSDCLOUD-7867 is open, 249 votes, status Future Consideration | No delegation. This is also a cheap competitive win, because the market leader in the mid-tier does not have it | should |
| **Routing** | Derived from each subform's `routing.queueId` — not separately authored | An authored, ordered, first-match-wins rule set | Cannot express "route by priority", "route by requester department", or any condition. No way to answer "why did this land in General?" | should |
| **Execution observability** | None | Jira's five audit statuses (Successful / No actions / Some errors / Loop / Throttled) and a fixed loop cap of 10. ServiceNow's graded flow reporting is **Off by default in production** for performance | No execution log at all — but also an opening: incumbents make traceability expensive, so a condition **trace** rendered as an explainer is genuinely differentiated | **must** |
| **Change management** | Changes are a seeded flat list: id, title, description, status, priority, assignedTo, scheduledFor | A typed lifecycle per change model. ServiceNow: New → Assess → Authorize → Scheduled → Implement → Review → Closed, Canceled reachable anywhere, **all three types share one state set** — Emergency skips Assess, Standard enters at Scheduled. Freshservice ships **four** types each with its own lifecycle | No lifecycle, no state machine, no per-type models, no transition guards | **must** |
| **Change gating** | None | ServiceNow gates New → Assess on **18** mandatory fields including Implementation plan, Backout plan, Test plan, Risk and impact analysis. Freshservice lifecycle transitions carry conditions on task completion, approval status and mandatory-field population | No required-field gates, no transition guards, no reason a change cannot skip straight to done | **must** |
| **Change risk** | `priority` only | Deterministic scoring. Freshservice: rules score 1–10, optional weights summing to exactly 100, unmatched parameter scores 0, reconciliation by Highest severity or Weighted average, bands 0-25/26-50/51-75/76-100. ServiceNow: ordered Risk Conditions, "the first lowest Risk condition which matches... gets applied and other higher ones get skipped" | No risk model. Opportunity: JSM's AI risk score is opaque and Premium-gated; a **transparent breakdown table** beats it | **must** |
| **Change schedule** | `scheduledFor` string | Blackout and maintenance windows as conditioned schedules (ServiceNow: `cmn_schedule_condition` extends `cmn_schedule`, windows are `cmn_schedule_span` rows, child schedules Include or Exclude). Freshservice adds a Freeze Window flag. JSM hard-blocks | No windows, no calendar, no enforcement | **must** |
| **Conflict detection** | None | ServiceNow's ten typed codes: `blackout`, `child_blackout`, `parent_blackout`, `ci_already_scheduled`, `parent_ci_already_scheduled`, `child_ci_already_scheduled`, `not_in_maintenance_window`, `child_not_in_maintenance_window`, `parent_not_in_maintenance_window`, `assigned_to_already_scheduled`. Polarity: **inside blackout is a conflict; outside maintenance is a conflict** | No conflict detection. Six of the ten codes need a CI hierarchy; ship the four that need only dates, CI and assignee first | **must** |
| **CAB** | None | Definition (manager, board members, delegate, rolling meeting window, recurrence, agenda auto-add conditions) + a runnable meeting (start → per-item decision → elapsed time → end → generated minutes). Quorum Anyone/Everyone/Majority. Both ServiceNow and Freshservice converge on this | No CAB. And ITIL 4's actual position — change authority is a per-model pointer, CAB is one configuration of it — is the differentiated story nobody ships | should |
| **Standard changes** | None | A two-record proposal/template lifecycle. ITIL 4's justification is verbatim: "This risk assessment does not need to be repeated for every change; it is needed only if the procedure itself undergoes another modification." ServiceNow locks pre-populated template data: "This pre-populated data will not be editable by the user" | No templates, no pre-approval, no link from a catalog item to a change template | should |
| **PIR / close codes** | `status` only | Review state + two mandatory fields: Close code (Successful / Successful with issues / Unsuccessful) and Close notes; non-Successful warrants deeper review; a closed change can be **returned to Review** | No close code, no PIR, so no change-success-rate metric | **must** |
| **Problem management** | Seeded flat list, same shape as Changes | States New / Assess / Root Cause Analysis / Fix in Progress / Resolved / Closed. **Known error is an attribute set once root cause is documented, not a state.** Workaround is separate | No lifecycle, no root cause field, no known-error flag, no workaround, no KB linkage | should |
| **Release management** | None | Freshservice: "a collection of authorized Changes to an IT service, which are tested and introduced into the live environment together," with Build plan and Test plan, Link New / Existing Change, Detach | No release container | nice |
| **Record relationships** | A typed `linkedItems[]` array; link-to-Problem and link-to-Change from a ticket | Directional and typed. ServiceNow has **`incident.caused_by`** (references change_request — the change that broke it) and **`incident.rfc`** (the change that fixes it) as two separate fields on the same table. Same record types, opposite directions, opposite meaning | A generic `linkedItems[]` cannot distinguish "caused by" from "fixed by". Direction must be a property of the link type | **must** |
| **Project views** | Hardcoded List / Grid toggle; group-by drives Board + List; a separate Calendar month view | A per-location **Views Bar** where each view is a named, saved, pinnable object carrying its own group/sort/filter/columns/subtask-mode, with a lower-right unsaved-changes prompt offering **Save** or **Autosave view**, overflow into a `+N` dropdown, and a documented ordering rule (overviews immovable → pinned → unpinned) | Views are not objects. No saving, naming, pinning, sharing or per-view state | **must** |
| **Statuses** | Fixed status enum | **Four status groups** — Not Started / Active / Done / Closed — with custom statuses authored per Space/Folder/Subfolder/List and inherited down. "Complete is the default Closed status"; "You can't create custom Closed statuses, but you can rename them." Done tasks are **not overdue** and **clear dependencies**. Not Started statuses always render even when empty | No status groups, so overdue and dependency-clearing cannot be derived. Linear's alternative (fixed ordered categories, authored statuses inside) is the other valid answer | **must** |
| **List grouping** | Group-by exists | Collapsible groups with sticky headers, an ellipsis menu, an inline add row, footer **column calculations** (Sum/Average/Range/Min/Max/Median, Count variants, date Range/Earliest/Latest), and the headline rule: "When a view is grouped or filtered, any tasks you create from the view will have their fields set to match the group and filter automatically" | No inheritance on create, no column calculations, no inline group creation | **must** |
| **Dependencies** | None | Exactly two types (Blocks / Blocked by), chips rendered **above the task description**, a permanent "Clear all dependencies", a close-time Dependency Warning, and rescheduling that shifts dependents by the same number of days — with two hard preconditions: blocking task needs a due date, blocked task needs a start date | No dependency model, no blocked-close warning, no cascade | **must** |
| **Gantt** | None | Six time scales, drag-to-schedule, node-drag dependency drawing, milestone diamonds, baselines, **Critical Path** (walk back from the last task through dependency edges; a time gap or missing link breaks the chain; last task in a group always highlighted) and **Slack Time** as a dashed bar. Parent dates roll up from subtasks | No timeline view at all. Highest wow-per-line in the project dimension and pure client-side geometry | **must** |
| **Custom fields** | 8 subform field types (text, textarea, select, checkbox, email, phone, date, file) | ClickUp documents **23** custom-field types with per-type config (Dropdown/Labels up to 500 options; Text 2,048 chars; Long Text 50,000; Progress Auto tracking subtasks/checklists). Task display rule: "only pinned, required, and Custom Fields with data in them are displayed... in alphabetical order." ServiceNow documents **31** catalog variable types | Only 8 types, and none of the **layout/content** types (Container Start/Split/End, Label, Rich Text Label, Break, HTML, Freshservice's Content). Those are what let instruction live *inside* a form | should |
| **Task modal** | Shared task/ticket modal with subtasks, checklists, slash-command editor | A fixed section order: counts chip row **above the title** → fields row below the title with a "More" link → description → **Custom Fields → Subtasks → Related → Checklists → Assigned comments → Attachments**, each with a full-screen expand. Three layouts (Full screen / Modal / Sidebar) remembered per user | Section order and the counts chip row above the title are not implemented; layout switcher absent | should |
| **Effort models** | None | Three genuinely distinct models: Time Estimates (hours, per-assignee, subtask rollup), Sprint Points (editable value list; nested subtask points roll to the top-level parent, not to intermediate subtasks), Duration (enter two of start/due/duration, the third is computed; `e10d` elapsed vs working-day duration) | No estimates, no points, no duration | should |
| **Milestones / priority** | Priority exists on tickets | Milestones are a **task type** rendered as a diamond, filterable by a dedicated is/is-not filter. Priority is a fixed four-level enum — Urgent, High, Normal, Low — and "It's not possible to customize Priority labels and colors" | No milestone type; priority not unified across tickets and tasks | should |
| **Workload / capacity** | None | Capacity in "shades of red, yellow, or green"; a Backlog rail of tasks "unscheduled, overdue, unassigned, or don't have a time estimate"; capacity modes Daily Scheduled / Daily-Weekly-Monthly Availability / Weekly-Monthly Capacity; grouping by Assignee/Team/List computes capacity, grouping by status/priority/tags does not | No capacity view. "Is anyone drowning?" is a question a board cannot answer | should |
| **Sprints** | None | Sprints are Lists inside Sprint Folders; sprint statuses are Not Started / In Progress / Done, "separate from task statuses and cannot be customized", transitioning automatically on dates; "Marking a sprint as done cannot be undone"; incomplete tasks move to the next sprint | No sprint container, no burndown, no spillover | nice |
| **Templates / recurrence** | None | Task templates with an include/exclude checklist of **22** named properties, irreversible on apply, `/temp` slash command, and a hard failure if applying would exceed the 1,000-subtask limit. Recurrence: six schedule shapes plus **three** recur modes — When complete, **When done**, On schedule | No templates, no recurrence. "When done" is the mode that exercises the Done-vs-Closed split | nice |
| **Asset catalog layer** | Hardware records presumably carry their own make/model/specs | A Model/Manufacturer/Category/Fieldset catalog layer. Snipe-IT attaches Fieldsets at model level; Atlassian states it outright: a `Hardware asset` holds serial, stock number, owner and **a reference pointing to the `Model`**, which holds memory, manufacturer and technical specifications. Lansweeper's EOL data is model- and manufacturer-keyed | 400 identical laptops carry 400 copies of the same spec data, and there is nowhere to hang model-level facts (EOL, depreciation schedule, end-of-support, the fieldset that applies only to laptops) | **must** |
| **Asset ownership** | `assignmentType person \| location` | **Four** ownership roles (Assigned to / Owned by / Managed by / Supported by) plus a **polymorphic checkout target** of `user \| location \| asset`. Freshservice separates `user_id`, `agent_id`, `department_id` and adds `usage_type` = Permanent \| Loaner | Missing the asset-to-asset target (a dock attached to a laptop), and custody is conflated with accountability. Current location must be **derived**, never stored | **must** |
| **Asset lifecycle** | Implicit / hardcoded | User-defined **Status Labels typed** deployable/pending/undeployable/archived, where the type drives behaviour: only deployable statuses can be checked out, and **check-in accepts any status** (a laptop comes back broken). ServiceNow adds a second axis — state answers "where in its life", substate answers "why" | A hardcoded enum is the tell that a prototype is not real | **must** |
| **Locations** | Flat list (emerald) | A self-referencing tree (`parent_id`, recursive hierarchy accessor) with home location stored and **current location derived**, plus per-location currency and rollups | Flat locations cannot answer the two questions locations exist to answer: what is here, and what is homed here but out | **must** |
| **Software licensing** | One flat record: contractType perpetual\|annual, licenseType per_user\|per_location\|per_key, licenseCount, costPerLicense, renewalDate | A four-object chain: **SoftwareProduct → Entitlement → Allocation → Installation**, with a per-metric compliance engine. Snipe-IT materializes seats as rows and flags `reassignable` and `maintained`. ServiceNow: rights owned − rights used = position; True Up Cost = actionable rights × average cost per right + reserved entitlement cost. Six common metrics (Per User, Per Named User, Per Device, Per Named Device, Per Core, Per Processor) and "Selecting Per Device instead of Per Named User... will give you an entirely different compliance position" | Cannot express two purchases at different unit costs, allocation-vs-installation, per-core, concurrent pools, or maintenance attached to a base perpetual entitlement. **Freshservice documents per-device compliance only — this is an easy win** | **must** |
| **Procurement / depreciation** | `costPerLicense` on software only | Supplier, PO, purchase date/cost, **warranty stored as months off purchase date** with expiry computed, EOL from the model's period, and depreciation with a floor/salvage value. Snipe-IT publishes the formula: `current = cost - (cost - floor) * (months_passed / months_total)` | No purchase block, no warranty, no book value. "What is this fleet worth" is one of the two questions that gets an ITAM module funded | **must** |
| **CMDB / impact** | `linkedProducts[]` from assets to catalog nodes | Typed, directional relationships stored as parent/child rows with `forward::reverse` type pairs. Freshservice publishes a ready-made table of **23 pairs**; note the symmetric ones (Connected to, Exchanges data with, Backed Up by). Impact analysis is a depth-capped graph traversal | Cannot answer "what breaks if I patch this server on Saturday" — the entire reason CMDBs exist, and the most demo-able thing in the asset dimension | should |
| **Contracts** | `renewalDate` on the software record | A first-class entity. ServiceNow `ast_contract`: Draft → Active → Expired plus **Cancelled**, renewal via substates, and a nightly "Contract Compliance Checks" job. Freshservice's three defaults: Lease, Maintenance, Software Licence | A hardware maintenance contract covering 200 servers has nowhere to live; one Adobe agreement covering six entitlements gets duplicated six times | should |
| **Asset audit trail** | None | An append-only movement ledger. Snipe-IT tracks `last_checkout`, `checkout_counter`, `checkin_counter` | No history, so no custody chain, no "days idle", no Activity report | should |
| **Asset alerting** | None | **One** configurable day threshold fanning out over every date-bearing field, plus a send-to address. Snipe-IT: "if you set a value of 60 days here, you would begin to get alerts about expiring assets or warranties starting 60 days before they expire," with a separate low-stock alert | No expiry stream. Build one derived alert stream from day one rather than bolting sources on | should |
| **Consumables / accessories / components** | None | Four separate entity types with distinct imports, endpoints and inventory alerting | Nowhere to put a box of 40 USB-C hubs, a toner cartridge, or a stick of RAM in a specific server | nice |
| **Automation canvas** | Business Rules > Workflows: name/description/trigger/enabled plus ordered steps of type approval\|assign\|notify\|wait, each with a label and assignee string. Models but does not run | A free canvas with typed nodes, multi-output branching, loop-back edges, sticky notes, auto-layout, and an execution model with per-node run data | A linear step list is not a workflow engine. Every geometric and behavioural constant needed to build a convincing one is source-verified in n8n | **must** |
| **Automation execution** | None | `runData = { [nodeName]: ITaskData[] }`, one entry per run, feeding node badges, connector item counts, a Logs panel and an Executions list. Per-node settings On Error (Stop Workflow / Continue / Continue using error output), Retry On Fail with tries clamped 2–5 and wait clamped 0–5000 ms | No simulator. This is the object that makes every other automation surface derive for free | **must** |
| **Expressions** | None | A whitelisted variable surface (`$json`, `$now`, `$today`, `$execution`, `$itemIndex`, `$runIndex`, `$workflow`, `$("Node").first()/.last()/.all()`) with helpers `$if`, `$ifEmpty`, `$jmespath`, `$max`, `$min` | No expression layer, so nodes cannot reference upstream data | should |
| **Portal taxonomy** | 3-level Product > Subcategory > Item with leaf-only actions; progressive drill-down with breadcrumbs | Three levels is externally validated **twice**: Intercom ("up to three levels of collections") and Freshservice ("multi-level categories (up to three levels)"). Zendesk enforces leaf-only: "Articles cannot appear under categories" | **No gap — this is RelayHQ's strength.** The defensible part is hanging both help content and multiple request forms off the same leaf, which is exactly what ServiceNow built Unified Taxonomy and Atlassian built help-center Topics to achieve | — |
| **Portal item multi-homing** | Deep-copy between parents | JSM: "you can add a request type to more than one group" — genuine multi-homing, and hidden request types remain searchable, decoupling *browsable* from *findable* | Deep-copy creates a divergent duplicate where the market has a reference | nice |
| **Deflection surfaces** | Help resources render above request forms (verified in `FormPreview.tsx`: knowledgeBases at line 365, subforms at line 427) | Search-as-you-type article suggestion bound to the request's first free-text field — the most universal mechanic in the set. Three variants: Salesforce's concurrent side panel, JSM's inline-under-Summary, Zendesk's post-submit popup with "Yes, close my request" / "No, I need help" | No suggestion of any kind. Zendesk's suppression rule matters: if nothing clears the threshold, render nothing | **must** |
| **Deflection measurement** | The "Did this resolve your issue?" Yes/No sets a boolean and discards it (`handleKBYes = () => setKbResolved(true)`) | Zendesk names three KPIs: suggestion rate, click-through rate, resolution rate, plus median click time; and a self-service score of help-center users ÷ ticket submitters | **The product cannot make its own argument.** The deflection event happens and is thrown away. Highest-leverage single fix in the portal dimension | **must** |
| **Knowledge-gap detection** | None | JSM suggests a topic "only when more than five support requests pertaining to it are received," and only where no related articles exist, over the last 30 days or 200 requests, refreshed weekly | Directly implementable client-side: count submissions per item where the item has zero attached guides | should |
| **Visual guides** | `CarouselViewer.tsx` — 101 lines, `aspect-video` (16:9), two chevrons at `left-3`/`right-3`, dot indicators, a `1 / N` counter | Stories conventions: portrait 9:16, segmented progress bars where only the active segment animates 0→100%, left/right tap zones, pointerdown/pointerup hold-to-pause, a rAF timer loop | The "Instagram-style" claim is currently unbacked — a 16:9 arrow carousel is indistinguishable from every other help-center carousel. The aspect-ratio change alone carries most of the recognition | **must** |
| **Conditional form fields** | Required flags and dropdown options only | Catalog UI Policies (ServiceNow) and native Dependent fields (Freshservice: "Derives its values based on a parent field value") | Without conditional display, "multiple customizable subforms" is just "several static forms". With it, the pitch becomes two stages of progressive disclosure | **must** |
| **Shared field sets** | None | Freshservice Shared Fields: reuse "across multiple service items or categories in a workspace, eliminating the need for recreation," scoped to selected items/categories or all items, with per-field permissions. ServiceNow variable sets add a multi-row grid layout | Authoring N forms without reusable field groups collides with maintenance reality immediately | should |
| **My Requests** | None | ServiceNow's My Requests widget driven by a configurable filter; requests appear for the submitting user | The portal is write-only: a viewer submits and the request vanishes, which undercuts the "this is a real portal" impression more than any missing feature | should |
| **Portal search** | Global live-search dropdown exists in the app shell | A portal search returning guides **and** request forms in one ranked list, with the full breadcrumb on every result | No portal-scoped search; no no-result capture to feed the knowledge-gap table | should |

---
## 3. Dimension reports

Six sections follow, each preserving the **Verified findings → Recommendations → Not verified** structure of the corrected report it came from. Sources are consolidated in section 6.

### 3.1 Business rules, condition builders and approval engines

**What this dimension establishes.** Execution model — not condition syntax — is the real design axis. Every vendor splits event-driven rules from clock-driven ones, keeps condition trees deliberately shallow, and separates a design-time approval *policy* from run-time approval *rows*. Notably, this dimension contains **no efficacy percentages at all**: every number in it is a hard platform limit (500 automations, 65 KB, 100-issue lookup, loop cap 10) and each one checked out.

#### Verified findings

**Execution models are the real design axis** *(Zendesk, ServiceNow, Freshservice)*

Zendesk's split is clock-based and the docs are explicit. Triggers "run every time a ticket is created or updated"; automations "run every hour on all your tickets that are not closed." Triggers do not fire on closed tickets — with one nuance: "ticket triggers *can* fire when a ticket is being set to closed, except when the ticket is automatically closed by the system after 28 days."

The hourly sweep forces a safety rail. Each automation must contain "one action that cancels a condition after the conditions are met or a condition that can only be true once." Hard limits: **up to 500 active automations**, and **each automation must be less than 65 KB**. This is an automation limit; no source extends it to triggers.

Freshservice's Workflow Automator canvas has exactly five documented node types: **Event** ("defines when a workflow has to be triggered"), **Condition**, **Action**, **Reader Node** ("used to read and reference information from the custom objects into the workflows"), and **JSON Parser Node**. No timer or delay node is documented.

**ServiceNow Business Rules: typed by when, ordered by integer** *(nowspectrum.com, specialist blog)*

Four types — before, after, async, display. Before rules persist automatically ("Calling update() inside a Before rule causes a redundant extra database write"); after rules need an explicit `update()`; display rules are "the only Business Rule type that can communicate data to Client Scripts via the g_scratchpad object." Insert/Update/Delete/Query checkboxes select the triggering operations, and "The Condition field is evaluated as a SQL-level filter before the script even loads."

Order: "Lower numbers run first. Default is 100," and critically, **"ServiceNow does not guarantee execution order between rules with the same order value."**

**Condition builders are flat, and the nesting cap is documented** *(Zendesk, Jira)*

Zendesk ships two literal blocks — "meet ALL of the following conditions" and "meet ANY of the following conditions" — with combined semantics quoted as: "a ticket must match every condition in the ALL section, plus at least one of the conditions in the ANY section."

Jira states the cap outright: **"We support two levels of nesting with the if/else block."** This single sentence is the best available evidence for capping depth at two.

ServiceNow's builder is confirmed only at base level: administrators select "a field, an operator, and a value," AND matches all conditions, OR returns results "if any of the given conditions are met." Its depth cap is **not** verified.

**Zendesk's operator matrix — a usable typed-registry template**

Structure: `{all: [...], any: [...]}`, each row `{field, operator, value}`.

| Field family | Operators |
|---|---|
| `group_id`, `assignee_id`, `requester_id`, `organization_id`, `custom_fields_{id}` | `is`, `is_not` |
| `current_tags` | `includes`, `not_includes` |
| `status`, `type`, `priority` | `is`, `is_not`, `less_than`, `greater_than`, plus trigger-only `changed`, `value`, `value_previous`, `not_changed`, `not_value`, `not_value_previous` |
| `satisfaction_score` | the above **plus `good`, `good_with_comment`, `bad`, `bad_with_comment`** |
| `brand_id`, `ticket_form_id` | `is`, `is_not`, `changed`, `changed_to`, `changed_from`, **plus `not_changed`, `not_changed_to`, `not_changed_from`** |
| `subject_includes_word`, `comment_includes_word` | `includes`, `not_includes`, `is`, `is_not` |
| Counters (`reopens`, `replies`, `agent_stations`, `group_stations`) | `less_than`, `greater_than`, `is` |
| Time fields | `is`, `is_business_hours`, `less_than`, `less_than_business_hours`, `greater_than`, `greater_than_business_hours` |

The two bolded rows are the ones the original research omitted; include them.

**ServiceNow's operator tokens** *(sn.jace.pro, unofficial reference — treat labels as indicative)*

The distinctive operators are real: `SAMEAS` = "is same", `NSAMEAS` = "is different", `DYNAMIC` = "is (dynamic)", `DATEPART` = "trend", and the relative family `RELATIVEGT / GE / LT / LE / E` labelled "relative (after) / (on or after) / (before) / (on or before) / (on)". Change detection `VALCHANGES` / `CHANGESFROM` / `CHANGESTO` and field-to-field comparison are confirmed.

**Jira separates value comparison, query matching and regex**

Named conditions: Issue fields, **Alert fields**, {{smart values}}, Affected services, Forms attached, If/else block, Issue attachments, **Issue has design linked**, AQL, JQL, Related issues, User.

The smart-values condition's operators, verbatim: equals, does not equal, greater than, less than, starts with, contains, does not contain, contains regular expression, exactly matches regular expression, does not match regular expression.

**ServiceNow's approval quorum grammar** *(ServiceNow Community blog — confirmed verbatim)*

Grammar: `ruleset + rule + who + [sys_id list]`, rulesets combined with `Or`.

- **Rulesets:** `Approves`, `Rejects`, `ApprovesRejects`
- **Rules:** `Any` = "Anyone approves"; `All` = "All users approve"; `Res` = "All responded and anyone approves"; `%` = "% of users approve"; `#` = "number of users approve"
- **Who:** `U` = Users, `G` = Groups

Confirmed examples: `ApprovesAnyU[user,user]`, `Approves50%G[group]`, `Approves2#U[user,user]G[group]`, `RejectsAnyG[group,group]`, `ApprovesRejectsAnyU[user]`, `ApprovesAnyG[group]OrRejectsAnyU[user]`, `RejectsAllU[...]`, `ApprovesResG[...]`.

Confirmed *UI* labels are narrower: "Anyone approves", "All users approve", and percentage/number thresholds. "All responded and anyone approves" and "Anyone rejects" are confirmed as rule-code *meanings*, not as quoted dropdown strings.

**Freshservice's two-tier quorum** *(Freshservice docs)*

Group level, quoted: **Anyone** — "approved if just one of the approvers in the group grants their approval"; **Everyone** — "only if all the approvers in the group grant their approval"; **Majority**; **First Responder** — "approved/rejected based on what the very first responder of the group decides."

Chain level: all groups approve / any group approves / majority of the groups approve / first responding group approves. And: **"The ticket or change approval status changes only when the chain is approved, rejected, or canceled."**

Journeys narrows to "Everyone (all approvers must agree), Anyone (the first response decides), or Majority", with four approver categories — Stakeholders ("Dynamic roles such as the requester's reporting manager"), Users, Agent groups, Requester groups — and three rejection outcomes: Continue Journey, Cancel the Journey, Cancel the Phase.

Hierarchical chains: requests go "first sent to the immediate supervisor or the team leader... If they approve, it is sent to the manager. The department head will get the request only if the manager approves it."

Reminders: a **"Send a reminder to approvers every .... hour(s)"** setting with editable subject and message and an Insert Placeholder feature.

**Power Automate: five labels, but the page says "four"** *(Microsoft Learn)*

The five table rows are verbatim: Approve/Reject - Everyone must approve; Approve/Reject - First to respond; Custom Responses - Wait for all responses; Custom Responses - Wait for one response; and **Sequential approval** — "Approvals are requested one at a time, in a specific order. Each approver must respond before the request moves to the next approver in the sequence."

**Caveat:** the same page's prose states "There are four approval types you can use" directly above a five-row table. Microsoft's doc is internally inconsistent. **Cite the table, not the count.** Response channels confirmed: Outlook email, Teams adaptive card, or the Power Automate action center.

**`sysapproval_approver` as a per-approver row model** *(thesnowball.co, third-party reference)*

Extends `task`. Confirmed columns: approver, state, approval, document_id, source_table, sysapproval, group, approving_type, delegate, due_date, expected_start, escalation_rule, wf_activity, comments, tree_path. **`order` is not a column** — the original research included it in error.

State values: `requested` (active), `approved`, `rejected`, `cancelled`, `not required`. Confirmed gotcha: "`state='requested'` for active approvals, not `state='1'`."

**JSM binds approvals to statuses, and the transition-count rule is the trap**

Verbatim: "If you set up your approval step on a status with only two outgoing transitions, they will be used for Approve and Decline." With more than two, "an agent will be able to transition the request using any of the other transitions that aren't defined as the Approve or Decline transitions. **This means the approval step is not enforced.**" The **Approvers** custom field is auto-created; **Approver groups** exists.

**JSM approval smart values** *(verbatim, including per-trigger scoping)*

Both triggers: `{{approval}}` ("Returns the name of the approval"), `{{approval.createdDate}}`. Approval-required only: `{{approval.initiator}}`, `{{approval.addedApprovers}}`. Approval-completed only: `{{approval.approver}}` ("Returns approver's account id"), `{{approval.completedDate}}`, `{{approval.decision}}`.

The multi-step gotcha: "The Approval completed trigger (JSM-only) fires *after every approval step*... a rule on this trigger runs repeatedly — once per step — unless you add a condition to scope it," typically an Advanced Compare of `{{approval.approver}}` against a custom field's `accountId`.

**Jira ships no approval action.** The full published action list contains no approve/reject action. Confirmed sub-limits: Lookup issues has a "configurable limit (100 by default)"; Send email to a group "will only send it to 100 users from the group, omitting the rest."

**ServiceNow Change Approval Policies are decision tables** *(ServiceNow Community)*

Policy Inputs → Decisions (condition rows) → Answers (Change Approval Definitions). Four action types, verbatim: "Approve (automatically as user $user_name)", "Reject (automatically as user $user_name)", "Generate User approval to user $user_name", "Generate Group approval to group $assignment_group". The out-of-box Normal policy has decisions in the **Assess** state (assignment-group approval) and the **Authorize** state (CAB approval when risk is Moderate or High), plus a low-risk manager decision.

The audit trail can be named precisely: the **`chg_policy_applied`** table logs "the Change Request, change policy, Decision (matched outcome), and the date it occurred."

**Correction:** the >1000-CI standard-change policy exists as a shipped example but the source states it is "not tied into the Standard Change Workflow in any way." It is not an operative override — drop it or label it as un-wired.

**Delegation is a date-windowed record in ServiceNow, absent in JSM**

`sys_user_delegate` carries User, Delegate, Starts, Ends, and **four** scope checkboxes: Approvals, Assignments, All Notifications, Meeting Invitations. Confirmed: "A delegate does not have delegation access outside of these dates," and the footgun "If the Approvals check box is selected but All notifications are not, the delegate does not receive approvals."

JSDCLOUD-7867 confirmed: "if a customer with approval rights leaves on vacation, there's no way for them to delegate their rights to someone else." Status **Future Consideration** (unresolved), 249 votes, 109 watchers.

**Rule ordering is user-editable in Zendesk.** "All of your active ticket triggers run each time a ticket is created or updated and actions in one ticket trigger can affect the actions in another." There is an **Edit order** button, and "You can use trigger categories to reorder multiple ticket triggers at the same time." Recommended sequence: value changes → assignments → notifications last.

**Jira's five audit-log statuses** *(verbatim)*: Successful ("all actions within this execution were performed and ended in a success"); No actions ("the rule executed but no actions were performed"); Some errors ("the rule resulted in an error"); Loop ("the rule execution resulted in an execution loop"); Throttled ("the rule breached a service limit").

**ServiceNow flow observability is graded and Off by default.** Levels: Off ("Reporting is deactivated. The system generates execution details only when you test a flow"), Flows Only, Flows and Actions, Flows Actions and Steps, Developer Trace. Default is Off, set by `com.snc.process_flow.reporting.level`, and "Keeping reporting OFF on production instance improve flow performance." The module is **Flow Administration > Today's Executions** and system-wide runs appear on a **Flows tab within Operations**; the per-flow **Executions** button is confirmed.

**ServiceNow's classic-vs-Flow group approval gap is real.** Classic Workflow offered "An approval from each group" and "First response from each group"; Flow Designer's Ask for Approval offers Anyone approves / All users approve / percentage / number and **"None accommodate the common requirement of one approval per group."** Confirmed failure mode: with "Anyone approves" across multiple groups, a single approval from any group settles it and all other members across all groups are marked "No Longer Required." The documented workaround is a legacy Approval Coordinator subflow.

**ServiceNow's non-Flow approval path** *(emergys.com, single consultancy source)*: approval rules are "simple rules which will be matched against the task table records," reached via **System Policy → Rules → Approvals**. The per-table Approval Engine has three modes: Approval Rules, Process Guides, Turn off Engine. Rule-generated approvals begin in **Requested**; workflow-generated approvals begin in **Not Requested**.

**Monday renders rules as sentences** *(developer.monday.com, verbatim)*: "A recipe sentence represents an automated data flow. They are called recipes because they are made of two or more ingredients (the blocks)." Recipes "are constructed using a sequence of trigger and action blocks." Confirmed example: "When a status changes to done, notify #channel in Slack."

**ServiceNow risk calculation.** Two invocation paths: a manual **"Calculate Risk"** UI action, and an automatic business rule on insert/update requiring at least the ITIL role. The matching rule, verbatim: "The first lowest Risk condition which matches the current change get applied to the change request and other higher ones get skipped/ignored." **Correction:** a Risk Condition sets Risk **or** Impact, not both — "Select a value for one of these fields. The selection determines which field to update based on this risk calculation."

#### Recommendations

**1. Ship a typed condition AST with a shared `<ConditionBuilder>`, capped at two levels of nesting. (must)**

Jira states the cap explicitly; Zendesk ships an even flatter model (two parallel ALL/ANY blocks, no nesting). Two vendors is enough support. Do **not** cite ServiceNow's builder as a verified two-level AND-of-OR model — that depth cap was not confirmed.

Build it once, reuse it in **eight** places: rule conditions, approval-policy applicability, auto-approve thresholds, conditional routing, change-decision rows, subform field visibility, asset reclamation rules, and alert thresholds. Seed the per-type operator registry from Zendesk's matrix above, including the four `satisfaction_score` operators and the three negative change-detection operators. Have `evaluate()` return `{result, trace}` — the trace powers the execution-log explainer and the dry-run preview for free.

**2. Collapse Queues / Routing / Workflows into one ordered Rule list with a `kind` discriminator. (must)**

Zendesk's event-vs-clock split is real, ordering is user-editable with an explicit Edit-order control, categories reorder as a block, and value changes → assignments → notifications is a good default seed order. ServiceNow's integer `order` with default 100 is the right numeric model — and since ties are explicitly undefined there, **RelayHQ should define them** (secondary sort by name) rather than inherit the ambiguity. Keep the clock/event distinction in the model, because scheduled rules need Zendesk's nullifying-action safety rail and event rules do not.

**3. Two objects: `ApprovalPolicy` (design-time) and `ApprovalRequest` (run-time); quorum lives on the STAGE. (must)**

The strongest recommendation in the dimension. Flow Designer genuinely cannot express "one approval from each group" — confirmed both as a capability gap and as a specific failure mode. Stage-level quorum makes serial, parallel and per-group quorum fall out of one model.

Seed the quorum vocabulary from ServiceNow's rule codes (`Any`, `All`, `Res`, `%`, `#`) crossed with Freshservice's `First Responder`, and model the reject side separately as ServiceNow's `Rejects` / `ApprovesRejects` rulesets do. Add Power Automate's **Sequential** as a stage arrangement.

Model `ApprovalRequest` on the `sysapproval_approver` shape — but **drop `order`**, which that table does not have. Adopt its state vocabulary as-is: `requested` (active), `approved`, `rejected`, `cancelled`, `not required`.

**4. Add a People / Org directory so dynamic approvers resolve. (must)**

Verified across two vendors: Freshservice resolves "Dynamic roles such as the requester's reporting manager" as a Stakeholder category, and its hierarchical chain (supervisor → manager → department head, each gated on the prior) is documented. JSM's gap is real at the delegation level. Resolve at approval-generation time; treat an empty resolution as an explicit `unresolvable` state, **never a silent skip**.

**5. Add a simulated clock with a visible speed control. (must)**

No vendor premise — this is an original design move and the highest-leverage prototype idea in the document. Every time-shaped behaviour verified above (Freshservice's hourly reminder cadence, ServiceNow's due-date-driven approvals, Zendesk's hourly sweep, n8n's Wait node, contract expiry, warranty countdowns) is otherwise invisible in a demo.

**6. Event bus with a depth-capped execution log, rendering the condition trace as the explainer. (must)**

Jira's loop detection is a **fixed platform limit of 10** chained triggerings — not a configurable per-issue window. That simplifies the design: a `MAX_CHAIN_DEPTH` constant, set to 10 to match or 5 as a stricter prototype default. Use Jira's five status words for the log: Successful / No actions / Some errors / Loop / Throttled. The condition-trace explainer is genuinely differentiated — ServiceNow's flow reporting is Off by default in production for performance reasons, so incumbents really do make traceability expensive.

**7. "My Approvals" as a first-class workspace lens plus an approval chip on the ticket card. (must)**

JSM's portal splits pending from past approvals; Power Automate's action center is a confirmed response surface alongside Outlook and Teams. Mirror Freshservice's chain-resolution rule in the UI: show **stage state separately from overall request state**, because "the ticket or change approval status changes only when the chain is approved, rejected, or canceled."

**8. Delegation as a date-windowed record resolved at notify-time. (should)**

Copy `sys_user_delegate`'s shape — delegating user, delegate, Starts, Ends, per-scope checkboxes — and copy its footgun as a **fix**: ServiceNow's approvals-without-notifications trap is exactly the kind of thing RelayHQ should design out, not reproduce. Always record who actually clicked versus whose authority was used. Cite JSDCLOUD-7867 accurately: unresolved, 249 votes, status "Future Consideration".

**9. Add dry-run: live match count on the builder plus a sandboxed "Test this rule". (should)**

Note the corrected premise: with reporting Off, ServiceNow "generates execution details only when you test a flow" — testing works precisely *because* it bypasses the reporting-level setting. The recommendation stands on stronger ground anyway: Jira has no simulator at all, and in a client-side prototype with a plain-object store, deep-clone → run → diff → discard is nearly free.

**10. Make routing an authored, ordered, first-match-wins rule set with a visible "effective routing" resolver. (should)**

The resolver table is an original addition and a good one — it is the answer to "why did this land in General?"

**11. Add re-approval-on-change with an explicit reason banner. (should)**

ServiceNow's documented route does **not** reset approver rows in place: a "Reset change workflow" UI action sets `approval='Reset'`, caught by the `SNC Approval – Reset conditions` business rule, offering three handling options — "Cancel all existing approvals and reset", "Delete all existing approvals and reset", "Leave all existing approvals alone and reset" — with the recommended path calling `WorkflowApprovalUtils().cancelAll(current, comment)` then `Workflow().restartWorkflow(current)`, after which the approval field reads `not requested`.

Keep the feature. Present RelayHQ's row-reset-in-place design as **a deliberate improvement on ServiceNow's cancel-and-restart**, not as a copy of it, and lean into the fact that preserving prior decisions in the journal is exactly what `cancelAll` throws away. Copy the three-way handling choice (cancel / delete / leave alone) — it is a genuinely useful piece of design.

**12. Plain-English sentence summaries for rules and quorum. (nice)**

Verified from Monday's own developer docs including the exact example sentence. A pure function over the AST from recommendation 1, and the most prospect-legible feature in the set.

**13. localStorage persistence behind explicit Save / Reset. (nice)**

Sound prototype hygiene. Keep it explicit so "Reset demo data" is reliable.

#### Not verified

**Contradicted — remove from the design record:**

- **Jira "Loop detection" as a configurable per-issue-per-time-window setting under Settings → Advanced.** It is a fixed service limit of 10 chained triggerings.
- **ServiceNow Risk Conditions setting both Risk and Impact.** The source says "Select a value for one of these fields."
- **ServiceNow re-approval as an in-place row reset.** The documented route cancels or deletes approvals and restarts the workflow.
- **`order` as a column on `sysapproval_approver`.** Not present in the reference schema.
- **Standard changes overridable by a >1000-CI policy violation.** The shipped example is "not tied into the Standard Change Workflow in any way."

**Unverified — no supporting source reached:**

- **ClickUp's automation conditions, entirely.** Both help-centre articles returned HTTP 403. Condition model, Business-plan gating, operator sets, AND/OR grouping and any condition-count limit are all unconfirmed.
- **Monday's builder flow** ("When this happens" / "Then do this", category taxonomy) — `support.monday.com` returned 403. Only the developer-docs sentence model is verified.
- **JSM's "Approver source = Jira field" and "Number of approvers = All approvers / a specific count".** The Cloud article body is unretrievable; the Server/DC equivalent uses different wording ("minimum number of approvals").
- **ServiceNow order 1000 as a reserved band for platform engines.**
- **ServiceNow condition builder's "Add Sort" button, the `^` / `^OR` / `^NQ` encoded-query semantics, and any depth cap.**
- **Jira's Issue-fields condition operator list.** Docs describe only field-vs-value and field-vs-field comparison.
- **Jira's per-rule checkbox controlling whether other rules' actions may trigger it.**
- **Zendesk's fired-once-per-cycle skip, multi-pass trigger cycling, and any built-in runaway ceiling.**
- **Zendesk's 65 KB cap applying to triggers.** Stated as an automation limit only.
- **Zendesk's account audit log vs ticket events split**, and the plan list (Team/Growth/Professional/Enterprise). The account-audit article 404'd; ticket audits *do* record notifications sent by a trigger, which partly undercuts the clean split.
- **ServiceNow "Ask for Approval" Due Date option list** (relative dates; automatic approve/reject/cancel on deadline). The `due_date`, `expected_start` and `escalation_rule` columns exist; the control's behaviour is not verified.
- **"JSM ships no approval timer at all."** An absence claim, unverified.
- **ServiceNow roles `flow_report_viewer`, `flow_designer_scripting`, `flow_operator`.**
- **`current.autoSysFields(false)`, the "Abort action" checkbox and its tab location, and pairing `setAbortAction` with `addErrorMessage`.** One source pairs it with `gs.addInfoMessage()` instead. The core behaviours of `setWorkflow(false)` and `setAbortAction(true)` are corroborated.
- **`wait_for='all'` / `wait_for='any'` internal values** on the classic Approval–Group activity.
- **`sysapproval_rule`'s field list**, and whether "System Policy > Rules > Approvals" is current in Xanadu/Yokohama/Zurich. Single consultancy-blog source.
- **"Res" / "Anyone rejects" as verbatim Flow Designer UI labels.** Confirmed as rule-code meanings only.
- **JSDSERVER-5121** and the Out of Office Assistant "approver coverer" details.
- **All RelayHQ codebase claims** — no condition model, bare-string `assignee`, no runtime, no execution log. Confirm against the repo before prioritising.

---
### 3.2 ITIL change management and the change / problem / incident triad

**What this dimension establishes.** Across ServiceNow, Jira Service Management, Freshservice and ITIL 4, change management resolves to the same five moves: a **typed lifecycle**, a **computed risk score**, a **schedule with blackout/maintenance windows and conflict detection**, an **approval engine expressed as a condition/decision table** rather than hard-coded workflow steps, and a **post-implementation review ending in a close code**. Two primary PDFs were extracted and read locally for this dimension — the ServiceNow-authored process guide (© 2022 ServiceNow, Ref 0001216) and the AXELOS ITIL 4 Change enablement practice guide (2019) — which makes it the best-evidenced dimension in the set.

#### Verified findings

**ServiceNow — lifecycle** *(ServiceNow-authored process guide; corroborated by the `servicenow.itsm` Ansible collection)*

- State model: **New → Assess → Authorize → Scheduled → Implement → Review → Closed**, with **Canceled** reachable at any time ("A change can be canceled at any time", mandatory Work Note on cancel). The Ansible collection's `state` choices match exactly.
- **All three change types share one state set.** **Emergency skips Assess**: the single Service Owner approval "occurs at the Authorize state which means that the Assess state is not used at all." **Standard enters at Scheduled**: "No approvals are requested since the approval has occurred on the template" — though "the Service Owner will be notified of the standard change."
- **New → Assess is gated on exactly 18 mandatory fields**: Requested by, Category, Service, Configuration Item, Priority, Risk, Impact, Short Description, Description, Assignment group, Justification, Implementation plan, Communication plan, Risk and impact analysis, Backout plan, Test plan, Planned start date, Planned end date. Note "Risk and impact analysis" is a distinct free-text field from the Risk and Impact classifications. *Framing correction:* this is the configuration recommended in a ServiceNow-authored implementation guide, not an immutable platform default.
- **Actuals auto-stamp on state entry**: actual start on Implement, actual end on Review, and "The Actual dates can be overridden manually if they differ from the automatically populated window." (Behaviour confirmed; column names are not — see Not verified.)
- **Overdue is a computed condition, not a state**: "Any change which has passed the Planned end date and is not in New, Review, Closed or Canceled, state is considered an Overdue Change."
- **Emergency changes may be retroactive**: "Emergency changes allow Planned start and Planned end dates to be in the past. These changes can be immediately moved through to the Review state since they have already been implemented" — with a recommended review for misuse. **Date validation must therefore be a per-change-type rule.**
- **PIR is the Review state plus two mandatory fields** — Close code (Successful / Successful with issues / Unsuccessful) and Close notes — and a non-Successful code warrants "additional review fields or tasks." A closed change can be reopened: "In situations where the change was originally considered successful but subsequently discovered to be otherwise, it is acceptable for a Change Manager to return the change to Review state to conduct a PIR against it."
- **Seven initiation sources**: directly in the change application; from an Incident (when the agent identifies "the fix required to resolve the incident"); from a Problem; through the Service Catalog; from a Request; automatically via Integrations; DevOps via the Change API.
- **Standard change is a two-record proposal/template lifecycle**: propose via Service Catalog or promote an existing change not marked unsuccessful → Change Management reviews → publish to the Standard Change Catalog as a template → any permitted user raises an instance, where "This pre-populated data will not be editable by the user to maintain the integrity of the approved template. Variable data such as the planned dates can be added." Modify and retire run the same loop, and templates should be monitored for usage frequency and unsuccessful outcomes. Predictive Intelligence clustering suggests templates, and templates can be approved in a CAB meeting via the CAB Workbench.

**ServiceNow — field enumerations** *(Ansible collection module docs)*

`type` = standard | normal | emergency · `risk` = high | moderate | low · `impact` = high | medium | low · `priority` = critical | high | moderate | low · `category` = hardware | software | service | system_software | **aplication_software** | network | telecom | documentation | other (**the misspelling is the actual shipped value**, confirmed character-for-character) · `close_code` = successful | successful_issues | unsuccessful. Other confirmed params: `requested_by`, `assignment_group`, `short_description`, `description`, `close_notes`, `urgency`, `on_hold`, `hold_reason`, `template`.

**ServiceNow — risk**

- **Risk Conditions** live at All > Change > Administration > Risk Conditions, with fields Name, Risk/Impact, Active, Order, Use advanced condition, Use script values, Description. First-match-wins, verbatim: "The first lowest Risk condition which matches the current change get applied," higher orders skipped.
- **Four out-of-box conditions ship**: Insufficient lead time, Critical service changed, Critical service affected, Default. The two "critical service" conditions have a real trap: they "will only work if you reference the service in the 'Configuration Item' field" and the service "has to be of class **cmdb_ci_service** and not one of the derived classes."
- **Questionnaire mechanics**: Assessment Metrics (weighted questions), Metric Categories (groupings with filter conditions), Metric Definitions (answer choices with an `actual_value`). `normalized_value = actual_value × weight`; total = sum of normalized values; Assessment Thresholds map bands to a risk level ("If the result is 7 and moderate threshold is 6 risk is moderate"). Results land in `asmt_metric_result`.

**ServiceNow — approval engine** *(the architecture worth copying; verified in full)*

1. **Policy Inputs**: the built-in `change_request` input "provides a reference to the current Change Request and anything the change_request table references"; custom typed inputs (e.g. a boolean `manager_approved`) can be added. Conditions reference an input, then a field on it — "Change Request.State", "Change Request.Risk".
2. **Decisions**: each carries a condition, typically keyed on state (the "Assess Technical Approvals" decision applies "when the state is Assess").
3. **Approval Definitions**: actions are approve automatically as a specified user, reject automatically, generate a user approval, or generate a group approval. **Approver Source** is dynamic (pick a column on the Change Request record) or static (a group/user named in the definition). **Wait for** is "for group approvals only, it specifies whether the first approval is enough to pass the approval gate or if the entire group must respond." **Mandatory** "is used to require a response from the approval audience."

Also confirmed: "approvals for change requests are no longer configured in the approval activities in workflows. Instead, a new workflow activity type is called – Change Approval Policy – that references policies/rules that you create." *(The release that introduced this is not evidenced — drop any "since Madrid" attribution.)*

**ServiceNow — schedule and conflicts**

- **Ten conflict types, all machine keys confirmed**: `blackout` (Inside Blackout Window), `child_blackout`, `parent_blackout`, `ci_already_scheduled`, `parent_ci_already_scheduled`, `child_ci_already_scheduled`, `not_in_maintenance_window`, `child_not_in_maintenance_window`, `parent_not_in_maintenance_window`, `assigned_to_already_scheduled`.
- Detection inputs: change start/end date overlap; `change_request.cmdb_ci` (basic mode) or the Affected CIs list (advanced mode); and `change_request.assigned_to`.
- **Polarity, stated precisely: inside a blackout window is a conflict; outside a maintenance window is a conflict.**
- Blackout and maintenance schedules are the **same underlying object**: `cmn_schedule_condition` extends `cmn_schedule`; individual windows are rows in `cmn_schedule_span`. They are "defined to apply to a specific class, or a subset of a class, within the CMDB" via a condition — which is why one rule can cover a whole service tier. Child schedules carry **Include** (add the child's spans) or **Exclude** (omit them), the standard way to define holidays once and reuse them.
- *Correction:* `schedule_admin` permits creating and editing schedules but "does not, however, grant the ability to associate Child Schedules. This is reserved for users who possess the admin role."

**ServiceNow — CAB** *(learnnowlab.com, a third-party training site — ServiceNow's own CAB docs were unreachable; attribute accordingly, never as ServiceNow documentation)*

CAB Definition fields: CAB manager, Board members, Delegate (conducts the meeting in the manager's absence), Rolling meeting window (days ahead for which meetings are auto-created), Conference details, Notification lead time, Auto-add agenda items, Auto-generate meeting notes, and Change request addition conditions. Recurrence supports daily, weekly, monthly (specific day, last day, or last weekday) and single occurrence. A change lands on an agenda when it matches the filter **and** its planned dates fall within the meeting window. Run flow: Start meeting → discuss each item → approve/reject → system records elapsed time per item → End meeting → notes auto-generate. Role: `sn_change_cab.cab_manager`.

On the change record, `cab_required`, `cab_date` and `cab_delegate` are confirmed to exist. Two corrections: `cab_date` is **auto-populated with the CAB meeting's start date when "Refresh Agenda Items" is clicked**, and these fields display for **Normal and Emergency** types, not Standard.

**ServiceNow — problem and triad links**

- Problem state **labels** confirmed: New, Assess, Root Cause Analysis, Fix in Progress, Resolved, Closed.
- **Known error** = "a problem where the root cause has already been identified and documented"; **workaround** = "a temporary solution that helps restore service or reduce the impact of an issue without actually fixing the underlying root cause." *Correction:* known error is an **attribute set once root cause is documented**, not a state in the state model.
- `incident.caused_by` is out-of-box on the **Incident** table, references `change_request`, and identifies "an incident which has been raised due to failure of any change." `incident.rfc` separately links the change that fixes the incident. `incident.problem_id` links incident to problem. **The design implication stands on this evidence alone: link kinds must be directional and typed — a generic `linkedItems[]` cannot distinguish "caused by" from "fixed by."**
- *Correction:* there is **no out-of-box "caused by change" field on the Problem table.** The thread originally cited is a user requesting a custom one, with ITIL practitioners arguing against it ("a problem starting point is Incident not change").

**Jira Service Management**

- Default workflow sequence: **Change manager/Peer review → Planning → Awaiting CAB approval → Awaiting implementation → Implemented/Complete.** The genuine insight holds: **JSM puts Planning after the first review**, the inverse of ServiceNow — a sanity check before anyone invests in a plan. Additional statuses corroborated by a third-party walkthrough: Authorize, Implementing, Completed, Failed, Declined, Canceled. On Data Center, Atlassian states "The following statuses would be created in a default Jira instance: Approving, CAB Review, Post-implementation review, Review" — so **PIR-as-a-status is a DC pattern, not a verified Cloud default**.
- **Default change request fields**, confirmed exactly: Summary, Reporter, Component/s, Attachment, Description, Linked Issues, Assignee, Priority, Labels, Request participants, Approvers, Organizations, Impact, Urgency, Change type, Change reason, Change risk, Change start date, Change completion date, Change advisory board (CAB), Pending reason. Change type = standard / normal / emergency. CAB = "individuals responsible for assessing, approving and scheduling the change."
- **Calendar** is driven strictly by the **Change start date** and **Change completion date** custom fields. Project admins repoint them under Project settings → Change management → Default calendar view; individual agents can change Start date time / End date time under View settings.
- **Freeze windows can hard-block**: "Admins can configure the calendar to automatically block change requests, ensuring compliance and reducing risk," enforceable at **project and service/asset level**. Blocking granularity is confirmed all-or-none — an Atlassian team member on urgent-change exceptions: "At present it's All / None, but we'll explore this feedback." **Change Calendar is Premium and Enterprise only.**
- **Standard changes auto-approve** via a shipped rule: the ITSM template includes "an automation rule that pre-approves change requests where the Change type is set to Standard."
- **AI risk assessment** (Premium and Enterprise) evaluates "10+ risk parameters across two core categories" — technical (failed deployments, implementation patterns, missing rollback/test plans, recurring incidents; GitLab/GitHub/Bitbucket CI/CD) and operational (scheduling conflicts, freeze/maintenance window clashes, service dependencies, rollback complexity, infrastructure changes) — producing an overall level plus evidence with concrete drivers ("3 failed deployments in the last 60 days for this service"). **Level labels are low / medium / high.** This is a documented capability; **its predictive accuracy is not evidenced.**

**Freshservice**

- **Four change types, not three**: Minor, Standard, Major, Emergency — each with **its own change lifecycle**.
- A lifecycle is **Status + Transition + Condition**, where conditions check task completion, approval status, and mandatory field population. Lifecycles save as **Draft** (editable without affecting current changes) or **Published**. Configuration lives at **Admin → Service Management → Service Desk Settings → Change Lifecycle** (workspace-prefixed on multi-workspace accounts).
- **Risk policy — the most implementable engine of the three, and fully verified.** Trigger conditions drawn from Change Properties, Change Planning Fields or Change Calendar data, combined with Match ALL / Match ANY. A **Risk Profile** of parameters, each with rules using `is` / `is not` / `includes` / `is empty` and a score of **1–10**; optional weights that must "add up to exactly 100"; "If no rule matches, the parameter score is defaulted to '0' in change request forms." A **Risk Survey** (up to 50 questions; long-text and message types don't score). Reconciliation by **Highest severity** or **Weighted average**. Global bands: **Low 0-25, Medium 26-50, High 51-75, Very High 76-100.** *Caveat:* the weighted-average documentation is ambiguous (it assigns percentage importance totalling 100% but also says the system applies the higher resulting score), so **treat a clean 70/30 profile/survey mean as a RelayHQ design choice, not a documented formula.**
- **Windows**: both types take Name, Description, Duration, Recurrence. Maintenance windows are scoped "Available for changes that match the following conditions"; blackout windows "Apply to changes that match the following conditions." A **Freeze Window** option prevents further modification or addition of changes to a maintenance window. Documented blackout use case: preventing deployments for "payroll service at the end of the month." Associating a non-conforming change throws a mismatch error. Gated by the **"Manage Change Lifecycle & Calendar Windows"** permission.
- **CAB**: named sets of senior agents (one agent can sit on several); "To be approved by" = **Anyone / Everyone / Majority**; technicians can select specific members when submitting. Verbatim and decisive: **"irrespective of the CAB's vote, the Change Manager will have the final authority to approve the change."**
- **CAB Huddle**: Change Calendar → + Schedule → CAB Meeting (name, description, duration, optional daily/weekly recurrence); agenda via "+Add Changes" with filters; attendees comment before the meeting; manager clicks **Run Meeting** and participants "approve/reject the change or click on Comments to add their comments"; **End meeting** produces a customizable summary emailed to attendees. Syncs to Office 365 and Google Calendar — with the caveat that "Users will not receive email notifications from Freshservice if they have enabled google or outlook calendars for CAB."
- **Change calendar is a four-entity surface**: Changes, Maintenance windows, Blackout windows, CAB meetings. Reached via My Work → Work Calendar → module dropdown → Changes, or from the Change module. Filters carry over from the Change module and reset to the current user's items when entering from Work Calendar. Exports to **ICS and PDF** with selectable date range and per-entity filters.
- **Planning fields** are Reason for Change, Impact, **Rollout Plan** and Backout Plan — note "Rollout" rather than "Implementation". **Associations** "Links related tickets, incidents, problems, projects, or tasks that triggered or influenced the change." The **Assets** section attaches "relevant assets that might be impacted or modified" (assets generally, not specifically services).
- **Release** = "a collection of authorized Changes to an IT service, which are tested and introduced into the live environment together," with a **Build plan** and **Test plan** (rich text plus attachments); changes linked via **Link New** or **Existing Change** and removed via **Detach**.

**ITIL 4 / AXELOS** *(Change enablement practice guide, 2019 — extracted and read directly)*

- **Standard change**: "A low-risk, pre-authorized change that is well understood and fully documented, and which can be implemented without needing additional authorization."
- **Emergency change**: "A change that must be introduced as soon as possible."
- **Change authority**: "A person or group responsible for authorizing a change."
- **Change model**: "A repeatable approach to the management of a particular type of change." Definable by systems/technologies, scale of change, locations/territories, customers, and "regulatory requirements affecting the change."
- Normal changes are defined by exclusion: "When there is no effective standardized approach to a change, organizations usually attempt to plan, authorize, and control that change. They follow a process that includes collective expert assessment, authorization, and control."
- **The rule that justifies the whole standard-change concept**: "When the procedure for a standard change is created or modified, the procedure should be authorized and undergo a full risk assessment. **This risk assessment does not need to be repeated for every change; it is needed only if the procedure itself undergoes another modification.**"
- **Two processes.** *Change lifecycle management*: Change registration → Change assessment → Change authorization → Change planning → Change realization control → Change review and closure. Key outputs: Change records, Change schedule, Change review reports, Changed resources and services. *Change optimization*: Change review analysis → Change model improvement initiation → Change model update communication.
- **Named metrics** (verbatim): change success/acceptance rate over period; business impact of change-related incidents; number and duration of change-related incidents; impact of changes identified as sources of problems/errors. Plus: aggregated timeliness processing index (TPI) over the period; average time of change realization per change model; change initiators' satisfaction with change outcomes and with timeliness.
- **Explicitly hostile to the classical CAB** (verbatim): "These are known as change advisory boards (CABs), and they often become bottlenecks for the organization's value streams. They introduce delays and limit the throughput of the change enablement practice." The prescription: "Change models should define the requirements and procedures for authorization, **delegating the role of change authority to the appropriate level**, such as development teams, technical experts, or service and product owners." And: "'Emergency' does not mean 'no rules or control'. Emergency changes can be standardized and automated." Reinforced by: "Depending on the change model, assessment and authorization may be done manually, automatically, or skipped for specific types of change."

**Real-world configuration** *(Stanford UIT — one university's local configuration, useful as a pattern, not an industry benchmark)*

Stanford's ServiceNow implementation extends risk to five levels — 1-Very High, 2-High, 3-Moderate, 4-Minor, 5-None ("used only in rare circumstances") — and governs CAB attention with: "The Risk/Impact is allows the CAB to concentrate on the highest two levels, 1 - Very High, 2 - High."

**Emergency CAB** *(ManageEngine)*

The ECAB "only consists of people who have the knowledge and skills to implement the change; rarely does it comprise top-level executives," and emergency changes receive "basic testing done to save time." On authority: "The change manager is the one who has complete authority to green-light or reject a change" — consistent with Freshservice's identical rule, making **CAB advises, change manager decides** a genuine cross-vendor convergence.

#### Recommendations

1. **Change models as data. (must)** Every vendor differentiates types by which states they traverse and what each gate requires, not by separate code paths. Encode `changeModels` with states, transitions, required fields and guards; Freshservice's Minor/Major split then costs nothing. Emergency's model must set `allowPastPlannedDates: true` — a verified vendor behaviour, not an invention.

2. **Shared approval engine. (must — highest-leverage item in the dimension)** Copy ServiceNow's Change Approval Policy literally: policy inputs (a record input plus custom typed inputs) → ordered decisions with conditions keyed on state and risk → approval definitions with action, approver source (dynamic field vs static), wait-for (first vs all — a **group-only** concept in ServiceNow) and mandatory. Ship a **Simulate** panel: showing which decisions fire against a real record is the demo. This is the same engine as §3.1 recommendation 3 — build it once.

3. **Deterministic risk scoring. (must)** Build to Freshservice's verified math (rule scores 1–10, weights summing to 100, unmatched parameter = 0, Highest severity / Weighted average, bands 0-25 / 26-50 / 51-75 / 76-100). Add ServiceNow's ordered first-match-wins Risk Conditions as an override layer. **Two fixes:** the "insufficient lead time = 3 days → High" default is *not* a documented ServiceNow value — ship it as a RelayHQ default you chose; and treat any clean 70/30 profile/survey weighting as your design decision. Keep the breakdown table (Parameter | Matched rule | Score | Weight | Contribution) — **showing the derivation is the entire value proposition** and the honest counterweight to JSM's opaque AI score.

4. **Conflict detection and schedule windows. (must)** Implement typed codes, not a boolean. Get the polarity right: inside blackout = conflict, outside maintenance = conflict. Offer both enforcement modes — Freshservice warns via mismatch errors, JSM hard-blocks — and beat JSM cheaply by making enforcement a per-window `enforcement: 'block' | 'warn'` plus a type-based exemption, since **JSM's blocking is all-or-none with no urgent-change exception**. Ship the 4 codes computable from dates, CI and assignee first; the 6 parent/child codes depend on a real CI hierarchy (§3.4 recommendation 7).

5. **CAB as definition + runnable meeting workbench. (should)** ServiceNow's CAB Workbench and Freshservice's CAB Huddle converge on: definition with members and recurrence → auto-populated agenda from a filter → live run mode with per-item decisions and notes → generated minutes on end. Use Freshservice's verified quorum (Anyone / Everyone / Majority). Stanford's "CAB looks at the top two risk levels only" is the right default agenda filter. **Do not cite ServiceNow's CAB Workbench field list as ServiceNow documentation in client-facing material.** **Add** ITIL 4's actual position: the change authority is a per-model pointer (group, role, field, or automatic rule), and CAB is one configuration of it, not the default. That is the differentiated story.

6. **Standard change templates on catalog items. (should)** ITIL 4's justification is verbatim and exact; ServiceNow's non-editable pre-populated template data is the exact implementation. The locked-grey-fields-with-a-lock-icon visual is the argument in one screenshot. **Drop the `std_change_*` table names from any spec.** **Add** ServiceNow's verified monitoring guidance — track usage frequency and unsuccessful outcomes so templates can be retired or temporarily withdrawn.

7. **Post-implementation review with real outcomes. (must)** Close code and the reopen-from-Closed path are verified, as is the "if not Successful, add deeper review" rule. Close code feeds ITIL 4's verbatim metric "change success/acceptance rate over period." **Note:** ServiceNow ships three close codes; a fourth `backed_out` is RelayHQ's own addition — fine, just don't attribute it. Auto-PIR-on-emergency is a reasonable inference from ITIL's emergency guidance, not a documented vendor behaviour.

8. **Typed, directional relationships. (must)** `incident.caused_by` and `incident.rfc` alone prove the point: same two record types, opposite directions, opposite meaning, separate fields. **Drop `problem_caused_by_change` as a claimed ServiceNow feature** — keep it as a RelayHQ link kind if you want it, labelled as your choice. **Do not cite** "Incidents Caused by Change" / "Incidents Fixed By Change" as verified ServiceNow related-list names.

9. **Rebuild Problem as a real record. (should)** The state labels are confirmed and the known-error/workaround definitions are verbatim. **Fixes:** numeric states (101–107), the read-only state field and the named side-transitions are unverified — design them as RelayHQ decisions. Render **known error as a flag/banner set when `rootCause` is populated**, not as a state in the flow — that is what the sources describe, and it is better UI. The Problem → Known Error → KB article → portal deflection loop is a good story; **do not attach a deflection percentage to it.**

10. **Release as change container. (nice)** Freshservice's definition is verbatim and its Build plan / Test plan / Link New / Existing Change / Detach model is confirmed. Drop the claimed Freshservice release list-filter names and the claimed ServiceNow "wider release of work" quote. A `releaseRollup` and a "Deploy disabled until every member change is Scheduled-or-later with no blocking conflicts" guard are RelayHQ's own design — and they are the good part.

11. **Change tasks. (should)** ServiceNow change task states are **six**, not five: Open, Work in Progress, Closed Complete, Closed Incomplete, Closed Skipped, and **Closed Failed** ("The task was performed but did not achieve the expected outcome"). Add it — it is exactly the state that makes the "cannot close Successful with a failed task" guard meaningful. Freshservice's lifecycle conditions (task completion / approval / mandatory fields) are the right model for gating Implement → Review.

12. **Metrics tiles. (nice)** All four cited ITIL 4 metrics are verbatim. Consider adding two more that also verified: **average time of change realization per change model** (which makes the change-models-as-data decision visibly pay off) and **change initiators' satisfaction with change timeliness**. Keep every tile click-through into a filtered list.

**Positioning note worth acting on:** JSM gates Change Calendar, freeze windows and AI risk assessment behind Premium/Enterprise, and its freeze blocking has no urgent-change exception. A prototype showing a working calendar, typed conflicts, and a *transparent* risk breakdown with per-window warn/block enforcement is differentiating on capability the market currently charges a tier upgrade for.

#### Not verified

- **ServiceNow timing column names** `start_date` / `end_date` / `work_start` / `work_end`. The auto-stamp behaviour is confirmed; the mapping is not.
- **`conflict_status` and `conflict_last_run`** result fields, a "Conflicts tab", and the claim that detection runs on save/submit when planned start, planned end or the affected CI changes.
- **The "3-day lead time → High" default** for the Insufficient lead time risk condition, and the date basis for lead-time calculation.
- **The example risk thresholds "0-10 Low, 11-15 Medium"** — illustrative, not shipped values.
- **"Since Madrid"** as the release that introduced Change Approval Policies.
- **"If one or more decisions match, ALL their related approval definitions are evaluated."**
- **`std_change_proposal`, `std_change_record_producer`, `std_change_producer_version`, `std_change_template`, `std_change_properties`** table names, and the "retire sets the template inactive" mechanic.
- **`cab_recommendation`** as a shipped field, and the semantics attributed to `cab_delegate` ("attends the CAB meeting to describe the change").
- **ServiceNow CAB Workbench details generally** — corroborated only by a third-party training site.
- **ServiceNow problem state integers** (New=101 … Closed=107, with 105 skipped), the **read-only state field**, and side-transitions **Re-Analyze / Cancel / Mark Duplicate / Accept Risk**.
- **`problem.rfc`** as the permanent-fix link, and the related lists **"Incidents Caused by Change" / "Incidents Fixed By Change"**.
- **The unsuccessful-change branch to Incident and Problem Management**, and **Release Management / CMDB dependency maps as upstream inputs** — these appear only in process-flow *images* in the ServiceNow guide, whose text layer contains no such content.
- **ITIL 4's "Change is not authorized" loop-back label** — Figure 3.2 is an image; the label is unverifiable.
- **JSM "Submitted" and "Closed" statuses** — named by no reachable source.
- **JSM deployment gating specifics**: the "Allow deployment" / "Prevent deployment" status strings, Bitbucket and CircleCI support, and the Premium-plan requirement. The feature is documented for Jenkins, GitHub and GitLab; the details are not verifiable.
- **The verbatim JSM "Change risk" field description** and the shipped option lists for Change risk and Change reason.
- **Freshservice release list filters** (Emergency / Completed / Incomplete / Unassigned Releases), and **per-type default status sets** beyond the doc's illustrative "Open, Planning, Awaiting Approval, and so on."
- **Freshservice per-type change-type definitions** (e.g. Minor = "website changes") — the four names are confirmed; the article gives no individual definitions.
- **The ECAB's "3-7 people"**, the retrospective-RFC "auditable trail" phrasing, and the five-item emergency retrospective checklist.
- **Stanford risk level 4 "explicitly includes pre-approved recurring procedures."**
- **All RelayHQ as-built claims** — asset criticality, hardware `locationId`, the inert Workflows tab, Problems as a flat seeded list, the catalog tree structure. The source tree was never read.
- **Any effectiveness claim.** Nothing here measures whether risk scores predict failures, whether CABs reduce incidents, whether known-error KB articles deflect tickets, or whether JSM's AI risk assessment is accurate.

---
### 3.3 ClickUp-style project and work management

**What this dimension establishes.** ClickUp's "feel" comes from four mechanics, not from feature count:

1. a per-location **Views Bar** where every view is a named, saved, pinnable object carrying its own group/sort/filter/column/subtask state, with an unsaved-changes prompt and an Autosave option;
2. **grouped collapsible sections** in List view where creating a task inside a group auto-inherits the group's value *and every active filter's value*;
3. a **status system with four groups** (Not Started / Active / Done / Closed) whose custom statuses are authored per Space/Folder/Subfolder/List and inherited down;
4. a **task modal with a fixed section order** plus a quick-link chip row showing counts above the title.

These were verified against the ClickUp help-centre article bodies retrieved through the Zendesk content API (`help.clickup.com/api/v2/help_center/en-us/articles/{id}.json`), since the rendered pages return 403 to automated fetches. Every article ID resolves to a real article and the great majority of quotations are genuinely verbatim. Three error classes turned up and are corrected inline: **counts drift even when the underlying lists are perfect** (23 custom-field types, not 24; 22 template properties, not 21); **enumerations get truncated** (three recur modes, not two); and **the weakest sourcing is where the vendor's docs were unreachable** (everything from `support.monday.com`).

#### Verified findings

**Hierarchy and limits.** Workspace "Contains your entire organization"; Spaces "Arrange your different workflows or types of work"; "Folders add an optional Hierarchy layer" and auto-create a List when made (so do Subfolders); Subfolders are "For more complex workflows"; Lists "Contain tasks that are part of the same project or goal" and can sit in a Space, Folder or Subfolder. Nested subtasks is a ClickApp an owner or admin must activate. Docs, Dashboards, Forms and Whiteboards are "Hierarchy items" alongside locations. *Corrections:* Checklist is **not** a Hierarchy layer, and "tasks cannot exist outside a List" is a fair inference but is never stated.

Hard limits, each confirmed in its own article: **1,000 subtasks** per task including nested; **250 checklists** per task; **500 items** per checklist; checklist item descriptions capped at **500 characters**; checklist items nest **5 levels** and show an expand/collapse arrow once a parent has 5 or more sub-items. List Info carries Start date, Due date, Description, Time Estimated (rollup), Time Tracked (rollup), Attachments, Priority, Assignee, Color/icon and Sharing & Permissions, and its description can be pinned to the top of any List view.

**Views and the Views Bar.** Every Space, Folder, Subfolder and List ships with a List and a Board view by default; the rest are added via `+View` with optional "Private view" and "Pin view" checkboxes. The 17-type roster is exact: List, Board, Calendar, Team, Gantt, Activity, Timeline, Workload, Mind Map, Table, Map, Dashboard, Whiteboard, Chat, Doc, Embed, Form. The Move-view dropdown offers exactly Everything / Space / Folder / Subfolder / List.

The ordering rule is verbatim: **Overviews first and "can't be moved", then pinned views and groups, then unpinned**, each band defaulting to creation order and reorderable only within itself; once full, "additional views are saved in a Views Bar dropdown. The number of additional views is displayed next to the menu." The right-click menu matches item-for-item, including "Export view — Only available for List and Table views" and "Set as default view: On the Business Plan and above." Three access tiers: Public, Private, Publicly shared.

**Dirty-tracked view state.** Verbatim: "When changes are made to a view, a popup will appear in the lower-right providing the option to Save the view. Click Autosave view if you would like all new changes to save automatically." Spaces carry Default View Templates (Space settings → Default views → Default View Templates) applying to new views, with an option to force-apply to existing required views.

**Control bar and grouping.** The control bar exposes exactly Group, Show subtasks, Columns, Filter, Filter by assignee, Show closed tasks, Use Me Mode, Search, Customize. Group by is available on List, Board, Timeline, Table and Workload, over Status, Assignee, Priority, Tags, Due date, Task Type, and Dropdown / Rating / Checkbox / Date / Users / Labels Custom Fields, plus Custom Relationships in List view only. Board additionally supports **Subgroups** — "add rows alongside the columns on a Board view." A List-only single-value toggle ("One assignee per group" / "One tag per group" / "One label per group" / "One person per group") is **off by default in every view** and saved with the view; Board does not include it. Groups collapse from the group's ellipsis menu.

**The inheritance interaction — the headline mechanic.** Verbatim: **"When a view is grouped or filtered, any tasks you create from the view will have their fields set to match the group and filter automatically."** Auto-set fields are exactly Status, Dropdown, Priority, Tags, Label, Number, Rating, Text, Long text, Checkbox, Start date, Due date, Status is closed, Task type. Two entry points: "Add task" upper-right, and "Add task at the bottom of a group of tasks." A "New" button at the bottom of a grouped List creates a new *group value* inline — type a name, press return, and the group renders with an add-task row; the color square opens a picker, and "Advanced settings" jumps to the Edit statuses modal.

**Columns and calculations.** Add/remove via the "+" at the right of the last column with an "Add existing" tab of per-field toggles; drag headers to reorder; header menu offers "Move to start" / "Move to end"; drag either side of the header to resize; visibility is saved per view. Footer calculations by field type: Count / Count values / Count unique values / Count empty; Percent / Percent empty / Percent not empty; Dates: Range / Earliest date / Latest date; Numerical: Sum / Average / Range / Min / Max / Median. Results render per group with a whole-column total on click. Verbatim: "Tasks that are excluded due to a filter will not be included in the column calculation. Time estimates and time tracked that rollup from subtasks to parent tasks are always included… including… closed subtasks, even when closed subtasks are not displayed."

**Subtasks in the grid.** Exactly three modes across List, Board and Team view — Collapse all (default), Expand all, As separate tasks — with the hard rule verbatim: **"Displaying subtasks as separate tasks is required when filtering subtasks."** Restated verbatim for Gantt and for Table ("Any grouping, sorting, and filters are also applied to subtasks"). Inline creation: in List, hover the task and click the plus icon, name it, press Enter; in Board, hover the card and click the "+ Add task" icon. Dragging one task onto another converts it, and "A bold line shows where the task will be moved."

**Customize vocabulary.** List options: Show empty statuses, Wrap text, Show task locations, Show subtask parent names, Hide tags from task name, Show closed tasks. More options: Pin description, Show task properties, Show closed subtasks, Show tasks from other Lists, Show subtasks from other Lists, Default to Me Mode, Duplicate view, Reset view to defaults, Default view settings. "Show task properties" is verbatim "Display icons for task properties next to the task name, including description, attachments, checklists, and dependencies." A "Hide" control temporarily removes the view header. Board's equivalent adds Card size (Small / Medium (default) / Large), Card cover (None / Image (default) / Task description), Stack fields, Show empty fields, Collapse empty columns, Show column colors.

**Custom Fields — count corrected to 23.** Button, Checkbox, Date, Dropdown, Email, Files, Formula, Labels, Location, Money, Number, People, Phone, Progress (Auto), Progress (Manual), Rating, Relationships, Rollup, Signature, Text, Text area (Long Text), Voting, Website. Per-type config: Dropdown/Labels up to 500 options with Required field, Default value, Order of options, Colors for each option, Auto or manual sort; Money adds Currency; Rating adds Emoji type and "Rating number 1-5"; Progress (Manual) adds Start/End value; Progress (Auto) tracks Subtasks / Archived subtasks / Checklists / Assigned comments with three "Tasks without action items" rules, and "Nested subtask progress is not included in Progress (Auto) rollup." **Text caps at 2,048 characters, Long Text at 50,000.** API `type` strings: url, drop_down, labels, email, phone, date, short_text, text, checkbox, number, currency, tasks, users, emoji, automatic_progress, manual_progress, location.

Rendering differs per view: List/Table as columns via the "Add existing" panel; Board and Calendar via a "Fields" toggle list in Customize, each carrying the caveat that not all Custom Fields can be displayed there. On tasks, verbatim: **"only pinned, required, and Custom Fields with data in them are displayed… in alphabetical order unless a Workspace owner or admin has decided to sort Custom Fields manually,"** with a "Show" affordance below the table.

**Status groups.** Verbatim: "There are three default task status groups. Not Started is a fourth status group that is activated through a ClickApp." Also verbatim: "Complete is the default Closed status"; **"You can't create custom Closed statuses, but you can rename them"**; "You can create custom statuses for any status type except Closed." Done = "Tasks that are done, but need to remain open… **Tasks in this status group are not considered overdue**… **Any Dependencies are cleared when this status is applied.**" Not Started statuses "will always be shown on views even if there are no tasks with this status." Inheritance is exact: Folders and Lists inherit the Space's; Subfolders inherit the parent Folder's if it has custom statuses activated, else the Space's; Lists inherit their Folder's; Lists outside Folders inherit the Space's. A task moved to a List with different status colors "will retain the color from the original List." The Show status progress ClickApp replaces the status dot with a pie chart filling as the status approaches done or closed.

**Dependencies.** Exactly two types — Blocks, and Blocked by / waiting on. Chip position is verbatim: **"Once a dependency has been added, dependencies are displayed above the task description."** Creation paths: the Related section's "Relate items or add dependencies" → "This task blocks" / "This task is blocked by"; the task ellipsis → Relationships; hovering an existing chip and clicking the plus; slash commands `/blocking`, `/waiting`, `/link to`; and drawing a line between bars in Gantt. Delete in Gantt by clicking the connection then the x. "Clear all dependencies" exists and is permanent. Dependency Warning ClickApp, verbatim: "Before closing a task that is waiting on another task, ClickUp can display a warning message." Rescheduling: dependents "will be moved earlier or later by the same number of days," and the two preconditions are verbatim — **"The blocking task must have a due date set. The blocked task must have a start date set."** Dependencies stay visible after Done or Closed.

**Milestones, priority, effort.** "Milestones are a custom task type," identified by a diamond next to the task name and rendered as a diamond in Gantt; set from the task ellipsis → Task Type, the row ellipsis in List/Board/Calendar, the Gantt sidebar right-click, or the task-type control in the upper-left of an open task. Filterable by Task type and by a dedicated Milestone filter (is / is not). Gantt color rules, verbatim: "Blue tasks are Active, green are Closed or Done, and yellow are Milestones," and under Status coloring "Milestones are yellow until they are Done or Closed."

Priority is a fixed four-level enum — Urgent, High, Normal, Low — and verbatim **"It's not possible to customize Priority labels and colors."** Placement, verbatim per surface: upper-left of the task modal, right side of a List row, lower-left corner of a Board card, hover-revealed when unset. *Correction:* the integer mapping is only partly documented — the API types `priority` as a nullable int32 with no label mapping, and only `{"id":"3","priority":"normal"}` is directly evidenced. Treat 1=Urgent / 2=High / 4=Low as inferred, and priority hex colors as a design choice.

Three distinct effort models:
- **Time Estimates** — workspace hours-per-day setting, a "show in hours" checkbox, per-assignee on Business and above, subtask rollup.
- **Sprint Points** — editable value list; "Nested subtask Sprint Points rollup to the top level parent task. They don't roll up to their respective subtasks"; Points per Assignee sums across assignees (Sam 5 + Alex 8 displays 13) and removing an assignee removes their points unless they are the last one; `/pts`.
- **Duration** — enter two of start / due / duration and ClickUp computes the third; `e10d` sets an elapsed duration counting weekends and holidays versus a working-day duration that skips them; a "Skip non-working days" toggle converts between them.

**Task modal.** Verbatim: **"For tasks with subtasks, relationships, checklist items, assigned comments, or attachments, you can see the count of each type of item above the task title. Click an icon to quickly scroll to that section of the task."** And: "Task fields are displayed below the title, above the task description. Fields that are not set can be shown or hidden. Click More to show all available task fields." Always-present fields: Status, Dates, Assignees, Tags; ClickApp-gated additions: Priority, Sprint Points, Time estimates, Track time, Dependencies. Collapsible sections appear in exactly this order: **Custom Fields → Subtasks → Related → Checklists → Assigned comments → Attachments**, each with a full-screen expand icon. Three layouts — Full screen, Modal ("Clicking outside the task modal will close the task"), Sidebar mode (default when opening from the Planner) — switched from an upper-right "Switch layout" button and remembered as a per-user preference. A left subtask sidebar with up/down arrows navigates between parent and children.

**Gantt.** Six time scales — Day, Week ("By default, new Gantt views use the week time period"), Month, Quarter, Year, Flexible — with Cmd/Ctrl+scroll zoom. A Hierarchy sidebar with addable columns and a per-row plus to create; drag-to-schedule by hovering the target period, clicking, then dragging the start/end brackets. Node-drag dependency drawing; click-a-connection-then-x to delete. Milestones as diamonds. Progress, verbatim: "Progress percentage is calculated by the tasks completed divided by the total tasks in the Space, Folder, Subfolder, or List. The start and end of the progress bar are automatically set to the earliest start date and latest due date on tasks." Parent/subtask sync, verbatim: "The parent task's start date rolls up to the earliest subtask start date, the due date rolls up to the latest subtask due date, and the duration reflects the full span," with dragging a synced parent moving its subtasks and manual edits overriding. Baselines exist. **Critical Path**, verbatim: it "checks all tasks on the chart and determines the set that would affect the overall project deadline if adjusted… looks back from the last task to see which dependent task is blocking the deadline… each of the tasks will be added to the path (shown in red)"; **a time gap or missing dependency link breaks the chain, and the last task in a group is always highlighted.** Slack Time renders as a dashed bar. Weekends grey on the week scale. Sort fields are exactly Assignees, Custom Fields, Date Created, Date Updated, Due Date, Duration, ID, Index, Name, Priority, Start Date, Status, Time Estimate, Time Tracked. *Gate:* Critical Path and Slack Time are limited to 100 uses on Unlimited, unlimited on Business and up.

**Workload and WIP.** Verbatim: "each person's capacity is displayed in shades of red, yellow, or green." Backlog sidebar lists tasks that are "unscheduled, overdue, unassigned, or don't have a time estimate." Control bar left to right: Today, Workload Unit, Time period (Days, Weeks, Months, 14 days, 7 days), Workload Grouping (availability vs capacity), Group, Filters, Closed, Assignees, Me Mode, Search, Backlog, Settings. Grouping by Assignee, Team or List computes capacity; status/priority/tags/Custom Fields group but "won't calculate capacity." Primary and second-level grouping supported. Capacity modes: Daily Scheduled; Daily/Weekly/Monthly Availability; Weekly/Monthly Capacity. Worked example, verbatim: "if someone is available for 8 hours each weekday, a week with a Friday Workspace holiday shows 0 hours of daily availability on Friday and 32 hours of weekly capacity instead of 40." Weekly Capacity with unit=Tasks shows "capacity as a percentage and as the total number of tasks vs their total capacity."

Board's separate device is **Work in Progress Limits**: settable on Task Count, Time Estimate, Sprint Points, or Money and Number Custom Fields; the header pill reads count/limit (the docs' example is 6/10); green under, yellow with an exclamation mark nearing or at, red with an exclamation mark over, grey when no limit; **limits never block a drop.** *Gate:* Business Plan and above.

**Sprints.** Sprints are Lists inside Sprint Folders or Sprint Subfolders. Sprint statuses are verbatim "Not Started, In Progress, Done… separate from task statuses and cannot be customized," transitioning automatically on the start and end dates with a manual Mark as Done in between; **"Marking a sprint as done cannot be undone,"** and incomplete tasks can be moved to the next sprint. The status icon fills as the sprint progresses. Reporting cards confirmed, with two verbatim definitions: Cycle time = "how long on average it takes a task to be completed after it's moved to an Active status"; Lead time = "…after it's created." "Amount of work" options are exactly Tasks, Time Estimate, Average age of tasks, Sprint points. *Gate:* Sprint Cards are Business Plan and above.

**Recurring tasks — enumeration corrected.** Schedule vocabulary: Daily (skip-weekends option), Weekly, Monthly (Same day each month / First day / Last day / Default day, e.g. "second Wednesday"), Yearly, Days after ("Recurs a certain number of days after the task has been marked complete"), Custom. Verbatim rules: "Recurring tasks use the due date as the date when the task will recur"; "The start date will always recur the same number of days before the due date"; "If a recurring time is not set, the task will recur at 11pm in the timezone of the user who set up the recurring schedule." Limits: tasks with 500 or more subtasks will not recur; tracked time is not carried over; instances are never created in the past; tasks can recur on non-working days. *Correction:* the "Recur" mode has **three** options — **When complete**, **When done**, and **On schedule**. "When done" recurs when the task moves to a Done status *or* to a Closed status, which is exactly the mode that interacts with the Done/Closed split.

**Task templates — count corrected to 22.** "Import everything" versus "Customize import items" across 22 named properties: Assignees, Attachments, Checklists, Keep checked items, Comments, Copy settings for Statuses, Current task statuses, Custom Fields (Formula fields excluded), Dependencies, Description, Due dates, Duration, Followers, Links, Priority, Subtasks, Start date, Recurring settings, Relationships, Tags, Task Types, Time Estimate. **Applying is irreversible.** `/temp` applies from a task title or description and is available when creating a task in List, Board, Calendar, Timeline, Team, Whiteboard and Workload views. Lists can carry a default task template. The Remap Subtask Due Dates ClickApp shifts every subtask due date by the parent's delta. *Extra constraint:* applying a template fails outright if it would exceed the 1,000-subtask limit.

**Filters and sorting — count correct at 27.** Status, Tags, Due date, Priority, Assignee, Archived, Assigned comments, Created by, Date closed, Date created, Date updated, Date done, Dependency, Duration, Location, Recurring, Start date, Status is closed, Time estimate, Time tracked, Sprint Points, Follower, Milestone, Custom Fields, Task type, Last status change, Custom Relationships. Dependency is verbatim "See which tasks are waiting on or blocking others"; Milestone is is/is-not; "Today & Earlier" confirmed; Time estimate, Time tracked and Sprint Points each support greater-than / less-than / equal-to. List sort offers exactly 14 fields with a "Sort" versus "Sort entire column" distinction, drag-to-reorder sort precedence, and verbatim **"Dragging and dropping tasks inside of a group is disabled when sorting tasks in List view."**

**Table view.** "Every task is a row with a fixed height, and the fields are columns," with adjustable Row height under Customize → Layout options, pinnable columns, spreadsheet mode (click-to-edit) on by default, arrow-key cell navigation, and drag-to-fill from a cell's lower-right corner that **"will overwrite any existing values set on tasks."** Right-click copy options are exactly Cut, Copy, Copy with headers, Copy with group headers. Verbatim: "you can show or hide Tags which are always shown in List view." Export view is List and Table only.

**Calendar and Timeline.** Calendar periods are Day, 4 days, Week, Month (default). In Month, hover a day and click the plus; in every other period, click empty space at a time, and verbatim "The time you select becomes the task's due date. If the task already has a time estimate, it will span that length of time." Milestones show a diamond. Timeline is verbatim: **"The grouping, start, and due dates of a new task automatically update to match what is set for the group by row and date where the task is added"** — clicking in Sam's row assigns to Sam. Drag the left end for start date, the right end for due date, the bar to move both, and into another row to change the group-by value. A right-hand sidebar holds exactly Overdue and Unscheduled.

**Linear — the inverted model.** Verbatim: **"Teams can reorder statuses within each status category, but the categories themselves stay in a fixed order."** Categories are Backlog, Unstarted, Started, Completed, Canceled, with **Triage** documented as "an additional status category that acts as an Inbox for your team" and excluded from views by default — verbatim: "By default, we exclude triage issues from all views since triage is considered to be outside the normal workflow." *Correction:* **Duplicate is a system-managed status, not a sixth authorable category** — "its status is automatically changed to Duplicate — this is a system-managed status that cannot be renamed or customized." Default statuses per category are exact: Backlog → Icebox, Backlog; Unstarted → Todo; Started → In Progress, In Review, Ready to Merge; Completed → Done; Canceled → Canceled, Could not reproduce, Won't Fix. "By default, your first Backlog status will be the default status," and at least one status must remain per category.

Linear's entire view-config surface is one **Display options** popover: Layout; Grouping (status, assignee, project, priority, cycle, label, parent issue, team, customer, release, SLA status); Sub-grouping; Ordering (Status, Manual, Priority, Last created, Last updated, Due date, Link count); Show sub-issues; Show empty groups; and Display properties (ID, status, assignee, priority, SLA, project, due date, milestone, cycle, release, estimate, labels, links, customers, customer revenue, time in status, created date, updated date, pull requests and commits, Sentry issues). "Set as default" saves the configuration workspace-wide. Priority is a fixed five-value enum set with `P`, and no-priority sorts last. Estimate scales are team-level — Exponential 1/2/4/8/16, Fibonacci 1/2/3/5/8, Linear 1/2/3/4/5, T-Shirt XS/S/M/L/XL — with an **extended scale** adding two values each (+32/64, +13/21, +6/7, +XXL/XXXL) and T-shirt sizes mapping to Fibonacci numerically. Both parent/sub-issue auto-close automations exist.

**monday.com — column types confirmed, merchandising not.** The column type genuinely is monday's unit of extensibility, and every named type exists per `developer.monday.com`'s column-types reference: Dependency, Connect boards, Mirror, Timeline, Tags, Rating, Button, Dropdown, Location, Doc, Country, Color picker, Week, Hour, Vote, Formula, Progress tracking, Creation log, Last updated, Item ID, Auto number, Time tracking and the rest, split across supported, read-only and calculated categories. Hierarchy confirmed as Workspace → Folder → Board, and within a board Groups → Items → Subitems with Columns as the field axis.

Dependencies: the **four types exist** — verbatim, "The dependency relationship type (Finish-to-start, Start-to-start, Finish-to-finish, Start-to-finish) is configurable per dependency in the monday.com UI but is not currently exposed by the API" — and a `dependency_mode` setting offers **Flexible / Strict / No action**. *Correction:* the semantics are **contested**. The only reachable source defines Flexible as shifting dates "but allows some overlap" and Strict as "enforces strict sequencing — the dependent item cannot start until its predecessor is fully complete," which inverts the original research's gloss. **Do not implement from either wording without checking the live product.**

**Asana — the most precisely correct section.** `resource_subtype` is exactly {`approval`, `custom`, `default_task`, `milestone`}, with the useful extra rule that milestone-subtype tasks **"cannot have a start_date."** `approval_status` is exactly {`approved`, `changes_requested`, `pending`, `rejected`} and stays synchronised with the `completed` boolean. Dependencies split into read-only `dependencies` and `dependents` arrays. `memberships` is "Array of projects this task is associated with and the section it is in," each entry pairing a ProjectCompact with a nullable SectionCompact — **genuine multi-homing**. Custom field `type` = text, enum, multi_enum, number, date, people, reference; `representation_type` adds `custom_id` and `formula`; `input_restrictions` for reference fields is exactly goal / portfolio / project / task. Project views are List, Board, Calendar and Timeline, and "Timeline (Gantt) views require Starter, Advanced, or Enterprise plans."

#### Recommendations

1. **Per-project Views Bar with saved, named, pinnable views. (must)** This is the affordance that makes ClickUp read as ClickUp. A view is a first-class object carrying group/sort/filter/columns/subtask-mode, with the documented dirty-state prompt to copy verbatim ("Save" / "Autosave view", lower-right). Build the ordering rule exactly — overviews pinned first and immovable, then pinned, then unpinned, then a `+N` overflow chip whose number is the count of hidden views. Demo beat: "My Sprint", "By Owner", "Overdue Only" as three chips snapping one project into three shapes.

2. **Custom statuses in four status groups, authored per project and inherited. (must)** The two behaviours carrying the most demo weight: Not Started statuses always render even when empty (a board never looks broken), and Done statuses are not overdue **and clear dependencies**. Ship the disabled "+ Add" under Closed with the tooltip lifted verbatim: "You can't create custom Closed statuses, but you can rename them." Derive `isOverdue = dueDate < now && group !== 'done' && group !== 'closed'` **from the group, not from a status name.**

3. **A real List group contract. (must)** Sticky header with collapse, ellipsis menu, an inline "+ Add task" that inherits group **and** filter values, and column footer calculations. The inheritance rule is the single best-verified mechanic in the dimension — build it to the letter, seeding from the documented auto-set field list. **Caveat:** a per-group task *count* badge is **not** a documented ClickUp feature. Build it because it is good design, not because ClickUp specifies it.

4. **Dependencies with a blocked-close warning. (must)** Two types only, chips **above the task description**, a permanent "Clear all dependencies", and a close-time warning modal. Implement rescheduling with **both** documented preconditions or it will misfire: the blocking task must have a due date **and** the blocked task must have a start date; then shift dependents by the same number of days.

5. **Gantt with dependency arrows, milestone diamonds, critical path and slack. (must)** Highest wow-per-line, and pure client-side geometry. Implement the documented critical-path rule: walk back from the last task through dependency edges, adding a task only when there is **no time gap**, and always highlight the last task in a group. Slack renders as a dashed bar; milestones as rotated squares, not bars.

6. **Custom fields engine. (should)** Mirror ClickUp's groupable set exactly — dropdown, rating, checkbox, date, people, labels — and copy the task-modal display rule verbatim: only pinned, required and non-empty fields show, alphabetically, with a "Show" link revealing the rest. The catalogue is **23** types; trim the model accordingly. This is the same registry as the subform builder (§3.6 rec. 4) and asset Fieldsets (§3.4 rec. 15) — build it once.

7. **Subtask display modes. (should)** Three modes with the hard rule surfaced in the UI as a one-line explainer under "As separate tasks": *Required to filter subtasks.* That constraint is real, restated across three separate articles, and teaching it in the interface reads as fidelity.

8. **Restructure the task modal to the documented section order. (should)** Counts chip row above the title; fields row below the title and above the description with a "More" link for unset fields; then **Custom Fields → Subtasks → Related → Checklists → Assigned comments → Attachments**, each with a full-screen expand icon; then activity. Add the Full screen / Modal / Sidebar switcher as a remembered per-user preference. *Trim:* the right-hand relationships sidebar and the resizability of either rail are **not** documented — build them if you want them, but not "because ClickUp does."

9. **Milestones as a task type, priority flags, three effort models. (should)** Place the priority flag exactly where ClickUp places it so muscle memory transfers. Keep priority labels non-customizable — but the integer mapping is inferred, so do not present `1=Urgent…4=Low` as an interoperability contract, and treat priority colors as your own design decision. Keep the three effort models genuinely distinct; the `e10d` syntax and the "Skip non-working days" toggle are real and cheap.

10. **Workload with a unit switcher and backlog rail. (should)** Verified in detail, including the red/yellow/green banding and the backlog's four buckets. Justify it on demo value ("is anyone drowning?" is a question a board cannot answer), **not** on any claim that it improves resourcing.

11. **Board card customisation plus WIP limits. (nice)** Small / Medium (default) / Large, cover None / Image (default) / Task description, Stack fields, Show empty fields, Collapse empty columns, Show column colors; and the counter pill with green / yellow-with-! / red-with-! / grey, **never blocking the drop**. Sub-grouping as swimlane rows is also confirmed.

12. **Sprints as date-driven lists with burndown and spillover. (nice)** The lifecycle is trivially derivable from dates and is non-customizable in ClickUp, so hardcoding Not Started / In Progress / Done is faithful, not lazy. The "Mark as Done → move 4 incomplete tasks to Sprint 12?" modal is real product behaviour and irreversible in ClickUp; decide deliberately whether the prototype copies that irreversibility.

13. **Templates and recurring tasks. (nice)** Build the include-list with **22** items. Implement **three** recur modes — When complete, When done, On schedule. "When done" is the one that exercises the Done-vs-Closed status groups, so dropping it would quietly break the coherence with recommendation 2.

14. **Table view as the spreadsheet escape hatch. (nice)** Fully verified, including drag-to-fill overwriting existing values and the four copy variants. Shares most of its code with the upgraded List; the differences are fixed row height, no group separation by default, and cell-level focus.

#### Not verified

- **Per-group task counts in ClickUp's List view.** Collapse, the ellipsis menu and the bottom-of-group add row are documented; a count badge is not, across all three relevant articles. The only documented numeric badge on a group header is Board's WIP counter.
- **ClickUp's priority integer mapping beyond 3=Normal.** The API types `priority` as a bare nullable int32.
- **ClickUp priority hex colors.** Never published; the API example returns `#f8ae00` for Normal, conflicting with widely circulated community values.
- **The task modal's right-hand relationships/links sidebar, and resizability of either rail.**
- **Any maximum nesting depth for ClickUp subtasks.** The 1,000-subtask cap includes nested ones, but no depth limit is documented. (Checklist items are separately capped at 5 levels.)
- **The integer meaning of `type` in ClickUp's API dependency objects.** Model with named strings (`depends_on` / `dependency_of`).
- **ClickUp Mind Map mechanics** beyond the one-line description.
- **Everything sourced to `support.monday.com`** (403 to every method): Column Center tab names (Essentials, Super useful, AI-powered, Team Power-Up, Board Power-Ups, Combo) and column-to-tab assignment; one Dependency column per board; binding to a chosen Date or Timeline column; signed lead/lag in the Dependency column; the 50-item batch-chaining limit with Undo. The column types themselves *are* confirmed via `developer.monday.com`.
- **monday's Flexible/Strict dependency-mode semantics** — actively contested. Verify in the live product before implementing.
- **A monday "sub-folder" tier.** The API documents a single folder level within workspaces.
- **Linear's sub-issue nesting depth limit** and the visual of parent progress rollup.
- **Asana's List view UI specifics** (section headers, field visibility controls, inline add). The Asana findings rest on the developer API object model plus marketing pages.
- **The entire RelayHQ as-built baseline for this dimension.** No code was found at the path the original research cited.

---
### 3.4 IT asset management, CMDB, and software license management

**What this dimension establishes.** Every credible ITAM product separates four things RelayHQ currently collapses, and all four separations survived verification:

1. **Catalog Model vs Asset instance.** Snipe-IT attaches custom-field Fieldsets at the asset-model level and separates Model Name / Model Number / Category / Manufacturer from Asset Tag / Serial / Status. Atlassian states it explicitly with two root object types, `Hardware assets` and `Model`: "Each `Hardware asset` will contain attributes with its own serial number, its stock number, owner, and a *reference* pointing to the `Model`. The `Model` for this asset will hold information like memory, manufacturer, and technical specifications."
2. **Financial Asset vs operational Configuration Item.** ServiceNow keeps `alm_asset` — "to assist with tracking through financial, contractual and leasing lifecycles" — distinct from `cmdb_ci`, "to track operational and relationship information," with Model Categories driving paired creation.
3. **Four separate ownership roles.** Assigned to (end user), Owned by (business manager), Managed by (IT manager) and Supported by (group) are four distinct CI fields; checkout in Snipe-IT is genuinely polymorphic to `asset | location | user`.
4. **Entitlement vs allocation vs installation.** This is what makes a compliance position and a true-up number computable.

RelayHQ's current shape — Hardware with `assignmentType person|location`, Software with `licenseType per_user|per_location|per_key`, flat Locations — is a single-table simplification of a five-table domain.

**Source-quality note specific to this dimension.** A large share of the ServiceNow material comes from community-authored blogs and forum threads rather than `docs.servicenow.com`. Several ServiceNow "field name" claims are **form labels, not table columns**. Attribution matters more than usual here.

#### Verified findings

**Catalog and identity**

- **Snipe-IT separates the catalog model from the asset instance.** Fieldsets attach to asset models, not individual assets, and the import schema carries Model Name / Model Number / Category / Manufacturer distinctly from Asset Tag / Serial / Status / purchase / assignment data.
- **Atlassian's ITAM schema does the same, explicitly.** Root types `Hardware assets` (children: Phones, Laptops, Servers, Printers) and `Model` (children: Hardware models, Model categories, Software models), with the rationale quoted above.
- **Asset tag vs serial are different identities.** Snipe-IT: "Assets in Snipe-IT are anything that have an asset tag. Asset tags are always unique." Freshservice: serial number is "a unique identifier provided by the manufacturer," while the asset tag is "either set by the system while creating an asset (editable) or added by the user." **Track both; identify by your own number.**

**Lifecycle and status**

- **Snipe-IT models lifecycle as user-defined Status Labels carrying one of four types** — deployable, pending, undeployable, archived — with behavior driven by the type, not the name. `Statuslabel::getStatuslabelType()` resolves the type from boolean flags. Checkout is restricted by the validation rule `exists:status_labels,id,deployable,1`; **check-in accepts any status**, explicitly to accommodate maintenance, repair and retirement workflows.
- **ServiceNow uses a two-level State + Substate model.** State answers "where in its life," substate answers "why." The allowed-substate table is verified verbatim — but **against a ServiceNow Community article covering the Zurich release, not official documentation.** Use it as a well-corroborated seed list, not a spec:

  | State | Allowed substates |
  |---|---|
  | On Order | *(none)* |
  | In Stock | Available, Reserved, Defective, Pending repair, Pending install, Pending disposal, Pending transfer, Pre-allocated, On hold, Legal hold, Quarantine, Pending fulfillment, Pending certificate, Pending return, Test, End of support, Pending retirement, Pending resale, Pending evaluation |
  | In Transit | Available, Reserved, Defective, Pending install, Pending disposal, Pending donation, Pre-allocated, Pending resale |
  | In Use | Pending fulfillment, End of support, Pending retirement |
  | In Maintenance | *(none)* |
  | Retired | Disposed, Pending disposal, Sold, Donated, Vendor credit, Lease return, Obsolete, RMA, Buy out, Pending resale |
  | Missing | Lost, Stolen |
  | Build | *(none)* |

- **Freshservice ships exactly five asset states and they are user-extensible:** In Use ("currently being used by somebody in your organization"), In Stock ("readily available for use"), In Transit ("ordered from a vendor or is being moved"), Missing ("isn't being used but cannot be used since it's missing"), Retired ("too old or isn't functional"). Custom states are added under **Admin > Asset Management > Asset Types & Fields**, or **CI Types & Fields** on multi-workspace accounts.
- **Asset State/Substate drives Install status on the linked CI** via the Asset CI Install Status Mappings table; **Operational status is deliberately not synced** and remains independent of the asset's financial state.

**Ownership and custody**

- **Snipe-IT checkout is polymorphic to three target types.** `checkout_to_type` is validated `required|in:asset,location,user`, with `assigned_user` / `assigned_asset` / `assigned_location` under a `required_without_all` rule; the asset persists `assigned_to` + `assigned_type` as a polymorphic relation. Checkout captures `expected_checkin`, sets `last_checkout` and increments `checkout_counter`; check-in increments `checkin_counter`. **Checkout-to-asset** is how you model a dock or monitor attached to a laptop; checkout-to-location models a conference-room TV.
- **ServiceNow separates four ownership roles** on a CI: Assigned to (end user), Owned by, Managed by, Supported by / support group, with Location, Department and Cost center separate again. Form hint text distinguishes Owned by as "Business manager" from Managed by as "IT manager." **Important qualifier: ServiceNow's own documentation gives minimal guidance on these semantics and practitioners report inconsistent usage — the *fields* are product structure, the *meanings* are convention.**
- **Freshservice separates user from managing agent from owning department at the API level:** `user_id`, `agent_id`, `department_id`, `group_id`, `location_id`, alongside `id`, `name`, `description`, `asset_type_id`, `asset_tag`, `impact` (integer: Low=1, Medium=2, High=3) and `usage_type`. `usage_type` has two values: **Permanent** ("all assets which can not be shared or loaned for a specific time range") and **Loaner** ("shared asset like Projectors, etc, which can be loaned for a period of time").

**Location**

- **Snipe-IT distinguishes home location from current location, and current location is derived.** GitHub issue `grokability/snipe-it#4307` proposes an `effective_location_id` column precisely because it is computed today, and states the rule: "9 times out of 10, the asset is either checked in and lives in its `rtd_location_id`, or it's checked out to a person and thus it is at that user's `location_id`."
- **Snipe-IT locations are a self-referencing tree.** The Location model has `parent_id`, `parent()`, `childLocations()` and a recursive static `getLocationHierarchy()`. Editable/importable fields: Name (the only required field), Address, Address 2, City, State, Country, Zip, Phone, Fax, Currency ("Default currency for this location"), Notes, Company. **Note for implementers: parent location is not in the importable field list** even though `parent_id` exists on the model.

**Custom fields**

- **Snipe-IT's custom-field system is a reusable Fieldset attached at the Model level**, with a per-fieldset required flag and per-fieldset ordering — so the same field can be optional on one model and required on another. Validation formats: ANY, ALPHA, ALPHA-DASH, NUMERIC, ALPHA-NUMERIC, EMAIL, DATE (per PHP `strtotime`), URL, IP, IPV4, IPV6, MAC, BOOLEAN, and CUSTOM (regex-prefixed). Documented caveat: encrypted fields become **"unsearchable and unable to be sorted on in the database."**
- **Atlassian gives a precise attribute-type vocabulary:** Text (max 255 chars), Boolean, Integer (−2,147,483,648 to +2,147,483,647), Float, Date, DateTime, URL (must start `http://` or `https://`), Email, Textarea (max one million characters), Select, IP Address (IPv4); reference types Object, User, Group, Project, Status, Bitbucket. Two rules worth copying outright: **"Each object type can have a single parent object type and multiple child object types"**; abstract object types **"can't contain any objects of their own but can pass their attributes to their children"**; and attribute inheritance **"must be enabled before creating child object types"** and **"cannot be enabled on an object type that currently has children."**

**Procurement, warranty, depreciation**

- **Snipe-IT's importable asset field list is a good minimum viable hardware record:** ID, Asset Tag, Name, Serial, Model Name, Model Number, Category, Manufacturer, Company, Status, Notes, Requestable, Warranty Months, BYOD, Supplier, Order Number, Purchase Date, Purchase Cost, Location, Default Location, Checkout Type, Checkout Target, Last Checkin, Last Checkout, Expected Checkin, Last Audit Date, Next Audit Date, EOL Date — plus arbitrary custom-field columns and Full Name / Username / Email / Location Name as checkout targets. **Warranty is stored as months off purchase date**, with `warrantee_expires()` computing the date and `eol_date()` computed from the model's EOL period.
- **Snipe-IT publishes three depreciation methods and the exact linear formula:** Linear (straight-line), Half Year Convention (Conditional), Half Year Convention (Unconditional). The formula is literally `$current_value = $cost - ($cost - $floor) * ($months_passed / $months_total);`, with `$floor` as the minimum retained (salvage) value.
- **ServiceNow supports straight-line and declining-balance depreciation** (straight line = purchased value / life of asset; declining balance calculated on the remaining balance each period). *(Community forum source.)*
- **Lansweeper's lifecycle model is about vendor timelines, not internal custody states:** End of Sale, End of Support and a Milestone date, "the most relevant date based on the asset's current stage," surfaced per-asset under Risk insights > Lifecycle and org-wide as two rollups — Hardware lifecycle (keyed on **Model and Manufacturer**) and OS lifecycle (keyed on OS). **This is model-level data, which is an independent argument for the Model/Asset split.**

**CMDB and impact**

- **ServiceNow CI relationships are typed, directional and stored as parent/child rows.** Types live in `cmdb_rel_type` as `forward::reverse` pairs; instances in `cmdb_rel_ci`. Confirmed OOB pairs include Depends on::Used by, Hosts::Hosted on, Runs on::Runs, Member of::Members, Connects to::Connected by, Contains::Contained by, Exchanges data with::Exchanges data with, DR provided by::Provides DR for, Virtualized by::Virtualizes, Managed by::Manages. "From the context of a given CI, its parents are considered upstream by nature of this table relationship," and children are downstream — **but the same threads caution that OOB labels are sometimes reversed or inconsistent**, so impact direction must be a property of the relationship type, never inferred from parent/child alone.
- **Freshservice publishes an explicit upstream/downstream relationship table — 23 pairs**, a ready-made seed list: Used By/Uses · Received Data From/Send Data To · Runs/Runs on · Connected to/Connected to · Subscribed by/Subscribes to · Impacts/Impacted by · Submits/Submitted by · Supports/Supported by · Written By/Author of · Hosts/Hosted On · Enables/Is enabled by · Includes/Member of · Contains/In Rack · Houses/Located In · Exchanges data with/Exchanges data with · Managed by/Manages · Owned By/Uses · Virtualizes/Virtualized by · Is Edited by/Editor · Backed Up by/Backed Up by · Are part of/Consists of · Attached to/Contains · Sends data to/Receives data from. Custom types are added "by giving it a name and an equivalent inverse relationship." **Note the symmetric pairs** (Connected to, Exchanges data with, Backed Up by) where forward and reverse are the same string. **"Depends on / Used by" is ServiceNow's, not Freshservice's** — do not attribute it to the Freshservice table.
- **Impact analysis is a graph traversal, done two ways.** ServiceNow: when the include-affected-CIs property is true, impacted services are retrieved from the service-to-CI association table `svc_ci_assoc`, "a faster process as well as this returns a more concise relationship picture"; when false, the system walks the CMDB tree via `CIUtils.servicesAffectedByCI` to **a maximum depth of 10 levels**, which can time out on large CMDBs. Freshservice: a Relationships tab renders a map that "shows all parent and child CIs that are associated with a particular CI," used to "track dependencies and foresee the impact of Changes."

**Software licensing**

- **Snipe-IT materializes license seats as individual rows.** "When you create a license with 50 seats, Snipe-IT automatically creates 50 individual seat records that can be assigned independently." Seats carry `license_id` plus `assigned_to` (user) and/or `asset_id`. The UI reports Total Seats, Assigned Seats, Available Seats and **Unreassignable Seats** (seats from non-reassignable licenses already distributed, which can never be reclaimed).
- **Two Snipe-IT license flags change the economics:** `reassignable` (a checked-in seat returns to the pool, vs a user-locked seat that is burned) and `maintained` (an active support/maintenance contract, tracked separately from expiration). `termination_date` is the subscription cancellation point, distinct again from `expiration_date`. Also present: `min_amt`, `licensed_to` name/email, and `serial` stored encrypted.
- **ServiceNow SAM Pro computes compliance as rights owned minus rights used and converts the gap to currency.** Entitlements data "is reconciled with your software installations and the licensing rules engine of SAM Pro to determine if you are compliant or not," with results surfacing at three tiers — Product, Software Model, License Metric — and rolling up to Publisher. The published true-up formula: **True Up Cost = actionable rights count × average cost per right + total active reserved entitlement cost**, where average cost per right is an override license cost on the software model if set, otherwise the entitlement's unit cost; **for SaaS, "License cost applies. The License and maintenance cost does not apply."**
- **The license metric is the unit of measure, and choosing it wrongly inverts the answer.** Six common metrics: Per User, Per Named User, Per Device, Per Named Device, Per Core, Per Processor. Metric groups: Common; publisher-specific packs (Microsoft, Oracle, IBM, Adobe, SAP, VMware, Citrix); Concurrent Licenses; Subscription/Consumption; Custom; Resource Consumption. The warning is explicit: **"Selecting Per Device instead of Per Named User for the same entitlement will give you an entirely different compliance position — one may show you over-licensed, the other may show a shortfall."**
- **Entitlement, allocation and installation stay distinct in SAM Pro.** Entitlement fields include purchased rights, allocated rights, rights used, Publisher Part Number, unit cost, license type, related base entitlements and CAL records. Allocation tabs differ by metric (User Allocations vs Device Allocations). Allocations are "a way to prioritize license assignment for specific hosts, virtual machines, users, devices etc. as per the organization's licensing strategy" and let managers override SAM Pro's automatic assignment — **i.e. an allocation is an intent, an installation is a fact.**
- **Concurrent (floating) licensing is measured against peak simultaneous usage, not headcount.** Concurrent licenses are "shared among a pool of users" and "limit the number of simultaneous users rather than the total number of users"; a license server issues a token on request and reclaims it when the user finishes, and "if all the licenses are in use, an employee must wait." Planning uses a concurrency ratio — Ivanti's published illustration is **3:1**, explicitly noted as varying by organization. **Compliance for a concurrent entitlement is therefore a time-series max, not a count of assignments.**
- **Freshservice's license model is coarse and its compliance is per-device only.** Default types: Volume ("specify a certain number of permitted installations within the organization"), Enterprise (company-wide, all devices), Trial (no installation limits for the duration), Opensource (unlimited installations), Free. Duration is Fixed Period or Perpetual. The documentation states plainly: **"Freshservice supports per device licenses for calculating software compliance."** This is a real, documented capability gap RelayHQ can beat.

**Contracts, alerts, reporting**

- **ServiceNow keeps contracts in `ast_contract` with a state machine and a nightly job.** States: Draft → Active → Expired, plus **Canceled**; renewal is handled through substates (Awaiting Review, Renewal Approved, Extension Approved). The nightly **"Contract Compliance Checks"** scheduled job activates approved contracts on their start date, renews eligible contracts, and expires active contracts at end date. **Freshservice's default contract types are just three: Lease, Maintenance, Software Licence.**
- **Expiry alerting in practice is one configurable day-threshold that fans out.** Snipe-IT: "if you set a value of 60 days here, you would begin to get alerts about expiring assets or warranties starting 60 days before they expire," plus a "Send Alerts To" address accepting a comma-separated list. `snipeit:expiring-alerts` covers both assets whose warranties are about to expire and licenses reaching their expiration date; a **separate** inventory alert fires when "an accessory, consumable or component is reaching the inventory threshold specified in your settings."
- **Snipe-IT ships five pre-defined reports** — Activity, Audit, Depreciation, License, Accessory — **plus a custom report builder with over 95 selectable fields** grouped as Basic Asset Info, Asset Details, Location Data, User Information, Date Fields and dynamically generated Custom Fields. *(via DeepWiki, a generated third-party wiki rather than vendor docs.)*
- **Snipe-IT treats assets, accessories, consumables and components as four separate entity types** with distinct import paths, distinct API endpoints, and distinct inventory alerting. The taxonomy is real; the per-type behavioural semantics are inference (see Not verified).

#### Recommendations

**1. Split the catalog Model out of the Asset (Manufacturer / Category / AssetModel / Fieldset). (must)**

The single biggest credibility gap, and the premise is fully verified. Today 400 identical MacBook Air M3s carry 400 copies of the same spec data, and there is nowhere to hang model-level facts: EOL months, depreciation schedule, end-of-support date (Lansweeper's data is model- and manufacturer-keyed), or the custom fieldset that applies only to laptops.

```
manufacturer = { id, name, url, supportUrl, supportPhone, supportEmail, logoUrl }
assetCategory = { id, name, kind: 'hardware'|'accessory'|'consumable'|'component'|'software',
                  icon, color, requiresAcceptance, checkinEmail, eulaText }
fieldset  = { id, name, fields: [{ id, key, label, element, format, regex, options,
              required, encrypted, showOnCheckout, showOnCheckin, order }] }
assetModel = { id, name, modelNumber, manufacturerId, categoryId, fieldsetId,
               eolMonths, depreciationId, imageUrl,
               specs: { cpu, ramGb, storageGb, screenIn },
               lifecycle: { endOfSale, endOfSupport, milestoneDate }, notes, archived }
depreciation = { id, name, method: 'straight_line'|'declining_balance'|'double_declining'
                 |'half_year_conditional'|'half_year_unconditional', months, floorValue }
```

UI: a Catalog sub-tab under Assets with Manufacturers / Categories / Models. Model detail = spec panel + live status breakdown bar + attached Fieldset + attached Depreciation. Asset create/edit becomes "pick Model → category, manufacturer, warranty default, EOL months and the custom fieldset all auto-populate." Reuse the existing tree colour idiom: manufacturer slate, category amber, model indigo, asset cyan.

**2. Replace `assignmentType person|location` with a polymorphic checkout target plus four ownership roles. (must)**

The person|location binary misses the third target (asset-to-asset) and conflates custody with accountability. Keep ServiceNow's four roles, but **hold them as a design convention rather than a vendor-enforced standard.** The finance report wants Owned by + Cost center; the incident router wants Supported by; offboarding wants Assigned to.

```
asset.assignment = { targetType: 'user'|'location'|'asset'|null, targetId,
                     checkedOutAt, checkedOutBy, expectedCheckin, note, acceptedAt }
asset.ownedById        // business owner / budget holder
asset.managedById      // IT admin responsible operationally
asset.supportQueueId   // -> existing RelayHQ Queue
asset.primaryUserId; asset.sharedUserIds = []
asset.departmentId, asset.costCenterId
asset.usageType = 'permanent'|'loaner'|'shared'   // Freshservice's model, verified
// DERIVED, never stored:
currentLocationId(asset) = targetType==='location' ? targetId
  : targetType==='user'  ? user(targetId).locationId
  : targetType==='asset' ? currentLocationId(asset(targetId))
  : asset.homeLocationId
```

UI: one Checkout modal with a User/Location/Asset segmented control, an Expected check-in date auto-required when `usageType==='loaner'`, and a status picker filtered to deployable-type statuses. **Check-in accepts any status** — that is the verified Snipe-IT rule and it matters, because a laptop comes back broken. An Ownership chip row showing values not counts, and a Custody breadcrumb when `targetType==='asset'`.

**3. Model lifecycle as typed Status Labels + substate + a derived Deployed meta-status. (must)**

A hardcoded enum is the tell that a prototype is not real. Snipe-IT's insight: the label is user-defined, the **type** drives behavior. ServiceNow's insight: state answers "where in life," substate answers "why," and In Stock/Pending repair is materially different from In Stock/Available.

```
statusLabel = { id, name, type: 'deployable'|'pending'|'undeployable'|'archived',
                color, notes, allowedSubstates: [], defaultSubstate, isDefault }
asset.statusId, asset.substate
// DERIVED:
metaStatus(a)  = type(a)==='deployable' && a.assignment.targetType ? 'Deployed' : label(a).name
canCheckout(a) = type(a)==='deployable' && !a.assignment.targetType
```

UI: status pill rendering `metaStatus` with the label colour plus a smaller substate pill. Picking a non-deployable status on a checked-out asset shows an inline warning with a check-in preview before confirm — **write your own copy for that warning; Snipe-IT's exact string is unverified.** Settings > Status Labels admin list with live per-label counts.

**4. Make Locations a self-referencing tree with home-vs-current location and rollups. (must)**

Flat Locations cannot answer the two questions locations exist to answer. Both halves of the premise are verified. RelayHQ already has a 3-level tree widget from Products & Services, so build cost is low — generalize it to n levels.

```
location = { id, name, parentId, type: 'region'|'campus'|'building'|'floor'|'room'|'stockroom'|'remote',
             address, address2, city, state, country, zip, phone, currency, managerId, imageUrl, notes }
asset.homeLocationId
// DERIVED (memoized): descendantIds, assetsHome, assetsPresent, assetsCheckedOutFrom,
// rollup(locId) = { assetCount, bookValue, purchaseValue, byStatusType } over descendants
```

Currency per location is a verified Snipe-IT field and is what lets purchase costs roll up per site in local currency. Each node row shows two counts and a value; node detail gets three tabs (Assets present / Assets homed here / Checked out from here).

**5. Rebuild Software as SoftwareProduct → Entitlement → Allocation → Installation with a per-metric compliance engine. (must)**

The difference between a licenses list and software asset management, and the best-verified recommendation in the set. ServiceNow's whole SAM proposition compresses to: installations determine rights used, entitlements determine rights owned, the difference is the compliance position, and the shortfall × unit cost is the true-up — every part a pure client-side reduce. Beating Freshservice is easy: it documents per-device compliance only.

```
softwareProduct = { id, name, publisherId, categoryId, versionFamily, notes }
entitlement = { id, softwareProductId, name, publisherPartNumber,
  metric: 'per_named_user'|'per_user'|'per_device'|'per_named_device'|'per_core'
          |'per_processor'|'concurrent'|'site'|'unlimited',
  purchaseModel: 'perpetual'|'subscription'|'saas'|'oem'|'open_source'|'free'|'trial',
  rightsPurchased, rightsPerPack,
  coreFactor: 1, minCoresPerSocket: 0, minCoresPerServer: 0,   // configurable — see caveat
  reassignable: true, upgradeRights: false, baseEntitlementId: null,
  productKey, supplierId, poNumber, purchaseDate, purchaseCost, unitCost, currency,
  startDate, endDate, autoRenew, renewalNoticeDays: 60,
  maintenance: { active, expiryDate, cost, contractId },
  licensedToName, licensedToEmail, ownerId, departmentId, costCenterId,
  contractId, minAmt, notes, archived }
allocation   = { id, entitlementId, targetType: 'user'|'asset'|'department'|'location',
                 targetId, rights: 1, allocatedAt, allocatedBy, note }
installation = { id, softwareProductId, assetId, version, edition,
                 discoveredAt, lastSeenAt, lastUsedAt, usageHours30d,
                 source: 'agent'|'manual'|'import' }

// DERIVED — compliancePosition(softwareProductId):
//   rightsOwned = sum(activeEntitlements.rightsPurchased)
//   rightsUsed  = by metric:
//     per_device|per_named_device -> distinct installation.assetId
//     per_user|per_named_user     -> distinct owner of the host asset (fallback: allocations)
//     per_core      -> sum over installed hosts of
//                      max(cores*coreFactor, minCoresPerSocket*sockets, minCoresPerServer)
//     per_processor -> sum over installed hosts of sockets
//     concurrent    -> max(peakConcurrent over window)
//     site|unlimited-> 0
//   position   = rightsOwned - rightsUsed
//   trueUpCost = max(0, -position) * avgUnitCost
//   avgUnitCost = override ?? weighted mean of entitlement.unitCost   // matches SN's rule
```

Keep `coreFactor`, `minCoresPerSocket` and `minCoresPerServer` as **configurable per-entitlement fields** — that design is sound. **But do not ship vendor licensing presets.** The "16 core licenses minimum" figure is a *Windows Server* rule, not SQL Server's; Oracle's core-factor arithmetic could not be verified from any reachable source. Either ship the fields with neutral defaults and a generic live preview that shows the arithmetic for whatever the user enters, or verify the specific vendor rule against a current licensing datasheet before hardcoding a preset. **A licensing-literate viewer will catch a wrong minimum on screen, and that costs more credibility than the feature earns.**

UI: product detail with a compliance header ("Owned 250 / Used 268 — over-deployed by 18") plus the true-up figure and a metric badge. Four tabs: Entitlements, Allocations (with Reclaim), Installations, Compliance — the Compliance tab showing the arithmetic as a stepped explanation. **Show the formula, not just the answer.** A metric-specific editor; `concurrent` reveals a peak-usage sparkline instead of a seat list.

**6. Add the procurement / warranty / depreciation block and compute book value client-side. (must)**

"Cost per department" and "what is this fleet worth" are the two questions that get an ITAM module funded. Two verified details make it credible: **warranty stored as MONTHS off purchase date** with expiry computed, and a floor/salvage value in the depreciation schedule.

```
asset.purchase = { supplierId, poNumber, orderNumber, invoiceNumber, purchaseDate,
                   purchaseCost, currency, contractId, fundingSource }
asset.warranty = { months, expiryDate, providerId,
                   level: 'basic'|'nbd_onsite'|'4h_onsite'|'depot', contractId }
asset.depreciationId, asset.salvageValue, asset.eolDate
supplier = { id, name, contactName, email, phone, url, address, notes }
// DERIVED:
warrantyExpiry(a) = a.warranty.expiryDate ?? addMonths(a.purchase.purchaseDate, a.warranty.months)
eolDate(a)        = a.eolDate ?? addMonths(a.purchase.purchaseDate, model(a).eolMonths)
bookValue(a, asOf):
  floor = a.salvageValue ?? d.floorValue ?? 0
  monthsPassed = clamp(monthsBetween(a.purchase.purchaseDate, asOf), 0, d.months)
  straight_line: cost - (cost - floor) * (monthsPassed / d.months)   // Snipe-IT's published formula
  declining_balance / double_declining: iterate monthly, never below floor
```

Keep `salvageValue <= purchaseCost` as a save-blocking invariant — good accounting hygiene — but **present it as RelayHQ's own design choice, not as "matching ServiceNow".** UI: a collapsed Financial section on the asset card with Procurement and Lifecycle columns, a days-remaining pill on warranty expiry, and a 5-year book-value sparkline. Aggregate tiles on Assets home: Fleet purchase value / Current book value / Depreciating this FY / Out of warranty.

**7. Add a typed, directional CI relationship graph wired to impact analysis. (should)**

"What breaks if I patch this server on Saturday" is the entire reason CMDBs exist and is the most demo-able thing in the dimension. **Seed from Freshservice's published 23 pairs**, and add "Depends on / Used by" on **ServiceNow's** authority, not Freshservice's. The critical nuance is verified twice over: **impact direction must be a property of the relationship type**, because Connected to / Exchanges data with / Backed Up by are symmetric while Depends on is not — and because ServiceNow's own OOB labels are documented as sometimes reversed.

```
ciClass    = { id, name, parentId, icon, color }
configItem = { id, ciClassId, name, assetId,
               operationalStatus, environment, criticality,
               ownedById, managedById, supportQueueId, locationId, attributes: {} }
relationshipType = { id, forward: 'Depends on', reverse: 'Used by',
                     impactFlows: 'parent_to_child'|'child_to_parent'|'both'|'none' }
relationship     = { id, typeId, parentCiId, childCiId, note }
// DERIVED: impactedBy(ciId, maxDepth=4) -> BFS over relationships whose type.impactFlows
//   admits the direction; de-duped, sorted by criticality then depth
```

Cap traversal depth deliberately — ServiceNow's own fallback tree walk caps at 10 levels and is documented as a timeout risk, which is exactly why they prefer a flattened service-association table. If RelayHQ ever needs performance here, the lesson is to precompute a service-association array rather than deepen the walk.

UI: a Relationships tab with upstream and downstream panes; an add-relationship modal with a live sentence preview ("Server-01 [Depends on] Database-Prod") so direction is never ambiguous. On the Change record, an Impact panel with Affected CIs plus a computed Impacted services list, each row showing depth and dependency path, and a headline count in the change's risk colour. Render as depth-limited inline SVG, not a library. **This is what unlocks the six parent/child conflict codes in §3.2 recommendation 4.**

**8. Add Contracts as a first-class entity. (should)**

Renewals are the number-one recurring ITAM report. ServiceNow's `ast_contract` with Draft → Active → Expired (+ Canceled) and a nightly "Contract Compliance Checks" job is the verified pattern; Freshservice's three defaults are the verified minimum.

```
contract = { id, number, name,
  type: 'lease'|'maintenance'|'warranty'|'support'|'software_license'|'subscription'|'service',
  vendorId, ownerId, departmentId, costCenterId,
  state: 'draft'|'pending_approval'|'active'|'expired'|'cancelled'|'renewed',
  startDate, endDate, autoRenew, noticePeriodDays, renewalNoticeDays: 90,
  cost, currency, paymentSchedule, coveredAssetIds: [], coveredEntitlementIds: [],
  coveredModelIds: [], documents: [], terminationClause, renewedFromId, notes }
// DERIVED state (compute on render, mirroring the nightly job's logic):
// cancelled ? 'cancelled' : !approved ? 'draft' : today < startDate ? 'pending'
//   : today > endDate ? 'expired' : 'active'
```

Include **Cancelled** in the state set, and model renewal via a substate on Expired plus `renewedFromId` chaining, which is closer to what ServiceNow does than a standalone Renewed state. Contract detail gets a Coverage panel; contracts appear as a chip on every asset and entitlement they cover.

**9. Add an immutable movement ledger. (should)**

Auditability separates an asset register from a spreadsheet and is the cheapest credibility win available: one append-only array powers the asset history timeline, the Activity report, the audit trail and "days since last movement."

```
movement = { id, at, actorId, subjectType, subjectId,
  action: 'create'|'checkout'|'checkin'|'transfer'|'audit'|'status_change'
          |'assign_owner'|'update'|'dispose'|'reclaim',
  fromType, fromId, toType, toId, fromStatusId, toStatusId,
  fromSubstate, toSubstate, fromLocationId, toLocationId, note, acceptedAt }
// DERIVED: lastCheckoutAt, lastCheckinAt, checkoutCount, checkinCount, daysIdle, custodyChain
```

**10. Ship five opinionated reports as derived views, not a report builder. (should)**

A generic builder is a lot of work and demos badly. Snipe-IT's own product is instructive: five named pre-defined reports **and** a 95-field builder — build the five first. *(The specific five below are design judgement plus vendor precedent, not measured practitioner demand.)*

```
unassignedAssets    = assets.filter(a => statusType(a)==='deployable' && !a.assignment.targetType)
warrantyExpiring(n) = assets.filter(a => daysUntil(warrantyExpiry(a)) <= n).sort(byDate)
costByDepartment    = groupBy(assets,'departmentId') merged with groupBy(entitlements,'departmentId')
upcomingRenewals(n) = [...contracts, ...entitlements].filter(x => daysUntil(x.endDate) <= n)
compliancePositions = softwareProducts.map(compliancePosition).sort(byPositionAsc)
assetsByLocation    = locationTree.map(node => rollup(node.id))
auditDue            = assets.filter(a => a.nextAuditAt && a.nextAuditAt <= today)
```

Five cards, each opening a filtered table reusing the existing filter toolbar. Cost by department gets a horizontal stacked bar; upcoming renewals a 12-month timeline strip; compliance the red/green position column; warranty expiring a 30/60/90/180 segmented control. Every row deep-links.

**11. Add a unified expiry/alert digest behind one day-threshold. (should)**

Snipe-IT proves the pattern exactly: one configurable threshold plus a send-to address, driving one command covering warranty *and* license expiry, with a separate inventory alert for accessories, consumables and components. Build one derived alert stream over all date-bearing fields from day one rather than bolting each source on separately.

```
alertSettings = { warningDays: 90, criticalDays: 30, lowStockEnabled: true }
expiryAlert = { id, sourceType: 'asset_warranty'|'asset_eol'|'contract'|'entitlement_term'
                |'maintenance'|'audit_due'|'low_stock',
  sourceId, sourceLabel, dueDate, daysOut,
  severity: daysOut < 0 ? 'expired' : daysOut <= criticalDays ? 'critical'
            : daysOut <= warningDays ? 'warning' : 'info',
  ownerId, estimatedCost, acknowledgedBy, acknowledgedAt }
// acknowledgement IS stored so dismissals survive navigation
```

UI: a bell/counter in the Assets header opening a grouped digest (Expired / Next 30 / Next 90), rows acknowledgeable (grey out, don't disappear). Feed the same stream into the Workspace lens bar as an amber "Asset alerts" entity.

**12. Add Accessories, Consumables and Components as quantity-tracked siblings. (nice)**

Nowhere currently to put a box of 40 USB-C hubs, a toner cartridge, or a stick of RAM in a specific server. Snipe-IT maintains all four as separate entity types (separate imports, separate API endpoints, separate inventory alerting) — though the exact per-type behavioural rules below are a reasonable reading rather than quoted documentation.

```
accessory  = { id, name, categoryId, manufacturerId, modelNumber, locationId, supplierId,
               purchaseDate, purchaseCost, qtyTotal, minQty, imageUrl }
accessoryCheckout = { id, accessoryId, targetType:'user'|'location', targetId, qty, checkedOutAt, note }
consumable = { ...same shape }        // consumableIssue never returns
component  = { ...same shape + serial }
componentCheckout = { id, componentId, assetId, qty, installedAt, note }  // target ALWAYS an asset
// DERIVED: qtyAvailable = qtyTotal - sum(active); lowStock = qtyAvailable <= minQty
```

Component detail shows "installed in" as a list of assets — the screen that visibly justifies checkout-to-asset.

**13. Add Stockrooms and Transfer Orders to make In Transit real. (nice)**

"In Transit" as a status with nothing that produces it is a dead enum value, and bulk moves shouldn't require editing 40 records. **Caveat: ServiceNow's transfer-order mechanics could not be verified — build this from first principles, not as a claimed vendor-parity feature.**

```
transferOrder = { id, number, sourceLocationId, destinationLocationId, requestedById,
  state: 'draft'|'requested'|'in_transit'|'received'|'cancelled',
  shippedAt, expectedAt, receivedAt, carrier, trackingNumber, notes }
transferOrderLine = { id, transferOrderId, assetId|modelId, qty, received, receivedAt,
                      condition: 'ok'|'damaged'|'missing' }
// on ship    -> status := In Transit, substate := pending_install, movement row
// on receive -> homeLocationId := destination, status := Ready to Deploy, movement row
```

**14. Add reclamation rules and candidates. (nice)**

Compliance reporting says you are over-deployed; reclamation fixes it and produces a dollar figure an exec cares about. **Use the two threshold shapes ServiceNow actually documents** — total usage time (hours) and last-used date — plus configurable user notification and managerial approval. Do **not** use "Days Since Last Used" as a field name, do not seed a 90-day default as a vendor value, and do not assume an SCCM-shaped usage feed. This hooks directly into the approvals engine and the automation workspace — **a reclamation rule is the most natural first automation to demo.**

```
reclamationRule = { id, softwareProductId, mode: 'unused_since'|'low_usage',
  unusedDays, minUsageHours, windowMonths, responseDays, requiresApproval, approverId,
  action: 'notify'|'reclaim_allocation'|'create_uninstall_task', enabled }
reclamationCandidate = { id, ruleId, softwareProductId, entitlementId, allocationId,
  userId, assetId, lastUsedAt, daysIdle, usageHoursWindow, estimatedSavings,
  state: 'open'|'notified'|'justified'|'approved'|'reclaimed'|'dismissed',
  respondedAt, justification, decidedById }
```

UI: a Reclamation panel with a headline recoverable figure, a candidate table with per-row Reclaim/Dismiss and bulk action, and a rule editor with a live preview count ("this rule would flag 87 seats today"). Route approval through the shared approval engine.

**15. Let Models carry custom Fieldsets, authored with the existing Subform builder. (nice)**

Every vendor solves "a laptop needs a MAC address and a server needs a rack unit" with model-scoped custom fields rather than a bloated universal schema. This is the subform builder pointed at a new target.

```
asset.customFields = { '<fieldKey>': value }
// formats to implement (verified from Snipe-IT): ANY, ALPHA, ALPHA_DASH, NUMERIC,
// ALPHA_NUMERIC, EMAIL, DATE, URL, IP, IPV4, IPV6, MAC, BOOLEAN, REGEX(pattern)
// per-field flags: required (per fieldset), encrypted, showOnCheckout, showOnCheckin, order
```

Mirror Snipe-IT's documented tradeoff explicitly in UI copy: encrypted fields render masked with a reveal toggle and are **excluded from global search and sorting**. Borrow Atlassian's inheritance rule as a UX guardrail: enforce "enable inheritance before creating children" rather than allowing retroactive enablement.

#### Not verified

**Numeric / licensing**
- **"SQL Server requires a minimum of 16 core licenses per physical server" is false as attributed.** That is a Windows Server rule. The worked example "2 sockets × 6 cores = buy 16" is wrong under SQL Server rules, which would require 12. The "minimum 4 core licenses per physical processor" figure is widely repeated but could not be confirmed from any retrievable Microsoft page.
- **Oracle's Processor Core Factor arithmetic** (licenses = cores × core factor; a 0.5 factor halving the count). Every source attempt failed. The design implication — a per-core entitlement needs a `coreFactor` field — is safe; the rule and the 0.5 example are unsourced.
- **"A 25% concurrency ratio means 25 floating seats serve ~100 users."** The concept is confirmed; Ivanti's published example is 3:1 and explicitly varies by organization.

**ServiceNow specifics**
- **The exact property name for change impact analysis.** The cited article names it `change.refresh_impacted.include_affected_cis`, not `com.snc.change_request.refresh_impacted.include_affected_cis`, and states no default. The claim that affected CIs are processed asynchronously via an event is unsupported — the documented fallback is a **synchronous** tree walk capped at 10 levels.
- **Reclamation rule specifics:** the field name "Days Since Last Used", the 90-day rule / 30-day record example, any response-window duration in days, the `samp_sw_usage.last_used` column, and the SCCM `LastUsedTime` dependency.
- **Depreciation mechanics:** whether Residual Value and Depreciated Amount are read-only calculated fields, the "Calculating Depreciation" scheduled job and its cadence, and the rule that Salvage Value cannot exceed original cost.
- **Transfer orders and stockrooms:** the table names `alm_stockroom` / `alm_transfer_order_line`, source-stockroom/destination-location semantics, and automatic asset-location update on receipt.
- **The `contract.expiration` event emailing the contract administrator**, and the contract model types "Subscription, Software License and Maintenance."
- **The verbatim compliance quote** "The process uses installation information to determine rights used and entitlement details to determine rights owned…" — the concept is confirmed, the sentence was not found. Paraphrase.
- **`install_status` numeric choice codes** (1 = On order, 2 = In stock, 6 = In use, 7 = Retired, 8 = Missing, 100 = Absent). Instance-specific — labels verified, integers not. Do not hardcode.
- **Whether entitlement columns are literally `purchased_rights` / `allocated_rights` / `rights_used`.** Confirmed as *form labels*, not dictionary column names.
- **Sum-of-Years-Digits depreciation support in ServiceNow.**

**Snipe-IT specifics**
- **The `next_audit_date` denormalization rationale.** The fields and the Audit report are real; the quoted justification is not.
- **The check-in warning string** "That asset status is not deployable. Using this status label will checkin the asset." The behavior is consistent with the verified rule; the string is unconfirmed — write your own.
- **The docs quote** "A location cannot be held responsible if an asset is broken or goes missing."
- **CustomField element types (text, textarea, listbox, checkbox, radio), the `_snipeit_<slug>_<field_id>` db_column pattern, and the `display_checkin = 1` flag.** Sourced only to DeepWiki.
- **Location detail page attribute names `assets_default` and `assets_checkedout`.**
- **"Deployed" as a formally computed meta-status** rather than a display convention.
- **The per-type behavioral definitions** of accessories (return to pool), consumables (never return) and components (checked out to an asset). The four entity types are real; these semantics are inference.
- **`rtd_location_id`'s expansion.** Devdocs render it as ready-to-deploy location; the GUI import field is "Default Location". The semantics (home location on check-in) are confirmed; the acronym is not.

**Freshservice specifics**
- **Hardware `type_fields`** (product, vendor, cost, warranty, acquisition_date, warranty_expiry_date, asset_state, serial_number).
- **A default value for `impact`.** Values are confirmed as integers 1/2/3.
- **Relationship maps being used to identify affected services during incident response** — the article covers Change impact only.
- **Freshservice's compliance arithmetic beyond per-device.** Their docs state per-device is what they support; no documentation either asserts or denies a named-user or concurrent position, so neither should be claimed.

**Other**
- **Lansweeper keying discovery on hardware/SMBIOS UUID and MAC addresses**, and Lansweeper having an internal custody state machine. Its lifecycle feature is vendor-timeline data only.
- **"Reports people actually ask for"** (daily 30-day warranty digests, refresh backlog, aging by lifecycle stage). Vendor marketing blog only. Reasonable design prior; not research.
- **The Atlassian schema's "grandchildren Red Hat Linux, Windows Server"**, and Email attribute regex validation.
- **RelayHQ's actual current code.** Every recommendation is written against the brief's as-built description, not inspected code; field and component names may not match reality.

---
### 3.5 n8n-style workflow automation: canvas UX and execution model

**What this dimension establishes.** n8n is source-available, so unlike every other vendor in this document its canvas geometry, node chrome, execution model and human-in-the-loop mechanics can be **read directly and reproduced exactly**. The fact-check re-fetched the referenced files from `n8n-io/n8n@master`, `xyflow/xyflow@main`, `bcakmakoglu/vue-flow@master` and the n8n docs; the canvas constants, bezier math, edge routing, node chrome, i18n strings, node codex JSON, execution-status enum, workflow interfaces and the `sendAndWait` mechanics all verify, most of them verbatim. **This is the highest authenticity-per-line ratio in the whole research set.** Competitor claims in this dimension are weaker: Zapier's Paths limits verified verbatim, Make's operations/credits framing was out of date, and essentially all ServiceNow specifics remain community-sourced and unverified.

#### Verified findings

**Canvas engine and geometry** *(source-verified)*

**Vue Flow, not a bespoke renderer.** `packages/frontend/editor-ui/package.json` declares `@vue-flow/core 1.48.0`, `@vue-flow/background 1.3.2`, `@vue-flow/controls 1.1.3`, `@vue-flow/minimap 1.5.4`, `@vue-flow/node-resizer 1.5.0`, `@dagrejs/dagre ^1.1.4`, a full CodeMirror 6 stack, and `luxon`. *Correction: there is no `@codemirror/lang-sql`; n8n ships its own `@n8n/codemirror-lang-sql` workspace package.*

**Layout constants** (`app/utils/nodeViewUtils.ts`), all multiples of a 16px grid:

| Constant | Value |
|---|---|
| `GRID_SIZE` | 16 |
| `DEFAULT_NODE_SIZE` | [96, 96] |
| `CONFIGURATION_NODE_RADIUS` / `_SIZE` | 40 / [80, 80] |
| `CONFIGURABLE_NODE_SIZE` | [256, 96] |
| `AGENT_NODE_SIZE` | [320, 128] |
| `DEFAULT_START_POSITION_X` / `_Y` | 176 / 240 |
| `PUSH_NODES_OFFSET` | 208 |
| `NODE_X_SPACING` | 128 |
| `HORIZONTAL_NODE_STEP` | 224 |

Positions snap via `closestNumberDivisibleBy(position, GRID_SIZE)` on both axes.

**Node height growth** — `height = 96 + Math.max(0, maxVerticalHandles - 2) * 32`, where **`maxVerticalHandles = Math.max(mainInputCount, mainOutputCount, 1)`**. *Corrected: inputs count, not only outputs.*

**Bezier control math** — identical in xyflow and vue-flow:

```js
calculateControlOffset(d, c) = d >= 0 ? 0.5 * d : c * 25 * Math.sqrt(-d)   // default c = 0.25
// left-to-right edge:
c1 = [sx + off(tx - sx, 0.25), sy]
c2 = [tx - off(tx - sx, 0.25), ty]
path = `M${sx},${sy} C${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`
// label midpoint (t = 0.5 approximation):
cx = sx*0.125 + c1x*0.375 + c2x*0.375 + tx*0.125
```

**Backwards edges are not beziers.** In `getEdgeRenderData.ts`: when `sourceX - HANDLE_SIZE(20) > targetX` and the type is Main, n8n builds **two** `getSmoothStepPath` segments with `borderRadius: 16` and `offset: 40`, dropping to `sourceY + 130` at the x-midpoint. Constants: `EDGE_PADDING_BOTTOM = 130`, `EDGE_PADDING_X = 40`, `EDGE_BORDER_RADIUS = 16`, `HANDLE_SIZE = 20`.

**Tidy Up is dagre** (verified, not inferred). `canvas/composables/useCanvasLayout.ts` imports `@dagrejs/dagre` and lays out with `rankdir: 'LR'`, `ranksep: NODE_X_SPACING` (128), `nodesep: NODE_Y_SPACING`, `dagre.layout(g, { disableOptimalOrderHeuristic: true })`, snapping by node **center**. AI/config sub-graphs use `rankdir: 'TB'`.

**Node chrome** *(source-verified)*

- **Trigger radius:** `--trigger-node--radius: 36px`; `.trigger { border-radius: 36px lg lg 36px }`. Configuration nodes are circles: `border-radius: calc(height / 2)`. Border width `1.5px`, `light-dark()` at 0.1 black / 0.15 white.
- **Name below the body:** `.description { top: 100%; position: absolute; width: 100%; min-width: calc(var(--canvas-node--width) * 2) }`; label `font-size--md`, subtitle `font-size--xs`. Disabled nodes render `(Deactivated)`.
- **Hover toolbar** — four core buttons in order, all verbatim: `execute-node-button` (icon `node-play`, "Execute step"; "This node is deactivated and can't be run" when disabled), `disable-node-button` (`node-power`, "Deactivate"/"Activate"), `delete-node-button` (`node-trash`, "Delete"), `overflow-node-button` (`node-ellipsis`, "More actions"). *Corrected: also conditionally a focus crosshair, an "Add to AI" sparkles button, and the sticky color selector — so **not "exactly four"**.* **No pin button** — confirmed; a community feature request for one exists.
- **"+" stub:** `plusSize 24`, `lineSize 46`, stroke-width 2; lineSize → 80 when `runDataTotal > 0`, else `{small:46, medium:66, large:80}` by longest output label. Rendered only when `!isConnected && !isReadOnly`; enters/leaves `scale(0) → scale(1)` over `0.2s ease` with `transform-origin: 0 center`; `plusType` flips to `success` once run data exists.
- **Handles:** wrapper `padding: 4px; margin: -4px; z-index: 2` (invisible hit target); dot `border-radius: 50%`, 1px border; output hover → 1.5px border + `scale(1.5)`, `cursor: crosshair`.
- **Labels:** `.outputLabel` at `top:50%; left: spacing--md`, `font-size--2xs`, on a background-colored chip. `.runDataLabel` above the handle center at `font-size--xs`, text from `ndv.output.items` = `"{count} item | {count} items"`. Required non-main inputs append a red `*`.
- **Running border:** a shared `::after` at `inset:-3px; border-radius:10px; z-index:-1` with `conic-gradient(from var(--node--gradient-angle), rgba(255,109,90,1), … 20%, rgba(255,109,90,0.2) 35%, … 65%, rgba(255,109,90,1) 90%)`, driven by `@property --node--gradient-angle` rotating 0→360deg. **Running = 1.5s, waiting = 4.5s.** *Corrected: `running` sets `border-color: transparent` and a running border color var; `waiting` sets `--canvas-node--border-color: transparent`; neither changes border-width. Only success/error/warning set `--canvas-node--border-width: var(--spacing--5xs)`.* Selection ring: `box-shadow: 0 0 0 calc(6px * var(--canvas-zoom-compensation-factor,1))`.
- **Status badge priority chain** (`CanvasNodeStatusIcons.vue`, strict v-if/v-else-if): not-installed (`hard-drive-download`) → disabled (`power`) → execution errors (status="error", tooltip titled "Issues:", duplicates collapsed as `message (x3)`) → validation errors (`node-validation-error`) → `executionStatus === 'unknown'` renders **nothing** → pinned (`node-pin`, `--color--secondary`) → dirtiness warning → `hasRunData && success` (check + `runDataIterations`). The dirtiness tooltip is `node.dirty` ("Node configuration changed. Output data may change when this node is run again") for PARAMETERS_UPDATED, else `node.subjectToChange` ("Because of changes in the workflow, output data may change when this node is run again"); the warning mark also shows an iteration count.

**Node taxonomy and catalog**

n8n documents **two operation types** — Triggers ("start a workflow in response to specific events or conditions in your services", bolt icon in search) and Actions ("operations that represent specific tasks within a workflow") — plus **Core nodes** ("can be actions or triggers… provide functionality such as logic, scheduling, or generic API calls") and **Cluster nodes** ("node groups that work together", a root node plus sub-nodes). *This is a useful four-way mental model but not a formal "exactly four kinds" taxonomy.*

Codex subcategories, verified from each `*.node.json`:

| Node | categories | subcategories |
|---|---|---|
| If, Switch, SplitInBatches | Core Nodes | Flow |
| Merge, Filter | Core Nodes | Flow, Data Transformation |
| Wait | Core Nodes | Helpers, Flow |
| NoOp, StickyNote | Core Nodes | Helpers |
| Set | Core Nodes | Data Transformation |
| Code | Development, Core Nodes | Helpers, Data Transformation |
| HttpRequest | Development, Core Nodes | Helpers |

*Corrected: these lists are **not exhaustive**. StopAndError and CompareDatasets are also in Flow; ExecutionData is also in Helpers.*

Node-creator subcategory names (verbatim, `en.json`): "Action in an app", "Data transformation", "Flow", "Core" (key `helpers`), "Files", "Human review" (key `humanInTheLoop`), "MCP servers", "Miscellaneous", "On app event", "Other ways..." (key `otherTriggerNodes`), plus the Advanced-AI set. Actions tab: placeholder `"Search {node} Actions..."`, empty state `"No matching Actions. <i>Reset search</i>"`.

Trigger picker copy (verbatim): title **"What triggers this workflow?"** / subtitle **"A trigger is a step that starts your workflow"** (alternate title "When should this workflow run?" also present); options "Trigger manually" / "Runs the flow on clicking a button in n8n. Good for getting started quickly", "On app event", "On a schedule" / "Runs the flow every day, hour, or custom interval", "On webhook call" / "Runs the flow on receiving an HTTP request", "On form submission" / "Generate webforms in n8n and pass their responses to the workflow", "When executed by another workflow", "On chat message". After a trigger exists the header becomes **"What happens next?"**; "Add another trigger" / "Triggers start your workflow. Workflows can have multiple triggers."

**Flow-control node semantics**

- **IF** — `outputs: [Main, Main]`, `outputNames: ['true','false']`; `Conditions` is a `filter`-type control; Options → Ignore Case. Six type families (String, Number, Date & Time, Boolean, Array, Object). Combinators: "When it meets all conditions" (AND) / "When it meets any of the conditions" (OR). *Corrected: Boolean supports exists / does not exist / is empty / is not empty / is true / is false / is equal to / is not equal to.* IF has two named outputs and **silently drops items routed to an unwired branch**.
- **Switch** — Rules mode (one output per rule, "Rename Output" toggle → "Output Name") and Expression mode ("Number of Outputs" + "Output Index", must return a number). Options: **Fallback Output** = None (ignore item, default) / Extra Output / Output 0; Ignore Case; Less Strict Type Validation; "Send data to all matching outputs".
- **Loop Over Items** — displayName "Loop Over Items (Split in Batches)", name `splitInBatches`, `outputNames: ['done','loop']` — **`done` is index 0 (top)**. Parameters: Batch Size, Options → Reset. Loop state in expressions: `{{$("Loop Over Items").context["currentRunIndex"]}}` and `{{$("Loop Over Items").context["noItemsLeft"]}}`. The docs' own embedded example JSON confirms the index order.
- **Merge** — four modes: Append (with "Number of Inputs"; waits for all connected inputs), Combine (Combine By → Matching Fields / Position / All Possible Combinations), SQL Query (inputs addressed as `input1`, `input2`, `input3`), Choose Branch ("Input 1 Data" / "Input 2 Data" / "A Single, Empty Item"). Combine options include Clash Handling, Fuzzy Compare, Disable Dot Notation, Multiple Matches, Include Any Unpaired Items. **Input 1 takes precedence** on uneven streams (5 in / 10 in → 5 processed). *Corrected: Output Type labels are **Keep Matches / Keep Non-Matches / Keep Everything / Enrich Input 1 / Enrich Input 2** — the join names appear only in the descriptions.*
- **Edit Fields (Set)** — Manual Mapping (drag from INPUT; per-field "Fixed | Expressions" toggle on both name and value) or JSON Output. Keep Only Set Fields, Include in Output, Include Binary Data, Ignore Type Conversion Errors, Support Dot Notation (on by default: `number.one` = 20 → `{"number":{"one":20}}`).
- **Filter** — one output, silently omits non-matching items: "If the item doesn't meet the condition, the Filter node omits the item from its output." **"You can't create a mix of AND and OR rules."**
- **Wait** — four resume modes: After Time Interval (Seconds/Minutes/Hours/Days), At Specified Time, On Webhook Call (`$execution.resumeUrl`; Basic/Header/JWT/None; also a Webhook Suffix option), On Form Submitted. **"For wait times less than 65 seconds, the workflow doesn't offload execution data to the database."** All timing uses the n8n server clock regardless of workflow timezone.
- **Code** — Mode = Run Once for All Items (default) / Run Once for Each Item; Language = JavaScript (default) / Python (typeVersion 2 only). Code/Function nodes auto-add the `json` key and array wrapper; custom nodes must not rely on it.

**Data and execution model**

Inter-node data is `[{ "json": {...}, "binary": {...} }]`, binary entries carrying base64 `data` plus `mimeType`, `fileExtension`, `fileName`. "When a node receives an array of data items, it processes each item individually and performs the configured operation for each one." *Caveat: implicit per-item looping is the default, **not an invariant** — Execute Once and certain nodes (e.g. RSS Feed Read) process only the first item.*

Expression surface (all verified): `$json`, `$binary`, `$now` ("A DateTime representing the current moment"), `$today` ("midnight at the start of the current day"), `$execution`, `$itemIndex`, `$input`, `$parameter`, `$prevNode`, `$runIndex`, `$vars`, `$workflow`, plus `$nodeVersion`, `$pageCount`, `$request`, `$response`, `$secrets`. Cross-node: `$("NodeName")` with `.first()`, `.last()`, `.all()`, `.item`, `.itemMatching()`, `.isExecuted`. Helpers: `$if`, `$ifEmpty`, `$jmespath`, `$max`, `$min`.

Persisted shape (`packages/workflow/src/interfaces.ts`): `IConnection = { node: string /* target NAME */, type: NodeConnectionType, index: number }`; `IConnections = { [sourceNodeName]: { [connectionType]: NodeInputConnections } }` — **output index is the array position, not a field**. Because everything keys on node **name**, renaming rewrites connections and every `$("Name")` expression.

Runtime shape: `IRunData = { [nodeName]: ITaskData[] }` (one entry per run = `$runIndex`). **Corrected shape:**

```ts
ITaskStartedData = { startTime: number; executionIndex: number;
                     source: Array<ISourceData | null>;   // REQUIRED — omitted by the original research
                     hints?: NodeExecutionHint[] }
ITaskData extends ITaskStartedData = { executionTime: number; executionStatus?: ExecutionStatus;
  data?: ITaskDataConnections; inputOverride?: ITaskDataConnections; error?: ExecutionError; … }
ITaskDataConnections = { [connectionType: string]: Array<INodeExecutionData[] | null> }   // nulls are legal
```

Execution status enum (`execution-status.ts`): `['canceled','crashed','error','new','running','success','unknown','waiting']`; `CompletedExecutionStatus = 'crashed'|'error'|'success'`; `TerminalExecutionStatus` adds `'canceled'`; `CRASHABLE_EXECUTION_STATUSES = ['new','running','unknown']` — **`waiting` is deliberately excluded so a paused execution is never marked crashed.**

**Retry semantics** (source-verified, `packages/core/src/execution-engine/workflow-execute.ts`):

```js
maxTries         = Math.min(5,    Math.max(2, node.maxTries || 3))            // clamped 2–5, default 3
waitBetweenTries = Math.min(5000, Math.max(0, node.waitBetweenTries || 1000)) // clamped 0–5000ms, default 1000
```

**Retries DO fire when On Error is a Continue option.** The contrary claim was true in early 2024 and was fixed in **n8n 1.43.0** (issue #9236, closed with "Fix got released with n8n@1.43.0"). Current master retries on error-item output.

Per-node settings (verbatim i18n): **On Error** ("Action to take when the node execution fails") = Stop Workflow ("Halt execution and fail workflow") / Continue ("Pass error message as item in regular output") / Continue (using error output) ("Pass item to an extra `error` output"); Retry On Fail; Max. Tries; Wait Between Tries (ms); Always Output Data ("If active, will output a single, empty item when the output would have been empty. Use to prevent the workflow finishing on this node."); Execute Once; Display Note in Flow?

Workflow-level: an **error workflow** set in Workflow Settings ("It runs if an execution fails."), starting with the **Error Trigger**, receiving `execution` (id, url, retryOf, error.message/stack, lastNodeExecuted, mode) and `workflow` (id, name). If the failure is in the trigger node itself, `execution.id`/`url` are absent and the payload carries a separate `trigger` object.

**Human-in-the-loop `sendAndWait` — the most transferable mechanic** *(source-verified)*

- **Response Type** (default `approval`): Approval ("User can approve/disapprove from within the message"), Free Text ("User can submit a response via a form"), Custom Form.
- **Approval Options**: `approvalType` (displayName "Type of Approval") = Approve Only (`single`, default) / Approve and Disapprove (`double`); **Approve Button Label** default `'Approve'`; **Disapprove Button Label default `'Decline'`** — *not* `'Disapprove'`, which appears only as a runtime fallback in the HTML button builder; button styles Primary (default) / Secondary, disapprove defaulting to `secondary`.
- **Limit Wait Time** default, with corrected nesting: `{ values: { limitType: 'afterTimeInterval', resumeAmount: 45, resumeUnit: 'minutes' } }`; limitType choices After Time Interval / At Specified Time with a Max Date and Time field. **45 minutes is the confirmed default.**
- **Mechanics:** `const waitTill = configureWaitTillDate(this); await this.putExecutionToWait(waitTill);` → execution status becomes `waiting`. The resume webhook returns `workflowData: [[{ json: { data: { approved: <boolean>, respondedAt: <ISO> } } }]]` for approvals, or `{ data: { text, respondedAt } }` for free text / custom form.
- `SendAndWaitResponder = { id: string; name?: string; username?: string; email?: string; source: 'slack'|'telegram'|'discord'|'whatsapp' }`.

**Surfaces: pinning, logs, executions, sticky notes, shortcuts**

- **Pinning** — dev-only; single-main-output nodes only ("error" outputs don't count); never with binary output; "Data pinning isn't available for production workflow executions." Strings: "Pin data" / "Node will always output current data instead of executing. Doesn't apply to production executions."; "Unpin output data?" / "Testing a node overwrites pinned data." / confirm "Unpin and test". Shortcut **P**.
- **Logs panel** — header "Logs"; segmented switch Overview / Details; action "Clear execution" (tooltip "Clear execution data"); empty state "Nothing to display yet. Execute the workflow to see execution logs." with CTA "Execute the workflow"; per-row "{status} in {time}" / "{status} for {time}" plus "Started {time}"; row actions "Execute step", "Open..." (tooltip "Open node"), "Toggle row"; Details shows Input / Output with "{count} item | {count} items"; oversize guard "This execution's data is too large to display."
- **Executions list** — column strings Name / "Started" / "Triggered by" / "Run time" / "Exec. ID" / "Status"; status names Succeeded, Error, Running, Queued (`new`), Canceled, "Could not complete" (`unknown`), Success retry, Starting soon; templates "{status} in {time}" / "{status} for {time}" / "{status} until {time}"; manual runs tagged "Test execution"; retry options "Retry with currently saved workflow (from node with error)" and "Retry with original workflow (from node with error)"; filters "Any Status", "Select Status", "Select Workflow", "Auto refresh", "Load more", empty "No executions". *(Column set inferred from i18n keys, not from a rendered table.)*
- **Sticky notes** — `n8n-nodes-base.stickyNote`, Core Nodes > Helpers, aliases Comments/Notes/Sticky; added by searching "note" or **Shift+S**; CommonMark via markdown-it; **seven preset colors** plus a custom picker with hex entry remembering up to **8** recent colors, theme-aware borders; "Drag Sticky Notes behind nodes"; "Resize Sticky Notes by hovering over the edge of the note and dragging"; color selector on the hover toolbar.
- **Shortcuts** — pan: Ctrl/Cmd+LMB drag, Ctrl/Cmd+MMB drag, Space+drag, MMB drag, two fingers. Zoom: `+`/`=`, `-`/`_`, `0` reset, `1` zoom to fit, Ctrl/Cmd+wheel. Nodes: double-click opens, Enter opens, F2 rename, D deactivate, P pin, Delete, Ctrl/Cmd+A/C/X/V, Ctrl/Cmd+G / Ctrl/Cmd+Shift+G, Alt+G / Shift+Alt+G, arrows select adjacent/sibling nodes, Shift+←/→ select all nodes to that side, Space renames a selected group, Shift+S sticky. **The node panel opens with `N`** (not Tab). Chrome labels: "Zoom In", "Zoom Out", "Zoom to Fit", "Reset Zoom", "Tidy Up"; context menu "Tidy up workflow" / "Tidy up selection".
- **Credentials** — first-class, created from the Overview/project Create button (or inline from a node), scoped to a personal space or project; "When you save a credential, n8n tests it to confirm it works."; default naming "*node name* account"; OAuth credentials offer **Fixed credential** (default) vs **End-user credential** (per-user at runtime; Enterprise only).
- **Webhook / Respond to Webhook** — Test vs Production URLs (test registered on "Listen for Test Event"/executing an inactive workflow and shows data in the editor; production registered on publish and does not); methods DELETE/GET/HEAD/PATCH/POST/PUT; path variables `/:variable`, `/path/:variable`, `/:variable/path`, `/:variable1/path/:variable2`, `/:variable1/:variable2`; auth Basic / Header / JWT / None; Respond = Immediately (returns "Workflow got started") / When Last Node Finishes / Using 'Respond to Webhook' Node. Respond With: All Incoming Items, Binary File, First Incoming Item, JSON, JWT Token, No Data, Redirect, Text — plus Response Code, Response Headers, "Put Response in Field", Enable Streaming.
- **Schedule Trigger** — Seconds / Minutes / Hours (+ Trigger at Minute 0–59) / Days (+ hour + minute) / Weeks (+ Trigger on Weekdays) / Months (+ Trigger at Day of Month 1–31, "If a month doesn't have this day, the node won't trigger") / Custom (Cron). *Note the docs are internally ambiguous on cron field order — the prose says "The sixth asterisk … represents seconds", while the docs' own example `*/10 * * * * *` = "every 10 seconds" only works with seconds leading. Test before hard-coding.*
- **Form Trigger** — twelve element types: Checkboxes, Custom HTML, Date, Dropdown, Email, File, Hidden Field, Number, Password, Radio Buttons, Text, Textarea. Each has Field Label, Field Name, optional Placeholder / Default value / Required Field. "Respond When" = Form Is Submitted / Workflow Finishes. Multi-page forms chain the separate **Form** node ("Add next form page").

**Competitors**

**Zapier** *(vendor-published, fetched 2026-08-16; these are vendor limits, plan- and date-sensitive)*. "Each path group can have up to 10 path branches." "Each Zap can have a maximum of 3 nested Path steps." "Zap workflows are limited to 100 steps total, including all steps within paths." "Once you add a Paths step to your Zap, it must be the final step in your Zap" and "You cannot add shared actions after all path branches." "Path branches run one at a time, left to right." "Paths and Filter steps do not count toward your task usage. Only action steps within a running path branch consume tasks." Terminology: path step / path branch (a single vertical column of action steps) / path group (branches at the same horizontal level).

**Make** *(corrected)*. An operation is "a single module run to process data or check for new data"; a bundle is a "container of related data items". **Make's current docs describe operations as consuming *credits*, not as the billing unit per se** — the older framing should not be stated as current. The Iterator's documented wording is "Iterator is a special type of module that converts an array into a series of bundles. Each array item will output as a separate bundle." Array Aggregator, Router and Repeater exist as Flow Control modules; the full list was not verified.

**ServiceNow** *(partial)*. The official Flow Designer trigger reference lists Record-based, Scheduled, External, Inbound email, Kafka message, MetricBase, Performance Analytics, Service Catalog, and SLA Task triggers. *Corrected: "Date" and "Application" triggers and a record "deleted" trigger do not appear in that list.* Data is wired between steps by dragging data pills from a right-hand panel — **the useful structural contrast with n8n remains: a numbered vertical step list, not a free canvas.**

#### Recommendations

Every recommendation is written to require **zero new dependencies and zero backend**.

1. **Hand-roll the canvas. (must)** One transformed "world" div, absolutely-positioned node divs, one SVG edge layer. Use n8n's real numbers — 16px grid, 96×96 nodes, 224px horizontal step, curvature 0.25, the exact `calculateControlOffset` formula, and the two-segment orthogonal loop-back with `sy + 130` / `borderRadius 16` / `offset 40` for backwards edges. Snap positions to 16. Fully source-verified and the highest authenticity-per-line ratio available.

2. **Node catalog with domain-native nodes. (must)** Mirror n8n's browsable taxonomy (Trigger / Action in an app / Flow / Data transformation / Human review / Core) but make **RelayHQ's own entities** the "apps": Ticket, Task, Change, Asset, Entitlement, Approval, Queue, KB article. Use n8n's verbatim panel copy where it fits ("What triggers this workflow?" / "A trigger is a step that starts your workflow" → "What happens next?"). *Note the Flow/Helpers membership lists are not exhaustive — don't present them as n8n's complete catalog to anyone.*

3. **Make "Request Approval" the hero node. (must)** The `sendAndWait` pattern is verified end to end: park the execution in status `waiting` via a `putExecutionToWait` equivalent, default **Limit Wait Time 45 minutes**, render Approve/Reject buttons, resume emitting `{ json: { data: { approved, respondedAt } } }`. Two corrections: n8n's default reject label is **"Decline"** (pick RelayHQ's own label deliberately), and Limit Wait Time is stored nested under `values` if you want byte-level fidelity. **This node must call the same approval engine as §3.1 rec. 3 and §3.2 rec. 2** — one engine, three entry points. The approval-rule grammar RelayHQ ships (any-approves / all-approve / percentage / any-rejects-wins) is **sound design** but is **not** a verified reproduction of ServiceNow's from this dimension's sources — present it as RelayHQ's own model.

4. **Ship a real execution simulator producing n8n-shaped runData. (must)** Keep `runData = { [nodeName]: ITaskData[] }` as the single source of truth for node badges, connector counts, the Logs panel and the Executions list. Include the required `source: Array<ISourceData|null>` on every task entry, and allow `null` slots in `data.main[]`. Model retry with n8n's real clamps — tries `Math.min(5, Math.max(2, maxTries || 3))`, wait `Math.min(5000, Math.max(0, waitBetweenTries || 1000))` — and note that **retries fire under Continue-on-error too**; do not build the "retry only when Stop Workflow" behaviour, which was a bug fixed in 1.43.0.

5. **NDV as a three-pane modal INPUT | Parameters | OUTPUT. (must)** All the supporting copy is verified: the Settings tab set (Always Output Data, Execute Once, Retry On Fail → Max. Tries / Wait Between Tries (ms), On Error with its three verbatim descriptions, Notes, Display Note in Flow?), the pin banner flow, and the pin restrictions (single main output, no binary, dev-only). Cap Max. Tries at 5 and Wait Between Tries at 5000 ms in the UI, matching n8n.

6. **Safe `{{ }}` resolver — whitelisted paths plus helpers, no `eval`. (should)** Scope it to the verified variable surface: `$json`, `$binary`, `$now`, `$today`, `$execution`, `$itemIndex`, `$input`, `$parameter`, `$prevNode`, `$runIndex`, `$vars`, `$workflow`, `$("Node").first()/.last()/.all()/.item/.isExecuted`, and helpers `$if`, `$ifEmpty`, `$jmespath`, `$max`, `$min`. Fail loudly with a visible sentinel. *(The "Tournament / riot-tmpl" attribution was not verified — don't repeat it.)*

7. **Bottom Logs panel + workflow-scoped Executions tab. (should)** Both are derived views over the same executions array. All the copy is verified verbatim — reuse it as a model, including "Nothing to display yet. Execute the workflow to see execution logs.", the "{status} in / for / until {time}" templates, and the status vocabulary (Succeeded / Error / Running / Queued / Canceled / Could not complete / Starting soon).

8. **Collapse the legacy Business Rules > Workflows list into the canvas. (should — validate the premise first)** The migration design is sound: linear steps → nodes chained on the 224px step, `approval → Request Approval`, `assign → Assign to Queue/Agent`, `notify → Notify`, `wait → Wait`. **That legacy model is unverified** — confirm the actual shape in the repo before writing the migration.

9. **Lookup Records + Loop Over Items as the item-model demo. (should)** Fully supported: `outputNames: ['done','loop']` with **done at index 0**, `context.currentRunIndex` / `context.noItemsLeft`, and the loop-back edge exercising the two-segment orthogonal route. The "1 item → 7 items" connector contrast is the cheapest way to teach the data model.

10. **Sticky notes + Tidy Up. (nice)** Sticky notes: seven presets plus custom hex, markdown, behind-nodes layering, edge-drag resize, Shift+S — all verified. **Tidy Up: use dagre-equivalent semantics** (`rankdir: 'LR'`, `ranksep = 128`, snap by node center). A layered longest-path substitute is fine for demo-sized DAGs, but describe it as an approximation of dagre.

11. **Connections (credentials) registry. (nice)** Credentials-as-first-class-objects is verified n8n architecture (tested on save, "*node name* account" default naming, project/personal scoping, Fixed vs End-user for OAuth on Enterprise). Reuse the validation-issue badge machinery for missing credentials. **In RelayHQ this is a shape, not a broker** — see §5.

#### Not verified

- **All RelayHQ specifics.** The repo was unreadable in this pass. Unverified: that gap #1 is "business rules that actually HANDLE approvals"; that a Business Rules > Workflows sub-tab exists with step types `approval|assign|notify|wait`; that RelayHQ has exactly 8 form field types (and therefore the "gaps vs n8n" list); the ~7500-line in-memory single-page architecture; the existing Tailwind tokens, icon library, and entity color palette.
- **ServiceNow record-trigger run options** — "Once", "For each unique change", "Only if not currently running", "For every update". The docs confirm a "Run trigger" setting exists but do not enumerate it; these four names are community-sourced.
- **ServiceNow "Ask for Approval" scripted rule grammar** as verified *by this dimension* — `ApprovesAnyU[]`, `ApprovesAllU[]`, `RejectsAnyU[]`, `RejectsAnyG[]`, `ApprovesRejectsAnyU[]`, `ApprovesAnyG[]`, the `&`/Or combination, the Yokohama Flow Debugger, and `com.snc.process_flow.reporting.level = FULL`. *(The grammar itself **was** independently verified in §3.1 from a different source; cite it there, not here.)*
- **ServiceNow flow-logic elements** (If/Else/Else If, For Each, parallel, Wait for condition, End) and the claim that **For Each succeeds on 0 records**.
- **Zapier path rule types** — custom AND/OR rules, "Always run", and the auto-relocated/renamed "Fallback" branch. Neither cited Zapier page contains these.
- **Make's full built-in Flow Control / Tools module list** (Router, Converger, Sleep, Set/Get Variable, Increment Function, Text/Numeric Aggregator) and the module-kind taxonomy.
- **Make's canvas being radial/free-form with circular module icons** — plausible and widely observed, not verified from a fetched source.
- **n8n's resolved hex colors.** Everything is CSS custom properties resolving through a design-system theme file. The only literal verified is the running-state gradient `rgba(255, 109, 90, …)`.
- **Per-handle vertical offsets for multi-output nodes** (e.g. whether IF's true/false handles sit at 33%/67%). Only the node *height* formula is verified.
- **n8n's expression engine internals** — the "Tournament / riot-tmpl" claim was not checked. The CodeMirror stack and Luxon dependency ARE verified.
- **Executions list rendered column set** — reconstructed from i18n keys.
- **End-user credential redaction** — that executions using an end-user credential show redacted data to non-executing users.
- **Cron field order** — n8n's docs contradict themselves. Test in a live instance.

---
### 3.6 Self-service portals, service catalogs, deflection, and visual how-to content

**What this dimension establishes.** The vendor set converges on a three-or-more-level browse taxonomy, and **two independent vendors cap it at exactly three levels** — Intercom ("You can create up to three levels of collections") and Freshservice ("multi-level categories (up to three levels)"). That is real external validation for RelayHQ's Product > Subcategory > Item tree. Zendesk enforces the leaf-only rule RelayHQ already has: "Articles cannot appear under categories." So **RelayHQ's tree is not novel**; what is defensible is that RelayHQ hangs **both** help content and multiple request forms off the same leaf — the same join ServiceNow built Unified Taxonomy inside Employee Center to achieve, and that Atlassian built help-center Topics to achieve.

The most universal deflection mechanic in the set is **search-as-you-type article suggestion bound to the request's first free-text field**. RelayHQ has none of it and, critically, **never measures deflection** — its Yes/No prompt sets a boolean and discards it, so the product cannot make its own argument.

**Be disciplined about the numbers.** Every deflection benchmark in circulation here traces to a single aggregator blog that is itself an AI-support vendor and that concedes it cannot link several of its named sources. Zendesk's own deflection blog publishes formulas and a hypothetical and cites **zero** benchmark percentages and **zero** customer results — which is itself the most useful data point: *the market leader does not publish a deflection number.*

**Sourcing conditions that limit this whole dimension.** ServiceNow's documentation sites and Atlassian's support site are client-rendered SPAs; direct fetches returned navigation trees only. `help.salesforce.com` returned an error page. All ServiceNow specifics, the JSM numeric limits, and the Salesforce component behaviour were recovered from indexed content and community posts rather than read from rendered official article bodies. **Exact wording is approximate throughout those sections.**

#### Verified findings

**Taxonomy shape**

- **Zendesk** *(verbatim)*. Hierarchy is Category > Section > Article. "Articles cannot appear under categories. Sections can contain sections or articles or both." Nested sections give "a maximum of six levels using nested sections: Category > section > section > section > section > section," with "a maximum of 200 subsections in a section," on Guide/Knowledge Professional or Enterprise. *Correction:* Zendesk does not say deep nesting cannot be displayed — it says "you might need to modify the code for your Category page to display the subsections," a theme-customization requirement.
- **Intercom** *(verbatim)*. "You can create up to three levels of collections." "There's a maximum limit of 500 articles per Help Center collection." "You can only add icons for first-level collections. All sub-collections will have the default folder icon." Intercom's REST API model additionally defines Sections as "subdivisions of a collection, with a collection potentially having multiple sections."
- **Freshservice** *(verbatim)*. "Service Catalog now supports multi-level categories (up to three levels)." **The strongest external validation for RelayHQ's exactly-three-level tree** — an ITSM vendor, not a help-center vendor, landing on the same depth.
- **ServiceNow Employee Center.** Unified Taxonomy is "a structured collection of hierarchical topics that consolidates various content types" — requests, articles, quick links and employee communications — across departments. Seven OOTB models: Technology (IT) Services, Human Resources, Workplace Services, Purchases and Expenses, Legal, Health and Safety, Cloud Services. **Depth is 2–5 levels, not 3–4:** IT Services reaches 5 (Technology Services > Hardware > Computers > …), HR / Health and Safety / Cloud Services are 3, and Workplace Services / Purchases and Expenses / Legal are 2. Topic visibility is controlled by user criteria at the topic level, with useful mechanics: unchecked security box means visible to all; checked with no criteria means hidden from all; children inherit the parent's criteria unless overridden, and re-inherit on move. Unified Taxonomy is a **capability of Employee Center**, not a separate product.
- **Atlassian JSM.** "In the customer portal, your request types are organized vertical tabs based on your groups." You need more than one group for tabs to appear, and Atlassian recommends grouping once you have seven or more request types. Two behaviours worth copying: (a) **"you can add a request type to more than one group"** — genuine multi-homing, which RelayHQ's deep-copy approximates only as a copy; (b) "To hide a request type from your portal, remove it from all portal groups" — but **hidden request types still appear in search** and can still be added to help center topics, **decoupling *browsable* from *findable***, a distinction RelayHQ lacks.

**Cross-cutting overlays and knowledge-gap detection**

- **JSM topics** *(sourcing caveat: recovered from the indexed content of Atlassian's official doc page, not a rendered article body — re-check before quoting to a client)*. Up to 15 topics per help center; up to 50 request forms, external resources and/or knowledge base articles in one topic. Same architectural move as ServiceNow's unified taxonomy: **one navigable node mixing "how to do it yourself" with "the form to ask us."** RelayHQ's item node already does this natively via `actions.{subforms[], knowledgeBases[]}` — a genuine structural advantage worth making explicit in the demo.
- **JSM suggested topics.** "A topic will be suggested only when more than five support requests pertaining to it are received," where a topic is suggested only if no related articles exist. Qualifiers: the analysis window is the **last 30 days or the most recent 200 requests** in a space, the list **refreshes weekly**, and the feature **requires Premium or Enterprise**. The threshold is directly implementable client-side: count submissions per item where the item has zero attached guides, surface the gap once N > 5.

**Catalog mechanics (ServiceNow — community-sourced; see Not verified)**

- **Catalog item vs record producer.** A catalog item opens a Request (`sc_request`) plus Requested Item (`sc_req_item`), attaches workflow/flow, catalog tasks and approvals, and has shopping-cart functionality. A record producer inserts a single record into a selected target table (incident, change, custom) and has no cart. In scripts, `current` is the target record and producer variables are reached via the `producer` object; `producer.redirect = 'table.do?sys_id=' + record.sys_id` controls post-submit navigation; `current.setAbortAction(true)` suppresses the standard record creation.
- **Variable types — 31 named types across roughly 26 documentation entries** (Container start/split/end share one entry, as do Date/Date and time/Duration and Custom/Custom with label). Full list: Attachment, Break, Check box, Container start, Container split, Container end, Date, Date and time, Duration, Email, HTML, IP Address, Label, List collector, Lookup multiple choice, Lookup select box, Custom, Custom with label, Masked, Multi-line text, Multiple choice, Numeric scale, Reference, Requested for, Rich Text Label, Select box, Single-line text, UI page, URL, Wide single-line text, Yes/No. **RelayHQ has 8.** The strategically important absences are the **layout/content** types — Container Start/Split/End (a container can be split into two or three columns), Label, Rich Text Label (formatted, with images and links), Break, HTML. Those are what let a form embed instructional content **inside** the form rather than only above it, and they are trivial to add client-side.
- **Variable sets.** Single-row sets group reusable variables for a single entity; **multi-row sets capture data in a grid layout for a group of entities**, rendered as a table with add/edit/delete rows — canonical examples being an HR reorg producer capturing a group of employees, and ordering multiple VMs with per-unit configuration as rows. The same set attaches to many catalog items and record producers, and edits propagate to all associated items.
- **Catalog UI policies — a confirmed limitation worth copying as a constraint to AVOID.** A Catalog UI Policy cannot show/hide variables that live in a **different** variable set based on conditions from the current one. The documented workaround is a Catalog Client Script using `g_form.setDisplay('variable set name', false)`, with an onLoad script to hide initially and the affected variables set non-mandatory. **RelayHQ should evaluate conditions across the whole form scope from day one.**
- **Order guides.** Default three steps — Describe Needs, Choose Options, Check Out. "To omit the third step, select the Two step check box." A rule base defines conditions determining which catalog items are included. Cascading is enabled with the "Cascade variables" check box, and **the binding mechanism is variable-name matching, not explicit mapping**: a variable named `u_employee_name` on the Describe Needs page requires an identically named variable on each target item.
- **Guided Decisions.** Guides an *agent* through questions, each based on previous answers, toward an optimal resolving action. Two components: **Decision Trees** (nodes routing answers to the next node or a recommendation; trees can be nested inside other trees for reuse) and **Guidance records** (KB articles, checklists, scripts, escalation instructions). Embeddable in a Playbook or served as a Recommended Action. **Agent-facing, not end-user portal facing** — which is what makes an end-user version a genuine differentiation angle.

**Freshservice — the best-sourced material in this dimension (verified verbatim)**

- **14 catalog item field types**: Single line text ("Allows the entry of a single-line or multi-line text input"), Paragraph text, Checkbox ("boolean (true/false)"), Number, Dropdown, Multi dropdown, Date, **Dependent field ("Derives its values based on a parent field value")**, Decimal, URL, **Content ("Allows the entry of snippets of information")**, Rich text editor (1 MB per field, max 5 per service item, Pro/Enterprise only), Attachment (max 10 per service item), Formula (max 5 per service item). RTE, Attachment and Formula all require V2 of the Requester Portal. The two directly copyable ideas are **Content** (a static instructional snippet rendered inline in the form — the in-form deflection surface) and **Dependent field** (cascading options).
- **Shared Fields.** "This allows for the reuse of fields across multiple service items or categories in a workspace, eliminating the need for recreation." Eleven supported types (single line text, paragraph, dropdown, checkbox, number, multiselect, date, dependent field, decimal, URL, content). Scope can be specific items in specific categories, or "Link all service items to link this field with all the service items irrespective of the service category." Permissions are set per shared field "such as Display to approver, Display to requester, Requester can edit, and so on" — **the "and so on" implies more toggles than the three named**, so treat those three as a starting set.
- **Related items and child tickets.** Service items can include additional items, certain ones markable as mandatory, with a "Create Child Requests for each of the items above" checkbox that spawns individual child tickets, each under its own department and SLA.

**Deflection surfaces and measurement**

- **Zendesk post-submit popup** *(verbatim; **now labelled Legacy by Zendesk** — treat the interaction as a proven design reference, not Zendesk's current shipping path)*. After submission an automated pop-up displays "up to three links to potentially relevant knowledge base articles." Exits are **"Yes, close my request"** and **"No, I need help"**; the article title opens the full article in a new tab. Both subject and description/body feed the algorithm, which matches against article titles and introductions. **The suppression rule is the sharpest detail: "If an end user submits a request and autoreplies is unable to find any recommended articles, then the automated pop-up window will not appear."**
- **Zendesk article-recommendation KPIs** *(verbatim)*. **Suggestion rate** "displays the percentage of customer inquiries where an autoreply with articles was sent." **Click-through rate** "displays the percentage of responses clicked by end users from the total responses offered," and reports clicks, clicked articles and **median click time**. **Resolution rate** "displays the percentage of inquiries that are resolved with no agent involvement." Also: "The Article recommendations reports do not include data from the messaging channel." **Zendesk publishes the metric names and prose definitions but not the denominators or formulas.**
- **Zendesk self-service score.** Defined as "the number of unique visitors to your knowledge base against the total number of users who've submitted support tickets" — pageviews divided by tickets created over the same period. The blog's form is "Ticket deflection rate = Total users of your help center(s) / Total users in tickets," with the worked example "for every four customers who resolve their issue using self-service, one customer submits a support request. In this case, your ticket deflection rate would be 4," plus a chatbot variant. **Zendesk's blog cites no benchmark percentages and no customer results.** Article voting displays "a number representing the difference between positive and negative votes," which goes negative when downvotes exceed upvotes.
- **Salesforce Case Deflection.** The component "searches text as it's being entered into the Contact Support Form component, and returns relevant articles and discussions," rendered in a **right-hand panel beside the live form**; users who find their answer leave without submitting. It generates its own deflection metrics. **Important addition: for guest users, case deflection matches article TITLES ONLY and does not return matches from the article body** — a real design lesson about anonymous portal traffic. This is the concurrent-panel variant; Zendesk's is post-submit popup; JSM's is inline-under-the-field. **All three bind to the request's free-text summary.**
- **JSM article suggestions.** Suggested articles appear **while the customer types in the Summary field**. Configured per request form under Space settings > Knowledge base > Control article suggestions, scopeable with "Only show articles labeled," with AI-determined snippets shown from each article.

**Stories UI and accessibility**

- **`react-insta-stories` defaults** *(verbatim)*. `defaultInterval` **1200 ms**, `width` 360, `height` 640, `loop` false, `isPaused` false, `keyboardNavigation` false, `preventDefault` false, `preloadCount` 1, `renderers` [], plus onStoryStart / onStoryEnd / onAllStoriesEnd / onNext / onPrevious. Interaction: tap right advances, tap left goes back, tap-and-hold pauses; with keyboard navigation on, arrows navigate, up opens "See More," Escape/down closes. **The 1200 ms default is far too fast for instructional content** — instructional slides need 5000–8000 ms or manual-only advance.
- **Stories interaction mechanics** *(confirmed as a **developer convention**, not a Meta specification)*. Only the active progress segment animates 0→100% while earlier segments stay full and later ones empty; the viewport splits into left (previous) and right (next) halves; `pointerdown`/`pointerup` pause and resume the timer; roughly 4 seconds per static slide; a `requestAnimationFrame` timer loop rather than CSS animation, because "you control the clock" and pause/resume/tap-to-skip become trivial.
- **WCAG 2.2.2 Pause, Stop, Hide (Level A)** *(verbatim, both clauses)*. Moving/blinking/scrolling: content that "(1) starts automatically, (2) lasts more than five seconds, and (3) is presented in parallel with other content" needs a pause/stop/hide mechanism unless essential. Auto-updating: content that "(1) starts automatically and (2) is presented in parallel with other content" needs pause/stop/hide or frequency control. W3C is explicit: "there is no five second exception for auto-updating since it makes little sense to auto-update for a few seconds and then stop." **Note the Understanding doc's own illustration cuts both ways** — a stock ticker beside article text needs a control; a full-page advertisement or loading animation shown as the sole content does not. A full-screen Stories takeover therefore sits in genuinely arguable territory.
- **WCAG 1.2.2 Captions (Prerecorded), Level A** *(verbatim)*. "Captions are provided for all prerecorded audio content in synchronized media, except when the media is a media alternative for text and is clearly labeled as such." SC 1.2.1 (audio-only/video-only alternatives) and SC 1.2.3 are also Level A. Practical consequence: **a silent screen-recording slide needs a text alternative**, which RelayHQ's rich-text caption satisfies only if the caption fully *describes the action* rather than labelling it. Any narrated slide needs real captions.
- **Progressive disclosure, NN/g.** Progressive disclosure "defers secondary options to a subsidiary screen," which "focuses users' attention on the primary options, which are the only ones shown by default," makes applications easier to learn, and reduces errors. **This is the one genuinely defensible evidentiary anchor for the whole guided-narrowing thesis.**

**Vendor claims about visual guides — positioning language, not evidence**

- **Guidde.** Guidde's Scribe comparison page cites "34% higher knowledge retention rates" and "28% faster" training completion, attributed to "a 2026 study by the Association for Talent Development," **with no link, no methodology, no publication detail**. "20%+ reduction in support tickets" is explicitly framed as "Guidde customers report." The frequently-quoted "31% higher knowledge retention" figure **could not be located on the cited page at all**.
- **Pendo.** Two figures are real and locatable, on Pendo's "How to use Pendo to reduce the burden on your support team" post: Elsevier reported a **42.8%** reduction in first-line support queries after deploying an in-app Resource Center, and WebPT reported a **50%** drop in support questions about a page after adding a tooltip to an insurance field. **Both are self-published, unaudited vendor case studies.**

**RelayHQ code (verified directly against source at `~/.Trash/relayhq-abandoned-2026-08-16`)**

- `client/src/components/kb/CarouselViewer.tsx` is exactly **101 lines**. The container is `aspect-video` (16:9 landscape). Navigation is two absolutely-positioned `ChevronRight` buttons **at `left-3` and `right-3` with `top-1/2 -translate-y-1/2`**. State is a single `currentSlide` index with wraparound in `goToSlide`. Video slides render as `<video controls>`. There **are** dot indicators and a `1 / N` slide counter. There is **no** segmented progress bar, no tap-zone hit areas, no auto-advance timer, no hold-to-pause, no keyboard handling and no portrait mode. **The gap is structural, not cosmetic.**
- `client/src/components/forms/FormPreview.tsx` is exactly **551 lines**. `knowledgeBases` render at line 365 and `subforms` at line 427 — **help resources genuinely precede request forms**. The "Did this resolve your issue?" prompt is at line 256, with the issue-resolved screen at lines 121–122. **The Yes/No answer is never recorded:** `handleKBYes = () => setKbResolved(true)` and `handleKBNo = () => setExpandedKB(null)`. No counter, no session log, no persistence, no derived rate. **The deflection event happens and is discarded.**

#### Recommendations

**1. Deflection Ledger — instrument every portal event and render a live scoreboard. (must)**

Highest leverage in the dimension, and the premise is verified in code. A viewer cannot be persuaded the guided model deflects better than a flat form list unless the prototype **counts**. Client-side only: an event array in React state, optionally mirrored to localStorage, plus derived selectors.

Because Zendesk publishes metric *names* and prose definitions but not denominators, and its own deflection blog cites no benchmark at all, **label RelayHQ's tiles with your own explicit formulas on screen** rather than implying an industry-standard definition. Being the one who states the denominator is a credibility win.

```
event = { id, ts, sessionId, type, productId, subcategoryId, itemId, kbId, subformId,
          slideIndex, query, suggestedKbIds[], mode }
// type ∈ search | search_no_result | node_view | guide_open | guide_slide | guide_complete
//        | resolve_yes | resolve_no | form_open | form_submit
//        | suggestion_shown | suggestion_click

// DERIVED:
deflectionRate  = resolve_yes / (resolve_yes + form_submit)
suggestionRate  = suggestion_shown / form_open
clickThroughRate= suggestion_click / suggestion_shown
medianClickTimeMs                                   // Zendesk reports this one — copy it
perItemRollup   = { submits, guides, gap: submits > 5 && kbCount === 0 }   // JSM's >5 rule
```

UI: a Deflection tab with four stat tiles, a funnel bar (Sessions → Browsed → Guide opened → Resolved vs Submitted), a Knowledge-gaps table implementing JSM's >5 rule with a "Create guide" deep link, a live toast in the portal preview so the number moves as the viewer clicks, and a Reset Demo button.

**2. Suggested-guides-as-you-type, bound to the subform's first free-text field. (must)**

The most universal mechanic in the set. RelayHQ's structural advantage is that it already knows the exact item node, so the candidate set is **pre-scoped to that leaf** and scoreable client-side by token overlap over title / tags / slide captions — no backend, no embeddings.

Copy Zendesk's suppression rule in spirit: **if nothing clears the threshold, render nothing** rather than an empty panel. Copy Salesforce's guest-user lesson: for anonymous visitors Salesforce matches article **titles only**, which is a hint that title quality carries the whole mechanic — so make guide titles a first-class authoring concern (Zendesk's guidance is to title articles the way a customer would phrase the problem: "How do I reset my password?").

On close, offer Zendesk's two exits: "Yes, close my request" (fires `resolve_yes`) and "No, I need help" (returns to the form with data intact). **The 12-character minimum and 300 ms debounce are sensible defaults, not vendor-derived** — tune by feel.

**3. Replace `CarouselViewer` with a real vertical Stories player. (must)**

The "Instagram-style guides" claim is currently unbacked. The conventions to hit — only the active segment animating 0→100%, left/right half tap zones, `pointerdown`/`pointerup` hold-to-pause, a rAF loop rather than CSS animation, **portrait 9:16 framing** — are developer conventions rather than a published Meta spec, but they are consistent and they are what makes a viewer say "that's Instagram" in two seconds. **The aspect-ratio change alone carries most of the recognition.**

Do **not** ship `react-insta-stories`' 1200 ms default; instructional slides need 5000–8000 ms. Per WCAG 2.2.2 (Level A), ship a **persistent, visible, keyboard-reachable pause/play control** — hold-to-pause alone is not keyboard-operable. Honour `prefers-reduced-motion` by defaulting `autoAdvance` to false. For video slides, `<track kind="captions">` where narration exists (SC 1.2.2) and a visible "Show text version" toggle for silent screen recordings (SC 1.2.1).

*Worth knowing while you build:* W3C's own example of content that does **not** need a pause control is a full-page item shown as the sole content, so a full-screen Stories takeover is arguably exempt. **Ship the control anyway** — it costs nothing and the downside of guessing wrong is a Level A failure.

Put the "Did this resolve your issue?" prompt in the player's **finish state**, so the deflection prompt lives inside the player rather than after it.

**4. Conditional field display on subforms — a UI-policy engine. (must)**

Every vendor has this and RelayHQ has none. Without conditional display, "multiple customizable subforms" is just "several static forms." With it, the argument becomes **two stages of progressive disclosure** — the tree narrows to the right FORM, then the form narrows to the right FIELDS — which is exactly the NN/g principle the whole design rests on, and the only claim in this space with a credible source behind it.

**Copy ServiceNow's documented limitation as a constraint to avoid:** their policies cannot show/hide variables across variable sets, forcing brittle client scripts. RelayHQ should evaluate conditions over **whole-form scope** from day one. Reuse the condition AST from §3.1 recommendation 1.

Also add the two layout types RelayHQ lacks and both vendors have: a **`content` block** (static rich-text instruction rendered inline — Freshservice's Content type, "snippets of information") and a **`section` container** (ServiceNow's Container Start/End, splittable into two or three columns). **That is what lets guidance live inside the form, not only above it.**

Ship a visible counter — "4 of 9 fields shown, 5 hidden by your answers" — as on-screen proof of progressive disclosure.

**5. Split-screen "Flat list vs Guided" comparison mode. (must)**

The stated goal is to **prove** the model is superior, and polish on the guided experience alone proves nothing because the viewer has no baseline. There is no vendor analogue, because it is a demo device rather than a product feature — which is precisely what turns the prototype into an argument. Nearly free: the flat pane is a derived flatten of the existing tree, so both panes render from one source of truth and cannot drift.

Sticky footer counters under each pane: "Options on screen: 47 vs 4", "Clicks to reach a form", "Fields shown", "Guides offered before the form: 0 vs N", and the decisive row **"Resolved without a ticket: 0 vs N"** driven by the Deflection Ledger. Render the flat pane at full opacity to show the wall of options. **This is the screenshot that sells the thesis — and unlike any vendor statistic in this document, it is a measurement RelayHQ makes itself, in front of the viewer.**

**6. Portal search returning guides AND request forms in one ranked list, with no-result capture. (should)**

Atlassian confirms hidden request types remain searchable and that portal group names appear in search results alongside request types, so JSM clearly treats search as a surface where knowledge and forms coexist. **The specific "one merged ranked list" framing is design inference, not a documented Atlassian behaviour** — build it because it is right, not because a vendor certified it. Adjacency of the deflection option to the escalation option at the moment of intent is the actual argument.

Show the full breadcrumb Product > Subcategory > Item on every result so the taxonomy does visible work rather than being an invisible admin construct. Log `search_no_result` silently; it feeds the knowledge-gap table and closes the loop with recommendation 1.

**7. "My Requests" status panel on the portal home. (should)**

What is verified: ServiceNow's My Requests widget is driven by a My Requests Filter configured under Service Catalog > Catalog Administration, defining table, filter condition, title and display fields, and REQ/RITM/INC records appear OOTB for the submitting user. **The two named views "Open Requests" and "Closed Requests" were not confirmed** — design your own Open/Closed tabs on the merits.

The argument stands on its own: without this, RelayHQ's portal is **write-only** — a viewer submits and the request vanishes, which undercuts the "this is a real portal" impression more than any missing feature. Add the thing no vendor does: **"You viewed 2 guides before submitting"** per ticket, tying the knowledge layer to the request layer.

**8. Shared Field Sets — reusable field groups attachable to many items. (should)**

Both ServiceNow and Freshservice ship this, for the same reason: without it, "multiple customizable subforms" collides with maintenance reality. Support ServiceNow's two layouts: **single-row** (a reusable group of fields) and **multi-row** (an add/edit/delete row grid), the latter genuinely useful for N laptops with per-unit config. Carry per-field permissions — Freshservice names "Display to approver," "Display to requester," "Requester can edit," and its "and so on" phrasing suggests more, so treat those three as a starting set. **They connect directly to the approvals engine.**

Render attached sets as locked, visually distinct blocks above local fields so authors see inherited vs local, and put a "Used by 12 items" count on each set to make reuse visible.

**9. Guided decision tree as a fourth action type on item leaves. (nice)**

ServiceNow's Guided Decisions is a nestable node tree whose leaves are Guidance records carrying KB articles, checklists, scripts or escalation instructions — and confirmed **agent-facing**. Putting it end-user facing on the portal is genuine differentiation, and it slots into `item.actions` as a third array. It handles the case the drill-down cannot: **when the right answer depends on the user's situation rather than the service they want.**

One question per screen, a back chevron, and a breadcrumb of answers given so the path is auditable. Every leaf resolving to a guide gets the Yes/No prompt so decision paths feed the Deflection Ledger. Reuse the clause builder from recommendation 4.

**10. Announcements strip and a KB freshness indicator. (nice)**

Keep the announcements strip — cheap, universal, no evidentiary weight needed.

**Rebuild the freshness rationale.** The original rested on "45% deflection for KBs updated within 30 days vs 18% for those unaudited 6+ months," which comes from a single aggregator blog that is itself an AI-support vendor and does not link its primary sources. **That is not an effect size you can design a claim around.** Build the freshness indicator anyway, on a defensible rationale: Zendesk's own guidance ties article suggestion quality to title and content phrasing, and stale guides silently degrade every deflection surface in recommendations 2 and 6. A freshness pill (green/amber/red), a sort-by-staleness control, and a "Guides updated in last 30 days: 8 of 14" header stat are good authoring hygiene regardless of any benchmark. **If you plot deflection against freshness, plot RelayHQ's own demo data. Do not put the 45%/18% figures on screen.**

#### Not verified

**Deflection benchmarks — all of them.** The KB median 18% (5–35%), AI self-service median 22% (8–45%), pre-LLM chatbot median 11% (3–25%), the vendor-vs-independent gap, and the 45%-vs-18% freshness effect all trace to `happysupport.ai`, a single aggregator that is itself an AI-support vendor. It names Zendesk, Intercom, Forrester, Aberdeen, HDI, Gartner, Drift, HubSpot and Salesforce but concedes it cites some without links because URLs are paywalled or unstable, and that "definitions vary materially across sources." No primary HDI, SuperOffice, Forrester or Gartner report was accessible. *(Also note a transcription error in the original research: that source states vendor claims cluster at **30–60%**, not 40–60%.)* **Do not use any of these figures.**

- **"Only 35-50% of article views actually resolve the user's underlying question."** Attributed to HDI Service and Support Reports by that same secondary source. The HDI report itself was not seen.
- **Zendesk metric denominators.** Zendesk names the three KPIs and describes them in prose but publishes no formulas. Whether the "up to three articles" limit is configurable is also unverified. These autoreplies docs are now labelled **"(Legacy)"** by Zendesk.
- **Salesforce Case Deflection specifics.** Which fields it searches (Subject only vs Subject + Description), the default number of articles returned, whether that count is configurable, and whether it has a built-in helpful/not-helpful control. *(The guest-user title-only behaviour IS verified.)*
- **Trigger thresholds for typing-based suggestions.** The minimum character count that triggers JSM's or Salesforce's suggestions is unverified. The 12-character / 300 ms debounce in recommendation 2 are RelayHQ's own defaults.
- **ServiceNow details that could not be confirmed:** the record producer `sys_class_name` value `sc_cat_item_producer`; the KB numbers **KB0610341** and **KB0681355** — do not cite either ID; the claim that a variable used in a UI policy *condition* must be present on the form for the condition to evaluate; the UI policy form's "Execute if true"/"Execute if false" script bodies and the "variable action logger"; the specific New Employee Hire order-guide rule example; and the two named My Requests OOTB views.
- **Employee Center "learning content"** as one of the consolidated content types — the verified list is requests, articles, quick links and employee communications only.
- **Intercom nested-collection render order** — the claim that sub-collections always render below a parent's articles is not in the docs.
- **Instagram's actual per-slide duration.** Not documented by Meta anywhere findable. The ~4–5 seconds is a developer-community convention. Likewise, the "tap is intra-set, swipe is inter-set" distinction was not covered by the source that verified the other mechanics.
- **Whether a full-screen Stories overlay legally triggers WCAG 2.2.2.** Genuinely arguable — W3C's Understanding doc explicitly exempts full-page content shown as the sole content. Ship the pause control regardless. This is a judgement call, not a settled reading.
- **"Video beats text" retention evidence.** No independent, peer-reviewed study comparing step-by-step screenshot guides against video against text for software how-to tasks was found. Guidde's 34% / 28% cite an unlinked study; the widely-repeated 31% figure could not be located at all. Pendo's 15%, 27.5% and 60% figures could not be located; only Elsevier's 42.8% and WebPT's 50% exist, as unaudited self-published case studies. **The honest argument for Instagram-style guides is engagement, recognition and progressive disclosure (NN/g) — not proven retention gains.**
- **Whatfix and Pendo authoring-UI mechanics.** Not researched in depth. If the in-app-tour authoring model matters for the build, that needs a separate pass.
- **RelayHQ repo location.** The code claims above were verified against `/Users/philbueschel/.Trash/relayhq-abandoned-2026-08-16`. Confirm the repo's intended location and state before acting.

---
## 4. Recommended build order for RelayHQ

The sequence below is dependency-aware. **The organising insight is that five of the six named gaps share three pieces of machinery**, so building those three first collapses roughly half the remaining work:

- **The condition AST + `<ConditionBuilder>`** is consumed by rule conditions, approval-policy applicability, auto-approve thresholds, conditional routing, change decision rows, risk conditions, subform field visibility, software reclamation rules, alert thresholds, and automation-canvas IF/Switch/Filter nodes. **Ten consumers, one component.**
- **The approval engine** (`ApprovalPolicy` + `ApprovalRequest` + stage quorum) is consumed by the service catalog, change management, the CAB workbench, asset reclamation, shared-field-set approver permissions, and the automation canvas's Request Approval node. **Six consumers, one engine.**
- **The custom-field registry** is consumed by the subform builder, task/ticket custom fields, and asset model Fieldsets. **Three consumers, one registry.**

Phase 0 is prerequisite to almost everything and should not be skipped for demo reasons; it is small and it is what makes every later phase demonstrable.

---

### Phase 0 — Foundations *(no user-visible feature; everything downstream depends on it)*

1. **People / Org directory.** Users, groups, manager pointer, department, cost center, location. Without it, dynamic approvers, four ownership roles, workload capacity, delegation, and per-department cost reports are all impossible. Empty resolution must be an explicit `unresolvable` state, never a silent skip. *(§3.1 rec. 4)*
2. **Simulated clock with a visible speed control.** Every time-shaped behaviour in this document — approval reminders, wait nodes, contract expiry, warranty countdowns, hourly sweeps, freeze windows, sprint transitions — is invisible in a demo without it. *(§3.1 rec. 5)*
3. **Event bus + append-only execution log** with a `MAX_CHAIN_DEPTH` constant (10, matching Jira's fixed limit) and Jira's five status words: Successful / No actions / Some errors / Loop / Throttled. *(§3.1 rec. 6)*
4. **localStorage persistence behind explicit Save / Reset**, so "Reset demo data" is reliable. *(§3.1 rec. 14)*

### Phase 1 — The condition layer *(unlocks ten consumers)*

5. **Typed condition AST**, capped at **two levels of nesting** on Jira's explicit authority. Per-field-type operator registry seeded from Zendesk's matrix (including the four `satisfaction_score` operators and the three negative change-detection operators). `evaluate()` returns `{result, trace}`. *(§3.1 rec. 1)*
6. **Shared `<ConditionBuilder>` component** with a live match count. *(§3.1 rec. 1, 9)*
7. **Plain-English sentence summary** as a pure function over the AST — monday's recipe model. Cheap, and the most prospect-legible thing you can ship this early. *(§3.1 rec. 13)*

### Phase 2 — Rules and approvals *(gap #1)*

8. **Unified ordered Rule list** with a `kind` discriminator (event vs clock), replacing the three Business Rules sub-tabs. Integer order defaulting to 100, **ties resolved deterministically by name** (ServiceNow leaves ties undefined; RelayHQ should not). Scheduled rules require a self-cancelling condition — Zendesk's safety rail. *(§3.1 rec. 2)*
9. **Authored, ordered, first-match-wins routing** with a visible "effective routing" resolver table. *(§3.1 rec. 10)*
10. **`ApprovalPolicy`** — the ServiceNow decision-table shape: Policy Inputs → ordered Decisions (conditions from Phase 1) → Approval Definitions with action / approver source (dynamic vs static) / wait-for (group-only) / mandatory. Ship the **Simulate** panel; showing which decisions fire against a real record is the demo. *(§3.1 rec. 3, §3.2 rec. 2)*
11. **`ApprovalRequest`** — per-approver rows on the `sysapproval_approver` shape **minus `order`**, states `requested`/`approved`/`rejected`/`cancelled`/`not required`, quorum on the **stage** (`Any`/`All`/`Res`/`%`/`#`/`FirstResponder`, plus a separate reject ruleset, plus Sequential as a stage arrangement). *(§3.1 rec. 3)*
12. **"My Approvals" workspace lens + approval chip on the ticket card**, showing stage state separately from overall request state. *(§3.1 rec. 7)*
13. **Delegation** as a date-windowed record with per-scope checkboxes, resolved at notify-time, recording who clicked vs whose authority was used — and **designing out** ServiceNow's approvals-without-notifications footgun. *(§3.1 rec. 8)*
14. **Re-approval-on-change** with an explicit reason banner and the three-way handling choice (cancel / delete / leave alone). *(§3.1 rec. 11)*

### Phase 3 — Change management *(gap #2a; consumes Phases 1–2 wholesale)*

15. **Change models as data** — states, transitions, required fields, guards. Emergency sets `allowPastPlannedDates: true`; Standard enters at Scheduled; Emergency skips Assess. *(§3.2 rec. 1)*
16. **Transition gating** on required fields, task completion and approval status — Freshservice's lifecycle-condition model. Change tasks get **six** states including **Closed Failed**. *(§3.2 rec. 11)*
17. **Deterministic risk engine** to Freshservice's arithmetic, with ordered first-match-wins Risk Conditions (reusing Phase 1) as an override layer, and the **breakdown table** (Parameter | Matched rule | Score | Weight | Contribution) as the headline. *(§3.2 rec. 3)*
18. **Schedule windows + typed conflict codes + calendar.** Ship the four codes computable from dates, CI and assignee; the six parent/child codes wait for Phase 6. Per-window `enforcement: 'block' | 'warn'` with a type-based exemption — beating JSM's all-or-none freeze. *(§3.2 rec. 4)*
19. **PIR + close codes** and the reopen-from-Closed path; ITIL 4's four metrics as tiles. *(§3.2 rec. 7, 12)*
20. **CAB as definition + runnable meeting workbench**, with change authority modelled as a **per-model pointer** where CAB is one configuration — the ITIL 4 story nobody ships. *(§3.2 rec. 5)*
21. **Standard change templates on catalog items**, with locked pre-populated fields and template usage/success monitoring. *(§3.2 rec. 6)*
22. **Problem rebuilt as a real record** (states as labels, known error as a **flag set when `rootCause` is populated**, workaround separate) and **typed, directional link kinds** replacing generic `linkedItems[]` — `caused_by` and `fixed_by` are different fields, not different values. *(§3.2 rec. 8, 9)*
23. **Release as a change container** with a deploy guard. *(§3.2 rec. 10)*

### Phase 4 — Asset foundations *(gap #3, part one)*

24. **Catalog layer**: Manufacturer / AssetCategory / AssetModel / Fieldset / Depreciation. Everything else in the asset module hangs off this. *(§3.4 rec. 1)*
25. **Typed Status Labels + substates**, with `canCheckout` derived from the type and **check-in accepting any status**. *(§3.4 rec. 3)*
26. **Polymorphic checkout (`user | location | asset`) + four ownership roles + `usageType`**, with **current location derived, never stored**. *(§3.4 rec. 2)*
27. **Location tree** — generalize the existing 3-level Products tree widget to n levels; home vs current; per-location currency; rollups. *(§3.4 rec. 4)*
28. **Movement ledger** — one append-only array powering history, custody chain, audit report and days-idle. *(§3.4 rec. 9)*
29. **Procurement / warranty / depreciation block** with warranty stored as **months** and book value computed from Snipe-IT's published formula. *(§3.4 rec. 6)*
30. **Model Fieldsets authored with the existing subform builder** — first consumer of the shared field registry. *(§3.4 rec. 15)*

### Phase 5 — Software asset management *(gap #3, part two)*

31. **SoftwareProduct → Entitlement → Allocation → Installation** with the per-metric compliance engine and the true-up figure. **Ship the arithmetic on screen, not just the answer.** No vendor licensing presets — configurable `coreFactor` / minimums with a live generic preview. *(§3.4 rec. 5)*
32. **Contracts** as a first-class entity with the Draft → Active → Expired (+ Cancelled) derived state and a Coverage panel. *(§3.4 rec. 8)*
33. **Unified expiry/alert digest** behind one day-threshold, feeding the Workspace lens bar. *(§3.4 rec. 11)*
34. **Five opinionated reports** as derived views. *(§3.4 rec. 10)*

### Phase 6 — CMDB and impact *(closes the loop back to Phase 3)*

35. **Typed, directional relationship graph** seeded from Freshservice's 23 pairs plus ServiceNow's Depends on / Used by, with `impactFlows` on the **type**. *(§3.4 rec. 7)*
36. **Depth-capped impact analysis** wired into the Change record's Impact panel — **and this is what enables the six parent/child conflict codes deferred at step 18.** *(§3.2 rec. 4, §3.4 rec. 7)*
37. **Accessories / Consumables / Components** *(nice)*; **Stockrooms + Transfer Orders** to make In Transit real *(nice)*. *(§3.4 rec. 12, 13)*

### Phase 7 — Project management *(gap #2b)*

38. **Status groups** (Not Started / Active / Done / Closed) with statuses authored per project and inherited; `isOverdue` and dependency-clearing derived **from the group**. *(§3.3 rec. 2)*
39. **Views Bar** — views as saved, named, pinnable objects with per-view state, the dirty-state Save / Autosave prompt, and the exact ordering rule with a `+N` overflow chip. *(§3.3 rec. 1)*
40. **List group contract** — sticky headers, collapse, inline add that **inherits group and filter values**, footer column calculations. *(§3.3 rec. 3)*
41. **Custom fields engine** — the shared registry's second consumer; ClickUp's groupable set; the task-modal display rule (pinned, required, non-empty, alphabetical). *(§3.3 rec. 6)*
42. **Dependencies** (two types, chips above the description, blocked-close warning, both rescheduling preconditions). *(§3.3 rec. 4)*
43. **Gantt** with dependency arrows, milestone diamonds, critical path and slack — pure client-side geometry, highest wow-per-line in the dimension. *(§3.3 rec. 5)*
44. **Task modal restructure** to the documented section order plus the counts chip row and layout switcher; **milestones as a task type**; **three effort models**. *(§3.3 rec. 8, 9)*
45. **Subtask display modes** with the "required to filter subtasks" explainer. *(§3.3 rec. 7)*
46. **Workload** with unit switcher and backlog rail. *(§3.3 rec. 10)*
47. **Board card customisation + WIP limits**; **Sprints**; **Templates + three recur modes**; **Table view**. *(§3.3 rec. 11–14)*

### Phase 8 — Automation canvas *(gap #4; consumes Phases 1, 2 and every store built so far)*

48. **Hand-rolled canvas** to n8n's verified geometry. *(§3.5 rec. 1)*
49. **Node catalog** with RelayHQ's own entities as the "apps," using n8n's taxonomy and panel copy. *(§3.5 rec. 2)*
50. **Execution simulator** producing n8n-shaped `runData` (with the required `source` array), n8n's retry clamps, and the three On-Error modes. **This object is the single source of truth for node badges, connector counts, Logs and Executions.** *(§3.5 rec. 4)*
51. **NDV three-pane modal** with the verified settings tab and pin flow. *(§3.5 rec. 5)*
52. **Safe `{{ }}` resolver** over the whitelisted variable surface — no `eval`. *(§3.5 rec. 6)*
53. **"Request Approval" node** calling the **same** engine built at step 10/11 — one engine, three entry points (catalog, change, canvas). *(§3.5 rec. 3)*
54. **Logs panel + Executions tab**; **Lookup Records + Loop Over Items** as the item-model demo; **sticky notes + Tidy Up**; **Connections registry**. *(§3.5 rec. 7, 9, 10, 11)*
55. **Migrate the legacy Workflows list into the canvas** — after confirming its actual shape in the repo. *(§3.5 rec. 8)*
56. **Software reclamation rules** as the first end-to-end automation demo: condition (Phase 1) → approval (Phase 2) → allocation reclaim (Phase 5). *(§3.4 rec. 14)*

### Phase 9 — Customer portal *(gap #5; the argument, not just the feature)*

57. **Deflection Ledger first.** Instrument before you improve, or the improvements cannot be shown to work. This is a small change with the largest argumentative payoff in the document. *(§3.6 rec. 1)*
58. **Conditional subform fields** — reusing the Phase 1 condition AST — plus the `content` block and `section` container types, and the "4 of 9 fields shown" counter. *(§3.6 rec. 4)*
59. **Suggested-guides-as-you-type**, pre-scoped to the item leaf, with Zendesk's suppression rule and two-button exit. *(§3.6 rec. 2)*
60. **Vertical Stories player** replacing `CarouselViewer`: portrait 9:16, segmented progress, tap zones, hold-to-pause, 5000–8000 ms, a **persistent visible keyboard-reachable pause control**, `prefers-reduced-motion`, captions/text alternatives. Deflection prompt lives in the finish state. *(§3.6 rec. 3)*
61. **Portal search** merging guides and forms with full breadcrumbs and `search_no_result` capture. *(§3.6 rec. 6)*
62. **Knowledge-gap table** implementing JSM's >5 rule with a "Create guide" deep link. *(§3.6 rec. 1)*
63. **Shared Field Sets** (single-row and multi-row) with per-field permissions. *(§3.6 rec. 8)*
64. **My Requests panel**, with the differentiating "You viewed 2 guides before submitting" line. *(§3.6 rec. 7)*
65. **Split-screen "Flat list vs Guided" comparison mode.** Build it last, because its footer counters draw on the Deflection Ledger, the conditional-field counter and the guide events. **This is the screenshot that sells the thesis.** *(§3.6 rec. 5)*
66. **Guided decision tree** as a fourth action type on item leaves *(nice)*; **announcements strip + KB freshness pill** *(nice)*. *(§3.6 rec. 9, 10)*

---

**Two sequencing notes.**

*If the demo date forces a cut:* Phases 0–2 and 9 together produce a coherent story — a portal that measurably deflects, feeding a catalog whose requests run through a real approval engine. Phases 3–8 deepen it but none of them is prerequisite to that narrative. **Do not cut Phase 0**, and do not build Phase 9 items 58–65 before item 57.

*Before sequencing anything:* five of six research dimensions could not read RelayHQ's source and the sixth read it from the Trash. **Confirm the repo's location and the existence of the subform builder, the 3-level tree widget, the shared task modal, the typed `linkedItems[]` array and the Workflows sub-tab before committing to any effort estimate above.**

---

## 5. What we are deliberately NOT building

Scope discipline. Every item below exists in the market and appears somewhere in the research; each is excluded on purpose, with the reason. Excluding them is a design position, not an omission — and several of them are things the prototype is *better off* not having.

**Infrastructure the prototype's premise excludes**

1. **No server, no database, no authentication, no multi-tenancy, no permission matrix.** RelayHQ is a client-side prototype with in-memory state and localStorage persistence. Everything in this document was chosen because it is computable client-side by a `reduce` over plain objects. ServiceNow's user-criteria engine for topic visibility, Freshservice's per-workspace permission gating ("Manage Change Lifecycle & Calendar Windows"), and Atlassian's plan tiers are all admin surfaces with no demo value here.
2. **No real notification delivery.** No email, Slack, Teams or Outlook actionable cards. n8n's `sendAndWait` response channels and Power Automate's Outlook/Teams/action-center triad are the model, and RelayHQ implements only the **action center** equivalent: an in-app inbox. Approval reminders fire against the simulated clock and land in-app.
3. **No real scheduler.** Zendesk's hourly automation sweep, ServiceNow's nightly "Contract Compliance Checks" job and JSM's weekly suggested-topics refresh are all modelled against the **simulated clock** in Phase 0. A real cron adds nothing a viewer can see and everything a viewer must wait for.
4. **No integration broker or credential vault.** The Connections registry (§3.5 rec. 11) is a *shape* — first-class objects, "*node name* account" default naming, a validation-issue badge — not an OAuth broker. Nothing calls an external API. Nothing stores a secret.
5. **No downloadable-file or export pipeline beyond what a static page can do.** Freshservice's ICS/PDF calendar export and ClickUp's List/Table export are noted as vendor behaviour, not build targets.

**Capabilities that require data we do not have**

6. **No discovery agent, network scanning, or CI reconciliation.** Lansweeper-class discovery, SCCM usage feeds and ServiceNow's CMDB identification/reconciliation engine are out. `installation` records are **seeded or imported**, with `source: 'agent'|'manual'|'import'` present so the model is honest about where a fact came from. Software usage (`lastUsedAt`, `usageHours30d`) is seeded demo data — and the research explicitly could not verify ServiceNow's SCCM-shaped feed anyway.
7. **No CI class model of hundreds of classes.** ServiceNow's `cmdb_ci_*` class hierarchy and the `cmdb_ci_service`-vs-derived-class trap are documented as a *gotcha to avoid reproducing*. RelayHQ ships a shallow `ciClass` tree sized for the demo.
8. **No AI risk scoring, no AI article-snippet generation, no LLM anywhere in the product.** JSM's AI risk assessment is Premium-gated, evaluates "10+ risk parameters," and has an **undocumented hit rate**. RelayHQ's counter-position is the deliberate opposite: a **transparent, deterministic risk breakdown** whose arithmetic is on screen. Shipping an opaque score would surrender the one place we beat the market leader on capability rather than on price.
9. **No vendor licensing presets.** No SQL Server core minimum, no Oracle core-factor table, no per-publisher metric packs. The research found the widely-repeated "16 core minimum" is a **Windows Server** rule misattributed to SQL Server, and could not verify Oracle's core-factor arithmetic from any reachable source. RelayHQ ships configurable `coreFactor` / `minCoresPerSocket` / `minCoresPerServer` fields with a **generic live arithmetic preview**. A wrong vendor minimum on screen costs more credibility than the preset earns.

**Features whose cost/benefit does not clear the bar for a prototype**

10. **No generic report builder.** Snipe-IT ships five named reports *and* a 95-field builder. Build the five. A builder is a large surface that demos badly, and every question the five reports answer is a question a prospect actually asked.
11. **No scripting surface.** No ServiceNow-style business rule scripts, client scripts, `g_form` API, or n8n Code node. The expression layer is a **whitelisted resolver with no `eval`** (§3.5 rec. 6). Arbitrary code execution in a client-side prototype is a liability with no demo payoff, and the whitelist is itself a talking point.
12. **No unbounded condition nesting.** Capped at **two levels** on Jira's explicit authority, with Zendesk's even flatter model as corroboration. Deeper nesting is not a missing feature; it is a decision the market has already made.
13. **No Mind Map, Whiteboard, Chat, Doc, Embed, Map or Form views.** Seven of ClickUp's 17 view types are outside the service-management story. The four that matter (List, Board, Calendar, Gantt) plus Table and Workload cover every demo beat, and Mind Map's mechanics were unverifiable anyway.
14. **No plan gating or pricing tiers.** ClickUp gates WIP limits, Sprint cards, "Set as default view" and Critical Path usage behind Business; JSM gates Change Calendar, freeze windows and AI risk behind Premium; Freshservice gates the rich text editor behind Pro. These are noted as **competitive positioning** — RelayHQ shows them all working — not as a model to reproduce.
15. **No mobile app and no native capture tooling.** The Stories player is a responsive web component. RelayHQ does not build a screen-recorder, a Guidde/Scribe-style capture extension, or an in-app tour authoring engine — the last of which the research explicitly flagged as needing a separate pass.
16. **No SSO, SCIM, or HR-system sync for the People directory.** Users are seeded. The directory exists to make manager resolution and ownership roles real, not to be an IAM product.

**Claims we will not make**

17. **No deflection benchmark on screen, ever.** Every figure in circulation traces to a single AI-support vendor's aggregator blog that concedes it cannot link its own sources. Zendesk — the market leader — publishes formulas and a hypothetical and **no benchmark at all**. RelayHQ's answer is to **measure its own demo**, publish its own denominators on screen, and let the split-screen comparison do the arguing. That is a stronger position than a borrowed statistic, and it cannot be falsified by a prospect who has read the same blog.
18. **No retention or efficacy claims for visual guides.** Guidde's 34%/28% cite an unlinked study; the 31% figure could not be located at all; Pendo's Elsevier 42.8% and WebPT 50% are unaudited self-published case studies. **The honest argument is engagement, recognition and progressive disclosure (NN/g)** — and NN/g is the one genuinely defensible source in that whole space.
19. **No claim that any mechanic improves outcomes.** Workload's red/yellow/green is justified on "a board cannot answer 'is anyone drowning?'", not on better resourcing. Conflict detection is justified on credibility, not on fewer failed changes. Every vendor capability verified in this document is documentation of *what a product does*, never evidence that it works.

---
## 6. Sources

Deduplicated across the six reports and grouped by dimension. A URL cited in more than one dimension is listed once, under the dimension where it is most load-bearing, with a cross-reference. Sources are separated into **verified in the fact-check pass** (re-fetched successfully; claims resting on them are in the Verified findings sections) and **attempted but unretrievable** (claims resting solely on them are in the Not verified sections).

### 6.1 Business rules, condition builders and approval engines

**Verified**

- https://learn.microsoft.com/en-us/power-automate/get-started-approvals
- https://support.zendesk.com/hc/en-us/articles/4408883801626-Creating-and-managing-automations-for-time-based-events
- https://support.zendesk.com/hc/en-us/articles/4408832924314-What-is-the-difference-between-ticket-triggers-and-automations
- https://support.zendesk.com/hc/en-us/articles/4408822236058-About-Zendesk-triggers-and-how-they-work
- https://support.zendesk.com/hc/en-us/articles/4408883552282-What-is-the-difference-between-meet-all-and-meet-any-conditions
- https://support.zendesk.com/hc/en-us/articles/10356973691546-Reordering-and-sorting-your-list-of-ticket-triggers
- https://developer.zendesk.com/documentation/ticketing/reference-guides/conditions-reference/
- https://developer.zendesk.com/documentation/ticketing/reference-guides/ticket-audit-events-reference/
- https://support.atlassian.com/cloud-automation/docs/jira-automation-conditions/
- https://support.atlassian.com/cloud-automation/docs/jira-smart-values-issues/
- https://support.atlassian.com/cloud-automation/docs/automation-service-limits/
- https://support.atlassian.com/jira/kb/how-to-use-the-approval-completed-trigger-with-workflows-that-have-multiple-approval-steps/
- https://confluence.atlassian.com/automation/actions-993924834.html
- https://confluence.atlassian.com/automation/troubleshoot-automation-rules-1141480666.html
- https://confluence.atlassian.com/spaces/automation112/pages/1688902303/Use+the+audit+log
- https://confluence.atlassian.com/servicemanagementserver/setting-up-approvals-939926369.html
- https://jira.atlassian.com/browse/JSDCLOUD-7867
- https://support.freshservice.com/support/solutions/articles/232139-create-workflows-using-workflow-automator
- https://support.freshservice.com/support/solutions/articles/50000011144-how-to-create-and-assign-approvals-in-freshservice-
- https://support.freshservice.com/support/solutions/articles/211198-setting-hierarchical-approvals-for-service-requests-using-workflow-automator-
- https://support.freshservice.com/support/solutions/articles/50000013933-create-a-request-approval-activity-in-journeys
- https://support.freshservice.com/support/solutions/articles/50000000610-can-i-set-approval-reminders-for-service-requests-
- https://www.servicenow.com/community/workflow-automation-blogs/scripted-approvals-in-flow-designer-with-flow-variables/ba-p/2284506
- https://www.servicenow.com/community/developer-forum/group-approvals-in-flow-designer-missing-an-approval-from-each/m-p/1598683
- https://www.servicenow.com/community/servicenow-ai-platform-forum/setting-approval-rules-via-script-in-ask-for-approval-action-in/m-p/1079935
- https://www.servicenow.com/community/itsm-articles/delegates-in-servicenow/ta-p/2600517
- https://www.servicenow.com/community/workflow-automation-articles/flows-best-practices-logging-and-reporting-workflow-automation/ta-p/2359997
- https://servicenowguru.com/business-rules-scripting/reset-change-request-workflow-approvals-tasks/
- https://thesnowball.co/table/sysapproval_approver
- https://thesnowball.co/prohibit-an-insert-or-update-with-setabortactiontrue/
- https://sn.jace.pro/docs/operators/ *(unofficial reference — labels indicative only)*
- https://s2-labs.com/servicenow-admin/servicenow-filter-search/
- https://www.nowspectrum.com/blog/business-rule-types *(specialist blog)*
- https://www.emergys.com/blog/approvals-in-servicenow/ *(consultancy blog — single source)*
- https://www.ikconsulting.com/post/how-to-access-logs-in-servicenow-flow-designer
- https://developer.monday.com/apps/docs/sentences

*Also load-bearing here, listed under §6.2:* the Change Approval Policies article, the change-request risk-calculation article, and the risk-assessment blog.

**Attempted and unretrievable**

- https://help.clickup.com/hc/en-us/articles/6312136485527-Use-Automation-Conditions — HTTP 403
- https://help.clickup.com/hc/en-us/articles/30241682127127-Create-an-Automation — HTTP 403
- https://support.monday.com/hc/en-us/articles/360012254440-Build-your-own-custom-automation — HTTP 403
- https://support.atlassian.com/jira-service-management-cloud/docs/add-an-approval-to-a-workflow/ — navigation scaffolding only
- https://www.servicenow.com/docs/r/platform-user-interface/c_ConditionBuilder.html — navigation scaffolding only
- https://www.servicenow.com/docs/bundle/vancouver-platform-user-interface/page/use/common-ui-elements/reference/r_OpAvailableFiltersQueries.html — navigation scaffolding only
- https://support.zendesk.com/hc/en-us/articles/4408886847130-Viewing-the-audit-log-for-changes — HTTP 404
- https://www.servicenow.com/community/workflow-automation-articles/flow-designer-approvals-overview-workflow-automation-center-of/ta-p/2528202 — partial retrieval, then HTTP 503

### 6.2 ITIL change management and the change / problem / incident triad

**Verified (including two primary PDFs extracted and read locally)**

- https://watech.wa.gov/sites/default/files/2024-12/ITSM%20-%20Change%20-%20Process%20Guide.pdf — **ServiceNow-authored, © 2022 ServiceNow, Ref 0001216**
- https://www.mafranci.com/itil4/cds/new/1%2020191122_Practice_Change%20enablement.pdf — **AXELOS ITIL 4 Change enablement practice guide, 2019**
- https://raw.githubusercontent.com/ansible-collections/servicenow.itsm/main/docs/servicenow.itsm.change_request_module.rst
- https://www.servicenow.com/community/in-other-news/using-change-approval-policies/ba-p/2286835 *(also §3.1)*
- https://www.servicenow.com/community/itsm-articles/what-s-the-deal-with-change-approval-policies/ta-p/2307253
- https://www.servicenow.com/community/developer-articles/getting-started-with-servicenow-change-request-risk-calculation/ta-p/2362172 *(also §3.1)*
- https://www.servicenow.com/community/developer-blog/risk-assessment-in-change-management/ba-p/3340201 *(also §3.1)*
- https://www.servicenow.com/community/itsm-forum/default-risk-conditions-not-working-how-it-works/td-p/643654
- https://www.servicenow.com/community/itsm-blog/conflict-checking-when-scheduling-a-change-request/ba-p/2374348
- https://www.servicenow.com/community/itsm-blog/blackout-maintenance-schedules-in-a-nutshell/ba-p/2269223
- https://www.servicenow.com/community/itsm-forum/how-cab-related-fields-in-change-request-related-with-cab/td-p/767797
- https://www.servicenow.com/community/itsm-forum/quot-caused-by-change-quot-in-problem-mgmt/td-p/3153792
- https://www.servicenow.com/community/developer-forum/please-tell-me-about-the-roles-of-the-fields-problem-id-rfc-and/m-p/3149373
- https://www.servicenow.com/community/itsm-articles/change-management-in-servicenow-everything-you-need-to-know/ta-p/3439058
- https://www.learnnowlab.com/CAB-WB/ — **third-party training site; attribute as such, never as ServiceNow documentation**
- https://nowben.com/a-practical-guide-to-problem-management-in-servicenow/ *(third party)*
- https://uit.stanford.edu/service/changemgt/impacts_risks
- https://confluence.atlassian.com/servicedeskcloud/managing-changes-with-your-it-service-desk-817562147.html
- https://confluence.atlassian.com/servicemanagementserver/1-update-the-change-management-workflow-1082527827.html
- https://confluence.atlassian.com/servicemanagementserver100/7-set-up-a-calendar-to-coordinate-your-changes-1442909129.html
- https://community.atlassian.com/forums/Jira-Service-Management-articles/New-enhancements-to-Change-Calendar-in-Jira-Service-Management/ba-p/3134550
- https://community.atlassian.com/forums/Jira-Service-Management-articles/AI-Risk-Assessment-is-now-generally-available-in-Jira-Service/ba-p/3214684
- https://www.atlassian.com/software/jira/service-management/product-guide/getting-started/change-management
- https://www.mumosystems.com/blog/2021/01/exploring-change-management-with-jira-service-management/ *(third party)*
- https://support.freshservice.com/support/solutions/articles/50000000259-what-are-change-types-
- https://support.freshservice.com/support/solutions/articles/236100-manage-your-change-processes-with-change-lifecycle
- https://support.freshservice.com/support/solutions/articles/50000012708-manage-change-risk-policies-in-freshservice
- https://support.freshservice.com/support/solutions/articles/50000001010-scheduling-maintenance-blackout-windows
- https://support.freshservice.com/support/solutions/articles/155582-understanding-change-approvals-and-cabs
- https://support.freshservice.com/support/solutions/articles/50000001209-schedule-manage-cab-meetings-with-cab-huddle
- https://support.freshservice.com/support/solutions/articles/50000006072-change-calendar
- https://support.freshservice.com/support/solutions/articles/50000000655-get-started-with-change-management
- https://support.freshservice.com/support/solutions/articles/234458-working-with-releases
- https://www.manageengine.com/products/service-desk/it-change-management/cab-change-advisory-board.html

**Attempted and unretrievable** — all `servicenow.com/docs/*` bundle pages; all `support.atlassian.com/jira-service-management-cloud/docs/*` pages (JS shells — the default field list was verified from Atlassian's Confluence mirror instead); note.com problem-state blog; walkme.com ECAB post; itsm.tools; Wikipedia change-advisory-board.

### 6.3 ClickUp-style project and work management

**Verified.** ClickUp's rendered help-centre pages return 403 to automated fetches; all ClickUp content below was verified through the Zendesk content API equivalents.

- https://help.clickup.com/api/v2/help_center/en-us/articles/13856392825367.json (Intro to the Hierarchy)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6329880717719.json (Intro to views)
- https://help.clickup.com/api/v2/help_center/en-us/articles/19063083658135.json (Intro to the Views Bar)
- https://help.clickup.com/api/v2/help_center/en-us/articles/35368731425175.json (The views control bar)
- https://help.clickup.com/api/v2/help_center/en-us/articles/26032576190615.json (Add a view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/26004419744023.json (Group and reorder views)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310160224023.json (Default view templates)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310260883351.json (Intro to List view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/7255389296919.json (Customize List view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310202447511.json (Use grouping in views)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310352825751.json (Sort tasks in List view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310206119575.json (Filter and search tasks in List view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310124537751.json (Calculate columns in List and Table view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310314670359.json (List view vs Board view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/35342044832279.json (Customize Board view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6329890854935.json (Create and share a Table view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310085740183.json (Intro to Calendar view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/31440880547991.json (Add and manage tasks in Timeline view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310249474967.json (Create and share a Gantt view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310440099479.json (Critical Path and Slack Time)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310449699735.json (Use Workload view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/30799838221335.json (Measure availability or capacity in Workload view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6303499162647.json (Custom Field types)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6330455628439.json (Show Custom Fields in tasks and views)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6309452618647.json (Manage task statuses)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6309432702103.json (Not Started Statuses)
- https://help.clickup.com/api/v2/help_center/en-us/articles/22402192107543.json (Show status progress)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6309155073303.json (Intro to Dependency Relationships)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6309943321751.json (Create Dependency Relationships in tasks)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6304547785367.json (Rescheduling dependencies)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6304410420759.json (Dependency Warnings)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6304458574615.json (Milestones)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6304483666199.json (Set task Priorities)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6304177391767.json (Intro to Time Estimates)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6303883602327.json (Use Sprint Points)
- https://help.clickup.com/api/v2/help_center/en-us/articles/29571347936791.json (Use task duration to schedule tasks)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6309885016471.json (Use recurring tasks)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6309918176535.json (Use task templates)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6309942197783.json (Use task checklists)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6309825777943.json (Intro to subtasks)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6310382044567.json (Create and edit subtasks in List and Board view)
- https://help.clickup.com/api/v2/help_center/en-us/articles/34958820098839.json (Custom Fields, subtasks, relationships, and attachments)
- https://help.clickup.com/api/v2/help_center/en-us/articles/34958796358039.json (Task fields and the task description)
- https://help.clickup.com/api/v2/help_center/en-us/articles/29665520762647.json (Task layouts)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6303974210071.json (Intro to Sprints)
- https://help.clickup.com/api/v2/help_center/en-us/articles/35813334585239.json (Sprint statuses)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6312248505623.json (Intro to Sprint Dashboard cards)
- https://help.clickup.com/api/v2/help_center/en-us/articles/6304619369623.json (Work in Progress Limits)
- https://help.clickup.com/api/v2/help_center/en-us/articles/37948491525015.json (Use List Info)
- https://developer.clickup.com/docs/customfields
- https://developer.clickup.com/reference/gettask
- https://developer.clickup.com/reference/createtask
- https://developer.clickup.com/reference/getspace
- https://linear.app/docs/configuring-workflows
- https://linear.app/docs/display-options
- https://linear.app/docs/estimates
- https://linear.app/docs/priority
- https://linear.app/docs/parent-and-sub-issues
- https://linear.app/docs/triage
- https://developer.monday.com/api-reference/reference/column-types-reference
- https://developer.monday.com/api-reference/reference/dependency
- https://developer.monday.com/api-reference/reference/boards
- https://developers.asana.com/reference/tasks
- https://developers.asana.com/reference/gettask
- https://developers.asana.com/reference/custom-fields
- https://asana.com/features/project-management/project-views

**Attempted and unretrievable (403 to all methods)** — the human-readable `help.clickup.com/hc/...` pages, and all `support.monday.com/hc/...` pages. monday support content could not be verified at all.

### 6.4 IT asset management, CMDB, and software license management

**Verified**

- https://snipe-it.readme.io/docs/managing-assets.md
- https://snipe-it.readme.io/docs/importing-assets.md
- https://snipe-it.readme.io/docs/importing-locations-gui.md
- https://snipe-it.readme.io/docs/importing-components.md
- https://snipe-it.readme.io/docs/custom-fields.md
- https://snipe-it.readme.io/docs/depreciation-types.md
- https://snipe-it.readme.io/docs/notifications.md
- https://snipe-it.readme.io/docs/email-alerts
- https://snipe-it.readme.io/llms.txt
- http://snipe.github.io/snipe-it-devdocs/class_app_1_1_models_1_1_asset.html
- http://snipe.github.io/snipe-it-devdocs/class_app_1_1_models_1_1_location.html
- http://snipe.github.io/snipe-it-devdocs/_statuslabel_8php_source.html
- https://github.com/grokability/snipe-it/issues/4307
- https://mintlify.wiki/grokability/snipe-it/features/licenses
- https://deepwiki.com/grokability/snipe-it/2.5-asset-checkout-and-checkin *(generated third-party wiki)*
- https://deepwiki.com/snipe/snipe-it/4-data-model *(generated third-party wiki)*
- https://support.freshservice.com/support/solutions/articles/164414-understanding-the-different-asset-states
- https://support.freshservice.com/support/solutions/articles/227988-software-license-types
- https://support.freshservice.com/support/solutions/articles/50000002810-what-are-the-different-types-of-relationships-in-freshservice-
- https://support.freshservice.com/support/solutions/articles/234460-analyzing-impact-using-relationship-maps
- https://support.freshservice.com/support/solutions/articles/50000000536-what-is-the-difference-between-serial-number-and-asset-tag-
- https://support.freshservice.com/support/solutions/articles/50000000539-difference-between-loaner-and-permanent-usage-type
- https://support.freshservice.com/support/solutions/articles/50000000517-what-are-contract-types-available-by-default-in-freshservice-
- https://api.freshservice.com/v1/
- https://support.atlassian.com/assets/docs/building-an-object-schema-for-it-assets-management-itam/
- https://support.atlassian.com/assets/docs/creating-attributes-for-it-asset-management-itam/
- https://support.atlassian.com/assets/docs/what-are-object-types/
- https://support.atlassian.com/assets/docs/allow-attributes-to-be-inherited-by-object-type-children/
- https://docs.lansweeper.com/docs/manage-lifecycles
- https://www.servicenow.com/community/ham-articles/mastering-hardware-asset-management-in-servicenow-chapter-2/ta-p/3351555
- https://www.servicenow.com/community/in-other-news/assets-configuration-items-and-model-categories-understanding/ba-p/2279633
- https://www.servicenow.com/community/sam-forum/license-metric-in-sam-pro/m-p/3502435
- https://www.servicenow.com/community/sam-blog/true-up-calculation-on-servicenow-sam-pro/ba-p/2734736
- https://www.servicenow.com/community/sam-blog/servicenow-sam-pro-data-model/ba-p/3300153
- https://www.servicenow.com/community/sam-blog/review-software-entitlements/ba-p/3304445
- https://www.servicenow.com/community/sam-blog/allocation-management-on-servicenow-sam-pro/ba-p/2649232
- https://www.servicenow.com/community/sam-blog/understanding-reclamation-rules-optimizing-software-usage-and/ba-p/3030310
- https://www.servicenow.com/community/itsm-blog/automated-change-impact-assessments/ba-p/2267267
- https://www.servicenow.com/community/developer-forum/understanding-how-cmdb-ci-rel-works/m-p/1859092
- https://www.servicenow.com/community/it-service-management-forum/what-is-upstream-downstream-ci/m-p/846169
- https://www.servicenow.com/community/servicenow-ai-platform-forum/cmdb-ci-attributes-owned-by-vs-managed-by/td-p/1171136
- https://www.servicenow.com/community/itom-forum/definitions-or-recommendations-for-using-ci-user-and-group/m-p/2472079
- https://www.servicenow.com/community/developer-articles/execution-of-contract-management-in-servicenow/ta-p/2330225
- https://www.servicenow.com/community/ham-forum/straight-line-and-declining-balance-depreciation/td-p/3096686
- https://davidmac.pro/posts/2026-02-22-sn-ci-status-fields/
- https://www.ivanti.com/blog/named-licenses-vs-concurrent-licenses-choosing-the-right-model-for-your-business
- https://www.revenera.com/software-monetization/glossary/floating-license
- https://www.microsoft.com/en-us/sql-server/sql-server-2022-pricing
- https://www.microsoft.com/en-us/licensing/product-licensing/sql-server
- https://www.microsoft.com/en-us/windows-server/pricing
- https://learn.microsoft.com/en-us/sql/sql-server/compute-capacity-limits-by-edition-of-sql-server *(about instance compute caps, **not** licensing)*

**Attempted and unretrievable (404, 403, 503, or navigation-only)**

- https://www.servicenow.com/docs/r/washingtondc/it-asset-management/hardware-asset-management/t_SettingAssetStatesAndSubstates.html
- https://www.servicenow.com/docs/bundle/yokohama-it-asset-management/page/product/asset-management/concept/transfer-orders-for-am.html
- https://www.servicenow.com/docs/r/servicenow-platform/cmdb-ci-class-models/cmdb-ci-class-models.html
- https://www.servicenow.com/community/sam-articles/assets-and-cis-understanding-the-difference/ta-p/2405242
- https://www.servicenow.com/community/ham-forum/asset-management-depreciation/m-p/3305488
- https://xaza.tech/tips/servicenow-cmdb-relationship-types-admin-guide
- https://redresscompliance.com/oracle-processor-factor-table-guide.html
- https://www.oracle.com/us/corporate/contracts/processor-core-factor-table-070634.pdf
- https://www.lansweeper.com/solutions/use-cases/hardware-asset-management/
- https://www.kaseya.com/blog/it-asset-management-itam/

### 6.5 n8n workflow automation: canvas UX and execution model

**Verified — source files from `n8n-io/n8n@master`**

- .../packages/frontend/editor-ui/package.json
- .../packages/frontend/editor-ui/src/app/utils/nodeViewUtils.ts
- .../packages/frontend/editor-ui/src/features/workflows/canvas/composables/useCanvasLayout.ts
- .../packages/frontend/editor-ui/src/features/workflows/canvas/components/elements/edges/utils/getEdgeRenderData.ts
- .../canvas/components/elements/nodes/CanvasNodeToolbar.vue
- .../canvas/components/elements/nodes/render-types/CanvasNodeDefault.vue
- .../canvas/components/elements/nodes/render-types/_canvasNodeStyles.scss
- .../canvas/components/elements/nodes/render-types/parts/CanvasNodeStatusIcons.vue
- .../canvas/components/elements/handles/render-types/CanvasHandleMainOutput.vue
- .../canvas/components/elements/handles/render-types/CanvasHandleMainInput.vue
- .../canvas/components/elements/handles/render-types/parts/CanvasHandlePlus.vue
- .../canvas/components/elements/handles/render-types/parts/CanvasHandleDot.vue
- .../packages/frontend/@n8n/i18n/src/locales/en.json
- .../packages/workflow/src/execution-status.ts
- .../packages/workflow/src/interfaces.ts
- .../packages/core/src/execution-engine/workflow-execute.ts
- .../packages/nodes-base/nodes/If/V2/IfV2.node.ts
- .../packages/nodes-base/nodes/SplitInBatches/v3/SplitInBatchesV3.node.ts
- .../packages/nodes-base/nodes/Code/Code.node.ts
- .../packages/nodes-base/utils/sendAndWait/{utils,descriptions,interfaces}.ts
- .../packages/nodes-base/nodes/Discord/v2/actions/message/sendAndWait.operation.ts
- Node codex JSON: If, Switch, Merge, Filter, Wait, NoOp, Set, Code, SplitInBatches, StickyNote, HttpRequest, StopAndError, CompareDatasets

*(All under `https://raw.githubusercontent.com/n8n-io/n8n/master/`.)*

**Verified — other repositories and issue tracker**

- https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/utils/edges/bezier-edge.ts
- https://raw.githubusercontent.com/bcakmakoglu/vue-flow/master/packages/core/src/components/Edges/utils/bezier.ts
- https://api.github.com/repos/n8n-io/n8n/issues/9236 (and comments) — **the retry-on-continue fix, released in n8n 1.43.0**
- https://api.github.com/repos/n8n-io/n8n/issues/23658 (and comments)

**Verified — n8n documentation**

- https://docs.n8n.io/integrations/builtin/node-types.md
- https://docs.n8n.io/build/work-with-data/understand-n8ns-data-structure.md
- https://docs.n8n.io/build/work-with-data/transform-data/expression-reference.md
- https://docs.n8n.io/build/work-with-data/pin-and-mock-data.md
- https://docs.n8n.io/build/flow-logic/handle-errors-gracefully.md
- https://docs.n8n.io/build/understand-workflows/create-and-edit-credentials.md
- https://docs.n8n.io/build/understand-workflows/workflow-components/add-notes-and-documentation.md
- https://docs.n8n.io/build/keyboard-shortcuts.md
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.{if,switch,merge,splitinbatches,set,filter,wait,webhook,respondtowebhook,scheduletrigger,formtrigger}.md
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/common-issues/
- https://community.n8n.io/t/add-pin-output-button-to-node-hover-shortcut-bar/298513

**Verified — competitors**

- https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zap-workflows-with-Paths
- https://help.zapier.com/hc/en-us/articles/8496180919949-Filter-and-path-rules-in-Zap-workflows
- https://help.make.com/iterator
- https://help.make.com/operations
- https://www.servicenow.com/docs/bundle/zurich-build-workflows/page/administer/flow-designer/reference/flow-triggers.html

### 6.6 Self-service portals, service catalogs, deflection, and visual how-to content

**Verified**

- https://support.zendesk.com/hc/en-us/articles/4408845897370-Organizing-knowledge-base-content-in-categories-and-sections
- https://support.zendesk.com/hc/en-us/articles/360002113288-Adding-subsections-to-create-more-levels-in-your-Help-Center-Guide-Enterprise
- https://support.zendesk.com/hc/en-us/articles/4408820951450-Using-autoreplies-with-articles-for-web-forms *(**now labelled Legacy by Zendesk**)*
- https://support.zendesk.com/hc/en-us/articles/4408830824474-Understanding-how-articles-are-evaluated-for-use-in-autoreplies
- https://support.zendesk.com/hc/en-us/articles/4409155069466-Analyzing-your-autoreplies-with-articles
- https://support.zendesk.com/hc/en-us/articles/4408838548250-Using-the-metrics-that-matter-to-improve-your-knowledge-base
- https://www.zendesk.com/blog/help-center/self-service/ticket-deflection-currency-self-service/ — **publishes formulas and a hypothetical; zero benchmarks, zero customer results**
- https://www.intercom.com/help/en/articles/56647-create-collections-in-your-help-center
- https://www.intercom.com/help/en/articles/56640-help-center-explained
- https://developers.intercom.com/docs/references/2.6/rest-api/help-center/the-collection-section-models
- https://support.atlassian.com/jira-service-management-cloud/docs/organize-request-types-into-portal-groups/
- https://support.atlassian.com/jira-service-management-cloud/docs/group-request-types-in-the-portal-in-team-managed-projects/
- https://support.atlassian.com/jira-service-management-cloud/docs/create-and-manage-topics-in-your-help-center/ *(indexed content only — re-check the numeric limits before quoting)*
- https://support.atlassian.com/jira-service-management-cloud/docs/address-knowledge-gaps-with-suggested-topics/
- https://support.atlassian.com/jira-service-management-cloud/docs/set-up-article-suggestions-in-request-forms/
- https://support.atlassian.com/jira/kb/how-to-hide-request-types-from-jira-service-management-customer-portal/
- https://support.freshservice.com/support/solutions/articles/50000012680-custom-field-types-for-service-catalog-items
- https://support.freshservice.com/support/solutions/articles/50000011456-manage-shared-fields-for-service-categories-and-items
- https://support.freshservice.com/support/solutions/articles/199643-configure-the-service-catalog
- https://www.servicenow.com/community/itsm-articles/catalog-item-v-record-producer-when-why-simplified/ta-p/2305135
- https://www.servicenow.com/community/developer-forum/record-producer-vs-catalog-item/td-p/2998895
- https://servicenowguru.com/scripting/adding-redirect-message-record-producer/
- https://ikconsulting.com/post/decoding-servicenow-record-producers-how-to-access-your-variables-in-scripts
- https://www.servicenow.com/docs/r/washingtondc/servicenow-platform/service-catalog/r_VariableTypes.html
- https://www.servicenow.com/community/itsm-forum/what-is-use-of-single-row-variable-set-and-multi-row-variable/td-p/500507
- https://www.servicenow.com/community/developer-blog/exploring-the-multi-row-variable-set/ba-p/2291532
- https://www.servicenow.com/community/developer-forum/how-to-hide-a-variable-set-based-on-a-catalog-item-variable/td-p/3236492
- https://www.servicenow.com/community/itsm-forum/how-to-hide-variable-set-using-ui-policy/m-p/2475757
- https://www.servicenow.com/community/itsm-forum/how-work-with-cascade-variables-in-order-guide/td-p/868245
- https://concurrency.com/blog/servicenow-order-guides-cascading-variables/
- https://servicenowspectaculars.com/all-about-service-catalog-order-guide/
- https://www.servicenow.com/community/employee-center-articles/servicenow-s-employee-center-out-of-the-box-taxonomy-models/ta-p/3051633
- https://www.servicenow.com/community/employee-center-articles/new-user-criteria-for-taxonomy-topics-in-employee-center/ta-p/3398216
- https://www.servicenow.com/docs/bundle/vancouver-customer-service-management/page/product/customer-service-management/concept/decision-trees-in-guided-decisions.html
- https://www.servicenow.com/standard/resource-center/data-sheet/ds-guided-decisions-customer-service-management.html
- https://www.servicenow.com/community/servicenow-ai-platform-articles/customizing-the-quot-my-requests-quot-widget-in-service-portal/ta-p/3152920
- https://help.salesforce.com/s/articleView?id=rss_case_deflection.htm&language=en_US
- https://www.salesforce.com/service/customer-self-service/case-deflection/
- https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html
- https://www.nngroup.com/videos/progressive-disclosure/ — **the one genuinely defensible evidentiary anchor in this dimension**
- https://raw.githubusercontent.com/mohitk05/react-insta-stories/master/README.md
- https://www.npmjs.com/package/react-insta-stories
- https://dev.to/dev48v/i-rebuilt-instagram-stories-segmented-progress-bars-4bil *(developer convention, not a Meta spec)*

**Cited but NOT evidence — do not quote in any deliverable**

- https://happysupport.ai/blog/support-ticket-deflection-rate-benchmarks — aggregator, itself an AI-support vendor, concedes it cannot link several named sources
- https://www.guidde.com/tool-comparison/guidde-vs-scribe-comparison-2026 — vendor marketing; cites an unlinked "2026 ATD study"
- https://www.pendo.io/pendo-blog/how-to-use-pendo-to-reduce-the-burden-on-your-support-team/ — self-published, unaudited vendor case studies

**Verified against RelayHQ source** *(at `/Users/philbueschel/.Trash/relayhq-abandoned-2026-08-16` — confirm the repo's intended location before acting)*

- `client/src/components/kb/CarouselViewer.tsx` (101 lines)
- `client/src/components/forms/FormPreview.tsx` (551 lines)

---

*End of synthesis. Researched and fact-checked 2026-08-16. Every claim above is either labelled verified, labelled not-verified, or labelled vendor marketing; if a future build decision needs a fact that is not in one of those three categories, it needs new research, not a re-reading of this document.*

