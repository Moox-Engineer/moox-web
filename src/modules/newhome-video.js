/**
 * Autoplay for the /newhome hero + POV footage.
 *
 * The design file retried play() on a 3s setInterval that never cleared. Here
 * a one-shot interaction fallback covers browsers that block muted autoplay,
 * and an observer keeps off-screen clips paused — four videos decoding at once
 * is a lot of work for a page you mostly scroll past.
 */
export function initNewhomeVideo() {
  const videos = document.querySelectorAll('video')

  if (!videos.length) return

  const play = video => {
    video.muted = true
    const attempt = video.play()
    if (attempt) attempt.catch(() => {})
  }

  // Autoplay stays blocked until the user interacts on some browsers.
  const playAll = () => videos.forEach(play)
  document.addEventListener('click', playAll, { once: true })
  document.addEventListener('touchstart', playAll, { once: true, passive: true })

  if (!('IntersectionObserver' in window)) {
    playAll()
    return
  }

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) play(entry.target)
        else entry.target.pause()
      })
    },
    { threshold: 0.2 }
  )

  videos.forEach(video => observer.observe(video))
}
