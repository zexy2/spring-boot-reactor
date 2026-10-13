export const SUPPORT_DIAGNOSES = [
  ['nullable-name', 'UserProfileMapper null adını işlemiyor'],
  ['db-timeout', 'DB bağlantı havuzu dolu'],
  ['browser-cache', 'Tarayıcı önbelleği eski'],
]

export const SUPPORT_FIXES = [
  ['additive-guard', 'Null guard + eski `name` alanını koru', 'Fallback isim üretir, eski ve yeni tüketiciler birlikte çalışır.'],
  ['rename', '`name` alanını `fullName` yap', 'Yeni UI çalışır; eski istemci `name` bekler.'],
  ['swallow', 'Hata fırlatmayı kaldır, null döndür', '500 gizlenir; beklenen isim hâlâ eksik kalır.'],
]

function initialCheck() { return { status: 'NOT_RUN', revision: null, cases: [] } }

export function createSafeChangeState() {
  return {
    reproduced: false,
    evidence: { logs: false, deploy: false },
    diagnosis: null,
    diagnosisStatus: 'NOT_RUN',
    fix: null,
    revision: 0,
    regression: initialCheck(),
    contract: initialCheck(),
    rollout: { status: 'NOT_STARTED', strategy: null },
    monitoring: { status: 'NOT_RUN', observations: [] },
    latentRegression: false,
    nextEventId: 1,
    events: [],
  }
}

function record(state, change, message, tone = 'info') {
  return {
    ...state,
    ...change,
    nextEventId: state.nextEventId + 1,
    events: [...state.events, { id: state.nextEventId, message, tone }].slice(-20),
  }
}

function block(state, message) { return record(state, {}, message, 'error') }

export function reproduceSupportIncident(state) {
  if (state.reproduced) return state
  return record(state, { reproduced: true }, 'GET /users/42: 500; v2.4.0 öncesinde aynı kayıt 200 dönüyordu.', 'warn')
}

export function inspectSupportEvidence(state, kind) {
  if (!['logs', 'deploy'].includes(kind)) return state
  if (!state.reproduced) return block(state, 'Önce hatayı tekrar üret: gözlenen semptom yok.')
  if (state.evidence[kind]) return state
  return record(state, { evidence: { ...state.evidence, [kind]: true } }, kind === 'logs'
    ? 'Log: NullPointerException · UserProfileMapper:87 · displayName=null.'
    : 'Deploy diff v2.4.0: displayName artık nullable; mapper null kontrolü eklenmemiş.', 'ok')
}

export function diagnoseSupportIncident(state, diagnosis) {
  if (!SUPPORT_DIAGNOSES.some(([id]) => id === diagnosis)) return state
  if (!state.reproduced || !state.evidence.logs || !state.evidence.deploy) return block(state, 'Root cause için reproduksiyon, log ve deploy diff kanıtı gerekli.')
  if (state.fix) return block(state, 'Fix seçildi. Yeni teşhis için senaryoyu sıfırla.')
  const correct = diagnosis === 'nullable-name'
  return record(state, { diagnosis, diagnosisStatus: correct ? 'CONFIRMED' : 'REJECTED' }, correct
    ? 'Root cause doğrulandı: nullable displayName için null guard eksik.'
    : 'Hipotez log/deploy kanıtıyla uyuşmuyor. Mapper stack trace’ini tekrar değerlendir.', correct ? 'ok' : 'error')
}

export function selectSupportFix(state, fix) {
  if (!SUPPORT_FIXES.some(([id]) => id === fix) || state.fix === fix) return state
  if (state.diagnosisStatus !== 'CONFIRMED') return block(state, 'Fix öncesi root cause doğrulanmalı.')
  if (['CANARY', 'FULL', 'HEALTHY', 'HALTED'].includes(state.rollout.status)) return block(state, 'Aktif veya durdurulmuş rollout var. Patch değiştirmeden önce rollback yap.')
  return record(state, {
    fix,
    revision: state.revision + 1,
    regression: initialCheck(),
    contract: initialCheck(),
    rollout: { status: 'NOT_STARTED', strategy: null },
    monitoring: { status: 'NOT_RUN', observations: [] },
  }, `Patch r${state.revision + 1}: ${SUPPORT_FIXES.find(([id]) => id === fix)[1]}. Eski test/rollout kanıtı geçersiz.`, 'warn')
}

export function runSupportRegression(state) {
  if (!state.fix) return block(state, 'Regression testi için önce patch seç.')
  const cases = [
    { name: 'displayName=null', status: state.fix === 'swallow' ? 'FAIL' : 'PASS', detail: state.fix === 'swallow' ? 'İsim null; 200 dönse de iş kuralı bozuk.' : 'Fallback isim üretildi; 200.' },
    { name: 'displayName dolu', status: 'PASS', detail: 'Var olan isim korundu; 200.' },
    { name: 'Kayıt bulunamadı', status: 'PASS', detail: '404 davranışı değişmedi.' },
  ]
  const status = cases.every((c) => c.status === 'PASS') ? 'PASS' : 'FAIL'
  return record(state, { regression: { status, revision: state.revision, cases } }, `Regression r${state.revision}: ${status} (${cases.filter((c) => c.status === 'PASS').length}/3).`, status === 'PASS' ? 'ok' : 'error')
}

export function runSupportContract(state) {
  if (!state.fix) return block(state, 'Contract testi için önce patch seç.')
  const cases = [
    { name: 'v1 istemci `name`', status: state.fix === 'additive-guard' ? 'PASS' : 'FAIL', detail: state.fix === 'rename' ? '`name` eksik; eski client kırıldı.' : state.fix === 'swallow' ? '`name` null; string bekleniyor.' : '`name`: string korunuyor.' },
    { name: 'Yeni istemci', status: 'PASS', detail: state.fix === 'rename' ? '`fullName` okunuyor.' : 'Geriye uyumlu response okunuyor.' },
    { name: 'HTTP contract', status: 'PASS', detail: '200 başarılı, 404 bulunamadı.' },
  ]
  const status = cases.every((c) => c.status === 'PASS') ? 'PASS' : 'FAIL'
  return record(state, { contract: { status, revision: state.revision, cases } }, `Consumer contract r${state.revision}: ${status}.`, status === 'PASS' ? 'ok' : 'error')
}

function checksCurrent(state) {
  return state.fix && ['regression', 'contract'].every((gate) => state[gate].status === 'PASS' && state[gate].revision === state.revision)
}

export function startSupportRollout(state, strategy) {
  if (!['canary', 'full'].includes(strategy)) return state
  if (!checksCurrent(state)) return block(state, `Rollout BLOCKED: patch r${state.revision} için regression ve consumer contract PASS gerekli.`)
  if (state.rollout.status !== 'NOT_STARTED' && state.rollout.status !== 'ROLLED_BACK') return block(state, 'Aktif rollout var. Önce gözlemle veya rollback yap.')
  return record(state, {
    rollout: { status: strategy === 'canary' ? 'CANARY' : 'FULL', strategy },
    monitoring: { status: 'NOT_RUN', observations: [] },
  }, strategy === 'canary' ? 'Canary başladı: trafiğin %10’u r' + state.revision + ' sürümünde.' : 'Full rollout başladı: trafiğin %100’ü r' + state.revision + ' sürümünde.', 'warn')
}

export function injectSupportProductionRegression(state, active) {
  if (state.latentRegression === active) return state
  const launched = ['CANARY', 'FULL', 'HEALTHY', 'HALTED'].includes(state.rollout.status)
  return record(state, {
    latentRegression: active,
    monitoring: { status: 'NOT_RUN', observations: [] },
    rollout: state.rollout.status === 'HEALTHY' ? { ...state.rollout, status: 'FULL' } : state.rollout,
  }, `${active ? 'Risk açıldı' : 'Risk kapandı'}: üretim trafiğinde pool saturation ${active ? 'oluşuyor' : 'giderildi'}.${launched ? ' Monitoring evidence yenilenmeli.' : ''}`, 'warn')
}

export function monitorSupportRollout(state) {
  if (!['CANARY', 'FULL', 'HEALTHY'].includes(state.rollout.status)) return block(state, 'Monitoring için aktif rollout gerekli. HALTED ise önce rollback yap.')
  const impacted = state.rollout.status === 'CANARY' ? '10%' : '100%'
  const fail = state.latentRegression
  const observations = [
    { name: '5xx error rate', value: fail ? '8.2%' : '0.3%', status: fail ? 'FAIL' : 'PASS' },
    { name: 'p95 latency', value: fail ? '1800 ms' : '120 ms', status: fail ? 'FAIL' : 'PASS' },
    { name: 'Yeni sürüm trafiği', value: impacted, status: 'INFO' },
  ]
  return record(state, {
    monitoring: { status: fail ? 'FAIL' : 'PASS', observations },
    rollout: { ...state.rollout, status: fail ? 'HALTED' : state.rollout.status === 'CANARY' ? 'CANARY' : 'HEALTHY' },
  }, fail ? `Monitoring FAIL: ${impacted} trafik etkileniyor. Rollout durduruldu; rollback değerlendir.` : 'Monitoring PASS: error rate ve p95 eşik altında.', fail ? 'error' : 'ok')
}

export function promoteSupportCanary(state) {
  if (state.rollout.status !== 'CANARY' || state.monitoring.status !== 'PASS') return block(state, 'Promote BLOCKED: güncel canary monitoring PASS olmalı.')
  return record(state, { rollout: { status: 'FULL', strategy: 'canary' }, monitoring: { status: 'NOT_RUN', observations: [] } }, 'Canary %10 → %100. Full traffic için monitoring yeniden gerekli.', 'warn')
}

export function rollbackSupportRollout(state) {
  if (!['CANARY', 'FULL', 'HEALTHY', 'HALTED'].includes(state.rollout.status)) return block(state, 'Rollback için dağıtılmış bir sürüm gerekli.')
  return record(state, { rollout: { ...state.rollout, status: 'ROLLED_BACK' } }, 'Rollback: önceki kararlı sürüme dönüldü. Olay raporu ve yeni düzeltme gerekli.', 'warn')
}
