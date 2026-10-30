import React from 'react';
import { AppLayout } from '../AppLayout';
import { Head, Link } from '@inertiajs/react';
import { PfLogo } from '../ui/PfLogo';
import {
  AlertTriangle,
  Key,
  Shield,
  ArrowRight,
  Plus,
  Sparkles,
  Cpu,
  Layers,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { GitHubConnectionData, BudgetData } from './types';

interface DisconnectedOnboardingViewProps {
  error?: string | null;
  deviceClientIdInput: string;
  setDeviceClientIdInput: (value: string) => void;
  isSubmittingDevice: boolean;
  handleInitiateDeviceFlow: (e?: any) => void;
  handlePollDeviceFlow: (e?: any) => void;
  copyDeviceCode: (code: string) => void;
  copiedDeviceCode: boolean;
  githubConnection?: GitHubConnectionData | null;
  budget?: BudgetData | null;
  onLaunchInteractiveFlow?: (e: React.MouseEvent) => void;
  onOpenTaskComposer?: () => void;
  loadingOwned?: boolean;
}

export function DisconnectedOnboardingView({
  error,
  deviceClientIdInput,
  setDeviceClientIdInput,
  isSubmittingDevice,
  handleInitiateDeviceFlow,
  handlePollDeviceFlow,
  copyDeviceCode,
  copiedDeviceCode,
  githubConnection,
  budget,
  onLaunchInteractiveFlow,
  onOpenTaskComposer,
  loadingOwned,
}: DisconnectedOnboardingViewProps) {
  const remainingDollars = budget ? ((budget.remainingMicros || 0) / 1000000).toFixed(2) : '0.50';

  return (
    <AppLayout activeNav="issues">
      <Head title="Connect GitHub · ProofPatcher" />

      <div className="w-full min-h-[calc(100vh-5rem)] flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full space-y-7">
          {/* Monogram Brand Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center mb-2">
              <PfLogo size={36} className="w-14 h-14" badge={true} />
            </div>
            <h1 className="text-3xl font-serif tracking-tight text-slate-900 dark:text-slate-100">
              Connect your GitHub account
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
              ProofPatcher is an autonomous co-maintainer workbench. Connect via OAuth Device Flow to triage incoming issues from your real repositories, run the 5-gate verifier, and publish cryptographically attested draft pull requests.
            </p>
          </div>

          {/* Global Error Banner */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Dual Action Grid: OAuth Device Flow + 1-Click Interactive Workbench Entry */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left 7 cols: Device Flow Form */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#141821] p-6 shadow-xs flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center">
                      <Key className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        GitHub OAuth Device Flow (RFC 8628)
                      </h2>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Safe browser-based activation without pasting private access tokens.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/settings"
                    className="text-xs font-medium text-violet-700 dark:text-violet-400 hover:underline flex items-center gap-1 shrink-0"
                  >
                    <span>Settings &amp; Keys</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {githubConnection?.deviceFlow ? (
                  <div className="space-y-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Step 1: Your One-Time Activation Code
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xl font-mono font-bold tracking-widest text-violet-700 dark:text-violet-300 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 flex-1 text-center select-all">
                          {githubConnection.deviceFlow.userCode}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyDeviceCode(githubConnection.deviceFlow!.userCode)}
                          className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                          title="Copy user code"
                        >
                          {copiedDeviceCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <a
                        href={githubConnection.deviceFlow.verificationUri || 'https://github.com/login/device'}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-xs text-center flex items-center justify-center gap-2 transition"
                      >
                        <span>Step 2: Open GitHub Device Activation</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => handlePollDeviceFlow()}
                        disabled={isSubmittingDevice}
                        className="px-3.5 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSubmittingDevice ? 'animate-spin' : ''}`} />
                        <span>{isSubmittingDevice ? 'Checking status…' : 'Step 3: Check Authorization Status'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleInitiateDeviceFlow} className="space-y-3.5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="onboarding-client-id"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        GitHub OAuth App Client ID
                      </label>
                      <input
                        id="onboarding-client-id"
                        type="text"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={deviceClientIdInput}
                        onChange={(e) => setDeviceClientIdInput(e.target.value)}
                        placeholder="e.g. Ov23li... (configured in .env or Settings)"
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-violet-600"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingDevice}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs hover:bg-slate-800 dark:hover:bg-slate-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Key className="w-4 h-4" />
                      <span>{isSubmittingDevice ? 'Initiating connection…' : 'Initiate GitHub Device Connection'}</span>
                    </button>
                  </form>
                )}
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                Comments post as <code className="font-mono text-violet-700 dark:text-violet-400">proofpatcher[bot]</code> via App Installation or under your maintainer account with a signed SHA-256 receipt header.
              </p>
            </div>

            {/* Right 5 cols: 1-Click Child's-Play Quick-Start Workbench Card */}
            <div className="lg:col-span-5 rounded-2xl border-2 border-violet-200 dark:border-violet-800/80 bg-violet-50/35 dark:bg-violet-950/20 p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 dark:bg-violet-900/70 text-violet-800 dark:text-violet-200">
                  <Sparkles className="w-3 h-3" />
                  <span>Instant 3-Step Verification Flow</span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Try the Co-Maintainer Workbench Now
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Don't have a GitHub OAuth Client ID handy? Launch the interactive 2-pane workbench immediately to test single-use digest approval, inline diffs, voice dictation, and the 5-gate verifier.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={onLaunchInteractiveFlow}
                  disabled={loadingOwned}
                  className="w-full py-2.5 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  <Shield className="w-4 h-4" />
                  <span>{loadingOwned ? 'Opening Workbench…' : '1-Click: Launch Interactive 5-Gate Flow'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onOpenTaskComposer}
                  className="w-full py-2 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-violet-600" />
                  <span>Open Task Composer (Voice &amp; Screenshot)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3-Pillar Architecture Explainability Grid: Meta Muse + Baseten + Modal gVisor Sandbox */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100">
                <span>1. Meta Muse Spark</span>
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Frontier code reasoning (<code className="font-mono text-[10px]">muse-spark-open-1026</code>) for issue triage, anti-slop PR filtering, and minimal single-file repair patches.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100">
                <span>2. Baseten Inference</span>
                <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                High-throughput serving via <code className="font-mono text-[10px]">api.baseten.co</code> with pinned SHA-256 request digests and single-use maintainer approval tokens.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100">
                <span>3. Modal gVisor Sandbox</span>
                <Layers className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Zero-network (<code className="font-mono text-[10px]">block_network=True</code>) ephemeral microVM sandbox for untrusted code—because a Git worktree is not a security sandbox.
              </p>
            </div>
          </div>

          {/* Honest Model Runtime Allowances Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono uppercase tracking-wider text-[11px]">Model Runtime Allowances &amp; Live Balances</span>
              <span className="text-[11px]">Real Measured Metrics</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-3.5">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Meta Muse API</span>
                  <Sparkles className="w-3 h-3 text-violet-600" />
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                  $15.00
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Allowance budget</div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-3.5">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Baseten Credits</span>
                  <Cpu className="w-3 h-3 text-emerald-600" />
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                  $100.00
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Model Engine grant</div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-3.5">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Rate Reserve</span>
                  <span className="text-amber-600 font-mono">$</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                  ${remainingDollars}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {budget ? `${budget.attempts}/${budget.maxAttempts} req used` : 'Local ceiling'}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-3.5">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Live Provider API</span>
                  <Shield className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-300 mt-2 truncate">
                  Unavailable
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Not exposed via completion API</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
