import { useState } from 'react'
import { motion } from 'motion/react'
import GameFrame from './GameFrame'

const toggleSet = (setValue, key) => {
  setValue((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
}

function StatusStrip({ label, value, tone = '' }) {
  return (
    <div className={`process-status ${tone}`} role="status" aria-live="polite">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}

export function RequirementDiscoveryPlayground({ lesson }) {
  const questions = [
    ['actor', 'KİM?', 'Hangi kullanıcı / rol?', 'Operasyon ekibi'],
    ['behavior', 'NE?', 'Hangi davranış ölçülüyor?', 'Sipariş numarasıyla arama'],
    ['metric', 'NE KADAR?', 'Başarı nasıl ölçülür?', 'p95 < 500 ms · 100 rps'],
    ['constraint', 'SINIR?', 'Neyi bozamayız?', 'Mevcut API sözleşmesi'],
  ]
  const [known, setKnown] = useState(new Set())
  const score = known.size
  const ready = score === questions.length

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="REQUIREMENT RADAR"
      title="Belirsiz isteği test edilebilir requirement’a dönüştür."
      copy="“Arama hızlı olsun” cümlesini doğrudan çözmeye çalışma. Önce bilinmeyenleri görünür yap ve çözüm alanını daralt."
      experiment={{ change: 'Dört kritik netleştirme sorusunu tek tek aç.', watch: 'Requirement ne zaman çözüm önermeye yetecek kadar ölçülebilir oluyor?' }}
      className="process-game process-requirement"
      footer={ready ? 'Requirement uygulanabilir: davranış, ölçüm koşulu ve constraint aynı anda görünür.' : 'Çözüm seçmeden önce eksik bağlamı kapat.'}
    >
      <div className="process-requirement-grid">
        <div className="process-brief-card">
          <small>GELEN İSTEK</small>
          <strong>“Sipariş arama hızlı olsun.”</strong>
          <p>Henüz ne kullanıcı, ne yük, ne ölçüm eşiği belli.</p>
        </div>
        <div className="process-question-grid">
          {questions.map(([id, tag, question, answer]) => {
            const open = known.has(id)
            return (
              <button key={id} className={open ? 'resolved' : ''} aria-pressed={open} onClick={() => toggleSet(setKnown, id)}>
                <span>{tag}</span>
                <strong>{question}</strong>
                <small>{open ? answer : 'soruyu netleştir +'}</small>
              </button>
            )
          })}
        </div>
      </div>
      <div className="process-meter" aria-label={`Requirement netliği yüzde ${score * 25}`}>
        <div><span style={{ width: `${score * 25}%` }} /></div>
        <strong>{score * 25}% NET</strong>
      </div>
      <StatusStrip label="KARAR KAPISI" value={ready ? 'ÇÖZÜM TASARIMINA GEÇ' : `${questions.length - score} BELİRSİZLİK KALDI`} tone={ready ? 'pass' : 'warn'} />
    </GameFrame>
  )
}

export function AcceptanceCriteriaPlayground({ lesson }) {
  const choices = {
    given: ['Süresi dolmuş kupon', 'Redis kullanılıyor', 'Kod review edildi'],
    when: ['Kullanıcı kuponu checkout’ta uygular', 'Developer cache ekler', 'Pipeline deploy olur'],
    then: ['API 422 döner; indirim uygulanmaz', 'Kod daha temiz olur', 'CPU kullanımı düşebilir'],
  }
  const correct = { given: 0, when: 0, then: 0 }
  const [picks, setPicks] = useState({ given: null, when: null, then: null })
  const complete = Object.values(picks).every((value) => value !== null)
  const valid = complete && Object.entries(correct).every(([key, answer]) => picks[key] === answer)

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="GIVEN / WHEN / THEN BUILDER"
      title="Kabul kriterini implementation’dan ayır."
      copy="Başlangıç koşulunu, kullanıcı aksiyonunu ve gözlenebilir sonucu seç. Teknik çözüm ayrıntısını acceptance criterion içine sızdırma."
      experiment={{ change: 'Given, When ve Then parçalarını farklı seçeneklerle kur.', watch: 'Kriter davranışı dışarıdan test edilebilir mi, yoksa implementation detayı mı anlatıyor?' }}
      className="process-game process-acceptance"
      footer={valid ? 'Test edilebilir davranış sözleşmesi oluştu.' : 'İyi AC, bağlam + eylem + gözlenebilir sonuç üçlüsünü kurar.'}
    >
      <div className="process-gwt">
        {Object.entries(choices).map(([key, options]) => (
          <fieldset key={key}>
            <legend>{key.toUpperCase()}</legend>
            {options.map((option, index) => (
              <button
                type="button"
                key={option}
                className={picks[key] === index ? (index === correct[key] ? 'selected correct' : 'selected wrong') : ''}
                aria-pressed={picks[key] === index}
                onClick={() => setPicks((current) => ({ ...current, [key]: index }))}
              >
                {option}
              </button>
            ))}
          </fieldset>
        ))}
      </div>
      <StatusStrip
        label="AC LINTER"
        value={!complete ? '3 parçayı tamamla' : valid ? 'TEST EDİLEBİLİR ✓' : 'IMPLEMENTATION / BELİRSİZLİK VAR'}
        tone={valid ? 'pass' : complete ? 'fail' : 'warn'}
      />
    </GameFrame>
  )
}

export function UserStoryDodPlayground({ lesson }) {
  const cards = [
    ['story', 'Müşteri olarak geçmiş siparişlerimi görmek istiyorum, böylece takip yapabileyim.'],
    ['ac', 'Yalnız giriş yapan müşterinin kendi siparişleri listelenir.'],
    ['dod', 'Testler geçti, review tamam, güvenlik kontrolü ve doküman güncel.'],
  ]
  const labels = { story: 'USER STORY', ac: 'AC', dod: 'DoD' }
  const [assignments, setAssignments] = useState({})
  const done = cards.every(([expected], index) => assignments[index] === expected)

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="DONE GATE"
      title="Değer, davranış ve kalite eşiğini birbirine karıştırma."
      copy="Üç kartı Story, Acceptance Criteria ve Definition of Done alanlarına sınıflandır. Sonra işin gerçekten Done sayılıp sayılamayacağını gör."
      experiment={{ change: 'Her kartın rolünü sınıflandır.', watch: 'Story “neden”, AC “bu iş ne yapar”, DoD ise ortak kalite eşiği olarak ayrışıyor mu?' }}
      className="process-game process-dod"
      footer={done ? 'Story davranışı karşılıyor ve ortak kalite kapısından da geçti: Done.' : 'Acceptance Criteria tek başına tamamlanınca iş otomatik olarak Done olmaz.'}
    >
      <div className="process-classify-grid">
        {cards.map(([expected, text], index) => (
          <article key={text} className={assignments[index] === expected ? 'classified-correct' : assignments[index] ? 'classified-wrong' : ''}>
            <small>KART {index + 1}</small>
            <p>{text}</p>
            <div>
              {Object.entries(labels).map(([key, label]) => (
                <button key={key} aria-pressed={assignments[index] === key} className={assignments[index] === key ? 'selected' : ''} onClick={() => setAssignments((current) => ({ ...current, [index]: key }))}>
                  {label}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
      <StatusStrip label="INCREMENT" value={done ? 'DONE ✓' : 'QUALITY GATE AÇIK'} tone={done ? 'pass' : 'warn'} />
    </GameFrame>
  )
}

export function ScrumRolesPlayground({ lesson }) {
  const tasks = [
    ['Product Owner', 'Product Backlog sırasını iş değerine göre değiştir'],
    ['Developers', 'Sprint Backlog planını günlük olarak uyarla'],
    ['Scrum Master', 'Scrum’ın anlaşılmasına ve engellerin çözülmesine koçluk et'],
    ['Business Analyst', 'İş kuralındaki belirsizliği paydaşla netleştir'],
  ]
  const roles = ['Product Owner', 'Developers', 'Scrum Master', 'Business Analyst']
  const [answers, setAnswers] = useState({})
  const correctCount = tasks.filter(([answer], index) => answers[index] === answer).length

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="ACCOUNTABILITY ROUTER"
      title="İşi doğru accountability’ye yönlendir."
      copy="Scrum accountability’lerini organizasyon unvanlarıyla karıştırma. Her sorumluluğu kimin üstlendiğini seç."
      experiment={{ change: 'Dört görevi rol/accountability seçeneklerine yönlendir.', watch: 'Backlog değeri, Sprint planı, takım etkinliği ve iş analizi sorumlulukları ayrışıyor mu?' }}
      className="process-game process-roles"
      footer={correctCount === tasks.length ? 'Tüm accountability sınırları doğru.' : 'Scrum Master takımın patronu, PO da Sprint planının sahibi değildir.'}
    >
      <div className="process-routing-list">
        {tasks.map(([answer, task], index) => (
          <article key={task}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div><strong>{task}</strong><small>{answers[index] ? (answers[index] === answer ? 'doğru sınır ✓' : `beklenen: ${answer}`) : 'bir sorumlu seç'}</small></div>
            <div className="process-chip-row">
              {roles.map((role) => <button key={role} aria-pressed={answers[index] === role} className={answers[index] === role ? 'selected' : ''} onClick={() => setAnswers((current) => ({ ...current, [index]: role }))}>{role}</button>)}
            </div>
          </article>
        ))}
      </div>
      <StatusStrip label="ACCOUNTABILITY MATCH" value={`${correctCount}/${tasks.length} DOĞRU`} tone={correctCount === tasks.length ? 'pass' : 'warn'} />
    </GameFrame>
  )
}

export function ScrumEventsPlayground({ lesson }) {
  const events = [
    ['Sprint Planning', 'Sprint Goal ve seçilen iş için plan oluştur'],
    ['Daily Scrum', 'Developers günlük planı Sprint Goal’a göre uyarlar'],
    ['Sprint Review', 'Increment’i paydaşlarla incele ve ürün yönünü uyarla'],
    ['Sprint Retrospective', 'Takımın çalışma biçimini ve kaliteyi iyileştir'],
  ]
  const [scenario, setScenario] = useState(0)
  const [selected, setSelected] = useState(null)
  const correct = selected === events[scenario][0]
  const chooseScenario = (index) => { setScenario(index); setSelected(null) }

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="SPRINT EVENT SWITCHBOARD"
      title="Aynı Sprint, dört farklı karar alanı."
      copy="Senaryoyu seç ve doğru Scrum event’ine bağla. Review ile Retrospective arasındaki sınırı özellikle test et."
      experiment={{ change: 'Dört event amacından birini hedef senaryo yap.', watch: 'Ürün sonucu mu, günlük plan mı, Sprint başlangıcı mı, takım çalışma biçimi mi değişiyor?' }}
      className="process-game process-events"
      footer="Refinement faydalı ve sürekli bir activity’dir; Scrum’ın resmi event’i değildir."
    >
      <div className="process-event-tabs">
        {events.map(([, purpose], index) => <button key={purpose} className={scenario === index ? 'active' : ''} onClick={() => chooseScenario(index)}>Senaryo {index + 1}</button>)}
      </div>
      <motion.div key={scenario} className="process-scenario-card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <small>AMAÇ</small><strong>{events[scenario][1]}</strong>
      </motion.div>
      <div className="process-event-line">
        {events.map(([event]) => <button key={event} aria-pressed={selected === event} className={selected === event ? (correct ? 'selected correct' : 'selected wrong') : ''} onClick={() => setSelected(event)}>{event}</button>)}
      </div>
      <StatusStrip label="EVENT PURPOSE" value={selected === null ? 'EVENT SEÇ' : correct ? 'DOĞRU EVENT ✓' : 'AMAÇ UYUŞMUYOR'} tone={correct ? 'pass' : selected ? 'fail' : 'warn'} />
    </GameFrame>
  )
}

export function SprintBacklogPlayground({ lesson }) {
  const items = [
    { id: 'order', name: 'Order API', points: 5, goal: true },
    { id: 'login', name: 'Login fix', points: 3, goal: true },
    { id: 'urgent', name: 'Acil fraud kuralı', points: 5, goal: true },
    { id: 'report', name: 'Dashboard polish', points: 2, goal: false },
  ]
  const [selected, setSelected] = useState(new Set(['order', 'login']))
  const total = items.filter((item) => selected.has(item.id)).reduce((sum, item) => sum + item.points, 0)
  const offGoal = items.some((item) => selected.has(item.id) && !item.goal)
  const healthy = total <= 8 && !offGoal

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="SPRINT SCOPE PLANNER"
      title="Kapasiteyi doldurmak ile Sprint Goal’u korumak aynı şey değil."
      copy="Sprint kapasitesi 8 puan. Yeni işi sessizce üstüne eklemek yerine scope trade-off’unu görünür yap."
      experiment={{ change: 'Backlog item’larını Sprint kapsamına al veya çıkar.', watch: 'Kapasite ve Sprint Goal sinyali hangi seçimlerde bozuluyor?' }}
      className="process-game process-sprint"
      footer={healthy ? 'Plan görünür ve kapasite içinde. Tahmin yine de teslim garantisi değildir.' : total > 8 ? 'Over capacity: yeni iş için mevcut scope PO ile yeniden müzakere edilmeli.' : 'Kapasite uygun olsa da Sprint Goal ile ilgisiz iş odağı dağıtabilir.'}
    >
      <div className="process-capacity-head">
        <div><small>SPRINT GOAL</small><strong>Checkout akışını güvenilir teslim et</strong></div>
        <StatusStrip label="KAPASİTE" value={`${total}/8 PUAN`} tone={total > 8 ? 'fail' : 'pass'} />
      </div>
      <div className="process-backlog-grid">
        {items.map((item) => (
          <button key={item.id} aria-pressed={selected.has(item.id)} className={selected.has(item.id) ? 'selected' : ''} onClick={() => toggleSet(setSelected, item.id)}>
            <small>{item.goal ? 'GOAL ALIGNED' : 'OFF-GOAL'}</small><strong>{item.name}</strong><span>{item.points} pt</span>
          </button>
        ))}
      </div>
      <div className="process-capacity-bar"><span style={{ width: `${Math.min(100, (total / 8) * 100)}%` }} className={total > 8 ? 'over' : ''} /></div>
      <StatusStrip label="SPRINT PLAN" value={healthy ? 'HEALTHY' : total > 8 ? 'SCOPE KARARI GEREKİYOR' : 'GOAL RİSKİ'} tone={healthy ? 'pass' : 'fail'} />
    </GameFrame>
  )
}

export function DocumentationTypesPlayground({ lesson }) {
  const scenarios = [
    ['OpenAPI', 'Consumer yeni GET /orders/{id} endpoint’inin request/response sözleşmesini arıyor.'],
    ['ADR', 'Ekip neden async messaging seçildiğini ve hangi alternatiflerin elendiğini soruyor.'],
    ['Runbook', '02:00’de 5xx alarmı geldi; güvenli teşhis ve rollback adımı gerekiyor.'],
    ['Process Doc', 'Refund talebinin kimden kime hangi onaylarla geçtiği bilinmiyor.'],
  ]
  const docs = ['OpenAPI', 'ADR', 'Runbook', 'Process Doc']
  const [index, setIndex] = useState(0)
  const [choice, setChoice] = useState(null)
  const correct = choice === scenarios[index][0]
  const next = () => { setIndex((value) => (value + 1) % scenarios.length); setChoice(null) }

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="DOCUMENT CONTROL ROOM"
      title="Doğru soruyu doğru dokümana gönder."
      copy="Contract, architecture decision, operations ve business process aynı dokümanda yaşamak zorunda değil."
      experiment={{ change: 'Dört gerçek iş senaryosu arasında geç ve doküman tipini seç.', watch: 'Dokümanın asıl tüketicisi ve cevapladığı soru değişince doğru format da değişiyor mu?' }}
      className="process-game process-docs"
      footer="Profesyonel dokümanın sahibi, güncellik sinyali ve değişiklikle birlikte bakım akışı da belli olmalı."
    >
      <div className="process-doc-scenario">
        <small>İHTİYAÇ {index + 1}/4</small><strong>{scenarios[index][1]}</strong>
        <button onClick={next}>sonraki senaryo →</button>
      </div>
      <div className="process-doc-grid">
        {docs.map((doc) => <button key={doc} aria-pressed={choice === doc} className={choice === doc ? (correct ? 'selected correct' : 'selected wrong') : ''} onClick={() => setChoice(doc)}><strong>{doc}</strong></button>)}
      </div>
      <StatusStrip label="DOCUMENT FIT" value={choice === null ? 'DOKÜMAN SEÇ' : correct ? 'DOĞRU KANAL ✓' : `BU İHTİYAÇ: ${scenarios[index][0]}`} tone={correct ? 'pass' : choice ? 'fail' : 'warn'} />
    </GameFrame>
  )
}

export function KnowledgeTransferPlayground({ lesson }) {
  const checks = [
    ['boot', 'README ile servis ayağa kalktı'],
    ['observe', 'Dashboard + alarm erişimi doğrulandı'],
    ['rollback', 'Güvenli rollback tatbikatı yapıldı'],
    ['owner', 'Owner + escalation zinciri kayıtlı'],
    ['risk', 'Bilinen riskler ve açık işler paylaşıldı'],
  ]
  const [verified, setVerified] = useState(new Set())
  const percent = Math.round((verified.size / checks.length) * 100)
  const ready = verified.size === checks.length

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="HANDOVER READINESS DRILL"
      title="Sunumu değil, devralanın bağımsız çalışabilmesini doğrula."
      copy="Payment Service başka ekibe geçiyor. Handover’ı belge gönderildi diye değil, operasyonel kabiliyet kanıtıyla kapat."
      experiment={{ change: 'Devralan ekibin doğruladığı handover kanıtlarını işaretle.', watch: 'Ownership gerçekten ne zaman eski ekipten bağımsız hâle geliyor?' }}
      className="process-game process-handover"
      footer={ready ? 'Handover kapısı geçti: devralan ekip sistemi çalıştırma ve kurtarma akışını doğruladı.' : 'KT tamamlanmadı: anlatılan bilgi henüz bağımsız operasyon kabiliyetine dönüşmedi.'}
    >
      <div className="process-handover-layout">
        <div className="process-checklist">
          {checks.map(([id, label]) => <button key={id} aria-pressed={verified.has(id)} className={verified.has(id) ? 'checked' : ''} onClick={() => toggleSet(setVerified, id)}><span>{verified.has(id) ? '✓' : '○'}</span><strong>{label}</strong></button>)}
        </div>
        <motion.div className={`process-readiness-orb ${ready ? 'ready' : ''}`} animate={{ scale: ready ? [1, 1.04, 1] : 1 }}>
          <small>HANDOVER</small><strong>{percent}%</strong><span>{ready ? 'READY' : 'EVIDENCE NEEDED'}</span>
        </motion.div>
      </div>
      <StatusStrip label="OWNERSHIP TRANSFER" value={ready ? 'DEVREDİLEBİLİR ✓' : `${checks.length - verified.size} KANIT EKSİK`} tone={ready ? 'pass' : 'warn'} />
    </GameFrame>
  )
}

export function IncidentTriagePlayground({ lesson }) {
  const evidence = [
    ['impact', 'Etkiyi ölç', 'checkout 5xx: %18 · ödeme akışı kritik'],
    ['time', 'Başlangıç zamanını bul', '10:42 sonrası keskin artış'],
    ['trace', 'Trace’i izle', 'Order → Payment timeout'],
    ['change', 'Son değişikliği karşılaştır', 'Payment client 10:39 deploy'],
  ]
  const [collected, setCollected] = useState(new Set())
  const [mitigation, setMitigation] = useState('none')
  const ready = collected.size >= 3
  const strong = collected.has('trace') && collected.has('change')
  const safeRollback = ready && strong

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="INCIDENT TRIAGE CONSOLE"
      title="Önce etki ve kanıt. Sonra kontrollü mitigation."
      copy="Rastgele restart yerine olayın şiddetini, zamanını, request zincirini ve recent change ilişkisini görünür yap."
      experiment={{ change: 'Triage kanıtlarını topla; sonra mitigation seç.', watch: 'Rollback kararı hangi kanıt kombinasyonunda savunulabilir hâle geliyor?' }}
      className="process-game process-incident"
      footer={mitigation === 'rollback' && safeRollback ? 'Kontrollü rollback için change ilişkisi ve etki kanıtı var. Olay iletişimi devam eder.' : mitigation === 'restart' ? 'Restart semptomu saklayabilir ve kanıtı bozabilir; root cause kanıtı üretmez.' : 'Mitigation kalıcı çözüm değildir; incident sonrası root cause ve prevention çalışması gerekir.'}
    >
      <div className="process-incident-layout">
        <div className="process-evidence-list">
          {evidence.map(([id, label, result]) => (
            <button key={id} aria-pressed={collected.has(id)} className={collected.has(id) ? 'collected' : ''} onClick={() => toggleSet(setCollected, id)}>
              <span>{collected.has(id) ? '✓' : '+'}</span><div><strong>{label}</strong><small>{collected.has(id) ? result : 'kanıt topla'}</small></div>
            </button>
          ))}
        </div>
        <div className="process-incident-signal">
          <small>SEVERITY</small><strong>SEV-1</strong><span>{collected.has('impact') ? 'müşteri etkisi doğrulandı' : 'etki ölçülmedi'}</span>
          <div className="process-spark">{[18, 21, 34, 72, 92, 88, 95].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div>
        </div>
      </div>
      <div className="process-mitigation-row">
        <button disabled={!ready} className={mitigation === 'rollback' ? 'selected' : ''} onClick={() => setMitigation('rollback')}>kontrollü rollback</button>
        <button className={mitigation === 'restart' ? 'selected danger' : ''} onClick={() => setMitigation('restart')}>rastgele restart</button>
        <button className={mitigation === 'observe' ? 'selected' : ''} onClick={() => setMitigation('observe')}>kanıt toplamaya devam</button>
      </div>
      <StatusStrip label="MITIGATION GATE" value={!ready ? 'KANIT EKSİK' : safeRollback ? 'ROLLBACK SAVUNULABİLİR' : 'CHANGE İLİŞKİSİ EKSİK'} tone={safeRollback ? 'pass' : 'warn'} />
    </GameFrame>
  )
}

export function RootCausePreventionPlayground({ lesson }) {
  const hypotheses = [
    ['pool', 'connection pool = 2', 'Yük testinde timeout aynı eşikte yeniden oluşuyor.'],
    ['dns', 'DNS arızası', 'DNS metric ve loglarında eşleşen hata yok.'],
    ['cpu', 'CPU saturation', 'CPU olay boyunca %42 seviyesinde.'],
  ]
  const [hypothesis, setHypothesis] = useState(null)
  const [reproduced, setReproduced] = useState(false)
  const [guards, setGuards] = useState(new Set())
  const selected = hypotheses.find(([id]) => id === hypothesis)
  const causeProven = hypothesis === 'pool' && reproduced
  const closed = causeProven && guards.size === 3

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="RCA EVIDENCE LAB"
      title="Korelasyonu nedensellik sanma. Hipotezi yeniden üret, sonra guard ekle."
      copy="Rollback grafiği düzeltmiş olabilir; incident ancak neden kanıtlanıp tekrarını azaltan kontroller eklendiğinde öğrenmeye dönüşür."
      experiment={{ change: 'Hipotez seç, reproduction çalıştır ve prevention guard’larını tamamla.', watch: 'Root cause ne zaman “tahmin” olmaktan çıkıp kanıtlanmış mekanizma hâline geliyor?' }}
      className="process-game process-rca"
      footer={closed ? 'Postmortem kapanabilir: neden kanıtlandı, regression + alert + ownership guard’ları eklendi.' : 'Blameless postmortem kişiyi değil sistemi ve takip edilebilir corrective action’ı hedefler.'}
    >
      <div className="process-hypothesis-grid">
        {hypotheses.map(([id, label, evidence]) => (
          <button key={id} aria-pressed={hypothesis === id} className={hypothesis === id ? 'selected' : ''} onClick={() => { setHypothesis(id); setReproduced(false) }}>
            <small>HİPOTEZ</small><strong>{label}</strong><span>{hypothesis === id ? evidence : 'kanıtla test et'}</span>
          </button>
        ))}
      </div>
      <button className="process-reproduce" disabled={!hypothesis} onClick={() => setReproduced(true)}>yük testinde hipotezi yeniden üret</button>
      <StatusStrip
        label="CAUSAL EVIDENCE"
        value={!reproduced ? 'REPRODUCTION BEKLİYOR' : causeProven ? 'ROOT CAUSE KANITLANDI ✓' : 'HİPOTEZ ÇÜRÜTÜLDÜ'}
        tone={causeProven ? 'pass' : reproduced ? 'fail' : 'warn'}
      />
      <div className="process-guard-grid">
        {[
          ['test', 'Regression test'],
          ['alert', 'p95 timeout alert'],
          ['owner', 'Owner + due date'],
        ].map(([id, label]) => <button key={id} disabled={!causeProven} aria-pressed={guards.has(id)} className={guards.has(id) ? 'checked' : ''} onClick={() => toggleSet(setGuards, id)}><span>{guards.has(id) ? '✓' : '+'}</span><strong>{label}</strong></button>)}
      </div>
      <StatusStrip label="POSTMORTEM" value={closed ? 'CLOSE WITH LEARNING ✓' : causeProven ? `${3 - guards.size} PREVENTION ACTION KALDI` : 'ROOT CAUSE BEKLİYOR'} tone={closed ? 'pass' : 'warn'} />
      {selected && <p className="process-evidence-note">Seçili hipotez: <strong>{selected[1]}</strong></p>}
    </GameFrame>
  )
}
