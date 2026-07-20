// Kacamatamoo store UI — ported from the DCLogic component in
// "Kacamatamoo Home.dc.html". Renders the data-driven grids and wires every
// interaction (hero rotator, cart + toast, wishlist, lens tabs, virtual
// try-on, order tracking). Pure vanilla JS, no framework.

const U = '/testing1/uploads/'
const TEAL = '#42b3ac'
const DARK = '#1c4744'

/* ---------- data ---------- */

const MARQUEE = [
  '💚 GRATIS ONGKIR SELURUH INDONESIA',
  '👓 FREE EYE EXAM DI 78 TOKO',
  '🔄 GARANSI 30 HARI',
  '💳 QRIS · VA · E-WALLET',
  '⭐ 4.9 DARI 163RB REVIEW',
]

const HERO_WORDS = ['checkout di sini.', 'gratis ongkir 🚚', 'dicoba dulu 🤳']

const USPS = [
  { icon: '🚚', title: 'Gratis Ongkir', sub: 'Seluruh Indonesia' },
  { icon: '👓', title: 'Free Eye Exam', sub: 'Di 78 toko offline' },
  { icon: '🔄', title: 'Garansi 30 Hari', sub: 'Klaim langsung di web' },
  { icon: '💳', title: 'QRIS & E-Wallet', sub: 'Bayar sekali tap' },
]

const CATS = [
  { name: 'Frames', count: '400+ model siap pasang lensa resep', icon: '👓', chip: 'PALING DICARI', img: 'model-6.webp', pos: 'center 20%', zoom: 'cover', shade: 'rgba(28,71,68,.85)', col: '1 / span 2', row: '1 / span 2', size: '30px', cls: 't1-cat--frames' },
  { name: 'Clip On', count: 'kacamata + sunnies 2-in-1', icon: '🕶️', chip: 'BUAT OUTDOOR', img: 'model-5.webp', pos: 'center 12%', zoom: 'auto 160%', shade: 'rgba(30,125,119,.85)', col: '3', row: '1 / span 2', size: '24px' },
  { name: 'Kids', count: 'lentur & anti patah', icon: '🎈', chip: 'SI KECIL', img: 'anak-1.webp', pos: 'center 14%', zoom: 'cover', shade: 'rgba(226,140,40,.8)', col: '4', row: '1', size: '22px' },
  { name: 'LENSMOO', count: 'softlens warna', icon: '✨', chip: 'MOOD MATA', img: 'model-1.webp', pos: 'center 55%', zoom: '140%', shade: 'rgba(200,60,115,.8)', col: '4', row: '2', size: '22px' },
]

const PERSONAS = [
  { name: 'Bold & Statement', sub: 'Frame tebal, bikin noticed', img: 'pasted-1784546448118-0.png', pos: 'center 22%', shade: 'rgba(28,71,68,.82)' },
  { name: 'Minimal & Rimless', sub: 'Ringan, clean, kerja mode', img: 'pasted-1784546393687-0.png', pos: 'center 20%', shade: 'rgba(30,125,119,.82)' },
  { name: 'Retro Playful', sub: 'Tortoise & warna hangat', img: 'pasted-1784546358813-0.png', pos: 'center 18%', shade: 'rgba(200,60,115,.78)' },
  { name: 'Classic Pro', sub: 'Timeless buat sehari-hari', img: 'pasted-1784546552577-0.png', pos: 'center 22%', shade: 'rgba(122,83,0,.8)' },
]

const ZDEF = '145%'
const FLAT = { z: '82%', pos: 'center 52%' }
const PRODS = [
  { name: 'Retro Oval', cat: 'Frame Oval · Tortoise', price: 'Rp229.000', tag: 'BEST SELLER', tagBg: '#e2568b', img: 'pasted-1784546851291-0.png', ...FLAT },
  { name: 'Kotak Klasik', cat: 'Frame Kotak · Black', price: 'Rp199.000', tag: 'NEW', tagBg: TEAL, img: 'pasted-1784546878993-0.png', ...FLAT },
  { name: 'Bold Square', cat: 'Frame Kotak · Gold Rivet', price: 'Rp269.000', tag: 'HYPE', tagBg: '#7a6ff0', img: 'pasted-1784546904894-0.png', ...FLAT },
  { name: 'Navy Wayfarer', cat: 'Frame Kotak · Navy', price: 'Rp259.000', tag: 'PROMO', tagBg: '#f2a83b', img: 'pasted-1784546958817-0.png', ...FLAT },
  { name: 'Round Gradasi', cat: 'Frame Bulat · Smoke Fade', price: 'Rp289.000', tag: 'FAVORIT', tagBg: '#1e7d77', img: 'pasted-1784547000051-0.png', ...FLAT },
  { name: 'CatEye Raya Tortoise', cat: 'Frame Cat Eye · CE HA14677', price: 'Rp249.000', tag: 'ICONIC', tagBg: '#e2568b', img: 'km-1.webp', pos: 'center 60%', z: ZDEF },
  { name: 'LENSMOO Mallow Gray', cat: 'Softlens · 14.2mm', price: 'Rp40.000', tag: 'LENSMOO', tagBg: '#e2568b', img: 'model-2.webp', pos: 'center 30%', z: ZDEF },
  { name: 'Lensa Bluecromic', cat: 'Lensa · Online Exclusive', price: 'Rp300.000', tag: 'ONLINE ONLY', tagBg: DARK, img: 'product-4.webp', pos: 'center 60%', z: '118%' },
]

const LENS = [
  { title: 'Blueray', desc: 'Nangkis sinar biru dari layar HP & laptop. Wajib buat yang kerja depan layar seharian.', price: 'Rp180.000', img: 'product-4.webp', badge: 'Anti radiasi layar' },
  { title: 'Photocromic', desc: 'Bening di dalam ruangan, otomatis gelap pas kena matahari. Dua kacamata dalam satu.', price: 'Rp300.000', img: 'product-4.webp', badge: 'Efek gelap otomatis' },
  { title: 'CRMC', desc: 'Lensa paling bening dengan pantulan minim — hasil foto tetap kece tanpa silau.', price: 'Rp300.000', img: 'product-3.webp', badge: 'Lebih bening, minim pantulan' },
]

const PACKS = [
  { name: 'Anti Radiasi Layar', use: 'Buat yang seharian depan laptop', price: 'mulai Rp180rb', img: 'pasted-1784546517503-0.png', pos: 'center 20%', tint: '#e6f2f0', chip: 'BLUERAY' },
  { name: 'Harian Bening', use: 'Jernih maksimal, minim pantulan', price: 'mulai Rp300rb', img: 'pasted-1784546486413-0.png', pos: 'center 22%', tint: '#fbdce9', chip: 'CRMC' },
  { name: 'Gelap Otomatis', use: 'Indoor bening, outdoor jadi sunnies', price: 'mulai Rp300rb', img: 'pasted-1784546466845-0.png', pos: 'center 20%', tint: '#e2ddf7', chip: 'PHOTOCROMIC' },
  { name: 'Nyetir Malam', use: 'Kurangi silau lampu, aman di jalan', price: 'mulai Rp350rb', img: 'pasted-1784546536998-0.png', pos: 'center 22%', tint: '#ffedbe', chip: 'NIGHT DRIVE' },
]

const FRAMES = [
  { name: 'Tortoise', img: 'km-1.webp', price: 'Rp249.000' },
  { name: 'Black', img: 'km-2.webp', price: 'Rp249.000' },
  { name: 'Olive', img: 'km-3.webp', price: 'Rp249.000' },
  { name: 'Clear', img: 'km-4.webp', price: 'Rp249.000' },
]

const TESTI = [
  { text: '"Pemasangan lensa ke frame-nya pas & rapih banget. Ga nyesel beli."', who: 'Nadia P.', tag: 'CatEye Raya', img: 'pasted-1784546486413-0.png', pos: 'center 20%' },
  { text: '"Beli buat self reward, eh malah jadi incaran satu kantor 😆"', who: 'Bagas W.', tag: 'Kotak Klasik', img: 'pasted-1784546552577-0.png', pos: 'center 22%' },
  { text: '"Checkout pagi, sorenya sampai. Gratis ongkir pula, gila sih."', who: 'Rara S.', tag: 'Bluecromic', img: 'pasted-1784546393687-0.png', pos: 'center 18%' },
  { text: '"Rimless-nya ringan banget, lupa lagi pake kacamata. Mantap."', who: 'Damar A.', tag: 'Round Gradasi', img: 'pasted-1784546536998-0.png', pos: 'center 18%' },
]

const STEPS = [
  { icon: '✅', title: 'Pesanan dibuat', time: '19 Jul, 10:22', done: true },
  { icon: '📦', title: 'Dikemas', time: '19 Jul, 13:05', done: true },
  { icon: '🚚', title: 'Dalam pengiriman', time: '20 Jul, 08:41', done: true, active: true },
  { icon: '🏠', title: 'Tiba di kamu', time: 'estimasi 21 Jul', done: false },
]

/* ---------- state ---------- */

const state = { cart: 0, wish: {}, lensIdx: 0, tryIdx: 0, cam: false, heroIdx: 0 }
let toastTimer

/* ---------- helpers ---------- */

const $ = (id) => document.getElementById(id)

function toast(msg) {
  const el = $('t1-toast')
  const m = $('t1-toast-msg')
  if (!el) return
  m.textContent = msg
  el.hidden = false
  el.style.animation = 'none'
  void el.offsetWidth
  el.style.animation = ''
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { el.hidden = true }, 2200)
}

function addCart(name) {
  state.cart += 1
  renderCart()
  toast(name + ' masuk tas! ✨')
}

function renderCart() {
  const badge = $('t1-cart-badge')
  if (!badge) return
  badge.textContent = state.cart
  badge.hidden = state.cart === 0
  if (state.cart > 0) {
    badge.style.animation = 'none'
    void badge.offsetWidth
    badge.style.animation = ''
  }
}

/* ---------- renderers ---------- */

export function initApp() {
  renderMarquee()
  renderUsps()
  renderCats()
  renderPersonas()
  renderProds()
  renderLensTabs()
  renderLens()
  renderPacks()
  renderTryFrames()
  renderTryStage()
  renderTesti()
  wireHero()
  wireCart()
  wireTryon()
  wireTrack()
}

function renderMarquee() {
  const track = $('t1-ann-track')
  if (!track) return
  const items = [...MARQUEE, ...MARQUEE] // 2x for seamless loop
  track.innerHTML = items.map((m) => `<span>${m}</span>`).join('')
}

function renderUsps() {
  const el = $('t1-usp')
  if (!el) return
  el.innerHTML = USPS.map((u) => `
    <div class="t1-usp__card">
      <span class="t1-usp__ic">${u.icon}</span>
      <div>
        <div class="t1-usp__t">${u.title}</div>
        <div class="t1-usp__s">${u.sub}</div>
      </div>
    </div>`).join('')
}

function renderCats() {
  const el = $('t1-cats')
  if (!el) return
  el.innerHTML = CATS.map((c) => `
    <a href="#belanja" class="t1-cat ${c.cls || ''}" style="grid-column:${c.col};grid-row:${c.row}">
      <div class="t1-cat__bg" style="background-image:url('${U}${c.img}');background-size:${c.zoom};background-position:${c.pos}"></div>
      <div class="t1-cat__shade" style="background:linear-gradient(to top,${c.shade} 0%,rgba(0,0,0,0) 55%)"></div>
      <span class="t1-cat__chip">${c.icon} ${c.chip}</span>
      <div class="t1-cat__foot">
        <div>
          <div class="t1-cat__name" style="font-size:${c.size}">${c.name}</div>
          <div class="t1-cat__count">${c.count}</div>
        </div>
        <span class="t1-cat__go">→</span>
      </div>
    </a>`).join('')
}

function renderPersonas() {
  const el = $('t1-personas')
  if (!el) return
  el.innerHTML = PERSONAS.map((p) => `
    <a href="#belanja" class="t1-persona">
      <div class="t1-persona__bg" style="background-image:url('${U}${p.img}');background-position:${p.pos}"></div>
      <div class="t1-persona__shade" style="background:linear-gradient(to top,${p.shade} 4%,rgba(0,0,0,0) 52%)"></div>
      <div class="t1-persona__copy">
        <div class="t1-persona__name">${p.name}</div>
        <div class="t1-persona__sub">${p.sub}</div>
        <span class="t1-persona__go">Lihat frame →</span>
      </div>
    </a>`).join('')
}

function renderProds() {
  const el = $('t1-prods')
  if (!el) return
  el.innerHTML = PRODS.map((p, i) => `
    <div class="t1-prod">
      <div class="t1-prod__media" style="background-image:url('${U}${p.img}');background-size:${p.z};background-position:${p.pos}">
        <span class="t1-prod__tag" style="background:${p.tagBg}">${p.tag}</span>
        <button type="button" class="t1-prod__wish" data-wish="${i}" aria-label="Wishlist">🤍</button>
      </div>
      <div class="t1-prod__body">
        <div class="t1-prod__name">${p.name}</div>
        <div class="t1-prod__cat">${p.cat}</div>
        <div class="t1-prod__foot">
          <div class="t1-prod__price">${p.price}</div>
          <button type="button" class="t1-prod__add" data-add="${i}">+ Tas</button>
        </div>
      </div>
    </div>`).join('')

  el.querySelectorAll('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => addCart(PRODS[+btn.dataset.add].name))
  })
  el.querySelectorAll('[data-wish]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.wish
      state.wish[i] = !state.wish[i]
      btn.textContent = state.wish[i] ? '❤️' : '🤍'
      if (state.wish[i]) toast(PRODS[i].name + ' masuk wishlist 🤍→❤️')
    })
  })
}

function renderLensTabs() {
  const el = $('t1-lenstabs')
  if (!el) return
  el.innerHTML = LENS.map((l, i) => `
    <button type="button" class="t1-lenstab${i === state.lensIdx ? ' is-active' : ''}" data-lens="${i}">${l.title}</button>`).join('')
  el.querySelectorAll('[data-lens]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.lensIdx = +btn.dataset.lens
      el.querySelectorAll('.t1-lenstab').forEach((b, i) => b.classList.toggle('is-active', i === state.lensIdx))
      renderLens()
    })
  })
}

function renderLens() {
  const l = LENS[state.lensIdx]
  $('t1-lens-title').textContent = l.title
  $('t1-lens-desc').textContent = l.desc
  $('t1-lens-price').textContent = l.price
  $('t1-lens-badge').textContent = l.badge
  $('t1-lens-media').style.backgroundImage = `url('${U}${l.img}')`
}

function renderPacks() {
  const el = $('t1-packs')
  if (!el) return
  el.innerHTML = PACKS.map((p, i) => `
    <div class="t1-pack">
      <div class="t1-pack__media" style="background-color:${p.tint};background-image:url('${U}${p.img}');background-position:${p.pos}">
        <span class="t1-pack__chip">${p.chip}</span>
      </div>
      <div class="t1-pack__body">
        <div class="t1-pack__name">${p.name}</div>
        <div class="t1-pack__use">${p.use}</div>
        <div class="t1-pack__foot">
          <div class="t1-pack__price">${p.price}</div>
          <button type="button" class="t1-pack__add" data-pack="${i}">Pilih paket</button>
        </div>
      </div>
    </div>`).join('')
  el.querySelectorAll('[data-pack]').forEach((btn) => {
    btn.addEventListener('click', () => addCart('Paket ' + PACKS[+btn.dataset.pack].name))
  })
}

function renderTryFrames() {
  const el = $('t1-tryon-swatches')
  if (!el) return
  el.innerHTML = FRAMES.map((f, i) => `
    <button type="button" class="t1-swatch${i === state.tryIdx ? ' is-active' : ''}" data-try="${i}">
      <span class="t1-swatch__chip" style="background-image:url('${U}${f.img}')"></span>
      <span class="t1-swatch__name">${f.name}</span>
    </button>`).join('')
  el.querySelectorAll('[data-try]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tryIdx = +btn.dataset.try
      state.cam = false
      el.querySelectorAll('.t1-swatch').forEach((b, i) => b.classList.toggle('is-active', i === state.tryIdx))
      renderTryStage()
    })
  })
}

function renderTryStage() {
  const f = FRAMES[state.tryIdx]
  const frame = $('t1-tryon-frame')
  const cam = $('t1-tryon-cam')
  const camTag = $('t1-tryon-camtag')
  const camBtn = $('t1-cam-toggle')
  const addBtn = $('t1-tryon-add')
  frame.style.backgroundImage = `url('${U}${f.img}')`
  frame.hidden = state.cam
  cam.hidden = !state.cam
  camTag.textContent = `frame ${f.name} nempel di wajahmu ✨`
  camBtn.textContent = state.cam ? '⏹ Matikan Kamera' : '📷 Nyalakan Kamera'
  addBtn.textContent = `+ Masukkan Tas · ${f.price}`
}

function renderTesti() {
  const el = $('t1-testi')
  if (!el) return
  el.innerHTML = TESTI.map((q) => `
    <div class="t1-quote">
      <div class="t1-quote__bg" style="background-image:url('${U}${q.img}');background-position:${q.pos}"></div>
      <div class="t1-quote__shade"></div>
      <div class="t1-quote__play">▶</div>
      <span class="t1-quote__tag">${q.tag}</span>
      <div class="t1-quote__copy">
        <div class="t1-quote__stars">★★★★★</div>
        <div class="t1-quote__text">${q.text}</div>
        <div class="t1-quote__who">${q.who}</div>
      </div>
    </div>`).join('')
}

/* ---------- interactions ---------- */

function wireHero() {
  const el = $('t1-hero-rotate')
  if (!el) return
  setInterval(() => {
    state.heroIdx = (state.heroIdx + 1) % HERO_WORDS.length
    el.textContent = HERO_WORDS[state.heroIdx]
    el.classList.remove('is-anim')
    void el.offsetWidth
    el.classList.add('is-anim')
  }, 2600)
}

function wireCart() {
  const cart = $('t1-cart')
  if (!cart) return
  cart.addEventListener('click', () => {
    cart.classList.remove('is-shake')
    void cart.offsetWidth
    cart.classList.add('is-shake')
    toast(state.cart > 0 ? 'Tas kamu: ' + state.cart + ' item 🛍️' : 'Tas masih kosong, bestie 🥺')
  })
}

function wireTryon() {
  const camBtn = $('t1-cam-toggle')
  const addBtn = $('t1-tryon-add')
  camBtn?.addEventListener('click', () => {
    state.cam = !state.cam
    renderTryStage()
  })
  addBtn?.addEventListener('click', () => addCart('CatEye Raya ' + FRAMES[state.tryIdx].name))
}

function wireTrack() {
  const form = $('t1-track-form')
  const stepsEl = $('t1-track-steps')
  if (!form) return
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    stepsEl.innerHTML = STEPS.map((s) => {
      const lineBg = s.done ? TEAL : '#e3ebe9'
      const dotBg = s.active ? '#ffd66b' : s.done ? TEAL : '#eef3f2'
      const ring = s.active ? '#f2a83b' : s.done ? TEAL : '#e3ebe9'
      const titleColor = s.done ? DARK : '#9aa8a6'
      return `
        <div class="t1-step">
          <div class="t1-step__line" style="background:${lineBg}"></div>
          <div class="t1-step__dot" style="background:${dotBg};box-shadow:0 0 0 2px ${ring}">${s.icon}</div>
          <div class="t1-step__title" style="color:${titleColor}">${s.title}</div>
          <div class="t1-step__time">${s.time}</div>
        </div>`
    }).join('')
    stepsEl.hidden = false
    stepsEl.style.animation = 'none'
    void stepsEl.offsetWidth
    stepsEl.style.animation = ''
    toast('Ketemu! Pesananmu lagi di jalan 🚚')
  })
}
