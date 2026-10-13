import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assessDeliveryPlan,
  createDeliveryPrioritizationState,
  moveDeliveryWork,
  scopedDeliveryEffort,
  setDeliveryAnalyticsReady,
  setDeliveryCapacity,
  setDeliveryIncidentActive,
  setDeliveryWorkScope,
} from '../src/learning/deliveryPrioritizationSimulation.js'

function criticalOnlyPlan() {
  let state = createDeliveryPrioritizationState()
  state = setDeliveryWorkScope(state, 'reporting', false)
  state = setDeliveryWorkScope(state, 'refactor', false)
  state = moveDeliveryWork(state, 'payment', 'up')
  state = moveDeliveryWork(state, 'release', 'up')
  state = moveDeliveryWork(state, 'release', 'up')
  return state
}

test('initial overloaded plan is blocked by capacity, ordering and dependency evidence', () => {
  const state = assessDeliveryPlan(createDeliveryPrioritizationState())
  assert.equal(state.assessment, 'BLOCKED')
  assert.ok(state.reasons.some((reason) => reason.includes('capacity')))
  assert.ok(state.reasons.some((reason) => reason.includes('incident')))
  assert.ok(state.reasons.some((reason) => reason.includes('dependency')))
})

test('critical incident plus release blocker exactly fits default capacity and passes', () => {
  const state = assessDeliveryPlan(criticalOnlyPlan())
  assert.equal(scopedDeliveryEffort(state), 5)
  assert.equal(state.assessment, 'PASS')
})

test('active production incident cannot be deferred', () => {
  let state = criticalOnlyPlan()
  state = setDeliveryWorkScope(state, 'payment', false)
  state = assessDeliveryPlan(state)
  assert.equal(state.assessment, 'BLOCKED')
  assert.ok(state.reasons.some((reason) => reason.includes('incident scope')))
})

test('release blocker must remain ahead of lower priority feature work', () => {
  let state = criticalOnlyPlan()
  state = setDeliveryWorkScope(state, 'reporting', true)
  state = setDeliveryAnalyticsReady(state, true)
  state = setDeliveryCapacity(state, 7)
  state = moveDeliveryWork(state, 'reporting', 'up')
  state = assessDeliveryPlan(state)
  assert.equal(state.assessment, 'BLOCKED')
  assert.ok(state.reasons.some((reason) => reason.includes('release blocker')))
})

test('blocked dependency prevents reporting work from entering committed scope', () => {
  let state = criticalOnlyPlan()
  state = setDeliveryWorkScope(state, 'release', false)
  state = setDeliveryWorkScope(state, 'reporting', true)
  state = setDeliveryIncidentActive(state, false)
  state = assessDeliveryPlan(state)
  assert.ok(state.reasons.some((reason) => reason.includes('dependency BLOCKED')))
})

test('capacity limit blocks otherwise ordered work until scope or capacity changes', () => {
  let state = criticalOnlyPlan()
  state = setDeliveryWorkScope(state, 'refactor', true)
  state = assessDeliveryPlan(state)
  assert.ok(state.reasons.some((reason) => reason.includes('capacity 7/5')))
  state = setDeliveryCapacity(state, 7)
  state = assessDeliveryPlan(state)
  assert.equal(state.assessment, 'PASS')
})

test('resolving incident changes priority requirement without pretending old evidence is current', () => {
  let state = assessDeliveryPlan(criticalOnlyPlan())
  assert.equal(state.assessment, 'PASS')
  state = setDeliveryIncidentActive(state, false)
  assert.equal(state.assessment, 'NOT_RUN')
  state = setDeliveryWorkScope(state, 'payment', false)
  state = assessDeliveryPlan(state)
  assert.equal(state.assessment, 'PASS')
})
