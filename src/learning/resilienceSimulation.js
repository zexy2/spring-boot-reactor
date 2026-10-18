// Deterministic teaching model: each click represents one completed caller request.
// A timeout means the caller stopped waiting; it does not prove Payment rolled back.
export function createResilienceState() {
  return {
    circuit: 'CLOSED',
    consecutiveFailures: 0,
    requests: 0,
    attempts: 0,
    blocked: 0,
    elapsedMs: 0,
    last: null,
    history: [],
  }
}

const FAILURE_THRESHOLD = 3

function paymentResult(dependency, attemptNumber) {
  if (dependency === 'healthy') return { latency: 250, status: 200 }
  if (dependency === 'down') return { latency: 80, status: 503 }
  if (dependency === 'flaky') return { latency: attemptNumber % 2 ? 1200 : 350, status: 200 }
  return { latency: 1200, status: 200 }
}

export function expireResilienceCooldown(previous) {
  if (previous.circuit !== 'OPEN') return previous
  return { ...previous, circuit: 'HALF_OPEN' }
}

export function runResilienceRequest(previous, { dependency = 'slow', timeout = 800, retries = 1, fallback = true } = {}) {
  const requestNumber = previous.requests + 1
  const trace = []
  let circuit = previous.circuit
  let consecutiveFailures = previous.consecutiveFailures
  let attempts = 0
  let elapsedMs = 0
  let blocked = 0
  let outcome = 'error'
  let message

  if (circuit === 'OPEN') {
    blocked = 1
    outcome = 'protected'
    trace.push({ kind: 'blocked', text: 'Circuit OPEN → Payment çağrısı yapılmadı', duration: 0 })
  } else {
    const probe = circuit === 'HALF_OPEN'
    const limit = probe ? 1 : 1 + Math.max(0, Math.min(2, retries))
    for (let index = 0; index < limit; index += 1) {
      const response = paymentResult(dependency, previous.attempts + attempts + 1)
      const timedOut = response.latency > timeout
      const duration = timedOut ? timeout : response.latency
      attempts += 1
      elapsedMs += duration
      trace.push({
        kind: timedOut || response.status !== 200 ? 'failure' : 'success',
        text: `Deneme ${attempts}: ${timedOut ? `TIMEOUT (${timeout}ms)` : `${response.status} (${duration}ms)`}`,
        duration,
      })
      if (!timedOut && response.status === 200) {
        outcome = 'success'
        break
      }
      outcome = timedOut ? 'timeout' : 'unavailable'
      if (index < limit - 1) {
        const backoff = 100 * 2 ** index
        elapsedMs += backoff
        trace.push({ kind: 'backoff', text: `Backoff ${backoff}ms → yeniden dene`, duration: backoff })
      }
    }

    if (outcome === 'success') {
      consecutiveFailures = 0
      circuit = 'CLOSED'
      if (probe) trace.push({ kind: 'transition', text: 'Probe başarılı → CLOSED', duration: 0 })
    } else {
      consecutiveFailures = probe ? FAILURE_THRESHOLD : consecutiveFailures + 1
      if (probe || consecutiveFailures >= FAILURE_THRESHOLD) {
        circuit = 'OPEN'
        trace.push({ kind: 'transition', text: 'Hata eşiği aşıldı → OPEN', duration: 0 })
      }
    }
  }

  if (outcome === 'success') message = `200 OK · ${attempts} deneme`
  else if (fallback) message = 'PENDING · ödeme doğrulanmalı (başarılı sayılmaz)'
  else message = outcome === 'protected' ? '503 · circuit OPEN / fast fail' : '503 · Payment yanıtı alınamadı'

  const last = { id: requestNumber, outcome, message, attempts, elapsedMs, trace, circuit }
  return {
    circuit,
    consecutiveFailures,
    requests: requestNumber,
    attempts: previous.attempts + attempts,
    blocked: previous.blocked + blocked,
    elapsedMs: previous.elapsedMs + elapsedMs,
    last,
    history: [last, ...previous.history].slice(0, 6),
  }
}
