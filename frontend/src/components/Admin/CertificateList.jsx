import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // ✅ ADDED IMPORT
import axios from 'axios';

const CertificateList = () => {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [institutionName, setInstitutionName] = useState('My Institution');
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  const API_BASE = 'http://127.0.0.1:5000/api';
  const token = localStorage.getItem('jwt_token');

  const fetchCerts = async (page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setInstitutionName(payload.full_name || payload.institution_id || 'My Institution');
      }
    } catch (e) {
      console.error('Failed to decode JWT for institution name:', e);
    }

    try {
      const params = new URLSearchParams({
        page,
        limit: pagination.limit,
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const res = await axios.get(`${API_BASE}/certificates/my-institution?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const certificates = res.data?.certificates || [];
      setCerts(certificates);
      setPagination(prev => ({ ...prev, ...res.data.pagination, page }));

      if (certificates.length > 0 && certificates[0].institution_name) {
        setInstitutionName(certificates[0].institution_name);
      }
      
      console.log('Certificates loaded:', certificates.length);
    } catch (err) {
      console.error('Fetch failed:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Failed to load certificates');
      setCerts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchCerts(1); 
  }, [search, statusFilter]);

  const handleRetry = async (certId) => {
    if (!window.confirm('Retry blockchain registration for this certificate?')) return;
    setActionLoading(certId);
    try {
      await axios.post(`${API_BASE}/certificates/${certId}/retry-blockchain`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Blockchain retry initiated successfully');
      fetchCerts(pagination.page);
    } catch (err) {
      alert(err.response?.data?.error || 'Retry failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (certId) => {
    const reason = prompt('Enter revocation reason (min 10 chars):');
    if (!reason || reason.trim().length < 10) {
      alert('Revocation reason must be at least 10 characters');
      return;
    }
    setActionLoading(certId);
    try {
      await axios.post(`${API_BASE}/certificates/${certId}/revoke`, 
        { reason: reason.trim() }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Certificate revoked successfully');
      fetchCerts(pagination.page);
    } catch (err) {
      alert(err.response?.data?.error || 'Revocation failed');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      pending_blockchain: 'bg-yellow-100 text-yellow-800',
      blockchain_failed: 'bg-red-100 text-red-800',
      revoked: 'bg-gray-100 text-gray-800',
      suspended: 'bg-orange-100 text-orange-800'
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.active}`;
  };

  const getSubjectCount = (metadata) => {
    try {
      const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      return parsed?.subjects?.length || 0;
    } catch {
      return 0;
    }
  };

  if (loading && certs.length === 0) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">{institutionName} Certificates</h2>
      
      <div className="flex gap-4 mb-6">
        <input 
          placeholder="Search by name, ID, or program..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border rounded p-2"
        />
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded p-2"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending_blockchain">Pending Blockchain</option>
          <option value="blockchain_failed">Blockchain Failed</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}

      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-3">Student</th>
              <th className="p-3">Type</th>
              <th className="p-3">Program/Subjects</th>
              <th className="p-3">Status</th>
              <th className="p-3">Issued</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {certs.map((cert) => (
              <tr key={cert.cert_id} className="border-b hover:bg-gray-50">
                {/* ✅ UPDATED STUDENT COLUMN WITH CLICKABLE LINK */}
                <td className="p-3">
                  <Link 
                    to={`/admin/certificates/${cert.cert_id}`}
                    className="group flex flex-col"
                  >
                    <span className="font-medium text-blue-900 group-hover:text-blue-700 group-hover:underline transition-colors">
                      {cert.student_name}
                    </span>
                    <span className="text-xs text-gray-500">{cert.cert_id.substring(0, 12)}...</span>
                  </Link>
                </td>
                
                <td className="p-3 capitalize">{cert.certificate_type.replace('_', ' ')}</td>
                <td className="p-3 text-sm">
                  {cert.certificate_type === 'grade12' 
                    ? `${cert.candidate_number} - ${getSubjectCount(cert.metadata)} subjects`
                    : cert.program || 'N/A'}
                </td>
                <td className="p-3"><span className={getStatusBadge(cert.status)}>{cert.status.replace('_', ' ')}</span></td>
                <td className="p-3 text-sm">{cert.issue_date}</td>
                <td className="p-3 space-x-2">
                  {cert.status === 'blockchain_failed' && (
                    <button 
                      onClick={() => handleRetry(cert.cert_id)}
                      disabled={actionLoading === cert.cert_id}
                      className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                    >
                      {actionLoading === cert.cert_id ? 'Retrying...' : 'Retry Blockchain'}
                    </button>
                  )}
                  {cert.status === 'active' && (
                    <button 
                      onClick={() => handleRevoke(cert.cert_id)}
                      disabled={actionLoading === cert.cert_id}
                      className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                    >
                      {actionLoading === cert.cert_id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {certs.length === 0 && !loading && (
              <tr><td colSpan="6" className="p-6 text-center text-gray-500">No certificates found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button 
            onClick={() => fetchCerts(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <button 
            onClick={() => fetchCerts(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default CertificateList;