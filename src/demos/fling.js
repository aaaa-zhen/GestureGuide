// Fling Demo (Chapter 1)
// chenglou-style: DOM + transform3d, detect fling by velocity on release

import { spring, springStep, springSnap, springAtRest, GESTURE } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'

const MS_PER_STEP = 4
const VELOCITY_WINDOW_MS = 100
const FLING_THRESHOLD = 950 // px/s
const RADIUS = 28

export function initFling() {
  const demo = document.getElementById('demo-fling')
  if (!demo) return

  // Hide old box if exists
  const oldBox = document.getElementById('fling-box')
  if (oldBox) oldBox.style.display = 'none'

  const readout = document.getElementById('fling-readout')
  const hint = document.getElementById('hint-fling')

  // Create circle element
  const circle = document.createElement('div')
  circle.style.cssText = `
    position: absolute;
    width: ${RADIUS * 2}px;
    height: ${RADIUS * 2}px;
    border-radius: 50%;
    background: rgba(39, 174, 96, 0.15);
    border: 2px solid rgba(39, 174, 96, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font: 9px -apple-system, BlinkMacSystemFont, sans-serif;
    color: rgba(0, 0, 0, 0.4);
    cursor: grab;
    will-change: transform;
    user-select: none;
  `
  circle.textContent = 'fling?'
  demo.appendChild(circle)

  // === state ===
  let posX = spring(0, 0, 180, 20)
  let posY = spring(0, 0, 180, 20)
  let scaleSpring = spring(1, 0, 400, 22)

  let demoW = 0, demoH = 0
  let initialized = false
  let animatedUntilTime = null

  let pointerState = 'up' // 'up' | 'down' | 'dragging'
  let downX = 0, downY = 0
  let offsetX = 0, offsetY = 0

  // Fling result state
  let lastResult = null // null | 'fling' | 'drag_end'
  let lastSpeed = 0
  let resultFadeStart = null
  let currentSpeed = 0 // real-time speed while dragging
  let wouldFling = false // whether current speed would trigger fling

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
        downX = x
        downY = y
        offsetX = x - posX.pos
        offsetY = y - posY.pos
        pointerHistory = [{ x, y, time: now }]
        posX.v = posY.v = 0
        lastResult = null
        resultFadeStart = null
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

      // Record pointer history
      pointerHistory.push({ x, y, time: now })
      if (pointerHistory.length > 20) pointerHistory.shift()

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

        // Calculate real-time velocity
        let i = pointerHistory.length - 1
        while (i > 0 && now - pointerHistory[i].time <= VELOCITY_WINDOW_MS) i--
        if (i < pointerHistory.length - 1 && pointerHistory.length > 1) {
          const oldest = pointerHistory[i]
          const newest = pointerHistory[pointerHistory.length - 1]
          const deltaTime = newest.time - oldest.time
          if (deltaTime > 0) {
            const vx = (newest.x - oldest.x) / deltaTime * 1000
            const vy = (newest.y - oldest.y) / deltaTime * 1000
            currentSpeed = Math.hypot(vx, vy)
            wouldFling = currentSpeed > FLING_THRESHOLD
          }
        }
      }
    }

    // pointerup - detect fling!
    if (events.pointerup && pointerState !== 'up') {
      let vx = 0, vy = 0

      if (pointerState === 'dragging') {
        // Calculate velocity from last ~100ms
        let i = pointerHistory.length - 1
        while (i > 0 && now - pointerHistory[i].time <= VELOCITY_WINDOW_MS) i--

        if (i < pointerHistory.length - 1) {
          const oldest = pointerHistory[i]
          const newest = pointerHistory[pointerHistory.length - 1]
          const deltaTime = newest.time - oldest.time

          if (deltaTime > 0) {
            vx = (newest.x - oldest.x) / deltaTime * 1000
            vy = (newest.y - oldest.y) / deltaTime * 1000
          }
        }

        const speed = Math.hypot(vx, vy)
        lastSpeed = speed
        lastResult = speed > FLING_THRESHOLD ? 'fling' : 'drag_end'
        resultFadeStart = now

        // Transfer velocity - let it fly!
        posX.v = vx
        posY.v = vy

        // Fling: destination is where velocity takes it (will be clamped by physics)
        // Drag end: stay where released
        posX.dest = posX.pos
        posY.dest = posY.pos
      }

      pointerState = 'up'
      scaleSpring.dest = 1
      pointerHistory = []
      currentSpeed = 0
      wouldFling = false
      animatedUntilTime = null
      circle.style.cursor = 'grab'
    }

    // Physics
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP)
    newAnimatedUntilTime += steps * MS_PER_STEP

    const BOUNCE_DAMPING = 0.7 // velocity retained after bounce
    const FRICTION = 0.995 // velocity retained per step (air resistance)

    for (let i = 0; i < steps; i++) {
      // Scale always uses spring
      springStep(scaleSpring)

      // Fling physics: simple friction + bounce (no spring)
      if (pointerState === 'up' && (Math.abs(posX.v) > 0.5 || Math.abs(posY.v) > 0.5)) {
        // Apply friction
        posX.v *= FRICTION
        posY.v *= FRICTION

        // Update position
        posX.pos += posX.v * MS_PER_STEP / 1000
        posY.pos += posY.v * MS_PER_STEP / 1000

        // Bounce off edges
        if (posX.pos < RADIUS) {
          posX.pos = RADIUS
          posX.v = -posX.v * BOUNCE_DAMPING
        } else if (posX.pos > demoW - RADIUS) {
          posX.pos = demoW - RADIUS
          posX.v = -posX.v * BOUNCE_DAMPING
        }

        if (posY.pos < RADIUS) {
          posY.pos = RADIUS
          posY.v = -posY.v * BOUNCE_DAMPING
        } else if (posY.pos > demoH - RADIUS) {
          posY.pos = demoH - RADIUS
          posY.v = -posY.v * BOUNCE_DAMPING
        }

        posX.dest = posX.pos
        posY.dest = posY.pos
      } else if (pointerState === 'up') {
        // Settled - use spring to stay in place
        springStep(posX)
        springStep(posY)
      }
    }

    // Clamp dest to valid range
    posX.dest = Math.max(RADIUS, Math.min(demoW - RADIUS, posX.dest))
    posY.dest = Math.max(RADIUS, Math.min(demoH - RADIUS, posY.dest))

    const springs = [posX, posY, scaleSpring]
    for (const s of springs) {
      if (!springAtRest(s)) stillAnimating = true
      else springSnap(s)
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // Fade out result after 2 seconds
    let resultAlpha = 1
    if (resultFadeStart && now - resultFadeStart > 2000) {
      resultAlpha = Math.max(0, 1 - (now - resultFadeStart - 2000) / 500)
      if (resultAlpha <= 0) {
        lastResult = null
        resultFadeStart = null
      } else {
        stillAnimating = true
      }
    }

    // === DOM write ===
    const x = posX.pos - RADIUS
    const y = posY.pos - RADIUS
    const scale = scaleSpring.pos
    circle.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`

    const isDragging = pointerState === 'dragging'
    const green = '39, 174, 96'
    const red = '231, 76, 60'

    // Choose color: red when would fling (during drag) or did fling (after release)
    let color = green
    if (isDragging && wouldFling) color = red
    if (lastResult === 'fling') color = red

    circle.style.background = `rgba(${color}, ${isDragging ? 0.2 : 0.15})`
    circle.style.borderColor = `rgba(${color}, ${isDragging ? 0.7 : 0.5})`

    // Update label
    if (isDragging && wouldFling) {
      circle.textContent = 'fling!'
      circle.style.color = `rgba(${red}, 0.8)`
    } else {
      circle.textContent = 'fling?'
      circle.style.color = 'rgba(0, 0, 0, 0.4)'
    }

    // Update readout
    if (isDragging) {
      const speedColor = wouldFling ? red : green
      const speedLabel = wouldFling ? 'will fling' : 'too slow'
      readout.innerHTML = `<span class="val">${Math.round(currentSpeed)} px/s</span> — <span style="color:rgba(${speedColor},1)">${speedLabel}</span>`
    } else if (lastResult && resultAlpha > 0) {
      if (lastResult === 'fling') {
        readout.innerHTML = `<span style="color:rgba(${red},${resultAlpha})">FLING!</span> <span class="val">${Math.round(lastSpeed)} px/s</span>`
      } else {
        readout.innerHTML = `drag end — <span class="val">${Math.round(lastSpeed)} px/s</span> (need &gt; ${FLING_THRESHOLD})`
      }
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
if (document.getElementById('demo-fling')) {
  initFling()
}
