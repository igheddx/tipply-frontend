import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import Profile from './pages/Profile'
import DeviceRegistration from './pages/DeviceRegistration'
import ManageDevices from './pages/ManageDevices'
import TippingInterface from './pages/TippingInterface'
import StripeReturn from './pages/StripeReturn'
import KYCReturn from './pages/KYCReturn'
import StripeStatus from './pages/StripeStatus'
import Onboarding from './pages/Onboarding'
import DeviceWifiSetup from './pages/DeviceWifiSetup'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/ProtectedRoute'
import QrCardGenerator from './pages/QrCardGenerator'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requiredRole="root_admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/add-device" element={<ProtectedRoute><DeviceRegistration /></ProtectedRoute>} />
        <Route path="/manage-devices" element={<ProtectedRoute><ManageDevices /></ProtectedRoute>} />
        <Route path="/tip/:deviceId" element={<TippingInterface />} />
        <Route path="/device-setup" element={<DeviceWifiSetup />} />
        <Route path="/qr-card" element={<ProtectedRoute><QrCardGenerator /></ProtectedRoute>} />
        <Route path="/stripe-return" element={<StripeReturn />} />
        <Route path="/kyc-return" element={<KYCReturn />} />
        <Route path="/stripe-status" element={<StripeStatus />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster position="top-center" richColors />
    </div>
  )
}

export default App 