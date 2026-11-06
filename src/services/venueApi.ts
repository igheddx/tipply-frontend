import { apiService } from './api'

export interface PerformerCard {
  id: string
  displayName: string
  stageName?: string | null
  photoUrl?: string | null
}

export interface VenueSummary {
  id: string
  name: string
  logoUrl?: string | null
  status: string
  city?: string | null
  state?: string | null
  timeZoneId?: string | null
}

export type SessionState = 'requested' | 'upcoming' | 'active' | 'grace' | 'ended' | 'denied' | 'cancelled'

export interface VenueSession {
  id: string
  deviceId: string
  deviceName: string
  venueId: string
  venueName: string
  performer: PerformerCard
  status: string
  state: SessionState
  startsAt: string
  endsAt: string
  graceEndsAt: string
  endedAt?: string | null
  endReason?: string | null
  requestedBy: string
  authorisedBy?: string | null
  tipCount: number
  allowSongRequests: boolean
  createdAt: string
  distanceMeters?: number | null
  accuracyMeters?: number | null
  locationDoubtful?: boolean
}

export interface VenueLink {
  id: string
  status: 'invited' | 'active' | 'deactivated' | 'declined' | 'left' | 'cancelled'
  trustLevel: 'self' | 'approval'
  performer?: PerformerCard | null
  inviteEmail?: string | null
  invitedAt: string
  respondedAt?: string | null
  sessionCount: number
  lastSessionAt?: string | null
}

export interface VenueDevice {
  deviceId: string
  name: string
  serialNumber?: string | null
  isPaused: boolean
  isSoundEnabled: boolean
  soundId: number
  soundVolume: string
  isRandomLightEffect: boolean
  current?: VenueSession | null
  pendingRequests: number
  upcomingSessions: number
}

export interface PerformerDevice {
  deviceId: string
  name: string
  availability: 'available' | 'in_use' | 'in_use_by_you' | 'requested_by_you' | 'booked_by_you'
  busyUntil?: string | null
  mine?: VenueSession | null
}

export interface PerformerVenue {
  venue: VenueSummary
  linkId: string
  trustLevel: 'self' | 'approval'
  devices: PerformerDevice[]
}

export interface VenueInvite {
  linkId: string
  venue: VenueSummary
  invitedAt: string
}

export interface VenueProfile {
  id: string
  businessName?: string | null
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  latitude?: number | null
  longitude?: number | null
  hasLocation: boolean
  timeZoneId?: string | null
  venueType?: string | null
  logoUrl?: string | null
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  statusReason?: string | null
}

export interface AdminVenue {
  id: string
  businessName: string
  contactName: string
  email: string
  phone?: string | null
  address: string
  latitude?: number | null
  longitude?: number | null
  timeZoneId?: string | null
  venueType?: string | null
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  statusReason?: string | null
  statusAt?: string | null
  createdAt: string
  deviceCount: number
  linkedPerformers: number
  sessionCount: number
  addressMatched: boolean
  matchedAddress?: string | null
  devices: { serialNumber?: string | null; nickname?: string | null; addedAt: string }[]
}

export interface AuditEntry {
  id: string
  at: string
  venueName: string
  actorName: string
  action: string
  subjectName?: string | null
  deviceName?: string | null
  detail?: string | null
  ipAddress?: string | null
}

export interface StartSessionResult {
  session?: VenueSession
  needsApproval?: boolean
  notice?: string
}

const enc = encodeURIComponent

/** Every call to the venue feature's API in one place. Each returns the usual { data, error } response. */
export const venueApi = {
  features: () => apiService.get('/api/features'),
  invitePreview: (token: string) => apiService.get(`/api/venue-invites/preview?token=${enc(token)}`),

  // The venue's own portal
  me: () => apiService.get('/api/venues/me'),
  updateMe: (body: Partial<Record<string, unknown>>) => apiService.put('/api/venues/me', body),
  devices: () => apiService.get('/api/venues/me/devices'),
  links: () => apiService.get('/api/venues/me/links'),
  requests: () => apiService.get('/api/venues/me/requests'),
  history: (page = 1, pageSize = 25) => apiService.get(`/api/venues/me/sessions?page=${page}&pageSize=${pageSize}`),
  search: (q: string) => apiService.get(`/api/venues/me/search?q=${enc(q)}`),
  invite: (body: { performerId?: string; email?: string }) => apiService.post('/api/venues/me/invites', body),
  changeLink: (linkId: string, action: 'deactivate' | 'reactivate' | 'cancel') => apiService.post(`/api/venues/me/links/${linkId}/${action}`),
  setTrust: (linkId: string, trustLevel: 'self' | 'approval') => apiService.put(`/api/venues/me/links/${linkId}/trust`, { trustLevel }),
  startForPerformer: (body: { deviceId: string; performerId: string; startsAt?: string; endsAt?: string }) => apiService.post('/api/venues/me/sessions', body),
  approve: (sessionId: string) => apiService.post(`/api/venues/me/sessions/${sessionId}/approve`),
  deny: (sessionId: string) => apiService.post(`/api/venues/me/sessions/${sessionId}/deny`),
  end: (sessionId: string) => apiService.post(`/api/venues/me/sessions/${sessionId}/end`),

  // A performer's side
  invites: () => apiService.get('/api/performer/venue-invites'),
  respond: (linkId: string, action: 'accept' | 'decline') => apiService.post(`/api/performer/venue-invites/${linkId}/${action}`),
  myVenues: () => apiService.get('/api/performer/venues'),
  leave: (linkId: string) => apiService.post(`/api/performer/venues/${linkId}/leave`),
  currentSession: () => apiService.get('/api/performer/sessions/current'),
  startMine: (body: { deviceId: string; startsAt?: string; endsAt?: string; latitude?: number; longitude?: number; accuracyMeters?: number; positionAt?: string; allowSongRequests?: boolean }) =>
    apiService.post('/api/performer/sessions', body),
  endMine: (sessionId: string) => apiService.post(`/api/performer/sessions/${sessionId}/end`),
  extendMine: (sessionId: string) => apiService.post(`/api/performer/sessions/${sessionId}/extend`),

  // Tipwave admin
  adminVenues: (status?: string) => apiService.get(`/api/admin/venues${status ? `?status=${enc(status)}` : ''}`),
  adminDecide: (venueId: string, action: 'approve' | 'reject' | 'suspend' | 'reinstate', reason?: string) =>
    apiService.post(`/api/admin/venues/${venueId}/${action}`, { reason }),
  adminAudit: (page = 1, action?: string, venueId?: string) =>
    apiService.get(`/api/admin/venues/audit?page=${page}&pageSize=50${action ? `&action=${enc(action)}` : ''}${venueId ? `&venueId=${enc(venueId)}` : ''}`),
  adminFeatures: () => apiService.get('/api/admin/features'),
  adminSetVenues: (enabled: boolean) => apiService.put('/api/admin/features/venues', { enabled })
}
