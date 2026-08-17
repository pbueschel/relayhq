/**
 * Canonical seed ids — the cross-module contract.
 *
 * Domains are authored in separate files, but they reference each other: the
 * catalog points at knowledge atoms, subforms point at queues, courses point at
 * lessons, assets point at locations. If each author invented ids the
 * references would dangle and `test/smoke.js` would fail on referential
 * integrity.
 *
 * So every id that crosses a domain boundary is declared HERE and imported by
 * both sides. A domain's private ids (a field inside a subform, a slide inside
 * a guide) do not need to be listed.
 *
 * Rule: never write a cross-domain id as a string literal in a seed file.
 * Import it from here.
 */

/* ------------------------------------------------------------------ *
 * Queues — routing destinations. `GENERAL` is the catch-all and must exist;
 * unrouted tickets fall to it, and that fallback is surfaced, never silent.
 * ------------------------------------------------------------------ */
export const Q = {
  GENERAL:     'queue-general',
  IT:          'queue-it',
  SUPPORT:     'queue-support',      // external customer support
  PROCUREMENT: 'queue-procurement',
  PEOPLE:      'queue-people',
  FACILITIES:  'queue-facilities',
  FINANCE:     'queue-finance',
  ENGINEERING: 'queue-engineering',
};

/* ------------------------------------------------------------------ *
 * Locations — a hierarchy: region > site. Assets and people both point here.
 * ------------------------------------------------------------------ */
export const LOC = {
  CHI:    'loc-chi',      // Chicago HQ
  NYC:    'loc-nyc',      // New York office
  AUS:    'loc-aus',      // Austin support centre
  DC1:    'loc-dc1',      // Elk Grove data centre
  WAREHOUSE: 'loc-wh',    // Bolingbrook warehouse
  REMOTE: 'loc-remote',   // Remote / home office
};

/* ------------------------------------------------------------------ *
 * Knowledge atoms.
 *
 * These are the single most reused ids in the product. Each one is referenced
 * by (a) a catalog item, so it deflects, (b) sometimes a course module, so it
 * teaches, and (c) sometimes an agent-facing panel. THAT REUSE IS THE PRODUCT
 * THESIS — a lesson id appearing in both CATALOG and COURSES is correct and
 * deliberate, not duplication.
 *
 * Naming: kb-<topic>. Guides (Stories-format) are marked in the comment.
 * ------------------------------------------------------------------ */
export const KB = {
  // Account & access
  RESET_PASSWORD:      'kb-reset-password',        // guide
  MFA_SETUP:           'kb-mfa-setup',             // guide
  ACCOUNT_LOCKED:      'kb-account-locked',        // article
  SSO_EXPLAINED:       'kb-sso-explained',         // article

  // Email
  EMAIL_ON_PHONE:      'kb-email-on-phone',        // guide
  EMAIL_SIGNATURE:     'kb-email-signature',       // guide
  SPAM_QUARANTINE:     'kb-spam-quarantine',       // article

  // Hardware
  LAPTOP_SETUP:        'kb-laptop-setup',          // guide
  SCREEN_FLICKER:      'kb-screen-flicker',        // article
  REQUEST_MONITOR:     'kb-request-monitor',       // article
  RETURN_EQUIPMENT:    'kb-return-equipment',      // guide

  // Software & licensing
  INSTALL_SOFTWARE:    'kb-install-software',      // guide
  LICENSE_POLICY:      'kb-license-policy',        // article
  ADOBE_ACTIVATION:    'kb-adobe-activation',      // article

  // Customer-facing product help (external mode)
  STOREFRONT_SETUP:    'kb-storefront-setup',      // guide
  IMPORT_CATALOG:      'kb-import-catalog',        // guide
  CONNECT_PAYMENTS:    'kb-connect-payments',      // guide
  INVOICE_QUESTIONS:   'kb-invoice-questions',     // article
  API_KEYS:            'kb-api-keys',              // article
  WEBHOOK_SETUP:       'kb-webhook-setup',         // guide

  // Agent enablement — these are the atoms that shine as lessons
  TRIAGE_BASICS:       'kb-triage-basics',         // article
  WRITING_TO_CUSTOMERS:'kb-writing-to-customers',  // article
  ESCALATION_PATHS:    'kb-escalation-paths',      // article
  USING_MACROS:        'kb-using-macros',          // guide
  READING_A_TICKET:    'kb-reading-a-ticket',      // guide
  SLA_EXPLAINED:       'kb-sla-explained',         // article
  HANDLING_ANGRY:      'kb-handling-angry',        // article
  CLOSING_WELL:        'kb-closing-well',          // article

  // Process / policy
  CHANGE_PROCESS:      'kb-change-process',        // article
  APPROVAL_THRESHOLDS: 'kb-approval-thresholds',   // article
  ONBOARDING_CHECKLIST:'kb-onboarding-checklist',  // guide
};

/* ------------------------------------------------------------------ *
 * Subforms — request intakes attached to catalog items.
 * Multiple per item is the point: "report a problem" and "request access" are
 * different intakes on the same item routing to different queues.
 * ------------------------------------------------------------------ */
export const SF = {
  REPORT_SIGNIN:      'sf-report-signin',
  REQUEST_ACCESS:     'sf-request-access',
  MFA_RESET:          'sf-mfa-reset',
  EMAIL_PROBLEM:      'sf-email-problem',
  DISTRIBUTION_LIST:  'sf-distribution-list',
  LAPTOP_REPAIR:      'sf-laptop-repair',
  NEW_HARDWARE:       'sf-new-hardware',
  RETURN_HARDWARE:    'sf-return-hardware',
  SOFTWARE_REQUEST:   'sf-software-request',
  LICENSE_RENEWAL:    'sf-license-renewal',
  NEW_HIRE:           'sf-new-hire',
  OFFBOARDING:        'sf-offboarding',
  EXPENSE_APPROVAL:   'sf-expense-approval',
  FACILITIES_ISSUE:   'sf-facilities-issue',
  // external customer intakes
  STOREFRONT_BUG:     'sf-storefront-bug',
  BILLING_QUESTION:   'sf-billing-question',
  FEATURE_REQUEST:    'sf-feature-request',
  INTEGRATION_HELP:   'sf-integration-help',
};

/* ------------------------------------------------------------------ *
 * Catalog nodes. Only ids referenced from outside the catalog are listed —
 * assets link to items, and forms scope to products.
 * ------------------------------------------------------------------ */
export const CAT = {
  // products
  P_ACCOUNTS:   'cat-p-accounts',
  P_EMAIL:      'cat-p-email',
  P_DEVICES:    'cat-p-devices',
  P_SOFTWARE:   'cat-p-software',
  P_WORKPLACE:  'cat-p-workplace',
  P_STOREFRONT: 'cat-p-storefront',   // the external product customers buy
  // items commonly linked to
  I_CANNOT_SIGN_IN: 'cat-i-cannot-sign-in',
  I_MFA:            'cat-i-mfa',
  I_LAPTOP_ISSUE:   'cat-i-laptop-issue',
  I_NEW_LAPTOP:     'cat-i-new-laptop',
  I_SOFTWARE_REQ:   'cat-i-software-req',
  I_STOREFRONT_SETUP:'cat-i-storefront-setup',
  I_PAYMENTS:       'cat-i-payments',
  I_BILLING:        'cat-i-billing',
};

/* ------------------------------------------------------------------ *
 * The SERVICE CATALOG — orderable things, as opposed to the help tree.
 *
 * "Cannot sign in" belongs to Get Help; "Request a new laptop" belongs here.
 * A service item's request form is an ordinary subform, so these ids point at
 * SF entries rather than introducing a second form model.
 * ------------------------------------------------------------------ */
export const SVCCAT = {
  HARDWARE:  'svc-cat-hardware',
  SOFTWARE:  'svc-cat-software',
  ACCESS:    'svc-cat-access',
  PEOPLE:    'svc-cat-people',
  WORKPLACE: 'svc-cat-workplace',
  CUSTOMER:  'svc-cat-customer',   // external — things a customer can order
};

export const SVC = {
  // hardware
  NEW_LAPTOP:      'svc-new-laptop',
  MONITOR:         'svc-monitor',
  HEADSET:         'svc-headset',
  PHONE:           'svc-phone',
  LOANER:          'svc-loaner',
  // software
  SOFTWARE_LICENCE:'svc-software-licence',
  ADOBE_SEAT:      'svc-adobe-seat',
  FIGMA_SEAT:      'svc-figma-seat',
  VM_SANDBOX:      'svc-vm-sandbox',
  // access
  APP_ACCESS:      'svc-app-access',
  VPN_ACCESS:      'svc-vpn-access',
  SHARED_MAILBOX:  'svc-shared-mailbox',
  ELEVATED_ACCESS: 'svc-elevated-access',
  // people
  ONBOARD_HIRE:    'svc-onboard-hire',
  OFFBOARD:        'svc-offboard',
  ROLE_CHANGE:     'svc-role-change',
  // workplace
  DESK_MOVE:       'svc-desk-move',
  MEETING_KIT:     'svc-meeting-kit',
  BUILDING_ACCESS: 'svc-building-access',
  // external / customer-orderable
  EXTRA_SEATS:     'svc-extra-seats',
  SANDBOX_TENANT:  'svc-sandbox-tenant',
  PREMIUM_SUPPORT: 'svc-premium-support',
  ONBOARDING_HELP: 'svc-onboarding-help',
};

/* ------------------------------------------------------------------ *
 * Approval policies — shared by subforms, changes and the rules engine.
 * ------------------------------------------------------------------ */
export const POL = {
  SPEND_OVER_500:    'pol-spend-500',
  SPEND_OVER_5000:   'pol-spend-5000',
  ACCESS_GRANT:      'pol-access-grant',
  NEW_HIRE:          'pol-new-hire',
  NORMAL_CHANGE:     'pol-normal-change',
  EMERGENCY_CHANGE:  'pol-emergency-change',
  OFFBOARDING:       'pol-offboarding',
};

/* ------------------------------------------------------------------ *
 * SLA policies.
 * ------------------------------------------------------------------ */
export const SLA = {
  ENTERPRISE: 'sla-enterprise',
  BUSINESS:   'sla-business',
  STARTER:    'sla-starter',
  INTERNAL:   'sla-internal',
};

/* ------------------------------------------------------------------ *
 * Courses and curricula. Courses reference KB ids as their lessons.
 * ------------------------------------------------------------------ */
export const CRS = {
  SUPPORT_FOUNDATIONS: 'crs-support-foundations',
  SUPPORT_TOOLING:     'crs-support-tooling',
  SUPPORT_COMMS:       'crs-support-comms',
  SUPPORT_ESCALATION:  'crs-support-escalation',
  IT_ENDPOINTS:        'crs-it-endpoints',
  IT_ACCESS:           'crs-it-access',
  CHANGE_MANAGEMENT:   'crs-change-management',
  CUSTOMER_ONBOARDING: 'crs-customer-onboarding',   // external academy
  CUSTOMER_ADMIN:      'crs-customer-admin',        // external academy
};

export const CUR = {
  SUPPORT_AGENT: 'cur-support-agent',   // "teach a job function completely"
  IT_SUPPORT:    'cur-it-support',
  CUSTOMER_ADMIN:'cur-customer-admin',  // external, for customers' admins
};

/* ------------------------------------------------------------------ *
 * Projects — tasks reference these.
 * ------------------------------------------------------------------ */
export const PRJ = {
  CRM_MIGRATION:  'prj-crm-migration',
  MOBILE_RELEASE: 'prj-mobile-release',
  OFFICE_MOVE:    'prj-office-move',
  ACADEMY_LAUNCH: 'prj-academy-launch',
};

/* ------------------------------------------------------------------ *
 * Automations.
 * ------------------------------------------------------------------ */
export const AUTO = {
  TRIAGE:        'auto-triage',
  ONBOARDING:    'auto-onboarding',
  RENEWAL_ALERT: 'auto-renewal-alert',
  CSAT_FOLLOWUP: 'auto-csat-followup',
  BREACH_ESCALATE:'auto-breach-escalate',
};

/* People ids are declared in people.js; re-exported here so seed authors have
 * one import for every cross-domain id. */
export const USR = {
  ADMIN:  'usr-admin',   // Alex Rivera
  EMMA:   'usr-emma',    // IT Manager
  JAMES:  'usr-james',   // Procurement
  PATTI:  'usr-patti',   // HR Director
  MIKE:   'usr-mike',
  LISA:   'usr-lisa',    // Support Team Lead
  DEVON:  'usr-devon',   // Support Agent
  NADIA:  'usr-nadia',   // Support Agent
  SAM:    'usr-sam',     // Support Agent (new hire — the learner in the demo)
  MICHAEL:'usr-michael', // Finance
  LINDA:  'usr-linda',   // Facilities
  ROBERT: 'usr-robert',
  DAVID:  'usr-david',
  JEN:    'usr-jen',
  SARAH:  'usr-sarah',
  TOM:    'usr-tom',
  PRIYA:  'usr-priya',
};

export const ORG = {
  LUMEN:     'org-lumen',
  PARKWAY:   'org-parkway',
  VIREO:     'org-vireo',
  FERNBROOK: 'org-fernbrook',
};

export const CON = {
  DANA:  'con-1',
  RAVI:  'con-2',
  BEA:   'con-3',
  OWEN:  'con-4',
  MEI:   'con-5',
  COLE:  'con-6',
};
