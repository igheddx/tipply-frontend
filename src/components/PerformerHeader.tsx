import logger from "../utils/logger";
import { useState } from 'react'

interface PerformerHeaderProps {
  stageName?: string
  firstName?: string
  lastName?: string
  photoUrl?: string
  message?: string
}

export default function PerformerHeader({ 
  stageName, 
  firstName, 
  lastName, 
  photoUrl,
  message = "You are tipping {name}, let's get your payment ready"
}: PerformerHeaderProps) {
  const [imageError, setImageError] = useState(false)
  
  // Determine display name
  const displayName = stageName || `${firstName || ''} ${lastName || ''}`.trim()
  
  // Replace {name} placeholder in message
  const displayMessage = message.replace('{name}', displayName)
  
  // Check if we should show image
  const showImage = photoUrl && !imageError
  
  return (
    <div className="flex flex-col items-center mb-6">
      {/* Profile Photo */}
      <div className="mb-3">
        {showImage ? (
          <img
            src={photoUrl}
            alt={displayName}
            className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 shadow-lg"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-gray-200 shadow-lg">
            <span className="text-white text-2xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      {/* Message */}
      <p className="text-gray-700 text-center text-sm px-4">
        {displayMessage}
      </p>
    </div>
  )
}
