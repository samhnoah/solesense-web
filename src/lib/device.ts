// One source of force readings for the test, whether they come from the
// simulated device or from a real SoleSense over Bluetooth Low Energy (BLE).
// The matching firmware contract is in docs/BLE_PROTOCOL.md.
import { reactive } from 'vue'

export const BLE_SERVICE = '7a0e0001-5c1b-4f6e-9d3a-50a1e5e25e00'
export const BLE_FORCE_CHAR = '7a0e0002-5c1b-4f6e-9d3a-50a1e5e25e00'

export const TARGET_GF = 10
export const TOLERANCE_GF = 1.5
export const HOLD_MS = 1000
export const GAUGE_MAX_GF = 15

export const device = reactive({
  mode: 'sim' as 'sim' | 'ble',
  /** Latest force in gram-force. */
  force: 0,
  name: '',
  connecting: false,
  error: '' as '' | 'unsupported' | 'failed',
  simBusy: false,
})

export const bleSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator

let gatt: BluetoothRemoteGATTServer | null = null
let raf = 0

function onForce(e: Event) {
  const v = (e.target as BluetoothRemoteGATTCharacteristic).value
  if (!v || v.byteLength < 4) return
  const gf = v.getFloat32(0, true)
  if (Number.isFinite(gf)) device.force = Math.max(0, gf)
}

function onDisconnected() {
  gatt = null
  device.mode = 'sim'
  device.name = ''
  device.force = 0
}

export async function connectBle() {
  device.error = ''
  if (!bleSupported) { device.error = 'unsupported'; return }
  device.connecting = true
  try {
    const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_SERVICE] }] })
    dev.addEventListener('gattserverdisconnected', onDisconnected)
    gatt = await dev.gatt!.connect()
    const service = await gatt.getPrimaryService(BLE_SERVICE)
    const ch = await service.getCharacteristic(BLE_FORCE_CHAR)
    ch.addEventListener('characteristicvaluechanged', onForce)
    await ch.startNotifications()
    cancelSim()
    device.mode = 'ble'
    device.name = dev.name || 'SoleSense'
  } catch {
    device.error = 'failed'
    onDisconnected()
  } finally {
    device.connecting = false
  }
}

export function disconnectBle() {
  gatt?.disconnect()
  onDisconnected()
}

export function cancelSim() {
  cancelAnimationFrame(raf)
  device.simBusy = false
  if (device.mode === 'sim') device.force = 0
}

/** Simulated press: rise to the target, hold with a little hand tremor, release. */
export function simulatePress(): Promise<void> {
  if (device.mode !== 'sim' || device.simBusy) return Promise.resolve()
  device.simBusy = true
  const RISE = 900, HOLD = 1500, FALL = 450
  const t0 = performance.now()
  const ease = (x: number) => 1 - Math.pow(1 - x, 3)
  return new Promise((resolve) => {
    const tick = (now: number) => {
      const t = now - t0
      let f: number
      if (t < RISE) f = TARGET_GF * ease(t / RISE)
      else if (t < RISE + HOLD) f = TARGET_GF + 0.25 * Math.sin(t / 90) + 0.15 * Math.sin(t / 37)
      else if (t < RISE + HOLD + FALL) f = TARGET_GF * (1 - ease((t - RISE - HOLD) / FALL))
      else { device.force = 0; device.simBusy = false; resolve(); return }
      device.force = Math.max(0, f)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  })
}
