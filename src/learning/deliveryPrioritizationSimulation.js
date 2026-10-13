export const DELIVERY_WORK_ITEMS = [
  { id: 'payment', title: 'Prod payment failure', impact: 'CRITICAL', urgency: 'NOW', effort: 2, risk: 'revenue + users' },
  { id: 'release', title: 'Tomorrow release blocker', impact: 'HIGH', urgency: 'TODAY', effort: 3, risk: 'release slip' },
  { id: 'reporting', title: 'Reporting feature', impact: 'MEDIUM', urgency: 'SPRINT', effort: 4, risk: 'dependency', dependency: 'analytics' },
  { id: 'refactor', title: 'Refactor cleanup', impact: 'LOW', urgency: 'FLEXIBLE', effort: 2, risk: 'tech debt' },
]

const WORK_BY_ID = Object.fromEntries(DELIVERY_WORK_ITEMS.map((item) => [item.id, item]))

export function createDeliveryPrioritizationState() {
  return {
    order: ['reporting', 'payment', 'refactor', 'release'],
    inScope: { payment: true, release: true, reporting: true, refactor: true },
    incidentActive: true,
    analyticsReady: false,
    capacity: 5,
    assessment: 'NOT_RUN',
    reasons: [],
    nextEventId: 1,
    events: [],
  }
}

function record(state, updates, message, tone = 'info') {
  return {
    ...state,
    ...updates,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-18),
  }
}

function invalidate(state, updates, message) {
  return record(state, { ...updates, assessment: 'NOT_RUN', reasons: [] }, message, state.assessment === 'PASS' ? 'warn' : 'info')
}

export function moveDeliveryWork(state, id, direction) {
  const index = state.order.indexOf(id)
  if (index < 0) return state
  const target = direction === 'up' ? index - 1 : direction === 'down' ? index + 1 : index
  if (target < 0 || target >= state.order.length || target === index) return state
  const order = [...state.order]
  ;[order[index], order[target]] = [order[target], order[index]]
  return invalidate(state, { order }, `${WORK_BY_ID[id].title} ${direction === 'up' ? 'yukarı' : 'aşağı'} taşındı.`)
}

export function setDeliveryWorkScope(state, id, enabled) {
  if (!WORK_BY_ID[id] || state.inScope[id] === enabled) return state
  return invalidate(state, { inScope: { ...state.inScope, [id]: enabled } }, `${WORK_BY_ID[id].title} → ${enabled ? 'IN SCOPE' : 'DEFERRED'}.`)
}

export function setDeliveryIncidentActive(state, active) {
  if (state.incidentActive === active) return state
  return invalidate(state, { incidentActive: active }, `Production payment incident → ${active ? 'ACTIVE' : 'RESOLVED'}.`)
}

export function setDeliveryAnalyticsReady(state, ready) {
  if (state.analyticsReady === ready) return state
  return invalidate(state, { analyticsReady: ready }, `Analytics dependency → ${ready ? 'READY' : 'BLOCKED'}.`)
}

export function setDeliveryCapacity(state, capacity) {
  if (![5, 7].includes(capacity) || state.capacity === capacity) return state
  return invalidate(state, { capacity }, `Team capacity → ${capacity} effort point.`)
}

export function scopedDeliveryEffort(state) {
  return DELIVERY_WORK_ITEMS.filter((item) => state.inScope[item.id]).reduce((sum, item) => sum + item.effort, 0)
}

export function assessDeliveryPlan(state) {
  const scopedOrder = state.order.filter((id) => state.inScope[id])
  const reasons = []
  const effort = scopedDeliveryEffort(state)

  if (effort > state.capacity) reasons.push(`capacity ${effort}/${state.capacity}: scope küçült veya kapasiteyi yeniden konuş`)
  if (state.incidentActive && !state.inScope.payment) reasons.push('aktif production incident scope dışında bırakılamaz')
  if (state.incidentActive && scopedOrder[0] !== 'payment') reasons.push('aktif revenue incident ilk sırada olmalı')
  if (!state.inScope.release) reasons.push('yarınki release blocker plan dışında bırakılamaz')
  const releaseIndex = scopedOrder.indexOf('release')
  const firstLowerPriorityIndex = scopedOrder.findIndex((id) => id === 'reporting' || id === 'refactor')
  if (releaseIndex >= 0 && firstLowerPriorityIndex >= 0 && releaseIndex > firstLowerPriorityIndex) {
    reasons.push('release blocker feature/refactor işlerinden önce ele alınmalı')
  }
  if (state.inScope.reporting && !state.analyticsReady) reasons.push('reporting dependency BLOCKED; hazır olmayan işi scope’a alma')

  if (reasons.length) {
    return record(state, { assessment: 'BLOCKED', reasons }, `Plan BLOCKED · ${reasons.join(' · ')}.`, 'error')
  }
  return record(state, { assessment: 'PASS', reasons: [] }, `Plan PASS · ${effort}/${state.capacity} capacity · kritik işler önce · dependency uyumlu.`, 'ok')
}
