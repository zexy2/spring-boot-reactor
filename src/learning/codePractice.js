import { springCodeChallenges } from './springCodeChallenges.js'

export const codePracticeLibrary = {
  'java-class': {
    prompt: 'Bir Product tipi tanımla, nesne oluştur ve iki field’ını doldur.',
    editableStarter: true,
    starter: `class Product {
  // TODO: name ve price field'larını tanımla
}

class Demo {
  void run() {
    // TODO: Product nesnesini phone değişkenine ata, name ve price değerlerini ver
  }
}`,
    solution: `class Product {
  String name;
  double price;
}

class Demo {
  void run() {
    Product phone = new Product();
    phone.name = "Telefon";
    phone.price = 1299.0;
  }
}`,
    requirements: [
      ['Product class’ı', /\bclass\s+Product\s*\{/],
      ['String name field’ı', /\bString\s+name\s*;/],
      ['double price field’ı', /\bdouble\s+price\s*;/],
      ['new ile phone nesnesi', /\bProduct\s+phone\s*=\s*new\s+Product\s*\(\s*\)\s*;/],
      ['phone field atamaları', /\bphone\.name\s*=\s*"[^"]+"\s*;[\s\S]*?\bphone\.price\s*=\s*\d+(?:\.\d+)?\s*;/],
    ],
    scopeRules: [
      {
        label: 'name ve price, Product sınıfında',
        path: [/\bclass\s+Product\s*\{/],
        directMembersOnly: true,
        patterns: [/\bString\s+name\s*;/, /\bdouble\s+price\s*;/],
      },
      {
        label: 'Product oluşturma ve alan atamaları Demo.run() içinde',
        path: [/\bclass\s+Demo\s*\{/, /\bvoid\s+run\s*\(\s*\)\s*\{/],
        patterns: [
          /\bProduct\s+phone\s*=\s*new\s+Product\s*\(\s*\)\s*;/,
          /\bphone\.name\s*=\s*"[^"]+"\s*;[\s\S]*?\bphone\.price\s*=\s*\d+(?:\.\d+)?\s*;/,
        ],
      },
    ],
    hint: '`class Product` bir tiptir. `new Product()` nesne üretir. `phone.name` ise nesnenin alanına erişir.',
    expectedBehavior: 'run() içinde yeni Product nesnesi oluşur; iki field bu nesneye atanır.',
    reviewQuestion: 'İkinci kez new Product() çağırırsan aynı nesne mi kullanılır?',
    syntaxTemplate: '__ANSWER__',
  },
  'methods-constructor': {
    prompt: 'Constructor ile ürün adını al; label() method’undan etiket döndür.',
    editableStarter: true,
    starter: `class Product {
  private final String name;

  // TODO: Product(String name) constructor'ını yaz ve field'a ata

  // TODO: String label() method'unu yaz; "Ürün: " + name döndür
}`,
    solution: `class Product {
  private final String name;

  Product(String name) {
    this.name = name;
  }

  String label() {
    return "Ürün: " + name;
  }
}`,
    requirements: [
      ['Parametre alan constructor', /\bProduct\s*\(\s*String\s+name\s*\)/],
      ['Field ataması', /\bthis\.name\s*=\s*name\s*;/],
      ['String dönen label()', /\bString\s+label\s*\(\s*\)\s*\{/],
      ['Etiket return ifadesi', /\breturn\s+"Ürün: "\s*\+\s*(?:this\.)?name\s*;/],
    ],
    scopeRules: [
      {
        label: 'name ataması Product constructor içinde',
        path: [/\bclass\s+Product\s*\{/, /\bProduct\s*\(\s*String\s+name\s*\)\s*\{/],
        patterns: [/\bthis\.name\s*=\s*name\s*;/],
      },
      {
        label: 'Etiket sonucu Product.label() içinde döner',
        path: [/\bclass\s+Product\s*\{/, /\bString\s+label\s*\(\s*\)\s*\{/],
        patterns: [/\breturn\s+"Ürün: "\s*\+\s*(?:this\.)?name\s*;/],
      },
    ],
    hint: 'Constructor’ın dönüş tipi olmaz; adı class ile aynıdır. `this.name`, field’ı ifade eder.',
    expectedBehavior: 'new Product("Kalem").label() sonucu "Ürün: Kalem" olmalı.',
    reviewQuestion: '`this.name = name` satırında iki `name` neden aynı şeyi ifade etmiyor?',
    syntaxTemplate: '__ANSWER__',
  },
  interface: {
    prompt: 'PaymentService sözleşmesini yaz ve CardPaymentService ile uygula.',
    editableStarter: true,
    starter: `interface PaymentService {
  // TODO: boolean pay(double amount) sözleşmesi
}

class CardPaymentService implements PaymentService {
  // TODO: public pay implementation'ı; yalnız pozitif tutara true dön
}`,
    solution: `interface PaymentService {
  boolean pay(double amount);
}

class CardPaymentService implements PaymentService {
  @Override
  public boolean pay(double amount) {
    return amount > 0;
  }
}`,
    requirements: [
      ['Interface sözleşmesi', /\binterface\s+PaymentService\s*\{\s*boolean\s+pay\s*\(\s*double\s+amount\s*\)\s*;/],
      ['Interface implementasyonu', /\bclass\s+CardPaymentService\s+implements\s+PaymentService\s*\{/],
      ['public pay method’u', /\bpublic\s+boolean\s+pay\s*\(\s*double\s+amount\s*\)\s*\{/],
      ['Pozitif tutar koşulu', /\breturn\s+amount\s*>\s*0\s*;/],
    ],
    scopeRules: [
      {
        label: 'Pozitif tutar kontrolü CardPaymentService.pay() içinde',
        path: [
          /\bclass\s+CardPaymentService\s+implements\s+PaymentService\s*\{/,
          /\bpublic\s+boolean\s+pay\s*\(\s*double\s+amount\s*\)\s*\{/,
        ],
        patterns: [/\breturn\s+amount\s*>\s*0\s*;/],
      },
    ],
    hint: 'Interface gövdesi davranış imzasını taşır; implementation içindeki method `public` olmalıdır.',
    expectedBehavior: 'pay(15) true, pay(0) false döner.',
    reviewQuestion: 'Yarın BankTransferService yazılırsa çağıran kod niçin PaymentService tipini kullanmalı?',
    syntaxTemplate: '__ANSWER__',
  },
  'java-collections': {
    prompt: 'Sipariş için List, tekil roller için Set, kullanıcı bulmak için Map kur.',
    editableStarter: true,
    starter: `import java.util.*;

class Directory {
  void example() {
    // TODO: List<String> order (ArrayList) kur ve "Kalem" ekle
    // TODO: Set<String> roles (HashSet) kur ve "ADMIN" ekle
    // TODO: Map<Long, String> users (HashMap) kur; 42L -> "Ada" ekle
    // TODO: 42L key'ini get ile okuyup String name'e ata
  }
}`,
    solution: `import java.util.*;

class Directory {
  void example() {
    List<String> order = new ArrayList<>();
    order.add("Kalem");
    Set<String> roles = new HashSet<>();
    roles.add("ADMIN");
    Map<Long, String> users = new HashMap<>();
    users.put(42L, "Ada");
    String name = users.get(42L);
  }
}`,
    requirements: [
      ['List ve ArrayList', /\bList\s*<\s*String\s*>\s+order\s*=\s*new\s+ArrayList\s*<\s*>\s*\(\s*\)/],
      ['List.add', /\border\.add\s*\(\s*"Kalem"\s*\)/],
      ['Set ve HashSet', /\bSet\s*<\s*String\s*>\s+roles\s*=\s*new\s+HashSet\s*<\s*>\s*\(\s*\)/],
      ['Set.add', /\broles\.add\s*\(\s*"ADMIN"\s*\)/],
      ['Map ve HashMap', /\bMap\s*<\s*Long\s*,\s*String\s*>\s+users\s*=\s*new\s+HashMap\s*<\s*>\s*\(\s*\)/],
      ['Key ekleme ve okuma', /\busers\.put\s*\(\s*42L\s*,\s*"Ada"\s*\)\s*;[\s\S]*?\bString\s+name\s*=\s*users\.get\s*\(\s*42L\s*\)/],
    ],
    hint: '`List` tekrar kabul eder, `Set` aynı elemanı tek tutar, `Map` key üzerinden value bulur.',
    expectedBehavior: 'order bir satır, roles tek rol, users ise 42L için "Ada" içerir.',
    reviewQuestion: 'Bir kullanıcıya aynı rol iki kez eklenirse Set ile List arasında hangi fark oluşur?',
    syntaxTemplate: '__ANSWER__',
  },
  'java-hashmap': {
    prompt: 'Değere göre eşit key’lerle HashMap lookup yap.',
    editableStarter: true,
    starter: `import java.util.*;

// TODO: id alanına sahip UserKey record'unu tanımla

class UserIndex {
  void lookup() {
    // TODO: Map<UserKey, String> users oluştur
    // TODO: new UserKey(42) ile "Ada" ekle
    // TODO: başka new UserKey(42) ile get yap ve found'a ata
  }
}`,
    solution: `import java.util.*;

record UserKey(long id) {}

class UserIndex {
  void lookup() {
    Map<UserKey, String> users = new HashMap<>();
    users.put(new UserKey(42), "Ada");
    String found = users.get(new UserKey(42));
  }
}`,
    requirements: [
      ['UserKey record', /\brecord\s+UserKey\s*\(\s*long\s+id\s*\)/],
      ['UserKey tipli Map', /\bMap\s*<\s*UserKey\s*,\s*String\s*>\s+users\s*=\s*new\s+HashMap\s*<\s*>\s*\(\s*\)/],
      ['Yeni key ile put', /\busers\.put\s*\(\s*new\s+UserKey\s*\(\s*42\s*\)\s*,\s*"Ada"\s*\)/],
      ['Farklı nesneyle get', /\bString\s+found\s*=\s*users\.get\s*\(\s*new\s+UserKey\s*\(\s*42\s*\)\s*\)/],
    ],
    hint: 'Record, bileşenlerinden `equals` ve `hashCode` üretir. İki ayrı UserKey(42) mantıksal olarak eşittir.',
    expectedBehavior: 'Farklı nesne kimliğine rağmen found değişkeni "Ada" olur.',
    reviewQuestion: 'HashMap key olarak değişebilir bir alan kullansaydın ne bozulabilirdi?',
    syntaxTemplate: '__ANSWER__',
  },
  'java-exceptions': {
    prompt: 'Stok yetersizse custom unchecked exception fırlat.',
    editableStarter: true,
    starter: `// TODO: OutOfStockException, RuntimeException'dan türesin

class Inventory {
  void reserve(int stock, int requested) {
    // TODO: requested > stock ise custom exception fırlat
  }
}`,
    solution: `class OutOfStockException extends RuntimeException {
  OutOfStockException(String message) { super(message); }
}

class Inventory {
  void reserve(int stock, int requested) {
    if (requested > stock) {
      throw new OutOfStockException("Stok yetersiz");
    }
  }
}`,
    requirements: [
      ['Unchecked exception sınıfı', /\bclass\s+OutOfStockException\s+extends\s+RuntimeException\s*\{/],
      ['Mesajı üst sınıfa iletme', /\bOutOfStockException\s*\(\s*String\s+message\s*\)\s*\{\s*super\s*\(\s*message\s*\)\s*;/],
      ['Stok kontrolü ve throw', /\bif\s*\(\s*requested\s*>\s*stock\s*\)\s*\{\s*throw\s+new\s+OutOfStockException\s*\(\s*"[^"]+"\s*\)\s*;/],
    ],
    hint: '`throw` hatayı o anda fırlatır. `extends RuntimeException` checked `throws` bildirimi zorunluluğunu kaldırır.',
    expectedBehavior: 'reserve(2, 3) exception fırlatır; reserve(4, 1) normal tamamlanır.',
    reviewQuestion: 'Exception’ı catch edip hiçbir şey yapmadan yutmak neden tehlikeli?',
    syntaxTemplate: '__ANSWER__',
  },
  'java-streams': {
    prompt: 'Stream ile aktif ürünleri seç, adlarını çıkar ve sırala.',
    editableStarter: true,
    starter: `import java.util.*;

record Product(String name, boolean active) {}

class Catalog {
  List<String> activeNames(List<Product> products) {
    // TODO: products.stream() üzerinden filter, map, sorted, toList kullan
  }
}`,
    solution: `import java.util.*;

record Product(String name, boolean active) {}

class Catalog {
  List<String> activeNames(List<Product> products) {
    return products.stream()
      .filter(p -> p.active())
      .map(p -> p.name())
      .sorted()
      .toList();
  }
}`,
    requirements: [
      ['Product listesi dönen değil, String listesi dönen method', /\bList\s*<\s*String\s*>\s+activeNames\s*\(\s*List\s*<\s*Product\s*>\s+products\s*\)/],
      ['Stream kaynağı', /\breturn\s+products\.stream\s*\(\s*\)/],
      ['Aktif ürün filtresi', /\.filter\s*\(\s*(?:p\s*->\s*p\.active\s*\(\s*\)|Product::active)\s*\)/],
      ['Ürün adını çıkarma', /\.map\s*\(\s*(?:p\s*->\s*p\.name\s*\(\s*\)|Product::name)\s*\)/],
      ['Sıralama ve terminal işlem', /\.sorted\s*\(\s*\)\s*\.toList\s*\(\s*\)/],
    ],
    hint: 'filter elemanı seçer; map onu dönüştürür; toList terminal işlemdir.',
    expectedBehavior: 'Ürünler içinden active=true olanların isimlerini alfabetik List olarak döndürür.',
    reviewQuestion: 'Sondaki toList() kaldırılırsa stream pipeline ne zaman çalışır?',
    syntaxTemplate: '__ANSWER__',
  },
  'java-concurrency': {
    prompt: 'Paylaşılan sayaç için hem yazmayı hem okumayı aynı lock ile koru.',
    editableStarter: true,
    starter: `class Counter {
  private int value;

  // TODO: synchronized void increment() içinde value++ yap

  // TODO: synchronized int getValue() içinde value döndür
}`,
    solution: `class Counter {
  private int value;

  synchronized void increment() {
    value++;
  }

  synchronized int getValue() {
    return value;
  }
}`,
    requirements: [
      ['Yazmaya monitor kilidi', /\bsynchronized\s+void\s+increment\s*\(\s*\)\s*\{\s*value\s*\+\+\s*;/],
      ['Okumaya aynı monitor kilidi', /\bsynchronized\s+int\s+getValue\s*\(\s*\)\s*\{\s*return\s+value\s*;/],
    ],
    hint: '`value++` tek atomik adım değildir. İki instance method da aynı Counter nesnesinin monitor kilidini kullanır.',
    expectedBehavior: 'Aynı Counter nesnesine farklı thread’lerden erişirken kritik okuma/yazma serialize edilir.',
    reviewQuestion: 'Her request yeni Counter nesnesi oluştursaydı bu kilitler birbirini korur muydu?',
    syntaxTemplate: '__ANSWER__',
  },
  'java-abstract-composition': {
    prompt: 'OrderService’e concrete sınıf yerine Notifier bağımlılığı ver.',
    editableStarter: true,
    starter: `interface Notifier { void send(String message); }

class EmailNotifier implements Notifier {
  public void send(String message) { System.out.println(message); }
}

class OrderService {
  // TODO: private final Notifier field
  // TODO: Notifier alan constructor
  // TODO: notifyCustomer method'undan notifier.send çağır
}`,
    solution: `interface Notifier { void send(String message); }

class EmailNotifier implements Notifier {
  public void send(String message) { System.out.println(message); }
}

class OrderService {
  private final Notifier notifier;

  OrderService(Notifier notifier) {
    this.notifier = notifier;
  }

  void notifyCustomer(String message) {
    notifier.send(message);
  }
}`,
    requirements: [
      ['Interface tipinde final field', /\bprivate\s+final\s+Notifier\s+notifier\s*;/],
      ['Constructor injection', /\bOrderService\s*\(\s*Notifier\s+notifier\s*\)\s*\{\s*this\.notifier\s*=\s*notifier\s*;/],
      ['Abstraction üzerinden çağrı', /\bvoid\s+notifyCustomer\s*\(\s*String\s+message\s*\)\s*\{\s*notifier\.send\s*\(\s*message\s*\)\s*;/],
    ],
    hint: 'OrderService nesneyi kendi üretmez. Dışarıdan Notifier alır; e-posta yerine SMS vermek kolaylaşır.',
    expectedBehavior: 'Constructor’a verilen herhangi bir Notifier implementation’ı notifyCustomer ile çağrılır.',
    reviewQuestion: 'OrderService içinde new EmailNotifier() yazmak testleri ve değişimi neden zorlaştırır?',
    syntaxTemplate: '__ANSWER__',
  },
  'java-oop': {
    prompt: 'Payment üst tipini CardPayment ile genişlet; davranışı override et.',
    editableStarter: true,
    starter: `import java.math.BigDecimal;

abstract class Payment {
  protected final BigDecimal amount;
  // TODO: constructor ile amount field'ını doldur
  // TODO: abstract boolean pay() sözleşmesi
}

class CardPayment extends Payment {
  // TODO: constructor içinde super(amount) çağır
  // TODO: @Override boolean pay() ile pozitif tutarı kontrol et
}`,
    solution: `import java.math.BigDecimal;

abstract class Payment {
  protected final BigDecimal amount;

  Payment(BigDecimal amount) { this.amount = amount; }
  abstract boolean pay();
}

class CardPayment extends Payment {
  CardPayment(BigDecimal amount) { super(amount); }

  @Override
  boolean pay() { return amount.signum() > 0; }
}`,
    requirements: [
      ['Abstract üst sınıf', /\babstract\s+class\s+Payment\s*\{/],
      ['Üst sınıf constructor', /\bPayment\s*\(\s*BigDecimal\s+amount\s*\)\s*\{\s*this\.amount\s*=\s*amount\s*;/],
      ['Abstract davranış', /\babstract\s+boolean\s+pay\s*\(\s*\)\s*;/],
      ['Alt sınıf ve super', /\bclass\s+CardPayment\s+extends\s+Payment\s*\{\s*CardPayment\s*\(\s*BigDecimal\s+amount\s*\)\s*\{\s*super\s*\(\s*amount\s*\)\s*;/],
      ['Override edilen iş kuralı', /@Override\s+boolean\s+pay\s*\(\s*\)\s*\{\s*return\s+amount\.signum\s*\(\s*\)\s*>\s*0\s*;/],
    ],
    hint: 'abstract class gövde ve state taşıyabilir. Alt sınıf constructor’ı super ile üst yapıyı kurar.',
    expectedBehavior: 'Pozitif BigDecimal tutarda pay() true, sıfırda false döner.',
    reviewQuestion: 'Payment referansı CardPayment nesnesini gösterirken pay() çağrısı nereden çalışır?',
    syntaxTemplate: '__ANSWER__',
  },
  ...springCodeChallenges,
}

// Strip comments without mistaking URL and comment-like text inside Java literals for comments.
// Preserve whitespace/newlines so adjacent identifiers never merge after removal.
function splitCodeComments(value) {
  const source = String(value)
  let code = ''
  let comments = ''
  let unquotedCode = ''
  let maskedLiterals = ''
  const literals = []
  let mode = 'code'
  let index = 0
  let literalStart = -1

  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]
    if (mode === 'line-comment' || mode === 'block-comment') {
      if (mode === 'line-comment' && char === '\n') {
        code += '\n'
        unquotedCode += '\n'
        maskedLiterals += '\n'
        mode = 'code'
        index += 1
      } else if (mode === 'block-comment' && char === '*' && next === '/') {
        code += '  '
        unquotedCode += '  '
        maskedLiterals += '  '
        index += 2
        mode = 'code'
      } else {
        comments += char
        code += char === '\n' ? '\n' : ' '
        unquotedCode += char === '\n' ? '\n' : ' '
        maskedLiterals += char === '\n' ? '\n' : ' '
        index += 1
      }
      continue
    }

    if (mode === 'string' || mode === 'character' || mode === 'text-block') {
      if (char === '\\' && index + 1 < source.length) {
        code += source.slice(index, index + 2)
        unquotedCode += '  '
        maskedLiterals += '~~'
        index += 2
      } else if (mode === 'text-block' && source.startsWith('"""', index)) {
        code += '"""'
        unquotedCode += '   '
        maskedLiterals += '"""'
        index += 3
        literals.push({ start: literalStart, end: index, delimiterSize: 3 })
        mode = 'code'
      } else {
        code += char
        unquotedCode += char === '\n' ? '\n' : ' '
        const closing = (mode === 'string' && char === '"') || (mode === 'character' && char === "'")
        maskedLiterals += closing ? char : char === '\n' ? '\n' : '~'
        if (closing) {
          literals.push({ start: literalStart, end: index + 1, delimiterSize: 1 })
          mode = 'code'
        }
        index += 1
      }
      continue
    }

    if (char === '/' && (next === '/' || next === '*')) {
      code += '  '
      unquotedCode += '  '
      maskedLiterals += '  '
      index += 2
      mode = next === '/' ? 'line-comment' : 'block-comment'
    } else if (source.startsWith('"""', index)) {
      code += '"""'
      unquotedCode += '   '
      maskedLiterals += '"""'
      literalStart = index
      index += 3
      mode = 'text-block'
    } else {
      code += char
      unquotedCode += char === '"' || char === "'" ? ' ' : char
      maskedLiterals += char
      if (char === '"' || char === "'") {
        literalStart = index
        mode = char === '"' ? 'string' : 'character'
      }
      index += 1
    }
  }

  return { code, comments, unquotedCode, maskedLiterals, literals }
}

export function normalizeCodeAnswer(value) {
  return splitCodeComments(value).code
    .replace(/\s+/g, '')
    .toLocaleLowerCase('tr-TR')
}

export function buildCodePractice(lesson) {
  if (!lesson?.id) return null

  const custom = codePracticeLibrary[lesson.id]
  if (custom) return { id: `${lesson.id}-custom`, ...custom }

  const source = lesson.code ?? ''
  const codeLike = /(@[A-Z]|\b(class|interface|record|public|private|return|SELECT|CREATE|BEGIN|function|const|def|git|FROM)\b)/i.test(source)
  if (!codeLike || !lesson.codeNotes?.length) return null

  const candidate = lesson.codeNotes.find(([fragment]) => {
    const value = String(fragment)
    return value.length >= 3 && value.length <= 100 && source.includes(value) && !/[↓→]/.test(value)
      && (!lesson.practiceFragment || value === lesson.practiceFragment)
  })
  if (!candidate) return null

  const [fragment, explanation] = candidate
  const placeholders = {
    python: '# TODO: eksik Python ifadesi',
    shell: '# TODO: eksik komut',
    dockerfile: '# TODO: eksik Dockerfile ifadesi',
    yaml: '# TODO: eksik yapılandırma',
    gherkin: '# TODO: eksik senaryo',
    diagram: '[TODO: eksik adım]',
  }
  return {
    id: `${lesson.id}-generated`,
    answerMode: 'fragment',
    caseInsensitive: lesson.id.startsWith('sql-') || lesson.id === 'database-acid',
    prompt: `Eksik parçayı kendin yaz: ${explanation}`,
    starter: source.replace(fragment, placeholders[lesson.practiceLanguage] ?? '/* TODO: burayı sen yaz */'),
    solution: fragment,
    completedExample: source,
    expected: fragment,
    requirements: [[fragment, fragment]],
  }
}

function fragmentAttemptFeedback(answer, challenge) {
  const submitted = String(answer).trim().replace(/\s+/g, ' ')
  const expected = String(challenge.expected ?? '').trim().replace(/\s+/g, ' ')
  if (challenge.completedExample && submitted === challenge.completedExample.trim().replace(/\s+/g, ' ')) {
    return 'Kodun tamamını yapıştırdın. TODO konumuna gelecek tek ifadeyi yaz.'
  }
  if (/^(?:\/\/|\/\*|#)/.test(submitted) || /^["'`].*["'`]$/.test(submitted)) {
    return 'Cevabı yorum veya metin olarak yazma; eksik kod ifadesini doğrudan gir.'
  }
  if (!challenge.caseInsensitive && submitted.toLocaleLowerCase('en-US') === expected.toLocaleLowerCase('en-US')) {
    return 'Büyük/küçük harf farkını kontrol et. Bu örnekte yazım birebir eşleşmeli.'
  }
  if (expected && submitted.includes(expected)) {
    return 'Doğru ifade cevapta var, ancak fazladan kod veya açıklama eklemişsin.'
  }
  return 'Kod iskeletindeki TODO yerini incele. Sadece eksik ifadeyi yaz.'
}

function matchesExecutablePattern(pattern, code, unquotedCode, maskedLiterals, literals) {
  // Code-like text embedded in a Java literal must never satisfy a requirement.
  // Keep literal delimiters for checks such as "[^"]+". Only restore literal
  // contents when the requirement explicitly names that exact quoted value.
  const checkedCode = [...maskedLiterals]
  for (const { start, end, delimiterSize } of literals) {
    if (delimiterSize !== 1 || code[start] !== '"') continue
    const content = code.slice(start + 1, end - 1)
    const escaped = content.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
    if (pattern.source.includes(`"${content}"`) || pattern.source.includes(`"${escaped}"`)) {
      checkedCode.splice(start + 1, content.length, ...content)
    }
  }
  const matcher = new RegExp(pattern.source, `${pattern.flags.replace(/[gy]/g, '')}g`)
  let match
  const candidate = checkedCode.join('')
  while ((match = matcher.exec(candidate)) !== null) {
    const firstToken = match[0].search(/\S/)
    if (firstToken >= 0) {
      const offset = match.index + firstToken
      if (unquotedCode[offset] === code[offset]) return true
    }
    if (match[0].length === 0) matcher.lastIndex += 1
  }
  return false
}

// Scopes use lexical braces, with comments and string/character literals masked.
// This checks placement of required code; Java compilation/type checking is separate.
function extractJavaScope(source, path) {
  let current = source
  for (const declaration of path) {
    const masked = splitCodeComments(current).unquotedCode
    const match = new RegExp(declaration.source, declaration.flags.replace(/[gy]/g, '')).exec(masked)
    if (!match || !match[0].endsWith('{')) return null
    const opening = match.index + match[0].length - 1
    let depth = 1
    let closing = opening + 1
    while (closing < masked.length && depth > 0) {
      if (masked[closing] === '{') depth += 1
      if (masked[closing] === '}') depth -= 1
      closing += 1
    }
    if (depth !== 0) return null
    current = current.slice(opening + 1, closing - 1)
  }
  return current
}

// A class field must be declared directly on that class; fields in inner
// classes or method bodies cannot fulfill its field requirements.
function maskNestedScopes(source) {
  const masked = splitCodeComments(source).unquotedCode
  const chars = [...source]
  let depth = 0
  for (let index = 0; index < masked.length; index += 1) {
    const char = masked[index]
    if (char === '{') depth += 1
    if (depth > 0 && source[index] !== '\n') chars[index] = ' '
    if (char === '}') depth -= 1
  }
  return chars.join('')
}

export function evaluateCodeRequirements(answer, challenge) {
  if (!challenge) return { checks: [], generatedMatch: false, staticSuccess: false }

  if (challenge.answerMode === 'fragment') {
    // In fill-in-the-gap activities, the answer must be the actual missing
    // fragment. Finding a phrase in unrelated text is not evidence of mastery.
    const normalizeFragment = (value) => {
      const compact = String(value).trim().replace(/\s+/g, ' ')
      return challenge.caseInsensitive ? compact.toLocaleLowerCase('en-US') : compact
    }
    const matches = normalizeFragment(answer) === normalizeFragment(challenge.expected ?? '')
    return {
      checks: [{ label: 'Eksik parçayı doğru tamamladın', ok: matches }],
      generatedMatch: matches,
      staticSuccess: matches && String(answer).trim().length > 0,
      feedback: matches ? null : fragmentAttemptFeedback(answer, challenge),
    }
  }

  const normalized = normalizeCodeAnswer(answer)
  const { code: withoutComments, comments, unquotedCode, maskedLiterals, literals } = splitCodeComments(answer)
  const checks = (challenge.requirements ?? []).map(([label, needle]) => ({
    label,
    ok: needle instanceof RegExp
      ? matchesExecutablePattern(needle, withoutComments, unquotedCode, maskedLiterals, literals)
      : normalized.includes(normalizeCodeAnswer(needle)),
  }))
  for (const rule of challenge.scopeRules ?? []) {
    const scoped = extractJavaScope(answer, rule.path)
    const parts = scoped == null ? null : splitCodeComments(rule.directMembersOnly ? maskNestedScopes(scoped) : scoped)
    checks.push({
      label: rule.label,
      ok: parts !== null && rule.patterns.every((pattern) =>
        matchesExecutablePattern(pattern, parts.code, parts.unquotedCode, parts.maskedLiterals, parts.literals)),
    })
  }
  if (challenge.editableStarter) {
    checks.push({ label: 'TODO satırları tamamlandı', ok: !/\bTODO\b/i.test(unquotedCode + comments) })
  }
  const generatedMatch = challenge.expected
    ? normalized.includes(normalizeCodeAnswer(challenge.expected))
    : true
  const staticSuccess = String(answer).trim().length > 0 && generatedMatch && checks.every((item) => item.ok)

  return { checks, generatedMatch, staticSuccess }
}

export function getSyntaxTemplates(challenge) {
  if (Array.isArray(challenge?.syntaxTemplates)) return challenge.syntaxTemplates.filter(Boolean)
  return challenge?.syntaxTemplate ? [challenge.syntaxTemplate] : []
}
