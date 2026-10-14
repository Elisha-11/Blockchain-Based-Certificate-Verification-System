import { useState } from 'react';
import api from '../../services/api';
import { CheckCircle, XCircle, Plus, Trash2, Loader2 } from 'lucide-react';
import { CERTIFICATE_THEME } from '../../utils/certificateTheme';

// Mirrors backend ALLOWED_CERT_TYPES_BY_INSTITUTION_TYPE (certificateController.js):
// universities/colleges issue degrees & diplomas, the examination council issues
// exam results, and the regulator (ZAQA) issues nothing.
const ALLOWED_TYPES_BY_INSTITUTION_TYPE = {
  university: ['university', 'technical'],
  college: ['university', 'technical'],
  examination_council: ['examination'],
  regulatory_body: []
};

// Tailwind needs literal class names at build time, so this can't be built
// with a template string like `sm:grid-cols-${n}`.
const GRID_COLS_BY_COUNT = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3'
};

const EXAM_LEVELS = [
  { value: 'grade7', label: 'Grade 7' },
  { value: 'grade9', label: 'Grade 9' },
  { value: 'grade12', label: 'Grade 12' },
  { value: 'gce', label: 'GCE' }
];

function getCurrentUser() {
  const token = localStorage.getItem('jwt_token');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      role: payload.role,
      institution_id: payload.institution_id,
      institution_type: payload.institution_type
    };
  } catch (e) {
    return null;
  }
}

export default function CertificateIssuanceForm({ onIssued }) {
  const [user] = useState(getCurrentUser);
  const isSuperAdmin = user?.role === 'super_admin';
  const availableTypes = isSuperAdmin
    ? ['university', 'examination', 'technical']
    : (ALLOWED_TYPES_BY_INSTITUTION_TYPE[user?.institution_type] || []);

  const [type, setType] = useState(availableTypes[0] || 'university');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    student_name: '',
    institution_id: user?.institution_id || 'a911b6c7-3023-11f1-a766-484d7efdbe1f',
    issue_date: '',
    // University fields
    student_id: '',
    program: '',
    class_of_degree: '',
    // Examination fields
    candidate_number: '',
    level: 'grade12',
    // Technical diploma fields
    diploma_type: ''
  });

  const [subjects, setSubjects] = useState([{ code: '', grade: '' }]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubjectChange = (index, field, value) => {
    const updatedSubjects = [...subjects];
    updatedSubjects[index][field] = value.toUpperCase();
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
      const payload = {
        certificate_type: type,
        student_name: formData.student_name.trim(),
        institution_id: formData.institution_id.trim(),
        issue_date: formData.issue_date
      };

      if (type === 'university') {
        payload.student_id = formData.student_id.trim() || null;
        payload.program = formData.program.trim();
        payload.class_of_degree = formData.class_of_degree;
      } else if (type === 'examination') {
        payload.level = formData.level;
        payload.candidate_number = formData.candidate_number.trim();
        payload.subjects = subjects.filter(s => s.code.trim() && s.grade.trim());

        if (payload.subjects.length === 0) {
          throw new Error('At least one subject with a grade is required for examination results.');
        }
      } else if (type === 'technical') {
        payload.program = formData.program.trim();
        payload.diploma_type = formData.diploma_type.trim();
        payload.student_id = formData.student_id.trim() || null;
      }

      const res = await api.post('/certificates', payload);
      setResponse(res.data);
      
      // Reset form on success
      setFormData({
        ...formData,
        student_name: '',
        program: '',
        candidate_number: '',
        class_of_degree: '',
        diploma_type: ''
      });
      setSubjects([{ code: '', grade: '' }]);
      
      // ✅ CRITICAL FIX: Notify parent to switch back to list view after 1.5s
      if (onIssued) {
        setTimeout(() => onIssued(), 1500);
      }
      
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
          
          {/* Certificate Type Selector - restricted to what this institution is authorized to issue */}
          <div>
            <label className={labelClasses}>Credential Type</label>
            {availableTypes.length === 0 ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                Your institution is not authorized to issue credentials.
              </p>
            ) : (
              <div className={`grid grid-cols-1 ${GRID_COLS_BY_COUNT[availableTypes.length] || 'sm:grid-cols-3'} gap-3`}>
                {availableTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`p-3 rounded-lg border-2 text-sm font-medium transition ${
                      type === t
                        ? CERTIFICATE_THEME[t].selectorActive
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {CERTIFICATE_THEME[t].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Common Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelClasses}>Full Name</label>
              <input name="student_name" value={formData.student_name} onChange={handleChange} placeholder="e.g. Alice Banda" className={inputClasses} required />
            </div>

            <div>
              <label className={labelClasses}>Institution ID (UUID){!isSuperAdmin && ' - Your Institution'}</label>
              <input
                name="institution_id"
                value={formData.institution_id}
                onChange={handleChange}
                readOnly={!isSuperAdmin}
                className={`${inputClasses} font-mono text-xs ${!isSuperAdmin ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                required
              />
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
                <label className={labelClasses}>Student ID (10-digit number) - Optional</label>
                <input name="student_id" value={formData.student_id} onChange={handleChange} placeholder="e.g. 2021045678" inputMode="numeric" maxLength={10} className={`${inputClasses} font-mono text-xs`} />
              </div>
            </div>
          )}

          {/* Dynamic Fields: Examination (Grade 7 / Grade 9 / Grade 12 / GCE) */}
          {type === 'examination' && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div>
                <label className={labelClasses}>Level</label>
                <select name="level" value={formData.level} onChange={handleChange} className={inputClasses}>
                  {EXAM_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
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

          {/* Dynamic Fields: Technical Diploma */}
          {type === 'technical' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className={labelClasses}>Program of Study</label>
                <input name="program" value={formData.program} onChange={handleChange} placeholder="e.g. Electrical Engineering" className={inputClasses} required />
              </div>
              <div>
                <label className={labelClasses}>Diploma Type</label>
                <input name="diploma_type" value={formData.diploma_type} onChange={handleChange} placeholder="e.g. Advanced Certificate" className={inputClasses} required />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClasses}>Student ID (10-digit number) - Optional</label>
                <input name="student_id" value={formData.student_id} onChange={handleChange} placeholder="e.g. 2021045678" inputMode="numeric" maxLength={10} className={`${inputClasses} font-mono text-xs`} />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || availableTypes.length === 0}
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