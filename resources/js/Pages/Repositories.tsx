import React, { useState, useEffect } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { DiffViewer, PatchFile } from '../Components/DiffViewer';
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
  Sparkles,
  Info,
  Clock,
  MessageSquare,
  Trash2,
  Edit3,
  CornerDownRight,
  Key,
  RefreshCw,
  LogOut,
  FolderGit2,
  ChevronDown,
  ChevronUp,
  Settings,
  Lock,
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

interface GitHubUser {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  htmlUrl: string;
}

interface GitHubDeviceFlowData {
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  interval: number;
}

interface GitHubPull {
  number: number;
  title: string;
  head: string;
  base: string;
  headSha: string;
  baseSha: string;
  user: string;
  isPrivate: boolean;
}

interface GitHubStatusMetadata {
  truncated?: boolean;
  installationsCount?: number;
  repositoriesCount?: number;
  count?: number;
  errors?: string[];
}

interface GitHubConnectionData {
  isConfigured: boolean;
  clientId: string | null;
  isConnected: boolean;
  user: GitHubUser | null;
  repositories: GitHubRepo[];
  repositoriesStatus?: GitHubStatusMetadata | null;
  selectedRepo: string | null;
  repoPulls: GitHubPull[];
  repoPullsStatus?: GitHubStatusMetadata | null;
  deviceFlow: GitHubDeviceFlowData | null;
  statusMessage: string | null;
  errorMessage: string | null;
}

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
  isPrivate?: boolean;
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
  incomplete: boolean;
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
    testPaths: string[];
    fileCount: number;
    filesTruncated: boolean;
  };
  policy: {
    mode: string;
    status: 'review' | 'unknown' | 'within_limit';
    maxDiffLines: number;
    totalChanges: number;
    diffExceeded: boolean;
    requireTestCoverage: boolean;
    coverage: 'unknown';
  };
  summary: {
    verdict: string;
    headline: string;
    detail: string;
    severity: 'red' | 'amber' | 'emerald';
  };
  comparisons: TriageComparison[];
}

interface ReviewFinding {
  path: string;
  status: 'note' | 'concern' | 'approval';
  lineHint: number | null;
  comment: string;
  commentable?: boolean;
  anchorStatus?: 'anchored' | 'hint_only' | 'stale';
  anchorMessage?: string;
  lineType?: string | null;
}

interface ReviewResult {
  unverified: boolean;
  model: string;
  reviewedAt: string;
  inputDigest: string;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: 'approve' | 'request_changes' | 'discuss';
  fileFindings: ReviewFinding[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface ReviewPreviewData {
  destination: string;
  digest: string;
  estimatedMicros: number;
  filesCount: number;
  fileNames: string[];
  body?: Record<string, any>;
  approvalToken?: string;
  isPrivate?: boolean;
}

interface CommentDraft {
  id: string;
  path: string;
  line: number | null;
  side: string;
  comment: string;
  headSha: string;
  status: 'anchored' | 'hint_only' | 'stale';
  valid: boolean;
  lineType: string | null;
  message: string;
  updatedAt: string;
}

interface BudgetData {
  attempts: number;
  limitAttempts: number;
  reservedMicros: number;
  limitMicros: number;
  remainingMicros: number;
  canRequest: boolean;
}

interface RepositoriesProps {
  pull?: PullData | null;
  snapshot?: SnapshotData | null;
  triage?: TriageData | null;
  error?: string | null;
  patchPreview?: {
    headSha: string;
    baseSha: string;
    isPrivate?: boolean;
    changedFiles: number;
    filesTruncated: boolean;
    files: Array<{ name: string; status: 'available' | 'missing' | 'oversize' | 'partial'; patch: string | null }>;
  } | null;
  patchPreviewError?: string | null;
  review?: ReviewResult | null;
  reviewPreview?: ReviewPreviewData | null;
  reviewError?: string | null;
  drafts?: CommentDraft[];
  commentApprovals?: Record<string, string>;
  commentPosted?: boolean;
  budget?: BudgetData | null;
  githubConnection?: GitHubConnectionData | null;
  csrf?: string;
}

export default function Repositories({
  pull = null,
  snapshot = null,
  triage = null,
  error = null,
  patchPreview = null,
  patchPreviewError = null,
  review = null,
  reviewPreview = null,
  reviewError = null,
  drafts = [],
  commentApprovals = {},
  commentPosted = false,
  budget = null,
  githubConnection = null,
}: RepositoriesProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'triage' | 'files' | 'review' | 'checks' | 'receipt' | 'new'>(
    review || reviewError ? 'review' : patchPreview || patchPreviewError ? 'files' : pull ? 'overview' : 'new'
  );
  const [fileQuery, setFileQuery] = useState('');
  const [checkQuery, setCheckQuery] = useState('');
  const [copiedSha, setCopiedSha] = useState(false);
  const [copiedDigest, setCopiedDigest] = useState(false);
  const [copiedReviewDigest, setCopiedReviewDigest] = useState(false);
  const [copiedUserCode, setCopiedUserCode] = useState(false);
  const [reviewApproved, setReviewApproved] = useState(false);
  const [commentToPost, setCommentToPost] = useState<string | null>(null);
  const [postingComment, setPostingComment] = useState(false);
  const [privateConsentApproved, setPrivateConsentApproved] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<'comment' | 'approve' | 'request_changes'>('comment');
  const [gitHubSectionOpen, setGitHubSectionOpen] = useState(
    Boolean(githubConnection?.isConnected || githubConnection?.deviceFlow || !pull)
  );

  const isPrivate = Boolean(pull?.isPrivate || patchPreview?.isPrivate || reviewPreview?.isPrivate);

  const { data: reviewFormData, setData: setReviewFormData, post: postReview, processing: reviewProcessing } = useForm({
    digest: reviewPreview?.digest || '',
    confirm: false,
    approval_token: reviewPreview?.approvalToken || '',
    private_consent: false,
  });

  const { data: deviceFormData, setData: setDeviceFormData, post: postDeviceInitiate, processing: deviceInitiateProcessing } = useForm({
    client_id: githubConnection?.clientId || '',
  });

  const handleInitiateDeviceFlow = (e: React.FormEvent) => {
    e.preventDefault();
    postDeviceInitiate('/github/device/initiate');
  };

  const handlePollDeviceFlow = (e: React.FormEvent) => {
    e.preventDefault();
    router.post('/github/device/poll', {}, { preserveScroll: true });
  };

  const handleDisconnectDevice = (e: React.FormEvent) => {
    e.preventDefault();
    router.post('/github/device/disconnect', {}, { preserveScroll: true });
  };

  const handleSelectRepository = (repoFullName: string) => {
    router.post('/github/repositories/select', { repository: repoFullName }, { preserveScroll: true });
  };

  const handleCaptureGitHubPull = (pullItem: GitHubPull) => {
    if (!githubConnection?.selectedRepo) return;
    if (pullItem.isPrivate) return;
    router.post('/github/pulls/capture', {
      repository: githubConnection.selectedRepo,
      number: pullItem.number,
    });
  };

  useEffect(() => {
    if (reviewPreview?.approvalToken) {
      setReviewFormData('approval_token', reviewPreview.approvalToken);
      setReviewFormData('digest', reviewPreview.digest);
    }
  }, [reviewPreview?.approvalToken, reviewPreview?.digest]);

  const { post: postClearReview, processing: clearReviewProcessing } = useForm({});

  const { data: draftData, setData: setDraftData, post: postDraft, processing: draftProcessing } = useForm({
    path: '',
    line: null as number | null,
    side: 'RIGHT',
    comment: '',
    headSha: pull?.headSha || '',
  });

  const { post: postDeleteDraft, processing: deleteDraftProcessing } = useForm({ id: '' });
  const { post: postClearDrafts, processing: clearDraftsProcessing } = useForm({});

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewPreview || !reviewApproved) return;
    if (isPrivate && !privateConsentApproved) return;
    postReview('/repositories/review');
  };

  const handleClearReview = (e: React.FormEvent) => {
    e.preventDefault();
    postClearReview('/repositories/review/clear');
  };

  const handleSaveDraft = (path: string, line: number | null, side: string, comment: string) => {
    if (!comment.trim() || !pull) return;

    router.post('/repositories/review/draft', {
      path,
      line,
      side,
      comment: comment.trim(),
      headSha: pull.headSha,
    }, {
      preserveScroll: true,
    });
  };

  const handleDeleteDraft = (id: string) => {
    router.post('/repositories/review/draft/delete', { id }, { preserveScroll: true });
  };

  const handleClearAllDrafts = (e: React.FormEvent) => {
    e.preventDefault();
    router.post('/repositories/review/draft/clear', {}, { preserveScroll: true });
  };

  const { data, setData, post, processing } = useForm({
    url: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post('/repositories');
  };

  const copyText = (text: string, type: 'sha' | 'digest' | 'reviewDigest') => {
    navigator.clipboard.writeText(text);
    if (type === 'sha') {
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 1500);
    } else if (type === 'digest') {
      setCopiedDigest(true);
      setTimeout(() => setCopiedDigest(false), 1500);
    } else {
      setCopiedReviewDigest(true);
      setTimeout(() => setCopiedReviewDigest(false), 1500);
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
    <AppLayout activeNav="repositories">
      <Head title={pull ? `${pull.repository}#${pull.number}` : 'Inspect Pull Request'} />

      <div className="space-y-6">
        {/* Error notification */}
        {error && (
          <div role="alert" className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <span>{error}</span>
          </div>
        )}
        {reviewError && (
          <div role="alert" className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <span>{reviewError}</span>
          </div>
        )}

        {/* GitHub App Connection Section (RFC 8628 Device Flow) */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div
            onClick={() => setGitHubSectionOpen(!gitHubSectionOpen)}
            className="p-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/60 transition"
          >
            <div className="flex items-center gap-2.5">
              <FolderGit2 className="w-4 h-4 text-violet-700" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">GitHub Connection</span>
                <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">(GitHub App Device Flow)</span>
              </div>
              {githubConnection?.isConnected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected as @{githubConnection.user?.login}
                </span>
              ) : githubConnection?.deviceFlow ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Code: {githubConnection.deviceFlow.userCode}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                  Not Connected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              {gitHubSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {gitHubSectionOpen && (
            <div className="p-5 space-y-4">
              {/* Feedback messages */}
              {githubConnection?.statusMessage && (
                <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{githubConnection.statusMessage}</span>
                </div>
              )}
              {githubConnection?.errorMessage && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{githubConnection.errorMessage}</span>
                </div>
              )}

              {/* State 1: Connected */}
              {githubConnection?.isConnected ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-3">
                      {githubConnection.user?.avatarUrl ? (
                        <img
                          src={githubConnection.user.avatarUrl}
                          alt={githubConnection.user.login}
                          className="w-8 h-8 rounded-full border border-slate-300"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                          {githubConnection.user?.login.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          <span>{githubConnection.user?.name || githubConnection.user?.login}</span>
                          <span className="text-slate-400 font-mono font-normal">(@{githubConnection.user?.login})</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {githubConnection.repositories.length} authorized {githubConnection.repositories.length === 1 ? 'repository' : 'repositories'} available
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleDisconnectDevice}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-2xs transition"
                      >
                        <LogOut className="w-3.5 h-3.5 text-slate-500" />
                        <span>Disconnect</span>
                      </button>
                    </form>
                  </div>

                  {/* Selected Repositories List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-slate-800">Installed Repositories (Least Privilege Scope)</h4>
                      <span className="text-[11px] text-slate-500">Selected during app installation</span>
                    </div>

                    {githubConnection.repositoriesStatus?.truncated && (
                      <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Repositories List Capped:</span> Additional repositories were omitted by pagination limits.
                        </div>
                      </div>
                    )}
                    {githubConnection.repositoriesStatus?.errors && githubConnection.repositoriesStatus.errors.length > 0 && (
                      <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Partial Installation Errors:</span>
                          <ul className="list-disc list-inside mt-0.5 font-mono text-[11px]">
                            {githubConnection.repositoriesStatus.errors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {githubConnection.repositories.length === 0 ? (
                      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-center text-xs text-slate-500 space-y-1">
                        <p className="font-medium text-slate-700">No repositories granted to this installation.</p>
                        <p className="text-[11px]">
                          Configure repository permissions on GitHub to grant ProofPatcher access to selected owned repositories.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {githubConnection.repositories.map((repo) => {
                          const isCurrent = githubConnection.selectedRepo === repo.fullName;
                          return (
                            <button
                              key={repo.fullName}
                              type="button"
                              onClick={() => handleSelectRepository(repo.fullName)}
                              className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between gap-2 ${
                                isCurrent
                                  ? 'bg-violet-50/70 border-violet-300 ring-1 ring-violet-400'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 truncate">{repo.fullName}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                  <span>{repo.defaultBranch}</span>
                                  <span>·</span>
                                  <span className={repo.isPrivate ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}>
                                    {repo.isPrivate ? 'Private' : 'Public'}
                                  </span>
                                </div>
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                                isCurrent ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {isCurrent ? 'Selected' : 'Select'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Open Pull Requests in Selected Repo */}
                  {githubConnection.selectedRepo && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-slate-800">
                          Open Pull Requests in <span className="font-mono text-violet-900">{githubConnection.selectedRepo}</span>
                        </h4>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {githubConnection.repoPulls.length} open
                        </span>
                      </div>

                      {githubConnection.repoPullsStatus?.truncated && (
                        <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Pull Requests Capped:</span> Showing first 500 open pull requests.
                          </div>
                        </div>
                      )}
                      {githubConnection.repoPullsStatus?.errors && githubConnection.repoPullsStatus.errors.length > 0 && (
                        <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Partial Retrieval Errors:</span>
                            <ul className="list-disc list-inside mt-0.5 font-mono text-[11px]">
                              {githubConnection.repoPullsStatus.errors.map((err, idx) => (
                                <li key={idx}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}

                      {githubConnection.repoPulls.length === 0 ? (
                        <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-center text-xs text-slate-500">
                          No open pull requests found in {githubConnection.selectedRepo}.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                          {githubConnection.repoPulls.map((pr) => (
                            <div key={pr.number} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-slate-900">#{pr.number}</span>
                                  <span className="text-xs font-medium text-slate-800 truncate">{pr.title}</span>
                                  {pr.isPrivate && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                      <Lock className="w-2.5 h-2.5 text-amber-700" />
                                      Private
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 font-mono">
                                  <span>by @{pr.user}</span>
                                  <span>·</span>
                                  <span>{pr.head} → {pr.base}</span>
                                </div>
                              </div>

                              {pr.isPrivate ? (
                                <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200">
                                  Private PR capture disabled
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCaptureGitHubPull(pr)}
                                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-2xs motion-safe:transition motion-reduce:transition-none shrink-0"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Review PR</span>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : githubConnection?.deviceFlow ? (
                /* State 2: Device Flow Active */
                <div className="p-4 rounded-lg border border-violet-200 bg-violet-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-violet-700" />
                      <span>Authorization In Progress (Code: {githubConnection.deviceFlow.userCode})</span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      Enter code <strong className="font-mono text-violet-900">{githubConnection.deviceFlow.userCode}</strong> on GitHub to finish connecting.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href="/settings"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-2xs motion-safe:transition motion-reduce:transition-none"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Manage in Settings</span>
                    </Link>
                  </div>
                </div>
              ) : (
                /* State 3: Not Connected - Concise link to Settings */
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-violet-700" />
                      <span>Connect Your GitHub Account</span>
                    </div>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      Connect via RFC 8628 Device Flow to browse and inspect your owned public repositories directly.
                    </p>
                  </div>
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs motion-safe:transition motion-reduce:transition-none shrink-0 self-start sm:self-center"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Open Settings</span>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {pull ? (
          <>
            {/* PR Header Card & Co-Maintainer Context */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                    <span>{pull.repository}</span>
                    <span>/</span>
                    <span className="font-bold text-slate-900">#{pull.number}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        pull.state.toLowerCase() === 'open'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : pull.state.toLowerCase() === 'merged'
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {pull.state.toLowerCase() === 'merged' && <Check className="w-3 h-3 text-purple-700" />}
                      <span>{pull.state.toUpperCase()}</span>
                    </span>
                    {pull.state.toLowerCase() === 'merged' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        Historical Inspection
                      </span>
                    )}
                    {pull.isPrivate && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        <Lock className="w-2.5 h-2.5 text-amber-700" />
                        Private
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl font-bold tracking-tight text-slate-900">{pull.title}</h1>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                    <span className="inline-flex items-center gap-1 font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      <span>{pull.head}</span>
                    </span>
                    <span className="text-slate-400 font-mono">→</span>
                    <span className="inline-flex items-center gap-1 font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      <span>{pull.base}</span>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="font-mono text-slate-500 text-xs">
                      Commit{' '}
                      <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px] border border-slate-200">
                        {pull.headSha.slice(0, 8)}
                      </code>
                    </span>
                    {pull.files && pull.files.length > 0 && (() => {
                      const totalAdditions = pull.files.reduce((acc, f) => acc + (f.additions || 0), 0);
                      const totalDeletions = pull.files.reduce((acc, f) => acc + (f.deletions || 0), 0);
                      const total = totalAdditions + totalDeletions;
                      const addBlocks = total > 0 ? Math.round((totalAdditions / total) * 5) : 0;
                      return (
                        <>
                          <span className="text-slate-300">|</span>
                          <div className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold">
                            <span className="text-[#1a7f37]">+{totalAdditions}</span>
                            <span className="text-[#cf222e]">-{totalDeletions}</span>
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <span
                                  key={i}
                                  className={`w-1.5 h-2 rounded-2xs ${
                                    total === 0
                                      ? 'bg-slate-200'
                                      : i < addBlocks
                                      ? 'bg-[#1a7f37]'
                                      : 'bg-[#cf222e]'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 self-start md:self-center">
                  <a
                    href={pull.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
                  >
                    <span>View on GitHub</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                </div>
              </div>

              {/* Sanitized Triage Alert Bar */}
              {triage && (
                <div className="mt-3 px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      triage.summary.severity === 'emerald' ? 'bg-emerald-500' : triage.summary.severity === 'amber' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} />
                    <span className="font-semibold text-slate-800">
                      {triage.policy.diffExceeded
                        ? `Policy check: ${triage.policy.totalChanges} lines changed (${triage.policy.maxDiffLines} max)`
                        : triage.summary.headline}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('triage')}
                    className="text-xs font-medium px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shadow-2xs transition"
                  >
                    View Triage →
                  </button>
                </div>
              )}
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="border-b border-slate-200">
              <nav className="flex space-x-6 sm:space-x-8 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'border-violet-700 text-violet-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Overview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('triage')}
                  className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                    activeTab === 'triage'
                      ? 'border-violet-700 text-violet-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Triage & Overlap</span>
                  {triage?.comparisons && triage.comparisons.length > 0 && (
                    <span className="ml-1 bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded text-[10px] font-semibold">
                      {triage.comparisons.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                    activeTab === 'files'
                      ? 'border-violet-700 text-violet-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Changed Files</span>
                  <span className="ml-1 bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-semibold">
                    {files.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('review')}
                  className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                    activeTab === 'review'
                      ? 'border-violet-700 text-violet-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-slate-700" />
                  <span>Review & Findings</span>
                  {review && (
                    <span
                      className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                        review.riskLevel === 'low'
                          ? 'bg-emerald-100 text-emerald-800'
                          : review.riskLevel === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {review.riskLevel} risk
                    </span>
                  )}
                  {drafts && drafts.length > 0 && (
                    <span className="ml-1 bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-semibold">
                      {drafts.length} draft{drafts.length === 1 ? '' : 's'}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('checks')}
                  className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                    activeTab === 'checks'
                      ? 'border-violet-700 text-violet-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>GitHub Checks</span>
                  <span className="ml-1 bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-semibold">
                    {passedChecks}/{checks.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('receipt')}
                  className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                    activeTab === 'receipt'
                      ? 'border-violet-700 text-violet-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                    activeTab === 'new'
                      ? 'border-violet-700 text-violet-900 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
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
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Verification Scope</div>
                  <div className="text-sm font-semibold text-slate-900">Local Fixture Engine Only</div>
                  <div className="text-xs text-slate-500">Panther verifies bundled checkout fixtures in Checks; external PRs are read-only reviews.</div>
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
                            'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                          }`}
                        >
                          <span>Human review needed</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                          <div className="text-slate-500">Max Diff Lines</div>
                          <div className="text-sm font-bold font-mono text-slate-900">
                            {triage.target.filesTruncated ? 'At least ' : ''}{triage.policy.totalChanges} / {triage.policy.maxDiffLines} lines
                          </div>
                          <div className={`font-medium ${triage.policy.diffExceeded ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {triage.policy.diffExceeded ? 'Exceeded limit' : triage.target.filesTruncated ? 'Incomplete file list' : 'Within configured limit'}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                          <div className="text-slate-500">Test coverage</div>
                          <div className="text-sm font-bold text-slate-900">
                            Not assessed
                          </div>
                          <div className="text-slate-500">
                            {triage.target.testPaths.length} test-like paths in captured files; no tests were run.
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                          <div className="text-slate-500">Enforcement Mode</div>
                          <div className="text-sm font-bold text-slate-900">{triage.policy.mode}</div>
                          <div className="text-slate-500">Advisory only; no action taken</div>
                        </div>
                      </div>
                    </div>

                    {/* PR Queue Overlap Comparisons */}
                    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">Captured PR comparisons</h2>
                        <p className="text-xs text-slate-500">
                          Shared file paths from saved snapshots in this repository. This is not a complete PR queue or a duplicate check.
                        </p>
                      </div>

                      {triage.comparisons.length === 0 ? (
                        <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-2">
                          <div className="text-sm font-semibold text-slate-900">No other captured PRs to compare</div>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            Capture another PR from this repository to compare file paths.
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
                                    {comp.matchPercentage}% file overlap{comp.incomplete ? ' (partial)' : ''}
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
                    <p className="text-xs text-slate-500">
                      Click any file row to expand its unified diff, inspect inline findings, and draft local line comments.
                    </p>
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

                {!patchPreview && snapshot && (
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-800">Unified diffs and inline commenting require patch preview</p>
                      <p className="text-slate-500 text-[11px]">Load public patch diffs to expand files, view Muse findings, and draft maintainer comments.</p>
                    </div>
                    <Link
                      href={`/repositories?snapshot=${encodeURIComponent(snapshot.id)}&preview=1`}
                      className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition"
                    >
                      Load Public Patch Preview
                    </Link>
                  </div>
                )}

                {patchPreviewError && (
                  <div role="alert" className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{patchPreviewError}</span>
                  </div>
                )}

                {patchPreview?.filesTruncated && (
                  <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                    GitHub returned only {patchPreview.files.length} of {patchPreview.changedFiles} changed files.
                  </p>
                )}

                <div className="space-y-3">
                  {filteredFiles.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                      No matching files found.
                    </div>
                  ) : (
                    filteredFiles.map((f) => {
                      const patchForFile = patchPreview?.files.find((pf) => pf.name === f.name);
                      const patchFile: PatchFile = {
                        name: f.name,
                        status: f.status || 'modified',
                        additions: f.additions,
                        deletions: f.deletions,
                        patch: patchForFile ? patchForFile.patch : null,
                      };

                      return (
                        <DiffViewer
                          key={f.name}
                          file={patchFile}
                          headSha={pull?.headSha || ''}
                          findings={review?.fileFindings || []}
                          drafts={drafts}
                          initiallyExpanded={false}
                          onSaveDraft={handleSaveDraft}
                          onDeleteDraft={handleDeleteDraft}
                          isSavingDraft={draftProcessing}
                        />
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB PANE: STRUCTURED REVIEW & DIFFS */}
            {activeTab === 'review' && (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-6">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-800" />
                        <span>Review & Inline Findings</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Diff-first code review. Inspect captured diffs, review advisory findings, and draft local line comments.
                      </p>
                    </div>

                    {review && (
                      <form onSubmit={handleClearReview}>
                        <button
                          type="submit"
                          disabled={clearReviewProcessing}
                          className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50"
                        >
                          Clear Review
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Honest Disclosure Alert */}
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-900">Advisory Review Only</p>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      Review suggestions are advisory. Individual comments can be posted manually to the configured test repository. External repository tests are not run here.
                    </p>
                  </div>
                </div>

                {reviewError && (
                  <div role="alert" className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{reviewError}</span>
                  </div>
                )}

                {/* Top Review Verdict Summary if available */}
                {review && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Recommendation:</span>
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                            review.recommendation === 'approve'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : review.recommendation === 'request_changes'
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : 'bg-sky-50 text-sky-800 border border-sky-200'
                          }`}
                        >
                          {review.recommendation.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500">Risk Assessment:</span>
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                            review.riskLevel === 'low'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : review.riskLevel === 'medium'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {review.riskLevel} risk
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2.5">
                      <h3 className="text-xs font-semibold text-slate-900 mb-0.5">Summary</h3>
                      <p className="text-xs text-slate-700 leading-relaxed">{review.summary}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                      <span>Tokens: {review.usage.prompt_tokens} in / {review.usage.completion_tokens} out</span>
                      <span>Reviewed: {new Date(review.reviewedAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Pre-review: Technical Request Disclosure & Maintainer Consent */}
                {!review && reviewPreview && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span>{reviewPreview.filesCount} diff {reviewPreview.filesCount === 1 ? 'file' : 'files'} included in review scope</span>
                      <span className="font-mono text-[11px]">~${(reviewPreview.estimatedMicros / 1000000).toFixed(4)} estimated reservation</span>
                    </div>

                    {/* Accessible Full Request Inspection Disclosure */}
                    <details className="border border-slate-200 rounded-lg p-3 bg-white space-y-3">
                      <summary className="cursor-pointer text-xs font-semibold text-slate-800 flex items-center justify-between">
                        <span>Inspect Complete Model Request Payload & Cryptographic Digest</span>
                        <span className="text-[11px] text-slate-500 font-normal">Click to expand</span>
                      </summary>
                      <div className="space-y-3 pt-3 text-xs border-t border-slate-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div><span className="text-slate-500">Destination:</span> <code className="font-mono text-slate-800">{reviewPreview.destination}</code></div>
                          <div><span className="text-slate-500">Model:</span> <code className="font-mono text-slate-800">{reviewPreview.body?.model || 'meta-models/muse-spark-open-1026'}</code></div>
                          <div className="col-span-2 flex items-center justify-between gap-2">
                            <span className="text-slate-500">Payload SHA-256 Digest:</span>
                            <button
                              type="button"
                              onClick={() => copyText(reviewPreview.digest, 'reviewDigest')}
                              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                            >
                              {copiedReviewDigest ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              <span className="text-[10px]">{copiedReviewDigest ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <p className="col-span-2 font-mono text-[11px] text-slate-700 break-all bg-slate-50 p-2 rounded border border-slate-200">
                            {reviewPreview.digest}
                          </p>
                        </div>

                        {reviewPreview.body && (
                          <div>
                            <span className="text-slate-500 text-[11px] font-medium">Exact Request Body (Sent to engine):</span>
                            <pre className="mt-1.5 p-3 rounded bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-80 whitespace-pre-wrap">
                              {JSON.stringify(reviewPreview.body, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </details>

                    {/* Explicit Consent Form & Honest Budget Status */}
                    <form onSubmit={handleReviewSubmit} className="p-4 rounded-lg border border-slate-200 bg-white space-y-3">
                      {isPrivate && (
                        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1.5">
                          <div className="flex items-center gap-2 font-semibold text-amber-900">
                            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Private Repository Review Unsupported</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-amber-900">
                            Private repository capture and model review is explicitly unsupported. Proprietary source code from <strong>{pull?.repository}</strong> will not be transmitted to external providers. Only public repositories and authorized test repositories may be reviewed.
                          </p>
                        </div>
                      )}

                      <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={reviewApproved}
                          onChange={(e) => {
                            setReviewApproved(e.target.checked);
                            setReviewFormData('confirm', e.target.checked);
                            setReviewFormData('digest', reviewPreview.digest);
                            setReviewFormData('approval_token', reviewPreview.approvalToken || '');
                          }}
                          className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span className="leading-relaxed">
                          I have inspected the complete request payload and SHA-256 digest above. I approve sending this untrusted diff to the review engine.
                        </span>
                      </label>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
                        <div className="text-xs">
                          {budget ? (
                            <span className={budget.canRequest ? 'text-slate-600' : 'text-rose-600 font-medium'}>
                              Budget: {budget.attempts} / {budget.limitAttempts} attempts used ({budget.canRequest ? `$${(budget.remainingMicros / 1000000).toFixed(4)} remaining` : 'Exhausted — live model requests disabled'})
                            </span>
                          ) : null}
                        </div>

                        <button
                          type="submit"
                          disabled={!reviewApproved || isPrivate || !budget?.canRequest || reviewProcessing}
                          className="px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        >
                          {isPrivate ? 'Review Unsupported (Private Repo)' : !budget?.canRequest ? 'Request Review (Budget Exhausted)' : reviewProcessing ? 'Requesting Review...' : 'Request Code Review'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Diff-First Layout: Files & Inline Findings */}
                {patchPreview && patchPreview.files ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Diffs & File Findings ({patchPreview.files.length} files)
                      </h3>
                      {drafts.length > 0 && (
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {drafts.length} saved local draft{drafts.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>

                    <div className="space-y-4">
                      {patchPreview.files.map((file) => {
                        const fileFromPull = files.find((f) => f.name === file.name);
                        const patchFile: PatchFile = {
                          name: file.name,
                          status: file.status,
                          additions: fileFromPull?.additions,
                          deletions: fileFromPull?.deletions,
                          patch: file.patch,
                        };

                        return (
                          <DiffViewer
                            key={file.name}
                            file={patchFile}
                            headSha={pull?.headSha || ''}
                            findings={review?.fileFindings || []}
                            drafts={drafts}
                            initiallyExpanded={true}
                            onSaveDraft={handleSaveDraft}
                            onDeleteDraft={handleDeleteDraft}
                            isSavingDraft={draftProcessing}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : !patchPreview ? (
                  <div className="p-8 text-center rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900">Public Patch Preview Required</h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        ProofPatcher needs to capture and verify the public patch diff locally before preparing the review payload.
                      </p>
                    </div>
                    {snapshot && (
                      <Link
                        href={`/repositories?snapshot=${encodeURIComponent(snapshot.id)}&preview=1`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition"
                      >
                        <span>Load Public Patch Preview</span>
                      </Link>
                    )}
                  </div>
                ) : null}

                {/* Local Saved Drafts & Review Decision Bar */}
                <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900">Maintainer Review Decision (Local Draft)</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Record a maintainer conclusion and draft comments for this pull request.
                      </p>
                    </div>
                    {drafts.length > 0 && (
                      <form onSubmit={handleClearAllDrafts}>
                        <button
                          type="submit"
                          disabled={clearDraftsProcessing}
                          className="text-[11px] font-medium text-rose-600 hover:text-rose-800 underline disabled:opacity-50"
                        >
                          Clear All Drafts ({drafts.length})
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Decision Radio Selector */}
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reviewDecision"
                        checked={reviewDecision === 'comment'}
                        onChange={() => setReviewDecision('comment')}
                        className="text-violet-700 focus:ring-violet-600"
                      />
                      <span>Comment</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reviewDecision"
                        checked={reviewDecision === 'approve'}
                        onChange={() => setReviewDecision('approve')}
                        className="text-violet-700 focus:ring-violet-600"
                      />
                      <span>Approve</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="reviewDecision"
                        checked={reviewDecision === 'request_changes'}
                        onChange={() => setReviewDecision('request_changes')}
                        className="text-violet-700 focus:ring-violet-600"
                      />
                      <span>Request Changes</span>
                    </label>
                  </div>

                  {commentPosted && <p role="status" className="text-xs text-emerald-700">Comment posted on GitHub.</p>}
                  {drafts.filter((draft) => commentApprovals[draft.id]).map((draft) => (
                    <div key={draft.id} className="rounded-lg border border-slate-200 p-3 space-y-2 text-xs">
                      <p className="font-semibold text-slate-800">{draft.path}:{draft.line} ({draft.side})</p>
                      <p className="whitespace-pre-wrap break-words text-slate-700">{draft.comment}</p>
                      <label className="flex items-center gap-2 text-slate-700">
                        <input type="checkbox" checked={commentToPost === commentApprovals[draft.id]}
                          onChange={(event) => setCommentToPost(event.target.checked ? commentApprovals[draft.id] : null)} />
                        <span>Post this comment to the configured test repository</span>
                      </label>
                      <button type="button" disabled={postingComment || commentToPost !== commentApprovals[draft.id]}
                        onClick={() => {
                          setPostingComment(true);
                          router.post('/repositories/review/comment', {
                            id: draft.id, digest: commentApprovals[draft.id], approved: true,
                          }, { onFinish: () => { setPostingComment(false); setCommentToPost(null); } });
                        }}
                        className="px-3 py-1.5 rounded-md bg-violet-700 text-white font-semibold disabled:opacity-40">
                        {postingComment && commentToPost === commentApprovals[draft.id] ? 'Posting…' : 'Post comment'}
                      </button>
                      <p className="text-slate-500">The PR can change between the final check and posting; check GitHub if the outcome is unclear.</p>
                    </div>
                  ))}

                  {/* Review decisions remain local. */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">Review decisions stay local</p>
                    <p className="text-[11px] leading-relaxed">
                      Approvals and change requests are not submitted to GitHub. Individual comments can be posted manually only to the configured test repository.
                    </p>
                  </div>

                  {/* Disabled Submission Button */}
                  <div>
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 text-xs font-medium rounded-md bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    >
                      Publish Review to GitHub (Not Implemented)
                    </button>
                  </div>
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
                    SHA-256 digest of this saved snapshot. It is not independently authenticated.
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
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Inspect Another Pull Request</h2>
                  <p className="text-xs text-slate-500">Enter a short handle or complete GitHub URL.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      required
                      placeholder="owner/repo#123 or https://github.com/owner/repo/pull/123"
                      value={data.url}
                      onChange={(e) => setData('url', e.target.value)}
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-violet-600 shadow-2xs"
                    />
                    <button
                      type="submit"
                      disabled={processing}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
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
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-6 max-w-xl mx-auto space-y-5">
            <div className="space-y-1.5 text-center">
              <div className="w-10 h-10 mx-auto rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Inspect Pull Request</h1>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Enter a GitHub pull request URL or short handle to capture changed files and check runs. The sample verifier is separate.
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
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-violet-600 shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={processing}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
                >
                  <span>{processing ? 'Loading...' : 'Inspect'}</span>
                </button>
              </div>
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-0.5">
                <span>Supports:</span>
                <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-200">owner/repo#123</code>
                <span className="text-slate-300">·</span>
                <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-200">github.com/owner/repo/pull/123</code>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
