// Decay Demo (Chapter 2)
// Exponential decay: v(t) = v₀ · e^(-λt)
// Two visualizations:
//   1. Ghost marks at equal time intervals — spacing reveals the decay shape
//   2. Real-time velocity curve — traces v(t) as the animation plays

import { onResize } from '../engine/lifecycle.js'

const DOT_SIZE = 28
const GHOST_SIZE = 8
const GHOST_INTERVAL_MS = 50
const VELOCITY_WINDOW_MS = 100
const VELOCITY_THRESHOLD = 6
const TICK_SPACING = 60
const REST_VELOCITY = 1  // px/s

// Convert per-frame friction to continuous decay constant λ
// friction^60 = e^(-λ), so λ = -60 * ln(friction)
function frictionToLambda(friction) {
  return -60 * Math.log(friction)
}

function decayPosition(v0, lambda, t) {
  return (v0 / lambda) * (1 - Math.exp(-lambda * t))
}

function decayVelocity(v0, lambda, t) {
  return v0 * Math.exp(-lambda * t)
}

function decayDuration(v0, lambda, threshold) {
  if (Math.abs(v0) <= threshold) return 0
  return Math.log(Math.abs(v0) / threshold) / lambda
}

// =====================================================================

export function initDecay() {
  const demo = document.getElementById('demo-decay')
  if (!demo) return

  const readout = document.getElementById('decay-readout')
  const hint = document.getElementById('hint-decay')
  const frictionSlider = document.getElementById('sl-decay-friction')
  const frictionValue = document.getElementById('vl-decay-friction')

  // === Create UI elements ===

  // Track line
  const track = document.createElement('div')
  track.style.cssText = `
    position: absolute;
    left: 24px; right: 24px;
    top: 33%; height: 2px;
    background: var(--border, rgba(0,0,0,0.15));
    transform: translateY(-50%);
  `
  demo.appendChild(track)

  // Tick marks
  const tickContainer = document.createElement('div')
  tickContainer.style.cssText = `
    position: absolute;
    left: 24px; right: 24px;
    top: 33%; height: 0;
    pointer-events: none;
  `
  demo.appendChild(tickContainer)

  // Ghost container
  const ghostContainer = document.createElement('div')
  ghostContainer.style.cssText = `
    position: absolute; inset: 0;
    pointer-events: none;
  `
  demo.appendChild(ghostContainer)

  // Dot (draggable)
  const dot = document.createElement('div')
  dot.style.cssText = `
    position: absolute;
    width: ${DOT_SIZE}px; height: ${DOT_SIZE}px;
    border-radius: 50%;
    background: rgba(43, 92, 230, 0.2);
    border: 2px solid rgba(43, 92, 230, 0.6);
    top: 33%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  `
  demo.appendChild(dot)

  // Velocity canvas
  const canvas = document.createElement('canvas')
  canvas.style.cssText = `
    position: absolute;
    left: 24px; right: 24px;
    bottom: 12px;
    border-radius: 4px;
  `
  demo.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1))

  // === state ===
  let pos = 0
  let trackWidth = 0
  let trackLeft = 24
  let canvasW = 0
  let canvasH = 90

  let flingActive = false
  let flingStartTime = 0
  let flingStartPos = 0
  let flingV0 = 0
  let flingLambda = 0
  let flingDuration = 0

  let pointerState = 'up'
  let lastX = 0
  let pointer = [{ x: 0, time: 0 }]
  let lastGhostTime = 0

  // === events ===
  const events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
    keydown: null,
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

  function getFriction() {
    return frictionSlider ? parseFloat(frictionSlider.value) : 0.95
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v
  }

  function buildTicks() {
    tickContainer.innerHTML = ''
    const count = Math.floor(trackWidth / TICK_SPACING)
    for (let i = 0; i <= count; i++) {
      const tick = document.createElement('div')
      tick.style.cssText = `
        position: absolute;
        left: ${i * TICK_SPACING}px; top: -6px;
        width: 1px; height: 12px;
        background: var(--border, rgba(0,0,0,0.12));
      `
      tickContainer.appendChild(tick)
    }
  }

  function clearGhosts() {
    ghostContainer.innerHTML = ''
  }

  function addGhost(ghostPos) {
    const el = document.createElement('div')
    el.style.cssText = `
      position: absolute;
      width: ${GHOST_SIZE}px; height: ${GHOST_SIZE}px;
      border-radius: 50%;
      background: rgba(43, 92, 230, 0.25);
      top: 33%;
      left: ${trackLeft + clamp(ghostPos, 0, trackWidth)}px;
      transform: translate(-50%, -50%);
      pointer-events: none;
    `
    ghostContainer.appendChild(el)
  }

  // === velocity graph ===
  function drawVelocityGraph(currentT) {
    if (canvasW <= 0) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (flingDuration <= 0) return

    ctx.save()
    ctx.scale(dpr, dpr)

    const totalT = flingDuration
    const maxV = Math.abs(flingV0)
    if (maxV < 1) { ctx.restore(); return }

    const padTop = 6
    const padBottom = 2
    const graphH = canvasH - padTop - padBottom
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'

    const faintStroke = isDark ? 'rgba(90, 156, 245, 0.15)' : 'rgba(43, 92, 230, 0.12)'
    const solidStroke = isDark ? 'rgba(90, 156, 245, 0.6)' : 'rgba(43, 92, 230, 0.5)'
    const fillColor = isDark ? 'rgba(90, 156, 245, 0.06)' : 'rgba(43, 92, 230, 0.05)'
    const dotColor = isDark ? 'rgba(90, 156, 245, 0.9)' : 'rgba(43, 92, 230, 0.8)'
    const axisColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'

    function vToY(v) {
      return padTop + graphH * (1 - Math.abs(v) / maxV)
    }

    function tToX(t) {
      return (t / totalT) * canvasW
    }

    // X-axis baseline
    ctx.strokeStyle = axisColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, canvasH - padBottom)
    ctx.lineTo(canvasW, canvasH - padBottom)
    ctx.stroke()

    // Full theoretical curve (faint) — shows the complete exponential shape
    const N = 200
    ctx.beginPath()
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * totalT
      const v = decayVelocity(flingV0, flingLambda, t)
      const x = tToX(t)
      const y = vToY(v)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = faintStroke
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Traced portion — solid line with fill under curve
    if (currentT > 0) {
      const tracedN = Math.min(N, Math.ceil((currentT / totalT) * N))

      // Fill area under curve
      ctx.beginPath()
      ctx.moveTo(0, canvasH - padBottom)
      let lastDrawnX = 0
      for (let i = 0; i <= tracedN; i++) {
        const t = (i / N) * totalT
        const v = decayVelocity(flingV0, flingLambda, t)
        lastDrawnX = tToX(t)
        ctx.lineTo(lastDrawnX, vToY(v))
      }
      ctx.lineTo(lastDrawnX, canvasH - padBottom)
      ctx.closePath()
      ctx.fillStyle = fillColor
      ctx.fill()

      // Solid curve line
      ctx.beginPath()
      for (let i = 0; i <= tracedN; i++) {
        const t = (i / N) * totalT
        const v = decayVelocity(flingV0, flingLambda, t)
        if (i === 0) ctx.moveTo(tToX(t), vToY(v))
        else ctx.lineTo(tToX(t), vToY(v))
      }
      ctx.strokeStyle = solidStroke
      ctx.lineWidth = 2
      ctx.stroke()

      // Moving dot on curve
      const clampedT = Math.min(currentT, totalT)
      const currentV = decayVelocity(flingV0, flingLambda, clampedT)
      ctx.beginPath()
      ctx.arc(tToX(clampedT), vToY(currentV), 3.5, 0, Math.PI * 2)
      ctx.fillStyle = dotColor
      ctx.fill()
    }

    ctx.restore()
  }

  // === drag velocity ===
  function getDragVelocity(now) {
    if (pointer.length < 2) return 0
    let i = pointer.length - 1
    while (i > 0 && now - pointer[i].time <= VELOCITY_WINDOW_MS) i--
    const oldest = pointer[i]
    const newest = pointer[pointer.length - 1]
    const dt = newest.time - oldest.time
    if (dt < 1) return 0
    return (newest.x - oldest.x) / dt * 1000
  }

  function startFling(v0, now) {
    const friction = getFriction()
    const lambda = frictionToLambda(friction)

    if (Math.abs(v0) < VELOCITY_THRESHOLD) {
      flingActive = false
      return
    }

    flingActive = true
    flingStartTime = now
    flingStartPos = pos
    flingV0 = v0
    flingLambda = lambda
    flingDuration = decayDuration(v0, lambda, REST_VELOCITY)

    clearGhosts()
    lastGhostTime = now
    addGhost(pos)
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false
    const maxPos = trackWidth

    // pointerdown
    if (events.pointerdown) {
      pointerState = 'dragging'
      flingActive = false
      flingDuration = 0
      lastX = events.pointerdown.clientX
      pointer = [{ x: events.pointerdown.clientX, time: now }]
      clearGhosts()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (readout) readout.innerHTML = ''
      if (hint) hint.style.display = 'none'
    }

    // pointermove
    if (events.pointermove && pointerState === 'dragging') {
      const dx = events.pointermove.clientX - lastX
      lastX = events.pointermove.clientX
      pos = clamp(pos + dx, 0, maxPos)
      pointer.push({ x: events.pointermove.clientX, time: now })
      if (pointer.length > 20) pointer.shift()
    }

    // pointerup
    if (events.pointerup && pointerState === 'dragging') {
      pointerState = 'up'
      const vx = getDragVelocity(now)
      pointer = [{ x: 0, time: 0 }]
      startFling(clamp(vx, -4000, 4000), now)
    }

    // keydown
    if (events.keydown) {
      if (events.keydown.key === 'ArrowRight') startFling(800, now)
      else if (events.keydown.key === 'ArrowLeft') startFling(-800, now)
    }

    // === Analytical decay ===
    if (flingActive) {
      const t = (now - flingStartTime) / 1000
      pos = flingStartPos + decayPosition(flingV0, flingLambda, t)
      const currentVel = Math.abs(decayVelocity(flingV0, flingLambda, t))

      // Drop ghosts at equal time intervals
      while (now - lastGhostTime >= GHOST_INTERVAL_MS) {
        lastGhostTime += GHOST_INTERVAL_MS
        const ghostT = (lastGhostTime - flingStartTime) / 1000
        const ghostP = flingStartPos + decayPosition(flingV0, flingLambda, ghostT)
        if (ghostP <= 0 || ghostP >= maxPos) break
        addGhost(ghostP)
      }

      // Draw velocity curve
      drawVelocityGraph(t)

      // Boundary check
      if (pos <= 0 || pos >= maxPos) {
        pos = clamp(pos, 0, maxPos)
        flingActive = false
        addGhost(pos)
        drawVelocityGraph(t)
        if (readout) {
          readout.innerHTML =
            `v₀ = <span class="val">${Math.abs(Math.round(flingV0))}</span>` +
            `  v = <span class="val">0 px/s</span>`
        }
      } else if (currentVel < REST_VELOCITY) {
        flingActive = false
        addGhost(pos)
        drawVelocityGraph(flingDuration)
        if (readout) {
          readout.innerHTML =
            `v₀ = <span class="val">${Math.abs(Math.round(flingV0))}</span>` +
            `  v = <span class="val">0 px/s</span>`
        }
      } else {
        stillAnimating = true
        if (readout) {
          readout.innerHTML =
            `v₀ = <span class="val">${Math.abs(Math.round(flingV0))}</span>` +
            `  v = <span class="val">${Math.round(currentVel)} px/s</span>`
        }
      }
    }

    // === DOM writes ===
    dot.style.left = (trackLeft + clamp(pos, 0, maxPos)) + 'px'

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.keydown = null

    return stillAnimating
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
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      events.keydown = e
      scheduleRender()
    }
  })

  if (frictionSlider) {
    frictionSlider.addEventListener('input', () => {
      if (frictionValue) frictionValue.textContent = frictionSlider.value
    })
  }

  // === layout ===
  function layout() {
    const demoRect = demo.getBoundingClientRect()
    trackLeft = 24
    trackWidth = demoRect.width - 48
    pos = trackWidth / 2
    flingActive = false
    flingDuration = 0

    canvasW = trackWidth
    canvasH = 90
    canvas.style.width = canvasW + 'px'
    canvas.style.height = canvasH + 'px'
    canvas.width = Math.floor(canvasW * dpr)
    canvas.height = Math.floor(canvasH * dpr)

    clearGhosts()
    buildTicks()
    scheduleRender()
  }

  layout()
  onResize(layout)
}

// Auto-init
if (document.getElementById('demo-decay')) {
  initDecay()
}
