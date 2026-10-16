const SERVICE_CONFIG = [
  { id: 'CATALOG', prefix: '/catalog', up: true, latencyMs: 120, hits: 0, commitOnTimeout: false },
  { id: 'ORDER', prefix: '/orders', up: true, latencyMs: 180, hits: 0, commitOnTimeout: false },
  { id: 'PAYMENT', prefix: '/payments', up: true, latencyMs: 260, hits: 0, commitOnTimeout: true },
]

export function createGatewayState() {
  return {
    requestCount: 0,
    rejected: 0,
    backendAttempts: 0,
    paymentCharges: 0,
    rateWindowCount: 0,
    rateLimit: 3,
    services: SERVICE_CONFIG.map((service) => ({ ...service })),
    last: null,
    nextEventId: 1,
    events: [],
  }
}

function addEvent(state, updates, message, tone = 'info') {
  return {
    ...state,
    ...updates,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-18),
  }
}

function complete(state, requestId, status, outcome, trace, extra = {}) {
  const rejected = status === 200 ? state.rejected : state.rejected + 1
  const next = addEvent(
    state,
    {
      requestCount: requestId,
      rejected,
      last: { requestId, status, outcome, trace, ...extra },
    },
    `#${requestId} ${status} · ${outcome}`,
    status === 200 ? 'ok' : status >= 500 ? 'error' : 'warn',
  )
  return next
}

export function setGatewayServiceHealth(state, serviceId, up) {
  const target = state.services.find((service) => service.id === serviceId)
  if (!target || target.up === up) return state
  const services = state.services.map((service) => service.id === serviceId ? { ...service, up } : service)
  return addEvent(state, { services }, `${serviceId} backend ${up ? 'UP' : 'DOWN'} oldu.`, up ? 'ok' : 'warn')
}

export function setGatewayServiceLatency(state, serviceId, latencyMs) {
  const latency = Math.max(0, Number(latencyMs) || 0)
  const target = state.services.find((service) => service.id === serviceId)
  if (!target || target.latencyMs === latency) return state
  const services = state.services.map((service) => service.id === serviceId ? { ...service, latencyMs: latency } : service)
  return addEvent(state, { services }, `${serviceId} latency ${latency}ms olarak ayarlandı.`, 'info')
}

export function setGatewayCommitOnTimeout(state, serviceId, enabled) {
  const target = state.services.find((service) => service.id === serviceId)
  if (!target || target.commitOnTimeout === enabled) return state
  const services = state.services.map((service) => service.id === serviceId
    ? { ...service, commitOnTimeout: enabled }
    : service)
  return addEvent(state, { services }, `${serviceId} timeout sonrası commit ${enabled ? 'açık' : 'kapalı'}.`, 'info')
}

export function resetGatewayRateWindow(state) {
  if (!state.rateWindowCount) return state
  return addEvent(state, { rateWindowCount: 0 }, 'Rate-limit window sıfırlandı.', 'ok')
}

export function runGatewayRequest(state, {
  path = '/orders',
  method = 'GET',
  tokenValid = true,
  rateLimitEnabled = true,
  timeoutMs = 500,
  retryOnTimeout = false,
  idempotencyKeyEnabled = false,
} = {}) {
  const requestMethod = method === 'POST' ? 'POST' : 'GET'
  const requestId = state.requestCount + 1
  const trace = []

  if (!tokenValid) {
    trace.push({ stage: 'AUTH', result: '401', detail: 'JWT doğrulanamadı.' })
    return complete(state, requestId, 401, 'Gateway auth aşamasında request kesildi.', trace)
  }
  trace.push({ stage: 'AUTH', result: 'PASS', detail: 'JWT geçerli.' })

  if (rateLimitEnabled && state.rateWindowCount >= state.rateLimit) {
    trace.push({ stage: 'RATE LIMIT', result: '429', detail: `Limit ${state.rateLimit}/${state.rateLimit}.` })
    return complete(state, requestId, 429, 'Rate limiter backend çağrısından önce request’i reddetti.', trace)
  }

  const rateWindowCount = rateLimitEnabled ? state.rateWindowCount + 1 : state.rateWindowCount
  trace.push({
    stage: 'RATE LIMIT',
    result: rateLimitEnabled ? 'PASS' : 'BYPASS',
    detail: rateLimitEnabled ? `Window ${rateWindowCount}/${state.rateLimit}.` : 'Policy kapalı.',
  })

  const service = state.services.find((candidate) => path === candidate.prefix || path.startsWith(`${candidate.prefix}/`))
  if (!service) {
    trace.push({ stage: 'ROUTE', result: '404', detail: `${path} için route tanımı yok.` })
    return complete({ ...state, rateWindowCount }, requestId, 404, 'Gateway route eşlemesi bulamadı.', trace)
  }
  trace.push({ stage: 'ROUTE', result: service.id, detail: `${requestMethod} ${service.prefix} route’u ${service.id} servisine eşlendi.` })

  const maxAttempts = retryOnTimeout ? 2 : 1
  let backendAttempts = state.backendAttempts
  let paymentCharges = state.paymentCharges
  let attempts = 0
  let status = 504
  let responseDetail
  let serviceHits = service.hits

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt
    backendAttempts += 1
    serviceHits += 1

    if (!service.up) {
      status = 503
      responseDetail = `${service.id} backend DOWN.`
    } else if (service.latencyMs > timeoutMs) {
      status = 504
      responseDetail = `${service.latencyMs}ms > ${timeoutMs}ms gateway timeout.`
      if (service.id === 'PAYMENT' && requestMethod === 'POST' && service.commitOnTimeout) {
        if (!idempotencyKeyEnabled || attempt === 1) {
          paymentCharges += 1
          responseDetail += ' Backend charge’ı commit etti; response client’a yetişmedi.'
        } else {
          responseDetail += ' Aynı idempotency key ikinci charge’ı engelledi.'
        }
      }
    } else {
      status = 200
      responseDetail = `${service.id} ${service.latencyMs}ms içinde cevap verdi.`
    }

    trace.push({ stage: 'PROXY', result: String(status), detail: `Attempt ${attempt}/${maxAttempts}: ${responseDetail}` })
    if (status !== 504 || attempt === maxAttempts) break

    trace.push({ stage: 'RETRY', result: 'RETRY', detail: 'Gateway aynı client request’ini timeout sonrası bir kez daha proxy ediyor.' })
  }

  const services = state.services.map((candidate) => candidate.id === service.id
    ? { ...candidate, hits: serviceHits }
    : candidate)
  const attempted = { ...state, services, rateWindowCount, backendAttempts, paymentCharges }
  const effectCount = paymentCharges - state.paymentCharges
  const retryNote = attempts > 1 ? ` ${attempts} backend denemesi yapıldı.` : ''
  const effectNote = effectCount
    ? ` Payment backend’inde ${effectCount} charge commit oldu${effectCount > 1 ? '; retry duplicate yan etki üretti' : ''}.`
    : ''
  const outcome = status === 200
    ? `${service.id} cevabı client’a iletildi.${retryNote}`
    : status === 504
      ? `${service.id} zamanında cevap vermedi.${retryNote}${effectNote}`
      : `${service.id} backend erişilemiyor; timeout retry yapılmadı.`
  return complete(attempted, requestId, status, outcome, trace, {
    service: service.id,
    method: requestMethod,
    attempts,
    paymentEffects: effectCount,
  })
}
