import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ApiMonitorPill } from "./ApiMonitor";

const nav: Array<[string, string]> = [
  ["/owner", "Executive"],
  ["/owner/advisor", "AI Advisor"],
  ["/owner/trust-index", "Trust Index"],
  ["/owner/waste-map", "Waste Map"],
  ["/owner/risk-map", "Risk Map"],
  ["/owner/ledger", "Ledger"],
  ["/owner/what-if", "What-if"],
  ["/owner/portfolio", "Portfolio"],
  ["/auditor", "Certification"],
  ["/auditor/tasks", "Auditor Tasks"],
  ["/auditor/upload", "Upload"],
  ["/manager", "Manager"],
  ["/manager/tasks", "Corrections"],
  ["/appowner", "Clients"],
  ["/appowner/templates", "Templates"],
  ["/appowner/maintenance", "Maintenance"],
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r bg-white p-4 lg:block overflow-y-auto">
        <div className="mb-6">
          <div className="text-xl font-black">AuditCore</div>
          <div className="text-xs text-slate-500">Audit Shield</div>
        </div>
        <nav className="space-y-1">
          {nav.map(([href, label]) => (
            <Link
              key={href}
              to={href}
              activeProps={{ className: "block rounded-lg px-3 py-2 text-sm bg-slate-900 text-white" }}
              inactiveProps={{ className: "block rounded-lg px-3 py-2 text-sm hover:bg-slate-100" }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="lg:ml-64">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
      <ApiMonitorPill />
    </div>
  );
}