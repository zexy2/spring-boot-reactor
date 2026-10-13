import test from 'node:test'
import assert from 'node:assert/strict'

import { buildAdaptiveMasteryPlan, insertSpacedRetry, preserveRetryContext } from '../src/learning/adaptiveMastery.js'

const questions = [
  { id: 'q-a', conceptId: 'a' },
  { id: 'q-b', conceptId: 'b' },
  { id: 'q-c', conceptId: 'c' },
]

test('adaptive mastery starts with the weakest persisted concept', () => {
  const record = {
    concepts: {
      a: { strength: 80, wrong: 0, correct: 3 },
      b: { strength: 20, wrong: 2, correct: 0 },
      c: { strength: 60, wrong: 1, correct: 2 },
    },
  }

  const plan = buildAdaptiveMasteryPlan(questions, record)

  assert.equal(plan.adaptiveConceptId, 'b')
  assert.deepEqual(plan.questions.map((question) => question.conceptId), ['b', 'a', 'c'])
})

test('adaptive mastery preserves deterministic base order without persisted evidence', () => {
  const plan = buildAdaptiveMasteryPlan(questions, { concepts: {} })

  assert.equal(plan.adaptiveConceptId, null)
  assert.deepEqual(plan.questions, questions)
  assert.notEqual(plan.questions, questions)
})

test('wrong concept retry is interleaved after a different concept when possible', () => {
  const retry = { id: 'q-a-retry', conceptId: 'a', isRetry: true }
  const result = insertSpacedRetry(questions, retry, 0)

  assert.deepEqual(result.map((question) => question.id), ['q-a', 'q-b', 'q-a-retry', 'q-c'])
})

test('wrong concept retry appends when no different concept remains', () => {
  const queue = [
    { id: 'q-a', conceptId: 'a' },
    { id: 'q-a-retry-1', conceptId: 'a', isRetry: true },
  ]
  const retry = { id: 'q-a-retry-2', conceptId: 'a', isRetry: true }
  const result = insertSpacedRetry(queue, retry, 1)

  assert.deepEqual(result.map((question) => question.id), ['q-a', 'q-a-retry-1', 'q-a-retry-2'])
})

test('retry context keeps the original concept source across repeated failures', () => {
  const termCard = { label: 'Bean', meaning: 'Spring tarafından yönetilen nesne' }
  assert.deepEqual(preserveRetryContext(termCard), termCard)

  const source = ['@Transactional', 'Transaction sınırı açar']
  assert.deepEqual(preserveRetryContext({ conceptId: 'tx' }, source), { retrySource: source })
})
