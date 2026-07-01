// apps/web/src/lib/pdf.ts

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function utcHeader(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace("T", " ") + " UTC";
}

export async function exportCertifiedPdf(
  title: string,
  payload: unknown,
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const generatedAt = utcHeader();
  const certificate = await sha256(
    JSON.stringify({
      title,
      generatedAt,
      payload,
    }),
  );

  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(title, 14, 18);

  doc.setFontSize(10);
  doc.text(`Generated at: ${generatedAt}`, 14, 28);
  doc.text(`Tamper-Proof Certificate: SHA-256 ${certificate}`, 14, 36);

  doc.setFontSize(9);
  const lines = doc.splitTextToSize(JSON.stringify(payload, null, 2), 180);
  doc.text(lines, 14, 48);

  doc.save(`${title.replace(/\s+/g, "-").toLowerCase()}-${generatedAt}.pdf`);
}