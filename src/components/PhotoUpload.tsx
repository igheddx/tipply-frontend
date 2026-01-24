import logger from "../utils/logger";
import React, { useState, useRef, useEffect } from 'react'
import apiService from '../services/api'

interface PhotoUploadProps {
  photoUrl?: string
  onPhotoChange?: (photoUrl: string) => void
  isLoading?: boolean
  variant?: 'onboarding' | 'profile'
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
  photoUrl,
  onPhotoChange,
  isLoading = false,
  variant = 'profile'
}) => {
  const [preview, setPreview] = useState<string | null>(photoUrl || null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync preview when photoUrl prop changes
  useEffect(() => {
    if (photoUrl) {
      setPreview(photoUrl)
    }
  }, [photoUrl])

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png']
    const maxSize = 2 * 1024 * 1024 // 2MB

    if (!allowedTypes.includes(file.type)) {
      return 'Only JPEG and PNG images are allowed'
    }

    if (file.size > maxSize) {
      return 'File size must be less than 2MB'
    }

    return null
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Clear previous error
    setError('')

    // Validate file
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
    }
    reader.readAsDataURL(file)

    // Upload file
    handleUpload(file)
  }

  const handleUpload = async (file: File) => {
    try {
      setUploading(true)
      setError('')

      const response = await apiService.uploadPerformerProfilePhoto(file)

      if (response.error) {
        setError(response.error)
        setPreview(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      // Success - update profile photo URL
      const newUrl = response.data?.imageUrl || response.data?.profilePhotoUrl
      if (newUrl) {
        setPreview(newUrl)
        if (onPhotoChange) {
          onPhotoChange(newUrl)
        }
      }
    } catch (err) {
      setError('Failed to upload photo')
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleRemovePhoto = async () => {
    try {
      setUploading(true)
      setError('')
      
      // Delete from S3 via backend
      const response = await apiService.deletePerformerProfilePhoto()
      
      if (response.error) {
        setError('Failed to delete photo')
        return
      }
      
      // Clear preview and callback
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (onPhotoChange) {
        onPhotoChange('')
      }
    } catch (err) {
      setError('Failed to delete photo')
    } finally {
      setUploading(false)
    }
  }

  const isOnboarding = variant === 'onboarding'

  return (
    <div className={`flex flex-col items-center gap-4 ${isOnboarding ? 'py-6' : ''}`}>
      {/* Photo Preview Circle */}
      <div className="relative w-fit">
        <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-gray-300">
          {preview ? (
            <img
              src={preview}
              alt="Profile preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-4xl text-gray-400">📸</div>
          )}
        </div>

        {/* Delete Badge - positioned outside circle */}
        {preview && (
          <button
            onClick={handleRemovePhoto}
            disabled={uploading || isLoading}
            className="absolute top-0 right-0 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg transition -translate-y-1 translate-x-1"
            title="Remove photo"
          >
            ✕
          </button>
        )}
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileSelect}
        disabled={uploading || isLoading}
        className="hidden"
        aria-label="Upload profile photo"
      />

      {/* Upload Button */}
      <button
        onClick={handleButtonClick}
        disabled={uploading || isLoading}
        className="px-6 py-2 bg-tipwave-teal hover:bg-teal-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition"
      >
        {uploading ? (
          <span className="flex items-center gap-2">
            <span className="inline-block animate-spin">⏳</span>
            Uploading...
          </span>
        ) : preview ? (
          'Change Photo'
        ) : (
          'Upload Photo'
        )}
      </button>

      {/* Helper Text */}
      <p className="text-sm text-gray-600 text-center">
        JPEG or PNG • Max 2MB
      </p>

      {/* Error Message */}
      {error && (
        <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}

export default PhotoUpload
