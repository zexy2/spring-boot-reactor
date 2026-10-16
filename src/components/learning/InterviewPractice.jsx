import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { interviewDeck } from '../../data/curriculum'
import { selectRoleInterviewRound, summarizeRoleInterview } from '../../data/roleInterview'
import { hashString } from '../../learning/choiceUtils'
import { getLessonTerms } from '../../learning/concepts'
import { useInterviewCountdown } from './useInterviewCountdown'

function buildLessonInterviewDeck(lesson) {
  const cards = []
  const mainAnswer = lesson.options?.[lesson.answer]
  if (lesson.question && mainAnswer) {
    cards.push([
      lesson.question,
      `${mainAnswer}. ${lesson.points?.[0] ?? lesson.hook}`,
    ])
  }

  const terms = getLessonTerms(lesson)
  if (terms.length > 0) {
    const [term, meaning] = terms[hashString(`${lesson.id}-interview-term`) % terms.length]
    cards.push([
      `\`${term}\` kavramını mülakatta nasıl açıklarsın?`,
      meaning,
    ])
  }

  if (lesson.codeNotes?.length > 0) {
    const [fragment, explanation] = lesson.codeNotes[hashString(`${lesson.id}-interview-code`) % lesson.codeNotes.length]
    cards.push([
      `Bu kod parçası ne yapıyor: \`${fragment}\`?`,
      explanation,
    ])
  }

  return cards.slice(0, 3)
}

const interviewRubric = [
  'Tanımı net ve kısa verdim',
  'Nasıl çalıştığını / mekanizmayı anlattım',
  'Bir sınır, risk veya trade-off söyledim',
  'Somut örnekle bağladım',
]

function InterviewMode({ lesson, record, onAttempt }) {
  const [index, setIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const { secondsLeft, running, startCountdown, stopCountdown, resetCountdown } = useInterviewCountdown(60, () => setRevealed(true))
  const [rubric, setRubric] = useState(() => interviewRubric.map(() => false))
  const [submittedScore, setSubmittedScore] = useState(null)
  const deck = useMemo(() => buildLessonInterviewDeck(lesson), [lesson])
  const card = deck[index] ?? deck[0]

  useEffect(() => {
    setIndex(0)
    setStarted(false)
    resetCountdown()
    setAnswer('')
    setRevealed(false)
    setRubric(interviewRubric.map(() => false))
    setSubmittedScore(null)
  }, [lesson.id, resetCountdown])

  if (!card) return null

  const resetAttempt = () => {
    setStarted(false)
    resetCountdown()
    setAnswer('')
    setRevealed(false)
    setRubric(interviewRubric.map(() => false))
    setSubmittedScore(null)
  }

  const start = () => {
    resetAttempt()
    setStarted(true)
    startCountdown()
  }

  const revealForScoring = () => {
    if (!started) return
    stopCountdown()
    setRevealed(true)
  }

  const score = rubric.filter(Boolean).length
  const saveScore = () => {
    if (submittedScore !== null) return
    onAttempt?.(lesson.id, score)
    setSubmittedScore(score)
  }

  const next = () => {
    setIndex((current) => (current + 1) % deck.length)
    resetAttempt()
  }

  return (
    <section className="interview-card">
      <div className="section-label"><span>DERSİN 60 SANİYELİK MÜLAKATI</span><b>{index + 1}/{deck.length} · EN İYİ {record?.interviewBestScore ?? 0}/4</b></div>
      <small className="interview-topic">{lesson.title}</small>
      <div className="interview-question-row"><h2>{card[0]}</h2><strong className={`interview-timer ${secondsLeft <= 10 && started ? 'urgent' : ''}`}>{secondsLeft}s</strong></div>
      {!started && <button className="reveal" onClick={start}>60 saniyeyi başlat</button>}
      {started && (
        <>
          <textarea
            className="interview-answer"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={revealed}
            placeholder="Mülakatta söyleyeceğin cevabı kısa maddeler halinde yaz..."
            aria-label="Mülakat cevabın"
          />
          {!revealed && <button className="reveal" onClick={revealForScoring}>{running ? 'Cevabı bitir ve değerlendir' : 'Değerlendir'}</button>}
        </>
      )}
      <AnimatePresence>
        {revealed && (
          <motion.div className="interview-evaluation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="interview-reference"><small>REFERANS CEVAP</small><p>{card[1]}</p></div>
            <div className="interview-rubric">
              <small>RUBRİK · KENDİNİ 0–4 PUANLA</small>
              {interviewRubric.map((item, rubricIndex) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={rubric[rubricIndex]}
                    disabled={submittedScore !== null}
                    onChange={() => setRubric((items) => items.map((value, itemIndex) => itemIndex === rubricIndex ? !value : value))}
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
            <div className="interview-score-actions">
              <strong>{submittedScore === null ? score : submittedScore}/4</strong>
              <button className="reveal" onClick={saveScore} disabled={submittedScore !== null}>{submittedScore === null ? 'Skoru kaydet' : 'Kaydedildi'}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {deck.length > 1 && revealed && submittedScore !== null && <button className="next-card" onClick={next}>Bu dersten başka soru →</button>}
    </section>
  )
}

function RoleInterviewPanel() {
  const [mode, setMode] = useState('idle')
  const [round, setRound] = useState(() => {
    try {
      const completedRounds = JSON.parse(window.localStorage.getItem('spring-reactor-role-interview-v1') ?? 'null')?.round
      return Number.isSafeInteger(completedRounds) && completedRounds >= 0 ? completedRounds : 0
    } catch {
      return 0
    }
  })
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const { secondsLeft, running, startCountdown, stopCountdown, resetCountdown } = useInterviewCountdown(90, () => setRevealed(true))
  const [rubric, setRubric] = useState([false, false, false, false])
  const [scores, setScores] = useState([])
  const [lastResult, setLastResult] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('spring-reactor-role-interview-v1') ?? 'null')
    } catch {
      return null
    }
  })
  const deck = useMemo(() => selectRoleInterviewRound(round), [round])
  const card = deck[index]

  const resetQuestion = () => {
    resetCountdown()
    setAnswer('')
    setRevealed(false)
    setRubric([false, false, false, false])
  }

  const startRound = () => {
    if (mode === 'complete') setRound((value) => value + 1)
    setMode('active')
    setIndex(0)
    setScores([])
    resetQuestion()
    startCountdown()
  }

  const evaluate = () => {
    stopCountdown()
    setRevealed(true)
  }

  const score = rubric.filter(Boolean).length
  const saveAndContinue = () => {
    const nextScores = [...scores, score]
    setScores(nextScores)
    if (index === deck.length - 1) {
      const result = summarizeRoleInterview(deck, nextScores)
      const snapshot = { round: round + 1, total: result.total, max: result.max, average: result.average, completedAt: new Date().toISOString() }
      setLastResult(snapshot)
      try {
        window.localStorage.setItem('spring-reactor-role-interview-v1', JSON.stringify(snapshot))
      } catch {
        // Private browsing or disabled storage: round still completes in memory.
      }
      stopCountdown()
      setMode('complete')
      return
    }
    setIndex((value) => value + 1)
    resetQuestion()
    startCountdown()
  }

  if (mode === 'idle') {
    return (
      <section className="role-interview-launcher" aria-label="Gerçek dünya teknik senaryo provası">
        <div>
          <span className="eyebrow">EK PRATİK · GERÇEK DÜNYA SENARYOLARI</span>
          <h3>Gerçek iş senaryolarıyla prova.</h3>
          <p>6 soru · 90 saniye/soru · Spring, SQL, DDD, messaging, CI/CD ve production sorunları. 3 farklı tur; model cevap ve kritik hatalar.</p>
          {lastResult && <small className="role-interview-last">Son tur: {lastResult.total}/{lastResult.max} · ortalama {Number(lastResult.average).toFixed(1)}/4 (öz değerlendirme)</small>}
        </div>
        <button type="button" onClick={startRound}>6 soruluk senaryo turunu başlat</button>
      </section>
    )
  }

  if (mode === 'complete') {
    const summary = summarizeRoleInterview(deck, scores)
    return (
      <section className="interview-card role-interview-card" aria-label="Teknik senaryo turu sonuçları">
        <div className="section-label"><span>SENARYO TURU TAMAMLANDI</span><b>6/6 SORU</b></div>
        <h2>Öz değerlendirme: {summary.total}/{summary.max}</h2>
        <p>Ortalama {summary.average.toFixed(1)}/4. Bu skor verdiğin işaretlere dayanır; cevabın otomatik doğruluğunu ölçmez.</p>
        <div className="role-score-grid">
          {deck.map((question, questionIndex) => (
            <div className={scores[questionIndex] <= 2 ? 'role-score-low' : ''} key={question.id}>
              <span>{question.domainLabel}</span><strong>{scores[questionIndex]}/4</strong>
            </div>
          ))}
        </div>
        {summary.needsWork.length > 0 ? (
          <div className="role-revision-list"><strong>Önce bu konuları tekrar et:</strong>
            {summary.needsWork.map((item) => <p key={item.id}>{item.domainLabel}: {item.question}</p>)}
          </div>
        ) : <p>Tüm başlıkları 3/4 veya üzerinde puanladın. Referans yanıtlardaki riskleri sözlü olarak tekrar et.</p>}
        <button className="reveal" onClick={startRound}>Sonraki 6 soruluk tur</button>
        <button className="next-card" onClick={() => setMode('idle')}>Ana ekrana dön</button>
      </section>
    )
  }

  return (
    <section className="interview-card role-interview-card" aria-label="Teknik senaryo sorusu">
      <div className="section-label"><span>TEKNİK SENARYO · {card.domainLabel}</span><b>{index + 1}/{deck.length} · TUR {round + 1}</b></div>
      <div className="role-interview-progress" role="progressbar" aria-valuenow={index} aria-valuemin={0} aria-valuemax={deck.length} aria-label="Tamamlanan mülakat sorusu">
        <span style={{ width: `${100 * index / deck.length}%` }} />
      </div>
      <div className="interview-question-row"><h2>{card.question}</h2><strong className={`interview-timer ${secondsLeft <= 10 && running ? 'urgent' : ''}`}>{secondsLeft}s</strong></div>
      <div className="role-interview-followup"><small>TAKİP SORUSU</small><p>{card.followUp}</p></div>
      <label htmlFor="role-interview-answer" className="role-interview-instruction">Cevabı sesli anlat. İstersen kısa not al; metin zorunlu değil.</label>
      <textarea
        id="role-interview-answer"
        className="interview-answer"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={revealed}
        placeholder="Problem → tasarım kararı → risk/trade-off → somut örnek"
      />
      {!revealed && <button className="reveal" onClick={evaluate}>Cevabı bitir ve değerlendir</button>}
      {revealed && (
        <div className="interview-evaluation">
          <div className="role-interview-reference"><small>GÜÇLÜ CEVAPTA OLMASI GEREKENLER</small>
            <ol>{card.answer.map((step) => <li key={step}>{step}</li>)}</ol>
          </div>
          <div className="role-interview-pitfall"><strong>YAYGIN TEKNİK HATA</strong><p>{card.pitfall}</p></div>
          <div className="interview-rubric"><small>ÖZ DEĞERLENDİRME · YALNIZCA GERÇEKTEN ANLATTIĞIN MADDELERİ İŞARETLE</small>
            {card.rubric.map((item, rubricIndex) => (
              <label key={item}><input type="checkbox" checked={rubric[rubricIndex]} onChange={() => setRubric((items) => items.map((value, itemIndex) => rubricIndex === itemIndex ? !value : value))} /><span>{item}</span></label>
            ))}
          </div>
          <div className="interview-score-actions"><strong>{score}/4</strong><button className="reveal" onClick={saveAndContinue}>{index === deck.length - 1 ? 'Sonuçları göster' : 'Puanı kaydet · sonraki soru'}</button></div>
        </div>
      )}
    </section>
  )
}

function MixedInterviewPanel() {
  const [open, setOpen] = useState(false)
  const [round, setRound] = useState(0)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const { secondsLeft, startCountdown, stopCountdown, resetCountdown } = useInterviewCountdown(60, () => setRevealed(true))
  const [rubric, setRubric] = useState(() => interviewRubric.map(() => false))
  const [scores, setScores] = useState([])
  const sessionDeck = useMemo(() => {
    if (interviewDeck.length <= 5) return interviewDeck
    const stride = Math.max(1, Math.floor(interviewDeck.length / 5))
    const offset = (new Date().getDate() + (round * 5)) % interviewDeck.length
    return Array.from({ length: 5 }, (_, itemIndex) => interviewDeck[(offset + (itemIndex * stride)) % interviewDeck.length])
  }, [round])
  const card = sessionDeck[index] ?? sessionDeck[0]

  const resetQuestion = () => {
    resetCountdown()
    setAnswer('')
    setRevealed(false)
    setRubric(interviewRubric.map(() => false))
  }

  const start = () => {
    setRound((current) => current + 1)
    setOpen(true)
    setIndex(0)
    setScores([])
    resetQuestion()
    startCountdown()
  }

  const score = rubric.filter(Boolean).length
  const saveAndContinue = () => {
    const nextScores = [...scores, score]
    setScores(nextScores)
    if (index >= sessionDeck.length - 1) {
      stopCountdown()
      return
    }
    setIndex((current) => current + 1)
    resetQuestion()
    startCountdown()
  }

  const complete = scores.length === sessionDeck.length
  const average = complete ? (scores.reduce((sum, item) => sum + item, 0) / scores.length).toFixed(1) : null

  if (!open) {
    return (
      <section className="mixed-interview-launcher" aria-label="Karma mülakat provası">
        <div><span className="eyebrow">KARMA MÜLAKAT</span><strong>Tek ders ezberini kır.</strong><p>Java, Spring, SQL, microservices ve delivery konuları arasında 5 soruluk gerçekçi geçiş provası.</p></div>
        <button onClick={start}>5 soruluk turu başlat →</button>
      </section>
    )
  }

  if (complete) {
    return (
      <section className="interview-card mixed-interview-card">
        <div className="section-label"><span>KARMA MÜLAKAT TAMAMLANDI</span><b>{sessionDeck.length}/{sessionDeck.length}</b></div>
        <h2>Tur ortalaması: {average}/4</h2>
        <p>{Number(average) >= 3 ? 'Cevap yapın güçlü görünüyor. Sonraki turda örnek ve trade-off kalitesini sıkılaştır.' : 'Cevap yapısında boşluk var. Referans cevaplarda tanım → mekanizma → risk/trade-off → örnek sırasını tekrar çalış.'}</p>
        <button className="reveal" onClick={start}>Yeni karma tur →</button>
      </section>
    )
  }

  return (
    <section className="interview-card mixed-interview-card">
      <div className="section-label"><span>KARMA 60 SANİYE MÜLAKAT</span><b>{index + 1}/{sessionDeck.length}</b></div>
      <small className="interview-topic">JAVA BACKEND · KONU GEÇİŞİ</small>
      <div className="interview-question-row"><h2>{card[0]}</h2><strong className={`interview-timer ${secondsLeft <= 10 ? 'urgent' : ''}`}>{secondsLeft}s</strong></div>
      <textarea
        className="interview-answer"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={revealed}
        placeholder="Cevabı mülakatta söyleyeceğin sırayla yaz..."
        aria-label="Karma mülakat cevabın"
      />
      {!revealed && <button className="reveal" onClick={() => { stopCountdown(); setRevealed(true) }}>Cevabı bitir ve değerlendir</button>}
      {revealed && (
        <div className="interview-evaluation">
          <div className="interview-reference"><small>REFERANS CEVAP</small><p>{card[1]}</p></div>
          <div className="interview-rubric">
            <small>RUBRİK · KENDİNİ 0–4 PUANLA</small>
            {interviewRubric.map((item, rubricIndex) => (
              <label key={item}>
                <input type="checkbox" checked={rubric[rubricIndex]} onChange={() => setRubric((items) => items.map((value, itemIndex) => itemIndex === rubricIndex ? !value : value))} />
                <span>{item}</span>
              </label>
            ))}
          </div>
          <div className="interview-score-actions"><strong>{score}/4</strong><button className="reveal" onClick={saveAndContinue}>{index === sessionDeck.length - 1 ? 'Turu bitir' : 'Skoru kaydet · sıradaki →'}</button></div>
        </div>
      )}
    </section>
  )
}

export { InterviewMode, MixedInterviewPanel, RoleInterviewPanel }
