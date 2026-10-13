export const DDD_CONTEXTS = ['ORDER', 'PAYMENT', 'SHIPPING']

const LANGUAGE = {
  Customer: {
    ORDER: 'Sipariş veren buyer; order eligibility ve purchase history önemlidir.',
    PAYMENT: 'Ödemeyi yapan payer; billing identity ve risk/fraud sinyalleri önemlidir.',
    SHIPPING: 'Teslimatı alacak recipient; adres ve teslimat tercihi önemlidir.',
  },
  Status: {
    ORDER: 'CREATED · PAID · CANCELLED',
    PAYMENT: 'AUTHORIZED · CAPTURED · REFUNDED',
    SHIPPING: 'LABELLED · IN_TRANSIT · DELIVERED',
  },
}

export const DDD_OWNERSHIP_CASES = [
  { id: 'money', label: 'Money', owner: 'ORDER', reason: 'Order toplamını ve para birimini taşıyan value object.' },
  { id: 'refund', label: 'Refund', owner: 'PAYMENT', reason: 'Tahsilat tersine çevirme ve refund policy Payment dilidir.' },
  { id: 'shipment', label: 'Shipment', owner: 'SHIPPING', reason: 'Carrier, tracking ve delivery lifecycle Shipping modelidir.' },
]

export function getContextMeaning(term, context) {
  return LANGUAGE[term]?.[context] ?? null
}

export function evaluateContextPlacement(caseId, targetContext) {
  const item = DDD_OWNERSHIP_CASES.find((candidate) => candidate.id === caseId)
  if (!item) return null
  const match = item.owner === targetContext
  return {
    ...item,
    targetContext,
    match,
    verdict: match ? 'BOUNDARY FIT' : 'CONTEXT LEAK',
    explanation: match
      ? `${item.label}, ${item.owner} ubiquitous language içinde doğal bir model.`
      : `${item.label} ${targetContext} içine taşınırsa ${item.owner} modelinin dili başka bounded context’e sızar.`,
  }
}

export function summarizeContextPlacements(placements = {}) {
  const results = DDD_OWNERSHIP_CASES.map((item) => evaluateContextPlacement(item.id, placements[item.id] ?? null))
  const placed = results.filter((result) => result.targetContext)
  const correct = placed.filter((result) => result.match).length
  const leaks = placed.filter((result) => !result.match).length
  return { results, placed: placed.length, correct, leaks, complete: placed.length === DDD_OWNERSHIP_CASES.length }
}
