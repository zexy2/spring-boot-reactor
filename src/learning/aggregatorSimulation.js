const SOURCE_CONFIG = [
  { id: 'USER', up: true, latencyMs: 120, required: true, calls: 0 },
  { id: 'ORDER', up: true, latencyMs: 280, required: false, calls: 0 },
  { id: 'PAYMENT', up: true, latencyMs: 450, required: false, calls: 0 },
]

export function createAggregatorState() {
  return {
    sources: SOURCE_CONFIG.map((source) => ({ ...source })),
    runs: 0,
    nextEventId: 1,
    events: [],
    last: null,
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

export function setAggregatorSourceHealth(state, sourceId, up) {
  const target = state.sources.find((source) => source.id === sourceId)
  if (!target || target.up === up) return state
  const sources = state.sources.map((source) => source.id === sourceId ? { ...source, up } : source)
  return record(state, { sources }, `${sourceId} source ${up ? 'UP' : 'DOWN'} oldu.`, up ? 'ok' : 'warn')
}

export function setAggregatorSourceLatency(state, sourceId, latencyMs) {
  const latency = Math.max(0, Number(latencyMs) || 0)
  const target = state.sources.find((source) => source.id === sourceId)
  if (!target || target.latencyMs === latency) return state
  const sources = state.sources.map((source) => source.id === sourceId ? { ...source, latencyMs: latency } : source)
  return record(state, { sources }, `${sourceId} latency ${latency}ms oldu.`)
}

export function runAggregator(state, { timeoutMs = 600, partialAllowed = true } = {}) {
  const safeTimeout = Math.max(1, Number(timeoutMs) || 1)
  const outcomes = state.sources.map((source) => {
    if (!source.up) {
      return { id: source.id, required: source.required, status: 'ERROR', waitMs: 0, latencyMs: source.latencyMs }
    }
    if (source.latencyMs > safeTimeout) {
      return { id: source.id, required: source.required, status: 'TIMEOUT', waitMs: safeTimeout, latencyMs: source.latencyMs }
    }
    return { id: source.id, required: source.required, status: 'OK', waitMs: source.latencyMs, latencyMs: source.latencyMs }
  })

  const missing = outcomes.filter((outcome) => outcome.status !== 'OK')
  const requiredMissing = missing.some((outcome) => outcome.required)
  const timeoutMissing = missing.some((outcome) => outcome.status === 'TIMEOUT')
  const full = missing.length === 0
  const partial = !full && !requiredMissing && partialAllowed
  const status = full || partial ? 200 : timeoutMissing ? 504 : 502
  const parallelMs = Math.max(...outcomes.map((outcome) => outcome.waitMs), 0)
  const sequentialMs = outcomes.reduce((sum, outcome) => sum + outcome.waitMs, 0)
  const data = Object.fromEntries(outcomes
    .filter((outcome) => outcome.status === 'OK')
    .map((outcome) => [outcome.id.toLowerCase(), `${outcome.id.toLowerCase()}-data`]))
  const response = status === 200
    ? {
        data,
        complete: full,
        partial,
        missingSources: missing.map((outcome) => outcome.id),
      }
    : null

  const sources = state.sources.map((source) => ({ ...source, calls: source.calls + 1 }))
  const last = {
    runId: state.runs + 1,
    status,
    full,
    partial,
    outcomes,
    parallelMs,
    sequentialMs,
    response,
  }
  const summary = full
    ? `3/3 kaynak birleşti; paralel cevap ${parallelMs}ms.`
    : partial
      ? `${3 - missing.length}/3 kaynakla partial response üretildi.`
      : `Aggregator ${status} döndürdü; response oluşturulmadı.`
  return record(state, { sources, runs: state.runs + 1, last }, summary, status === 200 ? (partial ? 'warn' : 'ok') : 'error')
}
