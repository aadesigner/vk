import { Fingerprint } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/context";

export type VehicleIdentityField = {
  key: string;
  label: string;
  value: string | null | undefined;
};

type Props = {
  fields: VehicleIdentityField[];
  className?: string;
};

const FEATURED_KEYS = new Set(["make", "model", "year"]);

function formatSpecValue(key: string, value: string) {
  const raw = value.trim();
  if (key === "engine" && /^\d{3,5}$/.test(raw)) {
    return `${Number(raw).toLocaleString()} cc`;
  }
  return raw;
}

function fieldValue(fields: VehicleIdentityField[], key: string) {
  const match = fields.find((field) => field.key === key && field.value);
  return match?.value?.trim() || null;
}

export function VehicleIdentitySheet({ fields, className }: Props) {
  const { t } = useTranslation();
  const make = fieldValue(fields, "make");
  const model = fieldValue(fields, "model");
  const year = fieldValue(fields, "year");
  const title = [make, model].filter(Boolean).join(" ");
  const rows = fields
    .filter((field) => field.value && !FEATURED_KEYS.has(field.key))
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: formatSpecValue(field.key, String(field.value)),
    }));

  if (!title && !year && rows.length === 0) return null;

  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="border-b border-[#00a5fd]/12 bg-[#f7fbfe] px-5 py-5 sm:px-6 print:bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#0088d4]">
              <Fingerprint className="h-3.5 w-3.5" />
              {t("vehicle_identity")}
            </p>
            {title ? (
              <p className="mt-2 text-[1.65rem] font-extrabold leading-none tracking-tight text-[#071018] sm:text-[1.85rem]">
                {title}
              </p>
            ) : (
              <p className="mt-2 text-lg font-semibold text-muted-foreground">
                {t("dashboard_subject_unknown")}
              </p>
            )}
          </div>
          {year ? (
            <div className="shrink-0 rounded-xl border border-[#00a5fd]/20 bg-white px-3 py-2 text-center">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {t("year")}
              </p>
              <p className="mt-0.5 font-mono text-2xl font-black tabular-nums leading-none text-[#071018]">{year}</p>
            </div>
          ) : null}
        </div>
      </div>

      {rows.length > 0 ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2">
          {rows.map((row) => (
            <div
              key={`${row.key}-${row.label}`}
              className="flex items-baseline justify-between gap-4 border-b border-[#00a5fd]/10 px-5 py-3.5 last:border-b-0 sm:px-6 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0"
            >
              <dt className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {row.label}
              </dt>
              <dd className="min-w-0 text-right text-sm font-semibold text-[#071018]">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
