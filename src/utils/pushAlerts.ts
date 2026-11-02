import { apiService } from '../services/api'

/**
 * Phone and tablet tip alerts (Web Push).
 * - 'unsupported': this browser cannot receive them
 * - 'needs-install': iPhone/iPad only allow them for a site added to the Home Screen
 * - 'ready': can be turned on
 */
export type PushSupport = 'unsupported' | 'needs-install' | 'ready'

export function isIosDevice(): boolean {
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  // iPadOS reports itself as a Mac, but a Mac has no touch screen
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export function isInstalledApp(): boolean {
  const standalone = (navigator as any).standalone === true
  const displayMode = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
  return standalone || displayMode
}

export function getPushSupport(): PushSupport {
  if (isIosDevice() && !isInstalledApp()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return 'ready'
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  return navigator.serviceWorker.ready
}

/** The subscription this browser already has, if any. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (getPushSupport() !== 'ready') return null
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    return reg ? await reg.pushManager.getSubscription() : null
  } catch {
    return null
  }
}

export interface PushConfig {
  enabled: boolean
  publicKey?: string | null
}

export async function loadPushConfig(): Promise<PushConfig> {
  const response = await apiService.get('/api/push/config')
  return response.data ?? { enabled: false }
}

export type EnableResult = 'on' | 'denied' | 'unavailable' | 'failed'

/** Which step failed, in plain words, so a "could not turn on" message can say why. */
let lastEnableFailure = ''
export const getEnableFailure = () => lastEnableFailure
const fail = (step: string, error: unknown): EnableResult => {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '')
  lastEnableFailure = `${step}${text ? ` (${text.slice(0, 120)})` : ''}`
  return 'failed'
}

/** Asks permission (call it from a tap), subscribes this browser, and tells the server. */
export async function enablePushAlerts(): Promise<EnableResult> {
  if (getPushSupport() !== 'ready') return 'unavailable'
  const config = await loadPushConfig()
  if (!config.enabled || !config.publicKey) return 'unavailable'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  lastEnableFailure = ''
  let reg: ServiceWorkerRegistration
  try {
    reg = await registration()
  } catch (e) {
    return fail('Could not start the background service', e)
  }

  let subscription: PushSubscription
  try {
    subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource }))
  } catch (e) {
    return fail('This browser would not subscribe', e)
  }

  try {
    const json = subscription.toJSON()
    const response = await apiService.post('/api/push/subscriptions', {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth
    })
    return response.error ? fail('Tipwave could not save this device', response.error) : 'on'
  } catch (e) {
    return fail('Tipwave could not save this device', e)
  }
}

export async function disablePushAlerts(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await apiService.post('/api/push/subscriptions/remove', { endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}

/** Sends a test banner to this performer's devices. Returns how many were reached. */
export async function sendTestAlert(): Promise<number> {
  const response = await apiService.post('/api/push/test', {})
  return response.data?.delivered ?? 0
}

/**
 * Turns off alerts on this device when the performer signs out, so the next person to use it
 * (or the same tablet later) gets nothing. Must run before the token is cleared. Never throws and
 * waits at most two seconds, so signing out is never held up.
 */
export async function turnOffAlertsOnSignOut(): Promise<void> {
  if (getPushSupport() !== 'ready') return
  try {
    await Promise.race([disablePushAlerts(), new Promise<void>(resolve => setTimeout(resolve, 2000))])
  } catch {
    /* signing out matters more than this */
  }
}
