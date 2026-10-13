# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 3000 (auto-opens browser)
npm run build     # Build to dist/
npm run preview   # Preview production build locally
npm run sync-docs # Re-copy /internal-doc documents, regenerate its index,
                  # and push the private docs repo
netlify dev       # Dev server WITH edge functions (needed to test /internal-doc)
```

No test runner or linter is configured.

`npm run dev` does not run edge functions, so `/internal-doc` is unprotected under
plain Vite. Use `netlify dev` when touching the gate.

## Architecture

> **Not production anymore.** Since late Sep 2026 eyesonmoox.com is served by
> `Moox-Engineer/moox-web-new` (React + Vite, Cloudflare Workers, deploys from its
> `prod` branch). This repo still deploys to `mooxweb.netlify.app` only. Changes
> meant for the live site belong in moox-web-new.

**moox-web** is a vanilla JavaScript marketing site for MOOX smart glasses, built with Vite. There is no framework (no React, Vue, or TypeScript) — just `index.html`, modular JS, and a CSS design system.

### Entry points

- `index.html` — single HTML page with all content hardcoded; semantic sections: `.hero`, `.manifesto`, `.products`, `.why`, `.collaborate`
- `src/main.js` — imports and calls `init*()` from each module
- `src/style.css` — full design system (~1100 lines); uses CSS custom properties and BEM naming

### Modules (`src/modules/`)

Each module exports a single `init*()` function called from `main.js`:

| File | Purpose |
|---|---|
| `nav.js` | Adds `nav--scrolled` class to `<header>` when `scrollY > 60px` |
| `reveal.js` | IntersectionObserver that adds `is-visible` to `.reveal` / `.reveal-child` elements |
| `slider.js` | Scroll-snap carousel with autoplay (2s), dot indicators, touch support, pauses when off-screen or reduced-motion |
| `collaborate.js` | Collaboration form — POST to Netlify, tracks submissions in `localStorage` (hides CTA after 3) |

### Static assets

All images live in `public/images/`. Three product lines: `akasa-*`, `axela-*`, `asina-*`. No environment variables or external APIs — the only network call is the Netlify form POST to `/`.

### `/internal-doc` — password-gated document directory

A directory of MOOX internal working documents (decks, reports, wireframes,
visual assets, design system), served as plain HTML files.

**This repo is public. No internal document, and nothing that names one, lives
in it.** The documents and the manifest that lists their titles live in the
private repo `Moox-Engineer/moox-internal-docs`. Only the generator — which
mentions no document at all — stays here.

| Path | Role |
|---|---|
| `moox-internal-docs/manifest.mjs` (private repo) | The list: category, title, note, source path, destination path. Edit this to add or remove a document. |
| `moox-internal-docs/internal-doc/` (private repo) | Generated output that ships to production. Do not hand-edit `index.html`; change the manifest and re-sync. |
| `scripts/sync-internal-docs.mjs` | Reads the manifest, copies source files, regenerates the index, then commits and pushes the private repo. |
| `scripts/fetch-internal-docs.mjs` | Runs at build time. Clones the private repo with a read-only deploy key and drops `internal-doc/` into `public/`. |
| `public/internal-doc/` | Local working copy only. Gitignored — never commit it. |
| `netlify/edge-functions/internal-doc-auth.js` | The password gate. |

Two source locations, and they are different things. The **documents** come from
the `moox product plan` folder, outside any repo: `sync-docs` defaults to
`/Users/klinikpintar/Documents/projects/moox product plan` and honors
`MOOX_DOCS_ROOT`. The **manifest** comes from the private repo checkout, expected
at `../moox-internal-docs` and overridable with `MOOX_INTERNAL_DOCS_REPO`. Both
scripts fail loudly rather than quietly producing an empty directory — a manifest
entry pointing at a renamed file stops the sync, and a Netlify build without
`INTERNAL_DOCS_DEPLOY_KEY` stops the build.

`npm run sync-docs` writes to both places: the private repo (committed and
pushed for you) and `public/internal-doc/` (so `npm run dev` shows the same
thing). Pushing the private repo does not by itself trigger a deploy — Netlify
builds from *this* repo, so the new documents land on the next `moox-web`
deploy or a manually triggered one.

Some documents depend on sibling files (`styles.css`, `assets/`, `_ds/`,
`support.js`). Those entries carry a `dir` field so the whole folder is copied
with relative paths intact. `dirInclude` / `dirExclude` trim what comes along.

A manifest entry with a `url` field is an **external link** instead of a copied
file — nothing is fetched or mirrored, and the card shows the host in place of
size and date. That is how the `Website Kacamatamoo` category (preview, repo,
PRD, PIC sheet) is wired.

**The gate** is a Netlify Edge Function, so it runs before any static file is
served: without a valid cookie, no document under `/internal-doc/` is delivered,
even via a direct or shared URL. Password comes from the `INTERNAL_DOC_PASSWORD`
environment variable in Netlify. There is deliberately no default in the file:
this repo is public, so a fallback password would be a published one. With the
variable unset the gate returns 503 and serves nothing, rather than opening. The
cookie stores a SHA-256 hash, is `HttpOnly`, and expires after 12 hours.
`/internal-doc/logout` clears it. Routing is declared by the `config.path` export
inside the function, not in `netlify.toml`.

Kept out of search three ways: the edge function sets `X-Robots-Tag` on every
response, `public/_headers` repeats it for the path, and the index carries a
`noindex` meta. No `robots.txt` Disallow, for the reason documented in `_headers`.

### Deployment

Netlify static hosting (project `mooxweb`, `mooxweb.netlify.app`; no longer
`eyesonmoox.com`, see the note at the top). No Google Analytics tag here: the
GA4 stream belongs to the live site, and this copy would pollute it. Build output is
`dist/`; the build command is `npm run build:netlify`, which fetches the internal
documents before running Vite. Netlify Forms handles the collaboration form
(`data-netlify="true"`).

This repo is public specifically so Netlify's free plan will keep deploying it —
the free plan refuses continuous deployment from an organization-owned *private*
repo, which is what forced the document split described above. Two environment
variables in Netlify make it work: `INTERNAL_DOC_PASSWORD` and
`INTERNAL_DOCS_DEPLOY_KEY` (base64 of an OpenSSH private key whose public half is
a read-only deploy key on `moox-internal-docs`). Losing either breaks
`/internal-doc` loudly, not silently.
