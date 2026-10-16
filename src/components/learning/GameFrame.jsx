export default function GameFrame({
  lesson,
  eyebrow,
  title,
  copy,
  className = '',
  children,
  footer,
  experiment,
  challenge = false,
}) {
  const watermark = eyebrow.split(' ')[0]

  return (
    <section
      className={`memory-game advanced-game lab-${lesson.id} lab-phase-${lesson.phase} ${className}`}
      aria-label={`${lesson.title} oyun alanı`}
    >
      <span className="advanced-game-watermark" aria-hidden="true">{watermark}</span>
      <div className="section-label">
        <span>{challenge ? 'GÖREVİ ÇÖZ' : 'KURCALA VE GÖR'}</span>
        <b>{challenge ? 'SONUCU KANITLA' : 'BU DERSE ÖZEL SAHNE'}</b>
      </div>
      <div className="advanced-game-head">
        <small>{eyebrow}</small>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
      {experiment && (
        <div className="experiment-brief" aria-label="Deney hedefi">
          <div><small>01 · DEĞİŞTİR</small><strong>{experiment.change}</strong></div>
          <span aria-hidden="true">→</span>
          <div><small>02 · GÖZLE</small><strong>{experiment.watch}</strong></div>
        </div>
      )}
      {children}
      {footer && <div className="advanced-game-foot">{footer}</div>}
    </section>
  )
}
