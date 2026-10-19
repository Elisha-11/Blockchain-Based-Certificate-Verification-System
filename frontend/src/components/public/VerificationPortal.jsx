import { useState } from 'react';
import axios from 'axios';

const VerificationPortal = () => {
  const [certId, setCertId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [uiConfig, setUiConfig] = useState(null);

  const API_BASE = 'http://127.0.0.1:5000/api';

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!certId.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setUiConfig(null);

    try {
      // 1. Fetch UI configuration for this certificate type (public endpoint)
      const configRes = await axios.get(`${API_BASE}/certificates/${certId.trim()}/presentation`);
      setUiConfig(configRes.data.ui_config);

      // 2. Call verification endpoint (also public)
      const verifyRes = await axios.post(`${API_BASE}/verify`, { cert_id: certId.trim() });
      setResult(verifyRes.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'Verification failed';
      setError(msg);
      
      // If certificate not found, clear UI config
      if (err.response?.status === 404) {
        setUiConfig(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Dynamic status styling based on verification result
  const getStatusStyles = (status) => {
    switch (status) {
      case 'VALID': return 'bg-green-50 border-green-200 text-green-800';
      case 'REVOKED': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'INVALID': return 'bg-red-50 border-red-200 text-red-800';
      case 'NOT_FOUND': return 'bg-gray-50 border-gray-200 text-gray-800';
      default: return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-center mb-2">Certificate Verification</h1>
      <p className="text-center text-gray-600 mb-8">Enter a Certificate ID or scan a QR code to verify authenticity</p>

      {/* Search Form */}
      <form onSubmit={handleVerify} className="flex gap-3 mb-8">
        <input
          type="text"
          placeholder="CERT-XXXXXXXXXXXXX"
          value={certId}
          onChange={(e) => setCertId(e.target.value.toUpperCase())}
          className="flex-1 border rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-500 outline-none"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* Verification Result */}
      {result && uiConfig && (
        <div className={`border-2 rounded-xl p-6 ${getStatusStyles(result.status)}`}>
          {/* Status Header */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">
              {result.status === 'VALID' ? '✅' : 
               result.status === 'REVOKED' ? '⚠️' : 
               result.status === 'INVALID' ? '❌' : '🔍'}
            </span>
            <div>
              <h2 className="text-2xl font-bold">{result.status}</h2>
              <p className="text-sm opacity-80">{result.message}</p>
            </div>
          </div>

          {/* Certificate Details - Type Specific Rendering */}
          <div className="bg-white/50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 uppercase text-xs tracking-wider opacity-70">
              {uiConfig.label} Details
            </h3>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="opacity-70 block text-xs">Student Name</span>
                <span className="font-medium">{result.details.student_name}</span>
              </div>
              <div>
                <span className="opacity-70 block text-xs">Institution</span>
                <span className="font-medium">{result.details.institution_name}</span>
              </div>
              <div>
                <span className="opacity-70 block text-xs">Issue Date</span>
                <span className="font-medium">{result.details.issue_date}</span>
              </div>

              {/* University/Technical Specific Fields */}
              {(uiConfig.template === 'academic_degree' || uiConfig.template === 'diploma_certificate') && (
                <>
                  <div>
                    <span className="opacity-70 block text-xs">Program</span>
                    <span className="font-medium">{result.details.program || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="opacity-70 block text-xs">Classification</span>
                    <span className="font-medium">{result.details.classification || result.details.class_of_degree || 'N/A'}</span>
                  </div>
                </>
              )}

              {/* Grade 12 Specific Fields */}
              {uiConfig.template === 'examination_result' && (
                <>
                  <div>
                    <span className="opacity-70 block text-xs">Candidate Number</span>
                    <span className="font-medium">{result.details.candidate_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="opacity-70 block text-xs">Classification</span>
                    <span className="font-medium">
                      {result.details.classification || 'N/A'}
                      {result.details.aggregate != null && (
                        <span className="opacity-70 font-normal"> (aggregate {result.details.aggregate})</span>
                      )}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="opacity-70 block text-xs mb-1">Subjects & Grades</span>
                    <div className="flex flex-wrap gap-2">
                      {result.details.subjects?.map((subj, idx) => (
                        <span key={idx} className="bg-white px-2 py-1 rounded text-xs font-mono border">
                          {subj.code}: {subj.grade}
                        </span>
                      )) || 'No subjects listed'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Blockchain Verification Proof */}
          {result.verification && (
            <div className="bg-white/50 rounded-lg p-4 text-xs space-y-2">
              <p className="font-semibold uppercase tracking-wider opacity-70 mb-2">Verification Proof</p>
              <div className="flex justify-between">
                <span>Database Hash Match:</span>
                <span className={result.verification.mysql_hash_match ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                  {result.verification.mysql_hash_match ? '✅ Verified' : '❌ Mismatch'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Blockchain Registered:</span>
                <span className={result.verification.blockchain_verified ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                  {result.verification.blockchain_verified ? '✅ On-Chain' : '❌ Not Found'}
                </span>
              </div>
              {result.verification.blockchain_error && (
                <p className="text-red-600 mt-2 pt-2 border-t border-red-200">
                  Blockchain Error: {result.verification.blockchain_error}
                </p>
              )}
            </div>
          )}

          {/* Certificate ID Reference */}
          <div className="mt-4 pt-4 border-t border-current/20 text-center text-xs opacity-60 font-mono">
            {result.cert_id}
          </div>
        </div>
      )}

      {/* Empty State / Instructions */}
      {!result && !error && !loading && (
        <div className="text-center text-gray-400 mt-12">
          <p className="text-6xl mb-4"></p>
          <p>Results will appear here after verification</p>
          <p className="text-sm mt-2">All verifications are logged for audit purposes</p>
        </div>
      )}
    </div>
  );
};

export default VerificationPortal;