import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { CLASSIFICATION_STYLES } from '../../utils/classification';
import {
  ShieldAlert, CheckCircle2, XCircle, Ban, Loader2, Search,
  Building2, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';

/**
 * ZAQA's oversight view: every issuance, failed issuance and revocation across
 * every institution, in one place.
 *
 * The regulator does not issue or hold certificates of its own, so this is the
 * only window it has into what the institutions it qualifies are actually
 * doing. The backing endpoints are gated by requireRegulator, so an ordinary
 * institution admin cannot reach this data even by calling the API directly.
 */

const EVENT_META = {
  issuance_success: {
    label: 'Issued',
    icon: CheckCircle2,
    row: 'text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  issuance_failed: {
    label: 'Failed',
    icon: XCircle,
    row: 'text-red-700',
    badge: 'bg-red-50 text-red-700 border-red-200'
  },
  revocation: {
    label: 'Revoked',
    icon: Ban,
    row: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-700 border-amber-200'
  }
};

const EMPTY_FILTERS = {
  event_type: '',
  institution_id: '',
  from: '',
  to: '',
  search: ''
};

function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${tone}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function RegulatorAuditLog() {
  const [summary, setSummary] = useState(null);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.get('/admin/audit-logs/summary');
      setSummary(res.data);
    } catch (err) {
      // The event log is the primary content; a failed summary should not
      // blank the whole page, so it is reported but not fatal.
      console.error('Failed to load audit summary:', err);
    }
  }, []);

  // Deliberately performs no synchronous state update: it is called from a
  // mount effect, and setting state there would cascade an extra render. The
  // spinner is raised by the handlers below that trigger a refetch.
  const loadEvents = useCallback(async (activeFilters, activePage) => {
    try {
      // Empty filters are dropped rather than sent as blanks, so the backend
      // sees only the filters actually in use.
      const params = Object.fromEntries(
        Object.entries({ ...activeFilters, page: activePage, limit: 25 })
          .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      );
      const res = await api.get('/admin/audit-logs', { params });
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(
        err.response?.data?.error ||
        'Could not load the audit log. Check that you are signed in as the regulator.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadEvents(filters, page); }, [filters, page, loadEvents]);

  const updateFilter = (name, value) => {
    setLoading(true);
    setPage(1);
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const goToPage = (next) => {
    setLoading(true);
    setPage(next);
  };

  const refresh = () => {
    setLoading(true);
    loadSummary();
    loadEvents(filters, page);
  };

  const totals = summary?.totals;
  const institutions = summary?.institutions || [];
  const classifications = summary?.classifications || [];
  const pagination = data?.pagination;

  const inputClasses = 'p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert size={24} className="text-blue-900" /> Issuance Audit Trail
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Every issuance, failed issuance and revocation recorded across all institutions.
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={CheckCircle2} label="Successful issuances" value={totals.issued} tone="bg-emerald-50 text-emerald-700" />
          <StatCard icon={XCircle} label="Failed issuances" value={totals.failed} tone="bg-red-50 text-red-700" />
          <StatCard icon={Ban} label="Revocations" value={totals.revoked} tone="bg-amber-50 text-amber-700" />
        </div>
      )}

      {/* Per-institution breakdown */}
      {institutions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Building2 size={16} /> Activity by institution
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-2 font-semibold">Institution</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-right px-3 py-2 font-semibold">Issued</th>
                  <th className="text-right px-3 py-2 font-semibold">Failed</th>
                  <th className="text-right px-3 py-2 font-semibold">Revoked</th>
                  <th className="text-left px-5 py-2 font-semibold">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {institutions.map((row) => (
                  <tr key={row.institution_id} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5">
                      <span className="font-semibold text-gray-900">{row.institution_code}</span>
                      <span className="text-gray-500 ml-2">{row.institution_name}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${
                        row.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-600 border-gray-300'
                      }`}>
                        {row.is_active ? 'Qualified' : 'Not qualified'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-emerald-700">{row.issued}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-red-700">{row.failed}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-amber-700">{row.revoked}</td>
                    <td className="px-5 py-2.5 text-gray-500 whitespace-nowrap">{formatTimestamp(row.last_activity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Classification distribution - an institution awarding implausibly many
          Distinctions is visible here before anyone audits it by hand. */}
      {classifications.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 text-sm mb-3">Classifications awarded</h3>
          <div className="flex flex-wrap gap-2">
            {classifications.map((row, index) => (
              <span
                key={index}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium ${
                  CLASSIFICATION_STYLES[row.classification] || 'bg-gray-100 text-gray-700 border-gray-300'
                }`}
              >
                {row.institution_code} · {row.certificate_type} · {row.classification}
                <span className="ml-1.5 font-bold">{row.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select
            value={filters.event_type}
            onChange={(e) => updateFilter('event_type', e.target.value)}
            className={inputClasses}
          >
            <option value="">All events</option>
            <option value="issuance_success">Successful issuance</option>
            <option value="issuance_failed">Failed issuance</option>
            <option value="revocation">Revocation</option>
          </select>

          <select
            value={filters.institution_id}
            onChange={(e) => updateFilter('institution_id', e.target.value)}
            className={inputClasses}
          >
            <option value="">All institutions</option>
            {institutions.map((row) => (
              <option key={row.institution_id} value={row.institution_id}>
                {row.institution_code} — {row.institution_name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={filters.from}
            onChange={(e) => updateFilter('from', e.target.value)}
            className={inputClasses}
            aria-label="From date"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => updateFilter('to', e.target.value)}
            className={inputClasses}
            aria-label="To date"
          />

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Name or certificate ID"
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className={`${inputClasses} w-full pl-9`}
            />
          </div>
        </div>

        {Object.values(filters).some((v) => v !== '') && (
          <button
            onClick={() => { setLoading(true); setFilters(EMPTY_FILTERS); setPage(1); }}
            className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Event log */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {error ? (
          <div className="p-6 text-center">
            <XCircle className="mx-auto text-red-500 mb-2" size={28} />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="animate-spin text-blue-900" size={28} />
          </div>
        ) : !data?.events?.length ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            No audit events match these filters.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-semibold">Event</th>
                    <th className="text-left px-3 py-2.5 font-semibold">When</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Institution</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Candidate</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Type</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Class</th>
                    <th className="text-left px-3 py-2.5 font-semibold">Officer</th>
                    <th className="text-left px-5 py-2.5 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.events.map((event) => {
                    const meta = EVENT_META[event.event_type] || EVENT_META.issuance_failed;
                    const Icon = meta.icon;
                    return (
                      <tr key={event.audit_id} className="hover:bg-gray-50 align-top">
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border font-medium ${meta.badge}`}>
                            <Icon size={13} /> {meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{formatTimestamp(event.created_at)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="font-semibold text-gray-900">{event.institution_code || '—'}</span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="text-gray-900 font-medium">{event.student_name || '—'}</p>
                          {event.cert_id && (
                            <p className="text-xs text-gray-400 font-mono">{event.cert_id}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-600 capitalize whitespace-nowrap">{event.certificate_type || '—'}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {event.classification ? (
                            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                              CLASSIFICATION_STYLES[event.classification] || 'bg-gray-100 text-gray-700 border-gray-300'
                            }`}>
                              {event.classification}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          <p className="text-xs">{event.actor_email || '—'}</p>
                          {event.actor_ip && <p className="text-xs text-gray-400 font-mono">{event.actor_ip}</p>}
                        </td>
                        <td className="px-5 py-3 text-gray-600 max-w-xs">
                          {event.detail ? (
                            <p className="text-xs break-words">{event.detail}</p>
                          ) : event.blockchain_tx_hash ? (
                            <p className="text-xs font-mono text-gray-400 break-all">
                              {event.blockchain_tx_hash.substring(0, 18)}…
                            </p>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.total} events
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => goToPage(Math.max(1, pagination.page - 1))}
                    disabled={pagination.page <= 1}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="p-2 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
