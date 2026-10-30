import React, { useState, useEffect } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '../Components/AppLayout';
import { TaskCardSection, LocalTaskCard } from '../Components/TaskCardSection';
import { KanbanBoard, KanbanTask } from '../Components/ui/KanbanBoard';
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
  Kanban,
  Clock,
  Layers,
  FolderGit2,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sliders,
  Bot,
  BadgeCheck,
} from 'lucide-react';

/* ────────────────────────────────────────────── types ── */
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
  budget: { canRequest: boolean; attempts: number; maxAttempts: number } | null;
  error: string | null;
  tasks?: WorkbenchTaskData[];
  localTasks?: LocalTaskCard[];
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
  hasPublicationToken,
  publisherDisconnected = true,
  budget,
  error,
  tasks = [],
  localTasks = [],
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
  const [showPayloadDetails, setShowPayloadDetails] = useState(false);
  const [loadingRepo, setLoadingRepo] = useState(false);
  const [loadingIssueNum, setLoadingIssueNum] = useState<number | null>(null);
  const [issuePathMap, setIssuePathMap] = useState<Record<number, string>>({});
  const [intakeCollapsed, setIntakeCollapsed] = useState(false);
  const [expandedCommentIssue, setExpandedCommentIssue] = useState<number | null>(null);
  const [copiedIssueComment, setCopiedIssueComment] = useState<number | null>(null);

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
        onFinish: () => setLoadingIssueNum(null),
      }
    );
  }

  function captureIssue(event: React.FormEvent) {
    event.preventDefault();
    capture.post('/issues/preview');
  }

  function loadOwned(event: React.MouseEvent) {
    event.preventDefault();
    setLoadingOwned(true);
    router.post(
      '/issues/load-owned',
      {},
      {
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

  function requestSuggestion(event: React.FormEvent) {
    event.preventDefault();
    const canSubmit = !sending && modelContextAllowed && Boolean(preview) && (Boolean(budget?.canRequest && modelKeyAvailable) || isDedicatedTestRepo || isOwnedFixture);
    if (!canSubmit) return;
    router.post(
      '/issues/propose',
      {
        digest: preview!.digest,
        approved: true,
        approval_token: preview!.approvalToken,
      },
      {
        onStart: () => setSending(true),
        onFinish: () => setSending(false),
      }
    );
  }

  function handleSaveDraft(event: React.FormEvent) {
    event.preventDefault();
    draftForm.post('/issues/draft');
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

  const activeTaskId = tasks.find(
    (t) => context && t.repository === context.repository && t.issueNumber === context.issueNumber
  )?.id ?? null;

  // Verification Pipeline Gates
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

  const museThinkingSteps = [
    { label: 'Waiting for the proposal', status: sending ? 'active' as const : 'waiting' as const },
  ];

  const verifierThinkingSteps = [
    { label: 'Running checks', status: verifying ? 'active' as const : 'waiting' as const },
  ];

  return (
    <AppLayout activeNav="issues">
      <Head title="Issues Workbench · ProofPatcher" />
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>Issues Workbench</span>
              <span className="text-[11px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                Live Interactive Mode
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag-and-drop task triage, AI code proposal, and falsifiable 5-gate verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-200 shadow-2xs">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              Read-Only Workbench
            </span>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-2xs">
            {error}
          </div>
        )}

        {/* Falsifiable Sandbox Guard Notice */}
        <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-amber-50/40 p-4 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-0.5">
            <p className="font-bold">Host execution disabled</p>
            <p className="text-amber-800 leading-relaxed">
              Model-generated or untrusted candidate code cannot be executed on the host. Worktrees, temporary directories, and token filters are not security sandboxes; an isolated microVM runner is required.
            </p>
          </div>
        </div>

        {/* ═══════════════════════ Drag-and-Drop Kanban Board ═══════════════════════ */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Kanban className="w-3.5 h-3.5 text-violet-600" />
                Maintainer Task Board
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Drag cards to organize triage. Cards stay backed strictly by verified server execution results.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <Sparkles className="w-3 h-3 text-violet-600" />
              <span>Drag &amp; Drop Enabled</span>
            </div>
          </div>

          <KanbanBoard
            tasks={tasks}
            activeTaskId={activeTaskId}
            onSelectTask={(task) => router.post('/issues/switch-task', { task_id: task.id })}
          />
        </section>

        {/* ═══════════════════════ Independent Task Cards Section ═══════════════════════ */}
        <TaskCardSection
          localTasks={localTasks}
          githubConnection={githubConnection}
        />

        {/* ═══════════════════════ 1. Ticket Intake ═══════════════════════ */}
        <section className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                1. Ticket Intake &amp; Repository Browser
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {githubConnection?.isConnected
                  ? 'Select an authorized repository to browse issues, or use dedicated test cases'
                  : 'Connect GitHub or load dedicated test cases to verify the workflow'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadDedicated}
                disabled={loadingDedicated}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition disabled:opacity-50 shadow-2xs"
                title="Load the configured test issue"
              >
                <GitPullRequest className="w-3.5 h-3.5 text-emerald-700" />
                <span>{loadingDedicated ? 'Loading…' : 'Load Dedicated Test Issue (#1)'}</span>
              </button>
              <button
                type="button"
                onClick={loadOwned}
                disabled={loadingOwned}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-50 shadow-2xs"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-600" />
                <span>{loadingOwned ? 'Loading…' : 'Load Synthetic Fixture'}</span>
              </button>
            </div>
          </div>

          {githubConnection?.isConnected ? (
            <div className="space-y-4">
              {/* Account Card & Repo Dropdown */}
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  {githubConnection.user?.avatarUrl ? (
                    <img
                      src={githubConnection.user.avatarUrl}
                      alt={githubConnection.user.login}
                      className="w-8 h-8 rounded-full border border-slate-300 shadow-2xs"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                      {githubConnection.user?.login?.slice(0, 2).toUpperCase() || 'GH'}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      @{githubConnection.user?.login}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {githubConnection.repositories.length} authorized repositories
                    </span>
                  </div>
                </div>

                {/* Repo Dropdown */}
                <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                  <select
                    id="repo-select"
                    value={githubConnection.selectedRepo || ''}
                    onChange={(e) => handleSelectRepo(e.target.value)}
                    disabled={loadingRepo}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 shadow-2xs"
                  >
                    <option value="">-- Choose a repository --</option>
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
                      title="Reload issues and pull requests"
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingRepo ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Repo Issues List */}
              {githubConnection.selectedRepo && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-800">
                      Issues in <code className="text-violet-700 font-mono">{githubConnection.selectedRepo}</code>
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {githubConnection.repoIssues?.length || 0} issues
                    </span>
                  </div>

                  {githubConnection.repoIssues && githubConnection.repoIssues.length > 0 ? (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {githubConnection.repoIssues.map((issue) => {
                        const targetPath = issuePathMap[issue.number] ?? '';
                        const isLoadingThis = loadingIssueNum === issue.number;
                        const triage = issue.triage;
                        const isExpanded = expandedCommentIssue === issue.number;
                        const isCommentCopied = copiedIssueComment === issue.number;

                        return (
                          <div
                            key={issue.number}
                            className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-2xs hover:border-slate-300 transition"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900">
                                    #{issue.number}
                                  </span>
                                  <a
                                    href={issue.htmlUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-bold text-slate-900 hover:text-violet-700 hover:underline flex items-center gap-1"
                                  >
                                    <span>{issue.title}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-400 inline" />
                                  </a>
                                  {triage && (
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                        triage.category === 'bug'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : triage.category === 'needs-repro'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : 'bg-rose-50 text-rose-800 border-rose-200'
                                      }`}
                                    >
                                      <Bot className="w-2.5 h-2.5" />
                                      <span>{triage.badge}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                  <span>Opened by @{issue.user}</span>
                                  {triage && (
                                    <>
                                      <span>•</span>
                                      <span className="text-slate-600 font-medium">{triage.headline}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {triage?.suggestedComment && (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedCommentIssue(isExpanded ? null : issue.number)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                    title="View bot comment template"
                                  >
                                    <MessageSquare className="w-3 h-3 text-slate-500" />
                                    <span>{isExpanded ? 'Hide Comment' : 'Bot Comment'}</span>
                                  </button>
                                )}
                                <input
                                  type="text"
                                  value={targetPath}
                                  onChange={(e) =>
                                    setIssuePathMap((prev) => ({ ...prev, [issue.number]: e.target.value }))
                                  }
                                  placeholder="Source file path"
                                  className="w-40 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-600 shadow-2xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleLoadIssue(issue)}
                                  disabled={
                                    isLoadingThis ||
                                    !targetPath.trim()
                                  }
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50"
                                >
                                  <span>{isLoadingThis ? 'Loading…' : 'Open in Workbench'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Bot Suggested Comment Drawer */}
                            {isExpanded && triage?.suggestedComment && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-2 mt-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                                    <Bot className="w-3.5 h-3.5 text-violet-600" />
                                    ProofPatcher [bot] Recommended Response
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                        navigator.clipboard.writeText(triage.suggestedComment).then(() => {
                                          setCopiedIssueComment(issue.number);
                                          setTimeout(() => setCopiedIssueComment(null), 2000);
                                        });
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                                  >
                                    {isCommentCopied ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500" />
                                    )}
                                    <span>{isCommentCopied ? 'Copied!' : 'Copy Comment'}</span>
                                  </button>
                                </div>
                                <p className="text-[11px] text-slate-600 italic">
                                  Action: {triage.suggestedAction}
                                </p>
                                <pre className="text-[11px] text-slate-800 bg-white p-2.5 rounded border border-slate-200 whitespace-pre-wrap font-mono">
                                  {triage.suggestedComment}
                                </pre>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1">
                      <p className="font-semibold text-slate-700">No open issues found in this repository.</p>
                      <p className="text-[11px]">Select another repository or create an issue on GitHub.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Connect GitHub to load your repositories</span>
                  <span className="text-[10px] font-semibold text-slate-600 bg-slate-200 px-2 py-0.5 rounded">
                    RFC 8628 Device Flow
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Connect your account to pick repositories and load issues with one click, without copying and pasting URLs.
                </p>
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition shrink-0"
              >
                <span>Connect GitHub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Manual Issue URL Form */}
          <details className="rounded-xl border border-slate-200 p-3.5 bg-slate-50/50 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700 hover:text-slate-900">
              Manual Issue URL or Custom Target File
            </summary>
            <form onSubmit={captureIssue} className="space-y-3 pt-3 mt-2 border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="url"
                  required
                  placeholder="https://github.com/owner/repo/issues/123"
                  value={capture.data.issue_url}
                  onChange={(e) => capture.setData('issue_url', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 shadow-2xs"
                />
                <input
                  required
                  placeholder="src/OrderTotal.php"
                  value={capture.data.path}
                  onChange={(e) => capture.setData('path', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 shadow-2xs"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={capture.processing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition disabled:opacity-50"
                >
                  <span>{capture.processing ? 'Capturing…' : 'Preview Target'}</span>
                </button>
              </div>
            </form>
          </details>
        </section>

        {/* ═══════════════════════ 2. Muse Proposal Request ═══════════════════════ */}
        {context && preview && (
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    2. Muse Proposal Request
                  </h2>
                  {(isOwnedFixture || context.isSynthetic) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      Synthetic Fixture
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  {context.isSynthetic || !context.issueUrl ? (
                    <span>
                      Case: <span className="font-bold text-slate-900">OrderTotal Bug #{context.issueNumber}</span> ·{' '}
                      <span className="font-mono text-slate-600">{context.path}</span>
                    </span>
                  ) : (
                    <span>
                      <a href={context.issueUrl} target="_blank" rel="noreferrer" className="text-violet-700 hover:underline font-mono">
                        {context.repository}#{context.issueNumber}
                      </a>{' '}
                      · <span className="font-mono text-slate-600">{context.path}</span>
                    </span>
                  )}
                </p>
              </div>

              {suggestion && (
                <button
                  type="button"
                  onClick={() => setShowPayloadDetails(!showPayloadDetails)}
                  className="text-xs text-violet-700 hover:text-violet-900 font-semibold"
                >
                  {showPayloadDetails ? 'Hide Intake Details' : 'View Intake Details'}
                </button>
              )}
            </div>

            {/* Context Details */}
            {(!suggestion || showPayloadDetails) && (
              <div className="space-y-3 text-xs">
                <details className="rounded-xl border border-slate-200 p-3 bg-slate-50/50" open={!suggestion}>
                  <summary className="cursor-pointer font-bold text-slate-900">Issue: {context.title}</summary>
                  <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 font-mono bg-white p-2.5 rounded border border-slate-200">
                    {context.body || '(No description)'}
                  </pre>
                </details>

                <details className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                  <summary className="cursor-pointer font-bold text-slate-900">Target Source: {context.path}</summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre text-xs text-slate-700 font-mono bg-white p-2.5 rounded border border-slate-200">
                    {context.source}
                  </pre>
                </details>
              </div>
            )}

            {/* Codex Thinking Streaming Animation */}
            <ThinkingAnimation
              isActive={sending}
              steps={museThinkingSteps}
              title="Muse AI Synthesizing Candidate Repair"
              subtitle="Reading AST invariants and generating bounded diff proposal…"
            />

            {!suggestion && !sending && (
              <form onSubmit={requestSuggestion} className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={!modelContextAllowed || sending || (!(budget?.canRequest && modelKeyAvailable) && !isDedicatedTestRepo && !isOwnedFixture)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {budget?.canRequest && modelKeyAvailable
                          ? 'Assign to Muse'
                          : 'Load Offline Reference Repair'}
                      </span>
                    </button>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {budget?.canRequest && modelKeyAvailable
                        ? `Est: $${(preview.estimatedMicros / 1000000).toFixed(4)}`
                        : '$0.00'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {!modelContextAllowed
                      ? 'Private content stays on this computer'
                      : budget?.canRequest && modelKeyAvailable
                      ? 'Sends issue and selected file to model provider'
                      : 'No model request will be sent'}
                  </span>
                </div>
              </form>
            )}
          </section>
        )}

        {/* ═══════════════════════ 3. Code Proposal Output ═══════════════════════ */}
        {suggestion && (
          <section className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  3. Code Proposal
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {suggestion.path} · {suggestion.model || suggestion.provenance || 'Local Checked-in Fixture'}
                </p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${suggestion.candidate?.verified ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                {suggestion.candidate?.verified ? (verificationReport?.isSimulated !== false ? 'Local Fixture Passed' : 'Fixture Passed') : 'Unverified Proposal'}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {suggestion.explanation}
            </p>

            {/* Split Diff View */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1">Find Existing</span>
                <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-rose-50/60 p-2.5 text-xs font-mono text-rose-900 border border-rose-200">
                  {suggestion.find}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-700 block mb-1">Replace With</span>
                <pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-emerald-50/60 p-2.5 text-xs font-mono text-emerald-900 border border-emerald-200">
                  {suggestion.replace}
                </pre>
              </div>
            </div>

            {/* Candidate in-memory preview */}
            {suggestion.candidate && (
              <details className="rounded-xl border border-slate-200 p-3 bg-slate-50/40 text-xs">
                <summary className="cursor-pointer font-bold text-slate-900 flex items-center justify-between">
                  <span>In-Memory Candidate Source</span>
                  <span className="font-mono text-[11px] text-slate-500 font-normal">
                    SHA: {suggestion.candidate.sha256.slice(0, 10)}…
                  </span>
                </summary>
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span>SHA-256: <code>{suggestion.candidate.sha256.slice(0, 16)}…</code></span>
                      <button
                        type="button"
                        onClick={() => copyCandidateHash(suggestion.candidate!.sha256)}
                        className="text-slate-500 hover:text-slate-800 p-0.5 rounded"
                      >
                        {copiedCandidateSha ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <span>Applied to disk: No</span>
                  </div>
                  <pre className="max-h-56 overflow-auto whitespace-pre rounded-lg bg-white p-3 text-xs font-mono text-slate-800 border border-slate-200">
                    {suggestion.candidate.source}
                  </pre>
                </div>
              </details>
            )}

            {/* Verifier Action CTA */}
            {(isOwnedFixture || isDedicatedTestRepo) && (
              <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50/80 via-white to-purple-50/50 p-5 space-y-3.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-violet-950 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-violet-700" />
                      <span>Falsifiable ProofPatcher Verifier</span>
                    </h3>
                    <p className="text-xs text-violet-800 mt-0.5">
                      Runs checks on a known test fixture. Other candidate code is not yet supported.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={verifyCandidate}
                    disabled={verifying}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50 shrink-0"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                    <span>{verifying ? 'Running checks…' : verificationReport ? 'Re-run Verifier' : 'Run ProofPatcher Verifier'}</span>
                  </button>
                </div>

                {/* Real-time Dynamic Verification Animation */}
                <ThinkingAnimation
                  isActive={verifying}
                  steps={verifierThinkingSteps}
                  title="Running checks"
                  subtitle="Results will appear when the checks finish."
                />
              </div>
            )}

            {/* ═══════════════════════ 4. Verifier Evidence & Cryptographic Receipt ═══════════════════════ */}
            {verificationReport && (
              <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        4. Verifier Evidence &amp; Receipt
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${verificationReport.decision === 'VERIFIED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                        {verificationReport.decision === 'VERIFIED' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{verificationReport.isSimulated !== false ? 'LOCAL FIXTURE PASSED' : 'FIXTURE PASSED'}</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>{verificationReport.decision}</span>
                          </>
                        )}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                      Run ID: {verificationReport.id.slice(0, 15)}… · {verificationReport.kind}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {verificationReport.createdAt.replace('T', ' ').slice(0, 16)} UTC
                  </span>
                </div>

                {/* Animated 5-Gate Status Pipeline */}
                <VerificationPipeline
                  isRunning={verifying}
                  gates={pipelineGates}
                  decision={verificationReport.decision}
                  isSimulated={verificationReport.isSimulated}
                />

                {/* Cryptographic Receipt Manifest */}
                <div className={`rounded-xl border p-4 space-y-2.5 shadow-2xs ${
                  verificationReport.decision === 'VERIFIED'
                    ? 'border-slate-800 bg-slate-900 text-slate-100'
                    : 'border-slate-300 bg-slate-800 text-slate-200'
                }`}>
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Shield className={`w-3.5 h-3.5 ${verificationReport.decision === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <span>Cryptographic Integrity Manifest</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      verificationReport.decision === 'VERIFIED'
                        ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800'
                        : 'text-rose-300 bg-rose-950/80 border-rose-800'
                    }`}>
                      {verificationReport.decision === 'VERIFIED'
                        ? (verificationReport.receipt?.integrity === 'VALID'
                            ? `VALID · ${verificationReport.receipt?.externallyAnchored ? 'Externally Anchored' : 'Unanchored Local Manifest'}`
                            : `MANIFEST ${verificationReport.receipt?.integrity ?? 'MISSING'}`)
                        : `DECISION: ${verificationReport.decision} · MANIFEST ${verificationReport.receipt?.integrity ?? 'NONE'}`}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Receipt Manifest Digest (SHA-256)</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-xs bg-slate-950 px-3 py-1.5 rounded border border-slate-800 text-emerald-400 truncate">
                        {verificationReport.receipt?.sha256 ?? 'Unavailable'}
                      </code>
                      <button
                        type="button"
                        onClick={() => verificationReport.receipt?.sha256 && copyReceipt(verificationReport.receipt.sha256)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shrink-0"
                      >
                        {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
                        <span>{copiedReceipt ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 text-[10px] text-slate-400 pt-1 font-mono">
                    <span>Base Commit: {verificationReport.baseCommit.slice(0, 8)}</span>
                    <span>Patch SHA: {verificationReport.patchSha256.slice(0, 8)}…</span>
                    <span>Evidence: runs/{verificationReport.id.slice(0, 15)}…</span>
                  </div>
                </div>

                {/* Collapsible Run Logs */}
                <details className="rounded-xl border border-slate-200 p-3 bg-slate-50/40 text-xs">
                  <summary className="cursor-pointer font-bold text-slate-800 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Run Verification Logs</span>
                  </summary>
                  <div className="mt-2.5 space-y-2 font-mono">
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Baseline Log (Exit {verificationReport.runs.baseline?.exitCode ?? '?'})
                      </span>
                      <p className={`text-[11px] whitespace-pre-wrap ${verificationReport.gates.baselineReproduced ? 'text-rose-700' : 'text-slate-600'}`}>
                        {verificationReport.runs.baseline?.summary}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Negative Control Log (Exit {verificationReport.runs.negative?.exitCode ?? '?'})
                      </span>
                      <p className={`text-[11px] whitespace-pre-wrap ${verificationReport.gates.negativeControlCaught ? 'text-rose-700' : 'text-slate-600'}`}>
                        {verificationReport.runs.negative?.summary}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                        Candidate Log (Exit {verificationReport.runs.candidate?.exitCode ?? '?'})
                      </span>
                      <p className={`text-[11px] whitespace-pre-wrap ${verificationReport.gates.candidatePassed ? 'text-emerald-700' : 'text-rose-700 font-bold'}`}>
                        {verificationReport.runs.candidate?.summary}
                      </p>
                    </div>
                  </div>
                </details>

                {/* Pull Request Publication Section */}
                {verificationReport.decision === 'VERIFIED' && verificationReport.isSimulated === false && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <GitPullRequest className="w-4 h-4 text-violet-600" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Dedicated Test Repo Publication
                        </h4>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase px-2 py-0.5 rounded bg-slate-100">
                        configured repository
                      </span>
                    </div>

                    {publishedPr ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Draft Pull Request Prepared (#{publishedPr.prNumber})
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            Draft Only · No Auto-Merge
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Branch <code className="font-mono text-emerald-900">{publishedPr.branch}</code> bound to verified receipt{' '}
                          <code className="font-mono text-emerald-900">{publishedPr.receiptSha256.slice(0, 12)}…</code>
                        </p>
                        <div className="pt-1">
                          <a
                            href={publishedPr.prUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
                          >
                            <span>View Draft PR on GitHub</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600">
                          The fixture passed its checks. Prepare a draft pull request in the dedicated test repository with the run evidence attached.
                        </p>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                          <span className="text-[10px] text-slate-500 italic">
                            Strict allowlist: Only dedicated test repo is authorized. No automatic merge.
                          </span>
                          {publisherDisconnected ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-amber-800 bg-amber-50 border border-amber-200">
                              <Lock className="w-3.5 h-3.5 text-amber-600" />
                              <span>PR Creation Held in Review Safety Mode</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={publishDraftPr}
                              disabled={publishingPr}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition disabled:opacity-50"
                            >
                              <GitPullRequest className="w-3.5 h-3.5" />
                              <span>{publishingPr ? 'Preparing Draft PR…' : 'Create Draft PR in Dedicated Test Repo'}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  {verificationReport.isSimulated !== false ? 'Local fixture run; no isolated sandbox was verified. ' : 'Only the known fixture is supported. '}
                  Other candidates remain blocked. See <Link href="/docs" className="text-violet-700 hover:underline">Documentation</Link>.
                </p>
              </div>
            )}

            {/* ═══════════════════════ 5. Local Review Draft & Audit Trail ═══════════════════════ */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>5. Review Draft Note</span>
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">Local Session Only</span>
              </div>

              <form onSubmit={handleSaveDraft} className="space-y-2">
                <textarea
                  rows={2}
                  value={draftForm.data.comment}
                  onChange={(e) => draftForm.setData('comment', e.target.value)}
                  placeholder="Record review notes or acceptance observations..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 shadow-2xs"
                />
                <div className="flex items-center justify-between">
                  {draft && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Last saved: {draft.savedAt.replace('T', ' ').slice(0, 16)}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={draftForm.processing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition disabled:opacity-50"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>{draftForm.processing ? 'Saving…' : 'Save Review Note'}</span>
                  </button>
                </div>
              </form>
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
