/**
 * Classic European Mercedes FIN layout (WDB / WDD / …):
 *   WMI (3) + Baumuster 6 digits (chassis+type, e.g. 203008) + steering (1=LHD, 2=RHD)
 *   + plant letter + 6-digit serial.
 *
 * Position 10 is steering, NOT the ISO 3779 model-year code. Treating "1" as 2001
 * is a common decoder bug on W202/W203-era cars.
 */

const MERCEDES_BAUMUSTER_WMI = /^(WDB|WDD|WDC|WDF|W1K|W1N)/;

export function isMercedesEuroBaumusterVin(vin: string): boolean {
  const u = vin.toUpperCase().trim();
  if (u.length < 11) return false;
  if (!MERCEDES_BAUMUSTER_WMI.test(u)) return false;
  // EU type-approval ZZZ filler uses a different layout (year still at pos.10).
  if (u.slice(3, 6) === "ZZZ") return false;
  // Positions 4–9 = six-digit Baumuster (e.g. 203008, 213042).
  if (!/^\d{6}$/.test(u.slice(3, 9))) return false;
  // Position 10 = steering (1 left / 2 right), not year.
  if (u[9] !== "1" && u[9] !== "2") return false;
  // Position 11 = plant letter (A Sindelfingen, F Bremen, …).
  if (!/^[A-Z]$/.test(u[10]!)) return false;
  return true;
}
