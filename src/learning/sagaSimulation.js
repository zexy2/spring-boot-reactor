// Educational orchestration Saga: independent local commits plus compensating actions.
// In-memory deterministic model; real services require durable workflow state and idempotency keys.
export function createSagaState() {
  return {
    phase: 'idle',
    order: 'NEW',
    payment: 'NOT_CHARGED',
    inventory: 'NOT_CHECKED',
    outbox: 'EMPTY',
    outboxAttempts: 0,
    readModel: 'NEW',
    charges: 0,
    refunds: 0,
    ignoredDuplicates: 0,
    nextEventId: 1,
    events: [],
  }
}

function record(state, updates, service, event, description, tone = 'info') {
  return {
    ...state,
    ...updates,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, service, event, description, tone }].slice(-14),
  }
}

export function startSaga(state) {
  if (state.phase !== 'idle') return state
  return record(state, { phase: 'payment', order: 'PENDING' },
    'ORDER', 'OrderCreated', 'Sipariş local olarak kaydedildi. Payment adımı bekleniyor.')
}

export function chargeSagaPayment(state) {
  if (state.phase !== 'payment') return state
  return record(state, { phase: 'payment_outbox', payment: 'CHARGED', charges: 1, outbox: 'PENDING' },
    'PAYMENT', 'PaymentCharged', 'Ödeme ve Outbox kaydı aynı local transaction ile tamamlandı. Broker yayını henüz bekliyor.', 'ok')
}

export function publishOutbox(state, { publisherAvailable = true } = {}) {
  if (state.phase !== 'payment_outbox') return state
  const outboxAttempts = state.outboxAttempts + 1
  if (!publisherAvailable) {
    return record(state, { outboxAttempts },
      'OUTBOX', 'OutboxPublishFailed', 'Publisher erişilemedi. DB içindeki Outbox kaydı silinmedi; tekrar denenecek.', 'error')
  }
  return record(state, { phase: 'inventory', outbox: 'PUBLISHED', outboxAttempts },
    'OUTBOX', 'OutboxPublished', 'PaymentCharged event’i Outbox üzerinden broker’a yayınlandı; Inventory adımı açıldı.', 'ok')
}

export function redeliverSagaPayment(state, { idempotent = true } = {}) {
  // This exercise replays deliveries while the workflow is active. A production
  // consumer must also deduplicate messages arriving after terminal states.
  if (!['inventory', 'compensation', 'compensation_failed'].includes(state.phase)) return state
  if (idempotent) {
    return record(state, { ignoredDuplicates: state.ignoredDuplicates + 1 },
      'PAYMENT', 'DuplicateIgnored', 'Aynı event ID işlendiği için ikinci charge oluşmadı.', 'ok')
  }
  return record(state, { charges: state.charges + 1, payment: 'CHARGED' },
    'PAYMENT', 'DuplicateCharged', 'Idempotency kapalı: aynı event ikinci kez ödeme aldı!', 'error')
}

export function decideSagaInventory(state, { available = true } = {}) {
  if (state.phase !== 'inventory') return state
  if (available) {
    return record(state, { phase: 'confirmed', order: 'CONFIRMED', inventory: 'RESERVED' },
      'INVENTORY', 'InventoryReserved', 'Stok ayrıldı; Order CONFIRMED event’i üretildi.', 'ok')
  }
  return record(state, { phase: 'compensation', inventory: 'REJECTED' },
    'INVENTORY', 'InventoryRejected', 'Stok yok. Payment charge geri alınmadı; refund telafisi gerekiyor.', 'error')
}

export function compensateSaga(state, { refundAvailable = true } = {}) {
  if (!['compensation', 'compensation_failed'].includes(state.phase)) return state
  if (!refundAvailable) {
    return record(state, { phase: 'compensation_failed' },
      'PAYMENT', 'RefundFailed', 'Refund servisi hata verdi. Saga durdu; daha sonra tekrar denenmeli.', 'error')
  }
  const refunds = state.refunds + 1
  const fullyCompensated = refunds === state.charges
  return record(state, {
    refunds,
    payment: fullyCompensated ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
    phase: fullyCompensated ? 'cancelled' : 'compensation',
    order: fullyCompensated ? 'CANCELLED' : 'PENDING',
  }, 'PAYMENT', 'RefundIssued', fullyCompensated
    ? 'Tüm charge etkileri iade edildi; Order CANCELLED olarak kapandı.'
    : `İade gerçekleşti, ancak ${state.charges - refunds} ek charge daha telafi bekliyor.`, fullyCompensated ? 'ok' : 'warn')
}

export function syncSagaReadModel(state) {
  if (state.readModel === state.order) return state
  return record(state, { readModel: state.order },
    'PROJECTION', 'ReadModelUpdated', `Read model gecikmeli olarak ${state.order} durumuna ulaştı.`, 'info')
}
