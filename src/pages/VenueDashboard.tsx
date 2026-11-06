import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PortalShell, type PortalNavItem } from '../components/portal/PortalShell'
import { PageHeader, PageLoader } from '../components/ui'
import { VenueHome } from '../components/venue/VenueHome'
import { VenuePerformers } from '../components/venue/VenuePerformers'
import { VenueDevices } from '../components/venue/VenueDevices'
import { VenueHistory } from '../components/venue/VenueHistory'
import { VenueProfilePanel } from '../components/venue/VenueProfilePanel'
import { venueApi, type VenueDevice, type VenueLink, type VenueProfile, type VenueSession } from '../services/venueApi'

const TITLES: Record<string, { title: string; subtitle: string }> = {
  home: { title: 'Home', subtitle: 'Who is performing, and what needs you.' },
  performers: { title: 'Performers', subtitle: 'Invite performers and choose who can use your devices.' },
  devices: { title: 'Devices', subtitle: 'Your Tipwave devices, their QR codes and who is on them.' },
  history: { title: 'History', subtitle: 'Every session on your devices.' },
  profile: { title: 'Venue profile', subtitle: 'Your details and location.' }
}

const REFRESH_MS = 20000

/** The venue's portal: a venue owns Tipwave devices and lends them to performers it trusts. */
export default function VenueDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    return t && t in TITLES ? t : 'home'
  })
  const [venue, setVenue] = useState<VenueProfile | null>(null)
  const [devices, setDevices] = useState<VenueDevice[]>([])
  const [links, setLinks] = useState<VenueLink[]>([])
  const [requests, setRequests] = useState<VenueSession[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    const me = await venueApi.me()
    if (me.status === 401) {
      navigate('/login')
      return
    }
    if (me.status === 403) {
      // Signed in, but a performer account
      navigate('/dashboard')
      return
    }
    if (!me.data) {
      setUnavailable(true)
      setLoading(false)
      return
    }
    setVenue(me.data)
    const [d, l, r] = await Promise.all([venueApi.devices(), venueApi.links(), venueApi.requests()])
    if (Array.isArray(d.data)) setDevices(d.data)
    if (Array.isArray(l.data)) setLinks(l.data)
    if (Array.isArray(r.data)) setRequests(r.data)
    setLoading(false)
    setRefreshKey(k => k + 1)
  }, [navigate])

  useEffect(() => {
    void load()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    navigate('/login')
  }

  if (loading) return <PageLoader label="Loading your venue…" />
  if (unavailable || !venue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-center">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Venue accounts are not available yet</h1>
          <p className="mt-2 text-ink-500">Please check back soon, or contact Tipwave.</p>
        </div>
      </div>
    )
  }

  const items: PortalNavItem[] = [
    { id: 'home', label: 'Home', icon: 'home', badge: requests.length || undefined },
    { id: 'performers', label: 'Performers', icon: 'users' },
    { id: 'devices', label: 'Devices', icon: 'device' },
    { id: 'history', label: 'History', icon: 'clock' }
  ]
  const activeLinks = links.filter(l => l.status === 'active').length
  const name = venue.businessName || `${venue.firstName} ${venue.lastName}`

  return (
    <PortalShell
      items={items}
      active={tab}
      onSelect={setTab}
      userName={name}
      userPhotoUrl={venue.logoUrl ?? undefined}
      onOpenProfile={() => setTab('profile')}
      onLogout={logout}
      profileActive={tab === 'profile'}
      accountHint="Venue profile and location"
    >
      <PageHeader title={TITLES[tab].title} subtitle={TITLES[tab].subtitle} />
      {tab === 'home' && <VenueHome venue={venue} devices={devices} requests={requests} linkedCount={activeLinks} onChanged={load} onGo={setTab} />}
      {tab === 'performers' && <VenuePerformers venue={venue} links={links} onChanged={load} />}
      {tab === 'devices' && <VenueDevices venue={venue} devices={devices} links={links} onChanged={load} />}
      {tab === 'history' && <VenueHistory venue={venue} refreshKey={refreshKey} />}
      {tab === 'profile' && <VenueProfilePanel venue={venue} onSaved={load} />}
    </PortalShell>
  )
}
