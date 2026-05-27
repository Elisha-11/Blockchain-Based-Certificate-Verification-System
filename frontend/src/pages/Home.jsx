import { Link } from 'react-router-dom';
import { ShieldCheck, Zap, BadgeCheck, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
        {/* Hero Section */}
        <div className="space-y-3 sm:space-y-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-blue-900 leading-tight tracking-tight break-words">
            Blockchain Certificate Verification
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed px-2">
            Securing academic integrity with immutable Ethereum technology. 
            Issue, verify, and trust academic credentials instantly.
          </p>
        </div>

        {/* Call-to-Action Buttons */}
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

        {/* Features Grid */}
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

// Reusable Feature Card Component
function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 text-center space-y-2">
      <div className="flex justify-center mb-2">{icon}</div>
      <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}