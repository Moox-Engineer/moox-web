/** MOO Axela shot switcher — thumbnails cross-fade the stage image. */
export function initNewhomeShots() {
  const root = document.getElementById('nh-shots')

  if (!root) return

  const label = document.getElementById('nh-shot-label')
  const shots = root.querySelectorAll('.nh-shots__stage img')
  const thumbs = root.querySelectorAll('.nh-thumb')

  const select = index => {
    shots.forEach(img => img.classList.toggle('is-active', img.dataset.shot === index))
    thumbs.forEach(thumb => thumb.setAttribute('aria-selected', String(thumb.dataset.shot === index)))
    const active = root.querySelector(`.nh-thumb[data-shot="${index}"]`)
    if (active && label) label.textContent = active.dataset.label
  }

  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => select(thumb.dataset.shot))
  })
}
