import test from 'node:test'
import assert from 'node:assert/strict'

import { lessons } from '../src/data/curriculum.js'
import {
  codeNoteConceptId,
  checkpointMasteryState,
  evaluateRecallCoverage,
  learningRecord,
  migrateLegacyCodeConceptIds,
  recordConceptAnswer,
  recordCheckpointAnswer,
  recordRecallCoverage,
  weakestConceptId,
  learningStatus,
  dueReviewLessons,
  buildDailyStudyPlan,
  calculateInterviewReadiness,
  nextReviewInterval,
  formatReviewDistance,
  recordInterviewAttempt,
} from '../src/learning/learningState.js'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const NOW = Date.UTC(2026, 9, 5, 12, 0, 0)

function withFixedNow(now, run) {
  const originalNow = Date.now
  Date.now = () => now
  try {
    return run()
  } finally {
    Date.now = originalNow
  }
}

test('codeNoteConceptId is stable for the same fragment independent of note order', () => {
  const fragment = '@Transactional public void save()'
  const first = codeNoteConceptId('transactions', fragment)
  const reordered = codeNoteConceptId('transactions', fragment)

  assert.equal(first, reordered)
  assert.match(first, /^transactions-code-/)
})

test('migrateLegacyCodeConceptIds moves index-based concept history to stable fragment ids', () => {
  const firstStableId = codeNoteConceptId('demo', 'Controller')
  const secondStableId = codeNoteConceptId('demo', 'Service')
  const record = {
    ...learningRecord(undefined, 'demo'),
    concepts: {
      'demo-code-0': { attempts: 2, correct: 1, wrong: 1, strength: 42 },
      'demo-code-1': { attempts: 3, correct: 3, wrong: 0, strength: 76 },
      'demo-main': { attempts: 1, correct: 1, wrong: 0, strength: 12 },
    },
  }

  const migrated = migrateLegacyCodeConceptIds(record, 'demo', [
    ['Controller', 'HTTP giriş noktası'],
    ['Service', 'İş mantığı'],
  ])

  assert.deepEqual(migrated.concepts[firstStableId], record.concepts['demo-code-0'])
  assert.deepEqual(migrated.concepts[secondStableId], record.concepts['demo-code-1'])
  assert.deepEqual(migrated.concepts['demo-main'], record.concepts['demo-main'])
  assert.equal(Object.hasOwn(migrated.concepts, 'demo-code-0'), false)
  assert.equal(Object.hasOwn(migrated.concepts, 'demo-code-1'), false)
})

test('evaluateRecallCoverage matches Turkish text case-insensitively by full label or meaningful tokens', () => {
  assert.deepEqual(
    evaluateRecallCoverage('İŞ MANTIĞI servis katmanında tutulur. BAĞIMLILIK için ENJEKSİYONU ayrıca anlatılır.', [
      { conceptId: 'service', label: 'İş Mantığı' },
      { conceptId: 'di', label: 'Bağımlılık Enjeksiyonu' },
      { conceptId: 'repo', label: 'Veri Erişimi' },
    ]),
    {
      coveredCount: 2,
      total: 3,
      results: [
        { conceptId: 'service', label: 'İş Mantığı', covered: true },
        { conceptId: 'di', label: 'Bağımlılık Enjeksiyonu', covered: true },
        { conceptId: 'repo', label: 'Veri Erişimi', covered: false },
      ],
    },
  )
})

test('evaluateRecallCoverage ignores invalid and empty targets', () => {
  assert.deepEqual(
    evaluateRecallCoverage('controller', [
      null,
      {},
      { conceptId: '', label: 'Controller' },
      { conceptId: 'empty-label', label: '   ' },
      { conceptId: 'controller', label: 'Controller' },
    ]),
    {
      coveredCount: 1,
      total: 1,
      results: [{ conceptId: 'controller', label: 'Controller', covered: true }],
    },
  )
})

test('recordRecallCoverage records full, partial, and missed lesson outcomes', () => {
  const start = {
    ...learningRecord(undefined, 'missing'),
    strength: 50,
  }
  const full = recordRecallCoverage(start, [
    { conceptId: 'mvc', label: 'MVC', covered: true },
    { conceptId: 'di', label: 'DI', covered: true },
  ])
  const partial = recordRecallCoverage(full, [
    { conceptId: 'mvc', label: 'MVC', covered: true },
    { conceptId: 'di', label: 'DI', covered: false },
  ])
  const missed = recordRecallCoverage(partial, [
    { conceptId: 'mvc', label: 'MVC', covered: false },
    { conceptId: 'di', label: 'DI', covered: false },
  ])

  assert.deepEqual(
    {
      recallAttempts: missed.recallAttempts,
      recallFull: missed.recallFull,
      recallPartial: missed.recallPartial,
      recallMissed: missed.recallMissed,
      strength: missed.strength,
    },
    { recallAttempts: 3, recallFull: 1, recallPartial: 1, recallMissed: 1, strength: 50 },
  )
})

test('recordRecallCoverage preserves quiz counters, scheduling timestamps, and unrelated fields', () => {
  const record = {
    ...learningRecord(undefined, 'missing'),
    attempts: 7,
    correct: 5,
    wrong: 2,
    strength: 40,
    intervalDays: 9,
    nextReviewAt: NOW + DAY_MS,
    lastReviewedAt: NOW - DAY_MS,
    masteredAt: NOW - (2 * DAY_MS),
    customNote: 'keep-me',
  }

  const updated = recordRecallCoverage(record, [
    { conceptId: 'mvc', label: 'MVC', covered: true },
  ])

  assert.equal(updated.attempts, 7)
  assert.equal(updated.correct, 5)
  assert.equal(updated.wrong, 2)
  assert.equal(updated.intervalDays, 9)
  assert.equal(updated.nextReviewAt, NOW + DAY_MS)
  assert.equal(updated.lastReviewedAt, NOW - DAY_MS)
  assert.equal(updated.masteredAt, NOW - (2 * DAY_MS))
  assert.equal(updated.customNote, 'keep-me')
})

test('recordRecallCoverage records coverage without changing mastery evidence', () => {
  const source = {
    ...learningRecord(undefined, 'missing'),
    strength: 95,
    concepts: {
      covered: { attempts: 2, correct: 1, wrong: 1, strength: 96, note: 'keep' },
      missed: { attempts: 4, correct: 3, wrong: 1, strength: 3 },
    },
  }
  const updated = recordRecallCoverage(source, [
    { conceptId: 'covered', label: 'Covered', covered: true },
    { conceptId: 'missed', label: 'Missed', covered: false },
    { conceptId: 'new', label: 'New', covered: true },
  ])

  assert.equal(updated.strength, 95)
  assert.deepEqual(updated.concepts, source.concepts)
  assert.equal(Object.hasOwn(updated.concepts, 'new'), false)
})

test('recordRecallCoverage leaves record unchanged when there are no valid results', () => {
  const record = {
    ...learningRecord(undefined, 'missing'),
    strength: 55,
    customNote: 'keep-me',
  }

  assert.deepEqual(recordRecallCoverage(record, []), record)
  assert.deepEqual(recordRecallCoverage(record, [{ covered: true }]), record)
})

test('learningRecord supplies defaults and overlays saved progress', () => {
  const lessonId = lessons[0].id
  const record = learningRecord({
    [lessonId]: {
      attempts: 4,
      correct: 3,
      strength: 72,
      codePassed: true,
    },
  }, lessonId)

  assert.deepEqual(record, {
    attempts: 4,
    correct: 3,
    wrong: 0,
    strength: 72,
    concepts: {},
    intervalDays: 0,
    nextReviewAt: 0,
    lastReviewedAt: 0,
    masteredAt: 0,
    codePassed: true,
    completionEvidenceVersion: 0,
    interviewAttempts: 0,
    interviewBestScore: 0,
    lastInterviewAt: 0,
    debugAttempts: 0,
    debugCorrect: 0,
    debugWrong: 0,
    debugHints: 0,
    debugSolved: false,
  })

  assert.deepEqual(learningRecord(undefined, 'missing'), {
    attempts: 0,
    correct: 0,
    wrong: 0,
    strength: 0,
    concepts: {},
    intervalDays: 0,
    nextReviewAt: 0,
    lastReviewedAt: 0,
    masteredAt: 0,
    codePassed: false,
    completionEvidenceVersion: 0,
    interviewAttempts: 0,
    interviewBestScore: 0,
    lastInterviewAt: 0,
    debugAttempts: 0,
    debugCorrect: 0,
    debugWrong: 0,
    debugHints: 0,
    debugSolved: false,
  })
})

test('recordInterviewAttempt increments attempts and keeps the best 0-4 score', () => {
  const base = learningRecord(undefined, 'interview-demo')
  const first = recordInterviewAttempt(base, 3, NOW)
  const second = recordInterviewAttempt(first, 2, NOW + HOUR_MS)
  const clamped = recordInterviewAttempt(second, 9, NOW + (2 * HOUR_MS))

  assert.equal(first.interviewAttempts, 1)
  assert.equal(first.interviewBestScore, 3)
  assert.equal(second.interviewAttempts, 2)
  assert.equal(second.interviewBestScore, 3)
  assert.equal(clamped.interviewAttempts, 3)
  assert.equal(clamped.interviewBestScore, 4)
  assert.equal(clamped.lastInterviewAt, NOW + (2 * HOUR_MS))
})

test('calculateInterviewReadiness separates curriculum coverage from evidence quality', () => {
  const first = lessons[0]
  const completed = new Set([first.id])
  const learning = {
    [first.id]: {
      strength: 80,
      correct: 8,
      wrong: 2,
      recallAttempts: 2,
      recallFull: 1,
      recallPartial: 1,
      interviewBestScore: 3,
      nextReviewAt: NOW + DAY_MS,
    },
  }

  const readiness = calculateInterviewReadiness(completed, learning, NOW)

  assert.equal(readiness.coverage, Math.round((1 / lessons.length) * 100))
  assert.equal(readiness.strength, 80)
  assert.equal(readiness.retention, 100)
  assert.equal(readiness.accuracy, 80)
  assert.equal(readiness.recall, 75)
  assert.equal(readiness.interview, 75)
  assert.ok(readiness.score >= 0 && readiness.score <= readiness.coverage)
})

test('recordConceptAnswer initializes concept stats and preserves unrelated record fields', () => {
  const record = {
    ...learningRecord(undefined, 'missing'),
    intervalDays: 7,
    nextReviewAt: NOW + DAY_MS,
    codePassed: true,
    customNote: 'keep-me',
  }

  const updated = recordConceptAnswer(record, 'dependency-injection', true)

  assert.equal(updated.attempts, 1)
  assert.equal(updated.correct, 1)
  assert.equal(updated.wrong, 0)
  assert.equal(updated.strength, 12)
  assert.deepEqual(updated.concepts['dependency-injection'], {
    attempts: 1,
    correct: 1,
    wrong: 0,
    strength: 12,
  })
  assert.equal(updated.intervalDays, 7)
  assert.equal(updated.nextReviewAt, NOW + DAY_MS)
  assert.equal(updated.codePassed, true)
  assert.equal(updated.customNote, 'keep-me')
})

test('recordConceptAnswer updates repeated attempts and keeps concepts independent', () => {
  const start = learningRecord(undefined, 'missing')
  const first = recordConceptAnswer(start, 'mvc', true)
  const second = recordConceptAnswer(first, 'mvc', false)
  const third = recordConceptAnswer(second, 'jpa', true)

  assert.deepEqual(third.concepts.mvc, {
    attempts: 2,
    correct: 1,
    wrong: 1,
    strength: 0,
  })
  assert.deepEqual(third.concepts.jpa, {
    attempts: 1,
    correct: 1,
    wrong: 0,
    strength: 12,
  })
  assert.deepEqual(
    { attempts: third.attempts, correct: third.correct, wrong: third.wrong, strength: third.strength },
    { attempts: 3, correct: 2, wrong: 1, strength: 12 },
  )
})

test('checkpoint mastery persists correct concepts and retry counts across reloads', () => {
  const start = learningRecord(undefined, 'missing')
  const firstWrong = recordCheckpointAnswer(start, 'mvc', false)
  const secondWrong = recordCheckpointAnswer(firstWrong, 'mvc', false)
  const mastered = recordCheckpointAnswer(secondWrong, 'di', true)

  assert.deepEqual(checkpointMasteryState(mastered, ['mvc', 'di', 'jpa']), {
    masteredConceptIds: ['di'],
    retryAttempts: { mvc: 2 },
  })
})

test('checkpoint mastery clears retry debt after concept is mastered and ignores stale concepts', () => {
  const record = {
    ...learningRecord(undefined, 'missing'),
    masteryCheckpoint: {
      masteredConceptIds: ['di', 'removed', 'di'],
      retryAttempts: { mvc: 3, di: 2, removed: 9, jpa: -4 },
    },
  }
  const mastered = recordCheckpointAnswer(record, 'mvc', true)

  assert.deepEqual(checkpointMasteryState(mastered, ['mvc', 'di', 'jpa']), {
    masteredConceptIds: ['di', 'mvc'],
    retryAttempts: {},
  })
})

test('recordConceptAnswer clamps record and concept strength between 0 and 100', () => {
  const high = recordConceptAnswer({
    ...learningRecord(undefined, 'missing'),
    strength: 95,
    concepts: {
      spring: { attempts: 4, correct: 4, wrong: 0, strength: 95 },
    },
  }, 'spring', true)

  assert.equal(high.strength, 100)
  assert.equal(high.concepts.spring.strength, 100)

  const low = recordConceptAnswer({
    ...learningRecord(undefined, 'missing'),
    strength: 5,
    concepts: {
      spring: { attempts: 1, correct: 0, wrong: 1, strength: 5 },
    },
  }, 'spring', false)

  assert.equal(low.strength, 0)
  assert.equal(low.concepts.spring.strength, 0)
})

test('weakestConceptId returns null when no requested concepts have persisted stats', () => {
  const record = {
    concepts: {
      unrelated: { strength: 0, wrong: 10, correct: 0 },
    },
  }

  assert.equal(weakestConceptId(record, ['mvc', 'jpa']), null)
})

test('weakestConceptId selects the persisted concept with lowest strength', () => {
  const record = {
    concepts: {
      mvc: { strength: 60, wrong: 1, correct: 4 },
      jpa: { strength: 20, wrong: 0, correct: 8 },
      spring: { strength: 40, wrong: 5, correct: 1 },
    },
  }

  assert.equal(weakestConceptId(record, ['mvc', 'jpa', 'spring']), 'jpa')
})

test('weakestConceptId breaks strength ties by more wrong answers then fewer correct answers', () => {
  const record = {
    concepts: {
      first: { strength: 40, wrong: 2, correct: 1 },
      second: { strength: 40, wrong: 3, correct: 9 },
      third: { strength: 40, wrong: 3, correct: 2 },
    },
  }

  assert.equal(weakestConceptId(record, ['first', 'second', 'third']), 'third')
})

test('weakestConceptId preserves candidate order when persisted stats are tied', () => {
  const tied = { strength: 30, wrong: 2, correct: 3 }
  const record = {
    concepts: {
      alpha: tied,
      beta: tied,
    },
  }

  assert.equal(weakestConceptId(record, ['beta', 'alpha']), 'beta')
  assert.equal(weakestConceptId(record, ['alpha', 'beta']), 'alpha')
})

test('learningStatus maps new, weak, learning, review, and mastered states', () => {
  const lessonId = lessons[0].id

  assert.deepEqual(learningStatus({}, lessonId, false, NOW), { key: 'new', label: 'YENİ' })
  assert.deepEqual(
    learningStatus({ [lessonId]: { attempts: 2, correct: 1, wrong: 1, strength: 20 } }, lessonId, false, NOW),
    { key: 'weak', label: 'ZAYIF' },
  )
  assert.deepEqual(
    learningStatus({ [lessonId]: { attempts: 2, correct: 2, wrong: 0, strength: 60 } }, lessonId, false, NOW),
    { key: 'learning', label: 'ÖĞRENİLİYOR' },
  )
  assert.deepEqual(
    learningStatus({ [lessonId]: { nextReviewAt: NOW } }, lessonId, true, NOW),
    { key: 'review', label: 'TEKRAR ZAMANI' },
  )
  assert.deepEqual(
    learningStatus({ [lessonId]: { nextReviewAt: NOW + DAY_MS } }, lessonId, true, NOW),
    { key: 'mastered', label: 'TAMAMLANDI' },
  )
})

test('dueReviewLessons keeps completed due lessons and sorts by due time then strength', () => {
  const [first, second, third, future, incomplete] = lessons.slice(0, 5)
  const completed = new Set([first.id, second.id, third.id, future.id])
  const learning = {
    [first.id]: { nextReviewAt: NOW - HOUR_MS, strength: 80 },
    [second.id]: { nextReviewAt: NOW - (2 * HOUR_MS), strength: 90 },
    [third.id]: { nextReviewAt: NOW - HOUR_MS, strength: 20 },
    [future.id]: { nextReviewAt: NOW + HOUR_MS, strength: 1 },
    [incomplete.id]: { nextReviewAt: NOW - (3 * HOUR_MS), strength: 0 },
  }

  assert.deepEqual(
    dueReviewLessons(completed, learning, NOW).map((lesson) => lesson.id),
    [second.id, third.id, first.id],
  )
})

test('buildDailyStudyPlan prioritizes up to two due reviews, then the weakest active lesson', () => {
  const [reviewOne, reviewTwo, weak, unused] = lessons.slice(0, 4)
  const completed = new Set([reviewOne.id, reviewTwo.id])
  const learning = {
    [reviewOne.id]: { nextReviewAt: NOW - HOUR_MS, strength: 70 },
    [reviewTwo.id]: { nextReviewAt: NOW - (2 * HOUR_MS), strength: 80 },
    [weak.id]: { attempts: 3, correct: 1, wrong: 2, strength: 15 },
    [unused.id]: { attempts: 1, correct: 1, wrong: 0, strength: 45 },
  }

  const plan = withFixedNow(NOW, () => buildDailyStudyPlan(completed, learning, 4))

  assert.deepEqual(
    plan.map(({ lesson, kind }) => [lesson.id, kind]),
    [
      [reviewTwo.id, 'review'],
      [reviewOne.id, 'review'],
      [weak.id, 'weak'],
    ],
  )
  assert.equal(plan[2].minutes, weak.minutes)
  assert.match(plan[2].note, /Güç 15%/)
})

test('buildDailyStudyPlan does not suggest new lessons after the active lesson', () => {
  const plan = withFixedNow(NOW, () => buildDailyStudyPlan(new Set(), {}, 0))

  assert.deepEqual(
    plan.map(({ lesson, kind }) => [lesson.id, kind]),
    [[lessons[0].id, 'new']],
  )
})

test('buildDailyStudyPlan can fill from earlier new lessons without leaking past activeIndex', () => {
  const activeIndex = 4
  const completed = new Set([lessons[0].id, lessons[2].id])
  const learning = {
    [lessons[0].id]: { nextReviewAt: NOW + DAY_MS },
    [lessons[2].id]: { nextReviewAt: NOW + DAY_MS },
  }
  const plan = withFixedNow(NOW, () => buildDailyStudyPlan(completed, learning, activeIndex))

  assert.deepEqual(
    plan.map(({ lesson, kind }) => [lesson.id, kind]),
    [
      [lessons[1].id, 'new'],
      [lessons[3].id, 'new'],
      [lessons[4].id, 'new'],
    ],
  )
  assert.ok(plan.every(({ lesson }) => lessons.indexOf(lesson) <= activeIndex))
})

test('nextReviewInterval applies hard reset, growth, and caps', () => {
  assert.equal(nextReviewInterval({ intervalDays: 0 }, 'hard'), 1)
  assert.equal(nextReviewInterval({ intervalDays: 0 }, 'good'), 3)
  assert.equal(nextReviewInterval({ intervalDays: 0 }, 'easy'), 7)
  assert.equal(nextReviewInterval({ intervalDays: 10 }, 'good'), 18)
  assert.equal(nextReviewInterval({ intervalDays: 20 }, 'good'), 30)
  assert.equal(nextReviewInterval({ intervalDays: 25 }, 'easy'), 60)
})

test('formatReviewDistance reports due, hourly, and daily distances from now', () => {
  withFixedNow(NOW, () => {
    assert.equal(formatReviewDistance(0), 'şimdi')
    assert.equal(formatReviewDistance(NOW - 1), 'şimdi')
    assert.equal(formatReviewDistance(NOW + 1), '1 sa')
    assert.equal(formatReviewDistance(NOW + (23 * HOUR_MS)), '23 sa')
    assert.equal(formatReviewDistance(NOW + DAY_MS), '1 gün')
    assert.equal(formatReviewDistance(NOW + DAY_MS + 1), '2 gün')
  })
})
