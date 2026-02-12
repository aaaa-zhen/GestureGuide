// Pinch / Zoom Demo (Chapter 1)
// chenglou-style: DOM + transform3d, pinch-to-zoom with velocity transfer
// Uses SVG for crisp scaling at any zoom level

import { spring, springStep, springSnap, springAtRest } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'
import { demoRGB } from '../engine/colors.js'

const MS_PER_STEP = 4
const MIN_SCALE = 0.5
const MAX_SCALE = 3.0
const VELOCITY_WINDOW_MS = 100
const MAX_STEPS_PER_FRAME = 500

export function initPinchZoom() {
  const demo = document.getElementById('demo-pinch')
  if (!demo) return

  // Hide old DOM elements
  const oldTarget = demo.querySelector('.pinch-target')
  const oldRing = demo.querySelector('.pinch-ring')
  if (oldTarget) oldTarget.style.display = 'none'
  if (oldRing) oldRing.style.display = 'none'

  const readout = document.getElementById('pinch-readout')
  const hint = document.getElementById('hint-pinch')

  // Create SVG for crisp scaling
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  `
  demo.appendChild(svg)

  // Create a group for scalable content
  const contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  svg.appendChild(contentGroup)

  // Grid pattern
  const gridSize = 20
  const gridExtent = 80
  const purple = demoRGB('purple')

  // Grid lines
  for (let i = -gridExtent; i <= gridExtent; i += gridSize) {
    // Vertical line
    const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    vLine.setAttribute('x1', i)
    vLine.setAttribute('y1', -gridExtent)
    vLine.setAttribute('x2', i)
    vLine.setAttribute('y2', gridExtent)
    vLine.setAttribute('stroke', `rgba(${purple}, 0.25)`)
    vLine.setAttribute('stroke-width', '1')
    vLine.setAttribute('vector-effect', 'non-scaling-stroke')
    contentGroup.appendChild(vLine)

    // Horizontal line
    const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    hLine.setAttribute('x1', -gridExtent)
    hLine.setAttribute('y1', i)
    hLine.setAttribute('x2', gridExtent)
    hLine.setAttribute('y2', i)
    hLine.setAttribute('stroke', `rgba(${purple}, 0.25)`)
    hLine.setAttribute('stroke-width', '1')
    hLine.setAttribute('vector-effect', 'non-scaling-stroke')
    contentGroup.appendChild(hLine)
  }

  // Center circle
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('cx', '0')
  circle.setAttribute('cy', '0')
  circle.setAttribute('r', '40')
  circle.setAttribute('fill', `rgba(${purple}, 0.15)`)
  circle.setAttribute('stroke', `rgba(${purple}, 0.5)`)
  circle.setAttribute('stroke-width', '2')
  circle.setAttribute('vector-effect', 'non-scaling-stroke')
  contentGroup.appendChild(circle)

  // Scale text
  const scaleText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  scaleText.setAttribute('x', '0')
  scaleText.setAttribute('y', '0')
  scaleText.setAttribute('text-anchor', 'middle')
  scaleText.setAttribute('dominant-baseline', 'central')
  scaleText.setAttribute('font-family', '-apple-system, BlinkMacSystemFont, sans-serif')
  scaleText.setAttribute('font-size', '14')
  scaleText.setAttribute('fill', 'rgba(0, 0, 0, 0.4)')
  scaleText.textContent = '1.0x'
  contentGroup.appendChild(scaleText)

  // Finger indicators group (not scaled)
  const fingersGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  svg.appendChild(fingersGroup)

  // Create finger indicator elements
  const fingerCircles = []
  for (let i = 0; i < 2; i++) {
    const fc = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    fc.setAttribute('r', '8')
    fc.setAttribute('fill', `rgba(${purple}, 0.3)`)
    fc.style.opacity = '0'
    fingersGroup.appendChild(fc)
    fingerCircles.push(fc)
  }

  // Pinch ring indicator
  const pinchRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  pinchRing.setAttribute('fill', 'none')
  pinchRing.setAttribute('stroke', `rgba(${purple}, 0.4)`)
  pinchRing.setAttribute('stroke-width', '2')
  pinchRing.setAttribute('stroke-dasharray', '4 4')
  pinchRing.style.opacity = '0'
  fingersGroup.appendChild(pinchRing)

  // === state ===
  let scaleSpring = spring(1, 0, 180, 20)

  let demoW = 0, demoH = 0
  let animatedUntilTime = null

  // Pointers tracking
  const pointers = new Map()
  let initialPinchDist = 0
  let initialScale = 1

  // Right-click zoom simulation
  let rightClickZoom = false
  let rightClickStart = { x: 0, y: 0 }
  let rightClickInitialScale = 1
  let wheelActiveUntil = 0

  // History for velocity
  let scaleHistory = []

  // === events ===
  const events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
    keydown: null,
    wheel: null,
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

  function pinchDist() {
    const pts = [...pointers.values()]
    if (pts.length < 2) return 0
    return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
  }

  function pinchCenter() {
    const pts = [...pointers.values()]
    if (pts.length < 2) return { x: 0, y: 0 }
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
  }

  function clampScale(s) {
    return Math.max(MIN_SCALE * 0.5, Math.min(MAX_SCALE * 1.5, s))
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // pointerdown
    if (events.pointerdown) {
      const e = events.pointerdown
      if (hint) hint.style.display = 'none'

      const rect = demo.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top

      // Right-click for zoom simulation
      if (e.button === 2) {
        rightClickZoom = true
        rightClickStart = { x: px, y: py }
        rightClickInitialScale = scaleSpring.pos
        scaleHistory = [{ scale: scaleSpring.pos, time: now }]
        scaleSpring.v = 0
      } else {
        pointers.set(e.pointerId, { x: px, y: py })

        if (pointers.size === 2) {
          initialPinchDist = pinchDist()
          initialScale = scaleSpring.pos
          scaleHistory = [{ scale: scaleSpring.pos, time: now }]
        }

        // Stop any ongoing animation
        scaleSpring.v = 0
      }
    }

    // pointermove
    if (events.pointermove) {
      const e = events.pointermove
      const rect = demo.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top

      // Right-click zoom: drag up = zoom in, drag down = zoom out
      if (rightClickZoom) {
        const dy = rightClickStart.y - py // positive = dragged up = zoom in
        const zoomFactor = Math.pow(1.01, dy) // exponential zoom
        const newScale = clampScale(rightClickInitialScale * zoomFactor)
        scaleSpring.pos = scaleSpring.dest = newScale

        scaleHistory.push({ scale: newScale, time: now })
        if (scaleHistory.length > 20) scaleHistory.shift()

      } else if (pointers.has(e.pointerId)) {
        pointers.set(e.pointerId, { x: px, y: py })

        if (pointers.size >= 2) {
          // Pinch zoom only (no pan)
          const dist = pinchDist()
          if (initialPinchDist > 0) {
            const newScale = clampScale(initialScale * (dist / initialPinchDist))
            scaleSpring.pos = scaleSpring.dest = newScale

            scaleHistory.push({ scale: newScale, time: now })
            if (scaleHistory.length > 20) scaleHistory.shift()
          }
        }
      }
    }

    // pointerup - transfer velocity!
    if (events.pointerup) {
      const e = events.pointerup

      // Handle right-click zoom release
      if (rightClickZoom && e.button === 2) {
        rightClickZoom = false

        // Calculate scale velocity
        if (scaleHistory.length > 1) {
          let i = scaleHistory.length - 1
          while (i > 0 && now - scaleHistory[i].time <= VELOCITY_WINDOW_MS) i--
          if (i < scaleHistory.length - 1) {
            const oldest = scaleHistory[i]
            const newest = scaleHistory[scaleHistory.length - 1]
            const dt = newest.time - oldest.time
            if (dt > 0) {
              scaleSpring.v = (newest.scale - oldest.scale) / dt * 1000
            }
          }
        }

        scaleSpring.dest = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleSpring.pos))
        scaleHistory = []
        animatedUntilTime = null

      } else {
        const wasPinching = pointers.size >= 2
        pointers.delete(e.pointerId)

        if (pointers.size === 0 && wasPinching) {
          // Calculate scale velocity
          if (scaleHistory.length > 1) {
            let i = scaleHistory.length - 1
            while (i > 0 && now - scaleHistory[i].time <= VELOCITY_WINDOW_MS) i--
            if (i < scaleHistory.length - 1) {
              const oldest = scaleHistory[i]
              const newest = scaleHistory[scaleHistory.length - 1]
              const dt = newest.time - oldest.time
              if (dt > 0) {
                scaleSpring.v = (newest.scale - oldest.scale) / dt * 1000
              }
            }
          }

          scaleSpring.dest = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scaleSpring.pos))
          scaleHistory = []
          animatedUntilTime = null
        }
      }
    }

    // keydown
    if (events.keydown) {
      const e = events.keydown
      if (hint) hint.style.display = 'none'

      if (e.key === '=' || e.key === '+') {
        const newScale = clampScale(scaleSpring.pos * 1.2)
        scaleSpring.pos = newScale
        scaleSpring.dest = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
        animatedUntilTime = null
      } else if (e.key === '-') {
        const newScale = clampScale(scaleSpring.pos / 1.2)
        scaleSpring.pos = newScale
        scaleSpring.dest = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))
        animatedUntilTime = null
      } else if (e.key === '0' || e.key === 'Escape') {
        // Reset scale
        scaleSpring.dest = 1
        animatedUntilTime = null
      }
    }

    // wheel fallback (desktop single-finger zoom)
    if (events.wheel) {
      const e = events.wheel
      if (hint) hint.style.display = 'none'

      const intensity = e.ctrlKey ? 0.003 : 0.0015
      const zoomFactor = Math.exp(-e.deltaY * intensity)
      const newScale = clampScale(scaleSpring.pos * zoomFactor)
      scaleSpring.pos = newScale
      scaleSpring.dest = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale))

      // Track scale history for velocity transfer on wheel end
      scaleHistory.push({ scale: newScale, time: now })
      if (scaleHistory.length > 20) scaleHistory.shift()
      scaleSpring.v = 0

      wheelActiveUntil = now + 160
      animatedUntilTime = null
    }

    // Wheel ended — transfer velocity
    if (scaleHistory.length > 0 && now > wheelActiveUntil && !events.wheel) {
      if (scaleHistory.length > 1) {
        let i = scaleHistory.length - 1
        while (i > 0 && wheelActiveUntil - scaleHistory[i].time <= VELOCITY_WINDOW_MS) i--
        if (i < scaleHistory.length - 1) {
          const oldest = scaleHistory[i]
          const newest = scaleHistory[scaleHistory.length - 1]
          const dt = newest.time - oldest.time
          if (dt > 0) {
            scaleSpring.v = (newest.scale - oldest.scale) / dt * 1000
          }
        }
      }
      scaleHistory = []
      animatedUntilTime = null
    }

    // Physics
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.min(Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP), MAX_STEPS_PER_FRAME)
    newAnimatedUntilTime += steps * MS_PER_STEP

    if (pointers.size === 0 && !rightClickZoom) {
      for (let i = 0; i < steps; i++) {
        springStep(scaleSpring)
      }

      // Clamp scale
      scaleSpring.pos = clampScale(scaleSpring.pos)

      if (!springAtRest(scaleSpring)) stillAnimating = true
      else springSnap(scaleSpring)
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // === SVG update ===
    const scale = scaleSpring.pos
    const centerX = demoW / 2
    const centerY = demoH / 2

    // Update content group transform
    contentGroup.setAttribute('transform', `translate(${centerX}, ${centerY}) scale(${scale})`)

    // Update scale text (counter-scale so it stays readable)
    scaleText.textContent = `${scale.toFixed(1)}x`
    scaleText.setAttribute('font-size', `${14 / scale}`)

    // Update finger indicators
    const pts = [...pointers.values()]
    for (let i = 0; i < fingerCircles.length; i++) {
      if (i < pts.length) {
        fingerCircles[i].setAttribute('cx', pts[i].x)
        fingerCircles[i].setAttribute('cy', pts[i].y)
        fingerCircles[i].style.opacity = '1'
      } else {
        fingerCircles[i].style.opacity = '0'
      }
    }

    // Update pinch ring
    if (pointers.size >= 2) {
      const center = pinchCenter()
      const dist = pinchDist()
      pinchRing.setAttribute('cx', center.x)
      pinchRing.setAttribute('cy', center.y)
      pinchRing.setAttribute('r', dist / 2)
      pinchRing.style.opacity = '1'
    } else {
      pinchRing.style.opacity = '0'
    }

    // Update readout
    const isPinching = pointers.size >= 2
    if (rightClickZoom) {
      readout.innerHTML = `zooming — <span class="val">${scale.toFixed(2)}x</span>`
    } else if (isPinching) {
      readout.innerHTML = `pinching — <span class="val">${scale.toFixed(2)}x</span>`
    } else if (now < wheelActiveUntil) {
      readout.innerHTML = `wheel zoom — <span class="val">${scale.toFixed(2)}x</span>`
    } else if (stillAnimating) {
      readout.innerHTML = `<span class="val">${scale.toFixed(2)}x</span> (momentum)`
    } else {
      readout.innerHTML = ''
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.keydown = null
    events.wheel = null

    return stillAnimating || pointers.size > 0 || rightClickZoom || now < wheelActiveUntil + 20
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
    if (['=', '+', '-', '0', 'Escape'].includes(e.key)) {
      e.preventDefault()
      events.keydown = e
      scheduleRender()
    }
  })

  demo.addEventListener('wheel', (e) => {
    e.preventDefault()
    events.wheel = e
    scheduleRender()
  }, { passive: false })

  // Prevent context menu for right-click zoom
  demo.addEventListener('contextmenu', (e) => {
    e.preventDefault()
  })

  function updateSize() {
    const rect = demo.getBoundingClientRect()
    demoW = rect.width
    demoH = rect.height
    svg.setAttribute('viewBox', `0 0 ${demoW} ${demoH}`)
    scheduleRender()
  }

  updateSize()
  onResize(updateSize)
}

// Auto-init
if (document.getElementById('demo-pinch')) {
  initPinchZoom()
}
