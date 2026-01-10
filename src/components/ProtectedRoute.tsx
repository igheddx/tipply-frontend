import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const location = useLocation();
  const token = localStorage.getItem('token');
  
  // Check if user is authenticated
  if (!token) {
    // Redirect to login with return URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If no specific role is required, just check authentication
  if (!requiredRole) {
    return <>{children}</>;
  }

  // Check if user has the required role
  try {
    const segment = token.split('.')[1];
    // base64url decode helper
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    const userRole = payload.role;

    if (userRole === requiredRole) {
      return <>{children}</>;
    } else {
      // User doesn't have required role, redirect to dashboard
      return <Navigate to="/dashboard" replace />;
    }
  } catch (error) {
    console.error('Error decoding token:', error);
    // Do not clear tokens or force logout due to decode issues; allow page to render
    return <>{children}</>;
  }
};

export default ProtectedRoute;


