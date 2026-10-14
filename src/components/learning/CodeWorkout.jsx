import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { buildCodePractice, evaluateCodeRequirements, getSyntaxTemplates } from '../../learning/codePractice'
import { MAX_CODE_DRAFT_LENGTH } from '../../learning/progressTransfer'
import { prefetchJavaSyntaxRuntime, validateJavaSyntax } from '../../learning/javaSyntaxRuntime'

const JavaCodeEditor = lazy(() => import('./JavaCodeEditor'))

export function prefetchCodeWorkoutRuntime(lesson) {
  const challenge = buildCodePractice(lesson)
  if (!challenge || getSyntaxTemplates(challenge).length === 0) return Promise.resolve(null)
  prefetchJavaSyntaxRuntime()
  return Promise.resolve(null)
}

export default function CodeWorkout({ lesson, passed, onComplete, savedDraft, onDraftChange }) {
  const challenge = useMemo(() => buildCodePractice(lesson), [lesson])
  const initialAnswer = () => typeof savedDraft === 'string' ? savedDraft : challenge?.editableStarter ? challenge.starter : ''
  const [answer, setAnswer] = useState(initialAnswer)
  const [checked, setChecked] = useState(false)
  const [checkedRequirements, setCheckedRequirements] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [syntaxResult, setSyntaxResult] = useState(null)
  const verificationId = useRef(0)
  const actionsRef = useRef(null)
  const editorHelpId = useId()
  const uncheckedRequirements = useMemo(() => challenge ? evaluateCodeRequirements('', challenge) : null, [challenge])
  const syntaxTemplates = useMemo(() => challenge ? getSyntaxTemplates(challenge) : [], [challenge])

  useEffect(() => {
    verificationId.current += 1
    setAnswer(initialAnswer())
    setChecked(false)
    setCheckedRequirements(null)
    setRevealed(false)
    setLimitReached(false)
    setSyntaxResult(null)
    return () => { verificationId.current += 1 }
  }, [lesson.id, challenge?.editableStarter, challenge?.starter])

  useEffect(() => {
    const restoredAnswer = initialAnswer()
    // JSON restore can replace the saved draft without changing the active lesson.
    // Local edits update answer and savedDraft in the same React event, so only
    // an external change needs to reset the editor and any prior verification.
    if (restoredAnswer === answer) return
    verificationId.current += 1
    setAnswer(restoredAnswer)
    setChecked(false)
    setCheckedRequirements(null)
    setRevealed(false)
    setLimitReached(false)
    setSyntaxResult(null)
  }, [savedDraft])

  if (!challenge) return null

  // Before submission, requirement badges only display their labels. Avoid
  // repeatedly parsing the full editor buffer on every keystroke.
  const { checks, staticSuccess, feedback } = checked && checkedRequirements
    ? checkedRequirements
    : uncheckedRequirements
  const missingChecks = checks.filter((item) => !item.ok).map((item) => item.label)
  const missingSummary = missingChecks.length > 0
    ? `Eksik şartlar: ${missingChecks.slice(0, 3).join(', ')}${missingChecks.length > 3 ? ` ve ${missingChecks.length - 3} diğer şart` : ''}.`
    : 'Görev şartlarını tekrar kontrol et.'
  const syntaxRequired = syntaxTemplates.length > 0
  const isFragmentExercise = challenge.answerMode === 'fragment'
  const syntaxOk = !syntaxRequired || syntaxResult?.ok === true
  const success = staticSuccess && syntaxOk
  const displayedPass = passed || (checked && success)

  const updateAnswer = (nextAnswer) => {
    setLimitReached(false)
    verificationId.current += 1
    setAnswer(nextAnswer)
    setChecked(false)
    setCheckedRequirements(null)
    setSyntaxResult(null)
    if (nextAnswer.length <= MAX_CODE_DRAFT_LENGTH) onDraftChange?.(lesson.id, nextAnswer)
  }

  const leaveEditor = () => {
    const actions = actionsRef.current
    if (!actions) return
    const verifyButton = actions.querySelector('.complete-button')
    // The answer can be empty (or syntax checking still in progress).
    // Keep Escape neutral; never move focus straight to "show solution".
    if (verifyButton && !verifyButton.disabled) verifyButton.focus()
    else actions.focus()
  }

  const verify = async () => {
    if (!answer.trim() || syntaxResult?.checking) return
    const thisCheck = ++verificationId.current
    const currentRequirements = evaluateCodeRequirements(answer, challenge)
    setCheckedRequirements(currentRequirements)
    setChecked(true)
    if (!syntaxRequired) {
      if (currentRequirements.staticSuccess && !passed) onComplete(lesson.id)
      return
    }

    setSyntaxResult({ checking: true, ok: false })
    try {
      const result = await validateJavaSyntax(answer, syntaxTemplates)
      if (verificationId.current !== thisCheck) return
      setSyntaxResult({ checking: false, ok: result.ok, message: result.message })
      if (result.ok && currentRequirements.staticSuccess && !passed) onComplete(lesson.id)
    } catch (error) {
      if (verificationId.current !== thisCheck) return
      setSyntaxResult({ checking: false, ok: false, unavailable: true, message: error?.message })
    }
  }


  let feedbackTitle = success ? (isFragmentExercise ? 'Eksik parçayı doğru tamamladın.' : 'Gerekli kod parçalarını kurdun.') : 'Henüz eksik parça var.'
  let feedbackText = success
    ? isFragmentExercise
      ? 'Eksik parçanın metni doğrulandı. Bu alıştırma kod derleme veya davranış testi değildir.'
      : 'Statik gereksinimler doğrulandı. Pratik öğrenme kaydına işlendi; gerçek Java çalıştırma testi yapılmadı.'
    : isFragmentExercise
      ? (checked && feedback) || 'Soldaki kod iskeletindeki TODO konumuna gelecek tek parçayı yaz. Ek açıklama veya tüm kodu yapıştırma.'
      : 'Requirement satırlarına bakıp kodu düzelt; doğrudan cevabı kopyalamadan bir kez daha dene.'
  if (checked && syntaxRequired) {
    if (syntaxResult?.checking) {
      feedbackTitle = 'Java sözdizimi kontrol ediliyor…'
      feedbackText = staticSuccess
        ? 'Kod tarayıcıda Java grammar parser ile ayrıştırılıyor.'
        : `${missingSummary} Java sözdizimi ayrıca kontrol ediliyor.`
    } else if (syntaxResult?.ok) {
      feedbackTitle = staticSuccess ? 'Java sözdizimi geçerli.' : 'Java sözdizimi geçerli, görev eksik.'
      feedbackText = staticSuccess
        ? 'Kavram gereksinimleri ve Java grammar kontrolü birlikte geçti. Bu bir type-check/compile değildir.'
        : `${missingSummary} Sözdizimi geçerli olması derleme veya davranış doğrulaması değildir.`
    } else if (syntaxResult?.unavailable) {
      feedbackTitle = 'Java sözdizimi kontrol edilemedi.'
      feedbackText = `${syntaxResult.message}${staticSuccess ? '' : ` ${missingSummary}`}`
    } else if (syntaxResult && !syntaxResult.checking) {
      feedbackTitle = staticSuccess ? 'Java sözdizimi hatası var.' : 'Java sözdizimi hatası ve eksik şartlar var.'
      feedbackText = `${syntaxResult.message || 'Parantez, annotation, generic veya declaration yapısını tekrar kontrol et.'}${staticSuccess ? '' : ` ${missingSummary}`}`
    }
  }

  return (
    <section className={`code-workout ${displayedPass ? 'passed' : ''}`}>
      <div className="section-label"><span>{isFragmentExercise ? 'KOD PARÇASINI TAMAMLA' : 'KODU SEN YAZ'}</span><b>{displayedPass ? '✓ TAMAMLANDI' : isFragmentExercise ? 'EKSİK PARÇA' : 'EDITOR CHALLENGE'}</b></div>
      <h2>{challenge.prompt}</h2>
      <p>{challenge.editableStarter
        ? 'Sağdaki Java iskeletindeki TODO satırlarını gerçek kodla değiştir. Gereksinimler ve Java sözdizimi kontrol edilir; kod derlenip çalıştırılmaz.'
        : isFragmentExercise
          ? 'Soldaki TODO boşluğuna gelecek yalnızca eksik ifadeyi yaz. Kod çalıştırılmaz; ifade yazılışına göre kontrol edilir.'
          : 'Eksik kodu kendin yaz. Kontrol, önemli söz dizimi ve kavramları arar; kod derlenip çalıştırılmaz.'}</p>
      <div className="code-workout-grid">
        <div>{challenge.editableStarter
          ? <><small>GÖREV VE BEKLENEN DAVRANIŞ</small><div className="code-workout-guide"><strong>HEDEF</strong><p>{challenge.expectedBehavior}</p><strong>DÜŞÜN</strong><p>{challenge.reviewQuestion}</p></div></>
          : <><small>STARTER</small><pre><code>{challenge.starter}</code></pre></>}
        </div>
        <div><small>{isFragmentExercise ? 'EKSİK İFADE' : 'SENİN KODUN'}</small>
          <Suspense fallback={<div className="code-editor-shell code-editor-loading" role="status">Java editörü yükleniyor…</div>}>
            <JavaCodeEditor key={lesson.id} value={answer} onChange={updateAnswer} onVerify={() => void verify()} onEscape={leaveEditor} onLimitReached={() => setLimitReached(true)} label={`${lesson.title} kod editörü`} helpId={editorHelpId} fragment={isFragmentExercise} />
          </Suspense>
          <div className="code-editor-count" aria-label="Kod uzunluğu">{answer.length.toLocaleString('tr-TR')} / {MAX_CODE_DRAFT_LENGTH.toLocaleString('tr-TR')} karakter</div>
          {limitReached && <p className="code-editor-limit-alert" role="status">20.000 karakter sınırı nedeniyle ekleme engellendi. Yer açmak için kodu kısalt.</p>}
          <p className="code-scroll-help" id={editorHelpId}>Taslak otomatik kaydedilir, JSON yedeğine dahil edilir · Tab: 2 boşluk (seçili satırları girintiler) · Ctrl/Cmd+Z: geri al · Shift+Tab: önceki alan · Esc: editörden çık · Ctrl/Cmd+Enter: kontrol.</p>
        </div>
      </div>
      <div className="code-requirements">
        {checks.map((item) => <span key={item.label} className={checked ? (item.ok ? 'ok' : 'missing') : ''}>{checked ? (item.ok ? '✓' : '×') : '·'} {item.label}</span>)}
        {syntaxRequired && <span className={checked && syntaxResult && !syntaxResult.checking && !syntaxResult.unavailable ? (syntaxResult.ok ? 'ok' : 'missing') : ''}>{checked && syntaxResult ? (syntaxResult.checking ? '…' : syntaxResult.unavailable ? '?' : syntaxResult.ok ? '✓' : '×') : '·'} Java sözdizimi</span>}
      </div>
      {checked && <div className={`code-workout-feedback ${success ? 'good' : 'bad'}`} role="status" aria-live="polite" aria-atomic="true"><strong>{feedbackTitle}</strong><span>{feedbackText}</span></div>}
      {challenge.hint && <details className="code-workout-hint"><summary>İpucu göster</summary><p>{challenge.hint}</p></details>}
      <div className="code-workout-actions" ref={actionsRef} role="group" aria-label="Kod çalışması eylemleri" tabIndex={-1}>
        <button className="complete-button" onClick={verify} disabled={!answer.trim() || syntaxResult?.checking}>{syntaxResult?.checking ? 'Kontrol ediliyor…' : 'Kodu kontrol et'}</button>
        {challenge.editableStarter && <button className="reveal" onClick={() => { updateAnswer(challenge.starter); setRevealed(false) }}>Baştan başla</button>}
        <button className="reveal" onClick={() => setRevealed((value) => !value)}>{revealed ? 'Çözümü gizle' : 'Örnek çözümü göster'}</button>
      </div>
      {revealed && <p className="code-scroll-help code-solution-help">Örnek çözümde uzun satırları yana kaydır.</p>}
      <AnimatePresence>{revealed && <motion.pre className="code-solution" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><code>{challenge.completedExample ?? challenge.solution}</code></motion.pre>}</AnimatePresence>
    </section>
  )
}
