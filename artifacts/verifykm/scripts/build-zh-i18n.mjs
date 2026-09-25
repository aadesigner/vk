import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nDir = path.join(__dirname, "../src/i18n");
const en = JSON.parse(fs.readFileSync(path.join(i18nDir, "en.json"), "utf8"));
const enKeys = Object.keys(en);

const parts = [];
for (let i = 0; i < 6; i++) {
  const partPath = path.join(__dirname, `zh-part-${i}.json`);
  if (!fs.existsSync(partPath)) {
    console.error(`Missing ${partPath}`);
    process.exit(1);
  }
  parts.push(JSON.parse(fs.readFileSync(partPath, "utf8")));
}

const zh = Object.assign({}, ...parts);
const zhKeys = Object.keys(zh);

const missing = enKeys.filter((k) => !(k in zh));
const extra = zhKeys.filter((k) => !(k in en));

if (missing.length) {
  console.error("Missing keys:", missing.length, missing.slice(0, 10));
  process.exit(1);
}
if (extra.length) {
  console.error("Extra keys:", extra.length, extra.slice(0, 10));
  process.exit(1);
}

const markets = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/china-uae-markets.json"), "utf8"),
);

/** Compare-table keys not in china-uae-markets.json */
const COMPARE_I18N = {
  zh: {
    compare_row_chinese: "中国车辆记录",
    compare_row_uae: "阿联酋 / 海湾国家记录",
    compare_desc_china:
      "仅覆盖中国的工具会遗漏出口和跨境历史。verifykm 在一份报告中涵盖中国、韩国、美国等市场。",
    compare_desc_uae:
      "海湾地区车源常隐藏进口水淹车记录。verifykm 在一份报告中涵盖阿联酋进口、美国、韩国和加拿大。",
  },
};

const continentKeys = {
  nav_continent_asia: "亚洲",
  nav_continent_americas: "美洲",
  country_uae_mega_hint: "迪拜与阿联酋",
};

Object.assign(zh, markets.china.zh, markets.uae.zh, COMPARE_I18N.zh, continentKeys);

const ordered = {};
for (const key of enKeys) {
  ordered[key] = zh[key];
}

const outPath = path.join(i18nDir, "zh.json");
fs.writeFileSync(outPath, JSON.stringify(ordered, null, 2) + "\n", "utf8");
console.log("Wrote", outPath, "with", Object.keys(ordered).length, "keys");
