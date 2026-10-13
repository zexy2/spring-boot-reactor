import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { evaluateRecallCoverage } from '../../learning/learningState'

function normalizeConcept(value) {
  return String(value)
    .replace(/`/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .toLocaleLowerCase('tr-TR')
}

export default function ActiveRecall({ recall, lesson, lessonTerms, onAttempt }) {
  const [draft, setDraft] = useState('')
  const [evaluation, setEvaluation] = useState(null)
  const lessonTermTargets = lessonTerms.slice(0, 3).map(([label]) => label)
  const targetSource = recall.targets?.length
    ? recall.targets
    : lessonTermTargets.length
      ? lessonTermTargets
      : [{ label: lesson.title, conceptId: `${lesson.id}-main` }]
  const targets = targetSource
    .map((target) => {
      const label = typeof target === 'string' ? target : target?.label
      if (!label) return null
      const explicitConceptId = typeof target === 'object' && typeof target?.conceptId === 'string'
        ? target.conceptId.trim()
        : ''
      return { label, conceptId: explicitConceptId || `${lesson.id}-${normalizeConcept(label)}` }
    })
    .filter(Boolean)
  const nonWhitespaceLength = draft.replace(/\s/g, '').length
  const canEvaluate = nonWhitespaceLength >= 20
  const resultItems = Array.isArray(evaluation) ? evaluation : evaluation?.results ?? []
  const covered = resultItems.filter((result) => result.covered)
  const lessonPoints = Array.isArray(lesson.points) ? lesson.points.filter(Boolean) : []
  const flowReference = lessonPoints.find((point) => /(akış|önce|sonra|request|response|çağır|çalış|oluştur|gönder|yönlendir|pipeline|transaction|flush|commit|dependency|container)/i.test(point)) || lessonPoints[0]
  const tradeoffReference = lessonPoints.find((point) => /(trade.?off|avantaj|dezavantaj|risk|maliyet|ancak|ama|yerine|kolay|zor|performans|uygun|problem|yanlış)/i.test(point))
  const definitionReference = targets.slice(0, 3).map((target) => {
    const match = lessonTerms.find(([term]) => normalizeConcept(term) === normalizeConcept(target.label))
    return match ? `${match[0]}: ${match[1]}` : null
  }).filter(Boolean).join(' ')
  const selfCheckItems = [
    { label: 'Tanım', prompt: 'Ana kavramı kendi cümlenle net tanımladın mı?', reference: definitionReference || recall.answer },
    { label: 'Mekanizma / akış', prompt: 'Nasıl çalıştığını veya parçaların nasıl bağlandığını anlattın mı?', reference: flowReference || recall.answer },
    tradeoffReference && { label: 'Trade-off / sınır', prompt: 'Bir seçim, risk veya sınır varsa nedenini söyledin mi?', reference: tradeoffReference },
    lesson.hook && { label: 'Örnek / pratik etki', prompt: 'Kavramı gerçek bir durum veya pratik etkisiyle bağladın mı?', reference: lesson.hook },
  ].filter(Boolean).slice(0, 4)

  useEffect(() => {
    setDraft('')
    setEvaluation(null)
  }, [lesson.id, recall.prompt])

  const evaluate = () => {
    if (evaluation || !canEvaluate) return
    const results = evaluateRecallCoverage(draft, targets)
    setEvaluation(results)
    onAttempt(lesson.id, results.results)
  }

  return (
    <section className="active-recall">
      <div className="section-label"><span>ŞIKSIZ HATIRLA</span><b>KENDİ CÜMLENLE</b></div>
      <h2>{recall.prompt}</h2>
      <p>Önce kendi cevabını yaz. Değerlendirme yalnızca hedef kavramların cevabında kapsanıp kapsanmadığını ölçer; semantik doğruluk puanı değildir.</p>
      <textarea
        className="active-recall-draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={Boolean(evaluation)}
        rows={5}
        placeholder="Cevabını kendi cümlelerinle yaz..."
        aria-label="Aktif hatırlama cevabı"
      />
      <div className="active-recall-actions">
        {!evaluation && <p>{canEvaluate ? 'Değerlendirmeye hazır.' : `Değerlendirme için ${Math.max(0, 20 - nonWhitespaceLength)} boşluk dışı karakter daha yaz.`}</p>}
        <button type="button" className="reveal" onClick={evaluate} disabled={!canEvaluate || Boolean(evaluation)}>Kavram kapsamını değerlendir ve örnek cevabı göster</button>
      </div>
      <AnimatePresence>
        {evaluation && (
          <motion.div className="active-recall-answer active-recall-coverage" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <strong>Kavram kapsamı: {covered.length}/{resultItems.length}</strong>
            <div className="active-recall-targets">
              {resultItems.map((result) => <span key={result.conceptId} className={result.covered ? 'covered' : 'missed'}>{result.covered ? '✓' : '○'} {result.label}</span>)}
            </div>
            <strong>Örnek cevap</strong>
            <p>{recall.answer}</p>
            <strong>Kendi cevabını kontrol et</strong>
            <p>Bu maddeler otomatik puanlanmaz. Cevabını referanslarla karşılaştırıp kendin işaretle.</p>
            <div className="active-recall-targets" role="group" aria-label="Aktif hatırlama öz değerlendirme ölçütleri">
              {selfCheckItems.map((item) => (
                <label key={item.label}>
                  <input type="checkbox" /> <strong>{item.label}</strong> · {item.prompt}
                  <br /><small>Referans: {item.reference}</small>
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
