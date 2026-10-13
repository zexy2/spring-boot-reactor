import { weakestConceptId } from './learningState'

export function buildAdaptiveMasteryPlan(questions, record) {
  const orderedQuestions = Array.isArray(questions) ? [...questions] : []
  const conceptIds = orderedQuestions.map((question) => question?.conceptId).filter(Boolean)
  const adaptiveConceptId = weakestConceptId(record, conceptIds)

  if (!adaptiveConceptId) {
    return { questions: orderedQuestions, adaptiveConceptId: null }
  }

  const weakIndex = orderedQuestions.findIndex((question) => question.conceptId === adaptiveConceptId)
  if (weakIndex > 0) {
    const [weakQuestion] = orderedQuestions.splice(weakIndex, 1)
    orderedQuestions.unshift(weakQuestion)
  }

  return { questions: orderedQuestions, adaptiveConceptId }
}

export function insertSpacedRetry(questions, retryQuestion, currentIndex) {
  const nextQuestions = Array.isArray(questions) ? [...questions] : []
  if (!retryQuestion) return nextQuestions

  const startIndex = Math.max(-1, Number(currentIndex) || 0) + 1
  const spacerIndex = nextQuestions.findIndex((question, index) => (
    index >= startIndex && question?.conceptId !== retryQuestion.conceptId
  ))
  const insertionIndex = spacerIndex >= 0 ? spacerIndex + 1 : nextQuestions.length

  nextQuestions.splice(insertionIndex, 0, retryQuestion)
  return nextQuestions
}

export function preserveRetryContext(card, retrySource = null) {
  const context = {}
  if (card?.label && card?.meaning) {
    context.label = card.label
    context.meaning = card.meaning
  }
  if (retrySource) context.retrySource = retrySource
  return context
}
