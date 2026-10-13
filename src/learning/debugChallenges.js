// Each case describes a concrete failure, its root cause, and a specific repair.
// Answers are checked against authored options. No Java code is executed.
export const debugChallenges = {
  'java-memory-equality': {
    title: 'Aynı yazı, farklı sonuç',
    symptom: 'İçerikleri aynı iki farklı String nesnesi karşılaştırıldığında sonuç false oluyor.',
    broken: 'String stored = new String("java");\nString input = new String("java");\nboolean matched = stored == input;',
    diagnosis: ['String referansları == ile karşılaştırılıyor.', 'String nesneleri her zaman immutable değildir.', 'Java String tipinde == hiç kullanılamaz.'],
    diagnosisAnswer: 0,
    fixes: ['boolean matched = stored.equals(input);', 'boolean matched = stored == input.intern();', 'boolean matched = stored.hashCode() == input.hashCode();'],
    fixAnswer: 0,
    hint: '== hangi durumda referans eşitliğine bakar? İçerik eşitliğini hangi method sağlar?',
    explanation: '== iki String referansının aynı nesneyi gösterip göstermediğine bakar. equals içerik eşitliğini sınar. Nullable değişkenler için sabit.equals(variable) veya Objects.equals(a,b) düşün.',
  },
  'java-exceptions': {
    title: 'Sessizce kaybolan sipariş',
    symptom: 'Veritabanına yazma başarısız olsa da istemci 200 alıyor; hata logları görünmüyor.',
    broken: 'void submit(Order order) {\n  try { repository.save(order); }\n  catch (Exception e) { /* ignore */ }\n}',
    diagnosis: ['try bloğunun kapsamı çok dar.', 'Exception yutulduğu için çağıran taraf başarısızlığı öğrenemiyor.', 'save() hiçbir zaman exception fırlatmaz.'],
    diagnosisAnswer: 1,
    fixes: ['catch (Exception e) { return; }', 'catch (Exception e) { throw new OrderSaveException("Kayıt başarısız", e); }', 'catch (Exception e) { System.out.println("OK"); }'],
    fixAnswer: 1,
    hint: 'Hata yakalanınca üst katman neden işlemin başarılı olduğunu sanıyor?',
    explanation: 'Boş catch bloğu failure bilgisini kaybettirir. Anlamlı exception ile üst katmana taşı ve global handler’da uygun HTTP cevabına çevir. Transaction davranışını ayrıca değerlendir.',
  },
  'java-concurrency': {
    title: '1000 istek, eksik sayaç',
    symptom: 'Paralel isteklerden sonra counter beklenenden küçük kalıyor.',
    broken: 'class Counter {\n  private int count = 0;\n  void increment() { count++; }\n}',
    diagnosis: ['count++ atomik bir işlem değildir.', 'int değeri heap üzerinde bulunamaz.', 'Tek thread kullanmak her zaman deadlock yaratır.'],
    diagnosisAnswer: 0,
    fixes: ['private volatile int count = 0;', 'private final AtomicInteger count = new AtomicInteger();\nvoid increment() { count.incrementAndGet(); }', 'void increment() { count += 0; }'],
    fixAnswer: 1,
    hint: 'count++ bir okuma, artırma ve yazma içerir. volatile bu üç adımı atomik yapar mı?',
    explanation: 'AtomicInteger artışı atomik yapar. volatile görünürlük sağlar fakat count++ işlemini atomik hale getirmez. Gerçek veritabanı stok güncellemesi ayrıca transaction/locking ister.',
  },
  'ioc-di': {
    title: 'Mock hiç devreye girmiyor',
    symptom: 'Spring testinde PaymentClient mock bean tanımlanmış ancak gerçek ödeme istemcisi çağrılıyor.',
    broken: '@Service\nclass OrderService {\n  private final PaymentClient client = new PaymentClient();\n}',
    diagnosis: ['OrderService dependency nesnesini kendisi new ile oluşturuyor.', '@Service annotation Java sınıfı oluşturmaz.', 'final alanlar Spring tarafından hiç inject edilemez.'],
    diagnosisAnswer: 0,
    fixes: ['private PaymentClient client = new PaymentClient();', 'OrderService(PaymentClient client) { this.client = client; }', '@Autowired private final PaymentClient client = null;'],
    fixAnswer: 1,
    hint: 'Testte dependency değiştirmek için OrderService bunu dışarıdan nasıl almalı?',
    explanation: 'Constructor injection bağımlılığı açık hale getirir. Spring yönetimindeki nesnede container uygun bean sağlar; unit testte fake/mock verilebilir. PaymentClient kendisi de bean olmalıdır.',
  },
  'validation': {
    title: 'Boş isim sisteme geçiyor',
    symptom: 'Request DTO üzerinde @NotBlank var; yine de boş isim Controller’dan geçiyor.',
    broken: 'record CreateUser(@NotBlank String name) {}\n@PostMapping("/users")\nResponseEntity<?> create(@RequestBody CreateUser request) { ... }',
    diagnosis: ['@NotBlank sadece entity alanlarına yazılabilir.', 'Request body üzerinde Bean Validation tetiklenmiyor.', '@PostMapping validation ile uyumsuzdur.'],
    diagnosisAnswer: 1,
    fixes: ['create(@Valid @RequestBody CreateUser request)', 'create(@RequestParam CreateUser request)', 'create(@NotNull @RequestBody CreateUser request)'],
    fixAnswer: 0,
    hint: 'DTO constraint tanımı var. Spring MVC bunu hangi annotation ile çalıştırmalı?',
    explanation: '@Valid, request body üzerinde Bean Validation çalıştırır. Ayrıca Jakarta Validation provider dependency gerekir. Geçersiz veri için anlamlı 400 cevabını exception handler ile düzenle.',
  },
  'transactions': {
    title: 'Rollback neden çalışmıyor?',
    symptom: 'Aynı sınıf içindeki çağrıdan sonra beklenen @Transactional davranışı oluşmuyor.',
    broken: '@Service\nclass OrderService {\n  void place() { reserve(); }\n  @Transactional void reserve() { ... }\n}',
    diagnosis: ['Aynı nesne içi çağrı, Spring proxy üzerinden geçmiyor.', '@Transactional sadece Controller içinde geçerlidir.', 'Transactional method mutlaka static olmalıdır.'],
    diagnosisAnswer: 0,
    fixes: ['reserve() üzerine ikinci @Transactional eklemek', 'Transaction sınırını dışarıdan proxy üzerinden çağrılan public service method’una taşımak', 'reserve() method’unu private yapmak'],
    fixAnswer: 1,
    hint: 'Proxy tabanlı Spring AOP aynı sınıftaki this.method() çağrısını kesebilir mi?',
    explanation: 'Varsayılan proxy tabanlı transaction yönetiminde self-invocation interception dışı kalır. Transaction sınırını public dış girişe veya ayrı bir bean’e taşı. Proxy türü ve rollback kuralları önemlidir.',
  },
  'jpa-basics': {
    title: 'Liste ekranında 101 SQL sorgusu',
    symptom: '100 siparişin müşteri adı gösterilirken 1 yerine 101 sorgu çalışıyor.',
    broken: 'List<Order> orders = orderRepository.findAll();\nfor (Order order : orders) {\n  print(order.getCustomer().getName());\n}',
    diagnosis: ['Lazy ilişkiler döngü içinde tek tek sorgulanarak N+1 oluşuyor.', 'JPA koleksiyonları hiçbir zaman foreach ile gezilemez.', 'İlk sorgu yalnızca primary key okuyor.'],
    diagnosisAnswer: 0,
    fixes: ['@Transactional ekleyip aynı sorguyu korumak', 'Bu liste ihtiyacına özel JOIN FETCH / @EntityGraph veya DTO projection kullanmak', 'Her order için repository.findById() çağırmak'],
    fixAnswer: 1,
    hint: 'İlişkiler ihtiyaç anında her nesne için ayrı sorgu atıyorsa fetch planını nerede tanımlarsın?',
    explanation: 'N+1 sorununu ilgili okuma senaryosuna özgü fetch join, entity graph veya DTO projection ile çöz. Tek query her zaman en iyi sonuç değildir; pagination ve çoklu collection join risklerini ölç.',
  },
  'rest': {
    title: 'Eksik kaynak, başarılı yanıt',
    symptom: 'GET /users/42 mevcut olmayan kullanıcı için HTTP 200 ve null dönüyor.',
    broken: '@GetMapping("/{id}")\nUserDto get(@PathVariable Long id) {\n  return service.find(id).orElse(null);\n}',
    diagnosis: ['HTTP kaynak yok durumunu açıkça yansıtmıyor.', 'GET method’u ResponseEntity döndüremez.', '@PathVariable yalnız String kabul eder.'],
    diagnosisAnswer: 0,
    fixes: ['return ResponseEntity.notFound().build(); // bulunamadığında', 'return ResponseEntity.ok(null);', 'return ResponseEntity.status(500).build();'],
    fixAnswer: 0,
    hint: 'Kaynak bulunamadığında HTTP hangi status kodunu kullanır?',
    explanation: 'Kaynak yoksa 404 döndür. Controller’da ResponseEntity veya @ResponseStatus taşıyan domain exception/global handler kullanılabilir. Başarılı istekte 200 + DTO uygundur.',
  },
}

export function getDebugChallenge(lesson) {
  return lesson ? debugChallenges[lesson.id] ?? null : null
}

export function evaluateDebugChoice(challenge, stage, selectedIndex) {
  if (!challenge || !['diagnosis', 'fix'].includes(stage)) return false
  const key = stage === 'diagnosis' ? 'diagnosisAnswer' : 'fixAnswer'
  const options = stage === 'diagnosis' ? challenge.diagnosis : challenge.fixes
  return Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < options.length && selectedIndex === challenge[key]
}
