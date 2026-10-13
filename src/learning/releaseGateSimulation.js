export function createReleaseGateState() {
  return {
    mode: 'delivery',
    artifact: { version: '1.4.2', checksum: 'sha256:7ac91e', verified: true },
    production: { version: '1.4.1', checksum: 'sha256:previous' },
    policyPass: true,
    approved: false,
    status: 'READY',
    nextEventId: 1,
    events: [],
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

export function setReleaseMode(state, mode) {
  if (!['delivery', 'deployment'].includes(mode) || state.mode === mode) return state
  return record(state, { mode, approved: false, status: 'READY' }, mode === 'delivery' ? 'Continuous Delivery: production için manuel gate aktif.' : 'Continuous Deployment: green policy production promotion yapabilir.')
}

export function setReleasePolicy(state, policyPass) {
  if (state.policyPass === policyPass) return state
  return record(state, { policyPass, approved: false, status: 'READY' }, policyPass ? 'Production policy tekrar green.' : 'Production policy RED: promotion bloklanacak.', policyPass ? 'ok' : 'warn')
}

function deployArtifact(state, gate) {
  return record(state, {
    production: { version: state.artifact.version, checksum: state.artifact.checksum },
    status: 'DEPLOYED',
  }, `${gate} gate geçti; ${state.artifact.checksum} production'a promote edildi.`, 'ok')
}

export function evaluateReleaseGate(state) {
  if (!state.artifact.verified) {
    return record(state, { status: 'UNVERIFIED' }, 'Artifact doğrulanmadığı için production gate açılmadı.', 'error')
  }
  if (!state.policyPass) {
    return record(state, { status: 'POLICY_BLOCKED' }, 'Production policy RED; aynı artifact production’a geçmedi.', 'error')
  }
  if (state.mode === 'delivery' && !state.approved) {
    return record(state, { status: 'WAITING_APPROVAL' }, 'Artifact production-ready; Continuous Delivery manuel approval bekliyor.', 'warn')
  }
  return deployArtifact(state, state.mode === 'delivery' ? 'MANUAL APPROVAL' : 'AUTO POLICY')
}

export function approveDeliveryRelease(state) {
  if (state.mode !== 'delivery') return state
  if (!state.artifact.verified) return record(state, { status: 'UNVERIFIED' }, 'Approval doğrulanmamış artifact’i production’a taşıyamaz.', 'error')
  if (!state.policyPass) return record(state, { status: 'POLICY_BLOCKED' }, 'Approval policy failure’ı bypass edemez.', 'error')
  const approved = record(state, { approved: true, status: 'APPROVED' }, 'Risk owner production approval verdi.', 'ok')
  return deployArtifact(approved, 'MANUAL APPROVAL')
}
