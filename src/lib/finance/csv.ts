/** Minimal RFC 4180 CSV reader: quoted cells, escaped quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  const src = text.replace(/^\uFEFF/, '');

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    // Ignore a trailing blank line rather than emitting an empty record.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  while (index < src.length) {
    const char = src[index];

    if (quoted) {
      if (char === '"') {
        if (src[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      endField();
      index += 1;
      continue;
    }
    if (char === '\r' && src[index + 1] === '\n') {
      endRow();
      index += 2;
      continue;
    }
    if (char === '\n' || char === '\r') {
      endRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }

  if (field.length > 0 || row.length > 0) endRow();
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}
