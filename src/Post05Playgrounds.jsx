import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { initialServiceFleet, checkoutResponse, fleetMissionPassed } from './learning/machineChallenges'
import { createResilienceState, expireResilienceCooldown, runResilienceRequest } from './learning/resilienceSimulation'
import { createBrokerState, deliverBrokerMessage, publishOrderEvent, redriveDeadLetter, setBrokerConsumerOnline, settleBrokerMessage, MAX_BROKER_DELIVERIES } from './learning/brokerSimulation'
import { createSagaState, startSaga, chargeSagaPayment, publishOutbox, redeliverSagaPayment, decideSagaInventory, compensateSaga, syncSagaReadModel } from './learning/sagaSimulation'
import { createBalancerState, setInstanceProcess, setInstanceReadiness, runDiscoveryHealthCheck, routeBalancerRequest, routeBalancerBatch } from './learning/balancerSimulation'
import { createGatewayState, setGatewayServiceHealth, setGatewayServiceLatency, resetGatewayRateWindow, runGatewayRequest } from './learning/gatewaySimulation'
import { createAggregatorState, setAggregatorSourceHealth, setAggregatorSourceLatency, runAggregator } from './learning/aggregatorSimulation'
import { createProcessPipelineState, runProcessPipeline } from './learning/processPipelineSimulation'
import { createSharedResourceState, runSharedResourceMigration } from './learning/sharedResourceSimulation'
import { createIndependentDeploymentState, deployPaymentProvider, redeployConsumer, runDeploymentContractTest } from './learning/independentDeploymentSimulation'
import { evaluateMicroservicePrinciples } from './learning/microservicePrinciplesSimulation'
import { DDD_CONTEXTS, DDD_OWNERSHIP_CASES, getContextMeaning, evaluateContextPlacement, summarizeContextPlacements } from './learning/dddContextSimulation'
import { evaluateSystemDesign } from './learning/systemDesignSimulation'
import { DDD_RESPONSIBILITY_CASES, evaluateDddResponsibility } from './learning/dddResponsibilitySimulation'
import { DEVOPS_FEEDBACK_STAGES, createDevOpsFeedbackState, setFeedbackRegression, setFeedbackTelemetry, advanceDevOpsFeedback } from './learning/devopsFeedbackSimulation'
import { createReleaseGateState, setReleaseMode, setReleasePolicy, evaluateReleaseGate, approveDeliveryRelease } from './learning/releaseGateSimulation'
import { MAVEN_PHASES, createMavenArtifactState, setMavenTestFailure, changeMavenSource, runMavenPhase, publishMavenArtifact, promoteMavenArtifact } from './learning/mavenArtifactSimulation'
import { PIPELINE_AS_CODE_STAGES, createPipelineAsCodeState, setPipelineTrigger, setPipelineFailure, togglePipelineDraftStage, commitPipelineDefinition, runPipelineDefinition } from './learning/pipelineAsCodeSimulation'
import { createDockerContainerState, changeDockerSource, buildDockerImage, pushDockerImage, pullDockerImage, setDockerRuntimeEnv, runDockerContainer, removeDockerContainer } from './learning/dockerContainerSimulation'
import { SAFE_SECRET_IMAGE, createSecretConfigState, setSecretDeliveryMode, setSecretEnvironment, setSecretAccess, deploySecretConfig, rotateSecret, secretLeakVersions } from './learning/secretConfigSimulation'
import { ROLLBACK_ERROR_THRESHOLD, createDeploymentRollbackState, setDeploymentStrategy, setDeploymentErrorRate, setDeploymentDbCompatibility, advanceDeploymentRollout, rollbackDeployment, deploymentTraffic } from './learning/deploymentRollbackSimulation'
import { createKubernetesControlLoopState, kubernetesReadyPods, kubernetesAlivePods, deleteKubernetesPod, reconcileKubernetesDeployment, failKubernetesReadiness, restoreKubernetesReadiness, failKubernetesLiveness, reconcileKubernetesKubelet, routeKubernetesServiceRequest } from './learning/kubernetesControlLoopSimulation'
import { createReactRenderState, updateReactChildState, changeReactProductProp, rerenderReactParent, setReactMemo } from './learning/reactRenderSimulation'
import { ENTERPRISE_QUALITY_GATES, createEnterpriseQualityState, setEnterpriseRisk, runEnterpriseQualityGate, runAllEnterpriseQualityGates, attemptEnterpriseRelease } from './learning/enterpriseQualityGateSimulation'
import { REQUIREMENT_DECISIONS, createStakeholderRequirementState, setRequirementDecision, generateAcceptanceCriteria, runRequirementAcceptanceTests } from './learning/stakeholderRequirementSimulation'
import { DELIVERY_WORK_ITEMS, createDeliveryPrioritizationState, moveDeliveryWork, setDeliveryWorkScope, setDeliveryIncidentActive, setDeliveryAnalyticsReady, setDeliveryCapacity, scopedDeliveryEffort, assessDeliveryPlan } from './learning/deliveryPrioritizationSimulation'
import { SUPPORT_DIAGNOSES, SUPPORT_FIXES, createSafeChangeState, reproduceSupportIncident, inspectSupportEvidence, diagnoseSupportIncident, selectSupportFix, runSupportRegression, runSupportContract, startSupportRollout, injectSupportProductionRegression, monitorSupportRollout, promoteSupportCanary, rollbackSupportRollout } from './learning/safeChangeSimulation'
import { TECHNOLOGY_SCENARIOS, TECHNOLOGY_CONTROLS, REPLAY_STORAGE_CASES, getReplayTimeline, createTechnologyDecisionState, setTechnologyScenario, setTechnologyTeam, setTechnologyReplayStorage, toggleTechnologyOption, runTechnologyTrial, decideTechnology } from './learning/technologyDecisionSimulation'

function ArcadeFrame({ lesson, eyebrow, title, copy, badge, className = '', children, footer, challenge = false }) {
  const experiment = experiments[lesson.id]
  return (
    <section className={`memory-game advanced-game post05-game lab-${lesson.id} lab-phase-${lesson.phase} ${className}`} aria-label={`${lesson.title} özel oyun alanı`}>
      <div className="section-label"><span>{challenge ? 'GÖREVİ ÇÖZ' : 'KURCALA VE GÖR'}</span><b>{badge}</b></div>
      <div className="advanced-game-head">
        <small>{eyebrow}</small>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {!challenge && experiment && <div className="experiment-brief">
        <div><small>01 · DEĞİŞTİR</small><strong>{experiment.change}</strong></div>
        <span>→</span>
        <div><small>02 · GÖZLE</small><strong>{experiment.watch}</strong></div>
      </div>}
      {children}
      {footer && <div className="advanced-game-foot">{footer}</div>}
    </section>
  )
}

const specs = {
  mockito: {
    kind: 'mock', eyebrow: 'MOCK CONTROL ROOM', badge: 'STUB · VERIFY',
    title: 'Dependency’ye sahte cevap ver; gerçekten çağrıldı mı kanıtla.',
    copy: 'PaymentClient gerçek servise gitmesin. Stub cevabını değiştir, CheckoutService’i çalıştır ve verify sayacını izle.',
  },
  'test-strategy': {
    kind: 'risk', eyebrow: 'RISK COVERAGE MAP', badge: 'TEST STRATEGY',
    title: 'Test sayısını değil, yakaladığın riski büyüt.',
    copy: 'Happy path, boundary, dependency failure ve duplicate risklerini tek tek kapsama al. Kör noktalar kaldıkça güven skoru yükselmez.',
    risks: ['Happy path', 'Boundary', 'Dependency failure', 'Duplicate / retry'],
  },
  sdlc: {
    kind: 'loop', eyebrow: 'DELIVERY LOOP', badge: 'SDLC',
    title: 'Requirement’tan maintenance’a kadar işi canlı tut.',
    copy: 'Aşamayı ilerlet; her adım bir sonraki için kanıt üretir. Maintenance sonunda feedback yeni requirement’a döner.',
    steps: ['Requirement', 'Design', 'Implement', 'Test', 'Deploy', 'Maintain'],
  },
  'agile-scrum': {
    kind: 'scrum', eyebrow: 'SPRINT PLANNING', badge: 'SCRUM',
    title: 'PO önceliğini takım kapasitesiyle Sprint Backlog’a çevir.',
    copy: 'Product Owner Product Backlog’u önceliklendirir; takım kapasitesine göre Sprint’e iş alır. Sprint başladıktan sonra scope değişikliğinin bedelini gör.',
    cards: [['Login bug', 2], ['Order API', 5], ['Audit log', 3], ['Report export', 5]],
  },
  'documentation-troubleshooting': {
    kind: 'incident', eyebrow: 'INCIDENT DETECTIVE', badge: 'EVIDENCE FIRST',
    title: 'Tahmin etme; kanıt topla ve root cause’u daralt.',
    copy: 'Semptomdan başla. Log, metric, runbook ve son deploy kanıtlarını açtıkça hipotezler elensin.',
    clues: ['Log: timeout /payments', 'Metric: latency +340%', 'Deploy: payment-client v2', 'Runbook: rollback adımı'],
  },
  'git-workflow': {
    kind: 'git', eyebrow: 'BRANCH GRAPH', badge: 'MERGE · REBASE',
    title: 'Aynı commitleri iki farklı geçmişte düzenle.',
    copy: 'Feature branch’i main ile birleştir. Merge history’yi korur; rebase commitleri yeni base üzerine yeniden yazar.',
  },
  'monolith-basics': {
    kind: 'monolith', eyebrow: 'ONE DEPLOY UNIT', badge: 'MONOLITH',
    title: 'Üç modül, tek uygulama. Birini değiştirince ne deploy olur?',
    copy: 'Değişen modülü seç. Kod sınırları ayrı görünse de tek deploy paketi yüzünden değişiklik bütün uygulama artifact’ına taşınır.',
  },
  'microservice-basics': {
    kind: 'microservice', eyebrow: 'SERVICE FLEET', badge: 'MICROSERVICE',
    title: 'Servisleri bağımsız çalıştır, boz ve ölçekle.',
    copy: 'Order, Catalog ve Payment ayrı deploy birimleri. Bir servisi düşür; diğerlerinin process olarak çalışmaya devam ettiğini gör.',
  },
  'monolith-microservices': {
    kind: 'compare', eyebrow: 'ARCHITECTURE SWITCH', badge: 'TRADE-OFF',
    title: 'Aynı sistemi monolith ve microservice olarak karşılaştır.',
    copy: 'Mimarini değiştir. Deploy sayısı, network çağrısı ve failure boundary aynı anda nasıl değişiyor izle.',
  },
  'service-boundary': {
    kind: 'sort', eyebrow: 'BOUNDARY SORTER', badge: 'OWNERSHIP',
    title: 'Sorumlulukları doğru servisin sınırına yerleştir.',
    copy: 'Order status, refund, stock ve payment authorization kartlarını sahiplerine dağıt. Sınır class sayısından değil business capability’den doğar.',
    buckets: ['ORDER', 'PAYMENT', 'CATALOG'],
    cards: [['order status', 'ORDER'], ['refund', 'PAYMENT'], ['stock', 'CATALOG'], ['payment authorization', 'PAYMENT']],
  },
  'sync-communication': {
    kind: 'latency', eyebrow: 'HTTP LATENCY RACE', badge: 'SYNC',
    title: 'Payment cevabı timeout’tan önce gelecek mi?',
    copy: 'Dependency latency ve timeout değerini değiştir. Caller’ın neden cevap gelene kadar beklediğini zaman çizgisinde gör.',
  },
  'microservice-resilience': {
    kind: 'breaker', eyebrow: 'RESILIENCE SWITCHBOARD', badge: 'TIMEOUT · RETRY · CB',
    title: 'Hata oranını yükselt; circuit breaker ne zaman açılmalı?',
    copy: 'Retry sayısını ve dependency durumunu değiştir. Her retry’nin masrafsız olmadığını ve açık circuit’in yükü kestiğini gör.',
  },
  'async-messaging': {
    kind: 'broker', eyebrow: 'EVENT DELIVERY LAB', badge: 'QUEUE · ACK · DLQ',
    title: 'Bir event kaç kez teslim edilir, kaç kez ödeme alır?',
    copy: 'OrderCreated yayınla; broker kuyruğundan teslim et, ACK ver veya hatayı tetikle. Consumer kopunca, ACK kaybolunca ve mesaj DLQ’ya düşünce sistemi izle.',
  },
  'distributed-consistency': {
    kind: 'saga', eyebrow: 'SAGA CONTROL', badge: 'COMPENSATE',
    title: 'Inventory fail olunca geçmiş business etkilerini telafi et.',
    copy: 'Order ve Payment local transaction’larını tamamladıktan sonra Inventory’yi boz. Tek DB rollback yerine compensation akışını çalıştır.',
  },
  'service-discovery-load-balancing': {
    kind: 'balancer', eyebrow: 'REGISTRY + LOAD BALANCER', badge: 'DISCOVER · ROUTE',
    title: 'Process UP olsa da readiness olmadan trafik alamaz.',
    copy: 'P2’yi düşür, health check’i çalıştır ve yeniden başlat. Process UP ile READY ayrımını gözle; registry ancak readiness sonrası instance’ı ekler.',
  },
  'api-gateway-proxy': {
    kind: 'router', eyebrow: 'GATEWAY ROUTER', badge: 'ROUTING',
    title: 'Path’i değiştir; request doğru backend’e gitsin.',
    copy: 'Client tek giriş noktası bilir. Gateway /catalog, /orders ve /payments path’lerini farklı servislere route eder.',
  },
  'aggregator-pattern': {
    kind: 'fanout', eyebrow: 'FAN-OUT / FAN-IN', badge: 'AGGREGATOR',
    title: 'Üç servisten tek response üret; bir kaynağı boz.',
    copy: 'User, Order ve Payment cevaplarını topla. Bir kaynak timeout olunca partial response politikasını değiştir.',
  },
  'pipeline-pattern': {
    kind: 'gates', eyebrow: 'PROCESS PIPELINE', badge: 'STAGES',
    title: 'Validate → Authorize → Enrich → Process zincirini kurcala.',
    copy: 'Bir stage’i bilerek fail et. Sonraki adımların neden durduğunu ve erken çıkışın yan etkiyi nasıl engellediğini gör.',
    steps: ['VALIDATE', 'AUTHORIZE', 'ENRICH', 'PROCESS'],
  },
  'shared-resources': {
    kind: 'blast', eyebrow: 'BLAST RADIUS', badge: 'DATA OWNERSHIP',
    title: 'Shared schema’da tek kolon değişikliğinin kimi kırdığını gör.',
    copy: 'Shared DB ve database-per-service arasında geçiş yap. Aynı migration’ın kaç servisi aynı anda etkilediğini izle.',
  },
  'independent-deployment': {
    kind: 'deploy', eyebrow: 'DEPLOY ISOLATION', badge: 'INDEPENDENT',
    title: 'Sadece Payment v2’yi yayınla. Order deploy olmak zorunda mı?',
    copy: 'Contract uyumluluğunu değiştir. Bağımsız deploy sadece ayrı repo değil; consumer’ı gereksiz kırmayan sözleşme ister.',
  },
  'microservice-principles': {
    kind: 'principles', eyebrow: 'SERVICE HEALTH CHECK', badge: 'COHESION · AUTONOMY',
    title: 'Servis tasarımını prensiplerle stres testine sok.',
    copy: 'Ownership, cohesion, contract ve observability kararlarını değiştir. Deployment autonomy, change isolation ve incident diagnosis kanıtlarının nasıl etkilendiğini gör.',
  },
  'ddd-basics': {
    kind: 'context', eyebrow: 'BOUNDED CONTEXT MAP', badge: 'DDD',
    title: 'Aynı kelimeyi doğru context’e yerleştir.',
    copy: 'Customer ve Status gibi aynı terimlerin context’e göre nasıl farklı model taşıdığını gör; Money, Refund ve Shipment ownership sınırlarında context leak üretip üretmediğini test et.',
  },
  'ddd-services': {
    kind: 'responsibility', eyebrow: 'DDD RESPONSIBILITY SORTER', badge: 'APP · DOMAIN · ACL',
    title: 'Orchestration, domain kuralı ve çeviriyi ayır.',
    copy: 'Davranışı seçip doğru katmana gönder. Her “Service” isimli class aynı sorumluluğu taşımaz.',
  },
  'microservice-system-design': {
    kind: 'designer', eyebrow: 'SYSTEM DESIGN TABLE', badge: 'TRADE-OFFS',
    title: 'Sipariş sistemini üç kararla kur.',
    copy: 'İletişim, data ownership ve failure politikasını seç. Her seçim latency, coupling ve consistency üzerinde iz bırakır.',
  },
  'devops-basics': {
    kind: 'feedback', eyebrow: 'DEV ↔ OPS LOOP', badge: 'FEEDBACK',
    title: 'Kod değişikliğini production sinyaline kadar takip et.',
    copy: 'Committen telemetry’ye ilerle. DevOps’un sadece tool değil, feedback süresini kısaltan çalışma biçimi olduğunu gör.',
    steps: ['CODE', 'BUILD', 'DEPLOY', 'OBSERVE', 'LEARN'],
  },
  'ci-basics': {
    kind: 'pipeline', eyebrow: 'CI QUALITY GATES', badge: 'CONTINUOUS INTEGRATION',
    title: 'Testi kır; pipeline’ın release’i durdurduğunu gör.',
    copy: 'Commit → Build → Test → Package. Test gate kırmızıysa doğrulanmamış artifact ileri gitmesin.',
    steps: ['COMMIT', 'BUILD', 'TEST', 'PACKAGE'],
  },
  'cd-basics': {
    kind: 'release', eyebrow: 'PRODUCTION GATE', badge: 'DELIVERY ↔ DEPLOYMENT',
    title: 'Aynı artifact’i manuel onayla veya otomatik yayınla.',
    copy: 'Delivery ve Deployment farkını production kapısında gör. Artifact aynı; gate politikası farklı.',
  },
  'maven-artifact': {
    kind: 'artifact', eyebrow: 'MAVEN FACTORY', badge: 'POM → JAR',
    title: 'Dependency’leri çöz, test et, JAR üret.',
    copy: 'Build lifecycle adımlarını çalıştır. package tamamlanmadan deploy edilecek immutable artifact oluşmaz.',
    steps: ['resolve deps', 'compile', 'test', 'package'],
  },
  'docker-basics': {
    kind: 'container', eyebrow: 'IMAGE WORKSHOP', badge: 'IMAGE → CONTAINER',
    title: 'Layer’ları oluştur; aynı image’dan iki container başlat.',
    copy: 'Image immutable paket, container çalışan instance’dır. Container silinse de image tanımı değişmez.',
  },
  'kubernetes-basics': {
    kind: 'kube', eyebrow: 'CONTROL LOOP', badge: 'DESIRED STATE',
    title: 'Bir Pod’u öldür; Deployment’ın replica sayısını onardığını gör.',
    copy: 'Service stable erişim verir; readiness trafiği filtreler; Deployment desired state’i geri kurar.',
  },
  'pipeline-as-code': {
    kind: 'yaml', eyebrow: 'PIPELINE AS CODE', badge: 'VERSIONED PIPELINE',
    title: 'Bir stage ekle; pipeline tanımı kod gibi değişsin.',
    copy: 'Lint, test ve scan adımlarını toggle et. Pipeline dosyası review edilen, versionlanan teslimat kodudur.',
  },
  'cicd-secrets-config': {
    kind: 'secret', eyebrow: 'SECRET LEAK LAB', badge: 'MASK · INJECT',
    title: 'Secret’i loga düşürme; runtime’da güvenli biçimde enjekte et.',
    copy: 'Plain text, masked variable ve runtime secret seçeneklerini değiştir. Log çıktısında hangi yaklaşımın iz bıraktığını gör.',
  },
  'deployment-rollback': {
    kind: 'rollback', eyebrow: 'RELEASE SAFETY', badge: 'ROLLBACK',
    title: 'Yeni sürüm hata oranını artırınca geri dön.',
    copy: 'Canary yüzdesini yükselt, error rate’i izle ve threshold aşılırsa otomatik rollback çalıştır.',
  },
  'cicd-interview': {
    kind: 'interview', eyebrow: 'CI/CD INTERVIEW GAME', badge: 'EXPLAIN WHY',
    title: 'Pipeline kararını seç; sonra gerekçesini savun.',
    copy: 'Test failure, approval ve rollback senaryolarında doğru davranışı seç. Oyun her kararda mülakat cümlesini üretir.',
  },
  'react-basics': {
    kind: 'react', eyebrow: 'RENDER LAB', badge: 'PROPS · STATE · EFFECT',
    title: 'State’i değiştir; render sayacını ve effect’i izle.',
    copy: 'Props dışarıdan gelir, state içeride değişir. Dependency değişince effect tekrar çalışabilir.',
  },
  'python-basics': {
    kind: 'python', eyebrow: 'JAVA ↔ PYTHON TRANSLATOR', badge: 'SAME IDEA',
    title: 'Aynı veri işlemini iki dilde karşılaştır.',
    copy: 'List/Map, null/None ve stream/comprehension örnekleri arasında geçiş yap. Fark syntax; amaç aynı veri dönüşümü.',
  },
  'enterprise-quality-compliance': {
    kind: 'compliance', eyebrow: 'QUALITY GATE VAULT', badge: 'REVIEW · TEST · SECURITY',
    title: 'Release kapısını bütün kontroller geçmeden açma.',
    copy: 'Review, test, security scan, PII kontrolü ve audit trail gate’lerini tek tek tamamla.',
  },
  'stakeholder-collaboration': {
    kind: 'clarify', eyebrow: 'REQUIREMENT INTERVIEW', badge: 'ASK BEFORE CODE',
    title: '“Order cancellation” isteğini test edilebilir hale getir.',
    copy: 'Belirsiz requirement’a doğru soruları sor. Status, refund, authorization ve response netleşmeden kod başlatma.',
  },
  'delivery-prioritization': {
    kind: 'priority', eyebrow: 'PRIORITY TOWER', badge: 'IMPACT · URGENCY',
    title: 'Dört işi doğru sıraya koy; kapasiteyi aşma.',
    copy: 'Production incident, release blocker ve feature kartlarını impact, urgency ve dependency ile sıralamayı dene.',
  },
  'existing-app-support': {
    kind: 'safechange', eyebrow: 'PRODUCTION SUPPORT LAB', badge: 'EVIDENCE · CANARY',
    title: 'Production hatasını düzelt, eski consumer’ı koru.',
    copy: '500 hatasını tekrar üret. Log ve deploy diff ile root cause bul. Fix, regression, consumer contract ve canary kanıtını sırayla değerlendir.',
  },
  'technology-evaluation': {
    kind: 'matrix', eyebrow: 'MESSAGE BROKER ARCHITECTURE LAB', badge: 'EVIDENCE > HYPE',
    title: 'Kafka mı RabbitMQ mu? Zorunlu testleri çalıştır.',
    copy: 'Sipariş event stream’i veya iş kuyruğu senaryosunu seç. İki broker için gerçek yapılandırma kararları ver, must-have testlerini çalıştır, ADR oluştur.',
  },
  'behavioral-star': {
    kind: 'star', eyebrow: 'STAR STORY BUILDER', badge: 'S · T · A · R',
    title: 'Mülakat cevabını soyut sıfatlardan somut kanıta çevir.',
    copy: 'Situation, Task, Action ve Result parçalarını sırayla aç. Özellikle senin Action’ın ve sonucu görünür olsun.',
  },
}

const experiments = {
  mockito: {
    change: 'Stub cevabını APPROVED/DECLINED yap; service’i çalıştır ve verify() çağır.',
    watch: 'Stub sonucu ile interaction kanıtı aynı şey mi; charge() gerçekten kaç kez çağrıldı?',
  },
  'test-strategy': {
    change: 'Happy path, boundary, dependency failure ve duplicate risklerini sırayla kapsama al.',
    watch: 'Test sayısından bağımsız olarak hangi business riskleri hâlâ kanıtsız kalıyor?',
  },
  sdlc: {
    change: 'Requirement’tan maintenance’a kadar lifecycle adımlarını ilerlet.',
    watch: 'Her aşamanın çıktısı bir sonrakini nasıl besliyor; feedback ne zaman yeni requirement’a dönüyor?',
  },
  'agile-scrum': {
    change: 'Sprint kapasitesini dolduracak kartları seç; sonra sprint başladıktan sonra scope’u zorla değiştir.',
    watch: 'Product Backlog önceliği ile Sprint commitment aynı şey mi; kapasite aşılırsa ne bozuluyor?',
  },
  'documentation-troubleshooting': {
    change: 'Log, metric, deploy geçmişi ve runbook kanıtlarını farklı sırayla aç.',
    watch: 'Hangi kanıt root cause hipotezini gerçekten daraltıyor; runbook tek başına neden kanıt değil?',
  },
  'git-workflow': {
    change: 'Feature branch’i merge ve rebase ile ayrı ayrı main’e taşı.',
    watch: 'Commit graph ve commit kimlikleri nasıl değişiyor; hangi yaklaşım history’yi yeniden yazıyor?',
  },
  'monolith-basics': {
    change: 'Order, Catalog veya Payment modülünden birini değiştir.',
    watch: 'Kod modülü ayrı olsa bile hangi deploy artifact’ı yeniden üretiliyor ve yayınlanıyor?',
  },
  'microservice-basics': {
    change: 'Bir servisi durdur, diğerini ölçekle ve servisleri bağımsız yeniden başlat.',
    watch: 'Process/deploy sınırları failure ve scaling davranışını gerçekten nasıl ayırıyor?',
  },
  'monolith-microservices': {
    change: 'Aynı checkout sistemini monolith ve microservice modları arasında değiştir.',
    watch: 'Deploy birimi, network hop ve failure boundary aynı anda nasıl değişiyor?',
  },
  'service-boundary': {
    change: 'Order status, refund, stock ve payment authorization sorumluluklarını servislere dağıt.',
    watch: 'Sınır teknik katmana göre mi, business capability ve ownership’e göre mi daha tutarlı oluyor?',
  },
  'sync-communication': {
    change: 'Payment latency ve caller timeout değerlerini birbirinin altına/üstüne taşı.',
    watch: 'Caller hangi sürede bloklanıyor ve dependency cevabı timeout’tan sonra gelirse ne oluyor?',
  },
  'microservice-resilience': {
    change: 'Dependency’yi boz; retry sayısını artır ve circuit breaker’ı açılana kadar failure üret.',
    watch: 'Retry yükü ne zaman büyütüyor; circuit açıldığında hangi çağrılar artık dependency’ye gitmiyor?',
  },
  'async-messaging': {
    change: 'Event üret, consumer’ı kapat, birkaç mesaj biriktir ve consumer’ı tekrar aç.',
    watch: 'Producer neden anlık consumer cevabını beklemiyor; backlog nerede tutulup nasıl eriyor?',
  },
  'distributed-consistency': {
    change: 'Order ve Payment başarılıyken Inventory adımını fail ettir; compensation çalıştır.',
    watch: 'Tek global rollback yerine hangi local transaction hangi business telafi adımıyla geri alınıyor?',
  },
  'service-discovery-load-balancing': {
    change: 'Bir instance’ı unhealthy yap ve art arda request gönder.',
    watch: 'Discovery hangi hedefleri listeliyor; load balancer yalnız sağlıklı instance’lara nasıl dağıtıyor?',
  },
  'api-gateway-proxy': {
    change: 'Request path’ini /catalog, /orders ve /payments arasında değiştir.',
    watch: 'Gateway hangi backend’i seçiyor; routing ile domain logic sınırı nerede kalıyor?',
  },
  'aggregator-pattern': {
    change: 'Bir downstream kaynağı timeout ettir ve partial response politikasını aç/kapat.',
    watch: 'Fan-out sonuçları nasıl tek DTO’da birleşiyor; eksik kaynakta complete/partial/fail kararı nasıl değişiyor?',
  },
  'pipeline-pattern': {
    change: 'Validate, Authorize, Enrich veya Process stage’lerinden birini fail ettir.',
    watch: 'Failure sonrası hangi stage’ler çalışmıyor ve erken çıkış hangi yan etkileri engelliyor?',
  },
  'shared-resources': {
    change: 'Shared schema ile database-per-service arasında geç; aynı kolon migration’ını uygula.',
    watch: 'Schema değişikliğinin blast radius’u kaç servise yayılıyor ve ownership ne kadar netleşiyor?',
  },
  'independent-deployment': {
    change: 'Payment v2 contract’ını compatible ve breaking biçimde yayınla.',
    watch: 'Order servisi redeploy edilmeden çalışabiliyor mu; gerçek bağımsız deploy hangi contract koşuluna bağlı?',
  },
  'microservice-principles': {
    change: 'Shared ownership, mixed responsibility, breaking contract ve eksik telemetry senaryolarını tek tek dene.',
    watch: 'Hangi karar deploy coupling, change blast radius veya incident blindness üretiyor; neden tek bir mimari yüzde yerine somut kanıt gerekir?',
  },
  'ddd-basics': {
    change: 'Customer/Status terimlerini farklı context’lerde incele; Money, Refund ve Shipment ownership vakalarını context’lere yerleştir.',
    watch: 'Aynı kelimenin ubiquitous language anlamı context’e göre nasıl değişiyor; yanlış ownership hangi context leak’i doğuruyor?',
  },
  'ddd-services': {
    change: 'Orchestration, business invariant ve external-model translation davranışlarını farklı katmanlara yerleştir.',
    watch: 'Yanlış yerleşim framework coupling, anemic domain veya ubiquitous-language leakage olarak hangi mimari kokuyu üretiyor?',
  },
  'microservice-system-design': {
    change: 'İletişim tipi, data ownership ve recovery politikasını seç; ardından Payment outage enjekte et.',
    watch: 'Client status/latency, Order state, runtime/deploy coupling ve failure containment seçimlerle birlikte nasıl değişiyor?',
  },
  'devops-basics': {
    change: 'Committen build, deploy, observe ve learn adımlarına kadar feedback loop’u ilerlet.',
    watch: 'Production sinyali hangi noktada geliştirme kararına geri dönüyor ve feedback süresi nasıl kısalıyor?',
  },
  'ci-basics': {
    change: 'Pipeline test gate’ini önce geçir, sonra bilinçli olarak kır.',
    watch: 'Build/test başarısızken artifact hangi aşamada duruyor ve CI neyi entegrasyon öncesi yakalıyor?',
  },
  'cd-basics': {
    change: 'Aynı artifact için manuel approval ve otomatik production release modları arasında geç.',
    watch: 'Continuous Delivery ile Deployment farkı artifact’ta mı, production gate politikasında mı oluşuyor?',
  },
  'maven-artifact': {
    change: 'Resolve → compile → test → package lifecycle adımlarını sırayla çalıştır.',
    watch: 'Deploy edilebilir JAR hangi aşamada oluşuyor ve test başarısızsa package neden ilerlememeli?',
  },
  'docker-basics': {
    change: 'Image’ı build et; aynı image’dan birden fazla container başlat ve birini sil.',
    watch: 'Immutable image ile çalışan container instance’larının lifecycle’ı nasıl ayrılıyor?',
  },
  'kubernetes-basics': {
    change: 'Bir Pod’u öldür ve readiness durumunu değiştir.',
    watch: 'Deployment desired replica sayısını nasıl geri kuruyor; Service hangi Pod’lara trafik göndermiyor?',
  },
  'pipeline-as-code': {
    change: 'Lint, test ve scan stage’lerini pipeline tanımında aç/kapat.',
    watch: 'Pipeline davranışı dosya değişikliği olarak nasıl versionlanıp review edilebilir hale geliyor?',
  },
  'cicd-secrets-config': {
    change: 'Secret’i plain text, masked variable ve runtime injection yöntemleriyle geçir.',
    watch: 'Hangi yaklaşım credential’ı log/image içinde iz bırakacak şekilde sızdırıyor?',
  },
  'deployment-rollback': {
    change: 'Canary trafik yüzdesini yükselt; error rate threshold’unu aş ve rollback tetikle.',
    watch: 'Yeni sürüm sinyali kötüleştiğinde rollout ne zaman duruyor ve trafik hangi sürüme dönüyor?',
  },
  'cicd-interview': {
    change: 'Test failure, approval ve rollback senaryolarında pipeline kararını seç.',
    watch: 'Seçimin teknik gerekçesi mülakatta kısa ve savunulabilir bir cümleye dönüşüyor mu?',
  },
  'react-basics': {
    change: 'Prop/state değerini değiştir ve effect dependency’sini tetikleyecek/tetiklemeyecek güncellemeler yap.',
    watch: 'Render sayısı ile effect çalışma sayısı neden aynı değil; hangi dependency effect’i yeniden çalıştırıyor?',
  },
  'python-basics': {
    change: 'Aynı List/Map/null veri işlemini Java ve Python karşılıkları arasında eşleştir.',
    watch: 'Syntax değişirken veri dönüşümünün ortak amacı ve type/null farkları nasıl korunuyor?',
  },
  'enterprise-quality-compliance': {
    change: 'Review, test, security scan, PII ve audit-trail gate’lerini tek tek tamamla.',
    watch: 'Kod çalışsa bile release hangi kanıt eksikken kapalı kalıyor ve hangi kontrol hangi riski kapsıyor?',
  },
  'stakeholder-collaboration': {
    change: 'Order cancellation requirement’ı için status, refund, authorization ve response sorularını sırayla sor.',
    watch: 'Belirsiz talep hangi noktada ölçülebilir acceptance criteria ve test case’e dönüşüyor?',
  },
  'delivery-prioritization': {
    change: 'Incident, blocker ve feature kartlarını impact, urgency ve dependency’ye göre yeniden sırala.',
    watch: 'Kapasite sınırlıyken hangi iş neden önce geliyor ve yalnız “önemli” etiketi neden yeterli değil?',
  },
  'existing-app-support': {
    change: 'Root cause kanıtı topla, 3 patch seçeneğini test et, canary/full rollout yap ve üretim hatası enjekte et.',
    watch: 'Contract FAIL ve monitoring FAIL hangi farklı riskleri buluyor? Eski test kanıtı patch değişince neden siliniyor?',
  },
  'technology-evaluation': {
    change: 'Senaryoyu seç, broker ayarlarını değiştir, iki adayın must-have testlerini çalıştır ve ADR üret.',
    watch: 'Kafka partition key veya 7 gün retention eksikse ne bozulur? Classic RabbitMQ queue neden ACK sonrası replay yapamaz?',
  },
  'behavioral-star': {
    change: 'Situation, Task, Action ve Result parçaları için soyut veya somut kanıt seçeneklerini seç.',
    watch: 'Cevapta senin kişisel Action’ın ve ölçülebilir Result’ın görünür olup olmadığı nasıl değişiyor?',
  },
}

function MockGame({ lesson, spec }) {
  const [stub, setStub] = useState('APPROVED')
  const [runs, setRuns] = useState(0)
  const [verified, setVerified] = useState(null)
  const chargeCalls = runs
  const verify = () => setVerified(chargeCalls > 0 ? 'pass' : 'fail')
  const footer = verified === 'pass'
    ? `verify(paymentClient.charge) PASS → ${chargeCalls} çağrı gözlendi.`
    : verified === 'fail'
      ? 'verify(paymentClient.charge) FAIL → beklenen interaction hiç gerçekleşmedi. Önce CheckoutService’i çalıştır.'
      : 'Stub dependency cevabını kontrol eder; verify ise interaction gerçekten oldu mu kanıtlar.'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-mock" footer={footer}>
    <div className="arcade-toolbar"><button className={stub === 'APPROVED' ? 'active' : ''} onClick={() => { setStub('APPROVED'); setVerified(null) }}>when().thenReturn(APPROVED)</button><button className={stub === 'DECLINED' ? 'active' : ''} onClick={() => { setStub('DECLINED'); setVerified(null) }}>thenReturn(DECLINED)</button><button className="sim-action" onClick={() => { setRuns((v) => v + 1); setVerified(null) }}>Checkout çalıştır</button><button className={verified === 'fail' ? 'danger active' : verified === 'pass' ? 'active' : ''} onClick={verify}>verify()</button></div>
    <div className="mock-stage"><div><small>@MOCK</small><strong>PaymentClient</strong><code>charge() → {stub}</code></div><motion.i key={runs} initial={{ scaleX: 0 }} animate={{ scaleX: runs ? 1 : .08 }} /><div><small>@INJECTMOCKS</small><strong>CheckoutService</strong><code>{runs ? (stub === 'APPROVED' ? 'order = CONFIRMED' : 'order = REJECTED') : 'waiting...'}</code></div><div className="mock-counter"><small>CALLS</small><strong>{chargeCalls}</strong></div></div>
  </ArcadeFrame>
}

function RiskGame({ lesson, spec }) {
  const cases = [
    ['Valid order → 201 ve kayıt gerçekten oluştu', 'Sadece endpoint 2xx döndü'],
    ['quantity=0 / max boundary davranışını assert et', 'Bir tane rastgele valid quantity dene'],
    ['Payment timeout → order confirm edilmesin + hata contract’ı doğrulansın', 'Payment mock her zaman APPROVED dönsün'],
    ['Aynı idempotency key iki kez → tek side-effect', 'İki farklı request gönderip ikisinin de 200 olmasına bak'],
  ]
  const [active, setActive] = useState(0)
  const [answers, setAnswers] = useState(Array(spec.risks.length).fill(null))
  const score = answers.filter(Boolean).length
  const choose = (correct) => setAnswers((xs) => xs.map((v, i) => i === active ? correct : v))
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-risk" footer={`${score}/${spec.risks.length} risk için davranış kanıtı var. Risk kutusunu işaretlemek değil, failure/boundary davranışını assert etmek coverage üretir.`}>
    <div className="risk-grid">{spec.risks.map((risk, i) => <button key={risk} className={active === i ? 'active' : answers[i] ? 'covered' : ''} onClick={() => setActive(i)}><span>{String(i + 1).padStart(2, '0')}</span><strong>{risk}</strong><small>{answers[i] === null ? 'KANIT SEÇ' : answers[i] ? 'KANIT VAR' : 'ZAYIF TEST'}</small></button>)}</div>
    <div className="arcade-toolbar"><button className={answers[active] === true ? 'active' : ''} onClick={() => choose(true)}>{cases[active][0]}</button><button className={answers[active] === false ? 'danger active' : ''} onClick={() => choose(false)}>{cases[active][1]}</button></div>
    <div className="risk-meter"><motion.i animate={{ width: `${score / spec.risks.length * 100}%` }} /><strong>{Math.round(score / spec.risks.length * 100)}%</strong></div>
  </ArcadeFrame>
}

function LoopGame({ lesson, spec }) {
  const [step, setStep] = useState(0)
  const current = spec.steps[step]
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-loop" footer={step === spec.steps.length - 1 ? 'Maintenance feedback’i yeni Requirement’a döner; yaşam döngüsü tekrar başlar.' : `${current} çıktısı → ${spec.steps[step + 1]}`}>
    <div className="loop-wheel">{spec.steps.map((x, i) => <button key={x} className={i === step ? 'active' : i < step ? 'visited' : ''} onClick={() => setStep(i)}><span>{i + 1}</span><strong>{x}</strong></button>)}<motion.div key={current} className="loop-core" initial={{ scale: .9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><small>ACTIVE PHASE</small><strong>{current}</strong><code>{step === 0 ? 'acceptance criteria' : step === 1 ? 'trade-off / API' : step === 2 ? 'reviewable change' : step === 3 ? 'test evidence' : step === 4 ? 'artifact + rollback' : 'logs + feedback'}</code></motion.div></div>
  </ArcadeFrame>
}

function ScrumGame({ lesson, spec }) {
  const [states, setStates] = useState(() => spec.cards.map(() => 0))
  const [blocked, setBlocked] = useState('')
  const [started, setStarted] = useState(false)
  const columns = ['PRODUCT BACKLOG', 'SPRINT BACKLOG', 'DONE']
  const capacity = 8
  const committed = spec.cards.reduce((n, c, i) => n + (states[i] > 0 ? c[1] : 0), 0)
  const points = spec.cards.reduce((n, c, i) => n + (states[i] === 2 ? c[1] : 0), 0)
  const move = (i) => {
    if (started && states[i] === 0) {
      setBlocked('Sprint başladı. Yeni scope otomatik eklenmez; PO ve takım Sprint Goal etkisini yeniden değerlendirmeli.')
      return
    }
    if (!started && states[i] === 0 && committed + spec.cards[i][1] > capacity) {
      setBlocked(`${spec.cards[i][0]} alınırsa kapasite ${capacity} SP aşılır. Takım Sprint’e kapasitesinden fazla iş çekmemeli.`)
      return
    }
    setBlocked('')
    setStates((xs) => xs.map((v, n) => n === i ? (started ? (v === 1 ? 2 : v) : (v === 0 ? 1 : 0)) : v))
  }
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-kanban" footer={blocked || (started ? `Sprint aktif · committed=${committed}/${capacity} SP · done=${points} SP. PO öncelik verir; takım seçilen Sprint scope’unu tamamlar.` : `Planning · committed=${committed}/${capacity} SP. Kart sırası PO önceliğini gösterir; takım kapasiteye göre Sprint Backlog’u seçer.`)}>
    <div className="arcade-toolbar"><button className={started ? 'active' : 'sim-action'} disabled={started || committed === 0} onClick={() => { setStarted(true); setBlocked('') }}>{started ? 'SPRINT AKTİF' : 'Sprint başlat'}</button><button disabled={!started} onClick={() => { setStarted(false); setStates((xs) => xs.map((v) => v === 2 ? 0 : v)); setBlocked('Yeni planning başladı; Product Backlog tekrar değerlendirilebilir.') }}>Yeni planning</button><strong>capacity {committed}/{capacity} SP</strong></div>
    <div className="kanban-board">{columns.map((col, c) => <div key={col}><small>{col}</small>{spec.cards.map((card, i) => states[i] === c && <button key={card[0]} onClick={() => move(i)}><strong>P{i + 1} · {card[0]}</strong><span>{card[1]} SP</span><em>{!started ? (c === 0 ? 'Sprint’e al' : 'Backlog’a çıkar') : c === 1 ? 'Done yap' : 'tamamlandı'}</em></button>)}</div>)}</div>
  </ArcadeFrame>
}

function IncidentGame({ lesson, spec }) {
  const [open, setOpen] = useState([])
  const toggle = (i) => setOpen((xs) => xs.includes(i) ? xs.filter((x) => x !== i) : [...xs, i])
  const evidenceReady = [0, 1, 2].every((i) => open.includes(i))
  const runbookOnly = open.includes(3) && !evidenceReady
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-incident" footer={evidenceReady ? 'Log + metric + deploy korelasyonu aynı hipotezi destekliyor. Runbook artık gerekçeli recovery adımı.' : runbookOnly ? 'Runbook bir aksiyon rehberi; tek başına root cause kanıtı değildir.' : 'Root cause için log, metric ve son deploy kanıtını birlikte korele et.'}>
    <div className="incident-board"><div className="incident-symptom"><small>SYMPTOM</small><strong>Checkout 500 ↑</strong><code>09:42 production</code></div><div className="incident-clues">{spec.clues.map((c, i) => <button key={c} className={open.includes(i) ? 'open' : ''} onClick={() => toggle(i)}><span>{open.includes(i) ? '✓' : '?'}</span><strong>{c}</strong></button>)}</div><motion.div className={`incident-hypothesis ${evidenceReady ? 'solved' : ''}`} animate={{ opacity: evidenceReady ? 1 : .35 }}><small>HYPOTHESIS</small><strong>{evidenceReady ? 'payment-client v2 regression' : 'kanıt eksik'}</strong></motion.div></div>
  </ArcadeFrame>
}

function GitGame({ lesson, spec }) {
  const [mode, setMode] = useState('merge')
  const [conflict, setConflict] = useState(false)
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-git" footer={mode === 'merge' ? 'Merge yeni birleşim commit’i ile branch tarihini korur.' : 'Rebase feature commitlerini yeni main ucuna yeniden yazar; shared history’de dikkat gerekir.'}>
    <div className="arcade-toolbar"><button className={mode === 'merge' ? 'active' : ''} onClick={() => setMode('merge')}>Merge</button><button className={mode === 'rebase' ? 'active' : ''} onClick={() => setMode('rebase')}>Rebase</button><button className={conflict ? 'danger active' : ''} onClick={() => setConflict((v) => !v)}>Conflict {conflict ? 'VAR' : 'YOK'}</button></div>
    <div className={`git-graph ${mode} ${conflict ? 'has-conflict' : ''}`}><div className="git-main"><span>M1</span><span>M2</span><span>M3</span>{mode === 'merge' && <span className="merge-dot">MERGE</span>}</div><div className="git-feature"><span>F1</span><span>F2</span>{mode === 'rebase' && <span>F1′</span>}{mode === 'rebase' && <span>F2′</span>}</div>{conflict && <motion.div className="conflict-flag" initial={{ scale: .8 }} animate={{ scale: 1 }}>CONFLICT: same line</motion.div>}</div>
  </ArcadeFrame>
}

function MonolithGame({ lesson, spec }) {
  const modules = ['CATALOG', 'ORDER', 'PAYMENT']
  const [selected, setSelected] = useState('ORDER')
  const [dirty, setDirty] = useState(false)
  const [version, setVersion] = useState(7)
  const [restart, setRestart] = useState(0)
  const edit = (module) => { setSelected(module); setDirty(true) }
  const deploy = () => {
    if (!dirty) return
    setVersion((v) => v + 1)
    setDirty(false)
    setRestart((v) => v + 1)
  }
  const footer = dirty
    ? `${selected} modülü değişti. Deploy sınırı modül değil commerce-app.jar olduğu için yeni artifact bütün uygulamayı taşıyacak.`
    : `commerce-app.jar v${version} · tek process · tek deploy unit. Modüller kod içinde ayrık olabilir ama runtime/deploy sınırı ortaktır.`
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-monolith" footer={footer}>
    <div className="mono-workbench">
      <div className="mono-shell">
        <div className="mono-shell-head"><small>TEK PROCESS</small><strong>commerce-app</strong><span>PID 4210</span></div>
        <div className="mono-modules">{modules.map((module) => <button key={module} className={`${selected === module ? 'active' : ''} ${dirty && selected === module ? 'dirty' : ''}`} onClick={() => edit(module)}><small>MODULE</small><strong>{module}</strong><span>{dirty && selected === module ? '● changed' : 'in-process'}</span></button>)}</div>
        <motion.div key={restart} className="mono-runtime" initial={{ opacity: .35 }} animate={{ opacity: 1 }}><span>CATALOG → ORDER → PAYMENT</span><small>method call / same memory space</small></motion.div>
      </div>
      <div className="mono-build-room">
        <small>BUILD OUTPUT</small>
        <motion.div key={`${version}-${dirty}`} className={`mono-jar ${dirty ? 'pending' : 'ready'}`} initial={{ scale: .96 }} animate={{ scale: 1 }}><span>JAR</span><strong>commerce-app:v{dirty ? version + 1 : version}</strong><code>{modules.join(' + ')}</code></motion.div>
        <button className="sim-action" disabled={!dirty} onClick={deploy}>Build + tüm uygulamayı deploy et</button>
        <div className="mono-facts"><span><b>1</b> artifact</span><span><b>1</b> process</span><span><b>0</b> service network hop</span></div>
      </div>
    </div>
  </ArcadeFrame>
}

function MicroserviceGame({ lesson, spec }) {
  const missions = {
    outage: { title: 'Payment incident', goal: 'PAYMENT servisini düşür. ORDER ve CATALOG process’leri ayakta kalsın. Checkout hata vermeli.' },
    deploy: { title: 'Bağımsız deploy', goal: 'Yalnız PAYMENT v6 deploy et. ORDER v8 ve CATALOG v3 olarak kalsın; checkout başarılı olsun.' },
    scale: { title: 'Yalnız Order scale', goal: 'ORDER en az 3 replica çalışsın. PAYMENT ve CATALOG 1 replica kalsın. Checkout başarılı olsun.' },
  }
  const [mission, setMission] = useState('outage')
  const [services, setServices] = useState(initialServiceFleet)
  const [selected, setSelected] = useState('ORDER')
  const [requests, setRequests] = useState(0)
  const [attempt, setAttempt] = useState(null)
  const update = (name, fn) => { setServices((all) => ({ ...all, [name]: fn(all[name]) })); setAttempt(null) }
  const toggle = (name) => update(name, (s) => ({ ...s, up: !s.up }))
  const scale = (name, delta) => update(name, (s) => ({ ...s, replicas: Math.max(1, Math.min(4, s.replicas + delta)) }))
  const deploy = (name) => update(name, (s) => ({ ...s, version: s.version + 1, up: true }))
  const selectMission = (id) => { setMission(id); setServices(initialServiceFleet); setSelected('ORDER'); setRequests(0); setAttempt(null) }
  const runRequest = () => { setRequests((v) => v + 1); setAttempt({ status: checkoutResponse(services), passed: fleetMissionPassed(mission, services) }) }
  const active = services[selected]
  const orderPathOk = services.ORDER.up && services.PAYMENT.up
  const footer = !active.up
    ? `${selected} DOWN. Diğer process’ler ayakta; sadece bu servise bağımlı akışlar hata/fallback görebilir.`
    : `${selected} v${active.version} · ${active.replicas} replica. Deploy ve scale kararı diğer servislerden bağımsız uygulanıyor.`
  return <ArcadeFrame challenge lesson={lesson} {...spec} className="arcade-microservice" footer={footer}>
    <div className="challenge-tabs">{Object.entries(missions).map(([id, item]) => <button key={id} className={mission === id ? 'active' : ''} onClick={() => selectMission(id)}>{item.title}</button>)}</div>
    <div className="challenge-brief"><small>INCIDENT / DEPLOY MISSION</small><strong>{missions[mission].goal}</strong></div>
    <div className="fleet-console">
      <div className="fleet-map">{Object.entries(services).map(([name, service]) => <motion.button layout key={name} className={`${selected === name ? 'active' : ''} ${service.up ? 'up' : 'down'}`} onClick={() => setSelected(name)}><small>SERVICE</small><strong>{name}</strong><span>v{service.version}</span><div className="replica-pips">{Array.from({ length: service.replicas }).map((_, i) => <i key={i}/>)}</div><em>{service.up ? `${service.replicas} READY` : 'DOWN'}</em></motion.button>)}</div>
      <div className="fleet-control">
        <small>CONTROL · {selected}</small><strong>{active.up ? 'HEALTHY' : 'UNAVAILABLE'}</strong>
        <div><button onClick={() => scale(selected, -1)}>− replica</button><button onClick={() => scale(selected, 1)}>+ replica</button></div>
        <button className={active.up ? 'danger' : 'active'} onClick={() => toggle(selected)}>{active.up ? 'Process’i düşür' : 'Process’i başlat'}</button>
        <button className="sim-action" onClick={() => deploy(selected)}>Sadece {selected} deploy et</button>
      </div>
      <div className={`fleet-request ${orderPathOk ? 'ok' : 'fail'}`}>
        <div className="fleet-request-head"><small>CHECKOUT REQUEST · GÖREV KONTROLÜ</small><button className="sim-action" onClick={runRequest}>Request çalıştır ve doğrula ↻</button></div>
        <div className="fleet-request-flow">
          <div className={services.ORDER.up ? 'up' : 'down'}><span>01</span><strong>ORDER</strong><small>{services.ORDER.up ? `${services.ORDER.replicas} ready replica` : 'process down'}</small></div>
          <i>→</i>
          <div className={services.PAYMENT.up ? 'up' : 'down'}><span>02</span><strong>PAYMENT</strong><small>{services.PAYMENT.up ? `v${services.PAYMENT.version} answers` : 'dependency unavailable'}</small></div>
          <motion.b key={requests} initial={{ opacity: 0, scale: .75 }} animate={{ opacity: attempt ? 1 : .35, scale: 1 }}>{attempt?.status ?? 'RUN'}</motion.b>
        </div>
        <span className="fleet-independent">CATALOG · {services.CATALOG.up ? 'independent process still healthy' : 'separately down'} · request #{requests}</span>
      </div>
    </div>
    {attempt && <div className={`challenge-feedback ${attempt.passed ? 'passed' : 'failed'}`} role="status"><strong>{attempt.passed ? 'GÖREV TAMAMLANDI' : 'HEDEF SAĞLANMADI'} · {attempt.status}</strong><p>{attempt.passed ? 'Servis durumu ve checkout çıktısı hedefle eşleşiyor.' : mission === 'outage' ? 'Sadece PAYMENT down olmalı. Checkout hata verirken ORDER ve CATALOG çalışmalı.' : mission === 'deploy' ? 'Yalnız PAYMENT v6 olmalı. Diğer sürümleri ve servislerin sağlığını kontrol et.' : 'ORDER replica sayısı en az 3, diğer servisler 1 replica ve tüm servisler UP olmalı.'}</p></div>}
    <p className="challenge-caveat">Process erişilebilirliği ile checkout başarısı ayrı şeylerdir. Gerçek distributed failure, timeout ve data consistency bu modelde simüle edilmiyor.</p>
  </ArcadeFrame>
}

function ArchitectureCompareGame({ lesson, spec }) {
  const scenarios = {
    change: { label: 'CHANGE', title: 'Payment koduna küçük değişiklik', mono: ['1 artifact rebuild', '1 process restart', 'in-process calls'], micro: ['Payment deploy only', 'Order/Catalog untouched', 'network contract stays'] },
    request: { label: 'REQUEST', title: 'Checkout request akışı', mono: ['1 process', '0 service network hop', 'simple trace'], micro: ['3 processes', '2 network hops', 'distributed trace needed'] },
    failure: { label: 'FAILURE', title: 'Payment çöktü', mono: ['process-level blast risk', 'tek runtime sınırı', 'restart whole app olabilir'], micro: ['Payment boundary isolated', 'Order fallback gerekir', 'Catalog process ayakta'] },
  }
  const [scenario, setScenario] = useState('change')
  const [pulse, setPulse] = useState(0)
  const current = scenarios[scenario]
  const footer = scenario === 'change'
    ? 'Monolith operasyonel olarak basit; microservice bağımsız deploy sınırı verir ama dağıtık sistem maliyeti ekler.'
    : scenario === 'request'
      ? 'Network hop ve observability ihtiyacı microservice tarafında artar; monolith çağrısı process içinde kalır.'
      : 'Microservice failure boundary’yi küçültebilir; yine de dependency failure’ını timeout/fallback gibi mekanizmalarla yönetmek gerekir.'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-compare" footer={footer}>
    <div className="compare-toolbar">{Object.entries(scenarios).map(([id, item]) => <button key={id} className={scenario === id ? 'active' : ''} onClick={() => { setScenario(id); setPulse((v) => v + 1) }}>{item.label}</button>)}<button className="sim-action" onClick={() => setPulse((v) => v + 1)}>Senaryoyu çalıştır ↻</button></div>
    <div className="architecture-duel">
      {[['MONOLITH', current.mono], ['MICROSERVICES', current.micro]].map(([name, facts], lane) => <motion.div key={`${scenario}-${name}-${pulse}`} className={`duel-lane ${lane ? 'micro' : 'mono'}`} initial={{ opacity: .45, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="duel-head"><small>{name}</small><strong>{current.title}</strong></div>
        <div className="duel-system">{lane === 0 ? <><span>CATALOG</span><span>ORDER</span><span>PAYMENT</span><em>commerce-app.jar</em></> : <><span>CATALOG</span><i>→</i><span>ORDER</span><i>→</i><span>PAYMENT</span></>}</div>
        <ul>{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      </motion.div>)}
    </div>
    <div className="duel-metrics"><span><small>DEPLOY UNIT</small><b>1 ↔ 3</b></span><span><small>NETWORK HOP</small><b>0 ↔ 2</b></span><span><small>OPS COMPLEXITY</small><b>lower ↔ higher</b></span><span><small>FAILURE BOUNDARY</small><b>shared ↔ isolated</b></span></div>
  </ArcadeFrame>
}

function SortGame({ lesson, spec }) {
  const [assignments, setAssignments] = useState(() => spec.cards.map(() => null))
  const [active, setActive] = useState(0)
  const assign = (bucket) => setAssignments((xs) => xs.map((v, i) => i === active ? bucket : v))
  const correct = assignments.filter((v, i) => v === spec.cards[i][1]).length
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-sort" footer={`${correct}/${spec.cards.length} ownership doğru. Business rule hangi servise aitse veri/behavior ownership orada netleşir.`}>
    <div className="sort-cards">{spec.cards.map((c, i) => <button key={c[0]} className={i === active ? 'active' : ''} onClick={() => setActive(i)}><strong>{c[0]}</strong><small>{assignments[i] ?? 'atanmadı'}</small></button>)}</div><div className="sort-buckets">{spec.buckets.map((b) => <button key={b} onClick={() => assign(b)}><small>SERVICE</small><strong>{b}</strong><span>{assignments.filter((x) => x === b).length} kart</span></button>)}</div>
  </ArcadeFrame>
}

function LatencyGame({ lesson, spec }) {
  const [latency, setLatency] = useState(800)
  const [timeout, setTimeout] = useState(1000)
  const success = latency <= timeout
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-latency" footer={success ? `Payment ${latency}ms’de döndü; caller ${timeout}ms sınırı içinde devam etti.` : `Timeout ${timeout}ms’de kesti; Payment cevabı ${latency}ms olduğundan caller failure gördü.`}>
    <div className="latency-controls"><label>Payment latency <input type="range" min="100" max="2200" step="100" value={latency} onChange={(e) => setLatency(Number(e.target.value))}/><b>{latency}ms</b></label><label>Timeout <input type="range" min="300" max="1800" step="100" value={timeout} onChange={(e) => setTimeout(Number(e.target.value))}/><b>{timeout}ms</b></label></div><div className="latency-track"><div className="latency-start">ORDER</div><motion.div className={`latency-packet ${success ? 'ok' : 'fail'}`} animate={{ left: `${Math.min(92, latency / 24)}%` }}>REQ</motion.div><div className="timeout-marker" style={{ left: `${Math.min(92, timeout / 24)}%` }}><span>timeout</span></div><div className="latency-end">PAYMENT</div></div>
  </ArcadeFrame>
}

function BreakerGame({ lesson, spec }) {
  const [dependency, setDependency] = useState('slow')
  const [retries, setRetries] = useState(1)
  const [timeout, setTimeout] = useState(800)
  const [fallback, setFallback] = useState(true)
  const [simulation, setSimulation] = useState(createResilienceState)
  const { circuit, consecutiveFailures, requests, attempts, blocked, elapsedMs, last, history } = simulation
  const sendRequest = () => setSimulation((current) => runResilienceRequest(current, { dependency, retries, timeout, fallback }))
  const footer = circuit === 'OPEN'
    ? 'OPEN: yeni istekler Payment’a gitmeden reddedilir. Cooldown sonunu simüle edip HALF_OPEN probe gönder.'
    : circuit === 'HALF_OPEN'
      ? 'HALF_OPEN: yalnızca tek probe yapılır, retry uygulanmaz. Başarılıysa CLOSED, başarısızsa OPEN.'
      : 'CLOSED: 3 ardışık başarısız istek devreyi açar. Aynı isteğin retry denemeleri tek başarısız istek sayılır.'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-breaker" footer={footer}>
    <div className="breaker-config" aria-label="Simülasyon seçenekleri">
      <div className="breaker-control"><small>PAYMENT SENARYOSU</small><div className="arcade-toolbar">
        {[['healthy', 'Sağlıklı · 250ms'], ['slow', 'Yavaş · 1200ms'], ['flaky', 'Dalgalı'], ['down', '503 / Down']].map(([value, label]) =>
          <button key={value} className={dependency === value ? 'active' : ''} aria-pressed={dependency === value} onClick={() => setDependency(value)}>{label}</button>
        )}
      </div></div>
      <div className="breaker-control"><small>CALLER POLİTİKASI</small><div className="arcade-toolbar">
        <button onClick={() => setTimeout((v) => v === 500 ? 800 : v === 800 ? 1500 : 500)}>Timeout: {timeout}ms</button>
        <button onClick={() => setRetries((v) => (v + 1) % 3)}>Retry: {retries}</button>
        <button className={fallback ? 'active' : ''} aria-pressed={fallback} onClick={() => setFallback((v) => !v)}>Pending fallback: {fallback ? 'AÇIK' : 'KAPALI'}</button>
      </div></div>
    </div>
    <div className="breaker-stage">
      <div className="breaker-caller"><small>CALLER</small><strong>Order</strong><span aria-live="polite">{last?.message || 'Request bekleniyor'}</span></div>
      <motion.div className={`breaker-switch ${circuit === 'OPEN' ? 'open' : circuit === 'HALF_OPEN' ? 'half-open' : ''}`} animate={{ rotate: circuit === 'OPEN' ? -7 : circuit === 'HALF_OPEN' ? -3 : 0 }}><small>CIRCUIT BREAKER</small><strong>{circuit}</strong><span>Başarısız istek: {consecutiveFailures}/3</span></motion.div>
      <div className={dependency === 'healthy' ? 'healthy' : 'flaky'}><small>DEPENDENCY</small><strong>Payment</strong><span>{dependency === 'healthy' ? '250ms' : dependency === 'slow' ? '1200ms' : dependency === 'flaky' ? '1200 / 350ms' : '503 · 80ms'}</span></div>
      <div className="failure-pips" aria-label={`Başarısız istek sayısı: ${consecutiveFailures} / 3`}>{[0, 1, 2].map((i) => <i key={i} className={i < consecutiveFailures ? 'hot' : ''} />)}</div>
    </div>
    <div className="breaker-actions">
      <button className="sim-action" onClick={sendRequest}>{circuit === 'HALF_OPEN' ? 'Tek probe gönder →' : 'Order isteği gönder →'}</button>
      {circuit === 'OPEN' && <button onClick={() => setSimulation(expireResilienceCooldown)}>Cooldown süresi doldu → HALF_OPEN</button>}
      <button onClick={() => setSimulation(createResilienceState())}>Simülasyonu sıfırla</button>
    </div>
    <div className="breaker-stats" aria-label="Gerçekleşen istek istatistikleri">
      <span><small>ORDER İSTEKLERİ</small><strong>{requests}</strong></span>
      <span><small>PAYMENT ÇAĞRILARI</small><strong>{attempts}</strong></span>
      <span><small>ENGELLENEN İSTEK</small><strong>{blocked}</strong></span>
      <span><small>TOPLAM SİMÜLE BEKLEME</small><strong>{elapsedMs}ms</strong></span>
    </div>
    <div className="breaker-trace">
      <div className="breaker-trace-heading"><small>SON İSTEĞİN ZAMAN ÇİZELGESİ</small><strong>{last ? `#${last.id} · ${last.elapsedMs}ms · ${last.attempts} Payment çağrısı` : 'İstek göndererek başla'}</strong></div>
      {last ? <ol aria-label="Son isteğin adımları">{last.trace.map((event, index) =>
        <li key={`${last.id}-${index}`} className={`trace-${event.kind}`}><span>{index + 1}</span><strong>{event.text}</strong><em>{event.duration ? `+${event.duration}ms` : '—'}</em></li>
      )}</ol> : <p>Önce yavaş Payment ile 3 başarısız istek gönder. Sonra OPEN korumasını ve HALF_OPEN kurtarma adımını dene.</p>}
      {last && last.outcome !== 'success' && <p className="breaker-warning">Timeout, Payment işleminin iptal edildiğini kanıtlamaz. Ödeme gibi yazma işlemlerinde retry için idempotency key gerekir.</p>}
    </div>
    {history.length > 0 && <div className="breaker-history"><small>SON 6 ORDER İSTEĞİ</small><div>{history.map((entry) =>
      <span key={entry.id} className={`result-${entry.outcome}`}><b>#{entry.id}</b><strong>{entry.outcome === 'success' ? '200 OK' : entry.outcome === 'protected' ? 'BLOCKED' : entry.outcome === 'timeout' ? 'TIMEOUT' : '503'}</strong><em>{entry.attempts} attempt · {entry.elapsedMs}ms</em></span>
    )}</div></div>}
  </ArcadeFrame>
}

function BrokerGame({ lesson, spec }) {
  const [broker, setBroker] = useState(createBrokerState)
  const [failure, setFailure] = useState('healthy')
  const [idempotent, setIdempotent] = useState(true)
  const [loseAck, setLoseAck] = useState(false)
  const settle = () => {
    setBroker((state) => settleBrokerMessage(state, { failure, idempotent, loseAck }))
    setLoseAck(false)
  }
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-broker" footer="Eğitim modeli: kalıcı broker konfigürasyonu varsayılır. At-least-once teslimat duplicate üretebilir. ACK, business işleminin tek kez gerçekleştiğini garanti etmez; event ID ve idempotent consumer gerekir.">
    <div className="broker-guide"><strong>AKIŞI SEN YÖNET</strong><span>01 Yayınla</span><span>02 Teslim et</span><span>03 İşle / ACK</span><span>04 Retry veya DLQ</span></div>
    <div className="broker-actionbar" aria-label="Mesaj akışı kontrolleri">
      <button className="sim-action" onClick={() => setBroker(publishOrderEvent)}>1 · OrderCreated yayınla</button>
      <button onClick={() => setBroker(deliverBrokerMessage)} disabled={!broker.online || !!broker.inFlight || broker.ready.length === 0}>2 · Mesajı teslim et</button>
      <button onClick={settle} disabled={!broker.online || !broker.inFlight}>3 · İşle ve ACK dene</button>
      <button className={broker.online ? 'broker-state-up' : 'broker-state-down'} onClick={() => setBroker((state) => setBrokerConsumerOnline(state, !state.online))}>Consumer: {broker.online ? 'ONLINE' : 'DOWN'}</button>
    </div>
    <div className="broker-options" aria-label="Hata senaryosu ayarları">
      <fieldset><legend>PAYMENT CONSUMER SENARYOSU</legend>
        {[['healthy', 'Başarılı'], ['transient', 'İlk deneme hata'], ['poison', 'Sürekli hata']].map(([value, label]) =>
          <button type="button" key={value} className={failure === value ? 'active' : ''} onClick={() => setFailure(value)} aria-pressed={failure === value}>{label}</button>)}</fieldset>
      <div className="broker-toggles"><button className={idempotent ? 'active' : 'danger'} onClick={() => setIdempotent((value) => !value)} aria-pressed={idempotent}>Idempotency {idempotent ? 'ON' : 'OFF'}</button>
        <button className={loseAck ? 'danger active' : ''} onClick={() => setLoseAck((value) => !value)} aria-pressed={loseAck}>Sonraki ACK {loseAck ? 'KAYBOLACAK' : 'normal'}</button></div>
    </div>
    <div className="broker-board" aria-label="Producer broker ve consumer mesaj akışı">
      <div className="broker-node broker-source"><small>01 / PRODUCER</small><strong>Order Service</strong><span>OrderCreated</span><p>Yayınlanan event: <b>{broker.stats.published}</b></p></div>
      <div className="broker-node broker-storage"><small>02 / BROKER QUEUE</small><div className="broker-number">{broker.ready.length}<em>bekleyen</em></div>
        <div className="broker-message-stack">{broker.ready.length === 0 ? <span className="broker-empty">Kuyruk boş</span> : broker.ready.slice(0, 5).map((message) =>
          <span key={message.id}><b>{message.id}</b><small>{message.attempts === 0 ? 'NEW' : `RETRY ${message.attempts}/${MAX_BROKER_DELIVERIES}`}</small></span>)}
          {broker.ready.length > 5 && <small>+{broker.ready.length - 5} mesaj daha</small>}</div>
      </div>
      <div className={`broker-node broker-target ${broker.online ? '' : 'offline'}`}><small>03 / CONSUMER</small><strong>Payment Service</strong><span>{broker.online ? 'BAĞLI' : 'BAĞLANTI YOK'}</span>
        <div className="broker-flight">{broker.inFlight ? <><b>{broker.inFlight.id}</b><small>{broker.inFlight.attempts}. teslimat · ACK bekleniyor</small></> : <span>Teslim alınan mesaj yok</span>}</div></div>
    </div>
    <div className="broker-metrics" aria-label="Mesaj işleme sonuçları">
      <div><small>TESLİMAT</small><strong>{broker.stats.deliveries}</strong><span>aynı event tekrar gelebilir</span></div>
      <div><small>ACK ALINDI</small><strong>{broker.stats.acked}</strong><span>broker mesajı sildi</span></div>
      <div className={broker.stats.payments > broker.processedIds.length ? 'alert' : ''}><small>ÖDEME ETKİSİ</small><strong>{broker.stats.payments}</strong><span>{broker.processedIds.length} benzersiz event</span></div>
      <div><small>DUPLICATE ENGELLENDİ</small><strong>{broker.stats.deduplicated}</strong><span>{broker.stats.lostAcks} ACK kaybı · {broker.stats.failures} hata</span></div>
    </div>
    <div className="broker-dead-letter"><div><small>DEAD LETTER QUEUE / DLQ</small><strong>{broker.dlq.length} başarısız mesaj</strong><p>{broker.dlq.length ? broker.dlq.map((event) => `${event.id} (${event.attempts} deneme)`).join(' · ') : `Mesaj ${MAX_BROKER_DELIVERIES} başarısız teslimattan sonra buraya alınır.`}</p></div>
      <button disabled={!broker.dlq.length} onClick={() => setBroker(redriveDeadLetter)}>DLQ'dan geri al</button></div>
    <div className="broker-log"><small>EVENT / ACK / RETRY ZAMAN ÇİZELGESİ</small>
      {broker.log.length ? <ol>{broker.log.map((entry) => <li key={entry.id} className={`broker-event-${entry.tone}`}><b>{String(entry.id).padStart(2, '0')}</b><span>{entry.message}</span></li>)}</ol>
        : <p>İlk event'i yayınla. Consumer kapalıyken mesaj biriktirmeyi, sonra ACK kaybı ile duplicate'i dene.</p>}
    </div>
  </ArcadeFrame>
}

function SagaGame({ lesson, spec }) {
  const [saga, setSaga] = useState(createSagaState)
  const [stockAvailable, setStockAvailable] = useState(false)
  const [refundAvailable, setRefundAvailable] = useState(true)
  const [publisherAvailable, setPublisherAvailable] = useState(true)
  const [idempotent, setIdempotent] = useState(true)
  const pendingRefunds = saga.charges - saga.refunds
  const isCompensating = ['compensation', 'compensation_failed'].includes(saga.phase)
  const canReplay = ['inventory', 'compensation', 'compensation_failed'].includes(saga.phase)
  const next = {
    idle: 'Order Service üzerinde siparişi oluştur.',
    payment: 'Payment Service üzerinde ödemeyi al. Bu işlem bağımsız commit olur.',
    payment_outbox: 'Ödeme commit edildi. Inventory henüz event görmedi; Outbox publisher ile broker yayını dene.',
    inventory: 'Inventory Service stok kontrolü yapacak. Stok yoksa iade adımı açılır.',
    compensation: `Payment üzerinde ${pendingRefunds} iade yaparak telafi et.`,
    compensation_failed: 'İade servisi hata verdi. Servisi açıp aynı compensation adımını tekrar dene.',
    confirmed: 'Sipariş tamamlandı. Read model gecikmesini gözlemle veya sıfırla.',
    cancelled: 'Bütün ödeme etkileri telafi edildi. Read model gecikmesini gözlemle veya sıfırla.',
  }[saga.phase]
  const footer = 'Eğitim simülasyonu: Outbox kaydı ve publisher retry görünürdür; gerçek sistemde kalıcı DB, broker, transaction ve gözlemlenebilirlik gerekir. Saga global rollback değildir.'
  const reset = () => setSaga(createSagaState())
  const apply = (fn) => setSaga((state) => fn(state))
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-saga" footer={footer}>
    <div className="saga-scenario">
      <div><small>AKTİF ADIM · {saga.phase.toUpperCase()}</small><p aria-live="polite">{next}</p></div>
      <button onClick={reset}>Simülasyonu sıfırla ↺</button>
    </div>
    <div className="saga-actions" aria-label="Saga işlem adımları">
      <button disabled={saga.phase !== 'idle'} onClick={() => apply(startSaga)}><span>01 / ORDER</span><strong>Sipariş oluştur →</strong></button>
      <button disabled={saga.phase !== 'payment'} onClick={() => apply(chargeSagaPayment)}><span>02 / PAYMENT</span><strong>Ödemeyi al →</strong></button>
      <button disabled={saga.phase !== 'inventory'} onClick={() => apply((s) => decideSagaInventory(s, { available: stockAvailable }))}><span>03 / INVENTORY</span><strong>Stok kontrolü →</strong></button>
      <button disabled={!isCompensating} onClick={() => apply((s) => compensateSaga(s, { refundAvailable }))}><span>04 / COMPENSATION</span><strong>{pendingRefunds > 1 ? `${pendingRefunds} iade kaldı →` : 'İadeyi dene →'}</strong></button>
    </div>
    <div className="saga-hazards">
      <fieldset><legend>Inventory · stok</legend><button className={stockAvailable ? 'active' : 'danger'} disabled={saga.phase !== 'idle' && saga.phase !== 'payment' && saga.phase !== 'inventory'} onClick={() => setStockAvailable((v) => !v)}>{stockAvailable ? 'Stok mevcut ✓' : 'Stok yok ✕'} · değiştir</button><small>03. adımda karar verir</small></fieldset>
      <fieldset><legend>Payment · iade servisi</legend><button className={refundAvailable ? 'active' : 'danger'} onClick={() => setRefundAvailable((v) => !v)}>{refundAvailable ? 'Refund UP ✓' : 'Refund DOWN ✕'} · değiştir</button><small>DOWN iken iade başarısız olur</small></fieldset>
      <fieldset><legend>Outbox publisher</legend><button className={publisherAvailable ? 'active' : 'danger'} disabled={saga.phase !== 'payment_outbox'} onClick={() => setPublisherAvailable((v) => !v)}>{publisherAvailable ? 'Publisher UP ✓' : 'Publisher DOWN ✕'} · değiştir</button><small>Ödeme commitinden sonra broker yayını dener</small></fieldset>
      <fieldset><legend>Payment · idempotency</legend><button className={idempotent ? 'active' : 'danger'} onClick={() => setIdempotent((v) => !v)}>{idempotent ? 'Idempotency ON ✓' : 'Idempotency OFF ✕'} · değiştir</button><small>Duplicate event charge üretir mi?</small></fieldset>
    </div>
    <div className="saga-services" aria-label="Bağımsız servis durumları">
      <div><small>ORDER SERVICE</small><strong>{saga.order}</strong><span>Yerel durum · {saga.phase}</span></div>
      <div className={pendingRefunds > 1 ? 'danger' : ''}><small>PAYMENT SERVICE</small><strong>{saga.payment}</strong><span>{saga.charges} tahsilat / {saga.refunds} iade</span></div>
      <div className={saga.inventory === 'REJECTED' ? 'danger' : ''}><small>INVENTORY SERVICE</small><strong>{saga.inventory}</strong><span>Bağımsız stok kararı</span></div>
    </div>
    <div className={`saga-outbox ${saga.outbox.toLowerCase()}`} aria-live="polite">
      <div><small>TRANSACTIONAL OUTBOX · DB COMMIT / BROKER PUBLISH</small><strong>{saga.outbox === 'EMPTY' ? 'Henüz event yok' : saga.outbox === 'PENDING' ? 'Event DB içinde bekliyor' : 'Event broker’a yayınlandı'}</strong><p>{saga.outbox === 'PENDING' ? 'Publisher başarısız olsa bile charge ile birlikte yazılan Outbox kaydı korunur. Inventory event’i ancak yayın sonrası görür.' : saga.outbox === 'PUBLISHED' ? 'İlk teslimat Outbox ile yapıldı. Sonraki duplicate teslimatlar idempotency ile güvene alınmalı.' : 'Payment adımı charge ve yayınlanacak event kaydını aynı local transaction içinde oluşturur.'}</p></div>
      <div className="saga-outbox-action"><span>{saga.outboxAttempts} publish denemesi · {publisherAvailable ? 'publisher UP' : 'publisher DOWN'}</span><button disabled={saga.phase !== 'payment_outbox'} onClick={() => apply((s) => publishOutbox(s, { publisherAvailable }))}>Outbox yayınını dene →</button></div>
    </div>
    <div className="saga-extras">
      <div className="saga-projection"><small>EVENTUAL CONSISTENCY · READ MODEL</small><div><strong>{saga.readModel}</strong><span>→</span><strong>{saga.order}</strong></div><p>{saga.readModel === saga.order ? 'Projeksiyon güncel.' : 'Read model geride: kullanıcı eski sipariş durumunu görebilir.'}</p><button disabled={saga.readModel === saga.order} onClick={() => apply(syncSagaReadModel)}>Read model'i senkronize et ↻</button></div>
      <div className="saga-replay"><small>AT-LEAST-ONCE · DUPLICATE DELIVERY</small><p>Aynı ödeme event'ini tekrar teslim et. Idempotency kapalıysa ikinci tahsilat gerçek bir yan etkidir.</p><button disabled={!canReplay} onClick={() => apply((s) => redeliverSagaPayment(s, { idempotent }))}>Payment event tekrar gönder ↺</button><span>{saga.ignoredDuplicates} duplicate engellendi · {pendingRefunds} açık tahsilat</span></div>
    </div>
    <div className="saga-trace"><small>İŞLEM GÜNLÜĞÜ · GERÇEKLEŞEN EVENTLER</small>{saga.events.length
      ? <ol aria-live="polite">{saga.events.map((entry) => <li key={entry.id} className={`saga-event-${entry.tone}`}><b>{String(entry.id).padStart(2, '0')}</b><span><strong>{entry.event}</strong><small>{entry.service} · {entry.description}</small></span></li>)}</ol>
      : <p>İlk adımda sipariş oluştur. Stok hatası ve iade kesintisini deneyerek neden compensation gerektiğini gör.</p>}</div>
  </ArcadeFrame>
}

function BalancerGame({ lesson, spec }) {
  const [balancer, setBalancer] = useState(createBalancerState)
  const candidates = balancer.instances.filter((instance) => instance.registered)
  const stale = balancer.instances.filter((instance) => instance.registered !== (instance.processUp && instance.ready))
  const warming = balancer.instances.filter((instance) => instance.processUp && !instance.ready)
  const lastFailed = balancer.lastRouteSucceeded === false
  const maxRequests = Math.max(...balancer.instances.map((instance) => instance.requests), 1)
  const apply = (fn) => setBalancer((state) => fn(state))
  const footer = stale.length
    ? `Registry ${stale.map((instance) => instance.id).join(', ')} için eski sağlık bilgisi taşıyor. Health check gelene kadar load balancer bu eski listeyi kullanabilir.`
    : warming.length
      ? `${warming.map((instance) => instance.id).join(', ')} process UP ama readiness vermedi. Registry bu instance’ları aday listesine almaz.`
      : `Registry güncel. Discovery ${candidates.length} READY aday buluyor; round-robin trafik seçiyor. Health check ve load balancing farklı sorumluluklar.`
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-balancer" footer={footer}>
    <div className="balancer-summary">
      <div><small>DISCOVERY ADAYI</small><strong>{candidates.length}</strong><span>{candidates.map((instance) => instance.id).join(' · ') || 'boş registry'}</span></div>
      <div className={stale.length ? 'warn' : ''}><small>STALE KAYIT</small><strong>{stale.length}</strong><span>{stale.length ? stale.map((instance) => instance.id).join(' · ') : 'registry = runtime'}</span></div>
      <div className={balancer.failedRequests ? 'danger' : ''}><small>REQUEST</small><strong>{balancer.totalRequests}</strong><span>{balancer.failedRequests} başarısız</span></div>
    </div>
    <div className="balancer-instances" aria-label="Service instance runtime ve registry durumları">
      {balancer.instances.map((instance) => {
        const isDiscoverable = instance.processUp && instance.ready
        const registryIsStale = instance.registered !== isDiscoverable
        return <div key={instance.id} className={`${instance.processUp ? 'runtime-up' : 'runtime-down'} ${registryIsStale ? 'stale' : ''}`}>
          <div><small>INSTANCE</small><strong>{instance.id}</strong></div>
          <dl><div><dt>Runtime</dt><dd>{instance.processUp ? 'UP' : 'DOWN'}</dd></div><div><dt>Readiness</dt><dd>{instance.processUp ? (instance.ready ? 'READY' : 'NOT READY') : 'UNAVAILABLE'}</dd></div><div><dt>Registry</dt><dd>{instance.registered ? 'REGISTERED' : 'EVICTED'}</dd></div></dl>
          <button className={instance.processUp ? '' : 'danger'} onClick={() => apply((state) => setInstanceProcess(state, instance.id, !instance.processUp))}>{instance.processUp ? 'Process’i düşür' : 'Process’i başlat'}</button>
          <button disabled={!instance.processUp} className={instance.ready ? 'active' : ''} onClick={() => apply((state) => setInstanceReadiness(state, instance.id, !instance.ready))}>{instance.ready ? 'Readiness’i düşür' : 'READY olarak işaretle'}</button>
          <span>{registryIsStale ? 'Registry eski sağlık bilgisi taşıyor' : instance.processUp && !instance.ready ? 'Process UP; readiness geçene kadar route edilmez' : 'Process, readiness ve registry uyumlu'}</span>
        </div>
      })}
    </div>
    <div className="balancer-actions">
      <button className="sim-action" onClick={() => apply(routeBalancerRequest)}>1 request gönder</button>
      <button onClick={() => apply((state) => routeBalancerBatch(state, 6))}>6 request burst</button>
      <button className={stale.length ? 'active' : ''} onClick={() => apply(runDiscoveryHealthCheck)}>Health check çalıştır</button>
      <button onClick={() => setBalancer(createBalancerState())}>Sıfırla ↺</button>
    </div>
    <div className="balancer-flow" aria-label="Discovery ve load balancing akışı">
      <div><small>CLIENT</small><strong>GET /orders</strong><span>request #{balancer.totalRequests + 1}</span></div>
      <i>→</i>
      <div className="discovery-box"><small>SERVICE DISCOVERY · REGISTRY</small><strong>{candidates.length ? candidates.map((instance) => instance.id).join(', ') : 'NO INSTANCE'}</strong><span>Son health check kaydı; güncel olmayabilir</span></div>
      <i>→</i>
      <div className="round-robin-box"><small>LOAD BALANCER</small><strong>ROUND ROBIN</strong><span>Adaylardan birini seçer</span></div>
      <i>→</i>
      <motion.div key={`${balancer.lastRoute}-${balancer.totalRequests}`} className={`route-target ${balancer.lastRoute ? (lastFailed ? 'fail' : 'ok') : ''}`} initial={{ scale: .94 }} animate={{ scale: 1 }}><small>SON HEDEF</small><strong>{balancer.lastRoute ?? '—'}</strong><span>{balancer.lastRoute ? (lastFailed ? 'FAILED' : '200 OK') : 'request bekleniyor'}</span></motion.div>
    </div>
    <div className="balancer-distribution">
      <small>REQUEST DAĞILIMI</small>
      {balancer.instances.map((instance) => <div key={instance.id}><b>{instance.id}</b><span><i style={{ width: `${(instance.requests / maxRequests) * 100}%` }} /></span><strong>{instance.requests}</strong></div>)}
    </div>
    <div className="balancer-trace"><small>REGISTRY / ROUTING TRACE</small>{balancer.events.length
      ? <ol aria-live="polite">{balancer.events.map((event) => <li key={event.id} className={`balancer-event-${event.tone}`}><b>{String(event.id).padStart(2, '0')}</b><span>{event.message}</span></li>)}</ol>
      : <p>P2 process’ini düşür, önce request gönder. Sonra health check çalıştırıp aynı deneyi tekrar yap.</p>}</div>
  </ArcadeFrame>
}

function RouterGame({ lesson, spec }) {
  const [gateway, setGateway] = useState(createGatewayState)
  const [path, setPath] = useState('/orders')
  const [tokenValid, setTokenValid] = useState(true)
  const [rateLimitEnabled, setRateLimitEnabled] = useState(true)
  const [timeoutMs, setTimeoutMs] = useState(500)
  const last = gateway.last
  const apply = (fn) => setGateway((state) => fn(state))
  const send = () => apply((state) => runGatewayRequest(state, { path, tokenValid, rateLimitEnabled, timeoutMs }))
  const footer = last
    ? `Son request ${last.status}: ${last.outcome} Backend attempt toplamı ${gateway.backendAttempts}. Gateway auth/rate-limit/routing uygular; business logic hedef serviste kalır.`
    : 'Request gönder. Policy zincirinde hangi aşamanın request’i durdurduğunu ve backend’e ulaşıp ulaşmadığını izle.'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-router" footer={footer}>
    <div className="gateway-request-builder">
      <div className="gateway-path-picker"><small>CLIENT REQUEST</small>{['/catalog/42','/orders','/payments/17','/unknown'].map((candidate) => <button key={candidate} className={path === candidate ? 'active' : ''} onClick={() => setPath(candidate)}><code>{candidate}</code></button>)}</div>
      <div className="gateway-policy-controls">
        <button className={tokenValid ? 'active' : 'danger'} onClick={() => setTokenValid((value) => !value)}>JWT {tokenValid ? 'VALID' : 'MISSING'}</button>
        <button className={rateLimitEnabled ? 'active' : ''} onClick={() => setRateLimitEnabled((value) => !value)}>Rate limit {rateLimitEnabled ? 'ON' : 'OFF'}</button>
        <label><span>Gateway timeout</span><strong>{timeoutMs}ms</strong><input type="range" min="100" max="1000" step="100" value={timeoutMs} onChange={(event) => setTimeoutMs(Number(event.target.value))}/></label>
      </div>
    </div>
    <div className="gateway-route-table">
      <small>ROUTE TABLE</small>
      {gateway.services.map((service) => <div key={service.id}><code>{service.prefix}/**</code><span>→</span><strong>{service.id}</strong><em>{service.up ? `${service.latencyMs}ms · UP` : 'DOWN'}</em></div>)}
    </div>
    <div className="gateway-backends">
      {gateway.services.map((service) => <div key={service.id} className={service.up ? '' : 'down'}>
        <div><small>BACKEND</small><strong>{service.id}</strong></div>
        <span>{service.hits} proxy attempt · {service.latencyMs}ms</span>
        <button className={service.up ? '' : 'danger'} onClick={() => apply((state) => setGatewayServiceHealth(state, service.id, !service.up))}>{service.up ? 'Backend’i düşür' : 'Backend’i aç'}</button>
        <button onClick={() => apply((state) => setGatewayServiceLatency(state, service.id, service.latencyMs >= 900 ? 180 : 900))}>{service.latencyMs >= 900 ? 'Latency normal' : 'Latency 900ms yap'}</button>
      </div>)}
    </div>
    <div className="gateway-actions">
      <button className="sim-action" onClick={send}>Request gönder</button>
      <button disabled={!gateway.rateWindowCount} onClick={() => apply(resetGatewayRateWindow)}>Rate window sıfırla</button>
      <button onClick={() => setGateway(createGatewayState())}>Simülasyonu sıfırla ↺</button>
      <div><small>RATE WINDOW</small><strong>{gateway.rateWindowCount}/{gateway.rateLimit}</strong><span>{gateway.rejected} rejected · {gateway.backendAttempts} backend attempt</span></div>
    </div>
    <div className="gateway-runtime-flow" aria-label="API Gateway request pipeline">
      {['AUTH', 'RATE LIMIT', 'ROUTE', 'PROXY'].map((stage, index) => {
        const step = last?.trace.find((entry) => entry.stage === stage)
        const blocked = last && !step
        const failed = step && /^4|^5/.test(step.result)
        return <div key={stage} className={blocked ? 'blocked' : failed ? 'failed' : step ? 'passed' : ''}><b>{String(index + 1).padStart(2, '0')}</b><strong>{stage}</strong><small>{step?.result ?? 'WAIT'}</small><span>{step?.detail ?? 'Request bekleniyor.'}</span></div>
      })}
    </div>
    <div className="gateway-result">
      <div className={last ? (last.status === 200 ? 'ok' : 'fail') : ''}><small>CLIENT RESPONSE</small><motion.strong key={last?.requestId ?? 0} initial={{ scale: .9 }} animate={{ scale: 1 }}>{last?.status ?? '—'}</motion.strong><span>{last?.outcome ?? 'Henüz request yok.'}</span></div>
      <div><small>PROXY SINIRI</small><p>401, 429 ve 404 gateway içinde biter. 503/504 için backend çağrısı denenmiştir. 200 hedef servisin cevabıdır.</p></div>
    </div>
    <div className="gateway-trace"><small>REQUEST TRACE</small>{gateway.events.length
      ? <ol aria-live="polite">{gateway.events.map((event) => <li key={event.id} className={`gateway-event-${event.tone}`}><b>{String(event.id).padStart(2, '0')}</b><span>{event.message}</span></li>)}</ol>
      : <p>Önce normal request gönder. Sonra JWT’yi kaldır, rate limit’i doldur, backend’i düşür ve timeout üret.</p>}</div>
  </ArcadeFrame>
}

function FanoutGame({ lesson, spec }) {
  const [aggregator, setAggregator] = useState(createAggregatorState)
  const [partialAllowed, setPartialAllowed] = useState(true)
  const [timeoutMs, setTimeoutMs] = useState(600)
  const last = aggregator.last
  const apply = (fn) => setAggregator((state) => fn(state))
  const run = () => apply((state) => runAggregator(state, { timeoutMs, partialAllowed }))
  const footer = last
    ? `Run #${last.runId}: ${last.status}. Paralel bekleme ${last.parallelMs}ms; aynı çağrılar seri olsaydı ${last.sequentialMs}ms. ${last.partial ? 'Eksik kaynak metadata ile bildirildi.' : last.full ? 'Response tam.' : 'Response body üretilmedi.'}`
    : 'Üç downstream çağrı aynı anda başlar. Aggregator sonuçları timeout politikasına göre birleştirir; toplam süre çağrıların toplamı değildir.'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-fanout" footer={footer}>
    <div className="aggregator-controls">
      <button className={partialAllowed ? 'active' : ''} onClick={() => setPartialAllowed((value) => !value)}>Partial policy: {partialAllowed ? 'ALLOW' : 'FAIL ALL'}</button>
      <label><span>Per-source timeout</span><strong>{timeoutMs}ms</strong><input type="range" min="100" max="1000" step="100" value={timeoutMs} onChange={(event) => setTimeoutMs(Number(event.target.value))}/></label>
      <button className="sim-action" onClick={run}>Aggregator request çalıştır</button>
      <button onClick={() => setAggregator(createAggregatorState())}>Sıfırla ↺</button>
    </div>
    <div className="aggregator-sources">
      {aggregator.sources.map((source) => {
        const outcome = last?.outcomes.find((entry) => entry.id === source.id)
        return <div key={source.id} className={`${source.up ? '' : 'down'} ${outcome ? `result-${outcome.status.toLowerCase()}` : ''}`}>
          <div><small>{source.required ? 'REQUIRED SOURCE' : 'OPTIONAL SOURCE'}</small><strong>{source.id}</strong></div>
          <dl><div><dt>Runtime</dt><dd>{source.up ? 'UP' : 'DOWN'}</dd></div><div><dt>Latency</dt><dd>{source.latencyMs}ms</dd></div><div><dt>Sonuç</dt><dd>{outcome?.status ?? 'WAIT'}</dd></div></dl>
          <button className={source.up ? '' : 'danger'} onClick={() => apply((state) => setAggregatorSourceHealth(state, source.id, !source.up))}>{source.up ? 'Source’u düşür' : 'Source’u aç'}</button>
          <button onClick={() => apply((state) => setAggregatorSourceLatency(state, source.id, source.latencyMs >= 900 ? (source.id === 'USER' ? 120 : source.id === 'ORDER' ? 280 : 450) : 900))}>{source.latencyMs >= 900 ? 'Latency normal' : 'Latency 900ms yap'}</button>
        </div>
      })}
    </div>
    <div className="aggregator-topology" aria-label="Parallel fan-out and fan-in topology">
      <div className="aggregator-client"><small>CLIENT</small><strong>GET /dashboard</strong><span>tek request</span></div>
      <i>→</i>
      <div className="aggregator-core"><small>AGGREGATOR</small><strong>PARALLEL FAN-OUT</strong><span>{last ? `${last.outcomes.filter((entry) => entry.status === 'OK').length}/3 cevap` : '3 çağrı başlat'}</span></div>
      <i>→</i>
      <div className={`aggregator-client-result ${last ? (last.status === 200 ? 'ok' : 'fail') : ''}`}><small>CLIENT RESPONSE</small><strong>{last?.status ?? '—'}</strong><span>{last ? (last.full ? 'FULL DTO' : last.partial ? 'PARTIAL DTO' : 'NO BODY') : 'bekleniyor'}</span></div>
    </div>
    <div className="aggregator-timing">
      <div><small>PARALLEL WAIT</small><strong>{last ? `${last.parallelMs}ms` : '—'}</strong><span>en uzun gözlenen çağrı</span></div>
      <div><small>SEQUENTIAL OLSAYDI</small><strong>{last ? `${last.sequentialMs}ms` : '—'}</strong><span>sürelerin toplamı</span></div>
      <div><small>KAZANÇ</small><strong>{last ? `${Math.max(0, last.sequentialMs - last.parallelMs)}ms` : '—'}</strong><span>paralel fan-out farkı</span></div>
    </div>
    <div className="aggregator-response">
      <div><small>COMPOSED RESPONSE</small><pre>{last?.response ? JSON.stringify(last.response, null, 2) : '{\n  "status": "run bekleniyor"\n}'}</pre></div>
      <div><small>SOURCE OUTCOMES</small>{last ? <ul>{last.outcomes.map((outcome) => <li key={outcome.id} className={`outcome-${outcome.status.toLowerCase()}`}><b>{outcome.id}</b><span>{outcome.status}</span><em>{outcome.waitMs}ms bekledi</em></li>)}</ul> : <p>Request çalıştırınca her source için OK / TIMEOUT / ERROR sonucu burada görünür.</p>}</div>
    </div>
    <div className="aggregator-trace"><small>FAN-OUT / MERGE TRACE</small>{aggregator.events.length
      ? <ol aria-live="polite">{aggregator.events.map((event) => <li key={event.id} className={`aggregator-event-${event.tone}`}><b>{String(event.id).padStart(2, '0')}</b><span>{event.message}</span></li>)}</ol>
      : <p>Önce normal run yap. Sonra PAYMENT’i yavaşlat, ORDER’ı düşür ve USER source’u düşürerek policy farklarını dene.</p>}</div>
  </ArcadeFrame>
}

function GatesGame({ lesson, spec }) {
  const [pipeline, setPipeline] = useState(createProcessPipelineState)
  const [validPayload, setValidPayload] = useState(true)
  const [authorized, setAuthorized] = useState(true)
  const [enrichmentAvailable, setEnrichmentAvailable] = useState(true)
  const [processAvailable, setProcessAvailable] = useState(true)
  const last = pipeline.last
  const controls = { validPayload, authorized, enrichmentAvailable, processAvailable }
  const run = () => setPipeline((state) => runProcessPipeline(state, controls))
  const footer = last
    ? `Run #${last.runId}: ${last.status} ${last.outcome}. ${last.sideEffect ? 'PROCESS kalıcı side-effect üretti.' : 'Erken çıkış nedeniyle yeni sipariş side-effect’i oluşmadı.'}`
    : 'Pipeline her stage’in çıktısını sonraki stage’e taşır. İlk hata zinciri durdurur; PROCESS’e ulaşılmadıysa kalıcı side-effect oluşmaz.'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-gates" footer={footer}>
    <div className="process-pipeline-controls">
      <button className={validPayload ? 'active' : 'danger'} onClick={() => setValidPayload((value) => !value)}>Payload: {validPayload ? 'VALID' : 'INVALID'}</button>
      <button className={authorized ? 'active' : 'danger'} onClick={() => setAuthorized((value) => !value)}>Yetki: {authorized ? 'ALLOW' : 'DENY'}</button>
      <button className={enrichmentAvailable ? 'active' : 'danger'} onClick={() => setEnrichmentAvailable((value) => !value)}>Enrich dependency: {enrichmentAvailable ? 'UP' : 'DOWN'}</button>
      <button className={processAvailable ? 'active' : 'danger'} onClick={() => setProcessAvailable((value) => !value)}>Order writer: {processAvailable ? 'UP' : 'DOWN'}</button>
    </div>
    <div className="process-pipeline-runbar">
      <button className="sim-action" onClick={run}>Pipeline request çalıştır</button>
      <button onClick={() => setPipeline(createProcessPipelineState())}>Sıfırla ↺</button>
      <div><small>PROCESS SIDE-EFFECT</small><strong>{pipeline.processedOrders}</strong><span>kalıcı order commit</span></div>
    </div>
    <div className="process-pipeline-input">
      <div><small>INPUT CONTEXT</small><code>{'{ orderId, amount }'}</code><span>Başlangıç payload’ı</span></div>
      <i>→</i>
      <div><small>ENRICHED CONTEXT</small><code>{last?.context?.customerTier ? '{ orderId, amount, customerTier, riskScore }' : 'henüz enrichment yok'}</code><span>{last?.context?.customerTier ? `tier=${last.context.customerTier} · risk=${last.context.riskScore}` : 'ENRICH geçerse alanlar eklenir'}</span></div>
    </div>
    <div className="process-pipeline-stages" aria-label="Ordered processing pipeline">
      {spec.steps.map((stage, index) => {
        const step = last?.trace.find((entry) => entry.stage === stage)
        const blocked = last && !step
        return <div key={stage} className={blocked ? 'blocked' : step?.status === 'FAIL' ? 'failed' : step?.status === 'PASS' ? 'passed' : ''}>
          <b>{String(index + 1).padStart(2, '0')}</b>
          <strong>{stage}</strong>
          <small>{step?.status ?? (blocked ? 'SKIP' : 'WAIT')}</small>
          <span>{step?.detail ?? (blocked ? 'Önceki stage fail olduğu için çalışmadı.' : 'Request bekleniyor.')}</span>
        </div>
      })}
    </div>
    <div className="process-pipeline-result">
      <div className={last ? (last.status < 300 ? 'ok' : 'fail') : ''}><small>HTTP / OUTCOME</small><strong>{last ? `${last.status} · ${last.outcome}` : '—'}</strong><span>{last?.sideEffect ? 'Order kaydı commit edildi.' : 'Kalıcı değişiklik yok.'}</span></div>
      <div><small>ERKEN ÇIKIŞ KURALI</small><p>VALIDATE, AUTHORIZE veya ENRICH fail olursa PROCESS hiç çalışmaz. Böylece geçersiz veya yetkisiz request business side-effect üretmez.</p></div>
    </div>
    <div className="process-pipeline-trace"><small>PIPELINE TRACE</small>{pipeline.events.length
      ? <ol aria-live="polite">{pipeline.events.map((event) => <li key={event.id} className={`pipeline-event-${event.tone}`}><b>{String(event.id).padStart(2, '0')}</b><span>{event.message}</span></li>)}</ol>
      : <p>Önce happy path çalıştır. Sonra her kontrolü tek tek bozup zincirin hangi noktada durduğunu izle.</p>}</div>
  </ArcadeFrame>
}

function BlastGame({ lesson, spec }) {
  const [resource, setResource] = useState(createSharedResourceState)
  const [architecture, setArchitecture] = useState('shared')
  const [strategy, setStrategy] = useState('breaking')
  const last = resource.last
  const run = () => setResource((state) => runSharedResourceMigration(state, { architecture, strategy }))
  const footer = last
    ? `Run #${last.runId}: blast radius ${last.blastRadius}/3 servis. ${last.strategy === 'expand-contract' ? 'Eski kolon geçici tutulduğu için consumer’lar migrate edilirken sistem çalışmaya devam eder.' : 'Doğrudan schema rename consumer query’lerini kırdı.'}`
    : 'Shared resource coupling’i görmek için migration çalıştır. Aynı fiziksel schema’yı birden fazla servis doğrudan okuyorsa migration blast radius büyür.'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-blast" footer={footer}>
    <div className="resource-controls">
      <button className={architecture === 'shared' ? 'active' : ''} onClick={() => setArchitecture('shared')}>Shared DB</button>
      <button className={architecture === 'isolated' ? 'active' : ''} onClick={() => setArchitecture('isolated')}>DB per service</button>
      <button className={strategy === 'breaking' ? 'danger active' : ''} onClick={() => setStrategy('breaking')}>Breaking rename</button>
      <button className={strategy === 'expand-contract' ? 'active' : ''} onClick={() => setStrategy('expand-contract')}>Expand / contract</button>
    </div>
    <div className="resource-topology">
      <div className="resource-schema"><small>{architecture === 'shared' ? 'SHARED CUSTOMER TABLE' : 'ORDER DB · CUSTOMER TABLE'}</small><strong>customer_id</strong><span>{architecture === 'shared' ? '3 servis doğrudan schema bilir' : 'schema owner = ORDER'}</span></div>
      <i>→</i>
      <div className="resource-consumers">{['ORDER','PAYMENT','REPORT'].map((service) => <span key={service} className={architecture === 'shared' || service === 'ORDER' ? 'direct' : 'isolated'}><b>{service}</b><small>{architecture === 'shared' || service === 'ORDER' ? 'DIRECT SQL' : 'API / EVENT'}</small></span>)}</div>
    </div>
    <div className="resource-migration">
      <div><small>MIGRATION STRATEGY</small><strong>{strategy === 'breaking' ? 'RENAME customer_id TO client_id' : 'ADD client_id + BACKFILL'}</strong><span>{strategy === 'breaking' ? 'eski kolon anında kaybolur' : 'customer_id geçici korunur'}</span></div>
      <button className="sim-action" onClick={run}>Migration çalıştır</button>
      <button onClick={() => setResource(createSharedResourceState())}>Sıfırla ↺</button>
    </div>
    <div className="resource-impact">
      {['ORDER','PAYMENT','REPORT'].map((service) => {
        const broken = last?.brokenServices.includes(service)
        const direct = architecture === 'shared' || service === 'ORDER'
        return <div key={service} className={broken ? 'broken' : last ? 'safe' : ''}><small>SERVICE</small><strong>{service}</strong><span>{!last ? (direct ? 'schema consumer' : 'schema isolated') : broken ? 'QUERY BROKEN' : 'RUNNING'}</span></div>
      })}
    </div>
    <div className="resource-schema-diff">
      <div><small>BEFORE</small><code>{last ? last.schemaBefore.join(' · ') : 'customer_id · total'}</code></div>
      <i>→</i>
      <div><small>AFTER</small><code>{last ? last.schemaAfter.join(' · ') : strategy === 'breaking' ? 'client_id · total' : 'customer_id · client_id · total'}</code></div>
      <div className={last?.blastRadius ? 'danger' : 'safe'}><small>BLAST RADIUS</small><strong>{last ? `${last.blastRadius}/3` : '—'}</strong><span>{last ? `${last.directConsumers.length} direct consumer` : 'migration bekleniyor'}</span></div>
    </div>
    <div className="resource-trace"><small>MIGRATION TRACE</small>{resource.events.length
      ? <ol aria-live="polite">{resource.events.map((event) => <li key={event.id} className={`resource-event-${event.tone}`}><b>{String(event.id).padStart(2, '0')}</b><span>{event.message}</span></li>)}</ol>
      : <p>Önce Shared DB + Breaking rename çalıştır. Sonra DB per service ve Expand / contract ile farkı karşılaştır.</p>}</div>
  </ArcadeFrame>
}

function DeployGame({ lesson, spec }) {
  const [deployment, setDeployment] = useState(createIndependentDeploymentState)
  const [change, setChange] = useState('additive')
  const consumerStatus = deployment.consumers.map((consumer) => ({
    ...consumer,
    compatible: deployment.providerFields.includes(consumer.amountField),
  }))
  const broken = consumerStatus.filter((consumer) => !consumer.compatible)
  const apply = (fn) => setDeployment((state) => fn(state))
  const deploy = () => apply((state) => deployPaymentProvider(state, { change }))
  const footer = deployment.last
    ? broken.length
      ? `Provider çalışıyor ama ${broken.map((consumer) => consumer.id).join(', ')} eski contract yüzünden kırık. Bu rollout bağımsız deploy değildir.`
      : deployment.consumerRedeploys
        ? `Sistem yeniden uyumlu; fakat ${deployment.consumerRedeploys} consumer redeploy gerekti. İlk rollout bağımsız değildi.`
        : `Payment v${deployment.paymentVersion} mevcut consumer’lar değişmeden çalışıyor. Bu gerçek bağımsız deploy kanıtıdır.`
    : 'Provider tek başına deploy edilirken eski consumer contract’larının çalışmaya devam etmesi gerekir. Ayrı repo tek başına bağımsız deploy kanıtı değildir.'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-deploy" footer={footer}>
    <div className="deployment-change-picker">
      <button className={change === 'additive' ? 'active' : ''} onClick={() => setChange('additive')}><strong>Additive</strong><span>status ekle</span></button>
      <button className={change === 'transitional' ? 'active' : ''} onClick={() => setChange('transitional')}><strong>Transition</strong><span>amount + totalAmount</span></button>
      <button className={change === 'breaking' ? 'danger active' : ''} onClick={() => setChange('breaking')}><strong>Breaking</strong><span>amount → totalAmount</span></button>
    </div>
    <div className="deployment-actions">
      <button className="sim-action" onClick={deploy}>Payment v{deployment.paymentVersion + 1} deploy et</button>
      <button onClick={() => apply(runDeploymentContractTest)}>Consumer contract test çalıştır</button>
      <button onClick={() => setDeployment(createIndependentDeploymentState())}>Sıfırla ↺</button>
    </div>
    <div className="deployment-contract">
      <div><small>PAYMENT PROVIDER</small><strong>v{deployment.paymentVersion}</strong><code>{deployment.providerFields.join(' · ')}</code></div>
      <i>→</i>
      <div><small>RESPONSE CONTRACT</small><strong>{deployment.providerFields.includes('amount') ? 'amount mevcut' : 'amount KALDIRILDI'}</strong><span>{deployment.providerFields.includes('totalAmount') ? 'totalAmount mevcut' : 'totalAmount yok'}</span></div>
    </div>
    <div className="deployment-consumers">
      {consumerStatus.map((consumer) => <div key={consumer.id} className={consumer.compatible ? 'compatible' : 'broken'}>
        <div><small>CONSUMER</small><strong>{consumer.id} v{consumer.version}</strong></div>
        <code>expects: {consumer.amountField}</code>
        <span>{consumer.compatible ? 'CONTRACT PASS' : `MISSING ${consumer.amountField}`}</span>
        <button disabled={!deployment.providerFields.includes('totalAmount') || consumer.amountField === 'totalAmount'} onClick={() => apply((state) => redeployConsumer(state, consumer.id))}>Consumer’ı yeni contract’a deploy et</button>
      </div>)}
    </div>
    <div className="deployment-verdict">
      <div className={broken.length ? 'fail' : 'ok'}><small>ŞU ANKİ DURUM</small><strong>{broken.length ? `${broken.length} BROKEN` : 'ALL COMPATIBLE'}</strong><span>{deployment.deploys} provider deploy · {deployment.consumerRedeploys} consumer redeploy</span></div>
      <div className={!broken.length && deployment.consumerRedeploys === 0 ? 'ok' : 'warn'}><small>INDEPENDENT DEPLOY CHECK</small><strong>{!broken.length && deployment.consumerRedeploys === 0 ? 'PASS' : 'NOT PROVEN'}</strong><p>Provider değişikliği eski consumer’ları redeploy ettirmeden çalışıyorsa release gerçekten bağımsızdır.</p></div>
    </div>
    <div className="deployment-trace"><small>DEPLOY / CONTRACT TRACE</small>{deployment.events.length
      ? <ol aria-live="polite">{deployment.events.map((event) => <li key={event.id} className={`deployment-event-${event.tone}`}><b>{String(event.id).padStart(2, '0')}</b><span>{event.message}</span></li>)}</ol>
      : <p>Önce Additive deploy yap. Sonra Breaking rename ile eski consumer’ların neden kırıldığını gör; Transition stratejisini karşılaştır.</p>}</div>
  </ArcadeFrame>
}

function PrinciplesGame({ lesson, spec }) {
  const [ownership, setOwnership] = useState('dedicated')
  const [cohesion, setCohesion] = useState('focused')
  const [contract, setContract] = useState('compatible')
  const [observability, setObservability] = useState('full')
  const result = evaluateMicroservicePrinciples({ ownership, cohesion, contract, observability })
  const footer = `${result.verdict}. Bu bir mimari yüzde değil; her kararın deployment autonomy, change isolation ve incident diagnosis üzerinde somut etkisi var.`
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-principles" footer={footer}>
    <div className="principle-decisions">
      <div><small>OWNERSHIP</small><button className={ownership === 'dedicated' ? 'active' : 'danger'} onClick={() => setOwnership((value) => value === 'dedicated' ? 'shared' : 'dedicated')}>{ownership === 'dedicated' ? 'Dedicated team + data' : 'Shared ownership'}</button></div>
      <div><small>COHESION</small><button className={cohesion === 'focused' ? 'active' : 'danger'} onClick={() => setCohesion((value) => value === 'focused' ? 'mixed' : 'focused')}>{cohesion === 'focused' ? 'Single capability' : 'Mixed responsibilities'}</button></div>
      <div><small>CONTRACT</small><button className={contract === 'compatible' ? 'active' : 'danger'} onClick={() => setContract((value) => value === 'compatible' ? 'breaking' : 'compatible')}>{contract === 'compatible' ? 'Backward compatible' : 'Breaking change'}</button></div>
      <div><small>OBSERVABILITY</small><button className={observability === 'full' ? 'active' : 'danger'} onClick={() => setObservability((value) => value === 'full' ? 'blind' : 'full')}>{observability === 'full' ? 'Trace + metrics + logs' : 'Logs only / blind hops'}</button></div>
    </div>
    <div className="principle-findings">
      {result.findings.map((finding) => <div key={finding.id} className={finding.status === 'PASS' ? 'pass' : 'risk'}>
        <b>{finding.status === 'PASS' ? '✓' : '!'}</b>
        <strong>{finding.id}</strong>
        <small>{finding.status}</small>
        <span>{finding.evidence}</span>
      </div>)}
    </div>
    <div className="principle-effects">
      <div className={result.deploymentAutonomy ? 'ok' : 'fail'}><small>DEPLOYMENT AUTONOMY</small><strong>{result.deploymentAutonomy ? 'PROVEN' : 'COUPLED'}</strong><span>Ownership + compatible contract gerekir.</span></div>
      <div className={result.changeIsolation ? 'ok' : 'fail'}><small>CHANGE ISOLATION</small><strong>{result.changeIsolation ? 'CONTAINED' : 'LEAKING'}</strong><span>Ownership + cohesion servis sınırını korur.</span></div>
      <div className={result.diagnosable ? 'ok' : 'fail'}><small>INCIDENT DIAGNOSIS</small><strong>{result.diagnosable ? 'TRACEABLE' : 'BLIND'}</strong><span>Dağıtık sistemde hata kanıtı için telemetry gerekir.</span></div>
    </div>
    <div className={`principle-verdict ${result.riskCount ? 'warn' : 'ok'}`}>
      <div><small>DESIGN REVIEW</small><strong>{result.verdict}</strong><span>{result.riskCount}/4 risk sinyali</span></div>
      <p>“Microservice” etiketi tasarımı sağlıklı yapmaz. Servis sınırı ancak bağımsız değişim, deploy ve operasyon kanıtıyla anlamlıdır.</p>
    </div>
  </ArcadeFrame>
}

function ContextGame({ lesson, spec }) {
  const [term, setTerm] = useState('Customer')
  const [languageContext, setLanguageContext] = useState('ORDER')
  const [activeCase, setActiveCase] = useState('money')
  const [placements, setPlacements] = useState({})
  const active = DDD_OWNERSHIP_CASES.find((item) => item.id === activeCase)
  const placement = placements[activeCase] ?? null
  const result = placement ? evaluateContextPlacement(activeCase, placement) : null
  const summary = summarizeContextPlacements(placements)
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-context" footer={summary.complete
    ? `${summary.correct}/3 boundary fit · ${summary.leaks} context leak. Bounded context sadece klasörleme değil; aynı kelimenin anlam ve invariant sınırıdır.`
    : `Önce aynı terimin context’e göre nasıl anlam değiştirdiğini incele; sonra ownership vakalarını yerleştir. ${summary.placed}/3 vaka değerlendirildi.`}>
    <div className="ddd-language-lab">
      <div className="ddd-term-picker"><small>SAME WORD · DIFFERENT MODEL</small>{['Customer','Status'].map((candidate)=><button key={candidate} className={term===candidate?'active':''} onClick={()=>setTerm(candidate)}>{candidate}</button>)}</div>
      <div className="ddd-context-meanings">{DDD_CONTEXTS.map((context)=><button key={context} className={languageContext===context?'active':''} onClick={()=>setLanguageContext(context)}><small>{context}</small><strong>{term}</strong><span>{getContextMeaning(term,context)}</span></button>)}</div>
      <motion.div key={`${term}-${languageContext}`} className="ddd-language-verdict" initial={{opacity:.45,y:5}} animate={{opacity:1,y:0}}><small>UBIQUITOUS LANGUAGE</small><strong>{languageContext} · {term}</strong><p>{getContextMeaning(term,languageContext)}</p><span>Aynı isim ortak class kullanmak zorunda değildir; anlam context sınırında değişebilir.</span></motion.div>
    </div>
    <div className="ddd-boundary-lab">
      <div className="ddd-case-list"><small>OWNERSHIP CHALLENGE</small>{DDD_OWNERSHIP_CASES.map((item)=><button key={item.id} className={`${activeCase===item.id?'active':''} ${placements[item.id] ? (evaluateContextPlacement(item.id,placements[item.id]).match?'context-ok':'context-leak') : ''}`} onClick={()=>setActiveCase(item.id)}><strong>{item.label}</strong><span>{placements[item.id]??'unplaced'}</span></button>)}</div>
      <div className="ddd-placement"><small>{active.label} hangi modelin dili?</small><p>{active.reason}</p><div>{DDD_CONTEXTS.map((context)=><button key={context} className={placement===context?'active':''} onClick={()=>setPlacements((current)=>({...current,[activeCase]:context}))}>{context}</button>)}</div></div>
      <motion.div key={`${activeCase}-${placement}`} className={`ddd-placement-result ${result ? (result.match?'ok':'leak') : ''}`} initial={{opacity:.45,y:5}} animate={{opacity:1,y:0}}><small>BOUNDARY CHECK</small><strong>{result?.verdict ?? 'WAITING'}</strong><span>{result?.explanation ?? 'Bir bounded context seç; model ownership ve language leak burada değerlendirilsin.'}</span></motion.div>
    </div>
  </ArcadeFrame>
}

function ResponsibilityGame({ lesson,spec }) {
  const [i,setI]=useState(0)
  const [answer,setAnswer]=useState(null)
  const current=DDD_RESPONSIBILITY_CASES[i]
  const result=answer?evaluateDddResponsibility(current.id,answer):null
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-responsibility" footer={result ? `${result.verdict}: ${result.consequence}` : 'Davranışı seç, katmanına yerleştir; yanlış seçimde hangi coupling veya model leakage oluştuğunu izle.'}>
    <div className="responsibility-case"><small>BEHAVIOR {i+1}/{DDD_RESPONSIBILITY_CASES.length}</small><strong>{current.title}</strong><button onClick={()=>{setI((i+1)%DDD_RESPONSIBILITY_CASES.length);setAnswer(null)}}>başka davranış ↻</button></div>
    <div className="responsibility-dependencies"><small>TOUCHES</small>{current.dependencies.map((dependency)=><span key={dependency}>{dependency}</span>)}</div>
    <div className="responsibility-buckets">{['APPLICATION','DOMAIN','ACL'].map(x=><button key={x} className={`${answer===x?'active':''} ${answer&&x===current.owner?'expected':''}`} onClick={()=>setAnswer(x)}><small>{x==='APPLICATION'?'ORCHESTRATE':x==='DOMAIN'?'BUSINESS RULE':'TRANSLATE'}</small><strong>{x}</strong></button>)}</div>
    <div className="responsibility-map">
      <div><small>HTTP / MESSAGE</small><strong>ADAPTER</strong></div><i>→</i>
      <div className={answer==='APPLICATION'?'lit':''}><small>USE CASE</small><strong>APPLICATION</strong></div><i>→</i>
      <div className={answer==='DOMAIN'?'lit':''}><small>MODEL + RULE</small><strong>DOMAIN</strong></div>
      <div className={answer==='ACL'?'lit side':''}><small>EXTERNAL MODEL</small><strong>ACL</strong></div>
    </div>
    {result&&<motion.div key={`${i}-${answer}`} className={`responsibility-result ${result.match?'ok':'warn'}`} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}><strong>{result.verdict}</strong><span>{result.consequence}</span><code>owner={result.owner} · selected={answer}</code></motion.div>}
  </ArcadeFrame>
}

function DesignerGame({ lesson,spec }) {
  const [comm,setComm]=useState('sync')
  const [data,setData]=useState('owned')
  const [failure,setFailure]=useState('timeout')
  const [paymentUp,setPaymentUp]=useState(true)
  const result=evaluateSystemDesign({communication:comm,dataOwnership:data,recovery:failure,paymentUp})
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-designer" footer={`${result.verdict}. Bu kombinasyon için client=${result.clientStatus}, order=${result.orderState}. Tek “en iyi mimari” yok; requirement hangi trade-off’un kabul edilebilir olduğunu belirler.`}>
    <div className="design-console"><div><small>COMMUNICATION</small><button className={comm==='sync'?'active':''} onClick={()=>setComm('sync')}>HTTP sync</button><button className={comm==='async'?'active':''} onClick={()=>setComm('async')}>Event async</button></div><div><small>DATA OWNERSHIP</small><button className={data==='owned'?'active':''} onClick={()=>setData('owned')}>DB per service</button><button className={data==='shared'?'danger active':''} onClick={()=>setData('shared')}>Shared DB</button></div><div><small>RECOVERY</small><button className={failure==='timeout'?'active':''} onClick={()=>setFailure('timeout')}>Timeout / CB</button><button className={failure==='saga'?'active':''} onClick={()=>setFailure('saga')}>Saga compensate</button></div></div>
    <div className="design-scenario"><div><small>FAILURE INJECTION</small><strong>PAYMENT SERVICE</strong><span>{paymentUp?'UP · normal traffic':'DOWN · outage active'}</span></div><button className={paymentUp?'':'danger active'} onClick={()=>setPaymentUp((value)=>!value)}>{paymentUp?'Payment’i düşür':'Payment’i ayağa kaldır'}</button></div>
    <div className="design-runtime">
      <div className="design-request"><small>CLIENT</small><strong>POST /orders</strong><span>{result.clientLatencyMs}ms wait</span></div><i>→</i>
      <div className="design-order"><small>ORDER</small><strong>{result.orderState}</strong><span>{comm==='sync'?'Payment cevabını bekler':'Event publish eder'}</span></div><i className={comm}>→</i>
      <div className={paymentUp?'design-payment':'design-payment down'}><small>PAYMENT</small><strong>{result.paymentState}</strong><span>{data==='shared'?'shared schema':'owned persistence'}</span></div>
      <div className={`design-client-response ${result.clientStatus<300?'ok':'fail'}`}><small>CLIENT RESPONSE</small><strong>{result.clientStatus}</strong><span>{result.verdict}</span></div>
    </div>
    <div className="design-findings">{result.findings.map((finding)=><div key={finding.id} className={finding.tone}><small>{finding.id}</small><strong>{finding.value}</strong><span>{finding.detail}</span></div>)}</div>
    <div className="design-evidence"><div className={result.runtimeCoupled?'risk':'ok'}><small>RUNTIME COUPLING</small><strong>{result.runtimeCoupled?'HIGHER':'LOWER'}</strong></div><div className={result.deploymentCoupled?'risk':'ok'}><small>DEPLOY COUPLING</small><strong>{result.deploymentCoupled?'SCHEMA-BOUND':'ISOLATED'}</strong></div><div className={result.outageContained?'ok':'risk'}><small>PAYMENT OUTAGE</small><strong>{result.outageContained?'CONTAINED':'PROPAGATES'}</strong></div></div>
  </ArcadeFrame>
}

function FeedbackGame({ lesson,spec }) {
  const [feedback,setFeedback]=useState(createDevOpsFeedbackState)
  const activeStage=DEVOPS_FEEDBACK_STAGES[feedback.stageIndex]
  const evidenceFor=(stage)=>feedback.evidences.find((item)=>item.stage===stage)
  const apply=(fn)=>setFeedback((state)=>fn(state))
  const footer=feedback.blockedReason
    ? feedback.blockedReason
    : feedback.decision
      ? `Son cycle kararı: ${feedback.decision}. Production kanıtı bir sonraki code değişikliğine geri döndü.`
      : `Cycle ${feedback.cycle} · ${feedback.elapsedMinutes} dk feedback age · aktif aşama ${activeStage}.`
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-feedback" footer={footer}>
    <div className="feedback-controls">
      <button className={feedback.regression?'danger active':''} disabled={feedback.stageIndex>0} onClick={()=>apply((state)=>setFeedbackRegression(state,!state.regression))}>Change: {feedback.regression?'LATENT REGRESSION':'HEALTHY'}</button>
      <button className={feedback.telemetryEnabled?'active':'danger'} onClick={()=>apply((state)=>setFeedbackTelemetry(state,!state.telemetryEnabled))}>Telemetry: {feedback.telemetryEnabled?'ON':'OFF'}</button>
      <button className="sim-action" onClick={()=>apply(advanceDevOpsFeedback)}>{activeStage==='LEARN'?'Kararı üret + yeni cycle':'Aşamayı çalıştır'} →</button>
      <div><small>FEEDBACK AGE</small><strong>{feedback.elapsedMinutes} dk</strong><span>cycle #{feedback.cycle}</span></div>
    </div>
    <div className="feedback-track">{DEVOPS_FEEDBACK_STAGES.map((stage,i)=>{const evidence=evidenceFor(stage);const active=i===feedback.stageIndex;return <div key={stage} className={`${active?'active':''} ${evidence?'done':''} ${evidence?.tone??''}`}><span>{i+1}</span><strong>{stage}</strong><small>{evidence?.label??(active?'NEXT':'waiting')}</small></div>})}</div>
    <div className="feedback-production-proof">
      <div className={feedback.telemetryEnabled?'ok':'blind'}><small>PRODUCTION SIGNAL</small><strong>{!feedback.telemetryEnabled?'NO TELEMETRY':feedback.regression?'error 8.4% · p95 940ms':'error 0.6% · p95 180ms'}</strong><span>{feedback.stageIndex<3&&feedback.evidences.every((item)=>item.stage!=='OBSERVE')?'deploy sonrası ölçülecek':feedback.telemetryEnabled?'logs + metrics + traces':'decision evidence unavailable'}</span></div>
      <div className={feedback.decision?'closed-loop':''}><small>LEARNING OUTPUT</small><strong>{feedback.decision??'WAITING FOR EVIDENCE'}</strong><span>{feedback.decision?'Bu karar yeni CODE cycle’ına geri beslendi.':'Observe kanıtı olmadan learning tamamlanmaz.'}</span></div>
    </div>
    <div className="feedback-trace"><small>DEV ↔ OPS TRACE</small>{feedback.events.length?<ol>{feedback.events.map((entry)=><li key={entry.id} className={`feedback-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Change’i seç ve CODE → BUILD → DEPLOY → OBSERVE → LEARN döngüsünü çalıştır. Sonraki turda telemetry’yi kapatıp feedback’in neden kırıldığını gör.</p>}</div>
  </ArcadeFrame>
}

function PipelineGame({ lesson,spec }) {
  const [fail,setFail]=useState(false)
  const [run,setRun]=useState(17)
  const [commit,setCommit]=useState('a91c4e2')
  const artifact=!fail?`order:${commit}`:null
  const trigger=()=>{setRun(v=>v+1);setCommit((v)=>v==='a91c4e2'?'b72fd10':'a91c4e2')}
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-pipeline" footer={fail?`Run #${run}: TEST gate fail → package yok. CI kırık commit ${commit} için release kanıtı üretmedi.`:`Run #${run}: commit ${commit} doğrulandı → immutable artifact ${artifact} üretildi.`}>
    <div className="arcade-toolbar"><button className="sim-action" onClick={trigger}>Yeni commit push et</button><button className={!fail?'active':''} onClick={()=>setFail(false)}>Tests green</button><button className={fail?'danger active':''} onClick={()=>setFail(true)}>Test fail</button><strong>run #{run} · {commit}</strong></div>
    <div className="pipeline-run">{spec.steps.map((s,i)=>{const blocked=fail&&i>2;const failed=fail&&i===2;return <motion.div key={`${s}-${fail}-${run}`} className={blocked?'blocked':failed?'failed':'passed'} initial={{opacity:.35,y:6}} animate={{opacity:blocked?.25:1,y:0}} transition={{delay:i*.04}}><span>{i+1}</span><strong>{s}</strong><small>{failed?'FAIL':blocked?'BLOCKED':'OK'}</small><code>{i===0?commit:i===1?'classes/':i===2?(fail?'1 failed':'58 passed'):artifact??'—'}</code></motion.div>})}</div>
    <div className={`pipeline-artifact ${artifact?'ready':'missing'}`}><small>PIPELINE OUTPUT</small><strong>{artifact??'NO ARTIFACT'}</strong><span>{artifact?'Bu exact artifact sonraki release gate’e gider.':'Build kanıtı tamamlanmadığı için deploy girdisi oluşmadı.'}</span></div>
  </ArcadeFrame>
}

function ReleaseGame({ lesson,spec }) {
  const [release,setRelease]=useState(createReleaseGateState)
  const apply=(fn)=>setRelease((state)=>fn(state))
  const inProd=release.production.checksum===release.artifact.checksum
  const footer=release.status==='DEPLOYED'
    ? `${release.mode==='delivery'?'Continuous Delivery':'Continuous Deployment'}: verified artifact ${release.artifact.checksum} production'a geçti; checksum değişmedi.`
    : release.status==='POLICY_BLOCKED'
      ? 'Production policy RED. Manual approval bile kalite/policy gate’ini bypass etmiyor.'
      : release.mode==='delivery'
        ? 'Continuous Delivery: artifact production-ready; production promotion insan approval gate’ine bağlı.'
        : 'Continuous Deployment: green production policy aynı verified artifact’i otomatik promote eder.'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-release" footer={footer}>
    <div className="release-controls">
      <button className={release.mode==='delivery'?'active':''} onClick={()=>apply((state)=>setReleaseMode(state,'delivery'))}>Continuous Delivery</button>
      <button className={release.mode==='deployment'?'active':''} onClick={()=>apply((state)=>setReleaseMode(state,'deployment'))}>Continuous Deployment</button>
      <button className={release.policyPass?'active':'danger active'} onClick={()=>apply((state)=>setReleasePolicy(state,!state.policyPass))}>Prod policy: {release.policyPass?'GREEN':'RED'}</button>
      <button className="sim-action" onClick={()=>apply(evaluateReleaseGate)}>Production gate değerlendir</button>
      {release.mode==='delivery'&&<button disabled={!release.policyPass||inProd} onClick={()=>apply(approveDeliveryRelease)}>Manual approve + promote</button>}
    </div>
    <div className="release-track">
      <div className="verified"><small>VERIFIED ARTIFACT</small><strong>order:{release.artifact.version}</strong><code>{release.artifact.checksum}</code><span>build/test evidence complete</span></div><i>›</i>
      <div className={`${release.status==='POLICY_BLOCKED'?'blocked':release.status==='WAITING_APPROVAL'?'waiting':release.status==='DEPLOYED'?'open':''}`}><small>PRODUCTION GATE</small><strong>{release.status}</strong><code>{release.mode==='delivery'?'manual risk approval':'automated policy'}</code><span>{release.policyPass?'quality policy green':'quality policy red'}</span></div><i>›</i>
      <div className={inProd?'live':'dim'}><small>PRODUCTION</small><strong>v{release.production.version}</strong><code>{release.production.checksum}</code><span>{inProd?'same verified bytes':'previous release stays live'}</span></div>
    </div>
    <div className="release-evidence"><div><small>ARTIFACT</small><strong>{release.artifact.checksum}</strong><span>Delivery/Deployment seçimi artifact’i değiştirmez.</span></div><div><small>GATE OWNERSHIP</small><strong>{release.mode==='delivery'?'HUMAN + POLICY':'AUTOMATED POLICY'}</strong><span>Fark production promotion kararındadır.</span></div><div className={release.policyPass?'ok':'risk'}><small>POLICY</small><strong>{release.policyPass?'PASS':'BLOCK'}</strong><span>{release.policyPass?'promotion eligible':'no production promotion'}</span></div></div>
    <div className="release-trace"><small>PROMOTION TRACE</small>{release.events.length?<ol>{release.events.map((entry)=><li key={entry.id} className={`release-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Önce Delivery modunda gate’i değerlendir; approval beklediğini gör. Sonra Deployment modunda green policy ile aynı artifact’in otomatik promote edildiğini karşılaştır.</p>}</div>
  </ArcadeFrame>
}

function ArtifactGame({ lesson,spec }) {
  const [maven,setMaven]=useState(createMavenArtifactState)
  const apply=(fn)=>setMaven((state)=>fn(state))
  const phaseStatus=(phase)=>{
    if(phase==='resolve') return maven.dependenciesResolved?'DONE':'RUN'
    if(phase==='compile') return maven.compiled?'DONE':'RUN'
    if(phase==='test') return maven.tests
    return maven.artifact?'DONE':'RUN'
  }
  const phaseTone=(phase)=>phase==='test'&&maven.tests==='FAILED'?'failed':phaseStatus(phase)==='DONE'||phaseStatus(phase)==='PASSED'?'done':''
  const prodCurrent=maven.repositoryArtifact&&maven.productionArtifact.checksum===maven.repositoryArtifact.checksum
  const footer=maven.blockedReason
    ?? (maven.artifact
      ? `${maven.artifact.name} üretildi · ${maven.artifact.checksum}. Artifact repository'ye yayınlayıp exact checksum'u staging → production taşı.`
      : `Source ${maven.sourceCommit}. Maven build kanıtı resolve → compile → test → package sırasıyla oluşur.`)
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-artifact" footer={footer}>
    <div className="maven-controls">
      <button onClick={()=>apply(changeMavenSource)}>Yeni source commit</button>
      <button className={maven.testShouldFail?'danger active':'active'} onClick={()=>apply((state)=>setMavenTestFailure(state,!state.testShouldFail))}>Test fixture: {maven.testShouldFail?'FAILING':'GREEN'}</button>
      <div><small>SOURCE</small><strong>{maven.sourceCommit}</strong><span>target version 1.4.{maven.revision}</span></div>
    </div>
    <div className="maven-lifecycle">{MAVEN_PHASES.map((phase,i)=>{
      const status=phaseStatus(phase)
      return <button key={phase} className={`${phaseTone(phase)} ${status==='RUN'?'active':''}`} onClick={()=>apply((state)=>runMavenPhase(state,phase))}><span>{i+1}</span><strong>{phase.toUpperCase()}</strong><small>{status}</small><code>{maven.evidence[phase]??(phase==='resolve'?'pom.xml → graph':phase==='compile'?'src → classes':phase==='test'?'Surefire gate':'classes → JAR')}</code></button>
    })}</div>
    <div className="maven-promotion-actions"><button onClick={()=>apply(publishMavenArtifact)}>Artifact repository'ye publish et</button><button onClick={()=>apply((state)=>promoteMavenArtifact(state,'staging'))}>STAGING'e promote et</button><button className="sim-action" onClick={()=>apply((state)=>promoteMavenArtifact(state,'production'))}>PRODUCTION'a promote et</button></div>
    <div className="maven-artifact-lane">
      <div className="source"><small>BUILD WORKSPACE</small><strong>{maven.artifact?.name??'artifact yok'}</strong><code>{maven.artifact?.checksum??maven.sourceCommit}</code><span>{maven.tests==='FAILED'?'test gate kırmızı':maven.artifact?'package complete':'build devam ediyor'}</span></div><i>›</i>
      <div className={maven.repositoryArtifact?'ready':''}><small>ARTIFACT REPOSITORY</small><strong>{maven.repositoryArtifact?.name??'empty'}</strong><code>{maven.repositoryArtifact?.checksum??'publish bekliyor'}</code><span>versioned immutable build output</span></div><i>›</i>
      <div className={maven.stagingArtifact?'ready':''}><small>STAGING</small><strong>{maven.stagingArtifact?.version??'—'}</strong><code>{maven.stagingArtifact?.checksum??'not promoted'}</code><span>{maven.stagingArtifact?'exact repository bytes':'validation bekliyor'}</span></div><i>›</i>
      <div className={prodCurrent?'live':'previous'}><small>PRODUCTION</small><strong>v{maven.productionArtifact.version}</strong><code>{maven.productionArtifact.checksum}</code><span>{prodCurrent?'same verified checksum':'önceki release çalışıyor'}</span></div>
    </div>
    <div className="maven-trace"><small>MAVEN / PROMOTION TRACE</small>{maven.events.length?<ol>{maven.events.map((entry)=><li key={entry.id} className={`maven-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Önce lifecycle'ı çalıştır. Sonra test fixture'ı kırıp package gate'in neden durduğunu karşılaştır.</p>}</div>
  </ArcadeFrame>
}

function ContainerGame({ lesson,spec }) {
  const [docker,setDocker]=useState(createDockerContainerState)
  const apply=(fn)=>setDocker((state)=>fn(state))
  const runtimeMatchesRegistry=docker.runtimeImage&&docker.registryImage&&docker.runtimeImage.digest===docker.registryImage.digest
  const footer=docker.blockedReason
    ?? (docker.runtimeImage
      ? `Runtime host ${docker.runtimeImage.digest} kullanıyor; ${docker.containers.length} container bu image snapshot’ından çalışıyor. ENV/secret runtime’da dışarıdan geliyor.`
      : 'Build → push → pull zincirini tamamla. Tag insan dostu isimdir; immutable kimliği digest kanıtlar.')
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-container" footer={footer}>
    <div className="docker-controls">
      <button onClick={()=>apply(changeDockerSource)}>Source değiştir · r{docker.sourceRevision}</button>
      <button className={docker.runtimeEnv==='staging'?'active':''} onClick={()=>apply((state)=>setDockerRuntimeEnv(state,'staging'))}>ENV=staging</button>
      <button className={docker.runtimeEnv==='prod'?'active':''} onClick={()=>apply((state)=>setDockerRuntimeEnv(state,'prod'))}>ENV=prod</button>
      <button className="sim-action" onClick={()=>apply(runDockerContainer)}>docker run +</button>
    </div>
    <div className="docker-supply-chain">
      <div className="dockerfile"><small>01 · DOCKERFILE / BUILDER</small>{['FROM eclipse-temurin:21-jre','COPY app.jar /app.jar','ENTRYPOINT java -jar /app.jar'].map((x,i)=><code key={x}><b>L{i+1}</b>{x}</code>)}<button onClick={()=>apply(buildDockerImage)}>docker build</button><strong>{docker.builderImage?.tag??'image yok'}</strong><span>{docker.builderImage?.digest??`source r${docker.sourceRevision}`}</span></div><i>›</i>
      <motion.div className={`docker-node ${docker.registryImage?'ready':''}`} animate={{scale:docker.registryImage?1.02:1}}><small>02 · REGISTRY</small><strong>{docker.registryImage?.tag??'empty'}</strong><code>{docker.registryImage?.digest??'push bekliyor'}</code><button onClick={()=>apply(pushDockerImage)}>docker push</button><span>tag → digest mapping</span></motion.div><i>›</i>
      <motion.div className={`docker-node ${docker.runtimeImage?'ready':''}`} animate={{scale:docker.runtimeImage?1.02:1}}><small>03 · RUNTIME HOST</small><strong>{docker.runtimeImage?.tag??'not pulled'}</strong><code>{docker.runtimeImage?.digest??'registry pull bekliyor'}</code><button onClick={()=>apply(pullDockerImage)}>docker pull</button><span>{runtimeMatchesRegistry?'exact registry digest':'host cache snapshot'}</span></motion.div>
    </div>
    <div className="docker-runtime-config"><div><small>NORMAL CONFIG</small><strong>DB_URL</strong><code>{docker.runtimeEnv==='prod'?'jdbc:postgresql://prod-db/order':'jdbc:postgresql://staging-db/order'}</code></div><div><small>SECRET REF</small><strong>PAYMENT_TOKEN</strong><code>{docker.runtimeEnv==='prod'?'secret-manager/payment-token-prod':'secret-manager/payment-token-staging'}</code></div><div><small>IMAGE BYTES</small><strong>{docker.runtimeImage?.digest??'—'}</strong><span>ENV değişince digest değişmez</span></div></div>
    <div className="docker-container-grid">{[0,1,2].map((i)=>{const c=docker.containers[i];return <div key={i} className={c?'live':''}>{c?<><small>{c.id} · ENV={c.env}</small><strong>{c.imageTag}</strong><code>{c.imageDigest}</code><span>{c.dbUrl}</span><em>{c.secretRef}</em><button onClick={()=>apply((state)=>removeDockerContainer(state,c.id))}>container sil ×</button></>:<><small>CONTAINER SLOT {i+1}</small><strong>empty</strong><span>runtime image bekliyor</span></>}</div>})}</div>
    <div className="docker-proof"><div className={docker.builderImage?'ok':''}><small>BUILDER IMAGE</small><strong>{docker.builderImage?.digest??'—'}</strong><span>source r{docker.builderImage?.sourceRevision??docker.sourceRevision}</span></div><div className={docker.registryImage?'ok':''}><small>REGISTRY TAG</small><strong>{docker.registryImage?.tag??'—'}</strong><span>{docker.registryImage?.digest??'push yok'}</span></div><div className={docker.runtimeImage?'ok':''}><small>RUNTIME DIGEST</small><strong>{docker.runtimeImage?.digest??'—'}</strong><span>pull snapshot</span></div><div><small>RUNNING</small><strong>{docker.containers.length}</strong><span>container lifecycle bağımsız</span></div></div>
    <div className="docker-trace"><small>IMAGE / CONTAINER TRACE</small>{docker.events.length?<ol>{docker.events.map((entry)=><li key={entry.id} className={`docker-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>İlk image’ı build/push/pull et. Sonra iki farklı ENV ile container başlat; aynı digest’in farklı runtime config ile çalıştığını gör.</p>}</div>
  </ArcadeFrame>
}

function KubeGame({ lesson,spec }) {
  const [kube,setKube]=useState(createKubernetesControlLoopState)
  const apply=(fn)=>setKube((state)=>fn(state))
  const alive=kubernetesAlivePods(kube).length
  const readyPods=kubernetesReadyPods(kube)
  const ready=readyPods.length
  const totalRestarts=kube.pods.reduce((sum,pod)=>sum+pod.restarts,0)
  const footer=kube.blockedReason ?? `desired=${kube.desiredReplicas} · alive=${alive} · ready endpoints=${ready}. Deployment controller replica drift'i; kubelet liveness'i; Service ise readiness endpoint listesini yönetir.`
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-kube" footer={footer}>
    <div className="kube-control-grid"><button className="danger" onClick={()=>apply(deleteKubernetesPod)}>Pod öldür</button><button onClick={()=>apply(reconcileKubernetesDeployment)}>Deployment reconcile</button><button onClick={()=>apply(failKubernetesReadiness)}>Readiness boz</button><button onClick={()=>apply(restoreKubernetesReadiness)}>Readiness düzelt</button><button className="danger" onClick={()=>apply(failKubernetesLiveness)}>Liveness boz</button><button onClick={()=>apply(reconcileKubernetesKubelet)}>Kubelet restart</button><button className="sim-action" onClick={()=>apply(routeKubernetesServiceRequest)}>Service request ↻</button></div>
    <div className="kube-arcade">
      <div className={`desired-ring ${alive===kube.desiredReplicas?'stable':'drift'}`}><small>DEPLOYMENT CONTROLLER</small><strong>desired: {kube.desiredReplicas}</strong><span>alive {alive}/{kube.desiredReplicas}</span><em className="controller-event">{kube.controllerMessage}</em></div>
      <div className="pod-row">{kube.pods.map((pod)=><motion.div key={pod.slot} animate={{opacity:pod.alive?1:.28,scale:pod.alive?1:.92}} className={!pod.alive?'down':!pod.live?'liveness-fail':pod.ready?'ready':'not-ready'}><small>POD {pod.slot} · gen {pod.generation}</small><strong>{!pod.alive?'DOWN':!pod.live?'LIVENESS FAIL':pod.ready?'READY':'NOT READY'}</strong><span>{!pod.alive?'ReplicaSet replacement bekliyor':!pod.live?'kubelet restart bekliyor':pod.ready?`Service endpoint · restarts ${pod.restarts}`:'process alive · endpoint dışı'}</span>{kube.lastRequest?.targetSlot===pod.slot&&<motion.b key={kube.lastRequest.number} initial={{scale:.5,opacity:0}} animate={{scale:1,opacity:1}}>REQ #{kube.lastRequest.number}</motion.b>}</motion.div>)}</div>
      <div className={ready?'service-live':'service-down'}><small>SERVICE / ENDPOINTS</small><strong>{ready} ready</strong><span>{!kube.lastRequest?'request bekliyor':kube.lastRequest.status===200?`#${kube.lastRequest.number} → pod ${kube.lastRequest.targetSlot}`:`#${kube.lastRequest.number} → 503`}</span></div>
    </div>
    <div className="kube-evidence"><div className={alive===kube.desiredReplicas?'ok':'danger'}><small>REPLICA EVIDENCE</small><strong>{alive}/{kube.desiredReplicas}</strong><span>{alive===kube.desiredReplicas?'desired state stable':'Deployment drift var'}</span></div><div className={ready?'ok':'danger'}><small>SERVICE ENDPOINTS</small><strong>{ready}</strong><span>{readyPods.map((pod)=>`pod-${pod.slot}`).join(', ')||'none'}</span></div><div><small>KUBELET RESTARTS</small><strong>{totalRestarts}</strong><span>liveness failure container restart üretir</span></div><div className={kube.lastRequest?.status===503?'danger':kube.lastRequest?'ok':''}><small>LAST REQUEST</small><strong>{kube.lastRequest?kube.lastRequest.status:'—'}</strong><span>{kube.lastRequest?.targetSlot?`pod-${kube.lastRequest.targetSlot}`:'Service evidence yok'}</span></div></div>
    <div className="kube-trace"><small>CONTROL LOOP TRACE</small>{kube.events.length?<ol>{kube.events.map((entry)=><li key={entry.id} className={`kube-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Pod öldür → Service request → Deployment reconcile akışını dene. Sonra readiness ve liveness farkını ayrı ayrı gözle.</p>}</div>
  </ArcadeFrame>
}

function YamlGame({ lesson,spec }) {
  const [pipeline,setPipeline]=useState(createPipelineAsCodeState)
  const apply=(fn)=>setPipeline((state)=>fn(state))
  const yaml=PIPELINE_AS_CODE_STAGES.map((stage)=>`      - ${pipeline.draftStages[stage]?'run':'skip'}: ${stage}`).join('\n')
  const jobFor=(stage)=>pipeline.lastRun?.jobs.find((job)=>job.stage===stage)
  const footer=pipeline.lastRun
    ? `Run #${pipeline.lastRun.number} · workflow r${pipeline.lastRun.revision}: ${pipeline.lastRun.verdict}. ${pipeline.dirty?'Draft değişiklikleri bu run’a girmedi; önce commit gerekir.':'Run committed workflow tanımını kullandı.'}`
    : `Workflow r${pipeline.revision} committed. Draft değişikliği run davranışını ancak commit sonrası değiştirir.`
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-yaml" footer={footer}>
    <div className="pipeline-code-controls">
      <div><small>TRIGGER</small><button className={pipeline.trigger==='pull_request'?'active':''} onClick={()=>apply((state)=>setPipelineTrigger(state,'pull_request'))}>pull_request</button><button className={pipeline.trigger==='tag'?'active':''} onClick={()=>apply((state)=>setPipelineTrigger(state,'tag'))}>tag v1.4.2</button></div>
      <div><small>FAILURE INJECTION</small><button className={!pipeline.failureStage?'active':''} onClick={()=>apply((state)=>setPipelineFailure(state,null))}>none</button><button className={pipeline.failureStage==='test'?'danger active':''} onClick={()=>apply((state)=>setPipelineFailure(state,'test'))}>test fail</button><button className={pipeline.failureStage==='scan'?'danger active':''} onClick={()=>apply((state)=>setPipelineFailure(state,'scan'))}>scan fail</button></div>
      <div className={pipeline.dirty?'dirty':'clean'}><small>VERSION CONTROL</small><strong>workflow r{pipeline.revision}</strong><span>{pipeline.dirty?'UNCOMMITTED DIFF':'CLEAN'}</span><button disabled={!pipeline.dirty} onClick={()=>apply(commitPipelineDefinition)}>Workflow commit</button></div>
      <button className="sim-action" onClick={()=>apply(runPipelineDefinition)}>Committed workflow'u çalıştır →</button>
    </div>
    <div className="pipeline-code-workbench">
      <div className="pipeline-code-editor"><small>.github/workflows/ci.yml · draft</small><pre>{`on: ${pipeline.trigger}\njobs:\n  verify:\n${yaml}`}</pre></div>
      <div className="pipeline-code-diff"><small>DRAFT vs COMMITTED</small>{PIPELINE_AS_CODE_STAGES.map((stage)=>{const changed=pipeline.draftStages[stage]!==pipeline.committedStages[stage];return <button key={stage} className={`${pipeline.draftStages[stage]?'active':''} ${changed?'changed':''}`} onClick={()=>apply((state)=>togglePipelineDraftStage(state,stage))}><span>{changed?'Δ':pipeline.draftStages[stage]?'✓':'+'}</span><strong>{stage}</strong><small>{changed?'not committed':pipeline.committedStages[stage]?'tracked · ON':'tracked · OFF'}</small></button>})}</div>
    </div>
    <div className="pipeline-run-evidence">{PIPELINE_AS_CODE_STAGES.map((stage,i)=>{const job=jobFor(stage);const status=job?.status??'NOT RUN';return <div key={stage} className={`pipeline-job ${status.toLowerCase().replace('_','-')}`}><span>{i+1}</span><strong>{stage.toUpperCase()}</strong><small>{status}</small><code>{job?.detail??`committed: ${pipeline.committedStages[stage]?'enabled':'disabled'}`}</code></div>})}</div>
    <div className="pipeline-code-proof"><div><small>RUN DEFINITION</small><strong>r{pipeline.lastRun?.revision??pipeline.revision}</strong><span>{pipeline.dirty?'draft ≠ executed workflow':'draft = committed workflow'}</span></div><div className={pipeline.lastRun?.artifact?'ok':''}><small>ARTIFACT</small><strong>{pipeline.lastRun?.artifact?.checksum??'NO ARTIFACT EVIDENCE'}</strong><span>package job PASS olursa oluşur</span></div><div className={pipeline.lastRun?.productionPromoted?'ok':''}><small>PRODUCTION</small><strong>{pipeline.lastRun?.productionPromoted?'PROMOTED':'NOT PROMOTED'}</strong><span>yalnız tag + required gates</span></div></div>
    <div className="pipeline-code-trace"><small>WORKFLOW HISTORY</small>{pipeline.events.length?<ol>{pipeline.events.map((entry)=><li key={entry.id} className={`pipeline-code-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Önce PR run çalıştır. Sonra draft'ta bir quality gate'i kapat; commit etmeden run ile commit sonrası run arasındaki farkı karşılaştır.</p>}</div>
  </ArcadeFrame>
}

function SecretGame({ lesson,spec }) {
  const [secret,setSecret]=useState(createSecretConfigState)
  const apply=(fn)=>setSecret((state)=>fn(state))
  const deployment=secret.deployments[secret.env]
  const leaks=secretLeakVersions(secret)
  const currentImage=deployment?.imageDigest??SAFE_SECRET_IMAGE.digest
  const footer=secret.blockedReason
    ?? (leaks.length
      ? `Leak history: secret v${leaks.join(', v')} artifact/build history içine girdi. Rotation credential'ı revoke eder; geçmiş artifact/log izini sihirli biçimde silmez.`
      : deployment?.credentialState==='REVOKED'
        ? `${secret.env.toUpperCase()} hâlâ revoked secret v${deployment.credentialVersion} kullanıyor. Yeni v${secret.secretVersion} için redeploy/restart gerekli.`
        : `Clean image ${SAFE_SECRET_IMAGE.digest}. Config ortamdan, secret ise seçilen delivery policy üzerinden gelir; access policy ayrı bir kontroldür.`)
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-secret" footer={footer}>
    <div className="secret-options">{[['plain','Image içine göm'],['masked','CI masked variable'],['runtime','Secret manager → runtime']].map(([id,label])=><button key={id} className={secret.mode===id?'active':''} onClick={()=>apply((state)=>setSecretDeliveryMode(state,id))}>{label}</button>)}</div>
    <div className="secret-control-grid">
      <div><small>ENVIRONMENT</small><button className={secret.env==='staging'?'active':''} onClick={()=>apply((state)=>setSecretEnvironment(state,'staging'))}>STAGING</button><button className={secret.env==='prod'?'active':''} onClick={()=>apply((state)=>setSecretEnvironment(state,'prod'))}>PROD</button></div>
      <div className={secret.accessAllowed?'allow':'deny'}><small>SECRET ACCESS POLICY</small><strong>{secret.accessAllowed?'ALLOW':'DENY'}</strong><button onClick={()=>apply((state)=>setSecretAccess(state,!state.accessAllowed))}>policy değiştir</button></div>
      <div><small>SECRET ROTATION</small><strong>PAYMENT_TOKEN v{secret.secretVersion}</strong><button onClick={()=>apply(rotateSecret)}>rotate + revoke</button></div>
      <button className="sim-action" onClick={()=>apply(deploySecretConfig)}>Deploy / restart →</button>
    </div>
    <div className="secret-flow">
      <div className={secret.mode==='plain'?'danger':''}><small>IMAGE</small><strong>{SAFE_SECRET_IMAGE.tag}</strong><code>{currentImage}</code><span>{secret.mode==='plain'?'secret artifact digest’ini kirletir':'secret-free immutable image'}</span></div><i>›</i>
      <div className={secret.mode==='runtime'?'ok':secret.mode==='masked'?'warn':'danger'}><small>SECRET DELIVERY</small><strong>{secret.mode==='runtime'?'WORKLOAD IDENTITY':secret.mode==='masked'?'CI PRINCIPAL':'BUILD ARG / LAYER'}</strong><code>{secret.mode==='runtime'?`secret-manager:v${secret.secretVersion}`:secret.mode==='masked'?'PAYMENT_TOKEN=********':`token_v${secret.secretVersion}_EXPOSED`}</code><span>{secret.mode==='runtime'?'runtime read':secret.mode==='masked'?'masked log, CI plaintext access':'persistent exposure evidence'}</span></div><i>›</i>
      <div className={deployment?.credentialState==='ACTIVE'?'ok':deployment?.credentialState==='REVOKED'?'danger':''}><small>{secret.env.toUpperCase()} WORKLOAD</small><strong>{deployment?`secret v${deployment.credentialVersion}`:'not deployed'}</strong><code>{deployment?.config.dbUrl??'DB_URL pending'}</code><span>{deployment?`${deployment.secretSource} · ${deployment.credentialState}`:'deploy bekliyor'}</span></div>
    </div>
    <div className="secret-deployments">{['staging','prod'].map((env)=>{const item=secret.deployments[env];return <div key={env} className={item?.credentialState==='ACTIVE'?'ok':item?.credentialState==='REVOKED'?'danger':''}><small>{env.toUpperCase()}</small><strong>{item?`v${item.credentialVersion} · ${item.credentialState}`:'NO DEPLOY'}</strong><code>{item?.imageDigest??SAFE_SECRET_IMAGE.digest}</code><span>{item?.secretSource??'secret source yok'}</span></div>})}<div className={leaks.length?'danger':'ok'}><small>LEAK HISTORY</small><strong>{leaks.length?`v${leaks.join(', v')}`:'CLEAN'}</strong><span>{leaks.length?'rotation geçmiş izi silmez':'artifact history secret-free'}</span></div></div>
    <div className="secret-log-console"><small>PIPELINE / DEPLOY EVIDENCE</small>{secret.logs.length?<>{secret.logs.slice(-5).map((line,i)=><code key={`${i}-${line}`}>{line}</code>)}</>:<code>henüz deploy evidence yok</code>}</div>
    <div className="secret-trace"><small>SECRET LIFECYCLE TRACE</small>{secret.events.length?<ol>{secret.events.map((entry)=><li key={entry.id} className={`secret-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Runtime mode ile deploy et. Sonra rotate et ve eski workload'un revoked credential'da kaldığını gör; redeploy ile yeni version'a geçir.</p>}</div>
  </ArcadeFrame>
}

function RollbackGame({ lesson,spec }) {
  const [release,setRelease]=useState(createDeploymentRollbackState)
  const apply=(fn)=>setRelease((state)=>fn(state))
  const traffic=deploymentTraffic(release)
  const breach=release.errorRate>=ROLLBACK_ERROR_THRESHOLD
  const rolled=release.status==='ROLLED_BACK'
  const rollbackAllowed=breach&&release.dbCompatible&&!rolled
  const footer=release.blockedReason
    ?? (rolled
    ? 'Application rollback tamamlandı: trafik v1.4.1’e döndü. Telemetry ve root cause analizi devam eder.'
    : breach&&!release.dbCompatible
      ? 'Error threshold aşıldı fakat DB migration backward compatible değil. Binary application rollback tek başına güvenli kabul edilemez; migration/forward-fix planı gerekir.'
      : breach
        ? 'Error threshold aşıldı. Blast radius büyütme; doğrulanmış önceki sürüme rollback et.'
        : `${release.strategy} rollout sinyalleri threshold altında. Kontrollü olarak bir sonraki adıma ilerleyebilirsin.`)
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-rollback" footer={footer}>
    <div className="rollback-strategies">{[['canary','CANARY','Küçük trafik → ölç → büyüt'],['rolling','ROLLING','Instance’ları kademeli değiştir'],['bluegreen','BLUE/GREEN','İki ortam → trafik cutover']].map(([id,label,copy])=><button key={id} className={release.strategy===id?'active':''} onClick={()=>apply((state)=>setDeploymentStrategy(state,id))}><strong>{label}</strong><small>{copy}</small></button>)}</div>
    <div className="rollback-controls"><label>Error rate <input type="range" min="0" max="12" value={release.errorRate} onChange={e=>apply((state)=>setDeploymentErrorRate(state,Number(e.target.value)))}/><b>{release.errorRate}%</b></label><label className="db-compat-toggle"><span>DB migration</span><button className={release.dbCompatible?'active':'danger active'} onClick={()=>apply((state)=>setDeploymentDbCompatibility(state,!state.dbCompatible))}>{release.dbCompatible?'BACKWARD COMPATIBLE':'BREAKING'}</button></label><button className="advance-release" disabled={breach||release.newTraffic>=100||rolled} onClick={()=>apply(advanceDeploymentRollout)}>{release.strategy==='bluegreen'?'CUTOVER →':'ROLLOUT +'}</button><button className="rollback-action" disabled={!breach||rolled} onClick={()=>apply(rollbackDeployment)}>ROLLBACK</button></div>
    <div className="rollback-stage"><div className="version old"><small>v1.4.1 · OLD</small><strong>{traffic.old}%</strong></div><motion.div className={`version new ${breach?'danger':''}`} animate={{opacity:rolled?.2:1}}><small>v1.4.2 · {release.strategy.toUpperCase()}</small><strong>{traffic.next}%</strong><span>errors {release.errorRate}%</span></motion.div><div className={`threshold ${breach?'hot':''}`}><small>SLO GATE</small><strong>{ROLLBACK_ERROR_THRESHOLD}%</strong><span>{release.dbCompatible?'DB rollback-safe':'DB breaking'}</span></div></div>
    {!release.dbCompatible&&<div className="rollback-db-warning"><strong>DB ŞEMASI UYARISI</strong><span>Application binary’sini geri almak, eski sürümün yeni schema ile çalışacağını garanti etmez.</span></div>}
    <div className="rollback-evidence"><div className={breach?'danger':'ok'}><small>SLO EVIDENCE</small><strong>{breach?'BREACH':'HEALTHY'}</strong><span>{release.errorRate}% / {ROLLBACK_ERROR_THRESHOLD}% threshold</span></div><div className={release.dbCompatible?'ok':'danger'}><small>SCHEMA GATE</small><strong>{release.dbCompatible?'ROLLBACK SAFE':'ROLLBACK BLOCKED'}</strong><span>{release.dbCompatible?'old binary schema ile uyumlu':'forward-fix/schema planı gerekli'}</span></div><div className={rolled?'ok':''}><small>RECOVERY STATE</small><strong>{release.status}</strong><span>v1.4.2 traffic {traffic.next}%</span></div></div>
    <div className="rollback-trace"><small>ROLLOUT / RECOVERY TRACE</small>{release.events.length?<ol>{release.events.map((entry)=><li key={entry.id} className={`rollback-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Rollout'u ilerlet. Sonra error rate'i threshold üstüne çıkar; DB compatible/breaking durumunda rollback sonucunu karşılaştır.</p>}</div>
  </ArcadeFrame>
}

function InterviewGame({ lesson,spec }) {
  const questions=[
    ['CI’da tek test kırıldı. Ne yaparsın?',['Release’i durdurup failure’ın gerçek hata mı flaky test mi olduğunu kanıtlarım','Testi skip edip aynı artifact’i production’a geçiririm'],0,'CI gate kırmızıysa önce failure nedeni kanıtlanır; flaky test bile görünmezce skip edilmez.'],
    ['Production gate politikasını nasıl seçersin?',['Riskli değişiklikte approval kullanır, düşük riskte otomasyonu artırırım','Continuous Delivery varsa her release zorunlu manuel olmalıdır'],0,'Delivery/Deployment ayrımı release politikasını açıklar; approval seviyesi risk ve organizasyon ihtiyacına göre değişebilir.'],
    ['Canary’de error rate threshold aştı.',['Trafiği dondurup rollback + telemetry ile etkisini doğrularım','Daha çok sample toplamak için canary trafiğini büyütürüm'],0,'Threshold aşımında blast radius büyütmek yerine recovery ve gözlem önceliklidir.'],
    ['Masked CI variable kullanınca secret tamamen güvenli midir?',['Hayır. Masking log çıktısını korur; job erişimi, scope ve rotation yine tasarlanmalıdır','Evet. Masked ise credential artık secret manager gerektirmez'],0,'Log masking tek bir savunmadır; secret’ın kim tarafından okunabildiği ve nasıl rotate edildiği ayrı güvenlik kararıdır.'],
    ['v2 ile backward-incompatible DB migration çıktı ve production hata veriyor. İlk refleks?',['App rollback’in tek başına güvenli olduğunu varsaymam; schema uyumluluğunu kontrol edip rollback/forward-fix planını seçerim','Binary’yi v1’e çekince DB de otomatik eski şemaya döner'],0,'Application rollback database schema’yı otomatik geri almaz. Migration stratejisi backward/forward compatibility ile birlikte tasarlanmalıdır.'],
  ]
  const [q,setQ]=useState(0)
  const [pick,setPick]=useState(null)
  const [score,setScore]=useState(0)
  const current=questions[q]
  const choose=(i)=>{if(pick!==null)return;setPick(i);if(i===current[2])setScore((v)=>v+1)}
  const next=()=>{setQ((q+1)%questions.length);setPick(null);if(q===questions.length-1)setScore(0)}
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-interview" footer={pick===null?`Karar ver; sonra gerekçeyi mülakat cümlesi olarak aç. Skor ${score}/${questions.length}.`:current[3]}>
    <div className="interview-game-card"><small>SCENARIO {q+1}/{questions.length} · SCORE {score}/{questions.length}</small><h3>{current[0]}</h3><div>{current[1].map((x,i)=><button key={x} className={pick===i?(i===current[2]?'correct':'wrong'):''} onClick={()=>choose(i)}>{x}</button>)}</div><button className="next-scenario" disabled={pick===null} onClick={next}>{q===questions.length-1?'Turu yeniden başlat ↻':'Sonraki senaryo →'}</button></div>
  </ArcadeFrame>
}

function ReactGame({ lesson,spec }) {
  const [react,setReact]=useState(createReactRenderState)
  const apply=(fn)=>setReact((state)=>fn(state))
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-react" footer={`Parent renders=${react.parentRenders} · ProductCard renders=${react.childRenders} · effect runs=${react.effectRuns}. Render olmak ile effect çalışmak aynı olay değildir; dependency değişimi ayrı gate’tir.`}>
    <div className="react-controls"><button onClick={()=>apply(rerenderReactParent)}>Parent re-render</button><button onClick={()=>apply(changeReactProductProp)}>productName prop değiştir</button><button onClick={()=>apply(updateReactChildState)}>Child setCount +1</button><button className={react.memoEnabled?'active':''} onClick={()=>apply((state)=>setReactMemo(state,!state.memoEnabled))}>React.memo: {react.memoEnabled?'ON':'OFF'}</button></div>
    <div className="react-stage">
      <div className="react-parent"><small>PARENT</small><strong>render #{react.parentRenders}</strong><code>productName="{react.productName}"</code><span>prop sahibi parent</span></div><div className="react-arrow">props ↓</div>
      <motion.div key={`${react.childRenders}-${react.productName}-${react.count}`} className="react-component" initial={{opacity:.45,y:5}} animate={{opacity:1,y:0}}><small>ProductCard</small><h3>{react.productName}</h3><strong>render #{react.childRenders}</strong><code>state.count = {react.count}</code><span>{react.memoEnabled?'memoized child':'normal child render'}</span></motion.div>
      <div className="react-effect"><small>useEffect([productName])</small><strong>{react.effectRuns} run</strong><code>dependency: {react.productName}</code><span>{react.lastCause}</span></div>
    </div>
    <div className="react-evidence"><div><small>PARENT</small><strong>{react.parentRenders}</strong><span>prop change / parent render</span></div><div><small>CHILD RENDER</small><strong>{react.childRenders}</strong><span>props veya local state</span></div><div className="ok"><small>EFFECT RUN</small><strong>{react.effectRuns}</strong><span>mount + dependency change</span></div><div className={react.memoEnabled?'ok':''}><small>MEMO</small><strong>{react.memoEnabled?'ACTIVE':'OFF'}</strong><span>aynı prop parent render gate</span></div></div>
    <div className="react-trace"><small>RENDER / EFFECT TRACE</small><ol>{react.events.map((entry)=><li key={entry.id} className={`react-event-${entry.tone}`}><b>{entry.cause}</b><span>{entry.detail}</span></li>)}</ol></div>
  </ArcadeFrame>
}

function PythonGame({ lesson,spec }) {
  const [sample,setSample]=useState(0)
  const [answers,setAnswers]=useState([null,null,null])
  const examples=[
    ['Map / dict','Map<String,Integer> scores = Map.of("java", 90);',['scores = {"java": 90}','scores = Map("java", 90)'],0,'Python dict literal {} kullanır; Java Map API’sini taşımaz.'],
    ['null / None','String name = null;',['name = null','name = None'],1,'Python null yerine None kullanır.'],
    ['Stream / comprehension','items.stream().filter(Item::active).toList()',['[x for x in items if x.active]','items.filter(lambda x: x.active).toList()'],0,'List comprehension filtre + dönüşümü doğrudan ifade eder.'],
  ]
  const e=examples[sample]
  const picked=answers[sample]
  const score=answers.filter((answer,i)=>answer===examples[i][3]).length
  const choose=(choice)=>setAnswers(xs=>xs.map((v,i)=>i===sample?choice:v))
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-python" footer={picked===null?`Java kodunun Python karşılığını seç. Skor ${score}/3.`:`${picked===e[3]?'Doğru.':'Yanlış.'} ${e[4]} · Skor ${score}/3.`}>
    <div className="python-tabs">{examples.map((x,i)=><button key={x[0]} className={sample===i?'active':answers[i]===x[3]?'solved':''} onClick={()=>setSample(i)}>{x[0]}</button>)}</div><div className="language-compare"><motion.div key={'j'+sample} initial={{x:-8,opacity:0}} animate={{x:0,opacity:1}}><small>JAVA SOURCE</small><code>{e[1]}</code></motion.div><span>?</span><motion.div key={'p'+sample} className="python-options" initial={{x:8,opacity:0}} animate={{x:0,opacity:1}}><small>PYTHON KARŞILIĞI</small>{e[2].map((option,i)=><button key={option} className={picked===i?(i===e[3]?'correct':'wrong'):''} onClick={()=>choose(i)}><code>{option}</code></button>)}</motion.div></div>
  </ArcadeFrame>
}

function ComplianceGame({ lesson,spec }) {
  const [quality,setQuality]=useState(createEnterpriseQualityState)
  const apply=(fn)=>setQuality((state)=>fn(state))
  const passed=ENTERPRISE_QUALITY_GATES.filter(([id])=>quality.gates[id].status==='PASS').length
  const failed=ENTERPRISE_QUALITY_GATES.filter(([id])=>quality.gates[id].status==='FAIL').length
  const footer=quality.releaseStatus==='RELEASED'
    ? 'Release OPEN: çalışıyor olması tek başına yetmedi; review, test, security, PII ve audit evidence zinciri kanıtlandı.'
    : quality.releaseStatus==='BLOCKED'
      ? `Release BLOCKED: ${quality.blockedReasons.join(' · ')}`
      : `${passed}/5 gate PASS · ${failed} FAIL. Finding düzeltildiğinde eski evidence otomatik geçerli sayılmaz; ilgili check yeniden çalışmalıdır.`
  const risks=[['reviewIssue','Review issue'],['testRegression','Test regression'],['vulnerability','HIGH vuln'],['piiLeak','PII/token leak'],['auditMissing','Audit missing']]
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-compliance" footer={footer}>
    <div className="compliance-risk-controls">{risks.map(([id,label])=><button key={id} className={quality.risks[id]?'danger active':''} onClick={()=>apply((state)=>setEnterpriseRisk(state,id,!state.risks[id]))}>{label}: {quality.risks[id]?'ON':'OFF'}</button>)}</div>
    <div className="quality-gate-grid">{ENTERPRISE_QUALITY_GATES.map(([id,label],i)=>{const gate=quality.gates[id];return <div key={id} className={gate.status.toLowerCase()}><span>{String(i+1).padStart(2,'0')}</span><small>{label}</small><strong>{gate.status}</strong><code>{gate.evidence}</code><button onClick={()=>apply((state)=>runEnterpriseQualityGate(state,id))}>Check çalıştır</button></div>})}</div>
    <div className="quality-release-actions"><button onClick={()=>apply(runAllEnterpriseQualityGates)}>Tüm gate’leri çalıştır</button><button className="sim-action" onClick={()=>apply(attemptEnterpriseRelease)}>Release dene →</button></div>
    <div className="quality-release-proof"><div className={passed===5?'ok':''}><small>PASS</small><strong>{passed}/5</strong><span>current evidence</span></div><div className={failed?'danger':''}><small>FAIL</small><strong>{failed}</strong><span>release blocker</span></div><div className={quality.releaseStatus==='RELEASED'?'ok':quality.releaseStatus==='BLOCKED'?'danger':''}><small>RELEASE</small><strong>{quality.releaseStatus}</strong><span>evidence-driven gate</span></div></div>
    <div className="quality-trace"><small>QUALITY / COMPLIANCE TRACE</small>{quality.events.length?<ol>{quality.events.map((entry)=><li key={entry.id} className={`quality-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Tüm gate’leri çalıştır. Sonra PII leak veya HIGH vuln enjekte et; eski PASS evidence’in neden geçersizleştiğini gözle.</p>}</div>
  </ArcadeFrame>
}

function ClarifyGame({ lesson,spec }) {
  const [requirement,setRequirement]=useState(createStakeholderRequirementState)
  const apply=(fn)=>setRequirement((state)=>fn(state))
  const resolved=REQUIREMENT_DECISIONS.filter((item)=>requirement.decisions[item.id]).length
  const footer=requirement.testStatus==='PASS'
    ? `AC v${requirement.criteriaVersion} doğrulandı · 5/5 acceptance test PASS.`
    : requirement.criteriaStatus==='BLOCKED'
      ? `AC üretilemedi · eksik: ${requirement.missing.join(', ')}.`
      : `${resolved}/5 business kararı net. Karar değişirse eski AC/test evidence geçersizleşir.`
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-clarify" footer={footer}>
    <div className="requirement-note"><small>PO REQUEST</small><strong>“Siparişi iptal edebilelim.”</strong><span>Önce belirsizliği business kararı haline getir; sonra AC üret ve test et.</span></div>
    <div className="requirement-decision-grid">{REQUIREMENT_DECISIONS.map((item)=><div key={item.id} className={requirement.decisions[item.id]?'resolved':''}><small>{item.question}</small><div>{item.options.map(([value,label])=><button key={value} className={requirement.decisions[item.id]===value?'active':''} onClick={()=>apply((state)=>setRequirementDecision(state,item.id,value))}>{label}</button>)}</div></div>)}</div>
    <div className="requirement-actions"><button onClick={()=>apply(generateAcceptanceCriteria)}>Acceptance criteria üret</button><button className="sim-action" onClick={()=>apply(runRequirementAcceptanceTests)}>Acceptance testleri çalıştır →</button></div>
    <div className="acceptance-workbench">
      <div className={requirement.criteriaStatus==='READY'?'ready':requirement.criteriaStatus==='BLOCKED'?'blocked':''}><small>ACCEPTANCE CRITERIA · {requirement.criteriaVersion?`v${requirement.criteriaVersion}`:'—'}</small>{requirement.criteria.length?<ol>{requirement.criteria.map((criterion,i)=><li key={criterion}><b>AC{i+1}</b><span>{criterion}</span></li>)}</ol>:<p>{requirement.criteriaStatus==='BLOCKED'?`Eksik kararlar: ${requirement.missing.join(', ')}`:'5 karar netleşince gözlenebilir kurallar üret.'}</p>}</div>
      <div className={requirement.testStatus==='PASS'?'ready':requirement.testStatus==='BLOCKED'?'blocked':''}><small>ACCEPTANCE TEST EVIDENCE</small>{requirement.testCases.length?<ol>{requirement.testCases.map((item)=><li key={item.id}><b>{item.status}</b><span><strong>{item.name}</strong>{item.expected}</span></li>)}</ol>:<p>{requirement.testStatus==='BLOCKED'?'Current AC READY değil; test koşturulmadı.':'AC üretildikten sonra test senaryolarını koştur.'}</p>}</div>
    </div>
    <div className="requirement-trace"><small>REQUIREMENT TRACE</small>{requirement.events.length?<ol>{requirement.events.map((entry)=><li key={entry.id} className={`requirement-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Bir business kararı seç. Trace, kararın AC ve test kanıtını nasıl etkilediğini gösterecek.</p>}</div>
  </ArcadeFrame>
}

function PriorityGame({ lesson,spec }) {
  const [plan,setPlan]=useState(createDeliveryPrioritizationState)
  const apply=(fn)=>setPlan((state)=>fn(state))
  const byId=Object.fromEntries(DELIVERY_WORK_ITEMS.map((item)=>[item.id,item]))
  const effort=scopedDeliveryEffort(plan)
  const footer=plan.assessment==='PASS'
    ? `Plan PASS · ${effort}/${plan.capacity} capacity · kritik işler önce · dependency uyumlu.`
    : plan.assessment==='BLOCKED'
      ? `Plan BLOCKED · ${plan.reasons.join(' · ')}.`
      : `Scope ${effort}/${plan.capacity}. Priority sabit sıra değil; incident, deadline, dependency ve kapasiteyle değişir.`
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-priority" footer={footer}>
    <div className="priority-scenario-controls">
      <button className={plan.incidentActive?'danger active':''} onClick={()=>apply((state)=>setDeliveryIncidentActive(state,!state.incidentActive))}>Prod incident: {plan.incidentActive?'ACTIVE':'RESOLVED'}</button>
      <button className={plan.analyticsReady?'ok active':''} onClick={()=>apply((state)=>setDeliveryAnalyticsReady(state,!state.analyticsReady))}>Analytics dep: {plan.analyticsReady?'READY':'BLOCKED'}</button>
      <div><small>TEAM CAPACITY</small>{[5,7].map((capacity)=><button key={capacity} className={plan.capacity===capacity?'active':''} onClick={()=>apply((state)=>setDeliveryCapacity(state,capacity))}>{capacity} pt</button>)}</div>
    </div>
    <div className="priority-stack">{plan.order.map((id,pos)=>{const item=byId[id];const included=plan.inScope[id];return <motion.div layout key={id} className={`${included?'in-scope':'deferred'} ${id==='payment'&&plan.incidentActive?'critical':''}`}>
      <span>#{pos+1}</span><div><strong>{item.title}</strong><small>{item.impact} impact · {item.urgency} · effort {item.effort}</small><code>{item.dependency?`dependency: ${plan.analyticsReady?'READY':'BLOCKED'}`:`risk: ${item.risk}`}</code></div>
      <div className="priority-card-actions"><button onClick={()=>apply((state)=>moveDeliveryWork(state,id,'up'))} disabled={pos===0}>↑</button><button onClick={()=>apply((state)=>moveDeliveryWork(state,id,'down'))} disabled={pos===plan.order.length-1}>↓</button><button className={included?'active':''} onClick={()=>apply((state)=>setDeliveryWorkScope(state,id,!included))}>{included?'IN':'OUT'}</button></div>
    </motion.div>})}</div>
    <div className="priority-plan-proof"><div className={effort>plan.capacity?'danger':'ok'}><small>CAPACITY</small><strong>{effort}/{plan.capacity}</strong><span>{effort>plan.capacity?'OVERLOADED':'WITHIN LIMIT'}</span></div><div className={plan.analyticsReady?'ok':''}><small>DEPENDENCY</small><strong>{plan.analyticsReady?'READY':'BLOCKED'}</strong><span>reporting / analytics</span></div><div className={plan.assessment==='PASS'?'ok':plan.assessment==='BLOCKED'?'danger':''}><small>PLAN</small><strong>{plan.assessment}</strong><span>evidence check</span></div></div>
    <button className="sim-action priority-assess" onClick={()=>apply(assessDeliveryPlan)}>Planı değerlendir →</button>
    <div className="priority-trace"><small>DELIVERY TRACE</small>{plan.events.length?<ol>{plan.events.map((entry)=><li key={entry.id} className={`priority-event-${entry.tone}`}><b>{String(entry.id).padStart(2,'0')}</b><span>{entry.message}</span></li>)}</ol>:<p>Scope’u küçült, işi sırala ve planı değerlendir. Sonra incident/dependency değiştirip kararın neden değiştiğini gör.</p>}</div>
  </ArcadeFrame>
}

function SafeChangeGame({ lesson,spec }) {
  const [support,setSupport]=useState(createSafeChangeState)
  const apply=(fn)=>setSupport((state)=>fn(state))
  const ready=support.regression.status==='PASS'&&support.contract.status==='PASS'
    &&support.regression.revision===support.revision&&support.contract.revision===support.revision
  const final=support.rollout.status==='HEALTHY'&&support.monitoring.status==='PASS'
  const footer=final?'Full traffic HEALTHY: güncel regression + contract + production monitoring PASS. Runbook’a kanıtları ekle.'
    : support.rollout.status==='HALTED'?'Production monitor FAIL: rollout durdu. Rollback ve incident review gerekli.'
      : `Patch r${support.revision} · regression ${support.regression.status} · contract ${support.contract.status} · rollout ${support.rollout.status}. Her patch değişiminde eski test kanıtı geçersizleşir.`
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-safechange" footer={footer}>
    <div className="support-intro"><div><small>INCIDENT · INC-1042</small><strong>GET /users/42</strong><code>v2.4.0 · production · HTTP 500</code></div><p>Şikâyet: “Profil bazen açılmıyor.” Eski iOS istemcisi response içinde <code>name: string</code> bekliyor. Hata yalnızca adı boş kullanıcılarda görülüyor.</p></div>
    <div className="support-section"><div className="support-section-title"><span>01</span><strong>Reproduce ve kanıt</strong></div>
      <div className="support-actions"><button onClick={()=>apply(reproduceSupportIncident)}>GET /users/42 tekrar et</button><button onClick={()=>apply((s)=>inspectSupportEvidence(s,'logs'))}>Stack trace oku</button><button onClick={()=>apply((s)=>inspectSupportEvidence(s,'deploy'))}>Deploy diff incele</button></div>
      <div className="support-evidence"><div className={support.reproduced?'pass':''}><small>HTTP REPRO</small><strong>{support.reproduced?'500 CONFIRMED':'NOT_RUN'}</strong><code>{support.reproduced?'displayName=null → 500':'Önce request çalıştır'}</code></div><div className={support.evidence.logs?'pass':''}><small>LOGS</small><strong>{support.evidence.logs?'NPE @ mapper:87':'NOT_READ'}</strong><code>{support.evidence.logs?'displayName is null':'Stack trace bekleniyor'}</code></div><div className={support.evidence.deploy?'pass':''}><small>LAST DEPLOY</small><strong>{support.evidence.deploy?'v2.4.0 DIFF':'NOT_READ'}</strong><code>{support.evidence.deploy?'nullable field, guard yok':'Deploy diff bekleniyor'}</code></div></div>
      <div className="support-choice"><small>ROOT CAUSE HİPOTEZİ · kanıta göre seç</small><div>{SUPPORT_DIAGNOSES.map(([id,label])=><button key={id} className={support.diagnosis===id?(support.diagnosisStatus==='CONFIRMED'?'pass':'danger'):''} onClick={()=>apply((s)=>diagnoseSupportIncident(s,id))}>{label}</button>)}</div><strong className={support.diagnosisStatus==='REJECTED'?'danger':''}>Teşhis: {support.diagnosisStatus}</strong></div>
    </div>
    <div className="support-section"><div className="support-section-title"><span>02</span><strong>Patch seç ve kanıt üret</strong></div>
      <div className="support-fixes">{SUPPORT_FIXES.map(([id,label,desc])=><button key={id} className={support.fix===id?'active':''} onClick={()=>apply((s)=>selectSupportFix(s,id))}><strong>{label}</strong><span>{desc}</span></button>)}</div>
      <div className="support-actions"><button onClick={()=>apply(runSupportRegression)}>Regression test · 3 case</button><button onClick={()=>apply(runSupportContract)}>Consumer contract · 3 case</button></div>
      <div className="support-test-grid">{[['REGRESSION',support.regression],['CONSUMER CONTRACT',support.contract]].map(([name,gate])=><div key={name} className={gate.status==='PASS'?'pass':gate.status==='FAIL'?'fail':''}><small>{name} · {gate.revision===null?'—':`r${gate.revision}`}</small><strong>{gate.status}</strong>{gate.cases.length?<ul>{gate.cases.map((entry)=><li key={entry.name}><b className={entry.status==='FAIL'?'danger':''}>{entry.status}</b><span>{entry.name}<em>{entry.detail}</em></span></li>)}</ul>:<p>Bu patch için test kanıtı yok.</p>}</div>)}</div>
    </div>
    <div className="support-section"><div className="support-section-title"><span>03</span><strong>Rollout ve gerçek trafik</strong></div>
      <div className="support-rollout-actions"><button className="sim-action" onClick={()=>apply((s)=>startSupportRollout(s,'canary'))}>Canary %10 başlat</button><button onClick={()=>apply((s)=>startSupportRollout(s,'full'))}>Full deploy %100</button><button onClick={()=>apply(promoteSupportCanary)}>Canary → %100</button><button className="danger" onClick={()=>apply(rollbackSupportRollout)}>Rollback</button></div>
      <div className="support-monitor"><button className={support.latentRegression?'danger active':''} onClick={()=>apply((s)=>injectSupportProductionRegression(s,!s.latentRegression))}>Prod yükünde pool saturation: {support.latentRegression?'ON':'OFF'}</button><button onClick={()=>apply(monitorSupportRollout)}>Production monitoring çalıştır</button></div>
      <div className="support-metrics"><div className={ready?'pass':'fail'}><small>RELEASE GATES</small><strong>{ready?'2/2 PASS':'BLOCKED'}</strong><span>Güncel revision kanıtı</span></div><div className={['HEALTHY','CANARY'].includes(support.rollout.status)?'pass':support.rollout.status==='HALTED'?'fail':''}><small>ROLLOUT</small><strong>{support.rollout.status}</strong><span>{support.rollout.status==='CANARY'?'%10 trafik':support.rollout.status==='FULL'||support.rollout.status==='HEALTHY'?'%100 trafik':'Henüz üretime çıkmadı'}</span></div><div className={support.monitoring.status==='PASS'?'pass':support.monitoring.status==='FAIL'?'fail':''}><small>MONITOR</small><strong>{support.monitoring.status}</strong><span>{support.monitoring.observations.map((m)=>`${m.name}: ${m.value}`).join(' · ')||'5xx, p95 ve etki oranı'}</span></div></div>
    </div>
    <div className="support-trace" aria-live="polite"><small>SUPPORT INCIDENT TRACE</small>{support.events.length?<ol>{support.events.map((event)=><li key={event.id} className={`support-event-${event.tone}`}><b>{String(event.id).padStart(2,'0')}</b><span>{event.message}</span></li>)}</ol>:<p>Hata reproduksiyonundan başla. Her işlem kanıt zincirine yazılır.</p>}</div>
  </ArcadeFrame>
}

function MatrixGame({ lesson,spec }) {
  const [state,setState]=useState(createTechnologyDecisionState)
  const scenario=TECHNOLOGY_SCENARIOS.find(item=>item.id===state.scenario)
  const candidates=[['kafka','Kafka'],['rabbit','RabbitMQ Classic Queue']]
  const timeline=getReplayTimeline(state)
  const displayDecision=state.recommendation==='NOT_EVALUATED'?'Bekliyor':state.recommendation==='BLOCKED'?'Karar engellendi':state.recommendation==='TIE'?'Eşitlik · daha fazla kanıt gerekli':state.recommendation==='kafka'?'Kafka':'RabbitMQ'
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-matrix" footer="Eğitim simülasyonu: bu PASS/FAIL sonuçları gerçek broker benchmark’ı değildir. Üretimde yük, güvenlik, gözlemlenebilirlik ve işletim maliyeti ayrıca ölçülmeli.">
    <section className="tech-scenario" aria-label="Mimari gereksinimler">
      <span className="tech-kicker">01 · PROBLEMİ TANIMLA</span>
      <div className="tech-scenario-switch">{TECHNOLOGY_SCENARIOS.map(item=><button type="button" key={item.id} aria-pressed={state.scenario===item.id} className={state.scenario===item.id?'selected':''} onClick={()=>setState(s=>setTechnologyScenario(s,item.id))}>{item.label}</button>)}</div>
      <p>{scenario.description}</p>
      <label className="tech-team">Takımın mevcut broker deneyimi
        <select value={state.team} onChange={e=>setState(s=>setTechnologyTeam(s,e.target.value))}>
          <option value="rabbit">RabbitMQ</option><option value="kafka">Kafka</option><option value="both">Her ikisi</option>
        </select>
      </label>
      {state.scenario==='orders'&&<fieldset className="tech-replay-fault">
        <legend>REPLAY LAB · EVENT 7. GÜNDE NEREDE?</legend>
        <p>Kafka’nın zaman bazlı retention ayarı yeterli olsa bile olayın saklanıp saklanmadığını değiştir. Ardından Kafka testini yeniden çalıştır.</p>
        <div className="tech-replay-options">{REPLAY_STORAGE_CASES.map(item=><button type="button" key={item.id} aria-pressed={state.replayStorage===item.id} className={state.replayStorage===item.id?'selected':''} onClick={()=>setState(s=>setTechnologyReplayStorage(s,item.id))}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>
        <div className="tech-replay-timeline" aria-label="Kafka olay kayıtları ve saklama durumları">
          <div className="tech-replay-timeline-head"><strong>EVENT LOG · ÖRNEK OFFSETLER</strong><span className={timeline.readable?'ready':'blocked'}>{timeline.readable?'7. GÜN REPLAY HAZIR':'7. GÜN REPLAY ENGELLİ'}</span></div>
          <ol>{timeline.records.map(entry=><li key={entry.offset} className={`tech-record-${entry.status}`}>
            <div><small>{entry.age} · offset {entry.offset}</small><em>{entry.status==='stored'?'SAKLI':entry.status==='expired'?'SÜRESİ DOLDU':entry.status==='evicted'?'SİLİNDİ':'COMPACT EDİLDİ'}</em></div>
            <strong>{entry.key} · {entry.event}</strong>
            <p>{entry.reason}</p>
          </li>)}</ol>
          <p className="tech-replay-readout">{timeline.readable
            ? 'Event topic’te saklı. Offset reset/seek seçildiği için geçmişten yeniden okuma örneği çalışabilir.'
            : timeline.records[0].status!=='stored'
              ? 'Offset 120 silinmiş. Seek/reset, kaybolan geçmiş olayı geri getiremez.'
              : 'Offset 120 saklı. Fakat geçmişi okumak için Kafka offset ayarını da etkinleştirmen gerek.'}</p>
        </div>
      </fieldset>}
    </section>
    <div className="tech-candidates">{candidates.map(([key,label])=>{
      const evidence=state.evidence[key]
      return <section className="tech-candidate" key={key} aria-label={`${label} deneyi`}>
        <div className="tech-candidate-head"><div><span className="tech-kicker">02 · ADAYI YAPILANDIR</span><h3>{label}</h3></div><span className={`tech-status ${evidence?.status?.toLowerCase()||'pending'}`}>{evidence?.status||'TEST EDİLMEDİ'}</span></div>
        <div className="tech-options">{TECHNOLOGY_CONTROLS[key].map(([option,title,description])=><button type="button" key={option} aria-pressed={state.config[key][option]} className={state.config[key][option]?'enabled':''} onClick={()=>setState(s=>toggleTechnologyOption(s,key,option))}><span className="tech-toggle" aria-hidden="true">{state.config[key][option]?'✓':'+'}</span><span><strong>{title}</strong><small>{description}</small></span></button>)}</div>
        <button type="button" className="tech-run" onClick={()=>setState(s=>runTechnologyTrial(s,key))}>Must-have testlerini çalıştır</button>
        <div className="tech-test-results" aria-live="polite">
          {evidence?evidence.cases.map(item=><div key={item.name} className={item.pass?'passed':'failed'}><div><b>{item.status}</b><strong>{item.name}</strong></div><p>{item.detail}</p>{!item.pass&&<p className="tech-remediation"><b>NASIL DÜZELİR?</b> {item.remediation}</p>}</div>):<p className="tech-empty">Yapılandırma seç. Sonuçlar ancak test çalışınca görünecek.</p>}
        </div>
        {evidence&&<div className="tech-workload" aria-label={`${label} örnek mesaj akışı`}>
          <div className="tech-workload-head"><strong>ÖRNEK MESAJ AKIŞI</strong><small>{state.scenario==='orders'?'Partition · dedup · replay':'SMTP 503 · retry · tekrar teslim'}</small></div>
          <p className="tech-workload-note">{state.scenario==='orders'
            ? 'Replay adımı, yedi gün önceki event’in hâlâ saklandığı varsayımına dayanır. Gerçek sistemde retention süresi, boyut sınırı ve compaction etkisi ayrıca doğrulanır.'
            : '01–02 başarısız SMTP gönderim vakasıdır. 03 ise bağımsız olarak başarılı gönderim sonrası ACK/offset commit kaybını inceler; ilk vakanın devamı değildir.'}</p>
          <ol>{evidence.trace.map(event=><li className={`tech-flow-${event.status}`} key={event.label}><div><span className="tech-flow-indicator" aria-hidden="true"/><b>{event.label}</b><em>{event.status==='ok'?'İŞLENDİ':event.status==='blocked'?'ENGELLENDİ':'RİSK'}</em></div><p>{event.detail}</p></li>)}</ol>
        </div>}
      </section>
    })}</div>
    <section className="tech-adr" aria-live="polite">
      <span className="tech-kicker">03 · ARCHITECTURE DECISION RECORD</span>
      <div className="tech-adr-heading"><h3>{displayDecision}</h3><button type="button" onClick={()=>setState(decideTechnology)}>Kanıta göre karar ver</button></div>
      <p>{state.reason||'İki adayın mevcut senaryoda test kanıtını topla. Bir ayar değişirse ilgili adayın sonucu geçersizleşir.'}</p>
      <small>Gereksinim: {scenario.label} · Ekip deneyimi: {state.team==='both'?'Her ikisi':state.team==='kafka'?'Kafka':'RabbitMQ'}</small>
    </section>
    <details className="tech-events"><summary>Olay kaydı · {state.events.length} işlem</summary><ol>{state.events.map(event=><li className={`tech-event-${event.tone}`} key={event.id}>{event.message}</li>)}</ol></details>
  </ArcadeFrame>
}

function StarGame({ lesson,spec }) {
  const parts=[
    ['S','SITUATION',['Bir ara production’da sorun çıktı.','v1.4.2 sonrası checkout 500 oranı %1’den %9’a çıktı.'],1],
    ['T','TASK',['30 dakika içinde kullanıcı etkisini azaltıp root cause’u izole etmem gerekiyordu.','Takıma yardımcı olmam gerekiyordu.'],0],
    ['A','ACTION',['Sorunu birlikte çözdük.','Trace + query analizi yaptım; rollback başlatıp fix PR’ını açtım.'],1],
    ['R','RESULT',['Error rate %9’dan %0.8’e indi; regression test ve alert eklendi.','Sonunda her şey düzeldi.'],0],
  ]
  const [active,setActive]=useState(0)
  const [answers,setAnswers]=useState([null,null,null,null])
  const current=parts[active]
  const score=answers.filter((answer,i)=>answer===parts[i][3]).length
  const complete=answers.every((answer)=>answer!==null)
  const answerText=parts.map((part,i)=>answers[i]===null?null:part[2][answers[i]]).filter(Boolean)
  return <ArcadeFrame lesson={lesson} {...spec} className="arcade-star" footer={complete?`STAR kanıt skoru ${score}/4. Güçlü cevap: bağlam spesifik, sorumluluk kişisel, Action somut, Result ölçülebilir.`:`${answers.filter((x)=>x!==null).length}/4 parça seçildi. Soyut sıfat yerine kanıt seç.`}>
    <div className="star-stage">{parts.map(([letter,label],i)=>{const picked=answers[i];const correct=picked===parts[i][3];return <button key={letter} className={`${active===i?'shown':''} ${picked!==null?(correct?'star-correct':'star-wrong'):''}`} onClick={()=>setActive(i)}><span>{letter}</span><small>{label}</small><strong>{picked===null?'kanıt seç':parts[i][2][picked]}</strong></button>})}</div>
    <div className="star-choice-panel"><small>{current[0]} · {current[1]}</small>{current[2].map((option,i)=><button key={option} className={answers[active]===i?(i===current[3]?'correct':'wrong'):''} onClick={()=>setAnswers(xs=>xs.map((v,n)=>n===active?i:v))}>{option}</button>)}</div>
    <div className="star-answer-builder">
      <div className="star-answer-copy"><small>LIVE INTERVIEW ANSWER</small><p>{answerText.length ? answerText.join(' ') : 'S, T, A ve R kartlarından kanıt seçtikçe cevap burada oluşacak.'}</p></div>
      <div className="star-evidence-meter"><small>EVIDENCE</small><strong>{score}/4</strong><div><motion.i animate={{width:`${score/4*100}%`}}/></div><span>{score<2?'soyut':score<4?'kanıt güçleniyor':'spesifik + kişisel + ölçülebilir'}</span></div>
    </div>
  </ArcadeFrame>
}

export default function Post05Playground({ lesson }) {
  const spec = useMemo(() => specs[lesson.id], [lesson.id])
  if (!spec) return null
  const props = { lesson, spec }
  switch (spec.kind) {
    case 'mock': return <MockGame {...props}/>
    case 'risk': return <RiskGame {...props}/>
    case 'loop': return <LoopGame {...props}/>
    case 'scrum': return <ScrumGame {...props}/>
    case 'incident': return <IncidentGame {...props}/>
    case 'git': return <GitGame {...props}/>
    case 'monolith': return <MonolithGame {...props}/>
    case 'microservice': return <MicroserviceGame {...props}/>
    case 'compare': return <ArchitectureCompareGame {...props}/>
    case 'sort': return <SortGame {...props}/>
    case 'latency': return <LatencyGame {...props}/>
    case 'breaker': return <BreakerGame {...props}/>
    case 'broker': return <BrokerGame {...props}/>
    case 'saga': return <SagaGame {...props}/>
    case 'balancer': return <BalancerGame {...props}/>
    case 'router': return <RouterGame {...props}/>
    case 'fanout': return <FanoutGame {...props}/>
    case 'gates': return <GatesGame {...props}/>
    case 'blast': return <BlastGame {...props}/>
    case 'deploy': return <DeployGame {...props}/>
    case 'principles': return <PrinciplesGame {...props}/>
    case 'context': return <ContextGame {...props}/>
    case 'responsibility': return <ResponsibilityGame {...props}/>
    case 'designer': return <DesignerGame {...props}/>
    case 'feedback': return <FeedbackGame {...props}/>
    case 'pipeline': return <PipelineGame {...props}/>
    case 'release': return <ReleaseGame {...props}/>
    case 'artifact': return <ArtifactGame {...props}/>
    case 'container': return <ContainerGame {...props}/>
    case 'kube': return <KubeGame {...props}/>
    case 'yaml': return <YamlGame {...props}/>
    case 'secret': return <SecretGame {...props}/>
    case 'rollback': return <RollbackGame {...props}/>
    case 'interview': return <InterviewGame {...props}/>
    case 'react': return <ReactGame {...props}/>
    case 'python': return <PythonGame {...props}/>
    case 'compliance': return <ComplianceGame {...props}/>
    case 'clarify': return <ClarifyGame {...props}/>
    case 'priority': return <PriorityGame {...props}/>
    case 'safechange': return <SafeChangeGame {...props}/>
    case 'matrix': return <MatrixGame {...props}/>
    case 'star': return <StarGame {...props}/>
    default: return null
  }
}
