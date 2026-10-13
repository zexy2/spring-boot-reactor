import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createMavenArtifactState,
  setMavenTestFailure,
  changeMavenSource,
  runMavenPhase,
  publishMavenArtifact,
  promoteMavenArtifact,
} from '../src/learning/mavenArtifactSimulation.js'

function buildThrough(state, phase) {
  const order = ['resolve', 'compile', 'test', 'package']
  let next = state
  for (const current of order) {
    next = runMavenPhase(next, current)
    if (current === phase) break
  }
  return next
}

test('compile cannot skip dependency resolution evidence', () => {
  const state = runMavenPhase(createMavenArtifactState(), 'compile')
  assert.equal(state.compiled, false)
  assert.match(state.blockedReason, /dependency graph/)
})

test('green lifecycle creates a versioned artifact tied to source commit', () => {
  const state = buildThrough(createMavenArtifactState(), 'package')
  assert.equal(state.tests, 'PASSED')
  assert.equal(state.artifact.version, '1.4.2')
  assert.equal(state.artifact.sourceCommit, state.sourceCommit)
  assert.match(state.artifact.name, /shop-service-1\.4\.2\.jar/)
})

test('failed tests prevent package artifact from being created', () => {
  let state = buildThrough(createMavenArtifactState(), 'compile')
  state = setMavenTestFailure(state, true)
  state = runMavenPhase(state, 'test')
  state = runMavenPhase(state, 'package')
  assert.equal(state.tests, 'FAILED')
  assert.equal(state.artifact, null)
  assert.match(state.blockedReason, /PACKAGE blocked/)
})

test('fixing test fixture and rerunning test allows packaging without repeating compile', () => {
  let state = buildThrough(createMavenArtifactState(), 'compile')
  state = setMavenTestFailure(state, true)
  state = runMavenPhase(state, 'test')
  state = setMavenTestFailure(state, false)
  state = runMavenPhase(state, 'test')
  state = runMavenPhase(state, 'package')
  assert.equal(state.compiled, true)
  assert.equal(state.tests, 'PASSED')
  assert.ok(state.artifact)
})

test('repository publish preserves exact packaged checksum', () => {
  let state = buildThrough(createMavenArtifactState(), 'package')
  const checksum = state.artifact.checksum
  state = publishMavenArtifact(state)
  assert.equal(state.repositoryArtifact.checksum, checksum)
  assert.notEqual(state.repositoryArtifact, state.artifact)
})

test('production promotion requires staging validation and keeps identical checksum', () => {
  let state = publishMavenArtifact(buildThrough(createMavenArtifactState(), 'package'))
  const checksum = state.repositoryArtifact.checksum
  state = promoteMavenArtifact(state, 'production')
  assert.match(state.blockedReason, /staging/)
  assert.equal(state.productionArtifact.version, '1.4.1')
  state = promoteMavenArtifact(state, 'staging')
  state = promoteMavenArtifact(state, 'production')
  assert.equal(state.stagingArtifact.checksum, checksum)
  assert.equal(state.productionArtifact.checksum, checksum)
})

test('new source commit invalidates local build evidence but keeps published old artifact available', () => {
  let state = publishMavenArtifact(buildThrough(createMavenArtifactState(), 'package'))
  const published = state.repositoryArtifact
  state = changeMavenSource(state)
  assert.notEqual(state.sourceCommit, published.sourceCommit)
  assert.equal(state.compiled, false)
  assert.equal(state.tests, 'NOT_RUN')
  assert.equal(state.artifact, null)
  assert.deepEqual(state.repositoryArtifact, published)
})
