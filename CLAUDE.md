# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 3000 (auto-opens browser)
npm run build     # Build to dist/
npm run preview   # Preview production build locally
npm run sync-docs # Re-copy /internal-doc documents and regenerate its index
netlify dev       # Dev server WITH edge functions (needed to test /internal-doc)
```

No test runner or linter is configured.

`npm run dev` does not run edge functions, so `/internal-doc` is unprotected under
plain Vite. Use `netlify dev` when touching the gate.

## Architecture

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

| Path | Role |
|---|---|
| `scripts/internal-docs-manifest.mjs` | The list: category, title, note, source path, destination path. Edit this to add or remove a document. |
| `scripts/sync-internal-docs.mjs` | Copies source files into `public/internal-doc/docs/` and regenerates `public/internal-doc/index.html`. |
| `public/internal-doc/` | Generated output. Do not hand-edit `index.html`; change the manifest and re-sync. |
| `netlify/edge-functions/internal-doc-auth.js` | The password gate. |

Source documents live **outside this repo**, in the `moox product plan` folder.
`sync-docs` defaults to `/Users/klinikpintar/Documents/projects/moox product plan`
and honors `MOOX_DOCS_ROOT`. The script fails loudly if a manifest entry points
at a file that no longer exists, which is the intended way to catch renames.

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
environment variable in Netlify, falling back to a default in the file. The
cookie stores a SHA-256 hash, is `HttpOnly`, and expires after 12 hours.
`/internal-doc/logout` clears it. Routing is declared by the `config.path` export
inside the function, not in `netlify.toml`.

Kept out of search three ways: the edge function sets `X-Robots-Tag` on every
response, `public/_headers` repeats it for the path, and the index carries a
`noindex` meta. No `robots.txt` Disallow, for the reason documented in `_headers`.

### Deployment

Netlify static hosting. Build output is `dist/`. Netlify Forms handles the collaboration form (`data-netlify="true"`).
