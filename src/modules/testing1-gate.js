// Soft password gate for the /testing1 preview.
//
// This is a light "keep casual visitors out" gate, NOT real security — the page
// is a static look-and-feel preview and its markup ships to the client. Real
// protection here is the noindex meta + X-Robots-Tag header (keeps it out of
// search). The password is intentionally simple and shared: MOOX.

const PASSWORD = '<dihapus dari riwayat>'
const KEY = 't1-unlocked'

export function initGate() {
  const gate = document.getElementById('t1-gate')
  const form = document.getElementById('t1-gate-form')
  const input = document.getElementById('t1-gate-input')
  const err = document.getElementById('t1-gate-err')
  if (!gate || !form) return

  // Already unlocked this session? Skip straight to the page.
  if (sessionStorage.getItem(KEY) === '1') {
    unlock(gate)
    return
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (input.value.trim() === PASSWORD) {
      sessionStorage.setItem(KEY, '1')
      unlock(gate)
    } else {
      err.hidden = false
      gate.classList.remove('is-wrong')
      // reflow so the shake animation restarts on repeated wrong tries
      void gate.offsetWidth
      gate.classList.add('is-wrong')
      input.select()
    }
  })
}

function unlock(gate) {
  document.documentElement.removeAttribute('data-t1-locked')
  gate.hidden = true
  gate.setAttribute('aria-hidden', 'true')
}
