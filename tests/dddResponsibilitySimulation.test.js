import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateDddResponsibility } from '../src/learning/dddResponsibilitySimulation.js'

test('use case orchestration belongs to Application layer', () => {
  const result = evaluateDddResponsibility('orchestration', 'APPLICATION')
  assert.equal(result.match, true)
  assert.equal(result.verdict, 'BOUNDARY FIT')
  assert.match(result.consequence, /Use case/)
})

test('moving orchestration into Domain creates framework coupling smell', () => {
  const result = evaluateDddResponsibility('orchestration', 'DOMAIN')
  assert.equal(result.match, false)
  assert.match(result.consequence, /framework coupling/)
})

test('business invariant belongs to Domain and not Application orchestration', () => {
  const correct = evaluateDddResponsibility('business-rule', 'DOMAIN')
  const wrong = evaluateDddResponsibility('business-rule', 'APPLICATION')
  assert.equal(correct.match, true)
  assert.equal(wrong.match, false)
  assert.match(wrong.consequence, /anemic/)
})

test('legacy model translation belongs to ACL', () => {
  const correct = evaluateDddResponsibility('translation', 'ACL')
  const wrong = evaluateDddResponsibility('translation', 'DOMAIN')
  assert.equal(correct.match, true)
  assert.equal(wrong.match, false)
  assert.match(wrong.consequence, /ubiquitous language/)
})
