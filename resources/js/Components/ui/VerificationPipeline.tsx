import React, { useState } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { CheckCircle2, XCircle, Shield, Loader2, Sparkles, Copy, Check, Play, BadgeCheck, ExternalLink } from 'lucide-react';

interface GateStatus {
  label: string;
  shortLabel: string;
  passed: boolean;
  detail: string;
}

interface VerificationPipelineProps {
  isRunning: boolean;
  gates: GateStatus[] | null;
  decision: 'VERIFIED' | 'FAILED' | 'INCONCLUSIVE' | null;
  isSimulated?: boolean;
}

const gateVariants: Variants = {
  initial: { opacity: 0, scale: 0.9, y: 10 },
  animate: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: i * 0.08, type: 'spring' as const, stiffness: 350, damping: 22 },
  }),
};

function GateCard({ gate, index, isRunning }: { gate: GateStatus; index: number; isRunning: boolean }) {
  return (
    <motion.div
      custom={index}
      variants={gateVariants}
      initial="initial"
      animate="animate"
      className={`relative rounded-xl border p-3 space-y-1.5 transition-all shadow-2xs ${
        gate.passed
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white text-emerald-900'
          : 'border-rose-200 bg-gradient-to-br from-rose-50/70 to-white text-rose-900'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Gate {index + 1}
        </span>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.08 + 0.2, type: 'spring' as const }}
        >
          {gate.passed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-600" />
          )}
        </motion.div>
      </div>

      <p className="text-xs font-bold text-slate-900">{gate.shortLabel}</p>
      <p className="text-[11px] text-slate-600 leading-snug">{gate.detail}</p>
    </motion.div>
  );
}

export function VerificationPipeline({ isRunning, gates, decision, isSimulated }: VerificationPipelineProps) {
  const [copied, setCopied] = useState(false);
  const [showManifest, setShowManifest] = useState(false);

  const proofBadgesMarkdown = `[![ProofPatcher Bot](https://img.shields.io/badge/ProofPatcher_bot-Verified_Co--Maintainer-7c3aed?style=flat-square)](https://github.com/prateekbhujel/proofpatch-workflow-test)
[![Category: Bug Fix](https://img.shields.io/badge/Category-Bug_Fix-0284c7?style=flat-square)](https://github.com/prateekbhujel/proofpatch-workflow-test/issues)
[![5-Gate Isolated Verification](https://img.shields.io/badge/5_Gate_Verification-PASSED-10b981?style=flat-square)](https://github.com/prateekbhujel/proofpatch-workflow-test)
[![Frontier Model: Meta Muse](https://img.shields.io/badge/Frontier_Model-Meta_Muse-f59e0b?style=flat-square)](https://baseten.co)

> [!NOTE]
> 🤖 **ProofPatcher [bot] — Autonomous Frontier Verification & Repair**
> All 5 verification gates passed: Baseline Reproduced, Negative Control Caught, Candidate Tests Passed, AST Token Whitelist Valid, Fixture Allowlist Intact.`;

  const copyProofBadges = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(proofBadgesMarkdown).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Decision Banner */}
      <AnimatePresence>
        {decision && !isRunning && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
            className="overflow-hidden space-y-2.5"
          >
            <div
              className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                decision === 'VERIFIED'
                  ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-emerald-50'
                  : decision === 'FAILED'
                  ? 'border-rose-300 bg-gradient-to-r from-rose-50 via-white to-rose-50'
                  : 'border-amber-300 bg-gradient-to-r from-amber-50 via-white to-amber-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md shrink-0 ${
                    decision === 'VERIFIED'
                      ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                      : decision === 'FAILED'
                      ? 'bg-rose-600 text-white shadow-rose-500/20'
                      : 'bg-amber-600 text-white shadow-amber-500/20'
                  }`}
                >
                  {decision === 'VERIFIED' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : decision === 'FAILED' ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <Shield className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900">
                      {decision === 'VERIFIED'
                        ? isSimulated !== false
                          ? 'LOCAL FIXTURE VERIFIED (All 5 Gates Passed)'
                          : 'PROD CANDIDATE VERIFIED (5 Gates Passed)'
                        : decision === 'FAILED'
                        ? 'VERIFICATION REJECTED (Fails Closed)'
                        : 'VERIFICATION INCONCLUSIVE'}
                    </h4>
                    {decision === 'VERIFIED' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                        <BadgeCheck className="w-3 h-3 text-violet-600" />
                        <span>ProofPatcher [bot]</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {decision === 'VERIFIED'
                      ? 'Baseline reproduction, negative control, candidate tests, AST token rules, and allowlist intact.'
                      : 'The candidate did not pass all falsifiable gates. Execution halted.'}
                  </p>
                </div>
              </div>

              {decision === 'VERIFIED' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={copyProofBadges}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{copied ? 'Copied Badges!' : 'Copy Proof Badges'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManifest(!showManifest)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition"
                  >
                    <span>{showManifest ? 'Hide Proof' : 'View Proof'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Visual Proof Manifest & Badges Preview */}
            {showManifest && decision === 'VERIFIED' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-3.5 text-xs font-mono space-y-2.5"
              >
                <div className="flex items-center justify-between text-slate-400 text-[11px] border-b border-slate-800 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    ProofPatcher Cryptographic Evidence & Badges
                  </span>
                  <span>Markdown Ready</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap py-1">
                  <span className="px-2 py-0.5 rounded bg-violet-900/60 text-violet-300 border border-violet-700/50 text-[10px]">
                    ProofPatcher [bot]: Verified
                  </span>
                  <span className="px-2 py-0.5 rounded bg-sky-900/60 text-sky-300 border border-sky-700/50 text-[10px]">
                    Category: Bug Fix
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 text-[10px]">
                    5-Gate Verification: PASSED
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50 text-[10px]">
                    Frontier Model: Meta Muse
                  </span>
                </div>
                <pre className="text-[11px] text-slate-300 bg-black/40 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {proofBadgesMarkdown}
                </pre>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gates Grid */}
      {gates && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {gates.map((gate, i) => (
            <GateCard key={i} gate={gate} index={i} isRunning={isRunning} />
          ))}
        </div>
      )}
    </div>
  );
}
