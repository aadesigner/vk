import { decodeFreeVin, fetchNhtsaDecode } from "../src/lib/vinDecodeFree.js";
import { decodeVin, decodePremiumEuropeanModel, decodePremiumEuropean } from "@workspace/vin-decode";

const vin = (process.argv[2] ?? "WBA21EM00P9R09775").toUpperCase();
const local = decodeVin(vin);
const premium = decodePremiumEuropean(vin);
const nhtsa = await fetchNhtsaDecode(vin);
const merged = await decodeFreeVin(vin, true);

console.log({ vin, premium, local: { make: local.make, model: local.model, transmission: local.transmissionDecoded, year: local.year }, nhtsa, merged: { make: merged.make, model: merged.model, series: merged.series, transmission: merged.transmissionStyle, year: merged.year, source: merged.source } });
