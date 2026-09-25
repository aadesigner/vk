/**
 * Client-only PDF text extraction via pdf.js.
 * The file never leaves the browser — no server upload.
 */

const MIN_TEXT_CHARS = 40;

export type ProviderPdfExtractResult =
  | { ok: true; text: string; pageCount: number }
  | { ok: false; error: string };

let workerConfigured = false;

async function configurePdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    // Vite resolves the worker URL for production builds
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    workerConfigured = true;
  }
  return pdfjs;
}

export async function extractTextFromPdfFile(file: File): Promise<ProviderPdfExtractResult> {
  if (!file || file.size === 0) {
    return { ok: false, error: "No PDF selected." };
  }
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (type && type !== "application/pdf" && !name.endsWith(".pdf")) {
    return { ok: false, error: "Please select a PDF file." };
  }

  try {
    const pdfjs = await configurePdfJs();
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: buffer });
    const doc = await loadingTask.promise;
    const pageCount = doc.numPages;
    const chunks: string[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? String(item.str) : ""))
        .filter(Boolean)
        .join(" ");
      chunks.push(pageText);
    }

    // Soft destroy — ignore if API differs across versions
    try {
      await doc.destroy();
    } catch {
      /* ignore */
    }

    const text = chunks.join("\n").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
    if (text.replace(/\s+/g, "").length < MIN_TEXT_CHARS) {
      return {
        ok: false,
        error: "Could not read text from this PDF (it may be a scanned image). Use a text-based Carfax or AutoCheck PDF.",
      };
    }
    return { ok: true, text, pageCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to read PDF";
    return { ok: false, error: msg };
  }
}
