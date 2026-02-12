// Recognizer Arena Demo (Chapter 1)
// chenglou-style: DOM + transform3d, Tap vs Long Press vs Drag competing in real time

import { spring, springStep, springSnap, springAtRest, GESTURE } from '../engine/render-loop.js'
import { onResize } from '../engine/lifecycle.js'

const MS_PER_STEP = 4
const RADIUS = 28

export function initRecognizerArena() {
  const demo = document.getElementById('demo-arena')
  if (!demo) return

  // Hide old DOM elements
  const oldBox = document.getElementById('arena-box')
  const oldRing = document.getElementById('arena-ring')
  if (oldBox) oldBox.style.display = 'none'
  if (oldRing) oldRing.style.display = 'none'

  const readout = document.getElementById('arena-readout')
  const hint = document.getElementById('hint-arena')
  const badges = {
    idle: document.getElementById('badge-idle'),
    pressed: document.getElementById('badge-pressed'),
    tap: document.getElementById('badge-tap'),
    longpress: document.getElementById('badge-longpress'),
    drag: document.getElementById('badge-drag'),
  }

  // Create circle element
  const circle = document.createElement('div')
  circle.style.cssText = `
    position: absolute;
    width: ${RADIUS * 2}px;
    height: ${RADIUS * 2}px;
    border-radius: 50%;
    background: rgba(212, 130, 10, 0.15);
    border: 2px solid rgba(212, 130, 10, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font: 9px -apple-system, BlinkMacSystemFont, sans-serif;
    color: rgba(0, 0, 0, 0.4);
    cursor: grab;
    will-change: transform;
    user-select: none;
  `
  circle.textContent = 'arena'
  demo.appendChild(circle)

  // Create progress rings (SVG)
  const progressSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  progressSvg.style.cssText = `
    position: absolute;
    pointer-events: none;
    will-change: transform;
  `
  progressSvg.setAttribute('width', '100')
  progressSvg.setAttribute('height', '100')
  progressSvg.setAttribute('viewBox', '0 0 100 100')
  demo.appendChild(progressSvg)

  // Long press progress ring (purple)
  const lpRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  lpRing.setAttribute('cx', '50')
  lpRing.setAttribute('cy', '50')
  lpRing.setAttribute('r', '36')
  lpRing.setAttribute('fill', 'none')
  lpRing.setAttribute('stroke', 'rgba(112, 64, 176, 0.6)')
  lpRing.setAttribute('stroke-width', '3')
  lpRing.setAttribute('stroke-linecap', 'round')
  lpRing.setAttribute('transform', 'rotate(-90 50 50)')
  const lpCircumference = 2 * Math.PI * 36
  lpRing.setAttribute('stroke-dasharray', `${lpCircumference}`)
  lpRing.setAttribute('stroke-dashoffset', `${lpCircumference}`)
  progressSvg.appendChild(lpRing)

  // Drag progress ring (blue)
  const dragRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  dragRing.setAttribute('cx', '50')
  dragRing.setAttribute('cy', '50')
  dragRing.setAttribute('r', '42')
  dragRing.setAttribute('fill', 'none')
  dragRing.setAttribute('stroke', 'rgba(43, 92, 230, 0.6)')
  dragRing.setAttribute('stroke-width', '3')
  dragRing.setAttribute('stroke-linecap', 'round')
  dragRing.setAttribute('transform', 'rotate(-90 50 50)')
  const dragCircumference = 2 * Math.PI * 42
  dragRing.setAttribute('stroke-dasharray', `${dragCircumference}`)
  dragRing.setAttribute('stroke-dashoffset', `${dragCircumference}`)
  progressSvg.appendChild(dragRing)

  // === state ===
  let posX = spring(0, 0, 290, 24)
  let posY = spring(0, 0, 290, 24)
  let scaleSpring = spring(1, 0, 400, 22)

  let demoW = 0, demoH = 0
  let initialized = false
  let animatedUntilTime = null

  /** @type {'idle' | 'pressed' | 'tap' | 'longpress' | 'drag'} */
  let state = 'idle'
  let downX = 0, downY = 0, downTime = 0
  let offsetX = 0, offsetY = 0
  let currentDist = 0 // distance from down point

  // Result state
  let resultState = null // 'tap' | 'longpress' | 'drag_end'
  let resultFadeStart = null

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
    requestAnimationFrame(function renderAndMaybeScheduleAnotherRender(now) {
      scheduledRender = false
      if (render(now)) scheduleRender()
    })
  }

  function setState(s) {
    state = s
    for (const [key, el] of Object.entries(badges)) {
      if (el) el.classList.toggle('active', key === s)
    }
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
      const px = events.pointerdown.clientX - rect.left
      const py = events.pointerdown.clientY - rect.top

      if (isInsideCircle(px, py)) {
        downX = px
        downY = py
        downTime = now
        offsetX = px - posX.pos
        offsetY = py - posY.pos
        currentDist = 0
        posX.v = posY.v = 0
        scaleSpring.dest = 1.15
        animatedUntilTime = null

        setState('pressed')
        resultState = null
        resultFadeStart = null
        if (hint) hint.style.display = 'none'
        circle.style.cursor = 'grabbing'
      }
    }

    // pointermove
    if (events.pointermove && (state === 'pressed' || state === 'drag')) {
      const rect = demo.getBoundingClientRect()
      const px = events.pointermove.clientX - rect.left
      const py = events.pointermove.clientY - rect.top
      currentDist = Math.hypot(px - downX, py - downY)

      if (state === 'pressed' && currentDist > GESTURE.TOUCH_SLOP) {
        // Drag wins!
        setState('drag')
      }

      if (state === 'drag') {
        let newX = px - offsetX
        let newY = py - offsetY
        newX = Math.max(RADIUS, Math.min(demoW - RADIUS, newX))
        newY = Math.max(RADIUS, Math.min(demoH - RADIUS, newY))
        posX.pos = posX.dest = newX
        posY.pos = posY.dest = newY
      }
    }

    // Check long press timeout (in pressed state)
    if (state === 'pressed') {
      const elapsed = now - downTime
      if (elapsed >= GESTURE.LONG_PRESS_MS) {
        // Long press wins!
        setState('longpress')
        resultState = 'longpress'
        resultFadeStart = now
        scaleSpring.dest = 1
        animatedUntilTime = null
        circle.style.cursor = 'grab'
      }
    }

    // pointerup
    if (events.pointerup && (state === 'pressed' || state === 'drag')) {
      if (state === 'pressed') {
        // Tap wins!
        setState('tap')
        resultState = 'tap'
        resultFadeStart = now
      } else if (state === 'drag') {
        resultState = 'drag_end'
        resultFadeStart = now
      }

      scaleSpring.dest = 1
      posX.dest = demoW / 2
      posY.dest = demoH / 2
      animatedUntilTime = null
      circle.style.cursor = 'grab'
    }

    // keydown - reset
    if (events.keydown && events.keydown.key === 'Escape') {
      setState('idle')
      resultState = null
      resultFadeStart = null
      posX.pos = posX.dest = demoW / 2
      posY.pos = posY.dest = demoH / 2
      scaleSpring.pos = scaleSpring.dest = 1
      currentDist = 0
    }

    // Auto-reset to idle after result
    if (resultFadeStart && now - resultFadeStart > 1500 && state !== 'idle' && state !== 'pressed' && state !== 'drag') {
      setState('idle')
    }

    // Fade out result
    let resultAlpha = 1
    if (resultFadeStart && now - resultFadeStart > 2000) {
      resultAlpha = Math.max(0, 1 - (now - resultFadeStart - 2000) / 500)
      if (resultAlpha <= 0) {
        resultState = null
        resultFadeStart = null
      } else {
        stillAnimating = true
      }
    }

    // Physics
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP)
    newAnimatedUntilTime += steps * MS_PER_STEP

    if (state !== 'drag' && state !== 'pressed') {
      for (let i = 0; i < steps; i++) {
        springStep(posX)
        springStep(posY)
        springStep(scaleSpring)
      }
    } else {
      for (let i = 0; i < steps; i++) {
        springStep(scaleSpring)
      }
    }

    const springs = [posX, posY, scaleSpring]
    for (const s of springs) {
      if (!springAtRest(s)) stillAnimating = true
      else springSnap(s)
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // === DOM write ===
    const orange = '212, 130, 10'
    const green = '39, 174, 96'
    const blue = '43, 92, 230'
    const purple = '112, 64, 176'

    // Choose color based on state
    let color = orange
    if (state === 'tap' || resultState === 'tap') color = green
    if (state === 'drag' || resultState === 'drag_end') color = blue
    if (state === 'longpress' || resultState === 'longpress') color = purple

    const isActive = state === 'pressed' || state === 'drag'

    // Position circle
    const x = posX.pos - RADIUS
    const y = posY.pos - RADIUS
    const scale = scaleSpring.pos
    circle.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
    circle.style.background = `rgba(${color}, ${isActive ? 0.25 : 0.15})`
    circle.style.borderColor = `rgba(${color}, ${isActive ? 0.8 : 0.5})`

    // Update label
    if (state === 'idle') {
      circle.textContent = 'arena'
      circle.style.color = 'rgba(0, 0, 0, 0.35)'
    } else if (state === 'pressed') {
      circle.textContent = '...'
      circle.style.color = `rgba(${orange}, 0.8)`
    } else if (state === 'drag') {
      circle.textContent = 'drag'
      circle.style.color = `rgba(${blue}, 0.8)`
    } else {
      circle.textContent = 'arena'
      circle.style.color = 'rgba(0, 0, 0, 0.35)'
    }

    // Position and update progress rings
    progressSvg.style.left = `${posX.pos - 50}px`
    progressSvg.style.top = `${posY.pos - 50}px`

    if (state === 'pressed') {
      const elapsed = now - downTime
      const lpProgress = Math.min(1, elapsed / GESTURE.LONG_PRESS_MS)
      const dragProgress = Math.min(1, currentDist / GESTURE.TOUCH_SLOP)

      // Long press ring
      const lpOffset = lpCircumference * (1 - lpProgress)
      lpRing.setAttribute('stroke-dashoffset', `${lpOffset}`)
      lpRing.style.opacity = '1'

      // Drag ring
      const dragOffset = dragCircumference * (1 - dragProgress)
      dragRing.setAttribute('stroke-dashoffset', `${dragOffset}`)
      dragRing.style.opacity = dragProgress > 0 ? '1' : '0'
    } else {
      lpRing.style.opacity = '0'
      dragRing.style.opacity = '0'
      lpRing.setAttribute('stroke-dashoffset', `${lpCircumference}`)
      dragRing.setAttribute('stroke-dashoffset', `${dragCircumference}`)
    }

    // Update readout
    if (state === 'pressed') {
      const elapsed = now - downTime
      readout.innerHTML =
        `<span style="color:rgba(${purple},1)">${Math.round(elapsed)}ms</span> / ${GESTURE.LONG_PRESS_MS}ms — ` +
        `<span style="color:rgba(${blue},1)">${Math.round(currentDist)}px</span> / ${GESTURE.TOUCH_SLOP}px`
    } else if (state === 'drag') {
      readout.innerHTML = `<span style="color:rgba(${blue},1)">DRAG</span> — move: ${Math.round(currentDist)}px`
    } else if (resultState === 'tap') {
      readout.innerHTML = `<span style="color:rgba(${green},1)">TAP</span> — finger lifted quickly`
    } else if (resultState === 'longpress') {
      readout.innerHTML = `<span style="color:rgba(${purple},1)">LONG PRESS</span> — held ${GESTURE.LONG_PRESS_MS}ms`
    } else if (resultState === 'drag_end') {
      readout.innerHTML = `<span style="color:rgba(${blue},1)">DRAG END</span>`
    } else {
      readout.innerHTML = ''
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.keydown = null

    // Keep animating while pressed (for progress updates)
    return stillAnimating || state === 'pressed' || state === 'drag'
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

  function updateSize() {
    const rect = demo.getBoundingClientRect()
    demoW = rect.width
    demoH = rect.height
    scheduleRender()
  }

  updateSize()
  onResize(updateSize)
  setState('idle')
}

// Auto-init
if (document.getElementById('demo-arena')) {
  initRecognizerArena()
}
