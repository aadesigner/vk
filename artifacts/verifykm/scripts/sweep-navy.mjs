import fs from "fs";
import path from "path";
const root = "C:/Users/Pc/Downloads/vk/artifacts/verifykm/src";
const pairs = [
  ["#0a120e", "#060a14"],
  ["#0a1210", "#030712"],
  ["#eef8f1", "#e6f6ff"],
  ["#052e1a", "#0c1a2e"],
  ["#064e3b", "#0c4a6e"],
  ["#065f46", "#075985"],
];
let n = 0;
function walk(d) {
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    if (ent.isDirectory()) { if (ent.name !== "node_modules") walk(p); continue; }
    if (!/\.(tsx?|css|json)$/.test(ent.name)) continue;
    let s = fs.readFileSync(p, "utf8");
    let o = s;
    for (const [a,b] of pairs) s = s.split(a).join(b);
    if (s !== o) { fs.writeFileSync(p, s); n++; console.log(p); }
  }
}
walk(root);
console.log("files", n);
