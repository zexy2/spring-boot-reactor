import test from 'node:test'
import assert from 'node:assert/strict'

import { lessons } from '../src/data/curriculum.js'
import {
  buildCodePractice,
  codePracticeLibrary,
  evaluateCodeRequirements,
  getSyntaxTemplates,
  normalizeCodeAnswer,
} from '../src/learning/codePractice.js'

test('normalizeCodeAnswer removes comments, whitespace and normalizes Turkish case', () => {
  assert.equal(
    normalizeCodeAnswer('  @Bean // comment\n Clock CLOCK() { /* block */ return Clock.systemUTC(); } '),
    '@beanclockclock(){returnclock.systemutc();}',
  )
})

test('comment markers inside Java string and character literals stay intact', () => {
  assert.equal(normalizeCodeAnswer('String url = "https://example.org/a/*b*/"; // remove\nchar slash = \'/\';'),
    'stringurl="https://example.org/a/*b*/";charslash=\'/\';')

  const exercise = codePracticeLibrary['java-class']
  const answerWithUrl = exercise.solution.replace('"Telefon"', '"https://example.org/catalog"')
  assert.equal(evaluateCodeRequirements(answerWithUrl, exercise).staticSuccess, true)
})

test('TODO text inside Java literals is valid, but real TODO comments remain unfinished', () => {
  const exercise = codePracticeLibrary['methods-constructor']
  for (const literal of ['"TODO"', '"// TODO"', '"/* TODO */"', '"""\nTODO\n"""']) {
    const answer = `${exercise.solution}\nclass Notes { String note = ${literal}; }`
    assert.equal(evaluateCodeRequirements(answer, exercise).staticSuccess, true, `${literal}: literal is not a TODO marker`)
  }
  for (const comment of ['// TODO: unfinished', '/* TODO: unfinished */']) {
    assert.equal(evaluateCodeRequirements(`${exercise.solution}\n${comment}`, exercise).staticSuccess, false)
  }
})

test('code-shaped text inside Java literals cannot satisfy regex requirements', async () => {
  const challenge = codePracticeLibrary['java-class']
  const forged = `${challenge.solution.replace('class Product {', 'class ProductDraft {')}\nclass Notes { String fake = "class Product {"; }`
  const { parse } = await import('java-parser')
  assert.doesNotThrow(() => parse(forged), 'forged answer is syntactically valid Java')
  const result = evaluateCodeRequirements(forged, challenge)
  assert.equal(result.staticSuccess, false)
  assert.equal(result.checks.find(({ label }) => label === 'Product class’ı')?.ok, false)

  const legitimateLiteral = challenge.solution.replace('"Telefon"', '"class Product {"')
  assert.equal(evaluateCodeRequirements(legitimateLiteral, challenge).staticSuccess, true)
})

test('Java literals cannot forge the second half of a multi-statement requirement', async () => {
  const { parse } = await import('java-parser')
  const challenge = codePracticeLibrary['java-class']
  const forged = challenge.solution.replace(
    'phone.price = 1299.0;',
    'String misleading = "phone.price = 1299.0;";',
  )
  assert.doesNotThrow(() => parse(forged))
  const result = evaluateCodeRequirements(forged, challenge)
  assert.equal(result.checks.find(({ label }) => label === 'phone field atamaları')?.ok, false)
  assert.equal(result.staticSuccess, false)

  const legitimateExtraLiteral = challenge.solution.replace(
    'phone.price = 1299.0;',
    'String note = "phone.price = 1299.0;";\n    phone.price = 1299.0;',
  )
  assert.equal(evaluateCodeRequirements(legitimateExtraLiteral, challenge).staticSuccess, true)
})

test('Java class challenge requires fields inside Product, not a different class', async () => {
  const challenge = codePracticeLibrary['java-class']
  const misplaced = challenge.solution.replace('  String name;\n  double price;', '')
    + '\nclass Other { String name; double price; }'
  const { parse } = await import('java-parser')
  assert.doesNotThrow(() => parse(misplaced))
  const result = evaluateCodeRequirements(misplaced, challenge)
  assert.equal(result.staticSuccess, false)
  assert.equal(result.checks.find(({ label }) => label === 'name ve price, Product sınıfında')?.ok, false)
})

test('Java class challenge rejects fields declared only in a nested class', async () => {
  const challenge = codePracticeLibrary['java-class']
  const nested = challenge.solution.replace('  String name;\n  double price;',
    '  class Nested { String name; double price; }')
  const { parse } = await import('java-parser')
  assert.doesNotThrow(() => parse(nested))
  const result = evaluateCodeRequirements(nested, challenge)
  assert.equal(result.staticSuccess, false)
  assert.equal(result.checks.find(({ label }) => label === 'name ve price, Product sınıfında')?.ok, false)
})

test('Java class challenge rejects required assignments in an unrelated method', async () => {
  const challenge = codePracticeLibrary['java-class']
  const misplaced = challenge.solution.replace(
    '    Product phone = new Product();\n    phone.name = "Telefon";\n    phone.price = 1299.0;',
    '',
  ) + '\nclass Other { void unused() { Product phone = new Product(); phone.name = "Telefon"; phone.price = 1299.0; } }'
  const { parse } = await import('java-parser')
  assert.doesNotThrow(() => parse(misplaced))
  const result = evaluateCodeRequirements(misplaced, challenge)
  assert.equal(result.staticSuccess, false)
  assert.equal(result.checks.find(({ label }) => label.includes('Demo.run()'))?.ok, false)
})

test('constructor and interface rules reject code placed in unrelated methods', async () => {
  const { parse } = await import('java-parser')
  const constructor = codePracticeLibrary['methods-constructor']
  const missingInitialization = constructor.solution.replace('    this.name = name;', '')
    .replace('  String label()', '  void other(String name) { this.name = name; }\n  String label()')
  assert.doesNotThrow(() => parse(missingInitialization))
  assert.equal(evaluateCodeRequirements(missingInitialization, constructor).staticSuccess, false)

  const interfaceChallenge = codePracticeLibrary.interface
  const misplacedPay = interfaceChallenge.solution.replace(
    '    return amount > 0;', '    return false;',
  ) + '\nclass Other { boolean valid(double amount) { return amount > 0; } }'
  assert.doesNotThrow(() => parse(misplacedPay))
  assert.equal(evaluateCodeRequirements(misplacedPay, interfaceChallenge).staticSuccess, false)
})

test('Java Core code placed in a different class cannot pass the intended method scope', async () => {
  const { parse } = await import('java-parser')
  const relocated = [
    ['java-collections',
      (source) => source.replace('class Directory {', 'class OtherDirectory {') + '\nclass Directory { void example() {} }',
      'Koleksiyon işlemleri Directory.example() içinde'],
    ['java-hashmap',
      (source) => source.replace('class UserIndex {', 'class OtherIndex {') + '\nclass UserIndex { void lookup() {} }',
      'HashMap lookup UserIndex.lookup() içinde'],
    ['java-exceptions',
      (source) => source.replace('class Inventory {', 'class OtherInventory {') + '\nclass Inventory { void reserve(int stock, int requested) {} }',
      'Stok kontrolü Inventory.reserve() içinde'],
    ['java-streams',
      (source) => source.replace('class Catalog {', 'class OtherCatalog {')
        + '\nclass Catalog { List<String> activeNames(List<Product> products) { return List.of(); } }',
      'Stream zinciri Catalog.activeNames() içinde'],
    ['java-concurrency',
      (source) => source.replace('class Counter {', 'class OtherCounter {')
        + '\nclass Counter { synchronized void increment() {} synchronized int getValue() { return 0; } }',
      'Senkronize yazma Counter.increment() içinde'],
  ]

  for (const [id, move, requirement] of relocated) {
    const challenge = codePracticeLibrary[id]
    const answer = move(challenge.solution)
    assert.doesNotThrow(() => parse(answer), `${id}: valid Java grammar`)
    const result = evaluateCodeRequirements(answer, challenge)
    assert.equal(result.staticSuccess, false, `${id}: wrong method/class must fail`)
    assert.equal(result.checks.find(({ label }) => label === requirement)?.ok, false, `${id}: scope feedback`)
  }
})

test('Java OOP payment rejects a passing method only in another subclass', async () => {
  const challenge = codePracticeLibrary['java-oop']
  const answer = challenge.solution.replace(
    'boolean pay() { return amount.signum() > 0; }',
    'boolean pay() { return false; }',
  ) + '\nclass OtherPayment extends Payment { OtherPayment(BigDecimal amount) { super(amount); } @Override boolean pay() { return amount.signum() > 0; } }'
  const { parse } = await import('java-parser')
  assert.doesNotThrow(() => parse(answer))
  const result = evaluateCodeRequirements(answer, challenge)
  assert.equal(result.staticSuccess, false)
  assert.equal(result.checks.find(({ label }) => label === 'Ödeme kontrolü CardPayment.pay() içinde')?.ok, false)
})

test('requirements with exact Java string values still accept their real literals', () => {
  for (const id of ['methods-constructor', 'java-collections', 'java-hashmap', 'java-exceptions']) {
    const challenge = codePracticeLibrary[id]
    assert.equal(evaluateCodeRequirements(challenge.solution, challenge).staticSuccess, true, id)
  }
})

test('buildCodePractice returns named custom challenge before generated fallback', () => {
  const challenge = buildCodePractice({
    id: 'annotations',
    code: 'class ShouldNotBeUsed {}',
    codeNotes: [['class', 'fallback']],
  })

  assert.equal(challenge.id, 'annotations-custom')
  assert.match(challenge.prompt, /GET \/hello/)
  assert.equal(Boolean(challenge.syntaxTemplate), true)
})

test('buildCodePractice generates challenge from eligible code note fragment', () => {
  const lesson = {
    id: 'generated-demo',
    code: 'public class Demo { return value; }',
    codeNotes: [
      ['public class Demo', 'class declaration'],
      ['return value', 'return statement'],
    ],
  }

  const challenge = buildCodePractice(lesson)

  assert.equal(challenge.id, 'generated-demo-generated')
  assert.equal(challenge.expected, 'public class Demo')
  assert.equal(challenge.answerMode, 'fragment')
  assert.equal(challenge.solution, 'public class Demo')
  assert.equal(challenge.completedExample, lesson.code)
  assert.match(challenge.starter, /TODO: burayı sen yaz/)
  assert.deepEqual(challenge.requirements, [['public class Demo', 'public class Demo']])
})

test('generated fill-in-the-gap activities reject substrings hidden in unrelated answers', () => {
  const java = buildCodePractice({
    id: 'demo-gap',
    code: 'public class Product { }',
    codeNotes: [['public class Product', 'Class tanımı']],
  })
  assert.equal(evaluateCodeRequirements('public class Product', java).staticSuccess, true)
  assert.equal(evaluateCodeRequirements('  public   class  Product  ', java).staticSuccess, true)
  for (const answer of [
    'class Product',
    'public class product',
    'public class Product { }',
    '"public class Product"',
    '// public class Product',
    'not code: public class Product',
  ]) {
    assert.equal(evaluateCodeRequirements(answer, java).staticSuccess, false, answer)
  }
  assert.deepEqual(evaluateCodeRequirements('public class Product', java).checks,
    [{ label: 'Eksik parçayı doğru tamamladın', ok: true }])
  assert.match(evaluateCodeRequirements('public class Product { }', java).feedback, /Kodun tamamını/)
  assert.match(evaluateCodeRequirements('"public class Product"', java).feedback, /yorum veya metin/)
  assert.match(evaluateCodeRequirements('public class product', java).feedback, /Büyük\/küçük harf/)
  assert.match(evaluateCodeRequirements('public class Product more', java).feedback, /fazladan kod/)
  assert.equal(evaluateCodeRequirements('public class Product', java).feedback, null)
})

test('generated exercises use lesson-appropriate missing-part markers', () => {
  const expected = {
    config: ['timeout: 2s', '# TODO: eksik yapılandırma'],
    'python-basics': ['def active_names', '# TODO: eksik Python ifadesi'],
    'git-workflow': ['git switch -c', '# TODO: eksik komut'],
    'docker-basics': ['FROM', '# TODO: eksik Dockerfile ifadesi'],
    'test-strategy': ['valid request -> 201', '# TODO: eksik senaryo'],
    'ci-basics': ['git push', '[TODO: eksik adım]'],
    'sql-basics': ['SELECT id, name, price', '/* TODO: burayı sen yaz */'],
  }
  for (const [id, [fragment, placeholder]] of Object.entries(expected)) {
    const lesson = lessons.find((item) => item.id === id)
    const challenge = buildCodePractice(lesson)
    assert.equal(challenge.expected, fragment, id)
    assert.ok(challenge.starter.includes(placeholder), id)
    assert.ok(!challenge.starter.includes(fragment), id)
  }
})

test('generated SQL keywords accept SQL casing, but still reject unrelated extra text', () => {
  const sql = buildCodePractice({
    id: 'sql-demo',
    code: 'SELECT id FROM product;',
    codeNotes: [['SELECT id', 'Seçilecek kolon']],
  })
  assert.equal(evaluateCodeRequirements('select id', sql).staticSuccess, true)
  assert.equal(evaluateCodeRequirements('SELECT id FROM product;', sql).staticSuccess, false)
  assert.equal(evaluateCodeRequirements('"SELECT id"', sql).staticSuccess, false)
})

test('buildCodePractice rejects non-code lessons and unusable fragments', () => {
  assert.equal(buildCodePractice({ id: 'plain', code: 'Bu sadece açıklama.', codeNotes: [['açıklama', 'text']] }), null)
  assert.equal(buildCodePractice({ id: 'missing-notes', code: 'public class Demo {}' }), null)
  assert.equal(buildCodePractice({ id: 'arrow', code: 'public class Demo {}', codeNotes: [['public → class', 'diagram']] }), null)
  assert.equal(buildCodePractice(null), null)
})

test('evaluateCodeRequirements requires all fragments and non-empty answer', () => {
  const challenge = {
    requirements: [['bean', '@Bean'], ['clock', 'Clock clock()']],
  }

  assert.equal(evaluateCodeRequirements('', challenge).staticSuccess, false)
  assert.equal(evaluateCodeRequirements('@Bean', challenge).staticSuccess, false)

  const result = evaluateCodeRequirements('@Bean\nClock clock() { return null; }', challenge)
  assert.equal(result.staticSuccess, true)
  assert.deepEqual(result.checks.map((item) => item.ok), [true, true])
})

test('evaluateCodeRequirements enforces generated expected fragment', () => {
  const challenge = {
    expected: 'SELECT id FROM users',
    requirements: [['query', 'SELECT id FROM users']],
  }

  assert.equal(evaluateCodeRequirements('SELECT name FROM users', challenge).staticSuccess, false)
  assert.equal(evaluateCodeRequirements('SELECT id FROM users', challenge).staticSuccess, true)
})

test('every custom solution satisfies its static requirements', () => {
  for (const [lessonId, challenge] of Object.entries(codePracticeLibrary)) {
    assert.equal(
      evaluateCodeRequirements(challenge.solution, challenge).staticSuccess,
      true,
      `${lessonId} custom solution should satisfy its own requirements`,
    )
  }
})

test('Java Core activities are editable, distinct tasks that reject untouched starters', () => {
  const ids = [
    'java-class', 'methods-constructor', 'interface', 'java-collections',
    'java-hashmap', 'java-exceptions', 'java-streams', 'java-concurrency',
    'java-abstract-composition', 'java-oop',
  ]

  assert.equal(new Set(ids.map((id) => codePracticeLibrary[id].prompt)).size, ids.length)
  for (const id of ids) {
    const challenge = buildCodePractice({ id })
    assert.equal(challenge.editableStarter, true, `${id}: editable starter`)
    assert.ok(challenge.hint && challenge.reviewQuestion && challenge.expectedBehavior, `${id}: guided task`)
    assert.equal(evaluateCodeRequirements(challenge.starter, challenge).staticSuccess, false, `${id}: untouched starter should fail`)
    assert.equal(evaluateCodeRequirements(challenge.solution, challenge).staticSuccess, true, `${id}: published solution should pass`)
  }
})

test('Java Core validation rejects common conceptual mistakes', () => {
  const mistakes = [
    ['java-class', 'Product phone = new Product();', 'Missing fields'],
    ['methods-constructor', codePracticeLibrary['methods-constructor'].solution.replace('this.name = name;', 'this.name = "Sabit";'), 'Constructor ignores input'],
    ['interface', codePracticeLibrary.interface.solution.replace('return amount > 0;', 'return true;'), 'Payment accepts zero'],
    ['java-collections', codePracticeLibrary['java-collections'].solution.replace('new HashSet<>()', 'new ArrayList<>()'), 'Set implementation changed'],
    ['java-hashmap', codePracticeLibrary['java-hashmap'].solution.replace('users.get(new UserKey(42))', 'users.get(null)'), 'Lookup with wrong key'],
    ['java-exceptions', codePracticeLibrary['java-exceptions'].solution.replace('requested > stock', 'requested < stock'), 'Wrong stock comparison'],
    ['java-streams', codePracticeLibrary['java-streams'].solution.replace('.filter(p -> p.active())', '.filter(p -> true)'), 'Stream missing active filter'],
    ['java-concurrency', codePracticeLibrary['java-concurrency'].solution.replace('synchronized int getValue()', 'int getValue()'), 'Unsynchronized read'],
    ['java-abstract-composition', codePracticeLibrary['java-abstract-composition'].solution.replace('notifier.send(message)', 'new EmailNotifier().send(message)'), 'Bypasses injection'],
    ['java-oop', codePracticeLibrary['java-oop'].solution.replace('super(amount)', 'super(null)'), 'Broken parent initialization'],
  ]

  for (const [id, wrongAnswer, reason] of mistakes) {
    assert.equal(evaluateCodeRequirements(wrongAnswer, codePracticeLibrary[id]).staticSuccess, false, `${id}: ${reason}`)
  }
})

test('Java Core challenges reject leftover TODO markers and requirements inside comments', () => {
  const challenge = codePracticeLibrary['java-class']
  assert.equal(evaluateCodeRequirements(`${challenge.solution}\n// TODO left behind`, challenge).staticSuccess, false)
  assert.equal(evaluateCodeRequirements('class Product {} // String name; double price; Product phone = new Product();', challenge).staticSuccess, false)
})

test('Spring Boot exercises require topic-specific editable code and guided reflection', () => {
  const ids = [
    'annotations', 'beans', 'ioc-di', 'rest', 'request-inputs',
    'validation', 'repository', 'transactions', 'exceptions',
  ]
  const challenges = ids.map((id) => buildCodePractice({ id }))

  assert.equal(new Set(challenges.map((challenge) => challenge.prompt)).size, ids.length)
  assert.equal(new Set(challenges.map((challenge) => challenge.solution)).size, ids.length)
  for (const [index, challenge] of challenges.entries()) {
    const id = ids[index]
    assert.equal(challenge.editableStarter, true, `${id}: editable starter`)
    assert.match(challenge.starter, /TODO/, `${id}: unfinished real code`)
    assert.ok(challenge.hint && challenge.expectedBehavior && challenge.reviewQuestion, `${id}: guided exercise`)
    assert.equal(evaluateCodeRequirements(challenge.starter, challenge).staticSuccess, false, `${id}: untouched starter fails`)
    assert.equal(evaluateCodeRequirements(challenge.solution, challenge).staticSuccess, true, `${id}: solution succeeds`)
    assert.equal(evaluateCodeRequirements(`${challenge.solution}\n// TODO`, challenge).staticSuccess, false, `${id}: TODO remains`)
  }
})

test('Spring Boot exercises reject incorrect design or HTTP behavior', () => {
  const mistakes = [
    ['annotations', 'return greetings.greet();', 'return "Merhaba";', 'Controller bypasses service'],
    ['beans', '@Scope("prototype")', '@Scope("singleton")', 'Tracker mistakenly singleton'],
    ['ioc-di', 'return paymentClient.charge(cents);', 'return true;', 'No payment delegation'],
    ['rest', 'ResponseEntity.created(', 'ResponseEntity.ok(', 'Returns 200 instead of 201'],
    ['request-inputs', '@PathVariable Long id', '@RequestParam Long id', 'Wrong input source'],
    ['validation', '@NotBlank @Email String email', '@Email String email', 'Empty email accepted'],
    ['repository', 'findByActiveTrueOrderByNameAsc()', 'findAll()', 'Wrong query semantics'],
    ['transactions', '@Transactional', '@Service', 'Missing transaction boundary'],
    ['exceptions', 'HttpStatus.NOT_FOUND', 'HttpStatus.INTERNAL_SERVER_ERROR', 'Missing 404 mapping'],
  ]

  for (const [id, correctPart, wrongPart, description] of mistakes) {
    const challenge = codePracticeLibrary[id]
    assert.ok(challenge.solution.includes(correctPart), `${id}: test fixture`)
    const wrongAnswer = challenge.solution.replace(correctPart, wrongPart)
    assert.equal(evaluateCodeRequirements(wrongAnswer, challenge).staticSuccess, false, `${id}: ${description}`)
  }
})

test('Spring repository, transaction and exception checks reject code in the wrong scope', async () => {
  const { parse } = await import('java-parser')
  const repository = codePracticeLibrary.repository
  const transactions = codePracticeLibrary.transactions
  const exceptions = codePracticeLibrary.exceptions

  const misplacedId = repository.solution.replace('  @Id\n  Long id;', '  Long id;')
    + '\nclass OtherEntity { @Id Long id; }'
  const misplacedQueries = repository.solution.replace(
    '  List<Product> findByActiveTrueOrderByNameAsc();\n  Optional<Product> findBySku(String sku);',
    '',
  ) + '\ninterface OtherRepository { List<Product> findByActiveTrueOrderByNameAsc(); Optional<Product> findBySku(String sku); }'
  const misplacedLedgerCalls = transactions.solution.replace(
    '    ledger.debit(fromId, amount);\n    ledger.credit(toId, amount);',
    '',
  ).replace(
    '  }\n}',
    '  }\n  void audit(long fromId, long toId, BigDecimal amount) { ledger.debit(fromId, amount); ledger.credit(toId, amount); }\n}',
  )
  const reversedLedgerCalls = transactions.solution.replace(
    '    ledger.debit(fromId, amount);\n    ledger.credit(toId, amount);',
    '    ledger.credit(toId, amount);\n    ledger.debit(fromId, amount);',
  )
  const misplacedErrorResponse = exceptions.solution.replace(
    '    return ResponseEntity.status(HttpStatus.NOT_FOUND)\n      .body(new ErrorResponse("PRODUCT_NOT_FOUND", ex.getMessage()));',
    '    return null;',
  ).replace(
    '  }\n}',
    '  }\n  ResponseEntity<ErrorResponse> unrelated(ProductNotFoundException ex) { return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse("PRODUCT_NOT_FOUND", ex.getMessage())); }\n}',
  )

  for (const [id, answer, label] of [
    ['repository', misplacedId, 'JPA kimliği Product entity içinde'],
    ['repository', misplacedQueries, 'Derived query metotları ProductRepository içinde'],
    ['transactions', misplacedLedgerCalls, 'Tutar kontrolü ve debit/credit, TransferService.transfer() içinde ve doğru sırada'],
    ['transactions', reversedLedgerCalls, 'Tutar kontrolü ve debit/credit, TransferService.transfer() içinde ve doğru sırada'],
    ['exceptions', misplacedErrorResponse, '404 ve hata gövdesi ApiExceptionHandler.handle() içinde'],
  ]) {
    assert.doesNotThrow(() => parse(answer), `${id}: Java grammar is valid`)
    const result = evaluateCodeRequirements(answer, codePracticeLibrary[id])
    assert.equal(result.staticSuccess, false, `${id}: misplaced logic cannot pass`)
    assert.equal(result.checks.find((check) => check.label === label)?.ok, false, `${id}: scope-specific feedback`)
  }

  for (const id of ['repository', 'transactions', 'exceptions']) {
    assert.equal(evaluateCodeRequirements(codePracticeLibrary[id].solution, codePracticeLibrary[id]).staticSuccess, true, `${id}: published solution still passes`)
  }
})

test('Spring controller, bean and dependency-injection checks reject misplaced implementations', async () => {
  const { parse } = await import('java-parser')
  const annotations = codePracticeLibrary.annotations.solution.replace(
    '    return greetings.greet();',
    '    return "Merhaba";',
  ) + '\nclass OtherController { String extra() { return greetings.greet(); } }'
  const beans = codePracticeLibrary.beans.solution.replace(
    '  @Bean\n  Clock clock() {\n    return Clock.systemUTC();\n  }',
    '',
  ) + '\nclass OtherConfig { @Bean Clock clock() { return Clock.systemUTC(); } }'
  const injection = codePracticeLibrary['ioc-di'].solution.replace(
    '    return paymentClient.charge(cents);',
    '    return false;',
  ).replace('  }\n}', '  }\n  boolean other(int cents) { return paymentClient.charge(cents); }\n}')
  const rest = codePracticeLibrary.rest.solution.replace(
    '    ProductResponse saved = service.create(request);\n    return ResponseEntity.created(URI.create("/products/" + saved.id())).body(saved);',
    '    return null;',
  ).replace(
    '  }\n}',
    '  }\n  ResponseEntity<ProductResponse> other(CreateProductRequest request) { ProductResponse saved = service.create(request); return ResponseEntity.created(URI.create("/products/" + saved.id())).body(saved); }\n}',
  )
  const requestInputs = codePracticeLibrary['request-inputs'].solution.replace(
    '    return request.name();',
    '    return "unused";',
  ).replace('  }\n}', '  }\n  String other(CreateProductRequest request) { return request.name(); }\n}')
  const validation = codePracticeLibrary.validation.solution.replace(
    'record CreateUserRequest(\n  @NotBlank String name,\n  @NotBlank @Email String email\n) {}',
    'record CreateUserRequest(String name, String email) {}',
  ) + '\nrecord OtherRequest(@NotBlank String name, @NotBlank @Email String email) {}'

  for (const [id, answer, label] of [
    ['annotations', annotations, 'Service çağrısı GreetingController.hello() içinde'],
    ['beans', beans, 'Bean fabrikaları AppConfig içinde'],
    ['ioc-di', injection, 'Geçersiz tutar kontrolü ve ödeme çağrısı checkout() içinde'],
    ['rest', rest, 'Kayıt, 201 Location ve body create() içinde'],
    ['request-inputs', requestInputs, 'Request body create() içinde kullanılıyor'],
    ['validation', validation, 'DTO alanları üzerinde Bean Validation'],
  ]) {
    assert.doesNotThrow(() => parse(answer), `${id}: valid Java grammar`)
    const result = evaluateCodeRequirements(answer, codePracticeLibrary[id])
    assert.equal(result.staticSuccess, false, `${id}: misplaced logic cannot pass`)
    assert.equal(result.checks.find((check) => check.label === label)?.ok, false, `${id}: targeted feedback`)
  }

  for (const id of ['annotations', 'beans', 'ioc-di', 'rest', 'request-inputs', 'validation']) {
    assert.equal(evaluateCodeRequirements(codePracticeLibrary[id].solution, codePracticeLibrary[id]).staticSuccess, true, `${id}: published solution still passes`)
  }
})

test('every syntax-enabled custom solution parses in at least one supported template', async () => {
  const { parse } = await import('java-parser')

  for (const [lessonId, challenge] of Object.entries(codePracticeLibrary)) {
    const templates = getSyntaxTemplates(challenge)
    if (!templates.length) continue

    const parses = templates.some((template) => {
      try {
        parse(template.replace('__ANSWER__', challenge.solution))
        return true
      } catch {
        return false
      }
    })

    assert.equal(parses, true, `${lessonId} custom solution should parse in a supported syntax template`)
  }
})

test('every curriculum code challenge accepts its published solution', async () => {
  const { parse } = await import('java-parser')
  let challengeCount = 0

  for (const lesson of lessons) {
    const challenge = buildCodePractice(lesson)
    if (!challenge) continue
    challengeCount += 1

    assert.equal(
      evaluateCodeRequirements(challenge.solution, challenge).staticSuccess,
      true,
      `${lesson.id} published solution should satisfy static requirements`,
    )

    const templates = getSyntaxTemplates(challenge)
    if (!templates.length) continue
    const parses = templates.some((template) => {
      try {
        parse(template.replace('__ANSWER__', challenge.solution))
        return true
      } catch {
        return false
      }
    })

    assert.equal(parses, true, `${lesson.id} published solution should pass Java syntax parsing`)
  }

  assert.equal(challengeCount, 47)
})
