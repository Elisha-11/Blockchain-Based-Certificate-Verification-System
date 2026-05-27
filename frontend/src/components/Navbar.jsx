import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="bg-blue-900 text-white shadow-md sticky top-0 z-50" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo (Emoji removed for professional design) */}
          <Link 
            to="/" 
            className="text-lg sm:text-xl font-bold tracking-tight hover:text-blue-200 transition"
          >
            UNZA CertVerify
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <Link 
              to="/verify" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                location.pathname === '/verify' ? 'bg-blue-800 text-white' : 'hover:bg-blue-800 hover:text-blue-200'
              }`}
            >
              Verify Certificate
            </Link>
            <Link 
              to="/admin/login" 
              className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                location.pathname === '/admin/login' ? 'bg-blue-800 text-white' : 'hover:bg-blue-800 hover:text-blue-200'
              }`}
            >
              Admin Login
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 rounded-md hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-white transition"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {isOpen && (
        <div className="md:hidden bg-blue-800 border-t border-blue-700">
          <div className="px-4 py-3 space-y-2">
            <Link 
              to="/verify" 
              className={`block py-2 px-4 rounded-md transition ${
                location.pathname === '/verify' ? 'bg-blue-900 text-white' : 'hover:bg-blue-700'
              }`}
              onClick={() => setIsOpen(false)}
            >
              Verify Certificate
            </Link>
            <Link 
              to="/admin/login" 
              className={`block py-2 px-4 rounded-md transition ${
                location.pathname === '/admin/login' ? 'bg-blue-900 text-white' : 'hover:bg-blue-700'
              }`}
              onClick={() => setIsOpen(false)}
            >
              Admin Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}