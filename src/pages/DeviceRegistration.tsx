import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const DeviceRegistration: React.FC = () => {
  const [deviceName, setDeviceName] = useState('')
  const [allowSongRequests, setAllowSongRequests] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation for required song request selection
    if (allowSongRequests === null) {
      setError('Please select whether you want to enable song requests from your audience.')
      return
    }
    
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: deviceName,
          isAllowSongRequest: allowSongRequests,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create device')
      }

      const data = await response.json()
      setSuccess('Device created successfully!')
      setQrCodeUrl(`/api/devices/${data.id}/qr`)
    } catch (err) {
      setError('Failed to create device. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Register New Device
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Create a new tipping device
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700">
              Device Name
            </label>
            <input
              id="deviceName"
              type="text"
              required
              className="input-field mt-1"
              placeholder="Enter device name"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Would you like to enable song requests from your audience? *
            </label>
            <p className="text-sm text-gray-500 mb-4">
              If you select "Yes", you'll be able to create a song catalog for your audience to choose from once you're logged in. This allows your audience to request specific songs when they tip you.
            </p>
            <div className="space-y-2">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="allowSongRequests"
                  checked={allowSongRequests === true}
                  onChange={() => setAllowSongRequests(true)}
                  className="mr-3 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                />
                <span className="text-sm text-gray-700">Yes, enable song requests</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="allowSongRequests"
                  checked={allowSongRequests === false}
                  onChange={() => setAllowSongRequests(false)}
                  className="mr-3 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                />
                <span className="text-sm text-gray-700">No, disable song requests</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

          {success && (
            <div className="text-green-600 text-sm text-center">{success}</div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? 'Creating...' : 'Create Device'}
          </button>
        </form>

        {qrCodeUrl && (
          <div className="mt-8 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              QR Code for Device
            </h3>
            <div className="bg-white p-4 rounded-lg shadow">
              <img
                src={qrCodeUrl}
                alt="Device QR Code"
                className="mx-auto"
                style={{ maxWidth: '200px' }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Scan this QR code to access the tipping interface
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-secondary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeviceRegistration 