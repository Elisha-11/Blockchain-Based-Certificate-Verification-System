import { useEffect, useState } from 'react';
import api from '../../services/api';
import { ShieldCheck, ShieldOff, Loader2, Building2 } from 'lucide-react';

const TYPE_LABELS = {
  university: 'University',
  college: 'College',
  examination_council: 'Examination Council',
  regulatory_body: 'Regulator'
};

export default function InstitutionManagement() {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const loadInstitutions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/institutions');
      setInstitutions(res.data.institutions);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load institutions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstitutions();
  }, []);

  const toggleStatus = async (institution) => {
    setUpdatingId(institution.institution_id);
    try {
      await api.patch(`/institutions/${institution.institution_id}/status`, {
        is_active: !institution.is_active
      });
      await loadInstitutions();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update institution status');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-blue-900" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Qualify Institutions</h2>
        <p className="text-gray-500 text-sm mb-6">
          As the national regulator, ZAQA authorizes which institutions may issue and have their
          credentials verified on the registry. Suspending an institution immediately blocks new issuance.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {institutions.map((inst) => (
            <div
              key={inst.institution_id}
              className="flex items-center justify-between gap-4 p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Building2 className="text-blue-700" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{inst.name}</p>
                  <p className="text-xs text-gray-500">
                    {inst.code} &middot; {TYPE_LABELS[inst.type] || inst.type}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    inst.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {inst.is_active ? 'Qualified' : 'Suspended'}
                </span>

                {inst.type !== 'regulatory_body' && (
                  <button
                    onClick={() => toggleStatus(inst)}
                    disabled={updatingId === inst.institution_id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 ${
                      inst.is_active
                        ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                        : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                    }`}
                  >
                    {updatingId === inst.institution_id ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : inst.is_active ? (
                      <ShieldOff size={14} />
                    ) : (
                      <ShieldCheck size={14} />
                    )}
                    {inst.is_active ? 'Suspend' : 'Qualify'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
