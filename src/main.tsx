import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import App from './App.tsx'
import { antdTheme } from './theme/antdTheme'
import 'antd/dist/reset.css'
import './index.css'

const hostname = window.location.hostname.toLowerCase()

if (hostname.includes('apptest.tipwave.live')) {
  document.title = 'Test-Tipwave'
} else if (hostname.includes('app.tipwave.live')) {
  document.title = 'App-Tipwave'
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={antdTheme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
) 