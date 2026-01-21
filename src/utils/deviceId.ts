/**
 * Device ID Generation Utility
 * 
 * Generates a deterministic, reproducible unique device ID based on device characteristics.
 * The same device will generate the same ID consistently.
 */

import CryptoJS from 'crypto-js'

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
 * Get device fingerprint characteristics
 */
const getDeviceFingerprint = (): string => {
  const components = {
    // Screen characteristics
    screenResolution: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    screenDimensions: `${screen.availWidth}x${screen.availHeight}`,
    
    // Browser characteristics
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    
    // Platform characteristics
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency?.toString() || 'unknown',
    deviceMemory: (navigator as any).deviceMemory?.toString() || 'unknown',
    
    // Canvas fingerprint (web-specific)
    canvasFingerprint: getCanvasFingerprint(),
  }
  
  return JSON.stringify(components)
}

/**
 * Generate a canvas fingerprint to distinguish browsers
 */
const getCanvasFingerprint = (): string => {
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return 'canvas_failed'
    
    ctx.textBaseline = 'top'
    ctx.font = '14px Arial'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#f60'
    ctx.fillRect(125, 1, 62, 20)
    ctx.fillStyle = '#069'
    ctx.fillText('Browser Fingerprint 🔐', 2, 15)
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
    ctx.fillText('Browser Fingerprint 🔐', 4, 17)
    
    return canvas.toDataURL()
  } catch {
    return 'canvas_error'
  }
}

/**
 * Generate a SHA-256 hash of the device fingerprint
 * Returns a deterministic unique ID for this device
 */
const generateHash = (data: string): string => {
  return CryptoJS.SHA256(data).toString()
}

/**
 * Get or generate the unique device ID
 * Uses localStorage to cache the generated ID for consistency
 */
export const getUniqueDeviceId = (): string => {
  const STORAGE_KEY = 'unique_device_id'
  
  // Check if we already have a stored device ID
  let deviceId = localStorage.getItem(STORAGE_KEY)
  
  if (!deviceId) {
    // Generate new device ID from fingerprint
    const fingerprint = getDeviceFingerprint()
    deviceId = generateHash(fingerprint)
    
    console.log('🔐 Generated new device ID:', deviceId)
    
    // Store it for future use
    try {
      localStorage.setItem(STORAGE_KEY, deviceId)
    } catch (e) {
      console.warn('Failed to store device ID in localStorage:', e)
    }
  } else {
    console.log('🔐 Retrieved cached device ID:', deviceId)
  }
  
  return deviceId
}

/**
 * Regenerate the device ID (useful for recovery after cache clear)
 * Will return the same ID if called on the same device
 */
export const regenerateUniqueDeviceId = (): string => {
  const fingerprint = getDeviceFingerprint()
  const deviceId = generateHash(fingerprint)
  
  console.log('🔄 Regenerated device ID:', deviceId)
  
  // Store it for future use
  try {
    localStorage.setItem('unique_device_id', deviceId)
  } catch (e) {
    console.warn('Failed to store device ID in localStorage:', e)
  }
  
  return deviceId
}
