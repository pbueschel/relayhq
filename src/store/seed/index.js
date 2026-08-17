/**
 * Seed composition.
 *
 * Each domain owns one file. Adding demo data means editing your domain's file
 * only — this index just assembles. The seed is immutable: the store copies it
 * at boot and every user action mutates the copy, never these modules.
 */

import { emptyState } from '../schema.js';
import { CURRENT_USER, AGENTS, DIRECTORY, CONTACTS, ORGANIZATIONS, JOB_FUNCTIONS } from './people.js';
import { CATALOG } from './catalog.js';
import { KNOWLEDGE } from './knowledge.js';
import { SUBFORMS, FORMS } from './forms.js';
import { QUEUES, RULES, APPROVAL_POLICIES, SLA_POLICIES } from './rules.js';
import { TICKETS, PROBLEMS, CHANGES, APPROVALS } from './service.js';
import { TASKS, PROJECTS } from './work.js';
import { ASSETS, ASSET_MODELS, LOCATIONS, CONTRACTS } from './assets.js';
import { CURRICULA, COURSES, ENROLLMENTS } from './learning.js';
import { AUTOMATIONS, AUTOMATION_RUNS } from './automations.js';
import { ACTIVITY } from './activity.js';

export function buildSeed() {
  const s = emptyState();

  s.currentUser = CURRENT_USER;
  s.agents = AGENTS;
  s.directory = DIRECTORY;
  s.contacts = CONTACTS;
  s.organizations = ORGANIZATIONS;
  s.jobFunctions = JOB_FUNCTIONS;

  s.catalog = CATALOG;
  s.knowledge = KNOWLEDGE;
  s.subforms = SUBFORMS;
  s.forms = FORMS;

  s.queues = QUEUES;
  s.rules = RULES;
  s.approvalPolicies = APPROVAL_POLICIES;
  s.slaPolicies = SLA_POLICIES;

  s.tickets = TICKETS;
  s.problems = PROBLEMS;
  s.changes = CHANGES;
  s.approvals = APPROVALS;

  s.tasks = TASKS;
  s.projects = PROJECTS;

  s.assets = ASSETS;
  s.assetModels = ASSET_MODELS;
  s.locations = LOCATIONS;
  s.contracts = CONTRACTS;

  s.curricula = CURRICULA;
  s.courses = COURSES;
  s.enrollments = ENROLLMENTS;

  s.automations = AUTOMATIONS;
  s.automationRuns = AUTOMATION_RUNS;

  s.activity = ACTIVITY;

  s.settings = {
    // RelayHQ runs internal and external service on one instance. The mode
    // toggle changes vocabulary and which surfaces are emphasised; it does not
    // fork the data model.
    mode: 'both',              // 'internal' | 'external' | 'both'
    orgName: 'Northwind Systems',
    businessHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5], tz: 'America/Chicago' },
  };

  return s;
}
