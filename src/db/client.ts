// SQLite client — fully async, Turso-or-local.
//
// Production: set TURSO_DATABASE_URL (libsql://...) and
//   TURSO_AUTH_TOKEN. The app talks to Turso over HTTPS from the
//   Cloudflare Worker (the default deploy target in vite.config.ts).
//
// Development: leave the env vars unset and we fall back to a local
//   file:./auditcore.sqlite that Bun opens in-process. Works in both
//   `bun run dev` and `bun run build`.
//
// Every operation is async — there is no synchronous shim. Callers
// must `await` the returned Promise.

import { createClient, type Client, type InValue } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function resolveDbConfig(): { url: string; authToken: string | undefined } {
  const url = process.env.TURSO_DATABASE_URL
    ?? process.env.AUDITCORE_DB
    ?? "file:./auditcore.sqlite";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  return { url, authToken };
}

const { url: DB_URL, authToken: AUTH_TOKEN } = resolveDbConfig();
export const DB_MODE: "turso" | "local" = DB_URL.startsWith("libsql://") ? "turso" : "local";

const sqlite: Client = createClient({ url: DB_URL, authToken: AUTH_TOKEN });

export const db = drizzle(sqlite, { schema });

// Helpers for ergonomic query execution.
async function execOne(sql: string, args: InValue[] = []): Promise<unknown[]> {
  const result = await sqlite.execute({ sql, args });
  return result.rows as unknown[];
}

// Public API — every method returns a Promise. The caller MUST await.
export const rawDb = {
  /** One-shot read; returns the first row or undefined. */
  async query<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T | undefined> {
    const rows = await execOne(sql, args);
    return rows[0] as T | undefined;
  },

  /** One-shot read; returns all rows. */
  async all<T = Record<string, unknown>>(sql: string, args: InValue[] = []): Promise<T[]> {
    return (await execOne(sql, args)) as T[];
  },

  /** One-shot write; returns { changes, lastInsertRowid }. */
  async run(sql: string, args: InValue[] = []): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    const result = await sqlite.execute({ sql, args });
    return { changes: Number(result.rowsAffected ?? 0), lastInsertRowid: result.lastInsertRowid };
  },

  /** Fire-and-forget statement(s). Throws on first error. */
  async exec(sql: string): Promise<void> {
    await sqlite.execute(sql);
  },

  /** Raw libsql client for cases that need it (migrations, replication). */
  get client(): Client { return sqlite; },
};

export { schema };
