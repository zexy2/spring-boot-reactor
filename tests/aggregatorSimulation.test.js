import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createAggregatorState,
  setAggregatorSourceHealth,
  setAggregatorSourceLatency,
  runAggregator,
} from '../src/learning/aggregatorSimulation.js'

test('healthy sources compose one full DTO and parallel latency equals slowest source', () => {
  const state = runAggregator(createAggregatorState(), { timeoutMs: 600, partialAllowed: true })
  assert.equal(state.last.status, 200)
  assert.equal(state.last.full, true)
  assert.equal(state.last.partial, false)
  assert.equal(state.last.parallelMs, 450)
  assert.equal(state.last.sequentialMs, 850)
  assert.deepEqual(state.last.response.missingSources, [])
  assert.deepEqual(Object.keys(state.last.response.data), ['user', 'order', 'payment'])
})

test('optional source timeout can produce explicit partial response', () => {
  let state = setAggregatorSourceLatency(createAggregatorState(), 'PAYMENT', 900)
  state = runAggregator(state, { timeoutMs: 600, partialAllowed: true })
  assert.equal(state.last.status, 200)
  assert.equal(state.last.partial, true)
  assert.equal(state.last.parallelMs, 600)
  assert.deepEqual(state.last.response.missingSources, ['PAYMENT'])
  assert.equal(state.last.response.data.payment, undefined)
  assert.equal(state.last.outcomes.find((outcome) => outcome.id === 'PAYMENT').status, 'TIMEOUT')
})

test('same optional timeout fails entire aggregation when partial policy is disabled', () => {
  let state = setAggregatorSourceLatency(createAggregatorState(), 'PAYMENT', 900)
  state = runAggregator(state, { timeoutMs: 600, partialAllowed: false })
  assert.equal(state.last.status, 504)
  assert.equal(state.last.response, null)
  assert.equal(state.last.partial, false)
})

test('required USER source failure cannot be hidden by partial policy', () => {
  let state = setAggregatorSourceHealth(createAggregatorState(), 'USER', false)
  state = runAggregator(state, { partialAllowed: true })
  assert.equal(state.last.status, 502)
  assert.equal(state.last.response, null)
  assert.equal(state.last.outcomes.find((outcome) => outcome.id === 'USER').status, 'ERROR')
})

test('optional source runtime failure yields partial DTO with missing-source metadata', () => {
  let state = setAggregatorSourceHealth(createAggregatorState(), 'ORDER', false)
  state = runAggregator(state, { partialAllowed: true })
  assert.equal(state.last.status, 200)
  assert.equal(state.last.partial, true)
  assert.deepEqual(state.last.response.missingSources, ['ORDER'])
  assert.equal(state.last.response.data.order, undefined)
})

test('every fan-out run increments each downstream call count once', () => {
  let state = createAggregatorState()
  state = runAggregator(state)
  state = runAggregator(state)
  assert.deepEqual(state.sources.map((source) => source.calls), [2, 2, 2])
  assert.equal(state.runs, 2)
})
