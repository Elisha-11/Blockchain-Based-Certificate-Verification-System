import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="text-center py-20 px-4">
      <h1 className="text-5xl font-bold text-blue-900 mb-4">
        Blockchain Certificate Verification
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        Securing academic integrity with Ethereum technology
      </p>
      <div className="flex justify-center gap-4 flex-wrap">
        <Link 
          to="/verify" 
          className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition"
        >
          Verify Now
        </Link>
        <Link 
          to="/admin/login" 
          className="bg-white border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition"
        >
          Admin Portal
        </Link>
      </div>
      
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto px-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-4xl mb-4">🔐</div>
          <h3 className="font-bold text-lg mb-2">Secure</h3>
          <p className="text-gray-600">Blockchain-anchored certificates prevent forgery</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-4xl mb-4">⚡</div>
          <h3 className="font-bold text-lg mb-2">Fast</h3>
          <p className="text-gray-600">Instant verification in seconds</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-4xl mb-4">✅</div>
          <h3 className="font-bold text-lg mb-2">Trusted</h3>
          <p className="text-gray-600">Verified by University of Zambia</p>
        </div>
      </div>
    </div>
  );
}