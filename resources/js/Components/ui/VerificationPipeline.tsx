import React from 'react';
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

export function VerificationPipeline({ isRunning, gates, decision, isSimulated }: VerificationPipelineProps) {
  if (isRunning) {
    return (
      <div role="status" className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        Running checks…
      </div>
    );
  }

  if (!decision) return null;

  // The decision alone is not enough to claim that every check passed.
  const allGatesPassed = gates?.length === 5 && gates.every((gate) => gate.passed);
  const checksPassed = decision === 'VERIFIED' && allGatesPassed;
  const inconsistent = decision === 'VERIFIED' && !allGatesPassed;
  const heading = checksPassed
    ? 'Fixture checks passed'
    : inconsistent
      ? 'Results need review'
      : decision === 'FAILED'
        ? 'Checks failed'
        : 'Checks inconclusive';
  const description = checksPassed
    ? isSimulated !== false
      ? 'This was a local fixture run; an isolated sandbox was not verified.'
      : 'These results apply to the known fixture.'
    : inconsistent
      ? 'The result and reported checks do not agree.'
      : 'Review the check results and logs below.';

  return (
    <div className="space-y-3">
      <div className={`flex items-start gap-3 rounded-lg border p-4 ${checksPassed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        {checksPassed ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> : <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{heading}</h4>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
      </div>

      {gates && gates.length > 0 && (
        <details className="rounded-lg border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">Check results</summary>
          <ul className="mt-3 divide-y divide-slate-100">
            {gates.map((gate, index) => (
              <li key={`${gate.label}-${index}`} className="flex items-start gap-2 py-2 text-xs">
                {gate.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
                <span><span className="font-medium text-slate-800">{gate.shortLabel}</span><span className="block text-slate-500">{gate.detail}</span></span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
