// Operational audit engine (§3.2) — async.
import { rawDb } from "@/db/client";

export interface OperationalKpis {
  totalProduced: number;
  totalWasted: number;
  totalDelivered: number;
  totalOrdered: number;
  wasteRatio: number;
  onTimeDeliveryRatio: number;
  inventoryTurnoverRatio: number;
  avgCycleTimeDays: number;
}

export interface OperationalFinding {
  kind: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  financialImpactIqd: number;
}

async function aggregate(companyId: string): Promise<OperationalKpis> {
  const rows = await rawDb.all<{ action: string; amount_iqd: number; metadata_json: string | null }, [string]>(
    `SELECT action, amount_iqd, metadata_json
       FROM ledger_entries
      WHERE company_id = ?
        AND dimension = 'OPERATIONAL'`,
    [companyId],
  );

  let produced = 0, wasted = 0, delivered = 0, ordered = 0;
  let cycleTimeAccum = 0, cycleTimeCount = 0;
  const sixtyDaysAgo = Date.now() - 60 * 86400000;

  for (const r of rows) {
    const meta = r.metadata_json ? JSON.parse(r.metadata_json) : {};
    const amt = Math.abs(r.amount_iqd);
    if (meta.category === "production") produced += amt;
    if (meta.category === "waste") wasted += amt;
    if (meta.category === "delivery" || r.action === "RECEIPT_LOG") delivered += amt;
    if (meta.category === "order" || r.action === "PURCHASE_ORDER") ordered += amt;
    if (r.action === "RECEIPT_LOG") {
      const entryTime = new Date(meta.entry_date ?? r.action).getTime();
      if (entryTime > sixtyDaysAgo) {
        cycleTimeAccum += 1;
        cycleTimeCount += 1;
      }
    }
  }

  const wasteRatio = produced > 0 ? wasted / produced : 0;
  const onTimeDeliveryRatio = ordered > 0 ? Math.min(1, delivered / ordered) : 1;
  const inventoryTurnoverRatio = produced > 0 ? delivered / produced : 0.5;
  const avgCycleTimeDays = cycleTimeCount > 0 ? Math.round(cycleTimeAccum / cycleTimeCount) : 5;

  return {
    totalProduced: produced,
    totalWasted: wasted,
    totalDelivered: delivered,
    totalOrdered: ordered,
    wasteRatio,
    onTimeDeliveryRatio,
    inventoryTurnoverRatio,
    avgCycleTimeDays,
  };
}

export async function computeOperationalKpis(companyId: string): Promise<OperationalKpis> {
  return aggregate(companyId);
}

export async function findOperationalDeviations(companyId: string): Promise<OperationalFinding[]> {
  const k = await aggregate(companyId);
  const findings: OperationalFinding[] = [];

  if (k.wasteRatio > 0.08) {
    findings.push({
      kind: "high_waste",
      description: `نسبة الهدر ${(k.wasteRatio * 100).toFixed(1)}% — أعلى من عتبة 8% للقطاع.`,
      severity: k.wasteRatio > 0.15 ? "CRITICAL" : k.wasteRatio > 0.11 ? "HIGH" : "MEDIUM",
      financialImpactIqd: Math.round(k.totalWasted * 0.4),
    });
  }
  if (k.onTimeDeliveryRatio < 0.85) {
    findings.push({
      kind: "late_delivery",
      description: `نسبة التسليم في الوقت ${(k.onTimeDeliveryRatio * 100).toFixed(0)}% — أقل من عتبة 85%.`,
      severity: k.onTimeDeliveryRatio < 0.7 ? "HIGH" : "MEDIUM",
      financialImpactIqd: Math.round(k.totalOrdered * 0.06),
    });
  }
  if (k.inventoryTurnoverRatio < 0.25 && k.totalProduced > 0) {
    findings.push({
      kind: "slow_inventory",
      description: `دوران المخزون ${(k.inventoryTurnoverRatio * 100).toFixed(0)}% — حركة بطيئة قد تشير لتكدس.`,
      severity: "MEDIUM",
      financialImpactIqd: Math.round(k.totalProduced * 0.05),
    });
  }
  if (k.avgCycleTimeDays > 7) {
    findings.push({
      kind: "long_cycle",
      description: `متوسط زمن الدورة ${k.avgCycleTimeDays} يوم — أبطأ من المعتاد (≤ 7 أيام).`,
      severity: k.avgCycleTimeDays > 14 ? "HIGH" : "MEDIUM",
      financialImpactIqd: Math.round(k.totalOrdered * 0.04),
    });
  }
  return findings;
}
