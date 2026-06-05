/* ============================================================
   PRODUCT PHOTO SLIDER
   Scroll-snap track + arrows + dots. One instance per [data-slider].
   ============================================================ */

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
}
