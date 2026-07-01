// Route-level loading fallback.
// Shown by TanStack Router while the matched route's data is loading
// (or while lazy modules resolve). Used by every sidebar navigation
// screen via the route's `pendingComponent`.

import { Link } from "@tanstack/react-router";

export function RoutePending() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-12">
      <div className="relative">
        <span className="block h-14 w-14 animate-spin rounded-full border-4 border-slate-200" />
        <span className="absolute inset-0 block h-14 w-14 animate-spin rounded-full border-4 border-transparent border-t-slate-900" />
      </div>
      <div className="text-sm font-bold text-slate-700">جاري التحميل…</div>
      <div className="text-xs text-slate-500">
        جاري التحقق من الصلاحيات وتأمين RLS لجلسة الشركة الحالية...
      </div>
      <Link
        to="/"
        className="mt-2 text-xs text-slate-400 underline hover:text-slate-700"
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
