function pod(slot, generation = 1, restarts = 0) {
  return { slot, generation, alive: true, live: true, ready: true, restarts }
}

export function createKubernetesControlLoopState() {
  return {
    desiredReplicas: 3,
    pods: [pod(1), pod(2), pod(3)],
    requestCount: 0,
    lastRequest: null,
    controllerMessage: 'Desired state stable · 3/3 replica',
    blockedReason: null,
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

export function kubernetesReadyPods(state) {
  return state.pods.filter((item) => item.alive && item.live && item.ready)
}

export function kubernetesAlivePods(state) {
  return state.pods.filter((item) => item.alive)
}

export function deleteKubernetesPod(state) {
  const index = state.pods.findIndex((item) => item.alive)
  if (index < 0) return state
  const pods = state.pods.map((item, i) => i === index ? { ...item, alive: false, live: false, ready: false } : item)
  const target = pods[index]
  return record(state, {
    pods,
    controllerMessage: `Deployment drift detected · Pod ${target.slot} DOWN · replacement pending`,
    blockedReason: null,
  }, `Pod ${target.slot} silindi; alive replica ${kubernetesAlivePods({ ...state, pods }).length}/${state.desiredReplicas}.`, 'warn')
}

export function reconcileKubernetesDeployment(state) {
  const alive = kubernetesAlivePods(state).length
  if (alive >= state.desiredReplicas) {
    return record(state, {
      controllerMessage: `ReplicaSet stable · ${alive}/${state.desiredReplicas}; replacement yok`,
      blockedReason: null,
    }, 'Deployment controller replica drift bulmadı.', 'info')
  }
  const index = state.pods.findIndex((item) => !item.alive)
  if (index < 0) return state
  const previous = state.pods[index]
  const replacement = pod(previous.slot, previous.generation + 1, 0)
  const pods = state.pods.map((item, i) => i === index ? replacement : item)
  return record(state, {
    pods,
    controllerMessage: `Replacement Pod ${replacement.slot} gen ${replacement.generation} READY · desired state restored`,
    blockedReason: null,
  }, `Deployment controller Pod ${replacement.slot} replacement oluşturdu; ${state.desiredReplicas}/${state.desiredReplicas} alive.`, 'ok')
}

export function failKubernetesReadiness(state) {
  const index = state.pods.findIndex((item) => item.alive && item.live && item.ready)
  if (index < 0) return state
  const pods = state.pods.map((item, i) => i === index ? { ...item, ready: false } : item)
  const target = pods[index]
  return record(state, {
    pods,
    controllerMessage: `Pod ${target.slot} readiness FAIL · process alive · Service endpoint dışı`,
    blockedReason: null,
  }, `Readiness probe Pod ${target.slot} için FAIL; container restart edilmedi.`, 'warn')
}

export function restoreKubernetesReadiness(state) {
  const index = state.pods.findIndex((item) => item.alive && item.live && !item.ready)
  if (index < 0) return state
  const pods = state.pods.map((item, i) => i === index ? { ...item, ready: true } : item)
  const target = pods[index]
  return record(state, {
    pods,
    controllerMessage: `Pod ${target.slot} readiness PASS · Service endpoint listesine döndü`,
    blockedReason: null,
  }, `Readiness Pod ${target.slot} için tekrar PASS.`, 'ok')
}

export function failKubernetesLiveness(state) {
  const index = state.pods.findIndex((item) => item.alive && item.live)
  if (index < 0) return state
  const pods = state.pods.map((item, i) => i === index ? { ...item, live: false, ready: false } : item)
  const target = pods[index]
  return record(state, {
    pods,
    controllerMessage: `Kubelet liveness FAIL · Pod ${target.slot} container restart pending`,
    blockedReason: null,
  }, `Liveness probe Pod ${target.slot} için FAIL; endpoint çıkarıldı, kubelet restart bekliyor.`, 'error')
}

export function reconcileKubernetesKubelet(state) {
  const index = state.pods.findIndex((item) => item.alive && !item.live)
  if (index < 0) return record(state, { blockedReason: null }, 'Kubelet restart gerektiren container bulmadı.', 'info')
  const current = state.pods[index]
  const pods = state.pods.map((item, i) => i === index ? { ...item, live: true, ready: true, restarts: item.restarts + 1 } : item)
  return record(state, {
    pods,
    controllerMessage: `Kubelet Pod ${current.slot} container'ını restart etti · readiness PASS`,
    blockedReason: null,
  }, `Pod ${current.slot} aynı Pod generation içinde container restart #${current.restarts + 1}.`, 'ok')
}

export function routeKubernetesServiceRequest(state) {
  const ready = kubernetesReadyPods(state)
  const requestCount = state.requestCount + 1
  if (!ready.length) {
    return record(state, {
      requestCount,
      lastRequest: { number: requestCount, status: 503, targetSlot: null, readyEndpoints: 0 },
      blockedReason: 'SERVICE 503: ready endpoint yok.',
    }, `Request #${requestCount} → 503 · no ready endpoint.`, 'error')
  }
  const target = ready[(requestCount - 1) % ready.length]
  return record(state, {
    requestCount,
    lastRequest: { number: requestCount, status: 200, targetSlot: target.slot, readyEndpoints: ready.length },
    blockedReason: null,
  }, `Request #${requestCount} → Service → Pod ${target.slot} · ${ready.length} ready endpoint.`, 'ok')
}
