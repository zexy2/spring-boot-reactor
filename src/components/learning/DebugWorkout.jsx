import { useEffect, useState } from 'react'
import { evaluateDebugChoice, getDebugChallenge } from '../../learning/debugChallenges'

export default function DebugWorkout({ lesson, record, onAttempt }) {
  const challenge = getDebugChallenge(lesson)
  const [stage, setStage] = useState('diagnosis')
  const [selected, setSelected] = useState(null)
  const [result, setResult] = useState(null)
  const [hintShown, setHintShown] = useState(false)

  useEffect(() => {
    setStage('diagnosis')
    setSelected(null)
    setResult(null)
    setHintShown(false)
  }, [lesson.id])

  if (!challenge) return null

  const isSolved = stage === 'solved'
  const options = stage === 'diagnosis' ? challenge.diagnosis : challenge.fixes
  const choose = () => {
    const correct = evaluateDebugChoice(challenge, stage, selected)
    setResult(correct ? 'correct' : 'wrong')
    onAttempt(lesson.id, { stage, correct, solved: correct && stage === 'fix' })
  }
  const next = () => {
    setStage(stage === 'diagnosis' ? 'fix' : 'solved')
    setSelected(null)
    setResult(null)
  }
  return (
    <section className="debug-workout" aria-label="Hata ayıklama alıştırması">
      <div className="section-label"><span>HATAYI BUL · DÜZELT</span><b>{isSolved ? 'ÇÖZÜLDÜ' : stage === 'diagnosis' ? '1/2 TEŞHİS' : '2/2 ÇÖZÜM'}</b></div>
      <h2>{challenge.title}</h2>
      <p className="debug-symptom"><strong>PRODUCTION BELİRTİSİ</strong>{challenge.symptom}</p>
      <pre className="debug-broken"><code>{challenge.broken}</code></pre>
      {!isSolved && <>
        <h3>{stage === 'diagnosis' ? 'Bu davranışın asıl nedeni hangisi?' : 'Hangi değişiklik sorunu giderir?'}</h3>
        <div className="debug-options" role="group" aria-label={stage === 'diagnosis' ? 'Hata teşhisi' : 'Kod düzeltmesi'}>
          {options.map((option, index) => <button type="button" key={option} className={selected === index ? 'selected' : ''} aria-pressed={selected === index} disabled={result === 'correct'} onClick={() => { setSelected(index); setResult(null) }}><span>{String.fromCharCode(65 + index)}</span><code>{option}</code></button>)}
        </div>
        <div className="debug-actions">
          <button type="button" className="complete-button" disabled={selected === null || result === 'correct'} onClick={choose}>Cevabı kontrol et</button>
          {result === 'correct' && <button type="button" className="reveal" onClick={next}>{stage === 'diagnosis' ? 'Düzeltmeye geç' : 'Açıklamayı gör'}</button>}
          {!hintShown && <button type="button" className="reveal" onClick={() => { setHintShown(true); onAttempt(lesson.id, { hint: true }) }}>İpucu al</button>}
        </div>
        {hintShown && <p className="debug-hint">{challenge.hint}</p>}
        {result && <p className={`debug-feedback ${result}`} role="status">{result === 'correct' ? 'Doğru. Sonraki adıma geçebilirsin.' : 'Bu seçenek hatanın kök nedenini çözmüyor. Bir kez daha dene.'}</p>}
      </>}
      {isSolved && <div className="debug-explanation" role="status"><strong>KÖK NEDEN VE NEDEN BU ÇÖZÜM?</strong><p>{challenge.explanation}</p><small>Bu alıştırma senaryo ve seçenek kontrolüdür; gerçek Java kodu derlenmedi veya çalıştırılmadı.</small><button type="button" className="reveal" onClick={() => { setStage('diagnosis'); setSelected(null); setResult(null); setHintShown(false) }}>Yeniden çöz</button></div>}
      <div className="debug-stats">Geçmiş denemelerin: {record?.debugAttempts || 0} · yanlış: {record?.debugWrong || 0} · ipucu: {record?.debugHints || 0} · çözülen: {record?.debugSolved ? 'evet' : 'henüz değil'}</div>
    </section>
  )
}
