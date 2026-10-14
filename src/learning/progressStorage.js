import { lessons } from '../data/curriculum.js'
import { migrateLegacyCodeConceptIds } from './learningState.js'
import { MAX_BACKUP_BYTES, createProgressBackup, parseProgressBackup } from './progressTransfer.js'
import { validatedCompletedLessonIds } from './progressIntegrity.js'

export const SNAPSHOT_KEY = 'spring-reactor-snapshot-v1'
export const LEGACY_PROGRESS_KEY = 'spring-reactor-progress-v3'
export const LEGACY_LEARNING_KEY = 'spring-reactor-learning-v1'

const empty = () => ({ completed: [], learning: {} })
const blocked = (reason) => ({ ...empty(), blocked: true, reason })

export class ProgressStorageConflictError extends Error {
  constructor() {
    super('Başka bir sekme ilerlemeyi değiştirdi. Eski kayıt üzerine yazılamaz.')
    this.name = 'ProgressStorageConflictError'
  }
}

function validatedState(input, lessonList) {
  const cleaned = createProgressBackup(input.completed, input.learning, lessonList)
  const learning = Object.fromEntries(Object.entries(cleaned.learning).map(([id, value]) => {
    const lesson = lessonList.find((item) => item.id === id)
    return [id, migrateLegacyCodeConceptIds(value, id, lesson?.codeNotes)]
  }))
  return {
    completed: validatedCompletedLessonIds(cleaned.completed, learning, lessonList),
    learning,
  }
}

export function loadProgressStorage(storage, lessonList = lessons) {
  try {
    const snapshot = storage.getItem(SNAPSHOT_KEY)
    if (snapshot !== null) {
      try {
        return { ...validatedState(parseProgressBackup(snapshot, lessonList), lessonList), blocked: false, snapshotRaw: snapshot }
      } catch {
        return { ...blocked('Kayıt dosyası bozulmuş veya desteklenmeyen biçimde. Otomatik kayıt durduruldu.'), snapshotRaw: snapshot }
      }
    }

    const rawProgress = storage.getItem(LEGACY_PROGRESS_KEY)
    const rawLearning = storage.getItem(LEGACY_LEARNING_KEY)
    if (rawProgress === null && rawLearning === null) return { ...empty(), blocked: false, snapshotRaw: null }

    let completed
    let learning
    try {
      completed = rawProgress === null ? [] : JSON.parse(rawProgress)
      learning = rawLearning === null ? {} : JSON.parse(rawLearning)
    } catch {
      return blocked('Eski ilerleme kayıtlarından biri okunamıyor. Otomatik kayıt durduruldu.')
    }
    try {
      return { ...validatedState({ completed, learning }, lessonList), blocked: false, snapshotRaw: null }
    } catch {
      return blocked('Eski ilerleme verisinin yapısı geçersiz. Otomatik kayıt durduruldu.')
    }
  } catch {
    return blocked('Tarayıcı depolamasına erişilemiyor. Otomatik kayıt durduruldu.')
  }
}

export function saveProgressStorage(storage, completed, learning, lessonList = lessons, options = {}) {
  // A single localStorage write prevents progress and learning from diverging.
  const snapshot = createProgressBackup(completed, learning, lessonList)
  const payload = JSON.stringify(snapshot)
  if (new TextEncoder().encode(payload).length > MAX_BACKUP_BYTES) throw new Error('İlerleme verisi 2 MB sınırını aşıyor.')
  // Best-effort optimistic concurrency: another tab's saved snapshot must not
  // be overwritten by an older tab. localStorage has no compare-and-swap API.
  if (Object.hasOwn(options, 'expectedRaw') && storage.getItem(SNAPSHOT_KEY) !== options.expectedRaw) {
    throw new ProgressStorageConflictError()
  }
  storage.setItem(SNAPSHOT_KEY, payload)
  return snapshot
}

export function rawProgressRecovery(storage) {
  return {
    format: 'java-backend-raw-storage-recovery',
    exportedAt: new Date().toISOString(),
    entries: {
      [SNAPSHOT_KEY]: storage.getItem(SNAPSHOT_KEY),
      [LEGACY_PROGRESS_KEY]: storage.getItem(LEGACY_PROGRESS_KEY),
      [LEGACY_LEARNING_KEY]: storage.getItem(LEGACY_LEARNING_KEY),
    },
  }
}
