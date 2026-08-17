/**
 * People seed.
 *
 * RelayHQ runs in two modes at once, so there are two people models:
 *   AGENTS + DIRECTORY — the staff and the internal corporate directory. This
 *     is what an internal ITSM deployment resolves "requester's manager" from.
 *   CONTACTS + ORGANIZATIONS — external customers and the companies they
 *     belong to. An external customer-service deployment has no corporate
 *     directory, so contact/org records carry that weight instead.
 *
 * The demo company is Northwind Systems, a mid-size SaaS company that runs
 * RelayHQ for both its own employees and its customers.
 */

export const CURRENT_USER = {
  id: 'usr-admin',
  name: 'Alex Rivera',
  email: 'alex.rivera@northwind.example',
  title: 'Service Operations Lead',
  department: 'Operations',
  role: 'admin',
};

/** Staff who can be assigned work. */
export const AGENTS = [
  { id: 'usr-admin',  name: 'Alex Rivera',     email: 'alex.rivera@northwind.example',  title: 'Service Operations Lead', department: 'Operations', role: 'admin',   jobFunction: 'service-ops' },
  { id: 'usr-emma',   name: 'Emma Williams',   email: 'emma.w@northwind.example',       title: 'IT Manager',              department: 'IT',         role: 'agent',   jobFunction: 'it-support' },
  { id: 'usr-james',  name: 'James Brown',     email: 'james.b@northwind.example',      title: 'Procurement Specialist',  department: 'Operations', role: 'agent',   jobFunction: 'procurement' },
  { id: 'usr-patti',  name: 'Patricia Davis',  email: 'patricia.d@northwind.example',   title: 'HR Director',             department: 'People',     role: 'agent',   jobFunction: 'people-ops' },
  { id: 'usr-mike',   name: 'Mike Chen',       email: 'mike.c@northwind.example',       title: 'Design Team Lead',        department: 'Product',    role: 'agent',   jobFunction: 'product' },
  { id: 'usr-lisa',   name: 'Lisa Park',       email: 'lisa.p@northwind.example',       title: 'Support Team Lead',       department: 'Support',    role: 'agent',   jobFunction: 'support-agent' },
  { id: 'usr-devon',  name: 'Devon Okafor',    email: 'devon.o@northwind.example',      title: 'Support Agent',           department: 'Support',    role: 'agent',   jobFunction: 'support-agent' },
  { id: 'usr-nadia',  name: 'Nadia Haddad',    email: 'nadia.h@northwind.example',      title: 'Support Agent',           department: 'Support',    role: 'agent',   jobFunction: 'support-agent' },
  { id: 'usr-sam',    name: 'Sam Whitfield',   email: 'sam.w@northwind.example',        title: 'Support Agent (new)',     department: 'Support',    role: 'agent',   jobFunction: 'support-agent' },
  { id: 'usr-michael',name: 'Michael Garcia',  email: 'michael.g@northwind.example',    title: 'Finance Manager',         department: 'Finance',    role: 'agent',   jobFunction: 'finance' },
  { id: 'usr-linda',  name: 'Linda Martinez',  email: 'linda.m@northwind.example',      title: 'Facilities Lead',         department: 'Operations', role: 'agent',   jobFunction: 'facilities' },
  { id: 'usr-robert', name: 'Robert Smith',    email: 'robert.s@northwind.example',     title: 'VP Sales',                department: 'Sales',      role: 'manager', jobFunction: 'sales' },
  { id: 'usr-david',  name: 'David Wong',      email: 'david.w@northwind.example',      title: 'VP Marketing',            department: 'Marketing',  role: 'manager', jobFunction: 'marketing' },
  { id: 'usr-jen',    name: 'Jennifer Lopez',  email: 'jennifer.l@northwind.example',   title: 'Creative Director',       department: 'Product',    role: 'manager', jobFunction: 'product' },
];

/** Reporting lines. A lookup so the roster above stays readable. */
const MANAGERS = {
  'usr-emma': 'usr-admin',
  'usr-james': 'usr-admin',
  'usr-lisa': 'usr-admin',
  'usr-devon': 'usr-lisa',
  'usr-nadia': 'usr-lisa',
  'usr-sam': 'usr-lisa',
  'usr-mike': 'usr-jen',
  'usr-sarah': 'usr-david',
  'usr-tom': 'usr-robert',
  'usr-priya': 'usr-jen',
  'usr-linda': 'usr-admin',
  'usr-michael': 'usr-admin',
  'usr-patti': 'usr-admin',
};

const LOCATION_OF = {
  'usr-admin': 'loc-chi', 'usr-emma': 'loc-chi', 'usr-james': 'loc-chi',
  'usr-lisa': 'loc-aus', 'usr-devon': 'loc-aus', 'usr-nadia': 'loc-remote',
  'usr-sam': 'loc-aus', 'usr-mike': 'loc-nyc', 'usr-jen': 'loc-nyc',
  'usr-sarah': 'loc-nyc', 'usr-robert': 'loc-chi', 'usr-david': 'loc-nyc',
  'usr-tom': 'loc-remote', 'usr-priya': 'loc-aus', 'usr-patti': 'loc-chi',
  'usr-michael': 'loc-chi', 'usr-linda': 'loc-chi',
};

/**
 * The internal directory, including the manager chain.
 * `managerId` is what an approval step of type "requester's manager" resolves
 * against — the single most common dynamic approver in every ITSM product.
 */
export const DIRECTORY = [
  ...AGENTS.map(a => ({ ...a, kind: 'employee' })),
  { id: 'usr-sarah', name: 'Sarah Johnson', email: 'sarah.j@northwind.example', title: 'Senior Marketing Manager', department: 'Marketing', kind: 'employee', jobFunction: 'marketing' },
  { id: 'usr-tom',   name: 'Tom Alvarez',   email: 'tom.a@northwind.example',   title: 'Account Executive',        department: 'Sales',     kind: 'employee', jobFunction: 'sales' },
  { id: 'usr-priya', name: 'Priya Raman',   email: 'priya.r@northwind.example', title: 'Engineer',                 department: 'Product',   kind: 'employee', jobFunction: 'product' },
].map(p => ({
  ...p,
  managerId: MANAGERS[p.id] || null,
  locationId: LOCATION_OF[p.id] || 'loc-chi',
}));

/** Look up a directory record. */
export function personById(id) {
  return DIRECTORY.find(p => p.id === id) || null;
}

/** Resolve the manager of a person — the dynamic approver every ITSM tool has. */
export function managerOf(id) {
  const p = personById(id);
  return p?.managerId ? personById(p.managerId) : null;
}

/* ------------------------------------------------------------------ *
 * External customers
 * ------------------------------------------------------------------ */

export const ORGANIZATIONS = [
  { id: 'org-lumen',   name: 'Lumen Retail Group', domain: 'lumenretail.example', plan: 'Enterprise', seats: 420, csm: 'usr-lisa',  since: '2023-04-11', healthScore: 'good' },
  { id: 'org-parkway', name: 'Parkway Logistics',  domain: 'parkwaylog.example',  plan: 'Business',   seats: 85,  csm: 'usr-devon', since: '2024-09-02', healthScore: 'at_risk' },
  { id: 'org-vireo',   name: 'Vireo Health',       domain: 'vireohealth.example', plan: 'Enterprise', seats: 1200,csm: 'usr-lisa',  since: '2022-01-20', healthScore: 'good' },
  { id: 'org-fernbrook',name:'Fernbrook Studios',  domain: 'fernbrook.example',   plan: 'Starter',    seats: 12,  csm: null,        since: '2026-02-14', healthScore: 'new' },
];

export const CONTACTS = [
  { id: 'con-1', name: 'Dana Whitmore',  email: 'dana.w@lumenretail.example',   orgId: 'org-lumen',    title: 'IT Director',        phone: '+1 (312) 555-0148', vip: true,  timezone: 'CST' },
  { id: 'con-2', name: 'Ravi Menon',     email: 'ravi.m@lumenretail.example',   orgId: 'org-lumen',    title: 'Store Systems Lead', phone: '+1 (312) 555-0192', vip: false, timezone: 'CST' },
  { id: 'con-3', name: 'Beatriz Salas',  email: 'bea.s@parkwaylog.example',     orgId: 'org-parkway',  title: 'Operations Manager', phone: '+1 (214) 555-0110', vip: false, timezone: 'CST' },
  { id: 'con-4', name: 'Owen Fitzgerald',email: 'owen.f@vireohealth.example',   orgId: 'org-vireo',    title: 'VP Technology',      phone: '+1 (617) 555-0177', vip: true,  timezone: 'EST' },
  { id: 'con-5', name: 'Mei Tanaka',     email: 'mei.t@vireohealth.example',    orgId: 'org-vireo',    title: 'Clinical Systems',   phone: '+1 (617) 555-0133', vip: false, timezone: 'EST' },
  { id: 'con-6', name: 'Cole Brennan',   email: 'cole@fernbrook.example',       orgId: 'org-fernbrook',title: 'Founder',            phone: '+1 (503) 555-0125', vip: false, timezone: 'PST' },
];

export function contactById(id) {
  return CONTACTS.find(c => c.id === id) || null;
}

export function orgById(id) {
  return ORGANIZATIONS.find(o => o.id === id) || null;
}

/**
 * Job functions — the unit a training curriculum targets.
 * "Teach a job function completely" is the training thesis, so job function is
 * a first-class concept rather than a free-text field.
 */
export const JOB_FUNCTIONS = [
  { id: 'support-agent', label: 'Support Agent',    description: 'Front-line customer support for Northwind products' },
  { id: 'it-support',    label: 'IT Support',       description: 'Internal helpdesk and endpoint support' },
  { id: 'procurement',   label: 'Procurement',      description: 'Purchasing, vendors and license renewals' },
  { id: 'people-ops',    label: 'People Ops',       description: 'Onboarding, offboarding and HR requests' },
  { id: 'facilities',    label: 'Facilities',       description: 'Sites, access and workplace requests' },
  { id: 'service-ops',   label: 'Service Ops',      description: 'Runs the service desk itself' },
  { id: 'finance',       label: 'Finance',          description: 'Budget, expense and cost approvals' },
  { id: 'product',       label: 'Product',          description: 'Product and design' },
  { id: 'sales',         label: 'Sales',            description: 'Revenue' },
  { id: 'marketing',     label: 'Marketing',        description: 'Demand and brand' },
  { id: 'customer',      label: 'Customer',         description: 'External customer learners' },
];
