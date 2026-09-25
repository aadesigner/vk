import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getPhonePrefixOptions } from "@/lib/user-phone";
import { cn } from "@/lib/utils";

export type UserPhoneFieldsProps = {
  prefix: string;
  national: string;
  onPrefixChange: (prefix: string) => void;
  onNationalChange: (national: string) => void;
  disabled?: boolean;
  prefixId?: string;
  nationalId?: string;
  searchPlaceholder?: string;
  emptySearchLabel?: string;
  nationalPlaceholder?: string;
  className?: string;
};

export function UserPhoneFields({
  prefix,
  national,
  onPrefixChange,
  onNationalChange,
  disabled,
  prefixId,
  nationalId,
  searchPlaceholder = "Search prefix…",
  emptySearchLabel = "No prefix found.",
  nationalPlaceholder = "Phone number",
  className,
}: UserPhoneFieldsProps) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => getPhonePrefixOptions(), []);
  const selected = options.find((o) => o.dial === prefix);

  return (
    <div
      className={cn(
        "flex h-11 w-full items-stretch overflow-hidden rounded-xl border border-input bg-background",
        "shadow-sm focus-within:ring-1 focus-within:ring-ring",
        "dark:bg-card dark:border-border",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={prefixId}
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1.5 shrink-0 px-3 text-sm font-medium tabular-nums",
              "bg-muted/40 text-foreground border-r border-input dark:border-border",
              "hover:bg-muted/70 transition-colors outline-none",
              "focus-visible:bg-muted/70",
            )}
          >
            <span>{(selected?.dial ?? prefix) || "—"}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-45" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className={cn(
            "w-[min(22rem,calc(100vw-2rem))] p-0 z-[80]",
            "data-[state=open]:animate-none data-[state=closed]:animate-none",
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const root = e.currentTarget as HTMLElement;
            requestAnimationFrame(() => root.querySelector("input")?.focus());
          }}
        >
          {open ? (
            <Command className="bg-transparent">
              <CommandInput placeholder={searchPlaceholder} />
              <CommandList className="max-h-[min(16rem,45vh)]">
                <CommandEmpty>{emptySearchLabel}</CommandEmpty>
                <CommandGroup>
                  {options.map((o) => (
                    <CommandItem
                      key={o.dial}
                      value={o.search}
                      onSelect={() => {
                        onPrefixChange(o.dial);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          prefix === o.dial ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : null}
        </PopoverContent>
      </Popover>

      <input
        id={nationalId}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        pattern="[0-9]*"
        value={national}
        disabled={disabled}
        placeholder={nationalPlaceholder}
        className={cn(
          "min-w-0 flex-1 bg-transparent px-3 text-[15px] tabular-nums outline-none",
          "placeholder:text-muted-foreground disabled:cursor-not-allowed",
        )}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
          onNationalChange(digits);
        }}
      />
    </div>
  );
}
