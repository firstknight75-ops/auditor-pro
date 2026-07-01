// Floating API monitor pill.
// Intercepts window.fetch to log every server-function RPC call with
// request body, response body, status, and timing. Click the pill to
// expand a detail panel; each log row toggles its request/response
// inspector; a header button copies the latest request payload.

import { useEffect, useMemo, useRef, useState } from "react";

export interface ApiLog {
  id: string;
  path: string;
  method: string;
  status: number;
  ok: boolean;
  timestamp: string;
  durationMs: number;
  requestBody: string | null;
  responseBody: string | null;
  responseContentType: string | null;
  error: string | null;
}

const MAX_LOGS = 100;
const MAX_BODY_BYTES = 8 * 1024; // 8 KB cap on captured bodies

let installed = false;
let logs: ApiLog[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function pushLog(log: ApiLog) {
  logs = [log, ...logs].slice(0, MAX_LOGS);
  notify();
}

function truncate(text: string | null): string | null {
  if (text == null) return null;
  if (text.length <= MAX_BODY_BYTES) return text;
  return text.slice(0, MAX_BODY_BYTES) + `... [+${text.length - MAX_BODY_BYTES} bytes truncated]`;
}

function safeReadBody(body: BodyInit | null | undefined): Promise<string | null> {
  if (body == null) return Promise.resolve(null);
  if (typeof body === "string") return Promise.resolve(body);
  if (body instanceof URLSearchParams) return Promise.resolve(body.toString());
  if (body instanceof FormData) {
    const obj: Record<string, string> = {};
    body.forEach((v, k) => { obj[k] = typeof v === "string" ? v : `[file:${(v as File).name}]`; });
    return Promise.resolve(JSON.stringify(obj, null, 2));
  }
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    const bytes = body instanceof ArrayBuffer ? new Uint8Array(body) : new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
    if (bytes.byteLength <= MAX_BODY_BYTES) {
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      try {
        return Promise.resolve(btoa(bin));
      } catch {
        return Promise.resolve(`[binary ${bytes.byteLength} bytes]`);
      }
    }
    return Promise.resolve(`[binary ${bytes.byteLength} bytes]`);
  }
  if (body instanceof Blob) {
    return body.slice(0, MAX_BODY_BYTES).text().catch(() => `[blob ${body.size} bytes]`);
  }
  return Promise.resolve(String(body));
}

async function readResponseBodySafe(res: Response): Promise<{ text: string | null; contentType: string | null }> {
  const contentType = res.headers.get("content-type");
  try {
    const clone = res.clone();
    let text = await clone.text();
    if (text.length > MAX_BODY_BYTES) {
      text = text.slice(0, MAX_BODY_BYTES) + `... [+${text.length - MAX_BODY_BYTES} bytes truncated]`;
    }
    // Try to pretty-print JSON.
    if (contentType?.includes("json") && text.length > 0) {
      try {
        const parsed = JSON.parse(text);
        text = JSON.stringify(parsed, null, 2);
      } catch { /* keep raw */ }
    }
    return { text, contentType };
  } catch {
    return { text: null, contentType };
  }
}

export function installApiMonitor() {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input :
      input instanceof URL ? input.toString() :
      input.url;

    let parsed: URL;
    try { parsed = new URL(url, window.location.origin); }
    catch { return originalFetch(input, init); }

    const isApi = parsed.pathname.startsWith("/api") || parsed.pathname.startsWith("/_serverFn");
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = performance.now();

    // Capture request body without consuming the original.
    let requestBody: string | null = null;
    if (init?.body != null) {
      requestBody = truncate(await safeReadBody(init.body));
    } else if (input instanceof Request) {
      try {
        const clone = input.clone();
        requestBody = truncate(await clone.text());
      } catch {
        requestBody = null;
      }
    }

    try {
      const res = await originalFetch(input, init);
      const durationMs = Math.round(performance.now() - startedAt);

      if (isApi) {
        const { text, contentType } = await readResponseBodySafe(res);
        pushLog({
          id, path: parsed.pathname + parsed.search, method,
          status: res.status, ok: res.ok,
          timestamp: new Date().toISOString(), durationMs,
          requestBody, responseBody: truncate(text),
          responseContentType: contentType, error: null,
        });
      }
      return res;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startedAt);
      if (isApi) {
        pushLog({
          id, path: parsed.pathname + parsed.search, method,
          status: 0, ok: false,
          timestamp: new Date().toISOString(), durationMs,
          requestBody, responseBody: null, responseContentType: null,
          error: error instanceof Error ? error.message : "Network error",
        });
      }
      throw error;
    }
  };
}

type Filter = "all" | "ok" | "fail";

export function ApiMonitorPill() {
  const [open, setOpen] = useState(false);
  const [viewLogs, setViewLogs] = useState<ApiLog[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [copyState, setCopyState] = useState<string>("");
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    installApiMonitor();
    const sync = () => setViewLogs([...logs]);
    listeners.add(sync);
    sync();
    return () => { listeners.delete(sync); };
  }, []);

  // Auto-clear copy confirmation after 2 seconds.
  useEffect(() => {
    if (!copyState) return;
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopyState(""), 2000);
    return () => { if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current); };
  }, [copyState]);

  const filtered = useMemo(() => {
    if (filter === "ok") return viewLogs.filter((l) => l.ok);
    if (filter === "fail") return viewLogs.filter((l) => !l.ok);
    return viewLogs;
  }, [viewLogs, filter]);

  const ok = viewLogs.filter((l) => l.ok).length;
  const fail = viewLogs.filter((l) => !l.ok).length;
  const latest = viewLogs[0];

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyLatestRequest() {
    if (!latest) return;
    const payload = latest.requestBody ?? "(empty request body)";
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState("✅ تم نسخ آخر طلب");
    } catch {
      setCopyState("❌ فشل النسخ — تحقق من أذونات الحافظة");
    }
  }

  function clearLogs() {
    logs = [];
    setExpanded(new Set());
    notify();
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border bg-white/95 px-4 py-2 text-xs shadow-lg backdrop-blur"
        title="مراقب طلبات الخادم"
      >
        <span className={`h-2 w-2 rounded-full ${fail > 0 ? "bg-red-500" : "bg-emerald-500"}`} />
        <span>🛰 مراقب API</span>
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">{ok}</span>
        {fail > 0 && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800">{fail}</span>}
      </button>

      {open && (
        <div className="fixed bottom-16 left-4 z-50 flex h-[460px] w-[640px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-slate-950 font-mono text-xs text-emerald-200 shadow-2xl">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
            <div className="flex items-center gap-1">
              {(["all", "ok", "fail"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded px-2 py-1 ${filter === f ? "bg-slate-700 text-white" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {f === "all" ? "الكل" : f === "ok" ? `✓ ${ok}` : `✗ ${fail}`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyLatestRequest}
                disabled={!latest}
                className="rounded bg-emerald-700 px-2 py-1 text-emerald-50 hover:bg-emerald-600 disabled:opacity-40"
                title="نسخ آخر جسم طلب إلى الحافظة"
              >
                📋 نسخ آخر طلب
              </button>
              <button
                onClick={clearLogs}
                className="rounded bg-slate-700 px-2 py-1 text-slate-100 hover:bg-slate-600"
              >
                🗑 مسح
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded bg-slate-700 px-2 py-1 text-slate-100 hover:bg-slate-600"
              >
                ✕
              </button>
            </div>
          </div>

          {copyState && (
            <div className="border-b border-slate-800 bg-slate-800 px-3 py-1 text-center text-[11px] text-amber-200">
              {copyState}
            </div>
          )}

          {/* Log list */}
          <div className="flex-1 overflow-auto p-2">
            {filtered.length === 0 && (
              <div className="px-2 py-4 text-center text-slate-500">لا توجد طلبات مسجلة بعد.</div>
            )}
            {filtered.map((log) => {
              const isOpen = expanded.has(log.id);
              return (
                <div key={log.id} className={`mb-1 rounded border ${log.ok ? "border-slate-800" : "border-red-900 bg-red-950/30"}`}>
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left hover:bg-slate-900"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className={`text-[10px] ${log.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {log.ok ? "✓" : "✗"}
                      </span>
                      <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span className="text-slate-300">{log.method}</span>
                      <span className="truncate text-slate-100">{log.path}</span>
                    </span>
                    <span className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{log.durationMs}ms</span>
                      <span>{isOpen ? "▼" : "▶"}</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-800 bg-black/40 px-3 py-2">
                      <div className="mb-1 flex flex-wrap gap-3 text-[10px] text-slate-500">
                        <span>الحالة: <b className={log.ok ? "text-emerald-400" : "text-red-400"}>{log.status || "—"}</b></span>
                        {log.responseContentType && <span>نوع الاستجابة: {log.responseContentType}</span>}
                        {log.error && <span className="text-red-400">خطأ: {log.error}</span>}
                      </div>
                      <div className="grid gap-2">
                        <details open>
                          <summary className="cursor-pointer text-amber-300">طلب (Request)</summary>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-900 p-2 text-[10px] text-slate-200">
                            {log.requestBody ?? "(empty)"}
                          </pre>
                        </details>
                        <details open>
                          <summary className="cursor-pointer text-cyan-300">استجابة (Response)</summary>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-900 p-2 text-[10px] text-slate-200">
                            {log.responseBody ?? log.error ?? "(empty)"}
                          </pre>
                        </details>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-800 bg-slate-900 px-3 py-1 text-[10px] text-slate-500">
            التقاط: {viewLogs.length} / {MAX_LOGS} · حد الجسم: {MAX_BODY_BYTES} بايت
          </div>
        </div>
      )}
    </>
  );
}
