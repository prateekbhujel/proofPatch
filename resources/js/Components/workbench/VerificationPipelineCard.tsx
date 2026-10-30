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

  return (
    <>
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
              onClick={onVerifyCandidate}
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

      {/* Draft PR Publication */}
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
                    onClick={onPublishDraftPr}
                    disabled={publishingPr}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition disabled:opacity-50"
                  >
                    <GitPullRequest className="w-3.5 h-3.5" />
                    <span>{publishingPr ? 'Publishing…' : 'Publish Draft PR to Dedicated Repo'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
    </>
  );
}
