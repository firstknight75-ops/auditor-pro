// Route-level error boundary.
// Shown by TanStack Router when a route's loader or component throws.
// Provides a retry button that invalidates the current route and a
// link back to the safe home screen.

import { ErrorComponentProps, Link } from "@tanstack/react-router";
import { useEffect } from "react";

export function RouteError({ error, reset }: ErrorComponentProps) {
  useEffect(() => {
    console.error("[RouteError]", error);
  }, [error]);

  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : null;

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-12">
      <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-900 shadow-sm">
        <div className="mb-2 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <h2 className="text-lg font-black">تعذّر تحميل هذه الشاشة</h2>
        </div>
        <p className="mb-4 text-sm">
          حدث خطأ أثناء جلب البيانات أو تنفيذ منطق هذه الصفحة. يمكنك إعادة المحاولة أو العودة للرئيسية.
        </p>
        <div className="mb-4 rounded-lg bg-white p-3 text-xs">
          <div className="font-bold text-red-700">رسالة الخطأ:</div>
          <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words font-mono">
            {message}
          </pre>
        </div>
        {stack && (
          <details className="mb-4 text-xs">
            <summary className="cursor-pointer font-bold text-red-700">تفاصيل تقنية (Stack trace)</summary>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-2 font-mono text-[10px] text-emerald-200">
              {stack}
            </pre>
          </details>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            🔄 إعادة المحاولة
          </button>
          <Link
            to="/"
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
          >
            ← العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
