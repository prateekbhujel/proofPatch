import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import {
  LayoutGrid,
  GitPullRequest,
  CheckCircle2,
  ClipboardList,
  Settings,
  Bell,
  Trash2,
  X,
  Info,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  link?: string;
  read?: boolean;
}

interface AppLayoutProps {
  title?: string;
  activeNav?: 'overview' | 'repositories' | 'pulls' | 'checks' | 'issues' | 'settings' | 'docs';
  children: ReactNode;
}

export function AppLayout({ activeNav, children }: AppLayoutProps) {
  const { url, props } = usePage();
  const notifications: NotificationItem[] = ((props as any).notifications as NotificationItem[]) || [];

  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);

  const currentNav = (() => {
    if (activeNav) {
      if (activeNav === 'pulls') return 'repositories';
      return activeNav;
    }
    if (url === '/') return 'overview';
    if (url.startsWith('/repositories')) return 'repositories';
    if (url.startsWith('/issues')) return 'issues';
    if (url.startsWith('/checks')) return 'checks';
    if (url.startsWith('/settings')) return 'settings';
    if (url.startsWith('/docs')) return 'docs';
    return 'overview';
  })();

  const navItems = [
    { key: 'overview', href: '/', label: 'Overview', icon: LayoutGrid },
    { key: 'repositories', href: '/repositories', label: 'Repositories', icon: GitPullRequest },
    { key: 'issues', href: '/issues', label: 'Issues', icon: ClipboardList },
    { key: 'checks', href: '/checks', label: 'Checks', icon: CheckCircle2 },
    { key: 'settings', href: '/settings', label: 'Settings', icon: Settings },
    { key: 'docs', href: '/docs', label: 'Docs', icon: BookOpen },
  ];

  // Close notifications tray on outside click or escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (trayRef.current && !trayRef.current.contains(event.target as Node)) {
        setIsTrayOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsTrayOpen(false);
      }
    }
    if (isTrayOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTrayOpen]);

  const handleClearNotifications = () => {
    router.post('/notifications/clear', {}, {
      preserveScroll: true,
      onSuccess: () => setIsTrayOpen(false),
    });
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatNotificationMessage = (msg: string) => {
    // Shorten long SHA-256 strings in notifications so they don't break layout
    return msg.replace(/\b([a-f0-9]{12})[a-f0-9]{52}\b/g, '$1…');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 text-slate-800 antialiased font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-3">
            {/* Brand Logo */}
            <div className="flex items-center gap-4 shrink-0">
              <Link
                href="/"
                className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded-lg"
              >
                <span className="w-7 h-7 rounded-md bg-violet-700 flex items-center justify-center text-white font-bold text-xs tracking-tight shadow-xs group-hover:bg-violet-800 transition">
                  P
                </span>
                <span className="font-bold text-slate-900 tracking-tight text-sm">
                  ProofPatch
                </span>
              </Link>
            </div>

            {/* Navigation Links */}
            <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isCurrent = currentNav === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 whitespace-nowrap ${
                      isCurrent
                        ? 'bg-violet-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Header Actions: Notifications */}
            <div className="flex items-center gap-2 relative">
              {/* Notifications Tray Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTrayOpen(!isTrayOpen)}
                  aria-label="View notifications"
                  className={`p-2 rounded-md border text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${
                    isTrayOpen ? 'bg-slate-100 border-slate-300' : 'border-slate-200 bg-white'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>

                {/* Notifications Tray Dropdown */}
                {isTrayOpen && (
                  <div
                    ref={trayRef}
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-violet-700" />
                        <span className="text-xs font-semibold text-slate-900">Notifications</span>
                        <span className="text-[10px] text-slate-400 font-mono">({notifications.length})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearNotifications}
                            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 focus-visible:outline-none focus-visible:underline"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear all</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsTrayOpen(false)}
                          className="p-1 rounded text-slate-400 hover:text-slate-600 focus-visible:outline-none"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                          <p className="font-medium text-slate-700">No new notifications</p>
                          <p className="text-[11px] text-slate-400">
                            Workflow events and verifications appear here.
                          </p>
                        </div>
                      ) : (
                        notifications.map((item) => {
                          const Icon =
                            item.type === 'error'
                              ? AlertTriangle
                              : item.type === 'success'
                              ? CheckCircle2
                              : Info;
                          const iconColor =
                            item.type === 'error'
                              ? 'text-rose-500'
                              : item.type === 'success'
                              ? 'text-emerald-500'
                              : 'text-violet-600';

                          return (
                            <div key={item.id} className="p-3 hover:bg-slate-50/70 text-xs space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-medium text-slate-900">
                                  <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
                                  <span>{item.title}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                  {formatTimestamp(item.timestamp)}
                                </span>
                              </div>
                              <p className="text-slate-600 pl-5 text-[11px] leading-relaxed break-words font-mono">
                                {formatNotificationMessage(item.message)}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Clean Global Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-3.5">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-slate-600">
            <span>© 2026 ProofPatch</span>
            <span className="text-slate-300">·</span>
            <a
              href="https://github.com/prateekbhujel"
              target="_blank"
              rel="noreferrer"
              className="text-slate-600 hover:text-slate-900 font-medium transition"
            >
              by Pratik Bhujel
            </a>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <Link href="/docs" className="hover:text-slate-800 transition font-medium">
              Docs
            </Link>
            <span className="text-slate-300">·</span>
            <a
              href="https://github.com/prateekbhujel/proofPatch"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-800 transition font-medium"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
