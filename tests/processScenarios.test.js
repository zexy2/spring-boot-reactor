import assert from 'node:assert/strict'
import test from 'node:test'
import { lessons } from '../src/data/curriculum.js'
import { processScenarios } from '../src/data/processScenarios.js'

test('new SDLC lessons each have two actionable decision scenarios', () => {
  const ids = Object.keys(processScenarios)
  assert.equal(ids.length, 10)

  for (const id of ids) {
    const lesson = lessons.find((item) => item.id === id)
    assert.ok(lesson, `${id}: lesson must exist`)
    assert.equal(lesson.phase, 'sdlc', `${id}: wrong learning track`)
    assert.equal(processScenarios[id].length, 2, `${id}: need 2 scenarios`)

    for (const [index, scenario] of processScenarios[id].entries()) {
      const label = `${id} scenario ${index + 1}`
      assert.ok(scenario.evidence.trim(), `${label}: missing evidence`)
      assert.ok(scenario.prompt.trim(), `${label}: missing decision prompt`)
      assert.ok(scenario.takeaway.trim(), `${label}: missing interview takeaway`)
      assert.equal(scenario.options.length, 3, `${label}: three concrete options required`)
      assert.equal(new Set(scenario.options).size, 3, `${label}: options must differ`)
      assert.ok(Number.isInteger(scenario.answer) && scenario.answer >= 0 && scenario.answer < 3, `${label}: invalid answer`)
      assert.equal(scenario.feedback.length, scenario.options.length, `${label}: feedback missing for a choice`)
      assert.ok(scenario.options.every((option) => option.trim()), `${label}: blank option`)
      assert.ok(scenario.feedback.every((message) => message.trim()), `${label}: blank feedback`)
    }
  }
})
