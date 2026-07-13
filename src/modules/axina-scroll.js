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
  const frames = []
  let loaded = 0
  let current = -1
  let natW = 800
  let natH = 450

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

  /* ── Cover-fit draw of one frame onto the DPR-scaled canvas ── */
  function draw(index) {
    const img = frames[index]
    if (!img || !img.complete || img.naturalWidth === 0) return
    current = index

    const cw = canvas.width
    const ch = canvas.height
    const scale = Math.max(cw / natW, ch / natH)
    const dw = natW * scale
    const dh = natH * scale
    const dx = (cw - dw) / 2
    const dy = (ch - dh) / 2
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, dx, dy, dw, dh)
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

  let ticking = false
  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      const index = Math.round(progress() * (FRAME_COUNT - 1))
      if (index !== current) draw(index)
    })
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', () => { resize(); onScroll() }, { passive: true })

  resize()
  onScroll()
}
