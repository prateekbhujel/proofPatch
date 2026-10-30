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
  Menu,
  Key,
  FolderGit2,
  LogOut,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { PfLogo } from './ui/PfLogo';

interface NotificationItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  link?: string;
  read?: boolean;
}

interface GitHubUser {
  login: string;
  name?: string | null;
  avatarUrl?: string | null;
  htmlUrl?: string;
}

interface GitHubConnectionData {
  isConfigured?: boolean;
  clientId?: string | null;
  isConnected?: boolean;
  user?: GitHubUser | null;
  repositories?: Array<{ fullName: string; isPrivate?: boolean }>;
  selectedRepo?: string | null;
  deviceFlow?: {
    userCode: string;
    verificationUri: string;
    expiresAt: number;
    interval: number;
  } | null;
}

interface AppLayoutProps {
  title?: string;
  activeNav?: 'overview' | 'repositories' | 'pulls' | 'checks' | 'issues' | 'settings' | 'docs';
  children: ReactNode;
}

export function AppLayout({ activeNav, children }: AppLayoutProps) {
  const { url, props } = usePage();
  const notifications: NotificationItem[] = ((props as any).notifications as NotificationItem[]) || [];
  const githubConnection: GitHubConnectionData | null = ((props as any).githubConnection as GitHubConnectionData) || null;

  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    { key: 'issues', href: '/issues', label: 'Issues & Tasks', icon: ClipboardList },
    { key: 'repositories', href: '/repositories', label: 'Pull Requests', icon: GitPullRequest },
    { key: 'overview', href: '/', label: 'Overview', icon: LayoutGrid },
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
      if (event.key === 'Escape') {
        setIsTrayOpen(false);
        setMobileMenuOpen(false);
      }
    }
    if (isTrayOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTrayOpen]);

  const handleClearNotifications = () => {
    router.post(
      '/notifications/clear',
      {},
      {
        preserveScroll: true,
        onSuccess: () => setIsTrayOpen(false),
      }
    );
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

  const isConnected = Boolean(githubConnection?.isConnected && githubConnection.user);
  const activeUser = githubConnection?.user || null;
  const selectedRepo = githubConnection?.selectedRepo || githubConnection?.repositories?.[0]?.fullName || null;

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full p-3.5 space-y-4">
      {/* Top Brand & Workspace Header */}
      <div className="space-y-3">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 transition"
        >
          <PfLogo size={28} />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-slate-900 dark:text-slate-100 tracking-tight text-sm leading-tight flex items-center gap-1.5">
              <span>ProofPatcher</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Co-Maintainer
            </span>
          </div>
        </Link>

        {/* Global Shortcut & Search Hint */}
        <div className="px-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 rounded-lg px-2.5 py-1.5 shadow-2xs font-mono">
            <span>Shortcut focus</span>
            <kbd className="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[10px] text-slate-700 dark:text-slate-300 font-semibold">
              /
            </kbd>
          </div>
        </div>

        {/* Primary Application Navigation */}
        <nav aria-label="Application" className="space-y-0.5 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isCurrent = currentNav === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${
                  isCurrent
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-2xs border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isCurrent
                        ? 'text-violet-700 dark:text-violet-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Middle/Bottom Utilities: Theme & Activity */}
      <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
        {/* Activity & Notifications Button */}
        <div className="relative" ref={trayRef}>
          <button
            type="button"
            onClick={() => setIsTrayOpen(!isTrayOpen)}
            aria-label="View notifications and session activity"
            aria-expanded={isTrayOpen}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${
              isTrayOpen
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700'
                : 'bg-white/60 dark:bg-slate-900/60 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Activity</span>
            </span>
            {notifications.length > 0 ? (
              <span className="bg-violet-700 text-white text-[10px] font-bold rounded-full px-1.5 py-0.2">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">0</span>
            )}
          </button>

          {/* Notifications Dropdown Drawer */}
          <AnimatePresence>
            {isTrayOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                className="fixed md:left-64 bottom-14 left-4 right-4 md:right-auto md:ml-3 md:w-96 bg-white dark:bg-[#141821] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden"
              >
                <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-violet-700 dark:text-violet-400" />
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Activity</span>
                    <span className="text-[10px] text-slate-500 font-mono">({notifications.length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearNotifications}
                        className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsTrayOpen(false)}
                      aria-label="Close activity tray"
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <div className="p-5 text-center text-xs text-slate-500 space-y-1">
                      <p className="font-medium text-slate-700 dark:text-slate-300">No recent activity</p>
                      <p className="text-[11px] text-slate-400">
                        Verification runs and session actions appear here.
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
                          : 'text-violet-700 dark:text-violet-400';

                      return (
                        <div key={item.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100 truncate">
                              <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
                              <span className="truncate">{item.title}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                              {formatTimestamp(item.timestamp)}
                            </span>
                          </div>
                          <div className="pl-5 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed break-all font-mono bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                            {formatNotificationMessage(item.message)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme Switcher in Sidebar */}
        <div className="px-1">
          <ThemeToggle compact={false} />
        </div>

        {/* Compact Account Section at Bottom of Sidebar */}
        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
          {isConnected && activeUser ? (
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {activeUser.avatarUrl ? (
                    <img
                      src={activeUser.avatarUrl}
                      alt={`@${activeUser.login}`}
                      className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700 aspect-square shrink-0"
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/60 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {activeUser.login.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      @{activeUser.login}
                    </div>
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                      <span>Connected</span>
                    </div>
                  </div>
                </div>

                <Link
                  href="/settings"
                  title="Configure GitHub Connection in Settings"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <Settings className="w-3.5 h-3.5" />
                </Link>
              </div>

              {selectedRepo && (
                <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-md">
                  <FolderGit2 className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{selectedRepo}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  GitHub not connected
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Connect via Device Flow to review PRs and triage issues.
              </p>
              <Link
                href="/settings"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition"
              >
                <Key className="w-3 h-3" />
                <span>Connect GitHub</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f7f6f2] dark:bg-[#0e1117] text-slate-900 dark:text-slate-100 antialiased font-sans">
      {/* ═══════════════════════ MOBILE HEADER (< md) ═══════════════════════ */}
      <div className="md:hidden sticky top-0 z-40 bg-white dark:bg-[#141821] border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <PfLogo size={24} />
          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">ProofPatcher</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-72 max-w-[85vw] h-full bg-[#f2f0e8] dark:bg-[#141821] shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebarContent}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════ DESKTOP APPLICATION SIDEBAR (>= md) ═══════════════════════ */}
      <aside className="hidden md:flex w-64 shrink-0 bg-[#f2f0e8] dark:bg-[#141821] border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0 flex-col overflow-y-auto z-30">
        {sidebarContent}
      </aside>

      {/* ═══════════════════════ MAIN APPLICATION VIEWPORT ═══════════════════════ */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
