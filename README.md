# Anggie Putra Dimasta

<img src="https://github.com/anggiedimasta.png?size=180" width="180" alt="" />

`Staff Software Engineer` · Jakarta, Indonesia

Staff Engineer focused on high-level system architecture. I set technical standards and build AI-driven internal tools to optimize developer workflows.

**Things I have built** — **Hesoyam** — personal finance PWA  
**UI** — monorepo component library  
**Agentic Dev Starter** — AI-native project scaffolding  
**Pepepe** — native macOS menu bar app

[GitHub](https://github.com/anggiedimasta) · [LinkedIn](https://www.linkedin.com/in/anggiedimasta/) · [anggiedimasta@gmail.com](mailto:anggiedimasta@gmail.com) · [+6282223377257](tel:+6282223377257)

---

## Frequently asked

### Who I am

> I'm Anggie Putra Dimasta, a Staff Software Engineer in Jakarta, Indonesia. I'm currently a Platform Engineer Frontend at Lion Parcel, a logistics and courier service. I focus on high-level system architecture, set technical standards, and build AI-driven internal tools to optimize developer workflows. I've been shipping software professionally since 2012 and doing frontend and platform engineering since 2016.

### How I work

> At work I work as a catalyst: I got our SDLC engine and documentation workspace off the ground, and I still maintain them, which in practice means writing the specifications and detailing that a team of engineers then builds from. Where a good pattern already exists I use it, and where none fits I design one. I get productive on a new codebase in days, which is how I keep moving fast when the stack changes under me.

### System architecture

> I drive high-level system design and conduct in-depth architectural assessments with cross-domain Platform Engineers. A concrete example is mitigating race conditions in high-volume services. At Lion Parcel this is done in close partnership with the Principal Engineer and the Platform Engineers on backend and mobile.

### Backend and API work

> My production backend work comes from my own projects: Go Fiber, FastAPI, Express, tRPC, PHP, and background workers using the outbox pattern. Most of those were exploratory - built to find out whether an approach held up, which is a different thing from running a business on it. The exception is Hesoyam, which I use every day, running on a small service mesh with PostgreSQL row-level security.
>
> At Lion Parcel I own the frontend and the internal tooling, and integrate against the Go services the platform team runs.

### How I actually spend my time

> My leverage as a Staff engineer is mostly in making work buildable before it gets written. I do that systematically - detailing, grooming and breaking requirements down until they are implementation-ready - so the ambiguity surfaces while it is still cheap to fix.
>
> Over the last fifteen months that came to roughly 2,900 story points across 976 tickets and about 2,400 logged hours - most of it specification work, with the features built by the engineers those specs went to. That discipline is the part of my job I am most proud of. A well-shaped ticket is worth more than a fast commit, and the documentation that comes out of it outlives the sprint.

---

Every answer above is a **verbatim quote** from my CV, not a summary of it. The full corpus is
[38 chunks of JSON](data/cv.json), each with the questions it answers, and a BM25 scorer picks the one
that fits. There is no language model in the loop, so nothing here can be invented.


---

## The site

This repository is also the website. `index.html` renders the same five answers as
accordions and adds a box that scores any question against all 38 chunks with BM25, in the
visitor's browser. No server, no model, no API key, no build step, no `node_modules`.

| | |
|---|---|
| `data/cv.json` | **the site.** Every chunk, its keywords, and the questions it answers |
| `index.html` | layout and the ask box |
| `search.mjs` | tokenizer, Indonesian/English stemmer, BM25 |
| `llms.txt` | the page is JS-rendered, so this is what a crawler or an LLM reads instead |
| `favicon.svg` | the mark, sampled from the source path onto a 13×13 dot grid |

### Run it

```sh
node test_search.mjs && node test_view.mjs && node test_sec.mjs   # all three must pass
python -m http.server 8099                   # then open localhost:8099
```

`file://` will not work — the browser blocks `fetch` on local files.

### Deploy

Push to this branch and Cloudflare Pages redeploys. *Create → Pages → Connect to Git*, pick this
repo, leave the build command empty and the output directory `/`. Every push redeploys and you
get a `*.pages.dev` URL immediately.

### Editing the CV

1. Edit `data/cv.json`. `id` is the key; `featured` lists the five shown at the top.
2. `node test_search.mjs` — fails if a `featured` id is missing or a withheld internal name
   reached the published data.
3. `node make_profile.mjs` — regenerates this file from the same JSON.
4. Push.

### Two files are deliberately not in this repository

- **`.leaklist`** — the deny-list the leak checks read at run time. It names the things this
  project refuses to publish, so committing it would publish exactly what it withholds. The
  tests fail loudly when it is absent, because a leak check that passes because its list is
  missing is not a check.
- **the source CV** — the PDF and the hand-made text extracts. `data/cv.json` is what ships.

### Not here, on purpose

- **A build step or minifier.** Minifying hides nothing: `data/cv.json` is the site and is
  readable by design. It would cost a `package.json` and a build command to obscure forty
  lines of readable code.
- **An embedding model.** The multilingual MiniLM is roughly 120 MB on first visit and needs a
  bundler. `keywords` covers the same synonyms for zero bytes.
- **A language model in the retrieval path.** Measured, not assumed: on twelve adversarial
  routing queries BM25 scored 9 and a hosted classifier 2. The classifier also lost on shipping
  grounds, since its only endpoint sat at 32% uptime.
- **A backend.** Nothing to bill, so nothing can be billed.

<sub>The profile above is generated by <code>make_profile.mjs</code> from <code>data/cv.json</code>.
Edit the JSON, not this file.</sub>
