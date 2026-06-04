export function initReveal() {
  const targets = document.querySelectorAll('.reveal, .reveal-child')

  if (!targets.length) return

  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-visible'))
    return
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          obs.unobserve(entry.target)
        }
      })
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px',
    }
  )

  targets.forEach(el => observer.observe(el))
}
