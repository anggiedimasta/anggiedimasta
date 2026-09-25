// Contract check: does every chunk carry what index.html renders, and does the
// escaper neutralise the characters that would break the template? Run with the
// routing assertions in test_search.mjs; this one is about the view layer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cv = JSON.parse(readFileSync("./data/cv.json", "utf8"));
const html = readFileSync("./index.html", "utf8");

// the escaper is the only thing standing between chunk text and innerHTML
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
assert.equal(esc(`<img src=x onerror="alert('x')">`),
  "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;");
assert.equal(esc("a & b"), "a &amp; b");

// index.html must not interpolate unescaped chunk fields.
// Escape hatch: a line may opt out with `plaintext, not html` in a comment, which is only
// legitimate where the string never reaches innerHTML (the clipboard payload, for one).
for (const bad of ["${c.body}", "${c.title}", "${c.questions", "${cv.email}", "${cv.phone}", "${cv.summary}"]) {
  const lines = html.split("\n").filter((l) => l.includes(bad) && !l.includes("esc(") && !l.includes("plaintext, not html"));
  assert.equal(lines.length, 0, `unescaped interpolation: ${bad}`);
}

// every chunk must have the four fields the template reads
for (const c of cv.chunks) {
  assert.ok(c.id && c.title && c.body, `incomplete chunk: ${c.id}`);
  assert.ok(Array.isArray(c.keywords) && c.keywords.length, `no keywords: ${c.id}`);
  assert.ok(Array.isArray(c.questions) && c.questions.length, `no questions: ${c.id}`);
}

// header fields the template reads straight off cv
for (const f of ["name", "title", "location", "summary", "email", "featured"]) {
  assert.ok(cv[f], `missing header field: ${f}`);
}
assert.ok(cv.links?.github && cv.links?.linkedin, "missing links");
assert.ok(/^\+?\d[\d\s-]{7,}$/.test(cv.phone), `bad phone: ${cv.phone}`);

// the featured 5 is what renders; nothing more
assert.equal(cv.featured.length, 5);

// the hero project line must not be able to claim work that is not in the corpus
assert.ok(Array.isArray(cv.projects) && cv.projects.length, "no projects line");
for (const p of cv.projects) {
  assert.ok(p.name && p.note, `incomplete project entry: ${JSON.stringify(p)}`);
  assert.ok(
    cv.chunks.some((c) => c.id === p.chunk || c.title.includes(p.name)),
    `project line claims "${p.name}" with no matching chunk`
  );
}

// accordion labels are scannable, not sentences
for (const c of cv.chunks) assert.ok(c.title.length <= 45, `title too long (${c.title.length}): ${c.title}`);

// ---- agent-facing surface. The page is JS-rendered, so llms.txt, the raw JSON and the
// noscript block are the only things a non-executing crawler or an LLM can actually read.
const llms = readFileSync("./llms.txt", "utf8");
assert.ok(llms.startsWith("# "), "llms.txt needs an H1 title");
assert.ok(llms.includes("/data/cv.json"), "llms.txt must point at the corpus");
for (const id of cv.featured) {
  assert.ok(llms.includes(`\`${id}\``), `llms.txt omits featured chunk id: ${id}`);
  assert.ok(cv.chunks.some((c) => c.id === id), `llms.txt names a missing chunk: ${id}`);
}
for (const p of cv.projects) {
  assert.ok(llms.includes(`\`${p.chunk}\``), `llms.txt omits project chunk id: ${p.chunk}`);
  assert.ok(cv.chunks.some((c) => c.id === p.chunk), `llms.txt names a missing chunk: ${p.chunk}`);
}
assert.ok(html.includes("<noscript>"), "no noscript fallback for a JS-rendered page");
assert.ok(/href="\.\/data\/cv\.json"/.test(html), "noscript must link the corpus");
assert.ok(/href="\.\/llms\.txt"/.test(html), "noscript must link llms.txt");

// the copy-for-an-AI button must be wired, and must build from the loaded cv not a fetch
assert.ok(html.includes('id="copy"'), "no copy-for-AI control");
assert.ok(/navigator\.clipboard\.writeText/.test(html), "copy button never writes to the clipboard");
assert.ok(!/fetch\([^)]*copy|fetch\([^)]*llms/.test(html), "copy button should not fetch anything");

// ---- share metadata. A link pasted into a chat renders from these, not from the page.
const meta = [...html.matchAll(/<meta [^>]*>/g)].map((m) => m[0]).join("\n");
for (const p of ["og:type", "og:title", "og:description", "twitter:card"]) {
  assert.ok(meta.includes(p), `missing ${p}`);
}
assert.ok(/<link rel="icon"/.test(html), "missing favicon link");
// ponytail: no og:image until a real 1200x630 asset exists - a portrait cropped to 1.9:1
// frames nobody. Asserted absent so it is a decision, not an oversight.
assert.ok(!/property="og:image"/.test(meta), "og:image added without an asset to point at");

// ---- the header photo
const img = /<img[^>]*>/.exec(html);
assert.ok(img, "no header photo");
assert.ok(/class="me"/.test(img[0]) && /src="anggiedimasta\.jpg"/.test(img[0]), "photo must be .me from anggiedimasta.jpg");
assert.ok(html.includes('onerror="this.remove()"'), "a missing photo must remove itself, not show a broken image");
assert.ok(/alt="[^"]+"/.test(img[0]), "photo needs alt text");
assert.ok(/width="\d+" height="\d+"/.test(img[0]), "photo needs intrinsic size or it shifts layout");
const me = /\.me \{[\s\S]*?\}/.exec(html)[0];
assert.ok(/object-fit: cover/.test(me), ".me needs object-fit so any source aspect fills the box");
assert.ok(!/border-radius/.test(me), "no rounded corners");

// ---- the ASCII easter egg, in the HTML comment and in the console, must be one string
const art = /const ART = `([\s\S]*?)`/.exec(html)[1];
assert.ok(new Set(art.split("\n").map((l) => l.length)).size === 1, "ascii art lines are not all one width");
// pick the comment that actually holds the art, not just the first <!-- in the file
const cArt = [...html.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1]).find((b) => b.includes("+---"));
assert.ok(cArt, "the ascii art is not in any html comment - inspect element finds nothing");
assert.equal(
  cArt.split("\n").map((l) => l.trim()).filter((l) => /^[+|]/.test(l)).join("\n"),
  art,
  "comment art and console art have drifted"
);
assert.ok(html.includes("console.log(ART)"), "the art is defined but never printed");

// ---- palette contrast. Asserted, not eyeballed: a theme swap that quietly drops body text
// to 3:1 looks fine to the person who made it and fails the person reading it.
// Comments are stripped before anything reads the stylesheet. A CSS comment that mentions a
// file name or a token name looks exactly like a class selector to the dead-rule check below,
// and rewording the comment to satisfy a regex is the wrong fix.
const style = /<style>([\s\S]*?)<\/style>/.exec(html)[1].replace(/\/\*[\s\S]*?\*\//g, "");
const vars = (block) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const light = vars(/:root\s*\{([\s\S]*?)\}/.exec(style)[1]);
const dark = vars(/prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([\s\S]*?)\}/.exec(style)[1]);

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

for (const [mode, v] of [["light", light], ["dark", dark]]) {
  const need = (name, min) => {
    assert.ok(v[name], `${mode}: --${name} is not defined`);
    const r = ratio(v[name], v["--bg"]);
    assert.ok(r >= min, `${mode}: --${name} ${v[name]} on --bg is ${r.toFixed(2)}:1, needs ${min}:1`);
    return r;
  };
  need("--fg", 7);        // body text, AAA
  need("--muted", 4.5);   // role line, section heading, labels
  need("--interactive", 4.5);  // links and focus ring, the only hue that carries text
  need("--display", 7);   // the name, the button, the open card border
  // cards have to be distinguishable from the page or the accordions are invisible
  const cardStep = Math.abs(lum(v["--card"]) - lum(v["--bg"]));
  assert.ok(cardStep > 0.002, `${mode}: --card ${v["--card"]} is within ${(cardStep * 100).toFixed(2)}% of --bg, cards will not read as cards`);
  // the Ask button is bg-coloured text on --display, so it is the reverse pair
  const btn = ratio(v["--bg"], v["--display"]);
  assert.ok(btn >= 4.5, `${mode}: button text ${v["--bg"]} on ${v["--display"]} is ${btn.toFixed(2)}:1, needs 4.5:1`);
  // a border that vanishes is not a border
  assert.ok(ratio(v["--line"], v["--bg"]) > 1.12, `${mode}: --line ${v["--line"]} is invisible against --bg`);
  // the answer is greyer than the question, and it is read at length on the raised surface
  // inside the card, not on the page. Asserted against --raised because that is where it sits.
  for (const surface of ["--card", "--raised"]) {
    assert.ok(ratio(v["--muted"], v[surface]) >= 4.5,
      `${mode}: answer text ${v["--muted"]} on ${surface} is ${ratio(v["--muted"], v[surface]).toFixed(2)}:1, needs 4.5:1`);
  }
  assert.ok(ratio(v["--line-strong"], v["--raised"]) >= 1.4,
    `${mode}: the quoted block's left rule ${v["--line-strong"]} on ${v["--raised"]} is invisible`);
  assert.ok(/summary \{[^}]*color: var\(--display\)/.test(style), "the question must stay at full contrast");
  assert.ok(/\.quote \{[^}]*color: var\(--muted\)/.test(style), "the answer must be one step down from the question");
  // every paragraph the template emits must be class-tagged. A bare <p> rule in a page where
  // #out holds .src, .weak and the answer at once paints all three.
  assert.ok(!/^\s*#out p \{/m.test(style), "a bare #out p rule repaints the chrome along with the answer");
  assert.ok(!/^\s*\.body p \{/m.test(style), "a bare .body p rule does the same");
  // hesoyam's own bridge puts --primary at --nd-text-display and --accent at
  // --nd-surface-raised, i.e. its chrome is monochrome and the two hues only mean
  // "interactive" and "destructive". Assert that, so a later "let's add some colour" edit
  // cannot quietly repaint the buttons and the hero.
  assert.ok(!v["--green"] && !v["--yellow"],
    `${mode}: success/warning tokens are back. This page has no status to show, and hesoyam keeps them out of its chrome.`);
  assert.equal(/background: var\(--interactive\)/.test(style), false,
    "the Ask button is --display in hesoyam, not a hue. Monochrome or it is not the same system.");
  assert.ok(/h1 \{[^}]*color: var\(--display\)/.test(style), "the name is --display, not a colour accent");
  // the label role is the mono stack at hesoyam's exact .6875rem / .08em
  assert.ok(/h2 \{[^}]*font-family: var\(--mono\)/.test(style), "section headings use the mono label face");
  assert.ok(/\.6875rem/.test(style), "the label size must match hesoyam's --nd-label");
}

const after = html.slice(html.indexOf("</style>"));
const classes = [...new Set([...style.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1]))];
const dead = classes.filter((c) => !new RegExp(`(?<![\\w-])${c}(?![\\w-])`).test(after));
assert.equal(dead.length, 0, `css rules with nothing using them: ${dead.join(", ")}`);
for (const t of ["footer", "aside", "section"]) {
  if (new RegExp(`^\\s*${t} \\{`, "m").test(style)) assert.ok(new RegExp(`<${t}[ >]`).test(html), `css styles ${t}, nothing renders it`);
}

console.log("view contract ok -", cv.chunks.length, "chunks renderable");
