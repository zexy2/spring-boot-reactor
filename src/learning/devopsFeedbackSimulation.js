const STAGES = ['CODE', 'BUILD', 'DEPLOY', 'OBSERVE', 'LEARN']

export function createDevOpsFeedbackState() {
  return {
    cycle: 1,
    stageIndex: 0,
    regression: false,
    telemetryEnabled: true,
    elapsedMinutes: 0,
    evidences: [],
    decision: null,
    blockedReason: null,
    nextEventId: 1,
    events: [],
  }
}

function event(state, updates, message, tone = 'info') {
  return {
    ...state,
    ...updates,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-18),
  }
}

export function setFeedbackRegression(state, regression) {
  if (state.stageIndex > 0 || state.regression === regression) return state
  return event(state, { regression }, regression ? 'Change latent production regression içeriyor.' : 'Change normal davranışa döndü.', regression ? 'warn' : 'ok')
}

export function setFeedbackTelemetry(state, telemetryEnabled) {
  if (state.telemetryEnabled === telemetryEnabled) return state
  return event(state, { telemetryEnabled, blockedReason: null }, telemetryEnabled ? 'Logs + metrics + traces tekrar etkin.' : 'Production telemetry kapatıldı.', telemetryEnabled ? 'ok' : 'warn')
}

function appendEvidence(state, evidence) {
  return [...state.evidences.filter((item) => item.stage !== evidence.stage), evidence]
}

export function advanceDevOpsFeedback(state) {
  const stage = STAGES[state.stageIndex]
  if (stage === 'CODE') {
    const evidence = { stage, label: `commit c${state.cycle}a91 + reviewed diff`, tone: 'ok' }
    return event(state, {
      stageIndex: 1,
      elapsedMinutes: state.elapsedMinutes + 3,
      evidences: appendEvidence(state, evidence),
      blockedReason: null,
    }, `Cycle ${state.cycle}: reviewable change üretildi.`, 'ok')
  }

  if (stage === 'BUILD') {
    const evidence = { stage, label: `order:${state.cycle}.0 · tests green`, tone: 'ok' }
    return event(state, {
      stageIndex: 2,
      elapsedMinutes: state.elapsedMinutes + 4,
      evidences: appendEvidence(state, evidence),
      blockedReason: null,
    }, `Immutable artifact order:${state.cycle}.0 üretildi.`, 'ok')
  }

  if (stage === 'DEPLOY') {
    const evidence = { stage, label: `prod release order:${state.cycle}.0`, tone: 'ok' }
    return event(state, {
      stageIndex: 3,
      elapsedMinutes: state.elapsedMinutes + 6,
      evidences: appendEvidence(state, evidence),
      blockedReason: null,
    }, `Artifact production'a kontrollü biçimde alındı.`, 'ok')
  }

  if (stage === 'OBSERVE') {
    if (!state.telemetryEnabled) {
      return event(state, {
        blockedReason: 'Telemetry yok: production sonucu ölçülemediği için LEARN aşamasına güvenilir kanıt taşınamıyor.',
        elapsedMinutes: state.elapsedMinutes + 5,
      }, 'Observe aşaması kör: karar için production kanıtı yok.', 'error')
    }
    const label = state.regression
      ? 'error=8.4% · p95=940ms · trace failures'
      : 'error=0.6% · p95=180ms · SLO healthy'
    const evidence = { stage, label, tone: state.regression ? 'warn' : 'ok' }
    return event(state, {
      stageIndex: 4,
      elapsedMinutes: state.elapsedMinutes + 5,
      evidences: appendEvidence(state, evidence),
      blockedReason: null,
    }, state.regression ? 'Telemetry regression sinyali üretti.' : 'Telemetry release sağlıklı sinyali üretti.', state.regression ? 'warn' : 'ok')
  }

  const decision = state.regression
    ? 'ROLLBACK + root-cause fix'
    : 'KEEP RELEASE + next hypothesis'
  const evidence = { stage: 'LEARN', label: decision, tone: state.regression ? 'warn' : 'ok' }
  return event(state, {
    stageIndex: 0,
    cycle: state.cycle + 1,
    elapsedMinutes: state.elapsedMinutes + 2,
    evidences: [],
    decision,
    regression: false,
    blockedReason: null,
  }, `Feedback loop kapandı: ${decision}. Yeni cycle başladı.`, evidence.tone)
}

export { STAGES as DEVOPS_FEEDBACK_STAGES }
