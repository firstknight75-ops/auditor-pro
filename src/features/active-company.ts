// Active-company state shared across the app.
// Persists the active tenant ID in localStorage and broadcasts changes
// so all tenant-scoped hooks (useTenantResource, etc.) reload in sync.

export const ACTIVE_COMPANY_KEY = "auditcore.active.company";
export const ACTIVE_COMPANY_CHANGED = "auditcore.active_company_changed";

export interface ActiveCompany {
  id: string;
  name: string;
  sector: string;
}

export function getActiveCompanyId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_COMPANY_KEY) ?? "";
}

export function setActiveCompanyId(companyId: string): void {
  if (typeof window === "undefined") return;
  if (!companyId) return;
  localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
  window.dispatchEvent(new Event(ACTIVE_COMPANY_CHANGED));
}

export function clearActiveCompany(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_COMPANY_KEY);
  window.dispatchEvent(new Event(ACTIVE_COMPANY_CHANGED));
}

// Returns the active company metadata. Falls back to the first company
// from a static list if nothing is set yet (so the app renders on first load).
export function getActiveCompany(): ActiveCompany {
  const id = getActiveCompanyId();
  if (id) {
    return { id, name: id, sector: "" };
  }
  return { id: "", name: "لم يتم اختيار شركة", sector: "" };
}

// Validates that the supplied id is one of the known seed company ids.
// Returns a normalized id (or empty string if invalid).
export function normalizeActiveCompanyId(candidate: string, knownIds: string[]): string {
  if (!candidate) return "";
  if (knownIds.includes(candidate)) return candidate;
  // Try common alias shapes (mock-company-N → co-N).
  const aliasMatch = /^mock-company-(\d+)$/.exec(candidate);
  if (aliasMatch) {
    const n = parseInt(aliasMatch[1], 10);
    const aliased = `co-${n.toString().padStart(2, "0")}`;
    if (knownIds.includes(aliased)) return aliased;
  }
  return "";
}

// Subscribe to active-company changes. Returns an unsubscribe function.
export function onActiveCompanyChange(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ACTIVE_COMPANY_CHANGED, handler);
  return () => window.removeEventListener(ACTIVE_COMPANY_CHANGED, handler);
}
