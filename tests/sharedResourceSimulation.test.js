import test from 'node:test'
import assert from 'node:assert/strict'
import { createSharedResourceState, runSharedResourceMigration } from '../src/learning/sharedResourceSimulation.js'

test('breaking rename on shared schema breaks all direct SQL consumers', () => {
  const state = runSharedResourceMigration(createSharedResourceState(), { architecture: 'shared', strategy: 'breaking' })
  assert.equal(state.last.blastRadius, 3)
  assert.deepEqual(state.last.brokenServices, ['ORDER', 'PAYMENT', 'REPORT'])
  assert.deepEqual(state.last.schemaAfter, ['client_id', 'total'])
  assert.equal(state.incidents, 1)
})

test('database-per-service contains same breaking schema change to owner service', () => {
  const state = runSharedResourceMigration(createSharedResourceState(), { architecture: 'isolated', strategy: 'breaking' })
  assert.equal(state.last.blastRadius, 1)
  assert.deepEqual(state.last.directConsumers, ['ORDER'])
  assert.deepEqual(state.last.brokenServices, ['ORDER'])
  assert.deepEqual(state.last.unaffectedServices, ['PAYMENT', 'REPORT'])
})

test('expand-contract keeps old column during migration and avoids immediate breakage', () => {
  const state = runSharedResourceMigration(createSharedResourceState(), { architecture: 'shared', strategy: 'expand-contract' })
  assert.equal(state.last.blastRadius, 0)
  assert.deepEqual(state.last.brokenServices, [])
  assert.deepEqual(state.last.schemaAfter, ['customer_id', 'client_id', 'total'])
  assert.equal(state.incidents, 0)
})

test('migration runs and incident counter remain independent', () => {
  let state = createSharedResourceState()
  state = runSharedResourceMigration(state, { architecture: 'shared', strategy: 'breaking' })
  state = runSharedResourceMigration(state, { architecture: 'shared', strategy: 'expand-contract' })
  state = runSharedResourceMigration(state, { architecture: 'isolated', strategy: 'breaking' })
  assert.equal(state.runs, 3)
  assert.equal(state.incidents, 2)
  assert.equal(state.events.length, 3)
})
