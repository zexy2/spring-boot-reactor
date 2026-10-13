// İlandaki sorumluluklardan türetilen örnek senaryolar; şirkete ait gerçek mülakat soruları değildir.
export const roleInterviewDomains = [
  {
    id: 'spring',
    label: 'JAVA · SPRING BOOT',
    scenarios: [
      {
        id: 'spring-transaction',
        question: 'Sipariş oluştururken veritabanına iki kayıt yazılıyor. İkinci kayıt başarısız olursa ne yaparsın?',
        followUp: 'Aynı sınıftaki bir metottan @Transactional metoda çağrı yaparsan neye dikkat edersin?',
        answer: [
          'Tek veritabanındaki tutarlı bir iş akışını Service katmanında @Transactional sınırına alırım. RuntimeException veya Error varsayılan olarak rollback tetikler; checked exception için rollbackFor gerekebilir.',
          'Spring’in varsayılan proxy tabanlı transaction yönetiminde aynı nesnenin kendi metodunu çağırması proxy’yi atlayabilir. Transaction sınırını dışarıdan proxy üzerinden girilen public Service metoduna yerleştiririm.',
          'Ayrı mikroservis/veritabanı işlemlerini tek bir yerel @Transactional ile atomik hale getiremem; saga gibi yöntemleri düşünürüm.',
        ],
        pitfall: '@Transactional tüm servislerdeki veritabanı işlemlerini otomatik geri alır demek.',
        rubric: ['Service katmanında transaction sınırını anlattım', 'Rollback koşullarını belirttim', 'Self-invocation/proxy sorununu açıkladım', 'Çoklu servis sınırını ayırdım'],
      },
      {
        id: 'spring-layers',
        question: 'POST /orders isteğini Spring Boot içinde nasıl tasarlarsın? Katmanları ve doğrulamayı açıkla.',
        followUp: 'Entity’yi doğrudan HTTP response olarak döndürmenin riski nedir?',
        answer: [
          'Controller @Valid @RequestBody DTO alır; doğrulama hatalarını 400 ile açıklar. Service iş kurallarını ve transaction sınırını yönetir; Repository persistence erişimini sağlar.',
          'DTO ile Entity ayrımı hassas alan sızıntısını, lazy ilişki sorunlarını ve API sözleşmesinin veritabanına bağımlılığını azaltır.',
          'Başarılı creation için 201 ve mümkünse Location header dönerim; beklenmeyen durumları merkezi exception handler ile tutarlı formatta iletirim.',
        ],
        pitfall: 'Controller içinde doğrudan tüm iş mantığını ve repository çağrılarını biriktirmek.',
        rubric: ['Controller/Service/Repository sorumluluklarını ayırdım', 'DTO ve validation kullandım', 'Transaction sınırını doğru konumlandırdım', 'HTTP cevap ve hata yönetimini anlattım'],
      },
      {
        id: 'java-concurrency',
        question: 'Bir Spring singleton Service içine değişebilir bir sayaç koydun. Paralel isteklerde ne olabilir?',
        followUp: 'AtomicInteger her durumda kalıcı ve güvenilir sayaç çözümü müdür?',
        answer: [
          'Spring bean varsayılan singleton scope’tadır. Birden fazla HTTP thread’i aynı instance alanına erişebilir; düz int++ atomik değildir ve race condition oluşturur.',
          'Tek JVM içi basit sayım için AtomicInteger uygundur. Birden fazla instance veya restart sonrası tutarlılık için kalıcı/veri odaklı bir çözüm gerekir.',
          'Mümkünse Service’i stateless tasarlarım; request durumunu local değişkende tutarım.',
        ],
        pitfall: 'Singleton bean tek request ile çalışır veya synchronized her dağıtık problemi çözer demek.',
        rubric: ['Singleton ve thread paylaşımını söyledim', 'Race condition örneği verdim', 'Stateless yaklaşımı önerdim', 'Tek JVM ile dağıtık sistemi ayırdım'],
      },
    ],
  },
  {
    id: 'sql',
    label: 'SQL · JPA',
    scenarios: [
      {
        id: 'sql-n-plus-one',
        question: '100 sipariş listeleyen endpoint 101 SQL sorgusu atıyor. Nasıl teşhis eder ve düzeltirsin?',
        followUp: 'Tüm ilişkileri EAGER yapmak iyi çözüm mü?',
        answer: [
          'SQL log/metric ile 1 ana sorgu ve her sipariş için ilişki sorgusu paternini doğrularım: N+1.',
          'İhtiyaç duyulan veri için DTO projection, uygun fetch join veya entity graph uygularım. Pagination ve çoklu collection join çarpımına dikkat ederim.',
          'EAGER her yerde gereksiz yük ve farklı query planları oluşturabilir. Önce ölçer, ihtiyaca göre query tasarlarım.',
        ],
        pitfall: 'Her ilişkiye EAGER yazarak sorunun kalıcı çözüldüğünü söylemek.',
        rubric: ['N+1 paternini tanıdım', 'SQL gözlemi ile doğrulamayı anlattım', 'Projection/fetch çözümü sundum', 'EAGER ve pagination riskini belirttim'],
      },
      {
        id: 'sql-acid',
        question: 'İki kullanıcı aynı ürünün son stoğunu aynı anda satın alıyor. Veri tutarlılığını nasıl korursun?',
        followUp: 'Sadece @Transactional yazmak neden yeterli olmayabilir?',
        answer: [
          'İki transaction aynı stok değerini okuyabilir. Isolation seviyesini ve lost update olasılığını değerlendiririm.',
          'Optimistic locking (@Version) veya koşullu UPDATE (stock > 0), yüksek çatışmada pessimistic locking kullanabilirim; sonucu ve retry stratejisini test ederim.',
          '@Transactional atomik işlemi tanımlar ama seçili isolation seviyesinin tüm yarış durumlarını otomatik önlediği anlamına gelmez.',
        ],
        pitfall: 'Tek başına READ COMMITTED ve @Transactional tüm yarış koşullarını çözer demek.',
        rubric: ['Race condition belirttim', 'Isolation ile locking farkını açıkladım', 'Somut çözüm seçtim', 'Retry/çatışma yönetimini ekledim'],
      },
      {
        id: 'sql-indexing',
        question: 'GET /orders?customerId=... endpoint’i yavaşladı. Sorguyu nasıl inceler ve iyileştirirsin?',
        followUp: 'Her kolona index eklemek neden doğru değil?',
        answer: [
          'Önce latency, satır sayısı, gerçek SQL ve EXPLAIN/EXPLAIN ANALYZE ile query planını kontrol ederim.',
          'Filtre/ORDER BY erişim modeline göre uygun bileşik index ve keyset/offset pagination kararını veririm. Gereksiz veri çekimini azaltırım.',
          'Index disk ve yazma maliyeti yaratır; seçicilik, sıralama ve gerçek erişim paternine bakarak eklerim.',
        ],
        pitfall: 'Ölçüm yapmadan daha güçlü sunucu veya rastgele index önermek.',
        rubric: ['Plan/metric ile teşhis ettim', 'Sorgu ve indeks kararını gerekçelendirdim', 'Pagination seçimini anlattım', 'Index maliyetini belirttim'],
      },
    ],
  },
  {
    id: 'boundaries',
    label: 'MICROSERVICES · DDD · DESIGN',
    scenarios: [
      {
        id: 'boundary-orders',
        question: 'Monolitik e-ticaret sistemini Order, Payment ve Inventory servislerine ayırman isteniyor. Sınırları nasıl belirlersin?',
        followUp: 'Üç servisin aynı orders tablosuna doğrudan erişmesini ister misin?',
        answer: [
          'Önce business capability, bounded context, veri sahipliği ve ekip/deploy ihtiyaçlarını netleştiririm; her tabloya bir servis bölmek doğru değil.',
          'Her servis kendi verisinin sahibi olur; diğerlerine API veya event ile iş sözleşmesi sunar. Ortak tablo schema coupling, koordineli deploy ve kırılgan değişiklik üretir.',
          'Ekip küçük ve sınırlar belirsizse modüler monolit daha düşük operasyon maliyetiyle başlangıç olabilir.',
        ],
        pitfall: 'Mikroservis = her veritabanı tablosu için ayrı servis demek.',
        rubric: ['Bounded context ve capability kullandım', 'Veri ownership tanımladım', 'Servisler arası sözleşmeyi belirttim', 'Modüler monolit trade-off’unu açıkladım'],
      },
      {
        id: 'patterns-aggregator',
        question: 'Profil ekranı User, Orders ve Loyalty verilerini tek HTTP cevabında istiyor. Nasıl tasarlarsın?',
        followUp: 'Aggregator, API Gateway/Proxy ve Pipeline arasındaki ayrım nedir?',
        answer: [
          'Ekran için bir BFF/Aggregator oluşturur; bağımsız servis yanıtlarını uygun timeout ve partial failure politikasıyla birleştiririm.',
          'Proxy/Gateway routing ve çapraz kesen politikaları yürütür; Aggregator birden fazla downstream verisini bileştirir; Pipeline işi sıralı işleme adımlarına böler.',
          'Cache, fan-out maliyeti, N servis bağımlılığı ve p95/p99 latency gözlemi tasarım kararına girer.',
        ],
        pitfall: 'Proxy ile Aggregator’ın aynı işlev olduğunu veya seri bütün çağrıların her zaman gerekli olduğunu söylemek.',
        rubric: ['Aggregator akışını anlattım', 'Proxy/Gateway farkını belirttim', 'Pipeline ayrımını yaptım', 'Timeout ve kısmi hata durumunu ele aldım'],
      },
      {
        id: 'independent-deploy',
        question: 'Ödeme servisi yeni sürüme geçtiğinde sipariş servisini de aynı anda dağıtmak zorunda kalıyorsun. Nasıl iyileştirirsin?',
        followUp: 'Fully contained servis hiçbir harici dependency kullanmamak mı demek?',
        answer: [
          'Sorun contract ve data coupling olabilir. Backward-compatible API/event değişikliği, consumer contract testleri ve expand-contract migration planlarım.',
          'Independently deployable: uyumlu bir servis sürümünü diğerlerini aynı anda yayımlamadan çıkarabilmek. Fully contained: iş yeteneği ve veri sahipliğinin mümkün olduğunca servis sınırı içinde bulunması.',
          'Harici servis çağrısı olabilir; network bağımlılığı ve sürüm toleransını tasarlamak gerekir.',
        ],
        pitfall: 'Her mikroservisin tamamen bağımsız, hiç dış çağrısız olması gerektiğini iddia etmek.',
        rubric: ['Coupling kaynağını belirledim', 'Geriye uyumlu contract stratejisi sundum', 'Bağımsız deploy tanımını verdim', 'Fully contained sınırını doğru açıkladım'],
      },
    ],
  },
  {
    id: 'resilience',
    label: 'MESSAGING · RESILIENCE',
    scenarios: [
      {
        id: 'saga-payment',
        question: 'Ödeme alındı ama stok ayırma başarısız oldu. Mikroservislerde süreci nasıl toparlarsın?',
        followUp: 'Mesaj iki kez teslim edilirse ne olur?',
        answer: [
          'Farklı servislerin local transaction’larını tek ACID transaction gibi ele almam; saga akışı ve business compensation (örn. refund) tasarlarım.',
          'Event delivery tekrarlanabilir. Idempotency key, deduplication ve işlem durumu tutarak iki kez ödeme/iade riskini azaltırım.',
          'Outbox pattern DB commit ile event yayınlama arasındaki boşluğu azaltır; idempotent consumer, retry, dead-letter ve izleme gerekir.',
        ],
        pitfall: 'Kafka/RabbitMQ kullanınca mesajın kesinlikle bir kez işlendiğini varsaymak.',
        rubric: ['Local transaction sınırını anlattım', 'Saga ve compensation seçtim', 'Idempotency sundum', 'Outbox/retry/izleme riskini ele aldım'],
      },
      {
        id: 'resilience-timeout',
        question: 'Order servisi Payment servisini beklerken istekler birikiyor. Hangi korumaları koyarsın?',
        followUp: 'Timeout, retry, circuit breaker ve fallback arasında nasıl karar verirsin?',
        answer: [
          'Önce deadline/timeout tanımlar, concurrency ve pool sınırlarını izler, gerekiyorsa circuit breaker ile başarısız servise çağrıyı fail-fast keserim.',
          'Retry yalnız geçici hata ve güvenli/idempotent operasyonlarda sınırlı, backoff+jitter ile kullanılır. Kör retry yükü büyütebilir.',
          'Fallback business açısından geçerliyse kısıtlı yanıt veya bekleyen durum dönerim; ödeme başarılıymış gibi sahte cevap üretmem.',
        ],
        pitfall: 'Ödeme POST isteğini kontrolsüz tekrar denemek veya başarı taklidi yapan fallback vermek.',
        rubric: ['Timeout ve kaynak sınırı ekledim', 'Circuit breaker mekanizmasını anlattım', 'Retry/idempotency ilişkisini kurdum', 'Business-safe fallback seçtim'],
      },
      {
        id: 'eventual-consistency',
        question: 'Kullanıcı siparişi oluşturdu ama arayüzde durum birkaç saniye eski görünüyor. Bu bug mı?',
        followUp: 'Eventual consistency’yi kullanıcı deneyimine nasıl yansıtırsın?',
        answer: [
          'Asenkron event akışı varsa okuma modeli gecikebilir; beklenen tutarlılık SLA’sı ve iş kuralına göre bug olup olmadığını değerlendiririm.',
          'Pending/processing durumu, correlation id, tekrar sorgulama veya push güncelleme kullanırım. Kritik ödeme durumunu kesinleşmeden completed göstermem.',
          'Event lag, retry, poison message, idempotency ve reconciliation mekanizmasını izlerim.',
        ],
        pitfall: 'Eventual consistency her türlü veri kaybını veya süresiz gecikmeyi mazur gösterir demek.',
        rubric: ['Gecikmeli görünürlük tanımladım', 'İş kabul kriterini açıkladım', 'Kullanıcıya doğru status gösterebildim', 'Event izleme/reconciliation önerdim'],
      },
    ],
  },
  {
    id: 'delivery',
    label: 'DEVOPS · CI/CD',
    scenarios: [
      {
        id: 'pipeline-failure',
        question: 'Pull request build başarılı fakat entegrasyon testi kırılıyor. Pipeline nasıl davranmalı?',
        followUp: 'Continuous Delivery ile Continuous Deployment farkı?',
        answer: [
          'CI: lint/static checks, unit ve integration test, build, gerekliyse security/contract kontrolü. Kritik test hatasında merge/release gate başarısız olmalı.',
          'Artifact immutable ve sürümlü tutulur. Continuous Delivery üretime yayınlanabilir durumu hazırlar ama manuel onay bırakabilir; Continuous Deployment kontrollerden geçen değişikliği otomatik production’a çıkarır.',
          'Hata metrikleri, rollback ve observability release kararının parçasıdır.',
        ],
        pitfall: 'Build geçti diye entegrasyon testi kırıkken release yapmak.',
        rubric: ['CI aşamalarını sıraladım', 'Test fail gate kararını verdim', 'Delivery/Deployment farkını açıkladım', 'Artifact ve rollback konusunu ekledim'],
      },
      {
        id: 'docker-deployment',
        question: 'Spring Boot uygulaman Docker container olarak açılıyor ama trafik almaya hazır değil. Nasıl önlersin?',
        followUp: 'Liveness ve readiness probe farkı?',
        answer: [
          'Container process başladı bilgisi uygulama trafiğe hazır demek değildir. Spring Boot Actuator health/readiness endpoint’leri ile giriş trafiğini hazır instance’a yönlendiririm.',
          'Readiness hazır olmayan podu servisten çıkarır; liveness sürecin yeniden başlatılmasını gerektirebilecek sorunları işaretler. Yavaş startup için startup probe değerlendiririm.',
          'Rolling deployment, graceful shutdown, config/secrets ve rollback planı eklerim.',
        ],
        pitfall: 'Liveness probe içinde her harici bağımlılığı zorunlu kılıp geçici DB hatasında bütün podları restart etmek.',
        rubric: ['Process ile readiness farkını söyledim', 'Probe türlerini açıkladım', 'Actuator kullanımı önerdim', 'Rolling deploy/rollback riskini açıkladım'],
      },
      {
        id: 'schema-migration',
        question: 'Orders tablosunda kolon adı değişecek. Sıfır kesinti ve bağımsız servis deploy için planın ne?',
        followUp: 'Eski ve yeni uygulama sürümleri aynı anda çalışırken neye dikkat edersin?',
        answer: [
          'Expand-contract uygularım: önce yeni alanı ekleyip backward-compatible kod, gerekirse çift okuma/yazma veya backfill; sonra tüketicileri geçirir, eski kolonu en son kaldırırım.',
          'Migration sürümlü ve izlenebilir olmalı. Rollback senaryosunda veri kaybı ve eski sürüm uyumluluğu test edilir.',
          'Pipeline ve observability ile yayın sonrası hata oranı ve query davranışını takip ederim.',
        ],
        pitfall: 'Yeni kod ile eski kolonun silinmesini tek atomik deployment varsaymak.',
        rubric: ['Expand-contract sırasını açıkladım', 'Eski/yeni sürüm uyumluluğunu korudum', 'Backfill/migration planladım', 'Rollback ve izlemeyi ekledim'],
      },
    ],
  },
  {
    id: 'enterprise',
    label: 'TEST · SDLC · ENTERPRISE',
    scenarios: [
      {
        id: 'incident-triage',
        question: 'Production’da ödeme hataları yeni deploy’dan sonra iki katına çıktı. İlk 10 dakikada ne yaparsın?',
        followUp: 'Mitigation, root cause ve postmortem farkı?',
        answer: [
          'Önce etki, başlangıç zamanı, 5xx/error rate, latency ve correlation id ile log/metric/trace incelerim. Son deploy ile ilişkiyi doğrularım.',
          'Gerekirse feature flag, rollback veya trafik azaltmayla müşteri etkisini sınırlarım; veri/ödeme tekrarlarının güvenliğini gözetirim.',
          'Mitigation etkiyi azaltır, RCA mekanizmayı kanıtlar, postmortem tekrar riskini düşürecek sahipli aksiyonlar üretir.',
        ],
        pitfall: 'Müşteri etkisini azaltmadan doğrudan büyük refactor’a başlamak.',
        rubric: ['Etkisini ve metriği ölçtüm', 'Log/trace ile neden araştırdım', 'Güvenli mitigation seçtim', 'RCA ve postmortem farkını belirttim'],
      },
      {
        id: 'po-requirements',
        question: 'PO sadece “sipariş çok hızlı olmalı” diyor. Uygulamaya başlamadan ne sorarsın?',
        followUp: 'Acceptance Criteria, Definition of Done ve non-functional requirement nasıl ayrılır?',
        answer: [
          'Hangi ekran/endpoint, hedef p95 latency, veri hacmi, peak traffic, maliyet ve müşteri etkisini sorarım. Ölçülebilir başarı metriği ve baseline belirlerim.',
          'Acceptance criteria bu story’nin beklenen doğrulanabilir sonucu; Definition of Done tüm işlerde ortak kalite eşiği; non-functional requirement hız, güvenlik veya erişilebilirlik gibi kalite ihtiyacıdır.',
          'Önce küçük ölçüm/POC, ardından test planı ve sonuçları PO/BA ile netleştiririm.',
        ],
        pitfall: '“Hızlı” kelimesini ölçmeden altyapıyı mikroservise dönüştürmek.',
        rubric: ['Gereksinimi ölçülebilir yaptım', 'Acceptance criteria yazma yaklaşımını anlattım', 'DoD ile NFR ayrımını yaptım', 'Ölçüm ve paydaş doğrulamasını ekledim'],
      },
      {
        id: 'testing-strategy',
        question: 'Bir sipariş endpoint’inde fiyat hesaplama değişiyor. Hangi testleri planlarsın?',
        followUp: 'Unit test, integration test ve contract test farklı hangi hataları yakalar?',
        answer: [
          'İş kuralı için birim test, DB ve Spring wiring için integration test, dış sistem contract uyumu için contract test, kritik uçtan uca akış için az sayıda E2E test planlarım.',
          'İndirim sınırları, vergiler, para birimi precision, yetki, concurrency, eski siparişler ve hata yanıtları gibi edge case’leri kapsarım.',
          'CI gate ve production metrikleriyle değişikliği takip ederim; testlerin geçmesi tek başına production doğrulaması değildir.',
        ],
        pitfall: 'Sadece happy path unit testi yazıp API/DB uyumunu doğrulamamak.',
        rubric: ['Test seviyelerini ayırdım', 'Fiyat/precision edge case’lerini seçtim', 'Contract ve DB etkisini kapsadım', 'CI ve yayın sonrası doğrulamayı ekledim'],
      },
    ],
  },
]

export function selectRoleInterviewRound(round = 0) {
  if (!Number.isSafeInteger(round) || round < 0) throw new RangeError('Tur numarası negatif olmayan tamsayı olmalı')
  return roleInterviewDomains.map((domain) => ({
    ...domain.scenarios[round % domain.scenarios.length],
    domainId: domain.id,
    domainLabel: domain.label,
  }))
}

export function summarizeRoleInterview(questions, scores) {
  if (questions.length !== scores.length || questions.length === 0 || scores.some((score) => !Number.isInteger(score) || score < 0 || score > 4)) {
    throw new RangeError('Her soru için 0-4 arası tam puan gerekli')
  }
  const total = scores.reduce((sum, score) => sum + score, 0)
  return {
    average: total / scores.length,
    total,
    max: scores.length * 4,
    needsWork: questions.flatMap((question, index) => scores[index] <= 2 ? [{ ...question, score: scores[index] }] : []),
  }
}
