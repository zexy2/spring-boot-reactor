import test from 'node:test'
import assert from 'node:assert/strict'

import { lessons } from '../src/data/curriculum.js'
import { arrangeChoices, hashString, shuffleChoices } from '../src/learning/choiceUtils.js'
import {
  getGuidedActiveRecall,
  getGuidedLearningGoal,
  getGuidedPrediction,
  getGuidedSummary,
} from '../src/learning/guidedLearning.js'

test('choice helpers are deterministic and preserve the correct answer', () => {
  const options = ['A', 'B', 'C']
  const explanations = ['EA', 'EB', 'EC']
  const first = shuffleChoices(options, 1, 'seed', explanations)
  const second = shuffleChoices(options, 1, 'seed', explanations)

  assert.deepEqual(first, second)
  assert.equal(first.options[first.answer], 'B')
  assert.equal(first.explanations[first.answer], 'EB')
  assert.equal(hashString('same'), hashString('same'))
})

test('arrangeChoices places correct option at requested deterministic target', () => {
  const result = arrangeChoices(['A', 'B', 'C'], 2, 'seed', 1, ['EA', 'EB', 'EC'])
  assert.equal(result.answer, 1)
  assert.equal(result.options[1], 'C')
  assert.equal(result.explanations[1], 'EC')
})

test('guided learning goal respects custom text and otherwise uses the lesson question', () => {
  assert.equal(getGuidedLearningGoal({ learningGoal: 'Özel hedef' }), 'Özel hedef')

  const generated = getGuidedLearningGoal({
    title: 'DI',
    question: 'DI neden kullanılır?',
    options: ['Coupling artırmak', 'Dependency vermek'],
    answer: 1,
  })
  assert.match(generated, /DI neden kullanılır/)
  assert.match(generated, /DI konusunu/)
})

test('guided prediction deterministically repositions custom choices while preserving the correct answer', () => {
  const lesson = {
    id: 'custom-prediction',
    prediction: { prompt: 'Tahmin?', options: ['A', 'B', 'C'], answer: 0, explanation: 'A' },
  }
  const first = getGuidedPrediction(lesson)
  const second = getGuidedPrediction(lesson)

  assert.deepEqual(first, second)
  assert.equal(first.options[first.answer], 'A')
  assert.equal(first.answer, hashString('custom-prediction-prediction-position') % 3)
  assert.equal(first.explanation, 'A')
})

test('guided prediction generated from code notes is deterministic and keeps source explanation correct', () => {
  const lesson = {
    id: 'demo-prediction',
    codeNotes: [
      ['Controller', 'HTTP sınırı'],
      ['Service', 'İş mantığı'],
      ['Repository', 'Veri erişimi'],
      ['Database', 'Kalıcı veri'],
    ],
  }
  const first = getGuidedPrediction(lesson)
  const second = getGuidedPrediction(lesson)

  assert.deepEqual(first, second)
  assert.equal(first.options.length, 3)
  assert.match(first.explanation, /.+/)
  assert.equal(first.options[first.answer], first.explanation)
})

test('guided prediction falls back to lesson question and rejects incomplete lessons', () => {
  const lesson = {
    id: 'question-fallback',
    question: 'Doğru olan?',
    options: ['Yanlış', 'Doğru'],
    answer: 1,
  }
  assert.deepEqual(getGuidedPrediction(lesson), {
    prompt: 'Dersi okumadan önce tahmin et: Doğru olan?',
    options: ['Yanlış', 'Doğru'],
    answer: 1,
    explanation: 'Doğru seçenek: Doğru. Şimdi bunun nedenini kavramlar ve gerçek örnek üzerinden bağlayacağız.',
  })
  assert.equal(getGuidedPrediction({ id: 'empty' }), null)
})

test('active recall uses supplied lesson terms and does not leak later lesson terms', () => {
  const lesson = {
    title: 'IoC ve DI',
    points: ['Container nesneyi yönetir.', 'Dependency dışarıdan verilir.', 'Sonraki konu burada olmamalı.'],
  }
  const recall = getGuidedActiveRecall(lesson, [
    ['IoC', 'container'],
    ['DI', 'dependency injection'],
    ['Bean', 'managed object'],
  ])

  assert.match(recall.prompt, /IoC, DI, Bean/)
  assert.doesNotMatch(recall.prompt, /sonraki/i)
  assert.equal(recall.answer, 'Container nesneyi yönetir. Dependency dışarıdan verilir.')
})

test('guided summary caps generated summary at three points and respects explicit summary', () => {
  assert.deepEqual(
    getGuidedSummary({ points: ['1', '2', '3', '4'] }),
    ['1', '2', '3'],
  )
  assert.deepEqual(
    getGuidedSummary({ lessonSummary: ['A', 'B'], points: ['1'] }),
    ['A', 'B'],
  )
})

test('all 102 curriculum lessons produce a complete guided-learning shell', () => {
  assert.equal(lessons.length, 102)

  for (const lesson of lessons) {
    const goal = getGuidedLearningGoal(lesson)
    const prediction = getGuidedPrediction(lesson)
    const recall = getGuidedActiveRecall(lesson, lesson.terms ?? [])
    const summary = getGuidedSummary(lesson)

    assert.ok(String(goal).trim(), `${lesson.id} should have a learning goal`)
    assert.ok(prediction, `${lesson.id} should have a prediction`)
    assert.ok(String(prediction.prompt ?? '').trim(), `${lesson.id} prediction should have a prompt`)
    assert.ok(Array.isArray(prediction.options) && prediction.options.length >= 2, `${lesson.id} prediction should have options`)
    assert.ok(Number.isInteger(prediction.answer), `${lesson.id} prediction should have an answer index`)
    assert.ok(String(recall.prompt ?? '').trim(), `${lesson.id} should have an active recall prompt`)
    assert.ok(String(recall.answer ?? '').trim(), `${lesson.id} should have an active recall reference answer`)
    assert.ok(summary.length > 0, `${lesson.id} should have a summary`)
  }
})

test('all 102 curriculum lessons define explicit concept-specific guided content', () => {
  assert.equal(lessons.length, 102)

  for (const lesson of lessons) {
    assert.ok(String(lesson.learningGoal ?? '').trim(), `${lesson.id} should define learningGoal`)
    assert.ok(lesson.prediction, `${lesson.id} should define prediction`)
    assert.ok(String(lesson.prediction.prompt ?? '').trim(), `${lesson.id} prediction should define prompt`)
    assert.equal(lesson.prediction.options?.length, 3, `${lesson.id} prediction should have exactly 3 options`)
    assert.equal(
      new Set(lesson.prediction.options.map((option) => String(option).trim().toLocaleLowerCase('tr-TR'))).size,
      3,
      `${lesson.id} prediction options should be unique`,
    )
    assert.ok(
      Number.isInteger(lesson.prediction.answer)
        && lesson.prediction.answer >= 0
        && lesson.prediction.answer < lesson.prediction.options.length,
      `${lesson.id} prediction answer should be valid`,
    )
    assert.ok(String(lesson.prediction.explanation ?? '').trim(), `${lesson.id} prediction should explain the answer`)
    assert.ok(Array.isArray(lesson.lessonSummary) && lesson.lessonSummary.length >= 3, `${lesson.id} should define a 3-point summary`)
  }
})

test('guided prediction answer positions stay balanced after deterministic arrangement', () => {
  const counts = [0, 0, 0]
  for (const lesson of lessons) {
    const prediction = getGuidedPrediction(lesson)
    counts[prediction.answer] += 1
  }

  assert.equal(counts.reduce((sum, value) => sum + value, 0), lessons.length)
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 10, `answer positions are too predictable: ${counts.join('/')}`)
})

test('Java Core teaches primitive-wrapper and array-list distinctions before collections', () => {
  const typeLesson = lessons.find((lesson) => lesson.id === 'generics-record')
  const collectionsIndex = lessons.findIndex((lesson) => lesson.id === 'java-collections')
  const typeLessonIndex = lessons.findIndex((lesson) => lesson.id === 'generics-record')
  const terms = new Set((typeLesson?.terms ?? []).map(([term]) => term))

  assert.ok(typeLesson)
  assert.ok(typeLessonIndex >= 0 && typeLessonIndex < collectionsIndex)
  assert.ok(terms.has('primitive'))
  assert.ok(terms.has('wrapper'))
  assert.ok(terms.has('array'))
  assert.ok(terms.has('List<T>'))
  assert.match(typeLesson.prediction?.prompt ?? '', /List<int>/)
})

test('curriculum teaches prerequisite concepts before dependent interview topics', () => {
  const indexOf = (id) => lessons.findIndex((lesson) => lesson.id === id)
  const before = (first, second) => {
    assert.ok(indexOf(first) >= 0, `${first} should exist`)
    assert.ok(indexOf(second) >= 0, `${second} should exist`)
    assert.ok(indexOf(first) < indexOf(second), `${first} should be taught before ${second}`)
  }

  before('spring-vs-boot', 'project-anatomy')
  before('ioc-di', 'beans')
  before('beans', 'annotations')
  before('rest', 'request-flow')
  before('database-acid', 'transactions')
  before('transactions', 'spring-aop-proxy')
  before('maven-artifact', 'ci-basics')
  before('ci-basics', 'cd-basics')
})
