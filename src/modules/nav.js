export function initNav() {
  const nav = document.getElementById('nav')
  if (!nav) return

  const SCROLL_THRESHOLD = 60

  function update() {
    if (window.scrollY > SCROLL_THRESHOLD) {
      nav.classList.add('nav--scrolled')
    } else {
      nav.classList.remove('nav--scrolled')
    }
  }

  let ticking = false
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        update()
        ticking = false
      })
      ticking = true
    }
  }, { passive: true })

  update()
}
