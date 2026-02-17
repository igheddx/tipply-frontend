import { API_BASE_URL } from '../utils/config';
import logger from '../utils/logger';

interface ApiResponse<T> {
  data?: T
  error?: string
  status?: number
  raw?: any
}

class ApiService {
  private refreshPromise: Promise<string | null> | null = null

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useApiKey: boolean = false
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`
    const token = localStorage.getItem('token')
    const apiKey = useApiKey ? localStorage.getItem('xapikeyNoAccessToken') : null

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(apiKey && { 'x-api-key': apiKey }),
        ...options.headers,
      },
      ...options,
    }

    try {
      logger.log(`Making API request to: ${url}`)
      logger.log(`Request config:`, { method: config.method })
      logger.log(`Current hostname: ${window.location.hostname}`)
      logger.log(`API_BASE_URL: ${API_BASE_URL}`)
      logger.log(`Token exists: ${!!token}`)
      logger.log(`UseApiKey: ${useApiKey}`)
      
      const response = await fetch(url, config)
      
      if (response.status === 401) {
        // Try to refresh token (with guard against parallel refreshes)
        const refreshToken = localStorage.getItem('token')
        if (refreshToken) {
          try {
            // If a refresh is already in progress, wait for it
            if (this.refreshPromise) {
              const newToken = await this.refreshPromise
              if (newToken) {
                // Retry with the refreshed token
                const newConfig: RequestInit = {
                  ...config,
                  headers: {
                    ...config.headers,
                    Authorization: `Bearer ${newToken}`,
                  },
                }
                const retryResponse = await fetch(url, newConfig)
                if (retryResponse.ok) {
                  const data = await retryResponse.json()
                  return { data }
                }
              }
            } else {
              // Start a new refresh
              this.refreshPromise = (async () => {
                try {
                  const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
                  })

                  if (refreshResponse.ok) {
                    const refreshData = await refreshResponse.json()
                    const newToken = refreshData.accessToken
                    localStorage.setItem('token', newToken)
                    if (refreshData.refreshToken) {
                      localStorage.setItem('refreshToken', refreshData.refreshToken)
                    }
                    return newToken
                  }
                  return null
                } finally {
                  this.refreshPromise = null
                }
              })()

              const newToken = await this.refreshPromise
              if (newToken) {
                // Retry the original request with new token
                const newConfig: RequestInit = {
                  ...config,
                  headers: {
                    ...config.headers,
                    Authorization: `Bearer ${newToken}`,
                  },
                }

                const retryResponse = await fetch(url, newConfig)
                if (!retryResponse.ok) {
                  const errorData = await retryResponse.json().catch(() => ({}))
                  throw new Error(errorData.error || `HTTP ${retryResponse.status}: ${retryResponse.statusText}`)
                }

                const data = await retryResponse.json()
                return { data }
              }
            }
          } catch (refreshError) {
            logger.error('Token refresh failed:', refreshError)
            return { error: 'Authentication failed while refreshing token.', status: 401, raw: refreshError }
          }
        }
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { error: errorData.error || `HTTP ${response.status}: ${response.statusText}`, status: response.status, raw: errorData }
      }

      const data = await response.json()
      return { data, status: response.status }
    } catch (error) {
      logger.error('API request failed:', error)
      logger.error('Request URL was:', url)
      logger.error('Request config was:', config)
      return { error: error instanceof Error ? error.message : 'Unknown error occurred' }
    }
  }

  // Profile endpoints
  async getProfile(): Promise<ApiResponse<any>> {
    return this.request('/api/profiles/me')
  }

  async updateProfile(profileData: any): Promise<ApiResponse<any>> {
    return this.request('/api/profiles/me', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    })
  }

  async getDashboardStats(): Promise<ApiResponse<any>> {
    return this.request('/api/profiles/dashboard')
  }

  // Device endpoints
  async addDevice(deviceData: { serialNumber: string; nickname?: string; isAllowSongRequest?: boolean }): Promise<ApiResponse<any>> {
    return this.request('/api/devices/add', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    })
  }

  async getDevices(): Promise<ApiResponse<any>> {
    return this.request('/api/devices/my-devices')
  }

  async getDeletedDevices(): Promise<ApiResponse<any>> {
    return this.request('/api/devices/my-deleted-devices')
  }

  async softDeleteDevice(deviceId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/devices/${deviceId}/soft-delete`, {
      method: 'POST',
    })
  }

  async restoreDevice(deviceId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/devices/${deviceId}/restore`, {
      method: 'POST',
    })
  }

  async checkUserStripeSetup(): Promise<ApiResponse<any>> {
    return this.request('/api/devices/check-stripe-setup')
  }

  async getDevice(deviceId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/devices/${deviceId}`)
  }

  async downloadQRCode(deviceId: string): Promise<Blob | null> {
    const token = localStorage.getItem('token')
    const url = `${API_BASE_URL}/api/devices/${deviceId}/qr`

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-cache'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.blob()
    } catch (error) {
      logger.error('Failed to download QR code:', error)
      return null
    }
  }

  // Stripe endpoints
  async createConnectAccount(data: {
    serialNumber: string // Changed from deviceUuid to serialNumber
    firstName: string
    lastName: string
    email: string
  }): Promise<ApiResponse<any>> {
    return this.request('/api/stripe/connect-account', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true) // Use API key for onboarding
  }

  async getConnectAccountStatus(serialNumber: string): Promise<ApiResponse<any>> { // Changed from deviceUuid to serialNumber
    return this.request(`/api/stripe/connect-account/${serialNumber}/status`)
  }

  async createConnectAccountForUser(deviceUuid: string, serialNumber: string): Promise<ApiResponse<any>> {
    logger.log('createConnectAccountForUser called with deviceUuid:', deviceUuid, 'serialNumber:', serialNumber)
    
    // Debug token state before making request
    const token = localStorage.getItem('token')
    logger.log('Token available for createConnectAccountForUser:', !!token)
    logger.log('Token length:', token?.length || 0)
    
    const result = await this.request('/api/stripe/create-connect-account', {
      method: 'POST',
      body: JSON.stringify({ deviceUuid, serialNumber }),
    })
    logger.log('createConnectAccountForUser result:', result)
    return result
  }



  // Auth endpoints
  async login(credentials: { email: string; password: string }): Promise<ApiResponse<any>> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  }

  async register(userData: {
    firstName: string
    lastName: string
    email: string
    password: string
  }): Promise<ApiResponse<any>> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }, true) // Use API key for registration
  }

  async setPassword(password: string, email?: string): Promise<ApiResponse<any>> {
    if (email) {
      // Use onboarding endpoint with API key
      return this.request('/api/auth/set-password-onboarding', {
        method: 'POST',
        body: JSON.stringify({ password, email }),
      }, true) // Use API key for onboarding
    } else {
      // Use authenticated endpoint
      return this.request('/api/auth/set-password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })
    }
  }

  async createProfileOnboarding(profileData: {
    firstName: string
    lastName: string
    stageName?: string
    bio?: string
    email: string
    phone?: string
    password: string
  }): Promise<ApiResponse<any>> {
    return this.request('/api/auth/create-profile-onboarding', {
      method: 'POST',
      body: JSON.stringify(profileData),
    }, true) // Use API key for onboarding
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<any>> {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  // Onboarding-specific endpoints (with API key)
  async registerDeviceOnboarding(deviceData: {
    serialNumber: string // Changed from deviceUuid to serialNumber
    firstName: string
    lastName: string
    stageName?: string
    bio?: string
    email: string
    phone?: string
    nickname?: string
    isAllowSongRequest?: boolean
  }): Promise<ApiResponse<any>> {
    return this.request('/api/devices/register', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    }, true) // Use API key for onboarding
  }

  // Debug endpoint to delete device for testing
  async deleteDeviceDebug(uuid: string): Promise<ApiResponse<any>> {
    return this.request(`/api/devices/debug/${uuid}`, {
      method: 'DELETE',
    }, true) // Use API key for debug endpoint
  }

  // Check if device UUID exists
  async checkDeviceExists(uuid: string): Promise<ApiResponse<any>> {
    return this.request(`/api/devices/check-exists/${uuid}`, {
      method: 'GET',
    }, true) // Use API key for onboarding
  }

  // Check if device UUID exists in DetectedDevices table with status "new"
  async checkDetectedDevice(uuid: string): Promise<ApiResponse<any>> {
    return this.request(`/api/devices/check-detected-device/${uuid}`, {
      method: 'GET',
    }, true) // Use API key for onboarding
  }

  // Check if device SerialNumber exists in DetectedDevices table with status "new"
  async checkDetectedDeviceBySerialNumber(serialNumber: string): Promise<ApiResponse<any>> {
    return this.request(`/api/devices/check-detected-device-serial/${serialNumber}`, {
      method: 'GET',
    }, true) // Use API key for onboarding
  }

  // Tip endpoints
  async submitTip(tipData: {
    deviceId: string
    userId: string
    amount: number
    effect: string
    duration: number
    paymentMethodId?: string
    stripeCustomerId?: string
    simulationBypassSecurity?: boolean
    songId?: string
    requestorName?: string
    note?: string
  }): Promise<ApiResponse<any>> {
    logger.log('🎰 API SERVICE - Submitting tip with data:', tipData)
    const response = await this.request('/api/tips', {
      method: 'POST',
      body: JSON.stringify(tipData),
    })
    logger.log('🎰 API SERVICE - Tip submission response:', response)
    return response
  }

  // Dashboard metrics endpoints
  async getDashboardMetrics(profileId: string, options?: { skipStripe?: boolean }): Promise<ApiResponse<any>> {
    const qs = options?.skipStripe ? `?skipStripe=true` : ''
    return this.request(`/api/tips/dashboard-metrics/${profileId}${qs}`)
  }

  async getRecentTips(profileId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/tips/recent-tips/${profileId}`)
  }

  async getAwsIotStatus(): Promise<ApiResponse<any>> {
    return this.request('/api/tips/aws-iot-status')
  }

  async updateSongRequestSetting(deviceId: string, isAllowSongRequest: boolean): Promise<ApiResponse<any>> {
    return this.request(`/api/devices/${deviceId}/song-request`, {
      method: 'PUT',
      body: JSON.stringify({ isAllowSongRequest })
    })
  }

  async updateDeviceConfiguration(deviceId: string, config: { isSoundEnabled?: boolean, isRandomLightEffect?: boolean, effectConfiguration?: string }): Promise<ApiResponse<any>> {
    return this.request(`/api/devices/${deviceId}/configuration`, {
      method: 'PUT',
      body: JSON.stringify(config)
    })
  }

  // Password reset endpoints (public - no API key required)
  async forgotPassword(email: string): Promise<ApiResponse<any>> {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, false) // No API key required for password reset
  }

  async validateResetCode(email: string, code: string): Promise<ApiResponse<any>> {
    return this.request('/api/auth/validate-reset-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }, false) // No API key required for password reset
  }

  // Onboarding email verification endpoint
  async sendOnboardingVerification(email: string): Promise<ApiResponse<any>> {
    return this.request('/api/auth/onboarding-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, false) // No API key required for onboarding verification
  }

  // Onboarding code validation endpoint
  async validateOnboardingCode(email: string, code: string): Promise<ApiResponse<any>> {
    return this.request('/api/auth/validate-onboarding-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }, false) // No API key required for onboarding verification
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<ApiResponse<any>> {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    }, false) // No API key required for password reset
  }

  // Generic HTTP methods for admin endpoints
  async get(endpoint: string): Promise<ApiResponse<any>> {
    return this.request(endpoint, { method: 'GET' })
  }

  async post(endpoint: string, data?: any): Promise<ApiResponse<any>> {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put(endpoint: string, data?: any): Promise<ApiResponse<any>> {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async uploadProfilePhoto(file: File): Promise<ApiResponse<any>> {
    const url = `${API_BASE_URL}/api/profiles/me/photo`
    const token = localStorage.getItem('token')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      })

      if (response.status === 401) {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          try {
            const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refreshToken }),
            })

            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json()
              localStorage.setItem('token', refreshData.token)
              if (refreshData.refreshToken) {
                localStorage.setItem('refreshToken', refreshData.refreshToken)
              }

              // Retry the original request
              const retryResponse = await fetch(url, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${refreshData.token}`,
                },
                body: formData,
              })

              if (retryResponse.ok) {
                return { data: await retryResponse.json() }
              }
              return { error: 'Failed to upload photo' }
            }
          } catch (refreshError) {
            logger.error('Token refresh failed:', refreshError)
            return { error: 'Authentication failed' }
          }
        }
        return { error: 'Unauthorized' }
      }

      if (response.ok) {
        return { data: await response.json() }
      }

      const errorData = await response.json()
      return { error: errorData.error || 'Failed to upload photo', status: response.status }
    } catch (error) {
      logger.error('Error uploading photo:', error)
      return { error: 'Upload failed' }
    }
  }

  async uploadPerformerProfilePhoto(file: File): Promise<ApiResponse<any>> {
    const token = localStorage.getItem('token')
    const refreshToken = localStorage.getItem('refreshToken')
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    const refreshAuth = async (): Promise<string | null> => {
      if (!refreshToken) return null
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!refreshResponse.ok) return null
        const refreshData = await refreshResponse.json()
        localStorage.setItem('token', refreshData.token)
        if (refreshData.refreshToken) {
          localStorage.setItem('refreshToken', refreshData.refreshToken)
        }
        return refreshData.token as string
      } catch (err) {
        logger.error('Token refresh failed:', err)
        return null
      }
    }

    const performAuthedJsonPost = async (endpoint: string, body: any, customToken?: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(customToken ? { Authorization: `Bearer ${customToken}` } : authHeaders),
      }

      const resp = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
      if (resp.status === 401) {
        const newToken = await refreshAuth()
        if (!newToken) return resp
        return await fetch(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
          },
          body: JSON.stringify(body),
        })
      }
      return resp
    }

    try {
      const extension = file.name.split('.').pop() || 'jpg'

      // 1) Get presigned URL
      const presignResponse = await performAuthedJsonPost('/api/profiles/profile-photo/presigned-url', {
        fileExtension: extension,
      })

      if (!presignResponse.ok) {
        const errorData = await presignResponse.json().catch(() => ({}))
        return { error: errorData.error || 'Failed to get upload URL', status: presignResponse.status }
      }

      const { presignedUrl } = await presignResponse.json()
      if (!presignedUrl) {
        return { error: 'Upload URL missing from response' }
      }

      // 2) Upload directly to S3 using presigned URL
      const s3UploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      })

      if (!s3UploadResponse.ok) {
        return { error: 'Failed to upload file to storage', status: s3UploadResponse.status }
      }

      // 3) Confirm upload with backend
      const imageUrl = presignedUrl.split('?')[0]
      const confirmResponse = await performAuthedJsonPost('/api/profiles/profile-photo/confirm-upload', {
        imageUrl,
      })

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json().catch(() => ({}))
        return { error: errorData.error || 'Failed to confirm upload', status: confirmResponse.status }
      }

      const confirmData = await confirmResponse.json()
      return { data: confirmData }
    } catch (error) {
      logger.error('Error uploading photo via presigned URL:', error)
      return { error: 'Upload failed' }
    }
  }

  async deletePerformerProfilePhoto(): Promise<ApiResponse<any>> {
    const token = localStorage.getItem('token')
    const refreshToken = localStorage.getItem('refreshToken')
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    const refreshAuth = async (): Promise<string | null> => {
      if (!refreshToken) return null
      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!refreshResponse.ok) return null
        const refreshData = await refreshResponse.json()
        localStorage.setItem('token', refreshData.token)
        if (refreshData.refreshToken) {
          localStorage.setItem('refreshToken', refreshData.refreshToken)
        }
        return refreshData.token as string
      } catch (err) {
        logger.error('Token refresh failed:', err)
        return null
      }
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeaders,
      }

      let response = await fetch(`${API_BASE_URL}/api/profiles/profile-photo`, {
        method: 'DELETE',
        headers,
      })

      if (response.status === 401) {
        const newToken = await refreshAuth()
        if (!newToken) return { error: 'Unauthorized' }
        response = await fetch(`${API_BASE_URL}/api/profiles/profile-photo`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
          },
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return { error: errorData.error || 'Failed to delete photo', status: response.status }
      }

      return { data: { success: true } }
    } catch (error) {
      logger.error('Error deleting profile photo:', error)
      return { error: 'Failed to delete photo' }
    }
  }

  async delete(endpoint: string): Promise<ApiResponse<any>> {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

export const apiService = new ApiService()
export default apiService 