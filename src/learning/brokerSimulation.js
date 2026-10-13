// Controlled at-least-once queue model for teaching. Messages stay in this in-memory
// simulation while the UI is open; real durability requires broker configuration.
export const MAX_BROKER_DELIVERIES = 3

export function createBrokerState() {
  return {
    online: true,
    nextId: 1,
    nextLogId: 1,
    ready: [],
    inFlight: null,
    dlq: [],
    processedIds: [],
    stats: { published: 0, deliveries: 0, acked: 0, payments: 0, failures: 0, deduplicated: 0, lostAcks: 0 },
    log: [],
  }
}

function record(state, updates, tone, message) {
  return {
    ...state,
    ...updates,
    nextLogId: state.nextLogId + 1,
    log: [{ id: state.nextLogId, tone, message }, ...state.log].slice(0, 8),
  }
}

export function publishOrderEvent(state) {
  const id = `EVT-${String(state.nextId).padStart(3, '0')}`
  return record(state, {
    nextId: state.nextId + 1,
    ready: [...state.ready, { id, attempts: 0 }],
    stats: { ...state.stats, published: state.stats.published + 1 },
  }, 'info', `${id} yayınlandı. Consumer çalışmasa bile broker kuyruğunda bekliyor.`)
}

export function deliverBrokerMessage(state) {
  if (!state.online || state.inFlight || !state.ready.length) return state
  const [head, ...rest] = state.ready
  const delivered = { ...head, attempts: head.attempts + 1 }
  return record(state, {
    ready: rest,
    inFlight: delivered,
    stats: { ...state.stats, deliveries: state.stats.deliveries + 1 },
  }, 'info', `${head.id} Payment Consumer'a teslim edildi (deneme ${delivered.attempts}). ACK bekliyor.`)
}

export function setBrokerConsumerOnline(state, online) {
  if (state.online === online) return state
  if (online) return record(state, { online: true }, 'ok', 'Consumer yeniden bağlandı; kuyruktaki mesajlar teslim edilebilir.')
  const inFlight = state.inFlight
  return record(state, {
    online: false,
    inFlight: null,
    ready: inFlight ? [inFlight, ...state.ready] : state.ready,
  }, 'warn', inFlight
    ? `${inFlight.id} ACK almadan bağlantı koptu; yeniden teslim edilmek üzere kuyruğa döndü.`
    : 'Consumer DOWN. Producer yayınlamaya, broker mesajları biriktirmeye devam eder.')
}

export function settleBrokerMessage(state, { failure = 'healthy', idempotent = true, loseAck = false } = {}) {
  if (!state.online || !state.inFlight) return state
  const message = state.inFlight
  const alreadyProcessed = state.processedIds.includes(message.id)
  const failed = !alreadyProcessed && (failure === 'poison' || (failure === 'transient' && message.attempts === 1))

  if (failed) {
    const dead = message.attempts >= MAX_BROKER_DELIVERIES
    return record(state, {
      inFlight: null,
      ready: dead ? state.ready : [...state.ready, message],
      dlq: dead ? [...state.dlq, message] : state.dlq,
      stats: { ...state.stats, failures: state.stats.failures + 1 },
    }, 'error', dead
      ? `${message.id} ${message.attempts} kez başarısız oldu; DLQ'ya taşındı.`
      : `${message.id} işlenemedi (deneme ${message.attempts}). Kuyruğa geri alındı; sınırlı retry.`)
  }

  const duplicateIgnored = alreadyProcessed && idempotent
  const processedIds = alreadyProcessed ? state.processedIds : [...state.processedIds, message.id]
  const stats = {
    ...state.stats,
    payments: state.stats.payments + (duplicateIgnored ? 0 : 1),
    deduplicated: state.stats.deduplicated + (duplicateIgnored ? 1 : 0),
    acked: state.stats.acked + (loseAck ? 0 : 1),
    lostAcks: state.stats.lostAcks + (loseAck ? 1 : 0),
  }
  return record(state, {
    inFlight: null,
    processedIds,
    ready: loseAck ? [...state.ready, message] : state.ready,
    stats,
  }, duplicateIgnored ? 'ok' : loseAck ? 'warn' : 'ok', duplicateIgnored
    ? `${message.id} daha önce işlendi; idempotency yeni ödeme oluşturmadı${loseAck ? ', ACK yine kayboldu' : ', ACK gönderildi'}.`
    : loseAck
      ? `${message.id} business işlemi yaptı ama ACK kayboldu. Aynı event yeniden teslim edilecek!`
      : alreadyProcessed
        ? `${message.id} tekrar işlendi; idempotency OFF olduğu için ikinci business etkisi oluştu.`
        : `${message.id} işlendi; ACK ile broker'dan çıkarıldı.`)
}

export function redriveDeadLetter(state) {
  if (!state.dlq.length) return state
  const [first, ...rest] = state.dlq
  return record(state, {
    dlq: rest,
    ready: [...state.ready, { ...first, attempts: 0 }],
  }, 'warn', `${first.id} DLQ'dan operatör tarafından yeniden kuyruğa alındı; hata nedeni düzeltilmeli.`)
}
