// Get API base URL from environment variable with fallback
const getApiBaseUrl = () => {
  // Check for VITE_API_URL environment variable
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  
  if (envUrl) {
    console.log('Using API URL from environment:', envUrl);
    return envUrl;
  }
  
  // Fallback for local development
  console.log('Using default API URL for local development');
  return 'http://localhost:5000';
};

const API_BASE_URL = getApiBaseUrl();

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
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return { data }
    } catch (error) {
      console.error('API request failed:', error)
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
  async addDevice(deviceData: { deviceUuid: string; nickname?: string }): Promise<ApiResponse<any>> {
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
    deviceUuid: string
    firstName: string
    lastName: string
    email: string
  }): Promise<ApiResponse<any>> {
    return this.request('/api/stripe/connect-account', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true) // Use API key for onboarding
  }

  async getConnectAccountStatus(deviceUuid: string): Promise<ApiResponse<any>> {
    return this.request(`/api/stripe/connect-account/${deviceUuid}/status`)
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
    deviceUuid: string
    firstName: string
    lastName: string
    email: string
    phone?: string
    nickname?: string
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

  // Tip endpoints
  async submitTip(tipData: {
    deviceId: string
    userId: string
    amount: number
    effect: string
    duration: number
  }): Promise<ApiResponse<any>> {
    return this.request('/api/tips', {
      method: 'POST',
      body: JSON.stringify(tipData),
    })
  }

  // Dashboard metrics endpoints
  async getDashboardMetrics(profileId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/tips/dashboard-metrics/${profileId}`)
  }

  async getRecentTips(profileId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/tips/recent-tips/${profileId}`)
  }
}

export const apiService = new ApiService()
export default apiService 