// Drag Spring Demo (Chapter 1)
// chenglou-style: DOM + transform3d, spring delay following

import { spring, springStep, springSnap, springAtRest, GESTURE } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'
import { demoRGB, demoRGBA } from '../engine/colors.js'

const MS_PER_STEP = 4
const RADIUS = 28

export function initDragSpring() {
  const demo = document.getElementById('demo-drag-spring')
  if (!demo) return

  const readout = document.getElementById('drag-spring-readout')
  const hint = document.getElementById('hint-drag-spring')

  // Create circle element
  const circle = document.createElement('div')
  circle.style.cssText = `
    position: absolute;
    width: ${RADIUS * 2}px;
    height: ${RADIUS * 2}px;
    border-radius: 50%;
    background: ${demoRGBA('green', 0.15)};
    border: 2px solid ${demoRGBA('green', 0.5)};
    display: flex;
    align-items: center;
    justify-content: center;
    font: 9px -apple-system, BlinkMacSystemFont, sans-serif;
    color: rgba(0, 0, 0, 0.4);
    cursor: grab;
    will-change: transform;
    user-select: none;
  `
  circle.textContent = 'spring'
  demo.appendChild(circle)

  // === state ===
  let targetX = 0, targetY = 0
  let posX = spring(0, 0, 120, 16) // low k = more delay
  let posY = spring(0, 0, 120, 16)
  let scaleSpring = spring(1, 0, 400, 22)

  let demoW = 0, demoH = 0
  let initialized = false
  let animatedUntilTime = null

  let pointerState = 'up'
  let downX = 0, downY = 0
  let offsetX = 0, offsetY = 0

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
      targetX = demoW / 2
      targetY = demoH / 2
      posX.pos = posX.dest = targetX
      posY.pos = posY.dest = targetY
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
        offsetX = x - targetX
        offsetY = y - targetY
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

      if (pointerState === 'down' && dist > GESTURE.TOUCH_SLOP) {
        pointerState = 'dragging'
        scaleSpring.dest = 1.15
        animatedUntilTime = null
      }

      if (pointerState === 'dragging') {
        targetX = x - offsetX
        targetY = y - offsetY
        targetX = Math.max(RADIUS, Math.min(demoW - RADIUS, targetX))
        targetY = Math.max(RADIUS, Math.min(demoH - RADIUS, targetY))
        posX.dest = targetX
        posY.dest = targetY
      }
    }

    // pointerup
    if (events.pointerup && pointerState !== 'up') {
      pointerState = 'up'
      scaleSpring.dest = 1
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
    circle.style.background = `rgba(${demoRGB('green')}, ${isDragging ? 0.2 : 0.15})`
    circle.style.borderColor = `rgba(${demoRGB('green')}, ${isDragging ? 0.7 : 0.5})`

    if (isDragging) {
      readout.innerHTML = `<span style="color:${demoRGBA('green', 1)}">spring following</span> — delayed response`
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
if (document.getElementById('demo-drag-spring')) {
  initDragSpring()
}
