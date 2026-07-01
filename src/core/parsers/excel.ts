import * as XLSX from "xlsx";

export interface ParsedRow {
  rowIndex: number;
  raw: Record<string, string | number | null>;
}

export interface ParsedFile {
  filename: string;
  fileType: "xlsx" | "csv" | "pdf" | "image";
  sheets: Array<{
    name: string;
    rows: ParsedRow[];
    columns: string[];
  }>;
  totalRows: number;
}

export async function parseExcel(buffer: ArrayBuffer, filename: string): Promise<ParsedFile> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
    const rows: ParsedRow[] = json.map((r, idx) => ({
      rowIndex: idx + 2,
      raw: Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? null : String(v)])),
    }));
    const columns = json.length > 0 ? Object.keys(json[0]) : [];
    return { name, rows, columns };
  });

  return { filename, fileType: "xlsx", sheets, totalRows: sheets.reduce((acc, s) => acc + s.rows.length, 0) };
}
