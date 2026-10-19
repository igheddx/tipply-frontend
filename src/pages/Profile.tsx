import logger from "../utils/logger";
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import PhotoUpload from '../components/PhotoUpload'
import { PortalShell, type PortalNavItem } from '../components/portal/PortalShell'
import { Banner, Button, Card, PageLoader, StatusChip, Tabs, ThemeToggle } from '../components/ui'
import { IconTile } from '../components/icons/BrandIcons'
import { photoSrc } from '../utils/photoUrl'

interface ProfileData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  stageName?: string
  bio?: string
  stripeAccountId?: string
  profilePhotoUrl?: string
}

interface PasswordData {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const Field = ({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) => (
  <div>
    <label className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</label>
    {children}
    {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : hint && <p className="mt-1.5 text-sm text-ink-500">{hint}</p>}
  </div>
)

const ReadRow = ({ label, value }: { label: string; value?: string }) => (
  <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:gap-6">
    <dt className="w-40 shrink-0 text-sm text-ink-500">{label}</dt>
    <dd className="min-w-0 break-words font-medium text-ink-900">{value || <span className="font-normal text-ink-400">Not set</span>}</dd>
  </div>
)


const Profile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  // Which section is open for editing; saving always sends the whole form, so untouched fields keep their values
  const [editingSection, setEditingSection] = useState<'public' | 'account' | null>(null)
  const [section, setSection] = useState('public')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [kycStatus, setKycStatus] = useState<string>('unknown')
  
  const [editForm, setEditForm] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    stageName: '',
    bio: ''
  })
  
  const [passwordForm, setPasswordForm] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  const [passwordErrors, setPasswordErrors] = useState<{[key: string]: string}>({})
  const [profileErrors, setProfileErrors] = useState<{[key: string]: string}>({})
  const [showPasswordFields, setShowPasswordFields] = useState({
    current: false,
    new: false,
    confirm: false
  })
  
  const navigate = useNavigate()

  useEffect(() => {
    const initProfile = async () => {
      const profileData = await fetchProfile()
      if (profileData) {
        checkStripeConnectStatus()
      }
      
      // Check if returning from verification
      const params = new URLSearchParams(window.location.search)
      if (params.get('verification') === 'complete') {
        setSuccess('Verification process initiated! Your account will be reviewed by Stripe.')
        // Remove query params from URL
        window.history.replaceState({}, '', '/profile')
        // Refresh status after a short delay
        setTimeout(() => {
          checkStripeConnectStatus()
        }, 2000)
      }
    }
    initProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await apiService.getProfile()
      
      if (response.error) {
        setError('Failed to load profile')
        return null
      }
      
      const profileData = response.data
      setProfile(profileData)
      setEditForm({
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        email: profileData.email || '',
        phone: profileData.phone || '',
        stageName: profileData.stageName || '',
        bio: profileData.bio || ''
      })
      return profileData
    } catch (err) {
      setError('Failed to load profile')
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleEditProfile = (which: 'public' | 'account') => {
    setEditingSection(which)
    setError('')
    setSuccess('')
  }

  const handleCancelEdit = () => {
    setEditingSection(null)
    setEditForm({
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      stageName: profile?.stageName || '',
      bio: profile?.bio || ''
    })
    setProfileErrors({})
  }

  const handleProfileInputChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
    if (profileErrors[field]) {
      setProfileErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateProfileForm = () => {
    const errors: {[key: string]: string} = {}
    
    if (!editForm.firstName.trim()) {
      errors.firstName = 'First name is required'
    }
    
    if (!editForm.lastName.trim()) {
      errors.lastName = 'Last name is required'
    }
    
    if (!editForm.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(editForm.email)) {
      errors.email = 'Email is invalid'
    }
    
    setProfileErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSaveProfile = async () => {
    if (!validateProfileForm()) {
      return
    }
    
    try {
      setSaving(true)
      setError('')
      
      const response = await apiService.updateProfile(editForm)
      
      if (response.error) {
        setError(response.error)
        return
      }
      
      setProfile(editForm)
      setEditingSection(null)
      setSuccess('Profile updated successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = () => {
    setIsChangingPassword(true)
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
    setPasswordErrors({})
    setError('')
    setSuccess('')
  }

  const handleCancelPassword = () => {
    setIsChangingPassword(false)
    setPasswordErrors({})
  }

  const handlePasswordInputChange = (field: string, value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }))
    if (passwordErrors[field]) {
      setPasswordErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handlePasswordFieldBlur = (field: string) => {
    const errors: {[key: string]: string} = { ...passwordErrors }
    
    if (field === 'currentPassword') {
      if (!passwordForm.currentPassword) {
        errors.currentPassword = 'Current password is required'
      } else {
        delete errors.currentPassword
      }
    } else if (field === 'newPassword') {
      if (!passwordForm.newPassword) {
        errors.newPassword = 'New password is required'
      } else if (passwordForm.newPassword.length < 8) {
        errors.newPassword = 'Password must be at least 8 characters'
      } else {
        delete errors.newPassword
      }
    } else if (field === 'confirmPassword') {
      if (!passwordForm.confirmPassword) {
        errors.confirmPassword = 'Please confirm your new password'
      } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      } else {
        delete errors.confirmPassword
      }
    }
    
    setPasswordErrors(errors)
  }

  const validatePasswordForm = () => {
    const errors: {[key: string]: string} = {}
    
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required'
    }
    
    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required'
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters'
    }
    
    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password'
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }
    
    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSavePassword = async () => {
    if (!validatePasswordForm()) {
      return
    }
    
    try {
      setSaving(true)
      setError('')
      
      const response = await apiService.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      )
      
      if (response.error) {
        setError(response.error)
        return
      }
      
      setIsChangingPassword(false)
      setSuccess('Password changed successfully!')
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError('Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  const handleStartVerification = async () => {
    try {
      setLoading(true)
      setError('')
      
      logger.log('🚀 Starting Stripe verification from profile...')
      
      // Call profile-level verification endpoint (no device needed)
      const response = await apiService.post('/api/stripe/profile-verification-link', {})
      
      if (response.error) {
        setError(response.error)
        setLoading(false)
        return
      }
      
      if (response.data?.onboardingUrl) {
        logger.log('✅ Verification URL received, performing full-page navigation...')
        // Use top.location.href to guarantee full-page navigation that escapes SPA context
        // This prevents iOS Safari ITP from blocking hCaptcha due to frame-ancestry restrictions
        // Fallback to window.location.href if top is unavailable (should never happen in normal contexts)
        if (top) {
          top.location.href = response.data.onboardingUrl
        } else {
          window.location.href = response.data.onboardingUrl
        }
        // Never reaches here due to navigation
      } else {
        setError('Failed to create verification link')
        setLoading(false)
      }
    } catch (err) {
      logger.error('Error starting verification:', err)
      setError('Failed to start verification process')
      setLoading(false)
    }
  }

  const handleStartOnboarding = async () => {
    try {
      setLoading(true)
      setError('')

      logger.log('🚀 Starting Stripe onboarding from profile...')

      const response = await apiService.post('/api/stripe/profile-onboarding-link', {})

      if (response.error) {
        setError(response.error)
        setLoading(false)
        return
      }

      if (response.data?.onboardingUrl) {
        logger.log('✅ Onboarding URL received, redirecting...')
        if (top) {
          top.location.href = response.data.onboardingUrl
        } else {
          window.location.href = response.data.onboardingUrl
        }
      } else {
        setError('Failed to create onboarding link')
        setLoading(false)
      }
    } catch (err) {
      logger.error('Error starting onboarding:', err)
      setError('Failed to start onboarding process')
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    navigate('/login')
  }

  const checkStripeConnectStatus = async () => {
    logger.log('🔍 [Profile] checkStripeConnectStatus called')
    try {
      // Check the Stripe status endpoint for actual verification status
      // Don't just check if stripeAccountId exists - account must be enabled
      logger.log('🔍 [Profile] Getting profile Stripe status...')
      try {
        const statusResponse = await apiService.get('/api/stripe/profile-stripe-status')
        logger.log('Status response received:', statusResponse)
        
        if (statusResponse && statusResponse.data) {
          const status = statusResponse.data
          
          // Check verification status
          const verificationStatus = status.VerificationStatus || status.verificationStatus || 'unknown'
          
          // Check if account is enabled and has charges/payouts enabled for KYC verification
          // This is the ONLY way to determine if KYC is verified
          const isKycVerified = status.IsEnabled && status.ChargesEnabled && status.PayoutsEnabled
          
          logger.log('Stripe Connect Status Check:', {
            IsEnabled: status.IsEnabled,
            ChargesEnabled: status.ChargesEnabled,
            PayoutsEnabled: status.PayoutsEnabled,
            VerificationStatus: verificationStatus,
            Status: status.Status,
            isKycVerified: isKycVerified,
            AccountId: status.StripeAccountId,
            FullStatus: status
          })
          
          if (isKycVerified || verificationStatus.toLowerCase() === 'verified') {
            setKycStatus('verified')
          } else if (
            verificationStatus.toLowerCase() === 'pending' ||
            verificationStatus.toLowerCase() === 'pending_verification' ||
            verificationStatus.toLowerCase() === 'incomplete' ||
            verificationStatus.toLowerCase() === 'requires_verification' ||
            status.Status === 'pending' ||
            status.Status === 'pending_verification' ||
            status.Status === 'incomplete'
          ) {
            setKycStatus('pending')
          } else if (status.Status === 'not_connected') {
            setKycStatus('not_verified')
          } else {
            setKycStatus('not_verified')
          }
        } else {
          // No status data returned
          logger.log('No status data returned from profile-stripe-status')
          setKycStatus('not_verified')
        }
      } catch (error) {
        logger.error('Error checking profile Stripe status:', error)
        setKycStatus('not_verified')
      }
    } catch (error) {
      logger.error('Error checking Stripe Connect status:', error)
    }
  }

  if (loading) {
    return (
      <PageLoader label="Loading your profile…" />
    )
  }

  const navItems: PortalNavItem[] = [
    { id: 'overview', label: 'Home', icon: 'home' },
    { id: 'devices', label: 'Devices', icon: 'device' },
    { id: 'tips', label: 'Tips', icon: 'coin' },
    { id: 'songs', label: 'Songs', icon: 'music' }
  ]
  const goTo = (id: string) => navigate(id === 'overview' ? '/dashboard' : `/dashboard?tab=${id}`)
  const displayName = profile?.stageName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'Performer'

  const inputClass = (hasError?: boolean) =>
    `h-12 w-full rounded-xl border bg-white px-4 text-ink-900 placeholder:text-ink-400 transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 ${hasError ? 'border-red-400' : 'border-slate-300'}`

  const editActions = (
    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={handleCancelEdit} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={handleSaveProfile} loading={saving}>
        Save changes
      </Button>
    </div>
  )

  const payoutChip =
    kycStatus === 'verified' ? (
      <StatusChip kind="paid" label="Payouts ready" />
    ) : kycStatus === 'pending' ? (
      <StatusChip kind="processing" label="Payouts in progress" />
    ) : (
      <StatusChip kind="failed" label="Payouts not set up" />
    )

  const previewName = (editingSection === 'public' ? editForm.stageName : profile?.stageName) || displayName
  const previewBio = editingSection === 'public' ? editForm.bio : profile?.bio

  const passwordInput = (id: 'current' | 'new' | 'confirm', label: string, field: keyof PasswordData, errorKey: string) => (
    <Field label={label} error={passwordErrors[errorKey]}>
      <div className="relative">
        <input
          type={showPasswordFields[id] ? 'text' : 'password'}
          value={passwordForm[field]}
          onChange={e => handlePasswordInputChange(field, e.target.value)}
          onBlur={() => handlePasswordFieldBlur(field)}
          autoComplete={id === 'current' ? 'current-password' : 'new-password'}
          className={`${inputClass(!!passwordErrors[errorKey])} pr-16`}
        />
        <button
          type="button"
          onClick={() => setShowPasswordFields(prev => ({ ...prev, [id]: !prev[id] }))}
          className="absolute inset-y-0 right-1 flex w-14 items-center justify-center text-sm font-semibold text-brand-700"
          aria-label={showPasswordFields[id] ? 'Hide password' : 'Show password'}
        >
          {showPasswordFields[id] ? 'Hide' : 'Show'}
        </button>
      </div>
    </Field>
  )

  return (
    <PortalShell
      items={navItems}
      active="overview"
      profileActive
      onSelect={goTo}
      userName={displayName}
      userPhotoUrl={profile?.profilePhotoUrl || undefined}
      onOpenProfile={() => undefined}
      onLogout={handleLogout}
    >
      {/* Who you are, and whether payouts work, at a glance */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        {profile?.profilePhotoUrl ? (
          <img src={photoSrc(profile.profilePhotoUrl)} alt="" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-2xl font-bold text-brand-700">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-ink-900">{displayName}</h1>
          <p className="truncate text-sm text-ink-500">{profile?.email}</p>
        </div>
        <button onClick={() => setSection('payouts')} className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label="Go to payouts">
          {payoutChip}
        </button>
      </div>

      {error && (
        <Banner tone="error" title="Something went wrong" className="mb-5" onDismiss={() => setError('')}>
          {error}
        </Banner>
      )}
      {success && <Banner tone="success" title={success} className="mb-5" onDismiss={() => setSuccess('')} />}

      <Tabs
        className="mb-5"
        active={section}
        onChange={id => {
          setSection(id)
          if (editingSection) handleCancelEdit()
        }}
        items={[
          { id: 'public', label: 'Public' },
          { id: 'account', label: 'Account' },
          { id: 'payouts', label: 'Payouts' },
          { id: 'security', label: 'Security' }
        ]}
      />

      {/* Public profile: what fans see */}
      {section === 'public' && (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <Card title="Photo" subtitle="Shown at the top of your tipping page. JPEG or PNG, up to 2 MB.">
              <PhotoUpload
                photoUrl={profile?.profilePhotoUrl}
                onPhotoChange={url => {
                  if (profile) setProfile({ ...profile, profilePhotoUrl: url })
                }}
                variant="profile"
              />
            </Card>

            <Card
              title="Stage name and bio"
              actions={
                editingSection !== 'public' && (
                  <Button variant="secondary" size="sm" onClick={() => handleEditProfile('public')}>
                    Edit
                  </Button>
                )
              }
            >
              {editingSection === 'public' ? (
                <div className="space-y-5">
                  <Field label="Stage name" hint="The name your audience sees.">
                    <input className={inputClass()} value={editForm.stageName} onChange={e => handleProfileInputChange('stageName', e.target.value)} placeholder="Your stage name" />
                  </Field>
                  <Field label="Bio" hint="A short line about you. It appears on your tipping page.">
                    <textarea
                      className={`${inputClass()} h-auto py-3`}
                      rows={4}
                      value={editForm.bio}
                      onChange={e => handleProfileInputChange('bio', e.target.value)}
                      placeholder="Tell your audience a little about you"
                    />
                  </Field>
                  {editActions}
                </div>
              ) : (
                <dl className="divide-y divide-slate-100">
                  <ReadRow label="Stage name" value={profile?.stageName} />
                  <ReadRow label="Bio" value={profile?.bio} />
                </dl>
              )}
            </Card>
          </div>

          {/* A small preview of the tipping page header, updating as you type */}
          <aside className="lg:sticky lg:top-6" aria-label="How fans see you">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-500">How fans see you</h2>
            <div
              className="rounded-3xl p-5 text-white shadow-lift"
              style={{ background: 'linear-gradient(160deg,#0a2533,#0d4254 60%,#0f3447)' }}
            >
              <div className="flex items-center gap-3">
                {profile?.profilePhotoUrl ? (
                  <img src={photoSrc(profile.profilePhotoUrl)} alt="" className="h-11 w-11 rounded-full border-2 border-white/30 object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold" style={{ background: 'linear-gradient(135deg,#06b6c8,#e5548c)' }}>
                    {previewName.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate font-extrabold">Tip {previewName}</div>
                  <div className="truncate text-sm text-white/70">{previewBio || 'Your bio shows here'}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {['$2', '$5', '$10'].map((a, i) => (
                  <div key={a} className="flex h-14 items-center justify-center rounded-xl text-lg font-extrabold" style={{ background: ['linear-gradient(135deg,#2dd4bf,#0f8f86)', 'linear-gradient(135deg,#22b8d6,#0e7490)', 'linear-gradient(135deg,#5b9bf8,#2748b8)'][i] }}>
                    {a}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Account: you, and how the app looks */}
      {section === 'account' && (
        <div className="max-w-2xl space-y-5">
          <Card
            title="Your details"
            actions={
              editingSection !== 'account' && (
                <Button variant="secondary" size="sm" onClick={() => handleEditProfile('account')}>
                  Edit
                </Button>
              )
            }
          >
            {editingSection === 'account' ? (
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="First name" error={profileErrors.firstName}>
                    <input className={inputClass(!!profileErrors.firstName)} value={editForm.firstName} onChange={e => handleProfileInputChange('firstName', e.target.value)} autoComplete="given-name" />
                  </Field>
                  <Field label="Last name" error={profileErrors.lastName}>
                    <input className={inputClass(!!profileErrors.lastName)} value={editForm.lastName} onChange={e => handleProfileInputChange('lastName', e.target.value)} autoComplete="family-name" />
                  </Field>
                </div>
                <Field label="Email" error={profileErrors.email}>
                  <input type="email" className={inputClass(!!profileErrors.email)} value={editForm.email} onChange={e => handleProfileInputChange('email', e.target.value)} autoComplete="email" />
                </Field>
                <Field label="Phone" hint="Optional">
                  <input type="tel" className={inputClass()} value={editForm.phone} onChange={e => handleProfileInputChange('phone', e.target.value)} placeholder="+1 (555) 123-4567" autoComplete="tel" />
                </Field>
                {editActions}
              </div>
            ) : (
              <dl className="divide-y divide-slate-100">
                <ReadRow label="First name" value={profile?.firstName} />
                <ReadRow label="Last name" value={profile?.lastName} />
                <ReadRow label="Email" value={profile?.email} />
                <ReadRow label="Phone" value={profile?.phone} />
              </dl>
            )}
          </Card>

          <Card title="Appearance" subtitle="Light, dark, or match this device. Saved on this device only.">
            <ThemeToggle className="max-w-xs" />
          </Card>
        </div>
      )}

      {/* Payouts */}
      {section === 'payouts' && (
        <div className="max-w-2xl space-y-5">
          <Card
            title="Payouts"
            subtitle="Stripe pays your tips to your bank account. They need to verify your identity first."
            actions={payoutChip}
          >
            {kycStatus === 'verified' && (
              <p className="text-sm text-ink-700">Your identity is verified. Tips are paid out to your bank account automatically.</p>
            )}
            {kycStatus === 'pending' && (
              <div className="space-y-3">
                <p className="text-sm text-ink-700">Stripe is still waiting for some of your details. Pick up where you left off.</p>
                <Button onClick={handleStartVerification}>Continue verification</Button>
              </div>
            )}
            {(kycStatus === 'not_verified' || kycStatus === 'unknown') && (
              <div className="space-y-3">
                <p className="text-sm text-ink-700">You will not receive payouts until this is done. It takes about 3 minutes.</p>
                {profile?.stripeAccountId ? (
                  <Button onClick={handleStartVerification}>Verify my identity</Button>
                ) : (
                  <Button onClick={handleStartOnboarding}>Set up payouts</Button>
                )}
              </div>
            )}
          </Card>
          {kycStatus !== 'verified' && (
            <Card title="What Stripe will ask for">
              <ul className="space-y-3">
                {[
                  { icon: 'id-card' as const, text: 'A government photo ID' },
                  { icon: 'home' as const, text: 'Your home address' },
                  { icon: 'bank' as const, text: 'The bank account where payouts go' }
                ].map(item => (
                  <li key={item.text} className="flex items-center gap-3">
                    <IconTile name={item.icon} size={36} />
                    <span className="font-medium text-ink-900">{item.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Security */}
      {section === 'security' && (
        <div className="max-w-2xl">
          <Card title="Password" subtitle={isChangingPassword ? undefined : 'Keep your account safe with a strong password.'}
            actions={!isChangingPassword && (
              <Button variant="secondary" size="sm" onClick={handleChangePassword}>
                Change password
              </Button>
            )}
          >
            {isChangingPassword && (
              <div className="space-y-5">
                {passwordInput('current', 'Current password', 'currentPassword', 'currentPassword')}
                {passwordInput('new', 'New password', 'newPassword', 'newPassword')}
                {passwordInput('confirm', 'Confirm new password', 'confirmPassword', 'confirmPassword')}
                <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                  <Button variant="secondary" onClick={handleCancelPassword} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleSavePassword} loading={saving}>
                    Change password
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </PortalShell>
  )
}

export default Profile
