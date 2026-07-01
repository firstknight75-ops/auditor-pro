import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ApiMonitorPill } from "./ApiMonitor";
import { CompanySwitcher } from "./CompanySwitcher";
import { getSession, setRole } from "../core/session";
import { can, type Role, type Capability } from "../core/access";
import { ROLE_LABELS_AR } from "../core/access";

type NavItem = { href: string; label: string; cap: Capability };

// §8 navigation: each item is gated by a capability. Owner/manager/auditor
// see different sets; employee sees nothing.
const NAV_OWNER: NavItem[] = [
  { href: "/owner", label: "Executive", cap: "view:owner-portfolio" },
  { href: "/owner/advisor", label: "AI Advisor", cap: "view:advisor" },
  { href: "/owner/trust-index", label: "Trust Index", cap: "view:trust-index" },
  { href: "/owner/waste-map", label: "Waste Map", cap: "view:waste-map" },
  { href: "/owner/risk-map", label: "Risk Map", cap: "view:risk-map" },
  { href: "/owner/ledger", label: "Ledger", cap: "view:ledger" },
  { href: "/owner/what-if", label: "What-if", cap: "view:what-if" },
  { href: "/owner/portfolio", label: "Portfolio", cap: "view:owner-portfolio" },
  { href: "/auditor", label: "Certification", cap: "act:certify-files" },
  { href: "/auditor/tasks", label: "Auditor Tasks", cap: "view:advisor" },
  { href: "/auditor/upload", label: "Upload", cap: "act:certify-files" },
  { href: "/manager", label: "Manager", cap: "view:company-dashboard" },
  { href: "/manager/tasks", label: "Corrections", cap: "act:create-reversal" },
  { href: "/appowner", label: "Clients", cap: "view:appowner" },
  { href: "/appowner/templates", label: "Templates", cap: "act:edit-templates" },
  { href: "/appowner/maintenance", label: "Maintenance", cap: "view:appowner" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>("owner");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setRoleState(getSession().role);
    setMounted(true);
    const sync = () => setRoleState(getSession().role);
    window.addEventListener("auditcore.session_changed", sync);
    window.addEventListener("auditcore.active_company_changed", sync);
    return () => {
      window.removeEventListener("auditcore.session_changed", sync);
      window.removeEventListener("auditcore.active_company_changed", sync);
    };
  }, []);

  const visibleNav = NAV_OWNER.filter((item) => can(role, item.cap));

  // Employees (§8): only see Upload (certify) and nothing else.
  // We render a minimal nav + an info banner so they know why.
  const isEmployee = role === "employee";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r bg-white p-4 lg:block overflow-y-auto">
        <div className="mb-4">
          <div className="text-xl font-black">AuditCore</div>
          <div className="text-xs text-slate-500">Audit Shield · §8 access tiers</div>
        </div>

        {/* Role switcher (interim until real auth) */}
        {mounted && (
          <div className="mb-4 rounded-lg border bg-slate-50 p-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">الدور الحالي</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {(["owner", "manager", "auditor", "employee"] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`rounded-full px-2 py-0.5 text-[11px] border transition-colors ${
                    role === r
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white hover:bg-slate-100"
                  }`}
                  title={ROLE_LABELS_AR[r]}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{ROLE_LABELS_AR[role]}</div>
          </div>
        )}

        {isEmployee ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="font-bold mb-1">وصول موظف قسم (§8)</div>
            <p>حسب السياسة، الموظف يصل فقط إلى رفع الملفات لقسمه. لا توجد لديك صلاحيات لعرض لوحات التدقيق أو التقارير.</p>
          </div>
        ) : (
          <nav className="space-y-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                activeProps={{ className: "block rounded-lg px-3 py-2 text-sm bg-slate-900 text-white" }}
                inactiveProps={{ className: "block rounded-lg px-3 py-2 text-sm hover:bg-slate-100" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </aside>
      <main className="lg:ml-64">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
      <ApiMonitorPill />
    </div>
  );
}
