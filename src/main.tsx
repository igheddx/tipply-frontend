import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import App from './App.tsx'
import { antdTheme, antdDarkTheme } from './theme/antdTheme'
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import { FeedbackProvider } from './components/ui/Feedback'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { reloadOnceForNewVersion } from './utils/chunkReload'
import 'antd/dist/reset.css'
import './index.css'

const hostname = window.location.hostname.toLowerCase()

if (hostname.includes('apptest.tipwave.live')) {
  document.title = 'Test-Tipwave'
} else if (hostname.includes('app.tipwave.live')) {
  document.title = 'App-Tipwave'
}

// Vite reports a failed lazy-load (a new version was published while this page was open): reload once to get the new files
window.addEventListener('vite:preloadError', event => {
  if (reloadOnceForNewVersion()) event.preventDefault()
})

// Ant Design components follow the dark theme only while a portal, admin or monitor screen is showing
function ThemedApp() {
  const { resolved, inPortal } = useTheme()
  return (
    <ConfigProvider theme={inPortal && resolved === 'dark' ? antdDarkTheme : antdTheme}>
      <FeedbackProvider>
        <BrowserRouter>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </BrowserRouter>
      </FeedbackProvider>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </React.StrictMode>,
) 