import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function Login() {
  const [email, setEmail] = useState('admin@unza.zm');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await api.post('/auth/login', { email, password });
      
      // ✅ CRITICAL FIX: Must match key used in Home.jsx and api.js
      localStorage.setItem('jwt_token', res.data.token);
      
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      const message = error.response
        ? (error.response.data?.error || 'Invalid credentials')
        : 'Cannot reach server. Check your connection and try again.';
      alert('Login failed: ' + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-900">Admin Portal</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-2 font-semibold">Email</label>
            <input 
              type="email" 
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2 font-semibold">Password</label>
            <input 
              type="password" 
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className={`w-full bg-blue-600 text-white p-3 rounded-lg font-semibold transition-colors ${
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </form>
    </div>
  );
}