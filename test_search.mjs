import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIndex, search, stem, tokenize } from "./search.mjs";

const cv = JSON.parse(readFileSync("./data/cv.json", "utf8"));
const idx = buildIndex(cv.chunks);
const top = (q) => search(idx, q, 1)[0]?.chunk.id ?? null;

// stemmer: regular affixes collapse, short tokens are left alone
assert.equal(stem("membangun"), "bangun");
assert.equal(stem("bekerja"), "kerja");
assert.equal(stem("dokumenting"), "dokument");
assert.equal(stem("deployment"), "deploy");
assert.equal(stem("pembayaran"), "bayar");
// English needs plurals, not affixes
assert.equal(stem("projects"), "project");
assert.equal(stem("standards"), "standard");
assert.equal(stem("libraries"), "library");
assert.equal(stem("policies"), "policy");
// guards: short tokens, and words that merely end in s
assert.equal(stem("api"), "api");
assert.equal(stem("ai"), "ai");
assert.equal(stem("macos"), "macos");     // proper noun, not a plural
assert.equal(stem("status"), "status");   // -us blocks
assert.equal(stem("business"), "business"); // -ss blocks
assert.equal(stem("jelas"), "jelas");     // 5-letter stem, no plural rule

// stemming must not have broken routing
assert.equal(top("how do you deploy things"), "stack-infra");
assert.equal(top("detail sama breakdown gitu"), "worklog");
assert.equal(top("membangun dokumentasi tim"), "docs-as-engineering");
assert.equal(top("do you have design systems or component libraries"), "design-systems");
// real phrasing a visitor would type, phrased differently from the chunk wording
assert.equal(top("saya mau ngerjain website pakai framework apa"), "stack-frontend");
assert.equal(top("bisa bikin aplikasi buat HP ga"), "stack-native");
assert.equal(top("mobile app bisa?"), "stack-native");
// note: "gimana cara deploy aplikasi" is deliberately NOT asserted. deploy -> infra and
// aplikasi -> native both match one term, and either is a fair answer. Forcing it would
// be tuning the scorer to the test rather than to the question.
assert.equal(top("deploy aplikasi ke server"), "stack-infra");
assert.equal(top("kalo ada nanya skill backend lo gim"), "stack-backend");
assert.equal(top("kamu pernah ngurus database yang aman"), "stack-data");
assert.equal(top("berapa lama lo di industri ini"), "intro");

// tokenizer
assert.deepEqual(tokenize("Kamu bisa backend, atau frontend doang?"), ["backend", "frontend", "doang"]);
assert.equal(tokenize("   ").length, 0);        // stopwords only -> no query terms
assert.deepEqual(tokenize("Café naïve"), ["cafe", "naive"]); // diacritics folded

// every featured id must exist, or the homepage renders a hole
for (const id of cv.featured) assert.ok(cv.chunks.some((c) => c.id === id), `missing featured: ${id}`);

// no query term -> no result, so the UI falls through to "email me"
assert.equal(search(idx, "apa kabar kabar kabar", 3).length, 0);
// compensation is deliberately NOT indexed: it must fall through to email, not get invented
assert.equal(search(idx, "berapa gaji lo berapa bayar salary", 3).length, 0);

// routing: Indonesian
assert.equal(top("kamu bisa backend?"), "stack-backend");
assert.equal(top("apakah kamu ngerjain API?"), "stack-backend");
assert.equal(top("gimana cara kerja lo sehari-hari?"), "worklog");
assert.equal(top("kamu pernah freelance?"), "freelance");
assert.equal(top("apa yang lo kerjakan di koltiva?"), "koltiva");
assert.equal(top("berapa nomor hp saya?"), "contact");
// the two questions every recruiter opens with - these must never fall through
assert.equal(top("berapa tahun pengalaman lo?"), "intro");
assert.equal(top("nama kamu siapa?"), "intro");
assert.equal(top("how many years of experience do you have?"), "intro");

// routing: English
assert.equal(top("Do you know Swift or native apps?"), "stack-native");
assert.equal(top("do you do backend or only frontend"), "stack-backend");
assert.equal(top("what is the biggest thing you built at work"), "sdlc-engine");
assert.equal(top("how do you keep architecture docs from going stale"), "docs-as-engineering");
assert.equal(top("do you use clean architecture in frontend"), "clean-architecture");
assert.equal(top("do you know PostgreSQL and Supabase"), "stack-data");
assert.equal(top("explain the geospatial routing project"), "project-15menit");
assert.equal(top("where did you study"), "education");

// coverage gate: a single-topic query is confident, a scattered one is not.
// asserted as a bound, not a fraction - expand() changes the denominator as the stemmer evolves
assert.equal(search(idx, "docker", 1)[0].confident, true);
const thin = search(idx, "docker quantum entanglement kubernetes", 1)[0];
assert.ok(thin.coverage < 0.5, `coverage too high: ${thin.coverage}`);
assert.equal(thin.confident, false);

// no confidential leakage in published data.
// The deny-list is read from .leaklist, which is gitignored: a list of the names this project
// refuses to publish cannot itself live in a published repository. Missing file fails the run
// rather than skipping, because a leak check that silently passes when its list is absent is
// worse than no check at all.
let deny;
try {
  deny = readFileSync("./.leaklist", "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
} catch {
  assert.fail(".leaklist is missing, so this leak check did not run. Recreate it from the header notes; it must never be committed.");
}
assert.ok(deny.length > 20, `.leaklist only has ${deny.length} entries, which looks truncated`);
const blob = JSON.stringify(cv).toLowerCase();
for (const leak of deny) {
  assert.ok(!blob.includes(leak.toLowerCase()), `leaked internal name: ${leak}`);
}

console.log("ok -", cv.chunks.length, "chunks,", cv.featured.length, "featured");
