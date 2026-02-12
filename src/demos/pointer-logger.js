// Gesture Feedback Loop Visualizer (Chapter 0)
// chenglou-style: demonstrates all four phases with distinct visual/physical feedback
//   Press → snap to finger, scale up
//   Follow → 1:1 tracking with trail
//   Release → velocity transfer, momentum coast
//   Settle → spring back to center

import { spring, springStep, springSnap, springAtRest } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'
import { demoRGB, demoRGBA } from '../engine/colors.js'

const MS_PER_STEP = 4
const RADIUS = 28
const FADE_DURATION = 1200
const TOUCH_SLOP = 4

export function initPointerLogger() {
  const demo = document.getElementById('demo-pointer-log')
  const canvas = document.getElementById('pointer-trail-canvas')
  const readout = document.getElementById('pointer-log-readout')
  const hint = document.getElementById('hint-pointer')

  if (!demo || !canvas || !readout) return

  const ctx = canvas.getContext('2d')
  const dpr = Math.max(1, Math.ceil(window.devicePixelRatio || 1))

  // Create interactive circle (matches drag-direct style)
  const circle = document.createElement('div')
  circle.style.cssText = `
    position: absolute;
    width: ${RADIUS * 2}px;
    height: ${RADIUS * 2}px;
    border-radius: 50%;
    background: ${demoRGBA('blue', 0.15)};
    border: 2px solid ${demoRGBA('blue', 0.5)};
    will-change: transform;
    user-select: none;
    pointer-events: none;
  `
  demo.appendChild(circle)

  // === state ===
  let phase = 'idle'
  let demoW = 0, demoH = 0
  let initialized = false
  let homeX = 0, homeY = 0

  let posX = spring(0, 0, 180, 22)
  let posY = spring(0, 0, 180, 22)
  let scaleSpring = spring(1, 0, 400, 22)

  let pointerState = 'up' // up | down | dragging
  let downX = 0, downY = 0
  let offsetX = 0, offsetY = 0
  let pointerHistory = [{ x: 0, y: 0, time: 0 }]

  let trails = []
  let currentTrail = null
  let settleTimer = 0
  let animatedUntilTime = null

  // === events ===
  const events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
    pointercancel: null,
  }

  // === scheduling ===
  let scheduledRender = false
  function scheduleRender() {
    if (scheduledRender) return
    scheduledRender = true
    requestAnimationFrame(function renderAndMaybeScheduleAnotherRender(now) {
      scheduledRender = false
      if (render(now)) scheduleRender()
    })
  }

  function setPhase(p) {
    phase = p
    if (p === 'idle') {
      readout.innerHTML = ''
    } else {
      readout.innerHTML = `phase = <span class="val">${p.toUpperCase()}</span>`
    }
  }

  function resize() {
    const rect = demo.getBoundingClientRect()
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)
    ctx.scale(dpr, dpr)
    demoW = rect.width
    demoH = rect.height
    if (!initialized) {
      homeX = demoW / 2
      homeY = demoH / 2
      posX.pos = posX.dest = homeX
      posY.pos = posY.dest = homeY
      initialized = true
    } else {
      homeX = demoW / 2
      homeY = demoH / 2
    }
    scheduleRender()
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // --- Step 0: Process events ---

    // pointerdown
    if (events.pointerdown) {
      const rect = demo.getBoundingClientRect()
      const x = events.pointerdown.clientX - rect.left
      const y = events.pointerdown.clientY - rect.top

      if (hint) hint.style.display = 'none'
      clearTimeout(settleTimer)

      pointerState = 'down'
      downX = x
      downY = y

      // Snap circle to press position
      posX.pos = posX.dest = x
      posY.pos = posY.dest = y
      posX.v = posY.v = 0
      offsetX = 0
      offsetY = 0

      pointerHistory = [{ x, y, time: now }]

      // Press feedback: scale up
      scaleSpring.dest = 1.2
      animatedUntilTime = null

      // Start trail
      currentTrail = { points: [{ x, y }], fading: false, fadeStart: 0 }
      trails.push(currentTrail)

      setPhase('press')
      demo.style.cursor = 'grabbing'
    }

    // pointermove
    if (events.pointermove && pointerState !== 'up') {
      const rect = demo.getBoundingClientRect()
      const x = events.pointermove.clientX - rect.left
      const y = events.pointermove.clientY - rect.top

      pointerHistory.push({ x, y, time: now })
      if (pointerHistory.length > 20) pointerHistory.shift()

      if (pointerState === 'down') {
        const dist = Math.hypot(x - downX, y - downY)
        if (dist > TOUCH_SLOP) {
          pointerState = 'dragging'
          setPhase('follow')
        }
      }

      if (pointerState === 'dragging') {
        // 1:1 tracking
        let newX = x - offsetX
        let newY = y - offsetY
        newX = Math.max(RADIUS, Math.min(demoW - RADIUS, newX))
        newY = Math.max(RADIUS, Math.min(demoH - RADIUS, newY))
        posX.pos = posX.dest = newX
        posY.pos = posY.dest = newY
        posX.v = posY.v = 0

        // Extend trail
        if (currentTrail) {
          currentTrail.points.push({ x: newX, y: newY })
          if (currentTrail.points.length > 500) {
            currentTrail.points = currentTrail.points.slice(-400)
          }
        }
      }
    }

    // pointerup
    if (events.pointerup && pointerState !== 'up') {
      // Velocity transfer from pointer history
      if (pointerState === 'dragging') {
        let i = pointerHistory.length - 1
        while (i > 0 && now - pointerHistory[i].time <= 100) i--
        if (i < pointerHistory.length - 1) {
          const oldest = pointerHistory[i]
          const newest = pointerHistory[pointerHistory.length - 1]
          const dt = newest.time - oldest.time
          if (dt > 0) {
            posX.v = (newest.x - oldest.x) / dt * 1000
            posY.v = (newest.y - oldest.y) / dt * 1000
          }
        }
      }

      setPhase('release')
      pointerState = 'up'
      scaleSpring.dest = 1
      pointerHistory = [{ x: 0, y: 0, time: 0 }]

      // Start trail fade
      if (currentTrail) {
        currentTrail.fading = true
        currentTrail.fadeStart = now
      }
      currentTrail = null

      // After momentum coast, spring back to center (settle)
      settleTimer = setTimeout(() => {
        if (phase === 'release') {
          setPhase('settle')
          posX.dest = homeX
          posY.dest = homeY
          animatedUntilTime = null
          scheduleRender()
        }
      }, 400)

      animatedUntilTime = null
      demo.style.cursor = 'grab'
    }

    // pointercancel
    if (events.pointercancel && pointerState !== 'up') {
      pointerState = 'up'
      scaleSpring.dest = 1
      posX.dest = homeX
      posY.dest = homeY
      if (currentTrail) {
        currentTrail.fading = true
        currentTrail.fadeStart = now
      }
      currentTrail = null
      setPhase('idle')
      animatedUntilTime = null
      demo.style.cursor = 'grab'
    }

    // --- Step 1: Release coast (damping only, no spring pull) ---
    if (phase === 'release') {
      posX.dest = posX.pos
      posY.dest = posY.pos
    }

    // --- Step 2: Physics ---
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP)
    newAnimatedUntilTime += steps * MS_PER_STEP

    for (let i = 0; i < steps; i++) {
      springStep(posX)
      springStep(posY)
      springStep(scaleSpring)
    }

    // Clamp to demo bounds
    posX.pos = Math.max(RADIUS, Math.min(demoW - RADIUS, posX.pos))
    posY.pos = Math.max(RADIUS, Math.min(demoH - RADIUS, posY.pos))
    posX.dest = Math.max(RADIUS, Math.min(demoW - RADIUS, posX.dest))
    posY.dest = Math.max(RADIUS, Math.min(demoH - RADIUS, posY.dest))

    for (const s of [posX, posY, scaleSpring]) {
      if (!springAtRest(s)) stillAnimating = true
      else springSnap(s)
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // Settle → idle when springs come to rest
    if (phase === 'settle' && springAtRest(posX) && springAtRest(posY)) {
      setPhase('idle')
    }

    // --- Step 3: Draw canvas (trail) ---
    ctx.clearRect(0, 0, demoW, demoH)

    for (let t = trails.length - 1; t >= 0; t--) {
      const trail = trails[t]
      let alpha = 1

      if (trail.fading) {
        const elapsed = now - trail.fadeStart
        alpha = 1 - elapsed / FADE_DURATION
        if (alpha <= 0) {
          trails.splice(t, 1)
          continue
        }
      }

      const pts = trail.points
      if (pts.length < 2) continue

      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1]
        const curr = pts[i]
        const segmentAlpha = alpha * Math.max(0.15, i / pts.length)

        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(curr.x, curr.y)
        ctx.strokeStyle = `rgba(${demoRGB('blue')}, ${segmentAlpha * 0.5})`
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        ctx.stroke()
      }
    }

    // --- Step 4: DOM write (circle) ---
    const cx = posX.pos - RADIUS
    const cy = posY.pos - RADIUS
    const scale = scaleSpring.pos
    circle.style.transform = `translate3d(${cx}px, ${cy}px, 0) scale(${scale})`

    const isActive = pointerState !== 'up'
    circle.style.background = `rgba(${demoRGB('blue')}, ${isActive ? 0.22 : 0.15})`
    circle.style.borderColor = `rgba(${demoRGB('blue')}, ${isActive ? 0.7 : 0.5})`

    // --- Step 5: Clear events ---
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.pointercancel = null

    const hasFading = trails.some(t => t.fading)
    return stillAnimating || pointerState !== 'up' || hasFading
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
    events.pointercancel = e
    scheduleRender()
  })

  resize()
  onResize(resize)
}

// Auto-init
if (document.getElementById('demo-pointer-log')) {
  initPointerLogger()
}
