export const ENTERPRISE_QUALITY_GATES = [
  ['peerReview', 'PEER REVIEW'],
  ['automatedTests', 'AUTOMATED TESTS'],
  ['securityScan', 'SECURITY SCAN'],
  ['piiLogCheck', 'PII LOG CHECK'],
  ['auditTrail', 'AUDIT TRAIL'],
]

const RISK_TO_GATE = {
  reviewIssue: 'peerReview',
  testRegression: 'automatedTests',
  vulnerability: 'securityScan',
  piiLeak: 'piiLogCheck',
  auditMissing: 'auditTrail',
}

function emptyGate() {
  return { status: 'NOT_RUN', evidence: 'evidence bekliyor' }
}

export function createEnterpriseQualityState() {
  return {
    risks: {
      reviewIssue: false,
      testRegression: false,
      vulnerability: false,
      piiLeak: false,
      auditMissing: false,
    },
    gates: Object.fromEntries(ENTERPRISE_QUALITY_GATES.map(([id]) => [id, emptyGate()])),
    releaseStatus: 'LOCKED',
    blockedReasons: [],
    nextEventId: 1,
    events: [],
  }
}

function record(state, updates, message, tone = 'info') {
  return {
    ...state,
    ...updates,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-18),
  }
}

export function setEnterpriseRisk(state, risk, enabled) {
  if (!(risk in RISK_TO_GATE) || state.risks[risk] === enabled) return state
  const gate = RISK_TO_GATE[risk]
  return record(state, {
    risks: { ...state.risks, [risk]: enabled },
    gates: { ...state.gates, [gate]: emptyGate() },
    releaseStatus: 'LOCKED',
    blockedReasons: [],
  }, `${risk} ${enabled ? 'enjekte edildi' : 'düzeltildi'}; ${gate} evidence geçersizleşti.`, enabled ? 'warn' : 'ok')
}

function gateResult(state, gate) {
  if (gate === 'peerReview') {
    return state.risks.reviewIssue
      ? { status: 'FAIL', evidence: 'Reviewer: error handling standard ihlali' }
      : { status: 'PASS', evidence: '2 approvals · unresolved comment 0' }
  }
  if (gate === 'automatedTests') {
    return state.risks.testRegression
      ? { status: 'FAIL', evidence: '183 passed · 1 regression failed' }
      : { status: 'PASS', evidence: '184 passed · 0 failed' }
  }
  if (gate === 'securityScan') {
    return state.risks.vulnerability
      ? { status: 'FAIL', evidence: '1 HIGH · vulnerable dependency' }
      : { status: 'PASS', evidence: 'HIGH 0 · critical 0' }
  }
  if (gate === 'piiLogCheck') {
    return state.risks.piiLeak
      ? { status: 'FAIL', evidence: 'email + access token log sample bulundu' }
      : { status: 'PASS', evidence: 'PII/token log finding 0' }
  }
  if (gate === 'auditTrail') {
    return state.risks.auditMissing
      ? { status: 'FAIL', evidence: 'refund actor/timestamp audit kaydı eksik' }
      : { status: 'PASS', evidence: 'actor + action + timestamp + correlation id' }
  }
  return null
}

export function runEnterpriseQualityGate(state, gate) {
  if (!state.gates[gate]) return state
  const result = gateResult(state, gate)
  return record(state, {
    gates: { ...state.gates, [gate]: result },
    releaseStatus: 'LOCKED',
    blockedReasons: [],
  }, `${gate} → ${result.status}: ${result.evidence}.`, result.status === 'PASS' ? 'ok' : 'error')
}

export function runAllEnterpriseQualityGates(state) {
  let next = state
  for (const [gate] of ENTERPRISE_QUALITY_GATES) next = runEnterpriseQualityGate(next, gate)
  return next
}

export function attemptEnterpriseRelease(state) {
  const blockedReasons = ENTERPRISE_QUALITY_GATES
    .filter(([gate]) => state.gates[gate].status !== 'PASS')
    .map(([gate, label]) => `${label}: ${state.gates[gate].status}`)
  if (blockedReasons.length) {
    return record(state, {
      releaseStatus: 'BLOCKED',
      blockedReasons,
    }, `Release blocked · ${blockedReasons.join(' · ')}.`, 'error')
  }
  return record(state, {
    releaseStatus: 'RELEASED',
    blockedReasons: [],
  }, 'Release gate OPEN: review, test, security, PII ve audit evidence zinciri PASS.', 'ok')
}
