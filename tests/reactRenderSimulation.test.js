import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createReactRenderState,
  updateReactChildState,
  changeReactProductProp,
  rerenderReactParent,
  setReactMemo,
} from '../src/learning/reactRenderSimulation.js'

test('mount renders parent and child once and runs effect once', () => {
  const state = createReactRenderState()
  assert.equal(state.parentRenders, 1)
  assert.equal(state.childRenders, 1)
  assert.equal(state.effectRuns, 1)
})

test('child local state update rerenders child without rerendering parent or productName effect', () => {
  const state = updateReactChildState(createReactRenderState())
  assert.equal(state.count, 1)
  assert.equal(state.parentRenders, 1)
  assert.equal(state.childRenders, 2)
  assert.equal(state.effectRuns, 1)
})

test('prop change rerenders parent and child and reruns dependency effect', () => {
  const state = changeReactProductProp(createReactRenderState())
  assert.equal(state.productName, 'Mouse')
  assert.equal(state.parentRenders, 2)
  assert.equal(state.childRenders, 2)
  assert.equal(state.effectRuns, 2)
})

test('parent rerender with same prop rerenders normal child but skips effect', () => {
  const state = rerenderReactParent(createReactRenderState())
  assert.equal(state.parentRenders, 2)
  assert.equal(state.childRenders, 2)
  assert.equal(state.effectRuns, 1)
})

test('React.memo skips child rerender when parent rerenders with unchanged props', () => {
  let state = setReactMemo(createReactRenderState(), true)
  state = rerenderReactParent(state)
  assert.equal(state.parentRenders, 2)
  assert.equal(state.childRenders, 1)
  assert.equal(state.effectRuns, 1)
})

test('memoized child still rerenders and reruns effect when its prop changes', () => {
  let state = setReactMemo(createReactRenderState(), true)
  state = changeReactProductProp(state)
  assert.equal(state.childRenders, 2)
  assert.equal(state.effectRuns, 2)
  assert.equal(state.productName, 'Mouse')
})
