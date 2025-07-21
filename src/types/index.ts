export interface Device {
  id: string;
  uuid: string;
  name: string;
  ownerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tip {
  id: string;
  deviceId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  stripePaymentIntentId?: string;
  userTemporaryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StripeSetupIntent {
  id: string;
  client_secret: string;
  status: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
} 