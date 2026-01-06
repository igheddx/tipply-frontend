import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'

interface ProfileData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  stageName?: string
  bio?: string
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
  const [stripeEnabledDevices, setStripeEnabledDevices] = useState<string[]>([])
  
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
  
  const navigate = useNavigate()

  useEffect(() => {
    fetchProfile()
    checkStripeConnectStatus()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await apiService.getProfile()
      
      if (response.error) {
        setError('Failed to load profile')
        return
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
    } catch (err) {
      setError('Failed to load profile')
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

  const validatePasswordForm = () => {
    const errors: {[key: string]: string} = {}
    
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required'
    }
    
    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required'
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters'
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

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    navigate('/login')
  }

  const checkStripeConnectStatus = async () => {
    console.log('🔍 [Profile] checkStripeConnectStatus called')
    try {
      // Get user's devices
      console.log('🔍 [Profile] Getting devices...')
      const devicesResponse = await apiService.getDevices()
      console.log('🔍 [Profile] Devices response:', devicesResponse)
      if (devicesResponse.error || !devicesResponse.data) {
        console.log('❌ [Profile] No devices found or error getting devices:', devicesResponse.error)
        return
      }

      const devices = devicesResponse.data
      const stripeEnabledDevicesList: string[] = []

      // Check status for all devices (backend will check Profile.StripeAccountId)
      // Only need to check one device since all devices share the same Profile.StripeAccountId
      if (devices.length > 0) {
        console.log('Checking Stripe Connect status for device:', devices[0].uuid)
        try {
          const statusResponse = await apiService.getConnectAccountStatus(devices[0].uuid)
          console.log('Status response received:', statusResponse)
          
          if (statusResponse.data) {
            const status = statusResponse.data
            
            // Check verification status directly - try both cases
            const verificationStatus = status.VerificationStatus || status.verificationStatus || 'unknown'
            
            // Check if account is enabled and has charges/payouts enabled for KYC verification
            const isKycVerified = status.IsEnabled && status.ChargesEnabled && status.PayoutsEnabled
            
            console.log('Stripe Connect Status Check:', {
              IsEnabled: status.IsEnabled,
              ChargesEnabled: status.ChargesEnabled,
              PayoutsEnabled: status.PayoutsEnabled,
              VerificationStatus: verificationStatus,
              Status: status.Status,
              isKycVerified: isKycVerified,
              AccountId: status.AccountId,
              ProfileStripeAccountId: status.ProfileStripeAccountId,
              FullStatus: status
            })
            
            if (isKycVerified || verificationStatus.toLowerCase() === 'verified') {
              stripeEnabledDevicesList.push(...devices.map((d: { uuid: string }) => d.uuid))
              setKycStatus('verified')
            } else if (
              verificationStatus.toLowerCase() === 'pending' ||
              verificationStatus.toLowerCase() === 'pending_verification' ||
              verificationStatus.toLowerCase() === 'incomplete' ||
              verificationStatus.toLowerCase() === 'requires_verification' ||
              status.Status === 'pending' ||
              status.Status === 'incomplete'
            ) {
              setKycStatus('pending')
            } else {
              setKycStatus('not_verified')
            }
          } else {
            // No status data returned, check if it's a not_connected status
            console.log('No status data returned from getConnectAccountStatus. Response:', statusResponse)
            setKycStatus('not_verified')
          }
        } catch (error) {
          console.error(`Error checking status for device ${devices[0].uuid}:`, error)
          console.error('Full error details:', JSON.stringify(error, null, 2))
          setKycStatus('not_verified')
        }
      } else {
        // No devices found
        setKycStatus('not_verified')
      }
      
      setStripeEnabledDevices(stripeEnabledDevicesList)
    } catch (error) {
      console.error('Error checking Stripe Connect status:', error)
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Dashboard</span>
              </button>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Profile</h1>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Verification Status Section */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Verification Status</h2>
          <div className="flex flex-wrap gap-4">
            {/* KYC Status */}
            {kycStatus === 'verified' && (
              <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-green-800">KYC Verified</span>
              </div>
            )}
            {kycStatus === 'pending' && (
              <div className="flex items-center space-x-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-yellow-800">KYC Pending</span>
              </div>
            )}
            {kycStatus === 'not_verified' && (
              <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-red-800">KYC Not Verified</span>
              </div>
            )}
            
            {/* Stripe Account Status */}
            {stripeEnabledDevices.length > 0 && (
              <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-blue-800">Stripe Verified</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
            {!isEditing && (
              <button
                onClick={handleEditProfile}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Edit Profile
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
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
                    Last Name *
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
                  Stage Name
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
                  Email *
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
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <p className="text-gray-900">{profile?.firstName || 'Not set'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <p className="text-gray-900">{profile?.lastName || 'Not set'}</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage Name</label>
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
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Security</h2>
            {!isChangingPassword && (
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Change Password
              </button>
            )}
          </div>

          {isChangingPassword ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    passwordErrors.currentPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {passwordErrors.currentPassword && (
                  <p className="text-red-500 text-sm mt-1">{passwordErrors.currentPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    passwordErrors.newPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {passwordErrors.newPassword && (
                  <p className="text-red-500 text-sm mt-1">{passwordErrors.newPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
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
                  {saving ? 'Changing Password...' : 'Change Password'}
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
    </div>
  )
}

export default Profile 