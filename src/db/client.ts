// SQLite client — uses @libsql/client so the same DB layer works in:
//   - Bun runtime (dev server, scripts)
//   - Node runtime (TanStack Start SSR via Vite's renderer)
//   - Cloudflare Workers (deployment target per vite.config.ts)
//
// libsql is async-only, so `rawDb` exposes promise-returning methods
// that mirror the better-sqlite3 shapes our code was written against.
// Call sites need to `await` the result (they already live inside
// async server-function handlers).

import { createClient, type Client, type InValue } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const DB_PATH = process.env.AUDITCORE_DB ?? "file:./auditcore.sqlite";
const sqlite: Client = createClient({ url: DB_PATH });

// Apply session pragmas. Errors are non-fatal on read-only mounts.
try {
  await sqlite.execute("PRAGMA journal_mode = WAL;");
  await sqlite.execute("PRAGMA synchronous = NORMAL;");
  await sqlite.execute("PRAGMA foreign_keys = ON;");
} catch {
  /* pragmas are best-effort */
}

export const db = drizzle(sqlite, { schema });

// ──────────────────────────────────────────────────────────────────────────
// Async shim with better-sqlite3-shaped API
// ──────────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

class Statement {
  constructor(private sql: string) {}
  async run(...args: InValue[]): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    const result = await sqlite.execute({ sql: this.sql, args });
    return { changes: Number(result.rowsAffected ?? 0), lastInsertRowid: result.lastInsertRowid };
  }
  async get<T = Row>(...args: InValue[]): Promise<T | undefined> {
    const result = await sqlite.execute({ sql: this.sql, args });
    return (result.rows[0] as T | undefined);
  }
  async all<T = Row>(...args: InValue[]): Promise<T[]> {
    const result = await sqlite.execute({ sql: this.sql, args });
    return (result.rows as unknown as T[]);
  }
}

export const rawDb = {
  /** `db.prepare(sql)` — returns a reusable async statement. */
  prepare(sql: string): Statement {
    return new Statement(sql);
  },

  /** `db.query(sql).get(...args)` — one-shot read, returns first row. */
  async query<T = Row>(sql: string, args: InValue[] = []): Promise<T | undefined> {
    const result = await sqlite.execute({ sql, args });
    return (result.rows[0] as T | undefined);
  },

  /** `db.query(sql).all(...args)` — one-shot read, returns all rows. */
  async all<T = Row>(sql: string, args: InValue[] = []): Promise<T[]> {
    const result = await sqlite.execute({ sql, args });
    return (result.rows as unknown as T[]);
  },

  /** `db.prepare(sql).run(...args)` — one-shot write, returns { changes }. */
  async run(sql: string, args: InValue[] = []): Promise<{ changes: number; lastInsertRowid?: number | bigint }> {
    const result = await sqlite.execute({ sql, args });
    return { changes: Number(result.rowsAffected ?? 0), lastInsertRowid: result.lastInsertRowid };
  },

  /** `db.exec(sql)` — fire-and-forget statement(s). */
  async exec(sql: string): Promise<void> {
    await sqlite.execute(sql);
  },
};

export { schema };
