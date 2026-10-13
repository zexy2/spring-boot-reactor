const SERVICES = ['ORDER', 'PAYMENT', 'REPORT']

export function createSharedResourceState() {
  return {
    runs: 0,
    incidents: 0,
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
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-14),
  }
}

export function runSharedResourceMigration(state, {
  architecture = 'shared',
  strategy = 'breaking',
} = {}) {
  const directConsumers = architecture === 'shared' ? SERVICES : ['ORDER']
  const compatible = strategy === 'expand-contract'
  const brokenServices = compatible ? [] : [...directConsumers]
  const unaffectedServices = SERVICES.filter((service) => !brokenServices.includes(service))
  const runId = state.runs + 1
  const last = {
    runId,
    architecture,
    strategy,
    directConsumers,
    brokenServices,
    unaffectedServices,
    blastRadius: brokenServices.length,
    schemaBefore: ['customer_id', 'total'],
    schemaAfter: compatible ? ['customer_id', 'client_id', 'total'] : ['client_id', 'total'],
    migration: compatible
      ? 'ADD client_id + backfill; customer_id geçici olarak korunur'
      : 'RENAME customer_id TO client_id',
  }
  const incident = brokenServices.length > 0
  const summary = compatible
    ? `Run #${runId}: expand/contract ile eski consumer query’leri çalışmaya devam etti.`
    : `Run #${runId}: ${brokenServices.length} servis eski customer_id sorgusu yüzünden kırıldı.`
  return record(state, {
    runs: runId,
    incidents: state.incidents + (incident ? 1 : 0),
    last,
  }, summary, incident ? 'error' : 'ok')
}
