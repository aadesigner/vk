/**
 * Production-only: minify prerendered HTML shells and standalone public JS.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { minify as minifyHtml } from "html-minifier-terser";
import { transformSync } from "esbuild";

const dir = dirname(fileURLToPath(import.meta.url));
const dist = join(dir, "..", "dist", "public");

const HTML_MINIFY = {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  keepClosingSlash: true,
  removeAttributeQuotes: false,
  minifyCSS: true,
  minifyJS: true,
};

function walkHtmlFiles(root, out = []) {
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      walkHtmlFiles(path, out);
    } else if (name.endsWith(".html")) {
      out.push(path);
    }
  }
  return out;
}

function minifyStandaloneJs(filePath) {
  const source = readFileSync(filePath, "utf8");
  const { code } = transformSync(source, {
    loader: "js",
    minify: true,
    legalComments: "none",
    target: "es2020",
  });
  writeFileSync(filePath, code, "utf8");
}

let htmlCount = 0;
let htmlBefore = 0;
let htmlAfter = 0;

for (const file of walkHtmlFiles(dist)) {
  const raw = readFileSync(file, "utf8");
  htmlBefore += raw.length;
  const minified = await minifyHtml(raw, HTML_MINIFY);
  htmlAfter += minified.length;
  writeFileSync(file, minified, "utf8");
  htmlCount++;
}

const seoBootstrap = join(dist, "seo-bootstrap.js");
let jsNote = "";
if (statSync(seoBootstrap, { throwIfNoEntry: false })?.isFile()) {
  const before = readFileSync(seoBootstrap, "utf8").length;
  minifyStandaloneJs(seoBootstrap);
  const after = readFileSync(seoBootstrap, "utf8").length;
  const saved = before - after;
  jsNote =
    saved > 0
      ? `seo-bootstrap.js (−${Math.round(saved / 1024)} KiB)`
      : "seo-bootstrap.js (unchanged)";
}

const htmlSaved = htmlBefore - htmlAfter;
console.log(
  `Minified ${htmlCount} HTML file(s) (−${Math.round(htmlSaved / 1024)} KiB)${jsNote ? ` and ${jsNote}` : ""}`,
);
