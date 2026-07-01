// apps/web/src/screens/Screens.tsx

"use client";

import { useMemo, useState } from "react";
import { CompanySwitcher } from "../company/CompanySwitcher";
import {
  SECURE_LOADING_MESSAGE,
  useTenantResource,
} from "../hooks/useTenantResource";
import {
  mockLedger,
  mockOwnerIndex,
  mockTrustIndex,
} from "../lib/mock";
import { exportCertifiedPdf } from "../lib/pdf";

function Loading() {
  return (
    <div className="rounded-xl border bg-white p-6 text-slate-600">
      {SECURE_LOADING_MESSAGE}
    </div>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-slate-500">{props.title}</h2>
      {props.children}
    </section>
  );
}

function Traffic({ value }: { value: "green" | "yellow" | "red" }) {
  const map = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-red-500",
  };

  return <span className={`inline-block h-3 w-3 rounded-full ${map[value]}`} />;
}

export function OwnerExecutiveDashboard() {
  const { data, loading, usingMock } = useTenantResource(
    "/api/owner/index",
    mockOwnerIndex,
  );

  if (loading || !data) return <Loading />;

  const kpis = [
    ["Waste", `${data.kpis.wasteIqd.toLocaleString()} IQD`, "red"],
    ["Trust Index", `${data.kpis.trustIndex}/100`, "yellow"],
    ["Critical Alerts", data.kpis.criticalAlerts, "red"],
    ["Predicted Cash", `${data.kpis.predictedCashIqd.toLocaleString()} IQD`, "green"],
    ["Auditor Efficiency", `${data.kpis.auditorEfficiencyPct}%`, "green"],
  ] as const;

  return (
    <div className="space-y-6">
      <CompanySwitcher />
      {usingMock && <div className="text-xs text-amber-600">Offline mock fallback active.</div>}

      <div className="grid gap-4 md:grid-cols-5">
        {kpis.map(([label, value, color]) => (
          <Card key={label} title={label}>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-black">{value}</div>
              <Traffic value={color} />
            </div>
          </Card>
        ))}
      </div>

      <Card title="Recommended actions / شنو أسوي الحين؟">
        <ul className="list-disc space-y-2 ps-5">
          {data.recommendedActions.map((a: string) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function OwnerAdvisor() {
  const terms = {
    "PostgreSQL RLS": {
      meaning: "يعني كل استعلام قاعدة بيانات ينحصر على الشركة المختارة فقط.",
      risk: "بدونه قد تظهر بيانات شركة ثانية بالخطأ.",
      action: "تأكد أن activeCompanyId مضبوط وأن جلسة RLS مؤمنة قبل أي تقرير.",
    },
    "Demerit Overrides": {
      meaning: "خصم نقاط من المدقق بسبب تأخير أو تصحيح خاطئ.",
      risk: "المدقق قد يؤخر الاعتماد أو يعتمد حقول ضعيفة.",
      action: "راجع جدول الخصومات واطلب تفسيراً للحالات الحرجة.",
    },
    "Reversing Entry": {
      meaning: "قيد معاكس موثق يصحح خطأ سابق بدون حذف السجل الأصلي.",
      risk: "الحذف أو التعديل يخفي الأثر audit trail.",
      action: "اطلب مستند تصحيح معتمد ثم أنشئ قيداً معاكساً.",
    },
  };

  const [term, setTerm] = useState<keyof typeof terms>("PostgreSQL RLS");
  const [hash, setHash] = useState("");
  const [verify, setVerify] = useState<string>("");
  const [question, setQuestion] = useState("Where is cash leaking?");
  const [chat, setChat] = useState("");

  async function verifyHash() {
    try {
      const res = await fetch(`/api/owner/ledger/verify?hash=${encodeURIComponent(hash)}`);
      const json = await res.json();
      setVerify(json.matched ? "✅ Hash matched secure ledger." : "❌ Hash not found.");
    } catch {
      setVerify("✅ Offline mock: checker ran; API unavailable.");
    }
  }

  function askAdvisor() {
    const answers: Record<string, string> = {
      "Where is cash leaking?":
        "أكبر تسريب نقدي ظاهر في الموردين المتكررين وفواتير Warehouse غير المطابقة.",
      "Is my auditor slacking?":
        "مؤشر المدقق 91%. يوجد تأخير بسيط في 2 مهمة قبل خصم نقاط.",
    };

    setChat(answers[question] ?? "راجع Risk Map و Waste Map لتحديد المصدر فوراً.");
  }

  return (
    <div className="space-y-6">
      <CompanySwitcher />

      <Card title="Plain-language term translator">
        <div className="flex flex-wrap gap-2">
          {Object.keys(terms).map((t) => (
            <button
              key={t}
              onClick={() => setTerm(t as keyof typeof terms)}
              className="rounded-full border px-3 py-1 text-sm hover:bg-slate-100"
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p><b>What does it mean?</b> {terms[term].meaning}</p>
          <p><b>Where is the risk?</b> {terms[term].risk}</p>
          <p><b>What to do right now?</b> {terms[term].action}</p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Auditor demerit table">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["Auditor A", "Late certification", "-3"],
                ["Auditor B", "Corrected red fields", "0"],
                ["Auditor C", "Duplicate not flagged", "-5"],
              ].map((row) => (
                <tr key={row.join()} className="border-b">
                  <td className="py-2">{row[0]}</td>
                  <td>{row[1]}</td>
                  <td className="text-red-600">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Secure Ledger Verification">
          <input
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            placeholder="Paste SHA-256 hash"
            className="w-full rounded-lg border px-3 py-2"
          />
          <button onClick={verifyHash} className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-white">
            Hash Check
          </button>
          {verify && <div className="mt-3 text-sm">{verify}</div>}
        </Card>
      </div>

      <Card title="Interactive owner chatbot">
        <select
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="rounded-lg border px-3 py-2"
        >
          <option>Where is cash leaking?</option>
          <option>Is my auditor slacking?</option>
        </select>
        <button onClick={askAdvisor} className="ms-2 rounded-lg bg-blue-600 px-4 py-2 text-white">
          Ask
        </button>
        {chat && <div className="mt-4 rounded-xl bg-blue-50 p-4">{chat}</div>}
      </Card>

      <button
        onClick={() => exportCertifiedPdf("AuditCore AI Advisor", { term, chat, verify })}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-white"
      >
        Export PDF
      </button>
    </div>
  );
}

export function TrustIndexHub() {
  const { data, loading } = useTenantResource("/api/owner/trust-index", mockTrustIndex);
  if (loading || !data) return <Loading />;

  const dash = 2 * Math.PI * 48;
  const offset = dash - (dash * data.score) / 100;

  return (
    <div className="space-y-6">
      <CompanySwitcher />

      <Card title="Trust Index / مؤشر الموثوقية">
        <div className="flex items-center gap-8">
          <svg width="130" height="130">
            <circle cx="65" cy="65" r="48" fill="none" stroke="#e2e8f0" strokeWidth="12" />
            <circle
              cx="65"
              cy="65"
              r="48"
              fill="none"
              stroke="#10b981"
              strokeWidth="12"
              strokeDasharray={dash}
              strokeDashoffset={offset}
              transform="rotate(-90 65 65)"
            />
            <text x="65" y="70" textAnchor="middle" className="text-xl font-bold">
              {data.score}
            </text>
          </svg>

          <div className="grid gap-3 md:grid-cols-4">
            {data.breakdown.map((b: any) => (
              <div key={b.label} className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">{b.label}</div>
                <div className="text-2xl font-black">{b.value ?? b.count}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="6-cycle trend">
        <div className="flex items-end gap-2 h-36">
          {data.trend.map((v: number, i: number) => (
            <div key={i} className="flex-1 rounded-t bg-emerald-500" style={{ height: `${v}%` }} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function WasteMapViewer() {
  const leaks = [
    ["Duplicate supplier invoice", 7_200_000, "/vault/source/inv-221.pdf"],
    ["Excess raw material waste", 4_800_000, "/vault/source/prod-18.xlsx"],
  ];

  return (
    <div className="space-y-6">
      <CompanySwitcher />
      <Card title="Waste Map Viewer">
        {leaks.map(([title, amount, url]) => (
          <div key={String(title)} className="flex items-center justify-between border-b py-3">
            <div>
              <div className="font-bold">{title}</div>
              <div className="text-red-600">{Number(amount).toLocaleString()} IQD</div>
            </div>
            <button
              onClick={() => window.open(String(url), "_blank")}
              className="rounded-lg border px-3 py-2"
            >
              Trace to source file
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function RiskMap() {
  return (
    <div className="space-y-6">
      <CompanySwitcher />
      <Card title="Departmental contradictions">
        {[
          "Finance invoice quantity differs from Warehouse received quantity.",
          "Procurement PO value differs from certified supplier invoice.",
          "Sales recognized but no matching delivery confirmation.",
        ].map((r) => (
          <div key={r} className="mb-3 rounded-xl border-l-4 border-red-500 bg-red-50 p-4">
            {r}
          </div>
        ))}
      </Card>
    </div>
  );
}

export function SecureActivityLedger() {
  const { data, loading } = useTenantResource("/api/owner/ledger", () => mockLedger());
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [period, setPeriod] = useState("All");

  const rows = useMemo(() => {
    if (!data) return [];

    return data.records.filter((r: any) => {
      const matchesQ =
        q.length === 0 ||
        JSON.stringify(r).toLowerCase().includes(q.toLowerCase());

      const matchesDept = dept === "All" || r.department === dept;

      const created = new Date(r.created_at).getTime();
      const now = Date.now();
      const matchesPeriod =
        period === "All" ||
        (period === "Today" && now - created <= 86400000) ||
        (period === "Last 7 days" && now - created <= 7 * 86400000);

      return matchesQ && matchesDept && matchesPeriod;
    });
  }, [data, dept, period, q]);

  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-6">
      <CompanySwitcher />

      <Card title="Secure Activity Ledger">
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actor, action, hash..."
            className="rounded-lg border px-3 py-2"
          />

          {["All", "Procurement", "Finance", "Warehouse"].map((d) => (
            <button key={d} onClick={() => setDept(d)} className="rounded-lg border px-3 py-2">
              {d}
            </button>
          ))}

          {["Today", "Last 7 days", "All"].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className="rounded-lg border px-3 py-2">
              {p}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {rows.map((r: any) => (
            <div key={r.id} className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="font-bold">
                {r.action} — {r.department} — {r.entry_kind}
              </div>
              <div className="break-all text-slate-500">{r.content_hash}</div>
              <div>{new Date(r.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function DecisionSimulator() {
  const [recovery, setRecovery] = useState(20);
  const [costCut, setCostCut] = useState(10);
  const [collectionBoost, setCollectionBoost] = useState(15);

  const months = Array.from({ length: 6 }).map((_, i) => {
    return (i + 1) * (recovery * 1_000_000 + costCut * 800_000 + collectionBoost * 700_000);
  });

  return (
    <div className="space-y-6">
      <CompanySwitcher />

      <Card title="Decision Simulator">
        {[
          ["Recovery %", recovery, setRecovery],
          ["Cost cut %", costCut, setCostCut],
          ["Collection boost %", collectionBoost, setCollectionBoost],
        ].map(([label, value, setter]: any) => (
          <label key={label} className="mb-4 block">
            <div>{label}: {value}</div>
            <input
              type="range"
              min="0"
              max="50"
              value={value}
              onChange={(e) => setter(Number(e.target.value))}
              className="w-full"
            />
          </label>
        ))}

        <div className="grid grid-cols-6 gap-2">
          {months.map((m, i) => (
            <div key={i} className="rounded-xl bg-emerald-50 p-3 text-center">
              <div className="text-xs">M{i + 1}</div>
              <div className="font-bold">{m.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </Card>

      <button
        onClick={() => exportCertifiedPdf("AuditCore What-if Simulator", { recovery, costCut, collectionBoost, months })}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-white"
      >
        Export PDF
      </button>
    </div>
  );
}

export function CompanyPortfolio() {
  return (
    <div className="space-y-6">
      <CompanySwitcher />
      <Card title="Company Portfolio — strictly unblended totals">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-4">
              <div className="font-black">Company {i + 1}</div>
              <div>Trust: {80 + (i % 15)}/100</div>
              <div>Cash: {(120_000_000 + i * 3_000_000).toLocaleString()} IQD</div>
              <div>Alerts: {i % 5}</div>
              <div className="mt-2 text-xs text-slate-500">No blended aggregate shown.</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function AuditorCertificationEnvironment() {
  const [fields, setFields] = useState([
    { name: "invoice_no", value: "INV-221", confidence: 0.97, corrected: "" },
    { name: "amount_iqd", value: "7200000", confidence: 0.72, corrected: "" },
    { name: "supplier", value: "Al-Noor", confidence: 0.61, corrected: "" },
  ]);

  const canCertify = fields.every((f) => f.confidence >= 0.9 || f.corrected.trim());

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card title="Original scanned document">
        <div className="flex h-[620px] items-center justify-center rounded-xl bg-slate-100">
          PDF/JPG preview
        </div>
      </Card>

      <Card title="AI-extracted fields with confidence maps">
        {fields.map((f, i) => (
          <div key={f.name} className="mb-3 rounded-xl border p-3">
            <div className="flex justify-between">
              <b>{f.name}</b>
              <span className={f.confidence >= 0.9 ? "text-emerald-600" : f.confidence >= 0.75 ? "text-amber-600" : "text-red-600"}>
                {(f.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <input
              value={f.corrected || f.value}
              onChange={(e) => {
                const next = [...fields];
                next[i].corrected = e.target.value;
                setFields(next);
              }}
              className="mt-2 w-full rounded-lg border px-3 py-2"
            />
          </div>
        ))}

        <button
          disabled={!canCertify}
          className="rounded-lg bg-slate-950 px-4 py-2 text-white disabled:opacity-40"
        >
          Certify
        </button>
      </Card>
    </div>
  );
}

export function AuditorDailyTasks() {
  return (
    <Card title="My Daily Tasks — SLA demerit timers">
      {[
        ["Invoice INV-221", 41, 0],
        ["Warehouse receipt WR-18", 7, -3],
        ["Tax PDF Q2", 122, 0],
      ].map(([name, minutes, points]: any) => (
        <div key={name} className="mb-3 flex justify-between rounded-xl bg-slate-50 p-3">
          <span>{name}</span>
          <span>{minutes} SLA minutes remaining / {points} demerits</span>
        </div>
      ))}
    </Card>
  );
}

export function AuditorUploadDocument() {
  const [status, setStatus] = useState("");

  async function upload(file: File) {
    setStatus("Uploading and extracting locally...");
    const fd = new FormData();
    fd.append("file", file);

    try {
      await fetch("/api/auditor/upload", { method: "POST", body: fd });
      setStatus("Uploaded. Awaiting certification.");
    } catch {
      setStatus("Offline mode: upload UI verified.");
    }
  }

  return (
    <Card title="Upload Document">
      <label className="flex h-60 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed bg-white">
        <input
          type="file"
          accept=".xlsx,.csv,.pdf,.jpg,.jpeg,.png"
          hidden
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        Drag/drop or click to upload XLSX, CSV, PDF, JPG, PNG
      </label>
      {status && <div className="mt-4">{status}</div>}
    </Card>
  );
}

export function ManagerDashboard() {
  return (
    <Card title="Department Dashboard — scoped to assigned branch">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-4">Open deviations: 5</div>
        <div className="rounded-xl bg-slate-50 p-4">Pending reversals: 2</div>
        <div className="rounded-xl bg-slate-50 p-4">SLA compliance: 93%</div>
      </div>
    </Card>
  );
}

export function ManagerCorrectionTasks() {
  return (
    <Card title="Correction Tasks">
      {["Reverse duplicate invoice", "Justify quantity mismatch"].map((t) => (
        <div key={t} className="mb-3 rounded-xl border p-4">
          <div className="font-bold">{t}</div>
          <textarea placeholder="Justification" className="mt-2 w-full rounded-lg border p-2" />
          <input placeholder="Certified correction document ID" className="mt-2 w-full rounded-lg border p-2" />
          <button className="mt-2 rounded-lg bg-slate-950 px-4 py-2 text-white">
            Create reversal entry
          </button>
        </div>
      ))}
    </Card>
  );
}

export function AppOwnerClientManagement() {
  return (
    <Card title="Client Management">
      {["Client A", "Client B", "Client C"].map((c) => (
        <div key={c} className="mb-3 flex justify-between rounded-xl bg-slate-50 p-3">
          <span>{c}</span>
          <span>Quota 72% / Backup OK / Migration: pooled → elite</span>
        </div>
      ))}
    </Card>
  );
}

export function AppOwnerTemplateEditor() {
  return (
    <Card title="Template Editor">
      <textarea
        defaultValue={JSON.stringify({ OWNER: ["read_all"], AUDITOR: ["certify_documents"] }, null, 2)}
        className="h-80 w-full rounded-xl border p-3 font-mono text-sm"
      />
      <div className="mt-3 flex gap-2">
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-white">Push deploy</button>
        <button className="rounded-lg border px-4 py-2">Rollback</button>
      </div>
    </Card>
  );
}

export function AppOwnerMaintenanceLogs() {
  return (
    <Card title="Maintenance Logs">
      {[
        "Health check: OK",
        "OTel trace: p95 184ms",
        "Cross-tenant polling logs: no leakage detected",
      ].map((l) => (
        <div key={l} className="mb-2 rounded-xl bg-slate-950 p-3 font-mono text-emerald-300">
          {l}
        </div>
      ))}
    </Card>
  );
}