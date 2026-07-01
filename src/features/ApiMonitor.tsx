// apps/web/src/shell/ApiMonitor.tsx

"use client";

import { useEffect, useState } from "react";

export interface ApiLog {
  path: string;
  method: string;
  status: number;
  ok: boolean;
  timestamp: string;
  details?: string;
}

let installed = false;
let logs: ApiLog[] = [];
const listeners = new Set<() => void>();

function emit(log: ApiLog) {
  logs = [log, ...logs].slice(0, 200);
  listeners.forEach((fn) => fn());
}

export function installApiMonitor() {
  if (typeof window === "undefined" || installed) return;

  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const parsed = new URL(url, window.location.origin);
    const isApi = parsed.pathname.startsWith("/api");
    const method =
      init?.method ??
      (input instanceof Request ? input.method : undefined) ??
      "GET";

    try {
      const res = await originalFetch(input, init);

      if (isApi) {
        emit({
          path: parsed.pathname + parsed.search,
          method,
          status: res.status,
          ok: res.ok,
          timestamp: new Date().toISOString(),
          details: res.statusText,
        });
      }

      return res;
    } catch (error) {
      if (isApi) {
        emit({
          path: parsed.pathname + parsed.search,
          method,
          status: 0,
          ok: false,
          timestamp: new Date().toISOString(),
          details: error instanceof Error ? error.message : "Network error",
        });
      }

      throw error;
    }
  };
}

export function ApiMonitorPill() {
  const [open, setOpen] = useState(false);
  const [viewLogs, setViewLogs] = useState<ApiLog[]>([]);

  useEffect(() => {
    installApiMonitor();

    const sync = () => setViewLogs([...logs]);
    listeners.add(sync);
    sync();

    return () => {
      listeners.delete(sync);
    };
  }, []);

  const ok = viewLogs.filter((l) => l.ok).length;
  const fail = viewLogs.filter((l) => !l.ok).length;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 left-4 z-50 rounded-full border bg-white/95 px-4 py-2 text-xs shadow-lg backdrop-blur"
      >
        🟢 مراقب الـ API ({ok} / {fail})
      </button>

      {open && (
        <div className="fixed bottom-16 left-4 z-50 h-80 w-[520px] max-w-[calc(100vw-2rem)] overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs text-emerald-200 shadow-2xl">
          {viewLogs.length === 0 && <div>No API calls yet.</div>}
          {viewLogs.map((log, index) => (
            <div key={index} className={log.ok ? "" : "text-red-300"}>
              [{log.timestamp}] {log.method} {log.path} → {log.status}{" "}
              {log.details}
            </div>
          ))}
        </div>
      )}
    </>
  );
}