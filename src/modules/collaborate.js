const COUNT_KEY = 'moox_collaborate_count'

function getCount() {
  return parseInt(localStorage.getItem(COUNT_KEY) || '0', 10)
}

function incrementCount() {
  localStorage.setItem(COUNT_KEY, String(getCount() + 1))
}

export function initCollaborate() {
  const cta = document.getElementById('collaborate-cta')
  const openBtn = document.getElementById('collaborate-open')
  const closeBtn = document.getElementById('collaborate-close')
  const formWrap = document.getElementById('collaborate-form-wrap')
  const form = document.getElementById('collaborate-form')
  const confirm = document.getElementById('collaborate-confirm')

  if (!form) return

  if (getCount() >= 3) {
    cta.hidden = true
    confirm.hidden = false
    return
  }

  openBtn.addEventListener('click', () => {
    cta.hidden = true
    formWrap.classList.add('is-open')
    setTimeout(() => {
      formWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 50)
  })

  closeBtn.addEventListener('click', () => {
    formWrap.classList.remove('is-open')
    cta.hidden = false
  })

  form.addEventListener('submit', async e => {
    e.preventDefault()

    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      })
    } catch (_) {}

    incrementCount()
    formWrap.classList.remove('is-open')
    cta.hidden = true
    confirm.hidden = false
  })
}
