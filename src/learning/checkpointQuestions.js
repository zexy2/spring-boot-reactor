import { arrangeChoices, hashString } from './choiceUtils'
import { preserveRetryContext } from './adaptiveMastery'
import { codeNoteConceptId } from './learningState'
import { getLessonTerms, normalizeConcept } from './concepts'

function retryTokens(value) {
  return String(value)
    .replace(/`/g, '')
    .toLocaleLowerCase('tr-TR')
    .split(/[^a-z0-9çğıöşü@]+/i)
    .filter((token) => token.length >= 3 || /^\d+$/.test(token))
}

function findRetrySource(lesson, question, correctAnswer) {
  const questionTokens = retryTokens(question)
  const answerTokens = retryTokens(correctAnswer)
  let best = null
  let bestScore = 0
  ;(lesson.codeNotes ?? []).forEach((note) => {
    const fragment = String(note[0]).toLocaleLowerCase('tr-TR')
    const explanation = String(note[1]).toLocaleLowerCase('tr-TR')
    const questionScore = questionTokens.reduce((score, token) => score + (fragment.includes(token) ? 5 : explanation.includes(token) ? 2 : 0), 0)
    const answerScore = answerTokens.reduce((score, token) => score + (fragment.includes(token) ? 4 : explanation.includes(token) ? 1 : 0), 0)
    const score = questionScore + answerScore
    if (score > bestScore) {
      best = note
      bestScore = score
    }
  })
  return bestScore > 0 ? best : null
}

export function buildCheckpointQuestions(lesson) {
  const baseCorrect = lesson.options[lesson.answer]
  const baseExplanations = lesson.options.map((option, index) => (
    index === lesson.answer
      ? `Doğru. ${baseCorrect}. ${lesson.points?.[0] ?? lesson.hook}`
      : `Bu seçenek sorudaki ilişkiyi karşılamıyor. Doğru cevap \`${baseCorrect}\`. ${lesson.points?.[0] ?? lesson.hook}`
  ))
  const rawQuestions = [{
    id: `${lesson.id}-main`,
    conceptId: `${lesson.id}-main`,
    question: lesson.question,
    options: lesson.options,
    answer: lesson.answer,
    explanations: baseExplanations,
    retrySource: findRetrySource(lesson, lesson.question, baseCorrect),
  }]

  const notes = lesson.codeNotes ?? []
  if (notes.length >= 3) {
    const predictionIndex = hashString(`${lesson.id}-prediction`) % notes.length
    const sourceIndex = (predictionIndex + 1) % notes.length
    const [fragment, explanation] = notes[sourceIndex]
    const related = notes.filter((_, index) => index !== sourceIndex)
    const firstWrong = related[0]
    const secondWrong = related[1]
    rawQuestions.push({
      id: codeNoteConceptId(lesson.id, fragment),
      conceptId: codeNoteConceptId(lesson.id, fragment),
      question: `Kod/model okuma: \`${fragment}\` bu örnekte hangi rolü oynuyor?`,
      options: [explanation, firstWrong[1], secondWrong[1]],
      answer: 0,
      explanations: [
        `Doğru. \`${fragment}\`: ${explanation}`,
        `Bu açıklama \`${firstWrong[0]}\` parçasına ait. \`${fragment}\` burada ${explanation}`,
        `Bu açıklama \`${secondWrong[0]}\` parçasına ait. \`${fragment}\` burada ${explanation}`,
      ],
      retrySource: [fragment, explanation],
    })
  }

  const lessonTerms = getLessonTerms(lesson)
  if (lessonTerms.length >= 3) {
    const termIndex = hashString(`${lesson.id}-checkpoint-term`) % lessonTerms.length
    const [label, meaning] = lessonTerms[termIndex]
    const related = lessonTerms.filter((_, index) => index !== termIndex)
    const firstWrong = related[hashString(`${lesson.id}-term-wrong-1`) % related.length]
    const remaining = related.filter(([term]) => normalizeConcept(term) !== normalizeConcept(firstWrong[0]))
    const secondWrong = remaining[hashString(`${lesson.id}-term-wrong-2`) % remaining.length]
    rawQuestions.push({
      id: `${lesson.id}-${normalizeConcept(label)}`,
      conceptId: `${lesson.id}-${normalizeConcept(label)}`,
      label,
      meaning,
      question: `Kavram ayrımı: \`${label}\` neyi ifade eder?`,
      options: [meaning, firstWrong[1], secondWrong[1]],
      answer: 0,
      explanations: [
        `Doğru. \`${label}\`: ${meaning}`,
        `Bu açıklama \`${firstWrong[0]}\` kavramına ait. \`${label}\` ise ${meaning}`,
        `Bu açıklama \`${secondWrong[0]}\` kavramına ait. \`${label}\` ise ${meaning}`,
      ],
    })
  }

  const startPosition = hashString(`checkpoint-position-${lesson.id}`) % 3
  return rawQuestions.map((item, index) => ({
    ...item,
    ...arrangeChoices(
      item.options,
      item.answer,
      `${lesson.id}-mastery-${index}`,
      (startPosition + index) % item.options.length,
      item.explanations,
    ),
  }))
}

export function buildRetryQuestion(card, lesson, attempt = 1) {
  if (card.label && card.meaning) {
    const lessonTerms = getLessonTerms(lesson)
    const source = lessonTerms.length >= 3 ? lessonTerms : lesson.codeNotes
    const related = (source ?? []).filter(([label]) => normalizeConcept(label) !== normalizeConcept(card.label))
    const distractors = related.slice(0, 2).map(([label]) => label)
    while (distractors.length < 2) distractors.push(`Diğer seçenek ${distractors.length + 1}`)
    const options = [card.label, ...distractors]
    const explanations = [
      `Doğru. “${card.meaning}” açıklaması \`${card.label}\` kavramına ait.`,
      `Bu kavram başka bir açıklamaya ait. Aradığımız tanım: ${card.meaning}`,
      `Bu kavram başka bir açıklamaya ait. Aradığımız tanım: ${card.meaning}`,
    ]
    return {
      id: `${card.id}-retry-${attempt}`,
      conceptId: card.conceptId,
      isRetry: true,
      ...preserveRetryContext(card),
      question: `“${card.meaning}” hangi kavramı anlatıyor?`,
      ...arrangeChoices(options, 0, `${card.id}-retry-${attempt}`, (hashString(`${card.id}-${attempt}`) + 1) % 3, explanations),
    }
  }

  const source = card.retrySource ?? lesson.codeNotes?.[0]
  if (source) {
    const [fragment, explanation] = source
    const siblings = (lesson.codeNotes ?? []).filter(([item]) => item !== fragment).slice(0, 2)
    const options = [explanation, ...siblings.map(([, detail]) => detail)]
    while (options.length < 3) options.push(lesson.points?.[options.length - 1] ?? 'Bu kod parçasının görevi bu değildir.')
    const explanations = options.map((option, index) => (
      index === 0
        ? `Doğru. \`${fragment}\`: ${explanation}`
        : `Bu açıklama başka bir kod parçasına ait. \`${fragment}\` burada ${explanation}`
    ))
    return {
      id: `${card.id}-retry-${attempt}`,
      conceptId: card.conceptId,
      isRetry: true,
      ...preserveRetryContext(card, source),
      question: `\`${fragment}\` bu derste ne anlatıyor?`,
      ...arrangeChoices(options, 0, `${card.id}-retry-${attempt}`, (hashString(`${card.id}-${attempt}`) + 2) % 3, explanations),
    }
  }

  return {
    ...card,
    id: `${card.id}-retry-${attempt}`,
    isRetry: true,
  }
}
