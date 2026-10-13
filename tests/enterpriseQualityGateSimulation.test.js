import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createEnterpriseQualityState,
  setEnterpriseRisk,
  runEnterpriseQualityGate,
  runAllEnterpriseQualityGates,
  attemptEnterpriseRelease,
} from '../src/learning/enterpriseQualityGateSimulation.js'

test('clean enterprise change can produce PASS evidence for every required gate', () => {
  const state = runAllEnterpriseQualityGates(createEnterpriseQualityState())
  assert.equal(Object.values(state.gates).every((gate) => gate.status === 'PASS'), true)
})

test('release stays blocked until every required gate has current PASS evidence', () => {
  let state = runEnterpriseQualityGate(createEnterpriseQualityState(), 'peerReview')
  state = attemptEnterpriseRelease(state)
  assert.equal(state.releaseStatus, 'BLOCKED')
  assert.equal(state.blockedReasons.length, 4)
})

test('high vulnerability fails security gate and blocks release', () => {
  let state = setEnterpriseRisk(createEnterpriseQualityState(), 'vulnerability', true)
  state = runAllEnterpriseQualityGates(state)
  assert.equal(state.gates.securityScan.status, 'FAIL')
  state = attemptEnterpriseRelease(state)
  assert.equal(state.releaseStatus, 'BLOCKED')
})

test('PII leak produces explicit failed evidence instead of a generic red toggle', () => {
  let state = setEnterpriseRisk(createEnterpriseQualityState(), 'piiLeak', true)
  state = runEnterpriseQualityGate(state, 'piiLogCheck')
  assert.equal(state.gates.piiLogCheck.status, 'FAIL')
  assert.match(state.gates.piiLogCheck.evidence, /email|token/)
})

test('fixing a finding invalidates stale failed evidence and requires rerun', () => {
  let state = setEnterpriseRisk(createEnterpriseQualityState(), 'testRegression', true)
  state = runEnterpriseQualityGate(state, 'automatedTests')
  assert.equal(state.gates.automatedTests.status, 'FAIL')
  state = setEnterpriseRisk(state, 'testRegression', false)
  assert.equal(state.gates.automatedTests.status, 'NOT_RUN')
  state = runEnterpriseQualityGate(state, 'automatedTests')
  assert.equal(state.gates.automatedTests.status, 'PASS')
})

test('auditability is an independent release requirement', () => {
  let state = setEnterpriseRisk(createEnterpriseQualityState(), 'auditMissing', true)
  state = runAllEnterpriseQualityGates(state)
  assert.equal(state.gates.auditTrail.status, 'FAIL')
  assert.equal(state.gates.piiLogCheck.status, 'PASS')
})

test('all current evidence PASS opens release gate', () => {
  let state = runAllEnterpriseQualityGates(createEnterpriseQualityState())
  state = attemptEnterpriseRelease(state)
  assert.equal(state.releaseStatus, 'RELEASED')
  assert.deepEqual(state.blockedReasons, [])
})

test('new risk after release re-locks release and invalidates only its mapped gate', () => {
  let state = runAllEnterpriseQualityGates(createEnterpriseQualityState())
  state = attemptEnterpriseRelease(state)
  state = setEnterpriseRisk(state, 'reviewIssue', true)
  assert.equal(state.releaseStatus, 'LOCKED')
  assert.equal(state.gates.peerReview.status, 'NOT_RUN')
  assert.equal(state.gates.automatedTests.status, 'PASS')
})
