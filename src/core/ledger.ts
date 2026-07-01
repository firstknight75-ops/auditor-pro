import { rawDb } from "../db/client";
import { createHash } from "node:crypto";

export interface LedgerEntryInput {
  id?: string;
  companyId: string;
  sourceFileId?: string;
  dimension: "FINANCIAL" | "OPERATIONAL" | "ADMINISTRATIVE" | "COMMERCIAL" | "HUMAN_PERFORMANCE" | "COMPLIANCE";
  department: string;
  actorId: string;
  action: string;
  amountIqd: number;
  entryDate: string;
  metadata?: Record<string, unknown>;
  entryKind?: "NORMAL" | "REVERSAL";
  status?: "ACTIVE" | "REVERSED";
  reversesEntryId?: string;
  reversedByEntryId?: string;
  correctionReason?: string;
}

export function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload).digest("hex");
}

function buildContentHash(input: LedgerEntryInput): string {
  return sha256Hex(JSON.stringify({
    companyId: input.companyId,
    dimension: input.dimension,
    department: input.department,
    actorId: input.actorId,
    action: input.action,
    amountIqd: input.amountIqd,
    entryDate: input.entryDate,
    metadata: input.metadata ?? null,
    entryKind: input.entryKind ?? "NORMAL",
    reversesEntryId: input.reversesEntryId ?? null,
  }));
}

export function appendEntry(input: LedgerEntryInput): { id: string; contentHash: string } {
  const id = input.id ?? `le-${input.companyId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const contentHash = buildContentHash(input);

  rawDb
    .prepare(
      `INSERT INTO ledger_entries
        (id, company_id, source_file_id, dimension, department, actor_id, action, amount_iqd, entry_date,
         entry_kind, status, reversed_by_entry_id, reverses_entry_id, correction_reason, content_hash, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id, input.companyId, input.sourceFileId ?? null, input.dimension,
      input.department, input.actorId, input.action, input.amountIqd,
      input.entryDate, input.entryKind ?? "NORMAL", input.status ?? "ACTIVE",
      input.reversedByEntryId ?? null, input.reversesEntryId ?? null,
      input.correctionReason ?? null, contentHash,
      input.metadata ? JSON.stringify(input.metadata) : null,
      new Date().toISOString(),
    );

  return { id, contentHash };
}

export function createReversal(opts: {
  originalEntryId: string;
  correctionReason: string;
  actorId: string;
}): { reversalId: string; originalId: string } {
  if (!opts.correctionReason || opts.correctionReason.trim().length < 5) {
    throw new Error("Rule 1: correction reason is mandatory and must be meaningful.");
  }

  const original = rawDb
    .query<any, [string]>(`SELECT * FROM ledger_entries WHERE id = ?`)
    .get(opts.originalEntryId);
  if (!original) throw new Error(`Entry ${opts.originalEntryId} not found.`);
  if (original.status === "REVERSED") throw new Error(`Entry ${opts.originalEntryId} already reversed.`);
  if (original.entry_kind === "REVERSAL") throw new Error(`Cannot reverse a reversal. Create a new normal entry instead.`);

  const reversalId = `le-rev-${original.company_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  appendEntry({
    id: reversalId,
    companyId: original.company_id,
    sourceFileId: original.source_file_id ?? undefined,
    dimension: original.dimension,
    department: original.department,
    actorId: opts.actorId,
    action: `${original.action}_REVERSAL`,
    amountIqd: -original.amount_iqd,
    entryDate: new Date().toISOString(),
    entryKind: "REVERSAL",
    reversesEntryId: original.id,
    correctionReason: opts.correctionReason,
    metadata: { reversal_of: original.id, reason: opts.correctionReason },
  });

  rawDb
    .prepare(`UPDATE ledger_entries SET status = 'REVERSED', reversed_by_entry_id = ? WHERE id = ?`)
    .run(reversalId, original.id);

  return { reversalId, originalId: original.id };
}

export function listEntries(companyId: string, opts: {
  dimension?: string;
  department?: string;
  limit?: number;
  search?: string;
} = {}): any[] {
  const limit = opts.limit ?? 100;
  let sql = `SELECT * FROM ledger_entries WHERE company_id = ?`;
  const args: any[] = [companyId];

  if (opts.dimension) { sql += ` AND dimension = ?`; args.push(opts.dimension); }
  if (opts.department) { sql += ` AND department = ?`; args.push(opts.department); }
  if (opts.search && opts.search.length > 0) {
    sql += ` AND (action LIKE ? OR actor_id LIKE ? OR department LIKE ? OR content_hash LIKE ?)`;
    const q = `%${opts.search}%`;
    args.push(q, q, q, q);
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  args.push(limit);

  return rawDb.query<any, any[]>(sql).all(...args);
}

export function verifyHash(hash: string): { matched: boolean; entry?: any } {
  const row = rawDb
    .query<any, [string]>(`SELECT * FROM ledger_entries WHERE content_hash = ? LIMIT 1`)
    .get(hash);
  return { matched: !!row, entry: row };
}
