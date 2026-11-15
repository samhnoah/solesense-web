import './styles/main.css'
import { mountTest } from './test/app'

// Full-screen exhibition mode: setup with a QR code, idle and results timers.
mountTest(document.getElementById('kiosk-stage')!, { kiosk: true })
