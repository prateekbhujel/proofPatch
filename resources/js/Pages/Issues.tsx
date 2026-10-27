import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';

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

interface Suggestion {
  path: string;
  commit: string;
  find: string;
  replace: string;
  explanation: string;
  model: string;
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
    router.post('/issues/propose', { digest: preview.digest, approved: true }, {
      onStart: () => setSending(true),
      onFinish: () => { setSending(false); setApproved(false); },
    });
  }

  return (
    <AppLayout activeNav="issues">
      <Head title="Issues" />
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Work on an issue</h1>
          <p className="mt-2 text-sm text-slate-600">Preview one public GitHub issue and one file before asking Muse for a suggestion.</p>
        </div>
        {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>}
        <form onSubmit={captureIssue} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <label htmlFor="issue-url" className="block text-sm font-medium text-slate-800">Public issue URL</label>
            <input id="issue-url" type="url" required placeholder="https://github.com/owner/repo/issues/123"
              value={capture.data.issue_url} onChange={(e) => capture.setData('issue_url', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="source-path" className="block text-sm font-medium text-slate-800">File path in the repository</label>
            <input id="source-path" required placeholder="src/example.php"
              value={capture.data.path} onChange={(e) => capture.setData('path', e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={capture.processing} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {capture.processing ? 'Loading…' : 'Preview request'}
          </button>
        </form>

        {context && preview && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Review before sending</h2>
              <p className="mt-1 text-sm text-slate-600">{context.repository} #{context.issueNumber} · {context.path}</p>
              <p className="mt-1 break-all text-xs text-slate-500">Commit {context.commit} · File SHA-256 {context.sourceSha256}</p>
            </div>
            <p className="text-sm text-slate-700">Destination: <span className="break-all font-mono text-xs">{preview.destination}</span></p>
            <p className="text-sm text-slate-600">The public issue and selected file may be sent only after your approval.</p>
            <details className="rounded border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-medium">Issue: {context.title}</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">{context.body || '(No description)'}</pre>
            </details>
            <details className="rounded border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-medium">Selected file: {context.path}</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre text-xs text-slate-700">{context.source}</pre>
            </details>
            <details className="rounded border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-medium">Complete request sent to Baseten</summary>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">{JSON.stringify(preview.body, null, 2)}</pre>
            </details>
            <form onSubmit={requestSuggestion} className="space-y-3">
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} className="mt-1" />
                <span>I reviewed this exact request and approve sending it to Baseten.</span>
              </label>
              <button type="submit" disabled={!approved || !budget?.canRequest || sending}
                className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {sending ? 'Requesting…' : 'Ask Muse'}
              </button>
              {!budget?.canRequest && <p className="text-sm text-amber-800">The local model request allowance is exhausted or unavailable. No request will be sent.</p>}
              <p className="text-xs text-slate-500">Estimated local reservation: ${(preview.estimatedMicros / 1000000).toFixed(4)}. This is not an account-wide billing limit. The suggestion is not applied or tested.</p>
            </form>
          </section>
        )}

        {suggestion && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">Unverified suggestion</h2>
            <p className="text-sm text-slate-600">{suggestion.path} · commit {suggestion.commit} · {suggestion.model}</p>
            <p className="text-sm text-slate-700">{suggestion.explanation}</p>
            <div><h3 className="text-sm font-medium">Find</h3><pre className="mt-1 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{suggestion.find}</pre></div>
            <div><h3 className="text-sm font-medium">Replace with</h3><pre className="mt-1 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{suggestion.replace}</pre></div>
            <p className="text-sm text-amber-800">Tests not run. Nothing was applied or posted to GitHub.</p>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
