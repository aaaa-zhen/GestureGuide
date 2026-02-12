// Overscroll / Bounce-Back Demo (Chapter 2)
// Scrollable list with momentum. When flung to the edge with velocity,
// content bounces past the boundary and springs back.

import { spring, springStep, springAtRest, springSnap, clamp } from '../engine/render-loop.js'
import { onCleanup, onResize } from '../engine/lifecycle.js'
import { demoRGB } from '../engine/colors.js'

const ITEM_HEIGHT = 44
const ITEM_COUNT = 15
const VELOCITY_WINDOW_MS = 100
const FRICTION = 0.975          // gentle friction → long, silky coast
const REST_VELOCITY = 1         // px/s — below this fling is done
const FLING_THRESHOLD = 10      // px/s — below this don't start a fling
const RUBBER_RANGE = 200        // generous range — easy to pull, slow build-up
const RUBBER_COEFF = 0.55       // Safari-style coefficient
const BOUNCE_K = 80             // low stiffness — slow, jelly-like return
const BOUNCE_B = 18             // moderate damping — no overshoot, but unhurried
const BOUNCE_VEL_SCALE = 0.2    // almost all momentum absorbed at boundary
const MS_PER_STEP = 4

function frictionToLambda(friction) {
  return -60 * Math.log(friction)
}

function decayPosition(v0, lambda, t) {
  return (v0 / lambda) * (1 - Math.exp(-lambda * t))
}

function decayVelocity(v0, lambda, t) {
  return v0 * Math.exp(-lambda * t)
}

export function initOverscroll() {
  const demo = document.getElementById('demo-overscroll')
  if (!demo) return

  // Hide pre-defined HTML elements
  const oldShell = demo.querySelector('.lp-shell')
  if (oldShell) oldShell.style.display = 'none'

  const readout = document.getElementById('overscroll-readout')
  const hint = document.getElementById('hint-overscroll')

  // === Create list container ===
  const listContainer = document.createElement('div')
  listContainer.style.cssText = `
    position: absolute;
    left: 50%;
    top: 24px;
    transform: translateX(-50%);
    width: min(320px, calc(100% - 48px));
    height: calc(100% - 48px);
    background: var(--bg, #fff);
    border-radius: 8px;
    border: 1px solid var(--border, rgba(0,0,0,0.1));
    overflow: hidden;
    cursor: grab;
    transition: border-color 0.15s;
  `
  demo.appendChild(listContainer)

  const listContent = document.createElement('div')
  listContent.style.cssText = `
    position: absolute;
    top: 0; left: 0; right: 0;
    will-change: transform;
  `
  listContainer.appendChild(listContent)

  for (let i = 0; i < ITEM_COUNT; i++) {
    const item = document.createElement('div')
    item.style.cssText = `
      height: ${ITEM_HEIGHT}px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid var(--border, rgba(0,0,0,0.06));
      font: 14px -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)'};
    `
    item.innerHTML = `
      <span style="font-weight:600;min-width:24px;color:var(--fg,#000)">${i + 1}</span>
      <span style="color:var(--fg-secondary,#666)">Item ${i + 1}</span>
    `
    listContent.appendChild(item)
  }

  // Scroll indicator
  const scrollIndicator = document.createElement('div')
  scrollIndicator.style.cssText = `
    position: absolute;
    right: 2px;
    top: 4px;
    width: 4px;
    border-radius: 2px;
    background: rgba(0,0,0,0.15);
    opacity: 0;
    transition: opacity 0.15s;
  `
  listContainer.appendChild(scrollIndicator)

  // === State ===
  let scrollY = 0
  let listHeight = 0

  // State machine: 'idle' | 'dragging' | 'decaying' | 'bouncing'
  let state = 'idle'

  // Fling decay state (analytical)
  let decayStartTime = 0
  let decayStartY = 0
  let decayV0 = 0
  let decayLambda = 0

  // Spring bounce state — low stiffness, gentle return like Safari
  const sp = spring(0, 0, BOUNCE_K, BOUNCE_B)
  let animatedUntilTime = null

  // Pointer tracking
  let lastY = 0
  let pointer = [{ y: 0, time: 0 }]

  // === Events ===
  const events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
    wheel: null,
  }

  // === Scheduling ===
  let scheduledRender = false
  function scheduleRender() {
    if (scheduledRender) return
    scheduledRender = true
    requestAnimationFrame(function frame(now) {
      scheduledRender = false
      if (render(now)) scheduleRender()
    })
  }

  function getMaxScroll() {
    return Math.max(0, ITEM_COUNT * ITEM_HEIGHT - listHeight)
  }

  function getDragVelocity(now) {
    if (pointer.length < 2) return 0
    let i = pointer.length - 1
    while (i > 0 && now - pointer[i].time <= VELOCITY_WINDOW_MS) i--
    if (i >= pointer.length - 1) return 0
    const oldest = pointer[i]
    const newest = pointer[pointer.length - 1]
    const dt = newest.time - oldest.time
    if (dt < 1) return 0
    // Negative because drag-down (positive dy) scrolls up (negative scrollY velocity)
    return -(newest.y - oldest.y) / dt * 1000
  }

  // Safari-style rubber band: softer initial resistance, tighter clamp at extremes
  function safariRubber(distance) {
    // d * c * R / (R + c * d) — same family as Apple's rubber band
    return (distance * RUBBER_COEFF * RUBBER_RANGE) / (RUBBER_RANGE + RUBBER_COEFF * distance)
  }

  // Apply rubber band mapping for out-of-bounds display
  function getDisplayY(rawY, maxScroll) {
    if (rawY < 0) {
      return -safariRubber(-rawY)
    } else if (rawY > maxScroll) {
      return maxScroll + safariRubber(rawY - maxScroll)
    }
    return rawY
  }

  function startDecay(v0, now) {
    if (Math.abs(v0) < FLING_THRESHOLD) {
      state = 'idle'
      scrollIndicator.style.opacity = '0'
      return
    }
    state = 'decaying'
    decayStartTime = now
    decayStartY = scrollY
    decayV0 = v0
    decayLambda = frictionToLambda(FRICTION)
  }

  function startBounce(vel) {
    state = 'bouncing'
    const maxScroll = getMaxScroll()
    const boundary = scrollY <= 0 ? 0 : maxScroll
    // Start spring from rubber-banded display position (seamless transition)
    sp.pos = getDisplayY(scrollY, maxScroll)
    sp.dest = boundary
    // Safari aggressively dampens velocity entering bounce — almost pure position-driven
    sp.v = vel * BOUNCE_VEL_SCALE
    animatedUntilTime = null
  }

  function updateBorderColor(overscrollAmount) {
    if (overscrollAmount > 0) {
      const t = clamp(overscrollAmount / 200, 0, 1)
      const r = Math.round(138 + t * 93)
      const g = Math.round(138 - t * 62)
      const b = Math.round(148 - t * 88)
      listContainer.style.borderColor = `rgb(${r},${g},${b})`
      listContainer.style.boxShadow = `inset 0 2px 8px rgba(0,0,0,0.06), 0 0 ${Math.round(t * 12)}px rgba(${demoRGB('red')}, ${t * 0.3})`
    } else {
      listContainer.style.borderColor = ''
      listContainer.style.boxShadow = ''
    }
  }

  // === Main Render ===
  function render(now) {
    const maxScroll = getMaxScroll()
    let stillAnimating = false

    // pointerdown — interrupt any ongoing animation
    if (events.pointerdown) {
      if (state === 'decaying') {
        const t = (now - decayStartTime) / 1000
        scrollY = decayStartY + decayPosition(decayV0, decayLambda, t)
        scrollY = clamp(scrollY, 0, maxScroll)
      } else if (state === 'bouncing') {
        scrollY = sp.dest  // snap to nearest boundary
      }
      state = 'dragging'
      lastY = events.pointerdown.clientY
      pointer = [{ y: events.pointerdown.clientY, time: now }]
      listContainer.style.cursor = 'grabbing'
      if (hint) hint.style.display = 'none'
      scrollIndicator.style.opacity = '1'
    }

    // pointermove — accumulate drag
    if (events.pointermove && state === 'dragging') {
      const e = events.pointermove
      const dy = e.clientY - lastY
      lastY = e.clientY
      pointer.push({ y: e.clientY, time: now })
      if (pointer.length > 20) pointer.shift()
      scrollY -= dy  // unclamped — allows overscroll
    }

    // pointerup
    if (events.pointerup && state === 'dragging') {
      listContainer.style.cursor = 'grab'
      const v0 = getDragVelocity(now)
      pointer = [{ y: 0, time: 0 }]

      if (scrollY < 0 || scrollY > maxScroll) {
        // Currently overscrolled → bounce back
        startBounce(v0)
      } else {
        // Within bounds → fling with momentum
        startDecay(v0, now)
      }
    }

    // wheel
    if (events.wheel) {
      if (state === 'decaying') {
        const t = (now - decayStartTime) / 1000
        scrollY = decayStartY + decayPosition(decayV0, decayLambda, t)
        scrollY = clamp(scrollY, 0, maxScroll)
      } else if (state === 'bouncing') {
        scrollY = clamp(sp.pos, 0, maxScroll)
      }

      scrollY += events.wheel.deltaY

      if (scrollY < 0 || scrollY > maxScroll) {
        // Past boundary → bounce back
        startBounce(0)
      } else {
        // Within bounds → momentum
        startDecay(events.wheel.deltaY * 30, now)
      }
      if (hint) hint.style.display = 'none'
      scrollIndicator.style.opacity = '1'
    }

    // === Analytical decay ===
    if (state === 'decaying') {
      const t = (now - decayStartTime) / 1000
      scrollY = decayStartY + decayPosition(decayV0, decayLambda, t)
      const currentV = decayVelocity(decayV0, decayLambda, t)

      if (scrollY < 0) {
        // Hit top boundary → bounce
        scrollY = 0
        sp.pos = 0
        sp.dest = 0
        sp.v = currentV * BOUNCE_VEL_SCALE  // dampen velocity entering bounce
        state = 'bouncing'
        animatedUntilTime = null
        stillAnimating = true
      } else if (scrollY > maxScroll) {
        // Hit bottom boundary → bounce
        scrollY = maxScroll
        sp.pos = maxScroll
        sp.dest = maxScroll
        sp.v = currentV * BOUNCE_VEL_SCALE  // dampen velocity entering bounce
        state = 'bouncing'
        animatedUntilTime = null
        stillAnimating = true
      } else if (Math.abs(currentV) < REST_VELOCITY) {
        state = 'idle'
        scrollIndicator.style.opacity = '0'
      } else {
        stillAnimating = true
      }
    }

    // === Spring bounce ===
    if (state === 'bouncing') {
      let newTime = animatedUntilTime ?? now
      const steps = Math.floor((now - newTime) / MS_PER_STEP)
      newTime += steps * MS_PER_STEP

      for (let i = 0; i < steps; i++) springStep(sp)

      // Slightly relaxed rest threshold for low-stiffness bounce
      // (avoids imperceptible sub-pixel tail dragging on for too long)
      const atRest = Math.abs(sp.v) < 0.5 && Math.abs(sp.dest - sp.pos) < 0.5
      if (atRest) {
        springSnap(sp)
        scrollY = sp.pos
        state = 'idle'
        scrollIndicator.style.opacity = '0'
      } else {
        scrollY = sp.pos
        stillAnimating = true
        animatedUntilTime = newTime
      }
    }

    // === Display ===
    // During bounce: spring position IS the display (no rubber mapping)
    // so overscroll distance is directly proportional to velocity
    // During drag: rubber band mapping compresses overscroll (resistance feel)
    let displayY
    if (state === 'bouncing') {
      displayY = scrollY
    } else {
      displayY = getDisplayY(scrollY, maxScroll)
    }
    const overscrollAmount = displayY < 0 ? -displayY : (displayY > maxScroll ? displayY - maxScroll : 0)
    listContent.style.transform = `translate3d(0, ${-displayY}px, 0)`

    // Border color feedback
    updateBorderColor(overscrollAmount)

    // Scroll indicator
    const clampedY = clamp(scrollY, 0, maxScroll)
    const scrollRatio = maxScroll > 0 ? clampedY / maxScroll : 0
    const indicatorH = Math.max(24, (listHeight / (ITEM_COUNT * ITEM_HEIGHT)) * listHeight)
    const indicatorY = 4 + scrollRatio * (listHeight - indicatorH - 8)
    scrollIndicator.style.height = indicatorH + 'px'
    scrollIndicator.style.transform = `translate3d(0, ${indicatorY}px, 0)`

    if (state === 'decaying' || state === 'bouncing') {
      scrollIndicator.style.background = 'rgba(128, 128, 128, 0.5)'
    } else {
      scrollIndicator.style.background = 'rgba(0, 0, 0, 0.15)'
    }

    // Readout
    if (state === 'bouncing' || (state === 'dragging' && overscrollAmount > 1)) {
      readout.innerHTML =
        `overscroll = <span class="val">${Math.round(overscrollAmount)}px</span> ` +
        `state = <span class="val">bouncing back</span>`
    } else if (state === 'decaying') {
      const t = (now - decayStartTime) / 1000
      const v = Math.abs(decayVelocity(decayV0, decayLambda, t))
      if (v > 10) {
        readout.innerHTML =
          `velocity = <span class="val">${Math.round(v)} px/s</span> ` +
          `state = <span class="val">coasting</span>`
      } else {
        readout.innerHTML = ''
      }
    } else {
      readout.innerHTML = ''
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.wheel = null

    return stillAnimating || state === 'dragging'
  }

  // === Event listeners ===
  let activePointerId = null

  listContainer.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    activePointerId = e.pointerId
    listContainer.setPointerCapture(e.pointerId)
    events.pointerdown = e
    scheduleRender()
  }, { passive: false })

  listContainer.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return
    events.pointermove = e
    scheduleRender()
  })

  function handlePointerEnd(e) {
    if (state !== 'dragging') return
    activePointerId = null
    events.pointerup = e
    scheduleRender()
  }

  listContainer.addEventListener('pointerup', handlePointerEnd)
  listContainer.addEventListener('pointercancel', handlePointerEnd)
  listContainer.addEventListener('lostpointercapture', handlePointerEnd)

  const onDocumentPointerUp = (e) => {
    if (state === 'dragging') handlePointerEnd(e)
  }
  document.addEventListener('pointerup', onDocumentPointerUp)
  onCleanup(() => document.removeEventListener('pointerup', onDocumentPointerUp))

  listContainer.addEventListener('wheel', (e) => {
    e.preventDefault()
    events.wheel = e
    scheduleRender()
  }, { passive: false })

  // Resize
  function updateSize() {
    listHeight = listContainer.clientHeight
    scheduleRender()
  }

  updateSize()
  onResize(updateSize)
}

// Auto-init
if (document.getElementById('demo-overscroll')) {
  initOverscroll()
}
