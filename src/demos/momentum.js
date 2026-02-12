// Momentum Demo (Chapter 2)
// DecayAnimation model — stateless analytical exponential decay
// v(t) = v₀ · e^(-λt)
// position(t) = p₀ + (v₀/λ) · (1 - e^(-λt))
// Given any time t, position and velocity are pure functions — no per-frame stepping

import { onResize } from '../engine/lifecycle.js'

const ITEM_HEIGHT = 44
const ITEM_COUNT = 60
const VELOCITY_WINDOW_MS = 100
const FRICTION = 0.95
const REST_VELOCITY = 1  // px/s, below this fling is done
const FLING_THRESHOLD = 10  // px/s, below this don't start a fling

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

// =====================================================================

export function initMomentum() {
  const demo = document.getElementById('demo-momentum')
  if (!demo) return

  // Hide old DOM elements
  const oldShell = demo.querySelector('.lp-shell')
  const oldVelBar = demo.querySelector('.vel-bar')
  if (oldShell) oldShell.style.display = 'none'
  if (oldVelBar) oldVelBar.style.display = 'none'

  const readout = document.getElementById('momentum-readout')
  const hint = document.getElementById('hint-momentum')
  const frictionSlider = document.getElementById('sl-mom-friction')
  const frictionValue = document.getElementById('vl-mom-friction')

  // Create list container
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
  `
  demo.appendChild(listContainer)

  // Create list content (scrollable area)
  const listContent = document.createElement('div')
  listContent.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    will-change: transform;
  `
  listContainer.appendChild(listContent)

  // Create list items
  const items = []
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
    items.push(item)
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

  // === state ===
  let scrollY = 0
  let listHeight = 0

  // Fling state (analytical decay)
  let flingActive = false
  let flingStartTime = 0
  let flingStartY = 0
  let flingV0 = 0        // px/s
  let flingLambda = 0

  let pointerState = 'up'
  let lastY = 0
  let pointer = [{ y: 0, time: 0 }]

  // === events ===
  let events = {
    pointerdown: null,
    pointermove: null,
    pointerup: null,
    wheel: null,
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
    return frictionSlider ? parseFloat(frictionSlider.value) : FRICTION
  }

  function getMaxScroll() {
    return Math.max(0, ITEM_COUNT * ITEM_HEIGHT - listHeight)
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v
  }

  function startFling(v0, now) {
    const friction = getFriction()
    const lambda = frictionToLambda(friction)

    if (Math.abs(v0) < FLING_THRESHOLD) {
      flingActive = false
      scrollIndicator.style.opacity = '0'
      return
    }

    flingActive = true
    flingStartTime = now
    flingStartY = scrollY
    flingV0 = v0
    flingLambda = lambda
  }

  // Capture current fling position (for interruption)
  function captureFlingPosition(now) {
    if (!flingActive) return
    const t = (now - flingStartTime) / 1000
    scrollY = flingStartY + decayPosition(flingV0, flingLambda, t)
    scrollY = clamp(scrollY, 0, getMaxScroll())
    flingActive = false
  }

  // Get drag velocity in px/s from pointer history
  function getDragVelocity(now) {
    if (pointer.length < 2) return 0
    let i = pointer.length - 1
    while (i > 0 && now - pointer[i].time <= VELOCITY_WINDOW_MS) i--
    if (i >= pointer.length - 1) return 0
    const oldest = pointer[i]
    const newest = pointer[pointer.length - 1]
    const dt = newest.time - oldest.time
    if (dt < 1) return 0
    // Negative because drag-down (positive dy) should scroll up (negative velocity on scrollY)
    return -(newest.y - oldest.y) / dt * 1000
  }

  // === main render ===
  function render(now) {
    const maxScroll = getMaxScroll()
    let stillAnimating = false

    // pointerdown
    if (events.pointerdown) {
      captureFlingPosition(now)
      pointerState = 'dragging'
      lastY = events.pointerdown.clientY
      pointer = [{ y: events.pointerdown.clientY, time: now }]
      if (hint) hint.style.display = 'none'
      scrollIndicator.style.opacity = '1'
    }

    // pointermove
    if (events.pointermove && pointerState === 'dragging') {
      const e = events.pointermove
      const dy = e.clientY - lastY
      lastY = e.clientY

      pointer.push({ y: e.clientY, time: now })
      if (pointer.length > 20) pointer.shift()

      scrollY -= dy
      scrollY = clamp(scrollY, 0, maxScroll)
    }

    // pointerup
    if (events.pointerup && pointerState === 'dragging') {
      pointerState = 'up'
      const v0 = getDragVelocity(now)
      pointer = [{ y: 0, time: 0 }]
      startFling(v0, now)
    }

    // wheel scroll
    if (events.wheel) {
      captureFlingPosition(now)
      scrollY += events.wheel.deltaY
      scrollY = clamp(scrollY, 0, maxScroll)
      // Start fling with wheel velocity (deltaY * 30 ≈ deltaY * 0.5 px/frame * 60)
      startFling(events.wheel.deltaY * 30, now)
      if (hint) hint.style.display = 'none'
      scrollIndicator.style.opacity = '1'
    }

    // === Analytical decay ===
    let velocityPxPerSec = 0

    if (flingActive) {
      const t = (now - flingStartTime) / 1000
      scrollY = flingStartY + decayPosition(flingV0, flingLambda, t)
      velocityPxPerSec = Math.abs(decayVelocity(flingV0, flingLambda, t))

      // Boundary check
      if (scrollY < 0 || scrollY > maxScroll) {
        scrollY = clamp(scrollY, 0, maxScroll)
        flingActive = false
        velocityPxPerSec = 0
        scrollIndicator.style.opacity = '0'
      } else if (velocityPxPerSec < REST_VELOCITY) {
        flingActive = false
        velocityPxPerSec = 0
        scrollIndicator.style.opacity = '0'
      } else {
        stillAnimating = true
      }
    }

    // === DOM writes (batched) ===
    listContent.style.transform = `translate3d(0, ${-scrollY}px, 0)`

    // Scroll indicator
    const scrollRatio = maxScroll > 0 ? scrollY / maxScroll : 0
    const indicatorH = Math.max(24, (listHeight / (ITEM_COUNT * ITEM_HEIGHT)) * listHeight)
    const indicatorY = 4 + scrollRatio * (listHeight - indicatorH - 8)
    scrollIndicator.style.height = indicatorH + 'px'
    scrollIndicator.style.transform = `translate3d(0, ${indicatorY}px, 0)`

    if (velocityPxPerSec > 100) {
      scrollIndicator.style.background = 'rgba(128, 128, 128, 0.5)'
    } else {
      scrollIndicator.style.background = 'rgba(0, 0, 0, 0.15)'
    }

    // Readout
    if (velocityPxPerSec > 100) {
      readout.innerHTML = `<span class="val">${Math.round(velocityPxPerSec)} px/s</span>`
    } else {
      readout.innerHTML = ''
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.wheel = null

    return stillAnimating || pointerState === 'dragging'
  }

  // === event listeners ===
  listContainer.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    listContainer.setPointerCapture(e.pointerId)
    events.pointerdown = e
    scheduleRender()
  }, { passive: false })

  listContainer.addEventListener('pointermove', (e) => {
    events.pointermove = e
    scheduleRender()
  })

  listContainer.addEventListener('pointerup', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  listContainer.addEventListener('pointercancel', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  listContainer.addEventListener('wheel', (e) => {
    e.preventDefault()
    events.wheel = e
    scheduleRender()
  }, { passive: false })

  // Friction slider
  if (frictionSlider) {
    frictionSlider.addEventListener('input', () => {
      if (frictionValue) {
        frictionValue.textContent = frictionSlider.value
      }
    })
  }

  // Resize
  function updateSize() {
    listHeight = listContainer.clientHeight
    scheduleRender()
  }

  updateSize()
  onResize(updateSize)
}

// Auto-init
if (document.getElementById('demo-momentum')) {
  initMomentum()
}
