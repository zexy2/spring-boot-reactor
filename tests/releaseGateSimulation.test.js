import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createReleaseGateState,
  setReleaseMode,
  setReleasePolicy,
  evaluateReleaseGate,
  approveDeliveryRelease,
} from '../src/learning/releaseGateSimulation.js'

test('Continuous Delivery stops a verified artifact at manual production approval', () => {
  const state = evaluateReleaseGate(createReleaseGateState())
  assert.equal(state.status, 'WAITING_APPROVAL')
  assert.equal(state.production.version, '1.4.1')
  assert.equal(state.approved, false)
})

test('manual approval promotes the exact verified artifact bytes', () => {
  const state = approveDeliveryRelease(evaluateReleaseGate(createReleaseGateState()))
  assert.equal(state.status, 'DEPLOYED')
  assert.equal(state.approved, true)
  assert.equal(state.production.version, state.artifact.version)
  assert.equal(state.production.checksum, state.artifact.checksum)
})

test('Continuous Deployment promotes automatically when production policy is green', () => {
  let state = setReleaseMode(createReleaseGateState(), 'deployment')
  state = evaluateReleaseGate(state)
  assert.equal(state.status, 'DEPLOYED')
  assert.equal(state.approved, false)
  assert.equal(state.production.checksum, state.artifact.checksum)
})

test('red production policy blocks both automatic deployment and manual approval', () => {
  let automatic = setReleaseMode(createReleaseGateState(), 'deployment')
  automatic = setReleasePolicy(automatic, false)
  automatic = evaluateReleaseGate(automatic)
  assert.equal(automatic.status, 'POLICY_BLOCKED')
  assert.equal(automatic.production.version, '1.4.1')

  let manual = setReleasePolicy(createReleaseGateState(), false)
  manual = approveDeliveryRelease(manual)
  assert.equal(manual.status, 'POLICY_BLOCKED')
  assert.equal(manual.production.version, '1.4.1')
})

test('changing Delivery/Deployment mode changes gate ownership without changing artifact identity', () => {
  const delivery = createReleaseGateState()
  const deployment = setReleaseMode(delivery, 'deployment')
  assert.deepEqual(deployment.artifact, delivery.artifact)
  assert.equal(deployment.mode, 'deployment')
  assert.equal(delivery.mode, 'delivery')
})

test('manual approval cannot bypass artifact verification', () => {
  const initial = createReleaseGateState()
  const state = approveDeliveryRelease({ ...initial, artifact: { ...initial.artifact, verified: false } })
  assert.equal(state.status, 'UNVERIFIED')
  assert.equal(state.production.version, '1.4.1')
})
