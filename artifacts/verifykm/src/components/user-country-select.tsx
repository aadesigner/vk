import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { FlagImg } from "@/components/flag-img";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isLightMotionEnv } from "@/hooks/use-light-motion";
import {
  getUserCountryOptions,
  getUserCountryOptionsWithPreferred,
  userCountryLabel,
  userCountrySearchValue,
  type UserCountryOption,
} from "@/lib/user-countries";
import { cn } from "@/lib/utils";

const EMPTY_SENTINEL = "__none__";
const ALL_SENTINEL = "__all__";

/** Instant flag glyph — no CDN / layout thrash in long lists. */
function flagEmoji(code: string): string {
  const cc = code.toUpperCase();
  if (cc.length !== 2) return "";
  return String.fromCodePoint(
    ...[...cc].map((ch) => 0x1f1e6 - 65 + ch.charCodeAt(0)),
  );
}

function CountryOptionLabel({
  code,
  name,
  size = 16,
}: {
  code: string;
  name: string;
  size?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <FlagImg code={code.toLowerCase()} size={size} className="rounded-[2px]" />
      <span className="truncate">{name}</span>
    </span>
  );
}

export type UserCountrySelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  /** Prefer this code at top of the list (pinned once when first set — e.g. IP hint). */
  preferredCode?: string | null;
  options?: UserCountryOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptySearchLabel?: string;
  /** Adds an empty option (default stored value `""`). */
  emptyLabel?: string;
  /** Stored value for emptyLabel (default `""`). Use `"unset"` for admin filters. */
  emptyValue?: string;
  /** Adds an “all” option that stores `""` (admin filter). */
  allLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  /** Larger trigger (auth form). */
  size?: "default" | "lg";
};

type SearchableOption = UserCountryOption & { search: string };

function matchesQuery(search: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return search.toLowerCase().includes(q);
}

export function UserCountrySelect({
  value,
  onValueChange,
  preferredCode,
  options: optionsProp,
  placeholder = "Select country",
  searchPlaceholder = "Search country…",
  emptySearchLabel = "No country found.",
  emptyLabel,
  emptyValue = "",
  allLabel,
  disabled,
  id,
  className,
  triggerClassName,
  contentClassName,
  size = "default",
}: UserCountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [useSheet, setUseSheet] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setUseSheet(isLightMotionEnv());
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const pinnedPreferred = useRef<string | null>(null);
  if (preferredCode && !pinnedPreferred.current) {
    pinnedPreferred.current = preferredCode;
  }

  const options = useMemo((): SearchableOption[] => {
    const base = optionsProp
      ?? (pinnedPreferred.current
        ? getUserCountryOptionsWithPreferred(pinnedPreferred.current)
        : getUserCountryOptions());
    return base.map((c) => ({
      ...c,
      search: userCountrySearchValue(c.code, c.name),
    }));
  }, [optionsProp, preferredCode]);

  const filtered = useMemo(
    () => options.filter((c) => matchesQuery(c.search, query)),
    [options, query],
  );

  const flagSize = size === "lg" ? 18 : 16;
  const selectedLabel = value && value !== emptyValue ? userCountryLabel(value) : null;

  let triggerLabel: ReactNode;
  if (allLabel != null && value === "") {
    triggerLabel = <span className="truncate">{allLabel}</span>;
  } else if (emptyLabel != null && value === emptyValue) {
    triggerLabel = <span className="truncate text-muted-foreground">{emptyLabel}</span>;
  } else if (value && selectedLabel) {
    triggerLabel = (
      <CountryOptionLabel code={value} name={selectedLabel} size={flagSize} />
    );
  } else {
    triggerLabel = <span className="truncate text-muted-foreground">{placeholder}</span>;
  }

  const selectItem = (next: string) => {
    if (next === ALL_SENTINEL) onValueChange("");
    else if (next === EMPTY_SENTINEL) onValueChange(emptyValue);
    else onValueChange(next);
    setOpen(false);
  };

  const triggerClass = cn(
    "w-full justify-between font-normal bg-background text-foreground border-input shadow-sm",
    "dark:bg-card dark:text-foreground dark:border-border",
    "hover:bg-background dark:hover:bg-card",
    size === "default" && "h-9 px-3",
    size === "lg" && "h-12 rounded-xl text-[15px] px-3.5",
    triggerClassName,
    className,
  );

  const triggerButton = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-haspopup={useSheet ? "dialog" : "listbox"}
      disabled={disabled}
      className={triggerClass}
      onClick={useSheet ? () => setOpen(true) : undefined}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
        {triggerLabel}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const sheetRows = (
    <div
      data-vaul-no-drag
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      {allLabel != null && matchesQuery(allLabel, query) ? (
        <CountrySheetRow
          selected={value === ""}
          label={allLabel}
          onSelect={() => selectItem(ALL_SENTINEL)}
        />
      ) : null}
      {emptyLabel != null && matchesQuery(emptyLabel, query) ? (
        <CountrySheetRow
          selected={value === emptyValue}
          muted
          label={emptyLabel}
          onSelect={() => selectItem(EMPTY_SENTINEL)}
        />
      ) : null}
      {filtered.map((c) => (
        <CountrySheetRow
          key={c.code}
          selected={value === c.code}
          code={c.code}
          label={c.name}
          onSelect={() => selectItem(c.code)}
        />
      ))}
      {filtered.length === 0
        && !(allLabel != null && matchesQuery(allLabel, query))
        && !(emptyLabel != null && matchesQuery(emptyLabel, query)) ? (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">{emptySearchLabel}</p>
      ) : null}
    </div>
  );

  if (useSheet) {
    return (
      <>
        {triggerButton}
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
          <DrawerContent
            overlayClassName="z-[120]"
            className="z-[120] h-[min(88dvh,36rem)] max-h-[88dvh] gap-0 rounded-t-2xl bg-white p-0 text-slate-950"
          >
            <DrawerHeader className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-2 text-left">
              <DrawerTitle className="text-base font-semibold">{placeholder}</DrawerTitle>
              <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-[#f4f8fc] px-3">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  className="h-11 w-full bg-transparent text-base outline-none placeholder:text-slate-400"
                />
              </label>
            </DrawerHeader>
            {sheetRows}
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={16}
        className={cn(
          "w-[var(--radix-popover-trigger-width)] p-0 z-[120]",
          "bg-popover text-popover-foreground border-border shadow-lg",
          "dark:bg-popover dark:text-popover-foreground dark:border-border",
          "data-[state=open]:animate-none data-[state=closed]:animate-none",
          contentClassName,
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
            <CommandList className="max-h-[min(18rem,50vh)] overscroll-contain">
              <CommandEmpty>{emptySearchLabel}</CommandEmpty>
              <CommandGroup>
                {allLabel != null && (
                  <CommandItem
                    value={allLabel}
                    onSelect={() => selectItem(ALL_SENTINEL)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        allLabel != null && value === "" ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{allLabel}</span>
                  </CommandItem>
                )}
                {emptyLabel != null && (
                  <CommandItem
                    value={emptyLabel}
                    onSelect={() => selectItem(EMPTY_SENTINEL)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === emptyValue ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate text-muted-foreground">{emptyLabel}</span>
                  </CommandItem>
                )}
                {options.map((c) => {
                  const selected = value === c.code;
                  return (
                    <CommandItem
                      key={c.code}
                      value={c.search}
                      onSelect={() => selectItem(c.code)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          selected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="mr-2 inline-flex items-center justify-center shrink-0 text-[15px] leading-none" aria-hidden>
                        {c.code === "XK" ? "🇽🇰" : flagEmoji(c.code)}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function CountrySheetRow({
  selected,
  label,
  code,
  muted,
  onSelect,
}: {
  selected: boolean;
  label: string;
  code?: string;
  muted?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px]",
        "active:bg-slate-100",
        selected ? "bg-[#e7f6ff] text-slate-950" : "text-slate-800",
      )}
    >
      <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
      {code ? (
        <span className="inline-flex w-6 justify-center text-[17px] leading-none" aria-hidden>
          {code === "XK" ? "🇽🇰" : flagEmoji(code)}
        </span>
      ) : null}
      <span className={cn("min-w-0 flex-1 truncate", muted && "text-muted-foreground")}>{label}</span>
    </button>
  );
}
