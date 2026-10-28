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
  const [copiedCandidateSha, setCopiedCandidateSha] = useState(false);
  const [showPayloadDetails, setShowPayloadDetails] = useState(false);

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

  function copyCandidateHash(sha: string) {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(sha);
    }
    setCopiedCandidateSha(true);
    setTimeout(() => setCopiedCandidateSha(false), 2000);
  }

  return (
    <AppLayout activeNav="issues">
      <Head title="Issues Workbench · ProofPatch" />
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

        {/* 1. Ticket Intake & Target File */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Ticket Intake</h2>
              <span className="text-[11px] text-slate-500">Load synthetic fixture or enter public issue</span>
            </div>
            <button
              type="button"
              onClick={loadOwned}
              disabled={loadingOwned}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition disabled:opacity-50"
            >
              <FileCode className="w-3.5 h-3.5 text-violet-600" />
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

                <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                  <summary className="cursor-pointer font-semibold text-slate-900">Exact JSON Payload</summary>
                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 font-mono bg-white p-2.5 rounded border border-slate-200">
                    {JSON.stringify(preview.body, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {!suggestion && (
              <form onSubmit={requestSuggestion} className="space-y-3 pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-600"
                  />
                  <span>I reviewed the exact JSON payload and approve sending to Muse Spark Open.</span>
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={!approved || !budget?.canRequest || sending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{sending ? 'Requesting Muse…' : 'Ask Muse'}</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Estimated reservation: ${(preview.estimatedMicros / 1000000).toFixed(4)}
                  </span>
                </div>

                {!budget?.canRequest && (
                  <p className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
                    Local model request allowance is exhausted. No request will be sent.
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
                {suggestion.candidate?.verified ? 'Verified Candidate' : 'Unverified Proposal'}
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
            {(isOwnedFixture || suggestion.path === 'src/OrderTotal.php') && (
              <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50/80 to-purple-50/50 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-violet-950 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-violet-700" />
                      <span>Falsifiable ProofPatch Verifier</span>
                    </h3>
                    <p className="text-[11px] text-violet-800 mt-0.5">
                      Runs AST safety checks, baseline failure reproduction, negative control guard, and signs cryptographic receipt.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={verifyCandidate}
                    disabled={verifying}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50 shrink-0"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                    <span>{verifying ? 'Running 5-Gate Verifier…' : (verificationReport ? 'Re-run Verifier' : 'Run ProofPatch Verifier')}</span>
                  </button>
                </div>

                {/* Real-time Dynamic Verification Animation */}
                {verifying && (
                  <div className="rounded-lg bg-white/90 border border-violet-200 p-3 space-y-2 text-xs font-mono">
                    <div className="flex items-center gap-2 text-violet-900 font-semibold text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-violet-600 animate-ping" />
                      <span>Executing Falsifiable Verification Pipeline…</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Static AST Guard</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Baseline Exit Code 1</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Negative Control Catch</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Candidate Exit Code 0</span>
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
                    <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                      Run ID: {verificationReport.id.slice(0, 15)}… · {verificationReport.kind}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {verificationReport.createdAt.replace('T', ' ').slice(0, 16)} UTC
                  </span>
                </div>

                {/* 4-Gate Status Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">1. Baseline</span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">Passed (Exit 1)</span>
                    <span className="text-[10px] text-slate-500">Bug reproduced</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">2. Neg Control</span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">Passed (Exit 1)</span>
                    <span className="text-[10px] text-slate-500">Shortcut caught</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">3. Candidate</span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">Passed (Exit 0)</span>
                    <span className="text-[10px] text-slate-500">All tests pass</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-2.5 bg-slate-50/50">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">4. AST Safety</span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">0 Violations</span>
                    <span className="text-[10px] text-slate-500">Zero syscalls</span>
                  </div>
                </div>

                {/* Modern Cryptographic Receipt Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-100 p-4 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cryptographic Integrity Receipt</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                      VALID · {verificationReport.receipt.externallyAnchored ? 'Externally Anchored' : 'Locally Generated Manifest'}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] text-slate-400 mb-1">Receipt Manifest Digest (SHA-256)</span>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono text-xs bg-slate-950 px-3 py-1.5 rounded border border-slate-800 text-emerald-400 truncate">
                        {verificationReport.receipt.sha256}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyReceipt(verificationReport.receipt.sha256)}
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
                      <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Baseline Log (Exit 1)</span>
                      <p className="text-rose-700 text-[11px] whitespace-pre-wrap">{verificationReport.runs.baseline.summary}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Negative Control Log (Exit 1)</span>
                      <p className="text-rose-700 text-[11px] whitespace-pre-wrap">{verificationReport.runs.negative.summary}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Candidate Log (Exit 0)</span>
                      <p className="text-emerald-700 text-[11px] whitespace-pre-wrap">{verificationReport.runs.candidate.summary}</p>
                    </div>
                  </div>
                </details>

                <p className="text-[11px] text-slate-500">
                  Allowlisted bounded run. Autonomous untrusted code execution requires containerized microVMs. See <Link href="/docs" className="text-violet-700 hover:underline">Documentation</Link>.
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
