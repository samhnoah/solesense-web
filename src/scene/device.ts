import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { CALLOUTS, GROUPS, forViewport, type Callout, type GroupKey, type Pose, type V3 } from './poses'

/** Travel is drawn this many times larger than life so 2 mm reads on screen. */
export const TRAVEL_EXAGGERATION = 2

type MatSpec = { color: string; roughness: number; metalness?: number; clearcoat?: number; emissive?: string; emissiveIntensity?: number }

const MATS: Record<string, MatSpec> = {
  shell: { color: '#e6e9e6', roughness: 0.4, clearcoat: 0.35 },
  teal: { color: '#12a493', roughness: 0.32, clearcoat: 0.4 },
  teal_dark: { color: '#0d6a61', roughness: 0.45 },
  cassette: { color: '#1fd8c0', roughness: 0.28, clearcoat: 0.5, emissive: '#0aa894', emissiveIntensity: 0.18 },
  blue: { color: '#3b8fe3', roughness: 0.3, clearcoat: 0.4 },
  brass: { color: '#d8ab55', roughness: 0.28, metalness: 1 },
  steel: { color: '#a9b1b5', roughness: 0.3, metalness: 1 },
  magnet: { color: '#e4ebef', roughness: 0.12, metalness: 1 },
  black: { color: '#141617', roughness: 0.5 },
  copper: { color: '#d08850', roughness: 0.3, metalness: 1 },
  pcb: { color: '#0f4a3a', roughness: 0.55 },
  pcb_blue: { color: '#14407a', roughness: 0.55 },
  battery: { color: '#1f6f8f', roughness: 0.35, clearcoat: 0.6 },
  tray: { color: '#848d90', roughness: 0.7 },
  oled: { color: '#0a0c0d', roughness: 0.2, metalness: 0.2 },
  wire: { color: '#2a2a2a', roughness: 0.6 },
  filament: { color: '#ffb547', roughness: 0.4, emissive: '#ff9a1f', emissiveIntensity: 1.4 },
}

const HEAD_SIDE: GroupKey[] = ['head', 'lid', 'lid_screws', 'cassette', 'cassette_fixed', 'moving', 'magnet', 'filament', 'sensor']
const TRAVELLING: GroupKey[] = ['moving', 'magnet', 'filament']
const HIGHLIGHT = new THREE.Color('#3ce8cf')

interface MatEntry { mat: THREE.MeshPhysicalMaterial; key: string; group: GroupKey; color: THREE.Color; emissive: THREE.Color; emissiveIntensity: number }

export interface DeviceOptions {
  canvas: HTMLCanvasElement
  hud: HTMLElement
  lines: SVGSVGElement
  onProgress?: (fraction: number) => void
}

export class Device {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.01, 60)
  private pivot = new THREE.Group()
  private model = new THREE.Group()
  private groups = {} as Record<GroupKey, THREE.Group>
  private mats: MatEntry[] = []
  private cassetteUniform = { value: 0 }
  private fieldGlow!: THREE.Sprite
  private tipGlow!: THREE.Sprite
  private skin!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private oledCtx!: CanvasRenderingContext2D
  private oledTex!: THREE.CanvasTexture
  private oledShown = ''
  private pose!: Pose
  private pointer = new THREE.Vector2()
  private pointerEased = new THREE.Vector2()
  private callouts: { def: Callout; el: HTMLElement; on: boolean; first: boolean }[] = []
  private lineEls: SVGLineElement[] = []
  private ringEls: SVGCircleElement[] = []
  private clock = new THREE.Clock()
  private aspect = 1
  private opts: DeviceOptions
  /** Press travel in mm (true scale). */
  travel = 0
  /** Force shown on the 3D OLED, gf. */
  oledGf = 0
  activeStep = -1
  calloutsOn = false
  ready = false

  constructor(opts: DeviceOptions) {
    this.opts = opts
    this.renderer = new THREE.WebGLRenderer({ canvas: opts.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.62

    const key = new THREE.DirectionalLight('#fff3e6', 1.5)
    key.position.set(3, 5, 4)
    const rimTeal = new THREE.DirectionalLight('#3ce8cf', 1.5)
    rimTeal.position.set(-4, 2.5, -3)
    const rimAmber = new THREE.DirectionalLight('#ffb547', 0.7)
    rimAmber.position.set(4, -1.5, -4)
    this.scene.add(key, rimTeal, rimAmber, new THREE.HemisphereLight('#bfe9e1', '#0a1412', 0.35))

    // CAD millimetres, Z up -> world units of 100 mm, Y up, centred on the device.
    this.model.rotation.x = -Math.PI / 2
    this.model.scale.setScalar(0.01)
    this.model.position.x = -1.4
    this.pivot.add(this.model)
    this.scene.add(this.pivot)
    for (const g of GROUPS) {
      const grp = new THREE.Group()
      grp.name = g
      this.groups[g] = grp
      this.model.add(grp)
    }
    this.buildExtras()
    this.buildCallouts()

    window.addEventListener('pointermove', (e) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1)
    }, { passive: true })
  }

  async load(url: string): Promise<void> {
    const loader = new GLTFLoader()
    loader.setMeshoptDecoder(MeshoptDecoder)
    const gltf = await loader.loadAsync(url, (e) => {
      if (e.total) this.opts.onProgress?.(e.loaded / e.total)
    })
    const cache = new Map<string, THREE.MeshPhysicalMaterial>()
    const meshes: THREE.Mesh[] = []
    gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })

    for (const mesh of meshes) {
      const group = (mesh.userData.group || 'head') as GroupKey
      const matKey = (mesh.userData.mat || 'shell') as string
      mesh.updateMatrix()
      // Dequantize and bake the node transform so vertices are CAD millimetres.
      const src = mesh.geometry
      const pos = src.attributes.position
      const arr = new Float32Array(pos.count * 3)
      for (let i = 0; i < pos.count; i++) {
        arr[i * 3] = pos.getX(i); arr[i * 3 + 1] = pos.getY(i); arr[i * 3 + 2] = pos.getZ(i)
      }
      let geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
      if (src.index) geo.setIndex(src.index)
      geo.applyMatrix4(mesh.matrix)
      geo = toCreasedNormals(geo, THREE.MathUtils.degToRad(34))
      src.dispose()

      const key = `${group}:${matKey}`
      let mat = cache.get(key)
      if (!mat) {
        mat = this.makeMaterial(matKey, group)
        cache.set(key, mat)
      }
      const out = new THREE.Mesh(geo, mat)
      out.name = mesh.name
      this.groups[group].add(out)
    }
    this.ready = true
  }

  private makeMaterial(key: string, group: GroupKey): THREE.MeshPhysicalMaterial {
    const s = MATS[key] || MATS.shell
    const mat = new THREE.MeshPhysicalMaterial({
      color: s.color, roughness: s.roughness, metalness: s.metalness ?? 0,
      clearcoat: s.clearcoat ?? 0, clearcoatRoughness: 0.35,
      emissive: s.emissive ?? '#000000', emissiveIntensity: s.emissiveIntensity ?? 1,
    })
    if (key === 'cassette') {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uDelta = this.cassetteUniform
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nuniform float uDelta;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            // Fixed-guided beams: the moving rail translates, each beam takes an S-shape.
            float s = clamp((position.y + 19.0) / 22.0, 0.0, 1.0);
            transformed.x -= uDelta * (3.0 * s * s - 2.0 * s * s * s);`)
      }
    }
    this.mats.push({ mat, key, group, color: mat.color.clone(), emissive: mat.emissive.clone(), emissiveIntensity: mat.emissiveIntensity })
    return mat
  }

  private buildExtras(): void {
    const glowTex = (inner: string, outer: string) => {
      const c = document.createElement('canvas')
      c.width = c.height = 128
      const g = c.getContext('2d')!
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
      grad.addColorStop(0, inner)
      grad.addColorStop(0.35, outer)
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 128, 128)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      return t
    }
    // Field between magnet and sensor (CAD mm, rides with the magnet).
    this.fieldGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex('rgba(200,240,255,1)', 'rgba(90,169,255,.45)'), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0,
    }))
    this.fieldGlow.position.set(174, 7, 0)
    this.fieldGlow.scale.setScalar(16)
    this.groups.magnet.add(this.fieldGlow)

    // Warm point at the filament tip.
    this.tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex('rgba(255,236,200,1)', 'rgba(255,170,60,.5)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9,
    }))
    this.tipGlow.position.set(283.6, 0, 0)
    this.tipGlow.scale.setScalar(14)
    this.groups.filament.add(this.tipGlow)

    // "Skin" the filament touches: contour rings perpendicular to the filament.
    const skinMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uColor: { value: new THREE.Color('#3ce8cf') }, uWarm: { value: new THREE.Color('#ffb547') } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        varying vec2 vUv; uniform float uTime; uniform float uOpacity; uniform vec3 uColor; uniform vec3 uWarm;
        void main(){
          vec2 p = vUv * 2.0 - 1.0; float r = length(p); float a = atan(p.y, p.x);
          float press = 0.5 + 0.5 * sin(uTime * 1.6);
          float h = r - exp(-r * r * 22.0) * (0.08 + 0.06 * press) + 0.012 * sin(a * 5.0 + r * 9.0 + uTime * 0.3);
          float k = h * 16.0; float w = fwidth(k);
          float line = 1.0 - smoothstep(0.0, w * 1.4, abs(fract(k) - 0.5) - 0.5 + w);
          float wave = 0.0;
          for (int i = 0; i < 3; i++) {
            float rr = fract(uTime * 0.28 + float(i) / 3.0);
            wave += smoothstep(0.03, 0.0, abs(r - rr)) * (1.0 - rr) * 0.9;
          }
          float fade = smoothstep(1.0, 0.25, r);
          float warm = exp(-r * r * 60.0) * 0.6;
          float alpha = clamp(line * 0.3 + wave * 0.75 + warm, 0.0, 1.0) * fade * uOpacity;
          vec3 col = mix(uColor, uWarm, clamp(warm / max(alpha, 0.001), 0.0, 1.0));
          gl_FragColor = vec4(col, alpha);
        }`,
    })
    this.skin = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), skinMat)
    this.skin.position.set(284.2, 0, 0)
    this.skin.rotation.y = Math.PI / 2
    this.model.add(this.skin)

    // The handle's OLED, drawn live.
    const c = document.createElement('canvas')
    c.width = 256; c.height = 128
    this.oledCtx = c.getContext('2d')!
    this.oledTex = new THREE.CanvasTexture(c)
    this.oledTex.colorSpace = THREE.SRGBColorSpace
    this.oledTex.anisotropy = 4
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(21.7, 10.9), new THREE.MeshBasicMaterial({ map: this.oledTex, toneMapped: false }))
    screen.position.set(40, 0, 27.36)
    this.groups.handle_upper.add(screen)
    this.drawOled(0)
  }

  private drawOled(gf: number): void {
    const label = gf.toFixed(1)
    if (label === this.oledShown) return
    this.oledShown = label
    const g = this.oledCtx
    g.fillStyle = '#020304'
    g.fillRect(0, 0, 256, 128)
    g.fillStyle = '#a8fff2'
    g.font = '500 15px ui-monospace, Menlo, monospace'
    g.fillText('SOLESENSE', 14, 24)
    g.textAlign = 'right'
    g.fillText(gf > 0.05 ? 'PRESS' : 'READY', 242, 24)
    g.font = '600 58px ui-monospace, Menlo, monospace'
    g.fillText(label, 196, 88)
    g.font = '500 20px ui-monospace, Menlo, monospace'
    g.fillText('gf', 242, 88)
    g.textAlign = 'left'
    g.strokeStyle = '#a8fff2'
    g.lineWidth = 2
    g.strokeRect(14, 102, 228, 12)
    g.fillRect(16, 104, Math.min(224, (224 * gf) / 75), 8)
    this.oledTex.needsUpdate = true
  }

  private buildCallouts(): void {
    const ns = 'http://www.w3.org/2000/svg'
    for (const def of CALLOUTS) {
      const el = document.createElement('div')
      el.className = 'callout'
      el.innerHTML = `<b>${def.sub}</b>${def.label}`
      this.opts.hud.appendChild(el)
      this.callouts.push({ def, el, on: false, first: !this.callouts.some((c) => c.def.step === def.step) })
      const line = document.createElementNS(ns, 'line')
      const ring = document.createElementNS(ns, 'circle')
      ring.setAttribute('r', '5')
      line.style.opacity = ring.style.opacity = '0'
      this.opts.lines.append(line, ring)
      this.lineEls.push(line)
      this.ringEls.push(ring)
    }
  }

  setPose(p: Pose): void { this.pose = p }

  resize(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    this.aspect = w / h
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, w < 760 ? 1.5 : 1.75))
    this.renderer.setSize(w, h, false)
    this.camera.aspect = this.aspect
    this.camera.updateProjectionMatrix()
  }

  private tmp = new THREE.Vector3()
  private tmp2 = new THREE.Vector3()
  private tmpColor = new THREE.Color()

  render(): void {
    if (!this.pose) return
    const dt = Math.min(this.clock.getDelta(), 0.05)
    const t = this.clock.elapsedTime
    const p = forViewport(this.pose, this.aspect)

    // Pointer parallax and idle float.
    this.pointerEased.lerp(this.pointer, 1 - Math.exp(-dt * 3))
    const idle = p.idle
    this.pivot.rotation.set(
      p.rot[0] + idle * (this.pointerEased.y * 0.1 + Math.sin(t * 0.5) * 0.02),
      p.rot[1] + idle * this.pointerEased.x * 0.18,
      p.rot[2] + idle * Math.sin(t * 0.7) * 0.025,
    )
    this.pivot.position.y = idle * Math.sin(t * 0.9) * 0.03

    // Explode offsets (CAD mm).
    const travel = this.travel * TRAVEL_EXAGGERATION
    for (const g of GROUPS) this.groups[g].position.set(0, 0, 0)
    for (const g of HEAD_SIDE) this.groups[g].position.x += 28 * p.headOut
    for (const g of TRAVELLING) {
      this.groups[g].position.z += 36 * p.carriage
      this.groups[g].position.x -= travel
    }
    this.groups.lid.position.z += 46 * p.lid
    this.groups.lid_screws.position.z -= 34 * p.lid
    this.groups.handle_upper.position.z += 50 * p.upper
    const vib = this.groups.vibration
    vib.visible = p.vib > 0.01
    vib.position.set(64, -104 - 70 * (1 - p.vib), -12)
    this.cassetteUniform.value = travel

    // Highlight focused parts, darken the rest.
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.4)
    for (const m of this.mats) {
      const f = p.focus[m.group] ?? 0
      const d = p.dim * (1 - f)
      m.mat.color.copy(m.color).multiplyScalar(1 - 0.9 * d)
      m.mat.envMapIntensity = 1 - 0.92 * d
      m.mat.clearcoat = (MATS[m.key]?.clearcoat ?? 0) * (1 - d)
      const gh = p.ghost[m.group] ?? 0
      m.mat.transparent = gh > 0.01
      m.mat.opacity = 1 - 0.92 * gh
      m.mat.depthWrite = gh < 0.5
      m.mat.visible = gh < 0.97
      const glow = f * Math.min(1, p.dim * 2.2) * 0.3 * pulse
      m.mat.emissive.copy(m.emissive).multiplyScalar(m.emissiveIntensity).add(this.tmpColor.copy(HIGHLIGHT).multiplyScalar(glow))
      m.mat.emissiveIntensity = 1
    }

    const fieldStrength = 0.35 + 0.65 * Math.min(1, this.travel / 2)
    ;(this.fieldGlow.material as THREE.SpriteMaterial).opacity = p.field * fieldStrength * (0.8 + 0.2 * pulse)
    this.fieldGlow.position.x = 174 + travel * 0.5
    ;(this.tipGlow.material as THREE.SpriteMaterial).opacity = 0.35 + 0.55 * idle
    this.skin.material.uniforms.uTime.value = t
    this.skin.material.uniforms.uOpacity.value = idle
    this.skin.visible = idle > 0.01
    this.drawOled(this.oledGf)

    this.camera.position.set(...p.cam)
    this.camera.fov = p.fov
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.setViewOffset(w, h, -p.shift[0] * w, -p.shift[1] * h, w, h)
    this.camera.updateProjectionMatrix()
    this.camera.lookAt(...p.target)
    this.renderer.render(this.scene, this.camera)
    this.updateCallouts()
  }

  private updateCallouts(): void {
    const w = window.innerWidth
    const h = window.innerHeight
    const narrow = w < 900
    this.model.updateMatrixWorld()
    this.callouts.forEach((c, i) => {
      const want = this.calloutsOn && c.def.step === this.activeStep && (!narrow || (c.first && c.def.step < 5))
      if (want !== c.on) {
        c.on = want
        c.el.classList.toggle('is-on', want)
        this.lineEls[i].style.opacity = this.ringEls[i].style.opacity = want ? '1' : '0'
      }
      if (!want) return
      const grp = this.groups[c.def.group]
      this.tmp.set(...(c.def.anchor as V3)).add(grp.position)
      this.tmp.applyMatrix4(this.model.matrixWorld)
      this.tmp2.copy(this.tmp).project(this.camera)
      const x = (this.tmp2.x * 0.5 + 0.5) * w
      const y = (-this.tmp2.y * 0.5 + 0.5) * h
      let [ox, oy] = c.def.off
      if (narrow) { ox *= 0.55; oy *= 0.6 }
      const lw = c.el.offsetWidth
      const lh = c.el.offsetHeight
      let lx = x + ox - (ox < 0 ? lw : 0)
      let ly = y + oy - lh / 2
      lx = Math.max(10, Math.min(w - lw - 10, lx))
      ly = Math.max(70, Math.min(h - lh - 10, ly))
      c.el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`
      const ex = ox < 0 ? lx + lw : lx
      const ey = ly + lh / 2
      const line = this.lineEls[i]
      line.setAttribute('x1', x.toFixed(1)); line.setAttribute('y1', y.toFixed(1))
      line.setAttribute('x2', ex.toFixed(1)); line.setAttribute('y2', ey.toFixed(1))
      this.ringEls[i].setAttribute('cx', x.toFixed(1))
      this.ringEls[i].setAttribute('cy', y.toFixed(1))
    })
  }

  hideCallouts(): void {
    this.calloutsOn = false
    if (this.callouts.some((c) => c.on)) this.updateCallouts()
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')))
  } catch {
    return false
  }
}
