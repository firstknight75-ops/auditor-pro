// Session state for the current user.
// Persisted in sessionStorage (per-tab) so a refresh keeps the role.
// Real auth would replace this with a token/JWT lookup.

import { type Role, ROLES } from "./access";

const ROLE_KEY = "auditcore.session.role";
const ASSIGNED_KEY = "auditcore.session.assignedCompanies";

export interface Session {
  role: Role;
  // The company IDs this user is assigned to. Empty = all (owner).
  assignedCompanyIds: string[];
}

function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}

export function getSession(): Session {
  if (typeof window === "undefined") {
    return { role: "owner", assignedCompanyIds: [] };
  }
  const stored = sessionStorage.getItem(ROLE_KEY);
  const role: Role = isRole(stored) ? stored : "owner";
  const assigned = sessionStorage.getItem(ASSIGNED_KEY);
  const ids = assigned ? assigned.split(",").filter(Boolean) : [];
  return { role, assignedCompanyIds: ids };
}

export function setRole(role: Role): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ROLE_KEY, role);
  window.dispatchEvent(new CustomEvent("auditcore.session_changed"));
}

export function setAssignedCompanyIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ASSIGNED_KEY, ids.join(","));
  window.dispatchEvent(new CustomEvent("auditcore.session_changed"));
}

export function isAssignedTo(companyId: string): boolean {
  const s = getSession();
  if (s.role === "owner") return true;
  if (s.assignedCompanyIds.length === 0) return true; // unassigned = all
  return s.assignedCompanyIds.includes(companyId);
}
