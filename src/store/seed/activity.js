/**
 * Activity seed — the append-only audit log.
 *
 * ============================================================================
 * WHAT THIS COLLECTION IS
 * ============================================================================
 * One flat, append-only stream of "somebody did something to something". It is
 * deliberately NOT a per-record comment thread: the same log has to answer
 * three different questions on three different surfaces —
 *
 *   "what happened here?"      a record's own history panel (filter by target)
 *   "what did Devon do?"       a person's trail          (filter by actor)
 *   "what happened today?"     the workspace feed        (no filter at all)
 *
 * — and only a single stream can answer all three without duplicating writes.
 *
 * SHAPE
 *   { id, at, actorId, verb, targetType, targetId, targetLabel, detail }
 *
 *   at          local ISO, no `Z`. THE DEMO CLOCK IS 2026-08-16T09:00 (see NOW
 *               in store.js). A `Z` suffix would shift every entry by the
 *               viewer's offset and turn "2 hours ago" into "yesterday"
 *               depending on which city the demo is being given in.
 *   actorId     usually a USR id. It may also be a CON id (customers open and
 *               answer their own tickets in the external product) or an AUTO id
 *               (an automation acted on its own). ActivityFeed resolves all
 *               three, so the log never has to lie about who did something.
 *   targetType  an ENTITIES key from ds/tokens.js, so the feed can colour the
 *               target chip in the entity's registered hue without a mapping
 *               table of its own.
 *   targetLabel is DENORMALISED on purpose. An audit line must still read
 *               correctly after the record it points at is renamed or deleted —
 *               "closed TKT-4806" is the truth of what happened at 11:44 even
 *               if the ticket's title changed at 14:00.
 *   detail      one sentence of substance. This is the field that decides
 *               whether the log is worth reading or is just noise.
 *
 * ORDER: oldest first. Append-only means new entries go on the END; the feed
 * component does the reverse-chronological sort for display.
 *
 * IDS FROM OTHER DOMAINS: cross-domain ids come from ./ids.js and are never
 * spelled as literals. Tickets, changes, problems, approvals, assets, licences
 * and enrollments have no entry in ids.js — those collections mint their own
 * ids inside service.js / assets.js / learning.js — so their ids appear here as
 * literals, matched to the records those files actually seed. The labels carry
 * the human-readable key, so a drifted id degrades to a dead link, never to a
 * misleading sentence.
 */

import { USR, CON, KB, CRS, CUR, AUTO } from './ids.js';

/* Entries are numbered in write order so the log reads as a sequence rather
 * than a bag of records; `at` is what everything actually sorts on. */
let seq = 0;
function ev(at, actorId, verb, targetType, targetId, targetLabel, detail) {
  seq += 1;
  return {
    id: 'act-' + String(seq).padStart(4, '0'),
    at,
    actorId,
    verb,
    targetType,
    targetId,
    targetLabel,
    detail,
  };
}

export const ACTIVITY = [
  /* ================= Mon 3 Aug ================= */
  ev('2026-08-03T07:58:00', USR.EMMA, 'created', 'change', 'chg-1048',
    'CHG-1048 · Monthly endpoint patch ring rollout — August',
    'August bulletin is 41 patches, four of them rated critical. Pilot ring of 12 devices on the 10th, the rest of the fleet on the 13th.'),
  ev('2026-08-03T09:12:00', USR.DEVON, 'updated', 'ticket', 'tkt-4811',
    'TKT-4811 · Storefront admin session times out after five minutes on Safari',
    'Reproduced on Safari 18.2 with tracking prevention on. Attached to PRB-204 instead of patching it tenant by tenant.'),
  ev('2026-08-03T11:34:00', USR.NADIA, 'published', 'article', KB.SPAM_QUARANTINE,
    'Release a message from spam quarantine',
    'Rewrote it after six near-identical tickets in a fortnight. Now linked from Email in the catalog and from the email-problem intake.'),
  ev('2026-08-03T15:40:00', USR.JAMES, 'created', 'hardware', 'ast-lt-0190',
    'NW-LT-0190 · MacBook Pro 14" (M3 Pro)',
    'Expedited replacement raised against PO-2026-0338 for the stolen NW-LT-0138. $2,399 through CDW, three-day build.'),

  /* ================= Tue 4 Aug — Sam Whitfield starts ================= */
  ev('2026-08-04T08:15:00', USR.LISA, 'enrolled', 'curriculum', CUR.SUPPORT_AGENT,
    'Support Agent',
    "Sam Whitfield's first day. Assigned the whole curriculum — five courses, 4h of lessons, first one due 14 Aug."),
  ev('2026-08-04T08:16:00', USR.LISA, 'enrolled', 'course', CRS.SUPPORT_FOUNDATIONS,
    'Support Foundations: your first week on the queue',
    'Sam Whitfield · due 14 Aug. Every lesson in it is an atom the help centre already publishes.'),
  ev('2026-08-04T10:05:00', USR.EMMA, 'updated', 'software', 'lic-ms365-e3',
    'Microsoft 365 E3 — 180 seats',
    'Reconciled against the July CSP invoice. Two leavers were still holding a licence; seats released back to the pool.'),
  ev('2026-08-04T14:22:00', USR.DEVON, 'commented', 'ticket', 'tkt-4802',
    'TKT-4802 · Store 214 register cannot sync inventory after the 3.4 upgrade',
    'Asked Ravi for the register log bundle. Sync stops at the same pre-2023 tenant boundary Beatriz hit last month.'),

  /* ================= Wed 5 Aug ================= */
  ev('2026-08-05T09:02:00', USR.LISA, 'assigned', 'ticket', 'tkt-4819',
    'TKT-4819 · Where do I find the macro library for refund replies?',
    "Routed to Alex — it is an internal question from Sam, and the answer is the macros lesson he has not reached yet."),
  ev('2026-08-05T11:47:00', USR.PRIYA, 'created', 'problem', 'prb-sync-334',
    'PRB-202 · Register sync silently drops updates for tenants created before 2023',
    'Three tickets, two customers, one signature. Raising it as a problem rather than patching each tenant by hand.'),
  ev('2026-08-05T16:30:00', USR.SAM, 'completed', 'lesson', KB.READING_A_TICKET,
    'How to read a ticket',
    'Second lesson of Support Foundations, 12 minutes. Knowledge check passed first time.'),

  /* ================= Thu 6 Aug ================= */
  ev('2026-08-06T09:20:00', USR.SARAH, 'created', 'approval', 'apr-5',
    'TKT-4821 · Retail Ops Summit sponsorship deposit, $1,800',
    'Spend over $500 started a single manager stage. Resolved to David Wong, 24 hours to decide, escalates to his manager on timeout.'),
  ev('2026-08-06T10:12:00', USR.DAVID, 'approved', 'approval', 'apr-5',
    'TKT-4821 · Retail Ops Summit sponsorship deposit, $1,800',
    'Same slot as last year and it paid for itself. Approved.'),
  ev('2026-08-06T13:05:00', USR.EMMA, 'checked_in', 'software', 'lic-figma',
    'Figma Organization — 25 seats',
    'Reclaimed three seats dormant for 90 days, ahead of the design systems request that everyone knows is coming.'),

  /* ================= Fri 7 Aug ================= */
  ev('2026-08-07T10:44:00', USR.SAM, 'completed', 'course', CRS.SUPPORT_FOUNDATIONS,
    'Support Foundations: your first week on the queue',
    'Passed at 92% on the first attempt, seven days inside the due date.'),
  ev('2026-08-07T11:02:00', USR.LISA, 'commented', 'enrollment', 'enr-sam-foundations',
    'Sam Whitfield · Support Foundations',
    'Strong on the SLA questions. Moving him onto Working the queue now rather than waiting for the September cohort.'),
  ev('2026-08-07T15:18:00', USR.MICHAEL, 'closed', 'ticket', 'tkt-4821',
    'TKT-4821 · Sponsorship deposit for the Retail Ops Summit — $1,800',
    'Deposit raised as PO-2026-0344 and paid the same afternoon. Approval record attached for the audit trail.'),

  /* ================= Sat 8 / Sun 9 Aug — the weekend ================= */
  ev('2026-08-08T10:00:00', USR.EMMA, 'created', 'change', 'chg-1049',
    'CHG-1049 · Replace the DisplayLink docks in the Chicago hot-desk pool',
    'Vendor firmware fix is not coming. Fourteen docks to swap; PRB-205 closes with it rather than staying a standing known error.'),
  ev('2026-08-09T15:48:00', AUTO.BREACH_ESCALATE, 'ran_automation', 'automation', AUTO.BREACH_ESCALATE,
    'SLA breach escalation',
    'run-8720 · Two Enterprise tickets crossed 75% of their resolution target on a Sunday. Raised to urgent and paged the weekend on-call lead.'),

  /* ================= Mon 10 Aug ================= */
  ev('2026-08-10T07:00:00', AUTO.RENEWAL_ALERT, 'ran_automation', 'automation', AUTO.RENEWAL_ALERT,
    'Contract renewal alerts',
    'run-8731 · Three contracts inside 60 days of renewal — Adobe VIP, Salesforce and Dell ProSupport. Procurement notified with seat counts attached.'),
  ev('2026-08-10T09:41:00', USR.JAMES, 'checked_in', 'hardware', 'ast-lt-0190',
    'NW-LT-0190 · MacBook Pro 14" (M3 Pro)',
    'Expedited replacement received at Bolingbrook and imaged with the marketing build. Held for shipping to New York.'),
  ev('2026-08-10T14:20:00', USR.EMMA, 'updated', 'change', 'chg-1048',
    'CHG-1048 · Monthly endpoint patch ring rollout — August',
    'Pilot ring finished on 12 devices with no rollback and no support tickets. Fleet window confirmed for Thursday 20:00 CT.'),

  /* ================= Tue 11 Aug ================= */
  ev('2026-08-11T08:35:00', USR.PATTI, 'created', 'approval', 'apr-3',
    'TKT-4815 · New hire onboarding — Aisha Rahman, start 1 September',
    'New-hire policy started a three-stage ladder: hiring manager, then IT, then Facilities. Stages run in order, not in parallel.'),
  ev('2026-08-11T10:26:00', AUTO.ONBOARDING, 'ran_automation', 'automation', AUTO.ONBOARDING,
    'New hire onboarding',
    'run-8749 · Opened the day-one checklist from the onboarding guide and reserved a laptop from the Bolingbrook pool.'),
  ev('2026-08-11T11:15:00', USR.EMMA, 'checked_in', 'hardware', 'ast-lt-0164',
    'NW-LT-0164 · Latitude 7440',
    'Collected by the Dell depot for a hinge and lid assembly. Nadia works remote — the loaner NW-LT-0187 was meant to go out the same day and has not moved.'),
  ev('2026-08-11T11:44:00', USR.NADIA, 'closed', 'ticket', 'tkt-4806',
    'TKT-4806 · How do I connect Stripe to my storefront?',
    'Answered with the Connect a payment provider guide. Cole confirmed his first live order came through an hour later.'),

  /* ================= Wed 12 Aug ================= */
  ev('2026-08-12T09:30:00', USR.SAM, 'completed', 'lesson', KB.USING_MACROS,
    'Using macros without sounding like a robot',
    'Third lesson of Working the queue, 18 minutes. Same atom the agent panel shows next to a refund ticket.'),
  ev('2026-08-12T11:20:00', USR.EMMA, 'updated', 'software', 'lic-adobe-cc',
    'Adobe Creative Cloud All Apps — 12 seats',
    'Fourteen people are assigned against twelve owned seats. Either two come off before 30 September or the renewal quote grows.'),
  ev('2026-08-12T22:04:00', AUTO.TRIAGE, 'ran_automation', 'automation', AUTO.TRIAGE,
    'Triage — VIP and Enterprise fast path',
    'run-8762 · Routed six overnight tickets. Two took the VIP fast path; four went to the General queue for human triage in the morning.'),

  /* ================= Thu 13 Aug ================= */
  ev('2026-08-13T08:55:00', CON.OWEN, 'created', 'ticket', 'tkt-4809',
    'TKT-4809 · Quarterly access review export is missing deactivated users',
    'Raised through the Vireo Health portal. Their auditor needs the export to include leavers, and the review closes on the 28th.'),
  ev('2026-08-13T09:15:00', AUTO.BREACH_ESCALATE, 'ran_automation', 'automation', AUTO.BREACH_ESCALATE,
    'SLA breach escalation',
    'run-8774 · One Enterprise ticket crossed 75% of its response target. Raised to urgent and posted to the support lead channel.'),
  ev('2026-08-13T10:40:00', USR.EMMA, 'updated', 'problem', 'prb-dock-flicker',
    'PRB-205 · DisplayLink firmware causes display flicker on the Chicago hot-desk docks',
    "Vendor closed our case as 'works as designed'. Moved to known error with the workaround documented and CHG-1049 as the permanent fix."),
  ev('2026-08-13T16:05:00', USR.LISA, 'published', 'article', KB.HANDLING_ANGRY,
    'Handling an angry customer',
    'Second revision after the Parkway escalation. One atom doing three jobs: help centre, agent panel, and lesson four of Writing to customers.'),

  /* ================= Fri 14 Aug ================= */
  ev('2026-08-14T09:05:00', USR.EMMA, 'assigned', 'ticket', 'tkt-4813',
    'TKT-4813 · MacBook Pro screen flickers when docked at the Chicago hot desks',
    'Took it out of the IT queue myself. Tom hot-desks in Chicago on Thursdays, so he gets one of the first replacement docks.'),
  ev('2026-08-14T13:02:00', AUTO.ONBOARDING, 'ran_automation', 'automation', AUTO.ONBOARDING,
    'New hire onboarding',
    "run-8788 · Aisha Rahman's start date came into range. Created the day-one tasks and asked Facilities for a desk at Chicago HQ."),
  ev('2026-08-14T16:00:00', USR.PRIYA, 'created', 'approval', 'apr-1',
    'CHG-1045 · Northwind Storefront 3.5 release to production',
    'Normal change policy started the CAB stage: five members, quorum of three, 72 hours, escalating to an admin if it stalls.'),
  ev('2026-08-14T17:20:00', USR.EMMA, 'approved', 'approval', 'apr-1',
    'CHG-1045 · Northwind Storefront 3.5 release to production',
    'Backout is a single command and the backfill is additive. Comfortable. One of three needed.'),
  ev('2026-08-14T18:30:00', USR.EMMA, 'checked_out', 'hardware', 'ast-lt-0190',
    'NW-LT-0190 · MacBook Pro 14" (M3 Pro)',
    'Shipped to Sarah Johnson at the New York office. Tracking 1Z999AA10123456784, signature required.'),

  /* ================= Sat 15 Aug ================= */
  ev('2026-08-15T10:05:00', USR.JEN, 'approved', 'approval', 'apr-1',
    'CHG-1045 · Northwind Storefront 3.5 release to production',
    'Three customer-visible fixes in this train that we have promised by name. Yes. Two of three needed.'),
  ev('2026-08-15T10:05:00', USR.ROBERT, 'approved', 'approval', 'apr-4',
    'TKT-4822 · Salesforce sandbox admin access for Tom Alvarez',
    'Tom needs this to finish the mapping. Fine by me. Stage still needs the system owner.'),
  ev('2026-08-15T13:30:00', CON.BEA, 'created', 'ticket', 'tkt-4803',
    'TKT-4803 · Duplicate charge on August invoice INV-20418',
    'Parkway were billed twice for the same 85 seats. Their finance team has already flagged it with the card issuer.'),
  ev('2026-08-15T14:00:00', USR.PRIYA, 'created', 'approval', 'apr-2',
    'TKT-4814 · Figma Enterprise — 8 seats, $6,400 annual',
    'Over the $5,000 threshold, so it is manager then Finance. The $500 stage was skipped as redundant and says so on the ladder.'),
  ev('2026-08-15T15:40:00', USR.EMMA, 'rejected', 'approval', 'apr-4',
    'TKT-4822 · Salesforce sandbox admin access for Tom Alvarez',
    'Standing admin on a sandbox holding production data is an audit finding waiting to happen. Offering a two-week scoped role instead.'),
  ev('2026-08-15T16:05:00', CON.BEA, 'created', 'ticket', 'tkt-4808',
    'TKT-4808 · Shipment webhook retries exhausted — orders stuck in Awaiting Fulfilment',
    'Parkway took a 40-minute maintenance window and came back to 1,900 orders that never got their fulfilment callback.'),
  ev('2026-08-15T17:40:00', USR.NADIA, 'escalated', 'ticket', 'tkt-4808',
    'TKT-4808 · Shipment webhook retries exhausted — orders stuck in Awaiting Fulfilment',
    'Raised to engineering and attached to PRB-203. Our retry budget is shorter than a normal customer maintenance window.'),
  ev('2026-08-15T18:12:00', AUTO.CSAT_FOLLOWUP, 'ran_automation', 'automation', AUTO.CSAT_FOLLOWUP,
    'CSAT follow-up',
    'run-8829 · Surveyed nine tickets closed today. Two replies already in: one Great, one Bad with a comment about the second reply time.'),
  ev('2026-08-15T22:18:00', CON.DANA, 'created', 'ticket', 'tkt-4801',
    'TKT-4801 · Checkout returns 502 during Saturday peak traffic',
    'Opened from the Lumen Retail portal at 22:18. Roughly one checkout in six failed between 21:40 and 22:10 CT.'),

  /* ================= Sun 16 Aug — today ================= */
  ev('2026-08-16T06:14:00', USR.JAMES, 'commented', 'ticket', 'tkt-4814',
    'TKT-4814 · Request: 8 Figma Enterprise seats for the design systems work',
    'Figma quoted $6,400 for eight seats on the existing Org plan, co-termed to 30 November. Waiting on the Finance stage.'),
  ev('2026-08-16T07:10:00', CON.COLE, 'created', 'ticket', 'tkt-4810',
    'TKT-4810 · Trial ended but I was charged for 12 seats',
    'Fernbrook are on Starter and twelve days old as a customer. This is the first bill they have ever seen from us.'),
  ev('2026-08-16T07:20:00', CON.OWEN, 'created', 'ticket', 'tkt-4804',
    'TKT-4804 · API keys rotated — webhook deliveries now failing with 401',
    'Vireo rotated their keys on Friday and every webhook since has 401d. Clinical order sync is the blast radius.'),
  ev('2026-08-16T07:52:00', USR.SARAH, 'created', 'ticket', 'tkt-4812',
    'TKT-4812 · Cannot sign in to the reporting console after MFA reset',
    'Submitted through the portal after the reset guide did not deflect it. Board deck is due Monday morning.'),
  ev('2026-08-16T08:05:00', USR.LISA, 'escalated', 'ticket', 'tkt-4801',
    'TKT-4801 · Checkout returns 502 during Saturday peak traffic',
    'Lumen is Enterprise and this is peak-season revenue. Raised to urgent, engineering paged, linked to PRB-201.'),
  ev('2026-08-16T08:30:00', USR.MIKE, 'created', 'approval', 'apr-6',
    'CHG-1044 · Replay held shipment webhooks for Parkway Logistics',
    'Emergency change. On-call authorisation, any one of four approvers, due in two hours or it goes to Alex.'),
  ev('2026-08-16T08:40:00', CON.MEI, 'created', 'ticket', 'tkt-4805',
    'TKT-4805 · Bulk catalog import stalls at 40% for files over 20,000 rows',
    'Vireo are migrating 60,000 SKUs this week and the import dies at the same point every run.'),
  ev('2026-08-16T08:44:00', USR.LISA, 'assigned', 'ticket', 'tkt-4805',
    'TKT-4805 · Bulk catalog import stalls at 40% for files over 20,000 rows',
    'Given to Sam with Nadia shadowing. He finished the catalog import lesson on Wednesday — first customer ticket on the strength of it.'),
  ev('2026-08-16T08:45:00', AUTO.BREACH_ESCALATE, 'ran_automation', 'automation', AUTO.BREACH_ESCALATE,
    'SLA breach escalation',
    'run-8836 · Running now. TKT-4801 is at 82% of the Enterprise four-hour response target and the PagerDuty leg is erroring.'),
  ev('2026-08-16T08:52:00', USR.ADMIN, 'commented', 'change', 'chg-1044',
    'CHG-1044 · Emergency: replay held shipment webhooks for Parkway Logistics',
    "Standing by for the on-call decision. Parkway's ops manager has been told 09:30 CT, so we need an answer inside the hour."),
];
