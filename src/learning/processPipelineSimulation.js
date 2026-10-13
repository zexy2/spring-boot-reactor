export function createProcessPipelineState() {
  return {
    runs: 0,
    processedOrders: 0,
    last: null,
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

export function runProcessPipeline(state, {
  validPayload = true,
  authorized = true,
  enrichmentAvailable = true,
  processAvailable = true,
} = {}) {
  const runId = state.runs + 1
  const trace = []
  let context = { orderId: `ORD-${String(runId).padStart(3, '0')}`, amount: 1250 }

  if (!validPayload) {
    trace.push({ stage: 'VALIDATE', status: 'FAIL', detail: 'amount alanı geçersiz.' })
    return record(state, {
      runs: runId,
      last: { runId, status: 400, outcome: 'VALIDATION_FAILED', trace, context, sideEffect: false },
    }, `Run #${runId}: VALIDATE aşamasında durdu; side-effect oluşmadı.`, 'warn')
  }
  trace.push({ stage: 'VALIDATE', status: 'PASS', detail: 'Payload şeması ve alan kuralları geçti.' })

  if (!authorized) {
    trace.push({ stage: 'AUTHORIZE', status: 'FAIL', detail: 'Kullanıcı bu siparişi işleyemez.' })
    return record(state, {
      runs: runId,
      last: { runId, status: 403, outcome: 'FORBIDDEN', trace, context, sideEffect: false },
    }, `Run #${runId}: AUTHORIZE aşamasında durdu; PROCESS çalışmadı.`, 'warn')
  }
  trace.push({ stage: 'AUTHORIZE', status: 'PASS', detail: 'Yetki kontrolü geçti.' })

  if (!enrichmentAvailable) {
    trace.push({ stage: 'ENRICH', status: 'FAIL', detail: 'Customer profile dependency cevap vermedi.' })
    return record(state, {
      runs: runId,
      last: { runId, status: 503, outcome: 'ENRICHMENT_UNAVAILABLE', trace, context, sideEffect: false },
    }, `Run #${runId}: ENRICH aşamasında durdu; PROCESS side-effect üretmedi.`, 'error')
  }
  context = { ...context, customerTier: 'GOLD', riskScore: 18 }
  trace.push({ stage: 'ENRICH', status: 'PASS', detail: 'customerTier ve riskScore context’e eklendi.' })

  if (!processAvailable) {
    trace.push({ stage: 'PROCESS', status: 'FAIL', detail: 'Order writer kullanılamıyor; commit yapılmadı.' })
    return record(state, {
      runs: runId,
      last: { runId, status: 503, outcome: 'PROCESS_UNAVAILABLE', trace, context, sideEffect: false },
    }, `Run #${runId}: PROCESS başarısız; kalıcı sipariş yazılmadı.`, 'error')
  }

  trace.push({ stage: 'PROCESS', status: 'PASS', detail: 'Order kaydı commit edildi.' })
  return record(state, {
    runs: runId,
    processedOrders: state.processedOrders + 1,
    last: { runId, status: 201, outcome: 'ORDER_CREATED', trace, context, sideEffect: true },
  }, `Run #${runId}: tüm stage’ler geçti; ORDER_CREATED side-effect oluştu.`, 'ok')
}
