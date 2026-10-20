// Cuts the 1.5 MB handwritten font down to just the glyphs the page uses
// (usually a few dozen KB), so it can be self-hosted instead of loaded from
// Google Fonts, which is slow or blocked in mainland China.
// Runs automatically before `npm run dev` and `npm run build`.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import subsetFont from "subset-font";
import { loadSite, handTexts } from "../src/lib/content.mjs";

const SOURCE = new URL("../fonts-src/XiaolaiSC-Regular.gb2312.woff2", import.meta.url);
const OUT_DIR = new URL("../src/generated/", import.meta.url);

const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
const chars = new Set([...handTexts(loadSite()).join(""), ...ascii]);

const woff2 = await subsetFont(readFileSync(SOURCE), [...chars].join(""), {
  targetFormat: "woff2",
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(new URL("hand.woff2", OUT_DIR), woff2);
console.log(`[subset-font] ${chars.size} glyphs → ${(woff2.length / 1024).toFixed(1)} KB`);
