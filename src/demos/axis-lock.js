// Axis Lock Demo (Chapter 1)
// chenglou-style: DOM + transform3d, circle that locks to X or Y axis

import { spring, springStep, springSnap, springAtRest, GESTURE } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'

const MS_PER_STEP = 4
const VELOCITY_WINDOW_MS = 100
const RADIUS = 28

export function initAxisLock() {
  const demo = document.getElementById('demo-axislock')
  if (!demo) return

  // Remove old box if exists
  const oldBox = document.getElementById('axislock-box')
  if (oldBox) oldBox.style.display = 'none'

  const readout = document.getElementById('axislock-readout')
  const hint = document.getElementById('hint-axislock')

  // Create circle element
  const circle = document.createElement('div')
  circle.style.cssText = `
    position: absolute;
    width: ${RADIUS * 2}px;
    height: ${RADIUS * 2}px;
    border-radius: 50%;
    background: rgba(138, 138, 154, 0.15);
    border: 2px solid rgba(138, 138, 154, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font: 9px -apple-system, BlinkMacSystemFont, sans-serif;
    color: rgba(0, 0, 0, 0.4);
    cursor: grab;
    will-change: transform;
    user-select: none;
  `
  circle.textContent = 'drag'
  demo.appendChild(circle)

  // Create axis guide lines (hidden initially)
  const axisLineX = document.createElement('div')
  axisLineX.style.cssText = `
    position: absolute;
    height: 1px;
    background: transparent;
    border-top: 1px dashed rgba(43, 92, 230, 0.3);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
  `
  demo.appendChild(axisLineX)

  const axisLineY = document.createElement('div')
  axisLineY.style.cssText = `
    position: absolute;
    width: 1px;
    background: transparent;
    border-left: 1px dashed rgba(39, 174, 96, 0.3);
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s;
  `
  demo.appendChild(axisLineY)

  // === state ===
  let posX = spring(0, 0, 180, 20)
  let posY = spring(0, 0, 180, 20)
  let scaleSpring = spring(1, 0, 400, 22)

  let demoW = 0, demoH = 0
  let initialized = false
  let animatedUntilTime = null

  let pointerState = 'up' // 'up' | 'down' | 'dragging'
  /** @type {null | 'x' | 'y'} */
  let lockedAxis = null
  let downX = 0, downY = 0
  let offsetX = 0, offsetY = 0

  // Pointer history for velocity
  let pointerHistory = []

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
        lockedAxis = null
        downX = x
        downY = y
        offsetX = x - posX.pos
        offsetY = y - posY.pos
        pointerHistory = [{ x, y, time: now }]
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
      const dx = Math.abs(x - downX)
      const dy = Math.abs(y - downY)

      // Record pointer history
      pointerHistory.push({ x, y, time: now })
      if (pointerHistory.length > 20) pointerHistory.shift()

      // Determine axis lock once we cross threshold
      if (pointerState === 'down' && (dx > GESTURE.TOUCH_SLOP || dy > GESTURE.TOUCH_SLOP)) {
        lockedAxis = dx > dy ? 'x' : 'y'
        pointerState = 'dragging'
        scaleSpring.dest = 1.15
        animatedUntilTime = null
      }

      if (pointerState === 'dragging') {
        let newX = x - offsetX
        let newY = y - offsetY

        // Apply axis lock
        if (lockedAxis === 'x') {
          newX = Math.max(RADIUS, Math.min(demoW - RADIUS, newX))
          posX.pos = posX.dest = newX
          // Y stays at center
          posY.dest = demoH / 2
        } else if (lockedAxis === 'y') {
          newY = Math.max(RADIUS, Math.min(demoH - RADIUS, newY))
          posY.pos = posY.dest = newY
          // X stays at center
          posX.dest = demoW / 2
        }
      }
    }

    // pointerup - transfer velocity on locked axis only
    if (events.pointerup && pointerState !== 'up') {
      if (pointerState === 'dragging' && lockedAxis) {
        // Calculate velocity from last ~100ms
        let i = pointerHistory.length - 1
        while (i > 0 && now - pointerHistory[i].time <= VELOCITY_WINDOW_MS) i--

        if (i < pointerHistory.length - 1) {
          const oldest = pointerHistory[i]
          const newest = pointerHistory[pointerHistory.length - 1]
          const deltaTime = newest.time - oldest.time

          if (deltaTime > 0) {
            const vx = (newest.x - oldest.x) / deltaTime * 1000
            const vy = (newest.y - oldest.y) / deltaTime * 1000
            // Only apply velocity on locked axis
            if (lockedAxis === 'x') posX.v = vx
            if (lockedAxis === 'y') posY.v = vy
          }
        }
      }

      pointerState = 'up'
      scaleSpring.dest = 1
      // Spring back to center
      posX.dest = demoW / 2
      posY.dest = demoH / 2
      pointerHistory = []
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

    // Clamp positions
    posX.pos = Math.max(RADIUS, Math.min(demoW - RADIUS, posX.pos))
    posY.pos = Math.max(RADIUS, Math.min(demoH - RADIUS, posY.pos))

    const springs = [posX, posY, scaleSpring]
    for (const s of springs) {
      if (!springAtRest(s)) stillAnimating = true
      else springSnap(s)
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // === DOM write ===
    const xPos = posX.pos - RADIUS
    const yPos = posY.pos - RADIUS
    const scale = scaleSpring.pos
    circle.style.transform = `translate3d(${xPos}px, ${yPos}px, 0) scale(${scale})`

    const isDragging = pointerState === 'dragging'
    const blue = '43, 92, 230'   // X axis color
    const green = '39, 174, 96'  // Y axis color
    const gray = '138, 138, 154' // neutral

    // Choose color based on locked axis
    let color = gray
    if (lockedAxis === 'x') color = blue
    if (lockedAxis === 'y') color = green

    circle.style.background = `rgba(${color}, ${isDragging ? 0.2 : 0.15})`
    circle.style.borderColor = `rgba(${color}, ${isDragging ? 0.7 : 0.5})`

    // Update label
    if (lockedAxis) {
      circle.textContent = lockedAxis.toUpperCase()
    } else {
      circle.textContent = 'drag'
    }

    // Update axis guide lines
    if (isDragging && lockedAxis === 'x') {
      axisLineX.style.left = `${RADIUS}px`
      axisLineX.style.right = `${RADIUS}px`
      axisLineX.style.top = `${posY.pos}px`
      axisLineX.style.opacity = '1'
      axisLineY.style.opacity = '0'
    } else if (isDragging && lockedAxis === 'y') {
      axisLineY.style.top = `${RADIUS}px`
      axisLineY.style.bottom = `${RADIUS}px`
      axisLineY.style.left = `${posX.pos}px`
      axisLineY.style.opacity = '1'
      axisLineX.style.opacity = '0'
    } else {
      axisLineX.style.opacity = '0'
      axisLineY.style.opacity = '0'
    }

    // Update readout
    if (isDragging && lockedAxis) {
      const axisColor = lockedAxis === 'x' ? blue : green
      readout.innerHTML = `locked: <span style="color:rgba(${axisColor},1)">${lockedAxis.toUpperCase()}</span>`
    } else if (pointerState === 'down') {
      readout.innerHTML = 'detecting direction...'
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
if (document.getElementById('demo-axislock')) {
  initAxisLock()
}
