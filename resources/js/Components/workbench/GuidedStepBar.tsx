import React from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Shield,
  GitPullRequest,
} from 'lucide-react';
import { IssueContext, Suggestion, VerificationReport } from './types';

interface GuidedStepBarProps {
  context: IssueContext | null;
  suggestion: Suggestion | null;
  verificationReport: VerificationReport | null;
  hasPublishedPr: boolean;
}

export function GuidedStepBar({
  context,
  suggestion,
  verificationReport,
  hasPublishedPr,
}: GuidedStepBarProps) {
  const isStep1Done = Boolean(context);
  const isStep2Done = Boolean(suggestion);
  const isStep3Done = Boolean(verificationReport && verificationReport.decision === 'VERIFIED');
  const isStep4Done = hasPublishedPr;

  return (
    <div className="mx-6 mt-4 p-2.5 rounded-xl border border-violet-200/80 dark:border-violet-900/60 bg-gradient-to-r from-violet-50/70 via-white to-violet-50/30 dark:from-violet-950/30 dark:via-[#141821] dark:to-violet-950/20 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
            isStep1Done
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>1. Context Loaded</span>
        </span>

        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
            isStep2Done
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold'
              : isStep1Done
                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 font-semibold animate-pulse'
                : 'text-slate-400'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>2. Single-Use Approval</span>
        </span>

        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
            isStep3Done
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold'
              : isStep2Done
                ? 'bg-violet-100 text-violet-900 dark:bg-violet-950/80 dark:text-violet-200 font-semibold'
                : 'text-slate-400'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>3. 5-Gate Verifier</span>
        </span>

        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />

        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition ${
            isStep4Done
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-semibold'
              : 'text-slate-400'
          }`}
        >
          <GitPullRequest className="w-3.5 h-3.5" />
          <span>4. Receipt &amp; PR Response</span>
        </span>
      </div>

      <div className="text-[11px] font-mono text-violet-700 dark:text-violet-300">
        {!isStep2Done && 'Next: Click "Allow once" below ↓'}
        {isStep2Done && !isStep3Done && 'Next: Click "Run verifier" below ↓'}
        {isStep3Done && !isStep4Done && 'Next: Copy bot receipt or publish draft PR ↓'}
        {isStep4Done && '✓ Workflow Complete! Draft PR Published'}
      </div>
    </div>
  );
}
