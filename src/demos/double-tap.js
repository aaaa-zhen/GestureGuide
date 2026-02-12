// Double Tap Demo (Chapter 1)
// chenglou-style: DOM + transform3d, tap anywhere shows single/double tap circles

import { spring, springStep, springSnap, springAtRest, GESTURE } from '../engine/render-loop.js'

const MS_PER_STEP = 4
const TAP_MOVE_LIMIT = GESTURE.TOUCH_SLOP
const MAX_STEPS_PER_FRAME = 500

export function initDoubleTap() {
  const demo = document.getElementById('demo-doubletap')
  if (!demo) return

  const readout = document.getElementById('dtap-readout')
  const hint = document.getElementById('hint-dtap')

  // Container for tap circles
  const tapContainer = document.createElement('div')
  tapContainer.style.cssText = `
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  `
  demo.appendChild(tapContainer)

  // === state ===
  let singleCount = 0
  let doubleCount = 0
  let downTime = 0, downX = 0, downY = 0
  let pendingTap = null
  let taps = [] // { el, x, y, scale: spring, type: 'single' | 'double', createdAt }
  let animatedUntilTime = null
  const FADE_DELAY = 400
  const FADE_DURATION = 300

  // === events ===
  const events = {
    pointerdown: null,
    pointerup: null,
    pendingTimeout: null,
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

  function getPos(e) {
    const rect = demo.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function createKeyboardEventPair() {
    const rect = demo.getBoundingClientRect()
    const clientX = rect.left + rect.width / 2
    const clientY = rect.top + rect.height / 2
    const downTime = performance.now()
    return {
      down: { clientX, clientY, timeStamp: downTime },
      up: { clientX, clientY, timeStamp: downTime + 1 },
    }
  }

  function createTapCircle(x, y, type) {
    const isDouble = type === 'double'
    const color = isDouble ? '39, 174, 96' : '112, 64, 176'
    const size = isDouble ? 60 : 48

    const el = document.createElement('div')
    el.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: rgba(${color}, 0.15);
      border: 2px solid rgba(${color}, 0.5);
      pointer-events: none;
      will-change: transform, opacity;
    `
    el.style.left = `${x - size / 2}px`
    el.style.top = `${y - size / 2}px`
    tapContainer.appendChild(el)
    return el
  }

  function addTap(x, y, type, now) {
    const s = spring(0, 0, 350, 24)
    s.dest = 1
    const el = createTapCircle(x, y, type)
    taps.push({ el, x, y, scale: s, type, createdAt: now })
    animatedUntilTime = null
  }

  // === main render ===
  function render(now) {
    let stillAnimating = false

    // pending timeout fired → single tap
    if (events.pendingTimeout && pendingTap) {
      singleCount++
      addTap(pendingTap.x, pendingTap.y, 'single', now)
      readout.innerHTML = `SINGLE TAP #<span class="val">${singleCount}</span>`
      pendingTap = null
    }

    // pointerdown
    if (events.pointerdown) {
      const e = events.pointerdown
      downTime = e.timeStamp
      const pos = getPos(e)
      downX = pos.x
      downY = pos.y
    }

    // pointerup
    if (events.pointerup) {
      const e = events.pointerup
      const dt = e.timeStamp - downTime
      const pos = getPos(e)
      const dist = Math.hypot(pos.x - downX, pos.y - downY)

      if (dt < GESTURE.TAP_MAX_MS && dist < TAP_MOVE_LIMIT) {
        if (hint) hint.style.display = 'none'

        if (pendingTap &&
            (now - pendingTap.time < GESTURE.DOUBLE_TAP_MS) &&
            Math.hypot(pos.x - pendingTap.x, pos.y - pendingTap.y) < GESTURE.DOUBLE_TAP_DISTANCE) {
          // Double tap!
          clearTimeout(pendingTap.timer)
          pendingTap = null
          doubleCount++
          addTap(pos.x, pos.y, 'double', now)
          readout.innerHTML =
            `DOUBLE TAP #<span class="val">${doubleCount}</span> ` +
            `(<span class="val">${Math.round(dt)}ms</span>, <span class="val">${Math.round(dist)}px</span>)`
        } else {
          if (pendingTap) {
            clearTimeout(pendingTap.timer)
            singleCount++
            addTap(pendingTap.x, pendingTap.y, 'single', now)
            readout.innerHTML = `SINGLE TAP #<span class="val">${singleCount}</span>`
          }
          pendingTap = {
            x: pos.x, y: pos.y, time: now,
            timer: setTimeout(() => {
              events.pendingTimeout = true
              scheduleRender()
            }, GESTURE.DOUBLE_TAP_MS),
          }
          readout.innerHTML =
            `waiting ${GESTURE.DOUBLE_TAP_MS}ms for second tap ` +
            `(<span class="val">${Math.round(dt)}ms</span>, <span class="val">${Math.round(dist)}px</span>)`
        }
      } else {
        readout.innerHTML =
          `not a tap (<span class="val">${Math.round(dt)}ms</span> / ${GESTURE.TAP_MAX_MS}ms, ` +
          `<span class="val">${Math.round(dist)}px</span> / ${TAP_MOVE_LIMIT}px)`
      }
    }

    // Physics
    let newAnimatedUntilTime = animatedUntilTime ?? now
    const steps = Math.min(Math.floor((now - newAnimatedUntilTime) / MS_PER_STEP), MAX_STEPS_PER_FRAME)
    newAnimatedUntilTime += steps * MS_PER_STEP

    for (const tap of taps) {
      for (let i = 0; i < steps; i++) springStep(tap.scale)
      if (!springAtRest(tap.scale)) stillAnimating = true
      else springSnap(tap.scale)
    }

    animatedUntilTime = stillAnimating ? newAnimatedUntilTime : null

    // === DOM write ===
    for (let i = taps.length - 1; i >= 0; i--) {
      const tap = taps[i]
      const { el, scale, createdAt } = tap
      const s = scale.pos

      const age = now - createdAt
      let alpha = 1
      if (age > FADE_DELAY) {
        const fadeProgress = (age - FADE_DELAY) / FADE_DURATION
        alpha = 1 - fadeProgress
        if (alpha <= 0) {
          el.remove()
          taps.splice(i, 1)
          continue
        }
        stillAnimating = true
      }

      el.style.transform = `scale(${s})`
      el.style.opacity = alpha
    }

    // Clear events
    events.pointerdown = null
    events.pointerup = null
    events.pendingTimeout = null

    return stillAnimating || taps.length > 0
  }

  // === event listeners ===
  demo.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    events.pointerdown = e
    scheduleRender()
  }, { passive: false })

  demo.addEventListener('pointerup', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  demo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const synthetic = createKeyboardEventPair()
      events.pointerdown = synthetic.down
      events.pointerup = synthetic.up
      scheduleRender()
    }
  })

  // Initial render
  scheduleRender()
}

// Auto-init
if (document.getElementById('demo-doubletap')) {
  initDoubleTap()
}
