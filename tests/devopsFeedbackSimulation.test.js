import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDevOpsFeedbackState,
  setFeedbackRegression,
  setFeedbackTelemetry,
  advanceDevOpsFeedback,
} from '../src/learning/devopsFeedbackSimulation.js'

function advance(state, count) {
  let next = state
  for (let i = 0; i < count; i += 1) next = advanceDevOpsFeedback(next)
  return next
}

test('healthy change produces concrete evidence through OBSERVE before learning', () => {
  const state = advance(createDevOpsFeedbackState(), 4)
  assert.equal(state.stageIndex, 4)
  assert.deepEqual(state.evidences.map((item) => item.stage), ['CODE', 'BUILD', 'DEPLOY', 'OBSERVE'])
  assert.match(state.evidences.find((item) => item.stage === 'BUILD').label, /tests green/)
  assert.match(state.evidences.find((item) => item.stage === 'OBSERVE').label, /SLO healthy/)
})

test('LEARN closes healthy loop and starts a clean evidence cycle', () => {
  const state = advance(createDevOpsFeedbackState(), 5)
  assert.equal(state.cycle, 2)
  assert.equal(state.stageIndex, 0)
  assert.equal(state.decision, 'KEEP RELEASE + next hypothesis')
  assert.deepEqual(state.evidences, [])
  assert.equal(state.events.at(-1).tone, 'ok')
})

test('latent regression stays hidden until production telemetry and drives rollback learning', () => {
  let state = setFeedbackRegression(createDevOpsFeedbackState(), true)
  state = advance(state, 4)
  assert.match(state.evidences.find((item) => item.stage === 'BUILD').label, /tests green/)
  assert.match(state.evidences.find((item) => item.stage === 'OBSERVE').label, /error=8\.4%/)
  state = advanceDevOpsFeedback(state)
  assert.equal(state.decision, 'ROLLBACK + root-cause fix')
  assert.equal(state.events.at(-1).tone, 'warn')
})

test('telemetry outage blocks OBSERVE from claiming a learning decision', () => {
  let state = advance(createDevOpsFeedbackState(), 3)
  state = setFeedbackTelemetry(state, false)
  state = advanceDevOpsFeedback(state)
  assert.equal(state.stageIndex, 3)
  assert.match(state.blockedReason, /Telemetry yok/)
  assert.equal(state.evidences.some((item) => item.stage === 'OBSERVE'), false)
})

test('restoring telemetry resumes from OBSERVE without repeating deployment', () => {
  let state = advance(createDevOpsFeedbackState(), 3)
  state = setFeedbackTelemetry(state, false)
  state = advanceDevOpsFeedback(state)
  const deployEvidence = state.evidences.find((item) => item.stage === 'DEPLOY')
  state = setFeedbackTelemetry(state, true)
  state = advanceDevOpsFeedback(state)
  assert.equal(state.stageIndex, 4)
  assert.equal(state.evidences.find((item) => item.stage === 'DEPLOY'), deployEvidence)
  assert.match(state.evidences.find((item) => item.stage === 'OBSERVE').label, /SLO healthy/)
})
