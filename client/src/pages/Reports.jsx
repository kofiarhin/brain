import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/resources';
import { Card } from '../components/Card';
import { List } from '../components/List';

function formatDateTime(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function count(items) {
  return Array.isArray(items) ? items.length : 0;
}

function preview(value) {
  if (!value) return 'No summary saved.';
  return value.length > 150 ? `${value.slice(0, 150)}...` : value;
}

function labelForRecord(record) {
  if (typeof record === 'string') return record;
  if (!record || typeof record !== 'object') return String(record ?? '');
  return record.title || record.name || record.content || record.summary || record.type || JSON.stringify(record);
}

function Metadata({ value }) {
  if (!value || !Object.keys(value).length) return <p className="text-sm text-slate-500">Nothing saved yet.</p>;
  return <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs leading-relaxed text-slate-200">{JSON.stringify(value, null, 2)}</pre>;
}

function statusClass(status) {
  if (status === 'success') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  if (status === 'partial') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
}

export function Reports() {
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });
  const [selectedId, setSelectedId] = useState(null);
  const queryFilters = useMemo(() => ({ ...filters }), [filters]);
  const { data: reports = [] } = useQuery({
    queryKey: ['brainUpdateReports', queryFilters],
    queryFn: () => api.brainUpdateReports.list(queryFilters),
  });
  const selectedReport = reports.find((report) => report._id === selectedId) || reports[0];

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedId(null);
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold">Reports</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">Read-only Brain update run history from MongoDB.</p>
    </div>

    <Card title="Filters">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm text-slate-300">Date from
          <input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
        </label>
        <label className="grid gap-1 text-sm text-slate-300">Date to
          <input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
        </label>
        <label className="grid gap-1 text-sm text-slate-300">Status
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
            <option value="">All statuses</option>
            <option value="success">Success</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
          </select>
        </label>
      </div>
    </Card>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Card title="Brain Update Reports">
        <div className="space-y-3">
          {reports.length ? reports.map((report) => <button
            type="button"
            key={report._id}
            onClick={() => setSelectedId(report._id)}
            className={`w-full rounded-lg border p-4 text-left transition hover:border-blue-500 ${selectedReport?._id === report._id ? 'border-blue-500 bg-slate-800' : 'border-slate-800 bg-slate-950'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{formatDateTime(report.runDate)}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{preview(report.summary)}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass(report.status)}`}>{report.status}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-5">
              <div><dt>Created</dt><dd className="text-slate-100">{count(report.recordsCreated)}</dd></div>
              <div><dt>Updated</dt><dd className="text-slate-100">{count(report.recordsUpdated)}</dd></div>
              <div><dt>Skipped</dt><dd className="text-slate-100">{count(report.skippedItems)}</dd></div>
              <div><dt>Errors</dt><dd className="text-slate-100">{count(report.errors)}</dd></div>
              <div><dt>Warnings</dt><dd className="text-slate-100">{count(report.warnings)}</dd></div>
            </dl>
          </button>) : <p className="text-sm text-slate-500">No reports match the current filters.</p>}
        </div>
      </Card>

      <Card title="Report Detail">
        {selectedReport ? <div className="space-y-5">
          <section><h3 className="mb-2 font-semibold">Summary</h3><p className="whitespace-pre-wrap text-sm text-slate-300">{selectedReport.summary || 'No summary saved.'}</p></section>
          <section><h3 className="mb-2 font-semibold">Records Created</h3><List items={(selectedReport.recordsCreated || []).map(labelForRecord)} /></section>
          <section><h3 className="mb-2 font-semibold">Records Updated</h3><List items={(selectedReport.recordsUpdated || []).map(labelForRecord)} /></section>
          <section><h3 className="mb-2 font-semibold">Skipped Items</h3><List items={(selectedReport.skippedItems || []).map(labelForRecord)} /></section>
          <section><h3 className="mb-2 font-semibold">Linked Tasks</h3><List items={(selectedReport.linkedTasks || []).map(labelForRecord)} /></section>
          <section><h3 className="mb-2 font-semibold">Linked Projects</h3><List items={(selectedReport.linkedProjects || []).map(labelForRecord)} /></section>
          <section><h3 className="mb-2 font-semibold">Warnings</h3><List items={selectedReport.warnings} /></section>
          <section><h3 className="mb-2 font-semibold">Errors</h3><List items={selectedReport.errors} /></section>
          <section><h3 className="mb-2 font-semibold">Next Recommended Actions</h3><List items={selectedReport.nextRecommendedActions} /></section>
          <section><h3 className="mb-2 font-semibold">Metadata</h3><Metadata value={selectedReport.metadata} /></section>
        </div> : <p className="text-sm text-slate-500">Select a report to inspect its details.</p>}
      </Card>
    </div>
  </div>;
}
