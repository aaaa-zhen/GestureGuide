// Drag Direct Demo (Chapter 1)
// chenglou-style: DOM + transform3d, 1:1 tracking with velocity transfer

import { spring, springStep, springSnap, springAtRest, GESTURE } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'
import { demoRGB, demoRGBA } from '../engine/colors.js'

const MS_PER_STEP = 4
const VELOCITY_WINDOW_MS = 100
const RADIUS = 28

export function initDragDirect() {
  const demo = document.getElementById('demo-drag-direct')
  if (!demo) return

  const readout = document.getElementById('drag-direct-readout')
  const hint = document.getElementById('hint-drag-direct')

  // Create circle element
  const circle = document.createElement('div')
  circle.style.cssText = `
    position: absolute;
    width: ${RADIUS * 2}px;
    height: ${RADIUS * 2}px;
    border-radius: 50%;
    background: ${demoRGBA('blue', 0.15)};
    border: 2px solid ${demoRGBA('blue', 0.5)};
    display: flex;
    align-items: center;
    justify-content: center;
    font: 9px -apple-system, BlinkMacSystemFont, sans-serif;
    color: rgba(0, 0, 0, 0.4);
    cursor: grab;
    will-change: transform;
    user-select: none;
  `
  circle.textContent = '1:1'
  demo.appendChild(circle)

  // === state ===
  let posX = spring(0, 0, 180, 20)
  let posY = spring(0, 0, 180, 20)
  let scaleSpring = spring(1, 0, 400, 22)

  let demoW = 0, demoH = 0
  let initialized = false
  let animatedUntilTime = null

  let pointerState = 'up'
  let downX = 0, downY = 0
  let offsetX = 0, offsetY = 0
  let pointer = [{ x: 0, y: 0, time: 0 }]

  // === events ===
  let events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
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

  function isInsideCircle(x, y) {
    return Math.hypot(x - posX.pos, y - posY.pos) <= RADIUS
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // Initialize position
    if (!initialized && demoW > 0) {
      posX.pos = posX.dest = demoW / 2
      posY.pos = posY.dest = demoH / 2
      initialized = true
    }

    // pointerdown
    if (events.pointerdown) {
      const rect = demo.getBoundingClientRect()
      const x = events.pointerdown.clientX - rect.left
      const y = events.pointerdown.clientY - rect.top

      if (isInsideCircle(x, y)) {
        pointerState = 'down'
        downX = x
        downY = y
        offsetX = x - posX.pos
        offsetY = y - posY.pos
        pointer = [{ x, y, time: now }]
        posX.v = posY.v = 0
        if (hint) hint.style.display = 'none'
        circle.style.cursor = 'grabbing'
      }
    }

    // pointermove
    if (events.pointermove && pointerState !== 'up') {
      const rect = demo.getBoundingClientRect()
      const x = events.pointermove.clientX - rect.left
      const y = events.pointermove.clientY - rect.top
      const dist = Math.hypot(x - downX, y - downY)

      pointer.push({ x, y, time: now })
      if (pointer.length > 20) pointer.shift()

      if (pointerState === 'down' && dist > GESTURE.TOUCH_SLOP) {
        pointerState = 'dragging'
        scaleSpring.dest = 1.15
        animatedUntilTime = null
      }

      if (pointerState === 'dragging') {
        let newX = x - offsetX
        let newY = y - offsetY
        newX = Math.max(RADIUS, Math.min(demoW - RADIUS, newX))
        newY = Math.max(RADIUS, Math.min(demoH - RADIUS, newY))
        posX.pos = posX.dest = newX
        posY.pos = posY.dest = newY
        posX.v = posY.v = 0
      }
    }

    // pointerup
    if (events.pointerup && pointerState !== 'up') {
      if (pointerState === 'dragging') {
        // Calculate velocity from pointer history
        let i = pointer.length - 1
        while (i > 0 && now - pointer[i].time <= VELOCITY_WINDOW_MS) i--
        if (i < pointer.length - 1) {
          const oldest = pointer[i]
          const newest = pointer[pointer.length - 1]
          const dt = newest.time - oldest.time
          if (dt > 0) {
            posX.v = (newest.x - oldest.x) / dt * 1000
            posY.v = (newest.y - oldest.y) / dt * 1000
          }
        }
      }

      pointerState = 'up'
      scaleSpring.dest = 1
      pointer = [{ x: 0, y: 0, time: 0 }]
      animatedUntilTime = null
      circle.style.cursor = 'grab'
    }

    // Physics
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP)
    newAnimatedUntilTime += steps * MS_PER_STEP

    for (let i = 0; i < steps; i++) {
      springStep(posX)
      springStep(posY)
      springStep(scaleSpring)
    }

    // Clamp
    posX.pos = Math.max(RADIUS, Math.min(demoW - RADIUS, posX.pos))
    posY.pos = Math.max(RADIUS, Math.min(demoH - RADIUS, posY.pos))
    posX.dest = Math.max(RADIUS, Math.min(demoW - RADIUS, posX.dest))
    posY.dest = Math.max(RADIUS, Math.min(demoH - RADIUS, posY.dest))

    for (const s of [posX, posY, scaleSpring]) {
      if (!springAtRest(s)) stillAnimating = true
      else springSnap(s)
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // === DOM write ===
    const x = posX.pos - RADIUS
    const y = posY.pos - RADIUS
    const scale = scaleSpring.pos
    circle.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`

    const isDragging = pointerState === 'dragging'
    circle.style.background = `rgba(${demoRGB('blue')}, ${isDragging ? 0.2 : 0.15})`
    circle.style.borderColor = `rgba(${demoRGB('blue')}, ${isDragging ? 0.7 : 0.5})`

    if (isDragging) {
      readout.innerHTML = `<span style="color:${demoRGBA('blue', 1)}">1:1 tracking</span> + velocity transfer`
    } else {
      readout.innerHTML = ''
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null

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

  function updateSize() {
    const rect = demo.getBoundingClientRect()
    demoW = rect.width
    demoH = rect.height
    scheduleRender()
  }

  updateSize()
  onResize(updateSize)
}

// Auto-init
if (document.getElementById('demo-drag-direct')) {
  initDragDirect()
}
