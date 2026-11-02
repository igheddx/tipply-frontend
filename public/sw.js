/* Tipwave service worker: shows tip alerts sent from the server (Web Push). It does no caching. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = {}
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'New tip'
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/dashboard?tab=monitor'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      // Every push must show a notification (iOS cancels alerts that stay silent). If Tipwave is already on
      // screen it has its own notice and sound, so the banner is shown without a second sound.
      const tag = typeof data.tag === 'string' ? data.tag : 'tipwave-tip'
      const appVisible = windows.some(w => w.visibilityState === 'visible')
      // Tell open pages the alert arrived (the Tip alerts card uses this to confirm a test)
      windows.forEach(w => w.postMessage({ type: 'tipwave-push', tag }))
      return self.registration.showNotification(title, {
        body: typeof data.body === 'string' ? data.body : '',
        icon: '/images/logo/icon-192.png',
        badge: '/images/logo/icon-192.png',
        tag,
        renotify: true,
        silent: appVisible && tag !== 'tipwave-test',
        data: { url }
      })
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/dashboard?tab=monitor', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      for (const w of windows) {
        if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
          return w.focus().then(c => ('navigate' in c ? c.navigate(target).catch(() => c) : c))
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
