import { createServerFn } from "@tanstack/react-start";
import { initDb, ensureSchema } from "../db/init";
import { seedIfEmpty } from "../db/seed";
import { rawDb, DB_MODE } from "../db/client";
import { appendEntry, createReversal, listEntries, verifyHash, type LedgerEntryInput } from "../core/ledger";
import { calculateTrustIndex, calculateTrustTrend, logTrustIndex } from "../core/trust-index";
import { computeFinancialKpis, findFinancialDeviations } from "../core/audit/financial";
import { listComplianceItems, findComplianceDeviations } from "../core/audit/compliance";
import { computeCommercialKpis, findCommercialDeviations } from "../core/audit/commercial";
import { runSmartBridge } from "../core/audit/bridge";
import { findOperationalDeviations } from "../core/audit/operational";
import { findAdministrativeDeviations } from "../core/audit/administrative";
import { recalibrateAllDimensions } from "../core/recalibration";
import { formatIqdShort } from "../core/iqd";

// One-time DB bootstrap on first import. The IIFE awaits so the rest
// of the module can use synchronous-feeling logic (but every call
// still awaits individually inside its handler).
void (async () => {
  try {
    await ensureSchema();
    await initDb();
    await seedIfEmpty();
    console.log(`[auditcore] db ready (mode=${DB_MODE})`);
  } catch (err) {
    console.error("[auditcore] db init failed", err);
  }
})();

async function ensureCompany(companyId: string): Promise<void> {
  if (!companyId) throw new Error(`Unknown company: ${companyId}`);
  const row = await rawDb.query<{ id: string }, [string]>(
    "SELECT id FROM companies WHERE id = ?",
    [companyId],
  );
  if (!row) throw new Error(`Unknown company: ${companyId}`);
}

async function getConfigProfile(companyId: string): Promise<any> {
  const company = await rawDb.query<{ config_profile_id: string; sector: string }, [string]>(
    `SELECT config_profile_id, sector FROM companies WHERE id = ?`,
    [companyId],
  );
  if (!company) return null;
  const profile = await rawDb.query<{ dimension_thresholds_json: string; last_recalibrated_at: string | null }, [string]>(
    `SELECT dimension_thresholds_json, last_recalibrated_at FROM config_profiles WHERE id = ?`,
    [company.config_profile_id],
  );
  return {
    sector: company.sector,
    thresholds: profile ? JSON.parse(profile.dimension_thresholds_json) : {},
    lastRecalibratedAt: profile?.last_recalibrated_at ?? null,
  };
}

// ── Owner ──────────────────────────────────────────────────────────────

export const getOwnerIndex = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const fk = await computeFinancialKpis(data.companyId);
    const ck = await computeCommercialKpis(data.companyId);
    const compliance = await listComplianceItems(data.companyId);
    const trust = await calculateTrustIndex(data.companyId);

    const openDeviations = await rawDb.query<{ c: number }, [string]>(
      `SELECT COUNT(*) AS c FROM deviations WHERE company_id = ? AND status = 'OPEN'`,
      [data.companyId],
    );
    const criticalCount = await rawDb.query<{ c: number }, [string]>(
      `SELECT COUNT(*) AS c FROM deviations WHERE company_id = ? AND severity = 'CRITICAL' AND status = 'OPEN'`,
      [data.companyId],
    );

    const profile = await getConfigProfile(data.companyId);

    const trafficLightForCash = fk.netCashFlowIqd > 0 ? "green" : fk.netCashFlowIqd > -5_000_000 ? "yellow" : "red";
    const trafficLightForLiquidity = fk.liquidityRatio >= 1 ? "green" : fk.liquidityRatio >= 0.7 ? "yellow" : "red";
    const trafficLightForConcentration = ck.topCustomerConcentrationPct < 20 ? "green" : ck.topCustomerConcentrationPct < 30 ? "yellow" : "red";
    const trafficLightForCompliance = compliance.some((c) => c.status === "EXPIRED") ? "red" : compliance.some((c) => c.status === "EXPIRING_SOON") ? "yellow" : "green";
    const trafficLightForTrust = trust.score >= 90 ? "green" : trust.score >= 75 ? "yellow" : "red";

    const recommendedActions: string[] = [];
    if (criticalCount && criticalCount.c > 0) recommendedActions.push(`يوجد ${criticalCount.c} انحراف حرج مفتوح — يستدعي قرارك فوراً.`);
    if (fk.netCashFlowIqd < 0) recommendedActions.push(`صافي التدفق النقدي ${formatIqdShort(fk.netCashFlowIqd)} سالب — راجع التحصيل.`);
    if (ck.topCustomerConcentrationPct > 30) recommendedActions.push(`أكبر عميل يمثل ${ck.topCustomerConcentrationPct.toFixed(0)}% من الإيراد — مخاطرة تركّز.`);
    if (compliance.some((c) => c.status === "EXPIRED")) recommendedActions.push(`يوجد ترخيص منتهٍ — تجديد فوري لتجنب الغرامات.`);
    if (recommendedActions.length === 0) recommendedActions.push(`لا توجد انحرافات حرجة — استمر بالمراقبة الدورية.`);

    return {
      companyId: data.companyId,
      kpis: {
        wasteIqd: Math.abs(Math.min(0, fk.netCashFlowIqd)),
        trustIndex: trust.score,
        criticalAlerts: criticalCount?.c ?? 0,
        predictedCashIqd: fk.netCashFlowIqd + fk.totalRevenueIqd * 0.1,
        auditorEfficiencyPct: 91,
      },
      trafficLights: { cash: trafficLightForCash, liquidity: trafficLightForLiquidity, concentration: trafficLightForConcentration, compliance: trafficLightForCompliance, trust: trafficLightForTrust },
      financials: fk, commercial: ck,
      complianceCount: { expired: compliance.filter((c) => c.status === "EXPIRED").length, expiring: compliance.filter((c) => c.status === "EXPIRING_SOON").length },
      openDeviations: openDeviations?.c ?? 0,
      recommendedActions, profile,
    };
  });

export const getTrustIndex = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string; dimension?: string | null })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const result = await calculateTrustIndex(data.companyId, data.dimension ?? null);
    const trend = await calculateTrustTrend(data.companyId, data.dimension ?? null);
    await logTrustIndex(result);
    return { ...result, trend };
  });

export const getTrustIndexByDimension = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const dims = ["FINANCIAL", "OPERATIONAL", "ADMINISTRATIVE", "COMMERCIAL", "HUMAN_PERFORMANCE", "COMPLIANCE"];
    const perDim = await Promise.all(dims.map(async (d) => {
      const r = await calculateTrustIndex(data.companyId, d);
      return { dimension: d, score: r.score, dataPoints: r.dataPoints, errorWeight: r.errorWeight };
    }));
    const overall = await calculateTrustIndex(data.companyId);
    return { overall, perDimension: perDim };
  });

export const getLedger = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string; dimension?: string; department?: string; search?: string; limit?: number })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    return { records: await listEntries(data.companyId, data) };
  });

export const verifyLedgerHash = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { hash: string })
  .handler(async ({ data }) => await verifyHash(data.hash));

export const getOwnerRiskMap = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    return {
      financial: await findFinancialDeviations(data.companyId),
      operational: await findOperationalDeviations(data.companyId),
      administrative: await findAdministrativeDeviations(data.companyId),
      commercial: await findCommercialDeviations(data.companyId),
      compliance: await findComplianceDeviations(data.companyId),
      bridge: await runSmartBridge(data.companyId),
    };
  });

export const getOwnerWasteMap = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const findings = [
      ...await findFinancialDeviations(data.companyId),
      ...await findOperationalDeviations(data.companyId),
      ...await findAdministrativeDeviations(data.companyId),
      ...await findCommercialDeviations(data.companyId),
      ...await findComplianceDeviations(data.companyId),
      ...await runSmartBridge(data.companyId),
    ];
    return findings
      .map((f) => ({ ...f, financialImpactIqd: Math.abs(f.financialImpactIqd) }))
      .sort((a, b) => b.financialImpactIqd - a.financialImpactIqd);
  });

export const getOwnerPortfolio = createServerFn({ method: "POST" })
  .handler(async () => {
    const rows = await rawDb.all<{ id: string; name: string; sector: string }, []>(
      `SELECT id, name, sector FROM companies ORDER BY name`,
    );
    const portfolio = await Promise.all(rows.map(async (c) => {
      const trust = await calculateTrustIndex(c.id);
      const openDevs = await rawDb.query<{ c: number }, [string]>(
        `SELECT COUNT(*) AS c FROM deviations WHERE company_id = ? AND status='OPEN'`,
        [c.id],
      );
      const criticalDevs = await rawDb.query<{ c: number }, [string]>(
        `SELECT COUNT(*) AS c FROM deviations WHERE company_id = ? AND severity='CRITICAL' AND status='OPEN'`,
        [c.id],
      );
      return { ...c, trustIndex: trust.score, openDeviations: openDevs?.c ?? 0, criticalDeviations: criticalDevs?.c ?? 0 };
    }));
    return { companies: portfolio };
  });

export const listCompanies = createServerFn({ method: "POST" })
  .handler(async () => {
    const rows = await rawDb.all<{ id: string; name: string; sector: string }, []>(
      `SELECT id, name, sector FROM companies ORDER BY name`,
    );
    return { companies: rows };
  });

// ── Auditor ─────────────────────────────────────────────────────────────

export const listSourceFiles = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const rows = await rawDb.all<any, [string]>(
      `SELECT id, original_filename, file_type, status, uploaded_by, upload_date, ai_extracted_json
       FROM source_files WHERE company_id = ? ORDER BY upload_date DESC LIMIT 50`,
      [data.companyId],
    );
    return { files: rows };
  });

export const certifyFile = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as {
    companyId: string; fileId: string; actorId: string;
    rows: Array<{ amount: number; entryDate: string; department: string; dimension: string; action: string; metadata?: Record<string, unknown> }>;
  })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const inserted: Array<{ id: string; contentHash: string }> = [];
    for (const r of data.rows) {
      const input: LedgerEntryInput = {
        companyId: data.companyId, sourceFileId: data.fileId,
        dimension: r.dimension as any, department: r.department,
        actorId: data.actorId, action: r.action, amountIqd: r.amount,
        entryDate: r.entryDate, metadata: r.metadata,
      };
      inserted.push(await appendEntry(input));
    }
    await rawDb.run(`UPDATE source_files SET status='CERTIFIED' WHERE id=?`, [data.fileId]);
    return { inserted: inserted.length, ids: inserted.map((i) => i.id) };
  });

export const rejectFile = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { fileId: string; reason: string })
  .handler(async ({ data }) => {
    await rawDb.run(`UPDATE source_files SET status='REJECTED' WHERE id=?`, [data.fileId]);
    return { ok: true };
  });

export const createReversingEntry = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { originalEntryId: string; correctionReason: string; actorId: string })
  .handler(async ({ data }) => await createReversal(data));

// ── Manager ─────────────────────────────────────────────────────────────

export const getManagerTasks = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const corrections = await rawDb.all<any, [string]>(
      `SELECT * FROM ledger_entries WHERE company_id = ? AND entry_kind = 'REVERSAL' ORDER BY created_at DESC LIMIT 50`,
      [data.companyId],
    );
    const pending = await rawDb.all<any, [string]>(
      `SELECT * FROM source_files WHERE company_id = ? AND status = 'PENDING' ORDER BY upload_date DESC LIMIT 20`,
      [data.companyId],
    );
    return { corrections, pending };
  });

// ── Advisor ─────────────────────────────────────────────────────────────

export const getAdvisorDeviations = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string; status?: string })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const status = data.status ?? "OPEN";
    const rows = await rawDb.all<any, [string, string]>(
      `SELECT * FROM deviations WHERE company_id = ? AND status = ?
       ORDER BY
         CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END,
         financial_impact_iqd DESC
       LIMIT 100`,
      [data.companyId, status],
    );
    const withPreferred = await Promise.all(rows.map(async (d) => {
      const pref = await rawDb.query<{ preferred_action: string }, [string, string]>(
        `SELECT preferred_action FROM advisor_preferences WHERE company_id = ? AND deviation_kind = ?`,
        [data.companyId, d.kind],
      );
      return { ...d, preferredDefault: pref?.preferred_action ?? d.suggested_default_action ?? "RESOLVE" };
    }));
    return { deviations: withPreferred };
  });

export const actOnDeviation = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as {
    deviationId: string;
    action: "RESOLVE" | "DISMISS" | "DEFER" | "REQUEST_ADVISORY" | "REVEAL_ROOT_CAUSE";
    actorId: string; notes?: string;
  })
  .handler(async ({ data }) => {
    const dev = await rawDb.query<any, [string]>(`SELECT * FROM deviations WHERE id = ?`, [data.deviationId]);
    if (!dev) throw new Error(`Deviation ${data.deviationId} not found`);

    const newStatus = ({
      RESOLVE: "RESOLVED",
      DISMISS: "DISMISSED",
      DEFER: "DEFERRED",
      REQUEST_ADVISORY: "ESCALATED",
      REVEAL_ROOT_CAUSE: dev.status,
    } as const)[data.action];

    await rawDb.run(
      `UPDATE deviations
       SET status = ?, action_taken = ?, action_taken_at = ?, action_taken_by = ?,
           root_cause_text = COALESCE(?, root_cause_text)
       WHERE id = ?`,
      [newStatus, data.action, new Date().toISOString(), data.actorId, data.notes ?? null, data.deviationId],
    );

    // Learn owner preference.
    const existing = await rawDb.query<{ sample_size: number }, [string, string]>(
      `SELECT sample_size FROM advisor_preferences WHERE company_id = ? AND deviation_kind = ?`,
      [dev.company_id, dev.kind],
    );

    if (existing) {
      await rawDb.run(
        `UPDATE advisor_preferences SET sample_size = sample_size + 1, preferred_action = ?, last_updated = ? WHERE company_id = ? AND deviation_kind = ?`,
        [data.action, new Date().toISOString(), dev.company_id, dev.kind],
      );
    } else {
      await rawDb.run(
        `INSERT INTO advisor_preferences (id, company_id, deviation_kind, preferred_action, sample_size, last_updated)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [`pref-${Date.now()}`, dev.company_id, dev.kind, data.action, new Date().toISOString()],
      );
    }
    return { ok: true };
  });

export const recalibrateThresholds = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const results = await recalibrateAllDimensions(data.companyId);
    return {
      ok: true,
      lastRecalibratedAt: new Date().toISOString(),
      results,
      calibratedCount: results.length,
    };
  });

// ── What-if ─────────────────────────────────────────────────────────────

export const runWhatIf = createServerFn({ method: "POST" })
  .validator((d: unknown) => d as { companyId: string; recoveryPct: number; costCutPct: number; collectionBoostPct: number })
  .handler(async ({ data }) => {
    await ensureCompany(data.companyId);
    const fk = await computeFinancialKpis(data.companyId);
    const baselineCash = fk.netCashFlowIqd;
    const months = Array.from({ length: 6 }).map((_, i) => {
      const monthFactor = (i + 1) / 6;
      const recoveryGain = fk.totalRevenueIqd * (data.recoveryPct / 100) * monthFactor;
      const costCutSaving = fk.totalExpensesIqd * (data.costCutPct / 100) * monthFactor;
      const collectionGain = fk.totalRevenueIqd * (data.collectionBoostPct / 100) * monthFactor;
      return Math.round(baselineCash + recoveryGain + costCutSaving + collectionGain);
    });
    return { months, baseline: baselineCash };
  });
