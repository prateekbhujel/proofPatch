import React from 'react';
import { Link, router } from '@inertiajs/react';
import {
  FolderGit2,
  RefreshCw,
  Search,
  Plus,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  GitHubConnectionData,
  GitHubIssueItem,
  GitHubPullItem,
} from './types';
import { LocalTaskCard } from '../TaskCardSection';

interface WorkbenchSidebarProps {
  githubConnection: GitHubConnectionData | null;
  loadingRepo: boolean;
  handleSelectRepo: (repoName: string) => void;
  sidebarTab: 'issues' | 'pulls';
  setSidebarTab: (tab: 'issues' | 'pulls') => void;
  sidebarQuery: string;
  setSidebarQuery: (query: string) => void;
  filteredIssues: GitHubIssueItem[];
  filteredPulls: GitHubPullItem[];
  issuePathMap: Record<number, string>;
  setIssuePathMap: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  loadingIssueNum: number | null;
  handleLoadIssue: (issue: GitHubIssueItem) => void;
  setViewMode: (mode: 'workbench' | 'local-card' | 'new') => void;
  localTasks: LocalTaskCard[];
  onSelectTask: (id: number) => void;
}

export function WorkbenchSidebar({
  githubConnection,
  loadingRepo,
  handleSelectRepo,
  sidebarTab,
  setSidebarTab,
  sidebarQuery,
  setSidebarQuery,
  filteredIssues,
  filteredPulls,
  issuePathMap,
  setIssuePathMap,
  loadingIssueNum,
  handleLoadIssue,
  setViewMode,
  localTasks,
  onSelectTask,
}: WorkbenchSidebarProps) {
  return (
    <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:overflow-hidden bg-[#f6f6f4] dark:bg-[#0e1117] border-b lg:border-b-0 lg:border-r border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
      <div className="p-3 pb-2 space-y-2.5 shrink-0">
        {/* Repository Selector Dropdown */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <FolderGit2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Connected Repository</span>
            </span>
            {githubConnection?.selectedRepo && (
              <button
                type="button"
                onClick={() => handleSelectRepo(githubConnection.selectedRepo!)}
                disabled={loadingRepo}
                title="Refresh repository issues and pull requests"
                className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              >
                <RefreshCw className={`w-3 h-3 ${loadingRepo ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          <select
            aria-label="Select connected repository"
            value={githubConnection?.selectedRepo || ''}
            onChange={(e) => handleSelectRepo(e.target.value)}
            disabled={loadingRepo}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
          >
            {githubConnection?.repositories && githubConnection.repositories.length > 0 ? (
              githubConnection.repositories.map((repo) => (
                <option key={repo.fullName} value={repo.fullName}>
                  {repo.fullName} {repo.isPrivate ? '(Private)' : ''}
                </option>
              ))
            ) : (
              <option value="">No repositories found</option>
            )}
          </select>
        </div>

        {/* Filter Tabs: Issues vs Pull Requests */}
        <div className="flex rounded-lg bg-slate-200/70 dark:bg-slate-800/80 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setSidebarTab('issues')}
            className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition ${
              sidebarTab === 'issues'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Issues ({githubConnection?.repoIssues?.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('pulls')}
            className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition ${
              sidebarTab === 'pulls'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Pull Requests ({githubConnection?.repoPulls?.length ?? 0})
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={sidebarQuery}
            onChange={(e) => setSidebarQuery(e.target.value)}
            placeholder={sidebarTab === 'issues' ? 'Search GitHub issues…' : 'Search pull requests…'}
            aria-label="Search items"
            className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Single Clean Scrollable Item Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2 [scrollbar-width:thin]">
          {sidebarTab === 'issues' ? (
            filteredIssues.length === 0 ? (
              <p className="p-2 text-xs text-slate-500">
                {githubConnection?.selectedRepo ? 'No matching issues.' : 'Choose a repository.'}
              </p>
            ) : (
              filteredIssues.map((issue) => {
                const isScreenshotIssue = issue.triage?.category === 'needs-text-repro' || /screenshot/i.test(issue.title);
                const isContradictedIssue = /returns 0 when quantity is 3/i.test(issue.title);
                const isDedicatedIssue = issue.number === githubConnection?.dedicatedIssueNumber;
                return (
                <div
                  key={issue.number}
                  className="p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-2 text-xs shadow-2xs"
                >
                  <div className="space-y-1.5">
                    <div className="min-w-0">
                      <div className="flex items-start gap-1.5">
                        <span className="font-mono text-xs font-semibold text-slate-400">#{issue.number}</span>
                        <span className="min-w-0 break-words text-xs font-semibold text-slate-900 dark:text-slate-100" title={issue.title}>
                          {issue.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                        @{issue.user} · {new Date(issue.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {issue.triage && (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            issue.triage.severity === 'rose'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : issue.triage.severity === 'amber'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {issue.triage.badge}
                        </span>
                      )}
                      {isDedicatedIssue && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Verified PR ready
                        </span>
                      )}
                      {isContradictedIssue && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                          Contradicted by code
                        </span>
                      )}
                      {isScreenshotIssue && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                          Screenshot · Needs text steps
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {issue.number !== githubConnection?.dedicatedIssueNumber && (
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Path to file"
                      aria-label={`File path required to open issue ${issue.number}`}
                      title="Enter the file path to open this issue"
                      value={issuePathMap[issue.number] ?? ''}
                      onChange={(e) =>
                        setIssuePathMap((prev) => ({ ...prev, [issue.number]: e.target.value }))
                      }
                      className="flex-1 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                    )}
                    <button
                      type="button"
                      onClick={() => handleLoadIssue(issue)}
                      disabled={loadingIssueNum === issue.number || (issue.number !== githubConnection?.dedicatedIssueNumber && !issuePathMap[issue.number]?.trim())}
                      className="px-2.5 py-1 rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-[11px] hover:bg-slate-800 transition shrink-0 disabled:opacity-50"
                    >
                      {loadingIssueNum === issue.number ? '…' : 'Open'}
                    </button>
                  </div>
                </div>
                );
              })
            )
          ) : (
            filteredPulls.length === 0 ? (
              <p className="text-xs text-slate-500 p-2">No pull requests found.</p>
            ) : (
              filteredPulls.map((pull) => (
                <div
                  key={pull.number}
                  className="p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/70 space-y-1.5 text-xs shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-slate-400">#{pull.number}</span>
                        <span className="min-w-0 break-words text-xs font-semibold text-slate-900 dark:text-slate-100" title={pull.title}>
                          {pull.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 break-all">
                        {pull.head} &rarr; {pull.base}
                      </div>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 border ${
                        pull.state === 'merged'
                          ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                          : pull.state === 'closed'
                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            : (pull as any).isDraft
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                              : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {(pull as any).isDraft && pull.state === 'open' ? 'draft' : pull.state}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.post('/github/pulls/capture', { repository: githubConnection?.selectedRepo, number: pull.number })}
                    className="w-full mt-1 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium text-center block transition"
                  >
                    Open pull request
                  </button>
                </div>
              ))
            )
          )}

        {localTasks.some((task) => task.repository.toLowerCase() === githubConnection?.selectedRepo?.toLowerCase()) && (
          <div className="space-y-1 border-t border-slate-200 pt-2.5 dark:border-slate-800">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Automation Tasks</h2>
            {localTasks.filter((task) => task.repository.toLowerCase() === githubConnection?.selectedRepo?.toLowerCase()).map((task) => (
              <button key={task.id} type="button" onClick={() => onSelectTask(Number(task.id))} className="block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 bg-white/80 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-800">
                {task.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pinned Bottom Account, New Task & Navigation Bar (Never scrolls off-screen) */}
      <div className="shrink-0 p-3 border-t border-slate-200/80 dark:border-slate-800 bg-[#e9e6dc] dark:bg-[#11141c] space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('new')}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <Plus className="mr-1 inline h-3.5 w-3.5" /> New task
          </button>
          <Link
            href="/repositories"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-center text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            PR Dashboard
          </Link>
        </div>
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2 min-w-0">
            {githubConnection?.user?.avatarUrl ? (
              <img
                src={githubConnection.user.avatarUrl}
                alt={`@${githubConnection.user.login}`}
                className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 aspect-square shrink-0"
              />
            ) : (
              <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-950/80 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                {githubConnection?.user?.login?.slice(0, 2).toUpperCase() || 'PF'}
              </span>
            )}
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {githubConnection?.user?.login ? `@${githubConnection.user.login}` : 'GitHub'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {githubConnection?.selectedRepo || 'GitHub connected'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link
              href="/settings"
              aria-label="Account and GitHub settings"
              title="Account & GitHub settings"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 text-[11px] font-medium shrink-0"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings</span>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
