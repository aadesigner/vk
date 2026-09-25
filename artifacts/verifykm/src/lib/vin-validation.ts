import { inspectVinFormat } from "@workspace/vin-decode";

export function getVinValidationErrorKey(vin: string): string | null {
  const issue = inspectVinFormat(vin);
  if (!issue) return null;
  if (issue.kind === "length") return "vin_error_length";
  if (issue.kind === "invalid_chars" && issue.hasBannedLetter) return "vin_error_invalid_chars";
  return "vin_error_length";
}
