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
    <div className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 px-6 py-3.5">
      <form onSubmit={onSaveDraft} className="w-full">
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-2xs space-y-2">
          <label htmlFor="review-draft-note" className="sr-only">
            Review note
          </label>
          <input
            id="review-draft-note"
            type="text"
            value={draftValue}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Record a local review note or observation for this task…"
            className="w-full text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 bg-transparent focus:outline-none"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                <MessageSquare className="w-3 h-3 text-slate-500" />
                Local session note
              </span>
              <VoiceDictationButton
                label="Voice"
                onTranscript={(transcript) => {
                  const current = draftValue.trim();
                  onDraftChange(current ? `${current} ${transcript}` : transcript);
                }}
              />
              {draft && (
                <span className="font-mono text-[10px] text-slate-500">
                  Saved {draft.savedAt.replace('T', ' ').slice(0, 16)}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[11px] font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-40"
            >
              <span>{isSaving ? 'Saving…' : 'Save note'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
