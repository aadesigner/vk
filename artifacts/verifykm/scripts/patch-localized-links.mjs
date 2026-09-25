import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");

const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === "admin" || e.name === "ui") continue;
      walk(p);
    } else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
  }
}
walk(root);

const simple = [
  ["`/${language}/pricing`", 'pathFor(language, "pricing")'],
  ["`/${language}/how-it-works`", 'pathFor(language, "how_it_works")'],
  ["`/${language}/faq`", 'pathFor(language, "faq")'],
  ["`/${language}/free-vin-decoder`", 'pathFor(language, "free_vin_decoder")'],
  ["`/${language}/checkout`", 'pathFor(language, "checkout")'],
  ["`/${language}/sign-in`", 'pathFor(language, "sign_in")'],
  ["`/${language}/sign-up`", 'pathFor(language, "sign_up")'],
  ["`/${language}/purchases`", 'pathFor(language, "purchases")'],
  ["`/${language}/dashboard`", 'pathFor(language, "dashboard")'],
  ["`/${language}/terms`", 'pathFor(language, "terms")'],
  ["`/${language}/privacy`", 'pathFor(language, "privacy")'],
  ["`/${language}/credits/checkout`", 'pathFor(language, "credits_checkout")'],
  ["`/${language}/api-b2b`", 'pathFor(language, "api_b2b")'],
];

let changed = 0;
for (const f of files) {
  let c = fs.readFileSync(f, "utf8");
  const orig = c;
  for (const [from, to] of simple) {
    if (c.includes(from)) c = c.split(from).join(to);
  }
  c = c.replace(/`\/\$\{language\}\/cars\/\$\{([^}]+)\}`/g, "pathForCountry(language, $1)");
  c = c.replace(
    /`\/\$\{language\}\/checkout\?vin=\$\{([^}]+)\}`/g,
    'pathFor(language, "checkout", { query: `vin=${$1}` })',
  );

  if (c === orig) continue;

  const needsCountry = c.includes("pathForCountry(");
  const needsPathFor = c.includes("pathFor(");
  if ((needsPathFor || needsCountry) && !c.includes("@/lib/localized-routes")) {
    const importLine = needsCountry
      ? 'import { pathFor, pathForCountry } from "@/lib/localized-routes";'
      : 'import { pathFor } from "@/lib/localized-routes";';
    const lines = c.split("\n");
    let lastImport = 0;
    for (let i = 0; i < Math.min(lines.length, 100); i++) {
      if (lines[i].startsWith("import ")) lastImport = i;
    }
    lines.splice(lastImport + 1, 0, importLine);
    c = lines.join("\n");
  } else if (needsCountry && c.includes("@/lib/localized-routes") && !c.includes("pathForCountry")) {
    c = c.replace(
      /import \{ pathFor \} from "@\/lib\/localized-routes";/,
      'import { pathFor, pathForCountry } from "@/lib/localized-routes";',
    );
  }

  fs.writeFileSync(f, c);
  changed++;
  console.log("updated", path.relative(root, f));
}
console.log("files changed", changed);
