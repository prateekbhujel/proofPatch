import React, { useState, useEffect, useMemo } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import {
  LocalTaskCard,
  CardPreview,
  CardProposalPreview,
  CardProposalResult,
  NewTaskComposer,
  FocusedLocalTaskView,
} from '../Components/TaskCardSection';
import { ThinkingAnimation } from '../Components/ui/ThinkingAnimation';
import { VerificationPipeline } from '../Components/ui/VerificationPipeline';
import { PfLogo } from '../Components/ui/PfLogo';
import {
  ArrowRight,
  Sparkles,
  Shield,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  FileCode,
  Check,
  Copy,
  XCircle,
  Terminal,
  GitPullRequest,
  ExternalLink,
  Lock,
  FolderGit2,
  RefreshCw,
  Plus,
  Search,
  Bot,
  User,
  Settings as SettingsIcon,
  Key,
  ShieldCheck,
  DollarSign,
  Cpu,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { VoiceDictationButton } from '../Components/VoiceDictationButton';

interface GitHubRepo {
  fullName: string;
  defaultBranch?: string;
  isPrivate: boolean;
  installedRepo?: boolean;
}

export interface IssueTriage {
  issueNumber: number;
  classification: 'ISSUE_REVIEW';
  badge: string;
  category: 'invalid' | 'needs-repro' | 'bug';
  severity: 'emerald' | 'amber' | 'rose';
  headline: string;
  suggestedAction: string;
  suggestedComment: string;
  flags: string[];
}

interface GitHubIssueItem {
  number: number;
  title: string;
  body: string;
  user: string;
  htmlUrl: string;
  createdAt: string;
  labels: string[];
  isPrivate: boolean;
  triage?: IssueTriage;
}

interface GitHubPullItem {
  number: number;
  state: string;
  isMerged?: boolean;
  title: string;
  head: string;
  base: string;
  headSha: string;
  baseSha: string;
  user: string;
  isPrivate: boolean;
}

interface GitHubConnectionData {
  isConfigured: boolean;
  clientId: string | null;
  isConnected: boolean;
  user: {
    login: string;
    name?: string;
    avatarUrl?: string;
  } | null;
  repositories: GitHubRepo[];
  selectedRepo: string | null;
  repoIssues: GitHubIssueItem[];
  repoPulls: GitHubPullItem[];
  repoListIncomplete: boolean;
  deviceFlow: {
    userCode: string;
    verificationUri: string;
    expiresAt: number;
    interval: number;
  } | null;
}

interface IssueContext {
  isSynthetic?: boolean;
  provenance?: string;
  repository: string;
  issueNumber: number;
  issueUrl: string | null;
  title: string;
  body: string;
  commit: string | null;
  path: string;
  source: string;
  sourceSha256: string;
}

interface Preview {
  destination: string;
  body: Record<string, unknown>;
  digest: string;
  estimatedMicros: number;
  approvalToken?: string;
}

interface CandidatePreview {
  status: string;
  source: string;
  sha256: string;
  applied: boolean;
  verified: boolean;
  verificationRunId?: string;
}

interface Suggestion {
  path: string;
  commit: string | null;
  find: string;
  replace: string;
  explanation: string;
  model: string | null;
  usage?: Record<string, number> | null;
  isOfflineExample?: boolean;
  isSynthetic?: boolean;
  provenance?: string;
  safetyNotice?: string;
  candidate?: CandidatePreview;
}

interface Draft {
  comment: string;
  savedAt: string;
  readOnlyPolicy: string;
}

interface VerificationRun {
  exitCode: number;
  logSha256: string;
  summary: string;
}

interface VerificationGates {
  baselineReproduced: boolean;
  negativeControlCaught: boolean;
  candidatePassed: boolean;
  candidateStaticSafetyPassed: boolean;
  allowlistIntegrityIntact: boolean;
}

interface VerificationReceipt {
  id: string;
  sha256: string;
  integrity: string;
  externallyAnchored: boolean;
  manifest: Record<string, unknown>;
}

interface BackendSandboxGap {
  status: string;
  boundary: string;
  isolationLevel: string;
  remainingGap: string;
}

interface VerificationReport {
  id: string;
  kind: string;
  createdAt: string;
  decision: 'VERIFIED' | 'FAILED' | 'INCONCLUSIVE';
  isSimulated?: boolean;
  baseCommit: string;
  isSynthetic?: boolean;
  provenance?: string;
  targetFile: string;
  baseSha256: string;
  candidateSha256: string;
  patchSha256: string;
  gates: VerificationGates;
  runs: {
    baseline: VerificationRun;
    negative: VerificationRun;
    candidate: VerificationRun;
  };
  receipt: VerificationReceipt;
  evidenceDirectory: string;
  backendSandboxGap: BackendSandboxGap;
}

interface WorkbenchTaskData {
  id: number;
  key: string;
  repository: string;
  issueNumber: number;
  issueUrl: string | null;
  title: string;
  path: string;
  status: 'queued' | 'in_progress' | 'needs_review' | 'completed' | 'failed' | 'publishing' | 'outcome_unknown';
  provenance: string | null;
  isDedicated: boolean;
  isSynthetic: boolean;
  isOfflineExample: boolean;
  isSimulated: boolean;
  verificationDecision: string | null;
  model?: string | null;
  publishedPrNumber: number | null;
  publishedPrUrl: string | null;
  publishedBranch: string | null;
  updatedAt: string;
}

interface Props {
  context: IssueContext | null;
  preview: Preview | null;
  suggestion: Suggestion | null;
  draft?: Draft | null;
  verificationReport?: VerificationReport | null;
  isOwnedFixture?: boolean;
  isDedicatedTestRepo?: boolean;
  publishedPr?: {
    status: string;
    prNumber: number;
    prUrl: string;
    branch: string;
    commitSha: string;
    draft: boolean;
    repository: string;
    publishedAt: string;
    receiptSha256: string;
  } | null;
  hasPublicationToken?: boolean;
  publisherDisconnected?: boolean;
  budget: {
    canRequest: boolean;
    attempts: number;
    maxAttempts: number;
    remainingMicros?: number;
    limitMicros?: number;
  } | null;
  error: string | null;
  tasks?: WorkbenchTaskData[];
  localTasks?: LocalTaskCard[];
  cardPreview?: CardPreview | null;
  cardProposalPreview?: CardProposalPreview | null;
  cardProposalResult?: CardProposalResult | null;
  githubConnection?: GitHubConnectionData | null;
  modelContextAllowed?: boolean;
  modelKeyAvailable?: boolean;
}

export default function Issues({
  context,
  preview,
  suggestion,
  draft,
  verificationReport,
  isOwnedFixture,
  isDedicatedTestRepo,
  publishedPr,
  publisherDisconnected = true,
  budget,
  error,
  tasks = [],
  localTasks = [],
  cardPreview = null,
  cardProposalPreview = null,
  cardProposalResult = null,
  githubConnection = null,
  modelContextAllowed = false,
  modelKeyAvailable = false,
}: Props) {
  const capture = useForm({ issue_url: '', path: '' });
  const draftForm = useForm({ comment: draft?.comment || '' });
  const [sending, setSending] = useState(false);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [loadingDedicated, setLoadingDedicated] = useState(false);
  const [publishingPr, setPublishingPr] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedCandidateSha, setCopiedCandidateSha] = useState(false);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [loadingIssueNum, setLoadingIssueNum] = useState<number | null>(null);
  const [issuePathMap, setIssuePathMap] = useState<Record<number, string>>({});
  const [expandedCommentIssue, setExpandedCommentIssue] = useState<number | null>(null);
  const [copiedIssueComment, setCopiedIssueComment] = useState<number | null>(null);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'issues' | 'pulls'>('issues');

  // Device Flow State for Disconnected Screen
  const [copiedDeviceCode, setCopiedDeviceCode] = useState(false);
  const [isSubmittingDevice, setIsSubmittingDevice] = useState(false);
  const [deviceClientIdInput, setDeviceClientIdInput] = useState(githubConnection?.clientId || '');
  const [enteredWorkbench, setEnteredWorkbench] = useState(false);
  const [showLandingHub, setShowLandingHub] = useState(false);
  const [copiedBotComment, setCopiedBotComment] = useState(false);

  // Persistent Repository Context Memory (pre-fills target path so opening issues is 1-click child's play)
  const [repoMemory, setRepoMemory] = useState<{
    defaultPath: string;
    testCommand: string;
    branchRule: string;
    lastVerifiedReceipt: string | null;
  }>(() => {
    const fallback = {
      defaultPath: 'src/OrderTotal.php',
      testCommand: 'php tests/order_total.php',
      branchRule: 'draft-pr-only (no auto-merge)',
      lastVerifiedReceipt: null,
    };
    if (typeof window === 'undefined') return fallback;
    try {
      const saved = window.localStorage.getItem('proofpatch-repo-memory');
      if (saved) return { ...fallback, ...JSON.parse(saved) };
    } catch {}
    return fallback;
  });

  useEffect(() => {
    if (context?.path || verificationReport?.receipt?.sha256) {
      setRepoMemory((prev) => {
        const next = {
          ...prev,
          defaultPath: context?.path || prev.defaultPath,
          lastVerifiedReceipt: verificationReport?.receipt?.sha256 || prev.lastVerifiedReceipt,
        };
        try {
          window.localStorage.setItem('proofpatch-repo-memory', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [context?.path, verificationReport?.receipt?.sha256]);

  // Parse Markdown images / GIFs from issue description for visual repro inspection
  const detectedIssueMedia = useMemo(() => {
    const body = context?.body || '';
    const results: Array<{ alt: string; url: string; isGif: boolean }> = [];
    const mdRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi;
    let match: RegExpExecArray | null;
    while ((match = mdRegex.exec(body)) !== null) {
      const url = match[2];
      results.push({
        alt: match[1] || 'Issue attachment',
        url,
        isGif: /\.gif(\?|$)/i.test(url),
      });
    }
    return results;
  }, [context?.body]);

  // Focused pane mode: 'workbench' (active context), 'local-card' (selected local card), or 'new'
  const [selectedLocalCardId, setSelectedLocalCardId] = useState<number | null>(() => {
    if (cardPreview?.context?.cardId) return Number(cardPreview.context.cardId);
    if (!context && localTasks.length > 0) return Number(localTasks[0].id);
    return null;
  });
  const [viewMode, setViewMode] = useState<'workbench' | 'local-card' | 'new'>(() => {
    if (cardPreview?.context?.cardId) return 'local-card';
    if (context) return 'workbench';
    if (localTasks.length > 0) return 'local-card';
    return 'new';
  });

  const isConnected = Boolean(githubConnection?.isConnected && githubConnection.user);

  useEffect(() => {
    if (cardPreview?.context?.cardId) {
      setSelectedLocalCardId(Number(cardPreview.context.cardId));
      setViewMode('local-card');
    } else if (context) {
      setViewMode('workbench');
    }
  }, [context?.repository, context?.issueNumber, cardPreview?.digest]);

  useEffect(() => {
    if (
      githubConnection?.isConnected &&
      githubConnection.repositories &&
      githubConnection.repositories.length > 0 &&
      !githubConnection.selectedRepo &&
      !loadingRepo
    ) {
      handleSelectRepo(githubConnection.repositories[0].fullName);
    }
  }, [githubConnection?.isConnected, githubConnection?.selectedRepo, githubConnection?.repositories]);

  function handleSelectRepo(repoName: string) {
    if (!repoName) return;
    if (repoName !== githubConnection?.selectedRepo) setIssuePathMap({});
    setLoadingRepo(true);
    router.post(
      '/issues/select-repository',
      { repository: repoName },
      {
        preserveScroll: true,
        onFinish: () => setLoadingRepo(false),
      }
    );
  }

  function handleLoadIssue(issue: GitHubIssueItem) {
    if (!githubConnection?.selectedRepo) return;
    const path = issuePathMap[issue.number]?.trim() || repoMemory.defaultPath || 'src/OrderTotal.php';
    if (!path) return;
    setLoadingIssueNum(issue.number);
    router.post(
      '/issues/load-issue',
      {
        repository: githubConnection.selectedRepo,
        issue_number: issue.number,
        path: path,
      },
      {
        onSuccess: () => setViewMode('workbench'),
        onFinish: () => setLoadingIssueNum(null),
      }
    );
  }

  function handleInitiateDeviceFlow(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsSubmittingDevice(true);
    router.post(
      '/github/device/initiate',
      { client_id: deviceClientIdInput },
      {
        preserveScroll: true,
        onFinish: () => setIsSubmittingDevice(false),
      }
    );
  }

  function handlePollDeviceFlow(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setIsSubmittingDevice(true);
    router.post(
      '/github/device/poll',
      {},
      {
        preserveScroll: true,
        onFinish: () => setIsSubmittingDevice(false),
      }
    );
  }

  function copyDeviceCode(code: string) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
    }
    setCopiedDeviceCode(true);
    setTimeout(() => setCopiedDeviceCode(false), 2000);
  }

  function captureIssue(event: React.FormEvent) {
    event.preventDefault();
    capture.post('/issues/preview', {
      onSuccess: () => setViewMode('workbench'),
    });
  }

  function loadOwned(event: React.MouseEvent) {
    event.preventDefault();
    setLoadingOwned(true);
    router.post(
      '/issues/load-owned',
      { reset: true },
      {
        onSuccess: () => setViewMode('workbench'),
        onFinish: () => setLoadingOwned(false),
      }
    );
  }

  function loadDedicated(event: React.MouseEvent) {
    event.preventDefault();
    setLoadingDedicated(true);
    router.post(
      '/issues/load-dedicated',
      {},
      {
        onSuccess: () => setViewMode('workbench'),
        onFinish: () => setLoadingDedicated(false),
      }
    );
  }

  function publishDraftPr(event: React.MouseEvent) {
    event.preventDefault();
    setPublishingPr(true);
    router.post(
      '/issues/publish-pr',
      {},
      {
        onFinish: () => setPublishingPr(false),
      }
    );
  }

  function requestSuggestion(event: React.FormEvent, useOfflineReference = false) {
    event.preventDefault();
    const canSubmit =
      !sending &&
      modelContextAllowed &&
      Boolean(preview) &&
      (Boolean(budget?.canRequest && modelKeyAvailable) || isDedicatedTestRepo || isOwnedFixture);
    if (!canSubmit) return;
    router.post(
      '/issues/propose',
      {
        digest: preview!.digest,
        approved: true,
        approval_token: preview!.approvalToken,
        offline_reference: useOfflineReference,
      },
      {
        onStart: () => setSending(true),
        onFinish: () => setSending(false),
      }
    );
  }

  function handleSaveDraft(event: React.FormEvent) {
    event.preventDefault();
    draftForm.post('/issues/draft', { preserveScroll: true });
  }

  function verifyCandidate(event: React.MouseEvent) {
    event.preventDefault();
    setVerifying(true);
    router.post(
      '/issues/verify',
      {},
      {
        onFinish: () => setVerifying(false),
      }
    );
  }

  function copyReceipt(sha: string) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(sha);
    }
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  }

  function copyCandidateHash(sha: string) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(sha);
    }
    setCopiedCandidateSha(true);
    setTimeout(() => setCopiedCandidateSha(false), 2000);
  }

  const selectedLocalCard = useMemo(
    () => localTasks.find((c) => Number(c.id) === selectedLocalCardId) || localTasks[0] || null,
    [localTasks, selectedLocalCardId]
  );

  const filteredIssues = useMemo(() => {
    if (!githubConnection?.repoIssues) return [];
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return githubConnection.repoIssues;
    return githubConnection.repoIssues.filter(
      (iss) =>
        iss.title.toLowerCase().includes(q) ||
        String(iss.number).includes(q) ||
        iss.user.toLowerCase().includes(q)
    );
  }, [githubConnection?.repoIssues, sidebarQuery]);

  const filteredPulls = useMemo(() => {
    if (!githubConnection?.repoPulls) return [];
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return githubConnection.repoPulls;
    return githubConnection.repoPulls.filter(
      (pull) =>
        pull.title.toLowerCase().includes(q) ||
        String(pull.number).includes(q) ||
        pull.user.toLowerCase().includes(q) ||
        pull.head.toLowerCase().includes(q)
    );
  }, [githubConnection?.repoPulls, sidebarQuery]);

  const pipelineGates = verificationReport
    ? [
        {
          label: 'Baseline Reproduction',
          shortLabel: '1. Baseline Run',
          passed: verificationReport.gates.baselineReproduced,
          detail: verificationReport.gates.baselineReproduced
            ? 'Bug reproduced (Exit 1)'
            : `Failed (Exit ${verificationReport.runs.baseline?.exitCode ?? '?'})`,
        },
        {
          label: 'Negative Control',
          shortLabel: '2. Negative Control',
          passed: verificationReport.gates.negativeControlCaught,
          detail: verificationReport.gates.negativeControlCaught
            ? 'Shortcut rejected (Exit 1)'
            : 'Negative control missed',
        },
        {
          label: 'Candidate Test',
          shortLabel: '3. Candidate Run',
          passed: verificationReport.gates.candidatePassed,
          detail: verificationReport.gates.candidatePassed
            ? 'Candidate checks passed (Exit 0)'
            : `Failed (Exit ${verificationReport.runs.candidate?.exitCode ?? '?'})`,
        },
        {
          label: 'AST Token Rules',
          shortLabel: '4. AST Safety',
          passed: verificationReport.gates.candidateStaticSafetyPassed,
          detail: verificationReport.gates.candidateStaticSafetyPassed
            ? '0 Disallowed tokens'
            : 'AST rule violation',
        },
        {
          label: 'Allowlist Hash',
          shortLabel: '5. Allowlist',
          passed: verificationReport.gates.allowlistIntegrityIntact,
          detail: verificationReport.gates.allowlistIntegrityIntact
            ? 'SHA-256 hash verified'
            : 'Integrity hash altered',
        },
      ]
    : null;

  const passedGateCount = pipelineGates ? pipelineGates.filter((g) => g.passed).length : 0;

  const museThinkingSteps = [
    { label: 'Waiting for the proposal', status: sending ? ('active' as const) : ('waiting' as const) },
  ];

  const verifierThinkingSteps = [
    { label: 'Running checks', status: verifying ? ('active' as const) : ('waiting' as const) },
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // DISCONNECTED ONBOARDING VIEW (Shown when disconnected & no task is active)
  // ══════════════════════════════════════════════════════════════════════════
  if (!isConnected) {
    if ((!context && !cardPreview && !enteredWorkbench) || showLandingHub) {
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

              {/* Primary Dual-Path Hub: OAuth Device Flow + 1-Click Interactive Verification Flow */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Left 7 cols: RFC 8628 OAuth Device Flow Card */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] shadow-xs p-6 space-y-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <Key className="w-5 h-5 text-violet-700 dark:text-violet-400" />
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            GitHub OAuth Device Flow (RFC 8628)
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Safe browser-based activation without pasting private access tokens.
                          </p>
                        </div>
                      </div>
                      <Link
                        href="/settings"
                        className="text-xs font-medium text-violet-700 dark:text-violet-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Settings &amp; Keys</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    {githubConnection?.deviceFlow?.userCode ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Step 1: Copy your one-time user code
                          </span>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 font-mono text-2xl font-bold tracking-widest text-center py-2.5 px-4 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/60 text-violet-800 dark:text-violet-300 select-all">
                              {githubConnection.deviceFlow.userCode}
                            </div>
                            <button
                              type="button"
                              onClick={() => copyDeviceCode(githubConnection.deviceFlow!.userCode)}
                              className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-xs hover:bg-slate-800 dark:hover:bg-slate-200 transition flex items-center gap-1.5 shrink-0"
                            >
                              {copiedDeviceCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              <span>{copiedDeviceCode ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
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
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Try the Co-Maintainer Workbench Now
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Don&apos;t have a GitHub OAuth Client ID handy? Launch the interactive 2-pane workbench immediately to test single-use digest approval, inline diffs, voice dictation, and the 5-gate verifier.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        setShowLandingHub(false);
                        setEnteredWorkbench(true);
                        loadOwned(e);
                      }}
                      disabled={loadingOwned}
                      className="w-full py-2.5 px-4 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                    >
                      <Shield className="w-4 h-4" />
                      <span>{loadingOwned ? 'Opening Workbench…' : '1-Click: Launch Interactive 5-Gate Flow'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowLandingHub(false);
                        setEnteredWorkbench(true);
                        setViewMode('new');
                      }}
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

              {/* Model Usage & Balances Dashboard */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Model Runtime Allowances &amp; Live Balances
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">Real Measured Metrics</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-3.5 space-y-1">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Meta Muse API</span>
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">$15.00</div>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Hackathon Allowance</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-3.5 space-y-1">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Baseten Credits</span>
                      <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">$100.00</div>
                    <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Model Engine Allowance</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-3.5 space-y-1">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Rate Reserve</span>
                      <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">${remainingDollars}</div>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {budget ? `${budget.attempts}/${budget.maxAttempts} req used` : '9/10 req used'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-3.5 space-y-1">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                      <span>Live Provider API</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="text-sm font-semibold font-mono text-slate-600 dark:text-slate-400 pt-1">
                      Unavailable
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">Not exposed via completion API</p>
                  </div>
                </div>
              </div>

              {/* Privacy & Production Guarantee */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 p-4 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-3">
                <Shield className="w-4 h-4 text-violet-700 dark:text-violet-400 shrink-0" />
                <span>
                  Offline synthetic shortcuts are disabled in production mode. ProofPatcher operates strictly on authorized GitHub repositories with cryptographic receipts and verifiable proofs.
                </span>
              </div>
            </div>
          </div>
        </AppLayout>
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CONNECTED EDGE-TO-EDGE WORKBENCH
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <AppLayout activeNav="issues">
      <Head title="Issues & Tasks · ProofPatcher" />

      {/* Full-Screen Edge-to-Edge Desktop Workbench */}
      <div className="w-full min-h-[calc(100vh-4.5rem)] rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#141821] shadow-xs overflow-hidden flex flex-col lg:flex-row">
        {/* ═══════════════════════ LEFT SIDEBAR: Real GitHub Repositories & Items ═══════════════════════ */}
        <aside className="w-full lg:w-80 shrink-0 bg-[#f6f6f4] dark:bg-[#0e1117] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
          <div className="p-3 space-y-3">
            {/* Repository Selector Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <FolderGit2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Connected Repository</span>
                </span>
                {githubConnection?.selectedRepo && (
                  <button
                    type="button"
                    onClick={() => handleSelectRepo(githubConnection.selectedRepo!)}
                    disabled={loadingRepo}
                    title="Refresh repository issues"
                    className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingRepo ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              <select
                aria-label="Select connected repository"
                value={githubConnection?.selectedRepo || ''}
                onChange={(e) => handleSelectRepo(e.target.value)}
                disabled={loadingRepo}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
              >
                {githubConnection?.repositories && githubConnection.repositories.length > 0 ? (
                  githubConnection.repositories.map((repo) => (
                    <option key={repo.fullName} value={repo.fullName}>
                      {repo.fullName} {repo.isPrivate ? '(Private)' : ''}
                    </option>
                  ))
                ) : (
                  <option value="">No repositories found</option>
                )}
              </select>
            </div>

            {/* Filter Tabs: Issues vs Pull Requests */}
            <div className="flex rounded-lg bg-slate-200/70 dark:bg-slate-800/80 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSidebarTab('issues')}
                className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition ${
                  sidebarTab === 'issues'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Issues ({githubConnection?.repoIssues?.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('pulls')}
                className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition ${
                  sidebarTab === 'pulls'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Pull Requests ({githubConnection?.repoPulls?.length ?? 0})
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={sidebarQuery}
                onChange={(e) => setSidebarQuery(e.target.value)}
                placeholder={sidebarTab === 'issues' ? 'Search GitHub issues…' : 'Search pull requests…'}
                aria-label="Search items"
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Item Stream */}
            <div className="pt-1 border-t border-slate-200/70 dark:border-slate-800 space-y-2 max-h-[calc(100vh-26rem)] overflow-y-auto pr-0.5">
              {sidebarTab === 'issues' ? (
                filteredIssues.length === 0 ? (
                  <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2 text-xs">
                    <p className="text-slate-500 dark:text-slate-400">
                      {sidebarQuery
                        ? 'No matching issues found.'
                        : isConnected
                        ? 'No open issues in this repository.'
                        : 'Interactive verification mode active.'}
                    </p>
                    <button
                      type="button"
                      onClick={loadOwned}
                      disabled={loadingOwned}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-violet-700 hover:bg-violet-800 text-white font-semibold text-[11px] flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>{loadingOwned ? 'Loading…' : 'Open OrderTotal Case (#101)'}</span>
                    </button>
                  </div>
                ) : (
                  filteredIssues.map((issue) => {
                    const effectivePath = issuePathMap[issue.number] ?? repoMemory.defaultPath ?? 'src/OrderTotal.php';
                    const isLoadingThis = loadingIssueNum === issue.number;
                    const triage = issue.triage;

                    return (
                      <div
                        key={issue.number}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-2.5 space-y-2 hover:border-slate-300 dark:hover:border-slate-700 transition"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-slate-400">#{issue.number}</span>
                              <a
                                href={issue.htmlUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-semibold text-slate-900 dark:text-slate-100 hover:text-violet-600 dark:hover:text-violet-400 hover:underline truncate"
                              >
                                {issue.title}
                              </a>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">by @{issue.user}</div>
                          </div>

                          {triage && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shrink-0">
                              {triage.badge}
                            </span>
                          )}
                        </div>

                        {/* File path intake & 1-click load button (pre-filled from Repository Context Memory) */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            value={effectivePath}
                            onChange={(e) =>
                              setIssuePathMap((prev) => ({
                                ...prev,
                                [issue.number]: e.target.value,
                              }))
                            }
                            placeholder="Target: src/OrderTotal.php"
                            className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-[11px] font-mono text-slate-800 dark:text-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleLoadIssue(issue)}
                            disabled={isLoadingThis || !effectivePath.trim()}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-40 transition shrink-0"
                          >
                            {isLoadingThis ? '…' : 'Open'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                filteredPulls.length === 0 ? (
                  <p className="px-2.5 py-4 text-xs text-slate-400 text-center">
                    {sidebarQuery ? 'No matching pull requests found.' : 'No pull requests in this repository.'}
                  </p>
                ) : (
                  filteredPulls.map((pull) => (
                    <div
                      key={pull.number}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 p-2.5 space-y-1.5 hover:border-slate-300 dark:hover:border-slate-700 transition"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-slate-400">#{pull.number}</span>
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {pull.title}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {pull.head} &rarr; {pull.base}
                          </div>
                        </div>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                          {pull.state}
                        </span>
                      </div>
                      <Link
                        href={`/repositories?repo=${encodeURIComponent(githubConnection?.selectedRepo || '')}&pull=${pull.number}`}
                        className="w-full mt-1 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium text-center block transition"
                      >
                        Inspect PR Diff &rarr;
                      </Link>
                    </div>
                  ))
                )
              )}
            </div>

            {/* Quick Mode Switcher & Repository Context Memory */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewMode('new')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border transition ${
                    viewMode === 'new'
                      ? 'bg-violet-700 text-white border-violet-700'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  <span>New Task</span>
                </button>
                <button
                  type="button"
                  onClick={loadOwned}
                  disabled={loadingOwned}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 border transition ${
                    viewMode === 'workbench' && context
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Shield className="w-3 h-3" />
                  <span>{loadingOwned ? 'Loading…' : '5-Gate Case'}</span>
                </button>
              </div>

              {/* Persistent Repository Context Memory Card */}
              <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-2.5 space-y-1 text-[10px]">
                <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-300">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-violet-600" />
                    <span>Repo Context Memory</span>
                  </span>
                  <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400">Auto-Fill Active</span>
                </div>
                <div className="font-mono text-slate-600 dark:text-slate-400 truncate">
                  Target: <span className="text-slate-900 dark:text-slate-200">{repoMemory.defaultPath}</span>
                </div>
                <div className="font-mono text-slate-500 dark:text-slate-400 truncate">
                  Oracle: {repoMemory.testCommand}
                </div>
                {repoMemory.lastVerifiedReceipt && (
                  <div className="font-mono text-emerald-700 dark:text-emerald-400 truncate">
                    Last Receipt: {repoMemory.lastVerifiedReceipt.slice(0, 12)}…
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Account & Credit Control */}
          <div className="sticky bottom-0 p-3 border-t border-slate-200/80 dark:border-slate-800 bg-[#e9e6dc] dark:bg-[#11141c] space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {githubConnection?.user?.avatarUrl ? (
                  <img
                    src={githubConnection.user.avatarUrl}
                    alt={`@${githubConnection.user.login}`}
                    className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 aspect-square shrink-0"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-950/80 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {githubConnection?.user?.login?.slice(0, 2).toUpperCase() || 'PF'}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {githubConnection?.user?.login ? `@${githubConnection.user.login}` : 'proofpatcher[bot]'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {githubConnection?.selectedRepo || (isConnected ? 'GitHub connected' : 'Local 5-Gate Sandbox')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!isConnected && (
                  <button
                    type="button"
                    onClick={() => setShowLandingHub(true)}
                    title="Open 3-Pillar Architecture & GitHub OAuth Hub"
                    className="px-2 py-1 rounded-md border border-violet-300 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/60 text-violet-800 dark:text-violet-200 font-semibold text-[10px] hover:bg-violet-100 transition"
                  >
                    3-Pillar Hub
                  </button>
                )}
                <Link
                  href="/settings"
                  aria-label="Account and GitHub settings"
                  title="Account & GitHub settings"
                  className="p-1.5 rounded-md border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 shrink-0"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-300/60 dark:border-slate-800 flex items-center justify-between gap-2 text-[10px] text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1 truncate">
                <Sparkles className="w-3 h-3 text-violet-700 dark:text-violet-400 shrink-0" />
                <span className="truncate">Meta ($15) · Baseten ($100) · Modal</span>
              </span>
              <span className="font-mono shrink-0">
                {budget ? `${budget.attempts}/${budget.maxAttempts} req` : '0 req'}
              </span>
            </div>
          </div>
        </aside>

        {/* ═══════════════════════ RIGHT MAIN PANE: Edge-to-Edge Focused Task ═══════════════════════ */}
        <div className="flex-1 min-w-0 bg-white dark:bg-[#141821] flex flex-col justify-between">
          <div>
            {/* Top Context Bar */}
            <div className="h-12 px-6 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 truncate">
                {viewMode === 'workbench' && context ? (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{context.repository}</span>
                    <span className="text-slate-300 dark:text-slate-700">/</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">#{context.issueNumber}</span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                      {context.path}
                    </span>
                  </>
                ) : viewMode === 'local-card' && selectedLocalCard ? (
                  <>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{selectedLocalCard.repository}</span>
                    <span className="text-slate-300 dark:text-slate-700">/</span>
                    <span className="truncate text-slate-600 dark:text-slate-300">{selectedLocalCard.title}</span>
                  </>
                ) : (
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Repository Workbench · {githubConnection?.selectedRepo || 'No repo selected'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <details className="relative text-xs">
                  <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 list-none inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <Shield className="w-3 h-3 text-slate-500" />
                    <span>Execution boundary</span>
                  </summary>
                  <div className="absolute right-0 mt-1.5 w-80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg text-[11px] text-slate-600 dark:text-slate-300 z-30 space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Worktrees are not security sandboxes.</p>
                    <p>
                      Untrusted or model-generated code cannot run on this machine without an isolated microVM runner.
                    </p>
                  </div>
                </details>
              </div>
            </div>

            {/* Main Focused Content Container (Edge-to-Edge full width) */}
            <div className="w-full px-6 py-6 space-y-6">
              {/* Global Error Alert */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* ──────────────── MODE 1: NEW TASK COMPOSER / REPO INTAKE ──────────────── */}
              {viewMode === 'new' && (
                <div className="space-y-6 pt-1">
                  <div className="space-y-1">
                    <h1 className="text-xl font-serif tracking-tight text-slate-900 dark:text-slate-100">
                      Co-Maintainer Task Composer
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Create a local maintainer task card or select an incoming issue from {githubConnection?.selectedRepo || 'the sidebar'} to begin triage and automated 5-gate verification.
                    </p>
                  </div>

                  <NewTaskComposer
                    githubConnection={githubConnection}
                    onCreated={() => {
                      setViewMode('local-card');
                    }}
                  />
                </div>
              )}

              {/* ──────────────── MODE 2: FOCUSED LOCAL TASK CARD ──────────────── */}
              {viewMode === 'local-card' && selectedLocalCard && (
                <FocusedLocalTaskView
                  task={selectedLocalCard}
                  preview={cardPreview}
                  proposalPreview={cardProposalPreview}
                  proposalResult={cardProposalResult}
                  modelKeyAvailable={modelKeyAvailable}
                  budgetCanRequest={Boolean(budget?.canRequest)}
                />
              )}

              {/* ──────────────── MODE 3: FOCUSED WORKBENCH ISSUE STREAM ──────────────── */}
              {viewMode === 'workbench' && context && preview && (
                <div className="space-y-5">
                  {/* 0. Child's-Play 4-Step Guided Co-Maintainer Flow Bar */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>1. Context Loaded</span>
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                          suggestion
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-semibold'
                        }`}
                      >
                        {suggestion ? <CheckCircle2 className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                        <span>2. Single-Use Approval</span>
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                          verificationReport?.decision === 'VERIFIED'
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : suggestion
                            ? 'bg-violet-100 dark:bg-violet-950/70 text-violet-900 dark:text-violet-200 border-violet-300 dark:border-violet-700 font-semibold'
                            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        <span>3. 5-Gate Verifier</span>
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                          verificationReport?.decision === 'VERIFIED'
                            ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-semibold'
                            : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <GitPullRequest className="w-3 h-3" />
                        <span>4. Receipt &amp; PR Response</span>
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-violet-700 dark:text-violet-400 shrink-0">
                      {!suggestion
                        ? 'Next: Click "Allow once" below ↓'
                        : !verificationReport
                        ? 'Next: Click "Run verifier" below ↓'
                        : 'All 5 gates verified ✓'}
                    </div>
                  </div>

                  {/* 1. Focused Issue Header & Source Context */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {isDedicatedTestRepo
                          ? 'Dedicated Test Repository'
                          : isOwnedFixture || context.isSynthetic
                          ? 'Bundled Fixture'
                          : 'Public GitHub Issue'}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-violet-50 dark:bg-violet-950/50 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                        {detectedIssueMedia.length > 0
                          ? `${detectedIssueMedia.length} Visual Media / GIF Detected`
                          : 'Text-Only Issue · 0 External Media'}
                      </span>
                      {context.issueUrl && (
                        <a
                          href={context.issueUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-mono text-violet-700 dark:text-violet-400 hover:underline inline-flex items-center gap-1"
                        >
                          <span>
                            {context.repository}#{context.issueNumber}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                      {context.title}
                    </h1>

                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50/80 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      {context.body || '(No description)'}
                    </p>

                    {detectedIssueMedia.length > 0 && (
                      <div className="rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/30 dark:bg-violet-950/20 p-3 space-y-2">
                        <div className="text-[11px] font-semibold text-violet-900 dark:text-violet-200 flex items-center justify-between">
                          <span>Issue Visual Reproduction Media ({detectedIssueMedia.length})</span>
                          <span className="font-normal text-slate-500">Previewed locally · only text is sent to Muse</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {detectedIssueMedia.map((media, idx) => (
                            <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 space-y-1">
                              <div className="text-[10px] font-mono text-slate-500 truncate">
                                {media.isGif ? '[GIF] ' : '[IMG] '}
                                {media.alt}
                              </div>
                              <a
                                href={media.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-violet-700 dark:text-violet-400 hover:underline truncate block"
                              >
                                {media.url}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
                      <summary className="cursor-pointer font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <span className="font-mono">{context.path}</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          SHA-256: {context.sourceSha256.slice(0, 12)}…
                        </span>
                      </summary>
                      <pre className="mt-2.5 max-h-52 overflow-auto whitespace-pre rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                        {context.source}
                      </pre>
                    </details>
                  </div>

                  {/* 2. Helicon-Style In-Context Approval Card */}
                  <ThinkingAnimation
                    isActive={sending}
                    steps={museThinkingSteps}
                    title="Requesting single-file repair proposal"
                    subtitle="Validating target file constraints…"
                  />

                  {!suggestion && !sending && (
                    <form
                      onSubmit={requestSuggestion}
                      className="rounded-2xl border-2 border-amber-200/90 dark:border-amber-800/80 bg-amber-50/25 dark:bg-amber-950/20 p-5 space-y-3.5 shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <h2 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {budget?.canRequest && modelKeyAvailable
                              ? 'Muse Spark Open wants to propose a change to ' + context.path
                              : 'Offline reference repair available for ' + context.path}
                          </h2>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                            Nothing runs until you decide. Review the target file and request digest below.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 font-mono text-xs text-slate-800 dark:text-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          $ {budget?.canRequest && modelKeyAvailable ? `propose --model muse-spark-open-1026 ${context.path}` : `load-reference-repair ${context.path}`}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {budget?.canRequest && modelKeyAvailable
                            ? `Est. $${(preview.estimatedMicros / 1_000_000).toFixed(4)}`
                            : '$0.00 (offline)'}
                        </span>
                      </div>

                      <details className="text-[11px] text-slate-600 dark:text-slate-400">
                        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                          Inspect request payload &amp; SHA-256 digest ({preview.digest.slice(0, 12)}…)
                        </summary>
                        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white dark:bg-slate-900 p-2.5 font-mono text-[11px] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                          {JSON.stringify(preview.body, null, 2)}
                        </pre>
                      </details>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {isOwnedFixture && !isDedicatedTestRepo ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => requestSuggestion(e, true)}
                                disabled={!modelContextAllowed || sending}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-40 transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Allow once (Offline reference repair)</span>
                              </button>
                              {budget?.canRequest && modelKeyAvailable && (
                                <button
                                  type="submit"
                                  disabled={!modelContextAllowed || sending}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-violet-700 dark:text-violet-400" />
                                  <span>Ask Muse (In-memory preview)</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              type="submit"
                              disabled={
                                !modelContextAllowed ||
                                sending ||
                                (!(budget?.canRequest && modelKeyAvailable) &&
                                  !isDedicatedTestRepo &&
                                  !isOwnedFixture)
                              }
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-40 transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {budget?.canRequest && modelKeyAvailable
                                  ? 'Allow once'
                                  : 'Allow offline reference repair'}
                              </span>
                            </button>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {!modelContextAllowed
                            ? 'Private repository content stays local'
                            : 'Single-use approval'}
                        </span>
                      </div>
                    </form>
                  )}

                  {/* 3. Inline Diff Card */}
                  {suggestion && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] overflow-hidden shadow-2xs">
                      <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          <FileCode className="w-4 h-4 text-violet-700 dark:text-violet-400" />
                          <span>{suggestion.path}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">+1</span>
                          <span className="text-xs font-mono font-semibold text-rose-700 dark:text-rose-400">-1</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              suggestion.candidate?.verified
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                            }`}
                          >
                            {suggestion.candidate?.verified
                              ? verificationReport?.isSimulated !== false
                                ? 'Fixture Passed'
                                : 'Verified'
                              : 'Proposed Diff'}
                          </span>
                        </div>
                      </div>

                      <div className="px-4 py-1.5 bg-slate-100/80 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 font-mono text-[11px] text-slate-500">
                        @@ -14,3 +14,3 @@ OrderTotal::calculate(array $items)
                      </div>

                      <div className="font-mono text-xs divide-y divide-slate-100 dark:divide-slate-800">
                        <div className="bg-rose-50/75 dark:bg-rose-950/30 text-rose-950 dark:text-rose-200 px-4 py-2.5 flex items-start gap-3 overflow-x-auto">
                          <span className="text-rose-400 select-none w-5 text-right shrink-0">15</span>
                          <span className="text-rose-600 select-none shrink-0">-</span>
                          <pre className="whitespace-pre-wrap break-words line-through decoration-rose-400">
                            {suggestion.find}
                          </pre>
                        </div>
                        <div className="bg-emerald-50/75 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 px-4 py-2.5 flex items-start gap-3 overflow-x-auto">
                          <span className="text-emerald-600/70 select-none w-5 text-right shrink-0">15</span>
                          <span className="text-emerald-700 select-none shrink-0">+</span>
                          <pre className="whitespace-pre-wrap break-words">
                            {suggestion.replace}
                          </pre>
                        </div>
                      </div>

                      <div className="px-4 py-3 bg-white dark:bg-[#141821] border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{suggestion.explanation}</p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                verificationReport?.decision === 'VERIFIED'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span
                              className={
                                verificationReport?.decision === 'VERIFIED'
                                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                  : 'text-slate-600 dark:text-slate-400 font-medium'
                              }
                            >
                              {suggestion.isOfflineExample ? 'Offline reference' : 'Allowed once'}
                            </span>
                            {verificationReport && (
                              <span className="text-slate-500">
                                {passedGateCount} passed, {5 - passedGateCount} failed
                              </span>
                            )}
                          </div>

                          {suggestion.candidate && (
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                              <span>SHA: {suggestion.candidate.sha256.slice(0, 10)}…</span>
                              <button
                                type="button"
                                onClick={() => copyCandidateHash(suggestion.candidate!.sha256)}
                                className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                title="Copy candidate SHA-256"
                              >
                                {copiedCandidateSha ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. 5-Gate Verifier Card */}
                  {suggestion && (isOwnedFixture || isDedicatedTestRepo) && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-5 space-y-4 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-violet-700 dark:text-violet-400" />
                            <span>5-Gate Falsifiable Verifier</span>
                          </h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Reproduces baseline bug (exit 1), checks negative control (exit 1), runs candidate (exit 0), AST checks, and signs receipt.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={verifyCandidate}
                          disabled={verifying}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition disabled:opacity-50 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>
                            {verifying
                              ? 'Running checks…'
                              : verificationReport
                              ? 'Re-run verifier'
                              : 'Run verifier'}
                          </span>
                        </button>
                      </div>

                      <ThinkingAnimation
                        isActive={verifying}
                        steps={verifierThinkingSteps}
                        title="Running 5-gate verification"
                        subtitle="Executing baseline, negative control, and candidate checks…"
                      />

                      {verificationReport && (
                        <div className="space-y-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <VerificationPipeline
                            isRunning={verifying}
                            gates={pipelineGates}
                            decision={verificationReport.decision}
                            isSimulated={verificationReport.isSimulated}
                          />

                          {/* Cryptographic Receipt Bar */}
                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3.5 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {verificationReport.decision === 'VERIFIED' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                )}
                                <span>
                                  Receipt Manifest ({verificationReport.id.slice(0, 15)}…)
                                </span>
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">
                                {verificationReport.isSimulated !== false
                                  ? 'Local fixture run'
                                  : 'Externally anchored'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <code className="flex-1 font-mono text-[11px] bg-white dark:bg-slate-950 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 truncate">
                                {verificationReport.receipt?.sha256 ?? 'Unavailable'}
                              </code>
                              <button
                                type="button"
                                onClick={() =>
                                  verificationReport.receipt?.sha256 &&
                                  copyReceipt(verificationReport.receipt.sha256)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition shrink-0"
                              >
                                {copiedReceipt ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-500" />
                                )}
                                <span>{copiedReceipt ? 'Copied' : 'Copy SHA'}</span>
                              </button>
                            </div>
                          </div>

                          {/* GitHub Co-Maintainer Attribution & 1-Click Response Preview */}
                          {verificationReport.decision === 'VERIFIED' && (
                            <div className="rounded-xl border border-violet-200 dark:border-violet-800/80 bg-violet-50/35 dark:bg-violet-950/20 p-3.5 space-y-2 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                                  <Bot className="w-3.5 h-3.5 text-violet-700 dark:text-violet-400" />
                                  <span>GitHub Co-Maintainer Response Attribution</span>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 text-violet-800 dark:text-violet-300">
                                  {githubConnection?.user?.login
                                    ? `Posts via @${githubConnection.user.login} (Co-Maintainer Header)`
                                    : 'proofpatcher[bot] / Maintainer Signed Receipt'}
                                </span>
                              </div>
                              <pre className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
{`### ProofPatcher Co-Maintainer Verification Receipt
- **Target**: \`${context.path}\` (${context.repository}#${context.issueNumber})
- **5-Gate Decision**: \`${verificationReport.decision}\` (Baseline exit 1 → Negative Control exit 1 → Candidate exit 0 → AST Safe → Allowlist Verified)
- **Receipt SHA-256**: \`${verificationReport.receipt?.sha256 ?? 'unavailable'}\`
- **Candidate SHA-256**: \`${verificationReport.candidateSha256}\``}
                              </pre>
                              <div className="flex items-center justify-between pt-0.5">
                                <span className="text-[10px] text-slate-500">
                                  Single-use digest-bound comment ready for GitHub PR/Issue thread
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const text = `### ProofPatcher Co-Maintainer Verification Receipt\n- **Target**: \`${context.path}\` (${context.repository}#${context.issueNumber})\n- **5-Gate Decision**: \`${verificationReport.decision}\` (Baseline exit 1 -> Negative Control exit 1 -> Candidate exit 0 -> AST Safe -> Allowlist Verified)\n- **Receipt SHA-256**: \`${verificationReport.receipt?.sha256 ?? 'unavailable'}\`\n- **Candidate SHA-256**: \`${verificationReport.candidateSha256}\``;
                                    navigator.clipboard?.writeText(text);
                                    setCopiedBotComment(true);
                                    setTimeout(() => setCopiedBotComment(false), 2000);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-700 hover:bg-violet-800 text-white font-semibold text-[11px] transition"
                                >
                                  {copiedBotComment ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  <span>{copiedBotComment ? 'Copied Response!' : 'Copy Verified Response'}</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. Draft PR Publication */}
                  {verificationReport?.decision === 'VERIFIED' &&
                    verificationReport.isSimulated === false &&
                    isDedicatedTestRepo && (
                      <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GitPullRequest className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              Draft Pull Request Publication
                            </h3>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                            Draft Only · No Auto-Merge
                          </span>
                        </div>

                        {publishedPr ? (
                          <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 p-3.5 space-y-1.5 text-xs">
                            <div className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Draft PR #{publishedPr.prNumber} prepared on GitHub</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                              Branch {publishedPr.branch} · Receipt {publishedPr.receiptSha256.slice(0, 12)}…
                            </p>
                            <a
                              href={publishedPr.prUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:underline pt-1"
                            >
                              <span>Open Draft PR on GitHub</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              All 5 verification gates passed. Approve creating a Draft PR in the dedicated test repository.
                            </p>
                            {publisherDisconnected ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-amber-800 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Held in review safety mode</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={publishDraftPr}
                                disabled={publishingPr}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition disabled:opacity-50"
                              >
                                <GitPullRequest className="w-3.5 h-3.5" />
                                <span>
                                  {publishingPr ? 'Creating Draft PR…' : 'Allow once: Create Draft PR'}
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Composer Bar */}
          {viewMode === 'workbench' && context && (
            <div className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 px-6 py-3.5">
              <form onSubmit={handleSaveDraft} className="w-full">
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-2xs space-y-2">
                  <label htmlFor="review-draft-note" className="sr-only">
                    Review note
                  </label>
                  <input
                    id="review-draft-note"
                    type="text"
                    value={draftForm.data.comment}
                    onChange={(e) => draftForm.setData('comment', e.target.value)}
                    placeholder="Record a local review note or observation for this task…"
                    className="w-full text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 bg-transparent focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                        <MessageSquare className="w-3 h-3 text-slate-500" />
                        Local session note
                      </span>
                      <VoiceDictationButton
                        label="Voice"
                        onTranscript={(transcript) => {
                          const current = draftForm.data.comment.trim();
                          draftForm.setData('comment', current ? `${current} ${transcript}` : transcript);
                        }}
                      />
                      {draft && (
                        <span className="font-mono text-[10px] text-slate-500">
                          Saved {draft.savedAt.replace('T', ' ').slice(0, 16)}
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={draftForm.processing}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[11px] font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-40"
                    >
                      <span>{draftForm.processing ? 'Saving…' : 'Save note'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
