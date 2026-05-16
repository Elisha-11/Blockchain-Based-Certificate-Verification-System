import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Verify from './pages/Verify';
import Login from './pages/Admin/Login';
import Dashboard from './pages/Admin/Dashboard';
import Certificates from './pages/Admin/Certificates'; // NEW
import Certificate from './pages/Certificate'; // NEW

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/certificate/:certId" element={<Certificate />} /> {/* NEW */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/certificates" element={<Certificates />} /> {/* NEW */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;