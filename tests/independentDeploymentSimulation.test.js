import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createIndependentDeploymentState,
  deployPaymentProvider,
  redeployConsumer,
  runDeploymentContractTest,
} from '../src/learning/independentDeploymentSimulation.js'

test('additive provider deploy keeps old consumers compatible without redeploy', () => {
  const state = deployPaymentProvider(createIndependentDeploymentState(), { change: 'additive' })
  assert.equal(state.paymentVersion, 2)
  assert.equal(state.last.independent, true)
  assert.deepEqual(state.last.brokenConsumers, [])
  assert.equal(state.providerFields.includes('status'), true)
  assert.equal(state.consumerRedeploys, 0)
})

test('breaking amount rename breaks every old consumer contract', () => {
  const state = deployPaymentProvider(createIndependentDeploymentState(), { change: 'breaking' })
  assert.equal(state.last.independent, false)
  assert.deepEqual(state.last.brokenConsumers, ['ORDER', 'REPORT'])
  assert.deepEqual(state.providerFields, ['paymentId', 'totalAmount', 'currency'])
})

test('transitional dual-field provider supports old consumers while exposing new field', () => {
  const state = deployPaymentProvider(createIndependentDeploymentState(), { change: 'transitional' })
  assert.equal(state.last.independent, true)
  assert.equal(state.providerFields.includes('amount'), true)
  assert.equal(state.providerFields.includes('totalAmount'), true)
  assert.deepEqual(state.last.brokenConsumers, [])
})

test('redeploying one consumer after breaking change leaves other old consumer broken', () => {
  let state = deployPaymentProvider(createIndependentDeploymentState(), { change: 'breaking' })
  state = redeployConsumer(state, 'ORDER')
  assert.equal(state.consumers.find((consumer) => consumer.id === 'ORDER').amountField, 'totalAmount')
  assert.deepEqual(state.last.brokenConsumers, ['REPORT'])
  assert.equal(state.consumerRedeploys, 1)
})

test('coordinated consumer redeploys restore compatibility but prove coupling', () => {
  let state = deployPaymentProvider(createIndependentDeploymentState(), { change: 'breaking' })
  state = redeployConsumer(state, 'ORDER')
  state = redeployConsumer(state, 'REPORT')
  assert.deepEqual(state.last.brokenConsumers, [])
  assert.equal(state.consumerRedeploys, 2)
  assert.equal(state.last.independent, false)
})

test('contract test detects broken current provider-consumer combination', () => {
  let state = deployPaymentProvider(createIndependentDeploymentState(), { change: 'breaking' })
  state = runDeploymentContractTest(state)
  assert.deepEqual(state.last.brokenConsumers, ['ORDER', 'REPORT'])
  assert.equal(state.last.action, 'CONTRACT_TEST')
})
