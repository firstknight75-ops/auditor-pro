import { rawDb } from "../../db/client";

export interface BridgeFinding {
  kind: string; description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  financialImpactIqd: number;
  involvedEntries: string[];
}

export function runSmartBridge(companyId: string): BridgeFinding[] {
  const findings: BridgeFinding[] = [];

  const dupRows = rawDb.query<any, [string]>(
    `SELECT action, actor_id, amount_iqd, COUNT(*) AS c, GROUP_CONCAT(id) AS ids
     FROM ledger_entries WHERE company_id = ?
     GROUP BY action, actor_id, amount_iqd
     HAVING c > 1 LIMIT 50`,
  ).all(companyId);

  for (const r of dupRows) {
    const ids = String(r.ids).split(",");
    findings.push({
      kind: "duplicate_invoice",
      description: `${r.action} مكرر بنفس المبلغ (${Math.abs(r.amount_iqd).toLocaleString()} د.ع) — ${r.c} مرات.`,
      severity: r.c > 2 ? "CRITICAL" : "HIGH",
      financialImpactIqd: Math.round(Math.abs(r.amount_iqd) * (r.c - 1)),
      involvedEntries: ids,
    });
  }

  const contradictions = rawDb.query<any, [string]>(
    `SELECT a.id AS aid, b.id AS bid, a.action AS a_action, b.action AS b_action,
            a.amount_iqd AS a_amt, b.amount_iqd AS b_amt, a.entry_date
     FROM ledger_entries a
     JOIN ledger_entries b
       ON a.company_id = b.company_id
      AND a.entry_date = b.entry_date
      AND a.department != b.department
      AND a.action = b.action
      AND ABS(a.amount_iqd - b.amount_iqd) > 0
     WHERE a.company_id = ?
     LIMIT 50`,
  ).all(companyId);

  for (const r of contradictions) {
    findings.push({
      kind: "cross_dept_contradiction",
      description: `${r.a_action}: ${r.a_amt.toLocaleString()} د.ع في ${r.a_action} ≠ ${r.b_amt.toLocaleString()} د.ع في قسم آخر بنفس اليوم.`,
      severity: "CRITICAL",
      financialImpactIqd: Math.abs(r.a_amt - r.b_amt),
      involvedEntries: [r.aid, r.bid],
    });
  }
  return findings;
}
