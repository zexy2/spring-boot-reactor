import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { springCodeChallenges } from '../src/learning/springCodeChallenges.js'

// Compile ONLY trusted repository references. Never send learner submissions to javac.
// Each reference is a separate Java compilation unit to prevent class-name collisions.
const checks = {
  annotations: `
    try (var context = new org.springframework.context.annotation.AnnotationConfigApplicationContext(
        GreetingService.class, GreetingController.class)) {
      require("Merhaba".equals(context.getBean(GreetingController.class).hello()), "Spring constructor injection");
    }
    var response = org.springframework.test.web.servlet.setup.MockMvcBuilders
      .standaloneSetup(new GreetingController(new GreetingService())).build()
      .perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/hello"))
      .andReturn().getResponse();
    require(response.getStatus() == 200 && "Merhaba".equals(response.getContentAsString()), "GET /hello");
  `,
  beans: `
    try (var context = new org.springframework.context.annotation.AnnotationConfigApplicationContext(AppConfig.class)) {
      require(context.getBean(java.time.Clock.class) == context.getBean(java.time.Clock.class), "singleton clock");
      require(context.getBean(RequestTracker.class) != context.getBean(RequestTracker.class), "prototype tracker");
    }
  `,
  'ioc-di': `
    int[] calls = {0};
    CheckoutService checkout = new CheckoutService(cents -> { calls[0]++; return cents == 500; });
    require(!checkout.checkout(0) && calls[0] == 0, "invalid amount must not charge");
    require(checkout.checkout(500) && calls[0] == 1, "injected payment client");
    require(!checkout.checkout(200) && calls[0] == 2, "payment failure propagated");
  `,
  rest: `
    var controller = new ProductController(request -> new ProductResponse(42L, request.name()));
    var response = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(controller)
      .build().perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .post("/products").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
        .content("{\\"name\\":\\"Kalem\\"}")).andReturn().getResponse();
    require(response.getStatus() == 201, "POST returns 201");
    require("/products/42".equals(response.getHeader("Location")), "Location points to created resource");
    require(response.getContentAsString().contains("Kalem"), "response includes created product");
  `,
  'request-inputs': `
    var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
      .standaloneSetup(new ProductController()).build();
    var getDefault = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
      .get("/products/5")).andReturn().getResponse();
    require("5 / TRY".equals(getDefault.getContentAsString()), "default query");
    var getUsd = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
      .get("/products/5").param("currency", "USD")).andReturn().getResponse();
    require("5 / USD".equals(getUsd.getContentAsString()), "explicit query");
    var post = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
      .post("/products").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
      .content("{\\"name\\":\\"Kalem\\"}")).andReturn().getResponse();
    require(post.getStatus() == 200 && "Kalem".equals(post.getContentAsString()), "JSON body");
  `,
  validation: `
    var validator = new org.springframework.validation.beanvalidation.LocalValidatorFactoryBean();
    validator.afterPropertiesSet();
    try {
      var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
        .standaloneSetup(new UserController()).setValidator(validator).build();
      var badName = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .post("/users").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
        .content("{\\"name\\":\\" \\",\\"email\\":\\"a@example.com\\"}")).andReturn().getResponse();
      require(badName.getStatus() == 400, "blank name rejected");
      var badEmail = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .post("/users").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
        .content("{\\"name\\":\\"Ali\\",\\"email\\":\\"invalid\\"}")).andReturn().getResponse();
      require(badEmail.getStatus() == 400, "invalid email rejected");
      var good = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .post("/users").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
        .content("{\\"name\\":\\"Ali\\",\\"email\\":\\"ali@example.com\\"}")).andReturn().getResponse();
      require(good.getStatus() == 201, "valid user accepted");
    } finally { validator.destroy(); }
  `,
  repository: `
    require(Product.class.isAnnotationPresent(jakarta.persistence.Entity.class), "JPA entity");
    require(Product.class.getDeclaredField("id").isAnnotationPresent(jakarta.persistence.Id.class), "JPA id");
    var query = new org.springframework.data.repository.query.parser.PartTree(
      "findByActiveTrueOrderByNameAsc", Product.class);
    require(query.getSort().getOrderFor("name").isAscending(), "derived query sort");
    var sku = new org.springframework.data.repository.query.parser.PartTree("findBySku", Product.class);
    require(sku.getParts().iterator().next().getProperty().toDotPath().equals("sku"), "SKU property");
  `,
  transactions: `
    java.util.List<String> calls = new java.util.ArrayList<>();
    LedgerRepository ledger = new LedgerRepository() {
      public void debit(long id, java.math.BigDecimal amount) { calls.add("debit"); }
      public void credit(long id, java.math.BigDecimal amount) { calls.add("credit"); }
    };
    var service = new TransferService(ledger);
    try {
      service.transfer(1, 2, java.math.BigDecimal.ZERO);
      throw new AssertionError("zero transfer accepted");
    } catch (IllegalArgumentException expected) {
      require(calls.isEmpty(), "invalid transfer changed ledger");
    }
    service.transfer(1, 2, java.math.BigDecimal.ONE);
    require(calls.equals(java.util.List.of("debit", "credit")), "transfer order");
    require(TransferService.class.getDeclaredMethod("transfer", long.class, long.class, java.math.BigDecimal.class)
      .isAnnotationPresent(org.springframework.transaction.annotation.Transactional.class), "transaction annotation");
  `,
  exceptions: `
    var response = org.springframework.test.web.servlet.setup.MockMvcBuilders
      .standaloneSetup(new ThrowingController()).setControllerAdvice(new ApiExceptionHandler()).build()
      .perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/missing"))
      .andReturn().getResponse();
    require(response.getStatus() == 404, "not found status");
    require(response.getContentAsString().contains("PRODUCT_NOT_FOUND"), "error code");
    require(response.getContentAsString().contains("Yok"), "exception message");
  `,
}

const auxiliary = {
  exceptions: `
  @org.springframework.web.bind.annotation.RestController
  static class ThrowingController {
    @org.springframework.web.bind.annotation.GetMapping("/missing")
    String missing() { throw new ProductNotFoundException("Yok"); }
  }
  `,
}

function run(binary, args, workdir, timeout = 30_000) {
  const result = spawnSync(binary, args, {
    cwd: workdir,
    timeout,
    encoding: 'utf8',
    maxBuffer: 512 * 1024,
  })
  if (result.error || result.status !== 0) {
    throw new Error(`${binary} failed (${result.status ?? 'unavailable'}): ${String(
      result.error?.message || result.stderr || result.stdout,
    ).slice(0, 2000)}`)
  }
}

const workroot = mkdtempSync(join(tmpdir(), 'reactor-spring-refs-'))
try {
  assert.deepEqual(Object.keys(checks).sort(), Object.keys(springCodeChallenges).sort(),
    'Each Spring reference needs a compilation and runtime check')
  const repoRoot = resolve(import.meta.dirname, '..')
  const pom = join(repoRoot, 'tests/spring-reference/pom.xml')
  const classpathFile = join(workroot, 'classpath.txt')
  run('mvn', ['--batch-mode', '-q', '-f', pom,
    'org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath',
    `-Dmdep.outputFile=${classpathFile}`], repoRoot, 180_000)
  const classpath = readFileSync(classpathFile, 'utf8').trim()
  assert.ok(classpath, 'Maven returned no Spring classpath')

  for (const [id, reference] of Object.entries(springCodeChallenges)) {
    const workdir = join(workroot, id)
    mkdirSync(workdir)
    writeFileSync(join(workdir, 'Exercise.java'), reference.solution, 'utf8')
    writeFileSync(join(workdir, 'ReferenceCheck.java'), `
class ReferenceCheck {
  static void require(boolean ok, String label) {
    if (!ok) throw new AssertionError(label);
  }
  ${auxiliary[id] ?? ''}
  public static void main(String[] args) throws Exception {
    ${checks[id]}
  }
}`, 'utf8')
    try {
      run('javac', ['--release', '21', '-parameters', '-encoding', 'UTF-8', '-cp', classpath,
        'Exercise.java', 'ReferenceCheck.java'], workdir)
      run('java', ['-Xmx256m', '-cp', `.${process.platform === 'win32' ? ';' : ':'}${classpath}`,
        'ReferenceCheck'], workdir)
    } catch (error) {
      throw new Error(`${id}: ${error.message}`, { cause: error })
    }
    console.log(`✓ ${id}: real Spring classpath compilation + runtime check`)
  }
  console.log(`Verified ${Object.keys(checks).length} Spring references with JDK 21 and Spring Boot dependencies`)
} finally {
  rmSync(workroot, { recursive: true, force: true })
}
