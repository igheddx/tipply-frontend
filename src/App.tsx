import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import ProtectedRoute from './components/ProtectedRoute'

const Login = lazy(() => import('./pages/Login'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const DeviceRegistration = lazy(() => import('./pages/DeviceRegistration'))
const ManageDevices = lazy(() => import('./pages/ManageDevices'))
const TippingInterface = lazy(() => import('./pages/TippingInterface'))
const StripeReturn = lazy(() => import('./pages/StripeReturn'))
const KYCReturn = lazy(() => import('./pages/KYCReturn'))
const StripeStatus = lazy(() => import('./pages/StripeStatus'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const MonitorPage = lazy(() => import('./pages/MonitorPage'))
const DeviceWifiSetup = lazy(() => import('./pages/DeviceWifiSetup'))
const NotFound = lazy(() => import('./pages/NotFound'))

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requiredRole="root_admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/monitor" element={<ProtectedRoute><MonitorPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/add-device" element={<ProtectedRoute><DeviceRegistration /></ProtectedRoute>} />
          <Route path="/manage-devices" element={<ProtectedRoute><ManageDevices /></ProtectedRoute>} />
          <Route path="/tip/:deviceId" element={<TippingInterface />} />
          <Route path="/device-setup" element={<DeviceWifiSetup />} />
          <Route path="/stripe-return" element={<StripeReturn />} />
          <Route path="/kyc-return" element={<KYCReturn />} />
          <Route path="/stripe-status" element={<StripeStatus />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-center"
        theme="dark"
        toastOptions={{
          style: { background: '#1B2530', color: '#FFFFFF', border: 'none', borderRadius: 16, fontWeight: 600, boxShadow: '0 12px 32px rgba(15,23,42,0.25)' }
        }}
      />
    </div>
  )
}

export default App 