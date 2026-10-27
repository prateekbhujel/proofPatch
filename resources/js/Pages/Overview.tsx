import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { GitPullRequest, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface PullItem {
  id: string;
  pull: {
    repository: string;
    number: number;
    title: string;
    state: string;
    headSha: string;
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
  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    } catch {
      return ts;
    }
  };

  return (
    <AppLayout activeNav="overview">
      <Head title="Overview" />

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pull Request Reviews</h1>
            <p className="mt-1 text-sm text-slate-500">
              Inspect pull requests, test changes in isolated worktrees, and inspect receipts.
            </p>
          </div>
          <Link
            href="/repositories"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white bg-violet-600 hover:bg-violet-700 shadow-xs transition"
          >
            <GitPullRequest className="w-4 h-4" />
            <span>Inspect Pull Request</span>
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Snapshots</span>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">{totalSnapshots}</div>
            <p className="text-xs text-slate-500">Saved PR metadata captures</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verified Runs</span>
            <div className="text-3xl font-bold text-slate-900 tracking-tight">
              {verifiedRuns} <span className="text-xs font-normal text-slate-400">/ {totalRuns} total</span>
            </div>
            <p className="text-xs text-slate-500">Passed all 4 isolated gates</p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verification Gates</span>
            <div className="text-base font-semibold text-slate-800 pt-1">4 Isolated Checks</div>
            <p className="text-xs text-slate-500">DOM probe, visual guard, locked tests, authority</p>
          </div>
        </div>

        {/* Recent Pull Requests Datatable */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent Pull Requests</h2>
              <p className="text-xs text-slate-500">Captured snapshots recorded in local store.</p>
            </div>
            <Link href="/repositories" className="text-xs font-medium text-violet-600 hover:text-violet-700">
              Open inspector →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <GitPullRequest className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">No pull requests recorded yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Inspect a GitHub pull request using shorthand like <code>owner/repo#123</code> or full URL.
              </p>
              <div className="pt-2">
                <Link
                  href="/repositories"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-white bg-violet-600 hover:bg-violet-700 shadow-xs"
                >
                  Inspect a pull request
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6">Pull Request</th>
                    <th className="py-3 px-6">Repository</th>
                    <th className="py-3 px-6">Head Commit</th>
                    <th className="py-3 px-6">State</th>
                    <th className="py-3 px-6">Captured</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recent.map((item) => (
                    <tr key={item.id} className="hover:bg-violet-50/30 transition-colors">
                      <td className="py-3.5 px-6 font-medium text-slate-900">
                        <Link
                          href={`/repositories?snapshot=${encodeURIComponent(item.id)}`}
                          className="hover:text-violet-600 transition"
                        >
                          {item.pull.title}
                        </Link>
                      </td>
                      <td className="py-3.5 px-6 text-slate-600">
                        <span className="inline-flex items-center gap-1 text-xs">
                          <span className="text-slate-400">#{item.pull.number}</span>
                          <span>{item.pull.repository}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <code className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {item.pull.headSha.slice(0, 8)}
                        </code>
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.pull.state.toLowerCase() === 'open'
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                              : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                          }`}
                        >
                          {item.pull.state.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-500 whitespace-nowrap">
                        {formatTime(item.capturedAt)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Link
                          href={`/repositories?snapshot=${encodeURIComponent(item.id)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
