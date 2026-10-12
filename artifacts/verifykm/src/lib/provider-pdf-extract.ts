/**
 * Client-only PDF text extraction via pdf.js.
 * The file never leaves the browser — no server upload.
 */

const MIN_TEXT_CHARS = 40;
const SAME_LINE_Y = 3;

export type LayoutTextItem = {
  str?: string;
  transform?: number[];
};

/**
 * Rebuild visual rows from PDF text items.
 * Carfax/AutoCheck tables are often emitted column-by-column. Sorting by
 * position keeps Date, Mileage, Source, and Comments on the same line.
 */
export function layoutPdfTextItems(items: LayoutTextItem[]): string {
  const placed: { str: string; x: number; y: number; order: number; positioned: boolean }[] = [];
  items.forEach((item, order) => {
    const raw = typeof item.str === "string" ? item.str.replace(/\u00a0/g, " ") : "";
    const str = raw.trim();
    if (!str) return;
    const t = item.transform;
    const positioned = Array.isArray(t)
      && t.length >= 6
      && Number.isFinite(t[4])
      && Number.isFinite(t[5]);
    placed.push({
      str,
      x: positioned ? t![4]! : order,
      y: positioned ? t![5]! : 0,
      order,
      positioned,
    });
  });
  if (placed.length === 0) return "";

  const positionedCount = placed.filter((p) => p.positioned).length;
  if (positionedCount < placed.length * 0.5) {
    return placed.map((p) => p.str).join(" ");
  }

  const ys = placed.filter((p) => p.positioned).map((p) => p.y);
  if (Math.max(...ys) - Math.min(...ys) < SAME_LINE_Y) {
    return [...placed].sort((a, b) => a.x - b.x || a.order - b.order).map((p) => p.str).join(" ");
  }

  const sorted = [...placed].sort((a, b) => b.y - a.y || a.x - b.x || a.order - b.order);
  const lines: { y: number; parts: typeof placed }[] = [];
  for (const item of sorted) {
    const line = lines.length > 0 ? lines[lines.length - 1]! : null;
    if (line && item.positioned && Math.abs(line.y - item.y) <= SAME_LINE_Y) {
      line.parts.push(item);
    } else {
      lines.push({ y: item.y, parts: [item] });
    }
  }
  return lines
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x || a.order - b.order)
        .map((p) => p.str)
        .join(" "),
    )
    .join("\n");
}

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
      const pageText = layoutPdfTextItems(
        content.items.map((item) => {
          if (!("str" in item)) return { str: "" };
          const transform = "transform" in item && Array.isArray(item.transform)
            ? item.transform.map((n) => Number(n))
            : undefined;
          return { str: String(item.str), transform };
        }),
      );
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
