// Drizzle schema for the immutable AuditCore ledger.
// Rule 1 (Immutable Ledger): the `ledger_entries` table is append-only.
// Enforcement is at the DB level via triggers in src/db/init.ts.

import { sqliteTable, text, integer, real, index, unique } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const DIMENSIONS = [
  "FINANCIAL",
  "OPERATIONAL",
  "ADMINISTRATIVE",
  "COMMERCIAL",
  "HUMAN_PERFORMANCE",
  "COMPLIANCE",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const SECTORS = [
  "Retail",
  "Manufacturing",
  "Contracting",
  "Services",
  "ImportExport",
] as const;
export type Sector = (typeof SECTORS)[number];

export const ENTRY_KIND = ["NORMAL", "REVERSAL"] as const;
export type EntryKind = (typeof ENTRY_KIND)[number];

export const ENTRY_STATUS = ["ACTIVE", "REVERSED"] as const;
export type EntryStatus = (typeof ENTRY_STATUS)[number];

export const SEVERITY = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Severity = (typeof SEVERITY)[number];

export const DEVIATION_SOURCE = ["DIRECT", "SILENT"] as const;
export type DeviationSource = (typeof DEVIATION_SOURCE)[number];

export const DEVIATION_STATUS = ["OPEN", "RESOLVED", "DISMISSED", "DEFERRED", "ESCALATED"] as const;
export type DeviationStatus = (typeof DEVIATION_STATUS)[number];

export const ACTION_TAKEN = [
  "RESOLVE",
  "DISMISS",
  "DEFER",
  "REQUEST_ADVISORY",
  "REVEAL_ROOT_CAUSE",
] as const;
export type ActionTaken = (typeof ACTION_TAKEN)[number];

export const FILE_TYPES = ["xlsx", "csv", "pdf", "image"] as const;
export type FileType = (typeof FILE_TYPES)[number];

export const FILE_STATUS = ["PENDING", "CERTIFIED", "REJECTED"] as const;
export type FileStatus = (typeof FILE_STATUS)[number];

export const companies = sqliteTable("companies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sector: text("sector", { enum: SECTORS }).notNull(),
  configProfileId: text("config_profile_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  address: text("address"),
}, (t) => ({
  companyIdx: index("branches_company_idx").on(t.companyId),
}));

export const configProfiles = sqliteTable("config_profiles", {
  id: text("id").primaryKey(),
  sector: text("sector", { enum: SECTORS }).notNull(),
  dimensionThresholdsJson: text("dimension_thresholds_json").notNull(),
  lastRecalibratedAt: text("last_recalibrated_at"),
});

export const sourceFiles = sqliteTable("source_files", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  branchId: text("branch_id").references(() => branches.id),
  fileHash: text("file_hash").notNull(),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type", { enum: FILE_TYPES }).notNull(),
  status: text("file_status", { enum: FILE_STATUS }).notNull().default("PENDING"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadDate: text("upload_date").notNull().default(sql`CURRENT_TIMESTAMP`),
  aiExtractedJson: text("ai_extracted_json"),
}, (t) => ({
  companyIdx: index("source_files_company_idx").on(t.companyId),
  hashIdx: index("source_files_hash_idx").on(t.fileHash),
}));

export const ledgerEntries = sqliteTable("ledger_entries", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  sourceFileId: text("source_file_id").references(() => sourceFiles.id),
  dimension: text("dimension", { enum: DIMENSIONS }).notNull(),
  department: text("department").notNull(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  amountIqd: real("amount_iqd").notNull(),
  entryDate: text("entry_date").notNull(),
  entryKind: text("entry_kind", { enum: ENTRY_KIND }).notNull().default("NORMAL"),
  status: text("status", { enum: ENTRY_STATUS }).notNull().default("ACTIVE"),
  reversedByEntryId: text("reversed_by_entry_id"),
  reversesEntryId: text("reverses_entry_id"),
  correctionReason: text("correction_reason"),
  contentHash: text("content_hash").notNull(),
  metadataJson: text("metadata_json"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  companyIdx: index("ledger_company_idx").on(t.companyId),
  dimensionIdx: index("ledger_dimension_idx").on(t.dimension),
  fileIdx: index("ledger_file_idx").on(t.sourceFileId),
  createdIdx: index("ledger_created_idx").on(t.createdAt),
}));

export const trustIndexLog = sqliteTable("trust_index_log", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  dimension: text("dimension", { enum: DIMENSIONS }),
  score: real("score").notNull(),
  dataPoints: integer("data_points").notNull(),
  errorWeight: real("error_weight").notNull(),
  breakdownJson: text("breakdown_json"),
  calculatedAt: text("calculated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  companyIdx: index("trust_company_idx").on(t.companyId),
  calcIdx: index("trust_calc_idx").on(t.calculatedAt),
}));

export const deviations = sqliteTable("deviations", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  dimension: text("dimension", { enum: DIMENSIONS }).notNull(),
  severity: text("severity", { enum: SEVERITY }).notNull(),
  financialImpactIqd: real("financial_impact_iqd").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  rootCauseText: text("root_cause_text"),
  detectedAt: text("detected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  sourceLayer: text("source_layer", { enum: DEVIATION_SOURCE }).notNull(),
  status: text("deviation_status", { enum: DEVIATION_STATUS }).notNull().default("OPEN"),
  actionTaken: text("action_taken", { enum: ACTION_TAKEN }),
  actionTakenAt: text("action_taken_at"),
  actionTakenBy: text("action_taken_by"),
  involvedEntryIds: text("involved_entry_ids"),
  suggestedDefaultAction: text("suggested_default_action", { enum: ACTION_TAKEN }),
}, (t) => ({
  companyIdx: index("deviations_company_idx").on(t.companyId),
  severityIdx: index("deviations_severity_idx").on(t.severity),
  statusIdx: index("deviations_status_idx").on(t.status),
}));

export const advisorPreferences = sqliteTable("advisor_preferences", {
  id: text("id").primaryKey(),
  companyId: text("company_id").notNull().references(() => companies.id),
  deviationKind: text("deviation_kind").notNull(),
  preferredAction: text("preferred_action", { enum: ACTION_TAKEN }).notNull(),
  sampleSize: integer("sample_size").notNull().default(1),
  lastUpdated: text("last_updated").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
  uniquePair: unique("advisor_pref_unique").on(t.companyId, t.deviationKind),
}));
