export const REQUIREMENT_DECISIONS = [
  {
    id: 'status',
    question: 'Hangi order statuslarında?',
    options: [
      ['created_paid', 'CREATED + PAID'],
      ['created_only', 'Yalnız CREATED'],
    ],
  },
  {
    id: 'refund',
    question: 'Ödeme alınmışsa ne olacak?',
    options: [
      ['auto', 'AUTO REFUND'],
      ['async', 'ASYNC REFUND'],
    ],
  },
  {
    id: 'auth',
    question: 'Kim iptal edebilir?',
    options: [
      ['owner_admin', 'OWNER + ADMIN'],
      ['admin_only', 'Yalnız ADMIN'],
    ],
  },
  {
    id: 'contract',
    question: 'API başarılı cevap ne?',
    options: [
      ['dto', '200 + ORDER DTO'],
      ['empty', '204 NO CONTENT'],
    ],
  },
  {
    id: 'audit',
    question: 'Audit kaydı gerekli mi?',
    options: [
      ['required', 'REQUIRED'],
      ['not_required', 'NOT REQUIRED'],
    ],
  },
]

const labels = Object.fromEntries(
  REQUIREMENT_DECISIONS.flatMap((item) => item.options.map(([value, label]) => [`${item.id}:${value}`, label])),
)

function emptyDecisions() {
  return Object.fromEntries(REQUIREMENT_DECISIONS.map((item) => [item.id, null]))
}

export function createStakeholderRequirementState() {
  return {
    decisions: emptyDecisions(),
    criteriaStatus: 'NOT_READY',
    criteriaVersion: 0,
    criteria: [],
    testStatus: 'NOT_RUN',
    testCases: [],
    missing: REQUIREMENT_DECISIONS.map((item) => item.id),
    nextEventId: 1,
    events: [],
  }
}

function record(state, updates, message, tone = 'info') {
  return {
    ...state,
    ...updates,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-18),
  }
}

export function unresolvedRequirementDecisions(state) {
  return REQUIREMENT_DECISIONS.filter((item) => !state.decisions[item.id]).map((item) => item.id)
}

export function setRequirementDecision(state, id, value) {
  const question = REQUIREMENT_DECISIONS.find((item) => item.id === id)
  if (!question || !question.options.some(([option]) => option === value) || state.decisions[id] === value) return state
  const decisions = { ...state.decisions, [id]: value }
  const missing = REQUIREMENT_DECISIONS.filter((item) => !decisions[item.id]).map((item) => item.id)
  return record(state, {
    decisions,
    criteriaStatus: 'NOT_READY',
    criteria: [],
    testStatus: 'NOT_RUN',
    testCases: [],
    missing,
  }, `${id} kararı → ${labels[`${id}:${value}`]}; eski acceptance/test evidence geçersizleşti.`, state.criteriaVersion || state.testStatus !== 'NOT_RUN' ? 'warn' : 'ok')
}

function buildCriteria(decisions) {
  const statusText = decisions.status === 'created_paid'
    ? 'CREATED veya PAID sipariş iptal edilebilir.'
    : 'Yalnız CREATED sipariş iptal edilebilir; diğer statüler reddedilir.'
  const refundText = decisions.refund === 'auto'
    ? 'PAID sipariş iptalinde refund aynı use case içinde başlatılır.'
    : 'PAID sipariş iptalinde refund isteği asenkron kuyruğa alınır.'
  const authText = decisions.auth === 'owner_admin'
    ? 'Sipariş sahibi veya ADMIN iptal edebilir; diğer kullanıcı 403 alır.'
    : 'Yalnız ADMIN iptal edebilir; sipariş sahibi dahil diğer kullanıcılar 403 alır.'
  const contractText = decisions.contract === 'dto'
    ? 'Başarılı iptal 200 ve güncel Order DTO döndürür.'
    : 'Başarılı iptal 204 döndürür ve response body içermez.'
  const auditText = decisions.audit === 'required'
    ? 'Başarılı iptal actor, orderId, timestamp ve correlationId ile audit edilir.'
    : 'Bu akış için ayrıca business audit kaydı zorunlu değildir.'
  return [statusText, refundText, authText, contractText, auditText]
}

export function generateAcceptanceCriteria(state) {
  const missing = unresolvedRequirementDecisions(state)
  if (missing.length) {
    return record(state, {
      criteriaStatus: 'BLOCKED',
      criteria: [],
      testStatus: 'NOT_RUN',
      testCases: [],
      missing,
    }, `Acceptance criteria BLOCKED: ${missing.join(', ')} kararı eksik.`, 'error')
  }
  const criteriaVersion = state.criteriaVersion + 1
  return record(state, {
    criteriaStatus: 'READY',
    criteriaVersion,
    criteria: buildCriteria(state.decisions),
    testStatus: 'NOT_RUN',
    testCases: [],
    missing: [],
  }, `AC v${criteriaVersion} üretildi: 5 gözlenebilir kural.`, 'ok')
}

export function runRequirementAcceptanceTests(state) {
  if (state.criteriaStatus !== 'READY') {
    return record(state, {
      testStatus: 'BLOCKED',
      testCases: [],
    }, 'Acceptance test BLOCKED: current acceptance criteria READY değil.', 'error')
  }
  const { decisions } = state
  const testCases = [
    {
      id: 'status',
      name: 'State transition',
      expected: decisions.status === 'created_paid' ? 'CREATED/PAID accepted' : 'CREATED accepted · PAID rejected',
      status: 'PASS',
    },
    {
      id: 'refund',
      name: 'Paid cancellation',
      expected: decisions.refund === 'auto' ? 'refund command issued now' : 'refund event queued',
      status: 'PASS',
    },
    {
      id: 'auth',
      name: 'Authorization',
      expected: decisions.auth === 'owner_admin' ? 'owner/admin allowed · stranger 403' : 'admin allowed · others 403',
      status: 'PASS',
    },
    {
      id: 'contract',
      name: 'HTTP contract',
      expected: decisions.contract === 'dto' ? '200 + Order DTO' : '204 + empty body',
      status: 'PASS',
    },
    {
      id: 'audit',
      name: 'Audit policy',
      expected: decisions.audit === 'required' ? 'audit event persisted' : 'no separate audit requirement',
      status: 'PASS',
    },
  ]
  return record(state, {
    testStatus: 'PASS',
    testCases,
  }, `AC v${state.criteriaVersion} acceptance tests → 5/5 PASS.`, 'ok')
}
