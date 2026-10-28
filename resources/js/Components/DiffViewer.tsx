import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  MessageSquare,
  AlertTriangle,
  FileText,
  Trash2,
  Edit3,
  X,
  Check,
  ShieldAlert,
} from 'lucide-react';

export interface ReviewFinding {
  path: string;
  status: 'note' | 'concern' | 'approval';
  lineHint: number | null;
  comment: string;
  commentable?: boolean;
  anchorStatus?: 'anchored' | 'hint_only' | 'stale';
  anchorMessage?: string;
  lineType?: string | null;
}

export interface CommentDraft {
  id: string;
  path: string;
  line: number | null;
  side: string;
  comment: string;
  headSha: string;
  status: 'anchored' | 'hint_only' | 'stale';
  valid: boolean;
  commentable?: boolean;
  lineType: string | null;
  message?: string;
  updatedAt?: string;
}

export interface PatchFile {
  name: string;
  status: string;
  additions?: number;
  deletions?: number;
  patch: string | null;
}

export interface DiffLine {
  type: 'addition' | 'deletion' | 'context' | 'header' | 'no_newline';
  oldLine: number | null;
  newLine: number | null;
  content: string;
  isCommentable: boolean;
  side: 'LEFT' | 'RIGHT';
}

interface DiffViewerProps {
  file: PatchFile;
  headSha: string;
  findings?: ReviewFinding[];
  drafts?: CommentDraft[];
  initiallyExpanded?: boolean;
  onSaveDraft: (path: string, line: number | null, side: string, comment: string) => void;
  onDeleteDraft?: (draftId: string) => void;
  isSavingDraft?: boolean;
}

export function parseDiffLines(patch: string): DiffLine[] {
  const result: DiffLine[] = [];
  const trimmed = patch.replace(/\r\n/g, '\n').replace(/\n+$/, '');
  if (!trimmed) return result;

  const rawLines = trimmed.split('\n');
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of rawLines) {
    if (line.startsWith('@@')) {
      const match = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
        inHunk = true;
        result.push({
          type: 'header',
          oldLine: null,
          newLine: null,
          content: line,
          isCommentable: false,
          side: 'RIGHT',
        });
        continue;
      }
    }

    if (!inHunk) {
      continue;
    }

    if (line.startsWith('\\')) {
      result.push({
        type: 'no_newline',
        oldLine: null,
        newLine: null,
        content: line,
        isCommentable: false,
        side: 'RIGHT',
      });
      continue;
    }

    if (line.startsWith('+')) {
      result.push({
        type: 'addition',
        oldLine: null,
        newLine: newLine,
        content: line.slice(1),
        isCommentable: true,
        side: 'RIGHT',
      });
      newLine++;
    } else if (line.startsWith('-')) {
      result.push({
        type: 'deletion',
        oldLine: oldLine,
        newLine: null,
        content: line.slice(1),
        isCommentable: true,
        side: 'LEFT',
      });
      oldLine++;
    } else if (line.startsWith(' ') || line === '') {
      result.push({
        type: 'context',
        oldLine: oldLine,
        newLine: newLine,
        content: line.startsWith(' ') ? line.slice(1) : '',
        isCommentable: true,
        side: 'RIGHT',
      });
      oldLine++;
      newLine++;
    }
  }

  return result;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  file,
  headSha,
  findings = [],
  drafts = [],
  initiallyExpanded = true,
  onSaveDraft,
  onDeleteDraft,
  isSavingDraft = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const [activeEditorLineKey, setActiveEditorLineKey] = useState<string | null>(null);
  const [editorText, setEditorText] = useState('');

  const fileFindings = findings.filter((f) => f.path === file.name);
  const fileDrafts = drafts.filter((d) => d.path === file.name);

  const parsedLines = file.patch ? parseDiffLines(file.patch) : [];
  const commentableNewLines = parsedLines
    .filter((l) => l.isCommentable && l.newLine !== null)
    .map((l) => l.newLine as number);
  const commentableOldLines = parsedLines
    .filter((l) => l.isCommentable && l.oldLine !== null)
    .map((l) => l.oldLine as number);

  // Separate anchored Muse findings from unanchored model hints
  const anchoredFindings = fileFindings.filter(
    (f) =>
      f.commentable === true ||
      (f.lineHint !== null && commentableNewLines.includes(f.lineHint))
  );

  const unanchoredFindings = fileFindings.filter(
    (f) =>
      f.lineHint === null ||
      (!commentableNewLines.includes(f.lineHint) && !commentableOldLines.includes(f.lineHint))
  );

  const openEditorForLine = (lineKey: string, defaultText: string = '') => {
    setActiveEditorLineKey(lineKey);
    setEditorText(defaultText);
  };

  const closeEditor = () => {
    setActiveEditorLineKey(null);
    setEditorText('');
  };

  const handleSave = (lineNum: number | null, side: string) => {
    if (!editorText.trim()) return;
    onSaveDraft(file.name, lineNum, side, editorText.trim());
    closeEditor();
  };

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
      {/* File Header Row — Clickable to Expand / Collapse */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
        className="w-full text-left p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs select-none hover:bg-slate-100/70 cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-slate-400"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-500">
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="font-mono font-semibold text-slate-900 truncate">{file.name}</span>
          <span className="text-slate-400 text-2xs uppercase font-medium">({file.status})</span>
        </div>

        <div className="flex items-center gap-2">
          {file.additions !== undefined && file.additions > 0 && (
            <span className="text-emerald-700 font-mono text-[11px] font-medium">+{file.additions}</span>
          )}
          {file.deletions !== undefined && file.deletions > 0 && (
            <span className="text-rose-700 font-mono text-[11px] font-medium">-{file.deletions}</span>
          )}
          {fileFindings.length > 0 && (
            <span className="bg-slate-200/90 text-slate-800 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>{fileFindings.length} Muse finding{fileFindings.length === 1 ? '' : 's'}</span>
            </span>
          )}
          {fileDrafts.length > 0 && (
            <span className="bg-violet-100 text-violet-800 text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>{fileDrafts.length} draft{fileDrafts.length === 1 ? '' : 's'}</span>
            </span>
          )}
          <span className="text-slate-400 text-2xs uppercase">
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
        </div>
      </div>

      {/* Expanded Diff Body */}
      {isExpanded && (
        <div className="space-y-0">
          {/* Unanchored Muse Hints Warning if any */}
          {unanchoredFindings.length > 0 && (
            <div className="p-3.5 bg-amber-50/70 border-b border-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Muse Advisory Hint Only (Outside Captured Diff Hunks)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                The model suggested the following findings, but the referenced lines fall outside the diff hunks captured in this pull request and cannot receive inline anchors:
              </p>
              <div className="space-y-2 pt-1">
                {unanchoredFindings.map((uf, uIdx) => (
                  <div key={uIdx} className="p-2.5 rounded bg-white/80 border border-amber-200 text-slate-700 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="font-semibold text-amber-900">Line Hint: {uf.lineHint ?? 'None'}</span>
                      <span className="uppercase text-2xs px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                        {uf.status}
                      </span>
                    </div>
                    <p className="text-slate-800">{uf.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Render Diff Lines or Unavailable State */}
          {!file.patch ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50/50">
              {file.status === 'oversize'
                ? 'Patch exceeds GitHub preview size limits.'
                : 'Unified patch diff not available for this file (file may be binary or unmodified).'}
            </div>
          ) : (
            <div className="overflow-x-auto text-xs font-mono">
              <table className="w-full border-collapse">
                <tbody>
                  {parsedLines.map((line, lIdx) => {
                    const lineNum = line.side === 'RIGHT' ? line.newLine : line.oldLine;
                    const lineKey = `${file.name}:${line.side}:${lineNum ?? lIdx}`;
                    const isEditorOpen = activeEditorLineKey === lineKey;

                    // Match anchored Muse finding on this line
                    const matchingFinding = anchoredFindings.find((f) => {
                      if (line.side === 'RIGHT') {
                        return f.lineHint !== null && f.lineHint === line.newLine;
                      }
                      return f.lineHint !== null && f.lineHint === line.oldLine;
                    });

                    // Match saved local draft on this line
                    const matchingDraft = fileDrafts.find((d) => {
                      if (line.side === 'RIGHT') {
                        return d.line !== null && d.line === line.newLine && d.side === 'RIGHT';
                      }
                      return d.line !== null && d.line === line.oldLine && d.side === 'LEFT';
                    });

                    return (
                      <React.Fragment key={lIdx}>
                        {/* Diff Row */}
                        <tr
                          className={`group border-b border-slate-100/60 ${
                            line.type === 'addition'
                              ? 'bg-emerald-50/70 text-emerald-950'
                              : line.type === 'deletion'
                              ? 'bg-rose-50/70 text-rose-950'
                              : line.type === 'header'
                              ? 'bg-slate-100/90 text-slate-600 font-bold'
                              : line.type === 'no_newline'
                              ? 'bg-slate-50 text-slate-400 italic text-[11px]'
                              : 'bg-white text-slate-800'
                          }`}
                        >
                          {/* Left Line Number (Base) */}
                          <td className="w-12 px-2 py-0.5 text-right text-slate-400 select-none text-[11px] border-r border-slate-200/60 font-mono">
                            {line.oldLine ?? ''}
                          </td>

                          {/* Right Line Number (Head) */}
                          <td className="w-12 px-2 py-0.5 text-right text-slate-400 select-none text-[11px] border-r border-slate-200/60 font-mono">
                            {line.newLine ?? ''}
                          </td>

                          {/* Action Gutter: Accessible '+' Add-Comment Control */}
                          <td className="w-8 px-1 py-0.5 text-center select-none border-r border-slate-200/60">
                            {line.isCommentable && lineNum !== null ? (
                              <button
                                type="button"
                                aria-label={`Add comment on line ${lineNum}`}
                                title={`Add inline draft comment on line ${lineNum}`}
                                onClick={() =>
                                  isEditorOpen
                                    ? closeEditor()
                                    : openEditorForLine(lineKey, matchingDraft?.comment || matchingFinding?.comment || '')
                                }
                                className={`w-5 h-5 rounded inline-flex items-center justify-center transition ${
                                  matchingDraft
                                    ? 'bg-violet-600 text-white shadow-2xs'
                                    : matchingFinding
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-violet-700 hover:text-white focus:opacity-100 focus:bg-violet-700 focus:text-white'
                                }`}
                              >
                                {matchingDraft ? (
                                  <MessageSquare className="w-3 h-3" />
                                ) : (
                                  <Plus className="w-3.5 h-3.5" />
                                )}
                              </button>
                            ) : null}
                          </td>

                          {/* Diff Code Content */}
                          <td className="px-3 py-0.5 whitespace-pre font-mono text-xs overflow-x-auto">
                            {line.type === 'addition'
                              ? `+ ${line.content}`
                              : line.type === 'deletion'
                              ? `- ${line.content}`
                              : line.type === 'header'
                              ? line.content
                              : line.type === 'no_newline'
                              ? line.content
                              : `  ${line.content}`}
                          </td>
                        </tr>

                        {/* Inline Muse Finding Card attached directly beneath this line */}
                        {matchingFinding && (
                          <tr>
                            <td colSpan={4} className="p-3 bg-slate-50/90 border-y border-slate-200">
                              <div className="p-3 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-2 font-sans">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-violet-700 text-white">
                                      Muse Finding · Line {matchingFinding.lineHint}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider ${
                                        matchingFinding.status === 'approval'
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                          : matchingFinding.status === 'concern'
                                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                          : 'bg-slate-100 text-slate-800 border border-slate-200'
                                      }`}
                                    >
                                      {matchingFinding.status}
                                    </span>
                                    <span className="text-2xs text-slate-500 font-mono">
                                      Validated Anchor (head: {headSha.slice(0, 7)})
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      isEditorOpen
                                        ? closeEditor()
                                        : openEditorForLine(
                                            lineKey,
                                            matchingDraft?.comment || matchingFinding.comment
                                          )
                                    }
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 underline"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span>
                                      {isEditorOpen
                                        ? 'Close Editor'
                                        : matchingDraft
                                        ? 'Edit Local Draft'
                                        : 'Adopt Suggestion into Draft'}
                                    </span>
                                  </button>
                                </div>

                                <p className="text-xs text-slate-800 leading-relaxed font-normal">
                                  {matchingFinding.comment}
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Inline Editor when toggled via '+' button or 'Draft Local Comment' */}
                        {isEditorOpen && lineNum !== null && (
                          <tr>
                            <td colSpan={4} className="p-3.5 bg-slate-100/90 border-y border-slate-300">
                              <div className="p-4 rounded-lg bg-white border border-slate-300 shadow-xs space-y-3 font-sans">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-violet-700" />
                                    <span className="text-xs font-bold text-slate-900">
                                      Draft Maintainer Comment · Line {lineNum} ({line.side} Side)
                                    </span>
                                  </div>
                                  <span className="text-2xs text-slate-500 font-mono">
                                    Local Draft Only · Not posted to GitHub
                                  </span>
                                </div>

                                <textarea
                                  autoFocus
                                  rows={3}
                                  value={editorText}
                                  onChange={(e) => setEditorText(e.target.value)}
                                  placeholder={`Leave an inline review comment on line ${lineNum}...`}
                                  className="w-full text-xs font-sans rounded-md border border-slate-300 p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-violet-600 leading-relaxed"
                                />

                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-2xs text-slate-500">
                                    Markdown supported. Comments remain local until GitHub authorization is implemented.
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={closeEditor}
                                      className="px-3 py-1 text-xs font-medium rounded text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!editorText.trim() || isSavingDraft}
                                      onClick={() => handleSave(lineNum, line.side)}
                                      className="px-3 py-1 text-xs font-semibold rounded text-white bg-violet-700 hover:bg-violet-800 disabled:opacity-40 transition"
                                    >
                                      {isSavingDraft ? 'Saving...' : 'Save Draft'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Saved Local Draft Banner if present */}
                        {matchingDraft && (
                          <tr>
                            <td colSpan={4} className="p-3 bg-violet-50/70 border-y border-violet-200">
                              <div className="p-3 rounded-lg bg-white border border-violet-200 shadow-2xs space-y-2 font-sans">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xs font-bold font-mono px-2 py-0.5 rounded bg-violet-100 text-violet-900 border border-violet-300">
                                      Saved Local Draft · Line {matchingDraft.line} ({matchingDraft.side})
                                    </span>
                                    <span className="text-2xs text-slate-500 font-mono">
                                      {matchingDraft.updatedAt ? new Date(matchingDraft.updatedAt).toLocaleTimeString() : ''}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => openEditorForLine(lineKey, matchingDraft.comment)}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 underline"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    {onDeleteDraft && (
                                      <button
                                        type="button"
                                        onClick={() => onDeleteDraft(matchingDraft.id)}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-800 underline"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Delete</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <p className="text-xs text-slate-800 leading-relaxed font-normal whitespace-pre-wrap">
                                  {matchingDraft.comment}
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
