import { createServerFn } from "@tanstack/react-start";
import { rawDb, DB_MODE } from "../db/client";
import { ensureSchema, initDb } from "../db/init";
import { sha256Hex } from "../core/ledger";
import { parseExcel } from "../core/parsers/excel";
import { parseCsv } from "../core/parsers/csv";
import { classifyDimension } from "../core/parsers/classify";

interface UploadResult {
  fileId: string; fileHash: string; filename: string;
  fileType: "xlsx" | "csv" | "pdf" | "image";
  sheets: Array<{ name: string; columns: string[]; rows: Array<{ rowIndex: number; raw: Record<string, string | null> }> }>;
  classification: { dimension: string; confidence: number; department: string; suggestedAction: string; detectedFields: Record<string, string> };
  totalRows: number;
}

export const uploadAndClassify = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as {
    companyId: string; actorId: string; filename: string;
    fileType: "xlsx" | "csv"; base64Content: string;
  })
  .handler(async ({ data }): Promise<UploadResult> => {
    // Ensure schema exists before first upload (in case this is the
    // very first request after deploy).
    await ensureSchema();
    await initDb();

    const company = await rawDb.query<{ id: string }, [string]>(`SELECT id FROM companies WHERE id = ?`, [data.companyId]);
    if (!company) throw new Error(`Unknown company ${data.companyId}`);

    const bytes = Buffer.from(data.base64Content, "base64");
    const fileHash = sha256Hex(bytes.toString("binary"));

    const existing = await rawDb.query<{ id: string }, [string, string]>(
      `SELECT id FROM source_files WHERE company_id = ? AND file_hash = ? LIMIT 1`,
      [data.companyId, fileHash],
    );
    if (existing) throw new Error(`Duplicate file: hash ${fileHash.slice(0, 12)}... already uploaded (file id ${existing.id}).`);

    let parsed: Awaited<ReturnType<typeof parseExcel>>;
    if (data.fileType === "xlsx") {
      const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      parsed = await parseExcel(ab as ArrayBuffer, data.filename);
    } else if (data.fileType === "csv") {
      parsed = parseCsv(bytes.toString("utf8"), data.filename);
    } else {
      throw new Error(`Unsupported file type for AI check: ${data.fileType}`);
    }

    const firstSheet = parsed.sheets[0];
    const classification = classifyDimension({
      columns: firstSheet.columns,
      sampleRows: firstSheet.rows.slice(0, 10).map((r) => r.raw),
    });

    const fileId = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await rawDb.run(
      `INSERT INTO source_files (id, company_id, file_hash, original_filename, file_type, status, uploaded_by, upload_date, ai_extracted_json)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
      [
        fileId, data.companyId, fileHash, data.filename, data.fileType,
        data.actorId, new Date().toISOString(),
        JSON.stringify({ sheets: parsed.sheets.map((s) => ({ name: s.name, columns: s.columns, rowCount: s.rows.length })), classification }),
      ],
    );

    return {
      fileId, fileHash, filename: data.filename, fileType: data.fileType,
      sheets: parsed.sheets.map((s) => ({ name: s.name, columns: s.columns, rows: s.rows })),
      classification, totalRows: parsed.totalRows,
    };
  });
