import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import DeviceRegistration from './pages/DeviceRegistration'
import ManageDevices from './pages/ManageDevices'
import TippingInterface from './pages/TippingInterface'
import StripeReturn from './pages/StripeReturn'
import KYCReturn from './pages/KYCReturn'
import StripeStatus from './pages/StripeStatus'
import Onboarding from './pages/Onboarding'
import NotFound from './pages/NotFound'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/add-device" element={<DeviceRegistration />} />
        <Route path="/manage-devices" element={<ManageDevices />} />
        <Route path="/tip/:deviceId" element={<TippingInterface />} />
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