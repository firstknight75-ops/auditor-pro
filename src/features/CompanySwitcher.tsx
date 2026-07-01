// Tab-style company switcher. Loads real companies from the DB via
// listCompanies server function. The active company id is persisted
// in localStorage and broadcast to all tenant-scoped hooks.

import { useEffect, useState } from "react";
import {
  getActiveCompanyId,
  setActiveCompanyId,
  onActiveCompanyChange,
} from "./active-company";
import { listCompanies } from "../server/functions";

interface CompanyRow {
  id: string;
  name: string;
  sector: string;
}

export function CompanySwitcher() {
  const [active, setActive] = useState("");
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const out = await listCompanies({ data: {} } as any);
        if (!cancelled) setCompanies((out as any).companies ?? []);
      } catch (err) {
        // Fallback: still render empty state; the dashboard shows its own error UI.
        if (!cancelled) setCompanies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const current = getActiveCompanyId() || companies[0]?.id || "";
    setActive(current);
    if (current && !getActiveCompanyId()) setActiveCompanyId(current);
  }, [companies]);

  // Listen for active-company changes triggered from outside (e.g. test harness).
  useEffect(() => {
    return onActiveCompanyChange(() => setActive(getActiveCompanyId()));
  }, []);

  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto border-b pb-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-32 animate-pulse rounded-full bg-slate-100" />
        ))}
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        لا توجد شركات مسجلة في قاعدة البيانات. شغّل الـ seed أولاً.
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto border-b pb-3">
      {companies.map((company) => (
        <button
          key={company.id}
          onClick={() => {
            setActive(company.id);
            setActiveCompanyId(company.id);
          }}
          className={[
            "whitespace-nowrap rounded-full px-4 py-2 text-sm border transition-colors",
            active === company.id
              ? "bg-slate-950 text-white border-slate-950"
              : "bg-white hover:bg-slate-50",
          ].join(" ")}
          title={`${company.name} · ${company.sector}`}
        >
          <span className="me-2">{company.name}</span>
          <span className={`text-[10px] ${active === company.id ? "opacity-70" : "text-slate-400"}`}>
            {company.sector}
          </span>
        </button>
      ))}
    </div>
  );
}
