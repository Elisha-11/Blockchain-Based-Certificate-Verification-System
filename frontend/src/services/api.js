import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Add token to requests automatically
api.interceptors.request.use((config) => {
  // Must match key used in Login.jsx and Home.jsx
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;