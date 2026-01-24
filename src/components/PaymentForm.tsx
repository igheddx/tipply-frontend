import logger from "../utils/logger";
import React, { useState } from 'react'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'

interface PaymentFormProps {
  amount: number
  deviceId: string
  userTemporaryId: string
  onSuccess: () => void
  onCancel: () => void
}

const PaymentForm: React.FC<PaymentFormProps> = ({
  amount,
  deviceId,
  userTemporaryId,
  onSuccess,
  onCancel
}) => {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Create payment intent
      const response = await fetch('/api/tips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId,
          amount,
          currency: 'usd',
          userTemporaryId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create payment')
      }

      const { paymentIntentId } = await response.json()

      // Confirm payment with Stripe
      const { error: confirmError } = await stripe.confirmCardPayment(
        paymentIntentId,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      )

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
      } else {
        onSuccess()
      }
    } catch (err) {
      setError('Payment failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Information
        </label>
        <div className="border border-gray-300 rounded-md p-3">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm text-center">{error}</div>
      )}

      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isLoading}
          className="btn-primary flex-1"
        >
          {isLoading ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
        </button>
      </div>
    </form>
  )
}

export default PaymentForm 