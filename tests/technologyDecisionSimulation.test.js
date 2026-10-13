import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createTechnologyDecisionState,
  setTechnologyScenario,
  setTechnologyTeam,
  setTechnologyReplayStorage,
  getReplayTimeline,
  toggleTechnologyOption,
  runTechnologyTrial,
  decideTechnology,
} from '../src/learning/technologyDecisionSimulation.js'

function configure(state, candidate, options) {
  return options.reduce((current, option) => toggleTechnologyOption(current, candidate, option), state)
}

const kafkaOrderOptions = ['keyByOrder', 'sevenDayRetention', 'replayOffset', 'idempotent']
const rabbitJobOptions = ['manualAck', 'deadLetter', 'idempotent']

test('no ADR without tests of both broker candidates', () => {
  let state = decideTechnology(createTechnologyDecisionState())
  assert.equal(state.recommendation, 'BLOCKED')
  assert.match(state.reason, /İki adayın/)
  state = runTechnologyTrial(configure(state, 'kafka', kafkaOrderOptions), 'kafka')
  state = decideTechnology(state)
  assert.equal(state.recommendation, 'BLOCKED')
})

test('order replay needs Kafka retention even with offset control and deduplication', () => {
  const state = runTechnologyTrial(configure(createTechnologyDecisionState(), 'kafka', ['keyByOrder', 'replayOffset', 'idempotent']), 'kafka')
  assert.equal(state.evidence.kafka.status, 'FAIL')
  assert.equal(state.evidence.kafka.cases.find(item => item.name === '7-day replay').status, 'FAIL')
  assert.match(state.evidence.kafka.trace[3].detail, /silindiği/)
})

test('retained Kafka events require an explicit replay offset, not just retention', () => {
  let state = runTechnologyTrial(configure(createTechnologyDecisionState(), 'kafka', ['keyByOrder', 'sevenDayRetention', 'idempotent']), 'kafka')
  assert.equal(state.evidence.kafka.status, 'FAIL')
  assert.match(state.evidence.kafka.cases[1].remediation, /seek\/reset/)
  assert.match(state.evidence.kafka.trace[3].detail, /Seek\/reset/)
  state = runTechnologyTrial(toggleTechnologyOption(state, 'kafka', 'replayOffset'), 'kafka')
  assert.equal(state.evidence.kafka.status, 'PASS')
  assert.equal(state.evidence.kafka.trace[3].status, 'ok')
})

test('size-based eviction invalidates passing Kafka replay proof and its ADR', () => {
  let state = configure(createTechnologyDecisionState(), 'kafka', kafkaOrderOptions)
  state = decideTechnology(runTechnologyTrial(runTechnologyTrial(state, 'kafka'), 'rabbit'))
  assert.equal(state.recommendation, 'kafka')
  state = setTechnologyReplayStorage(state, 'sizeEvicted')
  assert.equal(state.evidence.kafka, null)
  assert.equal(state.evidence.rabbit.status, 'FAIL')
  assert.equal(state.recommendation, 'NOT_EVALUATED')
  state = runTechnologyTrial(state, 'kafka')
  assert.equal(state.evidence.kafka.cases[1].status, 'FAIL')
  assert.equal(state.evidence.kafka.trace[3].status, 'blocked')
  assert.match(state.evidence.kafka.trace[3].detail, /Boyut sınırı/)
  assert.equal(decideTechnology(state).recommendation, 'BLOCKED')
  state = runTechnologyTrial(setTechnologyReplayStorage(state, 'intact'), 'kafka')
  assert.equal(state.evidence.kafka.status, 'PASS')
})

test('compaction drops historical events despite sufficient time retention and offset reset', () => {
  let state = configure(createTechnologyDecisionState(), 'kafka', kafkaOrderOptions)
  state = runTechnologyTrial(setTechnologyReplayStorage(state, 'compacted'), 'kafka')
  assert.equal(state.evidence.kafka.cases[1].status, 'FAIL')
  assert.match(state.evidence.kafka.cases[1].remediation, /cleanup.policy/)
  assert.match(state.evidence.kafka.trace[3].detail, /compaction/)
})

test('replay timeline distinguishes surviving offsets after size eviction and compaction', () => {
  const configured = configure(createTechnologyDecisionState(), 'kafka', kafkaOrderOptions)
  const intact = getReplayTimeline(configured)
  assert.deepEqual(intact.records.map(({ offset }) => offset), [120, 121, 122, 123])
  assert.deepEqual(intact.records.map(({ status }) => status), ['stored', 'stored', 'stored', 'stored'])
  assert.equal(intact.readable, true)

  const size = getReplayTimeline(setTechnologyReplayStorage(configured, 'sizeEvicted'))
  assert.deepEqual(size.records.map(({ status }) => status), ['evicted', 'evicted', 'stored', 'stored'])
  assert.equal(size.readable, false)
  const compacted = getReplayTimeline(setTechnologyReplayStorage(configured, 'compacted'))
  assert.deepEqual(compacted.records.map(({ status }) => status), ['compacted', 'stored', 'compacted', 'stored'])
  assert.equal(compacted.readable, false)
})

test('replay timeline separates storage from offset position and retention', () => {
  let state = createTechnologyDecisionState()
  let timeline = getReplayTimeline(state)
  assert.equal(timeline.records[0].status, 'expired')
  assert.equal(timeline.offsetReady, false)
  assert.equal(timeline.readable, false)
  state = toggleTechnologyOption(state, 'kafka', 'sevenDayRetention')
  timeline = getReplayTimeline(state)
  assert.equal(timeline.records[0].status, 'stored')
  assert.equal(timeline.readable, false)
  state = toggleTechnologyOption(state, 'kafka', 'replayOffset')
  assert.equal(getReplayTimeline(state).readable, true)

  state = setTechnologyScenario(state, 'jobs')
  assert.equal(setTechnologyReplayStorage(state, 'compacted'), state)
})

test('order stream requires partition key and idempotency independently', () => {
  let state = createTechnologyDecisionState()
  state = runTechnologyTrial(configure(state, 'kafka', ['sevenDayRetention', 'replayOffset', 'idempotent']), 'kafka')
  assert.equal(state.evidence.kafka.cases[0].status, 'FAIL')
  state = runTechnologyTrial(configure(createTechnologyDecisionState(), 'kafka', ['sevenDayRetention', 'replayOffset', 'keyByOrder']), 'kafka')
  assert.equal(state.evidence.kafka.cases.at(-1).status, 'FAIL')
})

test('classic RabbitMQ queue cannot replay acknowledged order events after seven days', () => {
  const state = runTechnologyTrial(configure(createTechnologyDecisionState(), 'rabbit', ['singleConsumer', 'manualAck', 'deadLetter', 'idempotent']), 'rabbit')
  assert.equal(state.evidence.rabbit.status, 'FAIL')
  assert.match(state.evidence.rabbit.cases[1].detail, /Streams/)
  assert.match(state.evidence.rabbit.cases[1].remediation, /düzeltilemez/)
})

test('Kafka wins order scenario when Kafka passes and classic queue fails', () => {
  let state = configure(createTechnologyDecisionState(), 'kafka', kafkaOrderOptions)
  state = runTechnologyTrial(runTechnologyTrial(state, 'kafka'), 'rabbit')
  state = decideTechnology(state)
  assert.equal(state.evidence.kafka.status, 'PASS')
  assert.equal(state.recommendation, 'kafka')
  assert.match(state.evidence.kafka.trace[1].detail, /partition/)
  assert.equal(state.evidence.kafka.trace[3].status, 'ok')
  assert.equal(state.evidence.rabbit.trace[3].status, 'blocked')
})

test('workload trace shows duplicate side effects and missing replay independently', () => {
  let state = createTechnologyDecisionState()
  state = toggleTechnologyOption(state, 'kafka', 'keyByOrder')
  state = runTechnologyTrial(state, 'kafka')
  assert.equal(state.evidence.kafka.trace[1].status, 'ok')
  assert.equal(state.evidence.kafka.trace[2].status, 'risk')
  assert.equal(state.evidence.kafka.trace[3].status, 'blocked')
  state = toggleTechnologyOption(state, 'kafka', 'sevenDayRetention')
  assert.equal(state.evidence.kafka, null)
  state = runTechnologyTrial(state, 'kafka')
  assert.equal(state.evidence.kafka.trace[3].status, 'blocked')
  assert.match(state.evidence.kafka.trace[3].detail, /offset/)
  state = runTechnologyTrial(toggleTechnologyOption(state, 'kafka', 'replayOffset'), 'kafka')
  assert.equal(state.evidence.kafka.trace[3].status, 'ok')
  assert.equal(state.evidence.kafka.trace[2].status, 'risk')
})

test('job queue requires RabbitMQ ACK, dead lettering and deduplication together', () => {
  let state = setTechnologyScenario(createTechnologyDecisionState(), 'jobs')
  state = runTechnologyTrial(configure(state, 'rabbit', ['deadLetter', 'idempotent']), 'rabbit')
  assert.equal(state.evidence.rabbit.status, 'FAIL')
  assert.match(state.evidence.rabbit.cases[0].remediation, /Manual ACK/)
  assert.doesNotMatch(state.evidence.rabbit.cases[0].remediation, /Dead-letter \+ retry/)
  state = runTechnologyTrial(toggleTechnologyOption(state, 'rabbit', 'manualAck'), 'rabbit')
  assert.equal(state.evidence.rabbit.status, 'PASS')
  assert.equal(state.evidence.rabbit.trace[1].status, 'ok')
  assert.equal(state.evidence.rabbit.trace[2].status, 'ok')
})

test('job workload distinguishes Rabbit auto ack, requeue loop and Kafka retry path', () => {
  let state = setTechnologyScenario(createTechnologyDecisionState(), 'jobs')
  state = runTechnologyTrial(state, 'rabbit')
  assert.equal(state.evidence.rabbit.trace[1].status, 'blocked')
  assert.match(state.evidence.rabbit.trace[1].detail, /Auto-ACK/)
  assert.equal(state.evidence.rabbit.trace[2].status, 'blocked')
  assert.match(state.evidence.rabbit.trace[2].detail, /redelivery beklenmez/)
  state = runTechnologyTrial(toggleTechnologyOption(state, 'rabbit', 'manualAck'), 'rabbit')
  assert.equal(state.evidence.rabbit.trace[1].status, 'risk')
  assert.match(state.evidence.rabbit.trace[1].detail, /requeue/)
  assert.equal(state.evidence.rabbit.trace[2].status, 'risk')
  state = runTechnologyTrial(state, 'kafka')
  assert.equal(state.evidence.kafka.trace[1].status, 'blocked')
  state = runTechnologyTrial(toggleTechnologyOption(state, 'kafka', 'retryTopics'), 'kafka')
  assert.equal(state.evidence.kafka.trace[1].status, 'ok')
  assert.equal(state.evidence.kafka.trace[2].status, 'risk')
})

test('Kafka job queue also needs explicit retry topics and idempotency', () => {
  let state = setTechnologyScenario(createTechnologyDecisionState(), 'jobs')
  state = runTechnologyTrial(configure(state, 'kafka', ['idempotent']), 'kafka')
  assert.equal(state.evidence.kafka.status, 'FAIL')
  state = runTechnologyTrial(toggleTechnologyOption(state, 'kafka', 'retryTopics'), 'kafka')
  assert.equal(state.evidence.kafka.status, 'PASS')
})

test('passing job candidates are resolved by explicit team cost heuristic', () => {
  let state = setTechnologyScenario(createTechnologyDecisionState(), 'jobs')
  state = configure(state, 'kafka', ['retryTopics', 'idempotent'])
  state = configure(state, 'rabbit', rabbitJobOptions)
  state = decideTechnology(runTechnologyTrial(runTechnologyTrial(state, 'rabbit'), 'kafka'))
  assert.equal(state.recommendation, 'rabbit')
  assert.match(state.reason, /Öğretim amaçlı/)
  state = decideTechnology(setTechnologyTeam(state, 'kafka'))
  assert.equal(state.recommendation, 'TIE')
})

test('editing one candidate invalidates its evidence and blocks prior ADR', () => {
  let state = configure(createTechnologyDecisionState(), 'kafka', kafkaOrderOptions)
  state = decideTechnology(runTechnologyTrial(runTechnologyTrial(state, 'kafka'), 'rabbit'))
  state = toggleTechnologyOption(state, 'kafka', 'keyByOrder')
  assert.equal(state.evidence.kafka, null)
  assert.equal(state.evidence.rabbit.status, 'FAIL')
  assert.equal(state.recommendation, 'NOT_EVALUATED')
  assert.equal(decideTechnology(state).recommendation, 'BLOCKED')
})

test('switching scenario discards stale tests for both brokers', () => {
  let state = runTechnologyTrial(createTechnologyDecisionState(), 'kafka')
  state = runTechnologyTrial(state, 'rabbit')
  state = setTechnologyScenario(state, 'jobs')
  assert.deepEqual(state.evidence, { kafka: null, rabbit: null })
  assert.equal(state.recommendation, 'NOT_EVALUATED')
})

test('unknown inputs are ignored without corrupting experiment state', () => {
  const state = createTechnologyDecisionState()
  assert.equal(setTechnologyScenario(state, 'unknown'), state)
  assert.equal(setTechnologyTeam(state, 'unknown'), state)
  assert.equal(setTechnologyReplayStorage(state, 'unknown'), state)
  assert.equal(setTechnologyReplayStorage(state, 'intact'), state)
  assert.equal(toggleTechnologyOption(state, 'kafka', 'invented'), state)
  assert.equal(runTechnologyTrial(state, 'unknown'), state)
})
