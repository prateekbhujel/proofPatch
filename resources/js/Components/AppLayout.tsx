import React, { ReactNode } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { LayoutGrid, GitPullRequest, CheckCircle2, ClipboardList } from 'lucide-react';

interface AppLayoutProps {
  title?: string;
  activeNav?: 'overview' | 'repositories' | 'pulls' | 'checks' | 'issues';
  children: ReactNode;
}

export function AppLayout({ activeNav, children }: AppLayoutProps) {
  const { url } = usePage();

  const currentNav = (() => {
    if (activeNav) {
      if (activeNav === 'pulls') return 'repositories';
      return activeNav;
    }
    if (url === '/') return 'overview';
    if (url.startsWith('/repositories')) return 'repositories';
    if (url.startsWith('/issues')) return 'issues';
    if (url.startsWith('/checks')) return 'checks';
    return 'overview';
  })();

  const navItems = [
    { key: 'overview', href: '/', label: 'Overview', shortLabel: 'Overview', icon: LayoutGrid },
    { key: 'repositories', href: '/repositories', label: 'Repositories', shortLabel: 'Repos', icon: GitPullRequest },
    { key: 'issues', href: '/issues', label: 'Issues', shortLabel: 'Issues', icon: ClipboardList },
    { key: 'checks', href: '/checks', label: 'Checks', shortLabel: 'Checks', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 text-slate-800 antialiased">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-2">
            {/* Brand & Breadcrumb */}
            <div className="flex items-center gap-3 sm:gap-5 shrink-0">
              <Link
                href="/"
                className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 rounded-lg"
              >
                <span className="w-7 h-7 rounded-md bg-violet-700 flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-xs group-hover:bg-violet-800 transition">
                  P
                </span>
                <div className="hidden sm:flex flex-col">
                  <span className="font-semibold text-slate-900 tracking-tight text-sm leading-none">
                    ProofPatch
                  </span>
                  <span className="text-[10px] text-violet-700 font-medium tracking-normal mt-0.5">
                    Co-Maintainer
                  </span>
                </div>
              </Link>

              <div className="hidden md:flex items-center text-xs text-slate-400 gap-1.5 font-medium border-l border-slate-200 pl-3.5">
                <span className="text-slate-500">local</span>
                <span>/</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  sqlite:proofpatch
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex items-center gap-0.5 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isCurrent = currentNav === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-1 whitespace-nowrap ${
                      isCurrent
                        ? 'bg-violet-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                    <span className="hidden sm:inline">{item.label}</span>
                    <span className="inline sm:hidden">{item.shortLabel}</span>
                  </Link>
                );
              })}
            </nav>

            {/* System Status */}
            <div className="hidden md:flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Worktree Runner</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">ProofPatch</span>
            <span>·</span>
            <span>Muse co-maintainer & verification engine</span>
          </div>
          <div className="text-[11px] text-slate-400">Isolated worktrees · Cryptographic receipts</div>
        </div>
      </footer>
    </div>
  );
}
