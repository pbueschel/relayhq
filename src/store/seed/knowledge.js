/**
 * Knowledge seed — the atoms.
 *
 * A knowledge atom is the most reused record in RelayHQ. The SAME record is:
 *   · a help-centre article or guide the customer hits before opening a ticket
 *   · an agent-facing reference surfaced next to a ticket
 *   · a lesson inside a course that teaches a job function
 *
 * Nothing here is copied per surface. `catalog.js` points at these ids from its
 * items, `learning.js` points at the same ids from its course modules. That
 * overlap is the product thesis, not duplication — see schema.js.
 *
 * FORMATS
 *   article — rich HTML body. Rendered through `.rhq-prose` (see index.css).
 *   guide   — an ordered list of Stories-style slides: image / video / text,
 *             with a heading, a rich-text caption, an auto-advance duration and
 *             (for images) REQUIRED alt text. The smoke gate fails without alt.
 *
 * LESSON FIELDS
 *   Every atom carries `objective`, `minutes`, `prerequisiteIds` and an optional
 *   `check`, because any atom must be able to act as a lesson without being
 *   rewritten. The agent-enablement cluster (triage, writing, escalation,
 *   macros, reading a ticket, SLAs, angry customers, closing) is authored to a
 *   higher standard because the Support Agent curriculum composes it verbatim.
 *
 * The demo company is Northwind Systems — a mid-size SaaS company running
 * RelayHQ for its own employees AND for the customers who buy its storefront
 * product.
 */

import { KB, USR } from './ids.js';

/** Portrait story frames. Deterministic per slug so a reload looks the same. */
const shot = (slug) => `https://picsum.photos/seed/${slug}/540/960`;

export const KNOWLEDGE = [
  /* ================================================================== *
   * Account & access
   * ================================================================== */
  {
    id: KB.RESET_PASSWORD,
    title: 'Reset your Northwind password',
    format: 'guide',
    summary: 'Five screens from the sign-in page to a working password. No service desk ticket required.',
    status: 'published',
    audience: 'both',
    tags: ['account', 'password', 'self-service', 'sign-in'],
    ownerId: USR.EMMA,
    updatedAt: '2026-08-04T14:20:00Z',
    views: 8412,
    helpfulYes: 731,
    helpfulNo: 44,
    objective: 'After this you can reset your own Northwind password and get back in without opening a ticket.',
    minutes: 3,
    prerequisiteIds: [],
    slides: [
      {
        id: 'sl-rp-1', type: 'image', seconds: 5,
        url: shot('relay-reset-signin'),
        heading: 'Start at the sign-in page',
        caption: 'Go to <strong>id.northwind.example</strong> and select <em>Forgot password</em> underneath the password box. Do not use a bookmarked reset link — they expire after 24 hours.',
        alt: 'The Northwind sign-in page with the "Forgot password" link highlighted below the password field.',
      },
      {
        id: 'sl-rp-2', type: 'image', seconds: 5,
        url: shot('relay-reset-email'),
        heading: 'Confirm it is you',
        caption: 'Enter your <strong>work email address</strong>, not your username. We send a six-digit code that is valid for ten minutes.',
        alt: 'Email entry screen showing a work email typed into the field and a Send code button.',
      },
      {
        id: 'sl-rp-3', type: 'image', seconds: 6,
        url: shot('relay-reset-code'),
        heading: 'Enter the code',
        caption: 'Check your phone or a device you are still signed in on. If the code never arrives, look in <strong>Quarantine</strong> before you assume it failed — automated mail is the most common thing our filter holds.',
        alt: 'Six-digit verification code entry screen with the first three digits filled in.',
      },
      {
        id: 'sl-rp-4', type: 'image', seconds: 7,
        url: shot('relay-reset-newpass'),
        heading: 'Choose a new password',
        caption: 'It must be at least 14 characters and cannot be one of your last five. A passphrase of three unrelated words beats a short password with symbols.<ul><li>14 characters minimum</li><li>No reuse of your last five</li><li>Never your work email prefix</li></ul>',
        alt: 'New password screen with a strength meter reading Strong and the confirm field filled in.',
      },
      {
        id: 'sl-rp-5', type: 'text', seconds: 0,
        heading: 'You are back in',
        caption: 'Sign in with the new password. <strong>Your phone and laptop mail apps will prompt again</strong> — that is expected, and it is the step people forget. Still locked out after this? Open a <em>Cannot sign in</em> request and the service desk will pick it up.',
      },
    ],
    check: [
      {
        id: 'q-rp-1', type: 'boolean',
        prompt: 'A password reset code stays valid until you use it.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'Codes expire after ten minutes. Request a fresh one rather than waiting on an old email.',
      },
    ],
  },

  {
    id: KB.MFA_SETUP,
    title: 'Set up multi-factor authentication',
    format: 'guide',
    summary: 'Enrol an authenticator app, save your recovery codes, and add a backup method before you need it.',
    status: 'published',
    audience: 'both',
    tags: ['security', 'mfa', 'account', 'sign-in'],
    ownerId: USR.EMMA,
    updatedAt: '2026-07-29T16:05:00Z',
    views: 6120,
    helpfulYes: 508,
    helpfulNo: 61,
    objective: 'After this you can enrol a second factor, store recovery codes safely, and register a backup method so a lost phone does not lock you out.',
    minutes: 5,
    prerequisiteIds: [KB.RESET_PASSWORD],
    slides: [
      {
        id: 'sl-mfa-1', type: 'image', seconds: 5,
        url: shot('relay-mfa-security'),
        heading: 'Open Security settings',
        caption: 'From the avatar menu choose <strong>Security</strong>. Everything on this guide lives under <em>Two-step verification</em>.',
        alt: 'Account menu open with the Security item highlighted.',
      },
      {
        id: 'sl-mfa-2', type: 'image', seconds: 6,
        url: shot('relay-mfa-choose'),
        heading: 'Pick your first factor',
        caption: 'An <strong>authenticator app</strong> is the recommended choice. SMS is offered as a fallback but it is the weakest option and Northwind will retire it for admin accounts this year.',
        alt: 'Factor picker showing Authenticator app, Security key and SMS options with Authenticator app selected.',
      },
      {
        id: 'sl-mfa-3', type: 'image', seconds: 7,
        url: shot('relay-mfa-qr'),
        heading: 'Scan the code',
        caption: 'Open your authenticator app, add an account, and point the camera at the square. If the camera will not focus, tap <em>enter setup key manually</em> and type the string underneath it.',
        alt: 'QR enrolment screen with a scannable code and a manual setup key printed below it.',
      },
      {
        id: 'sl-mfa-4', type: 'image', seconds: 6,
        url: shot('relay-mfa-verify'),
        heading: 'Verify once',
        caption: 'Type the six digits your app is showing. Codes rotate every 30 seconds, so if it fails, wait for the next one rather than retyping the same code.',
        alt: 'Verification screen with a six-digit code entered and a countdown ring beside it.',
      },
      {
        id: 'sl-mfa-5', type: 'image', seconds: 8,
        url: shot('relay-mfa-recovery'),
        heading: 'Save the recovery codes',
        caption: 'This is the step people skip and then regret. Put the ten codes in your password manager — <strong>not</strong> in a note on the phone that holds your authenticator.',
        alt: 'Recovery codes screen listing ten one-time codes with a Download and a Copy button.',
      },
      {
        id: 'sl-mfa-6', type: 'text', seconds: 0,
        heading: 'Add a backup method',
        caption: 'One factor is one point of failure. Add a <strong>second device or a hardware key</strong> now, while you are already in the screen. Lost-phone tickets take about 40 minutes to resolve; a backup method takes 40 seconds to add.',
      },
    ],
    check: [
      {
        id: 'q-mfa-1', type: 'single',
        prompt: 'Where should recovery codes be stored?',
        options: [
          { id: 'o1', label: 'In a note on the phone running the authenticator', correct: false },
          { id: 'o2', label: 'In your password manager', correct: true },
          { id: 'o3', label: 'Emailed to yourself', correct: false },
        ],
        explanation: 'Storing them on the same device as the authenticator means one loss takes out both factors.',
      },
    ],
  },

  {
    id: KB.ACCOUNT_LOCKED,
    title: 'Why accounts lock, and how to get back in',
    format: 'article',
    summary: 'The three lock triggers, how long each lasts, and what to do when the automatic unlock will not help you.',
    status: 'published',
    audience: 'both',
    tags: ['account', 'access', 'troubleshooting', 'sign-in'],
    ownerId: USR.EMMA,
    updatedAt: '2026-06-18T11:40:00Z',
    views: 4308,
    helpfulYes: 366,
    helpfulNo: 52,
    objective: 'After this you can tell which lock you have hit, wait out the ones that clear themselves, and raise the right request for the ones that do not.',
    minutes: 4,
    prerequisiteIds: [],
    body: `<p>A locked account is almost never a deleted account. Northwind locks a sign-in for one of three reasons, and two of them clear without anyone touching them.</p>
<h3>The three triggers</h3>
<ul>
<li><strong>Ten failed password attempts in 15 minutes.</strong> The lock lasts 30 minutes and then releases itself. Most people hit this because a phone mail app is quietly retrying an old password in the background.</li>
<li><strong>Impossible travel.</strong> A sign-in from Chicago followed 20 minutes later by one from Lisbon locks the session until you re-verify with your second factor. This is the one a VPN causes most often.</li>
<li><strong>Administrative hold.</strong> Placed by IT during an offboarding, a suspected compromise, or a licence reclaim. This one never clears on its own.</li>
</ul>
<h3>What to do first</h3>
<p>Sign out of mail on your phone before you retry anything. A background retry loop will re-lock the account the moment it releases, and from the outside that looks like the unlock did not work.</p>
<p>If you can still reach a device that is signed in, reset your password from there — a successful reset clears an attempt lock immediately rather than waiting out the 30 minutes.</p>
<h3>When to raise a request</h3>
<p>Open a <em>Cannot sign in</em> request if any of the following is true:</p>
<ul>
<li>You have waited 30 minutes and the account is still refusing a known-good password.</li>
<li>You no longer have the second factor and no recovery codes.</li>
<li>You were told the hold is administrative.</li>
</ul>
<blockquote>Put the exact error text in the request. "It says my account is locked" and "it says your credentials could not be verified" send the ticket to two different places.</blockquote>`,
    check: [
      {
        id: 'q-al-1', type: 'multi',
        prompt: 'Which lock types clear without IT intervention?',
        options: [
          { id: 'o1', label: 'Ten failed attempts in 15 minutes', correct: true },
          { id: 'o2', label: 'Impossible-travel lock', correct: true },
          { id: 'o3', label: 'Administrative hold', correct: false },
        ],
        explanation: 'Attempt locks time out and travel locks clear on re-verification. An administrative hold is deliberate and needs a human to lift it.',
      },
    ],
  },

  {
    id: KB.SSO_EXPLAINED,
    title: 'Single sign-on at Northwind, explained',
    format: 'article',
    summary: 'What SSO covers, what it does not, and why some apps still ask you to sign in separately.',
    status: 'published',
    audience: 'internal',
    tags: ['security', 'sso', 'access', 'policy'],
    ownerId: USR.PRIYA,
    updatedAt: '2026-05-22T09:15:00Z',
    views: 1985,
    helpfulYes: 174,
    helpfulNo: 18,
    objective: 'After this you can explain which applications are behind SSO, why a few are not, and what a session expiry actually means.',
    minutes: 6,
    prerequisiteIds: [KB.MFA_SETUP],
    body: `<p>Single sign-on means you prove who you are once, to the identity provider, and every connected application trusts that proof. It is not a password vault and it does not copy your password anywhere.</p>
<h3>What is behind SSO today</h3>
<ul>
<li>Mail, calendar and the file store</li>
<li>RelayHQ itself, including the agent workspace</li>
<li>The code host, the CI system and the observability stack</li>
<li>Expenses, payroll self-service and the HR portal</li>
</ul>
<h3>What is not, and why</h3>
<p>Three categories stay outside:</p>
<ul>
<li><strong>Vendor consoles with per-seat billing.</strong> Connecting them to SSO would licence every employee, so we keep them on invited accounts.</li>
<li><strong>Tools with a shared team login.</strong> These are on a migration list; a shared login cannot be attributed to a person, which is why they are being retired.</li>
<li><strong>Anything a customer runs.</strong> Customer storefront admin accounts are their identity system, not ours.</li>
</ul>
<h3>Session expiry is not a bug</h3>
<p>A desktop session lasts 12 hours and a mobile session 30 days. When it expires you get a fresh sign-in prompt, not an error. If you are being prompted several times a day, the usual cause is a browser clearing cookies on close, or a privacy extension blocking the identity provider's cookie.</p>
<blockquote>If an application asks for your Northwind password on a page that is not <code>id.northwind.example</code>, stop and report it. SSO never collects your password anywhere else.</blockquote>`,
    check: [
      {
        id: 'q-sso-1', type: 'boolean',
        prompt: 'SSO stores a copy of your password in each connected application.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'Applications receive a signed assertion that you authenticated. Your password never leaves the identity provider.',
      },
    ],
  },

  /* ================================================================== *
   * Email
   * ================================================================== */
  {
    id: KB.EMAIL_ON_PHONE,
    title: 'Add Northwind mail to your phone',
    format: 'guide',
    summary: 'The supported path on iOS and Android, plus the two settings that stop the battery drain people complain about.',
    status: 'published',
    audience: 'both',
    tags: ['email', 'mobile', 'setup'],
    ownerId: USR.EMMA,
    updatedAt: '2026-07-11T13:25:00Z',
    views: 5233,
    helpfulYes: 402,
    helpfulNo: 77,
    objective: 'After this you can add your Northwind mailbox to a phone using the supported client and configure sync so it does not flatten the battery.',
    minutes: 4,
    prerequisiteIds: [KB.MFA_SETUP],
    slides: [
      {
        id: 'sl-eop-1', type: 'image', seconds: 5,
        url: shot('relay-mail-install'),
        heading: 'Install the supported client',
        caption: 'Use the <strong>Northwind Mail</strong> app from the store. The built-in phone mail app works, but it cannot enforce our device policy, so it will be blocked from new mailboxes in October.',
        alt: 'App store listing for the Northwind Mail application with the Install button visible.',
      },
      {
        id: 'sl-eop-2', type: 'image', seconds: 5,
        url: shot('relay-mail-signin'),
        heading: 'Sign in through SSO',
        caption: 'Enter your work address and let it hand off to <strong>id.northwind.example</strong>. You will be asked for your second factor once per device.',
        alt: 'Mail app sign-in screen redirecting to the Northwind identity provider.',
      },
      {
        id: 'sl-eop-3', type: 'video', seconds: 10,
        url: 'https://cdn.northwind.example/guides/mail-profile-install.mp4',
        heading: 'Approve the device profile',
        caption: 'A 20-second clip of the profile prompt. Approving it is what lets IT wipe <em>only the work mailbox</em> if the phone is lost — personal photos and apps are never touched.',
        alt: 'Screen recording showing the management profile prompt being approved on a phone.',
      },
      {
        id: 'sl-eop-4', type: 'image', seconds: 7,
        url: shot('relay-mail-sync'),
        heading: 'Fix the battery drain before it starts',
        caption: 'Two settings do all the work here:<ul><li>Sync window: <strong>2 weeks</strong>, not All</li><li>Fetch: <strong>Push</strong> for the inbox, manual for every other folder</li></ul>',
        alt: 'Mail sync settings with a two-week sync window and push enabled for the inbox only.',
      },
      {
        id: 'sl-eop-5', type: 'text', seconds: 0,
        heading: 'One thing to check',
        caption: 'Send yourself a test message and confirm the <strong>signature</strong> came across. Mobile signatures are set per device, not per account — see the signature guide.',
      },
    ],
    check: [],
  },

  {
    id: KB.EMAIL_SIGNATURE,
    title: 'Set the standard email signature',
    format: 'guide',
    summary: 'The approved signature block, where to paste it on desktop and mobile, and what is not allowed in it.',
    status: 'draft',
    audience: 'internal',
    tags: ['email', 'brand', 'setup'],
    ownerId: USR.DAVID,
    updatedAt: '2026-08-12T10:02:00Z',
    views: 240,
    helpfulYes: 12,
    helpfulNo: 3,
    objective: 'After this you can apply the approved Northwind signature on every device you send mail from.',
    minutes: 3,
    prerequisiteIds: [],
    slides: [
      {
        id: 'sl-sig-1', type: 'image', seconds: 5,
        url: shot('relay-sig-generator'),
        heading: 'Generate your block',
        caption: 'Open the signature generator on the intranet, confirm your title and pronouns, and copy the result. Do not hand-build it — the spacing is what makes it render correctly in Outlook.',
        alt: 'Signature generator page with name, title and pronoun fields filled in and a Copy button.',
      },
      {
        id: 'sl-sig-2', type: 'image', seconds: 6,
        url: shot('relay-sig-desktop'),
        heading: 'Paste it on desktop',
        caption: 'Settings → Mail → Signatures. Paste with <strong>keep formatting</strong>. Set it for both new messages and replies, otherwise half your thread is unsigned.',
        alt: 'Desktop mail signature settings with the pasted signature block and both dropdowns set.',
      },
      {
        id: 'sl-sig-3', type: 'image', seconds: 6,
        url: shot('relay-sig-mobile'),
        heading: 'And on mobile',
        caption: 'Mobile signatures are stored per device. Use the <em>short</em> variant on phones — name, title, company. The full block with the logo looks broken on a narrow screen.',
        alt: 'Phone mail settings showing the short signature variant applied.',
      },
      {
        id: 'sl-sig-4', type: 'text', seconds: 0,
        heading: 'What is not allowed',
        caption: 'No quotes, no campaign banners that are not from Marketing, no "sent from my phone" tacked underneath the block, and no images other than the supplied logo. Customers see this on every reply.',
      },
    ],
    check: [],
  },

  {
    id: KB.SPAM_QUARANTINE,
    title: 'Release a message from spam quarantine',
    format: 'article',
    summary: 'How the daily digest works, how to release a message safely, and when to report instead of release.',
    status: 'published',
    audience: 'internal',
    tags: ['email', 'security', 'self-service'],
    ownerId: USR.EMMA,
    updatedAt: '2026-06-02T15:45:00Z',
    views: 3110,
    helpfulYes: 288,
    helpfulNo: 30,
    objective: 'After this you can release a legitimate message from quarantine and recognise the ones you should report rather than release.',
    minutes: 3,
    prerequisiteIds: [],
    body: `<p>Northwind holds suspected spam and phishing for 30 days. Nothing is deleted silently — everything held for you appears in the digest.</p>
<h3>The digest</h3>
<p>You get one message each weekday at 07:30 listing everything quarantined in the last 24 hours. Each row has three actions: <strong>Release</strong>, <strong>Release and allow sender</strong>, and <strong>Report</strong>.</p>
<ul>
<li><em>Release</em> delivers this one message and changes nothing else.</li>
<li><em>Release and allow sender</em> also adds the sender to your personal allow list. Use it for newsletters and vendor notifications you actually asked for.</li>
<li><em>Report</em> sends the message to the security team and keeps it quarantined.</li>
</ul>
<h3>Releasing safely</h3>
<p>Check the sending domain, not the display name. <code>billing@northwlnd.example</code> and <code>billing@northwind.example</code> look identical at a glance and only one of them is us.</p>
<p>If a message claims to be from a colleague but was quarantined, that is the system telling you the headers do not match. Confirm on chat before releasing.</p>
<h3>When you cannot release</h3>
<p>Messages classified as <strong>high-confidence phishing</strong> or carrying an executable attachment cannot be released by you. Raise an <em>Email problem</em> request; a mail admin can review and release on your behalf, usually within the hour.</p>`,
    check: [],
  },

  /* ================================================================== *
   * Hardware
   * ================================================================== */
  {
    id: KB.LAPTOP_SETUP,
    title: 'Set up your new laptop on day one',
    format: 'guide',
    summary: 'Unbox to productive in about 40 minutes, in the order that avoids the two most common re-do steps.',
    status: 'published',
    audience: 'internal',
    tags: ['hardware', 'laptop', 'onboarding', 'setup'],
    ownerId: USR.EMMA,
    updatedAt: '2026-08-08T08:30:00Z',
    views: 2740,
    helpfulYes: 261,
    helpfulNo: 14,
    objective: 'After this you can take a new Northwind laptop from the box to a fully enrolled, encrypted, signed-in machine without redoing any step.',
    minutes: 8,
    prerequisiteIds: [],
    slides: [
      {
        id: 'sl-lap-1', type: 'image', seconds: 6,
        url: shot('relay-laptop-box'),
        heading: 'Check the box contents first',
        caption: 'Laptop, charger, dongle, and a card with your <strong>asset tag</strong>. Photograph the asset tag now — you will be asked for it by every request you file for this machine.',
        alt: 'Opened laptop box showing the machine, charger, dongle and an asset tag card.',
      },
      {
        id: 'sl-lap-2', type: 'image', seconds: 7,
        url: shot('relay-laptop-wifi'),
        heading: 'Join a network before signing in',
        caption: 'Use a home network or a phone hotspot. <strong>Do not</strong> join the guest wifi — enrolment cannot complete through the captive portal and you will have to start over.',
        alt: 'Setup assistant network screen with a home network selected and the guest network greyed out.',
      },
      {
        id: 'sl-lap-3', type: 'image', seconds: 7,
        url: shot('relay-laptop-enrol'),
        heading: 'Sign in with your work account',
        caption: 'This triggers automatic enrolment. The machine will restart once on its own. Leave it plugged in — an interrupted enrolment is the number one reason a day-one setup becomes a day-two ticket.',
        alt: 'Enrolment screen showing the Northwind sign-in prompt with a progress indicator.',
      },
      {
        id: 'sl-lap-4', type: 'image', seconds: 6,
        url: shot('relay-laptop-encrypt'),
        heading: 'Save the encryption key',
        caption: 'Disk encryption turns on by itself and escrows the key to IT. You do not need to write it down, but you <em>do</em> need to confirm the screen says <strong>Escrowed</strong> before you close it.',
        alt: 'Disk encryption status panel reading Encrypted and Key escrowed.',
      },
      {
        id: 'sl-lap-5', type: 'image', seconds: 8,
        url: shot('relay-laptop-selfservice'),
        heading: 'Install your apps from Self-Service',
        caption: 'Everything approved for your team is already listed. Install from here rather than downloading installers — Self-Service builds carry our licence keys and update automatically.',
        alt: 'Self-Service application catalog showing approved apps with Install buttons.',
      },
      {
        id: 'sl-lap-6', type: 'text', seconds: 0,
        heading: 'Last two minutes',
        caption: 'Set up <strong>Touch ID or Windows Hello</strong>, then run one software update cycle before you start work. New machines ship a version or two behind.',
      },
    ],
    check: [
      {
        id: 'q-lap-1', type: 'single',
        prompt: 'Which network should you use during first-run enrolment?',
        options: [
          { id: 'o1', label: 'Guest wifi', correct: false },
          { id: 'o2', label: 'A home network or phone hotspot', correct: true },
          { id: 'o3', label: 'It does not matter', correct: false },
        ],
        explanation: 'Guest wifi sits behind a captive portal that enrolment cannot pass, so setup fails partway and has to be restarted.',
      },
    ],
  },

  {
    id: KB.SCREEN_FLICKER,
    title: 'External monitor flickers, blanks or drops out',
    format: 'article',
    summary: 'A cable-first diagnostic ladder that resolves about four in five of these without a hardware swap.',
    status: 'published',
    audience: 'both',
    tags: ['hardware', 'display', 'troubleshooting', 'peripherals'],
    ownerId: USR.DEVON,
    updatedAt: '2026-07-19T12:10:00Z',
    views: 2266,
    helpfulYes: 205,
    helpfulNo: 41,
    objective: 'After this you can work a flickering-display report from cable to dock to driver and know at which rung it becomes a hardware replacement.',
    minutes: 5,
    prerequisiteIds: [],
    body: `<p>Flicker is nearly always a signal problem, not a panel problem. Work the ladder in order; each rung is cheaper than the one below it.</p>
<h3>1. The cable</h3>
<p>Swap the display cable for a known-good one before anything else. A marginal cable produces exactly this symptom: fine at 1080p, flickering at higher resolution or refresh rate. If the flicker stops, you are done.</p>
<h3>2. The dock</h3>
<ul>
<li>Unplug the dock from power for 30 seconds. Docks hold state and a power cycle clears it.</li>
<li>Try the display plugged directly into the laptop. If direct is stable and docked is not, replace the dock, not the monitor.</li>
<li>Check total bandwidth — two 4K displays on a single 60W port will drop one of them under load.</li>
</ul>
<h3>3. Refresh rate and resolution</h3>
<p>Set the display to its native resolution at 60Hz and test again. Some panels advertise a 75Hz mode that only works over one specific input.</p>
<h3>4. The driver</h3>
<p>Update the graphics driver through Self-Service. On docked setups, also update the dock firmware — it is a separate package and it is the step most people miss.</p>
<h3>When to replace</h3>
<p>Escalate to a hardware replacement when the flicker follows the monitor across two known-good cables and two machines, or when there is visible banding or a stuck row of pixels. Attach a short video to the ticket; intermittent flicker is very hard to describe in text and a five-second clip settles it.</p>`,
    check: [],
  },

  {
    id: KB.REQUEST_MONITOR,
    title: 'Requesting a second monitor',
    format: 'article',
    summary: 'What you are entitled to, what needs a manager approval, and how long each path takes.',
    status: 'published',
    audience: 'internal',
    tags: ['hardware', 'peripherals', 'requests', 'policy'],
    ownerId: USR.JAMES,
    updatedAt: '2026-06-27T09:50:00Z',
    views: 1452,
    helpfulYes: 121,
    helpfulNo: 26,
    objective: 'After this you can raise the right monitor request and know before you submit whether it needs approval and what it will cost your team.',
    minutes: 3,
    prerequisiteIds: [],
    body: `<p>Every employee is entitled to one external display. A second one is available but goes through a manager, because it comes out of the team's equipment budget.</p>
<h3>What is standard</h3>
<ul>
<li><strong>27-inch 1440p</strong> — the default, in stock at all sites, ships in 2-3 business days.</li>
<li><strong>27-inch 4K</strong> — for design and video roles, no extra approval if your job function is on the list.</li>
<li><strong>34-inch ultrawide</strong> — counts as two displays for entitlement purposes.</li>
</ul>
<h3>Approval</h3>
<p>Your first display is auto-approved. A second display, or anything above the standard list price of $500, routes to your manager and then to Procurement. Approvals usually clear the same day; the delay is almost always shipping, not sign-off.</p>
<h3>Home office</h3>
<p>Remote employees get the same entitlement shipped to their home address. Put the address in the request rather than in a follow-up comment — a request without a shipping address sits in Procurement waiting, and that wait is invisible to you.</p>
<h3>Returning one</h3>
<p>If you already have a display you are not using, note its asset tag in the request. Reissuing a returned monitor takes two days instead of five and does not touch the budget at all.</p>`,
    check: [],
  },

  {
    id: KB.RETURN_EQUIPMENT,
    title: 'Return Northwind equipment',
    format: 'guide',
    summary: 'Packing, labelling and the wipe confirmation — the three things that decide whether a return closes cleanly.',
    status: 'published',
    audience: 'internal',
    tags: ['hardware', 'returns', 'offboarding', 'assets'],
    ownerId: USR.LINDA,
    updatedAt: '2026-07-02T14:00:00Z',
    views: 1188,
    helpfulYes: 96,
    helpfulNo: 11,
    objective: 'After this you can return a laptop or peripheral so that the asset record closes on the first pass, with no chase from Facilities.',
    minutes: 4,
    prerequisiteIds: [],
    slides: [
      {
        id: 'sl-ret-1', type: 'image', seconds: 6,
        url: shot('relay-return-signout'),
        heading: 'Sign out of everything first',
        caption: 'Sign out of mail, chat and the password manager, then <strong>deregister the device</strong> in Security settings. A device still holding a session cannot be wiped remotely if it goes missing in transit.',
        alt: 'Security settings page with a laptop listed under registered devices and a Deregister button.',
      },
      {
        id: 'sl-ret-2', type: 'image', seconds: 6,
        url: shot('relay-return-pack'),
        heading: 'Pack the whole kit',
        caption: 'Laptop, charger and dongle go back together. A charger returned separately, a week later, is how a return ends up with two open tickets against one asset tag.',
        alt: 'Laptop, charger and dongle packed together in a padded shipping box.',
      },
      {
        id: 'sl-ret-3', type: 'image', seconds: 5,
        url: shot('relay-return-label'),
        heading: 'Write the asset tag on the label',
        caption: 'The prepaid label goes on the outside; the <strong>asset tag</strong> goes on the packing slip inside. Warehouse scans the slip, not the box.',
        alt: 'Prepaid return label applied to a box with a packing slip showing an asset tag.',
      },
      {
        id: 'sl-ret-4', type: 'image', seconds: 6,
        url: shot('relay-return-dropoff'),
        heading: 'Drop it off and keep the receipt',
        caption: 'Any carrier point. Photograph the drop-off receipt and attach it to your return request — that photo is what closes the asset record if the parcel is delayed.',
        alt: 'Carrier drop-off counter with a parcel and a printed receipt.',
      },
      {
        id: 'sl-ret-5', type: 'text', seconds: 0,
        heading: 'What happens next',
        caption: 'The warehouse scans the tag, confirms the <strong>secure wipe</strong>, and moves the asset to <em>In stock</em>. You get one notification when it is received and one when the wipe is verified. If you have not seen both within five business days, reply on the ticket.',
      },
    ],
    check: [],
  },

  /* ================================================================== *
   * Software & licensing
   * ================================================================== */
  {
    id: KB.INSTALL_SOFTWARE,
    title: 'Install approved software from Self-Service',
    format: 'guide',
    summary: 'Where the approved catalog lives, how to request something that is not in it, and why downloaded installers get blocked.',
    status: 'published',
    audience: 'internal',
    tags: ['software', 'self-service', 'setup', 'licensing'],
    ownerId: USR.EMMA,
    updatedAt: '2026-07-24T11:20:00Z',
    views: 3620,
    helpfulYes: 344,
    helpfulNo: 29,
    objective: 'After this you can install any approved application yourself and raise a clean request for anything that is not yet approved.',
    minutes: 4,
    prerequisiteIds: [],
    slides: [
      {
        id: 'sl-inst-1', type: 'image', seconds: 5,
        url: shot('relay-selfservice-open'),
        heading: 'Open Self-Service',
        caption: 'It is already installed on every managed machine. Everything in here is licensed, patched and allowed by policy.',
        alt: 'Self-Service application window showing categorised application tiles.',
      },
      {
        id: 'sl-inst-2', type: 'image', seconds: 6,
        url: shot('relay-selfservice-install'),
        heading: 'Install without a ticket',
        caption: 'Anything with an <strong>Install</strong> button is pre-approved for your role. No approval, no waiting — the licence is assigned to you automatically and released when you uninstall.',
        alt: 'Application detail panel with an Install button and a "Licensed for your role" badge.',
      },
      {
        id: 'sl-inst-3', type: 'image', seconds: 7,
        url: shot('relay-selfservice-request'),
        heading: 'Requesting something new',
        caption: 'Items marked <em>Request</em> need approval. Say what you will use it for and roughly how often — "occasional PDF editing" and "daily production work" get different licence tiers and different answers.',
        alt: 'Software request panel with a justification field and an estimated usage dropdown.',
      },
      {
        id: 'sl-inst-4', type: 'text', seconds: 0,
        heading: 'Why downloads get blocked',
        caption: 'A downloaded installer is unsigned as far as the device policy is concerned, so it is stopped before it runs. It is also, quite often, a licence we already own — check Self-Service before you go looking for a trial.',
      },
    ],
    check: [],
  },

  {
    id: KB.LICENSE_POLICY,
    title: 'Software licensing policy',
    format: 'article',
    summary: 'Who can approve what, how reclaim works, and the rules for personal and open-source tools.',
    status: 'published',
    audience: 'internal',
    tags: ['software', 'licensing', 'policy', 'procurement'],
    ownerId: USR.JAMES,
    updatedAt: '2026-05-30T10:35:00Z',
    views: 1042,
    helpfulYes: 78,
    helpfulNo: 22,
    objective: 'After this you can decide whether a request needs procurement involvement and explain the reclaim rule to someone who has just lost a licence.',
    minutes: 6,
    prerequisiteIds: [KB.INSTALL_SOFTWARE],
    body: `<p>Northwind buys software centrally. The policy exists for two reasons: unmanaged licences cost roughly 30% more per seat, and unmanaged tools hold company data we cannot recover when someone leaves.</p>
<h3>Approval thresholds</h3>
<ul>
<li><strong>Under $500 a year</strong> — manager approval only.</li>
<li><strong>$500 to $5,000</strong> — manager, then Procurement.</li>
<li><strong>Over $5,000</strong> — manager, Procurement, then Finance. Budget for these in the quarterly cycle rather than as a request.</li>
<li><strong>Anything processing customer data</strong> — a security review regardless of price.</li>
</ul>
<h3>Reclaim</h3>
<p>Paid licences that go unused for <strong>60 days</strong> are reclaimed automatically. You get a warning at 45 days and can keep the licence by clicking once in that email. Reclaim is not a punishment; it is why we can approve most new requests same-day.</p>
<h3>Personal and open-source tools</h3>
<p>Free and open-source tools are allowed if they do not touch customer data and are installed from Self-Service or a package manager we manage. A personal licence for a paid tool is not reimbursable after the fact — get the approval first, and Procurement will usually buy it for less than you would pay.</p>
<h3>Renewals</h3>
<p>Renewals are handled by Procurement 60 days before the contract date. If a tool is critical to your team, say so on the renewal ticket when it appears. Silence reads as "not needed" during a cost review.</p>`,
    check: [],
  },

  {
    id: KB.ADOBE_ACTIVATION,
    title: 'Adobe Creative Cloud will not activate',
    format: 'article',
    summary: 'Superseded by the shared-device licensing rollout. Kept for machines that have not migrated yet.',
    status: 'archived',
    audience: 'internal',
    tags: ['software', 'adobe', 'troubleshooting', 'licensing'],
    ownerId: USR.MIKE,
    updatedAt: '2026-04-09T16:40:00Z',
    views: 890,
    helpfulYes: 51,
    helpfulNo: 38,
    objective: 'After this you can recover an activation failure on a pre-migration machine and recognise when the machine simply needs the new licensing package instead.',
    minutes: 4,
    prerequisiteIds: [KB.INSTALL_SOFTWARE],
    body: `<p><strong>This article is archived.</strong> Machines moved to shared-device licensing in June do not hit these errors at all. If the sign-in screen shows the Northwind logo, you are on the new package and this article does not apply — raise a software request instead.</p>
<h3>Error: "You have been signed out"</h3>
<p>The named-user licence has been claimed by another machine. Sign out of Creative Cloud everywhere from the account page, then sign in once on the machine you want to keep.</p>
<h3>Error: "Your trial has expired"</h3>
<p>This is a licence assignment problem, not a trial. Confirm your account appears in the Adobe group in Self-Service; if it does not, the assignment did not sync and Procurement can re-push it.</p>
<h3>Error: code 200.5 or 400.4</h3>
<ul>
<li>Quit every Adobe application, including the background updater.</li>
<li>Clear the OPM cache folder.</li>
<li>Sign in again — the first launch after a cache clear is slow, up to two minutes.</li>
</ul>
<blockquote>If you are reading this because search sent you here, check the <em>Install approved software</em> guide first. Most activation tickets since June have been machines waiting on the new package.</blockquote>`,
    check: [],
  },

  /* ================================================================== *
   * Customer-facing product help — the external help centre
   * ================================================================== */
  {
    id: KB.STOREFRONT_SETUP,
    title: 'Launch your first Northwind storefront',
    format: 'guide',
    summary: 'Domain, theme, tax and a test order — the shortest path from an empty account to something you can take money through.',
    status: 'published',
    audience: 'external',
    tags: ['storefront', 'onboarding', 'setup', 'getting-started'],
    ownerId: USR.LISA,
    updatedAt: '2026-08-11T09:10:00Z',
    views: 12480,
    helpfulYes: 1094,
    helpfulNo: 88,
    objective: 'After this you can create a storefront, connect a domain, apply a theme and place a successful test order.',
    minutes: 9,
    prerequisiteIds: [],
    slides: [
      {
        id: 'sl-sf-1', type: 'image', seconds: 6,
        url: shot('relay-storefront-create'),
        heading: 'Create the storefront',
        caption: 'Name it after the brand your customers know, not your legal entity. The name appears in order confirmations and it is awkward to change once orders exist.',
        alt: 'New storefront dialog with a brand name typed in and a currency selector set to USD.',
      },
      {
        id: 'sl-sf-2', type: 'image', seconds: 7,
        url: shot('relay-storefront-domain'),
        heading: 'Point your domain',
        caption: 'Add the CNAME shown on this screen at your DNS provider. Propagation is usually under an hour but can take a day — <strong>keep building while you wait</strong>, nothing else depends on it.',
        alt: 'Domain settings screen showing a CNAME record to add and a Pending verification badge.',
      },
      {
        id: 'sl-sf-3', type: 'image', seconds: 6,
        url: shot('relay-storefront-theme'),
        heading: 'Pick a theme, then stop',
        caption: 'Choose the closest theme and change only the logo and the two brand colours for now. Deep theme edits before you have real products is the single biggest time sink in onboarding.',
        alt: 'Theme gallery with a selected theme and a brand colour picker open.',
      },
      {
        id: 'sl-sf-4', type: 'image', seconds: 7,
        url: shot('relay-storefront-tax'),
        heading: 'Set tax and shipping',
        caption: 'Pick your tax region and one shipping rate. You can add zones later; you cannot take a legitimate order without at least one of each.',
        alt: 'Tax and shipping settings with a US tax region selected and a flat shipping rate configured.',
      },
      {
        id: 'sl-sf-5', type: 'video', seconds: 12,
        url: 'https://cdn.northwind.example/guides/storefront-test-order.mp4',
        heading: 'Place a test order',
        caption: 'A 40-second walkthrough of a test order end to end. Test mode uses card <code>4242 4242 4242 4242</code> and never charges anyone.',
        alt: 'Screen recording of a test checkout completing and an order confirmation appearing.',
      },
      {
        id: 'sl-sf-6', type: 'text', seconds: 0,
        heading: 'Before you go live',
        caption: 'Three things: switch payments out of test mode, send yourself the order confirmation email and read it as a customer would, and add a support address customers can actually reach.',
      },
    ],
    check: [
      {
        id: 'q-sf-1', type: 'boolean',
        prompt: 'You must wait for domain verification before you can build the rest of the storefront.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'Domain propagation runs in the background. Themes, products, tax and test orders all work on the temporary address.',
      },
    ],
  },

  {
    id: KB.IMPORT_CATALOG,
    title: 'Import your product catalog',
    format: 'guide',
    summary: 'The CSV template, the four columns that cause almost every failed import, and how to fix a bad import safely.',
    status: 'draft',
    audience: 'external',
    tags: ['storefront', 'catalog', 'import', 'getting-started'],
    ownerId: USR.NADIA,
    updatedAt: '2026-08-14T17:30:00Z',
    views: 615,
    helpfulYes: 41,
    helpfulNo: 9,
    objective: 'After this you can import a product catalog from CSV, read the validation report, and roll back a bad import without losing orders.',
    minutes: 7,
    prerequisiteIds: [KB.STOREFRONT_SETUP],
    slides: [
      {
        id: 'sl-imp-1', type: 'image', seconds: 6,
        url: shot('relay-import-template'),
        heading: 'Start from the template',
        caption: 'Download the CSV template rather than mapping your own export. The template has the exact column names the importer expects, and mapping errors are the most common cause of a failed run.',
        alt: 'Import screen with a Download template button and a drop zone for the CSV file.',
      },
      {
        id: 'sl-imp-2', type: 'image', seconds: 8,
        url: shot('relay-import-columns'),
        heading: 'The four columns that matter',
        caption: '<ul><li><strong>sku</strong> — must be unique, and it is your update key</li><li><strong>price</strong> — digits and one dot, no currency symbol</li><li><strong>variant_group</strong> — blank for simple products</li><li><strong>image_url</strong> — publicly reachable, not a shared drive link</li></ul>',
        alt: 'Spreadsheet view highlighting the sku, price, variant_group and image_url columns.',
      },
      {
        id: 'sl-imp-3', type: 'image', seconds: 6,
        url: shot('relay-import-dryrun'),
        heading: 'Always dry-run first',
        caption: 'The dry run validates every row and changes nothing. Fix the rows it flags, then re-upload the same file — the importer is idempotent on <code>sku</code>.',
        alt: 'Dry run results panel listing eleven warnings and two errors with row numbers.',
      },
      {
        id: 'sl-imp-4', type: 'image', seconds: 7,
        url: shot('relay-import-report'),
        heading: 'Read the report properly',
        caption: 'Warnings import; errors do not. A row with a missing image is a warning and will import without a picture — which is worse than failing, so check the warning list before you celebrate.',
        alt: 'Import report showing rows created, rows updated, warnings and errors as separate counts.',
      },
      {
        id: 'sl-imp-5', type: 'text', seconds: 0,
        heading: 'If it went wrong',
        caption: 'Every import gets an id and can be <strong>reverted for 24 hours</strong>. Reverting removes products created by that run and restores the previous values of products it updated. Products with orders against them are never removed — they are unpublished instead.',
      },
    ],
    check: [],
  },

  {
    id: KB.CONNECT_PAYMENTS,
    title: 'Connect a payment provider',
    format: 'guide',
    summary: 'Connect a provider, verify the business, understand the first payout delay, and go live without a surprise.',
    status: 'published',
    audience: 'external',
    tags: ['storefront', 'payments', 'billing', 'getting-started'],
    ownerId: USR.LISA,
    updatedAt: '2026-07-28T13:55:00Z',
    views: 9740,
    helpfulYes: 812,
    helpfulNo: 133,
    objective: 'After this you can connect and verify a payment provider, take a live payment, and explain when the first payout arrives.',
    minutes: 6,
    prerequisiteIds: [KB.STOREFRONT_SETUP],
    slides: [
      {
        id: 'sl-pay-1', type: 'image', seconds: 6,
        url: shot('relay-payments-choose'),
        heading: 'Choose a provider',
        caption: 'Any provider on this screen is a first-class integration — refunds, disputes and payouts all report back into Northwind. Anything connected by generic gateway will work for charges but not for reporting.',
        alt: 'Payment provider gallery with three supported providers and a Connect button on each.',
      },
      {
        id: 'sl-pay-2', type: 'image', seconds: 7,
        url: shot('relay-payments-connect'),
        heading: 'Connect, do not paste keys',
        caption: 'Use the <strong>Connect</strong> flow. It authorises Northwind against your provider account without you handling secret keys, and it can be revoked from either side.',
        alt: 'OAuth-style connect screen granting Northwind access to a payment provider account.',
      },
      {
        id: 'sl-pay-3', type: 'image', seconds: 8,
        url: shot('relay-payments-verify'),
        heading: 'Business verification',
        caption: 'Your provider will ask for a business number and a bank account. This is their requirement, not ours, and it is where onboarding usually stalls — <strong>have the documents ready before you start</strong>.',
        alt: 'Business verification form requesting a registration number, address and bank details.',
      },
      {
        id: 'sl-pay-4', type: 'image', seconds: 7,
        url: shot('relay-payments-payout'),
        heading: 'The first payout is slower',
        caption: 'Providers hold the first payout for <strong>7 to 14 days</strong> as a fraud control. Every payout after that follows your normal schedule. This is the single most common billing question we get, and it is not something Northwind can shorten.',
        alt: 'Payout schedule screen showing a pending first payout with an expected date fourteen days out.',
      },
      {
        id: 'sl-pay-5', type: 'text', seconds: 0,
        heading: 'Go live checklist',
        caption: 'Switch off test mode, place one real low-value order with your own card, confirm it appears in the provider dashboard, then refund it. That round trip proves charges, reporting and refunds in about four minutes.',
      },
    ],
    check: [
      {
        id: 'q-pay-1', type: 'single',
        prompt: 'A customer asks why their first payout has not arrived after four days. What is the correct answer?',
        options: [
          { id: 'o1', label: 'Northwind is holding the funds; raise a billing ticket', correct: false },
          { id: 'o2', label: 'Payment providers hold the first payout 7-14 days as a fraud control', correct: true },
          { id: 'o3', label: 'Their bank details are wrong', correct: false },
        ],
        explanation: 'Northwind never holds funds. The first-payout hold belongs to the provider and applies to every new account.',
      },
    ],
  },

  {
    id: KB.INVOICE_QUESTIONS,
    title: 'Reading your Northwind invoice',
    format: 'article',
    summary: 'What each line means, why proration appears, and how to change who receives the invoice.',
    status: 'published',
    audience: 'external',
    tags: ['billing', 'invoices', 'account'],
    ownerId: USR.MICHAEL,
    updatedAt: '2026-06-14T08:20:00Z',
    views: 7205,
    helpfulYes: 549,
    helpfulNo: 121,
    objective: 'After this you can explain every line on a Northwind invoice, including proration, and update the billing contact.',
    minutes: 5,
    prerequisiteIds: [],
    body: `<p>Invoices are issued on the first of the month for the month ahead, plus anything that changed during the month behind. That mix is why the total rarely matches your plan price exactly.</p>
<h3>The lines you will see</h3>
<ul>
<li><strong>Plan</strong> — your subscription for the coming month, charged in advance.</li>
<li><strong>Seats</strong> — the number of active users on the last day of the previous month.</li>
<li><strong>Proration</strong> — a partial charge or credit for seats added or removed mid-month.</li>
<li><strong>Usage</strong> — anything metered, such as API calls above the plan allowance, charged in arrears.</li>
<li><strong>Tax</strong> — determined by the billing address on the account, not the shipping address on your orders.</li>
</ul>
<h3>Why proration looks strange</h3>
<p>Add five seats on the 20th of a 30-day month and you are charged five seats for ten days, not five seats for a month. Remove seats and you get a credit on the same basis. Credits appear as negative lines rather than as refunds.</p>
<h3>Changing the billing contact</h3>
<p>Settings → Billing → Billing contact. This is separate from the account owner on purpose: most companies want invoices going to Finance and product notices going to an admin.</p>
<h3>If a charge looks wrong</h3>
<p>Raise a <em>Billing question</em> and quote the invoice number and the specific line. Attaching the PDF helps; describing it from memory usually costs a round trip.</p>`,
    check: [],
  },

  {
    id: KB.API_KEYS,
    title: 'Create and rotate API keys',
    format: 'article',
    summary: 'Scopes, rotation without downtime, and what to do the moment a key leaks.',
    status: 'published',
    audience: 'external',
    tags: ['api', 'security', 'integrations', 'developers'],
    ownerId: USR.PRIYA,
    updatedAt: '2026-07-16T10:45:00Z',
    views: 5310,
    helpfulYes: 470,
    helpfulNo: 34,
    objective: 'After this you can issue a scoped API key, rotate it with no downtime, and respond correctly to a leaked key.',
    minutes: 5,
    prerequisiteIds: [],
    body: `<p>API keys authenticate an integration, not a person. Give each integration its own key — one shared key across three systems means you cannot revoke anything without breaking all three.</p>
<h3>Scopes</h3>
<p>Keys are scoped when created and the scope cannot be widened afterwards. Pick the narrowest set that works:</p>
<ul>
<li><code>orders:read</code> — reporting and analytics integrations</li>
<li><code>orders:write</code> — fulfilment systems that update status</li>
<li><code>catalog:write</code> — inventory and pricing sync</li>
<li><code>webhooks:manage</code> — only for tools that register their own endpoints</li>
</ul>
<h3>Rotating without downtime</h3>
<p>Two keys can be live at once, which is what makes zero-downtime rotation possible:</p>
<ul>
<li>Create the new key with the same scopes.</li>
<li>Deploy it to the integration.</li>
<li>Watch the <strong>Last used</strong> timestamp on the old key until it stops moving.</li>
<li>Revoke the old key.</li>
</ul>
<p>Rotate every 90 days, and always when someone with access to the key leaves.</p>
<h3>If a key leaks</h3>
<p>Revoke first, investigate second. A revoked key stops working within seconds and cannot be un-revoked. Then check the key's request log for calls you do not recognise, and raise an <em>Integration help</em> request with the key id — never with the key itself.</p>
<blockquote>The full key value is shown once, at creation. We store a hash, so support genuinely cannot recover it for you.</blockquote>`,
    check: [
      {
        id: 'q-api-1', type: 'single',
        prompt: 'A customer pastes a live API key into a ticket. What do you do first?',
        options: [
          { id: 'o1', label: 'Answer their question, then mention it', correct: false },
          { id: 'o2', label: 'Tell them to revoke the key immediately, then continue', correct: true },
          { id: 'o3', label: 'Delete the comment and say nothing', correct: false },
        ],
        explanation: 'A key in a ticket is a leaked key. Revocation is instant and costless; the conversation can continue after it.',
      },
    ],
  },

  {
    id: KB.WEBHOOK_SETUP,
    title: 'Set up webhooks',
    format: 'guide',
    summary: 'Register an endpoint, verify signatures, and handle retries without processing an event twice.',
    status: 'draft',
    audience: 'external',
    tags: ['api', 'webhooks', 'integrations', 'developers'],
    ownerId: USR.PRIYA,
    updatedAt: '2026-08-15T15:12:00Z',
    views: 302,
    helpfulYes: 19,
    helpfulNo: 2,
    objective: 'After this you can register a webhook endpoint, verify its signature, and make your handler safe against retries.',
    minutes: 8,
    prerequisiteIds: [KB.API_KEYS],
    slides: [
      {
        id: 'sl-wh-1', type: 'image', seconds: 6,
        url: shot('relay-webhook-register'),
        heading: 'Register the endpoint',
        caption: 'Settings → Developers → Webhooks. The endpoint must be <strong>HTTPS</strong> and must answer within 5 seconds. Subscribe only to the events you handle.',
        alt: 'Webhook registration form with an HTTPS endpoint URL and a list of selectable event types.',
      },
      {
        id: 'sl-wh-2', type: 'image', seconds: 7,
        url: shot('relay-webhook-secret'),
        heading: 'Copy the signing secret',
        caption: 'Every delivery carries an HMAC signature in <code>X-Northwind-Signature</code>. Verify it before you trust the payload — an unverified endpoint is an open door.',
        alt: 'Webhook detail screen showing a masked signing secret with a Reveal button.',
      },
      {
        id: 'sl-wh-3', type: 'image', seconds: 8,
        url: shot('relay-webhook-retry'),
        heading: 'Expect retries',
        caption: 'Anything other than a 2xx is retried with backoff for 24 hours. Deliveries can therefore arrive twice — key your handler on <code>event.id</code> and ignore ids you have already processed.',
        alt: 'Delivery log listing one failed attempt followed by successful retries with timestamps.',
      },
      {
        id: 'sl-wh-4', type: 'image', seconds: 6,
        url: shot('relay-webhook-replay'),
        heading: 'Replay while you build',
        caption: 'Any past delivery can be replayed from the log. Build against replays rather than by placing test orders over and over.',
        alt: 'Delivery detail view with the request body shown and a Replay delivery button.',
      },
      {
        id: 'sl-wh-5', type: 'text', seconds: 0,
        heading: 'Before you ship',
        caption: 'Answer <strong>200 immediately</strong> and do the work asynchronously. Endpoints that do their processing inline are the reason most integrations start timing out on a busy day.',
      },
    ],
    check: [],
  },

  /* ================================================================== *
   * Agent enablement — authored as lessons first. The Support Agent
   * curriculum in learning.js composes these atoms directly.
   * ================================================================== */
  {
    id: KB.TRIAGE_BASICS,
    title: 'Triage basics: the first four minutes',
    format: 'article',
    summary: 'How to classify, prioritise and route a new ticket quickly enough that the queue never becomes the problem.',
    status: 'published',
    audience: 'internal',
    tags: ['agent-enablement', 'triage', 'tickets', 'support-agent'],
    ownerId: USR.LISA,
    updatedAt: '2026-08-06T09:05:00Z',
    views: 1860,
    helpfulYes: 203,
    helpfulNo: 9,
    objective: 'After this you can triage an unassigned ticket in under four minutes: classify it, set a defensible priority, route it to the right queue, and set the requester\'s expectation.',
    minutes: 10,
    prerequisiteIds: [],
    body: `<p>Triage is not solving. Triage is deciding, quickly and defensibly, who solves this and by when. A queue with good triage feels calm at twice the volume of a queue without it.</p>
<h3>The four questions</h3>
<ul>
<li><strong>What is it?</strong> Incident (something broken), request (something wanted), or question (something unclear). Guessing here is the root of most misroutes.</li>
<li><strong>Who is affected?</strong> One person, one team, or everyone. This is impact, and impact drives priority far more than tone does.</li>
<li><strong>Can they work?</strong> Blocked entirely, degraded, or inconvenienced. This is urgency.</li>
<li><strong>Who owns it?</strong> The queue whose team can actually resolve it — not the queue that happens to be quiet.</li>
</ul>
<h3>Priority is impact times urgency</h3>
<p>Impact and urgency together give priority. Write it down that way in the ticket and nobody argues with you later:</p>
<ul>
<li><strong>Urgent</strong> — many people blocked, or a customer-facing outage.</li>
<li><strong>High</strong> — one person blocked with no workaround, or a team degraded.</li>
<li><strong>Medium</strong> — degraded with a workaround.</li>
<li><strong>Low</strong> — inconvenience, cosmetic, or a request with a date in the future.</li>
</ul>
<blockquote>"The requester was upset" is not urgency. A VIP with a cosmetic issue is still a low-priority cosmetic issue — handled warmly, and quickly, but not ahead of an outage.</blockquote>
<h3>Route once, route well</h3>
<p>An unrouted ticket falls to the <strong>General</strong> queue, where nobody owns it. That fallback exists so nothing is lost, not as a destination. If you genuinely cannot tell where it belongs, route it to General and say why in a note — the next person then starts from your reasoning instead of from scratch.</p>
<h3>Close the loop before you move on</h3>
<p>Every triaged ticket gets one sentence to the requester: what you have understood, where it has gone, and when they will hear next. Thirty seconds here removes the follow-up message that would otherwise cost you five minutes tomorrow.</p>`,
    check: [
      {
        id: 'q-tb-1', type: 'single',
        prompt: 'A VIP customer reports that a button is the wrong shade of blue. Nobody is blocked. What priority?',
        options: [
          { id: 'o1', label: 'Urgent — they are a VIP', correct: false },
          { id: 'o2', label: 'Low — cosmetic, nobody blocked', correct: true },
          { id: 'o3', label: 'High — VIPs get one level up', correct: false },
        ],
        explanation: 'Priority is impact times urgency. VIP status changes how warmly and how fast you communicate, not what the priority is.',
      },
      {
        id: 'q-tb-2', type: 'multi',
        prompt: 'Which of these belong in a triage note?',
        options: [
          { id: 'o1', label: 'Why you chose this priority', correct: true },
          { id: 'o2', label: 'Why you chose this queue', correct: true },
          { id: 'o3', label: 'Your guess at the root cause, stated as fact', correct: false },
          { id: 'o4', label: 'What the requester has already tried', correct: true },
        ],
        explanation: 'Record decisions and evidence. A guess written as fact sends the next agent down your dead end.',
      },
      {
        id: 'q-tb-3', type: 'boolean',
        prompt: 'The General queue is where a ticket should go when you are not sure who owns it.',
        options: [
          { id: 'o1', label: 'True', correct: true },
          { id: 'o2', label: 'False', correct: false },
        ],
        explanation: 'True, but only with a note explaining what you ruled out. General is a safety net that must never be silent.',
      },
    ],
  },

  {
    id: KB.WRITING_TO_CUSTOMERS,
    title: 'Writing to customers',
    format: 'article',
    summary: 'The four-part reply, the words to drop, and how to say no without sounding like a policy document.',
    status: 'published',
    audience: 'internal',
    tags: ['agent-enablement', 'writing', 'communication', 'support-agent'],
    ownerId: USR.LISA,
    updatedAt: '2026-08-06T09:20:00Z',
    views: 2110,
    helpfulYes: 244,
    helpfulNo: 11,
    objective: 'After this you can write a reply that answers the question first, sets an accurate expectation, and reads like a person wrote it.',
    minutes: 12,
    prerequisiteIds: [],
    body: `<p>Most support writing fails in the same way: it explains the process before it answers the question. Customers read the first two lines carefully and skim the rest, so the answer belongs at the top.</p>
<h3>The four-part reply</h3>
<ul>
<li><strong>Answer.</strong> One or two sentences that resolve the question or state the outcome.</li>
<li><strong>Why.</strong> The minimum context needed to make the answer make sense.</li>
<li><strong>Next.</strong> What happens now, who does it, and by when — with a real date, not "shortly".</li>
<li><strong>Door.</strong> One line that makes it easy to come back.</li>
</ul>
<h3>Words to drop</h3>
<ul>
<li>"Unfortunately" — it front-loads bad news before the reader knows what the news is.</li>
<li>"As per our policy" — nobody has ever felt better after reading it.</li>
<li>"Simply", "just", "obviously" — if it were simple they would not be writing to you.</li>
<li>"I will try to" — either you will or you will not; say which.</li>
</ul>
<h3>Saying no</h3>
<p>A good no has three parts: the decision, the reason in one sentence, and the nearest thing you <em>can</em> do. "We cannot restore a deleted storefront after 30 days. The backups roll off at 30 days by design. What I can do is export everything from the sandbox copy so you keep the product data — want me to start that?"</p>
<h3>Tone matches stakes, not mood</h3>
<p>Match the customer's stakes, not their punctuation. Someone typing in capitals about a checkout outage needs speed and precision, not an apology paragraph. Someone asking a relaxed question about a feature can have a relaxed answer.</p>
<h3>Read it once as the customer</h3>
<p>Before you send, read the first two lines only. If those two lines do not contain the answer, rewrite. That single habit improves reply quality more than any macro library.</p>`,
    check: [
      {
        id: 'q-wtc-1', type: 'single',
        prompt: 'What belongs in the first two lines of a reply?',
        options: [
          { id: 'o1', label: 'An apology for the wait', correct: false },
          { id: 'o2', label: 'The answer or the outcome', correct: true },
          { id: 'o3', label: 'The relevant policy', correct: false },
        ],
        explanation: 'Customers read the top of a reply carefully and skim the rest. Put the answer where it will actually be read.',
      },
      {
        id: 'q-wtc-2', type: 'multi',
        prompt: 'Which parts make up a good "no"?',
        options: [
          { id: 'o1', label: 'The decision, stated plainly', correct: true },
          { id: 'o2', label: 'A one-sentence reason', correct: true },
          { id: 'o3', label: 'The nearest thing you can do instead', correct: true },
          { id: 'o4', label: 'A link to the terms of service', correct: false },
        ],
        explanation: 'Decision, reason, alternative. A terms link is a way of ending the conversation, not answering it.',
      },
      {
        id: 'q-wtc-3', type: 'boolean',
        prompt: 'A customer writing in capitals should get a longer, more apologetic reply.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'Match stakes, not mood. Urgency is answered with speed and precision; length reads as stalling.',
      },
    ],
  },

  {
    id: KB.ESCALATION_PATHS,
    title: 'Escalation paths',
    format: 'article',
    summary: 'The three kinds of escalation, who owns each, and what has to be in the handover.',
    status: 'published',
    audience: 'internal',
    tags: ['agent-enablement', 'escalation', 'process', 'support-agent'],
    ownerId: USR.LISA,
    updatedAt: '2026-08-05T16:40:00Z',
    views: 1622,
    helpfulYes: 188,
    helpfulNo: 12,
    objective: 'After this you can choose the correct escalation path, hand over with everything the receiver needs, and stay accountable for the ticket after you escalate.',
    minutes: 9,
    prerequisiteIds: [KB.TRIAGE_BASICS],
    body: `<p>Escalating is not passing the ticket away. You remain the customer's point of contact until someone explicitly takes that over. Every escalation below assumes that.</p>
<h3>Three kinds, three owners</h3>
<ul>
<li><strong>Technical.</strong> You know what is wrong but cannot fix it. Goes to the owning engineering queue with reproduction steps.</li>
<li><strong>Managerial.</strong> The customer has asked for a manager, or the relationship is at risk. Goes to the team lead, within the hour, with a two-line summary of what has happened so far.</li>
<li><strong>Commercial.</strong> Credits, contract terms, an exception to a policy. Goes to the account owner or Finance — never decided by the agent on the ticket.</li>
</ul>
<h3>What has to be in the handover</h3>
<p>An escalation without these five things comes straight back:</p>
<ul>
<li>What the customer is trying to do, in their words.</li>
<li>What actually happens, with a timestamp and an id or a screenshot.</li>
<li>What you have already ruled out.</li>
<li>The business impact — who is blocked and from what.</li>
<li>What you have told the customer to expect.</li>
</ul>
<h3>When to escalate early</h3>
<p>Escalate before the SLA is in danger, not after. A first response target that is 30 minutes from breaching is already late for an escalation. Also escalate immediately, without working it first, for suspected data loss, suspected security incidents, and anything affecting more than one customer.</p>
<h3>After you escalate</h3>
<p>Update the customer yourself at the interval you promised, even when there is nothing new. "No update yet, still with engineering, I will check again at 4pm" keeps a ticket calm. Silence is what turns a technical escalation into a managerial one.</p>`,
    check: [
      {
        id: 'q-esc-1', type: 'single',
        prompt: 'A customer asks for account credits after an outage. Where does that go?',
        options: [
          { id: 'o1', label: 'Engineering — they caused the outage', correct: false },
          { id: 'o2', label: 'The account owner or Finance — it is a commercial decision', correct: true },
          { id: 'o3', label: 'Decide it yourself if it is under $100', correct: false },
        ],
        explanation: 'Credits are commercial. Agents never grant them, regardless of amount, because it sets a precedent across the account.',
      },
      {
        id: 'q-esc-2', type: 'boolean',
        prompt: 'Once you escalate, the receiving team owns communication with the customer.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'You stay the point of contact until someone explicitly takes it over. Handing the ticket away silently is how customers end up chasing.',
      },
      {
        id: 'q-esc-3', type: 'multi',
        prompt: 'Which situations warrant escalating immediately, before troubleshooting?',
        options: [
          { id: 'o1', label: 'Suspected data loss', correct: true },
          { id: 'o2', label: 'Suspected security incident', correct: true },
          { id: 'o3', label: 'More than one customer affected', correct: true },
          { id: 'o4', label: 'The customer is annoyed', correct: false },
        ],
        explanation: 'The first three change in severity while you investigate. An annoyed customer is handled, not escalated.',
      },
    ],
  },

  {
    id: KB.USING_MACROS,
    title: 'Using macros without sounding like a robot',
    format: 'guide',
    summary: 'Where macros live, the three fields you always edit, and when a macro is the wrong tool.',
    status: 'published',
    audience: 'internal',
    tags: ['agent-enablement', 'macros', 'tooling', 'support-agent'],
    ownerId: USR.DEVON,
    updatedAt: '2026-08-07T11:15:00Z',
    views: 1394,
    helpfulYes: 159,
    helpfulNo: 17,
    objective: 'After this you can apply a macro, personalise it in under 30 seconds, and recognise the cases where a macro will make things worse.',
    minutes: 6,
    prerequisiteIds: [KB.WRITING_TO_CUSTOMERS],
    slides: [
      {
        id: 'sl-mac-1', type: 'image', seconds: 6,
        url: shot('relay-macro-open'),
        heading: 'Find them where you are already typing',
        caption: 'Type <code>/</code> in the reply box. Macros are filtered by the ticket\'s category, so you are seeing the ones that apply, not all 90.',
        alt: 'Reply composer with a slash command open and a filtered list of macro names.',
      },
      {
        id: 'sl-mac-2', type: 'image', seconds: 7,
        url: shot('relay-macro-preview'),
        heading: 'Preview before you insert',
        caption: 'The preview shows the macro with variables already resolved. Check the customer\'s <strong>name and plan</strong> resolved correctly — a macro that greets "Hi ," is worse than no macro.',
        alt: 'Macro preview panel showing resolved customer name, plan and product variables.',
      },
      {
        id: 'sl-mac-3', type: 'image', seconds: 8,
        url: shot('relay-macro-edit'),
        heading: 'Always edit three things',
        caption: '<ul><li>The <strong>first line</strong>, so it answers <em>this</em> question</li><li>Any date or duration, so it is real</li><li>The sign-off, so it is you</li></ul>',
        alt: 'Composer with an inserted macro and the first line being rewritten by the agent.',
      },
      {
        id: 'sl-mac-4', type: 'image', seconds: 6,
        url: shot('relay-macro-actions'),
        heading: 'Macros can do more than text',
        caption: 'Many also set status, priority and tags. Read the action chips under the preview before you send — one of these will close the ticket if you let it.',
        alt: 'Macro preview showing action chips for set status, add tag and assign queue.',
      },
      {
        id: 'sl-mac-5', type: 'text', seconds: 0,
        heading: 'When not to use one',
        caption: 'Do not open with a macro on an angry ticket, a repeat contact about the same issue, or anything involving an apology. Those three all need a human first sentence — the macro can follow underneath.',
      },
    ],
    check: [
      {
        id: 'q-mac-1', type: 'multi',
        prompt: 'Which three parts of a macro should you always personalise?',
        options: [
          { id: 'o1', label: 'The first line', correct: true },
          { id: 'o2', label: 'Any date or duration', correct: true },
          { id: 'o3', label: 'The sign-off', correct: true },
          { id: 'o4', label: 'The knowledge-base link', correct: false },
        ],
        explanation: 'Opening, commitments and sign-off are where a template reads as a template. The linked article is usually fine as-is.',
      },
      {
        id: 'q-mac-2', type: 'boolean',
        prompt: 'It is fine to open an angry customer\'s ticket with a macro.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'An angry customer reads a template as evidence that nobody is listening. Write the first sentence yourself.',
      },
    ],
  },

  {
    id: KB.READING_A_TICKET,
    title: 'How to read a ticket',
    format: 'guide',
    summary: 'A guided tour of the ticket screen: where the truth is, where the noise is, and what to read first.',
    status: 'published',
    audience: 'internal',
    tags: ['agent-enablement', 'tickets', 'tooling', 'support-agent'],
    ownerId: USR.NADIA,
    updatedAt: '2026-08-09T10:30:00Z',
    views: 1720,
    helpfulYes: 198,
    helpfulNo: 8,
    objective: 'After this you can open an unfamiliar ticket and know, within a minute, what happened, who is waiting, and what the next action is.',
    minutes: 7,
    prerequisiteIds: [],
    slides: [
      {
        id: 'sl-rt-1', type: 'image', seconds: 7,
        url: shot('relay-ticket-header'),
        heading: 'Read the header, not the subject',
        caption: 'Requester, organisation, plan and SLA state live in the header. The <strong>subject line is the requester\'s guess</strong> at what is wrong; treat it as a hint, not a diagnosis.',
        alt: 'Ticket header showing requester, organisation, plan badge, priority and SLA countdown.',
      },
      {
        id: 'sl-rt-2', type: 'image', seconds: 8,
        url: shot('relay-ticket-timeline'),
        heading: 'Scan the timeline backwards',
        caption: 'Start at the newest entry and read up until you hit the first message from the customer. That is the shortest path to "what is actually happening now".',
        alt: 'Ticket timeline with public replies, internal notes and system events interleaved.',
      },
      {
        id: 'sl-rt-3', type: 'image', seconds: 7,
        url: shot('relay-ticket-notes'),
        heading: 'Internal notes are not replies',
        caption: 'Notes have a tinted background and never reach the customer. If you are unsure whether something was sent, check the icon rather than the wording — <strong>this is the mistake that costs trust</strong>.',
        alt: 'Timeline entry styled as an internal note with a lock icon and a tinted background.',
      },
      {
        id: 'sl-rt-4', type: 'image', seconds: 7,
        url: shot('relay-ticket-context'),
        heading: 'Use the context rail',
        caption: 'Recent tickets from the same organisation, their assets, and their open changes. A "new" problem that is the third one this week from one customer is a different problem.',
        alt: 'Right-hand context rail listing recent tickets, assets and open changes for the organisation.',
      },
      {
        id: 'sl-rt-5', type: 'image', seconds: 6,
        url: shot('relay-ticket-sla'),
        heading: 'Know which clock is running',
        caption: 'First response and resolution are separate timers, and both pause while the ticket is <em>pending customer</em>. A paused clock is not a stopped obligation.',
        alt: 'SLA panel showing a met first-response target and a running resolution timer.',
      },
      {
        id: 'sl-rt-6', type: 'text', seconds: 0,
        heading: 'One question before you type',
        caption: 'Ask yourself: <strong>who is this ticket waiting on?</strong> If it is waiting on you, act. If it is waiting on the customer, check that they know that. Tickets waiting on nobody are how backlogs form.',
      },
    ],
    check: [
      {
        id: 'q-rat-1', type: 'single',
        prompt: 'What is the most reliable way to tell an internal note from a public reply?',
        options: [
          { id: 'o1', label: 'The wording — notes are less formal', correct: false },
          { id: 'o2', label: 'The lock icon and tinted background on the entry', correct: true },
          { id: 'o3', label: 'Notes always come from agents', correct: false },
        ],
        explanation: 'Read the affordance, not the tone. Assuming from wording is how internal commentary reaches a customer.',
      },
      {
        id: 'q-rat-2', type: 'boolean',
        prompt: 'SLA timers keep running while a ticket is pending on the customer.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'They pause. That is exactly why "pending customer" must never be used as a parking space.',
      },
    ],
  },

  {
    id: KB.SLA_EXPLAINED,
    title: 'SLAs explained: what the clock is actually measuring',
    format: 'article',
    summary: 'First response versus resolution, business hours, pausing, and what to do when a breach is unavoidable.',
    status: 'published',
    audience: 'both',
    tags: ['agent-enablement', 'sla', 'process', 'support-agent'],
    ownerId: USR.ADMIN,
    updatedAt: '2026-08-03T14:15:00Z',
    views: 2405,
    helpfulYes: 231,
    helpfulNo: 19,
    objective: 'After this you can read an SLA panel correctly, explain a target to a customer in plain language, and handle an unavoidable breach without losing the relationship.',
    minutes: 8,
    prerequisiteIds: [KB.READING_A_TICKET],
    body: `<p>An SLA is a promise about response, not a promise about outcome. Understanding exactly what is being measured is what lets you talk about it honestly.</p>
<h3>Two clocks</h3>
<ul>
<li><strong>First response</strong> — from creation until the first public reply from an agent. An auto-acknowledgement does not stop it.</li>
<li><strong>Resolution</strong> — from creation until the ticket is marked resolved. Reopening restarts it.</li>
</ul>
<h3>Business hours</h3>
<p>Internal targets run 09:00-17:00 Central, Monday to Friday. A ticket raised at 16:50 with a one-hour first-response target is due at 09:50 the next working day, not at 17:50. Enterprise customers are on 24/7 for urgent tickets only; everything else follows business hours.</p>
<h3>What pauses the clock</h3>
<ul>
<li><strong>Pending customer</strong> — waiting on information you have explicitly asked for.</li>
<li><strong>Scheduled work</strong> — an agreed maintenance window.</li>
</ul>
<p>What does <em>not</em> pause it: waiting on another internal team, waiting on a vendor, or a queue being busy. Those are our problem, and the target reflects that on purpose.</p>
<h3>Talking about a breach</h3>
<p>When a breach is unavoidable, say so before it happens rather than after. "We are not going to make the four-hour target on this; here is where it stands and here is when I will next update you" preserves the relationship. A silent breach followed by an apology does not.</p>
<blockquote>Never pause a clock by moving a ticket to <em>pending customer</em> when you have not actually asked them for anything. It is visible in the audit trail, and it is the fastest way to lose the team's credibility with an account.</blockquote>`,
    check: [
      {
        id: 'q-sla-1', type: 'single',
        prompt: 'A ticket comes in at 16:50 with a one-hour first-response target under business hours. When is it due?',
        options: [
          { id: 'o1', label: '17:50 the same day', correct: false },
          { id: 'o2', label: '09:50 the next working day', correct: true },
          { id: 'o3', label: '09:00 the next working day', correct: false },
        ],
        explanation: 'Ten minutes elapse before close; the remaining fifty carry into the next working day from 09:00.',
      },
      {
        id: 'q-sla-2', type: 'multi',
        prompt: 'Which of these pause an SLA clock?',
        options: [
          { id: 'o1', label: 'Pending customer, after you asked for information', correct: true },
          { id: 'o2', label: 'An agreed maintenance window', correct: true },
          { id: 'o3', label: 'Waiting on engineering', correct: false },
          { id: 'o4', label: 'The queue being busy', correct: false },
        ],
        explanation: 'Only waits that genuinely belong to the customer or to an agreed schedule pause the clock. Internal waits are ours to own.',
      },
      {
        id: 'q-sla-3', type: 'boolean',
        prompt: 'An automatic acknowledgement email satisfies the first-response target.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'First response means a human reply. Automation confirms receipt; it does not answer anyone.',
      },
    ],
  },

  {
    id: KB.HANDLING_ANGRY,
    title: 'Handling an angry customer',
    format: 'article',
    summary: 'De-escalation that works in writing, the sentences that reliably help, and where the line is.',
    status: 'published',
    audience: 'internal',
    tags: ['agent-enablement', 'de-escalation', 'communication', 'support-agent'],
    ownerId: USR.LISA,
    updatedAt: '2026-08-02T13:05:00Z',
    views: 1988,
    helpfulYes: 240,
    helpfulNo: 7,
    objective: 'After this you can de-escalate a hostile ticket in writing, decide when to hand it to a lead, and finish the day without carrying it home.',
    minutes: 10,
    prerequisiteIds: [KB.WRITING_TO_CUSTOMERS],
    body: `<p>Anger in support is almost always about a loss of control, not about you. The customer cannot fix the thing, does not know when it will be fixed, and has usually already explained it once. Everything below follows from that.</p>
<h3>The order that works</h3>
<ul>
<li><strong>Acknowledge the impact, not the emotion.</strong> "You have had checkout down through your busiest hour" lands. "I understand you are frustrated" reads as a script.</li>
<li><strong>Give back control.</strong> Tell them exactly what happens next and when — a real time, not "as soon as possible".</li>
<li><strong>Do one visible thing immediately.</strong> Even a small confirmed action changes the temperature more than three paragraphs.</li>
<li><strong>Then, and only then, ask questions.</strong> Questions before acknowledgement read as stalling.</li>
</ul>
<h3>Sentences that reliably help</h3>
<ul>
<li>"Here is what I know right now, and here is what I do not."</li>
<li>"I am not going to guess at a time — I will have a real answer for you by 3pm."</li>
<li>"That should not have happened, and I can see why from the log."</li>
<li>"I have asked <em>[name]</em> to look at it directly; I am staying on the ticket."</li>
</ul>
<h3>Do not</h3>
<p>Do not apologise four times — repeated apology reads as helplessness. Do not explain internal process; the customer is not asking how the sausage is made. Do not match their register, and do not defend a colleague in the reply. If a colleague made a mistake, own it as the company and handle it internally.</p>
<h3>Where the line is</h3>
<p>Abuse directed at you personally, slurs, or threats end the conversation. Say once, calmly: "I want to help with this, and I need the conversation to stay respectful. I am going to step away and my team lead will pick this up." Then hand it to a lead. You are not required to absorb abuse, and no manager here expects you to.</p>
<h3>Afterwards</h3>
<p>Post the ticket in the team channel and take ten minutes. A hostile ticket costs something even when you handled it perfectly, and the cost compounds if you go straight into the next one.</p>`,
    check: [
      {
        id: 'q-ha-1', type: 'single',
        prompt: 'What should the first line of a reply to an angry customer do?',
        options: [
          { id: 'o1', label: 'Apologise for the inconvenience', correct: false },
          { id: 'o2', label: 'Acknowledge the concrete impact on them', correct: true },
          { id: 'o3', label: 'Ask for the information you need', correct: false },
        ],
        explanation: 'Naming the actual impact proves you read it. Generic apology and immediate questions both read as deflection.',
      },
      {
        id: 'q-ha-2', type: 'boolean',
        prompt: 'You are expected to continue a conversation that has become personally abusive.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'State the boundary once, hand the ticket to a lead, and step away. This is policy, not a personal judgement call.',
      },
      {
        id: 'q-ha-3', type: 'multi',
        prompt: 'Which of these lower the temperature?',
        options: [
          { id: 'o1', label: 'A specific next-update time', correct: true },
          { id: 'o2', label: 'One visible action taken immediately', correct: true },
          { id: 'o3', label: 'A detailed explanation of the internal escalation process', correct: false },
          { id: 'o4', label: 'Saying what you know and what you do not', correct: true },
        ],
        explanation: 'Control and certainty help. Internal process is noise to someone who just wants their store working.',
      },
    ],
  },

  {
    id: KB.CLOSING_WELL,
    title: 'Closing a ticket well',
    format: 'article',
    summary: 'What a good closing message contains, when not to close, and why the closing note is what makes the queue smarter.',
    status: 'draft',
    audience: 'internal',
    tags: ['agent-enablement', 'closing', 'process', 'support-agent'],
    ownerId: USR.LISA,
    updatedAt: '2026-08-15T18:45:00Z',
    views: 410,
    helpfulYes: 47,
    helpfulNo: 3,
    objective: 'After this you can close a ticket so the customer knows it is done, the next agent learns from it, and it does not reopen.',
    minutes: 7,
    prerequisiteIds: [KB.WRITING_TO_CUSTOMERS, KB.SLA_EXPLAINED],
    body: `<p>Reopened tickets are nearly always closing failures, not solution failures. The fix worked; the close did not explain it, or happened before the customer confirmed.</p>
<h3>What a good close says</h3>
<ul>
<li><strong>What was wrong</strong>, in one sentence and in plain language.</li>
<li><strong>What you did</strong>, specifically enough that they could describe it to a colleague.</li>
<li><strong>What to watch for</strong>, if there is anything.</li>
<li><strong>How to reopen</strong> — replying to the message is enough, and saying so removes a whole class of follow-up ticket.</li>
</ul>
<h3>When not to close</h3>
<ul>
<li>You have not heard back and are assuming it worked. Ask once more, then close with "reply and this reopens".</li>
<li>A workaround is in place but the underlying fault is not fixed. Link a problem record and close against that, or the same issue arrives next week as a new ticket with no history.</li>
<li>Anything the customer has explicitly asked to keep open.</li>
</ul>
<h3>The closing note is for the next agent</h3>
<p>An internal closing note costs 20 seconds and pays for itself the first time this recurs: the actual cause, the thing that misled you, and whether the knowledge base needs updating. If you needed more than 15 minutes and there was no article, say so — that note is where our next atom comes from.</p>
<h3>Tags earn their keep at close</h3>
<p>Tag for the cause, not the symptom. "checkout-timeout" is useful; "urgent" is not, the priority field already says that. Tags set at close are what makes next quarter's trend report worth reading.</p>`,
    check: [
      {
        id: 'q-cw-1', type: 'multi',
        prompt: 'Which belong in a closing message to the customer?',
        options: [
          { id: 'o1', label: 'What was wrong, in plain language', correct: true },
          { id: 'o2', label: 'What you actually did', correct: true },
          { id: 'o3', label: 'How to reopen if it returns', correct: true },
          { id: 'o4', label: 'The internal root-cause analysis', correct: false },
        ],
        explanation: 'The customer needs cause, action and a route back. Internal analysis belongs in the closing note.',
      },
      {
        id: 'q-cw-2', type: 'boolean',
        prompt: 'A ticket with a workaround in place, but no permanent fix, can be closed as long as it is linked to a problem record.',
        options: [
          { id: 'o1', label: 'True', correct: true },
          { id: 'o2', label: 'False', correct: false },
        ],
        explanation: 'The link is what makes it safe. Closing without one loses the history and the issue returns as a brand-new ticket.',
      },
    ],
  },

  /* ================================================================== *
   * Process & policy
   * ================================================================== */
  {
    id: KB.CHANGE_PROCESS,
    title: 'The change process at Northwind',
    format: 'article',
    summary: 'Standard, normal and emergency changes — who approves each, what the windows are, and what a rollback plan must contain.',
    status: 'published',
    audience: 'internal',
    tags: ['change-management', 'process', 'policy', 'itil'],
    ownerId: USR.ADMIN,
    updatedAt: '2026-07-08T09:30:00Z',
    views: 1310,
    helpfulYes: 142,
    helpfulNo: 15,
    objective: 'After this you can classify a change correctly, raise it with everything the approvers need, and know which window it belongs in.',
    minutes: 9,
    prerequisiteIds: [],
    body: `<p>Change management exists to make risky work boring. Three classes, and the class decides the approval path — not the size of the diff.</p>
<h3>Standard</h3>
<p>Pre-approved, repeatable, low risk. Certificate renewals, agreed patch cycles, adding a monitored disk. These are raised for the record and implemented without waiting. If a standard change goes wrong twice, it stops being standard.</p>
<h3>Normal</h3>
<p>Everything else that can be planned. Requires the owning manager plus a peer technical reviewer, and lands in a scheduled window:</p>
<ul>
<li><strong>Tuesday and Thursday, 22:00-02:00 Central</strong> — the standing windows.</li>
<li>Freeze periods: the last week of each quarter and the two weeks around Black Friday.</li>
</ul>
<h3>Emergency</h3>
<p>Restoring service, or preventing an imminent outage. Approved verbally by the on-call lead and recorded within 24 hours with the same detail as a normal change. Emergency is a route, not an excuse — a recurring emergency is a planning failure and gets reviewed as one.</p>
<h3>What every change record needs</h3>
<ul>
<li>What is changing, in one sentence a non-specialist can read.</li>
<li>Blast radius: what breaks if this goes wrong.</li>
<li>A <strong>rollback plan that has been tested</strong>, with how long it takes.</li>
<li>Validation steps — how you will know it worked.</li>
<li>Who is awake during the window and how to reach them.</li>
</ul>
<blockquote>"Roll back the deploy" is not a rollback plan. If the change includes a schema migration, the plan must say what happens to the data written after the migration ran.</blockquote>`,
    check: [
      {
        id: 'q-chg-1', type: 'single',
        prompt: 'An expiring certificate is renewed on the agreed schedule. Which class of change?',
        options: [
          { id: 'o1', label: 'Standard', correct: true },
          { id: 'o2', label: 'Normal', correct: false },
          { id: 'o3', label: 'Emergency', correct: false },
        ],
        explanation: 'Pre-approved, repeatable and low risk. It is raised for the record and implemented without waiting on approval.',
      },
    ],
  },

  {
    id: KB.APPROVAL_THRESHOLDS,
    title: 'Approval thresholds',
    format: 'article',
    summary: 'Who has to say yes at each amount, how delegation works, and what happens when an approval expires.',
    status: 'published',
    audience: 'internal',
    tags: ['approvals', 'policy', 'procurement', 'finance'],
    ownerId: USR.MICHAEL,
    updatedAt: '2026-06-25T15:20:00Z',
    views: 1105,
    helpfulYes: 103,
    helpfulNo: 20,
    objective: 'After this you can predict the approval path for any request before you submit it, and unblock one that has stalled.',
    minutes: 5,
    prerequisiteIds: [],
    body: `<p>Approvals run on amount and on category. The path is computed when the request is submitted and shown on the request itself, so nothing is hidden.</p>
<h3>By amount</h3>
<ul>
<li><strong>Under $500</strong> — the requester's manager only.</li>
<li><strong>$500 to $5,000</strong> — manager, then Procurement.</li>
<li><strong>Over $5,000</strong> — manager, Procurement, then Finance.</li>
<li><strong>Over $25,000</strong> — as above, plus a department head, and it must be in the quarterly plan.</li>
</ul>
<h3>By category, regardless of amount</h3>
<ul>
<li><strong>Access to production systems</strong> — the system owner.</li>
<li><strong>Anything processing customer data</strong> — security review.</li>
<li><strong>New headcount or contractors</strong> — People Ops and Finance.</li>
</ul>
<h3>Delegation</h3>
<p>Approvers can delegate for a fixed period, and the delegation is recorded on the approval so the audit trail stays honest. An approver who is simply unavailable does not silently pass to their manager — a request stalls visibly rather than being auto-approved. That is deliberate.</p>
<h3>Expiry</h3>
<p>An approval step that gets no decision in <strong>five business days</strong> expires and notifies the requester and the approver's manager. Expiry does not reject the request; it escalates it. Re-submitting a request to "start the clock again" is the wrong move — comment on the existing one instead.</p>`,
    check: [
      {
        id: 'q-appr-1', type: 'single',
        prompt: 'A $1,200 software purchase. Who has to approve?',
        options: [
          { id: 'o1', label: 'Manager only', correct: false },
          { id: 'o2', label: 'Manager, then Procurement', correct: true },
          { id: 'o3', label: 'Manager, Procurement, then Finance', correct: false },
        ],
        explanation: 'The $500-$5,000 band adds Procurement. Finance joins above $5,000.',
      },
      {
        id: 'q-appr-2', type: 'boolean',
        prompt: 'If an approver does not respond in five business days the request is automatically approved.',
        options: [
          { id: 'o1', label: 'True', correct: false },
          { id: 'o2', label: 'False', correct: true },
        ],
        explanation: 'It expires and escalates to the approver\'s manager. Nothing is ever approved by silence.',
      },
    ],
  },

  {
    id: KB.ONBOARDING_CHECKLIST,
    title: 'New hire day-one checklist',
    format: 'guide',
    summary: 'What the hiring manager, IT and the new starter each have to do, in the order that actually works.',
    status: 'published',
    audience: 'internal',
    tags: ['onboarding', 'new-hire', 'people-ops', 'process'],
    ownerId: USR.PATTI,
    updatedAt: '2026-08-01T08:45:00Z',
    views: 970,
    helpfulYes: 112,
    helpfulNo: 6,
    objective: 'After this you can run a day one that ends with a new starter who is signed in, equipped, introduced and has something to do on day two.',
    minutes: 6,
    prerequisiteIds: [],
    slides: [
      {
        id: 'sl-onb-1', type: 'image', seconds: 7,
        url: shot('relay-onboard-tminus'),
        heading: 'Ten days before: raise the request',
        caption: 'The <strong>New hire</strong> request drives everything else — account, laptop, licences, building access. Raised late, it is the reason a day one goes wrong; nothing else on this list can start without it.',
        alt: 'New hire request form with start date, job function and equipment bundle selected.',
      },
      {
        id: 'sl-onb-2', type: 'image', seconds: 6,
        url: shot('relay-onboard-kit'),
        heading: 'Three days before: kit staged',
        caption: 'IT stages the laptop and peripherals and marks the asset <em>In transit</em> for remote starters. Check the tracking on day minus one, not on day one.',
        alt: 'Staged laptop, dongle and headset on a desk with an asset tag card.',
      },
      {
        id: 'sl-onb-3', type: 'image', seconds: 7,
        url: shot('relay-onboard-morning'),
        heading: 'Day one morning: sign-in and MFA',
        caption: 'First 90 minutes: sign in, enrol MFA, save recovery codes, join the team channel. Do not schedule anything else in this window — it always takes the full hour and a half.',
        alt: 'New starter completing first sign-in with an MFA enrolment screen open.',
      },
      {
        id: 'sl-onb-4', type: 'image', seconds: 7,
        url: shot('relay-onboard-buddy'),
        heading: 'Day one midday: buddy and tour',
        caption: 'A named buddy, a walk through the tools they will actually use, and lunch with someone. This is the part that gets skipped when the morning overruns, and it is the part people remember.',
        alt: 'Two colleagues at a laptop during an onboarding walkthrough.',
      },
      {
        id: 'sl-onb-5', type: 'image', seconds: 7,
        url: shot('relay-onboard-learning'),
        heading: 'Day one afternoon: enrol in the curriculum',
        caption: 'Enrol them in the curriculum for their job function. For a support agent that is <strong>Support Agent Foundations</strong>, which is built from the same knowledge articles the team uses live.',
        alt: 'Learning enrolment screen showing a curriculum assigned to a new starter.',
      },
      {
        id: 'sl-onb-6', type: 'text', seconds: 0,
        heading: 'End of day one',
        caption: 'They should leave with: a working account, working kit, a buddy\'s name, a curriculum in progress, and <strong>one small real task for day two</strong>. That last one matters more than anything else on this list.',
      },
    ],
    check: [
      {
        id: 'q-onb-1', type: 'single',
        prompt: 'How far ahead of the start date should the New hire request be raised?',
        options: [
          { id: 'o1', label: 'The day before', correct: false },
          { id: 'o2', label: 'Ten days before', correct: true },
          { id: 'o3', label: 'On the start date', correct: false },
        ],
        explanation: 'Accounts, hardware, licences and building access all hang off that request. Ten days is what the slowest of them needs.',
      },
    ],
  },
];
