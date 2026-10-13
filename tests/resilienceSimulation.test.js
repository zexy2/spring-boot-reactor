import test from 'node:test'
import assert from 'node:assert/strict'
import { createResilienceState, expireResilienceCooldown, runResilienceRequest } from '../src/learning/resilienceSimulation.js'

test('bounded retry adds actual attempts, timeout duration and exponential backoff', () => {
  const state = runResilienceRequest(createResilienceState(), { dependency: 'slow', timeout: 500, retries: 2 })
  assert.equal(state.circuit, 'CLOSED')
  assert.equal(state.consecutiveFailures, 1)
  assert.equal(state.attempts, 3)
  assert.equal(state.elapsedMs, 1800) // 3x500ms + 100ms + 200ms
  assert.deepEqual(state.last.trace.map((x) => x.kind), ['failure', 'backoff', 'failure', 'backoff', 'failure'])
  assert.match(state.last.message, /doğrulanmalı/)
})

test('three failed caller requests open circuit regardless of retry count; open fast-fails', () => {
  let state = createResilienceState()
  for (let i = 0; i < 3; i++) state = runResilienceRequest(state, { retries: 2 })
  assert.equal(state.circuit, 'OPEN')
  assert.equal(state.requests, 3)
  assert.equal(state.attempts, 9)
  const result = runResilienceRequest(state, { dependency: 'healthy', fallback: false })
  assert.equal(result.requests, 4)
  assert.equal(result.attempts, 9)
  assert.equal(result.blocked, 1)
  assert.equal(result.last.elapsedMs, 0)
  assert.match(result.last.message, /fast fail/)
})

test('HALF_OPEN allows one probe; success closes, failure opens again', () => {
  let state = createResilienceState()
  for (let i = 0; i < 3; i++) state = runResilienceRequest(state, { dependency: 'down', retries: 0 })
  state = expireResilienceCooldown(state)
  assert.equal(state.circuit, 'HALF_OPEN')
  const failedProbe = runResilienceRequest(state, { dependency: 'slow', retries: 2 })
  assert.equal(failedProbe.circuit, 'OPEN')
  assert.equal(failedProbe.last.attempts, 1)
  const recovered = runResilienceRequest(expireResilienceCooldown(failedProbe), { dependency: 'healthy', retries: 2 })
  assert.equal(recovered.circuit, 'CLOSED')
  assert.equal(recovered.consecutiveFailures, 0)
  assert.equal(recovered.last.attempts, 1)
  assert.equal(expireResilienceCooldown(recovered), recovered)
})

test('flaky dependency recovers on retry, while slow but permitted dependency succeeds without timeout', () => {
  const flaky = runResilienceRequest(createResilienceState(), { dependency: 'flaky', timeout: 800, retries: 1 })
  assert.equal(flaky.last.outcome, 'success')
  assert.equal(flaky.last.attempts, 2)
  assert.equal(flaky.elapsedMs, 1250)
  assert.equal(flaky.consecutiveFailures, 0)
  const slow = runResilienceRequest(createResilienceState(), { dependency: 'slow', timeout: 1500, retries: 2 })
  assert.equal(slow.last.outcome, 'success')
  assert.equal(slow.last.attempts, 1)
  assert.equal(slow.elapsedMs, 1200)
})

test('history is limited to six requests, fallback never reports successful payment', () => {
  let state = createResilienceState()
  for (let i = 0; i < 8; i++) state = runResilienceRequest(state, { dependency: 'down', retries: 0 })
  assert.equal(state.history.length, 6)
  assert.deepEqual(state.history.map((entry) => entry.id), [8, 7, 6, 5, 4, 3])
  assert.equal(state.blocked, 5)
  assert.equal(state.history.every((entry) => entry.message !== '200 OK'), true)
})
