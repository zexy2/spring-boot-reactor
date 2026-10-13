const INSTANCE_IDS = ['P1', 'P2', 'P3']

export function createBalancerState() {
  return {
    instances: INSTANCE_IDS.map((id) => ({ id, processUp: true, ready: true, registered: true, requests: 0 })),
    cursor: 0,
    totalRequests: 0,
    failedRequests: 0,
    lastRoute: null,
    nextEventId: 1,
    events: [],
  }
}

function record(state, updates, message, tone = 'info') {
  return {
    ...state,
    ...updates,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-16),
  }
}

export function setInstanceProcess(state, instanceId, processUp) {
  const target = state.instances.find((instance) => instance.id === instanceId)
  if (!target || target.processUp === processUp) return state
  const instances = state.instances.map((instance) => instance.id === instanceId
    // A restarted process must pass readiness before discovery can register it again.
    ? { ...instance, processUp, ready: false }
    : instance)
  const registryIsStale = target.registered !== false
  return record(
    state,
    { instances },
    `${instanceId} process ${processUp ? 'UP' : 'DOWN'} oldu.${processUp ? ' Readiness probe geçene kadar trafik alamaz.' : ''}${registryIsStale ? ' Registry henüz eski bilgiyi tutuyor.' : ''}`,
    processUp ? 'ok' : 'warn',
  )
}

export function setInstanceReadiness(state, instanceId, ready) {
  const target = state.instances.find((instance) => instance.id === instanceId)
  if (!target || !target.processUp || target.ready === ready) return state
  const instances = state.instances.map((instance) => instance.id === instanceId
    ? { ...instance, ready }
    : instance)
  const registryIsStale = target.registered !== (target.processUp && ready)
  return record(
    state,
    { instances },
    `${instanceId} readiness ${ready ? 'READY' : 'NOT READY'} oldu.${registryIsStale ? ' Registry health check bekliyor; mevcut aday listesi henüz değişmedi.' : ''}`,
    ready ? 'ok' : 'warn',
  )
}

export function runDiscoveryHealthCheck(state) {
  const isDiscoverable = (instance) => instance.processUp && instance.ready
  const changed = state.instances.filter((instance) => instance.registered !== isDiscoverable(instance))
  if (!changed.length) {
    const warming = state.instances.filter((instance) => instance.processUp && !instance.ready)
    return record(state, {}, warming.length
      ? `Health check tamamlandı; registry güncel. ${warming.map((instance) => instance.id).join(', ')} readiness bekliyor ve route edilmeyecek.`
      : 'Health check tamamlandı; registry zaten güncel.', 'ok')
  }
  const instances = state.instances.map((instance) => ({
    ...instance,
    registered: isDiscoverable(instance),
  }))
  const summary = changed.map((instance) => `${instance.id}:${isDiscoverable(instance) ? 'REGISTER' : 'EVICT'}`).join(', ')
  const warming = state.instances.filter((instance) => instance.processUp && !instance.ready)
  const warmingNote = warming.length ? ` ${warming.map((instance) => instance.id).join(', ')} process UP olsa da readiness geçmediği için dışarıda kaldı.` : ''
  return record(state, { instances }, `Health check registry'yi güncelledi: ${summary}.${warmingNote}`, 'ok')
}

export function routeBalancerRequest(state) {
  const candidates = state.instances.filter((instance) => instance.registered)
  const totalRequests = state.totalRequests + 1
  if (!candidates.length) {
    return record(
      state,
      { totalRequests, failedRequests: state.failedRequests + 1, lastRoute: 'NO_INSTANCE' },
      'Discovery boş liste döndürdü; request route edilemedi.',
      'error',
    )
  }

  const selected = candidates[state.cursor % candidates.length]
  const cursor = state.cursor + 1
  const instances = state.instances.map((instance) => instance.id === selected.id
    ? { ...instance, requests: instance.requests + 1 }
    : instance)

  if (!selected.processUp || !selected.ready) {
    return record(
      state,
      {
        instances,
        cursor,
        totalRequests,
        failedRequests: state.failedRequests + 1,
        lastRoute: selected.id,
      },
      `Load balancer ${selected.id} seçti; registry stale olduğu için instance hazır değil ve request başarısız oldu.`,
      'error',
    )
  }

  return record(
    state,
    { instances, cursor, totalRequests, lastRoute: selected.id },
    `Discovery adayları içinden round-robin ${selected.id} seçildi; request başarılı.`,
    'ok',
  )
}

export function routeBalancerBatch(state, count = 6) {
  const safeCount = Math.max(0, Math.min(12, Number(count) || 0))
  let next = state
  for (let i = 0; i < safeCount; i += 1) next = routeBalancerRequest(next)
  return next
}
