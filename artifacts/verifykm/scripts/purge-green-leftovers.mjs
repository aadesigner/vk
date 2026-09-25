import fs from "fs";
import path from "path";

const root = path.resolve("C:/Users/Pc/Downloads/vk/artifacts/verifykm/src");
const exts = new Set([".ts", ".tsx", ".css", ".json", ".mjs", ".js"]);

const replacements = [
  [/bg-\[#e6f6ff\]0/g, "bg-[#00a5fd]"],
  [/text-\[#e6f6ff\]0/g, "text-[#00a5fd]"],
  [/border-\[#e6f6ff\]0/g, "border-[#00a5fd]"],
  [/from-\[#e6f6ff\]0/g, "from-[#00a5fd]"],
  [/to-\[#e6f6ff\]0/g, "to-[#00a5fd]"],
  [/ring-green-500/g, "ring-[#00a5fd]"],
  [/border-green-500/g, "border-[#00a5fd]"],
  [/border-green-300/g, "border-[#7dd3fc]"],
  [/border-green-400/g, "border-[#38bdf8]"],
  [/border-green-900/g, "border-[#0c4a6e]"],
  [/bg-green-400/g, "bg-[#00a5fd]"],
  [/text-green-200/g, "text-[#bae6fd]"],
  [/text-green-300/g, "text-[#7dd3fc]"],
  [/text-green-700/g, "text-[#0369a1]"],
  [/text-green-800/g, "text-[#075985]"],
  [/text-green-900/g, "text-[#0c4a6e]"],
  [/text-green-600/g, "text-[#0284c7]"],
  [/#10b981/g, "#00a5fd"],
  [/#22c55e/g, "#00a5fd"],
];

let files = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p);
      continue;
    }
    if (!exts.has(path.extname(ent.name))) continue;
    let s = fs.readFileSync(p, "utf8");
    const orig = s;
    for (const [re, to] of replacements) s = s.replace(re, to);
    if (s !== orig) {
      fs.writeFileSync(p, s);
      files++;
    }
  }
}

walk(root);
console.log("updated files", files);

function count(pat) {
  let n = 0;
  function w(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== "node_modules") w(p);
        continue;
      }
      if (!exts.has(path.extname(ent.name))) continue;
      const m = fs.readFileSync(p, "utf8").match(pat);
      if (m) n += m.length;
    }
  }
  w(root);
  return n;
}

console.log("mangled leftover", count(/#e6f6ff\]0/g));
console.log("text-green leftover", count(/text-green-/g));
console.log("bg-green leftover", count(/bg-green-/g));
console.log("emerald leftover", count(/emerald/g));
