#!/usr/bin/env node
/**
 * Menyalin dokumen internal dari folder "moox product plan" ke repo privat
 * moox-internal-docs, lalu meregenerasi halaman direktorinya dari manifest.
 *
 *   npm run sync-docs
 *   MOOX_DOCS_ROOT="/path/lain" npm run sync-docs
 *
 * Hasilnya ditulis ke DUA tempat: checkout repo privat (yang lalu di-commit
 * dan di-push) dan public/internal-doc/ di repo ini supaya bisa langsung
 * dilihat lewat `npm run dev`. Yang kedua tidak ikut git — repo ini publik,
 * dan dokumen internal tidak boleh masuk ke sana.
 *
 * Manifest sendiri tinggal di repo privat, karena judul dan catatannya pun
 * membocorkan isi. Skrip ini hanya generatornya, dan tidak menyebut satu
 * dokumen pun.
 *
 * Halaman direktori digenerate penuh setiap kali dijalankan. Jangan mengedit
 * index.html dengan tangan: ubah manifest.mjs di repo privat, lalu sync ulang.
 */

import { existsSync, statSync } from 'node:fs'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Checkout repo privat Moox-Engineer/moox-internal-docs. */
const DOCS_REPO_ROOT = resolve(
  process.env.MOOX_INTERNAL_DOCS_REPO || join(REPO_ROOT, '..', 'moox-internal-docs'),
)

if (!existsSync(join(DOCS_REPO_ROOT, 'manifest.mjs'))) {
  console.error(`Repo dokumen privat tidak ditemukan di: ${DOCS_REPO_ROOT}`)
  console.error('Clone dulu:')
  console.error('  git clone git@github.com:Moox-Engineer/moox-internal-docs.git')
  console.error('atau set MOOX_INTERNAL_DOCS_REPO ke lokasi checkout-nya.')
  process.exit(1)
}

const { CATEGORIES, DOCS } = await import(
  pathToFileURL(join(DOCS_REPO_ROOT, 'manifest.mjs')).href
)

const OUT_ROOT = join(DOCS_REPO_ROOT, 'internal-doc')
const DOCS_OUT = join(OUT_ROOT, 'docs')

/** Salinan kerja di repo ini, supaya `npm run dev` bisa membukanya. Digitignore. */
const PREVIEW_ROOT = join(REPO_ROOT, 'public', 'internal-doc')

const DOCS_ROOT =
  process.env.MOOX_DOCS_ROOT ||
  '/Users/klinikpintar/Documents/projects/moox product plan'

const IGNORED = new Set(['.DS_Store', '.git', 'node_modules'])

/* ── util ────────────────────────────────────────────────────────────── */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})

const STAMP_FMT = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

/* ── copy ────────────────────────────────────────────────────────────── */

async function copyDir(entry) {
  const from = join(DOCS_ROOT, entry.dir)
  const to = join(OUT_ROOT, 'docs', entry.dirDest)
  const include = entry.dirInclude ? new Set(entry.dirInclude) : null
  const exclude = new Set(entry.dirExclude || [])

  // Catatan: file HTML utama sengaja TIDAK diistimewakan di sini. Kalau
  // dirInclude dipakai, file itu disalin belakangan lewat copyFile() memakai
  // nama tujuan dari manifest. Menyalinnya dua kali akan menghasilkan dua
  // nama berbeda untuk dokumen yang sama di dalam satu folder.
  await cp(from, to, {
    recursive: true,
    filter: (src) => {
      const rel = src.slice(from.length + 1)
      if (!rel) return true
      const top = rel.split('/')[0]
      if (IGNORED.has(top) || rel.endsWith('/.DS_Store')) return false
      if (exclude.has(top)) return false
      if (include && !include.has(top)) return false
      return true
    },
  })
}

async function copyFile(entry) {
  const from = join(DOCS_ROOT, entry.src)
  const to = join(DOCS_OUT, entry.dest)
  await mkdir(dirname(to), { recursive: true })
  await cp(from, to)
}

/* ── build ───────────────────────────────────────────────────────────── */

async function main() {
  if (!existsSync(DOCS_ROOT)) {
    console.error(`Folder dokumen tidak ditemukan: ${DOCS_ROOT}`)
    console.error('Set MOOX_DOCS_ROOT ke lokasi folder "moox product plan".')
    process.exit(1)
  }

  const all = CATEGORIES.flatMap((c) =>
    (DOCS[c.id] || []).map((d) => ({ ...d, category: c.id })),
  )

  // Entri ber-`url` adalah tautan eksternal: tidak ada file yang disalin,
  // tidak ada ukuran maupun tanggal. Hanya entri file yang lewat tahap salin.
  const files = all.filter((d) => !d.url)

  const missing = files.filter((d) => !existsSync(join(DOCS_ROOT, d.src)))
  if (missing.length) {
    console.error('File sumber berikut tidak ditemukan:')
    for (const m of missing) console.error(`  - ${m.src}`)
    process.exit(1)
  }

  await rm(DOCS_OUT, { recursive: true, force: true })
  await mkdir(DOCS_OUT, { recursive: true })

  // Folder dulu, supaya file tetangga (styles.css, assets/, _ds/) ikut.
  for (const entry of files.filter((d) => d.dir)) await copyDir(entry)
  for (const entry of files) {
    if (!existsSync(join(DOCS_OUT, entry.dest))) await copyFile(entry)
  }

  // Metadata dibaca dari file sumber, bukan hasil salinan, supaya tanggal
  // yang tampil adalah tanggal revisi dokumen.
  for (const entry of files) {
    const st = statSync(join(DOCS_ROOT, entry.src))
    entry.size = st.size
    entry.mtime = st.mtime
  }

  const html = renderIndex(all)
  await writeFile(join(OUT_ROOT, 'index.html'), html, 'utf8')

  const total = files.reduce((n, d) => n + d.size, 0)
  const links = all.length - files.length
  console.log(
    `${files.length} dokumen tersalin (${humanSize(total)})` +
      (links ? `, ${links} tautan eksternal.` : '.'),
  )
  for (const c of CATEGORIES) {
    console.log(`  ${String((DOCS[c.id] || []).length).padStart(2)}  ${c.label}`)
  }
  // Salinan kerja lokal, supaya `npm run dev` menampilkan hasil yang sama.
  await rm(PREVIEW_ROOT, { recursive: true, force: true })
  await cp(OUT_ROOT, PREVIEW_ROOT, { recursive: true })

  console.log(`\nDirektori: ${join(OUT_ROOT, 'index.html')}`)
  publish()
}

/* ── terbitkan ke repo privat ────────────────────────────────────────── */

/**
 * Commit dan push hasil sync ke moox-internal-docs. Repo itulah yang dibaca
 * Netlify saat build, jadi perubahan yang tidak di-push tidak akan terbit.
 */
function publish() {
  const git = (...args) =>
    execFileSync('git', args, { cwd: DOCS_REPO_ROOT, encoding: 'utf8' }).trim()

  try {
    if (!git('status', '--porcelain')) {
      console.log('Repo dokumen: tidak ada perubahan, tidak ada yang di-push.')
      return
    }
    git('add', '-A')
    const n = git('diff', '--cached', '--numstat').split('\n').filter(Boolean).length
    git('commit', '-q', '-m', `Sync dokumen internal (${n} file berubah)`)
    git('push', '-q', 'origin', 'HEAD')
    console.log(`Repo dokumen: ${n} file di-push ke moox-internal-docs.`)
    console.log('Deploy Netlify berikutnya akan memuat versi ini.')
  } catch (err) {
    console.error('\nGagal push ke repo dokumen privat:')
    console.error(err.stderr || err.message)
    console.error(`Perbaiki manual di ${DOCS_REPO_ROOT}, lalu push.`)
    process.exitCode = 1
  }
}

/* ── halaman direktori ───────────────────────────────────────────────── */

function renderLink(d) {
  const host = new URL(d.url).hostname.replace(/^www\./, '')
  return `          <a class="doc doc--link" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer"
             data-search="${esc((d.title + ' ' + (d.note || '')).toLowerCase())}">
            <span class="doc__title">${esc(d.title)}</span>
            ${d.note ? `<span class="doc__note">${esc(d.note)}</span>` : ''}
            <span class="doc__meta">
              <span>Tautan eksternal</span>
              <span class="doc__dot"></span>
              <span>${esc(host)}</span>
            </span>
          </a>`
}

function renderCard(d) {
  if (d.url) return renderLink(d)
  const href = `docs/${d.dest.split('/').map(encodeURIComponent).join('/')}`
  return `          <a class="doc" href="${esc(href)}" target="_blank" rel="noopener"
             data-search="${esc((d.title + ' ' + (d.note || '')).toLowerCase())}">
            <span class="doc__title">${esc(d.title)}</span>
            ${d.note ? `<span class="doc__note">${esc(d.note)}</span>` : ''}
            <span class="doc__meta">
              <span>${humanSize(d.size)}</span>
              <span class="doc__dot"></span>
              <span>${DATE_FMT.format(d.mtime)}</span>
            </span>
          </a>`
}

function renderChip(d) {
  const href = `docs/${d.dest.split('/').map(encodeURIComponent).join('/')}`
  return `            <a class="chip" href="${esc(href)}" target="_blank" rel="noopener"
               data-search="${esc(d.title.toLowerCase())}">${esc(d.title)}</a>`
}

function renderIndex(all) {
  const fileCount = all.filter((d) => !d.url).length
  const linkCount = all.length - fileCount
  const sections = CATEGORIES.map((c) => {
    const items = all.filter((d) => d.category === c.id)
    const cards = items.filter((d) => !d.chip)
    const chips = items.filter((d) => d.chip)

    return `      <section class="cat" id="${c.id}" data-cat="${c.id}">
        <header class="cat__head">
          <h2 class="cat__title">${esc(c.label)}</h2>
          <span class="cat__count" data-count>${items.length}</span>
        </header>
        <p class="cat__blurb">${esc(c.blurb)}</p>
        <div class="grid">
${cards.map(renderCard).join('\n')}
        </div>${
          chips.length
            ? `
        <div class="chips">
          <p class="chips__label">Kartu guideline</p>
          <div class="chips__row">
${chips.map(renderChip).join('\n')}
          </div>
        </div>`
            : ''
        }
      </section>`
  }).join('\n\n')

  const nav = CATEGORIES.map(
    (c) =>
      `        <a class="jump" href="#${c.id}">${esc(c.label)} <span>${
        (DOCS[c.id] || []).length
      }</span></a>`,
  ).join('\n')

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Internal Docs · MOOX</title>
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --teal-700:#075056; --teal-800:#093E43; --teal-900:#0A3034;
  --cyan-300:#3CE0EC; --cyan-400:#00CBDC; --cyan-600:#008A97;
  --slate-50:#F4F7F8; --slate-100:#E7ECEE; --slate-300:#AEBCC1; --slate-400:#7E9097;
  --slate-500:#5C6E75; --slate-800:#232E32; --slate-900:#161F22; --slate-950:#0D1518;
  --font:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
  --radius:8px;
  --transition:200ms cubic-bezier(.4,0,.2,1);
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;scroll-padding-top:150px}
body{
  font-family:var(--font);
  background:var(--slate-950);
  color:var(--slate-50);
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
  min-height:100vh;
}
a{color:inherit;text-decoration:none}
.wrap{max-width:1120px;margin-inline:auto;padding-inline:clamp(1.25rem,4vw,3rem)}

/* header */
.top{
  position:sticky;top:0;z-index:20;
  background:rgba(13,21,24,.88);
  backdrop-filter:blur(12px);
  border-bottom:1px solid rgba(174,188,193,.12);
}
.top__row{display:flex;align-items:center;gap:1rem;padding-block:1rem;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:.75rem;margin-right:auto}
.brand img{height:24px;width:auto}
.brand__label{
  font-family:var(--mono);font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;
  color:var(--cyan-400);border-left:1px solid rgba(174,188,193,.25);padding-left:.75rem;
}
.search{
  position:relative;flex:1 1 260px;max-width:340px;
}
.search input{
  width:100%;font-family:var(--font);font-size:.875rem;color:var(--slate-50);
  background:var(--slate-900);border:1px solid rgba(174,188,193,.18);
  border-radius:var(--radius);padding:.6rem .8rem;
  transition:border-color var(--transition);
}
.search input::placeholder{color:var(--slate-500)}
.search input:focus{outline:none;border-color:var(--cyan-400)}
.logout{
  font-size:.8rem;color:var(--slate-400);padding:.5rem .8rem;border-radius:var(--radius);
  border:1px solid rgba(174,188,193,.18);transition:color var(--transition),border-color var(--transition);
}
.logout:hover{color:var(--cyan-300);border-color:var(--cyan-600)}

/* hero */
.hero{padding-block:clamp(2.5rem,6vw,4rem) 1.5rem;border-bottom:1px solid rgba(174,188,193,.1)}
.hero h1{font-size:clamp(1.9rem,4.5vw,2.75rem);font-weight:800;letter-spacing:-.02em;line-height:1.15}
.hero p{color:var(--slate-300);margin-top:.75rem;max-width:60ch;font-size:1rem}
.stamp{
  font-family:var(--mono);font-size:.72rem;color:var(--slate-500);
  margin-top:1.25rem;letter-spacing:.02em;
}
.jumps{display:flex;flex-wrap:wrap;gap:.5rem;padding-block:1.25rem}
.jump{
  font-size:.8rem;font-weight:500;padding:.4rem .75rem;border-radius:999px;
  border:1px solid rgba(174,188,193,.18);color:var(--slate-300);
  transition:all var(--transition);
}
.jump span{font-family:var(--mono);font-size:.68rem;color:var(--slate-500);margin-left:.35rem}
.jump:hover{border-color:var(--cyan-600);color:var(--cyan-300)}
.jump:hover span{color:var(--cyan-400)}

/* kategori */
main{padding-bottom:5rem}
.cat{padding-top:3rem}
.cat__head{display:flex;align-items:baseline;gap:.75rem}
.cat__title{font-size:1.25rem;font-weight:700;letter-spacing:-.01em}
.cat__count{
  font-family:var(--mono);font-size:.7rem;color:var(--cyan-400);
  border:1px solid rgba(0,203,220,.3);border-radius:999px;padding:.1rem .5rem;
}
.cat__blurb{color:var(--slate-500);font-size:.875rem;margin-top:.35rem;margin-bottom:1.25rem}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:.75rem}
.doc{
  display:flex;flex-direction:column;gap:.4rem;
  background:var(--slate-900);border:1px solid rgba(174,188,193,.12);
  border-radius:var(--radius);padding:1rem 1.1rem;
  transition:border-color var(--transition),background var(--transition),transform var(--transition);
}
.doc:hover{
  border-color:var(--cyan-600);background:var(--slate-800);transform:translateY(-1px);
}
.doc__title{font-weight:600;font-size:.95rem;line-height:1.35}
.doc:hover .doc__title{color:var(--cyan-300)}
.doc__note{color:var(--slate-400);font-size:.8rem;line-height:1.5}
.doc__meta{
  display:flex;align-items:center;gap:.5rem;margin-top:.25rem;
  font-family:var(--mono);font-size:.68rem;color:var(--slate-500);
}
.doc__dot{width:3px;height:3px;border-radius:50%;background:var(--slate-500);display:inline-block}
.doc--link .doc__title::after{
  content:'\\2197';font-family:var(--mono);font-size:.8em;color:var(--slate-500);margin-left:.35em;
}
.doc--link:hover .doc__title::after{color:var(--cyan-400)}

.chips{margin-top:1.25rem}
.chips__label{
  font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;
  color:var(--slate-500);margin-bottom:.6rem;
}
.chips__row{display:flex;flex-wrap:wrap;gap:.45rem}
.chip{
  font-size:.78rem;padding:.35rem .7rem;border-radius:999px;
  background:var(--slate-900);border:1px solid rgba(174,188,193,.12);color:var(--slate-300);
  transition:all var(--transition);
}
.chip:hover{border-color:var(--cyan-600);color:var(--cyan-300)}

.empty{
  display:none;text-align:center;color:var(--slate-500);font-size:.9rem;padding:4rem 0;
}
body.is-empty .empty{display:block}
.cat.is-hidden,.doc.is-hidden,.chip.is-hidden,.chips.is-hidden{display:none}

footer{
  border-top:1px solid rgba(174,188,193,.1);padding-block:1.75rem;
  font-family:var(--mono);font-size:.7rem;color:var(--slate-500);
  display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;
}
@media (max-width:640px){
  .brand__label{display:none}
  .search{max-width:none;order:3;flex-basis:100%}
}
</style>
</head>
<body>

<div class="top">
  <div class="wrap top__row">
    <a class="brand" href="#top">
      <img src="/moox-logo-white.png" alt="MOOX">
      <span class="brand__label">Internal Docs</span>
    </a>
    <div class="search">
      <input type="search" id="q" placeholder="Cari dokumen" aria-label="Cari dokumen" autocomplete="off">
    </div>
    <a class="logout" href="/internal-doc/logout">Keluar</a>
  </div>
</div>

<div class="wrap" id="top">
  <div class="hero">
    <h1>Dokumen Internal MOOX</h1>
    <p>Kumpulan dokumen kerja MOOX dalam format HTML: deck, laporan, wireframe, aset visual, dan design system. Semua file dibuka langsung di browser.</p>
    <p class="stamp">${fileCount} dokumen${
      linkCount ? ` · ${linkCount} tautan` : ''
    } · disinkronkan ${STAMP_FMT.format(new Date())} WIB</p>
  </div>
  <nav class="jumps">
${nav}
  </nav>
</div>

<main class="wrap">
${sections}

  <p class="empty">Tidak ada dokumen yang cocok dengan pencarian.</p>
</main>

<div class="wrap">
  <footer>
    <span>eyesonmoox.com · dokumen internal</span>
    <span>Halaman ini digenerate dari manifest. Jangan diedit manual.</span>
  </footer>
</div>

<script>
(function () {
  var q = document.getElementById('q')
  var cats = Array.prototype.slice.call(document.querySelectorAll('.cat'))

  function filter() {
    var term = q.value.trim().toLowerCase()
    var total = 0

    cats.forEach(function (cat) {
      var shown = 0
      var items = cat.querySelectorAll('[data-search]')
      Array.prototype.forEach.call(items, function (el) {
        var hit = !term || el.getAttribute('data-search').indexOf(term) !== -1
        el.classList.toggle('is-hidden', !hit)
        if (hit) shown++
      })

      var chips = cat.querySelector('.chips')
      if (chips) {
        var anyChip = chips.querySelector('.chip:not(.is-hidden)')
        chips.classList.toggle('is-hidden', !anyChip)
      }

      cat.classList.toggle('is-hidden', shown === 0)
      var badge = cat.querySelector('[data-count]')
      if (badge) badge.textContent = shown
      total += shown
    })

    document.body.classList.toggle('is-empty', total === 0)
  }

  q.addEventListener('input', filter)

  // "/" memfokuskan kolom pencarian.
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== q) {
      e.preventDefault()
      q.focus()
    }
    if (e.key === 'Escape' && document.activeElement === q) {
      q.value = ''
      filter()
      q.blur()
    }
  })
})()
</script>
</body>
</html>
`
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
