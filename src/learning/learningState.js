import { lessons } from '../data/curriculum'

function clampStrength(value) {
  return Math.max(0, Math.min(100, value))
}

function normalizeRecallText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü]+/giu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function hashConceptKey(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function codeNoteConceptId(lessonId, fragment) {
  const lessonKey = String(lessonId ?? '').trim()
  const fragmentKey = normalizeRecallText(fragment)
  if (!lessonKey || !fragmentKey) return ''
  return `${lessonKey}-code-${hashConceptKey(fragmentKey).toString(36)}-${fragmentKey.length.toString(36)}`
}

export function migrateLegacyCodeConceptIds(record, lessonId, codeNotes) {
  const concepts = record?.concepts
  if (!concepts || typeof concepts !== 'object' || Array.isArray(concepts)) return record
  if (!Array.isArray(codeNotes) || codeNotes.length === 0) return record

  const nextConcepts = { ...concepts }
  let changed = false

  codeNotes.forEach((note, index) => {
    const fragment = Array.isArray(note) ? note[0] : ''
    const stableId = codeNoteConceptId(lessonId, fragment)
    const legacyId = `${lessonId}-code-${index}`
    if (!stableId || !Object.prototype.hasOwnProperty.call(nextConcepts, legacyId)) return

    if (!Object.prototype.hasOwnProperty.call(nextConcepts, stableId)) {
      nextConcepts[stableId] = nextConcepts[legacyId]
    }
    delete nextConcepts[legacyId]
    changed = true
  })

  return changed ? { ...record, concepts: nextConcepts } : record
}

export function evaluateRecallCoverage(answer, targets) {
  const normalizedAnswer = normalizeRecallText(answer)
  const validTargets = (Array.isArray(targets) ? targets : []).flatMap((target) => {
    if (!target || typeof target !== 'object' || Array.isArray(target)) return []

    const conceptId = typeof target.conceptId === 'string' ? target.conceptId.trim() : ''
    const label = typeof target.label === 'string' ? target.label.trim() : ''
    const normalizedLabel = normalizeRecallText(label)
    if (!conceptId || !normalizedLabel) return []

    const tokens = normalizedLabel.split(' ').filter((token) => token.length >= 2)
    const covered = normalizedAnswer.includes(normalizedLabel)
      || (tokens.length > 0 && tokens.every((token) => normalizedAnswer.includes(token)))

    return [{ conceptId, label, covered }]
  })

  return {
    coveredCount: validTargets.filter((target) => target.covered).length,
    total: validTargets.length,
    results: validTargets,
  }
}

export function recordRecallCoverage(record, results) {
  const validResults = (Array.isArray(results) ? results : []).filter((result) => (
    result
    && typeof result === 'object'
    && !Array.isArray(result)
    && typeof result.conceptId === 'string'
    && result.conceptId.trim()
  ))
  if (validResults.length === 0) return { ...record }

  const coveredCount = validResults.filter((result) => result.covered === true).length
  const isFull = coveredCount === validResults.length
  const isPartial = coveredCount > 0 && !isFull

  return {
    ...record,
    recallAttempts: (Number(record?.recallAttempts) || 0) + 1,
    recallFull: (Number(record?.recallFull) || 0) + (isFull ? 1 : 0),
    recallPartial: (Number(record?.recallPartial) || 0) + (isPartial ? 1 : 0),
    recallMissed: (Number(record?.recallMissed) || 0) + (coveredCount === 0 ? 1 : 0),
  }
}

export function learningRecord(learning, lessonId) {
  return {
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
    ...(learning?.[lessonId] ?? {}),
  }
}

export function recordDebugAttempt(record, attempt) {
  const previous = record && typeof record === 'object' && !Array.isArray(record) ? record : {}
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt)) return { ...previous }
  const count = (key) => Math.max(0, Number.isSafeInteger(previous[key]) ? previous[key] : 0)
  if (attempt.hint === true) return { ...previous, debugHints: count('debugHints') + 1 }
  if (!['diagnosis', 'fix'].includes(attempt.stage) || typeof attempt.correct !== 'boolean') return { ...previous }
  return {
    ...previous,
    debugAttempts: count('debugAttempts') + 1,
    debugCorrect: count('debugCorrect') + (attempt.correct ? 1 : 0),
    debugWrong: count('debugWrong') + (attempt.correct ? 0 : 1),
    debugSolved: previous.debugSolved === true || (attempt.stage === 'fix' && attempt.correct === true && attempt.solved === true),
  }
}

export function recordInterviewAttempt(record, score, now = Date.now()) {
  const safeScore = Math.max(0, Math.min(4, Math.floor(Number(score) || 0)))
  return {
    ...record,
    interviewAttempts: (Number(record?.interviewAttempts) || 0) + 1,
    interviewBestScore: Math.max(Number(record?.interviewBestScore) || 0, safeScore),
    lastInterviewAt: now,
  }
}

export function recordConceptAnswer(record, conceptId, correct) {
  const concept = record.concepts?.[conceptId] ?? {
    attempts: 0,
    correct: 0,
    wrong: 0,
    strength: 0,
  }
  const strengthDelta = correct ? 12 : -16

  return {
    ...record,
    attempts: record.attempts + 1,
    correct: record.correct + (correct ? 1 : 0),
    wrong: record.wrong + (correct ? 0 : 1),
    strength: clampStrength(record.strength + strengthDelta),
    concepts: {
      ...(record.concepts ?? {}),
      [conceptId]: {
        ...concept,
        attempts: concept.attempts + 1,
        correct: concept.correct + (correct ? 1 : 0),
        wrong: concept.wrong + (correct ? 0 : 1),
        strength: clampStrength(concept.strength + strengthDelta),
      },
    },
  }
}

export function checkpointMasteryState(record, conceptIds) {
  const allowed = new Set((conceptIds ?? []).filter(Boolean))
  const raw = record?.masteryCheckpoint
  const masteredConceptIds = []
  const seen = new Set()

  for (const conceptId of raw?.masteredConceptIds ?? []) {
    if (!allowed.has(conceptId) || seen.has(conceptId)) continue
    seen.add(conceptId)
    masteredConceptIds.push(conceptId)
  }

  const retryAttempts = {}
  if (raw?.retryAttempts && typeof raw.retryAttempts === 'object' && !Array.isArray(raw.retryAttempts)) {
    for (const [conceptId, value] of Object.entries(raw.retryAttempts)) {
      if (!allowed.has(conceptId) || seen.has(conceptId)) continue
      const attempts = Math.max(0, Math.floor(Number(value) || 0))
      if (attempts > 0) retryAttempts[conceptId] = attempts
    }
  }

  return { masteredConceptIds, retryAttempts }
}

export function recordCheckpointAnswer(record, conceptId, correct) {
  const raw = record?.masteryCheckpoint
  const masteredConceptIds = Array.isArray(raw?.masteredConceptIds)
    ? raw.masteredConceptIds.filter((item) => typeof item === 'string' && item)
    : []
  const retryAttempts = raw?.retryAttempts && typeof raw.retryAttempts === 'object' && !Array.isArray(raw.retryAttempts)
    ? { ...raw.retryAttempts }
    : {}

  if (correct) {
    if (!masteredConceptIds.includes(conceptId)) masteredConceptIds.push(conceptId)
    delete retryAttempts[conceptId]
  } else if (!masteredConceptIds.includes(conceptId)) {
    retryAttempts[conceptId] = Math.max(0, Math.floor(Number(retryAttempts[conceptId]) || 0)) + 1
  }

  return {
    ...record,
    masteryCheckpoint: {
      masteredConceptIds,
      retryAttempts,
    },
  }
}

export function weakestConceptId(record, conceptIds) {
  const concepts = record?.concepts
  if (!concepts || typeof concepts !== 'object' || Array.isArray(concepts)) return null

  let weakestId = null
  let weakestStats = null

  for (const conceptId of conceptIds ?? []) {
    if (!Object.prototype.hasOwnProperty.call(concepts, conceptId)) continue
    const persisted = concepts[conceptId]
    if (!persisted || typeof persisted !== 'object' || Array.isArray(persisted)) continue

    const stats = {
      strength: Number(persisted.strength) || 0,
      wrong: Number(persisted.wrong) || 0,
      correct: Number(persisted.correct) || 0,
    }
    const isWeaker = !weakestStats
      || stats.strength < weakestStats.strength
      || (stats.strength === weakestStats.strength && stats.wrong > weakestStats.wrong)
      || (stats.strength === weakestStats.strength && stats.wrong === weakestStats.wrong && stats.correct < weakestStats.correct)

    if (isWeaker) {
      weakestId = conceptId
      weakestStats = stats
    }
  }

  return weakestId
}

export function learningStatus(learning, lessonId, completed, now = Date.now()) {
  const record = learningRecord(learning, lessonId)
  if (completed) {
    if (!record.nextReviewAt || record.nextReviewAt <= now) return { key: 'review', label: 'TEKRAR ZAMANI' }
    return { key: 'mastered', label: 'TAMAMLANDI' }
  }
  if (record.attempts > 0) {
    if (record.wrong > record.correct || record.strength < 35) return { key: 'weak', label: 'ZAYIF' }
    return { key: 'learning', label: 'ÖĞRENİLİYOR' }
  }
  return { key: 'new', label: 'YENİ' }
}

export function dueReviewLessons(completed, learning, now = Date.now()) {
  return lessons
    .filter((lesson) => completed.has(lesson.id))
    .map((lesson) => ({ lesson, record: learningRecord(learning, lesson.id) }))
    .filter(({ record }) => !record.nextReviewAt || record.nextReviewAt <= now)
    .sort((a, b) => {
      const aDue = a.record.nextReviewAt || 0
      const bDue = b.record.nextReviewAt || 0
      if (aDue !== bDue) return aDue - bDue
      return a.record.strength - b.record.strength
    })
    .map(({ lesson }) => lesson)
}

export function calculateInterviewReadiness(completed, learning, now = Date.now()) {
  const completedLessons = lessons.filter((lesson) => completed.has(lesson.id))
  if (lessons.length === 0 || completedLessons.length === 0) {
    return {
      score: 0,
      coverage: 0,
      strength: 0,
      retention: 0,
      accuracy: 0,
      recall: 0,
      interview: 0,
    }
  }

  const records = completedLessons.map((lesson) => learningRecord(learning, lesson.id))
  const coverage = (completedLessons.length / lessons.length) * 100
  const strength = records.reduce((sum, record) => sum + record.strength, 0) / records.length
  const overdueCount = records.filter((record) => !record.nextReviewAt || record.nextReviewAt <= now).length
  const retention = Math.max(0, 100 - ((overdueCount / records.length) * 100))
  const attempts = records.reduce((sum, record) => sum + record.correct + record.wrong, 0)
  const correct = records.reduce((sum, record) => sum + record.correct, 0)
  const accuracy = attempts > 0 ? (correct / attempts) * 100 : 0
  const recallAttempts = records.reduce((sum, record) => sum + (Number(record.recallAttempts) || 0), 0)
  const recallPoints = records.reduce((sum, record) => (
    sum + (Number(record.recallFull) || 0) + ((Number(record.recallPartial) || 0) * 0.5)
  ), 0)
  const recall = recallAttempts > 0 ? (recallPoints / recallAttempts) * 100 : 0
  const interview = records.reduce((sum, record) => (
    sum + ((Math.max(0, Math.min(4, Number(record.interviewBestScore) || 0)) / 4) * 100)
  ), 0) / records.length
  const quality = (
    (strength * 0.35)
    + (retention * 0.20)
    + (accuracy * 0.20)
    + (recall * 0.10)
    + (interview * 0.15)
  )
  const score = Math.round((coverage / 100) * quality)

  return {
    score: Math.max(0, Math.min(100, score)),
    coverage: Math.round(coverage),
    strength: Math.round(strength),
    retention: Math.round(retention),
    accuracy: Math.round(accuracy),
    recall: Math.round(recall),
    interview: Math.round(interview),
  }
}

export function buildDailyStudyPlan(completed, learning, activeIndex) {
  const plan = []
  const selected = new Set()

  dueReviewLessons(completed, learning)
    .slice(0, 2)
    .forEach((lesson) => {
      plan.push({ lesson, kind: 'review', label: 'TEKRAR', minutes: 2, note: 'Aralıklı tekrar zamanı geldi.' })
      selected.add(lesson.id)
    })

  const weakLessons = lessons
    .filter((lesson, index) => index <= activeIndex && !completed.has(lesson.id) && !selected.has(lesson.id))
    .map((lesson) => ({ lesson, record: learningRecord(learning, lesson.id) }))
    .filter(({ record }) => record.attempts > 0 && (record.wrong >= record.correct || record.strength < 50))
    .sort((a, b) => {
      if (a.record.strength !== b.record.strength) return a.record.strength - b.record.strength
      return b.record.wrong - a.record.wrong
    })

  if (plan.length < 3 && weakLessons.length > 0) {
    const { lesson, record } = weakLessons[0]
    plan.push({ lesson, kind: 'weak', label: 'ZAYIF KONU', minutes: lesson.minutes, note: `Güç ${record.strength}% · yeniden çalış.` })
    selected.add(lesson.id)
  }

  for (const [index, lesson] of lessons.entries()) {
    if (plan.length >= 3) break
    if (index > activeIndex) break
    if (completed.has(lesson.id) || selected.has(lesson.id)) continue
    plan.push({ lesson, kind: 'new', label: 'YENİ DERS', minutes: lesson.minutes, note: 'Öğrenme yolundaki sıradaki adım.' })
    selected.add(lesson.id)
  }

  if (plan.length === 0) {
    const refresh = lessons
      .filter((lesson) => completed.has(lesson.id))
      .map((lesson) => ({ lesson, record: learningRecord(learning, lesson.id) }))
      .sort((a, b) => a.record.strength - b.record.strength)[0]
    if (refresh) plan.push({ lesson: refresh.lesson, kind: 'refresh', label: 'PEKİŞTİR', minutes: 2, note: `Güç ${refresh.record.strength}% · kısa hatırlama turu.` })
  }

  return plan
}

export function nextReviewInterval(record, rating) {
  const current = Math.max(1, Number(record.intervalDays) || 1)
  if (rating === 'hard') return 1
  if (rating === 'easy') return Math.min(60, current <= 1 ? 7 : Math.ceil(current * 2.6))
  return Math.min(30, current <= 1 ? 3 : Math.ceil(current * 1.8))
}

export function formatReviewDistance(timestamp) {
  if (!timestamp) return 'şimdi'
  const diff = timestamp - Date.now()
  if (diff <= 0) return 'şimdi'
  const hours = Math.ceil(diff / (60 * 60 * 1000))
  if (hours < 24) return `${hours} sa`
  return `${Math.ceil(hours / 24)} gün`
}
