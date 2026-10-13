import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createSagaState,
  startSaga,
  chargeSagaPayment,
  publishOutbox,
  redeliverSagaPayment,
  decideSagaInventory,
  compensateSaga,
  syncSagaReadModel,
} from '../src/learning/sagaSimulation.js'

const charged = () => publishOutbox(chargeSagaPayment(startSaga(createSagaState())))

test('payment commit stores an outbox record before Inventory can receive its event', () => {
  let saga = chargeSagaPayment(startSaga(createSagaState()))
  assert.equal(saga.phase, 'payment_outbox')
  assert.equal(saga.payment, 'CHARGED')
  assert.equal(saga.outbox, 'PENDING')
  saga = publishOutbox(saga, { publisherAvailable: false })
  assert.equal(saga.phase, 'payment_outbox')
  assert.equal(saga.outboxAttempts, 1)
  assert.equal(saga.events.at(-1).event, 'OutboxPublishFailed')
  saga = publishOutbox(saga)
  assert.equal(saga.phase, 'inventory')
  assert.equal(saga.outbox, 'PUBLISHED')
  assert.equal(saga.outboxAttempts, 2)
  assert.equal(saga.events.at(-1).event, 'OutboxPublished')
})

test('independent local commits confirm an order while read projection remains stale', () => {
  let saga = charged()
  assert.equal(saga.order, 'PENDING')
  assert.equal(saga.payment, 'CHARGED')
  assert.equal(saga.readModel, 'NEW')
  saga = decideSagaInventory(saga, { available: true })
  assert.equal(saga.phase, 'confirmed')
  assert.equal(saga.order, 'CONFIRMED')
  assert.equal(saga.inventory, 'RESERVED')
  assert.equal(saga.readModel, 'NEW')
  saga = syncSagaReadModel(saga)
  assert.equal(saga.readModel, 'CONFIRMED')
  assert.deepEqual(saga.events.map(({ event }) => event), [
    'OrderCreated', 'PaymentCharged', 'OutboxPublished', 'InventoryReserved', 'ReadModelUpdated',
  ])
})

test('rejected inventory needs a separate refund before order can be cancelled', () => {
  let saga = decideSagaInventory(charged(), { available: false })
  assert.equal(saga.phase, 'compensation')
  assert.equal(saga.order, 'PENDING')
  assert.equal(saga.payment, 'CHARGED')
  assert.equal(saga.refunds, 0)
  saga = compensateSaga(saga)
  assert.equal(saga.phase, 'cancelled')
  assert.equal(saga.order, 'CANCELLED')
  assert.equal(saga.payment, 'REFUNDED')
  assert.equal(saga.readModel, 'NEW')
})

test('refund service failure preserves debt and can recover on retry', () => {
  let saga = decideSagaInventory(charged(), { available: false })
  saga = compensateSaga(saga, { refundAvailable: false })
  assert.equal(saga.phase, 'compensation_failed')
  assert.equal(saga.charges - saga.refunds, 1)
  assert.equal(saga.events.at(-1).event, 'RefundFailed')
  saga = compensateSaga(saga, { refundAvailable: true })
  assert.equal(saga.phase, 'cancelled')
  assert.equal(saga.charges, saga.refunds)
})

test('duplicate payment event with idempotency ON cannot charge twice', () => {
  const before = charged()
  const after = redeliverSagaPayment(before)
  assert.equal(after.charges, 1)
  assert.equal(after.ignoredDuplicates, 1)
  assert.equal(after.events.at(-1).event, 'DuplicateIgnored')
})

test('duplicate without idempotency adds financial debt needing two compensations', () => {
  let saga = redeliverSagaPayment(charged(), { idempotent: false })
  assert.equal(saga.charges, 2)
  saga = decideSagaInventory(saga, { available: false })
  saga = compensateSaga(saga)
  assert.equal(saga.phase, 'compensation')
  assert.equal(saga.payment, 'PARTIALLY_REFUNDED')
  assert.equal(saga.charges - saga.refunds, 1)
  saga = compensateSaga(saga)
  assert.equal(saga.phase, 'cancelled')
  assert.equal(saga.payment, 'REFUNDED')
  assert.equal(saga.refunds, 2)
})

test('terminal states ignore further payment redelivery in the bounded lab', () => {
  const confirmed = decideSagaInventory(charged(), { available: true })
  const cancelled = compensateSaga(decideSagaInventory(charged(), { available: false }))
  assert.equal(redeliverSagaPayment(confirmed, { idempotent: false }), confirmed)
  assert.equal(redeliverSagaPayment(cancelled, { idempotent: false }), cancelled)
  assert.equal(compensateSaga(confirmed), confirmed)
  assert.equal(chargeSagaPayment(confirmed), confirmed)
})
