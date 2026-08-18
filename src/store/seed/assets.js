/**
 * Assets seed — Northwind Systems' hardware estate, software licences, sites
 * and vendor contracts.
 *
 * FOUR COLLECTIONS, ONE DOMAIN
 *   ASSET_MODELS  the catalogue of *kinds* of thing (Snipe-IT's model concept):
 *                 manufacturer, model name, category and the defaults a new
 *                 instance inherits. Models are also where the standing owner
 *                 of a hardware line lives (`managedById`).
 *   ASSETS        instances. Two kinds share the collection because both are
 *                 "things a support request can point at":
 *                   kind: 'hardware' — one physical unit, its own asset tag and
 *                                      serial, assigned to a PERSON or a PLACE.
 *                   kind: 'software' — one licence entitlement, with allocations
 *                                      that consume its seats.
 *   LOCATIONS     region > site hierarchy. Assets roll up through it.
 *   CONTRACTS     vendor paper. Contracts cover assets and licences, and carry
 *                 the renewal/notice dates that drive the renewal panel.
 *
 * THE OWNERSHIP DISTINCTION THIS SEED EXISTS TO PROVE
 *   assignedToId / locationId  — who or where USES the thing
 *   managedById                — who is RESPONSIBLE for it
 * They genuinely differ: the Chicago copy-room printer is used by everyone at
 * the site and owned by Facilities, not IT. Where an asset does not override
 * `managedById`, it inherits the model's.
 *
 * The demo clock is 2026-08-16. Dates below are chosen against it so that the
 * warranty, renewal and compliance screens all have real findings.
 */

import { LOC, USR, CAT, MDL, LIC } from './ids.js';

/* Region nodes are location-internal — nothing outside this domain references
 * them, so they are not in ids.js. The sites themselves always use LOC ids. */
const REGION_MIDWEST = 'loc-region-midwest';
const REGION_EAST = 'loc-region-east';
const REGION_SOUTH = 'loc-region-south';

/* Contract ids are referenced by licences and by assets in this same file. */
const CTR = {
  MSFT_EA:      'ctr-msft-ea',
  ADOBE_VIP:    'ctr-adobe-vip',
  SALESFORCE:   'ctr-salesforce',
  SLACK:        'ctr-slack',
  ATLASSIAN:    'ctr-atlassian',
  ZOOM:         'ctr-zoom',
  CROWDSTRIKE:  'ctr-crowdstrike',
  VMWARE:       'ctr-vmware',
  CISCO_SMARTNET: 'ctr-cisco-smartnet',
  DELL_PROSUPPORT: 'ctr-dell-prosupport',
  APPLECARE:    'ctr-applecare',
  VERIZON:      'ctr-verizon',
  COLO:         'ctr-colo-elk-grove',
};

/* Catalog links. Every asset points at the catalog nodes a support request for
 * it would start from, so a ticket traces back to the physical or licensed
 * thing behind it. */
const CI_LAPTOP = [CAT.I_LAPTOP_ISSUE, CAT.I_NEW_LAPTOP];
const CI_DEVICE = ['cat-i-monitor', 'cat-i-desk-accessories'];
const CI_SOFTWARE = [CAT.I_SOFTWARE_REQ, 'cat-i-new-license'];

/* ------------------------------------------------------------------ *
 * Locations — region > site
 * ------------------------------------------------------------------ */

export const LOCATIONS = [
  {
    id: REGION_MIDWEST, name: 'Midwest Region', type: 'region', parentId: null,
    address: 'Illinois', timezone: 'America/Chicago', siteLeadId: USR.ADMIN,
    notes: 'Head office plus the two Illinois facilities.',
  },
  {
    id: LOC.CHI, name: 'Chicago HQ', type: 'office', parentId: REGION_MIDWEST,
    address: '210 N Wacker Dr, Floors 3–5, Chicago, IL 60606',
    timezone: 'America/Chicago', siteLeadId: USR.LINDA, seats: 180,
    notes: 'Head office. Floors 3–5, hot-desking on 4.',
  },
  {
    id: LOC.DC1, name: 'Elk Grove Data Center', type: 'datacenter', parentId: REGION_MIDWEST,
    address: '1400 Busse Rd, Cage 14B, Elk Grove Village, IL 60007',
    timezone: 'America/Chicago', siteLeadId: USR.PRIYA, seats: 0,
    notes: 'Two cabinets in cage 14B. Badge access via the colocation provider.',
  },
  {
    id: LOC.WAREHOUSE, name: 'Bolingbrook Warehouse', type: 'warehouse', parentId: REGION_MIDWEST,
    address: '755 Remington Blvd, Unit C, Bolingbrook, IL 60440',
    timezone: 'America/Chicago', siteLeadId: USR.JAMES, seats: 6,
    notes: 'Receiving, imaging and the spare pool. Unassigned stock lives here.',
  },
  {
    id: REGION_EAST, name: 'East Region', type: 'region', parentId: null,
    address: 'New York', timezone: 'America/New_York', siteLeadId: USR.DAVID,
    notes: 'Product, design and marketing.',
  },
  {
    id: LOC.NYC, name: 'New York Office', type: 'office', parentId: REGION_EAST,
    address: '85 Broad St, Suite 1120, New York, NY 10004',
    timezone: 'America/New_York', siteLeadId: USR.JEN, seats: 64,
    notes: 'Product and creative teams.',
  },
  {
    id: REGION_SOUTH, name: 'South Region', type: 'region', parentId: null,
    address: 'Texas', timezone: 'America/Chicago', siteLeadId: USR.LISA,
    notes: 'Customer support operations.',
  },
  {
    id: LOC.AUS, name: 'Austin Support Center', type: 'office', parentId: REGION_SOUTH,
    address: '1100 E 5th St, Building 2, Austin, TX 78702',
    timezone: 'America/Chicago', siteLeadId: USR.LISA, seats: 90,
    notes: 'The support floor. Highest device churn of any site.',
  },
  {
    id: LOC.REMOTE, name: 'Remote / Home Office', type: 'remote', parentId: null,
    address: 'Distributed — no fixed address',
    timezone: 'America/Chicago', siteLeadId: null, seats: 0,
    notes: 'Home-based staff. Shipping goes direct from Bolingbrook.',
  },
];

/* ------------------------------------------------------------------ *
 * Asset models
 * ------------------------------------------------------------------ */

export const ASSET_MODELS = [
  {
    id: MDL.MBP14, manufacturer: 'Apple', name: 'MacBook Pro 14" (M3 Pro)',
    category: 'laptop', managedById: USR.EMMA, eol: '2028-06-30',
    defaults: { vendor: 'CDW', cost: 2399, warrantyMonths: 36, refreshYears: 3 },
    notes: 'Standard issue for engineering, design and leadership.',
  },
  {
    id: MDL.MBP16, manufacturer: 'Apple', name: 'MacBook Pro 16" (M3 Max)',
    category: 'laptop', managedById: USR.EMMA, eol: '2028-06-30',
    defaults: { vendor: 'CDW', cost: 3499, warrantyMonths: 36, refreshYears: 3 },
    notes: 'Exception build — requires a manager approval on the request form.',
  },
  {
    id: MDL.LAT7440, manufacturer: 'Dell', name: 'Latitude 7440',
    category: 'laptop', managedById: USR.EMMA, eol: '2027-12-31',
    defaults: { vendor: 'Dell Technologies', cost: 1749, warrantyMonths: 36, refreshYears: 4 },
    notes: 'Standard Windows build. Covered by Dell ProSupport Plus.',
  },
  {
    id: MDL.X1C11, manufacturer: 'Lenovo', name: 'ThinkPad X1 Carbon Gen 11',
    category: 'laptop', managedById: USR.EMMA, eol: '2027-06-30',
    defaults: { vendor: 'Insight', cost: 1899, warrantyMonths: 36, refreshYears: 4 },
    notes: 'Legacy standard — being phased out in favour of the Latitude.',
  },
  {
    id: MDL.IPHONE15, manufacturer: 'Apple', name: 'iPhone 15 Pro (256GB)',
    category: 'phone', managedById: USR.EMMA, eol: '2029-09-30',
    defaults: { vendor: 'Verizon Business', cost: 1099, warrantyMonths: 18, refreshYears: 3 },
    notes: 'Issued to on-call, field sales and leadership only.',
  },
  {
    id: MDL.U2723, manufacturer: 'Dell', name: 'UltraSharp U2723QE 27"',
    category: 'monitor', managedById: USR.EMMA, eol: '2030-01-01',
    defaults: { vendor: 'Dell Technologies', cost: 579, warrantyMonths: 36, refreshYears: 6 },
    notes: 'One per desk; hot-desk banks get two.',
  },
  {
    id: MDL.C9300, manufacturer: 'Cisco', name: 'Catalyst 9300-24T',
    category: 'network', managedById: USR.PRIYA, eol: '2031-04-30',
    defaults: { vendor: 'Presidio', cost: 6850, warrantyMonths: 44, refreshYears: 7 },
    notes: 'Top-of-rack switching in Elk Grove. SmartNet covered.',
  },
  {
    id: MDL.MR46, manufacturer: 'Cisco Meraki', name: 'MR46 Access Point',
    category: 'network', managedById: USR.PRIYA, eol: '2030-09-30',
    defaults: { vendor: 'Presidio', cost: 1299, warrantyMonths: 36, refreshYears: 6 },
    notes: 'Site wireless. Licence is bundled with the hardware term.',
  },
  {
    id: MDL.M479, manufacturer: 'HP', name: 'Color LaserJet Pro M479fdw',
    category: 'printer', managedById: USR.LINDA, eol: '2029-12-31',
    defaults: { vendor: 'CDW', cost: 749, warrantyMonths: 12, refreshYears: 5 },
    notes: 'Facilities owns print. IT owns the driver package only.',
  },
  {
    id: MDL.R650, manufacturer: 'Dell', name: 'PowerEdge R650',
    category: 'server', managedById: USR.PRIYA, eol: '2030-06-30',
    defaults: { vendor: 'Dell Technologies', cost: 12400, warrantyMonths: 36, refreshYears: 5 },
    notes: 'vSphere hosts. Two CPU sockets each — licence position tracks sockets.',
  },
  {
    id: MDL.IPAD, manufacturer: 'Apple', name: 'iPad Air 11" (M2)',
    category: 'tablet', managedById: USR.EMMA, eol: '2029-06-30',
    defaults: { vendor: 'CDW', cost: 799, warrantyMonths: 24, refreshYears: 4 },
    notes: 'Shared devices — receiving scanner, facilities walkthroughs.',
  },
];

/* ------------------------------------------------------------------ *
 * History helper
 *
 * Every movement of an asset appends an event: who did it, when, and where it
 * went. The detail view renders this as the chain of custody.
 * ------------------------------------------------------------------ */

let hseq = 0;
function hev(at, action, byId, toType, toId, note) {
  hseq += 1;
  return { id: `hev-${hseq}`, at, action, byId, toType, toId, note };
}

function hw(o) {
  return {
    kind: 'hardware',
    assignmentType: null,
    assignedToId: null,
    locationId: null,
    managedById: null,
    notes: '',
    catalogItemIds: CI_DEVICE,
    contractId: null,
    history: [],
    ...o,
  };
}

/* ------------------------------------------------------------------ *
 * Software licence helper — seatsAssigned is NEVER stored. It is derived from
 * `allocations` wherever it is displayed, so the two can never disagree.
 * ------------------------------------------------------------------ */

let alseq = 0;
function alloc(type, id, seats, since, note) {
  alseq += 1;
  return {
    id: `alc-${alseq}`,
    type,
    personId: type === 'person' ? id : null,
    locationId: type === 'location' ? id : null,
    seats,
    since,
    note,
  };
}

function sw(o) {
  return {
    kind: 'software',
    status: 'deployed',
    licenseModel: 'per_seat',
    contractType: 'subscription',
    seatsOwned: null,
    costPerSeat: null,
    contractId: null,
    managedById: USR.JAMES,
    catalogItemIds: CI_SOFTWARE,
    allocations: [],
    notes: '',
    ...o,
  };
}

/* ------------------------------------------------------------------ *
 * Hardware — 38 instances
 * ------------------------------------------------------------------ */

const HARDWARE = [
  /* --- Apple laptops, NYC product + design --- */
  hw({
    id: 'ast-lt-0142', assetTag: 'NW-LT-0142', serial: 'C02XK9QLMD6T', modelId: MDL.MBP16,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.MIKE, locationId: LOC.NYC,
    purchaseDate: '2024-03-12', cost: 3499, vendor: 'CDW', warrantyExpires: '2027-03-12',
    poNumber: 'PO-2024-0311', contractId: CTR.APPLECARE, catalogItemIds: CI_LAPTOP,
    notes: '16" exception build approved by Jennifer Lopez for Figma prototyping.',
    history: [
      hev('2024-03-19', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from CDW against PO-2024-0311, imaged.'),
      hev('2024-03-22', 'checkout', USR.EMMA, 'person', USR.MIKE, 'Shipped to New York, signed for at reception.'),
    ],
  }),
  hw({
    id: 'ast-lt-0143', assetTag: 'NW-LT-0143', serial: 'C02XK9QLMF8W', modelId: MDL.MBP16,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.JEN, locationId: LOC.NYC,
    purchaseDate: '2024-03-12', cost: 3499, vendor: 'CDW', warrantyExpires: '2027-03-12',
    poNumber: 'PO-2024-0311', contractId: CTR.APPLECARE, catalogItemIds: CI_LAPTOP,
    history: [
      hev('2024-03-19', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from CDW against PO-2024-0311, imaged.'),
      hev('2024-03-22', 'checkout', USR.EMMA, 'person', USR.JEN, 'Shipped to New York.'),
    ],
  }),
  hw({
    id: 'ast-lt-0151', assetTag: 'NW-LT-0151', serial: 'C02ZR7TXN91K', modelId: MDL.MBP14,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.LISA, locationId: LOC.AUS,
    purchaseDate: '2024-06-04', cost: 2399, vendor: 'CDW', warrantyExpires: '2027-06-04',
    poNumber: 'PO-2024-0587', contractId: CTR.APPLECARE, catalogItemIds: CI_LAPTOP,
    history: [
      hev('2024-06-11', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received and imaged.'),
      hev('2024-06-14', 'checkout', USR.EMMA, 'person', USR.LISA, 'Support lead refresh.'),
    ],
  }),
  hw({
    id: 'ast-lt-0158', assetTag: 'NW-LT-0158', serial: 'C02WD5KJP0YR', modelId: MDL.MBP14,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.SAM, locationId: LOC.AUS,
    purchaseDate: '2026-06-22', cost: 2399, vendor: 'CDW', warrantyExpires: '2029-06-22',
    poNumber: 'PO-2026-0219', contractId: CTR.APPLECARE, catalogItemIds: CI_LAPTOP,
    notes: 'Day-one kit for the June support cohort.',
    history: [
      hev('2026-06-29', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from CDW, imaged with the support build.'),
      hev('2026-07-01', 'checkout', USR.EMMA, 'person', USR.SAM, 'New hire kit issued at Austin onboarding.'),
    ],
  }),
  /* --- Dell / Lenovo fleet --- */
  hw({
    id: 'ast-lt-0163', assetTag: 'NW-LT-0163', serial: '7QK4LM3', modelId: MDL.LAT7440,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.DEVON, locationId: LOC.AUS,
    purchaseDate: '2023-11-02', cost: 1749, vendor: 'Dell Technologies', warrantyExpires: '2026-11-02',
    poNumber: 'PO-2023-0912', contractId: CTR.DELL_PROSUPPORT, catalogItemIds: CI_LAPTOP,
    notes: 'Warranty ends inside the ProSupport renewal window — quote both together.',
    history: [
      hev('2023-11-09', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received against PO-2023-0912.'),
      hev('2023-11-13', 'checkout', USR.EMMA, 'person', USR.DEVON, 'Issued at Austin onboarding.'),
      hev('2025-04-08', 'repair', USR.EMMA, 'vendor', null, 'Battery swap under ProSupport, returned in 4 days.'),
    ],
  }),
  hw({
    id: 'ast-lt-0164', assetTag: 'NW-LT-0164', serial: '7QK4LN8', modelId: MDL.LAT7440,
    status: 'in_repair', assignmentType: 'person', assignedToId: USR.NADIA, locationId: LOC.REMOTE,
    purchaseDate: '2023-11-02', cost: 1749, vendor: 'Dell Technologies', warrantyExpires: '2026-11-02',
    poNumber: 'PO-2023-0912', contractId: CTR.DELL_PROSUPPORT, catalogItemIds: CI_LAPTOP,
    notes: 'Left hinge cracked. At the Dell depot since 11 Aug; loaner NW-LT-0187 not yet issued.',
    history: [
      hev('2023-11-09', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received against PO-2023-0912.'),
      hev('2023-11-13', 'checkout', USR.EMMA, 'person', USR.NADIA, 'Shipped to home address.'),
      hev('2026-08-11', 'repair', USR.EMMA, 'vendor', null, 'Collected by Dell depot — hinge and lid assembly.'),
    ],
  }),
  hw({
    id: 'ast-lt-0170', assetTag: 'NW-LT-0170', serial: 'PF3ZK9QA', modelId: MDL.X1C11,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.PRIYA, locationId: LOC.AUS,
    purchaseDate: '2024-08-19', cost: 1899, vendor: 'Insight', warrantyExpires: '2027-08-19',
    poNumber: 'PO-2024-0703', catalogItemIds: CI_LAPTOP,
    history: [
      hev('2024-08-26', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from Insight.'),
      hev('2024-08-28', 'checkout', USR.EMMA, 'person', USR.PRIYA, 'Engineering build.'),
    ],
  }),
  hw({
    id: 'ast-lt-0171', assetTag: 'NW-LT-0171', serial: 'PF3ZK9RB', modelId: MDL.X1C11,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.TOM, locationId: LOC.REMOTE,
    purchaseDate: '2024-08-19', cost: 1899, vendor: 'Insight', warrantyExpires: '2027-08-19',
    poNumber: 'PO-2024-0703', catalogItemIds: CI_LAPTOP,
    history: [
      hev('2024-08-26', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from Insight.'),
      hev('2024-09-02', 'checkout', USR.EMMA, 'person', USR.TOM, 'Shipped to home address, Dallas.'),
    ],
  }),
  hw({
    id: 'ast-lt-0177', assetTag: 'NW-LT-0177', serial: 'C02VG8HHQ1M9', modelId: MDL.MBP14,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.ADMIN, locationId: LOC.CHI,
    purchaseDate: '2025-01-15', cost: 2399, vendor: 'CDW', warrantyExpires: '2028-01-15',
    poNumber: 'PO-2025-0022', contractId: CTR.APPLECARE, catalogItemIds: CI_LAPTOP,
    history: [
      hev('2025-01-22', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Q1 refresh batch, 9 units.'),
      hev('2025-01-24', 'checkout', USR.EMMA, 'person', USR.ADMIN, 'Refresh — old unit NW-LT-0129 returned.'),
    ],
  }),
  hw({
    id: 'ast-lt-0180', assetTag: 'NW-LT-0180', serial: 'C02TF6LKR3P2', modelId: MDL.MBP14,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.EMMA, locationId: LOC.CHI,
    purchaseDate: '2025-01-15', cost: 2399, vendor: 'CDW', warrantyExpires: '2028-01-15',
    poNumber: 'PO-2025-0022', contractId: CTR.APPLECARE, catalogItemIds: CI_LAPTOP,
    history: [
      hev('2025-01-22', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Q1 refresh batch, 9 units.'),
      hev('2025-01-24', 'checkout', USR.ADMIN, 'person', USR.EMMA, 'Refresh.'),
    ],
  }),
  hw({
    id: 'ast-lt-0181', assetTag: 'NW-LT-0181', serial: 'C02TF6LKR9J4', modelId: MDL.MBP14,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.MICHAEL, locationId: LOC.CHI,
    purchaseDate: '2025-01-15', cost: 2399, vendor: 'CDW', warrantyExpires: '2028-01-15',
    poNumber: 'PO-2025-0022', contractId: CTR.APPLECARE, catalogItemIds: CI_LAPTOP,
    history: [
      hev('2025-01-22', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Q1 refresh batch, 9 units.'),
      hev('2025-01-27', 'checkout', USR.EMMA, 'person', USR.MICHAEL, 'Finance refresh.'),
    ],
  }),
  hw({
    id: 'ast-lt-0184', assetTag: 'NW-LT-0184', serial: '8RM2PQ4', modelId: MDL.LAT7440,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.PATTI, locationId: LOC.CHI,
    purchaseDate: '2025-08-11', cost: 1749, vendor: 'Dell Technologies', warrantyExpires: '2028-08-11',
    poNumber: 'PO-2025-0455', contractId: CTR.DELL_PROSUPPORT, catalogItemIds: CI_LAPTOP,
    history: [
      hev('2025-08-18', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received against PO-2025-0455.'),
      hev('2025-08-20', 'checkout', USR.EMMA, 'person', USR.PATTI, 'People Ops refresh.'),
    ],
  }),
  /* --- Stock at Bolingbrook — the unassigned pool --- */
  hw({
    id: 'ast-lt-0185', assetTag: 'NW-LT-0185', serial: '8RM2PQ7', modelId: MDL.LAT7440,
    status: 'in_stock', assignmentType: null, assignedToId: null, locationId: LOC.WAREHOUSE,
    purchaseDate: '2026-05-30', cost: 1749, vendor: 'Dell Technologies', warrantyExpires: '2029-05-30',
    poNumber: 'PO-2026-0177', contractId: CTR.DELL_PROSUPPORT, catalogItemIds: CI_LAPTOP,
    notes: 'Imaged and shelved. Reserved for the September support cohort.',
    history: [
      hev('2026-06-05', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received against PO-2026-0177, 3 units.'),
    ],
  }),
  hw({
    id: 'ast-lt-0186', assetTag: 'NW-LT-0186', serial: '8RM2PQ9', modelId: MDL.LAT7440,
    status: 'in_stock', assignmentType: null, assignedToId: null, locationId: LOC.WAREHOUSE,
    purchaseDate: '2026-05-30', cost: 1749, vendor: 'Dell Technologies', warrantyExpires: '2029-05-30',
    poNumber: 'PO-2026-0177', contractId: CTR.DELL_PROSUPPORT, catalogItemIds: CI_LAPTOP,
    history: [
      hev('2026-06-05', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received against PO-2026-0177, 3 units.'),
    ],
  }),
  hw({
    id: 'ast-lt-0187', assetTag: 'NW-LT-0187', serial: 'PF4TR2LC', modelId: MDL.X1C11,
    status: 'in_stock', assignmentType: null, assignedToId: null, locationId: LOC.WAREHOUSE,
    purchaseDate: '2026-07-08', cost: 1899, vendor: 'Insight', warrantyExpires: '2029-07-08',
    poNumber: 'PO-2026-0301', catalogItemIds: CI_LAPTOP,
    notes: 'Held as the loaner unit. Should have gone out to Nadia Haddad on 11 Aug.',
    history: [
      hev('2026-07-15', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from Insight, imaged as a loaner.'),
    ],
  }),
  /* --- End of life and incidents --- */
  hw({
    id: 'ast-lt-0129', assetTag: 'NW-LT-0129', serial: 'C02QQ1ZZK8DL', modelId: MDL.MBP14,
    status: 'retired', assignmentType: null, assignedToId: null, locationId: LOC.WAREHOUSE,
    purchaseDate: '2021-09-14', cost: 2199, vendor: 'CDW', warrantyExpires: '2024-09-14',
    poNumber: 'PO-2021-0708', catalogItemIds: CI_LAPTOP,
    notes: 'Wiped and staged for certified e-waste. Awaiting the quarterly pickup.',
    history: [
      hev('2021-09-21', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received against PO-2021-0708.'),
      hev('2021-09-24', 'checkout', USR.EMMA, 'person', USR.ADMIN, 'Issued to Alex Rivera.'),
      hev('2025-01-24', 'checkin', USR.EMMA, 'location', LOC.WAREHOUSE, 'Returned at refresh, wiped and verified.'),
      hev('2025-02-03', 'retire', USR.JAMES, 'location', LOC.WAREHOUSE, 'Marked retired — battery service limit reached.'),
    ],
  }),
  hw({
    id: 'ast-lt-0138', assetTag: 'NW-LT-0138', serial: 'PF2MK7WD', modelId: MDL.X1C11,
    status: 'lost', assignmentType: 'person', assignedToId: USR.SARAH, locationId: LOC.NYC,
    purchaseDate: '2023-05-03', cost: 1899, vendor: 'Insight', warrantyExpires: '2026-05-03',
    poNumber: 'PO-2023-0402', catalogItemIds: CI_LAPTOP,
    notes: 'Reported stolen from checked luggage 28 Jul. Police report filed, remote wipe confirmed, disk was encrypted.',
    history: [
      hev('2023-05-10', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from Insight.'),
      hev('2023-05-12', 'checkout', USR.EMMA, 'person', USR.SARAH, 'Marketing build.'),
      hev('2026-07-29', 'lost', USR.EMMA, 'person', USR.SARAH, 'Reported stolen. Remote wipe issued and confirmed.'),
    ],
  }),
  hw({
    id: 'ast-lt-0190', assetTag: 'NW-LT-0190', serial: 'C02UU4XPQ7RF', modelId: MDL.MBP14,
    status: 'in_transit', assignmentType: 'person', assignedToId: USR.SARAH, locationId: LOC.NYC,
    purchaseDate: '2026-08-03', cost: 2399, vendor: 'CDW', warrantyExpires: '2029-08-03',
    poNumber: 'PO-2026-0338', contractId: CTR.APPLECARE, catalogItemIds: CI_LAPTOP,
    notes: 'Replacement for the stolen NW-LT-0138. In transit to the New York office.',
    history: [
      hev('2026-08-10', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Expedited replacement received and imaged.'),
      hev('2026-08-14', 'checkout', USR.EMMA, 'person', USR.SARAH, 'Shipped to New York — tracking 1Z999AA10123456784.'),
    ],
  }),
  /* --- Phones --- */
  hw({
    id: 'ast-ph-0044', assetTag: 'NW-PH-0044', serial: '356789104512345', modelId: MDL.IPHONE15,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.LISA, locationId: LOC.AUS,
    purchaseDate: '2025-02-10', cost: 1099, vendor: 'Verizon Business', warrantyExpires: '2026-08-30',
    poNumber: 'PO-2025-0071', contractId: CTR.VERIZON,
    notes: 'On-call handset for the support escalation rota.',
    history: [
      hev('2025-02-14', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Activated on the Verizon business account.'),
      hev('2025-02-17', 'checkout', USR.EMMA, 'person', USR.LISA, 'Support escalation rota.'),
    ],
  }),
  hw({
    id: 'ast-ph-0047', assetTag: 'NW-PH-0047', serial: '356789104598877', modelId: MDL.IPHONE15,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.ROBERT, locationId: LOC.CHI,
    purchaseDate: '2025-02-10', cost: 1099, vendor: 'Verizon Business', warrantyExpires: '2026-08-30',
    poNumber: 'PO-2025-0071', contractId: CTR.VERIZON,
    history: [
      hev('2025-02-14', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Activated on the Verizon business account.'),
      hev('2025-02-18', 'checkout', USR.EMMA, 'person', USR.ROBERT, 'Field sales handset.'),
    ],
  }),
  hw({
    id: 'ast-ph-0051', assetTag: 'NW-PH-0051', serial: '356789104612390', modelId: MDL.IPHONE15,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.DEVON, locationId: LOC.AUS,
    purchaseDate: '2025-09-19', cost: 1099, vendor: 'Verizon Business', warrantyExpires: '2027-03-19',
    poNumber: 'PO-2025-0533', contractId: CTR.VERIZON,
    history: [
      hev('2025-09-24', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Activated.'),
      hev('2025-09-26', 'checkout', USR.LISA, 'person', USR.DEVON, 'Added to the weekend on-call rota.'),
    ],
  }),
  hw({
    id: 'ast-ph-0055', assetTag: 'NW-PH-0055', serial: '356789104655512', modelId: MDL.IPHONE15,
    status: 'in_stock', assignmentType: null, assignedToId: null, locationId: LOC.WAREHOUSE,
    purchaseDate: '2026-04-02', cost: 1099, vendor: 'Verizon Business', warrantyExpires: '2027-10-02',
    poNumber: 'PO-2026-0128', contractId: CTR.VERIZON,
    notes: 'Spare pool handset — line suspended until issued.',
    history: [
      hev('2026-04-08', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received, line suspended pending assignment.'),
    ],
  }),
  /* --- Monitors: one personal, two shared at a site, one in stock --- */
  hw({
    id: 'ast-mn-0212', assetTag: 'NW-MN-0212', serial: 'CN0K7T2H', modelId: MDL.U2723,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.MIKE, locationId: LOC.NYC,
    purchaseDate: '2024-04-01', cost: 579, vendor: 'Dell Technologies', warrantyExpires: '2027-04-01',
    poNumber: 'PO-2024-0344',
    history: [
      hev('2024-04-08', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received, 8 units.'),
      hev('2024-04-15', 'checkout', USR.EMMA, 'person', USR.MIKE, 'Desk setup, New York.'),
    ],
  }),
  hw({
    id: 'ast-mn-0213', assetTag: 'NW-MN-0213', serial: 'CN0K7T3J', modelId: MDL.U2723,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.CHI,
    purchaseDate: '2024-04-01', cost: 579, vendor: 'Dell Technologies', warrantyExpires: '2027-04-01',
    poNumber: 'PO-2024-0344', managedById: USR.LINDA,
    notes: 'Shared — 4th-floor hot-desk bank, position 12. Nobody owns it.',
    history: [
      hev('2024-04-08', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received, 8 units.'),
      hev('2024-04-17', 'checkout', USR.LINDA, 'location', LOC.CHI, 'Installed on the 4th-floor hot-desk bank.'),
    ],
  }),
  hw({
    id: 'ast-mn-0219', assetTag: 'NW-MN-0219', serial: 'CN0K8R1L', modelId: MDL.U2723,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.AUS,
    purchaseDate: '2024-09-16', cost: 579, vendor: 'Dell Technologies', warrantyExpires: '2027-09-16',
    poNumber: 'PO-2024-0761', managedById: USR.LISA,
    notes: 'Shared — support floor huddle room, wall mounted.',
    history: [
      hev('2024-09-23', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received, 4 units.'),
      hev('2024-09-30', 'checkout', USR.LINDA, 'location', LOC.AUS, 'Wall mounted in the huddle room.'),
    ],
  }),
  hw({
    id: 'ast-mn-0224', assetTag: 'NW-MN-0224', serial: 'CN0K8R9P', modelId: MDL.U2723,
    status: 'in_stock', assignmentType: null, assignedToId: null, locationId: LOC.WAREHOUSE,
    purchaseDate: '2026-05-30', cost: 579, vendor: 'Dell Technologies', warrantyExpires: '2029-05-30',
    poNumber: 'PO-2026-0177',
    history: [
      hev('2026-06-05', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received with the Latitude batch.'),
    ],
  }),
  /* --- Network, all assigned to a place --- */
  hw({
    id: 'ast-sw-0007', assetTag: 'NW-SW-0007', serial: 'FOC2536L0KQ', modelId: MDL.C9300,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.DC1,
    purchaseDate: '2023-02-20', cost: 6850, vendor: 'Presidio', warrantyExpires: '2026-09-30',
    poNumber: 'PO-2023-0118', contractId: CTR.CISCO_SMARTNET, managedById: USR.PRIYA,
    notes: 'Cabinet 14B-1, top of rack. SmartNet cover ends with the contract.',
    history: [
      hev('2023-02-27', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from Presidio.'),
      hev('2023-03-06', 'checkout', USR.PRIYA, 'location', LOC.DC1, 'Racked in cabinet 14B-1 during the cage build.'),
    ],
  }),
  hw({
    id: 'ast-sw-0008', assetTag: 'NW-SW-0008', serial: 'FOC2536L0MR', modelId: MDL.C9300,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.DC1,
    purchaseDate: '2023-02-20', cost: 6850, vendor: 'Presidio', warrantyExpires: '2026-09-30',
    poNumber: 'PO-2023-0118', contractId: CTR.CISCO_SMARTNET, managedById: USR.PRIYA,
    notes: 'Cabinet 14B-2, top of rack. Redundant pair with NW-SW-0007.',
    history: [
      hev('2023-02-27', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from Presidio.'),
      hev('2023-03-06', 'checkout', USR.PRIYA, 'location', LOC.DC1, 'Racked in cabinet 14B-2.'),
    ],
  }),
  hw({
    id: 'ast-ap-0031', assetTag: 'NW-AP-0031', serial: 'Q2PD-9XKM-4L2A', modelId: MDL.MR46,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.CHI,
    purchaseDate: '2024-07-15', cost: 1299, vendor: 'Presidio', warrantyExpires: '2027-07-15',
    poNumber: 'PO-2024-0640', contractId: CTR.CISCO_SMARTNET, managedById: USR.PRIYA,
    notes: 'Floor 4 north. Covers the hot-desk bank and the two east meeting rooms.',
    history: [
      hev('2024-07-22', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received, 3 units.'),
      hev('2024-07-29', 'checkout', USR.LINDA, 'location', LOC.CHI, 'Ceiling mounted, floor 4 north.'),
    ],
  }),
  hw({
    id: 'ast-ap-0032', assetTag: 'NW-AP-0032', serial: 'Q2PD-9XKM-7T8B', modelId: MDL.MR46,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.NYC,
    purchaseDate: '2024-07-15', cost: 1299, vendor: 'Presidio', warrantyExpires: '2027-07-15',
    poNumber: 'PO-2024-0640', contractId: CTR.CISCO_SMARTNET, managedById: USR.PRIYA,
    history: [
      hev('2024-07-22', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received, 3 units.'),
      hev('2024-08-05', 'checkout', USR.LINDA, 'location', LOC.NYC, 'Ceiling mounted, suite 1120.'),
    ],
  }),
  hw({
    id: 'ast-ap-0033', assetTag: 'NW-AP-0033', serial: 'Q2PD-9XKM-2R4C', modelId: MDL.MR46,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.AUS,
    purchaseDate: '2024-07-15', cost: 1299, vendor: 'Presidio', warrantyExpires: '2027-07-15',
    poNumber: 'PO-2024-0640', contractId: CTR.CISCO_SMARTNET, managedById: USR.PRIYA,
    history: [
      hev('2024-07-22', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received, 3 units.'),
      hev('2024-08-12', 'checkout', USR.LISA, 'location', LOC.AUS, 'Ceiling mounted over the support floor.'),
    ],
  }),
  /* --- Servers, all in the cage --- */
  hw({
    id: 'ast-sv-0003', assetTag: 'NW-SV-0003', serial: '9KJ2TL3', modelId: MDL.R650,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.DC1,
    purchaseDate: '2023-06-08', cost: 12400, vendor: 'Dell Technologies', warrantyExpires: '2026-06-08',
    poNumber: 'PO-2023-0511', contractId: CTR.DELL_PROSUPPORT, managedById: USR.PRIYA,
    notes: 'vSphere host 1. OUT OF WARRANTY since June — extension quote requested from Dell.',
    history: [
      hev('2023-06-15', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received, staged and firmware-updated.'),
      hev('2023-06-27', 'checkout', USR.PRIYA, 'location', LOC.DC1, 'Racked 14B-1 U12, joined the vSphere cluster.'),
    ],
  }),
  hw({
    id: 'ast-sv-0004', assetTag: 'NW-SV-0004', serial: '9KJ2TL4', modelId: MDL.R650,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.DC1,
    purchaseDate: '2023-06-08', cost: 12400, vendor: 'Dell Technologies', warrantyExpires: '2026-06-08',
    poNumber: 'PO-2023-0511', contractId: CTR.DELL_PROSUPPORT, managedById: USR.PRIYA,
    notes: 'vSphere host 2. OUT OF WARRANTY since June — same quote as NW-SV-0003.',
    history: [
      hev('2023-06-15', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received, staged and firmware-updated.'),
      hev('2023-06-27', 'checkout', USR.PRIYA, 'location', LOC.DC1, 'Racked 14B-1 U14, joined the vSphere cluster.'),
    ],
  }),
  hw({
    id: 'ast-sv-0009', assetTag: 'NW-SV-0009', serial: '9KJ4QM8', modelId: MDL.R650,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.DC1,
    purchaseDate: '2025-03-17', cost: 12400, vendor: 'Dell Technologies', warrantyExpires: '2028-03-17',
    poNumber: 'PO-2025-0140', contractId: CTR.DELL_PROSUPPORT, managedById: USR.PRIYA,
    notes: 'vSphere host 3, added for the reporting workload.',
    history: [
      hev('2025-03-24', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received and staged.'),
      hev('2025-04-02', 'checkout', USR.PRIYA, 'location', LOC.DC1, 'Racked 14B-2 U08.'),
    ],
  }),
  /* --- Print, owned by Facilities not IT --- */
  hw({
    id: 'ast-pr-0018', assetTag: 'NW-PR-0018', serial: 'VNC3K12345', modelId: MDL.M479,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.CHI,
    purchaseDate: '2024-01-22', cost: 749, vendor: 'CDW', warrantyExpires: '2025-01-22',
    poNumber: 'PO-2024-0044', managedById: USR.LINDA,
    notes: 'Floor 3 copy room. Out of warranty — Facilities runs it to failure by policy.',
    history: [
      hev('2024-01-29', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from CDW.'),
      hev('2024-02-02', 'checkout', USR.LINDA, 'location', LOC.CHI, 'Installed in the floor 3 copy room.'),
    ],
  }),
  hw({
    id: 'ast-pr-0021', assetTag: 'NW-PR-0021', serial: 'VNC3K67890', modelId: MDL.M479,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.AUS,
    purchaseDate: '2024-09-16', cost: 749, vendor: 'CDW', warrantyExpires: '2025-09-16',
    poNumber: 'PO-2024-0761', managedById: USR.LINDA,
    notes: 'Austin break area. Out of warranty.',
    history: [
      hev('2024-09-23', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received from CDW.'),
      hev('2024-10-01', 'checkout', USR.LINDA, 'location', LOC.AUS, 'Installed in the break area.'),
    ],
  }),
  /* --- Tablets: one shared at a place, one carried by a person --- */
  hw({
    id: 'ast-tb-0009', assetTag: 'NW-TB-0009', serial: 'DMPX1K2L3M', modelId: MDL.IPAD,
    status: 'deployed', assignmentType: 'location', assignedToId: null, locationId: LOC.WAREHOUSE,
    purchaseDate: '2024-11-05', cost: 799, vendor: 'CDW', warrantyExpires: '2026-11-05',
    poNumber: 'PO-2024-0888', managedById: USR.JAMES,
    notes: 'Shared — receiving station scanner. Kiosk mode, no personal sign-in.',
    history: [
      hev('2024-11-12', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received and enrolled in kiosk mode.'),
      hev('2024-11-13', 'checkout', USR.JAMES, 'location', LOC.WAREHOUSE, 'Mounted at the receiving station.'),
    ],
  }),
  hw({
    id: 'ast-tb-0012', assetTag: 'NW-TB-0012', serial: 'DMPX9Z8Y7X', modelId: MDL.IPAD,
    status: 'deployed', assignmentType: 'person', assignedToId: USR.LINDA, locationId: LOC.CHI,
    purchaseDate: '2025-06-18', cost: 799, vendor: 'CDW', warrantyExpires: '2027-06-18',
    poNumber: 'PO-2025-0312',
    notes: 'Facilities walkthrough checklists.',
    history: [
      hev('2025-06-25', 'received', USR.JAMES, 'location', LOC.WAREHOUSE, 'Received and enrolled.'),
      hev('2025-06-27', 'checkout', USR.EMMA, 'person', USR.LINDA, 'Facilities inspection app.'),
    ],
  }),
];

/* ------------------------------------------------------------------ *
 * Software licences — 14 products
 *
 * Deliberate findings for the compliance screen:
 *   OVER-DEPLOYED  Figma (+6) and Adobe Creative Cloud (+3) — unlicensed use,
 *                  a real audit exposure.
 *   UNDER-USED     Salesforce (42 idle seats of 60, renewing 31 Oct) and Zoom
 *                  (86 idle of 150) — money already spent and not used.
 *   AT THE LIMIT   AutoCAD LT and vSphere sit at exactly zero headroom.
 *   UNPAPERED      Several licences have no contract on file at all.
 * ------------------------------------------------------------------ */

const SOFTWARE = [
  sw({
    id: LIC.MS365_E3, vendor: 'Microsoft', product: 'Microsoft 365 E3', version: '2026 CSP',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 180, costPerSeat: 396, renewalDate: '2027-01-31', contractId: CTR.MSFT_EA,
    managedById: USR.JAMES,
    notes: 'Company-wide productivity baseline. True-up runs each January with the EA anniversary.',
    allocations: [
      alloc('location', LOC.CHI, 68, '2024-02-01', 'Chicago HQ headcount'),
      alloc('location', LOC.NYC, 39, '2024-02-01', 'New York headcount'),
      alloc('location', LOC.AUS, 47, '2024-02-01', 'Austin support floor'),
      alloc('location', LOC.REMOTE, 20, '2024-02-01', 'Home-based staff'),
    ],
  }),
  sw({
    id: LIC.FIGMA, vendor: 'Figma', product: 'Figma Organization', version: 'Org plan',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 25, costPerSeat: 540, renewalDate: '2026-11-30', contractId: null,
    managedById: USR.MIKE,
    notes: 'Bought on a design-team card and never papered. Seats were added ad hoc through 2026.',
    allocations: [
      alloc('person', USR.MIKE, 1, '2024-01-15', 'Design lead'),
      alloc('person', USR.JEN, 1, '2024-01-15', 'Creative director'),
      alloc('person', USR.SARAH, 1, '2024-04-02', 'Marketing'),
      alloc('person', USR.PRIYA, 1, '2025-02-11', 'Engineering hand-off'),
      alloc('person', USR.DAVID, 1, '2025-02-11', 'Marketing leadership'),
      alloc('location', LOC.NYC, 14, '2024-01-15', 'Product design + marketing floor'),
      alloc('location', LOC.CHI, 8, '2025-06-01', 'Brand studio'),
      alloc('location', LOC.REMOTE, 4, '2026-03-09', 'Contract designers'),
    ],
  }),
  sw({
    id: LIC.ADOBE_CC, vendor: 'Adobe', product: 'Creative Cloud All Apps', version: '2026',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 12, costPerSeat: 720, renewalDate: '2026-10-09', contractId: CTR.ADOBE_VIP,
    managedById: USR.MIKE,
    notes: 'Auto-renews 9 Oct. Deployment already exceeds the entitlement — fix before renewal or buy up.',
    allocations: [
      alloc('person', USR.MIKE, 1, '2023-10-10', 'Design lead'),
      alloc('person', USR.JEN, 1, '2023-10-10', 'Creative director'),
      alloc('person', USR.SARAH, 1, '2023-10-10', 'Campaign production'),
      alloc('person', USR.DAVID, 1, '2024-05-20', 'Marketing leadership'),
      alloc('location', LOC.NYC, 7, '2023-10-10', 'Creative team machines'),
      alloc('location', LOC.CHI, 4, '2025-09-14', 'Brand studio machines'),
    ],
  }),
  sw({
    id: LIC.SALESFORCE, vendor: 'Salesforce', product: 'Sales Cloud Enterprise', version: 'Enterprise',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 60, costPerSeat: 1980, renewalDate: '2026-10-31', contractId: CTR.SALESFORCE,
    managedById: USR.JAMES,
    notes: 'Bought for a sales expansion that was cut in 2025. Auto-renews at 60 seats unless notice is served.',
    allocations: [
      alloc('person', USR.ROBERT, 1, '2023-11-01', 'VP Sales'),
      alloc('person', USR.TOM, 1, '2023-11-01', 'Account executive'),
      alloc('person', USR.DAVID, 1, '2024-01-08', 'Marketing attribution'),
      alloc('location', LOC.CHI, 9, '2023-11-01', 'Inside sales pod'),
      alloc('location', LOC.NYC, 6, '2023-11-01', 'Field sales'),
    ],
  }),
  sw({
    id: LIC.ZOOM, vendor: 'Zoom', product: 'Zoom One Business', version: 'Business',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 150, costPerSeat: 249, renewalDate: '2027-02-28', contractId: CTR.ZOOM,
    managedById: USR.JAMES,
    notes: 'Bought before Teams was rolled out with the E3 agreement. Usage has collapsed since.',
    allocations: [
      alloc('location', LOC.CHI, 24, '2024-03-01', 'Chicago meeting rooms and staff'),
      alloc('location', LOC.NYC, 16, '2024-03-01', 'New York'),
      alloc('location', LOC.AUS, 18, '2024-03-01', 'Support webinars'),
      alloc('location', LOC.REMOTE, 6, '2024-03-01', 'Home-based staff'),
    ],
  }),
  sw({
    id: LIC.SLACK, vendor: 'Salesforce', product: 'Slack Business+', version: 'Business+',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 190, costPerSeat: 180, renewalDate: '2027-05-31', contractId: CTR.SLACK,
    managedById: USR.JAMES,
    notes: 'Company-wide messaging. Seat count tracks headcount closely.',
    allocations: [
      alloc('location', LOC.CHI, 71, '2025-06-01', 'Chicago HQ'),
      alloc('location', LOC.NYC, 41, '2025-06-01', 'New York'),
      alloc('location', LOC.AUS, 49, '2025-06-01', 'Austin'),
      alloc('location', LOC.REMOTE, 20, '2025-06-01', 'Home-based staff'),
    ],
  }),
  sw({
    id: LIC.JIRA, vendor: 'Atlassian', product: 'Jira Software Premium', version: 'Cloud Premium',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 90, costPerSeat: 155, renewalDate: '2027-07-14', contractId: CTR.ATLASSIAN,
    managedById: USR.PRIYA,
    notes: 'Engineering, product and the change advisory board.',
    allocations: [
      alloc('location', LOC.CHI, 30, '2025-07-15', 'Engineering and ops'),
      alloc('location', LOC.NYC, 26, '2025-07-15', 'Product'),
      alloc('location', LOC.AUS, 20, '2025-07-15', 'Support escalation queue'),
      alloc('location', LOC.REMOTE, 8, '2025-07-15', 'Home-based engineers'),
    ],
  }),
  sw({
    id: LIC.CROWDSTRIKE, vendor: 'CrowdStrike', product: 'Falcon Enterprise', version: '7.x',
    contractType: 'subscription', licenseModel: 'per_device',
    seatsOwned: 240, costPerSeat: 79, renewalDate: '2027-03-31', contractId: CTR.CROWDSTRIKE,
    managedById: USR.EMMA,
    notes: 'Endpoint agent — counted per device, not per person. Headroom is deliberate for the hiring plan.',
    allocations: [
      alloc('location', LOC.CHI, 88, '2025-04-01', 'Chicago endpoints'),
      alloc('location', LOC.NYC, 47, '2025-04-01', 'New York endpoints'),
      alloc('location', LOC.AUS, 55, '2025-04-01', 'Austin endpoints'),
      alloc('location', LOC.REMOTE, 19, '2025-04-01', 'Home-based endpoints'),
      alloc('location', LOC.DC1, 4, '2025-04-01', 'Jump hosts in the cage'),
    ],
  }),
  sw({
    id: LIC.VMWARE, vendor: 'Broadcom', product: 'VMware vSphere Standard', version: '8.0 U3',
    contractType: 'perpetual', licenseModel: 'per_device',
    seatsOwned: 16, costPerSeat: 1394, renewalDate: '2027-09-28', contractId: CTR.VMWARE,
    managedById: USR.PRIYA,
    notes: 'Perpetual licences, support renewed annually. Counted per CPU socket — 8 hosts × 2 sockets.',
    allocations: [
      alloc('location', LOC.DC1, 16, '2022-08-01', 'Cage 14B — CPU sockets across the vSphere cluster'),
    ],
  }),
  sw({
    id: LIC.AUTOCAD, vendor: 'Autodesk', product: 'AutoCAD LT', version: '2026',
    contractType: 'subscription', licenseModel: 'concurrent',
    seatsOwned: 4, costPerSeat: 490, renewalDate: '2027-01-18', contractId: null,
    managedById: USR.LINDA,
    notes: 'Floor plans and space planning. Concurrent use — four people can be in it at once, no more.',
    allocations: [
      alloc('person', USR.LINDA, 1, '2024-01-19', 'Facilities lead'),
      alloc('location', LOC.CHI, 2, '2024-01-19', 'Space planning workstations'),
      alloc('location', LOC.WAREHOUSE, 1, '2025-03-04', 'Racking layout'),
    ],
  }),
  sw({
    id: LIC.DOCUSIGN, vendor: 'DocuSign', product: 'Business Pro', version: 'Business Pro',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 10, costPerSeat: 480, renewalDate: '2027-04-30', contractId: null,
    managedById: USR.MICHAEL,
    notes: 'Contracts, offers and vendor paper.',
    allocations: [
      alloc('person', USR.MICHAEL, 1, '2024-05-02', 'Finance'),
      alloc('person', USR.PATTI, 1, '2024-05-02', 'People Ops'),
      alloc('person', USR.ROBERT, 1, '2024-05-02', 'Sales'),
      alloc('person', USR.ADMIN, 1, '2024-05-02', 'Service Operations'),
      alloc('location', LOC.CHI, 4, '2025-01-06', 'Finance and legal shared envelope users'),
    ],
  }),
  sw({
    id: LIC.GITHUB, vendor: 'GitHub', product: 'GitHub Enterprise Cloud', version: 'Enterprise',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 40, costPerSeat: 231, renewalDate: '2027-02-14', contractId: null,
    managedById: USR.PRIYA,
    notes: 'Renews on a corporate card. Should be folded into the Microsoft agreement at the next EA anniversary.',
    allocations: [
      alloc('person', USR.PRIYA, 1, '2024-02-15', 'Engineering'),
      alloc('person', USR.MIKE, 1, '2024-02-15', 'Design systems repo'),
      alloc('location', LOC.NYC, 12, '2024-02-15', 'Product engineering'),
      alloc('location', LOC.AUS, 10, '2024-02-15', 'Support tooling engineers'),
      alloc('location', LOC.CHI, 8, '2024-02-15', 'Platform team'),
      alloc('location', LOC.REMOTE, 2, '2025-08-01', 'Home-based engineers'),
    ],
  }),
  sw({
    id: LIC.TABLEAU, vendor: 'Salesforce', product: 'Tableau Creator', version: '2026.1',
    contractType: 'subscription', licenseModel: 'per_seat',
    seatsOwned: 15, costPerSeat: 1010, renewalDate: '2027-06-30', contractId: null,
    managedById: USR.MICHAEL,
    notes: 'Finance and revenue reporting.',
    allocations: [
      alloc('person', USR.MICHAEL, 1, '2024-07-01', 'Finance manager'),
      alloc('person', USR.DAVID, 1, '2024-07-01', 'Marketing analytics'),
      alloc('person', USR.ADMIN, 1, '2025-01-13', 'Service reporting'),
      alloc('location', LOC.CHI, 6, '2024-07-01', 'Finance team'),
      alloc('location', LOC.NYC, 4, '2024-07-01', 'Revenue operations'),
    ],
  }),
  sw({
    id: LIC.DUO, vendor: 'Cisco', product: 'Duo Advantage', version: 'Advantage',
    contractType: 'subscription', licenseModel: 'site',
    seatsOwned: null, costPerSeat: null, annualValue: 18400, renewalDate: '2027-05-15', contractId: null,
    managedById: USR.EMMA,
    notes: 'Site licence — every identity is covered, so there is no seat position to manage. Allocations below are for visibility only.',
    allocations: [
      alloc('location', LOC.CHI, 120, '2025-05-16', 'Covered identities'),
      alloc('location', LOC.NYC, 60, '2025-05-16', 'Covered identities'),
      alloc('location', LOC.AUS, 70, '2025-05-16', 'Covered identities'),
      alloc('location', LOC.REMOTE, 25, '2025-05-16', 'Covered identities'),
      alloc('location', LOC.DC1, 6, '2025-05-16', 'Service accounts with MFA'),
    ],
  }),
];

export const ASSETS = [...HARDWARE, ...SOFTWARE];

/* ------------------------------------------------------------------ *
 * Contracts
 *
 * `noticeDays` is the load-bearing field: an auto-renewing contract renews
 * silently unless notice is served before endDate − noticeDays. The renewals
 * panel computes that deadline and shouts when it is close.
 * ------------------------------------------------------------------ */

export const CONTRACTS = [
  {
    id: CTR.ADOBE_VIP, name: 'Adobe VIP Marketplace Agreement', vendor: 'Adobe (via CDW)',
    type: 'software_subscription', startDate: '2023-10-10', endDate: '2026-10-09',
    value: 8640, currency: 'USD', autoRenew: true, noticeDays: 30, ownerId: USR.JAMES,
    status: 'active', assetIds: [], licenseIds: [LIC.ADOBE_CC],
    notes: 'Auto-renews at the current seat count. Deployment is over entitlement — resolve before the notice date.',
  },
  {
    id: CTR.CISCO_SMARTNET, name: 'Cisco SmartNet Total Care', vendor: 'Cisco (via Presidio)',
    type: 'hardware_maintenance', startDate: '2023-10-01', endDate: '2026-09-30',
    value: 14400, currency: 'USD', autoRenew: false, noticeDays: 30, ownerId: USR.PRIYA,
    status: 'active',
    assetIds: ['ast-sw-0007', 'ast-sw-0008', 'ast-ap-0031', 'ast-ap-0032', 'ast-ap-0033'],
    licenseIds: [],
    notes: 'Covers next-business-day replacement on both Catalyst switches and the three access points.',
  },
  {
    id: CTR.SALESFORCE, name: 'Salesforce Sales Cloud Subscription', vendor: 'Salesforce',
    type: 'software_subscription', startDate: '2023-11-01', endDate: '2026-10-31',
    value: 118800, currency: 'USD', autoRenew: true, noticeDays: 45, ownerId: USR.MICHAEL,
    status: 'active', assetIds: [], licenseIds: [LIC.SALESFORCE],
    notes: 'Renews for another 36 months at 60 seats unless notice is served. Only 18 seats are in use.',
  },
  {
    id: CTR.MSFT_EA, name: 'Microsoft Enterprise Agreement', vendor: 'Microsoft (via SHI)',
    type: 'software_subscription', startDate: '2024-02-01', endDate: '2027-01-31',
    value: 213840, currency: 'USD', autoRenew: false, noticeDays: 60, ownerId: USR.JAMES,
    status: 'active', assetIds: [], licenseIds: [LIC.MS365_E3],
    notes: 'Three-year EA, annual true-up each January.',
  },
  {
    id: CTR.DELL_PROSUPPORT, name: 'Dell ProSupport Plus — Fleet', vendor: 'Dell Technologies',
    type: 'hardware_maintenance', startDate: '2023-11-02', endDate: '2027-11-01',
    value: 22300, currency: 'USD', autoRenew: false, noticeDays: 60, ownerId: USR.EMMA,
    status: 'active',
    assetIds: ['ast-lt-0163', 'ast-lt-0164', 'ast-lt-0184', 'ast-lt-0185', 'ast-lt-0186', 'ast-sv-0003', 'ast-sv-0004', 'ast-sv-0009'],
    licenseIds: [],
    notes: 'Laptop fleet plus the three PowerEdge hosts. Two hosts are already outside their hardware warranty.',
  },
  {
    id: CTR.APPLECARE, name: 'AppleCare for Enterprise', vendor: 'Apple (via CDW)',
    type: 'hardware_maintenance', startDate: '2025-01-15', endDate: '2028-01-14',
    value: 31500, currency: 'USD', autoRenew: false, noticeDays: 90, ownerId: USR.EMMA,
    status: 'active',
    assetIds: ['ast-lt-0142', 'ast-lt-0143', 'ast-lt-0151', 'ast-lt-0158', 'ast-lt-0177', 'ast-lt-0180', 'ast-lt-0181', 'ast-lt-0190'],
    licenseIds: [],
    notes: '4-hour on-site response in Chicago and New York, next-business-day elsewhere.',
  },
  {
    id: CTR.VERIZON, name: 'Verizon Business Mobility', vendor: 'Verizon Business',
    type: 'service', startDate: '2024-05-01', endDate: '2027-04-30',
    value: 26400, currency: 'USD', autoRenew: true, noticeDays: 30, ownerId: USR.JAMES,
    status: 'active',
    assetIds: ['ast-ph-0044', 'ast-ph-0047', 'ast-ph-0051', 'ast-ph-0055'],
    licenseIds: [],
    notes: 'Pooled data across four handsets. Suspended lines still bill at 25%.',
  },
  {
    id: CTR.ZOOM, name: 'Zoom One Business Agreement', vendor: 'Zoom Video Communications',
    type: 'software_subscription', startDate: '2024-03-01', endDate: '2027-02-28',
    value: 37350, currency: 'USD', autoRenew: true, noticeDays: 30, ownerId: USR.JAMES,
    status: 'active', assetIds: [], licenseIds: [LIC.ZOOM],
    notes: 'Overlaps with Teams from the Microsoft agreement. Candidate to drop at renewal.',
  },
  {
    id: CTR.CROWDSTRIKE, name: 'CrowdStrike Falcon Subscription', vendor: 'CrowdStrike',
    type: 'software_subscription', startDate: '2025-04-01', endDate: '2027-03-31',
    value: 18960, currency: 'USD', autoRenew: true, noticeDays: 60, ownerId: USR.EMMA,
    status: 'active', assetIds: [], licenseIds: [LIC.CROWDSTRIKE],
    notes: '240 device licences with deliberate headroom for the hiring plan.',
  },
  {
    id: CTR.VMWARE, name: 'VMware vSphere Production Support', vendor: 'Broadcom',
    type: 'support', startDate: '2025-09-29', endDate: '2027-09-28',
    value: 17856, currency: 'USD', autoRenew: true, noticeDays: 30, ownerId: USR.PRIYA,
    status: 'active', assetIds: ['ast-sv-0003', 'ast-sv-0004', 'ast-sv-0009'], licenseIds: [LIC.VMWARE],
    notes: 'Support only — the licences themselves are perpetual.',
  },
  {
    id: CTR.SLACK, name: 'Slack Business+ Annual', vendor: 'Salesforce',
    type: 'software_subscription', startDate: '2025-06-01', endDate: '2027-05-31',
    value: 34200, currency: 'USD', autoRenew: true, noticeDays: 30, ownerId: USR.JAMES,
    status: 'active', assetIds: [], licenseIds: [LIC.SLACK],
    notes: 'Two-year term negotiated at the 2025 renewal.',
  },
  {
    id: CTR.ATLASSIAN, name: 'Atlassian Cloud Premium', vendor: 'Atlassian',
    type: 'software_subscription', startDate: '2025-07-15', endDate: '2027-07-14',
    value: 13950, currency: 'USD', autoRenew: true, noticeDays: 30, ownerId: USR.PRIYA,
    status: 'active', assetIds: [], licenseIds: [LIC.JIRA],
    notes: 'Jira Software Premium, 90 seats.',
  },
  {
    id: CTR.COLO, name: 'Elk Grove Colocation — Cabinet Lease', vendor: 'Halsted Data Centers',
    type: 'lease', startDate: '2022-07-01', endDate: '2027-06-30',
    value: 480000, currency: 'USD', autoRenew: true, noticeDays: 120, ownerId: USR.ADMIN,
    status: 'active',
    assetIds: ['ast-sw-0007', 'ast-sw-0008', 'ast-sv-0003', 'ast-sv-0004', 'ast-sv-0009'],
    licenseIds: [],
    notes: 'Two cabinets in cage 14B, 8kW each, with cross-connects. Five-year term.',
  },
];
