import React from 'react';
import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

interface AppLayoutProps {
  activeNav?: 'overview' | 'repositories' | 'pulls' | 'checks' | 'issues' | 'settings' | 'docs';
  children: React.ReactNode;
}

export function AppLayout({ activeNav, children }: AppLayoutProps) {
  const workspace = activeNav === 'issues';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0e1117] dark:text-slate-100">
      {!workspace && (
        <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#141821]/95 backdrop-blur-xs">
          <div className="mx-auto max-w-6xl h-12 px-4 sm:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/issues"
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-violet-700 dark:text-slate-200 dark:hover:text-violet-300 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to workspace
              </Link>
              <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden sm:inline">
                ProofPatcher Verification Kernel
              </span>
            </div>

            <nav className="flex items-center gap-1.5 text-xs shrink-0">
              <Link
                href="/issues"
                className="px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition"
              >
                Issues &amp; Tasks
              </Link>
              <Link
                href="/repositories"
                className={`px-2.5 py-1 rounded-md border font-medium transition ${
                  activeNav === 'repositories' || activeNav === 'pulls'
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                Pull Requests
              </Link>
              <Link
                href="/checks"
                className={`px-2.5 py-1 rounded-md border font-medium transition ${
                  activeNav === 'checks'
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                Checks
              </Link>
              <Link
                href="/settings"
                className={`px-2.5 py-1 rounded-md border font-medium transition ${
                  activeNav === 'settings'
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                Settings
              </Link>
            </nav>
          </div>
        </header>
      )}
      <main className={workspace ? 'min-h-screen w-full' : 'mx-auto max-w-6xl px-4 py-6 sm:px-6'}>
        {children}
      </main>
    </div>
  );
}
