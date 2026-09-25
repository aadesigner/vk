import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  formatAdminAmountPreview,
  type AmountCurrencyCode,
} from "@/lib/korean-currency";

export function AdminField({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5 min-w-0", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function AdminTextField({
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder = "—",
  suggestions,
  compact,
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  suggestions?: string[];
  compact?: boolean;
  className?: string;
}) {
  const listId = useId();
  const inputClass = compact ? "h-8 text-xs" : "h-9 text-sm";

  return (
    <AdminField label={label} hint={hint} className={className}>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        list={suggestions?.length ? listId : undefined}
        className={inputClass}
      />
      {suggestions?.length ? (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      ) : null}
    </AdminField>
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Show stored ISO (YYYY-MM-DD) as day-month-year in admin inputs. */
export function adminDateToDisplay(stored: string): string {
  const t = stored.trim();
  if (!t) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (iso) return `${iso[3]}-${iso[2]}-${iso[1]}`;
  // Prefer dash separators when a complete DMY was left unconverted.
  const dmy = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(t);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${pad2(day)}-${pad2(month)}-${year}`;
    }
  }
  return stored;
}

/**
 * Map admin day-month-year typing back to storage.
 * Complete DD-MM-YYYY or DD/MM/YYYY → YYYY-MM-DD (report-safe). Incomplete / free text kept as typed.
 */
export function adminDateFromDisplay(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmy = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(t);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }
  return input;
}

/** Admin date input: UI is day-month-year; complete values stored as YYYY-MM-DD. */
export function AdminDateField({
  label = "Date",
  hint = "dd-mm-yyyy ( / also accepted )",
  value,
  onChange,
  compact,
  className,
}: {
  label?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <AdminTextField
      label={label}
      hint={hint}
      value={adminDateToDisplay(value)}
      onChange={(v) => onChange(adminDateFromDisplay(v))}
      placeholder="dd-mm-yyyy"
      compact={compact}
      className={className}
    />
  );
}

export function AdminSelectField({
  label,
  hint,
  value,
  onChange,
  options,
  compact,
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <AdminField label={label} hint={hint} className={className}>
      <select
        className={cn(
          "w-full rounded-md border bg-background px-3 focus:outline-none focus:ring-2 focus:ring-ring",
          compact ? "h-8 text-xs" : "h-9 text-sm",
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </AdminField>
  );
}

export function AdminCheckField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer rounded-lg border bg-muted/20 px-3 py-2.5 hover:bg-muted/30 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-input"
      />
      <span className="min-w-0">
        <span className="text-sm font-medium leading-none">{label}</span>
        {hint ? <span className="block text-[10px] text-muted-foreground mt-1">{hint}</span> : null}
      </span>
    </label>
  );
}

export const ADMIN_AMOUNT_CURRENCY_OPTIONS: { value: AmountCurrencyCode; label: string }[] = [
  { value: "EUR", label: "EUR (€)" },
  { value: "USD", label: "USD ($)" },
  { value: "KRW", label: "KRW (₩)" },
];

/** Amount + currency side-by-side with live preview — visually distinct from plain text fields. */
export function AdminAmountWithCurrency({
  label,
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  krwPerUsd,
  vehicleCountry,
  compact,
  className,
  currencyOptions = ADMIN_AMOUNT_CURRENCY_OPTIONS,
  showCurrencySelect = true,
}: {
  label: string;
  amount: string;
  currency: string;
  onAmountChange: (v: string) => void;
  onCurrencyChange: (v: string) => void;
  krwPerUsd: number;
  /** When set, USD↔₩ preview only appears for Korean vehicles. */
  vehicleCountry?: string | null;
  compact?: boolean;
  className?: string;
  currencyOptions?: { value: string; label: string }[];
  /** When false, amount only (currency controlled elsewhere, e.g. shared market bar). */
  showCurrencySelect?: boolean;
}) {
  const preview = formatAdminAmountPreview(amount, currency, krwPerUsd, vehicleCountry);
  const inputClass = compact ? "h-9 text-sm" : "h-10 text-sm";
  const code = currency || "USD";
  const options = currencyOptions.some((o) => o.value === code)
    ? currencyOptions
    : [...currencyOptions, { value: code, label: code }];

  return (
    <AdminField label={label} hint={preview ?? undefined} className={className}>
      <div
        className={cn(
          "flex gap-0 min-w-0 overflow-hidden rounded-lg border-2 border-primary/25 bg-primary/5 shadow-sm",
          "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
        )}
      >
        <Input
          type="number"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="0"
          className={cn(
            inputClass,
            "flex-1 min-w-0 border-0 bg-transparent rounded-none shadow-none focus-visible:ring-0",
          )}
        />
        {showCurrencySelect ? (
          <select
            aria-label="Currency"
            className={cn(
              "shrink-0 border-0 border-l-2 border-primary/20 bg-background/80 font-semibold tabular-nums",
              "focus:outline-none focus:ring-0",
              compact ? "h-9 text-xs w-[6.5rem] px-2" : "h-10 text-sm w-[7.25rem] px-2.5",
            )}
            value={code}
            onChange={(e) => onCurrencyChange(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.value || "__empty"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={cn(
              "shrink-0 flex items-center border-l-2 border-primary/20 bg-background/80 px-3 font-semibold tabular-nums text-muted-foreground",
              compact ? "h-9 text-xs" : "h-10 text-sm",
            )}
          >
            {code}
          </span>
        )}
      </div>
    </AdminField>
  );
}

/** Odometer reading + unit dropdown (default km). */
export function AdminOdometerWithUnit({
  label,
  odometer,
  unit,
  onOdometerChange,
  onUnitChange,
  compact,
  className,
  unitOptions = [
    { value: "km", label: "km" },
    { value: "mi", label: "mi" },
  ],
}: {
  label?: string;
  odometer: string;
  unit: string;
  onOdometerChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  compact?: boolean;
  className?: string;
  unitOptions?: { value: string; label: string }[];
}) {
  const inputClass = compact ? "h-9 text-sm" : "h-10 text-sm";
  const rawUnit = unit.trim().toLowerCase();
  const unitValue =
    rawUnit === "mi" || rawUnit === "mile" || rawUnit === "miles" || rawUnit === "ml"
      ? "mi"
      : rawUnit || "km";

  return (
    <AdminField
      label={label ?? "Odometer"}
      hint="Default km — switch to mi if needed"
      className={className}
    >
      <div
        className={cn(
          "flex gap-0 min-w-0 overflow-hidden rounded-lg border bg-background shadow-sm",
          "focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        <Input
          type="number"
          value={odometer}
          onChange={(e) => onOdometerChange(e.target.value)}
          placeholder="—"
          className={cn(
            inputClass,
            "flex-1 min-w-0 border-0 rounded-none shadow-none focus-visible:ring-0",
          )}
        />
        <select
          aria-label="Odometer unit"
          className={cn(
            "shrink-0 border-0 border-l bg-muted/40 font-medium",
            "focus:outline-none",
            compact ? "h-9 text-xs w-[3.75rem] px-1.5" : "h-10 text-sm w-[4.25rem] px-2",
          )}
          value={unitValue}
          onChange={(e) => onUnitChange(e.target.value)}
        >
          {unitOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </AdminField>
  );
}
