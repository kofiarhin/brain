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

function statusClass(status) {
  if (status === 'success') return 'border-success/40 bg-success-soft/30 text-success';
  if (status === 'partial') return 'border-warning/40 bg-warning-soft/30 text-warning';
  return 'border-danger/40 bg-danger-soft/30 text-danger';
}

function preview(value) {
  if (!value) return 'No topic saved.';
  return value.length > 120 ? `${value.slice(0, 120)}...` : value;
}

export function GeneratedPosts() {
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const queryParams = useMemo(() => ({ page, limit, ...filters }), [page, limit, filters]);
  const { data = { items: [], pagination: { page: 1, totalPages: 1 } } } = useQuery({
    queryKey: ['generatedPosts', queryParams],
    queryFn: () => api.generatedPosts.list(queryParams),
  });
  const posts = data.items || [];
  const pagination = data.pagination || { page, totalPages: 1 };
  const selectedPost = posts.find((post) => post._id === selectedId) || posts[0];

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
    setSelectedId(null);
  };

  const copyLinkedIn = async () => {
    if (!selectedPost?.linkedInPost) return;
    await navigator.clipboard.writeText(selectedPost.linkedInPost);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold">Generated Posts</h1>
      <p className="mt-2 max-w-2xl text-sm text-text-muted">Read-only Codex-generated post history saved in MongoDB.</p>
    </div>

    <Card title="Filters">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm text-text-secondary">Date from
          <input type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-text-primary" />
        </label>
        <label className="grid gap-1 text-sm text-text-secondary">Date to
          <input type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-text-primary" />
        </label>
        <label className="grid gap-1 text-sm text-text-secondary">Status
          <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-text-primary">
            <option value="">All statuses</option><option value="success">Success</option><option value="partial">Partial</option><option value="failed">Failed</option>
          </select>
        </label>
      </div>
    </Card>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <Card title="Posts">
        <div className="space-y-3">
          {posts.length ? posts.map((post) => <button type="button" key={post._id} onClick={() => setSelectedId(post._id)} className={`w-full rounded-lg border p-4 text-left transition hover:border-border ${selectedPost?._id === post._id ? 'border-border bg-elevated' : 'border-border-subtle bg-surface'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{post.selectedTopic || 'Untitled post'}</p><p className="mt-1 text-xs text-text-muted">{formatDateTime(post.runDate)}</p><p className="mt-2 text-sm text-text-secondary">{preview(post.topicRationale)}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass(post.status)}`}>{post.status}</span></div>
          </button>) : <p className="text-sm text-text-muted">No generated posts match the current filters.</p>}
          <div className="flex items-center justify-between border-t border-border-subtle pt-4 text-sm">
            <button type="button" disabled={!pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <span className="text-text-muted">Page {pagination.page} of {pagination.totalPages}</span>
            <button type="button" disabled={!pagination.hasNextPage} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      </Card>

      <Card title="Post Detail">
        {selectedPost ? <div className="space-y-5">
          <section><h3 className="mb-2 font-semibold">Selected Topic</h3><p className="text-sm text-text-secondary">{selectedPost.selectedTopic}</p></section>
          <section><h3 className="mb-2 font-semibold">Run Date</h3><p className="text-sm text-text-secondary">{formatDateTime(selectedPost.runDate)}</p></section>
          <section><h3 className="mb-2 font-semibold">Status</h3><span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass(selectedPost.status)}`}>{selectedPost.status}</span></section>
          <section><h3 className="mb-2 font-semibold">Topic Rationale</h3><p className="whitespace-pre-wrap text-sm text-text-secondary">{selectedPost.topicRationale || 'None saved.'}</p></section>
          <section><h3 className="mb-2 font-semibold">Research Summary</h3><p className="whitespace-pre-wrap text-sm text-text-secondary">{selectedPost.researchSummary || 'None saved.'}</p></section>
          <section><div className="mb-2 flex items-center justify-between gap-3"><h3 className="font-semibold">LinkedIn Post</h3><button type="button" onClick={copyLinkedIn} className="rounded-lg border border-border px-3 py-1 text-sm text-text-secondary hover:bg-accent-hover/10">{copied ? 'Copied' : 'Copy LinkedIn'}</button></div><p className="whitespace-pre-wrap text-sm text-text-secondary">{selectedPost.linkedInPost || 'None saved.'}</p></section>
          <section><h3 className="mb-2 font-semibold">X Post</h3><p className="whitespace-pre-wrap text-sm text-text-secondary">{selectedPost.xPost || 'None saved.'}</p></section>
          <section><h3 className="mb-2 font-semibold">Inspirational Message</h3><p className="whitespace-pre-wrap text-sm text-text-secondary">{selectedPost.inspirationalMessage || 'None saved.'}</p></section>
          <section><h3 className="mb-2 font-semibold">Review Notes</h3><List items={selectedPost.reviewNotes || []} /></section>
          <section><h3 className="mb-2 font-semibold">Iteration Count</h3><p className="text-sm text-text-secondary">{selectedPost.iterationCount ?? 0}</p></section>
        </div> : <p className="text-sm text-text-muted">Select a generated post to inspect its details.</p>}
      </Card>
    </div>
  </div>;
}
