// Spring alıştırmaları tam düzenlenebilir Java örnekleridir.
// Regex kontrolleri yapı ve beklenen API kullanımını tarar; gerçek Spring çalıştırması yapmaz.
export const springCodeChallenges = {
  annotations: {
    prompt: 'GreetingService’i bean yap; GET /hello isteğini service’e yönlendir.',
    editableStarter: true,
    starter: `// TODO: GreetingService için doğru stereotype annotation'ı ekle
class GreetingService {
  String greet() { return "Merhaba"; }
}

// TODO: HTTP isteğini karşılayan controller annotation'ını ekle
class GreetingController {
  private final GreetingService greetings;
  GreetingController(GreetingService greetings) { this.greetings = greetings; }

  // TODO: GET /hello mapping'i ekle
  String hello() {
    // TODO: greetings.greet() sonucunu döndür
  }
}`,
    solution: `@Service
class GreetingService {
  String greet() { return "Merhaba"; }
}

@RestController
class GreetingController {
  private final GreetingService greetings;
  GreetingController(GreetingService greetings) { this.greetings = greetings; }

  @GetMapping("/hello")
  String hello() {
    return greetings.greet();
  }
}`,
    requirements: [
      ['Service bean', /@Service\s+class\s+GreetingService/],
      ['HTTP controller', /@RestController\s+class\s+GreetingController/],
      ['GET /hello mapping', /@GetMapping\s*\(\s*"\/hello"\s*\)\s+String\s+hello\s*\(/],
      ['Service sonucunu döndürme', /\breturn\s+greetings\.greet\s*\(\s*\)\s*;/],
    ],
    scopeRules: [
      {
        label: 'GET /hello endpoint GreetingController içinde',
        path: [/\bclass\s+GreetingController\s*\{/],
        patterns: [/@GetMapping\s*\(\s*"\/hello"\s*\)\s+String\s+hello\s*\(/],
      },
      {
        label: 'Service çağrısı GreetingController.hello() içinde',
        path: [/\bclass\s+GreetingController\s*\{/, /\bString\s+hello\s*\(\s*\)\s*\{/],
        patterns: [/\breturn\s+greetings\.greet\s*\(\s*\)\s*;/],
      },
    ],
    hint: '@Service iş katmanındaki sınıfı bean yapar; @RestController HTTP endpoint’i tanımlar; @GetMapping URL ve HTTP yöntemini bağlar.',
    expectedBehavior: 'GET /hello çağrısı GreetingController üzerinden GreetingService.greet() sonucunu HTTP response body olarak döndürür.',
    reviewQuestion: '@Service yerine yalnız @RestController kullansaydın GreetingService’in sorumluluğu nasıl değişirdi?',
    syntaxTemplate: '__ANSWER__',
  },
  beans: {
    prompt: 'Clock için singleton bean, sayaç için prototype bean tanımla.',
    editableStarter: true,
    starter: `import java.time.Clock;

class RequestTracker {
  int count;
  void increment() { count++; }
}

@Configuration
class AppConfig {
  // TODO: @Bean Clock clock() ile Clock.systemUTC() döndür

  // TODO: @Bean ve @Scope("prototype") kullanarak RequestTracker tracker() tanımla
}`,
    solution: `import java.time.Clock;

class RequestTracker {
  int count;
  void increment() { count++; }
}

@Configuration
class AppConfig {
  @Bean
  Clock clock() {
    return Clock.systemUTC();
  }

  @Bean
  @Scope("prototype")
  RequestTracker tracker() {
    return new RequestTracker();
  }
}`,
    requirements: [
      ['Configuration sınıfı', /@Configuration\s+class\s+AppConfig/],
      ['Clock bean fabrikası', /@Bean\s+Clock\s+clock\s*\(\s*\)\s*\{\s*return\s+Clock\.systemUTC\s*\(\s*\)\s*;/],
      ['Prototype scope', /@Scope\s*\(\s*"prototype"\s*\)/],
      ['Yeni tracker döndüren bean', /@Bean\s+@Scope\s*\(\s*"prototype"\s*\)\s+RequestTracker\s+tracker\s*\(\s*\)\s*\{\s*return\s+new\s+RequestTracker\s*\(\s*\)\s*;/],
    ],
    scopeRules: [
      {
        label: 'Bean fabrikaları AppConfig içinde',
        path: [/\bclass\s+AppConfig\s*\{/],
        patterns: [
          /@Bean\s+Clock\s+clock\s*\(\s*\)\s*\{\s*return\s+Clock\.systemUTC\s*\(\s*\)\s*;/,
          /@Bean\s+@Scope\s*\(\s*"prototype"\s*\)\s+RequestTracker\s+tracker\s*\(\s*\)\s*\{\s*return\s+new\s+RequestTracker\s*\(\s*\)\s*;/,
        ],
      },
    ],
    hint: '@Bean method varsayılan olarak singleton scope’tadır. Prototype için her bean isteğinde yeni instance üretilir; singleton’a bir kez inject edilirse her kullanımda yenilenmez.',
    expectedBehavior: 'Container aynı singleton Clock bean’ini yeniden kullanır; RequestTracker istendiğinde yeni instance oluşturur.',
    reviewQuestion: 'Prototype bean bir singleton’ın constructor’ına inject edilirse her HTTP request’te yeni tracker oluşur mu?',
    syntaxTemplate: '__ANSWER__',
  },
  'ioc-di': {
    prompt: 'CheckoutService’e PaymentClient’ı constructor ile ver, negatif tutarı reddet.',
    editableStarter: true,
    starter: `interface PaymentClient {
  boolean charge(int cents);
}

@Service
class CheckoutService {
  // TODO: private final PaymentClient field'ı
  // TODO: PaymentClient alan constructor ve field ataması

  boolean checkout(int cents) {
    // TODO: cents <= 0 ise false döndür
    // TODO: paymentClient.charge(cents) sonucunu döndür
  }
}`,
    solution: `interface PaymentClient {
  boolean charge(int cents);
}

@Service
class CheckoutService {
  private final PaymentClient paymentClient;

  CheckoutService(PaymentClient paymentClient) {
    this.paymentClient = paymentClient;
  }

  boolean checkout(int cents) {
    if (cents <= 0) return false;
    return paymentClient.charge(cents);
  }
}`,
    requirements: [
      ['Abstraction tipinde final field', /\bprivate\s+final\s+PaymentClient\s+paymentClient\s*;/],
      ['Constructor injection', /\bCheckoutService\s*\(\s*PaymentClient\s+paymentClient\s*\)\s*\{\s*this\.paymentClient\s*=\s*paymentClient\s*;/],
      ['Geçersiz tutarı reddetme', /\bif\s*\(\s*cents\s*<=\s*0\s*\)\s*(?:\{\s*)?return\s+false\s*;/],
      ['Inject edilen bağımlılığa delegasyon', /\breturn\s+paymentClient\.charge\s*\(\s*cents\s*\)\s*;/],
    ],
    scopeRules: [
      {
        label: 'Bağımlılık CheckoutService içinde final field',
        path: [/\bclass\s+CheckoutService\s*\{/],
        directMembersOnly: true,
        patterns: [/\bprivate\s+final\s+PaymentClient\s+paymentClient\s*;/],
      },
      {
        label: 'CheckoutService constructor bağımlılığı atıyor',
        path: [/\bclass\s+CheckoutService\s*\{/, /\bCheckoutService\s*\(\s*PaymentClient\s+paymentClient\s*\)\s*\{/],
        patterns: [/\bthis\.paymentClient\s*=\s*paymentClient\s*;/],
      },
      {
        label: 'Geçersiz tutar kontrolü ve ödeme çağrısı checkout() içinde',
        path: [/\bclass\s+CheckoutService\s*\{/, /\bboolean\s+checkout\s*\(\s*int\s+cents\s*\)\s*\{/],
        patterns: [/\bif\s*\(\s*cents\s*<=\s*0\s*\)\s*(?:\{\s*)?return\s+false\s*;[\s\S]*?\breturn\s+paymentClient\.charge\s*\(\s*cents\s*\)\s*;/],
      },
    ],
    hint: 'Dependency’yi CheckoutService içinde new ile yaratma. Constructor parametresiyle verilen interface implementation’ını kullan.',
    expectedBehavior: 'checkout(0) ödeme servisini çağırmadan false verir; checkout(500) PaymentClient.charge(500) sonucunu döndürür.',
    reviewQuestion: 'Unit testte gerçek banka bağlantısı yerine PaymentClient mock’u vermek neden kolay?',
    syntaxTemplate: '__ANSWER__',
  },
  rest: {
    prompt: 'Ürün oluştururken 201 Created, Location header ve response body döndür.',
    editableStarter: true,
    starter: `import java.net.URI;

record CreateProductRequest(String name) {}
record ProductResponse(Long id, String name) {}
interface ProductService { ProductResponse create(CreateProductRequest request); }

@RestController
class ProductController {
  private final ProductService service;
  ProductController(ProductService service) { this.service = service; }

  // TODO: POST /products mapping'i
  ResponseEntity<ProductResponse> create(@RequestBody CreateProductRequest request) {
    // TODO: service.create(request) sonucunu saved değişkenine ata
    // TODO: ResponseEntity.created ile /products/{saved.id()} Location ve body(saved) döndür
  }
}`,
    solution: `import java.net.URI;

record CreateProductRequest(String name) {}
record ProductResponse(Long id, String name) {}
interface ProductService { ProductResponse create(CreateProductRequest request); }

@RestController
class ProductController {
  private final ProductService service;
  ProductController(ProductService service) { this.service = service; }

  @PostMapping("/products")
  ResponseEntity<ProductResponse> create(@RequestBody CreateProductRequest request) {
    ProductResponse saved = service.create(request);
    return ResponseEntity.created(URI.create("/products/" + saved.id())).body(saved);
  }
}`,
    requirements: [
      ['POST endpoint', /@PostMapping\s*\(\s*"\/products"\s*\)/],
      ['Request body bind', /@RequestBody\s+CreateProductRequest\s+request/],
      ['Service ile kayıt', /\bProductResponse\s+saved\s*=\s*service\.create\s*\(\s*request\s*\)\s*;/],
      ['201 ve doğru Location', /\breturn\s+ResponseEntity\.created\s*\(\s*URI\.create\s*\(\s*"\/products\/"\s*\+\s*saved\.id\s*\(\s*\)\s*\)\s*\)/],
      ['Oluşturulan resource body', /\.body\s*\(\s*saved\s*\)\s*;/],
    ],
    scopeRules: [
      {
        label: 'POST /products endpoint ProductController içinde',
        path: [/\bclass\s+ProductController\s*\{/],
        patterns: [/@PostMapping\s*\(\s*"\/products"\s*\)\s+ResponseEntity\s*<\s*ProductResponse\s*>\s+create\s*\(/],
      },
      {
        label: 'Kayıt, 201 Location ve body create() içinde',
        path: [/\bclass\s+ProductController\s*\{/, /\bResponseEntity\s*<\s*ProductResponse\s*>\s+create\s*\([^)]*\)\s*\{/],
        patterns: [
          /\bProductResponse\s+saved\s*=\s*service\.create\s*\(\s*request\s*\)\s*;[\s\S]*?\breturn\s+ResponseEntity\.created\s*\(\s*URI\.create\s*\(\s*"\/products\/"\s*\+\s*saved\.id\s*\(\s*\)\s*\)\s*\)\.body\s*\(\s*saved\s*\)\s*;/,
        ],
      },
    ],
    hint: 'ResponseEntity.created(URI) HTTP 201 ve Location header üretir. URI sonundaki id, service’in oluşturduğu kayıttan gelmeli.',
    expectedBehavior: 'POST /products başarılı olunca 201, Location: /products/{yeniId} ve kaydedilen ürünün JSON body’si döner.',
    reviewQuestion: 'Var olan kaynağın yalnız adını güncelleseydin neden her zaman 201 kullanmazdın?',
    syntaxTemplate: '__ANSWER__',
  },
  'request-inputs': {
    prompt: 'GET isteğinde path/query, POST isteğinde JSON body parametresini bağla.',
    editableStarter: true,
    starter: `record CreateProductRequest(String name) {}

@RestController
class ProductController {
  // TODO: GET /products/{id} mapping'i
  String detail(/* TODO: id path variable, currency query (varsayılan TRY) */) {
    return id + " / " + currency;
  }

  // TODO: POST /products mapping'i ve @RequestBody parametresi
  String create(/* TODO: CreateProductRequest request */) {
    return request.name();
  }
}`,
    solution: `record CreateProductRequest(String name) {}

@RestController
class ProductController {
  @GetMapping("/products/{id}")
  String detail(@PathVariable Long id, @RequestParam(defaultValue = "TRY") String currency) {
    return id + " / " + currency;
  }

  @PostMapping("/products")
  String create(@RequestBody CreateProductRequest request) {
    return request.name();
  }
}`,
    requirements: [
      ['GET mapping ve id path', /@GetMapping\s*\(\s*"\/products\/\{id\}"\s*\)\s+String\s+detail\s*\(\s*@PathVariable\s+Long\s+id/],
      ['Opsiyonel currency query', /@RequestParam\s*\(\s*defaultValue\s*=\s*"TRY"\s*\)\s+String\s+currency/],
      ['POST mapping', /@PostMapping\s*\(\s*"\/products"\s*\)/],
      ['JSON body DTO', /String\s+create\s*\(\s*@RequestBody\s+CreateProductRequest\s+request\s*\)/],
      ['DTO değerine erişim', /\breturn\s+request\.name\s*\(\s*\)\s*;/],
    ],
    scopeRules: [
      {
        label: 'GET ve POST endpointleri ProductController içinde',
        path: [/\bclass\s+ProductController\s*\{/],
        patterns: [
          /@GetMapping\s*\(\s*"\/products\/\{id\}"\s*\)\s+String\s+detail\s*\(/,
          /@PostMapping\s*\(\s*"\/products"\s*\)\s+String\s+create\s*\(/,
        ],
      },
      {
        label: 'Path ve query değerleri detail() içinde kullanılıyor',
        path: [/\bclass\s+ProductController\s*\{/, /\bString\s+detail\s*\([^{}]*\)\s*\{/],
        patterns: [/\breturn\s+id\s*\+\s*" \/ "\s*\+\s*currency\s*;/],
      },
      {
        label: 'Request body create() içinde kullanılıyor',
        path: [/\bclass\s+ProductController\s*\{/, /\bString\s+create\s*\([^)]*\)\s*\{/],
        patterns: [/\breturn\s+request\.name\s*\(\s*\)\s*;/],
      },
    ],
    hint: '@PathVariable URL segmenti, @RequestParam query parametresi, @RequestBody JSON gövdesini temsil eder.',
    expectedBehavior: 'GET /products/5 sonucu "5 / TRY"; GET /products/5?currency=USD sonucu "5 / USD"; POST JSON {"name":"Kalem"} sonucu "Kalem".',
    reviewQuestion: 'GET /products/abc isteğinde Long id dönüştürülemezse isteğe ne olur?',
    syntaxTemplate: '__ANSWER__',
  },
  validation: {
    prompt: 'Kullanıcı kaydında name/email kurallarını tanımla ve @Valid ile çalıştır.',
    editableStarter: true,
    starter: `record CreateUserRequest(
  // TODO: name boş olmasın
  String name,
  // TODO: email boş olmasın ve email biçiminde olsun
  String email
) {}

@RestController
class UserController {
  @PostMapping("/users")
  ResponseEntity<Void> create(/* TODO: DTO validation ve JSON body */ CreateUserRequest request) {
    return ResponseEntity.status(201).build();
  }
}`,
    solution: `record CreateUserRequest(
  @NotBlank String name,
  @NotBlank @Email String email
) {}

@RestController
class UserController {
  @PostMapping("/users")
  ResponseEntity<Void> create(@Valid @RequestBody CreateUserRequest request) {
    return ResponseEntity.status(201).build();
  }
}`,
    requirements: [
      ['İsim boş olamaz', /@NotBlank\s+String\s+name/],
      ['E-posta boş olamaz ve biçimi geçerli', /@NotBlank\s+@Email\s+String\s+email/],
      ['Request body validation', /@Valid\s+@RequestBody\s+CreateUserRequest\s+request/],
      ['POST /users endpoint', /@PostMapping\s*\(\s*"\/users"\s*\)/],
      ['DTO alanları üzerinde Bean Validation', /\brecord\s+CreateUserRequest\s*\(\s*@NotBlank\s+String\s+name\s*,\s*@NotBlank\s+@Email\s+String\s+email\s*\)/],
    ],
    scopeRules: [
      {
        label: 'Validasyonlu POST endpoint UserController içinde',
        path: [/\bclass\s+UserController\s*\{/],
        patterns: [/@PostMapping\s*\(\s*"\/users"\s*\)\s+ResponseEntity\s*<\s*Void\s*>\s+create\s*\(\s*@Valid\s+@RequestBody\s+CreateUserRequest\s+request\s*\)/],
      },
    ],
    hint: '@Email tek başına boş değeri reddetmeyebilir. @NotBlank ile boş kontrolü ekle; @Valid constraint’leri tetikler.',
    expectedBehavior: 'Boş isim veya hatalı e-posta isteği 400 ile reddedilir; geçerli DTO controller’a ulaşır.',
    reviewQuestion: 'E-postanın başka kullanıcıya ait olması neden @Email ile çözülemez?',
    syntaxTemplate: '__ANSWER__',
  },
  repository: {
    prompt: 'Product entity ve tipli JpaRepository içinde iki derived query tanımla.',
    editableStarter: true,
    starter: `import java.util.*;

// TODO: JPA entity annotation'ı
class Product {
  // TODO: Long id için @Id
  Long id;
  String sku;
  String name;
  boolean active;
}

// TODO: Product ve Long tipleriyle JpaRepository genişlet
interface ProductRepository {
  // TODO: aktif ürünleri isme göre sırayla listele
  // TODO: sku üzerinden Optional<Product> bul
}`,
    solution: `import java.util.*;

@Entity
class Product {
  @Id
  Long id;
  String sku;
  String name;
  boolean active;
}

interface ProductRepository extends JpaRepository<Product, Long> {
  List<Product> findByActiveTrueOrderByNameAsc();
  Optional<Product> findBySku(String sku);
}`,
    requirements: [
      ['JPA entity', /@Entity\s+class\s+Product/],
      ['Entity kimlik alanı', /@Id\s+Long\s+id\s*;/],
      ['Product / Long repository', /\binterface\s+ProductRepository\s+extends\s+JpaRepository\s*<\s*Product\s*,\s*Long\s*>/],
      ['Aktif ürünleri sıralayan query', /\bList\s*<\s*Product\s*>\s+findByActiveTrueOrderByNameAsc\s*\(\s*\)\s*;/],
      ['SKU ile güvenli lookup', /\bOptional\s*<\s*Product\s*>\s+findBySku\s*\(\s*String\s+sku\s*\)\s*;/],
    ],
    scopeRules: [
      {
        label: 'JPA kimliği Product entity içinde',
        path: [/\bclass\s+Product\s*\{/],
        directMembersOnly: true,
        patterns: [/@Id\s+Long\s+id\s*;/],
      },
      {
        label: 'Derived query metotları ProductRepository içinde',
        path: [/\binterface\s+ProductRepository\s+extends\s+JpaRepository\s*<\s*Product\s*,\s*Long\s*>\s*\{/],
        directMembersOnly: true,
        patterns: [
          /\bList\s*<\s*Product\s*>\s+findByActiveTrueOrderByNameAsc\s*\(\s*\)\s*;/,
          /\bOptional\s*<\s*Product\s*>\s+findBySku\s*\(\s*String\s+sku\s*\)\s*;/,
        ],
      },
    ],
    hint: 'JpaRepository<Entity, Id> generic parametreleri CRUD tipini belirler. Derived query adı alan/filtre/sıralama bilgisini taşır.',
    expectedBehavior: 'Repository aktif ürünleri name artan sırada listeler; findBySku(String) ürün yoksa Optional.empty() dönebilir.',
    reviewQuestion: 'findBySku metodunun her zaman tek ürün döndürmesini istiyorsan DB tarafında hangi constraint gerekir?',
    syntaxTemplate: '__ANSWER__',
  },
  transactions: {
    prompt: 'Transfer işlemini tek @Transactional sınırına al, geçersiz tutarı reddet.',
    editableStarter: true,
    starter: `import java.math.BigDecimal;

interface LedgerRepository {
  void debit(long accountId, BigDecimal amount);
  void credit(long accountId, BigDecimal amount);
}

@Service
class TransferService {
  private final LedgerRepository ledger;
  TransferService(LedgerRepository ledger) { this.ledger = ledger; }

  // TODO: transaction boundary annotation'ı
  public void transfer(long fromId, long toId, BigDecimal amount) {
    // TODO: sıfır veya negatif amount için IllegalArgumentException fırlat
    ledger.debit(fromId, amount);
    ledger.credit(toId, amount);
  }
}`,
    solution: `import java.math.BigDecimal;

interface LedgerRepository {
  void debit(long accountId, BigDecimal amount);
  void credit(long accountId, BigDecimal amount);
}

@Service
class TransferService {
  private final LedgerRepository ledger;
  TransferService(LedgerRepository ledger) { this.ledger = ledger; }

  @Transactional
  public void transfer(long fromId, long toId, BigDecimal amount) {
    if (amount.signum() <= 0) throw new IllegalArgumentException("Tutar pozitif olmalı");
    ledger.debit(fromId, amount);
    ledger.credit(toId, amount);
  }
}`,
    requirements: [
      ['Public service transaction sınırı', /@Transactional\s+public\s+void\s+transfer\s*\(/],
      ['Geçersiz tutara unchecked exception', /\bif\s*\(\s*amount\.signum\s*\(\s*\)\s*<=\s*0\s*\)\s*throw\s+new\s+IllegalArgumentException\s*\(/],
      ['Kaynak hesaptan debit', /\bledger\.debit\s*\(\s*fromId\s*,\s*amount\s*\)\s*;/],
      ['Hedef hesaba credit', /\bledger\.credit\s*\(\s*toId\s*,\s*amount\s*\)\s*;/],
    ],
    scopeRules: [
      {
        label: 'Tutar kontrolü ve debit/credit, TransferService.transfer() içinde ve doğru sırada',
        path: [
          /\bclass\s+TransferService\s*\{/,
          /\bpublic\s+void\s+transfer\s*\([^)]*\)\s*\{/,
        ],
        patterns: [
          /\bif\s*\(\s*amount\.signum\s*\(\s*\)\s*<=\s*0\s*\)\s*throw\s+new\s+IllegalArgumentException\s*\([\s\S]*?\bledger\.debit\s*\(\s*fromId\s*,\s*amount\s*\)\s*;[\s\S]*?\bledger\.credit\s*\(\s*toId\s*,\s*amount\s*\)\s*;/,
        ],
      },
    ],
    hint: 'Aynı transaction manager altında DB değişiklikleri birlikte commit/rollback olur. Default rollback unchecked exception içindir; self-invocation proxy’yi atlayabilir.',
    expectedBehavior: 'Geçersiz miktar işlemi başlamadan reddedilir. Aynı transactional DB’de credit exception fırlatırsa debit de rollback edilir (proxy üzerinden çağrı varsayımıyla).',
    reviewQuestion: 'this.transfer(...) çağrısı aynı sınıf içindeyken @Transactional neden çalışmayabilir?',
    syntaxTemplate: '__ANSWER__',
  },
  exceptions: {
    prompt: 'ProductNotFoundException hatasını merkezi olarak 404 JSON yanıtına çevir.',
    editableStarter: true,
    starter: `record ErrorResponse(String code, String message) {}
class ProductNotFoundException extends RuntimeException {
  ProductNotFoundException(String message) { super(message); }
}

// TODO: global REST exception advice annotation'ı
class ApiExceptionHandler {
  // TODO: yalnız ProductNotFoundException için handler annotation'ı
  ResponseEntity<ErrorResponse> handle(ProductNotFoundException ex) {
    // TODO: NOT_FOUND status + PRODUCT_NOT_FOUND kodlu ErrorResponse oluştur
  }
}`,
    solution: `record ErrorResponse(String code, String message) {}
class ProductNotFoundException extends RuntimeException {
  ProductNotFoundException(String message) { super(message); }
}

@RestControllerAdvice
class ApiExceptionHandler {
  @ExceptionHandler(ProductNotFoundException.class)
  ResponseEntity<ErrorResponse> handle(ProductNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
      .body(new ErrorResponse("PRODUCT_NOT_FOUND", ex.getMessage()));
  }
}`,
    requirements: [
      ['Global REST advice', /@RestControllerAdvice\s+class\s+ApiExceptionHandler/],
      ['Doğru exception tipi', /@ExceptionHandler\s*\(\s*ProductNotFoundException\.class\s*\)/],
      ['404 Not Found', /\breturn\s+ResponseEntity\.status\s*\(\s*HttpStatus\.NOT_FOUND\s*\)/],
      ['Kod + hata mesajı içeren body', /\.body\s*\(\s*new\s+ErrorResponse\s*\(\s*"PRODUCT_NOT_FOUND"\s*,\s*ex\.getMessage\s*\(\s*\)\s*\)\s*\)\s*;/],
    ],
    scopeRules: [
      {
        label: '404 ve hata gövdesi ApiExceptionHandler.handle() içinde',
        path: [
          /\bclass\s+ApiExceptionHandler\s*\{/,
          /\bResponseEntity\s*<\s*ErrorResponse\s*>\s+handle\s*\(\s*ProductNotFoundException\s+ex\s*\)\s*\{/,
        ],
        patterns: [
          /\breturn\s+ResponseEntity\.status\s*\(\s*HttpStatus\.NOT_FOUND\s*\)\s*\.body\s*\(\s*new\s+ErrorResponse\s*\(\s*"PRODUCT_NOT_FOUND"\s*,\s*ex\.getMessage\s*\(\s*\)\s*\)\s*\)\s*;/,
        ],
      },
    ],
    hint: '@RestControllerAdvice birçok controller’ın hatalarını ortak JSON sözleşmesiyle yönetir. Bulunamayan resource 404 olmalı; genel 500 değil.',
    expectedBehavior: 'GET /products/99 bulunamazsa handler 404 ve {"code":"PRODUCT_NOT_FOUND","message":"..."} gövdesi döndürür.',
    reviewQuestion: 'Her RuntimeException’ı 404’e dönüştürmek üretimde hangi hataları gizler?',
    syntaxTemplate: '__ANSWER__',
  },
}
