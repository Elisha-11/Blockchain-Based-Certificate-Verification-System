import axios from 'axios';

// VITE_API_BASE_URL lets the same build talk to a different backend depending on
// where it's loaded from: a hardcoded 'localhost' only ever resolves to the device
// the browser itself is running on, so a phone (or a deployed frontend) scanning a
// QR code would try to reach itself, not the server. Set it in frontend/.env(.local)
// for LAN testing (your machine's LAN IP) or in the hosting platform's env vars for
// a real deployment (your deployed backend URL). Falls back to localhost for local dev.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
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