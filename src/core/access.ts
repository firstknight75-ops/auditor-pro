// Access control (§8 of the AuditCore spec).
// Four roles per spec, each with explicit capability tiers:
//
//   - owner     : full access across the whole group of companies
//   - manager   : their assigned company only (Layer 1 + Layer 2)
//   - auditor   : assigned companies, full Layer 3 access
//   - employee  : their department only; no audit data visible
//
// Human Performance dimension is gated separately (§8 last paragraph):
// "no full detail is displayed except to the owner and the specifically
// authorized HR manager, even within the audit team".
//
// In this build we don't have a real auth provider. Role is held in
// sessionStorage and can be flipped from the role-switcher in the
// sidebar. The capability checks below are the contract; if real auth
// is wired in later, only the role-resolution function changes.

export type Role = "owner" | "manager" | "auditor" | "employee";

export const ROLES: Role[] = ["owner", "manager", "auditor", "employee"];

export const ROLE_LABELS_AR: Record<Role, string> = {
  owner: "مالك المجموعة",
  manager: "مدير شركة",
  auditor: "فريق Audit",
  employee: "موظف قسم",
};

// Capabilities are typed strings the rest of the app checks before
// showing or invoking gated functionality.
export type Capability =
  | "view:owner-portfolio"        // see the multi-company portfolio
  | "view:company-dashboard"      // see Layer 1 of one company
  | "view:company-drilldown"      // see Layer 2 of one company
  | "view:advisor"                // see Layer 3 advisor
  | "view:human-performance"      // see full Human Performance detail
  | "view:trust-index"            // see Trust Index
  | "view:ledger"                 // see the immutable activity ledger
  | "view:waste-map"              // see the waste map
  | "view:risk-map"               // see the risk map
  | "view:what-if"                // run what-if scenarios
  | "view:appowner"               // see the app-owner (super-admin) section
  | "act:certify-files"           // certify uploaded files
  | "act:create-reversal"         // create a reversing entry
  | "act:resolve-deviation"       // take action on a deviation
  | "act:recalibrate"             // re-calibrate thresholds
  | "act:manage-clients"          // add / remove companies
  | "act:edit-templates";         // edit config profiles

// Capability matrix per role. Single source of truth — UI elements
// and server functions both gate on this.
export const CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  owner: new Set<Capability>([
    "view:owner-portfolio", "view:company-dashboard", "view:company-drilldown",
    "view:advisor", "view:human-performance", "view:trust-index",
    "view:ledger", "view:waste-map", "view:risk-map", "view:what-if",
    "view:appowner",
    "act:certify-files", "act:create-reversal", "act:resolve-deviation",
    "act:recalibrate", "act:manage-clients", "act:edit-templates",
  ]),
  manager: new Set<Capability>([
    "view:company-dashboard", "view:company-drilldown",
    "view:trust-index", "view:ledger", "view:waste-map",
    "view:risk-map", "view:what-if",
    "act:create-reversal", "act:resolve-deviation",
  ]),
  auditor: new Set<Capability>([
    "view:company-dashboard", "view:company-drilldown",
    "view:advisor", "view:trust-index", "view:ledger",
    "view:waste-map", "view:risk-map",
    "act:certify-files", "act:create-reversal", "act:recalibrate",
  ]),
  employee: new Set<Capability>([
    // Per §8: employees upload to their department only, with NO
    // visibility of any audit report or dashboard.
    "act:certify-files",
  ]),
};

export function can(role: Role, cap: Capability): boolean {
  return CAPABILITIES[role]?.has(cap) ?? false;
}

// "Restricted" dimensions per §8 last paragraph.
const RESTRICTED_DIMENSIONS = new Set(["HUMAN_PERFORMANCE"]);
export function canViewDimension(role: Role, dimension: string): boolean {
  if (!RESTRICTED_DIMENSIONS.has(dimension)) return true;
  return can(role, "view:human-performance");
}
