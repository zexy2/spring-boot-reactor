import test from 'node:test'
import assert from 'node:assert/strict'

import {
  BACKUP_TYPE,
  BACKUP_VERSION,
  MAX_CODE_DRAFT_LENGTH,
  MAX_BACKUP_BYTES,
  createProgressBackup,
  parseProgressBackup,
  restoreProgressBackup,
} from '../src/learning/progressTransfer.js'

const lessonList = [
  { id: 'plain', codeNotes: [] },
  { id: 'java-class', codeNotes: [] },
]

const encoded = (overrides = {}) => JSON.stringify({
  type: BACKUP_TYPE,
  version: BACKUP_VERSION,
  exportedAt: '2026-10-08T12:00:00.000Z',
  completed: [],
  learning: {},
  ...overrides,
})

test('export/import round trip preserves valid evidence and omits unknown lessons and fields', () => {
  const completed = ['plain', 'java-class', 'deleted-lesson']
  const learning = {
    plain: { attempts: 3, strength: 55, unexpected: 'do not export' },
    'java-class': { codePassed: true, masteredAt: 1770000000000 },
    'deleted-lesson': { attempts: 100 },
  }

  const backup = createProgressBackup(completed, learning, lessonList)
  assert.deepEqual(backup.completed, ['plain', 'java-class'])
  assert.equal(Object.hasOwn(backup.learning, 'deleted-lesson'), false)
  assert.equal(Object.hasOwn(backup.learning.plain, 'unexpected'), false)
  assert.deepEqual(parseProgressBackup(JSON.stringify(backup), lessonList), {
    completed: ['plain', 'java-class'],
    learning: { plain: { attempts: 3, strength: 55 }, 'java-class': { codePassed: true, masteredAt: 1770000000000 } },
  })
})

test('merge preserves passed code, review history, mastered concepts, and does not mutate sources', () => {
  const current = {
    completed: ['plain', 'java-class'],
    learning: {
      plain: { attempts: 8, correct: 4, concepts: { a: { attempts: 5, strength: 30 } }, masteryCheckpoint: { masteredConceptIds: ['a'], retryAttempts: { b: 3 } } },
      'java-class': { codePassed: true, debugSolved: true },
    },
  }
  const imported = {
    completed: ['plain', 'java-class'],
    learning: {
      plain: { attempts: 3, correct: 3, concepts: { a: { attempts: 2, strength: 60 }, c: { correct: 1 } }, masteryCheckpoint: { masteredConceptIds: ['b'], retryAttempts: { b: 8, c: 2 } } },
      'java-class': { codePassed: false, debugSolved: false },
    },
  }
  const originalCurrent = structuredClone(current)
  const originalImported = structuredClone(imported)
  const restored = restoreProgressBackup(current, imported, { lessonList })
  assert.deepEqual(restored.completed, ['plain', 'java-class'])
  assert.equal(restored.learning.plain.attempts, 8)
  assert.equal(restored.learning.plain.correct, 4)
  assert.equal(restored.learning.plain.concepts.a.strength, 60)
  assert.equal(restored.learning.plain.concepts.c.correct, 1)
  assert.deepEqual(restored.learning.plain.masteryCheckpoint, { masteredConceptIds: ['a', 'b'], retryAttempts: { c: 2 } })
  assert.equal(restored.learning['java-class'].codePassed, true)
  assert.equal(restored.learning['java-class'].debugSolved, true)
  assert.deepEqual(current, originalCurrent)
  assert.deepEqual(imported, originalImported)
})

test('merging an old backup does not postpone a newer scheduled review', () => {
  const current = { completed: [], learning: { plain: { lastReviewedAt: 5000, nextReviewAt: 6000, intervalDays: 1, attempts: 6 } } }
  const oldBackup = { completed: [], learning: { plain: { lastReviewedAt: 2000, nextReviewAt: 99000, intervalDays: 30, attempts: 3 } } }
  const result = restoreProgressBackup(current, oldBackup, { lessonList })
  assert.equal(result.learning.plain.nextReviewAt, 6000)
  assert.equal(result.learning.plain.intervalDays, 1)
  assert.equal(result.learning.plain.attempts, 6)

  const newestBackup = { completed: [], learning: { plain: { lastReviewedAt: 8000, nextReviewAt: 11000, intervalDays: 3 } } }
  const updated = restoreProgressBackup(current, newestBackup, { lessonList })
  assert.equal(updated.learning.plain.nextReviewAt, 11000)
  assert.equal(updated.learning.plain.intervalDays, 3)
  assert.equal(updated.learning.plain.lastReviewedAt, 8000)
})

test('review due date stays conservative when backups have no review ordering', () => {
  const current = { completed: [], learning: { plain: { nextReviewAt: 8000 } } }
  const incoming = { completed: [], learning: { plain: { nextReviewAt: 3000 } } }
  assert.equal(restoreProgressBackup(current, incoming, { lessonList }).learning.plain.nextReviewAt, 3000)
})

test('code drafts survive backup round trips and newest edit wins merges, including clearing a draft', () => {
  const current = { completed: [], learning: { 'java-class': { codeDraft: 'class Old {}', codeDraftUpdatedAt: 300 } } }
  const older = { completed: [], learning: { 'java-class': { codeDraft: 'class Older {}', codeDraftUpdatedAt: 200 } } }
  const newer = { completed: [], learning: { 'java-class': { codeDraft: 'class Newer {}', codeDraftUpdatedAt: 400 } } }
  const cleared = { completed: [], learning: { 'java-class': { codeDraft: '', codeDraftUpdatedAt: 500 } } }

  assert.deepEqual(parseProgressBackup(JSON.stringify(createProgressBackup([], current.learning, lessonList)), lessonList).learning, current.learning)
  assert.equal(restoreProgressBackup(current, older, { lessonList }).learning['java-class'].codeDraft, 'class Old {}')
  assert.equal(restoreProgressBackup(current, newer, { lessonList }).learning['java-class'].codeDraft, 'class Newer {}')
  assert.equal(restoreProgressBackup(newer, cleared, { lessonList }).learning['java-class'].codeDraft, '')
})

test('replace discards previous records and enforces code completion evidence', () => {
  const current = { completed: ['plain', 'java-class'], learning: { plain: { attempts: 9 }, 'java-class': { codePassed: true } } }
  const incoming = { completed: ['java-class'], learning: { 'java-class': { codePassed: false, attempts: 2 } } }
  const replaced = restoreProgressBackup(current, incoming, { replace: true, lessonList })
  assert.deepEqual(replaced.completed, [])
  assert.deepEqual(replaced.learning, { 'java-class': { codePassed: false, attempts: 2 } })
  assert.deepEqual(current.completed, ['plain', 'java-class'])
})

test('v2 completion requires checkpoint and mastery even when supplied by imported data', () => {
  const restored = restoreProgressBackup(
    { completed: [], learning: {} },
    { completed: ['plain'], learning: { plain: { completionEvidenceVersion: 2, masteredAt: 200, masteryCheckpoint: { masteredConceptIds: [] } } } },
    { lessonList },
  )
  assert.deepEqual(restored.completed, [])
})

test('unsupported formats, malformed JSON, and size limits are rejected', () => {
  assert.throws(() => parseProgressBackup('{'), /JSON/)
  assert.throws(() => parseProgressBackup(encoded({ version: 77 }), lessonList), /sürümü/)
  assert.throws(() => parseProgressBackup(encoded({ type: 'other' }), lessonList), /türü|sürümü/)
  assert.throws(() => parseProgressBackup(encoded({ exportedAt: 'nonsense' }), lessonList), /tarihi/)
  assert.throws(() => parseProgressBackup(' '.repeat(MAX_BACKUP_BYTES + 1), lessonList), /2 MB/)
  assert.throws(() => parseProgressBackup(encoded({ completed: {} }), lessonList), /Ders listesi/)
})

test('invalid numeric fields and dangerous nested object keys are rejected', () => {
  assert.throws(() => parseProgressBackup(encoded({ learning: { plain: { attempts: -1 } } }), lessonList), /sayısal/)
  assert.throws(() => parseProgressBackup(encoded({ learning: { plain: { strength: 101 } } }), lessonList), /sayısal/)
  assert.throws(() => parseProgressBackup(encoded({ learning: { plain: { codePassed: 'yes' } } }), lessonList), /mantıksal/)
  assert.throws(() => parseProgressBackup(encoded({ learning: { plain: { concepts: JSON.parse('{"__proto__":{"strength":100}}') } } }), lessonList), /güvenli olmayan/)
  assert.throws(() => parseProgressBackup(encoded({ learning: { plain: { masteryCheckpoint: { masteredConceptIds: ['__proto__'] } } } }), lessonList), /kimliği/)
  assert.throws(() => parseProgressBackup(encoded({ learning: { 'java-class': { codeDraft: 'x'.repeat(MAX_CODE_DRAFT_LENGTH + 1), codeDraftUpdatedAt: 1 } } }), lessonList), /kod taslağı/)
  assert.throws(() => parseProgressBackup(encoded({ learning: { 'java-class': { codeDraft: 'class Test {}' } } }), lessonList), /kayıt tarihi/)
  assert.throws(() => parseProgressBackup(encoded({ learning: { 'java-class': { codeDraftUpdatedAt: 15 } } }), lessonList), /kayıt tarihi/)
})

test('unknown lesson ids are removed before applying the import', () => {
  const incoming = parseProgressBackup(encoded({ completed: ['gone', 'plain'], learning: { gone: { attempts: 900 }, plain: { attempts: 1 } } }), lessonList)
  assert.deepEqual(incoming.completed, ['plain'])
  assert.deepEqual(incoming.learning, { plain: { attempts: 1 } })
})
