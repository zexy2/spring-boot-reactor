import { lessons } from '../data/curriculum.js'
import { validatedCompletedLessonIds } from './progressIntegrity.js'

export const BACKUP_TYPE = 'java-backend-learning-progress'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 2 * 1024 * 1024

const safeObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const forbidden = new Set(['__proto__', 'constructor', 'prototype'])
const counters = new Set(['attempts', 'correct', 'wrong', 'recallAttempts', 'recallFull', 'recallPartial', 'recallMissed', 'interviewAttempts', 'debugAttempts', 'debugCorrect', 'debugWrong', 'debugHints', 'intervalDays', 'completionEvidenceVersion'])
const times = new Set(['nextReviewAt', 'lastReviewedAt', 'masteredAt', 'lastInterviewAt', 'codeDraftUpdatedAt'])
const flags = new Set(['codePassed', 'debugSolved'])
export const MAX_CODE_DRAFT_LENGTH = 20000

function entries(value) {
  if (!safeObject(value)) throw new Error('Yedek veri yapısı geçersiz.')
  const result = Object.entries(value)
  if (result.some(([key]) => forbidden.has(key))) throw new Error('Yedekte güvenli olmayan alan var.')
  return result
}

function nonnegative(value, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error('Yedekte geçersiz sayısal alan var.')
  return value
}

function statistics(value) {
  const result = {}
  for (const [key, item] of entries(value)) {
    if (['attempts', 'correct', 'wrong', 'strength'].includes(key)) result[key] = nonnegative(item, key === 'strength' ? 100 : 1e9)
  }
  return result
}

function record(value) {
  const result = {}
  for (const [key, item] of entries(value)) {
    if (counters.has(key) || times.has(key) || key === 'strength' || key === 'interviewBestScore') {
      const max = key === 'strength' ? 100 : key === 'interviewBestScore' ? 4 : times.has(key) ? Number.MAX_SAFE_INTEGER : 1e9
      result[key] = nonnegative(item, max)
    } else if (flags.has(key)) {
      if (typeof item !== 'boolean') throw new Error('Yedekte geçersiz mantıksal alan var.')
      result[key] = item
    } else if (key === 'codeDraft') {
      if (typeof item !== 'string' || item.length > MAX_CODE_DRAFT_LENGTH) throw new Error('Yedekte geçersiz kod taslağı var.')
      result.codeDraft = item
    } else if (key === 'concepts') {
      result.concepts = {}
      for (const [id, value] of entries(item)) {
        if (!id || id.length > 160) throw new Error('Kavram anahtarı geçersiz.')
        result.concepts[id] = statistics(value)
      }
    } else if (key === 'masteryCheckpoint') {
      const checkpoint = Object.fromEntries(entries(item))
      if (!Array.isArray(checkpoint.masteredConceptIds ?? [])) throw new Error('Kazanım listesi geçersiz.')
      const masteredConceptIds = [...new Set((checkpoint.masteredConceptIds ?? []).map((id) => {
        if (typeof id !== 'string' || !id || id.length > 160 || forbidden.has(id)) throw new Error('Kazanım kimliği geçersiz.')
        return id
      }))]
      const retryAttempts = {}
      for (const [id, count] of entries(checkpoint.retryAttempts ?? {})) {
        if (!id || id.length > 160) throw new Error('Tekrar kimliği geçersiz.')
        retryAttempts[id] = nonnegative(count, 1e9)
      }
      result.masteryCheckpoint = { masteredConceptIds, retryAttempts }
    }
  }
  if (Object.hasOwn(result, 'codeDraft') !== Object.hasOwn(result, 'codeDraftUpdatedAt')
    || (Object.hasOwn(result, 'codeDraft') && result.codeDraftUpdatedAt === 0)) {
    throw new Error('Yedekte kod taslağının kayıt tarihi geçersiz.')
  }
  return result
}

function validLearning(value, lessonList) {
  const ids = new Set(lessonList.map(({ id }) => id))
  const result = {}
  for (const [id, valueRecord] of entries(value)) {
    if (ids.has(id)) result[id] = record(valueRecord)
  }
  return result
}

function validCompleted(value, lessonList) {
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) throw new Error('Ders listesi geçersiz.')
  const ids = new Set(lessonList.map(({ id }) => id))
  return [...new Set(value.filter((id) => ids.has(id)))]
}

export function createProgressBackup(completed, learning, lessonList = lessons) {
  const safeLearning = validLearning(learning, lessonList)
  return {
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    completed: validatedCompletedLessonIds(validCompleted(completed, lessonList), safeLearning, lessonList),
    learning: safeLearning,
  }
}

export function parseProgressBackup(text, lessonList = lessons) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Dosya okunamıyor veya 2 MB sınırını aşıyor.')
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error('Dosya geçerli JSON değil.') }
  if (!safeObject(parsed) || parsed.type !== BACKUP_TYPE || parsed.version !== BACKUP_VERSION) throw new Error('Yedek türü veya sürümü desteklenmiyor.')
  entries(parsed)
  if (typeof parsed.exportedAt !== 'string' || !Number.isFinite(Date.parse(parsed.exportedAt))) throw new Error('Yedek tarihi geçersiz.')
  return { completed: validCompleted(parsed.completed, lessonList), learning: validLearning(parsed.learning, lessonList) }
}

function combineRecord(previous, incoming) {
  const result = { ...previous }
  for (const [key, value] of Object.entries(incoming)) {
    if (key === 'concepts') {
      const concepts = { ...previous.concepts }
      for (const [id, stats] of Object.entries(value)) {
        concepts[id] = { ...(concepts[id] ?? {}) }
        for (const [name, count] of Object.entries(stats)) concepts[id][name] = Math.max(concepts[id][name] ?? 0, count)
      }
      result.concepts = concepts
    } else if (key === 'masteryCheckpoint') {
      const old = previous.masteryCheckpoint ?? {}
      const masteredConceptIds = [...new Set([...(old.masteredConceptIds ?? []), ...value.masteredConceptIds])]
      const retryAttempts = { ...(old.retryAttempts ?? {}) }
      for (const [id, count] of Object.entries(value.retryAttempts)) retryAttempts[id] = Math.max(retryAttempts[id] ?? 0, count)
      for (const id of masteredConceptIds) delete retryAttempts[id]
      result.masteryCheckpoint = { masteredConceptIds, retryAttempts }
    } else if (key === 'codeDraft' || key === 'codeDraftUpdatedAt') continue
    else if (flags.has(key)) result[key] = previous[key] === true || value === true
    else result[key] = Math.max(previous[key] ?? 0, value)
  }

  // Drafts are text, not counters. Keep the newest edit as one timestamped pair.
  const draftSource = (incoming.codeDraftUpdatedAt ?? 0) > (previous.codeDraftUpdatedAt ?? 0) ? incoming : previous
  if (Object.hasOwn(draftSource, 'codeDraft')) {
    result.codeDraft = draftSource.codeDraft
    result.codeDraftUpdatedAt = draftSource.codeDraftUpdatedAt
  }

  // Review schedules belong to the latest review. Taking the maximum due date
  // can postpone a currently due lesson when an older backup is imported.
  const oldReview = previous.lastReviewedAt ?? 0
  const newReview = incoming.lastReviewedAt ?? 0
  if (oldReview !== newReview && (oldReview || newReview)) {
    const latestReview = newReview > oldReview ? incoming : previous
    for (const key of ['nextReviewAt', 'intervalDays']) {
      if (Object.hasOwn(latestReview, key)) result[key] = latestReview[key]
      else delete result[key]
    }
  } else if (previous.nextReviewAt && incoming.nextReviewAt) {
    // No reliable review order: err toward an earlier due date.
    result.nextReviewAt = Math.min(previous.nextReviewAt, incoming.nextReviewAt)
  }
  return result
}

export function restoreProgressBackup(current, incoming, { replace = false, lessonList = lessons } = {}) {
  const existingLearning = replace ? {} : validLearning(current.learning, lessonList)
  const existingCompleted = replace ? [] : validCompleted(current.completed, lessonList)
  const importedLearning = validLearning(incoming.learning, lessonList)
  const importedCompleted = validCompleted(incoming.completed, lessonList)
  const learning = { ...existingLearning }
  for (const [id, value] of Object.entries(importedLearning)) learning[id] = combineRecord(existingLearning[id] ?? {}, value)
  return {
    learning,
    completed: validatedCompletedLessonIds([...new Set([...existingCompleted, ...importedCompleted])], learning, lessonList),
  }
}
