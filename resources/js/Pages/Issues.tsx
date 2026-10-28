import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

interface IssueContext {
  repository: string;
  issueNumber: number;
  issueUrl: string;
  title: string;
  body: string;
  commit: string;
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
  commit: string;
  find: string;
  replace: string;
  explanation: string;
  model: string;
  candidate?: CandidatePreview;
}

interface Props {
  context: IssueContext | null;
  preview: Preview | null;
  suggestion: Suggestion | null;
  budget: { canRequest: boolean; attempts: number; maxAttempts: number } | null;
  error: string | null;
}

export default function Issues({ context, preview, suggestion, budget, error }: Props) {
  const capture = useForm({ issue_url: '', path: '' });
  const [approved, setApproved] = useState(false);
  const [sending, setSending] = useState(false);

  function captureIssue(event: React.FormEvent) {
    event.preventDefault();
    setApproved(false);
    capture.post('/issues/preview');
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

  return (
    <AppLayout activeNav="issues">
      <Head title="Issues" />
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Issue Suggestion</h1>
          <p className="mt-1 text-xs text-slate-500">
            Preview one public GitHub issue and target repository file before asking Muse for an in-memory candidate.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Step 1: Issue & File Capture Form */}
        <form onSubmit={captureIssue} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Capture Issue & Target File</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Read-only inspection. No external model calls are made during preview.
            </p>
          </div>

          <div className="space-y-3">
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
                Repository File Path
              </label>
              <input
                id="source-path"
                required
                placeholder="public/fixtures/checkout.html"
                value={capture.data.path}
                onChange={(e) => capture.setData('path', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={capture.processing}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
          >
            <span>{capture.processing ? 'Capturing…' : 'Preview request'}</span>
          </button>
        </form>

        {/* Step 2: Review Before Sending */}
        {context && preview && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">Review Request Payload</h2>
              <p className="mt-0.5 text-xs text-slate-600">
                {context.repository} #{context.issueNumber} · {context.path}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>Commit: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700 border border-slate-200">{context.commit.slice(0, 8)}</code></span>
                <span>·</span>
                <span>File SHA-256: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700 border border-slate-200">{context.sourceSha256.slice(0, 16)}…</code></span>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <div>Destination: <span className="break-all font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 border border-slate-200">{preview.destination}</span></div>
              <p className="text-slate-500">The public issue and selected file will only be sent after your explicit consent.</p>
            </div>

            <div className="space-y-2 text-xs">
              <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                <summary className="cursor-pointer font-medium text-slate-900">Issue: {context.title}</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 font-mono bg-white p-3 rounded border border-slate-200">
                  {context.body || '(No description)'}
                </pre>
              </details>

              <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                <summary className="cursor-pointer font-medium text-slate-900">Selected file: {context.path}</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre text-xs text-slate-700 font-mono bg-white p-3 rounded border border-slate-200">
                  {context.source}
                </pre>
              </details>

              <details className="rounded-md border border-slate-200 p-3 bg-slate-50/50">
                <summary className="cursor-pointer font-medium text-slate-900">Complete JSON request payload</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700 font-mono bg-white p-3 rounded border border-slate-200">
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
                <span>I reviewed this exact request payload and approve sending it to Baseten.</span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={!approved || !budget?.canRequest || sending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
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
                Estimated local reservation: ${(preview.estimatedMicros / 1000000).toFixed(4)}. This is not an account-wide billing limit. The suggestion is not applied or tested.
              </p>
            </form>
          </section>
        )}

        {/* Step 3: Unverified Suggestion Output */}
        {suggestion && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Unverified Model Suggestion</h2>
                <p className="text-xs text-slate-500">
                  {suggestion.path} · commit {suggestion.commit.slice(0, 8)} · {suggestion.model}
                </p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                Unverified
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
                  In-Memory Candidate Preview (Unverified)
                </summary>
                <div className="mt-2.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono">
                    <span>SHA-256: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-800">{suggestion.candidate.sha256}</code></span>
                    <span>·</span>
                    <span>Status: {suggestion.candidate.status}</span>
                    <span>·</span>
                    <span>Applied: No</span>
                    <span>·</span>
                    <span>Verified: No</span>
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre rounded-md bg-white p-3 text-xs font-mono text-slate-800 border border-slate-200">
                    {suggestion.candidate.source}
                  </pre>
                </div>
              </details>
            )}

            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <p className="text-amber-800">
                Tests not run. This candidate preview was generated in-memory only and was not applied or posted to GitHub.
              </p>
              <Link
                href="/checks"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 transition whitespace-nowrap self-start sm:self-center"
              >
                <span>Verify in Checks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
