import { arrangeChoices, hashString } from './choiceUtils.js'

export function getGuidedLearningGoal(lesson) {
  if (lesson.learningGoal) return lesson.learningGoal
  const mainAnswer = lesson.options?.[lesson.answer]
  return mainAnswer
    ? `Bu ders sonunda “${lesson.question}” sorusunu ezberlemeden gerekçesiyle cevaplayabilecek; ${lesson.title} konusunu kod veya sistem davranışı üzerinden açıklayabileceksin.`
    : `Bu ders sonunda ${lesson.title} konusunu gerçek örnek ve kod üzerinde açıklayabilecek, temel kavramları birbirinden ayırabileceksin.`
}

export function getGuidedPrediction(lesson) {
  if (lesson.prediction) {
    const prediction = lesson.prediction
    if (!Array.isArray(prediction.options) || !prediction.options.length || !Number.isInteger(prediction.answer)) return prediction
    const arranged = arrangeChoices(
      prediction.options,
      prediction.answer,
      `${lesson.id}-custom-prediction-options`,
      hashString(`${lesson.id}-prediction-position`) % prediction.options.length,
    )
    return {
      ...prediction,
      options: arranged.options,
      answer: arranged.answer,
    }
  }
  const notes = lesson.codeNotes ?? []
  if (notes.length >= 3) {
    const sourceIndex = hashString(`${lesson.id}-prediction`) % notes.length
    const [fragment, explanation] = notes[sourceIndex]
    const wrong = notes.filter((_, index) => index !== sourceIndex).slice(0, 2)
    const options = [explanation, ...wrong.map(([, detail]) => detail)]
    const explanations = options.map((_, index) => index === 0
      ? `Doğru. ${fragment}: ${explanation}`
      : `Bu açıklama başka bir kod/model parçasına ait. ${fragment} burada ${explanation}`)
    return {
      prompt: `Koda bakıp tahmin et: \`${fragment}\` burada neyi temsil ediyor?`,
      ...arrangeChoices(options, 0, `${lesson.id}-prediction-options`, hashString(`${lesson.id}-prediction-position`) % options.length, explanations),
      explanation,
    }
  }
  if (!lesson.question || !Array.isArray(lesson.options) || lesson.options.length < 2 || !Number.isInteger(lesson.answer)) return null
  return {
    prompt: `Dersi okumadan önce tahmin et: ${lesson.question}`,
    options: lesson.options,
    answer: lesson.answer,
    explanation: `Doğru seçenek: ${lesson.options[lesson.answer]}. Şimdi bunun nedenini kavramlar ve gerçek örnek üzerinden bağlayacağız.`,
  }
}

export function getGuidedActiveRecall(lesson, lessonTerms = []) {
  if (lesson.activeRecall) return lesson.activeRecall
  const terms = lessonTerms.slice(0, 3).map(([term]) => term)
  const answer = lesson.points?.slice(0, 2).join(' ') || lesson.hook
  return {
    prompt: terms.length >= 2
      ? `30 saniyede anlat: ${lesson.title}. Cevabında ${terms.join(', ')} kavramlarını birbirine bağla.`
      : `30 saniyede anlat: ${lesson.title} konusundaki ana fikir ve pratik etkisi nedir?`,
    answer,
  }
}

export function getGuidedSummary(lesson) {
  if (lesson.lessonSummary?.length) return lesson.lessonSummary
  return lesson.points?.slice(0, 3) ?? []
}
