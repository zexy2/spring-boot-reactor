import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REQUIREMENT_DECISIONS,
  createStakeholderRequirementState,
  generateAcceptanceCriteria,
  runRequirementAcceptanceTests,
  setRequirementDecision,
  unresolvedRequirementDecisions,
} from '../src/learning/stakeholderRequirementSimulation.js'

function fullyClarifiedState() {
  let state = createStakeholderRequirementState()
  const choices = {
    status: 'created_paid',
    refund: 'auto',
    auth: 'owner_admin',
    contract: 'dto',
    audit: 'required',
  }
  for (const [id, value] of Object.entries(choices)) state = setRequirementDecision(state, id, value)
  return state
}

test('requirement starts with every business decision unresolved', () => {
  const state = createStakeholderRequirementState()
  assert.deepEqual(unresolvedRequirementDecisions(state), REQUIREMENT_DECISIONS.map((item) => item.id))
  assert.equal(state.criteriaStatus, 'NOT_READY')
})

test('acceptance criteria generation is blocked while a clarification is missing', () => {
  // An invalid option is ignored, so build an actually incomplete state.
  let state = createStakeholderRequirementState()
  for (const [id, value] of Object.entries({ status: 'created_paid', refund: 'auto', auth: 'owner_admin', contract: 'dto' })) {
    state = setRequirementDecision(state, id, value)
  }
  state = generateAcceptanceCriteria(state)
  assert.equal(state.criteriaStatus, 'BLOCKED')
  assert.deepEqual(state.missing, ['audit'])
})

test('all clarified decisions produce five observable acceptance criteria', () => {
  const state = generateAcceptanceCriteria(fullyClarifiedState())
  assert.equal(state.criteriaStatus, 'READY')
  assert.equal(state.criteriaVersion, 1)
  assert.equal(state.criteria.length, 5)
  assert.match(state.criteria.join(' '), /403/)
  assert.match(state.criteria.join(' '), /200/)
  assert.match(state.criteria.join(' '), /audit/i)
})

test('acceptance tests cannot run before current criteria are generated', () => {
  const state = runRequirementAcceptanceTests(fullyClarifiedState())
  assert.equal(state.testStatus, 'BLOCKED')
  assert.equal(state.testCases.length, 0)
})

test('generated criteria drive five passing acceptance scenarios', () => {
  let state = generateAcceptanceCriteria(fullyClarifiedState())
  state = runRequirementAcceptanceTests(state)
  assert.equal(state.testStatus, 'PASS')
  assert.equal(state.testCases.length, 5)
  assert.ok(state.testCases.every((item) => item.status === 'PASS'))
})

test('changing a business decision invalidates stale criteria and test evidence', () => {
  let state = generateAcceptanceCriteria(fullyClarifiedState())
  state = runRequirementAcceptanceTests(state)
  state = setRequirementDecision(state, 'contract', 'empty')
  assert.equal(state.criteriaStatus, 'NOT_READY')
  assert.equal(state.testStatus, 'NOT_RUN')
  assert.deepEqual(state.criteria, [])
  assert.deepEqual(state.testCases, [])
})

test('regenerated criteria reflect the changed stakeholder decision', () => {
  let state = generateAcceptanceCriteria(fullyClarifiedState())
  state = setRequirementDecision(state, 'refund', 'async')
  state = generateAcceptanceCriteria(state)
  state = runRequirementAcceptanceTests(state)
  assert.equal(state.criteriaVersion, 2)
  assert.match(state.criteria.join(' '), /asenkron/i)
  assert.equal(state.testCases.find((item) => item.id === 'refund').expected, 'refund event queued')
})
