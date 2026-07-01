import Papa from "papaparse";
import type { ParsedFile, ParsedRow } from "./excel";

export function parseCsv(text: string, filename: string): ParsedFile {
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const rows: ParsedRow[] = result.data.map((r, idx) => ({ rowIndex: idx + 2, raw: r }));
  const columns = result.meta.fields ?? [];
  return { filename, fileType: "csv", sheets: [{ name: "data", rows, columns }], totalRows: rows.length };
}
