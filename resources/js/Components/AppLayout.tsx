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
  ChevronLeft,
  ChevronRight,
  LogOut,
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    <div className="min-h-screen flex bg-[#0f0f13] text-slate-200 antialiased font-sans">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 220 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r border-white/[0.06] bg-[#13131a]/95 backdrop-blur-xl"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/[0.06] shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ rotate: 8 }}
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/20"
            >
              P
            </motion.div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-bold text-sm text-white tracking-tight whitespace-nowrap overflow-hidden"
                >
                  ProofPatcher
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isCurrent = currentNav === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
                  isCurrent
                    ? 'bg-violet-500/10 text-violet-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {/* Active indicator bar */}
                {isCurrent && (
                  <motion.div
                    layoutId="activeNavIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-500"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className={`w-[18px] h-[18px] shrink-0 ${isCurrent ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <AnimatePresence>
                  {!sidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar collapse toggle */}
        <div className="px-2 pb-3 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main content area */}
      <div
        className="flex-1 flex flex-col"
        style={{ marginLeft: sidebarCollapsed ? 64 : 220, transition: 'margin-left 0.3s ease' }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-40 h-14 bg-[#13131a]/80 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-6">
          <div />

          {/* Right actions */}
          <div className="flex items-center gap-3 relative">
            {/* Notifications */}
            <div className="relative" ref={trayRef}>
              <button
                type="button"
                onClick={() => setIsTrayOpen(!isTrayOpen)}
                aria-label="View notifications"
                className={`p-2 rounded-lg border transition ${
                  isTrayOpen
                    ? 'bg-white/10 border-white/10 text-white'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-violet-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                  >
                    {notifications.length > 9 ? '9+' : notifications.length}
                  </motion.span>
                )}
              </button>

              {/* Notifications dropdown */}
              <AnimatePresence>
                {isTrayOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#1a1a24] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
                  >
                    <div className="px-4 py-3 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-xs font-semibold text-white">Notifications</span>
                        <span className="text-[10px] text-slate-500 font-mono">({notifications.length})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearNotifications}
                            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear
                          </button>
                        )}
                        <button type="button" onClick={() => setIsTrayOpen(false)} className="p-1 rounded text-slate-500 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                          <p className="font-medium text-slate-400">No new notifications</p>
                          <p className="text-[11px]">Workflow events appear here.</p>
                        </div>
                      ) : (
                        notifications.map((item) => {
                          const Icon = item.type === 'error' ? AlertTriangle : item.type === 'success' ? CheckCircle2 : Info;
                          const iconColor = item.type === 'error' ? 'text-rose-400' : item.type === 'success' ? 'text-emerald-400' : 'text-violet-400';
                          return (
                            <div key={item.id} className="p-3 hover:bg-white/[0.03] text-xs space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 font-medium text-white">
                                  <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
                                  <span>{item.title}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatTimestamp(item.timestamp)}</span>
                              </div>
                              <p className="text-slate-400 pl-5 text-[11px] leading-relaxed break-words font-mono">
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
        </header>

        {/* Page content */}
        <main className="flex-1 bg-[#0f0f13]">
          <div className="max-w-[1400px] w-full mx-auto px-6 py-6">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/[0.06] bg-[#13131a]/50 py-3.5">
          <div className="max-w-[1400px] w-full mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>© 2026 ProofPatcher</span>
              <span className="text-slate-700">·</span>
              <a href="https://github.com/prateekbhujel" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition font-medium">
                by Pratik Bhujel
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/docs" className="hover:text-slate-300 transition font-medium">Docs</Link>
              <span className="text-slate-700">·</span>
              <a href="https://github.com/prateekbhujel/proofPatch" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition font-medium">
                GitHub
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
