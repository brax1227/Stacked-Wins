import axios from 'axios';

// Use Vite proxy in development - requests to /api will be proxied to backend
// In production, use full URL from env variable
// Force relative path in development to use Vite proxy
function normalizeApiBase(raw?: string): string {
  // Defaults:
  // - dev: use Vite proxy at /api
  // - prod: require explicit base URL (or it falls back to localhost)
  if (!raw) return import.meta.env.DEV ? '/api' : 'http://localhost:3001/api';

  const trimmed = raw.replace(/\/+$/, '');
  // Support either:
  // - VITE_API_URL=http://localhost:3001       (we append /api)
  // - VITE_API_URL=http://localhost:3001/api   (already includes /api)
  // - VITE_API_URL=/api                        (use Vite proxy)
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

const API_URL = normalizeApiBase(import.meta.env.VITE_API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Debug: log the full URL being requested
  if (import.meta.env.DEV) {
    const baseURL = config.baseURL || '';
    const url = config.url || '';
    console.log('API Request:', config.method?.toUpperCase(), baseURL + url);
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Debug: log errors in development
    if (import.meta.env.DEV) {
      console.error('API Error:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config?.baseURL + error.config?.url,
        status: error.response?.status,
        message: error.message,
        response: error.response?.data
      });
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
