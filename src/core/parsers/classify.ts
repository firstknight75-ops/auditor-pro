export type Dimension =
  | "FINANCIAL" | "OPERATIONAL" | "ADMINISTRATIVE"
  | "COMMERCIAL" | "HUMAN_PERFORMANCE" | "COMPLIANCE";

const DIMENSION_SIGNALS: Record<Dimension, string[]> = {
  FINANCIAL: ["invoice", "amount", "payment", "cash", "balance", "receipt", "فاتورة", "مبلغ", "دفع", "رصيد", "سند"],
  OPERATIONAL: ["production", "inventory", "warehouse", "yield", "delivery", "إنتاج", "مخزون", "مستودع", "هدر", "تسليم"],
  ADMINISTRATIVE: ["employee", "attendance", "decision", "meeting", "موظف", "حضور", "قرار", "اجتماع", "هيكل"],
  COMMERCIAL: ["customer", "sale", "order", "revenue", "marketing", "عميل", "مبيعات", "طلب", "تسويق", "إيراد"],
  HUMAN_PERFORMANCE: ["performance", "evaluation", "rating", "productivity", "أداء", "تقييم", "إنتاجية"],
  COMPLIANCE: ["license", "tax", "regulation", "permit", "ترخيص", "ضريبة", "تنظيم", "تصريح"],
};

const ACTION_BY_DIMENSION: Record<Dimension, string[]> = {
  FINANCIAL: ["CERTIFIED_INVOICE", "PAYMENT_POSTED", "RECEIPT_LOG"],
  OPERATIONAL: ["RECEIPT_LOG", "PRODUCTION_LOG"],
  ADMINISTRATIVE: ["ATTENDANCE_LOG", "DECISION_LOG"],
  COMMERCIAL: ["SALE_RECORDED", "PURCHASE_ORDER"],
  HUMAN_PERFORMANCE: ["ATTENDANCE_LOG", "PERFORMANCE_REVIEW"],
  COMPLIANCE: ["LICENSE_RENEWAL", "TAX_FILING"],
};

export interface ClassifyInput {
  columns: string[];
  sampleRows: Array<Record<string, string | null>>;
}

export interface ClassifyResult {
  dimension: Dimension;
  confidence: number;
  department: string;
  suggestedAction: string;
  detectedFields: Record<string, string>;
}

export function classifyDimension(input: ClassifyInput): ClassifyResult {
  const colHaystack = input.columns.join(" ").toLowerCase();
  const scores: Record<Dimension, number> = {
    FINANCIAL: 0, OPERATIONAL: 0, ADMINISTRATIVE: 0,
    COMMERCIAL: 0, HUMAN_PERFORMANCE: 0, COMPLIANCE: 0,
  };

  for (const [dim, signals] of Object.entries(DIMENSION_SIGNALS) as Array<[Dimension, string[]]>) {
    for (const signal of signals) {
      if (colHaystack.includes(signal.toLowerCase())) scores[dim] += 1;
    }
  }

  const entries = Object.entries(scores) as Array<[Dimension, number]>;
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const total = entries.reduce((acc, [, s]) => acc + s, 0) || 1;
  const confidence = top[1] > 0 ? top[1] / total : 0;
  const dimension: Dimension = top[1] > 0 ? top[0] : "FINANCIAL";
  const action = ACTION_BY_DIMENSION[dimension][0];

  const department =
    dimension === "FINANCIAL" ? "Finance" :
    dimension === "OPERATIONAL" ? "Warehouse" :
    dimension === "COMMERCIAL" ? "Sales" :
    dimension === "ADMINISTRATIVE" ? "HR" :
    dimension === "COMPLIANCE" ? "Compliance" : "HR";

  const detectedFields: Record<string, string> = {};
  for (const col of input.columns) {
    const lc = col.toLowerCase();
    if (lc.includes("amount") || lc.includes("total") || lc.includes("مبلغ") || lc.includes("قيمة")) detectedFields.amount = col;
    if (lc.includes("date") || lc.includes("تاريخ")) detectedFields.date = col;
    if (lc.includes("invoice") || lc.includes("ref") || lc.includes("رقم") || lc.includes("مرجع")) detectedFields.ref = col;
    if (lc.includes("customer") || lc.includes("عميل") || lc.includes("supplier") || lc.includes("مورد")) detectedFields.party = col;
  }

  return { dimension, confidence, department, suggestedAction: action, detectedFields };
}

export function inferAmountIqd(row: Record<string, string | null>, amountCol?: string): number {
  if (!amountCol) return 0;
  const raw = row[amountCol];
  if (raw == null) return 0;
  const cleaned = String(raw).replace(/[^0-9.-]/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

export function inferDateIso(row: Record<string, string | null>, dateCol?: string): string {
  if (!dateCol) return new Date().toISOString();
  const raw = row[dateCol];
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}
