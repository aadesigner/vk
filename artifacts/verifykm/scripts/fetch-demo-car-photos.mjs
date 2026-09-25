/**
 * Download model-accurate demo car photos from Wikimedia Commons (CC-licensed).
 * Run: node artifacts/verifykm/scripts/fetch-demo-car-photos.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "assets", "demo-cars");
const OUT_PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "demo-cars");
mkdirSync(OUT, { recursive: true });
mkdirSync(OUT_PUBLIC, { recursive: true });

/** @type {Array<{ out: string; wiki: string[] }>} */
const CARS = [
  // Korea — Encar marketplace demos
  {
    out: "hyundai-tucson.jpg",
    wiki: ["Hyundai Tucson facelift (front).jpg", "2022 Hyundai Tucson Limited AWD, front 8.15.22.jpg"],
  },
  {
    out: "kia-k8.jpg",
    wiki: [
      "Kia K8 GL3 Snow White Pearl (11).jpg",
      "Kia K8 (front).jpg",
      "Kia K8 GT-Line (front).jpg",
    ],
  },
  {
    out: "kia-sportage.jpg",
    wiki: ["2019 Kia Sportage GT-Line CRDi ISG 1.6.jpg", "Kia Sportage (QL) GT-Line 2.0 CRDi AWD (facelift) – f 17042021.jpg"],
  },
  {
    out: "hyundai-grandeur.jpg",
    wiki: [
      "2017 grandeur ig front side.jpg",
      "Hyundai Grandeur (IG) front 2018.jpg",
      "Hyundai Grandeur IG 3.0 GDi Luxury (01).jpg",
    ],
  },
  {
    out: "kia-carnival.jpg",
    wiki: ["2015 Kia Carnival (YP MY16) S van (2016-01-04) 01.jpg", "Kia Carnival (facelift) IMG 4044.jpg"],
  },
  // USA / Canada — auction & listing demos
  {
    out: "toyota-rav4.jpg",
    wiki: ["Toyota Rav4 2.5 XLE 2022 (51691550341).jpg", "2022 Toyota RAV4 XLE Premium AWD, front 8.6.22.jpg"],
  },
  {
    out: "honda-crv.jpg",
    wiki: ["2018 Honda CR-V EX i-VTEC 2.0 Front.jpg", "2019 Honda CR-V EX-L AWD, front 8.7.19.jpg"],
  },
  {
    out: "ford-f150.jpg",
    wiki: ["2018 Ford F150 Platinum FX4 Crew Cab in Ruby Red, front left.jpg", "2018 Ford F-150 XLT SuperCrew 4x4, front 5.19.19.jpg"],
  },
  {
    out: "nissan-altima.jpg",
    wiki: ["2017 Nissan Altima front 3.17.18.jpg", "2018 Nissan Altima 2.5 SV, front 5.19.19.jpg"],
  },
  {
    out: "chevy-malibu.jpg",
    wiki: ["2014 Chevrolet Malibu LS 2.5L front 6.13.18.jpg", "2016 Chevrolet Malibu LT, front 5.19.19.jpg"],
  },
  // Germany — popular imports on Korea (encar) & Canada (AutoTrader)
  {
    out: "bmw-320i.jpg",
    wiki: [
      "BMW 320i M Sport (G20) front.jpg",
      "BMW G20 320i Luxury Line Alpine White (1).jpg",
      "2019 BMW 320i (G20) front.jpg",
    ],
  },
  {
    out: "mercedes-c-class.jpg",
    wiki: [
      "Mercedes-Benz C200 AVANTGARDE (W205) front.JPG",
      "Mercedes-Benz C180 Laureus Edition (W205) front.jpg",
      "Mercedes-Benz C 180 AVANTGARDE (W205) front.JPG",
      "2016 Mercedes-Benz C-Class C220d SE Executive (W205) - 2.2 (170PS) diesel automatic - 2025-05-05, front right.jpg",
    ],
  },
  {
    out: "vw-tiguan.jpg",
    wiki: [
      "2018 Volkswagen Tiguan Allspace R-Line TSi 2.0 Front.jpg",
      "2018 Volkswagen Tiguan 12.2.17.jpg",
    ],
  },
  // China — domestic EV demos
  {
    out: "byd-han-ev.jpg",
    wiki: ["BYD Han EV.jpg", "BYD Han DM-i.jpg"],
  },
  {
    out: "nio-et5.jpg",
    wiki: ["NIO ET5.jpg", "NIO ET5 front.jpg"],
  },
  {
    out: "byd-seal.jpg",
    wiki: ["BYD Seal EV.jpg", "BYD Seal.jpg"],
  },
  {
    out: "xpeng-p7.jpg",
    wiki: ["XPeng P7.jpg", "Xpeng P7 front.jpg"],
  },
  {
    out: "zeekr-001.jpg",
    wiki: ["Zeekr 001.jpg", "Zeekr 001 front.jpg"],
  },
  // Japan — domestic auction / export demos
  {
    out: "toyota-prius.jpg",
    wiki: [
      "2024 Toyota Prius XLE AWD, front right, 06-01-2024.jpg",
      "2025 Toyota Prius LE, front right, 09-06-2025.jpg",
      "2015-2018 Toyota Prius S.jpg",
    ],
  },
  {
    out: "honda-civic.jpg",
    wiki: [
      "2022 Honda Civic LX Sedan, front right, 11-02-2022.jpg",
      "2017 Honda Civic parked in SMB II International Airport (2).jpg",
      "Honda Civic (EF) LX sedan front.jpg",
    ],
  },
  {
    out: "nissan-qashqai.jpg",
    wiki: [
      "2014 Nissan Qashqai Front On.jpg",
      "Nissan Qashqai, 2021, in Nissan Global HQ Gallery, front.jpg",
      "Nissan Qashqai, Bj. 2008 - Front (2008-09-21 ret).jpg",
    ],
  },
  {
    out: "subaru-forester.jpg",
    wiki: [
      "2019 Subaru Forester 2.5i Premium, front 10.6.19.jpg",
      "2019 Subaru Forester 2.5i Touring AWD front 3.17.19.jpg",
      "2019 Subaru Forester Sport AWD front NYIAS 2019.jpg",
    ],
  },
  // UAE — luxury import demos (incl. Dubai supercar scene)
  {
    out: "audi-r8.jpg",
    wiki: [
      "2020 Audi R8 V10 5.2 Front.jpg",
      "Audi R8 V10 Plus.jpg",
      "2017 Audi R8 V10 plus front.jpg",
    ],
  },
  {
    out: "porsche-911.jpg",
    wiki: [
      "2019 Porsche 911 Carrera S S-A 3.0 Front.jpg",
      "Porsche 911 (992) Carrera GTS.jpg",
      "2006 Porsche 911 Carrera 4 S 4.0 Front.jpg",
    ],
  },
  {
    out: "ferrari-488.jpg",
    wiki: [
      "2017 Ferrari 488 GTB Automatic 3.9 Front.jpg",
      "Ferrari 488 GTB (cropped).jpg",
      "Ferrari 488 GTB 3.9 '15 (16618969907) (cropped).jpg",
    ],
  },
  {
    out: "lamborghini-huracan.jpg",
    wiki: [
      "Lamborghini Huracán LP 610-4 (16618969907).jpg",
      "Lamborghini Huracan LP610-4 (17339329770).jpg",
      "2015 Lamborghini Huracán LP 610-4.jpg",
      "JBR Beach Supercar Rental-Dubai UAE-Andres Larin.jpg",
    ],
  },
  {
    out: "mercedes-amg-gt.jpg",
    wiki: [
      "Mercedes-AMG GT C190 front.jpg",
      "2018 Mercedes-AMG GT.jpg",
      "Mercedes-AMG GT (C190) front.jpg",
    ],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wikiThumbUrl(fileName) {
  const title = `File:${fileName}`;
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "960",
    format: "json",
    origin: "*",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": "VerifyKMDemoPhotoScript/1.0 (https://verifykm.com)" },
  });
  if (!res.ok) throw new Error(`API ${res.status} for ${fileName}`);
  const json = await res.json();
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || "missing" in page) throw new Error(`Missing file: ${fileName}`);
  const info = page.imageinfo?.[0];
  const url = info?.thumburl ?? info?.url;
  if (!url) throw new Error(`No URL for ${fileName}`);
  return url;
}

async function download(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "VerifyKMDemoPhotoScript/1.0 (https://verifykm.com)" },
  });
  if (!res.ok) throw new Error(`Download ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 8_000) throw new Error(`File too small (${buf.length} bytes)`);
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("Not a JPEG");
  return buf;
}

let failed = 0;
for (const car of CARS) {
  process.stdout.write(`Fetching ${car.out} … `);
  let ok = false;
  for (const wiki of car.wiki) {
    try {
      await sleep(1200);
      const url = await wikiThumbUrl(wiki);
      const buf = await download(url);
      writeFileSync(join(OUT, car.out), buf);
      writeFileSync(join(OUT_PUBLIC, car.out), buf);
      console.log(`ok (${Math.round(buf.length / 1024)} KB) ← ${wiki}`);
      ok = true;
      break;
    } catch (err) {
      process.stdout.write(`\n  fallback failed (${wiki}): ${err.message}\n  `);
    }
  }
  if (!ok) {
    failed += 1;
    console.log("FAILED (all sources)");
  }
}

if (failed > 0) {
  console.error(`fetch-demo-car-photos: ${failed} image(s) failed — demo card placeholders will show`);
  process.exit(1);
}
