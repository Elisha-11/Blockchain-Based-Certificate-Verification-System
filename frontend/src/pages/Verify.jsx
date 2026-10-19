import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { extractCertificateFromFile } from '../utils/documentScanner';
import { ShieldCheck, AlertTriangle, Loader2, Building2, Upload, FileText, Keyboard, Award } from 'lucide-react';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const [certId, setCertId] = useState(searchParams.get('id') || '');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  // 'id' = type the certificate number, 'upload' = hand over the document.
  const [mode, setMode] = useState('id');
  const [scannedFile, setScannedFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const runVerification = useCallback(async (id, context = {}) => {
    setLoading(true);
    setResult(null);

    try {
      const res = await api.post('/verify', {
        cert_id: id,
        // Recorded in the registry's verification log so the regulator can
        // tell a typed check from an uploaded document.
        verification_method: context.verification_method || 'id',
        ...(context.document_sha256 ? { document_sha256: context.document_sha256 } : {})
      });
      setResult(res.data);
    } catch (error) {
      setResult({
        valid: false,
        status: 'ERROR',
        message: error.response?.data?.error || 'Verification failed. Please check the ID and try again.'
      });
    }
    setLoading(false);
  }, []);

  /**
   * Reads the certificate id out of the dropped/selected document and verifies
   * it. The file is never uploaded: extraction and fingerprinting both happen
   * in the browser, and only the id and the digest are sent.
   */
  const handleFile = useCallback(async (file) => {
    if (!file) return;

    setScanError(null);
    setResult(null);
    setScannedFile(null);
    setScanning(true);

    try {
      const { cert_id, document_sha256 } = await extractCertificateFromFile(file);
      setCertId(cert_id);
      setScannedFile({ name: file.name, cert_id, document_sha256 });
      setScanning(false);
      await runVerification(cert_id, { verification_method: 'upload', document_sha256 });
    } catch (err) {
      setScanError(err.message);
      setScanning(false);
    }
  }, [runVerification]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  // Auto-run verification when the page is opened from a QR code
  // (Certificate.jsx encodes the cert as /verify?id=<cert_id>) so scanning
  // the code shows the result immediately instead of an empty form.
  useEffect(() => {
    const idFromQr = searchParams.get('id');
    if (idFromQr) {
      runVerification(idFromQr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = (e) => {
    e.preventDefault();
    setScannedFile(null);
    runVerification(certId, { verification_method: 'id' });
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:p-8">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-gray-800 text-center">
            Verify Academic Credential
          </h1>
          <p className="text-gray-600 mb-6 text-center text-sm sm:text-base">
            Enter the Certificate ID, or upload the certificate itself, to confirm
            its authenticity on the national registry.
          </p>

          {/* Input mode */}
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
            {[
              { key: 'id', label: 'Enter ID', icon: Keyboard },
              { key: 'upload', label: 'Upload Document', icon: Upload }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); setScanError(null); }}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition ${
                  mode === key
                    ? 'bg-white text-blue-800 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          {mode === 'upload' && (
            <div className="mb-8">
              <label
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg cursor-pointer transition text-center ${
                  dragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                } ${scanning ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                  className="hidden"
                  disabled={scanning || loading}
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                {scanning ? (
                  <>
                    <Loader2 className="animate-spin text-blue-600" size={28} />
                    <span className="text-sm font-medium text-gray-700">Reading document…</span>
                  </>
                ) : (
                  <>
                    <Upload className="text-blue-600" size={28} />
                    <span className="text-sm font-medium text-gray-800">
                      Drop the certificate here, or click to choose a file
                    </span>
                    <span className="text-xs text-gray-500">
                      PDF, PNG or JPG — the QR code is read from the document
                    </span>
                  </>
                )}
              </label>

              {/* The file stays on the device; only the extracted ID and a
                  fingerprint of the file are sent to the registry. */}
              <p className="text-xs text-gray-400 mt-2 text-center">
                Your file is read in the browser and is never uploaded.
              </p>

              {scanError && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-amber-800">{scanError}</p>
                </div>
              )}

              {scannedFile && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <FileText className="text-blue-700 flex-shrink-0 mt-0.5" size={16} />
                  <div className="min-w-0">
                    <p className="text-blue-900 font-medium truncate">{scannedFile.name}</p>
                    <p className="text-blue-800 text-xs mt-0.5">
                      Certificate code found: <span className="font-mono">{scannedFile.cert_id}</span>
                    </p>
                    {scannedFile.document_sha256 && (
                      <p className="text-blue-600 text-xs font-mono mt-0.5 break-all">
                        SHA-256 {scannedFile.document_sha256.substring(0, 32)}…
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <form
            onSubmit={handleVerify}
            className={`flex flex-col sm:flex-row gap-3 mb-8 ${mode === 'upload' ? 'hidden' : ''}`}
          >
            <input 
              type="text" 
              placeholder="e.g. CERT-1712345678-ABC123" 
              className="flex-1 p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base font-mono"
              value={certId}
              onChange={(e) => setCertId(e.target.value.toUpperCase())}
              required
            />
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 transition shadow-md active:scale-95 text-sm sm:text-base font-medium"
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify'}
            </button>
          </form>

          {result && (
            <div className={`p-4 sm:p-6 rounded-lg border-l-4 ${
              result.valid ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {result.valid ? (
                  <ShieldCheck className="text-green-600 flex-shrink-0" size={28} />
                ) : (
                  <AlertTriangle className="text-red-600 flex-shrink-0" size={28} />
                )}
                <h2 className={`text-xl sm:text-2xl font-bold ${
                  result.valid ? 'text-green-800' : 'text-red-800'
                }`}>
                  {result.valid ? 'Credential Verified' : 'Verification Failed'}
                </h2>
              </div>
              
              <p className="mb-4 text-gray-700 text-sm sm:text-base">{result.message}</p>
              
              {result.valid && result.details && (
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm space-y-4 border border-gray-100">
                  
                  {/* Institution Badge */}
                  <div className="flex items-center gap-3 border-b border-gray-200 pb-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Building2 className="text-blue-700" size={20} />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-blue-800 uppercase tracking-wide">
                        {result.details.institution_code}
                      </span>
                      <span className="block text-sm text-gray-600">{result.details.institution_name}</span>
                    </div>
                  </div>

                  {/* Common Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-gray-500 block text-xs uppercase tracking-wide">Full Name</span>
                      <p className="text-gray-900 font-medium mt-1">{result.details.student_name}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-500 block text-xs uppercase tracking-wide">Issue Date</span>
                      <p className="text-gray-900 font-medium mt-1">{result.details.issue_date}</p>
                    </div>
                  </div>

                  {/* Classification — the same vocabulary for every credential
                      type, and part of the hashed record, so it cannot be
                      altered on a printed copy without failing verification. */}
                  {(result.details.classification || result.details.class_of_degree) && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <Award className="text-amber-700 flex-shrink-0" size={20} />
                      <div>
                        <span className="block text-xs font-semibold text-amber-800 uppercase tracking-wide">
                          Classification
                        </span>
                        <p className="text-amber-900 font-bold text-base">
                          {result.details.classification || result.details.class_of_degree}
                        </p>
                        {result.details.aggregate != null && (
                          <p className="text-amber-700 text-xs mt-0.5">
                            Aggregate {result.details.aggregate} over {result.details.counted_subjects} best subjects
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Type-Specific Details */}
                  {result.certificate_type === 'examination' || result.certificate_type === 'grade12' ? (
                    <div className="space-y-3">
                      <div>
                        <span className="font-semibold text-gray-500 block text-xs uppercase tracking-wide">Level</span>
                        <p className="text-gray-900 font-medium mt-1 uppercase">{result.details.level || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-500 block text-xs uppercase tracking-wide">Candidate Number</span>
                        <p className="text-gray-900 font-medium font-mono mt-1">{result.details.candidate_number}</p>
                      </div>

                      <div>
                        <span className="font-semibold text-gray-500 block text-xs uppercase tracking-wide mb-2">Examination Subjects</span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {result.details.subjects && result.details.subjects.map((sub, index) => (
                            <div key={index} className="bg-gray-50 p-3 rounded border border-gray-200 text-center">
                              <div className="font-bold text-gray-800 text-sm uppercase">{sub.code}</div>
                              <div className="text-blue-700 font-semibold text-lg mt-1">Grade {sub.grade}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : result.certificate_type === 'technical' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-semibold text-gray-500 block text-xs uppercase tracking-wide">Program of Study</span>
                        <p className="text-gray-900 font-medium mt-1">{result.details.program}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-500 block text-xs uppercase tracking-wide">Diploma Type</span>
                        <p className="text-gray-900 font-medium mt-1">{result.details.diploma_type}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <span className="font-semibold text-gray-500 block text-xs uppercase tracking-wide">Program of Study</span>
                      <p className="text-gray-900 font-medium mt-1">{result.details.program}</p>
                    </div>
                  )}

                  {/* Blockchain Status & Hash Footer */}
                  <div className="pt-3 border-t border-gray-200 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <ShieldCheck size={16} className={result.verification.blockchain_verified ? "text-green-600" : "text-red-600"} />
                      <span className="font-semibold text-gray-700">Blockchain Status:</span>
                      <span className={`font-medium ${result.verification.blockchain_verified ? 'text-green-600' : 'text-red-600'}`}>
                        {result.verification.blockchain_verified ? 'Anchored on Ethereum' : 'Not found on chain'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 break-all">
                      <span className="font-semibold">Verification Hash:</span> 
                      <span className="ml-2 font-mono">{result.details.cert_hash_preview}</span>
                    </div>
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