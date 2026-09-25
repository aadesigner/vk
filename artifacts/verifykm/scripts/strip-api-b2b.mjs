/**
 * Strip api-b2b from VerifyKM routing/SEO/index surfaces after folder delete.
 */
import fs from "fs";
import path from "path";

const root = "C:/Users/Pc/Downloads/vk/artifacts/verifykm/src";

// --- App.tsx: remove B2B block, add redirect to home ---
{
  const p = path.join(root, "App.tsx");
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(
    /const ApiB2bHomePage[\s\S]*?function CountryLang\(/,
    "function CountryLang(",
  );
  s = s.replace(
    /\s*\{\/\* B2B API marketing \(separate shell from consumer site\) \*\/\}\s*<Route path="\/:lang\/api-b2b\/plans"[\s\S]*?<Route path="\/:lang\/api-b2b" component=\{ApiB2bHomeLang\} \/>\s*/,
    `
        {/* Legacy api-b2b URLs → home (service not offered on VerifyKM) */}
        <Route path="/:lang/api-b2b/:rest*">{({ params }) => <Redirect to={\`/\${params.lang}\`} />}</Route>
        <Route path="/:lang/api-b2b">{({ params }) => <Redirect to={\`/\${params.lang}\`} />}</Route>

`,
  );
  fs.writeFileSync(p, s);
  console.log("patched App.tsx");
}

// --- localized-routes.ts ---
{
  const p = path.join(root, "lib/localized-routes.ts");
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(/\s*\|\s*"api_b2b(?:_plans|_contact|_vin_decoder)?"/g, "");
  s = s.replace(
    /Exclude<PageId, "home" \| "credits_checkout" \| "api_b2b_plans" \| "api_b2b_contact" \| "api_b2b_vin_decoder">/g,
    'Exclude<PageId, "home" | "credits_checkout">',
  );
  s = s.replace(/\s*api_b2b: "api-b2b",\r?\n/g, "\n");
  s = s.replace(
    /"home" \| "credits_checkout" \| "api_b2b_plans" \| "api_b2b_contact" \| "api_b2b_vin_decoder"/g,
    '"home" | "credits_checkout"',
  );
  s = s.replace(/\s*case "api_b2b_plans":[\s\S]*?case "api_b2b_vin_decoder":\s*return "\/api-b2b\/vin-decoder";\r?\n/g, "\n");
  s = s.replace(/\s*\} else if \(page === "api_b2b_plans"\) \{[\s\S]*?\} else if \(page === "api_b2b_vin_decoder"\) \{\s*path = `\/\$\{lang\}\/api-b2b\/vin-decoder`;\s*\}/g, "");
  s = s.replace(/\s*\|\s*\{\s*kind: "api_b2b";\s*rest: string\s*\}/g, "");
  s = s.replace(/\s*\/\/ api-b2b…[\s\S]*?return \{ kind: "api_b2b", rest: `\/\$\{parts\.join\("\/"\)\}` \};\s*\}/g, "\n  }");
  // Fix potential double brace from above - read carefully
  s = s.replace(/\s*if \(r\.page === "api_b2b"\) return "\/api-b2b";\r?\n/g, "\n");
  s = s.replace(/\s*if \(r\.page === "api_b2b_plans"\) return "\/api-b2b\/plans";\r?\n/g, "\n");
  s = s.replace(/\s*if \(r\.page === "api_b2b_contact"\) return "\/api-b2b\/contact";\r?\n/g, "\n");
  s = s.replace(/\s*if \(r\.page === "api_b2b_vin_decoder"\) return "\/api-b2b\/vin-decoder";\r?\n/g, "\n");
  s = s.replace(/\s*if \(r\.kind === "api_b2b"\) return r\.rest;\r?\n/g, "\n");
  s = s.replace(/\s*if \(clean === "\/api-b2b" \|\| clean\.startsWith\("\/api-b2b\/"\)\) \{[\s\S]*?\n  \}/g, "\n");
  fs.writeFileSync(p, s);
  console.log("patched localized-routes.ts");
}

// --- indexable-paths ---
{
  const p = path.join(root, "lib/indexable-paths.json");
  const arr = JSON.parse(fs.readFileSync(p, "utf8"));
  const next = arr.filter((x) => typeof x === "string" && !x.includes("api-b2b"));
  fs.writeFileSync(p, JSON.stringify(next, null, 2) + "\n");
  console.log("indexable-paths", arr.length, "->", next.length);
}

// --- spaKnownPaths on api-server ---
{
  const p = "C:/Users/Pc/Downloads/vk/artifacts/api-server/src/lib/spaKnownPaths.ts";
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(/\s*"api-b2b(?:\/[^"]*)?",?\r?\n/g, "\n");
  fs.writeFileSync(p, s);
  console.log("patched spaKnownPaths");
}

{
  const p = "C:/Users/Pc/Downloads/vk/artifacts/api-server/src/lib/spaKnownPaths.test.ts";
  let s = fs.readFileSync(p, "utf8");
  s = s.replace(/\s*it\("allows known api-b2b marketing routes",[\s\S]*?\n  \}\);\r?\n/g, "\n");
  s = s.replace(/\s*expect\(isKnownSpaPath\("\/en\/api-b2b\/not-a-region"\)\)\.toBe\(false\);\r?\n/g, "\n");
  s = s.replace(/\s*expect\(isKnownSpaPath\("\/en\/api-b2b\/plans\/extra"\)\)\.toBe\(false\);\r?\n/g, "\n");
  fs.writeFileSync(p, s);
  console.log("patched spaKnownPaths.test");
}

console.log("done strip");
