// Writes README.md - and README.md is the GitHub profile, because this repository is
// github.com/anggiedimasta/anggiedimasta, which GitHub treats as the special profile
// repository. Whatever sits at the root is what a visitor sees on the profile page.
//
//   node make_profile.mjs      # run after every edit to data/cv.json
//
// Why generated: a profile README is a second, markdown-only rendering of the same chunks.
// Hand-written it is right for about a month and then quietly disagrees with the site, which
// is the one failure this project exists to prevent. GitHub renders markdown, so the
// accordions become blockquotes and the ask box becomes a link to the live site; the answers
// are identical because they are literally the same strings.
//
// The operating notes at the bottom are the static half. They live here rather than in a
// separate file because a generated README that has to concatenate two inputs is one more
// thing to keep in sync, and these change about once a deployment.
//
// No leak check here on purpose: it renders cv.json and nothing else, and test_sec.mjs proves
// cv.json is free of the withheld names. Duplicating that list would be two places to forget.
import { readFileSync, writeFileSync } from "node:fs";

const cv = JSON.parse(readFileSync("data/cv.json", "utf8"));
const byId = new Map(cv.chunks.map((c) => [c.id, c]));

// GitHub's markdown renderer resolves these to real avatars, which is the one bit of
// third-party fetch a profile README cannot avoid if it shows a face.
const avatar = `<img src="https://github.com/${cv.links.github.split("/").pop()}.png?size=180" width="180" alt="" />`;

const quote = (body) =>
  body.trim().split(/\n{2,}/).map((p) => `> ${p.trim().replace(/\n/g, "\n> ")}`).join("\n>\n");

const featured = cv.featured.map((id) => {
  const c = byId.get(id);
  if (!c) throw new Error(`featured id has no chunk: ${id}`);
  return `### ${c.title}\n\n${quote(c.body)}`;
});

const projects = cv.projects
  .map((p) => `**${p.name}** — ${p.note}`)
  .join("  \n");

// The operating half of the README. Static: it describes how the site is built and deployed,
// which changes about once per deployment, unlike the profile above which changes whenever the
// CV does.
const OPERATIONS = `
---

## The site

This repository is also the website. \`index.html\` renders the same five answers as
accordions and adds a box that scores any question against all ${cv.chunks.length} chunks with BM25, in the
visitor's browser. No server, no model, no API key, no build step, no \`node_modules\`.

| | |
|---|---|
| \`data/cv.json\` | **the site.** Every chunk, its keywords, and the questions it answers |
| \`index.html\` | layout and the ask box |
| \`search.mjs\` | tokenizer, Indonesian/English stemmer, BM25 |
| \`llms.txt\` | the page is JS-rendered, so this is what a crawler or an LLM reads instead |
| \`favicon.svg\` | the mark, sampled from the source path onto a 13×13 dot grid |

### Run it

\`\`\`sh
node test_search.mjs && node test_view.mjs && node test_sec.mjs   # all three must pass
python -m http.server 8099                   # then open localhost:8099
\`\`\`

\`file://\` will not work — the browser blocks \`fetch\` on local files.

### Deploy

Push to this branch and Cloudflare Pages redeploys. *Create → Pages → Connect to Git*, pick this
repo, leave the build command empty and the output directory \`/\`. Every push redeploys and you
get a \`*.pages.dev\` URL immediately.

### Editing the CV

1. Edit \`data/cv.json\`. \`id\` is the key; \`featured\` lists the five shown at the top.
2. \`node test_search.mjs\` — fails if a \`featured\` id is missing or a withheld internal name
   reached the published data.
3. \`node make_profile.mjs\` — regenerates this file from the same JSON.
4. Push.

### Two files are deliberately not in this repository

- **\`.leaklist\`** — the deny-list the leak checks read at run time. It names the things this
  project refuses to publish, so committing it would publish exactly what it withholds. The
  tests fail loudly when it is absent, because a leak check that passes because its list is
  missing is not a check.
- **the source CV** — the PDF and the hand-made text extracts. \`data/cv.json\` is what ships.

### Not here, on purpose

- **A build step or minifier.** Minifying hides nothing: \`data/cv.json\` is the site and is
  readable by design. It would cost a \`package.json\` and a build command to obscure forty
  lines of readable code.
- **An embedding model.** The multilingual MiniLM is roughly 120 MB on first visit and needs a
  bundler. \`keywords\` covers the same synonyms for zero bytes.
- **A language model in the retrieval path.** Measured, not assumed: on twelve adversarial
  routing queries BM25 scored 9 and a hosted classifier 2. The classifier also lost on shipping
  grounds, since its only endpoint sat at 32% uptime.
- **A backend.** Nothing to bill, so nothing can be billed.
`;

const md = `# ${cv.name}

${avatar}

\`${cv.title}\` · ${cv.location}

${cv.summary}

**Things I have built** — ${projects}

[GitHub](${cv.links.github}) · [LinkedIn](${cv.links.linkedin}) · [${cv.email}](mailto:${cv.email})${cv.phone ? ` · [${cv.phone}](tel:${cv.phone.replace(/[^\d+]/g, "")})` : ""}

---

## Frequently asked

${featured.join("\n\n")}

---

Every answer above is a **verbatim quote** from my CV, not a summary of it. The full corpus is
[${cv.chunks.length} chunks of JSON](data/cv.json), each with the questions it answers, and a BM25 scorer picks the one
that fits. There is no language model in the loop, so nothing here can be invented.

${OPERATIONS}
<sub>The profile above is generated by <code>make_profile.mjs</code> from <code>data/cv.json</code>.
Edit the JSON, not this file.</sub>
`;

writeFileSync("README.md", md);
console.log(`README.md  ${md.split("\n").length} lines, ${md.length} chars, ${cv.featured.length} featured, ${cv.chunks.length} chunks referenced`);
