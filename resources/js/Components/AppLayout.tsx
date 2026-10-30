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
        <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
          <Link href="/issues" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-violet-700 dark:text-slate-400 dark:hover:text-violet-300">
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </Link>
        </div>
      )}
      <main className={workspace ? 'min-h-screen w-full' : 'mx-auto max-w-6xl px-4 py-6 sm:px-6'}>
        {children}
      </main>
    </div>
  );
}
