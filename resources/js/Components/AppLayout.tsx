import React, { ReactNode } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { LayoutGrid, GitPullRequest, CheckCircle2, Circle, ClipboardList } from 'lucide-react';

interface AppLayoutProps {
  title?: string;
  activeNav?: 'overview' | 'pulls' | 'checks' | 'issues';
  children: ReactNode;
}

export function AppLayout({ activeNav = 'overview', children }: AppLayoutProps) {
  const { url } = usePage();

  const currentNav = activeNav || (url === '/' ? 'overview' : url.startsWith('/repositories') ? 'pulls' : 'checks');

  const navItems = [
    { key: 'overview', href: '/', label: 'Overview', icon: LayoutGrid },
    { key: 'pulls', href: '/repositories', label: 'Pull Requests', icon: GitPullRequest },
    { key: 'issues', href: '/issues', label: 'Issues', icon: ClipboardList },
    { key: 'checks', href: '/checks', label: 'Verification', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-800">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand & Breadcrumb */}
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-3 group">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-sm shadow-violet-500/30 group-hover:scale-105 transition duration-150">
                  P
                </span>
                <span className="font-bold text-slate-900 tracking-tight text-lg group-hover:text-violet-700 transition">
                  ProofPatch
                </span>
              </Link>

              <div className="hidden sm:flex items-center text-xs text-slate-400 gap-1.5 font-medium border-l border-slate-200 pl-4">
                <span className="text-slate-500">local</span>
                <span>/</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-700/10">
                  sqlite:proofpatch
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex items-center gap-1 sm:gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isCurrent = currentNav === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-violet-50 text-violet-700 font-semibold shadow-xs ring-1 ring-violet-600/10'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isCurrent ? 'text-violet-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Engine Status */}
            <div className="hidden md:flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Ready</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">ProofPatch</span>
            <span>·</span>
            <span>Visual review engine</span>
          </div>
          <div>Local SQLite worktree runner</div>
        </div>
      </footer>
    </div>
  );
}
