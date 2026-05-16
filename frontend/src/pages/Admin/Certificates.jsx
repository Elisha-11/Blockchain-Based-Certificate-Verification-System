import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Search, Eye, Download, RefreshCw } from 'lucide-react';

export default function Certificates() {
  const [certificates, setCertificates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, revoked

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      // Fetch from backend API (you'll need to add this endpoint)
      const res = await api.get('/certificates', {
        params: { 
          search: searchTerm,
          status: filter !== 'all' ? filter : undefined 
        }
      });
      setCertificates(res.data.certificates || res.data);
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
      // Fallback: show empty state
      setCertificates([]);
    }
    setLoading(false);
  };

  const handleView = (cert) => {
    // Open certificate in new tab for printing
    window.open(`/certificate/${cert.cert_id}`, '_blank');
  };

  const handleDownload = (cert) => {
    // Trigger browser print for this certificate
    const printWindow = window.open(`/certificate/${cert.cert_id}`, '_blank');
    printWindow.onload = () => printWindow.print();
  };

  const filteredCerts = certificates.filter(cert => {
    const matchesSearch = 
      cert.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.cert_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.program?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filter === 'all' || cert.status === filter;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-900">Issued Certificates</h2>
        <button 
          onClick={fetchCertificates}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name, ID, or program..."
            className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Certificates Table */}
      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="animate-spin mx-auto text-blue-600" size={32} />
          <p className="mt-4 text-gray-600">Loading certificates...</p>
        </div>
      ) : filteredCerts.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No certificates found. Try adjusting your search.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Certificate ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Student</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Program</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Issue Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCerts.map((cert) => (
                <tr key={cert.cert_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">{cert.cert_id}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{cert.student_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{cert.program}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{cert.issue_date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      cert.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {cert.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <button
                      onClick={() => handleView(cert)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="View Certificate"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleDownload(cert)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Download/Print"
                    >
                      <Download size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}