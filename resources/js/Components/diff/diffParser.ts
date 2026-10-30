import { DiffLine, SplitDiffRow } from './types';

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
