export function evaluateSystemDesign({
  communication = 'sync',
  dataOwnership = 'owned',
  recovery = 'timeout',
  paymentUp = true,
} = {}) {
  const sync = communication === 'sync'
  const shared = dataOwnership === 'shared'
  const saga = recovery === 'saga'

  const healthyLatencyMs = sync ? 430 : 85
  const outageLatencyMs = sync ? 900 : 90
  const clientStatus = paymentUp ? (sync ? 200 : 202) : (sync ? 503 : 202)
  const orderState = paymentUp
    ? (sync ? 'CONFIRMED' : 'PENDING_PAYMENT')
    : sync
      ? 'NOT_CONFIRMED'
      : saga
        ? 'PENDING_COMPENSATION'
        : 'PENDING_RETRY'

  const findings = [
    {
      id: 'LATENCY',
      tone: sync ? 'warn' : 'ok',
      value: `${paymentUp ? healthyLatencyMs : outageLatencyMs}ms client wait`,
      detail: sync ? 'Caller Payment cevabını bekler.' : 'Caller event kabulünden sonra serbest kalır.',
    },
    {
      id: 'DATA OWNERSHIP',
      tone: shared ? 'risk' : 'ok',
      value: shared ? 'SCHEMA COUPLED' : 'ISOLATED',
      detail: shared ? 'Order ve Payment aynı schema değişikliğine bağlanır.' : 'Her servis kendi persistence modelini yönetir.',
    },
    {
      id: 'CONSISTENCY',
      tone: !sync || saga ? 'warn' : 'ok',
      value: shared ? 'SHARED TX PRESSURE' : (!sync || saga ? 'EVENTUAL' : 'LOCAL + API'),
      detail: !sync || saga ? 'Cross-service state zaman içinde yakınsar.' : 'Request sonucu anlık görünür; servisler yine ayrı local transaction tutar.',
    },
    {
      id: 'RECOVERY',
      tone: saga ? 'ok' : 'warn',
      value: saga ? 'BUSINESS COMPENSATION' : 'TIMEOUT / RETRY',
      detail: saga ? 'Tamamlanmış business adımları semantic compensation ile telafi edilir.' : 'Transient failure teknik retry/circuit breaker ile yönetilir.',
    },
  ]

  const deploymentCoupled = shared
  const runtimeCoupled = sync
  const outageContained = !shared && (!sync || saga)

  return {
    clientStatus,
    clientLatencyMs: paymentUp ? healthyLatencyMs : outageLatencyMs,
    orderState,
    paymentState: paymentUp ? (sync ? 'CAPTURED' : 'EVENT_QUEUED') : 'UNAVAILABLE',
    findings,
    deploymentCoupled,
    runtimeCoupled,
    outageContained,
    verdict: shared
      ? 'DEPLOYMENT COUPLING'
      : paymentUp
        ? (sync ? 'SIMPLE BUT RUNTIME-COUPLED' : 'DECOUPLED / EVENTUAL')
        : outageContained
          ? 'FAILURE CONTAINED'
          : 'FAILURE PROPAGATES',
  }
}
