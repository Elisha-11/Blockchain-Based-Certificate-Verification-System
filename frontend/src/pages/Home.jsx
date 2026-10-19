import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CertificateList from '../components/Admin/CertificateList';
import CertificateIssuanceForm from '../components/Admin/CertificateIssuanceForm';
import InstitutionManagement from '../components/Admin/InstitutionManagement';
import RegulatorAuditLog from '../components/Admin/RegulatorAuditLog';
import Verify from './Verify';
import { ShieldCheck, Zap, BadgeCheck, ArrowRight, LogOut, List, PlusCircle, Search, Building2, ShieldAlert } from 'lucide-react';

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);
  // ZAQA (institution_type 'regulatory_body') qualifies institutions rather
  // than issuing or holding certificates of its own.
  const [isRegulator, setIsRegulator] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'institution_admin' || payload.role === 'super_admin') {
          setIsAdmin(true);
          const regulator = payload.institution_type === 'regulatory_body';
          setIsRegulator(regulator);
          setActiveTab(regulator ? 'institutions' : 'list');
        } else {
          localStorage.removeItem('jwt_token');
        }
      } catch (e) {
        localStorage.removeItem('jwt_token');
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setIsAdmin(false);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-900 border-t-transparent"></div>
      </div>
    );
  }

  // ADMIN DASHBOARD VIEW
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-blue-900 text-white shadow-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck size={24} /> Academic Credential Registry
            </h1>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/90 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="flex gap-2 mb-6 flex-wrap">
            {isRegulator ? (
              <>
                <button
                  onClick={() => setActiveTab('institutions')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    activeTab === 'institutions' ? 'bg-blue-900 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  <Building2 size={18} /> Manage Institutions
                </button>
                <button
                  onClick={() => setActiveTab('audit')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    activeTab === 'audit' ? 'bg-blue-900 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  <ShieldAlert size={18} /> Audit Trail
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('list')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    activeTab === 'list' ? 'bg-blue-900 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  <List size={18} /> View Certificates
                </button>
                <button
                  onClick={() => setActiveTab('issue')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                    activeTab === 'issue' ? 'bg-blue-900 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  <PlusCircle size={18} /> Issue Certificate
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('verify')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
                activeTab === 'verify' ? 'bg-blue-900 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              <Search size={18} /> Verify Certificate
            </button>
          </div>

          <main>
            {activeTab === 'institutions' ? (
              <InstitutionManagement />
            ) : activeTab === 'audit' ? (
              <RegulatorAuditLog />
            ) : activeTab === 'list' ? (
              <CertificateList />
            ) : activeTab === 'issue' ? (
              <CertificateIssuanceForm onIssued={() => setActiveTab('list')} />
            ) : (
              <Verify />
            )}
          </main>
        </div>
      </div>
    );
  }

  // PUBLIC LANDING PAGE VIEW
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-blue-900 leading-tight tracking-tight break-words">
            Blockchain Certificate Verification
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed px-2">
            Securing academic integrity with immutable Ethereum technology. 
            Issue, verify, and trust academic credentials instantly.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4">
          <Link 
            to="/verify" 
            className="group inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium w-full sm:w-auto"
          >
            Verify Certificate
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link 
            to="/admin/login" 
            className="inline-flex items-center justify-center bg-white border-2 border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-all duration-200 shadow-sm hover:shadow-md font-medium w-full sm:w-auto"
          >
            Admin Portal
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-12">
          <FeatureCard 
            icon={<ShieldCheck size={28} className="text-blue-600" />}
            title="Cryptographically Secure"
            description="SHA-256 hashes anchored on Ethereum prevent tampering and forgery."
          />
          <FeatureCard 
            icon={<Zap size={28} className="text-blue-600" />}
            title="Instant Verification"
            description="Validate credentials in seconds with dual-check database and blockchain lookup."
          />
          <FeatureCard 
            icon={<BadgeCheck size={28} className="text-blue-600" />}
            title="Institutional Trust"
            description="Officially endorsed by the University of Zambia for academic credentialing."
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 text-center space-y-2">
      <div className="flex justify-center mb-2">{icon}</div>
      <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}