import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Sparkles, Brain, Check, Loader2, Terminal, Code2 } from 'lucide-react';

interface ThinkingStep {
  label: string;
  status: 'waiting' | 'active' | 'done' | 'error';
}

interface ThinkingAnimationProps {
  isActive: boolean;
  steps: ThinkingStep[];
  title?: string;
  subtitle?: string;
}

const shimmer: Variants = {
  hidden: { x: '-100%' },
  visible: {
    x: '100%',
    transition: {
      repeat: Infinity,
      duration: 1.8,
      ease: 'linear' as const,
    },
  },
};

export function ThinkingAnimation({
  isActive,
  steps,
  title = 'AI Thinking & Synthesizing',
  subtitle = 'Analyzing AST, evaluating test invariants, and generating falsifiable repair…',
}: ThinkingAnimationProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => +(prev + 0.1).toFixed(1));
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/90 via-white to-purple-50/70 p-5 shadow-lg shadow-violet-500/5 space-y-4"
        >
          {/* Background Animated Shimmer Wave */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <motion.div
              variants={shimmer}
              initial="hidden"
              animate="visible"
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-violet-300 to-transparent transform -skew-x-12"
            />
          </div>

          {/* Header with Brain/Sparkle Pulse Orb */}
          <div className="flex items-center justify-between gap-3 relative z-10 border-b border-violet-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* Outer Breathing Halo */}
                <span className="absolute -inset-1 rounded-xl bg-violet-400/30 animate-pulse-ring" />
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-500/25">
                  <Brain className="w-5 h-5 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                    {title}
                  </h3>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-600 animate-ping" />
                    STREAMING
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs font-mono font-bold text-violet-700 bg-violet-100/80 px-2.5 py-1 rounded-md border border-violet-200">
                {elapsed.toFixed(1)}s
              </span>
            </div>
          </div>

          {/* Pipeline Step Progress List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 relative z-10">
            {steps.map((step, idx) => {
              const isDone = step.status === 'done';
              const isCurrent = step.status === 'active';

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs font-medium transition-all ${
                    isDone
                      ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                      : isCurrent
                      ? 'border-violet-300 bg-white shadow-xs text-violet-900 ring-1 ring-violet-400'
                      : 'border-slate-200/80 bg-slate-50/50 text-slate-500'
                  }`}
                >
                  <div className="shrink-0">
                    {isDone ? (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-slate-300 bg-white flex items-center justify-center text-[9px] text-slate-400 font-mono">
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <span className="truncate">{step.label}</span>
                </div>
              );
            })}
          </div>

          {/* Interactive Simulated Terminal Bar */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 text-slate-200 p-3 space-y-1.5 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-violet-400" />
                <span>codex-evaluator :: sandboxed-oracle</span>
              </div>
              <span className="text-emerald-400 font-bold">120Hz Real-Time Kinematics</span>
            </div>
            <div className="space-y-0.5 text-[11px] pt-1">
              <div className="text-slate-300 flex items-center gap-2">
                <span className="text-violet-400">❯</span>
                <span className="text-slate-100">ast_parse(source=OrderTotal.php, mode=isolated)</span>
              </div>
              <div className="text-slate-400 flex items-center gap-2">
                <span className="text-violet-400">❯</span>
                <span>evaluating_negative_control: caught early-exit injection</span>
              </div>
              <div className="text-emerald-400 flex items-center gap-2 font-semibold">
                <span className="text-emerald-400">✔</span>
                <span>oracle_token: single_use_bound_digest_verified</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
