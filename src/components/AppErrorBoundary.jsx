import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Java Backend Öğrenme Atölyesi render error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="app-fatal" role="alert" aria-labelledby="app-fatal-title">
        <div className="app-fatal-panel">
          <span className="section-label">UYGULAMA HATASI</span>
          <h1 id="app-fatal-title">Bu ekran yüklenemedi.</h1>
          <p>
            Beklenmeyen bir arayüz hatası oluştu. Daha önce kaydedilmiş ilerlemen tarayıcıda kalır.
          </p>
          <div className="app-fatal-actions">
            <button type="button" onClick={() => window.location.reload()}>
              Sayfayı yeniden yükle
            </button>
            <button type="button" className="secondary" onClick={() => window.location.assign(import.meta.env.BASE_URL)}>
              Ana ekrana dön
            </button>
          </div>
        </div>
      </main>
    )
  }
}
