import { useState } from 'react';
import api from '../../services/api';
import { CheckCircle, XCircle, Plus, Trash2, Loader2 } from 'lucide-react';

export default function Issue() {
  const [type, setType] = useState('university');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  // Pre-filled with known demo UUIDs to prevent formatting errors
  const [formData, setFormData] = useState({
    student_name: '',
    institution_id: 'a911b6c7-3023-11f1-a766-484d7efdbe1f', 
    issue_date: '',
    // University fields
    student_id: 'a91d43bb-3023-11f1-a766-484d7efdbe1f',
    program: '',
    class_of_degree: '',
    // Grade 12 fields
    candidate_number: ''
  });

  const [subjects, setSubjects] = useState([{ code: '', grade: '' }]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubjectChange = (index, field, value) => {
    const updatedSubjects = [...subjects];
    updatedSubjects[index][field] = value.toUpperCase(); // Auto-uppercase subject codes
    setSubjects(updatedSubjects);
  };

  const addSubject = () => {
    setSubjects([...subjects, { code: '', grade: '' }]);
  };

  const removeSubject = (index) => {
    if (subjects.length > 1) {
      setSubjects(subjects.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Construct base payload
      const payload = {
        certificate_type: type,
        student_name: formData.student_name.trim(),
        institution_id: formData.institution_id.trim(),
        issue_date: formData.issue_date
      };

      // Append type-specific fields
      if (type === 'university') {
        payload.student_id = formData.student_id.trim() || null;
        payload.program = formData.program.trim();
        payload.class_of_degree = formData.class_of_degree;
      } else if (type === 'grade12') {
        payload.candidate_number = formData.candidate_number.trim();
        // Filter out empty subject rows
        payload.subjects = subjects.filter(s => s.code.trim() && s.grade.trim());
        
        if (payload.subjects.length === 0) {
          throw new Error('At least one subject with a grade is required for Grade 12 results.');
        }
      }

      const res = await api.post('/certificates', payload);
      setResponse(res.data);
      
      // Reset form on success
      setFormData({ ...formData, student_name: '', program: '', candidate_number: '' });
      setSubjects([{ code: '', grade: '' }]);
      
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to issue certificate';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";
  const labelClasses = "block text-gray-700 mb-1.5 text-sm font-medium";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Issue Academic Credential</h2>
        <p className="text-gray-500 text-sm mb-6">Register a new certificate or examination result on the national blockchain registry.</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Certificate Type Selector */}
          <div>
            <label className={labelClasses}>Credential Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('university')}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition ${
                  type === 'university' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                University Degree
              </button>
              <button
                type="button"
                onClick={() => setType('grade12')}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition ${
                  type === 'grade12' 
                    ? 'border-blue-600 bg-blue-50 text-blue-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Grade 12 Result
              </button>
            </div>
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClasses}>Full Name</label>
              <input name="student_name" value={formData.student_name} onChange={handleChange} placeholder="e.g. Alice Banda" className={inputClasses} required />
            </div>
            
            <div>
              <label className={labelClasses}>Institution ID (UUID)</label>
              <input name="institution_id" value={formData.institution_id} onChange={handleChange} className={`${inputClasses} font-mono text-xs`} required />
            </div>
            
            <div>
              <label className={labelClasses}>Issue Date</label>
              <input name="issue_date" type="date" value={formData.issue_date} onChange={handleChange} className={inputClasses} required />
            </div>
          </div>

          {/* Dynamic Fields: University */}
          {type === 'university' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className={labelClasses}>Program of Study</label>
                <input name="program" value={formData.program} onChange={handleChange} placeholder="e.g. BSc Computer Science" className={inputClasses} required />
              </div>
              <div>
                <label className={labelClasses}>Classification</label>
                <select name="class_of_degree" value={formData.class_of_degree} onChange={handleChange} className={inputClasses}>
                  <option value="">Select Class...</option>
                  <option value="First Class">First Class</option>
                  <option value="Second Class Upper">Second Class Upper</option>
                  <option value="Second Class Lower">Second Class Lower</option>
                  <option value="Third Class">Third Class</option>
                  <option value="Pass">Pass</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClasses}>Student ID (UUID) - Optional</label>
                <input name="student_id" value={formData.student_id} onChange={handleChange} className={`${inputClasses} font-mono text-xs`} />
              </div>
            </div>
          )}

          {/* Dynamic Fields: Grade 12 */}
          {type === 'grade12' && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div>
                <label className={labelClasses}>Candidate Number</label>
                <input name="candidate_number" value={formData.candidate_number} onChange={handleChange} placeholder="e.g. 1234567890" className={inputClasses} required />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className={labelClasses}>Examination Subjects</label>
                  <button type="button" onClick={addSubject} className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus size={14} /> Add Subject
                  </button>
                </div>
                
                <div className="space-y-2">
                  {subjects.map((subject, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input 
                        type="text" 
                        placeholder="Code (e.g. MAT)" 
                        value={subject.code} 
                        onChange={(e) => handleSubjectChange(index, 'code', e.target.value)}
                        className="w-1/3 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm font-mono uppercase"
                        maxLength={5}
                      />
                      <input 
                        type="text" 
                        placeholder="Grade (1-9)" 
                        value={subject.grade} 
                        onChange={(e) => handleSubjectChange(index, 'grade', e.target.value)}
                        className="w-1/3 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        maxLength={2}
                      />
                      <button 
                        type="button" 
                        onClick={() => removeSubject(index)}
                        disabled={subjects.length === 1}
                        className="p-3 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-900 text-white p-3.5 rounded-lg hover:bg-blue-800 font-semibold transition shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} /> 
                Processing...
              </>
            ) : (
              'Register Credential on Blockchain'
            )}
          </button>
        </form>

        {/* Feedback Messages */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <XCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-red-800 text-sm">Issuance Failed</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {response && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="w-full">
              <h3 className="font-semibold text-green-800 text-sm">Successfully Registered</h3>
              <p className="text-sm text-gray-700 mt-2">
                <span className="font-medium">Certificate ID:</span> 
                <span className="ml-2 font-mono text-blue-700">{response.cert_id}</span>
              </p>
              <p className="text-xs text-gray-500 mt-2 break-all">
                <span className="font-medium">Hash:</span> {response.cert_hash}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}