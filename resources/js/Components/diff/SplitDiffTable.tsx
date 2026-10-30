import React from 'react';
import { Plus } from 'lucide-react';
import { SplitDiffRow } from './types';
import { InlineCommentEditor } from './InlineCommentEditor';

interface SplitDiffTableProps {
  fileName: string;
  splitRows: SplitDiffRow[];
  activeEditorLineKey: string | null;
  openEditorForLine: (lineKey: string, defaultText?: string) => void;
  closeEditor: () => void;
  onSaveDraft: (fileName: string, lineNum: number, side: string, text: string) => void;
  isSavingDraft?: boolean;
}

export function SplitDiffTable({
  fileName,
  splitRows,
  activeEditorLineKey,
  openEditorForLine,
  closeEditor,
  onSaveDraft,
  isSavingDraft = false,
}: SplitDiffTableProps) {
  return (
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

            const leftLineKey = `${fileName}:LEFT:${row.left?.lineNum ?? rIdx}`;
            const rightLineKey = `${fileName}:RIGHT:${row.right?.lineNum ?? rIdx}`;

            const isRightEditorOpen = activeEditorLineKey === rightLineKey;

            return (
              <React.Fragment key={rIdx}>
                <tr className="border-b border-slate-100 group">
                  {/* Left Line Number (Base) */}
                  <td
                    className={`px-2 py-0.5 text-right select-none text-[11px] border-r border-[#d0d7de]/60 ${
                      leftDel ? 'bg-[#ffdce0] text-[#cf222e]' : 'bg-white text-[#656d76]'
                    }`}
                  >
                    {row.left?.lineNum ?? ''}
                  </td>

                  {/* Left Sign Marker (-) */}
                  <td
                    className={`text-center select-none font-bold ${
                      leftDel ? 'bg-[#ffdce0] text-[#cf222e]' : 'bg-white text-transparent'
                    }`}
                  >
                    {leftDel ? '-' : ' '}
                  </td>

                  {/* Left Code Content */}
                  <td
                    className={`px-2 py-0.5 whitespace-pre overflow-x-auto border-r border-[#d0d7de] text-[#1f2328] ${
                      leftDel ? 'bg-[#ffebe9]' : 'bg-white'
                    }`}
                  >
                    {row.left?.content ?? ''}
                  </td>

                  {/* Right Line Number (Head) */}
                  <td
                    className={`px-2 py-0.5 text-right select-none text-[11px] border-r border-[#d0d7de]/60 ${
                      rightAdd ? 'bg-[#dafbe1] text-[#1a7f37]' : 'bg-white text-[#656d76]'
                    }`}
                  >
                    {row.right?.lineNum ?? ''}
                  </td>

                  {/* Right Sign Marker (+) */}
                  <td
                    className={`text-center select-none font-bold ${
                      rightAdd ? 'bg-[#dafbe1] text-[#1a7f37]' : 'bg-white text-transparent'
                    }`}
                  >
                    {rightAdd ? '+' : ' '}
                  </td>

                  {/* Right Code Content */}
                  <td
                    className={`px-2 py-0.5 whitespace-pre overflow-x-auto text-[#1f2328] relative ${
                      rightAdd ? 'bg-[#e6ffec]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{row.right?.content ?? ''}</span>
                      {row.right?.lineNum !== null && (
                        <button
                          type="button"
                          aria-label={`Add comment on line ${row.right?.lineNum}`}
                          title={`Add inline comment on line ${row.right?.lineNum}`}
                          onClick={() =>
                            isRightEditorOpen ? closeEditor() : openEditorForLine(rightLineKey)
                          }
                          className="w-4 h-4 rounded inline-flex items-center justify-center opacity-0 group-hover:opacity-100 bg-violet-600 text-white transition hover:bg-violet-700"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Inline Editor Drawer in Split Mode */}
                {isRightEditorOpen && row.right && row.right.lineNum !== null && (
                  <tr>
                    <td colSpan={6} className="p-3 bg-[#f6f8fa] border-y border-[#d0d7de]">
                      <InlineCommentEditor
                        fileName={fileName}
                        lineNum={row.right.lineNum}
                        side="RIGHT"
                        isSavingDraft={isSavingDraft}
                        onSave={(lineNum, side, text) => onSaveDraft(fileName, lineNum, side, text)}
                        onClose={closeEditor}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
