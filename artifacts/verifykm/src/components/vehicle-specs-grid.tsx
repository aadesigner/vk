import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pick 2- or 3-column layout so rows are not empty and rarely a lone narrow cell. */
export function chooseVehicleSpecsGridCols(count: number): 1 | 2 | 3 {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count === 3) return 3;
  if (count === 4) return 2;
  if (count % 3 === 0 || count % 3 === 2) return 3;
  if (count % 2 === 0) return 2;
  return 2;
}

/** Last item spans full width when 2-col grid would leave a single narrow cell (e.g. 7 specs). */
export function vehicleSpecItemColSpan(index: number, count: number, cols: 1 | 2 | 3): string {
  if (cols === 2 && count % 2 === 1 && index === count - 1) {
    return "col-span-2";
  }
  return "";
}

const GRID_COLS_CLASS: Record<1 | 2 | 3, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

type Props = {
  children: ReactNode;
  className?: string;
};

export function VehicleSpecsGrid({ children, className }: Props) {
  const items = Children.toArray(children).filter(Boolean);
  const cols = chooseVehicleSpecsGridCols(items.length);

  return (
    <div className={cn("grid gap-3 sm:gap-4", GRID_COLS_CLASS[cols], className)}>
      {items.map((child, index) => (
        <div
          key={index}
          className={cn("min-w-0", vehicleSpecItemColSpan(index, items.length, cols))}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
