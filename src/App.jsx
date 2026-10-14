import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import ActiveRecall from './components/learning/ActiveRecall'
import CodeWorkout, { prefetchCodeWorkoutRuntime } from './components/learning/CodeWorkout'
import DebugWorkout from './components/learning/DebugWorkout'
import ProgressBackup from './components/learning/ProgressBackup'
import GuidedLessonIntro from './components/learning/GuidedLessonIntro'
import MemoryGame, { prefetchLessonPlaygroundRuntime } from './components/learning/LessonPlayground'
import { InterviewMode, MixedInterviewPanel, RoleInterviewPanel } from './components/learning/InterviewPractice'
import { lessons, phases } from './data/curriculum'
import { processScenarios } from './data/processScenarios'
import { architectureScenarios } from './data/architectureScenarios'
import { arrangeChoices, hashString } from './learning/choiceUtils'
import { buildCodePractice } from './learning/codePractice'
import { buildCheckpointQuestions, buildRetryQuestion } from './learning/checkpointQuestions'
import { conceptAliases, escapeRegex, getConceptDetail, getLessonTerms, getPrerequisites, normalizeConcept } from './learning/concepts'
import { buildAdaptiveMasteryPlan, insertSpacedRetry } from './learning/adaptiveMastery'
import { validatedCompletedLessonIds } from './learning/progressIntegrity'
import { restoreProgressBackup } from './learning/progressTransfer'
import { isLessonShortcut, lessonIdFromUrl, lessonUrl, shouldHandleLessonLinkClick } from './learning/lessonNavigation'
import {
  getGuidedActiveRecall,
  getGuidedLearningGoal,
  getGuidedPrediction,
  getGuidedSummary,
} from './learning/guidedLearning'
import {
  buildDailyStudyPlan,
  calculateInterviewReadiness,
  checkpointMasteryState,
  codeNoteConceptId,
  dueReviewLessons,
  formatReviewDistance,
  learningRecord,
  learningStatus,
  migrateLegacyCodeConceptIds,
  nextReviewInterval,
  recordCheckpointAnswer,
  recordConceptAnswer,
  recordDebugAttempt,
  recordInterviewAttempt,
  recordRecallCoverage,
  weakestConceptId,
} from './learning/learningState'
const flow = [
  { label: 'Browser', sub: 'GET /products', detail: 'İstek dış dünyadan gelir.' },
  { label: 'DispatcherServlet', sub: 'doğru yolu bul', detail: 'Spring MVC isteği uygun Controller tarafına yönlendirir.' },
  { label: 'Controller', sub: 'HTTP sınırı', detail: 'Request bilgisini alır ve uygulama use-case’ine bağlar.' },
  { label: 'Service', sub: 'iş kuralı', detail: 'Business rule ve use-case burada yürür.' },
  { label: 'Repository', sub: 'veri erişimi', detail: 'Gerekiyorsa kalıcı veriye erişim yapılır.' },
  { label: 'Database', sub: 'kalıcı veri', detail: 'Veri okunur veya değiştirilir.' },
]

const primer = [
  { token: 'class', title: 'Kalıp', detail: 'Yeni bir Java tipi tanımlar. Object’ler bu kalıptan üretilebilir.', sample: 'class Product { }' },
  { token: '()', title: 'Çağrı / parametre alanı', detail: 'Method çağrısı veya tanımında parantez görürsün. Constructor da parantez kullanır.', sample: 'product.label()' },
  { token: 'new', title: 'Object oluştur', detail: 'Bir class’tan yeni object oluştururken kullanılır.', sample: 'new Product()' },
  { token: '@', title: 'Annotation', detail: 'Koda metadata ekler. Tek başına object oluşturmaz.', sample: '@Override' },
  { token: '<T>', title: 'Generic tip', detail: 'Bir yapı içinde hangi tipin taşındığını belirtir.', sample: 'List<Product>' },
]

function InteractiveCode({ code, concepts, onConcept }) {
  const aliasMap = []
  concepts.forEach((concept) => {
    conceptAliases(concept.term).forEach((alias) => aliasMap.push({ alias, concept }))
  })
  aliasMap.sort((a, b) => b.alias.length - a.alias.length)
  const unique = aliasMap.filter((item, index) => aliasMap.findIndex((other) => other.alias.toLocaleLowerCase('tr-TR') === item.alias.toLocaleLowerCase('tr-TR')) === index)
  if (!unique.length) return <code>{code}</code>

  const pattern = new RegExp(`(${unique.map((item) => escapeRegex(item.alias)).join('|')})`, 'gi')
  return (
    <code>
      {code.split(pattern).map((part, index) => {
        const match = unique.find((item) => item.alias.toLocaleLowerCase('tr-TR') === part.toLocaleLowerCase('tr-TR'))
        if (!match) return <span key={`${part}-${index}`}>{part}</span>
        return <button type="button" className="code-concept" key={`${part}-${index}`} onClick={() => onConcept(match.concept)}>{part}</button>
      })}
    </code>
  )
}

function ProgressRing({ value, label = 'Müfredat ilerlemesi' }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  return (
    <div className="progress-ring" aria-label={`${label} yüzde ${value}`} title={`${label}: %${value}`}>
      <svg viewBox="0 0 52 52">
        <circle className="ring-track" cx="26" cy="26" r={radius} />
        <circle className="ring-value" cx="26" cy="26" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <strong>{value}%</strong>
    </div>
  )
}

const readinessMetricMeta = [
  ['coverage', 'Müfredat', 'Yeni derslerde ilerle.'],
  ['strength', 'Güç', 'Zayıf derslerin checkpointlerini tekrar çöz.'],
  ['retention', 'Kalıcılık', 'Tekrar kuyruğunu temizle.'],
  ['accuracy', 'Doğruluk', 'Yanlış yaptığın kavramlara geri dön.'],
  ['recall', 'Aktif recall', 'Cevabı görmeden kendi cümlenle hatırla.'],
  ['interview', 'Mülakat', '60 saniyelik mülakat turlarını tamamla.'],
]

function ReadinessPanel({ readiness, onClose }) {
  const closeRef = useRef(null)
  const metrics = readinessMetricMeta.map(([key, label, advice]) => ({ key, label, advice, value: readiness[key] ?? 0 }))
  const weakest = metrics.reduce((current, metric) => (metric.value < current.value ? metric : current), metrics[0])

  useEffect(() => {
    closeRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <aside className="readiness-panel" role="dialog" aria-modal="false" aria-labelledby="readiness-title">
      <div className="readiness-panel-head">
        <div><small id="readiness-title">MÜLAKAT HAZIRLIK</small><strong>{readiness.score}%</strong></div>
        <button ref={closeRef} onClick={onClose} aria-label="Hazırlık detayını kapat">×</button>
      </div>
      <p>Hazırlık puanı yalnızca kaç ders bitirdiğini değil; kalıcılık, doğruluk, aktif recall ve mülakat performansını da hesaba katar.</p>
      <div className="readiness-metrics">
        {metrics.map((metric) => (
          <div className="readiness-metric" key={metric.key}>
            <span><small>{metric.label}</small><b>{metric.value}%</b></span>
            <i><em style={{ width: `${metric.value}%` }} /></i>
          </div>
        ))}
      </div>
      <div className="readiness-priority"><small>ŞİMDİKİ ÖNCELİK</small><strong>{weakest.label}</strong><p>{weakest.advice}</p></div>
    </aside>
  )
}

function codeLanguageForLesson(lesson) {
  const code = String(lesson?.code ?? '')
  if (lesson?.id === 'python-basics') return 'python'
  if (lesson?.id === 'react-basics') return 'jsx'
  if (/(^|\n)\s*(SELECT|CREATE\s+TABLE|CREATE\s+INDEX|ALTER\s+TABLE|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|EXPLAIN)\b/i.test(code)) return 'sql'
  if (/(^|\n)\s*(management|spring|server|logging|services|jobs|name|on):/m.test(code)) return 'yaml'
  if (/\b(FROM|RUN|COPY|ENTRYPOINT|CMD)\b/.test(code) && !/[;{}]/.test(code)) return 'dockerfile'
  if (['microservices', 'ddd', 'sdlc', 'enterprise'].includes(lesson?.phase)) return 'model'
  if (lesson?.phase === 'devops' && !/[;{}]/.test(code)) return 'pipeline / shell'
  return 'java'
}

function earnedLessonXp(lesson, record, completed) {
  if (!completed) return 0
  const max = Number(lesson.xp) || 0
  const attempts = (Number(record.correct) || 0) + (Number(record.wrong) || 0)
  const accuracy = attempts > 0 ? (Number(record.correct) || 0) / attempts : 0
  const recallAttempts = Number(record.recallAttempts) || 0
  const recallScore = recallAttempts > 0
    ? Math.min(1, ((Number(record.recallFull) || 0) + ((Number(record.recallPartial) || 0) * 0.5)) / recallAttempts)
    : 0
  const interviewScore = Math.max(0, Math.min(4, Number(record.interviewBestScore) || 0)) / 4
  return Math.round(max * (0.6 + (accuracy * 0.2) + (recallScore * 0.1) + (interviewScore * 0.1)))
}

function PrimerLab() {
  const [index, setIndex] = useState(0)
  const item = primer[index]

  return (
    <section className="primer-lab" aria-label="Kod okuma laboratuvarı">
      <div className="primer-copy">
        <span className="eyebrow">SIFIRDAN KOD OKUMA LAB</span>
        <h2>Önce gördüğün sembolü çöz.</h2>
        <p>Spring’e geçmeden önce Java kodunu okuyabilmen gerekiyor. Aşağıdaki parçaları tek tek tıkla.</p>
      </div>
      <div className="primer-grid">
        <div className="primer-tokens">
          {primer.map((part, partIndex) => (
            <button key={part.token} className={partIndex === index ? 'active' : ''} onClick={() => setIndex(partIndex)}>
              <code>{part.token}</code><span>{part.title}</span>
            </button>
          ))}
        </div>
        <motion.div key={item.token} className="primer-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <code>{item.sample}</code>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
        </motion.div>
      </div>
    </section>
  )
}

function LabShell({ eyebrow, title, copy, children, badge }) {
  return (
    <section className="concept-lab" aria-label={title}>
      <div className="concept-lab-head">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
        {badge && <code className="concept-badge">{badge}</code>}
      </div>
      {children}
    </section>
  )
}

function JavaTypeSystemLab() {
  const [numberType, setNumberType] = useState('primitive')
  const [containerType, setContainerType] = useState('array')
  const [arrayItems, setArrayItems] = useState(['Ali', 'Ayşe'])
  const [listItems, setListItems] = useState(['Ali', 'Ayşe'])
  const [message, setMessage] = useState('İki modeli de değiştir; davranış farkını gözle.')

  const tryNull = () => {
    setMessage(numberType === 'primitive'
      ? '`int` null tutamaz → compile-time hata.'
      : '`Integer` bir reference type olduğu için null tutabilir. Unboxing sırasında dikkat: null → NullPointerException riski.')
  }

  const tryGeneric = () => {
    setMessage(numberType === 'primitive'
      ? '`List<int>` geçersiz → generic type parameter primitive kabul etmez. `List<Integer>` kullan.'
      : '`List<Integer>` geçerli → wrapper type generic içinde kullanılabilir.')
  }

  const addName = () => {
    if (containerType === 'array') {
      if (arrayItems.length >= 2) {
        setMessage('String[2] dolu → array length değişmez. Yeni eleman için daha büyük array oluşturup kopyalaman gerekir.')
        return
      }
      setArrayItems((items) => [...items, 'Zeki'])
      return
    }
    setListItems((items) => [...items, `Kişi ${items.length + 1}`])
    setMessage('ArrayList yeni elemanı kabul etti → size dinamik büyüdü. Kapasite yönetimini implementation kendi yapar.')
  }

  const visibleItems = containerType === 'array' ? arrayItems : listItems

  return (
    <LabShell
      eyebrow="JAVA TYPE SYSTEM LAB"
      title="Primitive, wrapper, array ve List aynı davranmaz."
      copy="Tipi değiştir, null ve generic dene; sonra sabit array ile dinamik ArrayList’e eleman ekle."
      badge="int ↔ Integer · [] ↔ ArrayList"
    >
      <div className="java-type-lab">
        <div className="type-lab-panel">
          <div className="type-lab-head"><small>01 · DEĞER TİPİ</small><strong>Primitive mi wrapper mı?</strong></div>
          <div className="type-toggle">
            <button className={numberType === 'primitive' ? 'active' : ''} onClick={() => { setNumberType('primitive'); setMessage('`int` primitive: object değildir, null tutamaz, generic type parameter olamaz.') }}><code>int</code><span>primitive</span></button>
            <button className={numberType === 'wrapper' ? 'active' : ''} onClick={() => { setNumberType('wrapper'); setMessage('`Integer` wrapper: object/reference type’tır; null olabilir ve generic içinde kullanılabilir.') }}><code>Integer</code><span>wrapper</span></button>
          </div>
          <motion.div key={numberType} className="type-memory-card" initial={{ opacity: .35, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <small>{numberType === 'primitive' ? 'VALUE' : 'REFERENCE / OBJECT'}</small>
            <strong>{numberType === 'primitive' ? '42' : 'Integer(42)'}</strong>
            <code>{numberType === 'primitive' ? 'int count = 42;' : 'Integer count = 42; // autoboxing'}</code>
          </motion.div>
          <div className="type-actions"><button onClick={tryNull}>null ata</button><button onClick={tryGeneric}>List&lt;?&gt; içine koy</button></div>
        </div>

        <div className="type-lab-panel">
          <div className="type-lab-head"><small>02 · CONTAINER</small><strong>Sabit mi dinamik mi?</strong></div>
          <div className="type-toggle">
            <button className={containerType === 'array' ? 'active' : ''} onClick={() => { setContainerType('array'); setMessage('Array length oluşturulurken belirlenir: `new String[2]` → length her zaman 2.') }}><code>String[]</code><span>sabit length</span></button>
            <button className={containerType === 'list' ? 'active' : ''} onClick={() => { setContainerType('list'); setMessage('ArrayList bir List implementation’ıdır; size eleman ekledikçe değişebilir.') }}><code>ArrayList&lt;String&gt;</code><span>dinamik size</span></button>
          </div>
          <div className="type-slots">
            <AnimatePresence initial={false}>
              {visibleItems.map((item, index) => <motion.div layout key={`${containerType}-${index}-${item}`} initial={{ opacity: 0, scale: .85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><small>[{index}]</small><strong>{item}</strong></motion.div>)}
            </AnimatePresence>
          </div>
          <div className="type-container-meta"><code>{containerType === 'array' ? `length = ${visibleItems.length}` : `size() = ${visibleItems.length}`}</code><button onClick={addName}>+ eleman ekle</button></div>
        </div>
      </div>
      <motion.div key={message} className="type-lab-message" initial={{ opacity: .3, y: 5 }} animate={{ opacity: 1, y: 0 }}><span>GÖZLEM</span><p>{message}</p></motion.div>
    </LabShell>
  )
}

function ObjectFactoryLab() {
  const samples = [
    { name: 'Klavye', price: 1500 },
    { name: 'Mouse', price: 800 },
    { name: 'Monitor', price: 7200 },
  ]
  const [objects, setObjects] = useState([])
  const next = samples[objects.length % samples.length]

  return (
    <LabShell eyebrow="DERSİN SİMÜLASYONU" title="Class kalıp. Object gerçek örnek." copy="Butona bas. Aynı Product class'ından bellekte ayrı object'ler oluştuğunu gör." badge="new Product()">
      <div className="factory-layout">
        <div className="blueprint-card">
          <span>KALIP / CLASS</span>
          <strong>Product</strong>
          <code>String name</code>
          <code>double price</code>
          <button onClick={() => setObjects((items) => [...items, { ...next, id: items.length + 1 }])}>+ object üret</button>
        </div>
        <div className="memory-board">
          <div className="memory-head"><span>BELLEK / OBJECT'LER</span><b>{objects.length} object</b></div>
          {objects.length === 0 ? (
            <p className="empty-state">Henüz object yok. Class var, gerçek Product örneği yok.</p>
          ) : (
            <div className="object-grid">
              {objects.map((object) => (
                <motion.div key={object.id} className="object-card" initial={{ opacity: 0, scale: .92, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}>
                  <small>Product #{object.id}</small>
                  <strong>{object.name}</strong>
                  <code>price = {object.price}</code>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="lab-takeaway"><b>Gözlem:</b> Tek class, birden fazla bağımsız object üretebilir.</p>
    </LabShell>
  )
}

function ConstructorLab() {
  const [step, setStep] = useState(0)
  const steps = [
    ['1', 'Değer gelir', '"Klavye"', 'new Product("Klavye") çağrısındaki değer constructor’a girer.'],
    ['2', 'Constructor çalışır', 'Product(String name)', 'Constructor parametresi name artık "Klavye" değerini taşır.'],
    ['3', 'Field dolar', 'this.name = name', 'Gelen değer yeni object’in name field’ına yazılır.'],
  ]
  const item = steps[step]

  return (
    <LabShell eyebrow="CONSTRUCTOR LAB" title="Değer object’in içine nasıl giriyor?" copy="Adımları ilerlet. Parantez içindeki değer ile object field’ının aynı şey olmadığını gör." badge={'new Product("Klavye")'}>
      <div className="constructor-flow">
        {steps.map((part, index) => (
          <button key={part[0]} onClick={() => setStep(index)} className={index === step ? 'active' : index < step ? 'done' : ''}>
            <span>{part[0]}</span><strong>{part[1]}</strong><code>{part[2]}</code>
          </button>
        ))}
      </div>
      <motion.div key={step} className="lab-explain" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <strong>{item[1]}</strong><p>{item[3]}</p>
      </motion.div>
      <div className="lab-controls"><button onClick={() => setStep(Math.max(0, step - 1))}>← Önceki</button><span>{step + 1} / 3</span><button onClick={() => setStep(Math.min(2, step + 1))}>Sonraki →</button></div>
    </LabShell>
  )
}

function InterfaceLab() {
  const [implementation, setImplementation] = useState('card')
  const [called, setCalled] = useState(false)
  const active = implementation === 'card'
    ? { name: 'CardPaymentService', result: 'Kart provizyonu çalıştı', code: 'return bank.charge(amount);' }
    : { name: 'FakePaymentService', result: 'Test ödemesi başarılı sayıldı', code: 'return true;' }

  useEffect(() => setCalled(false), [implementation])

  return (
    <LabShell eyebrow="INTERFACE SWITCH LAB" title="Aynı sözleşme, farklı implementation." copy="Checkout sadece PaymentService sözleşmesini biliyor. Alttaki implementation'ı değiştir; çağıran kod aynı kalsın." badge="PaymentService">
      <div className="switch-row">
        <button className={implementation === 'card' ? 'active' : ''} onClick={() => setImplementation('card')}>Gerçek kart servisi</button>
        <button className={implementation === 'fake' ? 'active' : ''} onClick={() => setImplementation('fake')}>Test servisi</button>
      </div>
      <div className="interface-stage">
        <div className="stage-node"><small>ÇAĞIRAN</small><strong>Checkout</strong><code>payment.pay(500)</code></div>
        <div className="stage-link">implements</div>
        <motion.div key={active.name} className="stage-node accent" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}><small>AKTİF IMPLEMENTATION</small><strong>{active.name}</strong><code>{active.code}</code></motion.div>
      </div>
      <button className="lab-action" onClick={() => setCalled(true)}>pay(500) çağır</button>
      <AnimatePresence>{called && <motion.p className="lab-result" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}><b>Sonuç:</b> {active.result}. Checkout kodu değişmedi.</motion.p>}</AnimatePresence>
    </LabShell>
  )
}

function AnnotationLab({ spring = false }) {
  const [mode, setMode] = useState(spring ? 'controller' : 'override')
  const data = mode === 'override'
    ? { tag: '@Override', reader: 'Java compiler', effect: 'Üst tipte böyle bir method var mı kontrol eder.', code: 'public boolean pay(...)' }
    : mode === 'deprecated'
      ? { tag: '@Deprecated', reader: 'Java compiler / IDE', effect: 'Bu API artık önerilmiyor uyarısı üretebilir.', code: 'void oldMethod()' }
      : mode === 'controller'
        ? { tag: '@RestController', reader: 'Spring', effect: 'Class’ı HTTP request karşılayan controller rolünde işler.', code: 'class ProductController' }
        : { tag: '@Service', reader: 'Spring', effect: 'Class’ı business katmanı component’i olarak keşfedebilir.', code: 'class ProductService' }

  return (
    <LabShell eyebrow="ANNOTATION READER LAB" title="@ işareti sihir değil. Bir okuyucu var." copy="Annotation metadata taşır. Etkiyi annotation'ı okuyan compiler veya framework üretir." badge={data.tag}>
      <div className="switch-row">
        {spring ? (
          <><button className={mode === 'controller' ? 'active' : ''} onClick={() => setMode('controller')}>@RestController</button><button className={mode === 'service' ? 'active' : ''} onClick={() => setMode('service')}>@Service</button></>
        ) : (
          <><button className={mode === 'override' ? 'active' : ''} onClick={() => setMode('override')}>@Override</button><button className={mode === 'deprecated' ? 'active' : ''} onClick={() => setMode('deprecated')}>@Deprecated</button></>
        )}
      </div>
      <div className="annotation-pipeline">
        <motion.div key={`${mode}-tag`} className="stage-node accent" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><small>METADATA</small><strong>{data.tag}</strong><code>{data.code}</code></motion.div>
        <span>okur</span>
        <div className="stage-node"><small>OKUYUCU</small><strong>{data.reader}</strong></div>
        <span>sonuç</span>
        <div className="stage-node"><small>ETKİ</small><strong>{data.effect}</strong></div>
      </div>
      <p className="lab-takeaway"><b>Kritik fikir:</b> `@` object oluşturmaz. Annotation’ın anlamı bağlama ve okuyucuya bağlıdır.</p>
    </LabShell>
  )
}

function BeanLab() {
  const [started, setStarted] = useState(false)

  return (
    <LabShell eyebrow="BEAN REGISTRY LAB" title="Her Java object bean değildir." copy="Spring context’i başlat. Spring’in hangi object’leri yönettiğini registry üzerinde gör." badge="ApplicationContext">
      <div className="bean-stage">
        <div className="bean-source">
          <div className="stage-node"><small>DÜZ JAVA</small><strong>new Product()</strong><code>Spring işareti yok</code></div>
          <div className="stage-node accent"><small>COMPONENT</small><strong>@Service OrderService</strong><code>component scan bulabilir</code></div>
          <div className="stage-node accent"><small>CONFIG</small><strong>@Bean Clock</strong><code>config method’u üretir</code></div>
        </div>
        <div className="bean-registry">
          <div className="memory-head"><span>SPRING BEAN REGISTRY</span><b>{started ? '2 bean' : 'boş'}</b></div>
          {!started ? (
            <p className="empty-state">Context henüz başlatılmadı.</p>
          ) : (
            <div className="object-grid">
              <motion.div className="object-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><small>bean</small><strong>orderService</strong></motion.div>
              <motion.div className="object-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }}><small>bean</small><strong>clock</strong></motion.div>
            </div>
          )}
        </div>
      </div>
      <button className="lab-action bean-action" onClick={() => setStarted((value) => !value)}>{started ? 'Context’i sıfırla' : 'Spring context’i başlat'}</button>
      <p className="lab-takeaway"><b>Product neden yok?</b> Düz `new Product()` ile oluşturulan her object otomatik Spring bean olmaz.</p>
    </LabShell>
  )
}

function HttpLab() {
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/products')
  const [sent, setSent] = useState(false)
  const status = path !== '/products' ? '404 Not Found' : method === 'POST' ? '201 Created' : '200 OK'

  useEffect(() => setSent(false), [method, path])

  return (
    <LabShell eyebrow="HTTP BUILDER LAB" title="Request kur, response'u gör." copy="Method ve path ayrı bilgi taşır. Aynı path, farklı method ile farklı davranış olabilir." badge={`${method} ${path}`}>
      <div className="http-builder">
        <div className="switch-row"><button className={method === 'GET' ? 'active' : ''} onClick={() => setMethod('GET')}>GET</button><button className={method === 'POST' ? 'active' : ''} onClick={() => setMethod('POST')}>POST</button></div>
        <div className="switch-row"><button className={path === '/products' ? 'active' : ''} onClick={() => setPath('/products')}>/products</button><button className={path === '/unknown' ? 'active' : ''} onClick={() => setPath('/unknown')}>/unknown</button></div>
        <button className="lab-action" onClick={() => setSent(true)}>Request gönder</button>
      </div>
      <AnimatePresence mode="wait">{sent && <motion.div key={`${method}-${path}`} className="http-result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><code>{method} {path} HTTP/1.1</code><strong>{status}</strong><small>{status.startsWith('2') ? 'Server isteği işledi ve response üretti.' : 'Bu path için resource/endpoint bulunamadı.'}</small></motion.div>}</AnimatePresence>
    </LabShell>
  )
}

function DiLab() {
  const [wired, setWired] = useState(false)
  return (
    <LabShell eyebrow="DI WIRING LAB" title="OrderService dependency'sini kendi üretmesin." copy="Container PaymentClient object'ini oluşturup constructor üzerinden OrderService'e verir." badge="constructor injection">
      <div className="di-stage">
        <div className="stage-node"><small>CONTAINER</small><strong>Spring</strong><code>PaymentClient bean</code></div>
        <motion.div className={`wire ${wired ? 'live' : ''}`} animate={{ scaleX: wired ? 1 : .2 }} />
        <div className={`stage-node ${wired ? 'accent' : ''}`}><small>CONSUMER</small><strong>OrderService</strong><code>OrderService(PaymentClient p)</code></div>
      </div>
      <button className="lab-action" onClick={() => setWired((value) => !value)}>{wired ? 'Bağlantıyı sıfırla' : 'Dependency inject et'}</button>
      <p className="lab-takeaway"><b>{wired ? 'Hazır:' : 'Bekliyor:'}</b> {wired ? 'OrderService artık PaymentClient dependency’sine sahip.' : 'Constructor dependency istiyor; object eksik dependency ile kurulamaz.'}</p>
    </LabShell>
  )
}

function DtoValidationLab({ validation = false }) {
  const [email, setEmail] = useState('yanlis-email')
  const [checked, setChecked] = useState(false)
  const valid = email.includes('@') && email.includes('.')

  useEffect(() => setChecked(false), [email, validation])

  if (!validation) {
    return (
      <LabShell eyebrow="DTO MAPPING LAB" title="İç modelin tamamını dışarı verme." copy="Entity'deki alanları DTO'ya map ederken API'de görünmesini istemediğin alanları dışarıda bırak." badge="Product → ProductDto">
        <div className="dto-stage">
          <div className="data-shape danger-shape"><small>ENTITY / İÇ MODEL</small><code>id: 42</code><code>name: "Klavye"</code><code>price: 1500</code><code>internalCost: 900</code></div>
          <span>map</span>
          <div className="data-shape safe-shape"><small>RESPONSE DTO</small><code>id: 42</code><code>name: "Klavye"</code><code>price: 1500</code><del>internalCost</del></div>
        </div>
        <p className="lab-takeaway"><b>Sonuç:</b> DTO dış sözleşmeyi kontrollü tutar.</p>
      </LabShell>
    )
  }

  return (
    <LabShell eyebrow="VALIDATION GATE" title="Geçersiz veri Service'e kadar yürümesin." copy="Email'i değiştir, validation çalıştır. Şekil kuralı HTTP sınırında yakalanır." badge="@Valid + @Email">
      <div className="validation-form"><label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className="lab-action" onClick={() => setChecked(true)}>@Valid çalıştır</button></div>
      <AnimatePresence mode="wait">{checked && <motion.div key={`${email}-${valid}`} className={`validation-path ${valid ? 'valid' : 'invalid'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><strong>{valid ? '200 yolu açık' : '400 Bad Request'}</strong><span>{valid ? 'DTO constraint geçti. Service çağrılabilir.' : '@Email constraint başarısız. Service çağrılmadı.'}</span></motion.div>}</AnimatePresence>
      <p className="lab-takeaway"><b>Business rule ayrı:</b> “Bu email zaten kayıtlı mı?” kontrolü format validation değildir.</p>
    </LabShell>
  )
}

function TransactionLab() {
  const [fail, setFail] = useState(true)
  const [run, setRun] = useState(false)
  useEffect(() => setRun(false), [fail])
  return (
    <LabShell eyebrow="TRANSACTION LAB" title="İki DB adımı tek iş gibi davransın." copy="Credit adımını bilerek boz. Transaction varsa debit de geri alınır." badge="@Transactional">
      <div className="switch-row"><button className={!fail ? 'active' : ''} onClick={() => setFail(false)}>İki adım da başarılı</button><button className={fail ? 'active' : ''} onClick={() => setFail(true)}>Credit hata versin</button></div>
      <div className="transaction-steps"><div className={run ? 'done' : ''}><span>01</span><strong>debit(from, 500)</strong></div><div className={run && !fail ? 'done' : run ? 'failed' : ''}><span>02</span><strong>credit(to, 500)</strong></div><div className={run ? (fail ? 'rollback' : 'done') : ''}><span>03</span><strong>{run && fail ? 'ROLLBACK' : 'COMMIT'}</strong></div></div>
      <button className="lab-action" onClick={() => setRun(true)}>Transferi çalıştır</button>
      {run && <p className="lab-takeaway"><b>{fail ? 'Rollback:' : 'Commit:'}</b> {fail ? 'İkinci adım başarısız; ilk DB değişikliği de geri alındı.' : 'İki değişiklik birlikte kalıcı oldu.'}</p>}
    </LabShell>
  )
}

function AopProxyLab() {
  const [route, setRoute] = useState('external')
  const [run, setRun] = useState(false)
  const intercepted = route === 'external'

  useEffect(() => setRun(false), [route])

  return (
    <LabShell eyebrow="PROXY INTERCEPTION LAB" title="@Transactional nerede gerçekten devreye giriyor?" copy="Aynı saveOrder() method’unu iki farklı yoldan çağır. Çağrı Spring proxy’den geçerse transaction advice araya girebilir." badge="proxy + advice">
      <div className="switch-row">
        <button className={route === 'external' ? 'active' : ''} onClick={() => setRoute('external')}>Başka bean çağırıyor</button>
        <button className={route === 'self' ? 'active' : ''} onClick={() => setRoute('self')}>this.saveOrder()</button>
      </div>
      <div className={`proxy-lab-stage ${intercepted ? 'intercepted' : 'bypassed'}`}>
        <div className="stage-node"><small>ÇAĞIRAN</small><strong>{intercepted ? 'OrderController' : 'OrderService.process()'}</strong><code>{intercepted ? 'orderService.saveOrder()' : 'this.saveOrder()'}</code></div>
        <motion.div className="proxy-gate" animate={{ opacity: intercepted ? 1 : .28, scale: intercepted ? 1 : .96 }}><small>SPRING PROXY</small><strong>{intercepted ? 'INTERCEPT' : 'BYPASS'}</strong><code>transaction advice</code></motion.div>
        <div className="stage-node accent"><small>HEDEF METHOD</small><strong>saveOrder()</strong><code>@Transactional</code></div>
      </div>
      <button className="lab-action" onClick={() => setRun(true)}>Çağrıyı çalıştır</button>
      <AnimatePresence mode="wait">{run && <motion.div key={route} className={`proxy-result ${intercepted ? 'good' : 'warn'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><strong>{intercepted ? 'Transaction advice çalışabilir' : 'Self-invocation proxy’yi atladı'}</strong><span>{intercepted ? 'Dış çağrı proxy üzerinden geçti; interceptor transaction sınırını açabilir.' : 'Annotation method üzerinde duruyor ama çağrı proxy’den geçmedi. Proxy tabanlı advice beklediğin gibi tetiklenmeyebilir.'}</span></motion.div>}</AnimatePresence>
    </LabShell>
  )
}

function JpaPersistenceLab() {
  const stages = [
    { label: 'TRANSIENT', object: 'new Product("Klavye")', context: 'context dışında', sql: 'SQL yok', detail: 'Object Java belleğinde var; persistence context henüz takip etmiyor.' },
    { label: 'MANAGED', object: 'entityManager.persist(product)', context: 'Product takip ediliyor', sql: 'INSERT planlanır', detail: 'Entity managed oldu. Persistence context lifecycle ve değişiklikleri takip edebilir.' },
    { label: 'DIRTY', object: 'product.setPrice(1600)', context: 'değişiklik algılandı', sql: 'UPDATE hazırlanabilir', detail: 'Managed entity değişti. Dirty checking sayesinde ayrıca update() çağrısı gerekmeyebilir.' },
    { label: 'FLUSH', object: 'flush / transaction commit', context: 'state DB ile senkronlanır', sql: 'INSERT / UPDATE çalışır', detail: 'Persistence context değişiklikleri SQL olarak DB’ye yansıtır; commit transaction kalıcılığını tamamlar.' },
  ]
  const [step, setStep] = useState(0)
  const current = stages[step]

  return (
    <LabShell eyebrow="PERSISTENCE CONTEXT LAB" title="Entity sadece tablo satırı değil; lifecycle var." copy="Product object’ini transient durumdan managed ve flush aşamasına taşı. JPA’nın object değişimini nasıl izlediğini gör." badge="JPA / Hibernate">
      <div className="jpa-steps">
        {stages.map((item, index) => <button key={item.label} className={index === step ? 'active' : index < step ? 'done' : ''} onClick={() => setStep(index)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.label}</strong></button>)}
      </div>
      <div className="jpa-lab-stage">
        <motion.div key={`${step}-object`} className="jpa-object" initial={{ opacity: .5, y: -8 }} animate={{ opacity: 1, y: 0 }}><small>JAVA OBJECT</small><code>{current.object}</code></motion.div>
        <motion.div key={`${step}-context`} className="jpa-context" initial={{ opacity: .5, scale: .97 }} animate={{ opacity: 1, scale: 1 }}><small>PERSISTENCE CONTEXT</small><strong>{current.context}</strong></motion.div>
        <motion.div key={`${step}-sql`} className="jpa-sql" initial={{ opacity: .35, x: 12 }} animate={{ opacity: 1, x: 0 }}><small>SQL</small><code>{current.sql}</code></motion.div>
      </div>
      <p className="lab-takeaway"><b>{current.label}:</b> {current.detail}</p>
    </LabShell>
  )
}

function NPlusOneLab() {
  const [mode, setMode] = useState('lazy')
  const rows = ['Order #41', 'Order #42', 'Order #43', 'Order #44']
  const queryCount = mode === 'lazy' ? rows.length + 1 : 1

  return (
    <LabShell eyebrow="QUERY COUNTER LAB" title="N+1’i sayı olarak gör." copy="Aynı dört Order kaydını iki farklı fetch yaklaşımıyla oku. Endpoint aynı; üretilen SQL sayısı dramatik biçimde değişebilir." badge={`${queryCount} SQL`}>
      <div className="switch-row"><button className={mode === 'lazy' ? 'active' : ''} onClick={() => setMode('lazy')}>Naive lazy erişim</button><button className={mode === 'fetch' ? 'active' : ''} onClick={() => setMode('fetch')}>Fetch join / projection</button></div>
      <div className="nplus-stage">
        <div className="nplus-orders"><small>SONUÇLAR</small>{rows.map((row) => <span key={row}>{row}</span>)}</div>
        <div className="nplus-queries"><small>SQL TRACE</small><motion.code key={`${mode}-root`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>SELECT * FROM orders LIMIT 4;</motion.code>{mode === 'lazy' ? rows.map((row, index) => <motion.code key={`${mode}-${row}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .06 }}>SELECT * FROM customer WHERE id = ?;</motion.code>) : <motion.code key="fetch" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>JOIN customer in root query / projection</motion.code>}</div>
        <motion.div key={mode} className={`query-meter ${mode === 'lazy' ? 'hot' : ''}`} initial={{ scale: .94 }} animate={{ scale: 1 }}><small>QUERY COUNT</small><strong>{queryCount}</strong><span>{mode === 'lazy' ? '1 + N' : 'kontrollü'}</span></motion.div>
      </div>
      <p className="lab-takeaway"><b>Gözlem:</b> Pagination kayıt sayısını sınırlar; N+1 ayrı problemdir. İlişki erişimi her satır için ek query üretiyorsa query planını düzeltmek gerekir.</p>
    </LabShell>
  )
}

function SagaConsistencyLab() {
  const [scenario, setScenario] = useState('failure')
  const [idempotent, setIdempotent] = useState(true)
  const steps = scenario === 'success'
    ? [['Order', 'CREATED', 'done'], ['Payment', 'CHARGED', 'done'], ['Inventory', 'RESERVED', 'done'], ['Order', 'CONFIRMED', 'done']]
    : scenario === 'duplicate'
      ? [['Broker', 'PaymentRequested x2', 'warn'], ['Payment', idempotent ? '2. mesaj IGNORE' : 'CHARGED x2', idempotent ? 'done' : 'danger'], ['Order', idempotent ? 'tek sonuç' : 'yan etki!', idempotent ? 'done' : 'danger']]
      : [['Order', 'CREATED', 'done'], ['Payment', 'CHARGED', 'done'], ['Inventory', 'FAILED', 'danger'], ['Compensation', 'REFUND + CANCEL', 'warn']]

  return (
    <LabShell eyebrow="DISTRIBUTED CONSISTENCY LAB" title="Tek rollback yok. Workflow’u toparla." copy="Başarı, downstream hata ve duplicate message senaryolarını değiştir. Saga compensation ile idempotency’nin farklı problemleri çözdüğünü gör." badge="Saga / idempotency">
      <div className="saga-toolbar"><div className="switch-row"><button className={scenario === 'success' ? 'active' : ''} onClick={() => setScenario('success')}>Başarılı akış</button><button className={scenario === 'failure' ? 'active' : ''} onClick={() => setScenario('failure')}>Inventory fail</button><button className={scenario === 'duplicate' ? 'active' : ''} onClick={() => setScenario('duplicate')}>Duplicate event</button></div>{scenario === 'duplicate' && <button className={`idempotency-switch ${idempotent ? 'active' : ''}`} onClick={() => setIdempotent((value) => !value)}>Idempotency {idempotent ? 'AÇIK' : 'KAPALI'}</button>}</div>
      <div className="saga-stage">{steps.map(([service, state, tone], index) => <motion.div key={`${scenario}-${service}-${index}-${idempotent}`} className={`saga-step ${tone}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }}><span>{String(index + 1).padStart(2, '0')}</span><small>{service}</small><strong>{state}</strong></motion.div>)}</div>
      <p className="lab-takeaway"><b>Sonuç:</b> {scenario === 'failure' ? 'Saga DB rollback yapmaz; daha önce tamamlanan business adımlarını compensation ile telafi eder.' : scenario === 'duplicate' ? (idempotent ? 'Aynı mesaj tekrar gelse de ikinci charge yan etkisi üretilmedi.' : 'Duplicate delivery ikinci charge üretti. Consumer idempotent değilse broker retry tehlikeli olabilir.') : 'Her servis kendi local transaction’ını tamamladı; workflow beklenen son duruma geldi.'}</p>
    </LabShell>
  )
}

function DddServicesLab() {
  const [focus, setFocus] = useState('application')
  const details = {
    application: ['TransferApplicationService', 'Use-case sırasını, repository ve dış dependency koordinasyonunu yönetir.', 'orchestrate()'],
    domain: ['TransferDomainService', 'Tek bir entity’ye doğal oturmayan gerçek domain kuralını taşır.', 'canTransfer(from, to, amount)'],
    acl: ['Anti-Corruption Layer', 'Legacy Payment API modelini kendi Payment Context diline çevirir.', 'legacyDto -> PaymentCommand'],
  }
  const current = details[focus]

  return (
    <LabShell eyebrow="RESPONSIBILITY MAP" title="Her Service class aynı katmanda değil." copy="Sorumluluğu seç. Orchestration, domain rule ve dış model çevirisini birbirinden ayır." badge="DDD">
      <div className="ddd-service-map">
        <button className={focus === 'application' ? 'active' : ''} onClick={() => setFocus('application')}><small>APPLICATION</small><strong>Use-case orchestration</strong></button>
        <button className={focus === 'domain' ? 'active' : ''} onClick={() => setFocus('domain')}><small>DOMAIN</small><strong>Business rule</strong></button>
        <button className={focus === 'acl' ? 'active' : ''} onClick={() => setFocus('acl')}><small>BOUNDARY</small><strong>Legacy translation</strong></button>
      </div>
      <motion.div key={focus} className="ddd-service-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><small>{focus.toUpperCase()}</small><strong>{current[0]}</strong><p>{current[1]}</p><code>{current[2]}</code></motion.div>
    </LabShell>
  )
}

function KubernetesLab() {
  const [pods, setPods] = useState([true, true, true])
  const ready = pods.filter(Boolean).length
  const killPod = () => setPods((items) => {
    const next = [...items]
    const index = next.findIndex(Boolean)
    if (index >= 0) next[index] = false
    return next
  })
  const reconcile = () => setPods([true, true, true])

  return (
    <LabShell eyebrow="KUBERNETES CONTROL LOOP" title="Desired state 3 replica. Bir Pod’u öldür." copy="Deployment desired state’i korumaya çalışır. Service yalnız hazır Pod’lara trafik vermelidir. Fail et, sonra controller reconcile etsin." badge={`ready ${ready}/3`}>
      <div className="kube-toolbar"><button className="lab-action" onClick={killPod} disabled={ready === 0}>Bir Pod’u düşür</button><button onClick={reconcile}>Controller reconcile</button></div>
      <div className="kube-stage">
        <div className="kube-deployment"><small>DEPLOYMENT</small><strong>replicas: 3</strong><span>desired state</span></div>
        <div className="kube-pods">{pods.map((up, index) => <motion.div key={`pod-${index}`} className={up ? 'ready' : 'down'} animate={{ opacity: up ? 1 : .3, scale: up ? 1 : .92 }}><small>POD {index + 1}</small><strong>{up ? 'READY' : 'DOWN'}</strong></motion.div>)}</div>
        <div className={`kube-service ${ready ? 'live' : 'down'}`}><small>SERVICE</small><strong>order-service</strong><span>{ready ? `${ready} ready endpoint` : 'endpoint yok'}</span></div>
      </div>
      <p className="lab-takeaway"><b>Gözlem:</b> Pod geçici olabilir. Deployment replica sayısını yönetir; Service stable erişim sağlar; readiness trafiğe uygunluğu belirler.</p>
    </LabShell>
  )
}

function RaceConditionLab() {
  const [mode, setMode] = useState('race')
  const [step, setStep] = useState(0)
  const reduced = useReducedMotion()
  const race = mode === 'race'
  const steps = race
    ? [
      ['T1', 'READ stock = 1', 'T1 eski değeri okudu.'],
      ['T2', 'READ stock = 1', 'T2 de aynı eski değeri okudu.'],
      ['T1', 'WRITE stock = 0', 'T1 satışı tamamladı.'],
      ['T2', 'WRITE stock = 0', 'T2 de satış yaptı; iki satış, tek stok.'],
    ]
    : [
      ['T1', 'LOCK + READ 1', 'T1 kritik bölgeyi kilitledi.'],
      ['T1', 'WRITE 0 + UNLOCK', 'T1 tamamladı ve kilidi bıraktı.'],
      ['T2', 'LOCK + READ 0', 'T2 güncel değeri gördü.'],
      ['T2', 'REJECT: out of stock', 'İkinci satış yapılmadı.'],
    ]
  const visible = steps.slice(0, step + 1)

  useEffect(() => setStep(0), [mode])

  return (
    <LabShell eyebrow="THREAD INTERLEAVING LAB" title="Stok 1. İki request aynı anda gelsin." copy="Adımları ilerlet. Tek satır gibi görünen read-modify-write işleminin thread’ler arasında nasıl bölünebildiğini gör." badge={race ? 'RACE CONDITION' : 'SERIALIZED'}>
      <div className="switch-row">
        <button className={race ? 'active' : ''} onClick={() => setMode('race')}>Koordinasyonsuz</button>
        <button className={!race ? 'active' : ''} onClick={() => setMode('locked')}>Kritik bölge kilitli</button>
      </div>
      <div className="race-stage">
        <div className="race-stock"><small>SHARED STATE</small><strong>stock = {race && step < 2 ? '1' : step === 0 && !race ? '1' : '0'}</strong><span>{race ? 'mutable' : 'protected section'}</span></div>
        <div className="race-timeline">
          {visible.map(([thread, action, detail], index) => (
            <motion.div key={`${mode}-${index}`} className={`race-event ${thread.toLowerCase()} ${race && index === 3 ? 'danger' : ''}`} initial={reduced ? false : { opacity: 0, x: thread === 'T1' ? -16 : 16 }} animate={{ opacity: 1, x: 0 }}>
              <span>{thread}</span><code>{action}</code><small>{detail}</small>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="race-controls"><button disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>← Geri</button><b>{step + 1}/{steps.length}</b><button disabled={step === steps.length - 1} onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}>Sonraki →</button></div>
      <p className="lab-takeaway"><b>Sonuç:</b> {race && step === steps.length - 1 ? 'Race oluştu: iki request de stock=1 varsayımıyla ilerledi ve oversell yaptı.' : !race && step === steps.length - 1 ? 'İkinci thread güncel stock=0 değerini gördü; aynı stok iki kez satılmadı.' : 'Adımları ilerlet; kritik fark interleaving sonunda görünür.'}</p>
    </LabShell>
  )
}

function HashMapBucketLab() {
  const [scenario, setScenario] = useState('match')
  const reduced = useReducedMotion()
  const data = {
    match: { hash: 42, bucket: 2, query: 'UserKey(42)', stored: 'UserKey(42)', equal: true, result: 'FOUND → Zeki', note: 'Aynı hash bucket’ı seçti; equals aynı mantıksal key’i doğruladı.' },
    collision: { hash: 18, bucket: 2, query: 'UserKey(18)', stored: 'UserKey(42)', equal: false, result: 'COLLISION → başka entry ara', note: 'Aynı bucket eşitlik anlamına gelmez. equals false olduğu için diğer entry kontrol edilir.' },
    mutated: { hash: 99, bucket: 3, query: 'MutableKey(42→99)', stored: 'bucket 2’de eski key', equal: false, result: 'MISS', note: 'Key map’e girdikten sonra hash’e katılan state değişti; lookup başka bucket’a gidiyor.' },
  }[scenario]

  return (
    <LabShell eyebrow="HASHMAP LOOKUP LAB" title="HashMap key’i nasıl buluyor?" copy="Senaryoyu değiştir. hashCode bucket’ı daraltsın, equals doğru entry’yi seçsin; mutable key’in neden riskli olduğunu gör." badge="hashCode → bucket → equals">
      <div className="pattern-scenario-tabs">
        <button className={scenario === 'match' ? 'active' : ''} onClick={() => setScenario('match')}>Aynı key</button>
        <button className={scenario === 'collision' ? 'active' : ''} onClick={() => setScenario('collision')}>Collision</button>
        <button className={scenario === 'mutated' ? 'active' : ''} onClick={() => setScenario('mutated')}>Mutable key</button>
      </div>
      <motion.div key={scenario} className="hash-stage" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="hash-query"><small>LOOKUP</small><code>{data.query}</code><strong>hashCode = {data.hash}</strong></div>
        <div className="hash-arrow">→</div>
        <div className="hash-buckets">
          {[0, 1, 2, 3].map((bucket) => <div key={bucket} className={bucket === data.bucket ? 'active' : bucket === 2 ? 'stored' : ''}><small>BUCKET</small><strong>{bucket}</strong>{bucket === 2 && <code>{data.stored}</code>}</div>)}
        </div>
        <div className="hash-arrow">→</div>
        <div className={`hash-result ${scenario === 'mutated' ? 'danger' : ''}`}><small>EQUALS / RESULT</small><strong>{scenario === 'match' ? 'equals = true' : 'equals ≠ match'}</strong><code>{data.result}</code></div>
      </motion.div>
      <p className="lab-takeaway"><b>Gözlem:</b> {data.note}</p>
    </LabShell>
  )
}

function SqlJoinLab() {
  const [join, setJoin] = useState('left')
  const reduced = useReducedMotion()
  const orders = [['41', 'PAID'], ['42', 'PENDING'], ['43', 'PENDING']]
  const payments = [['41', 'OK'], ['43', 'FAILED']]
  const rows = join === 'inner'
    ? [['41', 'PAID', 'OK'], ['43', 'PENDING', 'FAILED']]
    : [['41', 'PAID', 'OK'], ['42', 'PENDING', 'NULL'], ['43', 'PENDING', 'FAILED']]

  return (
    <LabShell eyebrow="SQL JOIN LAB" title="Order #42’nin payment kaydı yok." copy="INNER ve LEFT arasında geçiş yap. Hangi Order satırının sonuçtan kaybolduğunu tablo üzerinde gör." badge={join === 'left' ? 'LEFT JOIN' : 'INNER JOIN'}>
      <div className="switch-row"><button className={join === 'inner' ? 'active' : ''} onClick={() => setJoin('inner')}>INNER JOIN</button><button className={join === 'left' ? 'active' : ''} onClick={() => setJoin('left')}>LEFT JOIN</button></div>
      <div className="join-stage">
        <div className="join-source"><small>ORDERS</small>{orders.map(([id, state]) => <div key={id}><code>#{id}</code><span>{state}</span></div>)}</div>
        <div className="join-operator"><code>{join === 'left' ? 'LEFT JOIN' : 'INNER JOIN'}</code><small>ON payment.order_id = order.id</small></div>
        <div className="join-source"><small>PAYMENT</small>{payments.map(([id, state]) => <div key={id}><code>order #{id}</code><span>{state}</span></div>)}</div>
      </div>
      <motion.div key={join} className="join-result" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <small>RESULT SET · {rows.length} ROW</small>
        <div className="join-result-head"><span>order_id</span><span>order_status</span><span>payment_status</span></div>
        {rows.map(([id, orderState, paymentState]) => <div key={`${join}-${id}`} className={paymentState === 'NULL' ? 'null-row' : ''}><code>{id}</code><span>{orderState}</span><strong>{paymentState}</strong></div>)}
      </motion.div>
      <p className="lab-takeaway"><b>Sonuç:</b> {join === 'left' ? 'Order #42 korunur; eşleşen Payment olmadığı için sağ kolon NULL gelir.' : 'Order #42 eşleşme bulamadığı için sonuçtan çıkar.'}</p>
    </LabShell>
  )
}

function SdlcJourneyLab() {
  const stages = [
    ['REQUIREMENT', 'Ne yapılacak?', 'Acceptance criteria + edge case', 'BA/PO ile belirsizliği test edilebilir hale getir.'],
    ['DESIGN', 'Nasıl yapılacak?', 'API / data / trade-off', 'Constraint ve failure senaryolarına göre tasarım kararı ver.'],
    ['IMPLEMENT', 'Kodla', 'Small change + reviewable diff', 'Standartlara uygun kod yaz; değişikliği izlenebilir tut.'],
    ['TEST', 'Kanıtla', 'Unit + integration + negative case', 'Happy path dışında boundary ve failure davranışını doğrula.'],
    ['DEPLOY', 'Güvenli yayınla', 'Artifact + gate + rollback', 'Aynı doğrulanmış çıktıyı kontrollü biçimde ortama taşı.'],
    ['MAINTAIN', 'Gözle ve öğren', 'Logs + metrics + feedback', 'Incident, support ve kullanıcı geri bildirimi yeni requirement üretir.'],
  ]
  const [step, setStep] = useState(0)
  const current = stages[step]

  return (
    <LabShell eyebrow="SDLC FEEDBACK LOOP" title="Deployment son değil; feedback yeni requirement üretir." copy="Yaşam döngüsünü soldan sağa gez. Her aşamada hangi çıktının bir sonraki kararı beslediğini gör." badge={(step + 1) + '/' + stages.length}>
      <div className="sdlc-journey">
        {stages.map((item, index) => (
          <button key={item[0]} className={index === step ? 'active' : index < step ? 'visited' : ''} onClick={() => setStep(index)}>
            <span>{String(index + 1).padStart(2, '0')}</span><strong>{item[0]}</strong><small>{item[1]}</small>
          </button>
        ))}
      </div>
      <motion.div key={current[0]} className="sdlc-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div><small>ÇIKTI / KANIT</small><strong>{current[2]}</strong></div>
        <p>{current[3]}</p>
        <code>{step === stages.length - 1 ? 'feedback -> REQUIREMENT' : current[0] + ' -> ' + stages[(step + 1) % stages.length][0]}</code>
      </motion.div>
    </LabShell>
  )
}

function ProcessScenarioLab({ lesson }) {
  const scenarios = processScenarios[lesson.id] ?? architectureScenarios[lesson.id]
  const [activeIndex, setActiveIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const scenario = scenarios[activeIndex]
  const selected = answers[activeIndex]
  const correct = selected === scenario.answer
  const solvedCount = scenarios.filter((item, index) => answers[index] === item.answer).length
  const allSolved = solvedCount === scenarios.length

  const choose = (optionIndex) => {
    if (!correct) setAnswers((current) => ({ ...current, [activeIndex]: optionIndex }))
  }

  const reset = () => {
    setActiveIndex(0)
    setAnswers({})
  }

  return (
    <LabShell
      eyebrow="KARAR SENARYOSU"
      title={`${lesson.title}: kararı sen ver.`}
      copy="Gerçek ekip durumunu oku, en doğru adımı seç. Yanlış cevapta gerekçeyi gör ve tekrar dene."
      badge={`${solvedCount}/${scenarios.length} çözüldü`}
    >
      <div className="process-scenario">
        <div className="process-scenario-progress" aria-label={`Senaryo ${activeIndex + 1}/${scenarios.length}; ${solvedCount} tamamlandı`}>
          {scenarios.map((item, index) => (
            <span
              key={item.prompt}
              className={`${index === activeIndex ? 'current' : ''} ${answers[index] === item.answer ? 'solved' : ''}`.trim()}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="process-scenario-context">
          <small>SENARYO {activeIndex + 1} / {scenarios.length}</small>
          <p>{scenario.evidence}</p>
          <h3>{scenario.prompt}</h3>
        </div>
        <div className="process-scenario-options" role="group" aria-label="Karar seçenekleri">
          {scenario.options.map((option, index) => (
            <button
              type="button"
              key={option}
              onClick={() => choose(index)}
              disabled={correct}
              aria-pressed={selected === index}
              className={selected === index ? (correct ? 'correct' : 'incorrect') : ''}
            >
              <span>{String.fromCharCode(65 + index)}</span>
              {option}
            </button>
          ))}
        </div>
        <div className={`process-scenario-feedback ${correct ? 'correct' : selected === undefined ? '' : 'incorrect'}`} aria-live="polite" aria-atomic="true">
          {selected === undefined ? (
            <p>Bir karar seç. Her seçimin arkasındaki mantığı öğreneceksin.</p>
          ) : (
            <><strong>{correct ? 'Doğru karar' : 'Bu karar eksik veya riskli'}</strong><p>{scenario.feedback[selected]}</p></>
          )}
          {correct && <p className="process-scenario-takeaway"><b>Mülakatta söyle:</b> {scenario.takeaway}</p>}
        </div>
        <div className="process-scenario-actions">
          <button type="button" onClick={() => setActiveIndex((index) => index - 1)} disabled={activeIndex === 0}>Önceki senaryo</button>
          {activeIndex < scenarios.length - 1 ? (
            <button type="button" onClick={() => setActiveIndex((index) => index + 1)} disabled={!correct}>Sonraki senaryo</button>
          ) : (
            <button type="button" onClick={reset}>{allSolved ? 'Senaryoları tekrar çöz' : 'Baştan başla'}</button>
          )}
        </div>
        {allSolved && <p className="process-scenario-complete" role="status">Tüm kararlar doğru. Mülakat sorularına geçmeden önce gerekçeleri kendi cümlelerinle tekrar et.</p>}
      </div>
    </LabShell>
  )
}

function TestPlanLab() {
  const cases = [
    { title: 'Happy path', given: 'stok var + payment OK', when: 'POST /orders', then: '201 + order CONFIRMED', level: 'integration', risk: 'core flow' },
    { title: 'Boundary', given: 'amount = 0', when: 'POST /orders', then: '400 validation error', level: 'web slice', risk: 'input rule' },
    { title: 'Dependency failure', given: 'Payment timeout', when: 'checkout', then: 'bounded failure / fallback', level: 'service + integration', risk: 'resilience' },
    { title: 'Duplicate request', given: 'aynı idempotency key', when: 'POST x2', then: 'tek business side effect', level: 'integration', risk: 'regression' },
  ]
  const [selected, setSelected] = useState(0)
  const current = cases[selected]

  return (
    <LabShell eyebrow="TEST PLAN BUILDER" title="Test plan = riskleri davranış olarak kanıtla." copy="Senaryoyu değiştir. Her testin Given / When / Then, test seviyesi ve hedeflediği risk farklı." badge="scenario / plan">
      <div className="test-plan-grid">
        <div className="test-case-list">
          {cases.map((item, index) => <button key={item.title} className={selected === index ? 'active' : ''} onClick={() => setSelected(index)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong><small>{item.risk}</small></button>)}
        </div>
        <motion.div key={current.title} className="gherkin-card" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
          <small>TEST SCENARIO</small>
          <p><b>GIVEN</b> {current.given}</p>
          <p><b>WHEN</b> {current.when}</p>
          <p><b>THEN</b> {current.then}</p>
          <div><span>LEVEL</span><code>{current.level}</code></div>
        </motion.div>
      </div>
      <p className="lab-takeaway"><b>Plan mantığı:</b> “Test yazdım” yetmez. Requirement’ın happy path, boundary, dependency failure ve duplicate/regression risklerini kapsayan kanıt seti gerekir.</p>
    </LabShell>
  )
}

function CiCdBasicsLab({ mode }) {
  const [testPass, setTestPass] = useState(true)
  const [releaseMode, setReleaseMode] = useState('delivery')
  const stages = ['COMMIT', 'BUILD', 'TEST', 'PACKAGE', 'RELEASE']

  if (mode === 'cd') {
    const deployment = releaseMode === 'deployment'
    return (
      <LabShell eyebrow="CD RELEASE GATE" title="Delivery ile Deployment farkı production gate’inde." copy="Aynı doğrulanmış artifact production’a hazır. Production geçişinin manuel onay mı otomatik mi olduğunu değiştir." badge={deployment ? 'DEPLOYMENT' : 'DELIVERY'}>
        <div className="switch-row"><button className={!deployment ? 'active' : ''} onClick={() => setReleaseMode('delivery')}>Continuous Delivery</button><button className={deployment ? 'active' : ''} onClick={() => setReleaseMode('deployment')}>Continuous Deployment</button></div>
        <div className="release-gate-stage">
          <div><small>VERIFIED ARTIFACT</small><strong>order:1.4.2</strong></div><i>›</i>
          <motion.div key={releaseMode} className={deployment ? 'auto' : 'manual'} initial={{ scale: .95 }} animate={{ scale: 1 }}><small>PRODUCTION GATE</small><strong>{deployment ? 'AUTO POLICY' : 'MANUAL APPROVAL'}</strong></motion.div><i>›</i>
          <div><small>PRODUCTION</small><strong>release 1.4.2</strong></div>
        </div>
        <p className="lab-takeaway"><b>Fark:</b> Delivery production’a deploy edilebilir durumda tutar ve manuel onay bırakabilir. Deployment gerekli kontroller geçince production yayınını otomatikleştirebilir.</p>
      </LabShell>
    )
  }

  return (
    <LabShell eyebrow="CI FAILURE GATE" title="Test kırmızıysa artifact release’e ilerlemesin." copy="Test sonucunu değiştir. CI’nin amacı yalnız build almak değil, main branch’i sürekli doğrulanabilir durumda tutmak." badge={testPass ? 'GREEN' : 'FAILED'}>
      <div className="switch-row"><button className={testPass ? 'active' : ''} onClick={() => setTestPass(true)}>Tests pass</button><button className={!testPass ? 'active' : ''} onClick={() => setTestPass(false)}>Test fail</button></div>
      <div className="ci-gate-stage">{stages.map((stage, index) => {
        const blocked = !testPass && index > 2
        const failed = !testPass && stage === 'TEST'
        return <motion.div key={stage + '-' + testPass} className={blocked ? 'blocked' : failed ? 'failed' : 'passed'} animate={{ opacity: blocked ? .28 : 1, y: failed ? -2 : 0 }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{stage}</strong><small>{failed ? 'FAIL' : blocked ? 'BLOCKED' : 'OK'}</small></motion.div>
      })}</div>
      <p className="lab-takeaway"><b>{testPass ? 'Green pipeline:' : 'Quality gate:'}</b> {testPass ? 'Doğrulanmış artifact üretilebilir; release policy sonraki adımı belirler.' : 'Test fail olduğunda package/release durdu. Hatalı değişiklik ileri taşınmadı.'}</p>
    </LabShell>
  )
}

function MicroservicePatternLab({ kind }) {
  const configs = {
    'api-gateway-proxy': {
      eyebrow: 'ROUTING TOPOLOGY',
      title: 'Client backend adreslerini bilmek zorunda kalmasın.',
      badge: 'PROXY',
      scenarios: [
        ['GET /products', ['CLIENT', 'API GATEWAY', 'CATALOG SERVICE'], 'Gateway path’e göre request’i Catalog Service’e route eder.'],
        ['POST /orders', ['CLIENT', 'API GATEWAY', 'ORDER SERVICE'], 'Client tek giriş noktasını kullanır; backend routing gateway’de çözülür.'],
        ['POST /payments', ['CLIENT', 'API GATEWAY', 'PAYMENT SERVICE'], 'Proxy business logic sahibi olmak zorunda değildir; temel iş burada routing.'],
      ],
    },
    'async-messaging': {
      eyebrow: 'BROKER TOPOLOGY',
      title: 'Producer anlık consumer cevabını beklemek zorunda değil.',
      badge: 'ASYNC',
      scenarios: [
        ['Consumer açık', ['ORDER PRODUCER', 'BROKER', 'PAYMENT CONSUMER'], 'Event broker üzerinden consumer’a taşınır; producer doğrudan HTTP response beklemez.'],
        ['Consumer geçici DOWN', ['ORDER PRODUCER', 'BROKER · QUEUED', 'PAYMENT DOWN'], 'Broker dayanıklılık ayarları uygunsa mesaj consumer dönene kadar bekleyebilir.'],
        ['Duplicate delivery', ['BROKER · EVENT x2', 'IDEMPOTENCY CHECK', 'ONE SIDE EFFECT'], 'At-least-once delivery duplicate üretebilir; consumer aynı business etkisini iki kez yapmamalı.'],
      ],
    },
    'pipeline-pattern': {
      eyebrow: 'PROCESS PIPELINE',
      title: 'Tek büyük handler yerine sıralı stage’ler.',
      badge: 'PIPELINE',
      scenarios: [
        ['Normal akış', ['VALIDATE', 'AUTHORIZE', 'ENRICH', 'PROCESS + SAVE'], 'Her stage tek sorumluluk taşır; çıktı sonraki stage’e akar.'],
        ['Validation fail', ['VALIDATE · FAIL', 'STOP', 'NO PROCESS'], 'Erken stage başarısızsa pahalı veya yan etkili sonraki adımlar çalıştırılmaz.'],
        ['Enrichment gerekli', ['VALIDATE', 'FETCH CONTEXT', 'ENRICH', 'PROCESS'], 'Pipeline request’i adım adım zenginleştirip işleyebilir.'],
      ],
    },
  }
  const [scenario, setScenario] = useState(0)
  const [ownership, setOwnership] = useState('separate')

  if (kind === 'aggregator-pattern') {
    return (
      <LabShell eyebrow="FAN-OUT / FAN-IN" title="Üç servisten tek ekran response’u üret." copy="Aggregator paralel kaynaklardan veriyi toplar; client servis koreografisini bilmek zorunda kalmaz." badge="AGGREGATOR">
        <div className="aggregator-stage">
          <div className="pattern-sources">
            {['USER SERVICE', 'ORDER SERVICE', 'PAYMENT SERVICE'].map((label, index) => <motion.div key={label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .08 }}><small>{'SOURCE ' + (index + 1)}</small><strong>{label}</strong></motion.div>)}
          </div>
          <div className="aggregate-core"><small>FAN-IN</small><strong>ORDER SUMMARY AGGREGATOR</strong><code>merge(user, order, payment)</code></div>
          <div className="aggregate-response"><small>CLIENT RESPONSE</small><strong>1 DTO</strong><span>user + order + payment</span></div>
        </div>
        <p className="lab-takeaway"><b>Trade-off:</b> Client basitleşir; aggregator latency, partial failure ve timeout politikasını yönetmek zorunda kalır.</p>
      </LabShell>
    )
  }

  if (kind === 'shared-resources') {
    const separate = ownership === 'separate'
    return (
      <LabShell eyebrow="DATA OWNERSHIP TOPOLOGY" title="Database paylaşımı servis sınırını görünmezce bağlayabilir." copy="Shared schema ile database-per-service yaklaşımını değiştir. Schema değişikliğinin blast radius’unu gör." badge={separate ? 'OWNED DATA' : 'SHARED DB'}>
        <div className="switch-row"><button className={!separate ? 'active' : ''} onClick={() => setOwnership('shared')}>Shared schema</button><button className={separate ? 'active' : ''} onClick={() => setOwnership('separate')}>Database per service</button></div>
        <div className={separate ? 'ownership-stage separate' : 'ownership-stage shared'}>
          <div className="owner-service"><small>SERVICE</small><strong>ORDER</strong><code>order writes</code></div>
          <div className="owner-service"><small>SERVICE</small><strong>PAYMENT</strong><code>payment writes</code></div>
          {separate ? <><div className="owned-db"><small>OWNER</small><strong>ORDER DB</strong></div><div className="owned-db"><small>OWNER</small><strong>PAYMENT DB</strong></div></> : <div className="owned-db shared-db"><small>SHARED RESOURCE</small><strong>ORDER + PAYMENT SCHEMA</strong></div>}
        </div>
        <p className="lab-takeaway"><b>{separate ? 'Ownership:' : 'Coupling:'}</b> {separate ? 'Her servis kendi verisini kontrol eder; cross-service consistency ayrıca tasarlanır.' : 'İki servis aynı schema contract’ına bağlandı. Bir tablo değişikliği iki deploy’u da etkileyebilir.'}</p>
      </LabShell>
    )
  }

  const config = configs[kind]
  const current = config.scenarios[scenario]
  return (
    <LabShell eyebrow={config.eyebrow} title={config.title} copy="Senaryoyu değiştir. Pattern’ın yalnız adını değil, request/event topolojisinde neyi değiştirdiğini gör." badge={config.badge}>
      <div className="pattern-scenario-tabs">{config.scenarios.map((item, index) => <button key={item[0]} className={scenario === index ? 'active' : ''} onClick={() => setScenario(index)}>{item[0]}</button>)}</div>
      <div className="pattern-flow">
        {current[1].map((node, index) => (
          <div className="pattern-hop" key={current[0] + '-' + node}>
            <motion.div className={node.includes('FAIL') || node.includes('DOWN') ? 'danger' : node.includes('BROKER') || node.includes('GATEWAY') ? 'accent' : ''} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{node}</strong></motion.div>
            {index < current[1].length - 1 && <i aria-hidden="true">›</i>}
          </div>
        ))}
      </div>
      <p className="lab-takeaway"><b>Gözlem:</b> {current[2]}</p>
    </LabShell>
  )
}

function OopPrinciplesLab() {
  const [mode, setMode] = useState('encapsulation')
  const [balance, setBalance] = useState(1000)
  const [directAttempt, setDirectAttempt] = useState(false)
  const [animal, setAnimal] = useState('Dog')
  const [sound, setSound] = useState('sound() henüz çağrılmadı')
  const [managerRan, setManagerRan] = useState(false)

  const selectMode = (next) => {
    setMode(next)
    setDirectAttempt(false)
    setSound('sound() henüz çağrılmadı')
    setManagerRan(false)
  }

  return (
    <LabShell eyebrow="OOP WORKBENCH" title="Aynı kavram değil: üç farklı runtime davranışı." copy="OOP başlıklarını tanım olarak değil, state ve dispatch davranışını değiştirerek gör." badge="ENCAPSULATION · POLYMORPHISM · INHERITANCE">
      <div className="oop-mode-switch">
        <button className={mode === 'encapsulation' ? 'active' : ''} onClick={() => selectMode('encapsulation')}>Encapsulation</button>
        <button className={mode === 'polymorphism' ? 'active' : ''} onClick={() => selectMode('polymorphism')}>Polymorphism</button>
        <button className={mode === 'inheritance' ? 'active' : ''} onClick={() => selectMode('inheritance')}>Inheritance</button>
      </div>

      {mode === 'encapsulation' && (
        <div className="oop-encapsulation-stage">
          <div className="oop-object-card">
            <small>BankAccount object</small>
            <code>private int balance</code>
            <strong>{balance} TL</strong>
            <div>
              <button onClick={() => { setBalance((v) => v + 250); setDirectAttempt(false) }}>deposit(250)</button>
              <button onClick={() => setDirectAttempt(true)}>caller: balance = -500</button>
            </div>
          </div>
          <motion.div key={`${balance}-${directAttempt}`} className={`oop-runtime-result ${directAttempt ? 'blocked' : 'ok'}`} initial={{ opacity: .35, y: 7 }} animate={{ opacity: 1, y: 0 }}>
            <small>ERİŞİM SINIRI</small>
            <strong>{directAttempt ? 'BLOCKED · private field' : 'deposit() invariant üzerinden geçti'}</strong>
            <p>{directAttempt ? 'Dışarıdaki caller private field’a doğrudan yazamaz. State değişikliği davranış methodu üzerinden kontrol edilir.' : 'Object kendi state değişimini method sınırında yönetiyor.'}</p>
          </motion.div>
        </div>
      )}

      {mode === 'polymorphism' && (
        <div className="oop-poly-stage">
          <div className="oop-reference"><small>REFERENCE TYPE</small><code>Animal ref</code></div>
          <div className="oop-arrow">→</div>
          <div className="oop-runtime-object">
            <small>RUNTIME OBJECT</small>
            <div className="oop-object-picker">
              {['Dog', 'Cat'].map((type) => <button key={type} className={animal === type ? 'active' : ''} onClick={() => { setAnimal(type); setSound('sound() henüz çağrılmadı') }}>{type}</button>)}
            </div>
            <code>new {animal}()</code>
          </div>
          <button className="oop-call-button" onClick={() => setSound(animal === 'Dog' ? 'Dog.sound() → HAV' : 'Cat.sound() → MİYAV')}>ref.sound() çalıştır</button>
          <motion.div key={sound} className="oop-dispatch-result" initial={{ opacity: .35, scale: .98 }} animate={{ opacity: 1, scale: 1 }}><small>RUNTIME DISPATCH</small><strong>{sound}</strong></motion.div>
        </div>
      )}

      {mode === 'inheritance' && (
        <div className="oop-inheritance-stage">
          <div className="oop-class-node"><small>BASE</small><strong>Employee</strong><code>getName()</code></div>
          <div className="oop-extends-line">extends ↓</div>
          <div className="oop-class-node child"><small>SUBTYPE</small><strong>Manager</strong><code>approveBudget()</code></div>
          <button onClick={() => setManagerRan(true)}>Manager object’ini çalıştır</button>
          <motion.div key={managerRan ? 'run' : 'idle'} className="oop-inheritance-result" initial={{ opacity: .35, x: 8 }} animate={{ opacity: 1, x: 0 }}>
            {managerRan ? <><strong>getName() ✓ + approveBudget() ✓</strong><p>Manager gerçek bir Employee türüyse ortak davranışı miras alıp kendi davranışını ekleyebilir.</p></> : <p>Çalıştırınca inherited ve subtype davranışlarını birlikte göreceksin.</p>}
          </motion.div>
        </div>
      )}
    </LabShell>
  )
}

function DispatchTimingLab() {
  const [mode, setMode] = useState('overload')
  const [overloadCase, setOverloadCase] = useState(0)
  const [runtimeType, setRuntimeType] = useState('Dog')
  const overloads = [
    ['sum(10)', 'sum(int a)', 'Compiler argument listesinden tek parametreli signature’ı seçti.'],
    ['sum(10, 2)', 'sum(int a, int b)', 'Compiler iki parametreli overload’u compile-time’da bağladı.'],
    ['sum("10", "2")', 'sum(String a, String b)', 'Aynı method adı, farklı parameter type listesi: farklı overload.'],
    ['int sum(int a)', 'COMPILE ERROR', 'Sadece return type değiştirerek overload yapılamaz.'],
  ]
  const current = overloads[overloadCase]

  return (
    <LabShell eyebrow="DISPATCH TIMING LAB" title="Method seçimi ne zaman yapılıyor?" copy="Overload’da compiler signature seçer. Override’da runtime gerçek object’e bakar. İki mekanizmayı aynı ekranda zaman çizgisiyle karşılaştır." badge="COMPILE-TIME ↔ RUNTIME">
      <div className="dispatch-mode-switch">
        <button className={mode === 'overload' ? 'active' : ''} onClick={() => setMode('overload')}>Overload · compile-time</button>
        <button className={mode === 'override' ? 'active' : ''} onClick={() => setMode('override')}>Override · runtime</button>
      </div>

      {mode === 'overload' ? (
        <div className="dispatch-stage">
          <div className="dispatch-calls">
            {overloads.map((entry, index) => <button key={entry[0]} className={index === overloadCase ? 'active' : ''} onClick={() => setOverloadCase(index)}><code>{entry[0]}</code></button>)}
          </div>
          <div className="dispatch-timeline">
            <div className="dispatch-node active"><small>1 · SOURCE</small><code>{current[0]}</code></div>
            <div className="dispatch-line">compiler →</div>
            <motion.div key={current[1]} className={`dispatch-node result ${current[1] === 'COMPILE ERROR' ? 'error' : ''}`} initial={{ opacity: .3, x: 10 }} animate={{ opacity: 1, x: 0 }}><small>2 · SIGNATURE</small><strong>{current[1]}</strong><p>{current[2]}</p></motion.div>
          </div>
        </div>
      ) : (
        <div className="dispatch-stage override-stage">
          <div className="dispatch-reference"><small>COMPILE-TIME</small><code>Animal ref</code><span>sound() çağrısı geçerli ✓</span></div>
          <div className="dispatch-line vertical">runtime ↓</div>
          <div className="dispatch-runtime-picker">
            {['Dog', 'Cat'].map((type) => <button key={type} className={runtimeType === type ? 'active' : ''} onClick={() => setRuntimeType(type)}>new {type}()</button>)}
          </div>
          <motion.div key={runtimeType} className="dispatch-runtime-result" initial={{ opacity: .3, y: 8 }} animate={{ opacity: 1, y: 0 }}><small>RUNTIME METHOD</small><strong>{runtimeType}.sound()</strong><code>{runtimeType === 'Dog' ? 'HAV' : 'MİYAV'}</code><p>Reference type Animal; çalışan implementation gerçek object olan {runtimeType} tarafından belirlendi.</p></motion.div>
        </div>
      )}
    </LabShell>
  )
}

function TypeRelationshipLab() {
  const scenarios = [
    { id: 'address', title: 'User ve Address', need: 'User bir adrese sahip. User, Address değildir.', correct: 'has-a', left: 'User', right: 'Address', explain: 'Composition: Address bir field/dependency olarak tutulur.' },
    { id: 'sender', title: 'EmailSender ve SmsSender', need: 'İkisi de send() sözleşmesini sunmalı; implementation değişebilmeli.', correct: 'implements', left: 'EmailSender', right: 'Sender', explain: 'Interface: farklı sınıflar aynı capability sözleşmesini uygular.' },
    { id: 'report', title: 'PdfReport ve BaseReport', need: 'Alt tip ortak state, constructor ve kısmi implementation paylaşmalı.', correct: 'extends', left: 'PdfReport', right: 'BaseReport', explain: 'Abstract class: ortak instance state ve kısmi davranış paylaşımı için uygundur.' },
  ]
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [relation, setRelation] = useState(null)
  const scenario = scenarios[scenarioIndex]
  const chooseScenario = (index) => { setScenarioIndex(index); setRelation(null) }
  const ok = relation === scenario.correct

  return (
    <LabShell eyebrow="TYPE RELATION DESIGNER" title="extends, implements, has-a: ilişkiyi sen kur." copy="Önce ihtiyacı seç; sonra iki tipi hangi ilişkiyle bağlayacağına karar ver. Diagram ve sonuç anında değişir." badge="IS-A · CONTRACT · HAS-A">
      <div className="relation-scenarios">
        {scenarios.map((item, index) => <button key={item.id} className={scenarioIndex === index ? 'active' : ''} onClick={() => chooseScenario(index)}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.title}</strong></button>)}
      </div>
      <div className="relation-need"><small>TASARIM İHTİYACI</small><p>{scenario.need}</p></div>
      <div className="relation-builder">
        <div className="relation-class"><small>TYPE A</small><strong>{scenario.left}</strong></div>
        <div className="relation-center">
          {['extends', 'implements', 'has-a'].map((option) => <button key={option} className={relation === option ? 'active' : ''} onClick={() => setRelation(option)}>{option}</button>)}
        </div>
        <div className="relation-class"><small>TYPE B</small><strong>{scenario.right}</strong></div>
      </div>
      <motion.div key={`${scenario.id}-${relation}`} className={`relation-result ${relation ? (ok ? 'ok' : 'bad') : ''}`} initial={{ opacity: .3, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {!relation ? <p>Bir ilişki seç; tasarımın semantiğini kontrol edelim.</p> : ok ? <><strong>Doğru ilişki: {relation}</strong><p>{scenario.explain}</p></> : <><strong>Bu ilişki ihtiyacı yanlış modelliyor.</strong><p>Burada beklenen ilişki <code>{scenario.correct}</code>. İsim benzerliğiyle değil, IS-A / capability / HAS-A semantiğiyle seç.</p></>}
      </motion.div>
    </LabShell>
  )
}

const labExperiments = {
  'java-oop': {
    eyebrow: 'OOP DESIGN LAB', title: 'İlişkiyi davranışa göre seç.', badge: 'ENCAPSULATION / POLYMORPHISM',
    copy: 'Senaryoyu değiştir. OOP kavramının hangi tasarım problemini çözdüğünü sonuç üzerinden gör.',
    prompt: 'Senaryo',
    choices: [
      ['Bakiye yalnız method ile değişsin', 'Encapsulation', 'State’i public bırakmak yerine invariant’ı method sınırında korursun.'],
      ['Dog ve Cat aynı Animal tipinden çağrılsın', 'Polymorphism', 'Caller concrete tipe göre if zinciri kurmadan ortak sözleşmeyi kullanır.'],
      ['Manager, Employee davranışını genişletsin', 'Inheritance · IS-A', 'Gerçek bir IS-A ilişkisi varsa ortak davranış üst tipten gelebilir; sırf kod tekrarını azaltmak için inheritance seçilmez.'],
    ],
  },
  'java-overload-override': {
    eyebrow: 'DISPATCH LAB', title: 'Aynı isim, farklı karar zamanı.', badge: 'COMPILE-TIME / RUNTIME',
    copy: 'Çağrı biçimini seç. Compiler’ın overload seçimi ile runtime override dispatch farkını gör.',
    prompt: 'Kod durumu',
    choices: [
      ['total(10, 2)', 'Overload seçimi · compile-time', 'Parameter listesi çağrı anında hangi method signature’ın uygun olduğunu belirler.'],
      ['Animal a = new Dog(); a.sound()', 'Override seçimi · runtime', 'Reference Animal olsa da gerçek object Dog olduğu için override edilmiş sound çalışır.'],
      ['Sadece return type değişti', 'Geçerli overload değil', 'Java overload ayrımını yalnız return type üzerinden yapamaz.'],
    ],
  },
  'java-abstract-composition': {
    eyebrow: 'TYPE RELATION LAB', title: 'IS-A mı, HAS-A mı?', badge: 'ABSTRACT / INTERFACE / COMPOSITION',
    copy: 'İlişkiyi seç. Inheritance yerine composition veya interface kullanmanın ne zaman daha temiz olduğunu gör.',
    prompt: 'Tasarım ihtiyacı',
    choices: [
      ['User bir Address’e sahip', 'Composition · HAS-A', 'User, Address değildir; Address dependency/field olarak tutulur.'],
      ['Email ve SMS aynı send sözleşmesini sunsun', 'Interface', 'Farklı implementation’lar aynı capability üzerinden değiştirilebilir.'],
      ['Alt tipler ortak state + constructor paylaşsın', 'Abstract class', 'Ortak instance state ve kısmi implementation gerekiyorsa abstract class uygun olabilir.'],
    ],
  },
  'java-collections': {
    eyebrow: 'COLLECTION CHOICE LAB', title: 'Veri davranışı collection’ı seçsin.', badge: 'LIST / SET / MAP',
    copy: 'İhtiyacı seç. Sıra, uniqueness ve key lookup gereksiniminin yapıyı nasıl değiştirdiğini gör.',
    prompt: 'İhtiyaç',
    choices: [
      ['Sepette sıra ve tekrar olabilir', 'List', 'Index/sıra davranışı ve duplicate elemanlar bu ihtiyaca uyar.'],
      ['Kullanıcı rolleri tekrarlamasın', 'Set', 'Uniqueness doğrudan collection sözleşmesinde ifade edilir.'],
      ['userId ile kullanıcıyı bul', 'Map<Long, User>', 'Key-value lookup ihtiyacını doğrudan model eder.'],
    ],
  },
  'java-hashmap': {
    eyebrow: 'HASH LOOKUP LAB', title: 'Önce bucket, sonra equality.', badge: 'hashCode + equals',
    copy: 'Key durumunu seç. HashMap lookup’ın hangi sözleşmeye güvendiğini ve nerede bozulduğunu gör.',
    prompt: 'Key durumu',
    choices: [
      ['equals true · hashCode aynı', 'Lookup çalışır', 'Eşit key’lerin aynı hashCode üretmesi HashMap sözleşmesinin zorunlu parçasıdır.'],
      ['hashCode aynı · equals false', 'Collision · iki key ayrı kalabilir', 'Aynı bucket’a düşmek mantıksal eşitlik demek değildir; equals son ayrımı yapar.'],
      ['Map’e koyduktan sonra key’in hash alanı değişti', 'Lookup riski', 'Mutable key bucket konumuyla mantıksal state’i ayırıp kaydı bulunamaz hale getirebilir.'],
    ],
  },
  'java-static-immutability': {
    eyebrow: 'STATE OWNERSHIP LAB', title: 'State kime ait ve değişebilir mi?', badge: 'static / final / immutable',
    copy: 'Kod kararını seç. Class-level state, referans sabitliği ve object değişmezliğini birbirinden ayır.',
    prompt: 'Kod kararı',
    choices: [
      ['static int count', 'Class-level shared state', 'Field instance’a değil class’a aittir; concurrent erişimde shared mutable state riski doğabilir.'],
      ['final List<String> names', 'Referans yeniden atanamaz', 'final listenin içeriğini otomatik immutable yapmaz; object hâlâ değişebilir olabilir.'],
      ['record Money(BigDecimal amount, Currency currency)', 'Immutable value tasarımına yakın', 'State constructor’da kurulur ve setter yoktur; yine de component tiplerinin mutability’si düşünülmelidir.'],
    ],
  },
  'java-memory-equality': {
    eyebrow: 'IDENTITY LAB', title: 'Aynı değer mi, aynı referans mı?', badge: 'STACK / HEAP / == / equals',
    copy: 'Karşılaştırmayı seç. Reference identity ile logical equality farkını object örnekleri üzerinden gör.',
    prompt: 'Karşılaştırma',
    choices: [
      ['new String("A") == new String("A")', 'Genelde false · farklı reference', '`==` object reference identity karşılaştırır; aynı karakter içeriği yeterli değildir.'],
      ['new String("A").equals(new String("A"))', 'true · logical equality', 'String equals içeriğe göre karşılaştırır.'],
      ['Local reference scope dışına çıktı', 'Object hemen kesin silinmez', 'GC yalnız reachable olmayan heap object’lerini uygun gördüğü zamanda temizler; scope bitişi anlık free garantisi değildir.'],
    ],
  },
  'java-exceptions': {
    eyebrow: 'EXCEPTION FLOW LAB', title: 'Hatayı gizleme; doğru sınırda taşı.', badge: 'throw / throws / catch',
    copy: 'Durumu seç. Exception oluşturma, declare etme ve handling farkını akış üzerinden gör.',
    prompt: 'Durum',
    choices: [
      ['Stok yetersiz', 'throw new OutOfStockException(...)', 'Business failure o noktada explicit exception olarak fırlatılır.'],
      ['Method IOException taşıyabilir', 'throws IOException', 'Checked exception method signature’da caller’a bildirilir.'],
      ['catch (Exception e) { log; } ve devam', 'Failure yutuldu', 'Caller başarısızlığı görmez; sistem yanlış biçimde başarılıymış gibi ilerleyebilir.'],
    ],
  },
  'java-streams': {
    eyebrow: 'STREAM PIPELINE LAB', title: 'Seç, dönüştür, sonucu üret.', badge: 'filter / map / terminal',
    copy: 'Pipeline ihtiyacını seç. Intermediate ve terminal operation rollerini gör.',
    prompt: 'İşlem',
    choices: [
      ['Yalnız aktif ürünleri tut', 'filter(Product::isActive)', 'Predicate false olan elemanları pipeline’dan çıkarır.'],
      ['Product’tan name üret', 'map(Product::getName)', 'Her elemanı başka bir değere dönüştürür.'],
      ['Sonucu List yap', 'toList() · terminal operation', 'Lazy intermediate adımların çalışmasını tetikleyip sonuç collection’ını üretir.'],
    ],
  },
  'java-concurrency': {
    eyebrow: 'RACE LAB', title: 'Aynı stok, iki thread, yanlış sonuç.', badge: 'READ / MODIFY / WRITE',
    copy: 'Interleaving durumunu seç. Race condition’ın neden tek satırlık kodda bile oluşabildiğini gör.',
    prompt: 'Execution',
    choices: [
      ['T1 read=1 · T2 read=1 · ikisi de decrement', 'Race condition · oversell', 'İki thread aynı eski state’i okuyup birbirinin update’ini ezebilir.'],
      ['Critical section synchronized', 'Serialized access', 'Aynı monitor üzerinden tek thread kritik bölgeye girer; correctness artar, contention maliyeti olabilir.'],
      ['Shared state immutable', 'Race yüzeyi azalır', 'Thread’ler aynı veriyi değiştirmediğinde koordinasyon ihtiyacı ciddi azalır.'],
    ],
  },
  'solid-clean-code': {
    eyebrow: 'DESIGN REVIEW LAB', title: 'Kod çalışıyor; peki değişiklik maliyeti?', badge: 'SOLID / CLEAN CODE',
    copy: 'Code smell’i seç. Hangi tasarım ilkesinin neden değerli olduğunu gerçek değişim senaryosuyla gör.',
    prompt: 'Review bulgusu',
    choices: [
      ['OrderService hem fiyat, email, SQL, PDF yapıyor', 'SRP zayıf · çok değişim nedeni', 'Bir class farklı sorumluluklar yüzünden sürekli değişiyorsa bakım ve test maliyeti büyür.'],
      ['Service concrete EmailSender new’liyor', 'DIP zayıf · abstraction’a bağımlılık düşün', 'Implementation değişimi Service kodunu da zorunlu değiştirir; dependency’yi dışarıdan almak ve abstraction’a bağlanmak coupling’i azaltabilir.'],
      ['Method adı calculate ama yan etkili DB delete yapıyor', 'Clean code / intention mismatch', 'İsim ve davranış uyuşmadığında code review ve debugging maliyeti artar.'],
    ],
  },
  'sql-basics': {
    eyebrow: 'QUERY SHAPE LAB', title: 'Aynı tablo, farklı sorgu maliyeti.', badge: 'SELECT / WHERE / ORDER BY',
    copy: 'Sorgu ihtiyacını seç. Filter, projection ve sort kararlarının sonucu nasıl değiştirdiğini gör.',
    prompt: 'İhtiyaç',
    choices: [
      ['Yalnız aktif ürünler', 'WHERE active = true', 'Satırlar sonuç setine girmeden filtrelenir; uygun index erişimi hızlandırabilir.'],
      ['Sadece id, name gerekli', 'SELECT id, name', 'Gereksiz kolonları taşımamak I/O ve network maliyetini azaltabilir.'],
      ['En pahalı 20 ürün', 'ORDER BY price DESC LIMIT 20', 'Sıralama ve limit birlikte istenen top-N sonucu üretir; büyük tabloda index tasarımı önemlidir.'],
    ],
  },
  'sql-joins': {
    eyebrow: 'JOIN RESULT LAB', title: 'Eşleşmeyen sipariş kaybolsun mu?', badge: 'INNER / LEFT',
    copy: 'İstenen sonucu seç. Join türünün hangi satırları koruduğunu veri davranışı üzerinden gör.',
    prompt: 'Rapor ihtiyacı',
    choices: [
      ['Yalnız ödemesi olan siparişler', 'INNER JOIN payment', 'Join condition eşleşmeyen Order satırları sonuçtan çıkar.'],
      ['Ödemesi olmayanlar da görünsün', 'LEFT JOIN payment', 'Sol taraftaki tüm Order satırları korunur; eşleşmeyen Payment kolonları NULL olur.'],
      ['ON koşulu unutuldu', 'Cartesian büyüme riski', 'İlişkisiz satır kombinasyonları üretilip sonuç sayısı patlayabilir.'],
    ],
  },
  'sql-grouping': {
    eyebrow: 'AGGREGATION LAB', title: 'Satırı mı, oluşmuş grubu mu filtreliyorsun?', badge: 'WHERE / GROUP BY / HAVING',
    copy: 'Koşulu seç. SQL aggregation akışında filter’ın hangi aşamada çalışması gerektiğini gör.',
    prompt: 'Koşul',
    choices: [
      ['2026 siparişlerini önce ele', 'WHERE created_at >= ...', 'Grouping öncesi gereksiz satırları azaltır.'],
      ['Müşteri başına sipariş sayısı', 'GROUP BY customer_id + COUNT(*)', 'Aynı customer satırlarını grup halinde aggregate eder.'],
      ['COUNT(*) > 5 olan gruplar', 'HAVING COUNT(*) > 5', 'Aggregate sonucu oluştuktan sonra grubu filtreler.'],
    ],
  },
  'sql-index-normalization': {
    eyebrow: 'DATABASE DESIGN LAB', title: 'Hızın bedeli ve verinin şekli.', badge: 'INDEX / NORMALIZATION',
    copy: 'Tasarım kararını seç. Index’in ücretsiz olmadığını ve normalization’ın hangi problemi çözdüğünü gör.',
    prompt: 'Karar',
    choices: [
      ['customer_id + created_at sık filtreleniyor', 'Composite index adayı', 'Kolon sırası gerçek query pattern’iyle birlikte değerlendirilir.'],
      ['Her kolona index ekle', 'Write + storage maliyeti büyür', 'Her INSERT/UPDATE ilgili index yapılarını da günceller; kullanılmayan index ücretsiz değildir.'],
      ['Index var ama sorgu hâlâ yavaş', 'EXPLAIN / query plan incele', 'Optimizer’ın gerçekten index kullanıp kullanmadığını, scan ve join kararlarını ölçmeden index var diye hızlı varsayma.'],
      ['Customer bilgisi her order satırında tekrar ediyor', 'Normalization adayı', 'Tekrarlı veriyi ayrı ilişkili yapıya ayırmak update anomaly ve tutarsızlığı azaltabilir.'],
    ],
  },
  'generics-record': {
    eyebrow: 'JAVA TYPE LAB', title: 'Aynı veri, farklı taşıma modeli.', badge: 'primitive / wrapper / array / List<T>',
    copy: 'Temel tipi ve container’ı değiştir. Primitive-wrapper ile sabit array-dinamik List farkını davranış üzerinden gör.',
    prompt: 'Kod durumu',
    choices: [
      ['int count = 3', 'primitive · doğrudan değer', '`int` object değildir; generic type parameter olarak kullanılamaz.'],
      ['Integer boxed = count', 'wrapper · autoboxing', 'Compiler primitive `int` değerini `Integer` wrapper object’ine çevirebilir.'],
      ['String[] names = new String[2]', 'array · sabit uzunluk', 'Array oluşturulduktan sonra length değişmez.'],
      ['List<String> names = new ArrayList<>()', 'List · dinamik boyut', 'List generic tip güvenliği sağlar; ArrayList ihtiyaç oldukça büyüyebilir.'],
      ['Optional<String>', 'değer veya empty', 'Bir String değerin bulunmama ihtimalini type üzerinden ifade eder.'],
    ],
  },
  'json-basics': {
    eyebrow: 'SERIALIZATION LAB', title: 'Object kablodan nasıl geçiyor?', badge: 'Java ↔ JSON',
    copy: 'Aynı verinin Java object ve JSON temsilini değiştirerek serialization/deserialization yönünü gör.',
    prompt: 'Dönüşüm yönü',
    choices: [
      ['Java → JSON', 'Product{name="Klavye"}  ⇒  {"name":"Klavye"}', 'Serialization: object taşınabilir JSON metnine dönüşür.'],
      ['JSON → Java', '{"name":"Klavye"}  ⇒  Product{name="Klavye"}', 'Deserialization: JSON program içindeki tipe dönüşür.'],
    ],
  },
  'api-basics': {
    eyebrow: 'ENDPOINT LAB', title: 'Aynı path, farklı davranış.', badge: 'method + path',
    copy: 'Method’u değiştir. `/products` aynı kalsa bile endpoint davranışı değişir.',
    prompt: 'Endpoint seç',
    choices: [
      ['GET /products', '200 OK · ürün listesi', 'Kaynakları okuma davranışı.'],
      ['POST /products', '201 Created · yeni ürün', 'Yeni resource oluşturma davranışı.'],
      ['DELETE /products/42', '204 No Content', 'Belirli resource’u silme davranışı.'],
    ],
  },
  'project-anatomy': {
    eyebrow: 'PROJECT EXPLORER', title: 'Dosyayı doğru yere koy.', badge: 'pom.xml / src',
    copy: 'Bir ihtiyacı seç. Spring Boot projesinde önce hangi yere bakacağını gör.',
    prompt: 'Ne arıyorsun?',
    choices: [
      ['Dependency ekleyeceğim', 'pom.xml', 'Maven dependency ve build tanımları burada.'],
      ['Java kodunu bulacağım', 'src/main/java', 'Application source code burada.'],
      ['Uygulama ayarı değiştireceğim', 'src/main/resources/application.yml', 'Config/resource alanı burada.'],
    ],
  },
  'spring-vs-boot': {
    eyebrow: 'BOOT STARTUP LAB', title: 'Boot neyi hazır getiriyor?', badge: 'Spring Boot',
    copy: 'Aynı web uygulamasını kurarken Boot’un azalttığı kurulum işlerini karşılaştır.',
    prompt: 'Kurulum biçimi',
    choices: [
      ['Spring Boot starter', 'Starter + auto-configuration + embedded server', 'Uyumlu dependency ve makul varsayımlarla hızlı başlangıç.'],
      ['Elle Spring kurulumu', 'Dependency/config/server seçimleri daha fazla elle yapılır', 'Spring çalışır; Boot kolaylık katmanı azalır.'],
    ],
  },
  'request-inputs': {
    eyebrow: 'INPUT BINDING LAB', title: 'Input URL’nin neresinden geliyor?', badge: '/products/42?currency=USD',
    copy: 'İstek parçasını seç. Spring MVC’de hangi annotation ile method parametresine bağlandığını gör.',
    prompt: 'Parçayı seç',
    choices: [
      ['42', '@PathVariable Long id', 'Path içindeki dinamik resource kimliği.'],
      ['currency=USD', '@RequestParam String currency', 'Query string içindeki ek filtre/ayar.'],
      ['{"name":"Klavye"}', '@RequestBody CreateProductRequest body', 'HTTP body içeriği Java object’e çevrilir.'],
    ],
  },
  'api-design': {
    eyebrow: 'STATUS CODE LAB', title: 'Ne olduysa onu söyleyen status.', badge: '2xx / 4xx / 5xx',
    copy: 'Senaryoyu seç. Client body’yi okumadan önce HTTP status ile ne olduğunu anlayabilsin.',
    prompt: 'Senaryo',
    choices: [
      ['Yeni kayıt oluştu', '201 Created', 'Yeni resource başarıyla oluşturuldu.'],
      ['Kaynak bulunamadı', '404 Not Found', 'İstenen resource yok.'],
      ['Kimlik var, yetki yok', '403 Forbidden', 'Authentication var; authorization reddetti.'],
    ],
  },
  'jpa-basics': {
    eyebrow: 'ORM LAB', title: 'Java object ile DB satırı arasındaki köprü.', badge: 'JPA / Hibernate',
    copy: 'Katmanı seç. Specification ile implementation farkını gör.',
    prompt: 'Parça',
    choices: [
      ['JPA', 'Specification / API sözleşmesi', 'Kuralları ve API’yi tanımlar.'],
      ['Hibernate', 'JPA implementation + ORM engine', 'JPA sözleşmesini uygulayan yaygın motorlardan biri.'],
      ['Database', 'Kalıcı satırlar', 'Verinin gerçekten saklandığı sistem.'],
    ],
  },
  pagination: {
    eyebrow: 'QUERY COUNT LAB', title: 'Liste büyüdükçe ne olur?', badge: 'pagination / N+1',
    copy: 'Okuma biçimini seç. Query sayısı ve taşınan veri miktarındaki farkı gör.',
    prompt: 'Okuma stratejisi',
    choices: [
      ['Page size = 20', '1 sayfalama sorgusu · 20 kayıt', 'Büyük tabloyu parça parça okursun.'],
      ['N+1 senaryosu', '1 ana sorgu + her kayıt için ek sorgular', 'Benzer SELECT sayısı hızla büyür.'],
      ['Tüm tablo List', 'Çok büyük veri tek response’a taşınabilir', 'Büyük dataset için bellek ve ağ maliyeti büyür.'],
    ],
  },
  exceptions: {
    eyebrow: 'ERROR MAPPING LAB', title: 'Exception’ı API cevabına çevir.', badge: '@RestControllerAdvice',
    copy: 'Exception türünü seç. Merkezi handler’ın hangi HTTP cevabına map ettiğini gör.',
    prompt: 'Exception',
    choices: [
      ['ProductNotFound', '404 Not Found', 'Kaynak yok hatası API sözleşmesine çevrilir.'],
      ['ValidationException', '400 Bad Request', 'Client girdisi kurala uymadı.'],
      ['Beklenmeyen hata', '500 Internal Server Error', 'Sunucu tarafında beklenmeyen başarısızlık.'],
    ],
  },
  config: {
    eyebrow: 'PROFILE LAB', title: 'Kod aynı, ortam ayarı farklı.', badge: 'application.yml',
    copy: 'Ortamı değiştir. Aynı uygulama farklı dış ayarlarla çalışabilsin.',
    prompt: 'Ortam',
    choices: [
      ['local', 'base-url=http://localhost:9000', 'Yerel geliştirme ayarı.'],
      ['test', 'base-url=http://fake-payment:8080', 'Test ortamı dependency adresi.'],
      ['production', 'base-url=${PAYMENT_URL}', 'Değer deployment ortamından gelir.'],
    ],
  },
  logging: {
    eyebrow: 'LOG LEVEL LAB', title: 'Hangi kayıtlar görünür?', badge: 'DEBUG / INFO / WARN / ERROR',
    copy: 'Log seviyesini seç. Production’da hangi mesajların filtreleneceğini gör.',
    prompt: 'Minimum seviye',
    choices: [
      ['DEBUG', 'DEBUG + INFO + WARN + ERROR', 'En ayrıntılı; geliştirmede yararlı olabilir.'],
      ['INFO', 'INFO + WARN + ERROR', 'Normal işleyiş ve önemli olaylar görünür.'],
      ['ERROR', 'Sadece ERROR', 'Yalnız ciddi başarısızlıklar görünür.'],
    ],
  },
  security: {
    eyebrow: 'AUTH LAB', title: '401 mi 403 mü?', badge: 'authentication / authorization',
    copy: 'Kullanıcının durumunu seç. Security zincirinin hangi status’u üretmesi gerektiğini gör.',
    prompt: 'Durum',
    choices: [
      ['Token yok/geçersiz', '401 Unauthorized', 'Kimlik doğrulanamadı.'],
      ['Giriş yapmış ama ADMIN değil', '403 Forbidden', 'Kimlik var; bu aksiyona yetki yok.'],
      ['Giriş yapmış ve yetkili', '200 OK', 'Security kontrolü geçildi.'],
    ],
  },
  testing: {
    eyebrow: 'TEST SCOPE LAB', title: 'Gerektiği kadar Spring aç.', badge: 'unit / slice / integration',
    copy: 'Test hedefini seç. En uygun test kapsamını gör.',
    prompt: 'Ne test ediyorsun?',
    choices: [
      ['Sadece Service kuralı', 'Unit test', 'Spring context açmadan hızlı davranış testi.'],
      ['Controller/MVC katmanı', '@WebMvcTest', 'Web slice odaklı test.'],
      ['Tam uygulama entegrasyonu', '@SpringBootTest', 'Geniş Spring context ile integration testi.'],
    ],
  },
  actuator: {
    eyebrow: 'HEALTH LAB', title: 'Port açık olması yetmez.', badge: '/actuator/health',
    copy: 'Sistem sinyalini seç. Operasyon ekibinin ne gördüğünü incele.',
    prompt: 'Sinyal',
    choices: [
      ['health', 'UP / DOWN', 'Uygulamanın sağlık durumunu özetler.'],
      ['readiness', 'Trafik almaya hazır mı?', 'Dependency ve başlangıç durumuna göre trafik kararı.'],
      ['metrics', 'request count / latency / JVM', 'Performans ve çalışma zamanı ölçümleri.'],
    ],
  },
  migrations: {
    eyebrow: 'SCHEMA VERSION LAB', title: 'DB değişikliği de versiyonlanır.', badge: 'Flyway / Liquibase',
    copy: 'Migration dosyasını seç. Şema değişikliklerinin sırayla nasıl ilerlediğini gör.',
    prompt: 'Migration',
    choices: [
      ['V1__create_product.sql', 'product tablosu oluşur', 'İlk schema adımı.'],
      ['V2__add_price.sql', 'price kolonu eklenir', 'İkinci schema adımı.'],
      ['V3__add_stock.sql', 'stock kolonu eklenir', 'Üçüncü schema adımı.'],
    ],
  },
  cache: {
    eyebrow: 'CACHE LAB', title: 'İlk istek pahalı, ikincisi ucuz.', badge: '@Cacheable',
    copy: 'Aynı ürünü tekrar oku. Cache hit/miss farkını gör.',
    prompt: 'İstek',
    choices: [
      ['İlk GET /products/42', 'MISS · DB sorgusu çalışır · cache dolar', 'Cache’de değer olmadığı için kaynak sisteme gidilir.'],
      ['İkinci GET /products/42', 'HIT · DB sorgusu yok', 'Aynı key için cached sonuç döner.'],
      ['Ürün güncellendi', 'Cache invalidate edilmeli', 'Eski kopyayı tutarsan stale data oluşur.'],
    ],
  },
  async: {
    eyebrow: 'ASYNC LAB', title: 'Request thread’ini ne kadar tutacaksın?', badge: '@Async / queue',
    copy: 'İş tipini seç. Basit async ile dayanıklı message queue arasındaki farkı gör.',
    prompt: 'İş tipi',
    choices: [
      ['Kısa e-posta işi', '@Async executor', 'Request thread’inden ayrılabilir; hata ve kapasite yine yönetilmeli.'],
      ['Kaybolmaması gereken kritik iş', 'Message queue + consumer', 'Retry ve dayanıklılık için daha uygun olabilir.'],
      ['Saatlik temizlik', '@Scheduled', 'Zamanlanmış tekrar eden işler için.'],
    ],
  },
  'monolith-basics': {
    eyebrow: 'DEPLOY UNIT LAB', title: 'Kaç parça deploy ediliyor?', badge: 'ONE APP',
    copy: 'Monolith içinde modüller ayrı olabilir; deploy paketi yine tek olabilir.',
    prompt: 'Değişiklik',
    choices: [
      ['Order kodunu değiştir', 'commerce-app.jar yeniden build/deploy', 'Order ayrı module olsa da deploy unit tek.'],
      ['Payment kodunu değiştir', 'commerce-app.jar yeniden build/deploy', 'Aynı uygulama paketi tekrar yayınlanır.'],
    ],
  },
  'microservice-basics': {
    eyebrow: 'PROCESS LAB', title: 'Aynı kod tabanı değil, ayrı çalışan servis.', badge: 'ORDER / PAYMENT',
    copy: 'Servisi seç. Her birinin ayrı process ve port üzerinde çalışabildiğini gör.',
    prompt: 'Servis',
    choices: [
      ['Order Service', 'order-service.jar · :8081', 'Sipariş işini yapan ayrı uygulama/process.'],
      ['Payment Service', 'payment-service.jar · :8082', 'Ödeme işini yapan ayrı uygulama/process.'],
    ],
  },
  'service-boundary': {
    eyebrow: 'BOUNDARY LAB', title: 'Bu iş kimin sorumluluğu?', badge: 'OWNERSHIP',
    copy: 'İş kuralını seç. Hangi servis sınırına daha doğal oturduğunu gör.',
    prompt: 'İş',
    choices: [
      ['Sipariş durumunu değiştir', 'Order Service', 'Order lifecycle Order domain’inin sorumluluğu.'],
      ['Ödemeyi iade et', 'Payment Service', 'Refund ödeme domain’ine ait davranış.'],
      ['Ürün adını değiştir', 'Catalog Service', 'Ürün katalog bilgisinin sahibi Catalog.'],
    ],
  },
  'sync-communication': {
    eyebrow: 'HTTP CALL LAB', title: 'Order, Payment’ı bekliyor.', badge: 'SYNC',
    copy: 'Payment durumunu değiştir. Senkron çağrının Order üzerindeki etkisini gör.',
    prompt: 'Payment durumu',
    choices: [
      ['80 ms’de cevap', 'Order -> Payment -> 200 OK', 'Akış cevap gelince devam eder.'],
      ['5 saniye cevap yok', 'Order ... bekliyor ... timeout', 'Uzak servis yavaşlığı çağıranı da etkiler.'],
      ['Payment DOWN', 'connection error / timeout', 'Network dependency hata verdi; hata stratejisi gerekir.'],
    ],
  },
  'async-messaging': {
    eyebrow: 'EVENT LAB', title: 'Mesajı bırak, anlık cevap bekleme.', badge: 'BROKER',
    copy: 'OrderCreated event’inin producer’dan consumer’a nasıl aktığını gör.',
    prompt: 'Durum',
    choices: [
      ['Consumer açık', 'Order -> Broker -> Payment Consumer', 'Event normal şekilde tüketilir.'],
      ['Consumer geçici kapalı', 'Order -> Broker · mesaj bekliyor', 'Broker/ayar uygunsa mesaj daha sonra tüketilebilir.'],
      ['Aynı mesaj tekrar geldi', 'Consumer idempotency kontrolü', 'Duplicate delivery ihtimali için aynı işi iki kez yapmamak gerekir.'],
    ],
  },
  'api-gateway-proxy': {
    eyebrow: 'ROUTING LAB', title: 'Tek kapı, doğru servis.', badge: 'GATEWAY / PROXY',
    copy: 'Path’i seç. Gateway’in request’i hangi servise yönlendirdiğini gör.',
    prompt: 'Request',
    choices: [
      ['GET /products', 'Gateway -> Catalog Service', 'Ürün isteği katalog servisine route edilir.'],
      ['POST /orders', 'Gateway -> Order Service', 'Sipariş isteği Order Service’e gider.'],
      ['POST /payments', 'Gateway -> Payment Service', 'Ödeme isteği Payment Service’e gider.'],
    ],
  },
  'aggregator-pattern': {
    eyebrow: 'AGGREGATION LAB', title: 'Üç kaynaktan tek response.', badge: 'AGGREGATOR',
    copy: 'Ekranın istediği veriyi seç. Aggregator’ın hangi servisleri çağıracağını gör.',
    prompt: 'Ekran',
    choices: [
      ['Sipariş özeti', 'User + Order + Payment -> ONE RESPONSE', 'Üç kaynaktan veri birleştirilir.'],
      ['Sadece ürün adı', 'Catalog -> response', 'Tek servis yeterliyse aggregator gereksiz olabilir.'],
    ],
  },
  'pipeline-pattern': {
    eyebrow: 'PIPELINE LAB', title: 'Request adım adım ilerliyor.', badge: 'STAGES',
    copy: 'Stage seç. Aynı request’in işlem hattındaki rolünü gör.',
    prompt: 'Stage',
    choices: [
      ['Validate', 'request doğru mu?', 'Girdi kontrol edilir.'],
      ['Enrich', 'eksik bilgi ekle', 'Request başka verilerle zenginleştirilir.'],
      ['Process + Save', 'iş kuralı -> persistence', 'Ana iş yapılır ve sonuç kaydedilir.'],
    ],
  },
  'shared-resources': {
    eyebrow: 'DATA OWNERSHIP LAB', title: 'Aynı tabloya kim yazıyor?', badge: 'SHARED DB / OWN DB',
    copy: 'Veri modelini seç. Coupling farkını gör.',
    prompt: 'Model',
    choices: [
      ['Order + Payment -> aynı tablo', 'Shared schema coupling', 'Bir schema değişikliği iki servisi birden etkileyebilir.'],
      ['Order -> Order DB', 'Order owns its data', 'Order verisinin değişim yetkisi Order Service’te.'],
      ['Payment -> Payment DB', 'Payment owns its data', 'Payment verisinin sahibi Payment Service.'],
    ],
  },
  'independent-deployment': {
    eyebrow: 'DEPLOY LAB', title: 'Sadece değişen servisi yayınla.', badge: 'v2 -> v3',
    copy: 'Hangi servis değiştiyse yalnız onu deploy edebilme hedefini gör.',
    prompt: 'Değişiklik',
    choices: [
      ['Payment v2 -> v3', 'Deploy Payment only', 'Contract uyumluysa Order/Catalog değişmez.'],
      ['Breaking API contract', 'Consumers etkilenebilir', 'Bağımsız deploy için contract compatibility önemlidir.'],
    ],
  },
  'microservice-principles': {
    eyebrow: 'PRINCIPLE LAB', title: 'İyi servis sınırı neyi korur?', badge: 'COUPLING / COHESION',
    copy: 'Problemi seç. Hangi microservice ilkesinin doğrudan etkilendiğini gör.',
    prompt: 'Durum',
    choices: [
      ['Payment, Order DB tablosuna doğrudan yazıyor', 'Loose coupling zayıflar', 'Payment artık Order schema değişikliklerine doğrudan bağımlı.'],
      ['Order servisi katalog + ödeme + kargo kuralını da içeriyor', 'High cohesion zayıflar', 'Birbiriyle farklı business capability’ler aynı sınırda toplanıyor.'],
      ['Payment DOWN ama Catalog çalışıyor', 'Fault isolation', 'Bir servisin hatası tüm sistemi gereksiz yere devirmiyor.'],
      ['Sadece Order trafiği 10 kat arttı', 'Independent scaling', 'Sadece yoğun servisin kapasitesini artırmak mümkün olabilir.'],
      ['Request nerede kayboldu bilinmiyor', 'Observability eksik', 'Trace/log/metric olmadan dağıtık akışı takip etmek zorlaşır.'],
    ],
  },
  'ddd-basics': {
    eyebrow: 'DDD LAB', title: 'Domain nesnesini doğru sınıfa koy.', badge: 'BOUNDED CONTEXT',
    copy: 'Kavramı seç. DDD içindeki rolünü Order örneği üzerinden gör.',
    prompt: 'Kavram',
    choices: [
      ['Order #42', 'Entity + Aggregate Root', 'Kimliği var; Order aggregate’inin dışarıya açılan ana giriş noktası.'],
      ['Money(100, TRY)', 'Value Object', 'Kimliği değil değeri önemlidir; tutar + para birimi birlikte anlam taşır.'],
      ['OrderRepository', 'Repository', 'Order aggregate’ini persistence detayından soyutlar.'],
      ['Order Context', 'Bounded Context', 'Order kavramlarının ve kurallarının anlam sınırı.'],
      ['“Sipariş onaylandı” ifadesi', 'Ubiquitous Language', 'Business ve developer aynı terimi aynı anlamda kullanır.'],
    ],
  },
  'devops-basics': {
    eyebrow: 'DELIVERY LOOP', title: 'Kod yazıldıktan sonra ne olur?', badge: 'BUILD / TEST / DEPLOY / MONITOR',
    copy: 'Teslim zincirindeki adımı seç. DevOps yaklaşımının hangi problemi azalttığını gör.',
    prompt: 'Adım',
    choices: [
      ['Her deploy elle yapılıyor', 'Automation eksik', 'Tekrarlanan manuel işlem hata ve süre maliyetini artırır.'],
      ['Production hatası ekibe saatler sonra geliyor', 'Feedback loop yavaş', 'Monitoring ve hızlı geri bildirim geliştirme döngüsüne bağlanmalı.'],
      ['Development ve operations ayrı hedeflerle çalışıyor', 'Collaboration zayıf', 'Teslim başarısı ortak sorumluluk olarak ele alınmalı.'],
    ],
  },
  'ci-basics': {
    eyebrow: 'CI GATE', title: 'Commit pipeline’a girdi.', badge: 'BUILD + TEST',
    copy: 'Pipeline sonucunu seç. CI hangi noktada akışı durdurmalı gör.',
    prompt: 'Pipeline sonucu',
    choices: [
      ['Build geçti, test geçti', 'CI PASS · package üret', 'Doğrulanan değişiklik sonraki aşamaya ilerleyebilir.'],
      ['Compile fail', 'CI FAIL · dur', 'Derlenmeyen koddan artifact üretmek doğru değildir.'],
      ['Test fail', 'CI FAIL · deploy yok', 'Hatalı değişiklik release aşamasına ilerlememeli.'],
    ],
  },
  'cd-basics': {
    eyebrow: 'RELEASE MODE', title: 'Delivery mi Deployment mı?', badge: 'CD',
    copy: 'Productiona geçiş politikasını seç. İki CD anlamını ayır.',
    prompt: 'Politika',
    choices: [
      ['Staging geçti, prod için insan onayı bekle', 'Continuous Delivery', 'Sürüm productiona hazır; son yayın kontrollü/manual olabilir.'],
      ['Tüm kalite kontrolleri geçti, prod otomatik yayınla', 'Continuous Deployment', 'Release politikası production deployunu otomatikleştiriyor.'],
    ],
  },
  'maven-artifact': {
    eyebrow: 'BUILD OUTPUT', title: 'Kaynak koddan deploy edilebilir sürüme.', badge: 'MAVEN / JAR',
    copy: 'Build adımını seç. Maven lifecycle içinde hangi çıktı oluşuyor gör.',
    prompt: 'Komut',
    choices: [
      ['mvn test', 'Testleri çalıştır', 'Henüz production artifact yayınlama adımı değildir.'],
      ['mvn package', 'JAR/WAR artifact üret', 'Packaging tipine göre deploy edilebilir build çıktısı oluşur.'],
      ['Aynı JAR staging -> prod', 'Immutable artifact', 'Ortama göre yeniden build yerine aynı doğrulanmış sürüm taşınır.'],
    ],
  },
  'docker-basics': {
    eyebrow: 'CONTAINER LAB', title: 'Image mı, container mı?', badge: 'DOCKER',
    copy: 'Parçayı seç. Build edilen image ile çalışan instance arasındaki farkı gör.',
    prompt: 'Parça',
    choices: [
      ['Dockerfile', 'Image tarifi', 'FROM/COPY/ENTRYPOINT gibi adımlarla image yapısını tanımlar.'],
      ['shop:1.4.2 image', 'Immutable paket', 'Registry’ye push edilip aynı içerikle farklı ortamlara çekilebilir.'],
      ['Çalışan shop container', 'Image instance + process', 'Image’dan başlatılmış çalışan uygulamadır.'],
    ],
  },
  'pipeline-as-code': {
    eyebrow: 'PIPELINE FILE', title: 'CI/CD akışını kod gibi versiyonla.', badge: 'JENKINS / ACTIONS / GITLAB',
    copy: 'Tool veya stage seç. İsimler değişse de pipeline prensibini gör.',
    prompt: 'Seçim',
    choices: [
      ['Jenkinsfile / workflow YAML', 'Pipeline as Code', 'Pipeline değişikliği repository geçmişi ve code review içine girer.'],
      ['SonarQube quality gate', 'Scan stage', 'Kod kalitesi/static analysis sonucu release akışını durdurabilir.'],
      ['Deploy job', 'Doğrulanmış artifact kullan', 'Deploy job source codeu yeniden farklı şekilde build etmemeli.'],
    ],
  },
  'cicd-secrets-config': {
    eyebrow: 'SECRET ROUTER', title: 'Aynı image, farklı ortam ayarı.', badge: 'CONFIG / SECRET',
    copy: 'Değeri seç. Repository’ye girebilen normal config ile gizli değeri ayır.',
    prompt: 'Değer',
    choices: [
      ['LOG_LEVEL=INFO', 'Normal configuration', 'Ortam değişkeni veya config dosyasıyla sağlanabilir.'],
      ['DB_PASSWORD', 'Secret manager / protected secret', 'Source code, Dockerfile veya pipeline loguna düz metin düşmemeli.'],
      ['shop:1.4.2', 'Aynı image', 'Test ve production farkını image yerine dış config belirleyebilir.'],
    ],
  },
  'deployment-rollback': {
    eyebrow: 'RELEASE SAFETY', title: 'Yeni sürümü ne kadar trafikle deneyeceksin?', badge: 'CANARY / BLUE-GREEN / ROLLBACK',
    copy: 'Release durumunu seç. Health sinyali bozulduğunda deployment kararını gör.',
    prompt: 'Senaryo',
    choices: [
      ['v2 önce %10 trafik', 'Canary', 'Sinyaller iyi ise rollout büyütülür.'],
      ['Blue aktif, Green yeni sürüm', 'Blue-Green', 'Yeni ortam doğrulandıktan sonra trafik switch edilebilir.'],
      ['v2 health DOWN', 'Rollback v1', 'Problemli release trafiği almadan veya hızla geri alınır.'],
    ],
  },
  rest: {
    eyebrow: 'REST CONTRACT LAB', title: 'Aynı path, farklı HTTP davranışı.', badge: 'METHOD + PATH',
    copy: 'İşlemi seç. Endpoint’i yalnız URL sanmanın neden eksik olduğunu gör.',
    prompt: 'İşlem',
    choices: [
      ['Ürün listesini oku', 'GET /products -> 200 OK', 'GET resource okumak için kullanılır; aynı path başka method ile başka davranış taşır.'],
      ['Yeni ürün oluştur', 'POST /products -> 201 Created', 'POST create davranışı ve 201 status ile ayrı contract oluşturur.'],
      ['Ürünü sil', 'DELETE /products/42 -> 204 No Content', 'Method + path birlikte endpoint davranışını tanımlar.'],
    ],
  },
  'database-acid': {
    eyebrow: 'ACID FAILURE LAB', title: 'İki update ortada kalırsa ne olur?', badge: 'ATOMICITY / ISOLATION',
    copy: 'Senaryoyu seç. Transaction özelliğinin hangi failure türünü engellemeye çalıştığını ayır.',
    prompt: 'Senaryo',
    choices: [
      ['Debit oldu, credit hata verdi', 'Atomicity -> rollback', 'İşin yarısı kalmamalı; transaction bütün adımları tek birim gibi ele alır.'],
      ['İki transaction aynı stoğu güncelliyor', 'Isolation / locking kararı', 'Concurrent transaction’ların birbirini nasıl gördüğü isolation seviyesiyle ilgilidir.'],
      ['İki işlem aynı eski değeri okuyup sırayla yazıyor', 'Lost update · optimistic/pessimistic locking düşün', 'İkinci write ilk değişikliği fark edilmeden ezebilir; concurrency kontrolü use-case’e göre seçilmelidir.'],
      ['Commit sonrası process çöktü', 'Durability', 'Commit edilmiş değişiklik kalıcı storage tarafından korunmalıdır.'],
    ],
  },
  repository: {
    eyebrow: 'QUERY BOUNDARY LAB', title: 'Service ne ister, Repository ne bilir?', badge: 'DATA ACCESS',
    copy: 'İhtiyacı seç. İş kuralı ile veri erişim detayını aynı class’a yığmamayı gör.',
    prompt: 'İhtiyaç',
    choices: [
      ['Aktif ürünleri ada göre getir', 'findByActiveTrueOrderByNameAsc()', 'Repository query contract’ı veri erişimini ifade eder.'],
      ['İndirim yüzdesini hesapla', 'Service / domain rule', 'Bu business davranışı repository sorumluluğu değildir.'],
      ['Karmaşık rapor sorgusu', '@Query / custom repository', 'Derived method adı okunamaz hale geliyorsa açık query daha doğru olabilir.'],
    ],
  },
  relations: {
    eyebrow: 'RELATION OWNERSHIP LAB', title: 'İlişkiyi kim sahipleniyor?', badge: '@OneToMany',
    copy: 'Mapping durumunu seç. mappedBy, fetch ve cascade kararlarının farklı problemleri çözdüğünü ayır.',
    prompt: 'Karar',
    choices: [
      ['mappedBy="order"', 'Child taraf relation owner', 'mappedBy karşı taraftaki owning field’i işaret eder; ekstra join table ihtiyacını etkileyebilir.'],
      ['LAZY collection', 'İhtiyaç anına kadar yüklemeyi ertele', 'LAZY her zaman performans çözümü değildir; access pattern ve transaction sınırı önemlidir.'],
      ['cascade = ALL', 'Persistence işlemlerini child’a yay', 'Cascade fetch stratejisi değildir; persist/remove gibi işlemlerin yayılımını yönetir.'],
    ],
  },
  mockito: {
    eyebrow: 'MOCK BEHAVIOR LAB', title: 'Dependency’yi kontrol et, Service davranışını test et.', badge: '@Mock / verify',
    copy: 'Test niyetini seç. Stub ile verification farkını gör.',
    prompt: 'Test adımı',
    choices: [
      ['when(repo.findById(42)).thenReturn(product)', 'Stub', 'Dependency çağrıldığında kontrollü test verisi döndürür.'],
      ['service.get(42)', 'System under test çalışır', 'Gerçek test hedefi Service davranışıdır; repository mock olarak izole edilir.'],
      ['verify(repo).findById(42)', 'Interaction verification', 'Belirli dependency çağrısının gerçekleştiğini doğrular; her testte şart değildir.'],
    ],
  },
  'test-strategy': {
    eyebrow: 'TEST LAYER LAB', title: 'Her şeyi integration test yapmak gerekmez.', badge: 'UNIT / SLICE / INTEGRATION',
    copy: 'Riski seç. En dar ama yeterli test katmanını seçmeyi öğren.',
    prompt: 'Risk',
    choices: [
      ['Saf fiyat hesaplama kuralı', 'Unit test', 'Spring context açmadan hızlı ve izole davranış testi yeterli olabilir.'],
      ['Controller status + JSON mapping', 'MVC slice / MockMvc', 'HTTP mapping katmanını dar context ile test etmek uygundur.'],
      ['JPA mapping + gerçek DB davranışı', 'Integration test', 'Birden fazla gerçek bileşen ve database davranışı birlikte doğrulanmalıdır.'],
    ],
  },
  sdlc: {
    eyebrow: 'LIFECYCLE LAB', title: 'Kod yazmadan önce ve deploy’dan sonra da iş var.', badge: 'SDLC',
    copy: 'Problemi seç. Lifecycle’ın hangi aşamasında geri dönüp yeni bilgi üretmen gerektiğini gör.',
    prompt: 'Durum',
    choices: [
      ['Acceptance criteria belirsiz', 'Requirement / analysis', 'Yanlış problemi doğru kodlamak yerine önce beklenen davranışı netleştir.'],
      ['Load test başarısız', 'Design / implementation geri beslemesi', 'Test sonucu tasarım ve kod kararlarını yeniden değerlendirmeye dönebilir.'],
      ['Production’da yeni hata', 'Maintenance -> feedback', 'Lifecycle deploy ile bitmez; support ve öğrenme backlog’a döner.'],
    ],
  },
  'agile-scrum': {
    eyebrow: 'SCRUM EVENT LAB', title: 'Review ile Retrospective aynı toplantı değil.', badge: 'FEEDBACK',
    copy: 'İhtiyacı seç. Hangi Scrum event’inin hangi soruyu çözmeye çalıştığını ayır.',
    prompt: 'İhtiyaç',
    choices: [
      ['Stakeholder ürünü görüp feedback versin', 'Sprint Review', 'Increment ve ürün yönü değerlendirilir.'],
      ['Takım çalışma şeklini iyileştirsin', 'Retrospective', 'Process, collaboration ve iyileştirme aksiyonlarına odaklanır.'],
      ['Sprint hedefi ve seçilecek işler planlansın', 'Sprint Planning', 'Sprint Goal ve yaklaşım oluşturulur.'],
    ],
  },
  'documentation-troubleshooting': {
    eyebrow: 'INCIDENT NARROWING LAB', title: 'Rastgele restart değil, kanıtla daralt.', badge: 'ROOT CAUSE',
    copy: 'Bir production incident’ında sıradaki hamleyi seç. Semptomdan root cause’a giden kanıt zincirini gör.',
    prompt: 'Kanıt',
    choices: [
      ['Kullanıcı: “sipariş oluşmadı”', 'Zaman + request/correlation id al', 'Önce arama alanını daraltacak somut gözlem gerekir.'],
      ['500 spike release sonrası başladı', 'Recent change + logs + traces karşılaştır', 'Hipotezi deploy/config değişikliğine bağlayacak kanıt topla.'],
      ['Root cause doğrulandı', 'Fix + regression test + runbook/ADR', 'Geçici çözümden sonra geri dönüşü engelle ve bilgiyi kalıcılaştır.'],
    ],
  },
  'git-workflow': {
    eyebrow: 'COLLABORATION GATE', title: 'Branch yalnız paralel kod yazmak için değil.', badge: 'PR + CI',
    copy: 'Durumu seç. Review, conflict ve history kararlarını ekip güvenliği açısından değerlendir.',
    prompt: 'Durum',
    choices: [
      ['Feature hazır', 'Pull Request -> review -> CI -> merge', 'Değişiklik ana dala girmeden otomatik ve insan kontrollerinden geçebilir.'],
      ['Merge conflict çıktı', 'İki değişikliğin niyetini birleştir', 'Current/incoming seçeneğine rastgele basmak doğru çözüm değildir.'],
      ['Paylaşılan branch’e force push', 'History rewrite riski', 'Takımın gördüğü commit geçmişini bozabileceği için dikkat gerekir.'],
    ],
  },
  'microservice-resilience': {
    eyebrow: 'FAILURE CONTROL LAB', title: 'Yavaş dependency tüm sistemi sürüklemesin.', badge: 'TIMEOUT / RETRY / BREAKER',
    copy: 'Failure tipini seç. Her resilience aracının farklı problemi hedeflediğini ayır.',
    prompt: 'Failure',
    choices: [
      ['Payment 20 saniye cevap vermiyor', 'Timeout', 'Caller sonsuza kadar beklemez; kaynak tüketimi sınırlandırılır.'],
      ['Geçici network hatası', 'Sınırlı retry + backoff', 'Retry her hataya uygulanmaz; idempotency ve load etkisi düşünülür.'],
      ['Payment sürekli DOWN', 'Circuit breaker fail-fast', 'Sürekli başarısız çağrıları geçici keserek cascading failure riskini azaltır.'],
    ],
  },
  'service-discovery-load-balancing': {
    eyebrow: 'INSTANCE ROUTER LAB', title: 'Logical service name’den sağlıklı instance’a.', badge: 'DISCOVERY / LB',
    copy: 'Altyapı olayını seç. Discovery ve load balancing görevlerini ayır.',
    prompt: 'Olay',
    choices: [
      ['P2 instance öldü', 'Discovery/health listeden çıkar', 'Caller artık down instance adresine gitmemeli.'],
      ['P4 scale ile eklendi', 'Registry/DNS endpoint seti güncellenir', 'Caller sabit IP listesine bağlı kalmaz.'],
      ['100 request geldi', 'Load balancer sağlıklı instance’lara dağıtır', 'Discovery adresi bulur; load balancing trafik seçimi yapar.'],
    ],
  },
  'react-basics': {
    eyebrow: 'REACT STATE LAB', title: 'Props input, state yaşayan UI verisi.', badge: 'props / state / effect',
    copy: 'Değişikliği seç. Hangi React kavramının devreye girdiğini gör.',
    prompt: 'Değişiklik',
    choices: [
      ['Parent productId gönderiyor', 'props', 'Child için read-only input olarak taşınır.'],
      ['Loading true -> false', 'state', 'Zaman içinde değişen UI verisi setter ile güncellenir.'],
      ['API çağrısı başlat', 'useEffect / event boundary', 'External system senkronizasyonu için effect gerekebilir; her hesaplama effect değildir.'],
    ],
  },
  'python-basics': {
    eyebrow: 'JAVA / PYTHON BRIDGE', title: 'Aynı fikir, farklı syntax ve type modeli.', badge: 'LANGUAGE AWARENESS',
    copy: 'Kod niyetini seç. Java bilgisini Python karşılığına bağla.',
    prompt: 'Niyet',
    choices: [
      ['String listesi', 'list[str]', 'Python type hint runtime enforcement değildir ama intent ve tooling sağlar.'],
      ['Key/value yapı', 'dict[str, int]', 'Java Map benzeri mapping yapısı.'],
      ['Null benzeri değer', 'None', 'Optional kullanım biçimi ve nullability yaklaşımı Java’dan farklıdır.'],
    ],
  },
  'enterprise-quality-compliance': {
    eyebrow: 'QUALITY GATE LAB', title: '“Çalışıyor” enterprise kalite için yetmez.', badge: 'STANDARD / COMPLIANCE',
    copy: 'Değişikliği seç. Hangi kanıtın release öncesi gerekli olduğunu gör.',
    prompt: 'Değişiklik',
    choices: [
      ['Ödeme kodu değişti', 'Code review + tests + audit/security checks', 'Riskli business alanında izlenebilir kalite kapıları gerekir.'],
      ['Secret loga düştü', 'Release block + credential rotation', 'Functional test geçse bile security/compliance ihlali release’i durdurmalıdır.'],
      ['Standart ihlali var', 'Static analysis / quality gate', 'Takım ve sektör standartları otomasyonla görünür hale getirilebilir.'],
    ],
  },
  'stakeholder-collaboration': {
    eyebrow: 'REQUIREMENT ROOM', title: 'Belirsiz cümleyi test edilebilir contract’a çevir.', badge: 'BA / PO',
    copy: 'Requirement cümlesini seç. Developer’ın hangi soruyu sorması gerektiğini gör.',
    prompt: 'Belirsizlik',
    choices: [
      ['“Hızlı olmalı”', 'Hangi latency hedefi ve yük altında?', 'Ölçülebilir acceptance criteria olmadan performans hedefi test edilemez.'],
      ['“Yetkili kullanıcı görebilsin”', 'Hangi roller, hangi resource, hangi edge case?', 'Authorization kuralı business tarafıyla netleşmelidir.'],
      ['“Sipariş iptal edilsin”', 'Hangi statülerde, ödeme/iade ne olacak?', 'Happy path dışında business state transition’ları netleştirilmelidir.'],
    ],
  },
  'delivery-prioritization': {
    eyebrow: 'PRIORITY BOARD', title: 'Her iş aynı anda P1 olamaz.', badge: 'VALUE / RISK / DEPENDENCY',
    copy: 'İşi seç. Önceliği yalnız talep sırasına göre değil etki ve riskle düşün.',
    prompt: 'İş',
    choices: [
      ['Production ödeme hatası', 'Yüksek kullanıcı etkisi + acil incident', 'Scope daraltılıp hızlı mitigation/fix önceliklendirilebilir.'],
      ['Yeni dashboard filtresi', 'Planlanabilir product value', 'Urgency ve dependency düşükse sprint planına alınabilir.'],
      ['Başka ekip API’sine bağlı feature', 'Dependency riski', 'Teslim tarihini dependency readiness ve fallback planıyla değerlendir.'],
    ],
  },
  'existing-app-support': {
    eyebrow: 'SAFE CHANGE LAB', title: 'Mevcut sistemi düzeltirken yeni hata üretme.', badge: 'SUPPORT',
    copy: 'Support senaryosunu seç. Kanıt, backward compatibility ve regression yaklaşımını bağla.',
    prompt: 'Senaryo',
    choices: [
      ['Eski client yeni response’u parse edemiyor', 'Backward compatibility kontrolü', 'Contract değişikliği mevcut consumer’ları kırabilir.'],
      ['Production bug yeniden üretildi', 'Minimal fix + regression test', 'Aynı failure’ın dönmesini test ile kilitle.'],
      ['Riskli hotfix gerekli', 'Rollback/feature flag planı', 'Hızlı değişiklikte geri dönüş yolu hazır olmalıdır.'],
    ],
  },
  'technology-evaluation': {
    eyebrow: 'TECH DECISION LAB', title: 'Hype değil problem ve kanıt.', badge: 'ADR / POC',
    copy: 'Yeni teknoloji talebini seç. Sağlıklı değerlendirme sırasını gör.',
    prompt: 'Durum',
    choices: [
      ['“Kafka kullanalım, popüler”', 'Önce problem + success metric', 'Tool seçmeden throughput, ordering, durability gibi ihtiyacı tanımla.'],
      ['İki aday çözüm var', 'POC + operability/security/cost karşılaştır', 'Benchmark tek başına production fit göstermez.'],
      ['Karar verildi', 'ADR ile rationale kaydet', 'Gelecekte neden bu trade-off’un seçildiği anlaşılır.'],
    ],
  },
  'behavioral-star': {
    eyebrow: 'STAR BUILDER', title: 'Genel sıfat değil, kanıtlı davranış.', badge: 'S / T / A / R',
    copy: 'Cevap parçasını seç. Mülakatta hangi bölümün neyi kanıtladığını gör.',
    prompt: 'Parça',
    choices: [
      ['Release sonrası 500 spike oldu', 'Situation', 'Yalnız gerekli context ver; hikâyeyi uzatma.'],
      ['Trace ettim, query’yi izole edip rollback yaptım', 'Action', 'Senin analitik ve teknik katkını somut gösterir.'],
      ['Error rate normale döndü, regression test eklendi', 'Result', 'Sonuç ve kalıcı iyileştirmeyi kanıtlar.'],
    ],
  },
}

function DecisionLab({ lesson }) {
  const experiment = labExperiments[lesson.id]
  const [picked, setPicked] = useState(0)

  useEffect(() => setPicked(0), [lesson.id])

  if (!experiment) {
    return (
      <LabShell eyebrow="KONU LAB" title={lesson.title} copy="Bu dersteki ana fikri kod ve sonuç üzerinden incele." badge={lesson.id}>
        <div className="lesson-specific-lab">
          <div className="lab-question"><small>BU DERSTE</small><strong>{lesson.hook}</strong></div>
          <div className="lab-code-snapshot"><small>KOD / MODEL</small><pre><code>{lesson.code}</code></pre></div>
        </div>
      </LabShell>
    )
  }

  const current = experiment.choices[picked] ?? experiment.choices[0]
  return (
    <LabShell eyebrow={experiment.eyebrow} title={experiment.title} copy={experiment.copy} badge={experiment.badge}>
      <div className="decision-lab">
        <div className="decision-picker">
          <small>{experiment.prompt}</small>
          {experiment.choices.map((choice, index) => (
            <button key={choice[0]} className={picked === index ? 'active' : ''} onClick={() => setPicked(index)}>
              <span>{String(index + 1).padStart(2, '0')}</span><strong>{choice[0]}</strong>
            </button>
          ))}
        </div>
        <motion.div key={`${lesson.id}-${picked}`} className="decision-output" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
          <small>SONUÇ</small>
          <code>{current[1]}</code>
          <p>{current[2]}</p>
        </motion.div>
      </div>
    </LabShell>
  )
}

function MonolithMicroserviceLab() {
  const [mode, setMode] = useState('monolith')
  const [scenario, setScenario] = useState('deploy')
  const reduced = useReducedMotion()

  const isMonolith = mode === 'monolith'
  const deployScenario = scenario === 'deploy'
  const result = isMonolith
    ? deployScenario
      ? ['TEK DEPLOY UNIT', 'Payment kodu değiştiğinde aynı application artifact’i yeniden deploy edilir.', 'Basit operasyon; bağımsız deploy yok.']
      : ['TEK PROCESS', 'Application process çökerse Catalog, Order ve Payment birlikte erişilemez olabilir.', 'Failure boundary geniş.']
    : deployScenario
      ? ['BAĞIMSIZ DEPLOY', 'Payment Service tek başına yeni sürüme çıkabilir; uyumlu contract varsayımıyla diğer servislerin deploy edilmesi gerekmez.', 'Değişim alanı daralır.']
      : ['DAR FAILURE BOUNDARY', 'Payment Service düşse bile Catalog ve Order process’leri çalışmaya devam edebilir.', 'Payment’a senkron bağımlı akış yine timeout/failure yaşayabilir.']

  return (
    <LabShell eyebrow="ARCHITECTURE LAB" title="Aynı sistemi iki mimaride çalıştır." copy="Mimariyi ve senaryoyu değiştir. Deploy birimi ile failure boundary farkını gözünle gör." badge="MONOLITH / MICROSERVICE">
      <div className="architecture-controls">
        <div>
          <small>MİMARİ</small>
          <div className="architecture-switch">
            <button type="button" className={isMonolith ? 'active' : ''} onClick={() => setMode('monolith')}>Monolith</button>
            <button type="button" className={!isMonolith ? 'active' : ''} onClick={() => setMode('microservices')}>Microservices</button>
          </div>
        </div>
        <div>
          <small>SENARYO</small>
          <div className="architecture-switch">
            <button type="button" className={deployScenario ? 'active' : ''} onClick={() => setScenario('deploy')}>Payment deploy</button>
            <button type="button" className={!deployScenario ? 'active' : ''} onClick={() => setScenario('failure')}>Process failure</button>
          </div>
        </div>
      </div>

      <motion.div key={`${mode}-${scenario}`} className={`architecture-stage ${mode}`} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {isMonolith ? (
          <div className={`monolith-unit ${!deployScenario ? 'failed' : ''}`}>
            <div className="architecture-unit-head"><small>DEPLOY UNIT</small><strong>commerce-app.jar</strong></div>
            <div className="monolith-modules">
              {['Catalog', 'Order', 'Payment'].map((name) => <div key={name} className={name === 'Payment' ? 'hot' : ''}><small>MODULE</small><strong>{name}</strong></div>)}
            </div>
            <div className="architecture-db">SHARED APPLICATION DB</div>
          </div>
        ) : (
          <div className="microservice-units">
            {[
              ['Catalog', 'catalog-db'],
              ['Order', 'order-db'],
              ['Payment', 'payment-db'],
            ].map(([name, db]) => (
              <div key={name} className={`microservice-unit ${name === 'Payment' ? 'hot' : ''} ${name === 'Payment' && !deployScenario ? 'failed' : ''}`}>
                <small>DEPLOY UNIT</small><strong>{name} Service</strong><code>{db}</code>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <div className="architecture-result">
        <small>{result[0]}</small>
        <strong>{result[1]}</strong>
        <p>{result[2]}</p>
      </div>
    </LabShell>
  )
}

function SynchronousCommunicationLab() {
  const [paymentState, setPaymentState] = useState('fast')
  const [timeoutMs, setTimeoutMs] = useState(2000)
  const [runId, setRunId] = useState(0)
  const [phase, setPhase] = useState('idle')
  const reduced = useReducedMotion()

  const paymentLatency = paymentState === 'fast' ? 200 : paymentState === 'slow' ? 3500 : Infinity
  const succeeds = paymentLatency <= timeoutMs
  const running = phase === 'order' || phase === 'waiting'

  const selectPaymentState = (nextState) => {
    setPaymentState(nextState)
    setPhase('idle')
  }

  const selectTimeout = (nextTimeout) => {
    setTimeoutMs(nextTimeout)
    setPhase('idle')
  }

  useEffect(() => {
    if (runId === 0) return undefined

    setPhase('order')
    const waitTimer = window.setTimeout(() => setPhase('waiting'), reduced ? 80 : 420)
    const finishTimer = window.setTimeout(
      () => setPhase(succeeds ? 'success' : 'timeout'),
      reduced ? 180 : 1500,
    )

    return () => {
      window.clearTimeout(waitTimer)
      window.clearTimeout(finishTimer)
    }
  }, [runId, reduced])

  const outcome = phase === 'idle'
    ? ['HAZIR', 'Request henüz gönderilmedi.', 'Order Service, Payment cevabını bekleyen senkron çağrı yapacak.']
    : phase === 'order'
      ? ['ORDER SERVICE', 'POST /orders alındı. Ödeme doğrulaması gerekiyor.', 'Order şimdi Payment Service’e HTTP request gönderiyor.']
      : phase === 'waiting'
        ? ['BLOCKING WAIT', `Order, Payment cevabını en fazla ${timeoutMs}ms bekliyor.`, 'Bu süre boyunca bu iş akışı Payment dependency’sine bağlı.']
        : phase === 'success'
          ? ['RESPONSE GELDİ', `Payment ${paymentLatency}ms içinde 200 OK döndü. Order devam ediyor.`, 'Senkron akış basit; dependency yeterince hızlı ve erişilebilirken sonuç doğrudan alınır.']
          : paymentState === 'down'
            ? ['DEPENDENCY FAILURE', 'Payment Service erişilemiyor. Order ödeme adımını tamamlayamıyor.', 'Connection error/timeout yönetilmezse uzak servisteki hata Order akışını da başarısız eder.']
            : ['TIMEOUT', `Payment ${paymentLatency}ms sürüyor ama Order ${timeoutMs}ms sonra beklemeyi bıraktı.`, 'Timeout sonsuz beklemeyi önler; fakat business işlemi yine tamamlanmadı. Retry/fallback ayrıca tasarlanmalıdır.']

  return (
    <LabShell eyebrow="SYNC COMMUNICATION LAB" title="Order, Payment cevabını beklesin." copy="Payment hızını ve timeout sınırını değiştir. Aynı HTTP çağrısının ne zaman başarıya, ne zaman failure’a dönüştüğünü gör." badge="HTTP · SYNC">
      <div className="sync-controls">
        <div>
          <small>PAYMENT SERVICE</small>
          <div className="sync-switch three">
            <button type="button" disabled={running} className={paymentState === 'fast' ? 'active' : ''} onClick={() => selectPaymentState('fast')}>200ms</button>
            <button type="button" disabled={running} className={paymentState === 'slow' ? 'active warning' : ''} onClick={() => selectPaymentState('slow')}>3500ms</button>
            <button type="button" disabled={running} className={paymentState === 'down' ? 'active danger' : ''} onClick={() => selectPaymentState('down')}>DOWN</button>
          </div>
        </div>
        <div>
          <small>ORDER TIMEOUT</small>
          <div className="sync-switch">
            <button type="button" disabled={running} className={timeoutMs === 2000 ? 'active' : ''} onClick={() => selectTimeout(2000)}>2000ms</button>
            <button type="button" disabled={running} className={timeoutMs === 5000 ? 'active' : ''} onClick={() => selectTimeout(5000)}>5000ms</button>
          </div>
        </div>
        <button type="button" className="sync-run" disabled={running} onClick={() => setRunId((value) => value + 1)}>
          {running ? 'Request çalışıyor…' : 'POST /orders gönder'}
        </button>
      </div>

      <div className={`sync-stage phase-${phase}`}>
        <div className="sync-service client-service"><small>CLIENT</small><strong>Checkout</strong><code>POST /orders</code></div>
        <div className={`sync-link ${phase !== 'idle' ? 'live' : ''}`}><span>HTTP</span><i /></div>
        <div className={`sync-service order-service ${phase === 'waiting' ? 'waiting' : ''}`}><small>SERVICE</small><strong>Order</strong><code>{phase === 'waiting' ? `WAIT ≤ ${timeoutMs}ms` : 'order-service:8081'}</code></div>
        <div className={`sync-link dependency-link ${phase === 'waiting' ? 'live' : ''} ${phase === 'timeout' ? 'failed' : ''}`}><span>POST /payments</span><i /></div>
        <motion.div
          key={`${paymentState}-${runId}`}
          className={`sync-service payment-service ${paymentState === 'down' ? 'down' : ''}`}
          initial={reduced ? false : { opacity: .55, scale: .97 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <small>DEPENDENCY</small><strong>Payment</strong><code>{paymentState === 'down' ? 'UNREACHABLE' : `${paymentLatency}ms response`}</code>
        </motion.div>
      </div>

      <div className={`sync-result ${phase === 'timeout' ? 'failed' : phase === 'success' ? 'success' : ''}`}>
        <small>{outcome[0]}</small>
        <strong>{outcome[1]}</strong>
        <p>{outcome[2]}</p>
      </div>

      <div className="interview-script">
        <small>MÜLAKATTA BÖYLE ANLAT</small>
        <p><b>1.</b> “Senkron çağrıda Order, Payment response’unu bekler.”</p>
        <p><b>2.</b> “Payment yavaşlarsa Order latency’si de artar; erişilemezse request failure’a gidebilir.”</p>
        <p><b>3.</b> “Bu yüzden timeout koyarım. Retry kullanacaksam idempotency ve retry storm riskini de düşünürüm.”</p>
      </div>
    </LabShell>
  )
}

function SystemDesignInterviewLab() {
  const [entry, setEntry] = useState('gateway')
  const [communication, setCommunication] = useState('sync')
  const [data, setData] = useState('owned')
  const reduced = useReducedMotion()

  const communicationText = communication === 'sync'
    ? 'Order, Payment sonucunu aynı request akışında bekler. Basit akış; timeout ve dependency failure yönetilmelidir.'
    : 'Order event yayınlar, Payment daha sonra tüketir. Temporal coupling azalır; eventual consistency ve idempotency gerekir.'
  const dataText = data === 'owned'
    ? 'Order ve Payment kendi verisinin sahibi. Schema coupling azalır; servisler arası veri paylaşımı API/event ister.'
    : 'İki servis aynı DB şemasına doğrudan bağlı. Başlangıçta kolay; bağımsız değişim ve ownership zayıflar.'
  const entryText = entry === 'gateway'
    ? 'Client tek giriş noktasını bilir; routing/auth gibi ortak işler Gateway’de toplanabilir.'
    : 'Client servis adreslerini doğrudan bilir. Küçük sistemde basit olabilir; client/backend coupling artabilir.'

  return (
    <LabShell eyebrow="INTERVIEW SIMULATOR" title="Bir e-ticaret sipariş sistemi tasarla." copy="Tek doğru cevap yok. Kararı seç, sonra mülakatta hangi trade-off’u söylemen gerektiğini gör." badge="SYSTEM DESIGN">
      <div className="design-interview-controls">
        <div>
          <small>01 · CLIENT GİRİŞİ</small>
          <div className="architecture-switch">
            <button type="button" className={entry === 'gateway' ? 'active' : ''} onClick={() => setEntry('gateway')}>API Gateway</button>
            <button type="button" className={entry === 'direct' ? 'active' : ''} onClick={() => setEntry('direct')}>Direct</button>
          </div>
        </div>
        <div>
          <small>02 · ORDER → PAYMENT</small>
          <div className="architecture-switch">
            <button type="button" className={communication === 'sync' ? 'active' : ''} onClick={() => setCommunication('sync')}>HTTP / Sync</button>
            <button type="button" className={communication === 'async' ? 'active' : ''} onClick={() => setCommunication('async')}>Event / Async</button>
          </div>
        </div>
        <div>
          <small>03 · DATA OWNERSHIP</small>
          <div className="architecture-switch">
            <button type="button" className={data === 'owned' ? 'active' : ''} onClick={() => setData('owned')}>DB per service</button>
            <button type="button" className={data === 'shared' ? 'active' : ''} onClick={() => setData('shared')}>Shared DB</button>
          </div>
        </div>
      </div>

      <motion.div key={`${entry}-${communication}-${data}`} className="system-design-stage" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="design-client">CLIENT</div>
        <div className="design-arrow">↓</div>
        {entry === 'gateway' && <div className="design-gateway">API GATEWAY</div>}
        {entry === 'gateway' && <div className="design-arrow">↓</div>}
        <div className="design-services">
          <div className="design-service"><small>SERVICE</small><strong>Order</strong><code>{data === 'owned' ? 'Order DB' : 'Shared DB'}</code></div>
          <div className={`design-link ${communication}`}><small>{communication === 'sync' ? 'HTTP · WAIT' : 'EVENT · BROKER'}</small><span>→</span></div>
          <div className="design-service"><small>SERVICE</small><strong>Payment</strong><code>{data === 'owned' ? 'Payment DB' : 'Shared DB'}</code></div>
        </div>
        <div className="design-observability">OBSERVABILITY · logs + metrics + traces</div>
      </motion.div>

      <div className="design-tradeoffs">
        <div><small>ENTRY</small><p>{entryText}</p></div>
        <div><small>COMMUNICATION</small><p>{communicationText}</p></div>
        <div><small>DATA</small><p>{dataText}</p></div>
      </div>

      <div className="interview-script">
        <small>MÜLAKATTA BÖYLE İLERLE</small>
        <p><b>1.</b> “Önce requirement’ları netleştiririm: ödeme sonucu anında gerekli mi, trafik ve tutarlılık beklentisi nedir?”</p>
        <p><b>2.</b> “Order ve Payment’ı business capability sınırlarına göre ayırıyorum.”</p>
        <p><b>3.</b> “İletişim için <strong>{communication === 'sync' ? 'senkron HTTP' : 'asenkron event'}</strong> seçtim; çünkü bu senaryoda …”</p>
        <p><b>4.</b> “Son olarak timeout/retry/idempotency ve observability failure senaryolarını ele alırım.”</p>
      </div>
    </LabShell>
  )
}

function CiCdInterviewLab() {
  const [testsPass, setTestsPass] = useState(true)
  const [releaseMode, setReleaseMode] = useState('manual')
  const [strategy, setStrategy] = useState('canary')
  const [approved, setApproved] = useState(false)
  const reduced = useReducedMotion()

  useEffect(() => setApproved(false), [testsPass, releaseMode])

  const waitingApproval = testsPass && releaseMode === 'manual' && !approved
  const deployed = testsPass && (releaseMode === 'auto' || approved)
  const stages = [
    ['COMMIT', 'pass'],
    ['BUILD', 'pass'],
    ['TEST', testsPass ? 'pass' : 'fail'],
    ['PACKAGE', !testsPass ? 'blocked' : 'pass'],
    ['IMAGE', !testsPass ? 'blocked' : 'pass'],
    ['RELEASE GATE', !testsPass ? 'blocked' : waitingApproval ? 'wait' : 'pass'],
    ['PROD', deployed ? 'pass' : 'blocked'],
    ['HEALTH', deployed ? 'pass' : 'blocked'],
  ]

  const result = !testsPass
    ? 'Test başarısız. Pipeline release aşamasına ilerlemiyor.'
    : waitingApproval
      ? 'Artifact hazır. Continuous Delivery akışı production onayı bekliyor.'
      : `Production deploy aktif. Strateji: ${strategy === 'canary' ? 'Canary' : 'Blue-Green'}. Health sinyali izlenmeli.`

  return (
    <LabShell eyebrow="CI/CD INTERVIEW SIMULATOR" title="Committen productiona güvenli pipeline tasarla." copy="Test sonucunu, release politikasını ve deployment stratejisini değiştir. Pipeline’ın neden ilerlediğini veya durduğunu açıklamayı prova et." badge="CI/CD">
      <div className="cicd-controls">
        <div>
          <small>01 · TEST RESULT</small>
          <div className="architecture-switch">
            <button type="button" className={testsPass ? 'active' : ''} onClick={() => setTestsPass(true)}>PASS</button>
            <button type="button" className={!testsPass ? 'active danger' : ''} onClick={() => setTestsPass(false)}>FAIL</button>
          </div>
        </div>
        <div>
          <small>02 · RELEASE MODE</small>
          <div className="architecture-switch">
            <button type="button" className={releaseMode === 'manual' ? 'active' : ''} onClick={() => setReleaseMode('manual')}>Manual approval</button>
            <button type="button" className={releaseMode === 'auto' ? 'active' : ''} onClick={() => setReleaseMode('auto')}>Auto deploy</button>
          </div>
        </div>
        <div>
          <small>03 · DEPLOY STRATEGY</small>
          <div className="architecture-switch">
            <button type="button" className={strategy === 'canary' ? 'active' : ''} onClick={() => setStrategy('canary')}>Canary</button>
            <button type="button" className={strategy === 'blue-green' ? 'active' : ''} onClick={() => setStrategy('blue-green')}>Blue-Green</button>
          </div>
        </div>
      </div>

      <motion.div key={`${testsPass}-${releaseMode}-${strategy}-${approved}`} className="cicd-stage" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {stages.map(([label, status], index) => (
          <div key={label} className={`cicd-stage-item ${status}`}>
            <small>{String(index + 1).padStart(2, '0')}</small>
            <strong>{label}</strong>
            <span>{status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : status === 'wait' ? 'WAIT' : 'BLOCKED'}</span>
          </div>
        ))}
      </motion.div>

      {waitingApproval && <button type="button" className="cicd-approve" onClick={() => setApproved(true)}>Production onayı ver</button>}

      <div className="cicd-result">
        <small>PIPELINE KARARI</small>
        <strong>{result}</strong>
        <p>{deployed ? `Deploy sonrası health/metrics kötüleşirse ${strategy === 'canary' ? 'canary rollout durdurulur ve önceki sürüme dönülür.' : 'trafik eski Blue ortama çevrilerek rollback yapılabilir.'}` : 'Deploy edilmemiş sürüm production trafiği almıyor.'}</p>
      </div>

      <div className="interview-script">
        <small>MÜLAKATTA BÖYLE ANLAT</small>
        <p><b>1.</b> “Commit/pull request pipeline’ı tetikler; önce build ve test çalıştırırım.”</p>
        <p><b>2.</b> “Test fail olursa pipeline’ı durdururum; hatalı artifact productiona ilerlemez.”</p>
        <p><b>3.</b> “Başarılı build’den tek sürümlü artifact/image üretip staging ve production boyunca aynı çıktıyı taşırım.”</p>
        <p><b>4.</b> “Production geçişini policy’ye göre approval veya otomatik gate ile yönetir, deploy sonrası health/metrics izler ve rollback planı tutarım.”</p>
      </div>
    </LabShell>
  )
}

function LessonLab({ lesson }) {
  if (processScenarios[lesson.id] || architectureScenarios[lesson.id]) return <ProcessScenarioLab key={lesson.id} lesson={lesson} />
  if (lesson.id === 'java-class') return <ObjectFactoryLab />
  if (lesson.id === 'methods-constructor') return <ConstructorLab />
  if (lesson.id === 'interface') return <InterfaceLab />
  if (lesson.id === 'annotation-basics') return <AnnotationLab />
  if (lesson.id === 'generics-record') return <JavaTypeSystemLab />
  if (lesson.id === 'java-oop') return <OopPrinciplesLab />
  if (lesson.id === 'java-overload-override') return <DispatchTimingLab />
  if (lesson.id === 'java-abstract-composition') return <TypeRelationshipLab />
  if (lesson.id === 'java-hashmap') return <HashMapBucketLab />
  if (lesson.id === 'java-concurrency') return <RaceConditionLab />
  if (lesson.id === 'http-basics') return <HttpLab />
  if (lesson.id === 'annotations') return <AnnotationLab spring />
  if (lesson.id === 'beans') return <BeanLab />
  if (lesson.id === 'ioc-di') return <DiLab />
  if (lesson.id === 'dto') return <DtoValidationLab />
  if (lesson.id === 'validation') return <DtoValidationLab validation />
  if (lesson.id === 'transactions') return <TransactionLab />
  if (lesson.id === 'spring-aop-proxy') return <AopProxyLab />
  if (lesson.id === 'jpa-basics') return <JpaPersistenceLab />
  if (lesson.id === 'pagination') return <NPlusOneLab />
  if (lesson.id === 'sql-joins') return <SqlJoinLab />
  if (lesson.id === 'request-flow') return <RequestLab />
  if (lesson.id === 'test-strategy') return <TestPlanLab />
  if (lesson.id === 'sdlc') return <SdlcJourneyLab />
  if (lesson.id === 'monolith-microservices') return <MonolithMicroserviceLab />
  if (lesson.id === 'sync-communication') return <SynchronousCommunicationLab />
  if (['async-messaging', 'api-gateway-proxy', 'aggregator-pattern', 'pipeline-pattern', 'shared-resources'].includes(lesson.id)) return <MicroservicePatternLab kind={lesson.id} />
  if (lesson.id === 'distributed-consistency') return <SagaConsistencyLab />
  if (lesson.id === 'ddd-services') return <DddServicesLab />
  if (lesson.id === 'kubernetes-basics') return <KubernetesLab />
  if (lesson.id === 'ci-basics') return <CiCdBasicsLab mode="ci" />
  if (lesson.id === 'cd-basics') return <CiCdBasicsLab mode="cd" />
  if (lesson.id === 'microservice-system-design') return <SystemDesignInterviewLab />
  if (lesson.id === 'cicd-interview') return <CiCdInterviewLab />
  return <DecisionLab lesson={lesson} />
}

const LEARNING_KEY = 'spring-reactor-learning-v1'
const DAY_MS = 24 * 60 * 60 * 1000

function loadLearningState() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEARNING_KEY) || '{}')
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
    return Object.fromEntries(Object.entries(saved).flatMap(([id, value]) => {
      const lesson = lessons.find((item) => item.id === id)
      if (!lesson || !value || typeof value !== 'object' || Array.isArray(value)) return []
      return [[id, migrateLegacyCodeConceptIds(value, id, lesson.codeNotes)]]
    }))
  } catch {
    return {}
  }
}

function recallDistractors(lesson, correctValue, preferredValues, seedText) {
  const values = [
    ...preferredValues,
    ...getLessonTerms(lesson).map(([, meaning]) => meaning),
    ...(lesson.codeNotes ?? []).map(([, explanation]) => explanation),
    ...(lesson.options ?? []),
    ...(lesson.points ?? []),
    'Bu açıklama başka bir kavrama aittir.',
    'Bu seçenek bu kavramın görevini anlatmaz.',
    'Bu ifade dersteki farklı bir ilişkiyi anlatır.',
  ]
  const unique = values.filter((value, index) => (
    value !== correctValue && values.findIndex((other) => other === value) === index
  ))
  const start = hashString(seedText) % unique.length
  return [unique[start], unique[(start + 1) % unique.length]]
}

function buildRecallCandidateCatalog(lesson) {
  const candidates = []
  const mainConceptId = `${lesson.id}-main`
  const mainCorrect = lesson.options[lesson.answer]
  const mainExplanations = lesson.options.map((option, index) => (
    index === lesson.answer
      ? `Doğru. ${mainCorrect}`
      : `\`${option}\` bu soruda doğru kavramla eşleşmiyor. Doğru cevap: \`${mainCorrect}\`.`
  ))
  candidates.push({
    conceptId: mainConceptId,
    question: lesson.question,
    ...arrangeChoices(
      lesson.options,
      lesson.answer,
      `${mainConceptId}-recall-catalog`,
      hashString(`${mainConceptId}-position`) % lesson.options.length,
      mainExplanations,
    ),
  })

  const lessonTerms = getLessonTerms(lesson)
  lessonTerms.forEach(([term, meaning], termIndex) => {
    const conceptId = `${lesson.id}-${normalizeConcept(term)}`
    const preferred = lessonTerms
      .filter((_, index) => index !== termIndex)
      .map(([, otherMeaning]) => otherMeaning)
    const distractors = recallDistractors(lesson, meaning, preferred, `${conceptId}-distractors`)
    const options = [meaning, ...distractors]
    const explanations = [
      `Doğru. \`${term}\`: ${meaning}`,
      `Bu açıklama \`${term}\` kavramını tanımlamıyor. \`${term}\`: ${meaning}`,
      `Bu açıklama \`${term}\` kavramını tanımlamıyor. \`${term}\`: ${meaning}`,
    ]
    candidates.push({
      conceptId,
      question: `\`${term}\` ne demek?`,
      ...arrangeChoices(
        options,
        0,
        `${conceptId}-recall-catalog`,
        hashString(`${conceptId}-position`) % options.length,
        explanations,
      ),
    })
  })

  const notes = lesson.codeNotes ?? []
  notes.forEach(([fragment, explanation], sourceIndex) => {
    const conceptId = codeNoteConceptId(lesson.id, fragment)
    const preferred = notes
      .filter((_, index) => index !== sourceIndex)
      .map(([, otherExplanation]) => otherExplanation)
    const distractors = recallDistractors(lesson, explanation, preferred, `${conceptId}-distractors`)
    const options = [explanation, ...distractors]
    const explanations = [
      `Doğru. \`${fragment}\`: ${explanation}`,
      `Bu açıklama \`${fragment}\` parçasının rolünü anlatmıyor. \`${fragment}\`: ${explanation}`,
      `Bu açıklama \`${fragment}\` parçasının rolünü anlatmıyor. \`${fragment}\`: ${explanation}`,
    ]
    candidates.push({
      conceptId,
      question: `Kod/model okuma: \`${fragment}\` bu örnekte hangi rolü oynuyor?`,
      ...arrangeChoices(
        options,
        0,
        `${conceptId}-recall-catalog`,
        hashString(`${conceptId}-position`) % options.length,
        explanations,
      ),
    })
  })

  const uniqueCandidates = new Map()
  candidates.forEach((card) => {
    if (!uniqueCandidates.has(card.conceptId)) uniqueCandidates.set(card.conceptId, card)
  })
  return [...uniqueCandidates.values()]
}

function buildRecallQuestion(lesson, variantSeed, record) {
  const candidateCards = buildRecallCandidateCatalog(lesson)
  const weakestId = weakestConceptId(record, candidateCards.map((card) => card.conceptId))
  if (weakestId) {
    const weakestCard = candidateCards.find((card) => card.conceptId === weakestId)
    if (weakestCard) return { ...weakestCard, reviewReason: 'EN ZAYIF KAVRAM' }
  }

  const lessonTerms = getLessonTerms(lesson)
  if (lessonTerms.length >= 3) {
    const termIndex = variantSeed % lessonTerms.length
    const [term, meaning] = lessonTerms[termIndex]
    const relatedTerms = lessonTerms
      .filter((_, index) => index !== termIndex)
    const firstWrongIndex = variantSeed % relatedTerms.length
    let secondWrongIndex = (firstWrongIndex + 1) % relatedTerms.length
    if (secondWrongIndex === firstWrongIndex && relatedTerms.length > 1) secondWrongIndex = (secondWrongIndex + 1) % relatedTerms.length
    const firstWrong = relatedTerms[firstWrongIndex]
    const secondWrong = relatedTerms[secondWrongIndex]
    const options = [meaning, firstWrong[1], secondWrong[1]]
    const explanations = [
      `Doğru. \`${term}\`: ${meaning}`,
      `Bu açıklama \`${firstWrong[0]}\` kavramına ait. \`${term}\` ise ${meaning}`,
      `Bu açıklama \`${secondWrong[0]}\` kavramına ait. \`${term}\` ise ${meaning}`,
    ]
    return {
      conceptId: `${lesson.id}-${normalizeConcept(term)}`,
      question: `\`${term}\` ne demek?`,
      ...shuffleChoices(options, 0, `${lesson.id}-term-${variantSeed}`, explanations),
    }
  }

  const correctOption = lesson.options[lesson.answer]
  const explanations = lesson.options.map((option, index) => (
    index === lesson.answer
      ? `Doğru. ${correctOption}`
      : `\`${option}\` bu soruda doğru kavramla eşleşmiyor. Doğru cevap: \`${correctOption}\`.`
  ))
  return {
    conceptId: `${lesson.id}-main`,
    question: lesson.question,
    ...shuffleChoices(lesson.options, lesson.answer, `${lesson.id}-checkpoint-${variantSeed}`, explanations),
  }
}

function RecallDeck({ completed, activeId, learning, onReview }) {
  const activeIndex = lessons.findIndex((lesson) => lesson.id === activeId)
  const due = useMemo(
    () => dueReviewLessons(completed, learning),
    [completed, learning],
  )
  const fallback = lessons
    .filter((lesson) => completed.has(lesson.id))
    .sort((a, b) => learningRecord(learning, a.id).strength - learningRecord(learning, b.id).strength)
  const candidates = due.length > 0 ? due : fallback
  const [cursor, setCursor] = useState(0)
  const [picked, setPicked] = useState(null)
  const [rated, setRated] = useState(false)
  const [draft, setDraft] = useState('')
  const [revealed, setRevealed] = useState(false)
  const start = due.length > 0 ? 0 : candidates.length > 0 ? hashString(activeId) % candidates.length : 0
  const lesson = candidates[(start + cursor) % Math.max(1, candidates.length)]
  const record = lesson ? learningRecord(learning, lesson.id) : null
  const card = lesson ? buildRecallQuestion(lesson, activeIndex + cursor, record) : null
  const correct = picked === card?.answer

  useEffect(() => {
    setCursor(0)
    setPicked(null)
    setRated(false)
    setDraft('')
    setRevealed(false)
  }, [activeId])
  useEffect(() => {
    setPicked(null)
    setRated(false)
    setDraft('')
    setRevealed(false)
  }, [cursor, lesson?.id])
  if (!card) return null

  const recallDraftReady = draft.replace(/\s/g, '').length >= 12

  const rate = (rating) => {
    if (picked === null || rated) return
    onReview(lesson.id, { correct, rating: correct ? rating : 'hard', conceptId: card.conceptId })
    setRated(true)
  }

  const next = () => {
    setCursor((value) => (value + 1) % candidates.length)
    setPicked(null)
    setRated(false)
    setDraft('')
    setRevealed(false)
  }

  return (
    <section className="recall-deck" id="review-deck">
      <div className="section-label"><span>{due.length > 0 ? `TEKRAR KUYRUĞU · ${due.length} BEKLİYOR` : '30 SN HIZLI TEKRAR'}</span><b>{lesson.title}</b></div>
      <div className="recall-meta"><span>Güç {record.strength}%</span><span>Sonraki plan: {formatReviewDistance(record.nextReviewAt)}</span>{card.reviewReason && <span>Seçim nedeni · {card.reviewReason}</span>}</div>
      <h3>{card.question}</h3>
      {!revealed ? (
        <div className="recall-freeform">
          <label htmlFor={`recall-${lesson.id}`}>Şıklara bakmadan kendi cümlenle hatırla.</label>
          <textarea id={`recall-${lesson.id}`} rows="4" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Kavramı ne olduğunu ve neden kullanıldığını açıklamaya çalış..." />
          <div className="recall-freeform-actions">
            <small>{recallDraftReady ? 'Hazır. Şimdi referansla karşılaştır.' : 'Önce kısa da olsa kendi cevabını üret.'}</small>
            <button disabled={!recallDraftReady} onClick={() => setRevealed(true)}>Referansı göster →</button>
          </div>
        </div>
      ) : (
        <>
          <div className="recall-reference"><small>REFERANS CEVAP</small><p>{card.options[card.answer]}</p></div>
          <p className="recall-remediation-note">Şimdi tanıma kontrolünü yap. Bu ikinci adım; asıl hatırlama denemeni yukarıda yaptın.</p>
          <div className="recall-options">
            {card.options.map((option, index) => <button key={`${option}-${index}`} onClick={() => setPicked(index)} className={picked === null ? '' : index === card.answer ? 'correct' : picked === index ? 'wrong' : ''}>{option}</button>)}
          </div>
        </>
      )}
      {picked !== null && (
        <div className="recall-foot recall-feedback-stack">
          <span>{card.explanations?.[picked] ?? (correct ? 'Doğru.' : 'Yanlış.')}</span>
          {!rated ? (
            <div className="recall-rating">
              <small>{correct ? 'NE KADAR RAHAT HATIRLADIN?' : 'Bu kart 1 gün sonra tekrar gelecek.'}</small>
              {correct ? <><button onClick={() => rate('hard')}>Zor · 1 gün</button><button onClick={() => rate('good')}>Hatırladım</button><button onClick={() => rate('easy')}>Kolay</button></> : <button onClick={() => rate('hard')}>Tekrarı planla</button>}
            </div>
          ) : <button onClick={next}>Sıradaki tekrar →</button>}
        </div>
      )}
    </section>
  )
}

function DailyStudyPanel({ plan, dueCount, onOpen }) {
  if (plan.length === 0) return null
  const totalMinutes = plan.reduce((sum, item) => sum + item.minutes, 0)

  return (
    <section className="daily-plan" aria-label="Bugünün çalışma planı">
      <div className="daily-plan-head">
        <div>
          <span className="eyebrow">BUGÜNÜN ÇALIŞMASI</span>
          <h2>{dueCount > 0 ? 'Önce unutmayı durdur, sonra ilerle.' : 'Bugün ne çalışacağını düşünme.'}</h2>
          <p>{plan.length} adım · yaklaşık {totalMinutes} dk · tekrarlar önce, zayıf konular sonra, yeni ders en son.</p>
        </div>
        <button className="daily-start" onClick={() => onOpen(plan[0])}>{plan[0].kind === 'review' ? 'Tekrarla başla' : 'Çalışmaya başla'} →</button>
      </div>
      <div className="daily-plan-list">
        {plan.map((item, index) => (
          <button key={`${item.kind}-${item.lesson.id}`} className={`daily-plan-item ${item.kind}`} onClick={() => onOpen(item)}>
            <span className="daily-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="daily-plan-copy">
              <small>{item.label} · {item.minutes} dk</small>
              <strong>{item.lesson.title}</strong>
              <em>{item.note}</em>
            </span>
            <b>→</b>
          </button>
        ))}
      </div>
    </section>
  )
}

function RequestLab() {
  const [step, setStep] = useState(0)
  const reduced = useReducedMotion()

  useEffect(() => {
    const id = window.setInterval(() => setStep((current) => (current + 1) % flow.length), 2200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section className="request-lab" aria-label="Canlı request simülatörü">
      <div className="lab-copy">
        <span className="eyebrow">CANLI REQUEST LAB</span>
        <h2>Bir HTTP isteğinin içinden geç.</h2>
        <p>{flow[step].detail}</p>
        <div className="lab-readout"><span>Şu an</span><strong>{flow[step].label}</strong><code>{flow[step].sub}</code></div>
      </div>
      <div className="flow-track">
        <div className="flow-line" />
        {flow.map((node, index) => (
          <button key={node.label} className={`flow-node ${index === step ? 'active' : ''} ${index < step ? 'visited' : ''}`} onClick={() => setStep(index)}>
            <span className="node-index">{String(index + 1).padStart(2, '0')}</span>
            <strong>{node.label}</strong>
            <small>{node.sub}</small>
          </button>
        ))}
        <motion.div
          className="packet"
          animate={{ left: `${(step / (flow.length - 1)) * 100}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 18 }}
          aria-hidden="true"
        >REQ</motion.div>
      </div>
      <div className="lab-controls">
        <button onClick={() => setStep((step - 1 + flow.length) % flow.length)}>← Önceki</button>
        <span>{step + 1} / {flow.length}</span>
        <button onClick={() => setStep((step + 1) % flow.length)}>Sonraki →</button>
      </div>
    </section>
  )
}

function ConceptInspector({ concept, lesson, onClose }) {
  if (!concept) return null
  const detail = getConceptDetail(concept, lesson)
  return (
    <motion.div className="concept-inspector-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <button type="button" className="concept-inspector-backdrop" onClick={onClose} aria-label="Kavram açıklamasını kapat" />
      <motion.aside className="concept-inspector" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}>
        <div className="concept-inspector-head">
          <div><small>KAVRAMI PARÇALA</small><h3>{detail.term}</h3></div>
          <button type="button" onClick={onClose} aria-label="Kavram açıklamasını kapat">×</button>
        </div>
        <div className="concept-inspector-grid">
          <div><small>NE DEMEK?</small><p>{detail.meaning}</p></div>
          <div><small>BU DERSTE NE İŞE YARIYOR?</small><p>{detail.use}</p></div>
          <div><small>KODDA ÖRNEK</small><code>{detail.example}</code></div>
          {detail.confuse && <div><small>NEYLE KARIŞTIRMA?</small><p>{detail.confuse}</p></div>}
        </div>
      </motion.aside>
    </motion.div>
  )
}

function PredictionCheck({ prediction }) {
  const [picked, setPicked] = useState(null)
  const correct = picked === prediction.answer

  return (
    <section className="prediction-check">
      <div className="section-label"><span>ÖNCE TAHMİN ET</span><b>CEVABI GÖRMEDEN</b></div>
      <h2>{prediction.prompt}</h2>
      <p className="prediction-hint">Henüz ezber yapma. Koddaki davranışı tahmin et; sonra kavramın adını koyacağız.</p>
      <div className="prediction-options">
        {prediction.options.map((option, index) => (
          <button
            type="button"
            key={option}
            className={picked === null ? '' : index === prediction.answer ? 'correct' : picked === index ? 'wrong' : ''}
            onClick={() => setPicked(index)}
            disabled={picked !== null}
          >
            <span>{String.fromCharCode(65 + index)}</span>{option}
          </button>
        ))}
      </div>
      {picked !== null && (
        <motion.div className={`prediction-feedback ${correct ? 'good' : 'bad'}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <strong>{correct ? 'Doğru tahmin.' : 'Burada kritik ayrım şu:'}</strong>
          <p>{prediction.explanation}</p>
        </motion.div>
      )}
    </section>
  )
}

const guidedLessonPhases = [
  { id: 'understand', label: 'ANLA', note: 'Kavram + kod' },
  { id: 'apply', label: 'UYGULA', note: 'Lab + pratik' },
  { id: 'recall', label: 'HATIRLA / TEST ET', note: 'Recall + checkpoint' },
]

function GuidedLearningLesson({ lesson, completed, status, learningRecordData, codePassed, onComplete, onQuizAnswer, onCodeComplete, onDebugAttempt, onActiveRecall, onInterviewAttempt, onNext, nextLesson, index, total }) {
  const prerequisites = useMemo(() => getPrerequisites(lesson), [lesson])
  const lessonTerms = useMemo(() => getLessonTerms(lesson), [lesson])
  const hasCodeWorkout = useMemo(() => Boolean(buildCodePractice(lesson)), [lesson])
  const concepts = useMemo(() => {
    const items = [...prerequisites, ...lessonTerms.map(([term, meaning]) => ({ term, meaning, lessonId: lesson.id, lessonTitle: lesson.title }))]
    return items.filter((item, itemIndex) => items.findIndex((other) => normalizeConcept(other.term) === normalizeConcept(item.term)) === itemIndex)
  }, [lesson, lessonTerms, prerequisites])
  const [selectedConcept, setSelectedConcept] = useState(null)
  const [phase, setPhase] = useState('understand')
  const learningGoal = getGuidedLearningGoal(lesson)
  const prediction = getGuidedPrediction(lesson)
  const activeRecall = getGuidedActiveRecall(lesson, lessonTerms)
  const lessonSummary = getGuidedSummary(lesson)

  const phaseIndex = guidedLessonPhases.findIndex((item) => item.id === phase)
  const selectPhase = (nextPhase) => {
    setSelectedConcept(null)
    setPhase(nextPhase)
    window.requestAnimationFrame(() => document.getElementById(`lesson-phase-${nextPhase}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  useEffect(() => {
    setSelectedConcept(null)
    setPhase('understand')
  }, [lesson.id])

  return (
    <AnimatePresence mode="wait">
      <motion.article key={lesson.id} className="lesson guided-learning" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25 }}>
        <nav className="learning-phase-nav" aria-label="Ders öğrenme aşamaları">
          {guidedLessonPhases.map((item, itemIndex) => (
            <button
              type="button"
              key={item.id}
              className={item.id === phase ? 'active' : itemIndex < phaseIndex ? 'past' : ''}
              aria-current={item.id === phase ? 'step' : undefined}
              onClick={() => selectPhase(item.id)}
            >
              <span>{itemIndex + 1}</span>
              <strong>{item.label}</strong>
              <small>{item.note}</small>
            </button>
          ))}
        </nav>

        <div id="lesson-phase-understand" className="guided-phase" hidden={phase !== 'understand'}>
          <GuidedLessonIntro
            lesson={lesson}
            index={index}
            total={total}
            status={status}
            learningGoal={learningGoal}
            prerequisites={prerequisites}
            lessonTerms={lessonTerms}
            prediction={prediction}
            onSelectConcept={setSelectedConcept}
            PredictionCheck={PredictionCheck}
          />

          <AnimatePresence mode="wait">
            {selectedConcept && <ConceptInspector key={`${lesson.id}-${selectedConcept.term}`} concept={selectedConcept} lesson={lesson} onClose={() => setSelectedConcept(null)} />}
          </AnimatePresence>

          <div className="lesson-grid">
            <section>
              <span className="section-label">KURAL → NEDEN → SONUÇ</span>
              <ul className="points">{lesson.points.map((point) => <li key={point}>{point}</li>)}</ul>
            </section>
            <section className="code-card">
              <div className="code-head"><span>GERÇEK KOD / MODEL · RENKLİ KAVRAMA TIKLA</span><i>{codeLanguageForLesson(lesson)}</i></div>
              <pre><InteractiveCode code={lesson.code} concepts={concepts} onConcept={setSelectedConcept} /></pre>
            </section>
          </div>

          {lesson.codeNotes?.length > 0 && (
            <section className="code-walkthrough">
              <div className="section-label"><span>KODU SATIR SATIR SÖK</span><b>{lesson.codeNotes.length} parça</b></div>
              <div className="walkthrough-list">
                {lesson.codeNotes.map(([fragment, explanation], noteIndex) => <div className="walkthrough-row" key={`${fragment}-${noteIndex}`}><code>{fragment}</code><p>{explanation}</p></div>)}
              </div>
            </section>
          )}

          <div className="phase-actions end"><button type="button" className="complete-button" onClick={() => selectPhase('apply')}>Uygulamaya geç →</button></div>
        </div>

        <div id="lesson-phase-apply" className="guided-phase" hidden={phase !== 'apply'}>
          <div className="guided-lab-divider"><span>ŞİMDİ SEN DENE</span><p>Önce kontrollü deney, sonra serbestçe kurcala.</p></div>
          <LessonLab lesson={lesson} />
          <MemoryGame lesson={lesson} />
          <CodeWorkout lesson={lesson} passed={codePassed} onComplete={onCodeComplete} />
          <DebugWorkout lesson={lesson} record={learningRecordData} onAttempt={onDebugAttempt} />
          <div className="phase-actions"><button type="button" className="reveal" onClick={() => selectPhase('understand')}>← Anla</button><button type="button" className="complete-button" onClick={() => selectPhase('recall')}>Hatırla / test et →</button></div>
        </div>

        <div id="lesson-phase-recall" className="guided-phase" hidden={phase !== 'recall'}>
          <ActiveRecall recall={activeRecall} lesson={lesson} lessonTerms={lessonTerms} onAttempt={onActiveRecall} />
          <Quiz lesson={lesson} completed={completed} record={learningRecordData} onComplete={onComplete} onAnswer={onQuizAnswer} hasCodeWorkout={hasCodeWorkout} codePassed={codePassed} />
          {completed && <InterviewMode lesson={lesson} record={learningRecordData} onAttempt={onInterviewAttempt} />}

          {lessonSummary.length > 0 && (
            <section className="lesson-summary">
              <div className="section-label"><span>CEBİNDE KALSIN</span><b>{lessonSummary.length} ŞEY</b></div>
              <ul>{lessonSummary.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}

          <div className="phase-actions"><button type="button" className="reveal" onClick={() => selectPhase('apply')}>← Uygula</button></div>

          {nextLesson && (
            <button className={`next-lesson ${completed ? 'ready' : 'preview'}`} onClick={onNext}>
              <span className="next-lesson-copy"><small>DERS {index + 2}/{total} · SONRAKİ KONU</small><strong>{nextLesson.title}</strong><em>{nextLesson.hook}</em>{!completed && <span className="next-lesson-note">Ders checkpoint'i tamamlanmadan geçebilirsin; ancak bu ders tamamlandı sayılmaz.</span>}</span><b>→</b>
            </button>
          )}
        </div>
      </motion.article>
    </AnimatePresence>
  )
}

function Quiz({ lesson, completed, record, onComplete, onAnswer, hasCodeWorkout = false, codePassed = false }) {
  const baseQuestions = useMemo(() => buildCheckpointQuestions(lesson), [lesson])
  const adaptivePlan = useMemo(() => buildAdaptiveMasteryPlan(baseQuestions, record), [lesson.id, baseQuestions])
  const conceptIds = useMemo(() => baseQuestions.map((item) => item.conceptId), [baseQuestions])
  const checkpoint = checkpointMasteryState(record, conceptIds)
  const masteredConcepts = new Set(checkpoint.masteredConceptIds)
  const retryAttempts = checkpoint.retryAttempts
  const buildResumeQuestions = () => adaptivePlan.questions
    .filter((item) => !masteredConcepts.has(item.conceptId))
    .map((item) => {
      const retryAttempt = retryAttempts[item.conceptId] ?? 0
      return retryAttempt > 0 ? buildRetryQuestion(item, lesson, retryAttempt) : item
    })
  const [questions, setQuestions] = useState(buildResumeQuestions)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [picked, setPicked] = useState(null)
  const card = questions[questionIndex]
  const correct = card ? picked === card.answer : false
  const masteryCount = baseQuestions.filter((item) => masteredConcepts.has(item.conceptId)).length
  const mastered = masteryCount === baseQuestions.length
  const retryCount = Math.max(0, questions.length - baseQuestions.length)
  const completionAllowed = !hasCodeWorkout || codePassed

  useEffect(() => {
    setQuestions(buildResumeQuestions())
    setQuestionIndex(0)
    setPicked(null)
  }, [lesson.id, adaptivePlan])

  useEffect(() => {
    if (mastered && completionAllowed && !completed) onComplete()
  }, [mastered, completionAllowed, completed, onComplete])

  const pick = (index) => {
    if (picked !== null) return
    setPicked(index)
    onAnswer?.(lesson.id, card.conceptId, index === card.answer)
    if (index === card.answer) {
      const nextMastered = new Set(masteredConcepts)
      nextMastered.add(card.conceptId)
      const allMastered = baseQuestions.every((item) => nextMastered.has(item.conceptId))
      if (allMastered && completionAllowed && !completed) onComplete()
      return
    }

    const nextAttempt = (retryAttempts[card.conceptId] ?? 0) + 1
    const retry = buildRetryQuestion(card, lesson, nextAttempt)
    setQuestions((items) => insertSpacedRetry(items, retry, questionIndex))
  }

  const nextQuestion = () => {
    if (picked === null || questionIndex >= questions.length - 1) return
    setQuestionIndex((index) => index + 1)
    setPicked(null)
  }

  return (
    <div className="quiz-card">
      <div className="section-label"><span>DERS CHECKPOINT</span><b>{masteryCount}/{baseQuestions.length}{retryCount > 0 ? ` · ${retryCount} tekrar` : ''} · +{lesson.xp} XP maksimum</b></div>
      <div className="quiz-progress" aria-label={`${masteryCount}/${baseQuestions.length} kavram öğrenildi`}>
        {questions.map((item, index) => <i key={item.id} className={masteredConcepts.has(item.conceptId) ? 'done' : index === questionIndex ? 'active' : ''} />)}
      </div>
      {card && (
        <>
          {questionIndex === 0 && adaptivePlan.adaptiveConceptId && <div className="retry-badge">ADAPTİF · önce zayıf kavram</div>}
          {card.isRetry && <div className="retry-badge">TEKRAR · farklı soru</div>}
          <h3>{card.question}</h3>
          <div className="quiz-options">
            {card.options.map((option, index) => {
              const state = picked === null ? '' : index === card.answer ? 'correct' : picked === index ? 'wrong' : ''
              return <button key={`${option}-${index}`} disabled={picked !== null} className={state} onClick={() => pick(index)}>{String.fromCharCode(65 + index)}. {option}</button>
            })}
          </div>
          <AnimatePresence mode="wait">
            {picked !== null && (
              <motion.div key={`${lesson.id}-${questionIndex}-${picked}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`quiz-feedback ${correct ? 'good' : 'bad'}`}>
                <strong>{correct ? 'Doğru.' : 'Neden yanlış?'}</strong>
                <span>{card.explanations?.[picked] ?? (correct ? 'Doğru ilişkiyi kurdun.' : 'Bu seçenek sorudaki kavramla eşleşmiyor.')}</span>
                {!correct && <em>Şimdi doğru şıkkı seçip geçemezsin. Bu kavram biraz sonra farklı biçimde tekrar sorulacak.</em>}
              </motion.div>
            )}
          </AnimatePresence>
          {!mastered && questionIndex < questions.length - 1 && (
            <button className="complete-button" disabled={picked === null} onClick={nextQuestion}>
              {picked === null ? 'Önce bir cevap seç' : correct ? 'Sonraki soru →' : 'Devam et · tekrar gelecek →'}
            </button>
          )}
        </>
      )}
      {(mastered || questionIndex === questions.length - 1) && (
        mastered && hasCodeWorkout && !codePassed && !completed
          ? <div className="mastery-result done quiz-code-required">✓ Quiz checkpoint tamamlandı · Dersi tamamlamak için KODU SEN YAZ çalışmasını da geç.</div>
          : <div className={`mastery-result ${mastered ? 'done' : ''}`}>{completed || mastered ? `✓ ${baseQuestions.length}/${baseQuestions.length} · Ders tamamlandı` : 'Yanlış kalan kavram tekrar çözülmeden tamamlanmaz'}</div>
      )}
    </div>
  )
}

function Lesson({ lesson, completed, onComplete, onNext, nextLesson, index, total }) {
  const prerequisites = useMemo(() => getPrerequisites(lesson), [lesson])
  const lessonTerms = useMemo(() => getLessonTerms(lesson), [lesson])
  const concepts = useMemo(() => {
    const items = [...prerequisites, ...lessonTerms.map(([term, meaning]) => ({ term, meaning, lessonId: lesson.id, lessonTitle: lesson.title }))]
    return items.filter((item, itemIndex) => items.findIndex((other) => normalizeConcept(other.term) === normalizeConcept(item.term)) === itemIndex)
  }, [lesson, lessonTerms, prerequisites])
  const [selectedConcept, setSelectedConcept] = useState(null)

  useEffect(() => setSelectedConcept(null), [lesson.id])

  return (
    <AnimatePresence mode="wait">
      <motion.article key={lesson.id} className="lesson" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25 }}>
        <div className="lesson-topline">
          <span>DERS {index + 1}/{total}</span><span>{lesson.minutes} dk</span><span>+{lesson.xp} XP</span><span>{completed ? 'TAMAMLANDI' : 'AKTİF DERS'}</span>
        </div>
        <h1>{lesson.title}</h1>
        <p className="hook">{lesson.hook}</p>

        {prerequisites.length > 0 && (
          <section className="prerequisite-section">
            <div className="section-label"><span>BUNU BİLMİYORSAN ÖNCE BURAYA BAK</span><b>{prerequisites.length} temel kavram</b></div>
            <p>Ders kilitli değil. Eksik kelime varsa tıkla, 20 saniyede hatırla, sonra devam et.</p>
            <div className="prerequisite-list">
              {prerequisites.map((concept) => <button type="button" key={`${lesson.id}-${concept.term}`} onClick={() => setSelectedConcept(concept)}><code>{concept.term}</code><span>{concept.meaning}</span></button>)}
            </div>
          </section>
        )}

        {lessonTerms.length > 0 && (
          <section className="terms-section">
            <div className="section-label"><span>ÖNCE BU KELİMELER · TIKLA VE PARÇALA</span><b>{lessonTerms.length} kavram</b></div>
            <div className="term-grid">
              {lessonTerms.map(([term, meaning]) => (
                <button type="button" className="term-card" key={term} onClick={() => setSelectedConcept({ term, meaning, lessonId: lesson.id, lessonTitle: lesson.title })}><code>{term}</code><p>{meaning}</p><small>detayı aç +</small></button>
              ))}
            </div>
          </section>
        )}

        <AnimatePresence mode="wait">
          {selectedConcept && <ConceptInspector key={`${lesson.id}-${selectedConcept.term}`} concept={selectedConcept} lesson={lesson} onClose={() => setSelectedConcept(null)} />}
        </AnimatePresence>

        <div className="analogy">
          <span className="section-label">AKILDA KALSIN</span>
          <p>{lesson.story}</p>
        </div>

        <div className="lesson-grid">
          <section>
            <span className="section-label">BİLMEN GEREKEN</span>
            <ul className="points">{lesson.points.map((point) => <li key={point}>{point}</li>)}</ul>
          </section>
          <section className="code-card">
            <div className="code-head"><span>GERÇEK KOD / MODEL · RENKLİ KAVRAMA TIKLA</span><i>{codeLanguageForLesson(lesson)}</i></div>
            <pre><InteractiveCode code={lesson.code} concepts={concepts} onConcept={setSelectedConcept} /></pre>
          </section>
        </div>

        {lesson.codeNotes?.length > 0 && (
          <section className="code-walkthrough">
            <div className="section-label"><span>KODU SATIR SATIR SÖK</span><b>{lesson.codeNotes.length} parça</b></div>
            <div className="walkthrough-list">
              {lesson.codeNotes.map(([fragment, explanation], noteIndex) => (
                <div className="walkthrough-row" key={`${fragment}-${noteIndex}`}>
                  <code>{fragment}</code><p>{explanation}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <MemoryGame lesson={lesson} />
        <Quiz lesson={lesson} completed={completed} onComplete={onComplete} />
        {nextLesson && (
          <button className={`next-lesson ${completed ? 'ready' : 'preview'}`} onClick={onNext}>
            <span className="next-lesson-copy">
              <small>DERS {index + 2}/{total} · SONRAKİ KONU</small>
              <strong>{nextLesson.title}</strong>
              <em>{nextLesson.hook}</em>
              {!completed && <span className="next-lesson-note">Kilit yok. Buraya geçebilirsin; mevcut dersin checkpoint'i tamamlanmış sayılmaz.</span>}
            </span>
            <b>→</b>
          </button>
        )}
      </motion.article>
    </AnimatePresence>
  )
}

const PROGRESS_KEY = 'spring-reactor-progress-v3'
const LESSON_IDS = lessons.map((lesson) => lesson.id)

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((id) => lessons.some((lesson) => lesson.id === id)) : []
  } catch {
    return []
  }
}

function App() {
  const [initialState] = useState(() => {
    const learningState = loadLearningState()
    return {
      learning: learningState,
      completed: validatedCompletedLessonIds(loadProgress(), learningState, lessons),
    }
  })
  const [completed, setCompleted] = useState(initialState.completed)
  const [learning, setLearning] = useState(initialState.learning)
  const latestProgress = useRef(initialState)
  const initialDeepLink = useRef(Boolean(lessonIdFromUrl(window.location.href, LESSON_IDS)))
  const defaultLessonId = useRef(null)
  if (!defaultLessonId.current) {
    const done = new Set(initialState.completed)
    defaultLessonId.current = lessons.find((lesson) => !done.has(lesson.id))?.id ?? lessons[lessons.length - 1].id
  }
  const [activeId, setActiveId] = useState(() => lessonIdFromUrl(window.location.href, LESSON_IDS) ?? defaultLessonId.current)
  const [focus, setFocus] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')
  const [storageWarning, setStorageWarning] = useState(false)
  const [roadmapOpen, setRoadmapOpen] = useState(false)
  const [roadmapQuery, setRoadmapQuery] = useState('')
  const [roadmapFilter, setRoadmapFilter] = useState('all')
  const [readinessOpen, setReadinessOpen] = useState(false)
  const readinessTriggerRef = useRef(null)
  const learningAreaRef = useRef(null)
  const previousActiveId = useRef(activeId)

  const activeLesson = lessons.find((lesson) => lesson.id === activeId) ?? lessons[0]
  const activeIndex = lessons.findIndex((lesson) => lesson.id === activeLesson.id)
  const upNextLesson = lessons[activeIndex + 1] ?? null
  const completedSet = useMemo(() => new Set(completed), [completed])
  const totalXp = lessons.reduce((sum, lesson) => (
    sum + earnedLessonXp(lesson, learningRecord(learning, lesson.id), completedSet.has(lesson.id))
  ), 0)
  const maxXp = lessons.reduce((sum, lesson) => sum + lesson.xp, 0)
  const completedCount = lessons.filter((lesson) => completedSet.has(lesson.id)).length
  const progress = Math.round((completedCount / lessons.length) * 100)
  const readiness = useMemo(() => calculateInterviewReadiness(completedSet, learning), [completedSet, learning])
  const dueReviews = useMemo(() => dueReviewLessons(completedSet, learning), [completedSet, learning])
  const reviewDueCount = dueReviews.length
  const dueReviewIds = useMemo(() => new Set(dueReviews.map((lesson) => lesson.id)), [dueReviews])
  const visibleLessons = useMemo(() => {
    const query = roadmapQuery.trim().toLocaleLowerCase('tr-TR')
    return lessons.filter((lesson) => {
      const phase = phases.find((item) => item.id === lesson.phase)
      const status = learningStatus(learning, lesson.id, completedSet.has(lesson.id))
      const matchesFilter = roadmapFilter === 'all'
        || (roadmapFilter === 'review' && dueReviewIds.has(lesson.id))
        || (roadmapFilter === 'weak' && status.key === 'weak')
        || (roadmapFilter === 'role' && phase?.scope === 'role-overlay')
      if (!matchesFilter) return false
      if (!query) return true
      const searchable = [
        lesson.title,
        lesson.hook,
        lesson.id,
        phase?.label,
        phase?.kicker,
        ...(lesson.points ?? []),
        ...(lesson.terms ?? []).flat(),
      ].join(' ').toLocaleLowerCase('tr-TR')
      return searchable.includes(query)
    })
  }, [roadmapQuery, roadmapFilter, learning, completedSet, dueReviewIds])
  const visibleLessonIds = useMemo(() => new Set(visibleLessons.map((lesson) => lesson.id)), [visibleLessons])
  const dailyPlan = useMemo(
    () => buildDailyStudyPlan(completedSet, learning, activeIndex),
    [completedSet, learning, activeIndex],
  )
  const activeRecord = learningRecord(learning, activeId)
  const activeStatus = learningStatus(learning, activeId, completedSet.has(activeId))
  const activeHasCodeWorkout = useMemo(() => Boolean(buildCodePractice(activeLesson)), [activeLesson])

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(completed))
      localStorage.setItem(LEARNING_KEY, JSON.stringify(learning))
      setStorageWarning(false)
    } catch {
      // QuotaExceededError and SecurityError must not crash the lesson UI.
      setStorageWarning(true)
    }
  }, [completed, learning])
  useLayoutEffect(() => {
    latestProgress.current = { completed, learning }
  }, [completed, learning])

  const navigateToLesson = useCallback((lessonId) => {
    if (!LESSON_IDS.includes(lessonId)) return
    if (lessonId !== activeId) {
      const nextUrl = lessonUrl(window.location.href, lessonId)
      window.history.pushState(window.history.state, '', nextUrl)
      setActiveId(lessonId)
    } else {
      // Clicking the selected lesson should still reveal its content.
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      learningAreaRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' })
    }
    setCopyStatus('')
  }, [activeId])

  useEffect(() => {
    const onBackOrForward = () => {
      setCopyStatus('')
      setActiveId(lessonIdFromUrl(window.location.href, LESSON_IDS) ?? defaultLessonId.current)
    }
    window.addEventListener('popstate', onBackOrForward)
    return () => window.removeEventListener('popstate', onBackOrForward)
  }, [])

  const copyLessonLink = async () => {
    try {
      await navigator.clipboard.writeText(lessonUrl(window.location.href, activeId))
      setCopyStatus('Ders bağlantısı kopyalandı.')
    } catch {
      setCopyStatus('Kopyalama engellendi. Ders bağlantısını aşağıdan açıp adres çubuğundan kopyalayabilirsin.')
    }
  }

  const restoreBackup = (incoming, options) => {
    const restored = restoreProgressBackup(latestProgress.current, incoming, options)
    latestProgress.current = restored
    setLearning(restored.learning)
    setCompleted(restored.completed)
    return restored
  }

  useEffect(() => {
    const changed = previousActiveId.current !== activeId
    document.title = `${activeLesson.title} · Java Backend Öğrenme Atölyesi`
    if (changed || initialDeepLink.current) {
      window.requestAnimationFrame(() => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        learningAreaRef.current?.scrollIntoView({ block: 'start', behavior: initialDeepLink.current || reduceMotion ? 'auto' : 'smooth' })
        if (changed) learningAreaRef.current?.focus({ preventScroll: true })
        initialDeepLink.current = false
      })
      previousActiveId.current = activeId
    }
  }, [activeId, activeLesson.title])

  useEffect(() => {
    const handler = (event) => {
      if (!isLessonShortcut(event)) return
      const index = lessons.findIndex((lesson) => lesson.id === activeId)
      if (event.key.toLowerCase() === 'j') navigateToLesson(lessons[Math.min(index + 1, lessons.length - 1)].id)
      if (event.key.toLowerCase() === 'k') navigateToLesson(lessons[Math.max(index - 1, 0)].id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeId, navigateToLesson])

  const recordQuizAnswer = (lessonId, conceptId, correct) => {
    setLearning((state) => {
      const record = learningRecord(state, lessonId)
      const answered = recordConceptAnswer(record, conceptId, correct)
      return {
        ...state,
        [lessonId]: recordCheckpointAnswer(answered, conceptId, correct),
      }
    })
  }

  const recordCodeComplete = (lessonId) => {
    setLearning((state) => {
      const record = learningRecord(state, lessonId)
      if (record.codePassed) return state
      return { ...state, [lessonId]: { ...record, codePassed: true, strength: Math.min(100, record.strength + 10) } }
    })
  }

  const saveDebugAttempt = (lessonId, attempt) => {
    setLearning((state) => ({
      ...state,
      [lessonId]: recordDebugAttempt(learningRecord(state, lessonId), attempt),
    }))
  }

  const recordActiveRecall = (lessonId, results) => {
    setLearning((state) => {
      const record = learningRecord(state, lessonId)
      return {
        ...state,
        [lessonId]: recordRecallCoverage(record, results),
      }
    })
  }

  const saveInterviewAttempt = (lessonId, score) => {
    setLearning((state) => {
      const record = learningRecord(state, lessonId)
      return { ...state, [lessonId]: recordInterviewAttempt(record, score) }
    })
  }

  const recordReview = (lessonId, { correct, rating, conceptId }) => {
    const now = Date.now()
    setLearning((state) => {
      const record = learningRecord(state, lessonId)
      const intervalDays = nextReviewInterval(record, rating)
      const strengthDelta = !correct || rating === 'hard' ? -14 : rating === 'easy' ? 18 : 10
      const concept = record.concepts?.[conceptId] ?? {
        attempts: 0,
        correct: 0,
        wrong: 0,
        strength: 0,
      }
      return {
        ...state,
        [lessonId]: {
          ...record,
          attempts: record.attempts + 1,
          correct: record.correct + (correct ? 1 : 0),
          wrong: record.wrong + (correct ? 0 : 1),
          strength: Math.max(10, Math.min(100, record.strength + strengthDelta)),
          intervalDays,
          lastReviewedAt: now,
          nextReviewAt: now + intervalDays * DAY_MS,
          concepts: {
            ...(record.concepts ?? {}),
            [conceptId]: {
              ...concept,
              attempts: concept.attempts + 1,
              correct: concept.correct + (correct ? 1 : 0),
              wrong: concept.wrong + (correct ? 0 : 1),
              strength: Math.max(0, Math.min(100, concept.strength + strengthDelta)),
            },
          },
        },
      }
    })
  }

  const finishLesson = () => {
    if (activeHasCodeWorkout && !activeRecord.codePassed) return
    if (!completedSet.has(activeId)) setCompleted((items) => [...items, activeId])
    const now = Date.now()
    setLearning((state) => {
      const record = learningRecord(state, activeId)
      const intervalDays = Math.max(1, record.intervalDays || 1)
      return {
        ...state,
        [activeId]: {
          ...record,
          masteredAt: record.masteredAt || now,
          completionEvidenceVersion: 2,
          intervalDays,
          nextReviewAt: record.nextReviewAt > now ? record.nextReviewAt : now + intervalDays * DAY_MS,
        },
      }
    })
  }
  const nextLesson = () => {
    const index = lessons.findIndex((lesson) => lesson.id === activeId)
    navigateToLesson(lessons[Math.min(index + 1, lessons.length - 1)].id)
  }

  const openDailyPlanItem = (item) => {
    if (item.kind === 'review' || item.kind === 'refresh') {
      document.getElementById('review-deck')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    navigateToLesson(item.lesson.id)
  }

  const closeReadiness = useCallback(() => {
    setReadinessOpen(false)
    window.requestAnimationFrame(() => readinessTriggerRef.current?.focus())
  }, [])

  const prefetchLessonRuntime = (lesson) => {
    void prefetchLessonPlaygroundRuntime(lesson)
    void prefetchCodeWorkoutRuntime(lesson)
  }

  return (
    <main className={focus ? 'app focus-mode' : 'app'}>
      <a className="skip-link" href="#learning-area">Aktif derse geç</a>
      <header className="topbar">
        <button className="brand" onClick={() => navigateToLesson(lessons[0].id)} aria-label="İlk derse git">
          <span className="brand-mark">JB</span>
          <span><strong>JAVA BACKEND</strong><small>ÖĞRENME ATÖLYESİ / {lessons.length} DERS</small></span>
        </button>
        <div className="top-stats">
          <span><small>XP</small><strong>{totalXp}<i>/{maxXp}</i></strong></span>
          <span><small>TAMAMLANAN</small><strong>{completedCount}<i>/{lessons.length}</i></strong></span>
          <span className={reviewDueCount ? 'review-due' : ''}><small>TEKRAR</small><strong>{reviewDueCount}</strong></span>
          <span className="mobile-study-progress" aria-label={`Müfredat ilerlemesi yüzde ${progress}`}><small>İLERLEME</small><strong>{progress}%</strong></span>
          <button ref={readinessTriggerRef} className="readiness-trigger" onClick={() => setReadinessOpen((value) => !value)} aria-expanded={readinessOpen} aria-controls="readiness-panel"><small>MÜLAKAT</small><strong>{readiness.score}<i>%</i></strong></button>
          <ProgressRing value={progress} label="Müfredat ilerlemesi" />
          <button className="focus-toggle" onClick={() => setFocus((v) => !v)}>{focus ? 'Haritayı aç' : 'Odak modu'}</button>
        </div>
      </header>
      {storageWarning && <div className="storage-warning" role="alert">İlerleme bu cihazda kaydedilemiyor. Tarayıcı depolama ayarlarını kontrol et; sayfayı yenilersen son çalışmaların kaybolabilir. JSON yedeğini indir.</div>}
      {readinessOpen && <div id="readiness-panel"><ReadinessPanel readiness={readiness} onClose={closeReadiness} /></div>}

      <div className="shell">
        <aside className={`roadmap ${roadmapOpen ? 'is-open' : ''}`} aria-label="Java Backend öğrenme konu haritası">
          <button className="roadmap-mobile-toggle" type="button" aria-expanded={roadmapOpen} aria-controls="roadmap-navigation" onClick={() => setRoadmapOpen((value) => !value)}>
            <span><strong>Konu haritası</strong><small>{lessons.length} ders · Java, Spring Boot ve daha fazlası</small></span>
            <span aria-hidden="true">{roadmapOpen ? 'Kapat −' : 'Dersleri aç +'}</span>
          </button>
          <div className="roadmap-navigation" id="roadmap-navigation">
          <div className="roadmap-intro">
            <span className="eyebrow">JAVA BACKEND ÖĞRENME YOLU</span>
            <p>Java, Spring Boot, SQL, microservices, DDD ve DevOps ana öğrenme yolu. React, Python ve kurumsal geliştirme dersleri uzmanlığını genişletmek için ek katman. Tüm dersler açık; tamamladıkların ayrıca işaretlenir.</p>
            <div className="roadmap-tools">
              <label><span className="sr-only">Konu ara</span><input value={roadmapQuery} onChange={(event) => setRoadmapQuery(event.target.value)} placeholder="Konu ara…" type="search" /></label>
              <div className="roadmap-filters" role="group" aria-label="Ders filtresi">
                {[
                  ['all', 'Tümü'],
                  ['review', `Tekrar${reviewDueCount ? ` ${reviewDueCount}` : ''}`],
                  ['weak', 'Zayıf'],
                  ['role', 'Rol eki'],
                ].map(([key, label]) => <button key={key} aria-pressed={roadmapFilter === key} className={roadmapFilter === key ? 'active' : ''} onClick={() => setRoadmapFilter(key)}>{label}</button>)}
              </div>
              <small className="roadmap-result-count" role="status" aria-live="polite" aria-atomic="true">{visibleLessons.length}/{lessons.length} ders gösteriliyor</small>
            </div>
            <ProgressBackup completed={completed} learning={learning} onRestore={restoreBackup} />
          </div>
          {visibleLessons.length === 0 && <p className="roadmap-empty" role="status">Bu arama veya filtreyle eşleşen ders yok.</p>}
          {phases.map((phase) => {
            const phaseLessons = lessons.filter((lesson) => lesson.phase === phase.id)
            const visiblePhaseLessons = phaseLessons.filter((lesson) => visibleLessonIds.has(lesson.id))
            const phaseDone = phaseLessons.filter((lesson) => completedSet.has(lesson.id)).length
            const phaseActive = phaseLessons.some((lesson) => lesson.id === activeId)
            if (visiblePhaseLessons.length === 0) return null
            return (
              <section key={phase.id} className={`phase ${phaseActive ? 'active-phase' : ''}`}>
                <div className="phase-head"><span>{phase.kicker}</span><strong>{phase.label}</strong>{phase.scope === 'role-overlay' && <small className="scope-badge">HEDEF ROL EKİ</small>}<em>{phaseDone}/{phaseLessons.length} · ders</em></div>
                {visiblePhaseLessons.map((lesson) => {
                  const lessonIndex = lessons.findIndex((item) => item.id === lesson.id)
                  const status = learningStatus(learning, lesson.id, completedSet.has(lesson.id))
                  return (
                    <a
                      key={lesson.id}
                      href={lessonUrl(window.location.href, lesson.id)}
                      onClick={(event) => {
                        if (!shouldHandleLessonLinkClick(event)) return
                        event.preventDefault()
                        navigateToLesson(lesson.id)
                        if (window.matchMedia('(max-width: 640px)').matches) {
                          setRoadmapOpen(false)
                        }
                      }}
                      onMouseEnter={() => prefetchLessonRuntime(lesson)}
                      onFocus={() => prefetchLessonRuntime(lesson)}
                      className={`lesson-link ${lesson.id === activeId ? 'active' : ''}`}
                      aria-current={lesson.id === activeId ? 'step' : undefined}
                    >
                      <span className={`status-dot ${status.key}`} />
                      <span><strong>{lesson.title}</strong><small>{lessonIndex + 1}. ders · {lesson.minutes} dk · {lesson.xp} XP · {status.label.toLocaleLowerCase('tr-TR')}</small></span>
                    </a>
                  )
                })}
              </section>
            )
          })}
          </div>
        </aside>

        <div className="content">
          <div className="study-hub">
            <DailyStudyPanel plan={dailyPlan} dueCount={reviewDueCount} onOpen={openDailyPlanItem} />
            <MixedInterviewPanel />
            <RoleInterviewPanel />
          </div>
          {reviewDueCount > 0 && <RecallDeck completed={completedSet} activeId={activeId} learning={learning} onReview={recordReview} />}
          <div ref={learningAreaRef} className="content-rule" id="learning-area" tabIndex={-1} aria-label={`Aktif ders: ${activeLesson.title}`}>
            <span>AKTİF ÖĞRENME ALANI</span><i />
            <button className="lesson-share" type="button" onClick={copyLessonLink} title={`${activeLesson.title} dersinin bağlantısını kopyala`}>Bağlantıyı kopyala ↗</button>
          </div>
          {copyStatus && <p className="lesson-share-status" role="status" aria-live="polite">{copyStatus} {copyStatus.startsWith('Kopyalama') && <a href={lessonUrl(window.location.href, activeId)} target="_blank" rel="noopener noreferrer">Ders bağlantısını aç ↗</a>}</p>}
          <GuidedLearningLesson lesson={activeLesson} completed={completedSet.has(activeLesson.id)} status={activeStatus} learningRecordData={activeRecord} codePassed={activeRecord.codePassed} onComplete={finishLesson} onQuizAnswer={recordQuizAnswer} onCodeComplete={recordCodeComplete} onDebugAttempt={saveDebugAttempt} onActiveRecall={recordActiveRecall} onInterviewAttempt={saveInterviewAttempt} onNext={nextLesson} nextLesson={upNextLesson} index={activeIndex} total={lessons.length} />
          {reviewDueCount === 0 && <RecallDeck completed={completedSet} activeId={activeId} learning={learning} onReview={recordReview} />}
          <footer>
            <strong>{activeLesson.points?.[0] ?? activeLesson.hook}</strong>
            <span>
              {upNextLesson
                ? `Sırada: ${upNextLesson.title} · ${upNextLesson.hook}`
                : 'Öğrenme yolunun sonuna geldin. Şimdi zayıf kaldığın konulara geri dön.'}
            </span>
          </footer>
        </div>
      </div>
    </main>
  )
}

export default App
