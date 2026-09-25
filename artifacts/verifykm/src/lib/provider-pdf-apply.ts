import {
  EMPTY_VIN_CATALOG_FORM,
  type VinCatalogFormState,
} from "@/components/admin/vin-catalog-data-form";
import type { ProviderPdfParseOk } from "@/lib/provider-pdf-parse";

/** Replace entire draft from parsed PDF; keep existing photos only. */
export function applyProviderPdfToForm(
  current: VinCatalogFormState,
  parsed: ProviderPdfParseOk["form"],
): VinCatalogFormState {
  return {
    ...EMPTY_VIN_CATALOG_FORM,
    ...parsed,
    photos: [...(current.photos ?? [])],
  };
}
