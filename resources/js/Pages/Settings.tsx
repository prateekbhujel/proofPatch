import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { ThemeToggle } from '../Components/ThemeToggle';
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

  // Maintainer Automation Rules (persisted in localStorage)
  const [automationRules, setAutomationRules] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        autoTriageIssues: true,
        autoRunVerifierOnPr: true,
        requireApprovalBeforeModel: true,
        antiSlopFilter: true,
        maxDiffLines: policy.maxDiffLines ?? 300,
      };
    }
    try {
      const stored = window.localStorage.getItem('proofpatch-automation-rules');
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      autoTriageIssues: true,
      autoRunVerifierOnPr: true,
      requireApprovalBeforeModel: true,
      antiSlopFilter: true,
      maxDiffLines: policy.maxDiffLines ?? 300,
    };
  });

  const updateRule = (key: string, val: any) => {
    setAutomationRules((prev: any) => {
      const next = { ...prev, [key]: val };
      try {
        window.localStorage.setItem('proofpatch-automation-rules', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

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

  const remainingDollars = budget ? ((budget.remainingMicros || 0) / 1000000).toFixed(4) : '—';
  const ceilingDollars = budget ? ((budget.limitMicros || 0) / 1000000).toFixed(2) : '—';

  return (
    <AppLayout activeNav="settings">
      <Head title="Settings & Configuration" />

      <div className="space-y-7 w-full">
        {/* Page Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Workbench Settings</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure your GitHub App connection, model credits &amp; runtime allowance, and maintainer automation rules.
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

        {/* Section 0: Appearance & Color Theme */}
        <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Appearance &amp; Theme</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose Light, Dark, or follow your operating system preference. Saved locally in this browser.
              </p>
            </div>
            <ThemeToggle compact={false} />
          </div>
        </section>

        {/* Section 1: GitHub App Connection */}
        <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center">
                <Key className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">GitHub Connection</h2>
                <p className="text-xs text-slate-500">Connect a GitHub App to its selected repositories.</p>
              </div>
            </div>

            {githubConnection.isConnected && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Connected as @{githubConnection.user?.login}</span>
              </span>
            )}
          </div>

          {/* Connection Content */}
          <div className="p-5 space-y-6">
            {!githubConnection.isConnected && !githubConnection.deviceFlow && (
              <div className="max-w-xl space-y-5">
                <form onSubmit={handleInitiate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GitHub App Client ID
                    </label>
                    <input
                      type="text"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      placeholder="e.g. Iv1.8f2a1b9c3d4e5f60"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
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
                    <span>{isSubmitting ? 'Starting Flow...' : 'Connect GitHub App'}</span>
                  </button>
                </form>
              </div>
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

        {/* Section 2: Model Usage & Credits Allowance */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Model Credits &amp; Runtime Allowance</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Available provider allowances and measured local request usage.</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Meta Muse Allowance</span>
                <div className="text-xl font-bold text-violet-700 dark:text-violet-400 mt-1">$15.00</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Allocated Meta Muse tokens</p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Baseten Credits</span>
                <div className="text-xl font-bold text-violet-700 dark:text-violet-400 mt-1">$100.00</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Inference endpoint balance</p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Requests Used</span>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {budget ? budget.attempts : '—'} <span className="text-xs font-normal text-slate-400">{budget ? `/ ${budget.maxAttempts}` : ''}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {budget ? `${Math.max(0, budget.maxAttempts - budget.attempts)} remaining requests` : 'Active'}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Live Provider API Balance</span>
                <div className="text-xl font-bold text-slate-500 dark:text-slate-400 mt-1">Unavailable</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Not exposed via chat completion API</p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">Active Inference Target:</span>
                <code className="text-[11px] font-mono text-slate-700 dark:text-slate-300">meta-models/muse-spark-open-1026</code>
                <span className="text-slate-400">via Baseten</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Local software rate-limit ceiling: ${ceilingDollars} (${remainingDollars} reserve remaining). ProofPatcher requires maintainer confirmation before any tokens are used.
              </p>
            </div>

            {/* 3-Pillar Architecture & Global Provider Extensibility Matrix */}
            <div className="pt-2 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Global Provider &amp; Sandbox Architecture
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Single-Use Digest Protocol</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-violet-200 dark:border-violet-800/70 bg-violet-50/40 dark:bg-violet-950/20 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                    <span>Meta Muse Spark</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">Active</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Reasoning &amp; single-file patch synthesis (<code className="font-mono text-[10px]">muse-spark-open-1026</code>) plus anti-slop PR review.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                    <span>Baseten Serving</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">Active</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Low-latency OpenAI-compatible serving (<code className="font-mono text-[10px]">api.baseten.co</code>) with deterministic token telemetry.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/30 dark:bg-amber-950/20 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-slate-100">
                    <span>Modal gVisor Sandbox</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">gVisor MicroVM</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Ephemeral zero-network (<code className="font-mono text-[10px]">block_network=True</code>) microVM sandbox for untrusted PR/candidate test execution.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  <strong className="text-slate-700 dark:text-slate-300">Global Provider Support:</strong> Extensible adapter layer supports Meta Direct, Baseten, Anthropic Claude, OpenAI Codex, and Local vLLM/Ollama under the same SHA-256 single-use approval gate.
                </span>
                <span className="font-mono text-[10px] text-violet-700 dark:text-violet-400">Demo Stack: Meta + Baseten + Modal</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Maintainer Automation Rules */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Maintainer Automation Rules</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Choose which co-maintainer tasks run automatically on your repositories.</p>
            </div>
          </div>

          <div className="p-5 space-y-3.5 text-xs">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={automationRules.autoTriageIssues}
                onChange={(e) => updateRule('autoTriageIssues', e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Automated Issue Triage</span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Analyze incoming GitHub issues for reproduction steps and generate classification badges (Bug, Feature, Invalid, Needs Info).
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={automationRules.autoRunVerifierOnPr}
                onChange={(e) => updateRule('autoRunVerifierOnPr', e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Automated 5-Gate Verifier</span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Automatically run baseline failure reproduction, negative control, candidate test, AST token check, and allowlist integrity.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={automationRules.requireApprovalBeforeModel}
                onChange={(e) => updateRule('requireApprovalBeforeModel', e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Require Maintainer Approval Before Model Requests (Safety Boundary)</span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Never call external LLM endpoints without an explicit maintainer click and a single-use pinned request digest token.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 cursor-pointer">
              <input
                type="checkbox"
                checked={automationRules.antiSlopFilter}
                onChange={(e) => updateRule('antiSlopFilter', e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
              />
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Anti-Slop Code Quality Filter</span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Flag low-substance pull requests lacking tests or failing static safety rules as candidate rejections.
                </p>
              </div>
            </label>

            <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Maximum Diff Line Threshold</span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Review bounds reject massive monolithic PRs exceeding this size.
                </p>
              </div>
              <input
                type="number"
                min="50"
                max="2000"
                step="50"
                value={automationRules.maxDiffLines}
                onChange={(e) => updateRule('maxDiffLines', Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-xs font-mono text-slate-900 dark:text-slate-100"
              />
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
              <h2 className="text-sm font-semibold text-slate-900">Review boundaries</h2>
              <p className="text-xs text-slate-500">How the current review workflow handles code.</p>
            </div>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/30 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Layers className="w-4 h-4 text-violet-700" />
                  <span>Running code</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Worktrees keep changes separate from your branch, but they are <strong>not security sandboxes</strong>. Untrusted code needs an isolated runner.
                </p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/30 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Shield className="w-4 h-4 text-emerald-700" />
                  <span>Repository access</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  The GitHub App can list selected repositories. Model requests currently require public content; private content is not sent.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-500">
              Active Policy (.proofpatchrc.json): Maximum diff length: {policy.maxDiffLines ?? 300} lines · Other checks depend on the selected workflow.
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
