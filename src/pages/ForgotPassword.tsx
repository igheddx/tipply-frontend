import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [strengthScore, setStrengthScore] = useState(0);
  const [strengthLevel, setStrengthLevel] = useState('');
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false });

  // Calculate password strength in real-time
  const calculatePasswordStrength = (password: string) => {
    if (!password) {
      setStrengthScore(0);
      setStrengthLevel('');
      return;
    }

    let score = 0;
    
    // Length bonus (up to 25 points)
    if (password.length >= 10) score += 25;
    else if (password.length >= 8) score += 15;
    else if (password.length >= 6) score += 10;
    
    // Character variety bonus (up to 40 points)
    if (/[a-z]/.test(password)) score += 10;
    if (/[A-Z]/.test(password)) score += 10;
    if (/[0-9]/.test(password)) score += 10;
    if (/[^A-Za-z0-9]/.test(password)) score += 10;
    
    // Entropy bonus (up to 35 points)
    const uniqueChars = new Set(password).size;
    score += Math.min(35, uniqueChars * 2);
    
    setStrengthScore(Math.min(100, score));
    
    if (score >= 80) setStrengthLevel('Very Strong');
    else if (score >= 60) setStrengthLevel('Strong');
    else if (score >= 40) setStrengthLevel('Medium');
    else if (score >= 20) setStrengthLevel('Weak');
    else setStrengthLevel('Very Weak');
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await apiService.forgotPassword(email);
      if (result.data?.message) {
        setMessage('Verification code sent! Please check your email.');
        setStep('code');
      } else {
        setError(result.error || 'Failed to send verification code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await apiService.validateResetCode(email, code);
      if (result.data?.message) {
        setStep('password');
      } else {
        setError(result.data?.error || 'Invalid verification code');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 10) {
      setError('Password must be at least 10 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await apiService.resetPassword(email, code, newPassword);
      if (result.data?.message) {
        setMessage('Password reset successfully! Redirecting to login...');
        // Store message in sessionStorage as backup
        sessionStorage.setItem('password_reset_message', 'Password reset successfully! You can now log in with your new password.');
        setTimeout(() => {
          navigate('/login', { 
            state: { 
              message: 'Password reset successfully! You can now log in with your new password.' 
            } 
          });
        }, 2000);
      } else {
        setError(result.data?.error || 'Failed to reset password');
        if (result.data?.validationErrors) {
          setError(result.data.validationErrors.join(', '));
        }
      }
      if (result.data?.strengthScore !== undefined) {
        setStrengthScore(result.data.strengthScore);
        setStrengthLevel(result.data.strengthLevel || '');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-32 h-32 overflow-visible rounded-2xl mb-4">
            <img 
              src="/images/tipply_logo.png" 
              alt="Tipply Logo" 
              className="w-full h-full object-contain"
              style={{ transform: 'scale(1.25)', objectPosition: 'center' }}
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Reset Your Password
          </h2>
          <p className="text-gray-600">
            {step === 'email' && 'Enter your email to receive a verification code'}
            {step === 'code' && 'Enter the verification code sent to your email'}
            {step === 'password' && 'Create your new password'}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-red-600 text-sm">{error}</span>
              </div>
            </div>
          )}

          {message && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-600 text-sm">{message}</span>
              </div>
            </div>
          )}

          {/* Step 1: Email Input */}
          {step === 'email' && (
            <form onSubmit={handleRequestCode} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold py-3 px-4 rounded-lg hover:from-primary-700 hover:to-primary-800 focus:ring-4 focus:ring-primary-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </div>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </form>
          )}

          {/* Step 2: Code Input */}
          {step === 'code' && (
            <form onSubmit={handleValidateCode} className="space-y-6">
              <div>
                <label htmlFor="code" className="block text-sm font-semibold text-gray-700 mb-2">
                  Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <input
                    id="code"
                    name="code"
                    type="text"
                    autoComplete="off"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 text-center text-lg tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Enter the 6-digit code sent to your email
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold py-3 px-4 rounded-lg hover:from-primary-700 hover:to-primary-800 focus:ring-4 focus:ring-primary-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Validating...</span>
                  </div>
                ) : (
                  'Verify Code'
                )}
              </button>
            </form>
          )}

          {/* Step 3: New Password Input */}
          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPasswords.new ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      calculatePasswordStrength(e.target.value);
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => ({ ...prev, new: !prev.new }))}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPasswords.new ? 'Hide password' : 'Show password'}
                  >
                    {showPasswords.new ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-.88.21-1.715.58-2.47m3.15-3.15A9.956 9.956 0 0112 5c5 0 9 4 9 7 0 1.07-.34 2.07-.94 3m-3.28 3.28L4.22 4.22" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Password Strength:</span>
                      <span className={`font-medium ${getStrengthColor(strengthScore)}`}>
                        {strengthLevel}
                      </span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(strengthScore).replace('text-', 'bg-')}`}
                        style={{ width: `${strengthScore}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-sm text-gray-500">
                  Must be at least 10 characters long
                </p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPasswords.confirm ? 'Hide password' : 'Show password'}
                  >
                    {showPasswords.confirm ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7 0-.88.21-1.715.58-2.47m3.15-3.15A9.956 9.956 0 0112 5c5 0 9 4 9 7 0 1.07-.34 2.07-.94 3m-3.28 3.28L4.22 4.22" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold py-3 px-4 rounded-lg hover:from-primary-700 hover:to-primary-800 focus:ring-4 focus:ring-primary-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Resetting...</span>
                  </div>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}

          {/* Navigation Buttons */}
          <div className="mt-6 space-y-3">
            {step === 'code' && (
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200 text-sm"
              >
                ← Back to Email
              </button>
            )}
            
            {step === 'password' && (
              <button
                type="button"
                onClick={() => setStep('code')}
                className="w-full text-primary-600 hover:text-primary-700 font-medium transition-colors duration-200 text-sm"
              >
                ← Back to Code
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full text-gray-600 hover:text-gray-700 font-medium transition-colors duration-200 text-sm"
            >
              ← Back to Login
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Secure • Fast • Reliable
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword; 
