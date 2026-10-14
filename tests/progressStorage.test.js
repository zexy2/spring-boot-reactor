import test from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGACY_LEARNING_KEY,
  LEGACY_PROGRESS_KEY,
  SNAPSHOT_KEY,
  loadProgressStorage,
  rawProgressRecovery,
  saveProgressStorage,
} from '../src/learning/progressStorage.js'
import { codeNoteConceptId } from '../src/learning/learningState.js'

const lessonList = [
  { id: 'plain', codeNotes: [] },
  { id: 'code', codeNotes: [['class A {}', 'Örnek sınıf']] },
]

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  const writes = []
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => { writes.push([key, value]); data.set(key, value) },
    writes,
  }
}

test('fresh browser starts empty and saves a single versioned snapshot', () => {
  const storage = memoryStorage()
  assert.deepEqual(loadProgressStorage(storage, lessonList), { completed: [], learning: {}, blocked: false })

  const snapshot = saveProgressStorage(storage, ['plain', 'code'], { plain: { attempts: 2 }, code: { codePassed: true } }, lessonList)
  assert.equal(storage.writes.length, 1)
  assert.equal(storage.writes[0][0], SNAPSHOT_KEY)
  assert.equal(snapshot.type, 'java-backend-learning-progress')
  assert.deepEqual(loadProgressStorage(storage, lessonList), {
    completed: ['plain', 'code'],
    learning: { plain: { attempts: 2 }, code: { codePassed: true } },
    blocked: false,
  })
})

test('legacy progress migrates with stable code-concept ids and preserves legacy keys', () => {
  const legacyLearning = {
    plain: { attempts: 4 },
    code: { codePassed: true, concepts: { 'code-code-0': { attempts: 2, strength: 25 } } },
  }
  const storage = memoryStorage({
    [LEGACY_PROGRESS_KEY]: JSON.stringify(['plain', 'code']),
    [LEGACY_LEARNING_KEY]: JSON.stringify(legacyLearning),
  })
  const loaded = loadProgressStorage(storage, lessonList)
  assert.equal(loaded.blocked, false)
  assert.deepEqual(loaded.completed, ['plain', 'code'])
  assert.deepEqual(loaded.learning.code.concepts[codeNoteConceptId('code', 'class A {}')], { attempts: 2, strength: 25 })
  assert.equal(loaded.learning.code.concepts['code-code-0'], undefined)
  saveProgressStorage(storage, loaded.completed, loaded.learning, lessonList)
  assert.deepEqual(storage.writes.map(([key]) => key), [SNAPSHOT_KEY])
  assert.deepEqual(JSON.parse(storage.getItem(LEGACY_LEARNING_KEY)), legacyLearning)
})

test('corrupt snapshot blocks loading and leaves original and legacy data intact', () => {
  const storage = memoryStorage({
    [SNAPSHOT_KEY]: '{bad json',
    [LEGACY_PROGRESS_KEY]: JSON.stringify(['plain']),
    [LEGACY_LEARNING_KEY]: JSON.stringify({ plain: { attempts: 4 } }),
  })
  const loaded = loadProgressStorage(storage, lessonList)
  assert.equal(loaded.blocked, true)
  assert.deepEqual(loaded.completed, [])
  assert.deepEqual(storage.writes, [])
  assert.equal(rawProgressRecovery(storage).entries[SNAPSHOT_KEY], '{bad json')
  assert.equal(rawProgressRecovery(storage).entries[LEGACY_PROGRESS_KEY], '["plain"]')
})

test('malformed legacy record blocks migration instead of wiping existing progress', () => {
  for (const badLegacy of [
    { [LEGACY_PROGRESS_KEY]: 'not json', [LEGACY_LEARNING_KEY]: '{"plain":{"attempts":3}}' },
    { [LEGACY_PROGRESS_KEY]: '[]', [LEGACY_LEARNING_KEY]: '{"plain":{"attempts":-1}}' },
    { [LEGACY_PROGRESS_KEY]: '{}', [LEGACY_LEARNING_KEY]: '{}' },
  ]) {
    const storage = memoryStorage(badLegacy)
    assert.equal(loadProgressStorage(storage, lessonList).blocked, true)
    assert.equal(storage.writes.length, 0)
  }
})

test('unsupported snapshot version blocks automatic overwrites', () => {
  const storage = memoryStorage()
  saveProgressStorage(storage, ['plain'], {}, lessonList)
  const json = JSON.parse(storage.getItem(SNAPSHOT_KEY))
  json.version = 999
  const invalidStorage = memoryStorage({ [SNAPSHOT_KEY]: JSON.stringify(json) })
  assert.equal(loadProgressStorage(invalidStorage, lessonList).blocked, true)
  assert.equal(invalidStorage.writes.length, 0)
})

test('write failure leaves existing snapshot untouched', () => {
  const storage = memoryStorage()
  saveProgressStorage(storage, ['plain'], { plain: { attempts: 4 } }, lessonList)
  const previous = storage.getItem(SNAPSHOT_KEY)
  storage.setItem = () => { throw new Error('QuotaExceededError') }
  assert.throws(() => saveProgressStorage(storage, [], {}, lessonList), /QuotaExceededError/)
  assert.equal(storage.getItem(SNAPSHOT_KEY), previous)
})

test('storage read denial reports a blocked state instead of crashing', () => {
  const storage = { getItem: () => { throw new Error('SecurityError') } }
  assert.match(loadProgressStorage(storage, lessonList).reason, /erişilemiyor/)
})
