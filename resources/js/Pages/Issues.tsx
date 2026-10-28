import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { ArrowRight, Sparkles, Shield, AlertTriangle, CheckCircle2, MessageSquare, FileCode, Check } from 'lucide-react';

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

interface Props {
  context: IssueContext | null;
  preview: Preview | null;
  suggestion: Suggestion | null;
  draft?: Draft | null;
  isOwnedFixture?: boolean;
  budget: { canRequest: boolean; attempts: number; maxAttempts: number } | null;
  error: string | null;
}

export default function Issues({ context, preview, suggestion, draft, isOwnedFixture, budget, error }: Props) {
  const capture = useForm({ issue_url: '', path: '' });
  const draftForm = useForm({ comment: draft?.comment || '' });
  const [approved, setApproved] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingOwned, setLoadingOwned] = useState(false);

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
                    <span>Verified: No</span>
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre rounded-md bg-white p-3 text-xs font-mono text-slate-800 border border-slate-200">
                    {suggestion.candidate.source}
                  </pre>
                </div>
              </details>
            )}

            {/* Step 4: Safety Boundary & Sandbox Disclosures */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Execution Safety Boundary</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                Host execution of untrusted PHP candidates is disabled: temporary directories and git worktrees are NOT security sandboxes.
                ProofPatch never executes arbitrary replacement code on the host system without an isolated container or microVM boundary.
              </p>
              {suggestion.path.endsWith('.css') || suggestion.path.includes('checkout') ? (
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-slate-600">Bundled CSS fixture verification is available via browser layout probe:</span>
                  <Link
                    href="/checks"
                    className="inline-flex items-center gap-1 font-medium text-violet-700 hover:text-violet-800 underline"
                  >
                    <span>Run CheckoutVerifier</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : null}
            </div>

            {/* Step 5: Review & Audit Policy */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>4. Local Review Draft & Audit Trail</span>
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
