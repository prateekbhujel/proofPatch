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
  Sparkles,
  Copy,
  Columns,
  AlignJustify,
  Eye,
  Bold,
  Italic,
  Code,
  Link2,
  List,
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

export interface SplitDiffRow {
  type: 'header' | 'row';
  headerText?: string;
  left: {
    lineNum: number | null;
    type: 'deletion' | 'context' | 'empty';
    content: string;
  } | null;
  right: {
    lineNum: number | null;
    type: 'addition' | 'context' | 'empty';
    content: string;
  } | null;
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

export function parseSplitDiffRows(diffLines: DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  let i = 0;

  while (i < diffLines.length) {
    const line = diffLines[i];

    if (line.type === 'header') {
      rows.push({
        type: 'header',
        headerText: line.content,
        left: null,
        right: null,
      });
      i++;
      continue;
    }

    if (line.type === 'context') {
      rows.push({
        type: 'row',
        left: {
          lineNum: line.oldLine,
          type: 'context',
          content: line.content,
        },
        right: {
          lineNum: line.newLine,
          type: 'context',
          content: line.content,
        },
      });
      i++;
      continue;
    }

    // Collect contiguous deletions and additions
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];

    while (i < diffLines.length && (diffLines[i].type === 'deletion' || diffLines[i].type === 'addition')) {
      if (diffLines[i].type === 'deletion') {
        dels.push(diffLines[i]);
      } else {
        adds.push(diffLines[i]);
      }
      i++;
    }

    const maxLen = Math.max(dels.length, adds.length);
    for (let k = 0; k < maxLen; k++) {
      const del = dels[k] || null;
      const add = adds[k] || null;

      rows.push({
        type: 'row',
        left: del
          ? {
              lineNum: del.oldLine,
              type: 'deletion',
              content: del.content,
            }
          : {
              lineNum: null,
              type: 'empty',
              content: '',
            },
        right: add
          ? {
              lineNum: add.newLine,
              type: 'addition',
              content: add.content,
            }
          : {
              lineNum: null,
              type: 'empty',
              content: '',
            },
      });
    }
  }

  return rows;
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
  const [diffMode, setDiffMode] = useState<'unified' | 'split'>('unified');
  const [isViewed, setIsViewed] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  // Active inline editor state
  const [activeEditorLineKey, setActiveEditorLineKey] = useState<string | null>(null);
  const [editorText, setEditorText] = useState('');
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');

  const fileFindings = findings.filter((f) => f.path === file.name);
  const fileDrafts = drafts.filter((d) => d.path === file.name);

  const parsedLines = file.patch ? parseDiffLines(file.patch) : [];
  const splitRows = file.patch ? parseSplitDiffRows(parsedLines) : [];

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

  const copyFilePath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(file.name);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const openEditorForLine = (lineKey: string, defaultText: string = '') => {
    setActiveEditorLineKey(lineKey);
    setEditorText(defaultText);
    setEditorTab('write');
  };

  const closeEditor = () => {
    setActiveEditorLineKey(null);
    setEditorText('');
    setEditorTab('write');
  };

  const handleSave = (lineNum: number | null, side: string) => {
    if (!editorText.trim()) return;
    onSaveDraft(file.name, lineNum, side, editorText.trim());
    closeEditor();
  };

  // Insert structured review template for this file and line
  const handleInsertTemplate = (lineNum: number | null) => {
    const template = `### Review Note (${file.name}:${lineNum ?? 'diff'})\n\n- **Verification concern**:\n- **Edge case / Boundary**:\n- **Suggested change**:\n`;
    setEditorText(template);
  };

  const insertMarkdown = (before: string, after: string = '') => {
    setEditorText((prev) => `${prev}${before}text${after}`);
  };

  return (
    <div className={`border rounded-lg overflow-hidden bg-white shadow-2xs transition-colors ${
      isViewed ? 'border-slate-200/60 opacity-80' : 'border-slate-300'
    }`}>
      {/* File Header Bar — Exact GitHub PR Style */}
      <div
        className="w-full p-2.5 sm:px-4 bg-[#f6f8fa] border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse file' : 'Expand file'}
            className="text-slate-500 hover:text-slate-800 p-0.5 rounded transition"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <FileText className="w-4 h-4 text-slate-500 shrink-0" />

          <span className="font-mono font-semibold text-[#1f2328] truncate text-[13px]">{file.name}</span>

          <button
            type="button"
            onClick={copyFilePath}
            title="Copy path"
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
          >
            {copiedPath ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          </button>

          <span className="text-slate-400 text-2xs uppercase font-medium">({file.status})</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Additions / Deletions Diff Stat with Colored Blocks */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold">
            {file.additions !== undefined && file.additions > 0 && (
              <span className="text-[#1a7f37]">+{file.additions}</span>
            )}
            {file.deletions !== undefined && file.deletions > 0 && (
              <span className="text-[#cf222e]">-{file.deletions}</span>
            )}
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const total = (file.additions || 0) + (file.deletions || 0);
                if (total === 0) return <span key={i} className="w-1.5 h-2 rounded-2xs bg-slate-200" />;
                const addRatio = (file.additions || 0) / total;
                const addBlocks = Math.round(addRatio * 5);
                const isAdd = i < addBlocks;
                return (
                  <span
                    key={i}
                    className={`w-1.5 h-2 rounded-2xs ${
                      isAdd ? 'bg-[#1a7f37]' : 'bg-[#cf222e]'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Unified / Split Toggle */}
          <div className="hidden sm:inline-flex items-center p-0.5 bg-slate-200/70 rounded-md border border-slate-300 text-[11px]">
            <button
              type="button"
              onClick={() => setDiffMode('unified')}
              title="Unified diff"
              className={`px-2 py-0.5 rounded transition font-medium flex items-center gap-1 ${
                diffMode === 'unified'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <AlignJustify className="w-3 h-3" />
              <span>Unified</span>
            </button>
            <button
              type="button"
              onClick={() => setDiffMode('split')}
              title="Split diff"
              className={`px-2 py-0.5 rounded transition font-medium flex items-center gap-1 ${
                diffMode === 'split'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3 h-3" />
              <span>Split</span>
            </button>
          </div>

          {/* Viewed Checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isViewed}
              onChange={(e) => setIsViewed(e.target.checked)}
              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5"
            />
            <span className="font-medium text-[11px]">Viewed</span>
          </label>
        </div>
      </div>

      {/* Expanded Diff Body */}
      {isExpanded && (
        <div className="space-y-0">
          {/* Unanchored Muse Hints Warning if any */}
          {unanchoredFindings.length > 0 && (
            <div className="p-3 bg-amber-50/70 border-b border-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Muse Advisory Hint (Outside Captured Diff Hunks)</span>
              </div>
              <div className="space-y-1 pt-0.5">
                {unanchoredFindings.map((uf, uIdx) => (
                  <div key={uIdx} className="p-2 rounded bg-white/80 border border-amber-200 text-slate-700 text-xs space-y-0.5">
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
                ? 'Patch exceeds preview size limits.'
                : 'Unified patch diff not available for this file (file may be binary or unmodified).'}
            </div>
          ) : diffMode === 'split' ? (
            /* ================= SPLIT (SIDE-BY-SIDE) DIFF TABLE (Matches User Image 3) ================= */
            <div className="overflow-x-auto text-[12px] font-mono leading-5">
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-5" />
                  <col className="w-[calc(50%-3.75rem)]" />
                  <col className="w-10" />
                  <col className="w-5" />
                  <col className="w-[calc(50%-3.75rem)]" />
                </colgroup>
                <tbody>
                  {splitRows.map((row, rIdx) => {
                    if (row.type === 'header') {
                      return (
                        <tr key={rIdx} className="bg-[#f0f4f8] text-[#57606a] border-y border-[#d0d7de] font-bold">
                          <td colSpan={6} className="px-4 py-1 text-xs select-none">
                            {row.headerText}
                          </td>
                        </tr>
                      );
                    }

                    const leftDel = row.left?.type === 'deletion';
                    const rightAdd = row.right?.type === 'addition';

                    const leftLineKey = `${file.name}:LEFT:${row.left?.lineNum ?? rIdx}`;
                    const rightLineKey = `${file.name}:RIGHT:${row.right?.lineNum ?? rIdx}`;

                    const isLeftEditorOpen = activeEditorLineKey === leftLineKey;
                    const isRightEditorOpen = activeEditorLineKey === rightLineKey;

                    return (
                      <React.Fragment key={rIdx}>
                        <tr className="border-b border-slate-100 group">
                          {/* Left Line Number (Base) */}
                          <td className={`px-2 py-0.5 text-right select-none text-[11px] border-r border-[#d0d7de]/60 ${
                            leftDel ? 'bg-[#ffdce0] text-[#cf222e]' : 'bg-white text-[#656d76]'
                          }`}>
                            {row.left?.lineNum ?? ''}
                          </td>

                          {/* Left Sign Marker (-) */}
                          <td className={`text-center select-none font-bold ${
                            leftDel ? 'bg-[#ffdce0] text-[#cf222e]' : 'bg-white text-transparent'
                          }`}>
                            {leftDel ? '-' : ' '}
                          </td>

                          {/* Left Code Content */}
                          <td className={`px-2 py-0.5 whitespace-pre overflow-x-auto border-r border-[#d0d7de] text-[#1f2328] ${
                            leftDel ? 'bg-[#ffebe9]' : 'bg-white'
                          }`}>
                            {row.left?.content ?? ''}
                          </td>

                          {/* Right Line Number (Head) */}
                          <td className={`px-2 py-0.5 text-right select-none text-[11px] border-r border-[#d0d7de]/60 ${
                            rightAdd ? 'bg-[#dafbe1] text-[#1a7f37]' : 'bg-white text-[#656d76]'
                          }`}>
                            {row.right?.lineNum ?? ''}
                          </td>

                          {/* Right Sign Marker (+) */}
                          <td className={`text-center select-none font-bold ${
                            rightAdd ? 'bg-[#dafbe1] text-[#1a7f37]' : 'bg-white text-transparent'
                          }`}>
                            {rightAdd ? '+' : ' '}
                          </td>

                          {/* Right Code Content */}
                          <td className={`px-2 py-0.5 whitespace-pre overflow-x-auto text-[#1f2328] relative ${
                            rightAdd ? 'bg-[#e6ffec]' : 'bg-white'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span>{row.right?.content ?? ''}</span>
                              {row.right?.lineNum !== null && (
                                <button
                                  type="button"
                                  aria-label={`Add comment on line ${row.right?.lineNum}`}
                                  title={`Add inline comment on line ${row.right?.lineNum}`}
                                  onClick={() =>
                                    isRightEditorOpen
                                      ? closeEditor()
                                      : openEditorForLine(rightLineKey)
                                  }
                                  className="w-4 h-4 rounded inline-flex items-center justify-center opacity-0 group-hover:opacity-100 bg-violet-600 text-white transition hover:bg-violet-700"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Inline Editor Drawer in Split Mode */}
                        {isRightEditorOpen && row.right && row.right.lineNum !== null && (
                          <tr>
                            <td colSpan={6} className="p-3 bg-[#f6f8fa] border-y border-[#d0d7de]">
                              {renderInlineEditor(row.right.lineNum, 'RIGHT', row.right.content)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ================= UNIFIED DIFF TABLE (Matches User Image 4 & 5) ================= */
            <div className="overflow-x-auto text-[12px] font-mono leading-5">
              <table className="w-full border-collapse table-fixed">
                <colgroup>
                  <col className="w-12" />
                  <col className="w-12" />
                  <col className="w-7" />
                  <col className="w-6" />
                  <col className="w-[calc(100%-8.5rem)]" />
                </colgroup>
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

                    const isAdd = line.type === 'addition';
                    const isDel = line.type === 'deletion';
                    const isHunk = line.type === 'header';

                    if (isHunk) {
                      return (
                        <tr key={lIdx} className="bg-[#f0f4f8] text-[#57606a] border-y border-[#d0d7de] font-bold">
                          <td colSpan={5} className="px-4 py-1 text-xs select-none">
                            {line.content}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <React.Fragment key={lIdx}>
                        {/* Diff Row */}
                        <tr
                          className={`group border-b border-slate-100 ${
                            isAdd
                              ? 'bg-[#e6ffec]'
                              : isDel
                              ? 'bg-[#ffebe9]'
                              : 'bg-white'
                          }`}
                        >
                          {/* Old Line Number */}
                          <td className={`px-2 py-0.5 text-right select-none text-[11px] border-r border-[#d0d7de]/60 font-mono ${
                            isDel ? 'bg-[#ffdce0] text-[#cf222e]' : 'text-[#656d76]'
                          }`}>
                            {line.oldLine ?? ''}
                          </td>

                          {/* New Line Number */}
                          <td className={`px-2 py-0.5 text-right select-none text-[11px] border-r border-[#d0d7de]/60 font-mono ${
                            isAdd ? 'bg-[#dafbe1] text-[#1a7f37]' : 'text-[#656d76]'
                          }`}>
                            {line.newLine ?? ''}
                          </td>

                          {/* Action Gutter: GitHub-Style Blue '+' Button */}
                          <td className="w-7 px-1 py-0.5 text-center select-none border-r border-[#d0d7de]/60">
                            {line.isCommentable && lineNum !== null ? (
                              <button
                                type="button"
                                aria-label={`Add comment on line ${lineNum}`}
                                title={`Add inline comment on line ${lineNum}`}
                                onClick={() =>
                                  isEditorOpen
                                    ? closeEditor()
                                    : openEditorForLine(lineKey, matchingDraft?.comment || matchingFinding?.comment || '')
                                }
                                className={`w-5 h-5 rounded inline-flex items-center justify-center transition ${
                                  matchingDraft
                                    ? 'bg-violet-600 text-white shadow-2xs'
                                    : matchingFinding
                                    ? 'bg-[#0969da] text-white shadow-2xs'
                                    : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-[#0969da] hover:text-white focus:opacity-100 focus:bg-[#0969da] focus:text-white'
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

                          {/* Sign Marker (+ or -) */}
                          <td className={`text-center select-none font-bold font-mono text-[13px] ${
                            isAdd ? 'text-[#1a7f37]' : isDel ? 'text-[#cf222e]' : 'text-transparent'
                          }`}>
                            {isAdd ? '+' : isDel ? '-' : ' '}
                          </td>

                          {/* Code Content */}
                          <td className="px-2 py-0.5 whitespace-pre font-mono text-xs overflow-x-auto text-[#1f2328]">
                            {line.content}
                          </td>
                        </tr>

                        {/* ================= CODERABBIT-STYLE BOT FINDING CARD (Matches User Image 5) ================= */}
                        {matchingFinding && (
                          <tr>
                            <td colSpan={5} className="p-3 bg-[#f6f8fa] border-y border-[#d0d7de]">
                              <div className="rounded-lg bg-white border border-[#d0d7de] shadow-2xs p-3.5 space-y-3 font-sans">
                                {/* Bot Header */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-violet-700 text-white flex items-center justify-center text-xs font-bold">
                                      <Sparkles className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-xs font-semibold text-[#1f2328]">
                                      muse[bot]
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-normal">
                                      Co-Maintainer
                                    </span>
                                    <span className="text-slate-300">·</span>
                                    <span
                                      className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        matchingFinding.status === 'approval'
                                          ? 'bg-[#dafbe1] text-[#1a7f37]'
                                          : matchingFinding.status === 'concern'
                                          ? 'bg-amber-100 text-amber-900'
                                          : 'bg-slate-100 text-slate-800'
                                      }`}
                                    >
                                      {matchingFinding.status === 'concern' ? 'Quality · Review Finding' : matchingFinding.status}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
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
                                          : 'Adopt into Review Draft'}
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                {/* Finding Markdown Text */}
                                <div className="text-xs text-[#1f2328] leading-relaxed font-normal whitespace-pre-wrap">
                                  {matchingFinding.comment}
                                </div>

                                {/* Collapsible AI Prompt & Context (Matches Image 5: '▶ Prompt for AI Agents') */}
                                <details className="group/details text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                                  <summary className="cursor-pointer hover:text-slate-800 font-medium select-none flex items-center gap-1 text-slate-600">
                                    <span>▶ Diff context & anchor verification</span>
                                    <span className="text-2xs text-slate-400 font-mono">
                                      ({matchingFinding.path}:{matchingFinding.lineHint} · SHA: {headSha.slice(0, 8)})
                                    </span>
                                  </summary>
                                  <p className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-slate-700 font-mono text-[11px] leading-relaxed">
                                    Validated anchor on line {matchingFinding.lineHint}. Review finding verified against captured patch revision.
                                  </p>
                                </details>
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* ================= GITHUB-STYLE INLINE COMMENT EDITOR (Matches User Image 4) ================= */}
                        {isEditorOpen && lineNum !== null && (
                          <tr>
                            <td colSpan={5} className="p-3 bg-[#f6f8fa] border-y border-[#d0d7de]">
                              {renderInlineEditor(lineNum, line.side, line.content)}
                            </td>
                          </tr>
                        )}

                        {/* Saved Local Draft Banner */}
                        {matchingDraft && (
                          <tr>
                            <td colSpan={5} className="p-3 bg-violet-50/70 border-y border-violet-200">
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

  // Helper to render the GitHub-Style Inline Comment Editor
  function renderInlineEditor(lineNum: number, side: string, lineContent: string) {
    return (
      <div className="rounded-lg bg-white border border-[#d0d7de] shadow-xs font-sans overflow-hidden">
        {/* Top Header: Avatar + Title */}
        <div className="px-3.5 py-2 bg-[#f6f8fa] border-b border-[#d0d7de] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-bold flex items-center justify-center">
              P
            </div>
            <span className="text-xs font-bold text-[#1f2328]">
              Add a comment on line {lineNum} ({side === 'RIGHT' ? 'HEAD' : 'BASE'})
            </span>
          </div>
          <button
            type="button"
            onClick={closeEditor}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Controls: Write | Preview */}
        <div className="px-3.5 pt-2 flex items-center justify-between border-b border-slate-100">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setEditorTab('write')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                editorTab === 'write'
                  ? 'border-[#0969da] text-[#1f2328] font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setEditorTab('preview')}
              className={`px-3 py-1.5 text-xs font-medium border-b-2 transition ${
                editorTab === 'preview'
                  ? 'border-[#0969da] text-[#1f2328] font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Preview
            </button>
          </div>

          {/* GitHub Markdown Toolbar */}
          {editorTab === 'write' && (
            <div className="flex items-center gap-1 text-slate-500 pb-1">
              <button
                type="button"
                onClick={() => insertMarkdown('**', '**')}
                title="Bold"
                className="p-1 hover:bg-slate-100 rounded"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('_', '_')}
                title="Italic"
                className="p-1 hover:bg-slate-100 rounded"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('`', '`')}
                title="Code"
                className="p-1 hover:bg-slate-100 rounded"
              >
                <Code className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('[', '](url)')}
                title="Link"
                className="p-1 hover:bg-slate-100 rounded"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => insertMarkdown('- ')}
                title="List"
                className="p-1 hover:bg-slate-100 rounded"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Editor Body */}
        <div className="p-3">
          {editorTab === 'write' ? (
            <textarea
              autoFocus
              rows={4}
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              placeholder="Leave a comment... Markdown supported"
              className="w-full text-xs font-sans rounded-md border border-slate-300 p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0969da] leading-relaxed"
            />
          ) : (
            <div className="min-h-[96px] p-2.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap font-sans">
              {editorText.trim() ? editorText : <span className="text-slate-400 italic">Nothing to preview</span>}
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="px-3 py-2.5 bg-[#f6f8fa] border-t border-[#d0d7de] flex flex-wrap items-center justify-between gap-2">
          {/* Review Template Action */}
          <button
            type="button"
            onClick={() => handleInsertTemplate(lineNum)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition"
            title="Insert a structured review comment template"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>Insert Review Template</span>
          </button>

          {/* Cancel and Save Draft Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeEditor}
              className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!editorText.trim() || isSavingDraft}
              onClick={() => handleSave(lineNum, side)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-md text-white bg-[#1f883d] hover:bg-[#1a7f37] disabled:opacity-40 transition shadow-2xs"
            >
              {isSavingDraft ? 'Saving...' : 'Add Review Comment'}
            </button>
          </div>
        </div>
      </div>
    );
  }
};
