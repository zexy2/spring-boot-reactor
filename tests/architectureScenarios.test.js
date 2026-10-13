import assert from 'node:assert/strict'
import test from 'node:test'
import { lessons } from '../src/data/curriculum.js'
import { architectureScenarios } from '../src/data/architectureScenarios.js'
import { processScenarios } from '../src/data/processScenarios.js'

test('six architecture lessons have distinct scenarios with feedback for every decision', () => {
  const ids = Object.keys(architectureScenarios)
  assert.equal(ids.length, 6)
  assert.ok(ids.every((id) => !processScenarios[id]), 'existing process scenarios are preserved')

  for (const id of ids) {
    const lesson = lessons.find((item) => item.id === id)
    assert.equal(lesson?.phase, 'microservices', id)
    const scenarios = architectureScenarios[id]
    assert.equal(scenarios.length, 2, id)
    assert.notEqual(scenarios[0].prompt, scenarios[1].prompt, id)
    for (const scenario of scenarios) {
      assert.ok(scenario.evidence.trim())
      assert.ok(scenario.prompt.trim())
      assert.ok(scenario.takeaway.trim())
      assert.equal(scenario.options.length, 3)
      assert.equal(new Set(scenario.options).size, 3)
      assert.ok(Number.isInteger(scenario.answer) && scenario.answer >= 0 && scenario.answer < 3)
      assert.equal(scenario.feedback.length, 3)
      assert.ok(scenario.feedback.every((message) => message.trim()))
    }
  }
})
