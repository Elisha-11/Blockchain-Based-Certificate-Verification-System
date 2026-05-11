import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function Login() {
  const [email, setEmail] = useState('admin@unza.zm');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      navigate('/admin/dashboard');
    } catch (error) {
      alert('Login failed: ' + (error.response?.data?.error || 'Invalid credentials'));
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
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 font-semibold"
          >
            Login
          </button>
        </div>
      </form>
    </div>
  );
}