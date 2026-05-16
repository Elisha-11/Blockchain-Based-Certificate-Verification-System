import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Issue from './Issue';
import Certificates from './Certificates';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('issue'); // 'issue' or 'list'

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-blue-900">Admin Dashboard</h1>
        <div className="flex gap-3">
          <button 
            onClick={() => setActiveTab('issue')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              activeTab === 'issue' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Issue Certificate
          </button>
          <button 
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              activeTab === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            View Certificates
          </button>
          <button 
            onClick={handleLogout} 
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
      
      {activeTab === 'issue' ? <Issue /> : <Certificates />}
    </div>
  );
}