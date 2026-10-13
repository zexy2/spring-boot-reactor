import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createKubernetesControlLoopState,
  kubernetesReadyPods,
  kubernetesAlivePods,
  deleteKubernetesPod,
  reconcileKubernetesDeployment,
  failKubernetesReadiness,
  restoreKubernetesReadiness,
  failKubernetesLiveness,
  reconcileKubernetesKubelet,
  routeKubernetesServiceRequest,
} from '../src/learning/kubernetesControlLoopSimulation.js'

test('cluster starts with desired replica count and three ready Service endpoints', () => {
  const state = createKubernetesControlLoopState()
  assert.equal(kubernetesAlivePods(state).length, 3)
  assert.equal(kubernetesReadyPods(state).length, 3)
})

test('deleting a Pod creates replica drift and immediately removes it from Service endpoints', () => {
  const state = deleteKubernetesPod(createKubernetesControlLoopState())
  assert.equal(kubernetesAlivePods(state).length, 2)
  assert.equal(kubernetesReadyPods(state).length, 2)
  assert.match(state.controllerMessage, /drift/i)
})

test('Deployment reconcile replaces deleted Pod with a new generation', () => {
  let state = deleteKubernetesPod(createKubernetesControlLoopState())
  const slot = state.pods.find((item) => !item.alive).slot
  const generation = state.pods.find((item) => item.slot === slot).generation
  state = reconcileKubernetesDeployment(state)
  const replacement = state.pods.find((item) => item.slot === slot)
  assert.equal(replacement.alive, true)
  assert.equal(replacement.ready, true)
  assert.equal(replacement.generation, generation + 1)
})

test('readiness failure removes endpoint without killing or restarting container', () => {
  let state = failKubernetesReadiness(createKubernetesControlLoopState())
  const affected = state.pods.find((item) => !item.ready)
  assert.equal(affected.alive, true)
  assert.equal(affected.live, true)
  assert.equal(affected.restarts, 0)
  assert.equal(kubernetesReadyPods(state).length, 2)
  state = restoreKubernetesReadiness(state)
  assert.equal(kubernetesReadyPods(state).length, 3)
})

test('liveness failure requires kubelet restart and increments restart counter', () => {
  let state = failKubernetesLiveness(createKubernetesControlLoopState())
  const slot = state.pods.find((item) => !item.live).slot
  assert.equal(kubernetesReadyPods(state).length, 2)
  state = reconcileKubernetesKubelet(state)
  const restarted = state.pods.find((item) => item.slot === slot)
  assert.equal(restarted.live, true)
  assert.equal(restarted.ready, true)
  assert.equal(restarted.restarts, 1)
})

test('Deployment controller does not replace a Pod merely because readiness failed', () => {
  let state = failKubernetesReadiness(createKubernetesControlLoopState())
  const before = state.pods.map((item) => item.generation)
  state = reconcileKubernetesDeployment(state)
  assert.deepEqual(state.pods.map((item) => item.generation), before)
  assert.equal(kubernetesAlivePods(state).length, 3)
})

test('Service routes only across currently ready endpoints', () => {
  let state = failKubernetesReadiness(createKubernetesControlLoopState())
  const excluded = state.pods.find((item) => !item.ready).slot
  state = routeKubernetesServiceRequest(state)
  assert.equal(state.lastRequest.status, 200)
  assert.notEqual(state.lastRequest.targetSlot, excluded)
  assert.equal(state.lastRequest.readyEndpoints, 2)
})

test('Service returns 503 when every Pod is alive but none is ready', () => {
  let state = createKubernetesControlLoopState()
  state = failKubernetesReadiness(state)
  state = failKubernetesReadiness(state)
  state = failKubernetesReadiness(state)
  state = routeKubernetesServiceRequest(state)
  assert.equal(kubernetesAlivePods(state).length, 3)
  assert.equal(kubernetesReadyPods(state).length, 0)
  assert.equal(state.lastRequest.status, 503)
  assert.equal(state.lastRequest.targetSlot, null)
})
