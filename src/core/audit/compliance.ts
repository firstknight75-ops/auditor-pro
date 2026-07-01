import { rawDb } from "@/db/client";

export interface ComplianceItem {
  id: string;
  kind: string;
  description: string;
  expiresOn: string;
  daysUntilExpiry: number;
  status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";
  financialImpactIqd: number;
}

export interface ComplianceFinding {
  kind: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  financialImpactIqd: number;
}

export async function listComplianceItems(companyId: string): Promise<ComplianceItem[]> {
  const rows = await rawDb.all<any, [string]>(
    `SELECT id, action, metadata_json, created_at FROM ledger_entries
     WHERE company_id = ? AND dimension = 'COMPLIANCE'
     ORDER BY created_at DESC LIMIT 50`,
    [companyId],
  );

  const now = Date.now();
  return rows.map((r) => {
    const meta = r.metadata_json ? JSON.parse(r.metadata_json) : {};
    const expires = new Date(meta.expires_on ?? r.created_at);
    const days = Math.floor((expires.getTime() - now) / 86400000);
    let status: ComplianceItem["status"] = "ACTIVE";
    if (days < 0) status = "EXPIRED";
    else if (days <= 30) status = "EXPIRING_SOON";
    return {
      id: r.id, kind: meta.kind ?? "LICENSE", description: r.action,
      expiresOn: expires.toISOString(), daysUntilExpiry: days,
      status, financialImpactIqd: meta.penalty_iqd ?? 25_000_000,
    };
  });
}

export async function findComplianceDeviations(companyId: string): Promise<ComplianceFinding[]> {
  const items = await listComplianceItems(companyId);
  const findings: ComplianceFinding[] = [];
  for (const it of items) {
    if (it.status === "EXPIRED") {
      findings.push({
        kind: "expired_compliance",
        description: `${it.description} — منتهي الصلاحية منذ ${Math.abs(it.daysUntilExpiry)} يوماً.`,
        severity: "CRITICAL", financialImpactIqd: it.financialImpactIqd,
      });
    } else if (it.status === "EXPIRING_SOON" && it.daysUntilExpiry <= 14) {
      findings.push({
        kind: "expiring_compliance",
        description: `${it.description} — ينتهي خلال ${it.daysUntilExpiry} يوماً.`,
        severity: "CRITICAL", financialImpactIqd: Math.round(it.financialImpactIqd * 0.6),
      });
    } else if (it.status === "EXPIRING_SOON") {
      findings.push({
        kind: "expiring_compliance",
        description: `${it.description} — ينتهي خلال ${it.daysUntilExpiry} يوماً.`,
        severity: "HIGH", financialImpactIqd: Math.round(it.financialImpactIqd * 0.3),
      });
    }
  }
  return findings;
}
