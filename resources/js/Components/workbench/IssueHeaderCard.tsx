import React from 'react';
import { ExternalLink } from 'lucide-react';
import { IssueContext } from './types';

interface IssueMedia {
  alt: string;
  url: string;
  isGif: boolean;
}

interface IssueHeaderCardProps {
  context: IssueContext;
  isDedicatedTestRepo: boolean;
  isOwnedFixture: boolean;
  detectedIssueMedia: IssueMedia[];
}

export function IssueHeaderCard({
  context,
  isDedicatedTestRepo,
  isOwnedFixture,
  detectedIssueMedia,
}: IssueHeaderCardProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {isDedicatedTestRepo
            ? 'Dedicated Test Repository'
            : isOwnedFixture || context.isSynthetic
            ? 'Bundled Fixture'
            : 'Public GitHub Issue'}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-violet-50 dark:bg-violet-950/50 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
          {detectedIssueMedia.length > 0
            ? `${detectedIssueMedia.length} Visual Media / GIF Detected`
            : 'Text-Only Issue · 0 External Media'}
        </span>
        {context.issueUrl && (
          <a
            href={context.issueUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono text-violet-700 dark:text-violet-400 hover:underline inline-flex items-center gap-1"
          >
            <span>
              {context.repository}#{context.issueNumber}
            </span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
        {context.title}
      </h1>

      <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50/80 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
        {context.body || '(No description)'}
      </p>

      {detectedIssueMedia.length > 0 && (
        <div className="rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/30 dark:bg-violet-950/20 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-violet-900 dark:text-violet-200 flex items-center justify-between">
            <span>Issue Visual Reproduction Media ({detectedIssueMedia.length})</span>
            <span className="font-normal text-slate-500">Previewed locally · only text is sent to Muse</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {detectedIssueMedia.map((media, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 space-y-1">
                <div className="text-[10px] font-mono text-slate-500 truncate">
                  {media.isGif ? '[GIF] ' : '[IMG] '}
                  {media.alt}
                </div>
                <a
                  href={media.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-violet-700 dark:text-violet-400 hover:underline truncate block"
                >
                  {media.url}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
        <summary className="cursor-pointer font-medium text-slate-800 dark:text-slate-200 flex items-center justify-between">
          <span className="font-mono">{context.path}</span>
          <span className="font-mono text-[11px] text-slate-400">
            SHA-256: {context.sourceSha256.slice(0, 12)}…
          </span>
        </summary>
        <pre className="mt-2.5 max-h-52 overflow-auto whitespace-pre rounded-lg bg-slate-50 dark:bg-slate-950 p-3 text-xs font-mono text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
          {context.source}
        </pre>
      </details>
    </div>
  );
}
