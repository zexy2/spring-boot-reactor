import { lazy, Suspense, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { post05PlaygroundIds } from '../../post05PlaygroundIds'
import { resolvePaymentBean, simulateOrderTransaction, joinUsers, joinOrders, runJoinQuery, joinMissionPassed } from '../../learning/machineChallenges'
import GameFrame from './GameFrame'
import {
  AcceptanceCriteriaPlayground,
  DocumentationTypesPlayground,
  IncidentTriagePlayground,
  KnowledgeTransferPlayground,
  RequirementDiscoveryPlayground,
  RootCausePreventionPlayground,
  ScrumEventsPlayground,
  ScrumRolesPlayground,
  SprintBacklogPlayground,
  UserStoryDodPlayground,
} from './ProcessPlaygrounds'

let post05PlaygroundPromise
const loadPost05Playground = () => {
  if (!post05PlaygroundPromise) {
    post05PlaygroundPromise = import('../../Post05Playgrounds').catch((error) => {
      post05PlaygroundPromise = undefined
      throw error
    })
  }
  return post05PlaygroundPromise
}
const Post05Playground = lazy(loadPost05Playground)

export function prefetchLessonPlaygroundRuntime(lesson) {
  if (!post05PlaygroundIds.has(lesson.id)) return Promise.resolve(null)
  return loadPost05Playground().catch(() => null)
}

const advancedPlaygroundIds = new Set([
  'exceptions', 'config', 'logging', 'security', 'testing', 'actuator', 'migrations', 'cache', 'async',
  'requirement-discovery', 'acceptance-criteria', 'user-story-dod', 'scrum-roles', 'scrum-events',
  'sprint-backlog', 'documentation-types', 'knowledge-transfer', 'incident-triage', 'root-cause-prevention',
  ...post05PlaygroundIds,
])

function ClassObjectPlayground({ lesson }) {
  const [objects, setObjects] = useState([
    { id: 1, name: 'Klavye', price: 1500 },
    { id: 2, name: 'Mouse', price: 800 },
  ])

  const addObject = () => {
    const id = objects.length + 1
    setObjects((current) => [...current, { id, name: `Ürün ${id}`, price: 500 * id }])
  }

  const mutate = (id) => {
    setObjects((current) => current.map((item) => item.id === id ? { ...item, price: item.price + 250 } : item))
  }

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="OBJECT WORKSHOP"
      title="Class kalıp; object bağımsız state."
      copy="Aynı Product class’ından birden fazla object üret. Bir object’in field’ını değiştirince diğerinin neden değişmediğini gözle."
      experiment={{ change: 'Yeni object üret veya yalnız bir object’in price alanını değiştir.', watch: 'Diğer object’in state’i aynı kalıyor mu?' }}
    >
      <div className="class-machine-layout">
        <div className="class-blueprint">
          <small>CLASS / KALIP</small>
          <strong>Product</strong>
          <code>String name</code>
          <code>int price</code>
          <button onClick={addObject}>new Product() üret</button>
        </div>
        <div className="object-instance-grid">
          {objects.map((item) => (
            <motion.div layout key={item.id} className="object-instance-card">
              <small>OBJECT #{item.id}</small>
              <strong>{item.name}</strong>
              <code>price = {item.price}</code>
              <button onClick={() => mutate(item.id)}>bu object.price += 250</button>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="machine-observation"><b>Gözlem:</b> Product tanımı tek; her object kendi field değerini taşır.</div>
    </GameFrame>
  )
}

function MethodCallPlayground({ lesson }) {
  const [argument, setArgument] = useState('Klavye')
  const [step, setStep] = useState(0)
  const flow = [
    ['ARGUMENT', `"${argument}"`, 'Çağrıda verilen gerçek değer.'],
    ['CONSTRUCTOR PARAM', 'String name', `Parameter artık "${argument}" değerini taşır.`],
    ['FIELD', `this.name = "${argument}"`, 'Constructor yeni object’in state’ini doldurur.'],
    ['METHOD CALL', 'product.label()', 'Method object state’ini okur ve davranış çalıştırır.'],
    ['RETURN', `"Ürün: ${argument}"`, 'Çağırana geri dönen sonuç.'],
  ]

  const chooseArgument = (value) => { setArgument(value); setStep(0) }

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="CALL FLOW MACHINE"
      title="Argument → parameter → field → method → return"
      copy="Constructor ile normal methodu aynı zincirde izle. Her adım farklı bir görevi temsil eder."
      experiment={{ change: 'Argument değerini seç ve çağrı zincirini adım adım ilerlet.', watch: 'Aynı değer hangi aşamada parameter, field ve return oluyor?' }}
    >
      <div className="call-machine-controls">
        {['Klavye', 'Mouse', 'Monitor'].map((value) => <button key={value} className={argument === value ? 'active' : ''} onClick={() => chooseArgument(value)}>{value}</button>)}
        <button className="run" onClick={() => setStep((current) => current >= flow.length - 1 ? 0 : current + 1)}>akışı ilerlet →</button>
      </div>
      <div className="call-flow-track">
        {flow.map((item, index) => (
          <motion.div key={item[0]} className={`call-flow-node ${index < step ? 'done' : ''} ${index === step ? 'active' : ''}`} animate={{ opacity: index <= step ? 1 : .32, y: index === step ? -4 : 0 }}>
            <small>{item[0]}</small><code>{item[1]}</code><p>{item[2]}</p>
          </motion.div>
        ))}
      </div>
    </GameFrame>
  )
}

function InterfaceContractPlayground({ lesson }) {
  const [variant, setVariant] = useState('correct')
  const variants = {
    correct: { signature: 'boolean pay(int amount)', result: 'COMPILE ✓', detail: 'Implementation interface sözleşmesini tam karşılıyor.' },
    missing: { signature: '// pay(...) yok', result: 'COMPILE ERROR', detail: 'Concrete class gerekli methodu implement etmedi.' },
    wrong: { signature: 'String pay(int amount)', result: 'COMPILE ERROR', detail: 'Method adı aynı olsa da return type sözleşmeyle uyuşmuyor.' },
  }
  const current = variants[variant]

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="CONTRACT COMPILER"
      title="Interface bir isim değil, derleme sözleşmesi."
      copy="Implementation imzasını boz. Compiler’ın hangi durumda sınıfı kabul etmediğini gör."
      experiment={{ change: 'Implementation methodunu eksilt veya return type’ını boz.', watch: 'Compiler sözleşmenin hangi parçasını reddediyor?' }}
    >
      <div className="contract-machine">
        <div className="contract-panel required"><small>INTERFACE</small><strong>PaymentService</strong><code>boolean pay(int amount);</code></div>
        <div className="contract-connector">implements →</div>
        <div className="contract-panel implementation"><small>IMPLEMENTATION</small><strong>CardPaymentService</strong><code>{current.signature}</code></div>
      </div>
      <div className="contract-variants">
        <button className={variant === 'correct' ? 'active' : ''} onClick={() => setVariant('correct')}>doğru signature</button>
        <button className={variant === 'missing' ? 'active' : ''} onClick={() => setVariant('missing')}>method eksik</button>
        <button className={variant === 'wrong' ? 'active' : ''} onClick={() => setVariant('wrong')}>return type yanlış</button>
      </div>
      <motion.div key={variant} className={`contract-result ${variant === 'correct' ? 'ok' : 'bad'}`} initial={{ opacity: .3, y: 6 }} animate={{ opacity: 1, y: 0 }}><strong>{current.result}</strong><p>{current.detail}</p></motion.div>
    </GameFrame>
  )
}

function AnnotationMetadataPlayground({ lesson }) {
  const [mode, setMode] = useState('deprecated')
  const [mismatch, setMismatch] = useState(false)
  const outcome = mode === 'deprecated'
    ? { annotation: '@Deprecated', reader: 'Compiler / IDE', signal: 'KULLANIM WARNING', detail: 'Method çalışabilir; metadata aracı kullanıcısını eski API konusunda uyarır.' }
    : { annotation: '@Override', reader: 'Java compiler', signal: mismatch ? 'COMPILE ERROR' : 'OVERRIDE VERIFIED', detail: mismatch ? 'Üst tipte eşleşen method olmadığı için annotation hatayı erken yakaladı.' : 'Method üst tip sözleşmesini gerçekten override ediyor.' }

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="METADATA READER"
      title="Annotation’ı kim okuyor, ne değişiyor?"
      copy="Kod gövdesini değil metadata katmanını değiştir; compiler/IDE tepkisinin nasıl değiştiğini izle."
      experiment={{ change: '@Deprecated ve @Override arasında geç; override imzasını bilerek boz.', watch: 'Annotation’ı hangi araç okuyor ve etkisi ne zaman ortaya çıkıyor?' }}
    >
      <div className="metadata-machine">
        <div className="metadata-code"><small>SOURCE</small><code>{outcome.annotation}</code><strong>{mode === 'deprecated' ? 'void oldMethod() { ... }' : `${mismatch ? 'void sounds()' : 'void sound()'} { ... }`}</strong></div>
        <div className="metadata-scan">SCAN →</div>
        <motion.div key={`${mode}-${mismatch}`} className="metadata-reader" initial={{ opacity: .3, x: 8 }} animate={{ opacity: 1, x: 0 }}><small>{outcome.reader}</small><strong>{outcome.signal}</strong><p>{outcome.detail}</p></motion.div>
      </div>
      <div className="metadata-controls">
        <button className={mode === 'deprecated' ? 'active' : ''} onClick={() => { setMode('deprecated'); setMismatch(false) }}>@Deprecated</button>
        <button className={mode === 'override' ? 'active' : ''} onClick={() => setMode('override')}>@Override</button>
        {mode === 'override' && <button className={mismatch ? 'danger active' : ''} onClick={() => setMismatch((value) => !value)}>{mismatch ? 'imzayı düzelt' : 'method adını boz'}</button>}
      </div>
    </GameFrame>
  )
}

function JavaTypeRulePlayground({ lesson }) {
  const [experiment, setExperiment] = useState('wrapper')
  const [variant, setVariant] = useState(0)
  const experiments = {
    wrapper: [
      ['int', 'null ata', 'COMPILE ERROR', 'Primitive int null taşımaz.'],
      ['Integer', 'null ata', 'ALLOWED', 'Wrapper reference olduğu için null taşıyabilir; unboxing anında NPE riski vardır.'],
    ],
    collection: [
      ['String[2]', '+ üçüncü eleman', 'BLOCKED', 'Array length sabittir.'],
      ['ArrayList<String>', '+ üçüncü eleman', 'size = 3', 'ArrayList dinamik büyür.'],
    ],
    optional: [
      ['Optional.empty()', 'orElse("yok")', '"yok"', 'Değer yokluğu null kontrolü yerine explicit state olur.'],
      ['Optional.of("Ali")', 'orElse("yok")', '"Ali"', 'Değer varsa fallback kullanılmaz.'],
    ],
    record: [
      ['class UserDto', 'boilerplate', 'constructor + accessor + equals...', 'Klasik data class davranışları elle yazılabilir.'],
      ['record UserDto(String name)', 'compiler üretimi', 'name() + equals + hashCode + toString', 'Record veri taşıyan immutable-ish model için tekrar kodunu azaltır.'],
    ],
  }
  const labels = { wrapper: 'primitive / wrapper', collection: 'array / list', optional: 'Optional', record: 'record' }
  const rows = experiments[experiment]
  const current = rows[Math.min(variant, rows.length - 1)]
  const chooseExperiment = (key) => { setExperiment(key); setVariant(0) }

  return (
    <GameFrame
      lesson={lesson}
      eyebrow="TYPE RULE ENGINE"
      title="Java type kurallarını deney masasında kır."
      copy="Tek bir animasyon yerine dört ayrı kuralı tetikle: null, kapasite, yokluk ve record davranışı."
      experiment={{ change: 'Type ailesini ve test edilen işlemi değiştir.', watch: 'Sonuç compile kuralı mı, runtime state’i mi, API davranışı mı?' }}
    >
      <div className="type-rule-tabs">
        {Object.keys(experiments).map((key) => <button key={key} className={experiment === key ? 'active' : ''} onClick={() => chooseExperiment(key)}>{labels[key]}</button>)}
      </div>
      <div className="type-rule-stage">
        <div className="type-rule-options">
          {rows.map((row, index) => <button key={row[0]} className={variant === index ? 'active' : ''} onClick={() => setVariant(index)}><code>{row[0]}</code></button>)}
        </div>
        <motion.div key={`${experiment}-${variant}`} className="type-rule-output" initial={{ opacity: .3, x: 8 }} animate={{ opacity: 1, x: 0 }}>
          <small>İŞLEM</small><code>{current[1]}</code><strong>{current[2]}</strong><p>{current[3]}</p>
        </motion.div>
      </div>
    </GameFrame>
  )
}

function OopBehaviorPlayground({ lesson }) {
  const [mode, setMode] = useState('encapsulation')
  const [balance, setBalance] = useState(1000)
  const [animals, setAnimals] = useState(['Dog', 'Cat'])
  const [ran, setRan] = useState(false)

  const reset = (next) => { setMode(next); setRan(false) }

  return (
    <GameFrame lesson={lesson} eyebrow="OOP BEHAVIOR MACHINE" title="State, subtype ve dispatch aynı şey değil." copy="Her OOP ilkesinde sistemin farklı bir parçasını değiştir. Sonuç kod tanımından değil object davranışından çıksın." experiment={{ change: 'Encapsulation, polymorphism ve inheritance modları arasında geç; state veya subtype’ı değiştir.', watch: 'Davranışı hangi ilke değiştiriyor, hangisi yalnız yapıyı tanımlıyor?' }}>
      <div className="oop-machine-tabs">
        {['encapsulation', 'polymorphism', 'inheritance'].map((item) => <button key={item} className={mode === item ? 'active' : ''} onClick={() => reset(item)}>{item}</button>)}
      </div>
      {mode === 'encapsulation' && (
        <div className="oop-machine-stage capsule-stage">
          <div className="capsule-object"><small>BankAccount</small><code>private balance</code><strong>{balance} TL</strong></div>
          <div className="capsule-actions">
            <button onClick={() => { setBalance((v) => v + 100); setRan(true) }}>deposit(100)</button>
            <button onClick={() => setRan('blocked')}>caller.balance = -500</button>
          </div>
          <motion.div key={`${balance}-${ran}`} className={`capsule-result ${ran === 'blocked' ? 'bad' : ''}`} initial={{ opacity: .3 }} animate={{ opacity: 1 }}>
            {ran === 'blocked' ? 'private erişim engellendi' : ran ? 'state method üzerinden değişti' : 'bir işlem seç'}
          </motion.div>
        </div>
      )}
      {mode === 'polymorphism' && (
        <div className="oop-machine-stage poly-loop-stage">
          <div className="poly-list"><small>List&lt;Animal&gt;</small>{animals.map((animal, index) => <code key={`${animal}-${index}`}>{animal}</code>)}</div>
          <button onClick={() => setAnimals((current) => current.length === 2 ? [...current, 'Dog'] : ['Dog', 'Cat'])}>listeye subtype ekle</button>
          <button onClick={() => setRan(true)}>for (Animal a) a.sound()</button>
          <motion.div key={`${animals.length}-${ran}`} className="poly-loop-result" initial={{ opacity: .3, y: 5 }} animate={{ opacity: 1, y: 0 }}>
            {ran ? animals.map((animal, index) => <span key={`${animal}-${index}`}>{animal === 'Dog' ? 'HAV' : 'MİYAV'}</span>) : <span>runtime dispatch bekliyor</span>}
          </motion.div>
        </div>
      )}
      {mode === 'inheritance' && (
        <div className="oop-machine-stage inherit-tree-stage">
          <div className="inherit-node base"><small>BASE</small><strong>Employee</strong><code>work()</code></div>
          <div className="inherit-branch">↓ extends</div>
          <div className="inherit-node child"><small>SUBTYPE</small><strong>Manager</strong><code>approveBudget()</code></div>
          <button onClick={() => setRan(true)}>new Manager() çalıştır</button>
          <motion.div key={ran ? 'yes' : 'no'} className="inherit-result" initial={{ opacity: .3 }} animate={{ opacity: 1 }}>{ran ? 'work() ✓  +  approveBudget() ✓' : 'ortak + özel davranış bekliyor'}</motion.div>
        </div>
      )}
    </GameFrame>
  )
}

function MethodDispatchPlayground({ lesson }) {
  const [mode, setMode] = useState('overload')
  const [call, setCall] = useState(0)
  const [runtime, setRuntime] = useState('Dog')
  const calls = [
    ['print(7)', 'print(int value)'],
    ['print("7")', 'print(String value)'],
    ['print(7, 2)', 'print(int value, int copies)'],
  ]

  return (
    <GameFrame lesson={lesson} eyebrow="METHOD DISPATCH CONSOLE" title="Aynı method adı, iki farklı seçim mekanizması." copy="Overload seçimini compiler’a; override seçimini runtime object’e yaptır. Karar anını gör." experiment={{ change: 'Argument tipini ve runtime object tipini ayrı ayrı değiştir.', watch: 'Methodu compiler mı seçiyor, runtime dispatch mi?' }}>
      <div className="dispatch-machine-tabs"><button className={mode === 'overload' ? 'active' : ''} onClick={() => setMode('overload')}>overload</button><button className={mode === 'override' ? 'active' : ''} onClick={() => setMode('override')}>override</button></div>
      {mode === 'overload' ? (
        <div className="dispatch-machine-stage">
          <div className="dispatch-call-list">{calls.map((item, index) => <button key={item[0]} className={call === index ? 'active' : ''} onClick={() => setCall(index)}><code>{item[0]}</code></button>)}</div>
          <div className="dispatch-phase"><small>COMPILE-TIME</small><code>{calls[call][0]}</code><span>→</span><strong>{calls[call][1]}</strong></div>
        </div>
      ) : (
        <div className="dispatch-machine-stage runtime-dispatch-stage">
          <div className="runtime-reference"><small>REFERENCE</small><code>Animal a</code></div>
          <div className="runtime-object-picker">{['Dog', 'Cat'].map((type) => <button key={type} className={runtime === type ? 'active' : ''} onClick={() => setRuntime(type)}>new {type}()</button>)}</div>
          <motion.div key={runtime} className="runtime-dispatch-output" initial={{ opacity: .3, x: 7 }} animate={{ opacity: 1, x: 0 }}><small>RUNTIME</small><strong>{runtime}.sound()</strong><code>{runtime === 'Dog' ? 'HAV' : 'MİYAV'}</code></motion.div>
        </div>
      )}
    </GameFrame>
  )
}

function RelationshipMachinePlayground({ lesson }) {
  const scenarios = [
    ['User', 'Address', 'has-a', 'User bir Address değildir; ona sahiptir.'],
    ['EmailSender', 'Sender', 'implements', 'Capability sözleşmesi implementation’dan ayrılır.'],
    ['PdfReport', 'BaseReport', 'extends', 'Ortak state + kısmi implementation paylaşılır.'],
  ]
  const [index, setIndex] = useState(0)
  const [relation, setRelation] = useState('has-a')
  const current = scenarios[index]
  const correct = relation === current[2]

  const pickScenario = (next) => { setIndex(next); setRelation('has-a') }

  return (
    <GameFrame lesson={lesson} eyebrow="RELATIONSHIP COMPILER" title="IS-A, capability, HAS-A: oku bağla." copy="İki tipi ilişkilendir. Yanlış bağlantı görsel olarak kurulsa bile semantik kontrolden geçmesin." experiment={{ change: 'İki tipi inheritance, interface veya composition ile bağlamayı dene.', watch: 'İlişki gerçekten IS-A mı, capability mi, HAS-A mı?' }}>
      <div className="relationship-scenarios">{scenarios.map((item, i) => <button key={item[0]} className={index === i ? 'active' : ''} onClick={() => pickScenario(i)}>{item[0]} ↔ {item[1]}</button>)}</div>
      <div className="relationship-machine-stage">
        <div className="relationship-node"><small>TYPE A</small><strong>{current[0]}</strong></div>
        <div className="relationship-wire">
          {['extends', 'implements', 'has-a'].map((item) => <button key={item} className={relation === item ? 'active' : ''} onClick={() => setRelation(item)}>{item}</button>)}
        </div>
        <div className="relationship-node"><small>TYPE B</small><strong>{current[1]}</strong></div>
      </div>
      <motion.div key={`${index}-${relation}`} className={`relationship-verdict ${correct ? 'ok' : 'bad'}`} initial={{ opacity: .3, y: 5 }} animate={{ opacity: 1, y: 0 }}><strong>{correct ? 'SEMANTIC MATCH ✓' : 'SEMANTIC MISMATCH'}</strong><p>{correct ? current[3] : `Bu senaryoda beklenen ilişki: ${current[2]}`}</p></motion.div>
    </GameFrame>
  )
}

function CollectionBehaviorPlayground({ lesson }) {
  const [kind, setKind] = useState('list')
  const [list, setList] = useState(['ADMIN'])
  const [setValues, setSetValues] = useState(['ADMIN'])
  const [mapValues, setMapValues] = useState({ 42: 'Zeki' })
  const [lookup, setLookup] = useState('')

  const add = (value) => {
    if (kind === 'list') setList((current) => [...current, value])
    if (kind === 'set') setSetValues((current) => current.includes(value) ? current : [...current, value])
    if (kind === 'map') setMapValues((current) => ({ ...current, [value === 'ADMIN' ? 42 : 7]: value === 'ADMIN' ? 'Zeki' : 'Ayşe' }))
  }
  const visible = kind === 'list' ? list : kind === 'set' ? setValues : Object.entries(mapValues).map(([key, value]) => `${key} → ${value}`)

  return (
    <GameFrame lesson={lesson} eyebrow="COLLECTION BEHAVIOR SIMULATOR" title="Sıra, uniqueness ve key lookup davranışını canlı gör." copy="Aynı veriyi List, Set ve Map’e uygula. Veri yapısının seçimi çıktıyı değiştirsin." experiment={{ change: 'Aynı veriyi List, Set ve Map üzerinde çalıştır.', watch: 'Sıra, duplicate ve key ile erişim davranışı nasıl değişiyor?' }}>
      <div className="collection-kind-tabs">{['list', 'set', 'map'].map((item) => <button key={item} className={kind === item ? 'active' : ''} onClick={() => { setKind(item); setLookup('') }}>{item.toUpperCase()}</button>)}</div>
      <div className="collection-machine-stage">
        <div className="collection-actions"><button onClick={() => add('ADMIN')}>ADMIN ekle</button><button onClick={() => add('USER')}>USER ekle</button>{kind === 'map' && <button onClick={() => setLookup(mapValues[42] ?? 'NOT FOUND')}>get(42)</button>}</div>
        <motion.div key={`${kind}-${visible.join('|')}-${lookup}`} className="collection-container" initial={{ opacity: .3 }} animate={{ opacity: 1 }}>
          <small>{kind === 'list' ? 'ORDERED · DUPLICATE OK' : kind === 'set' ? 'UNIQUE VALUES' : 'KEY → VALUE'}</small>
          <div>{visible.map((item, index) => <code key={`${item}-${index}`}>{item}</code>)}</div>
          {lookup && <strong>lookup → {lookup}</strong>}
        </motion.div>
      </div>
    </GameFrame>
  )
}

function HashJourneyPlayground({ lesson }) {
  const scenarios = {
    normal: { key: 'user:42', hash: '8421', bucket: '5', equals: 'true', result: 'FOUND → Zeki' },
    collision: { key: 'order:99', hash: '8421', bucket: '5', equals: 'false → next entry', result: 'FOUND after equals()' },
    mutable: { key: 'User{id=43}', hash: '9910', bucket: '2', equals: 'never reached', result: 'MISS · key hash changed' },
  }
  const [scenario, setScenario] = useState('normal')
  const [step, setStep] = useState(0)
  const current = scenarios[scenario]
  const stages = [
    ['KEY', current.key],
    ['hashCode()', current.hash],
    ['BUCKET', current.bucket],
    ['equals()', current.equals],
    ['RESULT', current.result],
  ]
  const choose = (next) => { setScenario(next); setStep(0) }

  return (
    <GameFrame lesson={lesson} eyebrow="HASH JOURNEY" title="Key → hash → bucket → equals → result" copy="HashMap lookup’ın hangi adımda çalıştığını veya bozulduğunu tek tek ilerlet." experiment={{ change: 'Lookup zincirini ilerlet; hash veya equals davranışını boz.', watch: 'Arama bucket’ta mı, equals kontrolünde mi başarısız oluyor?' }}>
      <div className="hash-scenarios">{Object.keys(scenarios).map((item) => <button key={item} className={scenario === item ? 'active' : ''} onClick={() => choose(item)}>{item}</button>)}</div>
      <div className="hash-stage-track">{stages.map((item, index) => <motion.div key={item[0]} className={`hash-stage-node ${index < step ? 'done' : ''} ${index === step ? 'active' : ''}`} animate={{ opacity: index <= step ? 1 : .28 }}><small>{item[0]}</small><code>{item[1]}</code></motion.div>)}</div>
      <button className="hash-next" onClick={() => setStep((currentStep) => currentStep >= stages.length - 1 ? 0 : currentStep + 1)}>lookup adımını ilerlet →</button>
    </GameFrame>
  )
}

function StaticImmutabilityPlayground({ lesson }) {
  const [mode, setMode] = useState('static')
  const [aCount, setACount] = useState(0)
  const [bCount, setBCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [finalAttempt, setFinalAttempt] = useState(false)
  const [immutableVersion, setImmutableVersion] = useState(0)

  const increment = (which) => {
    if (which === 'A') setACount((v) => v + 1)
    else setBCount((v) => v + 1)
    setTotal((v) => v + 1)
  }

  return (
    <GameFrame lesson={lesson} eyebrow="STATE & MUTABILITY LAB" title="static, final ve immutable aynı kural değildir." copy="Paylaşılan class state’i, yeniden atama kısıtını ve yeni object üretimini ayrı deneylerde gör." experiment={{ change: 'static state, final reference ve immutable object senaryolarını ayrı ayrı tetikle.', watch: 'Paylaşım, yeniden atama ve içerik değişimi hangi durumda engelleniyor?' }}>
      <div className="state-rule-tabs">{['static', 'final', 'immutable'].map((item) => <button key={item} className={mode === item ? 'active' : ''} onClick={() => setMode(item)}>{item}</button>)}</div>
      {mode === 'static' && (
        <div className="static-stage">
          <div className="instance-counter"><small>OBJECT A</small><strong>count = {aCount}</strong><button onClick={() => increment('A')}>A.increment()</button></div>
          <div className="shared-counter"><small>CLASS STATE</small><strong>static total = {total}</strong><p>Her object aynı static field’ı görür.</p></div>
          <div className="instance-counter"><small>OBJECT B</small><strong>count = {bCount}</strong><button onClick={() => increment('B')}>B.increment()</button></div>
        </div>
      )}
      {mode === 'final' && (
        <div className="final-stage">
          <div><small>DECLARATION</small><code>final int limit = 10;</code></div>
          <button onClick={() => setFinalAttempt(true)}>limit = 20 dene</button>
          <motion.div key={finalAttempt ? 'blocked' : 'idle'} className={`final-result ${finalAttempt ? 'bad' : ''}`} initial={{ opacity: .3 }} animate={{ opacity: 1 }}>{finalAttempt ? 'COMPILE ERROR · final variable yeniden atanamaz' : 'yeniden atama denemesi bekliyor'}</motion.div>
        </div>
      )}
      {mode === 'immutable' && (
        <div className="immutable-stage">
          <div className="immutable-object"><small>OLD OBJECT</small><code>User@A</code><strong>name = "Zeki"</strong></div>
          <button onClick={() => setImmutableVersion((v) => v + 1)}>withName("Ali")</button>
          <motion.div key={immutableVersion} className="immutable-object new" initial={{ opacity: .3, x: 8 }} animate={{ opacity: 1, x: 0 }}><small>NEW OBJECT</small><code>User@{immutableVersion ? 'B' : '?'}</code><strong>{immutableVersion ? 'name = "Ali"' : 'henüz üretilmedi'}</strong></motion.div>
        </div>
      )}
    </GameFrame>
  )
}

function MemoryEqualityPlayground({ lesson }) {
  const [scenario, setScenario] = useState('same')
  const [dropB, setDropB] = useState(false)
  const [valueEquals, setValueEquals] = useState(false)
  const sameRef = scenario === 'same'
  const bTarget = dropB ? null : sameRef ? 'heap-A' : 'heap-B'
  const equalsResult = !dropB && (sameRef || valueEquals)

  const choose = (next) => { setScenario(next); setDropB(false) }

  return (
    <GameFrame lesson={lesson} eyebrow="STACK / HEAP EXPLORER" title="Reference ile object içeriğini ayır." copy="== reference kimliğini karşılaştırır. equals() ise ancak sınıf value equality tanımladıysa farklı object’leri içerik üzerinden eşit sayabilir." experiment={{ change: 'Reference’ları aynı object’e bağla, ayır veya birini null yap.', watch: '==, equals ve GC uygunluğu birbirinden nasıl ayrılıyor?' }}>
      <div className="memory-scenario-tabs"><button className={scenario === 'same' ? 'active' : ''} onClick={() => choose('same')}>b = a</button><button className={scenario === 'equal' ? 'active' : ''} onClick={() => choose('equal')}>b = new User("Zeki")</button><button className={valueEquals ? 'active' : ''} onClick={() => setValueEquals((v) => !v)}>equals override: {valueEquals ? 'ON' : 'OFF'}</button><button onClick={() => setDropB(true)}>b = null</button></div>
      <div className="memory-diagram">
        <div className="stack-zone"><small>STACK</small><div className="stack-ref"><code>a</code><span>→ heap-A</span></div><div className="stack-ref"><code>b</code><span>→ {bTarget ?? 'null'}</span></div></div>
        <div className="heap-zone"><small>HEAP</small><div className="heap-object primary"><code>heap-A</code><strong>User("Zeki")</strong></div>{!sameRef && <div className={`heap-object secondary ${dropB ? 'garbage' : ''}`}><code>heap-B</code><strong>User("Zeki")</strong><span>{dropB ? 'GC ELIGIBLE' : 'referenced'}</span></div>}</div>
      </div>
      <div className="equality-readout"><span><code>a == b</code><strong>{!dropB && sameRef ? 'true' : 'false'}</strong></span><span><code>a.equals(b)</code><strong>{equalsResult ? 'true' : 'false'}</strong></span></div>
      <div className="machine-observation"><b>Gözlem:</b> {dropB ? 'b=null olduğunda a == b false, a.equals(null) false olur. Ayrı heap-B artık referanssızsa GC için uygun hale gelir.' : !sameRef && !valueEquals ? 'Object.equals override edilmediyse varsayılan davranış reference equality’dir.' : valueEquals ? 'Value equality açık: farklı reference’lar aynı alan değerleriyle equals=true olabilir.' : 'Aynı reference hem == hem equals için true.'}</div>
    </GameFrame>
  )
}

function ExceptionFlowPlayground({ lesson }) {
  const [scenario, setScenario] = useState('io')
  const [declared, setDeclared] = useState(false)
  const [step, setStep] = useState(0)
  const checkedBlocked = scenario === 'io' && !declared
  const flows = {
    io: ['try', 'IOException thrown', 'catch IOException', 'finally'],
    illegal: ['try', 'IllegalArgumentException thrown', 'catch RuntimeException', 'finally'],
    none: ['try', 'normal return', 'catch skipped', 'finally'],
  }
  const current = flows[scenario]
  const pick = (next) => { setScenario(next); setStep(0); setDeclared(next !== 'io') }

  return (
    <GameFrame lesson={lesson} eyebrow="EXCEPTION CONTROL FLOW" title="Compile-time zorunluluk ile runtime akışını ayır." copy="Checked exception’da önce compiler kapısını geç; sonra try/throw/catch/finally yolunu adım adım çalıştır." experiment={{ change: 'Checked/unchecked senaryoyu seç ve throw → catch → finally akışını çalıştır.', watch: 'Compiler zorunluluğu ile runtime kontrol akışı nerede ayrılıyor?' }}>
      <div className="exception-tabs">{[['io','checked IOException'],['illegal','unchecked IllegalArgumentException'],['none','no exception']].map(([id,label]) => <button key={id} className={scenario === id ? 'active' : ''} onClick={() => pick(id)}>{label}</button>)}</div>
      {scenario === 'io' && <div className="exception-compile-gate"><code>readFile()</code><button className={declared ? 'active' : ''} onClick={() => { setDeclared((v) => !v); setStep(0) }}>{declared ? 'throws IOException ✓' : 'throws ekle'}</button><strong>{declared ? 'COMPILE ✓' : 'COMPILE ERROR'}</strong></div>}
      <div className="exception-flow-track">{current.map((label, index) => <motion.div key={label} className={`exception-node ${index < step ? 'done' : ''} ${index === step ? 'active' : ''}`} animate={{ opacity: index <= step ? 1 : .28 }}><small>{String(index + 1).padStart(2,'0')}</small><strong>{label}</strong></motion.div>)}</div>
      <button className="exception-next" disabled={checkedBlocked} onClick={() => setStep((v) => v >= current.length - 1 ? 0 : v + 1)}>{checkedBlocked ? 'önce checked exception’ı declare/handle et' : 'akışı ilerlet →'}</button>
    </GameFrame>
  )
}

function StreamPipelinePlayground({ lesson }) {
  const [filterEven, setFilterEven] = useState(true)
  const [mapTimesTen, setMapTimesTen] = useState(true)
  const [limit, setLimit] = useState(false)
  const source = [1, 2, 3, 4, 5, 6]
  const filtered = filterEven ? source.filter((n) => n % 2 === 0) : source
  const mapped = mapTimesTen ? filtered.map((n) => n * 10) : filtered
  const result = limit ? mapped.slice(0, 2) : mapped

  return (
    <GameFrame lesson={lesson} eyebrow="STREAM PIPELINE BUILDER" title="Veriyi aşama aşama dönüştür." copy="filter, map ve limit adımlarını aç/kapat. Her ara çıktıyı gör; terminal collect sonucunu canlı izle." experiment={{ change: 'filter, map ve limit aşamalarını açıp kapat.', watch: 'Her intermediate operation veri setini nasıl değiştiriyor?' }}>
      <div className="stream-controls"><button className={filterEven ? 'active' : ''} onClick={() => setFilterEven((v) => !v)}>filter(even)</button><button className={mapTimesTen ? 'active' : ''} onClick={() => setMapTimesTen((v) => !v)}>map(x10)</button><button className={limit ? 'active' : ''} onClick={() => setLimit((v) => !v)}>limit(2)</button></div>
      <div className="stream-pipeline">
        <div className="stream-stage"><small>SOURCE</small>{source.map((n) => <code key={n}>{n}</code>)}</div>
        <div className="stream-arrow">→</div>
        <motion.div key={`f-${filterEven}`} className="stream-stage" initial={{ opacity: .3 }} animate={{ opacity: 1 }}><small>FILTER</small>{filtered.map((n) => <code key={n}>{n}</code>)}</motion.div>
        <div className="stream-arrow">→</div>
        <motion.div key={`m-${mapTimesTen}`} className="stream-stage" initial={{ opacity: .3 }} animate={{ opacity: 1 }}><small>MAP</small>{mapped.map((n) => <code key={n}>{n}</code>)}</motion.div>
        <div className="stream-arrow">→</div>
        <motion.div key={`r-${result.join('-')}`} className="stream-stage result" initial={{ opacity: .3 }} animate={{ opacity: 1 }}><small>COLLECT</small>{result.map((n) => <code key={n}>{n}</code>)}</motion.div>
      </div>
    </GameFrame>
  )
}

function ConcurrencyInterleavingPlayground({ lesson }) {
  const [locked, setLocked] = useState(false)
  const [step, setStep] = useState(0)
  const unlocked = [
    ['A','read counter = 0','0'],
    ['B','read counter = 0','0'],
    ['A','write counter = 1','1'],
    ['B','write counter = 1','1'],
  ]
  const synchronized = [
    ['A','lock + read 0 + write 1','1'],
    ['A','unlock','1'],
    ['B','lock + read 1 + write 2','2'],
    ['B','unlock','2'],
  ]
  const events = locked ? synchronized : unlocked
  const current = events[Math.min(step, events.length - 1)]
  const resetMode = (value) => { setLocked(value); setStep(0) }

  return (
    <GameFrame lesson={lesson} eyebrow="THREAD INTERLEAVING LAB" title="Race condition’ı event sırasından üret." copy="Aynı counter’a iki thread erişsin. Lock kapalıyken lost update’i, açıkken serializasyonu adım adım izle." experiment={{ change: 'Lock’u aç/kapat ve iki thread’in event sırasını çalıştır.', watch: 'Lost update hangi interleaving anında oluşuyor?' }}>
      <div className="thread-mode"><button className={!locked ? 'active' : ''} onClick={() => resetMode(false)}>lock OFF</button><button className={locked ? 'active' : ''} onClick={() => resetMode(true)}>synchronized</button></div>
      <div className="thread-stage">
        <div className="thread-lanes">{events.map((event, index) => <motion.div key={`${event[0]}-${index}`} className={`thread-event t${event[0]} ${index < step ? 'done' : ''} ${index === step ? 'active' : ''}`} animate={{ opacity: index <= step ? 1 : .25 }}><small>THREAD {event[0]}</small><code>{event[1]}</code></motion.div>)}</div>
        <div className="shared-counter-box"><small>SHARED COUNTER</small><strong>{current[2]}</strong><p>{locked ? 'lock sıra garantisi sağlıyor' : step >= 3 ? 'LOST UPDATE · beklenen 2, gerçek 1' : 'interleaving devam ediyor'}</p></div>
      </div>
      <button className="thread-next" onClick={() => setStep((v) => v >= events.length - 1 ? 0 : v + 1)}>scheduler adımı →</button>
    </GameFrame>
  )
}

function SolidReviewPlayground({ lesson }) {
  const reviews = [
    { id: 'srp', title: 'OrderService her şeyi yapıyor', principle: 'SRP', before: ['validate()', 'save()', 'sendEmail()'], after: ['OrderValidator', 'OrderRepository', 'OrderNotifier'], note: 'Tek sınıfın birden fazla değişim nedeni vardı.' },
    { id: 'ocp', title: 'Payment switch büyüyor', principle: 'OCP', before: ['switch(type)', 'CARD case', 'PAYPAL case'], after: ['PaymentStrategy', 'CardStrategy', 'PaypalStrategy'], note: 'Yeni ödeme tipi eklemek mevcut switch’i değiştirmeyi gerektiriyordu.' },
    { id: 'dip', title: 'Service concrete DB’ye bağlı', principle: 'DIP', before: ['OrderService', 'new MySqlRepo()', 'save()'], after: ['OrderService', 'OrderRepository', 'MySqlRepo implements'], note: 'Yüksek seviye servis abstraction’a bağlandı.' },
  ]
  const [index, setIndex] = useState(0)
  const [refactored, setRefactored] = useState(false)
  const current = reviews[index]
  const pick = (next) => { setIndex(next); setRefactored(false) }
  const nodes = refactored ? current.after : current.before

  return (
    <GameFrame lesson={lesson} eyebrow="CODE REVIEW WORKBENCH" title="SOLID’i slogan değil, değişiklik maliyeti üzerinden gör." copy="Smell seç; refactor öncesi bağımlılık grafiğini sonra haliyle karşılaştır. Hangi principle’ın hangi problemi azalttığını izle." experiment={{ change: 'Bir code smell seç ve refactor öncesi/sonrası bağımlılık yapısını karşılaştır.', watch: 'Değişiklik maliyeti hangi SOLID ilkesiyle azalıyor?' }}>
      <div className="solid-review-tabs">{reviews.map((item, i) => <button key={item.id} className={index === i ? 'active' : ''} onClick={() => pick(i)}>{item.principle}</button>)}</div>
      <div className="solid-review-head"><strong>{current.title}</strong><button className={refactored ? 'active' : ''} onClick={() => setRefactored((v) => !v)}>{refactored ? 'before göster' : 'refactor uygula'}</button></div>
      <motion.div key={`${current.id}-${refactored}`} className={`solid-graph ${refactored ? 'after' : 'before'}`} initial={{ opacity: .3, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {nodes.map((node, i) => <div key={node} className="solid-node"><small>{String(i + 1).padStart(2,'0')}</small><strong>{node}</strong></div>)}
      </motion.div>
      <div className="solid-verdict"><code>{current.principle}</code><p>{refactored ? current.note : 'Refactor uygula; sorumluluk veya dependency yönünün nasıl değiştiğini gör.'}</p></div>
    </GameFrame>
  )
}

function HttpExchangePlayground({ lesson }) {
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/products/42')
  const [sent, setSent] = useState(false)
  const known = path === '/products/42'
  const status = !known ? '404 Not Found' : method === 'POST' ? '201 Created' : '200 OK'
  const responseBody = !known ? '{ "error": "not found" }' : method === 'POST' ? '{ "id": 43 }' : '{ "id": 42, "name": "Klavye" }'
  const send = () => setSent((v) => !v)

  return (
    <GameFrame lesson={lesson} eyebrow="HTTP EXCHANGE" title="Request gider, response geri gelir." copy="Method ve path’i değiştir. İstek ile cevabın ayrı mesajlar olduğunu, status ve body’nin response tarafında oluştuğunu gör." experiment={{ change: 'HTTP methodunu veya path’i değiştir ve request’i gönder.', watch: 'Status/body request’in hangi parçasına göre değişiyor; request ile response nerede ayrılıyor?' }}>
      <div className="http-machine-controls">
        {['GET', 'POST'].map((item) => <button key={item} className={method === item ? 'active' : ''} onClick={() => { setMethod(item); setSent(false) }}>{item}</button>)}
        {['/products/42', '/missing'].map((item) => <button key={item} className={path === item ? 'active' : ''} onClick={() => { setPath(item); setSent(false) }}>{item}</button>)}
        <button className="run" onClick={send}>request gönder →</button>
      </div>
      <div className="http-exchange-stage">
        <div className="http-endpoint client"><small>CLIENT</small><strong>Browser / App</strong></div>
        <div className="http-wire">
          <motion.div key={`${method}-${path}-${sent}`} className="http-packet request" animate={{ x: sent ? 150 : 0 }}><small>REQUEST</small><code>{method} {path}</code></motion.div>
          <motion.div key={`${status}-${sent}`} className="http-packet response" animate={{ x: sent ? -150 : 0 }}><small>RESPONSE</small><code>{status}</code></motion.div>
        </div>
        <div className="http-endpoint server"><small>SERVER</small><strong>API</strong></div>
      </div>
      <motion.div key={`${sent}-${status}`} className="http-response-readout" initial={{ opacity: .3 }} animate={{ opacity: 1 }}><span><small>STATUS</small><strong>{sent ? status : '—'}</strong></span><span><small>BODY</small><code>{sent ? responseBody : '—'}</code></span></motion.div>
    </GameFrame>
  )
}

function JsonConversionPlayground({ lesson }) {
  const [direction, setDirection] = useState('serialize')
  const [broken, setBroken] = useState(false)
  const java = 'Product{name="Klavye", price=1500}'
  const json = broken ? '{ "name": "Klavye", "price": }' : '{ "name": "Klavye", "price": 1500 }'
  const failed = direction === 'deserialize' && broken

  return (
    <GameFrame lesson={lesson} eyebrow="JSON CONVERTER" title="Object ile wire-format aynı şey değil." copy="Serialization yönünü değiştir; bozuk JSON gönderip parser’ın neden Java object üretemediğini gör." experiment={{ change: 'Serialization yönünü değiştir veya JSON syntax’ını bilerek boz.', watch: 'Java object ile JSON text arasındaki dönüşümü hangi parser/serializer yapıyor?' }}>
      <div className="json-machine-controls"><button className={direction === 'serialize' ? 'active' : ''} onClick={() => setDirection('serialize')}>Java → JSON</button><button className={direction === 'deserialize' ? 'active' : ''} onClick={() => setDirection('deserialize')}>JSON → Java</button><button className={broken ? 'danger active' : ''} onClick={() => setBroken((v) => !v)}>{broken ? 'JSON düzelt' : 'JSON boz'}</button></div>
      <div className="json-conversion-stage">
        <div className="json-side"><small>JAVA OBJECT</small><code>{java}</code></div>
        <motion.div key={`${direction}-${broken}`} className={`json-transform ${failed ? 'bad' : ''}`} initial={{ scale: .92, opacity: .3 }} animate={{ scale: 1, opacity: 1 }}><strong>{direction === 'serialize' ? 'SERIALIZE →' : '← DESERIALIZE'}</strong><span>{failed ? 'PARSE ERROR' : 'OK'}</span></motion.div>
        <div className={`json-side ${broken ? 'bad' : ''}`}><small>JSON TEXT</small><code>{json}</code></div>
      </div>
      <div className="machine-observation"><b>Gözlem:</b> JSON bir metin/veri formatıdır; Java object değildir. Dönüşüm parser/serializer tarafından yapılır.</div>
    </GameFrame>
  )
}

function EndpointRouterPlayground({ lesson }) {
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/products')
  const routes = [
    ['GET', '/products', 'listProducts()', '200 OK'],
    ['POST', '/products', 'createProduct()', '201 Created'],
    ['GET', '/products/42', 'getProduct(42)', '200 OK'],
  ]
  const pathExists = routes.some((route) => route[1] === path)
  const match = routes.find((route) => route[0] === method && route[1] === path)
  const status = match ? match[3] : pathExists ? '405 Method Not Allowed' : '404 Not Found'

  return (
    <GameFrame lesson={lesson} eyebrow="ENDPOINT ROUTER" title="Endpoint = method + path." copy="Method ve path’i bağımsız değiştir. Router’ın hangi handler’ı seçtiğini veya neden 404/405 döndüğünü gör." experiment={{ change: 'Method ve path kombinasyonunu değiştir.', watch: 'Router doğru handler’ı mı buluyor; 404 ile 405 hangi durumda ayrılıyor?' }}>
      <div className="router-controls"><div>{['GET','POST','DELETE'].map((item) => <button key={item} className={method === item ? 'active' : ''} onClick={() => setMethod(item)}>{item}</button>)}</div><div>{['/products','/products/42','/missing'].map((item) => <button key={item} className={path === item ? 'active' : ''} onClick={() => setPath(item)}>{item}</button>)}</div></div>
      <div className="router-stage">
        <div className="router-request"><small>REQUEST</small><code>{method} {path}</code></div>
        <div className="router-table">{routes.map((route) => <div key={`${route[0]}-${route[1]}`} className={match === route ? 'active' : ''}><code>{route[0]} {route[1]}</code><span>→ {route[2]}</span></div>)}</div>
        <motion.div key={`${method}-${path}`} className={`router-result ${match ? 'ok' : 'bad'}`} initial={{ opacity: .3, x: 8 }} animate={{ opacity: 1, x: 0 }}><strong>{status}</strong><code>{match ? match[2] : 'handler yok'}</code></motion.div>
      </div>
    </GameFrame>
  )
}

function ProjectAnatomyPlayground({ lesson }) {
  const tasks = [
    ['dependency', 'Yeni dependency ekle', 'pom.xml'],
    ['code', 'Controller class ekle', 'src/main/java'],
    ['config', 'DB URL değiştir', 'src/main/resources/application.yml'],
    ['test', 'Unit test ekle', 'src/test/java'],
  ]
  const [task, setTask] = useState(0)
  const [picked, setPicked] = useState(null)
  const current = tasks[task]
  const locations = ['pom.xml', 'src/main/java', 'src/main/resources/application.yml', 'src/test/java']
  const correct = picked === current[2]

  return (
    <GameFrame lesson={lesson} eyebrow="PROJECT TREE" title="İhtiyacı doğru klasöre yerleştir." copy="Spring Boot proje anatomisini dosya ağacı üzerinde çalıştır; dependency, code, config ve test yerlerini ayır." experiment={{ change: 'Görevi değiştir ve doğru proje konumunu seç.', watch: 'Dependency, source code, config ve test hangi klasöre ait?' }}>
      <div className="project-task-tabs">{tasks.map((item, index) => <button key={item[0]} className={task === index ? 'active' : ''} onClick={() => { setTask(index); setPicked(null) }}>{item[1]}</button>)}</div>
      <div className="project-tree-stage"><div className="project-need"><small>GÖREV</small><strong>{current[1]}</strong></div><div className="project-tree">{locations.map((location) => <button key={location} className={picked === location ? (correct ? 'ok active' : 'bad active') : ''} onClick={() => setPicked(location)}><code>{location}</code></button>)}</div></div>
      <motion.div key={`${task}-${picked}`} className={`project-verdict ${picked ? (correct ? 'ok' : 'bad') : ''}`} initial={{ opacity: .3 }} animate={{ opacity: 1 }}>{!picked ? 'Bir konum seç.' : correct ? `Doğru: ${current[2]}` : `Bu görev ${current[2]} altında olmalı.`}</motion.div>
    </GameFrame>
  )
}

function SpringBootAssemblyPlayground({ lesson }) {
  const [boot, setBoot] = useState(true)
  const manual = ['dependency seç', 'web server kur', 'component scan/config', 'JSON mapper config', 'application başlat']
  const booted = ['starter seç', 'auto-config uygula', 'embedded server başlat']
  const steps = boot ? booted : manual

  return (
    <GameFrame lesson={lesson} eyebrow="STARTUP ASSEMBLY" title="Spring ile Spring Boot arasındaki farkı kurulum maliyetinde gör." copy="Aynı web uygulamasını iki modda başlat. Boot’un Spring’in yerine geçmediğini; setup işini azalttığını gör." experiment={{ change: 'Manuel Spring ve Spring Boot modları arasında geç.', watch: 'Hangi altyapı adımlarını Boot otomatikleştiriyor, hangi Spring özellikleri aynı kalıyor?' }}>
      <div className="boot-mode-tabs"><button className={!boot ? 'active' : ''} onClick={() => setBoot(false)}>Spring · manuel</button><button className={boot ? 'active' : ''} onClick={() => setBoot(true)}>Spring Boot</button></div>
      <motion.div key={boot ? 'boot' : 'spring'} className="boot-assembly-stage" initial={{ opacity: .3, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        {steps.map((step, index) => <div key={step} className="boot-step"><span>{String(index + 1).padStart(2,'0')}</span><strong>{step}</strong></div>)}
      </motion.div>
      <div className="boot-summary"><span><small>SETUP ADIMI</small><strong>{steps.length}</strong></span><p>{boot ? 'Spring Boot: Spring + opinionated defaults + auto-configuration + embedded runtime kolaylığı.' : 'Spring kullanılabilir; fakat daha fazla altyapı seçimi ve wiring elle yapılır.'}</p></div>
    </GameFrame>
  )
}

function SpringAnnotationReaderPlayground({ lesson }) {
  const annotations = {
    '@Component': ['Component Scan', 'Bean registry’ye class eklenir.', 'bean: PaymentClient'],
    '@Service': ['Component Scan', 'Service stereotype bean olarak bulunur.', 'bean: OrderService'],
    '@RestController': ['MVC + Component Scan', 'Bean oluşturulur ve request handler methodları MVC’ye kaydolur.', 'bean + routes'],
    '@Transactional': ['AOP infrastructure', 'Uygun bean method çağrısı proxy üzerinden transaction advice alabilir.', 'proxy advice'],
  }
  const [annotation, setAnnotation] = useState('@Component')
  const current = annotations[annotation]

  return (
    <GameFrame lesson={lesson} eyebrow="ANNOTATION READER MAP" title="Annotation tek başına çalışmaz; bir mekanizma onu okur." copy="Annotation seç. Spring’in hangi subsystem’inin metadata’yı okuyup hangi çıktıyı ürettiğini izle." experiment={{ change: 'Spring annotation’ını değiştir.', watch: 'Metadata’yı hangi subsystem okuyor ve bean/route/proxy tarafında hangi etki oluşuyor?' }}>
      <div className="spring-annotation-tabs">{Object.keys(annotations).map((item) => <button key={item} className={annotation === item ? 'active' : ''} onClick={() => setAnnotation(item)}><code>{item}</code></button>)}</div>
      <div className="annotation-reader-stage"><div className="annotation-source"><small>SOURCE</small><code>{annotation}</code><strong>class Example {'{ ... }'}</strong></div><div className="annotation-reader"><small>OKUYAN</small><strong>{current[0]}</strong></div><motion.div key={annotation} className="annotation-effect" initial={{ opacity: .3, x: 8 }} animate={{ opacity: 1, x: 0 }}><small>ETKİ</small><strong>{current[2]}</strong><p>{current[1]}</p></motion.div></div>
    </GameFrame>
  )
}

function BeanScopePlayground({ lesson }) {
  const [scope, setScope] = useState('singleton')
  const [requests, setRequests] = useState([])
  const create = () => setRequests((current) => {
    const n = current.length + 1
    return [...current, { request: n, bean: scope === 'singleton' ? 'Bean@A' : `Bean@${String.fromCharCode(64 + n)}` }]
  })
  const changeScope = (next) => { setScope(next); setRequests([]) }

  return (
    <GameFrame lesson={lesson} eyebrow="BEAN SCOPE LAB" title="Container aynı bean’i mi verir, yenisini mi?" copy="Scope değiştir ve art arda resolve et. singleton ile prototype farkını object identity üzerinden gör." experiment={{ change: 'singleton/prototype scope’u seç ve birkaç kez getBean() çağır.', watch: 'Container aynı object identity’yi mi döndürüyor, her seferinde yeni instance mı?' }}>
      <div className="bean-scope-tabs"><button className={scope === 'singleton' ? 'active' : ''} onClick={() => changeScope('singleton')}>singleton</button><button className={scope === 'prototype' ? 'active' : ''} onClick={() => changeScope('prototype')}>prototype</button><button className="run" onClick={create}>getBean() çağır</button></div>
      <div className="bean-container-stage"><div className="bean-container"><small>SPRING CONTAINER</small><strong>{scope}</strong></div><div className="bean-resolves">{requests.length === 0 ? <span>Henüz resolve edilmedi.</span> : requests.map((entry) => <motion.div layout key={entry.request}><small>CALL {entry.request}</small><code>{entry.bean}</code></motion.div>)}</div></div>
      <div className="machine-observation"><b>Gözlem:</b> {scope === 'singleton' ? 'Varsayılan Spring scope aynı bean instance’ını tekrar verir.' : 'Prototype her resolve isteğinde yeni instance üretir.'}</div>
    </GameFrame>
  )
}

function ContainerWiringPlayground({ lesson }) {
  const missions = {
    diagnose: { title: 'Başlangıç neden çöküyor?', goal: 'İki PaymentPort bean kayıtlı. Başlangıç hatasını doğru tahmin et.', config: { stripe: true, fake: true, qualifier: 'none' } },
    missing: { title: 'Eksik bean’i onar', goal: 'FakePayment enjekte edilerek uygulamanın açılmasını sağla.', config: { stripe: false, fake: false, qualifier: 'fake' } },
    qualify: { title: 'Belirsizliği @Qualifier ile çöz', goal: 'İki bean’i de koru; StripePayment enjekte edilsin.', config: { stripe: true, fake: true, qualifier: 'none' } },
  }
  const [mission, setMission] = useState('diagnose')
  const [config, setConfig] = useState(missions.diagnose.config)
  const [prediction, setPrediction] = useState('')
  const [attempt, setAttempt] = useState(null)
  const change = (next) => { setConfig((prev) => ({ ...prev, ...next })); setAttempt(null) }
  const selectMission = (next) => { setMission(next); setConfig({ ...missions[next].config }); setPrediction(''); setAttempt(null) }
  const start = () => {
    if (!prediction) return
    const result = resolvePaymentBean(config)
    const actual = result.bean ? 'success' : result.outcome
    const meetsGoal = mission === 'diagnose' ? result.outcome === 'ambiguous'
      : mission === 'missing' ? result.outcome === 'fake'
        : result.outcome === 'stripe' && config.stripe && config.fake
    setAttempt({ ...result, passed: prediction === actual && meetsGoal, guessed: prediction === actual })
  }

  return (
    <GameFrame challenge lesson={lesson} eyebrow="IoC DEBUG LAB" title="Spring başlamıyor. Hata nerede?" copy="Bean kayıtlarını incele, injection seçimini düzelt, sonucu tahmin et. Container çalışınca tanı veya başarı kanıtı görünür." >
      <div className="challenge-tabs" aria-label="IoC görevleri">{Object.entries(missions).map(([id, item]) => <button key={id} className={mission === id ? 'active' : ''} onClick={() => selectMission(id)}>{item.title}</button>)}</div>
      <div className="challenge-brief"><small>GÖREV</small><strong>{missions[mission].goal}</strong></div>
      <div className="challenge-controls"><div><small>REGISTERED BEANS</small>{[['stripe','StripePayment'], ['fake','FakePayment']].map(([id, name]) => <label key={id}><input type="checkbox" checked={config[id]} onChange={(e) => change({ [id]: e.target.checked })}/>{name}</label>)}</div><div><small>INJECTION SELECTION</small><select aria-label="Qualifier seç" value={config.qualifier} onChange={(e) => change({ qualifier: e.target.value })}><option value="none">@Qualifier yok</option><option value="stripe">@Qualifier("stripe")</option><option value="fake">@Qualifier("fake")</option></select></div></div>
      <div className="wiring-stage"><div className="wiring-bean"><small>BEAN REGISTRY</small><strong>{[config.stripe && 'StripePayment', config.fake && 'FakePayment'].filter(Boolean).join(' + ') || 'EMPTY'}</strong><code>implements PaymentPort</code></div><div className="wiring-container"><small>IoC CONTAINER</small><strong>{!attempt ? 'not started' : attempt.bean ? 'STARTED ✓' : 'STARTUP FAILED'}</strong></div><div className="wiring-service"><small>CONSUMER</small><strong>OrderService</strong><code>{attempt?.bean ? `OrderService(${attempt.bean})` : 'OrderService(PaymentPort)'}</code></div></div>
      <div className="challenge-predict"><strong>container.start() sonucunu tahmin et</strong><div className="challenge-tabs">{[['success','Başarılı'], ['missing','Bean bulunamadı'], ['ambiguous','Birden fazla bean']].map(([id, title]) => <button key={id} className={prediction === id ? 'active' : ''} onClick={() => { setPrediction(id); setAttempt(null) }} aria-pressed={prediction === id}>{title}</button>)}</div><button className="challenge-run" disabled={!prediction} onClick={start}>Tahminimi test et: container.start()</button></div>
      {attempt && <div className={`challenge-feedback ${attempt.passed ? 'passed' : 'failed'}`} role="status"><strong>{attempt.passed ? 'GÖREV TAMAMLANDI' : 'TEKRAR DENE'}</strong><p>{attempt.detail}</p><p>{!attempt.guessed ? 'Başlangıç sonucunu yanlış tahmin ettin.' : !attempt.passed ? 'Tahmin doğru; fakat görevde istenen bean durumu henüz sağlanmadı.' : 'Tahmin ve hedef aynı anda doğru.'}</p></div>}
      <p className="challenge-caveat">Model: tek constructor dependency, Spring bean kayıtları ve @Qualifier eşleştirmesi.</p>
    </GameFrame>
  )
}

function SpringRequestPipelinePlayground({ lesson }) {
  const stages = ['HTTP','DispatcherServlet','Controller','Service','Repository','DB','Response']
  const [step, setStep] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const candidates = ['Repository', 'Response', 'Service', 'DispatcherServlet', 'DB', 'Controller']
  const descriptions = {
    HTTP: 'HTTP isteği sunucuya ulaştı.',
    DispatcherServlet: 'Spring MVC isteğe uygun handler/Controller bulur.',
    Controller: 'HTTP isteğini doğrular ve Service’e aktarır.',
    Service: 'Use-case ve iş kuralları çalışır.',
    Repository: 'Veritabanına erişim soyutlanır.',
    DB: 'SQL çalışır ve sonuç döner.',
    Response: 'Controller üzerinden HTTP response gönderilir.',
  }
  const guess = (candidate) => {
    const expected = stages[step + 1]
    if (candidate === expected) {
      setStep((v) => v + 1)
      setFeedback({ passed: true, note: `${candidate}: ${descriptions[candidate]}` })
    } else {
      setFeedback({ passed: false, note: `${candidate} bu noktada devreye girmez. Son tamamlanan aşama: ${stages[step]}. ${descriptions[stages[step]]}` })
    }
  }
  return (
    <GameFrame challenge lesson={lesson} eyebrow="REQUEST ROUTING PUZZLE" title="Spring MVC hattını ezberden kurabilir misin?" copy="Her aşamada sıradaki doğru bileşeni seç. Yanlış seçimde hat nerede koptuğunu öğren; doğru seçimle request’i tamamla.">
      <div className="challenge-brief"><small>GÖREV · {step}/6 TAMAMLANDI</small><strong>GET /students/42 isteği geldi. Sıradaki doğru bileşeni seç.</strong></div>
      <div className="request-pipeline-track">{stages.slice(0, step + 1).map((stage, index) => <motion.div layout key={stage} className={`pipeline-hop ${index < step ? 'done' : 'active'}`}><span>{String(index + 1).padStart(2,'0')}</span><strong>{stage}</strong></motion.div>)}</div>
      <div className="pipeline-explain"><strong>{stages[step]}</strong><p>{descriptions[stages[step]]}</p></div>
      {step < stages.length - 1 ? <div className="challenge-predict"><strong>Bir sonraki adım hangisi?</strong><div className="challenge-tabs">{candidates.filter((item) => !stages.slice(0, step + 1).includes(item)).map((item) => <button key={item} onClick={() => guess(item)}>{item}</button>)}</div></div> : <div className="challenge-feedback passed" role="status"><strong>REQUEST TAMAMLANDI</strong><p>Spring MVC katmanları doğru sırayla yerleştirildi.</p></div>}
      {feedback && step < stages.length - 1 && <div className={`challenge-feedback ${feedback.passed ? 'passed' : 'failed'}`} role="status"><strong>{feedback.passed ? 'DOĞRU ADIM' : 'YANLIŞ SIRA'}</strong><p>{feedback.note}</p></div>}
      <button className="challenge-reset" onClick={() => { setStep(0); setFeedback(null) }}>Akışı sıfırla</button>
      <p className="challenge-caveat">Model sadeleştirilmiştir: Filter, Interceptor, argument binding, exception resolution ve response serialization adımları gösterilmiyor.</p>
    </GameFrame>
  )
}

function ProxyBoundaryPlayground({ lesson }) {
  const [call, setCall] = useState('external')
  const [ran, setRan] = useState(false)
  const proxied = call === 'external'
  return (
    <GameFrame lesson={lesson} eyebrow="PROXY BOUNDARY" title="@Transactional annotation değil, proxy yoludur." copy="Aynı transactional methodu dışarıdan proxy üzerinden ve self-invocation ile çağır. Advice’ın neden birinde çalışıp diğerinde atlanabildiğini gör." experiment={{ change: 'External bean çağrısı ile self-invocation arasında geç ve save() çağır.', watch: 'Çağrı Spring proxy’sinden geçiyor mu; transaction advice devreye giriyor mu?' }}>
      <div className="proxy-call-tabs"><button className={call === 'external' ? 'active' : ''} onClick={() => { setCall('external'); setRan(false) }}>Controller → Bean</button><button className={call === 'self' ? 'active' : ''} onClick={() => { setCall('self'); setRan(false) }}>this.save()</button><button className="run" onClick={() => setRan(true)}>save() çağır</button></div>
      <div className="proxy-stage"><div className="proxy-caller"><small>CALLER</small><strong>{call === 'external' ? 'Controller' : 'same bean'}</strong></div>{proxied && <div className="proxy-node"><small>SPRING PROXY</small><strong>transaction advice</strong></div>}<div className="proxy-target"><small>TARGET</small><code>@Transactional</code><strong>save()</strong></div></div>
      <motion.div key={`${call}-${ran}`} className={`proxy-result ${ran ? (proxied ? 'ok' : 'bad') : ''}`} initial={{ opacity: .3 }} animate={{ opacity: 1 }}>{!ran ? 'Çağrıyı çalıştır.' : proxied ? 'TX ACTIVE · proxy interceptor devrede' : 'PROXY BYPASSED · self-invocation advice’ı atlayabilir'}</motion.div>
    </GameFrame>
  )
}

function RestResourcePlayground({ lesson }) {
  const [items, setItems] = useState([{ id: 42, name: 'Klavye' }])
  const [last, setLast] = useState('GET /products')
  const create = () => { setItems((current) => current.some((x) => x.id === 43) ? current : [...current, { id: 43, name: 'Mouse' }]); setLast('POST /products → 201') }
  const remove = () => { setItems((current) => current.filter((x) => x.id !== 42)); setLast('DELETE /products/42 → 204') }

  return (
    <GameFrame lesson={lesson} eyebrow="RESOURCE WORKBENCH" title="HTTP method resource state’ini nasıl değiştirir?" copy="GET, POST ve DELETE işlemlerini aynı resource koleksiyonuna uygula; safe/read ile mutation farkını gör." experiment={{ change: 'Aynı /products resource’una GET, POST veya DELETE uygula.', watch: 'Hangi method state’i yalnız okuyor, hangisi gerçekten değiştiriyor ve status ne oluyor?' }}>
      <div className="rest-actions"><button onClick={() => setLast('GET /products → 200')}>GET</button><button onClick={create}>POST</button><button onClick={remove}>DELETE /42</button><button onClick={() => { setItems([{ id: 42, name: 'Klavye' }]); setLast('RESET') }}>reset</button></div>
      <div className="rest-resource-stage"><div className="resource-store"><small>/products</small>{items.length ? items.map((item) => <motion.div layout key={item.id}><code>{item.id}</code><strong>{item.name}</strong></motion.div>) : <span>empty</span>}</div><motion.div key={last} className="rest-last" initial={{ opacity: .3, x: 8 }} animate={{ opacity: 1, x: 0 }}><small>SON CONTRACT</small><code>{last}</code></motion.div></div>
    </GameFrame>
  )
}

function RequestBindingPlayground({ lesson }) {
  const [focus, setFocus] = useState('path')
  const values = { path: ['42', '@PathVariable Long id'], query: ['currency=USD', '@RequestParam String currency'], body: ['{"name":"Klavye"}', '@RequestBody CreateProductRequest body'] }
  const current = values[focus]
  return (
    <GameFrame lesson={lesson} eyebrow="REQUEST BINDER" title="URL ve body parçalarını method parametrelerine bağla." copy="Path, query ve body’ye dokun. Spring MVC binding’in hangi parçayı hangi annotation ile parametreye taşıdığını gör." experiment={{ change: 'Path, query veya body bölümünü seç.', watch: 'Spring MVC bunu hangi controller parametresine ve hangi annotation ile bind ediyor?' }}>
      <div className="binding-request"><code>POST /products/<button className={focus === 'path' ? 'active' : ''} onClick={() => setFocus('path')}>42</button>?<button className={focus === 'query' ? 'active' : ''} onClick={() => setFocus('query')}>currency=USD</button></code><button className={focus === 'body' ? 'active' : ''} onClick={() => setFocus('body')}>{'{"name":"Klavye"}'}</button></div>
      <div className="binding-stage"><motion.div key={focus} className="binding-source" initial={{ opacity: .3 }} animate={{ opacity: 1 }}><small>REQUEST PARÇASI</small><code>{current[0]}</code></motion.div><div className="binding-arrow">→ bind →</div><motion.div key={`${focus}-target`} className="binding-target" initial={{ opacity: .3 }} animate={{ opacity: 1 }}><small>CONTROLLER PARAM</small><code>{current[1]}</code></motion.div></div>
    </GameFrame>
  )
}

function DtoBoundaryPlayground({ lesson }) {
  const [fields, setFields] = useState(['id', 'name', 'costPrice'])
  const [attempt, setAttempt] = useState(null)
  const entity = { id: 42, name: 'Klavye', price: 1500, costPrice: 900, supplierSecret: 'ACME-KEY' }
  const selectField = (field) => { setFields((xs) => xs.includes(field) ? xs.filter((x) => x !== field) : [...xs, field]); setAttempt(null) }
  const validate = () => {
    const required = ['id', 'name', 'price']
    const missing = required.filter((x) => !fields.includes(x))
    const leaked = ['costPrice', 'supplierSecret'].filter((x) => fields.includes(x))
    setAttempt({ missing, leaked, passed: missing.length === 0 && leaked.length === 0, values: Object.fromEntries(Object.entries(entity).filter(([k]) => fields.includes(k))) })
  }
  return (
    <GameFrame challenge lesson={lesson} eyebrow="DTO CONTRACT REVIEW" title="API response alanlarını sen tasarla." copy="Müşteri id, name, price istiyor. İç maliyet ve tedarikçi anahtarı gizli. Alanları tek tek seç, DTO contract’ını denetle.">
      <div className="challenge-brief"><small>API REQUIREMENT</small><strong>GET /products/42: id, name ve price mutlaka dönmeli. costPrice ve supplierSecret dışarı sızmamalı.</strong></div>
      <div className="challenge-field-picker" aria-label="Response alanları">{Object.keys(entity).map((field) => <label key={field}><input type="checkbox" checked={fields.includes(field)} onChange={() => selectField(field)}/><code>{field}</code></label>)}</div>
      <div className="dto-boundary-stage"><div className="dto-entity"><small>ENTITY · INTERNAL</small>{Object.entries(entity).map(([key,value]) => <code key={key}>{key}: {String(value)}</code>)}</div><div className="dto-map-arrow">mapper →</div><div className={`dto-response ${attempt?.leaked.length ? 'bad' : ''}`}><small>API RESPONSE</small>{attempt ? Object.entries(attempt.values).map(([key,value]) => <code key={key}>{key}: {String(value)}</code>) : <code>Contract henüz gönderilmedi.</code>}</div></div>
      <button className="challenge-run" onClick={validate}>DTO contract’ını denetle</button>
      {attempt && <div className={`challenge-feedback ${attempt.passed ? 'passed' : 'failed'}`} role="status"><strong>{attempt.passed ? 'GÜVENLİ RESPONSE · TAMAMLANDI' : 'CONTRACT HATALI'}</strong><p>{attempt.missing.length ? `Eksik alan: ${attempt.missing.join(', ')}. ` : ''}{attempt.leaked.length ? `İç bilgi sızıyor: ${attempt.leaked.join(', ')}.` : ''}{attempt.passed ? 'Gerekli alanlar var, gizli alanlar çıkarıldı.' : ''}</p></div>}
    </GameFrame>
  )
}

function ValidationGatePlayground({ lesson }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const nameOk = name.trim().length >= 2
  const priceOk = price > 0
  const valid = nameOk && priceOk
  return (
    <GameFrame lesson={lesson} eyebrow="VALIDATION GATE" title="Geçersiz request controller use-case’ine ulaşmasın." copy="DTO alanlarını değiştir. Validation constraint’leri geçilmeden service çağrısının neden bloklandığını gör." experiment={{ change: 'name ve price alanlarını constraint sınırlarının içine/dışına taşı.', watch: 'Validator hangi durumda service çağrısını bloklayıp 400 üretiyor?' }}>
      <div className="validation-form"><label><small>name · @Size(min=2)</small><input value={name} onChange={(e) => setName(e.target.value)} placeholder="ürün adı" /><span>{nameOk ? '✓' : 'min 2 karakter'}</span></label><label><small>price · @Positive</small><input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} /><span>{priceOk ? '✓' : '> 0 olmalı'}</span></label></div>
      <motion.div key={`${nameOk}-${priceOk}`} className={`validation-gate-result ${valid ? 'ok' : 'bad'}`} initial={{ opacity: .3 }} animate={{ opacity: 1 }}><div><small>VALIDATOR</small><strong>{valid ? 'PASS' : 'REJECT'}</strong></div><span>→</span><div><small>SERVICE</small><strong>{valid ? 'createProduct() çağrılır' : 'çağrılmaz · 400'}</strong></div></motion.div>
    </GameFrame>
  )
}

function ApiStatusDecisionPlayground({ lesson }) {
  const [exists, setExists] = useState(true)
  const [authorized, setAuthorized] = useState(true)
  const [validBody, setValidBody] = useState(true)
  const [serverFail, setServerFail] = useState(false)
  let status = '200 OK'
  if (serverFail) status = '500 Internal Server Error'
  else if (!authorized) status = '403 Forbidden'
  else if (!validBody) status = '400 Bad Request'
  else if (!exists) status = '404 Not Found'
  const family = status[0] === '2' ? 'SUCCESS' : status[0] === '4' ? 'CLIENT / ACCESS' : 'SERVER'
  return (
    <GameFrame lesson={lesson} eyebrow="STATUS DECISION ENGINE" title="Status code’u senaryo belirlesin." copy="Resource, authorization, body ve server durumunu değiştir. Aynı endpoint için status’un neden değiştiğini gör." experiment={{ change: 'Resource, yetki, request body veya server durumunu değiştir.', watch: '200/400/403/404/500 seçimini hangi problem sınıfı belirliyor?' }}>
      <div className="status-switches"><button className={exists ? 'active' : ''} onClick={() => setExists((v) => !v)}>resource {exists ? 'VAR' : 'YOK'}</button><button className={authorized ? 'active' : ''} onClick={() => setAuthorized((v) => !v)}>yetki {authorized ? 'VAR' : 'YOK'}</button><button className={validBody ? 'active' : ''} onClick={() => setValidBody((v) => !v)}>body {validBody ? 'VALID' : 'INVALID'}</button><button className={serverFail ? 'danger active' : ''} onClick={() => setServerFail((v) => !v)}>server {serverFail ? 'FAIL' : 'OK'}</button></div>
      <motion.div key={status} className={`status-decision ${status.startsWith('2') ? 'ok' : status.startsWith('5') ? 'bad' : 'warn'}`} initial={{ opacity: .3, scale: .97 }} animate={{ opacity: 1, scale: 1 }}><small>{family}</small><strong>{status}</strong><p>{status.startsWith('4') ? 'Request/resource/access kaynaklı problem.' : status.startsWith('5') ? 'Server beklenmeyen hata yaşadı.' : 'Request başarıyla işlendi.'}</p></motion.div>
    </GameFrame>
  )
}

function SqlFilterSortPlayground({ lesson }) {
  const rows = [
    { id: 1, name: 'Klavye', price: 1500 },
    { id: 2, name: 'Mouse', price: 800 },
    { id: 3, name: 'Monitor', price: 7200 },
    { id: 4, name: 'Kulaklık', price: 2100 },
  ]
  const [filter, setFilter] = useState(false)
  const [desc, setDesc] = useState(false)
  const [columns, setColumns] = useState('all')
  const visible = rows
    .filter((row) => !filter || row.price >= 1500)
    .sort((a, b) => desc ? b.price - a.price : a.price - b.price)
  const query = `SELECT ${columns === 'all' ? '*' : 'name, price'} FROM product${filter ? ' WHERE price >= 1500' : ''} ORDER BY price ${desc ? 'DESC' : 'ASC'}`

  return (
    <GameFrame lesson={lesson} eyebrow="SQL QUERY BUILDER" title="SELECT, WHERE ve ORDER BY sonucu gerçekten değiştirsin." copy="Kolon seç, filtreyi aç ve sıralamayı değiştir. Query ile result set arasındaki ilişkiyi tablo üstünde gör." experiment={{ change: 'SELECT kolonlarını, WHERE filtresini ve ORDER yönünü değiştir.', watch: 'Result set’in kolonları, satır sayısı ve sırası nasıl değişiyor?' }}>
      <div className="data-machine-controls"><button className={columns === 'all' ? 'active' : ''} onClick={() => setColumns('all')}>SELECT *</button><button className={columns === 'partial' ? 'active' : ''} onClick={() => setColumns('partial')}>SELECT name, price</button><button className={filter ? 'active' : ''} onClick={() => setFilter((v) => !v)}>WHERE price ≥ 1500</button><button className={desc ? 'active' : ''} onClick={() => setDesc((v) => !v)}>ORDER {desc ? 'DESC' : 'ASC'}</button></div>
      <div className="sql-query-readout"><code>{query}</code></div>
      <div className="sql-result-table">{visible.map((row) => <motion.div layout key={row.id}><span>{columns === 'all' && <code>#{row.id}</code>}</span><strong>{row.name}</strong><code>{row.price} TL</code></motion.div>)}</div>
    </GameFrame>
  )
}

function SqlJoinWorkbench({ lesson }) {
  const missions = {
    all: 'Siparişi olmayanlar dahil tüm kullanıcı ve sipariş eşleşmelerini getir (5 satır).',
    expensive: 'Yalnızca 1000 TL üstü siparişleri getir (2 satır).',
    unmatched: 'Hiç siparişi olmayan kullanıcıları getir (2 satır).',
  }
  const [mission, setMission] = useState('all')
  const [joinType, setJoinType] = useState('inner')
  const [where, setWhere] = useState('all')
  const [attempt, setAttempt] = useState(null)
  const query = `SELECT u.name, o.id, o.total FROM users u ${joinType.toUpperCase()} JOIN orders o ON u.id = o.user_id${where === 'high' ? ' WHERE o.total > 1000' : where === 'none' ? ' WHERE o.id IS NULL' : ''}`
  const run = () => { const rows = runJoinQuery({ joinType, where }); setAttempt({ rows, passed: joinMissionPassed(mission, rows) }) }

  return (
    <GameFrame challenge lesson={lesson} eyebrow="SQL RESULT CHALLENGE" title="İstenen sonucu hangi JOIN + WHERE verir?" copy="Hedefi seç, JOIN ve filtreyi kur, sorguyu çalıştır. Sonuç yalnızca çalıştırınca açılır; tam satır kümesi kontrol edilir." >
      <div className="challenge-tabs">{Object.entries(missions).map(([id]) => <button key={id} className={mission === id ? 'active' : ''} onClick={() => { setMission(id); setAttempt(null) }}>{id === 'all' ? 'Tüm kullanıcılar' : id === 'expensive' ? 'Pahalı siparişler' : 'Siparişsiz kullanıcılar'}</button>)}</div>
      <div className="challenge-brief"><small>QUERY TASK</small><strong>{missions[mission]}</strong></div>
      <div className="join-stage"><div className="join-table"><small>users</small>{joinUsers.map((u) => <div key={u.id}><code>{u.id}</code><strong>{u.name}</strong></div>)}</div><div className="join-link">ON u.id = o.user_id</div><div className="join-table"><small>orders</small>{joinOrders.map((o) => <div key={o.id}><code>#{o.id} · user {o.userId}</code><strong>{o.total} TL</strong></div>)}</div></div>
      <div className="data-machine-controls">{['inner', 'left'].map((id) => <button key={id} className={joinType === id ? 'active' : ''} onClick={() => { setJoinType(id); setAttempt(null) }}>{id.toUpperCase()} JOIN</button>)}{[['all', 'WHERE yok'], ['high', 'WHERE total > 1000'], ['none', 'WHERE o.id IS NULL']].map(([id, label]) => <button key={id} className={where === id ? 'active' : ''} onClick={() => { setWhere(id); setAttempt(null) }}>{label}</button>)}</div>
      <div className="challenge-query"><code>{query}</code></div>
      <button className="challenge-run" onClick={run}>Sorguyu çalıştır ve hedefi doğrula</button>
      {attempt && <><div className="challenge-sql-results" aria-label="Sorgu sonuçları"><small>RESULT SET · {attempt.rows.length} ROWS</small><div className="challenge-sql-head"><span>USER</span><span>ORDER ID</span><span>TOTAL</span></div>{attempt.rows.length ? attempt.rows.map((r) => <div key={`${r.userId}-${r.orderId}`}><strong>{r.name}</strong><code>{r.orderId ?? 'NULL'}</code><code>{r.total ?? 'NULL'}</code></div>) : <p>0 rows</p>}</div><div className={`challenge-feedback ${attempt.passed ? 'passed' : 'failed'}`} role="status"><strong>{attempt.passed ? 'DOĞRU SONUÇ KÜMESİ' : 'SONUÇ HEDEFE UYMUYOR'}</strong><p>{attempt.passed ? 'İstenen kayıtların tamamı geldi.' : mission === 'all' ? 'LEFT JOIN eşleşmeyen kullanıcıları da NULL siparişle korur.' : mission === 'unmatched' ? 'INNER JOIN eşleşmeyen satır üretmez; LEFT JOIN + IS NULL düşün.' : 'WHERE o.total > 1000 koşulunu uygula.'}</p></div></>}
    </GameFrame>
  )
}

function GroupAggregatePlayground({ lesson }) {
  const sales = [
    ['Backend', 1200], ['Backend', 800], ['Frontend', 500], ['Frontend', 700], ['Data', 2000],
  ]
  const [aggregate, setAggregate] = useState('SUM')
  const [having, setHaving] = useState(false)
  const grouped = Object.entries(sales.reduce((acc, [team, amount]) => {
    acc[team] = acc[team] ?? []
    acc[team].push(amount)
    return acc
  }, {})).map(([team, values]) => [team, aggregate === 'SUM' ? values.reduce((a, b) => a + b, 0) : values.length])
  const threshold = aggregate === 'SUM' ? 1500 : 1
  const visible = grouped.filter(([, value]) => !having || value > threshold)

  return (
    <GameFrame lesson={lesson} eyebrow="GROUP & AGGREGATE LAB" title="WHERE satırı, HAVING grubu filtreler." copy="Aggregate fonksiyonunu ve HAVING’i değiştir; raw row’ların nasıl group result’a dönüştüğünü gör." experiment={{ change: 'SUM/COUNT aggregate’ını değiştir ve HAVING filtresini aç.', watch: 'Raw row’lar önce nasıl gruplanıyor, HAVING hangi aggregate sonucu eliyor?' }}>
      <div className="data-machine-controls"><button className={aggregate === 'SUM' ? 'active' : ''} onClick={() => setAggregate('SUM')}>SUM(amount)</button><button className={aggregate === 'COUNT' ? 'active' : ''} onClick={() => setAggregate('COUNT')}>COUNT(*)</button><button className={having ? 'active' : ''} onClick={() => setHaving((v) => !v)}>HAVING {aggregate === 'SUM' ? '> 1500' : '> 1'}</button></div>
      <div className="grouping-stage"><div className="raw-sales"><small>RAW ROWS</small>{sales.map(([team, amount], i) => <code key={i}>{team} · {amount}</code>)}</div><div className="group-arrow">GROUP BY team →</div><motion.div key={`${aggregate}-${having}`} className="group-output" initial={{ opacity: .3 }} animate={{ opacity: 1 }}><small>{aggregate} BY TEAM</small>{visible.map(([team, value]) => <div key={team}><strong>{team}</strong><code>{value}</code></div>)}</motion.div></div>
    </GameFrame>
  )
}

function SchemaDesignPlayground({ lesson }) {
  const [mode, setMode] = useState('index')
  const [indexed, setIndexed] = useState(false)
  const [normalized, setNormalized] = useState(false)
  const [fkOk, setFkOk] = useState(true)

  return (
    <GameFrame lesson={lesson} eyebrow="SCHEMA DESIGN LAB" title="PK, FK, Index ve normalization farklı sorunları çözer." copy="Üç mini deney arasında geçiş yap: lookup maliyeti, referential integrity ve tekrar eden veriyi ayırma." experiment={{ change: 'Index, PK/FK ve normalization deneyleri arasında geçip koşulu boz/düzelt.', watch: 'Performans, referential integrity ve tekrar eden veri farklı araçlarla nasıl çözülüyor?' }}>
      <div className="data-machine-controls"><button className={mode === 'index' ? 'active' : ''} onClick={() => setMode('index')}>INDEX</button><button className={mode === 'fk' ? 'active' : ''} onClick={() => setMode('fk')}>PK / FK</button><button className={mode === 'normalization' ? 'active' : ''} onClick={() => setMode('normalization')}>NORMALIZATION</button></div>
      {mode === 'index' && <div className="schema-experiment"><div><small>QUERY</small><code>WHERE email = 'a@x.com'</code></div><button className={indexed ? 'active' : ''} onClick={() => setIndexed((v) => !v)}>{indexed ? 'INDEX ON' : 'INDEX OFF'}</button><motion.div key={indexed ? 'idx' : 'scan'}><strong>{indexed ? 'INDEX SEEK' : 'FULL TABLE SCAN'}</strong><p>{indexed ? 'Daha az row inspect edilir.' : 'Tablodaki satırlar taranır.'}</p></motion.div></div>}
      {mode === 'fk' && <div className="schema-experiment"><div><small>orders.user_id</small><code>{fkOk ? '2' : '999'}</code></div><button className={fkOk ? 'active' : 'bad' } onClick={() => setFkOk((v) => !v)}>FK value değiştir</button><motion.div key={fkOk ? 'valid' : 'invalid'}><strong>{fkOk ? 'INSERT OK' : 'FK VIOLATION'}</strong><p>{fkOk ? 'users.id=2 mevcut.' : 'Parent key bulunamadı.'}</p></motion.div></div>}
      {mode === 'normalization' && <div className="normalization-stage"><div className="wide-table"><small>TEKRARLI TABLO</small><code>order1 · Zeki · İzmir</code><code>order2 · Zeki · İzmir</code></div><button className={normalized ? 'active' : ''} onClick={() => setNormalized((v) => !v)}>{normalized ? 'birleştir' : 'normalize et'}</button><motion.div key={normalized ? 'norm' : 'wide'} className="normalized-tables">{normalized ? <><code>user(1, Zeki, İzmir)</code><code>order(1, user=1)</code><code>order(2, user=1)</code></> : <code>aynı kullanıcı verisi iki row’da tekrar</code>}</motion.div></div>}
    </GameFrame>
  )
}

function AcidIsolationPlayground({ lesson }) {
  const [mode, setMode] = useState('atomicity')
  const [step, setStep] = useState(0)
  const [isolation, setIsolation] = useState('READ COMMITTED')
  const modes = ['atomicity', 'isolation', 'deadlock']
  const reset = (next) => { setMode(next); setStep(0) }

  return (
    <GameFrame lesson={lesson} eyebrow="TRANSACTION PHYSICS" title="ACID, isolation ve deadlock davranışını ayrı deneylerde izle." copy="Para transferi, concurrent read ve lock sırası üzerinden transaction garantilerinin neden gerektiğini gör." experiment={{ change: 'Atomicity, isolation ve deadlock senaryolarını ayrı ayrı çalıştır.', watch: 'Rollback, görünürlük ve lock bekleme problemleri hangi garantiyle ilişkili?' }}>
      <div className="data-machine-controls">{modes.map((item) => <button key={item} className={mode === item ? 'active' : ''} onClick={() => reset(item)}>{item}</button>)}</div>
      {mode === 'atomicity' && <div className="acid-stage"><div className="account-box"><small>A</small><strong>{step < 1 ? 1000 : step >= 3 ? 1000 : 900}</strong></div><div className="acid-events"><button onClick={() => setStep((v) => v >= 3 ? 0 : v + 1)}>transfer step →</button><code>{['BEGIN','A -100','B +100 fails','ROLLBACK'][step]}</code></div><div className="account-box"><small>B</small><strong>{step >= 2 && step < 3 ? 600 : 500}</strong></div></div>}
      {mode === 'isolation' && <div className="isolation-stage"><div className="isolation-options">{['READ COMMITTED','REPEATABLE READ'].map((item) => <button key={item} className={isolation === item ? 'active' : ''} onClick={() => setIsolation(item)}>{item}</button>)}</div><div className="tx-lanes"><div><small>TX A</small><code>SELECT balance → 1000</code><code>SELECT again → {isolation === 'READ COMMITTED' ? '1200' : '1000'}</code></div><div><small>TX B</small><code>UPDATE balance = 1200</code><code>COMMIT</code></div></div></div>}
      {mode === 'deadlock' && <div className="deadlock-stage"><div><small>TX A</small><code>lock row 1 ✓</code><code>wait row 2…</code></div><div className="deadlock-cross">×</div><div><small>TX B</small><code>lock row 2 ✓</code><code>wait row 1…</code></div><strong>DEADLOCK → DB bir transaction’ı abort eder</strong></div>}
    </GameFrame>
  )
}

function JpaStateSqlPlayground({ lesson }) {
  const [action, setAction] = useState('persist')
  const [managed, setManaged] = useState(false)
  const [name, setName] = useState('Klavye')
  const sql = action === 'persist'
    ? 'INSERT INTO product(name) VALUES (?)'
    : action === 'find'
      ? 'SELECT * FROM product WHERE id = ?'
      : 'UPDATE product SET name = ? WHERE id = ?'
  const run = () => { if (action === 'persist' || action === 'find') setManaged(true) }

  return (
    <GameFrame lesson={lesson} eyebrow="JPA STATE → SQL" title="JPA object state’i relational operasyona çevirir." copy="persist/find/dirty-check akışlarını değiştir; EntityManager/Hibernate’in hangi SQL’i üretebildiğini gör." experiment={{ change: 'persist/find/dirty-check aksiyonunu seç ve managed entity state’ini değiştir.', watch: 'Hibernate hangi durumda INSERT, SELECT veya UPDATE SQL’i üretiyor?' }}>
      <div className="data-machine-controls">{['persist','find','dirty-check'].map((item) => <button key={item} className={action === item ? 'active' : ''} onClick={() => setAction(item)}>{item}</button>)}<button className="run" onClick={run}>çalıştır</button></div>
      <div className="jpa-state-stage"><div className={`entity-state ${managed ? 'managed' : ''}`}><small>ENTITY</small><strong>Product</strong><input value={name} onChange={(e) => { setName(e.target.value); if (managed) setAction('dirty-check') }} /><code>{managed ? 'MANAGED' : 'TRANSIENT'}</code></div><div className="jpa-provider"><small>HIBERNATE</small><strong>ORM provider</strong><span>↓ translate</span></div><motion.div key={`${action}-${name}-${managed}`} className="sql-emission" initial={{ opacity: .3 }} animate={{ opacity: 1 }}><small>SQL</small><code>{managed || action !== 'dirty-check' ? sql : 'entity managed değil'}</code></motion.div></div>
    </GameFrame>
  )
}

function RepositoryQueryPlayground({ lesson }) {
  const methods = {
    'findById(42)': ['SELECT ... WHERE id = 42', ['Klavye']],
    'findByPriceGreaterThan(1000)': ['SELECT ... WHERE price > 1000', ['Klavye','Monitor']],
    'findAll()': ['SELECT ... FROM product', ['Klavye','Mouse','Monitor']],
  }
  const [method, setMethod] = useState('findById(42)')
  const current = methods[method]
  return (
    <GameFrame lesson={lesson} eyebrow="REPOSITORY QUERY TRANSLATOR" title="Repository method çağrısı DB query’sine dönüşsün." copy="Method seç; repository abstraction’ın arkasındaki query niyetini ve dönen sonucu birlikte gör." experiment={{ change: 'Repository methodunu değiştir.', watch: 'Method adı hangi SQL niyetine çevriliyor ve result shape nasıl değişiyor?' }}>
      <div className="repository-methods">{Object.keys(methods).map((item) => <button key={item} className={method === item ? 'active' : ''} onClick={() => setMethod(item)}><code>{item}</code></button>)}</div>
      <div className="repository-stage"><div><small>SERVICE CALL</small><code>productRepository.{method}</code></div><div className="repo-arrow">→</div><motion.div key={method}><small>SQL INTENT</small><code>{current[0]}</code></motion.div><div className="repo-arrow">→</div><motion.div key={`${method}-rows`}><small>RESULT</small>{current[1].map((row) => <code key={row}>{row}</code>)}</motion.div></div>
    </GameFrame>
  )
}

function EntityRelationPlayground({ lesson }) {
  const [relation, setRelation] = useState('many-to-one')
  const bidirectional = relation === 'bidirectional'
  return (
    <GameFrame lesson={lesson} eyebrow="ENTITY RELATION MAP" title="Object relation’ı foreign key ile nasıl temsil edilir?" copy="FK orders.user_id kolonunda olduğunda ilişkiyi yöneten taraf Order.user’dır. User.orders eklenirse mappedBy ile inverse taraf olur." experiment={{ change: 'Unidirectional ve bidirectional mapping arasında geç.', watch: 'Owning side neresi; mappedBy yeni owner mı oluşturuyor, mevcut owner’ı mı işaret ediyor?' }}>
      <div className="data-machine-controls"><button className={!bidirectional ? 'active' : ''} onClick={() => setRelation('many-to-one')}>Unidirectional ManyToOne</button><button className={bidirectional ? 'active' : ''} onClick={() => setRelation('bidirectional')}>Bidirectional</button></div>
      <div className="relation-db-stage"><div className="entity-box"><small>JAVA · INVERSE</small><strong>User</strong><code>{bidirectional ? '@OneToMany(mappedBy="user") orders' : 'orders alanı yok'}</code></div><div className="relation-edge">Order → User<span>owning side: Order.user</span></div><div className="entity-box"><small>JAVA · OWNER</small><strong>Order</strong><code>@ManyToOne @JoinColumn(name="user_id")</code></div></div>
      <motion.div key={relation} className="fk-readout" initial={{ opacity: .3 }} animate={{ opacity: 1 }}><small>RELATIONAL MODEL</small><code>orders.user_id → users.id</code><p>{bidirectional ? 'User.orders ilişkiyi tekrar sahiplenmez; mappedBy mevcut owning side’ı işaret eder.' : 'Tek yönlü mapping yeterliyse yalnız Order.user üzerinden ilişki yönetilir.'}</p></motion.div>
    </GameFrame>
  )
}

function TransactionBoundaryPlayground({ lesson }) {
  const [transaction, setTransaction] = useState(true)
  const [rollbackForChecked, setRollbackForChecked] = useState(false)
  const [failure, setFailure] = useState('checked')
  const [prediction, setPrediction] = useState('')
  const [attempt, setAttempt] = useState(null)
  const run = () => { if (!prediction) return; const result = simulateOrderTransaction({ transaction, rollbackForChecked, failure }); setAttempt({ ...result, passed: prediction === result.outcome }) }
  return (
    <GameFrame challenge lesson={lesson} eyebrow="TRANSACTION PREDICTION" title="Hata fırlayınca veritabanında ne kalır?" copy="Bir exception tipi seç, transaction sınırını kur. Order ve payment INSERT sonuçlarını çalıştırmadan önce tahmin et.">
      <div className="challenge-brief"><small>OLAY</small><strong>placeOrder(): önce order INSERT, sonra payment INSERT. İkinci adımda seçtiğin hata oluşabilir.</strong></div>
      <div className="challenge-controls"><label><input type="checkbox" checked={transaction} onChange={(e) => { setTransaction(e.target.checked); setAttempt(null) }}/>@Transactional</label><label><input type="checkbox" checked={rollbackForChecked} onChange={(e) => { setRollbackForChecked(e.target.checked); setAttempt(null) }} disabled={!transaction}/>rollbackFor = IOException.class</label><label>İkinci adım<select aria-label="İkinci adımın sonucu" value={failure} onChange={(e) => { setFailure(e.target.value); setAttempt(null) }}><option value="none">Başarılı</option><option value="runtime">RuntimeException</option><option value="checked">Checked IOException</option></select></label></div>
      <div className="challenge-query"><code>{transaction ? `@Transactional${rollbackForChecked ? '(rollbackFor = IOException.class)' : ''}` : '// transaction sınırı yok'}</code><code>saveOrder(); savePayment(); {failure !== 'none' ? `// ${failure === 'runtime' ? 'RuntimeException' : 'IOException'} fırlatılır` : '// başarılı'}</code></div>
      <div className="challenge-predict"><strong>İşlem sonunda DB durumu?</strong><div className="challenge-tabs">{[['commit','İki kayıt COMMIT'], ['rollback','ROLLBACK'], ['partial','Yalnız order COMMIT']].map(([id, label]) => <button key={id} className={prediction === id ? 'active' : ''} onClick={() => { setPrediction(id); setAttempt(null) }} aria-pressed={prediction === id}>{label}</button>)}</div><button className="challenge-run" disabled={!prediction} onClick={run}>placeOrder() çalıştır</button></div>
      <div className="transaction-boundary-stage"><div className={attempt?.order === 'COMMITTED' ? 'saved' : ''}><small>STEP 1 · ORDER</small><strong>saveOrder()</strong><code>{attempt?.order ?? 'NOT EXECUTED'}</code></div><div className={attempt?.payment === 'COMMITTED' ? 'saved' : attempt ? 'failed' : ''}><small>STEP 2 · PAYMENT</small><strong>savePayment()</strong><code>{attempt?.payment ?? 'NOT EXECUTED'}</code></div></div>
      {attempt && <div className={`challenge-feedback ${attempt.passed ? 'passed' : 'failed'}`} role="status"><strong>{attempt.passed ? 'DOĞRU TAHMİN' : 'YANLIŞ TAHMİN'} · {attempt.outcome.toUpperCase()}</strong><p>{attempt.detail}</p></div>}
      <p className="challenge-caveat">Model varsayımı: tek veritabanı, proxy üzerinden dış çağrı, exception method dışına yayılıyor. Birden çok servis/DB transaction’ı değildir.</p>
    </GameFrame>
  )
}

function PaginationNPlusOnePlayground({ lesson }) {
  const [pageSize, setPageSize] = useState(2)
  const [page, setPage] = useState(0)
  const [fetchJoin, setFetchJoin] = useState(false)
  const total = 6
  const pages = Math.ceil(total / pageSize)
  const start = page * pageSize
  const ids = Array.from({ length: Math.min(pageSize, total - start) }, (_, i) => start + i + 1)
  const queryCount = fetchJoin ? 1 : 1 + ids.length
  const changeSize = (size) => { setPageSize(size); setPage(0) }

  return (
    <GameFrame lesson={lesson} eyebrow="PAGINATION & N+1 METER" title="Daha az row çekmek ile daha az query atmak farklı problemler." copy="Page size ve fetch strategy’yi değiştir. Pagination’ın row sayısını, N+1’in query sayısını nasıl etkilediğini ölç." experiment={{ change: 'Page size/page numarasını ve fetch join stratejisini değiştir.', watch: 'Pagination row sayısını; N+1 ise query sayısını nasıl ayrı ayrı etkiliyor?' }}>
      <div className="data-machine-controls">{[2,3].map((size) => <button key={size} className={pageSize === size ? 'active' : ''} onClick={() => changeSize(size)}>size={size}</button>)}<button onClick={() => setPage((v) => (v + 1) % pages)}>page={page}</button><button className={fetchJoin ? 'active' : ''} onClick={() => setFetchJoin((v) => !v)}>fetch join {fetchJoin ? 'ON' : 'OFF'}</button></div>
      <div className="pagination-stage"><div className="page-window"><small>VISIBLE ORDERS</small>{ids.map((id) => <code key={id}>Order #{id}</code>)}</div><div className="query-meter"><small>DB QUERY COUNT</small><strong>{queryCount}</strong><p>{fetchJoin ? 'Order + customer tek query’de alındı.' : `1 order query + ${ids.length} customer query`}</p></div></div>
    </GameFrame>
  )
}

const foundationPlaygroundComponents = {
  'java-class': ClassObjectPlayground,
  'methods-constructor': MethodCallPlayground,
  interface: InterfaceContractPlayground,
  'annotation-basics': AnnotationMetadataPlayground,
  'generics-record': JavaTypeRulePlayground,
  'java-oop': OopBehaviorPlayground,
  'java-overload-override': MethodDispatchPlayground,
  'java-abstract-composition': RelationshipMachinePlayground,
  'java-collections': CollectionBehaviorPlayground,
  'java-hashmap': HashJourneyPlayground,
  'java-static-immutability': StaticImmutabilityPlayground,
  'java-memory-equality': MemoryEqualityPlayground,
  'java-exceptions': ExceptionFlowPlayground,
  'java-streams': StreamPipelinePlayground,
  'java-concurrency': ConcurrencyInterleavingPlayground,
  'solid-clean-code': SolidReviewPlayground,
}

const conceptPlaygroundComponents = {
  ...foundationPlaygroundComponents,
  'http-basics': HttpExchangePlayground,
  'json-basics': JsonConversionPlayground,
  'api-basics': EndpointRouterPlayground,
  'project-anatomy': ProjectAnatomyPlayground,
  'spring-vs-boot': SpringBootAssemblyPlayground,
  annotations: SpringAnnotationReaderPlayground,
  beans: BeanScopePlayground,
  'ioc-di': ContainerWiringPlayground,
  'request-flow': SpringRequestPipelinePlayground,
  'spring-aop-proxy': ProxyBoundaryPlayground,
  rest: RestResourcePlayground,
  'request-inputs': RequestBindingPlayground,
  dto: DtoBoundaryPlayground,
  validation: ValidationGatePlayground,
  'api-design': ApiStatusDecisionPlayground,
  'sql-basics': SqlFilterSortPlayground,
  'sql-joins': SqlJoinWorkbench,
  'sql-grouping': GroupAggregatePlayground,
  'sql-index-normalization': SchemaDesignPlayground,
  'database-acid': AcidIsolationPlayground,
  'jpa-basics': JpaStateSqlPlayground,
  repository: RepositoryQueryPlayground,
  relations: EntityRelationPlayground,
  transactions: TransactionBoundaryPlayground,
  pagination: PaginationNPlusOnePlayground,
}

function ExceptionPlayground({ lesson }) {
  const cases = [
    { name: 'ProductNotFound', status: '404', tone: 'warn', body: '{ code: "PRODUCT_NOT_FOUND" }', detail: 'Service exception fırlatır. Advice yakalar, handler bunu kontrollü 404 response’a çevirir.' },
    { name: 'ValidationException', status: '400', tone: 'warn', body: '{ code: "INVALID_REQUEST" }', detail: 'Geçersiz client verisi 400 ailesine çevrilir; stack trace dışarı sızmaz.' },
    { name: 'UnexpectedException', status: '500', tone: 'danger', body: '{ code: "INTERNAL_ERROR" }', detail: 'Beklenmeyen hata standart 500 gövdesine çevrilir; ayrıntı server logunda kalır.' },
  ]
  const [selected, setSelected] = useState(0)
  const [pulse, setPulse] = useState(0)
  const current = cases[selected]

  return (
    <GameFrame lesson={lesson} eyebrow="EXCEPTION ROUTER" title="Hatayı fırlat. API’nin nasıl toparladığını izle." copy="Senaryoyu değiştir; exception Controller’dan dışarı kaçmak yerine merkezi hatta ilerlesin." experiment={{ change: 'ProductNotFound, validation ve beklenmeyen hata senaryoları arasında geç.', watch: 'Exception hangi handler’a düşüyor; client hangi status/body’yi görüyor ve hangi detaylar dışarı sızmıyor?' }} className="exception-game" footer={current.detail}>
      <div className="exception-controls">
        {cases.map((item, index) => <button key={item.name} className={selected === index ? 'active' : ''} onClick={() => { setSelected(index); setPulse((v) => v + 1) }}><span>{item.status}</span><strong>{item.name}</strong></button>)}
        <button className="sim-action" onClick={() => setPulse((v) => v + 1)}>Exception fırlat</button>
      </div>
      <div className="exception-stage">
        <div className="exception-track">
          {['Service', '@RestControllerAdvice', '@ExceptionHandler', 'HTTP response'].map((label, index) => <div className="exception-node" key={label}><span>{index + 1}</span><strong>{label}</strong></div>)}
          <motion.div key={`${selected}-${pulse}`} className={`exception-packet ${current.tone}`} initial={{ left: '4%', opacity: 0 }} animate={{ left: '91%', opacity: [0, 1, 1] }} transition={{ duration: 1.45, ease: [0.16, 1, 0.3, 1] }}>{current.name}</motion.div>
        </div>
        <motion.div key={`${current.status}-${pulse}`} className={`exception-response ${current.tone}`} initial={{ opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
          <small>CLIENT’A ÇIKAN</small><strong>{current.status}</strong><code>{current.body}</code><span>stack trace: gizli</span>
        </motion.div>
      </div>
    </GameFrame>
  )
}

function ConfigPlayground({ lesson }) {
  const profiles = {
    local: { url: 'http://localhost:8081', timeout: '5s', db: 'localhost:5432/shop', accent: 'LOCAL' },
    test: { url: 'https://sandbox.pay.test', timeout: '3s', db: 'test-db:5432/shop', accent: 'TEST' },
    prod: { url: 'https://pay.company.com', timeout: '2s', db: 'prod-db:5432/shop', accent: 'PROD' },
  }
  const [profile, setProfile] = useState('local')
  const [override, setOverride] = useState(false)
  const current = profiles[profile]
  const finalUrl = override ? 'https://env-override.internal' : current.url

  return (
    <GameFrame lesson={lesson} eyebrow="CONFIG MIXER" title="Aynı kod. Farklı ortam. Farklı davranış." copy="Profile değiştir, sonra environment override gönder. Hangi katmanın son sözü söylediğini canlı gör." experiment={{ change: 'local/test/prod profile’ını değiştir; sonra environment override’u aç.', watch: 'Aynı property için hangi kaynak kazanıyor ve uygulamanın çözdüğü final değer nasıl değişiyor?' }} className="config-game" footer={`Çözülen değer: base-url = ${finalUrl}`}>
      <div className="config-console">
        <div className="profile-switcher">
          {Object.keys(profiles).map((name) => <button key={name} className={profile === name ? 'active' : ''} onClick={() => setProfile(name)}><span>{profiles[name].accent}</span><small>profile</small></button>)}
          <button className={`env-switch ${override ? 'active' : ''}`} onClick={() => setOverride((v) => !v)}><span>ENV OVERRIDE</span><small>{override ? 'aktif' : 'kapalı'}</small></button>
        </div>
        <div className="config-stack">
          <motion.div layout className="config-layer base"><small>application.yml</small><code>timeout: 5s</code><code>base-url: http://localhost</code></motion.div>
          <motion.div layout className="config-layer profile" key={profile} initial={{ x: 24, opacity: 0 }} animate={{ x: 0, opacity: 1 }}><small>application-{profile}.yml</small><code>timeout: {current.timeout}</code><code>base-url: {current.url}</code></motion.div>
          <motion.div layout className={`config-layer env ${override ? 'live' : ''}`} animate={{ opacity: override ? 1 : .25, scale: override ? 1 : .97 }}><small>environment</small><code>PAYMENT_URL={override ? 'env-override.internal' : '—'}</code></motion.div>
        </div>
        <motion.div key={`${profile}-${override}`} className="config-device" initial={{ opacity: .5, scale: .96 }} animate={{ opacity: 1, scale: 1 }}><small>PaymentProperties</small><strong>{current.timeout}</strong><code>{finalUrl}</code><span>DB: {current.db}</span></motion.div>
      </div>
    </GameFrame>
  )
}

function LoggingPlayground({ lesson }) {
  const [requestNo, setRequestNo] = useState(41)
  const [level, setLevel] = useState('ALL')
  const [masked, setMasked] = useState(true)
  const trace = `REQ-${String(requestNo).padStart(4, '0')}`
  const logs = [
    ['INFO', `request_started trace=${trace} path=/orders`],
    ['DEBUG', `repository_lookup trace=${trace} customer=17`],
    ['WARN', `payment_slow trace=${trace} elapsed=820ms`],
    ['ERROR', `payment_failed trace=${trace} token=${masked ? '[REDACTED]' : 'sk_live_demo_9x'}`],
  ]
  const visible = level === 'ALL' ? logs : logs.filter(([entryLevel]) => entryLevel === level)

  return (
    <GameFrame lesson={lesson} eyebrow="LOG FORENSICS" title="Tek request’i production gürültüsünde takip et." copy="Yeni request üret, log seviyesini filtrele, hassas veriyi maskeyle. Correlation ID aynı olayın izini bir arada tutar." experiment={{ change: 'Yeni request üret, log level filtresini değiştir ve PII maskesini aç/kapat.', watch: 'Aynı correlation ID zinciri korunuyor mu; hangi loglar görünmez oluyor ve hassas veri sızıyor mu?' }} className="logging-game" footer={`${trace}: ${visible.length} log satırı görünür.`}>
      <div className="log-toolbar">
        <button className="sim-action" onClick={() => setRequestNo((n) => n + 1)}>Yeni request üret</button>
        <div className="log-filters">{['ALL', 'INFO', 'WARN', 'ERROR'].map((item) => <button key={item} className={level === item ? 'active' : ''} onClick={() => setLevel(item)}>{item}</button>)}</div>
        <button className={`mask-switch ${masked ? 'active' : 'danger'}`} onClick={() => setMasked((v) => !v)}>PII maskesi: {masked ? 'AÇIK' : 'KAPALI'}</button>
      </div>
      <div className="log-terminal">
        <div className="log-terminal-head"><span>live.log</span><strong>{trace}</strong></div>
        <AnimatePresence mode="popLayout">
          {visible.map(([entryLevel, message], index) => <motion.div layout key={`${trace}-${entryLevel}`} className={`log-row level-${entryLevel.toLowerCase()}`} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: index * .07 }}><b>{entryLevel}</b><code>{message}</code></motion.div>)}
        </AnimatePresence>
        {!masked && <motion.div className="log-leak" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Hassas veri loga düştü. Production’da bu satır kalıcı iz bırakabilir.</motion.div>}
      </div>
    </GameFrame>
  )
}

function SecurityPlayground({ lesson }) {
  const [identity, setIdentity] = useState('anonymous')
  const [endpoint, setEndpoint] = useState('public')
  const [pulse, setPulse] = useState(0)
  const authenticated = identity !== 'anonymous'
  const authorized = endpoint !== 'admin' || identity === 'admin'
  const status = endpoint === 'public' ? 200 : !authenticated ? 401 : !authorized ? 403 : 200
  const stop = status === 401 ? 38 : status === 403 ? 68 : 92

  return (
    <GameFrame lesson={lesson} eyebrow="SECURITY GATE" title="Kimliği ve kapıyı değiştir. Request’in nerede durduğunu gör." copy="Authentication kim olduğunu, authorization nereye girebildiğini belirler. Aynı request farklı kimlikle farklı noktada durur." experiment={{ change: 'Anonim/USER/ADMIN kimliğini ve public/account/admin endpoint’ini değiştir.', watch: 'Request authentication’da mı, authorization’da mı duruyor; 401 ile 403 neden farklı çıkıyor?' }} className="security-game" footer={status === 200 ? 'Request Controller’a ulaştı.' : status === 401 ? 'Kimlik doğrulanmadı. Authorization aşamasına geçilemedi.' : 'Kimlik var; bu endpoint için yetki yok.'}>
      <div className="security-controls">
        <div><small>KİMLİK</small>{[['anonymous', 'Anonim'], ['user', 'USER'], ['admin', 'ADMIN']].map(([id, label]) => <button key={id} className={identity === id ? 'active' : ''} onClick={() => { setIdentity(id); setPulse((v) => v + 1) }}>{label}</button>)}</div>
        <div><small>HEDEF</small>{[['public', '/public'], ['account', '/account'], ['admin', '/admin']].map(([id, label]) => <button key={id} className={endpoint === id ? 'active' : ''} onClick={() => { setEndpoint(id); setPulse((v) => v + 1) }}>{label}</button>)}</div>
      </div>
      <div className="security-stage">
        <div className="security-line" />
        <div className="security-gate auth"><span>01</span><strong>AUTHENTICATION</strong><small>{authenticated || endpoint === 'public' ? 'geçti' : 'durdu'}</small></div>
        <div className="security-gate role"><span>02</span><strong>AUTHORIZATION</strong><small>{status === 403 ? 'durdu' : status === 401 ? 'bekliyor' : 'geçti'}</small></div>
        <div className="security-gate api"><span>03</span><strong>CONTROLLER</strong><small>{status === 200 ? 'ulaştı' : 'ulaşmadı'}</small></div>
        <motion.div key={`${identity}-${endpoint}-${pulse}`} className={`security-request status-${status}`} initial={{ left: '3%', opacity: 0 }} animate={{ left: `${stop}%`, opacity: 1 }} transition={{ type: 'spring', stiffness: 80, damping: 17 }}>REQ</motion.div>
        <motion.div key={`${status}-${pulse}`} className={`security-status status-${status}`} initial={{ scale: .85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><small>HTTP</small><strong>{status}</strong></motion.div>
      </div>
    </GameFrame>
  )
}

function TestingPlayground({ lesson }) {
  const modes = {
    unit: { label: 'UNIT', time: '35ms', layers: ['Service'], note: 'Spring context açılmaz. Tek sınıf ve mock dependency’ler.' },
    slice: { label: '@WebMvcTest', time: '480ms', layers: ['Controller', 'MVC', 'MockMvc'], note: 'Web dilimi açılır. HTTP davranışını dar kapsamda görürsün.' },
    integration: { label: '@SpringBootTest', time: '2.8s', layers: ['Controller', 'Service', 'Repository', 'DB'], note: 'Geniş application context açılır. En pahalı ama en geniş güven.' },
  }
  const [mode, setMode] = useState('unit')
  const [run, setRun] = useState(0)
  const current = modes[mode]

  return (
    <GameFrame lesson={lesson} eyebrow="TEST SCOPE LAB" title="Test kapsamını büyüt. Maliyet ve görünür alan nasıl değişiyor izle." copy="Aynı özelliği üç farklı büyüteçle çalıştır. Amaç hepsini SpringBootTest yapmak değil; ihtiyacın kadar context açmak." experiment={{ change: 'Unit, @WebMvcTest ve @SpringBootTest kapsamları arasında geç.', watch: 'Hangi katmanlar gerçekten ayağa kalkıyor; execution cost kapsamla birlikte nasıl büyüyor?' }} className="testing-game" footer={current.note}>
      <div className="test-selector">{Object.entries(modes).map(([id, item]) => <button key={id} className={mode === id ? 'active' : ''} onClick={() => { setMode(id); setRun((v) => v + 1) }}><strong>{item.label}</strong><small>{item.time}</small></button>)}<button className="sim-action" onClick={() => setRun((v) => v + 1)}>Çalıştır</button></div>
      <div className="test-stage">
        <div className="test-stack">{['Controller', 'MVC', 'Service', 'Repository', 'DB'].map((layer, index) => { const live = current.layers.includes(layer); return <motion.div key={`${mode}-${layer}-${run}`} className={`test-layer ${live ? 'live' : ''}`} initial={live ? { opacity: .2, x: -10 } : false} animate={{ opacity: live ? 1 : .18, x: 0 }} transition={{ delay: index * .06 }}><span>{layer}</span></motion.div> })}<motion.div key={`${mode}-${run}`} className="test-scanner" initial={{ top: '4%' }} animate={{ top: '88%' }} transition={{ duration: 1.1, ease: 'easeInOut' }} /></div>
        <div className="test-meter"><small>CONTEXT MALİYETİ</small><div className={`test-cost cost-${mode}`}><i /></div><strong>{current.time}</strong><code>{current.layers.join(' + ')}</code></div>
      </div>
    </GameFrame>
  )
}

function ActuatorPlayground({ lesson }) {
  const [services, setServices] = useState({ db: true, cache: true, disk: true })
  const [pulse, setPulse] = useState(0)
  const toggle = (name) => { setServices((state) => ({ ...state, [name]: !state[name] })); setPulse((v) => v + 1) }
  const ready = services.db && services.disk
  const health = !ready ? 'DOWN' : services.cache ? 'UP' : 'DEGRADED'

  return (
    <GameFrame lesson={lesson} eyebrow="MISSION CONTROL" title="Production sisteminin nabzını boz. Actuator sinyalini izle." copy="DB, cache ve disk bileşenlerini tek tek devre dışı bırak. Port açık kalsa bile readiness ve health neden değişiyor gör." experiment={{ change: 'DB, cache ve disk health bileşenlerini tek tek kapat/aç.', watch: 'health, readiness ve liveness aynı anda mı değişiyor; trafik hangi arızada kesiliyor?' }} className="actuator-game" footer={`health=${health} · readiness=${ready ? 'ACCEPTING_TRAFFIC' : 'REFUSING_TRAFFIC'} · liveness=UP`}>
      <div className="actuator-board">
        <div className="service-grid">{Object.entries(services).map(([name, up]) => <button key={name} className={up ? 'up' : 'down'} onClick={() => toggle(name)}><span className="service-led"/><strong>{name.toUpperCase()}</strong><small>{up ? 'UP' : 'DOWN'}</small></button>)}</div>
        <div className="health-core"><motion.div key={`${health}-${pulse}`} className={`health-orb health-${health.toLowerCase()}`} animate={{ scale: [1, 1.08, 1], opacity: [1, .75, 1] }} transition={{ duration: 1.2 }}><small>/actuator/health</small><strong>{health}</strong></motion.div><div className="pulse-line">{[0,1,2,3,4,5,6].map((n) => <motion.i key={`${pulse}-${n}`} animate={{ height: `${18 + ((n + pulse) % 4) * 12}px` }} />)}</div></div>
        <div className={`traffic-gate ${ready ? 'open' : 'closed'}`}><small>READINESS</small><strong>{ready ? 'TRAFİK AÇIK' : 'TRAFİK KESİLDİ'}</strong><motion.span animate={{ x: ready ? [0, 46, 0] : 0 }} transition={{ repeat: Infinity, duration: 1.8 }}>REQ</motion.span></div>
      </div>
    </GameFrame>
  )
}

function MigrationPlayground({ lesson }) {
  const versions = [
    { tag: 'V1', cols: ['id', 'name'], sql: 'CREATE TABLE product ...' },
    { tag: 'V2', cols: ['id', 'name', 'price'], sql: 'ADD COLUMN price DECIMAL' },
    { tag: 'V3', cols: ['id', 'name', 'price', 'stock'], sql: 'ADD COLUMN stock INTEGER DEFAULT 0' },
  ]
  const [version, setVersion] = useState(0)
  const [breaking, setBreaking] = useState(false)
  const current = versions[version]
  const apply = () => { setBreaking(false); setVersion((v) => Math.min(v + 1, versions.length - 1)) }

  return (
    <GameFrame lesson={lesson} eyebrow="SCHEMA TIME MACHINE" title="DB şemasını sürüm sürüm evrimleştir." copy="Migration’ları sırayla uygula. Sonra breaking değişikliği simüle edip eski uygulamanın neden kırılabileceğini gör." experiment={{ change: 'V1→V2→V3 migration’larını uygula; sonra name kolonunu breaking şekilde kaldır.', watch: 'Schema history ileri giderken eski uygulama hangi değişiklikte uyumluluğunu kaybediyor?' }} className="migration-game" footer={breaking ? 'Breaking değişiklik: eski uygulama beklediği name kolonunu bulamıyor.' : `${current.tag} uygulanmış durumda. Migration geçmişi tekrar üretilebilir.`}>
      <div className="migration-toolbar"><button className="sim-action" disabled={version === versions.length - 1} onClick={apply}>Sonraki migration</button><button onClick={() => { setVersion(0); setBreaking(false) }}>Başa sar</button><button className={breaking ? 'danger active' : 'danger'} onClick={() => setBreaking((v) => !v)}>Breaking değişiklik simüle et</button></div>
      <div className="migration-stage">
        <div className="migration-timeline">{versions.map((item, index) => <div key={item.tag} className={index <= version ? 'applied' : ''}><span>{item.tag}</span><small>{index <= version ? 'APPLIED' : 'PENDING'}</small></div>)}</div>
        <div className="schema-table"><div className="schema-head"><strong>product</strong><span>{current.tag}</span></div><AnimatePresence>{current.cols.filter((col) => !(breaking && col === 'name')).map((col) => <motion.div layout key={col} className="schema-col" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }}><code>{col}</code><small>{col === 'id' ? 'BIGINT' : col === 'price' ? 'DECIMAL' : col === 'stock' ? 'INTEGER' : 'VARCHAR'}</small></motion.div>)}</AnimatePresence></div>
        <motion.div key={`${version}-${breaking}`} className={`app-compat ${breaking ? 'broken' : ''}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}><small>ESKİ APP</small><strong>{breaking ? 'QUERY FAILED' : 'COMPATIBLE'}</strong><code>{breaking ? 'SELECT id,name FROM product' : current.sql}</code></motion.div>
      </div>
    </GameFrame>
  )
}

function CachePlayground({ lesson }) {
  const [state, setState] = useState({ cacheVersion: null, dbVersion: 1, hits: 0, misses: 0, event: 'cold' })
  const getProduct = () => setState((s) => s.cacheVersion === null
    ? { ...s, cacheVersion: s.dbVersion, misses: s.misses + 1, event: 'miss' }
    : { ...s, hits: s.hits + 1, event: s.cacheVersion === s.dbVersion ? 'hit' : 'stale' })
  const updateDb = () => setState((s) => ({ ...s, dbVersion: s.dbVersion + 1, event: 'db-update' }))
  const invalidate = () => setState((s) => ({ ...s, cacheVersion: null, event: 'invalidate' }))
  const stale = state.cacheVersion !== null && state.cacheVersion !== state.dbVersion

  return (
    <GameFrame lesson={lesson} eyebrow="CACHE RACE" title="Aynı GET’i tekrar gönder. Sonra DB’yi değiştir ve stale data yarat." copy="Cache hit hız kazandırır. Veri değiştiğinde invalidation yapılmazsa hızlı ama eski cevap dönebilir." experiment={{ change: 'GET’i tekrarla, DB version’ını artır ve cache invalidate etmeden tekrar GET gönder.', watch: 'MISS→HIT→STALE akışı ne zaman oluşuyor; invalidation sonrası hangi kaynak yeniden okunuyor?' }} className="cache-game" footer={`hits=${state.hits} · misses=${state.misses} · cache=${state.cacheVersion === null ? 'EMPTY' : `v${state.cacheVersion}`} · db=v${state.dbVersion}`}>
      <div className="cache-toolbar"><button className="sim-action" onClick={getProduct}>GET /products/42</button><button onClick={updateDb}>DB’de ürünü güncelle</button><button onClick={invalidate}>Cache invalidate</button></div>
      <div className="cache-stage">
        <motion.div key={`${state.event}-${state.hits}-${state.misses}`} className={`cache-request event-${state.event}`} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>REQUEST</motion.div>
        <div className={`cache-box ${stale ? 'stale' : ''}`}><small>CACHE</small><strong>{state.cacheVersion === null ? 'EMPTY' : `Product v${state.cacheVersion}`}</strong><span>{stale ? 'STALE COPY' : state.cacheVersion ? 'READY' : 'WAITING'}</span></div>
        <div className="cache-lane"><motion.i animate={{ scaleX: state.event === 'hit' || state.event === 'stale' ? 1 : .2 }} /><span>{state.event === 'hit' ? '4ms HIT' : state.event === 'stale' ? '4ms HIT · eski veri' : state.event === 'miss' ? '90ms MISS · DB’ye git' : 'route'}</span></div>
        <div className="db-box"><small>DATABASE</small><strong>Product v{state.dbVersion}</strong><span>source of truth</span></div>
      </div>
    </GameFrame>
  )
}

function AsyncPlayground({ lesson }) {
  const [pool, setPool] = useState({ workers: [null, null], queue: [], done: 0, seq: 1 })
  const enqueue = (type) => setPool((state) => {
    const job = { id: state.seq, type }
    const workers = [...state.workers]
    const empty = workers.findIndex((item) => item === null)
    if (empty >= 0) workers[empty] = job
    return { ...state, workers, queue: empty >= 0 ? state.queue : [...state.queue, job], seq: state.seq + 1 }
  })
  const advance = () => setPool((state) => {
    const waiting = [...state.queue]
    const completedNow = state.workers.filter(Boolean).length
    const workers = state.workers.map(() => waiting.shift() ?? null)
    return { ...state, workers, queue: waiting, done: state.done + completedNow }
  })

  return (
    <GameFrame lesson={lesson} eyebrow="THREAD POOL ARCADE" title="İşleri worker’lara yağdır. Kuyruk ne zaman büyüyor gör." copy="@Async işi request thread’inden ayırabilir; kapasite sonsuz olmaz. Worker dolunca yeni işler kuyrukta bekler." experiment={{ change: '2 worker dolana kadar async iş ekle; sonra kuyruğu büyütüp bir tur ilerlet.', watch: 'Request thread’i serbest kalırken executor kapasitesi dolunca işler nerede bekliyor ve ne zaman çalışıyor?' }} className="async-game" footer={`çalışan=${pool.workers.filter(Boolean).length} · kuyruk=${pool.queue.length} · tamamlanan=${pool.done}`}>
      <div className="async-toolbar"><button className="sim-action" onClick={() => enqueue('MAIL')}>E-posta işi ekle</button><button onClick={() => enqueue('REPORT')}>Rapor işi ekle</button><button onClick={() => enqueue('SCHEDULED')}>Scheduler tetikle</button><button onClick={advance}>1 tur ilerlet</button></div>
      <div className="async-stage">
        <div className="request-thread"><small>REQUEST THREAD</small><strong>HTTP response serbest</strong><motion.span animate={{ x: [0, 34, 0] }} transition={{ repeat: Infinity, duration: 2 }}>REQ</motion.span></div>
        <div className="worker-pool"><div className="pool-head"><strong>EXECUTOR</strong><span>2 worker</span></div>{pool.workers.map((job, index) => <motion.div layout key={`worker-${index}`} className={`worker-slot ${job ? 'busy' : ''}`}><small>WORKER {index + 1}</small>{job ? <motion.strong key={job.id} initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{job.type} #{job.id}</motion.strong> : <span>IDLE</span>}{job && <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.4 }} />}</motion.div>)}</div>
        <div className="job-queue"><div className="pool-head"><strong>QUEUE</strong><span>{pool.queue.length} bekliyor</span></div><AnimatePresence>{pool.queue.map((job) => <motion.div layout key={job.id} className="queued-job" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>{job.type} #{job.id}</motion.div>)}</AnimatePresence>{!pool.queue.length && <span className="queue-empty">boş</span>}</div>
      </div>
    </GameFrame>
  )
}

function AdvancedPlayground({ lesson }) {
  if (lesson.id === 'exceptions') return <ExceptionPlayground lesson={lesson} />
  if (lesson.id === 'config') return <ConfigPlayground lesson={lesson} />
  if (lesson.id === 'logging') return <LoggingPlayground lesson={lesson} />
  if (lesson.id === 'security') return <SecurityPlayground lesson={lesson} />
  if (lesson.id === 'testing') return <TestingPlayground lesson={lesson} />
  if (lesson.id === 'actuator') return <ActuatorPlayground lesson={lesson} />
  if (lesson.id === 'migrations') return <MigrationPlayground lesson={lesson} />
  if (lesson.id === 'cache') return <CachePlayground lesson={lesson} />
  if (lesson.id === 'async') return <AsyncPlayground lesson={lesson} />
  if (lesson.id === 'requirement-discovery') return <RequirementDiscoveryPlayground lesson={lesson} />
  if (lesson.id === 'acceptance-criteria') return <AcceptanceCriteriaPlayground lesson={lesson} />
  if (lesson.id === 'user-story-dod') return <UserStoryDodPlayground lesson={lesson} />
  if (lesson.id === 'scrum-roles') return <ScrumRolesPlayground lesson={lesson} />
  if (lesson.id === 'scrum-events') return <ScrumEventsPlayground lesson={lesson} />
  if (lesson.id === 'sprint-backlog') return <SprintBacklogPlayground lesson={lesson} />
  if (lesson.id === 'documentation-types') return <DocumentationTypesPlayground lesson={lesson} />
  if (lesson.id === 'knowledge-transfer') return <KnowledgeTransferPlayground lesson={lesson} />
  if (lesson.id === 'incident-triage') return <IncidentTriagePlayground lesson={lesson} />
  if (lesson.id === 'root-cause-prevention') return <RootCausePreventionPlayground lesson={lesson} />
  if (post05PlaygroundIds.has(lesson.id)) {
    return (
      <Suspense key={lesson.id} fallback={<section className="memory-game advanced-game post05-loading" aria-live="polite">Oyun alanı hazırlanıyor…</section>}>
        <Post05Playground lesson={lesson} />
      </Suspense>
    )
  }
  return null
}

export default function MemoryGame({ lesson }) {
  const ConceptPlayground = conceptPlaygroundComponents[lesson.id]
  if (ConceptPlayground) return <ConceptPlayground lesson={lesson} />

  if (advancedPlaygroundIds.has(lesson.id)) return <AdvancedPlayground lesson={lesson} />

  return (
    <section className="memory-game missing-playground" role="alert" aria-label={`${lesson.title} oyun eşlemesi eksik`}>
      <div className="section-label"><span>OYUN EŞLEMESİ EKSİK</span><b>{lesson.id}</b></div>
      <div className="memory-game-head">
        <div><small>KALİTE KAPISI</small><h2>Bu ders için kavrama özel oyun tanımlanmamış.</h2><p>Generic sahneye geri dönülmez. Ders, kendine özel etkileşim eklenene kadar audit başarısız olmalı.</p></div>
      </div>
    </section>
  )
}
