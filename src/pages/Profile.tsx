import logger from "../utils/logger";
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import PhotoUpload from '../components/PhotoUpload'
import { PortalShell, type PortalNavItem } from '../components/portal/PortalShell'
import { Banner, Button, Card, PageHeader, StatusChip } from '../components/ui'

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

const Profile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [isEditing, setIsEditing] = useState(false)
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

  const handleEditProfile = () => {
    setIsEditing(true)
    setError('')
    setSuccess('')
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
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
      setIsEditing(false)
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
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
      <PageHeader title="Profile and payouts" subtitle="Your details, your tipping page photo, and how you get paid." />
      <div>
        {error && (
          <Banner tone="error" title="Something went wrong" className="mb-5" onDismiss={() => setError('')}>
            {error}
          </Banner>
        )}

        {success && (
          <Banner tone="success" title={success} className="mb-5" onDismiss={() => setSuccess('')} />
        )}

        {/* Payouts */}
        <Card
          className="mb-5 max-w-2xl"
          title="Payouts"
          subtitle="Stripe pays your tips to your bank account. They need to verify your identity first."
          actions={
            kycStatus === 'verified' ? (
              <StatusChip kind="paid" label="Ready" />
            ) : kycStatus === 'pending' ? (
              <StatusChip kind="processing" label="In progress" />
            ) : (
              <StatusChip kind="failed" label="Not set up" />
            )
          }
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

        <div className="mb-5 max-w-2xl rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-ink-900">Personal information</h2>
            {!isEditing && (
              <button
                onClick={handleEditProfile}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Edit profile
              </button>
            )}
          </div>

          {/* Profile Photo Section */}
          <div className="mb-8 border-b border-gray-200 pb-8">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Profile Photo</h3>
            <div className="min-h-[200px]">
              <PhotoUpload
                photoUrl={profile?.profilePhotoUrl}
                onPhotoChange={(url) => {
                  if (profile) {
                    setProfile({ ...profile, profilePhotoUrl: url })
                  }
                }}
                variant="profile"
              />
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First name
                  </label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    onChange={(e) => handleProfileInputChange('firstName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      profileErrors.firstName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {profileErrors.firstName && (
                    <p className="text-red-500 text-sm mt-1">{profileErrors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    onChange={(e) => handleProfileInputChange('lastName', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      profileErrors.lastName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {profileErrors.lastName && (
                    <p className="text-red-500 text-sm mt-1">{profileErrors.lastName}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stage name
                </label>
                <input
                  type="text"
                  value={editForm.stageName}
                  onChange={(e) => handleProfileInputChange('stageName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Your stage name (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => handleProfileInputChange('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    profileErrors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {profileErrors.email && (
                  <p className="text-red-500 text-sm mt-1">{profileErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => handleProfileInputChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Your phone number (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => handleProfileInputChange('bio', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows={4}
                  placeholder="Write a brief bio about yourself (optional)"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                  <p className="text-gray-900">{profile?.firstName || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                  <p className="text-gray-900">{profile?.lastName || 'Not set'}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage name</label>
                <p className="text-gray-900">{profile?.stageName || 'Not set'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <p className="text-gray-900">{profile?.email || 'Not set'}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <p className="text-gray-900">{profile?.phone || 'Not set'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                <p className="text-gray-900">{profile?.bio || 'Not set'}</p>
              </div>
            </div>
          )}
        </div>

        {/* Password Section */}
        <div className="max-w-2xl rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-ink-900">Security</h2>
            {!isChangingPassword && (
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Change password
              </button>
            )}
          </div>

          {isChangingPassword ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current password
                </label>
                <div className="relative">
                  <input
                    type={showPasswordFields.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                    onBlur={() => handlePasswordFieldBlur('currentPassword')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      passwordErrors.currentPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordFields((prev) => ({ ...prev, current: !prev.current }))}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPasswordFields.current ? 'Hide password' : 'Show password'}
                  >
                    {showPasswordFields.current ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-.88.21-1.715.58-2.47m3.15-3.15A9.956 9.956 0 0112 5c5 0 9 4 9 7 0 1.07-.34 2.07-.94 3m-3.28 3.28L4.22 4.22" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p className="text-red-500 text-sm mt-1">{passwordErrors.currentPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPasswordFields.new ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                    onBlur={() => handlePasswordFieldBlur('newPassword')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      passwordErrors.newPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordFields((prev) => ({ ...prev, new: !prev.new }))}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPasswordFields.new ? 'Hide password' : 'Show password'}
                  >
                    {showPasswordFields.new ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-.88.21-1.715.58-2.47m3.15-3.15A9.956 9.956 0 0112 5c5 0 9 4 9 7 0 1.07-.34 2.07-.94 3m-3.28 3.28L4.22 4.22" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <p className="text-red-500 text-sm mt-1">{passwordErrors.newPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New password
                </label>
                <div className="relative">
                  <input
                    type={showPasswordFields.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                    onBlur={() => handlePasswordFieldBlur('confirmPassword')}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                      passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordFields((prev) => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPasswordFields.confirm ? 'Hide password' : 'Show password'}
                  >
                    {showPasswordFields.confirm ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-.88.21-1.715.58-2.47m3.15-3.15A9.956 9.956 0 0112 5c5 0 9 4 9 7 0 1.07-.34 2.07-.94 3m-3.28 3.28L4.22 4.22" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">{passwordErrors.confirmPassword}</p>
                )}
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={handleCancelPassword}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePassword}
                  disabled={saving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Changing password…' : 'Change password'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-600">Keep your account secure by using a strong password.</p>
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}

export default Profile 