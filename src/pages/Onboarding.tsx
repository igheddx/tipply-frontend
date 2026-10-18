import logger from "../utils/logger";
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { getEncryptDecryptNoUserName } from '../utils/encryption'
import { BrandIcon, IconTile, type BrandIconName } from '../components/icons/BrandIcons'
import { Banner, Button } from '../components/ui'

const RESEND_SECONDS = 30

const STEPS: { id: number; title: string; subtitle: string; icon: BrandIconName }[] = [
  { id: 1, title: 'Create account', subtitle: 'Your name, email and password', icon: 'user' },
  { id: 2, title: 'Verify email', subtitle: 'Enter the 6-digit code', icon: 'mail' },
  { id: 3, title: 'Add your device', subtitle: 'Serial number and nickname', icon: 'device' },
  { id: 4, title: 'Get paid', subtitle: 'Verify your identity with Stripe', icon: 'bank' }
]
const FINISH_STEP = STEPS.length + 1

const inputClass = (hasError?: boolean) =>
  `w-full h-12 px-4 rounded-xl border bg-white text-ink-900 placeholder:text-ink-400 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
    hasError ? 'border-red-400' : 'border-slate-300'
  }`

const Field: React.FC<{
  id: string
  label: string
  error?: string
  hint?: string
  optional?: boolean
  children: React.ReactNode
}> = ({ id, label, error, hint, optional, children }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink-700">
      {label}
      {optional && <span className="ml-1 font-normal text-ink-500">(optional)</span>}
    </label>
    {children}
    {error ? (
      <p className="mt-1.5 text-sm text-red-600">{error}</p>
    ) : (
      hint && <p className="mt-1.5 text-sm text-ink-500">{hint}</p>
    )}
  </div>
)

const passwordChecks = (password: string) => [
  { label: 'At least 8 characters', ok: password.length >= 8 },
  { label: 'A letter and a number', ok: /[A-Za-z]/.test(password) && /\d/.test(password) }
]

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
    serialNumber: '',
    deviceNickname: '',
    isAllowSongRequest: false
  })

  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showKycSupportActions, setShowKycSupportActions] = useState(false)
  const [step, setStep] = useState(1)
  const [apiKeyGenerated, setApiKeyGenerated] = useState(false)
  const [isValidatingDevice, setIsValidatingDevice] = useState(false)
  const [deviceValidationComplete, setDeviceValidationComplete] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [, setVerificationSent] = useState(false)
  const [profileCreated, setProfileCreated] = useState(false)
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [deviceConflict, setDeviceConflict] = useState<string | null>(null)
  const navigate = useNavigate()
  const verifyingRef = useRef(false)
  const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && 'ontouchend' in (document as any)))

  // Generate API key on component mount
  useEffect(() => {
    const generateApiKey = async () => {
      try {
        await getEncryptDecryptNoUserName()
        setApiKeyGenerated(true)
      } catch (error) {
        logger.error('Failed to generate API key:', error)
      }
    }
    generateApiKey()
  }, [])

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setErrors(prev => ({ ...prev, [name]: '' }))

    // If the user edits email, allow profile creation to run again for the new address
    if (name === 'email') {
      setProfileCreated(false)
      setErrors(prev => ({ ...prev, accountError: '' }))
    }

    // Reset device validation state when serial number changes
    if (name === 'serialNumber') {
      setDeviceValidationComplete(false)
      setIsValidatingDevice(false)
      setDeviceConflict(null)
    }
  }

  const sendVerificationCode = async () => {
    if (!formData.email.trim()) {
      setErrors(prev => ({ ...prev, email: 'Email is required to send a verification code' }))
      return false
    }

    try {
      setIsLoading(true)
      const result = await apiService.sendOnboardingVerification(formData.email)

      if (result.error) {
        setErrors(prev => ({ ...prev, email: result.error || 'We could not send the code' }))
        return false
      }

      setVerificationSent(true)
      setResendIn(RESEND_SECONDS)
      return true
    } catch (err) {
      logger.log('sendVerificationCode: Exception occurred:', err)
      setErrors(prev => ({ ...prev, email: 'We could not send the code. Please try again.' }))
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const verifyEmail = async () => {
    if (!verificationCode.trim()) {
      setErrors(prev => ({ ...prev, verificationCode: 'Enter the code from your email' }))
      return false
    }

    try {
      const result = await apiService.validateOnboardingCode(formData.email, verificationCode)

      if (result.error) {
        setErrors(prev => ({ ...prev, verificationCode: result.error || 'That code is not right' }))
        return false
      }

      setErrors(prev => ({ ...prev, verificationCode: '' }))
      return true
    } catch (err) {
      setErrors(prev => ({ ...prev, verificationCode: 'We could not check the code. Please try again.' }))
      return false
    }
  }

  const validateSerialNumberUniqueness = async () => {
    const serialNumber = formData.serialNumber.trim()

    if (!serialNumber) {
      return { isValid: false, error: 'Enter the serial number printed on your device' }
    }

    try {
      const result = await apiService.checkDeviceExists(serialNumber)

      if (result.error) {
        return { isValid: false, error: result.error }
      }

      if (result.data?.exists) {
        const device = result.data.device
        return {
          isValid: false,
          error: 'This device is already registered',
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
      return { isValid: false, error: 'We could not check the serial number' }
    }
  }

  const validateDetectedDevice = async () => {
    const serialNumber = formData.serialNumber.trim()

    if (!serialNumber) {
      return { isValid: false, error: 'Enter the serial number printed on your device' }
    }

    setIsValidatingDevice(true)
    setDeviceValidationComplete(false)

    try {
      const result = await apiService.checkDetectedDeviceBySerialNumber(serialNumber)

      if (result.error) {
        const errorMessage = result.error || 'We could not check the serial number'
        setErrors(prev => ({ ...prev, serialNumber: errorMessage }))
        setDeviceValidationComplete(true)
        setIsValidatingDevice(false)
        return { isValid: false, error: errorMessage }
      }

      if (!result.data?.exists) {
        const errorMessage = result.data?.message || 'We could not find that serial number. Check it and try again.'
        setErrors(prev => ({ ...prev, serialNumber: errorMessage }))
        setDeviceValidationComplete(true)
        setIsValidatingDevice(false)
        return { isValid: false, error: errorMessage }
      }

      setErrors(prev => ({ ...prev, serialNumber: '' }))
      setDeviceValidationComplete(true)
      setIsValidatingDevice(false)
      return { isValid: true, error: null }
    } catch (err) {
      const errorMessage = 'We could not check the serial number'
      setErrors(prev => ({ ...prev, serialNumber: errorMessage }))
      setDeviceValidationComplete(true)
      setIsValidatingDevice(false)
      return { isValid: false, error: errorMessage }
    }
  }

  // Step 1 holds the name, email and password together; the account is created when it is submitted.
  const validateAccount = () => {
    const newErrors: {[key: string]: string} = {}

    if (!formData.firstName.trim()) newErrors.firstName = 'Enter your first name'
    if (!formData.lastName.trim()) newErrors.lastName = 'Enter your last name'
    if (!formData.stageName.trim()) newErrors.stageName = 'Enter the name your audience will see'
    if (!formData.email.trim()) {
      newErrors.email = 'Enter your email'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Enter a valid email address'
    }
    if (formData.password.length < 8) {
      newErrors.password = 'Use at least 8 characters'
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (step === 1) {
      if (!validateAccount()) return

      // Create the profile once; do not re-create it when the user comes back to this step
      if (!profileCreated) {
        const created = await createProfile()
        if (!created) return
        setProfileCreated(true)
      }

      const sent = await sendVerificationCode()
      if (!sent) return
      setStep(2)
    } else if (step === 2) {
      if (verifyingRef.current) return
      verifyingRef.current = true
      setIsLoading(true)
      try {
        const verified = await verifyEmail()
        if (!verified) return
        setStep(3)
      } finally {
        verifyingRef.current = false
        setIsLoading(false)
      }
    } else if (step === 3) {
      if (!deviceValidationComplete || !!errors.serialNumber) {
        if (formData.serialNumber.trim()) {
          const validation = await validateDetectedDevice()
          if (!validation.isValid) return
        } else {
          setErrors(prev => ({ ...prev, serialNumber: 'Enter the serial number printed on your device' }))
          return
        }
      }

      try {
        await registerDevice()
        setStep(4)
      } catch (err) {
        // The error is already shown by registerDevice; stay on this step
        logger.error('Device registration failed, not advancing to next step')
      }
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
      setErrors({})
    }
  }

  const createProfile = async (): Promise<boolean> => {
    setIsLoading(true)
    try {
      const result = await apiService.createProfileOnboarding({
        firstName: formData.firstName,
        lastName: formData.lastName,
        stageName: formData.stageName,
        bio: formData.bio,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      })

      if (result.error) {
        setErrors(prev => ({ ...prev, accountError: result.error || 'We could not create your account. That email may already be in use.' }))
        logger.error('Failed to create profile:', result.error)
        return false
      }

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'We could not create your account. That email may already be in use.'
      setErrors(prev => ({ ...prev, accountError: errorMessage }))
      logger.error('Failed to create profile:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const registerDevice = async () => {
    setIsLoading(true)
    try {
      const uniquenessCheck = await validateSerialNumberUniqueness()
      if (!uniquenessCheck.isValid) {
        setErrors(prev => ({
          ...prev,
          serialNumber: uniquenessCheck.error || 'We could not register this device'
        }))

        if (uniquenessCheck.details) {
          const device = uniquenessCheck.details
          setDeviceConflict(
            `Registered to ${device.ownerName} (${device.ownerEmail}) on ${new Date(device.createdAt).toLocaleDateString()}. ` +
              'If this is your device, contact support.'
          )
        }
        throw new Error(uniquenessCheck.error || 'Device validation failed')
      }

      const result = await apiService.registerDeviceOnboarding({
        serialNumber: formData.serialNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        nickname: formData.deviceNickname,
        isAllowSongRequest: formData.isAllowSongRequest
      })

      if (result.error) {
        if (result.error.includes('already exists')) {
          setErrors(prev => ({
            ...prev,
            serialNumber: 'This device is already registered. If it is yours, contact support.'
          }))
          throw new Error(result.error)
        }
        throw new Error(result.error)
      }

      setErrors(prev => ({ ...prev, serialNumber: '' }))
    } catch (err) {
      logger.error('Failed to register device:', err)
      setErrors(prev => ({
        ...prev,
        serialNumber: prev.serialNumber || (err instanceof Error ? err.message : 'We could not register your device. Please try again.')
      }))
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const startKYC = async () => {
    setIsLoading(true)
    setShowKycSupportActions(false)
    try {
      // Store credentials temporarily for automatic login after KYC
      sessionStorage.setItem('onboarding_email', formData.email)
      sessionStorage.setItem('onboarding_password', formData.password)

      logger.log('Starting KYC process with serial number:', formData.serialNumber)
      logger.log('Form data being sent:', {
        serialNumber: formData.serialNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email
      })

      // Validate required fields before making the request
      if (!formData.serialNumber || !formData.firstName || !formData.lastName || !formData.email) {
        const missingFields = []
        if (!formData.serialNumber) missingFields.push('Serial Number')
        if (!formData.firstName) missingFields.push('First Name')
        if (!formData.lastName) missingFields.push('Last Name')
        if (!formData.email) missingFields.push('Email')
        throw new Error(`Missing required information: ${missingFields.join(', ')}. Please go back and complete the previous steps.`)
      }

      const result = await apiService.createConnectAccount({
        serialNumber: formData.serialNumber, // Changed from deviceUuid to serialNumber
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email
      })

      logger.log('CreateConnectAccount response:', result)

      if (result.error) {
        // Log the full error details for debugging
        logger.error('CreateConnectAccount error details:', {
          error: result.error,
          data: result.data
        })
        throw new Error(result.error)
      }

      // Check if we got the new async response format
      if (result.data?.status === 'processing') {
        logger.log('Received processing status, starting polling...')
        // Poll for status until we get the onboarding URL
        await pollForOnboardingUrl()
        return
      }

      // Handle legacy immediate response format
      if (result.data?.onboardingUrl) {
        logger.log('Received immediate onboarding URL, performing full-page navigation...')
        // Use top.location.href to guarantee full-page navigation that escapes SPA context
        // This prevents iOS Safari ITP from blocking hCaptcha due to frame-ancestry restrictions
        if (isIOS) {
          // On iOS, show modal offering new-tab option to avoid WebView restrictions
          setOnboardingUrl(result.data.onboardingUrl)
          setIsLoading(false)
        } else {
          // On desktop/non-iOS, use top.location.href for full-page navigation
          // Fallback to window.location.href if top is unavailable (should never happen in normal contexts)
          if (top) {
            top.location.href = result.data.onboardingUrl
          } else {
            window.location.href = result.data.onboardingUrl
          }
          // Never reaches here due to navigation, but don't set loading to false
        }
        return
      } else {
        logger.error('Unexpected response format:', result.data)
        throw new Error('No onboarding URL received from Stripe')
      }
    } catch (err) {
      logger.error('Failed to start KYC process:', err)
      
      // Extract error message
      const errorMessage = err instanceof Error ? err.message : String(err)
      
      // Show user-friendly error message
      let userMessage = 'We could not start identity verification. '
      if (errorMessage.includes('not found') || errorMessage.includes('Device')) {
        userMessage += 'We could not find your device. Go back and add it again.'
      } else if (errorMessage.includes('already has')) {
        userMessage += 'This device already has a Stripe account. You can proceed to the dashboard.'
      } else if (errorMessage.includes('required') || errorMessage.includes('Missing')) {
        userMessage += errorMessage
      } else if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
        userMessage += 'Invalid request. Please ensure your device was registered successfully and all information is correct.'
      } else {
        userMessage += errorMessage
      }
      
      setErrors(prev => ({ ...prev, general: userMessage }))
      setShowKycSupportActions(true)
      
      setIsLoading(false) // Only set loading to false on error
    }
  }

  const pollForOnboardingUrl = async () => {
    const maxAttempts = 180 // 3 minutes max (increased for Stripe Connect account creation)
    const pollInterval = 1000 // 1 second
    
    logger.log(`Starting polling for device: ${formData.serialNumber}`)
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.log(`Polling for onboarding URL, attempt ${attempt}/${maxAttempts}`)
        
        const statusResult = await apiService.getConnectAccountStatus(formData.serialNumber)
        
        logger.log(`Status response for attempt ${attempt}:`, statusResult)
        
        if (statusResult.error) {
          logger.error('Error polling status:', statusResult.error)
          // If we get an error, wait a bit longer before retrying
          await new Promise(resolve => setTimeout(resolve, pollInterval * 2))
          continue
        }
        
        const status = statusResult.data
        logger.log('Status data:', status)
        
        // Check if we have an onboarding URL
        if (status?.onboardingUrl) {
          logger.log('Onboarding URL received, performing full-page navigation...')
          // Use top.location.href to guarantee full-page navigation that escapes SPA context
          if (isIOS) {
            // On iOS, show modal offering new-tab option to avoid WebView restrictions
            setOnboardingUrl(status.onboardingUrl)
            setIsLoading(false)
          } else {
            // On desktop/non-iOS, use top.location.href for full-page navigation
            // Fallback to window.location.href if top is unavailable (should never happen in normal contexts)
            if (top) {
              top.location.href = status.onboardingUrl
            } else {
              window.location.href = status.onboardingUrl
            }
            // Never reaches here due to navigation
          }
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
          logger.log('Still processing, waiting...')
          
          // After 30 seconds of processing, show a more informative message
          if (attempt === 30) {
            logger.warn('Stripe account creation is taking longer than expected. This may be due to high load or network issues.')
          }
          
          // After 60 seconds, show that this is normal for Stripe Connect
          if (attempt === 60) {
            logger.log('Stripe Connect account creation typically takes 1-3 minutes. Please be patient...')
          }
          
          // After 120 seconds, show final warning
          if (attempt === 120) {
            logger.warn('Stripe Connect account creation is taking longer than usual. This may indicate an issue.')
          }
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        
      } catch (error) {
        logger.error(`Error during polling attempt ${attempt}:`, error)
        
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
      logger.error('Onboarding failed:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Submit the code as soon as all six digits are in
  useEffect(() => {
    if (step === 2 && verificationCode.length === 6 && !isLoading) {
      handleNext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationCode, step])

  const checks = passwordChecks(formData.password)

  const renderStepHeading = (title: string, subtitle: string) => (
    <div className="mb-6">
      <h2 className="text-2xl font-bold text-ink-900">{title}</h2>
      <p className="mt-1 text-ink-500">{subtitle}</p>
    </div>
  )

  const renderAccount = () => (
    <div>
      {renderStepHeading('Create your account', 'This is how you will sign in to your Tipwave portal.')}

      {errors.accountError && step === 1 && (
        <Banner tone="error" title="We could not create your account" className="mb-5">
          {errors.accountError}
        </Banner>
      )}

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="firstName" label="First name" error={errors.firstName}>
            <input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              className={inputClass(!!errors.firstName)}
              value={formData.firstName}
              onChange={handleInputChange}
            />
          </Field>
          <Field id="lastName" label="Last name" error={errors.lastName}>
            <input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              className={inputClass(!!errors.lastName)}
              value={formData.lastName}
              onChange={handleInputChange}
            />
          </Field>
        </div>

        <Field
          id="stageName"
          label="Stage name"
          error={errors.stageName}
          hint="The name your audience sees on your tipping page."
        >
          <input
            id="stageName"
            name="stageName"
            className={inputClass(!!errors.stageName)}
            placeholder="Your artist or performer name"
            value={formData.stageName}
            onChange={handleInputChange}
          />
        </Field>

        <Field id="email" label="Email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            className={inputClass(!!errors.email)}
            placeholder="you@example.com"
            value={formData.email}
            onChange={handleInputChange}
          />
        </Field>

        <Field id="password" label="Password" error={errors.password}>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className={`${inputClass(!!errors.password)} pr-12`}
              value={formData.password}
              onChange={handleInputChange}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute inset-y-0 right-1 flex w-10 items-center justify-center text-sm font-semibold text-brand-700"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {checks.map(c => (
              <li key={c.label} className={`flex items-center gap-2 text-sm ${c.ok ? 'text-green-700' : 'text-ink-500'}`}>
                <BrandIcon name="check" size={14} color={c.ok ? '#15803D' : '#CBD5E1'} strokeWidth={2.4} />
                {c.label}
              </li>
            ))}
          </ul>
        </Field>

        <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword}>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            className={inputClass(!!errors.confirmPassword)}
            value={formData.confirmPassword}
            onChange={handleInputChange}
          />
        </Field>

        <details className="rounded-xl border border-slate-200 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-ink-700">Add a phone number and bio (optional)</summary>
          <div className="mt-4 space-y-5">
            <Field id="phone" label="Phone number" optional error={errors.phone}>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                className={inputClass(!!errors.phone)}
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={handleInputChange}
              />
            </Field>
            <Field id="bio" label="Bio" optional hint="A short line about you, shown on your tipping page.">
              <textarea
                id="bio"
                name="bio"
                rows={3}
                className={`${inputClass(false)} h-auto py-3`}
                value={formData.bio}
                onChange={handleInputChange}
              />
            </Field>
          </div>
        </details>
      </div>
    </div>
  )

  const renderVerify = () => (
    <div>
      {renderStepHeading('Check your email', `We sent a 6-digit code to ${formData.email}.`)}

      <Field id="verificationCode" label="Verification code" error={errors.verificationCode}>
        <input
          id="verificationCode"
          name="verificationCode"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          className={`${inputClass(!!errors.verificationCode)} h-14 text-center font-mono text-2xl tracking-[0.5em]`}
          placeholder="000000"
          value={verificationCode}
          onChange={e => {
            setVerificationCode(e.target.value.replace(/\D/g, ''))
            setErrors(prev => ({ ...prev, verificationCode: '' }))
          }}
        />
      </Field>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={sendVerificationCode}
          disabled={isLoading || resendIn > 0}
          className="font-semibold text-brand-700 disabled:text-ink-400"
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
        </button>
        <button type="button" onClick={handleBack} className="font-semibold text-ink-500 hover:text-ink-700">
          Wrong email? Change it
        </button>
      </div>
      <p className="mt-3 text-sm text-ink-500">Can't find it? Check your spam folder. The code expires in 5 minutes.</p>
    </div>
  )

  const renderDevice = () => (
    <div>
      {renderStepHeading('Add your device', 'Enter the serial number printed on your Tipwave device.')}

      <div className="space-y-5">
        <Field
          id="serialNumber"
          label="Serial number"
          error={errors.serialNumber}
          hint={
            deviceValidationComplete && !errors.serialNumber && formData.serialNumber.trim()
              ? undefined
              : 'It looks like TPY-5C07-K73 and is on the back of the device.'
          }
        >
          <div className="relative">
            <input
              id="serialNumber"
              name="serialNumber"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className={`${inputClass(!!errors.serialNumber)} pr-11 uppercase placeholder:normal-case`}
              placeholder="TPY-5C07-K73"
              value={formData.serialNumber}
              onChange={handleInputChange}
              onBlur={async () => {
                if (formData.serialNumber.trim()) {
                  await validateDetectedDevice()
                }
              }}
            />
            <div className="absolute inset-y-0 right-3 flex items-center">
              {isValidatingDevice && (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              )}
              {!isValidatingDevice && deviceValidationComplete && !errors.serialNumber && formData.serialNumber.trim() && (
                <BrandIcon name="check-circle" size={22} color="#15803D" />
              )}
            </div>
          </div>
          {deviceValidationComplete && !errors.serialNumber && formData.serialNumber.trim() && (
            <p className="mt-1.5 text-sm text-green-700">Device found</p>
          )}
        </Field>

        {deviceConflict && (
          <Banner tone="warning" title="This serial number is already registered">
            {deviceConflict}
          </Banner>
        )}

        <Field id="deviceNickname" label="Nickname" optional hint="Helps you tell devices apart, like Main stage or Bar counter.">
          <input
            id="deviceNickname"
            name="deviceNickname"
            className={inputClass(false)}
            placeholder="Main stage"
            value={formData.deviceNickname}
            onChange={handleInputChange}
          />
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <IconTile name="music" size={40} />
            <div>
              <div className="font-semibold text-ink-900">Let people request songs</div>
              <div className="text-sm text-ink-500">Fans can pick a song when they tip. You can change this any time.</div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={formData.isAllowSongRequest}
            aria-label="Let people request songs"
            onClick={() => setFormData(prev => ({ ...prev, isAllowSongRequest: !prev.isAllowSongRequest }))}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${formData.isAllowSongRequest ? 'bg-brand-700' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${formData.isAllowSongRequest ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </div>
      </div>
    </div>
  )

  const renderPayouts = () => (
    <div>
      {renderStepHeading('Get paid', 'Stripe handles payouts. They will ask you to verify who you are.')}

      {errors.general && (
        <Banner
          tone="error"
          title="We couldn't start identity verification"
          className="mb-5"
          action={
            <Button size="sm" variant="secondary" onClick={startKYC} loading={isLoading}>
              Try again
            </Button>
          }
        >
          {errors.general}
        </Banner>
      )}

      {showKycSupportActions && (
        <Banner
          tone="warning"
          title="Need a hand?"
          className="mb-5"
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate('/login')}>
              Back to sign in
            </Button>
          }
        >
          Call Tipwave Support to finish verification. You can sign in later and pick up where you left off.
        </Banner>
      )}

      <ul className="space-y-3">
        {[
          { icon: 'id-card' as BrandIconName, text: 'A government photo ID' },
          { icon: 'home' as BrandIconName, text: 'Your home address' },
          { icon: 'bank' as BrandIconName, text: 'The bank account where payouts go' }
        ].map(item => (
          <li key={item.text} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
            <IconTile name={item.icon} size={36} />
            <span className="font-medium text-ink-900">{item.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink-500">It takes about 3 minutes. Your details go to Stripe, not Tipwave.</p>

      <details className="mt-5 rounded-xl border border-slate-200 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink-700">Trouble opening Stripe?</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-700">
          <li>Try a private or incognito window</li>
          <li>Turn off ad blockers, VPN and iCloud Private Relay</li>
          <li>On iPhone, turn off Settings → Safari → Prevent Cross-Site Tracking for now</li>
        </ul>
      </details>
    </div>
  )

  const renderFinish = () => (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
        <BrandIcon name="check-circle" size={34} />
      </div>
      <h2 className="text-2xl font-bold text-ink-900">You're all set</h2>
      <p className="mt-1 text-ink-500">Your device is ready to take tips.</p>
    </div>
  )

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderAccount()
      case 2:
        return renderVerify()
      case 3:
        return renderDevice()
      case 4:
        return renderPayouts()
      default:
        return renderFinish()
    }
  }

  const primaryLabel =
    step === 1 ? 'Create account' : step === 2 ? 'Verify' : step === 3 ? 'Add device' : step === 4 ? 'Verify identity with Stripe' : 'Go to your portal'

  const primaryDisabled =
    isLoading ||
    (step === 2 && verificationCode.length < 6) ||
    (step === 3 && (isValidatingDevice || !formData.serialNumber.trim()))

  const onPrimary = step === 4 ? startKYC : step === FINISH_STEP ? handleSubmit : handleNext

  if (!apiKeyGenerated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
          <p className="text-ink-500">Setting things up…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between">
          <img src="/images/logo/tipwave-logo-v2.png" alt="Tipwave" className="h-10 w-auto" />
          <button onClick={() => navigate('/login')} className="text-sm font-semibold text-brand-700">
            Sign in
          </button>
        </header>

        {step === 1 && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-ink-900">Set up Tipwave</h1>
            <p className="mt-1 text-ink-500">About 5 minutes. You'll need your device and a photo ID.</p>
          </div>
        )}

        {/* Phones: a slim progress bar */}
        {step <= STEPS.length && (
          <div className="mb-4 lg:hidden">
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="font-semibold text-ink-900">{STEPS[step - 1].title}</span>
              <span className="text-ink-500">
                Step {step} of {STEPS.length}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200">
              <div
                className="h-1.5 rounded-full bg-brand-600 transition-all duration-300"
                style={{ width: `${(step / STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Desktop: the step list */}
          <aside className="hidden lg:block">
            <ol className="sticky top-6 space-y-5 rounded-2xl bg-white p-6 shadow-card">
              {STEPS.map(s => (
                <li key={s.id} className="flex items-center gap-3">
                  <IconTile name={s.icon} size={40} state={s.id < step ? 'done' : s.id === step ? 'current' : 'upcoming'} />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold ${s.id <= step ? 'text-ink-900' : 'text-ink-500'}`}>{s.title}</p>
                    <p className="text-xs text-ink-500">{s.subtitle}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>

          <main className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              {renderCurrentStep()}

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                {step > 1 && step <= STEPS.length && step !== 2 ? (
                  <Button variant="ghost" onClick={handleBack} icon="chevron-left" disabled={isLoading}>
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                <Button size="lg" onClick={onPrimary} disabled={primaryDisabled} loading={isLoading}>
                  {primaryLabel}
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>

      {onboardingUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-xl font-bold text-ink-900">Open Stripe verification</h3>
            <p className="mt-2 text-ink-500">
              We'll open Stripe in a new tab. iPhones can block the security check when it opens inside this page.
            </p>
            <div className="mt-5 space-y-3">
              <a
                href={onboardingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-700 font-semibold text-white hover:bg-brand-800"
              >
                Open in new tab
              </a>
              <Button
                variant="secondary"
                size="lg"
                block
                onClick={() => {
                  if (onboardingUrl) window.location.href = onboardingUrl
                }}
              >
                Continue here
              </Button>
            </div>
            <button onClick={() => setOnboardingUrl(null)} className="mt-4 text-sm font-semibold text-ink-500 hover:text-ink-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Onboarding
