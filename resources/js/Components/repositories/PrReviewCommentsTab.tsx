import React from 'react';
import { router } from '@inertiajs/react';
import { GitHubConnectionData, CommentDraft } from './types';

interface PrReviewCommentsTabProps {
  drafts: CommentDraft[];
  reviewDecision: 'comment' | 'approve' | 'request_changes';
  setReviewDecision: (decision: 'comment' | 'approve' | 'request_changes') => void;
  commentApprovals: Record<string | number, string>;
  commentToPost: string | null;
  setCommentToPost: (val: string | null) => void;
  postingComment: boolean;
  setPostingComment: (val: boolean) => void;
  commentPosted?: boolean;
  clearDraftsProcessing: boolean;
  handleClearAllDrafts: (e: React.FormEvent) => void;
  githubConnection: GitHubConnectionData | null;
}

export function PrReviewCommentsTab({
  drafts,
  reviewDecision,
  setReviewDecision,
  commentApprovals,
  commentToPost,
  setCommentToPost,
  postingComment,
  setPostingComment,
  commentPosted,
  clearDraftsProcessing,
  handleClearAllDrafts,
  githubConnection,
}: PrReviewCommentsTabProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Review Summary &amp; Drafts</h2>
          <p className="text-xs text-slate-500">
            Review decisions and line drafts stay local until explicitly published.
          </p>
        </div>
        {drafts.length > 0 && (
          <form onSubmit={handleClearAllDrafts}>
            <button
              type="submit"
              disabled={clearDraftsProcessing}
              className="text-[11px] font-medium text-rose-600 hover:text-rose-800 underline disabled:opacity-50"
            >
              Clear All Drafts ({drafts.length})
            </button>
          </form>
        )}
      </div>

      {/* Decision Radio Selector */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="reviewDecision"
            checked={reviewDecision === 'comment'}
            onChange={() => setReviewDecision('comment')}
            className="text-violet-700 focus:ring-violet-600"
          />
          <span>Comment</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="reviewDecision"
            checked={reviewDecision === 'approve'}
            onChange={() => setReviewDecision('approve')}
            className="text-violet-700 focus:ring-violet-600"
          />
          <span>Approve</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="reviewDecision"
            checked={reviewDecision === 'request_changes'}
            onChange={() => setReviewDecision('request_changes')}
            className="text-violet-700 focus:ring-violet-600"
          />
          <span>Request Changes</span>
        </label>
      </div>

      {commentPosted && <p role="status" className="text-xs text-emerald-700">Comment posted on GitHub.</p>}

      {drafts
        .filter((draft) => commentApprovals[draft.id])
        .map((draft) => (
          <div key={draft.id} className="rounded-lg border border-slate-200 p-3 space-y-2 text-xs">
            <p className="font-semibold text-slate-800">
              {draft.path}:{draft.line} ({draft.side})
            </p>
            <p className="whitespace-pre-wrap break-words text-slate-700">{draft.comment}</p>
            <label className="flex items-center gap-2 text-slate-700">
              <input
                type="checkbox"
                checked={commentToPost === commentApprovals[draft.id]}
                onChange={(event) =>
                  setCommentToPost(event.target.checked ? commentApprovals[draft.id] : null)
                }
              />
              <span>Post this comment to the configured test repository</span>
            </label>
            <button
              type="button"
              disabled={postingComment || commentToPost !== commentApprovals[draft.id]}
              onClick={() => {
                setPostingComment(true);
                router.post(
                  '/repositories/review/comment',
                  {
                    id: draft.id,
                    digest: commentApprovals[draft.id],
                    approved: true,
                  },
                  {
                    onFinish: () => {
                      setPostingComment(false);
                      setCommentToPost(null);
                    },
                  }
                );
              }}
              className="px-3 py-1.5 rounded-md bg-violet-700 text-white font-semibold disabled:opacity-40"
            >
              {postingComment && commentToPost === commentApprovals[draft.id]
                ? 'Posting…'
                : 'Post comment'}
            </button>
            <p className="text-slate-500">
              The PR can change between the final check and posting; check GitHub if the outcome is unclear.
            </p>
          </div>
        ))}

      {/* Review decisions remain local notice */}
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-800">
          Review decisions stay local · GitHub Comment Attribution (
          {githubConnection?.user?.login
            ? `@${githubConnection.user.login} / Co-Maintainer`
            : 'proofpatcher[bot]'}
          )
        </p>
        <p className="text-[11px] leading-relaxed">
          Approvals and change requests are not submitted automatically to GitHub. Individual line-anchored comments can be posted manually to the configured test repository with a single-use SHA-256 digest token.
        </p>
      </div>

      {/* Disabled Submission Button */}
      <div>
        <button
          type="button"
          disabled
          className="px-4 py-2 text-xs font-medium rounded-md bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
        >
          Publish Review to GitHub (Not Implemented)
        </button>
      </div>
    </div>
  );
}
