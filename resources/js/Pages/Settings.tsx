import React, { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { ThemeToggle } from '../Components/ThemeToggle';
import {
  Shield,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Check,
  FolderGit2,
  GitPullRequest,
  Search,
  BarChart3,
} from 'lucide-react';
import { SettingsProps } from '../Components/settings/types';

function SettingToggleRow({
  title,
  description,
  checked,
  onChange,
  children,
}: {
  title: string;
  description: string;
  checked?: boolean;
  onChange?: (val: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-3 flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        <p className="text-slate-500 dark:text-slate-400 text-[11px]">{description}</p>
      </div>
      {children || (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
        />
      )}
    </div>
  );
}

export default function Settings({
  githubConnection,
  budget,
  policy = {},
  statusMessage,
  errorMessage,
}: SettingsProps) {
  const { props } = usePage();

  const [activeTab, setActiveTab] = useState<'code-review' | 'usage' | 'github' | 'general'>('code-review');
  const [usageSubTab, setUsageSubTab] = useState<'overview' | 'analytics'>('overview');

  const [clientIdInput, setClientIdInput] = useState(githubConnection.clientId || '');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repoSearchQuery, setRepoSearchQuery] = useState('');

  const [automationRules, setAutomationRules] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        automaticReview: true,
        reviewTrigger: 'On PR open',
        exhaustiveCodeReview: true,
        useCreditsForReviews: false,
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
      automaticReview: true,
      reviewTrigger: 'On PR open',
      exhaustiveCodeReview: true,
      useCreditsForReviews: false,
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
    if (confirm('Disconnect GitHub account? Active session tokens and cached repositories will be cleared.')) {
      setIsSubmitting(true);
      router.post('/github/device/disconnect', {}, {
        onFinish: () => setIsSubmitting(false),
      });
    }
  };

  const handleSelectRepo = (repoName: string) => {
    router.post('/github/repositories/select', { repository: repoName });
  };

  const repositories = githubConnection.repositories || [];
  const filteredRepositories = repositories.filter((r) =>
    r.fullName.toLowerCase().includes(repoSearchQuery.toLowerCase().trim())
  );

  return (
    <AppLayout activeNav="settings">
      <Head title="Settings · ProofPatcher" />

      <div className="space-y-6 w-full max-w-4xl mx-auto">
        {/* Top Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Settings</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Configure code review preferences, usage allowances, GitHub connection, and sandbox parameters.
          </p>
        </div>

        {/* Alerts */}
        {(statusMessage || githubConnection.statusMessage) && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage || githubConnection.statusMessage}</span>
          </div>
        )}

        {(errorMessage || githubConnection.errorMessage) && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage || githubConnection.errorMessage}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <nav className="flex space-x-6 sm:space-x-8 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('code-review')}
              className={`py-2.5 px-1 border-b-2 text-xs font-semibold inline-flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === 'code-review'
                  ? 'border-violet-700 text-violet-900 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>Code Review</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('usage')}
              className={`py-2.5 px-1 border-b-2 text-xs font-semibold inline-flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === 'usage'
                  ? 'border-violet-700 text-violet-900 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Usage &amp; Limits</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('github')}
              className={`py-2.5 px-1 border-b-2 text-xs font-semibold inline-flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === 'github'
                  ? 'border-violet-700 text-violet-900 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>GitHub Connection</span>
              {githubConnection.isConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`py-2.5 px-1 border-b-2 text-xs font-semibold inline-flex items-center gap-2 transition whitespace-nowrap ${
                activeTab === 'general'
                  ? 'border-violet-700 text-violet-900 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>General &amp; Sandbox</span>
            </button>
          </nav>
        </div>

        {/* ═══════════════════════ TAB 1: CODE REVIEW ═══════════════════════ */}
        {activeTab === 'code-review' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#141821] rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Repositories</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose a repository to configure its automatic reviews
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  <FolderGit2 className="w-3 h-3 text-slate-500" />
                  <span>{githubConnection.isConnected ? 'GitHub' : 'Not Connected'}</span>
                </div>
              </div>

              {githubConnection.isConnected ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search repositories"
                      value={repoSearchQuery}
                      onChange={(e) => setRepoSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-600 shadow-2xs"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                    {filteredRepositories.map((repo) => {
                      const isSelected = githubConnection.selectedRepo === repo.fullName;
                      return (
                        <div
                          key={repo.fullName}
                          onClick={() => handleSelectRepo(repo.fullName)}
                          className={`p-3 text-xs flex items-center justify-between cursor-pointer transition ${
                            isSelected
                              ? 'bg-violet-50/70 dark:bg-violet-950/40 text-violet-900 dark:text-violet-300 font-semibold'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{repo.fullName}</span>
                            {repo.isPrivate && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                Private
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-violet-700 dark:text-violet-400" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-3 text-center bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                  Connect a GitHub account to configure repository reviews
                </p>
              )}
            </div>

            <div className="bg-white dark:bg-[#141821] rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Personal preferences</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Saved in this browser. Automatic actions are not active yet.
                </p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <SettingToggleRow
                  title="Automatic review"
                  description="If a repository's review setting differs from your personal preference, the repository setting takes priority"
                  checked={automationRules.automaticReview}
                  onChange={(val) => updateRule('automaticReview', val)}
                />

                <SettingToggleRow
                  title="Review trigger"
                  description="Choose when ProofPatcher should review your pull requests"
                >
                  <select
                    value={automationRules.reviewTrigger}
                    onChange={(e) => updateRule('reviewTrigger', e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
                  >
                    <option value="On PR open">On PR open</option>
                    <option value="On push">On push</option>
                    <option value="Manual">Manual inspection</option>
                  </select>
                </SettingToggleRow>

                <SettingToggleRow
                  title="Exhaustive code review"
                  description="Keep looking for findings until no new potential regressions are detected"
                  checked={automationRules.exhaustiveCodeReview}
                  onChange={(val) => updateRule('exhaustiveCodeReview', val)}
                />

                <SettingToggleRow
                  title="Use credits for reviews"
                  description="Allow credits to be consumed for reviews after rate limits"
                  checked={automationRules.useCreditsForReviews}
                  onChange={(val) => updateRule('useCreditsForReviews', val)}
                />

                <SettingToggleRow
                  title="Automated Issue Triage"
                  description="Analyze issue descriptions and candidate patches before running verification"
                  checked={automationRules.autoTriageIssues}
                  onChange={(val) => updateRule('autoTriageIssues', val)}
                />

                <SettingToggleRow
                  title="Automated 5-Gate Verifier"
                  description="Execute the 5-gate verifier automatically when a candidate patch is approved"
                  checked={automationRules.autoRunVerifierOnPr}
                  onChange={(val) => updateRule('autoRunVerifierOnPr', val)}
                />

                <SettingToggleRow
                  title="Require Maintainer Approval Before Model Requests"
                  description="Require single-use approval token before external inference calls"
                  checked={automationRules.requireApprovalBeforeModel}
                  onChange={(val) => updateRule('requireApprovalBeforeModel', val)}
                />

                <SettingToggleRow
                  title="Anti-Slop Code Quality Filter"
                  description="Reject AI slop PRs lacking test coverage or exceeding change boundaries"
                  checked={automationRules.antiSlopFilter}
                  onChange={(val) => updateRule('antiSlopFilter', val)}
                />

                <SettingToggleRow
                  title="Maximum Diff Line Threshold"
                  description="Maximum lines changed allowed in a single PR triage policy"
                >
                  <input
                    type="number"
                    min={50}
                    max={2000}
                    step={50}
                    value={automationRules.maxDiffLines}
                    onChange={(e) => updateRule('maxDiffLines', parseInt(e.target.value, 10))}
                    className="w-24 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-right"
                  />
                </SettingToggleRow>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════ TAB 2: USAGE & LIMITS ═══════════════════════ */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setUsageSubTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  usageSubTab === 'overview'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setUsageSubTab('analytics')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  usageSubTab === 'analytics'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Analytics
              </button>
            </div>

            {usageSubTab === 'overview' ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#141821]">
                  <h2 className="text-sm font-semibold">Provider balances</h2>
                  <p className="mt-2 text-sm text-slate-500">Unavailable here. Check your provider dashboard for balances and billing.</p>
                  {budget && (
                    <div className="mt-5 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                      <h3 className="font-medium">Local request budget</h3>
                      <p className="mt-1 text-slate-500">{budget.attempts} of {budget.maxAttempts} attempts · ${(budget.remainingMicros / 1000000).toFixed(2)} estimated remaining</p>
                      <p className="mt-1 text-xs text-slate-500">Local estimates are not provider balances or billing limits.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-[#141821] rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
                <h2 className="text-sm font-semibold">Usage history</h2>
                <p className="text-sm text-slate-500">Provider usage is not available in ProofPatcher. Check your provider dashboard.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════ TAB 3: GITHUB CONNECTION ═══════════════════════ */}
        {activeTab === 'github' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#141821] rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-violet-700 dark:text-violet-400" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">GitHub OAuth Device Flow (RFC 8628)</h2>
                </div>
                {githubConnection.isConnected && (
                  <span className="text-xs px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Connected
                  </span>
                )}
              </div>

              {githubConnection.isConnected && githubConnection.user ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      {githubConnection.user.avatarUrl ? (
                        <img
                          src={githubConnection.user.avatarUrl}
                          alt={`@${githubConnection.user.login}`}
                          className="w-10 h-10 rounded-full border border-slate-300"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-violet-600 text-white font-bold flex items-center justify-center">
                          {githubConnection.user.login.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          @{githubConnection.user.login}
                        </div>
                        <p className="text-xs text-slate-500">
                          {repositories.length} repository {repositories.length === 1 ? 'access granted' : 'accesses granted'}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={isSubmitting}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50 transition"
                    >
                      Disconnect Account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <form onSubmit={handleInitiate} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                        GitHub OAuth App Client ID
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">
                        Connects ProofPatcher to your repositories via Device Flow (RFC 8628). Find your Client ID under{' '}
                        <a
                          href="https://github.com/settings/developers"
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-600 underline font-medium"
                        >
                          GitHub &gt; Settings &gt; Developer settings &gt; OAuth Apps
                        </a>
                        , or keep the pre-configured default.
                      </p>
                      <input
                        type="text"
                        value={clientIdInput}
                        onChange={(e) => setClientIdInput(e.target.value)}
                        placeholder="e.g. Iv1.8f2a1b9c3d4e5f60"
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-md font-mono"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting || !clientIdInput.trim()}
                      className="px-4 py-2 text-xs font-semibold rounded-md text-white bg-slate-900 hover:bg-slate-800 transition"
                    >
                      {isSubmitting ? 'Starting...' : 'Connect GitHub App'}
                    </button>
                  </form>

                  {githubConnection.deviceFlow && (
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Verification Code: <span className="font-mono text-violet-700 font-bold">{githubConnection.deviceFlow.userCode}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={copyUserCode}
                          className="px-3 py-1 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700"
                        >
                          {copiedCode ? 'Copied' : 'Copy Code'}
                        </button>
                        <a
                          href={githubConnection.deviceFlow.verificationUri}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 text-xs font-semibold rounded text-white bg-violet-700"
                        >
                          Authorize on GitHub →
                        </a>
                        <button
                          type="button"
                          onClick={handlePoll}
                          disabled={isSubmitting}
                          className="px-3 py-1 text-xs font-medium rounded border border-slate-300 bg-white"
                        >
                          Check Status
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════ TAB 4: GENERAL & SANDBOX ═══════════════════════ */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#141821] rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Appearance &amp; Theme</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Choose Light, Dark, or follow your operating system preference.
                  </p>
                </div>
                <ThemeToggle compact={false} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#141821] rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Global Provider &amp; Sandbox Architecture
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Multi-tier execution boundary ensuring zero private data leakage and verifiable runtime constraints.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">1. Meta Muse Spark</div>
                  <p className="text-[11px] text-slate-500">
                    Reasoning engine for issue triage, anti-slop PR classification, and minimal bug repair generation.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">2. Baseten Inference</div>
                  <p className="text-[11px] text-slate-500">
                    High-throughput dedicated model deployment with single-use maintainer approval token verification.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-1">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    3. Modal gVisor Sandbox
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Ephemeral zero-network microVM execution with <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.2 rounded font-mono text-violet-700">block_network=True</code> preventing untrusted code from exfiltrating data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
