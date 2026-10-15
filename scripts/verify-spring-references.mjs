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
    try (var context = new org.springframework.context.annotation.AnnotationConfigApplicationContext(
        TransferFixtureConfig.class)) {
      var service = context.getBean(TransferService.class);
      require(org.springframework.aop.support.AopUtils.isAopProxy(service),
        "transfer must be called through a Spring transaction proxy");
      var jdbc = context.getBean(org.springframework.jdbc.core.JdbcTemplate.class);
      jdbc.execute("CREATE TABLE accounts (id BIGINT PRIMARY KEY, balance DECIMAL(12,2) NOT NULL)");
      jdbc.update("INSERT INTO accounts VALUES (1, 100.00), (2, 50.00)");

      // Successful transfer commits both account changes.
      service.transfer(1, 2, new java.math.BigDecimal("10.00"));
      require(balance(jdbc, 1) == 90 && balance(jdbc, 2) == 60,
        "successful transfer must commit both entries");

      // Credit fails after debit. Only a real transaction can undo the debit.
      context.getBean(java.util.concurrent.atomic.AtomicBoolean.class).set(true);
      try {
        service.transfer(1, 2, new java.math.BigDecimal("20.00"));
        throw new AssertionError("credit failure should propagate");
      } catch (CreditFailure expected) {
        require(balance(jdbc, 1) == 90 && balance(jdbc, 2) == 60,
          "failed credit must roll back prior debit");
      }
      context.getBean(java.util.concurrent.atomic.AtomicBoolean.class).set(false);

      try {
        service.transfer(1, 2, java.math.BigDecimal.ZERO);
        throw new AssertionError("zero transfer accepted");
      } catch (IllegalArgumentException expected) {
        require(balance(jdbc, 1) == 90 && balance(jdbc, 2) == 60,
          "invalid amount must not change accounts");
      }

      // Negative control: bypassing Spring proxy must leave debit committed on failure.
      // This proves the rollback check is exercising real transaction management.
      context.getBean(java.util.concurrent.atomic.AtomicBoolean.class).set(true);
      try {
        new TransferService(context.getBean(LedgerRepository.class))
          .transfer(1, 2, new java.math.BigDecimal("20.00"));
        throw new AssertionError("direct transfer credit failure should propagate");
      } catch (CreditFailure expected) {
        require(balance(jdbc, 1) == 70 && balance(jdbc, 2) == 60,
          "without Spring proxy, failed debit must remain committed");
      }
    }
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
  transactions: `
  static int balance(org.springframework.jdbc.core.JdbcTemplate jdbc, long id) {
    return jdbc.queryForObject("SELECT balance FROM accounts WHERE id = ?", int.class, id);
  }

  static class CreditFailure extends RuntimeException {}

  @org.springframework.context.annotation.Configuration
  @org.springframework.transaction.annotation.EnableTransactionManagement(proxyTargetClass = true)
  static class TransferFixtureConfig {
    @org.springframework.context.annotation.Bean
    javax.sql.DataSource dataSource() {
      var source = new org.h2.jdbcx.JdbcDataSource();
      source.setURL("jdbc:h2:mem:transfer_fixture;DB_CLOSE_DELAY=-1");
      return source;
    }

    @org.springframework.context.annotation.Bean
    org.springframework.transaction.PlatformTransactionManager transactionManager(javax.sql.DataSource source) {
      return new org.springframework.jdbc.datasource.DataSourceTransactionManager(source);
    }

    @org.springframework.context.annotation.Bean
    org.springframework.jdbc.core.JdbcTemplate jdbcTemplate(javax.sql.DataSource source) {
      return new org.springframework.jdbc.core.JdbcTemplate(source);
    }

    @org.springframework.context.annotation.Bean
    java.util.concurrent.atomic.AtomicBoolean failCredit() {
      return new java.util.concurrent.atomic.AtomicBoolean(false);
    }

    @org.springframework.context.annotation.Bean
    LedgerRepository ledgerRepository(org.springframework.jdbc.core.JdbcTemplate jdbc,
        java.util.concurrent.atomic.AtomicBoolean failCredit) {
      return new LedgerRepository() {
        public void debit(long id, java.math.BigDecimal amount) {
          require(jdbc.update("UPDATE accounts SET balance = balance - ? WHERE id = ?", amount, id) == 1,
            "debit must update one account");
        }
        public void credit(long id, java.math.BigDecimal amount) {
          if (failCredit.get()) throw new CreditFailure();
          require(jdbc.update("UPDATE accounts SET balance = balance + ? WHERE id = ?", amount, id) == 1,
            "credit must update one account");
        }
      };
    }

    @org.springframework.context.annotation.Bean
    TransferService transferService(LedgerRepository ledger) {
      return new TransferService(ledger);
    }
  }
  `,
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
