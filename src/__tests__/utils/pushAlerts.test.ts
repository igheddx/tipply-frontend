import { vi, describe, it, expect, afterEach } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/services/api', () => ({ apiService: api, default: api }))

import { getPushSupport, isIosDevice, urlBase64ToUint8Array, enablePushAlerts } from '@/utils/pushAlerts'

const setNavigator = (props: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(props)) Object.defineProperty(navigator, key, { value, configurable: true })
}

const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Tablet) AppleWebKit/537.36 Chrome/124 Safari/537.36'

describe('push alert support', () => {
  afterEach(() => {
    delete (navigator as any).standalone
    delete (navigator as any).serviceWorker
    delete (window as any).PushManager
    delete (window as any).Notification
    api.get.mockReset()
    api.post.mockReset()
  })

  it('asks iPad users to add the site to the Home Screen first', () => {
    setNavigator({ userAgent: IPAD, standalone: false })
    expect(isIosDevice()).toBe(true)
    expect(getPushSupport()).toBe('needs-install')
  })

  it('is ready on an installed iPad web app', () => {
    setNavigator({ userAgent: IPAD, standalone: true, serviceWorker: {} })
    ;(window as any).PushManager = function () {}
    ;(window as any).Notification = function () {}
    expect(getPushSupport()).toBe('ready')
  })

  it('is ready on Android Chrome without installing', () => {
    setNavigator({ userAgent: ANDROID, serviceWorker: {} })
    ;(window as any).PushManager = function () {}
    ;(window as any).Notification = function () {}
    expect(getPushSupport()).toBe('ready')
  })

  it('is unsupported where the browser has no push', () => {
    setNavigator({ userAgent: ANDROID })
    expect(getPushSupport()).toBe('unsupported')
  })

  it('turns a URL-safe base64 key into bytes', () => {
    // 'AQID' is bytes 1,2,3; '-' and '_' are the URL-safe forms of '+' and '/'
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3])
    expect(Array.from(urlBase64ToUint8Array('-_8'))).toEqual([251, 255])
  })

  it('does nothing and asks for nothing when the server has no keys', async () => {
    setNavigator({ userAgent: ANDROID, serviceWorker: {} })
    ;(window as any).PushManager = function () {}
    const requestPermission = vi.fn()
    ;(window as any).Notification = { requestPermission }
    api.get.mockResolvedValue({ data: { enabled: false } })

    expect(await enablePushAlerts()).toBe('unavailable')
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('reports denied when the user refuses permission', async () => {
    setNavigator({ userAgent: ANDROID, serviceWorker: {} })
    ;(window as any).PushManager = function () {}
    ;(window as any).Notification = { requestPermission: vi.fn().mockResolvedValue('denied') }
    api.get.mockResolvedValue({ data: { enabled: true, publicKey: 'AQID' } })

    expect(await enablePushAlerts()).toBe('denied')
    expect(api.post).not.toHaveBeenCalled()
  })

  it('subscribes and saves the subscription on the server', async () => {
    const subscription = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'k', auth: 'a' } }) }
    const pushManager = { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn().mockResolvedValue(subscription) }
    setNavigator({
      userAgent: ANDROID,
      serviceWorker: { register: vi.fn().mockResolvedValue({}), ready: Promise.resolve({ pushManager }) }
    })
    ;(window as any).PushManager = function () {}
    ;(window as any).Notification = { requestPermission: vi.fn().mockResolvedValue('granted') }
    api.get.mockResolvedValue({ data: { enabled: true, publicKey: 'AQID' } })
    api.post.mockResolvedValue({ data: null })

    expect(await enablePushAlerts()).toBe('on')
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(api.post).toHaveBeenCalledWith('/api/push/subscriptions', { endpoint: 'https://fcm.googleapis.com/x', p256dh: 'k', auth: 'a' })
  })
})
