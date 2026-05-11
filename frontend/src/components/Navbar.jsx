import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-blue-900 text-white p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">🎓 UNZA CertVerify</Link>
        <div className="space-x-4">
          <Link to="/verify" className="hover:text-blue-300">Verify Certificate</Link>
          <Link to="/admin/login" className="bg-blue-700 px-4 py-2 rounded hover:bg-blue-600">Admin Login</Link>
        </div>
      </div>
    </nav>
  );
}