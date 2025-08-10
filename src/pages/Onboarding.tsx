import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { getEncryptDecryptNoUserName } from '../utils/encryption'

const Onboarding: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    stageName: '',
    password: '',
    confirmPassword: '',
    deviceId: '',
    deviceNickname: '',
    isAllowSongRequest: null as boolean | null
  })

  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [apiKeyGenerated, setApiKeyGenerated] = useState(false)
  const [isValidatingDevice, setIsValidatingDevice] = useState(false)
  const [deviceValidationComplete, setDeviceValidationComplete] = useState(false)
  const navigate = useNavigate()

  // Generate API key on component mount
  useEffect(() => {
    const generateApiKey = async () => {
      try {
        await getEncryptDecryptNoUserName()
        setApiKeyGenerated(true)
      } catch (error) {
        console.error('Failed to generate API key:', error)
      }
    }
    generateApiKey()
  }, [])

  const steps = [
    {
      id: 1,
      title: 'Personal Info',
      subtitle: 'Tell us about yourself',
      icon: '👤',
      description: 'Basic contact information and bio'
    },
    {
      id: 2,
      title: 'Create Password',
      subtitle: 'Set up your account security',
      icon: '🔒',
      description: 'Create a secure password for login (creates your profile)'
    },
    {
      id: 3,
      title: 'Device Setup',
      subtitle: 'Register your Tipply device',
      icon: '📱',
      description: 'Device ID and nickname'
    },
    {
      id: 4,
      title: 'KYC Verification',
      subtitle: 'Identity verification with Stripe',
      icon: '🔐',
      description: 'Security & compliance'
    },
    {
      id: 5,
      title: 'Complete Setup',
      subtitle: 'Finish onboarding',
      icon: '✅',
      description: 'Ready to start accepting tips'
    }
  ]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setErrors(prev => ({ ...prev, [name]: '' }))
    
    // Reset device validation state when device ID changes
    if (name === 'deviceId') {
      setDeviceValidationComplete(false)
      setIsValidatingDevice(false)
    }
  }

  const validatePassword = () => {
    if (formData.password.length < 6) {
      return 'Password must be at least 6 characters long'
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Passwords do not match'
    }
    return null
  }



  const validateDeviceIdUniqueness = async () => {
    const deviceId = formData.deviceId.trim()
    
    if (!deviceId) {
      return { isValid: false, error: 'Device ID is required' }
    }
    
    try {
      const result = await apiService.checkDeviceExists(deviceId)
      
      if (result.error) {
        return { isValid: false, error: result.error }
      }
      
      if (result.data?.exists) {
        const device = result.data.device
        return {
          isValid: false,
          error: `Device UUID already exists`,
          details: {
            ownerName: device.ownerName,
            ownerEmail: device.ownerEmail,
            nickname: device.nickname,
            createdAt: device.createdAt
          }
        }
      }
      
      return { isValid: true, error: null }
    } catch (err) {
      return { isValid: false, error: 'Failed to validate device UUID' }
    }
  }

  const validateDetectedDevice = async () => {
    const deviceId = formData.deviceId.trim()
    
    if (!deviceId) {
      return { isValid: false, error: 'Device ID is required' }
    }
    
    setIsValidatingDevice(true)
    setDeviceValidationComplete(false)
    
    try {
      const result = await apiService.checkDetectedDevice(deviceId)
      
      if (result.error) {
        const errorMessage = result.error || 'Failed to validate device UUID'
        setErrors(prev => ({ ...prev, deviceId: errorMessage }))
        setDeviceValidationComplete(true)
        setIsValidatingDevice(false)
        return { isValid: false, error: errorMessage }
      }
      
      if (!result.data?.exists) {
        const errorMessage = result.data?.message || 'Device UUID could not be located, please check again'
        setErrors(prev => ({ ...prev, deviceId: errorMessage }))
        setDeviceValidationComplete(true)
        setIsValidatingDevice(false)
        return { isValid: false, error: errorMessage }
      }
      
      // Clear any existing errors
      setErrors(prev => ({ ...prev, deviceId: '' }))
      setDeviceValidationComplete(true)
      setIsValidatingDevice(false)
      return { isValid: true, error: null }
    } catch (err) {
      const errorMessage = 'Failed to validate device UUID'
      setErrors(prev => ({ ...prev, deviceId: errorMessage }))
      setDeviceValidationComplete(true)
      setIsValidatingDevice(false)
      return { isValid: false, error: errorMessage }
    }
  }

  const validateStep1 = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (step < 5) {
      if (step === 1) {
        // Validate step 1
        if (!validateStep1()) {
          return
        }
        // Save personal info (just validation, no API call needed)
        await savePersonalInfo()
        setStep(step + 1)
      } else if (step === 2) {
        // Validate password and create profile
        const passwordError = validatePassword()
        if (passwordError) {
          setErrors(prev => ({ ...prev, password: passwordError }))
          return
        }
        setErrors(prev => ({ ...prev, password: '', confirmPassword: '' }))
        await createProfile()
        setStep(step + 1)
      } else if (step === 3) {
        // Register device using the created profile
        if (!deviceValidationComplete || !!errors.deviceId) {
          // Re-validate if not already validated
          if (formData.deviceId.trim()) {
            const validation = await validateDetectedDevice()
            if (!validation.isValid) {
              return
            }
          } else {
            setErrors(prev => ({ ...prev, deviceId: 'Device ID is required' }))
            return
          }
        }
        
        // Validate song request selection
        if (formData.isAllowSongRequest === null) {
          setErrors(prev => ({ 
            ...prev, 
            isAllowSongRequest: 'Please select whether you want to enable song requests from your audience.' 
          }))
          return
        }
        setErrors(prev => ({ ...prev, isAllowSongRequest: '' }))
        
        await registerDevice()
        setStep(step + 1)
      } else if (step === 4) {
        // Start KYC process - this will redirect to Stripe
        await startKYC()
        // Don't advance step here - startKYC will redirect to Stripe
      }
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
      // Clear errors when going back
      setErrors({})
    }
  }

  const savePersonalInfo = async () => {
    setIsLoading(true)
    try {
      // During onboarding, we don't need to update profile separately
      // The profile will be created when we set the password
      console.log('Personal info saved for onboarding')
    } catch (err) {
      console.error('Failed to save personal info:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const createProfile = async () => {
    setIsLoading(true)
    try {
      // Create profile and set password in one step
      const result = await apiService.createProfileOnboarding({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      })
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      console.log('Profile created and password set successfully for onboarding')
    } catch (err) {
      console.error('Failed to create profile:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const registerDevice = async () => {
    setIsLoading(true)
    try {
      // First validate UUID uniqueness
      const uniquenessCheck = await validateDeviceIdUniqueness()
      if (!uniquenessCheck.isValid) {
        setErrors(prev => ({ 
          ...prev, 
          deviceId: uniquenessCheck.error || 'Device validation failed'
        }))
        
        // Show detailed alert if device exists
        if (uniquenessCheck.details) {
          const device = uniquenessCheck.details
          const alertMessage = `⚠️ Device UUID Already Exists

This device UUID is already registered to:
• Owner: ${device.ownerName}
• Email: ${device.ownerEmail}
• Nickname: ${device.nickname || 'No nickname'}
• Registered: ${new Date(device.createdAt).toLocaleDateString()}

Please use a different device UUID or contact support if this is your device.`
          
          alert(alertMessage)
        }
        
        return
      }

      const result = await apiService.registerDeviceOnboarding({
        deviceUuid: formData.deviceId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        nickname: formData.deviceNickname,
        isAllowSongRequest: formData.isAllowSongRequest || false
      })

      if (result.error) {
        // Check if it's a duplicate device error
        if (result.error.includes('already exists')) {
          setErrors(prev => ({ 
            ...prev, 
            deviceId: 'This device is already registered. Please use a different device ID or contact support if this is your device.' 
          }))
          return
        }
        throw new Error(result.error)
      }
      
      console.log('Device registered successfully for onboarding')
    } catch (err) {
      console.error('Failed to register device:', err)
      setErrors(prev => ({ 
        ...prev, 
        deviceId: err instanceof Error ? err.message : 'Failed to register device. Please try again.' 
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const startKYC = async () => {
    setIsLoading(true)
    try {
      // Store credentials temporarily for automatic login after KYC
      sessionStorage.setItem('onboarding_email', formData.email)
      sessionStorage.setItem('onboarding_password', formData.password)

      console.log('Starting KYC process with device ID:', formData.deviceId)

      const result = await apiService.createConnectAccount({
        deviceUuid: formData.deviceId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email
      })

      console.log('CreateConnectAccount response:', result)

      if (result.error) {
        throw new Error(result.error)
      }

      // Check if we got the new async response format
      if (result.data?.status === 'processing') {
        console.log('Received processing status, starting polling...')
        // Poll for status until we get the onboarding URL
        await pollForOnboardingUrl()
        return
      }

      // Handle legacy immediate response format
      if (result.data?.onboardingUrl) {
        console.log('Received immediate onboarding URL, redirecting...')
        window.location.href = result.data.onboardingUrl
        return // Exit early, don't set loading to false
      } else {
        console.error('Unexpected response format:', result.data)
        throw new Error('No onboarding URL received from Stripe')
      }
    } catch (err) {
      console.error('Failed to start KYC process:', err)
      
      // Check if this is a retryable error
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('creation_error')) {
        // Show retry option
        if (window.confirm('The KYC process encountered an issue. Would you like to try again?')) {
          setIsLoading(false)
          // Wait a moment before retrying
          setTimeout(() => {
            startKYC()
          }, 2000)
          return
        }
      }
      
      setIsLoading(false) // Only set loading to false on error
    }
  }

  const pollForOnboardingUrl = async () => {
    const maxAttempts = 180 // 3 minutes max (increased for Stripe Connect account creation)
    const pollInterval = 1000 // 1 second
    
    console.log(`Starting polling for device: ${formData.deviceId}`)
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Polling for onboarding URL, attempt ${attempt}/${maxAttempts}`)
        
        const statusResult = await apiService.getConnectAccountStatus(formData.deviceId)
        
        console.log(`Status response for attempt ${attempt}:`, statusResult)
        
        if (statusResult.error) {
          console.error('Error polling status:', statusResult.error)
          // If we get an error, wait a bit longer before retrying
          await new Promise(resolve => setTimeout(resolve, pollInterval * 2))
          continue
        }
        
        const status = statusResult.data
        console.log('Status data:', status)
        
        // Check if we have an onboarding URL
        if (status?.onboardingUrl) {
          console.log('Onboarding URL received, redirecting to Stripe')
          window.location.href = status.onboardingUrl
          return
        }
        
        // Check if there was an error
        if (status?.error) {
          throw new Error(status.error)
        }
        
        // Check for specific error states
        if (status?.status === 'timeout_error') {
          throw new Error('Stripe Connect account creation timed out. Please try again.')
        }
        
        if (status?.status === 'network_error') {
          throw new Error('Network error during Stripe Connect account creation. Please try again.')
        }
        
        if (status?.status === 'creation_error') {
          throw new Error('Error during Stripe Connect account creation. Please try again.')
        }
        
        // Check if still processing
        if (status?.status === 'processing') {
          console.log('Still processing, waiting...')
          
          // After 30 seconds of processing, show a more informative message
          if (attempt === 30) {
            console.warn('Stripe account creation is taking longer than expected. This may be due to high load or network issues.')
          }
          
          // After 60 seconds, show that this is normal for Stripe Connect
          if (attempt === 60) {
            console.log('Stripe Connect account creation typically takes 1-3 minutes. Please be patient...')
          }
          
          // After 120 seconds, show final warning
          if (attempt === 120) {
            console.warn('Stripe Connect account creation is taking longer than usual. This may indicate an issue.')
          }
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        
      } catch (error) {
        console.error(`Error during polling attempt ${attempt}:`, error)
        
        // Check if this is a retryable error
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('creation_error')) {
          // For retryable errors, try a few more times before giving up
          if (attempt >= maxAttempts - 10) {
            throw new Error(`Stripe Connect account creation failed: ${errorMessage}`)
          }
          // Wait longer before retrying for these errors
          await new Promise(resolve => setTimeout(resolve, pollInterval * 3))
          continue
        }
        
        if (attempt === maxAttempts) {
          throw new Error('Stripe Connect account creation is taking longer than expected (3 minutes). The process may still be running in the background. Please check your dashboard or try again.')
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }
    
    // If we get here, we've timed out
    throw new Error('Stripe Connect account creation is taking longer than expected (3 minutes). The process may still be running in the background. Please check your dashboard or try again.')
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      // Navigate to dashboard
      navigate('/dashboard')
    } catch (err) {
      console.error('Onboarding failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const renderStep1 = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="text-6xl mb-4">👤</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Personal Information</h3>
        <p className="text-gray-600">Let's start with your basic details and tell us about yourself</p>
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700">
            First Name *
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            placeholder="Enter your first name"
            value={formData.firstName}
            onChange={handleInputChange}
          />
          {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700">
            Last Name *
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            placeholder="Enter your last name"
            value={formData.lastName}
            onChange={handleInputChange}
          />
          {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
        </div>
      </div>
      
      <div className="space-y-2">
        <label htmlFor="stageName" className="block text-sm font-semibold text-gray-700">
          Stage Name
        </label>
        <input
          type="text"
          id="stageName"
          name="stageName"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          placeholder="Your stage name or artist name"
          value={formData.stageName}
          onChange={handleInputChange}
        />
        <p className="text-sm text-gray-500">This is how you'll appear to your audience</p>
      </div>
      
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
          Email Address *
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          placeholder="your.email@example.com"
          value={formData.email}
          onChange={handleInputChange}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>
      
      <div className="space-y-2">
        <label htmlFor="phone" className="block text-sm font-semibold text-gray-700">
          Phone Number
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          placeholder="+1 (555) 123-4567"
          value={formData.phone}
          onChange={handleInputChange}
        />
        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="bio" className="block text-sm font-semibold text-gray-700">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
          placeholder="Tell your audience a bit about yourself..."
          value={formData.bio}
          onChange={handleInputChange}
        />
        {errors.bio && <p className="text-red-500 text-xs mt-1">{errors.bio}</p>}
        <p className="text-sm text-gray-500">A short description that will appear on your tipping page</p>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Create Your Password</h3>
        <p className="text-gray-600">Set up a secure password to protect your account</p>
      </div>
      
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-blue-900 mb-2">
              Password Requirements
            </h4>
            <p className="text-blue-700 mb-4">
              Your password will be used to log into your Tipply dashboard and manage your account.
            </p>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-blue-800">At least 6 characters long</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-blue-800">Use a combination of letters, numbers, and symbols</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-blue-800">Avoid using personal information</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
            Password *
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 ${
              errors.password ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
            }`}
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleInputChange}
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          <p className="text-sm text-gray-500">Minimum 6 characters</p>
        </div>
        
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
            Confirm Password *
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleInputChange}
          />
          {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
        </div>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="text-6xl mb-4">📱</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Device Registration</h3>
        <p className="text-gray-600">Register your Tipply device to start accepting tips</p>
      </div>
      
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-blue-900 mb-2">
              Device Setup Instructions
            </h4>
            <p className="text-blue-700 mb-4">
              You'll need your Tipply device ID to complete this step. This is typically found on the device itself or in the device documentation.
            </p>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-blue-800">Locate your device ID (usually a UUID)</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-blue-800">Give your device a memorable nickname</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-blue-800">We'll generate a QR code for your audience</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="deviceId" className="block text-sm font-semibold text-gray-700">
            Device ID *
          </label>
          <div className="relative">
            <input
              type="text"
              id="deviceId"
              name="deviceId"
              required
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 ${
                errors.deviceId ? 'border-red-500 focus:ring-red-200' : 'border-gray-300'
              }`}
              placeholder="f47ac10b-58cc-4372-a567-0e02b2c3d47f"
              value={formData.deviceId}
              onChange={handleInputChange}
              onBlur={async () => {
                if (formData.deviceId.trim()) {
                  await validateDetectedDevice()
                }
              }}
            />
            {isValidatingDevice && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
              </div>
            )}
          </div>
          {errors.deviceId && <p className="text-red-500 text-xs mt-1">{errors.deviceId}</p>}
          {deviceValidationComplete && !errors.deviceId && formData.deviceId.trim() && (
            <p className="text-green-500 text-xs mt-1">✓ Device UUID validated successfully</p>
          )}
          <p className="text-sm text-gray-500">
            Enter the UUID from your Tipply device (36 characters, format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
          </p>
        </div>
        
        <div className="space-y-2">
          <label htmlFor="deviceNickname" className="block text-sm font-semibold text-gray-700">
            Device Nickname
          </label>
          <input
            type="text"
            id="deviceNickname"
            name="deviceNickname"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            placeholder="e.g., Main Stage, Bar Counter, etc."
            value={formData.deviceNickname}
            onChange={handleInputChange}
          />
          {errors.deviceNickname && <p className="text-red-500 text-xs mt-1">{errors.deviceNickname}</p>}
          <p className="text-sm text-gray-500">A friendly name to help you identify this device</p>
        </div>
        
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-gray-700">
            Would you like to enable song requests from your audience? *
          </label>
          <p className="text-sm text-gray-500 mb-4">
            If you select "Yes", you'll be able to create a song catalog for your audience to choose from once you're logged in. This allows your audience to request specific songs when they tip you.
          </p>
          <div className="space-y-3">
            <label className="flex items-center cursor-pointer p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="isAllowSongRequest"
                checked={formData.isAllowSongRequest === true}
                onChange={() => setFormData(prev => ({ ...prev, isAllowSongRequest: true }))}
                className="mr-4 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Yes, enable song requests</span>
                <p className="text-xs text-gray-500 mt-1">Your audience can request songs when they tip</p>
              </div>
            </label>
            <label className="flex items-center cursor-pointer p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="isAllowSongRequest"
                checked={formData.isAllowSongRequest === false}
                onChange={() => setFormData(prev => ({ ...prev, isAllowSongRequest: false }))}
                className="mr-4 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">No, disable song requests</span>
                <p className="text-xs text-gray-500 mt-1">Standard tipping without song requests</p>
              </div>
            </label>
          </div>
          {errors.isAllowSongRequest && <p className="text-red-500 text-xs mt-1">{errors.isAllowSongRequest}</p>}
        </div>
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="text-6xl mb-4">🔐</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">KYC Verification</h3>
        <p className="text-gray-600">Complete identity verification with Stripe to receive payments</p>
      </div>
      
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-green-900 mb-2">
              Stripe Connect KYC Process
            </h4>
            <p className="text-green-700 mb-4">
              To comply with financial regulations and ensure secure transactions, we need to verify your identity through Stripe Connect. 
              This process is quick, secure, and required to receive payments.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-800">Government ID verification</span>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-800">Address verification</span>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-800">Business verification</span>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-800">Secure payment processing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-yellow-800 text-sm">
            <strong>Note:</strong> You'll be redirected to Stripe's secure platform to complete the verification process. 
            After completion, you'll be redirected back to Tipply.
          </p>
        </div>
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-8">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h3>
        <p className="text-gray-600">You're all set to start accepting tips</p>
      </div>
      
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-purple-900 mb-2">
              Welcome to Tipply!
            </h4>
            <p className="text-purple-700 mb-4">
              Your account is now fully set up and ready to accept tips. You can access your dashboard to view analytics, 
              manage your devices, and download QR codes for your audience.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-purple-800">View your dashboard</span>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-purple-800">Download QR codes</span>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-purple-800">Manage devices</span>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-purple-200">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-purple-800">Track earnings</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1()
      case 2:
        return renderStep2()
      case 3:
        return renderStep3()
      case 4:
        return renderStep4()
      case 5:
        return renderStep5()
      default:
        return renderStep1()
    }
  }

  const getNextStepInfo = () => {
    if (step < 5) {
      return steps[step]
    }
    return null
  }

  if (!apiKeyGenerated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing secure connection...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="mx-auto w-36 h-36 overflow-visible rounded-2xl mb-6">
            <img 
              src="/images/tipply_logo.png" 
              alt="Tipply Logo" 
              className="w-full h-full object-contain"
              style={{ transform: 'scale(1.25)', objectPosition: 'center' }}
            />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Tipply
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Let's get you set up to start accepting tips in just a few minutes
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Progress Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Setup Progress</h3>
              <div className="space-y-4">
                {steps.map((stepInfo) => (
                  <div key={stepInfo.id} className="flex items-center space-x-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium transition-all duration-200 ${
                      stepInfo.id < step
                        ? 'bg-green-100 text-green-600'
                        : stepInfo.id === step
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {stepInfo.id < step ? '✓' : stepInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        stepInfo.id <= step ? 'text-gray-900' : 'text-gray-500'
                      }`}>
                        {stepInfo.title}
                      </p>
                      <p className={`text-xs ${
                        stepInfo.id <= step ? 'text-gray-600' : 'text-gray-400'
                      }`}>
                        {stepInfo.subtitle}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                  <span>Progress</span>
                  <span>{Math.round((step / 5) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(step / 5) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              {renderCurrentStep()}

              {/* Next Step Preview */}
              {getNextStepInfo() && (
                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{getNextStepInfo()?.icon}</div>
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        Next: {getNextStepInfo()?.title}
                      </p>
                      <p className="text-xs text-blue-700">
                        {getNextStepInfo()?.description}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={step === 1}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isLoading || (step === 3 && (isValidatingDevice || !deviceValidationComplete || !!errors.deviceId))}
                  className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium rounded-lg hover:from-primary-700 hover:to-primary-800 focus:ring-4 focus:ring-primary-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : step === 5 ? (
                    'Go to Dashboard'
                  ) : step === 4 ? (
                    'Start KYC Process'
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Login */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200"
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  )
}

export default Onboarding 