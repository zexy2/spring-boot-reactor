import React from 'react'
import ReactDOM from 'react-dom/client'
import { MotionConfig } from 'motion/react'
import App from './App'
import AppErrorBoundary from './components/AppErrorBoundary'
import './styles.css'

function E2ECrashProbe({ children }) {
  if (
    import.meta.env.VITE_E2E_TEST_HOOKS === 'true'
    && new URLSearchParams(window.location.search).get('__e2e_crash') === '1'
  ) {
    throw new Error('Intentional E2E render crash')
  }

  return children
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <MotionConfig reducedMotion="user">
        <E2ECrashProbe>
          <App />
        </E2ECrashProbe>
      </MotionConfig>
    </AppErrorBoundary>
  </React.StrictMode>,
)
