import { warmVinImages } from "@/lib/vin-image-cache";

export async function copyReportLink(url: string): Promise<boolean> {
  return copyTextToClipboard(url);
}

/** Opens the browser print dialog for the compact VIN report summary (Save as PDF). */
export async function openVinReportPdf(): Promise<void> {
  if (typeof window === "undefined") return;
  const imgs = getPrintSummaryImages();
  const urls = imgs.map((img) => img.src).filter(Boolean);
  if (urls.length > 0) {
    // Print needs every visible summary image — not just hero neighbors.
    await warmVinImages(urls);
  }
  // QR is generated async; give it a brief chance before print if still loading.
  await waitForPrintQr();
  await waitForPrintImages(imgs);
  window.print();
}

function waitForPrintQr(timeoutMs = 1500): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const existing = document.querySelector<HTMLImageElement>(".vin-report-print-summary .print-report-qr");
  if (existing?.complete && existing.naturalWidth > 0) return Promise.resolve();

  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      const img = document.querySelector<HTMLImageElement>(".vin-report-print-summary .print-report-qr");
      if (img?.complete && img.naturalWidth > 0) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve();
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

function getPrintSummaryImages(): HTMLImageElement[] {
  if (typeof document === "undefined") return [];
  return Array.from(
    document.querySelectorAll<HTMLImageElement>(".vin-report-print-summary img[src]"),
  );
}

function waitForPrintImages(
  imgs = getPrintSummaryImages(),
  timeoutMs = Math.min(20_000, 2_500 + imgs.length * 750),
): Promise<void> {
  const urls = [...new Set(imgs.map((img) => img.src).filter(Boolean))];
  if (urls.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);

    void Promise.all(
      urls.map(
        (url) =>
          new Promise<void>((res) => {
            const image = new Image();
            image.onload = () => res();
            image.onerror = () => res();
            image.src = url;
          }),
      ),
    ).finally(() => {
      window.clearTimeout(timer);
      finish();
    });
  });
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

export type ShareVinReportPdfResult = "shared" | "copied" | "cancelled" | "failed";

/** Native share sheet when available; otherwise copy the report link. */
export async function shareVinReportPdf(options: {
  vehicleTitle: string;
  vin: string;
  shareUrl?: string | null;
  shareText: string;
}): Promise<ShareVinReportPdfResult> {
  const { vehicleTitle, vin, shareUrl, shareText } = options;
  const title = `${vehicleTitle} (${vin})`;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({
        title,
        text: shareText,
        ...(shareUrl ? { url: shareUrl } : {}),
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }

  if (shareUrl) {
    const ok = await copyTextToClipboard(shareUrl);
    return ok ? "copied" : "failed";
  }

  return "failed";
}
