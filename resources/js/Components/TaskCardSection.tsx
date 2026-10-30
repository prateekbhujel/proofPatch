import React, { useEffect, useRef, useState } from 'react';
import { Link, router, useForm } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListPlus,
  Clock,
  FolderGit2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

export interface LocalTaskCard {
  id: string | number;
  title: string;
  description: string;
  repository: string;
  status: string;
  updatedAt: string | null;
  hasImage: boolean;
  workbenchTaskId?: number | null;
}

function TaskImage({ task }: { task: LocalTaskCard }) {
  const input = useRef<HTMLInputElement>(null);
  const { data, setData, post, processing, reset } = useForm<{image: File | null}>({ image: null });

  if (task.hasImage) {
    return (
      <a
        href={`/issues/tasks/${task.id}/image`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        <span>View screenshot</span>
      </a>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!data.image) return;
        post(`/issues/tasks/${task.id}/image`, {
          preserveScroll: true,
          onSuccess: (page) => {
            const props = page.props as Record<string, unknown>;
            const flash = props.flash as Record<string, unknown> | undefined;
            if (!props.error && !flash?.error) {
              reset();
              if (input.current) input.current.value = '';
            }
          },
        });
      }}
      className="space-y-2 pt-1"
    >
      <label htmlFor={`task-image-${task.id}`} className="block text-[11px] font-medium text-slate-400">
        Attach Screenshot (PNG or JPEG, up to 2 MB)
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={input}
          id={`task-image-${task.id}`}
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => setData('image', event.target.files?.[0] ?? null)}
          className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white/[0.06] file:text-slate-300 hover:file:bg-white/10"
        />
        <button
          type="submit"
          disabled={!data.image || processing}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 transition disabled:opacity-50 shrink-0"
        >
          <Upload className="w-3 h-3" />
          <span>{processing ? 'Saving…' : 'Upload'}</span>
        </button>
      </div>
    </form>
  );
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
  const [assigningId, setAssigningId] = useState<string | number | null>(null);

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
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/[0.06] bg-[#16161f]/80 backdrop-blur-sm p-5 space-y-4 shadow-xl shadow-black/10"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/[0.06] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <ListPlus className="w-4 h-4 text-violet-400" />
              Tasks
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
              {localTasks.length} queued
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Keep track of work for your repositories.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition shrink-0"
        >
          <span>{isFormOpen ? 'Close' : 'New task'}</span>
          {isFormOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Scope Disclaimer Banner */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-400 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          Tasks and screenshots stay on this computer. Assigning a suitable task to Muse runs strictly against public or synthetic test data; screenshots and private descriptions are never sent to a model.
        </div>
      </div>

      {/* Create Task Form */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3.5 text-xs overflow-hidden"
          >
            <div className="font-semibold text-white text-xs">
              <span>New Task Card</span>
            </div>

            {!hasGrantedRepos && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center justify-between gap-2">
                <span>Connect GitHub and grant repository access to create tasks.</span>
                <Link href="/settings" className="font-semibold underline hover:text-amber-200 shrink-0">
                  Connect in Settings
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label htmlFor="local-task-title" className="block text-xs font-medium text-slate-300">
                  Title <span className="text-rose-400">*</span>
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
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:bg-white/[0.02] disabled:text-slate-600"
                />
                {clientErrors.title && <p className="text-[11px] text-rose-400">{clientErrors.title}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="local-task-repo" className="block text-xs font-medium text-slate-300">
                  Repository <span className="text-rose-400">*</span>
                </label>
                <select
                  id="local-task-repo"
                  required
                  disabled={!hasGrantedRepos}
                  value={data.repository}
                  onChange={(e) => setData('repository', e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-[#1a1a24] px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:bg-white/[0.02] disabled:text-slate-600"
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
                {clientErrors.repository && <p className="text-[11px] text-rose-400">{clientErrors.repository}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="local-task-description" className="block text-xs font-medium text-slate-300">
                Description <span className="text-rose-400">*</span>
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
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:bg-white/[0.02] disabled:text-slate-600"
              />
              {clientErrors.description && <p className="text-[11px] text-rose-400">{clientErrors.description}</p>}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-500">Saved on this computer</span>
              <button
                type="submit"
                disabled={!hasGrantedRepos || processing || !data.title.trim() || !data.description.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{processing ? 'Saving…' : 'Save task'}</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Task Cards List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-white/[0.06] pb-1.5">
          <span>Queued ({localTasks.length})</span>
        </div>

        {localTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.08] p-6 text-center text-xs text-slate-500 space-y-1">
            <FileText className="w-5 h-5 mx-auto text-slate-600 mb-1" />
            <p className="font-medium text-slate-400">No tasks yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {localTasks.map((task) => (
              <motion.div
                key={task.id}
                whileHover={{ y: -2 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2.5 hover:bg-white/[0.04] transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-lg border border-white/[0.06] max-w-[200px] truncate">
                      <FolderGit2 className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{task.repository}</span>
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 capitalize">
                      {task.status || 'queued'}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-white line-clamp-2" title={task.title}>
                    {task.title}
                  </h3>

                  <details className="text-[11px] text-slate-400 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04]">
                    <summary className="cursor-pointer font-medium text-slate-300">Description</summary>
                    <p className="mt-2 whitespace-pre-wrap break-words">{task.description}</p>
                  </details>
                  <TaskImage task={task} />
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-slate-500 gap-2">
                  <span className="flex items-center gap-1 font-mono shrink-0">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{task.updatedAt ? task.updatedAt.slice(0, 16).replace('T', ' ') : 'Recently'}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.status === 'queued' ? (
                      <button
                        type="button"
                        disabled={assigningId === task.id}
                        onClick={() => {
                          setAssigningId(task.id);
                          router.post(`/issues/tasks/${task.id}/assign`, {}, {
                            preserveScroll: true,
                            onFinish: () => setAssigningId(null),
                          });
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 transition shadow-xs"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{assigningId === task.id ? 'Assigning…' : 'Assign to Muse'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={assigningId === task.id}
                        onClick={() => {
                          setAssigningId(task.id);
                          router.post(`/issues/tasks/${task.id}/assign`, {}, {
                            preserveScroll: true,
                            onFinish: () => setAssigningId(null),
                          });
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-violet-400 hover:text-violet-300 underline"
                      >
                        <span>Open in Workbench</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}
