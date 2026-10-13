import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateSystemDesign } from '../src/learning/systemDesignSimulation.js'

test('healthy synchronous owned-db design confirms order but remains runtime coupled', () => {
  const result = evaluateSystemDesign({ communication: 'sync', dataOwnership: 'owned', recovery: 'timeout', paymentUp: true })
  assert.equal(result.clientStatus, 200)
  assert.equal(result.orderState, 'CONFIRMED')
  assert.equal(result.runtimeCoupled, true)
  assert.equal(result.deploymentCoupled, false)
  assert.equal(result.verdict, 'SIMPLE BUT RUNTIME-COUPLED')
})

test('payment outage propagates to synchronous caller', () => {
  const result = evaluateSystemDesign({ communication: 'sync', dataOwnership: 'owned', recovery: 'timeout', paymentUp: false })
  assert.equal(result.clientStatus, 503)
  assert.equal(result.orderState, 'NOT_CONFIRMED')
  assert.equal(result.outageContained, false)
  assert.equal(result.verdict, 'FAILURE PROPAGATES')
})

test('async owned-db design acknowledges request while payment outage is isolated from caller', () => {
  const result = evaluateSystemDesign({ communication: 'async', dataOwnership: 'owned', recovery: 'timeout', paymentUp: false })
  assert.equal(result.clientStatus, 202)
  assert.equal(result.orderState, 'PENDING_RETRY')
  assert.equal(result.runtimeCoupled, false)
  assert.equal(result.outageContained, true)
  assert.equal(result.verdict, 'FAILURE CONTAINED')
})

test('saga makes failed asynchronous order pending compensation', () => {
  const result = evaluateSystemDesign({ communication: 'async', dataOwnership: 'owned', recovery: 'saga', paymentUp: false })
  assert.equal(result.orderState, 'PENDING_COMPENSATION')
  assert.equal(result.findings.find((finding) => finding.id === 'RECOVERY').value, 'BUSINESS COMPENSATION')
})

test('shared database creates deployment coupling regardless of communication style', () => {
  const sync = evaluateSystemDesign({ communication: 'sync', dataOwnership: 'shared', paymentUp: true })
  const async = evaluateSystemDesign({ communication: 'async', dataOwnership: 'shared', paymentUp: true })
  assert.equal(sync.deploymentCoupled, true)
  assert.equal(async.deploymentCoupled, true)
  assert.equal(sync.verdict, 'DEPLOYMENT COUPLING')
  assert.equal(async.verdict, 'DEPLOYMENT COUPLING')
})
