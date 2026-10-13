import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { buildCodePractice, evaluateCodeRequirements, getSyntaxTemplates } from '../../learning/codePractice'

let javaParserPromise

function loadJavaParser() {
  if (!javaParserPromise) {
    javaParserPromise = import('java-parser').catch((error) => {
      javaParserPromise = undefined
      throw error
    })
  }
  return javaParserPromise
}

export function prefetchCodeWorkoutRuntime(lesson) {
  const challenge = buildCodePractice(lesson)
  if (!challenge || getSyntaxTemplates(challenge).length === 0) return Promise.resolve(null)
  return loadJavaParser().catch(() => null)
}

export default function CodeWorkout({ lesson, passed, onComplete }) {
  const challenge = useMemo(() => buildCodePractice(lesson), [lesson])
  const [answer, setAnswer] = useState(challenge?.editableStarter ? challenge.starter : '')
  const [checked, setChecked] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [syntaxResult, setSyntaxResult] = useState(null)
  const verificationId = useRef(0)
  const gutterRef = useRef(null)

  useEffect(() => {
    verificationId.current += 1
    setAnswer(challenge?.editableStarter ? challenge.starter : '')
    setChecked(false)
    setRevealed(false)
    setSyntaxResult(null)
    return () => { verificationId.current += 1 }
  }, [lesson.id, challenge?.editableStarter, challenge?.starter])

  if (!challenge) return null

  const { checks, staticSuccess } = evaluateCodeRequirements(answer, challenge)
  const syntaxTemplates = getSyntaxTemplates(challenge)
  const syntaxRequired = syntaxTemplates.length > 0
  const syntaxOk = !syntaxRequired || syntaxResult?.ok === true
  const success = staticSuccess && syntaxOk

  const updateAnswer = (nextAnswer) => {
    verificationId.current += 1
    setAnswer(nextAnswer)
    setChecked(false)
    setSyntaxResult(null)
  }

  const verify = async () => {
    if (!answer.trim() || syntaxResult?.checking) return
    const thisCheck = ++verificationId.current
    setChecked(true)
    if (!staticSuccess) {
      setSyntaxResult(null)
      return
    }
    if (!syntaxRequired) {
      if (!passed) onComplete(lesson.id)
      return
    }

    setSyntaxResult({ checking: true, ok: false })
    try {
      const { parse } = await loadJavaParser()
      let lastError = null
      let parsed = false
      for (const template of syntaxTemplates) {
        try {
          parse(template.replace('__ANSWER__', answer))
          parsed = true
          break
        } catch (error) {
          lastError = error
        }
      }
      if (!parsed) throw lastError
      if (verificationId.current !== thisCheck) return
      setSyntaxResult({ checking: false, ok: true })
      if (!passed) onComplete(lesson.id)
    } catch (error) {
      if (verificationId.current !== thisCheck) return
      const rawMessage = String(error?.message || '').split('\n')[0].slice(0, 220)
      const message = /sad sad panda|line:\s*NaN|column:\s*NaN/i.test(rawMessage)
        ? 'Java parser sözdizimi hatası buldu. Parantezleri, annotation konumunu ve class/method yapısını kontrol et.'
        : (rawMessage || 'Java sözdizimi çözümlenemedi. Parantezleri ve declaration yapısını kontrol et.')
      setSyntaxResult({ checking: false, ok: false, message })
    }
  }

  const editKeyboard = (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void verify()
    } else if (event.key === 'Tab' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      const editor = event.currentTarget
      const start = editor.selectionStart
      const end = editor.selectionEnd
      updateAnswer(`${answer.slice(0, start)}  ${answer.slice(end)}`)
      window.requestAnimationFrame(() => editor.setSelectionRange(start + 2, start + 2))
    }
  }

  let feedbackTitle = success ? 'Gerekli kod parçalarını kurdun.' : 'Henüz eksik parça var.'
  let feedbackText = success
    ? 'Statik gereksinimler doğrulandı. Pratik öğrenme kaydına işlendi; gerçek Java çalıştırma testi yapılmadı.'
    : 'Requirement satırlarına bakıp kodu düzelt; doğrudan cevabı kopyalamadan bir kez daha dene.'
  if (checked && staticSuccess && syntaxRequired) {
    if (syntaxResult?.checking) {
      feedbackTitle = 'Java sözdizimi kontrol ediliyor…'
      feedbackText = 'Kod tarayıcıda Java grammar parser ile ayrıştırılıyor.'
    } else if (syntaxResult?.ok) {
      feedbackTitle = 'Java sözdizimi geçerli.'
      feedbackText = 'Kavram gereksinimleri ve Java grammar kontrolü birlikte geçti. Bu bir type-check/compile değildir.'
    } else {
      feedbackTitle = 'Java sözdizimi hatası var.'
      feedbackText = syntaxResult?.message || 'Parantez, annotation, generic veya declaration yapısını tekrar kontrol et.'
    }
  }

  return (
    <section className={`code-workout ${passed || success ? 'passed' : ''}`}>
      <div className="section-label"><span>KODU SEN YAZ</span><b>{passed || success ? '✓ TAMAMLANDI' : 'EDITOR CHALLENGE'}</b></div>
      <h2>{challenge.prompt}</h2>
      <p>{challenge.editableStarter
        ? 'Sağdaki Java iskeletindeki TODO satırlarını gerçek kodla değiştir. Gereksinimler ve Java sözdizimi kontrol edilir; kod derlenip çalıştırılmaz.'
        : 'Eksik kodu kendin yaz. Kontrol, önemli söz dizimi ve kavramları arar; kod derlenip çalıştırılmaz.'}</p>
      <div className="code-workout-grid">
        <div>{challenge.editableStarter
          ? <><small>GÖREV VE BEKLENEN DAVRANIŞ</small><div className="code-workout-guide"><strong>HEDEF</strong><p>{challenge.expectedBehavior}</p><strong>DÜŞÜN</strong><p>{challenge.reviewQuestion}</p></div></>
          : <><small>STARTER</small><pre><code>{challenge.starter}</code></pre></>}
        </div>
        <div><small>SENİN KODUN</small>
          <div className="code-editor-shell">
            <div className="code-editor-gutter" ref={gutterRef} aria-hidden="true">{answer.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div>
            <textarea aria-label={`${lesson.title} kod editörü`} wrap="off" value={answer} onChange={(event) => updateAnswer(event.target.value)} onKeyDown={editKeyboard} onScroll={(event) => { if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop }} spellCheck="false" placeholder="Eksik kodu buraya yaz..." />
          </div>
          <p className="code-scroll-help">Tab: 2 boşluk · Ctrl/Cmd+Enter: kontrol · Uzun satırlar yatay kaydırılır.</p>
        </div>
      </div>
      <div className="code-requirements">
        {checks.map((item) => <span key={item.label} className={checked ? (item.ok ? 'ok' : 'missing') : ''}>{checked ? (item.ok ? '✓' : '×') : '·'} {item.label}</span>)}
        {syntaxRequired && <span className={checked && syntaxResult && !syntaxResult.checking ? (syntaxResult.ok ? 'ok' : 'missing') : ''}>{checked && syntaxResult ? (syntaxResult.checking ? '…' : syntaxResult.ok ? '✓' : '×') : '·'} Java sözdizimi</span>}
      </div>
      {checked && <div className={`code-workout-feedback ${success ? 'good' : 'bad'}`}><strong>{feedbackTitle}</strong><span>{feedbackText}</span></div>}
      {challenge.hint && <details className="code-workout-hint"><summary>İpucu göster</summary><p>{challenge.hint}</p></details>}
      <div className="code-workout-actions">
        <button className="complete-button" onClick={verify} disabled={!answer.trim() || syntaxResult?.checking}>{syntaxResult?.checking ? 'Kontrol ediliyor…' : 'Kodu kontrol et'}</button>
        {challenge.editableStarter && <button className="reveal" onClick={() => { updateAnswer(challenge.starter); setRevealed(false) }}>Baştan başla</button>}
        <button className="reveal" onClick={() => setRevealed((value) => !value)}>{revealed ? 'Çözümü gizle' : 'Örnek çözümü göster'}</button>
      </div>
      {revealed && <p className="code-scroll-help code-solution-help">Örnek çözümde uzun satırları yana kaydır.</p>}
      <AnimatePresence>{revealed && <motion.pre className="code-solution" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><code>{challenge.solution}</code></motion.pre>}</AnimatePresence>
    </section>
  )
}
