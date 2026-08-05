# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 3000 (auto-opens browser)
npm run build     # Build to dist/
npm run preview   # Preview production build locally
```

No test runner or linter is configured.

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

### Deployment

Netlify static hosting. Build output is `dist/`. Netlify Forms handles the collaboration form (`data-netlify="true"`).
