import { API_BASE_URL } from '../utils/config';

interface ApiResponse<T> {
  data?: T
  error?: string
}

class ApiService {
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
      console.log(`Making API request to: ${url}`)
      console.log(`Request config:`, { method: config.method, headers: config.headers })
      console.log(`Current hostname: ${window.location.hostname}`)
      console.log(`API_BASE_URL: ${API_BASE_URL}`)
      console.log(`Token exists: ${!!token}`)
      console.log(`UseApiKey: ${useApiKey}`)
      console.log(`Authorization header: ${(config.headers as any)?.Authorization}`)
      
      const response = await fetch(url, config)
      
      if (response.status === 401) {
        // Try to refresh token
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
              localStorage.setItem('token', refreshData.accessToken)
              if (refreshData.refreshToken) {
                localStorage.setItem('refreshToken', refreshData.refreshToken)
              }

              // Retry the original request with new token
              const newConfig: RequestInit = {
                ...config,
                headers: {
                  ...config.headers,
                  Authorization: `Bearer ${refreshData.accessToken}`,
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
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
            // Clear invalid tokens
            localStorage.removeItem('token')
            localStorage.removeItem('refreshToken')
            // Redirect to login
            window.location.href = '/login'
            return { error: 'Authentication expired. Please log in again.' }
          }
        }
      }
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const text = await response.text()
          if (text) {
            try {
              const errorData = JSON.parse(text)
              errorMessage = errorData.error || errorData.message || errorData || errorMessage
            } catch (e) {
              // If JSON parsing fails, use the text directly as error message
              errorMessage = text
            }
          }
        } catch (e) {
          console.error('Error reading error response:', e)
        }
        
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage: errorMessage
        })
        throw new Error(errorMessage)
      }

      const data = await response.json()
      return { data }
    } catch (error) {
      console.error('API request failed:', error)
      console.error('Request URL was:', url)
      console.error('Request config was:', config)
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
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.blob()
    } catch (error) {
      console.error('Failed to download QR code:', error)
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
    console.log('createConnectAccountForUser called with deviceUuid:', deviceUuid, 'serialNumber:', serialNumber)
    
    // Debug token state before making request
    const token = localStorage.getItem('token')
    console.log('Token available for createConnectAccountForUser:', !!token)
    console.log('Token length:', token?.length || 0)
    
    const result = await this.request('/api/stripe/create-connect-account', {
      method: 'POST',
      body: JSON.stringify({ deviceUuid, serialNumber }),
    })
    console.log('createConnectAccountForUser result:', result)
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
  }): Promise<ApiResponse<any>> {
    console.log('🎰 API SERVICE - Submitting tip with data:', tipData)
    const response = await this.request('/api/tips', {
      method: 'POST',
      body: JSON.stringify(tipData),
    })
    console.log('🎰 API SERVICE - Tip submission response:', response)
    return response
  }

  // Dashboard metrics endpoints
  async getDashboardMetrics(profileId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/tips/dashboard-metrics/${profileId}`)
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

  async updateDeviceConfiguration(deviceId: string, config: { isSoundEnabled?: boolean, effectConfiguration?: string }): Promise<ApiResponse<any>> {
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

  async delete(endpoint: string): Promise<ApiResponse<any>> {
    return this.request(endpoint, { method: 'DELETE' })
  }
}

export const apiService = new ApiService()
export default apiService 