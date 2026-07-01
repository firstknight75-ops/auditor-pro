export function formatIqd(amount: number): string {
  return `${amount.toLocaleString("en-US")} د.ع`;
}

export function formatIqdShort(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} مليار د.ع`;
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)} مليون د.ع`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(1)} ألف د.ع`;
  return `${amount.toLocaleString("en-US")} د.ع`;
}

export function estimateIqdImpact(opts: {
  dimension: string;
  kind: string;
  baseAmount?: number;
  pct?: number;
}): number {
  const { dimension, kind, baseAmount = 10_000_000, pct = 0.2 } = opts;
  const multiplier: Record<string, number> = {
    duplicate_invoice: 1.0, stock_mismatch: 0.6, payment_delay: 0.4,
    late_payment: 0.3, expiry: 0.8, unauthorized: 1.2,
    concentration_risk: 0.9, churn: 0.5, waste: 0.7,
  };
  const dimensionWeight: Record<string, number> = {
    FINANCIAL: 1.2, OPERATIONAL: 0.9, ADMINISTRATIVE: 0.6,
    COMMERCIAL: 1.0, HUMAN_PERFORMANCE: 0.5, COMPLIANCE: 1.3,
  };
  const m = multiplier[kind] ?? 0.5;
  const w = dimensionWeight[dimension] ?? 1.0;
  return Math.round(baseAmount * pct * m * w);
}
