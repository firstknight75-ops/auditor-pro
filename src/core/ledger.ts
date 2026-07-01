// Append-only ledger operations (Rule 1).
// All writes go through this module. UPDATE/DELETE on ledger_entries
// is blocked by SQLite triggers installed in db/init.ts.
//
// Every function is async — returns a Promise. Callers must `await`.

import { createHash } from "node:crypto";
import { rawDb } from "@/db/client";

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

export async function appendEntry(input: LedgerEntryInput): Promise<{ id: string; contentHash: string }> {
  const id = input.id ?? `le-${input.companyId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const contentHash = buildContentHash(input);

  await rawDb.run(
    `INSERT INTO ledger_entries
      (id, company_id, source_file_id, dimension, department, actor_id, action, amount_iqd, entry_date,
       entry_kind, status, reversed_by_entry_id, reverses_entry_id, correction_reason, content_hash, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.companyId, input.sourceFileId ?? null, input.dimension,
      input.department, input.actorId, input.action, input.amountIqd,
      input.entryDate, input.entryKind ?? "NORMAL", input.status ?? "ACTIVE",
      input.reversedByEntryId ?? null, input.reversesEntryId ?? null,
      input.correctionReason ?? null, contentHash,
      input.metadata ? JSON.stringify(input.metadata) : null,
      new Date().toISOString(),
    ],
  );

  return { id, contentHash };
}

// Rule 1: corrections go via reversing entries, never by mutating the original.
export async function createReversal(opts: {
  originalEntryId: string;
  correctionReason: string;
  actorId: string;
}): Promise<{ reversalId: string; originalId: string }> {
  if (!opts.correctionReason || opts.correctionReason.trim().length < 5) {
    throw new Error("Rule 1: correction reason is mandatory and must be meaningful.");
  }

  const original = await rawDb.query<any, [string]>(
    `SELECT * FROM ledger_entries WHERE id = ?`,
    [opts.originalEntryId],
  );
  if (!original) throw new Error(`Entry ${opts.originalEntryId} not found.`);
  if (original.status === "REVERSED") throw new Error(`Entry ${opts.originalEntryId} already reversed.`);
  if (original.entry_kind === "REVERSAL") throw new Error(`Cannot reverse a reversal. Create a new normal entry instead.`);

  const reversalId = `le-rev-${original.company_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  await appendEntry({
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

  // The ONLY allowed mutation on ledger_entries: flipping status to REVERSED.
  // Triggers still allow UPDATE on the row's own status field, since we
  // never UPDATE amount/dimension/company — just the marker.
  await rawDb.run(
    `UPDATE ledger_entries SET status = 'REVERSED', reversed_by_entry_id = ? WHERE id = ?`,
    [reversalId, original.id],
  );

  return { reversalId, originalId: original.id };
}

export async function listEntries(companyId: string, opts: {
  dimension?: string;
  department?: string;
  limit?: number;
  search?: string;
} = {}): Promise<any[]> {
  const limit = opts.limit ?? 100;
  const args: any[] = [companyId];
  let sql = `SELECT * FROM ledger_entries WHERE company_id = ?`;
  if (opts.dimension) { sql += ` AND dimension = ?`; args.push(opts.dimension); }
  if (opts.department) { sql += ` AND department = ?`; args.push(opts.department); }
  if (opts.search && opts.search.length > 0) {
    sql += ` AND (action LIKE ? OR actor_id LIKE ? OR department LIKE ? OR content_hash LIKE ?)`;
    const q = `%${opts.search}%`;
    args.push(q, q, q, q);
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  args.push(limit);
  return await rawDb.all<any>(sql, args);
}

export async function verifyHash(hash: string): Promise<{ matched: boolean; entry?: any }> {
  const row = await rawDb.query<any, [string]>(
    `SELECT * FROM ledger_entries WHERE content_hash = ? LIMIT 1`,
    [hash],
  );
  return { matched: !!row, entry: row };
}
