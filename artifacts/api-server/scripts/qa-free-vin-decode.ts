/**
 * Live QA — run: npx tsx scripts/qa-free-vin-decode.ts
 * Validates hybrid decoder against NHTSA for known public VINs.
 */
import { decodeFreeVin } from "../src/lib/vinDecodeFree.js";
import { decodeVin } from "@workspace/vin-decode";

const CASES: Array<{
  vin: string;
  label: string;
  expectMake: string;
  expectModelContains?: string;
}> = [
  { vin: "1HGCM82633A004352", label: "USA Honda Accord 2003", expectMake: "Honda", expectModelContains: "Accord" },
  { vin: "1FTFW1E84MFA12345", label: "USA Ford F-150", expectMake: "Ford", expectModelContains: "F-150" },
  { vin: "5YJSA1E14HF000001", label: "USA Tesla Model S", expectMake: "Tesla", expectModelContains: "Model S" },
  { vin: "1VWZZZA3ZDC050213", label: "USA VW Jetta", expectMake: "Volkswagen", expectModelContains: "Jetta" },
  { vin: "KMHSW81UBGU554169", label: "Korea Hyundai Santa Fe Sport", expectMake: "Hyundai", expectModelContains: "Santa Fe" },
  { vin: "KNDNB2A28F7123456", label: "Korea Kia Sorento", expectMake: "Kia", expectModelContains: "Sorento" },
  { vin: "JTDKB20U797867720", label: "Japan Toyota Prius", expectMake: "Toyota", expectModelContains: "Prius" },
  { vin: "JHMCM56557C404453", label: "Japan Honda Accord", expectMake: "Honda", expectModelContains: "Accord" },
  { vin: "WBA3A5C55FK123456", label: "Germany BMW 3 Series", expectMake: "BMW", expectModelContains: "3 Series" },
  { vin: "WDD2130421A123456", label: "Germany Mercedes E-Class", expectMake: "Mercedes-Benz", expectModelContains: "E-Class" },
  { vin: "WVWZZZ3CZCE064077", label: "Germany VW Passat B8 (EU)", expectMake: "Volkswagen", expectModelContains: "Passat" },
  { vin: "WVGZZZ5NZDW535045", label: "Germany VW Tiguan (WVG plant)", expectMake: "Volkswagen", expectModelContains: "Tiguan" },
  { vin: "WAUZZZF4XGN123456", label: "Germany Audi A6 (EU)", expectMake: "Audi", expectModelContains: "A6" },
  { vin: "WP0ZZZ99ZPS123456", label: "Germany Porsche 911", expectMake: "Porsche", expectModelContains: "911" },
  { vin: "TMBEP6NJ3MZ012345", label: "Czech Škoda Fabia III", expectMake: "Škoda", expectModelContains: "Fabia" },
  { vin: "TMBJP7NX5MY012345", label: "Czech Škoda Octavia IV", expectMake: "Škoda", expectModelContains: "Octavia" },
  { vin: "ZFA31200000745586", label: "Italy Fiat 500", expectMake: "Fiat", expectModelContains: "500" },
  { vin: "VF1RJA00012345678", label: "France Renault Clio", expectMake: "Renault", expectModelContains: "Clio" },
  { vin: "VF1RJF00261234567", label: "France Renault Duster", expectMake: "Renault", expectModelContains: "Duster" },
  { vin: "VF3MRHPYWR1234567", label: "France Peugeot 3008", expectMake: "Peugeot", expectModelContains: "3008" },
  { vin: "UU1DJF11065848712", label: "Romania Dacia Duster", expectMake: "Dacia", expectModelContains: "Duster" },
  { vin: "JS2ZC33S7C4116148", label: "Japan Suzuki Swift", expectMake: "Suzuki", expectModelContains: "Swift" },
  { vin: "LSJWP4U21NG123456", label: "China MG ZS", expectMake: "MG", expectModelContains: "ZS" },
  { vin: "LFPAA3A24P4123456", label: "China BYD Atto 3", expectMake: "BYD", expectModelContains: "Atto 3" },
  { vin: "LPSVSEXT0N1234567", label: "China Polestar 2", expectMake: "Polestar", expectModelContains: "2" },
  { vin: "RLLVCE1A0N1234567", label: "Vietnam VinFast VF8", expectMake: "VinFast", expectModelContains: "VF8" },
  { vin: "MPATFS40JKT123456", label: "Thailand Isuzu D-Max", expectMake: "Isuzu", expectModelContains: "D-Max" },
  { vin: "MAT612AK1P8123456", label: "India Tata Nexon", expectMake: "Tata", expectModelContains: "Nexon" },
  { vin: "VSSZZZKM7MR123456", label: "Spain Cupra Formentor", expectMake: "Cupra", expectModelContains: "Formentor" },
  { vin: "VR1RHRHVP5L123456", label: "France DS 7", expectMake: "DS Automobiles", expectModelContains: "DS 7" },
];

function validateCheckDigit(vin: string): boolean {
  const translit: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const val = /\d/.test(c) ? parseInt(c, 10) : (translit[c] ?? 0);
    sum += val * weights[i];
  }
  const rem = sum % 11;
  const expected = rem === 10 ? "X" : String(rem);
  return vin[8] === expected;
}

async function main() {
  console.log("=== Free VIN Decoder Live QA ===\n");
  let pass = 0;
  let fail = 0;

  for (const c of CASES) {
    const local = decodeVin(c.vin);
    const result = await decodeFreeVin(c.vin, validateCheckDigit(c.vin));
    const makeOk = result.make?.toLowerCase().includes(c.expectMake.toLowerCase());
    const modelOk = !c.expectModelContains
      || (result.model?.toLowerCase().includes(c.expectModelContains.toLowerCase())
        ?? local.model?.toLowerCase().includes(c.expectModelContains.toLowerCase()));
    const ok = makeOk && modelOk;
    if (ok) pass++; else fail++;

    const status = ok ? "PASS" : "FAIL";
    console.log(`[${status}] ${c.label}`);
    console.log(`  VIN:    ${c.vin}`);
    console.log(`  Source: ${result.source}`);
    console.log(`  Year:   ${result.year ?? "—"}`);
    console.log(`  Make:   ${result.make ?? "—"}`);
    console.log(`  Model:  ${result.model ?? local.model ?? "—"}`);
    console.log(`  Engine: ${result.engineDecoded ?? result.engineDisplacementL ?? "—"}`);
    console.log(`  Trim:   ${result.trim ?? "—"}`);
    console.log("");
  }

  console.log(`Results: ${pass} passed, ${fail} failed out of ${CASES.length}`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
