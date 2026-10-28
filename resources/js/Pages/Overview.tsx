import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { GitPullRequest, ArrowRight, CheckCircle2 } from 'lucide-react';

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

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Review Overview</h1>
            <p className="mt-1 text-xs text-slate-500">
              Inspect pull requests, test changes in isolated worktrees, and verify cryptographic receipts.
            </p>
          </div>
          <Link
            href="/repositories"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 self-start sm:self-center"
          >
            <GitPullRequest className="w-3.5 h-3.5" />
            <span>Inspect Pull Request</span>
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">PR Snapshots</span>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">{totalSnapshots}</div>
            <p className="text-xs text-slate-500">Captured pull request records in local store</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Verification Runs</span>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {verifiedRuns} <span className="text-xs font-normal text-slate-400">/ {totalRuns} total</span>
            </div>
            <p className="text-xs text-slate-500">Passing all 4 isolated worktree gates</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Verification Gates</span>
            <div className="text-sm font-semibold text-slate-800 pt-0.5">4 Automated Gates</div>
            <p className="text-xs text-slate-500">DOM probe · Visual guard · Locked tests · Authority</p>
          </div>
        </div>

        {/* Recent Pull Requests Datatable */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent Pull Requests</h2>
              <p className="text-xs text-slate-500">Snapshots recorded in local SQLite database.</p>
            </div>
            <Link
              href="/repositories"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 focus-visible:outline-none focus-visible:underline"
            >
              <span>Open inspector</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                <GitPullRequest className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-semibold text-slate-900">No pull requests recorded yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Inspect a GitHub pull request using shorthand like <code>owner/repo#123</code> or a full URL.
              </p>
              <div className="pt-2">
                <Link
                  href="/repositories"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition"
                >
                  Inspect a pull request
                </Link>
              </div>
            </div>
          ) : (
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
                  {recent.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5 font-medium text-slate-900">
                        <Link
                          href={`/repositories?snapshot=${encodeURIComponent(item.id)}`}
                          className="hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {item.pull.title}
                        </Link>
                      </td>
                      <td className="py-3 px-5 text-slate-600">
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
                      <td className="py-3 px-5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                            item.pull.state.toLowerCase() === 'open'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {item.pull.state.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-slate-500 whitespace-nowrap">
                        {formatTime(item.capturedAt)}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <Link
                          href={`/repositories?snapshot=${encodeURIComponent(item.id)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 hover:underline"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="w-3 h-3" />
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
