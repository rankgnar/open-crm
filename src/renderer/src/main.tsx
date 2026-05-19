import './style.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import SectionStandalone from './SectionStandalone'
import { AppConfigProvider } from './context/AppConfig'
import { RefreshProvider } from './context/RefreshContext'

const savedTheme = localStorage.getItem('theme') || 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)

window.addEventListener('storage', (e) => {
  if (e.key === 'theme' && e.newValue) {
    document.documentElement.setAttribute('data-theme', e.newValue)
  }
})

const standaloneMatch = window.location.hash.match(/^#\/([a-z][a-z0-9_-]{0,40})$/)
const standaloneId = standaloneMatch ? standaloneMatch[1] : null

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppConfigProvider>
      <RefreshProvider>
        {standaloneId ? <SectionStandalone id={standaloneId} /> : <App />}
      </RefreshProvider>
    </AppConfigProvider>
  </React.StrictMode>
)
