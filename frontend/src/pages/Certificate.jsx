import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';
import { ShieldCheck, Printer, Download, ArrowLeft, GraduationCap, Building2, FileText } from 'lucide-react';

export default function Certificate() {
  const { certId } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (certId) fetchCertificate();
  }, [certId]);

  const fetchCertificate = async () => {
    try {
      const verifyRes = await api.post('/verify', { cert_id: certId });
      
      if (!verifyRes.data.valid) {
        setError('Certificate is invalid or has been revoked');
        setLoading(false);
        return;
      }
      
      setCertificate({
        ...verifyRes.data.details,
        cert_id: certId,
        cert_hash: verifyRes.data.details.cert_hash_preview,
        verification_url: `${window.location.origin}/verify?id=${certId}`
      });
    } catch (err) {
      setError('Failed to load certificate: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  // Format date safely without timezone shifts
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const isGrade12 = certificate?.certificate_type === 'grade12';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-900 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">Loading credential...</p>
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-10 rounded-lg shadow-xl text-center max-w-lg border-2 border-red-200">
          <ShieldCheck className="text-red-600 w-16 h-16 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Credential Not Valid</h2>
          <p className="text-gray-600 mb-6 text-lg">{error || 'This certificate ID is invalid or has been revoked.'}</p>
          <button
            onClick={() => navigate('/verify')}
            className="flex items-center gap-2 mx-auto text-blue-700 hover:text-blue-900 font-semibold text-lg"
          >
            <ArrowLeft size={20} /> Back to Verification
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print & Screen Styles */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0mm; }
          html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: visible; background: white; }
          body * { visibility: hidden; }
          #certificate-page, #certificate-page * { visibility: visible; }
          #certificate-page { 
            position: absolute; left: 0; top: 0; 
            width: 210mm; height: 297mm; 
            margin: 0; padding: 0; 
            background: white; 
            box-shadow: none; border: none;
            display: block;
          }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* Control Bar - Hidden in Print */}
      <div className="max-w-5xl mx-auto mb-6 flex justify-between items-center no-print px-4 py-4">
        <button
          onClick={() => navigate('/verify')}
          className="flex items-center gap-2 text-gray-700 hover:text-blue-900 font-semibold px-4 py-2 rounded-lg hover:bg-white transition"
        >
          <ArrowLeft size={18} /> Back to Verify
        </button>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-semibold shadow-md transition disabled:opacity-50"
          >
            <Printer size={18} /> Print Credential
          </button>
        </div>
      </div>

      {/* CERTIFICATE PAGE CONTAINER */}
      <div id="certificate-page" className="bg-white w-[210mm] min-h-[297mm] mx-auto relative overflow-hidden font-serif">
        
        {/* Decorative Border Frame */}
        <div className="absolute inset-4 border-[3px] border-double border-blue-900/80 pointer-events-none"></div>
        <div className="absolute inset-6 border border-yellow-600/60 pointer-events-none"></div>

        <div className="relative z-10 h-full flex flex-col p-12 pt-16">
          
          {/* HEADER: Institution Branding */}
          <header className="text-center mb-12">
            <div className="flex justify-center items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-blue-900 flex items-center justify-center border-2 border-yellow-600 shadow-sm">
                {isGrade12 ? <FileText className="text-white w-8 h-8" /> : <GraduationCap className="text-white w-8 h-8" />}
              </div>
              <div className="w-16 h-16 rounded-full bg-blue-900 flex items-center justify-center border-2 border-yellow-600 shadow-sm">
                <Building2 className="text-white w-8 h-8" />
              </div>
            </div>
            
            <h1 className="text-4xl font-bold text-blue-900 tracking-widest uppercase mb-2">
              {isGrade12 ? 'Examinations Council of Zambia' : 'University of Zambia'}
            </h1>
            <div className="w-64 h-1 bg-gradient-to-r from-transparent via-yellow-600 to-transparent mx-auto my-3"></div>
            <p className="text-sm text-gray-600 italic tracking-wide">
              {isGrade12 ? 'National Examination Board' : 'Excellence in Education Since 1966'}
            </p>
          </header>

          {/* VERIFICATION BANNER */}
          <div className="mb-10 p-3 bg-green-50 border-l-4 border-green-600 rounded-r-lg flex items-center gap-3">
            <ShieldCheck className="text-green-700 w-5 h-5 shrink-0" />
            <div>
              <p className="font-bold text-green-900 text-sm uppercase tracking-wider">Blockchain Verified Credential</p>
              <p className="text-xs text-green-800">Authenticity confirmed on the national registry.</p>
            </div>
          </div>

          {/* DYNAMIC CONTENT BODY */}
          <main className="flex-grow flex flex-col justify-center text-center px-8 space-y-8">
            
            {isGrade12 ? (
              /* GRADE 12 LAYOUT */
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-gray-600 uppercase tracking-widest mb-2 font-sans">Candidate Number</p>
                  <p className="text-3xl font-mono font-bold text-blue-900 tracking-wider">{certificate.candidate_number}</p>
                </div>
                
                <div className="border-t border-b border-gray-300 py-6">
                  <p className="text-lg text-gray-700 mb-4">This is to certify that</p>
                  <h2 className="text-4xl font-bold text-blue-900 mb-6 pb-2 border-b-2 border-yellow-600 inline-block px-8">
                    {certificate.student_name}
                  </h2>
                  <p className="text-lg text-gray-700">
                    has sat for the General Certificate of Education Examination held in{' '}
                    <span className="font-bold text-blue-900">{certificate.metadata?.exam_year || '2026'}</span>
                  </p>
                </div>

                {/* SUBJECTS TABLE */}
                <div className="max-w-3xl mx-auto mt-8">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-blue-900 text-white">
                        <th className="py-3 px-6 text-sm font-sans uppercase tracking-wider">Subject Code</th>
                        <th className="py-3 px-6 text-sm font-sans uppercase tracking-wider">Subject Name</th>
                        <th className="py-3 px-6 text-center text-sm font-sans uppercase tracking-wider w-24">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(certificate.subjects || []).map((sub, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="py-3 px-6 border-b border-gray-200 font-mono text-sm">{sub.code}</td>
                          <td className="py-3 px-6 border-b border-gray-200 text-sm">{sub.name || 'N/A'}</td>
                          <td className="py-3 px-6 border-b border-gray-200 text-center font-bold text-blue-900">{sub.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* UNIVERSITY LAYOUT */
              <div className="space-y-6">
                <p className="text-lg text-gray-700">This is to certify that</p>
                
                <h2 className="text-5xl font-bold text-blue-900 pb-3 border-b-2 border-yellow-600 inline-block px-8">
                  {certificate.student_name}
                </h2>
                
                <div className="space-y-4 py-4">
                  <p className="text-lg text-gray-700 leading-relaxed max-w-2xl mx-auto">
                    having satisfied the requirements of the Senate and the Examinations Board, 
                    has been awarded the degree of
                  </p>
                  
                  <h3 className="text-3xl font-bold text-gray-900 uppercase tracking-wide mt-4">
                    {certificate.program}
                  </h3>
                  
                  <div className="inline-block px-8 py-3 bg-blue-50 border border-blue-200 rounded-full mt-4">
                    <p className="text-sm text-blue-900 font-semibold uppercase tracking-wider">
                      Classification: {certificate.class_of_degree}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ISSUE DATE */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Given under the seal of the institution on this{' '}
                <span className="font-bold text-blue-900">{formatDate(certificate.issue_date)}</span>
              </p>
            </div>
          </main>

          {/* FOOTER: Signatures & Blockchain Proof */}
          <footer className="mt-auto pt-12">
            <div className="grid grid-cols-3 gap-8 items-end mb-8">
              {/* Left Signature */}
              <div className="text-center">
                <div className="h-12 mb-2 flex items-end justify-center">
                  <p className="italic text-blue-900 border-b border-gray-400 w-32 pb-1 font-serif">
                    {isGrade12 ? 'Chief Examiner' : 'Vice Chancellor'}
                  </p>
                </div>
                <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                  {isGrade12 ? 'ECZ Board' : 'Prof. M. Mwanakatwe'}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-sans">
                  {isGrade12 ? 'Examinations Council' : 'University of Zambia'}
                </p>
              </div>

              {/* Center QR Code */}
              <div className="text-center flex flex-col items-center">
                <div className="bg-white p-2 rounded border border-gray-300 shadow-sm mb-2">
                  <QRCodeSVG 
                    value={certificate.verification_url} 
                    size={70} 
                    bgColor="#ffffff" 
                    fgColor="#1e3a8a" 
                    level="H" 
                  />
                </div>
                <p className="font-bold text-blue-900 text-xs uppercase tracking-wider">Scan to Verify</p>
                <p className="text-[10px] font-mono text-gray-500 break-all max-w-24 mt-1">{certificate.cert_id}</p>
              </div>

              {/* Right Signature */}
              <div className="text-center">
                <div className="h-12 mb-2 flex items-end justify-center">
                  <p className="italic text-blue-900 border-b border-gray-400 w-32 pb-1 font-serif">
                    {isGrade12 ? 'Director' : 'University Registrar'}
                  </p>
                </div>
                <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                  {isGrade12 ? 'Dr. J. Mwamba' : 'Dr. S. Kapasa'}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-sans">
                  {isGrade12 ? 'Assessment Division' : 'Academic Affairs'}
                </p>
              </div>
            </div>

            {/* Blockchain Hash Footer */}
            <div className="border-t-2 border-blue-900/20 pt-4 flex items-center justify-center gap-3">
              <ShieldCheck className="text-green-700 w-4 h-4" />
              <div className="text-center">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-sans mb-1">Immutable Blockchain Record</p>
                <p className="text-xs font-mono text-gray-600 break-all max-w-lg mx-auto">{certificate.cert_hash}</p>
              </div>
              <ShieldCheck className="text-green-700 w-4 h-4" />
            </div>
          </footer>

        </div>
      </div>
    </>
  );
}