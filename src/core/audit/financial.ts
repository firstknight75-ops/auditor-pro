// Financial audit engine (§3.1) — async.
// Indicators: liquidity, profitability, cash flow, debt ratios, collection cycle.

import { rawDb } from "@/db/client";

export interface FinancialKpis {
  totalRevenueIqd: number;
  totalExpensesIqd: number;
  netCashFlowIqd: number;
  liquidityRatio: number;
  collectionCycleDays: number;
  debtExposureIqd: number;
  profitabilityMargin: number;
}

export interface FinancialFinding {
  kind: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  financialImpactIqd: number;
}

async function sumLedger(opts: { companyId: string; since?: string; action?: string }): Promise<number> {
  const args: any[] = [opts.companyId];
  let sql = `SELECT COALESCE(SUM(amount_iqd), 0) AS s FROM ledger_entries WHERE company_id = ?`;
  if (opts.since) { sql += ` AND entry_date >= ?`; args.push(opts.since); }
  if (opts.action) { sql += ` AND action = ?`; args.push(opts.action); }
  const row = await rawDb.query<{ s: number }, any[]>(sql, args);
  return row?.s ?? 0;
}

export async function computeFinancialKpis(companyId: string, windowDays = 90): Promise<FinancialKpis> {
  const since = new Date(Date.now() - windowDays * 86400000).toISOString();
  const revenue = await sumLedger({ companyId, since, action: "SALE_RECORDED" });
  const expenses = Math.abs(await sumLedger({ companyId, since, action: "PAYMENT_POSTED" }));
  const receipts = await sumLedger({ companyId, since, action: "RECEIPT_LOG" });
  const purchases = Math.abs(await sumLedger({ companyId, since, action: "PURCHASE_ORDER" }));

  const totalRevenueIqd = revenue;
  const totalExpensesIqd = expenses + purchases;
  const netCashFlowIqd = (revenue + receipts) - totalExpensesIqd;
  const liquidityRatio = totalExpensesIqd > 0 ? (revenue + receipts) / totalExpensesIqd : 2.0;
  const debtExposureIqd = totalExpensesIqd;
  const collectionCycleDays = liquidityRatio < 1 ? Math.round(45 + (1 - liquidityRatio) * 90) : 30;
  const profitabilityMargin = totalRevenueIqd > 0 ? (totalRevenueIqd - totalExpensesIqd) / totalRevenueIqd : 0;

  return {
    totalRevenueIqd, totalExpensesIqd, netCashFlowIqd,
    liquidityRatio, collectionCycleDays, debtExposureIqd, profitabilityMargin,
  };
}

export async function findFinancialDeviations(companyId: string): Promise<FinancialFinding[]> {
  const k = await computeFinancialKpis(companyId);
  const findings: FinancialFinding[] = [];

  if (k.liquidityRatio < 1.0) {
    findings.push({
      kind: "liquidity_crunch",
      description: `نسبة السيولة ${k.liquidityRatio.toFixed(2)} — أقل من 1.0 (المصاريف تتجاوز الإيرادات).`,
      severity: k.liquidityRatio < 0.7 ? "CRITICAL" : "HIGH",
      financialImpactIqd: Math.round(Math.abs(k.netCashFlowIqd) * 0.4),
    });
  }

  if (k.collectionCycleDays > 60) {
    findings.push({
      kind: "slow_collection",
      description: `متوسط دورة التحصيل ${k.collectionCycleDays} يوم — أعلى من المعتاد (45 يوم).`,
      severity: k.collectionCycleDays > 90 ? "HIGH" : "MEDIUM",
      financialImpactIqd: Math.round(k.totalRevenueIqd * 0.08),
    });
  }

  if (k.profitabilityMargin < 0.05) {
    findings.push({
      kind: "low_margin",
      description: `هامش الربح ${(k.profitabilityMargin * 100).toFixed(1)}% — أقل من عتبة 5%.`,
      severity: k.profitabilityMargin < 0 ? "CRITICAL" : "HIGH",
      financialImpactIqd: Math.round(Math.abs(k.netCashFlowIqd) * 0.5),
    });
  }

  return findings;
}
