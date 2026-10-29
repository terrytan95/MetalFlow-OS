/** RFC-style quoted fields, escaped quotes and embedded line breaks. */
export function parseCSV(text: string): Record<string, string>[] {
  if (text.length > 1024 * 1024) throw Error("CSV exceeds 1 MiB");
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const push = () => {
    row.push(field);
    field = "";
    closed = false;
  };
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      if (field || closed) throw Error("Unexpected quote");
      quoted = true;
    } else if (ch === ",") push();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      push();
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else {
      if (closed) throw Error("Unexpected characters after quoted field");
      field += ch;
    }
  }
  if (quoted) throw Error("Unclosed quoted field");
  push();
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((x) => x.trim());
  if (
    !headers?.length ||
    new Set(headers).size !== headers.length ||
    headers.some(
      (h) => !h || ["__proto__", "constructor", "prototype"].includes(h),
    )
  )
    throw Error("Unique non-empty headers required");
  if (rows.length > 500) throw Error("Maximum 500 rows per import");
  return rows.map((values, i) => {
    if (values.length !== headers.length)
      throw Error(
        `Row ${i + 2} has ${values.length} fields; expected ${headers.length}`,
      );
    return Object.fromEntries(headers.map((h, j) => [h, values[j]]));
  });
}
