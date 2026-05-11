import { useState } from 'react';
import api from '../../services/api';

export default function Issue() {
  const [formData, setFormData] = useState({
    student_name: '',
    program: '',
    institution_id: '',
    issue_date: '',
    student_id: ''
  });
  const [response, setResponse] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/certificates', formData);
      setResponse(res.data);
      alert('Certificate issued successfully!');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || 'Failed to issue certificate'));
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-blue-900">Issue New Certificate</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700 mb-2 font-semibold">Student Name</label>
          <input 
            name="student_name" 
            placeholder="Full Name" 
            onChange={handleChange} 
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required 
          />
        </div>
        <div>
          <label className="block text-gray-700 mb-2 font-semibold">Program</label>
          <input 
            name="program" 
            placeholder="e.g. BSc Computing" 
            onChange={handleChange} 
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required 
          />
        </div>
        <div>
          <label className="block text-gray-700 mb-2 font-semibold">Institution ID (UUID)</label>
          <input 
            name="institution_id" 
            placeholder="a911b6c7-..." 
            onChange={handleChange} 
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required 
          />
        </div>
        <div>
          <label className="block text-gray-700 mb-2 font-semibold">Issue Date</label>
          <input 
            name="issue_date" 
            type="date" 
            onChange={handleChange} 
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required 
          />
        </div>
        <div>
          <label className="block text-gray-700 mb-2 font-semibold">Student ID (UUID)</label>
          <input 
            name="student_id" 
            placeholder="a91d43bb-..." 
            onChange={handleChange} 
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required 
          />
        </div>
        <button 
          type="submit" 
          className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 font-semibold"
        >
          Issue Certificate
        </button>
      </form>

      {response && (
        <div className="mt-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
          <h3 className="font-bold text-green-800 mb-2">✅ Issued Successfully!</h3>
          <p className="text-sm text-gray-700"><strong>Cert ID:</strong> {response.cert_id}</p>
          <p className="text-xs text-gray-600 mt-2 break-all"><strong>Hash:</strong> {response.cert_hash}</p>
        </div>
      )}
    </div>
  );
}