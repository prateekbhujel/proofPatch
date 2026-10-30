import React from 'react';

interface PrOverviewTabProps {
  filesCount: number;
  totalAdditions: number;
  totalDeletions: number;
  checksCount: number;
  passedChecks: number;
}

export function PrOverviewTab({
  filesCount,
  totalAdditions,
  totalDeletions,
  checksCount,
  passedChecks,
}: PrOverviewTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-2">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Changed Files</div>
        <div className="text-2xl font-bold text-slate-900">{filesCount}</div>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <span className="text-emerald-600 font-mono font-medium">+{totalAdditions}</span>
          <span className="text-slate-300">/</span>
          <span className="text-rose-600 font-mono font-medium">-{totalDeletions}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-2">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">CI Status</div>
        <div className="text-2xl font-bold text-slate-900">
          {checksCount === 0 ? 'No Checks' : `${passedChecks}/${checksCount} Passed`}
        </div>
        <div className="text-xs text-slate-500">Observed from GitHub Check Runs</div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-2">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Verification Scope</div>
        <div className="text-sm font-semibold text-slate-900">Local Fixture Engine Only</div>
        <div className="text-xs text-slate-500">
          Panther verifies bundled checkout fixtures in Checks; external PRs are read-only reviews.
        </div>
      </div>
    </div>
  );
}
