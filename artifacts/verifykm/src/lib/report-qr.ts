import QRCode from "qrcode";

/** Client-side QR data URL for print/PDF — no server work. */
export async function reportLinkQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 168,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
