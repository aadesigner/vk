import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, ArrowLeft, Loader2, Download, Trash2,
  Rocket, Gift, Banknote, FileText,
} from "lucide-react";
import { AdminVinSaveBar } from "@/components/admin/admin-vin-save-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  VinCatalogDataForm,
  EMPTY_VIN_CATALOG_FORM,
  vinCatalogFormFromData,
  vinCatalogPayloadFromForm,
  type VinCatalogData,
  type VinCatalogDataFormHandle,
  type VinCatalogFormState,
} from "@/components/admin/vin-catalog-data-form";
import { invalidateVinReportCaches } from "@/lib/vin-report-cache";
import { ADMIN_PENDING_COUNT_QUERY_KEY } from "@/lib/admin-pending-count";
import { extractTextFromPdfFile } from "@/lib/provider-pdf-extract";
import { parseProviderPdfText } from "@/lib/provider-pdf-parse";
import { applyProviderPdfToForm } from "@/lib/provider-pdf-apply";

type PendingRequest = {
  id: number;
  userId: string;
  email: string | null;
  name: string | null;
  lookupId: number;
  paymentId: number | null;
  createdAt: string;
};

type PendingDetail = {
  id: number;
  vin: string;
  status: string;
  draftData: VinCatalogData | null;
  createdAt: string;
  updatedAt: string;
  requests: PendingRequest[];
};

export default function AdminPendingVinDetail({ params }: { params: { id: string } }) {
  const pendingId = parseInt(params.id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [form, setForm] = useState<VinCatalogFormState>(EMPTY_VIN_CATALOG_FORM);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [publishMsg, setPublishMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [pdfImporting, setPdfImporting] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const exportLinkRef = useRef<HTMLAnchorElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const lastHydratedAtRef = useRef<string | null>(null);
  const formRef = useRef<VinCatalogDataFormHandle>(null);

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ["/api/admin/pending-vin-checks", pendingId],
    enabled: !isNaN(pendingId),
    queryFn: async () => {
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks/${pendingId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Not found");
      return r.json() as Promise<PendingDetail>;
    },
  });

  useEffect(() => {
    lastHydratedAtRef.current = null;
  }, [pendingId]);

  useEffect(() => {
    if (!detail?.draftData || saving) return;
    const serverAt = detail.updatedAt;
    if (lastHydratedAtRef.current != null && serverAt <= lastHydratedAtRef.current) return;
    lastHydratedAtRef.current = serverAt;
    setForm(vinCatalogFormFromData(detail.draftData));
  }, [detail?.draftData, detail?.updatedAt, saving]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const photos = formRef.current?.flushPendingPhotos() ?? form.photos;
      const payload = vinCatalogPayloadFromForm({ ...form, photos });
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks/${pendingId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        const errText = (body as { error?: string }).error;
        setSaveMsg({
          ok: false,
          text: r.status === 413
            ? "Draft is too large — try fewer photos or shorter history entries."
            : errText ?? `Save failed (${r.status})`,
        });
        return;
      }
      const body = (await r.json()) as PendingDetail;
      setSaveMsg({ ok: true, text: "Draft saved." });
      if (body.draftData) {
        setForm(vinCatalogFormFromData(body.draftData));
      }
      if (body.updatedAt) {
        lastHydratedAtRef.current = body.updatedAt;
      }
      if (detail) {
        invalidateVinReportCaches(queryClient, detail.vin);
        for (const req of detail.requests) {
          if (req.lookupId != null) {
            invalidateVinReportCaches(queryClient, detail.vin, req.lookupId);
          }
        }
      }
      // Preserve `requests` if the response ever omits it, so the detail page
      // never re-renders with an undefined `requests` array.
      const merged: PendingDetail = {
        ...body,
        requests: body.requests ?? detail?.requests ?? [],
      };
      queryClient.setQueryData(["/api/admin/pending-vin-checks", pendingId], merged);
      void queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey)
          && q.queryKey[0] === "/api/admin/pending-vin-checks"
          && q.queryKey.length === 3,
      });
    } catch {
      setSaveMsg({ ok: false, text: "Save failed — network error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!detail) return;
    if (!confirm(`Publish ${detail.vin} to the VIN catalog and notify ${detail.requests.length} user(s)?`)) return;
    setPublishing(true);
    setPublishMsg(null);
    try {
      const photos = formRef.current?.flushPendingPhotos() ?? form.photos;
      const payload = vinCatalogPayloadFromForm({ ...form, photos });
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks/${pendingId}/publish`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPublishMsg({ ok: false, text: (body as { error?: string }).error ?? "Publish failed" });
        return;
      }
      invalidateVinReportCaches(queryClient, detail.vin);
      for (const req of detail.requests) {
        invalidateVinReportCaches(queryClient, detail.vin, req.lookupId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-vin-checks"] });
      queryClient.invalidateQueries({ queryKey: ADMIN_PENDING_COUNT_QUERY_KEY });
      setLocation(`/adminx/vin/${detail.vin}`);
    } catch {
      setPublishMsg({ ok: false, text: "Publish failed — network error" });
    } finally {
      setPublishing(false);
    }
  };

  const handleExportJson = async () => {
    if (!detail) return;
    setExportLoading(true);
    try {
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks/${pendingId}/export.json`, { credentials: "include" });
      if (!r.ok) throw new Error("Export failed");
      const blob = await r.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = exportLinkRef.current!;
      a.href = objectUrl;
      a.download = `pending-vin-${detail.vin}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch {
      alert("JSON export failed.");
    } finally {
      setExportLoading(false);
    }
  };

  const handlePdfPickClick = () => {
    if (!detail || pdfImporting) return;
    if (!confirm(
      "Fill from vehicle history PDF?\n\nThis replaces all draft fields except photos. The PDF stays on your device (not uploaded). Miles are converted to km. Review and Save draft when done.",
    )) return;
    pdfInputRef.current?.click();
  };

  const handlePdfFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !detail) return;

    setPdfImporting(true);
    setPdfMsg(null);
    try {
      const extracted = await extractTextFromPdfFile(file);
      if (!extracted.ok) {
        setPdfMsg({ ok: false, text: extracted.error });
        return;
      }
      const parsed = parseProviderPdfText(extracted.text, detail.vin);
      if (!parsed.ok) {
        setPdfMsg({ ok: false, text: parsed.error });
        return;
      }
      setForm((prev) => applyProviderPdfToForm(prev, parsed.form));
      setSaveMsg(null);
      setPdfMsg({
        ok: true,
        text: `Filled from PDF — ${parsed.summary.join(" · ")}. Review fields, then Save draft.`,
      });
    } catch (err) {
      setPdfMsg({
        ok: false,
        text: err instanceof Error ? err.message : "PDF import failed",
      });
    } finally {
      setPdfImporting(false);
    }
  };

  const handleRemove = async () => {
    if (!detail) return;
    if (!confirm(
      `Remove pending check for ${detail.vin}? This deletes the admin draft and removes the report from ${detail.requests.length} client account(s). This cannot be undone.`,
    )) return;
    setRemoving(true);
    try {
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks/${pendingId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert((body as { error?: string }).error ?? "Remove failed");
        return;
      }
      for (const req of detail.requests) {
        invalidateVinReportCaches(queryClient, detail.vin, req.lookupId);
      }
      invalidateVinReportCaches(queryClient, detail.vin);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-vin-checks"] });
      queryClient.invalidateQueries({ queryKey: ADMIN_PENDING_COUNT_QUERY_KEY });
      setLocation("/adminx/pending-vin-checks");
    } catch {
      alert("Remove failed — network error");
    } finally {
      setRemoving(false);
    }
  };

  const handleCreditAndNotify = async () => {
    if (!detail) return;
    const uniqueUsers = new Set(detail.requests.map((r) => r.userId)).size;
    if (!confirm(
      `Credit user for ${detail.vin}?\n\n` +
      `• Add 1 free report credit to ${uniqueUsers} user(s)\n` +
      `• Email them that no information was found (Admin → Emails → No info / credit)\n` +
      `• Remove this pending check (same as Remove pending)\n\n` +
      `This cannot be undone.`,
    )) return;
    setCrediting(true);
    try {
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks/${pendingId}/credit-and-notify`, {
        method: "POST",
        credentials: "include",
      });
      const body = await r.json().catch(() => ({})) as {
        error?: string;
        creditedUsers?: unknown[];
        emailsSent?: number;
      };
      if (!r.ok) {
        alert(body.error ?? "Credit & notify failed");
        return;
      }
      for (const req of detail.requests) {
        invalidateVinReportCaches(queryClient, detail.vin, req.lookupId);
      }
      invalidateVinReportCaches(queryClient, detail.vin);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-vin-checks"] });
      queryClient.invalidateQueries({ queryKey: ADMIN_PENDING_COUNT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      setLocation("/adminx/pending-vin-checks");
    } catch {
      alert("Credit & notify failed — network error");
    } finally {
      setCrediting(false);
    }
  };

  const handleRemoveAndRefund = async () => {
    if (!detail) return;
    if (!confirm(
      `Remove pending + mark refunded for ${detail.vin}?\n\n` +
      `• Remove pending check and client report access\n` +
      `• Mark linked payments as refunded (deducts from sales)\n` +
      `• Email customers (Admin → Emails → No info / refund)\n` +
      `• Does NOT refund PayPal/POK — do that manually\n\n` +
      `This cannot be undone.`,
    )) return;
    setRefunding(true);
    try {
      const r = await fetch(`${basePath}/api/admin/pending-vin-checks/${pendingId}/remove-and-refund`, {
        method: "POST",
        credentials: "include",
      });
      const body = await r.json().catch(() => ({})) as { error?: string; paymentsRefunded?: number };
      if (!r.ok) {
        alert(body.error ?? "Remove + refunded failed");
        return;
      }
      for (const req of detail.requests) {
        invalidateVinReportCaches(queryClient, detail.vin, req.lookupId);
      }
      invalidateVinReportCaches(queryClient, detail.vin);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-vin-checks"] });
      queryClient.invalidateQueries({ queryKey: ADMIN_PENDING_COUNT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setLocation("/adminx/pending-vin-checks");
    } catch {
      alert("Remove + refunded failed — network error");
    } finally {
      setRefunding(false);
    }
  };

  if (isNaN(pendingId)) {
    return <p className="text-muted-foreground">Invalid ID</p>;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-10 w-10 text-destructive/60" />
        <p className="text-muted-foreground">Pending VIN check not found</p>
        <Button variant="outline" onClick={() => setLocation("/adminx/pending-vin-checks")}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <a ref={exportLinkRef} className="hidden" aria-hidden="true" />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handlePdfFileChange(e)}
      />

      <Link href="/adminx/pending-vin-checks" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Queue
      </Link>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-bold tracking-wide sm:text-xl">{detail.vin}</h1>
            <Badge variant="outline" className="text-amber-700 border-amber-300 dark:text-amber-300">Waiting</Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {(detail.requests ?? []).length === 0
              ? "No buyers"
              : (detail.requests ?? []).map((req) => req.email || req.name || req.userId.slice(0, 8)).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-1.5"
            onClick={handlePdfPickClick}
            disabled={saving || publishing || removing || crediting || refunding || pdfImporting}
            title="Read vehicle history PDF on this device — nothing is uploaded"
          >
            {pdfImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {pdfImporting ? "Reading PDF…" : "Fill from PDF"}
          </Button>
          <Button
            className="h-10 gap-1.5"
            onClick={handlePublish}
            disabled={saving || publishing || removing || crediting || refunding || pdfImporting}
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>

      <details className="rounded-xl border bg-muted/20 px-4 py-2">
        <summary className="cursor-pointer list-none py-1 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
          Can&apos;t deliver · extra tools
        </summary>
        <div className="flex flex-wrap gap-2 pb-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={handleCreditAndNotify}
            disabled={saving || publishing || removing || crediting || refunding || pdfImporting || (detail.requests ?? []).length === 0}
            title="Adds 1 credit per user, emails them, and removes this pending check"
          >
            {crediting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            Credit buyers
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={handleRemoveAndRefund}
            disabled={saving || publishing || removing || crediting || refunding || pdfImporting}
            title="Removes pending, marks payments refunded (deducts sales), emails customer. Refund PayPal/POK yourself."
          >
            {refunding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
            Mark refunded
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-destructive"
            onClick={handleRemove}
            disabled={saving || publishing || removing || crediting || refunding || pdfImporting}
            title="Remove pending"
          >
            {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Remove
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5"
            onClick={handleExportJson}
            disabled={exportLoading || saving || publishing || removing || crediting || refunding}
          >
            {exportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            JSON
          </Button>
        </div>
      </details>

      {publishMsg && (
        <div className={`text-sm px-4 py-2 rounded-lg border ${publishMsg.ok ? "bg-[#e6f6ff] border-[#b3e3fe] text-[#075985]" : "bg-red-50 border-red-200 text-red-800"}`}>
          {publishMsg.text}
        </div>
      )}

      {pdfMsg && (
        <div className={`text-sm px-4 py-2 rounded-lg border ${pdfMsg.ok ? "bg-[#e6f6ff] border-[#b3e3fe] text-[#075985] dark:bg-[#003a5c]/40/40 dark:border-[#006aa8] dark:text-[#7dd3fc]" : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"}`}>
          {pdfMsg.text}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Draft report</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Fill from PDF or edit tabs, save draft, then publish.
          </p>
        </CardHeader>
        <CardContent className="pb-0">
          <VinCatalogDataForm
            ref={formRef}
            form={form}
            onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          />

          <AdminVinSaveBar
            onSave={handleSave}
            saving={saving}
            saveLabel="Save draft"
            saveMsg={saveMsg}
            hint="Ctrl+S to save draft · publish emails every waiting buyer"
            disabled={publishing || removing || crediting || refunding || pdfImporting}
            extra={(
              <Button onClick={handlePublish} disabled={saving || publishing || removing || crediting || refunding || pdfImporting} className="gap-1.5">
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {publishing ? "Publishing…" : "Publish"}
              </Button>
            )}
          />
        </CardContent>
      </Card>

      <div className="h-4" aria-hidden />
    </div>
  );
}
