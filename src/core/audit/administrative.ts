// Administrative audit engine (§3.1).
// Quantitative KPIs (per spec): turnover rate, revenue per employee, cycle time.
// These replace the older "qualitative" indicators with measurable signals.

import { rawDb } from "../db/client";

export interface AdministrativeKpis {
  activeEmployees: number;          // distinct HR-system actor_ids seen this quarter
  departedEmployees: number;       // entries tagged with status=DEPARTED in metadata
  newHires: number;                // entries tagged with category=hire
  turnoverRatePct: number;         // departed / avg headcount × 100
  revenueIqd: number;              // SALE_RECORDED sum, last 90 days
  revenuePerEmployeeIqd: number;   // revenue / active employees
  avgDecisionCycleDays: number;    // mean gap between decision and decision_log entry
  departmentConcentrationPct: number; // top department's share of decisions
}

export interface AdministrativeFinding {
  kind: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  financialImpactIqd: number;
}

async function aggregate(companyId: string): Promise<AdministrativeKpis> {
  const ninetyDaysAgo = Date.now() - 90 * 86400000;
  const yearAgo = Date.now() - 365 * 86400000;

  const employees = await rawDb.all<{ actor_id: string }, [string]>(
    `SELECT DISTINCT actor_id FROM ledger_entries
      WHERE company_id = ?
        AND dimension = 'ADMINISTRATIVE'
        AND entry_date >= ?`,
    [companyId, new Date(ninetyDaysAgo).toISOString()],
  );
  const departures = await rawDb.all<{ c: number }, [string, string]>(
    `SELECT COUNT(*) AS c FROM ledger_entries
      WHERE company_id = ?
        AND dimension = 'ADMINISTRATIVE'
        AND json_extract(metadata_json, '$.status') = 'DEPARTED'
        AND entry_date >= ?`,
    [companyId, new Date(ninetyDaysAgo).toISOString()],
  );
  const hires = await rawDb.all<{ c: number }, [string, string]>(
    `SELECT COUNT(*) AS c FROM ledger_entries
      WHERE company_id = ?
        AND dimension = 'ADMINISTRATIVE'
        AND json_extract(metadata_json, '$.category') = 'hire'
        AND entry_date >= ?`,
    [companyId, new Date(ninetyDaysAgo).toISOString()],
  );

  const revenue = await rawDb.all<{ s: number }, [string, string]>(
    `SELECT COALESCE(SUM(amount_iqd), 0) AS s FROM ledger_entries
      WHERE company_id = ?
        AND action = 'SALE_RECORDED'
        AND entry_date >= ?`,
    [companyId, new Date(yearAgo).toISOString()],
  );

  const decisions = await rawDb.all<{ department: string; entry_date: string }, [string]>(
    `SELECT department, entry_date FROM ledger_entries
      WHERE company_id = ?
        AND dimension = 'ADMINISTRATIVE'
        AND action = 'DECISION_LOG'
      ORDER BY entry_date DESC
      LIMIT 200`,
    [companyId],
  );

  const activeEmployees = employees.length;
  const departedEmployees = departures[0]?.c ?? 0;
  const newHires = hires[0]?.c ?? 0;
  const turnoverRatePct = activeEmployees > 0
    ? (departedEmployees / ((activeEmployees + newHires) / 2)) * 100
    : 0;
  const revenueIqd = revenue[0]?.s ?? 0;
  const revenuePerEmployeeIqd = activeEmployees > 0 ? revenueIqd / activeEmployees : 0;

  let cycleAccum = 0, cycleCount = 0;
  const deptCounts = new Map<string, number>();
  for (let i = 0; i < decisions.length - 1; i++) {
    const curr = new Date(decisions[i].entry_date).getTime();
    const next = new Date(decisions[i + 1].entry_date).getTime();
    const diffDays = Math.abs(curr - next) / 86400000;
    if (diffDays < 30) { cycleAccum += diffDays; cycleCount += 1; }
    deptCounts.set(decisions[i].department, (deptCounts.get(decisions[i].department) ?? 0) + 1);
  }
  const avgDecisionCycleDays = cycleCount > 0 ? Math.round((cycleAccum / cycleCount) * 10) / 10 : 2;

  const totalDecisions = decisions.length || 1;
  const topDeptCount = Math.max(...deptCounts.values(), 0);
  const departmentConcentrationPct = (topDeptCount / totalDecisions) * 100;

  return {
    activeEmployees, departedEmployees, newHires,
    turnoverRatePct, revenueIqd, revenuePerEmployeeIqd,
    avgDecisionCycleDays, departmentConcentrationPct,
  };
}

export async function computeAdministrativeKpis(companyId: string): Promise<AdministrativeKpis> {
  return aggregate(companyId);
}

export async function findAdministrativeDeviations(companyId: string): Promise<AdministrativeFinding[]> {
  const k = await aggregate(companyId);
  const findings: AdministrativeFinding[] = [];

  // Turnover > 20% per quarter is a strong signal of internal issues.
  if (k.turnoverRatePct > 20) {
    findings.push({
      kind: "high_turnover",
      description: `معدل دوران الموظفين ${k.turnoverRatePct.toFixed(1)}% — أعلى من عتبة 20% في ربع.`,
      severity: k.turnoverRatePct > 35 ? "CRITICAL" : "HIGH",
      financialImpactIqd: Math.round(k.revenueIqd * 0.04),
    });
  }

  // Revenue per employee: only meaningful when we have headcount.
  if (k.activeEmployees >= 3 && k.revenuePerEmployeeIqd < 5_000_000) {
    findings.push({
      kind: "low_productivity",
      description: `إنتاجية الموظف ${(k.revenuePerEmployeeIqd / 1_000_000).toFixed(1)} مليون د.ع — أقل من عتبة 5 مليون د.ع.`,
      severity: "MEDIUM",
      financialImpactIqd: Math.round(k.revenueIqd * 0.03),
    });
  }

  // Cycle time > 7 days means slow decision-making.
  if (k.avgDecisionCycleDays > 7) {
    findings.push({
      kind: "slow_decisions",
      description: `متوسط زمن اتخاذ القرار ${k.avgDecisionCycleDays.toFixed(1)} يوم — بيروقراطية مرتفعة.`,
      severity: k.avgDecisionCycleDays > 14 ? "HIGH" : "MEDIUM",
      financialImpactIqd: Math.round(k.revenueIqd * 0.02),
    });
  }

  // Department concentration > 70% suggests decisions are bottlenecked.
  if (k.departmentConcentrationPct > 70) {
    findings.push({
      kind: "decision_bottleneck",
      description: `تركّز القرارات في قسم واحد (${k.departmentConcentrationPct.toFixed(0)}%) — مخاطر bottleneck.`,
      severity: "MEDIUM",
      financialImpactIqd: Math.round(k.revenueIqd * 0.015),
    });
  }

  return findings;
}
