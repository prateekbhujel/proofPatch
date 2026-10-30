import React from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { CheckCircle2, XCircle, Shield, Loader2 } from 'lucide-react';

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
  initial: { opacity: 0, scale: 0.8, y: 10 },
  animate: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: i * 0.12, type: 'spring' as const, stiffness: 300, damping: 20 },
  }),
};

function GateCard({ gate, index, isRunning }: { gate: GateStatus; index: number; isRunning: boolean }) {
  return (
    <motion.div
      custom={index}
      variants={gateVariants}
      initial="initial"
      animate="animate"
      className={`relative rounded-xl border p-3 space-y-1.5 transition-all duration-300 ${
        gate.passed
          ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
          : 'border-rose-200 bg-gradient-to-br from-rose-50 to-white'
      }`}
    >
      {/* Connection line between gates */}
      {index < 4 && (
        <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 w-4 h-px bg-slate-200" />
      )}

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Gate {index + 1}
        </span>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.12 + 0.3, type: 'spring' }}
        >
          {gate.passed ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-500" />
          )}
        </motion.div>
      </div>

      <p className="text-xs font-semibold text-slate-900">{gate.shortLabel}</p>
      <p className="text-[10px] text-slate-500 leading-relaxed">{gate.detail}</p>

      {/* Shimmer when running */}
      {isRunning && (
        <motion.div
          className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.05), transparent)',
              backgroundSize: '200% 100%',
            }}
            animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

export function VerificationPipeline({ isRunning, gates, decision, isSimulated }: VerificationPipelineProps) {
  return (
    <div className="space-y-4">
      {/* Decision banner */}
      <AnimatePresence>
        {decision && !isRunning && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div
              className={`rounded-2xl border p-4 flex items-center justify-between ${
                decision === 'VERIFIED'
                  ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50'
                  : decision === 'FAILED'
                  ? 'border-rose-200 bg-gradient-to-r from-rose-50 via-white to-rose-50'
                  : 'border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                >
                  {decision === 'VERIFIED' ? (
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-200">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                  ) : decision === 'FAILED' ? (
                    <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-200">
                      <XCircle className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-200">
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                  )}
                </motion.div>
                <div>
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-sm font-bold text-slate-900"
                  >
                    {decision === 'VERIFIED'
                      ? isSimulated !== false
                        ? 'Local Fixture Passed'
                        : 'Verification Passed'
                      : decision === 'FAILED'
                      ? 'Verification Failed'
                      : 'Inconclusive'}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-xs text-slate-500"
                  >
                    {decision === 'VERIFIED'
                      ? 'All 5 gates passed successfully'
                      : 'One or more verification gates failed'}
                  </motion.p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Running state */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-50/60 to-indigo-50/40 p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Running 5-Gate Verification Pipeline</p>
                <p className="text-xs text-slate-500">Executing baseline, negative control, and candidate tests…</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gates grid */}
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
