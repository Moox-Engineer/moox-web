import './newhome.css'
import { initReveal } from './modules/reveal.js'
import { initNewhomeVideo } from './modules/newhome-video.js'
import { initNewhomeShots } from './modules/newhome-shots.js'
import { initNewhomeWaitlist } from './modules/newhome-waitlist.js'

initNewhomeVideo()
initNewhomeShots()
initNewhomeWaitlist()
initReveal()

// "Tonton film produk" — the hero video is the film, so send the viewer to it.
document.getElementById('nh-play-film')?.addEventListener('click', () => {
  document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' })
})
