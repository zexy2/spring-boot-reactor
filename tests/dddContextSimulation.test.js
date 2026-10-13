import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getContextMeaning,
  evaluateContextPlacement,
  summarizeContextPlacements,
} from '../src/learning/dddContextSimulation.js'

test('same Customer term carries different models in Order, Payment and Shipping contexts', () => {
  const order = getContextMeaning('Customer', 'ORDER')
  const payment = getContextMeaning('Customer', 'PAYMENT')
  const shipping = getContextMeaning('Customer', 'SHIPPING')
  assert.notEqual(order, payment)
  assert.notEqual(payment, shipping)
  assert.match(order, /buyer/)
  assert.match(payment, /payer/)
  assert.match(shipping, /recipient/)
})

test('Status vocabulary is context-local rather than one shared enum', () => {
  assert.match(getContextMeaning('Status', 'ORDER'), /CREATED/)
  assert.match(getContextMeaning('Status', 'PAYMENT'), /CAPTURED/)
  assert.match(getContextMeaning('Status', 'SHIPPING'), /IN_TRANSIT/)
})

test('placing Refund in Payment is a boundary fit', () => {
  const result = evaluateContextPlacement('refund', 'PAYMENT')
  assert.equal(result.match, true)
  assert.equal(result.verdict, 'BOUNDARY FIT')
})

test('placing Shipment in Order is detected as context leak', () => {
  const result = evaluateContextPlacement('shipment', 'ORDER')
  assert.equal(result.match, false)
  assert.equal(result.verdict, 'CONTEXT LEAK')
  assert.match(result.explanation, /SHIPPING/)
})

test('placement summary counts incomplete and leaking boundaries separately', () => {
  const partial = summarizeContextPlacements({ money: 'ORDER', refund: 'ORDER' })
  assert.equal(partial.placed, 2)
  assert.equal(partial.correct, 1)
  assert.equal(partial.leaks, 1)
  assert.equal(partial.complete, false)

  const complete = summarizeContextPlacements({ money: 'ORDER', refund: 'PAYMENT', shipment: 'SHIPPING' })
  assert.equal(complete.correct, 3)
  assert.equal(complete.leaks, 0)
  assert.equal(complete.complete, true)
})
