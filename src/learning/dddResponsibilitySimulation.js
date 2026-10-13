export const DDD_RESPONSIBILITY_CASES = [
  {
    id: 'orchestration',
    title: 'Transfer use case + transaction + repository orchestration',
    owner: 'APPLICATION',
    role: 'Use case akışını koordine eder; domain davranışını çağırır ve transaction sınırını yönetir.',
    dependencies: ['repository', 'transaction', 'domain model'],
  },
  {
    id: 'business-rule',
    title: 'canTransfer(account, amount) invariant',
    owner: 'DOMAIN',
    role: 'Framework ve dış sistem detayından bağımsız iş kuralıdır.',
    dependencies: ['entity/value object', 'business invariant'],
  },
  {
    id: 'translation',
    title: 'LegacyBankDTO → PaymentInstruction translation',
    owner: 'ACL',
    role: 'Dış modelin dilini iç domain modeline bulaştırmadan çevirir.',
    dependencies: ['external DTO', 'mapping', 'domain type'],
  },
]

const WRONG_PLACEMENT = {
  orchestration: {
    DOMAIN: 'Domain katmanı repository/transaction orchestration bilmeye başlar; framework coupling oluşur.',
    ACL: 'ACL dış model çevirisi yerine business use case koordine etmeye başlar; boundary amacı bulanır.',
  },
  'business-rule': {
    APPLICATION: 'İş kuralı application service içine gömülür; domain model anemic olur ve kural tekrar edebilir.',
    ACL: 'Core business invariant external integration boundary içine taşınır; domain ownership kaybolur.',
  },
  translation: {
    APPLICATION: 'External DTO dili use case katmanına sızar; provider değişikliği application code’u etkiler.',
    DOMAIN: 'Legacy provider field’ları domain modeline bulaşır; ubiquitous language kirlenir.',
  },
}

export function evaluateDddResponsibility(caseId, targetLayer) {
  const item = DDD_RESPONSIBILITY_CASES.find((candidate) => candidate.id === caseId)
  if (!item) return null
  const match = item.owner === targetLayer
  return {
    ...item,
    targetLayer,
    match,
    verdict: match ? 'BOUNDARY FIT' : 'BOUNDARY SMELL',
    consequence: match
      ? item.role
      : WRONG_PLACEMENT[item.id]?.[targetLayer] ?? `${item.title} ${item.owner} sorumluluğudur.`,
  }
}
