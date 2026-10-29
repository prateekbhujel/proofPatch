import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import {
  GitPullRequest,
  ArrowRight,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
} from 'lucide-react';

interface PullItem {
  id: string;
  pull: {
    repository: string;
    number: number;
    title: string;
    state: string;
    headSha: string;
    isMerged?: boolean;
    isPrivate?: boolean;
  };
  capturedAt: string;
}

interface OverviewProps {
  totalSnapshots: number;
  totalRuns: number;
  verifiedRuns: number;
  recent: PullItem[];
}

export default function Overview({
  totalSnapshots = 0,
  totalRuns = 0,
  verifiedRuns = 0,
  recent = [],
}: OverviewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    } catch {
      return ts;
    }
  };

  const filteredPulls = useMemo(() => {
    if (!searchQuery.trim()) return recent;
    const q = searchQuery.toLowerCase();
    return recent.filter(
      (item) =>
        item.pull.title.toLowerCase().includes(q) ||
        item.pull.repository.toLowerCase().includes(q) ||
        item.pull.headSha.toLowerCase().includes(q) ||
        `#${item.pull.number}`.includes(q)
    );
  }, [recent, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredPulls.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedPulls = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredPulls.slice(start, start + pageSize);
  }, [filteredPulls, safeCurrentPage, pageSize]);

  return (
    <AppLayout activeNav="overview">
      <Head title="ProofPatcher - Maintainer Workbench" />

      <div className="space-y-5 max-w-7xl mx-auto">
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">Overview</h1>
              <p className="mt-1 text-sm text-slate-500">Review pull requests and work on issues in one place.</p>
            </div>
            <Link href="/issues" className="inline-flex w-fit items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-800">
              Open issues <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Saved PR snapshots</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">{totalSnapshots}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Verification runs</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">{totalRuns}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Runs with verified results</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">{verifiedRuns}</dd>
            </div>
          </dl>
        </section>

        {/* Core Workspaces Navigation (Compact 3-Column Row) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/repositories"
            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-violet-300 hover:shadow-xs transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center font-semibold text-xs border border-violet-100 group-hover:bg-violet-700 group-hover:text-white transition">
                  <GitPullRequest className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-slate-900 group-hover:text-violet-700 transition">
                  Pull Requests
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 transition" />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Inspect public pull requests, review unified/split diffs, and draft inline comments.
            </p>
          </Link>

          <Link
            href="/issues"
            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-violet-300 hover:shadow-xs transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center font-semibold text-xs border border-violet-100 group-hover:bg-violet-700 group-hover:text-white transition">
                  <CheckSquare className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-slate-900 group-hover:text-violet-700 transition">
                  Issues Workbench
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 transition" />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Open an issue, request a proposal, and review its checks.
            </p>
          </Link>

          <Link
            href="/checks?tab=visual"
            className="p-4 rounded-xl border border-slate-200 bg-white hover:border-violet-300 hover:shadow-xs transition group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center font-semibold text-xs border border-violet-100 group-hover:bg-violet-700 group-hover:text-white transition">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold text-slate-900 group-hover:text-violet-700 transition">
                  Checks
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 transition" />
            </div>
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              Review verification results and visual comparisons.
            </p>
          </Link>
        </div>

        {/* Recent Pull Requests Datatable with Real Pagination */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Captured Pull Requests</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  {recent.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Saved snapshots available for model-assisted review and code inspection.
              </p>
            </div>

            {/* Quick Filter Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search PRs by repo, title..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:border-transparent transition"
              />
            </div>
          </div>

          {filteredPulls.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs text-slate-500">
                {searchQuery ? 'No pull requests matched your search query.' : 'No pull request snapshots captured yet.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-violet-700 hover:underline font-medium"
                >
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-5">Repository & Pull Request</th>
                      <th className="py-2.5 px-5">Commit SHA</th>
                      <th className="py-2.5 px-5">State</th>
                      <th className="py-2.5 px-5">Captured At</th>
                      <th className="py-2.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedPulls.map((item) => {
                      const isMerged = item.pull.isMerged || item.pull.state.toLowerCase() === 'merged';
                      const isOpen = item.pull.state.toLowerCase() === 'open';

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/60 transition-colors group"
                        >
                          <td className="py-3 px-5 max-w-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 truncate">
                                {item.pull.repository}#{item.pull.number}
                              </span>
                            </div>
                            <div className="text-slate-600 truncate mt-0.5 text-[11px]">
                              {item.pull.title}
                            </div>
                          </td>
                          <td className="py-3 px-5 whitespace-nowrap">
                            <code className="text-[11px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                              {item.pull.headSha.slice(0, 8)}
                            </code>
                          </td>
                          <td className="py-3 px-5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isMerged
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : isOpen
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {isMerged ? 'MERGED' : item.pull.state.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-slate-500 whitespace-nowrap">
                            {formatTime(item.capturedAt)}
                          </td>
                          <td className="py-3 px-5 text-right whitespace-nowrap">
                            <Link
                              href={`/repositories?snapshot=${encodeURIComponent(item.id)}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 group-hover:text-violet-700 hover:underline"
                            >
                              <span>Inspect</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-5 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/30">
                  <span className="text-[11px] text-slate-500">
                    Showing {(safeCurrentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(safeCurrentPage * pageSize, filteredPulls.length)} of {filteredPulls.length} snapshots
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-6 h-6 rounded text-xs font-medium flex items-center justify-center transition ${
                            pageNum === safeCurrentPage
                              ? 'bg-violet-700 text-white shadow-2xs font-bold'
                              : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage === totalPages}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
