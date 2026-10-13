// Deterministic learning models. These illustrate specific rules; no Java or SQL engine runs here.
export function resolvePaymentBean({ stripe, fake, qualifier = 'none' }) {
  const beans = [stripe && 'StripePayment', fake && 'FakePayment'].filter(Boolean)
  const qualified = qualifier === 'none'
    ? beans
    : beans.filter((name) => name === (qualifier === 'stripe' ? 'StripePayment' : 'FakePayment'))
  if (!qualified.length) {
    return { outcome: 'missing', bean: null, detail: 'NoSuchBeanDefinitionException: PaymentPort için uygun bean yok.' }
  }
  if (qualified.length > 1) {
    return { outcome: 'ambiguous', bean: null, detail: 'NoUniqueBeanDefinitionException: PaymentPort için birden fazla bean bulundu.' }
  }
  return { outcome: qualified[0] === 'StripePayment' ? 'stripe' : 'fake', bean: qualified[0], detail: `OrderService(${qualified[0]}) enjekte edildi.` }
}

// One local database, exception thrown after saving order but before writing payment.
export function simulateOrderTransaction({ transaction, rollbackForChecked, failure }) {
  if (failure === 'none') {
    return { outcome: 'commit', order: 'COMMITTED', payment: 'COMMITTED', detail: 'İki INSERT başarılı; değişiklikler commit edildi.' }
  }
  const rollback = transaction && (failure === 'runtime' || rollbackForChecked)
  if (rollback) {
    return { outcome: 'rollback', order: 'ROLLED BACK', payment: 'NOT WRITTEN', detail: failure === 'runtime'
      ? 'RuntimeException varsayılan olarak transaction rollback tetikler.'
      : 'rollbackFor = IOException.class, checked exception için de rollback tetikler.' }
  }
  return { outcome: 'partial', order: 'COMMITTED', payment: 'NOT WRITTEN', detail: transaction
    ? 'Checked exception varsayılan Spring rollback kuralını tetiklemez; ilk INSERT commit edilir.'
    : 'Transaction sınırı yok; ilk INSERT kalır, ikinci adım yazılamaz.' }
}

export const joinUsers = [
  { id: 1, name: 'Zeki' }, { id: 2, name: 'Ayşe' }, { id: 3, name: 'Can' }, { id: 4, name: 'Ece' },
]
export const joinOrders = [
  { id: 101, userId: 1, total: 800 },
  { id: 102, userId: 1, total: 2200 },
  { id: 103, userId: 2, total: 1800 },
]

export function runJoinQuery({ joinType, where }) {
  return joinUsers.flatMap((user) => {
    const matches = joinOrders.filter((order) => order.userId === user.id)
    if (!matches.length && joinType !== 'left') return []
    return (matches.length ? matches : [null]).map((order) => ({
      userId: user.id, name: user.name, orderId: order?.id ?? null, total: order?.total ?? null,
    }))
  }).filter((row) => where === 'high' ? row.total !== null && row.total > 1000
    : where === 'none' ? row.orderId === null : true)
}

export function joinMissionPassed(mission, rows) {
  const expected = {
    all: ['1:101', '1:102', '2:103', '3:null', '4:null'],
    expensive: ['1:102', '2:103'],
    unmatched: ['3:null', '4:null'],
  }[mission]
  return Boolean(expected) && JSON.stringify(rows.map((r) => `${r.userId}:${r.orderId}`).sort()) === JSON.stringify(expected.slice().sort())
}

export const initialServiceFleet = {
  CATALOG: { up: true, replicas: 1, version: 3 },
  ORDER: { up: true, replicas: 2, version: 8 },
  PAYMENT: { up: true, replicas: 1, version: 5 },
}

export function checkoutResponse(services) {
  if (!services.ORDER.up) return '503 ORDER DOWN'
  if (!services.PAYMENT.up) return '503 PAYMENT UNAVAILABLE'
  return '200 OK'
}

export function fleetMissionPassed(mission, services) {
  const { CATALOG, ORDER, PAYMENT } = services
  if (mission === 'outage') return CATALOG.up && ORDER.up && !PAYMENT.up && checkoutResponse(services).startsWith('503')
  if (mission === 'deploy') return CATALOG.up && ORDER.up && PAYMENT.up && PAYMENT.version === 6 && ORDER.version === 8 && CATALOG.version === 3 && CATALOG.replicas === 1 && ORDER.replicas === 2 && PAYMENT.replicas === 1 && checkoutResponse(services) === '200 OK'
  if (mission === 'scale') return CATALOG.up && ORDER.up && PAYMENT.up && ORDER.replicas >= 3 && PAYMENT.replicas === 1 && CATALOG.replicas === 1 && ORDER.version === 8 && PAYMENT.version === 5 && CATALOG.version === 3 && checkoutResponse(services) === '200 OK'
  return false
}
