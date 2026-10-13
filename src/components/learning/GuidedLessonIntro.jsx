export default function GuidedLessonIntro({
  lesson,
  index,
  total,
  status,
  learningGoal,
  prerequisites,
  lessonTerms,
  prediction,
  onSelectConcept,
  PredictionCheck,
}) {
  const progress = Math.round(((index + 1) / total) * 100)

  return (
    <>
      <header className="lesson-hero">
        <div className="lesson-hero-kicker">
          <span>AKTİF DERS</span>
          <strong>{progress}% yol tamamlandı</strong>
        </div>
        <div className="lesson-progress-track" aria-label={`Öğrenme yolu yüzde ${progress}`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="lesson-topline">
          <span>DERS {index + 1}/{total}</span><span>{lesson.minutes} dk</span><span>+{lesson.xp} XP</span><span className={`learning-state ${status.key}`}>{status.label}</span>
        </div>
        <h1>{lesson.title}</h1>
        <p className="hook">{lesson.hook}</p>
      </header>

      <section className="learning-goal">
        <div className="section-label"><span>BU DERSİN HEDEFİ</span><b>1 NET ÇIKTI</b></div>
        <p>{learningGoal}</p>
      </section>

      {prerequisites.length > 0 && (
        <section className="prerequisite-section">
          <div className="section-label"><span>ÖN BİLGİ KONTROLÜ</span><b>{prerequisites.length} temel kavram</b></div>
          <p>Bildiklerini geç. Eksik olan kavrama tıklayıp kısa hatırlatmayı aç.</p>
          <div className="prerequisite-list">
            {prerequisites.map((concept) => (
              <button type="button" key={`${lesson.id}-${concept.term}`} onClick={() => onSelectConcept(concept)}>
                <code>{concept.term}</code><span>{concept.meaning}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="analogy guided-story">
        <span className="section-label">ÖNCE PROBLEMİ GÖR</span>
        <p>{lesson.story}</p>
      </div>

      {prediction && <PredictionCheck prediction={prediction} />}

      {lessonTerms.length > 0 && (
        <section className="terms-section guided-terms">
          <div className="section-label"><span>ŞİMDİ KAVRAMLARIN ADINI KOY</span><b>{lessonTerms.length} kavram</b></div>
          <p className="terms-intro">Problemi gördün. Şimdi kullandığımız parçaların teknik isimlerini bağlama oturt.</p>
          <div className="term-grid">
            {lessonTerms.map(([term, meaning]) => (
              <button
                type="button"
                className="term-card"
                key={term}
                onClick={() => onSelectConcept({ term, meaning, lessonId: lesson.id, lessonTitle: lesson.title })}
              >
                <code>{term}</code><p>{meaning}</p><small>detayı aç +</small>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
