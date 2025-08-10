// Get API base URL with environment detection
export const getApiBaseUrl = () => {
  // Check for VITE_API_URL environment variable
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  
  if (envUrl) {
    console.log('Using API URL from environment:', envUrl);
    return envUrl;
  }
  
  // Check if we're on the deployed site
  const hostname = window.location.hostname;
  if (hostname.includes('test.tipply.live')) {
    console.log('Detected deployed environment, using AWS API Gateway URL');
    return 'https://uhxejjh8s1.execute-api.us-east-1.amazonaws.com/dev';
  }
  
  // Fallback for local development
  console.log('Using default API URL for local development');
  return 'http://localhost:5000';
};

// Get the current API base URL
export const API_BASE_URL = getApiBaseUrl(); 