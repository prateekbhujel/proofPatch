import React, { useEffect, useRef, useState } from 'react';
import { Link, useForm } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListPlus,
  Clock,
  FolderGit2,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Upload,
  Image as ImageIcon,
  Mic,
  MicOff,
  Volume2,
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
      <div className="flex items-center gap-2 pt-1">
        <a
          href={`/issues/tasks/${task.id}/image`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 text-xs text-violet-700 hover:text-violet-900 font-semibold border border-violet-200 transition"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Screenshot Evidence</span>
        </a>
        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          Saved locally
        </span>
      </div>
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
      <label htmlFor={`task-image-${task.id}`} className="block text-[11px] font-semibold text-slate-700">
        Attach Screenshot (PNG or JPEG, up to 2 MB)
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={input}
          id={`task-image-${task.id}`}
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => setData('image', event.target.files?.[0] ?? null)}
          className="block w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
        />
        <button
          type="submit"
          disabled={!data.image || processing}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-50 shrink-0"
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
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  const { data, setData, post, processing, reset } = useForm({
    title: '',
    description: '',
    repository: defaultRepo,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript;
            }
          }
          if (transcript) {
            setData((prev) => ({
              ...prev,
              description: prev.description ? `${prev.description} ${transcript.trim()}` : transcript.trim(),
            }));
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

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
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ListPlus className="w-3.5 h-3.5 text-slate-600" />
              Tasks & Backlog
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {localTasks.length} queued
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Cards stay on this computer. Assigning them to Muse is not available yet.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition shrink-0"
        >
          <span>{isFormOpen ? 'Close' : 'New task'}</span>
          {isFormOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Scope Disclaimer Banner */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 flex items-start gap-2.5">
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
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3.5 text-xs overflow-hidden"
          >
            <div className="font-bold text-slate-900 text-xs">
              <span>New Task Card</span>
            </div>

            {!hasGrantedRepos && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center justify-between gap-2">
                <span>Connect GitHub and grant repository access to create tasks.</span>
                <Link href="/settings" className="font-semibold underline hover:text-amber-900 shrink-0">
                  Connect in Settings
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label htmlFor="local-task-title" className="block text-xs font-semibold text-slate-700">
                  Title <span className="text-rose-500">*</span>
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs"
                />
                {clientErrors.title && <p className="text-[11px] text-rose-600">{clientErrors.title}</p>}
              </div>

              <div className="space-y-1">
                <label htmlFor="local-task-repo" className="block text-xs font-semibold text-slate-700">
                  Repository <span className="text-rose-500">*</span>
                </label>
                <select
                  id="local-task-repo"
                  required
                  disabled={!hasGrantedRepos}
                  value={data.repository}
                  onChange={(e) => setData('repository', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs"
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
              <div className="flex items-center justify-between">
                <label htmlFor="local-task-description" className="block text-xs font-semibold text-slate-700">
                  Description <span className="text-rose-500">*</span>
                </label>
                {speechSupported && (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    disabled={!hasGrantedRepos}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                      isListening
                        ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                    }`}
                    title="Dictate problem with voice input"
                  >
                    {isListening ? (
                      <MicOff className="w-3.5 h-3.5 text-rose-600 animate-bounce" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-slate-600" />
                    )}
                    <span>{isListening ? 'Listening… (speak)' : 'Voice Input'}</span>
                  </button>
                )}
              </div>
              <textarea
                id="local-task-description"
                rows={3}
                required
                maxLength={10000}
                disabled={!hasGrantedRepos}
                placeholder="Describe the problem, reproduction notes, or expected outcome..."
                value={data.description}
                onChange={(e) => setData('description', e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:bg-slate-100 disabled:text-slate-400 shadow-2xs"
              />
              {clientErrors.description && <p className="text-[11px] text-rose-600">{clientErrors.description}</p>}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400">Saved locally on this computer</span>
              <button
                type="submit"
                disabled={!hasGrantedRepos || processing || !data.title.trim() || !data.description.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{processing ? 'Saving…' : 'Save task'}</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Task Cards List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
          <span>Queued Cards ({localTasks.length})</span>
        </div>

        {localTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1">
            <FileText className="w-5 h-5 mx-auto text-slate-400 mb-1" />
            <p className="font-semibold text-slate-700">No tasks created yet</p>
            <p className="text-[11px]">Click &quot;New task&quot; to queue a task card.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {localTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 max-w-[200px] truncate">
                      <FolderGit2 className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{task.repository}</span>
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                      {task.status || 'queued'}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 line-clamp-2" title={task.title}>
                    {task.title}
                  </h3>

                  <details className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200/60">
                    <summary className="cursor-pointer font-semibold text-slate-700">Description</summary>
                    <p className="mt-2 whitespace-pre-wrap break-words">{task.description}</p>
                  </details>
                  <TaskImage task={task} />
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 gap-2">
                  <span className="flex items-center gap-1 font-mono shrink-0">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{task.updatedAt ? task.updatedAt.slice(0, 16).replace('T', ' ') : 'Recently'}</span>
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
