import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import App from './App.tsx'
import { antdTheme, antdDarkTheme } from './theme/antdTheme'
import { ThemeProvider, useTheme } from './theme/ThemeContext'
import { FeedbackProvider } from './components/ui/Feedback'
import 'antd/dist/reset.css'
import './index.css'

const hostname = window.location.hostname.toLowerCase()

if (hostname.includes('apptest.tipwave.live')) {
  document.title = 'Test-Tipwave'
} else if (hostname.includes('app.tipwave.live')) {
  document.title = 'App-Tipwave'
}

// Ant Design components follow the dark theme only while a portal, admin or monitor screen is showing
function ThemedApp() {
  const { resolved, inPortal } = useTheme()
  return (
    <ConfigProvider theme={inPortal && resolved === 'dark' ? antdDarkTheme : antdTheme}>
      <FeedbackProvider>
        <BrowserRouter>
          <App />
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