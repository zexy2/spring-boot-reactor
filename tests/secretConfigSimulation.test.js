import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SAFE_SECRET_IMAGE,
  createSecretConfigState,
  setSecretDeliveryMode,
  setSecretEnvironment,
  setSecretAccess,
  deploySecretConfig,
  rotateSecret,
  secretLeakVersions,
} from '../src/learning/secretConfigSimulation.js'

test('runtime secret manager keeps immutable image clean', () => {
  const state = deploySecretConfig(createSecretConfigState())
  assert.equal(state.deployments.prod.imageDigest, SAFE_SECRET_IMAGE.digest)
  assert.equal(state.deployments.prod.secretSource, 'SECRET_MANAGER_RUNTIME')
  assert.deepEqual(secretLeakVersions(state), [])
})

test('same clean image can run staging and prod with different normal config', () => {
  let state = setSecretEnvironment(createSecretConfigState(), 'staging')
  state = deploySecretConfig(state)
  state = setSecretEnvironment(state, 'prod')
  state = deploySecretConfig(state)
  assert.equal(state.deployments.staging.imageDigest, state.deployments.prod.imageDigest)
  assert.notEqual(state.deployments.staging.config.dbUrl, state.deployments.prod.config.dbUrl)
})

test('plain secret mode contaminates artifact history and exposes build evidence', () => {
  let state = setSecretDeliveryMode(createSecretConfigState(), 'plain')
  state = deploySecretConfig(state)
  assert.deepEqual(secretLeakVersions(state), [1])
  assert.match(state.deployments.prod.imageDigest, /leaky-v1/)
  assert.match(state.logs.at(-1), /token_v1_EXPOSED/)
})

test('rotation revokes old workload credential without erasing prior leak history', () => {
  let state = setSecretDeliveryMode(createSecretConfigState(), 'plain')
  state = deploySecretConfig(state)
  state = rotateSecret(state)
  assert.equal(state.secretVersion, 2)
  assert.equal(state.deployments.prod.credentialState, 'REVOKED')
  assert.deepEqual(secretLeakVersions(state), [1])
})

test('runtime redeploy after rotation switches workload to new active credential', () => {
  let state = deploySecretConfig(createSecretConfigState())
  state = rotateSecret(state)
  assert.equal(state.deployments.prod.credentialState, 'REVOKED')
  state = deploySecretConfig(state)
  assert.equal(state.deployments.prod.credentialVersion, 2)
  assert.equal(state.deployments.prod.credentialState, 'ACTIVE')
})

test('runtime access policy can block secret retrieval independently of image/config', () => {
  let state = setSecretAccess(createSecretConfigState(), false)
  state = deploySecretConfig(state)
  assert.equal(state.deployments.prod, null)
  assert.match(state.blockedReason, /workload identity/)
})

test('masked CI variable hides log value but still models CI principal secret access', () => {
  let state = setSecretDeliveryMode(createSecretConfigState(), 'masked')
  state = deploySecretConfig(state)
  assert.equal(state.deployments.prod.secretSource, 'CI_MASKED_VARIABLE')
  assert.equal(state.logs.at(-1), 'PAYMENT_TOKEN=********')
  assert.deepEqual(secretLeakVersions(state), [])
})

test('masked CI deployment is blocked when CI principal lacks secret permission', () => {
  let state = setSecretDeliveryMode(createSecretConfigState(), 'masked')
  state = setSecretAccess(state, false)
  state = deploySecretConfig(state)
  assert.equal(state.deployments.prod, null)
  assert.match(state.blockedReason, /CI principal/)
})
