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

export function IssueHeaderCard({ context, isDedicatedTestRepo, isOwnedFixture, detectedIssueMedia }: IssueHeaderCardProps) {
  const isExample = !isDedicatedTestRepo && (isOwnedFixture || context.isSynthetic);

  return (
    <section aria-label="Issue details" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>{isExample ? 'Example issue' : 'GitHub issue'}</span>
        {context.issueUrl && (
          <a href={context.issueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-700 hover:underline dark:text-violet-300">
            #{context.issueNumber} on GitHub <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </a>
        )}
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{context.title}</h1>
      <div className="max-h-60 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600 dark:text-slate-300" tabIndex={0} aria-label="Issue description">
        {context.body || 'No description provided.'}
      </div>

      {detectedIssueMedia.length > 0 && (
        <details className="text-sm text-slate-600 dark:text-slate-300">
          <summary className="cursor-pointer font-medium">Attachments ({detectedIssueMedia.length})</summary>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Muse cannot read these attachments yet.</p>
          <ul className="mt-2 space-y-1">
            {detectedIssueMedia.map((media, index) => (
              <li key={`${media.url}-${index}`}>
                <a href={media.url} target="_blank" rel="noreferrer" className="break-all text-violet-700 hover:underline dark:text-violet-300">
                  {media.alt || (media.isGif ? 'GIF' : 'Image')}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">View source file</summary>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
          <code className="break-all">{context.path}</code>
          <span className="break-all font-mono">SHA-256: {context.sourceSha256}</span>
        </div>
        <pre className="mt-2 max-h-52 overflow-auto whitespace-pre rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-800 dark:bg-slate-950 dark:text-slate-200">{context.source}</pre>
      </details>
    </section>
  );
}
