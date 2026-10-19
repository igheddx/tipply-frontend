/**
 * Device ID Generation Utility
 * 
 * Uses IndexedDB to store a persistent random UUID that survives cache clears
 * and browser restarts, ensuring the same device always gets the same ID.
 */

/**
 * Detect the platform (iOS, Android, or Desktop)
 */
export const detectPlatform = (): string => {
  const userAgent = navigator.userAgent || ''
  
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'iOS'
  }
  if (/Android/i.test(userAgent)) {
    return 'Android'
  }
  return 'Desktop'
}

const STORAGE_KEY = 'unique_device_id'

/**
 * Generate a random UUID v4
 */
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * How long to wait for IndexedDB before giving up. Some mobile browsers (notably Safari on iOS and in-app
 * browsers) can leave indexedDB.open() pending forever, so nothing may depend on it answering.
 */
const INDEXEDDB_TIMEOUT_MS = 1500

/**
 * Read the device ID from IndexedDB. Resolves null if it is missing, fails, is blocked or takes too long.
 */
const initIndexedDB = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.warn('IndexedDB read timed out')
      resolve(null)
    }, INDEXEDDB_TIMEOUT_MS)
    const done = (value: string | null) => {
      clearTimeout(timer)
      resolve(value)
    }

    try {
      const request = indexedDB.open('TipplyDB', 1)
      
      request.onerror = () => {
        console.warn('IndexedDB open failed')
        done(null)
      }

      request.onblocked = () => {
        console.warn('IndexedDB open blocked')
        done(null)
      }
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' })
        }
      }
      
      request.onsuccess = (event: any) => {
        try {
          const db = event.target.result
          const transaction = db.transaction(['config'], 'readonly')
          const store = transaction.objectStore('config')
          const query = store.get('deviceId')
          
          query.onsuccess = () => {
            done(query.result?.value || null)
          }
          
          query.onerror = () => {
            done(null)
          }
        } catch (e) {
          console.warn('IndexedDB read failed:', e)
          done(null)
        }
      }
    } catch (e) {
      console.warn('IndexedDB not available:', e)
      done(null)
    }
  })
}

/**
 * Store device ID in IndexedDB. Best effort: resolves without throwing, and gives up if the browser does not answer.
 */
const storeDeviceIdInIndexedDB = async (deviceId: string): Promise<void> => {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, INDEXEDDB_TIMEOUT_MS * 2)
    const done = () => {
      clearTimeout(timer)
      resolve()
    }

    try {
      const request = indexedDB.open('TipplyDB', 1)

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' })
        }
      }
      
      request.onsuccess = (event: any) => {
        try {
          const db = event.target.result
          const transaction = db.transaction(['config'], 'readwrite')
          const store = transaction.objectStore('config')
          store.put({ key: 'deviceId', value: deviceId })
          
          transaction.oncomplete = () => {
            console.log('✅ Device ID stored in IndexedDB:', deviceId)
            done()
          }
          
          transaction.onerror = () => {
            done()
          }
        } catch (e) {
          console.warn('Failed to write device ID to IndexedDB:', e)
          done()
        }
      }
      
      request.onerror = () => {
        done()
      }

      request.onblocked = () => {
        done()
      }
    } catch (e) {
      console.warn('Failed to store device ID in IndexedDB:', e)
      done()
    }
  })
}

/**
 * The ID this page is using. Once set it never changes while the page is open, so every request made from the
 * page (setup intent, store payment info, tips) carries the same ID.
 */
let resolvedDeviceId: string | null = null

const readStoredDeviceId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const saveDeviceId = (deviceId: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, deviceId)
  } catch (e) {
    console.warn('Failed to store device ID:', e)
  }
  storeDeviceIdInIndexedDB(deviceId).catch(e => console.warn('IndexedDB store failed:', e))
}

/**
 * Get the unique device ID, generating one if this device has none yet.
 * Synchronous and stable: after the first call it always returns the same value for the life of the page.
 */
export const getUniqueDeviceId = (): string => {
  if (resolvedDeviceId) {
    // Keep localStorage in line if something cleared it mid-session
    if (!readStoredDeviceId()) saveDeviceId(resolvedDeviceId)
    return resolvedDeviceId
  }

  const stored = readStoredDeviceId()
  if (stored) {
    resolvedDeviceId = stored
    return stored
  }

  const generated = generateUUID()
  console.log('🔐 Generated new device ID:', generated)
  resolvedDeviceId = generated
  saveDeviceId(generated)
  return generated
}

/**
 * Read the device ID saved in IndexedDB, if any. This only reads: it never changes the ID in use.
 */
export const restoreDeviceIdFromIndexedDB = async (): Promise<string | null> => {
  try {
    const storedId = await initIndexedDB()
    if (storedId) console.log('🔐 Found device ID in IndexedDB:', storedId)
    return storedId
  } catch (e) {
    console.warn('Failed to read device ID from IndexedDB:', e)
    return null
  }
}

let initPromise: Promise<string> | null = null

/**
 * Decide this page's device ID once, at start-up, and return it.
 *
 *  - localStorage has an ID: use it immediately (the normal case, no waiting).
 *  - localStorage is empty (first visit, or site data was cleared): ask IndexedDB for the ID it kept, waiting at
 *    most INDEXEDDB_TIMEOUT_MS. If it has none, or does not answer in time, generate a new one.
 *
 * The decision is final. An IndexedDB answer that arrives after the page has already chosen an ID is ignored, so
 * the ID can never change between creating a setup intent and saving the card.
 */
export const initDeviceId = (): Promise<string> => {
  if (!initPromise) {
    initPromise = (async () => {
      if (resolvedDeviceId) return resolvedDeviceId

      const stored = readStoredDeviceId()
      if (stored) {
        resolvedDeviceId = stored
        // Keep IndexedDB in line with the ID we use, in the background, so it can restore it after a cache clear
        storeDeviceIdInIndexedDB(stored).catch(e => console.warn('IndexedDB store failed:', e))
        return stored
      }

      const restored = await restoreDeviceIdFromIndexedDB()
      // Something else (getUniqueDeviceId) may have claimed an ID while we were waiting: that one wins
      if (resolvedDeviceId) return resolvedDeviceId
      if (restored) {
        resolvedDeviceId = restored
        saveDeviceId(restored)
        return restored
      }
      return getUniqueDeviceId()
    })()
  }
  return initPromise
}
