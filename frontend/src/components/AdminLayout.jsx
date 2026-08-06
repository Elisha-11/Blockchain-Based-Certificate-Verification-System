import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { getInstitutionDetails } from '../services/institutionService';

export default function AdminLayout() {
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user?.institution_id) {
      getInstitutionDetails(user.institution_id).then((data) => {
        setInstitution(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading institution details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dynamic Header */}
      <header className="bg-blue-900 text-white p-4 shadow-md">
        <div className="flex items-center gap-4 max-w-7xl mx-auto">
          <img
            src={institution?.logo_url || '/default-logo.png'}
            alt={institution?.name || 'Institution'}
            className="h-12 w-12 rounded-full border-2 border-yellow-600 object-cover bg-white"
          />
          <div>
            <h1 className="text-xl font-bold">{institution?.name || 'Unknown Institution'}</h1>
            <p className="text-xs opacity-80">Academic Credential Registry</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}