import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSafeChangeState,
  reproduceSupportIncident,
  inspectSupportEvidence,
  diagnoseSupportIncident,
  selectSupportFix,
  runSupportRegression,
  runSupportContract,
  startSupportRollout,
  injectSupportProductionRegression,
  monitorSupportRollout,
  promoteSupportCanary,
  rollbackSupportRollout,
} from '../src/learning/safeChangeSimulation.js'

function diagnosed() {
  let s = reproduceSupportIncident(createSafeChangeState())
  s = inspectSupportEvidence(s, 'logs')
  s = inspectSupportEvidence(s, 'deploy')
  return diagnoseSupportIncident(s, 'nullable-name')
}

function tested(fix = 'additive-guard') {
  let s = selectSupportFix(diagnosed(), fix)
  s = runSupportRegression(s)
  return runSupportContract(s)
}

test('incident starts unverified and refuses root cause without log/deploy evidence', () => {
  const initial = createSafeChangeState()
  const attempted = diagnoseSupportIncident(initial, 'nullable-name')
  assert.equal(attempted.diagnosisStatus, 'NOT_RUN')
  assert.match(attempted.events.at(-1).message, /reproduksiyon/)
  const logsFirst = inspectSupportEvidence(initial, 'logs')
  assert.equal(logsFirst.evidence.logs, false)
  assert.equal(diagnosed().diagnosisStatus, 'CONFIRMED')
})

test('a plausible but wrong diagnosis is rejected and cannot unlock patch', () => {
  let s = reproduceSupportIncident(createSafeChangeState())
  s = inspectSupportEvidence(inspectSupportEvidence(s, 'logs'), 'deploy')
  s = diagnoseSupportIncident(s, 'db-timeout')
  assert.equal(s.diagnosisStatus, 'REJECTED')
  assert.equal(selectSupportFix(s, 'additive-guard').fix, null)
  assert.equal(diagnoseSupportIncident(s, 'nullable-name').diagnosisStatus, 'CONFIRMED')
})

test('null guard patch passes regression and legacy client contract', () => {
  const s = tested()
  assert.equal(s.revision, 1)
  assert.equal(s.regression.status, 'PASS')
  assert.equal(s.contract.status, 'PASS')
  assert.ok(s.contract.cases.some((c) => c.name.includes('v1 istemci') && c.status === 'PASS'))
})

test('breaking rename passes API regression but fails existing client contract', () => {
  const s = tested('rename')
  assert.equal(s.regression.status, 'PASS')
  assert.equal(s.contract.status, 'FAIL')
  assert.match(s.contract.cases[0].detail, /eski client kırıldı/)
  assert.equal(startSupportRollout(s, 'canary').rollout.status, 'NOT_STARTED')
})

test('swallowing exception masks 500 but fails required null fallback and contract', () => {
  const s = tested('swallow')
  assert.equal(s.regression.status, 'FAIL')
  assert.equal(s.contract.status, 'FAIL')
  assert.match(s.regression.cases[0].detail, /iş kuralı bozuk/)
})

test('rollout requires BOTH current successful test suites', () => {
  let s = selectSupportFix(diagnosed(), 'additive-guard')
  s = runSupportRegression(s)
  assert.equal(startSupportRollout(s, 'full').rollout.status, 'NOT_STARTED')
  s = runSupportContract(s)
  assert.equal(startSupportRollout(s, 'full').rollout.status, 'FULL')
})

test('switching patch invalidates prior test evidence and revisions', () => {
  const s = selectSupportFix(tested(), 'rename')
  assert.equal(s.revision, 2)
  assert.equal(s.regression.status, 'NOT_RUN')
  assert.equal(s.contract.status, 'NOT_RUN')
  assert.equal(s.rollout.status, 'NOT_STARTED')
  assert.equal(startSupportRollout(s, 'full').rollout.status, 'NOT_STARTED')
  assert.equal(runSupportContract(s).contract.status, 'FAIL')
})

test('canary requires PASS monitoring before promotion and retests full traffic', () => {
  let s = startSupportRollout(tested(), 'canary')
  assert.equal(s.rollout.status, 'CANARY')
  assert.equal(promoteSupportCanary(s).rollout.status, 'CANARY')
  s = monitorSupportRollout(s)
  assert.equal(s.monitoring.status, 'PASS')
  assert.equal(s.monitoring.observations[2].value, '10%')
  s = promoteSupportCanary(s)
  assert.equal(s.rollout.status, 'FULL')
  assert.equal(s.monitoring.status, 'NOT_RUN')
  s = monitorSupportRollout(s)
  assert.equal(s.rollout.status, 'HEALTHY')
  assert.equal(s.monitoring.observations[2].value, '100%')
})

test('production-only risk escapes test gates but halts canary and allows rollback', () => {
  let s = injectSupportProductionRegression(tested(), true)
  assert.equal(s.regression.status, 'PASS')
  assert.equal(s.contract.status, 'PASS')
  s = startSupportRollout(s, 'canary')
  s = monitorSupportRollout(s)
  assert.equal(s.monitoring.status, 'FAIL')
  assert.equal(s.rollout.status, 'HALTED')
  assert.equal(s.monitoring.observations[0].value, '8.2%')
  assert.equal(promoteSupportCanary(s).rollout.status, 'HALTED')
  assert.equal(monitorSupportRollout(s).rollout.status, 'HALTED')
  s = rollbackSupportRollout(s)
  assert.equal(s.rollout.status, 'ROLLED_BACK')
  assert.equal(s.monitoring.status, 'FAIL') // incident proof retained
})

test('new production regression invalidates stale green monitoring evidence', () => {
  let s = monitorSupportRollout(startSupportRollout(tested(), 'full'))
  assert.equal(s.rollout.status, 'HEALTHY')
  s = injectSupportProductionRegression(s, true)
  assert.equal(s.monitoring.status, 'NOT_RUN')
  assert.equal(s.rollout.status, 'FULL')
  s = monitorSupportRollout(s)
  assert.equal(s.monitoring.status, 'FAIL')
  assert.equal(s.rollout.status, 'HALTED')
})

test('new patch cannot erase an active deployment without rollback', () => {
  let s = startSupportRollout(tested(), 'canary')
  const blocked = selectSupportFix(s, 'rename')
  assert.equal(blocked.fix, 'additive-guard')
  assert.equal(blocked.rollout.status, 'CANARY')
  s = rollbackSupportRollout(blocked)
  s = selectSupportFix(s, 'rename')
  assert.equal(s.fix, 'rename')
  assert.equal(s.revision, 2)
  assert.equal(s.rollout.status, 'NOT_STARTED')
})

test('rollback without deployed code is blocked, events retain latest evidence', () => {
  const s = rollbackSupportRollout(createSafeChangeState())
  assert.equal(s.rollout.status, 'NOT_STARTED')
  assert.match(s.events.at(-1).message, /Rollback için/)
  const verified = tested()
  assert.ok(verified.events.every((e, index) => e.id === index + 1))
})
