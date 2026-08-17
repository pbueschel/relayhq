/**
 * RelayHQ state shape — the contract every module builds against.
 *
 * ============================================================================
 * THE ONE STRUCTURAL CHANGE FROM v1, AND WHY
 * ============================================================================
 * v1 nested content inside catalog nodes:
 *
 *     item.actions = { subforms: [...], knowledgeBases: [...] }
 *
 * That made an article the private property of exactly one catalog item. It is
 * the right shape for a help centre and the wrong shape for everything else we
 * now need, because the product thesis is that ONE authored atom serves THREE
 * surfaces:
 *
 *     deflection   — the customer drilling the catalog hits it before the form
 *     enablement   — the agent working a ticket sees it in context
 *     training     — it is a lesson inside a course that teaches a job function
 *
 * A nested article cannot be a lesson in two courses and a help topic under two
 * catalog items at once. So knowledge and subforms are now TOP-LEVEL
 * collections, and catalog items reference them by id:
 *
 *     item.knowledgeIds = ['kb-reset-password']
 *     item.subformIds   = ['sf-access-request']
 *
 * Everything else about the catalog is unchanged. This is the change that makes
 * the training layer possible rather than bolted on.
 * ============================================================================
 */

/**
 * @typedef {Object} CatalogNode
 * @property {string} id
 * @property {string} name
 * @property {'product'|'subcategory'|'item'} type
 * @property {string} [description]
 * @property {CatalogNode[]} [children]     present on product | subcategory
 * @property {string[]} [knowledgeIds]      present on item — refs into `knowledge`
 * @property {string[]} [subformIds]        present on item — refs into `subforms`
 * @property {string[]} [assetIds]          present on item — refs into `assets`
 * @property {'internal'|'external'|'both'} [audience]
 */

/**
 * A knowledge atom. Serves as a help article, an agent-facing reference, and a
 * course lesson without being copied.
 *
 * @typedef {Object} KnowledgeItem
 * @property {string} id
 * @property {string} title
 * @property {'article'|'guide'} format   article = rich text; guide = Stories-style slides
 * @property {string} [body]              HTML, for format 'article'
 * @property {Slide[]} [slides]           for format 'guide'
 * @property {string} summary
 * @property {'draft'|'published'|'archived'} status
 * @property {'internal'|'external'|'both'} audience
 * @property {string[]} tags
 * @property {string} ownerId
 * @property {string} updatedAt
 * @property {number} [helpfulYes]
 * @property {number} [helpfulNo]
 * @property {number} [views]
 * -- fields that let the SAME atom act as a lesson --
 * @property {string} [objective]         what the learner can do after this
 * @property {number} [minutes]           estimated time
 * @property {string[]} [prerequisiteIds] other knowledge ids
 * @property {Question[]} [check]         optional knowledge check
 */

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {'image'|'video'|'text'} type
 * @property {string} [url]
 * @property {string} [heading]
 * @property {string} caption            rich text
 * @property {number} [seconds]          auto-advance duration; 0 = manual only
 * @property {string} [alt]              required for image slides (accessibility)
 */

/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {'single'|'multi'|'boolean'} type
 * @property {string} prompt
 * @property {{id:string,label:string,correct:boolean}[]} options
 * @property {string} [explanation]
 */

/**
 * A request form attached to catalog items. Multiple subforms per item is the
 * point — "Report a problem" and "Request access" are different intakes on the
 * same item and route to different queues.
 *
 * @typedef {Object} Subform
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {Field[]} fields
 * @property {{queueId:string}} [routing]
 * @property {string} [approvalPolicyId]  policy that runs on submission
 * @property {'internal'|'external'|'both'} audience
 */

/**
 * @typedef {Object} Field
 * @property {string} id
 * @property {'text'|'textarea'|'select'|'multiselect'|'checkbox'|'email'|'phone'|'date'|'number'|'currency'|'file'|'user'|'asset'} type
 * @property {string} label
 * @property {boolean} required
 * @property {string[]} [options]
 * @property {string} [placeholder]
 * @property {string} [help]
 * @property {{fieldId:string, op:string, value:*}} [showIf]  conditional display
 */

/**
 * The complete root state. Modules own their own slices and must not reshape
 * another module's slice.
 */
export const STATE_KEYS = /** @type {const} */ ([
  // people
  'currentUser', 'agents', 'directory', 'contacts', 'organizations', 'jobFunctions',
  // catalog + content
  'catalog', 'knowledge', 'subforms', 'forms',
  // service records
  'tickets', 'problems', 'changes', 'approvals',
  // work management
  'tasks', 'projects',
  // rules
  'queues', 'rules', 'approvalPolicies', 'slaPolicies',
  // automation
  'automations', 'automationRuns',
  // assets
  'assets', 'assetModels', 'locations', 'contracts',
  // learning
  'curricula', 'courses', 'enrollments',
  // system
  'activity', 'settings',
]);

/** Every collection defaults to empty so a module never reads undefined. */
export function emptyState() {
  const s = {};
  for (const k of STATE_KEYS) s[k] = [];
  s.currentUser = null;
  s.settings = {};
  return s;
}
