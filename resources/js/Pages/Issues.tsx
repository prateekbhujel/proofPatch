import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '../Components/AppLayout';
import { TaskCardSection, LocalTaskCard } from '../Components/TaskCardSection';
import { KanbanBoard, KanbanTask } from '../Components/ui/KanbanBoard';
import { ThinkingAnimation } from '../Components/ui/ThinkingAnimation';
import { VerificationPipeline } from '../Components/ui/VerificationPipeline';
import {
  ArrowRight, Sparkles, Shield, AlertTriangle, CheckCircle2,
  MessageSquare, FileCode, Check, Copy, XCircle, Terminal,
  GitPullRequest, ExternalLink, Lock, Clock, FolderGit2,
  RefreshCw, ChevronDown, ChevronUp, Loader2, Eye, EyeOff,
} from 'lucide-react';

/* ────────────────────────────────────────────── types ── */
interface GitHubRepo { fullName: string; defaultBranch?: string; isPrivate: boolean; installedRepo?: boolean; }
interface GitHubIssueItem { number: number; title: string; body: string; user: string; htmlUrl: string; createdAt: string; labels: string[]; isPrivate: boolean; }
interface GitHubPullItem { number: number; state: string; isMerged?: boolean; title: string; head: string; base: string; headSha: string; baseSha: string; user: string; isPrivate: boolean; }
interface GitHubConnectionData {
  isConfigured: boolean; clientId: string | null; isConnected: boolean;
  user: { login: string; name?: string; avatarUrl?: string } | null;
  repositories: GitHubRepo[]; selectedRepo: string | null;
  repoIssues: GitHubIssueItem[]; repoPulls: GitHubPullItem[];
  repoListIncomplete: boolean;
  deviceFlow: { userCode: string; verificationUri: string; expiresAt: number; interval: number } | null;
}
interface IssueContext { isSynthetic?: boolean; provenance?: string; repository: string; issueNumber: number; issueUrl: string | null; title: string; body: string; commit: string | null; path: string; source: string; sourceSha256: string; }
interface Preview { destination: string; body: Record<string, unknown>; digest: string; estimatedMicros: number; approvalToken?: string; }
interface CandidatePreview { status: string; source: string; sha256: string; applied: boolean; verified: boolean; verificationRunId?: string; }
interface Suggestion { path: string; commit: string | null; find: string; replace: string; explanation: string; model: string | null; usage?: Record<string, number> | null; isOfflineExample?: boolean; isSynthetic?: boolean; provenance?: string; safetyNotice?: string; candidate?: CandidatePreview; }
interface Draft { comment: string; savedAt: string; readOnlyPolicy: string; }
interface VerificationRun { exitCode: number; logSha256: string; summary: string; }
interface VerificationGates { baselineReproduced: boolean; negativeControlCaught: boolean; candidatePassed: boolean; candidateStaticSafetyPassed: boolean; allowlistIntegrityIntact: boolean; }
interface VerificationReceipt { id: string; sha256: string; integrity: string; externallyAnchored: boolean; manifest: Record<string, unknown>; }
interface BackendSandboxGap { status: string; boundary: string; isolationLevel: string; remainingGap: string; }
interface VerificationReport {
  id: string; kind: string; createdAt: string; decision: 'VERIFIED' | 'FAILED' | 'INCONCLUSIVE';
  isSimulated?: boolean; baseCommit: string; isSynthetic?: boolean; provenance?: string;
  targetFile: string; baseSha256: string; candidateSha256: string; patchSha256: string;
  gates: VerificationGates; runs: { baseline: VerificationRun; negative: VerificationRun; candidate: VerificationRun };
  receipt: VerificationReceipt; evidenceDirectory: string; backendSandboxGap: BackendSandboxGap;
}
interface WorkbenchTaskData {
  id: number; key: string; repository: string; issueNumber: number; issueUrl: string | null;
  title: string; path: string; status: 'queued' | 'in_progress' | 'needs_review' | 'completed' | 'failed' | 'publishing' | 'outcome_unknown';
  provenance: string | null; isDedicated: boolean; isSynthetic: boolean; isOfflineExample: boolean; isSimulated: boolean;
  verificationDecision: string | null; model?: string | null;
  publishedPrNumber: number | null; publishedPrUrl: string | null; publishedBranch: string | null; updatedAt: string;
}

interface Props {
  context: IssueContext | null; preview: Preview | null; suggestion: Suggestion | null; draft?: Draft | null;
  verificationReport?: VerificationReport | null; isOwnedFixture?: boolean; isDedicatedTestRepo?: boolean;
  publishedPr?: { status: string; prNumber: number; prUrl: string; branch: string; commitSha: string; draft: boolean; repository: string; publishedAt: string; receiptSha256: string } | null;
  hasPublicationToken?: boolean; publisherDisconnected?: boolean;
  budget: { canRequest: boolean; attempts: number; maxAttempts: number } | null; error: string | null;
  tasks?: WorkbenchTaskData[]; localTasks?: LocalTaskCard[];
  githubConnection?: GitHubConnectionData | null; modelContextAllowed?: boolean; modelKeyAvailable?: boolean;
}

/* ────────────────────────────────────────────── section wrapper ── */
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`rounded-2xl border border-white/[0.06] bg-[#16161f]/80 backdrop-blur-sm p-5 space-y-4 shadow-xl shadow-black/10 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function SectionHeader({ title, subtitle, badge, actions }: { title: string; subtitle?: string; badge?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/[0.06] pb-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-white tracking-tight">{title}</h2>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ────────────────────────────────────────────── main ── */

export default function Issues({
  context, preview, suggestion, draft, verificationReport, isOwnedFixture, isDedicatedTestRepo,
  publishedPr, hasPublicationToken, publisherDisconnected = true, budget, error,
  tasks = [], localTasks = [], githubConnection = null, modelContextAllowed = false, modelKeyAvailable = false,
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
  const [intakeOpen, setIntakeOpen] = useState(true);

  function handleSelectRepo(repoName: string) {
    if (!repoName) return;
    if (repoName !== githubConnection?.selectedRepo) setIssuePathMap({});
    setLoadingRepo(true);
    router.post('/issues/select-repository', { repository: repoName }, { preserveScroll: true, onFinish: () => setLoadingRepo(false) });
  }
  function handleLoadIssue(issue: GitHubIssueItem) {
    if (!githubConnection?.selectedRepo) return;
    const path = issuePathMap[issue.number]?.trim() || '';
    if (!path) return;
    setLoadingIssueNum(issue.number);
    router.post('/issues/load-issue', { repository: githubConnection.selectedRepo, issue_number: issue.number, path }, { onFinish: () => setLoadingIssueNum(null) });
  }
  function captureIssue(event: React.FormEvent) { event.preventDefault(); capture.post('/issues/preview'); }
  function loadOwned(event: React.MouseEvent) { event.preventDefault(); setLoadingOwned(true); router.post('/issues/load-owned', {}, { onFinish: () => setLoadingOwned(false) }); }
  function loadDedicated(event: React.MouseEvent) { event.preventDefault(); setLoadingDedicated(true); router.post('/issues/load-dedicated', {}, { onFinish: () => setLoadingDedicated(false) }); }
  function publishDraftPr(event: React.MouseEvent) { event.preventDefault(); setPublishingPr(true); router.post('/issues/publish-pr', {}, { onFinish: () => setPublishingPr(false) }); }
  function requestSuggestion(event: React.FormEvent) {
    event.preventDefault();
    const canSubmit = !sending && modelContextAllowed && Boolean(preview) && (Boolean(budget?.canRequest && modelKeyAvailable) || isDedicatedTestRepo || isOwnedFixture);
    if (!canSubmit) return;
    router.post('/issues/propose', { digest: preview!.digest, approved: true, approval_token: preview!.approvalToken }, { onStart: () => setSending(true), onFinish: () => setSending(false) });
  }
  function handleSaveDraft(event: React.FormEvent) { event.preventDefault(); draftForm.post('/issues/draft'); }
  function verifyCandidate(event: React.MouseEvent) { event.preventDefault(); setVerifying(true); router.post('/issues/verify', {}, { onFinish: () => setVerifying(false) }); }
  function copyReceipt(sha: string) { navigator?.clipboard?.writeText(sha); setCopiedReceipt(true); setTimeout(() => setCopiedReceipt(false), 2000); }
  function copyCandidateHash(sha: string) { navigator?.clipboard?.writeText(sha); setCopiedCandidateSha(true); setTimeout(() => setCopiedCandidateSha(false), 2000); }

  const activeTaskId = tasks.find((t) => context && t.repository === context.repository && t.issueNumber === context.issueNumber)?.id ?? null;

  // Build verification gates for VerificationPipeline
  const pipelineGates = verificationReport ? [
    { label: 'Baseline Reproduction', shortLabel: 'Baseline', passed: verificationReport.gates.baselineReproduced, detail: verificationReport.gates.baselineReproduced ? 'Bug reproduced' : `Failed (Exit ${verificationReport.runs.baseline?.exitCode ?? '?'})` },
    { label: 'Negative Control', shortLabel: 'Neg Control', passed: verificationReport.gates.negativeControlCaught, detail: verificationReport.gates.negativeControlCaught ? 'Shortcut caught' : 'Negative control missed' },
    { label: 'Candidate Test', shortLabel: 'Candidate', passed: verificationReport.gates.candidatePassed, detail: verificationReport.gates.candidatePassed ? 'Tests passed' : `Failed (Exit ${verificationReport.runs.candidate?.exitCode ?? '?'})` },
    { label: 'AST Safety', shortLabel: 'AST Safety', passed: verificationReport.gates.candidateStaticSafetyPassed, detail: verificationReport.gates.candidateStaticSafetyPassed ? '0 violations' : 'Disallowed token' },
    { label: 'Fixture Allowlist', shortLabel: 'Allowlist', passed: verificationReport.gates.allowlistIntegrityIntact, detail: verificationReport.gates.allowlistIntegrityIntact ? 'Hash intact' : 'Tampered' },
  ] : null;

  // Thinking steps for AI proposal
  const thinkingSteps = [
    { label: 'Analyzing issue context and target file', status: sending ? 'active' as const : 'waiting' as const },
    { label: 'Generating code proposal via Muse', status: sending ? 'active' as const : 'waiting' as const },
    { label: 'Validating proposal against safety constraints', status: 'waiting' as const },
    { label: 'Preparing candidate for verification', status: 'waiting' as const },
  ];

  const verifierThinkingSteps = [
    { label: 'Mounting workspace read-only', status: verifying ? 'active' as const : 'done' as const },
    { label: 'Running baseline (bug reproduction)', status: verifying ? 'active' as const : 'waiting' as const },
    { label: 'Testing negative control (shortcut detection)', status: verifying ? 'active' as const : 'waiting' as const },
    { label: 'Evaluating candidate fix', status: verifying ? 'active' as const : 'waiting' as const },
    { label: 'Checking AST safety and allowlist', status: 'waiting' as const },
  ];

  return (
    <AppLayout activeNav="issues">
      <Head title="Issues Workbench · ProofPatcher" />
      <div className="space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Issues Workbench</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Ticket intake, AI code proposal, and falsifiable 5-gate verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06]">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Read-Only Workbench
            </span>
          </div>
        </motion.div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              role="alert"
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Host Execution Guard Banner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 flex items-start gap-3"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-300/80 space-y-0.5">
            <p className="font-semibold text-amber-300">Host execution disabled</p>
            <p>Model-generated or untrusted candidate code cannot be executed on the host. Worktrees, temporary directories, and token filters are not security sandboxes; an isolated microVM runner is required.</p>
          </div>
        </motion.div>

        {/* ═══════════════════════ Kanban Board ═══════════════════════ */}
        <Section>
          <SectionHeader
            title="Task Board"
            subtitle="Drag cards between columns. Status changes are server-authoritative."
            badge={
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </span>
            }
          />
          <KanbanBoard
            tasks={tasks}
            activeTaskId={activeTaskId}
            onSelectTask={(task) => router.post('/issues/switch-task', { task_id: task.id })}
          />
        </Section>

        {/* ═══════════════════════ Task Cards ═══════════════════════ */}
        <TaskCardSection localTasks={localTasks} githubConnection={githubConnection} />

        {/* ═══════════════════════ 1. Ticket Intake ═══════════════════════ */}
        <Section>
          <SectionHeader
            title="1. Ticket Intake"
            subtitle={githubConnection?.isConnected
              ? 'Select an authorized repository or load test cases'
              : 'Connect GitHub or load test cases'}
            actions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadDedicated}
                  disabled={loadingDedicated}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition disabled:opacity-50"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  {loadingDedicated ? 'Loading…' : 'Dedicated Test Issue (#1)'}
                </button>
                <button
                  type="button"
                  onClick={loadOwned}
                  disabled={loadingOwned}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition disabled:opacity-50"
                >
                  <FileCode className="w-3.5 h-3.5 text-slate-400" />
                  {loadingOwned ? 'Loading…' : 'Synthetic Fixture'}
                </button>
                <button
                  type="button"
                  onClick={() => setIntakeOpen(!intakeOpen)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition"
                >
                  {intakeOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            }
          />

          <AnimatePresence>
            {intakeOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden space-y-4"
              >
                {/* Connected GitHub Account + Repo Browser */}
                {githubConnection?.isConnected ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {githubConnection.user?.avatarUrl ? (
                          <img src={githubConnection.user.avatarUrl} alt={githubConnection.user.login} className="w-8 h-8 rounded-lg border border-white/10" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-300 flex items-center justify-center font-bold text-xs">
                            {githubConnection.user?.login?.slice(0, 2).toUpperCase() || 'GH'}
                          </div>
                        )}
                        <div>
                          <span className="text-xs font-semibold text-white block">@{githubConnection.user?.login}</span>
                          <span className="text-[11px] text-slate-500">{githubConnection.repositories.length} repositories</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                        <select
                          value={githubConnection.selectedRepo || ''}
                          onChange={(e) => handleSelectRepo(e.target.value)}
                          disabled={loadingRepo}
                          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        >
                          <option value="">Choose a repository</option>
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
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${loadingRepo ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Issues List */}
                    {githubConnection.selectedRepo && githubConnection.repoIssues?.length > 0 && (
                      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {githubConnection.repoIssues.map((issue) => {
                          const targetPath = issuePathMap[issue.number] ?? '';
                          const isLoadingThis = loadingIssueNum === issue.number;
                          return (
                            <div key={issue.number} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2 hover:bg-white/[0.04] transition">
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-white">#{issue.number}</span>
                                    <a href={issue.htmlUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-slate-200 hover:text-violet-300 flex items-center gap-1">
                                      {issue.title} <ExternalLink className="w-3 h-3 text-slate-500" />
                                    </a>
                                  </div>
                                  <span className="text-[11px] text-slate-500">@{issue.user}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <input
                                    type="text"
                                    value={targetPath}
                                    onChange={(e) => setIssuePathMap((prev) => ({ ...prev, [issue.number]: e.target.value }))}
                                    placeholder="Source file path"
                                    className="w-36 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleLoadIssue(issue)}
                                    disabled={isLoadingThis || !targetPath.trim()}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 transition disabled:opacity-50"
                                  >
                                    {isLoadingThis ? 'Loading…' : 'Open'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-white">Connect GitHub</span>
                      <p className="text-[11px] text-slate-500 mt-0.5">Connect via RFC 8628 Device Flow to browse repositories.</p>
                    </div>
                    <Link href="/settings" className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl text-white bg-violet-600 hover:bg-violet-700 transition">
                      Connect <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}

                {/* Manual URL Input */}
                <details className="rounded-xl border border-white/[0.06] p-3 bg-white/[0.02] text-xs">
                  <summary className="cursor-pointer font-semibold text-slate-300 hover:text-white">Manual Issue URL</summary>
                  <form onSubmit={captureIssue} className="space-y-3 pt-3 mt-2 border-t border-white/[0.06]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="url" required
                        placeholder="https://github.com/owner/repo/issues/123"
                        value={capture.data.issue_url}
                        onChange={(e) => capture.setData('issue_url', e.target.value)}
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                      <input
                        required
                        placeholder="src/OrderTotal.php"
                        value={capture.data.path}
                        onChange={(e) => capture.setData('path', e.target.value)}
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" disabled={capture.processing} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-violet-600 hover:bg-violet-700 transition disabled:opacity-50">
                        {capture.processing ? 'Capturing…' : 'Preview Target'}
                      </button>
                    </div>
                  </form>
                </details>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>

        {/* ═══════════════════════ 2. Muse Proposal ═══════════════════════ */}
        <AnimatePresence>
          {context && preview && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              <Section>
                <SectionHeader
                  title="2. Muse Proposal"
                  subtitle={context.isSynthetic ? `Synthetic Fixture · ${context.path}` : `${context.repository}#${context.issueNumber} · ${context.path}`}
                  badge={
                    context.isSynthetic ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">Fixture</span>
                    ) : null
                  }
                  actions={
                    suggestion ? (
                      <button
                        type="button"
                        onClick={() => setShowPayloadDetails(!showPayloadDetails)}
                        className="text-xs text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1"
                      >
                        {showPayloadDetails ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showPayloadDetails ? 'Hide Details' : 'View Details'}
                      </button>
                    ) : undefined
                  }
                />

                {/* Intake details (collapsed after proposal) */}
                {(!suggestion || showPayloadDetails) && (
                  <div className="space-y-3 text-xs">
                    <details className="rounded-xl border border-white/[0.06] p-3 bg-white/[0.02]" open={!suggestion}>
                      <summary className="cursor-pointer font-semibold text-slate-200">Issue: {context.title}</summary>
                      <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-400 font-mono bg-black/20 p-3 rounded-lg border border-white/[0.04]">
                        {context.body || '(No description)'}
                      </pre>
                    </details>
                    <details className="rounded-xl border border-white/[0.06] p-3 bg-white/[0.02]">
                      <summary className="cursor-pointer font-semibold text-slate-200">Target Source: {context.path}</summary>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre text-xs text-slate-400 font-mono bg-black/20 p-3 rounded-lg border border-white/[0.04]">
                        {context.source}
                      </pre>
                    </details>
                  </div>
                )}

                {/* Thinking Animation during proposal */}
                <ThinkingAnimation
                  isActive={sending}
                  steps={thinkingSteps}
                  title="Generating Proposal"
                  subtitle="Muse is analyzing the issue and writing a targeted code fix…"
                />

                {/* Proposal request button */}
                {!suggestion && !sending && (
                  <form onSubmit={requestSuggestion} className="pt-2 border-t border-white/[0.06]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={!modelContextAllowed || sending || (!(budget?.canRequest && modelKeyAvailable) && !isDedicatedTestRepo && !isOwnedFixture)}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-xl text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/20 transition disabled:opacity-50"
                        >
                          <Sparkles className="w-4 h-4" />
                          {budget?.canRequest && modelKeyAvailable ? 'Assign to Muse' : 'Load Offline Reference Repair'}
                        </button>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {budget?.canRequest && modelKeyAvailable
                            ? `Est: $${(preview.estimatedMicros / 1000000).toFixed(4)}`
                            : '$0.00'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {!modelContextAllowed ? 'Private content stays local' : budget?.canRequest && modelKeyAvailable ? 'Sends issue + file to model' : 'No model request sent'}
                      </span>
                    </div>
                  </form>
                )}
              </Section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════ 3. Code Proposal ═══════════════════════ */}
        <AnimatePresence>
          {suggestion && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Section>
                <SectionHeader
                  title="3. Code Proposal"
                  subtitle={`${suggestion.path} · ${suggestion.model || suggestion.provenance || 'Local Fixture'}`}
                  badge={
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                      suggestion.candidate?.verified
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {suggestion.candidate?.verified
                        ? (verificationReport?.isSimulated !== false ? 'Local Fixture Passed' : 'Verified')
                        : 'Unverified'}
                    </span>
                  }
                />

                <p className="text-xs text-slate-300 leading-relaxed">{suggestion.explanation}</p>

                {/* Code diff */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Find (Existing)</span>
                    <pre className="overflow-auto whitespace-pre-wrap rounded-xl bg-rose-500/5 border border-rose-500/10 p-3 text-xs font-mono text-rose-300">{suggestion.find}</pre>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">Replace With</span>
                    <pre className="overflow-auto whitespace-pre-wrap rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3 text-xs font-mono text-emerald-300">{suggestion.replace}</pre>
                  </div>
                </div>

                {/* Candidate source */}
                {suggestion.candidate && (
                  <details className="rounded-xl border border-white/[0.06] p-3 bg-white/[0.02]">
                    <summary className="cursor-pointer text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Candidate Source</span>
                      <span className="font-mono text-[11px] text-slate-500 font-normal">SHA: {suggestion.candidate.sha256.slice(0, 10)}…</span>
                    </summary>
                    <div className="mt-2.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span>SHA-256: <code>{suggestion.candidate.sha256.slice(0, 16)}…</code></span>
                          <button type="button" onClick={() => copyCandidateHash(suggestion.candidate!.sha256)} className="text-slate-500 hover:text-white p-0.5 rounded">
                            {copiedCandidateSha ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <span>Applied: No</span>
                      </div>
                      <pre className="max-h-56 overflow-auto whitespace-pre rounded-xl bg-black/20 p-3 text-xs font-mono text-slate-400 border border-white/[0.04]">{suggestion.candidate.source}</pre>
                    </div>
                  </details>
                )}

                {/* ═══════════ Verifier CTA ═══════════ */}
                {(isOwnedFixture || isDedicatedTestRepo) && (
                  <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-indigo-500/5 p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Shield className="w-4 h-4 text-violet-400" />
                          ProofPatcher Verifier
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">5-gate falsifiable verification pipeline</p>
                      </div>
                      <button
                        type="button"
                        onClick={verifyCandidate}
                        disabled={verifying}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-xl text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/20 transition disabled:opacity-50"
                      >
                        {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {verifying ? 'Running Verifier…' : verificationReport ? 'Re-run Verifier' : 'Run Verifier'}
                      </button>
                    </div>

                    {/* Verifier thinking animation */}
                    <ThinkingAnimation
                      isActive={verifying}
                      steps={verifierThinkingSteps}
                      title="Executing Verification Pipeline"
                      subtitle="Running baseline, negative control, and candidate tests in isolation…"
                    />
                  </div>
                )}

                {/* ═══════════ 4. Verifier Evidence ═══════════ */}
                {verificationReport && (
                  <div className="space-y-4 pt-4 border-t border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">4. Verification Evidence</h3>
                      <span className="text-[11px] text-slate-500 font-mono">{verificationReport.id.slice(0, 15)}…</span>
                    </div>

                    <VerificationPipeline
                      isRunning={verifying}
                      gates={pipelineGates}
                      decision={verificationReport.decision}
                      isSimulated={verificationReport.isSimulated}
                    />

                    {/* Cryptographic Receipt */}
                    <div className={`rounded-2xl border p-4 space-y-3 ${
                      verificationReport.decision === 'VERIFIED'
                        ? 'border-emerald-500/20 bg-gradient-to-br from-[#0d1117] to-[#101820]'
                        : 'border-white/[0.06] bg-[#0d0d15]'
                    }`}>
                      <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Shield className={`w-3.5 h-3.5 ${verificationReport.decision === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'}`} />
                          Cryptographic Receipt
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border ${
                          verificationReport.decision === 'VERIFIED'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                        }`}>
                          {verificationReport.decision} · {verificationReport.receipt?.integrity ?? 'NONE'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500 mb-1">Receipt SHA-256</span>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 font-mono text-xs bg-black/30 px-3 py-1.5 rounded-lg border border-white/[0.04] text-emerald-400 truncate">
                            {verificationReport.receipt?.sha256 ?? 'Unavailable'}
                          </code>
                          <button
                            type="button"
                            onClick={() => verificationReport.receipt?.sha256 && copyReceipt(verificationReport.receipt.sha256)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/[0.06] hover:bg-white/10 text-slate-300 border border-white/[0.06] transition"
                          >
                            {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copiedReceipt ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 text-[10px] text-slate-500 font-mono">
                        <span>Base: {verificationReport.baseCommit.slice(0, 8)}</span>
                        <span>Patch: {verificationReport.patchSha256.slice(0, 8)}…</span>
                        <span>Evidence: runs/{verificationReport.id.slice(0, 15)}…</span>
                      </div>
                    </div>

                    {/* Run Logs */}
                    <details className="rounded-xl border border-white/[0.06] p-3 bg-white/[0.02]">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-slate-500" />
                        Verification Logs
                      </summary>
                      <div className="mt-2.5 space-y-2 text-xs font-mono">
                        {[
                          { label: 'Baseline', run: verificationReport.runs.baseline, passed: verificationReport.gates.baselineReproduced },
                          { label: 'Negative', run: verificationReport.runs.negative, passed: verificationReport.gates.negativeControlCaught },
                          { label: 'Candidate', run: verificationReport.runs.candidate, passed: verificationReport.gates.candidatePassed },
                        ].map(({ label, run, passed }) => (
                          <div key={label} className="bg-black/20 p-2.5 rounded-lg border border-white/[0.04]">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">{label} (Exit {run?.exitCode ?? '?'})</span>
                            <p className={`text-[11px] whitespace-pre-wrap ${passed ? 'text-slate-400' : 'text-rose-400'}`}>{run?.summary}</p>
                          </div>
                        ))}
                      </div>
                    </details>

                    {/* Draft PR */}
                    {verificationReport.decision === 'VERIFIED' && verificationReport.isSimulated === false && (
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <GitPullRequest className="w-4 h-4 text-violet-400" />
                            <h4 className="text-xs font-bold text-white">Draft PR Publication</h4>
                          </div>
                        </div>
                        {publishedPr ? (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                Draft PR #{publishedPr.prNumber}
                              </span>
                              <span className="text-[10px] text-emerald-400/60">Draft · No Auto-Merge</span>
                            </div>
                            <p className="text-xs text-slate-400">
                              Branch <code className="text-emerald-400">{publishedPr.branch}</code> · Receipt <code className="text-emerald-400">{publishedPr.receiptSha256.slice(0, 12)}…</code>
                            </p>
                            <a href={publishedPr.prUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                              View PR <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        ) : publisherDisconnected ? (
                          <div className="flex items-center gap-2 text-xs text-amber-300">
                            <Lock className="w-3.5 h-3.5" />
                            <span className="font-semibold">PR Creation Held in Review Safety Mode</span>
                          </div>
                        ) : (
                          <button type="button" onClick={publishDraftPr} disabled={publishingPr} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-violet-600 hover:bg-violet-700 transition disabled:opacity-50">
                            <GitPullRequest className="w-3.5 h-3.5" />
                            {publishingPr ? 'Preparing…' : 'Create Draft PR'}
                          </button>
                        )}
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500">
                      {verificationReport.isSimulated !== false ? 'Local fixture run; no isolated sandbox verified. ' : 'Only known fixture supported. '}
                      Other candidates remain blocked. See <Link href="/docs" className="text-violet-400 hover:underline">Docs</Link>.
                    </p>
                  </div>
                )}

                {/* 5. Review Draft */}
                <div className="pt-3 border-t border-white/[0.06] space-y-3">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    5. Review Draft Note
                    <span className="text-[11px] text-slate-600 font-normal ml-auto">Local Session Only</span>
                  </h3>
                  <form onSubmit={handleSaveDraft} className="space-y-2">
                    <textarea
                      rows={2}
                      value={draftForm.data.comment}
                      onChange={(e) => draftForm.setData('comment', e.target.value)}
                      placeholder="Record review notes…"
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    />
                    <div className="flex items-center justify-between">
                      {draft && <span className="text-[10px] text-slate-500">Last saved: {draft.savedAt}</span>}
                      <button type="submit" disabled={draftForm.processing} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-white/[0.06] hover:bg-white/10 border border-white/[0.06] transition disabled:opacity-50">
                        <MessageSquare className="w-3 h-3" />
                        {draftForm.processing ? 'Saving…' : 'Save Review Note'}
                      </button>
                    </div>
                  </form>
                </div>
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
