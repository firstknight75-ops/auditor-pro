import type { ReactNode } from "react";

export function Card(props: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-500">{props.title}</h2>
        {props.right}
      </div>
      {props.children}
    </section>
  );
}

export function Traffic({ value }: { value: "green" | "amber" | "yellow" | "red" }) {
  const map = { green: "bg-emerald-500", amber: "bg-orange-500", yellow: "bg-amber-400", red: "bg-red-500" };
  return <span className={`inline-block h-3 w-3 rounded-full ${map[value]}`} />;
}

export function SeverityBadge({ s }: { s: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" }) {
  const map = {
    CRITICAL: "bg-red-100 text-red-800 border-red-300",
    HIGH: "bg-orange-100 text-orange-800 border-orange-300",
    MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
    LOW: "bg-emerald-100 text-emerald-800 border-emerald-300",
  };
  const labels = { CRITICAL: "حرج", HIGH: "عالٍ", MEDIUM: "متوسط", LOW: "منخفض" };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${map[s]}`}>{labels[s]}</span>;
}

export function Loading({ message = "جاري التحقق من الصلاحيات وتأمين RLS لجلسة الشركة الحالية..." }: { message?: string }) {
  return <div className="rounded-xl border bg-white p-6 text-slate-600">{message}</div>;
}
