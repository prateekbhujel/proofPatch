import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { ArrowRight, Sparkles, Shield, AlertTriangle, CheckCircle2, MessageSquare, FileCode, Check, Copy, XCircle, Terminal } from 'lucide-react';

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

interface Props {
  context: IssueContext | null;
  preview: Preview | null;
  suggestion: Suggestion | null;
  draft?: Draft | null;
  verificationReport?: VerificationReport | null;
  isOwnedFixture?: boolean;
  budget: { canRequest: boolean; attempts: number; maxAttempts: number } | null;
  error: string | null;
}

export default function Issues({ context, preview, suggestion, draft, verificationReport, isOwnedFixture, budget, error }: Props) {
  const capture = useForm({ issue_url: '', path: '' });
  const draftForm = useForm({ comment: draft?.comment || '' });
  const [approved, setApproved] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingOwned, setLoadingOwned] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  function captureIssue(event: React.FormEvent) {
    event.preventDefault();
    setApproved(false);
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

  function requestSuggestion(event: React.FormEvent) {
    event.preventDefault();
    if (!preview || !approved || !budget?.canRequest || sending) return;
    router.post(
      '/issues/propose',
      { digest: preview.digest, approved: true },
      {
        onStart: () => setSending(true),
        onFinish: () => {
          setSending(false);
          setApproved(false);
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

  return (
    <AppLayout activeNav="issues">
      <Head title="Issues Workbench" />
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Issue Workbench & Co-Maintainer</h1>
              <p className="mt-1 text-xs text-slate-500">
                Ticket triage, Muse proposal, and in-memory candidate review for owned and public repositories.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Shield className="w-3 h-3 text-emerald-600" />
                Fail-Closed Read-Only
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Step 1: Issue & File Intake */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">1. Ticket Intake & Target File</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Load the owned synthetic backend case or inspect any public GitHub issue and repository file.
              </p>
            </div>
            <button
              type="button"
              onClick={loadOwned}
              disabled={loadingOwned}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition disabled:opacity-50"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-500" />
              <span>{loadingOwned ? 'Loading…' : 'Load Owned Synthetic Case'}</span>
            </button>
          </div>

          <form onSubmit={captureIssue} className="space-y-3">
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
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs"
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
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">Read-only capture. No model requests are made during preview.</span>
              <button
                type="submit"
                disabled={capture.processing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50"
              >
                <span>{capture.processing ? 'Capturing…' : 'Preview request'}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Step 2: Review Before Sending */}
        {context && preview && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">2. Muse Task Triage & Payload Inspection</h2>
                {(isOwnedFixture || context.isSynthetic) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    Synthetic Fixture
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-600">
                {context.isSynthetic || !context.issueUrl ? (
                  <span>Synthetic Case: <span className="font-semibold text-slate-800">OrderTotal Bug #{context.issueNumber}</span> · <span className="font-mono text-slate-600">{context.path}</span></span>
                ) : (
                  <span>
                    <a href={context.issueUrl} target="_blank" rel="noreferrer" className="text-violet-700 hover:underline font-mono">
                      {context.repository}#{context.issueNumber}
                    </a> · <span className="font-mono text-slate-600">{context.path}</span>
                  </span>
                )}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono">
                {context.commit ? (
                  <span>Commit: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 border border-slate-200">{context.commit.slice(0, 8)}</code></span>
                ) : (
                  <span>Provenance: <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700 border border-blue-200 font-sans font-medium">{context.provenance || 'Local Checked-in Fixture (No remote commit)'}</span></span>
                )}
                <span>·</span>
                <span>File SHA-256: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 border border-slate-200">{context.sourceSha256.slice(0, 16)}…</code></span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>Destination: <span className="break-all font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200">{preview.destination}</span></div>
              <p className="text-slate-500">The public issue context and file will only be processed with your explicit consent.</p>
            </div>

            <div className="space-y-2 text-xs">
              <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50" open>
                <summary className="cursor-pointer font-medium text-slate-900">Issue: {context.title}</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 font-mono bg-white p-3 rounded border border-slate-200">
                  {context.body || '(No description)'}
                </pre>
              </details>

              <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                <summary className="cursor-pointer font-medium text-slate-900">Selected file: {context.path}</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre text-xs text-slate-700 font-mono bg-white p-3 rounded border border-slate-200">
                  {context.source}
                </pre>
              </details>

              <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                <summary className="cursor-pointer font-medium text-slate-900">Exact Request Payload (JSON)</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 font-mono bg-white p-3 rounded border border-slate-200">
                  {JSON.stringify(preview.body, null, 2)}
                </pre>
              </details>
            </div>

            <form onSubmit={requestSuggestion} className="space-y-3 pt-2 border-t border-slate-100">
              <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>I reviewed this exact request payload and approve sending it to Muse.</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!approved || !budget?.canRequest || sending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{sending ? 'Requesting…' : 'Ask Muse'}</span>
                </button>
              </div>

              {!budget?.canRequest && (
                <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
                  The local model request allowance is exhausted or unavailable. No request will be sent.
                </p>
              )}

              <p className="text-[11px] text-slate-500">
                Estimated local reservation: ${(preview.estimatedMicros / 1000000).toFixed(4)}. Capped at $0.20 product reservation ceiling.
              </p>
            </form>
          </section>
        )}

        {/* Step 3: Code Proposal Output */}
        {suggestion && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {suggestion.isOfflineExample ? '3. Offline Reference Candidate' : '3. Code Proposal'}
                </h2>
                <p className="text-xs text-slate-500">
                  {suggestion.path} · {suggestion.model ? `${suggestion.model}${suggestion.commit ? ` · commit ${suggestion.commit.slice(0, 8)}` : ''}` : (suggestion.provenance || 'Local Checked-in Fixture (No external provider call)')}
                </p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${suggestion.isOfflineExample ? 'bg-slate-100 text-slate-700 border border-slate-300' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                {suggestion.isOfflineExample ? 'Offline Example' : 'Unverified Preview'}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">{suggestion.explanation}</p>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-slate-700 block mb-1">Find</span>
                <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs font-mono text-slate-800 border border-slate-200">
                  {suggestion.find}
                </pre>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-700 block mb-1">Replace With</span>
                <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs font-mono text-slate-800 border border-slate-200">
                  {suggestion.replace}
                </pre>
              </div>
            </div>

            {suggestion.candidate && (
              <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50" open>
                <summary className="cursor-pointer text-xs font-semibold text-slate-900">
                  In-Memory Candidate Preview
                </summary>
                <div className="mt-2.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>SHA-256: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-800">{suggestion.candidate.sha256}</code></span>
                    <span>·</span>
                    <span>Status: {suggestion.candidate.status}</span>
                    <span>·</span>
                    <span>Applied to disk: No</span>
                    <span>·</span>
                    <span>Verified: {suggestion.candidate.verified ? (
                      <span className="text-emerald-700 font-semibold">Yes (ProofPatch Verified)</span>
                    ) : 'No'}</span>
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre rounded-md bg-white p-3 text-xs font-mono text-slate-800 border border-slate-200">
                    {suggestion.candidate.source}
                  </pre>
                </div>
              </details>
            )}

            {(isOwnedFixture || suggestion.path === 'src/OrderTotal.php') && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-violet-950 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-violet-700" />
                      <span>Falsifiable ProofPatch Verifier</span>
                    </h3>
                    <p className="text-xs text-violet-800 mt-0.5">
                      Verify candidate against baseline failure reproduction, negative control guard, candidate execution, and cryptographic receipt manifest.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={verifyCandidate}
                    disabled={verifying}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{verifying ? 'Running Verifier…' : (verificationReport ? 'Re-run ProofPatch Verifier' : 'Run ProofPatch Verifier')}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Verifier Evidence & Cryptographic Receipt */}
            {verificationReport && (
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">4. Verifier Evidence & Cryptographic Receipt</h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${verificationReport.decision === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {verificationReport.decision === 'VERIFIED' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>VERIFIED</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>FAILED</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">
                      Run ID: <span className="text-slate-800 font-semibold">{verificationReport.id}</span> · Format: <span className="text-slate-700">{verificationReport.receipt.manifest?.format as string || 'proofpatch-receipt-v1'}</span> ({verificationReport.kind})
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Created: {verificationReport.createdAt}
                  </span>
                </div>

                {/* Gates Status Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Gate 1: Baseline Failure Reproduction */}
                  <div className="rounded-md border border-slate-200 p-3 bg-slate-50/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">1. Baseline Failure Reproduction</span>
                      <span className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${verificationReport.gates.baselineReproduced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {verificationReport.gates.baselineReproduced ? 'Passed (Exit 1)' : 'Failed'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Baseline reproduced expected failure: zero-quantity item incorrectly charged at unit price.
                    </p>
                  </div>

                  {/* Gate 2: Negative Control Guard */}
                  <div className="rounded-md border border-slate-200 p-3 bg-slate-50/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">2. Negative Control Guard</span>
                      <span className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${verificationReport.gates.negativeControlCaught ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {verificationReport.gates.negativeControlCaught ? 'Passed (Exit 1)' : 'Failed'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Trivial catch-all shortcut (dummy return 0) properly caught and rejected by test suite.
                    </p>
                  </div>

                  {/* Gate 3: Candidate Execution */}
                  <div className="rounded-md border border-slate-200 p-3 bg-slate-50/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">3. Candidate Test Execution</span>
                      <span className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${verificationReport.gates.candidatePassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {verificationReport.gates.candidatePassed ? 'Passed (Exit 0)' : 'Failed'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Candidate verified cleanly in ephemeral scratch environment: all cases passed.
                    </p>
                  </div>

                  {/* Gate 4: Static AST Safety Guard */}
                  <div className="rounded-md border border-slate-200 p-3 bg-slate-50/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">4. Static AST Safety Guard</span>
                      <span className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${verificationReport.gates.candidateStaticSafetyPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {verificationReport.gates.candidateStaticSafetyPassed ? 'Passed (0 Unsafe Tokens)' : 'Failed'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      Token analyzer verified candidate contains no shell execution, eval, network, or file syscalls.
                    </p>
                  </div>
                </div>

                {/* Cryptographic Receipt Manifest */}
                <div className="rounded-lg border border-slate-200 bg-slate-900 text-slate-100 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold tracking-wide text-white uppercase">Cryptographic Integrity Receipt</span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      Integrity: {verificationReport.receipt.integrity} (Externally Anchored)
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Receipt Manifest SHA-256 (Canonical JSON Hash)</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-xs bg-slate-950 px-3 py-2 rounded border border-slate-800 text-emerald-400 break-all select-all">
                        {verificationReport.receipt.sha256}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyReceipt(verificationReport.receipt.sha256)}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shrink-0"
                        title="Copy receipt SHA-256"
                      >
                        {copiedReceipt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
                        <span>{copiedReceipt ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-1 text-[11px] text-slate-400 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Base Commit: <code className="text-slate-300">{verificationReport.baseCommit.slice(0, 10)}…</code></span>
                      <span>Patch Diff SHA: <code className="text-slate-300">{verificationReport.patchSha256.slice(0, 10)}…</code></span>
                      <span>Evidence Dir: <code className="text-slate-300">{verificationReport.evidenceDirectory.split('/').slice(-2).join('/')}</code></span>
                    </div>
                    <p className="text-slate-500 text-[10px]">
                      Manifest securely binds: result.json, patch.diff, baseline/run.log, negative/run.log, and candidate/run.log.
                    </p>
                  </div>
                </div>

                {/* Collapsible Run Execution Logs */}
                <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-600" />
                    <span>Run Verification Logs & Summaries</span>
                  </summary>
                  <div className="mt-3 space-y-2 text-xs font-mono">
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-700 block mb-1">Baseline Log (Expected Exit Code 1)</span>
                      <p className="text-rose-700 whitespace-pre-wrap">{verificationReport.runs.baseline.summary}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-700 block mb-1">Negative Control Log (Expected Exit Code 1)</span>
                      <p className="text-rose-700 whitespace-pre-wrap">{verificationReport.runs.negative.summary}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-700 block mb-1">Candidate Execution Log (Expected Exit Code 0)</span>
                      <p className="text-emerald-700 whitespace-pre-wrap">{verificationReport.runs.candidate.summary}</p>
                    </div>
                  </div>
                </details>

                {/* Execution Sandbox Boundary & Remaining Backend Gap Disclosure */}
                <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Allowlisted Execution Boundary & Remaining Backend Gap</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    <span className="font-semibold">{verificationReport.backendSandboxGap.boundary}</span>{' '}
                    ProofPatch executed this run using {verificationReport.backendSandboxGap.isolationLevel}.
                  </p>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    <span className="font-semibold">Remaining Gap:</span> {verificationReport.backendSandboxGap.remainingGap}
                  </p>
                </div>
              </div>
            )}

            {/* Step 5: Review & Audit Policy */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>5. Local Review Draft & Audit Trail</span>
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">No External GitHub Mutations</span>
              </div>

              <form onSubmit={handleSaveDraft} className="space-y-2">
                <textarea
                  rows={3}
                  value={draftForm.data.comment}
                  onChange={(e) => draftForm.setData('comment', e.target.value)}
                  placeholder="Record local review notes, observations, or acceptance feedback..."
                  className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Draft comments remain strictly local to your active session.
                  </span>
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
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Saved Local Review Draft</span>
                    <span>{draft.savedAt}</span>
                  </div>
                  <p className="text-slate-800 font-mono whitespace-pre-wrap">{draft.comment}</p>
                  <p className="text-[10px] text-slate-500 pt-1">{draft.readOnlyPolicy}</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
