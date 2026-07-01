export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface SeverityInput {
  financialImpactIqd: number;
  deteriorationSpeed: number;
  easeOfFix: number;
}

export function classifySeverity(input: SeverityInput): Severity {
  const fScore = Math.min(1, input.financialImpactIqd / 10_000_000);
  const composite = fScore * 0.6 + input.deteriorationSpeed * 0.25 + (1 - input.easeOfFix) * 0.15;
  if (composite >= 0.75) return "CRITICAL";
  if (composite >= 0.5) return "HIGH";
  if (composite >= 0.25) return "MEDIUM";
  return "LOW";
}

export function severityColor(s: Severity): "red" | "amber" | "yellow" | "green" {
  switch (s) {
    case "CRITICAL": return "red";
    case "HIGH": return "amber";
    case "MEDIUM": return "yellow";
    case "LOW": return "green";
  }
}

export function severityLabelAr(s: Severity): string {
  return s === "CRITICAL" ? "حرج" : s === "HIGH" ? "عالٍ" : s === "MEDIUM" ? "متوسط" : "منخفض";
}
