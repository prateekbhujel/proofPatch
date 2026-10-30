import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { ThemeToggle } from './ThemeToggle';

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
    { key: 'repositories', href: '/repositories', label: 'Pull Requests', icon: GitPullRequest },
    { key: 'issues', href: '/issues', label: 'Issues & Tasks', icon: ClipboardList },
    { key: 'settings', href: '/settings', label: 'Settings', icon: Settings },
    { key: 'docs', href: '/docs', label: 'Docs', icon: BookOpen },
  ];

  // Global keyboard shortcut ('/' focuses primary input when not typing in an input/textarea)
  useEffect(() => {
    function onGlobalKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (!isEditable && event.key === '/') {
        const focusEl =
          document.getElementById('global-search-input') ||
          document.getElementById('local-task-title') ||
          document.querySelector<HTMLInputElement>('input[type="text"], input[type="url"]');
        if (focusEl) {
          event.preventDefault();
          focusEl.focus();
        }
      }
    }
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (trayRef.current && !trayRef.current.contains(event.target as Node)) {
        setIsTrayOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsTrayOpen(false);
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
    return msg.replace(/\b([a-f0-9]{12})[a-f0-9]{52}\b/g, '$1…');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f6f2] dark:bg-[#0e1117] text-slate-900 dark:text-slate-100 antialiased font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#141821] border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 gap-3">
            {/* Brand Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href="/"
                className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 rounded-lg"
              >
                <img
                  src="/icon.svg"
                  alt="ProofPatcher"
                  className="w-7 h-7 rounded-lg shrink-0 aspect-square"
                />
                <span className="font-semibold text-slate-900 dark:text-slate-100 tracking-tight text-sm">
                  ProofPatcher
                </span>
              </Link>
            </div>

            {/* Navigation Links */}
            <nav
              aria-label="Primary"
              className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-1"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isCurrent = currentNav === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 whitespace-nowrap ${
                      isCurrent
                        ? 'bg-violet-50 text-violet-800 border border-violet-200 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-violet-700' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Actions: Theme Switcher, Shortcut Hint & Notifications */}
            <div className="flex items-center gap-2 relative shrink-0">
              <ThemeToggle compact />

              <span
                className="hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-500 font-mono"
                title="Press / anywhere to focus the primary input"
              >
                <span>Press</span>
                <kbd className="px-1 py-0.2 bg-white border border-slate-300 rounded text-[10px] text-slate-700">/</kbd>
                <span>to focus</span>
              </span>

              <div className="relative" ref={trayRef}>
                <button
                  type="button"
                  onClick={() => setIsTrayOpen(!isTrayOpen)}
                  aria-label="View notifications"
                  aria-expanded={isTrayOpen}
                  className={`p-2 rounded-lg border text-slate-600 hover:text-slate-900 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${
                    isTrayOpen ? 'bg-slate-100 border-slate-300' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-violet-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Tray */}
                <AnimatePresence>
                  {isTrayOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
                    >
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-violet-700" />
                          <span className="text-xs font-semibold text-slate-900">Activity</span>
                          <span className="text-[10px] text-slate-500 font-mono">({notifications.length})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {notifications.length > 0 && (
                            <button
                              type="button"
                              onClick={handleClearNotifications}
                              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Clear</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setIsTrayOpen(false)}
                            aria-label="Close notifications"
                            className="p-1 rounded text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                            <p className="font-medium text-slate-700">No recent activity</p>
                            <p className="text-[11px] text-slate-400">
                              Session events and verification runs appear here.
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
                                ? 'text-rose-600'
                                : item.type === 'success'
                                ? 'text-emerald-600'
                                : 'text-violet-700';

                            return (
                              <div key={item.id} className="p-3 hover:bg-slate-50 text-xs space-y-0.5">
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Minimal Global Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-3.5">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-slate-600">
            <img src="/icon.svg" alt="" className="w-4 h-4 rounded-xs aspect-square" />
            <span className="font-medium text-slate-700">ProofPatcher</span>
            <span className="text-slate-300">·</span>
            <span>Local GitHub Co-Maintainer Workbench</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500">
            <Link href="/docs" className="hover:text-slate-800 transition font-medium">
              Documentation
            </Link>
            <span>·</span>
            <Link href="/settings" className="hover:text-slate-800 transition font-medium">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
