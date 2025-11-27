import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Device } from '../types'
import { FRONTEND_BASE_URL } from '../utils/config'

const ManageDevices: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    fetchDevices()
  }, [])

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/devices')
      if (!response.ok) {
        throw new Error('Failed to fetch devices')
      }
      const data = await response.json()
      setDevices(data)
    } catch (err) {
      setError('Failed to load devices')
    } finally {
      setIsLoading(false)
    }
  }

  const downloadQrCode = async (deviceId: string, deviceName: string) => {
    try {
      const response = await fetch(`/api/devices/${deviceId}/qr`)
      if (!response.ok) {
        throw new Error('Failed to download QR code')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tipply-qr-${deviceName}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download QR code:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading devices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Manage Devices</h1>
            <button
              onClick={() => navigate('/add-device')}
              className="btn-primary"
            >
              Add Device
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {devices.length === 0 ? (
            <div className="card text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No devices found
              </h3>
              <p className="text-gray-500 mb-4">
                Get started by creating your first tipping device
              </p>
              <button
                onClick={() => navigate('/add-device')}
                className="btn-primary"
              >
                Create Device
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {devices.map((device) => (
                <div key={device.id} className="card">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {device.name}
                    </h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        device.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {device.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>ID: {device.id}</p>
                    <p>Created: {new Date(device.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => downloadQrCode(device.id, device.name)}
                      className="btn-secondary w-full"
                    >
                      Download QR Code
                    </button>
                    <button
                      onClick={() => window.open(`${FRONTEND_BASE_URL}/tip/${device.id}`, '_blank')}
                      className="btn-primary w-full"
                    >
                      View Tipping Page
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-secondary"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManageDevices 