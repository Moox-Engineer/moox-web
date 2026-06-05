/* ============================================================
   PRODUCT PHOTO SLIDER
   Scroll-snap track + arrows + dots + autoplay (2s, loops back
   to the first slide; holding the image pauses it).
   One instance per [data-slider].
   ============================================================ */

const AUTOPLAY_MS = 2000

export function initSlider() {
  document.querySelectorAll('[data-slider]').forEach(setupSlider)
}

function setupSlider(slider) {
  const track = slider.querySelector('[data-slider-track]')
  const prev = slider.querySelector('[data-slider-prev]')
  const next = slider.querySelector('[data-slider-next]')
  const dotsHost = slider.querySelector('[data-slider-dots]')
  const slides = track.children
  const count = slides.length

  if (count < 2) {
    prev?.remove()
    next?.remove()
    dotsHost?.remove()
    return
  }

  /* Build one dot per slide */
  const dots = Array.from({ length: count }, (_, i) => {
    const dot = document.createElement('button')
    dot.type = 'button'
    dot.className = 'slider__dot'
    dot.setAttribute('aria-label', `Foto ${i + 1} dari ${count}`)
    dot.addEventListener('click', () => goTo(i))
    dotsHost.appendChild(dot)
    return dot
  })

  function index() {
    return Math.round(track.scrollLeft / track.clientWidth)
  }

  function goTo(i) {
    const target = Math.max(0, Math.min(count - 1, i))
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' })
  }

  function updateDots() {
    const active = index()
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === active))
  }

  prev.addEventListener('click', () => goTo(index() - 1))
  next.addEventListener('click', () => goTo(index() + 1))

  /* Sync dots while scrolling (covers touch swipe too) */
  let raf = null
  track.addEventListener('scroll', () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = null
      updateDots()
    })
  }, { passive: true })

  updateDots()

  /* ── Autoplay: advance every 2s, wrap to start; hold to pause ── */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let timer = null
  let held = false
  let inView = false

  function tick() {
    if (held || document.hidden) return
    goTo((index() + 1) % count)
  }

  function startAutoplay() {
    if (timer) return
    timer = setInterval(tick, AUTOPLAY_MS)
  }

  function stopAutoplay() {
    clearInterval(timer)
    timer = null
  }

  function restartAutoplay() {
    if (!inView) return
    stopAutoplay()
    startAutoplay()
  }

  /* Manual nav (arrows/dots) resets the 2s countdown */
  prev.addEventListener('click', restartAutoplay)
  next.addEventListener('click', restartAutoplay)
  dotsHost.addEventListener('click', restartAutoplay)

  /* Press-and-hold (touch or mouse) pauses; release resumes */
  slider.addEventListener('pointerdown', () => { held = true })
  ;['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
    slider.addEventListener(ev, () => {
      if (!held) return
      held = false
      restartAutoplay() /* full 2s before the next advance */
    })
  )

  /* Only run while the slider is on screen */
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting
    if (inView) startAutoplay()
    else stopAutoplay()
  }, { threshold: 0.3 }).observe(slider)
}
