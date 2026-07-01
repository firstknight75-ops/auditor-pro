// Threshold recalibration (§9 Phase 5 / §5 epilogue).
//
// Per spec: "the system needs a historical storage structure that allows
// periodic re-calibration of thresholds based on the company's own data".
//
// Algorithm (per dimension, per company):
//   1. Pull the last 90 days of financial_impact_iqd values from the
//      `deviations` table for this dimension.
//   2. Compute p50, p75, p90 of the distribution.
//   3. New thresholds = { critical: p90, high: p75, medium: p50 }.
//   4. Persist into config_profiles.dimension_thresholds_json under the
//      dimension key. Existing thresholds for other dimensions stay
//      intact.
//
// We then return the previous thresholds so the caller can show a diff
// in the audit log.

import { rawDb } from "../db/client";

export interface ThresholdSet {
  critical: number;
  high: number;
  medium: number;
}

export interface RecalibrationResult {
  dimension: string;
  previous: ThresholdSet;
  next: ThresholdSet;
  sampleSize: number;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export async function recalibrateFor(
  companyId: string,
  dimension: string,
): Promise<RecalibrationResult | null> {
  // 1. Pull historical deviations
  const rows = await rawDb.all<{ financial_impact_iqd: number }, [string, string]>(
    `SELECT financial_impact_iqd FROM deviations
      WHERE company_id = ? AND dimension = ?
        AND detected_at >= ?`,
    [companyId, dimension, new Date(Date.now() - 90 * 86400000).toISOString()],
  );
  const impacts = rows.map((r) => Math.abs(r.financial_impact_iqd)).filter((v) => v > 0);

  if (impacts.length < 5) {
    return null; // not enough data to recalibrate reliably
  }

  // 2. Compute quantiles
  const next: ThresholdSet = {
    critical: quantile(impacts, 0.9),
    high: quantile(impacts, 0.75),
    medium: quantile(impacts, 0.5),
  };

  // 3. Load existing thresholds and merge per-dimension
  const profileRows = await rawDb.all<{ dimension_thresholds_json: string }, [string]>(
    `SELECT dimension_thresholds_json FROM config_profiles
      WHERE id = (SELECT config_profile_id FROM companies WHERE id = ?)`,
    [companyId],
  );
  if (!profileRows[0]) return null;

  const thresholds = JSON.parse(profileRows[0].dimension_thresholds_json);
  const previous: ThresholdSet = thresholds[dimension] ?? { critical: 0, high: 0, medium: 0 };
  thresholds[dimension] = next;

  // 4. Persist
  await rawDb.run(
    `UPDATE config_profiles SET dimension_thresholds_json = ?, last_recalibrated_at = ?
      WHERE id = (SELECT config_profile_id FROM companies WHERE id = ?)`,
    [JSON.stringify(thresholds), new Date().toISOString(), companyId],
  );

  return {
    dimension,
    previous,
    next,
    sampleSize: impacts.length,
  };
}

export async function recalibrateAllDimensions(companyId: string): Promise<RecalibrationResult[]> {
  const dims = ["FINANCIAL", "OPERATIONAL", "ADMINISTRATIVE", "COMMERCIAL", "COMPLIANCE"];
  const out: RecalibrationResult[] = [];
  for (const d of dims) {
    const r = await recalibrateFor(companyId, d);
    if (r) out.push(r);
  }
  return out;
}
