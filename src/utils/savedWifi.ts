/**
 * Wi-Fi networks a performer has already set a device up on, so they can pick one instead of retyping the password.
 *
 * Passwords are encrypted with an AES-GCM key that the browser holds but cannot export (kept in IndexedDB), and the
 * encrypted list lives in localStorage on this browser only. Nothing is sent to the server. Only networks the device
 * actually joined are saved.
 */

export interface SavedNetwork {
  ssid: string
  password: string
  /** Epoch ms of the last successful setup, used to list the most recent first */
  lastUsed: number
}

interface StoredNetwork {
  ssid: string
  iv: string
  data: string
  lastUsed: number
}

const STORAGE_KEY = 'tipwave.wifi.saved.v1'
const MAX_SAVED = 20

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromB64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

/** Opens (or creates) the non-exportable key in IndexedDB. */
export async function browserKey(): Promise<CryptoKey> {
  const open = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('tipwave-wifi', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('keys')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  const db = await open()
  try {
    const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const req = db.transaction('keys').objectStore('keys').get('wifi')
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    if (existing) return existing
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keys', 'readwrite')
      tx.objectStore('keys').put(key, 'wifi')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return key
  } finally {
    db.close()
  }
}

export interface WifiVaultOptions {
  getKey?: () => Promise<CryptoKey>
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  now?: () => number
}

export function createWifiVault({ getKey = browserKey, storage, now = Date.now }: WifiVaultOptions = {}) {
  const store = () => storage ?? window.localStorage

  const readAll = (): StoredNetwork[] => {
    try {
      const parsed = JSON.parse(store().getItem(STORAGE_KEY) || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  const writeAll = (items: StoredNetwork[]) => store().setItem(STORAGE_KEY, JSON.stringify(items))

  return {
    /** Saved networks, most recently used first. Entries that cannot be decrypted are skipped. */
    async list(): Promise<SavedNetwork[]> {
      const items = readAll()
      if (items.length === 0) return []
      try {
        const key = await getKey()
        const out: SavedNetwork[] = []
        for (const item of items) {
          try {
            const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(item.iv) }, key, fromB64(item.data))
            out.push({ ssid: item.ssid, password: new TextDecoder().decode(plain), lastUsed: item.lastUsed })
          } catch {
            // Written with a different key (site data partly cleared): ignore it
          }
        }
        return out.sort((a, b) => b.lastUsed - a.lastUsed)
      } catch {
        return []
      }
    },

    /** Adds the network, or replaces its password if the name is already saved. Returns false if it could not be stored. */
    async save(ssid: string, password: string): Promise<boolean> {
      try {
        const key = await getKey()
        const iv = crypto.getRandomValues(new Uint8Array(12))
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(password))
        const entry: StoredNetwork = { ssid, iv: toB64(iv), data: toB64(new Uint8Array(cipher)), lastUsed: now() }
        const rest = readAll().filter((n) => n.ssid !== ssid)
        writeAll([entry, ...rest].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, MAX_SAVED))
        return true
      } catch {
        return false
      }
    },

    forget(ssid: string) {
      writeAll(readAll().filter((n) => n.ssid !== ssid))
    }
  }
}

export const wifiVault = createWifiVault()
