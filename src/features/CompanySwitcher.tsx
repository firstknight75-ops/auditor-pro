// apps/web/src/company/CompanySwitcher.tsx

"use client";

import { useEffect, useState } from "react";
import { getActiveCompanyId, setActiveCompanyId } from "./active-company";
import { mockCompanies } from "../lib/mock";

export function CompanySwitcher() {
  const [active, setActive] = useState("");

  useEffect(() => {
    const current = getActiveCompanyId() || mockCompanies[0].id;
    setActive(current);
    if (!getActiveCompanyId()) setActiveCompanyId(current);
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto border-b pb-3">
      {mockCompanies.slice(0, 12).map((company) => (
        <button
          key={company.id}
          onClick={() => {
            setActive(company.id);
            setActiveCompanyId(company.id);
          }}
          className={[
            "whitespace-nowrap rounded-full px-4 py-2 text-sm border",
            active === company.id
              ? "bg-slate-950 text-white border-slate-950"
              : "bg-white hover:bg-slate-50",
          ].join(" ")}
        >
          {company.name}
        </button>
      ))}
    </div>
  );
}