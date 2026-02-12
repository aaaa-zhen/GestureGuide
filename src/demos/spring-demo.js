// Spring Physics Demo (Chapter 2)
// Draggable box connected to anchor by spring
// F = -kx - bv (restoring force + damping)

import { spring, springStep, springSnap, springAtRest } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'

const MS_PER_STEP = 4
const W = 64
const TRAIL_MAX = 18

export function initSpringDemo() {
  const demo = document.getElementById('demo-spring')
  if (!demo) return

  // Hide pre-defined HTML elements
  const oldBox = demo.querySelector('.box')
  const oldAnchor = demo.querySelector('.anchor-dot')
  const oldLine = demo.querySelector('.spring-line')
  if (oldBox) oldBox.style.display = 'none'
  if (oldAnchor) oldAnchor.style.display = 'none'
  if (oldLine) oldLine.style.display = 'none'

  const readout = document.getElementById('spring-readout')
  const hint = document.getElementById('hint-spring')

  const slK = document.getElementById('sl-k')
  const slB = document.getElementById('sl-b')
  const vlK = document.getElementById('vl-k')
  const vlB = document.getElementById('vl-b')

  // === Create UI elements ===

  // Anchor dot (center point)
  const anchor = document.createElement('div')
  anchor.style.cssText = `
    position: absolute;
    width: 10px; height: 10px;
    border-radius: 50%;
    background: rgba(231, 76, 60, 0.8);
    pointer-events: none;
  `
  demo.appendChild(anchor)

  // Spring line canvas (zigzag visualization)
  const canvas = document.createElement('canvas')
  canvas.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
  `
  demo.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1))

  // Box (draggable)
  const box = document.createElement('div')
  box.style.cssText = `
    position: absolute;
    width: ${W}px; height: ${W}px;
    border-radius: 50%;
    background: rgba(43, 92, 230, 0.15);
    border: 2px solid rgba(43, 92, 230, 0.5);
    pointer-events: none;
    will-change: transform;
  `
  demo.appendChild(box)

  // Trail dots
  const trailDots = []
  for (let i = 0; i < TRAIL_MAX; i++) {
    const dot = document.createElement('div')
    dot.style.cssText = `
      position: absolute;
      width: 10px; height: 10px;
      border-radius: 50%;
      background: rgba(43, 92, 230, 0.5);
      pointer-events: none;
      will-change: transform, opacity;
      display: none;
    `
    demo.appendChild(dot)
    trailDots.push(dot)
  }

  // === state ===
  let anchorX = 0, anchorY = 0
  let demoW = 0, demoH = 0
  const sx = spring(0, 0, 290, 24)
  const sy = spring(0, 0, 290, 24)
  let animatedUntilTime = null

  let pointerState = 'up'
  let offX = 0, offY = 0

  // Trail
  const trail = []
  let trailTimer = 0

  // === events ===
  const events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
    keydown: null,
    sliderchange: false,
  }

  // === scheduling ===
  let scheduledRender = false
  function scheduleRender() {
    if (scheduledRender) return
    scheduledRender = true
    requestAnimationFrame(function renderFrame(now) {
      scheduledRender = false
      if (render(now)) scheduleRender()
    })
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v
  }

  function pushTrail() {
    trail.push({ x: sx.pos + W / 2, y: sy.pos + W / 2 })
    if (trail.length > TRAIL_MAX) trail.shift()
  }

  function paintTrail() {
    for (let i = 0; i < TRAIL_MAX; i++) {
      const dot = trailDots[i]
      if (i < trail.length) {
        const t = trail[i]
        const age = i / trail.length
        dot.style.display = ''
        dot.style.opacity = String(age * 0.4)
        const s = 0.4 + age * 0.6
        dot.style.transform = `translate(${t.x - 5}px, ${t.y - 5}px) scale(${s})`
      } else {
        dot.style.display = 'none'
      }
    }
  }

  function clearTrail() {
    trail.length = 0
    for (const d of trailDots) d.style.display = 'none'
  }

  function drawSpringLine(ax, ay, bx, by, dist) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (dist < 8) return

    ctx.save()
    ctx.scale(dpr, dpr)

    const maxDist = 200
    const t = clamp(dist / maxDist, 0, 1)

    // Color transitions from gray to red based on stretch
    const r = Math.round(138 + t * 93)
    const g = Math.round(138 - t * 62)
    const b = Math.round(148 - t * 88)
    ctx.strokeStyle = `rgb(${r},${g},${b})`
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Unit vectors along and perpendicular to the spring
    const ux = (bx - ax) / dist
    const uy = (by - ay) / dist
    const px = -uy
    const py = ux

    const COILS = 8
    const endPad = 12
    const coilLen = Math.max(dist - endPad * 2, 0)
    const amp = clamp(6 + (dist / maxDist) * 8, 6, 14)

    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(ax + ux * endPad, ay + uy * endPad)

    for (let i = 0; i <= COILS; i++) {
      const frac = i / COILS
      const cx = ax + ux * (endPad + frac * coilLen)
      const cy = ay + uy * (endPad + frac * coilLen)
      const side = (i % 2 === 0) ? 1 : -1
      if (i === 0 || i === COILS) {
        ctx.lineTo(cx, cy)
      } else {
        ctx.lineTo(cx + px * amp * side, cy + py * amp * side)
      }
    }

    ctx.lineTo(bx, by)
    ctx.stroke()
    ctx.restore()
  }

  function updateParams() {
    const k = slK ? parseFloat(slK.value) : 290
    const b = slB ? parseFloat(slB.value) : 24
    sx.k = k
    sy.k = k
    sx.b = b
    sy.b = b
    if (vlK) vlK.textContent = String(k)
    if (vlB) vlB.textContent = String(b)
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // pointerdown
    if (events.pointerdown) {
      const e = events.pointerdown
      const rect = demo.getBoundingClientRect()
      pointerState = 'dragging'
      demo.style.cursor = 'grabbing'
      offX = (e.clientX - rect.left) - sx.pos
      offY = (e.clientY - rect.top) - sy.pos
      sx.v = sy.v = 0
      animatedUntilTime = null
      trailTimer = 0
      clearTrail()
      if (hint) hint.style.display = 'none'
    }

    // pointermove
    if (events.pointermove && pointerState === 'dragging') {
      const e = events.pointermove
      const rect = demo.getBoundingClientRect()
      sx.pos = clamp((e.clientX - rect.left) - offX, -W / 2, demoW - W / 2)
      sy.pos = clamp((e.clientY - rect.top) - offY, -W / 2, demoH - W / 2)
    }

    // pointerup
    if (events.pointerup && pointerState === 'dragging') {
      pointerState = 'up'
      demo.style.cursor = 'grab'
      animatedUntilTime = null
    }

    // keydown
    if (events.keydown) {
      if (events.keydown.key === 'Escape') {
        pointerState = 'up'
        demo.style.cursor = 'grab'
        clearTrail()
        animatedUntilTime = null
        if (readout) readout.innerHTML = ''
        sx.pos = sx.dest = (demoW - W) / 2
        sy.pos = sy.dest = (demoH - W) / 2
      }
    }

    // Slider change
    if (events.sliderchange) {
      updateParams()
    }

    // Spring destination = center
    if (pointerState !== 'dragging') {
      sx.dest = (demoW - W) / 2
      sy.dest = (demoH - W) / 2
    }

    // Physics (fixed timestep integration)
    if (pointerState !== 'dragging') {
      let newTime = animatedUntilTime ?? now
      const steps = Math.floor((now - newTime) / MS_PER_STEP)
      newTime += steps * MS_PER_STEP

      for (const s of [sx, sy]) {
        for (let i = 0; i < steps; i++) springStep(s)
        if (springAtRest(s)) springSnap(s)
        else stillAnimating = true
      }

      animatedUntilTime = stillAnimating ? newTime : null
    }

    // Trail sampling
    trailTimer++
    if (trailTimer % 2 === 0 && (pointerState === 'dragging' || stillAnimating)) {
      pushTrail()
    }
    if (!stillAnimating && pointerState !== 'dragging') {
      clearTrail()
    }

    // === DOM writes ===
    const speed = Math.hypot(sx.v, sy.v)
    const dist = Math.hypot(sx.pos - sx.dest, sy.pos - sy.dest)

    let scale = 1
    if (pointerState === 'dragging') {
      scale = 1.06
    } else if (speed > 100) {
      scale = clamp(1 - speed / 8000, 0.92, 1)
    }

    box.style.transform = `translate(${sx.pos}px, ${sy.pos}px) scale(${scale})`

    anchorX = (demoW - 10) / 2
    anchorY = (demoH - 10) / 2
    anchor.style.left = anchorX + 'px'
    anchor.style.top = anchorY + 'px'

    // Spring line (canvas zigzag)
    const ax = anchorX + 5
    const ay = anchorY + 5
    const bx = sx.pos + W / 2
    const by = sy.pos + W / 2
    const lineDist = Math.hypot(bx - ax, by - ay)
    drawSpringLine(ax, ay, bx, by, lineDist)

    paintTrail()

    // Readout
    if (pointerState === 'dragging') {
      readout.innerHTML =
        `displacement = <span class="val">${Math.round(dist)}px</span> ` +
        `state = <span class="val">dragging</span>`
    } else if (stillAnimating) {
      readout.innerHTML =
        `displacement = <span class="val">${Math.round(dist)}px</span> ` +
        `velocity = <span class="val">${Math.round(speed)} px/s</span>`
    } else {
      readout.innerHTML = ''
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.keydown = null
    events.sliderchange = false

    return stillAnimating || pointerState === 'dragging'
  }

  // === event listeners ===
  demo.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    demo.setPointerCapture(e.pointerId)
    events.pointerdown = e
    scheduleRender()
  }, { passive: false })

  demo.addEventListener('pointermove', (e) => {
    events.pointermove = e
    scheduleRender()
  })

  demo.addEventListener('pointerup', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  demo.addEventListener('pointercancel', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  demo.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      events.keydown = e
      scheduleRender()
    }
  })

  // Slider events
  if (slK) slK.addEventListener('input', () => { events.sliderchange = true; scheduleRender() })
  if (slB) slB.addEventListener('input', () => { events.sliderchange = true; scheduleRender() })

  // === layout ===
  function layout() {
    const rect = demo.getBoundingClientRect()
    demoW = rect.width
    demoH = rect.height

    // Canvas sizing
    canvas.width = Math.floor(demoW * dpr)
    canvas.height = Math.floor(demoH * dpr)

    anchorX = (demoW - 10) / 2
    anchorY = (demoH - 10) / 2
    sx.pos = sx.dest = (demoW - W) / 2
    sy.pos = sy.dest = (demoH - W) / 2
    clearTrail()
    scheduleRender()
  }

  updateParams()
  layout()
  onResize(layout)
}

// Auto-init
if (document.getElementById('demo-spring')) {
  initSpringDemo()
}
