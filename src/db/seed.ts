// Seed data for development. Opt-in on Turso (set AUDITCORE_SEED=true
// to load the 12-company demo dataset on an empty remote DB).

import { rawDb } from "./client";
import { ensureSchema } from "./init";

interface SeedCompany {
  id: string;
  name: string;
  sector: "Retail" | "Manufacturing" | "Contracting" | "Services" | "ImportExport";
  branches: Array<{ id: string; name: string }>;
}

const COMPANIES: SeedCompany[] = [
  { id: "co-01", name: "نهر دجلة للتجزئة", sector: "Retail", branches: [{ id: "br-01-a", name: "الفرع الرئيسي - المنصور" }, { id: "br-01-b", name: "فرع الكرادة" }] },
  { id: "co-02", name: "بغداد للصناعات الغذائية", sector: "Manufacturing", branches: [{ id: "br-02-a", name: "مصنع اليوسفية" }] },
  { id: "co-03", name: "المقاولون العرب للمشاريع", sector: "Contracting", branches: [{ id: "br-03-a", name: "مشروع النجف السكني" }, { id: "br-03-b", name: "مشروع البصرة الصناعية" }] },
  { id: "co-04", name: "الزوراء للاستشارات", sector: "Services", branches: [{ id: "br-04-a", name: "المركز الرئيسي" }] },
  { id: "co-05", name: "الفرات للاستيراد والتصدير", sector: "ImportExport", branches: [{ id: "br-05-a", name: "مكتب بغداد" }, { id: "br-05-b", name: "ميناء أم قصر" }] },
  { id: "co-06", name: "سوبر ماركت بابل", sector: "Retail", branches: [{ id: "br-06-a", name: "فرع بابل" }] },
  { id: "co-07", name: "الموصل للدهانات", sector: "Manufacturing", branches: [{ id: "br-07-a", name: "مصنع الموصل" }] },
  { id: "co-08", name: "إعمار كربلاء", sector: "Contracting", branches: [{ id: "br-08-a", name: "مشروع كربلاء" }] },
  { id: "co-09", name: "تقنية العراق للحلول", sector: "Services", branches: [{ id: "br-09-a", name: "بغداد - الكرادة داخل" }] },
  { id: "co-10", name: "النخبة للتجارة الدولية", sector: "ImportExport", branches: [{ id: "br-10-a", name: "المركز الرئيسي" }] },
  { id: "co-11", name: "أسواق النجف", sector: "Retail", branches: [{ id: "br-11-a", name: "فرع النجف القديم" }, { id: "br-11-b", name: "فرع الكوفة" }] },
  { id: "co-12", name: "حديد الجنوب", sector: "Manufacturing", branches: [{ id: "br-12-a", name: "مصنع البصرة" }] },
];

const SECTOR_THRESHOLDS: Record<string, Record<string, { critical: number; high: number; medium: number }>> = {
  Retail: { FINANCIAL: { critical: 0.35, high: 0.2, medium: 0.1 }, COMMERCIAL: { critical: 0.4, high: 0.25, medium: 0.12 } },
  Manufacturing: { FINANCIAL: { critical: 0.3, high: 0.18, medium: 0.09 }, OPERATIONAL: { critical: 0.25, high: 0.15, medium: 0.07 } },
  Contracting: { FINANCIAL: { critical: 0.32, high: 0.2, medium: 0.1 }, OPERATIONAL: { critical: 0.3, high: 0.18, medium: 0.09 } },
  Services: { ADMINISTRATIVE: { critical: 0.35, high: 0.22, medium: 0.11 }, FINANCIAL: { critical: 0.3, high: 0.18, medium: 0.09 } },
  ImportExport: { COMPLIANCE: { critical: 0.25, high: 0.15, medium: 0.07 }, FINANCIAL: { critical: 0.35, high: 0.22, medium: 0.11 } },
};

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString();
}

function fakeHash(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(64, "0");
}

async function generateLedgerEntries(seed: { companyId: string; count: number; dimensions: Array<"FINANCIAL" | "OPERATIONAL" | "ADMINISTRATIVE" | "COMMERCIAL" | "HUMAN_PERFORMANCE" | "COMPLIANCE"> }): Promise<void> {
  const departments = ["Finance", "Warehouse", "Sales", "HR", "Procurement"];
  const actors = ["actor-finance-1", "actor-finance-2", "actor-auditor-1", "actor-manager-1"];
  const actions = ["CERTIFIED_INVOICE", "RECEIPT_LOG", "PAYMENT_POSTED", "SALE_RECORDED", "PURCHASE_ORDER", "ATTENDANCE_LOG"];

  for (let i = 0; i < seed.count; i++) {
    const dim = seed.dimensions[i % seed.dimensions.length];
    const amount = Math.floor((Math.random() * 50 + 1) * 1_000_000);
    const id = `le-${seed.companyId}-${i.toString().padStart(4, "0")}`;
    const department = departments[i % departments.length];
    const actor = actors[i % actors.length];
    const action = actions[i % actions.length];
    await rawDb.run(
      `INSERT INTO ledger_entries
        (id, company_id, dimension, department, actor_id, action, amount_iqd, entry_date, entry_kind, status, content_hash, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'NORMAL', 'ACTIVE', ?, ?)`,
      [id, seed.companyId, dim, department, actor, action, amount,
       randomDate(90), fakeHash(`${seed.companyId}-${id}`),
       JSON.stringify({ seed: true, idx: i })],
    );
  }
}

export async function seedIfEmpty(): Promise<void> {
  await ensureSchema();
  const existing = await rawDb.query<{ c: number }, []>(
    "SELECT COUNT(*) AS c FROM companies",
  );
  if (existing && existing.c > 0) return;

  // On Turso we only seed when AUDITCORE_SEED=true — protects prod data
  // from accidental demo inserts. On local dev we always seed for DX.
  const isProd = !!(process.env.TURSO_DATABASE_URL || process.env.AUDITCORE_TURSO);
  const wantSeed = process.env.AUDITCORE_SEED === "true";
  if (isProd && !wantSeed) {
    console.log("[seed] skipping on production DB (set AUDITCORE_SEED=true to load demo data)");
    return;
  }

  console.log("[seed] populating 12 companies + ledger entries...");

  const profileIds = new Map<string, string>();
  for (const sector of Object.keys(SECTOR_THRESHOLDS)) {
    const pid = `cfg-${sector.toLowerCase()}`;
    await rawDb.run(
      `INSERT INTO config_profiles (id, sector, dimension_thresholds_json, last_recalibrated_at) VALUES (?, ?, ?, ?)`,
      [pid, sector, JSON.stringify(SECTOR_THRESHOLDS[sector]), new Date().toISOString()],
    );
    profileIds.set(sector, pid);
  }

  const sectorLedgerCount: Record<string, number> = {
    Retail: 80, Manufacturing: 90, Contracting: 110, Services: 60, ImportExport: 100,
  };

  for (const c of COMPANIES) {
    await rawDb.run(
      `INSERT INTO companies (id, name, sector, config_profile_id) VALUES (?, ?, ?, ?)`,
      [c.id, c.name, c.sector, profileIds.get(c.sector)!],
    );
    for (const b of c.branches) {
      await rawDb.run(
        `INSERT INTO branches (id, company_id, name, address) VALUES (?, ?, ?, NULL)`,
        [b.id, c.id, b.name],
      );
    }

    let dims: Array<"FINANCIAL" | "OPERATIONAL" | "ADMINISTRATIVE" | "COMMERCIAL" | "HUMAN_PERFORMANCE" | "COMPLIANCE">;
    switch (c.sector) {
      case "Retail": dims = ["FINANCIAL", "COMMERCIAL", "COMPLIANCE", "OPERATIONAL"]; break;
      case "Manufacturing": dims = ["FINANCIAL", "OPERATIONAL", "COMPLIANCE", "HUMAN_PERFORMANCE"]; break;
      case "Contracting": dims = ["FINANCIAL", "OPERATIONAL", "ADMINISTRATIVE", "COMPLIANCE"]; break;
      case "Services": dims = ["ADMINISTRATIVE", "FINANCIAL", "HUMAN_PERFORMANCE", "COMMERCIAL"]; break;
      case "ImportExport": dims = ["COMPLIANCE", "FINANCIAL", "OPERATIONAL", "COMMERCIAL"]; break;
    }

    await generateLedgerEntries({
      companyId: c.id,
      count: sectorLedgerCount[c.sector] ?? 70,
      dimensions: dims,
    });
  }

  // Sample deviations so the dashboard has content out of the box.
  const sampleDeviations = [
    { co: "co-01", dim: "FINANCIAL", sev: "HIGH", impact: 12_400_000, title: "تناقض بين تقرير المبيعات والمخزون", desc: "تقرير المبيعات يظهر 2,400 وحدة مباعة لكن المخزون لم يسجل حركة مقابلة.", layer: "SILENT", action: "REVEAL_ROOT_CAUSE" },
    { co: "co-02", dim: "OPERATIONAL", sev: "CRITICAL", impact: 28_700_000, title: "ارتفاع مفاجئ بمصاريف الصيانة", desc: "مصاريف الصيانة تجاوزت المعيار بنسبة 38% خلال 14 يوم.", layer: "DIRECT", action: "RESOLVE" },
    { co: "co-03", dim: "COMMERCIAL", sev: "MEDIUM", impact: 6_800_000, title: "تراجع CAC بنسبة 22%", desc: "تكلفة استحواذ العميل ترتفع دون نمو موازٍ بعدد العملاء الجدد.", layer: "DIRECT", action: "REQUEST_ADVISORY" },
    { co: "co-05", dim: "COMPLIANCE", sev: "CRITICAL", impact: 45_000_000, title: "ترخيص استيراد ينتهي خلال 12 يوماً", desc: "ترخيص استيراد المواد الغذائية رقم IMP-2024-1187 ينتهي بدون تجديد.", layer: "DIRECT", action: "RESOLVE" },
    { co: "co-08", dim: "ADMINISTRATIVE", sev: "HIGH", impact: 9_200_000, title: "دوران موظفين مرتفع بقسم واحد", desc: "قسم المحاسبة فقد 4 موظفين خلال 90 يوماً بمعدل غير طبيعي.", layer: "DIRECT", action: "REQUEST_ADVISORY" },
    { co: "co-11", dim: "FINANCIAL", sev: "HIGH", impact: 18_500_000, title: "فواتير مكررة من نفس المورد", desc: "نفس فاتورة المورد X ظهرت بقسمي المشتريات والمالية بصياغة مختلفة.", layer: "SILENT", action: "REVEAL_ROOT_CAUSE" },
    { co: "co-12", dim: "OPERATIONAL", sev: "LOW", impact: 1_800_000, title: "تذبذب موسمي بمخزون الحديد", desc: "تراجع بنسبة 8% خلال فترة طلب ضعيفة - ضمن النطاق الموسمي.", layer: "DIRECT", action: "DISMISS" },
  ];

  for (const d of sampleDeviations) {
    await rawDb.run(
      `INSERT INTO deviations
        (id, company_id, dimension, severity, financial_impact_iqd, title, description, source_layer, status, suggested_default_action, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
      [
        `dev-${d.co}-${Math.random().toString(36).slice(2, 8)}`,
        d.co, d.dim, d.sev, d.impact, d.title, d.desc, d.layer, d.action,
        new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000).toISOString(),
      ],
    );
  }

  console.log("[seed] done.");
}
