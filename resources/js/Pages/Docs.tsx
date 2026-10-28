import React, { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import { AppLayout } from '../Components/AppLayout';
import {
  Shield,
  FileCode,
  CheckCircle2,
  Terminal,
  Lock,
  Sparkles,
  Layers,
  ArrowRight,
  Cpu,
  Database,
  GitPullRequest,
  Check,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';

export default function Docs() {
  const [activeSection, setActiveSection] = useState<string>('overview');

  const sections = [
    { id: 'overview', title: '1. Overview & Vision', icon: Sparkles },
    { id: 'workflow', title: '2. Co-Maintainer Workflow', icon: GitPullRequest },
    { id: 'verification', title: '3. Falsifiable Verification', icon: CheckCircle2 },
    { id: 'receipts', title: '4. Cryptographic Receipts', icon: Shield },
    { id: 'security', title: '5. Security Boundaries', icon: Lock },
    { id: 'setup', title: '6. Runtime & Configuration', icon: Cpu },
  ] as const;

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140;
      for (const sec of sections) {
        const el = document.getElementById(sec.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sec.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <AppLayout activeNav="docs">
      <Head title="Documentation · ProofPatch" />

      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Docs Header */}
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-violet-100 text-violet-700">
              <BookOpen className="w-4 h-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">ProofPatch Documentation</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Continuous reference guide for autonomous co-maintainer review, falsifiable verification gates, and cryptographic receipts.
          </p>
        </div>

        {/* Layout: Sticky Table of Contents + Continuous Documentation Body */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          {/* Sticky Sidebar Navigation (Table of Contents) */}
          <aside className="md:col-span-1 bg-white rounded-xl border border-slate-200 p-2 shadow-xs sticky top-20 space-y-1">
            <span className="block px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              On This Page
            </span>
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollToSection(sec.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left transition ${
                    isActive
                      ? 'bg-violet-700 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}

            <div className="pt-3 border-t border-slate-100 px-3">
              <Link
                href="/issues"
                className="text-xs text-violet-700 font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>Open Workbench</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </aside>

          {/* Continuous Documentation Stream */}
          <div className="md:col-span-3 space-y-8">
            {/* Section 1: Overview & Vision */}
            <section id="overview" className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs scroll-mt-24">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 uppercase tracking-wide mb-2">
                  Architecture & Purpose
                </div>
                <h2 className="text-lg font-bold text-slate-900">1. Overview & Vision</h2>
                <p className="text-xs text-slate-500 mt-1">
                  ProofPatch is an autonomous AI co-maintainer that transforms raw bug reports into verified, cryptographically signed pull request candidates.
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  Most AI coding tools generate plausible code without verifiable proof. Maintainers are flooded with AI-authored pull requests that look correct but break edge cases or introduce security regressions.
                </p>
                <p>
                  <strong>ProofPatch changes this dynamic by enforcing falsifiable evidence:</strong> before any proposal is considered verified, ProofPatch must independently reproduce the baseline failure, prove its test suite catches trivial negative controls, execute candidate repairs in an isolated runtime, and sign a portable cryptographic receipt.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                  <span className="font-semibold text-slate-900 block">1. Bounded Intake</span>
                  <p className="text-[11px] text-slate-500">Public GitHub issues & PRs are ingested with TOCTOU race detection.</p>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                  <span className="font-semibold text-slate-900 block">2. Muse Co-Maintainer</span>
                  <p className="text-[11px] text-slate-500">Fine-tuned single-file proposals via Baseten Muse Spark Open.</p>
                </div>
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                  <span className="font-semibold text-slate-900 block">3. Signed Receipt</span>
                  <p className="text-[11px] text-slate-500">Canonical SHA-256 manifests anchoring all test logs and diffs.</p>
                </div>
              </div>
            </section>

            {/* Section 2: Workflow */}
            <section id="workflow" className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs scroll-mt-24">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 uppercase tracking-wide mb-2">
                  Maintainer Lifecycle
                </div>
                <h2 className="text-lg font-bold text-slate-900">2. Co-Maintainer Workflow</h2>
                <p className="text-xs text-slate-500 mt-1">
                  End-to-end lifecycle from ticket intake to proposal, verification, and review note.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Ticket Intake & Target File Binding</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Supply a public GitHub issue URL and target file path (or click "Load Owned Synthetic Case"). ProofPatch verifies public visibility and computes cryptographic SHA-256 hashes of the untouched source.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Payload Inspection & User Approval</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      You inspect the exact JSON payload and destination (<code className="font-mono text-slate-800">https://inference.baseten.co/v1/chat/completions</code>). No model requests are sent until you explicitly check the approval box.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Muse Proposal & In-Memory Candidate</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Muse Spark Open returns a concise single-file find-and-replace pair. ProofPatch applies this in memory only to produce an in-memory preview without modifying files on disk.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    4
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Falsifiable Automated Verification</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      ProofPatch executes the 5-gate verifier: static AST safety check, baseline reproduction (Exit 1), negative control guard (Exit 1), candidate test execution (Exit 0), and receipt generation.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    5
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900">Local Review Draft & Audit Trail</h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Maintainers record local observations and review feedback. Draft notes are stored locally in your active session with zero unwanted remote GitHub comments or mutations.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/issues"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800 transition shadow-xs"
                >
                  <span>Try Issues Workbench</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </section>

            {/* Section 3: Falsifiable Verification */}
            <section id="verification" className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs scroll-mt-24">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 uppercase tracking-wide mb-2">
                  5-Gate Rigor
                </div>
                <h2 className="text-lg font-bold text-slate-900">3. Falsifiable Verification Architecture</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Why passing tests alone is insufficient: the ProofPatch 5-gate proof structure.
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  In traditional automated test runners, a candidate is considered working if the test suite returns exit code 0. However, in AI repair, this frequently leads to <em>false positives</em>: tests that were never failing in the first place, or mock suites that trivially pass because assertions were bypassed.
                </p>
                <p>
                  ProofPatch requires every verification run to pass five distinct gates before granting a <code className="bg-emerald-50 text-emerald-800 px-1 py-0.5 rounded font-mono font-semibold">VERIFIED</code> decision:
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1">
                  <span className="font-semibold text-slate-900">Gate 1: Static AST Safety Guard</span>
                  <p className="text-slate-600 text-[11px]">
                    Statically parses PHP tokens using <code className="font-mono">token_get_all(..., TOKEN_PARSE)</code>. Disallows <code className="font-mono">exec</code>, <code className="font-mono">system</code>, <code className="font-mono">eval</code>, backticks, dynamic includes, and socket/filesystem syscalls before any code can run.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1">
                  <span className="font-semibold text-slate-900">Gate 2: Baseline Failure Reproduction (Exit Code 1)</span>
                  <p className="text-slate-600 text-[11px]">
                    Executes the test suite against the unpatched base fixture. Proves that the bug reported is real and produces expected failure output (e.g. <code className="font-mono">zero quantity: expected 250, got 750</code>).
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1">
                  <span className="font-semibold text-slate-900">Gate 3: Negative Control Guard (Exit Code 1)</span>
                  <p className="text-slate-600 text-[11px]">
                    Substitutes a known dummy shortcut (e.g. <code className="font-mono">return 0;</code>). Verifies that the test suite is capable of catching and rejecting invalid logic (<code className="font-mono">multiple items: expected 330, got 0</code>).
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1">
                  <span className="font-semibold text-slate-900">Gate 4: Candidate Test Execution (Exit Code 0)</span>
                  <p className="text-slate-600 text-[11px]">
                    Runs the patched candidate in an ephemeral scratch environment. Confirms that all test cases pass cleanly without errors.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-1">
                  <span className="font-semibold text-slate-900">Gate 5: Allowlist & Hash Integrity</span>
                  <p className="text-slate-600 text-[11px]">
                    Verifies that protected source files and authoritative test harnesses were not altered during the execution run.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4: Cryptographic Receipts */}
            <section id="receipts" className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs scroll-mt-24">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 uppercase tracking-wide mb-2">
                  Tamper-Proof Audit
                </div>
                <h2 className="text-lg font-bold text-slate-900">4. Cryptographic Receipts</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Portable, tamper-proof proof manifests anchored in SHA-256 canonical JSON.
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <p>
                  Every completed run in ProofPatch outputs a <code className="font-mono text-slate-800">receipt.json</code> file. This receipt acts as an immutable proof of work that anyone can verify independently without trusting the model or the local web server.
                </p>
              </div>

              <div className="bg-slate-900 text-slate-100 rounded-lg p-4 font-mono text-xs space-y-2 overflow-x-auto">
                <span className="text-slate-400 text-[11px] block">// Example Receipt Manifest (proofpatch-receipt-v1)</span>
                <pre className="text-emerald-400">{`{
  "format": "proofpatch-receipt-v1",
  "kind": "owned_backend",
  "runId": "20261028T093732Z-14b9e59886d3",
  "baseCommit": "676e73d674aca9ba711aa10877ffd7287e1f25b3",
  "decision": "VERIFIED",
  "files": {
    "result.json": "8a7c29...",
    "patch.diff": "abcc8d...",
    "baseline/run.log": "68600d...",
    "negative/run.log": "1c3a17...",
    "candidate/run.log": "68538a..."
  },
  "receiptSha256": "3276ff9eaffb7e2365f4d55c7e0cd63c001c1f13aaf7d251a220ff5441f0f8e9"
}`}</pre>
              </div>

              <p className="text-xs text-slate-600">
                Any developer can run <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">php artisan proofpatch:check-receipt &lt;runId&gt;</code> to verify the exact SHA-256 integrity of all associated evidence.
              </p>
            </section>

            {/* Section 5: Security Boundaries */}
            <section id="security" className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs scroll-mt-24">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 uppercase tracking-wide mb-2">
                  Safety Guarantees
                </div>
                <h2 className="text-lg font-bold text-slate-900">5. Security Boundaries & Execution Policies</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Rigorous isolation definitions, static AST AST token filtering, and honest disclosure of microVM sandboxes.
                </p>
              </div>

              <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
                <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/60 text-amber-900 space-y-1">
                  <span className="font-semibold block flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    Core Safety Principle: Worktrees Are NOT Security Sandboxes
                  </span>
                  <p className="text-amber-800 text-[11px] leading-relaxed">
                    ProofPatch never runs arbitrary untrusted PHP candidate code directly on the host machine. Git worktrees and temporary directories isolate file checkouts, but they do not isolate syscalls or prevent malicious payloads from reaching host resources.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                    <span className="font-semibold text-slate-900 block">Current Allowlisted Boundary</span>
                    <p className="text-[11px] text-slate-600">
                      Candidate execution is restricted to known allowlisted fixtures with static AST token analysis, blocking all syscalls, shell access, and network sockets.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1">
                    <span className="font-semibold text-slate-900 block">Future General Backend Boundary</span>
                    <p className="text-[11px] text-slate-600">
                      Full execution of arbitrary untrusted repository code requires containerized microVM sandboxes (e.g. Modal Sandbox or Firecracker). ProofPatch reports this boundary truthfully.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 6: Setup & Runtime */}
            <section id="setup" className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs scroll-mt-24">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-800 uppercase tracking-wide mb-2">
                  Infrastructure
                </div>
                <h2 className="text-lg font-bold text-slate-900">6. Runtime & Configuration</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Local SQLite storage, GitHub App Connection, and sponsor grant management.
                </p>
              </div>

              <div className="space-y-4 text-xs text-slate-700">
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-900">Local SQLite Storage</h3>
                  <p className="text-slate-600">
                    ProofPatch stores metadata, captured PR snapshots, and review drafts in a local SQLite database (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">database/database.sqlite</code>). Private code is never uploaded to external servers.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-900">GitHub App Connection</h3>
                  <p className="text-slate-600">
                    Maintainers connect their GitHub accounts securely using OAuth Device Authorization without sharing credentials or personal access tokens.
                  </p>
                </div>

                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-900">Baseten Muse Spark Open & Budget Guard</h3>
                  <p className="text-slate-600">
                    Model calls are strictly bounded by a local runtime ledger (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">~/.local/share/proofpatch/runtime/runtime-ledger.json</code>). ProofPatch enforces a strict credit limit ($0.50) and max attempt ceiling to guarantee zero unintended charges.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md text-white bg-slate-900 hover:bg-slate-800 transition shadow-xs"
                >
                  <span>Open Settings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
