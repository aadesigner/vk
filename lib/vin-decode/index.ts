export {
  validateCheckDigit,
  isNorthAmericanMarketVin,
  resolveCheckDigitValid,
} from "./check-digit";
export {
  VIN_CHARSET_RE,
  inspectVinFormat,
  isValidVinFormat,
  type VinFormatIssue,
} from "./validation";
export { isPlausibleMake, isPlausibleModel, isYearLikeModelName } from "./plausibility";
export {
  MIN_VEHICLE_LOOKUP_YEAR,
  plausibleDecodedYear,
  isVehicleTooOldForLookup,
  isVehicleEligibleForHistoryLookup,
} from "./lookup-eligibility";
export {
  decodeVin,
  decodeCountry,
  decodeEngineCode,
  decodeBodyStyleLocal,
  decodeTransmission,
  decodePlantInfo,
  extractEngineSpecs,
  inferFuelType,
  inferDriveType,
  type VinDecodeResult,
  type PlantInfo,
  type EngineSpecs,
} from "./vinDecoder";
export { decodeModelEuropean, hasEuZzzTypeApprovalDescriptor, isEuZzzTypeApprovalVin } from "./vinDecoder-european";
export { decodeEuropeanBrandModel } from "./european-brands";
export { decodeGlobalBrandModel, decodeGlobalBrand, resolveGlobalBrandMake } from "./global-brands";
export { isMercedesEuroBaumusterVin } from "./mercedes-baumuster";
export { isBmwEuroEtkVin, bmwEtkOmitsIsoYear, decodeBmwEtk } from "./bmw-etk";
export {
  decodePremiumEuropean,
  decodePremiumEuropeanModel,
  decodePremiumEuropeanSeries,
  decodePremiumEuropeanTrim,
  isPremiumEuropeanVin,
  premiumVinModelYear,
  chassisProductionWindow,
  formatProductionYearRange,
  type PremiumEuropeanDecode,
} from "./european-premium";
export { decodeVinLocalFree, type LocalFreeDecodeResult } from "./local-free-decode";
export { decodeLocalSeries, decodeLocalTrim } from "./local-trim";
export {
  isoModelYearCandidates,
  resolveIsoModelYear,
  resolveIsoModelYearWhere,
  type IsoYearWindow,
} from "./iso-year";
export { decodeUsVdsModel, matchUsVdsRule } from "./us-vds";
export { decodeFordNaModel, matchFordNaRule, isFordNaVin } from "./ford-na";
export { decodeGmNaModel, matchGmNaRule, isGmNaVin } from "./gm-na";
export { decodeMazdaModel, matchMazdaRule, isMazdaVin } from "./mazda";
export { decodeHyundaiModel, matchHyundaiRule, isHyundaiVin, decodeHyundaiEngine } from "./hyundai";
export {
  decodeHyundaiToyotaModel,
  isHyundaiToyotaVin,
  matchHyundaiToyotaRule,
} from "./asian-eu";
export {
  inferBodyStyleFromModel,
  inferVagTransmissionFromModel,
  inferVagDriveFromModel,
} from "./vag-infer";
export {
  decodeVolkswagenModern,
  decodeAudiModern,
  decodeSkodaModern,
  decodePorscheModern,
  isVolkswagenVin,
  isAudiVin,
  isSkodaVin,
  isPorscheVin,
  resolveChinaJointVentureMake,
  vagModelYear,
  type VagModernHit,
} from "./vag-modern";
export {
  decodeVinDiagnostics,
  type VinDiagnostic,
  type DiagnosticCategory,
} from "./vin-diagnostics";
export {
  decodeSeatEuHomologation,
  decodeSeatEuModel,
  formatSeatDisplay,
  SEAT_EU_WMIS,
} from "./seat-eu";
export {
  decodeVolvoModel,
  decodeVolvoSpec,
  isVolvoVin,
  VOLVO_WMIS,
  type VolvoSpec,
} from "./volvo";
export {
  decodeTeslaModel,
  decodeTeslaSpec,
  isTeslaVin,
  TESLA_WMIS,
} from "./tesla";
export {
  decodeBydModel,
  decodeBydSpec,
  isBydVin,
  BYD_WMIS,
} from "./byd";
export {
  decodeZeekrModel,
  decodeZeekrSpec,
  isZeekrVin,
  ZEEKR_WMIS,
} from "./zeekr";
export {
  decodeXiaomiModel,
  decodeXiaomiSpec,
  isXiaomiVin,
  XIAOMI_WMIS,
} from "./xiaomi";
export {
  resolveBrandVinSpec,
  resolveBrandVinModel,
  resolveBrandVinMake,
  type BrandVinSpec,
} from "./brand-vin-spec";
export {
  decodeFordEuModel,
  isFordEuWmi,
  isFordEuXxLayout,
  decodeFordEuXxYear,
  isFordEuLegacyXxYearAtPos11,
  fordEuXxUsesIsoYearAtPos10,
} from "./ford-eu";
export {
  decodeOpelOldPaddedYear,
  decodeOpelVauxhallMake,
  decodeOpelVauxhallModel,
  decodeOpelVauxhallPlant,
  isOpelOldPaddedTypeVin,
  isOpelVauxhallVin,
  OPEL_VAUXHALL_WMIS,
} from "./opel-vauxhall";
