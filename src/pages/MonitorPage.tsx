import logger from '../utils/logger'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import SongRequestMonitor from '../components/SongRequestMonitor'
import { PageLoader } from '../components/ui'

interface MonitorDevice {
  id: string
  nickname?: string
  isPaused?: boolean
  isAllowSongRequest?: boolean
}

/**
 * The live song monitor as its own page (/monitor), so it can be bookmarked or added to a tablet's home screen
 * and opened in a side window next to a chart or sheet-music app.
 */
const MonitorPage: React.FC = () => {
  const navigate = useNavigate()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [devices, setDevices] = useState<MonitorDevice[]>([])
  const [pausingDeviceId, setPausingDeviceId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [profile, stats] = await Promise.all([apiService.getProfile(), apiService.getDashboardStats()])
        if (cancelled) return
        setProfileId(profile.data?.id ?? '')
        setDevices((stats.data?.devices ?? []).filter((d: MonitorDevice) => d.isAllowSongRequest))
      } catch (error) {
        logger.error('[MonitorPage] Failed to load:', error)
        if (!cancelled) setProfileId('')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const togglePause = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId)
    if (!device) return
    const newPaused = !device.isPaused
    setPausingDeviceId(deviceId)
    try {
      const response = await apiService.updateDevicePause(deviceId, newPaused)
      if (response.data?.success) {
        setDevices(prev => prev.map(d => (d.id === deviceId ? { ...d, isPaused: newPaused } : d)))
      }
    } catch (error) {
      logger.error('[MonitorPage] Error updating device pause state:', error)
    } finally {
      setPausingDeviceId(null)
    }
  }

  if (profileId === null) return <PageLoader label="Opening live requests…" />

  return (
    <SongRequestMonitor
      profileId={profileId}
      isVisible
      onClose={() => navigate('/dashboard')}
      devices={devices}
      pausingDeviceId={pausingDeviceId}
      onTogglePause={togglePause}
    />
  )
}

export default MonitorPage
