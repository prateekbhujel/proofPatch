import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { ArrowRight, Sparkles, Shield, AlertTriangle, CheckCircle2, MessageSquare, FileCode, Check, Copy, XCircle, Terminal, GitPullRequest, ExternalLink, Lock, Kanban, Clock, Layers, FolderGit2, RefreshCw } from 'lucide-react';

interface GitHubRepo {
  fullName: string;
  defaultBranch?: string;
  isPrivate: boolean;
  installedRepo?: boolean;
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
        onFinish: () => {
          setSending(false);
        },
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

  // Derive truthful Maintainer Task Board state from persisted server props
  const taskState: 'none' | 'queued' | 'in_progress' | 'needs_review' | 'completed' = (() => {
    if (!context) return 'none';
    if (publishedPr) return 'completed';
    if (verificationReport && verificationReport.decision === 'VERIFIED') return 'needs_review';
    if (suggestion) return 'in_progress';
    return 'queued';
  })();

  const queuedTasks = tasks.filter((t) => t.status === 'queued');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'publishing');
  const needsReviewTasks = tasks.filter((t) => t.status === 'needs_review');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const failedTasks = tasks.filter((t) => t.status === 'failed' || t.status === 'outcome_unknown');

  const renderTaskCard = (task: WorkbenchTaskData) => {
    const isActive = Boolean(
      context &&
      context.repository === task.repository &&
      context.issueNumber === task.issueNumber
    );

    return (
      <div
        key={task.id}
        className={`rounded-md border p-2.5 space-y-1.5 shadow-2xs transition ${
          isActive
            ? 'border-indigo-400 bg-indigo-50/40 ring-1 ring-indigo-400'
            : 'border-slate-200 bg-white hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[120px]">
            #{task.issueNumber} {task.repository.split('/')[1] || task.repository}
          </span>
          {isActive ? (
            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
              Active
            </span>
          ) : (
            <button
              type="button"
              onClick={() => router.post('/issues/switch-task', { task_id: task.id })}
              className="text-[10px] font-medium text-slate-600 hover:text-slate-900 underline"
            >
              Select
            </button>
          )}
        </div>

        <p className="text-xs font-semibold text-slate-900 line-clamp-2" title={task.title}>
          {task.title}
        </p>

        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <span className="text-[9px] font-mono text-slate-500 bg-slate-50 px-1 py-0.5 rounded border border-slate-200 truncate max-w-[140px]">
            {task.path}
          </span>
          {task.isDedicated && (
            <span className="text-[9px] font-semibold text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
              Dedicated
            </span>
          )}
          {task.model && (
            <span className="text-[9px] font-medium text-violet-800 bg-violet-50 px-1 py-0.5 rounded border border-violet-200">
              {task.model}
            </span>
          )}
          {task.isOfflineExample && (
            <span className="text-[9px] font-medium text-slate-600 bg-slate-100 px-1 py-0.5 rounded border border-slate-200">
              Offline Reference Example
            </span>
          )}
          {task.isSimulated && task.status === 'needs_review' && (
            <span className="text-[9px] font-semibold text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
              Simulated (Not Publishable)
            </span>
          )}
          {!task.isSimulated && task.verificationDecision === 'VERIFIED' && (
            <span className="text-[9px] font-semibold text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200">
              VERIFIED
            </span>
          )}
          {task.publishedPrNumber ? (
            <span className="text-[9px] font-semibold text-violet-800 bg-violet-50 px-1 py-0.5 rounded border border-violet-200">
              PR #{task.publishedPrNumber}
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <AppLayout activeNav="issues">
      <Head title="Issues Workbench · ProofPatcher" />
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Compact Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Issues Workbench</h1>
            <p className="text-xs text-slate-500">
              Ticket intake, Muse AI code proposal, and falsifiable 5-gate verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
              <Shield className="w-3 h-3 text-emerald-600" />
              Read-Only Workbench
            </span>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Maintainer Task Board */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Kanban className="w-3.5 h-3.5 text-slate-600" />
                Maintainer Task Board
              </h2>
              <p className="text-[11px] text-slate-500">
                Truthful workflow state backed strictly by persisted server execution results. No fake drag/drop.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
              <span>Screenshots: Unimplemented pending grant verification (Text-only inference active)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* Column 1: Queued */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Queued
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {tasks.length > 0 ? queuedTasks.length : (taskState === 'queued' ? '1' : '0')}
                </span>
              </div>
              {tasks.length > 0 ? (
                queuedTasks.length > 0 ? (
                  <div className="space-y-2">
                    {queuedTasks.map(renderTaskCard)}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic p-2 text-center">No queued tickets</div>
                )
              ) : taskState === 'queued' && context ? (
                <div className="rounded-md border border-blue-200 bg-white p-2.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      #{context.issueNumber}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 truncate max-w-[100px]">{context.path}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 line-clamp-2">{context.title}</p>
                  <p className="text-[11px] text-slate-500">Awaiting maintainer approval to assign to Muse.</p>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic p-2 text-center">No queued tickets</div>
              )}
            </div>

            {/* Column 2: In Progress */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-violet-800 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-violet-600" />
                  In Progress
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-violet-100 text-violet-800">
                  {tasks.length > 0 ? inProgressTasks.length : (taskState === 'in_progress' ? '1' : '0')}
                </span>
              </div>
              {tasks.length > 0 ? (
                inProgressTasks.length > 0 ? (
                  <div className="space-y-2">
                    {inProgressTasks.map(renderTaskCard)}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic p-2 text-center">No active proposals</div>
                )
              ) : taskState === 'in_progress' && context && suggestion ? (
                <div className="rounded-md border border-violet-200 bg-white p-2.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-violet-800 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">
                      #{context.issueNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-600">{suggestion.model || 'Muse Reference'}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 line-clamp-2">{context.title}</p>
                  <p className="text-[11px] text-slate-500">Proposal generated; awaiting 5-gate verifier execution.</p>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic p-2 text-center">No active proposals</div>
              )}
            </div>

            {/* Column 3: Needs Review */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-3 h-3 text-amber-600" />
                  Needs Review
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                  {tasks.length > 0 ? needsReviewTasks.length : (taskState === 'needs_review' ? '1' : '0')}
                </span>
              </div>
              {tasks.length > 0 ? (
                needsReviewTasks.length > 0 ? (
                  <div className="space-y-2">
                    {needsReviewTasks.map(renderTaskCard)}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic p-2 text-center">No pending reviews</div>
                )
              ) : taskState === 'needs_review' && context && verificationReport ? (
                <div className="rounded-md border border-amber-200 bg-white p-2.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Fixture checks passed
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Receipt SHA</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 line-clamp-2">{context.title}</p>
                  <p className="text-[11px] text-slate-500">{verificationReport.isSimulated !== false ? 'Local test only; not ready to publish.' : 'Fixture run complete; review the evidence.'}</p>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic p-2 text-center">No pending reviews</div>
              )}
            </div>

            {/* Column 4: Completed */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Completed
                </span>
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                  {tasks.length > 0 ? completedTasks.length : (taskState === 'completed' ? '1' : '0')}
                </span>
              </div>
              {tasks.length > 0 ? (
                completedTasks.length > 0 ? (
                  <div className="space-y-2">
                    {completedTasks.map(renderTaskCard)}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic p-2 text-center">No completed tasks</div>
                )
              ) : taskState === 'completed' && context && publishedPr ? (
                <div className="rounded-md border border-emerald-200 bg-white p-2.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Draft PR #{publishedPr.prNumber}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 truncate max-w-[80px]">{publishedPr.branch}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 line-clamp-2">{context.title}</p>
                  <p className="text-[11px] text-slate-500">Published in disconnected mode with evidence.</p>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic p-2 text-center">No completed tasks</div>
              )}
            </div>
          </div>

          {/* Failed Tasks Drawer if any */}
          {failedTasks.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between pb-2">
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
                  <XCircle className="w-3 h-3 text-rose-600" />
                  Failed Verification Tasks ({failedTasks.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {failedTasks.map((task) => (
                  <div key={task.id} className="rounded-md border border-rose-200 bg-rose-50/40 p-2.5 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-semibold text-rose-800 bg-rose-100 px-1.5 py-0.5 rounded border border-rose-200 truncate max-w-[120px]">
                        #{task.issueNumber} {task.repository.split('/')[1] || task.repository}
                      </span>
                      <button
                        type="button"
                        onClick={() => router.post('/issues/switch-task', { task_id: task.id })}
                        className="text-[10px] font-medium text-slate-600 hover:text-slate-900 underline"
                      >
                        Select
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 line-clamp-2">{task.title}</p>
                    <div className="flex items-center gap-1 text-[9px] font-medium text-rose-700">
                      <span>Failed: {task.verificationDecision || 'FAILED'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 1. Ticket Intake & Repository Browser */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Ticket Intake</h2>
              <span className="text-[11px] text-slate-500">
                {githubConnection?.isConnected
                  ? 'Select an authorized repository to browse issues, or use dedicated test cases'
                  : 'Connect GitHub or load dedicated test cases to verify the workflow'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadDedicated}
                disabled={loadingDedicated}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition disabled:opacity-50"
                title="Load the configured test issue"
              >
                <GitPullRequest className="w-3.5 h-3.5 text-emerald-700" />
                <span>{loadingDedicated ? 'Loading…' : 'Load Dedicated Test Issue (#1)'}</span>
              </button>
              <button
                type="button"
                onClick={loadOwned}
                disabled={loadingOwned}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition disabled:opacity-50"
              >
                <FileCode className="w-3.5 h-3.5 text-slate-600" />
                <span>{loadingOwned ? 'Loading…' : 'Load Synthetic Fixture'}</span>
              </button>
            </div>
          </div>

          {githubConnection?.isConnected ? (
            <div className="space-y-4">
              {/* Connected Account & Repository Selector */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  {githubConnection.user?.avatarUrl ? (
                    <img
                      src={githubConnection.user.avatarUrl}
                      alt={githubConnection.user.login}
                      className="w-7 h-7 rounded-full border border-slate-300"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                      {githubConnection.user?.login?.slice(0, 2).toUpperCase() || 'GH'}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block leading-tight">
                      @{githubConnection.user?.login}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {githubConnection.repositories.length} authorized {githubConnection.repositories.length === 1 ? 'repository' : 'repositories'}
                    </span>
                  </div>
                </div>

                {/* Repository Dropdown */}
                <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                  <label htmlFor="repo-select" className="text-xs font-medium text-slate-700 shrink-0">
                    Repo:
                  </label>
                  <select
                    id="repo-select"
                    value={githubConnection.selectedRepo || ''}
                    onChange={(e) => handleSelectRepo(e.target.value)}
                    disabled={loadingRepo}
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 shadow-2xs"
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
                      className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingRepo ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Issues / Pull Requests list */}
              {githubConnection.selectedRepo ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">
                        Issues in <code className="text-violet-700 font-mono">{githubConnection.selectedRepo}</code>
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {githubConnection.repoIssues?.length || 0} {githubConnection.repoListIncomplete ? 'loaded' : 'open'}
                      </span>
                    </div>
                    {githubConnection.repoPulls && githubConnection.repoPulls.length > 0 && (
                      <span className="text-[11px] text-slate-500">
                        {githubConnection.repoPulls.length} active PR{githubConnection.repoPulls.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>

                  {githubConnection.repoListIncomplete && (
                    <p className="text-xs text-amber-700" role="status">This list may be incomplete.</p>
                  )}

                  {githubConnection.repoIssues && githubConnection.repoIssues.length > 0 ? (
                    <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                      {githubConnection.repoIssues.map((issue) => {
                        const targetPath = issuePathMap[issue.number] ?? '';
                        const isLoadingThis = loadingIssueNum === issue.number;
                        return (
                          <div
                            key={issue.number}
                            className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 shadow-2xs hover:border-slate-300 transition"
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
                                    className="text-xs font-semibold text-slate-900 hover:text-violet-700 hover:underline flex items-center gap-1"
                                  >
                                    <span>{issue.title}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-400 inline" />
                                  </a>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                                  <span>Opened by @{issue.user}</span>
                                  {issue.labels && issue.labels.length > 0 && (
                                    <>
                                      <span>·</span>
                                      <div className="flex items-center gap-1">
                                        {issue.labels.map((l) => (
                                          <span
                                            key={l}
                                            className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                                          >
                                            {l}
                                          </span>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1">
                                  <label htmlFor={`target-path-${issue.number}`} className="sr-only">
                                    Target file path
                                  </label>
                                  <input
                                    id={`target-path-${issue.number}`}
                                    type="text"
                                    value={targetPath}
                                    onChange={(e) =>
                                      setIssuePathMap((prev) => ({ ...prev, [issue.number]: e.target.value }))
                                    }
                                    placeholder="Source file path"
                                    className="w-36 rounded border border-slate-300 px-2 py-1 text-[11px] font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-600 shadow-2xs"
                                    title="Target source file to repair"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleLoadIssue(issue)}
                                  disabled={isLoadingThis || !targetPath.trim()}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition disabled:opacity-50"
                                >
                                  <span>{isLoadingThis ? 'Loading…' : 'Open in Workbench'}</span>
                                </button>
                              </div>
                            </div>
                            {issue.body && (
                              <p className="text-[11px] text-slate-600 line-clamp-2 font-mono bg-slate-50 p-1.5 rounded border border-slate-100">
                                {issue.body}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1">
                      <p className="font-medium text-slate-700">{githubConnection.repoListIncomplete ? 'No open issues found in the loaded pages.' : 'No open issues found in this repository.'}</p>
                      <p className="text-[11px]">
                        Create an issue on GitHub or select another repository from the dropdown above.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1">
                  <FolderGit2 className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                  <p className="font-semibold text-slate-700">Choose a repository to start</p>
                  <p className="text-[11px]">
                    Select any authorized repository above to load its open issues directly into the workbench.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Connect GitHub to load your repositories</span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                    Direct integration
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Connect your account to pick repositories and load issues with one click, without copying and pasting URLs.
                </p>
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition shrink-0"
              >
                <span>Connect GitHub</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Collapsible Manual URL or Custom Target Input */}
          <details className="rounded-lg border border-slate-200 p-3 bg-slate-50/40 text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700 hover:text-slate-900">
              Manual Issue URL or Custom Target File
            </summary>
            <form onSubmit={captureIssue} className="space-y-3 pt-3 mt-2 border-t border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="issue-url" className="block text-xs font-medium text-slate-700">
                    Public GitHub Issue URL
                  </label>
                  <input
                    id="issue-url"
                    type="url"
                    required
                    placeholder="https://github.com/owner/repo/issues/123"
                    value={capture.data.issue_url}
                    onChange={(e) => capture.setData('issue_url', e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent shadow-2xs"
                  />
                </div>

                <div>
                  <label htmlFor="source-path" className="block text-xs font-medium text-slate-700">
                    Target File Path
                  </label>
                  <input
                    id="source-path"
                    required
                    placeholder="public/fixtures/checkout.html or src/OrderTotal.php"
                    value={capture.data.path}
                    onChange={(e) => capture.setData('path', e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="submit"
                  disabled={capture.processing}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition disabled:opacity-50"
                >
                  <span>{capture.processing ? 'Capturing…' : 'Preview Target'}</span>
                </button>
              </div>
            </form>
          </details>
        </section>

        {/* 2. Muse Task Triage & Proposal Review */}
        {context && preview && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Muse Proposal Request</h2>
                  {(isOwnedFixture || context.isSynthetic) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      Synthetic Fixture
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-600">
                  {context.isSynthetic || !context.issueUrl ? (
                    <span>Case: <span className="font-semibold text-slate-900">OrderTotal Bug #{context.issueNumber}</span> · <span className="font-mono text-slate-600">{context.path}</span></span>
                  ) : (
                    <span>
                      <a href={context.issueUrl} target="_blank" rel="noreferrer" className="text-violet-700 hover:underline font-mono">
                        {context.repository}#{context.issueNumber}
                      </a> · <span className="font-mono text-slate-600">{context.path}</span>
                    </span>
                  )}
                </p>
              </div>

              {suggestion && (
                <button
                  type="button"
                  onClick={() => setShowPayloadDetails(!showPayloadDetails)}
                  className="text-xs text-violet-700 hover:text-violet-900 font-medium self-start sm:self-auto"
                >
                  {showPayloadDetails ? 'Hide Intake Details' : 'View Intake Details'}
                </button>
              )}
            </div>

            {/* Conditionally show full details or collapse when suggestion exists */}
            {(!suggestion || showPayloadDetails) && (
              <div className="space-y-3 text-xs">
                <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50" open={!suggestion}>
                  <summary className="cursor-pointer font-semibold text-slate-900">Issue: {context.title}</summary>
                  <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 font-mono bg-white p-2.5 rounded border border-slate-200">
                    {context.body || '(No description)'}
                  </pre>
                </details>

                <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                  <summary className="cursor-pointer font-semibold text-slate-900">Target Source: {context.path}</summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre text-xs text-slate-700 font-mono bg-white p-2.5 rounded border border-slate-200">
                    {context.source}
                  </pre>
                </details>

                {modelContextAllowed && <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                  <summary className="cursor-pointer font-semibold text-slate-900">Exact JSON Payload</summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 font-mono bg-white p-2.5 rounded border border-slate-200">
                    {JSON.stringify(preview.body, null, 2)}
                  </pre>
                </details>}
              </div>
            )}

            {!suggestion && (
              <form onSubmit={requestSuggestion} className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={!modelContextAllowed || sending || (!(budget?.canRequest && modelKeyAvailable) && !isDedicatedTestRepo && !isOwnedFixture)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {sending
                          ? 'Assigning to Muse…'
                          : budget?.canRequest && modelKeyAvailable
                          ? 'Assign to Muse'
                          : 'Load Offline Reference Repair'}
                      </span>
                    </button>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {budget?.canRequest && modelKeyAvailable
                        ? `Estimated reservation: $${(preview.estimatedMicros / 1000000).toFixed(4)}`
                        : 'Offline reference repair ($0.00)'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {!modelContextAllowed ? 'Private or unverified content stays on this computer' : budget?.canRequest && modelKeyAvailable ? 'Sends the issue and selected file to the model provider' : 'No model request will be sent'}
                  </span>
                </div>

                {(!budget?.canRequest || !modelKeyAvailable) && (
                  <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
                    {isDedicatedTestRepo || isOwnedFixture
                      ? 'Muse is unavailable. You can load the offline reference example.'
                      : 'Muse is unavailable. Check the key and local request allowance.'}
                  </p>
                )}
              </form>
            )}
          </section>
        )}

        {/* 3. Code Proposal Output */}
        {suggestion && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  3. Code Proposal
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {suggestion.path} · {suggestion.model || suggestion.provenance || 'Local Checked-in Fixture'}
                </p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${suggestion.candidate?.verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                {suggestion.candidate?.verified ? (verificationReport?.isSimulated !== false ? 'Local Fixture Passed' : 'Fixture Passed') : 'Unverified Proposal'}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium">{suggestion.explanation}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">Find Existing</span>
                <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2.5 text-xs font-mono text-slate-800 border border-slate-200">
                  {suggestion.find}
                </pre>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">Replace With</span>
                <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2.5 text-xs font-mono text-emerald-800 border border-slate-200 bg-emerald-50/20">
                  {suggestion.replace}
                </pre>
              </div>
            </div>

            {suggestion.candidate && (
              <details className="rounded-md border border-slate-200 p-3 bg-slate-50/40">
                <summary className="cursor-pointer text-xs font-semibold text-slate-900 flex items-center justify-between">
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
                        title="Copy Candidate SHA-256"
                      >
                        {copiedCandidateSha ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <span>Applied to disk: No</span>
                  </div>
                  <pre className="max-h-56 overflow-auto whitespace-pre rounded-md bg-white p-3 text-xs font-mono text-slate-800 border border-slate-200">
                    {suggestion.candidate.source}
                  </pre>
                </div>
              </details>
            )}

            {/* Verifier Action CTA */}
            {(isOwnedFixture || isDedicatedTestRepo) && (
              <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50/80 to-purple-50/50 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-violet-950 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-violet-700" />
                      <span>Falsifiable ProofPatcher Verifier</span>
                    </h3>
                    <p className="text-[11px] text-violet-800 mt-0.5">
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
                    <span>{verifying ? 'Running 5-Gate Verifier…' : (verificationReport ? 'Re-run Verifier' : 'Run ProofPatcher Verifier')}</span>
                  </button>
                </div>

                {/* Real-time Dynamic Verification Animation */}
                {verifying && (
                  <div className="rounded-lg bg-white/90 border border-violet-200 p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center gap-2 text-violet-900 font-semibold text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-violet-600 animate-ping" />
                      <span>Executing Verification Pipeline…</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                        <span>Inspecting AST & tokens</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                        <span>Evaluating baseline run</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                        <span>Testing negative control</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                        <span>Evaluating candidate test</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. Verifier Evidence & Cryptographic Receipt */}
            {verificationReport && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">4. Verifier Evidence & Receipt</h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${verificationReport.decision === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
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

                {/* 5-Gate Status Grid - Dynamically rendered from actual verification report */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                  <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">1. Baseline</span>
                    <span className={`text-xs font-bold block mt-0.5 ${verificationReport.gates.baselineReproduced ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {verificationReport.gates.baselineReproduced ? 'Passed (Exit 1)' : `Failed (Exit ${verificationReport.runs.baseline?.exitCode ?? '?'})`}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {verificationReport.gates.baselineReproduced ? 'Bug reproduced' : 'Reproduction failed'}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">2. Neg Control</span>
                    <span className={`text-xs font-bold block mt-0.5 ${verificationReport.gates.negativeControlCaught ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {verificationReport.gates.negativeControlCaught ? 'Caught (Exit 1)' : `Failed (Exit ${verificationReport.runs.negative?.exitCode ?? '?'})`}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {verificationReport.gates.negativeControlCaught ? 'Shortcut caught (expected exit 1)' : 'Negative control missed or failed'}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">3. Candidate</span>
                    <span className={`text-xs font-bold block mt-0.5 ${verificationReport.gates.candidatePassed ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {verificationReport.gates.candidatePassed ? 'Passed (Exit 0)' : `Failed (Exit ${verificationReport.runs.candidate?.exitCode ?? '?'})`}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {verificationReport.gates.candidatePassed ? 'Fixture checks passed' : (verificationReport.runs.candidate?.exitCode === 255 ? 'Candidate execution blocked' : 'Test failed')}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">4. AST Safety</span>
                    <span className={`text-xs font-bold block mt-0.5 ${verificationReport.gates.candidateStaticSafetyPassed ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {verificationReport.gates.candidateStaticSafetyPassed ? '0 Violations' : 'Disallowed Token'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {verificationReport.gates.candidateStaticSafetyPassed ? 'Static token guard' : 'AST safety rejection'}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">5. Fixture Allowlist</span>
                    <span className={`text-xs font-bold block mt-0.5 ${verificationReport.gates.allowlistIntegrityIntact ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {verificationReport.gates.allowlistIntegrityIntact ? 'Passed (Intact)' : 'Tampered / Mismatch'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {verificationReport.gates.allowlistIntegrityIntact ? 'Fixture hash matched' : 'Allowlist SHA altered'}
                    </span>
                  </div>
                </div>

                {/* Modern Cryptographic Receipt Card */}
                <div className={`rounded-xl border p-4 space-y-2.5 shadow-xs ${
                  verificationReport.decision === 'VERIFIED'
                    ? 'border-slate-800 bg-slate-900 text-slate-100'
                    : 'border-slate-300 bg-slate-800 text-slate-200'
                }`}>
                  <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Shield className={`w-3.5 h-3.5 ${verificationReport.decision === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <span>Cryptographic Integrity Manifest</span>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      verificationReport.decision === 'VERIFIED'
                        ? (verificationReport.receipt?.integrity === 'VALID'
                            ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800'
                            : 'text-amber-400 bg-amber-950/80 border-amber-800')
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
                        title="Copy receipt SHA-256"
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
                <details className="rounded-lg border border-slate-200 p-3 bg-slate-50/40">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Run Verification Logs</span>
                  </summary>
                  <div className="mt-2.5 space-y-2 text-xs font-mono">
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                        Baseline Log (Exit {verificationReport.runs.baseline?.exitCode ?? '?'})
                      </span>
                      <p className={`text-[11px] whitespace-pre-wrap ${verificationReport.gates.baselineReproduced ? 'text-rose-700' : 'text-slate-600'}`}>
                        {verificationReport.runs.baseline?.summary}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                        Negative Control Log (Exit {verificationReport.runs.negative?.exitCode ?? '?'})
                      </span>
                      <p className={`text-[11px] whitespace-pre-wrap ${verificationReport.gates.negativeControlCaught ? 'text-rose-700' : 'text-slate-600'}`}>
                        {verificationReport.runs.negative?.summary}
                      </p>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">
                        Candidate Log (Exit {verificationReport.runs.candidate?.exitCode ?? '?'})
                      </span>
                      <p className={`text-[11px] whitespace-pre-wrap ${verificationReport.gates.candidatePassed ? 'text-emerald-700' : 'text-rose-700 font-semibold'}`}>
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
                          Branch <code className="font-mono text-emerald-900">{publishedPr.branch}</code> bound to verified receipt <code className="font-mono text-emerald-900">{publishedPr.receiptSha256.slice(0, 12)}…</code>
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
                          The fixture passed its checks. Prepare a draft pull request in the dedicated test repository (<code className="font-mono text-slate-800">configured repository</code>) with the run evidence attached.
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
                  {verificationReport.isSimulated !== false ? 'Local fixture run; no isolated sandbox was verified. ' : 'Only the known fixture is supported. '}Other candidates remain blocked. See <Link href="/docs" className="text-violet-700 hover:underline">Documentation</Link>.
                </p>
              </div>
            )}

            {/* 5. Local Review Draft & Audit Trail */}
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
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent shadow-2xs"
                />
                <div className="flex items-center justify-end">
                  <button
                    type="submit"
                    disabled={draftForm.processing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" />
                    <span>{draftForm.processing ? 'Saving…' : 'Save Review Note'}</span>
                  </button>
                </div>
              </form>

              {draft && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">Saved Local Review Draft</span>
                    <span>{draft.savedAt.slice(0, 16)}</span>
                  </div>
                  <p className="text-slate-800 font-mono whitespace-pre-wrap text-[11px]">{draft.comment}</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
