import React, { useState, useRef } from 'react'

interface TipAmountProps {
  onAmountSelect: (amount: number) => void
}

const TipAmount: React.FC<TipAmountProps> = ({ onAmountSelect }) => {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const tipAmounts = [1, 5, 10, 20, 50, 100]

  const handleAmountClick = (amount: number) => {
    setSelectedAmount(amount)
    setIsAnimating(true)
    
    // Add flying animation
    setTimeout(() => {
      onAmountSelect(amount)
      setIsAnimating(false)
    }, 500)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY
    }

    const deltaX = touchEnd.x - touchStartRef.current.x
    const deltaY = touchEnd.y - touchStartRef.current.y

    // Minimum swipe distance
    const minSwipeDistance = 50

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      // Horizontal swipe
      if (deltaX > 0) {
        // Swipe right - quick tip
        handleQuickTip()
      }
    } else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > minSwipeDistance) {
      // Vertical swipe
      if (deltaY < 0) {
        // Swipe up - quick tip
        handleQuickTip()
      }
    }
  }

  const handleQuickTip = () => {
    // Quick tip with default amount
    handleAmountClick(5)
  }

  const getCurrencyImage = (amount: number) => {
    const images = {
      1: '/images/1dollar.png',
      5: '/images/5dollars.png',
      10: '/images/10dollars.png',
      20: '/images/20dollars.png',
      50: '/images/50dollars.png',
      100: '/images/100dollars.png'
    }
    return images[amount as keyof typeof images] || '/images/1dollar.png'
  }

  return (
    <div 
      className="max-w-2xl mx-auto"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="text-center text-white mb-8">
        <h2 className="text-3xl font-bold mb-4">Choose Tip Amount</h2>
        <p className="text-lg opacity-90">Tap an amount or swipe to tip quickly</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {tipAmounts.map((amount) => (
          <div
            key={amount}
            className={`relative cursor-pointer transition-all duration-300 transform hover:scale-105 ${
              selectedAmount === amount ? 'scale-110' : ''
            } ${isAnimating && selectedAmount === amount ? 'animate-bounce-in' : ''}`}
            onClick={() => handleAmountClick(amount)}
          >
            <div className="bg-white rounded-lg shadow-lg p-4 text-center">
              <img
                src={getCurrencyImage(amount)}
                alt={`$${amount}`}
                className="w-24 h-24 mx-auto mb-2 object-contain"
                onError={(e) => {
                  // Fallback to text if image fails to load
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.nextElementSibling?.classList.remove('hidden')
                }}
              />
              <div className={`text-2xl font-bold text-gray-800 ${selectedAmount === amount ? 'hidden' : ''}`}>
                ${amount}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center mt-8">
        <p className="text-white opacity-75 text-sm">
          💡 Swipe up or right for a quick $5 tip
        </p>
      </div>
    </div>
  )
}

export default TipAmount 