import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Verify from './pages/Verify';
import Login from './pages/Admin/Login';
import Dashboard from './pages/Admin/Dashboard';
import Certificates from './pages/Admin/Certificates';
import Certificate from './pages/Certificate';

// ✅ UX Enhancement: Auto-scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
}

// ✅ Layout Shell: Separates structure from routing logic
function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 antialiased text-gray-900">
      <Navbar />
      <main 
        className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto"
        role="main" 
        aria-label="Main application content"
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/certificate/:certId" element={<Certificate />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/certificates" element={<Certificates />} />
        </Routes>
      </main>
      <footer 
        className="bg-blue-900 text-white text-center py-6 text-sm mt-auto border-t border-blue-800"
        role="contentinfo"
      >
        <p className="font-medium">&copy; {new Date().getFullYear()} University of Zambia. All rights reserved.</p>
        <p className="text-blue-200 text-xs mt-1">Blockchain-Verified Academic Credentials</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Layout />
    </Router>
  );
}