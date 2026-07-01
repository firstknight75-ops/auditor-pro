import { rawDb } from "./client";

const APPEND_ONLY_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS ledger_no_update
BEFORE UPDATE ON ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'Rule 1 violation: ledger_entries is append-only. Use a reversing entry to correct.');
END;

CREATE TRIGGER IF NOT EXISTS ledger_no_delete
BEFORE DELETE ON ledger_entries
BEGIN
  SELECT RAISE(ABORT, 'Rule 1 violation: ledger_entries is append-only. Records cannot be deleted.');
END;
`;

export function initDb(): void {
  rawDb.exec(APPEND_ONLY_TRIGGERS);
}

export function isDbInitialized(): boolean {
  const row = rawDb
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name='ledger_no_update'",
    )
    .get();
  return !!row;
}

export function ensureSchema(): void {
  // Idempotent table creation; mirrors Drizzle schema exactly.
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, sector TEXT NOT NULL,
      config_profile_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL, address TEXT
    );
    CREATE INDEX IF NOT EXISTS branches_company_idx ON branches(company_id);

    CREATE TABLE IF NOT EXISTS config_profiles (
      id TEXT PRIMARY KEY, sector TEXT NOT NULL,
      dimension_thresholds_json TEXT NOT NULL,
      last_recalibrated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS source_files (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      branch_id TEXT REFERENCES branches(id),
      file_hash TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      uploaded_by TEXT NOT NULL,
      upload_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ai_extracted_json TEXT
    );
    CREATE INDEX IF NOT EXISTS source_files_company_idx ON source_files(company_id);
    CREATE INDEX IF NOT EXISTS source_files_hash_idx ON source_files(file_hash);

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      source_file_id TEXT REFERENCES source_files(id),
      dimension TEXT NOT NULL,
      department TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      amount_iqd REAL NOT NULL,
      entry_date TEXT NOT NULL,
      entry_kind TEXT NOT NULL DEFAULT 'NORMAL',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      reversed_by_entry_id TEXT,
      reverses_entry_id TEXT,
      correction_reason TEXT,
      content_hash TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS ledger_company_idx ON ledger_entries(company_id);
    CREATE INDEX IF NOT EXISTS ledger_dimension_idx ON ledger_entries(dimension);
    CREATE INDEX IF NOT EXISTS ledger_file_idx ON ledger_entries(source_file_id);
    CREATE INDEX IF NOT EXISTS ledger_created_idx ON ledger_entries(created_at);

    CREATE TABLE IF NOT EXISTS trust_index_log (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      dimension TEXT,
      score REAL NOT NULL,
      data_points INTEGER NOT NULL,
      error_weight REAL NOT NULL,
      breakdown_json TEXT,
      calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS trust_company_idx ON trust_index_log(company_id);
    CREATE INDEX IF NOT EXISTS trust_calc_idx ON trust_index_log(calculated_at);

    CREATE TABLE IF NOT EXISTS deviations (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      dimension TEXT NOT NULL,
      severity TEXT NOT NULL,
      financial_impact_iqd REAL NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      root_cause_text TEXT,
      detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      source_layer TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      action_taken TEXT,
      action_taken_at TEXT,
      action_taken_by TEXT,
      involved_entry_ids TEXT,
      suggested_default_action TEXT
    );
    CREATE INDEX IF NOT EXISTS deviations_company_idx ON deviations(company_id);
    CREATE INDEX IF NOT EXISTS deviations_severity_idx ON deviations(severity);
    CREATE INDEX IF NOT EXISTS deviations_status_idx ON deviations(status);

    CREATE TABLE IF NOT EXISTS advisor_preferences (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL REFERENCES companies(id),
      deviation_kind TEXT NOT NULL,
      preferred_action TEXT NOT NULL,
      sample_size INTEGER NOT NULL DEFAULT 1,
      last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS advisor_pref_unique ON advisor_preferences(company_id, deviation_kind);
  `);
}
