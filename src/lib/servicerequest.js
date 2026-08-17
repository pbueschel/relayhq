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
