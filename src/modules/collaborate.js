const COUNT_KEY = 'moox_collaborate_count'

function getCount() {
  return parseInt(localStorage.getItem(COUNT_KEY) || '0', 10)
}

function incrementCount() {
  localStorage.setItem(COUNT_KEY, String(getCount() + 1))
}

export function initCollaborate() {
  const form = document.getElementById('collaborate-form')
  const thanks = document.getElementById('collaborate-thanks')
  const limit = document.getElementById('collaborate-limit')

  if (!form) return

  if (getCount() >= 3) {
    form.hidden = true
    limit.hidden = false
    return
  }

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
    form.hidden = true
    thanks.hidden = false
  })
}
