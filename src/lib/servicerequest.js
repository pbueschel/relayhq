/**
 * The approval context for a service-catalog order.
 *
 * WHY THIS EXISTS AS A SHARED FUNCTION: the portal builds this context when
 * somebody orders something, and the smoke gate builds it to assert that every
 * service item's declared approval actually fires. If the two computed spend
 * differently, the gate would pass while the portal quietly ordered a $6,000
 * meeting-room kit with nobody signing off. One function, both callers.
 */

/**
 * Annualised cost of a service item.
 *
 * Procurement thresholds are annual. A $45/month seat is $540 a year, so
 * testing the monthly figure against a $500 gate silently declines every
 * subscription — which is exactly how three licence items shipped with no
 * approval attached. One-off and recurring are summed: a phone at $1,099 plus
 * a $55/month line is $1,759 in its first year.
 */
export function annualCost(item, quantity = 1) {
  if (!item) return 0;
  const qty = Math.max(1, Number(quantity) || 1);
  const oneOff = Number(item.price) || 0;
  const recurring = Number(item.recurringPrice) || 0;
  const periods = item.recurrence === 'monthly' ? 12 : item.recurrence === 'annual' ? 1 : 0;
  return (oneOff + recurring * periods) * qty;
}

/** Human-readable price line for a service card. */
export function priceLabel(item) {
  if (!item) return '';
  const oneOff = Number(item.price) || 0;
  const recurring = Number(item.recurringPrice) || 0;
  const money = (n) => `$${n.toLocaleString('en-US')}`;
  const per = item.recurrence === 'monthly' ? '/month' : item.recurrence === 'annual' ? '/year' : '';

  if (!oneOff && !recurring) return 'No charge';
  if (oneOff && recurring) return `${money(oneOff)} + ${money(recurring)}${per}`;
  if (recurring) return `${money(recurring)}${per}`;
  return `${money(oneOff)} one-off`;
}

/**
 * Build the context an approval policy is evaluated against.
 *
 * @param item      the ServiceItem being ordered
 * @param answers   the submitted form answers
 * @param requester { id, department, isExternal, vip }
 * @param store     { directory, queues }
 */
export function serviceRequestContext(item, answers = {}, requester = {}, store = {}) {
  const quantity = Number(answers.quantity) || 1;
  return {
    requesterId: requester.id || null,
    directory: store.directory || [],
    queues: store.queues || [],
    ticket: {
      subformId: item?.subformId || null,
      catalogItemId: null,
      queueId: item?.fulfilmentQueueId || null,
      // Service provenance, so a policy can key on the CATEGORY rather than on
      // one hard-coded form id — which is what lets a newly authored orderable
      // item inherit the right approval without the policy being edited.
      serviceItemId: item?.id || null,
      serviceCategoryId: item?.categoryId || null,
      // Whether ordering this grants somebody access. Declared on the item, so
      // the approval keys on what the request MEANS rather than on whether one
      // particular form happened to ask for an access level.
      grantsAccess: !!item?.grantsAccess,
      source: 'portal',
      labels: [],
    },
    requester: {
      department: requester.department || null,
      isExternal: !!requester.isExternal,
      vip: !!requester.vip,
    },
    org: requester.org || {},
    answers: {
      ...answers,
      quantity,
      // Both are supplied: `amount` is whatever the form asked for, and
      // `annualAmount` is what a spend threshold should actually test.
      amount: answers.amount != null ? Number(answers.amount) : annualCost(item, quantity),
      annualAmount: annualCost(item, quantity),
    },
  };
}

/**
 * Raise a service request outside the portal.
 *
 * WHY THIS EXISTS: a service request used to be creatable only by walking the
 * portal drill, because the ticket's `serviceItemId` was written in exactly one
 * place — the portal's submit. An agent taking a request over the phone had no
 * way to record one, and any hand-rolled "create a ticket and set a flag" would
 * have skipped the approval engine entirely. That is the failure this guards:
 * a $6,400 licence order that nobody signed off because it was typed in by an
 * agent rather than ordered through the catalog.
 *
 * So the approval half is not optional and not reimplemented here — it runs
 * through `serviceRequestContext` and `startApproval`, the same pair the portal
 * and the smoke gate use.
 *
 * Returns the records to write; it does NOT touch the store, so the caller
 * decides ordering and the function stays testable.
 */
export function raiseServiceRequest({
  subform, serviceItem = null, answers = {}, requester = null, actor = null,
  store = {}, now = new Date().toISOString(), key, ids = {},
  startApproval, matchingPolicies,
}) {
  const queues = store.queues || [];
  const policies = store.approvalPolicies || [];

  /* A service item owns its fulfilment queue; an intake owns its routing. An
   * unrouted request falls to the catch-all rather than to nothing. */
  const wantedQueueId = serviceItem?.fulfilmentQueueId || subform?.routing?.queueId || null;
  const queue = (wantedQueueId && queues.find(q => q.id === wantedQueueId))
    || queues.find(q => q.isDefault) || queues[0] || null;

  const title = serviceItem?.name
    ? `Request: ${serviceItem.name}`
    : subform?.name || 'Service request';

  const ticket = {
    id: ids.ticketId,
    key,
    title,
    description: answers.__description || '',
    status: 'open',
    priority: answers.priority || 'medium',
    queueId: queue?.id || null,
    assigneeId: null,
    isExternal: false,
    requesterId: requester?.id || null,
    contactId: null,
    orgId: null,
    /* Says how it got here. A request typed by an agent is not a portal
     * submission and the record should not claim to be one. */
    source: 'agent',
    subformId: subform?.id || null,
    catalogItemId: null,
    serviceItemId: serviceItem?.id || null,
    formId: null,
    answers: { ...answers },
    labels: [],
    cc: [],
    comments: [],
    links: [],
    slaPolicyId: null,
    firstResponseAt: null,
    raisedById: actor?.id || null,
    createdAt: now,
    updatedAt: now,
  };

  const policyId = serviceItem?.approvalPolicyId || subform?.approvalPolicyId || null;
  const policy = policyId ? policies.find(p => p.id === policyId) || null : null;
  let approval = null;

  if (policy && startApproval) {
    const who = {
      id: requester?.id,
      department: requester?.department || null,
      isExternal: false,
      vip: !!requester?.vip,
      org: { plan: null },
    };
    const ordered = serviceItem
      ? serviceRequestContext(serviceItem, answers, who, { directory: store.directory || [], queues })
      : null;
    const ctx = ordered
      ? { ...ordered,
          ticket: { ...ordered.ticket, title: ticket.title, priority: ticket.priority,
                    status: ticket.status, queueId: ticket.queueId },
          __now: now }
      : { requesterId: requester?.id,
          directory: store.directory || [], queues,
          answers,
          ticket: { title: ticket.title, priority: ticket.priority, status: ticket.status,
                    queueId: ticket.queueId, source: 'agent', labels: [],
                    subformId: subform?.id || null, catalogItemId: null },
          requester: { department: who.department, isExternal: false, vip: who.vip },
          org: who.org,
          __now: now };

    /* A service item DECLARES it needs sign-off; an intake ATTACHES a policy
     * whose conditions decide. Same fork the portal takes. */
    const declared = !!serviceItem?.approvalPolicyId;
    if (declared || (matchingPolicies && matchingPolicies([policy], ctx).length)) {
      approval = startApproval(policy, ctx, {
        id: ids.approvalId,
        subject: `${ticket.key} · ${ticket.title}`,
        targetType: 'ticket',
        targetId: ticket.id,
        now,
      });
    }
  }

  return { ticket, approval, queue, policy };
}

/**
 * The next ticket key. Shared, because two callers inventing their own numbers
 * is how you get a duplicate key — the agent create used to mint
 * `TKT-${random 1000..9999}`, which can collide with a seeded record.
 */
export function nextTicketKey(tickets) {
  let max = 4800;
  for (const tk of tickets || []) {
    const m = /(\d+)\s*$/.exec(tk.key || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `TKT-${max + 1}`;
}
