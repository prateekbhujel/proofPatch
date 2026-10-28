import React, { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import { VisualComparisonViewer } from '../Components/VisualComparisonViewer';
import {
  Code2,
  ImageIcon,
  ShieldCheck,
  History,
  Play,
  Sparkles,
  Check,
  X,
  Copy,
  Search,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';

interface GateRecord {
  baselineReproduced?: boolean;
  protectedTestsPassed?: boolean;
  outsideMaskPreserved?: boolean;
  authorityIntact?: boolean;
}

interface ReportData {
  id: string;
  decision: string;
  baseCommit?: string;
  gates: GateRecord;
  proposal?: {
    file: string;
  };
  visual?: {
    outsideChangedPixels: number;
  };
}

interface ReceiptData {
  sha256: string;
  externallyAnchored: boolean;
}

interface BudgetStatus {
  reservedMicros: number;
  limitMicros: number;
  attempts: number;
  maxAttempts: number;
  canRequest: boolean;
}

interface HistoryItem {
  id: string;
  decision: string;
  kind?: string;
  hasVisual?: boolean;
  proposal?: {
    file: string;
  };
}

interface ChecksProps {
  runId: string;
  fixture: string;
  report?: ReportData | null;
  receipt?: ReceiptData | null;
  receiptError?: string | null;
  history: Record<string, HistoryItem>;
  budgetStatus?: BudgetStatus | null;
  baselineReady: boolean;
  proposal?: any;
  hasVisual?: boolean;
  latestVisualRunId?: string | null;
  error?: string | null;
}

export default function Checks({
  runId,
  fixture = 'public/fixtures/checkout.html',
  report = null,
  receipt = null,
  receiptError = null,
  history = {},
  budgetStatus = null,
  baselineReady = false,
  proposal = null,
  hasVisual = false,
  latestVisualRunId = null,
  error = null,
}: ChecksProps) {
  const [activeTab, setActiveTab] = useState<'workspace' | 'visual' | 'evidence' | 'history'>(() => {
    if (typeof window !== 'undefined') {
      const paramTab = new URLSearchParams(window.location.search).get('tab');
      if (paramTab === 'visual' || paramTab === 'evidence' || paramTab === 'history') {
        return paramTab;
      }
    }
    return 'workspace';
  });
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 8;

  const { data, setData, post, processing } = useForm({
    action: 'verify',
    fixture: fixture,
    find: proposal?.patch?.find || 'pointer-events: auto;',
    replace: proposal?.patch?.replace || 'pointer-events: none;',
    source_run: runId,
  });

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    data.action = 'verify';
    post('/checks');
  };

  const handlePropose = (e: React.FormEvent) => {
    e.preventDefault();
    data.action = 'propose';
    post('/checks');
  };

  const copyReceipt = () => {
    if (receipt?.sha256) {
      navigator.clipboard.writeText(receipt.sha256);
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 1500);
    }
  };

  const gatesList = [
    { key: 'baselineReproduced', label: 'Bug reproduced' },
    { key: 'protectedTestsPassed', label: 'Protected checks' },
    { key: 'outsideMaskPreserved', label: 'Visual guard' },
    { key: 'authorityIntact', label: 'Checks unchanged' },
  ];

  const historyList = Object.entries(history).map(([id, item]) => ({ ...item, id }));
  const filteredHistory = historyList.filter(
    (h) =>
      h.id.toLowerCase().includes(historyQuery.toLowerCase().trim()) ||
      h.decision.toLowerCase().includes(historyQuery.toLowerCase().trim())
  );
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedHistory = filteredHistory.slice((safeHistoryPage - 1) * historyPageSize, safeHistoryPage * historyPageSize);

  const decision = report?.decision || 'READY';

  return (
    <AppLayout activeNav="checks">
      <Head title="Verification Workspace" />

      <div className="space-y-6">
        {/* Workspace Context Hero */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Checks</span>
                <span>/</span>
                <span className="font-semibold text-slate-900">
                  {fixture.includes('occlusion-b') ? 'Lumen Checkout' : fixture.includes('modal-overflow') ? 'Aura Checkout' : 'Northline Checkout'}
                </span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Visual Layout Verification</h1>
              <p className="text-xs text-slate-500">
                4-gate verification suite for bundled CSS fixtures with headless Chromium probes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold ${
                  decision === 'VERIFIED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : decision === 'FAILED'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : decision === 'INCONCLUSIVE'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    decision === 'VERIFIED'
                      ? 'bg-emerald-500'
                      : decision === 'FAILED'
                      ? 'bg-rose-500'
                      : decision === 'INCONCLUSIVE'
                      ? 'bg-amber-500'
                      : 'bg-slate-400'
                  }`}
                />
                {decision}
              </span>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div role="alert" className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            {error}
          </div>
        )}

        {/* Tab Bar */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-6 sm:space-x-8 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'workspace'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Workspace & Patch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'visual'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Visual Comparison</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('evidence')}
              className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'evidence'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>4-Gate Evidence & Receipt</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-2.5 px-1 border-b-2 text-xs inline-flex items-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'history'
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Run History</span>
              <span className="ml-1 bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[10px] font-semibold">
                {historyList.length}
              </span>
            </button>
          </nav>
        </div>

        {/* TAB PANE 1: WORKSPACE & PATCH */}
        {activeTab === 'workspace' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Candidate CSS Patch
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  {proposal ? 'MUSE SUGGESTION' : 'MANUAL PATCH'}
                </span>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label htmlFor="fixture" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Target Fixture
                  </label>
                  <div className="relative">
                    <select
                      id="fixture"
                      value={data.fixture}
                      onChange={(e) => {
                        const fix = e.target.value;
                        setData('fixture', fix);
                        if (fix === 'public/fixtures/modal-overflow.html') {
                          setData((d) => ({ ...d, fixture: fix, find: 'max-height: 0px;', replace: 'max-height: 60px;' }));
                        } else {
                          setData((d) => ({ ...d, fixture: fix, find: 'pointer-events: auto;', replace: 'pointer-events: none;' }));
                        }
                      }}
                      className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent shadow-2xs transition cursor-pointer"
                    >
                      <option value="public/fixtures/checkout.html">Northline Checkout (Stacking Context Trap)</option>
                      <option value="public/fixtures/occlusion-b.html">Lumen Checkout (Pseudo-element Occlusion)</option>
                      <option value="public/fixtures/modal-overflow.html">Aura Checkout (Responsive Modal Overflow)</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="find" className="block text-xs font-medium text-slate-700 mb-1">
                    Find Existing CSS
                  </label>
                  <textarea
                    id="find"
                    rows={3}
                    required
                    spellCheck={false}
                    value={data.find}
                    onChange={(e) => setData('find', e.target.value)}
                    className="w-full rounded-md border border-slate-300 p-2.5 font-mono text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs"
                  />
                </div>

                <div>
                  <label htmlFor="replace" className="block text-xs font-medium text-slate-700 mb-1">
                    Replace With Candidate CSS
                  </label>
                  <textarea
                    id="replace"
                    rows={3}
                    required
                    spellCheck={false}
                    value={data.replace}
                    onChange={(e) => setData('replace', e.target.value)}
                    className="w-full rounded-md border border-slate-300 p-2.5 font-mono text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 shadow-2xs"
                  />
                  <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-500">
                    <span className="font-medium">Presets:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (data.fixture === 'public/fixtures/modal-overflow.html') {
                          setData((d) => ({ ...d, find: 'max-height: 0px;', replace: 'max-height: 60px;' }));
                        } else {
                          setData((d) => ({ ...d, find: 'pointer-events: auto;', replace: 'pointer-events: none;' }));
                        }
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 hover:bg-slate-200 font-medium border border-slate-200 transition text-[11px]"
                    >
                      Load Valid Repair (4/4 Pass)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setData((d) => ({ ...d, find: '#promo-banner { position: absolute;', replace: '#promo-banner { display: none; position: absolute;' }));
                      }}
                      className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium border border-rose-200 transition text-[11px]"
                    >
                      Load Damaging Shortcut (Fails Guard)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="submit"
                    disabled={processing}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md text-white bg-violet-700 hover:bg-violet-800 shadow-xs transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{processing ? 'Evaluating...' : 'Run Verification'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePropose}
                    disabled={processing || !baselineReady || !(budgetStatus?.canRequest ?? false)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-slate-600" />
                    <span>Generate with Muse</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Model ledger card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Model Ledger
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>

              <div className="space-y-2.5 text-xs text-slate-600">
                {budgetStatus ? (
                  <>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Estimated reservation</span>
                      <span className="font-mono font-semibold text-slate-900">
                        ${(budgetStatus.reservedMicros / 1000000).toFixed(3)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Local reservation limit</span>
                      <span className="font-mono text-slate-900">
                        ${(budgetStatus.limitMicros / 1000000).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500">Attempts</span>
                      <span className="font-medium text-slate-900">
                        {budgetStatus.attempts} / {budgetStatus.maxAttempts}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-500">Ledger inactive (local mock mode).</p>
                )}

                <div className="pt-1.5 text-slate-500 text-[11px] leading-relaxed">
                  This local estimate is not a provider billing limit. Check your provider account for actual usage.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB PANE 2: VISUAL COMPARISON (Interactive Studio) */}
        {activeTab === 'visual' && (
          <div className="space-y-4">
            {hasVisual && report && receipt ? (
              <VisualComparisonViewer
                beforeUrl={`/checks/image?run=${encodeURIComponent(runId)}&image=before`}
                afterUrl={`/checks/image?run=${encodeURIComponent(runId)}&image=after`}
                outsideChangedPixels={report.visual?.outsideChangedPixels || 0}
                runId={runId}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center mx-auto">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {report?.proposal?.file?.endsWith('.php') || (report as any)?.kind === 'owned_backend'
                      ? 'Headless Backend Verification Run'
                      : 'Visual Screenshots Unavailable'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {report?.proposal?.file?.endsWith('.php') || (report as any)?.kind === 'owned_backend'
                      ? `Run ${runId} verified PHP backend logic (${report?.proposal?.file || (report as any)?.targetFile || 'src/OrderTotal.php'}) through test assertions, negative controls, and AST safety. Headless backend tests do not generate browser DOM screenshots.`
                      : `Run ${runId} does not have browser screenshot evidence attached.`}
                  </p>
                </div>

                {latestVisualRunId && (
                  <div className="pt-2">
                    <Link
                      href={`/checks?run=${encodeURIComponent(latestVisualRunId)}&tab=visual`}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-violet-700 hover:bg-violet-800 transition shadow-xs"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>Inspect Latest Visual Checkout Check ({latestVisualRunId.slice(0, 15)}...)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB PANE 3: 4-GATE EVIDENCE & RECEIPT */}
        {activeTab === 'evidence' && (
          <div className="space-y-6">
            {report ? (
              <>
                {/* 4 Gates Grid */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">4 Isolated Worktree Gates</h2>
                      <p className="text-xs text-slate-500">Evaluated independently in ephemeral worktrees.</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-700">{report.decision}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {gatesList.map((g) => {
                      const state = (report.gates as any)[g.key];
                      return (
                        <div
                          key={g.key}
                          className={`p-3.5 rounded-lg border space-y-2 ${
                            state === true
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : state === false
                              ? 'bg-rose-50/40 border-rose-200'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                state === true
                                  ? 'bg-emerald-600 text-white'
                                  : state === false
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-300 text-slate-700'
                              }`}
                            >
                              {state === true ? <Check className="w-3 h-3" /> : state === false ? <X className="w-3 h-3" /> : '–'}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider ${
                                state === true
                                  ? 'text-emerald-700'
                                  : state === false
                                  ? 'text-rose-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {state === true ? 'PASSED' : state === false ? 'FAILED' : 'INCONCLUSIVE'}
                            </span>
                          </div>
                          <div className="font-medium text-xs text-slate-900">{g.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Evidence Receipt */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Evidence Receipt</h2>
                      <p className="text-xs text-slate-500">Deterministic SHA-256 integrity receipt for this run.</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${receipt ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                      {receipt ? 'INTEGRITY PASSED' : 'INTEGRITY UNAVAILABLE'}
                    </span>
                  </div>

                  {receipt ? (
                    <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          SHA-256 Receipt Digest
                        </span>
                        <button
                          type="button"
                          onClick={copyReceipt}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-xs transition"
                        >
                          {copiedReceipt ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                          <span>{copiedReceipt ? 'Copied' : 'Copy Hash'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-xs text-slate-900 bg-white p-2.5 rounded border border-slate-200 break-all select-all">
                        {receipt.sha256}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-0.5">
                        <span>Run: <code className="font-mono text-slate-700">{runId}</code></span>
                        <span>·</span>
                        <span>Anchored: {receipt.externallyAnchored ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  ) : receiptError ? (
                    <div role="alert" className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                      {receiptError}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-10 text-center space-y-2">
                <p className="text-xs text-slate-600">No verification run selected.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB PANE 4: RUN HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Run History</h2>
                <p className="text-xs text-slate-500">{historyList.length} runs recorded</p>
              </div>
              <div className="relative w-full sm:w-60">
                <input
                  type="text"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Filter runs..."
                  className="w-full text-xs rounded-md border border-slate-300 pl-8 pr-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">No matching runs found.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-5">Run Identifier</th>
                        <th className="py-2.5 px-5">Target Fixture</th>
                        <th className="py-2.5 px-5">Decision</th>
                        <th className="py-2.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {paginatedHistory.map((item) => (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/60 transition-colors ${
                            item.id === runId ? 'bg-slate-50 font-medium' : ''
                          }`}
                        >
                          <td className="py-3 px-5 font-mono text-[11px] text-slate-800">{item.id}</td>
                          <td className="py-3 px-5 text-slate-600">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                                {(item.proposal?.file || (item as any).targetFile || 'checkout.html').split('/').pop()}
                              </span>
                              {item.hasVisual ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">
                                  <ImageIcon className="w-2.5 h-2.5" />
                                  <span>Visual UI</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  <span>Backend</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                item.decision === 'VERIFIED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : item.decision === 'FAILED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {item.decision}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right">
                            <Link
                              href={`/checks?run=${encodeURIComponent(item.id)}`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-slate-900 hover:underline"
                            >
                              <span>Inspect</span>
                              <span>→</span>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {historyTotalPages > 1 && (
                  <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/30">
                    <span className="text-[11px] text-slate-500">
                      Showing {(safeHistoryPage - 1) * historyPageSize + 1} to{' '}
                      {Math.min(safeHistoryPage * historyPageSize, filteredHistory.length)} of {filteredHistory.length} runs
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={safeHistoryPage === 1}
                        className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-40 text-xs shadow-2xs"
                      >
                        Prev
                      </button>
                      <span className="text-xs font-medium px-2">
                        Page {safeHistoryPage} of {historyTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                        disabled={safeHistoryPage === historyTotalPages}
                        className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-40 text-xs shadow-2xs"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
