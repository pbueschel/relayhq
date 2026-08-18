/**
 * Service catalog seed — Northwind Systems.
 *
 * THIS IS THE "I WANT SOMETHING" CATALOG, NOT THE HELP TREE.
 *
 * `catalog` answers "something is wrong" with a Product › Subcategory › Item
 * tree whose leaves carry knowledge first. This file answers "I want
 * something": a flat Category › ServiceItem list of orderable things, each with
 * a price, a delivery time, a fulfilment queue and — where the money or the risk
 * justifies it — an approval. See the TWO CATALOGS comment in schema.js.
 *
 * WHAT THE SEED IS BUILT TO DEMONSTRATE
 *
 *   PRICE SHAPE VARIES, AND THE UI HAS TO COPE. A laptop is a one-off capital
 *   cost. A Figma seat is a monthly recurring cost with no up-front charge. VPN
 *   access is free. All three are the same record type, distinguished only by
 *   `price` / `recurringPrice` / `recurrence`. Null means free — so nothing that
 *   actually costs money is left null "because it varies".
 *
 *   APPROVAL IS THE EXCEPTION, NOT THE DEFAULT. Nine of the twenty-three items
 *   have no policy at all: a headset, a loaner, a desk move, VPN. The contrast
 *   is the point — an approval chain on a $0 request is the thing that makes
 *   staff stop using a portal. Sign-off appears where spend passes the $500 or
 *   $5,000 threshold, where someone is being granted access to something they
 *   could not previously reach, or where a person joins or leaves.
 *
 *   THE REQUEST FORM IS AN ORDINARY SUBFORM. SERVICE_SUBFORMS are merged into
 *   the same `subforms` collection as the help-tree intakes in forms.js — same
 *   builder, same conditional fields, same routing. A service item points at one
 *   by id and owns no field model of its own.
 *
 *   AND WHERE THE INTAKE ALREADY EXISTS, IT IS REUSED RATHER THAN REDRAWN.
 *   Three of these items — application access, onboarding, offboarding — are the
 *   ordering face of an intake forms.js already owns (`sf-request-access`,
 *   `sf-new-hire`, `sf-offboarding`). They point at it by its id from ids.js.
 *   Authoring a second near-identical copy would fork the atom the whole product
 *   is built to keep single, and it has a second, harder consequence: the
 *   approval policies in rules.js name those canonical subform ids in their
 *   `appliesWhen`, so a forked copy submits a ticket and silently starts NO
 *   approval. The reference is what makes the sign-off real.
 *
 *   A SPEND THRESHOLD NEEDS AN AMOUNT TO READ. `pol-spend-500` and
 *   `pol-spend-5000` test `answers.amount`, which the portal derives from the
 *   first `currency` field on the submitted form (forms.js does the same with
 *   `hw-cost` and `swr-cost`). So every intake behind a spend policy carries one,
 *   priced from the item it belongs to. Without it the policy evaluates against
 *   an absent amount, declines, and the request goes through unapproved.
 *
 *   ORDERING PROVISIONS A REAL ASSET. Where the outcome of a request is a
 *   physical thing, `assetModelId` names the model in assets.js that fulfilment
 *   will create an instance of, so "Request a monitor" and the UltraSharp on
 *   someone's desk are demonstrably the same object at two points in time.
 *
 * IDS DECLARED LOCALLY, AND WHY
 *   ids.js declares every id that crosses a domain boundary, and every id that
 *   does cross one is imported from there — the queues, policies, knowledge
 *   atoms, categories, items and the three shared intakes above. Two families
 *   are local: the request forms this file is the only owner of (nothing outside
 *   references them — the items that own them are right here) and the asset
 *   model ids (owned by the assets domain, which spells them inline). Both are
 *   collected into a single map at the top of this file rather than scattered as
 *   literals, so there is still exactly one place to change them.
 */

import { Q, POL, KB, SF, SVCCAT, SVC, USR, MDL, LIC } from './ids.js';

/* ------------------------------------------------------------------ *
 * Request-form ids — the intakes this file authors, keyed identically to SVC.
 * These land in the shared `subforms` collection, so the prefix keeps them
 * distinct from the help-tree intakes in forms.js (`sf-report-signin` etc).
 *
 * Three service items are absent here on purpose: application access,
 * onboarding and offboarding reuse `SF.REQUEST_ACCESS`, `SF.NEW_HIRE` and
 * `SF.OFFBOARDING` from ids.js rather than forking a second copy of an intake
 * that already exists — see the header.
 * ------------------------------------------------------------------ */

const SVCSF = {
  NEW_LAPTOP:       'sf-svc-new-laptop',
  MONITOR:          'sf-svc-monitor',
  HEADSET:          'sf-svc-headset',
  PHONE:            'sf-svc-phone',
  LOANER:           'sf-svc-loaner',
  SOFTWARE_LICENCE: 'sf-svc-software-licence',
  ADOBE_SEAT:       'sf-svc-adobe-seat',
  FIGMA_SEAT:       'sf-svc-figma-seat',
  VM_SANDBOX:       'sf-svc-vm-sandbox',
  VPN_ACCESS:       'sf-svc-vpn-access',
  SHARED_MAILBOX:   'sf-svc-shared-mailbox',
  ELEVATED_ACCESS:  'sf-svc-elevated-access',
  ROLE_CHANGE:      'sf-svc-role-change',
  DESK_MOVE:        'sf-svc-desk-move',
  MEETING_KIT:      'sf-svc-meeting-kit',
  BUILDING_ACCESS:  'sf-svc-building-access',
  EXTRA_SEATS:      'sf-svc-extra-seats',
  SANDBOX_TENANT:   'sf-svc-sandbox-tenant',
  PREMIUM_SUPPORT:  'sf-svc-premium-support',
  ONBOARDING_HELP:  'sf-svc-onboarding-help',
};

/* Asset models that ordering provisions. These are the real ids from
 * assets.js ASSET_MODELS — do not invent one; if fulfilment cannot create the
 * instance the link is worse than absent. */
/* Shared vocabulary — the same words on every intake that asks the same
 * question. Kept identical to forms.js so a person filling in two requests is
 * not asked the same thing two different ways. */
const SITES = ['Chicago HQ', 'New York', 'Austin Support Centre', 'Elk Grove DC', 'Bolingbrook Warehouse', 'Remote / home office'];

/* ==================================================================== *
 * CATEGORIES — the six shelves of the store. Five internal, one external.
 * ==================================================================== */

export const SERVICE_CATEGORIES = [
  {
    id: SVCCAT.HARDWARE,
    name: 'Hardware',
    description: 'Laptops, monitors, phones and the accessories that go with them. Everything here arrives as a tracked asset with your name on it.',
    icon: 'Laptop',
    audience: 'internal',
    order: 1,
  },
  {
    id: SVCCAT.SOFTWARE,
    name: 'Software & Licences',
    description: 'Seats on the tools Northwind already buys, and a route to get something new bought. Check the licence pool first — a spare seat is same-day.',
    icon: 'AppWindow',
    audience: 'internal',
    order: 2,
  },
  {
    id: SVCCAT.ACCESS,
    name: 'Access & Accounts',
    description: 'Get into a system, a mailbox or the network. Standard access is granted on your existing identity; anything privileged goes to the system owner first.',
    icon: 'KeyRound',
    audience: 'internal',
    order: 3,
  },
  {
    id: SVCCAT.PEOPLE,
    name: 'People & Onboarding',
    description: 'Joiners, movers and leavers. One request fans out into the IT, Facilities and Payroll work that has to happen against a start or a last day.',
    icon: 'Users',
    audience: 'internal',
    order: 4,
  },
  {
    id: SVCCAT.WORKPLACE,
    name: 'Workplace & Facilities',
    description: 'Desks, meeting rooms and doors across Chicago, New York, Austin and the two Illinois facilities. Owned by Facilities, not IT.',
    icon: 'Building2',
    audience: 'internal',
    order: 5,
  },
  {
    id: SVCCAT.CUSTOMER,
    name: 'Customer Services',
    description: 'Things a Northwind Storefront customer can order for their own account: more seats, a sandbox, a higher support tier or hands-on implementation help.',
    icon: 'Store',
    audience: 'external',
    order: 6,
  },
];

/* ==================================================================== *
 * SERVICE ITEMS — 23 orderable things, one per id in SVC.
 *
 * `approvalPolicyId` mirrors the policy on the item's request form, because the
 * portal starts the approval off the submitted subform and the catalog admin
 * reads it off the item. The two must agree or the badge on the card promises a
 * sign-off the submission does not run.
 * ==================================================================== */

export const SERVICE_ITEMS = [
  /* ---------------- Hardware — fulfilled by IT ---------------- */
  {
    id: SVC.NEW_LAPTOP,
    categoryId: SVCCAT.HARDWARE,
    name: 'New laptop',
    shortDescription: 'A standard Windows or Mac build, imaged and shipped within five working days.',
    description:
      'Orders a machine from the current standard build list: a Dell Latitude 7440 for most roles, a MacBook Pro 14" for engineering, design and leadership. It arrives imaged with the Northwind base image, enrolled in device management and encrypted, so you sign in with SSO and start working. The 16" MacBook Pro is an exception build — the form asks you to justify it and your manager sees that justification when they approve. Price shown is the standard Windows build; the quote on the request reflects the model you pick.',
    icon: 'Laptop',
    audience: 'internal',
    subformId: SVCSF.NEW_LAPTOP,
    knowledgeIds: [KB.LAPTOP_SETUP],
    approvalPolicyId: POL.SPEND_OVER_500,
    fulfilmentQueueId: Q.IT,
    price: 1749,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 5,
    assetModelId: MDL.LAT7440,
    popular: true,
    status: 'published',
  },
  {
    id: SVC.MONITOR,
    categoryId: SVCCAT.HARDWARE,
    name: 'Second monitor',
    shortDescription: 'A 27" Dell UltraSharp for your desk or your home office.',
    description:
      'The standard display is the Dell UltraSharp U2723QE — 27", 4K, and it charges your laptop over the single USB-C cable so you are not hunting for a dock. Office orders are delivered to your desk from Bolingbrook stock, usually next day. Home orders ship to the address on your directory record. One per person is standard; a second needs a line on the form saying what you are doing with it.',
    icon: 'Monitor',
    audience: 'internal',
    subformId: SVCSF.MONITOR,
    knowledgeIds: [KB.REQUEST_MONITOR],
    approvalPolicyId: POL.SPEND_OVER_500,
    fulfilmentQueueId: Q.IT,
    price: 579,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 2,
    assetModelId: MDL.U2723,
    popular: true,
    status: 'published',
  },
  {
    id: SVC.HEADSET,
    categoryId: SVCCAT.HARDWARE,
    name: 'Headset',
    shortDescription: 'Noise-cancelling USB headset — the standard kit for anyone on calls all day.',
    description:
      'The Jabra Evolve2 65, which is what the Austin support floor runs on: dual-connect so it pairs with the laptop and the phone at once, and a boom mic that survives an open-plan room. Under the approval threshold, so nobody has to sign it off — pick a colour, tell us where to send it and it goes out with the next courier run.',
    icon: 'Headphones',
    audience: 'internal',
    subformId: SVCSF.HEADSET,
    knowledgeIds: [],
    fulfilmentQueueId: Q.IT,
    price: 129,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 3,
    popular: true,
    status: 'published',
  },
  {
    id: SVC.PHONE,
    categoryId: SVCCAT.HARDWARE,
    name: 'Company phone',
    shortDescription: 'iPhone 15 Pro on a Verizon business line, for on-call, field sales and leadership.',
    description:
      'A company handset is issued where the role genuinely needs one: the support escalation rota, field sales, and leadership. It comes with a Verizon business line at $55 a month against your cost centre, enrolled in device management, with work mail and Teams already configured. Personal use is fine within the fair-use policy. If you only need work mail on a phone you already own, you do not need this — set up the mail app instead.',
    icon: 'Smartphone',
    audience: 'internal',
    subformId: SVCSF.PHONE,
    knowledgeIds: [KB.EMAIL_ON_PHONE],
    approvalPolicyId: POL.SPEND_OVER_500,
    fulfilmentQueueId: Q.IT,
    price: 1099,
    recurringPrice: 55,
    recurrence: 'monthly',
    deliveryDays: 5,
    assetModelId: MDL.IPHONE15,
    popular: false,
    status: 'published',
  },
  {
    id: SVC.LOANER,
    categoryId: SVCCAT.HARDWARE,
    name: 'Loaner laptop',
    shortDescription: 'A temporary machine while yours is being repaired, or for a short-term contractor.',
    description:
      'A ThinkPad X1 Carbon from the Bolingbrook spare pool, imaged and ready to sign into. Free, no approval, and available the next working day — because the alternative is somebody sitting idle waiting for a depot repair. Loans run for 30 days by default and are extended on request. Return it through the equipment return process the day your own machine comes back.',
    icon: 'PackageOpen',
    audience: 'internal',
    subformId: SVCSF.LOANER,
    knowledgeIds: [KB.RETURN_EQUIPMENT],
    fulfilmentQueueId: Q.IT,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 1,
    assetModelId: MDL.X1C11,
    popular: false,
    status: 'published',
  },

  /* ---------------- Software & licences — fulfilled by Procurement ---------------- */
  {
    id: SVC.SOFTWARE_LICENCE,
    categoryId: SVCCAT.SOFTWARE,
    name: 'Software licence',
    shortDescription: 'A seat on an application that is not in the standard bundle.',
    description:
      'For anything Northwind does not already hand out with Microsoft 365. Procurement checks the licence pool first — if we hold a spare seat you will have it the same day at no new cost. If we do not, they take the request to the vendor and come back with a quote before anything is bought. The price shown is the median seat cost across our current agreements, not a quote. Annual cost above $500 needs your manager, and anything holding identifiable customer data goes through a security review before purchase.',
    icon: 'AppWindow',
    audience: 'internal',
    subformId: SVCSF.SOFTWARE_LICENCE,
    knowledgeIds: [KB.LICENSE_POLICY, KB.INSTALL_SOFTWARE],
    approvalPolicyId: POL.SPEND_OVER_500,
    fulfilmentQueueId: Q.PROCUREMENT,
    price: null,
    recurringPrice: 45,
    recurrence: 'monthly',
    deliveryDays: 3,
    popular: true,
    status: 'published',
  },
  {
    id: SVC.ADOBE_SEAT,
    categoryId: SVCCAT.SOFTWARE,
    name: 'Adobe Creative Cloud seat',
    shortDescription: 'All Apps licence for design and campaign production — $60 per month.',
    description:
      'A named seat on the Northwind VIP agreement, covering Photoshop, Illustrator, InDesign, Premiere and Acrobat Pro. Be aware that the agreement is currently deployed past its entitlement and renews on 9 October, so Procurement may ask you to wait for the renewal rather than buy a single seat at list price. If you only need to sign or fill a PDF, Acrobat Reader is already on your machine and this is not the request you want.',
    icon: 'Palette',
    audience: 'internal',
    subformId: SVCSF.ADOBE_SEAT,
    knowledgeIds: [KB.ADOBE_ACTIVATION, KB.LICENSE_POLICY],
    approvalPolicyId: POL.SPEND_OVER_500,
    fulfilmentQueueId: Q.PROCUREMENT,
    price: null,
    recurringPrice: 60,
    recurrence: 'monthly',
    deliveryDays: 2,
    popular: false,
    status: 'published',
  },
  {
    id: SVC.FIGMA_SEAT,
    categoryId: SVCCAT.SOFTWARE,
    name: 'Figma editor seat',
    shortDescription: 'An editor seat on the Northwind organisation — $45 per month.',
    description:
      'Editor access to the Northwind Figma organisation, including the design system library and the Storefront product files. Viewing and commenting is free and does not need this request — if all you do is review work and leave comments, ask a designer to share the file instead. Editor seats are billed monthly to your cost centre and reclaimed automatically after 60 days with no edits.',
    icon: 'PenTool',
    audience: 'internal',
    subformId: SVCSF.FIGMA_SEAT,
    knowledgeIds: [KB.LICENSE_POLICY],
    approvalPolicyId: POL.SPEND_OVER_500,
    fulfilmentQueueId: Q.PROCUREMENT,
    price: null,
    recurringPrice: 45,
    recurrence: 'monthly',
    deliveryDays: 2,
    popular: true,
    status: 'published',
  },
  {
    id: SVC.VM_SANDBOX,
    categoryId: SVCCAT.SOFTWARE,
    name: 'Development sandbox VM',
    shortDescription: 'A throwaway virtual machine on the Elk Grove cluster, live in three days.',
    description:
      'A self-service VM on the vSphere cluster for testing, spikes and anything you would rather not run on your laptop. Four vCPU, 16 GB and 200 GB of thin-provisioned disk as standard, on the internal network only — no inbound access from the internet, which is why it needs no approval. Sandboxes expire after 30 days and you get two reminders before one is deleted. Still in pilot with the platform team, so it is not published to the portal yet.',
    icon: 'Server',
    audience: 'internal',
    subformId: SVCSF.VM_SANDBOX,
    knowledgeIds: [],
    fulfilmentQueueId: Q.IT,
    price: null,
    recurringPrice: 35,
    recurrence: 'monthly',
    deliveryDays: 3,
    popular: false,
    status: 'draft',
  },

  /* ---------------- Access & accounts — fulfilled by IT ---------------- */
  {
    id: SVC.APP_ACCESS,
    grantsAccess: true,
    categoryId: SVCCAT.ACCESS,
    name: 'Access to an application',
    shortDescription: 'An account or a higher permission level in Salesforce, Workday, GitHub and the rest.',
    description:
      'Grants you a role in a system you cannot currently reach, or raises the role you already have. Ask for the least you need — read is granted on your manager\'s approval alone, while admin also goes to the system owner, and the two of them see the justification you write here. Temporary grants are revoked automatically on the date you give, so a project handover does not leave standing access behind.',
    icon: 'KeyRound',
    audience: 'internal',
    // The ordering face of the intake forms.js already owns. Reused, not
    // redrawn — and `pol-access-grant` names this subform id, so reusing it is
    // what makes the sign-off actually run.
    subformId: SF.REQUEST_ACCESS,
    knowledgeIds: [KB.SSO_EXPLAINED],
    approvalPolicyId: POL.ACCESS_GRANT,
    fulfilmentQueueId: Q.IT,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 2,
    popular: true,
    status: 'published',
  },
  {
    id: SVC.VPN_ACCESS,
    // Free, but not low-risk: remote network access is signed off like any
    // other privileged grant. Cost and risk are different axes.
    approvalPolicyId: POL.ACCESS_GRANT,
    grantsAccess: true,
    categoryId: SVCCAT.ACCESS,
    name: 'VPN access',
    shortDescription: 'Remote access to the internal network. Free, and no approval needed.',
    description:
      'Standard for every employee on a managed device, so there is nothing to sign off — the profile is pushed to your laptop and you sign in with SSO and your existing MFA. Most people never need it: Microsoft 365, Salesforce and RelayHQ are all reachable over the internet. You want this if you need the Elk Grove environment, an internal admin interface, or a database that only listens inside the network.',
    icon: 'ShieldCheck',
    audience: 'internal',
    subformId: SVCSF.VPN_ACCESS,
    knowledgeIds: [KB.MFA_SETUP],
    fulfilmentQueueId: Q.IT,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 1,
    popular: false,
    status: 'published',
  },
  {
    id: SVC.SHARED_MAILBOX,
    grantsAccess: true,
    categoryId: SVCCAT.ACCESS,
    name: 'Shared mailbox',
    shortDescription: 'Create a team mailbox, or get added to one that already exists.',
    description:
      'A shared mailbox is how a team owns an address — support@, invoices@, careers@ — without anybody having to forward mail from their own inbox. It appears alongside your own mailbox in Outlook with no extra sign-in. Access to an existing mailbox needs sign-off because you are being given sight of someone else\'s correspondence; creating a new one needs a named owner who will approve future members.',
    icon: 'Inbox',
    audience: 'internal',
    subformId: SVCSF.SHARED_MAILBOX,
    knowledgeIds: [],
    approvalPolicyId: POL.ACCESS_GRANT,
    fulfilmentQueueId: Q.IT,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 2,
    popular: false,
    status: 'published',
  },
  {
    id: SVC.ELEVATED_ACCESS,
    grantsAccess: true,
    categoryId: SVCCAT.ACCESS,
    name: 'Elevated access',
    shortDescription: 'Time-boxed admin rights for a specific piece of work. Granted within one day.',
    description:
      'Local administrator on your own machine, or a privileged role in a production system, for as long as the work takes and no longer. Eight hours is the default window; longer needs the change or incident reference that justifies it. The system owner and your manager both approve, the session is logged, and the grant drops automatically when the window closes — you do not have to remember to hand it back.',
    icon: 'ShieldAlert',
    audience: 'internal',
    subformId: SVCSF.ELEVATED_ACCESS,
    knowledgeIds: [KB.SSO_EXPLAINED, KB.APPROVAL_THRESHOLDS],
    approvalPolicyId: POL.ACCESS_GRANT,
    fulfilmentQueueId: Q.IT,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 1,
    popular: false,
    status: 'published',
  },

  /* ---------------- People & onboarding — fulfilled by People Ops ---------------- */
  {
    id: SVC.ONBOARD_HIRE,
    categoryId: SVCCAT.PEOPLE,
    name: 'Onboard a new hire',
    shortDescription: 'Everything a joiner needs on day one, from one request.',
    description:
      'The hiring manager raises this once and People Ops fans it out: the directory record and SSO account, the laptop and kit, the access bundle for the job function, a desk and a badge, payroll, and enrolment on the training curriculum for the role. Raise it at least ten working days before the start date — that is how long it takes to image a machine and get a badge printed, and the delivery estimate here assumes it. Kit costs land on the hiring team\'s cost centre.',
    icon: 'UserPlus',
    audience: 'internal',
    // `pol-new-hire` applies when the submitted form is this one. Pointing at a
    // service-catalog copy would raise the request and start nothing.
    subformId: SF.NEW_HIRE,
    knowledgeIds: [KB.ONBOARDING_CHECKLIST, KB.LAPTOP_SETUP],
    approvalPolicyId: POL.NEW_HIRE,
    fulfilmentQueueId: Q.PEOPLE,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 10,
    popular: true,
    status: 'published',
  },
  {
    id: SVC.OFFBOARD,
    categoryId: SVCCAT.PEOPLE,
    name: 'Offboard someone',
    shortDescription: 'Close accounts, recover equipment and hand over work when a person leaves.',
    description:
      'Revokes access, recovers the kit and moves the mailbox and calendar to whoever is picking the work up. Access is cut at 17:00 on the last working day by default; an involuntary departure can revoke immediately, which is the one case where the form asks for security instructions. Equipment comes back through a courier label sent to the person\'s home address, and every asset assigned to them moves to In Transit until it is scanned at Bolingbrook.',
    icon: 'UserMinus',
    audience: 'internal',
    // Same reuse, same reason: `pol-offboarding` is keyed to this intake.
    subformId: SF.OFFBOARDING,
    knowledgeIds: [KB.RETURN_EQUIPMENT],
    approvalPolicyId: POL.OFFBOARDING,
    fulfilmentQueueId: Q.PEOPLE,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 5,
    popular: false,
    status: 'published',
  },
  {
    id: SVC.ROLE_CHANGE,
    grantsAccess: true,
    categoryId: SVCCAT.PEOPLE,
    name: 'Role or team change',
    shortDescription: 'Move someone to a new manager, team or site and reset their access to match.',
    description:
      'An internal move is the change most often done badly: the person picks up the access their new role needs and keeps everything the old one had. This request rebases them — new manager and cost centre in the directory, the access bundle for the new job function added, the old bundle removed on the date the move takes effect, and the training curriculum swapped to the one that teaches the new job. The access changes need the same sign-off a fresh grant would.',
    icon: 'UserCog',
    audience: 'internal',
    subformId: SVCSF.ROLE_CHANGE,
    knowledgeIds: [KB.SSO_EXPLAINED],
    approvalPolicyId: POL.ACCESS_GRANT,
    fulfilmentQueueId: Q.PEOPLE,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 5,
    popular: false,
    status: 'published',
  },

  /* ---------------- Workplace & facilities — fulfilled by Facilities ---------------- */
  {
    id: SVC.DESK_MOVE,
    categoryId: SVCCAT.WORKPLACE,
    name: 'Desk move',
    shortDescription: 'Move a desk, a monitor and a phone extension to another spot in the building.',
    description:
      'Facilities move the furniture and the kit, and IT re-patch the network port and the extension so the phone still rings at the new desk. Moves are batched into Tuesday and Thursday evenings so nobody works around a trolley — book three days out and your desk is ready when you arrive. Free, no approval: a request that costs nothing and blocks nobody should not need a signature.',
    icon: 'Armchair',
    audience: 'internal',
    subformId: SVCSF.DESK_MOVE,
    knowledgeIds: [],
    fulfilmentQueueId: Q.FACILITIES,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 3,
    popular: false,
    status: 'published',
  },
  {
    id: SVC.MEETING_KIT,
    categoryId: SVCCAT.WORKPLACE,
    name: 'Meeting room AV kit',
    shortDescription: 'Fit a room out for hybrid meetings — display, camera, table mics and a room account.',
    description:
      'A full room build: a 65" display, a Logitech Rally camera bar, table microphones, cabling, and the room mailbox and calendar so people can book it by name. Installation is done by the AV contractor out of hours, and the room is certified for Teams before it is handed back. Above the $5,000 threshold, so it goes to your manager, Finance and a skip-level before the contractor is booked — plan on four weeks from request to first meeting.',
    icon: 'Presentation',
    audience: 'internal',
    subformId: SVCSF.MEETING_KIT,
    knowledgeIds: [],
    approvalPolicyId: POL.SPEND_OVER_5000,
    fulfilmentQueueId: Q.FACILITIES,
    price: 5400,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 20,
    popular: false,
    status: 'published',
  },
  {
    id: SVC.BUILDING_ACCESS,
    grantsAccess: true,
    categoryId: SVCCAT.WORKPLACE,
    name: 'Building access',
    shortDescription: 'A badge for a site you do not normally work at, or out-of-hours access.',
    description:
      'Adds a site or a restricted area to your badge: another office, the Bolingbrook warehouse floor, or the Elk Grove cage, which the colocation provider administers on a two-day lead time. Out-of-hours access to Chicago HQ is included in the same request. The site lead approves, because they are the person who has to know who is in the building at 22:00 on a Sunday.',
    icon: 'DoorOpen',
    audience: 'internal',
    subformId: SVCSF.BUILDING_ACCESS,
    knowledgeIds: [],
    approvalPolicyId: POL.ACCESS_GRANT,
    fulfilmentQueueId: Q.FACILITIES,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 2,
    popular: false,
    status: 'published',
  },

  /* ---------------- Customer services — external, fulfilled by Support ---------------- */
  {
    id: SVC.EXTRA_SEATS,
    categoryId: SVCCAT.CUSTOMER,
    name: 'Additional Storefront seats',
    shortDescription: 'Add admin users to your Storefront account — $29 per seat per month.',
    description:
      'Every Storefront plan includes a set number of admin seats; this adds more. Seats are prorated to your current billing period and appear on the next invoice, and you can name the people now or invite them yourself afterwards. Staff accounts with till-only access do not consume a seat, so if you are adding shop-floor users you probably do not need this.',
    icon: 'Users',
    audience: 'external',
    subformId: SVCSF.EXTRA_SEATS,
    knowledgeIds: [KB.INVOICE_QUESTIONS],
    fulfilmentQueueId: Q.SUPPORT,
    price: null,
    recurringPrice: 29,
    recurrence: 'monthly',
    deliveryDays: 1,
    popular: true,
    status: 'published',
  },
  {
    id: SVC.SANDBOX_TENANT,
    categoryId: SVCCAT.CUSTOMER,
    name: 'Sandbox tenant',
    shortDescription: 'A free copy of your Storefront account to build and test against.',
    description:
      'A separate tenant with its own API keys, seeded with a copy of your catalog and a set of test orders, where nothing you do touches real customers or real money. Payments run against the gateway test mode, and webhooks fire exactly as they do in production. Free with every plan. Launching alongside the next Storefront release, so it is drafted here but not yet on the customer portal.',
    icon: 'FlaskConical',
    audience: 'external',
    subformId: SVCSF.SANDBOX_TENANT,
    knowledgeIds: [KB.STOREFRONT_SETUP, KB.API_KEYS],
    fulfilmentQueueId: Q.SUPPORT,
    price: null,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 2,
    popular: false,
    status: 'draft',
  },
  {
    id: SVC.PREMIUM_SUPPORT,
    categoryId: SVCCAT.CUSTOMER,
    name: 'Premium support',
    shortDescription: 'A named engineer, a 1-hour response target and 24/7 cover — $1,200 per month.',
    description:
      'Moves your account onto the Enterprise service level: a one-hour first response on urgent tickets, cover outside business hours including weekends, a named support engineer who knows your integration, and a quarterly review of the tickets you raised and what we are doing about the causes. Sensible if you trade at weekends or through a peak season. Starts at the beginning of the next billing period.',
    icon: 'LifeBuoy',
    audience: 'external',
    subformId: SVCSF.PREMIUM_SUPPORT,
    knowledgeIds: [KB.SLA_EXPLAINED],
    fulfilmentQueueId: Q.SUPPORT,
    price: null,
    recurringPrice: 1200,
    recurrence: 'monthly',
    deliveryDays: 5,
    popular: true,
    status: 'published',
  },
  {
    id: SVC.ONBOARDING_HELP,
    categoryId: SVCCAT.CUSTOMER,
    name: 'Guided implementation',
    shortDescription: 'Two weeks of hands-on help getting Storefront live — $4,500 one-off.',
    description:
      'A Northwind implementation specialist works with your team for two weeks: importing the catalog, connecting the payment gateway, mapping shipping rates, moving the DNS, and a launch rehearsal against your sandbox before you switch real traffic over. Ends with a handover session for whoever runs the store day to day. The guides linked here cover the same ground if you would rather do it yourself — most customers on the Starter plan do.',
    icon: 'Rocket',
    audience: 'external',
    subformId: SVCSF.ONBOARDING_HELP,
    knowledgeIds: [KB.STOREFRONT_SETUP, KB.IMPORT_CATALOG, KB.CONNECT_PAYMENTS],
    fulfilmentQueueId: Q.SUPPORT,
    price: 4500,
    recurringPrice: null,
    recurrence: null,
    deliveryDays: 10,
    popular: false,
    status: 'published',
  },
];

/* ==================================================================== *
 * SERVICE SUBFORMS — the request forms this file authors, twenty of them.
 * The other three items order through the forms.js intakes named above.
 *
 * Ordinary subforms: they merge into the same `subforms` collection as the
 * help-tree intakes, carry the same field types, and route with the same
 * { queueId } shape. `showIf` is evaluated by lib/conditions.js against the
 * answer map keyed by field id, so a condition here reads as a sentence in the
 * builder rather than as JSON.
 *
 * A form whose item carries a spend policy also carries exactly one `currency`
 * field: the portal derives `answers.amount` from the first one it finds, and
 * that is what `pol-spend-500` and `pol-spend-5000` test.
 * ==================================================================== */

export const SERVICE_SUBFORMS = [
  /* ---------------- Hardware ---------------- */
  {
    id: SVCSF.NEW_LAPTOP,
    raises: 'service_request',
    fulfils: { kind: 'hardware', modelId: MDL.LAT7440 },
    name: 'Order a laptop',
    description: 'Pick a build, tell us whether it replaces something, and where to send it.',
    audience: 'internal',
    routing: { queueId: Q.IT },
    approvalPolicyId: POL.SPEND_OVER_500,
    submitLabel: 'Order laptop',
    confirmation: 'Your manager approves first, then IT image the machine. You will get a tracking number when it ships from Bolingbrook.',
    ownerId: USR.EMMA,
    updatedAt: '2026-08-10T09:15:00',
    submissions30d: 31,
    enabled: true,
    fields: [
      { id: 'lap-build', type: 'select', label: 'Which build?', required: true,
        options: ['Dell Latitude 7440 — standard Windows', 'MacBook Pro 14" (M3 Pro) — standard Mac', 'MacBook Pro 16" (M3 Max) — exception build'],
        help: 'Take the standard build for your role unless the work genuinely needs more.' },
      { id: 'lap-exception', type: 'textarea', label: 'Why does the standard build not work?', required: true,
        placeholder: 'Name the workload — video render times, simulator builds, the file sizes you open.',
        help: 'The 16" is $3,499 against $1,749. Your manager reads this before they approve.',
        showIf: { fieldId: 'lap-build', op: 'is', value: 'MacBook Pro 16" (M3 Max) — exception build' } },
      { id: 'lap-cost', type: 'currency', label: 'Cost to your cost centre (USD)', required: true,
        help: 'Latitude 7440 $1,749 · MacBook Pro 14" $2,649 · MacBook Pro 16" $3,499. This is the number the $500 threshold is read from, so it has to be on the form.' },
      { id: 'lap-replaces', type: 'checkbox', label: 'This replaces a machine I already have', required: false },
      { id: 'lap-old-asset', type: 'asset', label: 'Machine being replaced', required: true,
        help: 'It stays with you until the new one arrives, then goes back with the courier label in the box.',
        showIf: { fieldId: 'lap-replaces', op: 'is_true', value: true } },
      { id: 'lap-needed-by', type: 'date', label: 'Needed by', required: true,
        help: 'Five working days is the realistic minimum once approval is in.' },
      { id: 'lap-ship-to', type: 'select', label: 'Deliver to', required: true, options: SITES },
    ],
  },

  {
    id: SVCSF.MONITOR,
    raises: 'service_request',
    fulfils: { kind: 'hardware', modelId: MDL.U2723 },
    name: 'Order a monitor',
    description: 'A 27" UltraSharp for the office or for home.',
    audience: 'internal',
    routing: { queueId: Q.IT },
    approvalPolicyId: POL.SPEND_OVER_500,
    submitLabel: 'Order monitor',
    confirmation: 'Office orders are usually on your desk the next working day. Home orders ship from Bolingbrook within two.',
    ownerId: USR.EMMA,
    updatedAt: '2026-07-30T11:40:00',
    submissions30d: 47,
    enabled: true,
    fields: [
      { id: 'mon-qty', type: 'number', label: 'How many?', required: true, placeholder: '1',
        help: 'One is standard. Two is a conversation.' },
      { id: 'mon-why-two', type: 'textarea', label: 'What are you doing with more than one?', required: true,
        placeholder: 'e.g. running the ticket queue and a customer session side by side',
        showIf: { fieldId: 'mon-qty', op: 'gt', value: 1 } },
      { id: 'mon-cost', type: 'currency', label: 'Cost to your cost centre (USD)', required: true,
        help: '$579 for the UltraSharp U2723QE, so a single display already passes the $500 mark and goes to your manager.' },
      { id: 'mon-where', type: 'select', label: 'Where does it go?', required: true,
        options: ['My desk in the office', 'My home office', 'A hot-desk bank', 'A meeting room'] },
      { id: 'mon-site', type: 'select', label: 'Site', required: true, options: SITES },
      { id: 'mon-desk', type: 'text', label: 'Floor and desk number', required: false,
        placeholder: 'e.g. 4th floor, desk 12' },
      { id: 'mon-arm', type: 'checkbox', label: 'I need a monitor arm as well', required: false,
        help: 'Standard for anyone with a display-height note on their workstation assessment.' },
    ],
  },

  {
    id: SVCSF.HEADSET,
    raises: 'service_request',
    fulfils: null,
    name: 'Order a headset',
    description: 'Noise-cancelling USB headset, no approval needed.',
    audience: 'internal',
    routing: { queueId: Q.IT },
    submitLabel: 'Order headset',
    confirmation: 'On its way. Nothing to approve — it goes out with the next courier run.',
    ownerId: USR.EMMA,
    updatedAt: '2026-06-12T15:05:00',
    submissions30d: 29,
    enabled: true,
    fields: [
      { id: 'hs-style', type: 'select', label: 'Style', required: true,
        options: ['Over-ear, both ears', 'Over-ear, single ear', 'In-ear with a boom mic'] },
      { id: 'hs-connection', type: 'select', label: 'Connection', required: true,
        options: ['USB-C', 'USB-A', 'Bluetooth with a USB dongle'] },
      { id: 'hs-replacement', type: 'checkbox', label: 'My current headset is broken', required: false,
        help: 'Tick this and we will include a return label so the old one comes back for recycling.' },
      { id: 'hs-ship-to', type: 'select', label: 'Deliver to', required: true, options: SITES },
    ],
  },

  {
    id: SVCSF.PHONE,
    raises: 'service_request',
    fulfils: { kind: 'hardware', modelId: MDL.IPHONE15 },
    name: 'Order a company phone',
    description: 'An iPhone on a Verizon business line, for roles that need one.',
    audience: 'internal',
    routing: { queueId: Q.IT },
    approvalPolicyId: POL.SPEND_OVER_500,
    submitLabel: 'Order phone',
    confirmation: 'Once approved, IT activate the line and ship the handset. Set-up takes about ten minutes when it arrives.',
    ownerId: USR.EMMA,
    updatedAt: '2026-08-05T10:20:00',
    submissions30d: 8,
    enabled: true,
    fields: [
      { id: 'ph-reason', type: 'select', label: 'Why do you need a company handset?', required: true,
        options: ['On-call rota', 'Field sales or client visits', 'Leadership', 'Site or warehouse work', 'Something else'] },
      { id: 'ph-reason-other', type: 'textarea', label: 'Tell us more', required: true,
        placeholder: 'What does the role need that a personal phone with work mail cannot do?',
        showIf: { fieldId: 'ph-reason', op: 'is', value: 'Something else' } },
      { id: 'ph-cost', type: 'currency', label: 'Handset cost (USD)', required: true,
        help: '$1,099 for the iPhone 15 Pro. The $55 monthly line is billed separately and is not what the threshold reads.' },
      { id: 'ph-number', type: 'select', label: 'Phone number', required: true,
        options: ['New number', 'Port my existing work number'] },
      { id: 'ph-travel', type: 'checkbox', label: 'I travel internationally', required: false },
      { id: 'ph-countries', type: 'text', label: 'Which countries?', required: true,
        placeholder: 'e.g. Canada, Mexico, UK',
        help: 'Verizon add a roaming bundle per region — it is cheaper to set up before you travel than after.',
        showIf: { fieldId: 'ph-travel', op: 'is_true', value: true } },
      { id: 'ph-ship-to', type: 'select', label: 'Deliver to', required: true, options: SITES },
    ],
  },

  {
    id: SVCSF.LOANER,
    raises: 'service_request',
    fulfils: { kind: 'hardware', modelId: MDL.X1C11 },
    name: 'Borrow a loaner laptop',
    description: 'A temporary machine while yours is away, or for a short-term contractor.',
    audience: 'internal',
    routing: { queueId: Q.IT },
    submitLabel: 'Request a loaner',
    confirmation: 'Reserved from the Bolingbrook spare pool. Collect it from the IT bar, or tell us where to courier it.',
    ownerId: USR.EMMA,
    updatedAt: '2026-08-12T16:30:00',
    submissions30d: 14,
    enabled: true,
    fields: [
      { id: 'lo-reason', type: 'select', label: 'Why do you need one?', required: true,
        options: ['My machine is being repaired', 'My machine was lost or stolen', 'Short-term contractor', 'Travelling and cannot risk my own machine'] },
      { id: 'lo-until', type: 'date', label: 'Needed until', required: true,
        help: 'Loans run 30 days by default. We will chase you a week before this date.' },
      { id: 'lo-collect', type: 'select', label: 'How will you get it?', required: true,
        options: ['Collect from the IT bar', 'Courier to my home address', 'Internal mail to another site'] },
      { id: 'lo-address', type: 'textarea', label: 'Delivery address', required: true,
        placeholder: 'Street, city, ZIP — plus anything the courier needs to get past the gate',
        showIf: { fieldId: 'lo-collect', op: 'is', value: 'Courier to my home address' } },
      { id: 'lo-software', type: 'multiselect', label: 'Anything beyond the standard image?', required: false,
        options: ['Salesforce desktop', 'Jira', 'Adobe Reader', 'VPN profile', 'Nothing extra'] },
    ],
  },

  /* ---------------- Software & licences ---------------- */
  {
    id: SVCSF.SOFTWARE_LICENCE,
    raises: 'service_request',
    fulfils: null,
    name: 'Request a software licence',
    description: 'For anything outside the standard Microsoft 365 bundle.',
    audience: 'internal',
    routing: { queueId: Q.PROCUREMENT },
    approvalPolicyId: POL.SPEND_OVER_500,
    submitLabel: 'Request licence',
    confirmation: 'Procurement check the licence pool first. A spare seat is same-day; a new purchase comes back with a quote.',
    ownerId: USR.JAMES,
    updatedAt: '2026-08-14T10:50:00',
    submissions30d: 38,
    enabled: true,
    fields: [
      { id: 'sl-product', type: 'text', label: 'Vendor and product', required: true,
        placeholder: 'e.g. Tableau Creator, JetBrains All Products Pack',
        help: 'A link to their pricing page saves Procurement a search.' },
      { id: 'sl-seats', type: 'number', label: 'Seats', required: true, placeholder: '1' },
      { id: 'sl-cost', type: 'currency', label: 'Annual cost (USD)', required: true,
        help: 'Best estimate. Procurement replace it with the real quote.' },
      { id: 'sl-justification', type: 'textarea', label: 'Business justification', required: true,
        placeholder: 'What does this let the team do that the current tooling does not?',
        help: 'Appears once the annual cost passes $500, which is where manager approval kicks in.',
        showIf: { fieldId: 'sl-cost', op: 'gt', value: 500 } },
      { id: 'sl-data', type: 'select', label: 'Will it hold customer data?', required: true,
        options: ['No customer data', 'Customer data — anonymised', 'Customer data — identifiable', 'Not sure'],
        help: 'Anything identifiable goes through a security review before purchase.' },
      { id: 'sl-needed-by', type: 'date', label: 'Needed by', required: false },
    ],
  },

  {
    id: SVCSF.ADOBE_SEAT,
    raises: 'service_request',
    fulfils: { kind: 'software', licenceId: LIC.ADOBE_CC },
    name: 'Request an Adobe seat',
    description: 'A named Creative Cloud All Apps licence on the Northwind VIP agreement.',
    audience: 'internal',
    routing: { queueId: Q.PROCUREMENT },
    approvalPolicyId: POL.SPEND_OVER_500,
    submitLabel: 'Request seat',
    confirmation: 'Procurement will tell you whether a seat is free today or whether it waits for the 9 October renewal.',
    ownerId: USR.JAMES,
    updatedAt: '2026-08-08T13:00:00',
    submissions30d: 6,
    enabled: true,
    fields: [
      { id: 'ad-apps', type: 'multiselect', label: 'Which applications will you actually use?', required: true,
        options: ['Photoshop', 'Illustrator', 'InDesign', 'Premiere Pro', 'After Effects', 'Acrobat Pro'],
        help: 'If the answer is only Acrobat, a single-app licence is a quarter of the price.' },
      { id: 'ad-use', type: 'textarea', label: 'What are you producing?', required: true,
        placeholder: 'Campaign assets, product imagery, video edits…' },
      { id: 'ad-cost', type: 'currency', label: 'Annual cost (USD)', required: true,
        help: '$60 a month on the VIP agreement — $720 for a year, which is over the $500 threshold and goes to your manager.' },
      { id: 'ad-machine', type: 'asset', label: 'Machine it will be activated on', required: true,
        help: 'A named seat activates on two machines at once. Pick your primary.' },
      { id: 'ad-urgent', type: 'checkbox', label: 'I need it before the October renewal', required: false },
      { id: 'ad-deadline', type: 'date', label: 'What is the deadline driving that?', required: true,
        help: 'Buying a single seat mid-term costs list price, so Procurement need the reason.',
        showIf: { fieldId: 'ad-urgent', op: 'is_true', value: true } },
    ],
  },

  {
    id: SVCSF.FIGMA_SEAT,
    raises: 'service_request',
    fulfils: { kind: 'software', licenceId: LIC.FIGMA },
    name: 'Request a Figma editor seat',
    description: 'Editor access to the Northwind organisation.',
    audience: 'internal',
    routing: { queueId: Q.PROCUREMENT },
    approvalPolicyId: POL.SPEND_OVER_500,
    submitLabel: 'Request seat',
    confirmation: 'Seats are assigned by the design team. You will get an invite email from Figma once it is added.',
    ownerId: USR.JAMES,
    updatedAt: '2026-08-07T09:35:00',
    submissions30d: 11,
    enabled: true,
    fields: [
      { id: 'fg-need', type: 'select', label: 'What do you need to do?', required: true,
        options: ['Create and edit designs', 'Edit an existing file someone shared', 'Only view and comment'] },
      { id: 'fg-view-only', type: 'checkbox', label: 'I understand viewing and commenting is free and needs no seat', required: true,
        help: 'Shown because you picked view and comment — you can close this request and ask a designer to share the file.',
        showIf: { fieldId: 'fg-need', op: 'is', value: 'Only view and comment' } },
      { id: 'fg-team', type: 'select', label: 'Which team space?', required: true,
        options: ['Storefront product', 'Design system', 'Marketing and brand', 'Support enablement'] },
      { id: 'fg-cost', type: 'currency', label: 'Annual cost (USD)', required: true,
        help: '$45 a month — $540 for a year, so an editor seat crosses the $500 threshold.' },
      { id: 'fg-cost-centre', type: 'select', label: 'Cost centre for the monthly seat', required: true,
        options: ['Operations', 'IT', 'Support', 'Product', 'Sales', 'Marketing', 'People', 'Finance'] },
    ],
  },

  {
    id: SVCSF.VM_SANDBOX,
    raises: 'service_request',
    fulfils: { kind: 'software', licenceId: LIC.VMWARE },
    name: 'Request a sandbox VM',
    description: 'A throwaway virtual machine on the Elk Grove cluster.',
    audience: 'internal',
    routing: { queueId: Q.IT },
    submitLabel: 'Create sandbox',
    confirmation: 'You will get the hostname and credentials by email. It expires in 30 days unless you extend it.',
    ownerId: USR.PRIYA,
    updatedAt: '2026-08-15T14:10:00',
    submissions30d: 4,
    enabled: false,
    fields: [
      { id: 'vm-os', type: 'select', label: 'Operating system', required: true,
        options: ['Ubuntu 24.04 LTS', 'Rocky Linux 9', 'Windows Server 2022'] },
      { id: 'vm-size', type: 'select', label: 'Size', required: true,
        options: ['Small — 2 vCPU / 8 GB', 'Standard — 4 vCPU / 16 GB', 'Large — 8 vCPU / 32 GB'] },
      { id: 'vm-large-why', type: 'textarea', label: 'What needs the large size?', required: true,
        placeholder: 'The cluster has finite headroom — say what the workload is.',
        showIf: { fieldId: 'vm-size', op: 'is', value: 'Large — 8 vCPU / 32 GB' } },
      { id: 'vm-purpose', type: 'textarea', label: 'What is it for?', required: true,
        placeholder: 'Testing an upgrade, reproducing a customer issue, a spike…' },
      { id: 'vm-until', type: 'date', label: 'Delete it on', required: true,
        help: 'Maximum 30 days. Extend it later if the work is still live.' },
    ],
  },

  /* ---------------- Access & accounts ----------------
   * "Access to an application" has no intake here: it orders through
   * `SF.REQUEST_ACCESS` in forms.js, which is the same request with the same
   * fields and the policy already keyed to it. */
  {
    id: SVCSF.VPN_ACCESS,
    raises: 'service_request',
    fulfils: null,
    name: 'Request VPN access',
    description: 'Remote access to the internal network on your managed device.',
    audience: 'internal',
    routing: { queueId: Q.IT },
    submitLabel: 'Request VPN',
    confirmation: 'The profile is pushed to your laptop within a day. Sign in with SSO and approve the MFA prompt.',
    ownerId: USR.EMMA,
    updatedAt: '2026-07-18T12:15:00',
    submissions30d: 23,
    enabled: true,
    fields: [
      { id: 'vpn-need', type: 'multiselect', label: 'What do you need to reach?', required: true,
        options: ['Elk Grove servers', 'Internal admin interfaces', 'A database on the internal network', 'A file share', 'Not sure'],
        help: 'Microsoft 365, Salesforce and RelayHQ do not need VPN — they are reachable from anywhere.' },
      { id: 'vpn-asset', type: 'asset', label: 'Which device?', required: true,
        help: 'The profile only installs on a managed Northwind machine.' },
      { id: 'vpn-mfa', type: 'checkbox', label: 'I already have MFA set up on my phone', required: true,
        help: 'VPN sign-in always prompts for MFA. Set it up first or the connection will fail.' },
    ],
  },

  {
    id: SVCSF.SHARED_MAILBOX,
    raises: 'service_request',
    fulfils: { kind: 'software', licenceId: LIC.MS365_E3 },
    name: 'Shared mailbox request',
    description: 'Create a team mailbox, or get access to one that exists.',
    audience: 'internal',
    routing: { queueId: Q.IT },
    approvalPolicyId: POL.ACCESS_GRANT,
    submitLabel: 'Submit request',
    confirmation: 'The mailbox owner approves access. New mailboxes are usually live the next working day.',
    ownerId: USR.EMMA,
    updatedAt: '2026-06-28T10:05:00',
    submissions30d: 13,
    enabled: true,
    fields: [
      { id: 'sm-what', type: 'select', label: 'What do you need?', required: true,
        options: ['Access to an existing mailbox', 'Create a new shared mailbox', 'Remove someone from a mailbox'] },
      { id: 'sm-address', type: 'email', label: 'Mailbox address', required: true,
        placeholder: 'invoices@northwind.example',
        showIf: { fieldId: 'sm-what', op: 'is_not', value: 'Create a new shared mailbox' } },
      { id: 'sm-new-name', type: 'text', label: 'Name for the new mailbox', required: true,
        placeholder: 'e.g. austin-escalations',
        help: 'Lowercase and hyphenated. We append @northwind.example.',
        showIf: { fieldId: 'sm-what', op: 'is', value: 'Create a new shared mailbox' } },
      { id: 'sm-owner', type: 'user', label: 'Mailbox owner', required: true,
        help: 'The person who approves future members without a new request.' },
      { id: 'sm-people', type: 'user', label: 'People to add or remove', required: false },
      { id: 'sm-send-as', type: 'checkbox', label: 'Members need to send as the mailbox, not just read it', required: false },
    ],
  },

  {
    id: SVCSF.ELEVATED_ACCESS,
    raises: 'service_request',
    fulfils: null,
    name: 'Request elevated access',
    description: 'Time-boxed admin rights for a specific piece of work.',
    audience: 'internal',
    routing: { queueId: Q.IT },
    approvalPolicyId: POL.ACCESS_GRANT,
    submitLabel: 'Request elevation',
    confirmation: 'The system owner and your manager both approve. The grant drops automatically when the window closes.',
    ownerId: USR.EMMA,
    updatedAt: '2026-08-15T11:25:00',
    submissions30d: 18,
    enabled: true,
    fields: [
      { id: 'ea-target', type: 'select', label: 'Elevate where?', required: true,
        options: ['Local admin on my own machine', 'Production database', 'AWS production account', 'RelayHQ Admin', 'Storefront production console'] },
      { id: 'ea-window', type: 'select', label: 'How long do you need it?', required: true,
        options: ['One hour', 'Eight hours — one shift', 'Longer than one shift'] },
      { id: 'ea-reference', type: 'text', label: 'Change or incident reference', required: true,
        placeholder: 'e.g. CHG-2026-0412 or INC-2026-1183',
        help: 'Anything beyond a single shift has to hang off approved work.',
        showIf: { fieldId: 'ea-window', op: 'is', value: 'Longer than one shift' } },
      { id: 'ea-task', type: 'textarea', label: 'What will you do with it?', required: true,
        placeholder: 'The specific commands, migration or configuration change.' },
      { id: 'ea-logged', type: 'checkbox', label: 'I understand the session is recorded and reviewed', required: true },
    ],
  },

  /* ---------------- People & onboarding ----------------
   * Joining and leaving order through `SF.NEW_HIRE` and `SF.OFFBOARDING` in
   * forms.js. Those intakes exist, People Ops owns them, and the onboarding and
   * offboarding policies are keyed to them — a second copy here would be the
   * same request asked twice and approved never. Only the internal move, which
   * forms.js has no intake for, is authored below. */
  {
    id: SVCSF.ROLE_CHANGE,
    raises: 'service_request',
    fulfils: null,
    name: 'Role or team change',
    description: 'Rebase someone onto a new manager, team or site.',
    audience: 'internal',
    routing: { queueId: Q.PEOPLE },
    approvalPolicyId: POL.ACCESS_GRANT,
    submitLabel: 'Submit change',
    confirmation: 'People Ops update the record on the effective date. Old access is removed the same evening.',
    ownerId: USR.PATTI,
    updatedAt: '2026-07-24T09:50:00',
    submissions30d: 4,
    enabled: true,
    fields: [
      { id: 'rc-person', type: 'user', label: 'Who is moving?', required: true },
      { id: 'rc-effective', type: 'date', label: 'Effective date', required: true },
      { id: 'rc-new-function', type: 'select', label: 'New job function', required: true,
        options: ['Support Agent', 'IT Support', 'Procurement', 'People Ops', 'Facilities', 'Finance', 'Product', 'Sales', 'Marketing'] },
      { id: 'rc-new-manager', type: 'user', label: 'New manager', required: true },
      { id: 'rc-site-change', type: 'checkbox', label: 'They are also changing site', required: false },
      { id: 'rc-new-site', type: 'select', label: 'New site', required: true, options: SITES,
        showIf: { fieldId: 'rc-site-change', op: 'is_true', value: true } },
      { id: 'rc-keep', type: 'textarea', label: 'Any access they should keep from the old role?', required: false,
        placeholder: 'Name it and say why — everything else in the old bundle is removed.' },
    ],
  },

  /* ---------------- Workplace & facilities ---------------- */
  {
    id: SVCSF.DESK_MOVE,
    raises: 'service_request',
    fulfils: null,
    name: 'Book a desk move',
    description: 'Move a desk, a monitor and a phone extension.',
    audience: 'internal',
    routing: { queueId: Q.FACILITIES },
    submitLabel: 'Book the move',
    confirmation: 'Moves run Tuesday and Thursday evenings. Your desk will be ready when you arrive the next morning.',
    ownerId: USR.LINDA,
    updatedAt: '2026-07-21T08:10:00',
    submissions30d: 16,
    enabled: true,
    fields: [
      { id: 'dm-site', type: 'select', label: 'Site', required: true, options: SITES },
      { id: 'dm-from', type: 'text', label: 'Moving from', required: true,
        placeholder: 'e.g. 4th floor, desk 12' },
      { id: 'dm-to', type: 'text', label: 'Moving to', required: true,
        placeholder: 'e.g. 3rd floor, desk 41' },
      { id: 'dm-when', type: 'date', label: 'Preferred date', required: true,
        help: 'Three working days out. Facilities will confirm the evening slot.' },
      { id: 'dm-items', type: 'multiselect', label: 'What moves with you?', required: false,
        options: ['Monitor', 'Docking station', 'Phone extension', 'Pedestal drawers', 'Standing desk'] },
    ],
  },

  {
    id: SVCSF.MEETING_KIT,
    raises: 'service_request',
    fulfils: null,
    name: 'Fit out a meeting room',
    description: 'Display, camera, microphones and a room account for hybrid meetings.',
    audience: 'internal',
    routing: { queueId: Q.FACILITIES },
    approvalPolicyId: POL.SPEND_OVER_5000,
    submitLabel: 'Request the fit-out',
    confirmation: 'Three approvals then the AV contractor is booked. Plan on four weeks from today.',
    ownerId: USR.LINDA,
    updatedAt: '2026-08-04T14:45:00',
    submissions30d: 2,
    enabled: true,
    fields: [
      { id: 'mk-site', type: 'select', label: 'Site', required: true, options: SITES },
      { id: 'mk-room', type: 'text', label: 'Room name', required: true,
        placeholder: 'e.g. Ravinia, 4th floor' },
      { id: 'mk-size', type: 'select', label: 'Room size', required: true,
        options: ['Huddle — up to 4', 'Standard — up to 8', 'Board room — 12 or more'] },
      { id: 'mk-board-detail', type: 'textarea', label: 'What is the room used for?', required: true,
        placeholder: 'Board meetings, customer sessions, all-hands broadcasts…',
        help: 'A board room build needs ceiling microphones and a second display, which is where the cost sits.',
        showIf: { fieldId: 'mk-size', op: 'is', value: 'Board room — 12 or more' } },
      { id: 'mk-cost', type: 'currency', label: 'Estimated cost (USD)', required: true,
        help: 'About $5,400 for a standard room and more for a board room. Anything at $5,000 or above runs the three-stage chain — manager, Finance, skip-level.' },
      { id: 'mk-cost-centre', type: 'select', label: 'Cost centre', required: true,
        options: ['Operations', 'IT', 'Support', 'Product', 'Sales', 'Marketing', 'People', 'Finance'] },
      { id: 'mk-needed-by', type: 'date', label: 'Needed by', required: false,
        help: 'Tell us if this is tied to a date — an all-hands, a customer visit, an office opening.' },
    ],
  },

  {
    id: SVCSF.BUILDING_ACCESS,
    raises: 'service_request',
    fulfils: null,
    name: 'Request building access',
    description: 'A badge for another site, a restricted area, or out-of-hours access.',
    audience: 'internal',
    routing: { queueId: Q.FACILITIES },
    approvalPolicyId: POL.ACCESS_GRANT,
    submitLabel: 'Request access',
    confirmation: 'The site lead approves. Elk Grove takes two days because the colocation provider issues those badges.',
    ownerId: USR.LINDA,
    updatedAt: '2026-08-02T13:20:00',
    submissions30d: 11,
    enabled: true,
    fields: [
      { id: 'ba-site', type: 'select', label: 'Which site?', required: true, options: SITES },
      { id: 'ba-area', type: 'select', label: 'Area', required: true,
        options: ['General office floors', 'Warehouse floor', 'Elk Grove cage 14B', 'Comms room', 'Loading dock'] },
      { id: 'ba-when', type: 'select', label: 'When do you need to get in?', required: true,
        options: ['Business hours only', 'Evenings and weekends too', '24/7'] },
      { id: 'ba-outofhours', type: 'textarea', label: 'Why out of hours?', required: true,
        placeholder: 'Maintenance windows, weekend releases, a shift pattern…',
        help: 'The site lead has to know who could be in the building at 22:00 on a Sunday.',
        showIf: { fieldId: 'ba-when', op: 'is_not', value: 'Business hours only' } },
      { id: 'ba-until', type: 'date', label: 'Access needed until', required: false,
        help: 'Leave blank if this is part of your permanent role.' },
    ],
  },

  /* ---------------- Customer services — external ---------------- */
  {
    id: SVCSF.EXTRA_SEATS,
    raises: 'service_request',
    fulfils: null,
    name: 'Add Storefront seats',
    description: 'More admin users on your account, prorated to the current billing period.',
    audience: 'external',
    routing: { queueId: Q.SUPPORT },
    submitLabel: 'Add seats',
    confirmation: 'Seats are added within a business day and appear prorated on your next invoice.',
    ownerId: USR.LISA,
    updatedAt: '2026-08-15T09:05:00',
    submissions30d: 34,
    enabled: true,
    fields: [
      { id: 'es-qty', type: 'number', label: 'How many seats?', required: true, placeholder: '1',
        help: '$29 per seat per month, prorated from the day they are added.' },
      { id: 'es-justification', type: 'textarea', label: 'What are the new seats for?', required: true,
        placeholder: 'Which team, and what they will be doing in Storefront.',
        help: 'More than five seats at once usually means a plan change would be cheaper — telling us why lets us check.',
        showIf: { fieldId: 'es-qty', op: 'gt', value: 5 } },
      { id: 'es-people', type: 'textarea', label: 'Who are they?', required: false,
        placeholder: 'One name and email per line. Leave blank and we will send you invite links instead.' },
      { id: 'es-role', type: 'select', label: 'What role should they get?', required: true,
        options: ['Full admin', 'Catalog and inventory only', 'Orders and fulfilment only', 'Reporting only'] },
      { id: 'es-billing-contact', type: 'email', label: 'Billing contact to copy', required: false,
        placeholder: 'accounts@yourcompany.example' },
    ],
  },

  {
    id: SVCSF.SANDBOX_TENANT,
    raises: 'service_request',
    fulfils: null,
    name: 'Request a sandbox tenant',
    description: 'A free copy of your account to build and test against.',
    audience: 'external',
    routing: { queueId: Q.SUPPORT },
    submitLabel: 'Create sandbox',
    confirmation: 'You will get the sandbox URL and a fresh set of API keys by email within two business days.',
    ownerId: USR.LISA,
    updatedAt: '2026-08-15T16:20:00',
    submissions30d: 0,
    enabled: false,
    fields: [
      { id: 'st-purpose', type: 'select', label: 'What will you use it for?', required: true,
        options: ['Building an integration', 'Testing an upgrade', 'Training our team', 'Evaluating a new feature'] },
      { id: 'st-copy-catalog', type: 'checkbox', label: 'Copy our live catalog into it', required: false,
        help: 'Products and inventory levels are copied. Customers and real orders never are.' },
      { id: 'st-catalog-size', type: 'select', label: 'Roughly how many products?', required: true,
        options: ['Under 500', '500 to 5,000', 'More than 5,000'],
        help: 'Large catalogs take longer to seed, so we schedule those overnight.',
        showIf: { fieldId: 'st-copy-catalog', op: 'is_true', value: true } },
      { id: 'st-contact', type: 'email', label: 'Who should the keys go to?', required: true,
        placeholder: 'dev@yourcompany.example' },
    ],
  },

  {
    id: SVCSF.PREMIUM_SUPPORT,
    raises: 'service_request',
    fulfils: null,
    name: 'Upgrade to premium support',
    description: 'Enterprise service level with a named engineer and 24/7 cover.',
    audience: 'external',
    routing: { queueId: Q.SUPPORT },
    submitLabel: 'Request upgrade',
    confirmation: 'Your account manager will confirm the start date. Cover begins at the next billing period.',
    ownerId: USR.LISA,
    updatedAt: '2026-08-11T10:30:00',
    submissions30d: 6,
    enabled: true,
    fields: [
      { id: 'ps-driver', type: 'select', label: 'What is driving the upgrade?', required: true,
        options: ['We trade at weekends', 'Peak season is coming', 'A recent incident took too long', 'A compliance or contractual requirement'] },
      { id: 'ps-incident', type: 'text', label: 'Which ticket was that?', required: true,
        placeholder: 'e.g. TKT-2026-4471',
        help: 'We review what happened before the upgrade starts, not after.',
        showIf: { fieldId: 'ps-driver', op: 'is', value: 'A recent incident took too long' } },
      { id: 'ps-hours', type: 'multiselect', label: 'When do you need cover?', required: true,
        options: ['Weekday evenings', 'Saturdays', 'Sundays', 'US public holidays'] },
      { id: 'ps-contacts', type: 'textarea', label: 'Who can raise urgent tickets?', required: true,
        placeholder: 'Name, email and phone for each — one per line. These are the people we will call back.' },
      { id: 'ps-start', type: 'date', label: 'Preferred start date', required: false },
    ],
  },

  {
    id: SVCSF.ONBOARDING_HELP,
    raises: 'service_request',
    fulfils: null,
    name: 'Book guided implementation',
    description: 'Two weeks of hands-on help getting Storefront live.',
    audience: 'external',
    routing: { queueId: Q.SUPPORT },
    submitLabel: 'Book implementation',
    confirmation: 'An implementation specialist will email within two business days to agree the two-week window.',
    ownerId: USR.LISA,
    updatedAt: '2026-08-09T15:40:00',
    submissions30d: 9,
    enabled: true,
    fields: [
      { id: 'oi-golive', type: 'date', label: 'Target go-live date', required: true,
        help: 'Give us three weeks before this date if you can — two of implementation and one of rehearsal.' },
      { id: 'oi-scope', type: 'multiselect', label: 'What do you need help with?', required: true,
        options: ['Catalog import', 'Payment gateway', 'Shipping rates', 'DNS and domain', 'Data migration from another platform', 'Staff training'] },
      { id: 'oi-platform', type: 'text', label: 'What are you migrating from?', required: true,
        placeholder: 'e.g. Shopify, Magento, a custom build',
        help: 'Migration is the part that most often moves the go-live date, so we scope it first.',
        showIf: { fieldId: 'oi-scope', op: 'includes', value: 'Data migration from another platform' } },
      { id: 'oi-skus', type: 'number', label: 'How many products?', required: true, placeholder: '250' },
      { id: 'oi-lead', type: 'email', label: 'Project lead on your side', required: true,
        placeholder: 'name@yourcompany.example',
        help: 'One person who can make decisions during the two weeks. It matters more than any other answer here.' },
      { id: 'oi-notes', type: 'textarea', label: 'Anything else we should know?', required: false,
        placeholder: 'Trading calendar, freeze periods, an agency already involved…' },
    ],
  },
];
