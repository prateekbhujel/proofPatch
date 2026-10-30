import React, { useEffect, useRef, useState } from 'react';
import { Link, useForm, router } from '@inertiajs/react';
import {
  FolderGit2,
  Upload,
  Image as ImageIcon,
  Mic,
  MicOff,
  FileCode,
  ShieldAlert,
  Check,
  Sparkles,
  Clock,
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

export interface GitHubRepoOption {
  fullName: string;
  isPrivate?: boolean;
}

export interface CardPreview {
  status: 'local_preview_not_sent';
  digest: string;
  context: {
    cardId: number;
    cardVersion: string;
    repository: string;
    title: string;
    description: string;
    path: string;
    commit: string;
    source: string;
    sourceSha256: string;
  };
}

export interface CardProposalPreview {
  cardId: number;
  cardVersion: string;
  previewDigest: string;
  destination: string;
  body: Record<string, unknown>;
  digest: string;
  estimatedMicros: number;
}

export interface CardProposalResult {
  status: 'unverified_suggestion';
  cardId: number;
  cardVersion: string;
  previewDigest: string;
  repository: string;
  commit: string;
  path: string;
  sourceSha256: string;
  find: string;
  replace: string;
  explanation: string;
  model: string;
  requestDigest: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  candidate: {
    status: string;
    source: string;
    sha256: string;
    applied: boolean;
    verified: boolean;
  };
}

function TaskImage({ task }: { task: LocalTaskCard }) {
  const input = useRef<HTMLInputElement>(null);
  const { data, setData, post, processing, reset } = useForm<{ image: File | null }>({ image: null });

  if (task.hasImage) {
    return (
      <div className="flex items-center gap-2 pt-1">
        <a
          href={`/issues/tasks/${task.id}/image`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 text-xs text-violet-800 hover:bg-violet-100 font-medium border border-violet-200 transition"
        >
          <ImageIcon className="w-3.5 h-3.5 text-violet-700" />
          <span>Open attached screenshot</span>
        </a>
        <span className="text-[11px] text-slate-500">
          Saved on this machine · never sent to model
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
      className="flex flex-wrap items-center gap-2 pt-1"
    >
      <label htmlFor={`task-image-${task.id}`} className="text-xs font-medium text-slate-600">
        Screenshot (optional, kept local):
      </label>
      <input
        ref={input}
        id={`task-image-${task.id}`}
        type="file"
        accept="image/png,image/jpeg"
        onChange={(event) => setData('image', event.target.files?.[0] ?? null)}
        className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border file:border-slate-200 file:text-xs file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
      />
      {data.image && (
        <button
          type="submit"
          disabled={processing}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-50"
        >
          <Upload className="w-3 h-3" />
          <span>{processing ? 'Saving…' : 'Attach'}</span>
        </button>
      )}
    </form>
  );
}

export function FocusedLocalTaskView({
  task,
  preview,
  proposalPreview,
  proposalResult,
  modelKeyAvailable = false,
  budgetCanRequest = false,
}: {
  task: LocalTaskCard;
  preview: CardPreview | null;
  proposalPreview: CardProposalPreview | null;
  proposalResult: CardProposalResult | null;
  modelKeyAvailable?: boolean;
  budgetCanRequest?: boolean;
}) {
  const { data, setData, post, processing } = useForm({
    path: preview?.context.cardId === Number(task.id) ? preview.context.path : '',
    commit: preview?.context.cardId === Number(task.id) ? preview.context.commit : '',
  });
  const [publicTextConfirmed, setPublicTextConfirmed] = useState(false);
  const [preparingProposal, setPreparingProposal] = useState(false);
  const [sendingProposal, setSendingProposal] = useState(false);

  const currentPreview = preview?.context.cardId === Number(task.id) ? preview : null;
  const currentProposalPreview =
    proposalPreview?.cardId === Number(task.id) && currentPreview ? proposalPreview : null;
  const currentProposalResult =
    proposalResult?.cardId === Number(task.id) && currentPreview ? proposalResult : null;

  return (
    <div className="space-y-5">
      {/* Task Header Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
              <FolderGit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{task.repository}</span>
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize">
              {task.status || 'queued'}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
            <Clock className="w-3 h-3" />
            <span>{task.updatedAt ? task.updatedAt.slice(0, 16).replace('T', ' ') : 'Local task'}</span>
          </span>
        </div>

        <h2 className="text-base font-semibold text-slate-900">{task.title}</h2>
        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50/80 p-3 rounded-lg border border-slate-200/70">
          {task.description}
        </p>

        <TaskImage task={task} />
      </div>

      {/* Step 1: Local Public-File Preview */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-900">1. Pin Public File &amp; Commit</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Fetches the file anonymously from GitHub to verify the repository is public. Nothing is sent to a model.
            </p>
          </div>
          {currentPreview && (
            <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              {currentPreview.context.path} @ {currentPreview.context.commit.slice(0, 8)}
            </span>
          )}
        </div>

        <form
          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
          onSubmit={(event) => {
            event.preventDefault();
            post(`/issues/tasks/${task.id}/preview`, { preserveScroll: true });
          }}
        >
          <div className="sm:col-span-5">
            <label htmlFor={`preview-path-${task.id}`} className="block text-[11px] font-medium text-slate-700 mb-1">
              File path
            </label>
            <input
              id={`preview-path-${task.id}`}
              required
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={data.path}
              onChange={(event) => setData('path', event.target.value)}
              placeholder="src/OrderTotal.php"
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
          <div className="sm:col-span-5">
            <label htmlFor={`preview-commit-${task.id}`} className="block text-[11px] font-medium text-slate-700 mb-1">
              40-character commit SHA
            </label>
            <input
              id={`preview-commit-${task.id}`}
              required
              pattern="[a-f0-9]{40}"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={data.commit}
              onChange={(event) => setData('commit', event.target.value)}
              placeholder="e.g. 676e73d674aca9ba711aa10877ffd7287e1f25b3"
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              disabled={processing}
              className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition"
              type="submit"
            >
              {processing ? 'Checking…' : 'Preview file'}
            </button>
          </div>
        </form>

        {currentPreview && (
          <div className="pt-2 space-y-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Local preview ready · not sent to any model</span>
              <span className="font-mono">SHA-256: {currentPreview.context.sourceSha256.slice(0, 12)}…</span>
            </div>
            <details className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
              <summary className="cursor-pointer font-medium text-slate-800 text-xs">
                Inspect pinned source ({currentPreview.context.path}) &amp; preview digest
              </summary>
              <pre className="mt-2 max-h-52 overflow-auto whitespace-pre rounded bg-white p-2.5 text-[11px] font-mono text-slate-800 border border-slate-200">
                {currentPreview.context.source}
              </pre>
              <p className="mt-1.5 text-[10px] font-mono text-slate-500 break-all">
                Preview digest: {currentPreview.digest}
              </p>
            </details>
          </div>
        )}
      </div>

      {/* Step 2: In-Context Approval Card (Helicon style) */}
      {currentPreview && !currentProposalResult && (
        <div className="rounded-xl border-2 border-amber-200/90 bg-amber-50/30 p-5 space-y-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h3 className="text-xs font-semibold text-slate-900">
                {currentProposalPreview
                  ? 'Muse Spark Open wants to read this public task & file'
                  : 'Prepare single-file model request'}
              </h3>
              <p className="text-[11px] text-slate-600">
                Nothing is sent until you confirm the task text is public and approve this exact snapshot.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-800 cursor-pointer select-none bg-white p-3 rounded-lg border border-slate-200">
            <input
              type="checkbox"
              checked={publicTextConfirmed}
              onChange={(e) => setPublicTextConfirmed(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
            />
            <span>
              I confirm this task title and description contain only <strong>public, non-confidential text</strong> safe to send to Baseten (<code className="font-mono text-[11px]">meta-models/muse-spark-open-1026</code>). Local screenshots are never included.
            </span>
          </label>

          {!currentProposalPreview ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Creates a single-use approval token bound to card version <code className="font-mono">{currentPreview.context.cardVersion.slice(0, 8)}</code>
              </span>
              <button
                type="button"
                disabled={!publicTextConfirmed || preparingProposal}
                onClick={() => {
                  setPreparingProposal(true);
                  router.post(
                    `/issues/tasks/${task.id}/model-preview`,
                    { public_text_confirmed: publicTextConfirmed },
                    {
                      preserveScroll: true,
                      onFinish: () => setPreparingProposal(false),
                    }
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition"
              >
                <span>{preparingProposal ? 'Preparing…' : 'Review exact request'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-white border border-slate-200 px-3.5 py-2.5 font-mono text-xs text-slate-800 flex flex-wrap items-center justify-between gap-2">
                <span>
                  POST {currentProposalPreview.destination} · {currentPreview.context.path}
                </span>
                <span className="text-[11px] text-slate-500">
                  Est. ${(currentProposalPreview.estimatedMicros / 1_000_000).toFixed(4)}
                </span>
              </div>

              <details className="text-[11px] text-slate-600">
                <summary className="cursor-pointer font-medium text-slate-700">
                  Inspect exact JSON payload &amp; request digest ({currentProposalPreview.digest.slice(0, 12)}…)
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white border border-slate-200 p-2.5 font-mono text-[11px] text-slate-800">
                  {JSON.stringify(currentProposalPreview.body, null, 2)}
                </pre>
              </details>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!publicTextConfirmed || sendingProposal || !modelKeyAvailable || !budgetCanRequest}
                    onClick={() => {
                      setSendingProposal(true);
                      router.post(
                        `/issues/tasks/${task.id}/model-send`,
                        {
                          approved: true,
                          public_text_confirmed: publicTextConfirmed,
                          digest: currentProposalPreview.digest,
                        },
                        {
                          preserveScroll: true,
                          onFinish: () => setSendingProposal(false),
                        }
                      );
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{sendingProposal ? 'Requesting…' : 'Allow once'}</span>
                  </button>
                  {(!modelKeyAvailable || !budgetCanRequest) && (
                    <span className="text-[11px] text-amber-800">
                      {!modelKeyAvailable ? 'Baseten API key not configured on host.' : 'Local request budget exhausted.'}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Single-use approval · Digest pinned
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Readable Inline Diff Result (Helicon style) */}
      {currentProposalResult && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono text-xs text-slate-900 font-medium">
              <FileCode className="w-3.5 h-3.5 text-violet-700" />
              <span>{currentProposalResult.path}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-semibold text-emerald-700">+1</span>
              <span className="text-[11px] font-mono font-semibold text-rose-700">-1</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                Unverified In-Memory Preview
              </span>
            </div>
          </div>

          <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200/80 font-mono text-[11px] text-slate-500">
            @@ {currentProposalResult.path} @ {currentProposalResult.commit.slice(0, 8)} @@
          </div>

          <div className="font-mono text-xs divide-y divide-slate-100">
            <div className="bg-rose-50/70 text-rose-950 px-4 py-2 flex items-start gap-3 overflow-x-auto">
              <span className="text-rose-500 select-none shrink-0">-</span>
              <pre className="whitespace-pre-wrap break-words line-through decoration-rose-400/80">
                {currentProposalResult.find}
              </pre>
            </div>
            <div className="bg-emerald-50/70 text-emerald-950 px-4 py-2 flex items-start gap-3 overflow-x-auto">
              <span className="text-emerald-600 select-none shrink-0">+</span>
              <pre className="whitespace-pre-wrap break-words">
                {currentProposalResult.replace}
              </pre>
            </div>
          </div>

          <div className="px-4 py-3 bg-white border-t border-slate-200 space-y-2">
            <p className="text-xs text-slate-700 leading-relaxed">{currentProposalResult.explanation}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 font-mono pt-1">
              <span>
                Allowed once · {currentProposalResult.model} ({currentProposalResult.usage.prompt_tokens + currentProposalResult.usage.completion_tokens} tokens)
              </span>
              <span>Candidate SHA-256: {currentProposalResult.candidate.sha256.slice(0, 12)}… (not written to disk)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface TaskCardSectionProps {
  localTasks?: LocalTaskCard[];
  cardPreview?: CardPreview | null;
  githubConnection?: {
    isConnected?: boolean;
    repositories?: GitHubRepoOption[];
    selectedRepo?: string | null;
  } | null;
  onCreated?: () => void;
}

export function NewTaskComposer({
  githubConnection = null,
  onCreated,
}: {
  githubConnection?: {
    isConnected?: boolean;
    repositories?: GitHubRepoOption[];
    selectedRepo?: string | null;
  } | null;
  onCreated?: () => void;
}) {
  const allowedRepositories = githubConnection?.repositories || [];
  const hasGrantedRepos = allowedRepositories.length > 0;
  const defaultRepo =
    githubConnection?.selectedRepo || (hasGrantedRepos ? allowedRepositories[0].fullName : '');

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
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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
              description: prev.description
                ? `${prev.description} ${transcript.trim()}`
                : transcript.trim(),
            }));
          }
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
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
    } else if (new TextEncoder().encode(trimmedDesc).length > 6000) {
      errors.description = 'Description must be 6,000 bytes or fewer.';
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
          onCreated?.();
        }
      },
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3"
    >
      {!hasGrantedRepos && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 flex items-center justify-between gap-2">
          <span>Connect GitHub in Settings to create local repository tasks, or use the verified fixtures below.</span>
          <Link href="/settings" className="font-semibold underline hover:text-amber-950 shrink-0">
            Connect GitHub
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="sm:col-span-2">
          <label htmlFor="local-task-title" className="sr-only">
            Task title
          </label>
          <input
            id="local-task-title"
            type="text"
            required
            maxLength={180}
            disabled={!hasGrantedRepos}
            aria-invalid={Boolean(clientErrors.title)}
            aria-describedby={clientErrors.title ? 'local-task-title-error' : undefined}
            placeholder="Task title — e.g. Fix zero-quantity order total calculation"
            value={data.title}
            onChange={(e) => setData('title', e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
          />
          {clientErrors.title && (
            <p id="local-task-title-error" className="mt-1 text-[11px] text-rose-600">
              {clientErrors.title}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="local-task-repo" className="sr-only">
            Repository
          </label>
          <select
            id="local-task-repo"
            required
            disabled={!hasGrantedRepos}
            value={data.repository}
            onChange={(e) => setData('repository', e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
          >
            {!hasGrantedRepos ? (
              <option value="" disabled>
                No connected repo
              </option>
            ) : (
              <>
                <option value="" disabled>
                  Select repository
                </option>
                {allowedRepositories.map((repo) => (
                  <option key={repo.fullName} value={repo.fullName}>
                    {repo.fullName} {repo.isPrivate ? '(Private)' : ''}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="local-task-description" className="sr-only">
          Description
        </label>
        <textarea
          id="local-task-description"
          rows={3}
          required
          maxLength={6000}
          disabled={!hasGrantedRepos}
          aria-invalid={Boolean(clientErrors.description)}
          aria-describedby={clientErrors.description ? 'local-task-desc-error' : undefined}
          placeholder="Describe a change, a bug reproduction, or a question about a file…"
          value={data.description}
          onChange={(e) => setData('description', e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-600 disabled:opacity-50"
        />
        {clientErrors.description && (
          <p id="local-task-desc-error" className="mt-1 text-[11px] text-rose-600">
            {clientErrors.description}
          </p>
        )}
      </div>

      {/* Helicon-style bottom pill bar inside composer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
            <Sparkles className="w-3 h-3 text-violet-700" />
            muse-spark-open-1026
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/80 font-medium text-[10px]">
            Ask first
          </span>
          {speechSupported && (
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={!hasGrantedRepos}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition ${
                isListening
                  ? 'bg-rose-100 text-rose-700 border border-rose-300 animate-pulse'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title="Dictate task description with voice"
            >
              {isListening ? <MicOff className="w-3 h-3 text-rose-600" /> : <Mic className="w-3 h-3" />}
              <span>{isListening ? 'Listening…' : 'Voice'}</span>
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!hasGrantedRepos || processing || !data.title.trim() || !data.description.trim()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-white bg-slate-900 hover:bg-slate-800 transition disabled:opacity-40"
        >
          <span>{processing ? 'Saving…' : 'Save task'}</span>
        </button>
      </div>
    </form>
  );
}

export function TaskCardSection({
  localTasks = [],
  cardPreview = null,
  githubConnection = null,
}: TaskCardSectionProps) {
  return (
    <div className="space-y-4">
      <NewTaskComposer githubConnection={githubConnection} />
      {localTasks.map((task) => (
        <FocusedLocalTaskView
          key={task.id}
          task={task}
          preview={cardPreview}
          proposalPreview={null}
          proposalResult={null}
        />
      ))}
    </div>
  );
}
