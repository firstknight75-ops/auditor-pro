import { useState, useCallback } from "react";
import { uploadAndClassify } from "../server/upload";
import { certifyFile, rejectFile } from "../server/functions";
import { getActiveCompanyId } from "./active-company";
import { Card } from "./ui-primitives";

interface ParsedSheet {
  name: string;
  columns: string[];
  rows: Array<{ rowIndex: number; raw: Record<string, string | null> }>;
}

interface ClassificationResult {
  dimension: string;
  confidence: number;
  department: string;
  suggestedAction: string;
  detectedFields: Record<string, string>;
}

interface UploadResult {
  fileId: string;
  fileHash: string;
  filename: string;
  fileType: "xlsx" | "csv" | "pdf" | "image";
  sheets: ParsedSheet[];
  classification: ClassificationResult;
  totalRows: number;
}

interface ReviewRow {
  rowIndex: number;
  amount: number;
  entryDate: string;
  raw: Record<string, string | null>;
  selected: boolean;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function detectFileType(filename: string): "xlsx" | "csv" | "pdf" | "image" {
  const lc = filename.toLowerCase();
  if (lc.endsWith(".xlsx") || lc.endsWith(".xls")) return "xlsx";
  if (lc.endsWith(".csv")) return "csv";
  if (lc.endsWith(".pdf")) return "pdf";
  return "image";
}

export function AuditorUploadFlow() {
  const [phase, setPhase] = useState<"idle" | "uploading" | "reviewing" | "certifying" | "done" | "error">("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [actorId] = useState("actor-auditor-1");
  const [certifySummary, setCertifySummary] = useState<{ count: number; totalIqd: number } | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    setError("");
    setPhase("uploading");
    setResult(null);
    setCertifySummary(null);

    try {
      const companyId = getActiveCompanyId();
      if (!companyId) throw new Error("No active company selected. Pick a company tab first.");

      const base64 = await fileToBase64(file);
      const fileType = detectFileType(file.name);
      if (fileType !== "xlsx" && fileType !== "csv") {
        throw new Error(`نوع الملف ${fileType} يحتاج سيرفر منفصل (PDF/OCR) — استخدم xlsx أو csv الآن.`);
      }

      const out = (await uploadAndClassify({
        data: { companyId, actorId, filename: file.name, fileType, base64Content: base64 },
      } as any)) as UploadResult;

      setResult(out);

      const sheet = out.sheets[0];
      const amountCol = out.classification.detectedFields.amount;
      const dateCol = out.classification.detectedFields.date;
      const initial: ReviewRow[] = sheet.rows.slice(0, 200).map((r) => {
        const amount = amountCol ? Number(String(r.raw[amountCol] ?? "0").replace(/[^0-9.-]/g, "")) || 0 : 0;
        const dateRaw = dateCol ? r.raw[dateCol] : null;
        const d = dateRaw ? new Date(dateRaw) : new Date();
        return {
          rowIndex: r.rowIndex,
          amount,
          entryDate: Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString(),
          raw: r.raw,
          selected: amount !== 0,
        };
      });
      setReviewRows(initial);
      setPhase("reviewing");
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setPhase("error");
    }
  }, [actorId]);

  const toggleRow = (rowIndex: number) => {
    setReviewRows((rows) => rows.map((r) => (r.rowIndex === rowIndex ? { ...r, selected: !r.selected } : r)));
  };
  const toggleAll = (selected: boolean) => setReviewRows((rows) => rows.map((r) => ({ ...r, selected })));
  const updateAmount = (rowIndex: number, amount: number) => {
    setReviewRows((rows) => rows.map((r) => (r.rowIndex === rowIndex ? { ...r, amount } : r)));
  };

  const selectedRows = reviewRows.filter((r) => r.selected && r.amount !== 0);
  const totalIqd = selectedRows.reduce((acc, r) => acc + r.amount, 0);

  async function handleCertify() {
    if (!result) return;
    setPhase("certifying");
    try {
      const companyId = getActiveCompanyId();
      const res = await certifyFile({
        data: {
          companyId, fileId: result.fileId, actorId,
          rows: selectedRows.map((r) => ({
            amount: r.amount, entryDate: r.entryDate,
            department: result!.classification.department,
            dimension: result!.classification.dimension,
            action: result!.classification.suggestedAction,
            metadata: { source_row: r.rowIndex, raw: r.raw },
          })),
        },
      } as any);
      setCertifySummary({ count: (res as any).inserted, totalIqd });
      setPhase("done");
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setPhase("error");
    }
  }

  async function handleReject() {
    if (!result) return;
    try {
      await rejectFile({ data: { fileId: result.fileId, reason: "Human reviewer rejected." } } as any);
      setPhase("idle");
      setResult(null);
      setReviewRows([]);
    } catch (err: any) {
      setError(err?.message ?? String(err));
    }
  }

  if (phase === "idle" || phase === "error") {
    return (
      <Card title="Upload Document — Rule 3: لا توجد قيود يدوية">
        <label className="flex h-60 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white hover:bg-slate-50">
          <input
            type="file" accept=".xlsx,.xls,.csv" hidden
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
          <div className="text-3xl">📄</div>
          <div className="font-bold">اسحب الملف هنا أو انقر للاختيار</div>
          <div className="text-sm text-slate-500">XLSX / XLS / CSV — يحسب SHA-256، يستخرج البيانات، يصنّف البُعد</div>
          <div className="text-xs text-amber-600">PDF و OCR يحتاجان معالجة منفصلة (قريباً)</div>
        </label>
        {phase === "error" && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
            <div className="font-bold">خطأ</div>
            <div>{error}</div>
          </div>
        )}
      </Card>
    );
  }

  if (phase === "uploading") {
    return (
      <Card title="جاري المعالجة">
        <div className="space-y-2">
          <div>✓ رفع الملف</div>
          <div>⏳ حساب SHA-256...</div>
          <div>⏳ استخراج البيانات وتصنيفها...</div>
          <div className="text-xs text-slate-500">جاري التحقق من الصلاحيات وتأمين RLS لجلسة الشركة الحالية...</div>
        </div>
      </Card>
    );
  }

  if (phase === "done" && certifySummary) {
    return (
      <Card title="تم التصديق">
        <div className="space-y-2">
          <div className="text-2xl">✅</div>
          <div className="font-bold">تم ترحيل {certifySummary.count} قيد إلى الدفتر الثابت</div>
          <div className="text-slate-600">إجمالي المبالغ: {certifySummary.totalIqd.toLocaleString()} د.ع</div>
          <div className="text-xs text-slate-500">كل قيد يحمل SHA-256 ويرتبط بالملف المصدر. لا يمكن تعديلها — فقط بقيد معاكس موثّق.</div>
          <button onClick={() => { setPhase("idle"); setResult(null); setReviewRows([]); setCertifySummary(null); }} className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-white">
            رفع ملف آخر
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={`مراجعة بشرية — ${result?.filename}`}>
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500">البُعد المُكتشف</div>
          <div className="text-lg font-black">{result?.classification.dimension}</div>
          <div className="text-xs text-slate-500">ثقة: {((result?.classification.confidence ?? 0) * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500">القسم</div>
          <div className="text-lg font-black">{result?.classification.department}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500">إجراء مقترح</div>
          <div className="text-lg font-black">{result?.classification.suggestedAction}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500">SHA-256</div>
          <div className="font-mono text-xs break-all">{result?.fileHash.slice(0, 24)}…</div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => toggleAll(true)} className="rounded-lg border px-3 py-2 text-sm">اختر الكل</button>
        <button onClick={() => toggleAll(false)} className="rounded-lg border px-3 py-2 text-sm">إلغاء الكل</button>
        <span className="ms-auto text-sm">
          {selectedRows.length} / {reviewRows.length} صف — إجمالي {totalIqd.toLocaleString()} د.ع
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-xs">
            <tr>
              <th className="p-2">اختر</th><th className="p-2">صف</th>
              <th className="p-2">المبلغ (د.ع)</th><th className="p-2">التاريخ</th>
              <th className="p-2">القيم الخام</th>
            </tr>
          </thead>
          <tbody>
            {reviewRows.slice(0, 100).map((r) => (
              <tr key={r.rowIndex} className="border-b">
                <td className="p-2"><input type="checkbox" checked={r.selected} onChange={() => toggleRow(r.rowIndex)} /></td>
                <td className="p-2 text-slate-500">{r.rowIndex}</td>
                <td className="p-2">
                  <input type="number" value={r.amount}
                    onChange={(e) => updateAmount(r.rowIndex, Number(e.target.value))}
                    className="w-32 rounded border px-2 py-1" />
                </td>
                <td className="p-2 text-xs">{new Date(r.entryDate).toLocaleDateString("en-GB")}</td>
                <td className="p-2 text-xs text-slate-500 max-w-xs truncate">
                  {Object.entries(r.raw).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reviewRows.length > 100 && (
        <div className="mt-2 text-xs text-slate-500">يعرض أول 100 صف من أصل {reviewRows.length} — الكل سيُرحل عند التصديق.</div>
      )}

      <div className="mt-4 flex gap-2">
        <button disabled={phase === "certifying" || selectedRows.length === 0} onClick={handleCertify}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-40">
          {phase === "certifying" ? "جاري الترحيل..." : `صدّق ${selectedRows.length} قيداً`}
        </button>
        <button onClick={handleReject} className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-red-700">رفض الملف</button>
        <button onClick={() => setPhase("idle")} className="rounded-lg border px-4 py-2">إلغاء</button>
      </div>
    </Card>
  );
}
