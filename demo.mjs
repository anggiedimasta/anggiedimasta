import { readFileSync } from "node:fs";
import { buildIndex, search } from "./search.mjs";

const cv = JSON.parse(readFileSync("./data/cv.json", "utf8"));
const idx = buildIndex(cv.chunks);
const qs = [
  "Do you do backend, or only frontend?",
  "gimana cara kerja lo sehari-hari?",
  "apakah kamu ngerjain API?",
  "do you know swift",
  "berapa tahun pengalaman lo",
  "berapa bayar lo?",
  "nama kamu siapa?",
];
for (const q of qs) {
  const r = search(idx, q, 2);
  console.log("Q: " + q);
  if (!r.length) { console.log("   -> (no match)"); continue; }
  for (const x of r)
    console.log(`   -> ${x.chunk.id}  score=${x.score.toFixed(2)}  coverage=${Math.round(x.coverage * 100)}%  ${x.confident ? "CONFIDENT" : "weak"}`);
}
