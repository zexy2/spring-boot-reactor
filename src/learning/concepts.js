import { lessons } from '../data/curriculum'

const prerequisiteMap = {
  'methods-constructor': ['class', 'object', 'type'],
  interface: ['class', 'method', 'object'],
  'annotation-basics': ['method', 'interface'],
  'generics-record': ['type', 'class', 'object'],
  'java-oop': ['class', 'object', 'interface'],
  'java-overload-override': ['method', 'inheritance', 'class'],
  'java-abstract-composition': ['interface', 'inheritance', 'object'],
  'java-collections': ['generic', 'List<T>', 'object'],
  'java-hashmap': ['Map', 'object'],
  'java-static-immutability': ['class', 'object', 'final'],
  'java-memory-equality': ['object', 'class'],
  'java-exceptions': ['class', 'method'],
  'java-streams': ['List<T>', 'method'],
  'java-concurrency': ['object', 'method'],
  'solid-clean-code': ['interface', 'composition'],
  'json-basics': ['String / double', 'request', 'response'],
  'api-basics': ['HTTP', 'request', 'response', 'JSON'],
  'spring-vs-boot': ['class', 'annotation'],
  'project-anatomy': ['framework', 'annotation'],
  annotations: ['bean', 'Dependency Injection', 'annotation'],
  beans: ['IoC', 'Dependency Injection', 'object'],
  'ioc-di': ['constructor', 'interface', 'dependency', 'object'],
  'request-flow': ['HTTP', 'request', 'response', '@RestController'],
  'spring-aop-proxy': ['@Transactional', 'bean', 'Dependency Injection', 'method'],
  rest: ['HTTP', 'request', 'response', 'endpoint', 'generic'],
  'request-inputs': ['endpoint', 'path', 'query parameter', 'body'],
  dto: ['object', 'record', 'request', 'response'],
  validation: ['DTO', 'annotation', '@RequestBody'],
  'api-design': ['HTTP', 'request', 'response', 'resource'],
  'sql-joins': ['SELECT', 'WHERE'],
  'sql-grouping': ['SELECT', 'WHERE'],
  'sql-index-normalization': ['SELECT'],
  'database-acid': ['primary key', 'foreign key'],
  'jpa-basics': ['class', 'object', 'annotation', 'primary key', 'foreign key'],
  repository: ['JPA', 'interface', '@Entity'],
  relations: ['JPA', '@Entity', 'JpaRepository', 'foreign key'],
  transactions: ['Atomicity', 'JPA', 'JpaRepository'],
  pagination: ['JpaRepository', '@OneToMany', 'LAZY', 'List<T>'],
  exceptions: ['@RestController', 'ResponseEntity<T>', 'HTTP'],
  config: ['application.yml', 'dependency'],
  logging: ['HTTP', 'request', 'response'],
  security: ['HTTP', 'request', 'endpoint'],
  testing: ['class', 'method', '@RestController'],
  mockito: ['testing', 'class', 'dependency'],
  'test-strategy': ['unit test', 'integration test', 'HTTP'],
  actuator: ['endpoint', 'HTTP', 'application.yml'],
  migrations: ['application.yml', 'dependency'],
  cache: ['method', '@Service', 'DTO'],
  async: ['method', 'annotation', '@Service'],
  'requirement-discovery': ['requirement', 'API'],
  'acceptance-criteria': ['requirement', 'HTTP'],
  'user-story-dod': ['acceptance criteria', 'unit test'],
  'agile-scrum': ['requirement'],
  'scrum-roles': ['Product Owner', 'Sprint'],
  'scrum-events': ['Scrum', 'Sprint', 'Product Owner'],
  'sprint-backlog': ['Product Backlog', 'Sprint Goal'],
  'documentation-troubleshooting': ['Logger', 'unit test'],
  'documentation-types': ['HTTP', 'API'],
  'knowledge-transfer': ['runbook', 'deployment'],
  'incident-triage': ['logging', 'HTTP'],
  'root-cause-prevention': ['troubleshooting', 'regression test'],
  'monolith-basics': ['class', 'application.yml'],
  'microservice-basics': ['HTTP', 'API', '@Service', 'request'],
  'monolith-microservices': ['monolith', 'microservice'],
  'service-boundary': ['microservice', 'monolith', 'API'],
  'sync-communication': ['HTTP', 'request', 'response', 'microservice'],
  'microservice-resilience': ['microservice', 'synchronous', 'timeout'],
  'async-messaging': ['microservice', 'request'],
  'distributed-consistency': ['asynchronous', 'transaction', 'microservice'],
  'service-discovery-load-balancing': ['microservice', 'HTTP', 'dependency'],
  'api-gateway-proxy': ['HTTP', 'request', 'endpoint', 'microservice'],
  'aggregator-pattern': ['API', 'response', 'microservice'],
  'pipeline-pattern': ['request', '@Service', 'microservice'],
  'shared-resources': ['@Repository', 'transaction', 'microservice'],
  'independent-deployment': ['microservice', 'API', 'application.yml'],
  'microservice-principles': ['microservice', 'service boundary', 'independently deployable'],
  'ddd-basics': ['service boundary', 'requirement'],
  'ddd-services': ['bounded context', 'aggregate', 'repository'],
  'microservice-system-design': ['microservice', 'API Gateway', 'synchronous', 'asynchronous'],
  'devops-basics': ['testing', 'logging', 'deployment'],
  'ci-basics': ['unit test', 'Maven lifecycle', 'deployment'],
  'cd-basics': ['CI', 'deployment', 'environment variable'],
  'maven-artifact': ['Maven', 'dependency', 'deployment'],
  'docker-basics': ['application.yml', 'deployment', 'independently deployable'],
  'kubernetes-basics': ['Docker image', 'health', 'deployment'],
  'pipeline-as-code': ['CI', 'Continuous Delivery', 'artifact'],
  'cicd-secrets-config': ['configuration', 'environment variable', 'Docker image'],
  'deployment-rollback': ['health', 'deployment', 'artifact'],
  'cicd-interview': ['CI', 'Continuous Delivery', 'Docker image', 'rollback'],
  'react-basics': ['API', 'request', 'response'],
  'python-basics': ['List<T>', 'Map'],
  'enterprise-quality-compliance': ['testing', 'logging', 'CI'],
  'stakeholder-collaboration': ['requirement', 'test scenario'],
  'delivery-prioritization': ['requirement', 'risk'],
  'existing-app-support': ['logging', 'testing', 'backward compatibility'],
  'technology-evaluation': ['trade-off', 'requirement'],
  'behavioral-star': ['troubleshooting', 'collaboration'],
}

const supplementalTerms = {
  beans: [
    ['bean', 'Spring container tarafından oluşturulan veya kaydedilen ve yaşam döngüsü yönetilen object.'],
    ['singleton', 'Varsayılan bean scope; application context başına tek bean instance kullanılır.'],
    ['@Bean', 'Bir method’un döndürdüğü object’i Spring container’a bean olarak kaydeder.'],
    ['@Configuration', 'Bean tanımlarını barındıran configuration class’ını işaretler.'],
  ],
  'ioc-di': [
    ['dependency', 'Bir class’ın işini yapmak için ihtiyaç duyduğu başka object veya bileşen.'],
    ['Dependency Injection', 'Dependency’nin class içinde oluşturulması yerine dışarıdan verilmesi.'],
    ['constructor injection', 'Dependency’leri constructor üzerinden alma yöntemi.'],
    ['IoC', 'Object oluşturma ve bağımlılık bağlama kontrolünün framework/container tarafından yönetilmesi.'],
  ],
  'request-flow': [
    ['DispatcherServlet', 'Spring MVC’de gelen HTTP request için merkezi giriş ve yönlendirme noktası.'],
    ['Controller', 'HTTP request’i karşılayan ve use-case’e bağlayan sınır katmanı.'],
    ['Service', 'Use-case ve business rule’ların yürütüldüğü katman.'],
    ['Repository', 'Kalıcı veriye erişimi soyutlayan katman.'],
  ],
  'api-design': [
    ['2xx', 'Request’in başarıyla işlendiğini anlatan HTTP status ailesi.'],
    ['4xx', 'Client taraflı request veya yetki problemi olduğunu anlatan HTTP status ailesi.'],
    ['5xx', 'Server tarafında beklenmeyen hata olduğunu anlatan HTTP status ailesi.'],
    ['idempotent', 'Aynı request birden fazla kez uygulandığında beklenen son durumun değişmemesi özelliği.'],
  ],
  'jpa-basics': [
    ['JPA', 'Java’da relational persistence için tanımlanmış specification/API sözleşmesi.'],
    ['Hibernate', 'JPA’yı uygulayabilen yaygın ORM framework’ü.'],
    ['@Entity', 'Bir class’ı JPA persistence modeli olarak işaretler.'],
    ['@Id', 'Entity’nin primary key alanını işaretler.'],
  ],
  repository: [
    ['JpaRepository', 'CRUD, pagination ve sorting gibi hazır repository davranışları sağlayan Spring Data interface’i.'],
    ['derived query', 'Method adından query türetilmesi yaklaşımı.'],
    ['CRUD', 'Create, read, update ve delete temel veri işlemleri.'],
    ['repository interface', 'Veri erişimi için davranış sözleşmesi tanımlayan interface.'],
  ],
  relations: [
    ['@OneToMany', 'Bir entity’nin birden fazla ilişkili entity ile ilişkisini tanımlar.'],
    ['mappedBy', 'İlişkinin hangi karşı alan tarafından sahiplenildiğini belirtir.'],
    ['LAZY', 'İlişkili verinin ihtiyaç anına kadar yüklenmemesini hedefleyen fetch stratejisi.'],
    ['cascade', 'Parent işleminde hangi persistence işlemlerinin child entity’lere yayılacağını belirler.'],
  ],
  transactions: [
    ['transaction', 'Birden fazla DB adımını tek tutarlı işlem sınırında yürütür.'],
    ['@Transactional', 'Method/class için transaction sınırı oluşturulmasını Spring’e bildirir.'],
    ['rollback', 'Başarısız işlemde transaction içindeki değişikliklerin geri alınması.'],
    ['atomicity', 'Transaction içindeki işin ya tamamen gerçekleşmesi ya da hiç gerçekleşmemesi özelliği.'],
  ],
  pagination: [
    ['Page<T>', 'Sonuçlarla birlikte sayfa numarası ve toplam kayıt gibi metadata taşıyan Spring Data tipi.'],
    ['Pageable', 'İstenen sayfa, boyut ve sıralama bilgisini taşıyan parametre tipi.'],
    ['N+1', 'Bir ana query ardından her kayıt için ek query üretilmesiyle oluşan performans problemi.'],
    ['sort', 'Sonuçların belirli alanlara göre sıralanması.'],
  ],
  exceptions: [
    ['exception', 'Normal akışı bozan hata/istisna durumunu temsil eden Java mekanizması.'],
    ['@RestControllerAdvice', 'Controller’lar için ortak exception handling katmanı tanımlar.'],
    ['@ExceptionHandler', 'Belirli exception oluştuğunda çalışacak handler method’unu seçer.'],
    ['ApiError', 'Client’a standart hata bilgisi taşımak için kullanılan response modeli.'],
  ],
  config: [
    ['configuration', 'Uygulama davranışını ortama göre ayarlayan dış değerler.'],
    ['environment variable', 'Config veya secret değerini process ortamından sağlayan değişken.'],
    ['@ConfigurationProperties', 'Config değerlerini type-safe Java object’ine bağlar.'],
    ['profile', 'Farklı çalışma ortamları için ayrı Spring configuration seçimi.'],
  ],
  logging: [
    ['log level', 'Log kaydının önem/seviye sınıfı; ör. INFO, WARN, ERROR.'],
    ['Logger', 'Uygulama içinden log kaydı üretmek için kullanılan API.'],
    ['structured log', 'Alanları ayrıştırılabilir biçimde tutan makine dostu log yaklaşımı.'],
    ['placeholder', 'Log mesajında değerin sonradan bağlanacağı {} gibi yer tutucu.'],
  ],
  security: [
    ['authentication', 'Kullanıcının kim olduğunu doğrulama süreci.'],
    ['authorization', 'Doğrulanmış kullanıcının hangi işlemleri yapabileceğini belirleme süreci.'],
    ['SecurityFilterChain', 'HTTP güvenlik kurallarını filtre zinciri olarak tanımlayan Spring Security tipi.'],
    ['requestMatchers', 'Belirli path/request gruplarına güvenlik kuralı uygulamak için kullanılan matcher API’si.'],
  ],
  testing: [
    ['unit test', 'Tek bir sınıf veya davranışı dış bağımlılıkları izole ederek test eder.'],
    ['slice test', 'Spring uygulamasının yalnızca belirli katmanını/context parçasını açarak test eder.'],
    ['integration test', 'Birden fazla gerçek bileşenin birlikte çalışmasını doğrular.'],
    ['MockMvc', 'Gerçek network portu açmadan Spring MVC request/response akışını test etmeyi sağlar.'],
  ],
  actuator: [
    ['Actuator', 'Spring Boot uygulamasının health, metrics ve operasyon bilgilerini sunan modülü.'],
    ['health', 'Uygulamanın çalışabilirlik durumunu raporlayan Actuator endpoint’i.'],
    ['metrics', 'Uygulama ölçümlerini sunan operasyon verileri.'],
    ['exposure', 'Hangi Actuator endpoint’lerinin web üzerinden açılacağını belirleyen ayar.'],
  ],
  migrations: [
    ['migration', 'DB schema değişikliğini versiyonlu ve tekrar üretilebilir biçimde tanımlayan adım.'],
    ['Flyway', 'Versiyonlu SQL migration dosyalarını çalıştıran migration aracı.'],
    ['schema', 'Database tablo, kolon ve constraint yapısının tanımı.'],
    ['ALTER TABLE', 'Mevcut SQL tablosunun yapısını değiştiren komut.'],
  ],
  cache: [
    ['cache', 'Tekrar istenen veriyi daha hızlı döndürmek için geçici saklama katmanı.'],
    ['@Cacheable', 'Method sonucunun cache üzerinden okunup yazılmasını Spring’e bildirir.'],
    ['cache key', 'Cache içindeki kaydı benzersiz seçen anahtar.'],
    ['cache miss', 'İstenen key cache’te bulunmadığında asıl veri kaynağına gidilmesi durumu.'],
  ],
  async: [
    ['@Async', 'Uygun proxy/executor ile method’un çağıran thread’den ayrı çalışabilmesini sağlar.'],
    ['CompletableFuture<T>', 'Asenkron işin gelecekte tamamlanacak sonucunu temsil eden Java tipi.'],
    ['@Scheduled', 'Method’un zaman planına göre otomatik tetiklenmesini sağlar.'],
    ['cron', 'Tekrarlayan zaman planını ifade eden schedule sözdizimi.'],
  ],
}

const conceptClarifiers = {
  entity: {
    use: 'Bu derste ResponseEntity adının içindeki “entity” parçasını anlamak için kullanılıyor.',
    example: 'ResponseEntity<String>',
    confuse: 'JPA dersindeki @Entity başka görev taşır: bir class’ı kalıcı veri modeli olarak işaretler.',
  },
  responseentity: {
    use: 'Controller’ın döndürdüğü HTTP cevabının status, header ve body parçalarını açıkça kurar.',
    example: 'ResponseEntity.status(201).body("Ürün oluşturuldu")',
    confuse: 'ResponseEntity içindeki “Entity”, JPA @Entity annotation’ı anlamına gelmez.',
  },
  generic: {
    use: '<T>, yapının hangi Java tipini taşıdığını söyler. ResponseEntity<String> içindeki String bunun örneği.',
    example: 'ResponseEntity<String>',
    confuse: 'Generic yeni object oluşturmaz; tip bilgisini parametreleştirir.',
  },
  resource: {
    use: 'REST API’nin üzerinde işlem yaptığı şeyi adlandırır. Product, user veya order bir resource olabilir.',
    example: 'GET /products/42',
    confuse: 'Resource sadece URL değildir; URL/path resource’a ulaşmanın adresidir.',
  },
  request: {
    use: 'Client’ın server’a gönderdiği HTTP mesajıdır.',
    example: 'GET /products HTTP/1.1',
    confuse: 'Request client’tan server’a gider; response ters yönde döner.',
  },
  response: {
    use: 'Server’ın işlediği request sonucunda client’a döndürdüğü HTTP mesajıdır.',
    example: 'HTTP/1.1 200 OK',
    confuse: 'Response yalnızca body değildir; status ve header da response’un parçasıdır.',
  },
  endpoint: {
    use: 'Belirli HTTP method + path birleşimiyle çağrılan API davranışıdır.',
    example: 'POST /products',
    confuse: 'Tek başına /products yazmak endpoint’i tam tanımlamaz; HTTP method da gerekir.',
  },
  dto: {
    use: 'API sınırında hangi verinin girip çıkacağını kontrollü bir Java tipiyle tanımlar.',
    example: 'record ProductDto(Long id, String name) {}',
    confuse: 'DTO ile database entity’si aynı model olmak zorunda değildir.',
  },
  dependency: {
    use: 'Bir class’ın işini yapabilmek için ihtiyaç duyduğu başka object veya modüldür.',
    example: 'OrderService(PaymentClient paymentClient)',
    confuse: 'Dependency Injection dependency’nin kendisi değil; dependency’nin dışarıdan verilme yöntemidir.',
  },
  annotation: {
    use: '@ ile başlayan metadata işaretidir. Framework veya compiler bu bilgiyi okuyabilir.',
    example: '@Service',
    confuse: 'Annotation tek başına object oluşturmaz.',
  },
  bean: {
    use: 'Spring container’ın oluşturduğu veya kaydettiği ve yaşam döngüsünü yönettiği object’tir.',
    example: '@Bean Clock clock() { ... }',
    confuse: 'Her Java object’i Spring bean’i değildir.',
  },
  interface: {
    use: 'Bir tipin hangi davranışları sunacağını sözleşme olarak tanımlar; çağıran kodun concrete implementation’a bağımlılığını azaltır.',
    example: 'interface PaymentService { boolean pay(double amount); }',
    confuse: 'Abstract class ortak state ve constructor taşıyabilir; interface öncelikle capability/sözleşme sınırıdır.',
  },
  'abstract class': {
    use: 'Ortak state veya davranışı alt class’larla paylaşırken doğrudan instantiate edilmeyen üst tip kurar.',
    example: 'abstract class Payment { abstract boolean pay(); }',
    confuse: 'Interface ile aynı şey değildir; Java’da bir class yalnız bir class extend edebilir.',
  },
  overloading: {
    use: 'Aynı method adını farklı parameter listeleriyle compile-time’da ayırt edilen çağrılar halinde tanımlar.',
    example: 'total(int,int) / total(int,int,int)',
    confuse: 'Overriding, child class’ın aynı signature’daki üst tip davranışını runtime polymorphism için yeniden uygulamasıdır.',
  },
  overriding: {
    use: 'Alt tipin üst tipteki uygun method davranışını aynı signature ile yeniden uygulamasını sağlar.',
    example: '@Override void sound() { ... }',
    confuse: 'Overloading aynı isim + farklı parameter listesidir; overriding aynı sözleşmeyi yeniden uygular.',
  },
  jpa: {
    use: 'Java persistence için API/specification sözleşmesini tanımlar.',
    example: '@Entity class Product { ... }',
    confuse: 'Hibernate JPA’nın kendisi değil; JPA sözleşmesini uygulayabilen ORM framework’lerinden biridir.',
  },
  hibernate: {
    use: 'Object-relational mapping ve persistence davranışını sağlayan, JPA’yı uygulayabilen yaygın framework’tür.',
    example: 'spring.jpa.hibernate.ddl-auto=validate',
    confuse: 'JPA specification’dır; Hibernate implementation’dır.',
  },
  authentication: {
    use: 'Request’i yapan kişinin/istemcinin kimliğini doğrular.',
    example: 'Bearer token -> authenticated principal',
    confuse: 'Authorization kim olduğunu değil, doğrulanmış kimliğin ne yapmaya yetkili olduğunu belirler.',
  },
  authorization: {
    use: 'Doğrulanmış kimliğin belirli resource veya aksiyona erişip erişemeyeceğini kontrol eder.',
    example: 'ADMIN role required -> 403 when missing',
    confuse: 'Authentication kimliği doğrular; authorization izin kararını verir.',
  },
  synchronous: {
    use: 'Çağıran tarafın uzak işlemin sonucunu beklediği iletişim modelidir.',
    example: 'Order -> HTTP Payment -> response',
    confuse: 'Asynchronous messaging’de producer karşı servisin anlık cevabını beklemek zorunda değildir.',
  },
  asynchronous: {
    use: 'Gönderen ile tüketiciyi zaman açısından ayırır; mesaj daha sonra işlenebilir.',
    example: 'OrderCreated -> Broker -> Payment Consumer',
    confuse: 'Asenkron olmak otomatik olarak güvenilir demek değildir; retry, idempotency ve delivery semantics ayrıca tasarlanır.',
  },
  monolith: {
    use: 'Birden fazla modülün tek application/deploy birimi içinde birlikte çalıştığı mimari biçimdir.',
    example: 'catalog + order + payment -> commerce-app.jar',
    confuse: 'Monolith kötü mimari demek değildir; microservice de otomatik olarak daha ölçeklenebilir veya daha doğru değildir.',
  },
  microservice: {
    use: 'Net business responsibility, process/deploy sınırı ve mümkün olduğunca kendi ownership’i olan bağımsız servis birimidir.',
    example: 'Payment Service :8082',
    confuse: 'Küçük class veya her entity için ayrı servis açmak microservice tasarımı değildir.',
  },
  ci: {
    use: 'Kod değişikliklerini sık birleştirip otomatik build/test ile hızlı doğrulama döngüsü kurar.',
    example: 'push -> build -> test -> quality gate',
    confuse: 'CD productiona taşımayı/release sürecini kapsar; CI’nin ana odağı entegrasyon ve erken doğrulamadır.',
  },
  'continuous delivery': {
    use: 'Doğrulanmış sürümü productiona hazır tutar; production yayını için manuel onay bırakabilir.',
    example: 'build -> test -> staging -> approval -> production',
    confuse: 'Continuous Deployment’da gerekli kontroller geçince production yayını da otomatik olabilir.',
  },
  'continuous deployment': {
    use: 'Kalite kapılarını geçen değişikliği productiona otomatik yayınlayan release yaklaşımıdır.',
    example: 'main -> gates pass -> production deploy',
    confuse: 'Continuous Delivery productiona hazır sürüm üretir ama son production adımı manuel kalabilir.',
  },
  'docker image': {
    use: 'Uygulama ve runtime bağımlılıklarını sürümlenebilir, değişmez paket olarak taşır.',
    example: 'shop/order:1.4.2',
    confuse: 'Container image’ın çalışan instance’ıdır; image çalışmaz, container process çalıştırır.',
  },
  'bounded context': {
    use: 'Bir domain modelindeki terimlerin ve kuralların geçerli olduğu açık anlam sınırını tanımlar.',
    example: 'Order Context / Payment Context',
    confuse: 'Bounded Context ile microservice birebir eşleşmek zorunda değildir; servis sınırı için güçlü bir adaydır.',
  },
  repository: {
    use: 'Domain veya application koduna kalıcı veriye erişim için abstraction sağlar.',
    example: 'OrderRepository.save(order)',
    confuse: 'DDD repository aggregate odaklı bir domain abstraction’ı olabilir; Spring Data JpaRepository bunun teknik implementation yollarından biridir.',
  },
  'persistence context': {
    use: 'JPA provider’ın managed entity’leri takip ettiği çalışma alanıdır; identity ve dirty checking gibi davranışların merkezidir.',
    example: 'entityManager.persist(product)',
    confuse: 'Persistence context database’in kendisi değildir; application tarafındaki entity lifecycle takibidir.',
  },
  'dirty checking': {
    use: 'Managed entity state değiştiğinde JPA provider’ın farkı algılayıp flush/commit sırasında gerekli UPDATE’i üretmesini sağlar.',
    example: 'product.setPrice(new BigDecimal("1600"))',
    confuse: 'Her Java object değişikliği dirty checking değildir; entity managed durumda olmalıdır.',
  },
  'n+1': {
    use: 'Bir ana query’den sonra N sonuç için N ek ilişki query’si çalışmasıyla toplam query sayısının büyümesidir.',
    example: '1 order query + 20 customer query',
    confuse: 'Pagination kayıt sayısını sınırlar ama N+1 problemini tek başına çözmez.',
  },
  proxy: {
    use: 'Gerçek bean çağrısını saran temsilci object üzerinden transaction, logging gibi cross-cutting davranışların araya girmesini sağlar.',
    example: 'caller -> Spring proxy -> OrderService',
    confuse: 'Method üzerindeki annotation tek başına her çağrıyı intercept etmez; proxy tabanlı davranışta çağrı yolunun proxy’den geçmesi gerekir.',
  },
  aop: {
    use: 'Transaction, logging veya metrics gibi birden fazla yerde kesişen davranışı business method çağrılarına uygulama yaklaşımıdır.',
    example: '@Transactional public void saveOrder()',
    confuse: 'AOP business rule saklama yeri değildir; cross-cutting concern için uygundur.',
  },
  saga: {
    use: 'Dağıtık business workflow’u ayrı local transaction’lara ve failure halinde compensation adımlarına böler.',
    example: 'Charge -> Reserve fail -> Refund -> Cancel',
    confuse: 'Saga klasik database rollback değildir; daha önce tamamlanmış business etkilerini yeni işlemlerle telafi eder.',
  },
  idempotency: {
    use: 'Aynı request veya mesaj tekrar işlense bile ikinci istenmeyen yan etkinin oluşmamasını hedefler.',
    example: 'paymentId=42 tekrar geldi -> ikinci charge yok',
    confuse: 'Idempotency duplicate delivery ihtimalini yönetir; mesajın hiç kaybolmamasını tek başına garanti etmez.',
  },
  'circuit breaker': {
    use: 'Sürekli hata veren veya çok yavaş dependency’ye çağrıları geçici kesip fail-fast davranarak cascading failure riskini azaltır.',
    example: 'Payment DOWN -> breaker OPEN -> çağrı gönderme',
    confuse: 'Circuit breaker retry değildir; retry tekrar dener, breaker belirli koşulda çağrıyı bir süre keser.',
  },
  readiness: {
    use: 'Bir application instance’ının şu anda trafik almaya hazır olup olmadığını bildirir.',
    example: 'readiness fail -> Service endpoint listesinden çıkar',
    confuse: 'Liveness process’in yeniden başlatılması gerekip gerekmediğini, readiness ise trafiğe uygunluğu hedefler.',
  },
  liveness: {
    use: 'Process kilitlenmiş veya sağlıksız kaldığında restart kararına yardımcı olan health sinyalidir.',
    example: 'liveness fail -> container restart',
    confuse: 'Readiness başarısızlığı her zaman restart demek değildir; instance yalnızca trafik dışına alınabilir.',
  },
  'service discovery': {
    use: 'Çalışan service instance adreslerini dinamik bulma problemine çözüm sağlar.',
    example: 'payment-service -> P1, P2, P3',
    confuse: 'Load balancing bulunan instance’lar arasından trafik hedefi seçer; discovery adresleri bulur.',
  },
  'load balancing': {
    use: 'Trafiği birden fazla sağlıklı instance arasında dağıtır.',
    example: '100 request -> P1/P2/P3',
    confuse: 'API Gateway ile aynı şey değildir; gateway dış giriş/routing görevi üstlenebilir, load balancing instance seçimine odaklanır.',
  },
  'application service': {
    use: 'Use-case akışını, transaction sınırını ve repository/dış dependency koordinasyonunu yönetir.',
    example: 'TransferApplicationService.transfer(...)',
    confuse: 'Application Service ile Domain Service aynı şey değildir; domain kuralı uygun olduğunda domain model veya Domain Service içinde kalır.',
  },
  'domain service': {
    use: 'Tek bir Entity veya Value Object’e doğal oturmayan gerçek domain davranışını taşır.',
    example: 'TransferDomainService.canTransfer(...)',
    confuse: 'Her utility/helper class Domain Service değildir; davranış gerçekten domain diline ait olmalıdır.',
  },
}

const glossary = lessons.flatMap((lesson) => getLessonTerms(lesson).map(([term, meaning]) => ({
  term,
  meaning,
  lessonId: lesson.id,
  lessonTitle: lesson.title,
})))

export function normalizeConcept(value) {
  return String(value)
    .replace(/`/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLocaleLowerCase('tr-TR')
}

export function getLessonTerms(lesson) {
  const items = [...(lesson.terms ?? []), ...(supplementalTerms[lesson.id] ?? [])]
  return items.filter(([term], index) => items.findIndex(([other]) => normalizeConcept(other) === normalizeConcept(term)) === index)
}

function findConcept(label, lesson) {
  const key = normalizeConcept(label)
  const local = getLessonTerms(lesson).find(([term]) => normalizeConcept(term) === key)
  if (local) return { term: local[0], meaning: local[1], lessonId: lesson.id, lessonTitle: lesson.title }
  return glossary.find((item) => normalizeConcept(item.term) === key) ?? null
}

function findPriorConcept(label, lesson) {
  const key = normalizeConcept(label)
  const lessonIndex = lessons.findIndex((item) => item.id === lesson.id)
  return glossary.find((item) => {
    if (normalizeConcept(item.term) !== key) return false
    const sourceIndex = lessons.findIndex((source) => source.id === item.lessonId)
    return sourceIndex >= 0 && sourceIndex < lessonIndex
  }) ?? null
}

export function getPrerequisites(lesson) {
  return (prerequisiteMap[lesson.id] ?? [])
    .map((label) => findPriorConcept(label, lesson))
    .filter(Boolean)
}

export function conceptAliases(label) {
  const withoutGeneric = String(label).replace(/<[^>]*>/g, '')
  return withoutGeneric
    .split('/')
    .map((item) => item.trim())
    .filter((item) => item.length >= 3 && !item.includes(' '))
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getConceptDetail(concept, lesson) {
  const key = normalizeConcept(concept.term)
  const clarifier = conceptClarifiers[key]
  const aliases = conceptAliases(concept.term).map((item) => normalizeConcept(item))
  const note = lesson.codeNotes?.find(([fragment]) => {
    const normalizedFragment = normalizeConcept(fragment)
    return aliases.some((alias) => normalizedFragment.includes(alias))
  })

  return {
    ...concept,
    use: clarifier?.use ?? note?.[1] ?? `Bu kavram ${lesson.title} dersindeki kodu ve davranışı anlamak için kullanılıyor.`,
    example: clarifier?.example ?? note?.[0] ?? concept.term,
    confuse: clarifier?.confuse,
  }
}
