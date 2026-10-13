import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDeploymentRollbackState,
  setDeploymentStrategy,
  setDeploymentErrorRate,
  setDeploymentDbCompatibility,
  advanceDeploymentRollout,
  rollbackDeployment,
  deploymentTraffic,
} from '../src/learning/deploymentRollbackSimulation.js'

test('canary rollout grows traffic in bounded 10 percent steps while healthy', () => {
  let state = createDeploymentRollbackState()
  state = advanceDeploymentRollout(state)
  assert.equal(state.newTraffic, 20)
  assert.deepEqual(deploymentTraffic(state), { old: 80, next: 20 })
})

test('rolling strategy starts at 25 percent and advances by 25 percent', () => {
  let state = setDeploymentStrategy(createDeploymentRollbackState(), 'rolling')
  assert.equal(state.newTraffic, 25)
  state = advanceDeploymentRollout(state)
  assert.equal(state.newTraffic, 50)
})

test('blue green performs a single full traffic cutover', () => {
  let state = setDeploymentStrategy(createDeploymentRollbackState(), 'bluegreen')
  assert.equal(state.newTraffic, 0)
  state = advanceDeploymentRollout(state)
  assert.equal(state.newTraffic, 100)
})

test('SLO breach blocks blast-radius growth', () => {
  let state = setDeploymentErrorRate(createDeploymentRollbackState(), 7)
  const traffic = state.newTraffic
  state = advanceDeploymentRollout(state)
  assert.equal(state.newTraffic, traffic)
  assert.match(state.blockedReason, /threshold/)
})

test('healthy rollback attempt is rejected because breach evidence is missing', () => {
  const state = rollbackDeployment(createDeploymentRollbackState())
  assert.equal(state.status, 'ROLLOUT')
  assert.match(state.blockedReason, /SLO breach/)
})

test('SLO breach with backward-compatible DB rolls traffic fully to previous release', () => {
  let state = setDeploymentErrorRate(createDeploymentRollbackState(), 8)
  state = rollbackDeployment(state)
  assert.equal(state.status, 'ROLLED_BACK')
  assert.deepEqual(deploymentTraffic(state), { old: 100, next: 0 })
})

test('breaking DB migration blocks binary rollback even after SLO breach', () => {
  let state = setDeploymentDbCompatibility(createDeploymentRollbackState(), false)
  state = setDeploymentErrorRate(state, 8)
  state = rollbackDeployment(state)
  assert.equal(state.status, 'SCHEMA_BLOCKED')
  assert.equal(state.newTraffic, 10)
  assert.match(state.blockedReason, /DB schema/)
})

test('rolled back release cannot silently resume rollout without starting a new strategy', () => {
  let state = setDeploymentErrorRate(createDeploymentRollbackState(), 8)
  state = rollbackDeployment(state)
  state = setDeploymentErrorRate(state, 1)
  state = advanceDeploymentRollout(state)
  assert.equal(state.status, 'ROLLED_BACK')
  assert.equal(state.newTraffic, 0)
  assert.match(state.blockedReason, /yeni rollout/)
})
