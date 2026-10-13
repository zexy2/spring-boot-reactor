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
  assert.match(challenge.starter, /TODO: burayı sen yaz/)
  assert.deepEqual(challenge.requirements, [['public class Demo', 'public class Demo']])
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
