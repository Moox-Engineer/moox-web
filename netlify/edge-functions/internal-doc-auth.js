/**
 * Gerbang password untuk /internal-doc.
 *
 * Berjalan di edge Netlify, SEBELUM file statis dilayani. Artinya tanpa cookie
 * yang sah tidak ada satu pun file di bawah /internal-doc/ yang terkirim,
 * termasuk kalau URL dokumennya ditebak atau dibagikan langsung. Ini berbeda
 * dari gerbang di sisi browser, yang hanya menyembunyikan tampilan.
 *
 * Password diambil dari environment variable INTERNAL_DOC_PASSWORD di Netlify.
 * Sengaja tidak ada nilai bawaan di file ini: repo ini publik, jadi apa pun
 * yang ditulis di sini sama saja dengan mengumumkan passwordnya. Kalau
 * variable itu hilang, gerbang menolak semua orang, bukan membuka pintu.
 *
 * Cookie menyimpan hash SHA-256 dari password, bukan passwordnya. Cookie
 * bersifat HttpOnly sehingga tidak terbaca oleh JavaScript halaman.
 */

const COOKIE_NAME = 'mx_idoc'
const MAX_AGE = 60 * 60 * 12 // 12 jam
const NOINDEX = 'noindex, nofollow, noarchive'

async function tokenFor(password) {
  const bytes = new TextEncoder().encode(`moox-internal-doc:v1:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Perbandingan yang tidak membocorkan posisi karakter lewat waktu eksekusi. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function readCookie(header, name) {
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return rest.join('=')
  }
  return null
}

/** Hanya izinkan tujuan internal di bawah /internal-doc. */
function safeNext(value) {
  if (typeof value !== 'string') return '/internal-doc/'
  if (!value.startsWith('/internal-doc')) return '/internal-doc/'
  if (value.startsWith('//')) return '/internal-doc/'
  return value
}

function loginPage(next, wrong) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${NOINDEX}">
<title>Internal Docs · MOOX</title>
<link rel="icon" href="/favicon.ico">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;
  background:#0D1518;color:#F4F7F8;line-height:1.6;
  min-height:100vh;display:grid;place-items:center;padding:1.5rem;
  -webkit-font-smoothing:antialiased;
  background-image:radial-gradient(circle at 50% 0%,rgba(7,80,86,.55),transparent 62%);
}
.card{width:100%;max-width:380px;text-align:center}
.card img{height:26px;width:auto;margin-inline:auto;display:block}
.kicker{
  font-family:'JetBrains Mono',ui-monospace,monospace;
  font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;
  color:#00CBDC;margin-top:1.5rem;
}
h1{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;margin-top:.5rem}
p.note{color:#7E9097;font-size:.875rem;margin-top:.6rem}
form{margin-top:1.75rem;display:flex;flex-direction:column;gap:.6rem}
input{
  width:100%;font-family:inherit;font-size:.95rem;color:#F4F7F8;text-align:center;
  background:#161F22;border:1px solid rgba(174,188,193,.2);border-radius:8px;
  padding:.8rem 1rem;transition:border-color 200ms cubic-bezier(.4,0,.2,1);
}
input::placeholder{color:#5C6E75}
input:focus{outline:none;border-color:#00CBDC}
button{
  width:100%;font-family:inherit;font-size:.95rem;font-weight:600;color:#04282C;
  background:#00CBDC;border:none;border-radius:8px;padding:.8rem 1rem;cursor:pointer;
  transition:background 200ms cubic-bezier(.4,0,.2,1);
}
button:hover{background:#3CE0EC}
.err{
  color:#FF8A8A;font-size:.8rem;margin-top:.9rem;
  ${wrong ? '' : 'display:none;'}
}
.foot{
  font-family:'JetBrains Mono',ui-monospace,monospace;
  font-size:.68rem;color:#46565C;margin-top:2.25rem;
}
</style>
</head>
<body>
  <div class="card">
    <img src="/moox-logo-white.png" alt="MOOX">
    <p class="kicker">Internal Docs</p>
    <h1>Halaman terbatas</h1>
    <p class="note">Masukkan password untuk membuka direktori dokumen internal MOOX.</p>
    <form method="POST" action="/internal-doc/">
      <input type="hidden" name="next" value="${next.replace(/"/g, '&quot;')}">
      <input type="password" name="password" placeholder="Password" aria-label="Password" autofocus required>
      <button type="submit">Masuk</button>
    </form>
    <p class="err">Password salah. Coba lagi.</p>
    <p class="foot">eyesonmoox.com</p>
  </div>
</body>
</html>
`
}

function misconfiguredPage() {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="${NOINDEX}">
<title>Internal Docs · MOOX</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0D1518;color:#F4F7F8;
min-height:100vh;display:grid;place-items:center;padding:1.5rem;text-align:center;line-height:1.6}
p{color:#7E9097;font-size:.875rem;margin-top:.6rem;max-width:42ch}
</style>
</head>
<body>
  <div>
    <h1>Gerbang belum dikonfigurasi</h1>
    <p>INTERNAL_DOC_PASSWORD belum diset di Netlify, jadi tidak ada dokumen yang dilayani.</p>
  </div>
</body>
</html>
`
}

function htmlResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': NOINDEX,
    },
  })
}

export default async function internalDocAuth(request, context) {
  const url = new URL(request.url)
  const password = Netlify.env.get('INTERNAL_DOC_PASSWORD')

  // Fail closed. Tanpa password yang diset, tidak ada yang boleh lewat —
  // termasuk kalau env variable-nya terhapus saat mengutak-atik Netlify.
  if (!password) {
    return htmlResponse(misconfiguredPage(), 503)
  }

  const expected = await tokenFor(password)
  const secure = url.protocol === 'https:' ? ' Secure;' : ''
  const cookieBase = `${COOKIE_NAME}=`
  const cookieOpts = `Path=/internal-doc; HttpOnly;${secure} SameSite=Lax`

  // Keluar: hapus cookie, kembali ke gerbang.
  if (url.pathname === '/internal-doc/logout') {
    return new Response(null, {
      status: 302,
      headers: {
        location: '/internal-doc/',
        'set-cookie': `${cookieBase}; ${cookieOpts}; Max-Age=0`,
        'cache-control': 'no-store',
        'x-robots-tag': NOINDEX,
      },
    })
  }

  // Pengiriman form password.
  if (request.method === 'POST') {
    let submitted = ''
    let next = '/internal-doc/'
    try {
      const form = await request.formData()
      submitted = String(form.get('password') || '')
      next = safeNext(form.get('next'))
    } catch {
      // Body bukan form: perlakukan sebagai percobaan gagal.
    }

    if (safeEqual(submitted, password)) {
      return new Response(null, {
        status: 303,
        headers: {
          location: next,
          'set-cookie': `${cookieBase}${expected}; ${cookieOpts}; Max-Age=${MAX_AGE}`,
          'cache-control': 'no-store',
          'x-robots-tag': NOINDEX,
        },
      })
    }

    return htmlResponse(loginPage(next, true), 401)
  }

  // Sudah pernah masuk.
  if (safeEqual(readCookie(request.headers.get('cookie'), COOKIE_NAME), expected)) {
    const response = await context.next()
    const headers = new Headers(response.headers)
    headers.set('x-robots-tag', NOINDEX)
    headers.set('cache-control', 'private, no-store')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }

  return htmlResponse(loginPage(safeNext(url.pathname + url.search), false), 401)
}

export const config = {
  path: ['/internal-doc', '/internal-doc/*'],
}
