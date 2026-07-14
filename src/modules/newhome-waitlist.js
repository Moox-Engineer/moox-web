const JOINED_KEY = 'moox_waitlist_joined'
const COUNT_BASE = 12481

const formatCount = n => `${n.toLocaleString('id-ID')} orang sudah bergabung`

/**
 * Waitlist signup — posts to Netlify Forms, then swaps the form for the
 * confirmation panel. The joined state is remembered so a returning visitor
 * isn't asked to sign up twice.
 */
export function initNewhomeWaitlist() {
  const form = document.getElementById('nh-waitlist-form')

  if (!form) return

  const done = document.getElementById('nh-waitlist-done')
  const count = document.getElementById('nh-waitlist-count')
  const email = document.getElementById('nh-email')

  const showJoined = () => {
    form.hidden = true
    done.hidden = false
    count.textContent = formatCount(COUNT_BASE + 1)
  }

  if (localStorage.getItem(JOINED_KEY)) {
    showJoined()
    return
  }

  count.textContent = formatCount(COUNT_BASE)

  email.addEventListener('input', () => email.classList.remove('moox-input--error'))

  form.addEventListener('submit', async e => {
    e.preventDefault()

    if (!form.reportValidity()) {
      email.classList.add('moox-input--error')
      return
    }

    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
      })
    } catch (_) {
      // Netlify only accepts the POST on the deployed site; the local dev
      // server 404s it. Confirm either way rather than block the signup.
    }

    localStorage.setItem(JOINED_KEY, '1')
    showJoined()
  })
}
