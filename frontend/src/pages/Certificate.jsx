import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';
import { ShieldCheck, Printer, Download, ArrowLeft, GraduationCap, Building2 } from 'lucide-react';

export default function Certificate() {
  const { certId } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    if (certId) {
      fetchCertificate();
    }
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
        verification_url: window.location.href
      });
    } catch (err) {
      setError('Failed to load certificate: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  const handleDownload = () => {
    handlePrint();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-900 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-10 rounded-lg shadow-xl text-center max-w-lg border-2 border-red-200">
          <div className="text-red-600 mb-4 text-6xl">⚠️</div>
          <h2 className="text-3xl font-bold text-gray-800 mb-3">Certificate Not Valid</h2>
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

  const issueDate = new Date(certificate.issue_date);
  const day = issueDate.getDate();
  const month = issueDate.toLocaleString('default', { month: 'long' });
  const year = issueDate.getFullYear();
  
  const ordinalSuffix = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <>
      {/* CRITICAL: Print CSS for Single Page */}
      <style>{`
  @media print {
    @page {
      size: A4 landscape;
      margin: 0 !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      overflow: hidden !important;
    }
    body * {
      visibility: hidden;
    }
    #certificate-page, #certificate-page * {
      visibility: visible !important;
    }
    #certificate-page {
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
    }
    /* Remove all spacing around the certificate */
    #certificate-page > div {
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
    .no-print {
      display: none !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`}</style>

      {/* Control Buttons - Hidden when printing */}
      <div className="max-w-6xl mx-auto mb-4 flex justify-between items-center no-print">
        <button
          onClick={() => navigate('/verify')}
          className="flex items-center gap-2 text-gray-700 hover:text-blue-900 font-semibold px-4 py-2 rounded-lg hover:bg-white transition"
        >
          <ArrowLeft size={20} /> Back
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            disabled={isPrinting}
            className="flex items-center gap-2 px-5 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 font-semibold shadow-lg transition disabled:opacity-50"
          >
            <Download size={18} /> {isPrinting ? 'Preparing...' : 'Download PDF'}
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-2 px-5 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 font-semibold shadow-lg transition disabled:opacity-50"
          >
            <Printer size={18} /> {isPrinting ? 'Printing...' : 'Print'}
          </button>
        </div>
      </div>

      {/* SINGLE PAGE CERTIFICATE - This is what prints */}
      <div id="certificate-page" className="bg-white overflow-hidden border-8 border-double border-yellow-600 w-full">
        {/* Inner border */}
    <div className="border-4 border-yellow-700 p-4 md:p-6 bg-gradient-to-br from-white via-amber-50/20 to-white h-full flex flex-col justify-between w-full">
          
          {/* TOP SECTION: Header */}
          <div className="text-center flex-shrink-0">
            {/* Logos */}
            <div className="flex justify-center items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center border-2 border-yellow-600">
                <GraduationCap className="text-white" size={24} />
              </div>
              <div className="text-2xl text-yellow-700">❖</div>
              <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center border-2 border-yellow-600">
                <Building2 className="text-white" size={24} />
              </div>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-1 tracking-wide">
              UNIVERSITY OF ZAMBIA
            </h1>
            <div className="w-64 h-0.5 bg-gradient-to-r from-transparent via-yellow-600 to-transparent mx-auto my-2"></div>
            <p className="text-xs text-gray-600 italic">
              Excellence in Education Since 1966
            </p>
          </div>

          {/* MIDDLE SECTION: Certificate Content */}
          <div className="text-center flex-grow flex flex-col justify-center px-4 py-3">
            {/* Title */}
            <h2 className="text-xl md:text-2xl font-bold text-yellow-800 mb-1 italic">
              Certificate of Completion
            </h2>
            <p className="text-gray-600 text-sm mb-2">
              This is to certify that
            </p>

            {/* Student Name - Large & Prominent */}
            <h3 className="text-3xl md:text-4xl font-bold text-blue-900 mb-2 border-b-2 border-yellow-600 pb-2 inline-block">
              {certificate.student_name}
            </h3>

            {/* Achievement */}
            <div className="mt-2 mb-2">
              <p className="text-sm text-gray-700 mb-1">
                has successfully completed all requirements for the degree of
              </p>
              <h4 className="text-lg md:text-xl font-bold text-blue-900 uppercase tracking-wider">
                {certificate.program}
              </h4>
              <p className="text-xs text-gray-600 italic mt-1">
                with all the rights, honors, and privileges thereunto appertaining
              </p>
            </div>

            {/* Date */}
            <p className="text-sm text-gray-700 mt-2">
              Given under the seal of the University on this{' '}
              <span className="font-bold text-blue-900">{ordinalSuffix(day)}</span> day of{' '}
              <span className="font-bold text-blue-900">{month}</span>,{' '}
              <span className="font-bold text-blue-900">{year}</span>
            </p>
          </div>

          {/* BOTTOM SECTION: Signatures & QR */}
          <div className="flex-shrink-0">
            {/* Signatures Row */}
            <div className="grid grid-cols-3 gap-4 items-end mb-3 px-2">
              {/* Chancellor */}
              <div className="text-center">
                <div className="h-10 mb-1 flex items-end justify-center">
                  <div className="italic text-sm text-blue-900 border-b border-gray-400 w-28 pb-0.5">
                    Prof. C. Banda
                  </div>
                </div>
                <p className="font-bold text-gray-900 text-xs">Chancellor</p>
                <p className="text-xs text-gray-600 leading-tight">University of Zambia</p>
              </div>

              {/* QR Code */}
              <div className="text-center">
                <div className="bg-white p-1 rounded border border-gray-300 inline-block mb-1">
                  <QRCodeSVG 
                    value={certificate.verification_url}
                    size={70}
                    bgColor="#ffffff"
                    fgColor="#1e3a8a"
                    level="H"
                  />
                </div>
                <p className="font-bold text-blue-900 text-xs">Scan to Verify</p>
                <p className="text-xs font-mono text-gray-600 break-all leading-tight">{certificate.cert_id}</p>
              </div>

              {/* Registrar */}
              <div className="text-center">
                <div className="h-10 mb-1 flex items-end justify-center">
                  <div className="italic text-sm text-blue-900 border-b border-gray-400 w-28 pb-0.5">
                    Dr. M. Phiri
                  </div>
                </div>
                <p className="font-bold text-gray-900 text-xs">University Registrar</p>
                <p className="text-xs text-gray-600 leading-tight">Academic Affairs</p>
              </div>
            </div>

            {/* Seal & Blockchain Footer */}
            <div className="flex items-center justify-center gap-3 mb-2">
              {/* Official Seal */}
              <div className="w-16 h-16 rounded-full border-2 border-yellow-600 flex items-center justify-center bg-yellow-100 flex-shrink-0">
                <div className="text-center">
                  <div className="text-xl">🏛️</div>
                  <p className="text-xs font-bold text-blue-900 leading-tight">OFFICIAL<br/>SEAL</p>
                </div>
              </div>

              {/* Blockchain Badge */}
              <div className="text-center flex-grow">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <ShieldCheck className="text-green-600" size={16} />
                  <p className="text-xs font-bold text-gray-800">Blockchain Verified</p>
                  <ShieldCheck className="text-green-600" size={16} />
                </div>
                <p className="text-xs text-gray-500 font-mono break-all leading-tight px-4">
                  {certificate.cert_hash}
                </p>
              </div>
            </div>

            {/* Footer Motto */}
            <div className="border-t border-yellow-600 pt-1 mt-1">
              <p className="text-center text-xs text-gray-500 italic">
                "Knowledge is Power" - University of Zambia
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Verification Info - Hidden when printing */}
      <div className="max-w-6xl mx-auto mt-3 bg-blue-50 p-3 rounded-lg shadow no-print">
        <h4 className="font-bold text-blue-900 mb-1 flex items-center gap-2 text-sm">
          <ShieldCheck size={14} /> Verification Details
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-semibold text-gray-700">Certificate ID:</span>
            <p className="font-mono text-gray-900 break-all">{certificate.cert_id}</p>
          </div>
          <div>
            <span className="font-semibold text-gray-700">Blockchain Hash:</span>
            <p className="font-mono text-gray-900 break-all">{certificate.cert_hash}</p>
          </div>
        </div>
      </div>
    </>
  );
}