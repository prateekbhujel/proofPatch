import React from 'react';
import { MessageSquare } from 'lucide-react';
import { VoiceDictationButton } from '../VoiceDictationButton';
import { Draft } from './types';

interface TaskComposerFooterProps {
  draftValue: string;
  onDraftChange: (value: string) => void;
  onSaveDraft: (e: React.FormEvent) => void;
  isSaving: boolean;
  draft?: Draft | null;
}

export function TaskComposerFooter({
  draftValue,
  onDraftChange,
  onSaveDraft,
  isSaving,
  draft,
}: TaskComposerFooterProps) {
  return (
    <div className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 px-6 py-4">
      <form onSubmit={onSaveDraft} className="mx-auto w-full max-w-5xl">
        <div className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <label htmlFor="review-draft-note" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Maintainer Review Note &amp; Task Context
            </label>
            <span id="review-draft-note-hint" className="text-[11px] font-mono text-slate-400">
              Saved locally · Markdown supported
            </span>
          </div>
          <textarea
            id="review-draft-note"
            name="note"
            aria-describedby="review-draft-note-hint"
            rows={4}
            value={draftValue}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Add maintainer notes, reproduction details, or review observations about this issue…"
            className="w-full h-auto min-h-[104px] max-h-[18rem] [field-sizing:content] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:text-slate-100 resize-y transition"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                <MessageSquare className="w-3 h-3 text-slate-500" aria-hidden="true" />
                Local note
              </span>
              <VoiceDictationButton
                label="Voice"
                onTranscript={(transcript) => {
                  const current = draftValue.trim();
                  onDraftChange(current ? `${current} ${transcript}` : transcript);
                }}
              />
              {draft && (
                <span className="font-mono text-[11px] text-slate-500">
                  Saved {draft.savedAt.replace('T', ' ').slice(0, 16)}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-40 transition"
            >
              <span>{isSaving ? 'Saving…' : 'Save note'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
