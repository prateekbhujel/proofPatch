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
  error = null,
}: ChecksProps) {
  const [activeTab, setActiveTab] = useState<'workspace' | 'visual' | 'evidence' | 'history'>('workspace');
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');

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

  const decision = report?.decision || 'READY';

  return (
    <AppLayout activeNav="checks">
      <Head title="Verification Workspace" />

      <div className="space-y-6">
        {/* Workspace Context Hero */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Verification Workspace</span>
                <span>/</span>
                <span className="font-bold text-slate-900">
                  {fixture.includes('occlusion-b') ? 'Lumen Checkout' : fixture.includes('modal-overflow') ? 'Aura Checkout' : 'Northline Checkout'}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Isolated Worktree Evaluation</h1>
              <p className="text-sm text-slate-500">
                Test UI fixes in isolated worktrees with headless browser probes, visual diffs, and protected checks.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  decision === 'VERIFIED'
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                    : decision === 'FAILED'
                    ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                    : decision === 'INCONCLUSIVE'
                    ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                    : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full mr-1.5 ${
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
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
            {error}
          </div>
        )}

        {/* Tab Bar */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-6 sm:space-x-8">
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                activeTab === 'workspace'
                  ? 'border-violet-600 text-violet-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span>Workspace & Patch</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                activeTab === 'visual'
                  ? 'border-violet-600 text-violet-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>Visual Comparison</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('evidence')}
              className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                activeTab === 'evidence'
                  ? 'border-violet-600 text-violet-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>4-Gate Evidence & Receipt</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-3 px-1 border-b-2 text-sm inline-flex items-center gap-2 transition ${
                activeTab === 'history'
                  ? 'border-violet-600 text-violet-700 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 font-medium'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Run History</span>
              <span className="ml-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                {historyList.length}
              </span>
            </button>
          </nav>
        </div>

        {/* TAB PANE 1: WORKSPACE & PATCH */}
        {activeTab === 'workspace' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Candidate CSS Patch
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                  {proposal ? 'MUSE SUGGESTION' : 'MANUAL PATCH'}
                </span>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label htmlFor="fixture" className="block text-xs font-medium text-slate-700 mb-1">
                    Target Fixture
                  </label>
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-violet-500 shadow-xs"
                  >
                    <option value="public/fixtures/checkout.html">Northline Checkout (Stacking Context Trap)</option>
                    <option value="public/fixtures/occlusion-b.html">Lumen Checkout (Pseudo-element Occlusion)</option>
                    <option value="public/fixtures/modal-overflow.html">Aura Checkout (Responsive Modal Overflow)</option>
                  </select>
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
                    className="w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-violet-500 shadow-xs"
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
                    className="w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-violet-500 shadow-xs"
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
                      className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 hover:bg-violet-100 font-medium border border-violet-200 transition"
                    >
                      Load Valid Repair (4/4 Pass)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setData((d) => ({ ...d, find: '#promo-banner { position: absolute;', replace: '#promo-banner { display: none; position: absolute;' }));
                      }}
                      className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium border border-rose-200 transition"
                    >
                      Load Damaging Shortcut (Fails Guard)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={processing}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg text-white bg-violet-600 hover:bg-violet-700 shadow-xs transition disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    <span>{processing ? 'Evaluating...' : 'Run Verification'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePropose}
                    disabled={processing || !baselineReady || !(budgetStatus?.canRequest ?? false)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition"
                  >
                    <Sparkles className="w-4 h-4 text-violet-600" />
                    <span>Generate with Muse</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Model ledger card */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Model Ledger
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>

              <div className="space-y-3 text-xs text-slate-600">
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

                <div className="pt-2 text-slate-500 text-[11px] leading-relaxed">
                  This local estimate is not a provider billing limit. Check your provider account for actual usage.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB PANE 2: VISUAL COMPARISON (Interactive Studio) */}
        {activeTab === 'visual' && (
          <div className="space-y-4">
            {report && receipt ? (
              <VisualComparisonViewer
                beforeUrl={`/checks/image?run=${encodeURIComponent(runId)}&image=before`}
                afterUrl={`/checks/image?run=${encodeURIComponent(runId)}&image=after`}
                outsideChangedPixels={report.visual?.outsideChangedPixels || 0}
                runId={runId}
              />
            ) : (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-12 text-center space-y-2">
                <p className="text-sm text-slate-600">A run with intact evidence is needed to inspect screenshots.</p>
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
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">4 Isolated Worktree Gates</h2>
                      <p className="text-xs text-slate-500">Evaluated independently in ephemeral worktrees.</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-700">{report.decision}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {gatesList.map((g) => {
                      const state = (report.gates as any)[g.key];
                      return (
                        <div
                          key={g.key}
                          className={`p-4 rounded-xl border space-y-2 ${
                            state === true
                              ? 'bg-emerald-50/40 border-emerald-200/60'
                              : state === false
                              ? 'bg-rose-50/40 border-rose-200/60'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                state === true
                                  ? 'bg-emerald-600 text-white'
                                  : state === false
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-300 text-slate-700'
                              }`}
                            >
                              {state === true ? <Check className="w-3.5 h-3.5" /> : state === false ? <X className="w-3.5 h-3.5" /> : '–'}
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
                          <div className="font-medium text-sm text-slate-900">{g.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Evidence Receipt */}
                <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">Evidence Receipt</h2>
                      <p className="text-xs text-slate-500">Deterministic SHA-256 integrity receipt for this run.</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${receipt ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {receipt ? 'INTEGRITY PASSED' : 'INTEGRITY UNAVAILABLE'}
                    </span>
                  </div>

                  {receipt ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          SHA-256 Receipt Digest
                        </span>
                        <button
                          type="button"
                          onClick={copyReceipt}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-xs transition"
                        >
                          {copiedReceipt ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedReceipt ? 'Copied' : 'Copy Hash'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-xs text-violet-900 bg-white p-3 rounded-lg border border-slate-200 break-all select-all">
                        {receipt.sha256}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-3">
                        <span>Run: <code className="font-mono text-slate-700">{runId}</code></span>
                        <span>·</span>
                        <span>Anchored: {receipt.externallyAnchored ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  ) : receiptError ? (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                      {receiptError}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-12 text-center space-y-2">
                <p className="text-sm text-slate-600">No verification run selected.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB PANE 4: RUN HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Run History</h2>
                <p className="text-xs text-slate-500">{historyList.length} runs recorded</p>
              </div>
              <div className="relative w-full sm:w-64">
                <input
                  type="text"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Filter runs..."
                  className="w-full text-xs rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">No matching runs found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-6">Run Identifier</th>
                      <th className="py-3 px-6">Target Fixture</th>
                      <th className="py-3 px-6">Decision</th>
                      <th className="py-3 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredHistory.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-violet-50/30 transition-colors ${
                          item.id === runId ? 'bg-violet-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-6 font-mono text-xs text-slate-800">{item.id}</td>
                        <td className="py-3 px-6 text-xs text-slate-600">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                            {(item.proposal?.file || 'checkout.html').split('/').pop()}
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              item.decision === 'VERIFIED'
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                : item.decision === 'FAILED'
                                ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/20'
                                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20'
                            }`}
                          >
                            {item.decision}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-right">
                          <Link
                            href={`/checks?run=${encodeURIComponent(item.id)}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700"
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
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
