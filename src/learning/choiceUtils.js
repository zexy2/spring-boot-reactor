export function hashString(value) {
  const input = String(value)
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function shuffleChoices(options, answer, seedText, explanations = []) {
  const items = options.map((option, originalIndex) => ({
    option,
    originalIndex,
    explanation: explanations[originalIndex],
  }))
  let seed = hashString(seedText) || 1
  for (let index = items.length - 1; index > 0; index -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const swapIndex = seed % (index + 1)
    ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
  }
  return {
    options: items.map((item) => item.option),
    answer: items.findIndex((item) => item.originalIndex === answer),
    explanations: items.map((item) => item.explanation),
  }
}

export function arrangeChoices(options, answer, seedText, targetIndex, explanations = []) {
  const shuffled = shuffleChoices(options, answer, seedText, explanations)
  const items = shuffled.options.map((option, index) => ({
    option,
    explanation: shuffled.explanations[index],
    correct: index === shuffled.answer,
  }))
  const correctItem = items.find((item) => item.correct)
  const wrongItems = items.filter((item) => !item.correct)
  const target = targetIndex % options.length
  const arranged = options.map((_, index) => (index === target ? correctItem : wrongItems.shift()))

  return {
    options: arranged.map((item) => item.option),
    answer: target,
    explanations: arranged.map((item) => item.explanation),
  }
}
