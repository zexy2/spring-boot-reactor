export const TECHNOLOGY_SCENARIOS = [
  { id: 'orders', label: 'Sipariş olayları', description: 'Aynı orderId olaylarının sırası, 7 gün geçmiş replay ve tekrar gelen event güvenliği zorunlu.' },
  { id: 'jobs', label: 'E-posta iş kuyruğu', description: 'İş başarısız olunca retry / dead-letter ve tekrarlı teslimde idempotent işlem zorunlu.' },
]

export const REPLAY_STORAGE_CASES = [
  { id: 'intact', label: 'Event hâlâ saklı', description: 'İstenen event, seçilen offset’te duruyor.' },
  { id: 'sizeEvicted', label: 'Boyut sınırı', description: 'Topic boyut sınırı eski segmenti sildi; süre yeterli olsa da event artık yok.' },
  { id: 'compacted', label: 'Log compaction', description: 'Aynı key için eski değer compact edildi; tam olay geçmişi artık yok.' },
]

// Fixed example offsets, not measured Kafka offsets. Compaction can leave gaps;
// seeking an old offset never recreates a removed event.
const REPLAY_RECORDS = [
  { offset: 120, age: '7 gün önce', key: 'order-42', event: 'CREATED' },
  { offset: 121, age: '5 gün önce', key: 'order-99', event: 'CREATED' },
  { offset: 122, age: '1 gün önce', key: 'order-42', event: 'PAID' },
  { offset: 123, age: 'Bugün', key: 'order-42', event: 'SHIPPED' },
]

export function getReplayTimeline(state) {
  const { sevenDayRetention, replayOffset } = state.config.kafka
  const records = REPLAY_RECORDS.map((record) => {
    let status = 'stored'
    let reason = 'Topic üzerinde mevcut.'
    if (record.offset === 120 && !sevenDayRetention) {
      status = 'expired'
      reason = 'Zaman retention sınırını aştı.'
    } else if (state.replayStorage === 'sizeEvicted' && record.offset <= 121) {
      status = 'evicted'
      reason = 'Eski log segmenti boyut sınırıyla silindi.'
    } else if (state.replayStorage === 'compacted' && [120, 122].includes(record.offset)) {
      status = 'compacted'
      reason = 'Aynı key için daha yeni kayıt tutuldu.'
    }
    return { ...record, status, reason }
  })
  return {
    records,
    readable: sevenDayRetention && replayOffset && records[0].status === 'stored',
    offsetReady: replayOffset,
  }
}

export const TECHNOLOGY_CONTROLS = {
  kafka: [
    ['keyByOrder', 'Kafka key = orderId', 'Aynı sipariş olayları aynı partition’a gider; sıra partition içinde korunur.'],
    ['sevenDayRetention', '8+ gün retention', '7 gün önceki olayın saklama penceresinde kalması için pay bırak. Boyut/compaction politikaları da olayı silmemeli.'],
    ['replayOffset', 'Replay için offset ayarla', 'Geçmiş kayıtları okumak için ayrı consumer group kullan veya uygun offset’e seek/reset uygula.'],
    ['retryTopics', 'Retry topic + DLQ', 'Başarısız işler retry/dead-letter topic akışına taşınır.'],
    ['idempotent', 'Consumer deduplication', 'Tekrarlı mesaj ikinci kez iş etkisi oluşturmaz.'],
  ],
  rabbit: [
    ['singleConsumer', 'Tek consumer / queue', 'Paralel işleyici kaynaklı sıralama sapması azaltılır; throughput sınırı oluşabilir.'],
    ['manualAck', 'Manual ACK', 'Consumer başarısızsa ACK göndermez; broker yeniden teslim edebilir.'],
    ['deadLetter', 'Dead-letter + retry', 'Hatalı işleri DLX ve retry queue ile yönlendir.'],
    ['idempotent', 'Consumer deduplication', 'At-least-once teslimde yinelenen işi güvenle yut.'],
  ],
}

function initialConfig() {
  return { kafka: { keyByOrder: false, sevenDayRetention: false, replayOffset: false, retryTopics: false, idempotent: false }, rabbit: { singleConsumer: false, manualAck: false, deadLetter: false, idempotent: false } }
}

export function createTechnologyDecisionState() {
  return { scenario: 'orders', team: 'rabbit', replayStorage: 'intact', config: initialConfig(), evidence: { kafka: null, rabbit: null }, recommendation: 'NOT_EVALUATED', reason: '', nextEventId: 1, events: [] }
}

function record(state, change, message, tone = 'info') {
  return { ...state, ...change, nextEventId: state.nextEventId + 1, events: [...state.events, { id: state.nextEventId, message, tone }].slice(-14) }
}

function resetDecision(state) { return { ...state, recommendation: 'NOT_EVALUATED', reason: '' } }

export function setTechnologyScenario(state, scenario) {
  if (!TECHNOLOGY_SCENARIOS.some((item) => item.id === scenario) || state.scenario === scenario) return state
  return record(state, { ...resetDecision(state), scenario, evidence: { kafka: null, rabbit: null } }, `Senaryo: ${scenario}. Önceki test kanıtları farklı requirement'a ait.`, 'warn')
}

export function setTechnologyTeam(state, team) {
  if (!['kafka', 'rabbit', 'both'].includes(team) || state.team === team) return state
  return record(state, { ...resetDecision(state), team }, `Takım deneyimi: ${team}. Trade-off kararı yeniden hesaplanmalı.`, 'warn')
}

export function setTechnologyReplayStorage(state, replayStorage) {
  if (state.scenario !== 'orders' || !REPLAY_STORAGE_CASES.some((entry) => entry.id === replayStorage) || state.replayStorage === replayStorage) return state
  return record(state, {
    ...resetDecision(state),
    replayStorage,
    evidence: { ...state.evidence, kafka: null },
  }, `Kafka replay kaydı: ${replayStorage}. Eski Kafka test kanıtı geçersiz.`, 'warn')
}

export function toggleTechnologyOption(state, candidate, option) {
  if (!Object.hasOwn(TECHNOLOGY_CONTROLS, candidate) || !TECHNOLOGY_CONTROLS[candidate].some(([key]) => key === option)) return state
  const nextConfig = { ...state.config, [candidate]: { ...state.config[candidate], [option]: !state.config[candidate][option] } }
  return record(state, { ...resetDecision(state), config: nextConfig, evidence: { ...state.evidence, [candidate]: null } }, `${candidate}: ${option} = ${nextConfig[candidate][option]}. Bu adayın eski deney sonucu geçersiz.`, 'warn')
}

function computeCases(state, candidate) {
  const config = state.config[candidate]
  if (state.scenario === 'orders') return [
    { name: 'Aggregate ordering', pass: candidate === 'kafka' ? config.keyByOrder : config.singleConsumer,
      detail: candidate === 'kafka' ? 'orderId partition key gerekli; global ordering sağlanmaz.' : 'Tek consumer ile sıralama hedeflenir; redelivery ve requeue davranışına dikkat.',
      remediation: candidate === 'kafka' ? 'Kafka key = orderId seç. Aynı siparişin event’leri aynı partition içinde sıralansın.' : 'Tek consumer / queue seç. Requeue ve yeniden teslimde sıra garantisini ayrıca tasarla.' },
    { name: '7-day replay', pass: candidate === 'kafka' && config.sevenDayRetention && config.replayOffset && state.replayStorage === 'intact',
      detail: candidate === 'kafka' ? 'Olay topic’te mevcut olmalı; hem retention hem başlangıç offset’i uygun olmalı. Boyut sınırı veya compaction geçmiş kaydı silebilir.' : 'Classic queue, ACK edilmiş mesajları replay edemez. RabbitMQ Streams ayrı bir seçenek.',
      remediation: candidate === 'kafka'
        ? [!config.sevenDayRetention && '8+ gün retention seç', !config.replayOffset && 'geçmiş event için consumer offset’i seek/reset yap', state.replayStorage !== 'intact' && 'olayın hâlâ saklanmasını sağla: size retention / cleanup.policy ayarını ve geçmiş olay arşivini incele'].filter(Boolean).join('; ') + '.'
        : 'Bu seçeneklerle düzeltilemez: RabbitMQ Classic Queue yerine Kafka veya ayrı tasarlanmış RabbitMQ Streams değerlendir.' },
    { name: 'At-least-once dedup', pass: config.idempotent, detail: 'Consumer iş etkisi için idempotency key / unique constraint gerekir.',
      remediation: 'Consumer deduplication seç; iş etkisini idempotency key ve DB unique constraint ile koru.' },
  ]
  return [
    { name: 'Failure retry + dead letter', pass: candidate === 'kafka' ? config.retryTopics : config.manualAck && config.deadLetter,
      detail: candidate === 'kafka' ? 'Retry/DLQ topic ve ayrı consumer akışı eklenmeli.' : 'Manual ACK, DLX ve retry queue birlikte yapılandırılmalı.',
      remediation: candidate === 'kafka' ? 'Retry topic + DLQ seç; retry consumer ve poison-message sınırını ayrıca yapılandır.' : [!config.manualAck && 'Manual ACK', !config.deadLetter && 'Dead-letter + retry'].filter(Boolean).join(' ve ') + ' ayarını aç; başarısız işin yeniden teslimini ve izolasyonunu doğrula.' },
    { name: 'At-least-once dedup', pass: config.idempotent, detail: 'ACK veya commit kaybı sonrası tekrar teslim mümkündür.',
      remediation: 'Consumer deduplication seç; aynı e-postaya ikinci kez gönderim yapılmasını engelle.' },
  ]
}

// A deterministic teaching workload. It illustrates failure semantics, not broker timing
// or a substitute for running Kafka/RabbitMQ against real infrastructure.
function simulateBrokerWorkload(state, candidate) {
  const cfg = state.config[candidate]
  const kafka = candidate === 'kafka'
  const step = (label, status, detail) => ({ label, status, detail })
  if (state.scenario === 'orders') {
    return [
      step('01 · PUBLISH', 'ok', 'order-42 CREATED, order-99 CREATED, order-42 PAID ve tekrar gelen order-42 PAID yayınlandı.'),
      kafka
        ? step('02 · PARTITION', cfg.keyByOrder ? 'ok' : 'risk',
          cfg.keyByOrder
            ? 'order-42 olayları aynı key ile aynı partition’a yazılır. Sıralama bu partition içinde korunur.'
            : 'Key yok: order-42 olayları farklı partition’lara dağılabilir. Consumer’lar arası işleme sırası garanti edilemez.')
        : step('02 · CONSUME', cfg.singleConsumer ? 'ok' : 'risk',
          cfg.singleConsumer
            ? 'Tek consumer mesajları kuyruktan sırayla alır; requeue/redelivery gerçekleşirse işleme sırası ayrıca korunmalıdır.'
            : 'Birden fazla consumer paralel çalışır. Aynı order-42 olaylarının tamamlanma sırası değişebilir.'),
      step('03 · DUPLICATE', cfg.idempotent ? 'ok' : 'risk',
        cfg.idempotent
          ? 'Tekrar gelen PAID olayı idempotency key ile ayıklanır; ikinci ödeme etkisi oluşmaz.'
          : 'Tekrar gelen PAID olayı ikinci kez işlenir; çift iş etkisi riski gerçekleşti (örnek senaryo).'),
      kafka
        ? step('04 · REPLAY (7. GÜN)', cfg.sevenDayRetention && cfg.replayOffset && state.replayStorage === 'intact' ? 'ok' : 'blocked',
          !cfg.sevenDayRetention
            ? 'Yedi gün önceki olayın retention nedeniyle silindiği varsayılır. Offset reset kaydı geri getiremez.'
            : state.replayStorage === 'sizeEvicted'
              ? 'Boyut sınırı eski log segmentini sildi. Zaman bazlı retention yeterli olsa da seek/reset event’i geri getiremez.'
              : state.replayStorage === 'compacted'
                ? 'Log compaction aynı key’in eski kaydını temizledi. En güncel değer durabilir, fakat tüm olay geçmişi replay edilemez.'
            : cfg.replayOffset
              ? 'Olayın 8+ günlük retention içinde hâlâ mevcut olduğu varsayılır; offset ayarlanıp yeniden okunur. Tekrar iş etkisine karşı dedup gerekir.'
              : 'Olay saklı, fakat consumer mevcut offset’inden okumaya devam ediyor. Seek/reset veya yeni group olmadan geçmiş okunmaz.')
        : step('04 · REPLAY (7. GÜN)', 'blocked',
          'Classic Queue ACK sonrası mesajı siler. Consumer yeniden bağlansa da geçmiş ACK edilmiş olaylar okunamaz.'),
    ]
  }
  return [
    step('01 · SUBMIT', 'ok', kafka
      ? 'email-42 işi topic’e yazıldı; consumer SMTP gönderimini başlattı.'
      : 'email-42 işi classic queue’ya eklendi; consumer teslim aldı.'),
    kafka
      ? step('02 · SMTP 503', cfg.retryTopics ? 'ok' : 'blocked',
        cfg.retryTopics
          ? 'Başarısız gönderim retry topic’e taşınır. Deneme sınırı dolunca DLQ inceleme için saklar.'
          : 'Retry/DLQ akışı tanımlı değil: hata consumer üzerinde kalır, işin yeniden deneme ve izolasyon politikası eksik.')
      : step('02 · SMTP 503', cfg.manualAck && cfg.deadLetter ? 'ok' : cfg.manualAck ? 'risk' : 'blocked',
        cfg.manualAck && cfg.deadLetter
          ? 'Consumer başarılı işlem sonrası ACK verir; hata için kontrollü nack/dead-letter ve retry queue kullanır.'
          : cfg.manualAck
            ? 'Manual ACK var ancak dead-letter/retry akışı yok; requeue döngüsü veya kuyrukta takılı iş riski var.'
            : 'Auto-ACK varsayımında consumer hata verse bile broker mesajı tamamlanmış sayabilir; iş kaybolabilir.'),
    step('03 · AYRI VAKA: TEKRAR TESLİM', !kafka && !cfg.manualAck ? 'blocked' : cfg.idempotent ? 'ok' : 'risk',
      !kafka && !cfg.manualAck
        ? 'Auto-ACK teslim anında onay verir. Başarılı SMTP gönderiminden sonra ACK kaybı nedeniyle broker redelivery beklenmez; bunun yerine önceki 503 vakasında iş kaybı riski vardır.'
        : cfg.idempotent
          ? 'Bağımsız vaka: SMTP başarılı, fakat ACK/offset commit kayboldu. Yeniden teslim idempotency key ile ikinci e-postayı üretmedi.'
          : 'Bağımsız vaka: SMTP başarılı, fakat ACK/offset commit kayboldu. Yeniden teslim ikinci e-posta gönderebilir; idempotency key eksik.'),
    step('04 · OPERASYON', kafka ? (cfg.retryTopics ? 'ok' : 'risk') : (cfg.manualAck && cfg.deadLetter ? 'ok' : 'risk'),
      kafka
        ? (cfg.retryTopics ? 'Retry topic, DLQ ve ayrı consumer yönetimi gerekir; ek operasyon maliyeti vardır.' : 'Hata yönetimi akışı kurulmadan üretime çıkma.')
        : (cfg.manualAck && cfg.deadLetter ? 'DLX/retry queue, TTL veya gecikmeli retry, poison-message sınırı ve izleme gerekir.' : 'DLX ve ACK stratejisi olmadan hata kurtarma akışı eksik.')),
  ]
}

export function runTechnologyTrial(state, candidate) {
  if (!Object.hasOwn(TECHNOLOGY_CONTROLS, candidate)) return state
  const cases = computeCases(state, candidate).map((item) => ({ ...item, status: item.pass ? 'PASS' : 'FAIL' }))
  const pass = cases.every((item) => item.pass)
  const evidence = { scenario: state.scenario, status: pass ? 'PASS' : 'FAIL', cases, trace: simulateBrokerWorkload(state, candidate) }
  return record(state, { ...resetDecision(state), evidence: { ...state.evidence, [candidate]: evidence } }, `${candidate}: ${cases.filter((c) => c.pass).length}/${cases.length} must-have gate PASS.`, pass ? 'ok' : 'error')
}

function cost(state, candidate) {
  // Relative teaching estimate for a small team, not real benchmark or vendor guarantee.
  const base = state.scenario === 'jobs' ? (candidate === 'kafka' ? 3 : 1) : (candidate === 'kafka' ? 2 : 2)
  return base + (state.team !== 'both' && state.team !== candidate ? 2 : 0)
}

export function decideTechnology(state) {
  if (!state.evidence.kafka || !state.evidence.rabbit) return record(state, { recommendation: 'BLOCKED', reason: 'İki adayın da mevcut senaryoda test kanıtı gerekli.' }, 'Karar BLOCKED: Kafka ve RabbitMQ deneylerini çalıştır.', 'error')
  const eligible = ['kafka', 'rabbit'].filter((candidate) => state.evidence[candidate].scenario === state.scenario && state.evidence[candidate].status === 'PASS')
  if (!eligible.length) return record(state, { recommendation: 'BLOCKED', reason: 'Her iki adayda da zorunlu requirement karşılanmıyor.' }, 'Karar BLOCKED: gerekli yetenekleri yapılandır; tekrar test et.', 'error')
  if (eligible.length === 1) {
    const recommendation = eligible[0]
    const reason = `${recommendation} tüm must-have kriterleri karşıladı; diğer aday en az birinde başarısız.`
    return record(state, { recommendation, reason }, `Mimari karar: ${recommendation}. ${reason}`, 'ok')
  }
  const kafkaCost = cost(state, 'kafka')
  const rabbitCost = cost(state, 'rabbit')
  const recommendation = kafkaCost === rabbitCost ? 'TIE' : kafkaCost < rabbitCost ? 'kafka' : 'rabbit'
  const reason = `İki aday da yeterli. Öğretim amaçlı operasyon/öğrenme yükü: Kafka ${kafkaCost}, RabbitMQ ${rabbitCost}. Eşitlikte ADR için başka kanıt gerek.`
  return record(state, { recommendation, reason }, `Mimari karar: ${recommendation}. ${reason}`, recommendation === 'TIE' ? 'warn' : 'ok')
}
