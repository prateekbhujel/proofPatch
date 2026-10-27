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
  AlertTriangle,
  GitPullRequest,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface ChangedFile {
  name: string;
  additions: number;
  deletions: number;
  status?: string;
  patch?: string;
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

interface TriageComparison {
  candidate: {
    repository: string;
    number: number;
    headSha: string;
    title: string;
    fileCount: number;
  };
  jaccardScore: number;
  matchPercentage: number;
  sharedFiles: string[];
  sharedFilesCount: number;
  hunkOverlap: {
    hasLineOverlap: boolean;
    overlappingHunksCount: number;
    overlappingFiles: Array<{ name: string; overlappingHunks: number }>;
  };
  relationship: string;
  verdictBanner: string;
}

interface TriageData {
  target: {
    repository: string;
    number: number;
    headSha: string;
    title: string;
    totalChanges: number;
    hasTests: boolean;
    fileCount: number;
  };
  policy: {
    mode: string;
    passed: boolean;
    maxDiffLines: number;
    totalChanges: number;
    diffExceeded: boolean;
    requireTestCoverage: boolean;
    hasTests: boolean;
    testsMissing: boolean;
    action: string;
  };
  summary: {
    verdict: string;
    headline: string;
    detail: string;
    severity: 'red' | 'amber' | 'emerald';
  };
  comparisons: TriageComparison[];
}

interface RepositoriesProps {
  pull?: PullData | null;
  snapshot?: SnapshotData | null;
  triage?: TriageData | null;
  error?: string | null;
  csrf?: string;
}

export default function Repositories({
  pull = null,
  snapshot = null,
  triage = null,
  error = null,
}: RepositoriesProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'triage' | 'files' | 'checks' | 'receipt' | 'new'>(
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

              {/* Maintainer Plain-English Verdict Banner */}
              {triage && (
                <div
                  className={`mt-4 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    triage.summary.severity === 'emerald'
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                      : triage.summary.severity === 'amber'
                      ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                      : 'bg-rose-50/80 border-rose-200 text-rose-950'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          triage.summary.severity === 'emerald'
                            ? 'bg-emerald-600'
                            : triage.summary.severity === 'amber'
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-rose-600'
                        }`}
                      />
                      <h2 className="text-xs font-bold uppercase tracking-wider">
                        {triage.summary.headline}
                      </h2>
                    </div>
                    <p className="text-xs opacity-90 pl-4">{triage.summary.detail}</p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="text-2xs uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-white/80 border border-slate-200/80 shadow-2xs">
                      {triage.policy.mode}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('triage')}
                      className="text-xs font-semibold px-2.5 py-1 rounded bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition"
                    >
                      Inspect Triage →
                    </button>
                  </div>
                </div>
              )}
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
                  onClick={() => setActiveTab('triage')}
                  className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                    activeTab === 'triage'
                      ? 'border-violet-600 text-violet-700 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Triage & Overlap</span>
                  {triage?.comparisons && triage.comparisons.length > 0 && (
                    <span className="ml-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {triage.comparisons.length}
                    </span>
                  )}
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
                    {passedChecks}/{checks.length}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-2">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Changed Files</div>
                  <div className="text-2xl font-bold text-slate-900">{files.length}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="text-emerald-600 font-mono font-medium">+{totalAdditions}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-rose-600 font-mono font-medium">-{totalDeletions}</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-2">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">CI Status</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {checks.length === 0 ? 'No Checks' : `${passedChecks}/${checks.length} Passed`}
                  </div>
                  <div className="text-xs text-slate-500">Observed from GitHub Check Runs</div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-2">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Verification Engine</div>
                  <div className="text-sm font-semibold text-slate-900">Panther Headless Chromium</div>
                  <div className="text-xs text-slate-500">1280×720 @ 1x scale · Coordinate Pointers</div>
                </div>
              </div>
            )}

            {/* TAB PANE 2: TRIAGE & OVERLAP */}
            {activeTab === 'triage' && (
              <div className="space-y-6">
                {triage ? (
                  <>
                    {/* Policy Gate Summary */}
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div>
                          <h2 className="text-base font-semibold text-slate-900">Maintainer Policy Evaluation</h2>
                          <p className="text-xs text-slate-500">Configured via .proofpatchrc.json in repository root</p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            triage.policy.passed
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                              : 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                          }`}
                        >
                          {triage.policy.passed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          <span>{triage.policy.action}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                          <div className="text-slate-500">Max Diff Lines</div>
                          <div className="text-sm font-bold font-mono text-slate-900">
                            {triage.policy.totalChanges} / {triage.policy.maxDiffLines} lines
                          </div>
                          <div className={`font-medium ${triage.policy.diffExceeded ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {triage.policy.diffExceeded ? 'Exceeded limit' : 'Within budget'}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                          <div className="text-slate-500">Test File Presence</div>
                          <div className="text-sm font-bold text-slate-900">
                            {triage.target.hasTests ? 'Verified' : 'Missing'}
                          </div>
                          <div className={`font-medium ${triage.policy.testsMissing ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {triage.policy.testsMissing ? 'Tests required by policy' : 'Test files included'}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                          <div className="text-slate-500">Enforcement Mode</div>
                          <div className="text-sm font-bold text-slate-900">{triage.policy.mode}</div>
                          <div className="text-slate-500">Zero maintainer time wasted on unverified slop</div>
                        </div>
                      </div>
                    </div>

                    {/* PR Queue Overlap Comparisons */}
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">Queue Overlap & Duplicate Detection</h2>
                        <p className="text-xs text-slate-500">
                          Deterministic Jaccard file overlap and diff hunk line-range intersection across open pull requests
                        </p>
                      </div>

                      {triage.comparisons.length === 0 ? (
                        <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                          <div className="text-sm font-semibold text-slate-900">0 Queue Collisions Detected</div>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            No overlapping files or diff hunks found with other captured pull requests in this repository.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {triage.comparisons.map((comp, idx) => (
                            <div
                              key={idx}
                              className={`p-4 rounded-xl border space-y-3 ${
                                comp.matchPercentage >= 75
                                  ? 'bg-amber-50/60 border-amber-200'
                                  : 'bg-slate-50/80 border-slate-200'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 text-sm">
                                      #{comp.candidate.number}
                                    </span>
                                    <span className="text-slate-400">·</span>
                                    <span className="text-xs text-slate-700 font-medium">
                                      {comp.candidate.title}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono">
                                    Head commit {comp.candidate.headSha.slice(0, 8)} · {comp.candidate.fileCount} files
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono ${
                                      comp.matchPercentage >= 75
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : 'bg-slate-100 text-slate-800 border border-slate-200'
                                    }`}
                                  >
                                    {comp.matchPercentage}% match
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider bg-white border border-slate-200">
                                    {comp.relationship}
                                  </span>
                                </div>
                              </div>

                              <div className="text-xs bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1">
                                <div className="font-semibold text-slate-800">
                                  {comp.verdictBanner}
                                </div>
                                {comp.sharedFiles.length > 0 && (
                                  <div className="text-slate-500 flex flex-wrap items-center gap-1.5 pt-1">
                                    <span>Shared files:</span>
                                    {comp.sharedFiles.map((sf, sIdx) => (
                                      <code key={sIdx} className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-2xs">
                                        {sf}
                                      </code>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Triage data is unavailable for this pull request.</p>
                )}
              </div>
            )}

            {/* TAB PANE 3: CHANGED FILES */}
            {activeTab === 'files' && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Changed Files</h2>
                    <p className="text-xs text-slate-500">Files modified in this pull request</p>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter files..."
                      value={fileQuery}
                      onChange={(e) => setFileQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {filteredFiles.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No matching files found.</div>
                  ) : (
                    filteredFiles.map((f, i) => (
                      <div key={i} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="font-mono text-xs text-slate-900 truncate">{f.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
                          {f.additions > 0 && <span className="text-emerald-600">+{f.additions}</span>}
                          {f.deletions > 0 && <span className="text-rose-600">-{f.deletions}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB PANE 4: GITHUB CHECKS */}
            {activeTab === 'checks' && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">GitHub Check Runs</h2>
                    <p className="text-xs text-slate-500">External CI and automated status checks</p>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter checks..."
                      value={checkQuery}
                      onChange={(e) => setCheckQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {filteredChecks.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">No check runs recorded.</div>
                  ) : (
                    filteredChecks.map((c, i) => {
                      const outcome = (c.conclusion || c.status).toLowerCase();
                      const isSuccess = outcome === 'success';
                      return (
                        <div key={i} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/50">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSuccess ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            <span className="text-xs font-medium text-slate-900">{c.name}</span>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {c.conclusion || c.status}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB PANE 5: RECEIPT */}
            {activeTab === 'receipt' && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Cryptographic Evidence Receipt</h2>
                  <p className="text-xs text-slate-500">
                    Immutable SHA-256 digest binding the pull request snapshot to exact git commits
                  </p>
                </div>

                {snapshot ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Snapshot Digest</span>
                      <button
                        type="button"
                        onClick={() => copyText(snapshot.sha256, 'digest')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-xs transition"
                      >
                        {copiedDigest ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
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

            {/* TAB PANE 6: INSPECT ANOTHER */}
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
