import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Car, Gauge, History, ImageIcon, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AdminCheckField,
  AdminField,
  AdminSelectField,
  AdminTextField,
} from "@/components/admin/admin-vin-form-fields";
import { useTranslation } from "@/i18n/context";
import { formatCountryName, countryLabelsFromT } from "@/lib/format-country-name";
import {
  ADMIN_BODY_OPTIONS,
  ADMIN_COLOR_OPTIONS,
  ADMIN_FUEL_OPTIONS,
  ADMIN_TRANSMISSION_OPTIONS,
  buildAttrSelectOptions,
  buildCountrySelectOptions,
  resolveBodySelectValue,
  resolveColorSelectValue,
  resolveCountrySelectValue,
  resolveFuelSelectValue,
  resolveTransmissionSelectValue,
} from "@/lib/vehicle-attr-options";
import {
  VinCatalogHistorySections,
  normalizeAccidents,
  normalizeInsuranceClaims,
  normalizeMileageHistory,
  normalizeOwnerHistory,
  normalizeAuctionHistory,
  normalizeRegistryHistory,
  normalizeMarketData,
  normalizeServiceHistory,
  accidentsToPayload,
  insuranceClaimsToPayload,
  mileageHistoryToPayload,
  serviceHistoryToPayload,
  ownerHistoryToPayload,
  auctionHistoryToPayload,
  registryHistoryToPayload,
  marketDataToPayload,
  EMPTY_MARKET_DATA,
  type CatalogAccidentForm,
  type CatalogInsuranceClaimForm,
  type CatalogMileageForm,
  type CatalogServiceForm,
  type CatalogOwnerForm,
  type CatalogAuctionForm,
  type CatalogRegistryForm,
  type CatalogMarketDataForm,
} from "@/components/admin/vin-catalog-history-editors";

export type VinCatalogData = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  trim?: string | null;
  engine?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  bodyType?: string | null;
  color?: string | null;
  country?: string | null;
  odometer?: number | null;
  ownerCount?: number | null;
  accidentCount?: number | null;
  hp?: number | null;
  cylinders?: number | null;
  titleStatus?: string | null;
  isSalvage?: boolean;
  isStolen?: boolean;
  isTaxi?: boolean;
  isFlooded?: boolean;
  floodCount?: number | null;
  floodLossAmount?: number | null;
  photos?: string[] | null;
  accidents?: unknown;
  insuranceClaims?: unknown;
  mileageHistory?: unknown;
  serviceHistory?: unknown;
  ownerHistory?: unknown;
  auctionHistory?: unknown;
  registryHistory?: unknown;
  marketData?: unknown;
};

export type VinCatalogFormState = {
  make: string;
  model: string;
  year: string;
  trim: string;
  engine: string;
  transmission: string;
  fuelType: string;
  bodyType: string;
  color: string;
  country: string;
  odometer: string;
  ownerCount: string;
  accidentCount: string;
  hp: string;
  cylinders: string;
  titleStatus: string;
  isSalvage: boolean;
  isStolen: boolean;
  isTaxi: boolean;
  isFlooded: boolean;
  floodCount: string;
  floodLossAmount: string;
  photos: string[];
  accidents: CatalogAccidentForm[];
  insuranceClaims: CatalogInsuranceClaimForm[];
  mileageHistory: CatalogMileageForm[];
  serviceHistory: CatalogServiceForm[];
  ownerHistory: CatalogOwnerForm[];
  auctionHistory: CatalogAuctionForm[];
  registryHistory: CatalogRegistryForm[];
  marketData: CatalogMarketDataForm;
};

export const EMPTY_VIN_CATALOG_FORM: VinCatalogFormState = {
  make: "",
  model: "",
  year: "",
  trim: "",
  engine: "",
  transmission: "",
  fuelType: "",
  bodyType: "",
  color: "",
  country: "",
  odometer: "",
  ownerCount: "",
  accidentCount: "",
  hp: "",
  cylinders: "",
  titleStatus: "",
  isSalvage: false,
  isStolen: false,
  isTaxi: false,
  isFlooded: false,
  floodCount: "",
  floodLossAmount: "",
  photos: [],
  accidents: [],
  insuranceClaims: [],
  mileageHistory: [],
  serviceHistory: [],
  ownerHistory: [],
  auctionHistory: [],
  registryHistory: [],
  marketData: { ...EMPTY_MARKET_DATA },
};

export function vinCatalogFormFromData(data: VinCatalogData | null | undefined): VinCatalogFormState {
  const d = data ?? {};
  return {
    make: String(d.make ?? ""),
    model: String(d.model ?? ""),
    year: d.year != null ? String(d.year) : "",
    trim: String(d.trim ?? ""),
    engine: String(d.engine ?? ""),
    transmission: String(d.transmission ?? ""),
    fuelType: String(d.fuelType ?? ""),
    bodyType: String(d.bodyType ?? ""),
    color: String(d.color ?? ""),
    country: String(d.country ?? ""),
    odometer: d.odometer != null ? String(d.odometer) : "",
    ownerCount: d.ownerCount != null ? String(d.ownerCount) : "",
    accidentCount: d.accidentCount != null ? String(d.accidentCount) : "",
    hp: d.hp != null ? String(d.hp) : "",
    cylinders: d.cylinders != null ? String(d.cylinders) : "",
    titleStatus: String(d.titleStatus ?? ""),
    isSalvage: Boolean(d.isSalvage),
    isStolen: Boolean(d.isStolen),
    isTaxi: Boolean(d.isTaxi),
    isFlooded: Boolean(d.isFlooded),
    floodCount: d.floodCount != null ? String(d.floodCount) : "",
    floodLossAmount: d.floodLossAmount != null ? String(d.floodLossAmount) : "",
    photos: Array.isArray(d.photos) ? d.photos.filter(Boolean) : [],
    accidents: normalizeAccidents(d.accidents),
    insuranceClaims: normalizeInsuranceClaims(d.insuranceClaims),
    mileageHistory: normalizeMileageHistory(d.mileageHistory),
    serviceHistory: normalizeServiceHistory(d.serviceHistory),
    ownerHistory: normalizeOwnerHistory(d.ownerHistory),
    auctionHistory: normalizeAuctionHistory(d.auctionHistory),
    registryHistory: normalizeRegistryHistory(d.registryHistory),
    marketData: normalizeMarketData(d.marketData),
  };
}

function numberOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function vinCatalogPayloadFromForm(form: VinCatalogFormState): VinCatalogData {
  const accidents = accidentsToPayload(form.accidents);
  const owners = ownerHistoryToPayload(form.ownerHistory);

  // Suggest counts from history length only when admin left the count empty
  // (never overwrite an intentional value, including explicit 0).
  const accidentCount = form.accidentCount.trim()
    ? numberOrNull(form.accidentCount)
    : accidents.length > 0
      ? accidents.length
      : null;
  const ownerCount = form.ownerCount.trim()
    ? numberOrNull(form.ownerCount)
    : owners.length > 0
      ? owners.length
      : null;

  return {
    make: form.make.trim() || null,
    model: form.model.trim() || null,
    year: numberOrNull(form.year),
    trim: form.trim.trim() || null,
    engine: form.engine.trim() || null,
    transmission: form.transmission.trim() || null,
    fuelType: form.fuelType.trim() || null,
    bodyType: form.bodyType.trim() || null,
    color: form.color.trim() || null,
    country: resolveCountrySelectValue(form.country) || null,
    odometer: numberOrNull(form.odometer),
    ownerCount,
    accidentCount,
    hp: numberOrNull(form.hp),
    cylinders: numberOrNull(form.cylinders),
    titleStatus: form.titleStatus.trim() || null,
    isSalvage: form.isSalvage,
    isStolen: form.isStolen,
    isTaxi: form.isTaxi,
    isFlooded: form.isFlooded,
    floodCount: numberOrNull(form.floodCount),
    floodLossAmount: numberOrNull(form.floodLossAmount),
    photos: form.photos,
    accidents,
    insuranceClaims: insuranceClaimsToPayload(form.insuranceClaims),
    mileageHistory: mileageHistoryToPayload(form.mileageHistory),
    serviceHistory: serviceHistoryToPayload(form.serviceHistory),
    ownerHistory: owners,
    auctionHistory: auctionHistoryToPayload(form.auctionHistory),
    registryHistory: registryHistoryToPayload(form.registryHistory),
    marketData: marketDataToPayload(form.marketData),
  };
}

/** Flush any URL still sitting in the paste field before Save / Publish. */
export type VinCatalogPhotoManagerHandle = {
  consumePending: () => string[];
};

export const VinCatalogPhotoManager = forwardRef<
  VinCatalogPhotoManagerHandle,
  {
    photos: string[];
    onChange: (photos: string[]) => void;
    pendingUrl: string;
    onPendingUrlChange: (url: string) => void;
    compact?: boolean;
  }
>(function VinCatalogPhotoManager({
  photos,
  onChange,
  pendingUrl,
  onPendingUrlChange,
  compact = false,
}, ref) {
  const consumePending = (): string[] => {
    const url = pendingUrl.trim();
    if (!url) return photos;
    const next = photos.includes(url) ? photos : [...photos, url];
    onPendingUrlChange("");
    onChange(next);
    return next;
  };

  useImperativeHandle(ref, () => ({ consumePending }), [pendingUrl, photos, onChange, onPendingUrlChange]);

  const addPhoto = () => {
    consumePending();
  };

  const movePhoto = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const thumbClass = compact ? "h-9 w-14" : "h-12 w-20";

  return (
    <div className="space-y-3">
      {photos.length > 0 ? (
        <div className="space-y-2">
          {photos.map((url, i) => (
            <div key={`${i}-${url}`} className="flex items-center gap-2 rounded-lg border bg-background px-2 py-2 group">
              <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0 text-center">{i + 1}</span>
              <img src={url} alt="" className={`${thumbClass} rounded object-cover shrink-0 border`}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <Input
                value={url}
                onChange={(e) => onChange(photos.map((p, idx) => (idx === i ? e.target.value : p)))}
                className="h-8 text-xs font-mono flex-1 min-w-0"
              />
              <div className="flex flex-col gap-0.5 shrink-0">
                <button type="button" title="Move up"
                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
                  disabled={i === 0}
                  onClick={() => movePhoto(i, i - 1)}>
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button type="button" title="Move down"
                  className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted disabled:opacity-30"
                  disabled={i === photos.length - 1}
                  onClick={() => movePhoto(i, i + 1)}>
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
              <button type="button"
                className="shrink-0 h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onChange(photos.filter((_, idx) => idx !== i))}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic py-2">No photos yet — paste a URL below.</p>
      )}
      <div className="flex gap-2">
        <Input value={pendingUrl} onChange={(e) => onPendingUrlChange(e.target.value)}
          placeholder="https://cdn.example.com/photo.jpg"
          className="h-8 text-xs font-mono"
          onBlur={() => { if (pendingUrl.trim()) consumePending(); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPhoto(); } }} />
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 shrink-0"
          onClick={addPhoto} disabled={!pendingUrl.trim()}>
          <Plus className="h-3.5 w-3.5" />Add
        </Button>
      </div>
    </div>
  );
});

type VinCatalogDataFormProps = {
  form: VinCatalogFormState;
  onChange: (patch: Partial<VinCatalogFormState>) => void;
  compact?: boolean;
  showHistorySections?: boolean;
};

export type VinCatalogDataFormHandle = {
  /** Commit any URL still in the paste field; returns photos to use in the save payload. */
  flushPendingPhotos: () => string[];
};

function historyRecordCount(form: VinCatalogFormState): number {
  return (
    form.accidents.length
    + form.insuranceClaims.length
    + form.mileageHistory.length
    + form.serviceHistory.length
    + form.ownerHistory.length
    + form.auctionHistory.length
    + form.registryHistory.length
    + (form.marketData.estimatedValue || form.marketData.lastAuctionPrice ? 1 : 0)
    + (form.floodCount.trim() || form.floodLossAmount.trim() ? 1 : 0)
  );
}

const TITLE_STATUS_OPTIONS = [
  { value: "", label: "—" },
  { value: "clean", label: "Clean" },
  { value: "salvage", label: "Salvage" },
  { value: "rebuilt", label: "Rebuilt" },
  { value: "junk", label: "Junk" },
  { value: "flood", label: "Flood" },
  { value: "other", label: "Other" },
];

export const VinCatalogDataForm = forwardRef<VinCatalogDataFormHandle, VinCatalogDataFormProps>(function VinCatalogDataForm({
  form,
  onChange,
  compact = false,
  showHistorySections = true,
}, ref) {
  const { t, language } = useTranslation();
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState("");
  const photoManagerRef = useRef<VinCatalogPhotoManagerHandle>(null);

  useImperativeHandle(ref, () => ({
    flushPendingPhotos: () => {
      const url = pendingPhotoUrl.trim();
      if (!url) return photoManagerRef.current?.consumePending() ?? form.photos;
      const next = form.photos.includes(url) ? form.photos : [...form.photos, url];
      setPendingPhotoUrl("");
      onChange({ photos: next });
      return next;
    },
  }), [form.photos, pendingPhotoUrl, onChange]);

  const set = <K extends keyof VinCatalogFormState>(key: K, value: VinCatalogFormState[K]) => {
    onChange({ [key]: value });
  };

  const countryLabels = useMemo(() => countryLabelsFromT(t), [t]);
  const transmissionOptions = useMemo(
    () => buildAttrSelectOptions(t, ADMIN_TRANSMISSION_OPTIONS, form.transmission, "—", resolveTransmissionSelectValue),
    [t, form.transmission],
  );
  const fuelOptions = useMemo(
    () => buildAttrSelectOptions(t, ADMIN_FUEL_OPTIONS, form.fuelType, "—", resolveFuelSelectValue),
    [t, form.fuelType],
  );
  const bodyOptions = useMemo(
    () => buildAttrSelectOptions(t, ADMIN_BODY_OPTIONS, form.bodyType, "—", resolveBodySelectValue),
    [t, form.bodyType],
  );
  const colorOptions = useMemo(
    () => buildAttrSelectOptions(t, ADMIN_COLOR_OPTIONS, form.color, "—", resolveColorSelectValue),
    [t, form.color],
  );
  const countryOptions = useMemo(
    () => buildCountrySelectOptions(
      (code) => formatCountryName(code, language, countryLabels) || code.toUpperCase(),
      form.country,
    ),
    [language, countryLabels, form.country],
  );

  const transmissionValue = resolveTransmissionSelectValue(form.transmission);
  const fuelValue = resolveFuelSelectValue(form.fuelType);
  const bodyValue = resolveBodySelectValue(form.bodyType);
  const colorValue = resolveColorSelectValue(form.color);
  const countryValue = resolveCountrySelectValue(form.country);

  const historyCount = useMemo(() => historyRecordCount(form), [form]);
  const vehicleGrid = compact
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";
  const metricsGrid = compact
    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4";

  const vehicleTab = (
    <div className={vehicleGrid}>
      <AdminTextField label="Make" value={form.make} onChange={(v) => set("make", v)} compact={compact} />
      <AdminTextField label="Model" value={form.model} onChange={(v) => set("model", v)} compact={compact} />
      <AdminTextField label="Year" value={form.year} onChange={(v) => set("year", v)} type="number" compact={compact} />
      <AdminTextField label="Trim" value={form.trim} onChange={(v) => set("trim", v)} compact={compact} />
      <AdminTextField label="Engine" value={form.engine} onChange={(v) => set("engine", v)} compact={compact} />
      <AdminSelectField
        label="Transmission"
        value={transmissionValue}
        onChange={(v) => set("transmission", v)}
        options={transmissionOptions}
        compact={compact}
      />
      <AdminSelectField
        label="Fuel type"
        value={fuelValue}
        onChange={(v) => set("fuelType", v)}
        options={fuelOptions}
        compact={compact}
      />
      <AdminSelectField
        label="Body type"
        value={bodyValue}
        onChange={(v) => set("bodyType", v)}
        options={bodyOptions}
        compact={compact}
      />
      <AdminSelectField
        label="Color"
        value={colorValue}
        onChange={(v) => set("color", v)}
        options={colorOptions}
        compact={compact}
      />
      <AdminSelectField
        label="Country"
        hint="Canonical ISO / region codes — reports translate by visitor language"
        value={countryValue}
        onChange={(v) => set("country", v)}
        options={countryOptions}
        compact={compact}
      />
    </div>
  );

  const metricsTab = (
    <div className="space-y-4">
      <div className={metricsGrid}>
        <AdminTextField
          label="Odometer (km)"
          hint="Saved value locks mileage on publish/save"
          value={form.odometer}
          onChange={(v) => set("odometer", v)}
          type="number"
          compact={compact}
        />
        <AdminTextField
          label="Owner count"
          hint={form.ownerCount.trim() ? undefined : "Empty → auto from owner history on save"}
          value={form.ownerCount}
          onChange={(v) => set("ownerCount", v)}
          type="number"
          compact={compact}
        />
        <AdminTextField
          label="Accident count"
          hint={form.accidentCount.trim() ? undefined : "Empty → auto from accidents on save"}
          value={form.accidentCount}
          onChange={(v) => set("accidentCount", v)}
          type="number"
          compact={compact}
        />
        <AdminTextField label="Horsepower" value={form.hp} onChange={(v) => set("hp", v)} type="number" compact={compact} />
        <AdminTextField label="Cylinders" value={form.cylinders} onChange={(v) => set("cylinders", v)} type="number" compact={compact} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminTextField
          label="Title status"
          value={form.titleStatus}
          onChange={(v) => set("titleStatus", v)}
          suggestions={TITLE_STATUS_OPTIONS.map((o) => o.value).filter(Boolean)}
          compact={compact}
        />
        <AdminCheckField
          label="Salvage title"
          hint="Shown as a warning badge on reports"
          checked={form.isSalvage}
          onChange={(v) => set("isSalvage", v)}
        />
        <AdminCheckField
          label="Stolen record"
          hint="Flags the vehicle as stolen in reports"
          checked={form.isStolen}
          onChange={(v) => set("isStolen", v)}
        />
        <AdminCheckField
          label="Used as a taxi"
          hint="Shown as a warning on reports when this vehicle was used as a taxi"
          checked={form.isTaxi}
          onChange={(v) => set("isTaxi", v)}
        />
        <AdminCheckField
          label="Flood damage"
          hint="Shows the flood pill and flood section on reports (edit count/amount under History)"
          checked={form.isFlooded}
          onChange={(v) => set("isFlooded", v)}
        />
      </div>
    </div>
  );

  const photosTab = (
    <AdminField label="Vehicle photos" hint="Paste any public HTTPS image URL, then Save (Add is optional — Save also commits the paste field). Encar/Carstat URLs are proxied; other hosts load directly on reports.">
      <VinCatalogPhotoManager
        ref={photoManagerRef}
        photos={form.photos}
        onChange={(photos) => set("photos", photos)}
        pendingUrl={pendingPhotoUrl}
        onPendingUrlChange={setPendingPhotoUrl}
        compact={compact}
      />
    </AdminField>
  );

  const historyTab = showHistorySections ? (
    <VinCatalogHistorySections
      form={form}
      onChange={onChange}
      compact={compact}
      vehicleCountry={form.country}
    />
  ) : null;

  if (compact) {
    return (
      <div className="space-y-5">
        {vehicleTab}
        {metricsTab}
        {photosTab}
        {historyTab}
      </div>
    );
  }

  return (
    <Tabs defaultValue="vehicle" className="w-full">
      <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1 p-1">
        <TabsTrigger value="vehicle" className="gap-1.5">
          <Car className="h-3.5 w-3.5" />
          Vehicle
        </TabsTrigger>
        <TabsTrigger value="metrics" className="gap-1.5">
          <Gauge className="h-3.5 w-3.5" />
          Metrics
        </TabsTrigger>
        <TabsTrigger value="photos" className="gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" />
          Photos
          {form.photos.length > 0 ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{form.photos.length}</Badge>
          ) : null}
        </TabsTrigger>
        {showHistorySections ? (
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            History
            {historyCount > 0 ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{historyCount}</Badge>
            ) : null}
          </TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="vehicle" className="mt-4">{vehicleTab}</TabsContent>
      <TabsContent value="metrics" className="mt-4">{metricsTab}</TabsContent>
      <TabsContent value="photos" className="mt-4">{photosTab}</TabsContent>
      {showHistorySections ? (
        <TabsContent value="history" className="mt-4">{historyTab}</TabsContent>
      ) : null}
    </Tabs>
  );
});
