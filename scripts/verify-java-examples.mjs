import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { codePracticeLibrary } from '../src/learning/codePractice.js'
import { springCodeChallenges } from '../src/learning/springCodeChallenges.js'

// Only trusted, repository-owned reference solutions are compiled here.
// Submitted learner code stays in the browser and is never executed.
const referenceChecks = {
  'java-class': `
    Product phone = new Product();
    phone.name = "Telefon";
    phone.price = 1299.0;
    require(phone.name.equals("Telefon") && phone.price == 1299.0, "fields");
    new Demo().run();`,
  'methods-constructor': `
    require(new Product("Kalem").label().equals("Ürün: Kalem"), "constructor and label");`,
  interface: `
    PaymentService service = new CardPaymentService();
    require(service.pay(15) && !service.pay(0) && !service.pay(-3), "payment boundary");`,
  'java-collections': `
    new Directory().example();`,
  'java-hashmap': `
    require(new UserKey(42).equals(new UserKey(42)), "record value equality");
    new UserIndex().lookup();`,
  'java-exceptions': `
    Inventory stock = new Inventory();
    stock.reserve(4, 1);
    boolean thrown = false;
    try { stock.reserve(2, 3); }
    catch (OutOfStockException expected) { thrown = true; }
    require(thrown, "out-of-stock error");`,
  'java-streams': `
    var products = java.util.List.of(
      new Product("Z", true), new Product("A", false), new Product("B", true));
    require(new Catalog().activeNames(products).equals(java.util.List.of("B", "Z")),
      "filtered and sorted active names");`,
  'java-concurrency': `
    Counter counter = new Counter();
    java.util.List<Thread> threads = new java.util.ArrayList<>();
    for (int i = 0; i < 4; i++) {
      Thread thread = new Thread(() -> {
        for (int j = 0; j < 1500; j++) counter.increment();
      });
      threads.add(thread);
      thread.start();
    }
    for (Thread thread : threads) thread.join();
    require(counter.getValue() == 6000, "shared counter");`,
  'java-abstract-composition': `
    class RecordingNotifier implements Notifier {
      String received;
      public void send(String message) { received = message; }
    }
    RecordingNotifier notifier = new RecordingNotifier();
    new OrderService(notifier).notifyCustomer("Hazır");
    require("Hazır".equals(notifier.received), "injected notifier");`,
  'java-oop': `
    Payment positive = new CardPayment(new java.math.BigDecimal("10"));
    Payment empty = new CardPayment(java.math.BigDecimal.ZERO);
    require(positive.pay() && !empty.pay(), "overridden pay behavior");`,
}

function command(binary, arguments_, cwd) {
  const result = spawnSync(binary, arguments_, {
    cwd,
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 512 * 1024,
  })
  if (result.error || result.status !== 0) {
    throw new Error(`${binary} failed (${result.status ?? 'unavailable'}): ${String(result.error?.message || result.stderr || result.stdout).slice(0, 2000)}`)
  }
}

const workingRoot = mkdtempSync(join(tmpdir(), 'reactor-java-refs-'))
try {
  const javaIds = Object.keys(codePracticeLibrary).filter((id) => !(id in springCodeChallenges))
  assert.deepEqual(
    javaIds.slice().sort(),
    Object.keys(referenceChecks).sort(),
    'Every Java Core exercise must have a JDK reference check',
  )
  for (const id of javaIds) {
    const workdir = join(workingRoot, id)
    mkdirSync(workdir)
    const reference = codePracticeLibrary[id].solution
    writeFileSync(join(workdir, 'Exercise.java'), reference, 'utf8')
    writeFileSync(join(workdir, 'ReferenceCheck.java'), `
class ReferenceCheck {
  static void require(boolean condition, String message) {
    if (!condition) throw new AssertionError(message);
  }
  public static void main(String[] args) throws Exception {
    ${referenceChecks[id]}
  }
}
`, 'utf8')
    try {
      command('javac', ['--release', '21', '-encoding', 'UTF-8', 'Exercise.java', 'ReferenceCheck.java'], workdir)
      command('java', ['-Xmx128m', '-cp', '.', 'ReferenceCheck'], workdir)
    } catch (error) {
      throw new Error(`${id}: ${error.message}`, { cause: error })
    }
    console.log(`✓ ${id}: javac + runtime smoke check`)
  }
  console.log(`Verified ${javaIds.length} Java Core reference examples with JDK 21`)
} finally {
  rmSync(workingRoot, { recursive: true, force: true })
}
