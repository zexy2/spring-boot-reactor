export const ROLLBACK_ERROR_THRESHOLD = 5

function initialTraffic(strategy) {
  if (strategy === 'rolling') return 25
  if (strategy === 'bluegreen') return 0
  return 10
}

export function createDeploymentRollbackState() {
  return {
    strategy: 'canary',
    newTraffic: 10,
    errorRate: 1,
    dbCompatible: true,
    status: 'ROLLOUT',
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
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-16),
  }
}

function breached(state) {
  return state.errorRate >= ROLLBACK_ERROR_THRESHOLD
}

export function setDeploymentStrategy(state, strategy) {
  if (!['canary', 'rolling', 'bluegreen'].includes(strategy)) return state
  return record(state, {
    strategy,
    newTraffic: initialTraffic(strategy),
    status: 'ROLLOUT',
    blockedReason: null,
  }, `${strategy.toUpperCase()} rollout başlatıldı.`)
}

export function setDeploymentErrorRate(state, errorRate) {
  const nextRate = Math.max(0, Math.min(100, Number(errorRate)))
  const isBreach = nextRate >= ROLLBACK_ERROR_THRESHOLD
  return record(state, {
    errorRate: nextRate,
    status: state.status === 'ROLLED_BACK' ? 'ROLLED_BACK' : isBreach ? 'SLO_BREACH' : 'ROLLOUT',
    blockedReason: null,
  }, `Error rate ${nextRate}%${isBreach ? ' · SLO breach' : ' · threshold altında'}.`, isBreach ? 'error' : 'ok')
}

export function setDeploymentDbCompatibility(state, dbCompatible) {
  if (state.dbCompatible === dbCompatible) return state
  return record(state, { dbCompatible, blockedReason: null }, dbCompatible
    ? 'DB migration backward-compatible: application rollback yolu açık.'
    : 'DB migration breaking: binary rollback tek başına güvenli değil.', dbCompatible ? 'ok' : 'warn')
}

export function advanceDeploymentRollout(state) {
  if (state.status === 'ROLLED_BACK') return record(state, { blockedReason: 'ROLLOUT blocked: release rollback edildi; yeni rollout başlat.' }, 'Rollback edilmiş release ilerletilemez.', 'error')
  if (breached(state)) return record(state, { blockedReason: 'ROLLOUT blocked: error threshold aşıldı.' }, 'Blast radius büyütülmedi; SLO gate rollout’u durdurdu.', 'error')
  if (state.newTraffic >= 100) return state
  const increment = state.strategy === 'rolling' ? 25 : state.strategy === 'bluegreen' ? 100 : 10
  const newTraffic = Math.min(100, state.newTraffic + increment)
  return record(state, { newTraffic, blockedReason: null }, state.strategy === 'bluegreen'
    ? 'Blue/green traffic cutover → v1.4.2 %100.'
    : `${state.strategy.toUpperCase()} rollout → v1.4.2 trafik ${newTraffic}%.`, 'ok')
}

export function rollbackDeployment(state) {
  if (!breached(state)) return record(state, { blockedReason: 'ROLLBACK blocked: SLO breach kanıtı yok.' }, 'Rollback için threshold breach kanıtı yok.', 'error')
  if (!state.dbCompatible) return record(state, {
    status: 'SCHEMA_BLOCKED',
    blockedReason: 'ROLLBACK blocked: DB schema eski binary ile backward-compatible değil.',
  }, 'Application rollback DB schema nedeniyle reddedildi; forward-fix/schema recovery gerekir.', 'error')
  return record(state, {
    status: 'ROLLED_BACK',
    newTraffic: 0,
    blockedReason: null,
  }, 'Trafik doğrulanmış v1.4.1 sürümüne %100 döndü.', 'ok')
}

export function deploymentTraffic(state) {
  return {
    old: state.status === 'ROLLED_BACK' ? 100 : 100 - state.newTraffic,
    next: state.status === 'ROLLED_BACK' ? 0 : state.newTraffic,
  }
}
