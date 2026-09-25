// BM25 over the CV chunks. Runs in the visitor's browser — no server, no API, no cost.
// ponytail: linear scan over ~37 chunks, no ANN index. At 10k chunks a brute-force
// cosine scan stops being instant — swap the body of search() for a vector index then.

const STOP = new Set(
  (`yang dan di dari untuk dengan pada adalah itu ini ke oleh sebagai atau akan
    ada bila jika karena saat serta sudah belum bisa dapat harus mau ingin
    saya aku gue lo lu kamu anda kami kita juga tapi apa apakah bagaimana
    kenapa mengapa siapa kapan dimana mana berapa cara gimana banyak orang
    seperti jadi saja aja dong sih ya kok banget deh nih tuh
    how what why who when where which do does did you your yours i me my we our us
    they them their he she it its have has had many much more most some any all each
    every can could would should shall will may might must tell show give explain
    describe there here about also just very know think want need get use used using
    example please thanks hello hi` ).split(/\s+/).filter(Boolean)
);

export function tokenize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // "back end", "back-end" and "backend" are one word to a visitor, three to a splitter.
    // Collapse before the split, otherwise the query is two tokens that match nothing.
    .replace(/\bback[\s-]?end\b/g, "backend")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

// Indonesian is agglutinative, so "membangun"/"bangun" and "bekerja"/"kerja" have to
// collide. English needs a different rule: mostly plurals, which the affix pass misses
// entirely ("components" vs "component"). Both live here, prefix first.
//
// The guards are asymmetric on purpose: a prefix must leave >= 5 chars, a suffix >= 4.
// Lowering the prefix guard to 4 turns "menulis" into "ulis", which is worse than not
// stripping at all - it invents collisions nobody asked for.
//
// ponytail, known ceiling: the prefix list is blind, so it also fires on English words
// that merely start like a prefix - performance->formance, digital->gital,
// medical->dical, message->ssage, permission->mission. Harmless here only because both
// the raw token and the stem are indexed, so recall is unaffected; the cost is a few
// possible false collisions. English is therefore NOT prefix-stemmed further.
// The plural guard is 5, not 4, for the same reason: at 4 it turns "jelas"->"jala" and
// "macos"->"maco", which invent collisions instead of removing them.
// ponytail, unreachable by rules: "nulis"/"tulis" is nasal assimilation and "bikin"/"buat"
// is a clitic. List those in keywords[]; add a dictionary stemmer only if misses persist.
const PREFIX = /^(meny|meng|peng|peny|pem|pen|mem|men|ber|per|ter|be|di|me|pe)(.+)$/;
const SUFFIX = /^(.+?)(ment|kan|ing|an|ed|i)$/;
// ies -> y first, else drop es/s; never after ss/us/is so status, business, analytics stay whole
const PLURAL_Y = /(?<![susi])ies$/;
const PLURAL = /(?<![susi])(?:es|s)$/;

export function stem(w) {
  let s = w;
  const p = PREFIX.exec(s);
  if (p && p[2].length >= 5) s = p[2];
  const q = SUFFIX.exec(s);
  if (q && q[1].length >= 4) s = q[1];
  if (PLURAL_Y.test(s) && s.length - 3 >= 5) s = `${s.slice(0, -3)}y`;
  else {
    const r = PLURAL.exec(s);
    if (r && s.length - r[0].length >= 5) s = s.slice(0, -r[0].length);
  }
  return s;
}

// Jargon a visitor actually types but the CV never spells out. Symmetric: expand() runs on
// the index and on the query, so "be" reaches exactly the documents "backend" does, and
// neither side needs a duplicate entry. Without this, "be" is a live token that appears in
// almost no chunk body and the coverage gate drops the whole result.
const ALIAS = { be: "backend", fe: "frontend", bckend: "backend", froend: "frontend" };

// Index and query both carry the raw token and its stem, so stemming adds recall
// without collapsing two genuinely different words onto one.
function expand(tokens) {
  const out = [];
  for (const t of tokens) {
    out.push(t);
    const a = ALIAS[t];
    if (a) out.push(a);
    const s = stem(t);
    if (s !== t) out.push(s);
  }
  return out;
}

const K1 = 1.5;
const B = 0.75;

export function buildIndex(chunks) {
  const docs = chunks.map((c) => {
    // questions[] is indexed too: they are the natural phrasings a visitor actually
    // types, which is what covers Indonesian verb forms that keywords[] would miss.
    const tokens = expand(tokenize(`${c.title} ${c.body} ${c.keywords.join(" ")} ${c.questions.join(" ")}`));
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { chunk: c, tf, len: tokens.length };
  });

  const N = docs.length;
  const df = new Map();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

  const idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + (N - n + 0.5) / (n + 0.5))]));
  const avg = docs.reduce((s, d) => s + d.len, 0) / N;
  return { docs, idf, avg };
}

// Returns top-k as { chunk, score, coverage }.
// coverage = fraction of the visitor's query terms that chunk actually contains.
// ponytail: confidence is coverage, not a raw BM25 cut — a 2-word and a 10-word
// query need different absolute thresholds, coverage is scale-free. Bump STRONG
// if matches feel too loose, DROP_STRONG if they refuse questions that were fine.
const STRONG = 0.5;

export function search(index, query, k = 3) {
  const q = [...new Set(expand(tokenize(query)))];
  if (!q.length) return [];

  return index.docs
    .map((d) => {
      let score = 0;
      let matched = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        matched++;
        score +=
          index.idf.get(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / index.avg)));
      }
      const coverage = matched / q.length;
      return { chunk: d.chunk, score, coverage, confident: coverage >= STRONG };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
