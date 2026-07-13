/* ============================================================
   AXINA HERO — scroll-driven frame scrubber
   Draws a pre-extracted GIF frame sequence onto a <canvas>,
   advancing/reversing with scroll progress through a tall,
   sticky-pinned hero. Falls back to a single static frame
   when reduced-motion is requested.
   ============================================================ */

const FRAME_COUNT = 85
const FRAME_PATH = (i) => `/images/axina-frames/axina-${String(i).padStart(3, '0')}.jpg`

export function initAxinaScroll() {
  const hero = document.getElementById('ax-hero')
  const canvas = hero?.querySelector('[data-ax-canvas]')
  if (!hero || !canvas) return

  const ctx = canvas.getContext('2d')
  const fade = hero.querySelector('[data-ax-fade]')
  const fadeHint = hero.querySelector('[data-ax-fade-hint]')
  const scrim = hero.querySelector('[data-ax-scrim]')
  const frames = []
  let loaded = 0
  let current = -1
  let lastFade = -1
  let natW = 800
  let natH = 450

  /* Overlay copy is fully gone by this scroll fraction — before the GIF
     reaches its own baked-in text near the end. */
  const FADE_END = 0.34

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* ── Preload the frame sequence ── */
  for (let i = 0; i < FRAME_COUNT; i++) {
    const img = new Image()
    img.decoding = 'async'
    img.src = FRAME_PATH(i)
    img.onload = () => {
      if (i === 0) { natW = img.naturalWidth; natH = img.naturalHeight }
      loaded++
      if (i === 0) { resize(); draw(0) } // paint first frame ASAP
    }
    frames[i] = img
  }

  /* Canvas filter (blur) support varies on older iOS — probe once */
  const canBlur = (() => {
    try { ctx.filter = 'blur(2px)'; const ok = ctx.filter !== 'none'; ctx.filter = 'none'; return ok }
    catch (_) { return false }
  })()

  function drawCentered(img, w, h) {
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
  }

  /* Landscape viewports cover-fit (minimal crop). Portrait viewports show the
     whole landscape frame (contain — so the GIF's baked-in text is never cut)
     over an ambient backdrop of the same frame, so there are no letterbox bars. */
  function draw(index) {
    const img = frames[index]
    if (!img || !img.complete || img.naturalWidth === 0) return
    current = index

    const cw = canvas.width
    const ch = canvas.height
    ctx.clearRect(0, 0, cw, ch)

    const cover = Math.max(cw / natW, ch / natH)
    const portrait = cw / ch < 0.9

    if (portrait) {
      if (canBlur) ctx.filter = 'blur(16px)'
      drawCentered(img, natW * cover, natH * cover)
      if (canBlur) ctx.filter = 'none'
      ctx.fillStyle = canBlur ? 'rgba(13, 21, 24, 0.34)' : 'rgba(13, 21, 24, 0.55)'
      ctx.fillRect(0, 0, cw, ch)
      const contain = Math.min(cw / natW, ch / natH)
      drawCentered(img, natW * contain, natH * contain)
    } else {
      drawCentered(img, natW * cover, natH * cover)
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)
    if (current >= 0) draw(current)
  }

  /* ── Reduced motion: static first frame, no scroll tracking ── */
  if (reduced) {
    hero.classList.add('ax-hero--static')
    window.addEventListener('resize', () => { resize(); draw(0) }, { passive: true })
    return
  }

  /* ── Map scroll progress through the tall hero → frame index ── */
  function progress() {
    const rect = hero.getBoundingClientRect()
    const scrollable = hero.offsetHeight - window.innerHeight
    if (scrollable <= 0) return 0
    return Math.min(1, Math.max(0, -rect.top / scrollable))
  }

  /* Fade + drift the overlay copy out as the frames advance */
  function applyFade(p) {
    const t = Math.min(1, p / FADE_END)          // 0 → 1 across the fade zone
    const rounded = Math.round(t * 100) / 100
    if (rounded === lastFade) return
    lastFade = rounded
    const eased = t * t                           // ease-in: lingers, then leaves
    const opacity = 1 - eased
    if (fade) {
      fade.style.opacity = opacity
      fade.style.transform = `translate3d(0, ${-32 * eased}px, 0)`
      fade.style.pointerEvents = t >= 1 ? 'none' : ''
    }
    /* Fade the scrim out with the copy so the GIF's own end-text
       stays bright and readable at the bottom of the scroll. */
    if (scrim) scrim.style.opacity = opacity
    if (fadeHint) fadeHint.style.opacity = Math.max(0, 1 - t * 3)
  }

  let ticking = false
  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      const p = progress()
      const index = Math.round(p * (FRAME_COUNT - 1))
      if (index !== current) draw(index)
      applyFade(p)
    })
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', () => { resize(); onScroll() }, { passive: true })

  resize()
  onScroll()
}
