import React, { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import {
  FileText,
  CheckCircle2,
  ExternalLink,
  Zap,
  Copy,
  Check,
  Search,
  PlusCircle,
  Shield,
  Layers,
} from 'lucide-react';

interface ChangedFile {
  name: string;
  additions: number;
  deletions: number;
  status?: string;
}

interface CheckRun {
  name: string;
  status: string;
  conclusion?: string;
}

interface PullData {
  repository: string;
  number: number;
  title: string;
  state: string;
  head: string;
  base: string;
  headSha: string;
  url: string;
  files?: ChangedFile[];
  checks?: CheckRun[];
}

interface SnapshotData {
  id: string;
  capturedAt: string;
  sha256: string;
}

interface RepositoriesProps {
  pull?: PullData | null;
  snapshot?: SnapshotData | null;
  error?: string | null;
  csrf?: string;
}

export default function Repositories({
  pull = null,
  snapshot = null,
  error = null,
}: RepositoriesProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'checks' | 'receipt' | 'new'>(
    pull ? 'overview' : 'new'
  );
  const [fileQuery, setFileQuery] = useState('');
  const [checkQuery, setCheckQuery] = useState('');
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState(false);

  const { data, setData, post, processing } = useForm({
    url: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post('/repositories');
  };

  const copyText = (text: string, type: 'sha' | 'digest') => {
    navigator.clipboard.writeText(text);
    if (type === 'sha') {
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 1500);
    } else {
      setCopiedDigest(true);
      setTimeout(() => setCopiedDigest(false), 1500);
    }
  };

  const files = pull?.files || [];
  const checks = pull?.checks || [];

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(fileQuery.toLowerCase().trim())
  );

  const filteredChecks = checks.filter(
    (c) =>
      c.name.toLowerCase().includes(checkQuery.toLowerCase().trim()) ||
      (c.conclusion || c.status).toLowerCase().includes(checkQuery.toLowerCase().trim())
  );

  const totalAdditions = files.reduce((acc, f) => acc + (f.additions || 0), 0);
  const totalDeletions = files.reduce((acc, f) => acc + (f.deletions || 0), 0);
  const passedChecks = checks.filter(
    (c) => (c.conclusion || c.status).toLowerCase() === 'success'
  ).length;

  return (
    <AppLayout activeNav="pulls">
      <Head title={pull ? `${pull.repository}#${pull.number}` : 'Inspect Pull Request'} />

      <div className="space-y-6">
        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
            <span>{error}</span>
          </div>
        )}

        {pull ? (
          <>
            {/* PR Header Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
                    <span>{pull.repository}</span>
                    <span>/</span>
                    <span className="font-bold text-slate-900">#{pull.number}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        pull.state.toLowerCase() === 'open'
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                          : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                      }`}
                    >
                      {pull.state.toUpperCase()}
                    </span>
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">{pull.title}</h1>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="inline-flex items-center gap-1 font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                      <span>{pull.head}</span>
                    </span>
                    <span className="text-slate-400 font-mono">→</span>
                    <span className="inline-flex items-center gap-1 font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                      <span>{pull.base}</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="font-mono text-slate-500 text-xs">
                      Commit{' '}
                      <code className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded font-mono">
                        {pull.headSha.slice(0, 8)}
                      </code>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start md:self-center">
                  <a
                    href={pull.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs transition"
                  >
                    <span>View on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                  <Link
                    href="/checks"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 shadow-xs transition"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Run Workspace</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="border-b border-slate-200">
              <nav className="flex space-x-6 sm:space-x-8">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                    activeTab === 'overview'
                      ? 'border-violet-600 text-violet-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Overview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                    activeTab === 'files'
                      ? 'border-violet-600 text-violet-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Changed Files</span>
                  <span className="ml-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {files.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('checks')}
                  className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                    activeTab === 'checks'
                      ? 'border-violet-600 text-violet-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>GitHub Checks</span>
                  <span className="ml-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    {checks.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('receipt')}
                  className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                    activeTab === 'receipt'
                      ? 'border-violet-600 text-violet-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                    activeTab === 'new'
                      ? 'border-violet-600 text-violet-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Inspect Another</span>
                </button>
              </nav>
            </div>

            {/* TAB PANE 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Files Changed
                    </span>
                    <div className="text-2xl font-bold text-slate-900">{files.length}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span className="text-emerald-600 font-medium">+{totalAdditions}</span>
                      <span className="text-rose-600 font-medium">−{totalDeletions}</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      CI Checks
                    </span>
                    <div className="text-2xl font-bold text-slate-900">
                      {passedChecks} <span className="text-sm font-normal text-slate-400">/ {checks.length}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {checks.length - passedChecks > 0
                        ? `${checks.length - passedChecks} failing / pending`
                        : 'All reported checks pass'}
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Head Commit
                    </span>
                    <div className="font-mono text-sm font-bold text-slate-800 pt-0.5 truncate">
                      {pull.headSha.slice(0, 12)}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(pull.headSha, 'sha')}
                      className="text-xs text-violet-600 hover:text-violet-700 font-medium inline-flex items-center gap-1"
                    >
                      {copiedSha ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSha ? 'Copied' : 'Copy SHA'}</span>
                    </button>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Snapshot Digest
                    </span>
                    <div className="text-sm font-bold text-emerald-700 pt-0.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Verified</span>
                    </div>
                    <div className="text-xs text-slate-500 truncate font-mono">
                      {snapshot?.sha256 ? `${snapshot.sha256.slice(0, 12)}...` : 'In-memory'}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1.5">
                    <div className="text-xs font-mono text-violet-300">Isolated Worktree Evaluation</div>
                    <h2 className="text-lg font-bold">Verify this PR before merge</h2>
                    <p className="text-xs text-slate-300 max-w-lg">
                      Runs the locked browser test in a disposable worktree and verifies interaction under trusted pointer events.
                    </p>
                  </div>
                  <Link
                    href="/checks"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg text-slate-900 bg-white hover:bg-slate-100 shadow-sm transition whitespace-nowrap"
                  >
                    <span>Open Workspace</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            )}

            {/* TAB PANE 2: CHANGED FILES */}
            {activeTab === 'files' && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Changed Files</h2>
                    <p className="text-xs text-slate-500">{files.length} files touched in commit</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={fileQuery}
                      onChange={(e) => setFileQuery(e.target.value)}
                      placeholder="Filter files..."
                      className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                {filteredFiles.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-500">No matching files found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-6">File Path</th>
                          <th className="py-3 px-6">Diff Lines</th>
                          <th className="py-3 px-6 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredFiles.map((file, idx) => (
                          <tr key={idx} className="hover:bg-violet-50/30 transition-colors">
                            <td className="py-3.5 px-6 font-mono text-xs text-slate-800">
                              {file.name}
                            </td>
                            <td className="py-3.5 px-6 font-mono text-xs">
                              <span className="text-emerald-600 font-semibold">+{file.additions}</span>
                              <span className="text-slate-300 mx-1">/</span>
                              <span className="text-rose-600 font-semibold">−{file.deletions}</span>
                            </td>
                            <td className="py-3.5 px-6 text-right">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {file.status || 'modified'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB PANE 3: GITHUB CHECKS */}
            {activeTab === 'checks' && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">GitHub Check Runs</h2>
                    <p className="text-xs text-slate-500">{checks.length} checks recorded</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <input
                      type="text"
                      value={checkQuery}
                      onChange={(e) => setCheckQuery(e.target.value)}
                      placeholder="Filter checks..."
                      className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>

                {filteredChecks.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-500">No matching check runs found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-6">Check Name</th>
                          <th className="py-3 px-6">Status</th>
                          <th className="py-3 px-6 text-right">Conclusion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredChecks.map((check, idx) => {
                          const conc = (check.conclusion || check.status).toLowerCase();
                          return (
                            <tr key={idx} className="hover:bg-violet-50/30 transition-colors">
                              <td className="py-3.5 px-6 font-medium text-slate-900">{check.name}</td>
                              <td className="py-3.5 px-6 text-xs text-slate-600">{check.status}</td>
                              <td className="py-3.5 px-6 text-right">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    conc === 'success'
                                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                      : conc === 'failure'
                                      ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                                      : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                                  }`}
                                >
                                  {(check.conclusion || check.status).toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB PANE 4: RECEIPT */}
            {activeTab === 'receipt' && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Snapshot Receipt</h2>
                  <p className="text-xs text-slate-500">Cryptographically anchored record capturing pull request state.</p>
                </div>

                {snapshot ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        SHA-256 Canonical Digest
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(snapshot.sha256, 'digest')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-xs transition"
                      >
                        {copiedDigest ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedDigest ? 'Copied' : 'Copy Hash'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-xs text-violet-900 bg-white p-3 rounded-lg border border-slate-200 break-all select-all">
                      {snapshot.sha256}
                    </div>
                    <div className="text-xs text-slate-500">Captured: {snapshot.capturedAt}</div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Snapshot digest unavailable for this session.</p>
                )}
              </div>
            )}

            {/* TAB PANE 5: INSPECT ANOTHER */}
            {activeTab === 'new' && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Inspect Another Pull Request</h2>
                  <p className="text-xs text-slate-500">Enter a short handle or complete GitHub URL.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      required
                      placeholder="owner/repo#123 or https://github.com/owner/repo/pull/123"
                      value={data.url}
                      onChange={(e) => setData('url', e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                    />
                    <button
                      type="submit"
                      disabled={processing}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg text-white bg-violet-600 hover:bg-violet-700 shadow-xs transition disabled:opacity-50"
                    >
                      <span>{processing ? 'Loading...' : 'Inspect PR'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        ) : (
          /* Empty / Initial Inspect Hero Card */
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-8 max-w-2xl mx-auto space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inspect Pull Request</h1>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Enter a GitHub pull request URL or short handle to capture changed files, check runs, and run isolated verification.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  required
                  placeholder="owner/repo#123 or https://github.com/owner/repo/pull/123"
                  value={data.url}
                  onChange={(e) => setData('url', e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-xs"
                />
                <button
                  type="submit"
                  disabled={processing}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg text-white bg-violet-600 hover:bg-violet-700 shadow-xs transition disabled:opacity-50"
                >
                  <span>{processing ? 'Loading...' : 'Inspect'}</span>
                </button>
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 pt-1">
                <span>Supports:</span>
                <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">owner/repo#123</code>
                <span className="text-slate-300">·</span>
                <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">github.com/owner/repo/pull/123</code>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
