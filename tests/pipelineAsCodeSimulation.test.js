import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createPipelineAsCodeState,
  setPipelineTrigger,
  setPipelineFailure,
  togglePipelineDraftStage,
  commitPipelineDefinition,
  runPipelineDefinition,
} from '../src/learning/pipelineAsCodeSimulation.js'

test('PR run verifies quality jobs but policy-skips production deploy', () => {
  const state = runPipelineDefinition(createPipelineAsCodeState())
  assert.equal(state.lastRun.verdict, 'PR VERIFIED · NO DEPLOY')
  assert.equal(state.lastRun.jobs.find((job) => job.stage === 'test').status, 'PASS')
  assert.equal(state.lastRun.jobs.find((job) => job.stage === 'deploy').status, 'POLICY_SKIP')
  assert.equal(state.lastRun.productionPromoted, false)
})

test('tag run with committed quality gates promotes production', () => {
  let state = setPipelineTrigger(createPipelineAsCodeState(), 'tag')
  state = runPipelineDefinition(state)
  assert.equal(state.lastRun.verdict, 'TAG RELEASED')
  assert.equal(state.lastRun.artifact.checksum, 'sha256:7ac91e')
  assert.equal(state.lastRun.productionPromoted, true)
})

test('draft workflow edit does not affect execution until committed', () => {
  let state = togglePipelineDraftStage(createPipelineAsCodeState(), 'scan')
  assert.equal(state.dirty, true)
  assert.equal(state.draftStages.scan, false)
  assert.equal(state.committedStages.scan, true)
  state = runPipelineDefinition(state)
  assert.equal(state.lastRun.jobs.find((job) => job.stage === 'scan').status, 'PASS')
})

test('committing draft increments revision and changes future run definition', () => {
  let state = togglePipelineDraftStage(createPipelineAsCodeState(), 'scan')
  state = commitPipelineDefinition(state)
  assert.equal(state.revision, 4)
  assert.equal(state.dirty, false)
  assert.equal(state.committedStages.scan, false)
  state = runPipelineDefinition(setPipelineTrigger(state, 'tag'))
  assert.equal(state.lastRun.jobs.find((job) => job.stage === 'scan').status, 'SKIP')
  assert.equal(state.lastRun.jobs.find((job) => job.stage === 'deploy').status, 'POLICY_BLOCKED')
  assert.equal(state.lastRun.verdict, 'RELEASE POLICY BLOCKED')
})

test('test failure blocks downstream package and deploy jobs', () => {
  let state = setPipelineFailure(createPipelineAsCodeState(), 'test')
  state = runPipelineDefinition(setPipelineTrigger(state, 'tag'))
  assert.equal(state.lastRun.jobs.find((job) => job.stage === 'test').status, 'FAIL')
  assert.equal(state.lastRun.jobs.find((job) => job.stage === 'package').status, 'BLOCKED')
  assert.equal(state.lastRun.jobs.find((job) => job.stage === 'deploy').status, 'BLOCKED')
  assert.equal(state.lastRun.artifact, null)
})

test('scan failure also prevents package artifact and release', () => {
  let state = setPipelineFailure(createPipelineAsCodeState(), 'scan')
  state = runPipelineDefinition(setPipelineTrigger(state, 'tag'))
  assert.equal(state.lastRun.jobs.find((job) => job.stage === 'scan').status, 'FAIL')
  assert.equal(state.lastRun.artifact, null)
  assert.equal(state.lastRun.productionPromoted, false)
  assert.equal(state.lastRun.verdict, 'PIPELINE FAILED')
})

test('workflow commit preserves trigger and failure scenario as runtime inputs', () => {
  let state = setPipelineTrigger(createPipelineAsCodeState(), 'tag')
  state = setPipelineFailure(state, 'scan')
  state = togglePipelineDraftStage(state, 'lint')
  state = commitPipelineDefinition(state)
  assert.equal(state.trigger, 'tag')
  assert.equal(state.failureStage, 'scan')
  assert.equal(state.committedStages.lint, false)
})
