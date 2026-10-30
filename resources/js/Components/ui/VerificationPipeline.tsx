import React from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { CheckCircle2, XCircle, Shield, Loader2, Sparkles } from 'lucide-react';

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
            className="overflow-hidden"
          >
            <div
              className={`rounded-xl border p-4 flex items-center justify-between shadow-2xs ${
                decision === 'VERIFIED'
                  ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 via-white to-emerald-50'
                  : decision === 'FAILED'
                  ? 'border-rose-300 bg-gradient-to-r from-rose-50 via-white to-rose-50'
                  : 'border-amber-300 bg-gradient-to-r from-amber-50 via-white to-amber-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
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
                  <h4 className="text-sm font-bold text-slate-900">
                    {decision === 'VERIFIED'
                      ? isSimulated !== false
                        ? 'LOCAL FIXTURE VERIFIED (All 5 Gates Passed)'
                        : 'PROD CANDIDATE VERIFIED (5 Gates Passed)'
                      : decision === 'FAILED'
                      ? 'VERIFICATION REJECTED (Fails Closed)'
                      : 'VERIFICATION INCONCLUSIVE'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {decision === 'VERIFIED'
                      ? 'Baseline reproduction, negative control, candidate tests, AST token rules, and allowlist intact.'
                      : 'The candidate did not pass all falsifiable gates. Execution halted.'}
                  </p>
                </div>
              </div>
            </div>
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
