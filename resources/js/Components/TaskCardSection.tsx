import React, { useEffect, useState } from 'react';
import { Link, useForm } from '@inertiajs/react';
import {
  ListPlus,
  Clock,
  FolderGit2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export interface LocalTaskCard {
  id: string | number;
  title: string;
  description: string;
  repository: string;
  status: string;
  updatedAt: string | null;
}

export interface GitHubRepoOption {
  fullName: string;
  isPrivate?: boolean;
}

export interface TaskCardSectionProps {
  localTasks?: LocalTaskCard[];
  githubConnection?: {
    isConnected?: boolean;
    repositories?: GitHubRepoOption[];
    selectedRepo?: string | null;
  } | null;
}

export function TaskCardSection({
  localTasks = [],
  githubConnection = null,
}: TaskCardSectionProps) {
  const allowedRepositories = githubConnection?.repositories || [];
  const hasGrantedRepos = allowedRepositories.length > 0;
  const defaultRepo =
    githubConnection?.selectedRepo ||
    (hasGrantedRepos ? allowedRepositories[0].fullName : '');

  const [isFormOpen, setIsFormOpen] = useState(localTasks.length === 0);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const { data, setData, post, processing, reset } = useForm({
    title: '',
    description: '',
    repository: defaultRepo,
  });

  useEffect(() => {
    if (!data.repository && defaultRepo) {
      setData('repository', defaultRepo);
    }
  }, [defaultRepo]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasGrantedRepos) return;

    const errors: Record<string, string> = {};
    const trimmedTitle = data.title.trim();
    if (!trimmedTitle) {
      errors.title = 'Title is required.';
    } else if (new TextEncoder().encode(trimmedTitle).length > 180) {
      errors.title = 'Title must be 180 bytes or fewer.';
    }

    const trimmedDesc = data.description.trim();
    if (!trimmedDesc) {
      errors.description = 'Description is required.';
    } else if (new TextEncoder().encode(trimmedDesc).length > 10000) {
      errors.description = 'Description must be 10,000 bytes or fewer.';
    }

    if (!data.repository) {
      errors.repository = 'Select an authorized repository.';
    }

    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }
    setClientErrors({});

    post('/issues/tasks', {
      preserveScroll: true,
      onSuccess: (page) => {
        const pageProps = page.props as Record<string, unknown>;
        const flash = pageProps.flash as Record<string, unknown> | undefined;
        const hasError = Boolean(pageProps.error || flash?.error);
        if (!hasError) {
          reset('title', 'description');
        }
      },
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ListPlus className="w-3.5 h-3.5 text-slate-600" />
              Independent Task Cards
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {localTasks.length} queued
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Manual backlog cards for maintainer notes and triage tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition shrink-0"
        >
          <span>{isFormOpen ? 'Hide Form' : 'New Task Card'}</span>
          {isFormOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Scope Disclaimer Banner */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-800">Queued Cards Only:</span>{' '}
          These cards are manual text notes for triage. They are <strong>not</strong> assigned to Muse,
          screenshot-enabled, verified, or automatically executed.
        </div>
      </div>

      {/* Create Task Form */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-slate-50/40 p-4 space-y-3 text-xs">
          <div className="font-semibold text-slate-800 text-xs flex items-center justify-between">
            <span>Create Queued Task Card</span>
            <span className="text-[10px] font-normal text-slate-500">Stored locally in database</span>
          </div>

          {!hasGrantedRepos && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 flex items-center justify-between gap-2">
              <span>Connect GitHub and grant repository access to create tasks.</span>
              <Link href="/settings" className="font-semibold underline hover:text-amber-900 shrink-0">
                Connect in Settings
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <label htmlFor="local-task-title" className="block text-xs font-medium text-slate-700">
                Title <span className="text-rose-500">*</span>{' '}
                <span className="text-[10px] text-slate-400 font-normal">(max 180 bytes)</span>
              </label>
              <input
                id="local-task-title"
                type="text"
                required
                maxLength={180}
                disabled={!hasGrantedRepos}
                placeholder="e.g. Fix checkout discount calculation for zero items"
                value={data.title}
                onChange={(e) => setData('title', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent shadow-2xs disabled:bg-slate-100 disabled:text-slate-400"
              />
              {clientErrors.title && <p className="text-[11px] text-rose-600">{clientErrors.title}</p>}
            </div>

            <div className="space-y-1">
              <label htmlFor="local-task-repo" className="block text-xs font-medium text-slate-700">
                Repository <span className="text-rose-500">*</span>
              </label>
              <select
                id="local-task-repo"
                required
                disabled={!hasGrantedRepos}
                value={data.repository}
                onChange={(e) => setData('repository', e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent shadow-2xs bg-white disabled:bg-slate-100 disabled:text-slate-400"
              >
                {!hasGrantedRepos ? (
                  <option value="" disabled>No authorized repositories</option>
                ) : (
                  <>
                    <option value="" disabled>Select repository</option>
                    {allowedRepositories.map((repo) => (
                      <option key={repo.fullName} value={repo.fullName}>
                        {repo.fullName} {repo.isPrivate ? '(Private)' : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {clientErrors.repository && <p className="text-[11px] text-rose-600">{clientErrors.repository}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="local-task-description" className="block text-xs font-medium text-slate-700">
              Description <span className="text-rose-500">*</span>{' '}
              <span className="text-[10px] text-slate-400 font-normal">(required, max 10,000 bytes)</span>
            </label>
            <textarea
              id="local-task-description"
              rows={3}
              required
              maxLength={10000}
              disabled={!hasGrantedRepos}
              placeholder="Describe the problem, reproduction notes, or expected outcome..."
              value={data.description}
              onChange={(e) => setData('description', e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent shadow-2xs disabled:bg-slate-100 disabled:text-slate-400"
            />
            {clientErrors.description && <p className="text-[11px] text-rose-600">{clientErrors.description}</p>}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-slate-400">
              Submits to <code className="font-mono text-slate-600">POST /issues/tasks</code>
            </span>
            <button
              type="submit"
              disabled={!hasGrantedRepos || processing || !data.title.trim() || !data.description.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{processing ? 'Queueing…' : 'Queue Task Card'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Task Cards List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 border-b border-slate-100 pb-1.5">
          <span>Queued Task Cards ({localTasks.length})</span>
          <span className="text-[10px] font-normal text-slate-400">Manual review queue</span>
        </div>

        {localTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1">
            <FileText className="w-5 h-5 mx-auto text-slate-400 mb-1" />
            <p className="font-medium text-slate-700">No independent task cards queued</p>
            <p className="text-[11px] text-slate-400">
              Use the form above to record a manual task card for backlog tracking.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {localTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2 shadow-2xs hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 max-w-[200px] truncate">
                      <FolderGit2 className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{task.repository}</span>
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                      {task.status || 'queued'}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-900 line-clamp-2" title={task.title}>
                    {task.title}
                  </h3>

                  <p className="text-[11px] text-slate-600 whitespace-pre-wrap line-clamp-3 bg-slate-50/70 p-2 rounded border border-slate-100">
                    {task.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{task.updatedAt ? task.updatedAt.slice(0, 16).replace('T', ' ') : 'Recently'}</span>
                  </span>
                  <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    Queued Card · Manual
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
