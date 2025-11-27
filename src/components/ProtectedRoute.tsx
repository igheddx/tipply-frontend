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
    // Decode JWT token to get user info
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userRole = payload.role;

    if (userRole === requiredRole) {
      return <>{children}</>;
    } else {
      // User doesn't have required role, redirect to dashboard
      return <Navigate to="/dashboard" replace />;
    }
  } catch (error) {
    console.error('Error decoding token:', error);
    // Invalid token, redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    return <Navigate to="/login" replace />;
  }
};

export default ProtectedRoute;

