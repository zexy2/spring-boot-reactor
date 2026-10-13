import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDockerContainerState,
  changeDockerSource,
  buildDockerImage,
  pushDockerImage,
  pullDockerImage,
  setDockerRuntimeEnv,
  runDockerContainer,
  removeDockerContainer,
} from '../src/learning/dockerContainerSimulation.js'

function publishAndPull(state = createDockerContainerState()) {
  return pullDockerImage(pushDockerImage(buildDockerImage(state)))
}

test('image build produces immutable digest tied to current source revision', () => {
  const state = buildDockerImage(createDockerContainerState())
  assert.equal(state.builderImage.tag, 'shop/order:1.0')
  assert.equal(state.builderImage.sourceRevision, 1)
  assert.match(state.builderImage.digest, /^sha256:/)
})

test('registry push and runtime pull preserve exact image digest', () => {
  const state = publishAndPull()
  assert.equal(state.registryImage.digest, state.builderImage.digest)
  assert.equal(state.runtimeImage.digest, state.registryImage.digest)
  assert.notEqual(state.runtimeImage, state.registryImage)
})

test('staging and prod containers can run identical image bytes with different runtime config', () => {
  let state = publishAndPull()
  state = runDockerContainer(state)
  state = setDockerRuntimeEnv(state, 'prod')
  state = runDockerContainer(state)
  const [staging, prod] = state.containers
  assert.equal(staging.imageDigest, prod.imageDigest)
  assert.notEqual(staging.dbUrl, prod.dbUrl)
  assert.equal(staging.env, 'staging')
  assert.equal(prod.env, 'prod')
})

test('removing a container does not delete builder, registry or runtime image', () => {
  let state = runDockerContainer(publishAndPull())
  const digest = state.runtimeImage.digest
  state = removeDockerContainer(state, state.containers[0].id)
  assert.equal(state.containers.length, 0)
  assert.equal(state.builderImage.digest, digest)
  assert.equal(state.registryImage.digest, digest)
  assert.equal(state.runtimeImage.digest, digest)
})

test('source change alone cannot mutate an already built image or running container', () => {
  let state = runDockerContainer(publishAndPull())
  const image = state.builderImage
  const container = state.containers[0]
  state = changeDockerSource(state)
  assert.equal(state.sourceRevision, 2)
  assert.deepEqual(state.builderImage, image)
  assert.deepEqual(state.containers[0], container)
})

test('rebuilding the same tag after source change creates a new digest while old container keeps old digest', () => {
  let state = runDockerContainer(publishAndPull())
  const oldDigest = state.containers[0].imageDigest
  state = changeDockerSource(state)
  state = buildDockerImage(state)
  assert.equal(state.builderImage.tag, 'shop/order:1.0')
  assert.notEqual(state.builderImage.digest, oldDigest)
  assert.equal(state.containers[0].imageDigest, oldDigest)
})

test('runtime cannot run before registry image is pulled', () => {
  let state = buildDockerImage(createDockerContainerState())
  state = pushDockerImage(state)
  state = runDockerContainer(state)
  assert.equal(state.containers.length, 0)
  assert.match(state.blockedReason, /pull/)
})

test('a registry tag can move to a new digest without changing already pulled runtime snapshot', () => {
  let state = publishAndPull()
  const runtimeDigest = state.runtimeImage.digest
  state = changeDockerSource(state)
  state = buildDockerImage(state)
  state = pushDockerImage(state)
  assert.notEqual(state.registryImage.digest, runtimeDigest)
  assert.equal(state.runtimeImage.digest, runtimeDigest)
})
