// apps/web/src/lib/mock.ts

export const mockCompanies = Array.from({ length: 12 }).map((_, i) => ({
  id: `mock-company-${i + 1}`,
  name: `Company ${i + 1}`,
  sector: i % 3 === 0 ? "Retail" : i % 3 === 1 ? "Manufacturing" : "Contracting",
}));

export function mockOwnerIndex(companyId: string) {
  return {
    companyId,
    kpis: {
      wasteIqd: 12_450_000,
      trustIndex: 87,
      criticalAlerts: 4,
      predictedCashIqd: 184_000_000,
      auditorEfficiencyPct: 91,
    },
    recommendedActions: [
      "شنو أسوي الحين؟ أوقف دفع فاتورة المورد X لحين تحقق المخزن.",
      "وين الخطر؟ هناك تناقض بين Finance و Warehouse على فاتورة #INV-221.",
      "شنو يعني الرقم؟ انخفاض Trust Index سببه حقول مفقودة وتكرار ملفين.",
    ],
  };
}

export function mockTrustIndex(companyId: string) {
  return {
    companyId,
    score: 87,
    breakdown: [
      { label: "Coverage", value: "94%" },
      { label: "Certified", value: "89%" },
      { label: "Missing Fields", value: "11" },
      { label: "Duplicates", value: "2" },
    ],
    trend: [82, 85, 83, 88, 86, 87],
  };
}

export function mockLedger() {
  return {
    records: [
      {
        id: "L-1001",
        actor_id: "auditor-1",
        action: "CERTIFIED_INVOICE",
        department: "Finance",
        dimension: "FINANCIAL",
        amount_iqd: 7200000,
        entry_kind: "NORMAL",
        content_hash:
          "7a3e2b8f3f8a0b928ac093a2e0e451b93c5e7d25c7a5e965b7aa7cc833999aaa",
        created_at: new Date().toISOString(),
      },
      {
        id: "L-1002",
        actor_id: "manager-1",
        action: "REVERSING_ENTRY",
        department: "Warehouse",
        dimension: "OPERATIONAL",
        amount_iqd: -1800000,
        entry_kind: "REVERSAL",
        content_hash:
          "b8b67ac6320d831e331fb12e1ab8d42b66bd18db2124ccbbcc7e82c0a4e7214c",
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  };
}