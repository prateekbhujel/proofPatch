import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

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
  hidden: { backgroundPosition: '200% 0' },
  visible: {
    backgroundPosition: '-200% 0',
    transition: { duration: 2, repeat: Infinity, ease: 'linear' as const },
  },
};

function PulseOrb({ delay = 0, color = '#8b5cf6' }: { delay?: number; color?: string }) {
  return (
    <motion.div
      className="absolute rounded-full"
      style={{
        width: 6,
        height: 6,
        background: color,
        filter: `blur(1px) drop-shadow(0 0 4px ${color})`,
      }}
      animate={{
        scale: [1, 1.8, 1],
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.4,
        repeat: Infinity,
        delay,
        ease: 'easeInOut',
      }}
    />
  );
}

function StreamingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-violet-400"
          animate={{
            y: [0, -4, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export function ThinkingAnimation({ isActive, steps, title = 'Processing', subtitle }: ThinkingAnimationProps) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      setElapsed(0);
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
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
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="overflow-hidden"
        >
          <div className="relative rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/60 p-5 space-y-4 overflow-hidden">
            {/* Animated background shimmer */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.04) 25%, rgba(139,92,246,0.08) 50%, rgba(139,92,246,0.04) 75%, transparent 100%)',
                backgroundSize: '200% 100%',
              }}
              variants={shimmer}
              initial="hidden"
              animate="visible"
            />

            {/* Floating orbs */}
            <div className="absolute top-3 right-4 flex items-center gap-2">
              <PulseOrb delay={0} color="#8b5cf6" />
              <PulseOrb delay={0.4} color="#6366f1" />
              <PulseOrb delay={0.8} color="#a78bfa" />
            </div>

            {/* Header */}
            <div className="relative flex items-center gap-3">
              <div className="relative">
                <motion.div
                  className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </motion.div>
                {/* Ping ring */}
                <motion.div
                  className="absolute inset-0 rounded-lg border-2 border-violet-400"
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{title}</span>
                  <StreamingDots />
                </div>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">{elapsed}s</span>
            </div>

            {/* Steps */}
            <div className="relative space-y-0">
              {steps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.3 }}
                  className="flex items-center gap-3 py-2 relative"
                >
                  {/* Vertical connector line */}
                  {i < steps.length - 1 && (
                    <div className="absolute left-[11px] top-[28px] w-[2px] h-[calc(100%-12px)] bg-slate-200" />
                  )}

                  {/* Status indicator */}
                  <div className="relative z-10 shrink-0">
                    {step.status === 'active' ? (
                      <motion.div
                        className="w-6 h-6 rounded-full bg-violet-100 border-2 border-violet-500 flex items-center justify-center"
                        animate={{ borderColor: ['#8b5cf6', '#6366f1', '#8b5cf6'] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <motion.div
                          className="w-2 h-2 rounded-full bg-violet-500"
                          animate={{ scale: [1, 1.4, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      </motion.div>
                    ) : step.status === 'done' ? (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
                      >
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </motion.div>
                    ) : step.status === 'error' ? (
                      <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-slate-300" />
                    )}
                  </div>

                  <span
                    className={`text-xs font-medium ${
                      step.status === 'active'
                        ? 'text-violet-900'
                        : step.status === 'done'
                        ? 'text-emerald-700'
                        : step.status === 'error'
                        ? 'text-rose-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>

                  {step.status === 'active' && (
                    <motion.div
                      className="ml-auto h-1 w-16 rounded-full bg-violet-100 overflow-hidden"
                    >
                      <motion.div
                        className="h-full bg-gradient-to-r from-violet-400 to-indigo-500 rounded-full"
                        animate={{ width: ['0%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
