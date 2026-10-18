import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createBalancerState,
  setInstanceProcess,
  setInstanceReadiness,
  runDiscoveryHealthCheck,
  routeBalancerRequest,
  routeBalancerBatch,
} from '../src/learning/balancerSimulation.js'

test('round-robin distributes six requests evenly across registered instances', () => {
  const state = routeBalancerBatch(createBalancerState(), 6)
  assert.deepEqual(state.instances.map((instance) => instance.requests), [2, 2, 2])
  assert.equal(state.totalRequests, 6)
  assert.equal(state.failedRequests, 0)
  assert.equal(state.lastRoute, 'P3')
  assert.equal(state.lastRouteSucceeded, true)
})

test('registry churn preserves rotation through the stable instance ring', () => {
  let state = routeBalancerBatch(createBalancerState(), 3)
  assert.equal(state.lastRoute, 'P3')
  state = runDiscoveryHealthCheck(setInstanceProcess(state, 'P2', false))
  state = routeBalancerRequest(state)
  assert.equal(state.lastRoute, 'P1')
  state = routeBalancerRequest(state)
  assert.equal(state.lastRoute, 'P3')
  state = runDiscoveryHealthCheck(setInstanceReadiness(setInstanceProcess(state, 'P2', true), 'P2', true))
  state = routeBalancerBatch(state, 3)
  assert.deepEqual(state.instances.map(({ requests }) => requests), [3, 2, 3])
})

test('last request outcome is a historical result, unaffected by later health changes', () => {
  let state = routeBalancerRequest(createBalancerState())
  assert.equal(state.lastRoute, 'P1')
  assert.equal(state.lastRouteSucceeded, true)
  state = setInstanceProcess(state, 'P1', false)
  assert.equal(state.lastRouteSucceeded, true)
  state = runDiscoveryHealthCheck(state)
  assert.equal(state.lastRouteSucceeded, true)

  state = routeBalancerBatch(state, 2)
  assert.equal(state.lastRouteSucceeded, true)
  state = setInstanceProcess(state, 'P1', true)
  assert.equal(state.lastRouteSucceeded, true)
})

test('runtime failure is invisible to discovery until health check updates registry', () => {
  let state = setInstanceProcess(createBalancerState(), 'P2', false)
  assert.equal(state.instances.find((instance) => instance.id === 'P2').registered, true)
  state = routeBalancerRequest(state)
  state = routeBalancerRequest(state)
  assert.equal(state.lastRoute, 'P2')
  assert.equal(state.failedRequests, 1)
  assert.equal(state.lastRouteSucceeded, false)
  assert.match(state.events.at(-1).message, /registry stale/)
})

test('health check evicts failed instance so load balancer only uses healthy candidates', () => {
  let state = setInstanceProcess(createBalancerState(), 'P2', false)
  state = runDiscoveryHealthCheck(state)
  assert.equal(state.instances.find((instance) => instance.id === 'P2').registered, false)
  state = routeBalancerBatch(state, 4)
  assert.deepEqual(state.instances.map((instance) => instance.requests), [2, 0, 2])
  assert.equal(state.failedRequests, 0)
})

test('restarted instance stays out of discovery until readiness and a health check pass', () => {
  let state = setInstanceProcess(createBalancerState(), 'P2', false)
  state = runDiscoveryHealthCheck(state)
  state = setInstanceProcess(state, 'P2', true)
  assert.equal(state.instances.find((instance) => instance.id === 'P2').registered, false)
  state = runDiscoveryHealthCheck(state)
  assert.equal(state.instances.find((instance) => instance.id === 'P2').registered, false)
  state = setInstanceReadiness(state, 'P2', true)
  assert.equal(state.instances.find((instance) => instance.id === 'P2').registered, false)
  state = runDiscoveryHealthCheck(state)
  assert.equal(state.instances.find((instance) => instance.id === 'P2').registered, true)
})

test('empty registry fails request without selecting an instance', () => {
  let state = createBalancerState()
  for (const id of ['P1', 'P2', 'P3']) state = setInstanceProcess(state, id, false)
  state = runDiscoveryHealthCheck(state)
  state = routeBalancerRequest(state)
  assert.equal(state.lastRoute, 'NO_INSTANCE')
  assert.equal(state.totalRequests, 1)
  assert.equal(state.failedRequests, 1)
  assert.equal(state.lastRouteSucceeded, false)
  assert.equal(state.instances.every((instance) => instance.requests === 0), true)
})
