// Turso over HTTP: no native SQLite bindings, local files, or module-scope I/O.
import { createClient, type Client, type InValue } from "@libsql/client/web";
import { tursoConfig } from "./config";

let sqlite: Client | undefined;
function getClient(): Client {
  if (!sqlite) sqlite = createClient(tursoConfig(process.env));
  return sqlite;
}

type Row = Record<string, unknown>;
export const rawDb = {
  async query<T = Row, _Args = InValue[]>(sql: string, args: InValue[] = []): Promise<T | undefined> {
    const result = await getClient().execute({ sql, args });
    return result.rows[0] as T | undefined;
  },
  async all<T = Row, _Args = InValue[]>(sql: string, args: InValue[] = []): Promise<T[]> {
    const result = await getClient().execute({ sql, args });
    return result.rows as unknown as T[];
  },
  async run(sql: string, args: InValue[] = []) {
    const result = await getClient().execute({ sql, args });
    return { changes: result.rowsAffected, lastInsertRowid: result.lastInsertRowid };
  },
  async exec(sql: string): Promise<void> {
    await getClient().executeMultiple(sql);
  },
};
