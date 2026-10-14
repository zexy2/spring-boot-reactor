import { useRef, useState } from 'react'
import {
  createProgressBackup,
  MAX_BACKUP_BYTES,
  parseProgressBackup,
} from '../../learning/progressTransfer'

export default function ProgressBackup({ completed, learning, onRestore, importOnly = false, exportOnly = false }) {
  const fileRef = useRef(null)
  const [mode, setMode] = useState('merge')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const download = () => {
    try {
      const data = JSON.stringify(createProgressBackup(completed, learning), null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `java-backend-ilerleme-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus('Yedek JSON dosyası indirildi.')
    } catch (error) {
      setStatus(`Dışa aktarılamadı: ${error.message}`)
    }
  }

  const upload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Dosya 2 MB sınırını aşıyor.')
      const parsed = parseProgressBackup(await file.text())
      if (mode === 'replace' && !window.confirm('Mevcut ders geçmişi yedekteki kayıtlarla değiştirilecek. Devam edilsin mi?')) {
        setStatus('Değiştirme iptal edildi. Mevcut ilerleme korundu.')
        return
      }
      // The file read is asynchronous: the parent must merge against its latest progress.
      const restored = onRestore(parsed, { replace: mode === 'replace' })
      setStatus(`Yedek ${mode === 'merge' ? 'birleştirildi' : 'geri yüklendi'}. ${restored.completed.length} tamamlanan ders mevcut.`)
    } catch (error) {
      setStatus(`İçe aktarılamadı: ${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="progress-backup">
      <summary>{exportOnly ? 'Bu sekmenin ilerlemesini indir' : importOnly ? 'Geçerli JSON yedeğini yükle' : 'İlerlemeyi yedekle / geri yükle'}</summary>
      <div className="progress-backup-actions">
        {!importOnly && <button type="button" onClick={download} disabled={busy}>JSON indir</button>}
        {!exportOnly && <>
          <label>
            <span>Yükleme modu</span>
            <select value={mode} disabled={busy} onChange={(event) => setMode(event.target.value)}>
              <option value="merge">Birleştir (önerilen)</option>
              <option value="replace">Mevcut kayıtları değiştir</option>
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Okunuyor…' : 'JSON yükle'}</button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={upload} aria-label="İlerleme yedek dosyası" hidden />
        </>}
      </div>
      <small>{exportOnly ? 'Yedek dosyasını sakla, ardından sayfayı yenileyip güncel ilerlemeyle birleştir.' : importOnly ? 'Bozuk kayıt korunuyor. Geçerli yedek yüklenince kayıt yeniden başlar.' : 'İlerleme bu tarayıcıda saklanır. JSON dosyasını güvenli bir yerde tut.'}</small>
      {status && <p className="progress-backup-status" role="status" aria-live="polite">{status}</p>}
    </details>
  )
}
