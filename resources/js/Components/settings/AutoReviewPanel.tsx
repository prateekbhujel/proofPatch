import React from 'react';
import { GitHubRepo, SettingsProps } from './types';

interface Props {
  connected: boolean;
  repositories: GitHubRepo[];
  autoReview: SettingsProps['autoReview'];
  pendingRepo: string | null;
  error: string | null;
  onToggle: (repository: string, enabled: boolean) => void;
  onRefresh: () => void;
}

export function AutoReviewPanel({ connected, repositories, autoReview, pendingRepo, error, onToggle, onRefresh }: Props) {
  const settings = autoReview?.settings || {};

  return (
    <section className="bg-white dark:bg-[#141821] rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs" aria-labelledby="auto-review-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="auto-review-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">Automatic reviews</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Muse reviews open and updated public pull requests while the local worker is running.</p>
        </div>
        {autoReview && (
          <button type="button" onClick={onRefresh} className="text-xs text-violet-700 dark:text-violet-300 hover:underline" aria-label="Refresh worker status">
            {autoReview.worker.isLive ? 'Worker running' : 'Worker offline'} · Refresh
          </button>
        )}
      </div>

      {!autoReview ? (
        <p className="text-xs text-slate-500">Automatic actions are not active yet. Open a pull request to review it manually.</p>
      ) : !connected ? (
        <p className="text-xs text-slate-500">Connect GitHub to choose repositories.</p>
      ) : repositories.length === 0 ? (
        <p className="text-xs text-slate-500">No repositories are available to this GitHub connection.</p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
          {repositories.map((repo) => {
            const saved = Object.values(settings).find((item) => item.repository.toLowerCase() === repo.fullName.toLowerCase());
            const enabled = !repo.isPrivate && saved?.enabled === true;
            return (
              <div key={repo.fullName} className="flex items-center justify-between gap-3 px-3 py-3 text-xs">
                <div className="min-w-0">
                  <div className="break-all font-medium text-slate-900 dark:text-slate-100">{repo.fullName}</div>
                  {repo.isPrivate && <div className="mt-1 text-slate-500">Private repositories are not sent to Muse.</div>}
                </div>
                <label className="flex shrink-0 items-center gap-2 text-slate-700 dark:text-slate-300">
                  <span>{repo.isPrivate ? 'Off (Private)' : enabled ? 'On' : 'Off'}</span>
                  <input type="checkbox" aria-label={`Automatic review for ${repo.fullName}`} checked={enabled}
                    disabled={pendingRepo !== null || repo.isPrivate}
                    onChange={(event) => onToggle(repo.fullName, event.currentTarget.checked)}
                    className="accent-violet-600 disabled:opacity-50" />
                </label>
              </div>
            );
          })}
        </div>
      )}

      {autoReview && (
        <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <p>Reviews use credits and appear in ProofPatcher. They are not posted to GitHub automatically.</p>
          {!autoReview.worker.isLive && <p>Start the local worker: <code className="select-all">php artisan review:poll --daemon</code></p>}
        </div>
      )}
      {error && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    </section>
  );
}
