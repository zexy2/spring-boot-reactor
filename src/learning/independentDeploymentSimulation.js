const BASE_FIELDS = ['paymentId', 'amount', 'currency']

const INITIAL_CONSUMERS = [
  { id: 'ORDER', version: 7, amountField: 'amount', redeploys: 0 },
  { id: 'REPORT', version: 3, amountField: 'amount', redeploys: 0 },
]

export function createIndependentDeploymentState() {
  return {
    paymentVersion: 1,
    providerFields: [...BASE_FIELDS],
    consumers: INITIAL_CONSUMERS.map((consumer) => ({ ...consumer })),
    deploys: 0,
    consumerRedeploys: 0,
    nextEventId: 1,
    events: [],
    last: null,
  }
}

function record(state, updates, message, tone = 'info') {
  return {
    ...state,
    ...updates,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-16),
  }
}

function evaluateConsumers(consumers, providerFields) {
  return consumers.map((consumer) => ({
    ...consumer,
    compatible: providerFields.includes(consumer.amountField),
    missingField: providerFields.includes(consumer.amountField) ? null : consumer.amountField,
  }))
}

export function deployPaymentProvider(state, { change = 'additive' } = {}) {
  const paymentVersion = state.paymentVersion + 1
  let providerFields
  let contractChange

  if (change === 'breaking') {
    providerFields = ['paymentId', 'totalAmount', 'currency']
    contractChange = 'amount kaldırıldı; totalAmount geldi'
  } else if (change === 'transitional') {
    providerFields = ['paymentId', 'amount', 'totalAmount', 'currency']
    contractChange = 'totalAmount eklendi; amount geçici korundu'
  } else {
    providerFields = [...BASE_FIELDS, 'status']
    contractChange = 'status alanı eklendi'
  }

  const consumerResults = evaluateConsumers(state.consumers, providerFields)
  const broken = consumerResults.filter((consumer) => !consumer.compatible)
  const independent = broken.length === 0
  const last = {
    action: 'PROVIDER_DEPLOY',
    paymentVersion,
    change,
    contractChange,
    providerFields,
    consumerResults,
    brokenConsumers: broken.map((consumer) => consumer.id),
    independent,
  }

  return record(
    state,
    {
      paymentVersion,
      providerFields,
      deploys: state.deploys + 1,
      last,
    },
    independent
      ? `Payment v${paymentVersion} tek başına deploy edildi; mevcut consumer contract testleri geçti.`
      : `Payment v${paymentVersion} deploy edildi; ${broken.map((consumer) => consumer.id).join(', ')} consumer contract’ı kırıldı.`,
    independent ? 'ok' : 'error',
  )
}

export function redeployConsumer(state, consumerId) {
  const target = state.consumers.find((consumer) => consumer.id === consumerId)
  if (!target) return state

  const nextField = state.providerFields.includes('totalAmount') ? 'totalAmount' : 'amount'
  const consumers = state.consumers.map((consumer) => consumer.id === consumerId
    ? { ...consumer, version: consumer.version + 1, amountField: nextField, redeploys: consumer.redeploys + 1 }
    : consumer)
  const consumerResults = evaluateConsumers(consumers, state.providerFields)
  const broken = consumerResults.filter((consumer) => !consumer.compatible)
  const last = {
    action: 'CONSUMER_REDEPLOY',
    consumerId,
    providerFields: [...state.providerFields],
    consumerResults,
    brokenConsumers: broken.map((consumer) => consumer.id),
    independent: false,
  }

  return record(
    state,
    {
      consumers,
      consumerRedeploys: state.consumerRedeploys + 1,
      last,
    },
    `${consumerId} consumer yeni contract için redeploy edildi.${broken.length ? ` Hâlâ kırık: ${broken.map((consumer) => consumer.id).join(', ')}.` : ' Tüm consumer’lar yeniden uyumlu.'}`,
    broken.length ? 'warn' : 'ok',
  )
}

export function runDeploymentContractTest(state) {
  const consumerResults = evaluateConsumers(state.consumers, state.providerFields)
  const broken = consumerResults.filter((consumer) => !consumer.compatible)
  const last = {
    action: 'CONTRACT_TEST',
    providerFields: [...state.providerFields],
    consumerResults,
    brokenConsumers: broken.map((consumer) => consumer.id),
    independent: broken.length === 0 && state.consumerRedeploys === 0,
  }
  return record(
    state,
    { last },
    broken.length
      ? `Contract test fail: ${broken.map((consumer) => `${consumer.id} ${consumer.missingField} bekliyor`).join(', ')}.`
      : 'Contract test geçti: mevcut provider response tüm consumer beklentilerini karşılıyor.',
    broken.length ? 'error' : 'ok',
  )
}
