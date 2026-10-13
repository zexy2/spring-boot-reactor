import test from 'node:test'
import assert from 'node:assert/strict'

import { lessons } from '../src/data/curriculum.js'
import { debugChallenges, evaluateDebugChoice, getDebugChallenge } from '../src/learning/debugChallenges.js'
import { learningRecord, recordDebugAttempt } from '../src/learning/learningState.js'

test('all debugging exercises target a real lesson and have valid answer keys', () => {
  const ids = new Set(lessons.map(({ id }) => id))
  assert.equal(Object.keys(debugChallenges).length, 8)
  for (const [id, challenge] of Object.entries(debugChallenges)) {
    assert.ok(ids.has(id), `Unknown lesson id: ${id}`)
    assert.ok(getDebugChallenge({ id }) === challenge)
    assert.ok(challenge.symptom && challenge.broken && challenge.explanation)
    for (const [stage, options, answer] of [
      ['diagnosis', challenge.diagnosis, challenge.diagnosisAnswer],
      ['fix', challenge.fixes, challenge.fixAnswer],
    ]) {
      assert.equal(options.length, 3, `${id} ${stage}: exactly three choices`)
      assert.ok(Number.isInteger(answer) && answer >= 0 && answer < options.length)
      options.forEach((_, index) => assert.equal(evaluateDebugChoice(challenge, stage, index), index === answer))
    }
  }
})

test('debugging evaluator rejects unknown stages and invalid choices', () => {
  const challenge = getDebugChallenge({ id: 'transactions' })
  assert.equal(evaluateDebugChoice(null, 'fix', 0), false)
  assert.equal(evaluateDebugChoice(challenge, 'done', 0), false)
  assert.equal(evaluateDebugChoice(challenge, 'fix', -1), false)
  assert.equal(evaluateDebugChoice(challenge, 'diagnosis', '0'), false)
  assert.equal(getDebugChallenge({ id: 'not-a-lesson' }), null)
})

test('debug attempts and hints persist independently of completed lesson metrics', () => {
  const original = { ...learningRecord(undefined, 'transactions'), codePassed: true, strength: 76, masteredAt: 1234 }
  const hinted = recordDebugAttempt(original, { hint: true })
  const wrong = recordDebugAttempt(hinted, { stage: 'diagnosis', correct: false })
  const diagnosed = recordDebugAttempt(wrong, { stage: 'diagnosis', correct: true })
  const solved = recordDebugAttempt(diagnosed, { stage: 'fix', correct: true, solved: true })
  const replayed = recordDebugAttempt(solved, { stage: 'diagnosis', correct: false })
  assert.deepEqual([replayed.debugAttempts, replayed.debugCorrect, replayed.debugWrong, replayed.debugHints, replayed.debugSolved], [4, 2, 2, 1, true])
  assert.equal(replayed.codePassed, true)
  assert.equal(replayed.strength, 76)
  assert.equal(replayed.masteredAt, 1234)
  assert.equal(original.debugAttempts, 0)
})

test('debug progress migrates missing counters and ignores malformed actions', () => {
  const legacy = learningRecord({ 'rest': { strength: 42 } }, 'rest')
  assert.equal(legacy.debugAttempts, 0)
  assert.equal(recordDebugAttempt(legacy, { stage: 'invalid', correct: true }).debugAttempts, 0)
  assert.equal(recordDebugAttempt(legacy, { stage: 'fix', correct: 'true' }).debugAttempts, 0)
  assert.equal(recordDebugAttempt(legacy, null).debugAttempts, 0)
})
