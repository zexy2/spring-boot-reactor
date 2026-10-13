import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createBrokerState,
  publishOrderEvent,
  deliverBrokerMessage,
  setBrokerConsumerOnline,
  settleBrokerMessage,
  redriveDeadLetter,
  MAX_BROKER_DELIVERIES,
} from '../src/learning/brokerSimulation.js'

test('publishing queues messages independently of consumer delivery and ACK', () => {
  let state = createBrokerState()
  state = publishOrderEvent(publishOrderEvent(state))
  assert.deepEqual(state.ready.map((message) => message.id), ['EVT-001', 'EVT-002'])
  assert.equal(state.stats.published, 2)
  assert.equal(state.stats.payments, 0)

  state = deliverBrokerMessage(state)
  assert.equal(state.inFlight.id, 'EVT-001')
  assert.equal(state.ready.length, 1)
  assert.equal(state.stats.payments, 0)
  assert.equal(deliverBrokerMessage(state), state)

  state = settleBrokerMessage(state)
  assert.equal(state.inFlight, null)
  assert.equal(state.stats.acked, 1)
  assert.equal(state.stats.payments, 1)
})

test('consumer disconnect requeues in-flight message, while producer can still publish', () => {
  let state = deliverBrokerMessage(publishOrderEvent(createBrokerState()))
  state = setBrokerConsumerOnline(state, false)
  assert.equal(state.inFlight, null)
  assert.equal(state.ready[0].id, 'EVT-001')
  state = publishOrderEvent(state)
  assert.equal(state.ready.length, 2)
  assert.equal(deliverBrokerMessage(state), state)
  state = setBrokerConsumerOnline(state, true)
  state = deliverBrokerMessage(state)
  assert.equal(state.inFlight.attempts, 2)
})

test('transient failure retries once then succeeds with a single payment', () => {
  let state = deliverBrokerMessage(publishOrderEvent(createBrokerState()))
  state = settleBrokerMessage(state, { failure: 'transient' })
  assert.equal(state.stats.failures, 1)
  assert.equal(state.stats.payments, 0)
  state = settleBrokerMessage(deliverBrokerMessage(state), { failure: 'transient' })
  assert.equal(state.stats.payments, 1)
  assert.equal(state.stats.acked, 1)
  assert.equal(state.ready.length, 0)
  assert.equal(state.inFlight, null)
})

test('poison message reaches DLQ at retry limit and can be manually redriven', () => {
  let state = publishOrderEvent(createBrokerState())
  for (let attempt = 0; attempt < MAX_BROKER_DELIVERIES; attempt++) {
    state = settleBrokerMessage(deliverBrokerMessage(state), { failure: 'poison' })
  }
  assert.equal(state.stats.failures, MAX_BROKER_DELIVERIES)
  assert.equal(state.ready.length, 0)
  assert.equal(state.dlq.length, 1)
  assert.equal(state.dlq[0].attempts, MAX_BROKER_DELIVERIES)
  state = redriveDeadLetter(state)
  assert.equal(state.dlq.length, 0)
  assert.equal(state.ready[0].attempts, 0)
  state = settleBrokerMessage(deliverBrokerMessage(state))
  assert.equal(state.stats.payments, 1)
})

test('lost ACK causes duplicate delivery; idempotency prevents duplicated side effect', () => {
  const first = settleBrokerMessage(
    deliverBrokerMessage(publishOrderEvent(createBrokerState())),
    { loseAck: true },
  )
  assert.equal(first.stats.payments, 1)
  assert.equal(first.stats.lostAcks, 1)
  assert.equal(first.ready[0].id, 'EVT-001')

  const safe = settleBrokerMessage(deliverBrokerMessage(first), { idempotent: true })
  assert.equal(safe.stats.payments, 1)
  assert.equal(safe.stats.deduplicated, 1)
  assert.equal(safe.stats.acked, 1)

  const unsafe = settleBrokerMessage(deliverBrokerMessage(first), { idempotent: false })
  assert.equal(unsafe.stats.payments, 2)
  assert.equal(unsafe.stats.deduplicated, 0)
})
