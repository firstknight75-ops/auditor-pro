import { rawDb } from "../../db/client";

export interface CommercialKpis {
  totalRevenueIqd: number; newCustomers: number; marketingSpendIqd: number;
  cacIqd: number; avgPurchaseIqd: number; avgPurchasesPerYear: number;
  avgCustomerLifespanYears: number; ltvIqd: number; ltvCacRatio: number;
  retentionRatePct: number; topCustomerConcentrationPct: number; top3ConcentrationPct: number;
}

export interface CommercialFinding {
  kind: string; description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  financialImpactIqd: number;
}

function countNewCustomers(companyId: string, sinceIso: string): number {
  const row = rawDb.query<{ c: number }, [string, string]>(
    `SELECT COUNT(DISTINCT actor_id) AS c FROM ledger_entries
     WHERE company_id = ? AND action = 'SALE_RECORDED' AND entry_date >= ?`,
  ).get(companyId, sinceIso);
  return row?.c ?? 0;
}

function sumMarketingSpend(companyId: string, sinceIso: string): number {
  const rows = rawDb.query<any, [string, string]>(
    `SELECT amount_iqd, metadata_json FROM ledger_entries
     WHERE company_id = ? AND entry_date >= ?
     AND department = 'Sales' AND action = 'PAYMENT_POSTED'`,
  ).all(companyId, sinceIso);
  let total = 0;
  for (const r of rows) {
    const meta = r.metadata_json ? JSON.parse(r.metadata_json) : {};
    if (meta.category === "marketing") total += Math.abs(r.amount_iqd);
  }
  return total;
}

export function computeCommercialKpis(companyId: string, windowDays = 90): CommercialKpis {
  const since = new Date(Date.now() - windowDays * 86400000).toISOString();
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
  const newCustomers = countNewCustomers(companyId, since);
  const marketingSpendIqd = sumMarketingSpend(companyId, since);
  const cacIqd = newCustomers > 0 ? marketingSpendIqd / newCustomers : 0;

  const revenueRow = rawDb.query<{ s: number }, [string, string]>(
    `SELECT COALESCE(SUM(amount_iqd), 0) AS s FROM ledger_entries
     WHERE company_id = ? AND action = 'SALE_RECORDED' AND entry_date >= ?`,
  ).get(companyId, yearAgo);
  const totalRevenueIqd = revenueRow?.s ?? 0;

  const avgPurchaseIqd = newCustomers > 0 ? totalRevenueIqd / newCustomers : 0;
  const avgPurchasesPerYear = 4;
  const avgCustomerLifespanYears = 2.5;
  const ltvIqd = avgPurchaseIqd * avgPurchasesPerYear * avgCustomerLifespanYears;
  const ltvCacRatio = cacIqd > 0 ? ltvIqd / cacIqd : 0;

  const retentionRow = rawDb.query<{ start: number; end: number; newCount: number }, [string, string, string, string, string, string]>(
    `SELECT
       (SELECT COUNT(DISTINCT actor_id) FROM ledger_entries WHERE company_id = ? AND action='SALE_RECORDED' AND entry_date < ?) AS start,
       (SELECT COUNT(DISTINCT actor_id) FROM ledger_entries WHERE company_id = ? AND action='SALE_RECORDED' AND entry_date >= ?) AS end,
       (SELECT COUNT(DISTINCT actor_id) FROM ledger_entries WHERE company_id = ? AND action='SALE_RECORDED' AND entry_date >= ?) AS newCount`,
  ).get(companyId, since, companyId, since, companyId, since);
  const startCust = retentionRow?.start ?? 0;
  const endCust = retentionRow?.end ?? 0;
  const newCust = retentionRow?.newCount ?? 0;
  const retentionRatePct = startCust > 0 ? Math.max(0, ((endCust - newCust) / startCust) * 100) : 100;

  const topRows = rawDb.query<{ actor_id: string; s: number }, [string, string]>(
    `SELECT actor_id, SUM(amount_iqd) AS s FROM ledger_entries
     WHERE company_id = ? AND action = 'SALE_RECORDED' AND entry_date >= ?
     GROUP BY actor_id ORDER BY s DESC LIMIT 3`,
  ).all(companyId, yearAgo);

  const top1 = topRows[0]?.s ?? 0;
  const top3 = topRows.reduce((acc, r) => acc + r.s, 0);
  const topCustomerConcentrationPct = totalRevenueIqd > 0 ? (top1 / totalRevenueIqd) * 100 : 0;
  const top3ConcentrationPct = totalRevenueIqd > 0 ? (top3 / totalRevenueIqd) * 100 : 0;

  return {
    totalRevenueIqd, newCustomers, marketingSpendIqd, cacIqd,
    avgPurchaseIqd, avgPurchasesPerYear, avgCustomerLifespanYears,
    ltvIqd, ltvCacRatio, retentionRatePct,
    topCustomerConcentrationPct, top3ConcentrationPct,
  };
}

export function findCommercialDeviations(companyId: string): CommercialFinding[] {
  const k = computeCommercialKpis(companyId);
  const findings: CommercialFinding[] = [];

  if (k.ltvCacRatio > 0 && k.ltvCacRatio < 3) {
    findings.push({
      kind: "weak_ltv_cac",
      description: `نسبة LTV:CAC = ${k.ltvCacRatio.toFixed(2)} — أقل من العتبة الصحية 3:1.`,
      severity: k.ltvCacRatio < 1.5 ? "CRITICAL" : k.ltvCacRatio < 2 ? "HIGH" : "MEDIUM",
      financialImpactIqd: Math.round(k.totalRevenueIqd * 0.05),
    });
  }
  if (k.retentionRatePct < 70) {
    findings.push({
      kind: "weak_retention",
      description: `معدل الاحتفاظ بالعملاء ${k.retentionRatePct.toFixed(1)}% — أقل من عتبة 70%.`,
      severity: k.retentionRatePct < 50 ? "HIGH" : "MEDIUM",
      financialImpactIqd: Math.round(k.totalRevenueIqd * 0.04),
    });
  }
  if (k.topCustomerConcentrationPct > 30) {
    findings.push({
      kind: "customer_concentration",
      description: `أكبر عميل يمثل ${k.topCustomerConcentrationPct.toFixed(1)}% من الإيراد — مخاطرة تركّز.`,
      severity: k.topCustomerConcentrationPct > 50 ? "CRITICAL" : "HIGH",
      financialImpactIqd: Math.round(k.totalRevenueIqd * 0.12),
    });
  }
  return findings;
}
