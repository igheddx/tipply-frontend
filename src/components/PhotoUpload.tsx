import React, { useState, useRef, useEffect } from 'react'
import { photoSrc } from '../utils/photoUrl'
import apiService from '../services/api'
import { BrandIcon } from './icons/BrandIcons'
import { Banner, Button } from './ui'

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
  const [preview, setPreview] = useState<string | null>(photoSrc(photoUrl) || null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync preview when photoUrl prop changes
  useEffect(() => {
    if (photoUrl) {
      setPreview(photoSrc(photoUrl))
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
    <div className={isOnboarding ? 'flex flex-col items-center gap-4 py-6' : 'flex flex-col gap-4'}>
      <div className={`flex items-center gap-5 ${isOnboarding ? 'flex-col' : 'flex-wrap'}`}>
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-slate-200 bg-slate-100">
          {preview ? (
            <img src={preview} alt="Profile preview" className="h-full w-full object-cover" />
          ) : (
            <BrandIcon name="user" size={40} tone="muted" />
          )}
        </div>

        <div className={`flex flex-wrap items-center gap-3 ${isOnboarding ? 'justify-center' : ''}`}>
          <Button variant="secondary" icon="download" loading={uploading} disabled={isLoading} onClick={handleButtonClick}>
            {uploading ? 'Uploading…' : preview ? 'Change photo' : 'Upload photo'}
          </Button>
          {preview && (
            <Button variant="danger" icon="trash" disabled={uploading || isLoading} onClick={handleRemovePhoto}>
              Remove
            </Button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileSelect}
        disabled={uploading || isLoading}
        className="hidden"
        aria-label="Upload profile photo"
      />

      {error && (
        <Banner tone="error" title="The photo could not be uploaded" onDismiss={() => setError('')}>
          {error}
        </Banner>
      )}
    </div>
  )
}

export default PhotoUpload
