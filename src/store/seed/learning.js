/**
 * Learning seed — curricula, courses and enrollments.
 *
 * ============================================================================
 * THE POINT OF THIS FILE
 * ============================================================================
 * There is not one lesson body in here. Every lesson is a REFERENCE to a
 * knowledge atom id from `knowledge.js` — the same atom that the help centre
 * publishes and the agent workspace surfaces next to a ticket. A course is an
 * ORDERING and a FRAME around atoms somebody already wrote:
 *
 *     Curriculum  >  Course  >  Module  >  Lesson (= a knowledge atom id)
 *
 * Two consequences you can see in the data:
 *
 *   1. The Support Agent courses use the agent-enablement atoms (triage,
 *      reading a ticket, macros, SLAs, escalation, writing, angry customers,
 *      closing) AND the customer-facing product atoms (storefront setup,
 *      payments, API keys, invoices). An agent has to know the product the
 *      customer is asking about, and that atom is already written — for the
 *      customer. Reuse is the intended path, not a shortcut.
 *
 *   2. `crs-customer-onboarding` is an EXTERNAL academy course that appears in
 *      an INTERNAL curriculum. Agents take the same course the customer took.
 *      The Learning view calls this out with a banner rather than letting it
 *      look like a mistake.
 *
 * Estimated time is never stored on a course. It is summed from the lessons'
 * `minutes`, so re-ordering or adding a lesson cannot leave a stale number.
 *
 * Demo company: Northwind Systems. Demo clock: 2026-08-16.
 */

import { KB, CRS, CUR, USR, CON } from './ids.js';
import { JOB_FUNCTIONS } from './people.js';

/**
 * Job-function ids are declared in people.js (JOB_FUNCTIONS), not in ids.js.
 * Resolving them through the roster means a rename there fails loudly at import
 * instead of leaving a curriculum pointing at a job function nobody holds.
 */
function jobFunction(id) {
  const found = JOB_FUNCTIONS.find(j => j.id === id);
  if (!found) throw new Error(`learning seed: unknown job function "${id}"`);
  return found.id;
}

const JF = {
  SUPPORT_AGENT: jobFunction('support-agent'),
  IT_SUPPORT: jobFunction('it-support'),
  SERVICE_OPS: jobFunction('service-ops'),
  CUSTOMER: jobFunction('customer'),
};

/* ==================================================================== *
 * COURSES
 *
 * `modules[].lessonIds` are knowledge atom ids — never copies.
 * `lessonPrereqs` gates one lesson behind another WITHIN a course.
 * `modules[].quiz` is the course's own assessment, distinct from the atom's
 * built-in `check`, which the player surfaces at the end of each lesson.
 * ==================================================================== */

export const COURSES = [
  /* ---------------------------------------------------------------- *
   * Support Agent track — the flagship
   * ---------------------------------------------------------------- */
  {
    id: CRS.SUPPORT_FOUNDATIONS,
    title: 'Support Foundations: your first week on the queue',
    summary:
      'What a ticket is, how it reaches you, what the clock is measuring and what the product actually does. Finish this before you answer a customer unsupervised.',
    audience: 'internal',
    jobFunction: JF.SUPPORT_AGENT,
    status: 'published',
    ownerId: USR.LISA,
    version: '3.2',
    updatedAt: '2026-08-10T15:20:00Z',
    sequencing: 'linear',
    passingScore: 80,
    certificate: false,
    lessonPrereqs: {
      [KB.TRIAGE_BASICS]: [KB.READING_A_TICKET],
      [KB.CONNECT_PAYMENTS]: [KB.STOREFRONT_SETUP],
    },
    modules: [
      {
        id: 'mod-sf-intake',
        title: 'How work reaches you',
        summary: 'Reading the record before you touch it, then deciding where it goes in four minutes.',
        lessonIds: [KB.READING_A_TICKET, KB.TRIAGE_BASICS],
        quiz: {
          id: 'quiz-sf-intake',
          title: 'Intake check',
          passingScore: 80,
          questions: [
            {
              id: 'q-sfi-1', type: 'single',
              prompt: 'A ticket arrives with no category and a one-line body: "it is broken". What is the first move?',
              options: [
                { id: 'o1', label: 'Close it as insufficient information', correct: false },
                { id: 'o2', label: 'Read the requester record and recent history before replying', correct: true },
                { id: 'o3', label: 'Escalate to engineering', correct: false },
              ],
              explanation: 'Most "it is broken" tickets are already explained by the requester\'s last three tickets or their organisation\'s open incidents.',
            },
            {
              id: 'q-sfi-2', type: 'multi',
              prompt: 'Which of these belong in the first four minutes of triage?',
              options: [
                { id: 'o1', label: 'Confirm who the requester is and what plan they are on', correct: true },
                { id: 'o2', label: 'Set a priority you can defend', correct: true },
                { id: 'o3', label: 'Write the full solution', correct: false },
                { id: 'o4', label: 'Check whether it is already a known problem', correct: true },
              ],
              explanation: 'Triage is routing and expectation-setting. Solving comes after the record is pointed at the right person.',
            },
            {
              id: 'q-sfi-3', type: 'boolean',
              prompt: 'An unrouted ticket disappears until someone claims it.',
              options: [
                { id: 'o1', label: 'True', correct: false },
                { id: 'o2', label: 'False', correct: true },
              ],
              explanation: 'Unrouted tickets fall to the General queue. Nothing is ever silently parked.',
            },
          ],
        },
      },
      {
        id: 'mod-sf-clock',
        title: 'The clock everyone is watching',
        summary: 'What first response, next response and resolution targets actually measure, and what pauses them.',
        lessonIds: [KB.SLA_EXPLAINED],
        quiz: null,
      },
      {
        id: 'mod-sf-product',
        title: 'The product you are supporting',
        summary:
          'The same two guides Northwind publishes to customers. If you have not stood up a storefront yourself you cannot triage a storefront question.',
        lessonIds: [KB.STOREFRONT_SETUP, KB.CONNECT_PAYMENTS],
        quiz: {
          id: 'quiz-sf-product',
          title: 'Product check',
          passingScore: 80,
          questions: [
            {
              id: 'q-sfp-1', type: 'single',
              prompt: 'A customer four days live asks where their first payout is. What do you tell them?',
              options: [
                { id: 'o1', label: 'Northwind is holding it pending review', correct: false },
                { id: 'o2', label: 'Payment providers hold the first payout 7-14 days as a fraud control', correct: true },
                { id: 'o3', label: 'Their bank details must be wrong; ask them to re-enter them', correct: false },
              ],
              explanation: 'The hold belongs to the provider and applies to every new account. Northwind never holds funds.',
            },
            {
              id: 'q-sfp-2', type: 'boolean',
              prompt: 'A storefront cannot be built until the custom domain has verified.',
              options: [
                { id: 'o1', label: 'True', correct: false },
                { id: 'o2', label: 'False', correct: true },
              ],
              explanation: 'Everything except the vanity URL works on the temporary address while DNS propagates.',
            },
          ],
        },
      },
    ],
  },

  {
    id: CRS.SUPPORT_TOOLING,
    title: 'Working the queue: tools, macros and the questions you get daily',
    summary:
      'The mechanics of the agent workspace plus the five topics that make up roughly half of inbound volume. Free navigation — dip in when a ticket calls for it.',
    audience: 'internal',
    jobFunction: JF.SUPPORT_AGENT,
    status: 'published',
    ownerId: USR.DEVON,
    version: '2.4',
    updatedAt: '2026-08-05T11:05:00Z',
    sequencing: 'free',
    passingScore: 80,
    certificate: false,
    lessonPrereqs: {
      [KB.MFA_SETUP]: [KB.RESET_PASSWORD],
      [KB.WEBHOOK_SETUP]: [KB.API_KEYS],
    },
    modules: [
      {
        id: 'mod-st-macros',
        title: 'Macros without sounding like a robot',
        summary: 'When a macro saves the customer time and when it costs you the conversation.',
        lessonIds: [KB.USING_MACROS],
        quiz: null,
      },
      {
        id: 'mod-st-access',
        title: 'Access questions, end to end',
        summary: 'The highest-volume cluster on both desks. These are the same three atoms the help centre publishes.',
        lessonIds: [KB.RESET_PASSWORD, KB.MFA_SETUP, KB.ACCOUNT_LOCKED],
        quiz: {
          id: 'quiz-st-access',
          title: 'Access check',
          passingScore: 80,
          questions: [
            {
              id: 'q-sta-1', type: 'multi',
              prompt: 'Which account locks clear without anyone from IT touching them?',
              options: [
                { id: 'o1', label: 'Ten failed attempts in fifteen minutes', correct: true },
                { id: 'o2', label: 'Impossible-travel lock', correct: true },
                { id: 'o3', label: 'Administrative hold during offboarding', correct: false },
              ],
              explanation: 'Attempt locks time out after 30 minutes and travel locks clear on re-verification. An administrative hold is deliberate.',
            },
            {
              id: 'q-sta-2', type: 'single',
              prompt: 'A customer says the reset code never arrived. What do you check first?',
              options: [
                { id: 'o1', label: 'Whether the code expired — they are valid for ten minutes', correct: true },
                { id: 'o2', label: 'Whether their mailbox is full', correct: false },
                { id: 'o3', label: 'Whether the account exists', correct: false },
              ],
              explanation: 'Expiry and quarantine account for almost every "no code" report. Ask for a fresh code before anything else.',
            },
          ],
        },
      },
      {
        id: 'mod-st-dev',
        title: 'When the question is technical',
        summary: 'Enough of the integration surface to triage a developer question instead of forwarding it.',
        lessonIds: [KB.API_KEYS, KB.WEBHOOK_SETUP],
        quiz: null,
      },
    ],
  },

  {
    id: CRS.SUPPORT_COMMS,
    title: 'Writing to customers',
    summary:
      'Voice, structure and the two conversations everybody gets wrong early: the angry one and the closing one. Certificate on completion.',
    audience: 'internal',
    jobFunction: JF.SUPPORT_AGENT,
    status: 'published',
    ownerId: USR.LISA,
    version: '4.0',
    updatedAt: '2026-08-13T09:40:00Z',
    sequencing: 'linear',
    passingScore: 85,
    certificate: true,
    certificateName: 'Northwind Customer Communication',
    lessonPrereqs: {
      [KB.CLOSING_WELL]: [KB.WRITING_TO_CUSTOMERS],
    },
    modules: [
      {
        id: 'mod-sc-voice',
        title: 'Voice and structure',
        summary: 'Answer first, then explain. The shape of a reply people actually read.',
        lessonIds: [KB.WRITING_TO_CUSTOMERS],
        quiz: {
          id: 'quiz-sc-voice',
          title: 'Writing check',
          passingScore: 85,
          questions: [
            {
              id: 'q-scv-1', type: 'single',
              prompt: 'Where does the answer belong in a reply?',
              options: [
                { id: 'o1', label: 'After the context, so it makes sense', correct: false },
                { id: 'o2', label: 'In the first two lines, before the explanation', correct: true },
                { id: 'o3', label: 'In a bulleted summary at the bottom', correct: false },
              ],
              explanation: 'Customers read the first two lines on a phone. Anything below the fold is optional detail.',
            },
            {
              id: 'q-scv-2', type: 'boolean',
              prompt: '"Per my last email" is acceptable when the customer has genuinely not read the thread.',
              options: [
                { id: 'o1', label: 'True', correct: false },
                { id: 'o2', label: 'False', correct: true },
              ],
              explanation: 'It reads as a scolding regardless of intent. Restate the answer plainly instead — it costs one line.',
            },
          ],
        },
      },
      {
        id: 'mod-sc-hard',
        title: 'The hard conversation',
        summary: 'De-escalation that is not a script, and the point at which you hand it to a lead.',
        lessonIds: [KB.HANDLING_ANGRY],
        quiz: null,
      },
      {
        id: 'mod-sc-closing',
        title: 'Ending well',
        summary: 'A close that stops the ticket coming back in four days.',
        lessonIds: [KB.CLOSING_WELL],
        quiz: null,
      },
    ],
  },

  {
    id: CRS.SUPPORT_ESCALATION,
    title: 'Escalation, change and the money questions',
    summary:
      'Where a ticket goes when it stops being yours: the escalation ladder, the change process it may become, and the billing questions that are never engineering problems.',
    audience: 'internal',
    jobFunction: JF.SUPPORT_AGENT,
    status: 'published',
    ownerId: USR.ADMIN,
    version: '1.6',
    updatedAt: '2026-07-30T14:15:00Z',
    sequencing: 'linear',
    passingScore: 80,
    certificate: false,
    lessonPrereqs: {
      [KB.APPROVAL_THRESHOLDS]: [KB.CHANGE_PROCESS],
    },
    modules: [
      {
        id: 'mod-se-when',
        title: 'When to escalate, and to whom',
        summary: 'The ladder, the three things that must be in the handoff, and the cost of escalating early.',
        lessonIds: [KB.ESCALATION_PATHS],
        quiz: {
          id: 'quiz-se-when',
          title: 'Escalation check',
          passingScore: 80,
          questions: [
            {
              id: 'q-sew-1', type: 'multi',
              prompt: 'What must be in an escalation handoff?',
              options: [
                { id: 'o1', label: 'What you have already ruled out', correct: true },
                { id: 'o2', label: 'What the customer has been told so far', correct: true },
                { id: 'o3', label: 'A guess at the root cause', correct: false },
                { id: 'o4', label: 'The business impact in the customer\'s words', correct: true },
              ],
              explanation: 'An escalation without the ruled-out list makes the next person repeat your work in front of the customer.',
            },
          ],
        },
      },
      {
        id: 'mod-se-change',
        title: 'When it becomes a change',
        summary: 'The ITIL-shaped process on the other side of the wall, and what approval actually gates.',
        lessonIds: [KB.CHANGE_PROCESS, KB.APPROVAL_THRESHOLDS],
        quiz: null,
      },
      {
        id: 'mod-se-billing',
        title: 'The money questions',
        summary: 'Proration, seat counts and payout timing. Published to customers as well — read it as they read it.',
        lessonIds: [KB.INVOICE_QUESTIONS],
        quiz: null,
      },
    ],
  },

  /* ---------------------------------------------------------------- *
   * IT Support track
   * ---------------------------------------------------------------- */
  {
    id: CRS.IT_ENDPOINTS,
    title: 'Endpoint support: laptops, displays and licences',
    summary:
      'Everything the internal helpdesk touches that has a serial number on it, from day-one setup to the wipe confirmation on a return.',
    audience: 'internal',
    jobFunction: JF.IT_SUPPORT,
    status: 'published',
    ownerId: USR.EMMA,
    version: '5.1',
    updatedAt: '2026-08-09T08:55:00Z',
    sequencing: 'free',
    passingScore: 80,
    certificate: false,
    lessonPrereqs: {},
    modules: [
      {
        id: 'mod-ie-dayone',
        title: 'Day one',
        summary: 'Unbox to enrolled without a re-do, and the self-service catalog that removes the second ticket.',
        lessonIds: [KB.LAPTOP_SETUP, KB.INSTALL_SOFTWARE],
        quiz: {
          id: 'quiz-ie-dayone',
          title: 'Setup check',
          passingScore: 80,
          questions: [
            {
              id: 'q-ied-1', type: 'single',
              prompt: 'A new starter cannot complete enrolment at their desk in the office. Most likely cause?',
              options: [
                { id: 'o1', label: 'They joined the guest wifi and enrolment cannot pass the captive portal', correct: true },
                { id: 'o2', label: 'The laptop is faulty', correct: false },
                { id: 'o3', label: 'Their account has not been created', correct: false },
              ],
              explanation: 'Guest wifi is the number one cause of a day-one setup becoming a day-two ticket.',
            },
          ],
        },
      },
      {
        id: 'mod-ie-display',
        title: 'Displays and docks',
        summary: 'The cable-first ladder, and what entitlement says before you order anything.',
        lessonIds: [KB.SCREEN_FLICKER, KB.REQUEST_MONITOR],
        quiz: null,
      },
      {
        id: 'mod-ie-licence',
        title: 'Licensing',
        summary: 'Thresholds, the 60-day reclaim, and one archived article kept for machines that have not migrated.',
        lessonIds: [KB.LICENSE_POLICY, KB.ADOBE_ACTIVATION],
        quiz: null,
      },
      {
        id: 'mod-ie-return',
        title: 'Getting it back',
        summary: 'Returns that close on the first pass, which is a Facilities problem until it is yours.',
        lessonIds: [KB.RETURN_EQUIPMENT],
        quiz: null,
      },
    ],
  },

  {
    id: CRS.IT_ACCESS,
    title: 'Identity and access support',
    summary:
      'Sign-in, second factors, single sign-on and mail. The internal half of the same atoms the customer academy uses. Certificate on completion.',
    audience: 'internal',
    jobFunction: JF.IT_SUPPORT,
    status: 'published',
    ownerId: USR.EMMA,
    version: '3.0',
    updatedAt: '2026-07-21T16:30:00Z',
    sequencing: 'linear',
    passingScore: 80,
    certificate: true,
    certificateName: 'Northwind Identity & Access Support',
    lessonPrereqs: {
      [KB.MFA_SETUP]: [KB.RESET_PASSWORD],
      [KB.SSO_EXPLAINED]: [KB.MFA_SETUP],
    },
    modules: [
      {
        id: 'mod-ia-signin',
        title: 'Sign-in and lockouts',
        summary: 'The reset path a user can walk alone, and the three lock triggers behind most tickets.',
        lessonIds: [KB.RESET_PASSWORD, KB.ACCOUNT_LOCKED],
        quiz: {
          id: 'quiz-ia-signin',
          title: 'Sign-in check',
          passingScore: 80,
          questions: [
            {
              id: 'q-ias-1', type: 'boolean',
              prompt: 'A phone mail app retrying an old password can re-lock an account the moment the lock releases.',
              options: [
                { id: 'o1', label: 'True', correct: true },
                { id: 'o2', label: 'False', correct: false },
              ],
              explanation: 'Always have the user sign out of mobile mail before retrying. Otherwise the unlock looks like it failed.',
            },
          ],
        },
      },
      {
        id: 'mod-ia-mfa',
        title: 'Second factors',
        summary: 'Enrolment, recovery codes and the backup method that prevents the 40-minute lost-phone ticket.',
        lessonIds: [KB.MFA_SETUP],
        quiz: null,
      },
      {
        id: 'mod-ia-sso',
        title: 'Single sign-on',
        summary: 'What is behind SSO, what is deliberately outside it, and why session expiry is not a bug.',
        lessonIds: [KB.SSO_EXPLAINED],
        quiz: null,
      },
      {
        id: 'mod-ia-mail',
        title: 'Mail on devices',
        summary: 'Supported clients, sync settings, and releasing from quarantine without releasing a phish.',
        lessonIds: [KB.EMAIL_ON_PHONE, KB.SPAM_QUARANTINE],
        quiz: null,
      },
    ],
  },

  {
    id: CRS.CHANGE_MANAGEMENT,
    title: 'Change management at Northwind',
    summary:
      'For anyone who raises, approves or communicates a change: the process, the approval thresholds, and how the change reads to the customer on the other end.',
    audience: 'internal',
    jobFunction: JF.SERVICE_OPS,
    status: 'published',
    ownerId: USR.ADMIN,
    version: '2.2',
    updatedAt: '2026-06-26T10:10:00Z',
    sequencing: 'linear',
    passingScore: 85,
    certificate: true,
    certificateName: 'Northwind Change Practitioner',
    lessonPrereqs: {
      [KB.APPROVAL_THRESHOLDS]: [KB.CHANGE_PROCESS],
    },
    modules: [
      {
        id: 'mod-cm-process',
        title: 'The process',
        summary: 'Standard, normal and emergency, and what the CAB is actually for.',
        lessonIds: [KB.CHANGE_PROCESS],
        quiz: {
          id: 'quiz-cm-process',
          title: 'Process check',
          passingScore: 85,
          questions: [
            {
              id: 'q-cmp-1', type: 'single',
              prompt: 'A pre-approved, low-risk, previously-executed change is which type?',
              options: [
                { id: 'o1', label: 'Standard', correct: true },
                { id: 'o2', label: 'Normal', correct: false },
                { id: 'o3', label: 'Emergency', correct: false },
              ],
              explanation: 'Standard changes are pre-authorised by their template. Sending them to the CAB is how a CAB becomes a bottleneck.',
            },
            {
              id: 'q-cmp-2', type: 'boolean',
              prompt: 'An emergency change skips the record as well as the approval queue.',
              options: [
                { id: 'o1', label: 'True', correct: false },
                { id: 'o2', label: 'False', correct: true },
              ],
              explanation: 'Emergency changes are approved retrospectively but always recorded. An unrecorded change is how the next outage becomes unexplainable.',
            },
          ],
        },
      },
      {
        id: 'mod-cm-approvals',
        title: 'Who has to say yes',
        summary: 'Spend thresholds, licence implications and the approvals that are policy rather than opinion.',
        lessonIds: [KB.APPROVAL_THRESHOLDS, KB.LICENSE_POLICY],
        quiz: null,
      },
      {
        id: 'mod-cm-comms',
        title: 'Telling people',
        summary: 'The customer-facing half. Same writing atom the support track uses — one source, two audiences.',
        lessonIds: [KB.WRITING_TO_CUSTOMERS, KB.SLA_EXPLAINED],
        quiz: null,
      },
    ],
  },

  /* ---------------------------------------------------------------- *
   * Northwind Academy — external, for customers
   * ---------------------------------------------------------------- */
  {
    id: CRS.CUSTOMER_ONBOARDING,
    title: 'Northwind Storefront: launch in a week',
    summary:
      'The external academy course every new customer is enrolled in on signature. Built entirely from the help-centre guides — the customer reads them once, in order, with a check at the end.',
    audience: 'external',
    jobFunction: JF.CUSTOMER,
    status: 'published',
    ownerId: USR.LISA,
    version: '6.3',
    updatedAt: '2026-08-12T12:45:00Z',
    sequencing: 'linear',
    passingScore: 80,
    certificate: true,
    certificateName: 'Northwind Storefront Launch',
    lessonPrereqs: {
      [KB.IMPORT_CATALOG]: [KB.STOREFRONT_SETUP],
      [KB.CONNECT_PAYMENTS]: [KB.STOREFRONT_SETUP],
    },
    modules: [
      {
        id: 'mod-co-standup',
        title: 'Stand up the storefront',
        summary: 'Domain, theme, tax and a test order. About an hour of real work.',
        lessonIds: [KB.STOREFRONT_SETUP],
        quiz: {
          id: 'quiz-co-standup',
          title: 'Launch check',
          passingScore: 80,
          questions: [
            {
              id: 'q-cos-1', type: 'single',
              prompt: 'Your domain is still showing "pending verification". What should you do next?',
              options: [
                { id: 'o1', label: 'Wait — nothing else can be configured yet', correct: false },
                { id: 'o2', label: 'Carry on building; DNS propagates in the background', correct: true },
                { id: 'o3', label: 'Delete the storefront and start again', correct: false },
              ],
              explanation: 'Themes, products, tax and test orders all work on the temporary address.',
            },
          ],
        },
      },
      {
        id: 'mod-co-products',
        title: 'Load your products',
        summary: 'The CSV template, the four columns that break imports, and the 24-hour revert window.',
        lessonIds: [KB.IMPORT_CATALOG],
        quiz: null,
      },
      {
        id: 'mod-co-money',
        title: 'Take money',
        summary: 'Connect a provider properly, survive business verification, and know when the first payout lands.',
        lessonIds: [KB.CONNECT_PAYMENTS],
        quiz: {
          id: 'quiz-co-money',
          title: 'Payments check',
          passingScore: 80,
          questions: [
            {
              id: 'q-com-1', type: 'boolean',
              prompt: 'You should paste your provider secret key into Northwind to connect it.',
              options: [
                { id: 'o1', label: 'True', correct: false },
                { id: 'o2', label: 'False', correct: true },
              ],
              explanation: 'Use the Connect flow. It authorises without either side handling secret keys and can be revoked from either end.',
            },
            {
              id: 'q-com-2', type: 'single',
              prompt: 'How long do providers typically hold a first payout?',
              options: [
                { id: 'o1', label: '24 hours', correct: false },
                { id: 'o2', label: '7 to 14 days', correct: true },
                { id: 'o3', label: 'Until you request it', correct: false },
              ],
              explanation: 'It is a fraud control on every new account, and it is not something Northwind can shorten.',
            },
          ],
        },
      },
      {
        id: 'mod-co-billing',
        title: 'Your first invoice',
        summary: 'Proration, seats and usage — read before the first of the month rather than after it.',
        lessonIds: [KB.INVOICE_QUESTIONS],
        quiz: null,
      },
    ],
  },

  {
    id: CRS.CUSTOMER_ADMIN,
    title: 'Storefront Administrator certification',
    summary:
      'For the person who runs Northwind inside a customer\'s company: their team\'s accounts, the integration surface, billing, and what our SLA does and does not promise them.',
    audience: 'external',
    jobFunction: JF.CUSTOMER,
    status: 'published',
    ownerId: USR.NADIA,
    version: '2.0',
    updatedAt: '2026-08-14T11:35:00Z',
    sequencing: 'free',
    passingScore: 85,
    certificate: true,
    certificateName: 'Northwind Certified Storefront Administrator',
    lessonPrereqs: {
      [KB.WEBHOOK_SETUP]: [KB.API_KEYS],
    },
    modules: [
      {
        id: 'mod-ca-team',
        title: 'Your team\'s accounts',
        summary: 'The three access atoms Northwind publishes to everyone — an admin has to be able to walk their own people through them.',
        lessonIds: [KB.RESET_PASSWORD, KB.MFA_SETUP, KB.ACCOUNT_LOCKED],
        quiz: null,
      },
      {
        id: 'mod-ca-integrations',
        title: 'The integration surface',
        summary: 'Scoped keys, zero-downtime rotation, signed webhooks and idempotent handlers.',
        lessonIds: [KB.API_KEYS, KB.WEBHOOK_SETUP],
        quiz: {
          id: 'quiz-ca-integrations',
          title: 'Integration check',
          passingScore: 85,
          questions: [
            {
              id: 'q-cai-1', type: 'single',
              prompt: 'A key with orders:read is deployed and you now need orders:write. What do you do?',
              options: [
                { id: 'o1', label: 'Widen the scope on the existing key', correct: false },
                { id: 'o2', label: 'Create a new key with both scopes and rotate to it', correct: true },
                { id: 'o3', label: 'Use the account owner\'s personal key', correct: false },
              ],
              explanation: 'Scopes cannot be widened after creation. Two keys can be live at once, which is what makes rotation zero-downtime.',
            },
            {
              id: 'q-cai-2', type: 'multi',
              prompt: 'A webhook handler must:',
              options: [
                { id: 'o1', label: 'Verify the HMAC signature before trusting the payload', correct: true },
                { id: 'o2', label: 'Respond within five seconds', correct: true },
                { id: 'o3', label: 'Assume each event is delivered exactly once', correct: false },
                { id: 'o4', label: 'Be safe to run twice on the same event', correct: true },
              ],
              explanation: 'Retries are guaranteed; exactly-once delivery is not. Idempotency is the handler\'s job.',
            },
          ],
        },
      },
      {
        id: 'mod-ca-billing',
        title: 'Billing you can explain to Finance',
        summary: 'Every line on the invoice, including the proration that looks wrong and is not.',
        lessonIds: [KB.INVOICE_QUESTIONS],
        quiz: null,
      },
      {
        id: 'mod-ca-support',
        title: 'What support promises you',
        summary: 'The SLA atom, read from the customer side. Same words the agents are trained on.',
        lessonIds: [KB.SLA_EXPLAINED],
        quiz: {
          id: 'quiz-ca-support',
          title: 'SLA check',
          passingScore: 85,
          questions: [
            {
              id: 'q-cas-1', type: 'single',
              prompt: 'Your ticket is waiting on information you owe us. What is the SLA clock doing?',
              options: [
                { id: 'o1', label: 'Still running against resolution', correct: false },
                { id: 'o2', label: 'Paused while the ticket is pending on you', correct: true },
                { id: 'o3', label: 'Reset to zero', correct: false },
              ],
              explanation: 'Pending-on-requester pauses the clock. It resumes the moment you reply, which is why a one-line answer moves your ticket.',
            },
          ],
        },
      },
    ],
  },
];

/* ==================================================================== *
 * CURRICULA
 *
 * A curriculum is a job function's whole reading list, ordered. The
 * `competencies` array is what makes a curriculum defensible: each one names
 * something the person must be able to DO, and points at the courses that
 * cover it. The Learning view renders that as a coverage matrix, so a gap is
 * visible rather than assumed.
 * ==================================================================== */

export const CURRICULA = [
  {
    id: CUR.SUPPORT_AGENT,
    name: 'Support Agent',
    summary:
      'Everything a Northwind support agent must know, in the order a new hire should meet it. Five courses, four weeks, and a certificate at the end that means they can be left alone with the queue.',
    jobFunction: JF.SUPPORT_AGENT,
    audience: 'internal',
    status: 'published',
    ownerId: USR.LISA,
    updatedAt: '2026-08-13T10:00:00Z',
    targetDays: 30,
    certificate: true,
    certificateName: 'Northwind Support Agent',
    courseIds: [
      CRS.SUPPORT_FOUNDATIONS,
      CRS.SUPPORT_TOOLING,
      CRS.SUPPORT_COMMS,
      CRS.SUPPORT_ESCALATION,
      CRS.CUSTOMER_ONBOARDING,
    ],
    note:
      'The last course is the external academy course customers take at signature. Agents take the same one — it is the fastest way to know what the customer was already told.',
    competencies: [
      { id: 'cmp-sa-intake', label: 'Read and triage an inbound ticket', detail: 'Identify requester, impact and category inside four minutes.', courseIds: [CRS.SUPPORT_FOUNDATIONS, CRS.SUPPORT_TOOLING] },
      { id: 'cmp-sa-product', label: 'Answer product questions without escalating', detail: 'Storefront setup, imports and payments at the level a customer asks about them.', courseIds: [CRS.SUPPORT_FOUNDATIONS, CRS.CUSTOMER_ONBOARDING] },
      { id: 'cmp-sa-writing', label: 'Write a reply a customer trusts', detail: 'Answer first, plain language, no jargon shield.', courseIds: [CRS.SUPPORT_COMMS] },
      { id: 'cmp-sa-sla', label: 'Work to the SLA clock', detail: 'Know what is measured, what pauses it, and what to say when it is at risk.', courseIds: [CRS.SUPPORT_FOUNDATIONS, CRS.SUPPORT_ESCALATION] },
      { id: 'cmp-sa-tools', label: 'Use macros and the agent workspace', detail: 'Speed without sounding automated.', courseIds: [CRS.SUPPORT_TOOLING] },
      { id: 'cmp-sa-escalate', label: 'Escalate to the right place, first time', detail: 'Complete handoffs with the ruled-out list attached.', courseIds: [CRS.SUPPORT_ESCALATION] },
      { id: 'cmp-sa-billing', label: 'Handle a billing or payout question', detail: 'Proration, seats, first-payout holds — none of which are engineering problems.', courseIds: [CRS.SUPPORT_ESCALATION, CRS.CUSTOMER_ONBOARDING] },
      { id: 'cmp-sa-close', label: 'Close a ticket so it stays closed', detail: 'Confirm the outcome, name the article, leave the door open.', courseIds: [CRS.SUPPORT_COMMS] },
    ],
  },

  {
    id: CUR.IT_SUPPORT,
    name: 'IT Support',
    summary:
      'The internal helpdesk job: identity, endpoints and the change process that sits behind anything you cannot fix at the desk. Six weeks, two certificates.',
    jobFunction: JF.IT_SUPPORT,
    audience: 'internal',
    status: 'published',
    ownerId: USR.EMMA,
    updatedAt: '2026-07-29T15:20:00Z',
    targetDays: 45,
    certificate: true,
    certificateName: 'Northwind IT Support',
    courseIds: [CRS.IT_ACCESS, CRS.IT_ENDPOINTS, CRS.CHANGE_MANAGEMENT],
    note: null,
    competencies: [
      { id: 'cmp-it-identity', label: 'Resolve any sign-in or MFA problem', detail: 'Including the ones that need an administrative unlock.', courseIds: [CRS.IT_ACCESS] },
      { id: 'cmp-it-sso', label: 'Explain what is and is not behind SSO', detail: 'And recognise a credential-phishing report on sight.', courseIds: [CRS.IT_ACCESS] },
      { id: 'cmp-it-endpoint', label: 'Take a machine from box to enrolled', detail: 'Without producing a day-two ticket.', courseIds: [CRS.IT_ENDPOINTS] },
      { id: 'cmp-it-peripheral', label: 'Diagnose a display or dock fault', detail: 'Cable, dock, refresh rate, driver — in that order.', courseIds: [CRS.IT_ENDPOINTS] },
      { id: 'cmp-it-licence', label: 'Apply the licensing policy', detail: 'Thresholds, reclaim and what needs a security review.', courseIds: [CRS.IT_ENDPOINTS, CRS.CHANGE_MANAGEMENT] },
      { id: 'cmp-it-change', label: 'Raise and communicate a change', detail: 'Correct type, correct approvers, readable customer notice.', courseIds: [CRS.CHANGE_MANAGEMENT] },
    ],
  },

  {
    id: CUR.CUSTOMER_ADMIN,
    name: 'Storefront Administrator (Academy)',
    summary:
      'The external curriculum. A customer\'s own admin goes from signature to certified in about three weeks — same atoms our agents train on, presented as an academy rather than an onboarding.',
    jobFunction: JF.CUSTOMER,
    audience: 'external',
    status: 'published',
    ownerId: USR.LISA,
    updatedAt: '2026-08-14T13:05:00Z',
    targetDays: 21,
    certificate: true,
    certificateName: 'Northwind Certified Storefront Administrator',
    courseIds: [CRS.CUSTOMER_ONBOARDING, CRS.CUSTOMER_ADMIN],
    note:
      'Every lesson here is a live help-centre article. The academy is a sequence over content the customer could already read — which is exactly why it costs nothing to run.',
    competencies: [
      { id: 'cmp-ca-launch', label: 'Launch a storefront end to end', detail: 'Domain, theme, tax, first test order.', courseIds: [CRS.CUSTOMER_ONBOARDING] },
      { id: 'cmp-ca-catalog', label: 'Import and correct a product catalog', detail: 'Dry run, read the report, revert inside 24 hours.', courseIds: [CRS.CUSTOMER_ONBOARDING] },
      { id: 'cmp-ca-payments', label: 'Connect payments and explain payout timing', detail: 'Including the first-payout hold, before it becomes a support ticket.', courseIds: [CRS.CUSTOMER_ONBOARDING] },
      { id: 'cmp-ca-team', label: 'Administer their own team\'s accounts', detail: 'Resets, second factors and lockouts without calling us.', courseIds: [CRS.CUSTOMER_ADMIN] },
      { id: 'cmp-ca-integrate', label: 'Run integrations safely', detail: 'Scoped keys, rotation, verified webhooks.', courseIds: [CRS.CUSTOMER_ADMIN] },
      { id: 'cmp-ca-support', label: 'Use support well', detail: 'Know what the SLA measures and what pauses the clock.', courseIds: [CRS.CUSTOMER_ADMIN] },
    ],
  },
];

/* ==================================================================== *
 * ENROLLMENTS
 *
 * Progress is NOT stored as a percentage — it is derived from
 * `completedLessonIds` against the course's current lesson list, so adding a
 * lesson to a live course correctly drops everyone's progress instead of
 * leaving a number that used to be true.
 *
 * The demo story: Sam Whitfield started twelve days ago and is partway through
 * the Support Agent curriculum. Devon has one overdue course. Nadia is the only
 * agent fully through. Six external contacts are in the Academy.
 * ==================================================================== */

const enroll = (o) => ({
  status: 'enrolled',
  completedLessonIds: [],
  passedQuizIds: [],
  currentLessonId: null,
  score: null,
  attempts: 0,
  certified: false,
  certificateId: null,
  startedAt: null,
  completedAt: null,
  learnerKind: 'employee',
  ...o,
});

export const ENROLLMENTS = [
  /* -- Sam Whitfield: hired 2026-08-04, the live learner in this demo -- */
  enroll({
    id: 'enr-sam-foundations', learnerId: USR.SAM, courseId: CRS.SUPPORT_FOUNDATIONS,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-08-04', startedAt: '2026-08-04', dueAt: '2026-08-14', completedAt: '2026-08-07',
    completedLessonIds: [KB.READING_A_TICKET, KB.TRIAGE_BASICS, KB.SLA_EXPLAINED, KB.STOREFRONT_SETUP, KB.CONNECT_PAYMENTS],
    passedQuizIds: ['quiz-sf-intake', 'quiz-sf-product'], score: 92, attempts: 1,
  }),
  enroll({
    id: 'enr-sam-tooling', learnerId: USR.SAM, courseId: CRS.SUPPORT_TOOLING,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'in_lesson', assignedAt: '2026-08-04', startedAt: '2026-08-10', dueAt: '2026-08-21',
    completedLessonIds: [KB.USING_MACROS, KB.RESET_PASSWORD, KB.MFA_SETUP],
    currentLessonId: KB.ACCOUNT_LOCKED, attempts: 0,
  }),
  enroll({
    id: 'enr-sam-comms', learnerId: USR.SAM, courseId: CRS.SUPPORT_COMMS,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'enrolled', assignedAt: '2026-08-04', dueAt: '2026-08-28',
    currentLessonId: KB.WRITING_TO_CUSTOMERS,
  }),
  enroll({
    id: 'enr-sam-escalation', learnerId: USR.SAM, courseId: CRS.SUPPORT_ESCALATION,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'enrolled', assignedAt: '2026-08-04', dueAt: '2026-09-04',
  }),
  enroll({
    id: 'enr-sam-academy', learnerId: USR.SAM, courseId: CRS.CUSTOMER_ONBOARDING,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'in_lesson', assignedAt: '2026-08-04', startedAt: '2026-08-12', dueAt: '2026-09-11',
    completedLessonIds: [KB.STOREFRONT_SETUP], currentLessonId: KB.IMPORT_CATALOG,
  }),

  /* -- Devon Okafor: eighteen months in, one course slipped -- */
  enroll({
    id: 'enr-devon-foundations', learnerId: USR.DEVON, courseId: CRS.SUPPORT_FOUNDATIONS,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-03-02', startedAt: '2026-03-03', dueAt: '2026-03-20', completedAt: '2026-03-12',
    completedLessonIds: [KB.READING_A_TICKET, KB.TRIAGE_BASICS, KB.SLA_EXPLAINED, KB.STOREFRONT_SETUP, KB.CONNECT_PAYMENTS],
    passedQuizIds: ['quiz-sf-intake', 'quiz-sf-product'], score: 96, attempts: 1,
  }),
  enroll({
    id: 'enr-devon-tooling', learnerId: USR.DEVON, courseId: CRS.SUPPORT_TOOLING,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-03-20', startedAt: '2026-03-22', dueAt: '2026-04-10', completedAt: '2026-04-02',
    completedLessonIds: [KB.USING_MACROS, KB.RESET_PASSWORD, KB.MFA_SETUP, KB.ACCOUNT_LOCKED, KB.API_KEYS, KB.WEBHOOK_SETUP],
    passedQuizIds: ['quiz-st-access'], score: 90, attempts: 2,
  }),
  enroll({
    id: 'enr-devon-comms', learnerId: USR.DEVON, courseId: CRS.SUPPORT_COMMS,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-05-04', startedAt: '2026-05-06', dueAt: '2026-05-29', completedAt: '2026-05-20',
    completedLessonIds: [KB.WRITING_TO_CUSTOMERS, KB.HANDLING_ANGRY, KB.CLOSING_WELL],
    passedQuizIds: ['quiz-sc-voice'], score: 88, attempts: 1,
    certified: true, certificateId: 'cert-devon-comms',
  }),
  enroll({
    id: 'enr-devon-escalation', learnerId: USR.DEVON, courseId: CRS.SUPPORT_ESCALATION,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'in_lesson', assignedAt: '2026-07-06', startedAt: '2026-07-14', dueAt: '2026-08-07',
    completedLessonIds: [KB.ESCALATION_PATHS, KB.CHANGE_PROCESS],
    passedQuizIds: ['quiz-se-when'], currentLessonId: KB.APPROVAL_THRESHOLDS,
  }),
  enroll({
    id: 'enr-devon-academy', learnerId: USR.DEVON, courseId: CRS.CUSTOMER_ONBOARDING,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'enrolled', assignedAt: '2026-08-01', dueAt: '2026-09-30',
  }),

  /* -- Nadia Haddad: the only agent all the way through -- */
  enroll({
    id: 'enr-nadia-foundations', learnerId: USR.NADIA, courseId: CRS.SUPPORT_FOUNDATIONS,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-02-02', startedAt: '2026-02-03', dueAt: '2026-02-27', completedAt: '2026-02-18',
    completedLessonIds: [KB.READING_A_TICKET, KB.TRIAGE_BASICS, KB.SLA_EXPLAINED, KB.STOREFRONT_SETUP, KB.CONNECT_PAYMENTS],
    passedQuizIds: ['quiz-sf-intake', 'quiz-sf-product'], score: 94, attempts: 1,
  }),
  enroll({
    id: 'enr-nadia-tooling', learnerId: USR.NADIA, courseId: CRS.SUPPORT_TOOLING,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-02-27', startedAt: '2026-03-01', dueAt: '2026-03-27', completedAt: '2026-03-18',
    completedLessonIds: [KB.USING_MACROS, KB.RESET_PASSWORD, KB.MFA_SETUP, KB.ACCOUNT_LOCKED, KB.API_KEYS, KB.WEBHOOK_SETUP],
    passedQuizIds: ['quiz-st-access'], score: 86, attempts: 1,
  }),
  enroll({
    id: 'enr-nadia-comms', learnerId: USR.NADIA, courseId: CRS.SUPPORT_COMMS,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-04-01', startedAt: '2026-04-04', dueAt: '2026-04-30', completedAt: '2026-04-22',
    completedLessonIds: [KB.WRITING_TO_CUSTOMERS, KB.HANDLING_ANGRY, KB.CLOSING_WELL],
    passedQuizIds: ['quiz-sc-voice'], score: 93, attempts: 1,
    certified: true, certificateId: 'cert-nadia-comms',
  }),
  enroll({
    id: 'enr-nadia-escalation', learnerId: USR.NADIA, courseId: CRS.SUPPORT_ESCALATION,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-06-01', startedAt: '2026-06-08', dueAt: '2026-07-03', completedAt: '2026-06-30',
    completedLessonIds: [KB.ESCALATION_PATHS, KB.CHANGE_PROCESS, KB.APPROVAL_THRESHOLDS, KB.INVOICE_QUESTIONS],
    passedQuizIds: ['quiz-se-when'], score: 91, attempts: 1,
  }),
  enroll({
    id: 'enr-nadia-academy', learnerId: USR.NADIA, courseId: CRS.CUSTOMER_ONBOARDING,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-07-06', startedAt: '2026-07-09', dueAt: '2026-08-07', completedAt: '2026-07-24',
    completedLessonIds: [KB.STOREFRONT_SETUP, KB.IMPORT_CATALOG, KB.CONNECT_PAYMENTS, KB.INVOICE_QUESTIONS],
    passedQuizIds: ['quiz-co-standup', 'quiz-co-money'], score: 89, attempts: 1,
    certified: true, certificateId: 'cert-nadia-launch',
  }),

  /* -- Lisa Park: team lead, one course short -- */
  enroll({
    id: 'enr-lisa-foundations', learnerId: USR.LISA, courseId: CRS.SUPPORT_FOUNDATIONS,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.ADMIN,
    status: 'passed', assignedAt: '2025-09-01', startedAt: '2025-09-02', dueAt: '2025-09-30', completedAt: '2025-09-15',
    completedLessonIds: [KB.READING_A_TICKET, KB.TRIAGE_BASICS, KB.SLA_EXPLAINED, KB.STOREFRONT_SETUP, KB.CONNECT_PAYMENTS],
    passedQuizIds: ['quiz-sf-intake', 'quiz-sf-product'], score: 98, attempts: 1,
  }),
  enroll({
    id: 'enr-lisa-tooling', learnerId: USR.LISA, courseId: CRS.SUPPORT_TOOLING,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.ADMIN,
    status: 'passed', assignedAt: '2025-10-01', startedAt: '2025-10-02', dueAt: '2025-10-31', completedAt: '2025-10-20',
    completedLessonIds: [KB.USING_MACROS, KB.RESET_PASSWORD, KB.MFA_SETUP, KB.ACCOUNT_LOCKED, KB.API_KEYS, KB.WEBHOOK_SETUP],
    passedQuizIds: ['quiz-st-access'], score: 95, attempts: 1,
  }),
  enroll({
    id: 'enr-lisa-comms', learnerId: USR.LISA, courseId: CRS.SUPPORT_COMMS,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.ADMIN,
    status: 'passed', assignedAt: '2025-11-01', startedAt: '2025-11-03', dueAt: '2025-11-28', completedAt: '2025-11-14',
    completedLessonIds: [KB.WRITING_TO_CUSTOMERS, KB.HANDLING_ANGRY, KB.CLOSING_WELL],
    passedQuizIds: ['quiz-sc-voice'], score: 100, attempts: 1,
    certified: true, certificateId: 'cert-lisa-comms',
  }),
  enroll({
    id: 'enr-lisa-escalation', learnerId: USR.LISA, courseId: CRS.SUPPORT_ESCALATION,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.ADMIN,
    status: 'passed', assignedAt: '2025-11-28', startedAt: '2025-12-01', dueAt: '2025-12-31', completedAt: '2025-12-16',
    completedLessonIds: [KB.ESCALATION_PATHS, KB.CHANGE_PROCESS, KB.APPROVAL_THRESHOLDS, KB.INVOICE_QUESTIONS],
    passedQuizIds: ['quiz-se-when'], score: 97, attempts: 1,
  }),
  enroll({
    id: 'enr-lisa-academy', learnerId: USR.LISA, courseId: CRS.CUSTOMER_ONBOARDING,
    curriculumId: CUR.SUPPORT_AGENT, assignedById: USR.ADMIN,
    status: 'in_lesson', assignedAt: '2026-08-01', startedAt: '2026-08-15', dueAt: '2026-09-15',
    completedLessonIds: [KB.STOREFRONT_SETUP], currentLessonId: KB.IMPORT_CATALOG,
  }),
  enroll({
    id: 'enr-lisa-change', learnerId: USR.LISA, courseId: CRS.CHANGE_MANAGEMENT,
    curriculumId: CUR.IT_SUPPORT, assignedById: USR.ADMIN,
    status: 'in_lesson', assignedAt: '2026-07-20', startedAt: '2026-08-03', dueAt: '2026-08-31',
    completedLessonIds: [KB.CHANGE_PROCESS, KB.APPROVAL_THRESHOLDS, KB.LICENSE_POLICY],
    passedQuizIds: ['quiz-cm-process'], currentLessonId: KB.WRITING_TO_CUSTOMERS,
  }),

  /* -- IT and service ops -- */
  enroll({
    id: 'enr-emma-access', learnerId: USR.EMMA, courseId: CRS.IT_ACCESS,
    curriculumId: CUR.IT_SUPPORT, assignedById: USR.ADMIN,
    status: 'passed', assignedAt: '2026-01-05', startedAt: '2026-01-07', dueAt: '2026-02-05', completedAt: '2026-01-22',
    completedLessonIds: [KB.RESET_PASSWORD, KB.ACCOUNT_LOCKED, KB.MFA_SETUP, KB.SSO_EXPLAINED, KB.EMAIL_ON_PHONE, KB.SPAM_QUARANTINE],
    passedQuizIds: ['quiz-ia-signin'], score: 97, attempts: 1,
    certified: true, certificateId: 'cert-emma-access',
  }),
  enroll({
    id: 'enr-emma-endpoints', learnerId: USR.EMMA, courseId: CRS.IT_ENDPOINTS,
    curriculumId: CUR.IT_SUPPORT, assignedById: USR.ADMIN,
    status: 'passed', assignedAt: '2026-01-22', startedAt: '2026-01-26', dueAt: '2026-02-27', completedAt: '2026-02-09',
    completedLessonIds: [KB.LAPTOP_SETUP, KB.INSTALL_SOFTWARE, KB.SCREEN_FLICKER, KB.REQUEST_MONITOR, KB.LICENSE_POLICY, KB.ADOBE_ACTIVATION, KB.RETURN_EQUIPMENT],
    passedQuizIds: ['quiz-ie-dayone'], score: 93, attempts: 1,
  }),
  enroll({
    id: 'enr-emma-change', learnerId: USR.EMMA, courseId: CRS.CHANGE_MANAGEMENT,
    curriculumId: CUR.IT_SUPPORT, assignedById: USR.ADMIN,
    status: 'passed', assignedAt: '2026-03-16', startedAt: '2026-03-18', dueAt: '2026-04-30', completedAt: '2026-04-18',
    completedLessonIds: [KB.CHANGE_PROCESS, KB.APPROVAL_THRESHOLDS, KB.LICENSE_POLICY, KB.WRITING_TO_CUSTOMERS, KB.SLA_EXPLAINED],
    passedQuizIds: ['quiz-cm-process'], score: 95, attempts: 1,
    certified: true, certificateId: 'cert-emma-change',
  }),
  enroll({
    id: 'enr-priya-endpoints', learnerId: USR.PRIYA, courseId: CRS.IT_ENDPOINTS,
    curriculumId: CUR.IT_SUPPORT, assignedById: USR.EMMA,
    status: 'in_lesson', assignedAt: '2026-06-29', startedAt: '2026-07-02', dueAt: '2026-07-31',
    completedLessonIds: [KB.LAPTOP_SETUP, KB.INSTALL_SOFTWARE],
    passedQuizIds: ['quiz-ie-dayone'], currentLessonId: KB.SCREEN_FLICKER,
  }),
  enroll({
    id: 'enr-james-change', learnerId: USR.JAMES, courseId: CRS.CHANGE_MANAGEMENT,
    curriculumId: CUR.IT_SUPPORT, assignedById: USR.ADMIN,
    status: 'enrolled', assignedAt: '2026-08-11', dueAt: '2026-09-15',
  }),
  enroll({
    id: 'enr-michael-change', learnerId: USR.MICHAEL, courseId: CRS.CHANGE_MANAGEMENT,
    curriculumId: CUR.IT_SUPPORT, assignedById: USR.ADMIN,
    status: 'in_lesson', assignedAt: '2026-07-15', startedAt: '2026-07-28', dueAt: '2026-08-20',
    completedLessonIds: [KB.CHANGE_PROCESS], currentLessonId: KB.APPROVAL_THRESHOLDS,
  }),
  enroll({
    id: 'enr-alex-change', learnerId: USR.ADMIN, courseId: CRS.CHANGE_MANAGEMENT,
    curriculumId: CUR.IT_SUPPORT, assignedById: USR.ADMIN,
    status: 'passed', assignedAt: '2026-02-10', startedAt: '2026-02-12', dueAt: '2026-03-20', completedAt: '2026-03-05',
    completedLessonIds: [KB.CHANGE_PROCESS, KB.APPROVAL_THRESHOLDS, KB.LICENSE_POLICY, KB.WRITING_TO_CUSTOMERS, KB.SLA_EXPLAINED],
    passedQuizIds: ['quiz-cm-process'], score: 98, attempts: 1,
    certified: true, certificateId: 'cert-alex-change',
  }),
  enroll({
    id: 'enr-alex-comms', learnerId: USR.ADMIN, courseId: CRS.SUPPORT_COMMS,
    assignedById: USR.LISA,
    status: 'in_lesson', assignedAt: '2026-08-03', startedAt: '2026-08-09', dueAt: '2026-09-01',
    completedLessonIds: [KB.WRITING_TO_CUSTOMERS], currentLessonId: KB.HANDLING_ANGRY,
  }),

  /* -- Northwind Academy: customers' own admins -- */
  enroll({
    id: 'enr-dana-launch', learnerId: CON.DANA, learnerKind: 'contact', courseId: CRS.CUSTOMER_ONBOARDING,
    curriculumId: CUR.CUSTOMER_ADMIN, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-04-06', startedAt: '2026-04-08', dueAt: '2026-05-08', completedAt: '2026-05-02',
    completedLessonIds: [KB.STOREFRONT_SETUP, KB.IMPORT_CATALOG, KB.CONNECT_PAYMENTS, KB.INVOICE_QUESTIONS],
    passedQuizIds: ['quiz-co-standup', 'quiz-co-money'], score: 95, attempts: 1,
    certified: true, certificateId: 'cert-dana-launch',
  }),
  enroll({
    id: 'enr-dana-admin', learnerId: CON.DANA, learnerKind: 'contact', courseId: CRS.CUSTOMER_ADMIN,
    curriculumId: CUR.CUSTOMER_ADMIN, assignedById: USR.LISA,
    status: 'in_lesson', assignedAt: '2026-07-27', startedAt: '2026-08-03', dueAt: '2026-08-30',
    completedLessonIds: [KB.RESET_PASSWORD, KB.MFA_SETUP, KB.ACCOUNT_LOCKED, KB.API_KEYS],
    currentLessonId: KB.WEBHOOK_SETUP,
  }),
  enroll({
    id: 'enr-ravi-launch', learnerId: CON.RAVI, learnerKind: 'contact', courseId: CRS.CUSTOMER_ONBOARDING,
    curriculumId: CUR.CUSTOMER_ADMIN, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-05-18', startedAt: '2026-05-26', dueAt: '2026-06-18', completedAt: '2026-06-11',
    completedLessonIds: [KB.STOREFRONT_SETUP, KB.IMPORT_CATALOG, KB.CONNECT_PAYMENTS, KB.INVOICE_QUESTIONS],
    passedQuizIds: ['quiz-co-standup', 'quiz-co-money'], score: 82, attempts: 2,
    certified: true, certificateId: 'cert-ravi-launch',
  }),
  enroll({
    id: 'enr-bea-launch', learnerId: CON.BEA, learnerKind: 'contact', courseId: CRS.CUSTOMER_ONBOARDING,
    curriculumId: CUR.CUSTOMER_ADMIN, assignedById: USR.DEVON,
    status: 'in_lesson', assignedAt: '2026-07-13', startedAt: '2026-07-21', dueAt: '2026-08-12',
    completedLessonIds: [KB.STOREFRONT_SETUP, KB.IMPORT_CATALOG],
    passedQuizIds: ['quiz-co-standup'], currentLessonId: KB.CONNECT_PAYMENTS,
  }),
  enroll({
    id: 'enr-owen-launch', learnerId: CON.OWEN, learnerKind: 'contact', courseId: CRS.CUSTOMER_ONBOARDING,
    curriculumId: CUR.CUSTOMER_ADMIN, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-05-11', startedAt: '2026-05-13', dueAt: '2026-06-11', completedAt: '2026-06-02',
    completedLessonIds: [KB.STOREFRONT_SETUP, KB.IMPORT_CATALOG, KB.CONNECT_PAYMENTS, KB.INVOICE_QUESTIONS],
    passedQuizIds: ['quiz-co-standup', 'quiz-co-money'], score: 100, attempts: 1,
    certified: true, certificateId: 'cert-owen-launch',
  }),
  enroll({
    id: 'enr-owen-admin', learnerId: CON.OWEN, learnerKind: 'contact', courseId: CRS.CUSTOMER_ADMIN,
    curriculumId: CUR.CUSTOMER_ADMIN, assignedById: USR.LISA,
    status: 'passed', assignedAt: '2026-06-08', startedAt: '2026-06-15', dueAt: '2026-07-17', completedAt: '2026-07-08',
    completedLessonIds: [KB.RESET_PASSWORD, KB.MFA_SETUP, KB.ACCOUNT_LOCKED, KB.API_KEYS, KB.WEBHOOK_SETUP, KB.INVOICE_QUESTIONS, KB.SLA_EXPLAINED],
    passedQuizIds: ['quiz-ca-integrations', 'quiz-ca-support'], score: 97, attempts: 1,
    certified: true, certificateId: 'cert-owen-admin',
  }),
  enroll({
    id: 'enr-mei-admin', learnerId: CON.MEI, learnerKind: 'contact', courseId: CRS.CUSTOMER_ADMIN,
    curriculumId: CUR.CUSTOMER_ADMIN, assignedById: USR.LISA,
    status: 'in_lesson', assignedAt: '2026-08-10', startedAt: '2026-08-13', dueAt: '2026-09-20',
    completedLessonIds: [KB.RESET_PASSWORD, KB.MFA_SETUP], currentLessonId: KB.ACCOUNT_LOCKED,
  }),
  enroll({
    id: 'enr-cole-launch', learnerId: CON.COLE, learnerKind: 'contact', courseId: CRS.CUSTOMER_ONBOARDING,
    curriculumId: CUR.CUSTOMER_ADMIN, assignedById: USR.NADIA,
    status: 'enrolled', assignedAt: '2026-07-10', dueAt: '2026-08-10',
  }),
];
