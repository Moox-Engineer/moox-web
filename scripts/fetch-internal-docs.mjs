#!/usr/bin/env node
/**
 * Mengambil isi /internal-doc dari repo privat saat build.
 *
 * Dokumen internal MOOX sengaja TIDAK disimpan di repo ini, karena repo ini
 * publik. Dokumen dan manifest yang menyebut judul-judulnya tinggal di
 * Moox-Engineer/moox-internal-docs yang privat. Skrip ini meng-clone repo itu
 * memakai deploy key read-only, lalu menyalin folder internal-doc/-nya ke
 * public/internal-doc/ supaya ikut terbawa Vite ke dist/.
 *
 * Di Netlify: deploy key dibaca dari environment variable
 * INTERNAL_DOCS_DEPLOY_KEY (private key OpenSSH, disandikan base64).
 *
 * Di laptop: kalau variable itu tidak ada, skrip memakai checkout lokal repo
 * privat kalau ada, dan kalau tidak ada pun build tetap jalan — hanya
 * /internal-doc yang kosong. Itu disengaja supaya `npm run build` tidak
 * menuntut kredensial hanya untuk memeriksa halaman depan.
 */

import { existsSync } from 'node:fs'
import { chmod, cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(REPO_ROOT, 'public', 'internal-doc')

const DOCS_REPO =
  process.env.INTERNAL_DOCS_REPO_URL ||
  'git@github.com:Moox-Engineer/moox-internal-docs.git'

const LOCAL_CHECKOUT =
  process.env.MOOX_INTERNAL_DOCS_REPO || join(REPO_ROOT, '..', 'moox-internal-docs')

const onNetlify = Boolean(process.env.NETLIFY)

/** Salin <sumber>/internal-doc ke public/internal-doc, menimpa yang lama. */
async function install(from) {
  const src = join(from, 'internal-doc')
  if (!existsSync(join(src, 'index.html'))) {
    throw new Error(`Tidak ada internal-doc/index.html di ${from}`)
  }
  await rm(OUT, { recursive: true, force: true })
  await cp(src, OUT, { recursive: true })
}

async function fromDeployKey(keyB64) {
  const dir = await mkdtemp(join(tmpdir(), 'moox-idoc-'))
  const keyPath = join(dir, 'id_ed25519')
  const key = Buffer.from(keyB64, 'base64').toString('utf8')
  await writeFile(keyPath, key.endsWith('\n') ? key : key + '\n', 'utf8')
  await chmod(keyPath, 0o600)

  const clone = join(dir, 'repo')
  const base = `ssh -i ${keyPath} -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=20`

  // Sebagian jaringan build memblokir port 22. GitHub melayani SSH yang sama
  // di ssh.github.com:443, jadi kalau yang pertama gagal, dicoba lewat sana
  // sebelum menyerah.
  const attempts = [
    { label: 'port 22', ssh: base },
    { label: 'port 443', ssh: `${base} -o Hostname=ssh.github.com -o Port=443` },
  ]

  let lastError
  for (const attempt of attempts) {
    try {
      execFileSync('git', ['clone', '--depth', '1', '--quiet', DOCS_REPO, clone], {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, GIT_SSH_COMMAND: attempt.ssh, GIT_TERMINAL_PROMPT: '0' },
      })
      lastError = null
      break
    } catch (err) {
      lastError = err
      console.warn(`internal-doc: clone lewat ${attempt.label} gagal.`)
      await rm(clone, { recursive: true, force: true })
    }
  }
  if (lastError) throw lastError

  try {
    await install(clone)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function main() {
  const keyB64 = process.env.INTERNAL_DOCS_DEPLOY_KEY

  if (keyB64) {
    await fromDeployKey(keyB64)
    console.log('internal-doc: diambil dari repo privat lewat deploy key.')
    return
  }

  // Tanpa deploy key. Di Netlify ini selalu salah: build akan menghasilkan
  // situs tanpa dokumen sama sekali, dan itu lebih baik digagalkan sekarang
  // daripada diam-diam terbit.
  if (onNetlify) {
    console.error(
      'internal-doc: INTERNAL_DOCS_DEPLOY_KEY belum diset di Netlify.\n' +
        'Tanpa itu dokumen internal tidak bisa diambil dan /internal-doc akan kosong.',
    )
    process.exit(1)
  }

  if (existsSync(join(LOCAL_CHECKOUT, 'internal-doc', 'index.html'))) {
    await install(LOCAL_CHECKOUT)
    console.log(`internal-doc: disalin dari checkout lokal ${LOCAL_CHECKOUT}`)
    return
  }

  console.warn(
    `internal-doc: dilewati — tidak ada deploy key maupun checkout di ${LOCAL_CHECKOUT}.\n` +
      'Build tetap jalan, tapi /internal-doc akan kosong.',
  )
}

main().catch((err) => {
  console.error('internal-doc: gagal mengambil dokumen.')
  console.error(err.message)
  process.exit(1)
})
