import React, { useState, useMemo } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import {
  GitPullRequest,
  ArrowRight,
  CheckCircle2,
  Settings,
  Shield,
  Layers,
  Search,
  ChevronLeft,
  ChevronRight,
  FolderGit2,
  CheckSquare,
  FileCode2,
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
      <Head title="ProofPatch - Maintainer Workbench" />

      <div className="space-y-8">
        {/* Hero Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
              <Shield className="w-3.5 h-3.5" />
              <span>Co-Maintainer Workbench</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Inspect public PRs, verify fixtures, and compose reviews.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              ProofPatch is a local workbench for public open-source maintainers. Inspect bounded diffs with TOCTOU race protection, test checkout repairs against automated verification gates, and draft precision line comments without leaking proprietary code.
            </p>
          </div>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-slate-100 mt-6">
            <Link
              href="/settings"
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-violet-50/50 hover:border-violet-300 motion-safe:transition motion-reduce:transition-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-violet-700 group-hover:border-violet-200 shadow-2xs">
                    <Settings className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-slate-900 group-hover:text-violet-900">
                    GitHub Connection
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 motion-safe:transition-transform" />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Set up RFC 8628 Device Flow and manage repository access.
              </p>
            </Link>

            <Link
              href="/repositories"
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-violet-50/50 hover:border-violet-300 motion-safe:transition motion-reduce:transition-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-violet-700 group-hover:border-violet-200 shadow-2xs">
                    <GitPullRequest className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-slate-900 group-hover:text-violet-900">
                    Inspect Pull Request
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 motion-safe:transition-transform" />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Review unified diffs, anchor line comments, and triage issues.
              </p>
            </Link>

            <Link
              href="/checks"
              className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-violet-50/50 hover:border-violet-300 motion-safe:transition motion-reduce:transition-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 group-hover:text-violet-700 group-hover:border-violet-200 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-semibold text-slate-900 group-hover:text-violet-900">
                    Checkout Verifier
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 motion-safe:transition-transform" />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Run 4-gate verification suite on bundled checkout fixtures.
              </p>
            </Link>
          </div>
        </div>

        {/* Workbench Guarantees & Scope Disclosures */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              <span>Public Repositories Only</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Private and unknown-visibility repository data is strictly excluded from public reviews, triage comparisons, and external inference. Local snapshots fail closed unless explicitly authorized.
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Layers className="w-4 h-4 text-violet-700" />
              <span>Isolated Worktrees</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Checkouts run in separate Git worktree directories with cryptographic receipts. Note: worktrees are isolated checkouts, not security sandboxes.
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <FileCode2 className="w-4 h-4 text-amber-600" />
              <span>Advisory Review Engine</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Model reviews are strictly advisory. The automated verifier currently covers bundled checkout visual and DOM fixtures.
            </p>
          </div>
        </div>

        {/* Recent Pull Requests Datatable with Real Pagination */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Captured Pull Requests</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  {filteredPulls.length} total
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Saved snapshots stored in local repository database.
              </p>
            </div>

            {/* Filter Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter by title, repo, SHA..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:border-transparent"
              />
            </div>
          </div>

          {filteredPulls.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <GitPullRequest className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-semibold text-slate-900">
                {searchQuery ? 'No matching pull requests found' : 'No pull requests recorded yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try clearing the search query to see all captured pull requests.'
                  : 'Capture a public GitHub pull request using shorthand like owner/repo#123 or full URL.'}
              </p>
              {!searchQuery && (
                <div className="pt-2">
                  <Link
                    href="/repositories"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs motion-safe:transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                  >
                    <span>Inspect a pull request</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 px-5">Pull Request</th>
                      <th className="py-2.5 px-5">Repository</th>
                      <th className="py-2.5 px-5">Head Commit</th>
                      <th className="py-2.5 px-5">State</th>
                      <th className="py-2.5 px-5">Captured</th>
                      <th className="py-2.5 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedPulls.map((item) => {
                      const isMerged = item.pull.isMerged || item.pull.state.toLowerCase() === 'merged';
                      const isOpen = item.pull.state.toLowerCase() === 'open';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 motion-safe:transition-colors motion-reduce:transition-none">
                          <td className="py-3 px-5 font-medium text-slate-900 max-w-xs truncate">
                            <Link
                              href={`/repositories?snapshot=${encodeURIComponent(item.id)}`}
                              className="hover:underline focus-visible:outline-none focus-visible:underline"
                            >
                              {item.pull.title}
                            </Link>
                          </td>
                          <td className="py-3 px-5 text-slate-600 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <span className="text-slate-400">#{item.pull.number}</span>
                              <span>{item.pull.repository}</span>
                            </span>
                          </td>
                          <td className="py-3 px-5">
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
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 hover:text-violet-700 hover:underline"
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

              {/* Real Pagination Controls */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/30">
                  <span className="text-[11px] text-slate-500">
                    Showing {(safeCurrentPage - 1) * pageSize + 1} to{' '}
                    {Math.min(safeCurrentPage * pageSize, filteredPulls.length)} of {filteredPulls.length} snapshots
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs motion-safe:transition motion-reduce:transition-none"
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
                          className={`w-7 h-7 rounded text-xs font-medium flex items-center justify-center motion-safe:transition motion-reduce:transition-none ${
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs motion-safe:transition motion-reduce:transition-none"
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
