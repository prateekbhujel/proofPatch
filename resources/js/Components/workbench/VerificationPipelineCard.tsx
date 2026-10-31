import React from 'react';
import {
  Shield,
  Check,
  CheckCircle2,
  XCircle,
  Copy,
  Bot,
  GitPullRequest,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { ThinkingAnimation } from '../ui/ThinkingAnimation';
import { VerificationPipeline } from '../ui/VerificationPipeline';
import {
  IssueContext,
  Suggestion,
  VerificationReport,
  GitHubConnectionData,
} from './types';

interface VerificationPipelineCardProps {
  context: IssueContext;
  suggestion: Suggestion | null;
  isOwnedFixture: boolean;
  isDedicatedTestRepo: boolean;
  verifying: boolean;
  verificationReport: VerificationReport | null;
  pipelineGates: Array<{ label: string; shortLabel: string; passed: boolean; detail: string }> | null;
  copiedReceipt: boolean;
  copyReceipt: (sha: string) => void;
  copiedBotComment: boolean;
  setCopiedBotComment: (b: boolean) => void;
  onVerifyCandidate: (e: React.MouseEvent) => void;
  githubConnection?: GitHubConnectionData | null;
  publishedPr: {
    prNumber?: number;
    prUrl: string;
    branch: string;
    commitSha: string;
    draft: boolean;
    repository: string;
    publishedAt: string;
    receiptSha256: string;
  } | null;
  publisherDisconnected: boolean;
  publishingPr: boolean;
  onPublishDraftPr: (e: React.MouseEvent) => void;
}

export function VerificationPipelineCard({
  context,
  suggestion,
  isOwnedFixture,
  isDedicatedTestRepo,
  verifying,
  verificationReport,
  pipelineGates,
  copiedReceipt,
  copyReceipt,
  copiedBotComment,
  setCopiedBotComment,
  onVerifyCandidate,
  githubConnection,
  publishedPr,
  publisherDisconnected,
  publishingPr,
  onPublishDraftPr,
}: VerificationPipelineCardProps) {
  const verifierThinkingSteps = [
    { label: 'Running checks', status: verifying ? ('active' as const) : ('waiting' as const) },
  ];
  const checkSummary = verificationReport
    ? `### ProofPatcher check summary\n- **Scope**: ${verificationReport.isSimulated !== false ? 'Local fixture run; isolated sandbox not verified' : 'Pinned fixture run; isolation not independently probed'}\n- **Target**: \`${context.path}\` (${context.repository}#${context.issueNumber})\n- **Result**: ${verificationReport.decision}\n- **Receipt SHA-256**: \`${verificationReport.receipt?.sha256 ?? 'unavailable'}\`\n- **Candidate SHA-256**: \`${verificationReport.candidateSha256}\``
    : '';

  return (
    <>
      {suggestion && (isOwnedFixture || isDedicatedTestRepo) && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#141821] p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-violet-700 dark:text-violet-400" />
                <span>Check this change</span>
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Run the fixture checks before creating a draft PR.
              </p>
            </div>
            <button
              type="button"
              onClick={onVerifyCandidate}
              disabled={verifying}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition disabled:opacity-50 shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {verifying
                  ? 'Running checks…'
                  : verificationReport
                  ? 'Run checks again'
                  : 'Run checks'}
              </span>
            </button>
          </div>

          <ThinkingAnimation
            isActive={verifying}
            steps={verifierThinkingSteps}
            title="Running checks"
            subtitle="Checking the original and proposed change…"
          />

          {verificationReport && (
            <div className="space-y-3.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <VerificationPipeline
                isRunning={verifying}
                gates={pipelineGates}
                decision={verificationReport.decision}
                isSimulated={verificationReport.isSimulated}
              />

              <details className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
                <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                  Receipt and sharing
                </summary>

              {/* Cryptographic Receipt Bar */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3.5 space-y-2 mt-3">
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
                    {verificationReport.receipt?.externallyAnchored ? 'Externally anchored' : 'Local receipt'}
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
                <div className="rounded-xl border border-violet-200 dark:border-violet-800/80 bg-violet-50/35 dark:bg-violet-950/20 p-3.5 space-y-2 text-xs mt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                      <Bot className="w-3.5 h-3.5 text-violet-700 dark:text-violet-400" />
                      <span>Check summary</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Not posted to GitHub</span>
                  </div>
                  <pre className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{checkSummary}</pre>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-slate-500">
                      Copy this summary to share it yourself.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(checkSummary);
                        setCopiedBotComment(true);
                        setTimeout(() => setCopiedBotComment(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-700 hover:bg-violet-800 text-white font-semibold text-[11px] transition"
                    >
                      {copiedBotComment ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedBotComment ? 'Copied' : 'Copy summary'}</span>
                    </button>
                  </div>
                </div>
              )}
              </details>
            </div>
          )}
        </div>
      )}

      {/* Draft PR Publication */}
      {verificationReport?.decision === 'VERIFIED' &&
        verificationReport.isSimulated === false &&
        isDedicatedTestRepo && (
          <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  Create a draft PR
                </h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                Draft · no auto-merge
              </span>
            </div>

            {publishedPr ? (
              <div className="rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 p-3.5 space-y-1.5 text-xs">
                <div className="font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Draft PR #{publishedPr.prNumber} created on GitHub</span>
                </div>
                <a
                  href={publishedPr.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:underline pt-1"
                >
                  <span>Open on GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Create a draft in the dedicated test repository for review. It will not be merged.
                </p>
                {publisherDisconnected ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-amber-800 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Publishing unavailable</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onPublishDraftPr}
                    disabled={publishingPr}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition disabled:opacity-50"
                  >
                    <GitPullRequest className="w-3.5 h-3.5" />
                    <span>{publishingPr ? 'Creating draft…' : 'Create draft PR'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
    </>
  );
}
