import { useState } from 'react';
import api from '../services/api';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';

export default function Verify() {
  const [certId, setCertId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    
    try {
      const res = await api.post('/verify', { cert_id: certId });
      setResult(res.data);
    } catch (error) {
      setResult({ 
        valid: false, 
        status: 'ERROR', 
        message: error.response?.data?.error || 'Verification failed' 
      });
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:p-8">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-800 text-center">
            Verify Academic Certificate
          </h1>
          <p className="text-gray-600 mb-6 text-center text-sm sm:text-base">
            Enter the Certificate ID to confirm its authenticity
          </p>
          
          <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3 mb-8">
            <input 
              type="text" 
              placeholder="e.g. CERT-1712345678-ABC123" 
              className="flex-1 p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
              value={certId}
              onChange={(e) => setCertId(e.target.value)}
              required
            />
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 transition shadow-md active:scale-95 text-sm sm:text-base"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify'}
            </button>
          </form>

          {result && (
            <div className={`p-4 sm:p-6 rounded-lg border-l-4 ${
              result.valid ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                {result.valid ? (
                  <ShieldCheck className="text-green-600 flex-shrink-0" size={28} />
                ) : (
                  <AlertTriangle className="text-red-600 flex-shrink-0" size={28} />
                )}
                <h2 className={`text-xl sm:text-2xl font-bold ${
                  result.valid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {result.valid ? 'Certificate Valid ✓' : 'Invalid / Not Found '}
                </h2>
              </div>
              <p className="mb-4 text-gray-700 text-sm sm:text-base">{result.message}</p>
              
              {result.valid && result.details && (
                <div className="bg-white p-4 rounded-lg shadow-sm space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-semibold text-gray-600">Student:</span>
                      <p className="text-gray-900 font-medium">{result.details.student_name}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Program:</span>
                      <p className="text-gray-900 font-medium">{result.details.program}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Issue Date:</span>
                      <p className="text-gray-900 font-medium">{result.details.issue_date}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-600">Blockchain:</span>
                      <p className="text-green-600 font-bold flex items-center gap-1">
                        <ShieldCheck size={14} /> Anchored on Ethereum
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-gray-200 text-xs text-gray-500 break-all">
                    <span className="font-semibold">Verification Hash:</span> 
                    <span className="ml-2 font-mono">{result.details.cert_hash_preview}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}