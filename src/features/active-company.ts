// apps/web/src/company/active-company.ts

export const ACTIVE_COMPANY_KEY = "auditcore.active.company";

export function getActiveCompanyId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_COMPANY_KEY) ?? "";
}

export function setActiveCompanyId(companyId: string): void {
  localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
  window.dispatchEvent(new Event("auditcore.active_company_changed"));
}