import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createGatewayState,
  setGatewayServiceHealth,
  setGatewayServiceLatency,
  resetGatewayRateWindow,
  runGatewayRequest,
} from '../src/learning/gatewaySimulation.js'

test('valid request passes policies, routes by prefix and proxies to matching backend', () => {
  const state = runGatewayRequest(createGatewayState(), { path: '/payments/17' })
  assert.equal(state.last.status, 200)
  assert.equal(state.last.service, 'PAYMENT')
  assert.deepEqual(state.last.trace.map((step) => step.stage), ['AUTH', 'RATE LIMIT', 'ROUTE', 'PROXY'])
  assert.equal(state.backendAttempts, 1)
  assert.equal(state.services.find((service) => service.id === 'PAYMENT').hits, 1)
})

test('invalid JWT short-circuits before rate limiter and backend', () => {
  const state = runGatewayRequest(createGatewayState(), { path: '/orders', tokenValid: false })
  assert.equal(state.last.status, 401)
  assert.equal(state.last.trace.length, 1)
  assert.equal(state.rateWindowCount, 0)
  assert.equal(state.backendAttempts, 0)
})

test('rate limit rejects fourth authenticated request before route and proxy', () => {
  let state = createGatewayState()
  for (let i = 0; i < 4; i += 1) state = runGatewayRequest(state, { path: '/orders' })
  assert.equal(state.last.status, 429)
  assert.deepEqual(state.last.trace.map((step) => step.stage), ['AUTH', 'RATE LIMIT'])
  assert.equal(state.backendAttempts, 3)
  assert.equal(state.rateWindowCount, 3)
  state = resetGatewayRateWindow(state)
  state = runGatewayRequest(state, { path: '/orders' })
  assert.equal(state.last.status, 200)
})

test('unknown path returns gateway 404 without backend attempt', () => {
  const state = runGatewayRequest(createGatewayState(), { path: '/unknown' })
  assert.equal(state.last.status, 404)
  assert.equal(state.last.trace.at(-1).stage, 'ROUTE')
  assert.equal(state.backendAttempts, 0)
})

test('down backend produces 503 after successful gateway policies and routing', () => {
  let state = setGatewayServiceHealth(createGatewayState(), 'ORDER', false)
  state = runGatewayRequest(state, { path: '/orders' })
  assert.equal(state.last.status, 503)
  assert.equal(state.backendAttempts, 1)
  assert.equal(state.last.trace.at(-1).stage, 'PROXY')
})

test('slow backend exceeding gateway timeout produces 504', () => {
  let state = setGatewayServiceLatency(createGatewayState(), 'CATALOG', 900)
  state = runGatewayRequest(state, { path: '/catalog/42', timeoutMs: 500 })
  assert.equal(state.last.status, 504)
  assert.equal(state.last.service, 'CATALOG')
  assert.match(state.last.trace.at(-1).detail, /900ms > 500ms/)
})

test('disabling rate policy permits requests beyond configured window limit', () => {
  let state = createGatewayState()
  for (let i = 0; i < 6; i += 1) state = runGatewayRequest(state, { path: '/orders', rateLimitEnabled: false })
  assert.equal(state.last.status, 200)
  assert.equal(state.rateWindowCount, 0)
  assert.equal(state.backendAttempts, 6)
})
