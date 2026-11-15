// One source of force readings for the test, whether they come from the
// simulated device or from a real SoleSense over Bluetooth Low Energy (BLE).
// The firmware contract is in docs/BLE_PROTOCOL.md.

export const BLE_SERVICE = '7a0e0001-5c1b-4f6e-9d3a-50a1e5e25e00'
export const BLE_FORCE_CHAR = '7a0e0002-5c1b-4f6e-9d3a-50a1e5e25e00'

export const TARGET_GF = 10
export const TOLERANCE_GF = 1.5
export const HOLD_MS = 1000
export const GAUGE_MAX_GF = 15

type Listener = () => void

export const bleSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator

export class ForceSource {
  mode: 'sim' | 'ble' = 'sim'
  /** Latest force in gram-force. */
  force = 0
  name = ''
  connecting = false
  error: '' | 'unsupported' | 'failed' = ''
  private holding = false
  private raf = 0
  private last = 0
  private gatt: BluetoothRemoteGATTServer | null = null
  private listeners = new Set<Listener>()

  on(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() { this.listeners.forEach((fn) => fn()) }

  /** Simulated press: while held, the force eases toward 10 g with a little hand tremor. */
  hold(down: boolean): void {
    if (this.mode !== 'sim') return
    this.holding = down
    if (!this.raf) {
      this.last = performance.now()
      this.raf = requestAnimationFrame(this.tick)
    }
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const t = now / 1000
    if (this.holding) {
      const target = TARGET_GF + 0.15 + 0.32 * Math.sin(t * 6.3) + 0.14 * Math.sin(t * 17.1)
      this.force += (target - this.force) * (1 - Math.exp(-dt * 2.6))
    } else {
      this.force *= Math.exp(-dt * 8)
      if (this.force < 0.02) this.force = 0
    }
    this.emit()
    if (this.holding || this.force > 0) this.raf = requestAnimationFrame(this.tick)
    else this.raf = 0
  }

  reset(): void {
    this.holding = false
    cancelAnimationFrame(this.raf)
    this.raf = 0
    if (this.mode === 'sim') this.force = 0
    this.emit()
  }

  async connect(): Promise<void> {
    this.error = ''
    if (!bleSupported) { this.error = 'unsupported'; this.emit(); return }
    this.connecting = true
    this.emit()
    try {
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [BLE_SERVICE] }] })
      dev.addEventListener('gattserverdisconnected', this.onDisconnected)
      this.gatt = await dev.gatt!.connect()
      const service = await this.gatt.getPrimaryService(BLE_SERVICE)
      const ch = await service.getCharacteristic(BLE_FORCE_CHAR)
      ch.addEventListener('characteristicvaluechanged', this.onForce)
      await ch.startNotifications()
      this.reset()
      this.mode = 'ble'
      this.name = dev.name || 'SoleSense'
    } catch {
      this.error = 'failed'
      this.onDisconnected()
    } finally {
      this.connecting = false
      this.emit()
    }
  }

  disconnect(): void {
    this.gatt?.disconnect()
    this.onDisconnected()
  }

  private onForce = (e: Event) => {
    const v = (e.target as BluetoothRemoteGATTCharacteristic).value
    if (!v || v.byteLength < 4) return
    const gf = v.getFloat32(0, true)
    if (Number.isFinite(gf)) { this.force = Math.max(0, gf); this.emit() }
  }

  private onDisconnected = () => {
    this.gatt = null
    this.mode = 'sim'
    this.name = ''
    this.force = 0
    this.emit()
  }
}
