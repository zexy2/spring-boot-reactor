import { buildCodePractice } from './codePractice'
import { learningRecord } from './learningState'

export function validatedCompletedLessonIds(completedIds, learning, lessonList) {
  const lessonById = new Map((Array.isArray(lessonList) ? lessonList : []).map((lesson) => [lesson.id, lesson]))

  return (Array.isArray(completedIds) ? completedIds : []).filter((lessonId) => {
    const lesson = lessonById.get(lessonId)
    if (!lesson) return false
    const record = learningRecord(learning, lessonId)
    if (buildCodePractice(lesson) && record.codePassed !== true) return false

    // v2+ completions are created only after the lesson checkpoint succeeds.
    // Older saved progress is preserved instead of silently deleting user history.
    if ((Number(record.completionEvidenceVersion) || 0) >= 2) {
      const masteredConceptIds = record.masteryCheckpoint?.masteredConceptIds
      if (!record.masteredAt || !Array.isArray(masteredConceptIds) || masteredConceptIds.length === 0) return false
    }

    return true
  })
}
