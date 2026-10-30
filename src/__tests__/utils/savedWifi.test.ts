import { webcrypto } from 'node:crypto'
import { createWifiVault } from '../../utils/savedWifi'

// jsdom has no WebCrypto of its own
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })

const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    raw: () => data.get('tipwave.wifi.saved.v1') ?? ''
  }
}
const newKey = () => webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']) as Promise<CryptoKey>

describe('saved Wi-Fi networks', () => {
  it('saves a network and reads it back', async () => {
    const key = await newKey()
    const vault = createWifiVault({ getKey: async () => key, storage: memoryStorage() })
    expect(await vault.save('Flying J', 'piano-bar-1')).toBe(true)
    expect(await vault.list()).toEqual([{ ssid: 'Flying J', password: 'piano-bar-1', lastUsed: expect.any(Number) }])
  })

  it('never stores the password as readable text', async () => {
    const key = await newKey()
    const storage = memoryStorage()
    const vault = createWifiVault({ getKey: async () => key, storage })
    await vault.save('Flying J', 'piano-bar-1')
    expect(storage.raw()).toContain('Flying J')
    expect(storage.raw()).not.toContain('piano-bar-1')
  })

  it('lists the most recently used first and replaces a password for the same name', async () => {
    const key = await newKey()
    let t = 1000
    const vault = createWifiVault({ getKey: async () => key, storage: memoryStorage(), now: () => t++ })
    await vault.save('Home', 'one')
    await vault.save('Flying J', 'two')
    await vault.save('Home', 'three')
    const list = await vault.list()
    expect(list.map((n) => n.ssid)).toEqual(['Home', 'Flying J'])
    expect(list[0].password).toBe('three')
  })

  it('forgets a network', async () => {
    const key = await newKey()
    const vault = createWifiVault({ getKey: async () => key, storage: memoryStorage() })
    await vault.save('Home', 'one')
    await vault.save('Flying J', 'two')
    vault.forget('Home')
    expect((await vault.list()).map((n) => n.ssid)).toEqual(['Flying J'])
  })

  it('skips entries written with a different key instead of failing', async () => {
    const storage = memoryStorage()
    await createWifiVault({ getKey: newKey, storage }).save('Old key', 'x')
    const vault = createWifiVault({ getKey: newKey, storage })
    expect(await vault.list()).toEqual([])
  })

  it('reports false instead of throwing when the key is unavailable', async () => {
    const vault = createWifiVault({ getKey: async () => { throw new Error('no indexeddb') }, storage: memoryStorage() })
    expect(await vault.save('Home', 'one')).toBe(false)
    expect(await vault.list()).toEqual([])
  })
})
