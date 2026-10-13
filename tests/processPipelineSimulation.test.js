import test from 'node:test'
import assert from 'node:assert/strict'
import { createProcessPipelineState, runProcessPipeline } from '../src/learning/processPipelineSimulation.js'

test('happy path runs all stages, enriches context and commits one order', () => {
  const state = runProcessPipeline(createProcessPipelineState())
  assert.equal(state.last.status, 201)
  assert.equal(state.last.outcome, 'ORDER_CREATED')
  assert.equal(state.last.sideEffect, true)
  assert.equal(state.processedOrders, 1)
  assert.equal(state.last.context.customerTier, 'GOLD')
  assert.deepEqual(state.last.trace.map((step) => step.stage), ['VALIDATE', 'AUTHORIZE', 'ENRICH', 'PROCESS'])
})

test('invalid payload exits at VALIDATE before authorization or side effect', () => {
  const state = runProcessPipeline(createProcessPipelineState(), { validPayload: false })
  assert.equal(state.last.status, 400)
  assert.deepEqual(state.last.trace.map((step) => step.stage), ['VALIDATE'])
  assert.equal(state.processedOrders, 0)
})

test('authorization failure stops pipeline before enrichment', () => {
  const state = runProcessPipeline(createProcessPipelineState(), { authorized: false })
  assert.equal(state.last.status, 403)
  assert.deepEqual(state.last.trace.map((step) => step.stage), ['VALIDATE', 'AUTHORIZE'])
  assert.equal(state.last.context.customerTier, undefined)
  assert.equal(state.processedOrders, 0)
})

test('enrichment dependency failure prevents PROCESS side effect', () => {
  const state = runProcessPipeline(createProcessPipelineState(), { enrichmentAvailable: false })
  assert.equal(state.last.status, 503)
  assert.equal(state.last.outcome, 'ENRICHMENT_UNAVAILABLE')
  assert.deepEqual(state.last.trace.map((step) => step.stage), ['VALIDATE', 'AUTHORIZE', 'ENRICH'])
  assert.equal(state.processedOrders, 0)
})

test('PROCESS failure retains enriched context but creates no persistent order', () => {
  const state = runProcessPipeline(createProcessPipelineState(), { processAvailable: false })
  assert.equal(state.last.status, 503)
  assert.equal(state.last.context.riskScore, 18)
  assert.equal(state.last.trace.at(-1).stage, 'PROCESS')
  assert.equal(state.last.trace.at(-1).status, 'FAIL')
  assert.equal(state.processedOrders, 0)
})

test('only successful runs increment persistent side effect counter', () => {
  let state = createProcessPipelineState()
  state = runProcessPipeline(state, { validPayload: false })
  state = runProcessPipeline(state)
  state = runProcessPipeline(state, { authorized: false })
  state = runProcessPipeline(state)
  assert.equal(state.runs, 4)
  assert.equal(state.processedOrders, 2)
})
