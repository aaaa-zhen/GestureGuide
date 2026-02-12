// State Machine Demo (Chapter 5)
// chenglou-style: interactive visualization of gesture recognizer state transitions

import { GESTURE } from '../engine/render-loop.js'

const CIRCUMFERENCE = 2 * Math.PI * 24
const FLING_VEL_THRESHOLD = 300

export function initStateMachine() {
  const demo = document.getElementById('demo-state-machine')
  if (!demo) return

  const touchArea = document.getElementById('sm-touch-area')
  const readout = document.getElementById('sm-readout')
  const hint = document.getElementById('hint-sm')
  const log = document.getElementById('sm-log')
  const ring = document.getElementById('sm-ring')
  const ringFill = document.getElementById('sm-ring-fill')

  const badges = {
    idle: document.getElementById('sm-badge-idle'),
    pressed: document.getElementById('sm-badge-pressed'),
    dragging: document.getElementById('sm-badge-dragging'),
    tap: document.getElementById('sm-badge-tap'),
    longpress: document.getElementById('sm-badge-longpress'),
    fling: document.getElementById('sm-badge-fling'),
  }

  const edges = document.querySelectorAll('.sm-edge')

  // === state ===
  let state = 'idle'
  let downX = 0, downY = 0, downTime = 0
  let lastX = 0, lastY = 0, lastTime = 0
  let lpTimer = null
  let resetTimer = null
  let progressRAF = null
  let transitionHistory = []

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
      render(now)
    })
  }

  function setState(s) {
    const prev = state
    state = s

    for (const [key, el] of Object.entries(badges)) {
      if (el) el.classList.toggle('active', key === s)
    }

    edges.forEach(e => e.classList.remove('active'))
    const edgeEl = document.getElementById(`edge-${prev}-${s}`)
    if (edgeEl) edgeEl.classList.add('active')

    if (prev !== s) {
      transitionHistory.unshift(`${prev} → ${s}`)
      if (transitionHistory.length > 6) transitionHistory.pop()
      renderLog()
    }
  }

  function renderLog() {
    if (!log) return
    log.innerHTML = transitionHistory.map((t, i) =>
      `<div class="sm-log-entry${i === 0 ? ' latest' : ''}">${t}</div>`
    ).join('')
  }

  function showRing(x, y) {
    if (!ring || !touchArea) return
    const r = touchArea.getBoundingClientRect()
    ring.style.display = 'block'
    ring.style.left = (x - r.left - 28) + 'px'
    ring.style.top = (y - r.top - 28) + 'px'
    ringFill.style.strokeDasharray = CIRCUMFERENCE
    ringFill.style.strokeDashoffset = CIRCUMFERENCE
  }

  function hideRing() {
    if (!ring) return
    ring.style.display = 'none'
    if (progressRAF) {
      cancelAnimationFrame(progressRAF)
      progressRAF = null
    }
  }

  function updateProgress() {
    if (state !== 'pressed') return
    const elapsed = performance.now() - downTime
    const progress = Math.min(1, elapsed / GESTURE.LONG_PRESS_MS)
    ringFill.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress)
    if (progress < 1) {
      progressRAF = requestAnimationFrame(updateProgress)
    }
  }

  function scheduleReset() {
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      setState('idle')
      readout.innerHTML = ''
    }, 1800)
  }

  // === main render ===
  function render(now) {
    // pointerdown
    if (events.pointerdown) {
      const e = events.pointerdown
      if (resetTimer) clearTimeout(resetTimer)

      downX = e.clientX
      downY = e.clientY
      downTime = performance.now()
      lastX = e.clientX
      lastY = e.clientY
      lastTime = downTime

      if (hint) hint.style.display = 'none'

      setState('pressed')
      showRing(e.clientX, e.clientY)
      updateProgress()

      readout.innerHTML = `state = <span class="val">pressed</span>\nwaiting for gesture...`

      lpTimer = setTimeout(() => {
        if (state === 'pressed') {
          hideRing()
          setState('longpress')
          readout.innerHTML = `state = <span class="val">longpress</span>\nresult = <span class="val">LONG PRESS</span>`
          scheduleReset()
        }
      }, GESTURE.LONG_PRESS_MS)
    }

    // pointermove
    if (events.pointermove && (state === 'pressed' || state === 'dragging')) {
      const e = events.pointermove
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY)

      lastX = e.clientX
      lastY = e.clientY
      lastTime = performance.now()

      if (state === 'pressed' && dist > GESTURE.TOUCH_SLOP) {
        clearTimeout(lpTimer)
        lpTimer = null
        hideRing()
        setState('dragging')
        touchArea.classList.add('dragging')
      }

      if (state === 'dragging') {
        const dx = Math.round(e.clientX - downX)
        const dy = Math.round(e.clientY - downY)
        readout.innerHTML =
          `state = <span class="val">dragging</span>\n` +
          `delta = <span class="val">${dx}, ${dy}</span>`
      }
    }

    // pointerup
    if (events.pointerup && (state === 'pressed' || state === 'dragging')) {
      const e = events.pointerup
      clearTimeout(lpTimer)
      lpTimer = null
      hideRing()
      touchArea.classList.remove('dragging')

      if (state === 'pressed') {
        const dt = performance.now() - downTime
        setState('tap')
        readout.innerHTML =
          `state = <span class="val">tap</span>\n` +
          `duration = <span class="val">${Math.round(dt)}ms</span>`
        scheduleReset()
      } else if (state === 'dragging') {
        const totalDt = performance.now() - downTime
        const totalDist = Math.hypot(e.clientX - downX, e.clientY - downY)
        const avgVel = totalDist / totalDt * 1000

        if (avgVel > FLING_VEL_THRESHOLD) {
          setState('fling')
          readout.innerHTML =
            `state = <span class="val">fling</span>\n` +
            `velocity = <span class="val">${Math.round(avgVel)} px/s</span>`
        } else {
          setState('idle')
          readout.innerHTML =
            `state = <span class="val">idle</span>\n` +
            `slow release (<span class="val">${Math.round(avgVel)} px/s</span>)`
        }
        scheduleReset()
      }
    }

    // keydown
    if (events.keydown) {
      const key = events.keydown.key
      if (key === 'Enter' || key === ' ') {
        setState('tap')
        readout.innerHTML = `state = <span class="val">tap</span>\nsource = <span class="val">keyboard</span>`
        if (hint) hint.style.display = 'none'
        scheduleReset()
      } else if (key === 'Escape') {
        clearTimeout(lpTimer)
        hideRing()
        touchArea.classList.remove('dragging')
        setState('idle')
        readout.innerHTML = ''
      }
    }

    // Clear events
    events.pointerdown = null
    events.pointermove = null
    events.pointerup = null
    events.keydown = null
  }

  // === event listeners ===
  touchArea.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    touchArea.setPointerCapture(e.pointerId)
    events.pointerdown = e
    scheduleRender()
  }, { passive: false })

  touchArea.addEventListener('pointermove', (e) => {
    events.pointermove = e
    scheduleRender()
  })

  touchArea.addEventListener('pointerup', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  touchArea.addEventListener('pointercancel', (e) => {
    events.pointerup = e
    scheduleRender()
  })

  touchArea.addEventListener('keydown', (e) => {
    if (['Enter', ' ', 'Escape'].includes(e.key)) {
      e.preventDefault()
      events.keydown = e
      scheduleRender()
    }
  })

  // Initial state
  setState('idle')
  hideRing()
}

// Auto-init
if (document.getElementById('demo-state-machine')) {
  initStateMachine()
}
