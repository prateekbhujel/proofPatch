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
    const path = issuePathMap[issue.number]?.trim() || '';
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

  const activeTaskId =
    tasks.find((t) => context && t.repository === context.repository && t.issueNumber === context.issueNumber)?.id ??
    null;

  const selectedLocalCard = useMemo(
    () => localTasks.find((c) => Number(c.id) === selectedLocalCardId) || localTasks[0] || null,
    [localTasks, selectedLocalCardId]
  );

  // Group sidebar items by repository (Helicon style)
  const groupedRepos = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    const map = new Map<
      string,
      {
        workbench: WorkbenchTaskData[];
        cards: LocalTaskCard[];
      }
    >();

    for (const t of tasks) {
      if (q && !t.title.toLowerCase().includes(q) && !t.repository.toLowerCase().includes(q)) continue;
      const entry = map.get(t.repository) || { workbench: [], cards: [] };
      entry.workbench.push(t);
      map.set(t.repository, entry);
    }

    for (const c of localTasks) {
      if (q && !c.title.toLowerCase().includes(q) && !c.repository.toLowerCase().includes(q)) continue;
      const entry = map.get(c.repository) || { workbench: [], cards: [] };
      entry.cards.push(c);
      map.set(c.repository, entry);
    }

    return Array.from(map.entries());
  }, [tasks, localTasks, sidebarQuery]);

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

  const renderStatusBadge = (status: string, decision?: string | null) => {
    if (decision === 'VERIFIED' || status === 'completed') {
      return <span className="text-[10px] font-medium text-emerald-700 shrink-0">Done</span>;
    }
    if (status === 'needs_review') {
      return (
        <span className="text-[10px] font-medium text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded shrink-0">
          Approval
        </span>
      );
    }
    if (status === 'in_progress' || status === 'publishing') {
      return <span className="text-[10px] font-medium text-violet-700 shrink-0">Working</span>;
    }
    if (status === 'failed' || decision === 'FAILED') {
      return <span className="text-[10px] font-medium text-rose-700 shrink-0">Failed</span>;
    }
    return <span className="text-[10px] text-slate-400 shrink-0">Queued</span>;
  };

  return (
    <AppLayout activeNav="issues">
      <Head title="Issues & Tasks · ProofPatcher" />

      {/* Helicon-Inspired 2-Pane Calm Light Desktop Workbench */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden flex flex-col lg:flex-row min-h-[760px]">
        {/* ═══════════════════════ LEFT SIDEBAR: Projects & Tasks ═══════════════════════ */}
        <aside className="w-full lg:w-72 shrink-0 bg-[#f6f6f4] border-b lg:border-b-0 lg:border-r border-slate-200/80 flex flex-col justify-between">
          <div className="p-3 space-y-3">
            {/* Top Actions: New Task & Search */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setViewMode('new')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'new'
                    ? 'bg-slate-200/80 text-slate-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-slate-600" />
                  <span>New task</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">New</span>
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  id="global-search-input"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={sidebarQuery}
                  onChange={(e) => setSidebarQuery(e.target.value)}
                  placeholder="Search tasks…"
                  aria-label="Search tasks in sidebar"
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-transparent hover:bg-slate-200/40 focus:bg-white border border-transparent focus:border-slate-300 text-xs text-slate-800 placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Quick Verified Cases */}
            <div className="pt-1 border-t border-slate-200/70 space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Verified Cases
              </div>
              <button
                type="button"
                onClick={loadOwned}
                disabled={loadingOwned}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                  viewMode === 'workbench' && isOwnedFixture
                    ? 'bg-slate-200/90 text-slate-900 font-medium'
                    : 'text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-violet-700 shrink-0" />
                  <span className="truncate">OrderTotal Fixture (#101)</span>
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {loadingOwned ? '…' : 'Offline'}
                </span>
              </button>

              <button
                type="button"
                onClick={loadDedicated}
                disabled={loadingDedicated}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                  viewMode === 'workbench' && isDedicatedTestRepo
                    ? 'bg-slate-200/90 text-slate-900 font-medium'
                    : 'text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                <span className="truncate flex items-center gap-1.5">
                  <GitPullRequest className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate">Dedicated Test Issue (#1)</span>
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  {loadingDedicated ? '…' : 'GitHub'}
                </span>
              </button>
            </div>

            {/* Grouped Repositories & Tasks */}
            <div className="pt-1 border-t border-slate-200/70 space-y-2.5 max-h-[430px] overflow-y-auto pr-0.5">
              <div className="px-2 py-0.5 flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Repositories</span>
                <span>{tasks.length + localTasks.length}</span>
              </div>

              {groupedRepos.length === 0 ? (
                <p className="px-2.5 py-3 text-[11px] text-slate-400">
                  No tasks yet. Start a new task or load the OrderTotal fixture above.
                </p>
              ) : (
                groupedRepos.map(([repoName, group]) => (
                  <div key={repoName} className="space-y-0.5">
                    <div className="px-2 py-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <FolderGit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{repoName}</span>
                    </div>

                    {group.workbench.map((t) => {
                      const isSelected = viewMode === 'workbench' && activeTaskId === t.id;
                      return (
                        <button
                          key={`wb-${t.id}`}
                          type="button"
                          onClick={() => {
                            setViewMode('workbench');
                            router.post('/issues/switch-task', { task_id: t.id }, { preserveScroll: true });
                          }}
                          className={`w-full flex items-center justify-between gap-2 pl-5 pr-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                            isSelected
                              ? 'bg-slate-200/90 text-slate-900 font-medium'
                              : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                          }`}
                        >
                          <span className="truncate">{t.title}</span>
                          {renderStatusBadge(t.status, t.verificationDecision)}
                        </button>
                      );
                    })}

                    {group.cards.map((c) => {
                      const isSelected =
                        viewMode === 'local-card' && Number(selectedLocalCard?.id) === Number(c.id);
                      return (
                        <button
                          key={`card-${c.id}`}
                          type="button"
                          onClick={() => {
                            setSelectedLocalCardId(Number(c.id));
                            setViewMode('local-card');
                          }}
                          className={`w-full flex items-center justify-between gap-2 pl-5 pr-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                            isSelected
                              ? 'bg-slate-200/90 text-slate-900 font-medium'
                              : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                          }`}
                        >
                          <span className="truncate">{c.title}</span>
                          {renderStatusBadge(c.status)}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Sidebar Compact User/Account & Runtime Control */}
          <div className="sticky bottom-0 p-3 border-t border-slate-200/80 bg-[#e9e6dc] space-y-2 text-[11px] text-slate-700">
            {githubConnection?.isConnected && githubConnection.user ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {githubConnection.user.avatarUrl ? (
                    <img
                      src={githubConnection.user.avatarUrl}
                      alt={`@${githubConnection.user.login}`}
                      className="w-6 h-6 rounded-full border border-slate-300 aspect-square shrink-0"
                    />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-800 border border-violet-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {githubConnection.user.login.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      @{githubConnection.user.login}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {githubConnection.selectedRepo || 'GitHub connected'}
                    </div>
                  </div>
                </div>
                <Link
                  href="/settings"
                  aria-label="Account and GitHub settings"
                  title="Account & GitHub settings"
                  className="p-1.5 rounded-md border border-slate-300/80 bg-white text-slate-600 hover:text-slate-900 shrink-0"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-slate-200/90 text-slate-600 border border-slate-300 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 truncate">Not signed in</div>
                    <div className="text-[10px] text-slate-500 truncate">Local fixture mode</div>
                  </div>
                </div>
                <Link
                  href="/settings"
                  className="px-2 py-1 rounded-md border border-slate-300 bg-white text-[11px] font-medium text-slate-800 hover:bg-slate-50 shrink-0"
                >
                  Sign in →
                </Link>
              </div>
            )}

            <div className="pt-1.5 border-t border-slate-300/60 flex items-center justify-between text-[10px] text-slate-600">
              <span className="inline-flex items-center gap-1 truncate">
                <Sparkles className="w-3 h-3 text-violet-700 shrink-0" />
                <span>{modelKeyAvailable ? 'Muse ready' : 'Offline mode'}</span>
              </span>
              <span className="font-mono">
                {budget ? `${budget.attempts}/${budget.maxAttempts} req` : '0 req'}
              </span>
            </div>
          </div>
        </aside>

        {/* ═══════════════════════ RIGHT MAIN PANE: Single Focused Task ═══════════════════════ */}
        <div className="flex-1 min-w-0 bg-white flex flex-col justify-between">
          <div>
            {/* Top Context Bar */}
            <div className="h-12 px-6 border-b border-slate-200/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-600 truncate">
                {viewMode === 'workbench' && context ? (
                  <>
                    <span className="font-semibold text-slate-900 truncate">{context.repository}</span>
                    <span className="text-slate-300">/</span>
                    <span className="font-mono text-slate-600">#{context.issueNumber}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      {context.path}
                    </span>
                  </>
                ) : viewMode === 'local-card' && selectedLocalCard ? (
                  <>
                    <span className="font-semibold text-slate-900 truncate">{selectedLocalCard.repository}</span>
                    <span className="text-slate-300">/</span>
                    <span className="truncate text-slate-600">{selectedLocalCard.title}</span>
                  </>
                ) : (
                  <span className="font-semibold text-slate-900">New task</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <details className="relative text-xs">
                  <summary className="cursor-pointer text-[11px] text-slate-500 hover:text-slate-800 list-none inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-slate-50">
                    <Shield className="w-3 h-3 text-slate-500" />
                    <span>Execution boundary</span>
                  </summary>
                  <div className="absolute right-0 mt-1.5 w-80 p-3 rounded-xl border border-slate-200 bg-white shadow-lg text-[11px] text-slate-600 z-30 space-y-1">
                    <p className="font-semibold text-slate-900">Worktrees are not security sandboxes.</p>
                    <p>
                      Untrusted or model-generated code cannot run on this computer without an isolated microVM runner. Only the allowlisted checked-in fixture runs locally.
                    </p>
                  </div>
                </details>
              </div>
            </div>

            {/* Main Focused Content Container */}
            <div className="max-w-3xl mx-auto px-6 py-7 space-y-6">
              {/* Global Error Alert */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900 flex items-start gap-2.5"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* ──────────────── MODE 1: NEW TASK / INTAKE LAUNCHER ──────────────── */}
              {viewMode === 'new' && (
                <div className="space-y-7 pt-2">
                  <div className="text-center space-y-1.5">
                    <h1 className="text-2xl font-serif tracking-tight text-slate-900">
                      Start a task in <span className="text-violet-700 underline decoration-violet-300 decoration-dotted underline-offset-4">ProofPatcher</span>
                    </h1>
                    <p className="text-xs text-slate-500">
                      Create a local task card, open a connected repository issue, or load a verified repair case.
                    </p>
                  </div>

                  {/* Clean Helicon-style Prompt/Task Composer */}
                  <NewTaskComposer
                    githubConnection={githubConnection}
                    onCreated={() => {
                      setViewMode('local-card');
                    }}
                  />

                  {/* Connected Repository Issue Picker */}
                  {githubConnection?.isConnected ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            Connected GitHub Issues
                          </span>
                          <span className="text-[11px] text-slate-500">
                            (@{githubConnection.user?.login})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label="Select connected repository"
                            value={githubConnection.selectedRepo || ''}
                            onChange={(e) => handleSelectRepo(e.target.value)}
                            disabled={loadingRepo}
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono text-slate-800"
                          >
                            <option value="">Choose repository…</option>
                            {githubConnection.repositories.map((repo) => (
                              <option key={repo.fullName} value={repo.fullName}>
                                {repo.fullName} {repo.isPrivate ? '(Private)' : ''}
                              </option>
                            ))}
                          </select>
                          {githubConnection.selectedRepo && (
                            <button
                              type="button"
                              onClick={() => handleSelectRepo(githubConnection.selectedRepo!)}
                              disabled={loadingRepo}
                              title="Refresh repository issues"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${loadingRepo ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                        </div>
                      </div>

                      {githubConnection.selectedRepo &&
                      githubConnection.repoIssues &&
                      githubConnection.repoIssues.length > 0 ? (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {githubConnection.repoIssues.map((issue) => {
                            const targetPath = issuePathMap[issue.number] ?? '';
                            const isLoadingThis = loadingIssueNum === issue.number;
                            const triage = issue.triage;
                            const isExpanded = expandedCommentIssue === issue.number;
                            const isCommentCopied = copiedIssueComment === issue.number;

                            return (
                              <div
                                key={issue.number}
                                className="rounded-lg border border-slate-200 bg-white p-3 space-y-2"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-mono font-semibold text-slate-500">
                                        #{issue.number}
                                      </span>
                                      <a
                                        href={issue.htmlUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-semibold text-slate-900 hover:text-violet-700 hover:underline truncate"
                                      >
                                        {issue.title}
                                      </a>
                                      {triage && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                          {triage.badge}
                                        </span>
                                      )}
                                    </div>
                                    {triage && (
                                      <p className="text-[11px] text-slate-500 mt-0.5">{triage.headline}</p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {triage?.suggestedComment && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedCommentIssue(isExpanded ? null : issue.number)
                                        }
                                        className="px-2 py-1 text-[11px] font-medium rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                      >
                                        {isExpanded ? 'Hide note' : 'Suggested reply'}
                                      </button>
                                    )}
                                    <input
                                      type="text"
                                      autoComplete="off"
                                      autoCorrect="off"
                                      autoCapitalize="off"
                                      spellCheck={false}
                                      value={targetPath}
                                      onChange={(e) =>
                                        setIssuePathMap((prev) => ({
                                          ...prev,
                                          [issue.number]: e.target.value,
                                        }))
                                      }
                                      placeholder="src/OrderTotal.php"
                                      className="w-36 rounded border border-slate-300 px-2 py-1 text-[11px] font-mono"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleLoadIssue(issue)}
                                      disabled={isLoadingThis || !targetPath.trim()}
                                      className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40"
                                    >
                                      {isLoadingThis ? '…' : 'Open'}
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && triage?.suggestedComment && (
                                  <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-[11px] space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-slate-700 flex items-center gap-1">
                                        <Bot className="w-3 h-3 text-violet-700" />
                                        Suggested maintainer comment
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(triage.suggestedComment);
                                          setCopiedIssueComment(issue.number);
                                          setTimeout(() => setCopiedIssueComment(null), 2000);
                                        }}
                                        className="text-[10px] font-medium text-violet-700 hover:underline"
                                      >
                                        {isCommentCopied ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                    <pre className="whitespace-pre-wrap font-mono text-slate-700 bg-white p-2 rounded border border-slate-200">
                                      {triage.suggestedComment}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          Select a repository above to browse open issues, or load a verified case below.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {/* Quick Starters & Public URL Import */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Quick Start &amp; Public Issue Import
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={loadOwned}
                        disabled={loadingOwned}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 text-left transition flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            OrderTotal Bug (#101 · Offline Fixture)
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Reproduce baseline failure, inspect diff, and run 5-gate verifier.
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 shrink-0" />
                      </button>

                      <button
                        type="button"
                        onClick={loadDedicated}
                        disabled={loadingDedicated}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100/70 text-left transition flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-semibold text-slate-900">
                            Dedicated Test Repo Issue (#1)
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Fetch live test issue, verify repair, and prepare a Draft PR.
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 shrink-0" />
                      </button>
                    </div>

                    <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                      <summary className="cursor-pointer font-medium text-slate-700">
                        Import by public GitHub Issue URL &amp; file path
                      </summary>
                      <form onSubmit={captureIssue} className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="url"
                          required
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          placeholder="https://github.com/owner/repo/issues/1"
                          value={capture.data.issue_url}
                          onChange={(e) => capture.setData('issue_url', e.target.value)}
                          className="sm:col-span-6 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                        />
                        <input
                          required
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          placeholder="src/OrderTotal.php"
                          value={capture.data.path}
                          onChange={(e) => capture.setData('path', e.target.value)}
                          className="sm:col-span-4 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono"
                        />
                        <button
                          type="submit"
                          disabled={capture.processing}
                          className="sm:col-span-2 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
                        >
                          {capture.processing ? '…' : 'Load'}
                        </button>
                      </form>
                    </details>
                  </div>
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
                  {/* 1. Focused Issue Header & Source Context */}
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {isDedicatedTestRepo
                          ? 'Dedicated Test Repository'
                          : isOwnedFixture || context.isSynthetic
                          ? 'Bundled Fixture'
                          : 'Public GitHub Issue'}
                      </span>
                      {context.issueUrl && (
                        <a
                          href={context.issueUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-mono text-violet-700 hover:underline inline-flex items-center gap-1"
                        >
                          <span>
                            {context.repository}#{context.issueNumber}
                          </span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <h1 className="text-lg font-semibold text-slate-900 tracking-tight">
                      {context.title}
                    </h1>

                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                      {context.body || '(No description)'}
                    </p>

                    <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                      <summary className="cursor-pointer font-medium text-slate-800 flex items-center justify-between">
                        <span className="font-mono">{context.path}</span>
                        <span className="font-mono text-[11px] text-slate-400">
                          SHA-256: {context.sourceSha256.slice(0, 12)}…
                        </span>
                      </summary>
                      <pre className="mt-2.5 max-h-52 overflow-auto whitespace-pre rounded-lg bg-slate-50 p-3 text-xs font-mono text-slate-800 border border-slate-200">
                        {context.source}
                      </pre>
                    </details>
                  </div>

                  {/* 2. Helicon-Style In-Context Approval Card (when proposal not yet generated) */}
                  <ThinkingAnimation
                    isActive={sending}
                    steps={museThinkingSteps}
                    title="Requesting single-file repair proposal"
                    subtitle="Validating target file constraints…"
                  />

                  {!suggestion && !sending && (
                    <form
                      onSubmit={requestSuggestion}
                      className="rounded-2xl border-2 border-amber-200/90 bg-amber-50/25 p-5 space-y-3.5 shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <h2 className="text-xs font-semibold text-slate-900">
                            {budget?.canRequest && modelKeyAvailable
                              ? 'Muse Spark Open wants to propose a change to ' + context.path
                              : 'Offline reference repair available for ' + context.path}
                          </h2>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            Nothing runs until you decide. Review the target file and request digest below.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg bg-white border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <span>
                          $ {budget?.canRequest && modelKeyAvailable ? `propose --model muse-spark-open-1026 ${context.path}` : `load-reference-repair ${context.path}`}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {budget?.canRequest && modelKeyAvailable
                            ? `Est. $${(preview.estimatedMicros / 1_000_000).toFixed(4)}`
                            : '$0.00 (offline)'}
                        </span>
                      </div>

                      <details className="text-[11px] text-slate-600">
                        <summary className="cursor-pointer font-medium text-slate-700">
                          Inspect request payload &amp; SHA-256 digest ({preview.digest.slice(0, 12)}…)
                        </summary>
                        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-2.5 font-mono text-[11px] text-slate-800 border border-slate-200">
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
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Allow once (Offline reference repair)</span>
                              </button>
                              {budget?.canRequest && modelKeyAvailable && (
                                <button
                                  type="submit"
                                  disabled={!modelContextAllowed || sending}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-40 transition"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-violet-700" />
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
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition"
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

                  {/* 3. Helicon-Style Readable Inline Diff Card */}
                  {suggestion && (
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                      <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-slate-900">
                          <FileCode className="w-4 h-4 text-violet-700" />
                          <span>{suggestion.path}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-semibold text-emerald-700">+1</span>
                          <span className="text-xs font-mono font-semibold text-rose-700">-1</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              suggestion.candidate?.verified
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
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

                      <div className="px-4 py-1.5 bg-slate-100/80 border-b border-slate-200/80 font-mono text-[11px] text-slate-500">
                        @@ -14,3 +14,3 @@ OrderTotal::calculate(array $items)
                      </div>

                      <div className="font-mono text-xs divide-y divide-slate-100">
                        <div className="bg-rose-50/75 text-rose-950 px-4 py-2.5 flex items-start gap-3 overflow-x-auto">
                          <span className="text-rose-400 select-none w-5 text-right shrink-0">15</span>
                          <span className="text-rose-600 select-none shrink-0">-</span>
                          <pre className="whitespace-pre-wrap break-words line-through decoration-rose-400">
                            {suggestion.find}
                          </pre>
                        </div>
                        <div className="bg-emerald-50/75 text-emerald-950 px-4 py-2.5 flex items-start gap-3 overflow-x-auto">
                          <span className="text-emerald-600/70 select-none w-5 text-right shrink-0">15</span>
                          <span className="text-emerald-700 select-none shrink-0">+</span>
                          <pre className="whitespace-pre-wrap break-words">
                            {suggestion.replace}
                          </pre>
                        </div>
                      </div>

                      {/* Footer status row inside diff card (just like Helicon yt_05.png) */}
                      <div className="px-4 py-3 bg-white border-t border-slate-200 space-y-2">
                        <p className="text-xs text-slate-700 leading-relaxed">{suggestion.explanation}</p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            <CheckCircle2
                              className={`w-3.5 h-3.5 ${
                                verificationReport?.decision === 'VERIFIED'
                                  ? 'text-emerald-600'
                                  : 'text-slate-400'
                              }`}
                            />
                            <span
                              className={
                                verificationReport?.decision === 'VERIFIED'
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-slate-600 font-medium'
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
                                className="p-0.5 text-slate-400 hover:text-slate-700"
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

                        {suggestion.candidate && (
                          <details className="text-[11px] text-slate-600 pt-1">
                            <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-900">
                              View full in-memory candidate file (Applied to disk: No)
                            </summary>
                            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre rounded-lg bg-slate-50 p-2.5 text-[11px] font-mono text-slate-800 border border-slate-200">
                              {suggestion.candidate.source}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 4. In-Context 5-Gate Verifier Card (only shown when verification is available!) */}
                  {suggestion && (isOwnedFixture || isDedicatedTestRepo) && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-violet-700" />
                            <span>5-Gate Falsifiable Verifier</span>
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Reproduces baseline bug (exit 1), checks negative control (exit 1), runs candidate (exit 0), and signs receipt.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={verifyCandidate}
                          disabled={verifying}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-50 shrink-0"
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
                        <div className="space-y-3.5 pt-2 border-t border-slate-100">
                          <VerificationPipeline
                            isRunning={verifying}
                            gates={pipelineGates}
                            decision={verificationReport.decision}
                            isSimulated={verificationReport.isSimulated}
                          />

                          {/* Compact Cryptographic Receipt Bar */}
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                                {verificationReport.decision === 'VERIFIED' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
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
                              <code className="flex-1 font-mono text-[11px] bg-white px-2.5 py-1.5 rounded border border-slate-200 text-slate-800 truncate">
                                {verificationReport.receipt?.sha256 ?? 'Unavailable'}
                              </code>
                              <button
                                type="button"
                                onClick={() =>
                                  verificationReport.receipt?.sha256 &&
                                  copyReceipt(verificationReport.receipt.sha256)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shrink-0"
                              >
                                {copiedReceipt ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-500" />
                                )}
                                <span>{copiedReceipt ? 'Copied' : 'Copy SHA'}</span>
                              </button>
                            </div>

                            <details className="text-[11px] text-slate-600 pt-1">
                              <summary className="cursor-pointer font-medium text-slate-700 flex items-center gap-1">
                                <Terminal className="w-3 h-3 text-slate-500" />
                                <span>Inspect baseline, negative control &amp; candidate run logs</span>
                              </summary>
                              <div className="mt-2 space-y-1.5 font-mono text-[11px]">
                                <div className="bg-white p-2 rounded border border-slate-200">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                                    Baseline (Exit {verificationReport.runs.baseline?.exitCode ?? '?'})
                                  </span>
                                  <p className="text-slate-700 whitespace-pre-wrap">
                                    {verificationReport.runs.baseline?.summary}
                                  </p>
                                </div>
                                <div className="bg-white p-2 rounded border border-slate-200">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                                    Negative Control (Exit {verificationReport.runs.negative?.exitCode ?? '?'})
                                  </span>
                                  <p className="text-slate-700 whitespace-pre-wrap">
                                    {verificationReport.runs.negative?.summary}
                                  </p>
                                </div>
                                <div className="bg-white p-2 rounded border border-slate-200">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                                    Candidate (Exit {verificationReport.runs.candidate?.exitCode ?? '?'})
                                  </span>
                                  <p className="text-slate-700 whitespace-pre-wrap">
                                    {verificationReport.runs.candidate?.summary}
                                  </p>
                                </div>
                              </div>
                            </details>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 5. In-Context Dedicated Test Repo Draft PR Publication */}
                  {verificationReport?.decision === 'VERIFIED' &&
                    verificationReport.isSimulated === false &&
                    isDedicatedTestRepo && (
                      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GitPullRequest className="w-4 h-4 text-emerald-700" />
                            <h3 className="text-xs font-semibold text-slate-900">
                              Draft Pull Request Publication
                            </h3>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                            Draft Only · No Auto-Merge
                          </span>
                        </div>

                        {publishedPr ? (
                          <div className="rounded-xl bg-white border border-emerald-200 p-3.5 space-y-1.5 text-xs">
                            <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Draft PR #{publishedPr.prNumber} prepared on GitHub</span>
                            </div>
                            <p className="text-slate-600 font-mono text-[11px]">
                              Branch {publishedPr.branch} · Receipt {publishedPr.receiptSha256.slice(0, 12)}…
                            </p>
                            <a
                              href={publishedPr.prUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline pt-1"
                            >
                              <span>Open Draft PR on GitHub</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-xs text-slate-600">
                              All 5 verification gates passed. Approve creating a Draft PR in the dedicated test repository.
                            </p>
                            {publisherDisconnected ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-amber-800 bg-amber-50 border border-amber-200">
                                <Lock className="w-3.5 h-3.5" />
                                <span>Held in review safety mode</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={publishDraftPr}
                                disabled={publishingPr}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-50"
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

          {/* Bottom Composer Bar (Helicon-style bottom reply/note box when a workbench task is open) */}
          {viewMode === 'workbench' && context && (
            <div className="border-t border-slate-200/80 bg-slate-50/40 px-6 py-3.5">
              <form onSubmit={handleSaveDraft} className="max-w-3xl mx-auto">
                <div className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 shadow-2xs space-y-2">
                  <label htmlFor="review-draft-note" className="sr-only">
                    Review note
                  </label>
                  <input
                    id="review-draft-note"
                    type="text"
                    value={draftForm.data.comment}
                    onChange={(e) => draftForm.setData('comment', e.target.value)}
                    placeholder="Record a local review note or observation for this task…"
                    className="w-full text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 disabled:opacity-40"
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
