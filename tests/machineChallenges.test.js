import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolvePaymentBean, simulateOrderTransaction, runJoinQuery, joinMissionPassed,
  initialServiceFleet, checkoutResponse, fleetMissionPassed,
} from '../src/learning/machineChallenges.js'

test('IoC resolves unique, missing, ambiguous and qualifier-constrained beans', () => {
  assert.equal(resolvePaymentBean({ stripe: true, fake: false }).outcome, 'stripe')
  assert.equal(resolvePaymentBean({ stripe: false, fake: false }).outcome, 'missing')
  assert.equal(resolvePaymentBean({ stripe: true, fake: true }).outcome, 'ambiguous')
  assert.equal(resolvePaymentBean({ stripe: true, fake: true, qualifier: 'fake' }).outcome, 'fake')
  assert.equal(resolvePaymentBean({ stripe: true, fake: false, qualifier: 'fake' }).outcome, 'missing')
})

test('transaction default rules: runtime rolls back, checked commits order, rollbackFor overrides', () => {
  assert.equal(simulateOrderTransaction({ transaction: true, failure: 'runtime' }).outcome, 'rollback')
  assert.deepEqual(
    ['partial', 'COMMITTED', 'NOT WRITTEN'],
    ((x) => [x.outcome, x.order, x.payment])(simulateOrderTransaction({ transaction: true, failure: 'checked', rollbackForChecked: false })),
  )
  assert.equal(simulateOrderTransaction({ transaction: true, failure: 'checked', rollbackForChecked: true }).outcome, 'rollback')
  assert.equal(simulateOrderTransaction({ transaction: false, failure: 'runtime' }).outcome, 'partial')
  assert.equal(simulateOrderTransaction({ transaction: true, failure: 'none' }).outcome, 'commit')
})

test('SQL LEFT JOIN preserves unmatched users and WHERE IS NULL finds only unmatched', () => {
  assert.equal(runJoinQuery({ joinType: 'inner', where: 'all' }).length, 3)
  const all = runJoinQuery({ joinType: 'left', where: 'all' })
  assert.equal(all.length, 5)
  assert.equal(joinMissionPassed('all', all), true)
  assert.equal(joinMissionPassed('all', runJoinQuery({ joinType: 'inner', where: 'all' })), false)
  const unmatched = runJoinQuery({ joinType: 'left', where: 'none' })
  assert.deepEqual(unmatched.map((x) => [x.name, x.orderId]), [['Can', null], ['Ece', null]])
  assert.equal(joinMissionPassed('unmatched', unmatched), true)
  assert.equal(joinMissionPassed('unmatched', runJoinQuery({ joinType: 'inner', where: 'none' })), false)
  const expensive = runJoinQuery({ joinType: 'inner', where: 'high' })
  assert.deepEqual(expensive.map((x) => x.orderId), [102, 103])
  assert.equal(joinMissionPassed('expensive', expensive), true)
})

test('microservice missions verify the requested independent change and checkout status', () => {
  const baseline = structuredClone(initialServiceFleet)
  assert.equal(checkoutResponse(baseline), '200 OK')
  assert.equal(fleetMissionPassed('outage', baseline), false)
  const outage = structuredClone(baseline)
  outage.PAYMENT.up = false
  assert.equal(checkoutResponse(outage), '503 PAYMENT UNAVAILABLE')
  assert.equal(fleetMissionPassed('outage', outage), true)
  outage.ORDER.up = false
  assert.equal(fleetMissionPassed('outage', outage), false)
  const deployed = structuredClone(baseline)
  deployed.PAYMENT.version++
  assert.equal(fleetMissionPassed('deploy', deployed), true)
  deployed.ORDER.version++
  assert.equal(fleetMissionPassed('deploy', deployed), false)
  deployed.ORDER.version = 8
  deployed.PAYMENT.replicas = 2
  assert.equal(fleetMissionPassed('deploy', deployed), false)
  const scaled = structuredClone(baseline)
  scaled.ORDER.replicas = 3
  assert.equal(fleetMissionPassed('scale', scaled), true)
  scaled.CATALOG.replicas = 2
  assert.equal(fleetMissionPassed('scale', scaled), false)
  scaled.CATALOG.replicas = 1
  scaled.PAYMENT.version = 6
  assert.equal(fleetMissionPassed('scale', scaled), false)
})
