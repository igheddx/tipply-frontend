import logger from './logger';

// Get API base URL with environment detection
export const getApiBaseUrl = () => {
  // Check for VITE_API_URL environment variable
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  
  if (envUrl) {
    logger.log('Using API URL from environment:', envUrl);
    return envUrl;
  }
  
  // Check if we're on the deployed site
  const hostname = window.location.hostname;
  
  // Production site (app.tipwave.live) uses prod API stage
  if (hostname.includes('app.tipwave.live')) {
    logger.log('Detected production environment (app.tipwave.live), using /prod API stage');
    return 'https://uhxejjh8s1.execute-api.us-east-1.amazonaws.com/prod';
  }
  
  // Test/dev site (apptest.tipwave.live) uses dev API stage
  if (hostname.includes('apptest.tipwave.live')) {
    logger.log('Detected test environment (apptest.tipwave.live), using /dev API stage');
    return 'https://uhxejjh8s1.execute-api.us-east-1.amazonaws.com/dev';
  }
  
  // Legacy app.tipwave.live redirect (if still in use)
  if (hostname.includes('app.tipwave.live')) {
    logger.log('Detected legacy deployed environment, using AWS API Gateway /dev URL');
    return 'https://uhxejjh8s1.execute-api.us-east-1.amazonaws.com/dev';
  }
  
  // Fallback for local development
  logger.log('Using default API URL for local development');
  return 'http://localhost:5000'; // Temporarily force local backend for development
};

// Get Frontend base URL with environment detection
export const getFrontendBaseUrl = () => {
  // Check for VITE_FRONTEND_URL environment variable
  const envUrl = (import.meta as any).env?.VITE_FRONTEND_URL;
  
  if (envUrl) {
    logger.log('Using Frontend URL from environment:', envUrl);
    return envUrl;
  }
  
  // Check if we're on the deployed site
  const hostname = window.location.hostname;
  if (hostname.includes('app.tipwave.live') || hostname.includes('tipwave.live')) {
    logger.log('Detected deployed environment, using production URL');
    return `https://${hostname}`;
  }
  
  // For local development, use the current origin (which should be port 3001)
  logger.log('Using current origin for local development:', window.location.origin);
  return window.location.origin;
};

// Get the current API base URL
export const API_BASE_URL = getApiBaseUrl();

// Get the current Frontend base URL  
export const FRONTEND_BASE_URL = getFrontendBaseUrl(); 