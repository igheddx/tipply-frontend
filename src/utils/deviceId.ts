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
 * Initialize IndexedDB and store device ID
 */
const initIndexedDB = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('TipplyDB', 1)
      
      request.onerror = () => {
        console.warn('IndexedDB open failed')
        resolve(null)
      }
      
      request.onupgradeneeded = (event: any) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'key' })
        }
      }
      
      request.onsuccess = (event: any) => {
        const db = event.target.result
        const transaction = db.transaction(['config'], 'readonly')
        const store = transaction.objectStore('config')
        const query = store.get('deviceId')
        
        query.onsuccess = () => {
          resolve(query.result?.value || null)
        }
        
        query.onerror = () => {
          resolve(null)
        }
      }
    } catch (e) {
      console.warn('IndexedDB not available:', e)
      resolve(null)
    }
  })
}

/**
 * Store device ID in IndexedDB
 */
const storeDeviceIdInIndexedDB = async (deviceId: string): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('TipplyDB', 1)
      
      request.onsuccess = (event: any) => {
        const db = event.target.result
        const transaction = db.transaction(['config'], 'readwrite')
        const store = transaction.objectStore('config')
        store.put({ key: 'deviceId', value: deviceId })
        
        transaction.oncomplete = () => {
          console.log('✅ Device ID stored in IndexedDB:', deviceId)
          resolve()
        }
        
        transaction.onerror = () => {
          resolve()
        }
      }
      
      request.onerror = () => {
        resolve()
      }
    } catch (e) {
      console.warn('Failed to store device ID in IndexedDB:', e)
      resolve()
    }
  })
}

/**
 * Get or generate the unique device ID
 * Uses IndexedDB for persistent storage that survives cache clears
 */
export const getUniqueDeviceId = (): string => {
  // Try to get from localStorage first (fast synchronous access)
  const STORAGE_KEY = 'unique_device_id'
  let deviceId = localStorage.getItem(STORAGE_KEY)
  
  if (!deviceId) {
    // Generate new random UUID
    deviceId = generateUUID()
    console.log('🔐 Generated new device ID:', deviceId)
    
    // Store in both localStorage and IndexedDB
    try {
      localStorage.setItem(STORAGE_KEY, deviceId)
      storeDeviceIdInIndexedDB(deviceId).catch(e => console.warn('IndexedDB store failed:', e))
    } catch (e) {
      console.warn('Failed to store device ID:', e)
    }
  } else {
    console.log('🔐 Retrieved cached device ID:', deviceId)
  }
  
  return deviceId
}

/**
 * Restore device ID from IndexedDB after cache clear
 * Call this on app initialization to recover the ID
 */
export const restoreDeviceIdFromIndexedDB = async (): Promise<string | null> => {
  try {
    const storedId = await initIndexedDB()
    if (storedId) {
      console.log('🔐 Restored device ID from IndexedDB:', storedId)
      localStorage.setItem('unique_device_id', storedId)
      return storedId
    }
  } catch (e) {
    console.warn('Failed to restore device ID from IndexedDB:', e)
  }
  return null
}
