/**
 * Logger utility for controlling console output based on environment
 * 
 * To enable logging for troubleshooting, set in browser console:
 * localStorage.setItem('ENABLE_LOGS', 'true')
 * 
 * To disable:
 * localStorage.removeItem('ENABLE_LOGS')
 */

const isProduction = window.location.hostname.includes('app.tipwave.live') || window.location.hostname.includes('tipwave.live')
const isLoggingEnabled = () => {
  // Check localStorage override first
  const override = localStorage.getItem('ENABLE_LOGS')
  if (override === 'true') return true
  if (override === 'false') return false
  
  // Default: enable logs in non-production
  return !isProduction
}

export const logger = {
  log: (...args: any[]) => {
    if (isLoggingEnabled()) {
      console.log(...args)
    }
  },
  
  warn: (...args: any[]) => {
    if (isLoggingEnabled()) {
      console.warn(...args)
    }
  },
  
  error: (...args: any[]) => {
    if (isLoggingEnabled()) {
      console.error(...args)
    }
  },
  
  // Always log errors in production for critical issues
  critical: (...args: any[]) => {
    console.error('[CRITICAL]', ...args)
  },
  
  // Check if logging is currently enabled
  isEnabled: isLoggingEnabled
}

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).__toggleLogs = (enable: boolean) => {
    if (enable) {
      localStorage.setItem('ENABLE_LOGS', 'true')
      console.log('✅ Logging enabled. Reload page to see logs.')
    } else {
      localStorage.setItem('ENABLE_LOGS', 'false')
      console.log('❌ Logging disabled. Reload page.')
    }
  }
  
  if (isProduction && !isLoggingEnabled()) {
    console.log('💡 Logs are hidden. To enable: __toggleLogs(true) then reload page')
  }
}

export default logger
