import './testing1.css'
import { initGate } from './modules/testing1-gate.js'
import { initApp } from './modules/testing1-app.js'

// Gate first (reveals the page on the correct password), then wire the store UI.
initGate()
initApp()
