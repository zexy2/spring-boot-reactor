import assert from 'node:assert/strict'
import test from 'node:test'
import { roleInterviewDomains, selectRoleInterviewRound, summarizeRoleInterview } from '../src/data/roleInterview.js'

test('job interview round covers six advertised skill areas with distinct, assessable scenarios', () => {
  assert.deepEqual(roleInterviewDomains.map((domain) => domain.id), [
    'spring', 'sql', 'boundaries', 'resilience', 'delivery', 'enterprise',
  ])

  const allIds = new Set()
  for (const [roundIndex, _] of [0, 1, 2].entries()) {
    const round = selectRoleInterviewRound(roundIndex)
    assert.equal(round.length, 6)
    assert.equal(new Set(round.map((item) => item.domainId)).size, 6)
    for (const item of round) {
      assert.ok(!allIds.has(item.id), `${item.id} repeats within three rounds`)
      allIds.add(item.id)
      assert.ok(item.question.length >= 30, `${item.id}: concrete problem required`)
      assert.ok(item.followUp.length >= 25, `${item.id}: follow-up required`)
      assert.ok(item.answer.length >= 3, `${item.id}: reasoned reference answer required`)
      assert.ok(item.answer.every((line) => line.length >= 40), `${item.id}: too vague`)
      assert.ok(item.pitfall.length >= 30, `${item.id}: pitfall required`)
      assert.equal(item.rubric.length, 4)
      assert.equal(new Set(item.rubric).size, 4)
    }
  }
  assert.equal(allIds.size, 18)
  assert.deepEqual(selectRoleInterviewRound(3).map((item) => item.id), selectRoleInterviewRound(0).map((item) => item.id))
  assert.throws(() => selectRoleInterviewRound(-1), RangeError)
})

test('round scoring identifies the exact weak subjects without pretending automated grading', () => {
  const questions = selectRoleInterviewRound(0)
  const result = summarizeRoleInterview(questions, [4, 2, 3, 0, 1, 4])
  assert.equal(result.total, 14)
  assert.equal(result.max, 24)
  assert.equal(result.average, 14 / 6)
  assert.deepEqual(result.needsWork.map((item) => [item.domainId, item.score]), [
    ['sql', 2], ['resilience', 0], ['delivery', 1],
  ])
  assert.throws(() => summarizeRoleInterview(questions, [4]), RangeError)
  assert.throws(() => summarizeRoleInterview(questions, [4, 4, 4, 4, 4, 5]), RangeError)
})
