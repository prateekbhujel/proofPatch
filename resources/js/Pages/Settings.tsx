import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import {
  Shield,
  Key,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Sliders,
  DollarSign,
  Cpu,
  Layers,
  Copy,
  Check,
  FolderGit2,
} from 'lucide-react';

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  isPrivate: boolean;
  defaultBranch: string;
  htmlUrl: string;
}

interface GitHubConnection {
  isConfigured: boolean;
  clientId: string | null;
  isConnected: boolean;
  user: {
    login: string;
    name?: string;
    avatarUrl?: string;
    htmlUrl: string;
  } | null;
  repositories: GitHubRepo[];
  repositoriesStatus?: { truncated?: boolean; errors?: string[] } | null;
  selectedRepo: string | null;
  deviceFlow: {
    userCode: string;
    verificationUri: string;
    expiresAt: number;
    interval: number;
  } | null;
  statusMessage?: string | null;
  errorMessage?: string | null;
}

interface BudgetStatus {
  limitMicros: number;
  maxAttempts: number;
  reservedMicros: number;
  attempts: number;
  remainingMicros: number;
  canRequest: boolean;
}

interface SettingsProps {
  githubConnection: GitHubConnection;
  budget: BudgetStatus | null;
  policy: {
    maxDiffLines?: number;
    antiSlop?: boolean;
    requireTests?: boolean;
    [key: string]: any;
  };
  statusMessage?: string | null;
  errorMessage?: string | null;
}

export default function Settings({
  githubConnection,
  budget,
  policy = {},
  statusMessage,
  errorMessage,
}: SettingsProps) {
  const { props } = usePage();
  const csrfToken = (props as any).csrf_token || '';

  const [clientIdInput, setClientIdInput] = useState(githubConnection.clientId || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copyUserCode = () => {
    if (githubConnection.deviceFlow?.userCode) {
      navigator.clipboard.writeText(githubConnection.deviceFlow.userCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleInitiate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    router.post('/github/device/initiate', { client_id: clientIdInput }, {
      onFinish: () => setIsSubmitting(false),
    });
  };

  const handlePoll = () => {
    setIsSubmitting(true);
    router.post('/github/device/poll', {}, {
      onFinish: () => setIsSubmitting(false),
    });
  };

  const handleDisconnect = () => {
    if (confirm('Disconnect GitHub account? Active session tokens and cached installed repositories will be cleared.')) {
      setIsSubmitting(true);
      router.post('/github/device/disconnect', {}, {
        onFinish: () => setIsSubmitting(false),
      });
    }
  };

  const handleSelectRepo = (repoName: string) => {
    router.post('/github/repositories/select', { repository: repoName });
  };

  const spentDollars = budget ? ((budget.reservedMicros || 0) / 1000000).toFixed(4) : '0.0000';
  const remainingDollars = budget ? ((budget.remainingMicros || 0) / 1000000).toFixed(4) : '0.2000';
  const ceilingDollars = budget ? ((budget.limitMicros || 0) / 1000000).toFixed(2) : '0.20';

  return (
    <AppLayout activeNav="settings">
      <Head title="Settings & Configuration" />

      <div className="space-y-7 max-w-5xl mx-auto">
        {/* Page Header */}
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Workbench Settings</h1>
          <p className="mt-1 text-xs text-slate-500">
            Configure your GitHub App connection, monitor model runtime budget limits, and inspect security boundaries.
          </p>
        </div>

        {/* Status & Error Alerts */}
        {(statusMessage || githubConnection.statusMessage) && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 motion-safe:transition motion-reduce:transition-none">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage || githubConnection.statusMessage}</span>
          </div>
        )}

        {(errorMessage || githubConnection.errorMessage) && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2 motion-safe:transition motion-reduce:transition-none">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage || githubConnection.errorMessage}</span>
          </div>
        )}

        {/* Section 1: GitHub App Connection */}
        <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center">
                <Key className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">GitHub Connection</h2>
                <p className="text-xs text-slate-500">Connect to selected owned public repositories without pasting secret access tokens.</p>
              </div>
            </div>

            {githubConnection.isConnected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Connected as @{githubConnection.user?.login}</span>
              </span>
            )}
          </div>

          {/* Connection Content */}
          <div className="p-5 space-y-6">
            {!githubConnection.isConnected && !githubConnection.deviceFlow && (
              <form onSubmit={handleInitiate} className="max-w-xl space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GitHub App Client ID
                  </label>
                  <input
                    type="text"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="e.g. Iv1.8f2a1b9c3d4e5f60"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:border-transparent"
                    required
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Client ID from your registered GitHub App (must have Device Flow enabled). No Client Secret is needed or stored.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !clientIdInput.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Starting Flow...' : 'Connect GitHub'}</span>
                </button>
              </form>
            )}

            {githubConnection.deviceFlow && !githubConnection.isConnected && (
              <div className="max-w-xl space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">Your Verification Code</span>
                  <span className="text-[11px] text-slate-500 font-mono">Expires in ~15 mins</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2.5 rounded-md bg-white border border-slate-300 font-mono text-lg font-bold tracking-widest text-violet-700 shadow-2xs">
                    {githubConnection.deviceFlow.userCode}
                  </div>
                  <button
                    type="button"
                    onClick={copyUserCode}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs transition"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href={githubConnection.deviceFlow.verificationUri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
                  >
                    <span>1. Authorize on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={handlePoll}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-xs transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                    <span>2. Check Authorization Status</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="text-xs text-slate-500 hover:text-slate-700 hover:underline px-2 py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {githubConnection.isConnected && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-3">
                    {githubConnection.user?.avatarUrl ? (
                      <img
                        src={githubConnection.user.avatarUrl}
                        alt={githubConnection.user.login}
                        className="w-10 h-10 rounded-full border border-slate-300"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">
                        {githubConnection.user?.login.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {githubConnection.user?.name || githubConnection.user?.login}
                        </span>
                        <a
                          href={githubConnection.user?.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-400 hover:text-slate-600 inline-flex items-center gap-0.5"
                        >
                          <span>@{githubConnection.user?.login}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Connected via GitHub App (read-only repository access)
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 self-start sm:self-center"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Disconnect</span>
                  </button>
                </div>

                {/* Authorized Repositories List */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                    Authorized Repositories ({githubConnection.repositories.length})
                  </h3>

                  {githubConnection.repositories.length === 0 ? (
                    <p className="text-xs text-slate-500 p-3 bg-slate-50 rounded-md border border-slate-200">
                      No repositories authorized. Visit your GitHub App installation to grant repository access.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {githubConnection.repositories.map((repo) => {
                        const isSelected = githubConnection.selectedRepo === repo.fullName;
                        return (
                          <div
                            key={repo.id}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-xs transition ${
                              isSelected
                                ? 'border-violet-400 bg-violet-50/50'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <FolderGit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-900 truncate">{repo.fullName}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium ${
                                    repo.isPrivate
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {repo.isPrivate ? 'Private (disabled)' : 'Public'}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">{repo.defaultBranch}</span>
                              </div>
                            </div>

                            {!repo.isPrivate && (
                              <button
                                type="button"
                                onClick={() => handleSelectRepo(repo.fullName)}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                                  isSelected
                                    ? 'bg-violet-700 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {isSelected ? 'Active' : 'Select'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Runtime Model Budget & Reservation Ledger */}
        <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Runtime Model Budget Ledger</h2>
              <p className="text-xs text-slate-500">Strictly bounded local ledger for single public-PR review inference.</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cumulative Ceiling</span>
                <div className="text-xl font-bold text-slate-900 mt-1">${ceilingDollars}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">Max {budget?.maxAttempts ?? 10} attempts total</p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Attempts Consumed</span>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {budget?.attempts ?? 0} <span className="text-xs font-normal text-slate-400">/ {budget?.maxAttempts ?? 10}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {budget ? Math.max(0, budget.maxAttempts - budget.attempts) : 0} remaining attempts
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Remaining Balance</span>
                <div className="text-xl font-bold text-emerald-700 mt-1">${remainingDollars}</div>
                <p className="text-[11px] text-slate-500 mt-0.5">Personal spend: $0.00</p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 space-y-1">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-800">Inference Target:</span>
                <code className="text-[11px] font-mono text-slate-700">meta-models/muse-spark-open-1026</code>
                <span className="text-slate-400">via Baseten</span>
              </div>
              <p className="text-[11px] text-slate-500">
                All requests require explicit maintainer confirmation and single-use server-held tokens before execution.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: Policies & Security Boundaries */}
        <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Security Architecture & Review Policy</h2>
              <p className="text-xs text-slate-500">Strict guarantees and boundary definitions for the local workbench.</p>
            </div>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/30 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Layers className="w-4 h-4 text-violet-700" />
                  <span>Worktree Execution Boundary</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  ProofPatcher operates on dedicated, isolated Git worktrees. Worktrees provide filesystem isolation from your primary branch, but are <strong>not security sandboxes</strong>. Untrusted repository code is never executed without container isolation.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/30 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Shield className="w-4 h-4 text-emerald-700" />
                  <span>Public Repositories Only</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Private and unknown-visibility repository captures are disabled. ProofPatcher strictly limits captures, triage, and reviews to explicitly public repositories, and fails closed on local private artifacts.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-500">
              Active Policy (.proofpatchrc.json): Maximum diff length: {policy.maxDiffLines ?? 300} lines · Anti-slop checks enabled · Strict DOM & visual verifier gates.
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
